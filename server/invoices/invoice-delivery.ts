import fs from "fs";
import path from "path";
import { storage } from "../storage";
import { sendOrgOutboundEmail } from "../utils/email";
import { sendPanelMediaMessage } from "../panel-inbox-send";
import { pickConnectedSessionForPayment } from "../payments/create-contact-payment";
import {
  buildInvoiceEmailContent,
  buildInvoiceWhatsAppCaption,
  type InvoiceMessageContext,
} from "./invoice-message-templates";

export type InvoiceDeliveryResult = {
  email?: { attempted: boolean; sent: boolean; error?: string };
  whatsapp?: { attempted: boolean; sent: boolean; error?: string };
  pdfUrl?: string;
};

/** Display name on invoices and in delivery messages — settings name overrides org name. */
export function resolveInvoiceOrganizationName(
  settings?: { invoiceBusinessName?: string | null } | null,
  organizationName?: string | null,
): string {
  return settings?.invoiceBusinessName?.trim() || organizationName?.trim() || "Your Company";
}

export function saveInvoicePdf(
  organizationId: string,
  invoiceNo: string,
  buffer: Buffer,
): string {
  const dir = path.join(process.cwd(), "uploads", organizationId, "invoices");
  fs.mkdirSync(dir, { recursive: true });
  const safeNo = invoiceNo.replace(/[^a-zA-Z0-9-_]/g, "_");
  const filename = `invoice-${safeNo}-${Date.now()}.pdf`;
  fs.writeFileSync(path.join(dir, filename), buffer);
  return `/uploads/${organizationId}/invoices/${filename}`;
}

function normalizePhoneDigits(phone: string): string {
  return phone.replace(/@c\.us|@g\.us/gi, "").replace(/\D/g, "");
}

/** Prefer the WhatsApp session that already has a chat with this contact. */
async function pickSessionForInvoice(
  organizationId: string,
  toPhone: string,
): Promise<string> {
  const sessions = await storage.getSessionsByOrganization(organizationId);
  const active = sessions.filter((s) => !s.deletedAt && s.status === "connected");
  const targetDigits = normalizePhoneDigits(toPhone);
  if (!targetDigits) {
    return pickConnectedSessionForPayment(organizationId);
  }

  for (const session of active) {
    const chats = await storage.getChatsBySession(session.sessionId);
    const hasChat = chats.some((chat) => {
      const chatDigits = normalizePhoneDigits(chat.contactNumber);
      return (
        chatDigits === targetDigits ||
        chatDigits.endsWith(targetDigits) ||
        targetDigits.endsWith(chatDigits)
      );
    });
    if (hasChat) return session.sessionId;
  }

  return pickConnectedSessionForPayment(organizationId);
}

async function sendInvoiceWhatsApp(
  userId: string,
  organizationId: string,
  toPhone: string,
  message: InvoiceMessageContext,
  pdfBuffer: Buffer,
): Promise<{ sent: boolean; error?: string }> {
  try {
    const sessionId = await pickSessionForInvoice(organizationId, toPhone);
    const to = toPhone.replace(/@c\.us|@g\.us/gi, "").trim();
    const caption = buildInvoiceWhatsAppCaption(message);
    const fileName = `invoice-${message.invoiceNo.replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`;

    await sendPanelMediaMessage(
      userId,
      organizationId,
      {
        sessionId,
        to,
        caption,
        mediaType: "document",
        footerButtonType: "NONE",
      },
      {
        buffer: pdfBuffer,
        originalname: fileName,
        mimetype: "application/pdf",
      },
    );

    return { sent: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "WhatsApp send failed";
    return { sent: false, error: message };
  }
}

async function sendInvoiceEmail(
  organizationId: string,
  toEmail: string,
  message: InvoiceMessageContext,
  pdfBuffer: Buffer,
): Promise<{ sent: boolean; error?: string }> {
  try {
    const { subject, text, html } = buildInvoiceEmailContent(message);
    const sent = await sendOrgOutboundEmail(organizationId, {
      to: toEmail,
      subject,
      text,
      html,
      attachments: [
        {
          filename: `invoice-${message.invoiceNo.replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });
    if (!sent) {
      return { sent: false, error: "Email SMTP is not configured for this organization" };
    }
    return { sent: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Email send failed";
    return { sent: false, error: message };
  }
}

export async function deliverInvoiceAutomations(params: {
  userId: string;
  organizationId: string;
  organizationName: string;
  invoiceNo: string;
  pdfBuffer: Buffer;
  emailAutomation: boolean;
  whatsappAutomation: boolean;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerName?: string | null;
  currency?: string | null;
  totalAmount?: number | null;
  amountPaid?: number | null;
  amountPending?: number | null;
  invoiceStatus?: string | null;
}): Promise<InvoiceDeliveryResult> {
  const {
    userId,
    organizationId,
    organizationName,
    invoiceNo,
    pdfBuffer,
    emailAutomation,
    whatsappAutomation,
    customerEmail,
    customerPhone,
    customerName,
    currency,
    totalAmount,
    amountPaid,
    amountPending,
    invoiceStatus,
  } = params;

  const messageContext: InvoiceMessageContext = {
    organizationName,
    invoiceNo,
    customerName,
    currency,
    totalAmount,
    amountPaid,
    amountPending,
    invoiceStatus,
  };

  const pdfUrl = saveInvoicePdf(organizationId, invoiceNo, pdfBuffer);
  const result: InvoiceDeliveryResult = { pdfUrl };

  if (emailAutomation) {
    const email = customerEmail?.trim();
    if (!email) {
      result.email = { attempted: true, sent: false, error: "No customer email address" };
    } else {
      const r = await sendInvoiceEmail(organizationId, email, messageContext, pdfBuffer);
      result.email = { attempted: true, sent: r.sent, error: r.error };
    }
  }

  if (whatsappAutomation) {
    const phone = customerPhone?.trim();
    if (!phone) {
      result.whatsapp = { attempted: true, sent: false, error: "No customer phone number" };
    } else {
      const r = await sendInvoiceWhatsApp(
        userId,
        organizationId,
        phone,
        messageContext,
        pdfBuffer,
      );
      result.whatsapp = { attempted: true, sent: r.sent, error: r.error };
    }
  }

  return result;
}

/** Send invoice PDF to email and WhatsApp (both attempted). */
export async function deliverInvoiceToRecipient(params: {
  userId: string;
  organizationId: string;
  organizationName: string;
  invoiceNo: string;
  pdfBuffer: Buffer;
  email?: string | null;
  phone?: string | null;
  customerName?: string | null;
  currency?: string | null;
  totalAmount?: number | null;
  amountPaid?: number | null;
  amountPending?: number | null;
  invoiceStatus?: string | null;
}): Promise<InvoiceDeliveryResult> {
  return deliverInvoiceAutomations({
    userId: params.userId,
    organizationId: params.organizationId,
    organizationName: params.organizationName,
    invoiceNo: params.invoiceNo,
    pdfBuffer: params.pdfBuffer,
    emailAutomation: true,
    whatsappAutomation: true,
    customerEmail: params.email,
    customerPhone: params.phone,
    customerName: params.customerName,
    currency: params.currency,
    totalAmount: params.totalAmount,
    amountPaid: params.amountPaid,
    amountPending: params.amountPending,
    invoiceStatus: params.invoiceStatus,
  });
}
