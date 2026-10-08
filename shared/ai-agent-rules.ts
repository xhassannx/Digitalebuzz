export type AiAssistantWorkingHours = {
  enabled: boolean;
  timezone: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  weekdays: number[]; // 0=Sun .. 6=Sat
  afterHoursMessage: string;
};

export type AiAssistantFollowUp = {
  enabled: boolean;
  delayHours: number;
  message: string;
};

export type AiAssistantCalendarConfig = {
  enabled: boolean;
  provider: "google-calendar" | "calendly" | "none";
  integrationId?: string | null;
  slotDurationMinutes: number;
  daysAhead: number;
};

export type AiAssistantAgentRules = {
  stopOnHumanReply: boolean;
  memoryTurns: number;
  useKnowledgeSearch: boolean;
  workingHours: AiAssistantWorkingHours;
  followUp: AiAssistantFollowUp;
  calendar: AiAssistantCalendarConfig;
};

export const DEFAULT_AGENT_RULES: AiAssistantAgentRules = {
  stopOnHumanReply: true,
  memoryTurns: 10,
  useKnowledgeSearch: true,
  workingHours: {
    enabled: false,
    timezone: "Asia/Kolkata",
    startTime: "11:00",
    endTime: "19:00",
    weekdays: [1, 2, 3, 4, 5],
    afterHoursMessage:
      "Thank you for contacting us. Kindly drop your query, and we will contact you soon.",
  },
  followUp: {
    enabled: false,
    delayHours: 1,
    message:
      "We noticed that you have not booked or confirmed the meeting yet. Kindly book the meeting and confirm the status.",
  },
  calendar: {
    enabled: false,
    provider: "none",
    integrationId: null,
    slotDurationMinutes: 30,
    daysAhead: 3,
  },
};

export function parseAgentRules(raw: unknown): AiAssistantAgentRules {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_AGENT_RULES };
  const r = raw as Record<string, unknown>;
  const wh = (r.workingHours || {}) as Record<string, unknown>;
  const fu = (r.followUp || {}) as Record<string, unknown>;
  const cal = (r.calendar || {}) as Record<string, unknown>;
  return {
    stopOnHumanReply: r.stopOnHumanReply !== false,
    memoryTurns: Math.min(20, Math.max(2, Number(r.memoryTurns) || DEFAULT_AGENT_RULES.memoryTurns)),
    useKnowledgeSearch: r.useKnowledgeSearch !== false,
    workingHours: {
      enabled: wh.enabled === true,
      timezone: String(wh.timezone || DEFAULT_AGENT_RULES.workingHours.timezone),
      startTime: String(wh.startTime || DEFAULT_AGENT_RULES.workingHours.startTime),
      endTime: String(wh.endTime || DEFAULT_AGENT_RULES.workingHours.endTime),
      weekdays: Array.isArray(wh.weekdays)
        ? wh.weekdays.map((d) => Number(d)).filter((d) => d >= 0 && d <= 6)
        : DEFAULT_AGENT_RULES.workingHours.weekdays,
      afterHoursMessage: String(wh.afterHoursMessage || DEFAULT_AGENT_RULES.workingHours.afterHoursMessage),
    },
    followUp: {
      enabled: fu.enabled === true,
      delayHours: Math.min(72, Math.max(0.25, Number(fu.delayHours) || DEFAULT_AGENT_RULES.followUp.delayHours)),
      message: String(fu.message || DEFAULT_AGENT_RULES.followUp.message),
    },
    calendar: {
      enabled: cal.enabled === true,
      provider:
        cal.provider === "google-calendar" || cal.provider === "calendly"
          ? cal.provider
          : "none",
      integrationId: cal.integrationId ? String(cal.integrationId) : null,
      slotDurationMinutes: Math.min(120, Math.max(15, Number(cal.slotDurationMinutes) || 30)),
      daysAhead: Math.min(14, Math.max(1, Number(cal.daysAhead) || 3)),
    },
  };
}
