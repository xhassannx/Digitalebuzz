import {
  parseZonedDateTimeLocal,
  toDatetimeLocalValue,
  DEFAULT_TIMEZONE,
} from "@shared/timezone";

/**
 * Parse an HTML `datetime-local` value as Asia/Kolkata (app business timezone).
 * Reminder WhatsApp sends must fire at this wall-clock time in IST.
 */
export function parseDateTimeLocalValue(value: string): Date {
  const d = parseZonedDateTimeLocal(value, DEFAULT_TIMEZONE);
  if (Number.isNaN(d.getTime())) {
    throw new Error("Invalid date/time");
  }
  return d;
}

/** Format a Date for an HTML `datetime-local` input in Asia/Kolkata. */
export function formatDateTimeLocalValue(value: string | Date): string {
  return toDatetimeLocalValue(value, DEFAULT_TIMEZONE);
}

export { DEFAULT_TIMEZONE as REMINDER_TIMEZONE };
