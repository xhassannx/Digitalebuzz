// @ts-nocheck
import { db } from "../../db";
import { isMongoEnabled } from "../../db/mongo";
import {
  OrganizationWalletModel,
  WalletTransactionModel,
  WalletReloadOrderModel,
} from "../models";
import {
  organizationWallets,
  walletTransactions,
  walletReloadOrders,
  type WalletTransactionRow,
  type OrganizationWalletRow,
  type WalletReloadOrderRow,
} from "@shared/schema";
import { eq, and, desc, sql, gte, lt } from "drizzle-orm";
import type { ChargeBreakdown } from "./pricing";

export async function ensureOrganizationWallet(
  organizationId: string,
  currency = "INR"
): Promise<OrganizationWalletRow> {
  if (isMongoEnabled()) {
    let existing = await OrganizationWalletModel.findOne({ organizationId }).lean();
    if (existing) return { ...existing, id: existing._id } as any;
    const created = await OrganizationWalletModel.create({
      organizationId,
      balanceMinor: 0,
      currency,
      status: "active",
    });
    const doc = created.toObject();
    return { ...doc, id: doc._id } as any;
  }

  const [existing] = await db
    .select()
    .from(organizationWallets)
    .where(eq(organizationWallets.organizationId, organizationId))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(organizationWallets)
    .values({ organizationId, balanceMinor: 0, currency, status: "active" })
    .returning();
  return created!;
}

export async function getOrganizationWallet(
  organizationId: string
): Promise<OrganizationWalletRow | undefined> {
  if (isMongoEnabled()) {
    const row = await OrganizationWalletModel.findOne({ organizationId }).lean();
    return row ? ({ ...row, id: row._id } as any) : undefined;
  }

  const [row] = await db
    .select()
    .from(organizationWallets)
    .where(eq(organizationWallets.organizationId, organizationId))
    .limit(1);
  return row;
}

export async function listWalletTransactions(
  organizationId: string,
  limit = 50,
  offset = 0,
  opts?: { from?: Date; to?: Date }
): Promise<WalletTransactionRow[]> {
  if (isMongoEnabled()) {
    const conditions: any = { organizationId };
    if (opts?.from || opts?.to) {
      conditions.createdAt = {};
      if (opts.from) conditions.createdAt.$gte = opts.from;
      if (opts.to) conditions.createdAt.$lt = opts.to;
    }
    const docs = await WalletTransactionModel.find(conditions)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();
    return docs.map((d: any) => ({ ...d, id: d._id })) as any;
  }

  const conditions = [eq(walletTransactions.organizationId, organizationId)];
  if (opts?.from) conditions.push(gte(walletTransactions.createdAt, opts.from));
  if (opts?.to) conditions.push(lt(walletTransactions.createdAt, opts.to));

  return db
    .select()
    .from(walletTransactions)
    .where(and(...conditions))
    .orderBy(desc(walletTransactions.createdAt))
    .limit(limit)
    .offset(offset);
}

export type WalletDebitInput = {
  organizationId: string;
  type: "debit_message" | "debit_campaign";
  breakdown: ChargeBreakdown;
  description: string;
  referenceType?: string;
  referenceId?: string;
  createdByUserId?: string;
  metadata?: Record<string, unknown>;
  allowNegativeBalance?: boolean;
};

export type WalletFixedDebitInput = {
  organizationId: string;
  type: "debit_subscription" | "debit_message" | "debit_campaign" | "adjustment";
  amountMinor: number;
  currency?: string;
  description: string;
  referenceType?: string;
  referenceId?: string;
  createdByUserId?: string;
  metadata?: Record<string, unknown>;
  allowNegativeBalance?: boolean;
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
};

export type WalletCreditInput = {
  organizationId: string;
  type: "reload" | "refund" | "adjustment";
  amountMinor: number;
  description: string;
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  createdByUserId?: string;
  metadata?: Record<string, unknown>;
  referenceType?: string;
  referenceId?: string;
};

