/**
 * Dummy/sample flows for demonstration.
 * Use getDummyFlowsToAdd() to get flows to POST to the API.
 */

import type { LinearFlowDefinitionV2 } from "@shared/linear-flow";
import { linearFlowFromCanvasNodesEdges } from "@/lib/flow-canvas-linear-sync";

export type FlowStatus = "active" | "inactive" | "draft";

export type AutomationFlow = {
  id?: string;
  name: string;
  status: FlowStatus;
  createdAt?: string;
  updatedAt?: string;
  nodes?: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    width?: number;
    height?: number;
    data: Record<string, unknown>;
  }>;
  edges?: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
  }>;
};

function getDummyFlowsData(): Omit<AutomationFlow, "id">[] {
  const now = new Date().toISOString();
  return [
    {
      name: "New Contact → Add to Sheet → WhatsApp",
      status: "inactive",
      createdAt: now,
      updatedAt: now,
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          position: { x: 400, y: 100 },
          width: 280,
          height: 120,
          data: {
            selectedApp: "Contact",
            appIcon: null,
            selectedTrigger: "new-contact",
            triggerType: "New Contact",
          },
        },
        {
          id: "action-1",
          type: "action",
          position: { x: 400, y: 280 },
          width: 280,
          height: 120,
          data: {
            selectedAction: "Create spreadsheet row",
            actionIcon: "/icons/icon_1_spreadsheet_x32.png",
            selectedActionId: "create-spreadsheet-row",
            config: {
              driveId: "root",
              spreadsheetTitle: "Contacts",
              worksheetId: "0",
            },
          },
        },
        {
          id: "action-2",
          type: "action",
          position: { x: 400, y: 460 },
          width: 280,
          height: 120,
          data: {
            selectedAction: "Send message",
            actionIcon: "/icons/whatsapp.svg",
            selectedActionId: "send-message",
            config: {},
          },
        },
      ],
      edges: [
        { id: "e1-2", source: "trigger-1", target: "action-1" },
        { id: "e2-3", source: "action-1", target: "action-2" },
      ],
    },
    {
      name: "Google Sheets Row → Create Contact → WhatsApp",
      status: "inactive",
      createdAt: now,
      updatedAt: now,
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          position: { x: 400, y: 100 },
          width: 280,
          height: 120,
          data: {
            selectedApp: "Google Sheets",
            appIcon: "/icons/icon_1_spreadsheet_x32.png",
            selectedTrigger: "new-spreadsheet-rows",
            triggerType: "New spreadsheet rows",
          },
        },
        {
          id: "action-1",
          type: "action",
          position: { x: 400, y: 280 },
          width: 280,
          height: 120,
          data: {
            selectedAction: "Create Contact",
            actionIcon: null,
            selectedActionId: "create-contact",
            config: {
              phone: "{{trigger.phone}}",
              name: "{{trigger.name}}",
              source: "google_sheets",
            },
          },
        },
        {
          id: "action-2",
          type: "action",
          position: { x: 400, y: 460 },
          width: 280,
          height: 120,
          data: {
            selectedAction: "Send message",
            actionIcon: "/icons/whatsapp.svg",
            selectedActionId: "send-message",
            config: {},
          },
        },
      ],
      edges: [
        { id: "e1-2", source: "trigger-1", target: "action-1" },
        { id: "e2-3", source: "action-1", target: "action-2" },
      ],
    },
    {
      name: "Calendar Event → Create Google Contact",
      status: "inactive",
      createdAt: now,
      updatedAt: now,
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          position: { x: 400, y: 100 },
          width: 280,
          height: 120,
          data: {
            selectedApp: "Google Calendar",
            appIcon: "/icons/calendar_31_2x.png",
            selectedTrigger: "new-event",
            triggerType: "New event",
          },
        },
        {
          id: "action-1",
          type: "action",
          position: { x: 400, y: 280 },
          width: 280,
          height: 120,
          data: {
            selectedAction: "Create contact",
            actionIcon: "/icons/google-contact.png",
            selectedActionId: "create-google-contact",
            config: {
              googleContactName: "{{trigger.summary}}",
              googleContactEmail: "{{trigger.attendee_email}}",
            },
          },
        },
      ],
      edges: [{ id: "e1-2", source: "trigger-1", target: "action-1" }],
    },
    {
      name: "Calendly Booking → Add Note to Contact",
      status: "inactive",
      createdAt: now,
      updatedAt: now,
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          position: { x: 400, y: 100 },
          width: 280,
          height: 120,
          data: {
            selectedApp: "Calendly",
            appIcon: "/icons/calendly.svg",
            selectedTrigger: "event-schedule",
            triggerType: "Event schedule",
          },
        },
        {
          id: "action-1",
          type: "action",
          position: { x: 400, y: 280 },
          width: 280,
          height: 120,
          data: {
            selectedAction: "Add Note",
            actionIcon: null,
            selectedActionId: "add-note",
            config: {
              searchByIdOrPhone: "phone",
              contactIdOrPhone: "{{trigger.invitee_email}}",
              note: "Booked via Calendly: {{trigger.event_name}}",
            },
          },
        },
      ],
      edges: [{ id: "e1-2", source: "trigger-1", target: "action-1" }],
    },
    {
      name: "Calendly Booking → OpenAI Summary → WhatsApp",
      status: "inactive",
      createdAt: now,
      updatedAt: now,
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          position: { x: 400, y: 100 },
          width: 280,
          height: 120,
          data: {
            selectedApp: "Calendly",
            appIcon: "/icons/calendly.svg",
            selectedTrigger: "event-schedule",
            triggerType: "Event schedule",
          },
        },
        {
          id: "action-1",
          type: "action",
          position: { x: 400, y: 280 },
          width: 280,
          height: 120,
          data: {
            selectedAction: "Chat completion",
            actionIcon: "/icons/openai.png",
            selectedActionId: "openai-chat",
            config: { prompt: "Summarize this booking: {{trigger.invitee_name}}", model: "gpt-4o" },
          },
        },
        {
          id: "action-2",
          type: "action",
          position: { x: 400, y: 460 },
          width: 280,
          height: 120,
          data: {
            selectedAction: "Send message",
            actionIcon: "/icons/whatsapp.svg",
            selectedActionId: "send-message",
            config: {},
          },
        },
      ],
      edges: [
        { id: "e1-2", source: "trigger-1", target: "action-1" },
        { id: "e2-3", source: "action-1", target: "action-2" },
      ],
    },
    {
      name: "New Contact → Router → Gemini or WhatsApp",
      status: "inactive",
      createdAt: now,
      updatedAt: now,
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          position: { x: 400, y: 100 },
          width: 280,
          height: 120,
          data: {
            selectedApp: "Contact",
            appIcon: null,
            selectedTrigger: "new-contact",
            triggerType: "New Contact",
          },
        },
        {
          id: "router-1",
          type: "router",
          position: { x: 400, y: 280 },
          width: 280,
          height: 120,
          data: {
            selectedAction: "Router",
            routerIcon: "/icons/router.svg",
            selectedActionId: "router",
            config: { branch1Condition: "{{trigger.source}} === 'whatsapp'" },
          },
        },
        {
          id: "action-1",
          type: "action",
          position: { x: 200, y: 460 },
          width: 280,
          height: 120,
          data: {
            selectedAction: "Generate content",
            actionIcon: "/icons/gemini.jpg",
            selectedActionId: "gemini-generate",
            config: { prompt: "Welcome {{trigger.name}}!", model: "gemini-1.5-flash" },
          },
        },
        {
          id: "action-2",
          type: "action",
          position: { x: 600, y: 460 },
          width: 280,
          height: 120,
          data: {
            selectedAction: "Send message",
            actionIcon: "/icons/whatsapp.svg",
            selectedActionId: "send-message",
            config: {},
          },
        },
      ],
      edges: [
        { id: "e1-r", source: "trigger-1", target: "router-1" },
        { id: "er-a1", source: "router-1", target: "action-1", sourceHandle: "branch-1", targetHandle: "target" },
        { id: "er-a2", source: "router-1", target: "action-2", sourceHandle: "otherwise", targetHandle: "target" },
      ],
    },
    {
      name: "New Contact → Create Calendar Event → WhatsApp",
      status: "inactive",
      createdAt: now,
      updatedAt: now,
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          position: { x: 400, y: 100 },
          width: 280,
          height: 120,
          data: {
            selectedApp: "Contact",
            appIcon: null,
            selectedTrigger: "new-contact",
            triggerType: "New Contact",
          },
        },
        {
          id: "action-1",
          type: "action",
          position: { x: 400, y: 280 },
          width: 280,
          height: 120,
          data: {
            selectedAction: "Create event",
            actionIcon: "/icons/calendar_31_2x.png",
            selectedActionId: "create-event",
            config: {
              eventSummary: "Follow-up: {{trigger.name}}",
              eventDescription: "Contact from CRM",
              eventStart: "{{trigger.created_at}}",
              eventEnd: "{{trigger.created_at}}",
            },
          },
        },
        {
          id: "action-2",
          type: "action",
          position: { x: 400, y: 460 },
          width: 280,
          height: 120,
          data: {
            selectedAction: "Send message",
            actionIcon: "/icons/whatsapp.svg",
            selectedActionId: "send-message",
            config: {},
          },
        },
      ],
      edges: [
        { id: "e1-2", source: "trigger-1", target: "action-1" },
        { id: "e2-3", source: "action-1", target: "action-2" },
      ],
    },
  ];
}

