export const WHITELABEL_HOMEPAGE_HERO_DEFAULTS = {
  heroHeadline1: "Everything Your Business Needs,",
  heroHeadline2: "Automated",
} as const;

export const WHITELABEL_HOMEPAGE_STATS_DEFAULTS = [
  { value: "250+", label: "businesses" },
  { value: "1.2M+", label: "messages / mo" },
  { value: "96%", label: "delivery rate" },
  { value: "24/7", label: "Support" },
] as const;

/** Inflated/legacy stat values that should fall back to the current defaults. */
export const LEGACY_STAT_VALUES = new Set([
  "5,000+",
  "5000+",
  "10K+",
  "120M+",
  "50M+",
  "98.5%",
  "99.9%",
]);

/** Saved homepage rows that should fall back to the current hero defaults. */
export const LEGACY_HERO_HEADLINE1 = [
  "Test from script",
  "Automate your WhatsApp.",
  "Transform Your Business",
];

export const LEGACY_HERO_HEADLINE2 = [
  "Works",
  "Grow your business.",
  "Communication",
];

export function resolveHomepageHeroField(
  field: "heroHeadline1" | "heroHeadline2",
  value: unknown,
): string {
  const legacy = field === "heroHeadline1" ? LEGACY_HERO_HEADLINE1 : LEGACY_HERO_HEADLINE2;
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed || legacy.includes(trimmed)) {
    return WHITELABEL_HOMEPAGE_HERO_DEFAULTS[field];
  }
  return trimmed;
}

export function resolveHomepageStats(
  stats: unknown,
): { value: string; label: string }[] {
  const defaults = WHITELABEL_HOMEPAGE_STATS_DEFAULTS.map((s) => ({ ...s }));
  if (!Array.isArray(stats) || stats.length === 0) return defaults;

  const hasLegacy = stats.some((item) => {
    const value = typeof item?.value === "string" ? item.value.trim() : "";
    return LEGACY_STAT_VALUES.has(value);
  });
  if (hasLegacy) return defaults;

  return stats.map((item, i) => ({
    value:
      typeof item?.value === "string" && item.value.trim()
        ? item.value.trim()
        : defaults[i]?.value ?? "",
    label:
      typeof item?.label === "string" && item.label.trim()
        ? item.label.trim()
        : defaults[i]?.label ?? "",
  }));
}

export function applyHomepageHeroDefaults(content: Record<string, unknown>): Record<string, unknown> {
  return {
    ...content,
    heroHeadline1: resolveHomepageHeroField("heroHeadline1", content.heroHeadline1),
    heroHeadline2: resolveHomepageHeroField("heroHeadline2", content.heroHeadline2),
    stats: resolveHomepageStats(content.stats),
  };
}
