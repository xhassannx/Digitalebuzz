import { storage } from "./storage";
import { fetchCustomerFromApi } from "./updates";
import { cloneJsonRecord, redactCustomerPortalPayloadForStorage } from "./customer-portal-payload";
import { saveCreditLineProvidersConfig } from "./credit-line/provider-config";

async function applyUpstreamCreditLineProviders(rawProviders: unknown): Promise<void> {
  if (!rawProviders || typeof rawProviders !== "object" || Array.isArray(rawProviders)) return;
  const providers = rawProviders as Record<string, Record<string, unknown>>;
  const patch: Record<string, Record<string, unknown>> = {};
  for (const [key, val] of Object.entries(providers)) {
    if (!val || typeof val !== "object") continue;
    const next: Record<string, unknown> = { ...val };
    // Keep existing panel token if SaaS sent empty / redacted
    const token = typeof next.accessToken === "string" ? next.accessToken.trim() : "";
    if (!token || token === "********" || token === "[REDACTED]") {
      delete next.accessToken;
    }
    patch[key] = next;
  }
  if (Object.keys(patch).length === 0) return;
  await saveCreditLineProvidersConfig(patch as any);
  console.log(
    `[PlatformMasterSync] Applied credit_line_providers from SaaS (${Object.keys(patch).join(", ")})`
  );
}

/** If the portal omits a top-level key in this response, keep the value from the last successful sync. */
function mergeAbsentTopLevelKeys(
  previous: Record<string, unknown>,
  incoming: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...incoming };
  for (const k of Object.keys(previous)) {
    if (k.startsWith("_")) continue;
    if (!Object.prototype.hasOwnProperty.call(out, k)) {
      out[k] = previous[k];
    }
  }
  return out;
}

/**
 * Pull whitelabel contract from GET {CUSTOMER_API_BASE_URL}/api/customer and persist (read-only on this panel).
 * upstream_payload is the normalized customer object (same keys/values as the portal contract).
 * By default known secrets are replaced with "[REDACTED]" before insert (safe for DB backups).
 * Set PLATFORM_MASTER_STORE_UNREDACTED_UPSTREAM=true to persist the verbatim API values (protect DB access).
 * Admin GET still redacts before JSON to the browser.
 *
 * Explicit null in the API body is stored as null (portal means “not set”). Example: payment_gateway "none"
 * → cashfree_* null. Set fees/IDs on the customer portal if you need non-null values.
 * Optional: PLATFORM_MASTER_MERGE_UPSTREAM_ABSENT_KEYS=true to carry forward keys missing from a partial response.
 */
export async function runPlatformMasterSync(): Promise<{
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  customerId?: number | string | null;
  topLevelKeys?: number;
}> {
  const baseUrl = process.env.CUSTOMER_API_BASE_URL?.trim();
  const productionKey = process.env.PRODUCTION_KEY?.trim();
  if (!baseUrl || !productionKey) {
    console.log("[PlatformMasterSync] Skip: CUSTOMER_API_BASE_URL or PRODUCTION_KEY not set");
    return { ok: false, skipped: true, reason: "CUSTOMER_API_BASE_URL or PRODUCTION_KEY not set" };
  }

  const data = await fetchCustomerFromApi();
  if (!data) {
    await storage.recordPlatformMasterUpstreamSync(
      {},
      "error",
      "GET /api/customer failed or returned no id — check CUSTOMER_API_BASE_URL, PRODUCTION_KEY, and portal availability"
    );
    console.error("[PlatformMasterSync] fetchCustomerFromApi returned null");
    return { ok: false, reason: "GET /api/customer failed or returned no id" };
  }

  // Apply Interakt / credit-line middleware from SaaS before redacting for storage
  try {
    const providers =
      (data as Record<string, unknown>).credit_line_providers ??
      (data as Record<string, unknown>).creditLineProviders;
    await applyUpstreamCreditLineProviders(providers);
  } catch (e: any) {
    console.error("[PlatformMasterSync] Failed to apply credit_line_providers:", e?.message || e);
  }

  const raw = data as Record<string, unknown>;
  const storePlaintext =
    process.env.PLATFORM_MASTER_STORE_UNREDACTED_UPSTREAM === "1" ||
    process.env.PLATFORM_MASTER_STORE_UNREDACTED_UPSTREAM === "true";

  let toPersist = storePlaintext ? cloneJsonRecord(raw) : redactCustomerPortalPayloadForStorage(raw);

  const mergeAbsent =
    process.env.PLATFORM_MASTER_MERGE_UPSTREAM_ABSENT_KEYS === "1" ||
    process.env.PLATFORM_MASTER_MERGE_UPSTREAM_ABSENT_KEYS === "true";
  if (mergeAbsent) {
    const existing = await storage.getPlatformMasterSettings();
    const prev = existing?.upstreamPayload;
    if (prev && typeof prev === "object" && !Array.isArray(prev)) {
      toPersist = mergeAbsentTopLevelKeys(prev as Record<string, unknown>, toPersist);
    }
  }

  await storage.recordPlatformMasterUpstreamSync(toPersist, "ok", null);
  const n = Object.keys(toPersist).length;
  console.log(
    `[PlatformMasterSync] Stored /api/customer snapshot id=${data.id} topLevelKeys=${n} redacted=${!storePlaintext}`
  );
  return { ok: true, customerId: data.id ?? null, topLevelKeys: n };
}
