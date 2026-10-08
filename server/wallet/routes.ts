import type { Express } from "express";
import { z } from "zod";
import { isAuthenticated } from "../replitAuth";
import { isSaaSOwner } from "../middleware/admin-auth";
import { resolveOrganizationContext, requirePermission } from "../middleware/organization-context";
import { rateLimitMiddleware } from "../middleware/rate-limiter";
import { getWalletBillingConfig, saveWalletBillingConfig } from "./config";
import { getWalletSummary } from "./service";
import { createWalletReloadCheckout, verifyWalletReloadPayment, adminCompleteWalletReload } from "./reload";
import { debitWalletFixed, ensureOrganizationWallet } from "./wallet-db";
import { storage } from "../storage";
import { listWalletTransactions } from "./wallet-db";
import { walletTransactionsToCsv } from "./export-csv";
import {
  createWalletRateVersion,
  listWalletRateVersions,
} from "./rate-versions";
import {
  createMetaInvoice,
  listMetaInvoices,
  listReconciliationRuns,
  runMetaInvoiceReconciliation,
} from "./reconciliation";
import { readWalletBillingGuideMarkdown } from "./guide";

const reloadBodySchema = z.object({
  amountMinor: z.number().int().positive(),
});

const verifyReloadSchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

const configPatchSchema = z.object({
  enabled: z.boolean().optional(),
  skipSaasSubscriptionForOfficialMessages: z.boolean().optional(),
  currency: z.string().max(10).optional(),
  metaRatesMinor: z
    .object({
      marketing: z.number().int().nonnegative().optional(),
      utility: z.number().int().nonnegative().optional(),
      authentication: z.number().int().nonnegative().optional(),
      service: z.number().int().nonnegative().optional(),
    })
    .optional(),
  markupEnabled: z.boolean().optional(),
  markupMode: z.enum(["fixed_minor", "percent"]).optional(),
  markupByCategory: z
    .object({
      marketing: z.number().int().nonnegative().optional(),
      utility: z.number().int().nonnegative().optional(),
      authentication: z.number().int().nonnegative().optional(),
      service: z.number().int().nonnegative().optional(),
    })
    .optional(),
  lowBalanceThresholdMinor: z.number().int().nonnegative().optional(),
  allowNegativeBalance: z.boolean().optional(),
  lowBalanceEmailEnabled: z.boolean().optional(),
  useCountryRateVersions: z.boolean().optional(),
  defaultCountryIso: z.string().max(8).optional(),
});

const rateVersionSchema = z.object({
  countryIso: z.string().max(8),
  metaCategory: z.enum(["marketing", "utility", "authentication", "service"]),
  rateMinor: z.number().int().nonnegative(),
  /** Fixed paise markup for this country row; omit or null = use global markup settings. */
  markupMinor: z.number().int().nonnegative().nullable().optional(),
  currency: z.string().max(10).optional(),
  validFrom: z.string().datetime().optional(),
  validTo: z.string().datetime().optional().nullable(),
  notes: z.string().max(500).optional(),
});

const metaInvoiceSchema = z.object({
  periodLabel: z.string().min(1).max(64),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  metaTotalMinor: z.number().int().positive(),
  currency: z.string().max(10).optional(),
  notes: z.string().max(2000).optional(),
});

const reconcileSchema = z.object({
  invoiceId: z.string().min(1),
  postPlatformAdjustment: z.boolean().optional(),
  adjustmentOrganizationId: z.string().optional(),
});

const adjustmentSchema = z.object({
  organizationId: z.string().min(1),
  /** Positive = credit, negative = debit (paise). */
  amountMinor: z.number().int(),
  description: z.string().max(500).optional(),
  /** Optional link to a Razorpay payment when recovering a failed verify. */
  gatewayOrderId: z.string().optional(),
  gatewayPaymentId: z.string().optional(),
});

const completeReloadSchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().optional(),
});

function getUserId(req: any): string | null {
  return req.user?.claims?.sub || req.userId || null;
}

