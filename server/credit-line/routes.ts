import type { Express } from "express";
import { z } from "zod";
import { isAuthenticated } from "../replitAuth";
import { isSaaSOwner } from "../middleware/admin-auth";
import {
  getCreditLineProvidersConfig,
  saveCreditLineProvidersConfig,
  redactProvidersConfig,
  getCreditLineProviderConfig,
} from "./provider-config";
import { getOrgWhatsappBilling, upsertOrgWhatsappBilling } from "./org-billing";
import { getCreditLineProvider, listRegisteredCreditLineProviderIds } from "./providers/registry";
import { storage } from "../storage";
import {
  resolveCreditLineWebhookUrl,
  verifyCreditLineWebhookChallenge,
  handleCreditLineConnectWebhook,
  forwardCreditLineWebhook,
} from "./webhook";

const providerPatchSchema = z.record(
  z.string(),
  z.object({
    enabled: z.boolean().optional(),
    displayName: z.string().max(120).optional(),
    apiBaseUrl: z.string().max(500).optional(),
    accessToken: z.string().max(4000).optional(),
    solutionId: z.string().max(128).optional(),
    apiVersion: z.string().max(32).optional(),
    mmLiteEnabled: z.boolean().optional(),
    isvAppId: z.string().max(64).optional(),
    notes: z.string().max(2000).optional(),
  })
);

const orgBillingPatchSchema = z.object({
  billingMode: z.enum(["self_pay", "credit_line"]),
  creditLineProvider: z.string().max(64).optional().nullable(),
  creditLineStatus: z.enum(["inactive", "pending", "active", "error"]).optional(),
  creditLineWabaId: z.string().max(64).optional().nullable(),
  creditLinePhoneNumberId: z.string().max(64).optional().nullable(),
});

