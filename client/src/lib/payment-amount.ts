/** Parse INR / major-unit amount from chat or contact payment inputs. */
export function parsePaymentAmountInput(raw: string): number {
  const cleaned = raw
    .trim()
    .replace(/^INR\s*/i, "")
    .replace(/^₹\s*/, "")
    .replace(/,/g, "")
    .replace(/[^\d.]/g, "");
  const n = parseFloat(cleaned);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("Enter a valid amount");
  }
  return n;
}
