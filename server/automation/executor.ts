/**
 * Executes automation flows from a trigger: router branching, contact actions, WhatsApp, integrations.
 */
import type { AutomationFlow, ManagedContact } from "@shared/schema";
import { isLinearFlowDefinition, toLinearFlowV2ForEdit } from "@shared/linear-flow";
import { extractNameFromSheetRow, extractPhoneFromSheetRow } from "@shared/google-sheets-row";
import { storage } from "../storage";
import { getWhatsAppManager } from "../routes/shared";
import { businessAPIManager } from "../whatsapp/business-api-client";
import { resolvePanelPublicBaseUrl } from "../panel-inbox-send";

const SHEETS_API = "https://sheets.googleapis.com/v4";
const PEOPLE_API = "https://people.googleapis.com/v1";

const PANEL_BASE_URL = resolvePanelPublicBaseUrl();

type FlowNode = {
  id: string;
  type?: string;
  position?: { x?: number; y?: number };
  data?: Record<string, unknown>;
};

const WHATSAPP_OUTBOUND_ACTION_IDS = new Set([
  "send-template",
  "send-message",
  "send-media",
  "send-collection",
  "send-payment-link",
  "send-whatsapp-pay",
]);

function whatsAppOutboundActionId(node: FlowNode): string {
  return String(node.data?.selectedActionId || "");
}

function isWhatsAppOutboundAction(node: FlowNode): boolean {
  return WHATSAPP_OUTBOUND_ACTION_IDS.has(whatsAppOutboundActionId(node));
}

/** Top-to-bottom canvas order when a node has multiple outgoing edges. */
function sortOutgoingEdges(nodeId: string, edges: FlowEdge[], nodes: FlowNode[]): FlowEdge[] {
  return edges
    .filter((x) => x.source === nodeId)
    .sort((a, b) => {
      const na = nodes.find((n) => n.id === a.target);
      const nb = nodes.find((n) => n.id === b.target);
      const ya = na?.position?.y ?? 0;
      const yb = nb?.position?.y ?? 0;
      if (ya !== yb) return ya - yb;
      return (na?.position?.x ?? 0) - (nb?.position?.x ?? 0);
    });
}

async function executeActionNodeWithPolicy(
  node: FlowNode,
  flow: AutomationFlow,
  runContext: Record<string, unknown>,
  flowLabel: string,
  runId?: string
): Promise<void> {
  await executeActionWithRetries({
    runId,
    flowLabel,
    node,
    isCriticalFailure: isWhatsAppOutboundAction(node),
    execute: async () => {
      await executeSingleActionNode(node, flow, runContext, flowLabel);
      if (isWhatsAppOutboundAction(node)) {
        await sleep(1500);
      }
    },
  });
}

type LinearFlowRunResult = false | "completed" | "scheduled";

/** Run steps in saved linear_flow order (matches flow editor top-to-bottom). */
async function executeLinearFlowSteps(
  flow: AutomationFlow,
  runContext: Record<string, unknown>,
  flowLabel: string,
  runId?: string
): Promise<LinearFlowRunResult> {
  const lf = flow.linearFlow;
  if (!lf || !isLinearFlowDefinition(lf)) return false;
  const steps = toLinearFlowV2ForEdit(lf).steps || [];
  if (steps.length === 0) return false;

  const nodes = (flow.nodes || []) as FlowNode[];
  if (nodes.some((n) => n.type === "router")) return false;
  const actionNodes = nodes.filter((n) => n.type === "action");
  if (steps.length === 0 || steps.length !== actionNodes.length) {
    return false;
  }
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const node = nodes.find((n) => n.id === step.id);
    if (!node || node.type !== "action") {
      console.warn(`[Automation] ${flowLabel} linear step ${step.id} skipped (node missing)`);
      continue;
    }
    const canvasActionId = String(step.config?._canvasActionId || node.data?.selectedActionId || "");
    const merged: FlowNode = {
      ...node,
      data: {
        ...node.data,
        selectedActionId: canvasActionId || node.data?.selectedActionId,
        config: {
          ...((node.data?.config as Record<string, unknown>) || {}),
          ...step.config,
        },
      },
    };

    if (isDelayActionNode(merged)) {
      const rawCfg = (merged.data?.config as Record<string, unknown>) || {};
      const cfg = deepInterpolateConfig(rawCfg, runContext) as Record<string, unknown>;
      const actionId = String(merged.data?.selectedActionId || "");
      const selectedAction = String(merged.data?.selectedAction || "").toLowerCase();
      const resumeAt = resolveDelayResumeAt(cfg, actionId, selectedAction);
      const waitMs = clampScheduledDelayMs(resumeAt - Date.now());
      const nextStep = steps[i + 1];
      const nextNodeId = nextStep?.id ?? null;

      if (waitMs > AUTOMATION_INLINE_DELAY_MS) {
        await scheduleAutomationFlowDelay({
          flow,
          delayNodeId: merged.id,
          nextNodeId,
          resumeAt: Date.now() + waitMs,
          runContext,
          visitedNodeIds: [],
          runId,
        });
        return "scheduled";
      }

      console.log(`[Automation] ${flowLabel} delay: waiting ${Math.round(waitMs / 1000)}s`);
      await sleep(waitMs);
      continue;
    }

    await executeActionNodeWithPolicy(merged, flow, runContext, flowLabel, runId);
  }
  return "completed";
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export { contactContextPayload } from "./context-builders";
export { interpolateTemplate, deepInterpolateConfig, getByPath } from "./template-utils";
import { deepInterpolateConfig } from "./template-utils";
import { contactContextPayload } from "./context-builders";
import { pickRouterEdges, type FlowEdge } from "./router-eval";
import {
  AUTOMATION_INLINE_DELAY_MS,
  clampScheduledDelayMs,
  isDelayActionNode,
  resolveDelayMs,
  resolveDelayResumeAt,
  scheduleAutomationFlowDelay,
} from "./flow-delay-queue";
import type { AutomationFlowScheduledRun } from "@shared/schema";
import {
  completeAutomationFlowRun,
  executeActionWithRetries,
  failAutomationFlowRun,
  markAutomationFlowRunRunning,
  startAutomationFlowRun,
} from "./run-logger";
import {
  executeContactAddNote,
  executeContactAddTag,
  executeContactAutoAssign,
  executeContactCreate,
  executeContactGet,
  executeContactUpdate,
  executeHttpCustomRequest,
  resolveManagedContactForFlow,
} from "./contact-actions";
import {
  createAndSendContactPayment,
  parseFlowPaymentAmount,
} from "../payments/create-contact-payment";
import { sendWhatsAppNativePaymentMessage } from "../commerce/whatsapp-native-payment";
import { getCollectionCatalogSendPayload } from "../commerce/shopify-collections";
import {
  buildAutomationTemplatePersistMeta,
  persistOutboundWhatsAppMessage,
} from "../panel-outbound-message";
import {
  sendPanelMediaFromFlowUrl,
  sendPanelTemplateFromFlow,
  sendPanelTextFromFlow,
} from "../panel-inbox-send";

