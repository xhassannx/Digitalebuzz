import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import { isAuthenticatedOrApiKey } from "../replitAuth";
import { resolveOrganizationContext, requirePermission } from "../middleware/organization-context";
import { rateLimitMiddleware } from "../middleware/rate-limiter";
import { storage } from "../storage";
import type { Integration, ManagedContact } from "@shared/schema";
import { createRazorpayPaymentLink, createCashfreePaymentLink } from "./contact-gateway";
import { businessAPIManager } from "../whatsapp/business-api-client";
import { whatsappManager as unofficialWhatsappManager } from "../whatsapp/client";
import { persistPanelOutboundTextMessage } from "../panel-outbound-message";
import {
  finalizeContactPaymentRequestPaid,
  verifyRazorpayPaymentLinkRedirect,
} from "./contact-payment-finalize";
import { contactPaymentRequestWhatsAppBody } from "./customer-whatsapp-copy";
import { isOrgEmailOutboundConfigured, sendOrgOutboundEmail } from "../utils/email";
import { amountMinorForCurrency, parsePaymentAmountMajor } from "./payment-amount";
import {
  buildPaginatedResponse,
  isPaginatedListRequest,
  listPaginationFromRequest,
  parseListSearch,
} from "../utils/list-pagination";

const contactRequestBodySchema = z
  .object({
    contactId: z.string().min(1).optional(),
    chatId: z.string().min(1).optional(),
    amount: z.coerce.number().positive(),
    currency: z.string().max(10).default("INR"),
    description: z.string().max(500).optional(),
    integrationId: z.string().optional(),
    whatsappSessionId: z.string().optional(),
    /** Optional — copy of the pay link; validated when non-empty. */
    customerEmail: z.string().max(320).optional(),
  })
  .refine((b) => !!(b.contactId || b.chatId), { message: "contactId or chatId is required" })
  .refine((b) => !(b.contactId && b.chatId), { message: "Provide only one of contactId or chatId" });

function getUserId(req: Request): string | null {
  const u = (req as { user?: { claims?: { sub?: string } }; userId?: string }).user;
  return u?.claims?.sub || (req as { userId?: string }).userId || null;
}

function panelBaseUrl(req: Request): string {
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
  const host = req.get("host") || "localhost";
  return `${proto}://${host}`;
}

function contactPaymentsEnabled(cfg: Record<string, unknown> | null | undefined): boolean {
  return cfg?.useForContactPayments !== false;
}

/** Connected + contact payments on + required API keys present (Razorpay / Cashfree). */
function isContactPaymentGatewayUsable(integration: Integration): boolean {
  if (integration.status !== "connected") return false;
  if (integration.name !== "razorpay" && integration.name !== "cashfree") return false;
  if (!contactPaymentsEnabled(integration.config as Record<string, unknown> | undefined)) return false;
  const creds = (integration.credentials || {}) as Record<string, string>;
  if (integration.name === "razorpay") {
    return !!(creds.keyId || creds.key_id) && !!(creds.keySecret || creds.key_secret);
  }
  if (integration.name === "cashfree") {
    return !!(creds.clientId || creds.client_id) && !!(creds.clientSecret || creds.client_secret);
  }
  return false;
}

function pickPaymentIntegration(
  organizationId: string,
  integrationId: string | undefined,
  all: Integration[]
): { integration: Integration; gateway: "razorpay" | "cashfree" } {
  const candidates = all.filter(
    (i) => i.organizationId === organizationId && isContactPaymentGatewayUsable(i)
  );
  if (integrationId) {
    const one = candidates.find((c) => c.id === integrationId);
    if (!one) throw new Error("Payment integration not found or not enabled for contact payments.");
    return { integration: one, gateway: one.name as "razorpay" | "cashfree" };
  }
  const razorpay = candidates.find((c) => c.name === "razorpay");
  const cashfree = candidates.find((c) => c.name === "cashfree");
  const pick = razorpay || cashfree;
  if (!pick) {
    throw new Error("Connect Razorpay or Cashfree in Integrations and enable contact payments.");
  }
  return { integration: pick, gateway: pick.name as "razorpay" | "cashfree" };
}

