import type { OrganizationLead, WhatsappSession } from "@shared/schema";

export function connectedPhoneFromSession(
  deviceInfo: WhatsappSession["deviceInfo"],
): string | null {
  if (!deviceInfo) return null;
  const phone = deviceInfo.displayPhoneNumber?.trim() || deviceInfo.phoneNumber?.trim();
  return phone || null;
}

export type LeadWithFromPhone = OrganizationLead & { leadFromPhone: string | null };

export async function enrichLeadsWithLeadFromPhone(
  getSessionsBySessionIds: (sessionIds: string[]) => Promise<WhatsappSession[]>,
  leads: OrganizationLead[],
): Promise<LeadWithFromPhone[]> {
  const sessionIds = [...new Set(leads.map((l) => l.sessionId).filter((id): id is string => !!id))];
  if (sessionIds.length === 0) {
    return leads.map((lead) => ({ ...lead, leadFromPhone: null }));
  }

  const sessions = await getSessionsBySessionIds(sessionIds);
  const phoneBySession = new Map<string, string>();
  for (const session of sessions) {
    const phone = connectedPhoneFromSession(session.deviceInfo);
    if (phone) phoneBySession.set(session.sessionId, phone);
  }

  return leads.map((lead) => ({
    ...lead,
    leadFromPhone: lead.sessionId ? phoneBySession.get(lead.sessionId) ?? null : null,
  }));
}