async function googleAccessToken(integration: {
  id: string;
  userId: string;
  credentials: Record<string, unknown> | null;
}): Promise<string> {
  const creds = (integration.credentials || {}) as Record<string, unknown>;
  const expiresAt = Number(creds.expires_at) || 0;
  if (expiresAt && Date.now() < expiresAt - 60_000 && typeof creds.access_token === "string") {
    return creds.access_token as string;
  }
  if (typeof creds.refresh_token === "string") {
    const clientId = String(creds.client_id || process.env.GOOGLE_CLIENT_ID || "");
    const clientSecret = String(creds.client_secret || process.env.GOOGLE_CLIENT_SECRET || "");
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: creds.refresh_token,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) throw new Error("Google token refresh failed");
    const tokens = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!tokens.access_token) throw new Error("No access_token from Google");
    creds.access_token = tokens.access_token;
    creds.expires_at = Date.now() + (Number(tokens.expires_in) || 3600) * 1000;
    await storage.updateIntegration(integration.id, integration.userId, { credentials: creds });
    return tokens.access_token;
  }
  if (typeof creds.access_token === "string") return creds.access_token;
  throw new Error("No Google access token");
}

function assertIntegrationAllowedForFlow(
  integration: { userId: string; organizationId: string | null },
  flow: AutomationFlow
): void {
  const fo = flow.organizationId;
  if (fo) {
    if (integration.organizationId) {
      if (integration.organizationId !== fo) throw new Error("Integration organization does not match flow");
      return;
    }
    if (integration.userId !== flow.userId) throw new Error("Integration owner does not match flow");
    return;
  }
  if (integration.userId !== flow.userId) throw new Error("Integration owner does not match flow");
}

async function executeCalendlyCancel(
  cfg: Record<string, unknown>,
  integration: { credentials: Record<string, unknown> | null }
): Promise<{ success: boolean }> {
  const creds = integration.credentials || {};
  const pat = (creds.access_token as string) || (creds.personal_access_token as string) || (creds.token as string);
  if (!pat) throw new Error("Calendly: no token");
  const eventUuid = String(cfg.eventUuid || cfg.event_uuid || "").trim();
  if (!eventUuid) throw new Error("Calendly cancel: event UUID is required");
  const reason = String(cfg.reason || "Canceled by automation flow").trim();
  const res = await fetch(`https://api.calendly.com/scheduled_events/${encodeURIComponent(eventUuid)}/cancellation`, {
    method: "POST",
    headers: { Authorization: `Bearer ${pat}`, "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Calendly cancel ${res.status}: ${body.slice(0, 400)}`);
  }
  return { success: true };
}

async function executeOpenAIChat(
  cfg: Record<string, unknown>,
  integration: { credentials: Record<string, unknown> | null }
): Promise<{ success: boolean; response: string }> {
  const creds = integration.credentials || {};
  const apiKey =
    (creds.api_key as string) ||
    (creds.apiKey as string) ||
    (creds.openai_api_key as string) ||
    (creds.secret as string);
  if (!apiKey) throw new Error("OpenAI integration has no API key");
  const model = String(cfg.model || "gpt-4o-mini");
  const prompt = String(cfg.prompt || "");
  const messages =
    Array.isArray(cfg.messages) && cfg.messages.length > 0
      ? cfg.messages
      : [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: prompt },
        ];
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature: Number(cfg.temperature) || 0.3 }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI ${res.status}: ${t.slice(0, 400)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const response = String(data.choices?.[0]?.message?.content ?? "").trim();
  return { success: true, response };
}

async function executeGemini(
  cfg: Record<string, unknown>,
  integration: { credentials: Record<string, unknown> | null }
): Promise<{ success: boolean; response: string }> {
  const creds = integration.credentials || {};
  const key =
    (creds.api_key as string) || (creds.apiKey as string) || (creds.key as string);
  if (!key) throw new Error("Gemini integration has no API key");
  const model = String(cfg.model || "gemini-1.5-flash");
  const prompt = String(cfg.prompt || "");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini ${res.status}: ${t.slice(0, 400)}`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const response = String(data.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
  return { success: true, response };
}

/** Append one data row using a connected Google Sheets integration (same Sheets API path as automation “Create spreadsheet row”). */
export async function appendGoogleSheetRowWithIntegration(
  integration: { id: string; userId: string; organizationId: string | null; credentials: Record<string, unknown> | null },
  spreadsheetId: string,
  worksheetId: string,
  row: Record<string, unknown>
): Promise<void> {
  await executeSheetsAppendRow({ spreadsheetId, worksheetId, row }, integration);
}

async function executeSheetsAppendRow(
  cfg: Record<string, unknown>,
  integration: { id: string; userId: string; organizationId: string | null; credentials: Record<string, unknown> | null }
): Promise<void> {
  const spreadsheetId = String(cfg.spreadsheetId || "").trim();
  if (!spreadsheetId) throw new Error("Sheets: missing spreadsheetId");
  const token = await googleAccessToken(integration);
  const auth = `Bearer ${token}`;

  let sheetTitle = "";
  const sheetId = cfg.worksheetId != null ? String(cfg.worksheetId) : "";
  const metaRes = await fetch(`${SHEETS_API}/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties`, {
    headers: { Authorization: auth },
  });
  if (!metaRes.ok) throw new Error(`Sheets meta ${metaRes.status}`);
  const meta = (await metaRes.json()) as { sheets?: Array<{ properties?: { sheetId?: number; title?: string } }> };
  const sheets = meta.sheets || [];
  if (sheetId) {
    const found = sheets.find((s) => String(s.properties?.sheetId) === sheetId);
    sheetTitle = found?.properties?.title || "";
  }
  if (!sheetTitle && sheets[0]?.properties?.title) sheetTitle = String(sheets[0].properties!.title);
  if (!sheetTitle) throw new Error("Could not resolve worksheet title");

  const rowObj = (cfg.row as Record<string, unknown>) || {};

  /** Match config row key to header cell (trim + case-insensitive). */
  function cellForHeader(headerCell: string): string {
    const h = headerCell.trim();
    if (!h) return "";
    if (Object.prototype.hasOwnProperty.call(rowObj, h)) {
      const v = rowObj[h];
      return v == null ? "" : String(v);
    }
    const lower = h.toLowerCase();
    for (const k of Object.keys(rowObj)) {
      if (k.trim().toLowerCase() === lower) {
        const v = rowObj[k];
        return v == null ? "" : String(v);
      }
    }
    return "";
  }

  // CRITICAL: Sheet columns are A, B, C… in row-1 order — NOT alphabetical order of JSON keys.
  const safeTitleForRange = sheetTitle.replace(/'/g, "''");
  const headerRangePath = encodeURIComponent(`'${safeTitleForRange}'!1:1`);
  const headerValuesUrl = `${SHEETS_API}/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${headerRangePath}`;
  const headerValuesRes = await fetch(headerValuesUrl, { headers: { Authorization: auth } });
  let values: string[][];
  if (headerValuesRes.ok) {
    const hv = (await headerValuesRes.json()) as { values?: unknown[][] };
    const headerRow = (hv.values && hv.values[0]) || [];
    const headers = headerRow.map((c) => (c == null ? "" : String(c)));
    if (headers.some((x) => String(x).trim() !== "")) {
      values = [headers.map((h) => cellForHeader(h))];
    } else {
      const keys = Object.keys(rowObj).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      values = [keys.map((k) => (rowObj[k] == null ? "" : String(rowObj[k])))];
    }
  } else {
    const keys = Object.keys(rowObj).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    values = [keys.map((k) => (rowObj[k] == null ? "" : String(rowObj[k])))];
  }

  const range = encodeURIComponent(`'${safeTitleForRange}'!A1`);
  const url = `${SHEETS_API}/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}:append?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({ values }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Sheets append ${res.status}: ${t.slice(0, 400)}`);
  }
}

async function executeGoogleCreateContact(
  cfg: Record<string, unknown>,
  integration: { id: string; userId: string; organizationId: string | null; credentials: Record<string, unknown> | null }
): Promise<void> {
  const token = await googleAccessToken(integration);
  const auth = `Bearer ${token}`;
  const name = String(cfg.googleContactName || cfg.name || "").trim();
  const email = String(cfg.googleContactEmail || cfg.email || "").trim();
  const phone = String(cfg.googleContactPhone || cfg.phone || "").trim();
  const body: Record<string, unknown> = {
    names: name ? [{ displayName: name }] : [],
    emailAddresses: email ? [{ value: email }] : [],
    phoneNumbers: phone ? [{ value: phone }] : [],
  };
  const res = await fetch(`${PEOPLE_API}/people:createContact?updatePersonFields=names,emailAddresses,phoneNumbers`, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Google Contacts ${res.status}: ${t.slice(0, 400)}`);
  }
}

