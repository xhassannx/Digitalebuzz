import { storage } from "../storage";
import {
  resolveWhatsAppAccessTokenForOrg,
  runShopifyCatalogSyncForOrg,
  runWooCatalogSyncForOrg,
} from "./catalog-sync-service";

async function runScheduledCommerceCatalogSync(): Promise<void> {
  const rows = await storage.listOrganizationCommerceSettingsWithAutoSync();
  if (!rows.length) return;

  console.log(`[Commerce Sync Scheduler] Running for ${rows.length} organization(s)`);

  for (const settings of rows) {
    const organizationId = settings.organizationId;
    const catalogId = settings.metaCatalogId?.trim();
    if (!catalogId) continue;

    const accessToken = await resolveWhatsAppAccessTokenForOrg(organizationId);
    if (!accessToken) {
      console.warn(
        `[Commerce Sync Scheduler] Skip org ${organizationId}: no WhatsApp Business token`
      );
      continue;
    }

    if (settings.shopifySyncEnabled) {
      const shopify = (
        await storage.getIntegrationsByOrganization(organizationId)
      ).find((i) => i.name === "shopify" && i.status === "connected");
      if (shopify) {
        try {
          const result = await runShopifyCatalogSyncForOrg({
            organizationId,
            accessToken,
            limit: 100,
          });
          console.log(
            `[Commerce Sync Scheduler] Shopify org ${organizationId}: ${result.synced} product(s)`
          );
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          console.warn(`[Commerce Sync Scheduler] Shopify org ${organizationId}:`, msg);
          await storage.upsertOrganizationCommerceSettings(organizationId, {
            shopifyLastSyncAt: new Date(),
            shopifyLastSyncStatus: "error",
            shopifyLastSyncError: msg,
          });
        }
      }
    }

    if (settings.woocommerceSyncEnabled) {
      const woo = (
        await storage.getIntegrationsByOrganization(organizationId)
      ).find((i) => i.name === "woocommerce" && i.status === "connected");
      if (woo) {
        try {
          const result = await runWooCatalogSyncForOrg({
            organizationId,
            accessToken,
            limit: 100,
          });
          console.log(
            `[Commerce Sync Scheduler] WooCommerce org ${organizationId}: ${result.synced} product(s)`
          );
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          console.warn(`[Commerce Sync Scheduler] Woo org ${organizationId}:`, msg);
          await storage.upsertOrganizationCommerceSettings(organizationId, {
            woocommerceLastSyncAt: new Date(),
            woocommerceLastSyncStatus: "error",
            woocommerceLastSyncError: msg,
          });
        }
      }
    }
  }
}

export function startCommerceCatalogSyncScheduler(): void {
  if (process.env.DISABLE_COMMERCE_SYNC_SCHEDULER === "true") {
    console.log("[Commerce Sync Scheduler] Disabled via DISABLE_COMMERCE_SYNC_SCHEDULER");
    return;
  }

  const intervalMs = (() => {
    const raw = process.env.COMMERCE_SYNC_INTERVAL_MS;
    if (raw !== undefined && String(raw).trim() !== "") {
      const n = parseInt(String(raw).trim(), 10);
      if (Number.isFinite(n)) {
        return Math.max(3_600_000, Math.min(86_400_000, n));
      }
    }
    return 21_600_000; // 6 hours
  })();

  console.log(`[Commerce Sync Scheduler] Full catalog sync every ${intervalMs}ms`);

  setTimeout(() => {
    runScheduledCommerceCatalogSync().catch((err) => {
      console.error("[Commerce Sync Scheduler] Initial run failed:", err);
    });
  }, 120_000);

  setInterval(() => {
    runScheduledCommerceCatalogSync().catch((err) => {
      console.error("[Commerce Sync Scheduler] Scheduled run failed:", err);
    });
  }, intervalMs);
}
