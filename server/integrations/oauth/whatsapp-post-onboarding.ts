/**
 * Post–Embedded Signup / OAuth steps: subscribe app, assign platform system user to WABA,
 * verify token scopes, and record a checklist for tech-partner billing setup.
 */
import { storage } from "../../storage";

const GRAPH_API_VERSION = process.env.GRAPH_API_GRAPH_VERSION || "v23.0";
const FACEBOOK_GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;

export type OnboardingStepStatus = "ok" | "warn" | "manual" | "fail" | "skip";

export type OnboardingStep = {
  id: string;
  label: string;
  status: OnboardingStepStatus;
  detail?: string;
};

export type WhatsAppPostOnboardingResult = {
  wabaIds: string[];
  businessPortfolioId?: string | null;
  phoneNumberId?: string | null;
  steps: OnboardingStep[];
  readyForMessaging: boolean;
};

function partnerSystemUser(): { id: string; token: string } | null {
  const id = (process.env.META_SYSTEM_USER_ID || "").trim();
  const token = (process.env.META_SYSTEM_USER_TOKEN || "").trim();
  if (!id || !token) return null;
  return { id, token };
}

function partnerBusinessId(): string | null {
  return (process.env.META_PARTNER_BUSINESS_ID || "").trim() || null;
}

function partnerBusinessName(): string {
  return (process.env.META_PARTNER_BUSINESS_NAME || "your tech partner").trim();
}

