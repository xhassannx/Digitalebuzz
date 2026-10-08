import { addDays, addMonths } from "date-fns";
import type { WhitelabelOnboardingFeeRow } from "@shared/schema";
import { storage } from "./storage";
import {
  mergeLiveContractForOutstandingLimit,
  peekOnboardingFeeFromPayload,
  readWhitelabelOnboardingContractFromUpstreamPayload,
} from "./whitelabel-onboarding-fee";
import {
  getOnboardingTrialEndsAt,
  isUserInOnboardingTrial,
} from "./whitelabel-onboarding-accrual";
import {
  isOnboardingBillableEndCustomer,
  waiveOnboardingForTeamMember,
} from "./whitelabel-onboarding-eligibility";
import { runWhitelabelOnboardingForUser } from "./onboarding-monthly-scheduler";
import { invalidateOnboardingOutstandingGateCache } from "./onboarding-outstanding-gate";
import { fetchCustomerFromApi } from "./updates";

export type OnboardingRecalculateUserDetail = {
  userId: string;
  email: string | null;
  outcome:
    | "fees_added"
    | "scheduled_future"
    | "skipped_trial"
    | "skipped_no_subscription"
    | "skipped_not_billable"
    | "skipped_included"
    | "no_new_fees";
  feesAdded: number;
  trialEndsAt?: string | null;
  nextChargeAt?: string | null;
};

export type OnboardingRecalculateResult = {
  feesDeleted: number;
  feesPreserved: number;
  settlementsDeleted: number;
  customersProcessed: number;
  feesCreated: number;
  skippedTrial: number;
  skippedNoSubscription: number;
  skippedNotBillable: number;
  onboardingFeeMajor: number;
  userDetails: OnboardingRecalculateUserDetail[];
};

function latestPaidDueAt(fees: WhitelabelOnboardingFeeRow[]): Date | null {
  const paid = fees.filter((f) => f.status === "paid" && f.dueAt);
  if (!paid.length) return null;
  return new Date(Math.max(...paid.map((f) => new Date(f.dueAt!).getTime())));
}

function firstEligibleChargeAt(
  user: { createdAt?: Date | null },
  contractTrialDays: number,
  trialEnd: Date | null,
  now: Date
): Date {
  const fromContract = user.createdAt ? addDays(new Date(user.createdAt), contractTrialDays) : now;
  let firstCharge = fromContract;
  if (trialEnd && trialEnd.getTime() > firstCharge.getTime()) {
    firstCharge = trialEnd;
  }
  return firstCharge;
}

/**
 * Rebuild unpaid onboarding fee rows for end-customers only.
 * Paid months are kept. Team members and WL admin are excluded.
 */
