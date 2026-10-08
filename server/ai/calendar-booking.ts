import { storage } from "../storage";
import type { Integration } from "@shared/schema";
import type { AiAssistantCalendarConfig, AiAssistantWorkingHours } from "@shared/ai-agent-rules";
import {
  formatInAppTimezone,
  fromAppZonedTime,
  resolveAppTimezone,
  toAppZonedTime,
} from "@shared/timezone";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const CALENDLY_API = "https://api.calendly.com";

export type BookableSlot = {
  id: string;
  label: string;
  startIso: string;
  endIso: string;
  /** Calendly scheduling URL for this slot (if available) */
  schedulingUrl?: string;
  /** Calendly event type URI used when creating an invitee */
  eventTypeUri?: string;
};

export type BookingResult = {
  provider: "google-calendar" | "calendly";
  /** Primary join/booking link to send on WhatsApp (Meet or Calendly) */
  joinLink: string;
  /** Google Calendar event HTML link */
  calendarLink?: string;
  /** Google Meet link */
  meetLink?: string;
  /** Whether calendar/email invitation was sent to the attendee */
  invitationSent: boolean;
  eventId?: string;
};

export type SlotFetchResult = {
  slots: BookableSlot[];
  provider: "google-calendar" | "calendly" | "none";
  error?: string;
  /** Kept for Calendly invitee creation */
  eventTypeUri?: string;
};

async function getGoogleAccessToken(integration: Integration): Promise<string> {
  const creds = (integration.credentials || {}) as Record<string, any>;
  if (!creds || typeof creds !== "object") throw new Error("No Google credentials");
  const expiresAt = Number(creds.expires_at || 0);
  if (creds.access_token && expiresAt && Date.now() < expiresAt - 60000) {
    return String(creds.access_token);
  }
  if (creds.refresh_token) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: String(creds.client_id || process.env.GOOGLE_CLIENT_ID || ""),
        client_secret: String(creds.client_secret || process.env.GOOGLE_CLIENT_SECRET || ""),
        refresh_token: String(creds.refresh_token),
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`Failed to refresh Google token: ${errBody || res.statusText}`);
    }
    const tokens = (await res.json()) as { access_token: string; expires_in?: number };
    creds.access_token = tokens.access_token;
    creds.expires_at = Date.now() + (Number(tokens.expires_in) || 3600) * 1000;
    await storage.updateIntegration(integration.id, integration.userId, { credentials: creds });
    return tokens.access_token;
  }
  if (!creds.access_token) throw new Error("Google Calendar not connected — reconnect under Integrations");
  return String(creds.access_token);
}

function parseHm(hm: string): number {
  const [h, m] = hm.split(":").map((x) => Number(x));
  return (h || 0) * 60 + (m || 0);
}

function generateCandidateSlots(
  daysAhead: number,
  durationMinutes: number,
  workingHours?: AiAssistantWorkingHours
): Array<{ start: Date; end: Date }> {
  const slots: Array<{ start: Date; end: Date }> = [];
  const tz = resolveAppTimezone(workingHours?.timezone);
  const startMin = workingHours?.enabled ? parseHm(workingHours.startTime) : 11 * 60;
  const endMin = workingHours?.enabled ? parseHm(workingHours.endTime) : 19 * 60;
  const weekdays = workingHours?.enabled && workingHours.weekdays?.length
    ? workingHours.weekdays
    : [1, 2, 3, 4, 5];
  const now = new Date();
  const zonedNow = toAppZonedTime(now, tz);
  let dayOffset = 0;
  const maxDays = Math.max(daysAhead, 1) + 7;
  while (slots.length < 12 && dayOffset <= maxDays) {
    const zonedDay = new Date(zonedNow);
    zonedDay.setDate(zonedNow.getDate() + dayOffset);
    dayOffset++;
    if (!weekdays.includes(zonedDay.getDay())) continue;
    for (let m = startMin; m + durationMinutes <= endMin; m += durationMinutes) {
      const wall = new Date(zonedDay);
      wall.setHours(Math.floor(m / 60), m % 60, 0, 0);
      const start = fromAppZonedTime(wall, tz);
      if (start.getTime() <= now.getTime() + 5 * 60 * 1000) continue;
      const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
      slots.push({ start, end });
      if (slots.length >= 12) break;
    }
  }
  return slots;
}

