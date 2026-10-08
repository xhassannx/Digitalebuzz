/**
 * Sample webhook payloads for Postman / curl testing of automation flows.
 * Keys = canvas `selectedTrigger` ids.
 */

export type FlowWebhookTestPayload = {
  triggerId: string;
  label: string;
  method: "POST";
  /** Relative path; caller prefixes BASE_URL / origin */
  path: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
  /** Extra query string keys (without ?) */
  query?: Record<string, string>;
  notes: string[];
  /** Variables commonly used after this trigger */
  templateHints: string[];
  /** False for internal/polled triggers that cannot be fired via flow webhook URL */
  webhookCapable: boolean;
};

const TEST_PHONE = "919876543210";
const TEST_EMAIL = "test.customer@example.com";
const TEST_NAME = "Priya Sharma";

function shopifyOrderBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 5678901234,
    email: TEST_EMAIL,
    phone: `+${TEST_PHONE}`,
    total_price: "2499.00",
    subtotal_price: "2499.00",
    currency: "INR",
    financial_status: "pending",
    name: "#1001",
    customer: {
      id: 111222333,
      first_name: "Priya",
      last_name: "Sharma",
      email: TEST_EMAIL,
      phone: `+${TEST_PHONE}`,
    },
    shipping_address: {
      first_name: "Priya",
      last_name: "Sharma",
      phone: `+${TEST_PHONE}`,
      address1: "12 MG Road",
      city: "Mumbai",
      province: "MH",
      country: "IN",
      zip: "400001",
    },
    billing_address: {
      phone: `+${TEST_PHONE}`,
    },
    line_items: [
      {
        id: 1,
        title: "Sample Product",
        quantity: 1,
        price: "2499.00",
      },
    ],
    cancel_reason: null,
    cancelled_at: null,
    ...overrides,
  };
}

function shopifyCheckoutBody(): Record<string, unknown> {
  return {
    id: 9876543210,
    token: "test-checkout-token",
    email: TEST_EMAIL,
    phone: `+${TEST_PHONE}`,
    total_price: "1499.00",
    subtotal_price: "1499.00",
    currency: "INR",
    abandoned_checkout_url: "https://example.myshopify.com/123/checkouts/abc/recover",
    completed_at: null,
    customer: {
      id: 111222333,
      first_name: "Priya",
      last_name: "Sharma",
      email: TEST_EMAIL,
      phone: `+${TEST_PHONE}`,
    },
    shipping_address: {
      first_name: "Priya",
      last_name: "Sharma",
      phone: `+${TEST_PHONE}`,
    },
    billing_address: {
      phone: `+${TEST_PHONE}`,
    },
    line_items: [
      {
        title: "Sample Product",
        quantity: 1,
        price: "1499.00",
      },
    ],
  };
}

function shopifyCustomerBody(): Record<string, unknown> {
  return {
    id: 111222333,
    email: TEST_EMAIL,
    first_name: "Priya",
    last_name: "Sharma",
    phone: `+${TEST_PHONE}`,
    default_address: {
      phone: `+${TEST_PHONE}`,
      city: "Mumbai",
      country: "IN",
    },
  };
}

function shopifyProductBody(): Record<string, unknown> {
  return {
    id: 7788990011,
    title: "Sample Product",
    handle: "sample-product",
    vendor: "Test Store",
    product_type: "General",
    status: "active",
  };
}

function wooOrderBody(): Record<string, unknown> {
  return {
    id: 1001,
    status: "processing",
    total: "2499.00",
    currency: "INR",
    billing: {
      first_name: "Priya",
      last_name: "Sharma",
      email: TEST_EMAIL,
      phone: TEST_PHONE,
    },
    line_items: [{ name: "Sample Product", quantity: 1, total: "2499.00" }],
  };
}

