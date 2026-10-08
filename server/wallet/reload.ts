import { resolveSaasSubscriptionRazorpay } from "../payment/saas-subscription-razorpay";
import { getWalletBillingConfig } from "./config";
import { createWalletReloadOrder, markWalletReloadOrderPaid } from "./wallet-db";
import { ensureOrganizationWallet } from "./wallet-db";

export async function createWalletReloadCheckout(params: {
  organizationId: string;
  userId: string;
  amountMinor: number;
}): Promise<Record<string, unknown>> {
  const config = await getWalletBillingConfig();
  if (!config.enabled) {
    throw Object.assign(new Error("Wallet billing is not enabled on this platform"), { statusCode: 403 });
  }
  const amountMinor = Math.round(params.amountMinor);
  if (amountMinor < 100) {
    throw Object.assign(new Error("Minimum reload is ₹1.00 (100 paise)"), { statusCode: 400 });
  }
  if (amountMinor > 5_000_000) {
    throw Object.assign(new Error("Maximum single reload is ₹50,000"), { statusCode: 400 });
  }

  const { client: rz, keyId } = await resolveSaasSubscriptionRazorpay();
  const currency = (config.currency || "INR").toUpperCase();
  await ensureOrganizationWallet(params.organizationId, currency);

  const receipt = `wallet_${params.organizationId.slice(0, 8)}_${Date.now()}`;
  const order = await rz.createOrder({
    amount: amountMinor,
    currency,
    receipt,
    notes: {
      purpose: "wallet_reload",
      organizationId: params.organizationId,
      userId: params.userId,
    },
  });

  await createWalletReloadOrder({
    organizationId: params.organizationId,
    userId: params.userId,
    amountMinor,
    currency,
    gatewayOrderId: order.id,
  });

  return {
    requiresPayment: true,
    keyId,
    order: {
      id: order.id,
      amount: order.amount,
      currency: order.currency,
    },
    amountMinor,
    currency,
  };
}

function isPaidPaymentStatus(status: string): boolean {
  return status === "captured" || status === "authorized";
}

/**
 * Confirm a Razorpay payment belongs to a wallet reload order (HMAC and/or API fetch).
 */
export async function assertWalletReloadPaymentPaid(params: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature?: string;
}): Promise<{ via: "hmac" | "api" }> {
  const orderId = String(params.razorpay_order_id || "").trim();
  const paymentId = String(params.razorpay_payment_id || "").trim();
  const signature = String(params.razorpay_signature || "").trim();
  if (!orderId || !paymentId) {
    throw Object.assign(new Error("Missing Razorpay order or payment id"), { statusCode: 400 });
  }

  const { client: rz } = await resolveSaasSubscriptionRazorpay();

  if (signature) {
    const hmacOk = rz.verifyPaymentSignature({
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    });
    if (hmacOk) return { via: "hmac" };
    console.warn(
      "[Wallet Reload] HMAC mismatch — falling back to Razorpay payment fetch",
      orderId,
      paymentId,
    );
  }

  try {
    const payment = await rz.getPayment(paymentId);
    const status = String(payment?.status || "");
    const paymentOrderId = String(payment?.order_id || "");
    const notes = (payment?.notes || {}) as Record<string, string>;
    const purposeOk = String(notes.purpose || "") === "wallet_reload";
    const orderOk = paymentOrderId === orderId;

    if (isPaidPaymentStatus(status) && (orderOk || purposeOk)) {
      if (!orderOk) {
        console.warn(
          "[Wallet Reload] Payment order_id mismatch but notes.purpose=wallet_reload; accepting",
          { expected: orderId, got: paymentOrderId, paymentId },
        );
      }
      return { via: "api" };
    }

    console.error("[Wallet Reload] Payment not acceptable:", {
      paymentId,
      status,
      paymentOrderId,
      expectedOrderId: orderId,
      purpose: notes.purpose,
    });
  } catch (apiErr: any) {
    console.error("[Wallet Reload] Razorpay API payment fetch failed:", apiErr?.message || apiErr);
  }

  throw Object.assign(new Error("Invalid payment signature"), { statusCode: 400 });
}

export async function verifyWalletReloadPayment(params: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<{ success: boolean; balanceMinor?: number; verifiedVia?: string }> {
  const checked = await assertWalletReloadPaymentPaid(params);

  const tx = await markWalletReloadOrderPaid(
    String(params.razorpay_order_id).trim(),
    String(params.razorpay_payment_id).trim(),
    {
      verifiedAt: new Date().toISOString(),
      verifiedVia: checked.via,
    }
  );
  if (!tx) {
    throw Object.assign(new Error("Reload order not found"), { statusCode: 404 });
  }
  return { success: true, balanceMinor: tx.balanceAfterMinor, verifiedVia: checked.via };
}

/**
 * Admin recovery: credit a pending reload after Razorpay capture when client verify failed.
 */
export async function adminCompleteWalletReload(params: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature?: string;
}): Promise<{ success: boolean; balanceMinor?: number; verifiedVia?: string }> {
  return verifyWalletReloadPayment({
    razorpay_order_id: params.razorpay_order_id,
    razorpay_payment_id: params.razorpay_payment_id,
    razorpay_signature: params.razorpay_signature || "",
  });
}

export async function handleWalletReloadWebhookPayment(payment: {
  id: string;
  order_id?: string;
  amount?: number;
  currency?: string;
  status?: string;
  notes?: Record<string, string>;
}): Promise<boolean> {
  const orderId = payment.order_id;
  if (!orderId) return false;
  const purpose = payment.notes?.purpose;
  if (purpose !== "wallet_reload") return false;
  if (payment.status && !isPaidPaymentStatus(String(payment.status))) return false;
  await markWalletReloadOrderPaid(orderId, payment.id, payment as Record<string, unknown>);
  return true;
}
