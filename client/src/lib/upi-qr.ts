import QRCode from "qrcode";

/** Basic UPI VPA check (e.g. name@bank, phone@paytm). */
export function isValidUpiId(upiId: string): boolean {
  const value = upiId.trim();
  if (!value || value.length < 3) return false;
  return /^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+$/.test(value);
}

export function buildUpiPaymentUri(params: {
  upiId: string;
  payeeName?: string;
  amount?: number;
  currency?: string;
  note?: string;
}): string {
  const pa = params.upiId.trim();
  const pn = encodeURIComponent((params.payeeName || "Payment").slice(0, 100));
  const cu = (params.currency || "INR").toUpperCase();
  const query = new URLSearchParams({ pa, pn, cu });
  if (params.amount != null && params.amount > 0) {
    query.set("am", params.amount.toFixed(2));
  }
  if (params.note?.trim()) {
    query.set("tn", params.note.trim().slice(0, 100));
  }
  return `upi://pay?${query.toString()}`;
}

export async function generateUpiQrDataUrl(uri: string, size = 96): Promise<string> {
  return QRCode.toDataURL(uri, {
    width: size,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}
