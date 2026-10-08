import { storage } from "../storage";
import type { WhatsappSession } from "@shared/schema";
import type { WalletMetaCategory } from "@shared/schema";
import { getWalletBillingConfig, isWalletBillingEnabled } from "./config";
import {
  categoryFromTemplateDb,
  computeCharge,
  formatChargeDescription,
  normalizeMetaCategory,
  type ChargeBreakdown,
} from "./pricing";
import { resolveCountryIsoFromPhone } from "./country-resolve";
import {
  debitWallet,
  ensureOrganizationWallet,
  getOrganizationWallet,
  listWalletTransactions,
} from "./wallet-db";
import { maybeSendLowBalanceEmail } from "./low-balance-alerts";

export type WalletSendContext = {
  organizationId: string;
  userId?: string;
  session: Pick<WhatsappSession, "connectionType" | "id">;
  metaCategory: WalletMetaCategory;
  quantity?: number;
  recipientPhone?: string | null;
  referenceType?: string;
  referenceId?: string;
  debitType?: "debit_message" | "debit_campaign";
  description?: string;
};

export async function resolveOrganizationIdForSession(
  session: WhatsappSession,
  userId: string,
  organizationIdHint?: string | null
): Promise<string | null> {
  if (organizationIdHint) return organizationIdHint;
  if (session.organizationId) return session.organizationId;
  const orgs = await storage.getOrganizationsByUser(userId);
  return orgs[0]?.id ?? null;
}

export async function resolveTemplateWalletCategory(
  templateName: string,
  userId: string,
  organizationId: string | null,
  phoneNumberId?: string | null
): Promise<WalletMetaCategory> {
  try {
    const templates = organizationId
      ? await storage.getMessageTemplatesByOrganization(organizationId, phoneNumberId || undefined)
      : await storage.getMessageTemplatesByUser(userId, undefined, phoneNumberId || undefined);
    const match = templates.find(
      (t) =>
        t.name === templateName &&
        (!phoneNumberId || !t.phoneNumberId || t.phoneNumberId === phoneNumberId)
    );
    if (match?.category) return categoryFromTemplateDb(match.category);
  } catch (_) {}
  return "marketing";
}

async function buildChargeForContext(ctx: WalletSendContext): Promise<ChargeBreakdown> {
  const config = await getWalletBillingConfig();
  const countryIso = await resolveCountryIsoFromPhone(
    ctx.recipientPhone,
    config.defaultCountryIso || "IN"
  );
  return computeCharge({
    config,
    metaCategory: ctx.metaCategory,
    quantity: ctx.quantity ?? 1,
    countryIso,
  });
}

/** Pre-flight: throws if wallet billing on and balance too low. */
export async function assertWalletCanSend(ctx: WalletSendContext): Promise<ChargeBreakdown | null> {
  if (!(await isWalletBillingEnabled())) return null;
  if (ctx.session.connectionType !== "official") return null;

  const breakdown = await buildChargeForContext(ctx);
  if (breakdown.chargedMinor <= 0) return breakdown;

  const wallet = await ensureOrganizationWallet(ctx.organizationId, breakdown.currency);
  if (wallet.status === "suspended") {
    const err = new Error("Wallet is suspended. Contact support.");
    (err as any).statusCode = 403;
    throw err;
  }
  if (!configAllowsOverdraft(await getWalletBillingConfig()) && wallet.balanceMinor < breakdown.chargedMinor) {
    const sym = breakdown.currency === "INR" ? "₹" : `${breakdown.currency} `;
    const err = new Error(
      `Insufficient wallet balance (${sym}${(wallet.balanceMinor / 100).toFixed(2)}). Reload at least ${sym}${(breakdown.chargedMinor / 100).toFixed(2)} to send.`
    );
    (err as any).code = "WALLET_INSUFFICIENT";
    (err as any).statusCode = 402;
    (err as any).requiredMinor = breakdown.chargedMinor;
    (err as any).balanceMinor = wallet.balanceMinor;
    throw err;
  }
  return breakdown;
}

function configAllowsOverdraft(config: Awaited<ReturnType<typeof getWalletBillingConfig>>): boolean {
  return !!config.allowNegativeBalance;
}

