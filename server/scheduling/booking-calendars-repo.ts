import { and, asc, desc, eq, gte, lte, ne, sql } from "drizzle-orm";
import { db } from "../../db";
import { isMongoEnabled } from "../../db/mongo";
import { BookingCalendarModel, ScheduledMeetingModel } from "../models";
import {
  bookingCalendars,
  scheduledMeetings,
  type BookingCalendar,
  type BookingCalendarAvailability,
  type InsertBookingCalendar,
} from "@shared/schema";

export async function createBookingCalendar(data: InsertBookingCalendar): Promise<BookingCalendar> {
  if (isMongoEnabled()) {
    const created = await BookingCalendarModel.create(data);
    const doc = created.toObject();
    return { ...doc, id: doc._id } as any;
  }
  const [row] = await db.insert(bookingCalendars).values(data).returning();
  return row;
}

export async function listBookingCalendars(organizationId: string): Promise<BookingCalendar[]> {
  if (isMongoEnabled()) {
    const docs = await BookingCalendarModel.find({ organizationId })
      .sort({ updatedAt: -1 })
      .lean();
    return docs.map((d: any) => ({ ...d, id: d._id })) as any;
  }
  return db
    .select()
    .from(bookingCalendars)
    .where(eq(bookingCalendars.organizationId, organizationId))
    .orderBy(desc(bookingCalendars.updatedAt));
}

export async function getBookingCalendarById(
  id: string,
  organizationId: string,
): Promise<BookingCalendar | undefined> {
  if (isMongoEnabled()) {
    const doc = await BookingCalendarModel.findOne({
      $or: [{ _id: id }, { id }],
      organizationId,
    }).lean();
    return doc ? ({ ...doc, id: doc._id } as any) : undefined;
  }
  const [row] = await db
    .select()
    .from(bookingCalendars)
    .where(and(eq(bookingCalendars.id, id), eq(bookingCalendars.organizationId, organizationId)))
    .limit(1);
  return row;
}

export async function getBookingCalendarBySlug(slug: string): Promise<BookingCalendar | undefined> {
  if (isMongoEnabled()) {
    const doc = await BookingCalendarModel.findOne({ slug, isActive: true }).lean();
    return doc ? ({ ...doc, id: doc._id } as any) : undefined;
  }
  const [row] = await db
    .select()
    .from(bookingCalendars)
    .where(and(eq(bookingCalendars.slug, slug), eq(bookingCalendars.isActive, true)))
    .limit(1);
  return row;
}

export async function isSlugTaken(slug: string, excludeId?: string): Promise<boolean> {
  if (isMongoEnabled()) {
    const query: any = { slug };
    if (excludeId) query._id = { $ne: excludeId };
    const count = await BookingCalendarModel.countDocuments(query);
    return count > 0;
  }
  const rows = await db.select({ id: bookingCalendars.id }).from(bookingCalendars).where(eq(bookingCalendars.slug, slug)).limit(1);
  if (!rows[0]) return false;
  if (excludeId && rows[0].id === excludeId) return false;
  return true;
}

export async function updateBookingCalendar(
  id: string,
  organizationId: string,
  data: Partial<
    Pick<
      BookingCalendar,
      | "name"
      | "description"
      | "logoUrl"
      | "slug"
      | "durationMinutes"
      | "hostUserId"
      | "provider"
      | "integrationId"
      | "whatsappSessionId"
      | "availability"
      | "theme"
      | "maxBookingsPerSlot"
      | "isActive"
      | "isPublicDemo"
    >
  >,
): Promise<BookingCalendar | undefined> {
  if (isMongoEnabled()) {
    const updated = await BookingCalendarModel.findOneAndUpdate(
      { $or: [{ _id: id }, { id }], organizationId },
      { $set: { ...data, updatedAt: new Date() } },
      { new: true }
    ).lean();
    return updated ? ({ ...updated, id: updated._id } as any) : undefined;
  }
  const [row] = await db
    .update(bookingCalendars)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(bookingCalendars.id, id), eq(bookingCalendars.organizationId, organizationId)))
    .returning();
  return row;
}

/** Mark one calendar as the public landing "Book a Demo" target (or clear when calendarId is null). */
export async function setPublicDemoCalendar(
  organizationId: string,
  calendarId: string | null,
): Promise<BookingCalendar | null> {
  if (isMongoEnabled()) {
    await BookingCalendarModel.updateMany(
      { organizationId, isPublicDemo: true },
      { $set: { isPublicDemo: false, updatedAt: new Date() } }
    );
    if (!calendarId) return null;
    const existing = await getBookingCalendarById(calendarId, organizationId);
    if (!existing) throw new Error("Calendar not found");
    const updated = await BookingCalendarModel.findOneAndUpdate(
      { $or: [{ _id: calendarId }, { id: calendarId }], organizationId },
      { $set: { isPublicDemo: true, updatedAt: new Date() } },
      { new: true }
    ).lean();
    return updated ? ({ ...updated, id: updated._id } as any) : null;
  }
  await db
    .update(bookingCalendars)
    .set({ isPublicDemo: false, updatedAt: new Date() })
    .where(and(eq(bookingCalendars.organizationId, organizationId), eq(bookingCalendars.isPublicDemo, true)));

  if (!calendarId) return null;

  const existing = await getBookingCalendarById(calendarId, organizationId);
  if (!existing) {
    throw new Error("Calendar not found");
  }

  const [row] = await db
    .update(bookingCalendars)
    .set({ isPublicDemo: true, updatedAt: new Date() })
    .where(and(eq(bookingCalendars.id, calendarId), eq(bookingCalendars.organizationId, organizationId)))
    .returning();
  return row ?? null;
}

