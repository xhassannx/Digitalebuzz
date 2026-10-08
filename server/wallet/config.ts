import { db } from "../../db";
import { platformMasterSettings } from "@shared/schema";
import type { WalletBillingConfig, WalletMetaCategory } from "@shared/schema";
import { eq } from "drizzle-orm";
import { isMongoEnabled } from "../../db/mongo";
import { PlatformMasterSettingsModel } from "../models";

export const DEFAULT_META_RATES_MINOR: Record<WalletMetaCategory, number> = {
  marketing: 85,
  utility: 35,
  authentication: 35,
  service: 0,
};

const DEFAULT_CONFIG: WalletBillingConfig = {
  enabled: false,
  skipSaasSubscriptionForOfficialMessages: true,
  currency: "INR",
  metaRatesMinor: { ...DEFAULT_META_RATES_MINOR },
  markupEnabled: false,
  markupMode: "fixed_minor",
  markupByCategory: {},
  lowBalanceThresholdMinor: 5000,
  allowNegativeBalance: false,
  lowBalanceEmailEnabled: true,
  useCountryRateVersions: true,
  defaultCountryIso: "IN",
};

export function normalizeWalletBillingConfig(raw: unknown): WalletBillingConfig {
  const base = { ...DEFAULT_CONFIG, metaRatesMinor: { ...DEFAULT_META_RATES_MINOR } };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const o = raw as WalletBillingConfig;
  return {
    ...base,
    ...o,
    metaRatesMinor: {
      ...DEFAULT_META_RATES_MINOR,
      ...(o.metaRatesMinor || {}),
    },
    markupByCategory: {
      ...(o.markupByCategory || {}),
    },
  };
}

export async function getWalletBillingConfig(): Promise<WalletBillingConfig> {
  if (isMongoEnabled()) {
    const doc = await PlatformMasterSettingsModel.findById("singleton").lean();
    return normalizeWalletBillingConfig(doc?.walletBillingConfig ?? {});
  }
  const [row] = await db
    .select({ walletBillingConfig: platformMasterSettings.walletBillingConfig })
    .from(platformMasterSettings)
    .where(eq(platformMasterSettings.id, "singleton"))
    .limit(1);
  return normalizeWalletBillingConfig(row?.walletBillingConfig ?? {});
}

export async function isWalletBillingEnabled(): Promise<boolean> {
  const cfg = await getWalletBillingConfig();
  return !!cfg.enabled;
}

export async function saveWalletBillingConfig(patch: WalletBillingConfig): Promise<WalletBillingConfig> {
  const current = await getWalletBillingConfig();
  const next = normalizeWalletBillingConfig({ ...current, ...patch });
  if (isMongoEnabled()) {
    await PlatformMasterSettingsModel.findByIdAndUpdate(
      "singleton",
      { $set: { walletBillingConfig: next, updatedAt: new Date() } },
      { upsert: true, new: true }
    );
    return next;
  }
  await db
    .insert(platformMasterSettings)
    .values({
      id: "singleton",
      walletBillingConfig: next,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: platformMasterSettings.id,
      set: {
        walletBillingConfig: next,
        updatedAt: new Date(),
      },
    });
  return next;
}
