import type { Express, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import {
  formatInAppTimezone,
  fromAppZonedTime,
  resolveAppTimezone,
  toAppZonedTime,
} from "@shared/timezone";
import type { BookingCalendarAvailability } from "@shared/schema";
import {
  countOverlappingMeetings,
  countOverlapsInBusyList,
  getBookingCalendarBySlug,
  listLocalBusyMeetings,
} from "./booking-calendars-repo";
import { createScheduledMeeting } from "./meetings-repo";
import {
  createGoogleMeetEvent,
  filterGoogleBusySlots,
  googleCalendarIntegrationReady,
} from "./google-meet";
import { findOrCreateChat } from "../routes/shared";
import { businessAPIManager } from "../whatsapp/business-api-client";
import { whatsappManager as unofficialWhatsappManager } from "../whatsapp/client";
import { persistPanelOutboundTextMessage } from "../panel-outbound-message";

function parseHm(hm: string): number {
  const [h, m] = hm.split(":").map((x) => Number(x));
  return (h || 0) * 60 + (m || 0);
}

function generateDaySlots(
  dayIso: string,
  durationMinutes: number,
  availability: BookingCalendarAvailability,
): Array<{ start: Date; end: Date }> {
  const tz = resolveAppTimezone(availability.timezone);
  const [y, mo, d] = dayIso.split("-").map((x) => Number(x));
  if (!y || !mo || !d) return [];
  // Build a wall-clock date in app timezone for that calendar day
  const wallBase = new Date(y, mo - 1, d, 12, 0, 0, 0);
  const zonedProbe = toAppZonedTime(fromAppZonedTime(wallBase, tz), tz);
  // Use the requested Y-M-D as zoned day
  const zonedDay = new Date(zonedProbe);
  zonedDay.setFullYear(y, mo - 1, d);
  zonedDay.setHours(0, 0, 0, 0);

  const weekday = zonedDay.getDay();
  if (!availability.weekdays.includes(weekday)) return [];

  const startMin = parseHm(availability.startTime);
  const endMin = parseHm(availability.endTime);
  const now = new Date();
  const slots: Array<{ start: Date; end: Date }> = [];

  for (let m = startMin; m + durationMinutes <= endMin; m += durationMinutes) {
    const wall = new Date(zonedDay);
    wall.setHours(Math.floor(m / 60), m % 60, 0, 0);
    const start = fromAppZonedTime(wall, tz);
    if (start.getTime() <= now.getTime() + 2 * 60 * 1000) continue;
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    slots.push({ start, end });
  }
  return slots;
}

async function resolveHostName(hostUserId: string): Promise<string> {
  const user = await storage.getUser(hostUserId);
  if (!user) return "The host";
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return name || user.email || "The host";
}

/** Prefer calendar's saved WhatsApp session; fall back to any connected org session. */
async function resolveWhatsAppSessionId(
  organizationId: string,
  preferred?: string | null,
): Promise<string | null> {
  if (preferred) {
    const session = await storage.getSession(preferred);
    if (session && !session.deletedAt && session.status === "connected") {
      return preferred;
    }
  }
  const sessions = await storage.getSessionsByOrganization(organizationId);
  const connected = sessions.find((s) => !s.deletedAt && s.status === "connected");
  return connected?.sessionId || null;
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
  const to = toPhone.replace(/@c\.us|@g\.us/gi, "").replace(/\D/g, "").trim();
  if (!to || to.length < 8) {
    throw new Error("Invalid guest phone number");
  }
  if (session.connectionType === "official") {
    const r = await businessAPIManager.sendTextMessage(sessionId, to, message);
    return { waMessageId: typeof r?.id === "string" ? r.id : undefined };
  }
  const r = await unofficialWhatsappManager.sendTextMessage(sessionId, to, message);
  return { waMessageId: typeof r?.id === "string" ? r.id : undefined };
}

export function registerPublicBookingRoutes(app: Express) {
  app.get("/api/public/book/:slug", async (req: Request, res: Response) => {
    try {
      const slug = String(req.params.slug || "").trim().toLowerCase();
      const calendar = await getBookingCalendarBySlug(slug);
      if (!calendar) return res.status(404).json({ message: "Booking calendar not found" });

      const hostName = await resolveHostName(calendar.hostUserId);
      res.json({
        name: calendar.name,
        description: calendar.description,
        logoUrl: calendar.logoUrl,
        durationMinutes: calendar.durationMinutes,
        hostName,
        theme: calendar.theme || "emerald",
        maxBookingsPerSlot: calendar.maxBookingsPerSlot ?? 1,
        availability: calendar.availability,
        timezone: calendar.availability?.timezone || "Asia/Kolkata",
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to load calendar";
      console.error("[public book get]", e);
      res.status(500).json({ message });
    }
  });

  app.get("/api/public/book/:slug/slots", async (req: Request, res: Response) => {
    try {
      const slug = String(req.params.slug || "").trim().toLowerCase();
      const date = String(req.query.date || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: "date must be YYYY-MM-DD" });
      }
      const calendar = await getBookingCalendarBySlug(slug);
      if (!calendar) return res.status(404).json({ message: "Booking calendar not found" });

      const hostName = await resolveHostName(calendar.hostUserId);
      const availability = calendar.availability;
      const capacity = Math.max(1, Number(calendar.maxBookingsPerSlot) || 1);
      let candidates = generateDaySlots(date, calendar.durationMinutes, availability);

      // Filter against bookings on this calendar (respects person/slot capacity)
      if (candidates.length) {
        const dayStart = candidates[0]!.start;
        const dayEnd = candidates[candidates.length - 1]!.end;
        const localBusy = await listLocalBusyMeetings(calendar.organizationId, dayStart, dayEnd, {
          bookingCalendarId: calendar.id,
        });
        candidates = candidates.filter(
          (s) => countOverlapsInBusyList(s, localBusy) < capacity,
        );
      }

      // Google freeBusy is binary — only apply when capacity is 1 (exclusive slots)
      if (capacity === 1 && candidates.length && calendar.integrationId) {
        const all = await storage.getIntegrationsByOrganization(calendar.organizationId);
        const integration = all.find(
          (i) => i.id === calendar.integrationId && googleCalendarIntegrationReady(i),
        );
        if (integration) {
          try {
            candidates = await filterGoogleBusySlots(integration, candidates);
          } catch (err) {
            console.error("[public book slots] freeBusy failed:", err);
          }
        }
      }

      const tz = resolveAppTimezone(availability.timezone);
      const slots = candidates.map((s) => ({
        startIso: s.start.toISOString(),
        endIso: s.end.toISOString(),
        label: formatInAppTimezone(s.start, { hour: "numeric", minute: "2-digit", hour12: true }, tz),
      }));

      res.json({
        date,
        hostName,
        durationMinutes: calendar.durationMinutes,
        timezone: tz,
        slots,
        unavailableMessage: `${hostName} is not available for this time.`,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to load slots";
      console.error("[public book slots]", e);
      res.status(500).json({ message });
    }
  });

  app.post("/api/public/book/:slug", async (req: Request, res: Response) => {
    try {
      const slug = String(req.params.slug || "").trim().toLowerCase();
      const parsed = z
        .object({
          startTime: z.string().min(1),
          guestName: z.string().min(1).max(200),
          guestEmail: z.string().email("Valid email is required"),
          guestPhone: z
            .string()
            .min(8, "Phone number is required")
            .max(32)
            .refine((v) => v.replace(/\D/g, "").length >= 8, "Enter a valid phone number"),
        })
        .safeParse(req.body);
      if (!parsed.success) {
        const msg =
          parsed.error.issues[0]?.message ||
          "Name, email, and phone number are required";
        return res.status(400).json({ message: msg });
      }

      const calendar = await getBookingCalendarBySlug(slug);
      if (!calendar) return res.status(404).json({ message: "Booking calendar not found" });

      const hostName = await resolveHostName(calendar.hostUserId);
      const start = new Date(parsed.data.startTime);
      if (Number.isNaN(start.getTime())) {
        return res.status(400).json({ message: "Invalid start time" });
      }
      const end = new Date(start.getTime() + calendar.durationMinutes * 60 * 1000);
      const unavailableMessage = `${hostName} is not available for this time.`;
      const capacity = Math.max(1, Number(calendar.maxBookingsPerSlot) || 1);

      // Re-validate slot against availability window
      const tz = resolveAppTimezone(calendar.availability.timezone);
      const zoned = toAppZonedTime(start, tz);
      const dayIso = `${zoned.getFullYear()}-${String(zoned.getMonth() + 1).padStart(2, "0")}-${String(zoned.getDate()).padStart(2, "0")}`;
      const daySlots = generateDaySlots(dayIso, calendar.durationMinutes, calendar.availability);
      const matchesWindow = daySlots.some((s) => Math.abs(s.start.getTime() - start.getTime()) < 60_000);
      if (!matchesWindow) {
        return res.status(409).json({ message: unavailableMessage, code: "unavailable" });
      }

      const overlap = await countOverlappingMeetings(calendar.organizationId, start, end, {
        bookingCalendarId: calendar.id,
      });
      if (overlap >= capacity) {
        return res.status(409).json({ message: unavailableMessage, code: "unavailable" });
      }

      // Google freeBusy re-check (exclusive calendars only)
      let meetLink = `https://meet.google.com/new`;
      let externalEventId: string | undefined;
      if (calendar.integrationId) {
        const all = await storage.getIntegrationsByOrganization(calendar.organizationId);
        const integration = all.find(
          (i) => i.id === calendar.integrationId && googleCalendarIntegrationReady(i),
        );
        if (integration) {
          try {
            if (capacity === 1) {
              const free = await filterGoogleBusySlots(integration, [{ start, end }]);
              if (!free.length) {
                return res.status(409).json({ message: unavailableMessage, code: "unavailable" });
              }
            }
            const created = await createGoogleMeetEvent(integration, {
              title: `${calendar.name} — ${parsed.data.guestName}`,
              start,
              end,
              timeZone: tz,
              description: `Booked via public scheduling link.\nGuest: ${parsed.data.guestName}\nEmail: ${parsed.data.guestEmail}\nPhone: ${parsed.data.guestPhone}`,
              attendeeEmail: parsed.data.guestEmail,
              attendeeName: parsed.data.guestName,
            });
            meetLink = created.link;
            externalEventId = created.eventId;
          } catch (err) {
            console.error("[public book] Google Meet create failed:", err);
            return res.status(400).json({
              message: err instanceof Error ? err.message : "Could not create meeting link",
            });
          }
        }
      }

      const guestPhone = parsed.data.guestPhone.replace(/\D/g, "");
      const waSessionId = await resolveWhatsAppSessionId(
        calendar.organizationId,
        calendar.whatsappSessionId,
      );
      let chatId: string | null = null;
      if (waSessionId && guestPhone) {
        try {
          chatId = await findOrCreateChat(waSessionId, guestPhone);
          const chat = await storage.getChat(chatId);
          if (chat && parsed.data.guestName && chat.contactName !== parsed.data.guestName) {
            await storage.updateChat(chatId, { contactName: parsed.data.guestName });
          }
        } catch (err) {
          console.error("[public book] findOrCreateChat failed:", err);
        }
      }

      const whenStr = formatInAppTimezone(
        start,
        { dateStyle: "medium", timeStyle: "short" },
        tz,
      );

      const meeting = await createScheduledMeeting({
        organizationId: calendar.organizationId,
        userId: calendar.hostUserId,
        chatId,
        contactName: parsed.data.guestName.trim(),
        contactNumber: guestPhone || "public-booking",
        customerEmail: parsed.data.guestEmail.trim(),
        provider: "google_meet",
        title: `Meet — ${parsed.data.guestName.trim()}`,
        meetLink,
        startAt: start,
        endAt: end,
        durationMinutes: calendar.durationMinutes,
        integrationId: calendar.integrationId,
        whatsappSessionId: waSessionId,
        externalEventId: externalEventId || null,
        status: "scheduled",
        source: "booking_page",
        bookingCalendarId: calendar.id,
      });

      // WhatsApp confirmation to guest (from selected / connected panel number)
      if (waSessionId && guestPhone) {
        const firstName = parsed.data.guestName.trim().split(/\s+/)[0] || "there";
        const message = `Hello ${firstName},

Your meeting with ${hostName} is confirmed for ${whenStr} (${calendar.durationMinutes} minutes).

Join here:
${meetLink}

Thank you.`;
        try {
          const sendMeta = await sendWhatsAppText(waSessionId, guestPhone, message);
          if (chatId) {
            const sessionRow = await storage.getSession(waSessionId);
            if (sessionRow) {
              await persistPanelOutboundTextMessage({
                chatId,
                sessionId: waSessionId,
                userId: calendar.hostUserId,
                organizationId: calendar.organizationId,
                body: message,
                whatsappMessageId: sendMeta.waMessageId ?? null,
                connectionType: sessionRow.connectionType === "official" ? "official" : "unofficial",
              });
            }
          }
        } catch (err) {
          console.error("[public book] WhatsApp notify failed:", err);
        }
      } else if (!waSessionId) {
        console.warn(
          `[public book] No connected WhatsApp session for calendar ${calendar.id}; skipped WhatsApp notify`,
        );
      }

      res.status(201).json({
        ok: true,
        meetingId: meeting.id,
        meetLink,
        when: whenStr,
        hostName,
        durationMinutes: calendar.durationMinutes,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to book meeting";
      console.error("[public book post]", e);
      res.status(400).json({ message });
    }
  });
}
