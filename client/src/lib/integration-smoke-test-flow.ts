// @ts-nocheck
/**
 * Static reference graph for docs/tests. Production “Add integration test flow” uses
 * `buildAutofilledIntegrationDemoFlow` in `integration-demo-flow-autofill.ts`, which builds steps only for
 * integrations your org has connected (Calendar trigger if Calendar is connected, else CRM “New contact”).
 */
import type { AutomationFlow } from "@/lib/dummy-flows";
import { linearFlowFromCanvasNodesEdges } from "@/lib/flow-canvas-linear-sync";

/** @deprecated Use dynamic names from `buildAutofilledIntegrationDemoFlow` / `INTEGRATION_DEMO_FLOW_NAME_PREFIX`. */
export const INTEGRATION_SMOKE_TEST_FLOW_NAME =
  "[Demo] Integration test (legacy static name)";

/** Short checklist for operators. */
export const INTEGRATION_SMOKE_TEST_CHECKLIST: string[] = [
  "Connect the integrations you want on the Integrations page (Sheets, Calendar, Contacts, OpenAI, Gemini, Calendly, WhatsApp, etc.).",
  "Add integration test flow — the canvas gets one step per connected app (in a fixed order), with connectionId and common resources auto-filled when APIs succeed.",
  "Open Advanced editor to verify mappings. Without Google Calendar, the flow uses a CRM “New contact” trigger.",
  "Save the flow. Activate only when your executor and webhooks are ready.",
];

function nodesAndEdges(): Pick<AutomationFlow, "nodes" | "edges"> {
  const y = (i: number) => 100 + i * 180;
  const x = 400;
  return {
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x, y: y(0) },
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
        id: "action-delay",
        type: "action",
        position: { x, y: y(1) },
        width: 280,
        height: 120,
        data: {
          selectedAction: "Delay",
          actionIcon: null,
          config: { days: 0, hours: 0, minutes: 1, seconds: 0 },
        },
      },
      {
        id: "action-sheets",
        type: "action",
        position: { x, y: y(2) },
        width: 280,
        height: 120,
        data: {
          selectedAction: "Create spreadsheet row",
          actionIcon: "/icons/icon_1_spreadsheet_x32.png",
          selectedActionId: "create-spreadsheet-row",
          config: {
            driveId: "root",
            spreadsheetTitle: "Demo-Leads-sk-kush2010",
            worksheetId: "0",
            _smokeTestHint:
              "Pick Google Sheets connection, then real spreadsheet + worksheet. Row can use {{trigger.summary}} etc.",
          },
        },
      },
      {
        id: "action-contacts",
        type: "action",
        position: { x, y: y(3) },
        width: 280,
        height: 120,
        data: {
          selectedAction: "Create contact",
          actionIcon: "/icons/google-contact.png",
          selectedActionId: "create-google-contact",
          config: {
            googleContactName: "{{trigger.summary}}",
            googleContactEmail: "{{trigger.organizer_email}}",
            _smokeTestHint:
              "Pick Google Contacts; map fields to your trigger payload (organizer_email may need adjusting).",
          },
        },
      },
      {
        id: "action-openai",
        type: "action",
        position: { x, y: y(4) },
        width: 280,
        height: 120,
        data: {
          selectedAction: "Chat completion",
          actionIcon: "/icons/openai.png",
          selectedActionId: "openai-chat",
          config: {
            model: "gpt-4o-mini",
            prompt: "Reply with exactly: OK",
            _smokeTestHint: "Select OpenAI connection in the panel.",
          },
        },
      },
      {
        id: "action-gemini",
        type: "action",
        position: { x, y: y(5) },
        width: 280,
        height: 120,
        data: {
          selectedAction: "Generate content",
          actionIcon: "/icons/gemini.jpg",
          selectedActionId: "gemini-generate",
          config: {
            model: "gemini-1.5-flash",
            prompt: "Reply with exactly: OK",
            _smokeTestHint: "Select Google Gemini connection in the panel.",
          },
        },
      },
      {
        id: "action-calendly",
        type: "action",
        position: { x, y: y(6) },
        width: 280,
        height: 120,
        data: {
          selectedAction: "Custom request",
          actionIcon: "/icons/calendly.svg",
          selectedActionId: "custom-request",
          config: {
            method: "GET",
            url: "https://api.calendly.com/users/me",
            data: "",
            _smokeTestHint: "Select Calendly connection; HTTP 200 means the token works.",
          },
        },
      },
      {
        id: "action-whatsapp",
        type: "action",
        position: { x, y: y(7) },
        width: 280,
        height: 120,
        data: {
          selectedAction: "Send Template",
          actionIcon: "/icons/whatsapp.svg",
          selectedActionId: "send-template",
          config: {
            templateName: "hello_world",
            language: "en",
            bodyParams: ["{{trigger.summary}}", "{{contact.phone}}"],
            to: "",
            _smokeTestHint:
              "Pick WhatsApp Business connection; set To to a verified test number and an approved template name.",
          },
        },
      },
    ],
    edges: [
      { id: "e-t-d", source: "trigger-1", target: "action-delay" },
      { id: "e-d-s", source: "action-delay", target: "action-sheets" },
      { id: "e-s-c", source: "action-sheets", target: "action-contacts" },
      { id: "e-c-o", source: "action-contacts", target: "action-openai" },
      { id: "e-o-g", source: "action-openai", target: "action-gemini" },
      { id: "e-g-cl", source: "action-gemini", target: "action-calendly" },
      { id: "e-cl-wa", source: "action-calendly", target: "action-whatsapp" },
    ],
  };
}

export function getIntegrationSmokeTestFlowPayload(): {
  name: string;
  status: AutomationFlow["status"];
  nodes: NonNullable<AutomationFlow["nodes"]>;
  edges: NonNullable<AutomationFlow["edges"]>;
  linearFlow: ReturnType<typeof linearFlowFromCanvasNodesEdges>;
} {
  const { nodes, edges } = nodesAndEdges();
  return {
    name: INTEGRATION_SMOKE_TEST_FLOW_NAME,
    status: "inactive",
    nodes,
    edges,
    linearFlow: linearFlowFromCanvasNodesEdges(nodes, edges),
  };
}
