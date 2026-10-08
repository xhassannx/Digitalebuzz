import { storage } from "../../storage";
import { createOfficialSessionsForOAuthPhones } from "./whatsapp-oauth-phone-sessions";

const EMBEDDED_SIGNUP_OAUTH_PREFIX = "wa_es:";
export const EMBEDDED_SIGNUP_PENDING_CONFIG_KEY = "embeddedSignupPending";

export function serializeEmbeddedSignupOAuthPayload(info: {
  wabaId: string;
  phoneNumberId: string;
  businessId?: string;
}): string {
  return `${EMBEDDED_SIGNUP_OAUTH_PREFIX}${JSON.stringify(info)}`;
}

export function parseEmbeddedSignupOAuthPayload(
  codeVerifier: string | null | undefined
): { wabaId: string; phoneNumberId: string; businessId?: string } | null {
  if (!codeVerifier || !codeVerifier.startsWith(EMBEDDED_SIGNUP_OAUTH_PREFIX)) return null;
  try {
    const parsed = JSON.parse(codeVerifier.slice(EMBEDDED_SIGNUP_OAUTH_PREFIX.length));
    const wabaId = String(parsed.wabaId || parsed.waba_id || "").trim();
    const phoneNumberId = String(parsed.phoneNumberId || parsed.phone_number_id || "").trim();
    if (!wabaId && !phoneNumberId) return null;
    return {
      wabaId,
      phoneNumberId,
      businessId: parsed.businessId || parsed.business_id,
    };
  } catch {
    return null;
  }
}

export async function persistEmbeddedSignupSession(params: {
  userId: string;
  state?: string;
  wabaId: string;
  phoneNumberId: string;
  businessId?: string;
}): Promise<void> {
  const { userId, state, wabaId, phoneNumberId, businessId } = params;
  if (!wabaId && !phoneNumberId) return;

  stashEmbeddedSignupSession(userId, { wabaId, phoneNumberId, businessId });

  let oauthState = state ? await storage.getOAuthState(state) : undefined;
  if (!oauthState) {
    oauthState = await storage.getLatestActiveOAuthState(userId, "whatsapp-business");
  }
  if (oauthState && oauthState.userId === userId) {
    await storage.updateOAuthState(oauthState.state, {
      codeVerifier: serializeEmbeddedSignupOAuthPayload({ wabaId, phoneNumberId, businessId }),
    });
    console.log(
      `[WhatsApp OAuth] Persisted Embedded Signup on OAuth state (WABA ${wabaId}, phone ${phoneNumberId})`
    );
  }

  const integrations = await storage.getIntegrationsByUser(userId);
  const latestWa = integrations
    .filter((i) => i.name === "whatsapp-business")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  if (latestWa) {
    const cfg = (latestWa.config && typeof latestWa.config === "object" ? latestWa.config : {}) as Record<
      string,
      unknown
    >;
    await storage.updateIntegration(latestWa.id, userId, {
      config: {
        ...cfg,
        [EMBEDDED_SIGNUP_PENDING_CONFIG_KEY]: {
          wabaId,
          phoneNumberId,
          businessId,
          createdAt: Date.now(),
        },
      },
    });
    console.log(
      `[WhatsApp OAuth] Persisted Embedded Signup on integration ${latestWa.id} (WABA ${wabaId}, phone ${phoneNumberId})`
    );
  }
}

export function readEmbeddedSignupFromOAuthState(oauthState: {
  codeVerifier?: string | null;
}): { wabaId: string; phoneNumberId: string; businessId?: string } | null {
  return parseEmbeddedSignupOAuthPayload(oauthState.codeVerifier);
}

const GRAPH_API_VERSION = "v23.0";
const FACEBOOK_GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const WEBHOOK_URL =
  process.env.WEBHOOK_URL ||
  `${(process.env.BASE_URL || "http://localhost:5000").split(/\s*[\n#]/)[0].trim().replace(/\/+$/, "")}/api/webhooks/whatsapp-business`;