async function executeCalendlyCustom(
  cfg: Record<string, unknown>,
  integration: { credentials: Record<string, unknown> | null }
): Promise<{ success: boolean; status: number; body: string }> {
  const creds = integration.credentials || {};
  const pat = (creds.access_token as string) || (creds.personal_access_token as string) || (creds.token as string);
  if (!pat) throw new Error("Calendly: no token");
  const method = String(cfg.method || "GET").toUpperCase();
  const url = String(cfg.url || "").trim();
  if (!url || !url.startsWith("https://api.calendly.com")) {
    throw new Error("Calendly: url must start with https://api.calendly.com");
  }
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${pat}`, "Content-Type": "application/json" },
    body: method === "GET" || method === "HEAD" ? undefined : String(cfg.data || "{}"),
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Calendly ${res.status}: ${body.slice(0, 400)}`);
  }
  return { success: true, status: res.status, body };
}

async function executeDelayInline(cfg: Record<string, unknown>, flowLabel: string): Promise<void> {
  const ms = clampScheduledDelayMs(resolveDelayMs(cfg));
  console.log(`[Automation] ${flowLabel} delay: waiting ${Math.round(ms / 1000)}s`);
  await sleep(ms);
}

async function executeDelayUntilInline(
  cfg: Record<string, unknown>,
  flowLabel: string
): Promise<void> {
  const until = String(cfg.delayUntil || "").trim();
  if (!until) {
    console.warn("[Automation] Delay until: missing delayUntil ISO value");
    return;
  }
  const target = Date.parse(until);
  if (Number.isNaN(target)) {
    console.warn(`[Automation] Delay until: invalid ISO date "${until}"`);
    return;
  }
  const ms = clampScheduledDelayMs(target - Date.now());
  if (ms <= 0) return;
  console.log(`[Automation] ${flowLabel} delay until: waiting ${Math.round(ms / 1000)}s`);
  await sleep(ms);
}

async function handleGraphDelayNode(
  node: FlowNode,
  nodeId: string,
  nodes: FlowNode[],
  edges: FlowEdge[],
  flow: AutomationFlow,
  runContext: Record<string, unknown>,
  flowLabel: string,
  visited: Set<string>,
  runId?: string
): Promise<boolean> {
  const rawCfg = ((node.data || {}) as Record<string, unknown>).config as Record<string, unknown> | undefined;
  const cfg = deepInterpolateConfig(rawCfg || {}, runContext) as Record<string, unknown>;
  const actionId = String(node.data?.selectedActionId || "");
  const selectedAction = String(node.data?.selectedAction || "").toLowerCase();
  const resumeAt = resolveDelayResumeAt(cfg, actionId, selectedAction);
  const waitMs = clampScheduledDelayMs(resumeAt - Date.now());
  const outgoing = sortOutgoingEdges(nodeId, edges, nodes);
  const nextNodeId = outgoing[0]?.target ?? null;

  if (waitMs > AUTOMATION_INLINE_DELAY_MS) {
    await scheduleAutomationFlowDelay({
      flow,
      delayNodeId: nodeId,
      nextNodeId,
      resumeAt: Date.now() + waitMs,
      runContext,
      visitedNodeIds: [...visited],
      runId,
    });
    return true;
  }

  if (actionId === "delay-until" || selectedAction.includes("until")) {
    await executeDelayUntilInline(cfg, flowLabel);
  } else {
    await executeDelayInline(cfg, flowLabel);
  }

  for (const e of outgoing) {
    if (await executeFlowFromNode(e.target, nodes, edges, flow, runContext, flowLabel, visited, runId)) {
      return true;
    }
  }
  return false;
}

async function ensureWhatsAppBusinessReady(sessionId: string, flow: AutomationFlow) {
  const session = await storage.getSession(sessionId);
  if (!session) throw new Error("WhatsApp session not found");
  if (session.connectionType !== "official") {
    throw new Error("This WhatsApp step requires a WhatsApp Business (official) connection");
  }

  const manager = await getWhatsAppManager(sessionId);
  if (!manager.isClientReady(sessionId)) {
    const apiPhoneNumberId = session.deviceInfo?.apiPhoneNumberId;
    let integration: Awaited<ReturnType<typeof storage.getIntegrationByName>> | undefined;
    if (session.deviceInfo?.integrationId) {
      integration = await storage.getIntegration(session.deviceInfo.integrationId, session.userId);
    }
    if (!integration) {
      integration = await storage.getIntegrationByName(
        "whatsapp-business",
        session.userId,
        flow.organizationId || undefined
      );
    }
    const creds = integration?.credentials as Record<string, unknown> | undefined;
    const accessToken = typeof creds?.access_token === "string" ? creds.access_token : null;
    if (accessToken && apiPhoneNumberId) {
      await businessAPIManager.restoreSession(sessionId, {
        phoneNumberId: apiPhoneNumberId,
        accessToken,
        businessAccountId:
          typeof session.deviceInfo?.businessAccountId === "string"
            ? session.deviceInfo.businessAccountId
            : undefined,
      });
    }
    if (!manager.isClientReady(sessionId)) {
      throw new Error("WhatsApp Business API session is not ready");
    }
  }
  return { session, manager };
}