async function filterGoogleBusy(
  integration: Integration,
  candidates: Array<{ start: Date; end: Date }>
): Promise<Array<{ start: Date; end: Date }>> {
  if (!candidates.length) return [];
  const token = await getGoogleAccessToken(integration);
  const timeMin = candidates[0]!.start.toISOString();
  const timeMax = candidates[candidates.length - 1]!.end.toISOString();
  const res = await fetch(`${CALENDAR_API}/freeBusy`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      timeMin,
      timeMax,
      items: [{ id: "primary" }],
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    calendars?: { primary?: { busy?: Array<{ start: string; end: string }>; errors?: Array<{ reason?: string }> } };
  };
  if (!res.ok) {
    throw new Error(data.error?.message || `Google freeBusy failed (${res.status})`);
  }
  const primaryErrors = data.calendars?.primary?.errors;
  if (primaryErrors?.length) {
    throw new Error(`Google Calendar freeBusy error: ${primaryErrors.map((e) => e.reason).join(", ")}`);
  }
  const busy = data.calendars?.primary?.busy || [];
  return candidates.filter((slot) => {
    return !busy.some((b) => {
      const bs = new Date(b.start).getTime();
      const be = new Date(b.end).getTime();
      return slot.start.getTime() < be && slot.end.getTime() > bs;
    });
  });
}

function formatSlotLabel(start: Date, timeZone?: string): string {
  return formatInAppTimezone(
    start,
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    },
    timeZone
  );
}

async function getCalendlySlots(
  integration: Integration,
  config: AiAssistantCalendarConfig
): Promise<{ slots: BookableSlot[]; eventTypeUri: string }> {
  const creds = (integration.credentials || {}) as Record<string, unknown>;
  const token = String(creds.access_token || creds.personal_token || creds.api_key || "").trim();
  if (!token) throw new Error("Calendly token missing — reconnect Calendly under Integrations");

  const headers = { Authorization: `Bearer ${token}` };
  const userRes = await fetch(`${CALENDLY_API}/users/me`, { headers });
  const userData = (await userRes.json().catch(() => ({}))) as {
    resource?: { uri?: string; timezone?: string };
    message?: string;
    title?: string;
  };
  if (!userRes.ok) {
    throw new Error(userData.message || userData.title || `Calendly users/me failed (${userRes.status})`);
  }
  const userUri = userData.resource?.uri;
  if (!userUri) throw new Error("Calendly user not found");

  const etRes = await fetch(
    `${CALENDLY_API}/event_types?user=${encodeURIComponent(userUri)}&active=true`,
    { headers }
  );
  const etData = (await etRes.json().catch(() => ({}))) as {
    collection?: Array<{ uri?: string; duration?: number; name?: string; scheduling_url?: string }>;
    message?: string;
  };
  if (!etRes.ok) {
    throw new Error(etData.message || `Calendly event types failed (${etRes.status})`);
  }
  const eventType = etData.collection?.[0];
  if (!eventType?.uri) throw new Error("No active Calendly event type found — create one in Calendly");

  // Calendly available-times API allows max 7-day windows
  const daysAhead = Math.min(Math.max(config.daysAhead || 3, 1), 7);
  const start = new Date();
  start.setSeconds(0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + daysAhead);

  const availRes = await fetch(
    `${CALENDLY_API}/event_type_available_times?event_type=${encodeURIComponent(eventType.uri)}&start_time=${encodeURIComponent(start.toISOString())}&end_time=${encodeURIComponent(end.toISOString())}`,
    { headers }
  );
  const availData = (await availRes.json().catch(() => ({}))) as {
    collection?: Array<{ start_time?: string; scheduling_url?: string; status?: string }>;
    message?: string;
    title?: string;
  };
  if (!availRes.ok) {
    throw new Error(availData.message || availData.title || `Calendly available times failed (${availRes.status})`);
  }
  const duration = eventType.duration || config.slotDurationMinutes || 30;
  const available = (availData.collection || []).filter(
    (item) => !item.status || item.status === "available"
  );
  const labelTz = resolveAppTimezone(userData.resource?.timezone);
  const slots = available.slice(0, 10).map((item, idx) => {
    const startIso = item.start_time || "";
    const startDate = new Date(startIso);
    const endDate = new Date(startDate.getTime() + duration * 60 * 1000);
    return {
      id: `calendly_${idx}_${startIso}`,
      label: formatSlotLabel(startDate, labelTz),
      startIso: startDate.toISOString(),
      endIso: endDate.toISOString(),
      schedulingUrl: item.scheduling_url || eventType.scheduling_url,
      eventTypeUri: eventType.uri,
    };
  });
  return { slots, eventTypeUri: eventType.uri };
}

