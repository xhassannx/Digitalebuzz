import type { AutomationFlow } from "@shared/schema";
import { buildSheetRowTriggerFields } from "@shared/google-sheets-row";
import { getValidGoogleAccessToken } from "../integrations/google-token";
import { storage } from "../storage";
import { runAutomationFlowFromTrigger } from "./executor";
import { buildWebhookContextRoot } from "./webhook-context";

const SHEETS_API = "https://sheets.googleapis.com/v4";

type FlowNode = {
  id: string;
  type?: string;
  data?: {
    selectedTrigger?: string;
    config?: {
      connectionId?: string;
      spreadsheetId?: string;
      worksheetId?: string;
    };
  };
};

const rowCountByKey = new Map<string, number>();
const headerRowBySheetKey = new Map<string, string[]>();

async function getSheetsAccessToken(integration: {
  id: string;
  userId: string;
  credentials: Record<string, unknown> | null;
}): Promise<string> {
  return getValidGoogleAccessToken(integration);
}

async function resolveWorksheetTitle(
  auth: string,
  spreadsheetId: string,
  sheetId?: string
): Promise<string> {
  const metaRes = await fetch(
    `${SHEETS_API}/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
    { headers: { Authorization: auth } }
  );
  if (!metaRes.ok) throw new Error(`Sheets meta error: ${metaRes.status}`);
  const meta = await metaRes.json();
  const sheets = (meta.sheets || []) as Array<{ properties?: { sheetId?: number; title?: string } }>;
  if (sheetId != null && String(sheetId).trim() !== "") {
    const want = Number(sheetId);
    const found = sheets.find((s) => Number(s.properties?.sheetId) === want);
    if (found?.properties?.title) return String(found.properties.title);
  }
  return String(sheets[0]?.properties?.title || "Sheet1");
}

async function fetchSheetRowCount(
  auth: string,
  spreadsheetId: string,
  worksheetTitle: string
): Promise<number> {
  const safeTitle = worksheetTitle.replace(/'/g, "''");
  const range = `'${safeTitle}'!A:A`;
  const url = `${SHEETS_API}/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, { headers: { Authorization: auth } });
  if (!res.ok) throw new Error(`Sheets values error: ${res.status}`);
  const data = await res.json();
  const rows = (data.values as unknown[][]) || [];
  return rows.length;
}

async function fetchSheetHeaderRow(
  auth: string,
  spreadsheetId: string,
  worksheetTitle: string
): Promise<string[]> {
  const sheetKey = `${spreadsheetId}:${worksheetTitle}`;
  const cached = headerRowBySheetKey.get(sheetKey);
  if (cached) return cached;

  const safeTitle = worksheetTitle.replace(/'/g, "''");
  const range = `'${safeTitle}'!1:1`;
  const url = `${SHEETS_API}/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, { headers: { Authorization: auth } });
  if (!res.ok) {
    headerRowBySheetKey.set(sheetKey, []);
    return [];
  }
  const data = await res.json();
  const row = ((data.values as unknown[][]) || [])[0] || [];
  const headers = row.map((c) => (c == null ? "" : String(c)));
  headerRowBySheetKey.set(sheetKey, headers);
  return headers;
}

async function fetchSheetRow(
  auth: string,
  spreadsheetId: string,
  worksheetTitle: string,
  rowIndex1Based: number,
  headers: string[]
): Promise<Record<string, unknown>> {
  const safeTitle = worksheetTitle.replace(/'/g, "''");
  const range = `'${safeTitle}'!${rowIndex1Based}:${rowIndex1Based}`;
  const url = `${SHEETS_API}/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, { headers: { Authorization: auth } });
  if (!res.ok) return buildSheetRowTriggerFields(headers, [], rowIndex1Based);
  const data = await res.json();
  const cells = ((data.values as unknown[][]) || [])[0] || [];
  return buildSheetRowTriggerFields(headers, cells, rowIndex1Based);
}

async function pollSpreadsheetRowTriggers(): Promise<void> {
  if (process.env.AUTOMATION_FLOWS_ENABLED === "false") return;

  const flows = await storage.getAllActiveAutomationFlows();

  for (const flow of flows) {
    const nodes = (flow.nodes || []) as FlowNode[];
    for (const node of nodes) {
      if (node.type !== "trigger" || node.data?.selectedTrigger !== "new-spreadsheet-rows") continue;

      const config = node.data?.config;
      const connectionId = config?.connectionId;
      const spreadsheetId = config?.spreadsheetId;
      if (!connectionId || !spreadsheetId) continue;

      try {
        const integration = await storage.getIntegrationById(connectionId);
        if (!integration || integration.name !== "google-sheets" || integration.status !== "connected") {
          continue;
        }

        const token = await getSheetsAccessToken({
          id: integration.id,
          userId: integration.userId,
          credentials: integration.credentials as Record<string, unknown> | null,
        });
        const auth = `Bearer ${token}`;
        const title = await resolveWorksheetTitle(auth, spreadsheetId, config?.worksheetId);
        const headers = await fetchSheetHeaderRow(auth, spreadsheetId, title);
        const rowCount = await fetchSheetRowCount(auth, spreadsheetId, title);
        const key = `${flow.id}:${node.id}:${spreadsheetId}:${title}`;
        const prev = rowCountByKey.get(key);

        if (prev === undefined) {
          rowCountByKey.set(key, rowCount);
          continue;
        }

        if (rowCount <= prev) continue;

        for (let r = prev + 1; r <= rowCount; r++) {
          const rowData = await fetchSheetRow(auth, spreadsheetId, title, r, headers);
          const body = { row: rowData, spreadsheetId, worksheet: title, rowIndex: r, headers };
          const contextRoot = buildWebhookContextRoot(body, "new-spreadsheet-rows");
          console.log(`[Automation] new-spreadsheet-rows → flow ${flow.id} row ${r}`);
          await runAutomationFlowFromTrigger({
            flow: flow as AutomationFlow,
            startTriggerNodeId: node.id,
            contextRoot,
          });
        }
        rowCountByKey.set(key, rowCount);
      } catch (e: unknown) {
        console.error(`[Sheets poller] flow ${flow.id} node ${node.id}:`, e);
      }
    }
  }
}

export function startSheetsPoller(): void {
  const intervalMs = Number(process.env.SHEETS_POLLER_INTERVAL_MS || 120_000);
  const run = () => {
    pollSpreadsheetRowTriggers().catch((e) => console.error("[Sheets poller]", e));
  };
  setTimeout(run, 30_000);
  setInterval(run, intervalMs);
  console.log(`[Sheets poller] Started (tick every ${intervalMs}ms)`);
}
