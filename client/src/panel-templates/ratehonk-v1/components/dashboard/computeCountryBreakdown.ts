type ContactPhone = { phoneNumber?: string | null };

export type CountryStat = {
  name: string;
  count: number;
  percent: number;
  mapKey: string;
};

/** Longest-prefix match for common dial codes */
const DIAL_RULES: Array<{ prefixes: string[]; name: string; mapKey: string }> = [
  { prefixes: ["91"], name: "India", mapKey: "in" },
  { prefixes: ["44"], name: "United Kingdom", mapKey: "uk" },
  { prefixes: ["61"], name: "Australia", mapKey: "au" },
  { prefixes: ["34"], name: "Spain", mapKey: "es" },
  { prefixes: ["1"], name: "United states", mapKey: "us" },
  { prefixes: ["52"], name: "Mexico", mapKey: "mx" },
  { prefixes: ["49"], name: "Germany", mapKey: "de" },
  { prefixes: ["33"], name: "France", mapKey: "fr" },
  { prefixes: ["971"], name: "UAE", mapKey: "ae" },
];

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** Longest-prefix match for common dial codes (sorted once by prefix length) */
const SORTED_DIAL_RULES = [...DIAL_RULES].sort((a, b) => {
  const maxA = Math.max(...a.prefixes.map((p) => p.length));
  const maxB = Math.max(...b.prefixes.map((p) => p.length));
  return maxB - maxA;
});

function inferCountry(phone: string): { name: string; mapKey: string } {
  const digits = normalizePhone(phone);
  if (!digits) return { name: "Other", mapKey: "other" };

  for (const rule of SORTED_DIAL_RULES) {
    if (rule.prefixes.some((p) => digits.startsWith(p))) {
      return { name: rule.name, mapKey: rule.mapKey };
    }
  }
  return { name: "Other", mapKey: "other" };
}

export function computeCountryBreakdown(
  contacts: ContactPhone[],
  totalFallback = 0,
): { total: number; countries: CountryStat[] } {
  if (!contacts.length) {
    return { total: Math.max(0, totalFallback), countries: [] };
  }

  const counts = new Map<string, { name: string; mapKey: string; count: number }>();
  for (const contact of contacts) {
    const phone = contact.phoneNumber ?? "";
    const { name, mapKey } = inferCountry(phone);
    const prev = counts.get(mapKey) ?? { name, mapKey, count: 0 };
    prev.count += 1;
    counts.set(mapKey, prev);
  }

  const total = contacts.length;
  const sorted = [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((row) => ({
      name: row.name,
      mapKey: row.mapKey,
      count: row.count,
      percent: total > 0 ? Math.round((row.count / total) * 100) : 0,
    }));

  return { total, countries: sorted };
}

export function formatCompactUsers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)} K`;
  return n.toLocaleString();
}