function normalizeFlowRecipientPhone(raw: string): string {
  const digits = String(raw || "").replace(/\D/g, "");
  return digits;
}

function countTemplateBodyParams(bodyText?: string | null): number {
  if (!bodyText) return 0;
  const matches = bodyText.match(/\{\{\d+\}\}/g) || [];
  return new Set(matches.map((m) => m.match(/\d+/)?.[0])).size;
}

/** Sheet rows + CRM: populate contact.* so {{contact.phone}} works for new numbers too. */
async function enrichSpreadsheetRunContext(
  flow: AutomationFlow,
  triggerType: string,
  runContext: Record<string, unknown>
): Promise<void> {
  if (triggerType !== "new-spreadsheet-rows") return;
  const trigger = runContext.trigger as Record<string, unknown> | undefined;
  if (!trigger || typeof trigger !== "object") return;

  const phoneDigits = extractPhoneFromSheetRow(trigger);
  const name = extractNameFromSheetRow(trigger);
  if (!phoneDigits) {
    console.warn(
      `[Automation] Sheet row has no detectable phone — map Send Template "To" to {{trigger.phone}} or a column variable`
    );
    return;
  }

  const sheetContact = contactContextPayload({
    phoneNumber: phoneDigits,
    name,
    source: "google_sheets",
  }).contact as Record<string, unknown>;
  runContext.contact = sheetContact;
  if (!trigger.phone) trigger.phone = sheetContact.phone;
  if (!trigger.phoneE164) trigger.phoneE164 = sheetContact.phoneE164;
  if (!trigger.name && name) trigger.name = name;

  if (flow.organizationId) {
    const existing = await storage.findManagedContactByOrganizationAndPhoneDigits(
      flow.organizationId,
      phoneDigits
    );
    if (existing) {
      const tags = await storage.getContactTags(existing.id, flow.userId, flow.organizationId);
      runContext.contact = contactContextPayload(
        existing as unknown as Record<string, unknown>,
        tags
      ).contact as Record<string, unknown>;
    }
  }
}

async function ensureManagedContactForFlowRecipient(
  flow: AutomationFlow,
  phoneDigits: string,
  name?: string
): Promise<ManagedContact | undefined> {
  if (!flow.organizationId || !phoneDigits) return undefined;
  const existing = await storage.findManagedContactByOrganizationAndPhoneDigits(
    flow.organizationId,
    phoneDigits
  );
  if (existing) return existing;
  try {
    return await storage.createManagedContact(
      {
        userId: flow.userId,
        organizationId: flow.organizationId,
        name: name?.trim() || phoneDigits,
        phoneNumber: phoneDigits,
        source: "google_sheets",
      },
      { skipAutomation: true }
    );
  } catch (e: unknown) {
    console.warn(
      `[Automation] Could not auto-create contact for ${phoneDigits}:`,
      e instanceof Error ? e.message : e
    );
    return undefined;
  }
}

async function resolveFlowTemplateSendOptions(
  flow: AutomationFlow,
  sessionId: string,
  templateName: string,
  configuredLanguage: string,
  configuredParams?: string[]
): Promise<{
  templateName: string;
  templateLanguage: string;
  templateParams?: string[];
  headerFormat?: string;
}> {
  const session = await storage.getSession(sessionId);
  const phoneNumberId =
    session?.connectionType === "official"
      ? (session.deviceInfo as { apiPhoneNumberId?: string })?.apiPhoneNumberId
      : undefined;

  const templates = await storage.getMessageTemplatesByUser(
    flow.userId,
    flow.organizationId ?? undefined,
    phoneNumberId
  );
  const tpl = templates.find(
    (t) =>
      String(t.status || "").toUpperCase() === "APPROVED" &&
      (t.name === templateName || t.name.toLowerCase() === templateName.toLowerCase())
  );

  if (!tpl) {
    console.warn(
      `[Automation] Template "${templateName}" not found in synced templates for session — using configured name/language`
    );
    return {
      templateName,
      templateLanguage: configuredLanguage || "en",
      templateParams: configuredParams,
    };
  }

  const bodyComp = tpl.components?.find((c: { type?: string }) => c.type === "BODY");
  const requiredCount = countTemplateBodyParams(bodyComp?.text);
  let templateParams = configuredParams;

  if (requiredCount > 0) {
    templateParams = [...(configuredParams || [])];
    while (templateParams.length < requiredCount) templateParams.push("");
    templateParams = templateParams.slice(0, requiredCount);
    const emptySlots = templateParams
      .map((p, i) => (!p || !String(p).trim() ? i + 1 : null))
      .filter((x): x is number => x != null);
    if (emptySlots.length > 0) {
      throw new Error(
        `Template "${tpl.name}" requires ${requiredCount} body parameter(s); missing value(s) for {{${emptySlots.join("}}, {{")}}}. Fill Dynamic Fields in the flow editor.`
      );
    }
  } else {
    templateParams = undefined;
  }

  const headerComp = tpl.components?.find((c: { type?: string }) => c.type === "HEADER");
  const headerFormat = String(headerComp?.format || "").toUpperCase() || undefined;

  return {
    templateName: tpl.name,
    templateLanguage: tpl.language || configuredLanguage || "en",
    templateParams,
    headerFormat,
  };
}

