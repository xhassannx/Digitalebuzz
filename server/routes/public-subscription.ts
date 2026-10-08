import type { Express } from "express";
import crypto from "crypto";
import { rateLimitMiddleware } from "../middleware/rate-limiter";
import { storage } from "../storage";
import {
  publicSubscriptionCheckoutSchema,
  publicRazorpaySubscriptionVerifySchema,
} from "@shared/schema";
import {
  performSaasRazorpaySubscriptionCheckout,
  performSaasStripeSubscriptionCheckout,
  verifySaasRazorpaySubscriptionFirstPayment,
} from "../saas-subscription-checkout";
import { resolveSaasSubscriptionRazorpay, resolveSaasSubscriptionStripe } from "../payment";

function publicAppBaseUrl(req: any): string {
  const fromEnv = (process.env.BASE_URL || "").split(/\s*[\n#]/)[0].trim().replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  return `${req.protocol}://${req.get("host")}`;
}

async function ensureOwnerOrganization(userId: string, organizationName: string): Promise<void> {
  const orgs = await storage.getOrganizationsByUser(userId);
  if (orgs.length > 0) return;
  const organization = await storage.createOrganization({
    name: organizationName.trim() || "My organization",
    ownerId: userId,
  });
  await storage.addOrganizationMember({
    organizationId: organization.id,
    userId,
    role: "owner",
  });
}

/**
 * Public subscription purchase (no login). Registered before customer-status middleware so licensor gates do not block marketing checkout.
 */
export function registerPublicSubscriptionRoutes(app: Express): void {
  app.get("/api/public/plans", rateLimitMiddleware, async (_req, res) => {
    try {
      const plans = await storage.getActivePlans();
      res.json(plans);
    } catch (e: any) {
      console.error("[public/plans]", e);
      res.status(500).json({ error: e?.message || "Failed to load plans" });
    }
  });

  app.get("/api/public/subscription-billing-options", rateLimitMiddleware, async (_req, res) => {
    let razorpay = false;
    let stripe = false;
    try {
      await resolveSaasSubscriptionRazorpay();
      razorpay = true;
    } catch {
      /* not configured */
    }
    try {
      await resolveSaasSubscriptionStripe();
      stripe = true;
    } catch {
      /* not configured */
    }
    res.json({ razorpay, stripe });
  });

  app.post("/api/public/subscription-checkout", rateLimitMiddleware, async (req, res) => {
    try {
      const parsed = publicSubscriptionCheckoutSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: parsed.error.flatten(),
        });
      }
      const {
        email,
        password,
        firstName,
        lastName,
        organizationName,
        phone,
        planId,
        billingCycle,
        paymentGateway,
      } = parsed.data;

      const emailNorm = email.trim().toLowerCase();
      const existing = await storage.getUserByEmail(emailNorm);
      let userId: string;

      if (existing) {
        if (!existing.passwordHash) {
          return res.status(403).json({
            message:
              "This email uses social login. Sign in from the login page to manage billing, or use a different email for checkout.",
          });
        }
        const bcrypt = await import("bcryptjs");
        const ok = await bcrypt.compare(password, existing.passwordHash);
        if (!ok) {
          return res.status(401).json({ message: "Incorrect password for this email." });
        }
        userId = existing.id;
        await ensureOwnerOrganization(userId, organizationName);
        await storage.updateUser(userId, {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
        });
      } else {
        const bcrypt = await import("bcryptjs");
        const passwordHash = await bcrypt.hash(password, 10);
        userId = crypto.randomUUID();
        await storage.upsertUser({
          id: userId,
          email: emailNorm,
          passwordHash,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
        });
        const organization = await storage.createOrganization({
          name: organizationName.trim(),
          ownerId: userId,
        });
        await storage.addOrganizationMember({
          organizationId: organization.id,
          userId,
          role: "owner",
        });
      }

      const base = publicAppBaseUrl(req);

      if (paymentGateway === "razorpay") {
        try {
          const payload = await performSaasRazorpaySubscriptionCheckout(userId, planId, billingCycle);
          return res.json(payload);
        } catch (e: any) {
          const code = e?.statusCode;
          if (code === 404) return res.status(404).json({ error: e.message });
          const { isRazorpayAuthenticationError, razorpayAuthFailureHelp } = await import(
            "../payment/saas-subscription-razorpay"
          );
          if (isRazorpayAuthenticationError(e?.message)) {
            return res.status(502).json({
              error: razorpayAuthFailureHelp(),
              code: "RAZORPAY_AUTH_FAILED",
              details: e.message,
            });
          }
          throw e;
        }
      }

      try {
        const payload = await performSaasStripeSubscriptionCheckout(userId, planId, billingCycle, base);
        return res.json(payload);
      } catch (e: any) {
        const code = e?.statusCode;
        if (code === 404) return res.status(404).json({ error: e.message });
        throw e;
      }
    } catch (e: any) {
      console.error("[public/subscription-checkout]", e);
      res.status(500).json({ error: e?.message || "Checkout failed" });
    }
  });

  app.post("/api/public/verify-razorpay-subscription", rateLimitMiddleware, async (req, res) => {
    try {
      const parsed = publicRazorpaySubscriptionVerifySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
      }
      const out = await verifySaasRazorpaySubscriptionFirstPayment({
        ...parsed.data,
      });
      res.json({
        success: true,
        payment: { id: out.payment.id, subscriptionId: out.payment.subscriptionId },
        invoiceDelivery: out.invoiceDelivery,
      });
    } catch (e: any) {
      const code = e?.statusCode || (e?.message === "Payment not found" ? 404 : 500);
      res.status(code).json({ error: e?.message || "Verification failed" });
    }
  });
}
