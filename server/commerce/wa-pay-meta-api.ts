const GRAPH_API_VERSION = "v23.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export type MetaPaymentLookupResult = {
  reference_id?: string;
  status?: "pending" | "captured" | string;
  currency?: string;
  amount?: { value: number; offset: number };
  transactions?: Array<{
    id?: string;
    pg_transaction_id?: string;
    type?: string;
    status?: string;
    method?: { type?: string };
  }>;
};

function encodePathSegment(value: string): string {
  return encodeURIComponent(value.trim());
}

/** Meta Step 5: GET /{phone-number-id}/payments/{payment_configuration}/{reference_id} */
export async function lookupWhatsAppPayment(
  accessToken: string,
  phoneNumberId: string,
  paymentConfigurationName: string,
  referenceId: string
): Promise<MetaPaymentLookupResult> {
  const config = encodePathSegment(paymentConfigurationName);
  const ref = encodePathSegment(referenceId);
  const url = `${GRAPH_BASE}/${phoneNumberId}/payments/${config}/${ref}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try {
      const err = JSON.parse(text);
      msg = err.error?.message || text;
    } catch {
      // keep raw
    }
    throw new Error(`WhatsApp payment lookup failed: ${msg}`);
  }
  return JSON.parse(text) as MetaPaymentLookupResult;
}

export type WaPayOrderStatusValue =
  | "processing"
  | "partially_shipped"
  | "shipped"
  | "completed"
  | "canceled";

/** Meta Step 6: interactive order_status message */
export async function sendWhatsAppOrderStatusMessage(opts: {
  accessToken: string;
  phoneNumberId: string;
  to: string;
  referenceId: string;
  orderStatus: WaPayOrderStatusValue;
  bodyText: string;
  description?: string;
}): Promise<{ messageId: string }> {
  const to = opts.to.replace(/\D/g, "");
  const url = `${GRAPH_BASE}/${opts.phoneNumberId}/messages`;

  const order: Record<string, string> = { status: opts.orderStatus };
  if (opts.description?.trim()) {
    order.description = opts.description.trim().slice(0, 120);
  }

  const requestBody = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "order_status",
      body: { text: opts.bodyText.slice(0, 1024) },
      action: {
        name: "review_order",
        parameters: {
          reference_id: opts.referenceId.slice(0, 35),
          order,
        },
      },
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try {
      const err = JSON.parse(text);
      msg = err.error?.message || text;
    } catch {
      // keep raw
    }
    throw new Error(`WhatsApp order_status send failed: ${msg}`);
  }

  const data = JSON.parse(text) as { messages?: Array<{ id?: string }> };
  const messageId = data.messages?.[0]?.id || "";
  return { messageId };
}
