import type { AutomationFlow } from "@shared/schema";
import { storage } from "../storage";

type FlowNode = {
  id: string;
  type?: string;
  data?: {
    selectedTrigger?: string;
    config?: { intervalMinutes?: number };
  };
};

const SCHEDULER_TRIGGER_IDS = new Set([
  "every-n-minutes",
  "every-hour",
  "every-day",
  "every-week",
  "every-month",
]);

const DEFAULT_INTERVAL_MS: Record<string, number> = {
  "every-n-minutes": 5 * 60 * 1000,
  "every-hour": 60 * 60 * 1000,
  "every-day": 24 * 60 * 60 * 1000,
  "every-week": 7 * 24 * 60 * 60 * 1000,
  "every-month": 30 * 24 * 60 * 60 * 1000,
};

const lastRunByKey = new Map<string, number>();

function schedulerKey(flowId: string, nodeId: string): string {
  return `${flowId}:${nodeId}`;
}

function intervalMsForTrigger(triggerId: string, config?: { intervalMinutes?: number }): number {
  if (triggerId === "every-n-minutes") {
    const mins = Math.max(1, Number(config?.intervalMinutes) || 5);
    return mins * 60 * 1000;
  }
  return DEFAULT_INTERVAL_MS[triggerId] || 5 * 60 * 1000;
}

async function tickSchedulerFlows(): Promise<void> {
  if (process.env.AUTOMATION_FLOWS_ENABLED === "false") return;

  const flows = await storage.getAllActiveAutomationFlows();
  const now = Date.now();
  const { isOrganizationPlanActive, isUserPlanActive } = await import("../utils/org-subscription-gate");

  for (const flow of flows) {
    const planOk = flow.organizationId
      ? await isOrganizationPlanActive(flow.organizationId)
      : await isUserPlanActive(flow.userId);
    if (!planOk) continue;

    const nodes = (flow.nodes || []) as FlowNode[];
    for (const node of nodes) {
      if (node.type !== "trigger") continue;
      const triggerId = node.data?.selectedTrigger;
      if (!triggerId || !SCHEDULER_TRIGGER_IDS.has(triggerId)) continue;

      const key = schedulerKey(flow.id, node.id);
      const interval = intervalMsForTrigger(triggerId, node.data?.config);
      const last = lastRunByKey.get(key) || 0;
      if (now - last < interval) continue;

      lastRunByKey.set(key, now);
      const contextRoot = {
        trigger: {
          firedAt: new Date(now).toISOString(),
          schedule: triggerId,
        },
        raw: { schedule: triggerId, firedAt: now },
      };

      console.log(`[Automation] scheduler ${triggerId} → flow ${flow.id}`);
      const { runAutomationFlowFromTrigger } = await import("./executor");
      await runAutomationFlowFromTrigger({
        flow: flow as AutomationFlow,
        startTriggerNodeId: node.id,
        contextRoot,
      });
    }
  }
}

export function startFlowScheduler(): void {
  const intervalMs = Number(process.env.FLOW_SCHEDULER_INTERVAL_MS || 60_000);
  const run = () => {
    tickSchedulerFlows().catch((e) => console.error("[Flow scheduler]", e));
  };
  setTimeout(run, 15_000);
  setInterval(run, intervalMs);
  console.log(`[Flow scheduler] Started (tick every ${intervalMs}ms)`);
}
