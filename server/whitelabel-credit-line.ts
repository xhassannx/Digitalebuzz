/**
 * SaaS → whitelabel credit-line facility pool.
 * Live checks / debits against CUSTOMER_API_BASE_URL (whatsapp-admin).
 * Debits Meta cost (metaCostMinor), not customer markup.
 */
import { fetchCustomerFromApi } from "./updates";
import { storage } from "./storage";

export type WhitelabelCreditLineFacility = {
  configured: boolean;
  enabled: boolean;
  balanceMinor: number;
  limitMinor: number;
  currency: string;
};

function productionKeyHeaders(): Record<string, string> | null {
  const key = process.env.PRODUCTION_KEY?.trim();
  if (!key) return null;
  return {
    "X-Production-Key": key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

function customerApiBase(): string | null {
  const base = process.env.CUSTOMER_API_BASE_URL?.trim().replace(/\/+$/, "");
  return base || null;
}

function parseFacilityFromCustomer(data: Record<string, unknown> | null | undefined): WhitelabelCreditLineFacility {
  if (!data) {
    return { configured: false, enabled: false, balanceMinor: 0, limitMinor: 0, currency: "INR" };
  }
  return {
    configured: true,
    enabled: !!(data.credit_line_enabled === true || data.credit_line_enabled === 1),
    balanceMinor: Math.max(0, Math.round(Number(data.credit_line_balance_minor) || 0)),
    limitMinor: Math.max(0, Math.round(Number(data.credit_line_limit_minor) || 0)),
    currency: String(data.billing_currency || data.currency || "INR"),
  };
}

/** Prefer live GET /api/customer/credit-line; fall back to full /api/customer + cached platform master. */
export async function getWhitelabelCreditLineFacility(): Promise<WhitelabelCreditLineFacility> {
  const base = customerApiBase();
  const headers = productionKeyHeaders();
  if (!base || !headers) {
    return { configured: false, enabled: false, balanceMinor: 0, limitMinor: 0, currency: "INR" };
  }

  try {
    const res = await fetch(`${base}/api/customer/credit-line`, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      const body = (await res.json()) as Record<string, unknown>;
      return {
        configured: true,
        enabled: !!(body.enabled === true || body.enabled === 1),
        balanceMinor: Math.max(0, Math.round(Number(body.balance_minor) || 0)),
        limitMinor: Math.max(0, Math.round(Number(body.limit_minor) || 0)),
        currency: String(body.currency || "INR"),
      };
    }
  } catch (e: any) {
    console.warn("[WhitelabelCreditLine] GET /credit-line failed:", e?.message || e);
  }

  const live = await fetchCustomerFromApi();
  if (live) return parseFacilityFromCustomer(live as Record<string, unknown>);

  const master = await storage.getPlatformMasterSettings();
  const payload = master?.upstreamPayload;
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return parseFacilityFromCustomer(payload as Record<string, unknown>);
  }

  return { configured: true, enabled: false, balanceMinor: 0, limitMinor: 0, currency: "INR" };
}

/**
 * Gate credit-line Meta usage against the SaaS facility.
 * No-op when licensor API is not configured (local / self-hosted without SaaS).
 */
export async function assertWhitelabelCreditLineFacility(requiredMinor: number): Promise<void> {
  const amount = Math.max(0, Math.round(requiredMinor));
  if (amount <= 0) return;

  const base = customerApiBase();
  if (!base || !process.env.PRODUCTION_KEY?.trim()) return;

  const facility = await getWhitelabelCreditLineFacility();
  if (!facility.configured) return;

  if (!facility.enabled) {
    const err = new Error(
      "Whitelabel credit-line facility is disabled. Contact your SaaS provider to enable it."
    );
    (err as any).code = "CREDIT_LINE_DISABLED";
    (err as any).statusCode = 403;
    throw err;
  }

  if (facility.balanceMinor < amount) {
    const sym = facility.currency === "INR" ? "₹" : `${facility.currency} `;
    const err = new Error(
      `Whitelabel credit-line facility exhausted (${sym}${(facility.balanceMinor / 100).toFixed(2)} left; need ${sym}${(amount / 100).toFixed(2)}). Ask your SaaS provider to recharge.`
    );
    (err as any).code = "CREDIT_LINE_INSUFFICIENT";
    (err as any).statusCode = 402;
    (err as any).requiredMinor = amount;
    (err as any).balanceMinor = facility.balanceMinor;
    throw err;
  }
}

/** Debit SaaS facility after a successful credit-line send (idempotent by reference_id). */
export async function debitWhitelabelCreditLineFacility(params: {
  amountMinor: number;
  referenceType?: string;
  referenceId?: string;
  description?: string;
}): Promise<{ ok: boolean; skipped?: boolean; balanceMinor?: number }> {
  const amount = Math.max(0, Math.round(params.amountMinor));
  if (amount <= 0) return { ok: true, skipped: true };

  const base = customerApiBase();
  const headers = productionKeyHeaders();
  if (!base || !headers) return { ok: true, skipped: true };

  try {
    const res = await fetch(`${base}/api/customer/credit-line/debit`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        amount_minor: amount,
        reference_type: params.referenceType || null,
        reference_id: params.referenceId || null,
        description: params.description || null,
      }),
      signal: AbortSignal.timeout(20000),
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      console.error(
        `[WhitelabelCreditLine] Debit failed status=${res.status} code=${body.code || ""}:`,
        body.error || body
      );
      return { ok: false, balanceMinor: Number(body.balance_minor) || undefined };
    }
    return {
      ok: true,
      balanceMinor: Number(body.balance_minor) || undefined,
    };
  } catch (e: any) {
    console.error("[WhitelabelCreditLine] Debit request error:", e?.message || e);
    return { ok: false };
  }
}
