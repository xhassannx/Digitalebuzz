/**
 * Create payment links using org-stored Razorpay / Cashfree credentials (not platform env keys).
 */
export async function createRazorpayPaymentLink(params: {
  keyId: string;
  keySecret: string;
  amountPaise: number;
  currency: string;
  description: string;
  customerName?: string;
  customerContactDigits?: string;
  callbackUrl?: string;
}): Promise<{ id: string; short_url: string }> {
  const auth = Buffer.from(`${params.keyId}:${params.keySecret}`).toString("base64");
  const body: Record<string, unknown> = {
    amount: params.amountPaise,
    currency: params.currency,
    description: params.description.slice(0, 255),
    notify: { sms: false, email: false },
  };
  if (params.customerName || params.customerContactDigits) {
    const customer: Record<string, string> = {};
    if (params.customerName) customer.name = params.customerName.slice(0, 120);
    if (params.customerContactDigits) {
      customer.contact = params.customerContactDigits.replace(/\D/g, "").slice(- 15);
    }
    body.customer = customer;
  }
  if (params.callbackUrl) {
    body.callback_url = params.callbackUrl;
    body.callback_method = "get";
  }
  const res = await fetch("https://api.razorpay.com/v1/payment_links", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = (data.error as { description?: string } | undefined)?.description;
    throw new Error(err || (data.message as string) || "Razorpay payment link failed");
  }
  const id = data.id as string;
  const short_url = data.short_url as string;
  if (!id || !short_url) throw new Error("Razorpay returned no payment link");
  return { id, short_url };
}

export async function createCashfreePaymentLink(params: {
  clientId: string;
  clientSecret: string;
  linkId: string;
  amountRupees: number;
  currency: string;
  customerPhoneDigits: string;
  purpose: string;
  notifyUrl?: string;
  useSandbox?: boolean;
}): Promise<{ link_url: string; link_id: string }> {
  const host = params.useSandbox ? "https://sandbox.cashfree.com" : "https://api.cashfree.com";
  const res = await fetch(`${host}/pg/links`, {
    method: "POST",
    headers: {
      "x-client-id": params.clientId,
      "x-client-secret": params.clientSecret,
      "x-api-version": "2023-08-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      link_id: params.linkId.slice(0, 40),
      link_amount: params.amountRupees,
      link_currency: params.currency,
      link_purpose: params.purpose.slice(0, 120),
      customer_details: {
        customer_phone: params.customerPhoneDigits.replace(/\D/g, "").slice(- 12),
      },
      link_notify: { send_sms: false, send_email: false },
      link_auto_reminders: true,
      ...(params.notifyUrl ? { link_notify_url: params.notifyUrl } : {}),
    }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      (data.message as string) ||
      (data.error as string) ||
      JSON.stringify(data).slice(0, 200) ||
      "Cashfree payment link failed";
    throw new Error(msg);
  }
  const link_url = (data.link_url as string) || (data.linkUrl as string);
  if (!link_url) throw new Error("Cashfree returned no link URL");
  return { link_url, link_id: params.linkId.slice(0, 40) };
}
