import { DEFAULT_ORGANIZATION_LEAD_STATUSES } from "@shared/lead-statuses";
import { storage } from "../storage";

function isNotInterestedStatus(s: { slug: string; name: string }): boolean {
  const slug = s.slug.trim().toLowerCase();
  const name = s.name.trim().toLowerCase().replace(/[_-]+/g, " ");
  return slug === "not_interested" || name === "not interested";
}

/** Ensure org has pipeline statuses; returns list ordered by sortOrder. */
export async function ensureOrganizationLeadStatuses(organizationId: string) {
  const existing = await storage.listOrganizationLeadStatuses(organizationId);
  if (existing.length > 0) return existing;

  for (const preset of DEFAULT_ORGANIZATION_LEAD_STATUSES) {
    await storage.createOrganizationLeadStatus({
      organizationId,
      name: preset.name,
      slug: preset.slug,
      color: preset.color,
      sortOrder: preset.sortOrder,
      isDefault: preset.isDefault,
    });
  }
  return storage.listOrganizationLeadStatuses(organizationId);
}

/**
 * Default status for newly created leads.
 * Prefers "Not Interested" when that column exists (org pipeline), otherwise the
 * status marked isDefault, otherwise the first column.
 */
export async function resolveDefaultLeadStatusSlug(organizationId: string): Promise<string> {
  const statuses = await ensureOrganizationLeadStatuses(organizationId);
  const notInterested = statuses.find(isNotInterestedStatus);
  if (notInterested) {
    if (!notInterested.isDefault) {
      for (const s of statuses) {
        if (s.isDefault && s.id !== notInterested.id) {
          await storage.updateOrganizationLeadStatus(s.id, organizationId, { isDefault: false });
        }
      }
      await storage.updateOrganizationLeadStatus(notInterested.id, organizationId, {
        isDefault: true,
      });
    }
    return notInterested.slug;
  }
  const def = statuses.find((s) => s.isDefault) ?? statuses[0];
  return def?.slug ?? "new";
}