/**
 * Atomic debit: amount_minor is negative in ledger; balance decreases by charged_minor.
 */
export async function debitWallet(input: WalletDebitInput): Promise<WalletTransactionRow> {
  if (isMongoEnabled()) {
    const charge = input.breakdown.chargedMinor;
    if (charge <= 0) {
      const wallet = await ensureOrganizationWallet(input.organizationId, input.breakdown.currency);
      const createdTx = await WalletTransactionModel.create({
        organizationId: input.organizationId,
        type: input.type,
        amountMinor: 0,
        balanceAfterMinor: wallet.balanceMinor,
        currency: input.breakdown.currency,
        metaCategory: input.breakdown.metaCategory,
        metaCostMinor: input.breakdown.metaCostMinor,
        markupMinor: input.breakdown.markupMinor,
        chargedMinor: 0,
        recipientCountryIso: input.breakdown.countryIso,
        rateVersionId: input.breakdown.rateVersionId,
        description: input.description,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        createdByUserId: input.createdByUserId,
        metadata: input.metadata,
      });
      const doc = createdTx.toObject();
      return { ...doc, id: doc._id } as any;
    }

    const wallet = await ensureOrganizationWallet(input.organizationId, input.breakdown.currency);
    if (wallet.status === "suspended") {
      const err = new Error("Wallet is suspended. Contact support.");
      (err as any).code = "WALLET_SUSPENDED";
      (err as any).statusCode = 403;
      throw err;
    }
    if (!input.allowNegativeBalance && wallet.balanceMinor < charge) {
      const err = new Error("Insufficient wallet balance. Reload your wallet to continue sending.");
      (err as any).code = "WALLET_INSUFFICIENT";
      (err as any).statusCode = 402;
      throw err;
    }

    const updated = await OrganizationWalletModel.findOneAndUpdate(
      {
        organizationId: input.organizationId,
        ...(input.allowNegativeBalance ? {} : { balanceMinor: { $gte: charge } }),
      },
      {
        $inc: { balanceMinor: -charge },
        $set: { updatedAt: new Date() },
      },
      { new: true }
    ).lean();

    if (!updated) {
      const err = new Error("Wallet update failed");
      (err as any).statusCode = 500;
      throw err;
    }

    const createdTx = await WalletTransactionModel.create({
      organizationId: input.organizationId,
      type: input.type,
      amountMinor: -charge,
      balanceAfterMinor: updated.balanceMinor,
      currency: updated.currency || input.breakdown.currency,
      metaCategory: input.breakdown.metaCategory,
      metaCostMinor: input.breakdown.metaCostMinor,
      markupMinor: input.breakdown.markupMinor,
      chargedMinor: charge,
      recipientCountryIso: input.breakdown.countryIso,
      rateVersionId: input.breakdown.rateVersionId,
      description: input.description,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      createdByUserId: input.createdByUserId,
      metadata: input.metadata,
    });
    const doc = createdTx.toObject();
    return { ...doc, id: doc._id } as any;
  }

  const charge = input.breakdown.chargedMinor;
  if (charge <= 0) {
    const wallet = await ensureOrganizationWallet(input.organizationId, input.breakdown.currency);
    const [tx] = await db
      .insert(walletTransactions)
      .values({
        organizationId: input.organizationId,
        type: input.type,
        amountMinor: 0,
        balanceAfterMinor: wallet.balanceMinor,
        currency: input.breakdown.currency,
        metaCategory: input.breakdown.metaCategory,
        metaCostMinor: input.breakdown.metaCostMinor,
        markupMinor: input.breakdown.markupMinor,
        chargedMinor: 0,
        recipientCountryIso: input.breakdown.countryIso,
        rateVersionId: input.breakdown.rateVersionId,
        description: input.description,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        createdByUserId: input.createdByUserId,
        metadata: input.metadata,
      })
      .returning();
    return tx!;
  }

  const wallet = await ensureOrganizationWallet(input.organizationId, input.breakdown.currency);
  if (wallet.status === "suspended") {
    const err = new Error("Wallet is suspended. Contact support.");
    (err as any).code = "WALLET_SUSPENDED";
    (err as any).statusCode = 403;
    throw err;
  }
  if (!input.allowNegativeBalance && wallet.balanceMinor < charge) {
    const err = new Error("Insufficient wallet balance. Reload your wallet to continue sending.");
    (err as any).code = "WALLET_INSUFFICIENT";
    (err as any).statusCode = 402;
    throw err;
  }

  const [updated] = await db
    .update(organizationWallets)
    .set({
      balanceMinor: sql`${organizationWallets.balanceMinor} - ${charge}`,
      updatedAt: new Date(),
    })
    .where(eq(organizationWallets.organizationId, input.organizationId))
    .returning({
      balanceMinor: organizationWallets.balanceMinor,
      currency: organizationWallets.currency,
    });

  const row = updated;
  if (!row) {
    const err = new Error("Wallet update failed");
    (err as any).statusCode = 500;
    throw err;
  }

  const balanceAfter = row.balanceMinor;
  const [tx] = await db
    .insert(walletTransactions)
    .values({
      organizationId: input.organizationId,
      type: input.type,
      amountMinor: -charge,
      balanceAfterMinor: balanceAfter,
      currency: row.currency || input.breakdown.currency,
      metaCategory: input.breakdown.metaCategory,
      metaCostMinor: input.breakdown.metaCostMinor,
      markupMinor: input.breakdown.markupMinor,
      chargedMinor: charge,
      recipientCountryIso: input.breakdown.countryIso,
      rateVersionId: input.breakdown.rateVersionId,
      description: input.description,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      createdByUserId: input.createdByUserId,
      metadata: input.metadata,
    })
    .returning();
    return tx!;
}

