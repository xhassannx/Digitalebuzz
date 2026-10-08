import { db } from "../../db";
import { isMongoEnabled } from "../../db/mongo";
import {
  walletMetaInvoices,
  walletReconciliationRuns,
  type WalletMetaInvoiceRow,
  type WalletReconciliationRunRow,
} from "@shared/schema";
import { desc, eq } from "drizzle-orm";
import { sumEstimatedMetaCostForPeriod } from "./rate-versions";
import { creditWallet } from "./wallet-db";
import { getWalletBillingConfig } from "./config";

export async function createMetaInvoice(input: {
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date;
  metaTotalMinor: number;
  currency?: string;
  notes?: string;
  uploadedByUserId?: string;
}): Promise<WalletMetaInvoiceRow> {
  const [row] = await db
    .insert(walletMetaInvoices)
    .values({
      periodLabel: input.periodLabel,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      metaTotalMinor: input.metaTotalMinor,
      currency: input.currency || "INR",
      source: "manual",
      notes: input.notes,
      uploadedByUserId: input.uploadedByUserId,
    })
    .returning();
  return row!;
}

export async function listMetaInvoices(limit = 50): Promise<WalletMetaInvoiceRow[]> {
  return db.select().from(walletMetaInvoices).orderBy(desc(walletMetaInvoices.periodStart)).limit(limit);
}

export async function listReconciliationRuns(limit = 50): Promise<WalletReconciliationRunRow[]> {
  return db
    .select()
    .from(walletReconciliationRuns)
    .orderBy(desc(walletReconciliationRuns.createdAt))
    .limit(limit);
}

/**
 * Compare Meta invoice total to sum of wallet meta_cost_minor in the same period.
 * Platform-level: does not auto-adjust per-org wallets (records variance for admin).
 * Optional: post platform adjustment note only in reconciliation row.
 */
export async function runMetaInvoiceReconciliation(params: {
  invoiceId: string;
  createdByUserId?: string;
  /** If true and variance > 0, credit first org wallet found — usually leave false. */
  postPlatformAdjustment?: boolean;
  adjustmentOrganizationId?: string;
}): Promise<WalletReconciliationRunRow> {
  const [invoice] = await db
    .select()
    .from(walletMetaInvoices)
    .where(eq(walletMetaInvoices.id, params.invoiceId))
    .limit(1);
  if (!invoice) throw Object.assign(new Error("Invoice not found"), { statusCode: 404 });

  const estimated = await sumEstimatedMetaCostForPeriod(invoice.periodStart, invoice.periodEnd);
  const actual = invoice.metaTotalMinor;
  const variance = actual - estimated;

  const [run] = await db
    .insert(walletReconciliationRuns)
    .values({
      invoiceId: invoice.id,
      status: "pending",
      estimatedMetaMinor: estimated,
      actualMetaMinor: actual,
      varianceMinor: variance,
      organizationScope: "platform",
      notes: `Estimated ledger meta ${estimated} vs Meta invoice ${actual} (variance ${variance})`,
      createdByUserId: params.createdByUserId,
    })
    .returning();

  let adjustmentTransactionId: string | null = null;

  if (params.postPlatformAdjustment && params.adjustmentOrganizationId && variance !== 0) {
    const config = await getWalletBillingConfig();
    if (variance > 0) {
      const tx = await creditWallet({
        organizationId: params.adjustmentOrganizationId,
        type: "adjustment",
        amountMinor: variance,
        description: `Meta reconciliation ${invoice.periodLabel} (invoice higher than estimates)`,
        createdByUserId: params.createdByUserId,
        referenceType: "reconciliation",
        referenceId: run!.id,
      });
      adjustmentTransactionId = tx.id;
    }
  }

  const [completed] = await db
    .update(walletReconciliationRuns)
    .set({
      status: "completed",
      adjustmentTransactionId,
      completedAt: new Date(),
      notes: run!.notes,
    })
    .where(eq(walletReconciliationRuns.id, run!.id))
    .returning();

  return completed!;
}

/** Monthly reminder tick: if previous calendar month has no invoice, log for admin (no email in v1). */
export async function runMonthlyReconciliationReminderTick(): Promise<void> {
  if (isMongoEnabled()) return;
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const existing = await db
    .select({ id: walletMetaInvoices.id })
    .from(walletMetaInvoices)
    .where(eq(walletMetaInvoices.periodStart, periodStart))
    .limit(1);

  if (existing.length > 0) return;

  const estimated = await sumEstimatedMetaCostForPeriod(periodStart, periodEnd);
  console.log(
    `[WalletReconciliation] Reminder: upload Meta invoice for ${periodStart.toISOString().slice(0, 7)}. Estimated ledger meta cost: ${estimated} minor units.`
  );
}
