import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import { isAuthenticatedOrApiKey } from "../replitAuth";
import { resolveOrganizationContext, requirePermission } from "../middleware/organization-context";
import { rateLimitMiddleware } from "../middleware/rate-limiter";
import { storage } from "../storage";
import type { Integration } from "@shared/schema";
import { businessAPIManager } from "../whatsapp/business-api-client";
import { whatsappManager as unofficialWhatsappManager } from "../whatsapp/client";
import { persistPanelOutboundTextMessage } from "../panel-outbound-message";
import { isOrgEmailOutboundConfigured, sendOrgOutboundEmail } from "../utils/email";
import { formatInAppTimezone, resolveAppTimezone } from "@shared/timezone";
import { createScheduledMeeting } from "./meetings-repo";
import { findOrCreateChat } from "../routes/shared";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const CALENDLY_API_BASE = "https://api.calendly.com";

const sendMeetBodySchema = z
  .object({
    /** Inbox: existing chat. Meetings page: managed contact (chat is created if needed). */
    chatId: z.string().min(1).optional(),
    contactId: z.string().min(1).optional(),
    whatsappSessionId: z.string().optional(),
    provider: z.enum(["google_meet", "calendly"]),
    /** ISO 8601 start time (used for Google Meet event and message copy) */
    startTime: z.string().min(1),
    durationMinutes: z.number().int().min(15).max(480).default(30),
    integrationId: z.string().optional(),
    /** Optional Calendly booking page URL (must be https). If omitted, fetched from Calendly API when possible */
    calendlySchedulingUrl: z.string().url().optional(),
    /** Optional — same link by email when org SMTP is configured */
    customerEmail: z.string().max(320).optional(),
  })
  .refine((d) => !!(d.chatId || d.contactId), {
    message: "chatId or contactId is required",
  });

function getUserId(req: Request): string | null {
  const u = (req as { user?: { claims?: { sub?: string } }; userId?: string }).user;
  return u?.claims?.sub || (req as { userId?: string }).userId || null;
}

function phoneDisplayFromChat(contactNumber: string): string {
  return contactNumber.replace(/@c\.us|@g\.us/gi, "").trim();
}

async function pickConnectedSessionForSend(organizationId: string, sessionId: string | undefined): Promise<string> {
  const sessions = await storage.getSessionsByOrganization(organizationId);
  const active = sessions.filter((s) => !s.deletedAt && s.status === "connected");
  if (sessionId) {
    const s = active.find((x) => x.sessionId === sessionId);
    if (!s) throw new Error("WhatsApp session not found or not connected for this organization.");
    return s.sessionId;
  }
  const official = active.filter((s) => s.connectionType === "official");
  if (official[0]) return official[0].sessionId;
  if (active[0]) return active[0].sessionId;
  throw new Error("Add a connected WhatsApp session to send messages.");
}

async function sendWhatsAppText(sessionId: string, toPhone: string, message: string): Promise<{ waMessageId?: string }> {
  const session = await storage.getSession(sessionId);
  if (!session || session.status !== "connected") {
    throw new Error("WhatsApp session not connected");
  }
  const to = phoneDisplayFromChat(toPhone);
  if (session.connectionType === "official") {
    const r = await businessAPIManager.sendTextMessage(sessionId, to, message);
    return { waMessageId: typeof r?.id === "string" ? r.id : undefined };
  }
  const r = await unofficialWhatsappManager.sendTextMessage(sessionId, to, message);
  return { waMessageId: typeof r?.id === "string" ? r.id : undefined };
}

async function assertChatInOrganization(chatId: string, organizationId: string) {
  const chat = await storage.getChat(chatId);
  if (!chat) throw new Error("Chat not found");
  const orgSessions = await storage.getSessionsByOrganization(organizationId);
  if (!orgSessions.some((s) => s.sessionId === chat.sessionId)) {
    throw new Error("This chat does not belong to your organization.");
  }
  return chat;
}

function googleCalendarIntegrationReady(i: Integration): boolean {
  if (i.name !== "google-calendar" || i.status !== "connected" || !i.credentials) return false;
  const c = i.credentials as Record<string, unknown>;
  return !!(c.access_token || c.refresh_token);
}

