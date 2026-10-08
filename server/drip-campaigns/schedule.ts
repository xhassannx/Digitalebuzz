import { fromZonedTime } from "date-fns-tz";
import type { DripCampaignStep, DripWaitUnit, DripWeekday } from "@shared/drip-campaigns";
import { DRIP_WEEKDAYS } from "@shared/drip-campaigns";
import { resolveAppTimezone } from "@shared/timezone";

const WEEKDAY_FROM_SHORT: Record<string, DripWeekday> = {
  Sun: "sunday",
  Mon: "monday",
  Tue: "tuesday",
  Wed: "wednesday",
  Thu: "thursday",
  Fri: "friday",
  Sat: "saturday",
};

export function addWaitDuration(from: Date, step: DripCampaignStep): Date {
  const unit = step.waitUnit as DripWaitUnit;
  if (unit === "immediately") return new Date(from.getTime());
  if (unit === "specific_datetime" && step.waitSpecificAt) {
    const d = new Date(step.waitSpecificAt);
    return Number.isNaN(d.getTime()) ? new Date(from.getTime()) : d;
  }
  const value = Math.max(0, Number(step.waitValue) || 0);
  const ms =
    unit === "minutes"
      ? value * 60_000
      : unit === "hours"
        ? value * 3_600_000
        : unit === "days"
          ? value * 86_400_000
          : unit === "weeks"
            ? value * 7 * 86_400_000
            : unit === "months"
              ? value * 30 * 86_400_000
              : 0;
  return new Date(from.getTime() + ms);
}

/** Normalize "9:15", "09:15:00", or ISO-ish values to HH:mm. */
export function normalizeTimeHm(raw: string | null | undefined): string {
  const s = String(raw || "").trim();
  const match = s.match(/(?:T|\s|^)(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (!match) return "09:00";
  const h = Math.min(23, Math.max(0, parseInt(match[1], 10)));
  const m = Math.min(59, Math.max(0, parseInt(match[2], 10)));
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parseHm(hm: string): { h: number; m: number } {
  const normalized = normalizeTimeHm(hm);
  const [h, m] = normalized.split(":").map((n) => parseInt(n, 10));
  return { h: Number.isFinite(h) ? h : 9, m: Number.isFinite(m) ? m : 0 };
}

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: DripWeekday;
};

/** Read calendar/clock parts in a specific IANA timezone (Intl — reliable across server TZ). */
export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const tz = timeZone || "Asia/Kolkata";
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(dtf.formatToParts(date).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  const weekday = WEEKDAY_FROM_SHORT[parts.weekday || ""] || "monday";
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    weekday,
  };
}

function zonedWallToUtc(
  parts: { year: number; month: number; day: number; hour: number; minute: number },
  timeZone: string,
): Date {
  // Treat the wall-clock fields as local to `timeZone`, convert to a real UTC Date.
  const wall = new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0, 0);
  return fromZonedTime(wall, timeZone || "Asia/Kolkata");
}

function resolveWorkingDays(workingDays: DripWeekday[] | null | undefined): DripWeekday[] {
  if (Array.isArray(workingDays) && workingDays.length > 0) {
    return workingDays.filter((d): d is DripWeekday =>
      (DRIP_WEEKDAYS as readonly string[]).includes(String(d)),
    );
  }
  return [...DRIP_WEEKDAYS];
}

export function isWithinScheduleWindow(opts: {
  when: Date;
  timezone: string;
  startTime: string;
  endTime: string;
  workingDays?: DripWeekday[] | null;
}): boolean {
  const tz = opts.timezone || "Asia/Kolkata";
  const days = resolveWorkingDays(opts.workingDays);
  const zoned = getZonedParts(opts.when, tz);
  if (!days.includes(zoned.weekday)) return false;

  const { h: startH, m: startM } = parseHm(opts.startTime);
  const { h: endH, m: endM } = parseHm(opts.endTime);
  const minutes = zoned.hour * 60 + zoned.minute;
  const startMin = startH * 60 + startM;
  const endMin = endH * 60 + endM;

  if (minutes < startMin) return false;
  // Same-day window (e.g. 09:15–20:00). Overnight windows (end <= start) stay open until midnight.
  if (endMin > startMin && minutes >= endMin) return false;
  return true;
}

/**
 * If `when` is outside working days / hours in the campaign timezone,
 * push it forward to the next valid window start.
 */
export function alignToScheduleWindow(opts: {
  when: Date;
  timezone: string;
  startTime: string;
  endTime: string;
  workingDays: DripWeekday[];
  humanizerDelayMinutes?: number;
}): Date {
  const tz = resolveAppTimezone(opts.timezone);
  const days =
    opts.workingDays?.length > 0 ? opts.workingDays : ([...DRIP_WEEKDAYS] as DripWeekday[]);
  const { h: startH, m: startM } = parseHm(opts.startTime);
  const { h: endH, m: endM } = parseHm(opts.endTime);
  let cursor = new Date(opts.when.getTime());
  const humanizer = Math.max(0, opts.humanizerDelayMinutes || 0);
  if (humanizer > 0) {
    cursor = new Date(cursor.getTime() + Math.floor(Math.random() * humanizer) * 60_000);
  }

  for (let i = 0; i < 21; i++) {
    const zoned = getZonedParts(cursor, tz);

    if (!days.includes(zoned.weekday)) {
      // Next calendar day at start time in campaign TZ
      const nextDay = new Date(Date.UTC(zoned.year, zoned.month - 1, zoned.day + 1, 12, 0, 0));
      const nextParts = getZonedParts(nextDay, tz);
      cursor = zonedWallToUtc(
        { year: nextParts.year, month: nextParts.month, day: nextParts.day, hour: startH, minute: startM },
        tz,
      );
      continue;
    }

    const minutes = zoned.hour * 60 + zoned.minute;
    const startMin = startH * 60 + startM;
    const endMin = endH * 60 + endM;

    if (minutes < startMin) {
      return zonedWallToUtc(
        { year: zoned.year, month: zoned.month, day: zoned.day, hour: startH, minute: startM },
        tz,
      );
    }

    if (endMin > startMin && minutes >= endMin) {
      const nextDay = new Date(Date.UTC(zoned.year, zoned.month - 1, zoned.day + 1, 12, 0, 0));
      const nextParts = getZonedParts(nextDay, tz);
      cursor = zonedWallToUtc(
        { year: nextParts.year, month: nextParts.month, day: nextParts.day, hour: startH, minute: startM },
        tz,
      );
      continue;
    }

    return cursor;
  }
  return cursor;
}

export function computeStepExecuteAt(
  from: Date,
  step: DripCampaignStep,
  schedule: {
    timezone: string;
    startTime: string;
    endTime: string;
    workingDays: DripWeekday[];
    humanizerDelayMinutes?: number;
  },
): Date {
  const raw = addWaitDuration(from, step);
  return alignToScheduleWindow({
    when: raw,
    timezone: schedule.timezone || "Asia/Kolkata",
    startTime: normalizeTimeHm(schedule.startTime),
    endTime: normalizeTimeHm(schedule.endTime),
    workingDays: schedule.workingDays || [],
    humanizerDelayMinutes: schedule.humanizerDelayMinutes,
  });
}
