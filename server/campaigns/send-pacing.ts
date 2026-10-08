/**
 * Meta-aware campaign send pacing for non-BSP operators.
 * Uses portfolio tier + quality + throughput when available, with safety margins
 * so rate-limit / spam-rate errors are unlikely.
 */

export type CampaignPacingMode = "auto" | "safe" | "fast";

export type MetaSendContext = {
  messagingLimitTier: string | null;
  qualityRating: string | null;
  throughputLevel: string | null;
  canSendMessage: boolean | null;
};

export type CampaignSendPacingPlan = {
  mode: CampaignPacingMode;
  sendConcurrency: number;
  minIntervalMs: number;
  chunkPauseEvery: number;
  chunkPauseMs: number;
  estimatedSeconds: number;
  meta: MetaSendContext;
  summary: string;
};

const TIER_ORDER = [
  "TIER_250",
  "TIER_2K",
  "TIER_1K",
  "TIER_10K",
  "TIER_100K",
  "TIER_UNLIMITED",
  "UNLIMITED",
] as const;

function parsePacingMode(): CampaignPacingMode {
  const raw = String(process.env.CAMPAIGN_PACING_MODE || "auto").trim().toLowerCase();
  if (raw === "safe" || raw === "fast") return raw;
  return "auto";
}

function normalizeTier(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  return raw.trim().toUpperCase();
}

function tierRank(tier: string | null): number {
  if (!tier) return 0;
  const idx = TIER_ORDER.indexOf(tier as (typeof TIER_ORDER)[number]);
  if (idx >= 0) return idx + 1;
  if (tier.includes("UNLIMITED")) return TIER_ORDER.length;
  if (tier.includes("100K")) return 5;
  if (tier.includes("10K")) return 4;
  if (tier.includes("2K") || tier.includes("1K")) return 3;
  if (tier.includes("250")) return 1;
  return 0;
}

function qualityMultiplier(quality: string | null): number {
  const q = (quality || "").toUpperCase();
  if (q === "GREEN") return 1;
  if (q === "YELLOW") return 0.45;
  if (q === "RED") return 0.2;
  return 0.55;
}

function throughputBaseMps(level: string | null): number {
  const t = (level || "").toUpperCase();
  if (t.includes("HIGH") || t.includes("1000")) return 40;
  if (t.includes("STANDARD") || t.includes("80")) return 8;
  return 4;
}

function tierBaseMps(tier: string | null): number {
  const rank = tierRank(tier);
  if (rank >= 6) return 40;
  if (rank >= 5) return 20;
  if (rank >= 4) return 10;
  if (rank >= 3) return 6;
  if (rank >= 1) return 0.5;
  return 0.35;
}

/** Hard caps for non-BSP installs — never exceed these even in "fast" mode. */
function hardMaxMps(mode: CampaignPacingMode): number {
  if (mode === "safe") return 1;
  if (mode === "fast") return 40;
  return 20;
}

function hardMaxConcurrency(mode: CampaignPacingMode): number {
  if (mode === "safe") return 2;
  if (mode === "fast") return 16;
  return 8;
}

/** Map Meta messaging tier to daily unique-customer limit (24h rolling window). */
export function tierToDailyLimit(tier: string | null | undefined): number | null {
  if (!tier) return null;
  const t = tier.trim().toUpperCase();
  if (t.includes("UNLIMITED")) return null;
  if (t.includes("100K")) return 100_000;
  if (t.includes("10K")) return 10_000;
  if (t.includes("2K")) return 2_000;
  if (t.includes("1K")) return 1_000;
  if (t.includes("250")) return 250;
  return null;
}

export function formatMessagingTierLabel(tier: string | null | undefined): string {
  if (!tier) return "Unknown";
  const limit = tierToDailyLimit(tier);
  if (limit == null && tier.toUpperCase().includes("UNLIMITED")) return "Unlimited";
  if (limit != null) return `${limit.toLocaleString()} / 24h`;
  return tier.replace(/_/g, " ");
}

