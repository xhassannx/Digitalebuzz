import type { Express } from "express";
import { isAuthenticated } from "../../replitAuth";
import { resolveOrganizationContext } from "../../middleware/organization-context";
import { storage } from "../../storage";
import { triggerWebhooks } from "../../webhooks/delivery";
import { shopifyTopicToCanvasTrigger } from "../../automation/webhook-context";
import { dispatchOrgFlowsForCanvasTrigger } from "../../automation/flow-webhook";
import { enqueueCatalogSyncFromStoreWebhook } from "../../commerce/catalog-sync-service";
import {
  buildShopifyOAuthUrl,
  completeShopifyOAuthConnection,
  createShopifyOAuthState,
  exchangeShopifyOAuthCode,
  getShopifyOAuthConfig,
} from "../../commerce/shopify-oauth";
import { registerShopifyWebhooksForIntegration, listShopifyRemoteWebhooks } from "../../commerce/shopify-webhooks-register";
import { shouldProcessShopifyWebhookDelivery } from "../../automation/shopify-webhook-guard";

const BASE_URL = (process.env.BASE_URL || process.env.PUBLIC_APP_URL || `http://localhost:${process.env.PORT || "5000"}`)
  .split(/\s*[\n#]/)[0]
  .trim()
  .replace(/\/+$/, "");

function normalizeShopifyDomain(raw: string): string {
  let s = raw.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "");
  s = s.replace(/\/$/, "");
  s = s.replace(/\.myshopify\.com$/, "");
  return s;
}

export function registerShopifyRoutes(app: Express) {
  const getUserId = (req: any): string => {
    return req.user?.claims?.sub || req.userId;
  };

  app.get(
    "/api/integrations/shopify/oauth/install",
    isAuthenticated,
    resolveOrganizationContext,
    async (req: any, res) => {
      try {
        const cfg = getShopifyOAuthConfig();
        if (!cfg) {
          return res.status(503).json({
            message:
              "Shopify OAuth is not configured. Set SHOPIFY_API_KEY and SHOPIFY_API_SECRET on the server.",
          });
        }

        const shop = String(req.query.shop || "").trim();
        if (!shop) {
          return res.status(400).json({ message: "shop query parameter is required" });
        }

        const userId = getUserId(req);
        const organizationId = req.context?.organizationId as string | undefined;
        const state = createShopifyOAuthState();
        const redirectUri = `${BASE_URL}/api/integrations/shopify/oauth/callback`;

        await storage.createOAuthState({
          userId,
          organizationId: organizationId || null,
          integrationName: "shopify",
          state,
          redirectUri,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        });

        const authUrl = buildShopifyOAuthUrl({ shop, redirectUri, state });
        if (req.query.json === "1") {
          return res.json({ authUrl });
        }
        res.redirect(authUrl);
      } catch (error: unknown) {
        console.error("Shopify OAuth install error:", error);
        res.status(500).json({
          message: error instanceof Error ? error.message : "Failed to start Shopify OAuth",
        });
      }
    }
  );

  app.get("/api/integrations/shopify/oauth/callback", async (req: any, res) => {
    const failRedirect = (msg: string) =>
      res.redirect(`${BASE_URL}/integrations?shopify_error=${encodeURIComponent(msg)}`);

    try {
      const code = String(req.query.code || "");
      const shop = String(req.query.shop || "");
      const state = String(req.query.state || "");

      if (!code || !shop || !state) {
        return failRedirect("Missing OAuth parameters from Shopify");
      }

      const oauthState = await storage.getOAuthState(state);
      if (!oauthState || oauthState.integrationName !== "shopify") {
        return failRedirect("Invalid or expired OAuth session");
      }
      if (oauthState.expiresAt && new Date(oauthState.expiresAt) < new Date()) {
        await storage.deleteOAuthState(state);
        return failRedirect("OAuth session expired — try connecting again");
      }

      const { access_token } = await exchangeShopifyOAuthCode(shop, code);
      const { webhooks } = await completeShopifyOAuthConnection({
        userId: oauthState.userId,
        organizationId: oauthState.organizationId || undefined,
        shop,
        accessToken: access_token,
        panelBaseUrl: BASE_URL,
      });

      await storage.deleteOAuthState(state);

      const webhookParams = new URLSearchParams({
        shopify: "connected",
        webhooks: String(webhooks.registered.length),
      });
      if (webhooks.errors.length > 0) {
        webhookParams.set("webhook_errors", webhooks.errors.slice(0, 3).join(" | "));
      }
      if (webhooks.skipped) {
        webhookParams.set("webhooks_skipped", "1");
      }
      res.redirect(`${BASE_URL}/integrations?${webhookParams.toString()}`);
    } catch (error: unknown) {
      console.error("Shopify OAuth callback error:", error);
      failRedirect(error instanceof Error ? error.message : "Shopify connection failed");
    }
  });

  app.post(
    "/api/integrations/shopify/register-webhooks",
    isAuthenticated,
    resolveOrganizationContext,
    async (req: any, res) => {
      try {
        const userId = getUserId(req);
        const organizationId = req.context?.organizationId as string | undefined;
        const integration = await storage.getIntegrationByName("shopify", userId, organizationId);

        if (!integration || integration.status !== "connected") {
          return res.status(404).json({ message: "Shopify integration not connected" });
        }

        const credentials = integration.credentials as Record<string, string> | null;
        const config = (integration.config || {}) as Record<string, unknown>;
        const shopDomain = (config.shop_domain as string) || credentials?.shop_domain;
        const accessToken = credentials?.access_token;

        if (!shopDomain || !accessToken) {
          return res.status(400).json({ message: "Shopify shop domain or access token missing" });
        }

        const webhooks = await registerShopifyWebhooksForIntegration({
          integrationId: integration.id,
          shopDomain,
          accessToken,
          panelBaseUrl: BASE_URL,
        });

        await storage.updateIntegration(integration.id, userId, {
          config: {
            ...config,
            webhooksRegistered: webhooks.registered,
            webhooksErrors: webhooks.errors,
            webhooksRegisteredAt: new Date().toISOString(),
            webhooksSkipped: webhooks.skipped || false,
            webhooksSkipReason: webhooks.skipReason || null,
          },
        });

        let remoteWebhooks: Array<{ id: number; topic: string; address: string }> = [];
        try {
          remoteWebhooks = await listShopifyRemoteWebhooks({ shopDomain, accessToken });
        } catch {
          /* verification optional */
        }

        res.json({
          registered: webhooks.registered,
          registeredCount: webhooks.registered.length,
          errors: webhooks.errors,
          skipped: webhooks.skipped || false,
          skipReason: webhooks.skipReason,
          remoteCount: remoteWebhooks.length,
          remoteWebhooks,
        });
      } catch (error: unknown) {
        console.error("Shopify register-webhooks error:", error);
        res.status(500).json({
          message: error instanceof Error ? error.message : "Failed to register Shopify webhooks",
        });
      }
    },
  );

  app.get(
    "/api/integrations/shopify/webhook-status",
    isAuthenticated,
    resolveOrganizationContext,
    async (req: any, res) => {
      try {
        const userId = getUserId(req);
        const organizationId = req.context?.organizationId as string | undefined;
        const integration = await storage.getIntegrationByName("shopify", userId, organizationId);

        if (!integration || integration.status !== "connected") {
          return res.status(404).json({ message: "Shopify integration not connected" });
        }

        const credentials = integration.credentials as Record<string, string> | null;
        const config = (integration.config || {}) as Record<string, unknown>;
        const shopDomain = (config.shop_domain as string) || credentials?.shop_domain;
        const accessToken = credentials?.access_token;

        if (!shopDomain || !accessToken) {
          return res.status(400).json({ message: "Shopify shop domain or access token missing" });
        }

        const webhookUrl = `${BASE_URL}/api/webhooks/shopify/${integration.id}`;
        let remoteWebhooks: Array<{ id: number; topic: string; address: string }> = [];
        let remoteError: string | null = null;

        try {
          remoteWebhooks = await listShopifyRemoteWebhooks({ shopDomain, accessToken });
        } catch (e: unknown) {
          remoteError = e instanceof Error ? e.message : String(e);
        }

        res.json({
          webhookUrl,
          baseUrl: BASE_URL,
          storedRegistered: (config.webhooksRegistered as string[] | undefined) || [],
          storedErrors: (config.webhooksErrors as string[] | undefined) || [],
          remoteWebhooks,
          remoteCount: remoteWebhooks.length,
          remoteError,
          note:
            "App webhooks registered via OAuth/API do not appear under Shopify Admin → Settings → Notifications. They are tied to your DigitalEBuzz Commerce app. View them in Dev Dashboard → your app → Monitoring, or verify here.",
        });
      } catch (error: unknown) {
        console.error("Shopify webhook-status error:", error);
        res.status(500).json({
          message: error instanceof Error ? error.message : "Failed to load Shopify webhook status",
        });
      }
    },
  );

  app.post("/api/integrations/shopify/verify-credentials", isAuthenticated, async (req: any, res) => {
    try {
      const shopDomain = normalizeShopifyDomain(String(req.body?.shopDomain || ""));
      const accessToken = String(req.body?.accessToken || "").trim();

      if (!shopDomain || !accessToken) {
        return res.status(400).json({ valid: false, message: "Shop domain and access token are required" });
      }

      const ordersResponse = await fetch(
        `https://${shopDomain}.myshopify.com/admin/api/2024-01/shop.json`,
        {
          headers: { "X-Shopify-Access-Token": accessToken },
        },
      );

      if (!ordersResponse.ok) {
        const message =
          ordersResponse.status === 401
            ? "Invalid access token or shop domain."
            : "Could not verify Shopify credentials. Check domain and token permissions.";
        return res.status(ordersResponse.status).json({ valid: false, message });
      }

      const payload = await ordersResponse.json();
      res.json({
        valid: true,
        message: "Credentials verified",
        shopName: payload?.shop?.name || shopDomain,
      });
    } catch (error: any) {
      console.error("Shopify verify error:", error);
      res.status(500).json({ valid: false, message: error.message || "Verification failed" });
    }
  });

  // Get Shopify orders
  app.get("/api/integrations/shopify/orders", isAuthenticated, resolveOrganizationContext, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      const integration = await storage.getIntegrationByName("shopify", userId, organizationId);

      if (!integration || integration.status !== "connected" || !integration.credentials) {
        return res.status(404).json({ message: "Shopify integration not found or not connected" });
      }

      const credentials = integration.credentials as any;
      const config = integration.config || {};
      const shopDomain = config.shop_domain || credentials.shop_domain;
      const accessToken = credentials.access_token;

      if (!shopDomain || !accessToken) {
        return res.status(400).json({ message: "Shopify shop domain or access token not configured" });
      }

      const ordersResponse = await fetch(`https://${shopDomain}.myshopify.com/admin/api/2024-01/orders.json`, {
        headers: {
          "X-Shopify-Access-Token": accessToken,
        },
      });

      if (!ordersResponse.ok) {
        throw new Error("Failed to fetch Shopify orders");
      }

      const orders = await ordersResponse.json();
      res.json(orders);
    } catch (error: any) {
      console.error("Shopify orders error:", error);
      res.status(500).json({ message: error.message || "Failed to fetch Shopify orders" });
    }
  });

  // Shopify webhook handler – configure in Shopify Admin: Settings > Notifications > Webhooks
  // Use URL: https://your-panel.com/api/webhooks/shopify/:integrationId (get integrationId from Integrations page)
  app.post("/api/webhooks/shopify/:integrationId", async (req: any, res) => {
    try {
      const { integrationId } = req.params;
      const topic = req.headers["x-shopify-topic"] as string;
      const shopifyWebhookId = req.headers["x-shopify-webhook-id"] as string | undefined;
      const body = req.body || {};

      const integration = await storage.getIntegrationById(integrationId);
      if (!integration || integration.name !== "shopify") {
        return res.status(404).json({ message: "Integration not found" });
      }
      const userId = integration.userId;
      const orderId = body?.id ?? body?.order_id ?? null;

      // ACK immediately so Shopify does not retry (retries caused duplicate WhatsApp messages).
      res.status(200).json({ received: true });

      if (
        !shouldProcessShopifyWebhookDelivery({
          shopifyWebhookId,
          organizationId: integration.organizationId,
          integrationId: integration.id,
          topic,
          orderId,
        })
      ) {
        return;
      }

      void (async () => {
        try {
          if (topic === "orders/create") {
            await triggerWebhooks(userId, "shopify.order_created", { order: body, topic });
          } else if (topic === "orders/updated") {
            await triggerWebhooks(userId, "shopify.order_updated", { order: body, topic });
          } else if (topic === "customers/create") {
            await triggerWebhooks(userId, "shopify.customer_created", { customer: body, topic });
          }

          const canvasTriggerId = topic ? shopifyTopicToCanvasTrigger(topic) : null;
          if (canvasTriggerId && process.env.AUTOMATION_FLOWS_ENABLED !== "false") {
            await dispatchOrgFlowsForCanvasTrigger({
              canvasTriggerId,
              organizationId: integration.organizationId,
              ownerUserId: userId,
              body: body as Record<string, unknown>,
              topic,
              integrationConnectionId: integration.id,
            });
          }

          if (topic) {
            enqueueCatalogSyncFromStoreWebhook({
              organizationId: integration.organizationId,
              ownerUserId: userId,
              source: "shopify",
              topic,
              body: body as Record<string, unknown>,
            });
          }
        } catch (e: unknown) {
          console.error("[Shopify webhook] async processing error:", e);
        }
      })();
    } catch (error: any) {
      console.error("Shopify webhook error:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Webhook processing failed" });
      }
    }
  });
}

