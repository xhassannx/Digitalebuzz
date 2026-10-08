/** Map external webhook topics → canvas `selectedTrigger` ids. */
export function shopifyTopicToCanvasTrigger(topic: string): string | null {
  const t = topic.toLowerCase().trim();
  const map: Record<string, string> = {
    "orders/create": "new-order",
    "orders/paid": "new-paid-order",
    "customers/create": "new-customer",
    "checkouts/create": "new-abandoned-checkout",
    "checkouts/update": "new-abandoned-checkout",
    "orders/cancelled": "new-cancelled-order",
    "products/create": "updated-product",
    "products/update": "updated-product",
    "products/delete": "updated-product",
  };
  return map[t] ?? null;
}

export function woocommerceTopicToCanvasTrigger(topic: string): string | null {
  const t = topic.toLowerCase().trim();
  const map: Record<string, string> = {
    "product.created": "product-created",
    "product.updated": "product-updated",
    "product.deleted": "product-deleted",
    "order.created": "order-created",
    "order.updated": "order-updated",
    "order.deleted": "order-deleted",
    "coupon.created": "coupon-created",
    "coupon.updated": "coupon-updated",
    "coupon.deleted": "coupon-deleted",
    "customer.created": "customer-created",
    "customer.updated": "customer-updated",
    "customer.deleted": "customer-deleted",
  };
  return map[t] ?? null;
}

export function calendlyEventToCanvasTrigger(event: string): string | null {
  const e = event.toLowerCase().trim();
  if (e === "invitee.created") return "event-schedule";
  if (e === "invitee.canceled") return "event-canceled";
  return null;
}

export function razorpayEventToCanvasTrigger(event: string): string | null {
  const e = event.toLowerCase().trim();
  if (e === "order.paid") return "order-paid";
  if (e === "payment.captured") return "payment-captured";
  return null;
}

/** Flatten Shopify order/customer/product/checkout payloads for {{trigger.*}} templates. */
export function buildShopifyTriggerContext(
  body: Record<string, unknown>,
  topic?: string
): Record<string, unknown> {
  const topicLower = String(topic || "").toLowerCase();
  const isCustomerTopic = topicLower.startsWith("customers/");
  const isProductTopic = topicLower.startsWith("products/");

  // customers/* payload IS the customer; orders/checkouts nest customer under body.customer
  const nestedCustomer = (body.customer as Record<string, unknown>) || {};
  const customer = isCustomerTopic ? body : nestedCustomer;
  const defaultAddress = (customer.default_address as Record<string, unknown>) || {};
  const shipping = (body.shipping_address as Record<string, unknown>) || {};
  const billing = (body.billing_address as Record<string, unknown>) || {};

  const phone =
    body.phone ||
    body.sms_marketing_phone ||
    customer.phone ||
    defaultAddress.phone ||
    shipping.phone ||
    billing.phone ||
    "";
  const email = String(body.email || customer.email || "");
  const firstName = String(
    customer.first_name ||
      shipping.first_name ||
      billing.first_name ||
      body.first_name ||
      ""
  );
  const lastName = String(
    customer.last_name || shipping.last_name || billing.last_name || body.last_name || ""
  );
  const name =
    `${firstName} ${lastName}`.trim() ||
    String(body.name || body.title || "").trim() ||
    (email ? email.split("@")[0] : "");

  return {
    topic: topic || "",
    id: body.id,
    order_id: isProductTopic || isCustomerTopic ? undefined : body.id,
    product_id: isProductTopic ? body.id : undefined,
    customer_id: isCustomerTopic ? body.id : customer.id,
    title: body.title,
    handle: body.handle,
    total_price: body.total_price || body.subtotal_price || body.total_line_items_price,
    currency: body.currency || body.presentment_currency,
    financial_status: body.financial_status,
    cancel_reason: body.cancel_reason,
    cancelled_at: body.cancelled_at,
    abandoned_checkout_url: body.abandoned_checkout_url,
    completed_at: body.completed_at,
    ...body,
    // Normalized contact fields must win over raw webhook body values.
    phone,
    email,
    name,
  };
}

/** True when a Shopify checkout webhook should start abandoned-cart automation. */
export function isAbandonedCheckoutEligible(body: Record<string, unknown>): boolean {
  if (body.completed_at) return false;
  const phone = String(
    body.phone ||
      body.sms_marketing_phone ||
      (body.customer as Record<string, unknown> | undefined)?.phone ||
      (body.shipping_address as Record<string, unknown> | undefined)?.phone ||
      (body.billing_address as Record<string, unknown> | undefined)?.phone ||
      ""
  ).replace(/\D/g, "");
  return phone.length >= 10;
}