function wooCustomerBody(): Record<string, unknown> {
  return {
    id: 55,
    email: TEST_EMAIL,
    first_name: "Priya",
    last_name: "Sharma",
    billing: { phone: TEST_PHONE, email: TEST_EMAIL },
  };
}

function wooProductBody(): Record<string, unknown> {
  return {
    id: 88,
    name: "Sample Product",
    slug: "sample-product",
    status: "publish",
    price: "999.00",
  };
}

function wooCouponBody(): Record<string, unknown> {
  return {
    id: 12,
    code: "TEST10",
    amount: "10",
    discount_type: "percent",
  };
}

function leadBody(): Record<string, unknown> {
  return {
    name: TEST_NAME,
    mobile: TEST_PHONE,
    phone: TEST_PHONE,
    email: TEST_EMAIL,
    company_name: "Test Company",
    city: "Mumbai",
    query_message: "Interested in your product",
  };
}

function calendlyBody(event: "invitee.created" | "invitee.canceled"): Record<string, unknown> {
  return {
    event,
    invitee: {
      email: TEST_EMAIL,
      name: TEST_NAME,
      uri: "https://api.calendly.com/invitees/AAAA",
    },
    event_details: {
      name: "Discovery Call",
      start_time: new Date(Date.now() + 86400000).toISOString(),
      end_time: new Date(Date.now() + 90000000).toISOString(),
    },
    // flattened aliases used by buildCalendlyTriggerContext
    calendlyEvent: {
      name: "Discovery Call",
      start_time: new Date(Date.now() + 86400000).toISOString(),
      end_time: new Date(Date.now() + 90000000).toISOString(),
    },
    cancel_reason: event === "invitee.canceled" ? "Schedule conflict" : "",
  };
}

function razorpayPaymentBody(event: "order.paid" | "payment.captured"): Record<string, unknown> {
  return {
    event,
    payload: {
      payment: {
        entity: {
          id: "pay_test123",
          amount: 249900,
          currency: "INR",
          status: "captured",
          email: TEST_EMAIL,
          contact: `+${TEST_PHONE}`,
          order_id: "order_test123",
        },
      },
      order: {
        entity: {
          id: "order_test123",
          amount: 249900,
          currency: "INR",
          status: "paid",
        },
      },
    },
  };
}

type Spec = {
  label: string;
  headers?: Record<string, string>;
  body: Record<string, unknown>;
  query?: Record<string, string>;
  notes?: string[];
  templateHints?: string[];
  webhookCapable?: boolean;
};

