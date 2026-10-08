import type { Express, Request, Response } from "express";
import { z } from "zod";
import { isAuthenticatedOrApiKey } from "../replitAuth";
import { resolveOrganizationContext, requirePermission } from "../middleware/organization-context";
import { rateLimitMiddleware } from "../middleware/rate-limiter";
import { storage } from "../storage";
import type { Integration } from "@shared/schema";
import { businessAPIManager } from "../whatsapp/business-api-client";
import { whatsappManager as unofficialWhatsappManager } from "../whatsapp/client";
import { persistPanelOutboundTextMessage } from "../panel-outbound-message";
import { formatInAppTimezone, resolveAppTimezone } from "@shared/timezone";
import {
  getMeetingStats,
  getScheduledMeeting,
  listScheduledMeetings,
  updateScheduledMeeting,
} from "./meetings-repo";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

const listQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  bookingCalendarId: z.string().uuid().optional(),
});

const statsQuerySchema = z.object({
  bookingCalendarId: z.string().uuid().optional(),
});

const rescheduleBodySchema = z.object({
  startTime: z.string().min(1),
  durationMinutes: z.number().int().min(15).max(480).default(30),
  /** When true, send WhatsApp (and keep same meet link) with the new time */
  notifyCustomer: z.boolean().optional().default(true),
});

function getUserId(req: Request): string | null {
  const u = (req as { user?: { claims?: { sub?: string } }; userId?: string }).user;
  return u?.claims?.sub || (req as { userId?: string }).userId || null;
}

function phoneDisplay(contactNumber: string): string {
  return contactNumber.replace(/@c\.us|@g\.us/gi, "").trim();
}

function googleCalendarIntegrationReady(i: Integration): boolean {
  if (i.name !== "google-calendar" || i.status !== "connected" || !i.credentials) return false;
  const c = i.credentials as Record<string, unknown>;
  return !!(c.access_token || c.refresh_token);
}