/** Resolve which calendar integration to use (handles provider=none + auto pick). */
export async function resolveCalendarIntegration(
  organizationId: string,
  config: AiAssistantCalendarConfig
): Promise<{
  integration: Integration | null;
  provider: "google-calendar" | "calendly" | "none";
  error?: string;
}> {
  if (!config.enabled) {
    return { integration: null, provider: "none", error: "In-chat calendar booking is disabled in Agent Rules" };
  }
  if (!organizationId) {
    return { integration: null, provider: "none", error: "Organization context missing for calendar booking" };
  }

  const integrations = await storage.getIntegrationsByOrganization(organizationId);
  const connected = integrations.filter((i) => i.status === "connected");

  let provider = config.provider;
  if (provider === "none") {
    const gcal = connected.find((i) => i.name === "google-calendar");
    const calendly = connected.find((i) => i.name === "calendly");
    if (gcal) provider = "google-calendar";
    else if (calendly) provider = "calendly";
    else {
      return {
        integration: null,
        provider: "none",
        error:
          "No Google Calendar or Calendly connected. Connect one under Integrations, then set Provider in Agent Rules.",
      };
    }
  }

  let integration: Integration | undefined;
  if (config.integrationId) {
    integration = connected.find((i) => i.id === config.integrationId);
  }
  if (!integration) {
    integration = connected.find((i) => i.name === provider);
  }
  if (!integration) {
    return {
      integration: null,
      provider,
      error: `${provider === "calendly" ? "Calendly" : "Google Calendar"} is not connected for this organization`,
    };
  }
  return { integration, provider };
}

export async function getAvailableSlots(
  organizationId: string,
  config: AiAssistantCalendarConfig,
  workingHours?: AiAssistantWorkingHours
): Promise<SlotFetchResult> {
  const resolved = await resolveCalendarIntegration(organizationId, config);
  if (!resolved.integration || resolved.provider === "none") {
    return { slots: [], provider: resolved.provider, error: resolved.error };
  }

  try {
    if (resolved.provider === "calendly") {
      const { slots, eventTypeUri } = await getCalendlySlots(resolved.integration, {
        ...config,
        provider: "calendly",
        enabled: true,
      });
      return { slots, provider: "calendly", eventTypeUri };
    }

    const candidates = generateCandidateSlots(
      config.daysAhead || 3,
      config.slotDurationMinutes || 30,
      workingHours
    );
    if (!candidates.length) {
      return {
        slots: [],
        provider: "google-calendar",
        error: "No candidate slots in the selected working hours / days ahead. Check Agent Rules working hours.",
      };
    }
    const labelTz = resolveAppTimezone(workingHours?.timezone);
    const free = await filterGoogleBusy(resolved.integration, candidates);
    const slots = free.slice(0, 10).map((slot, idx) => ({
      id: `gcal_${idx}_${slot.start.toISOString()}`,
      label: formatSlotLabel(slot.start, labelTz),
      startIso: slot.start.toISOString(),
      endIso: slot.end.toISOString(),
    }));
    return { slots, provider: "google-calendar" };
  } catch (e: any) {
    console.error("[Calendar] Slot fetch failed:", e?.message || e);
    return {
      slots: [],
      provider: resolved.provider,
      error: e?.message || "Failed to fetch available slots",
    };
  }
}

