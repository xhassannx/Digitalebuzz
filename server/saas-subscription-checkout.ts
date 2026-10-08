// @ts-nocheck
import type { Payment } from "@shared/schema";
import { storage } from "./storage";
import { resolveSaasSubscriptionRazorpay, resolveSaasSubscriptionStripe } from "./payment";
import {
  planPriceMinorToRazorpayPaise,
  normalizeSaasBillingCycle,
  razorpayOrderReceipt,
  razorpaySubscriptionConfigForBillingCycle,
} from "./payments/payment-amount";
import { computePlanCheckoutBreakdown } from "@shared/plan-pricing";

export type BillingCycle = "monthly" | "quarterly" | "yearly";

/** Free (₹0) plans cannot be self-assigned after expiry — only paid renewal/upgrade. */
async function assertFreePlanAssignable(userId: string): Promise<void> {
  const active = await storage.getActiveSubscriptionByUser(userId);
  if (!active) {
    throw Object.assign(
      new Error(
        "Free plan is not available after your subscription has expired. Please choose a paid plan to continue."
      ),
      { statusCode: 400 }
    );
  }
}

/**
 * Shared SaaS subscription checkout (Razorpay INR / recurring) used by authenticated billing and public /subscribe.
 */
export async function performSaasRazorpaySubscriptionCheckout(
  userId: string,
  planId: string,
  billingCycle: string
): Promise<Record<string, unknown>> {
  const resolved = await resolveSaasSubscriptionRazorpay();
  const rz = resolved.client;
  const saasKeyId = resolved.keyId;

  const plan = await storage.getPlan(planId);
  if (!plan) {
    throw Object.assign(new Error("Plan not found"), { statusCode: 404 });
  }

  const cycle = normalizeSaasBillingCycle(billingCycle);
  if (!cycle) {
    throw Object.assign(
      new Error(`Invalid billing cycle: ${billingCycle}. Use monthly, quarterly, or yearly.`),
      { statusCode: 400 }
    );
  }
  billingCycle = cycle;

  const planCurrency = (plan.currency || "INR").toUpperCase();
  const pricing = computePlanCheckoutBreakdown(plan, billingCycle);
  const amountPlanMinor = pricing.totalMinor;

  if (amountPlanMinor === 0) {
    await assertFreePlanAssignable(userId);
    const startDate = new Date();
    const endDate = new Date(startDate);
    if (billingCycle === "monthly") endDate.setMonth(endDate.getMonth() + 1);
    else if (billingCycle === "quarterly") endDate.setMonth(endDate.getMonth() + 3);
    else endDate.setFullYear(endDate.getFullYear() + 1);

    const subscription = await storage.createSubscription({
      userId,
      planId,
      status: "active",
      billingCycle: billingCycle as BillingCycle,
      currentPeriodStart: startDate,
      currentPeriodEnd: endDate,
    });

    return { subscription, requiresPayment: false };
  }

  const amountInrPaise = Math.round(planPriceMinorToRazorpayPaise(amountPlanMinor, planCurrency));
  const amountInrMajor = amountInrPaise / 100;

  if (!Number.isFinite(amountInrPaise) || amountInrPaise < 100) {
    throw Object.assign(
      new Error(
        `Invalid Razorpay charge amount (${amountInrPaise} paise). Minimum is ₹1.00 (100 paise). Check plan price, GST, and fees.`
      ),
      { statusCode: 400 }
    );
  }

  console.log(
    `[Razorpay] Plan charge: ${plan.displayName} ${billingCycle} — ` +
      `base=${pricing.baseMinor} svc=${pricing.serviceChargeMinor} gst=${pricing.gstMinor} (${pricing.gstType}) ` +
      `total=₹${amountInrMajor.toFixed(2)} (${amountInrPaise} paise), currency=${planCurrency}, minor=${amountPlanMinor}`
  );

  const rzBilling = razorpaySubscriptionConfigForBillingCycle(billingCycle);
  const { period, interval, totalCount } = rzBilling;

  console.log(
    `[Razorpay] Billing cycle ${billingCycle}: plan period=${period}, interval=${interval}, total_count=${totalCount}`
  );

  let razorpayPlan;
  try {
    razorpayPlan = await rz.createPlan({
      period,
      interval,
      item: {
        name: `${plan.displayName} - ${billingCycle.charAt(0).toUpperCase() + billingCycle.slice(1)}`,
        amount: amountInrPaise,
        currency: "INR",
        description: plan.description || `${plan.displayName} subscription plan`,
      },
      notes: {
        planId,
        billingCycle,
        amountInr: amountInrMajor.toFixed(2),
        planCurrency,
        amountPlanMinor: String(amountPlanMinor),
        baseMinor: String(pricing.baseMinor),
        serviceChargeMinor: String(pricing.serviceChargeMinor),
        gstMinor: String(pricing.gstMinor),
        gstType: pricing.gstType,
        currency: "INR",
      },
    });
    console.log(`[Razorpay] Created plan: ${razorpayPlan.id}`);
  } catch (error: any) {
    const errorDetails = error.error?.description || error.error?.message || error.message || JSON.stringify(error);
    console.warn(`[Razorpay] Plan creation failed, using order-based approach:`, errorDetails);

    let order;
    try {
      order = await rz.createOrder({
        amount: amountInrPaise,
        currency: "INR",
        receipt: razorpayOrderReceipt("sub_"),
        notes: {
          userId,
          planId,
          billingCycle,
          amountInr: amountInrMajor.toFixed(2),
          planCurrency,
          baseMinor: String(pricing.baseMinor),
          serviceChargeMinor: String(pricing.serviceChargeMinor),
          gstMinor: String(pricing.gstMinor),
          gstType: pricing.gstType,
          currency: "INR",
          isSubscription: "true",
        },
      });
    } catch (orderError: any) {
      const orderErr =
        orderError?.error?.description ||
        orderError?.error?.message ||
        orderError?.message ||
        String(orderError);
      throw new Error(
        `Razorpay checkout failed. Plan: ${errorDetails}. Order fallback: ${orderErr}`
      );
    }

    const startDate = new Date();
    const endDate = new Date(startDate);
    if (billingCycle === "monthly") endDate.setMonth(endDate.getMonth() + 1);
    else if (billingCycle === "quarterly") endDate.setMonth(endDate.getMonth() + 3);
    else endDate.setFullYear(endDate.getFullYear() + 1);

    const subscription = await storage.createSubscription({
      userId,
      planId,
      status: "pending",
      billingCycle: billingCycle as BillingCycle,
      currentPeriodStart: startDate,
      currentPeriodEnd: endDate,
      paymentGateway: "razorpay",
    });

    await storage.createPayment({
      subscriptionId: subscription.id,
      userId,
      amount: amountInrPaise,
      currency: "INR",
      status: "pending",
      paymentGateway: "razorpay",
      gatewayOrderId: order.id,
      metadata: {
        isRecurring: true,
        billingCycle,
        pricingBreakdown: pricing,
      },
    });

    return {
      order,
      dbSubscription: subscription,
      keyId: saasKeyId,
      requiresPayment: true,
      chargeAmountInr: amountInrMajor,
      chargeAmountInrPaise: amountInrPaise,
      note: "Recurring payments will be handled via webhooks after first payment",
    };
  }

  if (!razorpayPlan?.id) {
    throw new Error("Failed to create Razorpay plan: Plan ID is missing");
  }

  let razorpaySubscription;
  try {
    console.log(`[Razorpay] Creating subscription with plan_id: ${razorpayPlan.id}`);
    const subscriptionOptions: Record<string, unknown> = {
      plan_id: razorpayPlan.id,
      customer_notify: 1,
      total_count: totalCount,
      notes: {
        userId,
        planId,
        billingCycle,
        amountInr: amountInrMajor.toFixed(2),
        planCurrency,
        baseMinor: String(pricing.baseMinor),
        serviceChargeMinor: String(pricing.serviceChargeMinor),
        gstMinor: String(pricing.gstMinor),
        gstType: pricing.gstType,
        currency: "INR",
      },
    };
    razorpaySubscription = await rz.createSubscription(subscriptionOptions);
    console.log(`[Razorpay] Created subscription: ${razorpaySubscription.id}`);
  } catch (subscriptionError: any) {
    console.error(`[Razorpay] Subscription creation failed:`, subscriptionError);
    const errorDetails =
      subscriptionError.error?.description ||
      subscriptionError.error?.message ||
      subscriptionError.message ||
      subscriptionError.toString() ||
      JSON.stringify(subscriptionError);
    throw new Error(`Failed to create Razorpay subscription: ${errorDetails}`);
  }

  const startDate = new Date();
  const endDate = new Date(startDate);
  if (billingCycle === "monthly") endDate.setMonth(endDate.getMonth() + 1);
  else if (billingCycle === "quarterly") endDate.setMonth(endDate.getMonth() + 3);
  else endDate.setFullYear(endDate.getFullYear() + 1);

  const subscription = await storage.createSubscription({
    userId,
    planId,
    status: "pending",
    billingCycle: billingCycle as BillingCycle,
    currentPeriodStart: startDate,
    currentPeriodEnd: endDate,
    paymentGateway: "razorpay",
    gatewaySubscriptionId: razorpaySubscription.id,
  });

  await storage.createPayment({
    subscriptionId: subscription.id,
    userId,
    amount: amountInrPaise,
    currency: "INR",
    status: "pending",
    paymentGateway: "razorpay",
    gatewayOrderId: razorpaySubscription.id,
    metadata: {
      razorpaySubscriptionId: razorpaySubscription.id,
      razorpayPlanId: razorpayPlan.id,
      pricingBreakdown: pricing,
    },
  });

  return {
    subscription: razorpaySubscription,
    dbSubscription: subscription,
    keyId: saasKeyId,
    requiresPayment: true,
    chargeAmountInr: amountInrMajor,
    chargeAmountInrPaise: amountInrPaise,
  };
}

