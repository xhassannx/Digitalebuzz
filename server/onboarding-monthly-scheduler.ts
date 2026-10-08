import { addDays, addMonths } from "date-fns";
import type { InsertWhitelabelOnboardingFee, User } from "@shared/schema";
import { storage } from "./storage";
import {
  readWhitelabelOnboardingContractFromUpstreamPayload,
  feeMajorToOnboardingMinorUnits,
} from "./whitelabel-onboarding-fee";
import { getOnboardingTrialEndsAt, isSameCalendarMonth, isUserInOnboardingTrial } from "./whitelabel-onboarding-accrual";
import { invalidateOnboardingOutstandingGateCache } from "./onboarding-outstanding-gate";
import {
  isOnboardingBillableEndCustomer,
  waiveOnboardingForTeamMember,
} from "./whitelabel-onboarding-eligibility";

export function isAccountActiveForOnboardingMonthly(
  u: Pick<User, "isActive" | "accountStatus" | "isSaaSOwner">
): boolean {
  return !u.isSaaSOwner && u.isActive && u.accountStatus === "active";
}

/**
 * When a panel customer becomes active again, start the next monthly licensor fee cycle one month out
 * (no catch-up for months while inactive).
 */
async function rescheduleWhitelabelOnboardingAfterReactivation(userId: string): Promise<void> {
  const next = addMonths(new Date(), 1);
  await storage.updateUserOnboardingSchedule(userId, { onboardingNextChargeAt: next });
}

export async function onUserUpdatedForOnboardingBilling(prev: User, next: User): Promise<void> {
  const was = isAccountActiveForOnboardingMonthly(prev);
  const now = isAccountActiveForOnboardingMonthly(next);
  if (!was && now) {
    await rescheduleWhitelabelOnboardingAfterReactivation(next.id);
  }
}

type OnboardingContract = NonNullable<ReturnType<typeof readWhitelabelOnboardingContractFromUpstreamPayload>>;

async function processOneUser(user: User, contract: OnboardingContract, now: Date): Promise<void> {
  const fresh = await storage.getUser(user.id);
  if (!fresh) return;
  user = fresh;
  if (!user.createdAt) return;

  const billable = await isOnboardingBillableEndCustomer(user.id);
  if (!billable) {
    const ownsOrg = await storage.userOwnsAnyOrganization(user.id);
    if (!ownsOrg || user.isSaaSOwner) {
      await waiveOnboardingForTeamMember(user.id);
    }
    return;
  }

  if (isUserInOnboardingTrial(user, contract.trialDays, now)) {
    const trialEnd = getOnboardingTrialEndsAt(user, contract.trialDays);
    await storage.updateUserOnboardingSchedule(user.id, { onboardingNextChargeAt: trialEnd });
    return;
  }

  const ownSub = await storage.getActiveSubscriptionByUser(user.id);
  if (!ownSub) return;

  const userRank = await storage.countOnboardingBillableUsersCreatedBefore(user.createdAt, user.id);
  const exempt = contract.included > 0 && userRank < contract.included;
  if (exempt) {
    await storage.updateUserOnboardingSchedule(user.id, {
      onboardingMonthlyWaived: true,
      onboardingNextChargeAt: null,
    });
    return;
  }

  let nextAt = user.onboardingNextChargeAt ?? null;
  if (nextAt == null) {
    const trialEnd = getOnboardingTrialEndsAt(user, contract.trialDays);
    let chargeFrom = addDays(user.createdAt, contract.trialDays);
    if (trialEnd && trialEnd.getTime() > chargeFrom.getTime()) {
      chargeFrom = trialEnd;
    }
    if (chargeFrom.getTime() > now.getTime()) {
      await storage.updateUserOnboardingSchedule(user.id, { onboardingNextChargeAt: chargeFrom });
      return;
    }
    await storage.updateUserOnboardingSchedule(user.id, { onboardingNextChargeAt: chargeFrom });
    nextAt = chargeFrom;
  }

  if (nextAt.getTime() > now.getTime()) return;

  if (!ownSub) return;

  const amountMinor = feeMajorToOnboardingMinorUnits(contract.feeMajor, contract.currency);
  if (amountMinor <= 0) return;

  const sub = ownSub;
  const existingFees = await storage.listWhitelabelOnboardingFeesForUser(user.id);

  let guard = 0;
  let chargeCursor = new Date(nextAt);
  while (chargeCursor.getTime() <= now.getTime() && guard < 48) {
    guard++;
    const alreadyThisMonth = existingFees.some(
      (f) => f.status !== "cancelled" && f.dueAt && isSameCalendarMonth(new Date(f.dueAt), chargeCursor)
    );
    if (!alreadyThisMonth) {
      const row: InsertWhitelabelOnboardingFee = {
        userId: user.id,
        subscriptionId: sub?.id ?? null,
        subscriptionHistoryId: null,
        trigger: "monthly",
        amountMinor,
        currency: contract.currency,
        dueAt: new Date(chargeCursor),
        status: "pending",
        paidAt: null,
        gatewayOrderId: null,
        gatewayPaymentId: null,
      };
      const inserted = await storage.insertWhitelabelOnboardingFee(row);
      existingFees.push(inserted);
    }
    chargeCursor = addMonths(chargeCursor, 1);
  }

  await storage.updateUserOnboardingSchedule(user.id, { onboardingNextChargeAt: chargeCursor });
  invalidateOnboardingOutstandingGateCache();
}

