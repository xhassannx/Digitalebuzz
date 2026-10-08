import { storage } from "../storage";
import { triggerWebhooks } from "../webhooks/delivery";
import type { WhatsAppFlow, WhatsAppFlowResponse } from "@shared/schema";

export type ParsedNfmReply = {
  name?: string;
  body?: string;
  responseData: Record<string, unknown>;
};

export function parseNfmReply(message: Record<string, unknown>): ParsedNfmReply | null {
  const interactive = message.interactive as Record<string, unknown> | undefined;
  if (!interactive || interactive.type !== "nfm_reply") return null;
  const nfm = (interactive.nfm_reply || interactive.nfmReply) as Record<string, unknown> | undefined;
  if (!nfm) return null;

  let responseData: Record<string, unknown> = {};
  const raw = nfm.response_json ?? nfm.responseJson;
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        responseData = parsed as Record<string, unknown>;
      }
    } catch {
      responseData = { raw: raw };
    }
  } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    responseData = raw as Record<string, unknown>;
  }

  return {
    name: typeof nfm.name === "string" ? nfm.name : undefined,
    body: typeof nfm.body === "string" ? nfm.body : undefined,
    responseData,
  };
}

function resolveFlowForNfmReply(
  flows: WhatsAppFlow[],
  nfm: ParsedNfmReply,
): WhatsAppFlow | undefined {
  const token = String(
    nfm.responseData.flow_token || nfm.responseData.flowToken || "",
  ).trim();
  if (token && token !== "unused") {
    const byToken = flows.find(
      (f) =>
        f.id === token ||
        f.flowId === token ||
        (f.metadata as { metaFlowId?: string } | null)?.metaFlowId === token,
    );
    if (byToken) return byToken;
  }

  const metaFlowId = String(nfm.responseData.flow_id || nfm.responseData.flowId || "").trim();
  if (metaFlowId) {
    const byMeta = flows.find(
      (f) => f.flowId === metaFlowId || (f.metadata as { metaFlowId?: string } | null)?.metaFlowId === metaFlowId,
    );
    if (byMeta) return byMeta;
  }
  if (nfm.name && nfm.name.toLowerCase() !== "flow") {
    const byName = flows.find((f) => f.name?.toLowerCase() === nfm.name!.toLowerCase());
    if (byName) return byName;
  }
  const published = flows.filter((f) => f.status === "PUBLISHED");
  if (published.length === 1) return published[0];
  if (flows.length === 1) return flows[0];
  // Prefer most recently updated flow so submissions are not left unlinked (orphans).
  if (flows.length > 1) {
    return [...flows].sort((a, b) => {
      const at = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bt = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bt - at;
    })[0];
  }
  return undefined;
}

export async function storeAndWebhookFlowResponse(opts: {
  userId: string;
  organizationId?: string | null;
  sessionId: string;
  phone: string;
  nfm: ParsedNfmReply;
  whatsappMessageId?: string;
}): Promise<WhatsAppFlowResponse | null> {
  let organizationId = opts.organizationId ?? undefined;
  if (!organizationId && opts.sessionId) {
    const { resolveOrganizationIdForSessionId } = await import("../opt-keyword-service");
    organizationId = await resolveOrganizationIdForSessionId(opts.sessionId);
  }
  if (!organizationId) {
    console.warn("[FlowResponse] Skipping store: no organizationId for session", opts.sessionId);
    return null;
  }

  const flows = await storage.getWhatsAppFlowsByOrganization(organizationId);
  const matchedFlow = resolveFlowForNfmReply(flows, opts.nfm);
  const phone = opts.phone.replace(/@c\.us$/, "").replace(/@g\.us$/, "");

  const record = await storage.createWhatsAppFlowResponse({
    flowId: matchedFlow?.id ?? null,
    organizationId,
    userId: opts.userId,
    sessionId: opts.sessionId,
    phone,
    flowName: opts.nfm.name ?? null,
    responseData: opts.nfm.responseData,
    whatsappMessageId: opts.whatsappMessageId ?? null,
  });

  await triggerWebhooks(opts.userId, "form.response", {
    response: {
      id: record.id,
      flowId: record.flowId,
      phone: record.phone,
      submittedAt: record.submittedAt,
      data: record.responseData,
      flowName: record.flowName,
    },
    flow: matchedFlow
      ? { id: matchedFlow.id, name: matchedFlow.name, metaFlowId: matchedFlow.flowId }
      : null,
  });

  return record;
}
