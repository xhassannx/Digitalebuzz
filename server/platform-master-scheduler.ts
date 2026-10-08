import { runPlatformMasterSync } from "./platform-master-sync";

const FIFTEEN_MIN_MS = 15 * 60 * 1000;

/**
 * Background sync of platform master settings from CUSTOMER_API_BASE_URL.
 * Default every 15 minutes (was 24h) so Platform settings stay fresh if a SaaS push is missed.
 * PLATFORM_MASTER_SYNC_INTERVAL_MS overrides interval.
 * DISABLE_PLATFORM_MASTER_SYNC=true disables.
 */
export function startPlatformMasterScheduler(): void {
  if (process.env.DISABLE_PLATFORM_MASTER_SYNC === "true") {
    console.log("[PlatformMasterSync] Scheduler disabled (DISABLE_PLATFORM_MASTER_SYNC=true)");
    return;
  }

  const intervalMs = Math.max(
    60_000,
    parseInt(process.env.PLATFORM_MASTER_SYNC_INTERVAL_MS || String(FIFTEEN_MIN_MS), 10) ||
      FIFTEEN_MIN_MS
  );

  const tick = () => {
    void runPlatformMasterSync().catch((e) => console.error("[PlatformMasterSync] tick error:", e));
  };

  // First run shortly after boot (avoid competing with startup I/O)
  setTimeout(tick, 120_000);
  setInterval(tick, intervalMs);
  console.log(
    `[PlatformMasterSync] Scheduler started: first run in 2m, then every ${Math.round(intervalMs / 1000)}s`
  );
}
