import Stripe from "stripe";

export interface StripeCheckoutSessionOptions {
  priceId?: string;
  amount?: number; // in cents
  currency: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
  mode?: "payment" | "subscription";
}

export class StripeClient {
  private client: Stripe | null = null;
  private webhookSecret: string | null = null;

  /** Credentials come from the whitelabel admin Stripe integration — not from environment variables. */
  constructor(explicitKeys?: { secretKey: string; webhookSecret?: string }) {
    if (explicitKeys?.secretKey) {
      this.client = new Stripe(explicitKeys.secretKey);
      this.webhookSecret = explicitKeys.webhookSecret?.trim() || null;
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async createCheckoutSession(options: StripeCheckoutSessionOptions) {
    if (!this.client) {
      throw new Error("Stripe not configured");
    }

    try {
      const sessionConfig: Stripe.Checkout.SessionCreateParams = {
        mode: options.mode || "payment",
        success_url: options.successUrl,
        cancel_url: options.cancelUrl,
        customer_email: options.customerEmail,
        metadata: options.metadata,
        line_items: [],
      };

      if (options.priceId) {
        sessionConfig.line_items = [
          {
            price: options.priceId,
            quantity: 1,
          },
        ];
      } else if (options.amount) {
        sessionConfig.line_items = [
          {
            price_data: {
              currency: options.currency,
              product_data: {
                name: "WhatsApp SaaS Subscription",
              },
              unit_amount: options.amount,
            },
            quantity: 1,
          },
        ];
      }

      const session = await this.client.checkout.sessions.create(sessionConfig);
      return session;
    } catch (error: any) {
      console.error("Stripe checkout session creation error:", error);
      throw new Error(`Failed to create Stripe checkout session: ${error.message}`);
    }
  }

  async getCheckoutSession(sessionId: string) {
    if (!this.client) {
      throw new Error("Stripe not configured");
    }

    try {
      const session = await this.client.checkout.sessions.retrieve(sessionId);
      return session;
    } catch (error: any) {
      console.error("Stripe session fetch error:", error);
      throw new Error(`Failed to fetch Stripe session: ${error.message}`);
    }
  }

  async constructWebhookEvent(payload: string | Buffer, signature: string) {
    if (!this.client) {
      throw new Error("Stripe not configured");
    }
    if (!this.webhookSecret) {
      throw new Error("Stripe webhook signing secret not configured on the integration");
    }

    try {
      return this.client.webhooks.constructEvent(payload, signature, this.webhookSecret);
    } catch (error: any) {
      console.error("Stripe webhook verification error:", error);
      throw new Error(`Webhook signature verification failed: ${error.message}`);
    }
  }

  async createPaymentIntent(amount: number, currency: string, metadata?: Record<string, string>) {
    if (!this.client) {
      throw new Error("Stripe not configured");
    }

    try {
      const paymentIntent = await this.client.paymentIntents.create({
        amount,
        currency,
        metadata,
        automatic_payment_methods: {
          enabled: true,
        },
      });
      return paymentIntent;
    } catch (error: any) {
      console.error("Stripe payment intent creation error:", error);
      throw new Error(`Failed to create Stripe payment intent: ${error.message}`);
    }
  }
}

/** Unconfigured placeholder; subscription flows use {@link resolveSaasSubscriptionStripe} instead. */
export const stripeClient = new StripeClient();
