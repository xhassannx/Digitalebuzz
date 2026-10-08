import type { Express, Request, Response } from "express";
import { z } from "zod";
import { isAuthenticatedOrApiKey } from "../replitAuth";
import { resolveOrganizationContext, requirePermission } from "../middleware/organization-context";
import { rateLimitMiddleware } from "../middleware/rate-limiter";
import { storage } from "../storage";
import {
  createBookingCalendar,
  defaultAvailability,
  deleteBookingCalendar,
  getBookingCalendarById,
  getPublicDemoCalendar,
  getPublicDemoCalendarForOrg,
  listBookingCalendars,
  setPublicDemoCalendar,
  slugifyName,
  uniqueSlug,
  updateBookingCalendar,
} from "./booking-calendars-repo";
import { googleCalendarIntegrationReady } from "./google-meet";
import { DEFAULT_BOOKING_CALENDAR_THEME, isBookingCalendarThemeId } from "@shared/booking-calendar-themes";

function getUserId(req: Request): string | null {
  const u = (req as { user?: { claims?: { sub?: string } }; userId?: string }).user;
  return u?.claims?.sub || (req as { userId?: string }).userId || null;
}

const availabilitySchema = z.object({
  timezone: z.string().min(1).default("Asia/Kolkata"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1),
});

const themeSchema = z
  .string()
  .min(1)
  .max(32)
  .refine((v) => isBookingCalendarThemeId(v), "Invalid theme");

const createBodySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  hostUserId: z.string().min(1),
  slug: z.string().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  durationMinutes: z.number().int().min(15).max(480).default(30),
  logoUrl: z.string().max(2000).optional(),
  integrationId: z.string().optional(),
  whatsappSessionId: z.string().optional(),
  availability: availabilitySchema.optional(),
  theme: themeSchema.optional(),
  maxBookingsPerSlot: z.number().int().min(1).max(100).optional(),
});

