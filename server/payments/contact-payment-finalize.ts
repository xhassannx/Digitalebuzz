import crypto from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "../../db";
import { contactPaymentRequests } from "@shared/schema";
import type { ContactPaymentRequestRow } from "@shared/schema";
import { storage } from "../storage";
import { businessAPIManager } from "../whatsapp/business-api-client";
import { whatsappManager as unofficialWhatsappManager } from "../whatsapp/client";
import { persistPanelOutboundTextMessage } from "../panel-outbound-message";
import { contactPaymentReceivedWhatsAppBody } from "./customer-whatsapp-copy";
import { sendOrgOutboundEmail } from "../utils/email";

function phoneDisplayFromChat(contactNumber: string): string {
  return contactNumber.replace(/@c\.us|@g\.us/gi, "").trim();
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const al = a.toLowerCase();
  const bl = b.toLowerCase();
  if (al.length !== bl.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(al, "utf8"), Buffer.from(bl, "utf8"));
  } catch {
    return false;
  }
}

/** Razorpay payment-link redirect callback (same payload as razorpay-php Utility::verifyPaymentSignature). */
export function verifyRazorpayPaymentLinkRedirect(params: {
  paymentLinkId: string;
  paymentLinkReferenceId: string;
  paymentLinkStatus: string;
  paymentId: string;
  signature: string;
  keySecret: string;
}): boolean {
  if (!params.keySecret || !params.signature) return false;
  const ref = params.paymentLinkReferenceId ?? "";
  const payload = `${params.paymentLinkId}|${ref}|${params.paymentLinkStatus}|${params.paymentId}`;
  const expected = crypto.createHmac("sha256", params.keySecret).update(payload).digest("hex");
  return timingSafeEqualHex(expected, params.signature);
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

async function notifyContactPaymentSuccess(
  row: ContactPaymentRequestRow,
  gatewayPaymentId: string | null
): Promise<void> {
  const amount = (row.amountMinor / 100).toFixed(2);
  const cur = row.currency;
  const payRef = (gatewayPaymentId || row.gatewayPaymentId || "").trim();
  const msg = contactPaymentReceivedWhatsAppBody({
    currency: cur,
    amountStr: amount,
    gatewayPaymentId: payRef || undefined,
  });

  let waMessageId: string | undefined;
  if (row.whatsappSessionId && row.customerPhone) {
    try {
      const r = await sendPaymentWhatsAppMessage(row.whatsappSessionId, row.customerPhone, msg);
      waMessageId = r.waMessageId;

      const meta = row.metadata as Record<string, unknown> | null | undefined;
      const metaChatId = typeof meta?.chatId === "string" ? meta.chatId : undefined;
      const sessionRow = await storage.getSession(row.whatsappSessionId);
      if (sessionRow) {
        let chatId = metaChatId;
        if (!chatId) {
          chatId = await resolveChatIdForSessionAndPhone(row.whatsappSessionId, row.customerPhone);
        }
        if (chatId) {
          const conn: "official" | "unofficial" =
            sessionRow.connectionType === "official" ? "official" : "unofficial";
          await persistPanelOutboundTextMessage({
            chatId,
            sessionId: row.whatsappSessionId,
            userId: row.userId,
            organizationId: row.organizationId,
            body: msg,
            whatsappMessageId: waMessageId ?? null,
            connectionType: conn,
          });
        }
      }
    } catch (e: unknown) {
      console.error("[contact payment] WhatsApp confirmation failed:", e);
    }
  }

  const meta = row.metadata as Record<string, unknown> | null | undefined;
  const emailTo = typeof meta?.customerEmail === "string" ? meta.customerEmail.trim() : "";
  if (emailTo && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTo)) {
    const subj = `Payment received — ${cur} ${amount}`;
    const refLine = payRef ? `\nTransaction reference: ${payRef}` : "";
    const text = `Hello,\n\nWe've received your payment of ${cur} ${amount}.${refLine}\n\nThank you for your payment.`;
    const html = `<p style="font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#111;">We've received your payment of <strong>${cur} ${amount}</strong>.</p>${
      payRef ? `<p>Transaction reference: ${payRef}</p>` : ""
    }<p>Thank you for your payment.</p>`;
    void sendOrgOutboundEmail(row.organizationId, {
      to: emailTo,
      subject: subj,
      text,
      html,
    }).catch((err) => console.error("[contact payment] receipt email failed:", err));
  }
}

export type FinalizeContactPaymentPaidResult = {
  didUpdate: boolean;
  row: ContactPaymentRequestRow | null;
};

/**
 * Marks a pending contact payment as paid (idempotent) and, only when this call performed the update,
 * sends WhatsApp confirmation and persists the message into chat history.
 */
export async function finalizeContactPaymentRequestPaid(
  rowId: string,
  gatewayPaymentId: string | null
): Promise<FinalizeContactPaymentPaidResult> {
  const [updated] = await db
    .update(contactPaymentRequests)
    .set({
      status: "paid",
      gatewayPaymentId: gatewayPaymentId || undefined,
      paidAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(contactPaymentRequests.id, rowId), eq(contactPaymentRequests.status, "pending")))
    .returning();

  if (updated) {
    await notifyContactPaymentSuccess(updated, gatewayPaymentId);
    return { didUpdate: true, row: updated };
  }

  const [existing] = await db
    .select()
    .from(contactPaymentRequests)
    .where(eq(contactPaymentRequests.id, rowId))
    .limit(1);
  return { didUpdate: false, row: existing ?? null };
}