/** Phone present on order/customer payloads (WhatsApp send needs it). */
export function shopifyPayloadHasPhone(body: Record<string, unknown>, topic?: string): boolean {
  const ctx = buildShopifyTriggerContext(body, topic);
  return String(ctx.phone || "").replace(/\D/g, "").length >= 10;
}

export function buildLeadTriggerContext(lead: Record<string, unknown>): Record<string, unknown> {
  const phone =
    lead.mobile ||
    lead.phone ||
    lead.contact_number ||
    lead.ContactNumber ||
    lead.MOBILE ||
    "";
  const email = lead.email || lead.Email || lead.EMAIL || "";
  const name =
    lead.name ||
    lead.contact_name ||
    lead.ContactName ||
    lead.SENDERNAME ||
    lead.company_name ||
    "";
  return {
    name: String(name),
    email: String(email),
    phone: String(phone),
    company: lead.company || lead.company_name || lead.COMPANYNAME || "",
    city: lead.city || lead.CITY || "",
    ...lead,
  };
}

export function buildCalendlyTriggerContext(payload: Record<string, unknown>): Record<string, unknown> {
  const invitee = (payload.invitee as Record<string, unknown>) || {};
  const event = (payload.event as Record<string, unknown>) || payload.calendlyEvent || {};
  return {
    email: invitee.email || "",
    name: invitee.name || "",
    uri: invitee.uri || "",
    event_name: event.name || "",
    event_start: event.start_time || "",
    event_end: event.end_time || "",
    cancel_reason: payload.cancel_reason || "",
    ...payload,
  };
}

export function buildWebhookContextRoot(
  body: Record<string, unknown>,
  canvasTriggerId: string,
  opts?: { topic?: string }
): Record<string, unknown> {
  if (
    canvasTriggerId === "new-order" ||
    canvasTriggerId === "new-paid-order" ||
    canvasTriggerId === "new-customer" ||
    canvasTriggerId === "new-abandoned-checkout" ||
    canvasTriggerId === "new-cancelled-order" ||
    canvasTriggerId === "updated-product"
  ) {
    const trigger = buildShopifyTriggerContext(body, opts?.topic);
    return { raw: body, trigger };
  }

  if (
    canvasTriggerId.startsWith("product-") ||
    canvasTriggerId.startsWith("order-") ||
    canvasTriggerId.startsWith("coupon-") ||
    canvasTriggerId.startsWith("customer-") ||
    canvasTriggerId === "new-cart-abandonment"
  ) {
    const billing = (body.billing as Record<string, unknown>) || {};
    return {
      raw: body,
      trigger: {
        id: body.id,
        email: billing.email || body.email || "",
        phone: billing.phone || body.phone || "",
        total: body.total || body.total_price,
        status: body.status,
        ...body,
      },
    };
  }

  if (canvasTriggerId === "event-schedule" || canvasTriggerId === "event-canceled") {
    const trigger = buildCalendlyTriggerContext(body);
    return { raw: body, trigger };
  }

  if (canvasTriggerId === "new-lead" || canvasTriggerId === "tradeindia-new-lead" || canvasTriggerId === "justdial-new-lead") {
    const trigger = buildLeadTriggerContext(body);
    return { raw: body, trigger };
  }

  if (canvasTriggerId === "order-paid" || canvasTriggerId === "payment-captured") {
    const payload = (body.payload as Record<string, unknown>) || body;
    const payment = (payload.payment as { entity?: Record<string, unknown> })?.entity || {};
    const order = (payload.order as { entity?: Record<string, unknown> })?.entity || {};
    return {
      raw: body,
      trigger: {
        event: body.event || opts?.topic || "",
        payment_id: payment.id,
        order_id: order.id,
        amount: payment.amount,
        currency: payment.currency,
        email: payment.email,
        contact: payment.contact,
        ...payment,
      },
    };
  }

  if (canvasTriggerId === "new-spreadsheet-rows") {
    const row = (body.row || body) as Record<string, unknown>;
    return { raw: body, trigger: row };
  }

  if (canvasTriggerId === "catch-raw-webhook" || canvasTriggerId === "zoom-webhook") {
    return { raw: body, trigger: body };
  }

  return { raw: body, trigger: body };
}