async function executeWhatsAppSendTemplate(
  cfg: Record<string, unknown>,
  flow: AutomationFlow,
  runContext?: Record<string, unknown>
): Promise<void> {
  const sessionId = String(cfg.connectionId || "").trim();
  let templateName = String(cfg.templateId || cfg.templateName || "").trim();
  let to = normalizeFlowRecipientPhone(String(cfg.templateTo || cfg.to || ""));
  if (!sessionId || !templateName) {
    throw new Error("WhatsApp send template: connection (session) and template id are required");
  }
  if (!to || to.length < 10) {
    throw new Error(
      'WhatsApp send template: recipient phone is empty or invalid. For Google Sheets use {{trigger.phone}} or {{contact.phone}} in the "To" field.'
    );
  }

  const contact = runContext?.contact as Record<string, unknown> | undefined;
  const trigger = runContext?.trigger as Record<string, unknown> | undefined;
  const nameFromTrigger =
    String(contact?.name || "").trim() ||
    extractNameFromSheetRow(trigger || {});
  await ensureManagedContactForFlowRecipient(flow, to, nameFromTrigger);

  let languageCode = String(cfg.languageCode || cfg.templateLanguage || "en").trim() || "en";
  const rawParams = cfg.templateParams;
  let templateParams = Array.isArray(rawParams)
    ? rawParams.map((p) => String(p ?? ""))
    : undefined;

  const resolved = await resolveFlowTemplateSendOptions(
    flow,
    sessionId,
    templateName,
    languageCode,
    templateParams
  );
  templateName = resolved.templateName;
  languageCode = resolved.templateLanguage;
  templateParams = resolved.templateParams;

  const rawCarousel = cfg.carouselCardMediaUrls;
  const carouselCardMediaUrls = Array.isArray(rawCarousel)
    ? rawCarousel.map((u) => String(u ?? "").trim()).filter(Boolean)
    : undefined;

  const headerFormatCfg = String(cfg.headerFormat || resolved.headerFormat || "").toUpperCase();
  let headerImageUrl = String(cfg.headerImageUrl || "").trim() || undefined;
  let headerVideoUrl = String(cfg.headerVideoUrl || "").trim() || undefined;
  let headerDocumentUrl = String(cfg.headerDocumentUrl || "").trim() || undefined;

  if (headerFormatCfg === "IMAGE" && !headerImageUrl && !cfg.headerImageId) {
    if (flow.organizationId) {
      const fallback = await storage.getDefaultTemplateHeaderImageUrl(flow.organizationId, templateName);
      if (fallback) headerImageUrl = fallback;
    }
  }
  if (headerFormatCfg && headerFormatCfg !== "IMAGE") headerImageUrl = undefined;
  if (headerFormatCfg && headerFormatCfg !== "VIDEO") headerVideoUrl = undefined;
  if (headerFormatCfg && headerFormatCfg !== "DOCUMENT") headerDocumentUrl = undefined;

  const result = await sendPanelTemplateFromFlow(flow.userId, flow.organizationId ?? null, {
    sessionId,
    to,
    templateName,
    templateLanguage: languageCode,
    templateParams,
    headerImageUrl,
    headerVideoUrl,
    headerDocumentUrl,
    headerImageId: String(cfg.headerImageId || "").trim() || undefined,
    headerVideoId: String(cfg.headerVideoId || "").trim() || undefined,
    headerDocumentId: String(cfg.headerDocumentId || "").trim() || undefined,
    carouselCardMediaUrls,
  });

  // Always ensure inbox DB row (idempotent by WhatsApp message id).
  if (!result?.message?.id) {
    const session = await storage.getSession(sessionId);
    const meta = await buildAutomationTemplatePersistMeta({
      userId: flow.userId,
      organizationId: flow.organizationId ?? null,
      templateName,
      languageCode,
      templateParams,
      headerImageUrl,
      headerVideoUrl,
    });
    await persistOutboundWhatsAppMessage({
      sessionId,
      to,
      userId: flow.userId,
      organizationId: flow.organizationId ?? null,
      connectionType: session?.connectionType === "official" ? "official" : "unofficial",
      whatsappMessageId: result?.messageId ? String(result.messageId) : undefined,
      type: "template",
      body: meta.body,
      mediaUrl: meta.mediaUrl,
      templateName,
      templateLanguage: languageCode,
      templateParams,
      templateType: meta.templateType,
      headerText: meta.headerText,
      footer: meta.footer,
    });
  } else {
    console.log("[Automation] Template send stored in inbox:", result.message.id, "to=", to);
  }
}

async function executeWhatsAppSendMessage(
  cfg: Record<string, unknown>,
  flow: AutomationFlow,
  runContext?: Record<string, unknown>
): Promise<{ success: boolean; messageId?: string }> {
  const sessionId = String(cfg.connectionId || "").trim();
  let to = normalizeFlowRecipientPhone(String(cfg.messageTo || cfg.to || ""));
  const text = String(cfg.messageBody || cfg.body || cfg.text || cfg.message || "").trim();
  if (!sessionId || !to || !text) {
    throw new Error("WhatsApp send message: connection, To, and message body are required");
  }
  if (to.length < 10) {
    throw new Error(
      "WhatsApp send message: recipient phone is empty or invalid. Use {{trigger.phone}} with country code."
    );
  }

  const contact = runContext?.contact as Record<string, unknown> | undefined;
  const trigger = runContext?.trigger as Record<string, unknown> | undefined;
  const nameFromTrigger =
    String(contact?.name || "").trim() ||
    String(trigger?.name || trigger?.first_name || "").trim();
  await ensureManagedContactForFlowRecipient(flow, to, nameFromTrigger);

  const session = await storage.getSession(sessionId);
  if (!session) throw new Error("WhatsApp session not found");

  const result = await sendPanelTextFromFlow(flow.userId, flow.organizationId ?? null, {
    sessionId,
    to,
    message: text,
  });

  // Guarantee inbox storage for every flow text send.
  if (!result?.message?.id) {
    await persistOutboundWhatsAppMessage({
      sessionId,
      to,
      userId: flow.userId,
      organizationId: flow.organizationId ?? null,
      connectionType: session.connectionType === "official" ? "official" : "unofficial",
      whatsappMessageId: result?.messageId ? String(result.messageId) : undefined,
      type: "text",
      body: text,
    });
  } else {
    console.log("[Automation] Text send stored in inbox:", result.message.id, "to=", to);
  }

  return { success: true, messageId: result.messageId ? String(result.messageId) : undefined };
}

async function executeWhatsAppSendMedia(
  cfg: Record<string, unknown>,
  flow: AutomationFlow,
  runContext?: Record<string, unknown>
): Promise<{ success: boolean; messageId?: string }> {
  const sessionId = String(cfg.connectionId || "").trim();
  let to = normalizeFlowRecipientPhone(String(cfg.mediaTo || cfg.to || ""));
  const url = String(cfg.mediaUrl || "").trim();
  const mediaType = String(cfg.mediaType || "Image");
  const caption = String(cfg.mediaCaption || "").trim() || undefined;
  const fileName = String(cfg.mediaFileName || cfg.fileName || "").trim() || undefined;
  if (!sessionId || !to || !url) {
    throw new Error("WhatsApp send media: connection, To, and media URL are required");
  }

  const contact = runContext?.contact as Record<string, unknown> | undefined;
  const trigger = runContext?.trigger as Record<string, unknown> | undefined;
  const nameFromTrigger =
    String(contact?.name || "").trim() ||
    String(trigger?.name || trigger?.first_name || "").trim();
  await ensureManagedContactForFlowRecipient(flow, to, nameFromTrigger);

  const session = await storage.getSession(sessionId);
  if (!session) throw new Error("WhatsApp session not found");

  const result = await sendPanelMediaFromFlowUrl(
    flow.userId,
    flow.organizationId ?? null,
    {
      sessionId,
      to,
      mediaUrl: url,
      mediaType,
      caption,
      fileName,
    }
  );

  if (!result?.message?.id) {
    const typeRaw = mediaType.toLowerCase();
    const type =
      typeRaw.includes("video")
        ? "video"
        : typeRaw.includes("audio")
          ? "audio"
          : typeRaw.includes("document")
            ? "document"
            : "image";
    await persistOutboundWhatsAppMessage({
      sessionId,
      to,
      userId: flow.userId,
      organizationId: flow.organizationId ?? null,
      connectionType: session.connectionType === "official" ? "official" : "unofficial",
      whatsappMessageId: result?.messageId ? String(result.messageId) : undefined,
      type,
      body: caption || "[Media]",
      mediaUrl: url,
    });
  }

  return { success: true, messageId: result.messageId ? String(result.messageId) : undefined };
}