const PARTNER_ACCOUNT_EVENTS = new Set([
  "PARTNER_APP_INSTALLED",
  "PARTNER_ADDED",
  "PARTNER_APP_UNINSTALLED",
]);

/** User OAuth token first; fall back to META_SYSTEM_USER_TOKEN when Graph returns (#100) etc. */
export function pickWhatsAppApiTokens(userAccessToken?: string): string[] {
  const tokens: string[] = [];
  const user = userAccessToken?.trim();
  const system = process.env.META_SYSTEM_USER_TOKEN?.trim();
  if (user) tokens.push(user);
  if (system && system !== user) tokens.push(system);
  return tokens;
}

export type EmbeddedSignupSessionInfo = {
  businessId?: string;
  wabaId: string;
  phoneNumberId: string;
  createdAt: number;
};

const SESSION_TTL_MS = 20 * 60 * 1000;
const embeddedSignupSessions = new Map<string, EmbeddedSignupSessionInfo>();

export function stashEmbeddedSignupSession(userId: string, info: Omit<EmbeddedSignupSessionInfo, "createdAt">) {
  if (!info.wabaId && !info.phoneNumberId) return;
  embeddedSignupSessions.set(userId, { ...info, createdAt: Date.now() });
}

export function takeEmbeddedSignupSession(userId: string): EmbeddedSignupSessionInfo | null {
  const entry = embeddedSignupSessions.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > SESSION_TTL_MS) {
    embeddedSignupSessions.delete(userId);
    return null;
  }
  embeddedSignupSessions.delete(userId);
  return entry;
}

export function peekEmbeddedSignupSession(userId: string): EmbeddedSignupSessionInfo | null {
  const entry = embeddedSignupSessions.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > SESSION_TTL_MS) {
    embeddedSignupSessions.delete(userId);
    return null;
  }
  return entry;
}

export async function subscribeWabaToApp(
  wabaId: string,
  accessToken: string,
  options?: { organizationId?: string | null; force?: boolean }
): Promise<boolean> {
  if (!options?.force && options?.organizationId) {
    try {
      const { shouldSkipMetaGraphSignupForCreditLine } = await import(
        "../../credit-line/skip-meta-graph-signup"
      );
      const skip = await shouldSkipMetaGraphSignupForCreditLine(options.organizationId);
      if (skip.skip) {
        console.log(
          `[WhatsApp Embedded Signup] Skipping Meta subscribed_apps for WABA ${wabaId} — ${skip.reason}`
        );
        return true;
      }
    } catch {
      /* fall through to Meta subscribe */
    }
  }
  const webhookVerifyToken = process.env.WEBHOOK_VERIFY_TOKEN || "helicoptic@2025";
  for (const token of pickWhatsAppApiTokens(accessToken)) {
    try {
      const subscribeResponse = await fetch(`${FACEBOOK_GRAPH_API_BASE}/${wabaId}/subscribed_apps`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      if (!subscribeResponse.ok) {
        const err = await subscribeResponse.json().catch(() => ({}));
        console.warn(
          `[WhatsApp Embedded Signup] WABA ${wabaId} subscribe failed:`,
          err.error?.message || subscribeResponse.status
        );
        continue;
      }
      const overrideResponse = await fetch(`${FACEBOOK_GRAPH_API_BASE}/${wabaId}/subscribed_apps`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          override_callback_uri: WEBHOOK_URL,
          verify_token: webhookVerifyToken,
        }),
      });
      if (overrideResponse.ok) {
        console.log(`[WhatsApp Embedded Signup] ✅ Subscribed WABA ${wabaId} with webhook override`);
        return true;
      }
      const overrideErr = await overrideResponse.json().catch(() => ({}));
      console.warn(
        `[WhatsApp Embedded Signup] WABA ${wabaId} webhook override failed:`,
        overrideErr.error?.message || overrideResponse.status
      );
    } catch (e: any) {
      console.warn(`[WhatsApp Embedded Signup] subscribe error for WABA ${wabaId}:`, e.message);
    }
  }
  return false;
}

