import type { Express } from "express";
import { isAuthenticated } from "../../replitAuth";
import { storage } from "../../storage";
import { woocommerceTopicToCanvasTrigger } from "../../automation/webhook-context";
import { dispatchOrgFlowsForCanvasTrigger } from "../../automation/flow-webhook";
import { enqueueCatalogSyncFromStoreWebhook } from "../../commerce/catalog-sync-service";

function normalizeSiteUrl(raw: string): string {
  let s = raw.trim();
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) {
    s = `https://${s}`;
  }
  return s.replace(/\/$/, "");
}

export function registerWooCommerceRoutes(app: Express) {
  app.post("/api/integrations/woocommerce/verify-credentials", isAuthenticated, async (req: any, res) => {
    try {
      const siteUrl = normalizeSiteUrl(String(req.body?.siteUrl || ""));
      const consumerKey = String(req.body?.consumerKey || "").trim();
      const consumerSecret = String(req.body?.consumerSecret || "").trim();

      if (!siteUrl || !consumerKey || !consumerSecret) {
        return res.status(400).json({
          valid: false,
          message: "Store URL, consumer key, and consumer secret are required",
        });
      }

      const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
      const headers = { Authorization: `Basic ${auth}` };
      const productsResponse = await fetch(`${siteUrl}/wp-json/wc/v3/products?per_page=1`, { headers });
      if (productsResponse.ok) {
        return res.json({ valid: true, message: "Credentials verified" });
      }

      const verifyResponse = await fetch(`${siteUrl}/wp-json/wc/v3/system_status`, { headers });

      if (!verifyResponse.ok) {
        const message =
          verifyResponse.status === 401
            ? "Invalid consumer key or secret."
            : "Could not verify WooCommerce credentials. Check URL and REST API keys.";
        return res.status(verifyResponse.status).json({ valid: false, message });
      }

      res.json({ valid: true, message: "Credentials verified" });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("WooCommerce verify error:", msg);
      res.status(500).json({ valid: false, message: msg || "Verification failed" });
    }
  });

  /**
   * WooCommerce webhook — configure in WooCommerce → Settings → Advanced → Webhooks
   * URL: https://your-domain/api/webhooks/woocommerce/:integrationId
   */
  app.post("/api/webhooks/woocommerce/:integrationId", async (req: any, res) => {
    try {
      const { integrationId } = req.params;
      const topic =
        (req.headers["x-wc-webhook-topic"] as string) ||
        (req.headers["x-woocommerce-topic"] as string) ||
        "";
      let body: Record<string, unknown> = {};
      if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
        body = req.body as Record<string, unknown>;
      } else if (typeof req.body === "string" && req.body.trim()) {
        try {
          const parsed = JSON.parse(req.body);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            body = parsed as Record<string, unknown>;
          }
        } catch {
          body = {};
        }
      }

      const integration = await storage.getIntegrationById(integrationId);
      if (!integration || integration.name !== "woocommerce") {
        return res.status(404).json({ message: "Integration not found" });
      }

      const canvasTriggerId = topic ? woocommerceTopicToCanvasTrigger(topic) : null;
      if (canvasTriggerId && process.env.AUTOMATION_FLOWS_ENABLED !== "false") {
        try {
          await dispatchOrgFlowsForCanvasTrigger({
            canvasTriggerId,
            organizationId: integration.organizationId,
            ownerUserId: integration.userId,
            body,
            topic,
            integrationConnectionId: integration.id,
          });
        } catch (e: unknown) {
          console.error("[Automation] WooCommerce → canvas flows:", e);
        }
      }

      if (topic) {
        enqueueCatalogSyncFromStoreWebhook({
          organizationId: integration.organizationId,
          ownerUserId: integration.userId,
          source: "woocommerce",
          topic,
          body,
        });
      }

      res.status(200).json({ received: true, canvasTriggerId: canvasTriggerId || null });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("WooCommerce webhook error:", msg);
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });
}
