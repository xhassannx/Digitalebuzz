// @ts-nocheck
import { storage } from "../storage";
import { isRecipientOptedOut, resolveOrganizationIdForSessionId, findManagedContactForPhone } from "../opt-keyword-service";
import { contactContextPayload } from "./context-builders";
import { runActiveAutomationsForCanvasTrigger } from "./dispatch-runner";

export type WhatsAppInteractiveHint = {
  type?: string;
  buttonReply?: { title?: string; id?: string };
  listReply?: { title?: string; id?: string };
  isTemplateButton?: boolean;
};

/**
 * Resolve all canvas trigger IDs that match an inbound WhatsApp message.
 * Multiple triggers can fire (e.g. on-first-message + text-message-received).
 */
export function resolveWhatsAppCanvasTriggers(
  message: Record<string, unknown>,
  opts?: { isFirstMessage?: boolean; interactive?: WhatsAppInteractiveHint }
): string[] {
  const triggers: string[] = [];
  const type = String(message.type || "");
  const interactive = opts?.interactive;
  const interactiveType = interactive?.type || "";

  if (type === "button" || interactive?.isTemplateButton) {
    triggers.push("template-message-button-reply");
  }
  if (interactiveType === "list_reply" || message.interactive?.list_reply || message.interactive?.listReply) {
    triggers.push("list-message-reply");
  }
  if (
    interactiveType === "button_reply" &&
    !interactive?.isTemplateButton &&
    type !== "button"
  ) {
    triggers.push("interactive-message-button-reply");
  }
  const nfm =
    type === "interactive" &&
    ((message.interactive as Record<string, unknown>)?.type === "nfm_reply" ||
      (message.interactive as Record<string, unknown>)?.nfm_reply);
  if (nfm) {
    triggers.push("form-message-response");
  }

  if (opts?.isFirstMessage) {
    triggers.push("on-first-message");
  }

  const hasText =
    !!(message.text as { body?: string })?.body ||
    type === "text" ||
    !!interactive?.buttonReply?.title ||
    !!interactive?.listReply?.title;

  if (hasText && type !== "reaction") {
    triggers.push("text-message-received");
  }

  return [...new Set(triggers)];
}

export function buildWhatsAppTriggerContext(opts: {
  message: Record<string, unknown>;
  contactName: string;
  contactNumber: string;
  messageBody: string;
  sessionId: string;
  interactive?: WhatsAppInteractiveHint;
}): Record<string, unknown> {
  const { message, contactName, contactNumber, messageBody, sessionId, interactive } = opts;
  return {
    raw: message,
    trigger: {
      from: message.from || contactNumber,
      body: messageBody,
      type: message.type,
      name: contactName,
      phone: contactNumber.replace(/@c\.us$/, "").replace(/\D/g, "").length >= 10
        ? `+${contactNumber.replace(/\D/g, "")}`
        : contactNumber,
      sessionId,
      button_title: interactive?.buttonReply?.title || interactive?.listReply?.title || "",
      button_id: interactive?.buttonReply?.id || interactive?.listReply?.id || "",
    },
    message: {
      body: messageBody,
      from: contactNumber,
      type: message.type,
    },
  };
}

export async function dispatchWhatsAppFlowAutomation(opts: {
  sessionId: string;
  userId: string;
  organizationId?: string | null;
  message: Record<string, unknown>;
  contactName: string;
  contactNumber: string;
  messageBody: string;
  isFirstMessage?: boolean;
  interactive?: WhatsAppInteractiveHint;
}): Promise<void> {
  const organizationId =
    opts.organizationId || (await resolveOrganizationIdForSessionId(opts.sessionId));

  // Drip stop-on-reply (independent of automation flows flag)
  try {
    const { handleDripInboundReply } = await import("../drip-campaigns/enrollment");
    await handleDripInboundReply({
      organizationId,
      phone: opts.contactNumber,
    });
  } catch (_) {}

  if (process.env.AUTOMATION_FLOWS_ENABLED === "false") return;

  if (organizationId && (await isRecipientOptedOut(organizationId, opts.contactNumber))) {
    console.log(`[Automation] Skipping flow automation — contact opted out: ${opts.contactNumber}`);
    return;
  }

  const canvasTriggerIds = resolveWhatsAppCanvasTriggers(opts.message, {
    isFirstMessage: opts.isFirstMessage,
    interactive: opts.interactive,
  });
  if (canvasTriggerIds.length === 0) return;

  const contextRoot = buildWhatsAppTriggerContext({
    message: opts.message,
    contactName: opts.contactName,
    contactNumber: opts.contactNumber,
    messageBody: opts.messageBody,
    sessionId: opts.sessionId,
    interactive: opts.interactive,
  });

  if (organizationId) {
    const mc = await findManagedContactForPhone(organizationId, opts.contactNumber);
    if (mc) {
      Object.assign(
        contextRoot,
        contactContextPayload(mc as unknown as Record<string, unknown>)
      );
    }
  }

  for (const canvasTriggerId of canvasTriggerIds) {
    console.log(
      `[Automation] WhatsApp ${canvasTriggerId} → session ${opts.sessionId} (${opts.contactNumber})`
    );
    await runActiveAutomationsForCanvasTrigger({
      canvasTriggerId,
      organizationId,
      ownerUserId: opts.userId,
      contextRoot,
      whatsappSessionId: opts.sessionId,
    });
  }
}
