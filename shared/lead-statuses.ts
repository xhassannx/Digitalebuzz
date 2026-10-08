/** Default pipeline statuses seeded for new organizations (slug stored on leads.status). */
export const DEFAULT_ORGANIZATION_LEAD_STATUSES = [
  { name: "New", slug: "new", color: "#dbeafe", sortOrder: 0, isDefault: true },
  { name: "Contacted", slug: "contacted", color: "#e9d5ff", sortOrder: 1, isDefault: false },
  { name: "Qualified", slug: "qualified", color: "#fef3c7", sortOrder: 2, isDefault: false },
  { name: "Proposal", slug: "proposal", color: "#d1fae5", sortOrder: 3, isDefault: false },
  { name: "Negotiation", slug: "negotiation", color: "#fce7f3", sortOrder: 4, isDefault: false },
  { name: "Closed Won", slug: "closed_won", color: "#bbf7d0", sortOrder: 5, isDefault: false },
] as const;

export type LeadStatusPreset = (typeof DEFAULT_ORGANIZATION_LEAD_STATUSES)[number];

export const LEAD_STATUS_COLOR_PRESETS = [
  "#dbeafe",
  "#e9d5ff",
  "#fef3c7",
  "#d1fae5",
  "#fce7f3",
  "#bbf7d0",
  "#fecaca",
  "#fed7aa",
  "#e0e7ff",
  "#f3f4f6",
] as const;
