import { runDripCampaignTick } from "./executor";

const INTERVAL_MS = 60_000;

export function startDripCampaignScheduler(): void {
  console.log("[Drip Scheduler] Starting (every 60s)...");
  setInterval(() => {
    void runDripCampaignTick();
  }, INTERVAL_MS);
  // First run shortly after boot
  setTimeout(() => {
    void runDripCampaignTick();
  }, 15_000);
}
