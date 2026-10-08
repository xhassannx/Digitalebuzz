/** Meta catalog price: "1099.00 INR" (not cents integer). */
export function formatMetaCatalogPrice(amountMajor: number, currency = "INR"): string {
  const n = Number.isFinite(amountMajor) ? amountMajor : 0;
  return `${n.toFixed(2)} ${currency}`;
}

/** Parse Meta catalog price strings like "1099.00 INR" to major currency units. */
export function parseMetaCatalogPriceMajor(price?: string | null): number | null {
  if (!price?.trim()) return null;
  const match = price.trim().match(/^([\d,.]+)/);
  if (!match) return null;
  const normalized = match[1].replace(/,/g, "");
  const n = parseFloat(normalized);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseShopifyPriceMajor(price?: string): number {
  const n = parseFloat(price || "0");
  return Number.isFinite(n) ? n : 0;
}

export function pickShopifyProductImage(p: {
  image?: { src?: string };
  images?: Array<{ src?: string }>;
}): string | undefined {
  return p.image?.src || p.images?.[0]?.src || undefined;
}