/** Debit a fixed amount (e.g. SaaS subscription) without Meta conversation breakdown. */
export async function debitWalletFixed(input: WalletFixedDebitInput): Promise<WalletTransactionRow> {
  const charge = Math.round(input.amountMinor);
  if (charge <= 0) {
    throw new Error("Debit amount must be positive");
  }
  const currency = input.currency || "INR";

  if (isMongoEnabled()) {
    const wallet = await ensureOrganizationWallet(input.organizationId, currency);
    if (wallet.status === "suspended") {
      const err = new Error("Wallet is suspended. Contact support.");
      (err as any).code = "WALLET_SUSPENDED";
      (err as any).statusCode = 403;
      throw err;
    }
    if (!input.allowNegativeBalance && wallet.balanceMinor < charge) {
      const err = new Error("Insufficient wallet balance. Reload your wallet to continue.");
      (err as any).code = "WALLET_INSUFFICIENT";
      (err as any).statusCode = 402;
      throw err;
    }

    const updated = await OrganizationWalletModel.findOneAndUpdate(
      {
        organizationId: input.organizationId,
        ...(input.allowNegativeBalance ? {} : { balanceMinor: { $gte: charge } }),
      },
      {
        $inc: { balanceMinor: -charge },
        $set: { updatedAt: new Date() },
      },
      { new: true }
    ).lean();

    if (!updated) {
      const err = new Error("Wallet update failed");
      (err as any).statusCode = 500;
      throw err;
    }

    const createdTx = await WalletTransactionModel.create({
      organizationId: input.organizationId,
      type: input.type,
      amountMinor: -charge,
      balanceAfterMinor: updated.balanceMinor,
      currency: updated.currency || currency,
      chargedMinor: charge,
      metaCostMinor: charge,
      markupMinor: 0,
      description: input.description,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      gatewayOrderId: input.gatewayOrderId,
      gatewayPaymentId: input.gatewayPaymentId,
      createdByUserId: input.createdByUserId,
      metadata: input.metadata,
    });
    const doc = createdTx.toObject();
    return { ...doc, id: doc._id } as any;
  }

  const wallet = await ensureOrganizationWallet(input.organizationId, currency);
  if (wallet.status === "suspended") {
    const err = new Error("Wallet is suspended. Contact support.");
    (err as any).code = "WALLET_SUSPENDED";
    (err as any).statusCode = 403;
    throw err;
  }
  if (!input.allowNegativeBalance && wallet.balanceMinor < charge) {
    const err = new Error("Insufficient wallet balance. Reload your wallet to continue.");
    (err as any).code = "WALLET_INSUFFICIENT";
    (err as any).statusCode = 402;
    throw err;
  }

  const [updated] = await db
    .update(organizationWallets)
    .set({
      balanceMinor: sql`${organizationWallets.balanceMinor} - ${charge}`,
      updatedAt: new Date(),
    })
    .where(eq(organizationWallets.organizationId, input.organizationId))
    .returning({
      balanceMinor: organizationWallets.balanceMinor,
      currency: organizationWallets.currency,
    });

  if (!updated) {
    const err = new Error("Wallet update failed");
    (err as any).statusCode = 500;
    throw err;
  }

  const [tx] = await db
    .insert(walletTransactions)
    .values({
      organizationId: input.organizationId,
      type: input.type,
      amountMinor: -charge,
      balanceAfterMinor: updated.balanceMinor,
      currency: updated.currency || currency,
      chargedMinor: charge,
      metaCostMinor: charge,
      markupMinor: 0,
      description: input.description,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      gatewayOrderId: input.gatewayOrderId,
      gatewayPaymentId: input.gatewayPaymentId,
      createdByUserId: input.createdByUserId,
      metadata: input.metadata,
    })
    .returning();
  return tx!;
}