/** @deprecated Use `linearFlowFromCanvasNodesEdges` from `@/lib/flow-canvas-linear-sync` directly. */
export function buildLinearFlowFromDummyTemplate(
  t: Pick<AutomationFlow, "nodes" | "edges">
): LinearFlowDefinitionV2 {
  return linearFlowFromCanvasNodesEdges(t.nodes ?? [], t.edges ?? []);
}

/** Empty canvas for “New Flow” — single unconfigured trigger, no child action nodes. */
export function getEmptyCanvasFlowGraph(): {
  nodes: NonNullable<AutomationFlow["nodes"]>;
  edges: NonNullable<AutomationFlow["edges"]>;
} {
  return {
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 500, y: 300 },
        width: 280,
        height: 120,
        data: { selectedApp: null, appIcon: null },
      },
    ],
    edges: [],
  };
}

/**
 * Built-in sample graphs for “Add sample flows” / starter packs (not used for blank “New Flow”).
 * Index matches the order in getDummyFlowsData() (0 = Contact → Sheet → WhatsApp, etc.).
 */
export function getCanvasSampleGraphByIndex(index: number): {
  nodes: NonNullable<AutomationFlow["nodes"]>;
  edges: NonNullable<AutomationFlow["edges"]>;
} {
  const all = getDummyFlowsData();
  const i = Math.max(0, Math.min(index, all.length - 1));
  const f = all[i];
  return { nodes: f.nodes ?? [], edges: f.edges ?? [] };
}

/** All built-in canvas sample flow templates (currently 7). */
export function getDummyFlowTemplates(): Omit<AutomationFlow, "id">[] {
  return getDummyFlowsData();
}

/**
 * Returns a name not present in `taken`. If `base` is taken, uses "base (2)", "base (3)", …
 * Caller should add the returned name to `taken` before the next call.
 */
export function allocateUniqueFlowName(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let i = 2;
  let candidate = `${base} (${i})`;
  while (taken.has(candidate)) {
    i += 1;
    candidate = `${base} (${i})`;
  }
  return candidate;
}

/** Returns dummy flows that are not already in the current flows list (by name). */
export function getDummyFlowsToAdd(
  existingFlows: { name: string }[]
): { flowsToAdd: Omit<AutomationFlow, "id">[] } {
  const existingNames = new Set(existingFlows.map((f) => f.name));
  const allDummy = getDummyFlowsData();
  const flowsToAdd = allDummy.filter((f) => !existingNames.has(f.name));
  return { flowsToAdd };
}
