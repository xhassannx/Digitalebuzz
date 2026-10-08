import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { isAuthenticated } from "../replitAuth";
import { resolveOrganizationContext } from "../middleware/organization-context";
import { requirePermission } from "../middleware/organization-context";
import { businessAPIManager } from "../whatsapp/business-api-client";
import {
  fetchMetaCatalogProductsResult,
  isMetaCatalogGraphBlockedError,
  isSmbBusinessTypeError,
  META_CATALOG_WRITE_BLOCKED_MESSAGE,
  listOwnedProductCatalogs,
  resolveCommerceCatalogProductCount,
  resolveWabaIdFromPhoneNumber,
  verifyMetaCatalogAccess,
  resolveCatalogRetailerIdForSend,
  formatCatalogProductSendError,
  runWhatsAppCommerceDiagnostics,
} from "./meta-graph";
import { checkUsageLimits, incrementUsage } from "../middleware/usage-limits";
import {
  resolveOfficialCredentialsForSession,
  ensureOfficialSessionReadyForSend,
  type OfficialSessionCreds,
} from "./session-credentials";
import {
  runShopifyCatalogSyncForOrg,
  runWooCatalogSyncForOrg,
} from "./catalog-sync-service";
import { exportShopifyProductsToMetaCatalogCsv } from "./shopify-catalog-csv";
import {
  getCollectionCatalogSendPayload,
  listShopifyCollections,
  syncCollectionProductsToMetaCatalog,
  syncShopifyCollectionToMetaProductSet,
} from "./shopify-collections";
import { sendWhatsAppNativePaymentMessage } from "./whatsapp-native-payment";
import { resolveCatalogWriteAccessToken } from "./catalog-access-token";
import { runShopifyAutomationsSetup } from "./eyewear-setup";

function getUserId(req: { user?: { claims?: { sub?: string }; userId?: string } }): string {
  return req.user?.claims?.sub || req.user?.userId || "";
}

