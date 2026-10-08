import { dispatchOrgFlowsForCanvasTrigger } from "./flow-webhook";
import { buildLeadTriggerContext } from "./webhook-context";

export async function dispatchLeadFlowsForIntegration(opts: {
  canvasTriggerId: "new-lead" | "tradeindia-new-lead" | "justdial-new-lead";
  integration: { id: string; userId: string; organizationId?: string | null };
  leads: Record<string, unknown>[];
}): Promise<number> {
  const { canvasTriggerId, integration, leads } = opts;
  let processed = 0;
  for (const lead of leads) {
    if (!lead || typeof lead !== "object") continue;
    const body = lead as Record<string, unknown>;
    await dispatchOrgFlowsForCanvasTrigger({
      canvasTriggerId,
      organizationId: integration.organizationId,
      ownerUserId: integration.userId,
      body,
      topic: canvasTriggerId,
    });
    processed++;
  }
  return processed;
}

export function normalizeLeadsFromWebhookBody(body: Record<string, unknown>): Record<string, unknown>[] {
  const leads = body.leads ?? body.data ?? body.lead ?? body;
  if (Array.isArray(leads)) {
    return leads.filter((l) => l && typeof l === "object") as Record<string, unknown>[];
  }
  if (leads && typeof leads === "object" && !Array.isArray(leads)) {
    return [leads as Record<string, unknown>];
  }
  if (body.mobile || body.phone || body.email || body.contact_number) {
    return [buildLeadTriggerContext(body)];
  }
  return [];
}
