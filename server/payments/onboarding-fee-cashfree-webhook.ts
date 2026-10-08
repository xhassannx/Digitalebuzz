import crypto from "crypto";
import { storage } from "../storage";
import { getCashfreeWebhookSecretFromCustomerApi, gatewayEntityToJsonRecord } from "../whitelabel-onboarding-fee";

export type OnboardingCashfreeWebhookResult = "ok" | "invalid_signature";

/**
 * When a Cashfree payment link was created for whitelabel onboarding batch pay,
 * `gateway_order_id` stores the link_id. Mark matching rows paid on success webhook.
 */
export async function handleCashfreeWhitelabelOnboardingWebhook(
  linkId: string,
  data: Record<string, unknown>,
  rawBody: Buffer | undefined,
  headerSignature: string | undefined
): Promise<OnboardingCashfreeWebhookResult> {
  const feeRows = await storage.getWhitelabelOnboardingFeesByGatewayOrderId(linkId);
  const pending = feeRows.filter((f) => f.status === "pending" || f.status === "failed");
  if (pending.length === 0) return "ok";

  const { fetchCustomerFromApi } = await import("../updates");
  const customer = await fetchCustomerFromApi();
  const whSecret = customer ? getCashfreeWebhookSecretFromCustomerApi(customer) : "";
  if (whSecret && rawBody?.length && headerSignature) {
    const expected = crypto.createHmac("sha256", whSecret).update(rawBody).digest("base64");
    if (expected !== headerSignature) {
      console.warn("[Cashfree webhook] signature mismatch for whitelabel onboarding", linkId);
      return "invalid_signature";
    }
  }

  const payId =
    (typeof data.cf_payment_id === "string" && data.cf_payment_id) ||
    (typeof data.payment_id === "string" && data.payment_id) ||
    null;
  const ref = payId || `cashfree_link:${linkId}`;
  const paidPayload: Record<string, unknown> = {
    stage: "paid",
    source: "cashfree_webhook",
    webhook: gatewayEntityToJsonRecord(data) ?? {},
  };
  const settlement = await storage.getWhitelabelOnboardingSettlementByGatewayOrderId(linkId);
  if (settlement) {
    await storage.markWhitelabelOnboardingSettlementPaid(linkId, ref, paidPayload);
  }
  await storage.markWhitelabelOnboardingFeesPaid(pending.map((f) => f.id), ref, {
    paymentGateway: "cashfree",
    gatewayPayload: paidPayload,
  });
  try {
    const { afterWhitelabelOnboardingFeesPaid } = await import("../onboarding-outstanding-gate");
    await afterWhitelabelOnboardingFeesPaid();
  } catch {
    /* ignore */
  }
  return "ok";
}
