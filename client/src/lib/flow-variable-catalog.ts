import type { Edge, Node } from "reactflow";
import { sheetColumnVariablesFromHeaders } from "@shared/google-sheets-row";

export type FlowVariableItem = {
  label: string;
  snippet: string;
  hint?: string;
};

export type FlowVariableGroup = {
  id: string;
  title: string;
  items: FlowVariableItem[];
};

/** All nodes upstream of `targetNodeId` (BFS on reversed edges). */
export function getUpstreamNodeIds(nodes: Node[], edges: Edge[], targetNodeId: string): string[] {
  const reverseEdges = new Map<string, string[]>();
  edges.forEach((e) => {
    if (!reverseEdges.has(e.target)) reverseEdges.set(e.target, []);
    reverseEdges.get(e.target)!.push(e.source);
  });
  const visited = new Set<string>();
  const queue = [targetNodeId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const s of reverseEdges.get(id) || []) queue.push(s);
  }
  visited.delete(targetNodeId);
  return Array.from(visited);
}

export function getUpstreamNodes(nodes: Node[], edges: Edge[], targetNodeId: string): Node[] {
  const ids = getUpstreamNodeIds(nodes, edges, targetNodeId);
  return ids
    .map((id) => nodes.find((n) => n.id === id))
    .filter((n): n is Node => !!n);
}

/** Trigger node(s) reachable upstream — usually one. */
export function findUpstreamTriggerNodes(nodes: Node[], edges: Edge[], targetNodeId: string): Node[] {
  return getUpstreamNodes(nodes, edges, targetNodeId).filter((n) => n.type === "trigger");
}

function nodeData(node: Node): Record<string, unknown> {
  return (node.data || {}) as Record<string, unknown>;
}

export function getFlowNodeDisplayLabel(node: Node): string {
  const d = nodeData(node);
  if (node.type === "trigger") {
    return String(d.selectedTrigger || d.selectedApp || "Trigger");
  }
  const action = String(d.selectedAction || d.selectedActionId || "Step");
  const app = String(d.selectedApp || "");
  return app ? `${action} (${app})` : action;
}

const CONTACT_TRIGGER_VARS: FlowVariableItem[] = [
  { label: "Contact phone", snippet: "{{contact.phone}}" },
  { label: "Phone (E.164)", snippet: "{{contact.phoneE164}}" },
  { label: "Contact name", snippet: "{{contact.name}}" },
  { label: "First name", snippet: "{{contact.firstName}}" },
  { label: "Last name", snippet: "{{contact.lastName}}" },
  { label: "Email", snippet: "{{contact.email}}" },
  { label: "Contact ID", snippet: "{{contact.id}}" },
  { label: "Source", snippet: "{{contact.source}}" },
  { label: "Notes", snippet: "{{contact.notes}}" },
  { label: "Created at", snippet: "{{contact.createdAt}}" },
];

const GENERIC_WEBHOOK_VARS: FlowVariableItem[] = [
  {
    label: "Full payload (JSON)",
    snippet: "{{raw}}",
    hint: "Entire webhook body",
  },
];

const CALENDAR_EVENT_VARS: FlowVariableItem[] = [
  { label: "Resource ID", snippet: "{{trigger.resourceId}}" },
  { label: "Resource state", snippet: "{{trigger.resourceState}}" },
  { label: "Full webhook body", snippet: "{{raw}}" },
];

const CALENDLY_EVENT_VARS: FlowVariableItem[] = [
  { label: "Event URI", snippet: "{{trigger.uri}}" },
  { label: "Invitee email", snippet: "{{trigger.email}}" },
  { label: "Invitee name", snippet: "{{trigger.name}}" },
  { label: "Event start time", snippet: "{{trigger.event_start}}" },
  { label: "Full payload", snippet: "{{raw}}" },
  {
    label: "Custom field (dot path)",
    snippet: "{{trigger.payload}}",
    hint: "Use paths that match your Calendly webhook, e.g. {{trigger.payload.invitee.email}}",
  },
];

const SHOPIFY_ORDER_VARS: FlowVariableItem[] = [
  { label: "Order ID", snippet: "{{trigger.order_id}}" },
  { label: "Customer name", snippet: "{{trigger.name}}" },
  { label: "Customer email", snippet: "{{trigger.email}}" },
  { label: "Customer phone", snippet: "{{trigger.phone}}" },
  { label: "Total price", snippet: "{{trigger.total_price}}" },
  { label: "Financial status", snippet: "{{trigger.financial_status}}" },
  { label: "Full payload", snippet: "{{raw}}" },
];

