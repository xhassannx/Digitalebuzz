import type { CustomerApiResponse } from "./updates";

/** Serialize Razorpay/Cashfree SDK objects (or plain objects) for JSONB storage. */
export function gatewayEntityToJsonRecord(entity: unknown): Record<string, unknown> | null {
  if (entity === null || entity === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(entity)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function numFromPayload(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Licensor contract sends onboarding_fee in major units (e.g. INR rupees). */
export function feeMajorToOnboardingMinorUnits(amount: number, currency: string): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const c = currency.toUpperCase();
  if (c === "INR" || c === "USD" || c === "EUR" || c === "GBP") return Math.round(amount * 100);
  return Math.round(amount * 100);
}

/** Parsed onboarding / trial / included-users fields from synced platform contract JSON. */
export function readWhitelabelOnboardingContractFromUpstreamPayload(raw: unknown): {
  feeMajor: number;
  trialDays: number;
  included: number;
  currency: string;
} | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const p = raw as Record<string, unknown>;
  const feeMajor =
    numFromPayload(p.onboarding_fee) ?? numFromPayload(p.onboardingFee);
  if (feeMajor == null || feeMajor <= 0) return null;

  const included =
    numFromPayload(p.included_users) ??
    numFromPayload(p.includedUsers) ??
    0;
  const trialDaysRaw =
    numFromPayload(p.free_trial_days) ??
    numFromPayload(p.freeTrialDays) ??
    0;
  const trialDays = Math.max(0, Math.floor(trialDaysRaw));
  const currency = String(p.billing_currency ?? p.billingCurrency ?? "INR").trim() || "INR";

  return {
    feeMajor,
    trialDays,
    included: Math.max(0, Math.floor(included)),
    currency,
  };
}

function asContractRecord(upstreamPayload: unknown): Record<string, unknown> {
  if (upstreamPayload && typeof upstreamPayload === "object" && !Array.isArray(upstreamPayload)) {
    return { ...(upstreamPayload as Record<string, unknown>) };
  }
  if (typeof upstreamPayload === "string") {
    try {
      const p = JSON.parse(upstreamPayload) as unknown;
      return p && typeof p === "object" && !Array.isArray(p) ? { ...(p as Record<string, unknown>) } : {};
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Overlay live GET /api/customer commercial fields onto the DB snapshot
 * (avoids stale `upstream_payload` until the next sync).
 */
export function mergeLiveContractForOutstandingLimit(
  upstreamPayload: unknown,
  live: CustomerApiResponse | null
): unknown {
  if (!live || typeof live !== "object") return upstreamPayload;
  const liveRec = live as Record<string, unknown>;
  const base = asContractRecord(upstreamPayload);

  const keys = [
    "outstanding_amount_limit",
    "outstandingAmountLimit",
    "billing_currency",
    "billingCurrency",
    "onboarding_fee",
    "onboardingFee",
    "included_users",
    "includedUsers",
    "free_trial_days",
    "freeTrialDays",
    "whitelabel_platform_fee",
    "whitelabelPlatformFee",
    "payment_gateway",
    "paymentGateway",
  ] as const;
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(liveRec, k) && liveRec[k] !== undefined) {
      base[k] = liveRec[k];
    }
  }
  return base;
}

/** Snapshot debug helpers for admin/recalculate errors. */
export function peekOnboardingFeeFromPayload(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const p = raw as Record<string, unknown>;
  return p.onboarding_fee ?? p.onboardingFee ?? null;
}

/**
 * Parses `outstanding_amount_limit` / `outstandingAmountLimit` from the synced licensor contract.
 * Uses the same convention as `onboarding_fee`: **major** currency units (e.g. 10000 = 10,000 INR),
 * converted to smallest units (paise) for comparison with `sum(amount_minor)` on fee rows.
 */
export function parseOutstandingLimitMinorFromUpstreamPayload(up: unknown): number | null {
  let node: unknown = up;
  if (typeof node === "string") {
    try {
      node = JSON.parse(node) as unknown;
    } catch {
      return null;
    }
  }
  if (!node || typeof node !== "object" || Array.isArray(node)) return null;
  const o = node as Record<string, unknown>;
  const v = o.outstanding_amount_limit ?? o.outstandingAmountLimit;
  if (v == null) return null;
  let major: number | null = null;
  if (typeof v === "number" && Number.isFinite(v) && v > 0) major = v;
  else if (typeof v === "string" && v.trim()) {
    const n = parseFloat(v.trim());
    if (Number.isFinite(n) && n > 0) major = n;
  }
  if (major == null) return null;
  const currency = String(o.billing_currency ?? o.billingCurrency ?? "INR").trim() || "INR";
  return feeMajorToOnboardingMinorUnits(major, currency);
}

/** Razorpay keys from live customer API (not redacted DB snapshot). */
export function getRazorpayKeysFromCustomerApi(data: CustomerApiResponse): {
  keyId: string;
  keySecret: string;
} | null {
  let keyId = typeof data.razorpay_key_id === "string" ? data.razorpay_key_id.trim() : "";
  let keySecret = typeof data.razorpay_key_secret === "string" ? data.razorpay_key_secret.trim() : "";

  const pgc = data.payment_gateway_credentials as Record<string, unknown> | null | undefined;
  if (pgc && typeof pgc === "object") {
    if (!keyId && typeof pgc.key_id === "string") keyId = pgc.key_id.trim();
    if (!keySecret && typeof pgc.key_secret === "string") keySecret = pgc.key_secret.trim();
  }

  const pay = data.payment as Record<string, unknown> | null | undefined;
  const creds = pay?.credentials as Record<string, unknown> | null | undefined;
  if (creds && typeof creds === "object") {
    if (!keyId && typeof creds.key_id === "string") keyId = creds.key_id.trim();
    if (!keyId && typeof creds.keyId === "string") keyId = creds.keyId.trim();
    if (!keySecret && typeof creds.key_secret === "string") keySecret = creds.key_secret.trim();
    if (!keySecret && typeof creds.keySecret === "string") keySecret = creds.keySecret.trim();
  }

  if (!keyId || !keySecret) return null;
  return { keyId, keySecret };
}

/** Normalize licensor / UI variants to a supported batch-pay gateway. */
export function normalizeWhitelabelPaymentGateway(
  raw: string | undefined | null
): "razorpay" | "cashfree" | null {
  const s = String(raw || "")
    .trim()
    .toLowerCase();
  if (!s) return null;
  if (s === "razorpay" || s === "rzp") return "razorpay";
  if (s === "cashfree" || s === "cf" || s === "cash_free") return "cashfree";
  return null;
}

/**
 * Prefer `payment_gateway` from synced platform contract (DB), then live /api/customer.
 * Credentials for the chosen gateway still come from the live customer API response.
 */
export function resolveWhitelabelBatchPaymentGateway(params: {
  upstreamPayload: unknown;
  customer: CustomerApiResponse | null;
}): "razorpay" | "cashfree" | null {
  let fromDb: string | undefined;
  const up = params.upstreamPayload;
  if (up && typeof up === "object" && !Array.isArray(up)) {
    const p = up as Record<string, unknown>;
    const v = p.payment_gateway ?? p.paymentGateway;
    if (typeof v === "string" && v.trim()) fromDb = v;
  }
  const fromLive =
    typeof params.customer?.payment_gateway === "string" ? params.customer.payment_gateway : undefined;
  const primary = fromDb?.trim() ? fromDb : fromLive;
  return normalizeWhitelabelPaymentGateway(primary);
}

export function getCashfreeKeysFromCustomerApi(data: CustomerApiResponse): {
  clientId: string;
  clientSecret: string;
  useSandbox: boolean;
} | null {
  let clientId =
    typeof data.cashfree_app_id === "string" ? data.cashfree_app_id.trim() : "";
  let clientSecret =
    typeof data.cashfree_secret_key === "string" ? data.cashfree_secret_key.trim() : "";

  const pgc = data.payment_gateway_credentials as Record<string, unknown> | null | undefined;
  if (pgc && typeof pgc === "object") {
    if (!clientId) {
      const a = pgc.client_id ?? pgc.app_id ?? pgc.clientId;
      if (typeof a === "string") clientId = a.trim();
    }
    if (!clientSecret) {
      const s = pgc.client_secret ?? pgc.secret_key ?? pgc.clientSecret;
      if (typeof s === "string") clientSecret = s.trim();
    }
  }

  const pay = data.payment as Record<string, unknown> | null | undefined;
  const creds = pay?.credentials as Record<string, unknown> | null | undefined;
  if (creds && typeof creds === "object") {
    if (!clientId) {
      const a = creds.client_id ?? creds.app_id ?? creds.clientId;
      if (typeof a === "string") clientId = a.trim();
    }
    if (!clientSecret) {
      const s = creds.client_secret ?? creds.secret_key ?? creds.clientSecret;
      if (typeof s === "string") clientSecret = s.trim();
    }
  }

  let useSandbox = false;
  const sb = data.cashfree_sandbox;
  if (sb === true || sb === 1 || String(sb).toLowerCase() === "true") useSandbox = true;
  if (pay && typeof pay === "object") {
    if (pay.use_sandbox === true) useSandbox = true;
    if (String(pay.cashfree_sandbox ?? "").toLowerCase() === "true") useSandbox = true;
  }

  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, useSandbox };
}

export function getCashfreeWebhookSecretFromCustomerApi(data: CustomerApiResponse): string {
  let wh =
    typeof data.cashfree_webhook_secret === "string" ? data.cashfree_webhook_secret.trim() : "";
  const pay = data.payment as Record<string, unknown> | null | undefined;
  const creds = pay?.credentials as Record<string, unknown> | null | undefined;
  if (!wh && creds && typeof creds === "object") {
    const w = creds.webhook_secret ?? creds.webhookSecret;
    if (typeof w === "string") wh = w.trim();
  }
  const pgc = data.payment_gateway_credentials as Record<string, unknown> | null | undefined;
  if (!wh && pgc && typeof pgc === "object") {
    const w = pgc.webhook_secret ?? pgc.webhookSecret;
    if (typeof w === "string") wh = w.trim();
  }
  return wh;
}
