export const WA_EMBEDDED_SIGNUP_STORAGE_KEY = "wa_embedded_signup_pending";

/** Meta sends WA_EMBEDDED_SIGNUP as JSON in event.data (often a string, not an object). */
export type ParsedEmbeddedSignupMessage = {
  event: string;
  wabaId: string;
  phoneNumberId: string;
  businessId?: string;
};

declare global {
  interface Window {
    FB?: {
      init: (opts: Record<string, unknown>) => void;
      login: (cb: (response: { authResponse?: { code?: string } }) => void, opts: Record<string, unknown>) => void;
    };
    fbAsyncInit?: () => void;
  }
}

export function saveEmbeddedSignupToLocalStorage(body: {
  state?: string;
  wabaId: string;
  phoneNumberId: string;
  businessId?: string;
}): void {
  try {
    localStorage.setItem(WA_EMBEDDED_SIGNUP_STORAGE_KEY, JSON.stringify({ ...body, savedAt: Date.now() }));
  } catch {
    /* ignore quota / private mode */
  }
}

export function parseWhatsAppEmbeddedSignupMessage(
  event: MessageEvent
): ParsedEmbeddedSignupMessage | null {
  if (!event.origin.endsWith("facebook.com")) return null;
  try {
    const raw = event.data;
    if (raw == null) return null;
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (data?.type !== "WA_EMBEDDED_SIGNUP") return null;
    const payload = data.data || {};
    const wabaId = String(
      payload.waba_id || payload.whatsapp_business_account_id || payload.wabaId || ""
    ).trim();
    const phoneNumberId = String(payload.phone_number_id || payload.phoneNumberId || "").trim();
    return {
      event: String(data.event || ""),
      wabaId,
      phoneNumberId,
      businessId: payload.business_id || payload.businessId,
    };
  } catch {
    return null;
  }
}

export function loadFacebookSdk(appId: string, version = "v23.0"): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.FB) {
      window.FB.init({ appId, cookie: true, xfbml: false, version });
      resolve();
      return;
    }
    const existing = document.getElementById("facebook-jssdk");
    if (existing) {
      const wait = setInterval(() => {
        if (window.FB) {
          clearInterval(wait);
          resolve();
        }
      }, 50);
      setTimeout(() => {
        clearInterval(wait);
        if (window.FB) resolve();
        else reject(new Error("Facebook SDK did not initialize"));
      }, 10000);
      return;
    }
    window.fbAsyncInit = () => {
      window.FB?.init({ appId, cookie: true, xfbml: false, version });
      resolve();
    };
    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Failed to load Facebook SDK"));
    document.body.appendChild(script);
  });
}

export type EmbeddedSignupLaunchConfig = {
  appId: string;
  configId: string;
  state: string;
  callbackUrl: string;
  extras: Record<string, unknown>;
};

export type WhatsAppOAuthPopupHandlers = {
  onOAuthSuccess: (payload?: { onboarding?: unknown }) => void;
  onPhonePickRequired: (integrationId: string, payload?: { onboarding?: unknown }) => void;
  onOAuthError: (error: string) => void;
  onEmbeddedFinish: (body: {
    state?: string;
    wabaId: string;
    phoneNumberId: string;
    businessId?: string;
  }) => void;
};

export function attachWhatsAppOAuthMessageListener(
  popup: Window | null,
  oauthState: string | undefined,
  handlers: WhatsAppOAuthPopupHandlers
): () => void {
  const messageHandler = (event: MessageEvent) => {
    const embedded = parseWhatsAppEmbeddedSignupMessage(event);
    if (embedded?.event === "FINISH" && embedded.wabaId && embedded.phoneNumberId) {
      console.log("[WhatsApp Integration] Embedded Signup FINISH:", embedded);
      const body = {
        state: oauthState,
        wabaId: embedded.wabaId,
        phoneNumberId: embedded.phoneNumberId,
        businessId: embedded.businessId,
      };
      saveEmbeddedSignupToLocalStorage(body);
      handlers.onEmbeddedFinish(body);
      return;
    }

    const msg = event.data;
    if (msg?.type === "WHATSAPP_BUSINESS_OAUTH_SUCCESS") {
      handlers.onOAuthSuccess({ onboarding: msg.onboarding });
    } else if (msg?.type === "WHATSAPP_BUSINESS_PHONE_PICK_REQUIRED") {
      handlers.onPhonePickRequired(String(msg.integrationId || ""), { onboarding: msg.onboarding });
    } else if (msg?.type === "WHATSAPP_BUSINESS_OAUTH_ERROR") {
      handlers.onOAuthError(msg.error || "Failed to connect WhatsApp Business");
    }
  };
  window.addEventListener("message", messageHandler);
  return () => window.removeEventListener("message", messageHandler);
}

export async function launchWhatsAppEmbeddedSignupSdk(
  config: EmbeddedSignupLaunchConfig
): Promise<Window | null> {
  await loadFacebookSdk(config.appId);
  const width = 600;
  const height = 700;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;
  const popupFeatures = `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`;

  return new Promise((resolve, reject) => {
    window.FB!.login(
      (response) => {
        if (response.authResponse?.code) {
          const callbackUrl = `${config.callbackUrl}?code=${encodeURIComponent(response.authResponse.code)}&state=${encodeURIComponent(config.state)}`;
          const popup = window.open(callbackUrl, "WhatsApp Business OAuth", popupFeatures);
          resolve(popup);
          return;
        }
        reject(new Error("WhatsApp signup was cancelled or not authorized"));
      },
      {
        config_id: config.configId,
        response_type: "code",
        override_default_response_type: true,
        redirect_uri: config.callbackUrl,
        extras: config.extras,
      }
    );
  });
}

export type PostOAuthSyncResult = {
  success: boolean;
  phonesAdded: number;
  source?: string;
};

/** Poll server after OAuth — uses localStorage embedded signup IDs + Graph discovery. */
export async function runPostOAuthPhoneSync(
  apiRequest: (method: string, url: string, body?: unknown) => Promise<Response>,
  onSuccess?: (result: PostOAuthSyncResult) => void
): Promise<void> {
  const readStash = () => {
    try {
      const raw = localStorage.getItem(WA_EMBEDDED_SIGNUP_STORAGE_KEY);
      if (!raw) return {};
      return JSON.parse(raw) as {
        wabaId?: string;
        phoneNumberId?: string;
        businessId?: string;
        state?: string;
      };
    } catch {
      return {};
    }
  };

  const attempt = async (): Promise<PostOAuthSyncResult> => {
    const stash = readStash();
    const res = await apiRequest("POST", "/api/integrations/whatsapp-business/oauth/sync-phones", {
      wabaId: stash.wabaId,
      phoneNumberId: stash.phoneNumberId,
      businessId: stash.businessId,
    });
    const data = await res.json();
    return {
      success: Boolean(data.success),
      phonesAdded: Number(data.phonesAdded || 0),
      source: data.source,
    };
  };

  const delays = [0, 3000, 8000, 15000, 30000, 60000];
  for (const delay of delays) {
    if (delay > 0) {
      await new Promise((r) => setTimeout(r, delay));
    }
    try {
      const result = await attempt();
      if (result.phonesAdded > 0) {
        try {
          localStorage.removeItem(WA_EMBEDDED_SIGNUP_STORAGE_KEY);
        } catch {
          /* ignore */
        }
        onSuccess?.(result);
        return;
      }
    } catch (e) {
      console.warn("[WhatsApp Integration] post-OAuth sync attempt failed:", e);
    }
  }
}
