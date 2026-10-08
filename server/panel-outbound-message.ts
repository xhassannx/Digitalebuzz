import type { Message, MessageTemplate } from "@shared/schema";
import { storage } from "./storage";
import { businessAPIManager } from "./whatsapp/business-api-client";
import { findOrCreateChat } from "./routes/shared";
import { clearChatbotConversationForContact } from "./chatbots/executor";
import { triggerWebhooks } from "./webhooks/delivery";

type BroadcastFn = (userId: string, event: string, data: unknown) => void;

let broadcastToUserRef: BroadcastFn | null = null;

/** Called from registerRoutes after WebSocket broadcast helper is created. */
export function setPanelOutboundBroadcaster(fn: BroadcastFn | null): void {
  broadcastToUserRef = fn;
}

/** Push a stored message to open inbox sessions (used by chatbot + panel outbound). */
export function broadcastStoredMessage(userId: string, message: Message): void {
  broadcastToUserRef?.(userId, "new_message", message);
}

export type OutboundMessageType = "text" | "template" | "image" | "video" | "audio" | "document";

/**
 * Store an outbound WhatsApp message in chat history (inbox) — same persistence path as manual sends.
 */
export async function persistOutboundWhatsAppMessage(params: {
  sessionId: string;
  to: string;
  userId: string;
  organizationId?: string | null;
  connectionType: "official" | "unofficial";
  whatsappMessageId?: string | null;
  type: OutboundMessageType;
  body: string;
  mediaUrl?: string | null;
  templateName?: string | null;
  templateLanguage?: string | null;
  templateParams?: string[] | null;
  templateType?: string | null;
  headerText?: string | null;
  footer?: string | null;
}): Promise<Message | null> {
  try {
    const waId = params.whatsappMessageId?.trim();
    if (waId) {
      const existing = await storage.getMessageByIdOrWhatsAppId(waId, params.userId, params.sessionId);
      if (existing) {
        return existing;
      }
    }

    const chatId = await findOrCreateChat(params.sessionId, String(params.to));
    const now = new Date();
    const body = params.body.trim() || (params.type === "template" ? `[Template] ${params.templateName || "template"}` : "[Message]");

    const mediaTypeLabel =
      params.type === "image"
        ? "📷 Image"
        : params.type === "video"
          ? "🎥 Video"
          : params.type === "audio"
            ? "🎤 Voice message"
            : params.type === "document"
              ? "📄 Document"
              : params.type === "template"
                ? "📋 Template"
                : null;

    const preview =
      params.type === "text"
        ? body.substring(0, 100)
        : mediaTypeLabel && body !== "[Media]" && !body.startsWith("[Template]")
          ? `${mediaTypeLabel}: ${body.substring(0, 50)}`
          : mediaTypeLabel || body.substring(0, 100);

    const message = await storage.createMessage({
      sessionId: params.sessionId,
      chatId,
      organizationId: params.organizationId ?? null,
      body,
      fromMe: true,
      type: params.type,
      status: "sent",
      whatsappMessageId: waId || undefined,
      mediaUrl: params.mediaUrl || undefined,
      footer: params.footer || undefined,
      templateName: params.templateName || undefined,
      templateLanguage: params.templateLanguage || undefined,
      templateParams: params.templateParams?.length ? params.templateParams : undefined,
      templateType:
        params.templateType === "TEXT" ||
        params.templateType === "IMAGE" ||
        params.templateType === "VIDEO" ||
        params.templateType === "DOCUMENT"
          ? params.templateType
          : undefined,
      headerText: params.headerText || undefined,
      // Explicitly set both so inbox times match the real send moment
      timestamp: now,
      sentAt: now,
    });

    if (params.connectionType === "official" && waId) {
      businessAPIManager.storeMessageMapping(waId, message.id, params.sessionId);
    }

    await storage.updateChat(chatId, {
      lastMessage: preview,
      lastMessageTime: now,
    });

    clearChatbotConversationForContact(params.sessionId, String(params.to));

    const messageToBroadcast = { ...message, whatsappMessageId: waId || message.whatsappMessageId };
    broadcastToUserRef?.(params.userId, "new_message", messageToBroadcast);
    triggerWebhooks(params.userId, "message.sent", { message, to: String(params.to) }).catch(() => {});

    console.log("[Outbound persist] Stored flow/panel message in inbox:", {
      messageId: message.id,
      chatId,
      type: params.type,
      to: params.to,
    });

    return message;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Outbound persist] Failed to store message:", msg);
    return null;
  }
}

