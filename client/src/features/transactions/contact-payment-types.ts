export type ContactPaymentRequestRow = {
  id: string;
  token: string;
  status: string;
  currency: string;
  amountMinor: number;
  gateway: string;
  gatewayPaymentId?: string | null;
  description?: string | null;
  createdAt: string;
  paidAt?: string | null;
  customerPhone?: string | null;
  contactId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type TransactionDisplayStatus = "paid" | "pending" | "failed";

export function getTransactionDisplayStatus(status: string): TransactionDisplayStatus {
  const s = status?.toLowerCase() ?? "";
  if (s === "paid") return "paid";
  if (s === "failed" || s === "expired" || s === "cancelled" || s === "canceled") return "failed";
  return "pending";
}

export function formatTransactionId(row: ContactPaymentRequestRow): string {
  if (row.gatewayPaymentId) {
    const id = row.gatewayPaymentId.replace(/\s/g, "");
    return `#${id.length > 8 ? id.slice(-8).toUpperCase() : id.toUpperCase()}`;
  }
  return `#TXN${row.token.slice(0, 4).toUpperCase()}`;
}

export function formatTransactionAmount(row: ContactPaymentRequestRow): string {
  const major = row.amountMinor / 100;
  const symbol = row.currency === "INR" ? "₹" : row.currency === "USD" ? "$" : "";
  const formatted = major.toLocaleString(undefined, {
    minimumFractionDigits: major % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return symbol ? `${symbol}${formatted}` : `${row.currency} ${formatted}`;
}