const PHONE_FIELDS =
  "id,display_phone_number,verified_name,code_verification_status,quality_rating,last_onboarded_time";

export async function listPhonesForWaba(wabaId: string, accessToken?: string): Promise<any[]> {
  if (!wabaId) return [];
  for (const token of pickWhatsAppApiTokens(accessToken)) {
    try {
      const listRes = await fetch(
        `${FACEBOOK_GRAPH_API_BASE}/${wabaId}/phone_numbers?fields=${PHONE_FIELDS}&access_token=${encodeURIComponent(token)}`
      );
      if (listRes.ok) {
        const listData = await listRes.json();
        return (listData.data || []).map((p: any) => ({ ...p, wabaId }));
      }
    } catch (_) {}
  }
  return [];
}

export async function fetchPhoneFromEmbeddedSignup(
  accessToken: string,
  wabaId: string,
  phoneNumberId: string,
  quiet = false
): Promise<any | null> {
  for (const token of pickWhatsAppApiTokens(accessToken)) {
    try {
      const phoneRes = await fetch(
        `${FACEBOOK_GRAPH_API_BASE}/${phoneNumberId}?fields=${PHONE_FIELDS}&access_token=${encodeURIComponent(token)}`
      );
      if (phoneRes.ok) {
        const phone = await phoneRes.json();
        let wabaName = wabaId;
        const resolvedWabaId = wabaId || phone.whatsapp_business_account?.id || "";
        if (resolvedWabaId) {
          try {
            const wabaRes = await fetch(
              `${FACEBOOK_GRAPH_API_BASE}/${resolvedWabaId}?fields=id,name&access_token=${encodeURIComponent(token)}`
            );
            if (wabaRes.ok) {
              const waba = await wabaRes.json();
              wabaName = waba.name || resolvedWabaId;
            }
          } catch (_) {}
        }
        return { ...phone, wabaId: resolvedWabaId || wabaId, wabaName };
      }
      if (!quiet) {
        const phoneErr = await phoneRes.json().catch(() => ({}));
        console.warn(
          `[WhatsApp Embedded Signup] Direct phone fetch failed for ${phoneNumberId}:`,
          phoneErr.error?.message || phoneRes.status
        );
      }
    } catch (e: any) {
      if (!quiet) console.warn(`[WhatsApp Embedded Signup] Phone fetch error:`, e.message);
    }

    if (wabaId) {
      try {
        const listRes = await fetch(
          `${FACEBOOK_GRAPH_API_BASE}/${wabaId}/phone_numbers?fields=${PHONE_FIELDS}&access_token=${encodeURIComponent(token)}`
        );
        if (listRes.ok) {
          const listData = await listRes.json();
          const phones = listData.data || [];
          const match =
            phones.find((p: any) => String(p.id) === String(phoneNumberId)) ||
            (phones.length === 1 ? phones[0] : null);
          if (match) return { ...match, wabaId };
        }
      } catch (_) {}
    }
  }
  return null;
}

async function resolveWhatsAppIntegration(
  userId: string,
  organizationId?: string,
  integrationId?: string
) {
  if (integrationId) {
    const direct = await storage.getIntegration(integrationId, userId);
    if (direct?.name === "whatsapp-business") return direct;
  }
  const list = await storage.getIntegrationsByUser(userId, organizationId);
  const waIntegrations = list
    .filter((i) => i.name === "whatsapp-business" && i.status === "connected")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return waIntegrations[0];
}