/**
 * Store a panel-initiated outbound text (payment link, meet link, etc.) in chat history
 * so the inbox matches WhatsApp, and optionally notify the sender over WebSocket.
 */
export async function persistPanelOutboundTextMessage(params: {
  chatId: string;
  sessionId: string;
  userId: string;
  organizationId?: string | null;
  body: string;
  whatsappMessageId?: string | null;
  connectionType: "official" | "unofficial";
}): Promise<Message | null> {
  const chat = await storage.getChat(params.chatId);
  if (!chat || chat.sessionId !== params.sessionId) {
    return null;
  }

  return persistOutboundWhatsAppMessage({
    sessionId: params.sessionId,
    to: chat.contactNumber,
    userId: params.userId,
    organizationId: params.organizationId,
    connectionType: params.connectionType,
    whatsappMessageId: params.whatsappMessageId,
    type: "text",
    body: params.body,
  });
}

function substituteNumericPlaceholders(pattern: string, params: string[]): string {
  let out = pattern;
  params.forEach((param, index) => {
    out = out.replace(new RegExp(`\\{\\{${index + 1}\\}\\}`, "g"), param);
  });
  return out;
}

/** Build inbox display body + template metadata for automation template sends. */
export async function buildAutomationTemplatePersistMeta(opts: {
  userId: string;
  organizationId?: string | null;
  phoneNumberId?: string;
  templateName: string;
  languageCode: string;
  templateParams?: string[];
  tplRow?: MessageTemplate | null;
  headerImageUrl?: string;
  headerVideoUrl?: string;
}): Promise<{
  body: string;
  footer: string | null;
  templateType: string | null;
  headerText: string | null;
  mediaUrl: string | null;
}> {
  const params = (opts.templateParams ?? []).map((p) => String(p ?? ""));
  let tpl = opts.tplRow ?? null;

  if (!tpl) {
    try {
      const list = await storage.getMessageTemplatesByUser(
        opts.userId,
        opts.organizationId ?? undefined,
        opts.phoneNumberId
      );
      tpl =
        list.find(
          (t) =>
            (t.status === "APPROVED" || String(t.status || "").toLowerCase() === "approved") &&
            (t.name === opts.templateName || t.name?.toLowerCase() === opts.templateName.toLowerCase())
        ) ?? null;
    } catch {
      tpl = null;
    }
  }

  let footer: string | null = null;
  let headerText: string | null = null;
  let templateType: string | null = "TEXT";
  let mediaUrl: string | null = opts.headerImageUrl?.trim() || opts.headerVideoUrl?.trim() || null;
  const parts: string[] = [];

  if (tpl?.components) {
    const header = tpl.components.find((c) => c.type === "HEADER");
    if (header?.format === "TEXT" && header.text) {
      headerText = substituteNumericPlaceholders(header.text, params);
      parts.push(headerText);
      templateType = "TEXT";
    } else if (header?.format) {
      templateType = String(header.format);
      if (header.format === "IMAGE" && opts.headerImageUrl) {
        mediaUrl = opts.headerImageUrl.trim();
      } else if (header.format === "VIDEO" && opts.headerVideoUrl) {
        mediaUrl = opts.headerVideoUrl.trim();
      }
    }

    const bodyComp = tpl.components.find((c) => c.type === "BODY");
    if (bodyComp?.text) {
      parts.push(substituteNumericPlaceholders(bodyComp.text, params));
    }

    const foot = tpl.components.find((c) => c.type === "FOOTER");
    if (foot?.text) {
      footer = foot.text;
      parts.push(foot.text);
    }
  }

  const body =
    parts.filter(Boolean).join("\n\n").trim() ||
    (params.length > 0 ? `[Template] ${opts.templateName}\n${params.join("\n")}` : `[Template] ${opts.templateName}`);

  return { body, footer, templateType, headerText, mediaUrl };
}
