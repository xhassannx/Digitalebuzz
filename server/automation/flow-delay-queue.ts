import type { AutomationFlow, AutomationFlowScheduledRun } from "@shared/schema";
import { storage } from "../storage";

/** Delays longer than this are persisted and resumed by the scheduler. */
export const AUTOMATION_INLINE_DELAY_MS = 5 * 60 * 1000;

/** Maximum delay we will schedule (30 days). */
export const AUTOMATION_MAX_DELAY_MS = 30 * 24 * 60 * 60 * 1000;

export function isDelayActionNode(node: { data?: Record<string, unknown> }): boolean {
  const actionId = String(node.data?.selectedActionId || "");
  const selectedAction = String(node.data?.selectedAction || "").toLowerCase();
  return (
    actionId === "delay-for" ||
    actionId === "delay-until" ||
    selectedAction.includes("delay")
  );
}

export function resolveDelayMs(cfg: Record<string, unknown>): number {
  let days = Math.max(0, Number(cfg.days) || 0);
  let hours = Math.max(0, Number(cfg.hours) || 0);
  let minutes = Math.max(0, Number(cfg.minutes) || 0);
  let seconds = Math.max(0, Number(cfg.seconds) || 0);

  if (days === 0 && hours === 0 && minutes === 0 && seconds === 0) {
    const unit = String(cfg.delayForUnit || "minutes").toLowerCase();
    const val = Math.max(0, Number(cfg.delayForValue) || 0);
    if (unit === "weeks") days = val * 7;
    else if (unit === "days") days = val;
    else if (unit === "hours") hours = val;
    else if (unit === "minutes") minutes = val;
    else if (unit === "seconds") seconds = val;
    else minutes = val || 1;
  }

  return ((days * 24 + hours) * 60 + minutes) * 60 * 1000 + seconds * 1000;
}

export function resolveDelayResumeAt(
  cfg: Record<string, unknown>,
  actionId: string,
  selectedAction: string
): number {
  if (actionId === "delay-until" || selectedAction.includes("until")) {
    const until = String(cfg.delayUntil || "").trim();
    const target = Date.parse(until);
    if (Number.isNaN(target)) return Date.now();
    return target;
  }
  const ms = resolveDelayMs(cfg);
  return Date.now() + Math.max(ms, 1000);
}

export function clampScheduledDelayMs(ms: number): number {
  return Math.min(Math.max(ms, 1000), AUTOMATION_MAX_DELAY_MS);
}

export async function scheduleAutomationFlowDelay(params: {
  flow: AutomationFlow;
  delayNodeId: string;
  nextNodeId: string | null;
  resumeAt: number;
  runContext: Record<string, unknown>;
  visitedNodeIds: string[];
  runId?: string | null;
}): Promise<AutomationFlowScheduledRun> {
  const { flow, delayNodeId, nextNodeId, resumeAt, runContext, visitedNodeIds, runId } = params;
  const run = await storage.createAutomationFlowScheduledRun({
    flowId: flow.id,
    userId: flow.userId,
    organizationId: flow.organizationId ?? null,
    runId: runId ?? null,
    nextNodeId,
    resumeAt: new Date(resumeAt),
    runContext,
    visitedNodeIds: [...visitedNodeIds, delayNodeId],
    status: "pending",
  });
  if (runId) {
    const { markAutomationFlowRunScheduled } = await import("./run-logger");
    await markAutomationFlowRunScheduled(runId, {
      scheduledRunId: run.id,
      delayNodeId,
      nextNodeId,
      resumeAt: new Date(resumeAt).toISOString(),
    });
  }
  console.log(
    `[Automation] Delay scheduled for flow "${flow.name || flow.id}" — resume at ${new Date(resumeAt).toISOString()} → ${nextNodeId || "end"}`
  );
  return run;
}
