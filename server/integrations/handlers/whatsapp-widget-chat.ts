// @ts-nocheck
import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { storage } from "../../storage";
import { rateLimitMiddleware } from "../../middleware/rate-limiter";
import { findOrCreateChat } from "../../routes/shared";
import {
  mergeWhatsAppChatWidgetConfig,
  normalizeWhatsAppPhone,
  type WhatsAppChatWidgetConfig,
} from "@shared/whatsapp-chat-widget";
import { broadcastStoredMessage } from "../../panel-outbound-message";

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type VisitorTokenPayload = {
  chatId: string;
  sessionId: string;
  visitorPhone: string;
  visitorName: string;
  widgetPublicId: string;
  exp: number;
};

function tokenSecret(): string {
  return process.env.SESSION_SECRET || "helicoptic-widget-chat-dev";
}

function signVisitorToken(payload: VisitorTokenPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", tokenSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyVisitorToken(token: string): VisitorTokenPayload | null {
  try {
    const [body, sig] = String(token || "").split(".");
    if (!body || !sig) return null;
    const expected = crypto.createHmac("sha256", tokenSecret()).update(body).digest("base64url");
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as VisitorTokenPayload;
    if (!payload.exp || Date.now() > payload.exp) return null;
    if (!payload.chatId || !payload.sessionId || !payload.widgetPublicId) return null;
    return payload;
  } catch {
    return null;
  }
}

async function resolveWidgetIntegration(req: Request, body: Record<string, unknown>) {
  const widgetPublicId = String(body.widgetPublicId || "").trim();
  const organizationId =
    String(body.organizationId || "").trim() ||
    String(req.query.organizationId || "").trim() ||
    process.env.WHITELABEL_ORG_ID ||
    process.env.VITE_WHITELABEL_ORG_ID ||
    "";

  if (widgetPublicId) {
    const integration = await storage.getWhatsAppChatWidgetByPublicId(widgetPublicId);
    if (integration?.status === "connected") return integration;
  }

  if (organizationId) {
    const integrations = await storage.getIntegrationsByOrganization(organizationId);
    return integrations.find((i) => i.name === "whatsapp-chat-widget" && i.status === "connected");
  }

  return undefined;
}

function formatContactNumber(digits: string): string {
  const d = normalizeWhatsAppPhone(digits);
  return d.includes("@") ? d : `${d}@c.us`;
}

async function storeVisitorInboundMessage(opts: {
  sessionId: string;
  chatId: string;
  organizationId?: string;
  userId: string;
  visitorName: string;
  visitorPhone: string;
  body: string;
  pageUrl?: string;
}) {
  const prefix = opts.pageUrl ? `[Website · ${opts.pageUrl}]\n` : "[Website chat]\n";
  const displayBody = `${prefix}${opts.body}`;

  const message = await storage.createMessage({
    sessionId: opts.sessionId,
    chatId: opts.chatId,
    organizationId: opts.organizationId || undefined,
    body: displayBody,
    fromMe: false,
    type: "text",
    status: "pending",
    sentAt: new Date(),
  });

  const chat = await storage.getChat(opts.chatId);
  const nextUnread = (chat?.unreadCount || 0) + 1;

  await storage.updateChat(opts.chatId, {
    lastMessage: displayBody.substring(0, 100),
    lastMessageTime: new Date(),
    unreadCount: nextUnread,
    ...(opts.visitorName ? { contactName: opts.visitorName } : {}),
  });

  broadcastStoredMessage(opts.userId, message);
  return message;
}

function visitorDisplayBody(body: string): string {
  return String(body || "")
    .replace(/^\[Website[^\]]*\]\n?/i, "")
    .trim();
}

function serializeMessages(rows: Array<{ id: string; body: string | null; fromMe: boolean; timestamp: Date | null }>) {
  return rows.map((m) => ({
    id: m.id,
    body: visitorDisplayBody(m.body || ""),
    fromMe: !!m.fromMe,
    timestamp: m.timestamp ? new Date(m.timestamp).toISOString() : new Date().toISOString(),
  }));
}

