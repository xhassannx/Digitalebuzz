import { storage } from "../../storage";

/** Stored on integration.config until the user confirms which lines to add as inbox sessions */
export const PENDING_WHATSAPP_PHONE_SELECTION_KEY = "pendingWhatsAppPhoneSelection" as const;

export type PendingWhatsAppPhoneRow = {
  id: string;
  display_phone_number?: string;
  wabaId?: string;
  wabaName?: string;
  verified_name?: string;
  businessAccountId?: string;
  businessAccountName?: string;
  quality_rating?: unknown;
  code_verification_status?: string;
};

export type PendingWhatsAppPhoneSelection = {
  phones: PendingWhatsAppPhoneRow[];
  createdAt: number;
};

function getEnvWhatsappOAuthAllowWabaIds(): string[] {
  return (process.env.WHATSAPP_OAUTH_ONLY_WABA_IDS ?? "")
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Optional env filter; otherwise all Meta lines from OAuth are eligible for inbox / picker */
export function filterEligiblePhonesForInbox(allPhones: any[]): any[] {
  const allowWabaIds = getEnvWhatsappOAuthAllowWabaIds();
  if (allowWabaIds.length === 0) return allPhones;
  const filtered = allPhones.filter((p) => allowWabaIds.includes(String(p.wabaId ?? "")));
  if (filtered.length < allPhones.length) {
    console.log(
      `[WhatsApp OAuth] WHATSAPP_OAUTH_ONLY_WABA_IDS → ${filtered.length} of ${allPhones.length} phone(s) eligible`
    );
  }
  return filtered;
}

export function summarizePhoneForPending(phone: any): PendingWhatsAppPhoneRow {
  return {
    id: String(phone.id),
    display_phone_number: phone.display_phone_number,
    wabaId: phone.wabaId,
    wabaName: phone.wabaName,
    verified_name: phone.verified_name,
    businessAccountId: phone.businessAccountId,
    businessAccountName: phone.businessAccountName,
    quality_rating: phone.quality_rating,
    code_verification_status: phone.code_verification_status,
  };
}

function sortMineSessionsForPrimary<T extends { createdAt: Date; deletedAt?: Date | null }>(sessions: T[]): T[] {
  return [...sessions].sort((a, b) => {
    const aDel = !!a.deletedAt;
    const bDel = !!b.deletedAt;
    if (aDel !== bDel) return aDel ? 1 : -1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

/** Create DB + business API manager sessions for the given full phone objects (as returned from Graph during OAuth). */
export async function createOfficialSessionsForOAuthPhones(params: {
  userId: string;
  integrationId: string;
  accessToken: string;
  phones: any[];
}): Promise<void> {
  const { userId, integrationId, accessToken, phones } = params;
  const { businessAPIManager } = await import("../../whatsapp/business-api-client");
  const integration = await storage.getIntegration(integrationId, userId);
  const organizationId = integration?.organizationId || undefined;

  for (const phone of phones) {
    try {
      if (!phone?.id) continue;
      const phoneIdStr = String(phone.id);

      const allByPhone = await storage.getOfficialSessionsByApiPhoneNumberId(phoneIdStr);
      const otherTenants = allByPhone.filter((s) => {
        if (s.userId === userId) return false;
        if ((s as any).deletedAt) return false;
        if (organizationId && s.organizationId === organizationId) return false;
        return true;
      });
      if (otherTenants.length > 0) {
        console.warn(
          `[WhatsApp OAuth] Phone ${phoneIdStr} already belongs to another reseller/org; not stealing the number.`
        );
        continue;
      }

      const otherUsers = allByPhone.filter(
        (s) => s.userId !== userId && !(s as any).deletedAt && (!organizationId || s.organizationId === organizationId)
      );
      for (const o of otherUsers) {
        console.log(
          `[WhatsApp OAuth] Phone ${phoneIdStr} was linked to another user; retiring session ${o.sessionId} so user ${userId} can own this line.`
        );
        try {
          await businessAPIManager.disconnectSession(o.sessionId);
        } catch (_) {}
        await storage.updateSession(o.sessionId, {
          deletedAt: new Date(),
          status: "disconnected",
        } as any);
      }

      const mine = (await storage.getOfficialSessionsByApiPhoneNumberId(phoneIdStr)).filter((s) => s.userId === userId);
      const sortedMine = sortMineSessionsForPrimary(mine);
      const primary = sortedMine[0];
      const extras = sortedMine.slice(1);
      for (const ex of extras) {
        console.log(
          `[WhatsApp OAuth] Retiring duplicate official session ${ex.sessionId} for phone ${phoneIdStr} (user ${userId}).`
        );
        try {
          await businessAPIManager.disconnectSession(ex.sessionId);
        } catch (_) {}
        await storage.updateSession(ex.sessionId, {
          deletedAt: new Date(),
          status: "disconnected",
        } as any);
      }

      const devicePayload = {
        platform: "WhatsApp Business API",
        phoneNumber: phone.display_phone_number,
        displayPhoneNumber: phone.display_phone_number,
        name: phone.verified_name || "Business Account",
        verifiedName: phone.verified_name,
        apiPhoneNumberId: phone.id,
        businessAccountId: phone.businessAccountId,
        businessAccountName: phone.businessAccountName,
        wabaId: phone.wabaId,
        wabaName: phone.wabaName,
        qualityRating: phone.quality_rating?.overall_status || phone.quality_rating,
        codeVerificationStatus: phone.code_verification_status,
        integrationId,
      };

      if (primary) {
        try {
          await businessAPIManager.disconnectSession(primary.sessionId);
        } catch (_) {}
        await storage.updateSession(primary.sessionId, {
          deletedAt: null,
          status: "connected",
          organizationId: organizationId || primary.organizationId || undefined,
          deviceInfo: {
            ...(primary.deviceInfo || {}),
            ...devicePayload,
          },
        });
        await businessAPIManager.createSession(primary.sessionId, {
          phoneNumberId: phone.id,
          accessToken,
          businessAccountId: phone.businessAccountId,
        });
        console.log(
          `[WhatsApp OAuth] ✅ Updated official session for phone ${phone.id} (${phone.display_phone_number || phone.id}) sessionId=${primary.sessionId}`
        );
        continue;
      }

      const sessionId = `wb_${phone.id}_${Date.now()}`;
      await storage.createSession({
        userId,
        organizationId: organizationId || undefined,
        sessionId,
        connectionType: "official",
        status: "connected",
        deviceInfo: devicePayload,
      });
      await businessAPIManager.createSession(sessionId, {
        phoneNumberId: phone.id,
        accessToken,
        businessAccountId: phone.businessAccountId,
      });
      console.log(
        `[WhatsApp OAuth] ✅ Added phone number ${phone.id} (${phone.display_phone_number || phone.id})`
      );
    } catch (e: any) {
      console.error(`[WhatsApp OAuth] ❌ Error adding phone number ${phone?.id}:`, e.message);
    }
  }
}

export function mergePendingPhoneSelectionIntoConfig(
  existingConfig: Record<string, any> | null | undefined,
  pending: PendingWhatsAppPhoneSelection
): Record<string, any> {
  return {
    ...(existingConfig && typeof existingConfig === "object" ? existingConfig : {}),
    [PENDING_WHATSAPP_PHONE_SELECTION_KEY]: pending,
  };
}

export function clearPendingPhoneSelectionFromConfig(
  existingConfig: Record<string, any> | null | undefined
): Record<string, any> {
  const next = { ...(existingConfig && typeof existingConfig === "object" ? existingConfig : {}) };
  delete next[PENDING_WHATSAPP_PHONE_SELECTION_KEY];
  return next;
}
