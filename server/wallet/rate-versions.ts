import { db } from "../../db";
import { walletMetaRateVersions, type WalletMetaRateVersionRow } from "@shared/schema";
import type { WalletMetaCategory } from "@shared/schema";
import { and, eq, or, isNull, lte, gt, gte, lt, desc, sql, inArray } from "drizzle-orm";
import { walletTransactions } from "@shared/schema";
import { DEFAULT_META_RATES_MINOR } from "./config";

export async function listWalletRateVersions(limit = 200): Promise<WalletMetaRateVersionRow[]> {
  return db
    .select()
    .from(walletMetaRateVersions)
    .orderBy(desc(walletMetaRateVersions.validFrom))
    .limit(limit);
}

export type ResolvedWalletRate = {
  rateMinor: number;
  markupMinor: number | null;
  currency: string;
  rateVersionId: string | null;
};

export async function createWalletRateVersion(input: {
  countryIso: string;
  metaCategory: WalletMetaCategory;
  rateMinor: number;
  markupMinor?: number | null;
  currency?: string;
  validFrom: Date;
  validTo?: Date | null;
  notes?: string;
  createdByUserId?: string;
}): Promise<WalletMetaRateVersionRow> {
  const [row] = await db
    .insert(walletMetaRateVersions)
    .values({
      countryIso: input.countryIso.toUpperCase(),
      metaCategory: input.metaCategory,
      rateMinor: input.rateMinor,
      markupMinor: input.markupMinor ?? null,
      currency: input.currency || "INR",
      validFrom: input.validFrom,
      validTo: input.validTo ?? null,
      notes: input.notes,
      createdByUserId: input.createdByUserId,
    })
    .returning();
  return row!;
}

/**
 * Active rate for country + category at `at` (defaults to now).
 * Tries exact country, then DEFAULT.
 */
export async function resolveMetaRateMinor(params: {
  countryIso: string;
  metaCategory: WalletMetaCategory;
  at?: Date;
}): Promise<ResolvedWalletRate> {
  const at = params.at ?? new Date();
  const countries = [params.countryIso.toUpperCase(), "DEFAULT"];

  for (const countryIso of countries) {
    const [row] = await db
      .select()
      .from(walletMetaRateVersions)
      .where(
        and(
          eq(walletMetaRateVersions.countryIso, countryIso),
          eq(walletMetaRateVersions.metaCategory, params.metaCategory),
          lte(walletMetaRateVersions.validFrom, at),
          or(isNull(walletMetaRateVersions.validTo), gt(walletMetaRateVersions.validTo, at))
        )
      )
      .orderBy(desc(walletMetaRateVersions.validFrom))
      .limit(1);
    if (row) {
      return {
        rateMinor: row.rateMinor,
        markupMinor: row.markupMinor ?? null,
        currency: row.currency,
        rateVersionId: row.id,
      };
    }
  }

  return {
    rateMinor: DEFAULT_META_RATES_MINOR[params.metaCategory],
    markupMinor: null,
    currency: "INR",
    rateVersionId: null,
  };
}

/** Sum meta_cost_minor for all debits in period (platform-wide estimate from wallet ledger). */
export async function sumEstimatedMetaCostForPeriod(
  periodStart: Date,
  periodEnd: Date
): Promise<number> {
  const rows = await db
    .select({
      total: sql<number>`COALESCE(SUM(${walletTransactions.metaCostMinor}), 0)::int`,
    })
    .from(walletTransactions)
    .where(
      and(
        gte(walletTransactions.createdAt, periodStart),
        lt(walletTransactions.createdAt, periodEnd),
        inArray(walletTransactions.type, ["debit_message", "debit_campaign"])
      )
    );
  return Number(rows[0]?.total ?? 0);
}
