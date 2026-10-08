import { getOrgWhatsappBilling } from "./org-billing";
import { getCreditLineProviderConfig } from "./provider-config";
import { getWhitelabelCreditLineFacility } from "../whitelabel-credit-line";

export type CreditLineActiveCheck = {
  active: boolean;
  reason: string;
  solutionId?: string;
  orgBillingMode?: string;
  facilityEnabled?: boolean;
};

/**
 * Credit line is "on" only when:
 * 1) Org billing mode is credit_line, AND
 * 2) SaaS whitelabel facility is enabled (when SaaS is configured), AND
 * 3) Partner Solution ID is present (needed for Haptik/Interakt ES + TP signup).
 *
 * If SaaS facility is not configured (local / no PRODUCTION_KEY), org mode + solutionId is enough.
 */
export async function isCreditLineActiveForOrg(
  organizationId?: string | null
): Promise<CreditLineActiveCheck> {
  if (!organizationId) {
    return { active: false, reason: "no organizationId" };
  }

  const billing = await getOrgWhatsappBilling(organizationId);
  if (billing.billingMode !== "credit_line") {
    return {
      active: false,
      reason: "org billing_mode is self_pay (credit line not enabled for this org)",
      orgBillingMode: billing.billingMode,
    };
  }

  let facilityEnabled: boolean | undefined;
  try {
    const facility = await getWhitelabelCreditLineFacility();
    if (facility.configured) {
      facilityEnabled = facility.enabled;
      if (!facility.enabled) {
        return {
          active: false,
          reason: "SaaS credit-line facility is disabled for this whitelabel",
          orgBillingMode: billing.billingMode,
          facilityEnabled: false,
        };
      }
    }
  } catch (e: any) {
    console.warn(
      "[CreditLine] facility check failed (continuing with org mode):",
      e?.message || e
    );
  }

  const providerId = (billing.creditLineProvider || "interakt").trim();
  const cfg = await getCreditLineProviderConfig(providerId);
  const solutionId = (cfg?.solutionId || "").trim();
  if (!solutionId) {
    return {
      active: false,
      reason: "credit_line enabled but Partner Solution ID is missing",
      orgBillingMode: billing.billingMode,
      facilityEnabled,
    };
  }

  return {
    active: true,
    reason: "credit line enabled (org + facility) with solutionID",
    solutionId,
    orgBillingMode: billing.billingMode,
    facilityEnabled: facilityEnabled ?? true,
  };
}

/**
 * When credit line is enabled and Partner Solution ID is configured, Meta Embedded Signup
 * (with extras.setup.solutionID) + supplier TP-signup already wire the WABA.
 * Re-calling Meta Graph subscribed_apps / assigned_users / register overwrites those
 * permissions (Haptik / Interakt guidance) — skip those Graph mutation calls.
 *
 * Only applies when credit line is enabled — never for self_pay.
 */
export async function shouldSkipMetaGraphSignupForCreditLine(
  organizationId?: string | null
): Promise<{ skip: boolean; reason?: string; solutionId?: string }> {
  const check = await isCreditLineActiveForOrg(organizationId);
  if (!check.active) {
    return { skip: false, reason: check.reason };
  }
  return {
    skip: true,
    solutionId: check.solutionId,
    reason:
      "credit line enabled + solutionID: TP signup owns Meta Graph; skip subscribed_apps/assigned_users/register",
  };
}
