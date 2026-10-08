import type { DripCampaign, ManagedContact } from "@shared/schema";
import {
  isLeadStatusTrigger,
  leadStatusTriggerValue,
  parseLeadStatusSlug,
  campaignHasEntryTrigger,
  campaignAllowsSession,
  getCampaignLeadStatusTriggerSlugs,
  normalizeLeadStatusSlug,
  type DripEntryTrigger,
} from "@shared/drip-campaigns";
import {
  createEnrollment,
  findEnrollment,
  listActiveCampaignsByTrigger,
  restartEnrollment,
  stopRunningEnrollmentsOnReply,
  findContactByPhone,
} from "./repo";

function triggerMatches(
  campaign: DripCampaign,
  ctx: {
    trigger: DripEntryTrigger;
    labelId?: string | null;
    groupId?: string | null;
    pipelineStatus?: string | null;
    source?: string | null;
    sessionId?: string | null;
  },
): boolean {
  if (!campaignHasEntryTrigger(campaign, ctx.trigger)) return false;
  if (!campaignAllowsSession(campaign, ctx.sessionId)) return false;
  const cfg = campaign.triggerConfig || {};

  // Lead-status triggers encode the status in the trigger value itself
  if (isLeadStatusTrigger(ctx.trigger)) {
    const slug = parseLeadStatusSlug(ctx.trigger);
    const leadSlug = normalizeLeadStatusSlug(ctx.pipelineStatus);
    if (leadSlug && slug && leadSlug !== slug) return false;
    return true;
  }

  if (ctx.trigger === "label_added" && cfg.labelId) {
    return cfg.labelId === ctx.labelId;
  }
  if (ctx.trigger === "group_added" && cfg.groupId) {
    return cfg.groupId === ctx.groupId;
  }
  if (ctx.trigger === "pipeline_stage_changed" && cfg.pipelineStatus) {
    return (
      normalizeLeadStatusSlug(cfg.pipelineStatus) ===
      normalizeLeadStatusSlug(ctx.pipelineStatus)
    );
  }
  if (
    (ctx.trigger === "facebook_instagram_lead" ||
      ctx.trigger === "indiamart_lead" ||
      ctx.trigger === "justdial_lead" ||
      ctx.trigger === "website_form" ||
      ctx.trigger === "google_form") &&
    cfg.sourceMatch &&
    ctx.source
  ) {
    return String(ctx.source).toLowerCase().includes(String(cfg.sourceMatch).toLowerCase());
  }
  return true;
}

/**
 * Attempt to enroll a contact into all matching active drip campaigns.
 * Safe to call fire-and-forget — never throws to callers.
 *
 * `forceReentry`: for lead-status changes / backfill — restart completed/stopped
 * enrollments even when duplicateStrategy is "ignore" (still skips currently running
 * unless forceReentry is set with restart intent for running — we skip running on backfill).
 */