export function formatSlotsMessage(
  slots: BookableSlot[],
  intro?: string,
  timeZone?: string
): string {
  const tz = resolveAppTimezone(timeZone);
  const header =
    intro?.trim() ||
    "I'd be happy to help you book an appointment. Here are the available slots:";
  if (!slots.length) {
    return `${header}\n\nI don't have any open slots right now. Please share your preferred time and we'll confirm shortly.`;
  }
  const byDay = new Map<string, string[]>();
  for (const slot of slots) {
    const d = new Date(slot.startIso);
    const dayKey = formatInAppTimezone(
      d,
      {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      },
      tz
    );
    const time = formatInAppTimezone(
      d,
      { hour: "numeric", minute: "2-digit", hour12: true },
      tz
    );
    if (!byDay.has(dayKey)) byDay.set(dayKey, []);
    byDay.get(dayKey)!.push(time);
  }
  const lines: string[] = [header, ""];
  for (const [day, times] of byDay) {
    lines.push(`${day}: ${times.join(", ")}`);
  }
  lines.push("", "Which slot works best for you? Reply with the day and time to confirm.");
  return lines.join("\n");
}

export function matchSlotFromUserInput(
  userInput: string,
  slots: BookableSlot[],
  timeZone?: string
): BookableSlot | null {
  if (!slots.length) return null;
  const tz = resolveAppTimezone(timeZone);
  const lower = userInput.toLowerCase().trim();
  for (const slot of slots) {
    if (lower.includes(slot.label.toLowerCase())) return slot;
    const d = new Date(slot.startIso);
    const zoned = toAppZonedTime(d, tz);
    const time12 = formatInAppTimezone(
      d,
      { hour: "numeric", minute: "2-digit", hour12: true },
      tz
    ).toLowerCase();
    const weekday = formatInAppTimezone(d, { weekday: "long" }, tz).toLowerCase();
    const dayNum = String(zoned.getDate());
    if (lower.includes(time12) || lower.includes(time12.replace(/\s/g, ""))) {
      if (lower.includes(weekday) || lower.includes(dayNum) || slots.length === 1) return slot;
    }
    // "3pm" / "3 pm" style
    const hour = zoned.getHours();
    const ampm = hour >= 12 ? "pm" : "am";
    const hour12 = hour % 12 || 12;
    if (
      (lower.includes(`${hour12}${ampm}`) || lower.includes(`${hour12} ${ampm}`)) &&
      (lower.includes(weekday) ||
        slots.filter((s) => toAppZonedTime(new Date(s.startIso), tz).getHours() === hour).length === 1)
    ) {
      return slot;
    }
  }
  // Single remaining soft match on time only
  for (const slot of slots) {
    const d = new Date(slot.startIso);
    const time12 = formatInAppTimezone(
      d,
      { hour: "numeric", minute: "2-digit", hour12: true },
      tz
    ).toLowerCase();
    if (lower.includes(time12)) return slot;
  }
  return null;
}

function extractMeetLink(data: {
  hangoutLink?: string;
  htmlLink?: string;
  conferenceData?: {
    entryPoints?: Array<{ entryPointType?: string; uri?: string }>;
  };
}): { meetLink?: string; calendarLink?: string; joinLink: string } {
  const calendarLink = data.htmlLink;
  const fromEntries = data.conferenceData?.entryPoints?.find(
    (e) => e.entryPointType === "video" && e.uri
  )?.uri;
  const meetLink = data.hangoutLink || fromEntries;
  const joinLink = meetLink || calendarLink || "";
  return { meetLink, calendarLink, joinLink };
}

