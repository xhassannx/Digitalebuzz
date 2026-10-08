import type { Express } from "express";
import { isAuthenticated } from "../../replitAuth";
import { resolveOrganizationContext } from "../../middleware/organization-context";
import { storage } from "../../storage";
import {
  getValidGoogleAccessToken,
  googleTokenErrorResponse,
} from "../google-token";
import type { Integration } from "@shared/schema";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const SHEETS_API = "https://sheets.googleapis.com/v4";

function driveApiUserMessage(status: number, errText: string): {
  message: string;
  code?: string;
  activationUrl?: string;
} {
  if (status !== 403) {
    return { message: `Drive API error: ${status} ${errText.slice(0, 500)}` };
  }
  try {
    const j = JSON.parse(errText) as {
      error?: { message?: string; details?: Array<{ reason?: string; metadata?: Record<string, string> }> };
    };
    const details = j?.error?.details ?? [];
    const errInfo = details.find((d) => d?.reason === "SERVICE_DISABLED" || d?.reason === "ACCESS_NOT_CONFIGURED");
    const activationUrl = errInfo?.metadata?.activationUrl;
    const raw = j?.error?.message || errText;
    if (
      typeof raw === "string" &&
      (raw.includes("Google Drive API has not been used") || raw.includes("Drive API") && raw.includes("disabled"))
    ) {
      return {
        code: "DRIVE_API_DISABLED",
        message:
          "Google Drive API is turned off for the OAuth client’s Google Cloud project. Open Google Cloud Console → APIs & Services → Library → enable “Google Drive API” for that project, wait a few minutes, then retry.",
        activationUrl,
      };
    }
    return { message: raw, activationUrl };
  } catch {
    return { message: `Drive API error: 403 (enable Google Drive API in Google Cloud Console for your OAuth project)` };
  }
}

async function resolveGoogleSheetsIntegration(
  req: { user?: { claims?: { sub?: string } }; userId?: string; context?: { organizationId?: string } },
  connectionId: string
): Promise<Integration | undefined> {
  const userId = req.user?.claims?.sub || req.userId || "";
  const organizationId = req.context?.organizationId;

  let integration = await storage.getIntegration(connectionId, userId);
  if (!integration && organizationId) {
    const byId = await storage.getIntegrationById(connectionId);
    if (
      byId &&
      byId.organizationId === organizationId &&
      byId.name === "google-sheets" &&
      byId.status === "connected"
    ) {
      integration = byId;
    }
  }
  return integration;
}

