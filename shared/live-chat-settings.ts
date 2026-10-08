import { resolveAppTimezone } from "./timezone";

export type LiveChatDayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type LiveChatDaySchedule = {
  enabled: boolean;
  startTime: string;
  endTime: string;
};

export type LiveChatWorkingHours = {
  timezone: string;
  days: Record<LiveChatDayKey, LiveChatDaySchedule>;
};

export const LIVE_CHAT_DAYS: Array<{ key: LiveChatDayKey; label: string; weekday: number }> = [
  { key: "mon", label: "Mon", weekday: 1 },
  { key: "tue", label: "Tue", weekday: 2 },
  { key: "wed", label: "Wed", weekday: 3 },
  { key: "thu", label: "Thu", weekday: 4 },
  { key: "fri", label: "Fri", weekday: 5 },
  { key: "sat", label: "Sat", weekday: 6 },
  { key: "sun", label: "Sun", weekday: 0 },
];

const DEFAULT_DAY_HOURS: LiveChatDaySchedule = {
  enabled: true,
  startTime: "09:00",
  endTime: "19:00",
};

export function getDefaultLiveChatWorkingHours(): LiveChatWorkingHours {
  return {
    timezone: resolveAppTimezone(),
    days: {
      mon: { ...DEFAULT_DAY_HOURS },
      tue: { ...DEFAULT_DAY_HOURS },
      wed: { ...DEFAULT_DAY_HOURS },
      thu: { ...DEFAULT_DAY_HOURS },
      fri: { ...DEFAULT_DAY_HOURS },
      sat: { ...DEFAULT_DAY_HOURS },
      sun: { enabled: false, startTime: "09:00", endTime: "19:00" },
    },
  };
}

export const DEFAULT_LIVE_CHAT_WORKING_HOURS: LiveChatWorkingHours = getDefaultLiveChatWorkingHours();

export const DEFAULT_LIVE_CHAT_WELCOME_MESSAGE =
  "Hey 👋\n\nWelcome! Thanks for reaching out. How can we help you today?";

export const DEFAULT_LIVE_CHAT_OFF_HOURS_MESSAGE =
  "👋 Hi! Thanks for connecting. Our team is currently unavailable. We'll get back to you during working hours.";

export const LIVE_CHAT_AUTO_REPLY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function parseHm(hm: string): number {
  const match = TIME_RE.exec(String(hm || "").trim());
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

function normalizeTime(value: unknown, fallback: string): string {
  const raw = String(value || "").trim();
  if (TIME_RE.test(raw)) return raw;
  return fallback;
}

function getZonedParts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const weekday = parts.find((p) => p.type === "weekday")?.value || "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value || 0);
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return { weekday: weekdayMap[weekday] ?? date.getDay(), minutes: hour * 60 + minute };
}

export function parseLiveChatWorkingHours(raw: unknown): LiveChatWorkingHours {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const daysRaw =
    source.days && typeof source.days === "object"
      ? (source.days as Record<string, unknown>)
      : {};
  const defaults = getDefaultLiveChatWorkingHours();
  const days = { ...defaults.days };
  for (const day of LIVE_CHAT_DAYS) {
    const entry = daysRaw[day.key];
    const parsed =
      entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
    const fallback = defaults.days[day.key];
    days[day.key] = {
      enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : fallback.enabled,
      startTime: normalizeTime(parsed.startTime, fallback.startTime),
      endTime: normalizeTime(parsed.endTime, fallback.endTime),
    };
  }
  const timezone = String(source.timezone || "").trim() || resolveAppTimezone();
  return { timezone, days };
}

export function isWithinLiveChatWorkingHours(
  hours: LiveChatWorkingHours,
  now: Date = new Date()
): boolean {
  const tz = hours.timezone || resolveAppTimezone();
  let weekday: number;
  let minutes: number;
  try {
    const zoned = getZonedParts(now, tz);
    weekday = zoned.weekday;
    minutes = zoned.minutes;
  } catch {
    weekday = now.getDay();
    minutes = now.getHours() * 60 + now.getMinutes();
  }
  const day = LIVE_CHAT_DAYS.find((d) => d.weekday === weekday);
  if (!day) return false;
  const schedule = hours.days[day.key];
  if (!schedule?.enabled) return false;
  const start = parseHm(schedule.startTime);
  const end = parseHm(schedule.endTime);
  if (end <= start) {
    return minutes >= start || minutes < end;
  }
  return minutes >= start && minutes < end;
}

export type LiveChatSettingsPayload = {
  welcomeEnabled: boolean;
  welcomeMessage: string;
  offHoursEnabled: boolean;
  offHoursMessage: string;
  workingHours: LiveChatWorkingHours;
};

export function toLiveChatSettingsPayload(row?: {
  welcomeEnabled?: boolean | null;
  welcomeMessage?: string | null;
  offHoursEnabled?: boolean | null;
  offHoursMessage?: string | null;
  workingHours?: unknown;
} | null): LiveChatSettingsPayload {
  return {
    welcomeEnabled: row?.welcomeEnabled === true,
    welcomeMessage: String(row?.welcomeMessage ?? ""),
    offHoursEnabled: row?.offHoursEnabled === true,
    offHoursMessage: String(row?.offHoursMessage ?? ""),
    workingHours: parseLiveChatWorkingHours(row?.workingHours),
  };
}

export function formatTimezoneWithOffset(timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "longOffset",
    }).formatToParts(new Date());
    const offset = parts.find((p) => p.type === "timeZoneName")?.value || "";
    if (!offset) return timeZone;
    return `${timeZone} (${offset.replace(/^GMT/, "UTC")})`;
  } catch {
    return timeZone;
  }
}