const WHATSAPP_INBOUND_VARS: FlowVariableItem[] = [
  { label: "Sender phone", snippet: "{{trigger.phone}}" },
  { label: "Message body", snippet: "{{trigger.body}}" },
  { label: "Sender name", snippet: "{{trigger.name}}" },
  { label: "Button / list title", snippet: "{{trigger.button_title}}" },
  { label: "Full payload", snippet: "{{raw}}" },
];

const LEAD_VARS: FlowVariableItem[] = [
  { label: "Lead name", snippet: "{{trigger.name}}" },
  { label: "Phone", snippet: "{{trigger.phone}}" },
  { label: "Email", snippet: "{{trigger.email}}" },
  { label: "Company", snippet: "{{trigger.company}}" },
  { label: "Full payload", snippet: "{{raw}}" },
];

/** Variables from the flow trigger (runtime: contact, trigger, raw). */
export function getTriggerVariableGroups(
  triggerNode: Node | null,
  opts?: { sheetHeaders?: string[] }
): FlowVariableGroup[] {
  if (!triggerNode) {
    return [
      {
        id: "no-trigger",
        title: "Flow trigger",
        items: [
          {
            label: "Connect a trigger first",
            snippet: "{{raw}}",
            hint: "Wire a trigger node upstream, then reopen this picker.",
          },
        ],
      },
    ];
  }

  const triggerId = String(nodeData(triggerNode).selectedTrigger || "");
  const groups: FlowVariableGroup[] = [];

  if (triggerId === "new-contact" || triggerId === "contact-updated") {
    groups.push({
      id: "contact",
      title: "Contact trigger",
      items: [
        ...CONTACT_TRIGGER_VARS,
        {
          label: "Same as contact (trigger alias)",
          snippet: "{{trigger.phone}}",
          hint: "trigger.* mirrors contact fields when the trigger is Contact",
        },
      ],
    });
    return groups;
  }

  if (triggerId === "new-event") {
    groups.push({ id: "calendar", title: "Google Calendar — New event", items: CALENDAR_EVENT_VARS });
    return groups;
  }

  if (triggerId === "event-schedule" || triggerId === "event-canceled") {
    groups.push({
      id: "calendly",
      title: triggerId === "event-canceled" ? "Calendly — Event canceled" : "Calendly — Event scheduled",
      items: CALENDLY_EVENT_VARS,
    });
    return groups;
  }

  if (triggerId === "catch-raw-webhook" || triggerId === "zoom-webhook") {
    groups.push({
      id: "webhook",
      title: triggerId === "zoom-webhook" ? "Zoom webhook" : "Webhook payload",
      items: GENERIC_WEBHOOK_VARS,
    });
    return groups;
  }

  if (
    triggerId === "new-order" ||
    triggerId === "new-paid-order" ||
    triggerId === "new-customer" ||
    triggerId === "new-abandoned-checkout" ||
    triggerId === "new-cancelled-order" ||
    triggerId === "updated-product" ||
    triggerId === "order-created"
  ) {
    groups.push({
      id: "commerce",
      title: "Order / customer payload",
      items: SHOPIFY_ORDER_VARS,
    });
    return groups;
  }

  if (
    triggerId.startsWith("text-message") ||
    triggerId.includes("message") ||
    triggerId === "on-first-message" ||
    triggerId.includes("reply") ||
    triggerId === "form-message-response"
  ) {
    groups.push({ id: "whatsapp", title: "WhatsApp message", items: WHATSAPP_INBOUND_VARS });
    return groups;
  }

  if (triggerId === "new-lead" || triggerId === "tradeindia-new-lead" || triggerId === "justdial-new-lead") {
    groups.push({ id: "lead", title: "Lead", items: LEAD_VARS });
    return groups;
  }

  if (triggerId === "order-paid" || triggerId === "payment-captured") {
    groups.push({
      id: "razorpay",
      title: "Razorpay",
      items: [
        { label: "Payment ID", snippet: "{{trigger.payment_id}}" },
        { label: "Order ID", snippet: "{{trigger.order_id}}" },
        { label: "Amount", snippet: "{{trigger.amount}}" },
        { label: "Email", snippet: "{{trigger.email}}" },
        { label: "Full payload", snippet: "{{raw}}" },
      ],
    });
    return groups;
  }

  if (triggerId === "new-spreadsheet-rows") {
    const headers = (opts?.sheetHeaders || []).filter((h) => String(h).trim() !== "");
    if (headers.length > 0) {
      groups.push({
        id: "sheets",
        title: "New row (sheet columns)",
        items: sheetColumnVariablesFromHeaders(headers),
      });
      return groups;
    }
    const fallbackCols: FlowVariableItem[] = Array.from({ length: 12 }, (_, i) => ({
      label: `Column ${i + 1}`,
      snippet: `{{trigger.col${i + 1}}}`,
      hint: "Configure spreadsheet + worksheet on the trigger, then reopen Insert variable to load header names",
    }));
    fallbackCols.push({ label: "Full row (JSON)", snippet: "{{raw}}" });
    groups.push({
      id: "sheets",
      title: "New row",
      items: fallbackCols,
    });
    return groups;
  }

  if (
    triggerId.startsWith("product-") ||
    triggerId.startsWith("order-") ||
    triggerId.startsWith("customer-") ||
    triggerId.startsWith("coupon-")
  ) {
    groups.push({ id: "woocommerce", title: "WooCommerce", items: SHOPIFY_ORDER_VARS });
    return groups;
  }

  groups.push({
    id: "generic",
    title: `Trigger: ${triggerId || "unknown"}`,
    items: [
      { label: "Raw payload", snippet: "{{raw}}", hint: "Type custom paths: {{trigger.fieldName}}" },
      ...CONTACT_TRIGGER_VARS.slice(0, 3).map((v) => ({
        ...v,
        hint: "Only if this run includes contact data",
      })),
    ],
  });
  return groups;
}

