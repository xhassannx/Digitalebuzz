import { storage } from "../storage";
import type { Integration } from "@shared/schema";
import { resolveAppTimezone } from "@shared/timezone";
import crypto from "crypto";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

export function googleCalendarIntegrationReady(i: Integration): boolean {
  if (i.name !== "google-calendar" || i.status !== "connected" || !i.credentials) return false;
  const c = i.credentials as Record<string, unknown>;
  return !!(c.access_token || c.refresh_token);
}

export async function getValidGoogleAccessToken(integration: Integration): Promise<string> {
  const creds = integration.credentials as Record<string, any>;
  if (!creds) throw new Error("No Google credentials");
  const expiresAt = creds.expires_at || 0;
  if (expiresAt && Date.now() < expiresAt - 60000) {
    return String(creds.access_token);
  }
  if (creds.refresh_token) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: creds.client_id || process.env.GOOGLE_CLIENT_ID || "",
        client_secret: creds.client_secret || process.env.GOOGLE_CLIENT_SECRET || "",
        refresh_token: creds.refresh_token,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) throw new Error("Failed to refresh Google token");
    const tokens = (await res.json()) as { access_token: string; expires_in?: number };
    creds.access_token = tokens.access_token;
    creds.expires_at = Date.now() + (Number(tokens.expires_in) || 3600) * 1000;
    await storage.updateIntegration(integration.id, integration.userId, { credentials: creds });
    return tokens.access_token;
  }
  if (!creds.access_token) throw new Error("Google Calendar is not fully connected");
  return String(creds.access_token);
}

export async function createGoogleMeetEvent(
  integration: Integration,
  params: {
    title: string;
    start: Date;
    end: Date;
    timeZone?: string;
    description?: string;
    attendeeEmail?: string;
    attendeeName?: string;
  },
): Promise<{ link: string; eventId?: string }> {
  const token = await getValidGoogleAccessToken(integration);
  const timeZone = resolveAppTimezone(params.timeZone);
  const body: Record<string, unknown> = {
    summary: params.title.slice(0, 200),
    description: params.description || "Scheduled meeting.",
    start: { dateTime: params.start.toISOString(), timeZone },
    end: { dateTime: params.end.toISOString(), timeZone },
    conferenceData: {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };
  if (params.attendeeEmail?.trim()) {
    body.attendees = [
      {
        email: params.attendeeEmail.trim(),
        displayName: params.attendeeName || undefined,
      },
    ];
  }
  const sendUpdates = params.attendeeEmail?.trim() ? "all" : "none";
  const res = await fetch(
    `${CALENDAR_API}/calendars/primary/events?conferenceDataVersion=1&sendUpdates=${sendUpdates}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err =
      (data.error as { message?: string } | undefined)?.message || JSON.stringify(data).slice(0, 200);
    throw new Error(`Google Calendar: ${err}`);
  }
  const eventId = typeof data.id === "string" ? data.id : undefined;
  const hangout = data.hangoutLink as string | undefined;
  if (hangout) return { link: hangout, eventId };
  const conf = data.conferenceData as
    | { entryPoints?: Array<{ entryPointType?: string; uri?: string }> }
    | undefined;
  const video = conf?.entryPoints?.find((e) => e.entryPointType === "video" && e.uri);
  if (video?.uri) return { link: video.uri, eventId };
  throw new Error("Google Meet link was not returned. Check Calendar API scopes include events.");
}

export async function filterGoogleBusySlots(
  integration: Integration,
  candidates: Array<{ start: Date; end: Date }>,
): Promise<Array<{ start: Date; end: Date }>> {
  if (!candidates.length) return [];
  const token = await getValidGoogleAccessToken(integration);
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
    calendars?: {
      primary?: { busy?: Array<{ start: string; end: string }>; errors?: Array<{ reason?: string }> };
    };
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