function calendlyIntegrationReady(i: Integration): boolean {
  if (i.name !== "calendly" || i.status !== "connected" || !i.credentials) return false;
  const c = i.credentials as Record<string, unknown>;
  const t = c.access_token || c.personal_token;
  return typeof t === "string" && t.trim().length > 0;
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

function pickIntegrationByIdOrFirst(list: Integration[], integrationId: string | undefined, label: string): Integration {
  if (integrationId) {
    const one = list.find((x) => x.id === integrationId);
    if (!one) throw new Error(`${label} integration not found`);
    return one;
  }
  if (!list.length) throw new Error(`No ${label} integration connected`);
  return list[0]!;
}

async function createGoogleMeetEvent(
  integration: Integration,
  params: { title: string; start: Date; end: Date; timeZone?: string }
): Promise<{ link: string; eventId?: string }> {
  const token = await getValidGoogleAccessToken(integration);
  const timeZone = resolveAppTimezone(params.timeZone);
  const body = {
    summary: params.title.slice(0, 200),
    description: "Scheduled from WhatsApp inbox.",
    start: { dateTime: params.start.toISOString(), timeZone },
    end: { dateTime: params.end.toISOString(), timeZone },
    conferenceData: {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };
  const res = await fetch(`${CALENDAR_API}/calendars/primary/events?conferenceDataVersion=1`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = (data.error as { message?: string } | undefined)?.message || JSON.stringify(data).slice(0, 200);
    throw new Error(`Google Calendar: ${err}`);
  }
  const eventId = typeof data.id === "string" ? data.id : undefined;
  const hangout = data.hangoutLink as string | undefined;
  if (hangout) return { link: hangout, eventId };
  const conf = data.conferenceData as { entryPoints?: Array<{ entryPointType?: string; uri?: string }> } | undefined;
  const video = conf?.entryPoints?.find((e) => e.entryPointType === "video" && e.uri);
  if (video?.uri) return { link: video.uri, eventId };
  throw new Error("Google Meet link was not returned. Check Calendar API scopes include events.");
}

async function fetchCalendlySchedulingUrl(integration: Integration): Promise<string> {
  const creds = integration.credentials as Record<string, unknown>;
  const accessToken = String(creds.access_token || "").trim();
  if (!accessToken) throw new Error("Calendly token missing");
  const res = await fetch(`${CALENDLY_API_BASE}/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
  });
  const data = (await res.json().catch(() => ({}))) as { resource?: { scheduling_url?: string } };
  if (!res.ok) {
    throw new Error("Could not load Calendly profile. Reconnect Calendly in Integrations.");
  }
  const url = data.resource?.scheduling_url;
  if (typeof url === "string" && url.startsWith("http")) return url;
  throw new Error("Calendly did not return a scheduling URL. Set a booking link in Calendly or paste your scheduling URL.");
}

export function registerChatSchedulingRoutes(app: Express) {
  const withOrg = [isAuthenticatedOrApiKey, rateLimitMiddleware, resolveOrganizationContext];

  app.get(
    "/api/scheduling/chat-options",
    ...withOrg,
    requirePermission("manage_contacts.view", "manage_contacts.edit", "meetings.view"),
    async (req: Request, res: Response) => {
      try {
        const organizationId = req.context!.organizationId;
        const all = await storage.getIntegrationsByOrganization(organizationId);
        const googleList = all.filter(googleCalendarIntegrationReady).map((i) => ({
          id: i.id,
          label:
            String((i.config as Record<string, unknown> | undefined)?.connectionName || i.displayName || "Google Calendar"),
        }));
        const calendlyList = all.filter(calendlyIntegrationReady).map((i) => ({
          id: i.id,
          label: String((i.config as Record<string, unknown> | undefined)?.connectionName || i.displayName || "Calendly"),
        }));
        const sessions = await storage.getSessionsByOrganization(organizationId);
        const connected = sessions.filter((s) => !s.deletedAt && s.status === "connected");
        const emailCopyAvailable = await isOrgEmailOutboundConfigured(organizationId);
        res.json({
          emailCopyAvailable,
          googleMeet: googleList.length > 0,
          calendly: calendlyList.length > 0,
          googleCalendarConnections: googleList,
          calendlyConnections: calendlyList,
          whatsappSessions: connected.map((s) => ({
            sessionId: s.sessionId,
            connectionType: s.connectionType,
            label:
              (s.connectionType === "official" ? "[Business] " : "[WhatsApp] ") +
              (s.deviceInfo?.verifiedName ||
                s.deviceInfo?.displayPhoneNumber ||
                s.deviceInfo?.name ||
                s.sessionId.slice(0, 8)),
          })),
        });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Failed to load scheduling options";
        console.error("[scheduling chat-options]", e);
        res.status(500).json({ message });
      }
    }
  );

  app.post(
    "/api/scheduling/send-meet-link",
    ...withOrg,
    requirePermission("manage_contacts.edit", "meetings.view"),
    async (req: Request, res: Response) => {
      try {
        const parsed = sendMeetBodySchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            message: parsed.error.flatten().formErrors.join(", ") || "Invalid body",
          });
        }
        const userId = getUserId(req);
        if (!userId) return res.status(401).json({ message: "Authentication required" });
        const organizationId = req.context!.organizationId;
        const {
          chatId: chatIdRaw,
          contactId,
          whatsappSessionId,
          provider,
          startTime,
          durationMinutes,
          integrationId,
          calendlySchedulingUrl,
          customerEmail: customerEmailRaw,
        } = parsed.data;

        let customerEmail = customerEmailRaw?.trim() || undefined;
        if (customerEmail) {
          const emailOk = z.string().email().safeParse(customerEmail).success;
          if (!emailOk) {
            return res.status(400).json({ message: "Invalid email address" });
          }
          const canEmail = await isOrgEmailOutboundConfigured(organizationId);
          if (!canEmail) {
            return res.status(400).json({
              message: "Email copy requires SMTP (Integrations → SMTP or Settings → SMTP, or platform mail).",
            });
          }
        }

        const waSessionId = await pickConnectedSessionForSend(organizationId, whatsappSessionId);

        let chat = chatIdRaw ? await assertChatInOrganization(chatIdRaw, organizationId) : null;
        if (!chat && contactId) {
          const contact = await storage.getManagedContactByOrganization(contactId, organizationId);
          if (!contact) {
            return res.status(404).json({ message: "Customer not found" });
          }
          const phone = String(contact.phoneNumber || "").trim();
          if (!phone) {
            return res.status(400).json({ message: "Selected customer has no phone number" });
          }
          const resolvedChatId = await findOrCreateChat(waSessionId, phone);
          chat = await storage.getChat(resolvedChatId);
          if (!chat) {
            return res.status(500).json({ message: "Could not open chat for this customer" });
          }
          const preferredName = (contact.name || "").trim();
          if (preferredName && chat.contactName !== preferredName) {
            const updated = await storage.updateChat(chat.id, { contactName: preferredName });
            if (updated) chat = updated;
          }
          if (!customerEmail && contact.email) {
            const emailCandidate = String(contact.email).trim();
            if (z.string().email().safeParse(emailCandidate).success) {
              const canEmail = await isOrgEmailOutboundConfigured(organizationId);
              if (canEmail) customerEmail = emailCandidate;
            }
          }
        }
        if (!chat) {
          return res.status(400).json({ message: "chatId or contactId is required" });
        }

        const all = await storage.getIntegrationsByOrganization(organizationId);

        const googleRows = all.filter(googleCalendarIntegrationReady);
        const calendlyRows = all.filter(calendlyIntegrationReady);

        const firstName = (chat.contactName || "").trim().split(/\s+/)[0] || "there";
        const start = new Date(startTime);
        if (Number.isNaN(start.getTime())) {
          return res.status(400).json({ message: "Invalid start time" });
        }
        const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
        const meetTz = resolveAppTimezone();
        const whenStr = formatInAppTimezone(
          start,
          { dateStyle: "medium", timeStyle: "short" },
          meetTz
        );

        let message: string;
        let linkOut: string;
        let usedIntegrationId: string | undefined;
        let externalEventId: string | undefined;
        const meetingTitle = `Meet — ${chat.contactName || "customer"}`;

        if (provider === "google_meet") {
          if (googleRows.length === 0) {
            return res.status(400).json({ message: "Google Calendar is not connected for this organization." });
          }
          const integration = pickIntegrationByIdOrFirst(googleRows, integrationId, "Google Calendar");
          if (integration.organizationId && integration.organizationId !== organizationId) {
            return res.status(403).json({ message: "Integration mismatch" });
          }
          usedIntegrationId = integration.id;
          const meetEvent = await createGoogleMeetEvent(integration, {
            title: meetingTitle,
            start,
            end,
            timeZone: meetTz,
          });
          linkOut = meetEvent.link;
          externalEventId = meetEvent.eventId;
          message = `Hello ${firstName},

Your Google Meet is scheduled for ${whenStr} (${durationMinutes} minutes).

Join here:
${meetEvent.link}

If you need a different time, reply to this message and we'll help you reschedule.

Thank you.`;
        } else {
          if (calendlyRows.length === 0) {
            return res.status(400).json({ message: "Calendly is not connected for this organization." });
          }
          const integration = pickIntegrationByIdOrFirst(calendlyRows, integrationId, "Calendly");
          if (integration.organizationId && integration.organizationId !== organizationId) {
            return res.status(403).json({ message: "Integration mismatch" });
          }
          usedIntegrationId = integration.id;
          const bookUrl =
            calendlySchedulingUrl?.trim() || (await fetchCalendlySchedulingUrl(integration));
          linkOut = bookUrl;
          message = `Hello ${firstName},

Please choose a convenient time using our booking page:
${bookUrl}

(Suggested window: around ${whenStr} — you may pick any available slot.)

Thank you.`;
        }

        const sendMeta = await sendWhatsAppText(waSessionId, chat.contactNumber, message);
        const sessionRow = await storage.getSession(waSessionId);
        if (sessionRow) {
          const conn: "official" | "unofficial" =
            sessionRow.connectionType === "official" ? "official" : "unofficial";
          await persistPanelOutboundTextMessage({
            chatId: chat.id,
            sessionId: waSessionId,
            userId,
            organizationId,
            body: message,
            whatsappMessageId: sendMeta.waMessageId ?? null,
            connectionType: conn,
          });
        }

        if (customerEmail) {
          const subj =
            provider === "google_meet"
              ? `Your meeting link — ${whenStr}`
              : `Schedule a time with us`;
          const text = `${message}\n\n—\nSent from your WhatsApp conversation.`;
          const html = `<p style="font-family:system-ui,sans-serif;line-height:1.6;color:#111;white-space:pre-wrap;">${message.replace(
            /\n/g,
            "<br/>"
          )}</p><p style="color:#666;font-size:13px;">Sent from your WhatsApp conversation.</p>`;
          void sendOrgOutboundEmail(organizationId, {
            to: customerEmail,
            subject: subj,
            text,
            html,
          }).catch((err) => console.error("[scheduling] email copy failed:", err));
        }

        let meetingId: string | undefined;
        try {
          const meeting = await createScheduledMeeting({
            organizationId,
            userId,
            chatId: chat.id,
            contactName: chat.contactName || phoneDisplayFromChat(chat.contactNumber),
            contactNumber: phoneDisplayFromChat(chat.contactNumber),
            customerEmail: customerEmail || null,
            provider,
            title: meetingTitle,
            meetLink: linkOut,
            startAt: start,
            endAt: end,
            durationMinutes,
            integrationId: usedIntegrationId || null,
            whatsappSessionId: waSessionId,
            externalEventId: externalEventId || null,
            status: "scheduled",
            source: "inbox",
          });
          meetingId = meeting.id;
        } catch (persistErr) {
          console.error("[scheduling] failed to persist meeting:", persistErr);
        }

        res.status(201).json({ ok: true, link: linkOut, meetingId });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Failed to send meet link";
        console.error("[scheduling send-meet-link]", e);
        res.status(400).json({ message });
      }
    }
  );
}
