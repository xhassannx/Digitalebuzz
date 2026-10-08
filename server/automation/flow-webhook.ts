import type { AutomationFlow } from "@shared/schema";
import { storage } from "../storage";
import { runAutomationFlowFromTrigger } from "./executor";
import {
  buildWebhookContextRoot,
  isAbandonedCheckoutEligible,
  shopifyPayloadHasPhone,
  shopifyTopicToCanvasTrigger,
  woocommerceTopicToCanvasTrigger,
  calendlyEventToCanvasTrigger,
  razorpayEventToCanvasTrigger,
} from "./webhook-context";

type FlowNode = {
  id: string;
  type?: string;
  data?: { selectedTrigger?: string; config?: Record<string, unknown> };
};

export type FlowWebhookResult = {
  ok: boolean;
  status: number;
  message: string;
  ran?: boolean;
  triggerId?: string;
};

function headerValue(headers: Record<string, unknown> | undefined, name: string): string {
  if (!headers) return "";
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower) return String(v ?? "");
  }
  return "";
}

function resolveCanvasTriggerId(
  flow: AutomationFlow,
  opts: {
    queryTrigger?: string;
    headers?: Record<string, unknown>;
    body?: Record<string, unknown>;
  }
): string | null {
  const nodes = (flow.nodes || []) as FlowNode[];
  const triggerNodes = nodes.filter((n) => n.type === "trigger");
  if (triggerNodes.length === 0) return null;

  const fromQuery = opts.queryTrigger?.trim();
  if (fromQuery) return fromQuery;

  const shopifyTopic = headerValue(opts.headers, "x-shopify-topic");
  if (shopifyTopic) {
    const mapped = shopifyTopicToCanvasTrigger(shopifyTopic);
    if (mapped) return mapped;
  }

  const wcTopic =
    headerValue(opts.headers, "x-wc-webhook-topic") ||
    headerValue(opts.headers, "x-woocommerce-topic");
  if (wcTopic) {
    const mapped = woocommerceTopicToCanvasTrigger(wcTopic);
    if (mapped) return mapped;
  }

  const calendlyEvent =
    headerValue(opts.headers, "x-calendly-event") ||
    (typeof opts.body?.event === "string" ? opts.body.event : "");
  if (calendlyEvent) {
    const mapped = calendlyEventToCanvasTrigger(calendlyEvent);
    if (mapped) return mapped;
  }

  const razorpayEvent =
    headerValue(opts.headers, "x-razorpay-event") ||
    (typeof opts.body?.event === "string" ? opts.body.event : "");
  if (razorpayEvent) {
    const mapped = razorpayEventToCanvasTrigger(razorpayEvent);
    if (mapped) return mapped;
  }

  const canvasHeader = headerValue(opts.headers, "x-canvas-trigger");
  if (canvasHeader) return canvasHeader;

  const nodeTrigger = triggerNodes[0]?.data?.selectedTrigger;
  return nodeTrigger ? String(nodeTrigger) : null;
}

/**
 * POST /api/v2/webhook/flows/:flowId — runs this published flow when payload matches its trigger.
 */
export async function handleFlowWebhook(
  flowId: string,
  body: Record<string, unknown>,
  opts?: {
    queryTrigger?: string;
    headers?: Record<string, unknown>;
  }
): Promise<FlowWebhookResult> {
  const flow = await storage.getAutomationFlowById(flowId);
  if (!flow) {
    return { ok: false, status: 404, message: "Flow not found" };
  }
  if (flow.status !== "active") {
    return { ok: false, status: 200, message: "Flow is not published (inactive)", ran: false };
  }

  const { isOrganizationPlanActive, isUserPlanActive } = await import("../utils/org-subscription-gate");
  const planOk = flow.organizationId
    ? await isOrganizationPlanActive(flow.organizationId)
    : await isUserPlanActive(flow.userId);
  if (!planOk) {
    return {
      ok: false,
      status: 403,
      message: "Subscription expired — renew your plan to run automations",
      ran: false,
    };
  }

  const canvasTriggerId = resolveCanvasTriggerId(flow, { ...opts, body });
  if (!canvasTriggerId) {
    return { ok: false, status: 400, message: "Flow has no trigger configured" };
  }

  const nodes = (flow.nodes || []) as FlowNode[];
  const matching = nodes.filter(
    (n) => n.type === "trigger" && n.data?.selectedTrigger === canvasTriggerId
  );
  if (matching.length === 0) {
    return {
      ok: false,
      status: 200,
      message: `No trigger node for "${canvasTriggerId}" on this flow (webhook ignored)`,
      ran: false,
      triggerId: canvasTriggerId,
    };
  }

  const topic =
    headerValue(opts?.headers, "x-shopify-topic") ||
    headerValue(opts?.headers, "x-webhook-topic") ||
    "";

  if (canvasTriggerId === "new-abandoned-checkout" && !isAbandonedCheckoutEligible(body)) {
    console.log(
      `[Automation] flow webhook ${flowId} skipped abandoned checkout (completed or no phone)`
    );
    return {
      ok: true,
      status: 200,
      message: "Skipped — checkout completed or no phone on checkout",
      ran: false,
      triggerId: canvasTriggerId,
    };
  }

  const contextRoot = buildWebhookContextRoot(body, canvasTriggerId, { topic });
  const startId = matching[0].id;

  console.log(
    `[Automation] flow webhook ${flowId} → trigger ${canvasTriggerId} (node ${startId})`
  );

  await runAutomationFlowFromTrigger({
    flow,
    startTriggerNodeId: startId,
    contextRoot,
  });

  return {
    ok: true,
    status: 200,
    message: "Flow executed",
    ran: true,
    triggerId: canvasTriggerId,
  };
}

/** Run all active org flows that listen for this canvas trigger (integration webhooks). */
export async function dispatchOrgFlowsForCanvasTrigger(opts: {
  canvasTriggerId: string;
  organizationId?: string | null;
  ownerUserId: string;
  body: Record<string, unknown>;
  topic?: string;
  integrationConnectionId?: string;
}): Promise<void> {
  const { canvasTriggerId, organizationId, ownerUserId, body, topic, integrationConnectionId } =
    opts;

  if (canvasTriggerId === "new-abandoned-checkout" && !isAbandonedCheckoutEligible(body)) {
    console.log(
      `[Automation] Skipping new-abandoned-checkout — checkout completed or phone missing (org=${organizationId || "none"})`
    );
    return;
  }

  // Order / customer WhatsApp flows need a phone; log clearly when missing (flow still runs for non-WA actions).
  if (
    (canvasTriggerId === "new-order" ||
      canvasTriggerId === "new-paid-order" ||
      canvasTriggerId === "new-cancelled-order" ||
      canvasTriggerId === "new-customer") &&
    !shopifyPayloadHasPhone(body, topic)
  ) {
    console.warn(
      `[Automation] ${canvasTriggerId} — no phone on Shopify payload; WhatsApp Send Template/Message will fail unless To is hard-coded (org=${organizationId || "none"})`
    );
  }

  const contextRoot = buildWebhookContextRoot(body, canvasTriggerId, { topic });

  const { runActiveAutomationsForCanvasTrigger } = await import("./dispatch-runner");
  await runActiveAutomationsForCanvasTrigger({
    canvasTriggerId,
    organizationId,
    ownerUserId,
    contextRoot,
    integrationConnectionId,
  });
}
