import type { OrganizationLeadRow } from "@/pages/leads-page";

export type OrganizationLeadStatusRow = {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  color: string;
  sortOrder: number;
  isDefault: boolean;
  createdAt: string;
};

export function statusLabel(statuses: OrganizationLeadStatusRow[], slug: string): string {
  return statuses.find((s) => s.slug === slug)?.name ?? slug.replace(/_/g, " ");
}

export function statusColor(statuses: OrganizationLeadStatusRow[], slug: string): string {
  return statuses.find((s) => s.slug === slug)?.color ?? "#f3f4f6";
}

/** Prefer Not Interested when present; else isDefault; else first status. */
export function resolveDefaultLeadStatus(
  statuses: OrganizationLeadStatusRow[],
  preferredSlug?: string | null,
): string {
  if (preferredSlug && statuses.some((s) => s.slug === preferredSlug)) {
    return preferredSlug;
  }
  const notInterested = statuses.find((s) => {
    const slug = s.slug.trim().toLowerCase();
    const name = s.name.trim().toLowerCase().replace(/[_-]+/g, " ");
    return slug === "not_interested" || name === "not interested";
  });
  if (notInterested) return notInterested.slug;
  return statuses.find((s) => s.isDefault)?.slug ?? statuses[0]?.slug ?? "new";
}

export function priorityClass(priority: string) {
  if (priority === "high") return "bg-rose-100 text-rose-700";
  if (priority === "low") return "bg-emerald-100 text-emerald-700";
  return "bg-amber-100 text-amber-800";
}

export function groupLeadsByStatus(
  leads: OrganizationLeadRow[],
  statuses: OrganizationLeadStatusRow[],
): Map<string, OrganizationLeadRow[]> {
  const map = new Map<string, OrganizationLeadRow[]>();
  for (const s of statuses) map.set(s.slug, []);
  const firstSlug = statuses[0]?.slug;
  for (const lead of leads) {
    const key = map.has(lead.status) ? lead.status : firstSlug;
    if (key) map.get(key)!.push(lead);
  }
  for (const [slug, list] of map) {
    list.sort((a, b) => {
      const orderDiff = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      if (orderDiff !== 0) return orderDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    map.set(slug, list);
  }
  return map;
}

export function buildLeadColumnOrder(
  columnLeads: OrganizationLeadRow[],
  draggedId: string,
  insertIndex: number,
): string[] {
  const withoutDragged = columnLeads.filter((lead) => lead.id !== draggedId);
  const index = Math.max(0, Math.min(insertIndex, withoutDragged.length));
  const next = withoutDragged.map((lead) => lead.id);
  next.splice(index, 0, draggedId);
  return next;
}

export function splitStoredPhone(
  phoneNumber: string,
  dialEntries: Array<{ dial: string }>,
): { countryCode: string; phoneLocal: string } {
  const digits = phoneNumber.replace(/[^\d]/g, "");
  if (!digits) return { countryCode: "+91", phoneLocal: "" };

  const sorted = [...dialEntries].sort(
    (a, b) => b.dial.replace(/\D/g, "").length - a.dial.replace(/\D/g, "").length,
  );
  for (const entry of sorted) {
    const dialDigits = entry.dial.replace(/\D/g, "");
    if (dialDigits && digits.startsWith(dialDigits) && digits.length > dialDigits.length) {
      return {
        countryCode: entry.dial.startsWith("+") ? entry.dial : `+${dialDigits}`,
        phoneLocal: digits.slice(dialDigits.length),
      };
    }
  }

  if (digits.length > 10) {
    return {
      countryCode: `+${digits.slice(0, digits.length - 10)}`,
      phoneLocal: digits.slice(-10),
    };
  }
  return { countryCode: "+91", phoneLocal: digits };
}

type SessionLike = {
  sessionId: string;
  deviceInfo?: {
    displayPhoneNumber?: string;
    phoneNumber?: string;
    verifiedName?: string;
    name?: string;
  } | null;
};

export function sessionLeadFromLabel(session: SessionLike): string {
  const raw =
    session.deviceInfo?.displayPhoneNumber?.trim() ||
    session.deviceInfo?.phoneNumber?.trim();
  if (raw) {
    const digits = raw.replace(/[^\d]/g, "");
    return digits ? `+${digits}` : raw;
  }
  const name = session.deviceInfo?.verifiedName?.trim() || session.deviceInfo?.name?.trim();
  return name || session.sessionId.slice(0, 12);
}
