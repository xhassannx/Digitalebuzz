import type { Express, RequestHandler } from "express";
import { storage } from "../storage";
import { requireProductionKey } from "../middleware/production-key";
import { fetchCustomerFromApi } from "../updates";
import {
  mergeLiveContractForOutstandingLimit,
  normalizeWhitelabelPaymentGateway,
  parseOutstandingLimitMinorFromUpstreamPayload,
} from "../whitelabel-onboarding-fee";
import { getWhitelabelCreditLineFacility } from "../whitelabel-credit-line";
import {
  mintRemoteAdminLoginToken,
  consumeRemoteAdminLoginToken,
} from "../remote-admin-login-tokens";

function panelBaseUrl(req: { get: (h: string) => string | undefined; protocol?: string; secure?: boolean }): string {
  const fromEnv = (process.env.BASE_URL || process.env.PUBLIC_APP_URL || "").split(/\s*[\n#]/)[0].trim().replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  const host = req.get("x-forwarded-host") || req.get("host");
  const xfProto = req.get("x-forwarded-proto");
  const proto = xfProto || (req.secure ? "https" : "http") || "http";
  return host ? `${proto}://${host}`.replace(/\/+$/, "") : "";
}

function resolveWhitelabelOrgId(): string | null {
  const id = (process.env.WHITELABEL_ORG_ID || process.env.VITE_WHITELABEL_ORG_ID || "").trim();
  return id || null;
}

function safeRedirectPath(raw: unknown): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) return "/admin";
  return raw;
}

/** Optional CORS for browser calls from the licensor portal (set LICENSOR_CORS_ORIGIN to exact origin). */
const corsForRemoteLicensor: RequestHandler = (req, res, next) => {
  const allow = process.env.LICENSOR_CORS_ORIGIN?.trim();
  if (!allow) return next();
  res.setHeader("Access-Control-Allow-Origin", allow);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Production-Key, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
};

function establishSaasOwnerSession(req: any, res: any, redirectPath: string | null, asJson: boolean) {
  return storage.getSaasOwnerUser().then((owner) => {
    if (!owner) {
      if (asJson) {
        return res.status(503).json({
          error: "No SaaS owner user exists on this installation (cannot impersonate admin)",
        });
      }
      return res.status(503).send("No SaaS owner user on this installation");
    }
    const userSession = {
      claims: {
        sub: owner.id,
        email: owner.email,
        first_name: owner.firstName,
        last_name: owner.lastName,
        profile_image_url: owner.profileImageUrl,
      },
      expires_at: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
    };
    req.login(userSession, (loginErr: Error | null | undefined) => {
      if (loginErr) {
        console.error("[remote] admin-login session error:", loginErr);
        if (asJson) return res.status(500).json({ error: "Failed to establish session" });
        return res.status(500).send("Failed to establish session");
      }
      if (!asJson && redirectPath) {
        return res.redirect(redirectPath);
      }
      const base = panelBaseUrl(req);
      const redirect = safeRedirectPath(redirectPath);
      const token = mintRemoteAdminLoginToken(redirect);
      const loginUrl = base
        ? `${base}/api/remote/admin-login/consume?token=${encodeURIComponent(token)}`
        : `/api/remote/admin-login/consume?token=${encodeURIComponent(token)}`;
      return res.json({
        ok: true,
        message:
          "Open login_url in the browser (panel origin) so the session cookie is set correctly. Same-origin callers also have a session on this response.",
        user: {
          id: owner.id,
          email: owner.email,
          firstName: owner.firstName,
          lastName: owner.lastName,
          isSaaSOwner: true,
        },
        suggested_redirect: redirect,
        login_url: loginUrl,
        login_token: token,
        whitelabel_org_id: resolveWhitelabelOrgId(),
      });
    });
  });
}