async function getValidGoogleAccessToken(integration: Integration): Promise<string> {
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

async function patchGoogleCalendarEvent(
  integration: Integration,
  eventId: string,
  params: { start: Date; end: Date; timeZone?: string },
): Promise<void> {
  const token = await getValidGoogleAccessToken(integration);
  const timeZone = resolveAppTimezone(params.timeZone);
  const res = await fetch(
    `${CALENDAR_API}/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        start: { dateTime: params.start.toISOString(), timeZone },
        end: { dateTime: params.end.toISOString(), timeZone },
      }),
    },
  );
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    const err = data.error?.message || `HTTP ${res.status}`;
    throw new Error(`Google Calendar update failed: ${err}`);
  }
}

async function sendWhatsAppText(
  sessionId: string,
  toPhone: string,
  message: string,
): Promise<{ waMessageId?: string }> {
  const session = await storage.getSession(sessionId);
  if (!session || session.status !== "connected") {
    throw new Error("WhatsApp session not connected");
  }
  const to = phoneDisplay(toPhone);
  if (session.connectionType === "official") {
    const r = await businessAPIManager.sendTextMessage(sessionId, to, message);
    return { waMessageId: typeof r?.id === "string" ? r.id : undefined };
  }
  const r = await unofficialWhatsappManager.sendTextMessage(sessionId, to, message);
  return { waMessageId: typeof r?.id === "string" ? r.id : undefined };
}

export function registerMeetingsRoutes(app: Express) {
  const withOrg = [isAuthenticatedOrApiKey, rateLimitMiddleware, resolveOrganizationContext];

  app.get(
    "/api/meetings/stats",
    ...withOrg,
    requirePermission("meetings.view"),
    async (req: Request, res: Response) => {
      try {
        const parsed = statsQuerySchema.safeParse(req.query);
        if (!parsed.success) {
          return res.status(400).json({ message: "Invalid query" });
        }
        const organizationId = req.context!.organizationId;
        const stats = await getMeetingStats(organizationId, {
          bookingCalendarId: parsed.data.bookingCalendarId,
        });
        res.json(stats);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Failed to load meeting stats";
        console.error("[meetings stats]", e);
        res.status(500).json({ message });
      }
    },
  );

  app.get(
    "/api/meetings",
    ...withOrg,
    requirePermission("meetings.view"),
    async (req: Request, res: Response) => {
      try {
        const parsed = listQuerySchema.safeParse(req.query);
        if (!parsed.success) {
          return res.status(400).json({ message: "Invalid query" });
        }
        const organizationId = req.context!.organizationId;
        let from: Date | undefined;
        let to: Date | undefined;
        if (parsed.data.from) {
          from = new Date(parsed.data.from);
          if (Number.isNaN(from.getTime())) {
            return res.status(400).json({ message: "Invalid from date" });
          }
        }
        if (parsed.data.to) {
          to = new Date(parsed.data.to);
          if (Number.isNaN(to.getTime())) {
            return res.status(400).json({ message: "Invalid to date" });
          }
        }
        const meetings = await listScheduledMeetings({
          organizationId,
          from,
          to,
          bookingCalendarId: parsed.data.bookingCalendarId,
        });
        res.json({ meetings });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Failed to load meetings";
        console.error("[meetings list]", e);
        res.status(500).json({ message });
      }
    },
  );

  app.patch(
    "/api/meetings/:id/reschedule",
    ...withOrg,
    requirePermission("meetings.view", "manage_contacts.edit"),
    async (req: Request, res: Response) => {
      try {
        const meetingId = String(req.params.id || "").trim();
        if (!meetingId) return res.status(400).json({ message: "Meeting id required" });

        const parsed = rescheduleBodySchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            message: parsed.error.flatten().formErrors.join(", ") || "Invalid body",
          });
        }

        const userId = getUserId(req);
        if (!userId) return res.status(401).json({ message: "Authentication required" });

        const organizationId = req.context!.organizationId;
        const meeting = await getScheduledMeeting(meetingId, organizationId);
        if (!meeting) return res.status(404).json({ message: "Meeting not found" });
        if (meeting.status === "cancelled") {
          return res.status(400).json({ message: "Cancelled meetings cannot be rescheduled" });
        }

        const start = new Date(parsed.data.startTime);
        if (Number.isNaN(start.getTime())) {
          return res.status(400).json({ message: "Invalid start time" });
        }
        const durationMinutes = parsed.data.durationMinutes;
        const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
        const meetTz = resolveAppTimezone();
        const whenStr = formatInAppTimezone(
          start,
          { dateStyle: "medium", timeStyle: "short" },
          meetTz,
        );

        if (meeting.provider === "google_meet" && meeting.externalEventId) {
          const all = await storage.getIntegrationsByOrganization(organizationId);
          const googleRows = all.filter(googleCalendarIntegrationReady);
          const integration =
            (meeting.integrationId
              ? googleRows.find((i) => i.id === meeting.integrationId)
              : undefined) || googleRows[0];
          if (integration) {
            try {
              await patchGoogleCalendarEvent(integration, meeting.externalEventId, {
                start,
                end,
                timeZone: meetTz,
              });
            } catch (calErr) {
              console.error("[meetings reschedule] Google Calendar patch failed:", calErr);
              // Still update local record; surface a soft warning in response
            }
          }
        }

        const updated = await updateScheduledMeeting(meetingId, organizationId, {
          startAt: start,
          endAt: end,
          durationMinutes,
          status: "scheduled",
        });
        if (!updated) {
          return res.status(500).json({ message: "Failed to update meeting" });
        }

        let notified = false;
        if (parsed.data.notifyCustomer) {
          const sessionId = meeting.whatsappSessionId;
          if (!sessionId) {
            return res.status(200).json({
              meeting: updated,
              notified: false,
              warning: "Meeting updated, but no WhatsApp session is linked to notify the customer.",
            });
          }
          const firstName = (meeting.contactName || "").trim().split(/\s+/)[0] || "there";
          const message =
            meeting.provider === "google_meet"
              ? `Hello ${firstName},

Your Google Meet has been rescheduled to ${whenStr} (${durationMinutes} minutes).

Join here:
${meeting.meetLink}

If you need a different time, reply to this message and we'll help you reschedule.

Thank you.`
              : `Hello ${firstName},

We've updated the suggested time for your booking to around ${whenStr}.

Please use our booking page (or reply here) if you need another slot:
${meeting.meetLink}

Thank you.`;

          try {
            const sendMeta = await sendWhatsAppText(sessionId, meeting.contactNumber, message);
            if (meeting.chatId) {
              const sessionRow = await storage.getSession(sessionId);
              if (sessionRow) {
                const conn: "official" | "unofficial" =
                  sessionRow.connectionType === "official" ? "official" : "unofficial";
                await persistPanelOutboundTextMessage({
                  chatId: meeting.chatId,
                  sessionId,
                  userId,
                  organizationId,
                  body: message,
                  whatsappMessageId: sendMeta.waMessageId ?? null,
                  connectionType: conn,
                });
              }
            }
            notified = true;
          } catch (notifyErr) {
            console.error("[meetings reschedule] notify failed:", notifyErr);
            return res.status(200).json({
              meeting: updated,
              notified: false,
              warning:
                notifyErr instanceof Error
                  ? `Meeting updated, but WhatsApp notify failed: ${notifyErr.message}`
                  : "Meeting updated, but WhatsApp notify failed.",
            });
          }
        }

        res.json({ meeting: updated, notified });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Failed to reschedule meeting";
        console.error("[meetings reschedule]", e);
        res.status(400).json({ message });
      }
    },
  );
}