export async function fetchMetaCampaignSendContext(
  phoneNumberId: string,
  accessToken: string
): Promise<MetaSendContext> {
  const fields = [
    "quality_rating",
    "whatsapp_business_manager_messaging_limit",
    "messaging_limit_tier",
    "throughput",
    "health_status",
  ].join(",");
  try {
    const res = await fetch(
      `https://graph.facebook.com/v23.0/${phoneNumberId}?fields=${fields}&access_token=${encodeURIComponent(accessToken)}`
    );
    if (!res.ok) {
      return {
        messagingLimitTier: null,
        qualityRating: null,
        throughputLevel: null,
        canSendMessage: null,
      };
    }
    const data = (await res.json()) as Record<string, unknown>;
    const throughput = data.throughput;
    let throughputLevel: string | null = null;
    if (typeof throughput === "string") throughputLevel = throughput;
    else if (throughput && typeof throughput === "object") {
      const level = (throughput as Record<string, unknown>).level;
      if (typeof level === "string") throughputLevel = level;
    }
    const health = data.health_status as Record<string, unknown> | undefined;
    const canSend =
      typeof health?.can_send_message === "string"
        ? health.can_send_message.toUpperCase() === "AVAILABLE"
        : null;
    const qualityRaw = data.quality_rating;
    let qualityRating: string | null = normalizeTier(qualityRaw);
    if (!qualityRating && qualityRaw && typeof qualityRaw === "object") {
      const q = qualityRaw as Record<string, unknown>;
      qualityRating =
        normalizeTier(q.overall_status) ||
        normalizeTier(q.score) ||
        normalizeTier(q.rating);
    }
    return {
      messagingLimitTier:
        normalizeTier(data.whatsapp_business_manager_messaging_limit) ||
        normalizeTier(data.messaging_limit_tier),
      qualityRating,
      throughputLevel: normalizeTier(throughputLevel),
      canSendMessage: canSend,
    };
  } catch {
    return {
      messagingLimitTier: null,
      qualityRating: null,
      throughputLevel: null,
      canSendMessage: null,
    };
  }
}

export function resolveCampaignSendPacing(input: {
  mode?: CampaignPacingMode;
  recipientCount: number;
  isMarketingTemplate: boolean;
  meta: MetaSendContext;
}): CampaignSendPacingPlan {
  const mode = input.mode ?? parsePacingMode();
  const meta = input.meta;

  if (mode === "safe") {
    const minIntervalMs = 2000;
    const sendConcurrency = 1;
    const chunkPauseEvery = input.recipientCount >= 100 ? 50 : 0;
    const chunkPauseMs = chunkPauseEvery > 0 ? 45_000 : 0;
    return {
      mode,
      sendConcurrency,
      minIntervalMs,
      chunkPauseEvery,
      chunkPauseMs,
      estimatedSeconds: estimateDuration(input.recipientCount, sendConcurrency, minIntervalMs, chunkPauseEvery, chunkPauseMs),
      meta,
      summary: "Safe mode: 1 message every 2s with chunk pauses on large lists",
    };
  }

  const tierMps = tierBaseMps(meta.messagingLimitTier);
  const tpMps = throughputBaseMps(meta.throughputLevel);
  let targetMps = Math.min(tierMps, tpMps);
  targetMps *= qualityMultiplier(meta.qualityRating);
  if (meta.canSendMessage === false) targetMps *= 0.25;
  if (input.isMarketingTemplate) targetMps *= 0.55;

  const modeFactor = mode === "fast" ? 0.85 : 0.5;
  targetMps *= modeFactor;
  targetMps = Math.min(targetMps, hardMaxMps(mode));
  targetMps = Math.max(0.25, targetMps);

  let sendConcurrency = targetMps >= 3 ? 3 : targetMps >= 1.5 ? 2 : 1;
  sendConcurrency = Math.min(sendConcurrency, hardMaxConcurrency(mode));

  const minIntervalMs = Math.max(
    200,
    Math.ceil((1000 / targetMps) * sendConcurrency)
  );

  let chunkPauseEvery = 0;
  let chunkPauseMs = 0;
  if (input.recipientCount >= 250) {
    chunkPauseEvery = mode === "fast" ? 100 : 75;
    chunkPauseMs = mode === "fast" ? 25_000 : 35_000;
  } else if (input.recipientCount >= 100) {
    chunkPauseEvery = mode === "fast" ? 75 : 50;
    chunkPauseMs = mode === "fast" ? 20_000 : 30_000;
  }

  const tierLabel = meta.messagingLimitTier || "unknown tier";
  const qualityLabel = meta.qualityRating || "unknown quality";

  return {
    mode,
    sendConcurrency,
    minIntervalMs,
    chunkPauseEvery,
    chunkPauseMs,
    estimatedSeconds: estimateDuration(
      input.recipientCount,
      sendConcurrency,
      minIntervalMs,
      chunkPauseEvery,
      chunkPauseMs
    ),
    meta,
    summary: `${mode} mode: ~${targetMps.toFixed(1)} msg/s (${sendConcurrency} parallel, ${minIntervalMs}ms batch gap) — ${tierLabel}, ${qualityLabel}`,
  };
}

