import { RazorpayClient } from "./razorpay-client";
import { storage } from "../storage";

export type SaasSubscriptionRazorpay = {
  client: RazorpayClient;
  /** Publishable key for Razorpay Checkout */
  keyId: string;
  /** Webhook signing secret from Razorpay dashboard (store on integration). */
  webhookSecret?: string;
};

/**
 * Resolves Razorpay API keys for **customer subscription** payments on the panel.
 * Always uses the whitelabel admin (isSaaSOwner) integration with "Organization subscription billing" enabled — never platform env keys.
 */
export async function resolveSaasSubscriptionRazorpay(): Promise<SaasSubscriptionRazorpay> {
  const saas = await storage.getSaasOwnerUser();
  if (!saas) {
    throw new Error(
      "No whitelabel admin account found. Mark your platform owner user with isSaaSOwner, then connect Razorpay for subscription billing."
    );
  }
  const integ = await storage.getSaasOwnerRazorpayForOrgSubscription();
  if (!integ?.credentials) {
    throw new Error(
      "Subscription Razorpay is not configured. Sign in as the whitelabel admin, open Integrations → Razorpay, connect keys, and enable “Organization subscription billing”."
    );
  }
  const c = integ.credentials as Record<string, string>;
  const keyId = String(c.keyId || c.key_id || "").trim();
  const keySecret = String(c.keySecret || c.key_secret || "").trim();
  if (!keyId || !keySecret) {
    throw new Error("Razorpay Key ID and Key Secret are missing on the whitelabel admin’s subscription integration.");
  }
  const webhookSecret = String(c.webhookSecret || c.webhook_secret || "").trim();
  return {
    client: new RazorpayClient({ keyId, keySecret }),
    keyId,
    webhookSecret: webhookSecret || undefined,
  };
}

export function razorpayAuthFailureHelp(): string {
  return (
    "Razorpay rejected the API keys used for panel subscription billing. Sign in as the platform owner (whitelabel admin) account, open Integrations → Razorpay, paste the matching Live Key ID and Key Secret from Razorpay Dashboard → Settings → API Keys, enable “Organization subscription billing”, and save. Test keys (rzp_test_…) only work in test mode; production needs Live keys (rzp_live_…)."
  );
}

export function isRazorpayAuthenticationError(message: string | undefined): boolean {
  return /authentication failed/i.test(String(message || ""));
}
