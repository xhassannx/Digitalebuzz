import { and, eq, ne, sql, desc, inArray, lte, asc } from "drizzle-orm";
import { db } from "../../db";
import { isMongoEnabled } from "../../db/mongo";
import { DripCampaignModel } from "../models";
import {
  dripCampaigns,
  dripCampaignEnrollments,
  dripCampaignLogs,
  managedContacts,
  type DripCampaign,
  type DripCampaignEnrollment,
} from "@shared/schema";
import type { CreateDripCampaignInput } from "@shared/drip-campaigns";
import { campaignHasEntryTrigger } from "@shared/drip-campaigns";
import { computeStepExecuteAt, normalizeTimeHm } from "./schedule";

function normalizeDripCampaignDoc(d: any): DripCampaign {
  if (!d) return d;
  return { ...d, id: d.id || d._id } as any;
}

export async function listDripCampaigns(organizationId: string): Promise<
  Array<
    DripCampaign & {
      activeContacts: number;
      totalEnrolled: number;
    }
  >
> {
  if (isMongoEnabled()) {
    const docs = await DripCampaignModel.find({ organizationId })
      .sort({ updatedAt: -1 })
      .lean();
    return docs.map((d: any) => ({
      ...normalizeDripCampaignDoc(d),
      activeContacts: 0,
      totalEnrolled: 0,
    }));
  }

  const rows = await db
    .select()
    .from(dripCampaigns)
    .where(eq(dripCampaigns.organizationId, organizationId))
    .orderBy(desc(dripCampaigns.updatedAt));

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const counts = await db
    .select({
      campaignId: dripCampaignEnrollments.campaignId,
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${dripCampaignEnrollments.status} = 'running')::int`,
    })
    .from(dripCampaignEnrollments)
    .where(inArray(dripCampaignEnrollments.campaignId, ids))
    .groupBy(dripCampaignEnrollments.campaignId);

  const byId = new Map(counts.map((c) => [c.campaignId, c]));
  return rows.map((r) => ({
    ...r,
    activeContacts: byId.get(r.id)?.active ?? 0,
    totalEnrolled: byId.get(r.id)?.total ?? 0,
  }));
}

export async function getDripCampaign(
  id: string,
  organizationId: string,
): Promise<DripCampaign | undefined> {
  if (isMongoEnabled()) {
    const doc = await DripCampaignModel.findOne({
      $or: [{ _id: id }, { id }],
      organizationId,
    }).lean();
    return doc ? normalizeDripCampaignDoc(doc) : undefined;
  }
  const [row] = await db
    .select()
    .from(dripCampaigns)
    .where(and(eq(dripCampaigns.id, id), eq(dripCampaigns.organizationId, organizationId)))
    .limit(1);
  return row;
}

export async function createDripCampaign(
  userId: string,
  organizationId: string,
  input: CreateDripCampaignInput,
): Promise<DripCampaign> {
  const steps = input.steps.map((s, i) => ({
    ...s,
    id: s.id || crypto.randomUUID(),
    waitValue: s.waitUnit === "immediately" ? 0 : s.waitValue,
  }));
  const triggerConfig = {
    ...(input.triggerConfig || {}),
    sendIntervalMinutes:
      input.sendIntervalMinutes ?? input.triggerConfig?.sendIntervalMinutes ?? 2,
  };

  if (isMongoEnabled()) {
    const created = await DripCampaignModel.create({
      userId,
      organizationId,
      sessionId: input.sessionId || null,
      name: input.name,
      goal: input.goal,
      entryTrigger: input.entryTrigger,
      triggerConfig,
      steps,
      timezone: input.timezone,
      startTime: normalizeTimeHm(input.startTime),
      endTime: normalizeTimeHm(input.endTime),
      workingDays: input.workingDays,
      duplicateStrategy: input.duplicateStrategy,
      humanizerDelayMinutes: input.humanizerDelayMinutes,
      stopOnReply: input.stopOnReply,
      status: input.status,
      updatedAt: new Date(),
    });
    const doc = created.toObject();
    return normalizeDripCampaignDoc(doc);
  }

  const [row] = await db
    .insert(dripCampaigns)
    .values({
      userId,
      organizationId,
      sessionId: input.sessionId || null,
      name: input.name,
      goal: input.goal,
      entryTrigger: input.entryTrigger,
      triggerConfig,
      steps,
      timezone: input.timezone,
      startTime: normalizeTimeHm(input.startTime),
      endTime: normalizeTimeHm(input.endTime),
      workingDays: input.workingDays,
      duplicateStrategy: input.duplicateStrategy,
      humanizerDelayMinutes: input.humanizerDelayMinutes,
      stopOnReply: input.stopOnReply,
      status: input.status,
      updatedAt: new Date(),
    })
    .returning();
  return row;
}

export async function updateDripCampaign(
  id: string,
  organizationId: string,
  input: Partial<CreateDripCampaignInput>,
): Promise<DripCampaign | undefined> {
  const existing = await getDripCampaign(id, organizationId);
  if (!existing) return undefined;

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name != null) patch.name = input.name;
  if (input.goal != null) patch.goal = input.goal;
  if (input.entryTrigger != null) patch.entryTrigger = input.entryTrigger;
  if (input.triggerConfig != null || input.sendIntervalMinutes != null) {
    patch.triggerConfig = {
      ...(existing.triggerConfig || {}),
      ...(input.triggerConfig || {}),
      ...(input.sendIntervalMinutes != null
        ? { sendIntervalMinutes: input.sendIntervalMinutes }
        : {}),
    };
  }
  if (input.sessionId !== undefined) patch.sessionId = input.sessionId;
  if (input.steps != null) {
    patch.steps = input.steps.map((s) => ({
      ...s,
      id: s.id || crypto.randomUUID(),
      waitValue: s.waitUnit === "immediately" ? 0 : s.waitValue,
    }));
  }
  if (input.timezone != null) patch.timezone = input.timezone;
  if (input.startTime != null) patch.startTime = normalizeTimeHm(input.startTime);
  if (input.endTime != null) patch.endTime = normalizeTimeHm(input.endTime);
  if (input.workingDays != null) patch.workingDays = input.workingDays;
  if (input.duplicateStrategy != null) patch.duplicateStrategy = input.duplicateStrategy;
  if (input.humanizerDelayMinutes != null) patch.humanizerDelayMinutes = input.humanizerDelayMinutes;
  if (input.stopOnReply != null) patch.stopOnReply = input.stopOnReply;
  if (input.status != null) patch.status = input.status;

  if (isMongoEnabled()) {
    const updated = await DripCampaignModel.findOneAndUpdate(
      { $or: [{ _id: id }, { id }], organizationId },
      { $set: patch },
      { new: true }
    ).lean();
    return updated ? normalizeDripCampaignDoc(updated) : undefined;
  }

  const [row] = await db
    .update(dripCampaigns)
    .set(patch)
    .where(and(eq(dripCampaigns.id, id), eq(dripCampaigns.organizationId, organizationId)))
    .returning();
  return row;
}

export async function deleteDripCampaign(id: string, organizationId: string): Promise<boolean> {
  if (isMongoEnabled()) {
    const res = await DripCampaignModel.findOneAndDelete({
      $or: [{ _id: id }, { id }],
      organizationId,
    });
    return !!res;
  }
  const result = await db
    .delete(dripCampaigns)
    .where(and(eq(dripCampaigns.id, id), eq(dripCampaigns.organizationId, organizationId)))
    .returning();
  return result.length > 0;
}

export async function findEnrollment(
  campaignId: string,
  contactId: string,
): Promise<DripCampaignEnrollment | undefined> {
  const [row] = await db
    .select()
    .from(dripCampaignEnrollments)
    .where(
      and(
        eq(dripCampaignEnrollments.campaignId, campaignId),
        eq(dripCampaignEnrollments.contactId, contactId),
      ),
    )
    .limit(1);
  return row;
}

export async function createEnrollment(opts: {
  campaign: DripCampaign;
  contactId: string;
}): Promise<DripCampaignEnrollment> {
  const first = opts.campaign.steps?.[0];
  const nextExecuteAt = first
    ? computeStepExecuteAt(new Date(), first, {
        timezone: opts.campaign.timezone || "Asia/Kolkata",
        startTime: normalizeTimeHm(opts.campaign.startTime),
        endTime: normalizeTimeHm(opts.campaign.endTime),
        workingDays: opts.campaign.workingDays || [],
        humanizerDelayMinutes: opts.campaign.humanizerDelayMinutes,
      })
    : new Date();

  const [row] = await db
    .insert(dripCampaignEnrollments)
    .values({
      campaignId: opts.campaign.id,
      organizationId: opts.campaign.organizationId,
      contactId: opts.contactId,
      status: "running",
      currentStepIndex: 0,
      nextExecuteAt,
      updatedAt: new Date(),
    })
    .returning();
  return row;
}

export async function restartEnrollment(
  enrollment: DripCampaignEnrollment,
  campaign: DripCampaign,
): Promise<DripCampaignEnrollment> {
  const first = campaign.steps?.[0];
  const nextExecuteAt = first
    ? computeStepExecuteAt(new Date(), first, {
        timezone: campaign.timezone || "Asia/Kolkata",
        startTime: normalizeTimeHm(campaign.startTime),
        endTime: normalizeTimeHm(campaign.endTime),
        workingDays: campaign.workingDays || [],
        humanizerDelayMinutes: campaign.humanizerDelayMinutes,
      })
    : new Date();

  const [row] = await db
    .update(dripCampaignEnrollments)
    .set({
      status: "running",
      currentStepIndex: 0,
      nextExecuteAt,
      completedAt: null,
      stoppedReason: null,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(dripCampaignEnrollments.id, enrollment.id))
    .returning();
  return row;
}

export async function claimDueEnrollments(limit = 40): Promise<DripCampaignEnrollment[]> {
  if (isMongoEnabled()) {
    return [];
  }
  const now = new Date();
  const due = await db
    .select()
    .from(dripCampaignEnrollments)
    .where(
      and(
        eq(dripCampaignEnrollments.status, "running"),
        lte(dripCampaignEnrollments.nextExecuteAt, now),
      ),
    )
    .orderBy(asc(dripCampaignEnrollments.nextExecuteAt))
    .limit(limit);

  // Soft claim: push nextExecuteAt slightly ahead so concurrent workers skip
  const claimed: DripCampaignEnrollment[] = [];
  for (const row of due) {
    const claimUntil = new Date(now.getTime() + 60_000);
    const [updated] = await db
      .update(dripCampaignEnrollments)
      .set({ nextExecuteAt: claimUntil, updatedAt: new Date() })
      .where(
        and(
          eq(dripCampaignEnrollments.id, row.id),
          eq(dripCampaignEnrollments.status, "running"),
          lte(dripCampaignEnrollments.nextExecuteAt, now),
        ),
      )
      .returning();
    if (updated) claimed.push(updated);
  }
  return claimed;
}

export async function updateEnrollment(
  id: string,
  patch: Partial<DripCampaignEnrollment>,
): Promise<void> {
  await db
    .update(dripCampaignEnrollments)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(dripCampaignEnrollments.id, id));
}

export async function addDripLog(opts: {
  campaignId: string;
  enrollmentId: string;
  contactId?: string | null;
  stepIndex: number;
  actionType: string;
  status: "success" | "failed" | "skipped";
  message?: string;
}): Promise<void> {
  await db.insert(dripCampaignLogs).values({
    campaignId: opts.campaignId,
    enrollmentId: opts.enrollmentId,
    contactId: opts.contactId || null,
    stepIndex: opts.stepIndex,
    actionType: opts.actionType,
    status: opts.status,
    message: opts.message || null,
  });
}

/** Last successful WhatsApp send for a campaign (for inter-contact spacing). */
export async function getLastSuccessfulWhatsAppSendAt(
  campaignId: string,
  excludeEnrollmentId?: string | null,
): Promise<Date | null> {
  const conditions = [
    eq(dripCampaignLogs.campaignId, campaignId),
    eq(dripCampaignLogs.actionType, "send_whatsapp"),
    eq(dripCampaignLogs.status, "success"),
  ];
  if (excludeEnrollmentId) {
    conditions.push(ne(dripCampaignLogs.enrollmentId, excludeEnrollmentId));
  }
  const [row] = await db
    .select({ createdAt: dripCampaignLogs.createdAt })
    .from(dripCampaignLogs)
    .where(and(...conditions))
    .orderBy(desc(dripCampaignLogs.createdAt))
    .limit(1);
  return row?.createdAt || null;
}

export async function listActiveCampaignsByTrigger(
  organizationId: string,
  entryTrigger: string,
): Promise<DripCampaign[]> {
  const rows = await db
    .select()
    .from(dripCampaigns)
    .where(
      and(
        eq(dripCampaigns.organizationId, organizationId),
        eq(dripCampaigns.status, "active"),
      ),
    );

  // Match primary entryTrigger column OR multi-select list in triggerConfig.entryTriggers
  return rows.filter((c) => campaignHasEntryTrigger(c, entryTrigger));
}

export async function stopRunningEnrollmentsOnReply(opts: {
  organizationId: string;
  contactId: string;
}): Promise<number> {
  const running = await db
    .select({
      enrollment: dripCampaignEnrollments,
      stopOnReply: dripCampaigns.stopOnReply,
    })
    .from(dripCampaignEnrollments)
    .innerJoin(dripCampaigns, eq(dripCampaigns.id, dripCampaignEnrollments.campaignId))
    .where(
      and(
        eq(dripCampaignEnrollments.organizationId, opts.organizationId),
        eq(dripCampaignEnrollments.contactId, opts.contactId),
        eq(dripCampaignEnrollments.status, "running"),
        eq(dripCampaigns.stopOnReply, true),
      ),
    );

  for (const row of running) {
    await updateEnrollment(row.enrollment.id, {
      status: "stopped",
      completedAt: new Date(),
      stoppedReason: "Customer replied (stop on reply)",
      nextExecuteAt: null,
    });
    await addDripLog({
      campaignId: row.enrollment.campaignId,
      enrollmentId: row.enrollment.id,
      contactId: opts.contactId,
      stepIndex: row.enrollment.currentStepIndex,
      actionType: "stop_on_reply",
      status: "success",
      message: "Enrollment stopped because customer replied",
    });
  }
  return running.length;
}

export async function getContactForOrg(
  contactId: string,
  organizationId: string,
): Promise<typeof managedContacts.$inferSelect | undefined> {
  const [row] = await db
    .select()
    .from(managedContacts)
    .where(
      and(eq(managedContacts.id, contactId), eq(managedContacts.organizationId, organizationId)),
    )
    .limit(1);
  return row;
}

export async function findContactByPhone(
  organizationId: string,
  phone: string,
): Promise<typeof managedContacts.$inferSelect | undefined> {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 8) return undefined;
  const rows = await db
    .select()
    .from(managedContacts)
    .where(eq(managedContacts.organizationId, organizationId));
  return rows.find((c) => {
    const p = String(c.phoneNumber || "").replace(/\D/g, "");
    return p === digits || p.endsWith(digits) || digits.endsWith(p);
  });
}
