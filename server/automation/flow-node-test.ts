import type { AutomationFlow } from "@shared/schema";
import { buildWebhookContextRoot } from "./webhook-context";
import { buildFlowWebhookTestPayload, getFlowWebhookTestSpec } from "./flow-test-payloads";

type FlowNode = {
  id: string;
  type?: string;
  data?: { selectedTrigger?: string; config?: Record<string, unknown> };
};

export function runFlowTriggerNodeTest(
  flow: AutomationFlow,
  nodeId: string,
  opts?: { sampleBody?: Record<string, unknown>; headers?: Record<string, string> }
): { output: Record<string, unknown>; input: Record<string, unknown> } {
  const nodes = (flow.nodes || []) as FlowNode[];
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) {
    throw new Error("Node not found on this flow");
  }
  if (node.type !== "trigger") {
    throw new Error("Only trigger nodes can be tested from this panel");
  }

  const triggerId = String(node.data?.selectedTrigger || "").trim() || "catch-raw-webhook";
  const sample = buildFlowWebhookTestPayload({
    flowId: String(flow.id),
    triggerId,
  });
  const body =
    opts?.sampleBody && Object.keys(opts.sampleBody).length > 0 ? opts.sampleBody : sample.body;
  const headers =
    opts?.headers && Object.keys(opts.headers).length > 0
      ? opts.headers
      : {
          host: "example.com",
          "user-agent": "FlowBuilder/Test",
          ...sample.headers,
        };

  const topic =
    headers["X-Shopify-Topic"] ||
    headers["x-shopify-topic"] ||
    headers["X-WC-Webhook-Topic"] ||
    headers["x-wc-webhook-topic"] ||
    undefined;

  const context = buildWebhookContextRoot(body, triggerId, { topic });
  const spec = getFlowWebhookTestSpec(triggerId);

  return {
    input: {
      triggerId,
      webhookCapable: sample.webhookCapable,
      url: sample.path,
      headers,
      body,
      curl: sample.curl,
      notes: sample.notes,
    },
    output: {
      headers,
      raw: context.raw,
      trigger: context.trigger,
      templateHints: sample.templateHints,
      hint: sample.webhookCapable
        ? `POST ${sample.path} with the Input body/headers (Postman or curl). Flow must be Published to actually run.`
        : (spec.notes || []).join(" ") ||
          `Trigger "${triggerId}" is not fired via the flow webhook URL.`,
    },
  };
}
