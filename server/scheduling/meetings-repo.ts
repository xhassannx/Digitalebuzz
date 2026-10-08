import { and, asc, eq, gte, lte, sql, ne } from "drizzle-orm";
import { db } from "../../db";
import { isMongoEnabled } from "../../db/mongo";
import { ScheduledMeetingModel } from "../models";
import {
  scheduledMeetings,
  type InsertScheduledMeeting,
  type ScheduledMeeting,
} from "@shared/schema";

function normalizeMeetingDoc(d: any): ScheduledMeeting {
  if (!d) return d;
  const id = d.id || d._id;
  const startAt = d.startAt || d.startTime;
  const endAt = d.endAt || d.endTime;
  const bookingCalendarId = d.bookingCalendarId || d.calendarId;
  const meetLink = d.meetLink || d.meetingUrl;
  return {
    ...d,
    id,
    startAt,
    endAt,
    bookingCalendarId,
    meetLink,
  } as any;
}

export async function createScheduledMeeting(
  data: InsertScheduledMeeting,
): Promise<ScheduledMeeting> {
  if (isMongoEnabled()) {
    const mongoData: any = {
      ...data,
      calendarId: data.bookingCalendarId,
      startTime: data.startAt,
      endTime: data.endAt,
    };
    const created = await ScheduledMeetingModel.create(mongoData);
    const doc = created.toObject();
    return normalizeMeetingDoc({ ...doc, id: doc._id });
  }
  const [row] = await db.insert(scheduledMeetings).values(data).returning();
  return row;
}

export async function getScheduledMeeting(
  id: string,
  organizationId: string,
): Promise<ScheduledMeeting | undefined> {
  if (isMongoEnabled()) {
    const doc = await ScheduledMeetingModel.findOne({
      $or: [{ _id: id }, { id }],
      organizationId,
    }).lean();
    return doc ? normalizeMeetingDoc({ ...doc, id: doc._id }) : undefined;
  }
  const [row] = await db
    .select()
    .from(scheduledMeetings)
    .where(and(eq(scheduledMeetings.id, id), eq(scheduledMeetings.organizationId, organizationId)))
    .limit(1);
  return row;
}

export async function updateScheduledMeeting(
  id: string,
  organizationId: string,
  data: Partial<
    Pick<
      ScheduledMeeting,
      "startAt" | "endAt" | "durationMinutes" | "status" | "meetLink" | "externalEventId" | "title"
    >
  >,
): Promise<ScheduledMeeting | undefined> {
  if (isMongoEnabled()) {
    const patch: any = { ...data };
    if (data.startAt) patch.startTime = data.startAt;
    if (data.endAt) patch.endTime = data.endAt;
    if (data.meetLink) patch.meetingUrl = data.meetLink;
    const updated = await ScheduledMeetingModel.findOneAndUpdate(
      { $or: [{ _id: id }, { id }], organizationId },
      { $set: patch },
      { new: true }
    ).lean();
    return updated ? normalizeMeetingDoc({ ...updated, id: updated._id }) : undefined;
  }
  const [row] = await db
    .update(scheduledMeetings)
    .set(data)
    .where(and(eq(scheduledMeetings.id, id), eq(scheduledMeetings.organizationId, organizationId)))
    .returning();
  return row;
}

export async function listScheduledMeetings(params: {
  organizationId: string;
  from?: Date;
  to?: Date;
  bookingCalendarId?: string;
}): Promise<ScheduledMeeting[]> {
  if (isMongoEnabled()) {
    const query: any = {
      organizationId: params.organizationId,
      status: { $ne: "cancelled" },
    };
    if (params.from || params.to) {
      query.startAt = {};
      if (params.from) query.startAt.$gte = params.from;
      if (params.to) query.startAt.$lte = params.to;
    }
    if (params.bookingCalendarId) {
      query.$or = [
        { bookingCalendarId: params.bookingCalendarId },
        { calendarId: params.bookingCalendarId },
      ];
    }
    const docs = await ScheduledMeetingModel.find(query).sort({ startAt: 1 }).lean();
    return docs.map((d: any) => normalizeMeetingDoc({ ...d, id: d._id }));
  }
  const conditions = [
    eq(scheduledMeetings.organizationId, params.organizationId),
    ne(scheduledMeetings.status, "cancelled"),
  ];
  if (params.from) conditions.push(gte(scheduledMeetings.startAt, params.from));
  if (params.to) conditions.push(lte(scheduledMeetings.startAt, params.to));
  if (params.bookingCalendarId) {
    conditions.push(eq(scheduledMeetings.bookingCalendarId, params.bookingCalendarId));
  }

  return db
    .select()
    .from(scheduledMeetings)
    .where(and(...conditions))
    .orderBy(asc(scheduledMeetings.startAt));
}