async function pickConnectedSessionForPayment(organizationId: string, sessionId: string | undefined): Promise<string> {
  const sessions = await storage.getSessionsByOrganization(organizationId);
  const active = sessions.filter((s) => !s.deletedAt && s.status === "connected");
  if (sessionId) {
    const s = active.find((x) => x.sessionId === sessionId);
    if (!s) throw new Error("WhatsApp session not found or not connected for this organization.");
    return s.sessionId;
  }
  const official = active.filter((s) => s.connectionType === "official");
  if (official[0]) return official[0].sessionId;
  if (active[0]) return active[0].sessionId;
  throw new Error("Add a connected WhatsApp session to send payment links.");
}

function phoneDisplayFromChat(contactNumber: string): string {
  return contactNumber.replace(/@c\.us|@g\.us/gi, "").trim();
}

async function resolveManagedContactFromChat(
  chatId: string,
  organizationId: string,
  actingUserId: string
): Promise<ManagedContact> {
  const chat = await storage.getChat(chatId);
  if (!chat) {
    throw new Error("Chat not found");
  }
  const orgSessions = await storage.getSessionsByOrganization(organizationId);
  const sessionIds = new Set(orgSessions.map((s) => s.sessionId));
  if (!sessionIds.has(chat.sessionId)) {
    throw new Error("This chat does not belong to your organization.");
  }
  const waSession = await storage.getSession(chat.sessionId);
  if (!waSession) {
    throw new Error("WhatsApp session not found for this chat.");
  }
  const digits = phoneDisplayFromChat(chat.contactNumber).replace(/\D/g, "");
  if (!digits) {
    throw new Error("Chat has no usable phone number for payment.");
  }
  let managed = await storage.findManagedContactByOrganizationAndPhoneDigits(organizationId, digits);
  if (!managed) {
    const phoneNumber = phoneDisplayFromChat(chat.contactNumber);
    const name = (chat.contactName || "").trim() || phoneNumber || "Customer";
    managed = await storage.createManagedContact(
      {
        userId: actingUserId,
        organizationId,
        name,
        phoneNumber,
        source: "whatsapp",
      },
      { skipAutomation: true }
    );
  }
  return managed;
}

async function sendPaymentWhatsAppMessage(
  sessionId: string,
  toPhone: string,
  message: string
): Promise<{ waMessageId?: string }> {
  const session = await storage.getSession(sessionId);
  if (!session || session.status !== "connected") {
    throw new Error("WhatsApp session not connected");
  }
  const to = phoneDisplayFromChat(toPhone);
  if (session.connectionType === "official") {
    const r = await businessAPIManager.sendTextMessage(sessionId, to, message);
    return { waMessageId: typeof r?.id === "string" ? r.id : undefined };
  }
  const r = await unofficialWhatsappManager.sendTextMessage(sessionId, to, message);
  return { waMessageId: typeof r?.id === "string" ? r.id : undefined };
}

async function resolveChatIdForSessionAndPhone(sessionId: string, contactPhone: string): Promise<string | undefined> {
  const digits = phoneDisplayFromChat(contactPhone).replace(/\D/g, "");
  if (!digits) return undefined;
  const chats = await storage.getChatsBySession(sessionId);
  const match = chats.find((ch) => phoneDisplayFromChat(ch.contactNumber).replace(/\D/g, "") === digits);
  return match?.id;
}