export async function creditWallet(input: WalletCreditInput): Promise<WalletTransactionRow> {
  const amount = Math.round(input.amountMinor);
  if (amount <= 0) {
    throw new Error("Credit amount must be positive");
  }

  if (isMongoEnabled()) {
    await ensureOrganizationWallet(input.organizationId);
    const updated = await OrganizationWalletModel.findOneAndUpdate(
      { organizationId: input.organizationId },
      {
        $inc: { balanceMinor: amount },
        $set: { updatedAt: new Date() },
      },
      { new: true }
    ).lean();

    if (!updated) throw new Error("Wallet not found");

    const createdTx = await WalletTransactionModel.create({
      organizationId: input.organizationId,
      type: input.type,
      amountMinor: amount,
      balanceAfterMinor: updated.balanceMinor,
      currency: updated.currency || "INR",
      chargedMinor: 0,
      markupMinor: 0,
      description: input.description,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      gatewayOrderId: input.gatewayOrderId,
      gatewayPaymentId: input.gatewayPaymentId,
      createdByUserId: input.createdByUserId,
      metadata: input.metadata,
    });
    const doc = createdTx.toObject();
    return { ...doc, id: doc._id } as any;
  }

  await ensureOrganizationWallet(input.organizationId);

  const [row] = await db
    .update(organizationWallets)
    .set({
      balanceMinor: sql`${organizationWallets.balanceMinor} + ${amount}`,
      updatedAt: new Date(),
    })
    .where(eq(organizationWallets.organizationId, input.organizationId))
    .returning({
      balanceMinor: organizationWallets.balanceMinor,
      currency: organizationWallets.currency,
    });
  if (!row) throw new Error("Wallet not found");

  const [tx] = await db
    .insert(walletTransactions)
    .values({
      organizationId: input.organizationId,
      type: input.type,
      amountMinor: amount,
      balanceAfterMinor: row.balanceMinor,
      currency: row.currency || "INR",
      chargedMinor: 0,
      markupMinor: 0,
      description: input.description,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      gatewayOrderId: input.gatewayOrderId,
      gatewayPaymentId: input.gatewayPaymentId,
      createdByUserId: input.createdByUserId,
      metadata: input.metadata,
    })
    .returning();
  return tx!;
}

