import type { WhatsappSession } from "@shared/schema";
import type { WalletMetaCategory } from "@shared/schema";
import { isWalletBillingEnabled } from "./config";
import {
  withOfficialSendBilling,
  resolveOrganizationIdForSession,
  type WalletSendContext,
} from "./service";

export async function officialSendWithWallet<T>(params: {
  session: WhatsappSession;
  userId: string;
  organizationId?: string | null;
  metaCategory: WalletMetaCategory;
  recipientPhone?: string | null;
  referenceType?: string;
  referenceId?: string;
  debitType?: "debit_message" | "debit_campaign";
  description?: string;
  send: () => Promise<T>;
}): Promise<T> {
  if (!(await isWalletBillingEnabled()) || params.session.connectionType !== "official") {
    return params.send();
  }
  const organizationId = await resolveOrganizationIdForSession(
    params.session,
    params.userId,
    params.organizationId
  );
  if (!organizationId) {
    const err = new Error("Organization is required for wallet billing. Set organization context or join an organization.");
    (err as any).statusCode = 400;
    throw err;
  }
  const ctx: WalletSendContext = {
    organizationId,
    userId: params.userId,
    session: params.session,
    metaCategory: params.metaCategory,
    recipientPhone: params.recipientPhone,
    referenceType: params.referenceType,
    referenceId: params.referenceId,
    debitType: params.debitType || "debit_message",
    description: params.description,
  };
  return withOfficialSendBilling(ctx, params.send);
}