export async function tryEnrollContactForDripTrigger(opts: {
  organizationId: string;
  contactId: string;
  trigger: DripEntryTrigger;
  labelId?: string | null;
  groupId?: string | null;
  pipelineStatus?: string | null;
  source?: string | null;
  sessionId?: string | null;
  /** Restart completed/stopped when lead re-enters a status trigger. */
  forceReentry?: boolean;
}): Promise<{ enrolled: number }> {
  try {
    if (!opts.organizationId || !opts.contactId) return { enrolled: 0 };
    const campaigns = await listActiveCampaignsByTrigger(opts.organizationId, opts.trigger);
    if (campaigns.length === 0) {
      console.log("[Drip] No active campaigns for trigger", {
        organizationId: opts.organizationId,
        trigger: opts.trigger,
        contactId: opts.contactId,
      });
    }
    let enrolled = 0;
    for (const campaign of campaigns) {
      if (!triggerMatches(campaign, opts)) continue;
      if (!campaign.steps?.length) {
        console.warn("[Drip] Skipping campaign with no steps", { campaignId: campaign.id });
        continue;
      }

      const existing = await findEnrollment(campaign.id, opts.contactId);
      if (existing) {
        // Already mid-sequence — do not double-run on re-entry
        if (existing.status === "running") {
          if (campaign.duplicateStrategy === "restart") {
            await restartEnrollment(existing, campaign);
            enrolled += 1;
            console.log("[Drip] Restarted running enrollment (restart strategy)", {
              campaignId: campaign.id,
              contactId: opts.contactId,
            });
          } else {
            console.log("[Drip] Already running — skip", {
              campaignId: campaign.id,
              contactId: opts.contactId,
            });
          }
          continue;
        }

        // Status re-entry / backfill: re-enroll even if strategy is ignore
        if (opts.forceReentry) {
          await restartEnrollment(existing, campaign);
          enrolled += 1;
          console.log("[Drip] Re-enrolled on status re-entry", {
            campaignId: campaign.id,
            contactId: opts.contactId,
            previousStatus: existing.status,
          });
          continue;
        }

        // "ignore" = do not re-enroll successful runs.
        // Always allow retry after failed/stopped so a bad attempt doesn't permanently block.
        if (campaign.duplicateStrategy === "ignore") {
          if (existing.status === "completed") {
            console.log("[Drip] Duplicate ignore — already enrolled", {
              campaignId: campaign.id,
              contactId: opts.contactId,
              enrollmentStatus: existing.status,
            });
            continue;
          }
          await restartEnrollment(existing, campaign);
          enrolled += 1;
          console.log("[Drip] Re-enrolled after failed/stopped (ignore strategy)", {
            campaignId: campaign.id,
            contactId: opts.contactId,
            previousStatus: existing.status,
          });
          continue;
        }
        // continue / restart strategies for non-running enrollments
        await restartEnrollment(existing, campaign);
        enrolled += 1;
        continue;
      }

      await createEnrollment({ campaign, contactId: opts.contactId });
      enrolled += 1;
      console.log("[Drip] Enrolled contact", {
        campaignId: campaign.id,
        contactId: opts.contactId,
        trigger: opts.trigger,
      });
    }
    return { enrolled };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Drip] Enrollment error:", msg);
    return { enrolled: 0 };
  }
}

/** Enroll when a lead moves to a pipeline/lead status. */
export async function enrollOnLeadStatusChange(opts: {
  organizationId: string;
  contactId: string;
  statusSlug: string;
  sessionId?: string | null;
}): Promise<void> {
  const slug = normalizeLeadStatusSlug(opts.statusSlug);
  if (!slug || !opts.contactId) return;

  await tryEnrollContactForDripTrigger({
    organizationId: opts.organizationId,
    contactId: opts.contactId,
    trigger: leadStatusTriggerValue(slug),
    pipelineStatus: slug,
    sessionId: opts.sessionId,
    // Entering a status board should start/restart the sequence
    forceReentry: true,
  });

  // Backward compatibility for campaigns saved with pipeline_stage_changed + triggerConfig
  await tryEnrollContactForDripTrigger({
    organizationId: opts.organizationId,
    contactId: opts.contactId,
    trigger: "pipeline_stage_changed",
    pipelineStatus: slug,
    sessionId: opts.sessionId,
    forceReentry: true,
  });
}

/**
 * Resolve/create a managed contact for a lead (no enrollment).
 */