export function registerWhatsAppWidgetChatRoutes(app: Express) {
  app.post(
    "/api/public/whatsapp-chat-widget/chat/start",
    rateLimitMiddleware,
    async (req: Request, res: Response) => {
      try {
        const integration = await resolveWidgetIntegration(req, req.body || {});
        if (!integration) {
          return res.status(404).json({ message: "Chat widget is not available" });
        }

        const config = mergeWhatsAppChatWidgetConfig(integration.config as WhatsAppChatWidgetConfig);
        if (!config.enabled || !config.sessionId) {
          return res.status(400).json({ message: "Chat widget is disabled" });
        }

        const visitorName = String(req.body?.visitorName || "").trim().slice(0, 120);
        const visitorPhone = normalizeWhatsAppPhone(String(req.body?.visitorPhone || ""));
        const message = String(req.body?.message || config.panel.defaultMessage || "").trim().slice(0, 4000);
        const pageUrl = String(req.body?.pageUrl || "").trim().slice(0, 500);

        if (!visitorPhone) {
          return res.status(400).json({ message: "Phone number is required" });
        }
        if (!message) {
          return res.status(400).json({ message: "Message is required" });
        }

        const session = await storage.getSession(config.sessionId);
        if (!session || session.status !== "connected") {
          return res.status(400).json({ message: "WhatsApp line is not connected" });
        }

        const chatId = await findOrCreateChat(config.sessionId, formatContactNumber(visitorPhone));
        const chat = await storage.getChat(chatId);
        if (chat && visitorName) {
          await storage.updateChat(chatId, { contactName: visitorName });
        }

        const stored = await storeVisitorInboundMessage({
          sessionId: config.sessionId,
          chatId,
          organizationId: session.organizationId || integration.organizationId || undefined,
          userId: session.userId,
          visitorName: visitorName || visitorPhone,
          visitorPhone,
          body: message,
          pageUrl: pageUrl || undefined,
        });

        const widgetPublicId = config.widgetPublicId || "";
        const visitorToken = signVisitorToken({
          chatId,
          sessionId: config.sessionId,
          visitorPhone,
          visitorName: visitorName || visitorPhone,
          widgetPublicId,
          exp: Date.now() + TOKEN_TTL_MS,
        });

        const allMessages = await storage.getMessagesByChat(chatId, 50);
        res.json({
          visitorToken,
          chatId,
          messages: serializeMessages(allMessages),
          lastMessageId: stored.id,
        });
      } catch (error: any) {
        console.error("[WidgetChat] start error:", error);
        res.status(500).json({ message: error.message || "Failed to start chat" });
      }
    },
  );

  app.post(
    "/api/public/whatsapp-chat-widget/chat/message",
    rateLimitMiddleware,
    async (req: Request, res: Response) => {
      try {
        const payload = verifyVisitorToken(String(req.body?.visitorToken || ""));
        if (!payload) {
          return res.status(401).json({ message: "Chat session expired. Please start again." });
        }

        const integration = await storage.getWhatsAppChatWidgetByPublicId(payload.widgetPublicId);
        if (!integration || integration.status !== "connected") {
          return res.status(404).json({ message: "Chat widget is not available" });
        }

        const config = mergeWhatsAppChatWidgetConfig(integration.config as WhatsAppChatWidgetConfig);
        if (!config.enabled || config.sessionId !== payload.sessionId) {
          return res.status(400).json({ message: "Chat widget is disabled" });
        }

        const message = String(req.body?.message || "").trim().slice(0, 4000);
        if (!message) {
          return res.status(400).json({ message: "Message is required" });
        }

        const session = await storage.getSession(payload.sessionId);
        if (!session) {
          return res.status(400).json({ message: "WhatsApp line is not connected" });
        }

        const stored = await storeVisitorInboundMessage({
          sessionId: payload.sessionId,
          chatId: payload.chatId,
          organizationId: session.organizationId || integration.organizationId || undefined,
          userId: session.userId,
          visitorName: payload.visitorName,
          visitorPhone: payload.visitorPhone,
          body: message,
          pageUrl: String(req.body?.pageUrl || "").trim().slice(0, 500) || undefined,
        });

        res.json({
          message: serializeMessages([stored])[0],
        });
      } catch (error: any) {
        console.error("[WidgetChat] message error:", error);
        res.status(500).json({ message: error.message || "Failed to send message" });
      }
    },
  );

  app.get(
    "/api/public/whatsapp-chat-widget/chat/messages",
    rateLimitMiddleware,
    async (req: Request, res: Response) => {
      try {
        const payload = verifyVisitorToken(String(req.query.visitorToken || ""));
        if (!payload) {
          return res.status(401).json({ message: "Chat session expired" });
        }

        const since = String(req.query.since || "").trim();
        const all = await storage.getMessagesByChat(payload.chatId, 100);
        const filtered = since
          ? all.filter((m) => {
              const ts = m.timestamp ? new Date(m.timestamp).toISOString() : "";
              return ts > since;
            })
          : all;

        res.json({
          messages: serializeMessages(filtered),
        });
      } catch (error: any) {
        console.error("[WidgetChat] poll error:", error);
        res.status(500).json({ message: error.message || "Failed to load messages" });
      }
    },
  );
}
