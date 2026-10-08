import { DEFAULT_TIMEZONE, resolveAppTimezone } from "@shared/timezone";

function subscriptionCalendarTimeZone(): string {
  const fromEnv = process.env.SUBSCRIPTION_CALENDAR_TZ?.trim();
  return fromEnv || resolveAppTimezone() || DEFAULT_TIMEZONE;
}

/** YYYY-MM-DD in the given IANA timezone (lexicographically comparable). */
function calendarDateInZone(d: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !day) return "";
  return `${y}-${m}-${day}`;
}

/**
 * Subscription access uses calendar days in IST (Asia/Kolkata) by default:
 * active only if `current_period_end`'s date in that zone is strictly after "today" in that zone.
 * If the end date is today or earlier in that zone, access is not active.
 *
 * Set SUBSCRIPTION_CALENDAR_TZ to any IANA name (e.g. America/New_York) to use another business calendar.
 */
export function isSubscriptionPeriodActiveByCalendarDay(
  periodEnd: Date | string,
  now: Date = new Date()
): boolean {
  const tz = subscriptionCalendarTimeZone();
  const end = periodEnd instanceof Date ? periodEnd : new Date(periodEnd);
  if (Number.isNaN(end.getTime())) return false;
  const endDay = calendarDateInZone(end, tz);
  const todayDay = calendarDateInZone(now, tz);
  if (!endDay || !todayDay) return false;
  return endDay > todayDay;
}

/** Today's calendar date in the subscription business timezone (YYYY-MM-DD). */
export function subscriptionCalendarTodayDateString(now: Date = new Date()): string {
  return calendarDateInZone(now, subscriptionCalendarTimeZone());
}

/**
 * Whole calendar days from "today" to the subscription end date (same date as `current_period_end` in SUBSCRIPTION_CALENDAR_TZ).
 * Example: end Mar 30, today Mar 23 → 7. When today equals end date, returns 0 (no longer active per `isSubscriptionPeriodActiveByCalendarDay`).
 */
export function subscriptionCalendarDaysFromTodayToEndDate(
  periodEnd: Date | string,
  now: Date = new Date()
): number | null {
  const tz = subscriptionCalendarTimeZone();
  const end = periodEnd instanceof Date ? periodEnd : new Date(periodEnd);
  if (Number.isNaN(end.getTime())) return null;
  const endDay = calendarDateInZone(end, tz);
  const todayDay = calendarDateInZone(now, tz);
  if (!endDay || !todayDay) return null;
  const [ey, em, ed] = endDay.split("-").map((s) => parseInt(s, 10));
  const [ty, tm, td] = todayDay.split("-").map((s) => parseInt(s, 10));
  if (![ey, em, ed, ty, tm, td].every((n) => Number.isFinite(n))) return null;
  const e = Date.UTC(ey, em - 1, ed);
  const t = Date.UTC(ty, tm - 1, td);
  return Math.round((e - t) / 86400000);
}
