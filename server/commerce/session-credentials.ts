import { storage } from "../storage";
import { businessAPIManager } from "../whatsapp/business-api-client";

export type OfficialSessionCreds = {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId?: string;
};

/** Resolve Cloud API token for an official WhatsApp session (integration or user settings). */
export async function resolveOfficialCredentialsForSession(
  sessionId: string,
  userId: string,
  organizationId?: string | null
): Promise<OfficialSessionCreds | null> {
  const session = await storage.getSession(sessionId);
  if (!session || session.connectionType !== "official") return null;

  const apiPhoneNumberId = session.deviceInfo?.apiPhoneNumberId as string | undefined;
  let integration = null;

  if (session.deviceInfo?.integrationId) {
    integration = await storage.getIntegration(session.deviceInfo.integrationId as string, userId);
  }
  if (!integration) {
    integration = await storage.getIntegrationByName(
      "whatsapp-business",
      userId,
      organizationId || undefined
    );
  }

  if (apiPhoneNumberId && !integration) {
    const all = await storage.getIntegrationsByUser(userId, organizationId || undefined);
    for (const int of all) {
      if (int.name !== "whatsapp-business" || int.status !== "connected" || !int.credentials) continue;
      const token = (int.credentials as Record<string, string>).access_token;
      if (!token) continue;
      try {
        const check = await fetch(
          `https://graph.facebook.com/v23.0/${apiPhoneNumberId}?fields=id&access_token=${encodeURIComponent(token)}`
        );
        if (check.ok) {
          integration = int;
          break;
        }
      } catch {
        continue;
      }
    }
  }

  if (integration?.credentials) {
    const c = integration.credentials as Record<string, string>;
    if (c.access_token) {
      return {
        accessToken: c.access_token,
        phoneNumberId: apiPhoneNumberId || c.phone_number_id || c.phoneNumberId || "",
        businessAccountId:
          session.deviceInfo?.wabaId ||
          c.business_account_id ||
          c.businessAccountId ||
          undefined,
      };
    }
  }

  const settings = await storage.getUserSettings(userId);
  const waba = settings?.whatsappBusinessCredentials;
  if (waba?.accessToken && waba.phoneNumberId) {
    return {
      accessToken: waba.accessToken,
      phoneNumberId: apiPhoneNumberId || waba.phoneNumberId,
      businessAccountId: waba.businessAccountId,
    };
  }

  return null;
}

/** Load OAuth token into businessAPIManager so outbound Cloud API sends work (in-memory Map). */
export async function ensureOfficialSessionReadyForSend(
  sessionId: string,
  userId: string,
  organizationId?: string | null
): Promise<OfficialSessionCreds> {
  const session = await storage.getSession(sessionId);
  if (!session || session.connectionType !== "official") {
    throw new Error("Official WhatsApp session required. Reconnect the number in Integrations.");
  }

  const creds = await resolveOfficialCredentialsForSession(sessionId, userId, organizationId);
  if (!creds?.accessToken || !creds.phoneNumberId) {
    throw new Error(
      "Could not load WhatsApp API credentials for this session. Reconnect WhatsApp in Integrations."
    );
  }

  if (!businessAPIManager.isClientReady(sessionId)) {
    await businessAPIManager.restoreSession(sessionId, {
      phoneNumberId: creds.phoneNumberId,
      accessToken: creds.accessToken,
      businessAccountId: creds.businessAccountId,
    });
  }

  if (!businessAPIManager.isClientReady(sessionId)) {
    throw new Error(
      "WhatsApp session could not be initialized. Open Integrations, reconnect this number, then retry."
    );
  }

  return creds;
}

/** E.164 digits for Cloud API `to` field (no +). Adds default country code for 10-digit Indian mobiles. */
export function normalizeRecipientPhoneForWhatsApp(
  raw: string,
  defaultCountryCode = "91"
): string {
  let cleaned = String(raw || "").trim();
  if (cleaned.startsWith("+")) cleaned = cleaned.slice(1);
  cleaned = cleaned.replace(/\D/g, "");
  while (cleaned.startsWith("0")) cleaned = cleaned.slice(1);

  if (cleaned.length === 10 && /^[6-9]/.test(cleaned)) {
    cleaned = defaultCountryCode + cleaned;
  }
  if (cleaned.length < 10) {
    throw new Error(
      `Invalid phone number "${raw}". Use full number with country code (e.g. 919876543210).`
    );
  }
  return cleaned;
}
