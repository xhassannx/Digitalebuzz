import { isCreditLineActiveForOrg } from "./skip-meta-graph-signup";

/**
 * Build Embedded Signup `extras.setup` for this org.
 * Only when credit line is enabled: include supplier solutionID so Meta attaches Haptik/Interakt.
 * Self-pay orgs never get solutionID.
 */
export async function buildEmbeddedSignupSetup(
  organizationId?: string | null
): Promise<Record<string, unknown>> {
  const setup: Record<string, unknown> = {};
  const partnerBizId = (process.env.META_PARTNER_BUSINESS_ID || "").trim();
  if (partnerBizId) {
    setup.business = { id: partnerBizId };
  }

  if (!organizationId) return setup;

  try {
    const check = await isCreditLineActiveForOrg(organizationId);
    if (!check.active || !check.solutionId) {
      if (organizationId) {
        console.log(
          `[CreditLine] Embedded Signup setup: no solutionID — ${check.reason}`
        );
      }
      return setup;
    }
    // Interakt / Meta Partner Solutions: solutionID on extras.setup
    setup.solutionID = check.solutionId;
    console.log(
      `[CreditLine] Embedded Signup setup: solutionID applied (credit line enabled)`
    );
  } catch (e: any) {
    console.warn("[CreditLine] buildEmbeddedSignupSetup failed:", e?.message || e);
  }

  return setup;
}