export async function resolveContactIdForLead(opts: {
  organizationId: string;
  userId?: string | null;
  lead: {
    id?: string;
    contactId?: string | null;
    phoneNumber?: string | null;
    name?: string | null;
    email?: string | null;
    source?: string | null;
  };
}): Promise<string | null> {
  let contactId = opts.lead.contactId?.trim() || null;
  const phone = String(opts.lead.phoneNumber || "").replace(/\D/g, "");
  let userId = opts.userId?.trim() || null;

  if (!contactId && phone) {
    try {
      const { storage } = await import("../storage");
      const existing = await storage.findManagedContactByOrganizationAndPhoneDigits(
        opts.organizationId,
        phone,
      );
      contactId = existing?.id || null;
      if (!userId && existing?.userId) userId = existing.userId;
    } catch {
      contactId = null;
    }
  }

  if (!userId) {
    try {
      const { storage } = await import("../storage");
      const org = await storage.getOrganization(opts.organizationId);
      if (org?.ownerId) {
        userId = org.ownerId;
      } else {
        const members = await storage.getOrganizationMembers(opts.organizationId);
        userId = members[0]?.userId || null;
      }
    } catch {
      // ignore
    }
  }

  if (!contactId && phone && userId) {
    try {
      const { ensureContactForLead } = await import("../leads/ensure-contact-for-lead");
      const created = await ensureContactForLead({
        userId,
        organizationId: opts.organizationId,
        phoneDigits: phone,
        name: opts.lead.name,
        email: opts.lead.email,
        source: opts.lead.source || "whatsapp",
      });
      contactId = created?.id || null;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Drip] Failed to create contact for lead enrollment:", msg);
    }
  }

  if (contactId && opts.lead.id && contactId !== opts.lead.contactId) {
    try {
      const { db } = await import("../../db");
      const { organizationLeads } = await import("@shared/schema");
      const { and, eq } = await import("drizzle-orm");
      await db
        .update(organizationLeads)
        .set({ contactId, updatedAt: new Date() })
        .where(
          and(
            eq(organizationLeads.id, opts.lead.id),
            eq(organizationLeads.organizationId, opts.organizationId),
          ),
        );
    } catch {
      // non-fatal
    }
  }

  return contactId;
}

/**
 * Resolve/create a managed contact for a lead, then enroll into drip campaigns
 * matching the new pipeline status. Safe to fire-and-forget.
 */
export async function enrollLeadOnStatusChange(opts: {
  organizationId: string;
  userId?: string | null;
  statusSlug: string;
  lead: {
    id?: string;
    contactId?: string | null;
    phoneNumber?: string | null;
    name?: string | null;
    email?: string | null;
    source?: string | null;
    sessionId?: string | null;
  };
}): Promise<{ enrolled: boolean; contactId: string | null }> {
  const slug = normalizeLeadStatusSlug(opts.statusSlug);
  if (!slug || !opts.organizationId) return { enrolled: false, contactId: null };

  const contactId = await resolveContactIdForLead({
    organizationId: opts.organizationId,
    userId: opts.userId,
    lead: opts.lead,
  });

  if (!contactId) {
    const phone = String(opts.lead.phoneNumber || "").replace(/\D/g, "");
    console.warn(
      `[Drip] Skipping lead-status enrollment: no contact for lead phone=${phone || "?"} status=${slug}`,
    );
    return { enrolled: false, contactId: null };
  }

  await enrollOnLeadStatusChange({
    organizationId: opts.organizationId,
    contactId,
    statusSlug: slug,
    // Do not filter enrollment by the lead's inbound WhatsApp session — campaigns
    // send from their own configured number(s). Passing the lead session caused
    // intermittent skips when it didn't match the campaign's allowed sessions.
    sessionId: null,
  });
  return { enrolled: true, contactId };
}

/**
 * When a campaign becomes active, enroll all leads already sitting in matching
 * lead-status columns (e.g. everyone currently in "No Response").
 * Only enrolls into this campaign.
 */
