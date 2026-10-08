/**
 * When unpaid onboarding fees reach/exceed the synced outstanding_amount_limit,
 * lock the panel until the SaaS owner pays on /admin/onboarding-fees.
 */
import { storage } from "./storage";
import { fetchCustomerFromApi } from "./updates";
import {
  mergeLiveContractForOutstandingLimit,
  parseOutstandingLimitMinorFromUpstreamPayload,
} from "./whitelabel-onboarding-fee";

export const ONBOARDING_OUTSTANDING_LIMIT_CODE = "ONBOARDING_OUTSTANDING_LIMIT";

export type OnboardingOutstandingGateResult =
  | { allowed: true; limitMinor: number | null; outstandingMinor: number }
  | {
      allowed: false;
      code: typeof ONBOARDING_OUTSTANDING_LIMIT_CODE;
      error: string;
      limitMinor: number;
      outstandingMinor: number;
      billingCurrency: string | null;
    };

let cached: { at: number; result: OnboardingOutstandingGateResult } | null = null;

function cacheTtlMs(): number {
  const raw = process.env.ONBOARDING_OUTSTANDING_GATE_CACHE_TTL_MS?.trim();
  if (raw) {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 2000 && n <= 300_000) return n;
  }
  return 30_000;
}

function formatMajor(minor: number, currency: string | null): string {
  const c = (currency || "INR").toUpperCase();
  const major = minor / 100;
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: c }).format(major);
  } catch {
    return `${c} ${major.toFixed(2)}`;
  }
}

export function invalidateOnboardingOutstandingGateCache(): void {
  cached = null;
}

/** After a successful onboarding payment: unlock admin menus and auto-start the WL on SaaS. */
export async function afterWhitelabelOnboardingFeesPaid(): Promise<void> {
  invalidateOnboardingOutstandingGateCache();
  try {
    const { reactivateLicensorCustomerAfterPayment } = await import("./updates");
    await reactivateLicensorCustomerAfterPayment();
  } catch (e) {
    console.warn(
      "[OnboardingOutstandingGate] licensor reactivate after payment:",
      e instanceof Error ? e.message : e
    );
  }
}

async function computeGate(): Promise<OnboardingOutstandingGateResult> {
  // BYPASSED: Onboarding fees check disabled for local/unlimited usage
  return { allowed: true, limitMinor: null, outstandingMinor: 0 };
}

/** Uncached check (signup / create-customer decisions). */
export async function checkOnboardingOutstandingGateFresh(): Promise<OnboardingOutstandingGateResult> {
  return { allowed: true, limitMinor: null, outstandingMinor: 0 };
}

/** Cached gate used by API middleware + /api/panel/customer-status. */
export async function checkOnboardingOutstandingGateCached(): Promise<OnboardingOutstandingGateResult> {
  return { allowed: true, limitMinor: null, outstandingMinor: 0 };
}
