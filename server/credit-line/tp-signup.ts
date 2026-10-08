import { getOrgWhatsappBilling, upsertOrgWhatsappBilling } from "./org-billing";
import { getCreditLineProviderConfig } from "./provider-config";
import { getCreditLineProvider } from "./providers/registry";
import { resolveCreditLineWebhookUrl } from "./webhook";
import { isCreditLineActiveForOrg } from "./skip-meta-graph-signup";

/**
 * After Embedded Signup, attach credit line via supplier (e.g. Interakt tp-signup)
 * only when credit line is enabled for this org. Safe no-op for self_pay / disabled facility.
 */
export async function maybeRunCreditLineTpSignup(params: {
  organizationId?: string | null;
  wabaId?: string | null;
  phoneNumber?: string | null;
}): Promise<{ ran: boolean; ok?: boolean; detail?: string }> {
  if (!params.organizationId || !params.wabaId) {
    return { ran: false, detail: "missing organizationId or wabaId" };
  }

  const active = await isCreditLineActiveForOrg(params.organizationId);
  if (!active.active) {
    return { ran: false, detail: active.reason };
  }

  const billing = await getOrgWhatsappBilling(params.organizationId);
  const providerId = billing.creditLineProvider || "interakt";
  const cfg = await getCreditLineProviderConfig(providerId);
  const provider = getCreditLineProvider(providerId);
  if (!cfg?.solutionId || !provider?.tpSignup) {
    await upsertOrgWhatsappBilling({
      organizationId: params.organizationId,
      creditLineWabaId: params.wabaId,
      creditLineStatus: "pending",
      lastError: `Provider ${providerId} missing token/solutionId for tp-signup`,
    });
    return { ran: true, ok: false, detail: "provider not configured" };
  }

  await upsertOrgWhatsappBilling({
    organizationId: params.organizationId,
    creditLineStatus: "pending",
    creditLineWabaId: params.wabaId,
  });

  const result = await provider.tpSignup(cfg, {
    wabaId: params.wabaId,
    solutionId: cfg.solutionId,
    phoneNumber: params.phoneNumber || undefined,
    dataLocalizationRegion: "IN",
    autoSubscribe: false,
  });

  let subscribeDetail: string | undefined;
  if (result.ok && provider.subscribeApps) {
    try {
      const wh = resolveCreditLineWebhookUrl();
      const verifyToken = (
        process.env.CREDIT_LINE_WEBHOOK_VERIFY_TOKEN ||
        process.env.WEBHOOK_VERIFY_TOKEN ||
        process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ||
        ""
      ).trim();
      if (wh.url && verifyToken) {
        const sub = await provider.subscribeApps(cfg, {
          wabaId: params.wabaId,
          overrideCallbackUri: wh.url,
          verifyToken,
        });
        subscribeDetail = sub.ok
          ? `subscribed_apps ok → ${wh.url}`
          : `subscribed_apps status=${sub.status} ${JSON.stringify(sub.body).slice(0, 200)}`;
        console.log(`[CreditLine] ${subscribeDetail}`);
      } else {
        subscribeDetail = "subscribed_apps skipped (missing webhook URL or verify token)";
      }
    } catch (e: any) {
      subscribeDetail = `subscribed_apps error: ${e?.message || e}`;
      console.warn(`[CreditLine] ${subscribeDetail}`);
    }
  }

  await upsertOrgWhatsappBilling({
    organizationId: params.organizationId,
    creditLineWabaId: params.wabaId,
    creditLineStatus: result.ok ? "active" : "error",
    lastError: result.ok ? null : JSON.stringify(result.body).slice(0, 1000),
    creditLineMetadata: {
      ...(billing.creditLineMetadata || {}),
      lastTpSignup: { at: new Date().toISOString(), status: result.status, body: result.body },
      lastSubscribeApps: subscribeDetail || null,
    },
  });

  return {
    ran: true,
    ok: result.ok,
    detail: result.ok
      ? `tp-signup ok${subscribeDetail ? `; ${subscribeDetail}` : ""}`
      : `tp-signup failed status=${result.status}`,
  };
}