export async function backfillCampaignLeadStatusEnrollments(
  campaign: DripCampaign,
): Promise<{ enrolled: number; scanned: number }> {
  if (campaign.status !== "active") return { enrolled: 0, scanned: 0 };
  if (!campaign.steps?.length) return { enrolled: 0, scanned: 0 };
  const slugs = getCampaignLeadStatusTriggerSlugs(campaign);
  if (slugs.length === 0) return { enrolled: 0, scanned: 0 };

  const { storage } = await import("../storage");
  let enrolled = 0;
  let scanned = 0;
  const pageSize = 100;

  for (const slug of slugs) {
    let offset = 0;
    for (;;) {
      const { items, total } = await storage.listOrganizationLeads(campaign.organizationId, {
        status: slug,
        limit: pageSize,
        offset,
      });
      if (items.length === 0) break;
      for (const lead of items) {
        scanned += 1;
        try {
          const contactId = await resolveContactIdForLead({
            organizationId: campaign.organizationId,
            userId: campaign.userId || lead.userId || null,
            lead: {
              id: lead.id,
              contactId: lead.contactId,
              phoneNumber: lead.phoneNumber,
              name: lead.name,
              email: lead.email,
              source: lead.source,
            },
          });
          if (!contactId) {
            console.warn("[Drip] Backfill skip — no contact", { leadId: lead.id, slug });
            continue;
          }

          const existing = await findEnrollment(campaign.id, contactId);
          if (existing?.status === "running") continue;

          if (existing) {
            await restartEnrollment(existing, campaign);
          } else {
            await createEnrollment({ campaign, contactId });
          }
          enrolled += 1;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[Drip] Backfill enroll failed:", msg, { leadId: lead.id, slug });
        }
      }
      offset += items.length;
      if (offset >= total || items.length < pageSize) break;
    }
  }

  console.log("[Drip] Lead-status backfill complete", {
    campaignId: campaign.id,
    slugs,
    scanned,
    enrolled,
  });
  return { enrolled, scanned };
}

export async function enrollContactManually(opts: {
  campaign: DripCampaign;
  contactId: string;
}): Promise<{ ok: boolean; message: string }> {
  if (opts.campaign.status !== "active" && opts.campaign.status !== "draft") {
    return { ok: false, message: "Campaign must be draft or active to enroll contacts" };
  }
  if (!opts.campaign.steps?.length) {
    return { ok: false, message: "Campaign has no steps" };
  }
  const existing = await findEnrollment(opts.campaign.id, opts.contactId);
  if (existing) {
    if (opts.campaign.duplicateStrategy === "ignore") {
      return { ok: false, message: "Contact already enrolled (duplicate protection: ignore)" };
    }
    if (opts.campaign.duplicateStrategy === "continue" && existing.status === "running") {
      return { ok: true, message: "Contact already running" };
    }
    await restartEnrollment(existing, opts.campaign);
    return { ok: true, message: "Enrollment restarted" };
  }
  await createEnrollment({ campaign: opts.campaign, contactId: opts.contactId });
  return { ok: true, message: "Enrolled" };
}

export async function handleDripInboundReply(opts: {
  organizationId: string | null | undefined;
  phone: string;
  contactId?: string | null;
}): Promise<void> {
  try {
    if (!opts.organizationId) return;
    let contactId = opts.contactId || null;
    if (!contactId) {
      const contact = await findContactByPhone(opts.organizationId, opts.phone);
      contactId = contact?.id || null;
    }
    if (!contactId) return;
    await stopRunningEnrollmentsOnReply({
      organizationId: opts.organizationId,
      contactId,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Drip] Stop-on-reply error:", msg);
  }
}

export function mapLeadSourceToDripTrigger(source: string | null | undefined): DripEntryTrigger | null {
  const s = String(source || "").toLowerCase();
  if (!s) return null;
  if (s.includes("facebook") || s.includes("instagram") || s.includes("meta")) {
    return "facebook_instagram_lead";
  }
  if (s.includes("indiamart")) return "indiamart_lead";
  if (s.includes("justdial")) return "justdial_lead";
  if (s.includes("google")) return "google_form";
  if (s.includes("website") || s.includes("webform") || s.includes("contactform")) {
    return "website_form";
  }
  return null;
}

export async function maybeEnrollNewContact(contact: ManagedContact): Promise<void> {
  if (!contact.organizationId) return;
  await tryEnrollContactForDripTrigger({
    organizationId: contact.organizationId,
    contactId: contact.id,
    trigger: "new_contact",
    source: contact.source,
  });
  const sourceTrigger = mapLeadSourceToDripTrigger(contact.source);
  if (sourceTrigger) {
    await tryEnrollContactForDripTrigger({
      organizationId: contact.organizationId,
      contactId: contact.id,
      trigger: sourceTrigger,
      source: contact.source,
    });
  }
}
