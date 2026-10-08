import type { Express, Request, Response } from "express";
import { isAuthenticated } from "../../replitAuth";
import { resolveOrganizationContext } from "../../middleware/organization-context";
import {
  handleRazorpayContactPaymentWebhook,
  handleCashfreeContactPaymentWebhook,
} from "../../payments/contact-payment-webhooks";

/**
 * Payment gateway helpers and webhooks (Razorpay / Cashfree).
 * Webhooks are public; signature verification and WhatsApp receipts will plug in when payment-link records exist.
 */
export function registerPaymentGatewayRoutes(app: Express) {
  const baseUrl = (req: Request) => {
    const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
    const host = req.get("host") || "localhost";
    return `${proto}://${host}`;
  };

  app.get(
    "/api/integrations/payment-gateways/setup-info",
    isAuthenticated,
    resolveOrganizationContext,
    async (req: Request, res: Response) => {
      const root = baseUrl(req);
      res.json({
        razorpayWebhookUrl: `${root}/api/webhooks/payments/razorpay`,
        /** Customer panel subscription renewals (whitelabel admin Razorpay account only). */
        razorpaySubscriptionWebhookUrl: `${root}/api/webhooks/razorpay`,
        /** Customer panel Stripe checkout completion (whitelabel admin Stripe account only). */
        stripeSubscriptionWebhookUrl: `${root}/api/webhooks/stripe`,
        cashfreeWebhookUrl: `${root}/api/webhooks/payments/cashfree`,
        notes: [
          "Contact payment links: use razorpayWebhookUrl; store the signing secret on the integration.",
          "Panel subscription billing uses the whitelabel admin (SaaS owner) gateway integrations with “Organization subscription billing” enabled — not platform .env. Razorpay: add razorpaySubscriptionWebhookUrl and paste that webhook secret. Stripe: add stripeSubscriptionWebhookUrl and paste the signing secret (whsec_…).",
          "Cashfree: use cashfreeWebhookUrl for contact links as needed.",
        ],
      });
    }
  );

  app.post("/api/webhooks/payments/razorpay", async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
      const sig = req.headers["x-razorpay-signature"] as string | undefined;
      const result = await handleRazorpayContactPaymentWebhook(body, rawBody, sig);
      if (result === "invalid_signature") {
        return res.status(400).json({ received: false });
      }
      res.status(200).json({ received: true });
    } catch (e: unknown) {
      console.error("[Razorpay webhook]", e);
      res.status(500).json({ received: false });
    }
  });

  app.post("/api/webhooks/payments/cashfree", async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
      const sigHeader =
        (req.headers["x-webhook-signature"] as string | undefined) ||
        (req.headers["x-cashfree-signature"] as string | undefined);
      const result = await handleCashfreeContactPaymentWebhook(body, rawBody, sigHeader);
      if (result === "invalid_signature") {
        return res.status(400).json({ received: false });
      }
      res.status(200).json({ received: true });
    } catch (e: unknown) {
      console.error("[Cashfree webhook]", e);
      res.status(500).json({ received: false });
    }
  });
}
