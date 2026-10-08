// @ts-nocheck
import { storage } from "../storage";
import { businessAPIManager } from "../whatsapp/business-api-client";
import { whatsappManager as unofficialWhatsappManager } from "../whatsapp/client";
import { db } from "../../db";
import { dripCampaigns, organizationLeads, type DripCampaign, type DripCampaignEnrollment } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import type { DripCampaignStep } from "@shared/drip-campaigns";
import {
  addDripLog,
  claimDueEnrollments,
  getContactForOrg,
  getLastSuccessfulWhatsAppSendAt,
  updateEnrollment,
} from "./repo";
import { computeStepExecuteAt, isWithinScheduleWindow, alignToScheduleWindow, normalizeTimeHm } from "./schedule";
import {
  buildAutomationTemplatePersistMeta,
  persistOutboundWhatsAppMessage,
} from "../panel-outbound-message";
import { getCampaignSessionIds, getCampaignSendIntervalMinutes } from "@shared/drip-campaigns";

function renderMessage(
  template: string,
  contact: {
    name?: string | null;
    phoneNumber?: string | null;
    source?: string | null;
    customFields?: Record<string, string> | null;
  },
): string {
  const city =
    contact.customFields?.city ||
    contact.customFields?.City ||
    contact.customFields?.CITY ||
    "";
  return String(template || "")
    .replace(/\{\{customer_name\}\}/gi, contact.name || "")
    .replace(/\{\{phone\}\}/gi, contact.phoneNumber || "")
    .replace(/\{\{city\}\}/gi, city)
    .replace(/\{\{source\}\}/gi, contact.source || "")
    .replace(/\[\[customer_name\]\]/gi, contact.name || "")
    .replace(/\[\[phone\]\]/gi, contact.phoneNumber || "")
    .replace(/\[\[city\]\]/gi, city)
    .replace(/\[\[source\]\]/gi, contact.source || "");
}

function resolveTemplateParams(
  contact: any,
  paramConfigs: Array<{ column?: string; fallback?: string }> | undefined,
): string[] {
  if (!Array.isArray(paramConfigs) || paramConfigs.length === 0) return [];
  return paramConfigs.map((paramConfig) => {
    let value = paramConfig.fallback || "";
    if (paramConfig.column && contact) {
      if (paramConfig.column === "name") {
        value = contact.name || paramConfig.fallback || "";
      } else if (paramConfig.column === "phoneNumber") {
        value = contact.phoneNumber || paramConfig.fallback || "";
      } else if (paramConfig.column === "email") {
        value = contact.email || paramConfig.fallback || "";
      } else if (paramConfig.column.startsWith("customFields.")) {
        const fieldName = paramConfig.column.replace("customFields.", "");
        value = contact.customFields?.[fieldName] || paramConfig.fallback || "";
      }
    }
    return String(value ?? "");
  });
}

function extractWhatsAppMessageId(sendResult: any): string | null {
  if (!sendResult) return null;
  return (
    sendResult.id ||
    sendResult.messageId ||
    sendResult.messages?.[0]?.id ||
    sendResult.data?.messages?.[0]?.id ||
    null
  );
}

async function resolveSessionId(campaign: DripCampaign): Promise<string | null> {
  const preferred = getCampaignSessionIds(campaign);
  try {
    const sessions = await storage.getSessionsByOrganization(campaign.organizationId);
    const list = Array.isArray(sessions) ? sessions : [];
    if (preferred.length > 0) {
      const matched = preferred
        .map((id) => list.find((s) => s.sessionId === id))
        .filter(Boolean);
      const active =
        matched.find((s) => s.status === "connected" || s.status === "ready") || matched[0];
      if (active?.sessionId) return active.sessionId;
      return preferred[0] || null;
    }
    if (list.length) {
      const active =
        list.find((s) => s.status === "connected" || s.status === "ready") || list[0];
      return active?.sessionId || null;
    }
  } catch (_) {}
  if (campaign.sessionId) return campaign.sessionId;
  try {
    const all = await storage.getSessionsByUser(campaign.userId);
    if (Array.isArray(all) && all.length) return all[0].sessionId || null;
  } catch (_) {}
  return null;
}

