import { db } from "../../db";
import { platformMasterSettings, type CreditLineProviderConfig, type CreditLineProvidersConfig } from "@shared/schema";
import { eq } from "drizzle-orm";
import { isMongoEnabled } from "../../db/mongo";
import { PlatformMasterSettingsModel } from "../models";

const DEFAULT_INTERAKT: CreditLineProviderConfig = {
  enabled: false,
  displayName: "Interakt",
  apiBaseUrl: "https://amped-express.interakt.ai",
  apiVersion: "v17.0",
  mmLiteEnabled: true,
  isvAppId: "256725303808337",
  solutionId: "972723915819810",
};

export function normalizeCreditLineProvidersConfig(raw: unknown): CreditLineProvidersConfig {
  const base: CreditLineProvidersConfig = {
    interakt: { ...DEFAULT_INTERAKT },
  };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const o = raw as CreditLineProvidersConfig;
  const out: CreditLineProvidersConfig = { ...base };
  for (const [key, val] of Object.entries(o)) {
    if (!val || typeof val !== "object") continue;
    out[key] = {
      ...(base[key] || {}),
      ...val,
    };
  }
  return out;
}

export async function getCreditLineProvidersConfig(): Promise<CreditLineProvidersConfig> {
  if (isMongoEnabled()) {
    const doc = await PlatformMasterSettingsModel.findById("singleton").lean();
    return normalizeCreditLineProvidersConfig(doc?.creditLineProvidersConfig ?? {});
  }
  const [row] = await db
    .select({ creditLineProvidersConfig: platformMasterSettings.creditLineProvidersConfig })
    .from(platformMasterSettings)
    .where(eq(platformMasterSettings.id, "singleton"))
    .limit(1);
  return normalizeCreditLineProvidersConfig(row?.creditLineProvidersConfig ?? {});
}

export async function getCreditLineProviderConfig(
  providerId: string
): Promise<CreditLineProviderConfig | null> {
  const all = await getCreditLineProvidersConfig();
  const cfg = all[providerId];
  if (!cfg?.enabled) return null;
  if (!cfg.accessToken?.trim()) return null;
  return cfg;
}

export async function saveCreditLineProvidersConfig(
  patch: CreditLineProvidersConfig
): Promise<CreditLineProvidersConfig> {
  const current = await getCreditLineProvidersConfig();
  const next = normalizeCreditLineProvidersConfig({ ...current, ...patch });
  // Deep-merge known providers
  for (const key of Object.keys(patch)) {
    next[key] = {
      ...(current[key] || {}),
      ...(patch[key] || {}),
    };
  }
  if (isMongoEnabled()) {
    await PlatformMasterSettingsModel.findByIdAndUpdate(
      "singleton",
      { $set: { creditLineProvidersConfig: next, updatedAt: new Date() } },
      { upsert: true, new: true }
    );
    return next;
  }
  await db
    .insert(platformMasterSettings)
    .values({
      id: "singleton",
      creditLineProvidersConfig: next,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: platformMasterSettings.id,
      set: {
        creditLineProvidersConfig: next,
        updatedAt: new Date(),
      },
    });
  return next;
}

/** Public view for admin UI — never returns raw token; only whether set. */
export function redactProvidersConfig(cfg: CreditLineProvidersConfig): Record<
  string,
  CreditLineProviderConfig & { accessTokenSet?: boolean }
> {
  const out: Record<string, CreditLineProviderConfig & { accessTokenSet?: boolean }> = {};
  for (const [k, v] of Object.entries(cfg)) {
    const { accessToken, ...rest } = v || {};
    out[k] = {
      ...rest,
      accessToken: accessToken ? "********" : "",
      accessTokenSet: !!accessToken?.trim(),
    };
  }
  return out;
}
