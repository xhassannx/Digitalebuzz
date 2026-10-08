// @ts-nocheck
import Razorpay from "razorpay";
import crypto from "crypto";

export interface RazorpayOrderOptions {
  amount: number; // in paise (smallest currency unit)
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface RazorpayPaymentVerification {
  razorpay_order_id?: string;
  razorpay_subscription_id?: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export class RazorpayClient {
  private client: Razorpay | null = null;
  private keySecret: string | null = null;

  /** Keys come from the whitelabel admin Razorpay integration only — not from environment variables. */
  constructor(explicitKeys?: { keyId: string; keySecret: string }) {
    if (explicitKeys?.keyId && explicitKeys?.keySecret) {
      this.client = new Razorpay({
        key_id: explicitKeys.keyId,
        key_secret: explicitKeys.keySecret,
      });
      this.keySecret = explicitKeys.keySecret;
    }
  }

  /** Razorpay webhook HMAC (use the signing secret from the Razorpay dashboard, not necessarily the API secret). */
  static verifyWebhookHmac(webhookBody: string, webhookSignature: string, secret: string): boolean {
    if (!secret || !webhookSignature) return false;
    try {
      const generated = crypto.createHmac("sha256", secret).update(webhookBody).digest("hex");
      return generated === webhookSignature;
    } catch (error: any) {
      console.error("Razorpay webhook HMAC error:", error);
      return false;
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  /** Lightweight API call to confirm key_id + key_secret are valid. */
  async verifyCredentials(): Promise<void> {
    if (!this.client) {
      throw new Error("Razorpay not configured");
    }

    try {
      await this.client.orders.all({ count: 1 });
    } catch (error: any) {
      console.error("Razorpay credential verification error:", error);
      const errorMessage =
        error?.error?.description ||
        error?.error?.message ||
        error?.message ||
        (typeof error === "string" ? error : JSON.stringify(error)) ||
        "Unknown Razorpay error";
      throw new Error(`Razorpay authentication failed: ${errorMessage}`);
    }
  }

  async createOrder(options: RazorpayOrderOptions) {
    if (!this.client) {
      throw new Error("Razorpay not configured");
    }

    try {
      const order = await this.client.orders.create(options);
      return order;
    } catch (error: any) {
      console.error("Razorpay order creation error:", error);
      const errorMessage =
        error?.error?.description ||
        error?.error?.message ||
        error?.message ||
        (typeof error === "string" ? error : JSON.stringify(error)) ||
        "Unknown Razorpay error";
      throw new Error(`Failed to create Razorpay order: ${errorMessage}`);
    }
  }

  verifyPaymentSignature(verification: RazorpayPaymentVerification): boolean {
    if (!this.keySecret) {
      throw new Error("Razorpay key secret not configured");
    }

    try {
      const { razorpay_order_id, razorpay_subscription_id, razorpay_payment_id, razorpay_signature } = verification;

      // For subscriptions, try both formats as Razorpay documentation is unclear
      // For orders, signature is: order_id|payment_id
      let signatureString: string;
      let isValid = false;
      
      if (razorpay_subscription_id) {
        // Try format 1: subscription_id|payment_id
        signatureString = `${razorpay_subscription_id}|${razorpay_payment_id}`;
        let generatedSignature = crypto
          .createHmac("sha256", this.keySecret)
          .update(signatureString)
          .digest("hex");
        
        if (generatedSignature === razorpay_signature) {
          isValid = true;
        } else {
          // Try format 2: payment_id|subscription_id (reversed)
          signatureString = `${razorpay_payment_id}|${razorpay_subscription_id}`;
          generatedSignature = crypto
            .createHmac("sha256", this.keySecret)
            .update(signatureString)
            .digest("hex");
          
          isValid = generatedSignature === razorpay_signature;
        }
      } else if (razorpay_order_id) {
        signatureString = `${razorpay_order_id}|${razorpay_payment_id}`;
        const generatedSignature = crypto
          .createHmac("sha256", this.keySecret)
          .update(signatureString)
          .digest("hex");
        
        isValid = generatedSignature === razorpay_signature;
      } else {
        console.error("Razorpay signature verification: Missing order_id or subscription_id");
        return false;
      }
      
      if (!isValid) {
        console.error("Razorpay signature mismatch:", {
          subscription_id: razorpay_subscription_id,
          payment_id: razorpay_payment_id,
          received: razorpay_signature,
          triedFormats: razorpay_subscription_id ? [
            `${razorpay_subscription_id}|${razorpay_payment_id}`,
            `${razorpay_payment_id}|${razorpay_subscription_id}`
          ] : [`${razorpay_order_id}|${razorpay_payment_id}`],
        });
      }

      return isValid;
    } catch (error: any) {
      console.error("Razorpay signature verification error:", error);
      return false;
    }
  }

  async getPayment(paymentId: string) {
    if (!this.client) {
      throw new Error("Razorpay not configured");
    }

    try {
      const payment = await this.client.payments.fetch(paymentId);
      return payment;
    } catch (error: any) {
      console.error("Razorpay payment fetch error:", error);
      throw new Error(`Failed to fetch Razorpay payment: ${error.message}`);
    }
  }

  async getOrder(orderId: string) {
    if (!this.client) {
      throw new Error("Razorpay not configured");
    }

    try {
      const order = await this.client.orders.fetch(orderId);
      return order;
    } catch (error: any) {
      console.error("Razorpay order fetch error:", error);
      throw new Error(`Failed to fetch Razorpay order: ${error.message}`);
    }
  }

  // Create Razorpay customer (optional, for better subscription management)
  async createCustomer(options: {
    name?: string;
    email?: string;
    contact?: string;
    notes?: Record<string, string>;
  }) {
    if (!this.client) {
      throw new Error("Razorpay not configured");
    }

    try {
      const customer = await this.client.customers.create(options);
      return customer;
    } catch (error: any) {
      console.error("Razorpay customer creation error:", error);
      const errorMessage = error.error?.description || error.error?.message || error.message || JSON.stringify(error);
      throw new Error(`Failed to create Razorpay customer: ${errorMessage}`);
    }
  }

  // Create Razorpay subscription (for recurring payments)
  async createSubscription(options: {
    plan_id: string;
    customer_notify?: number;
    total_count?: number; // Number of billing cycles (omit for infinite)
    start_at?: number; // Unix timestamp
    end_at?: number; // Unix timestamp for subscription end
    notes?: Record<string, string>;
    customer_id?: string; // Optional customer ID
  }) {
    if (!this.client) {
      throw new Error("Razorpay not configured");
    }

    try {
      // Filter out undefined values to avoid passing null/undefined to Razorpay
      const cleanOptions: any = {};
      if (options.plan_id) cleanOptions.plan_id = options.plan_id;
      if (options.customer_notify !== undefined) cleanOptions.customer_notify = options.customer_notify;
      if (options.total_count !== undefined) cleanOptions.total_count = options.total_count;
      if (options.start_at !== undefined) cleanOptions.start_at = options.start_at;
      if (options.end_at !== undefined) cleanOptions.end_at = options.end_at;
      if (options.notes) cleanOptions.notes = options.notes;
      if (options.customer_id) cleanOptions.customer_id = options.customer_id;
      
      console.log("[Razorpay] Creating subscription with options:", JSON.stringify(cleanOptions, null, 2));
      const subscription = await this.client.subscriptions.create(cleanOptions);
      console.log("[Razorpay] Subscription created successfully:", subscription.id);
      return subscription;
    } catch (error: any) {
      console.error("Razorpay subscription creation error - full error object:", JSON.stringify(error, null, 2));
      console.error("Razorpay subscription creation error - error.error:", error.error);
      console.error("Razorpay subscription creation error - error.message:", error.message);
      
      // Try to extract detailed error message
      let errorMessage = "Unknown error";
      if (error.error) {
        if (error.error.description) {
          errorMessage = error.error.description;
        } else if (error.error.message) {
          errorMessage = error.error.message;
        } else if (typeof error.error === 'string') {
          errorMessage = error.error;
        } else {
          errorMessage = JSON.stringify(error.error);
        }
      } else if (error.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else {
        errorMessage = JSON.stringify(error);
      }
      
      throw new Error(`Failed to create Razorpay subscription: ${errorMessage}`);
    }
  }

  // Fetch Razorpay subscription
  async getSubscription(subscriptionId: string) {
    if (!this.client) {
      throw new Error("Razorpay not configured");
    }

    try {
      const subscription = await this.client.subscriptions.fetch(subscriptionId);
      return subscription;
    } catch (error: any) {
      console.error("Razorpay subscription fetch error:", error);
      throw new Error(`Failed to fetch Razorpay subscription: ${error.message}`);
    }
  }

  // Cancel Razorpay subscription
  async cancelSubscription(subscriptionId: string, cancelAtCycleEnd: boolean = false) {
    if (!this.client) {
      throw new Error("Razorpay not configured");
    }

    try {
      const subscription = await this.client.subscriptions.cancel(subscriptionId, {
        cancel_at_cycle_end: cancelAtCycleEnd ? 1 : 0,
      });
      return subscription;
    } catch (error: any) {
      console.error("Razorpay subscription cancellation error:", error);
      throw new Error(`Failed to cancel Razorpay subscription: ${error.message}`);
    }
  }

  // Create Razorpay plan (for subscriptions)
  async createPlan(options: {
    period: 'monthly' | 'quarterly' | 'yearly' | 'daily' | 'weekly';
    interval: number;
    item: {
      name: string;
      amount: number; // in paise
      currency: string;
      description?: string;
    };
    notes?: Record<string, string>;
  }) {
    if (!this.client) {
      throw new Error("Razorpay not configured");
    }

    try {
      const plan = await this.client.plans.create(options);
      return plan;
    } catch (error: any) {
      console.error("Razorpay plan creation error:", error);
      const errorMessage = error.error?.description || error.error?.message || error.message || JSON.stringify(error);
      throw new Error(`Failed to create Razorpay plan: ${errorMessage}`);
    }
  }

  // Fetch all payments for a subscription (using payments API with subscription filter)
  async getSubscriptionPayments(subscriptionId: string) {
    if (!this.client) {
      throw new Error("Razorpay not configured");
    }

    try {
      // Fetch all payments and filter by subscription_id
      const allPayments = await this.client.payments.all({
        count: 100,
      });
      
      // Filter payments for this subscription
      const subscriptionPayments = allPayments.items?.filter(
        (payment: any) => payment.subscription_id === subscriptionId
      ) || [];
      
      return { items: subscriptionPayments, count: subscriptionPayments.length };
    } catch (error: any) {
      console.error("Razorpay subscription payments fetch error:", error);
      throw new Error(`Failed to fetch subscription payments: ${error.message}`);
    }
  }

  // Fetch all payments (with filters)
  async getAllPayments(options?: {
    from?: number; // Unix timestamp
    to?: number; // Unix timestamp
    count?: number;
    skip?: number;
  }) {
    if (!this.client) {
      throw new Error("Razorpay not configured");
    }

    try {
      const payments = await this.client.payments.all(options || {});
      return payments;
    } catch (error: any) {
      console.error("Razorpay payments fetch error:", error);
      throw new Error(`Failed to fetch payments: ${error.message}`);
    }
  }

  // Verify webhook signature (legacy: uses API key secret; prefer dashboard webhook secret via verifyWebhookHmac)
  verifyWebhookSignature(webhookBody: string, webhookSignature: string): boolean {
    if (!this.keySecret) {
      throw new Error("Razorpay key secret not configured");
    }
    return RazorpayClient.verifyWebhookHmac(webhookBody, webhookSignature, this.keySecret);
  }
}

export const razorpayClient = new RazorpayClient();