export function registerBookingCalendarsRoutes(app: Express) {
  const withOrg = [isAuthenticatedOrApiKey, rateLimitMiddleware, resolveOrganizationContext];

  /** Public: landing "Book a Demo" → selected calendar booking URL */
  app.get("/api/public/book-demo", async (req: Request, res: Response) => {
    try {
      let organizationId =
        (typeof req.query.organizationId === "string" && req.query.organizationId) ||
        process.env.WHITELABEL_ORG_ID ||
        process.env.VITE_WHITELABEL_ORG_ID ||
        "";

      let calendar = organizationId
        ? await getPublicDemoCalendarForOrg(organizationId)
        : undefined;

      if (!calendar) {
        calendar = await getPublicDemoCalendar();
      }

      if (!calendar) {
        return res.json({ configured: false, url: null, slug: null, name: null });
      }

      const origin =
        (typeof req.headers.origin === "string" && req.headers.origin) ||
        `${req.protocol}://${req.get("host")}`;
      const path = `/book/${calendar.slug}`;
      res.json({
        configured: true,
        url: `${origin}${path}`,
        path,
        slug: calendar.slug,
        name: calendar.name,
        calendarId: calendar.id,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to load book demo link";
      console.error("[public book-demo]", e);
      res.status(500).json({ message });
    }
  });

  app.get(
    "/api/booking-calendars",
    ...withOrg,
    requirePermission("meetings.view"),
    async (req: Request, res: Response) => {
      try {
        const organizationId = req.context!.organizationId;
        const calendars = await listBookingCalendars(organizationId);
        const origin =
          (typeof req.headers.origin === "string" && req.headers.origin) ||
          `${req.protocol}://${req.get("host")}`;
        const demo = calendars.find((c) => c.isPublicDemo);
        res.json({
          calendars: calendars.map((c) => ({
            ...c,
            publicUrl: `${origin}/book/${c.slug}`,
          })),
          publicDemoCalendarId: demo?.id ?? null,
        });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Failed to list calendars";
        console.error("[booking-calendars list]", e);
        res.status(500).json({ message });
      }
    },
  );

  app.put(
    "/api/booking-calendars/public-demo",
    ...withOrg,
    requirePermission("meetings.view", "manage_contacts.edit"),
    async (req: Request, res: Response) => {
      try {
        const organizationId = req.context!.organizationId;
        const body = z
          .object({
            calendarId: z.string().min(1).nullable(),
          })
          .safeParse(req.body);
        if (!body.success) {
          return res.status(400).json({ message: "calendarId is required (string or null)" });
        }

        const calendar = await setPublicDemoCalendar(organizationId, body.data.calendarId);
        const origin =
          (typeof req.headers.origin === "string" && req.headers.origin) ||
          `${req.protocol}://${req.get("host")}`;

        res.json({
          publicDemoCalendarId: calendar?.id ?? null,
          calendar: calendar
            ? { ...calendar, publicUrl: `${origin}/book/${calendar.slug}` }
            : null,
        });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Failed to set public demo calendar";
        console.error("[booking-calendars public-demo]", e);
        res.status(400).json({ message });
      }
    },
  );

  app.post(
    "/api/booking-calendars",
    ...withOrg,
    requirePermission("meetings.view", "manage_contacts.edit"),
    async (req: Request, res: Response) => {
      try {
        const parsed = createBodySchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            message: parsed.error.flatten().formErrors.join(", ") || "Invalid body",
          });
        }
        const userId = getUserId(req);
        if (!userId) return res.status(401).json({ message: "Authentication required" });
        const organizationId = req.context!.organizationId;
        const { name, description, hostUserId, durationMinutes, integrationId, whatsappSessionId, logoUrl } =
          parsed.data;

        const members = await storage.getOrganizationMembers(organizationId);
        if (!members.some((m) => m.userId === hostUserId)) {
          return res.status(400).json({ message: "Selected team member is not in this organization" });
        }

        let slug = parsed.data.slug || slugifyName(name);
        slug = await uniqueSlug(slug);

        const all = await storage.getIntegrationsByOrganization(organizationId);
        const googleRows = all.filter(googleCalendarIntegrationReady);
        let resolvedIntegrationId = integrationId || null;
        if (resolvedIntegrationId) {
          if (!googleRows.some((i) => i.id === resolvedIntegrationId)) {
            return res.status(400).json({ message: "Google Calendar integration not found" });
          }
        } else if (googleRows[0]) {
          resolvedIntegrationId = googleRows[0].id;
        }

        const orgSessions = await storage.getSessionsByOrganization(organizationId);
        const connectedSessions = orgSessions.filter((s) => !s.deletedAt && s.status === "connected");
        let resolvedWhatsappSessionId = whatsappSessionId || null;
        if (resolvedWhatsappSessionId) {
          if (!connectedSessions.some((s) => s.sessionId === resolvedWhatsappSessionId)) {
            return res.status(400).json({ message: "Selected WhatsApp session is not connected" });
          }
        } else if (connectedSessions[0]) {
          resolvedWhatsappSessionId = connectedSessions[0].sessionId;
        }

        const calendar = await createBookingCalendar({
          organizationId,
          userId,
          hostUserId,
          name: name.trim(),
          description: description?.trim() || null,
          logoUrl: logoUrl?.trim() || null,
          slug,
          durationMinutes,
          provider: "google_meet",
          integrationId: resolvedIntegrationId,
          whatsappSessionId: resolvedWhatsappSessionId,
          availability: parsed.data.availability || defaultAvailability(),
          theme: parsed.data.theme || DEFAULT_BOOKING_CALENDAR_THEME,
          maxBookingsPerSlot: parsed.data.maxBookingsPerSlot ?? 1,
          isActive: true,
        });

        const origin =
          (typeof req.headers.origin === "string" && req.headers.origin) ||
          `${req.protocol}://${req.get("host")}`;
        res.status(201).json({
          calendar: {
            ...calendar,
            publicUrl: `${origin}/book/${calendar.slug}`,
          },
        });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Failed to create calendar";
        console.error("[booking-calendars create]", e);
        res.status(400).json({ message });
      }
    },
  );

  app.patch(
    "/api/booking-calendars/:id",
    ...withOrg,
    requirePermission("meetings.view", "manage_contacts.edit"),
    async (req: Request, res: Response) => {
      try {
        const organizationId = req.context!.organizationId;
        const id = String(req.params.id || "");
        const existing = await getBookingCalendarById(id, organizationId);
        if (!existing) return res.status(404).json({ message: "Calendar not found" });

        const body = z
          .object({
            name: z.string().min(1).max(200).optional(),
            description: z.string().max(2000).nullable().optional(),
            logoUrl: z.string().max(2000).nullable().optional(),
            hostUserId: z.string().min(1).optional(),
            durationMinutes: z.number().int().min(15).max(480).optional(),
            isActive: z.boolean().optional(),
            whatsappSessionId: z.string().nullable().optional(),
            integrationId: z.string().nullable().optional(),
            availability: availabilitySchema.optional(),
            theme: themeSchema.optional(),
            maxBookingsPerSlot: z.number().int().min(1).max(100).optional(),
          })
          .safeParse(req.body);
        if (!body.success) {
          return res.status(400).json({ message: "Invalid body" });
        }

        if (body.data.whatsappSessionId) {
          const orgSessions = await storage.getSessionsByOrganization(organizationId);
          const ok = orgSessions.some(
            (s) =>
              s.sessionId === body.data.whatsappSessionId &&
              !s.deletedAt &&
              s.status === "connected",
          );
          if (!ok) {
            return res.status(400).json({ message: "Selected WhatsApp session is not connected" });
          }
        }

        const updated = await updateBookingCalendar(id, organizationId, body.data);
        const origin =
          (typeof req.headers.origin === "string" && req.headers.origin) ||
          `${req.protocol}://${req.get("host")}`;
        res.json({
          calendar: updated
            ? { ...updated, publicUrl: `${origin}/book/${updated.slug}` }
            : null,
        });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Failed to update calendar";
        console.error("[booking-calendars update]", e);
        res.status(400).json({ message });
      }
    },
  );

  app.delete(
    "/api/booking-calendars/:id",
    ...withOrg,
    requirePermission("meetings.view", "manage_contacts.edit"),
    async (req: Request, res: Response) => {
      try {
        const organizationId = req.context!.organizationId;
        const ok = await deleteBookingCalendar(String(req.params.id || ""), organizationId);
        if (!ok) return res.status(404).json({ message: "Calendar not found" });
        res.json({ ok: true });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Failed to delete calendar";
        console.error("[booking-calendars delete]", e);
        res.status(400).json({ message });
      }
    },
  );
}