export function registerCreditLineRoutes(app: Express): void {
  // ── Public webhook for credit-line supplier (number connect / WABA_ONBOARDED) ──
  app.get("/api/webhooks/credit-line", async (req: any, res) => {
    try {
      const result = verifyCreditLineWebhookChallenge({
        mode: req.query["hub.mode"],
        token: req.query["hub.verify_token"],
        challenge: req.query["hub.challenge"],
      });
      if (!result.ok) {
        console.warn("[CreditLine Webhook] GET verify failed:", result.message);
        return res.status(result.status).send(result.message);
      }
      if (!req.headers["x-credit-line-forward"]) {
        forwardCreditLineWebhook(
          "GET",
          {
            "hub.mode": String(req.query["hub.mode"] || ""),
            "hub.verify_token": String(req.query["hub.verify_token"] || ""),
            "hub.challenge": String(req.query["hub.challenge"] || ""),
          },
          null
        ).catch((e) => console.warn("[CreditLine Webhook] forward GET:", e?.message));
      }
      console.log("[CreditLine Webhook] ✅ Verified — returning hub.challenge");
      return res.status(200).send(result.challenge);
    } catch (e: any) {
      console.error("[CreditLine Webhook] GET error:", e);
      return res.status(500).send("Internal Server Error");
    }
  });

  app.get("/api/webhooks/credit-line/:provider", async (req: any, res) => {
    try {
      const result = verifyCreditLineWebhookChallenge({
        mode: req.query["hub.mode"],
        token: req.query["hub.verify_token"],
        challenge: req.query["hub.challenge"],
      });
      if (!result.ok) return res.status(result.status).send(result.message);
      return res.status(200).send(result.challenge);
    } catch (e: any) {
      return res.status(500).send("Internal Server Error");
    }
  });

  app.post("/api/webhooks/credit-line", async (req: any, res) => {
    try {
      const body = req.body;
      console.log(
        "[CreditLine Webhook] POST received:",
        typeof body === "object" ? JSON.stringify(body).slice(0, 800) : String(body).slice(0, 200)
      );

      const result = await handleCreditLineConnectWebhook(body, "interakt");

      if (!req.headers["x-credit-line-forward"]) {
        forwardCreditLineWebhook("POST", {}, body).catch((e) =>
          console.warn("[CreditLine Webhook] forward POST:", e?.message)
        );
      }

      // Always 200 quickly so supplier does not retry aggressively
      return res.status(200).json({ success: true, ...result });
    } catch (e: any) {
      console.error("[CreditLine Webhook] POST error:", e);
      return res.status(200).json({ success: false, error: e.message });
    }
  });

  app.post("/api/webhooks/credit-line/:provider", async (req: any, res) => {
    try {
      const provider = String(req.params.provider || "interakt");
      const body = req.body;
      console.log(`[CreditLine Webhook] POST provider=${provider}`);
      const result = await handleCreditLineConnectWebhook(body, provider);
      if (!req.headers["x-credit-line-forward"]) {
        forwardCreditLineWebhook("POST", {}, body).catch(() => {});
      }
      return res.status(200).json({ success: true, ...result });
    } catch (e: any) {
      console.error("[CreditLine Webhook] POST error:", e);
      return res.status(200).json({ success: false, error: e.message });
    }
  });

  app.get("/api/admin/credit-line/webhook-info", isAuthenticated, isSaaSOwner, async (_req, res) => {
    try {
      res.json(resolveCreditLineWebhookUrl());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/admin/credit-line/providers", isAuthenticated, isSaaSOwner, async (_req, res) => {
    try {
      const cfg = await getCreditLineProvidersConfig();
      const saasManaged = !!(
        process.env.CUSTOMER_API_BASE_URL?.trim() && process.env.PRODUCTION_KEY?.trim()
      );
      res.json({
        providers: redactProvidersConfig(cfg),
        registeredAdapters: listRegisteredCreditLineProviderIds(),
        managedBySaas: saasManaged,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/admin/credit-line/providers", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const saasManaged = !!(
        process.env.CUSTOMER_API_BASE_URL?.trim() && process.env.PRODUCTION_KEY?.trim()
      );
      if (saasManaged) {
        return res.status(403).json({
          error:
            "Credit-line providers are managed on the SaaS owner portal (Credit-line settings) and synced via platform master. Edit them there.",
          code: "MANAGED_BY_SAAS",
        });
      }
      const parsed = providerPatchSchema.safeParse(req.body?.providers ?? req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }
      const current = await getCreditLineProvidersConfig();
      const patch: typeof current = {};
      for (const [key, val] of Object.entries(parsed.data)) {
        const prev = current[key] || {};
        const next = { ...prev, ...val };
        // Keep existing token if placeholder / empty
        if (!val.accessToken || val.accessToken === "********" || !String(val.accessToken).trim()) {
          next.accessToken = prev.accessToken;
        }
        patch[key] = next;
      }
      const saved = await saveCreditLineProvidersConfig(patch);
      res.json({ providers: redactProvidersConfig(saved) });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get(
    "/api/admin/credit-line/org/:organizationId",
    isAuthenticated,
    isSaaSOwner,
    async (req: any, res) => {
      try {
        const { organizationId } = req.params;
        const org = await storage.getOrganization(organizationId);
        if (!org) return res.status(404).json({ error: "Organization not found" });
        const billing = await getOrgWhatsappBilling(organizationId);
        res.json({ organization: org, billing });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    }
  );

  app.patch(
    "/api/admin/credit-line/org/:organizationId",
    isAuthenticated,
    isSaaSOwner,
    async (req: any, res) => {
      try {
        const { organizationId } = req.params;
        const org = await storage.getOrganization(organizationId);
        if (!org) return res.status(404).json({ error: "Organization not found" });
        const parsed = orgBillingPatchSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: parsed.error.flatten() });
        }
        const userId = req.user?.claims?.sub || req.userId || null;
        const billing = await upsertOrgWhatsappBilling({
          organizationId,
          ...parsed.data,
          updatedByUserId: userId,
          lastError: null,
        });
        res.json({ billing });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    }
  );

  /** Manual Interakt tp-signup + subscribed_apps (if PARTNER_ADDED webhook missed). */
  app.post(
    "/api/admin/credit-line/org/:organizationId/tp-signup",
    isAuthenticated,
    isSaaSOwner,
    async (req: any, res) => {
      try {
        const { organizationId } = req.params;
        const billing = await getOrgWhatsappBilling(organizationId);
        if (billing.billingMode !== "credit_line") {
          return res.status(400).json({ error: "Organization is not in credit_line mode" });
        }
        const wabaId =
          (req.body?.wabaId as string) ||
          billing.creditLineWabaId ||
          "";
        if (!wabaId) {
          return res.status(400).json({ error: "wabaId is required" });
        }
        const { maybeRunCreditLineTpSignup } = await import("./tp-signup");
        const result = await maybeRunCreditLineTpSignup({
          organizationId,
          wabaId,
          phoneNumber: req.body?.phoneNumber || null,
        });
        res.status(result.ok ? 200 : result.ran ? 502 : 400).json(result);
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    }
  );
}
