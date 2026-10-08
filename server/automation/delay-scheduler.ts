/**
 * Automation flow delay scheduler: resumes canvas flows paused by long delay nodes.
 */
import { storage } from "../storage";
import { resumeAutomationFlowFromScheduledRun } from "./executor";

const INTERVAL_MS = 5_000;

export async function runAutomationDelayCheck(): Promise<void> {
  try {
    const due = await storage.claimDueAutomationFlowScheduledRuns(new Date(), 20);
    const { isOrganizationPlanActive, isUserPlanActive } = await import("../utils/org-subscription-gate");
    for (const run of due) {
      try {
        const flow = await storage.getAutomationFlowById(run.flowId);
        if (!flow) continue;
        const planOk = flow.organizationId
          ? await isOrganizationPlanActive(flow.organizationId)
          : await isUserPlanActive(flow.userId);
        if (!planOk) {
          console.log(
            `[Automation Delay Scheduler] Skipping run ${run.id} — subscription expired`
          );
          continue;
        }
        await resumeAutomationFlowFromScheduledRun(run);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Automation Delay Scheduler] Failed run ${run.id}:`, msg);
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Automation Delay Scheduler] Error:", msg);
  }
}

export function startAutomationDelayScheduler(): void {
  console.log("[Automation Delay Scheduler] Starting...");
  setInterval(runAutomationDelayCheck, INTERVAL_MS);
  void runAutomationDelayCheck();
}
