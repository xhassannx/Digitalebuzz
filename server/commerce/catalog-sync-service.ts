import { storage } from "../storage";
import { verifyMetaCatalogAccess } from "./meta-graph";
import {
  resolveCatalogWriteAccessToken,
} from "./catalog-access-token";
import {
  syncShopifyProductsToMetaCatalog,
  syncWooProductsToMetaCatalog,
  syncShopifyProductPayloadToMeta,
  syncWooProductPayloadToMeta,
  deleteMetaCatalogProduct,
} from "./shopify-catalog-sync";

const SHOPIFY_CATALOG_TOPICS = new Set([
  "products/create",
  "products/update",
  "products/delete",
]);

const WOO_CATALOG_TOPICS = new Set([
  "product.created",
  "product.updated",
  "product.deleted",
]);

/** Resolve Cloud API token for background / webhook catalog sync. */
export async function resolveWhatsAppAccessTokenForOrg(
  organizationId: string,
  ownerUserId?: string | null
): Promise<string | null> {
  if (ownerUserId) {
    const integration = await storage.getIntegrationByName(
      "whatsapp-business",
      ownerUserId,
      organizationId
    );
    const token = (integration?.credentials as Record<string, string> | undefined)?.access_token;
    if (token) return token;

    const settings = await storage.getUserSettings(ownerUserId);
    if (settings?.whatsappBusinessCredentials?.accessToken) {
      return settings.whatsappBusinessCredentials.accessToken;
    }
  }

  const sessions = await storage.getSessionsByOrganization(organizationId);
  for (const session of sessions) {
    if (session.connectionType !== "official" || session.status !== "connected") {
      continue;
    }
    const integration = await storage.getIntegrationByName(
      "whatsapp-business",
      session.userId,
      organizationId
    );
    const token = (integration?.credentials as Record<string, string> | undefined)?.access_token;
    if (token) return token;
  }

  return null;
}

export async function runShopifyCatalogSyncForOrg(opts: {
  organizationId: string;
  accessToken: string;
  limit?: number;
  wabaId?: string;
}): Promise<{ synced: number; errors: string[] }> {
  const settings = await storage.getOrganizationCommerceSettings(opts.organizationId);
  const catalogId = settings?.metaCatalogId?.trim();
  if (!catalogId) {
    throw new Error("Meta catalog ID not configured");
  }

  const result = await syncShopifyProductsToMetaCatalog({
    organizationId: opts.organizationId,
    catalogId,
    accessToken: opts.accessToken,
    limit: opts.limit ?? 100,
    wabaId: opts.wabaId,
  });

  await storage.upsertOrganizationCommerceSettings(opts.organizationId, {
    shopifyLastSyncAt: new Date(),
    shopifyLastSyncStatus: "success",
    shopifyLastSyncError: null,
  });

  return result;
}

export async function runWooCatalogSyncForOrg(opts: {
  organizationId: string;
  accessToken: string;
  limit?: number;
  wabaId?: string;
}): Promise<{ synced: number; errors: string[] }> {
  const settings = await storage.getOrganizationCommerceSettings(opts.organizationId);
  const catalogId = settings?.metaCatalogId?.trim();
  if (!catalogId) {
    throw new Error("Meta catalog ID not configured");
  }

  const result = await syncWooProductsToMetaCatalog({
    organizationId: opts.organizationId,
    catalogId,
    accessToken: opts.accessToken,
    limit: opts.limit ?? 100,
    wabaId: opts.wabaId,
  });

  await storage.upsertOrganizationCommerceSettings(opts.organizationId, {
    woocommerceLastSyncAt: new Date(),
    woocommerceLastSyncStatus: "success",
    woocommerceLastSyncError: null,
  });

  return result;
}

async function recordSyncError(
  organizationId: string,
  source: "shopify" | "woocommerce",
  message: string
) {
  const patch =
    source === "shopify"
      ? {
          shopifyLastSyncAt: new Date(),
          shopifyLastSyncStatus: "error" as const,
          shopifyLastSyncError: message,
        }
      : {
          woocommerceLastSyncAt: new Date(),
          woocommerceLastSyncStatus: "error" as const,
          woocommerceLastSyncError: message,
        };
  await storage.upsertOrganizationCommerceSettings(organizationId, patch);
}