export async function completeEmbeddedSignupForUser(params: {
  userId: string;
  organizationId?: string;
  integrationId?: string;
  wabaId: string;
  phoneNumberId: string;
  businessId?: string;
  /** When false, keep session stash for OAuth callback retry */
  consumeStash?: boolean;
}): Promise<{ success: boolean; error?: string; integrationId?: string; phone?: any }> {
  const { userId, organizationId, integrationId, wabaId, phoneNumberId, businessId } = params;
  if (!wabaId || !phoneNumberId) {
    return { success: false, error: "Missing wabaId or phoneNumberId from Embedded Signup" };
  }

  let integration = await resolveWhatsAppIntegration(userId, organizationId, integrationId);
  if (!integration) {
    stashEmbeddedSignupSession(userId, { wabaId, phoneNumberId, businessId });
    return {
      success: false,
      error: "WhatsApp integration not ready yet — session saved; retry after OAuth completes",
    };
  }

  const accessToken = (integration.credentials as any)?.access_token;
  if (!accessToken) {
    return { success: false, error: "No access token on WhatsApp integration" };
  }

  console.log(
    `[WhatsApp Embedded Signup] Completing onboarding integration=${integration.id} waba=${wabaId} phone=${phoneNumberId}`
  );

  await subscribeWabaToApp(wabaId, accessToken, { organizationId });

  const phone = await fetchPhoneFromEmbeddedSignup(accessToken, wabaId, phoneNumberId);
  if (!phone?.id) {
    stashEmbeddedSignupSession(userId, { wabaId, phoneNumberId, businessId });
    return {
      success: false,
      error: "Could not fetch phone details from Meta — session saved for OAuth retry",
      integrationId: integration.id,
    };
  }

  await createOfficialSessionsForOAuthPhones({
    userId,
    integrationId: integration.id,
    accessToken,
    phones: [phone],
  });

  if (params.consumeStash !== false) {
    takeEmbeddedSignupSession(userId);
  }

  console.log(
    `[WhatsApp Embedded Signup] ✅ Phone ${phone.display_phone_number || phone.id} added for user ${userId}`
  );
  return { success: true, integrationId: integration.id, phone };
}

export async function tryCompleteFromStashedSession(
  userId: string,
  accessToken: string,
  integrationId: string
): Promise<any[]> {
  let wabaId = "";
  let phoneNumberId = "";
  let businessId: string | undefined;

  const session = peekEmbeddedSignupSession(userId);
  if (session?.wabaId && session?.phoneNumberId) {
    wabaId = session.wabaId;
    phoneNumberId = session.phoneNumberId;
    businessId = session.businessId;
  } else {
    const integration = await storage.getIntegration(integrationId, userId);
    const pending = (integration?.config as any)?.[EMBEDDED_SIGNUP_PENDING_CONFIG_KEY];
    if (pending?.wabaId && pending?.phoneNumberId) {
      wabaId = String(pending.wabaId);
      phoneNumberId = String(pending.phoneNumberId);
      businessId = pending.businessId;
      console.log(
        `[WhatsApp OAuth] Using Embedded Signup from integration config: WABA ${wabaId}, phone ${phoneNumberId}`
      );
    }
  }

  if (!wabaId || !phoneNumberId) return [];

  console.log(
    `[WhatsApp OAuth] Using Embedded Signup session info: WABA ${wabaId}, phone ${phoneNumberId}`
  );

  await subscribeWabaToApp(wabaId, accessToken, {
    organizationId: (await storage.getIntegration(integrationId, userId))?.organizationId || null,
  });
  const phone = await fetchPhoneFromEmbeddedSignup(accessToken, wabaId, phoneNumberId);
  if (phone?.id) {
    takeEmbeddedSignupSession(userId);
    const integration = await storage.getIntegration(integrationId, userId);
    if (integration?.config && (integration.config as any)[EMBEDDED_SIGNUP_PENDING_CONFIG_KEY]) {
      const cfg = { ...(integration.config as Record<string, unknown>) };
      delete cfg[EMBEDDED_SIGNUP_PENDING_CONFIG_KEY];
      await storage.updateIntegration(integrationId, userId, { config: cfg });
    }
    return [phone];
  }
  return [];
}