/** Post-send ledger debit with full breakdown on the transaction row. */
export async function recordWalletDebitForSend(
  ctx: WalletSendContext,
  breakdown?: ChargeBreakdown | null
): Promise<void> {
  if (!(await isWalletBillingEnabled())) return;
  if (ctx.session.connectionType !== "official") return;

  const config = await getWalletBillingConfig();
  const bd = breakdown ?? (await buildChargeForContext(ctx));
  const desc =
    ctx.description ||
    `${ctx.debitType === "debit_campaign" ? "Campaign" : "Message"} · ${formatChargeDescription(bd)}`;

  const tx = await debitWallet({
    organizationId: ctx.organizationId,
    type: ctx.debitType || "debit_message",
    breakdown: bd,
    description: desc,
    referenceType: ctx.referenceType,
    referenceId: ctx.referenceId,
    createdByUserId: ctx.userId,
    allowNegativeBalance: configAllowsOverdraft(config),
    metadata: {
      sessionId: ctx.session.id,
      metaCategory: bd.metaCategory,
      recipientPhone: ctx.recipientPhone,
    },
  });

  const wallet = await getOrganizationWallet(ctx.organizationId);
  if (wallet) {
    await maybeSendLowBalanceEmail({
      organizationId: ctx.organizationId,
      balanceMinor: wallet.balanceMinor,
      currency: wallet.currency,
      lastTransactionId: tx.id,
    });
  }
}

export async function withOfficialSendBilling<T>(
  ctx: WalletSendContext,
  sendFn: () => Promise<T>
): Promise<T> {
  const breakdown = await assertWalletCanSend(ctx);
  const result = await sendFn();
  await recordWalletDebitForSend(ctx, breakdown);
  return result;
}

export async function getWalletSummary(organizationId: string) {
  const config = await getWalletBillingConfig();
  const wallet = await ensureOrganizationWallet(organizationId, config.currency || "INR");
  const transactions = await listWalletTransactions(organizationId, 100, 0);
  const lowThreshold = config.lowBalanceThresholdMinor ?? 0;
  return {
    config: {
      enabled: !!config.enabled,
      currency: config.currency || "INR",
      markupEnabled: !!config.markupEnabled,
      metaRatesMinor: config.metaRatesMinor,
      lowBalanceThresholdMinor: lowThreshold,
      useCountryRateVersions: config.useCountryRateVersions !== false,
    },
    wallet: {
      organizationId: wallet.organizationId,
      balanceMinor: wallet.balanceMinor,
      currency: wallet.currency,
      status: wallet.status,
      lowBalance: lowThreshold > 0 && wallet.balanceMinor <= lowThreshold,
    },
    transactions,
  };
}

/** Sum worst-case per-recipient charges for campaign pre-check. */
export async function assertCampaignWalletBudget(params: {
  organizationId: string;
  session: Pick<WhatsappSession, "connectionType" | "id">;
  metaCategory: WalletMetaCategory;
  recipientPhones: string[];
}): Promise<void> {
  const config = await getWalletBillingConfig();
  let totalCharged = 0;
  let currency = config.currency || "INR";

  for (const phone of params.recipientPhones) {
    const bd = await computeCharge({
      config,
      metaCategory: params.metaCategory,
      quantity: 1,
      countryIso: await resolveCountryIsoFromPhone(phone, config.defaultCountryIso || "IN"),
    });
    totalCharged += bd.chargedMinor;
    currency = bd.currency;
  }

  if (totalCharged <= 0) return;

  const wallet = await ensureOrganizationWallet(params.organizationId, currency);
  if (!configAllowsOverdraft(config) && wallet.balanceMinor < totalCharged) {
    const sym = currency === "INR" ? "₹" : `${currency} `;
    const err = new Error(
      `Insufficient wallet for campaign (${params.recipientPhones.length} recipients, ~${sym}${(totalCharged / 100).toFixed(2)} required, balance ${sym}${(wallet.balanceMinor / 100).toFixed(2)}).`
    );
    (err as any).code = "WALLET_INSUFFICIENT";
    (err as any).statusCode = 402;
    throw err;
  }
}

export { normalizeMetaCategory, categoryFromTemplateDb, computeCharge, getOrganizationWallet };