export async function performSaasStripeSubscriptionCheckout(
  userId: string,
  planId: string,
  billingCycle: string,
  appBaseUrl: string,
  urls?: { successUrl?: string; cancelUrl?: string }
): Promise<Record<string, unknown>> {
  const { client: stripeSubClient } = await resolveSaasSubscriptionStripe();

  const plan = await storage.getPlan(planId);
  if (!plan) {
    throw Object.assign(new Error("Plan not found"), { statusCode: 404 });
  }

  const user = await storage.getUser(userId);
  if (!user) {
    throw Object.assign(new Error("User not found"), { statusCode: 404 });
  }

  const cycle = normalizeSaasBillingCycle(billingCycle);
  if (!cycle) {
    throw Object.assign(new Error(`Invalid billing cycle: ${billingCycle}`), { statusCode: 400 });
  }
  billingCycle = cycle;

  const pricing = computePlanCheckoutBreakdown(plan, billingCycle);
  const amount = pricing.totalMinor;

  if (amount === 0) {
    await assertFreePlanAssignable(userId);
    const startDate = new Date();
    const endDate = new Date(startDate);
    if (billingCycle === "monthly") endDate.setMonth(endDate.getMonth() + 1);
    else if (billingCycle === "quarterly") endDate.setMonth(endDate.getMonth() + 3);
    else endDate.setFullYear(endDate.getFullYear() + 1);

    const subscription = await storage.createSubscription({
      userId,
      planId,
      status: "active",
      billingCycle: billingCycle as BillingCycle,
      currentPeriodStart: startDate,
      currentPeriodEnd: endDate,
    });

    return { subscription, requiresPayment: false };
  }

  const base = appBaseUrl.replace(/\/+$/, "");
  const successUrl = urls?.successUrl ?? `${base}/subscribe?payment=success`;
  const cancelUrl = urls?.cancelUrl ?? `${base}/subscribe?payment=cancelled`;
  const session = await stripeSubClient.createCheckoutSession({
    amount,
    currency: "usd",
    customerEmail: user.email || undefined,
    successUrl,
    cancelUrl,
    metadata: {
      userId,
      planId,
      billingCycle,
      baseMinor: String(pricing.baseMinor),
      serviceChargeMinor: String(pricing.serviceChargeMinor),
      gstMinor: String(pricing.gstMinor),
      gstType: pricing.gstType,
    },
    mode: "payment",
  });

  const startDate = new Date();
  const endDate = new Date(startDate);
  if (billingCycle === "monthly") endDate.setMonth(endDate.getMonth() + 1);
  else if (billingCycle === "quarterly") endDate.setMonth(endDate.getMonth() + 3);
  else endDate.setFullYear(endDate.getFullYear() + 1);

  const subscription = await storage.createSubscription({
    userId,
    planId,
    status: "pending",
    billingCycle: billingCycle as BillingCycle,
    currentPeriodStart: startDate,
    currentPeriodEnd: endDate,
    paymentGateway: "stripe",
    gatewaySubscriptionId: session.id,
  });

  await storage.createPayment({
    subscriptionId: subscription.id,
    userId,
    amount,
    currency: "USD",
    status: "pending",
    paymentGateway: "stripe",
    gatewayOrderId: session.id,
    metadata: { pricingBreakdown: pricing },
  });

  return { sessionId: session.id, url: session.url };
}

