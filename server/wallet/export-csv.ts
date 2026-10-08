import type { WalletTransactionRow } from "@shared/schema";

function csvEscape(val: string | number | null | undefined): string {
  if (val == null) return "";
  const s = String(val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function walletTransactionsToCsv(rows: WalletTransactionRow[]): string {
  const headers = [
    "id",
    "created_at",
    "type",
    "amount_minor",
    "balance_after_minor",
    "currency",
    "meta_category",
    "meta_cost_minor",
    "markup_minor",
    "charged_minor",
    "recipient_country_iso",
    "rate_version_id",
    "description",
    "reference_type",
    "reference_id",
    "gateway_order_id",
    "gateway_payment_id",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
        r.type,
        r.amountMinor,
        r.balanceAfterMinor,
        r.currency,
        r.metaCategory,
        r.metaCostMinor,
        r.markupMinor,
        r.chargedMinor,
        r.recipientCountryIso,
        r.rateVersionId,
        r.description,
        r.referenceType,
        r.referenceId,
        r.gatewayOrderId,
        r.gatewayPaymentId,
      ]
        .map(csvEscape)
        .join(",")
    );
  }
  return lines.join("\n");
}