export function registerGoogleSheetsRoutes(app: Express) {
  app.get("/api/integrations/google-sheets/drives", isAuthenticated, resolveOrganizationContext, async (req: any, res) => {
    try {
      const { connectionId } = req.query;
      if (!connectionId || typeof connectionId !== "string") {
        return res.status(400).json({ message: "connectionId is required" });
      }
      const integration = await resolveGoogleSheetsIntegration(req, connectionId);
      if (!integration || integration.name !== "google-sheets" || integration.status !== "connected" || !integration.credentials) {
        return res.status(404).json({ message: "Google Sheets integration not found or not connected" });
      }
      const token = await getValidGoogleAccessToken(integration);
      const auth = `Bearer ${token}`;

      const drives: Array<{ id: string; name: string }> = [
        { id: "root", name: "My Drive" },
      ];
      const drivesRes = await fetch(`${DRIVE_API}/drives?pageSize=100`, {
        headers: { Authorization: auth },
      });
      if (drivesRes.ok) {
        const data = await drivesRes.json();
        const items = data.drives || [];
        for (const d of items) {
          drives.push({ id: d.id, name: d.name || d.id });
        }
      }
      res.json({ drives });
    } catch (error: unknown) {
      console.error("Google Sheets drives error:", error);
      const { status, body } = googleTokenErrorResponse(error);
      res.status(status).json(body);
    }
  });

  app.get("/api/integrations/google-sheets/spreadsheets", isAuthenticated, resolveOrganizationContext, async (req: any, res) => {
    try {
      const { connectionId, driveId } = req.query;
      if (!connectionId || typeof connectionId !== "string") {
        return res.status(400).json({ message: "connectionId is required" });
      }
      const integration = await resolveGoogleSheetsIntegration(req, connectionId);
      if (!integration || integration.name !== "google-sheets" || integration.status !== "connected" || !integration.credentials) {
        return res.status(404).json({ message: "Google Sheets integration not found or not connected" });
      }
      const token = await getValidGoogleAccessToken(integration);
      const auth = `Bearer ${token}`;

      let q = "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false";
      const params = new URLSearchParams({ q, pageSize: "100", fields: "files(id,name)" });
      if (driveId && driveId !== "root") {
        params.set("driveId", driveId as string);
        params.set("supportsAllDrives", "true");
        params.set("includeItemsFromAllDrives", "true");
      }
      const url = `${DRIVE_API}/files?${params}`;
      const filesRes = await fetch(url, { headers: { Authorization: auth } });
      if (!filesRes.ok) {
        const errText = await filesRes.text();
        const parsed = driveApiUserMessage(filesRes.status, errText);
        const err = new Error(parsed.message) as Error & {
          code?: string;
          activationUrl?: string;
        };
        if (parsed.code) err.code = parsed.code;
        if (parsed.activationUrl) err.activationUrl = parsed.activationUrl;
        throw err;
      }
      const data = await filesRes.json();
      const spreadsheets = (data.files || []).map((f: any) => ({ id: f.id, name: f.name || f.id }));
      res.json({ spreadsheets });
    } catch (error: unknown) {
      console.error("Google Sheets spreadsheets error:", error);
      const tokenErr = googleTokenErrorResponse(error);
      if (tokenErr.status !== 500 || tokenErr.body.reconnectRequired) {
        return res.status(tokenErr.status).json(tokenErr.body);
      }
      const err = error as Error & { code?: string; activationUrl?: string };
      const isDriveDisabled = err?.code === "DRIVE_API_DISABLED";
      res.status(isDriveDisabled ? 422 : 500).json({
        message: err.message || "Failed to fetch spreadsheets",
        code: err.code,
        activationUrl: err.activationUrl,
      });
    }
  });

  app.get("/api/integrations/google-sheets/worksheets", isAuthenticated, resolveOrganizationContext, async (req: any, res) => {
    try {
      const { connectionId, spreadsheetId } = req.query;
      if (!connectionId || typeof connectionId !== "string" || !spreadsheetId || typeof spreadsheetId !== "string") {
        return res.status(400).json({ message: "connectionId and spreadsheetId are required" });
      }
      const integration = await resolveGoogleSheetsIntegration(req, connectionId);
      if (!integration || integration.name !== "google-sheets" || integration.status !== "connected" || !integration.credentials) {
        return res.status(404).json({ message: "Google Sheets integration not found or not connected" });
      }
      const token = await getValidGoogleAccessToken(integration);
      const auth = `Bearer ${token}`;

      const sheetMetaRes = await fetch(`${SHEETS_API}/spreadsheets/${spreadsheetId}?fields=sheets.properties`, {
        headers: { Authorization: auth },
      });
      if (!sheetMetaRes.ok) {
        const errText = await sheetMetaRes.text();
        throw new Error(`Sheets API error: ${sheetMetaRes.status} ${errText}`);
      }
      const data = await sheetMetaRes.json();
      const worksheets = (data.sheets || []).map((s: any) => {
        const p = s.properties || {};
        return { id: String(p.sheetId ?? ""), name: p.title || "Sheet" };
      });
      res.json({ worksheets });
    } catch (error: unknown) {
      console.error("Google Sheets worksheets error:", error);
      const { status, body } = googleTokenErrorResponse(error);
      res.status(status).json(body);
    }
  });

  /** First data row of a sheet (row 1) as header names — for "Fetch fields" in automations. */
  app.get("/api/integrations/google-sheets/header-row", isAuthenticated, resolveOrganizationContext, async (req: any, res) => {
    try {
      const { connectionId, spreadsheetId, sheetId } = req.query;
      if (!connectionId || typeof connectionId !== "string" || !spreadsheetId || typeof spreadsheetId !== "string") {
        return res.status(400).json({ message: "connectionId and spreadsheetId are required" });
      }
      const integration = await resolveGoogleSheetsIntegration(req, connectionId);
      if (!integration || integration.name !== "google-sheets" || integration.status !== "connected" || !integration.credentials) {
        return res.status(404).json({ message: "Google Sheets integration not found or not connected" });
      }
      const token = await getValidGoogleAccessToken(integration);
      const auth = `Bearer ${token}`;

      const metaRes = await fetch(`${SHEETS_API}/spreadsheets/${spreadsheetId}?fields=sheets.properties`, {
        headers: { Authorization: auth },
      });
      if (!metaRes.ok) {
        const errText = await metaRes.text();
        throw new Error(`Sheets API error: ${metaRes.status} ${errText}`);
      }
      const meta = await metaRes.json();
      const sheets = (meta.sheets || []) as Array<{ properties?: { sheetId?: number; title?: string } }>;
      let title = "";
      if (sheetId != null && String(sheetId).trim() !== "") {
        const want = Number(sheetId);
        const found = sheets.find((s) => Number(s.properties?.sheetId) === want);
        title = found?.properties?.title || "";
      }
      if (!title && sheets[0]?.properties?.title) {
        title = String(sheets[0].properties.title);
      }
      if (!title) {
        return res.status(400).json({ message: "Could not resolve worksheet title" });
      }

      const safeTitle = title.replace(/'/g, "''");
      const a1Range = `'${safeTitle}'!1:1`;
      const valuesUrl = `${SHEETS_API}/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(a1Range)}`;
      const valuesRes = await fetch(valuesUrl, { headers: { Authorization: auth } });
      if (!valuesRes.ok) {
        const errText = await valuesRes.text();
        throw new Error(`Sheets values error: ${valuesRes.status} ${errText}`);
      }
      const valuesData = await valuesRes.json();
      const row = (valuesData.values && valuesData.values[0]) || [];
      const headers = row.map((c: unknown) => (c == null ? "" : String(c)));
      res.json({ headers });
    } catch (error: unknown) {
      console.error("Google Sheets header-row error:", error);
      const { status, body } = googleTokenErrorResponse(error);
      res.status(status).json(body);
    }
  });
}