export function registerRemoteLicensorRoutes(app: Express) {
  app.use("/api/remote", corsForRemoteLicensor);

  /**
   * Aggregate onboarding / outstanding data for the licensor portal (server-to-server).
   * GET /api/remote/onboarding-summary
   */
  app.get("/api/remote/onboarding-summary", requireProductionKey, async (req: any, res) => {
    try {
      const base = panelBaseUrl(req);
      const master = await storage.getPlatformMasterSettings();
      const live = await fetchCustomerFromApi();
      const merged = mergeLiveContractForOutstandingLimit(master?.upstreamPayload ?? null, live);
      const up = master?.upstreamPayload;
      const limitMinor = parseOutstandingLimitMinorFromUpstreamPayload(merged);
      const outstandingMinor = await storage.getTotalOutstandingWhitelabelOnboardingMinor();
      const { fees } = await storage.getWhitelabelOnboardingFeesForAdmin({ limit: 500, offset: 0 });
      const countsByStatus: Record<string, number> = {};
      let payableLineCount = 0;
      const now = Date.now();
      for (const f of fees) {
        countsByStatus[f.status] = (countsByStatus[f.status] || 0) + 1;
        if (
          f.amountMinor > 0 &&
          (f.status === "pending" || f.status === "failed") &&
          new Date(f.dueAt).getTime() <= now
        ) {
          payableLineCount += 1;
        }
      }
      let batchPaymentGateway: "razorpay" | "cashfree" | null = null;
      if (up && typeof up === "object" && !Array.isArray(up)) {
        const v = (up as Record<string, unknown>).payment_gateway;
        batchPaymentGateway = normalizeWhitelabelPaymentGateway(typeof v === "string" ? v : "");
      }
      const billingCurrency =
        merged &&
        typeof merged === "object" &&
        !Array.isArray(merged) &&
        typeof (merged as Record<string, unknown>).billing_currency === "string"
          ? String((merged as Record<string, unknown>).billing_currency)
          : null;

      let creditLineFacility: Record<string, unknown> | null = null;
      try {
        const facility = await getWhitelabelCreditLineFacility();
        creditLineFacility = {
          configured: facility.configured,
          enabled: facility.enabled,
          balance_minor: facility.balanceMinor,
          limit_minor: facility.limitMinor,
          currency: facility.currency,
        };
      } catch {
        creditLineFacility = null;
      }

      res.json({
        panel_base_url: base || null,
        whitelabel_org_id: resolveWhitelabelOrgId(),
        admin_onboarding_fees_path: "/admin/onboarding-fees",
        admin_onboarding_fees_url: base ? `${base}/admin/onboarding-fees` : null,
        licensor_access_path: "/licensor-access",
        licensor_access_url: base ? `${base}/licensor-access` : null,
        billing_currency: billingCurrency,
        outstanding_amount_limit_minor: limitMinor,
        outstanding_total_minor: outstandingMinor,
        over_outstanding_limit: limitMinor != null && outstandingMinor >= limitMinor,
        payable_line_count: payableLineCount,
        line_counts_by_status: countsByStatus,
        configured_batch_gateway: batchPaymentGateway,
        platform_last_sync_at: master?.lastSyncAt
          ? (master.lastSyncAt instanceof Date ? master.lastSyncAt.toISOString() : String(master.lastSyncAt))
          : null,
        platform_last_sync_status: master?.lastSyncStatus ?? null,
        credit_line_facility: creditLineFacility,
      });
    } catch (e: any) {
      console.error("[remote] onboarding-summary:", e);
      res.status(500).json({ error: e?.message || "Failed to load onboarding summary" });
    }
  });

  /**
   * Panel health + credit-line + wallet + full usage overview for SaaS tracking.
   * GET /api/remote/panel-summary
   */
  app.get("/api/remote/panel-summary", requireProductionKey, async (req: any, res) => {
    try {
      const base = panelBaseUrl(req);
      const { buildRemotePanelOverview } = await import("../remote-panel-overview");
      const overview = await buildRemotePanelOverview();

      res.json({
        panel_base_url: base || null,
        whitelabel_org_id: resolveWhitelabelOrgId(),
        production_key_configured: !!process.env.PRODUCTION_KEY?.trim(),
        customer_api_configured: !!(
          process.env.CUSTOMER_API_BASE_URL?.trim() && process.env.PRODUCTION_KEY?.trim()
        ),
        ...overview,
        admin_paths: {
          wallet_billing: "/admin/wallet-billing",
          onboarding_fees: "/admin/onboarding-fees",
          platform_settings: "/admin/platform-settings",
          users: "/admin/users",
          plans: "/admin/plans",
          campaigns: "/campaigns",
          chatbots: "/chatbots",
          flows: "/flows",
        },
      });
    } catch (e: any) {
      console.error("[remote] panel-summary:", e);
      res.status(500).json({ error: e?.message || "Failed to load panel summary" });
    }
  });

  /**
   * Full usage overview (customers, plans, flows, chatbots, fees, …).
   * Same payload core as panel-summary.overview fields — dedicated alias for SaaS dashboards.
   * GET /api/remote/panel-overview
   */
  app.get("/api/remote/panel-overview", requireProductionKey, async (req: any, res) => {
    try {
      const base = panelBaseUrl(req);
      const { buildRemotePanelOverview } = await import("../remote-panel-overview");
      const overview = await buildRemotePanelOverview();
      res.json({
        panel_base_url: base || null,
        whitelabel_org_id: resolveWhitelabelOrgId(),
        ...overview,
      });
    } catch (e: any) {
      console.error("[remote] panel-overview:", e);
      res.status(500).json({ error: e?.message || "Failed to load panel overview" });
    }
  });

  /**
   * Paginated panel customers (non–SaaS-owner) with active plan details.
   * GET /api/remote/panel-customers?limit=25&offset=0&q=&active=1
   */
  app.get("/api/remote/panel-customers", requireProductionKey, async (req: any, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 25, 100);
      const offset = Math.max(parseInt(req.query.offset as string, 10) || 0, 0);
      const q = typeof req.query.q === "string" ? req.query.q : undefined;
      const activeRaw = typeof req.query.active === "string" ? req.query.active.trim().toLowerCase() : "";
      const activeOnly = activeRaw === "1" || activeRaw === "true" || activeRaw === "yes";
      const { listRemotePanelCustomers } = await import("../remote-panel-overview");
      const result = await listRemotePanelCustomers({ limit, offset, q, activeOnly });
      res.json({
        panel_base_url: panelBaseUrl(req) || null,
        whitelabel_org_id: resolveWhitelabelOrgId(),
        ...result,
      });
    } catch (e: any) {
      console.error("[remote] panel-customers:", e);
      res.status(500).json({ error: e?.message || "Failed to list panel customers" });
    }
  });

  /**
   * Line-level onboarding fees (for licensor dashboards). No secrets.
   * GET /api/remote/onboarding-fees?limit=200&offset=0&status=pending|all|paid|...
   */
  app.get("/api/remote/onboarding-fees", requireProductionKey, async (req: any, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 200, 500);
      const offset = parseInt(req.query.offset as string, 10) || 0;
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const { fees, total } = await storage.getWhitelabelOnboardingFeesForAdmin({ status, limit, offset });
      const lines = fees.map((f) => ({
        id: f.id,
        user_id: f.userId,
        customer_email: f.user?.email ?? null,
        customer_name:
          [f.user?.firstName, f.user?.lastName].filter(Boolean).join(" ").trim() || null,
        trigger: f.trigger,
        amount_minor: f.amountMinor,
        currency: f.currency,
        due_at: f.dueAt instanceof Date ? f.dueAt.toISOString() : String(f.dueAt),
        status: f.status,
        paid_at: f.paidAt ? (f.paidAt instanceof Date ? f.paidAt.toISOString() : String(f.paidAt)) : null,
        created_at: f.createdAt instanceof Date ? f.createdAt.toISOString() : String(f.createdAt),
        gateway_payment_id: f.gatewayPaymentId ?? null,
      }));
      res.json({ total, limit, offset, lines });
    } catch (e: any) {
      console.error("[remote] onboarding-fees:", e);
      res.status(500).json({ error: e?.message || "Failed to list onboarding fees" });
    }
  });

  /**
   * Rebuild unpaid onboarding fees on this panel (paid months preserved).
   * POST /api/remote/onboarding-fees/recalculate
   */
  app.post("/api/remote/onboarding-fees/recalculate", requireProductionKey, async (_req: any, res) => {
    try {
      const { recalculateWhitelabelOnboardingFees } = await import("../whitelabel-onboarding-recalculate");
      const result = await recalculateWhitelabelOnboardingFees();
      res.json({ ok: true, ...result });
    } catch (e: any) {
      const status = e?.statusCode === 400 ? 400 : 500;
      res.status(status).json({
        ok: false,
        error: e?.message || "Recalculate failed",
        ...(e?.debug ? { debug: e.debug } : {}),
      });
    }
  });

  /**
   * SaaS portal push: force this panel to re-pull GET /api/customer into platform_master_settings.
   * Call after commercial / credit-line / gateway / subscription changes on the licensor.
   * POST /api/remote/platform-master-sync
   */
  app.post("/api/remote/platform-master-sync", requireProductionKey, async (_req: any, res) => {
    try {
      const { runPlatformMasterSync } = await import("../platform-master-sync");
      const result = await runPlatformMasterSync();
      const master = await storage.getPlatformMasterSettings();
      if (!result.ok) {
        return res.status(result.skipped ? 503 : 502).json({
          ...result,
          ok: false,
          platform_last_sync_at: master?.lastSyncAt
            ? master.lastSyncAt instanceof Date
              ? master.lastSyncAt.toISOString()
              : String(master.lastSyncAt)
            : null,
          platform_last_sync_status: master?.lastSyncStatus ?? null,
          platform_last_sync_error: master?.lastSyncError ?? null,
        });
      }
      res.json({
        ...result,
        ok: true,
        platform_last_sync_at: master?.lastSyncAt
          ? master.lastSyncAt instanceof Date
            ? master.lastSyncAt.toISOString()
            : String(master.lastSyncAt)
          : null,
        platform_last_sync_status: master?.lastSyncStatus ?? null,
        whitelabel_org_id: resolveWhitelabelOrgId(),
      });
    } catch (e: any) {
      console.error("[remote] platform-master-sync:", e);
      res.status(500).json({ ok: false, error: e?.message || "Platform master sync failed" });
    }
  });

  /**
   * Mint a one-time login URL for the SaaS portal (preferred).
   * Also establishes a session on this response for same-origin callers (/licensor-access).
   * POST /api/remote/admin-login
   */
  app.post("/api/remote/admin-login", requireProductionKey, async (req: any, res) => {
    try {
      const redirect = safeRedirectPath(req.body?.redirect);
      await establishSaasOwnerSession(req, res, redirect, true);
    } catch (e: any) {
      console.error("[remote] admin-login:", e);
      res.status(500).json({ error: e?.message || "Login failed" });
    }
  });

  /**
   * Consume one-time token on the **panel origin** — sets session cookie correctly, then redirects.
   * GET /api/remote/admin-login/consume?token=...
   * No production key header: the token itself is the proof (2 min TTL, single use).
   */
  app.get("/api/remote/admin-login/consume", async (req: any, res) => {
    try {
      const token = typeof req.query.token === "string" ? req.query.token : "";
      const consumed = consumeRemoteAdminLoginToken(token);
      if (!consumed) {
        return res.status(401).send(
          "Invalid or expired login link. Go back to the SaaS admin and click Open admin again."
        );
      }
      await establishSaasOwnerSession(req, res, consumed.redirect, false);
    } catch (e: any) {
      console.error("[remote] admin-login/consume:", e);
      res.status(500).send(e?.message || "Login failed");
    }
  });

  /**
   * Technical Team portal updates status on a transferred ticket.
   * POST /api/remote/support/technical-status
   * Body: { panelTicketId, status }
   */
  app.post("/api/remote/support/technical-status", requireProductionKey, async (req: any, res) => {
    try {
      const panelTicketId = String(req.body?.panelTicketId || "").trim();
      const status = String(req.body?.status || "").trim();
      const allowed = ["open", "pending", "in_progress", "waiting_on_customer", "resolved", "closed"] as const;
      if (!panelTicketId) return res.status(400).json({ error: "panelTicketId is required" });
      if (!allowed.includes(status as (typeof allowed)[number])) {
        return res.status(400).json({ error: `status must be one of: ${allowed.join(", ")}` });
      }

      const ticket = await storage.getSupportTicketById(panelTicketId);
      if (!ticket) return res.status(404).json({ error: "Ticket not found" });
      if (!ticket.transferredToTechnical) {
        return res.status(400).json({ error: "Ticket is not transferred to Technical Team" });
      }

      const updated = await storage.updateSupportTicketById(ticket.id, {
        status: status as (typeof allowed)[number],
        updatedAt: new Date(),
      });
      res.json({ success: true, id: ticket.id, status: updated?.status || status });
    } catch (e: any) {
      console.error("[remote] technical-status:", e);
      res.status(500).json({ error: e?.message || "Failed" });
    }
  });

  /**
   * Technical Team portal posts a reply into a transferred ticket.
   * POST /api/remote/support/technical-reply
   * Body: { panelTicketId, body, authorName?, technicalMessageId? }
   */
  app.post("/api/remote/support/technical-reply", requireProductionKey, async (req: any, res) => {
    try {
      const panelTicketId = String(req.body?.panelTicketId || "").trim();
      const body = String(req.body?.body || "").trim();
      const authorName = String(req.body?.authorName || "Technical Team").trim() || "Technical Team";
      if (!panelTicketId) return res.status(400).json({ error: "panelTicketId is required" });
      if (!body) return res.status(400).json({ error: "body is required" });

      const ticket = await storage.getSupportTicketById(panelTicketId);
      if (!ticket) return res.status(404).json({ error: "Ticket not found" });
      if (!ticket.transferredToTechnical) {
        return res.status(400).json({ error: "Ticket is not transferred to Technical Team" });
      }

      const message = await storage.createSupportMessageRow({
        ticketId: ticket.id,
        body,
        authorType: "technical_team",
        authorUserId: null,
      });
      await storage.updateSupportTicketById(ticket.id, {
        updatedAt: new Date(),
        status: ticket.status === "closed" || ticket.status === "resolved" ? ticket.status : "waiting_on_customer",
      });

      // Soft-notify customer by email when possible
      try {
        const org = await storage.getOrganization(ticket.organizationId);
        if (org) {
          const { getSupportSmtpUserId, notifyNewMessage } = await import("../utils/support-ticket-emails");
          const smtpUserId = await getSupportSmtpUserId();
          const fromEnv = (process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || "").trim().replace(/\/$/, "");
          const viewUrl = fromEnv
            ? `${fromEnv}/support/ticket?accessToken=${encodeURIComponent(ticket.accessToken)}`
            : undefined;
          await notifyNewMessage(ticket.customerEmail, {
            isToCustomer: true,
            org,
            ticket,
            fromLabel: `${org.name} — ${authorName}`,
            body,
            smtpUserId,
            ctaUrl: viewUrl,
            ctaText: "View and reply to this ticket",
          });
        }
      } catch (mailErr) {
        console.warn("[remote] technical-reply email failed:", (mailErr as Error)?.message);
      }

      res.json({ success: true, messageId: message.id, authorName });
    } catch (e: any) {
      console.error("[remote] technical-reply:", e);
      res.status(500).json({ error: e?.message || "Failed" });
    }
  });
}
