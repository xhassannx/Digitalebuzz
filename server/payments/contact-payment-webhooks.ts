import crypto from "crypto";
import { storage } from "../storage";
import { eq, and } from "drizzle-orm";
import { db } from "../../db";
import { contactPaymentRequests } from "@shared/schema";
import { handleCashfreeWhitelabelOnboardingWebhook } from "./onboarding-fee-cashfree-webhook";
import { finalizeContactPaymentRequestPaid } from "./contact-payment-finalize";

function verifyRazorpaySignature(raw: Buffer, signature: string | undefined, secret: string): boolean {
  if (!signature || !secret || !raw?.length) return false;
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  try {
    if (expected.length !== signature.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(signature, "utf8"));
  } catch {
    return false;
  }
}

export type ContactPaymentWebhookResult = "ok" | "invalid_signature";

export async function handleRazorpayContactPaymentWebhook(
  body: Record<string, unknown>,
  rawBody: Buffer | undefined,
  headerSignature: string | undefined
): Promise<ContactPaymentWebhookResult> {
  const event = typeof body.event === "string" ? body.event : "";
  if (event !== "payment_link.paid") return "ok";

  const payload = body.payload as Record<string, { entity?: Record<string, unknown> }> | undefined;
  const plEntity = payload?.payment_link?.entity as { id?: string } | undefined;
  const payEntity = payload?.payment?.entity as { id?: string } | undefined;
  const linkId = plEntity?.id;
  if (!linkId || typeof linkId !== "string") return "ok";

  const [reqRow] = await db
    .select()
    .from(contactPaymentRequests)
    .where(and(eq(contactPaymentRequests.gateway, "razorpay"), eq(contactPaymentRequests.gatewayLinkId, linkId)))
    .limit(1);
  if (!reqRow) return "ok";
  if (reqRow.status !== "pending") return "ok";

  if (reqRow.integrationId) {
    const integ = await storage.getIntegrationById(reqRow.integrationId);
    const creds = (integ?.credentials || {}) as Record<string, string>;
    const whSecret = creds.webhookSecret || creds.webhook_secret;
    if (whSecret && rawBody?.length) {
      if (!verifyRazorpaySignature(rawBody, headerSignature, whSecret)) {
        console.warn("[Razorpay webhook] signature mismatch for contact payment", linkId);
        return "invalid_signature";
      }
    }
  }

  const payId = typeof payEntity?.id === "string" ? payEntity.id : null;
  await finalizeContactPaymentRequestPaid(reqRow.id, payId);
  return "ok";
}

export async function handleCashfreeContactPaymentWebhook(
  body: Record<string, unknown>,
  rawBody: Buffer | undefined,
  headerSignature: string | undefined
): Promise<ContactPaymentWebhookResult> {
  const data = (body.data || body) as Record<string, unknown>;
  const linkId =
    (typeof data.link_id === "string" && data.link_id) ||
    (typeof data.linkId === "string" && data.linkId) ||
    (typeof (data.order as Record<string, unknown> | undefined)?.link_id === "string"
      ? String((data.order as Record<string, unknown>).link_id)
      : "");
  if (!linkId) return "ok";

  const type = String(body.type || data.type || "");
  const order = data.order as Record<string, unknown> | undefined;
  const txOk = String(order?.transaction_status || "").toUpperCase() === "SUCCESS";
  const typeOk =
    type.toUpperCase().includes("PAYMENT") &&
    (type.toUpperCase().includes("SUCCESS") || type.toUpperCase().includes("PAID") || txOk);
  if (!typeOk && !txOk) return "ok";

  const [reqRow] = await db
    .select()
    .from(contactPaymentRequests)
    .where(and(eq(contactPaymentRequests.gateway, "cashfree"), eq(contactPaymentRequests.gatewayLinkId, linkId)))
    .limit(1);
  if (reqRow) {
    if (reqRow.status !== "pending") return "ok";
    if (reqRow.integrationId) {
      const integ = await storage.getIntegrationById(reqRow.integrationId);
      const creds = (integ?.credentials || {}) as Record<string, string>;
      const whSecret = creds.webhookSecret || creds.webhook_secret;
      if (whSecret && rawBody?.length && headerSignature) {
        const expected = crypto.createHmac("sha256", whSecret).update(rawBody).digest("base64");
        if (expected !== headerSignature) {
          console.warn("[Cashfree webhook] signature mismatch for contact payment", linkId);
          return "invalid_signature";
        }
      }
    }

    const payId =
      (typeof data.cf_payment_id === "string" && data.cf_payment_id) ||
      (typeof data.payment_id === "string" && data.payment_id) ||
      null;
    await finalizeContactPaymentRequestPaid(reqRow.id, payId);
    return "ok";
  }

  const ob = await handleCashfreeWhitelabelOnboardingWebhook(linkId, data, rawBody, headerSignature);
  if (ob === "invalid_signature") return "invalid_signature";
  return "ok";
}