function waitForReplyMs(cfg: Record<string, unknown>): number {
  const val = Math.max(1, Math.floor(Number(cfg.timeoutValue) || 1));
  const unit = String(cfg.timeoutUnit || "Minutes").toLowerCase();
  if (unit.startsWith("week")) return val * 7 * 24 * 60 * 60 * 1000;
  if (unit.startsWith("day")) return val * 24 * 60 * 60 * 1000;
  if (unit.startsWith("hour")) return val * 60 * 60 * 1000;
  return val * 60 * 1000;
}

function normalizeFlowPhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

async function resolveOrCreateContactForPayment(
  cfg: Record<string, unknown>,
  flow: AutomationFlow,
  runContext: Record<string, unknown>
): Promise<{ contact: ManagedContact; phone: string }> {
  const to = String(cfg.paymentTo || cfg.messageTo || cfg.to || "").trim();
  const trigger = runContext.trigger as Record<string, unknown> | undefined;
  const phoneRaw =
    to ||
    String(trigger?.phone || trigger?.from || (runContext.contact as Record<string, unknown>)?.phone || "");
  const digits = normalizeFlowPhone(phoneRaw);
  if (!digits) throw new Error("Payment action: recipient phone is required (use {{trigger.phone}})");

  let contact = await resolveManagedContactForFlow(
    { ...cfg, contactIdOrPhone: digits, searchByIdOrPhone: "phone" },
    flow,
    runContext
  );

  if (!contact && flow.organizationId) {
    contact = await storage.createManagedContact(
      {
        userId: flow.userId,
        organizationId: flow.organizationId,
        name: String(trigger?.name || trigger?.first_name || "Customer"),
        phoneNumber: digits,
        source: "flow-payment",
      },
      { skipAutomation: true }
    );
  }

  if (!contact) throw new Error("Payment action: could not resolve or create contact");
  return { contact, phone: digits };
}

async function executeWhatsAppSendPaymentLink(
  cfg: Record<string, unknown>,
  flow: AutomationFlow,
  runContext: Record<string, unknown>
): Promise<{ success: boolean; token?: string; shortUrl?: string }> {
  if (!flow.organizationId) throw new Error("Payment link action requires an organization flow");

  const { contact } = await resolveOrCreateContactForPayment(cfg, flow, runContext);
  const amountMajor = parseFlowPaymentAmount(cfg.amount ?? cfg.paymentAmount, runContext.trigger as Record<string, unknown>);
  const sessionId = String(cfg.connectionId || "").trim() || undefined;

  const result = await createAndSendContactPayment({
    organizationId: flow.organizationId,
    userId: flow.userId,
    contact,
    amountMajor,
    currency: String(cfg.currency || "INR"),
    description: String(cfg.description || cfg.paymentDescription || "").trim() || undefined,
    integrationId: String(cfg.paymentIntegrationId || "").trim() || undefined,
    whatsappSessionId: sessionId,
    panelBaseUrl: PANEL_BASE_URL,
    sendWhatsApp: cfg.sendWhatsApp !== false,
  });

  return { success: true, token: result.token, shortUrl: result.shortUrl };
}

async function executeWhatsAppNativePay(
  cfg: Record<string, unknown>,
  flow: AutomationFlow,
  runContext: Record<string, unknown>
): Promise<{ success: boolean; messageId?: string; fallback?: string }> {
  if (!flow.organizationId) throw new Error("WhatsApp Pay action requires an organization flow");

  const sessionId = String(cfg.connectionId || "").trim();
  if (!sessionId) throw new Error("WhatsApp Pay: connection (session) is required");

  const settings = await storage.getOrganizationCommerceSettings(flow.organizationId);
  const configName = settings?.metaPaymentConfigurationName?.trim();
  const nativeEnabled = settings?.whatsappNativePayEnabled;

  const amountMajor = parseFlowPaymentAmount(cfg.amount ?? cfg.paymentAmount, runContext.trigger as Record<string, unknown>);
  const { phone } = await resolveOrCreateContactForPayment(cfg, flow, runContext);

  if (!nativeEnabled || !configName) {
    if (cfg.fallbackToPaymentLink === false) {
      throw new Error("WhatsApp native pay not configured — enable in Commerce or allow fallback");
    }
    const link = await executeWhatsAppSendPaymentLink(cfg, flow, runContext);
    return { fallback: "payment_link", ...link };
  }

  const { manager } = await ensureWhatsAppBusinessReady(sessionId, flow);
  if (!manager.isClientReady(sessionId)) {
    throw new Error("WhatsApp Business session not ready for native pay");
  }

  const amountMinor = Math.round(amountMajor * 100);
  const itemName = String(cfg.itemName || cfg.description || "Order payment").slice(0, 60);
  const referenceId = String(cfg.referenceId || `flow-${flow.id}-${Date.now()}`).slice(0, 64);

  const result = await sendWhatsAppNativePaymentMessage({
    sessionId,
    to: phone,
    referenceId,
    bodyText: String(cfg.bodyText || cfg.message || `Pay ${amountMajor}`).slice(0, 1024),
    currency: String(cfg.currency || "INR"),
    items: [{ name: itemName, amountMinor, quantity: 1 }],
    paymentConfigurationName: configName,
    paymentGateway: settings?.metaPaymentGateway === "payu" ? "payu" : "razorpay",
  });

  const session = await storage.getSession(sessionId);
  await persistOutboundWhatsAppMessage({
    sessionId,
    to: phone,
    userId: flow.userId,
    organizationId: flow.organizationId ?? null,
    connectionType: session?.connectionType === "official" ? "official" : "unofficial",
    whatsappMessageId: result?.messageId ? String(result.messageId) : undefined,
    type: "text",
    body: String(cfg.bodyText || cfg.message || `Pay ${amountMajor}`).slice(0, 1024),
  });

  return { success: true, messageId: result.messageId };
}