/**
 * Create a Google Calendar event with Google Meet, add the customer as attendee,
 * and email them the invitation (sendUpdates=all).
 */
export async function bookGoogleSlot(
  integration: Integration,
  slot: BookableSlot,
  attendeeEmail?: string,
  title = "Demo booking",
  opts?: { attendeeName?: string; timezone?: string }
): Promise<BookingResult> {
  if (!attendeeEmail?.trim()) {
    throw new Error("Customer email is required to send the calendar invitation");
  }
  const token = await getGoogleAccessToken(integration);
  const timezone = resolveAppTimezone(opts?.timezone);
  const body: Record<string, unknown> = {
    summary: title,
    description:
      "Booked via WhatsApp AI assistant.\n\nJoin with the Google Meet link in this invite.",
    start: { dateTime: slot.startIso, timeZone: timezone },
    end: { dateTime: slot.endIso, timeZone: timezone },
    attendees: [
      {
        email: attendeeEmail.trim(),
        displayName: opts?.attendeeName || undefined,
        responseStatus: "needsAction",
      },
    ],
    guestsCanModify: false,
    guestsCanInviteOthers: false,
    reminders: {
      useDefault: false,
      overrides: [
        { method: "email", minutes: 60 },
        { method: "popup", minutes: 15 },
      ],
    },
    conferenceData: {
      createRequest: {
        requestId: `wa-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };

  // sendUpdates=all → Google emails the invitation to attendees
  const res = await fetch(
    `${CALENDAR_API}/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  const data = (await res.json().catch(() => ({}))) as {
    htmlLink?: string;
    hangoutLink?: string;
    id?: string;
    conferenceData?: {
      entryPoints?: Array<{ entryPointType?: string; uri?: string }>;
    };
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(data.error?.message || "Failed to create calendar event");

  const links = extractMeetLink(data);
  if (!links.joinLink) {
    throw new Error("Event created but no Meet/calendar link was returned");
  }
  return {
    provider: "google-calendar",
    joinLink: links.joinLink,
    meetLink: links.meetLink,
    calendarLink: links.calendarLink,
    invitationSent: true,
    eventId: data.id,
  };
}

/**
 * Create a Calendly invitee for the selected slot — Calendly emails the confirmation/invite.
 */
export async function bookCalendlySlot(
  integration: Integration,
  slot: BookableSlot,
  attendeeEmail: string,
  opts?: { attendeeName?: string; timezone?: string }
): Promise<BookingResult> {
  if (!attendeeEmail?.trim()) {
    throw new Error("Customer email is required to send the Calendly invitation");
  }
  const creds = (integration.credentials || {}) as Record<string, unknown>;
  const token = String(creds.access_token || creds.personal_token || creds.api_key || "").trim();
  if (!token) throw new Error("Calendly token missing");

  const eventTypeUri = slot.eventTypeUri;
  if (!eventTypeUri) {
    // Fallback: share scheduling URL if invitee API can't run without event type
    if (slot.schedulingUrl) {
      return {
        provider: "calendly",
        joinLink: slot.schedulingUrl,
        invitationSent: false,
      };
    }
    throw new Error("Calendly event type missing for this slot");
  }

  const timezone = resolveAppTimezone(opts?.timezone);
  const res = await fetch(`${CALENDLY_API}/invitees`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: attendeeEmail.trim(),
      name: opts?.attendeeName || attendeeEmail.trim(),
      event_type: eventTypeUri,
      start_time: slot.startIso,
      timezone,
      invitee_requested_timezone: timezone,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    resource?: {
      uri?: string;
      cancel_url?: string;
      reschedule_url?: string;
      event?: string;
    };
    message?: string;
    title?: string;
    details?: unknown;
  };

  if (!res.ok) {
    // Some Calendly plans block invitee creation via API — fall back to slot scheduling URL
    console.warn("[Calendar] Calendly invitee create failed:", data.message || data.title || res.status, data.details);
    if (slot.schedulingUrl) {
      return {
        provider: "calendly",
        joinLink: slot.schedulingUrl,
        invitationSent: false,
      };
    }
    throw new Error(data.message || data.title || `Calendly booking failed (${res.status})`);
  }

  // Fetch scheduled event for location / join URL when possible
  let joinLink = slot.schedulingUrl || "";
  const eventUri = data.resource?.event;
  if (eventUri) {
    try {
      const evRes = await fetch(eventUri, { headers: { Authorization: `Bearer ${token}` } });
      const evData = (await evRes.json().catch(() => ({}))) as {
        resource?: { location?: { join_url?: string; location?: string }; uri?: string };
      };
      joinLink =
        evData.resource?.location?.join_url ||
        evData.resource?.location?.location ||
        data.resource?.reschedule_url ||
        joinLink;
    } catch {
      /* keep fallback */
    }
  }
  if (!joinLink) {
    joinLink = data.resource?.reschedule_url || data.resource?.cancel_url || "https://calendly.com";
  }

  return {
    provider: "calendly",
    joinLink,
    invitationSent: true,
    eventId: data.resource?.uri,
  };
}

/** Book via the connected provider and return join link + invitation status. */
export async function bookAppointment(opts: {
  organizationId: string;
  config: AiAssistantCalendarConfig;
  slot: BookableSlot;
  attendeeEmail: string;
  title?: string;
  attendeeName?: string;
  timezone?: string;
}): Promise<BookingResult> {
  const resolved = await resolveCalendarIntegration(opts.organizationId, opts.config);
  if (!resolved.integration || resolved.provider === "none") {
    throw new Error(resolved.error || "No calendar integration connected");
  }
  if (resolved.provider === "google-calendar") {
    return bookGoogleSlot(
      resolved.integration,
      opts.slot,
      opts.attendeeEmail,
      opts.title || `Demo — ${opts.attendeeEmail}`,
      { attendeeName: opts.attendeeName, timezone: opts.timezone }
    );
  }
  return bookCalendlySlot(resolved.integration, opts.slot, opts.attendeeEmail, {
    attendeeName: opts.attendeeName,
    timezone: opts.timezone,
  });
}

export function formatBookingConfirmationMessage(
  slot: BookableSlot,
  email: string,
  booking: BookingResult
): string {
  const lines = [
    `✅ Your appointment is confirmed for ${slot.label}.`,
    "",
  ];
  if (booking.meetLink) {
    lines.push(`🎥 Google Meet: ${booking.meetLink}`);
  }
  if (booking.calendarLink && booking.calendarLink !== booking.meetLink) {
    lines.push(`📅 Calendar: ${booking.calendarLink}`);
  }
  if (!booking.meetLink && booking.joinLink) {
    lines.push(`🔗 Join / booking link: ${booking.joinLink}`);
  }
  lines.push("");
  if (booking.invitationSent) {
    lines.push(`📧 Invitation sent to ${email} — please check your inbox (and spam).`);
  } else {
    lines.push(`📧 Please open this link to complete/confirm your booking: ${booking.joinLink}`);
    lines.push(`We also noted your email: ${email}`);
  }
  lines.push("", "Looking forward to speaking with you!");
  return lines.join("\n");
}

export function extractEmail(text: string): string | null {
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0] : null;
}

/** Detect booking / appointment intent (English + common Hindi/Hinglish). */
export function isBookingIntent(text: string): boolean {
  return /book|demo|slot|appointment|schedule|meeting|available\s+time|reschedule|google\s*meet|calendly|\bcall\b|मीटिंग|अपॉइंटमेंट|बुक|स्लॉट|समय|डेमो|मिलना|शेड्यूल/i.test(
    text
  );
}
