import type { Express } from "express";
import { isAuthenticated } from "../replitAuth";
import { isSaaSOwner } from "../middleware/admin-auth";
import { readEnvFile, updateEnvFile, getEnvValue } from "../env-file";
import { pingPanelApi } from "../updates";

export function registerAdminEnvRoutes(app: Express) {
  // Admin: .env viewer and editor (SaaS owner only)
  app.get("/api/admin/env", isAuthenticated, isSaaSOwner, async (_req, res) => {
    try {
      const result = readEnvFile();
      if (result.error) return res.status(500).json({ message: result.error });
      res.json({ entries: result.entries });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to read .env" });
    }
  });
  
  app.get("/api/admin/env/value", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const key = req.query?.key;
      if (!key || typeof key !== "string") return res.status(400).json({ message: "key query required" });
      const value = getEnvValue(key.trim());
      if (value === null) return res.status(404).json({ message: "Key not found" });
      res.json({ value });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to read value" });
    }
  });
  
  app.patch("/api/admin/env", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const body = req.body;
      const entries = Array.isArray(body?.entries) ? body.entries : [];
      if (entries.length === 0) return res.status(400).json({ message: "entries array required" });
      const updates = entries
        .filter((e: any) => e && typeof e.key === "string" && e.key.trim())
        .map((e: any) => ({ key: String(e.key).trim(), value: e.value != null ? String(e.value) : "" }));
      if (updates.length === 0) return res.status(400).json({ message: "No valid key-value pairs" });
      const result = updateEnvFile(updates);
      if (!result.success) return res.status(500).json({ message: result.error });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to update .env" });
    }
  });

  // Admin: panel API connectivity check (for deploy/sync debugging)
  app.get("/api/admin/panel-status", isAuthenticated, isSaaSOwner, async (_req, res) => {
    try {
      const result = await pingPanelApi();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ ok: false, configured: true, error: err?.message || "Check failed" });
    }
  });
}
