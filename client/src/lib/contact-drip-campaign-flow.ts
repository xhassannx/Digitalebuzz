/**
 * Canvas drip campaign for contact automations (New Lead Welcome + multi-day follow-ups).
 * Used by the "Create drip test flow" button on the Flows page.
 */
import { linearFlowFromCanvasNodesEdges } from "@/lib/flow-canvas-linear-sync";

export const CONTACT_DRIP_CAMPAIGN_FLOW_NAME = "[Test] Contact Welcome Drip";

export type ContactDripCampaignFlow = {
  name: string;
  status: "inactive";
  nodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    width: number;
    height: number;
    data: Record<string, unknown>;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle: string;
    targetHandle: string;
  }>;
  linearFlow: ReturnType<typeof linearFlowFromCanvasNodesEdges>;
};

function actionNode(
  id: string,
  y: number,
  selectedAction: string,
  selectedActionId: string,
  config: Record<string, unknown> = {}
) {
  return {
    id,
    type: "action" as const,
    position: { x: 500, y },
    width: 280,
    height: 120,
    data: {
      selectedAction,
      selectedActionId,
      actionIcon:
        selectedActionId.startsWith("send-") || selectedActionId === "wait-for-reply"
          ? "/icons/whatsapp.svg"
          : null,
      isChildOfTrigger: true,
      config,
    },
  };
}

function delayNode(id: string, y: number, days: number) {
  return actionNode(id, y, "Delay for", "delay-for", {
    delayForUnit: "days",
    delayForValue: days,
    days,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
}

function edge(source: string, target: string) {
  return {
    id: `edge-${source}-${target}`,
    source,
    target,
    sourceHandle: "source",
    targetHandle: "target",
  };
}

/** Full welcome drip: tag → assign → note → welcome → 1d → details → 1d → testimonials → 1d → reminder */
export function buildContactDripCampaignFlow(): ContactDripCampaignFlow {
  const step = 220;
  let y = 300;
  const nodes: ContactDripCampaignFlow["nodes"] = [
    {
      id: "trigger-1",
      type: "trigger",
      position: { x: 500, y: 80 },
      width: 280,
      height: 120,
      data: {
        selectedApp: "Contact",
        appIcon: null,
        selectedTrigger: "new-contact",
        triggerType: "New Contact",
      },
    },
    actionNode("action-tag", (y += step), "Add Tag", "add-tag", {
      tags: "New Lead",
      searchByIdOrPhone: "phone",
      contactIdOrPhone: "{{contact.phone}}",
    }),
    actionNode("action-assign", (y += step), "Auto Assign Contact", "auto-assign-contact", {
      searchByIdOrPhone: "phone",
      contactIdOrPhone: "{{contact.phone}}",
    }),
    actionNode("action-note", (y += step), "Add Note", "add-note", {
      note: "Lead received — welcome drip started (source: {{contact.source}})",
      searchByIdOrPhone: "phone",
      contactIdOrPhone: "{{contact.phone}}",
    }),
    actionNode("action-welcome", (y += step), "Send message", "send-message", {
      messageTo: "{{contact.phoneE164}}",
      messageBody:
        "Hi {{contact.firstName}}, thanks for connecting! We received your details and will follow up shortly.",
    }),
    delayNode("delay-day-1", (y += step), 1),
    actionNode("action-day1", (y += step), "Send message", "send-message", {
      messageTo: "{{contact.phoneE164}}",
      messageBody:
        "Day 1 — Here are more details about our services. Reply if you have any questions.",
    }),
    delayNode("delay-day-2", (y += step), 1),
    actionNode("action-day2", (y += step), "Send message", "send-message", {
      messageTo: "{{contact.phoneE164}}",
      messageBody: "Day 2 — What customers say about us: [add testimonials link or text]",
    }),
    delayNode("delay-day-3", (y += step), 1),
    actionNode("action-day3", (y += step), "Send message", "send-message", {
      messageTo: "{{contact.phoneE164}}",
      messageBody: "Day 3 — Just checking in. Would you like to schedule a quick call?",
    }),
  ];

  const edges = [
    edge("trigger-1", "action-tag"),
    edge("action-tag", "action-assign"),
    edge("action-assign", "action-note"),
    edge("action-note", "action-welcome"),
    edge("action-welcome", "delay-day-1"),
    edge("delay-day-1", "action-day1"),
    edge("action-day1", "delay-day-2"),
    edge("delay-day-2", "action-day2"),
    edge("action-day2", "delay-day-3"),
    edge("delay-day-3", "action-day3"),
  ];

  return {
    name: CONTACT_DRIP_CAMPAIGN_FLOW_NAME,
    status: "inactive",
    nodes,
    edges,
    linearFlow: linearFlowFromCanvasNodesEdges(nodes, edges),
  };
}

export function allocateDripCampaignFlowName(existingNames: Set<string>): string {
  let name = CONTACT_DRIP_CAMPAIGN_FLOW_NAME;
  let n = 2;
  while (existingNames.has(name)) {
    name = `${CONTACT_DRIP_CAMPAIGN_FLOW_NAME} (${n})`;
    n += 1;
  }
  return name;
}
