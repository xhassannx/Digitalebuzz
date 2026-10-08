import { storage } from "../storage";
import type { WhatsappSession } from "@shared/schema";
import type { WalletMetaCategory } from "@shared/schema";
import { isWalletBillingEnabled } from "./config";
import { isOrgCreditLineBilling } from "../credit-line/org-billing";
import {
  assertWalletCanSend,
  recordWalletDebitForSend,
  resolveOrganizationIdForSession,
  resolveTemplateWalletCategory,
} from "./service";
import type { ChargeBreakdown } from "./pricing";
import {
  assertWhitelabelCreditLineFacility,
  debitWhitelabelCreditLineFacility,
} from "../whitelabel-credit-line";

export type OutboundWalletBillingOverrides = {
  debitType?: "debit_message" | "debit_campaign";
  referenceType?: string;
  referenceId?: string;
  description?: string;
};

export type OutboundWalletPrep = {
  organizationId: string;
  userId: string;
  session: WhatsappSession;
  breakdown: ChargeBreakdown | null;
  recipientPhone: string;
  metaCategory: WalletMetaCategory;
  debitType: "debit_message" | "debit_campaign";
  referenceType?: string;
  referenceId?: string;
  description?: string;
};

async function resolveSessionBillingContext(sessionId: string): Promise<{
  session: WhatsappSession;
  organizationId: string;
} | null> {
  const session = await storage.getSession(sessionId);
  if (!session || session.connectionType !== "official") return null;
  const organizationId = await resolveOrganizationIdForSession(session, session.userId, null);
  if (!organizationId) return null;
  return { session, organizationId };
}

export async function prepareOutboundWalletBilling(params: {
  sessionId: string;
  recipientPhone: string;
  metaCategory?: WalletMetaCategory;
  templateName?: string;
  debitType?: "debit_message" | "debit_campaign";
  referenceType?: string;
  referenceId?: string;
  description?: string;
  quantity?: number;
}): Promise<OutboundWalletPrep | null> {
  if (!(await isWalletBillingEnabled())) return null;

  const ctx = await resolveSessionBillingContext(params.sessionId);
  if (!ctx) return null;

  // Meta conversation charges hit the wallet only for credit_line orgs.
  // self_pay: wallet may still be used later for subscriptions/other panel fees.
  if (!(await isOrgCreditLineBilling(ctx.organizationId))) return null;

  let metaCategory: WalletMetaCategory = params.metaCategory ?? "service";
  if (params.templateName) {
    metaCategory = await resolveTemplateWalletCategory(
      params.templateName,
      ctx.session.userId,
      ctx.organizationId,
      ctx.session.deviceInfo?.apiPhoneNumberId
    );
  }

  const breakdown = await assertWalletCanSend({
    organizationId: ctx.organizationId,
    userId: ctx.session.userId,
    session: ctx.session,
    metaCategory,
    quantity: params.quantity ?? 1,
    recipientPhone: params.recipientPhone,
    debitType: params.debitType ?? "debit_message",
  });

  // Second meter: SaaS → whitelabel facility (Meta cost, not customer markup).
  const facilityCost = breakdown?.metaCostMinor ?? 0;
  if (facilityCost > 0) {
    await assertWhitelabelCreditLineFacility(facilityCost);
  }

  return {
    organizationId: ctx.organizationId,
    userId: ctx.session.userId,
    session: ctx.session,
    breakdown,
    recipientPhone: params.recipientPhone,
    metaCategory,
    debitType: params.debitType ?? "debit_message",
    referenceType: params.referenceType,
    referenceId: params.referenceId,
    description: params.description,
  };
}

export async function finalizeOutboundWalletBilling(
  prep: OutboundWalletPrep | null,
  result: { id?: string | null } | null | undefined
): Promise<void> {
  if (!prep) return;
  const messageId = result?.id;
  if (!messageId || typeof messageId !== "string" || !messageId.trim()) return;

  await recordWalletDebitForSend(
    {
      organizationId: prep.organizationId,
      userId: prep.userId,
      session: prep.session,
      metaCategory: prep.metaCategory,
      recipientPhone: prep.recipientPhone,
      debitType: prep.debitType,
      referenceType: prep.referenceType ?? "whatsapp_message",
      referenceId: prep.referenceId ?? messageId,
      description: prep.description,
    },
    prep.breakdown
  );

  const metaCost = prep.breakdown?.metaCostMinor ?? 0;
  if (metaCost > 0) {
    await debitWhitelabelCreditLineFacility({
      amountMinor: metaCost,
      referenceType: prep.referenceType ?? "whatsapp_message",
      referenceId: prep.referenceId ?? messageId,
      description:
        prep.description ||
        `Credit-line Meta ${prep.metaCategory} · org ${prep.organizationId}`,
    });
  }
}

/**
 * Wrap any official Cloud API send: pre-check balance, execute, debit on success (message id present).
 */
export async function withOutboundWalletBilling<T>(
  params: {
    sessionId: string;
    recipientPhone: string;
    metaCategory?: WalletMetaCategory;
    templateName?: string;
    debitType?: "debit_message" | "debit_campaign";
    referenceType?: string;
    referenceId?: string;
    description?: string;
    quantity?: number;
  },
  fn: () => Promise<T>
): Promise<T> {
  const prep = await prepareOutboundWalletBilling(params);
  const result = await fn();
  const id =
    result && typeof result === "object" && result !== null && "id" in result
      ? (result as { id?: string }).id
      : undefined;
  await finalizeOutboundWalletBilling(prep, { id });
  return result;
}
