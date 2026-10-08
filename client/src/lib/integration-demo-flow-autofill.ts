// @ts-nocheck
/**
 * "Add integration test flow" builds a canvas graph from integrations connected for the current org.
 * Fills connectionId and resource ids where APIs succeed (same sources as the flow editor).
 */
import { apiRequest } from "@/lib/queryClient";
import {
  linearFlowFromCanvasNodesEdges,
  type CanvasEdgeForSync,
  type CanvasNodeForSync,
} from "@/lib/flow-canvas-linear-sync";
import type { AutomationFlow } from "@/lib/dummy-flows";

type IntegrationRow = {
  id: string;
  name: string;
  status?: string;
  config?: Record<string, unknown>;
};

export { INTEGRATION_SMOKE_TEST_CHECKLIST };

export const INTEGRATION_DEMO_FLOW_NAME_PREFIX = "[Demo] Integration test";

function isConnected(i: IntegrationRow): boolean {
  return !i.status || i.status === "connected";
}

function pickIntegration(
  integrations: IntegrationRow[],
  name: string,
  preferredHint?: string
): string | undefined {
  const list = integrations.filter((x) => x.name === name && isConnected(x));
  if (list.length === 0) return undefined;
  const hint = (preferredHint || "").toLowerCase().trim();
  if (hint) {
    const byHint = list.find((x) => {
      try {
        return JSON.stringify(x.config ?? {}).toLowerCase().includes(hint);
      } catch {
        return false;
      }
    });
    if (byHint) return byHint.id;
  }
  return list[0].id;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await apiRequest("GET", path);
  return (await res.json()) as T;
}

async function fetchPreferredAccountHint(): Promise<string | undefined> {
  try {
    const res = await apiRequest("GET", "/api/auth/user");
    const u = (await res.json()) as { email?: string };
    const email = typeof u?.email === "string" ? u.email.trim() : "";
    return email || undefined;
  } catch {
    return undefined;
  }
}

const y = (i: number) => 100 + i * 180;
const x = 400;

type DemoNode = Record<string, unknown>;

function calendarTriggerNode(accountNote?: string): DemoNode {
  return {
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
      ...(accountNote ? { _demoAccountNote: accountNote } : {}),
    },
  };
}

function crmTriggerNode(): DemoNode {
  return {
    id: "trigger-1",
    type: "trigger",
    position: { x, y: y(0) },
    width: 280,
    height: 120,
    data: {
      selectedApp: "Contact",
      appIcon: null,
      selectedTrigger: "new-contact",
      triggerType: "New Contact",
    },
  };
}

function delayNode(i: number): DemoNode {
  return {
    id: "action-delay",
    type: "action",
    position: { x, y: y(i) },
    width: 280,
    height: 120,
    data: {
      selectedAction: "Delay",
      actionIcon: null,
      config: { days: 0, hours: 0, minutes: 1, seconds: 0 },
    },
  };
}

