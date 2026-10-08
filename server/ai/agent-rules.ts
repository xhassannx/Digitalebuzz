import { parseAgentRules, type AiAssistantWorkingHours } from "@shared/ai-agent-rules";

export { parseAgentRules };

/** Parse "11:00-19:00,1,2,3,4,5" from condition secondValue */
export function parseWorkingHoursCondition(secondValue: string): AiAssistantWorkingHours | null {
  const parts = String(secondValue || "").split(",").map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return null;
  const [timeRange, ...dayParts] = parts;
  const [startTime, endTime] = (timeRange || "11:00-19:00").split("-").map((s) => s.trim());
  const weekdays = dayParts.length
    ? dayParts.map((d) => Number(d)).filter((d) => !Number.isNaN(d))
    : [1, 2, 3, 4, 5];
  return {
    enabled: true,
    timezone: "Asia/Kolkata",
    startTime: startTime || "11:00",
    endTime: endTime || "19:00",
    weekdays,
    afterHoursMessage: "",
  };
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
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return { weekday: weekdayMap[weekday] ?? date.getDay(), minutes: hour * 60 + minute };
}

function parseHm(hm: string): number {
  const [h, m] = hm.split(":").map((x) => Number(x));
  return (h || 0) * 60 + (m || 0);
}

export function isWithinWorkingHours(
  config: AiAssistantWorkingHours,
  now: Date = new Date(),
  timezoneOverride?: string
): boolean {
  if (!config.enabled) return true;
  const tz = timezoneOverride || config.timezone || "Asia/Kolkata";
  const { weekday, minutes } = getZonedParts(now, tz);
  if (!config.weekdays.includes(weekday)) return false;
  const start = parseHm(config.startTime);
  const end = parseHm(config.endTime);
  return minutes >= start && minutes < end;
}
