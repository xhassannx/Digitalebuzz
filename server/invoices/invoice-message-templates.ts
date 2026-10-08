export type InvoiceMessageContext = {
  organizationName: string;
  invoiceNo: string;
  customerName?: string | null;
  currency?: string | null;
  totalAmount?: number | null;
  amountPaid?: number | null;
  amountPending?: number | null;
  invoiceStatus?: string | null;
};

const ACCENT = "#0059bb";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatMoney(amount: number | null | undefined, currency = "INR"): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "—";
  const code = (currency || "INR").toUpperCase();
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${code} ${n.toFixed(2)}`;
  }
}

function statusLabel(status?: string | null): string {
  const s = String(status || "due").toLowerCase();
  if (s === "paid") return "Paid";
  if (s === "half_paid") return "Partially paid";
  return "Payment due";
}

function greetingName(customerName?: string | null): string {
  const name = customerName?.trim();
  return name || "Customer";
}

/** WhatsApp document caption (keep under ~1024 chars). */
export function buildInvoiceWhatsAppCaption(ctx: InvoiceMessageContext): string {
  const org = ctx.organizationName.trim() || "Our team";
  const name = greetingName(ctx.customerName);
  const total = formatMoney(ctx.totalAmount, ctx.currency);
  const status = statusLabel(ctx.invoiceStatus);
  const lines = [
    `📄 *Invoice ${ctx.invoiceNo}*`,
    "",
    `Hello ${name},`,
    "",
    `Please find your invoice attached from *${org}*.`,
    "",
    `• Invoice No: *${ctx.invoiceNo}*`,
    `• Total: *${total}*`,
    `• Status: *${status}*`,
  ];

  const pending = Number(ctx.amountPending);
  if (Number.isFinite(pending) && pending > 0 && ctx.invoiceStatus !== "paid") {
    lines.push(`• Amount pending: *${formatMoney(pending, ctx.currency)}*`);
  }

  lines.push(
    "",
    "Thank you for your business. Reply here if you have any questions.",
    "",
    `— ${org}`,
  );

  return lines.join("\n");
}

export function buildInvoiceEmailContent(ctx: InvoiceMessageContext): {
  subject: string;
  text: string;
  html: string;
} {
  const org = escapeHtml(ctx.organizationName.trim() || "Your Company");
  const name = escapeHtml(greetingName(ctx.customerName));
  const invoiceNo = escapeHtml(ctx.invoiceNo);
  const total = escapeHtml(formatMoney(ctx.totalAmount, ctx.currency));
  const status = escapeHtml(statusLabel(ctx.invoiceStatus));
  const paid = escapeHtml(formatMoney(ctx.amountPaid, ctx.currency));
  const pending = formatMoney(ctx.amountPending, ctx.currency);
  const pendingNum = Number(ctx.amountPending);
  const showPending = Number.isFinite(pendingNum) && pendingNum > 0 && ctx.invoiceStatus !== "paid";

  const subject = `Invoice ${ctx.invoiceNo} from ${ctx.organizationName.trim() || "Your Company"}`;

  const textLines = [
    `Dear ${greetingName(ctx.customerName)},`,
    "",
    `Please find attached invoice ${ctx.invoiceNo} from ${ctx.organizationName.trim() || "Your Company"}.`,
    "",
    `Invoice No: ${ctx.invoiceNo}`,
    `Total: ${formatMoney(ctx.totalAmount, ctx.currency)}`,
    `Status: ${statusLabel(ctx.invoiceStatus)}`,
  ];
  if (showPending) {
    textLines.push(`Amount pending: ${pending}`);
  }
  textLines.push("", "The invoice PDF is attached to this email.", "", "Thank you.", "", `— ${ctx.organizationName.trim() || "Your Company"}`);
  const text = textLines.join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f3f4f6;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 4px 24px rgba(15,23,42,0.06);">
          <tr>
            <td style="background:linear-gradient(135deg,${ACCENT} 0%,#1e40af 100%);padding:28px 32px;color:#ffffff;">
              <p style="margin:0 0 6px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.9;">Invoice</p>
              <h1 style="margin:0;font-size:24px;font-weight:700;line-height:1.3;">${org}</h1>
              <p style="margin:12px 0 0;font-size:15px;opacity:0.95;">Invoice <strong>${invoiceNo}</strong> is attached</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Dear ${name},</p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#374151;">
                Thank you for choosing <strong>${org}</strong>. Please find your invoice PDF attached to this email for your records.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 22px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px;line-height:1.8;">
                      <tr>
                        <td style="color:#6b7280;padding:4px 0;width:42%;">Invoice number</td>
                        <td style="color:#111827;font-weight:600;padding:4px 0;">${invoiceNo}</td>
                      </tr>
                      <tr>
                        <td style="color:#6b7280;padding:4px 0;">Total amount</td>
                        <td style="color:#111827;font-weight:600;padding:4px 0;">${total}</td>
                      </tr>
                      <tr>
                        <td style="color:#6b7280;padding:4px 0;">Amount paid</td>
                        <td style="color:#111827;font-weight:600;padding:4px 0;">${paid}</td>
                      </tr>
                      ${
                        showPending
                          ? `<tr>
                        <td style="color:#6b7280;padding:4px 0;">Amount pending</td>
                        <td style="color:#b45309;font-weight:600;padding:4px 0;">${escapeHtml(pending)}</td>
                      </tr>`
                          : ""
                      }
                      <tr>
                        <td style="color:#6b7280;padding:4px 0;">Payment status</td>
                        <td style="padding:4px 0;">
                          <span style="display:inline-block;background:${ctx.invoiceStatus === "paid" ? "#ecfdf5" : "#fff7ed"};color:${ctx.invoiceStatus === "paid" ? "#047857" : "#c2410c"};font-weight:600;font-size:12px;padding:4px 10px;border-radius:999px;">${status}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#4b5563;">
                📎 Your invoice document is attached as a PDF file.
              </p>
              <p style="margin:0;font-size:14px;line-height:1.6;color:#4b5563;">
                If you have any questions about this invoice, simply reply to this email and we will be happy to help.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid #f3f4f6;background:#fafafa;">
              <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7280;text-align:center;">
                Thank you for your business.<br />
                <strong style="color:#374151;">${org}</strong>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}