/** Output fields for an upstream action node (runtime: {{nodeId.field}}). */
export function getActionOutputVariables(node: Node): FlowVariableItem[] {
  const actionId = String(nodeData(node).selectedActionId || "");
  const base = (fields: string[]): FlowVariableItem[] =>
    fields.map((name) => ({
      label: name,
      snippet: `{{${node.id}.${name}}}`,
    }));

  switch (actionId) {
    case "openai-chat":
    case "openai-generate":
      return base(["success", "response"]);
    case "gemini-generate":
    case "gemini-chat":
      return base(["success", "response"]);
    case "create-spreadsheet-row":
      return base(["success"]);
    case "text-helper":
      return base(["success", "result"]);
    case "math-helper":
      return base(["success", "result"]);
    case "date-helper":
      return base(["success", "result"]);
    case "http_request":
    case "custom-request":
    case "custom-request-contact":
    case "custom-request-calendar":
    case "custom-request-google-contacts":
    case "custom-request-openai":
    case "custom-request-gemini":
      return base(["success", "status", "body"]);
    case "update-contact":
    case "create-contact":
    case "get-contact":
      return [
        ...base(["success"]),
        { label: "Contact phone", snippet: `{{${node.id}.contact.phone}}` },
        { label: "Contact name", snippet: `{{${node.id}.contact.name}}` },
      ];
    case "send-template":
    case "send-message":
    case "send-media":
      return base(["success", "messageId"]);
    case "wait-for-reply":
      return base(["success", "replyPhone"]);
    default:
      return base(["success"]);
  }
}

export function getSheetTriggerConfig(triggerNode: Node | null): {
  connectionId?: string;
  spreadsheetId?: string;
  worksheetId?: string;
} | null {
  if (!triggerNode) return null;
  const triggerId = String(nodeData(triggerNode).selectedTrigger || "");
  if (triggerId !== "new-spreadsheet-rows") return null;
  const config = (nodeData(triggerNode).config || {}) as Record<string, unknown>;
  const connectionId = String(config.connectionId || "").trim();
  const spreadsheetId = String(config.spreadsheetId || "").trim();
  if (!connectionId || !spreadsheetId) return null;
  return {
    connectionId,
    spreadsheetId,
    worksheetId: config.worksheetId != null ? String(config.worksheetId) : undefined,
  };
}

export function buildFlowVariableCatalog(
  nodes: Node[],
  edges: Edge[],
  currentNodeId: string,
  opts?: { sheetHeaders?: string[] }
): { triggerGroups: FlowVariableGroup[]; upstreamSteps: { node: Node; variables: FlowVariableItem[] }[] } {
  const triggers = findUpstreamTriggerNodes(nodes, edges, currentNodeId);
  const triggerGroups = getTriggerVariableGroups(triggers[0] ?? null, {
    sheetHeaders: opts?.sheetHeaders,
  });

  const upstreamSteps = getUpstreamNodes(nodes, edges, currentNodeId)
    .filter((n) => n.type === "action" && n.id !== currentNodeId)
    .map((node) => ({
      node,
      variables: getActionOutputVariables(node),
    }))
    .filter((s) => s.variables.length > 0);

  return { triggerGroups, upstreamSteps };
}