export async function recalculateWhitelabelOnboardingFees(): Promise<OnboardingRecalculateResult> {
  try {
    const { runPlatformMasterSync } = await import("./platform-master-sync");
    await runPlatformMasterSync();
  } catch (e) {
    console.warn(
      "[OnboardingRecalculate] platform-master sync before recalculate failed:",
      e instanceof Error ? e.message : e
    );
  }

  const master = await storage.getPlatformMasterSettings();
  let live = null;
  try {
    live = await fetchCustomerFromApi();
  } catch {
    live = null;
  }

  const dbPayload = master?.upstreamPayload ?? null;
  const mergedContractSource = mergeLiveContractForOutstandingLimit(dbPayload, live);
  const contract = readWhitelabelOnboardingContractFromUpstreamPayload(mergedContractSource);
  if (!contract) {
    const dbFee = peekOnboardingFeeFromPayload(dbPayload);
    const liveFee = peekOnboardingFeeFromPayload(live);
    const mergedFee = peekOnboardingFeeFromPayload(mergedContractSource);
    throw Object.assign(
      new Error(
        "onboarding_fee is missing or zero on the licensor contract. " +
          "Set Customer onboarding monthly fee on SaaS admin for this whitelabel, then Sync Platform settings. " +
          `Found: db=${String(dbFee)}, live=${String(liveFee)}, merged=${String(mergedFee)}.`
      ),
      {
        statusCode: 400,
        debug: {
          db_onboarding_fee: dbFee,
          live_onboarding_fee: liveFee,
          merged_onboarding_fee: mergedFee,
          live_customer_id: live && typeof live === "object" ? (live as { id?: unknown }).id ?? null : null,
          last_sync_status: master?.lastSyncStatus ?? null,
          last_sync_at: master?.lastSyncAt ?? null,
        },
      }
    );
  }

  const cleared = await storage.clearUnpaidWhitelabelOnboardingFees();

  const now = new Date();
  const candidates = await storage.listOnboardingBillableEndCustomerUsers();
  let feesCreated = 0;
  let skippedTrial = 0;
  let skippedNoSubscription = 0;
  let skippedNotBillable = 0;
  const userDetails: OnboardingRecalculateUserDetail[] = [];

  for (const user of candidates) {
    const baseDetail = { userId: user.id, email: user.email ?? null, feesAdded: 0 };

    if (!(await isOnboardingBillableEndCustomer(user.id))) {
      skippedNotBillable++;
      userDetails.push({ ...baseDetail, outcome: "skipped_not_billable" });
      continue;
    }

    if (isUserInOnboardingTrial(user, contract.trialDays, now)) {
      const trialEnd = getOnboardingTrialEndsAt(user, contract.trialDays);
      await storage.updateUserOnboardingSchedule(user.id, {
        onboardingMonthlyWaived: false,
        onboardingNextChargeAt: trialEnd,
      });
      skippedTrial++;
      userDetails.push({
        ...baseDetail,
        outcome: "skipped_trial",
        trialEndsAt: trialEnd?.toISOString() ?? null,
        nextChargeAt: trialEnd?.toISOString() ?? null,
      });
      continue;
    }

    const ownSub = await storage.getActiveSubscriptionByUser(user.id);
    if (!ownSub) {
      skippedNoSubscription++;
      userDetails.push({ ...baseDetail, outcome: "skipped_no_subscription" });
      continue;
    }

    const userRank = await storage.countOnboardingBillableUsersCreatedBefore(
      user.createdAt ?? now,
      user.id
    );
    if (contract.included > 0 && userRank < contract.included) {
      await storage.updateUserOnboardingSchedule(user.id, {
        onboardingMonthlyWaived: true,
        onboardingNextChargeAt: null,
      });
      userDetails.push({ ...baseDetail, outcome: "skipped_included" });
      continue;
    }

    const existingFees = await storage.listWhitelabelOnboardingFeesForUser(user.id);
    const trialEnd = getOnboardingTrialEndsAt(user, contract.trialDays);
    const firstCharge = firstEligibleChargeAt(user, contract.trialDays, trialEnd, now);
    const lastPaid = latestPaidDueAt(existingFees);
    let chargeFrom = lastPaid ? addMonths(lastPaid, 1) : firstCharge;

    if (chargeFrom.getTime() < firstCharge.getTime()) {
      chargeFrom = firstCharge;
    }

    if (chargeFrom.getTime() > now.getTime()) {
      await storage.updateUserOnboardingSchedule(user.id, {
        onboardingMonthlyWaived: false,
        onboardingNextChargeAt: chargeFrom,
      });
      userDetails.push({
        ...baseDetail,
        outcome: "scheduled_future",
        nextChargeAt: chargeFrom.toISOString(),
      });
      continue;
    }

    await storage.updateUserOnboardingSchedule(user.id, {
      onboardingMonthlyWaived: false,
      onboardingNextChargeAt: chargeFrom,
    });

    const beforeCount = existingFees.length;
    const freshUser = await storage.getUser(user.id);
    if (!freshUser) continue;
    await runWhitelabelOnboardingForUser(freshUser, contract, now);
    const after = await storage.listWhitelabelOnboardingFeesForUser(user.id);
    const added = Math.max(0, after.length - beforeCount);
    feesCreated += added;
    userDetails.push({
      ...baseDetail,
      outcome: added > 0 ? "fees_added" : "no_new_fees",
      feesAdded: added,
      nextChargeAt: chargeFrom.toISOString(),
    });
  }

  const allUsers = await storage.getAllUsers();
  for (const u of allUsers) {
    if (u.isSaaSOwner) continue;
    const ownsOrg = await storage.userOwnsAnyOrganization(u.id);
    if (!ownsOrg || !(await isOnboardingBillableEndCustomer(u.id))) {
      await waiveOnboardingForTeamMember(u.id);
    }
  }

  invalidateOnboardingOutstandingGateCache();

  return {
    feesDeleted: cleared.feesDeleted,
    feesPreserved: cleared.feesPreserved,
    settlementsDeleted: 0,
    customersProcessed: candidates.length,
    feesCreated,
    skippedTrial,
    skippedNoSubscription,
    skippedNotBillable,
    onboardingFeeMajor: contract.feeMajor,
    userDetails,
  };
}
