import type { CreditLineProviderConfig } from "@shared/schema";
import type {
  CreditLineProvider,
  CreditLineSendTemplateInput,
  CreditLineSendTemplateResult,
  CreditLineTpSignupInput,
} from "./types";

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function apiBase(cfg: CreditLineProviderConfig): string {
  return trimSlash(cfg.apiBaseUrl || "https://amped-express.interakt.ai");
}

function apiVer(cfg: CreditLineProviderConfig): string {
  return (cfg.apiVersion || "v17.0").replace(/^\//, "");
}

function authHeaders(token: string, wabaId: string): Record<string, string> {
  return {
    "x-access-token": token,
    "x-waba-id": wabaId,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

/**
 * Interakt credit-line middleware: Graph-compatible paths on amped-express,
 * auth via x-access-token + x-waba-id (not Bearer customer token).
 */
export const interaktProvider: CreditLineProvider = {
  id: "interakt",

  async sendTemplate(
    cfg: CreditLineProviderConfig,
    input: CreditLineSendTemplateInput
  ): Promise<CreditLineSendTemplateResult> {
    const token = (cfg.accessToken || "").trim();
    if (!token) {
      return { ok: false, status: 0, responseText: "Interakt access token is not configured" };
    }
    const useMmLite = !!(input.useMmLite && cfg.mmLiteEnabled !== false);
    const pathSuffix = useMmLite ? "marketing_messages" : "messages";
    const url = `${apiBase(cfg)}/api/${apiVer(cfg)}/${input.phoneNumberId}/${pathSuffix}`;

    console.log(
      `[Interakt] POST ${url} waba=${input.wabaId} mmLite=${useMmLite} bodyKeys=${Object.keys(input.body || {}).join(",")}`
    );

    const response = await fetch(url, {
      method: "POST",
      headers: authHeaders(token, input.wabaId),
      body: JSON.stringify(input.body),
    });
    let responseText = await response.text();
    let json: any;
    try {
      json = JSON.parse(responseText);
    } catch {
      json = undefined;
    }

    if (
      !response.ok &&
      typeof responseText === "string" &&
      /invalid request/i.test(responseText.trim())
    ) {
      responseText = JSON.stringify({
        error: {
          message:
            "Interakt middleware rejected the request (Invalid request). Confirm Partner Solution ACTIVE, Embedded Signup used solutionID, tp-signup + subscribed_apps completed, phone verified — then ask Interakt SPOC to enable Cloud API on amped-express for this WABA.",
          type: "interakt_middleware",
          code: "INTERAKT_INVALID_REQUEST",
          interakt_raw: "Invalid request",
          waba_id: input.wabaId,
          phone_number_id: input.phoneNumberId,
          url,
        },
      });
      try {
        json = JSON.parse(responseText);
      } catch {
        /* ignore */
      }
    }

    return { ok: response.ok, status: response.status, responseText, json };
  },

  /**
   * Register webhook override on Interakt middleware (docs: POST /{WABA_ID}/subscribed_apps).
   */
  async subscribeApps(
    cfg: CreditLineProviderConfig,
    input: { wabaId: string; overrideCallbackUri: string; verifyToken: string }
  ): Promise<{ ok: boolean; status: number; body: unknown }> {
    const token = (cfg.accessToken || "").trim();
    if (!token) {
      return { ok: false, status: 0, body: { error: "Interakt access token is not configured" } };
    }
    const url = `${apiBase(cfg)}/api/${apiVer(cfg)}/${input.wabaId}/subscribed_apps`;
    console.log(`[Interakt] POST ${url} (subscribed_apps)`);
    const response = await fetch(url, {
      method: "POST",
      headers: authHeaders(token, input.wabaId),
      body: JSON.stringify({
        override_callback_uri: input.overrideCallbackUri,
        verify_token: input.verifyToken,
      }),
    });
    const text = await response.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      /* keep text */
    }
    return { ok: response.ok, status: response.status, body };
  },

  async tpSignup(cfg: CreditLineProviderConfig, input: CreditLineTpSignupInput) {
    const token = (cfg.accessToken || "").trim();
    if (!token) {
      return { ok: false, status: 0, body: { error: "Interakt access token is not configured" } };
    }
    const wabaInfo: Record<string, unknown> = {
      waba_id: input.wabaId,
      solution_id: input.solutionId,
      data_localization_region: input.dataLocalizationRegion || "IN",
    };
    if (input.phoneNumber) wabaInfo.phone_number = input.phoneNumber;

    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                event: "PARTNER_ADDED",
                waba_info: wabaInfo,
              },
            },
          ],
        },
      ],
      auto_subscribe: input.autoSubscribe ?? false,
      object: "tech_partner",
    };

    const response = await fetch("https://api.interakt.ai/v1/organizations/tp-signup/", {
      method: "POST",
      headers: {
        Authorization: token.startsWith("Bearer ") ? token : token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      /* keep text */
    }
    return { ok: response.ok, status: response.status, body };
  },

  async tpUnsubscribe(cfg: CreditLineProviderConfig, input: { wabaId: string }) {
    const token = (cfg.accessToken || "").trim();
    if (!token) {
      return { ok: false, status: 0, body: { error: "Interakt access token is not configured" } };
    }
    const response = await fetch("https://api.interakt.ai/v1/organizations/tp-unsubscribe/", {
      method: "POST",
      headers: {
        Authorization: token.startsWith("Bearer ") ? token : token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ waba_id: input.wabaId }),
    });
    const text = await response.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      /* keep text */
    }
    return { ok: response.ok, status: response.status, body };
  },
};
