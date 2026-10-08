import { storage } from "../storage";

type PrefixEntry = { iso: string; prefix: string };

let prefixCache: PrefixEntry[] | null = null;
let cacheAt = 0;
const CACHE_TTL_MS = 60 * 60 * 1000;

async function loadPrefixCache(): Promise<PrefixEntry[]> {
  const now = Date.now();
  if (prefixCache && now - cacheAt < CACHE_TTL_MS) return prefixCache;
  const rows = await storage.getCountryDialCodes();
  const entries: PrefixEntry[] = [];
  for (const row of rows) {
    const digits = String(row.dialPrefix || "").replace(/\D/g, "");
    if (!digits || !row.isoCode) continue;
    entries.push({ iso: row.isoCode.toUpperCase(), prefix: digits });
  }
  entries.sort((a, b) => b.prefix.length - a.prefix.length);
  prefixCache = entries;
  cacheAt = now;
  return entries;
}

/** Normalize WhatsApp / E.164-ish number to digits only. */
export function normalizeRecipientDigits(phone: string | null | undefined): string {
  let d = String(phone || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  return d;
}

/**
 * Resolve ISO country from recipient phone using longest matching dial prefix.
 * Falls back to `defaultIso` (usually IN or DEFAULT).
 */
export async function resolveCountryIsoFromPhone(
  phone: string | null | undefined,
  defaultIso = "IN"
): Promise<string> {
  const digits = normalizeRecipientDigits(phone);
  if (!digits || digits.length < 8) return defaultIso.toUpperCase();

  const prefixes = await loadPrefixCache();
  for (const { iso, prefix } of prefixes) {
    if (digits.startsWith(prefix)) return iso;
  }
  return defaultIso.toUpperCase();
}