/** Active calendar flagged for the public Book a Demo CTA (any org — platform landing). */
export async function getPublicDemoCalendar(): Promise<BookingCalendar | undefined> {
  if (isMongoEnabled()) {
    const doc = await BookingCalendarModel.findOne({
      isPublicDemo: true,
      isActive: true,
    })
      .sort({ updatedAt: -1 })
      .lean();
    return doc ? ({ ...doc, id: doc._id } as any) : undefined;
  }
  const [row] = await db
    .select()
    .from(bookingCalendars)
    .where(and(eq(bookingCalendars.isPublicDemo, true), eq(bookingCalendars.isActive, true)))
    .orderBy(desc(bookingCalendars.updatedAt))
    .limit(1);
  return row;
}

export async function getPublicDemoCalendarForOrg(
  organizationId: string,
): Promise<BookingCalendar | undefined> {
  if (isMongoEnabled()) {
    const doc = await BookingCalendarModel.findOne({
      organizationId,
      isPublicDemo: true,
      isActive: true,
    }).lean();
    return doc ? ({ ...doc, id: doc._id } as any) : undefined;
  }
  const [row] = await db
    .select()
    .from(bookingCalendars)
    .where(
      and(
        eq(bookingCalendars.organizationId, organizationId),
        eq(bookingCalendars.isPublicDemo, true),
        eq(bookingCalendars.isActive, true),
      ),
    )
    .limit(1);
  return row;
}

export async function deleteBookingCalendar(id: string, organizationId: string): Promise<boolean> {
  if (isMongoEnabled()) {
    const res = await BookingCalendarModel.findOneAndDelete({
      $or: [{ _id: id }, { id }],
      organizationId,
    });
    return !!res;
  }
  const rows = await db
    .delete(bookingCalendars)
    .where(and(eq(bookingCalendars.id, id), eq(bookingCalendars.organizationId, organizationId)))
    .returning({ id: bookingCalendars.id });
  return rows.length > 0;
}

export async function listLocalBusyMeetings(
  organizationId: string,
  from: Date,
  to: Date,
  opts?: { bookingCalendarId?: string },
): Promise<Array<{ startAt: Date; endAt: Date }>> {
  if (isMongoEnabled()) {
    const query: any = {
      organizationId,
      status: { $ne: "cancelled" },
      startAt: { $gte: from, $lte: to },
    };
    if (opts?.bookingCalendarId) {
      query.$or = [
        { bookingCalendarId: opts.bookingCalendarId },
        { calendarId: opts.bookingCalendarId },
      ];
    }
    const docs = await ScheduledMeetingModel.find(query).sort({ startAt: 1 }).lean();
    return docs.map((d: any) => ({
      startAt: d.startAt || d.startTime,
      endAt: d.endAt || d.endTime,
    }));
  }
  const conditions = [
    eq(scheduledMeetings.organizationId, organizationId),
    ne(scheduledMeetings.status, "cancelled"),
    gte(scheduledMeetings.startAt, from),
    lte(scheduledMeetings.startAt, to),
  ];
  if (opts?.bookingCalendarId) {
    conditions.push(eq(scheduledMeetings.bookingCalendarId, opts.bookingCalendarId));
  }
  return db
    .select({
      startAt: scheduledMeetings.startAt,
      endAt: scheduledMeetings.endAt,
    })
    .from(scheduledMeetings)
    .where(and(...conditions))
    .orderBy(asc(scheduledMeetings.startAt));
}

export function defaultAvailability(): BookingCalendarAvailability {
  return {
    timezone: "Asia/Kolkata",
    startTime: "09:00",
    endTime: "18:00",
    weekdays: [1, 2, 3, 4, 5],
  };
}

export function slugifyName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "calendar";
}

export async function uniqueSlug(base: string): Promise<string> {
  let candidate = base;
  let n = 0;
  while (await isSlugTaken(candidate)) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  return candidate;
}

export async function countOverlappingMeetings(
  organizationId: string,
  start: Date,
  end: Date,
  opts?: { bookingCalendarId?: string },
): Promise<number> {
  if (isMongoEnabled()) {
    const query: any = {
      organizationId,
      status: { $ne: "cancelled" },
      startAt: { $lt: end },
      endAt: { $gt: start },
    };
    if (opts?.bookingCalendarId) {
      query.$or = [
        { bookingCalendarId: opts.bookingCalendarId },
        { calendarId: opts.bookingCalendarId },
      ];
    }
    return await ScheduledMeetingModel.countDocuments(query);
  }
  const conditions = [
    eq(scheduledMeetings.organizationId, organizationId),
    ne(scheduledMeetings.status, "cancelled"),
    sql`${scheduledMeetings.startAt} < ${end}`,
    sql`${scheduledMeetings.endAt} > ${start}`,
  ];
  if (opts?.bookingCalendarId) {
    conditions.push(eq(scheduledMeetings.bookingCalendarId, opts.bookingCalendarId));
  }
  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(scheduledMeetings)
    .where(and(...conditions));
  return row?.count ?? 0;
}

/** How many busy intervals overlap a slot (for capacity filtering without N+1 queries). */
export function countOverlapsInBusyList(
  slot: { start: Date; end: Date },
  busy: Array<{ startAt: Date; endAt: Date }>,
): number {
  const s = slot.start.getTime();
  const e = slot.end.getTime();
  let n = 0;
  for (const b of busy) {
    const bs = new Date(b.startAt).getTime();
    const be = new Date(b.endAt).getTime();
    if (s < be && e > bs) n += 1;
  }
  return n;
}