export type MeetingStats = {
  total: number;
  googleMeet: number;
  calendly: number;
  upcoming: number;
  today: number;
  completed: number;
  thisMonth: number;
  cancelled: number;
};

export async function getMeetingStats(
  organizationId: string,
  opts?: { bookingCalendarId?: string },
): Promise<MeetingStats> {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  if (isMongoEnabled()) {
    const baseQuery: any = { organizationId };
    if (opts?.bookingCalendarId) {
      baseQuery.$or = [
        { bookingCalendarId: opts.bookingCalendarId },
        { calendarId: opts.bookingCalendarId },
      ];
    }

    const [
      total,
      googleMeet,
      calendly,
      upcoming,
      today,
      completed,
      thisMonth,
      cancelled,
    ] = await Promise.all([
      ScheduledMeetingModel.countDocuments({ ...baseQuery, status: { $ne: "cancelled" } }),
      ScheduledMeetingModel.countDocuments({ ...baseQuery, provider: "google_meet", status: { $ne: "cancelled" } }),
      ScheduledMeetingModel.countDocuments({ ...baseQuery, provider: "calendly", status: { $ne: "cancelled" } }),
      ScheduledMeetingModel.countDocuments({ ...baseQuery, status: "scheduled", startAt: { $gte: now } }),
      ScheduledMeetingModel.countDocuments({ ...baseQuery, status: { $ne: "cancelled" }, startAt: { $gte: startOfToday, $lte: endOfToday } }),
      ScheduledMeetingModel.countDocuments({
        ...baseQuery,
        $or: [
          { status: "completed" },
          { status: "scheduled", endAt: { $lt: now } },
        ],
      }),
      ScheduledMeetingModel.countDocuments({ ...baseQuery, status: { $ne: "cancelled" }, startAt: { $gte: startOfMonth, $lte: endOfMonth } }),
      ScheduledMeetingModel.countDocuments({ ...baseQuery, status: "cancelled" }),
    ]);

    return {
      total,
      googleMeet,
      calendly,
      upcoming,
      today,
      completed,
      thisMonth,
      cancelled,
    };
  }

  const whereConditions = [eq(scheduledMeetings.organizationId, organizationId)];
  if (opts?.bookingCalendarId) {
    whereConditions.push(eq(scheduledMeetings.bookingCalendarId, opts.bookingCalendarId));
  }

  const [row] = await db
    .select({
      total: sql<number>`count(*) filter (where ${scheduledMeetings.status} <> 'cancelled')::int`,
      googleMeet: sql<number>`count(*) filter (where ${scheduledMeetings.provider} = 'google_meet' and ${scheduledMeetings.status} <> 'cancelled')::int`,
      calendly: sql<number>`count(*) filter (where ${scheduledMeetings.provider} = 'calendly' and ${scheduledMeetings.status} <> 'cancelled')::int`,
      upcoming: sql<number>`count(*) filter (where ${scheduledMeetings.status} = 'scheduled' and ${scheduledMeetings.startAt} >= ${now})::int`,
      today: sql<number>`count(*) filter (where ${scheduledMeetings.status} <> 'cancelled' and ${scheduledMeetings.startAt} >= ${startOfToday} and ${scheduledMeetings.startAt} <= ${endOfToday})::int`,
      completed: sql<number>`count(*) filter (where ${scheduledMeetings.status} = 'completed' or (${scheduledMeetings.status} = 'scheduled' and ${scheduledMeetings.endAt} < ${now}))::int`,
      thisMonth: sql<number>`count(*) filter (where ${scheduledMeetings.status} <> 'cancelled' and ${scheduledMeetings.startAt} >= ${startOfMonth} and ${scheduledMeetings.startAt} <= ${endOfMonth})::int`,
      cancelled: sql<number>`count(*) filter (where ${scheduledMeetings.status} = 'cancelled')::int`,
    })
    .from(scheduledMeetings)
    .where(and(...whereConditions));

  return {
    total: row?.total ?? 0,
    googleMeet: row?.googleMeet ?? 0,
    calendly: row?.calendly ?? 0,
    upcoming: row?.upcoming ?? 0,
    today: row?.today ?? 0,
    completed: row?.completed ?? 0,
    thisMonth: row?.thisMonth ?? 0,
    cancelled: row?.cancelled ?? 0,
  };
}