export function registerWalletRoutes(app: Express): void {
  const withAuth = [isAuthenticated, rateLimitMiddleware] as const;
  const withOrgBilling = [
    ...withAuth,
    resolveOrganizationContext,
    requirePermission("billing.view"),
  ] as const;

  app.get("/api/wallet/config", ...withAuth, async (_req, res) => {
    try {
      const config = await getWalletBillingConfig();
      res.json({ config });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/wallet/transactions/export.csv", ...withOrgBilling, async (req: any, res) => {
    try {
      const orgId = req.context?.organizationId;
      if (!orgId) return res.status(400).json({ error: "Organization required" });
      const from = req.query.from ? new Date(String(req.query.from)) : undefined;
      const to = req.query.to ? new Date(String(req.query.to)) : undefined;
      const limit = Math.min(5000, Math.max(1, parseInt(String(req.query.limit || "2000"), 10) || 2000));
      const rows = await listWalletTransactions(orgId, limit, 0, { from, to });
      const csv = walletTransactionsToCsv(rows);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="wallet-transactions-${orgId.slice(0, 8)}.csv"`
      );
      res.send(csv);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/wallet/summary", ...withOrgBilling, async (req: any, res) => {
    try {
      const orgId = req.context?.organizationId;
      if (!orgId) return res.status(400).json({ error: "Organization required" });
      const summary = await getWalletSummary(orgId);
      res.json(summary);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/wallet/reload/create-order", ...withOrgBilling, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const orgId = req.context?.organizationId;
      if (!orgId) return res.status(400).json({ error: "Organization required" });
      const body = reloadBodySchema.parse(req.body);
      const payload = await createWalletReloadCheckout({
        organizationId: orgId,
        userId,
        amountMinor: body.amountMinor,
      });
      res.json(payload);
    } catch (e: any) {
      const code = e.statusCode || 500;
      res.status(code).json({ error: e.message });
    }
  });

  app.post("/api/wallet/reload/verify", ...withAuth, async (req: any, res) => {
    try {
      const body = verifyReloadSchema.parse(req.body);
      const result = await verifyWalletReloadPayment(body);
      res.json(result);
    } catch (e: any) {
      const code = e.statusCode || 500;
      res.status(code).json({ error: e.message });
    }
  });

  app.get("/api/wallet/billing-guide", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const markdown = await readWalletBillingGuideMarkdown();
      res.json({ markdown });
    } catch (e: any) {
      if (e?.code === "ENOENT") {
        return res.status(404).json({ error: "Guide file not found on server" });
      }
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/admin/wallet-billing/config", isAuthenticated, isSaaSOwner, async (_req, res) => {
    try {
      const config = await getWalletBillingConfig();
      res.json({ config });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /** Live SaaS → this whitelabel credit-line facility (from CUSTOMER_API_BASE_URL). */
  app.get("/api/admin/wallet-billing/whitelabel-credit-line", isAuthenticated, isSaaSOwner, async (_req, res) => {
    try {
      const { getWhitelabelCreditLineFacility } = await import("../whitelabel-credit-line");
      const facility = await getWhitelabelCreditLineFacility();
      res.json({ facility });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/admin/wallet-billing/config", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const patch = configPatchSchema.parse(req.body);
      const config = await saveWalletBillingConfig(patch);
      res.json({ config });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/admin/wallet-billing/adjustment", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const adminId = getUserId(req);
      const body = adjustmentSchema.parse(req.body);
      const config = await getWalletBillingConfig();
      await ensureOrganizationWallet(body.organizationId, config.currency || "INR");
      const amountAbs = Math.abs(body.amountMinor);
      if (amountAbs <= 0) {
        return res.status(400).json({ error: "amountMinor cannot be zero" });
      }
      const direction = body.amountMinor > 0 ? "credit" : "debit";
      const desc =
        body.description?.trim() ||
        (direction === "credit"
          ? `Admin wallet credit ₹${(amountAbs / 100).toFixed(2)}`
          : `Admin wallet debit ₹${(amountAbs / 100).toFixed(2)}`);
      const metadata: Record<string, unknown> = {
        source: "admin_manual",
        direction,
        adjustedAt: new Date().toISOString(),
        adminUserId: adminId || null,
      };
      if (body.gatewayOrderId) metadata.gatewayOrderId = body.gatewayOrderId;
      if (body.gatewayPaymentId) metadata.gatewayPaymentId = body.gatewayPaymentId;

      if (direction === "credit") {
        const { creditWallet } = await import("./wallet-db");
        const tx = await creditWallet({
          organizationId: body.organizationId,
          type: "adjustment",
          amountMinor: amountAbs,
          description: desc,
          createdByUserId: adminId || undefined,
          gatewayOrderId: body.gatewayOrderId,
          gatewayPaymentId: body.gatewayPaymentId,
          referenceType: "admin_manual",
          referenceId: adminId || undefined,
          metadata,
        });
        return res.json({ transaction: tx, wallet: await getWalletSummary(body.organizationId) });
      }

      const tx = await debitWalletFixed({
        organizationId: body.organizationId,
        type: "adjustment",
        amountMinor: amountAbs,
        currency: config.currency || "INR",
        description: desc,
        createdByUserId: adminId || undefined,
        gatewayOrderId: body.gatewayOrderId,
        gatewayPaymentId: body.gatewayPaymentId,
        referenceType: "admin_manual",
        referenceId: adminId || undefined,
        metadata,
        allowNegativeBalance: true,
      });
      return res.json({ transaction: tx, wallet: await getWalletSummary(body.organizationId) });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/admin/wallet-billing/complete-reload", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const body = completeReloadSchema.parse(req.body);
      const result = await adminCompleteWalletReload(body);
      res.json(result);
    } catch (e: any) {
      const code = e.statusCode || 500;
      res.status(code).json({ error: e.message });
    }
  });

  app.get("/api/admin/wallet-billing/rate-versions", isAuthenticated, isSaaSOwner, async (_req, res) => {
    try {
      const versions = await listWalletRateVersions();
      res.json({ versions });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/admin/wallet-billing/rate-versions", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const body = rateVersionSchema.parse(req.body);
      const version = await createWalletRateVersion({
        countryIso: body.countryIso,
        metaCategory: body.metaCategory,
        rateMinor: body.rateMinor,
        markupMinor: body.markupMinor ?? null,
        currency: body.currency,
        validFrom: body.validFrom ? new Date(body.validFrom) : new Date(),
        validTo: body.validTo ? new Date(body.validTo) : null,
        notes: body.notes,
        createdByUserId: getUserId(req) || undefined,
      });
      res.json({ version });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/admin/wallet-billing/invoices", isAuthenticated, isSaaSOwner, async (_req, res) => {
    try {
      const invoices = await listMetaInvoices();
      const runs = await listReconciliationRuns();
      res.json({ invoices, runs });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/admin/wallet-billing/invoices", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const body = metaInvoiceSchema.parse(req.body);
      const invoice = await createMetaInvoice({
        periodLabel: body.periodLabel,
        periodStart: new Date(body.periodStart),
        periodEnd: new Date(body.periodEnd),
        metaTotalMinor: body.metaTotalMinor,
        currency: body.currency,
        notes: body.notes,
        uploadedByUserId: getUserId(req) || undefined,
      });
      res.json({ invoice });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/admin/wallet-billing/reconcile", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const body = reconcileSchema.parse(req.body);
      const run = await runMetaInvoiceReconciliation({
        invoiceId: body.invoiceId,
        createdByUserId: getUserId(req) || undefined,
        postPlatformAdjustment: body.postPlatformAdjustment,
        adjustmentOrganizationId: body.adjustmentOrganizationId,
      });
      res.json({ run });
    } catch (e: any) {
      const code = e.statusCode || 500;
      res.status(code).json({ error: e.message });
    }
  });

  app.get("/api/admin/wallet-billing/transactions/export.csv", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const orgId = req.query.organizationId as string | undefined;
      const from = req.query.from ? new Date(String(req.query.from)) : undefined;
      const to = req.query.to ? new Date(String(req.query.to)) : undefined;
      const limit = Math.min(10000, parseInt(String(req.query.limit || "5000"), 10) || 5000);
      if (!orgId) {
        return res.status(400).json({ error: "organizationId query required" });
      }
      const rows = await listWalletTransactions(orgId, limit, 0, { from, to });
      const csv = walletTransactionsToCsv(rows);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="wallet-${orgId}.csv"`);
      res.send(csv);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/admin/wallet-billing/org/:organizationId", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const { organizationId } = req.params;
      await ensureOrganizationWallet(organizationId);
      const org = await storage.getOrganization(organizationId);
      const summary = await getWalletSummary(organizationId);
      res.json({ organization: org, ...summary });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
}