export async function createWalletReloadOrder(input: {
  organizationId: string;
  userId: string;
  amountMinor: number;
  currency: string;
  gatewayOrderId: string;
}): Promise<WalletReloadOrderRow> {
  if (isMongoEnabled()) {
    const created = await WalletReloadOrderModel.create({
      organizationId: input.organizationId,
      userId: input.userId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      status: "pending",
      gateway: "razorpay",
      gatewayOrderId: input.gatewayOrderId,
    });
    const doc = created.toObject();
    return { ...doc, id: doc._id } as any;
  }

  const [order] = await db
    .insert(walletReloadOrders)
    .values({
      organizationId: input.organizationId,
      userId: input.userId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      status: "pending",
      paymentGateway: "razorpay",
      gatewayOrderId: input.gatewayOrderId,
    })
    .returning();
  return order!;
}

export async function getWalletReloadOrderByGatewayOrderId(
  gatewayOrderId: string
): Promise<WalletReloadOrderRow | undefined> {
  if (isMongoEnabled()) {
    const row = await WalletReloadOrderModel.findOne({ gatewayOrderId }).lean();
    return row ? ({ ...row, id: row._id } as any) : undefined;
  }

  const [row] = await db
    .select()
    .from(walletReloadOrders)
    .where(eq(walletReloadOrders.gatewayOrderId, gatewayOrderId))
    .limit(1);
  return row;
}

export async function markWalletReloadOrderPaid(
  gatewayOrderId: string,
  gatewayPaymentId: string,
  payload?: Record<string, unknown>
): Promise<WalletTransactionRow | null> {
  if (isMongoEnabled()) {
    const order = await getWalletReloadOrderByGatewayOrderId(gatewayOrderId);
    if (!order) return null;
    if (order.status === "paid") {
      const existingTx = await WalletTransactionModel.findOne({
        gatewayOrderId,
        type: "reload",
      }).lean();
      return existingTx ? ({ ...existingTx, id: existingTx._id } as any) : null;
    }

    await WalletReloadOrderModel.findByIdAndUpdate(order.id, {
      $set: {
        status: "paid",
        gatewayPaymentId,
        gatewayPayload: payload ?? null,
        paidAt: new Date(),
      },
    });

    return creditWallet({
      organizationId: order.organizationId,
      type: "reload",
      amountMinor: order.amountMinor,
      description: `Wallet reload ₹${(order.amountMinor / 100).toFixed(2)}`,
      gatewayOrderId,
      gatewayPaymentId,
      createdByUserId: order.userId,
      metadata: { reloadOrderId: order.id },
    });
  }

  const order = await getWalletReloadOrderByGatewayOrderId(gatewayOrderId);
  if (!order) return null;
  if (order.status === "paid") {
    const [existingTx] = await db
      .select()
      .from(walletTransactions)
      .where(
        and(
          eq(walletTransactions.gatewayOrderId, gatewayOrderId),
          eq(walletTransactions.type, "reload")
        )
      )
      .limit(1);
    return existingTx ?? null;
  }

  await db
    .update(walletReloadOrders)
    .set({
      status: "paid",
      gatewayPaymentId,
      gatewayPayload: payload ?? null,
      paidAt: new Date(),
    })
    .where(eq(walletReloadOrders.id, order.id));

  return creditWallet({
    organizationId: order.organizationId,
    type: "reload",
    amountMinor: order.amountMinor,
    description: `Wallet reload ₹${(order.amountMinor / 100).toFixed(2)}`,
    gatewayOrderId,
    gatewayPaymentId,
    createdByUserId: order.userId,
    metadata: { reloadOrderId: order.id },
  });
}
