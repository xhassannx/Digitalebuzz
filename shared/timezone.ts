import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

/** Project default business timezone (India). Override with DEFAULT_TIMEZONE or TZ. */
export const DEFAULT_TIMEZONE = "Asia/Kolkata";

/**
 * Resolve the app/business timezone.
 * Prefer an explicit override (org / campaign / agent rules), then env, then default.
 */
function readEnvTimezone(): string {
  if (typeof process !== "undefined" && process.env) {
    const fromProcess =
      process.env.DEFAULT_TIMEZONE?.trim() || process.env.TZ?.trim();
    if (fromProcess) return fromProcess;
  }
  try {
    const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
    const fromVite =
      viteEnv?.VITE_DEFAULT_TIMEZONE?.trim() ||
      viteEnv?.DEFAULT_TIMEZONE?.trim();
    if (fromVite) return fromVite;
  } catch {
    // import.meta.env is unavailable in some runtimes
  }
  return "";
}

export function resolveAppTimezone(override?: string | null): string {
  const o = typeof override === "string" ? override.trim() : "";
  if (o) return o;
  return readEnvTimezone() || DEFAULT_TIMEZONE;
}

/** Ensure Node process TZ is set so legacy Date local methods match business TZ when possible. */
export function ensureProcessTimezone(): string {
  const tz = resolveAppTimezone();
  if (typeof process !== "undefined" && process.env && !process.env.TZ) {
    process.env.TZ = tz;
  }
  return tz;
}

/** Format an instant in a given IANA timezone (defaults to app TZ). */
export function formatInAppTimezone(
  date: Date | string | number,
  options: Intl.DateTimeFormatOptions,
  timeZone?: string | null,
  locale = "en-IN"
): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(locale, {
    ...options,
    timeZone: resolveAppTimezone(timeZone),
  });
}

/** `datetime-local` value (yyyy-MM-ddTHH:mm) for an instant in a timezone. */
export function toDatetimeLocalValue(
  date: Date | string | number,
  timeZone?: string | null
): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return formatInTimeZone(d, resolveAppTimezone(timeZone), "yyyy-MM-dd'T'HH:mm");
}

/**
 * Parse a `datetime-local` wall-clock string as that time in `timeZone`, return UTC Date.
 * Accepts `YYYY-MM-DDTHH:mm` or `YYYY-MM-DDTHH:mm:ss`.
 */
export function parseZonedDateTimeLocal(
  local: string,
  timeZone?: string | null
): Date {
  const tz = resolveAppTimezone(timeZone);
  const m = String(local)
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) {
    const fallback = new Date(local);
    return Number.isNaN(fallback.getTime()) ? new Date(NaN) : fallback;
  }
  const year = Number(m[1]);
  const monthIndex = Number(m[2]) - 1;
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = Number(m[6] || 0);
  const wall = new Date(year, monthIndex, day, hour, minute, second, 0);
  return fromZonedTime(wall, tz);
}

/** Convert a UTC instant to a Date whose local getters reflect wall time in `timeZone`. */
export function toAppZonedTime(date: Date, timeZone?: string | null): Date {
  return toZonedTime(date, resolveAppTimezone(timeZone));
}

/** Treat a Date's Y/M/D H:M:S as wall time in `timeZone` and return the UTC instant. */
export function fromAppZonedTime(wall: Date, timeZone?: string | null): Date {
  return fromZonedTime(wall, resolveAppTimezone(timeZone));
}

/**
 * Build a UTC Date for a wall-clock time on a zoned calendar day.
 * `zonedDay` should come from `toAppZonedTime` (or equivalent) so getFullYear/getMonth/getDate match the zone.
 */
export function zonedWallClockToUtc(
  zonedDay: Date,
  hour: number,
  minute: number,
  timeZone?: string | null
): Date {
  const wall = new Date(zonedDay);
  wall.setHours(hour, minute, 0, 0);
  return fromAppZonedTime(wall, timeZone);
}
