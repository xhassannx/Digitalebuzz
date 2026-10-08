import { db } from "../../db";
import {
  organizationWhatsappBilling,
  type OrganizationWhatsappBillingRow,
  type WhatsappOrgBillingMode,
} from "@shared/schema";
import { eq } from "drizzle-orm";

export type OrgWhatsappBilling = {
  organizationId: string;
  billingMode: WhatsappOrgBillingMode;
  creditLineProvider: string | null;
  creditLineStatus: OrganizationWhatsappBillingRow["creditLineStatus"];
  creditLineWabaId: string | null;
  creditLinePhoneNumberId: string | null;
  creditLineMetadata: Record<string, unknown> | null;
  lastError: string | null;
};

const DEFAULT: Omit<OrgWhatsappBilling, "organizationId"> = {
  billingMode: "self_pay",
  creditLineProvider: null,
  creditLineStatus: "inactive",
  creditLineWabaId: null,
  creditLinePhoneNumberId: null,
  creditLineMetadata: null,
  lastError: null,
};

function mapRow(row: OrganizationWhatsappBillingRow): OrgWhatsappBilling {
  return {
    organizationId: row.organizationId,
    billingMode: (row.billingMode as WhatsappOrgBillingMode) || "self_pay",
    creditLineProvider: row.creditLineProvider,
    creditLineStatus: row.creditLineStatus,
    creditLineWabaId: row.creditLineWabaId,
    creditLinePhoneNumberId: row.creditLinePhoneNumberId,
    creditLineMetadata: (row.creditLineMetadata as Record<string, unknown>) || null,
    lastError: row.lastError,
  };
}

export async function getOrgWhatsappBilling(organizationId: string): Promise<OrgWhatsappBilling> {
  const [row] = await db
    .select()
    .from(organizationWhatsappBilling)
    .where(eq(organizationWhatsappBilling.organizationId, organizationId))
    .limit(1);
  if (!row) return { organizationId, ...DEFAULT };
  return mapRow(row);
}

export async function isOrgCreditLineBilling(organizationId: string | null | undefined): Promise<boolean> {
  if (!organizationId) return false;
  const billing = await getOrgWhatsappBilling(organizationId);
  return billing.billingMode === "credit_line";
}

export async function upsertOrgWhatsappBilling(input: {
  organizationId: string;
  billingMode?: WhatsappOrgBillingMode;
  creditLineProvider?: string | null;
  creditLineStatus?: OrganizationWhatsappBillingRow["creditLineStatus"];
  creditLineWabaId?: string | null;
  creditLinePhoneNumberId?: string | null;
  creditLineMetadata?: Record<string, unknown> | null;
  lastError?: string | null;
  updatedByUserId?: string | null;
}): Promise<OrgWhatsappBilling> {
  const current = await getOrgWhatsappBilling(input.organizationId);
  const next = {
    organizationId: input.organizationId,
    billingMode: input.billingMode ?? current.billingMode,
    creditLineProvider:
      input.creditLineProvider !== undefined ? input.creditLineProvider : current.creditLineProvider,
    creditLineStatus: input.creditLineStatus ?? current.creditLineStatus,
    creditLineWabaId:
      input.creditLineWabaId !== undefined ? input.creditLineWabaId : current.creditLineWabaId,
    creditLinePhoneNumberId:
      input.creditLinePhoneNumberId !== undefined
        ? input.creditLinePhoneNumberId
        : current.creditLinePhoneNumberId,
    creditLineMetadata:
      input.creditLineMetadata !== undefined ? input.creditLineMetadata : current.creditLineMetadata,
    lastError: input.lastError !== undefined ? input.lastError : current.lastError,
    updatedByUserId: input.updatedByUserId ?? null,
    updatedAt: new Date(),
  };

  if (next.billingMode === "credit_line" && !next.creditLineProvider) {
    next.creditLineProvider = "interakt";
  }
  if (next.billingMode === "self_pay") {
    next.creditLineStatus = next.creditLineStatus === "active" ? "inactive" : next.creditLineStatus;
  }

  await db
    .insert(organizationWhatsappBilling)
    .values({
      organizationId: next.organizationId,
      billingMode: next.billingMode,
      creditLineProvider: next.creditLineProvider,
      creditLineStatus: next.creditLineStatus,
      creditLineWabaId: next.creditLineWabaId,
      creditLinePhoneNumberId: next.creditLinePhoneNumberId,
      creditLineMetadata: next.creditLineMetadata,
      lastError: next.lastError,
      updatedByUserId: next.updatedByUserId,
      updatedAt: next.updatedAt,
    })
    .onConflictDoUpdate({
      target: organizationWhatsappBilling.organizationId,
      set: {
        billingMode: next.billingMode,
        creditLineProvider: next.creditLineProvider,
        creditLineStatus: next.creditLineStatus,
        creditLineWabaId: next.creditLineWabaId,
        creditLinePhoneNumberId: next.creditLinePhoneNumberId,
        creditLineMetadata: next.creditLineMetadata,
        lastError: next.lastError,
        updatedByUserId: next.updatedByUserId,
        updatedAt: next.updatedAt,
      },
    });

  return getOrgWhatsappBilling(input.organizationId);
}
