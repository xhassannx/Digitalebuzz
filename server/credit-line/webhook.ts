import { eq } from "drizzle-orm";
import { db } from "../../db";
import { organizationWhatsappBilling } from "@shared/schema";
import { upsertOrgWhatsappBilling, getOrgWhatsappBilling } from "./org-billing";

function sanitizeBaseUrl(raw: string | undefined): string {
  return (raw || "").split(/\s*[\n#]/)[0].trim().replace(/\/+$/, "");
}

/**
 * Public URL to give the credit-line supplier (Interakt, etc.) as default callback
 * for number-connect / WABA_ONBOARDED responses.
 *
 * Mirrors Meta webhook routing:
 * Meta → CUSTOMER_API_BASE_URL (central) → WEBHOOK_FORWARD_URLS → whitelabel panel
 * Credit line should use the same central host when CUSTOMER_API_BASE_URL is set.
 */
export function resolveCreditLineWebhookUrl(): {
  url: string;
  verifyTokenHint: string;
  source: "credit_line_webhook_url" | "webhook_url_base" | "central" | "base_url";
  /** Same-panel path that receives forwards from central */
  localReceiveUrl: string;
  note: string;
} {
  const localBase = sanitizeBaseUrl(process.env.BASE_URL) || "http://localhost:5000";
  const localReceiveUrl = `${localBase}/api/webhooks/credit-line`;
  const verifyTokenHint = "WEBHOOK_VERIFY_TOKEN (or CREDIT_LINE_WEBHOOK_VERIFY_TOKEN)";

  const explicit = (process.env.CREDIT_LINE_WEBHOOK_URL || "").split(/\s*[\n#]/)[0].trim();
  if (explicit) {
    return {
      url: explicit,
      verifyTokenHint,
      source: "credit_line_webhook_url",
      localReceiveUrl,
      note: "Using CREDIT_LINE_WEBHOOK_URL. Share this with the supplier.",
    };
  }

  const metaWebhook = (process.env.WEBHOOK_URL || "").split(/\s*[\n#]/)[0].trim();
  if (metaWebhook) {
    try {
      const u = new URL(metaWebhook);
      return {
        url: `${u.origin}/api/webhooks/credit-line`,
        verifyTokenHint,
        source: "webhook_url_base",
        localReceiveUrl,
        note: "Derived from WEBHOOK_URL host (same host Meta uses).",
      };
    } catch {
      /* fall through */
    }
  }

  const central = sanitizeBaseUrl(
    process.env.OAUTH_CENTRAL_URL || process.env.CUSTOMER_API_BASE_URL
  );
  if (central) {
    return {
      url: `${central}/api/webhooks/credit-line`,
      verifyTokenHint,
      source: "central",
      localReceiveUrl,
      note:
        "Same pattern as Meta: share CENTRAL URL with supplier. Central must run this credit-line webhook and forward via WEBHOOK_FORWARD_URLS to each whitelabel /api/webhooks/credit-line.",
    };
  }

  return {
    url: localReceiveUrl,
    verifyTokenHint,
    source: "base_url",
    localReceiveUrl,
    note: "No CUSTOMER_API_BASE_URL — supplier calls this panel directly.",
  };
}

function expectedVerifyToken(): string | undefined {
  return (
    process.env.CREDIT_LINE_WEBHOOK_VERIFY_TOKEN ||
    process.env.WEBHOOK_VERIFY_TOKEN ||
    process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN ||
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ||
    undefined
  );
}

export function verifyCreditLineWebhookChallenge(query: {
  mode?: string;
  token?: string;
  challenge?: string;
}): { ok: true; challenge: string } | { ok: false; status: number; message: string } {
  const mode = query.mode;
  const token = query.token;
  const challenge = query.challenge;
  if (mode !== "subscribe" || !challenge) {
    return { ok: false, status: 403, message: "Forbidden" };
  }
  const expected = expectedVerifyToken();
  if (expected && token !== expected) {
    return { ok: false, status: 403, message: "Forbidden - Token mismatch" };
  }
  return { ok: true, challenge: String(challenge) };
}

type ConnectPayload = {
  event?: string;
  wabaId?: string;
  phoneNumberId?: string;
  phoneNumber?: string;
  isvNameToken?: string;
  solutionId?: string;
  raw: Record<string, unknown>;
};

function parseCreditLineConnectBody(body: any): ConnectPayload | null {
  if (!body || typeof body !== "object") return null;

  // Interakt sample: { event: "WABA_ONBOARDED", isv_name_token, waba_id, phone_number_id }
  if (typeof body.event === "string" && (body.waba_id || body.wabaId)) {
    return {
      event: String(body.event),
      wabaId: String(body.waba_id || body.wabaId || ""),
      phoneNumberId: body.phone_number_id || body.phoneNumberId
        ? String(body.phone_number_id || body.phoneNumberId)
        : undefined,
      phoneNumber: body.phone_number || body.phoneNumber
        ? String(body.phone_number || body.phoneNumber)
        : undefined,
      isvNameToken: body.isv_name_token || body.isvNameToken
        ? String(body.isv_name_token || body.isvNameToken)
        : undefined,
      solutionId: body.solution_id || body.solutionId
        ? String(body.solution_id || body.solutionId)
        : undefined,
      raw: body,
    };
  }

  // Meta-style account_update / PARTNER_ADDED (or supplier wrapping Meta shape)
  const entries = Array.isArray(body.entry) ? body.entry : [];
  for (const entry of entries) {
    const changes = entry?.changes || [];
    for (const change of changes) {
      const value = change?.value || {};
      const event = value.event || change?.field;
      const wabaInfo = value.waba_info || value.wabaInfo || {};
      const wabaId =
        wabaInfo.waba_id ||
        wabaInfo.wabaId ||
        entry?.id ||
        value.waba_id ||
        value.wabaId;
      if (!wabaId) continue;
      return {
        event: event ? String(event) : "PARTNER_ADDED",
        wabaId: String(wabaId),
        phoneNumberId: value.phone_number_id || wabaInfo.phone_number_id
          ? String(value.phone_number_id || wabaInfo.phone_number_id)
          : undefined,
        phoneNumber: wabaInfo.phone_number ? String(wabaInfo.phone_number) : undefined,
        solutionId: wabaInfo.solution_id ? String(wabaInfo.solution_id) : undefined,
        raw: body,
      };
    }
  }

  return null;
}

async function findOrgIdForWaba(wabaId: string): Promise<string | null> {
  const [byWaba] = await db
    .select()
    .from(organizationWhatsappBilling)
    .where(eq(organizationWhatsappBilling.creditLineWabaId, wabaId))
    .limit(1);
  if (byWaba?.organizationId) return byWaba.organizationId;

  // Pending credit_line rows without WABA yet — match latest pending if only one
  const pending = await db.select().from(organizationWhatsappBilling);
  const candidates = pending.filter(
    (r) =>
      r.billingMode === "credit_line" &&
      (r.creditLineStatus === "pending" || r.creditLineStatus === "active") &&
      (!r.creditLineWabaId || r.creditLineWabaId === wabaId)
  );
  if (candidates.length === 1) return candidates[0]!.organizationId;
  const exactPending = candidates.filter((r) => !r.creditLineWabaId);
  if (exactPending.length === 1) return exactPending[0]!.organizationId;
  return null;
}

/**
 * Handle supplier callback after number / WABA connect on credit line.
 */
export async function handleCreditLineConnectWebhook(
  body: any,
  providerHint?: string
): Promise<{ handled: boolean; organizationId?: string; event?: string; detail?: string }> {
  const parsed = parseCreditLineConnectBody(body);
  if (!parsed?.wabaId) {
    return { handled: false, detail: "Unrecognized credit-line payload (no waba_id)" };
  }

  const eventUpper = (parsed.event || "").toUpperCase();
  const isConnectEvent =
    eventUpper.includes("ONBOARD") ||
    eventUpper.includes("PARTNER_ADDED") ||
    eventUpper === "WABA_ONBOARDED" ||
    !!parsed.phoneNumberId;

  if (!isConnectEvent && !parsed.phoneNumberId) {
    return {
      handled: false,
      event: parsed.event,
      detail: `Ignored event ${parsed.event || "unknown"}`,
    };
  }

  const organizationId = await findOrgIdForWaba(parsed.wabaId);
  if (!organizationId) {
    console.warn(
      `[CreditLine Webhook] No org mapped for WABA ${parsed.wabaId}. Set org to credit_line before connect, or store waba after tp-signup.`
    );
    return {
      handled: true,
      event: parsed.event,
      detail: `No organization found for waba_id=${parsed.wabaId}`,
    };
  }

  const current = await getOrgWhatsappBilling(organizationId);
  await upsertOrgWhatsappBilling({
    organizationId,
    billingMode: "credit_line",
    creditLineProvider: current.creditLineProvider || providerHint || "interakt",
    creditLineStatus: "active",
    creditLineWabaId: parsed.wabaId,
    creditLinePhoneNumberId: parsed.phoneNumberId || current.creditLinePhoneNumberId,
    lastError: null,
    creditLineMetadata: {
      ...(current.creditLineMetadata || {}),
      lastConnectWebhook: {
        at: new Date().toISOString(),
        event: parsed.event,
        phoneNumber: parsed.phoneNumber,
        hasIsvToken: !!parsed.isvNameToken,
        providerHint: providerHint || null,
      },
      // Store supplier token if provided (Interakt isv_name_token) — never log full token
      ...(parsed.isvNameToken
        ? { isvNameToken: parsed.isvNameToken, isvNameTokenReceivedAt: new Date().toISOString() }
        : {}),
    },
  });

  console.log(
    `[CreditLine Webhook] Org ${organizationId} marked active for WABA ${parsed.wabaId} event=${parsed.event}`
  );

  return {
    handled: true,
    organizationId,
    event: parsed.event,
    detail: "organization credit_line status set to active",
  };
}

/** Forward credit-line callbacks to other whitelabel BASE_URLs (admin/central host). */
export async function forwardCreditLineWebhook(
  method: "GET" | "POST",
  query: Record<string, string>,
  body: unknown
): Promise<void> {
  const bases = new Set<string>();

  const envUrls = process.env.WEBHOOK_FORWARD_URLS || "";
  for (const u of envUrls.split(",").map((x) => x.trim()).filter(Boolean)) {
    try {
      const parsed = new URL(
        u.includes("/api/webhooks/") ? u : `${u.replace(/\/$/, "")}/api/webhooks/credit-line`
      );
      bases.add(`${parsed.origin}/api/webhooks/credit-line`);
    } catch {
      /* skip */
    }
  }

  try {
    const { webhookForwarder } = await import("../webhooks/forwarder");
    for (const f of webhookForwarder.getForwardingUrls()) {
      if (!f.enabled) continue;
      try {
        const parsed = new URL(f.url);
        bases.add(`${parsed.origin}/api/webhooks/credit-line`);
      } catch {
        /* skip */
      }
    }
  } catch {
    /* forwarder optional at import time */
  }

  const urls = [...bases];
  if (!urls.length) return;

  await Promise.allSettled(
    urls.map(async (url) => {
      if (method === "GET") {
        const qs = new URLSearchParams(query).toString();
        await fetch(`${url}?${qs}`, {
          method: "GET",
          headers: { "X-Credit-Line-Forward": "1" },
          signal: AbortSignal.timeout(10000),
        });
      } else {
        await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Credit-Line-Forward": "1" },
          body: JSON.stringify(body ?? {}),
          signal: AbortSignal.timeout(10000),
        });
      }
    })
  );
}