/** Re-run monthly accrual for one end-customer (recalculate / catch-up). */
export async function runWhitelabelOnboardingForUser(
  user: User,
  contract: OnboardingContract,
  now: Date = new Date()
): Promise<void> {
  await processOneUser(user, contract, now);
}

/**
 * Creates monthly "Customer onboarding" fee rows per synced licensor contract.
 * Only org owners with their own active subscription (not team members / WL admin).
 */
export async function runWhitelabelOnboardingMonthlyTick(): Promise<void> {
  const master = await storage.getPlatformMasterSettings();
  const contract = readWhitelabelOnboardingContractFromUpstreamPayload(master?.upstreamPayload ?? null);
  if (!contract) return;

  const now = new Date();
  const candidates = await storage.getUsersDueForWhitelabelOnboardingMonthly(now);

  for (const user of candidates) {
    try {
      await processOneUser(user, contract, now);
    } catch (e) {
      console.error("[OnboardingMonthly] user", user.id, e);
    }
  }
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * Background accrual for monthly licensor onboarding fees.
 * DISABLE_WHITELABEL_ONBOARDING_MONTHLY_SCHEDULER=true to turn off.
 * WHITELABEL_ONBOARDING_MONTHLY_INTERVAL_MS overrides interval (default 1h).
 */
export function startWhitelabelOnboardingMonthlyScheduler(): void {
  if (process.env.DISABLE_WHITELABEL_ONBOARDING_MONTHLY_SCHEDULER === "true") {
    console.log("[OnboardingMonthly] Scheduler disabled (DISABLE_WHITELABEL_ONBOARDING_MONTHLY_SCHEDULER=true)");
    return;
  }

  const intervalMs = Math.max(
    60_000,
    parseInt(process.env.WHITELABEL_ONBOARDING_MONTHLY_INTERVAL_MS || String(HOUR_MS), 10) || HOUR_MS
  );

  const tick = () => {
    void runWhitelabelOnboardingMonthlyTick().catch((e) => console.error("[OnboardingMonthly] tick error:", e));
  };

  setTimeout(tick, 90_000);
  setInterval(tick, intervalMs);
  console.log(
    `[OnboardingMonthly] Scheduler started: first run in 90s, then every ${Math.round(intervalMs / 1000)}s`
  );
}
