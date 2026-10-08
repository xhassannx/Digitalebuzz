import type { AutomationFlow } from "@shared/schema";
import { storage } from "../storage";
import { runAutomationFlowFromTrigger } from "./executor";
import { contactContextPayload } from "./context-builders";
import { shouldDispatchContactAutomation } from "./contact-automation-guard";
import { isRecipientOptedOut } from "../opt-keyword-service";

async function contactTriggerContext(contact: Record<string, unknown>): Promise<Record<string, unknown>> {
  const contactId = String(contact.id || "");
  const organizationId = String(contact.organizationId || "");
  const userId = String(contact.userId || "");
  if (contactId && organizationId && userId) {
    const tags = await storage.getContactTags(contactId, userId, organizationId);
    return contactContextPayload(contact, tags);
  }
  return contactContextPayload(contact);
}

type FlowNode = {
  id: string;
  type?: string;
  data?: {
    selectedTrigger?: string;
    config?: {
      connectionId?: string;
      phoneNumberId?: string;
      spreadsheetId?: string;
      worksheetId?: string;
    };
  };
};

function triggerNodeMatchesConnection(
  node: FlowNode,
  opts: {
    calendarIntegrationId?: string;
    whatsappSessionId?: string;
    integrationConnectionId?: string;
  }
): boolean {
  const connId = node.data?.config?.connectionId;
  if (opts.calendarIntegrationId) {
    return !connId || connId === opts.calendarIntegrationId;
  }
  if (opts.whatsappSessionId) {
    return !connId || connId === opts.whatsappSessionId;
  }
  if (opts.integrationConnectionId) {
    return !connId || connId === opts.integrationConnectionId;
  }
  return true;
}

/**
 * Loads active flows for an org (or user fallback), finds a matching trigger node, and runs the action chain.
 */
export async function runActiveAutomationsForCanvasTrigger(opts: {
  canvasTriggerId: string;
  organizationId?: string | null;
  ownerUserId: string;
  contextRoot: Record<string, unknown>;
  /** For Google Calendar: only triggers tied to this integration id (or triggers with no connection set). */
  calendarIntegrationId?: string;
  /** For WhatsApp: only triggers tied to this session id (or triggers with no connection set). */
  whatsappSessionId?: string;
  /** For Calendly, Sheets, Shopify integration webhooks, etc. */
  integrationConnectionId?: string;
}): Promise<void> {
  const {
    canvasTriggerId,
    organizationId,
    ownerUserId,
    contextRoot,
    calendarIntegrationId,
    whatsappSessionId,
    integrationConnectionId,
  } = opts;

  if (whatsappSessionId && organizationId) {
    const trigger = contextRoot.trigger as { from?: string } | undefined;
    const contact = contextRoot.contact as { phone?: string; phoneE164?: string } | undefined;
    const phone =
      String(trigger?.from || contact?.phoneE164 || contact?.phone || "").trim();
    if (phone && (await isRecipientOptedOut(organizationId, phone))) {
      console.log(
        `[Automation] Skipping ${canvasTriggerId} — contact opted out (${phone})`
      );
      return;
    }
  }

  // Stop all canvas automations when the org owner's plan period has ended
  const { isOrganizationPlanActive, isUserPlanActive } = await import("../utils/org-subscription-gate");
  const planOk = organizationId
    ? await isOrganizationPlanActive(organizationId)
    : await isUserPlanActive(ownerUserId);
  if (!planOk) {
    console.log(
      `[Automation] Skipping ${canvasTriggerId} — subscription expired (org=${organizationId || "none"} user=${ownerUserId})`
    );
    return;
  }

  const flows = await storage.getActiveFlowsByTrigger(
    canvasTriggerId,
    organizationId ? undefined : ownerUserId,
    organizationId || undefined
  );

  if (flows.length === 0) {
    console.log(
      `[Automation] ${canvasTriggerId} — no active published flows for org=${organizationId || "none"} user=${ownerUserId}`
    );
    return;
  }

  let ran = 0;
  for (const flow of flows) {
    const nodes = (flow.nodes || []) as FlowNode[];
    const matchingTriggers = nodes.filter(
      (n) =>
        n.type === "trigger" &&
        n.data?.selectedTrigger === canvasTriggerId &&
        triggerNodeMatchesConnection(n, {
          calendarIntegrationId,
          whatsappSessionId,
          integrationConnectionId,
        })
    );
    if (matchingTriggers.length === 0) continue;
    const startId = matchingTriggers[0].id;
    await runAutomationFlowFromTrigger({ flow, startTriggerNodeId: startId, contextRoot });
    ran++;
  }
  if (ran === 0) {
    console.log(
      `[Automation] ${canvasTriggerId} — ${flows.length} active flow(s) but none matched trigger connection filter`
    );
  }
}

export async function onManagedContactCreated(contact: Record<string, unknown>): Promise<void> {
  const contactId = String(contact.id || "");
  if (!contactId || !shouldDispatchContactAutomation("new-contact", contactId)) {
    return;
  }
  const orgId = (contact.organizationId as string) || null;
  const userId = String(contact.userId || "");
  const ctx = await contactTriggerContext(contact);
  const c = ctx.contact as { phoneE164?: string; phone?: string } | undefined;
  console.log(`[Automation] new-contact → contact ${contactId} (${c?.phoneE164 || c?.phone || "?"})`);
  await runActiveAutomationsForCanvasTrigger({
    canvasTriggerId: "new-contact",
    organizationId: orgId,
    ownerUserId: userId,
    contextRoot: ctx,
  });
}

export async function onManagedContactUpdated(contact: Record<string, unknown>): Promise<void> {
  const contactId = String(contact.id || "");
  if (!contactId || !shouldDispatchContactAutomation("contact-updated", contactId)) {
    return;
  }
  const orgId = (contact.organizationId as string) || null;
  const userId = String(contact.userId || "");
  const ctx = await contactTriggerContext(contact);
  const c = ctx.contact as { phoneE164?: string; phone?: string } | undefined;
  console.log(`[Automation] contact-updated → contact ${contactId} (${c?.phoneE164 || c?.phone || "?"})`);
  await runActiveAutomationsForCanvasTrigger({
    canvasTriggerId: "contact-updated",
    organizationId: orgId,
    ownerUserId: userId,
    contextRoot: ctx,
  });
}

export async function onGoogleCalendarEventCreated(opts: {
  integrationId: string;
  userId: string;
  organizationId: string | null;
  body: Record<string, unknown>;
}): Promise<void> {
  const { integrationId, userId, organizationId, body } = opts;
  const ctx = {
    trigger: {
      ...body,
      resourceId: body.resourceId,
      resourceState: body.resourceState,
    },
    raw: body,
  };
  await runActiveAutomationsForCanvasTrigger({
    canvasTriggerId: "new-event",
    organizationId,
    ownerUserId: userId,
    contextRoot: ctx,
    calendarIntegrationId: integrationId,
  });
}