async function executeWhatsAppSendCollection(
  cfg: Record<string, unknown>,
  flow: AutomationFlow,
  runContext: Record<string, unknown>
): Promise<{ success: boolean; messageId?: string; productCount?: number }> {
  if (!flow.organizationId) throw new Error("Send collection requires an organization flow");

  const sessionId = String(cfg.connectionId || "").trim();
  const collectionId = String(cfg.collectionId || "").trim();
  const to = String(cfg.messageTo || cfg.to || "").trim();
  if (!sessionId || !collectionId || !to) {
    throw new Error("Send collection: session, collection ID, and recipient are required");
  }

  const settings = await storage.getOrganizationCommerceSettings(flow.organizationId);
  const catalogId = settings?.metaCatalogId?.trim();
  if (!catalogId) throw new Error("Meta catalog ID not configured in Commerce settings");

  const payload = await getCollectionCatalogSendPayload({
    organizationId: flow.organizationId,
    collectionId,
    body: String(cfg.body || cfg.messageBody || "Browse this collection"),
    sectionTitle: String(cfg.sectionTitle || cfg.collectionTitle || "Collection"),
  });

  const { session, manager } = await ensureWhatsAppBusinessReady(sessionId, flow);
  const api = manager as typeof businessAPIManager;
  const result = await api.sendProductListMessage(sessionId, to, {
    catalogId,
    body: payload.body,
    sections: [
      {
        title: payload.sectionTitle,
        productRetailerIds: payload.productRetailerIds,
      },
    ],
  });

  await persistOutboundWhatsAppMessage({
    sessionId,
    to,
    userId: session.userId,
    organizationId: flow.organizationId ?? null,
    connectionType: session.connectionType,
    whatsappMessageId: result?.id ? String(result.id) : undefined,
    type: "text",
    body: payload.body,
  });

  return {
    success: true,
    messageId: result?.id ? String(result.id) : undefined,
    productCount: payload.productRetailerIds.length,
  };
}

async function executeWaitForReply(cfg: Record<string, unknown>): Promise<{ success: boolean; replyPhone: string }> {
  const replyPhone = String(cfg.replyPhone || "").trim();
  const cap = 5 * 60 * 1000;
  await sleep(Math.min(waitForReplyMs(cfg), cap));
  return { success: true, replyPhone };
}

function setStepOutput(runContext: Record<string, unknown>, nodeId: string, output: Record<string, unknown>): void {
  runContext[nodeId] = output;
}

async function executeSingleActionNode(
  node: FlowNode,
  flow: AutomationFlow,
  runContext: Record<string, unknown>,
  flowLabel: string
): Promise<void> {
  const data = (node.data || {}) as Record<string, unknown>;
  const rawCfg = (data.config as Record<string, unknown>) || {};
  const cfg = deepInterpolateConfig(rawCfg, runContext) as Record<string, unknown>;
  const actionId = String(data.selectedActionId || "");
  const selectedAction = String(data.selectedAction || "").toLowerCase();

  if (
    actionId === "delay-for" ||
    actionId === "delay-until" ||
    selectedAction.includes("delay")
  ) {
    console.warn(
      `[Automation] ${flowLabel} delay node ${node.id} should be handled by the graph walker`
    );
    return;
  }

  if (actionId === "create-contact") {
    const created = await executeContactCreate(cfg, flow, runContext);
    setStepOutput(runContext, node.id, { success: true, contactId: created.id });
    return;
  }
  if (actionId === "update-contact") {
    const updated = await executeContactUpdate(cfg, flow, runContext);
    setStepOutput(runContext, node.id, { success: !!updated, contactId: updated?.id });
    return;
  }
  if (actionId === "get-contact") {
    const c = await executeContactGet(cfg, flow, runContext);
    setStepOutput(runContext, node.id, { success: true, contactId: c?.id });
    return;
  }
  if (actionId === "add-note") {
    await executeContactAddNote(cfg, flow, runContext);
    setStepOutput(runContext, node.id, { success: true });
    return;
  }
  if (actionId === "add-tag") {
    const out = await executeContactAddTag(cfg, flow, runContext);
    setStepOutput(runContext, node.id, { success: true, ...out });
    return;
  }
  if (actionId === "auto-assign-contact") {
    const updated = await executeContactAutoAssign(cfg, flow, runContext);
    setStepOutput(runContext, node.id, { success: !!updated, contactId: updated?.id });
    return;
  }
  if (actionId === "custom-request-contact") {
    const out = await executeHttpCustomRequest(cfg);
    setStepOutput(runContext, node.id, out);
    return;
  }

  const connId = String(cfg.connectionId || "").trim();
  const needsConn = [
    "openai-chat",
    "openai-generate",
    "gemini-generate",
    "gemini-chat",
    "create-spreadsheet-row",
    "create-google-contact",
    "cancel-event",
  ];
  if (
    !connId &&
    (needsConn.includes(actionId) ||
      (actionId === "custom-request" &&
        String(cfg.url || "")
          .toLowerCase()
          .includes("api.calendly.com")))
  ) {
    console.warn(`[Automation] ${flowLabel} node ${node.id}: missing connectionId, skip`);
    return;
  }

  if (actionId === "openai-chat" || actionId === "openai-generate") {
    const integ = await storage.getIntegrationById(connId);
    if (!integ || integ.name !== "openai") throw new Error("OpenAI integration not found");
    assertIntegrationAllowedForFlow(integ, flow);
    setStepOutput(runContext, node.id, await executeOpenAIChat(cfg, integ));
    return;
  }

  if (actionId === "gemini-generate" || actionId === "gemini-chat") {
    const integ = await storage.getIntegrationById(connId);
    if (!integ || integ.name !== "google-gemini") throw new Error("Gemini integration not found");
    assertIntegrationAllowedForFlow(integ, flow);
    setStepOutput(runContext, node.id, await executeGemini(cfg, integ));
    return;
  }

  if (actionId === "create-spreadsheet-row") {
    const integ = await storage.getIntegrationById(connId);
    if (!integ || integ.name !== "google-sheets") throw new Error("Google Sheets integration not found");
    assertIntegrationAllowedForFlow(integ, flow);
    await executeSheetsAppendRow(cfg, integ);
    setStepOutput(runContext, node.id, { success: true });
    return;
  }

  if (actionId === "create-google-contact") {
    const integ = await storage.getIntegrationById(connId);
    if (!integ || integ.name !== "google-contacts") throw new Error("Google Contacts integration not found");
    assertIntegrationAllowedForFlow(integ, flow);
    await executeGoogleCreateContact(cfg, integ);
    setStepOutput(runContext, node.id, { success: true });
    return;
  }

  if (actionId === "cancel-event") {
    const integ = await storage.getIntegrationById(connId);
    if (!integ || integ.name !== "calendly") throw new Error("Calendly integration not found");
    assertIntegrationAllowedForFlow(integ, flow);
    setStepOutput(runContext, node.id, await executeCalendlyCancel(cfg, integ));
    return;
  }

  if (actionId === "custom-request") {
    const url = String(cfg.url || "").toLowerCase();
    if (url.includes("api.calendly.com")) {
      const integ = await storage.getIntegrationById(connId);
      if (!integ || integ.name !== "calendly") throw new Error("Calendly integration not found");
      assertIntegrationAllowedForFlow(integ, flow);
      setStepOutput(runContext, node.id, await executeCalendlyCustom(cfg, integ));
      return;
    }
    setStepOutput(runContext, node.id, await executeHttpCustomRequest(cfg));
    return;
  }

  if (actionId === "send-template" || selectedAction.includes("send template")) {
    await executeWhatsAppSendTemplate(cfg, flow, runContext);
    setStepOutput(runContext, node.id, { success: true });
    return;
  }

  if (actionId === "send-message" || selectedAction === "send message") {
    setStepOutput(runContext, node.id, await executeWhatsAppSendMessage(cfg, flow, runContext));
    return;
  }

  if (actionId === "send-media" || selectedAction === "send media") {
    setStepOutput(runContext, node.id, await executeWhatsAppSendMedia(cfg, flow, runContext));
    return;
  }

  if (actionId === "wait-for-reply" || selectedAction === "wait for reply") {
    setStepOutput(runContext, node.id, await executeWaitForReply(cfg));
    return;
  }

  if (actionId === "send-payment-link" || selectedAction.includes("payment link")) {
    setStepOutput(
      runContext,
      node.id,
      await executeWhatsAppSendPaymentLink(cfg, flow, runContext)
    );
    return;
  }

  if (actionId === "send-whatsapp-pay" || selectedAction.includes("whatsapp pay")) {
    setStepOutput(runContext, node.id, await executeWhatsAppNativePay(cfg, flow, runContext));
    return;
  }

  if (actionId === "send-collection" || selectedAction.includes("send collection")) {
    setStepOutput(runContext, node.id, await executeWhatsAppSendCollection(cfg, flow, runContext));
    return;
  }

  console.warn(
    `[Automation] ${flowLabel} skip node ${node.id} action ${actionId || selectedAction} (not implemented in runner)`
  );
  setStepOutput(runContext, node.id, {
    ok: false,
    error: `Action "${actionId || selectedAction}" is not implemented`,
  });
}

