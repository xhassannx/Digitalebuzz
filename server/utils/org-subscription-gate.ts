/**
 * Org / billing subscription gates: plan features stop when the period ends,
 * and account data is eligible for purge after configured retention months.
 */
import { storage } from "../storage";
import {
  isSubscriptionPeriodActiveByCalendarDay,
  subscriptionCalendarDaysFromTodayToEndDate,
} from "./subscription-calendar";
import {
  SUBSCRIPTION_DATA_RETENTION_DAYS,
  dataDeletionAtFromPeriodEnd as deletionAtWithDays,
  getSubscriptionDataRetentionDays,
} from "./subscription-data-retention";

export {
  SUBSCRIPTION_DATA_RETENTION_DAYS,
  getSubscriptionDataRetentionDays,
  getSubscriptionDataRetentionMonths,
  monthsToRetentionDays,
  normalizeRetentionMonths,
} from "./subscription-data-retention";

export type SubscriptionAccessResult =
  | { active: true }
  | {
      active: false;
      code: "SUBSCRIPTION_EXPIRED";
      error: string;
      expired_at?: string;
      data_deletion_at?: string;
      retention_days: number;
    };

function periodEndDate(periodEnd: Date | string): Date | null {
  const end = periodEnd instanceof Date ? periodEnd : new Date(periodEnd);
  return Number.isNaN(end.getTime()) ? null : end;
}

/** ISO timestamp for when data will be deleted (period end + retention days). */
export function dataDeletionAtFromPeriodEnd(
  periodEnd: Date | string,
  retentionDays: number = SUBSCRIPTION_DATA_RETENTION_DAYS,
): string | undefined {
  return deletionAtWithDays(periodEnd, retentionDays);
}

/**
 * True when the org owner's plan period is still active (calendar day).
 * SaaS owners / missing org → treated as active (do not block platform admin).
 */
export async function isOrganizationPlanActive(_organizationId?: string | null): Promise<boolean> {
  return true;
}

/** True when the user (or their org owner) still has an active plan period. */
export async function isUserPlanActive(_userId: string): Promise<boolean> {
  return true;
}

/**
 * Resolve billing access for a panel user / org.
 * BYPASSED: Always return active: true for unlimited local access.
 */
export async function getSubscriptionAccessForUser(
  _userId: string,
  _organizationId?: string | null
): Promise<SubscriptionAccessResult> {
  return { active: true };
}

/**
 * Calendar days past period end. Positive when expired.
 * Uses the same business calendar as plan access (default IST).
 */
export function calendarDaysPastPeriodEnd(
  periodEnd: Date | string,
  now: Date = new Date()
): number | null {
  const daysToEnd = subscriptionCalendarDaysFromTodayToEndDate(periodEnd, now);
  if (daysToEnd === null) return null;
  return -daysToEnd;
}

/** Eligible for purge when period ended at least retention days ago and no active sub. */
export function isPastDataRetention(
  periodEnd: Date | string,
  now: Date = new Date(),
  retentionDays: number = SUBSCRIPTION_DATA_RETENTION_DAYS
): boolean {
  const past = calendarDaysPastPeriodEnd(periodEnd, now);
  if (past === null) return false;
  return past >= retentionDays;
}