export function registerContactPaymentRoutes(app: Express) {
  const withOrg = [isAuthenticatedOrApiKey, rateLimitMiddleware, resolveOrganizationContext];

  app.get("/api/public/pay/:token", async (req: Request, res: Response) => {
    const token = req.params.token;
    if (!token || token.length > 64) {
      return res.status(400).json({ message: "Invalid token" });
    }
    let row = await storage.getContactPaymentRequestByToken(token);
    if (!row) {
      return res.status(404).json({ message: "Payment link not found" });
    }

    const qPl = typeof req.query.razorpay_payment_link_id === "string" ? req.query.razorpay_payment_link_id : "";
    const qPay = typeof req.query.razorpay_payment_id === "string" ? req.query.razorpay_payment_id : "";
    const qRef =
      typeof req.query.razorpay_payment_link_reference_id === "string"
        ? req.query.razorpay_payment_link_reference_id
        : "";
    const qStatus =
      typeof req.query.razorpay_payment_link_status === "string" ? req.query.razorpay_payment_link_status : "";
    const qSig = typeof req.query.razorpay_signature === "string" ? req.query.razorpay_signature : "";

    const rzParamKeys = [
      "razorpay_payment_link_id",
      "razorpay_payment_id",
      "razorpay_payment_link_status",
      "razorpay_signature",
    ] as const;
    const hasAnyRz = rzParamKeys.some((k) => req.query[k] !== undefined);
    const hasAllRz = !!(qPl && qPay && qStatus && qSig);

    if (hasAnyRz && !hasAllRz && row.status === "pending" && row.gateway === "razorpay") {
      return res.status(400).json({ message: "Incomplete payment confirmation parameters." });
    }

    if (
      hasAllRz &&
      row.status === "pending" &&
      row.gateway === "razorpay" &&
      qStatus.toLowerCase() === "paid"
    ) {
      if (qPl !== row.gatewayLinkId) {
        return res.status(400).json({ message: "Payment confirmation does not match this link." });
      }
      if (!row.integrationId) {
        return res.status(400).json({ message: "Payment integration missing for this request." });
      }
      const integ = await storage.getIntegrationById(row.integrationId);
      const creds = (integ?.credentials || {}) as Record<string, string>;
      const keySecret = creds.keySecret || creds.key_secret;
      if (!keySecret) {
        return res.status(400).json({ message: "Payment gateway is not configured to verify this payment." });
      }
      const okSig = verifyRazorpayPaymentLinkRedirect({
        paymentLinkId: qPl,
        paymentLinkReferenceId: qRef,
        paymentLinkStatus: qStatus,
        paymentId: qPay,
        signature: qSig,
        keySecret,
      });
      if (!okSig) {
        return res.status(400).json({ message: "Invalid payment signature." });
      }
      await finalizeContactPaymentRequestPaid(row.id, qPay);
      row = (await storage.getContactPaymentRequestByToken(token))!;
    }

    const amountMajor = row.amountMinor / 100;
    const base = panelBaseUrl(req);
    res.json({
      status: row.status,
      currency: row.currency,
      amount: amountMajor,
      amountDisplay: `${row.currency} ${amountMajor.toFixed(2)}`,
      description: row.description || null,
      payUrl: row.shortUrl || null,
      panelUrl: `${base}/pay/${row.token}`,
      gatewayPaymentId: row.gatewayPaymentId ?? null,
    });
  });

  app.get(
    "/api/payments/options",
    ...withOrg,
    requirePermission("manage_contacts.view", "manage_contacts.edit"),
    async (req: Request, res: Response) => {
      const organizationId = req.context!.organizationId;
      const all = await storage.getIntegrationsByOrganization(organizationId);
      const integrations = all.filter(isContactPaymentGatewayUsable);
      const sessions = await storage.getSessionsByOrganization(organizationId);
      const connected = sessions.filter((s) => !s.deletedAt && s.status === "connected");
      const emailCopyAvailable = await isOrgEmailOutboundConfigured(organizationId);
      res.json({
        emailCopyAvailable,
        integrations: integrations.map((i) => ({
          id: i.id,
          name: i.name,
          displayName: i.displayName,
          connectionName: (i.config as Record<string, unknown> | undefined)?.connectionName,
        })),
        whatsappSessions: connected.map((s) => ({
          sessionId: s.sessionId,
          connectionType: s.connectionType,
          label:
            (s.connectionType === "official" ? "[Business] " : "[WhatsApp] ") +
            (s.deviceInfo?.verifiedName ||
              s.deviceInfo?.displayPhoneNumber ||
              s.deviceInfo?.name ||
              s.sessionId.slice(0, 8)),
        })),
      });
    }
  );

  app.get(
    "/api/payments/contact-requests",
    ...withOrg,
    requirePermission("manage_contacts.view"),
    async (req: Request, res: Response) => {
      const organizationId = req.context!.organizationId;
      const contactId = typeof req.query.contactId === "string" ? req.query.contactId : undefined;
      if (isPaginatedListRequest(req.query as Record<string, unknown>)) {
        const pagination = listPaginationFromRequest(req);
        const search = parseListSearch(req.query as Record<string, unknown>);
        const result = await storage.listContactPaymentRequestsByOrganization(organizationId, {
          contactId,
          search,
          ...pagination,
        });
        return res.json(buildPaginatedResponse("transactions", result));
      }
      const limitRaw = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 50;
      const limit = Number.isFinite(limitRaw) ? limitRaw : 50;
      const rows = await storage.getContactPaymentRequestsByOrganization(organizationId, {
        contactId,
        limit,
      });
      res.json(rows);
    }
  );

  app.post(
    "/api/payments/contact-request",
    ...withOrg,
    requirePermission("manage_contacts.edit"),
    async (req: Request, res: Response) => {
      try {
        const parsed = contactRequestBodySchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: parsed.error.flatten().formErrors.join(", ") || "Invalid body" });
        }
        const userId = getUserId(req);
        if (!userId) return res.status(401).json({ message: "Authentication required" });
        const organizationId = req.context!.organizationId;
        const {
          contactId,
          chatId,
          amount,
          currency,
          description,
          integrationId,
          whatsappSessionId,
          customerEmail: customerEmailRaw,
        } = parsed.data;
        let customerEmail = customerEmailRaw?.trim() || undefined;
        let emailWarning: string | undefined;
        if (customerEmail) {
          const emailOk = z.string().email().safeParse(customerEmail).success;
          if (!emailOk) {
            return res.status(400).json({ message: "Invalid email address" });
          }
          const canEmail = await isOrgEmailOutboundConfigured(organizationId);
          if (!canEmail) {
            emailWarning =
              "Payment link will be sent on WhatsApp only. Configure SMTP under Integrations or Settings to also email the pay link.";
            customerEmail = undefined;
          }
        }

        let contact: ManagedContact;
        if (contactId) {
          const row = await storage.getManagedContactByOrganization(contactId, organizationId);
          if (!row) {
            return res.status(404).json({ message: "Contact not found" });
          }
          contact = row;
        } else {
          try {
            contact = await resolveManagedContactFromChat(chatId!, organizationId, userId);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Could not resolve contact from chat";
            return res.status(400).json({ message: msg });
          }
        }

        const allInteg = await storage.getIntegrationsByOrganization(organizationId);
        const { integration, gateway } = pickPaymentIntegration(organizationId, integrationId, allInteg);
        const waSessionId = await pickConnectedSessionForPayment(organizationId, whatsappSessionId);

        const amountMajor = parsePaymentAmountMajor(amount);
        const amountMinor = amountMinorForCurrency(amountMajor, currency);
        if (amountMinor < 1) {
          return res.status(400).json({ message: "Amount too small" });
        }

        const token = crypto.randomBytes(24).toString("hex");
        const base = panelBaseUrl(req);
        const panelPayUrl = `${base}/pay/${token}`;
        const creds = (integration.credentials || {}) as Record<string, string>;
        const cfg = (integration.config || {}) as Record<string, unknown>;

        let gatewayLinkId: string;
        let shortUrl: string;

        if (gateway === "razorpay") {
          const keyId = creds.keyId || creds.key_id;
          const keySecret = creds.keySecret || creds.key_secret;
          if (!keyId || !keySecret) {
            return res.status(400).json({ message: "Razorpay Key ID and Key Secret are required on the integration." });
          }
          const created = await createRazorpayPaymentLink({
            keyId,
            keySecret,
            amountPaise: amountMinor,
            currency: currency.toUpperCase(),
            description: (description || `Payment — ${contact.name}`).slice(0, 255),
            customerName: contact.name,
            customerContactDigits: contact.phoneNumber,
            callbackUrl: panelPayUrl,
          });
          gatewayLinkId = created.id;
          shortUrl = created.short_url;
        } else {
          const clientId = creds.clientId || creds.client_id;
          const clientSecret = creds.clientSecret || creds.client_secret;
          if (!clientId || !clientSecret) {
            return res.status(400).json({ message: "Cashfree App ID and Secret Key are required on the integration." });
          }
          const linkId = `c${token.slice(0, 39)}`;
          const notifyUrl = `${base}/api/webhooks/payments/cashfree`;
          const created = await createCashfreePaymentLink({
            clientId,
            clientSecret,
            linkId,
            amountRupees: amountMinor / 100,
            currency: currency.toUpperCase(),
            customerPhoneDigits: contact.phoneNumber,
            purpose: (description || `Payment — ${contact.name}`).slice(0, 120),
            notifyUrl,
            useSandbox: !!cfg.cashfreeSandbox,
          });
          gatewayLinkId = created.link_id;
          shortUrl = created.link_url;
        }

        await storage.createContactPaymentRequest({
          token,
          organizationId,
          userId,
          integrationId: integration.id,
          contactId: contact.id,
          gateway,
          amountMinor,
          currency: currency.toUpperCase(),
          status: "pending",
          gatewayLinkId,
          shortUrl,
          customerPhone: contact.phoneNumber,
          description: description?.trim() || undefined,
          whatsappSessionId: waSessionId,
          metadata: {
            contactName: contact.name,
            ...(chatId ? { chatId } : {}),
            ...(customerEmail ? { customerEmail } : {}),
          },
        });

        const amtStr = (amountMinor / 100).toFixed(2);
        const cur = currency.toUpperCase();
        const firstName = contact.name.split(/\s+/)[0] || "there";
        const msg = contactPaymentRequestWhatsAppBody({
          firstName,
          currency: cur,
          amountStr: amtStr,
          panelPayUrl,
          shortUrl,
          note: description?.trim(),
        });
        try {
          const sendMeta = await sendPaymentWhatsAppMessage(waSessionId, contact.phoneNumber, msg);
          const sessionRow = await storage.getSession(waSessionId);
          const resolvedChatId =
            chatId ?? (await resolveChatIdForSessionAndPhone(waSessionId, contact.phoneNumber));
          if (resolvedChatId && sessionRow) {
            const conn: "official" | "unofficial" =
              sessionRow.connectionType === "official" ? "official" : "unofficial";
            await persistPanelOutboundTextMessage({
              chatId: resolvedChatId,
              sessionId: waSessionId,
              userId,
              organizationId,
              body: msg,
              whatsappMessageId: sendMeta.waMessageId ?? null,
              connectionType: conn,
            });
          }
        } catch (e: unknown) {
          console.error("[contact payment] initial WhatsApp send failed:", e);
          return res.status(201).json({
            token,
            panelUrl: panelPayUrl,
            payUrl: shortUrl,
            warning: "Payment link created but WhatsApp message failed. Share the link manually.",
          });
        }

        if (customerEmail) {
          const subj = `Payment request — ${cur} ${amtStr}`;
          const emailText = `${msg}\n\n—\nSent from your conversation on WhatsApp.`;
          const emailHtml = `<p style="font-family:system-ui,sans-serif;line-height:1.6;color:#111;">${msg.replace(
            /\n/g,
            "<br/>"
          )}</p><p style="color:#666;font-size:13px;">Sent from your conversation on WhatsApp.</p>`;
          const emailed = await sendOrgOutboundEmail(organizationId, {
            to: customerEmail,
            subject: subj,
            text: emailText,
            html: emailHtml,
          });
          if (!emailed) {
            emailWarning =
              emailWarning ||
              "Payment link sent on WhatsApp but the email copy could not be delivered. Check SMTP settings.";
          }
        }

        res.status(201).json({
          token,
          panelUrl: panelPayUrl,
          payUrl: shortUrl,
          ...(emailWarning ? { warning: emailWarning } : {}),
        });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Failed to create payment request";
        console.error("[contact payment]", e);
        res.status(400).json({ message });
      }
    }
  );
}