/** Strip .env mistakes (comments, newlines) and trailing slashes from BASE_URL. */
function sanitizeBaseUrl(raw: string | undefined): string {
  return (raw || "http://localhost:5000").split(/\s*[\n#]/)[0].trim().replace(/\/+$/, "");
}

function centralPanelBaseUrl(): string {
  return (process.env.OAUTH_CENTRAL_URL || process.env.CUSTOMER_API_BASE_URL || "")
    .split(/\s*[\n#]/)[0]
    .trim()
    .replace(/\/+$/, "");
}

/**
 * Webhook URL Meta should call for this WABA (override_callback_uri).
 * Multi-tenant: Meta hits CUSTOMER_API_BASE_URL once; licensor forwards to each whitelabel BASE_URL.
 */
export function resolveWhatsAppWebhookCallbackUri(): {
  url: string | null;
  reason?: string;
  source?: "webhook_url" | "central" | "base_url";
} {
  const explicit = (process.env.WEBHOOK_URL || "").split(/\s*[\n#]/)[0].trim();
  const central = centralPanelBaseUrl();

  let candidate: string;
  let source: "webhook_url" | "central" | "base_url";
  if (explicit) {
    candidate = explicit;
    source = "webhook_url";
  } else if (central) {
    candidate = `${central}/api/webhooks/whatsapp-business`;
    source = "central";
  } else {
    candidate = `${sanitizeBaseUrl(process.env.BASE_URL)}/api/webhooks/whatsapp-business`;
    source = "base_url";
  }

  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase();
    const isLocal = host === "localhost" || host === "127.0.0.1";
    if (!isLocal && parsed.protocol !== "https:") {
      return {
        url: null,
        reason: `Webhook must be https:// (got ${parsed.protocol}//${host}). Set WEBHOOK_URL or BASE_URL in .env`,
      };
    }
    if (!parsed.pathname || parsed.pathname === "/") {
      return { url: null, reason: "Webhook path missing — use …/api/webhooks/whatsapp-business" };
    }
    return { url: parsed.toString(), source };
  } catch {
    return {
      url: null,
      reason: `Not a valid URL: "${candidate}". Set WEBHOOK_URL or CUSTOMER_API_BASE_URL (https://licensor-domain/.../api/webhooks/whatsapp-business)`,
      source,
    };
  }
}

async function graphJson(
  url: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/** Meta assigned_users needs app-scoped user id (from debug_token), not BM global id. */
async function resolveAppScopedSystemUserId(su: { id: string; token: string }): Promise<string> {
  const fromEnv = (process.env.META_SYSTEM_USER_APP_SCOPED_ID || "").trim();
  if (fromEnv) return fromEnv;

  const appToken =
    FACEBOOK_APP_ID && FACEBOOK_APP_SECRET ? `${FACEBOOK_APP_ID}|${FACEBOOK_APP_SECRET}` : su.token;
  const { ok, data } = await graphJson(
    `${FACEBOOK_GRAPH_API_BASE}/debug_token?input_token=${encodeURIComponent(su.token)}&access_token=${encodeURIComponent(appToken)}`
  );
  const appScoped = data?.data?.user_id;
  if (ok && appScoped) {
    return String(appScoped);
  }
  return su.id;
}

export async function verifyAccessTokenScopes(accessToken: string): Promise<{
  steps: OnboardingStep[];
  wabaIdsFromToken: string[];
}> {
  const steps: OnboardingStep[] = [];
  const wabaIdsFromToken: string[] = [];
  const appToken =
    FACEBOOK_APP_ID && FACEBOOK_APP_SECRET ? `${FACEBOOK_APP_ID}|${FACEBOOK_APP_SECRET}` : accessToken;

  const { ok, data } = await graphJson(
    `${FACEBOOK_GRAPH_API_BASE}/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(appToken)}`
  );

  if (!ok || !data?.data?.is_valid) {
    steps.push({
      id: "token_valid",
      label: "Access token valid",
      status: "fail",
      detail: data?.error?.message || "Token invalid or expired — reconnect WhatsApp Business",
    });
    return { steps, wabaIdsFromToken };
  }

  steps.push({
    id: "token_valid",
    label: "Access token valid",
    status: "ok",
    detail: data.data.scopes?.join(", ") || undefined,
  });

  const required = ["whatsapp_business_management", "whatsapp_business_messaging"];
  const scopes: string[] = data.data.scopes || [];
  for (const req of required) {
    steps.push({
      id: `scope_${req}`,
      label: `OAuth scope: ${req}`,
      status: scopes.includes(req) ? "ok" : "warn",
      detail: scopes.includes(req)
        ? undefined
        : "Request Advanced Access in Meta App Dashboard → WhatsApp → API Setup",
    });
  }

  for (const scope of data.data.granular_scopes || []) {
    if (
      scope.scope === "whatsapp_business_management" ||
      scope.scope === "whatsapp_business_messaging"
    ) {
      for (const id of scope.target_ids || []) {
        if (id && !wabaIdsFromToken.includes(String(id))) wabaIdsFromToken.push(String(id));
      }
    }
  }

  if (wabaIdsFromToken.length) {
    steps.push({
      id: "waba_granted",
      label: "WABA shared with your app",
      status: "ok",
      detail: `${wabaIdsFromToken.length} account(s): ${wabaIdsFromToken.join(", ")}`,
    });
  } else {
    steps.push({
      id: "waba_granted",
      label: "WABA shared with your app",
      status: "warn",
      detail: "No WABA in token yet — finish embedded signup or reconnect",
    });
  }

  return { steps, wabaIdsFromToken };
}

export async function fetchWabaOwnerBusinessId(
  wabaId: string,
  accessToken: string
): Promise<string | null> {
  const { ok, data } = await graphJson(
    `${FACEBOOK_GRAPH_API_BASE}/${wabaId}?fields=owner_business_info&access_token=${encodeURIComponent(accessToken)}`
  );
  if (!ok) return null;
  return data?.owner_business_info?.id || data?.owner_business_info?.business_id || null;
}

/** Verify token sent to Meta on WABA override — must match licensor + Meta App Dashboard when using central webhook URL. */
export function webhookVerifyTokenForMetaOverride(): string {
  const central = centralPanelBaseUrl();
  const token = (
    central
      ? process.env.CENTRAL_WEBHOOK_VERIFY_TOKEN ||
        process.env.WEBHOOK_VERIFY_TOKEN ||
        process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN ||
        process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
      : process.env.WEBHOOK_VERIFY_TOKEN ||
        process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN ||
        process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
  )
    ?.split(/\s*[\n#]/)[0]
    ?.trim();
  return token || "helicoptic@2025";
}

export async function subscribeAppToWaba(
  wabaId: string,
  accessToken: string
): Promise<{ ok: boolean; detail?: string; webhookOverrideOk?: boolean }> {
  const { url: webhookUrl, reason: webhookReason } = resolveWhatsAppWebhookCallbackUri();
  const verifyToken = webhookVerifyTokenForMetaOverride();
  const token = partnerSystemUser()?.token || accessToken;

  const sub = await graphJson(`${FACEBOOK_GRAPH_API_BASE}/${wabaId}/subscribed_apps`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  if (!sub.ok) {
    return {
      ok: false,
      detail: sub.data?.error?.message || `Subscribe failed (${sub.status})`,
    };
  }

  if (!webhookUrl) {
    return {
      ok: true,
      webhookOverrideOk: false,
      detail: `App subscribed. Webhook override skipped: ${webhookReason}. Configure webhook in Meta App Dashboard.`,
    };
  }

  const override = await graphJson(`${FACEBOOK_GRAPH_API_BASE}/${wabaId}/subscribed_apps`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      override_callback_uri: webhookUrl,
      verify_token: verifyToken,
    }),
  });

  if (!override.ok) {
    const msg = override.data?.error?.message || "Webhook override failed";
    const tokenHint =
      msg.includes("403") || msg.includes("verification")
        ? ` WEBHOOK_VERIFY_TOKEN on licensor (${webhookUrl?.split("/api/")[0]}) must match CENTRAL_WEBHOOK_VERIFY_TOKEN / WEBHOOK_VERIFY_TOKEN on this panel (used: ${verifyToken.substring(0, 4)}…).`
        : "";
    return {
      ok: true,
      webhookOverrideOk: false,
      detail: `App subscribed. Override failed: ${msg}.${tokenHint} URL: ${webhookUrl}`,
    };
  }

  return { ok: true, webhookOverrideOk: true, detail: webhookUrl };
}

export async function assignPlatformSystemUserToWaba(
  wabaId: string,
  /** Customer Embedded Signup / OAuth token — preferred for assign (has WABA manage). */
  customerAccessToken?: string | null
): Promise<{
  ok: boolean;
  detail?: string;
}> {
  const su = partnerSystemUser();
  if (!su) {
    return {
      ok: false,
      detail: "Set META_SYSTEM_USER_ID and META_SYSTEM_USER_TOKEN in server .env",
    };
  }

  const userIdForApi = await resolveAppScopedSystemUserId(su);
  const idNote =
    userIdForApi !== su.id
      ? `app-scoped id ${userIdForApi}`
      : `id ${userIdForApi} (set META_SYSTEM_USER_APP_SCOPED_ID if assign fails)`;

  const customerTok = (customerAccessToken || "").trim();
  // Prefer customer token: system-user token often lacks permission to assign itself on a partner-shared WABA
  const tokensToTry: Array<{ label: string; token: string }> = [];
  if (customerTok) tokensToTry.push({ label: "customer OAuth token", token: customerTok });
  tokensToTry.push({ label: "platform system user token", token: su.token });

  const attemptBodies: Array<{ label: string; body: object }> = [
    { label: "user+tasks MANAGE", body: { user: userIdForApi, tasks: ["MANAGE"] } },
    { label: "user+tasks MANAGE+DEVELOP", body: { user: userIdForApi, tasks: ["MANAGE", "DEVELOP"] } },
    { label: "user+role ADMIN", body: { user: userIdForApi, role: "ADMIN" } },
  ];

  let lastError = "";
  for (const tok of tokensToTry) {
    for (const attempt of attemptBodies) {
      const { ok, data } = await graphJson(`${FACEBOOK_GRAPH_API_BASE}/${wabaId}/assigned_users`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tok.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(attempt.body),
      });
      if (ok || data?.success === true) {
        return { ok: true, detail: `${attempt.label} via ${tok.label} (${idNote})` };
      }
      lastError = data?.error?.message || lastError || "Assign failed";
    }

    const q = await graphJson(
      `${FACEBOOK_GRAPH_API_BASE}/${wabaId}/assigned_users?user=${encodeURIComponent(userIdForApi)}&tasks=${encodeURIComponent('["MANAGE"]')}&access_token=${encodeURIComponent(tok.token)}`,
      { method: "POST" }
    );
    if (q.ok || q.data?.success === true) {
      return { ok: true, detail: `query assign via ${tok.label} (${idNote})` };
    }
    lastError = q.data?.error?.message || lastError;
  }

  return {
    ok: false,
    detail:
      lastError ||
      `Assign system user failed (${idNote}) — assign manually in Business Manager → WhatsApp account → People`,
  };
}

export async function runWhatsAppPostOnboarding(params: {
  accessToken: string;
  wabaIds?: string[];
  phoneNumberId?: string | null;
  businessPortfolioId?: string | null;
  integrationId?: string;
  userId?: string;
  organizationId?: string | null;
  phoneNumber?: string | null;
}): Promise<WhatsAppPostOnboardingResult> {
  const steps: OnboardingStep[] = [];
  const { steps: tokenSteps, wabaIdsFromToken } = await verifyAccessTokenScopes(params.accessToken);
  steps.push(...tokenSteps);

  const wabaSet = new Set<string>();
  for (const id of params.wabaIds || []) if (id) wabaSet.add(String(id));
  for (const id of wabaIdsFromToken) wabaSet.add(id);
  const wabaIds = [...wabaSet];

  let businessPortfolioId = params.businessPortfolioId || null;
  if (!businessPortfolioId && wabaIds[0]) {
    businessPortfolioId = await fetchWabaOwnerBusinessId(wabaIds[0], params.accessToken);
  }

  if (businessPortfolioId) {
    steps.push({
      id: "customer_business_id",
      label: "Customer business portfolio ID",
      status: "ok",
      detail: businessPortfolioId,
    });
  }

  const partnerBizId = partnerBusinessId();
  if (partnerBizId) {
    steps.push({
      id: "partner_business_configured",
      label: "Tech partner business ID (platform .env)",
      status: "ok",
      detail: partnerBizId,
    });
  }

  let isCreditLineOrg = false;
  let skipMetaGraphSignup = false;
  let skipMetaReason: string | undefined;
  if (params.organizationId) {
    try {
      const { isCreditLineActiveForOrg, shouldSkipMetaGraphSignupForCreditLine } = await import(
        "../../credit-line/skip-meta-graph-signup"
      );
      const active = await isCreditLineActiveForOrg(params.organizationId);
      isCreditLineOrg = active.active;
      const skip = await shouldSkipMetaGraphSignupForCreditLine(params.organizationId);
      skipMetaGraphSignup = skip.skip;
      skipMetaReason = skip.reason;
    } catch {
      /* ignore */
    }
  }

  if (isCreditLineOrg) {
    steps.push({
      id: "partner_meta_access",
      label: `Customer adds ${partnerBusinessName()} as Partner in Meta`,
      status: "skip",
      detail:
        "Not required — credit line is enabled; commercial template billing uses the supplier credit line (Interakt/Haptik), not your Meta partner card.",
    });
    steps.push({
      id: "payment_method",
      label: "Assign your company card to this WABA in Meta Billing",
      status: "skip",
      detail:
        "Not required — credit line is enabled; supplier attaches their credit line. Keep this only for self_pay orgs.",
    });
  } else {
    steps.push({
      id: "partner_meta_access",
      label: `Customer adds ${partnerBusinessName()} as Partner in Meta`,
      status: "manual",
      detail:
        "Customer → Meta Business settings → Users → Partners → add your business with access to this WhatsApp account (Finance/Manage). Required so your card can bill this WABA.",
    });
    steps.push({
      id: "payment_method",
      label: "Assign your company card to this WABA in Meta Billing",
      status: "manual",
      detail:
        "Billing & payments → Accounts → WhatsApp Business accounts → this WABA → payment method = your portfolio card (same card for all customers).",
    });
  }

  if (skipMetaGraphSignup) {
    console.log(
      `[WhatsApp Post-Onboarding] Skipping Meta Graph subscribed_apps/assigned_users — ${skipMetaReason}`
    );
    steps.push({
      id: "meta_graph_signup_skipped",
      label: "Meta Graph signup (subscribed_apps / assigned_users)",
      status: "skip",
      detail:
        skipMetaReason ||
        "Skipped for credit_line + solutionID — Partner Solution / TP-signup already configured Meta; our Graph calls would overwrite permissions.",
    });
    for (const wabaId of wabaIds) {
      steps.push({
        id: `subscribe_${wabaId}`,
        label: `Subscribe app to WABA ${wabaId}`,
        status: "skip",
        detail: "Skipped — TP signup owns WABA app subscription for credit_line",
      });
      steps.push({
        id: `system_user_${wabaId}`,
        label: `Platform system user on WABA ${wabaId}`,
        status: "skip",
        detail: "Skipped — assigned_users would overwrite Partner Solution roles",
      });
    }
  } else {
    for (const wabaId of wabaIds) {
      const sub = await subscribeAppToWaba(wabaId, params.accessToken);
      steps.push({
        id: `subscribe_${wabaId}`,
        label: `Subscribe app to WABA ${wabaId}`,
        status: sub.ok ? (sub.webhookOverrideOk === false ? "warn" : "ok") : "fail",
        detail: sub.detail,
      });

      const assign = await assignPlatformSystemUserToWaba(wabaId, params.accessToken);
      steps.push({
        id: `system_user_${wabaId}`,
        label: `Platform system user on WABA ${wabaId}`,
        status: assign.ok ? "ok" : partnerSystemUser() ? "warn" : "skip",
        detail: assign.ok
          ? assign.detail
          : `${assign.detail || "Assign failed"}. Session/custom Graph sends may still work with the user OAuth token; fix system user for long-lived server jobs.`,
      });
    }
  }

  if (params.phoneNumberId) {
    steps.push({
      id: "phone_number_id",
      label: "Phone number ID from signup",
      status: "ok",
      detail: params.phoneNumberId,
    });
  }

  steps.push({
    id: "wallet_reload",
    label: "Customer prepaid wallet (your CRM)",
    status: "manual",
    detail: isCreditLineOrg
      ? "Enable Wallet billing in Admin and reload balance — required for credit_line Meta template usage debits."
      : "Enable Wallet billing in Admin (optional for self_pay Meta usage; can still pay SaaS from wallet).",
  });

  if (params.organizationId && wabaIds[0]) {
    try {
      const { maybeRunCreditLineTpSignup } = await import("../../credit-line/tp-signup");
      const tp = await maybeRunCreditLineTpSignup({
        organizationId: params.organizationId,
        wabaId: wabaIds[0],
        phoneNumber: params.phoneNumber || null,
      });
      const subAppsFailed =
        typeof tp.detail === "string" && /subscribed_apps status=4|Invalid request/i.test(tp.detail);
      steps.push({
        id: "credit_line_tp_signup",
        label: "Credit-line supplier onboarding (tp-signup)",
        status: !tp.ran ? "skip" : !tp.ok ? "warn" : subAppsFailed ? "warn" : "ok",
        detail: subAppsFailed
          ? `${tp.detail} — templates via Interakt will fail until Interakt enables amped-express for this WABA (ask SPOC).`
          : tp.detail,
      });
    } catch (e: any) {
      steps.push({
        id: "credit_line_tp_signup",
        label: "Credit-line supplier onboarding (tp-signup)",
        status: "warn",
        detail: e?.message || String(e),
      });
    }
  }

  const criticalOk = steps.filter(
    (s) => s.id.startsWith("subscribe_") && (s.status === "ok" || s.status === "skip")
  ).length;
  const tpOk =
    !isCreditLineOrg ||
    steps.find((s) => s.id === "credit_line_tp_signup")?.status === "ok" ||
    steps.find((s) => s.id === "credit_line_tp_signup")?.status === "skip";
  const readyForMessaging =
    (skipMetaGraphSignup
      ? steps.find((s) => s.id === "token_valid")?.status === "ok" && wabaIds.length > 0 && !!tpOk
      : criticalOk > 0 &&
        steps.find((s) => s.id === "token_valid")?.status === "ok" &&
        (steps.find((s) => s.id === "waba_granted")?.status === "ok" || wabaIds.length > 0));

  const payload = {
    completedAt: new Date().toISOString(),
    wabaIds,
    businessPortfolioId,
    phoneNumberId: params.phoneNumberId || null,
    steps,
    readyForMessaging,
  };

  if (params.integrationId && params.userId) {
    try {
      const integration = await storage.getIntegration(params.integrationId, params.userId);
      if (integration) {
        const config = { ...(integration.config as Record<string, unknown>), whatsappOnboarding: payload };
        await storage.updateIntegration(params.integrationId, params.userId, { config });
      }
    } catch (e: any) {
      console.warn("[WhatsApp Post-Onboarding] Failed to save checklist:", e.message);
    }
  }

  return {
    wabaIds,
    businessPortfolioId,
    phoneNumberId: params.phoneNumberId || null,
    steps,
    readyForMessaging,
  };
}

export function buildManualOnboardingInstructions(steps: OnboardingStep[]): string {
  return steps
    .filter((s) => s.status === "manual" || s.status === "warn" || s.status === "fail")
    .map((s) => `• ${s.label}${s.detail ? `: ${s.detail}` : ""}`)
    .join("\n");
}