/**
 * Verify first Razorpay payment for SaaS subscription (panel billing or public /subscribe).
 * When `userId` is omitted, resolves the pending payment row by Razorpay order/subscription id (public checkout).
 */
export async function verifySaasRazorpaySubscriptionFirstPayment(opts: {
  userId?: string;
  razorpay_order_id?: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  razorpay_subscription_id?: string;
}): Promise<{ payment: Payment; invoiceDelivery?: Awaited<ReturnType<typeof import("./invoices/subscription-payment-invoice").deliverSubscriptionPaymentInvoice>> }> {
  const rz = (await resolveSaasSubscriptionRazorpay()).client;
  const {
    userId,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    razorpay_subscription_id,
  } = opts;

  let isValid = rz.verifyPaymentSignature({
    razorpay_order_id: razorpay_order_id || undefined,
    razorpay_subscription_id: razorpay_subscription_id || undefined,
    razorpay_payment_id,
    razorpay_signature,
  });

  if (!isValid) {
    console.warn("Signature verification failed, attempting to verify payment via Razorpay API...");
    try {
      const razorpayPayment = await rz.getPayment(razorpay_payment_id);
      if (razorpayPayment && razorpayPayment.status === "captured") {
        console.log("Payment verified via Razorpay API (signature verification failed but payment is valid)");
        isValid = true;
      } else {
        throw Object.assign(new Error("Invalid payment signature and payment not found or not captured"), {
          statusCode: 400,
        });
      }
    } catch (apiError: any) {
      if (apiError?.statusCode === 400) throw apiError;
      console.error("Error verifying payment via Razorpay API:", apiError);
      throw Object.assign(new Error("Invalid payment signature"), { statusCode: 400 });
    }
  }

  const orderId = razorpay_order_id || razorpay_subscription_id;
  let payment: Payment | undefined;

  if (userId) {
    const payments = await storage.getPaymentsByUser(userId);
    payment = payments.find(
      (p) =>
        p.gatewayOrderId === orderId ||
        (p.metadata as { razorpaySubscriptionId?: string })?.razorpaySubscriptionId === razorpay_subscription_id
    );
  }

  if (!payment && orderId) {
    payment = await storage.getPendingSaasPaymentByGatewayOrderId(orderId);
  }
  if (!payment && razorpay_subscription_id) {
    payment = await storage.getPendingSaasPaymentByGatewayOrderId(razorpay_subscription_id);
  }

  if (!payment) {
    throw Object.assign(new Error("Payment not found"), { statusCode: 404 });
  }

  const updatedPayment = await storage.updatePayment(payment.id, {
    status: "completed",
    gatewayPaymentId: razorpay_payment_id,
    gatewaySignature: razorpay_signature,
    completedAt: new Date(),
  });

  await storage.updateSubscription(payment.subscriptionId, {
    status: "active",
  });

  if (!updatedPayment) {
    throw Object.assign(new Error("Failed to update payment"), { statusCode: 500 });
  }

  let invoiceDelivery: Awaited<ReturnType<typeof import("./invoices/subscription-payment-invoice").deliverSubscriptionPaymentInvoice>> | undefined;
  try {
    const { deliverSubscriptionPaymentInvoice } = await import("./invoices/subscription-payment-invoice");
    invoiceDelivery = await deliverSubscriptionPaymentInvoice(updatedPayment.id);
  } catch (err) {
    console.error("[Subscription invoice] delivery error:", err);
  }

  return { payment: updatedPayment, invoiceDelivery };
}