const ACTION_BLUEPRINTS: Array<{
  integrationName: string;
  id: string;
  data: Record<string, unknown>;
}> = [
  {
    integrationName: "google-sheets",
    id: "action-sheets",
    data: {
      selectedAction: "Create spreadsheet row",
      actionIcon: "/icons/icon_1_spreadsheet_x32.png",
      selectedActionId: "create-spreadsheet-row",
      config: {
        driveId: "root",
        spreadsheetTitle: "Demo-Leads",
        worksheetId: "0",
        _smokeTestHint:
          "Pick Google Sheets connection, then real spreadsheet + worksheet. Row can use {{trigger.summary}} or {{contact.*}}.",
      },
    },
  },
  {
    integrationName: "google-contacts",
    id: "action-contacts",
    data: {
      selectedAction: "Create contact",
      actionIcon: "/icons/google-contact.png",
      selectedActionId: "create-google-contact",
      config: {
        googleContactName: "{{trigger.summary}}",
        googleContactEmail: "{{trigger.organizer_email}}",
        _smokeTestHint:
          "Pick Google Contacts; map fields to your trigger payload (adjust merge fields if you use CRM trigger).",
      },
    },
  },
  {
    integrationName: "openai",
    id: "action-openai",
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
    integrationName: "google-gemini",
    id: "action-gemini",
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
    integrationName: "calendly",
    id: "action-calendly",
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
    integrationName: "whatsapp-business",
    id: "action-whatsapp",
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
];

function buildEdges(chain: string[]): CanvasEdgeForSync[] {
  const out: CanvasEdgeForSync[] = [];
  for (let i = 0; i < chain.length - 1; i++) {
    const a = chain[i];
    const b = chain[i + 1];
    out.push({ id: `e-${a}-${b}`, source: a, target: b });
  }
  return out;
}

export type AutofillDemoFlowResult = {
  name: string;
  status: "inactive";
  nodes: NonNullable<AutomationFlow["nodes"]>;
  edges: NonNullable<AutomationFlow["edges"]>;
  linearFlow: ReturnType<typeof linearFlowFromCanvasNodesEdges>;
  autofillWarnings: string[];
  /** Connected integration types that received action nodes */
  connectedTags: string[];
};

/**
 * Builds nodes/edges for only the integrations that are connected; uses Calendar trigger when
 * Google Calendar is connected, otherwise a CRM "New contact" trigger (no external connection).
 */
export function buildDynamicIntegrationDemoShell(params: {
  connectedIntegrationNames: Set<string>;
  accountHint?: string;
}): { nodes: DemoNode[]; edges: CanvasEdgeForSync[]; connectedTags: string[] } {
  const { connectedIntegrationNames: conn, accountHint } = params;
  const tags: string[] = [];
  const useCal = conn.has("google-calendar");
  const nodes: DemoNode[] = [];
  const chain: string[] = ["trigger-1"];

  nodes.push(useCal ? calendarTriggerNode(accountHint) : crmTriggerNode());

  const actions = ACTION_BLUEPRINTS.filter((b) => {
    const on = conn.has(b.integrationName);
    if (on) tags.push(b.integrationName);
    return on;
  });

  if (actions.length > 0) {
    nodes.push(delayNode(1));
    chain.push("action-delay");
  }

  let yi = actions.length > 0 ? 2 : 1;
  for (const bp of actions) {
    nodes.push({
      id: bp.id,
      type: "action",
      position: { x, y: y(yi) },
      width: 280,
      height: 120,
      data: { ...bp.data },
    });
    chain.push(bp.id);
    yi += 1;
  }

  return {
    nodes: nodes as DemoNode[],
    edges: buildEdges(chain),
    connectedTags: tags,
  };
}

/**
 * Clones the dynamic graph, attaches connection ids and resources from the org's integrations.
 */
export async function buildAutofilledIntegrationDemoFlow(): Promise<AutofillDemoFlowResult> {
  const warnings: string[] = [];
  const preferredHint = await fetchPreferredAccountHint();

  let integrations: IntegrationRow[] = [];
  try {
    integrations = await getJson<IntegrationRow[]>("/api/integrations");
    if (!Array.isArray(integrations)) integrations = [];
  } catch {
    warnings.push("Could not load /api/integrations — no connections were applied.");
  }

  const connectedNames = new Set(
    integrations.filter(isConnected).map((i) => i.name)
  );

  const { nodes: shellNodes, edges, connectedTags } = buildDynamicIntegrationDemoShell({
    connectedIntegrationNames: connectedNames,
    accountHint: preferredHint,
  });

  const nodes = JSON.parse(JSON.stringify(shellNodes)) as Array<Record<string, unknown>>;

  const patchConfig = (nodeId: string, patch: Record<string, unknown>) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const data = (node.data as Record<string, unknown>) || {};
    const cfg = (data.config as Record<string, unknown>) || {};
    node.data = { ...data, config: { ...cfg, ...patch } };
  };

  if (connectedNames.has("google-calendar")) {
    const calConn = pickIntegration(integrations, "google-calendar", preferredHint);
    if (calConn) {
      let calendarId = "primary";
      try {
        const calData = await getJson<{ calendars?: { id: string; primary?: boolean }[] }>(
          `/api/integrations/google-calendar/calendars?connectionId=${encodeURIComponent(calConn)}`
        );
        const primary = calData.calendars?.find((c) => c.primary);
        if (primary?.id) calendarId = primary.id;
        else if (calData.calendars?.[0]?.id) calendarId = calData.calendars[0].id;
      } catch {
        warnings.push('Google Calendar: using calendar id "primary" (could not list calendars).');
      }
      patchConfig("trigger-1", { connectionId: calConn, calendarId });
    } else {
      warnings.push("Google Calendar: listed as connected but no row matched — set connection on the trigger.");
    }
  }

  const sheetsConn = pickIntegration(integrations, "google-sheets", preferredHint);
  if (connectedTags.includes("google-sheets")) {
    if (sheetsConn) {
      const patch: Record<string, unknown> = {
        connectionId: sheetsConn,
        driveId: "root",
      };
      try {
        const ssData = await getJson<{ spreadsheets?: { id: string; name?: string }[] }>(
          `/api/integrations/google-sheets/spreadsheets?connectionId=${encodeURIComponent(sheetsConn)}&driveId=root`
        );
        const firstSs = ssData.spreadsheets?.[0];
        if (firstSs?.id) {
          patch.spreadsheetId = firstSs.id;
          const wsData = await getJson<{ worksheets?: { id: string; name?: string }[] }>(
            `/api/integrations/google-sheets/worksheets?connectionId=${encodeURIComponent(
              sheetsConn
            )}&spreadsheetId=${encodeURIComponent(firstSs.id)}`
          );
          const firstWs = wsData.worksheets?.[0];
          if (firstWs?.id) patch.worksheetId = firstWs.id;
          else warnings.push("Google Sheets: first spreadsheet found but no worksheets returned.");
        } else {
          warnings.push("Google Sheets: no spreadsheets in My Drive — pick spreadsheet/worksheet manually.");
        }
      } catch {
        warnings.push("Google Sheets: connection set but could not auto-pick spreadsheet/worksheet.");
      }
      patchConfig("action-sheets", patch);
    } else {
      warnings.push("Google Sheets: node included but no Sheets connection row found.");
    }
  }

  const contactsConn = pickIntegration(integrations, "google-contacts", preferredHint);
  if (connectedTags.includes("google-contacts")) {
    if (contactsConn) patchConfig("action-contacts", { connectionId: contactsConn });
    else warnings.push("Google Contacts: node included but no connection row found.");
  }

  const openaiConn = pickIntegration(integrations, "openai", preferredHint);
  if (connectedTags.includes("openai")) {
    if (openaiConn) patchConfig("action-openai", { connectionId: openaiConn });
    else warnings.push("OpenAI: node included but no connection row found.");
  }

  const geminiConn = pickIntegration(integrations, "google-gemini", preferredHint);
  if (connectedTags.includes("google-gemini")) {
    if (geminiConn) patchConfig("action-gemini", { connectionId: geminiConn });
    else warnings.push("Google Gemini: node included but no connection row found.");
  }

  const calendlyConn = pickIntegration(integrations, "calendly", preferredHint);
  if (connectedTags.includes("calendly")) {
    if (calendlyConn) patchConfig("action-calendly", { connectionId: calendlyConn });
    else warnings.push("Calendly: node included but no connection row found.");
  }

  if (connectedTags.includes("whatsapp-business")) {
    try {
      const waData = await getJson<{
        success?: boolean;
        phoneNumbers?: Array<{
          sessionId: string;
          phoneNumberId?: string;
          displayPhoneNumber?: string;
        }>;
      }>("/api/integrations/whatsapp-business/added-phones");
      const session = waData.phoneNumbers?.[0];
      if (session?.sessionId) {
        const waPatch: Record<string, unknown> = {
          connectionId: session.sessionId,
          phoneNumberId: session.phoneNumberId || "",
        };
        if (session.displayPhoneNumber?.trim()) {
          waPatch.to = session.displayPhoneNumber.trim();
        }
        try {
          const tplData = await getJson<{ templates?: Array<{ name?: string; id?: string }> }>(
            `/api/integrations/whatsapp-business/templates?connectionId=${encodeURIComponent(session.sessionId)}`
          );
          const tpl = tplData.templates?.[0];
          const tplName = tpl?.name || tpl?.id;
          if (tplName) {
            waPatch.templateId = tplName;
            waPatch.templateName = tplName;
          } else {
            warnings.push("WhatsApp: no templates returned — set template in the editor.");
          }
        } catch {
          warnings.push("WhatsApp: could not load templates — set template manually.");
        }
        patchConfig("action-whatsapp", waPatch);
      } else {
        warnings.push("WhatsApp: no registered phone session — use /connect, then edit this flow.");
      }
    } catch {
      warnings.push("WhatsApp: could not load sessions from added-phones.");
    }
  }

  if (connectedTags.length === 0) {
    warnings.push(
      "No supported action integrations connected (Sheets, Contacts, OpenAI, Gemini, Calendly, WhatsApp). Flow has trigger only — connect apps and use Add integration test flow again, or add steps on the canvas."
    );
  }

  const linearFlow = linearFlowFromCanvasNodesEdges(
    nodes as CanvasNodeForSync[],
    edges as CanvasEdgeForSync[]
  );

  const tagLabel =
    connectedTags.length > 0
      ? connectedTags.join(", ")
      : useCal
        ? "calendar only"
        : "CRM trigger only";

  return {
    name: `${INTEGRATION_DEMO_FLOW_NAME_PREFIX} — ${tagLabel}`,
    status: "inactive",
    nodes: nodes as AutofillDemoFlowResult["nodes"],
    edges: edges as AutofillDemoFlowResult["edges"],
    linearFlow,
    autofillWarnings: warnings,
    connectedTags,
  };
}