const SPECS: Record<string, Spec> = {
  // —— Shopify ——
  "new-order": {
    label: "Shopify — New Order",
    headers: { "X-Shopify-Topic": "orders/create", "Content-Type": "application/json" },
    body: shopifyOrderBody({ financial_status: "pending" }),
    notes: [
      "Flow must be Published (Active).",
      "Matches Shopify Admin webhook: Order creation.",
      "Send Template phone: {{trigger.phone}}",
    ],
    templateHints: ["{{trigger.phone}}", "{{trigger.email}}", "{{trigger.name}}", "{{trigger.total_price}}", "{{trigger.order_id}}"],
  },
  "new-paid-order": {
    label: "Shopify — New Paid Order",
    headers: { "X-Shopify-Topic": "orders/paid", "Content-Type": "application/json" },
    body: shopifyOrderBody({ financial_status: "paid" }),
    notes: ["Flow must be Published.", "Topic: orders/paid"],
    templateHints: ["{{trigger.phone}}", "{{trigger.email}}", "{{trigger.name}}", "{{trigger.total_price}}", "{{trigger.financial_status}}"],
  },
  "new-customer": {
    label: "Shopify — New Customer",
    headers: { "X-Shopify-Topic": "customers/create", "Content-Type": "application/json" },
    body: shopifyCustomerBody(),
    notes: ["Flow must be Published.", "Topic: customers/create"],
    templateHints: ["{{trigger.phone}}", "{{trigger.email}}", "{{trigger.name}}"],
  },
  "new-abandoned-checkout": {
    label: "Shopify — Abandoned Checkout",
    headers: { "X-Shopify-Topic": "checkouts/update", "Content-Type": "application/json" },
    body: shopifyCheckoutBody(),
    notes: [
      "Flow must be Published.",
      "Use checkouts/create or checkouts/update.",
      "completed_at must be null; phone must have ≥10 digits or the run is skipped.",
      "Delay nodes still wait — use a short delay for Postman tests.",
    ],
    templateHints: [
      "{{trigger.phone}}",
      "{{trigger.email}}",
      "{{trigger.name}}",
      "{{trigger.abandoned_checkout_url}}",
      "{{trigger.total_price}}",
    ],
  },
  "new-cancelled-order": {
    label: "Shopify — Cancelled Order",
    headers: { "X-Shopify-Topic": "orders/cancelled", "Content-Type": "application/json" },
    body: shopifyOrderBody({
      financial_status: "voided",
      cancel_reason: "customer",
      cancelled_at: new Date().toISOString(),
    }),
    notes: ["Flow must be Published.", "Topic: orders/cancelled"],
    templateHints: ["{{trigger.phone}}", "{{trigger.cancel_reason}}", "{{trigger.order_id}}"],
  },
  "updated-product": {
    label: "Shopify — Product Create/Update/Delete",
    headers: { "X-Shopify-Topic": "products/update", "Content-Type": "application/json" },
    body: shopifyProductBody(),
    notes: ["Topic can be products/create, products/update, or products/delete."],
    templateHints: ["{{trigger.title}}", "{{trigger.handle}}", "{{trigger.product_id}}"],
  },

  // —— WooCommerce ——
  "order-created": {
    label: "WooCommerce — Order created",
    headers: { "X-WC-Webhook-Topic": "order.created", "Content-Type": "application/json" },
    body: wooOrderBody(),
    templateHints: ["{{trigger.phone}}", "{{trigger.email}}", "{{trigger.total}}", "{{trigger.id}}"],
  },
  "order-updated": {
    label: "WooCommerce — Order updated",
    headers: { "X-WC-Webhook-Topic": "order.updated", "Content-Type": "application/json" },
    body: wooOrderBody(),
    templateHints: ["{{trigger.phone}}", "{{trigger.status}}", "{{trigger.total}}"],
  },
  "order-deleted": {
    label: "WooCommerce — Order deleted",
    headers: { "X-WC-Webhook-Topic": "order.deleted", "Content-Type": "application/json" },
    body: { id: 1001, status: "trash" },
    templateHints: ["{{trigger.id}}"],
  },
  "product-created": {
    label: "WooCommerce — Product created",
    headers: { "X-WC-Webhook-Topic": "product.created", "Content-Type": "application/json" },
    body: wooProductBody(),
    templateHints: ["{{trigger.name}}", "{{trigger.id}}", "{{trigger.price}}"],
  },
  "product-updated": {
    label: "WooCommerce — Product updated",
    headers: { "X-WC-Webhook-Topic": "product.updated", "Content-Type": "application/json" },
    body: wooProductBody(),
    templateHints: ["{{trigger.name}}", "{{trigger.id}}"],
  },
  "product-deleted": {
    label: "WooCommerce — Product deleted",
    headers: { "X-WC-Webhook-Topic": "product.deleted", "Content-Type": "application/json" },
    body: { id: 88, name: "Sample Product", status: "trash" },
    templateHints: ["{{trigger.id}}"],
  },
  "coupon-created": {
    label: "WooCommerce — Coupon created",
    headers: { "X-WC-Webhook-Topic": "coupon.created", "Content-Type": "application/json" },
    body: wooCouponBody(),
    templateHints: ["{{trigger.code}}", "{{trigger.amount}}"],
  },
  "coupon-updated": {
    label: "WooCommerce — Coupon updated",
    headers: { "X-WC-Webhook-Topic": "coupon.updated", "Content-Type": "application/json" },
    body: wooCouponBody(),
    templateHints: ["{{trigger.code}}"],
  },
  "coupon-deleted": {
    label: "WooCommerce — Coupon deleted",
    headers: { "X-WC-Webhook-Topic": "coupon.deleted", "Content-Type": "application/json" },
    body: { id: 12, code: "TEST10" },
    templateHints: ["{{trigger.code}}"],
  },
  "customer-created": {
    label: "WooCommerce — Customer created",
    headers: { "X-WC-Webhook-Topic": "customer.created", "Content-Type": "application/json" },
    body: wooCustomerBody(),
    templateHints: ["{{trigger.phone}}", "{{trigger.email}}"],
  },
  "customer-updated": {
    label: "WooCommerce — Customer updated",
    headers: { "X-WC-Webhook-Topic": "customer.updated", "Content-Type": "application/json" },
    body: wooCustomerBody(),
    templateHints: ["{{trigger.phone}}", "{{trigger.email}}"],
  },
  "customer-deleted": {
    label: "WooCommerce — Customer deleted",
    headers: { "X-WC-Webhook-Topic": "customer.deleted", "Content-Type": "application/json" },
    body: { id: 55, email: TEST_EMAIL },
    templateHints: ["{{trigger.id}}"],
  },
  "new-cart-abandonment": {
    label: "WooCommerce — Cart abandonment",
    headers: { "X-WC-Webhook-Topic": "action.woocommerce_cart_abandoned", "Content-Type": "application/json" },
    body: {
      id: "cart_test_1",
      email: TEST_EMAIL,
      phone: TEST_PHONE,
      total: "1499.00",
      cart_url: "https://example.com/cart",
    },
    notes: ["Depends on your abandonment plugin topic; adjust X-WC-Webhook-Topic if needed."],
    templateHints: ["{{trigger.phone}}", "{{trigger.email}}", "{{trigger.total}}", "{{trigger.cart_url}}"],
  },

  // —— Calendly ——
  "event-schedule": {
    label: "Calendly — Event schedule",
    headers: { "X-Calendly-Event": "invitee.created", "Content-Type": "application/json" },
    body: calendlyBody("invitee.created"),
    templateHints: ["{{trigger.email}}", "{{trigger.name}}", "{{trigger.event_name}}", "{{trigger.event_start}}"],
  },
  "event-canceled": {
    label: "Calendly — Event canceled",
    headers: { "X-Calendly-Event": "invitee.canceled", "Content-Type": "application/json" },
    body: calendlyBody("invitee.canceled"),
    templateHints: ["{{trigger.email}}", "{{trigger.name}}", "{{trigger.cancel_reason}}"],
  },

  // —— Razorpay ——
  "order-paid": {
    label: "Razorpay — Order paid",
    headers: { "X-Razorpay-Event": "order.paid", "Content-Type": "application/json" },
    body: razorpayPaymentBody("order.paid"),
    templateHints: ["{{trigger.contact}}", "{{trigger.email}}", "{{trigger.amount}}", "{{trigger.order_id}}"],
  },
  "payment-captured": {
    label: "Razorpay — Payment captured",
    headers: { "X-Razorpay-Event": "payment.captured", "Content-Type": "application/json" },
    body: razorpayPaymentBody("payment.captured"),
    templateHints: ["{{trigger.contact}}", "{{trigger.email}}", "{{trigger.payment_id}}", "{{trigger.amount}}"],
  },

  // —— Leads ——
  "new-lead": {
    label: "IndiaMART — New lead",
    headers: { "Content-Type": "application/json", "X-Canvas-Trigger": "new-lead" },
    body: leadBody(),
    templateHints: ["{{trigger.phone}}", "{{trigger.mobile}}", "{{trigger.name}}", "{{trigger.email}}"],
  },
  "tradeindia-new-lead": {
    label: "TradeIndia — New lead",
    headers: { "Content-Type": "application/json", "X-Canvas-Trigger": "tradeindia-new-lead" },
    body: leadBody(),
    templateHints: ["{{trigger.phone}}", "{{trigger.name}}", "{{trigger.email}}"],
  },
  "justdial-new-lead": {
    label: "Justdial — New lead",
    headers: { "Content-Type": "application/json", "X-Canvas-Trigger": "justdial-new-lead" },
    body: leadBody(),
    templateHints: ["{{trigger.phone}}", "{{trigger.name}}", "{{trigger.email}}"],
  },

  // —— Generic webhooks ——
  "catch-raw-webhook": {
    label: "Catch raw webhook",
    headers: { "Content-Type": "application/json" },
    body: {
      name: "Test User",
      mobile: TEST_PHONE,
      email: TEST_EMAIL,
      event: "webinar.registration_created",
    },
    notes: ["Any JSON body works. Map fields as {{trigger.*}} or {{raw}}."],
    templateHints: ["{{trigger.name}}", "{{trigger.mobile}}", "{{trigger.email}}", "{{raw}}"],
  },
  "zoom-webhook": {
    label: "Zoom webhook",
    headers: { "Content-Type": "application/json" },
    body: {
      event: "meeting.ended",
      payload: {
        object: {
          id: "123456789",
          topic: "Test Meeting",
          host_email: TEST_EMAIL,
        },
      },
      name: "Test User",
      mobile: TEST_PHONE,
      email: TEST_EMAIL,
    },
    templateHints: ["{{trigger.name}}", "{{trigger.mobile}}", "{{trigger.email}}", "{{raw}}"],
  },

  // —— Non-webhook (documented samples for context preview only) ——
  "text-message-received": {
    label: "WhatsApp — Text message received",
    body: { from: TEST_PHONE, text: "Hello", messageId: "wamid.test" },
    webhookCapable: false,
    notes: ["Cannot fire via flow webhook URL. Reply to the WhatsApp number connected to this org."],
    templateHints: ["{{trigger.from}}", "{{trigger.text}}"],
  },
  "list-message-reply": {
    label: "WhatsApp — List reply",
    body: { from: TEST_PHONE, listReplyId: "option_1", title: "Option 1" },
    webhookCapable: false,
    notes: ["Triggered by inbound WhatsApp interactive list replies."],
    templateHints: ["{{trigger.from}}", "{{trigger.listReplyId}}"],
  },
  "template-message-button-reply": {
    label: "WhatsApp — Template button reply",
    body: { from: TEST_PHONE, buttonText: "Yes", buttonPayload: "yes" },
    webhookCapable: false,
    notes: ["Triggered by inbound WhatsApp template button taps."],
    templateHints: ["{{trigger.from}}", "{{trigger.buttonText}}"],
  },
  "interactive-message-button-reply": {
    label: "WhatsApp — Interactive button reply",
    body: { from: TEST_PHONE, buttonId: "btn_1", buttonText: "Confirm" },
    webhookCapable: false,
    notes: ["Triggered by inbound WhatsApp interactive buttons."],
    templateHints: ["{{trigger.from}}", "{{trigger.buttonId}}"],
  },
  "form-message-response": {
    label: "WhatsApp — Form response",
    body: { from: TEST_PHONE, formResponse: { name: TEST_NAME, phone: TEST_PHONE } },
    webhookCapable: false,
    notes: ["Triggered by inbound WhatsApp flow/form replies."],
    templateHints: ["{{trigger.from}}"],
  },
  "on-first-message": {
    label: "WhatsApp — First message",
    body: { from: TEST_PHONE, text: "Hi" },
    webhookCapable: false,
    notes: ["Fires on first inbound message from a contact."],
    templateHints: ["{{trigger.from}}", "{{trigger.text}}"],
  },
  "new-contact": {
    label: "Contact — New contact",
    body: { name: TEST_NAME, phone: TEST_PHONE, email: TEST_EMAIL },
    webhookCapable: false,
    notes: ["Internal CRM trigger — create a contact in the panel to fire."],
    templateHints: ["{{trigger.phone}}", "{{trigger.name}}", "{{trigger.email}}"],
  },
  "contact-updated": {
    label: "Contact — Contact updated",
    body: { name: TEST_NAME, phone: TEST_PHONE, email: TEST_EMAIL },
    webhookCapable: false,
    notes: ["Internal CRM trigger — update a contact in the panel to fire."],
    templateHints: ["{{trigger.phone}}", "{{trigger.name}}"],
  },
  "new-spreadsheet-rows": {
    label: "Google Sheets — New spreadsheet rows",
    body: { row: { phone: TEST_PHONE, name: TEST_NAME, email: TEST_EMAIL } },
    webhookCapable: false,
    notes: ["Polled trigger — add a new row after publishing; not via Postman."],
    templateHints: ["{{trigger.phone}}", "{{trigger.name}}", "{{trigger.email}}"],
  },
  "new-spreadsheets": {
    label: "Google Sheets — New spreadsheets",
    body: { spreadsheetId: "test", title: "Test Sheet" },
    webhookCapable: false,
    notes: ["Polled / Google push — not via flow webhook URL."],
    templateHints: ["{{trigger.title}}"],
  },
  "new-worksheets": {
    label: "Google Sheets — New worksheets",
    body: { worksheetId: "0", title: "Sheet1" },
    webhookCapable: false,
    notes: ["Polled / Google push — not via flow webhook URL."],
    templateHints: ["{{trigger.title}}"],
  },
  "new-event": {
    label: "Google Calendar — New event",
    body: { summary: "Test Event", start: { dateTime: new Date().toISOString() } },
    webhookCapable: false,
    notes: ["Calendar sync — not via flow webhook URL."],
    templateHints: ["{{trigger.summary}}"],
  },
  "new-calendar": {
    label: "Google Calendar — New calendar",
    body: { id: "cal_test", summary: "Test Calendar" },
    webhookCapable: false,
    notes: ["Calendar sync — not via flow webhook URL."],
    templateHints: ["{{trigger.summary}}"],
  },
  "every-n-minutes": {
    label: "Scheduler — Every N minutes",
    body: { firedAt: new Date().toISOString() },
    webhookCapable: false,
    notes: ["Scheduler runs automatically; use Catch raw webhook to Postman-test actions."],
    templateHints: ["{{trigger.firedAt}}"],
  },
  "every-hour": {
    label: "Scheduler — Every hour",
    body: { firedAt: new Date().toISOString() },
    webhookCapable: false,
    notes: ["Scheduler runs automatically."],
    templateHints: ["{{trigger.firedAt}}"],
  },
  "every-day": {
    label: "Scheduler — Every day",
    body: { firedAt: new Date().toISOString() },
    webhookCapable: false,
    notes: ["Scheduler runs automatically."],
    templateHints: ["{{trigger.firedAt}}"],
  },
  "every-week": {
    label: "Scheduler — Every week",
    body: { firedAt: new Date().toISOString() },
    webhookCapable: false,
    notes: ["Scheduler runs automatically."],
    templateHints: ["{{trigger.firedAt}}"],
  },
  "every-month": {
    label: "Scheduler — Every month",
    body: { firedAt: new Date().toISOString() },
    webhookCapable: false,
    notes: ["Scheduler runs automatically."],
    templateHints: ["{{trigger.firedAt}}"],
  },
};

