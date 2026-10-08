/** Digits only (no +, spaces, WhatsApp JID suffixes). */
export function phoneDigits(raw: string): string {
  return String(raw || "")
    .replace(/@c\.us$/i, "")
    .replace(/@s\.whatsapp\.net$/i, "")
    .replace(/@g\.us$/i, "")
    .replace(/\D/g, "");
}

/**
 * Match phone numbers that differ by country-code prefix / formatting
 * (e.g. 8284198543 vs 918284198543 vs +91 82841 98543).
 */
export function phonesMatchDigits(a: string, b: string): boolean {
  const da = phoneDigits(a);
  const db = phoneDigits(b);
  if (!da || !db) return false;
  return da === db || da.endsWith(db) || db.endsWith(da);
}

/** Prefer the longer digit string (usually includes country code) for Meta API sends. */
export function preferCanonicalPhoneForSend(candidates: string[]): string {
  let best = "";
  for (const c of candidates) {
    const d = phoneDigits(c);
    if (d.length > phoneDigits(best).length) best = d;
  }
  return best || String(candidates[0] || "").trim();
}
