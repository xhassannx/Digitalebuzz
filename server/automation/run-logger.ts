import type { AutomationFlow } from "@shared/schema";
import { storage } from "../storage";

export const AUTOMATION_ACTION_MAX_ATTEMPTS = 3;
export const AUTOMATION_RETRY_BACKOFF_MS = [1000, 2000] as const;

export type AutomationRunLogLevel = "info" | "warn" | "error";

export function contactIdFromRunContext(ctx: Record<string, unknown>): string | null {
  const contact = ctx.contact as Record<string, unknown> | undefined;
  const trigger = ctx.trigger as Record<string, unknown> | undefined;
  const id = contact?.id ?? trigger?.id;
  return id != null && String(id).trim() ? String(id) : null;
}

export async function startAutomationFlowRun(params: {
  flow: AutomationFlow;
  triggerNodeId: string;
  triggerType?: string | null;
  contextRoot: Record<string, unknown>;
}): Promise<string> {
  const { flow, triggerNodeId, triggerType, contextRoot } = params;
  const run = await storage.createAutomationFlowRun({
    flowId: flow.id,
    userId: flow.userId,
    organizationId: flow.organizationId ?? null,
    triggerNodeId,
    triggerType: triggerType ?? null,
    contactId: contactIdFromRunContext(contextRoot),
    status: "running",
  });
  await logAutomationFlowEvent({
    runId: run.id,
    level: "info",
    event: "run_started",
    message: `Flow "${flow.name || flow.id}" started`,
    metadata: { triggerNodeId, triggerType: triggerType ?? null },
  });
  return run.id;
}

export async function logAutomationFlowEvent(params: {
  runId: string;
  level?: AutomationRunLogLevel;
  event: string;
  nodeId?: string | null;
  actionId?: string | null;
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await storage.createAutomationFlowRunLog({
    runId: params.runId,
    level: params.level ?? "info",
    event: params.event,
    nodeId: params.nodeId ?? null,
    actionId: params.actionId ?? null,
    message: params.message.slice(0, 4000),
    metadata: params.metadata ?? null,
  });
}

export async function markAutomationFlowRunScheduled(
  runId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await storage.updateAutomationFlowRunStatus(runId, "scheduled");
  await logAutomationFlowEvent({
    runId,
    level: "info",
    event: "delay_scheduled",
    message: "Flow paused for scheduled delay",
    metadata,
  });
}

export async function markAutomationFlowRunRunning(runId: string): Promise<void> {
  await storage.updateAutomationFlowRunStatus(runId, "running");
  await logAutomationFlowEvent({
    runId,
    level: "info",
    event: "run_resumed",
    message: "Flow resumed after scheduled delay",
  });
}

export async function completeAutomationFlowRun(runId: string): Promise<void> {
  await storage.updateAutomationFlowRunStatus(runId, "completed");
  await logAutomationFlowEvent({
    runId,
    level: "info",
    event: "run_completed",
    message: "Flow run completed",
  });
}

export async function failAutomationFlowRun(runId: string, error: string): Promise<void> {
  await storage.updateAutomationFlowRunStatus(runId, "failed", error);
  await logAutomationFlowEvent({
    runId,
    level: "error",
    event: "run_failed",
    message: error.slice(0, 4000),
  });
}

export async function cancelAutomationFlowRun(runId: string, reason: string): Promise<void> {
  await storage.updateAutomationFlowRunStatus(runId, "cancelled", reason);
  await logAutomationFlowEvent({
    runId,
    level: "warn",
    event: "run_cancelled",
    message: reason.slice(0, 4000),
  });
}

export function actionIdFromNode(node: { data?: Record<string, unknown> }): string {
  return String(node.data?.selectedActionId || node.data?.selectedAction || "").trim();
}

export async function executeActionWithRetries(params: {
  runId: string | undefined;
  flowLabel: string;
  node: { id: string; data?: Record<string, unknown> };
  isCriticalFailure: boolean;
  execute: () => Promise<void>;
}): Promise<void> {
  const { runId, flowLabel, node, isCriticalFailure, execute } = params;
  const actionId = actionIdFromNode(node);
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= AUTOMATION_ACTION_MAX_ATTEMPTS; attempt++) {
    try {
      if (runId && attempt === 1) {
        await logAutomationFlowEvent({
          runId,
          level: "info",
          event: "action_started",
          nodeId: node.id,
          actionId,
          message: `Executing ${actionId || "action"}`,
        });
      }
      await execute();
      if (runId) {
        await logAutomationFlowEvent({
          runId,
          level: "info",
          event: "action_succeeded",
          nodeId: node.id,
          actionId,
          message: `Completed ${actionId || "action"}`,
          metadata: { attempt },
        });
      }
      return;
    } catch (e: unknown) {
      lastError = e instanceof Error ? e : new Error(String(e));
      const willRetry = attempt < AUTOMATION_ACTION_MAX_ATTEMPTS;
      console.error(
        `[Automation] ${flowLabel} node ${node.id} attempt ${attempt}/${AUTOMATION_ACTION_MAX_ATTEMPTS} failed:`,
        lastError.message
      );
      if (runId) {
        await logAutomationFlowEvent({
          runId,
          level: willRetry ? "warn" : "error",
          event: willRetry ? "action_retry" : "action_failed",
          nodeId: node.id,
          actionId,
          message: lastError.message,
          metadata: {
            attempt,
            maxAttempts: AUTOMATION_ACTION_MAX_ATTEMPTS,
            willRetry,
          },
        });
      }
      if (willRetry) {
        await new Promise((r) => setTimeout(r, AUTOMATION_RETRY_BACKOFF_MS[attempt - 1] ?? 2000));
        continue;
      }
    }
  }

  if (isCriticalFailure && lastError) {
    throw lastError;
  }
}