/**
 * Pay SaaS plan from organization prepaid wallet (works for self_pay and credit_line).
 * Meta usage debits are separate; this is panel subscription only.
 */
export async function performSaasWalletSubscriptionCheckout(
  userId: string,
  planId: string,
  billingCycle: string,
  organizationId: string
): Promise<Record<string, unknown>> {
  const plan = await storage.getPlan(planId);
  if (!plan) {
    throw Object.assign(new Error("Plan not found"), { statusCode: 404 });
  }

  const cycle = normalizeSaasBillingCycle(billingCycle);
  if (!cycle) {
    throw Object.assign(
      new Error(`Invalid billing cycle: ${billingCycle}. Use monthly, quarterly, or yearly.`),
      { statusCode: 400 }
    );
  }

  const planCurrency = (plan.currency || "INR").toUpperCase();
  const pricing = computePlanCheckoutBreakdown(plan, cycle);
  const amountPlanMinor = pricing.totalMinor;

  if (amountPlanMinor === 0) {
    await assertFreePlanAssignable(userId);
    const startDate = new Date();
    const endDate = new Date(startDate);
    if (cycle === "monthly") endDate.setMonth(endDate.getMonth() + 1);
    else if (cycle === "quarterly") endDate.setMonth(endDate.getMonth() + 3);
    else endDate.setFullYear(endDate.getFullYear() + 1);

    const subscription = await storage.createSubscription({
      userId,
      planId,
      status: "active",
      billingCycle: cycle as BillingCycle,
      currentPeriodStart: startDate,
      currentPeriodEnd: endDate,
      paymentGateway: "wallet",
    });

    return { subscription, requiresPayment: false, paidVia: "wallet" };
  }

  if (planCurrency !== "INR") {
    throw Object.assign(
      new Error("Wallet checkout currently supports INR plans only. Use Razorpay/Stripe for other currencies."),
      { statusCode: 400 }
    );
  }

  const { debitWalletFixed, ensureOrganizationWallet, getOrganizationWallet } = await import("./wallet/wallet-db");
  await ensureOrganizationWallet(organizationId, "INR");
  const wallet = await getOrganizationWallet(organizationId);
  if (!wallet || wallet.balanceMinor < amountPlanMinor) {
    throw Object.assign(
      new Error(
        `Insufficient wallet balance. Need ₹${(amountPlanMinor / 100).toFixed(2)}, have ₹${((wallet?.balanceMinor || 0) / 100).toFixed(2)}. Reload wallet first.`
      ),
      { statusCode: 402, code: "WALLET_INSUFFICIENT" }
    );
  }

  const startDate = new Date();
  const endDate = new Date(startDate);
  if (cycle === "monthly") endDate.setMonth(endDate.getMonth() + 1);
  else if (cycle === "quarterly") endDate.setMonth(endDate.getMonth() + 3);
  else endDate.setFullYear(endDate.getFullYear() + 1);

  const subscription = await storage.createSubscription({
    userId,
    planId,
    status: "active",
    billingCycle: cycle as BillingCycle,
    currentPeriodStart: startDate,
    currentPeriodEnd: endDate,
    paymentGateway: "wallet",
  });

  const payment = await storage.createPayment({
    subscriptionId: subscription.id,
    userId,
    amount: amountPlanMinor,
    currency: "INR",
    status: "completed",
    paymentGateway: "wallet",
    gatewayPaymentId: `wallet_${subscription.id}`,
    completedAt: new Date(),
    metadata: {
      paidVia: "wallet",
      organizationId,
      billingCycle: cycle,
      pricingBreakdown: pricing,
    },
  });

  await debitWalletFixed({
    organizationId,
    type: "debit_subscription",
    amountMinor: amountPlanMinor,
    currency: "INR",
    description: `Subscription: ${plan.displayName} (${cycle})`,
    referenceType: "subscription",
    referenceId: subscription.id,
    createdByUserId: userId,
    metadata: {
      planId,
      paymentId: payment.id,
      pricingBreakdown: pricing,
    },
  });

  let invoiceDelivery: unknown;
  try {
    const { deliverSubscriptionPaymentInvoice } = await import("./invoices/subscription-payment-invoice");
    invoiceDelivery = await deliverSubscriptionPaymentInvoice(payment.id);
  } catch (err) {
    console.error("[Subscription invoice] wallet checkout delivery error:", err);
  }

  return {
    subscription,
    payment,
    invoiceDelivery,
    requiresPayment: false,
    paidVia: "wallet",
    chargedMinor: amountPlanMinor,
  };
}
