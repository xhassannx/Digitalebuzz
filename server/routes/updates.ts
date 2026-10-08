import type { Express } from "express";
import { isAuthenticated } from "../replitAuth";
import { isSaaSOwner } from "../middleware/admin-auth";
import { getUpdateStatus, runSyncAndRestart, fetchCustomerFromApi, pingPanelApi } from "../updates";

export function registerUpdatesRoutes(app: Express) {
  /** GET /api/panel/customer-status – for frontend to show active or block page (inactive/expired). Same 403 body when blocked. */
  app.get("/api/panel/customer-status", async (_req, res) => {
    res.json({ status: "active" });
  });

  // Updates: fetch from GitHub, build, restart PM2 (SaaS owner only)
  app.get("/api/updates/status", isAuthenticated, isSaaSOwner, async (_req, res) => {
    try {
      const status = await getUpdateStatus();
      res.json(status);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to get update status" });
    }
  });

  /** Customer from panel API (sanitized: no token/password). Used by Admin > Updates to show which repo/customer is linked. */
  app.get("/api/updates/customer", isAuthenticated, isSaaSOwner, async (_req, res) => {
    try {
      const customer = await fetchCustomerFromApi();
      if (!customer) {
        return res.json(null);
      }
      const sanitized = {
        id: customer.id,
        business_name: customer.business_name,
        domain: customer.domain,
        github_repo_url: customer.github_repo_url,
        subscription_end: customer.subscription_end,
        days_remaining: customer.days_remaining,
        webhook_url: customer.webhook_url,
        is_active: customer.is_active,
      };
      res.json(sanitized);
    } catch {
      res.json(null);
    }
  });

  app.post("/api/updates/sync", isAuthenticated, isSaaSOwner, async (_req, res) => {
    try {
      const result = await runSyncAndRestart();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({
        success: false,
        steps: [],
        error: err?.message || "Sync failed",
      });
    }
  });

  // Remote deploy API: customer portal (CUSTOMER_API_BASE_URL) can trigger sync using PRODUCTION_KEY (two-way auto sync)
  const requireProductionKey = (req: any, res: any, next: () => void) => {
    const key = process.env.PRODUCTION_KEY?.trim();
    if (!key) {
      return res.status(503).json({ error: "Remote deploy not configured (PRODUCTION_KEY missing)" });
    }
    const provided =
      req.headers["x-production-key"]?.trim() ||
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice(7).trim()
        : "");
    if (provided !== key) {
      return res.status(401).json({ error: "Invalid or missing PRODUCTION_KEY" });
    }
    next();
  };

  /** GET /api/updates/status-remote – panel update status (for customer portal). Auth: X-Production-Key or Authorization: Bearer PRODUCTION_KEY */
  app.get("/api/updates/status-remote", requireProductionKey, async (_req, res) => {
    try {
      const status = await getUpdateStatus();
      res.json(status);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to get update status" });
    }
  });

  /** POST /api/updates/sync-remote – trigger deploy/sync from customer portal. Auth: X-Production-Key or Authorization: Bearer PRODUCTION_KEY */
  app.post("/api/updates/sync-remote", requireProductionKey, async (_req, res) => {
    try {
      const result = await runSyncAndRestart();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({
        success: false,
        steps: [],
        error: err?.message || "Sync failed",
      });
    }
  });
}
