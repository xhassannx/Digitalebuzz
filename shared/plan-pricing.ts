/** Plan checkout pricing — shared by server checkout and customer billing UI. */

export type PlanPricingInput = {
  priceMonthly: number;
  priceQuarterly: number;
  priceYearly: number;
  currency?: string | null;
  gstType?: string | null;
  gstPercent?: number | null;
  serviceChargePercent?: number | null;
  /** Fixed convenience fee in minor units (paise/cents). */
  serviceChargeFixed?: number | null;
};

export type PlanBillingCycle = "monthly" | "quarterly" | "yearly";

export type PlanCheckoutBreakdown = {
  billingCycle: PlanBillingCycle;
  currency: string;
  /** Listed plan price for the cycle (minor units). */
  baseMinor: number;
  serviceChargeMinor: number;
  /** GST component included in total (added for exclusive; extracted for inclusive display). */
  gstMinor: number;
  /** Amount charged at payment gateway (minor units, plan currency). */
  totalMinor: number;
  gstType: "inclusive" | "exclusive";
  gstPercent: number;
  serviceChargePercent: number;
  serviceChargeFixedMinor: number;
};

export function normalizePlanBillingCycle(raw: unknown): PlanBillingCycle | null {
  const c = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (c === "monthly" || c === "quarterly" || c === "yearly") return c;
  return null;
}

export function getPlanBaseMinor(plan: PlanPricingInput, cycle: PlanBillingCycle): number {
  if (cycle === "monthly") return Math.round(Number(plan.priceMonthly) || 0);
  if (cycle === "quarterly") return Math.round(Number(plan.priceQuarterly) || 0);
  return Math.round(Number(plan.priceYearly) || 0);
}

/**
 * Compute checkout totals for a plan cycle.
 * - exclusive GST: GST is added on (base + service charge)
 * - inclusive GST: base already includes GST; service charge is added on top
 */
export function computePlanCheckoutBreakdown(
  plan: PlanPricingInput,
  billingCycle: PlanBillingCycle
): PlanCheckoutBreakdown {
  const baseMinor = getPlanBaseMinor(plan, billingCycle);
  const gstType =
    String(plan.gstType || "inclusive").toLowerCase() === "exclusive" ? "exclusive" : "inclusive";
  const gstPercent = Math.max(0, Math.min(100, Number(plan.gstPercent) || 0));
  const serviceChargePercent = Math.max(0, Number(plan.serviceChargePercent) || 0);
  const serviceChargeFixedMinor = Math.max(0, Math.round(Number(plan.serviceChargeFixed) || 0));

  const serviceChargeMinor =
    Math.round((baseMinor * serviceChargePercent) / 100) + serviceChargeFixedMinor;

  let gstMinor = 0;
  let totalMinor = baseMinor;

  if (gstType === "exclusive") {
    const taxable = baseMinor + serviceChargeMinor;
    gstMinor = Math.round((taxable * gstPercent) / 100);
    totalMinor = taxable + gstMinor;
  } else {
    if (gstPercent > 0 && baseMinor > 0) {
      gstMinor = Math.round(baseMinor - baseMinor / (1 + gstPercent / 100));
    }
    totalMinor = baseMinor + serviceChargeMinor;
  }

  return {
    billingCycle,
    currency: String(plan.currency || "INR").trim().toUpperCase(),
    baseMinor,
    serviceChargeMinor,
    gstMinor,
    totalMinor,
    gstType,
    gstPercent,
    serviceChargePercent,
    serviceChargeFixedMinor,
  };
}

export function formatPlanMinorAmount(minor: number, currency = "INR"): string {
  const major = (Math.round(Number(minor) || 0) / 100).toFixed(2);
  const c = currency.toUpperCase();
  if (c === "INR") return `₹${major}`;
  if (c === "USD") return `$${major}`;
  return `${major} ${c}`;
}

export function hasPlanPricingExtras(plan: PlanPricingInput): boolean {
  const gst = Number(plan.gstPercent) || 0;
  const svc =
    (Number(plan.serviceChargePercent) || 0) > 0 || (Number(plan.serviceChargeFixed) || 0) > 0;
  return gst > 0 || svc;
}