async function executeFlowFromNode(
  nodeId: string,
  nodes: FlowNode[],
  edges: FlowEdge[],
  flow: AutomationFlow,
  runContext: Record<string, unknown>,
  flowLabel: string,
  visited: Set<string>,
  runId?: string
): Promise<boolean> {
  if (visited.has(nodeId)) return false;
  visited.add(nodeId);

  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return false;

  if (node.type === "router") {
    const rawCfg = ((node.data || {}) as Record<string, unknown>).config as Record<string, unknown> | undefined;
    const cfg = deepInterpolateConfig(rawCfg || {}, runContext) as Record<string, unknown>;
    const matchedEdges = pickRouterEdges(edges, nodeId, cfg, runContext);
    for (const edge of matchedEdges) {
      if (await executeFlowFromNode(edge.target, nodes, edges, flow, runContext, flowLabel, visited, runId)) {
        return true;
      }
    }
    return false;
  }

  if (node.type === "action" && isDelayActionNode(node)) {
    return handleGraphDelayNode(
      node,
      nodeId,
      nodes,
      edges,
      flow,
      runContext,
      flowLabel,
      visited,
      runId
    );
  }

  if (node.type === "action") {
    await executeActionNodeWithPolicy(node, flow, runContext, flowLabel, runId);
    for (const e of sortOutgoingEdges(nodeId, edges, nodes)) {
      if (await executeFlowFromNode(e.target, nodes, edges, flow, runContext, flowLabel, visited, runId)) {
        return true;
      }
    }
    return false;
  }

  for (const e of sortOutgoingEdges(nodeId, edges, nodes)) {
    if (await executeFlowFromNode(e.target, nodes, edges, flow, runContext, flowLabel, visited, runId)) {
      return true;
    }
  }
  return false;
}

export async function resumeAutomationFlowFromScheduledRun(
  scheduledRun: AutomationFlowScheduledRun
): Promise<void> {
  const flow = await storage.getAutomationFlowById(scheduledRun.flowId);
  const runId = scheduledRun.runId ?? undefined;
  if (!flow || flow.status !== "active") {
    await storage.cancelAutomationFlowScheduledRun(
      scheduledRun.id,
      flow ? "flow_not_active" : "flow_not_found"
    );
    if (runId) {
      await failAutomationFlowRun(runId, flow ? "flow_not_active" : "flow_not_found");
    }
    return;
  }

  const flowLabel = flow.name || flow.id;
  const runContext = (scheduledRun.runContext || {}) as Record<string, unknown>;
  const visited = new Set<string>(scheduledRun.visitedNodeIds || []);
  const nextNodeId = scheduledRun.nextNodeId;

  if (runId) {
    await markAutomationFlowRunRunning(runId);
  }

  try {
    if (!nextNodeId) {
      await storage.completeAutomationFlowScheduledRun(scheduledRun.id);
      if (runId) await completeAutomationFlowRun(runId);
      console.log(`[Automation] ${flowLabel} delay resume — no next node, run complete`);
      return;
    }

    const nodes = (flow.nodes || []) as FlowNode[];
    const edges = (flow.edges || []) as FlowEdge[];
    if (!nodes.some((n) => n.id === nextNodeId)) {
      await storage.cancelAutomationFlowScheduledRun(scheduledRun.id, "next_node_missing");
      if (runId) await failAutomationFlowRun(runId, "next_node_missing");
      return;
    }

    console.log(
      `[Automation] ${flowLabel} resuming after delay at node ${nextNodeId}`
    );
    const paused = await executeFlowFromNode(
      nextNodeId,
      nodes,
      edges,
      flow,
      runContext,
      flowLabel,
      visited,
      runId
    );
    await storage.completeAutomationFlowScheduledRun(scheduledRun.id);
    if (!paused && runId) {
      await completeAutomationFlowRun(runId);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[Automation] ${flowLabel} resume failed:`, msg);
    await storage.failAutomationFlowScheduledRun(scheduledRun.id, msg);
    if (runId) await failAutomationFlowRun(runId, msg);
    throw e instanceof Error ? e : new Error(msg);
  }
}

export async function runAutomationFlowFromTrigger(params: {
  flow: AutomationFlow;
  startTriggerNodeId: string;
  contextRoot: Record<string, unknown>;
}): Promise<void> {
  const { flow, startTriggerNodeId, contextRoot } = params;
  const flowLabel = flow.name || flow.id;
  const runContext: Record<string, unknown> = { ...contextRoot };
  const triggerNode = ((flow.nodes || []) as FlowNode[]).find((n) => n.id === startTriggerNodeId);
  const triggerType = String(triggerNode?.data?.selectedTrigger || "");
  await enrichSpreadsheetRunContext(flow, triggerType, runContext);
  const runId = await startAutomationFlowRun({
    flow,
    triggerNodeId: startTriggerNodeId,
    triggerType,
    contextRoot,
  });

  try {
    const linearResult = await executeLinearFlowSteps(flow, runContext, flowLabel, runId);
    if (linearResult === "scheduled") {
      return;
    }
    if (linearResult === "completed") {
      await completeAutomationFlowRun(runId);
      return;
    }

    const nodes = (flow.nodes || []) as FlowNode[];
    const edges = (flow.edges || []) as FlowEdge[];
    const visited = new Set<string>();
    const paused = await executeFlowFromNode(
      startTriggerNodeId,
      nodes,
      edges,
      flow,
      runContext,
      flowLabel,
      visited,
      runId
    );
    if (!paused) {
      await completeAutomationFlowRun(runId);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[Automation] ${flowLabel} stopped after send failure:`, msg);
    await failAutomationFlowRun(runId, msg);
  }
}
