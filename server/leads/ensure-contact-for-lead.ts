import { storage } from "../storage";
import { assertPlanQuota } from "../utils/plan-quotas";
import type { ManagedContact } from "@shared/schema";

export type EnsureContactForLeadParams = {
  userId: string;
  organizationId: string;
  phoneDigits: string;
  name?: string | null;
  email?: string | null;
  source?: string | null;
};

/**
 * Find or create a managed contact for a lead so Leads → Contacts stay in sync.
 * Returns existing contact by phone when present; otherwise creates one (if quota allows).
 */
export async function ensureContactForLead(
  params: EnsureContactForLeadParams,
): Promise<ManagedContact | null> {
  const organizationId = params.organizationId?.trim();
  const userId = params.userId?.trim();
  const phone = params.phoneDigits.replace(/[^\d]/g, "");
  if (!organizationId || !userId || !phone) return null;

  const existing = await storage.findManagedContactByOrganizationAndPhoneDigits(
    organizationId,
    phone,
  );
  if (existing) return existing;

  const quota = await assertPlanQuota({ userId, organizationId, kind: "contacts" });
  if (quota) {
    console.warn(
      `[Leads] Skipping contact sync for ${phone}: contact quota exceeded (${quota.body?.message || "limit"})`,
    );
    return null;
  }

  const displayName =
    params.name?.trim() && params.name.trim() !== phone
      ? params.name.trim()
      : phone;

  try {
    return await storage.createManagedContact({
      userId,
      organizationId,
      name: displayName,
      phoneNumber: phone,
      email: params.email?.trim() || null,
      source: params.source?.trim() || "manual",
    });
  } catch (error: any) {
    console.error("[Leads] Failed to sync contact for lead:", error?.message || error);
    return null;
  }
}
