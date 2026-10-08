import { StripeClient } from "./stripe-client";
import { storage } from "../storage";

export type SaasSubscriptionStripe = {
  client: StripeClient;
};

/**
 * Stripe keys for **customer subscription** checkout on the panel (USD path).
 * Uses the whitelabel admin integration with `useForOrgSubscription` — not .env.
 */
export async function resolveSaasSubscriptionStripe(): Promise<SaasSubscriptionStripe> {
  const integ = await storage.getSaasOwnerStripeForOrgSubscription();
  if (!integ?.credentials) {
    throw new Error(
      "Stripe subscription billing is not configured. The whitelabel admin must connect Stripe under Integrations (Secret key + Webhook signing secret) and enable “Organization subscription billing”."
    );
  }
  const c = integ.credentials as Record<string, string>;
  const secretKey = c.secretKey || c.secret_key;
  if (!secretKey) {
    throw new Error("Stripe Secret key is missing on the whitelabel admin’s Stripe integration.");
  }
  const webhookSecret = c.webhookSecret || c.webhook_secret;
  return {
    client: new StripeClient({
      secretKey,
      webhookSecret: webhookSecret || undefined,
    }),
  };
}
