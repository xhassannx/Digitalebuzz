/**
 * Configurable retention after plan expiry before business data is purged.
 * Admin may set 1, 2, or 3 months (default 3). User accounts are never deleted.
 */
import { storage } from "../storage";

export const SUBSCRIPTION_DATA_RETENTION_MONTHS_OPTIONS = [1, 2, 3] as const;
export type SubscriptionDataRetentionMonths =
  (typeof SUBSCRIPTION_DATA_RETENTION_MONTHS_OPTIONS)[number];

/** Fallback when settings row is missing (legacy 90-day / 3-month behavior). */
export const DEFAULT_SUBSCRIPTION_DATA_RETENTION_MONTHS: SubscriptionDataRetentionMonths = 3;

export function monthsToRetentionDays(months: number): number {
  const m = normalizeRetentionMonths(months);
  return m * 30;
}

export function normalizeRetentionMonths(value: unknown): SubscriptionDataRetentionMonths {
  const n = typeof value === "number" ? value : parseInt(String(value ?? ""), 10);
  if (n === 1 || n === 2 || n === 3) return n;
  return DEFAULT_SUBSCRIPTION_DATA_RETENTION_MONTHS;
}

/** Legacy constant name — days for the default (3 months). Prefer getSubscriptionDataRetentionDays(). */
export const SUBSCRIPTION_DATA_RETENTION_DAYS = monthsToRetentionDays(
  DEFAULT_SUBSCRIPTION_DATA_RETENTION_MONTHS,
);

export async function getSubscriptionDataRetentionMonths(): Promise<SubscriptionDataRetentionMonths> {
  const row = await storage.getPlatformMasterSettings();
  return normalizeRetentionMonths(row?.subscriptionDataRetentionMonths);
}

export async function getSubscriptionDataRetentionDays(): Promise<number> {
  return monthsToRetentionDays(await getSubscriptionDataRetentionMonths());
}

export function dataDeletionAtFromPeriodEnd(
  periodEnd: Date | string,
  retentionDays: number,
): string | undefined {
  const end = periodEnd instanceof Date ? periodEnd : new Date(periodEnd);
  if (Number.isNaN(end.getTime())) return undefined;
  const deletion = new Date(end.getTime());
  deletion.setUTCDate(deletion.getUTCDate() + retentionDays);
  return deletion.toISOString();
}