/** When OAuth missed phone discovery, link webhook only if integration expects this exact phone (multi-tenant safe). */
export async function tryAutoProvisionSessionFromWebhook(
  phoneNumberId: string,
  _displayPhoneNumber?: string
): Promise<string[]> {
  if (!phoneNumberId) return [];

  const existing = await storage.getOfficialSessionsByApiPhoneNumberId(String(phoneNumberId));
  const active = existing.filter((s) => !s.deletedAt && s.status === "connected");
  if (active.length > 0) {
    return active.map((s) => s.sessionId);
  }

  const recentIntegrations = await storage.getRecentConnectedWhatsAppIntegrations(45 * 60 * 1000, 15);
  for (const integration of recentIntegrations) {
    const pending = (integration.config as any)?.[EMBEDDED_SIGNUP_PENDING_CONFIG_KEY];
    if (!pending?.phoneNumberId || String(pending.phoneNumberId) !== String(phoneNumberId)) {
      continue;
    }

    const accessToken = (integration.credentials as any)?.access_token;
    if (!accessToken) continue;

    const wabaId = String(pending.wabaId || "");
    const phone = await fetchPhoneFromEmbeddedSignup(
      accessToken,
      wabaId,
      String(phoneNumberId),
      true
    );
    if (!phone?.id) continue;

    console.log(
      `[WhatsApp Webhook Auto-Provision] Linking expected phone ${phone.display_phone_number || phoneNumberId} to user ${integration.userId} (integration ${integration.id})`
    );

    if (phone.wabaId) {
      await subscribeWabaToApp(phone.wabaId, accessToken, {
        organizationId: integration.organizationId || null,
      });
    }
    await createOfficialSessionsForOAuthPhones({
      userId: integration.userId,
      integrationId: integration.id,
      accessToken,
      phones: [phone],
    });

    const created = await storage.getOfficialSessionsByApiPhoneNumberId(String(phoneNumberId));
    const mine = created.filter((s) => s.userId === integration.userId && !s.deletedAt);
    if (mine.length > 0) {
      return mine.map((s) => s.sessionId);
    }
  }

  return [];
}

const APP_ACCESS_TOKEN =
  process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET
    ? `${process.env.FACEBOOK_APP_ID}|${process.env.FACEBOOK_APP_SECRET}`
    : "";

