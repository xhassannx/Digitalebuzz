// @ts-nocheck
/**
 * One-click "Demo" chatbot: On Message → 10 × Ask Question → Append to Google Sheet.
 * Uses the tenant's first connected Google Sheets integration and first WhatsApp session.
 */
import { randomUUID } from "crypto";
import type { Chatbot, ChatbotNode, InsertChatbot, InsertChatbotNode, Integration } from "@shared/schema";
import { storage } from "../storage";

export const DEMO_GOOGLE_SHEET_NAME_PREFIX = "Demo: Google Sheet";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const SHEETS_API = "https://sheets.googleapis.com/v4";
const NUM_QUESTIONS = 10;

async function getAccessTokenForIntegration(integration: Integration): Promise<string> {
  const creds = (integration.credentials || {}) as Record<string, unknown>;
  const expiresAt = Number(creds.expires_at) || 0;
  if (expiresAt && Date.now() < expiresAt - 60_000 && typeof creds.access_token === "string") {
    return creds.access_token;
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
    if (!res.ok) return typeof creds.access_token === "string" ? (creds.access_token as string) : "";
    const tokens = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!tokens.access_token) throw new Error("Google token refresh failed");
    creds.access_token = tokens.access_token;
    creds.expires_at = Date.now() + (Number(tokens.expires_in) || 3600) * 1000;
    await storage.updateIntegration(integration.id, integration.userId, { credentials: creds as Record<string, unknown> });
    return tokens.access_token;
  }
  if (typeof creds.access_token === "string") return creds.access_token;
  throw new Error("No Google access token");
}

/** Pick first spreadsheet + first worksheet tab so tenants can test immediately when Drive API works. */
async function tryPickFirstSpreadsheetAndWorksheet(integration: Integration): Promise<{ spreadsheetId: string; worksheetId: string } | null> {
  try {
    const token = await getAccessTokenForIntegration(integration);
    const auth = `Bearer ${token}`;
    const q = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
    const listUrl = `${DRIVE_API}/files?q=${q}&pageSize=5&fields=files(id,name)`;
    const listRes = await fetch(listUrl, { headers: { Authorization: auth } });
    if (!listRes.ok) return null;
    const listData = (await listRes.json()) as { files?: Array<{ id?: string }> };
    const id = listData.files?.[0]?.id;
    if (!id) return null;
    const metaRes = await fetch(`${SHEETS_API}/spreadsheets/${encodeURIComponent(id)}?fields=sheets.properties`, {
      headers: { Authorization: auth },
    });
    if (!metaRes.ok) return null;
    const meta = (await metaRes.json()) as { sheets?: Array<{ properties?: { sheetId?: number } }> };
    const sheetId = meta.sheets?.[0]?.properties?.sheetId;
    return {
      spreadsheetId: id,
      worksheetId: sheetId != null ? String(sheetId) : "",
    };
  } catch {
    return null;
  }
}

function buildDemoQuestionTexts(): string[] {
  return Array.from({ length: NUM_QUESTIONS }, (_, i) => {
    const n = i + 1;
    return `Step ${n} of ${NUM_QUESTIONS} — Please reply with any short text for demo answer ${n}.`;
  });
}

export async function createDemoGoogleSheetChatbot(params: {
  userId: string;
  organizationId: string | null | undefined;
}): Promise<{ chatbot: Chatbot; nodes: ChatbotNode[] }> {
  const { userId, organizationId } = params;

  let integrationsList = await storage.getIntegrationsByUser(userId, organizationId || undefined);
  let sheetsConn = integrationsList.find((i) => i.name === "google-sheets" && i.status === "connected");

  if (!sheetsConn && organizationId) {
    const orgInts = await storage.getIntegrationsByOrganization(organizationId);
    sheetsConn = orgInts.find((i) => i.name === "google-sheets" && i.status === "connected");
  }

  if (!sheetsConn) {
    throw new Error(
      "No connected Google Sheets integration found. Open Integrations → Google Sheets and connect your account first."
    );
  }

  let sessions = organizationId ? await storage.getSessionsByOrganization(organizationId) : [];
  if (sessions.length === 0) {
    sessions = await storage.getSessionsByUser(userId);
  }
  if (sessions.length === 0) {
    throw new Error("No WhatsApp number/session found. Connect WhatsApp in the panel before creating this demo.");
  }
  const sessionId = sessions[0].sessionId;

  const picked = await tryPickFirstSpreadsheetAndWorksheet(sheetsConn);

  const triggerId = randomUUID();
  const questionIds = Array.from({ length: NUM_QUESTIONS }, () => randomUUID());
  const sheetNodeId = randomUUID();
  const prompts = buildDemoQuestionTexts();

  const row: Record<string, string> = {
    Phone: "{{onMessage.senderId}}",
    Name: "{{onMessage.senderName}}",
  };
  for (let i = 0; i < NUM_QUESTIONS; i++) {
    row[`Reply ${String(i + 1).padStart(2, "0")}`] = `{{${questionIds[i]}.answer}}`;
  }

  const nodes: InsertChatbotNode[] = [];

  nodes.push({
    id: triggerId,
    nodeType: "trigger",
    position: { x: 60, y: 160 },
    data: {
      nodeType: "trigger",
      messageType: "text",
      keywords: [],
      fuzzyMatching: true,
      triggerSessionIds: [sessionId],
      triggerSessionId: sessionId,
      triggerPhoneNumberId: "",
      triggerDisplayPhoneNumber: "",
      triggerConnectionType: "",
    },
    connections: [{ from: triggerId, to: questionIds[0] }],
  });

  for (let i = 0; i < NUM_QUESTIONS; i++) {
    const id = questionIds[i];
    const nextTo = i < NUM_QUESTIONS - 1 ? questionIds[i + 1] : sheetNodeId;
    nodes.push({
      id,
      nodeType: "ask_question",
      position: { x: 120 + (i + 1) * 280, y: 160 },
      data: {
        nodeType: "ask_question",
        message: prompts[i],
        responseFormat: "text",
        validationMessage: "",
        retryCount: 3,
        timeoutValue: 600,
        timeoutUnit: "seconds",
        timeoutMessage: "",
        continueOnTimeout: false,
      },
      connections: [{ from: id, to: nextTo }],
    });
  }

  nodes.push({
    id: sheetNodeId,
    nodeType: "append_google_sheet",
    position: { x: 120 + (NUM_QUESTIONS + 1) * 280, y: 160 },
    data: {
      nodeType: "append_google_sheet",
      connectionId: sheetsConn.id,
      driveId: "root",
      spreadsheetId: picked?.spreadsheetId ?? "",
      worksheetId: picked?.worksheetId ?? "",
      row,
    },
    connections: [],
  });

  const insertPayload: InsertChatbot = {
    userId,
    organizationId: organizationId ?? null,
    name: `${DEMO_GOOGLE_SHEET_NAME_PREFIX} (${NUM_QUESTIONS} questions — ${new Date().toISOString().slice(0, 10)})`,
    status: "published",
    sessionId,
  };

  const chatbot = await storage.createChatbot(insertPayload);
  const inserted = await storage.upsertChatbotNodes(chatbot.id, nodes);
  return { chatbot, nodes: inserted };
}
