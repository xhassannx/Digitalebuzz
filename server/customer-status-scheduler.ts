import { refreshCustomerStatusCache } from "./updates";

const HOUR_MS = 60 * 60 * 1000;

/**
 * Background poll of licensor portal GET /api/customer to refresh account active / subscription gate cache.
 * Default: every 1 hour. Override with CUSTOMER_STATUS_BACKGROUND_POLL_MS (min 60s, max 24h).
 * Set DISABLE_CUSTOMER_STATUS_BACKGROUND_POLL=true to turn off.
 *
 * Pair with CUSTOMER_STATUS_CACHE_TTL_MS for in-request caching; the scheduler forces a fresh portal read
 * on each tick so inactive accounts take effect even when there is little API traffic.
 * For faster suspension detection, lower CUSTOMER_STATUS_BACKGROUND_POLL_MS (e.g. 60000 = 1 minute).
 */
export function startCustomerStatusBackgroundScheduler(): void {
  if (process.env.DISABLE_CUSTOMER_STATUS_BACKGROUND_POLL === "true") {
    console.log("[CustomerStatus] Background poll disabled (DISABLE_CUSTOMER_STATUS_BACKGROUND_POLL=true)");
    return;
  }
  const baseUrl = process.env.CUSTOMER_API_BASE_URL?.trim();
  const productionKey = process.env.PRODUCTION_KEY?.trim();
  if (!baseUrl || !productionKey) {
    console.log("[CustomerStatus] Background poll skipped (CUSTOMER_API_BASE_URL / PRODUCTION_KEY not set)");
    return;
  }

  const raw = process.env.CUSTOMER_STATUS_BACKGROUND_POLL_MS?.trim();
  const parsed = raw ? parseInt(raw, 10) : NaN;
  const intervalMs = Number.isFinite(parsed)
    ? Math.min(Math.max(parsed, 60_000), 24 * HOUR_MS)
    : HOUR_MS;

  const tick = () => {
    void refreshCustomerStatusCache().catch((e) =>
      console.error("[CustomerStatus] Background poll error:", e)
    );
  };

  // Stagger first run after boot (same idea as platform master sync)
  setTimeout(tick, 60_000);
  setInterval(tick, intervalMs);
  console.log(
    `[CustomerStatus] Background portal poll started: first run in 60s, then every ${Math.round(intervalMs / 1000)}s`
  );
}