export function registerCommerceRoutes(app: Express) {
  const withAuth = [isAuthenticated, resolveOrganizationContext] as const;

  app.get(
    "/api/commerce/settings",
    ...withAuth,
    requirePermission("integrations.view"),
    async (req: any, res) => {
      try {
        const organizationId = req.context?.organizationId;
        if (!organizationId) {
          return res.status(400).json({ message: "Organization context required" });
        }
        const settings = await storage.getOrganizationCommerceSettings(organizationId);
        const orgIntegrations = await storage.getIntegrationsByOrganization(organizationId);
        const shopify = orgIntegrations.find(
          (i) => i.name === "shopify" && i.status === "connected"
        );
        const woo = orgIntegrations.find(
          (i) => i.name === "woocommerce" && i.status === "connected"
        );

        res.json({
          metaCatalogId: settings?.metaCatalogId || null,
          metaCatalogName: settings?.metaCatalogName || null,
          shopifySyncEnabled: settings?.shopifySyncEnabled ?? false,
          woocommerceSyncEnabled: settings?.woocommerceSyncEnabled ?? false,
          shopifyLastSyncAt: settings?.shopifyLastSyncAt || null,
          woocommerceLastSyncAt: settings?.woocommerceLastSyncAt || null,
          shopifyLastSyncStatus: settings?.shopifyLastSyncStatus || null,
          woocommerceLastSyncStatus: settings?.woocommerceLastSyncStatus || null,
          shopifyLastSyncError: settings?.shopifyLastSyncError || null,
          woocommerceLastSyncError: settings?.woocommerceLastSyncError || null,
          shopifyCheckoutEnabled: settings?.shopifyCheckoutEnabled ?? false,
          woocommerceCheckoutEnabled: settings?.woocommerceCheckoutEnabled ?? false,
          lastCartCheckoutAt: settings?.lastCartCheckoutAt || null,
          lastCartCheckoutStatus: settings?.lastCartCheckoutStatus || null,
          lastCartCheckoutError: settings?.lastCartCheckoutError || null,
          shopifyConnected: !!shopify,
          woocommerceConnected: !!woo,
          whatsappNativePayEnabled: settings?.whatsappNativePayEnabled ?? false,
          metaPaymentConfigurationName: settings?.metaPaymentConfigurationName || null,
          metaPaymentGateway: settings?.metaPaymentGateway || "razorpay",
          shopifyCollectionProductSets: settings?.shopifyCollectionProductSets || {},
        });
      } catch (e: unknown) {
        res.status(500).json({
          message: e instanceof Error ? e.message : "Failed to load commerce settings",
        });
      }
    }
  );

  app.get(
    "/api/commerce/diagnostics",
    ...withAuth,
    requirePermission("integrations.view"),
    async (req: any, res) => {
      try {
        const organizationId = req.context?.organizationId;
        const userId = getUserId(req);
        const sessionId = String(req.query.sessionId || "").trim();
        if (!organizationId) {
          return res.status(400).json({ message: "Organization context required" });
        }
        if (!sessionId) {
          return res.status(400).json({ message: "sessionId query is required" });
        }
        const creds = await resolveOfficialCredentialsForSession(
          sessionId,
          userId,
          organizationId
        );
        if (!creds?.accessToken || !creds.phoneNumberId) {
          return res.status(400).json({
            message: "Could not load WhatsApp credentials for this session.",
          });
        }
        const wabaId = await resolveCommerceWabaId(creds, sessionId);
        if (!wabaId) {
          return res.status(400).json({ message: "No WABA id for this session." });
        }
        const settings = await storage.getOrganizationCommerceSettings(organizationId);
        const diagnostics = await runWhatsAppCommerceDiagnostics(creds.accessToken, {
          phoneNumberId: creds.phoneNumberId,
          wabaId,
          configuredCatalogId: settings?.metaCatalogId || undefined,
        });
        res.json(diagnostics);
      } catch (e: unknown) {
        res.status(500).json({
          message: e instanceof Error ? e.message : "Diagnostics failed",
        });
      }
    }
  );

  app.post(
    "/api/commerce/enable-catalog-visible",
    ...withAuth,
    requirePermission("integrations.view"),
    async (req: any, res) => {
      try {
        const organizationId = req.context?.organizationId;
        const userId = getUserId(req);
        const sessionId = String(req.body?.sessionId || "").trim();
        if (!sessionId) {
          return res.status(400).json({ message: "sessionId required" });
        }
        const creds = await resolveOfficialCredentialsForSession(
          sessionId,
          userId,
          organizationId
        );
        if (!creds?.accessToken || !creds.phoneNumberId) {
          return res.status(400).json({ message: "Could not load WhatsApp credentials." });
        }
        const url = new URL(
          `https://graph.facebook.com/v23.0/${creds.phoneNumberId}/whatsapp_commerce_settings`
        );
        url.searchParams.set("is_catalog_visible", "true");
        url.searchParams.set("access_token", creds.accessToken);
        const graphRes = await fetch(url.toString(), { method: "POST" });
        const data = (await graphRes.json()) as Record<string, unknown>;
        if (!graphRes.ok) {
          return res.status(400).json({
            message:
              (data as { error?: { message?: string } }).error?.message ||
              "Failed to enable catalog visibility",
          });
        }
        res.json({ success: true });
      } catch (e: unknown) {
        res.status(500).json({
          message: e instanceof Error ? e.message : "Failed to enable catalog",
        });
      }
    }
  );

  app.get(
    "/api/commerce/meta-catalogs",
    ...withAuth,
    requirePermission("integrations.view"),
    async (req: any, res) => {
      try {
        const organizationId = req.context?.organizationId;
        const userId = getUserId(req);
        const sessionId = String(req.query.sessionId || "").trim();
        if (!organizationId) {
          return res.status(400).json({ message: "Organization context required" });
        }
        if (!sessionId) {
          return res.status(400).json({ message: "sessionId query is required" });
        }
        const creds = await resolveOfficialCredentialsForSession(
          sessionId,
          userId,
          organizationId
        );
        if (!creds?.accessToken) {
          return res.status(400).json({
            message:
              "Could not load WhatsApp Business credentials for this session. Reconnect the number in Integrations.",
          });
        }
        const wabaId = await resolveCommerceWabaId(creds, sessionId);
        if (!wabaId) {
          return res.status(400).json({
            message:
              "No WhatsApp Business Account (WABA) id for this session. Reconnect WhatsApp Business API for this number.",
          });
        }
        const { catalogs, error, smbAccount } = await listOwnedProductCatalogs(
          creds.accessToken,
          wabaId
        );
        if (error && catalogs.length === 0) {
          return res.json({
            catalogs: [],
            wabaId,
            smbAccount: !!smbAccount,
            message: error,
            commerceNote: error,
          });
        }
        res.json({ catalogs, wabaId, smbAccount: !!smbAccount });
      } catch (e: unknown) {
        res.status(500).json({
          message: e instanceof Error ? e.message : "Failed to list Meta catalogs",
        });
      }
    }
  );

  app.put(
    "/api/commerce/settings",
    ...withAuth,
    requirePermission("integrations.view"),
    async (req: any, res) => {
      try {
        const organizationId = req.context?.organizationId;
        if (!organizationId) {
          return res.status(400).json({ message: "Organization context required" });
        }

        const body = z
          .object({
            metaCatalogId: z.string().optional(),
            metaCatalogName: z.string().optional(),
            shopifySyncEnabled: z.boolean().optional(),
            woocommerceSyncEnabled: z.boolean().optional(),
            shopifyCheckoutEnabled: z.boolean().optional(),
            woocommerceCheckoutEnabled: z.boolean().optional(),
            whatsappNativePayEnabled: z.boolean().optional(),
            metaPaymentConfigurationName: z.string().optional(),
            metaPaymentGateway: z.enum(["razorpay", "payu"]).optional(),
          })
          .parse(req.body);

        const userId = getUserId(req);
        let metaCatalogName = body.metaCatalogName;
        let commerceVerificationNote: string | null = null;

        if (body.metaCatalogId?.trim()) {
          const sessionId = String(req.body.sessionId || "").trim();
          const creds = sessionId
            ? await resolveOfficialCredentialsForSession(sessionId, userId, organizationId)
            : null;
          const token = creds?.accessToken
            ? creds.accessToken
            : sessionId
              ? null
              : await resolveAnyOrgWhatsAppToken(userId, organizationId);
          if (!token) {
            return res.status(400).json({
              message: sessionId
                ? "Could not load API credentials for the selected WhatsApp session. Reconnect that number in Integrations, then save again."
                : "Connect WhatsApp Business API first, then save catalog ID (token needed to verify catalog).",
            });
          }
          const wabaId = creds
            ? await resolveCommerceWabaId(creds, sessionId)
            : undefined;
          const verify = await verifyMetaCatalogAccess(
            token,
            body.metaCatalogId.trim(),
            { wabaId: wabaId || undefined }
          );
          if (!verify.valid) {
            return res.status(400).json({ message: verify.message || "Invalid catalog" });
          }
          metaCatalogName = metaCatalogName || verify.name;
          commerceVerificationNote = verify.message || null;
        }

        const saved = await storage.upsertOrganizationCommerceSettings(organizationId, {
          ...(body.metaCatalogId !== undefined
            ? { metaCatalogId: body.metaCatalogId.trim() || null }
            : {}),
          ...(metaCatalogName !== undefined ? { metaCatalogName: metaCatalogName || null } : {}),
          ...(body.shopifySyncEnabled !== undefined
            ? { shopifySyncEnabled: body.shopifySyncEnabled }
            : {}),
          ...(body.woocommerceSyncEnabled !== undefined
            ? { woocommerceSyncEnabled: body.woocommerceSyncEnabled }
            : {}),
          ...(body.shopifyCheckoutEnabled !== undefined
            ? { shopifyCheckoutEnabled: body.shopifyCheckoutEnabled }
            : {}),
          ...(body.woocommerceCheckoutEnabled !== undefined
            ? { woocommerceCheckoutEnabled: body.woocommerceCheckoutEnabled }
            : {}),
          ...(body.whatsappNativePayEnabled !== undefined
            ? { whatsappNativePayEnabled: body.whatsappNativePayEnabled }
            : {}),
          ...(body.metaPaymentConfigurationName !== undefined
            ? {
                metaPaymentConfigurationName:
                  body.metaPaymentConfigurationName.trim() || null,
              }
            : {}),
          ...(body.metaPaymentGateway !== undefined
            ? { metaPaymentGateway: body.metaPaymentGateway }
            : {}),
        });

        res.json({
          ...saved,
          commerceVerificationNote,
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to save commerce settings";
        res.status(500).json({
          message: isSmbBusinessTypeError(msg)
            ? "WhatsApp SMB account: paste your Catalog ID from Commerce Manager and save again. Link the catalog to WhatsApp in Meta Business Suite if you have not already."
            : msg,
        });
      }
    }
  );

  app.get(
    "/api/commerce/catalog/products",
    ...withAuth,
    requirePermission("inbox.view"),
    async (req: any, res) => {
      try {
        const organizationId = req.context?.organizationId;
        const userId = getUserId(req);
        const sessionId = String(req.query.sessionId || "");
        const search = String(req.query.search || "");
        const limit = Number(req.query.limit || 30);

        if (!organizationId || !sessionId) {
          return res.status(400).json({ message: "sessionId required" });
        }

        const settings = await storage.getOrganizationCommerceSettings(organizationId);
        const catalogId = String(req.query.catalogId || settings?.metaCatalogId || "");
        if (!catalogId) {
          return res.status(400).json({
            message: "Set Meta Catalog ID in Commerce settings first",
          });
        }

        const creds = await resolveOfficialCredentialsForSession(sessionId, userId, organizationId);
        if (!creds?.accessToken) {
          return res.status(400).json({ message: "WhatsApp Business session not ready" });
        }

        const wabaId = await resolveCommerceWabaId(creds, sessionId);
        const fetchOpts = {
          limit: Math.min(Math.max(limit, 1), 100),
          search: search || undefined,
          wabaId: wabaId || undefined,
        };
        let result = await fetchMetaCatalogProductsResult(creds.accessToken, catalogId, fetchOpts);

        // SMB WABA checks return empty + warning before catalog /products is tried — retry direct catalog read.
        if (result.products.length === 0) {
          const catalogToken = resolveCatalogWriteAccessToken(creds.accessToken);
          const direct = await fetchMetaCatalogProductsResult(catalogToken, catalogId, {
            ...fetchOpts,
            wabaId: undefined,
          });
          if (direct.products.length > 0) {
            result = {
              ...direct,
              warning:
                direct.warning ||
                "Products loaded from Meta catalog (WhatsApp SMB accounts may not list via WABA token).",
            };
          }
        }

        if (result.products.length === 0 && result.error && !result.warning) {
          return res.status(400).json({
            message: result.error,
            catalogId,
            products: [],
          });
        }

        res.json({
          catalogId,
          products: result.products,
          warning: result.warning,
          commerceNote: result.warning,
          verificationMode: result.verificationMode,
        });
      } catch (e: unknown) {
        res.status(500).json({
          message: e instanceof Error ? e.message : "Failed to load products",
        });
      }
    }
  );

  app.post(
    "/api/commerce/sync/shopify",
    ...withAuth,
    requirePermission("integrations.view"),
    async (req: any, res) => {
      try {
        const organizationId = req.context?.organizationId;
        const userId = getUserId(req);
        const sessionId = String(req.body?.sessionId || "");
        if (!organizationId) {
          return res.status(400).json({ message: "Organization context required" });
        }

        const settings = await storage.getOrganizationCommerceSettings(organizationId);
        const catalogId = settings?.metaCatalogId;
        if (!catalogId) {
          return res.status(400).json({ message: "Configure Meta Catalog ID in Commerce settings" });
        }

        const creds = sessionId
          ? await resolveOfficialCredentialsForSession(sessionId, userId, organizationId)
          : await resolveAnyOrgWhatsAppToken(userId, organizationId).then((t) =>
              t ? { accessToken: t, phoneNumberId: "" } : null
            );

        if (!creds?.accessToken) {
          return res.status(400).json({ message: "WhatsApp Business token required for catalog sync" });
        }

        const wabaId = sessionId
          ? await resolveCommerceWabaId(creds, sessionId)
          : null;
        const result = await runShopifyCatalogSyncForOrg({
          organizationId,
          accessToken: creds.accessToken,
          limit: Number(req.body?.limit) || 100,
          wabaId: wabaId || undefined,
        });

        await storage.upsertOrganizationCommerceSettings(organizationId, {
          shopifySyncEnabled: true,
        });

        res.json(result);
      } catch (e: unknown) {
        const organizationId = req.context?.organizationId;
        if (organizationId) {
          await storage.upsertOrganizationCommerceSettings(organizationId, {
            shopifyLastSyncAt: new Date(),
            shopifyLastSyncStatus: "error",
            shopifyLastSyncError: e instanceof Error ? e.message : "Sync failed",
          });
        }
        const msg = e instanceof Error ? e.message : "Shopify catalog sync failed";
        const metaBlocked = isMetaCatalogGraphBlockedError(msg);
        res.status(metaBlocked ? 403 : 500).json({
          message: metaBlocked ? META_CATALOG_WRITE_BLOCKED_MESSAGE : msg,
          synced: 0,
        });
      }
    }
  );

  app.get(
    "/api/commerce/sync/shopify/csv",
    ...withAuth,
    requirePermission("integrations.view"),
    async (req: any, res) => {
      try {
        const organizationId = req.context?.organizationId;
        if (!organizationId) {
          return res.status(400).json({ message: "Organization context required" });
        }

        const limit = Math.min(Math.max(Number(req.query.limit) || 500, 1), 500);
        const result = await exportShopifyProductsToMetaCatalogCsv({ organizationId, limit });
        const filename = `whatsapp-catalog-${result.shopDomain}-${new Date().toISOString().slice(0, 10)}.csv`;
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.send(result.csv);
      } catch (e: unknown) {
        res.status(500).json({
          message: e instanceof Error ? e.message : "Failed to export Shopify catalog CSV",
        });
      }
    }
  );

  app.post(
    "/api/commerce/sync/woocommerce",
    ...withAuth,
    requirePermission("integrations.view"),
    async (req: any, res) => {
      try {
        const organizationId = req.context?.organizationId;
        const userId = getUserId(req);
        const sessionId = String(req.body?.sessionId || "");
        if (!organizationId) {
          return res.status(400).json({ message: "Organization context required" });
        }

        const settings = await storage.getOrganizationCommerceSettings(organizationId);
        const catalogId = settings?.metaCatalogId;
        if (!catalogId) {
          return res.status(400).json({ message: "Configure Meta Catalog ID in Commerce settings" });
        }

        const creds = sessionId
          ? await resolveOfficialCredentialsForSession(sessionId, userId, organizationId)
          : await resolveAnyOrgWhatsAppToken(userId, organizationId).then((t) =>
              t ? { accessToken: t, phoneNumberId: "" } : null
            );

        if (!creds?.accessToken) {
          return res.status(400).json({ message: "WhatsApp Business token required for catalog sync" });
        }

        const wabaId = sessionId
          ? await resolveCommerceWabaId(creds, sessionId)
          : null;
        const result = await runWooCatalogSyncForOrg({
          organizationId,
          accessToken: creds.accessToken,
          limit: Number(req.body?.limit) || 100,
          wabaId: wabaId || undefined,
        });

        await storage.upsertOrganizationCommerceSettings(organizationId, {
          woocommerceSyncEnabled: true,
        });

        res.json(result);
      } catch (e: unknown) {
        const organizationId = req.context?.organizationId;
        if (organizationId) {
          await storage.upsertOrganizationCommerceSettings(organizationId, {
            woocommerceLastSyncAt: new Date(),
            woocommerceLastSyncStatus: "error",
            woocommerceLastSyncError: e instanceof Error ? e.message : "Sync failed",
          });
        }
        const msg = e instanceof Error ? e.message : "WooCommerce catalog sync failed";
        const metaBlocked = isMetaCatalogGraphBlockedError(msg);
        res.status(metaBlocked ? 403 : 500).json({
          message: metaBlocked ? META_CATALOG_WRITE_BLOCKED_MESSAGE : msg,
          synced: 0,
        });
      }
    }
  );

  const sendProductSchema = z.object({
    sessionId: z.string(),
    to: z.string(),
    catalogId: z.string().optional(),
    productRetailerId: z.string().optional(),
    body: z.string().optional(),
    footer: z.string().optional(),
    headerText: z.string().optional(),
    products: z
      .array(
        z.object({
          productRetailerId: z.string(),
        })
      )
      .optional(),
    sectionTitle: z.string().optional(),
  });

  app.post(
    "/api/messages/send-catalog-product",
    ...withAuth,
    requirePermission("inbox.send"),
    checkUsageLimits('message'),
    incrementUsage('message'),
    async (req: any, res) => {
      try {
        const userId = getUserId(req);
        const organizationId = req.context?.organizationId;
        const data = sendProductSchema.parse(req.body);

        const session = await storage.getSession(data.sessionId);
        if (!session || session.connectionType !== "official") {
          return res.status(400).json({
            message: "Catalog messages require an official WhatsApp Business API session",
          });
        }

        const settings = organizationId
          ? await storage.getOrganizationCommerceSettings(organizationId)
          : undefined;
        const catalogId = (data.catalogId || settings?.metaCatalogId || "").trim();
        if (!catalogId) {
          return res.status(400).json({
            message: "Meta Catalog ID not configured. Open Commerce settings and add your catalog ID.",
          });
        }

        const creds = await resolveOfficialCredentialsForSession(
          data.sessionId,
          userId,
          organizationId
        );
        if (!creds?.accessToken) {
          return res.status(400).json({
            message: "Could not load WhatsApp API credentials for this session. Reconnect in Integrations.",
          });
        }

        if (!businessAPIManager.isClientReady(data.sessionId)) {
          await businessAPIManager.restoreSession(data.sessionId, {
            phoneNumberId: creds.phoneNumberId,
            accessToken: creds.accessToken,
            businessAccountId: creds.businessAccountId,
          });
        }

        const wabaId = await resolveCommerceWabaId(creds, data.sessionId);
        const catalogVerify = await verifyMetaCatalogAccess(creds.accessToken, catalogId, {
          wabaId: wabaId || undefined,
        });
        if (!catalogVerify.valid && catalogVerify.message) {
          return res.status(400).json({ message: catalogVerify.message });
        }

        let result;
        const productItems = data.products?.filter((p) => p.productRetailerId?.trim()) || [];

        if (productItems.length > 1) {
          result = await businessAPIManager.sendProductListMessage(data.sessionId, data.to, {
            catalogId,
            body: data.body || "Browse our products",
            footer: data.footer,
            headerText: data.headerText,
            sections: [
              {
                title: (data.sectionTitle || "Products").slice(0, 24),
                productRetailerIds: productItems.map((p) => p.productRetailerId).slice(0, 30),
              },
            ],
          });
        } else {
          const retailerGuess = (
            data.productRetailerId ||
            productItems[0]?.productRetailerId ||
            ""
          ).trim();
          if (!retailerGuess) {
            return res.status(400).json({ message: "productRetailerId required" });
          }

          const resolved = await resolveCatalogRetailerIdForSend(
            creds.accessToken,
            catalogId,
            retailerGuess
          );
          const retailerId = resolved.retailerId;

          try {
            result = await businessAPIManager.sendProductMessage(data.sessionId, data.to, {
              catalogId,
              productRetailerId: retailerId,
              body: data.body,
              footer: data.footer,
            });
          } catch (sendErr: unknown) {
            const raw = sendErr instanceof Error ? sendErr.message : String(sendErr);
            return res.status(400).json({
              message: formatCatalogProductSendError(raw, {
                catalogId,
                retailerId,
                availableIds: resolved.availableIds,
                catalogVerifyMessage: catalogVerify.message,
              }),
              catalogId,
              productRetailerId: retailerId,
              productRetailerIdGuess: retailerGuess,
              resolvedFromCatalog: resolved.resolved,
            });
          }
        }

        res.json({
          success: true,
          messageId: result.id,
          catalogId,
        });
      } catch (e: unknown) {
        const raw = e instanceof Error ? e.message : "Failed to send catalog message";
        res.status(500).json({ message: raw });
      }
    }
  );

  app.get(
    "/api/commerce/analytics",
    ...withAuth,
    requirePermission("integrations.view"),
    async (req: any, res) => {
      try {
        const organizationId = req.context?.organizationId;
        const userId = getUserId(req);
        const sessionId = String(req.query.sessionId || "");
        if (!organizationId) {
          return res.status(400).json({ message: "Organization context required" });
        }

        const settings = await storage.getOrganizationCommerceSettings(organizationId);
        const orgIntegrations = await storage.getIntegrationsByOrganization(organizationId);

        let catalogProductCount: number | null = null;
        let commerceAnalyticsNote: string | null = null;
        const catalogId = settings?.metaCatalogId?.trim();
        if (catalogId && sessionId) {
          const creds = await resolveOfficialCredentialsForSession(
            sessionId,
            userId,
            organizationId
          );
          if (creds?.accessToken) {
            const wabaId = await resolveCommerceWabaId(creds, sessionId);
            const countResult = await resolveCommerceCatalogProductCount(
              creds.accessToken,
              catalogId,
              { wabaId: wabaId || undefined }
            );
            catalogProductCount = countResult.count;
            commerceAnalyticsNote = countResult.note?.trim() || null;
          }
        }

        res.json({
          metaCatalogId: settings?.metaCatalogId || null,
          metaCatalogName: settings?.metaCatalogName || null,
          catalogProductCount,
          commerceAnalyticsNote,
          shopifySyncEnabled: settings?.shopifySyncEnabled ?? false,
          woocommerceSyncEnabled: settings?.woocommerceSyncEnabled ?? false,
          shopifyCheckoutEnabled: settings?.shopifyCheckoutEnabled ?? false,
          woocommerceCheckoutEnabled: settings?.woocommerceCheckoutEnabled ?? false,
          shopifyLastSyncAt: settings?.shopifyLastSyncAt || null,
          woocommerceLastSyncAt: settings?.woocommerceLastSyncAt || null,
          shopifyLastSyncStatus: settings?.shopifyLastSyncStatus || null,
          woocommerceLastSyncStatus: settings?.woocommerceLastSyncStatus || null,
          lastCartCheckoutAt: settings?.lastCartCheckoutAt || null,
          lastCartCheckoutStatus: settings?.lastCartCheckoutStatus || null,
          lastCartCheckoutError: settings?.lastCartCheckoutError || null,
          shopifyConnected: orgIntegrations.some(
            (i) => i.name === "shopify" && i.status === "connected"
          ),
          woocommerceConnected: orgIntegrations.some(
            (i) => i.name === "woocommerce" && i.status === "connected"
          ),
        });
      } catch (e: unknown) {
        res.status(500).json({
          message: e instanceof Error ? e.message : "Failed to load commerce analytics",
        });
      }
    }
  );

  const catalogBroadcastSchema = z.object({
    sessionId: z.string(),
    recipients: z.array(z.string().min(5)).min(1).max(100),
    productRetailerIds: z.array(z.string().min(1)).min(1).max(30),
    body: z.string().max(1024).optional(),
    footer: z.string().max(60).optional(),
    sectionTitle: z.string().max(24).optional(),
  });

  app.post(
    "/api/commerce/broadcast-catalog",
    ...withAuth,
    requirePermission("manage_campaigns.send"),
    checkUsageLimits('message'),
    async (req: any, res) => {
      try {
        const organizationId = req.context?.organizationId;
        const userId = getUserId(req);
        const data = catalogBroadcastSchema.parse(req.body);

        if (!organizationId) {
          return res.status(400).json({ message: "Organization context required" });
        }

        const settings = await storage.getOrganizationCommerceSettings(organizationId);
        const catalogId = settings?.metaCatalogId?.trim();
        if (!catalogId) {
          return res.status(400).json({ message: "Configure Meta catalog ID first" });
        }

        const session = await storage.getSession(data.sessionId);
        if (!session || session.connectionType !== "official") {
          return res.status(400).json({ message: "Official WhatsApp session required" });
        }

        if (!businessAPIManager.isClientReady(data.sessionId)) {
          const creds = await resolveOfficialCredentialsForSession(
            data.sessionId,
            userId,
            organizationId
          );
          if (creds) {
            await businessAPIManager.restoreSession(data.sessionId, {
              phoneNumberId: creds.phoneNumberId,
              accessToken: creds.accessToken,
              businessAccountId: creds.businessAccountId,
            });
          }
        }

        const productIds = data.productRetailerIds.map((id) => id.trim()).filter(Boolean);
        let sent = 0;
        const errors: string[] = [];

        for (const rawTo of data.recipients) {
          const to = rawTo.replace(/\s/g, "");
          try {
            if (productIds.length === 1) {
              await businessAPIManager.sendProductMessage(data.sessionId, to, {
                catalogId,
                productRetailerId: productIds[0],
                body: data.body || "Browse our catalog",
                footer: data.footer,
              });
            } else {
              await businessAPIManager.sendProductListMessage(data.sessionId, to, {
                catalogId,
                body: data.body || "Browse our products",
                footer: data.footer,
                sections: [
                  {
                    title: (data.sectionTitle || "Products").slice(0, 24),
                    productRetailerIds: productIds,
                  },
                ],
              });
            }
            sent++;
            try {
              const effectiveUserId = (req as any).effectiveUserId ?? userId;
              const now = new Date();
              const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
              await storage.incrementMessagesSent(effectiveUserId, monthStr);
            } catch {
              /* non-blocking */
            }
            await new Promise((r) => setTimeout(r, 350));
          } catch (e: unknown) {
            errors.push(`${to}: ${e instanceof Error ? e.message : "send failed"}`);
          }
        }

        res.json({ sent, failed: data.recipients.length - sent, errors });
      } catch (e: unknown) {
        res.status(500).json({
          message: e instanceof Error ? e.message : "Catalog broadcast failed",
        });
      }
    }
  );

  app.get(
    "/api/commerce/shopify/collections",
    ...withAuth,
    requirePermission("integrations.view"),
    async (req: any, res) => {
      try {
        const organizationId = req.context?.organizationId;
        if (!organizationId) {
          return res.status(400).json({ message: "Organization context required" });
        }
        const collections = await listShopifyCollections(organizationId);
        const settings = await storage.getOrganizationCommerceSettings(organizationId);
        res.json({
          collections,
          productSets: settings?.shopifyCollectionProductSets || {},
        });
      } catch (e: unknown) {
        res.status(500).json({
          message: e instanceof Error ? e.message : "Failed to list collections",
        });
      }
    }
  );

  app.post(
    "/api/commerce/shopify/collections/sync",
    ...withAuth,
    requirePermission("integrations.view"),
    async (req: any, res) => {
      try {
        const organizationId = req.context?.organizationId;
        const userId = getUserId(req);
        const sessionId = String(req.body?.sessionId || "");
        const collectionId = String(req.body?.collectionId || "");
        const collectionTitle = String(req.body?.collectionTitle || "Collection");
        const syncMode = String(req.body?.mode || "catalog");

        if (!organizationId || !collectionId) {
          return res.status(400).json({ message: "collectionId required" });
        }

        const settings = await storage.getOrganizationCommerceSettings(organizationId);
        const catalogId = settings?.metaCatalogId?.trim();
        if (!catalogId) {
          return res.status(400).json({ message: "Configure Meta catalog ID first" });
        }

        const creds = sessionId
          ? await resolveOfficialCredentialsForSession(sessionId, userId, organizationId)
          : await resolveAnyOrgWhatsAppToken(userId, organizationId).then((t) =>
              t ? { accessToken: t, phoneNumberId: "" } : null
            );
        if (!creds?.accessToken) {
          return res.status(400).json({ message: "WhatsApp token required" });
        }

        if (syncMode === "product_set") {
          const { productSetId, productCount } = await syncShopifyCollectionToMetaProductSet({
            organizationId,
            catalogId,
            accessToken: creds.accessToken,
            collectionId,
            collectionTitle,
          });
          const map = { ...(settings?.shopifyCollectionProductSets || {}) };
          map[collectionId] = {
            productSetId,
            title: collectionTitle,
            syncedAt: new Date().toISOString(),
          };
          await storage.upsertOrganizationCommerceSettings(organizationId, {
            shopifyCollectionProductSets: map,
          });
          return res.json({ mode: "product_set", productSetId, productCount });
        }

        const { synced } = await syncCollectionProductsToMetaCatalog({
          organizationId,
          catalogId,
          accessToken: creds.accessToken,
          collectionId,
        });
        res.json({ mode: "catalog", synced });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Collection sync failed";
        const metaBlocked = isMetaCatalogGraphBlockedError(msg);
        const filterError = /Elastic Search rule/i.test(msg);
        const status = metaBlocked ? 403 : filterError ? 400 : 500;
        res.status(status).json({
          message: metaBlocked ? META_CATALOG_WRITE_BLOCKED_MESSAGE : msg,
          synced: 0,
        });
      }
    }
  );

  app.post(
    "/api/commerce/shopify/collections/send",
    ...withAuth,
    requirePermission("inbox.send"),
    async (req: any, res) => {
      try {
        const organizationId = req.context?.organizationId;
        const userId = getUserId(req);
        const data = z
          .object({
            sessionId: z.string(),
            to: z.string(),
            collectionId: z.string(),
            body: z.string().optional(),
            sectionTitle: z.string().optional(),
          })
          .parse(req.body);

        if (!organizationId) {
          return res.status(400).json({ message: "Organization context required" });
        }

        const settings = await storage.getOrganizationCommerceSettings(organizationId);
        const catalogId = settings?.metaCatalogId?.trim();
        if (!catalogId) {
          return res.status(400).json({ message: "Configure Meta catalog ID first" });
        }

        const payload = await getCollectionCatalogSendPayload({
          organizationId,
          collectionId: data.collectionId,
          body: data.body,
          sectionTitle: data.sectionTitle,
        });

        if (!businessAPIManager.isClientReady(data.sessionId)) {
          const creds = await resolveOfficialCredentialsForSession(
            data.sessionId,
            userId,
            organizationId
          );
          if (creds) {
            await businessAPIManager.restoreSession(data.sessionId, {
              phoneNumberId: creds.phoneNumberId,
              accessToken: creds.accessToken,
              businessAccountId: creds.businessAccountId,
            });
          }
        }

        const result = await businessAPIManager.sendProductListMessage(data.sessionId, data.to, {
          catalogId,
          body: payload.body,
          sections: [
            {
              title: payload.sectionTitle,
              productRetailerIds: payload.productRetailerIds,
            },
          ],
        });

        res.json({ success: true, messageId: result.id, productCount: payload.productRetailerIds.length });
      } catch (e: unknown) {
        res.status(500).json({
          message: e instanceof Error ? e.message : "Failed to send collection",
        });
      }
    }
  );

  app.post(
    "/api/commerce/whatsapp-native-pay/send",
    ...withAuth,
    requirePermission("inbox.send"),
    async (req: any, res) => {
      try {
        const organizationId = req.context?.organizationId;
        const data = z
          .object({
            sessionId: z.string(),
            to: z.string(),
            referenceId: z.string().optional(),
            bodyText: z.string().optional(),
            currency: z.string().default("INR"),
            amountMajor: z.number().positive(),
            itemName: z.string().optional(),
          })
          .parse(req.body);

        if (!organizationId) {
          return res.status(400).json({ message: "Organization context required" });
        }

        const settings = await storage.getOrganizationCommerceSettings(organizationId);
        if (!settings?.whatsappNativePayEnabled) {
          return res.status(400).json({ message: "Enable WhatsApp native pay in Commerce settings" });
        }
        const configName = settings.metaPaymentConfigurationName?.trim();
        if (!configName) {
          return res.status(400).json({
            message: "Set Meta payment configuration name (from Business Manager) in Commerce settings",
          });
        }

        const amountMinor = Math.round(data.amountMajor * 100);
        await ensureOfficialSessionReadyForSend(data.sessionId, getUserId(req), organizationId);
        const result = await sendWhatsAppNativePaymentMessage({
          sessionId: data.sessionId,
          to: data.to,
          referenceId: data.referenceId || `pay-${Date.now()}`,
          bodyText: data.bodyText || "Complete your payment",
          currency: data.currency,
          items: [
            {
              name: data.itemName || "Order payment",
              amountMinor,
              quantity: 1,
            },
          ],
          paymentConfigurationName: configName,
          paymentGateway:
            settings.metaPaymentGateway === "payu" ? "payu" : "razorpay",
        });

        res.json({ success: true, messageId: result.messageId });
      } catch (e: unknown) {
        res.status(500).json({
          message: e instanceof Error ? e.message : "Native payment send failed",
        });
      }
    }
  );

  app.post(
    "/api/commerce/shopify-automations-setup",
    ...withAuth,
    requirePermission("flows.create"),
    async (req: any, res) => {
      try {
        const userId = getUserId(req);
        const organizationId = req.context?.organizationId;
        if (!organizationId) {
          return res.status(400).json({ message: "Organization context required" });
        }
        const brandName =
          typeof req.body?.brandName === "string" ? req.body.brandName.trim() : undefined;
        const storeUrl =
          typeof req.body?.storeUrl === "string" ? req.body.storeUrl.trim() : undefined;
        const result = await runShopifyAutomationsSetup({
          userId,
          organizationId,
          brandName,
          storeUrl,
        });
        res.json(result);
      } catch (e: unknown) {
        res.status(400).json({
          message: e instanceof Error ? e.message : "Shopify automations setup failed",
        });
      }
    }
  );
}

/** WABA id for commerce Graph calls (fresh from phone number when possible). */
async function resolveCommerceWabaId(
  creds: OfficialSessionCreds,
  sessionId: string
): Promise<string | null> {
  const fromPhone = creds.phoneNumberId
    ? await resolveWabaIdFromPhoneNumber(creds.accessToken, creds.phoneNumberId)
    : null;
  if (fromPhone) return fromPhone;
  const session = await storage.getSession(sessionId);
  const fromSession =
    creds.businessAccountId ||
    (session?.deviceInfo?.wabaId as string | undefined) ||
    "";
  return fromSession ? String(fromSession) : null;
}

async function resolveAnyOrgWhatsAppToken(
  userId: string,
  organizationId: string
): Promise<string | null> {
  const integration = await storage.getIntegrationByName(
    "whatsapp-business",
    userId,
    organizationId
  );
  const token = (integration?.credentials as Record<string, string> | undefined)?.access_token;
  if (token) return token;
  const settings = await storage.getUserSettings(userId);
  return settings?.whatsappBusinessCredentials?.accessToken || null;
}
