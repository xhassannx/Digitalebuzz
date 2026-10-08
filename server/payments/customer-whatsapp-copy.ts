/** Professional WhatsApp copy for contact payment & meet flows (plain text). */

export function contactPaymentRequestWhatsAppBody(params: {
  firstName: string;
  currency: string;
  amountStr: string;
  panelPayUrl: string;
  shortUrl: string;
  note?: string;
}): string {
  const note = params.note?.trim();
  const refBlock = note ? `\n\nReference: ${note}` : "";
  return `Hello ${params.firstName},

Thank you for your business. Please complete your payment of ${params.currency} ${params.amountStr} using the secure link below.

Pay now:
${params.shortUrl}

If the link above does not open, copy and paste this URL into your browser:
${params.panelPayUrl}${refBlock}

Need help? Reply to this message and our team will assist you.`;
}

export function contactPaymentReceivedWhatsAppBody(params: {
  currency: string;
  amountStr: string;
  gatewayPaymentId?: string;
}): string {
  const ref = params.gatewayPaymentId?.trim();
  const refLine = ref ? `\n\nTransaction reference: ${ref}` : "";
  return `Hello,

Your payment of ${params.currency} ${params.amountStr} has been received successfully.${refLine}

Thank you for your payment. We're here if you need anything else.`;
}
