import crypto from "crypto";
import { storage } from "../storage";
import type { ManagedContact } from "@shared/schema";
import { createRazorpayPaymentLink, createCashfreePaymentLink } from "./contact-gateway";
import { contactPaymentRequestWhatsAppBody } from "./customer-whatsapp-copy";
import { businessAPIManager } from "../whatsapp/business-api-client";
import { whatsappManager as unofficialWhatsappManager } from "../whatsapp/client";
import { persistPanelOutboundTextMessage } from "../panel-outbound-message";
import {
  amountMinorForCurrency,
  parseFlowPaymentAmount,
  parsePaymentAmountMajor,
} from "./payment-amount";

export { parseFlowPaymentAmount } from "./payment-amount";

export type CreateContactPaymentInput = {
  organizationId: string;
  userId: string;
  contact: ManagedContact;
  amountMajor: number;
  currency?: string;
  description?: string;
  integrationId?: string;
  whatsappSessionId?: string;
  panelBaseUrl: string;
  chatId?: string;
  customerEmail?: string;
  sendWhatsApp?: boolean;
};

export type CreateContactPaymentResult = {
  token: string;
  shortUrl: string;
  panelPayUrl: string;
  gateway: "razorpay" | "cashfree";
  amountMinor: number;
  currency: string;
};

function contactPaymentsEnabled(cfg: Record<string, unknown> | null | undefined): boolean {
  return cfg?.useForContactPayments !== false;
}

function isContactPaymentGatewayUsable(integration: {
  status: string;
  name: string;
  credentials: Record<string, unknown> | null;
  config: Record<string, unknown> | null;
}): boolean {
  if (integration.status !== "connected") return false;
  if (integration.name !== "razorpay" && integration.name !== "cashfree") return false;
  if (!contactPaymentsEnabled(integration.config ?? undefined)) return false;
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
  all: Array<{
    id: string;
    organizationId: string | null;
    name: string;
    status: string;
    credentials: Record<string, unknown> | null;
    config: Record<string, unknown> | null;
  }>
) {
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

export async function pickConnectedSessionForPayment(
  organizationId: string,
  sessionId?: string
): Promise<string> {
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

async function sendPaymentWhatsAppMessage(
  sessionId: string,
  toPhone: string,
  message: string
): Promise<{ waMessageId?: string }> {
  const session = await storage.getSession(sessionId);
  if (!session || session.status !== "connected") {
    throw new Error("WhatsApp session not connected");
  }
  const to = toPhone.replace(/@c\.us|@g\.us/gi, "").trim();
  if (session.connectionType === "official") {
    const r = await businessAPIManager.sendTextMessage(sessionId, to, message);
    return { waMessageId: typeof r?.id === "string" ? r.id : undefined };
  }
  const r = await unofficialWhatsappManager.sendTextMessage(sessionId, to, message);
  return { waMessageId: typeof r?.id === "string" ? r.id : undefined };
}

export async function createAndSendContactPayment(
  input: CreateContactPaymentInput
): Promise<CreateContactPaymentResult> {
  const currency = (input.currency || "INR").toUpperCase();
  const amountMajor = parsePaymentAmountMajor(input.amountMajor);
  const amountMinor = amountMinorForCurrency(amountMajor, currency);
  if (amountMinor < 1) throw new Error("Amount too small");

  const allInteg = await storage.getIntegrationsByOrganization(input.organizationId);
  const { integration, gateway } = pickPaymentIntegration(
    input.organizationId,
    input.integrationId,
    allInteg
  );
  const waSessionId = await pickConnectedSessionForPayment(
    input.organizationId,
    input.whatsappSessionId
  );

  const token = crypto.randomBytes(24).toString("hex");
  const panelPayUrl = `${input.panelBaseUrl.replace(/\/$/, "")}/pay/${token}`;
  const creds = (integration.credentials || {}) as Record<string, string>;
  const cfg = (integration.config || {}) as Record<string, unknown>;

  let gatewayLinkId: string;
  let shortUrl: string;

  if (gateway === "razorpay") {
    const keyId = creds.keyId || creds.key_id;
    const keySecret = creds.keySecret || creds.key_secret;
    if (!keyId || !keySecret) {
      throw new Error("Razorpay Key ID and Key Secret are required on the integration.");
    }
    const created = await createRazorpayPaymentLink({
      keyId,
      keySecret,
      amountPaise: amountMinor,
      currency,
      description: (input.description || `Payment — ${input.contact.name}`).slice(0, 255),
      customerName: input.contact.name,
      customerContactDigits: input.contact.phoneNumber,
      callbackUrl: panelPayUrl,
    });
    gatewayLinkId = created.id;
    shortUrl = created.short_url;
  } else {
    const clientId = creds.clientId || creds.client_id;
    const clientSecret = creds.clientSecret || creds.client_secret;
    if (!clientId || !clientSecret) {
      throw new Error("Cashfree App ID and Secret Key are required on the integration.");
    }
    const linkId = `c${token.slice(0, 39)}`;
    const notifyUrl = `${input.panelBaseUrl.replace(/\/$/, "")}/api/webhooks/payments/cashfree`;
    const created = await createCashfreePaymentLink({
      clientId,
      clientSecret,
      linkId,
      amountRupees: amountMinor / 100,
      currency,
      customerPhoneDigits: input.contact.phoneNumber,
      purpose: (input.description || `Payment — ${input.contact.name}`).slice(0, 120),
      notifyUrl,
      useSandbox: !!cfg.cashfreeSandbox,
    });
    gatewayLinkId = created.link_id;
    shortUrl = created.link_url;
  }

  await storage.createContactPaymentRequest({
    token,
    organizationId: input.organizationId,
    userId: input.userId,
    integrationId: integration.id,
    contactId: input.contact.id,
    gateway,
    amountMinor,
    currency,
    status: "pending",
    gatewayLinkId,
    shortUrl,
    customerPhone: input.contact.phoneNumber,
    description: input.description?.trim() || undefined,
    whatsappSessionId: waSessionId,
    metadata: {
      contactName: input.contact.name,
      ...(input.chatId ? { chatId: input.chatId } : {}),
      ...(input.customerEmail ? { customerEmail: input.customerEmail } : {}),
    },
  });

  if (input.sendWhatsApp !== false) {
    const amtStr = (amountMinor / 100).toFixed(2);
    const firstName = input.contact.name.split(/\s+/)[0] || "there";
    const msg = contactPaymentRequestWhatsAppBody({
      firstName,
      currency,
      amountStr: amtStr,
      panelPayUrl,
      shortUrl,
      note: input.description?.trim(),
    });
    await sendPaymentWhatsAppMessage(waSessionId, input.contact.phoneNumber, msg);
  }

  return {
    token,
    shortUrl,
    panelPayUrl,
    gateway,
    amountMinor,
    currency,
  };
}
