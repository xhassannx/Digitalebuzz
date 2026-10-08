import { addDays, addMonths } from "date-fns";
import type { InsertWhitelabelOnboardingFee, User, WhitelabelOnboardingFeeRow } from "@shared/schema";
import { TRIAL_ACCOUNT_DAYS } from "@shared/trial-account";
import { storage } from "./storage";
import {
  feeMajorToOnboardingMinorUnits,
  readWhitelabelOnboardingContractFromUpstreamPayload,
} from "./whitelabel-onboarding-fee";
import { invalidateOnboardingOutstandingGateCache } from "./onboarding-outstanding-gate";
import {
  isOnboardingBillableEndCustomer,
  waiveOnboardingForTeamMember,
} from "./whitelabel-onboarding-eligibility";

export type InitialOnboardingTrigger = "assigned" | "purchased";

export type InitialOnboardingAccrual =
  | {
      status: "skipped";
      reason:
        | "no_contract"
        | "saas_owner"
        | "trial"
        | "included_user"
        | "no_subscription"
        | "already_accrued"
        | "zero_fee"
        | "inactive"
        | "team_member"
        | "not_org_owner";
    }
  | { status: "waived"; userId: string }
  | { status: "accrued"; fee: WhitelabelOnboardingFeeRow };

export function isSameCalendarMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function isBillableAccount(user: Pick<User, "isSaaSOwner" | "isActive" | "accountStatus">): boolean {
  return !user.isSaaSOwner && user.isActive && user.accountStatus === "active";
}

type TrialUser = Pick<User, "isTrialAccount" | "trialExpiresAt" | "createdAt">;

/** When onboarding billing may start (explicit trial account and/or licensor free_trial_days). */
export function getOnboardingTrialEndsAt(user: TrialUser, licensorTrialDays: number): Date | null {
  const ends: Date[] = [];
  if (user.isTrialAccount) {
    if (user.trialExpiresAt) ends.push(new Date(user.trialExpiresAt));
    else ends.push(addDays(user.createdAt ? new Date(user.createdAt) : new Date(), TRIAL_ACCOUNT_DAYS));
  }
  const days = Math.max(0, Math.floor(licensorTrialDays || 0));
  if (days > 0 && user.createdAt) {
    ends.push(addDays(new Date(user.createdAt), days));
  }
  if (ends.length === 0) return null;
  return new Date(Math.max(...ends.map((d) => d.getTime())));
}

/** No onboarding fee while the customer is still in trial. */
export function isUserInOnboardingTrial(user: TrialUser, licensorTrialDays: number, now: Date = new Date()): boolean {
  const end = getOnboardingTrialEndsAt(user, licensorTrialDays);
  return !!end && end.getTime() > now.getTime();
}

/**
 * First onboarding fee for a new/activated customer (admin create or website signup).
 * Idempotent per user per calendar month. Sets next monthly charge to +1 month.
 * Never charges during trial (is_trial_account or licensor free_trial_days).
 */
export async function accrueInitialWhitelabelOnboardingFee(
  userId: string,
  trigger: InitialOnboardingTrigger
): Promise<InitialOnboardingAccrual> {
  const user = await storage.getUser(userId);
  if (!user) return { status: "skipped", reason: "inactive" };
  if (!isBillableAccount(user)) return { status: "skipped", reason: user.isSaaSOwner ? "saas_owner" : "inactive" };

  const ownsOrg = await storage.userOwnsAnyOrganization(user.id);
  if (!ownsOrg) {
    await waiveOnboardingForTeamMember(user.id);
    return { status: "skipped", reason: "team_member" };
  }

  const master = await storage.getPlatformMasterSettings();
  const contract = readWhitelabelOnboardingContractFromUpstreamPayload(master?.upstreamPayload ?? null);
  if (!contract) return { status: "skipped", reason: "no_contract" };

  const now = new Date();
  if (isUserInOnboardingTrial(user, contract.trialDays, now)) {
    const trialEnd = getOnboardingTrialEndsAt(user, contract.trialDays);
    await storage.updateUserOnboardingSchedule(user.id, {
      onboardingMonthlyWaived: false,
      onboardingNextChargeAt: trialEnd,
    });
    return { status: "skipped", reason: "trial" };
  }

  const amountMinor = feeMajorToOnboardingMinorUnits(contract.feeMajor, contract.currency);
  if (amountMinor <= 0) return { status: "skipped", reason: "zero_fee" };

  const createdAt = user.createdAt ?? new Date();
  const userRank = await storage.countOnboardingBillableUsersCreatedBefore(createdAt, user.id);
  const exempt = contract.included > 0 && userRank < contract.included;
  if (exempt) {
    await storage.updateUserOnboardingSchedule(user.id, {
      onboardingMonthlyWaived: true,
      onboardingNextChargeAt: null,
    });
    invalidateOnboardingOutstandingGateCache();
    return { status: "waived", userId: user.id };
  }

  const ownSub = await storage.getActiveSubscriptionByUser(user.id);
  if (!ownSub) return { status: "skipped", reason: "no_subscription" };

  const existing = await storage.listWhitelabelOnboardingFeesForUser(user.id);
  const alreadyThisMonth = existing.some(
    (f) => f.status !== "cancelled" && f.dueAt && isSameCalendarMonth(new Date(f.dueAt), now)
  );
  if (alreadyThisMonth) return { status: "skipped", reason: "already_accrued" };

  const row: InsertWhitelabelOnboardingFee = {
    userId: user.id,
    subscriptionId: ownSub.id ?? null,
    subscriptionHistoryId: null,
    trigger,
    amountMinor,
    currency: contract.currency,
    dueAt: now,
    status: "pending",
    paidAt: null,
    gatewayOrderId: null,
    gatewayPaymentId: null,
  };
  const fee = await storage.insertWhitelabelOnboardingFee(row);
  await storage.updateUserOnboardingSchedule(user.id, {
    onboardingMonthlyWaived: false,
    onboardingNextChargeAt: addMonths(now, 1),
  });
  invalidateOnboardingOutstandingGateCache();
  return { status: "accrued", fee };
}
