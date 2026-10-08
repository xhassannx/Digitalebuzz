/** Build invoice number from optional prefix + start counter. Blank prefix → number only (e.g. "6"). */
export function formatInvoiceNumber(prefix: string | null | undefined, start: number): string {
  const p = prefix?.trim() ?? "";
  return p ? `${p}${start}` : String(start);
}

export type InvoicePaymentStatus = "due" | "half_paid" | "paid";

export const INVOICE_PAYMENT_STATUS_OPTIONS = [
  { value: "due" as const, label: "Due" },
  { value: "half_paid" as const, label: "Half Paid" },
  { value: "paid" as const, label: "Paid" },
];

export function invoicePaymentStatusLabel(status: InvoicePaymentStatus): string {
  return INVOICE_PAYMENT_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? "Due";
}

export function normalizeInvoicePaymentStatus(value: unknown): InvoicePaymentStatus {
  if (value === "half_paid" || value === "paid" || value === "due") return value;
  return "due";
}

function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

/** Paid / pending split from invoice status and optional partial payment (half paid). */
export function computeInvoicePaymentAmounts(
  status: InvoicePaymentStatus,
  grandTotal: number,
  amountPaidInput?: number | null,
): { amountPaid: number; amountPending: number } {
  const total = roundMoney(Math.max(0, grandTotal));
  if (status === "paid") {
    return { amountPaid: total, amountPending: 0 };
  }
  if (status === "due") {
    return { amountPaid: 0, amountPending: total };
  }
  const defaultHalf = roundMoney(total / 2);
  const paid = roundMoney(Math.min(total, Math.max(0, amountPaidInput ?? defaultHalf)));
  return { amountPaid: paid, amountPending: roundMoney(total - paid) };
}
