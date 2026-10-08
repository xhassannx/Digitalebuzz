import { z } from "zod";

/** Campaign goals shown in Create Drip Campaign. */
export const DRIP_CAMPAIGN_GOALS = [
  "Lead Nurturing",
  "Sales",
  "Reminder",
  "Follow-up",
  "Recovery",
  "Customer Retention",
] as const;

export type DripCampaignGoal = (typeof DRIP_CAMPAIGN_GOALS)[number];

/** Built-in entry triggers shown in Create Drip Campaign (lead statuses are loaded dynamically). */
export const DRIP_ENTRY_TRIGGERS = [
  { value: "manual", label: "Manual Enrollment Only" },
  { value: "new_contact", label: "New Contact Created" },
  { value: "birthday", label: "Birthday (Anniversary)" },
] as const;

export type DripBuiltinEntryTrigger = (typeof DRIP_ENTRY_TRIGGERS)[number]["value"];

/** @deprecated Prefer string entry triggers — lead statuses use `lead_status:<slug>`. */
export type DripEntryTrigger = string;

export const LEAD_STATUS_TRIGGER_PREFIX = "lead_status:";

/** Normalize a lead-status slug (handles "No Response" → "no_response"). */
export function normalizeLeadStatusSlug(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function leadStatusTriggerValue(slug: string): string {
  return `${LEAD_STATUS_TRIGGER_PREFIX}${normalizeLeadStatusSlug(slug)}`;
}

export function isLeadStatusTrigger(value: string | null | undefined): boolean {
  return String(value || "").startsWith(LEAD_STATUS_TRIGGER_PREFIX);
}

export function parseLeadStatusSlug(value: string | null | undefined): string | null {
  if (!isLeadStatusTrigger(value)) return null;
  const raw = String(value).slice(LEAD_STATUS_TRIGGER_PREFIX.length);
  return normalizeLeadStatusSlug(raw) || null;
}

export function formatLeadStatusTriggerLabel(slug: string, name?: string | null): string {
  if (name?.trim()) return name.trim();
  return String(slug || "")
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export const DRIP_WAIT_UNITS = [
  { value: "immediately", label: "Immediately" },
  { value: "minutes", label: "Minutes" },
  { value: "hours", label: "Hours" },
  { value: "days", label: "Days" },
  { value: "weeks", label: "Weeks" },
  { value: "months", label: "Months" },
  { value: "specific_datetime", label: "Specific Date & Time" },
] as const;

export type DripWaitUnit = (typeof DRIP_WAIT_UNITS)[number]["value"];

export const DRIP_STEP_ACTIONS = [
  { value: "send_whatsapp", label: "Send WhatsApp Message" },
  { value: "apply_label", label: "Apply Label" },
  { value: "remove_label", label: "Remove Label" },
  { value: "move_pipeline_stage", label: "Move Pipeline Stage" },
  { value: "assign_lead", label: "Assign Lead to User" },
  { value: "webhook", label: "Execute Custom Webhook" },
] as const;

export type DripStepAction = (typeof DRIP_STEP_ACTIONS)[number]["value"];

export const DRIP_MESSAGE_FORMATS = ["custom", "meta_template"] as const;
export type DripMessageFormat = (typeof DRIP_MESSAGE_FORMATS)[number];

export const DRIP_DUPLICATE_STRATEGIES = [
  { value: "ignore", label: "Ignore (Do not re-enroll contact)" },
  { value: "restart", label: "Restart (Move contact back to step 1)" },
  { value: "continue", label: "Continue Existing (Allow running uninterrupted)" },
] as const;

export type DripDuplicateStrategy = (typeof DRIP_DUPLICATE_STRATEGIES)[number]["value"];

export const DRIP_WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type DripWeekday = (typeof DRIP_WEEKDAYS)[number];

export const DRIP_CAMPAIGN_STATUSES = ["draft", "active", "paused", "archived"] as const;
export type DripCampaignStatus = (typeof DRIP_CAMPAIGN_STATUSES)[number];

export const DRIP_ENROLLMENT_STATUSES = [
  "running",
  "completed",
  "stopped",
  "failed",
  "paused",
] as const;
export type DripEnrollmentStatus = (typeof DRIP_ENROLLMENT_STATUSES)[number];

export const DRIP_MESSAGE_VARIABLES = [
  "{{customer_name}}",
  "{{phone}}",
  "{{city}}",
  "{{source}}",
] as const;

export const dripTriggerConfigSchema = z.object({
  /** Selected entry triggers (multi-select). When set, enrollment matches any of these. */
  entryTriggers: z.array(z.string()).optional(),
  /** WhatsApp session IDs this campaign may send from (multi-select). Empty = any number. */
  sessionIds: z.array(z.string()).optional(),
  /** Min minutes between WhatsApp sends to different contacts (default 2). */
  sendIntervalMinutes: z.number().int().min(0).max(60).optional(),
  labelId: z.string().optional(),
  groupId: z.string().optional(),
  pipelineStatus: z.string().optional(),
  sourceMatch: z.string().optional(),
}).passthrough();

export type DripTriggerConfig = z.infer<typeof dripTriggerConfigSchema>;

/** Resolve the full list of entry triggers for a campaign (supports multi-select). */
export function getCampaignEntryTriggers(campaign: {
  entryTrigger?: string | null;
  triggerConfig?: DripTriggerConfig | null;
}): string[] {
  const extras = campaign.triggerConfig?.entryTriggers;
  const fromConfig = Array.isArray(extras)
    ? extras.map(String).map((s) => s.trim()).filter(Boolean)
    : [];
  const primary = String(campaign.entryTrigger || "").trim();
  // Always include primary column — older saves sometimes left entryTriggers stale/out of sync.
  const merged = primary ? [primary, ...fromConfig.filter((t) => t !== primary)] : fromConfig;
  return [...new Set(merged)];
}

export function campaignHasEntryTrigger(
  campaign: { entryTrigger?: string | null; triggerConfig?: DripTriggerConfig | null },
  trigger: string,
): boolean {
  const wanted = String(trigger || "").trim();
  if (!wanted) return false;
  const triggers = getCampaignEntryTriggers(campaign);
  if (triggers.includes(wanted)) return true;

  // Lead-status triggers: match slug with/without prefix; tolerate "No Response" vs no_response
  const wantedSlug = parseLeadStatusSlug(wanted);
  if (wantedSlug) {
    return triggers.some((t) => {
      const tSlug = parseLeadStatusSlug(t);
      if (tSlug && tSlug === wantedSlug) return true;
      // Legacy bare slug on campaign
      if (!String(t).includes(":") && normalizeLeadStatusSlug(t) === wantedSlug) return true;
      // Legacy display name accidentally stored as trigger
      if (normalizeLeadStatusSlug(t) === wantedSlug) return true;
      return false;
    });
  }

  // Caller passed bare slug (e.g. "no_response") — match lead_status:no_response on campaign
  if (!wanted.includes(":")) {
    const knownBuiltins = new Set<string>([
      ...DRIP_ENTRY_TRIGGERS.map((x) => x.value),
      "group_added",
      "facebook_instagram_lead",
      "indiamart_lead",
      "justdial_lead",
      "website_form",
      "google_form",
      "label_added",
      "pipeline_stage_changed",
    ]);
    if (!knownBuiltins.has(wanted)) {
      const bare = normalizeLeadStatusSlug(wanted);
      if (bare) {
        return triggers.some(
          (t) => parseLeadStatusSlug(t) === bare || normalizeLeadStatusSlug(t) === bare,
        );
      }
    }
  }
  return false;
}

/** Lead-status slugs this campaign should enroll for (from entry triggers). */
export function getCampaignLeadStatusTriggerSlugs(campaign: {
  entryTrigger?: string | null;
  triggerConfig?: DripTriggerConfig | null;
}): string[] {
  const knownBuiltins = new Set<string>([
    ...DRIP_ENTRY_TRIGGERS.map((x) => x.value),
    "group_added",
    "facebook_instagram_lead",
    "indiamart_lead",
    "justdial_lead",
    "website_form",
    "google_form",
    "label_added",
    "pipeline_stage_changed",
  ]);
  const slugs: string[] = [];
  for (const t of getCampaignEntryTriggers(campaign)) {
    const prefixed = parseLeadStatusSlug(t);
    if (prefixed) {
      slugs.push(prefixed);
      continue;
    }
    if (t === "pipeline_stage_changed") {
      const fromCfg = normalizeLeadStatusSlug(campaign.triggerConfig?.pipelineStatus);
      if (fromCfg) slugs.push(fromCfg);
      continue;
    }
    // Legacy bare slug saved without lead_status: prefix (e.g. "no_response")
    if (!knownBuiltins.has(t)) {
      const bare = normalizeLeadStatusSlug(t);
      if (bare) slugs.push(bare);
    }
  }
  return [...new Set(slugs)];
}

/** Session IDs allowed for this campaign (multi-number select). */
export function getCampaignSessionIds(campaign: {
  sessionId?: string | null;
  triggerConfig?: DripTriggerConfig | null;
}): string[] {
  const fromConfig = campaign.triggerConfig?.sessionIds;
  if (Array.isArray(fromConfig) && fromConfig.length > 0) {
    return [...new Set(fromConfig.map(String).filter(Boolean))];
  }
  const primary = String(campaign.sessionId || "").trim();
  return primary ? [primary] : [];
}

/**
 * Whether a trigger/send session is allowed.
 * If the campaign has no session restriction, all sessions are allowed.
 * If a sessionId is not provided by the caller, allow enrollment (send will use a selected number).
 */
export function campaignAllowsSession(
  campaign: { sessionId?: string | null; triggerConfig?: DripTriggerConfig | null },
  sessionId?: string | null,
): boolean {
  const allowed = getCampaignSessionIds(campaign);
  if (allowed.length === 0) return true;
  if (!sessionId) return true;
  return allowed.includes(String(sessionId));
}

/**
 * Minimum gap (minutes) between WhatsApp sends to different contacts in the same campaign.
 * Default 2. Set 0 to disable spacing.
 */
export function getCampaignSendIntervalMinutes(campaign: {
  triggerConfig?: DripTriggerConfig | null;
  sendIntervalMinutes?: number | null;
}): number {
  const fromTop = campaign.sendIntervalMinutes;
  if (typeof fromTop === "number" && Number.isFinite(fromTop)) {
    return Math.max(0, Math.min(60, Math.floor(fromTop)));
  }
  const fromCfg = campaign.triggerConfig?.sendIntervalMinutes;
  if (typeof fromCfg === "number" && Number.isFinite(fromCfg)) {
    return Math.max(0, Math.min(60, Math.floor(fromCfg)));
  }
  return 2;
}

export const dripStepActionConfigSchema = z.object({
  messageFormat: z.enum(DRIP_MESSAGE_FORMATS).optional(),
  messageText: z.string().optional(),
  templateName: z.string().optional(),
  templateLanguage: z.string().optional(),
  templateId: z.string().optional(),
  phoneNumberId: z.string().optional(),
  templateParameters: z
    .array(
      z.object({
        column: z.string().optional(),
        fallback: z.string().optional(),
      }),
    )
    .optional(),
  headerFormat: z.enum(["TEXT", "IMAGE", "VIDEO", "DOCUMENT"]).optional(),
  headerImageId: z.string().optional(),
  headerImageUrl: z.string().optional(),
  headerVideoId: z.string().optional(),
  headerVideoUrl: z.string().optional(),
  headerDocumentId: z.string().optional(),
  headerDocumentUrl: z.string().optional(),
  labelId: z.string().optional(),
  pipelineStatus: z.string().optional(),
  assignToUserId: z.string().optional(),
  webhookUrl: z.string().optional(),
  webhookMethod: z.enum(["POST", "GET", "PUT"]).optional(),
  webhookHeaders: z.record(z.string()).optional(),
  webhookBody: z.string().optional(),
}).passthrough();

export type DripStepActionConfig = z.infer<typeof dripStepActionConfigSchema>;

export const dripCampaignStepSchema = z.object({
  id: z.string().optional(),
  waitValue: z.number().int().min(0).default(1),
  waitUnit: z.enum([
    "immediately",
    "minutes",
    "hours",
    "days",
    "weeks",
    "months",
    "specific_datetime",
  ]),
  waitSpecificAt: z.string().nullable().optional(),
  actionType: z.enum([
    "send_whatsapp",
    "apply_label",
    "remove_label",
    "move_pipeline_stage",
    "assign_lead",
    "webhook",
  ]),
  actionConfig: dripStepActionConfigSchema.default({}),
});

export type DripCampaignStep = z.infer<typeof dripCampaignStepSchema>;

export const createDripCampaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required").max(200),
  goal: z.enum(DRIP_CAMPAIGN_GOALS).default("Lead Nurturing"),
  entryTrigger: z.string().min(1, "Entry trigger is required"),
  triggerConfig: dripTriggerConfigSchema.optional().default({}),
  sessionId: z.string().nullable().optional(),
  steps: z.array(dripCampaignStepSchema).min(1, "Add at least one automation step"),
  timezone: z.string().default("Asia/Kolkata"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).default("09:00"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).default("18:00"),
  workingDays: z.array(z.enum(DRIP_WEEKDAYS)).default([
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
  ]),
  duplicateStrategy: z.enum(["ignore", "restart", "continue"]).default("ignore"),
  humanizerDelayMinutes: z.number().int().min(0).max(120).default(0),
  /** Gap between messages to different contacts in this campaign (minutes). */
  sendIntervalMinutes: z.number().int().min(0).max(60).default(2),
  stopOnReply: z.boolean().default(true),
  status: z.enum(DRIP_CAMPAIGN_STATUSES).default("draft"),
});

export type CreateDripCampaignInput = z.infer<typeof createDripCampaignSchema>;

export const updateDripCampaignSchema = createDripCampaignSchema.partial();

export function dripTriggerLabel(
  value: string,
  opts?: { leadStatusNames?: Record<string, string> },
): string {
  const builtin = DRIP_ENTRY_TRIGGERS.find((t) => t.value === value);
  if (builtin) return builtin.label;

  const slug = parseLeadStatusSlug(value);
  if (slug) {
    return formatLeadStatusTriggerLabel(slug, opts?.leadStatusNames?.[slug]);
  }

  // Legacy trigger values (kept for older campaigns)
  const legacy: Record<string, string> = {
    group_added: "Contact Added to Group",
    facebook_instagram_lead: "Facebook / Instagram Lead",
    indiamart_lead: "IndiaMart Lead",
    justdial_lead: "JustDial Lead",
    website_form: "Website Contact Form",
    google_form: "Google Form Submission",
    label_added: "Contact Label Added",
    pipeline_stage_changed: "Pipeline Stage Changed",
  };
  return legacy[value] || value;
}

export function dripActionLabel(value: string): string {
  return DRIP_STEP_ACTIONS.find((a) => a.value === value)?.label ?? value;
}
