import type { WalletBillingConfig, WalletMetaCategory } from "@shared/schema";
import { DEFAULT_META_RATES_MINOR, getWalletBillingConfig } from "./config";
import { resolveMetaRateMinor } from "./rate-versions";

export type ChargeBreakdown = {
  metaCategory: WalletMetaCategory;
  metaCostMinor: number;
  markupMinor: number;
  chargedMinor: number;
  currency: string;
  countryIso?: string;
  rateVersionId?: string | null;
};

export function normalizeMetaCategory(input: string | null | undefined): WalletMetaCategory {
  const s = String(input || "")
    .trim()
    .toLowerCase();
  if (s === "marketing" || s === "utility" || s === "authentication" || s === "service") {
    return s;
  }
  if (s === "auth" || s === "authentication") return "authentication";
  return "marketing";
}

/** Per-message markup: rate-row override (fixed paise) or global config (fixed / percent). */
export function computeMarkupUnit(params: {
  config: WalletBillingConfig;
  metaCategory: WalletMetaCategory;
  metaCostUnit: number;
  rateVersionMarkupMinor: number | null;
}): number {
  if (!params.config.markupEnabled) return 0;
  if (params.rateVersionMarkupMinor != null) {
    return Math.max(0, Math.round(params.rateVersionMarkupMinor));
  }
  const raw = params.config.markupByCategory?.[params.metaCategory] ?? 0;
  if (params.config.markupMode === "percent") {
    return Math.round((params.metaCostUnit * raw) / 100);
  }
  return Math.max(0, Math.round(raw));
}

export function categoryFromTemplateDb(category: string | null | undefined): WalletMetaCategory {
  const u = String(category || "").toUpperCase();
  if (u === "MARKETING") return "marketing";
  if (u === "UTILITY") return "utility";
  if (u === "AUTHENTICATION") return "authentication";
  return "marketing";
}

export async function computeCharge(params: {
  config: WalletBillingConfig;
  metaCategory: WalletMetaCategory;
  quantity?: number;
  countryIso?: string;
  at?: Date;
}): Promise<ChargeBreakdown> {
  const qty = Math.max(1, params.quantity ?? 1);
  const countryIso = (params.countryIso || params.config.defaultCountryIso || "IN").toUpperCase();
  const at = params.at ?? new Date();

  let metaCostUnit: number;
  let currency: string;
  let rateVersionId: string | null = null;
  let rateVersionMarkupMinor: number | null = null;

  if (params.config.useCountryRateVersions !== false) {
    const resolved = await resolveMetaRateMinor({
      countryIso,
      metaCategory: params.metaCategory,
      at,
    });
    metaCostUnit = resolved.rateMinor;
    currency = resolved.currency;
    rateVersionId = resolved.rateVersionId;
    rateVersionMarkupMinor = resolved.markupMinor;
  } else {
    const rates = { ...DEFAULT_META_RATES_MINOR, ...(params.config.metaRatesMinor || {}) };
    metaCostUnit = rates[params.metaCategory] ?? DEFAULT_META_RATES_MINOR[params.metaCategory];
    currency = params.config.currency || "INR";
  }

  const markupUnit = computeMarkupUnit({
    config: params.config,
    metaCategory: params.metaCategory,
    metaCostUnit,
    rateVersionMarkupMinor,
  });

  const metaCostMinor = metaCostUnit * qty;
  const markupMinor = markupUnit * qty;
  const chargedMinor = metaCostMinor + markupMinor;

  return {
    metaCategory: params.metaCategory,
    metaCostMinor,
    markupMinor,
    chargedMinor,
    currency,
    countryIso,
    rateVersionId,
  };
}

/** Convenience when config not loaded yet. */
export async function computeChargeForSend(
  metaCategory: WalletMetaCategory,
  opts?: { quantity?: number; countryIso?: string; at?: Date }
): Promise<ChargeBreakdown> {
  const config = await getWalletBillingConfig();
  return computeCharge({
    config,
    metaCategory,
    quantity: opts?.quantity,
    countryIso: opts?.countryIso,
    at: opts?.at,
  });
}

export function formatChargeDescription(breakdown: ChargeBreakdown): string {
  const sym = breakdown.currency === "INR" ? "₹" : `${breakdown.currency} `;
  const parts = [
    `${breakdown.countryIso || "—"} · Meta ${breakdown.metaCategory} ${sym}${(breakdown.metaCostMinor / 100).toFixed(2)}`,
  ];
  if (breakdown.markupMinor > 0) {
    parts.push(`markup ${sym}${(breakdown.markupMinor / 100).toFixed(2)}`);
  }
  parts.push(`total ${sym}${(breakdown.chargedMinor / 100).toFixed(2)}`);
  return parts.join(" · ");
}