/**
 * Called from Shopify / WooCommerce webhooks when auto-sync is enabled.
 * Fire-and-forget — errors are logged and stored on commerce settings.
 */
export function enqueueCatalogSyncFromStoreWebhook(opts: {
  organizationId: string | null | undefined;
  ownerUserId: string;
  source: "shopify" | "woocommerce";
  topic: string;
  body: Record<string, unknown>;
}): void {
  const orgId = opts.organizationId?.trim();
  if (!orgId) return;

  const topic = opts.topic.toLowerCase().trim();
  const topics = opts.source === "shopify" ? SHOPIFY_CATALOG_TOPICS : WOO_CATALOG_TOPICS;
  if (!topics.has(topic)) return;

  void (async () => {
    try {
      const settings = await storage.getOrganizationCommerceSettings(orgId);
      const catalogId = settings?.metaCatalogId?.trim();
      if (!catalogId) return;

      const syncOn =
        opts.source === "shopify"
          ? settings?.shopifySyncEnabled
          : settings?.woocommerceSyncEnabled;
      if (!syncOn) return;

      const accessToken = await resolveWhatsAppAccessTokenForOrg(orgId, opts.ownerUserId);
      if (!accessToken) {
        await recordSyncError(
          orgId,
          opts.source,
          "WhatsApp Business API token not found for catalog sync"
        );
        return;
      }

      const catalogWriteToken = resolveCatalogWriteAccessToken(accessToken);

      const verify = await verifyMetaCatalogAccess(catalogWriteToken, catalogId);
      if (!verify.valid) {
        await recordSyncError(orgId, opts.source, verify.message || "Invalid Meta catalog");
        return;
      }

      const isDelete =
        topic === "products/delete" || topic === "product.deleted";

      if (isDelete) {
        const retailerId =
          opts.source === "shopify"
            ? String(
                (opts.body as { variants?: Array<{ sku?: string; id?: number }> })?.variants?.[0]
                  ?.sku ||
                  (opts.body as { variants?: Array<{ id?: number }> })?.variants?.[0]?.id ||
                  (opts.body as { id?: number }).id ||
                  ""
              )
            : String((opts.body as { sku?: string; id?: number }).sku || (opts.body as { id?: number }).id || "");
        if (!retailerId) return;
        await deleteMetaCatalogProduct(catalogId, catalogWriteToken, retailerId);
        const patch =
          opts.source === "shopify"
            ? {
                shopifyLastSyncAt: new Date(),
                shopifyLastSyncStatus: "success" as const,
                shopifyLastSyncError: null,
              }
            : {
                woocommerceLastSyncAt: new Date(),
                woocommerceLastSyncStatus: "success" as const,
                woocommerceLastSyncError: null,
              };
        await storage.upsertOrganizationCommerceSettings(orgId, patch);
        return;
      }

      if (opts.source === "shopify") {
        await syncShopifyProductPayloadToMeta({
          organizationId: orgId,
          catalogId,
          accessToken: catalogWriteToken,
          product: opts.body,
        });
        await storage.upsertOrganizationCommerceSettings(orgId, {
          shopifyLastSyncAt: new Date(),
          shopifyLastSyncStatus: "success",
          shopifyLastSyncError: null,
        });
      } else {
        await syncWooProductPayloadToMeta({
          organizationId: orgId,
          catalogId,
          accessToken: catalogWriteToken,
          product: opts.body,
        });
        await storage.upsertOrganizationCommerceSettings(orgId, {
          woocommerceLastSyncAt: new Date(),
          woocommerceLastSyncStatus: "success",
          woocommerceLastSyncError: null,
        });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Catalog webhook sync failed";
      console.warn(`[Commerce] ${opts.source} webhook catalog sync:`, msg);
      if (opts.organizationId) {
        await recordSyncError(opts.organizationId, opts.source, msg);
      }
    }
  })();
}
