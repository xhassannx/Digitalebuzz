/**
 * Normalize user-facing payment amounts (major currency units, e.g. INR rupees).
 * Guards against comma-separated thousands (e.g. "4,500" → 4500) and Razorpay paise in triggers.
 */

export function parsePaymentAmountMajor(raw: unknown): number {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw <= 0) throw new Error("Invalid payment amount");
    return raw;
  }
  const s = String(raw ?? "")
    .trim()
    .replace(/^INR\s*/i, "")
    .replace(/^₹\s*/, "")
    .replace(/,/g, "")
    .replace(/[^\d.]/g, "");
  if (!s) throw new Error("Payment amount is required");
  const n = parseFloat(s);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid payment amount: ${raw}`);
  return n;
}

function triggerAmountLooksLikeRazorpayPaise(
  value: number,
  triggerContext: Record<string, unknown>
): boolean {
  if (!Number.isFinite(value) || value < 100) return false;
  if (triggerContext.payment_id != null || triggerContext.razorpay_payment_id != null) {
    return true;
  }
  if (triggerContext.event != null && String(triggerContext.event).includes("payment")) {
    return Number.isInteger(value) && value >= 100;
  }
  // Razorpay amounts are integer paise; major totals from Shopify/Woo are usually decimal strings.
  return Number.isInteger(value) && value >= 1000 && value % 100 === 0;
}

/** Parse amount from flow config — supports plain number or trigger variables after interpolation. */
export function parseFlowPaymentAmount(
  raw: unknown,
  triggerContext?: Record<string, unknown>
): number {
  const s = String(raw ?? "").trim();
  if (!s) throw new Error("Payment amount is required");

  if (!/\{\{/.test(s)) {
    try {
      return parsePaymentAmountMajor(s);
    } catch {
      // fall through to trigger context
    }
  }

  if (triggerContext) {
    const fromTrigger =
      triggerContext.total_price ??
      triggerContext.total ??
      triggerContext.amount ??
      (triggerContext.trigger as Record<string, unknown> | undefined)?.total_price;
    if (fromTrigger != null && String(fromTrigger).trim() !== "") {
      const tn = parsePaymentAmountMajor(fromTrigger);
      if (triggerAmountLooksLikeRazorpayPaise(tn, triggerContext)) {
        return tn / 100;
      }
      return tn;
    }
  }

  if (!/\{\{/.test(s)) {
    return parsePaymentAmountMajor(s);
  }

  throw new Error(`Invalid payment amount: ${s}`);
}

export function amountMinorForCurrency(amountMajor: number, currency: string): number {
  const major = parsePaymentAmountMajor(amountMajor);
  const c = currency.toUpperCase();
  if (c === "INR") return Math.round(major * 100);
  return Math.round(major * 100);
}

/** Display major units from plan minor price (matches billing UI: ₹500.00 ← 50000). */
export function planPriceMinorToMajor(amountPlanMinor: number): number {
  const minor = Math.round(Number(amountPlanMinor) || 0);
  return minor / 100;
}

/**
 * Razorpay `amount` for INR must be integer paise.
 * INR plans: exact rupees shown in UI (500.00 → 50000 paise) — never multiply by USD/INR rate.
 * USD plans: convert dollar major units to INR paise using USD_INR_EXCHANGE_RATE (default 83).
 */
export function planPriceMinorToRazorpayPaise(
  amountPlanMinor: number,
  planCurrency: string | null | undefined
): number {
  const minor = Math.round(Number(amountPlanMinor) || 0);
  if (minor <= 0) return 0;
  const c = String(planCurrency || "INR").trim().toUpperCase();
  const major = planPriceMinorToMajor(minor);
  if (c === "INR") {
    return Math.round(major * 100);
  }
  const rate = Number(process.env.USD_INR_EXCHANGE_RATE) || 83;
  return Math.round(major * rate * 100);
}

/** Human-readable INR charge for logs and API responses (e.g. 500). */
export function planRazorpayChargeInrMajor(
  amountPlanMinor: number,
  planCurrency: string | null | undefined
): number {
  const paise = planPriceMinorToRazorpayPaise(amountPlanMinor, planCurrency);
  return paise / 100;
}

/** Razorpay order `receipt` max length is 40 characters. */
export function razorpayOrderReceipt(prefix = "sub_"): string {
  const raw = `${prefix}${Date.now()}`;
  return raw.length <= 40 ? raw : raw.slice(0, 40);
}

export type RazorpayPlanPeriod = "monthly" | "quarterly" | "yearly";
export type SaasBillingCycle = RazorpayPlanPeriod;

const RAZORPAY_MAX_SUBSCRIPTION_TOTAL_COUNT = 400;

/** Normalize billing cycle from API / UI (monthly | quarterly | yearly). */
export function normalizeSaasBillingCycle(raw: unknown): SaasBillingCycle | null {
  const c = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (c === "monthly" || c === "quarterly" || c === "yearly") return c;
  return null;
}

/** Map panel billing cycle to Razorpay plan period + interval. */
export function razorpayPlanPeriodForBillingCycle(billingCycle: string): {
  period: RazorpayPlanPeriod;
  interval: number;
} {
  const normalized = normalizeSaasBillingCycle(billingCycle) || "monthly";
  const map: Record<SaasBillingCycle, { period: RazorpayPlanPeriod; interval: number }> = {
    monthly: { period: "monthly", interval: 1 },
    quarterly: { period: "quarterly", interval: 1 },
    yearly: { period: "yearly", interval: 1 },
  };
  return map[normalized];
}

/**
 * Razorpay caps subscription `total_count` at 400 billing cycles for the plan period/interval.
 * Use the largest allowed count (~up to 100 years depending on cadence).
 */
export function razorpaySubscriptionTotalCount(
  period: RazorpayPlanPeriod | "daily" | "weekly",
  interval: number
): number {
  const step = Math.max(1, Math.floor(interval) || 1);
  let cyclesFor100Years: number;
  switch (period) {
    case "yearly":
      // 100 yearly charges = 100 years (under Razorpay 400 cap)
      cyclesFor100Years = 100;
      break;
    case "quarterly":
      cyclesFor100Years = 100 * 4;
      break;
    case "monthly":
      cyclesFor100Years = Math.floor((100 * 12) / step);
      break;
    case "weekly":
      cyclesFor100Years = Math.floor((100 * 52) / step);
      break;
    case "daily":
      cyclesFor100Years = Math.floor((100 * 365) / step);
      break;
    default:
      cyclesFor100Years = RAZORPAY_MAX_SUBSCRIPTION_TOTAL_COUNT;
  }
  return Math.min(RAZORPAY_MAX_SUBSCRIPTION_TOTAL_COUNT, Math.max(1, cyclesFor100Years));
}

/** Razorpay plan + subscription `total_count` for panel billing (monthly / quarterly / yearly). */
export function razorpaySubscriptionConfigForBillingCycle(billingCycle: string): {
  billingCycle: SaasBillingCycle;
  period: RazorpayPlanPeriod;
  interval: number;
  totalCount: number;
} {
  const normalized = normalizeSaasBillingCycle(billingCycle);
  if (!normalized) {
    throw new Error(`Invalid billing cycle: ${billingCycle}. Use monthly, quarterly, or yearly.`);
  }
  const { period, interval } = razorpayPlanPeriodForBillingCycle(normalized);
  const totalCount = razorpaySubscriptionTotalCount(period, interval);
  return { billingCycle: normalized, period, interval, totalCount };
}
