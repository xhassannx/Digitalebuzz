import { storage } from "../storage";
import { businessAPIManager } from "../whatsapp/business-api-client";
import { resolveOrganizationIdForSession } from "../opt-keyword-service";
import { resolveOfficialCredentialsForSession } from "./session-credentials";
import {
  createWaPayOrder,
  findWaPayOrderByReference,
  formatWaPayAmountInr,
  getWaPayOrderById,
  updateWaPayOrder,
} from "./wa-pay-order-store";
import {
  lookupWhatsAppPayment,
  sendWhatsAppOrderStatusMessage,
  type WaPayOrderStatusValue,
} from "./wa-pay-meta-api";

type PaymentWebhookStatus = {
  id?: string;
  recipient_id?: string;
  type?: string;
  status?: string;
  timestamp?: string;
  payment?: {
    reference_id?: string;
    amount?: { value?: number; offset?: number };
    currency?: string;
    transaction?: {
      id?: string;
      pg_transaction_id?: string;
      type?: string;
      status?: string;
      method?: { type?: string };
    };
  };
};

function mapPaymentStatus(raw: string | undefined): "pending" | "captured" | "failed" {
  const s = String(raw || "").toLowerCase();
  if (s === "captured" || s === "success") return "captured";
  if (s === "failed") return "failed";
  return "pending";
}

async function sessionCredsForWaPay(sessionId: string) {
  const session = await storage.getSession(sessionId);
  if (!session) return null;
  const organizationId = await resolveOrganizationIdForSession(session);
  const creds = await resolveOfficialCredentialsForSession(
    sessionId,
    session.userId,
    organizationId
  );
  if (!creds?.accessToken || !creds.phoneNumberId) return null;
  return { session, creds };
}

async function confirmPaymentViaLookup(
  creds: { accessToken: string; phoneNumberId: string },
  configName: string,
  referenceId: string
): Promise<"pending" | "captured" | "failed"> {
  try {
    const lookup = await lookupWhatsAppPayment(
      creds.accessToken,
      creds.phoneNumberId,
      configName,
      referenceId
    );
    return mapPaymentStatus(lookup.status);
  } catch (e: unknown) {
    console.warn(
      "[WA Pay] Payment lookup failed:",
      e instanceof Error ? e.message : e
    );
    return "pending";
  }
}

async function sendPostPaymentUpdates(opts: {
  sessionId: string;
  customerWaId: string;
  referenceId: string;
  amountMinor: number;
  orderStatus: WaPayOrderStatusValue;
  bodyText: string;
}): Promise<void> {
  const ctx = await sessionCredsForWaPay(opts.sessionId);
  if (!ctx) return;

  const amountLabel = formatWaPayAmountInr(opts.amountMinor);

  if (businessAPIManager.isClientReady(opts.sessionId)) {
    await businessAPIManager.sendTextMessage(
      opts.sessionId,
      opts.customerWaId,
      `Thank you! We received your payment of ${amountLabel}. Reference: ${opts.referenceId}. Your order is being processed.`
    );
  }

  await sendWhatsAppOrderStatusMessage({
    accessToken: ctx.creds.accessToken,
    phoneNumberId: ctx.creds.phoneNumberId,
    to: opts.customerWaId,
    referenceId: opts.referenceId,
    orderStatus: opts.orderStatus,
    bodyText: opts.bodyText,
    description: `Payment received — ${amountLabel}`,
  });
}

/**
 * Meta Step 4: statuses[].type === "payment"
 * Step 5: verify via payment lookup API
 * Step 6: send order_status processing on capture
 */
export async function handleWhatsAppPaymentStatusWebhook(
  status: PaymentWebhookStatus,
  metadata: { phone_number_id?: string; display_phone_number?: string },
  sessionIds: string[]
): Promise<void> {
  if (status.type !== "payment" || !status.payment?.reference_id) return;

  const referenceId = String(status.payment.reference_id).trim();
  const webhookPaymentStatus = mapPaymentStatus(status.status);
  const txn = status.payment.transaction;

  let order = await findWaPayOrderByReference(referenceId);
  if (!order) {
    console.warn(`[WA Pay] Payment webhook for unknown reference_id=${referenceId}`);
    return;
  }

  const matchingSessionId = sessionIds.includes(order.sessionId)
    ? order.sessionId
    : sessionIds[0];
  if (!matchingSessionId) return;

  const ctx = await sessionCredsForWaPay(matchingSessionId);
  if (!ctx) {
    console.warn("[WA Pay] Could not load session creds for payment webhook");
    return;
  }

  let paymentStatus = webhookPaymentStatus;
  if (webhookPaymentStatus === "captured" || webhookPaymentStatus === "pending") {
    const lookedUp = await confirmPaymentViaLookup(
      ctx.creds,
      order.paymentConfigurationName,
      referenceId
    );
    if (lookedUp === "captured") paymentStatus = "captured";
    else if (lookedUp === "failed" && webhookPaymentStatus !== "captured") {
      paymentStatus = "failed";
    }
  }

  const patch = {
    paymentStatus,
    pgOrderId: txn?.id || order.pgOrderId || undefined,
    pgTransactionId: txn?.pg_transaction_id || order.pgTransactionId || undefined,
    paymentMethod: txn?.method?.type || order.paymentMethod || undefined,
    lastPaymentPayload: status as unknown as Record<string, unknown>,
    paidAt: paymentStatus === "captured" ? new Date() : order.paidAt || undefined,
  };

  order = (await updateWaPayOrder(order.id, patch)) || order;

  console.log(
    `[WA Pay] Payment ${referenceId} → ${paymentStatus} (webhook=${webhookPaymentStatus})`
  );

  if (paymentStatus !== "captured") return;
  if (order.orderStatus !== "pending") return;

  await updateWaPayOrder(order.id, {
    orderStatus: "processing",
  });

  try {
    await sendPostPaymentUpdates({
      sessionId: order.sessionId,
      customerWaId: order.customerWaId,
      referenceId: order.referenceId,
      amountMinor: order.amountMinor,
      orderStatus: "processing",
      bodyText: "Your order is confirmed and being processed.",
    });
  } catch (e: unknown) {
    console.warn(
      "[WA Pay] Post-payment order_status failed:",
      e instanceof Error ? e.message : e
    );
  }
}

/** Manual / API order status update with Meta order_status message. */
export async function sendWaPayOrderStatusUpdate(opts: {
  organizationId: string;
  orderId: string;
  orderStatus: WaPayOrderStatusValue;
  bodyText?: string;
  description?: string;
}): Promise<{ success: boolean }> {
  const order = await getWaPayOrderById(opts.organizationId, opts.orderId);
  if (!order) throw new Error("WA Pay order not found");

  const ctx = await sessionCredsForWaPay(order.sessionId);
  if (!ctx) throw new Error("WhatsApp session not available");

  await sendWhatsAppOrderStatusMessage({
    accessToken: ctx.creds.accessToken,
    phoneNumberId: ctx.creds.phoneNumberId,
    to: order.customerWaId,
    referenceId: order.referenceId,
    orderStatus: opts.orderStatus,
    bodyText: opts.bodyText || `Order update: ${opts.orderStatus.replace(/_/g, " ")}`,
    description: opts.description,
  });

  await updateWaPayOrder(order.id, { orderStatus: opts.orderStatus });
  return { success: true };
}