function estimateDuration(
  recipients: number,
  concurrency: number,
  minIntervalMs: number,
  chunkPauseEvery: number,
  chunkPauseMs: number
): number {
  if (recipients <= 0) return 0;
  const batches = Math.ceil(recipients / concurrency);
  let seconds = (Math.max(0, batches - 1) * minIntervalMs) / 1000;
  if (chunkPauseEvery > 0 && chunkPauseMs > 0) {
    const pauses = Math.floor(recipients / chunkPauseEvery);
    seconds += (pauses * chunkPauseMs) / 1000;
  }
  return Math.ceil(seconds);
}

export function isMetaThrottleError(message: string): boolean {
  const m = (message || "").toLowerCase();
  return (
    m.includes("rate limit") ||
    m.includes("429") ||
    m.includes("too many") ||
    m.includes("spam rate") ||
    m.includes("#80007") ||
    m.includes("80007") ||
    m.includes("130429") ||
    m.includes("131049") ||
    m.includes("131048") ||
    m.includes("132015") ||
    m.includes("transient") ||
    m.includes("temporarily unavailable") ||
    m.includes("throughput") ||
    m.includes("pair rate") ||
    m.includes("healthy ecosystem") ||
    m.includes("ecosystem engagement") ||
    m.includes("business eligibility") ||
    m.includes("econnreset") ||
    m.includes("socket hang up") ||
    m.includes("etimedout")
  );
}

/** Token-bucket style limiter: spaces batch sends to respect minIntervalMs. */
export class CampaignSendRateLimiter {
  private nextBatchAt = 0;
  private minIntervalMs: number;
  private cooldownUntil = 0;

  constructor(minIntervalMs: number) {
    this.minIntervalMs = Math.max(200, minIntervalMs);
  }

  get intervalMs(): number {
    return this.minIntervalMs;
  }

  setMinIntervalMs(ms: number): void {
    this.minIntervalMs = Math.max(200, Math.min(60_000, ms));
  }

  increaseInterval(factor = 1.5, maxMs = 30_000): void {
    this.minIntervalMs = Math.min(maxMs, Math.round(this.minIntervalMs * factor));
  }

  triggerThrottleCooldown(cooldownMs = 45_000): void {
    this.cooldownUntil = Date.now() + cooldownMs;
    this.increaseInterval(2, 45_000);
  }

  async waitForBatch(): Promise<void> {
    const now = Date.now();
    if (now < this.cooldownUntil) {
      await sleep(this.cooldownUntil - now);
    }
    const t = Date.now();
    const wait = Math.max(0, this.nextBatchAt - t);
    if (wait > 0) await sleep(wait);
    this.nextBatchAt = Math.max(Date.now(), this.nextBatchAt) + this.minIntervalMs;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