async function sendWhatsApp(opts: {
  sessionId: string;
  phone: string;
  step: DripCampaignStep;
  contact: any;
  campaign: DripCampaign;
}): Promise<{ ok: boolean; error?: string }> {
  const cfg = opts.step.actionConfig || {};
  const format = cfg.messageFormat || "custom";
  const to = String(opts.phone || "").replace(/\D/g, "");
  if (!to) return { ok: false, error: "Missing phone number" };

  let connectionType: "official" | "unofficial" = "official";
  let manager: any = businessAPIManager;
  try {
    const session = await storage.getSession(opts.sessionId);
    if (
      session?.connectionType === "unofficial" ||
      session?.provider === "unofficial" ||
      session?.type === "unofficial"
    ) {
      manager = unofficialWhatsappManager;
      connectionType = "unofficial";
    }
  } catch (_) {}

  try {
    if (format === "meta_template" && cfg.templateName) {
      if (typeof manager.sendTemplateMessage !== "function") {
        return { ok: false, error: "Template send not supported for this session" };
      }

      const templateParams = resolveTemplateParams(opts.contact, cfg.templateParameters);
      let templateBodyText: string | undefined;
      try {
        const list = await storage.getMessageTemplatesByUser(
          opts.campaign.userId,
          opts.campaign.organizationId,
          cfg.phoneNumberId,
        );
        const tpl = list.find(
          (t: any) =>
            t.name === cfg.templateName ||
            t.id === cfg.templateId ||
            t.templateId === cfg.templateId,
        );
        const bodyComp = tpl?.components?.find((c: any) => c.type === "BODY");
        templateBodyText = bodyComp?.text;
      } catch (_) {}

      const sendResult = await manager.sendTemplateMessage(
        opts.sessionId,
        to,
        cfg.templateName,
        cfg.templateLanguage || "en",
        templateParams.length > 0 ? templateParams : undefined,
        cfg.headerImageId || undefined,
        cfg.headerVideoId || undefined,
        cfg.headerDocumentId || undefined,
        templateBodyText,
        undefined,
        undefined,
        cfg.headerImageUrl || undefined,
        cfg.headerVideoUrl || undefined,
        cfg.headerDocumentUrl || undefined,
      );

      const waId = extractWhatsAppMessageId(sendResult);
      const meta = await buildAutomationTemplatePersistMeta({
        userId: opts.campaign.userId,
        organizationId: opts.campaign.organizationId,
        phoneNumberId: cfg.phoneNumberId,
        templateName: cfg.templateName,
        languageCode: cfg.templateLanguage || "en",
        templateParams,
        headerImageUrl: cfg.headerImageUrl,
        headerVideoUrl: cfg.headerVideoUrl,
      });

      await persistOutboundWhatsAppMessage({
        sessionId: opts.sessionId,
        to,
        userId: opts.campaign.userId,
        organizationId: opts.campaign.organizationId,
        connectionType,
        whatsappMessageId: waId,
        type: "template",
        body: meta.body,
        mediaUrl: meta.mediaUrl || cfg.headerDocumentUrl || null,
        templateName: cfg.templateName,
        templateLanguage: cfg.templateLanguage || "en",
        templateParams: templateParams.length ? templateParams : null,
        templateType: meta.templateType,
        headerText: meta.headerText,
        footer: meta.footer,
      });

      return { ok: true };
    }

    const text = renderMessage(cfg.messageText || "", opts.contact);
    if (!text.trim()) return { ok: false, error: "Empty message text" };
    const sendResult = await manager.sendTextMessage(opts.sessionId, to, text);
    const waId = extractWhatsAppMessageId(sendResult);

    await persistOutboundWhatsAppMessage({
      sessionId: opts.sessionId,
      to,
      userId: opts.campaign.userId,
      organizationId: opts.campaign.organizationId,
      connectionType,
      whatsappMessageId: waId,
      type: "text",
      body: text,
    });

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

async function executeStepAction(opts: {
  campaign: DripCampaign;
  enrollment: DripCampaignEnrollment;
  step: DripCampaignStep;
  contact: any;
}): Promise<{ ok: boolean; error?: string }> {
  const { step, contact, campaign } = opts;
  const cfg = step.actionConfig || {};

  switch (step.actionType) {
    case "send_whatsapp": {
      const sessionId = await resolveSessionId(campaign);
      if (!sessionId) return { ok: false, error: "No WhatsApp session configured" };
      return sendWhatsApp({
        sessionId,
        phone: contact.phoneNumber,
        step,
        contact,
        campaign,
      });
    }
    case "apply_label": {
      if (!cfg.labelId) return { ok: false, error: "Label not configured" };
      await storage.assignTagToContact(
        contact.id,
        cfg.labelId,
        campaign.userId,
        campaign.organizationId,
      );
      return { ok: true };
    }
    case "remove_label": {
      if (!cfg.labelId) return { ok: false, error: "Label not configured" };
      await storage.removeTagFromContact(
        contact.id,
        cfg.labelId,
        campaign.userId,
        campaign.organizationId,
      );
      return { ok: true };
    }
    case "assign_lead": {
      const userId = cfg.assignToUserId;
      if (!userId) return { ok: false, error: "Assign user not configured" };
      const fields = { ...(contact.customFields || {}), assignedTo: userId };
      await storage.updateManagedContact(contact.id, contact.userId, campaign.organizationId, {
        customFields: fields,
      });
      try {
        await db
          .update(organizationLeads)
          .set({ assignedToUserId: userId, updatedAt: new Date() })
          .where(
            and(
              eq(organizationLeads.organizationId, campaign.organizationId),
              eq(organizationLeads.contactId, contact.id),
            ),
          );
      } catch (_) {}
      return { ok: true };
    }
    case "move_pipeline_stage": {
      if (!cfg.pipelineStatus) return { ok: false, error: "Pipeline status not configured" };
      try {
        const leads = await db
          .select()
          .from(organizationLeads)
          .where(
            and(
              eq(organizationLeads.organizationId, campaign.organizationId),
              eq(organizationLeads.contactId, contact.id),
            ),
          );
        for (const lead of leads) {
          // Use storage update so lead-status drip campaigns enroll on stage moves
          await storage.updateOrganizationLead(lead.id, campaign.organizationId, {
            status: cfg.pipelineStatus,
          });
        }
      } catch (err: any) {
        return { ok: false, error: err?.message || String(err) };
      }
      return { ok: true };
    }
    case "webhook": {
      const url = cfg.webhookUrl;
      if (!url) return { ok: false, error: "Webhook URL not configured" };
      const method = cfg.webhookMethod || "POST";
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(cfg.webhookHeaders || {}),
      };
      const body =
        cfg.webhookBody ||
        JSON.stringify({
          campaignId: campaign.id,
          campaignName: campaign.name,
          contact: {
            id: contact.id,
            name: contact.name,
            phone: contact.phoneNumber,
            source: contact.source,
          },
          stepIndex: opts.enrollment.currentStepIndex,
        });
      const res = await fetch(url, {
        method,
        headers,
        body: method === "GET" ? undefined : body,
      });
      if (!res.ok) return { ok: false, error: `Webhook HTTP ${res.status}` };
      return { ok: true };
    }
    default:
      return { ok: false, error: `Unknown action: ${step.actionType}` };
  }
}

export async function processDripEnrollment(
  enrollment: DripCampaignEnrollment,
  sendSlots?: Map<string, number>,
): Promise<void> {
  const [campaign] = await db
    .select()
    .from(dripCampaigns)
    .where(eq(dripCampaigns.id, enrollment.campaignId))
    .limit(1);

  if (!campaign || campaign.status !== "active") {
    await updateEnrollment(enrollment.id, {
      nextExecuteAt: campaign?.status === "paused" ? new Date(Date.now() + 5 * 60_000) : null,
      status: campaign?.status === "paused" ? "paused" : enrollment.status,
      lastError: campaign ? `Campaign is ${campaign.status}` : "Campaign missing",
    });
    return;
  }

  const contact = await getContactForOrg(enrollment.contactId, enrollment.organizationId);
  if (!contact) {
    await updateEnrollment(enrollment.id, {
      status: "failed",
      completedAt: new Date(),
      lastError: "Contact not found",
      nextExecuteAt: null,
    });
    return;
  }

  const steps = campaign.steps || [];
  const idx = enrollment.currentStepIndex || 0;
  const step = steps[idx];
  if (!step) {
    await updateEnrollment(enrollment.id, {
      status: "completed",
      completedAt: new Date(),
      nextExecuteAt: null,
    });
    return;
  }

  const schedule = {
    timezone: campaign.timezone || "Asia/Kolkata",
    startTime: normalizeTimeHm(campaign.startTime),
    endTime: normalizeTimeHm(campaign.endTime),
    workingDays: campaign.workingDays || [],
  };

  const now = new Date();
  if (
    !isWithinScheduleWindow({
      when: now,
      timezone: schedule.timezone,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      workingDays: schedule.workingDays,
    })
  ) {
    const aligned = alignToScheduleWindow({
      when: now,
      ...schedule,
      humanizerDelayMinutes: 0,
    });
    console.log("[Drip] Outside schedule window — deferring send", {
      enrollmentId: enrollment.id,
      campaignId: campaign.id,
      timezone: schedule.timezone,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      now: now.toISOString(),
      nextExecuteAt: aligned.toISOString(),
    });
    await updateEnrollment(enrollment.id, { nextExecuteAt: aligned });
    return;
  }

  // Space WhatsApp sends across different contacts (first message only).
  // Do NOT apply this to later steps for the same contact — that would override
  // the step wait (e.g. "5 minutes") when the campaign is busy.
  const isFirstWhatsAppStep =
    step.actionType === "send_whatsapp" &&
    !(campaign.steps || [])
      .slice(0, idx)
      .some((s) => s.actionType === "send_whatsapp");

  if (isFirstWhatsAppStep) {
    const intervalMin = getCampaignSendIntervalMinutes(campaign);
    if (intervalMin > 0) {
      const intervalMs = intervalMin * 60_000;
      let lastMs = sendSlots?.get(campaign.id);
      if (lastMs == null) {
        const lastSend = await getLastSuccessfulWhatsAppSendAt(campaign.id, enrollment.id);
        lastMs = lastSend ? lastSend.getTime() : 0;
      }
      const earliest = lastMs > 0 ? lastMs + intervalMs : 0;
      if (earliest > Date.now() + 2_000) {
        const nextAt = new Date(earliest);
        const alignedNext = alignToScheduleWindow({
          when: nextAt,
          ...schedule,
          humanizerDelayMinutes: 0,
        });
        console.log("[Drip] Send-interval spacing — deferring first message", {
          enrollmentId: enrollment.id,
          campaignId: campaign.id,
          intervalMin,
          nextExecuteAt: alignedNext.toISOString(),
        });
        await updateEnrollment(enrollment.id, { nextExecuteAt: alignedNext });
        sendSlots?.set(campaign.id, alignedNext.getTime());
        return;
      }
    }
  }

  const result = await executeStepAction({ campaign, enrollment, step, contact });
  await addDripLog({
    campaignId: campaign.id,
    enrollmentId: enrollment.id,
    contactId: contact.id,
    stepIndex: idx,
    actionType: step.actionType,
    status: result.ok ? "success" : "failed",
    message: result.error,
  });

  if (result.ok && step.actionType === "send_whatsapp") {
    sendSlots?.set(campaign.id, Date.now());
  }

  if (!result.ok) {
    await updateEnrollment(enrollment.id, {
      status: "failed",
      lastError: result.error || "Step failed",
      lastExecutedAt: new Date(),
      nextExecuteAt: null,
      completedAt: new Date(),
    });
    return;
  }

  const nextIdx = idx + 1;
  if (nextIdx >= steps.length) {
    await updateEnrollment(enrollment.id, {
      status: "completed",
      currentStepIndex: nextIdx,
      lastExecutedAt: new Date(),
      completedAt: new Date(),
      nextExecuteAt: null,
      lastError: null,
    });
    return;
  }

  const nextStep = steps[nextIdx];
  // Step waits must be exact — do not add humanizer random delay between steps.
  // Humanizer only applies when first enrolling (see createEnrollment).
  const nextAt = computeStepExecuteAt(new Date(), nextStep, {
    timezone: schedule.timezone,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    workingDays: schedule.workingDays,
    humanizerDelayMinutes: 0,
  });

  await updateEnrollment(enrollment.id, {
    currentStepIndex: nextIdx,
    lastExecutedAt: new Date(),
    nextExecuteAt: nextAt,
    lastError: null,
  });
}

export async function runDripCampaignTick(): Promise<void> {
  try {
    const sendSlots = new Map<string, number>();
    const due = await claimDueEnrollments(40);
    for (const enrollment of due) {
      try {
        await processDripEnrollment(enrollment, sendSlots);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Drip] Failed enrollment ${enrollment.id}:`, msg);
        await updateEnrollment(enrollment.id, {
          lastError: msg,
          nextExecuteAt: new Date(Date.now() + 5 * 60_000),
        }).catch(() => {});
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (String(msg).includes("drip_campaign") && String(msg).includes("does not exist")) {
      console.warn("[Drip Scheduler] Tables missing — run migrations/create_drip_campaigns.sql");
      return;
    }
    console.error("[Drip Scheduler] Error:", msg);
  }
}