const DEFAULT_SPEC: Spec = {
  label: "Generic webhook",
  headers: { "Content-Type": "application/json", "X-Canvas-Trigger": "catch-raw-webhook" },
  body: {
    name: "Test User",
    mobile: TEST_PHONE,
    email: TEST_EMAIL,
  },
  notes: ["Unknown trigger — generic JSON sample. Prefer Catch raw webhook for arbitrary payloads."],
  templateHints: ["{{trigger.name}}", "{{trigger.mobile}}", "{{raw}}"],
  webhookCapable: true,
};

export function listWebhookTestTriggerIds(): string[] {
  return Object.keys(SPECS);
}

export function getFlowWebhookTestSpec(triggerId: string): Spec {
  return SPECS[triggerId] || { ...DEFAULT_SPEC, headers: { ...(DEFAULT_SPEC.headers || {}), "X-Canvas-Trigger": triggerId || "catch-raw-webhook" } };
}

export function buildFlowWebhookTestPayload(opts: {
  flowId: string;
  triggerId: string;
  baseUrl?: string;
}): FlowWebhookTestPayload & { url: string; curl: string; postman: Record<string, unknown> } {
  const triggerId = String(opts.triggerId || "").trim() || "catch-raw-webhook";
  const spec = getFlowWebhookTestSpec(triggerId);
  const webhookCapable = spec.webhookCapable !== false;
  const path = `/api/v2/webhook/flows/${opts.flowId}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(spec.headers || {}),
  };
  // Ensure trigger resolution even if topic headers are stripped in some clients
  if (webhookCapable && !headers["X-Canvas-Trigger"] && !headers["X-Shopify-Topic"] && !headers["X-WC-Webhook-Topic"]) {
    headers["X-Canvas-Trigger"] = triggerId;
  }

  const base = (opts.baseUrl || "").replace(/\/+$/, "");
  const qs = spec.query
    ? "?" +
      Object.entries(spec.query)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join("&")
    : "";
  const url = `${base}${path}${qs}`;

  const bodyJson = JSON.stringify(spec.body, null, 2);
  const headerFlags = Object.entries(headers)
    .map(([k, v]) => `-H "${k}: ${v}"`)
    .join(" \\\n  ");
  const curl = webhookCapable
    ? `curl -X POST "${url || path}" \\\n  ${headerFlags} \\\n  -d '${JSON.stringify(spec.body)}'`
    : `# Trigger "${triggerId}" cannot be fired via the flow webhook URL.\n# ${ (spec.notes || []).join(" ") }`;

  const postman = {
    info: {
      name: `${spec.label} — flow ${opts.flowId}`,
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    item: webhookCapable
      ? [
          {
            name: spec.label,
            request: {
              method: "POST",
              header: Object.entries(headers).map(([key, value]) => ({ key, value })),
              body: {
                mode: "raw",
                raw: bodyJson,
                options: { raw: { language: "json" } },
              },
              url: url || `{{baseUrl}}${path}${qs}`,
            },
          },
        ]
      : [],
  };

  return {
    triggerId,
    label: spec.label,
    method: "POST",
    path,
    headers,
    body: spec.body,
    query: spec.query,
    notes: [
      ...(spec.notes || []),
      webhookCapable
        ? "In Postman: POST to the URL, set Headers as shown, Body = raw JSON."
        : "This trigger type is not Postman-testable via the flow webhook URL.",
    ],
    templateHints: spec.templateHints || [],
    webhookCapable,
    url: url || path,
    curl,
    postman,
  };
}

export function resolveFlowTriggerIdFromNodes(
  nodes: Array<{ type?: string; data?: { selectedTrigger?: string } }> | null | undefined,
  preferredNodeId?: string
): string | null {
  const list = nodes || [];
  if (preferredNodeId) {
    const n = list.find((x) => (x as { id?: string }).id === preferredNodeId);
    if (n?.type === "trigger" && n.data?.selectedTrigger) return String(n.data.selectedTrigger);
  }
  const first = list.find((n) => n.type === "trigger" && n.data?.selectedTrigger);
  return first?.data?.selectedTrigger ? String(first.data.selectedTrigger) : null;
}