async function discoverPhonesViaGraph(accessToken: string): Promise<any[]> {
  const phones: any[] = [];
  const wabaIds: string[] = [];

  if (APP_ACCESS_TOKEN) {
    try {
      const debugRes = await fetch(
        `${FACEBOOK_GRAPH_API_BASE}/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(APP_ACCESS_TOKEN)}`
      );
      if (debugRes.ok) {
        const debugData = await debugRes.json();
        for (const scope of debugData.data?.granular_scopes || []) {
          if (
            scope.scope === "whatsapp_business_management" ||
            scope.scope === "whatsapp_business_messaging"
          ) {
            for (const id of scope.target_ids || []) {
              if (!wabaIds.includes(String(id))) wabaIds.push(String(id));
            }
          }
        }
      }
    } catch (_) {}
  }

  for (const wabaId of wabaIds) {
    try {
      const r = await fetch(
        `${FACEBOOK_GRAPH_API_BASE}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating&access_token=${encodeURIComponent(accessToken)}`
      );
      if (r.ok) {
        const d = await r.json();
        for (const p of d.data || []) {
          phones.push({ ...p, wabaId });
        }
      }
    } catch (_) {}
  }

  if (phones.length === 0) {
    try {
      const wabaR = await fetch(
        `${FACEBOOK_GRAPH_API_BASE}/me/owned_whatsapp_business_accounts?fields=id,name,phone_numbers{id,display_phone_number,verified_name,code_verification_status,quality_rating}&access_token=${encodeURIComponent(accessToken)}`
      );
      if (wabaR.ok) {
        const wabaD = await wabaR.json();
        for (const waba of wabaD.data || []) {
          for (const p of waba.phone_numbers?.data || []) {
            phones.push({ ...p, wabaId: waba.id, wabaName: waba.name });
          }
        }
      }
    } catch (_) {}
  }

  const seen = new Set<string>();
  return phones.filter((p) => {
    const id = String(p.id);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/** Called from OAuth callback retries and POST /oauth/sync-phones after client connect. */
export async function discoverAndCreateWhatsAppSessions(params: {
  userId: string;
  integrationId: string;
  accessToken: string;
  wabaId?: string;
  phoneNumberId?: string;
  businessId?: string;
}): Promise<{ phonesAdded: number; phones: any[]; source?: string }> {
  const { userId, integrationId, accessToken, wabaId, phoneNumberId, businessId } = params;
  const integrationRow = await storage.getIntegration(integrationId, userId);
  const organizationId = integrationRow?.organizationId || null;
  const subOpts = { organizationId };

  if (wabaId && phoneNumberId) {
    await persistEmbeddedSignupSession({ userId, wabaId, phoneNumberId, businessId });
    const phone = await fetchPhoneFromEmbeddedSignup(accessToken, wabaId, phoneNumberId);
    if (phone?.id) {
      await subscribeWabaToApp(wabaId, accessToken, subOpts);
      await createOfficialSessionsForOAuthPhones({
        userId,
        integrationId,
        accessToken,
        phones: [phone],
      });
      takeEmbeddedSignupSession(userId);
      return { phonesAdded: 1, phones: [phone], source: "embedded_signup_ids" };
    }
  }

  if (phoneNumberId && !wabaId) {
    const phone = await fetchPhoneFromEmbeddedSignup(accessToken, "", phoneNumberId);
    if (phone?.id) {
      if (phone.wabaId) await subscribeWabaToApp(phone.wabaId, accessToken, subOpts);
      await createOfficialSessionsForOAuthPhones({
        userId,
        integrationId,
        accessToken,
        phones: [phone],
      });
      return { phonesAdded: 1, phones: [phone], source: "phone_number_id_direct" };
    }
  }

  const fromStash = await tryCompleteFromStashedSession(userId, accessToken, integrationId);
  if (fromStash.length > 0) {
    await createOfficialSessionsForOAuthPhones({
      userId,
      integrationId,
      accessToken,
      phones: fromStash,
    });
    return { phonesAdded: fromStash.length, phones: fromStash, source: "stash" };
  }

  const discovered = await discoverPhonesViaGraph(accessToken);
  if (discovered.length > 0) {
    for (const p of discovered) {
      if (p.wabaId) await subscribeWabaToApp(p.wabaId, accessToken, subOpts);
    }
    await createOfficialSessionsForOAuthPhones({
      userId,
      integrationId,
      accessToken,
      phones: discovered,
    });
    return { phonesAdded: discovered.length, phones: discovered, source: "graph_discovery" };
  }

  return { phonesAdded: 0, phones: [], source: "none" };
}

/**
 * Partner onboarding: Meta sends account_update (PARTNER_APP_INSTALLED) with waba_id
 * when OAuth user token has no granular_scopes. Link to a recent OAuth integration.
 */
export async function handleAccountUpdateWebhook(value: any): Promise<void> {
  const event = String(value?.event || "");
  if (!PARTNER_ACCOUNT_EVENTS.has(event)) return;

  const wabaId = String(
    value?.waba_info?.waba_id || value?.waba_id || value?.whatsapp_business_account_id || ""
  ).trim();
  const phoneNumberId = String(
    value?.phone_number_id || value?.phone_info?.phone_number_id || ""
  ).trim();

  if (!wabaId && !phoneNumberId) {
    console.log(`[WhatsApp account_update] Ignoring ${event} — no WABA or phone in payload`);
    return;
  }

  console.log(
    `[WhatsApp account_update] ${event} waba=${wabaId || "-"} phone=${phoneNumberId || "-"}`
  );

  if (event === "PARTNER_APP_UNINSTALLED") {
    const sessions = phoneNumberId
      ? await storage.getOfficialSessionsByApiPhoneNumberId(phoneNumberId)
      : await storage.getOfficialSessionsByWabaId(wabaId);
    for (const session of sessions) {
      if ((session as any).deletedAt) continue;
      try {
        const { businessAPIManager } = await import("../../whatsapp/business-api-client");
        await businessAPIManager.disconnectSession(session.sessionId);
      } catch (_) {}
      await storage.updateSession(session.sessionId, {
        status: "disconnected",
      } as any);
      console.log(
        `[WhatsApp account_update] Marked session ${session.sessionId} disconnected after ${event}`
      );
    }
    return;
  }

  const integrations = await storage.getRecentConnectedWhatsAppIntegrations(60 * 60 * 1000, 10);
  if (integrations.length === 0) {
    console.log("[WhatsApp account_update] No recent WhatsApp OAuth integration to attach");
    return;
  }

  for (const integration of integrations) {
    const accessToken = (integration.credentials as any)?.access_token;
    if (!accessToken) continue;

    const cfg = (integration.config && typeof integration.config === "object"
      ? integration.config
      : {}) as Record<string, unknown>;

    if (wabaId || phoneNumberId) {
      await storage.updateIntegration(integration.id, integration.userId, {
        config: {
          ...cfg,
          [EMBEDDED_SIGNUP_PENDING_CONFIG_KEY]: {
            wabaId: wabaId || (cfg[EMBEDDED_SIGNUP_PENDING_CONFIG_KEY] as any)?.wabaId,
            phoneNumberId:
              phoneNumberId || (cfg[EMBEDDED_SIGNUP_PENDING_CONFIG_KEY] as any)?.phoneNumberId,
            createdAt: Date.now(),
            source: `account_update:${event}`,
          },
        },
      });
    }

    const resolvedWaba = wabaId || String((cfg[EMBEDDED_SIGNUP_PENDING_CONFIG_KEY] as any)?.wabaId || "");
    const resolvedPhone =
      phoneNumberId || String((cfg[EMBEDDED_SIGNUP_PENDING_CONFIG_KEY] as any)?.phoneNumberId || "");

    if (resolvedWaba && resolvedPhone) {
      const phone = await fetchPhoneFromEmbeddedSignup(accessToken, resolvedWaba, resolvedPhone);
      if (phone?.id) {
        await subscribeWabaToApp(resolvedWaba, accessToken, {
          organizationId: integration.organizationId || null,
        });
        await createOfficialSessionsForOAuthPhones({
          userId: integration.userId,
          integrationId: integration.id,
          accessToken,
          phones: [phone],
        });
        const nextCfg = { ...cfg };
        delete nextCfg[EMBEDDED_SIGNUP_PENDING_CONFIG_KEY];
        await storage.updateIntegration(integration.id, integration.userId, { config: nextCfg });
        console.log(
          `[WhatsApp account_update] ✅ Session created for ${phone.display_phone_number || phone.id} (user ${integration.userId})`
        );
        return;
      }
    }

    if (resolvedWaba && !resolvedPhone) {
      const phones = await listPhonesForWaba(resolvedWaba, accessToken);
      if (phones.length === 1) {
        const phone = phones[0];
        await subscribeWabaToApp(resolvedWaba, accessToken, {
          organizationId: integration.organizationId || null,
        });
        await createOfficialSessionsForOAuthPhones({
          userId: integration.userId,
          integrationId: integration.id,
          accessToken,
          phones: [phone],
        });
        const nextCfg = { ...cfg };
        delete nextCfg[EMBEDDED_SIGNUP_PENDING_CONFIG_KEY];
        await storage.updateIntegration(integration.id, integration.userId, { config: nextCfg });
        console.log(
          `[WhatsApp account_update] ✅ Session created from WABA phone list: ${phone.display_phone_number || phone.id}`
        );
        return;
      }
      if (phones.length > 1) {
        console.log(
          `[WhatsApp account_update] WABA ${resolvedWaba} has ${phones.length} phones — saved pending; user should pick in Integrations`
        );
        return;
      }
    }
  }

  console.warn("[WhatsApp account_update] Could not provision session from partner event");
}
