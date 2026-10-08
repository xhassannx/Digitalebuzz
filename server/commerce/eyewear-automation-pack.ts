/** Generic Shopify → WhatsApp automation pack (any store / brand). */

export const SHOPIFY_SETUP_PREFIX = "[Shopify]";

export type ShopifySetupBrand = {
  brandName: string;
  storeUrl?: string;
};

export const SHOPIFY_TEMPLATE_NAMES = {
  orderConfirmed: "order_confirmed_shopify",
  cartRecovery: "cart_recovery_shopify",
  orderShipped: "order_shipped_shopify",
  outForDelivery: "order_out_for_delivery_shopify",
  orderDelivered: "order_delivered_shopify",
  codConfirm: "cod_confirm_shopify",
  reviewRequest: "review_request_shopify",
} as const;

export type ShopifyTemplateDef = {
  name: string;
  category: "UTILITY" | "MARKETING";
  bodyText: string;
  footerText?: string;
  samples: string[];
};

export function normalizeBrandName(raw?: string | null): string {
  const s = String(raw || "").trim();
  return s || "Our Store";
}

export function normalizeStoreUrl(raw?: string | null): string {
  let s = String(raw || "").trim();
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  return s.replace(/\/+$/, "");
}

export function shopifyAssistantName(brand: string): string {
  return `${brand} Support`;
}

export function shopifySupportChatbotName(brand: string): string {
  return `${brand} — Support Bot`;
}

export function shopifyCodChatbotName(brand: string): string {
  return `${brand} — COD Confirm`;
}

export function buildShopifyWhatsAppTemplates(brandName: string): ShopifyTemplateDef[] {
  const brand = normalizeBrandName(brandName);
  const T = SHOPIFY_TEMPLATE_NAMES;
  return [
    {
      name: T.orderConfirmed,
      category: "UTILITY",
      bodyText: `Hi {{1}}, thank you for your order at ${brand}! Order #{{2}} is confirmed. Total: {{3}}. We will notify you when it ships.`,
      samples: ["Rahul", "1042", "₹1,999"],
    },
    {
      name: T.cartRecovery,
      category: "MARKETING",
      bodyText: `Hi {{1}}, you left items in your cart at ${brand}. Total: {{2}}. Complete your order when you are ready!`,
      samples: ["Rahul", "₹1,999"],
    },
    {
      name: T.orderShipped,
      category: "UTILITY",
      bodyText: `Hi {{1}}, great news! Your ${brand} order #{{2}} has been shipped. Track updates here on WhatsApp.`,
      samples: ["Rahul", "1042"],
    },
    {
      name: T.outForDelivery,
      category: "UTILITY",
      bodyText: `Hi {{1}}, your ${brand} order #{{2}} is out for delivery today.`,
      samples: ["Rahul", "1042"],
    },
    {
      name: T.orderDelivered,
      category: "UTILITY",
      bodyText: `Hi {{1}}, your ${brand} order #{{2}} has been delivered. We hope you love it!`,
      samples: ["Rahul", "1042"],
    },
    {
      name: T.codConfirm,
      category: "UTILITY",
      bodyText: `Hi {{1}}, you placed a COD order #{{2}} at ${brand}. Reply YES to confirm. We dispatch after confirmation.`,
      samples: ["Rahul", "1042"],
    },
    {
      name: T.reviewRequest,
      category: "MARKETING",
      bodyText: `Hi {{1}}, hope you are enjoying your purchase from ${brand}! Would you share a quick review? It helps other customers.`,
      samples: ["Rahul"],
    },
  ];
}

export function buildShopifySupportKnowledgeBase(opts: ShopifySetupBrand): string {
  const brand = normalizeBrandName(opts.brandName);
  const storeUrl = normalizeStoreUrl(opts.storeUrl);
  const siteLine = storeUrl ? `Website: ${storeUrl}` : "Website: (add your store URL in AI Assistant knowledge base)";

  return `# ${brand} — Customer Support Knowledge Base

## About ${brand}
${brand} is an online store. Customers shop products and receive order updates on WhatsApp.
${siteLine}

## Orders
- After checkout, customers receive an order confirmation on WhatsApp.
- COD orders may ask the customer to reply YES before dispatch.
- Shipping updates are sent when the order is fulfilled / shipped.

## Delivery
- Delivery timelines vary by pincode and courier.
- Typical metro delivery is 3–7 business days after dispatch.
- Customers can ask for status with their order number.

## Returns & exchange
- Share the store return / exchange policy with customers.
${storeUrl ? `- Policy pages are usually linked from the website footer at ${storeUrl}.` : "- Add your Returns / Refund / Shipping policy text here."}
- Ask for order number and reason when a customer requests a return.

## Common questions
- **Where is my order?** — Ask for order ID / phone used at checkout; check Shopify Admin.
- **Delivery time?** — Depends on pincode; share SLA if known.
- **Return policy?** — Follow store policy; unused items in original packaging when applicable.
- **COD?** — Confirm by replying YES when asked; then dispatch.

## Contact
- ${siteLine}
- Support via this WhatsApp chat during business hours.

## Agent instructions
- Be concise, friendly, and accurate.
- If you do not know something, ask the customer for order ID or offer human handoff.
- Do not invent tracking numbers or refund amounts.
`;
}

type FlowNode = {
  id: string;
  type: string;
  position: { x: number; y: number };
  width: number;
  height: number;
  data: Record<string, unknown>;
};

type FlowEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
};

export type ShopifyFlowDef = {
  name: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  notes?: string;
};

function trigger(app: string, triggerId: string, triggerType: string, y = 100): FlowNode {
  return {
    id: "trigger-1",
    type: "trigger",
    position: { x: 400, y },
    width: 280,
    height: 120,
    data: { selectedApp: app, appIcon: null, selectedTrigger: triggerId, triggerType },
  };
}

function templateAction(
  id: string,
  y: number,
  sessionId: string,
  templateName: string,
  message: string,
  templateParams: string[]
): FlowNode {
  return {
    id,
    type: "action",
    position: { x: 400, y },
    width: 280,
    height: 120,
    data: {
      selectedAction: "Send Template",
      actionIcon: "/icons/whatsapp.svg",
      selectedActionId: "send-template",
      config: {
        connectionId: sessionId,
        templateId: templateName,
        templateLanguage: "en",
        templateTo: "{{trigger.phone}}",
        templateParams,
        message,
      },
    },
  };
}

function delayAction(id: string, y: number, value: number, unit: "minutes" | "hours" | "days"): FlowNode {
  return {
    id,
    type: "action",
    position: { x: 400, y },
    width: 280,
    height: 120,
    data: {
      selectedAction: "Delay for",
      selectedActionId: "delay-for",
      config: {
        delayForUnit: unit,
        delayForValue: value,
        days: unit === "days" ? value : 0,
        hours: unit === "hours" ? value : 0,
        minutes: unit === "minutes" ? value : 0,
        seconds: 0,
      },
    },
  };
}

function routerNode(id: string, y: number, condition: string): FlowNode {
  return {
    id,
    type: "router",
    position: { x: 400, y },
    width: 280,
    height: 120,
    data: {
      selectedAction: "Router",
      routerIcon: "/icons/router.svg",
      selectedActionId: "router",
      config: { branch1Condition: condition },
    },
  };
}

/** @deprecated Use buildShopifyAutomationFlows — Intense Focus pack removed */
export const buildEyewearAutomationFlows = (sessionId: string) =>
  buildShopifyAutomationFlows(sessionId);

export function buildShopifyAutomationFlows(sessionId: string): ShopifyFlowDef[] {
  const T = SHOPIFY_TEMPLATE_NAMES;
  const p = SHOPIFY_SETUP_PREFIX;

  return [
    {
      name: `${p} Abandoned cart recovery`,
      notes: "1 hour delay before reminder. Publish after cart_recovery_shopify is APPROVED.",
      nodes: [
        trigger("shopify", "new-abandoned-checkout", "New Abandoned Checkout"),
        delayAction("delay-1", 280, 1, "hours"),
        templateAction(
          "action-1",
          460,
          sessionId,
          T.cartRecovery,
          "Hi {{trigger.name}}, you left items in your cart ({{trigger.total_price}}).",
          ["{{trigger.name}}", "{{trigger.total_price}}"]
        ),
      ],
      edges: [
        { id: "e1-d", source: "trigger-1", target: "delay-1" },
        { id: "e-d-a", source: "delay-1", target: "action-1" },
      ],
    },
    {
      name: `${p} Order confirmation`,
      nodes: [
        trigger("shopify", "new-order", "New Order"),
        templateAction(
          "action-1",
          280,
          sessionId,
          T.orderConfirmed,
          "Thanks {{trigger.name}}! Order {{trigger.order_id}} confirmed.",
          ["{{trigger.name}}", "{{trigger.order_id}}", "{{trigger.total_price}}"]
        ),
      ],
      edges: [{ id: "e1-a", source: "trigger-1", target: "action-1" }],
    },
    {
      name: `${p} COD order confirmation`,
      notes: "Only sends for pending/COD financial_status. Pair with COD Confirm chatbot for YES replies.",
      nodes: [
        trigger("shopify", "new-order", "New Order"),
        routerNode("router-1", 280, "{{trigger.financial_status}} === 'pending'"),
        templateAction(
          "action-1",
          460,
          sessionId,
          T.codConfirm,
          "COD order {{trigger.order_id}} — reply YES to confirm.",
          ["{{trigger.name}}", "{{trigger.order_id}}"]
        ),
      ],
      edges: [
        { id: "e1-r", source: "trigger-1", target: "router-1" },
        { id: "er-a", source: "router-1", target: "action-1", sourceHandle: "branch-1", targetHandle: "target" },
      ],
    },
    {
      name: `${p} Shipping — order shipped`,
      notes:
        "Add Shopify webhook Order update → flow webhook URL (returned after setup). Router checks fulfillment_status.",
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          position: { x: 400, y: 100 },
          width: 280,
          height: 120,
          data: {
            selectedApp: "webhook",
            appIcon: null,
            selectedTrigger: "catch-raw-webhook",
            triggerType: "Catch raw webhook",
          },
        },
        routerNode("router-1", 280, "{{raw.fulfillment_status}} === 'fulfilled'"),
        templateAction(
          "action-1",
          460,
          sessionId,
          T.orderShipped,
          "Order {{raw.id}} shipped.",
          ["{{raw.customer.first_name}}", "{{raw.id}}"]
        ),
      ],
      edges: [
        { id: "e1-r", source: "trigger-1", target: "router-1" },
        { id: "er-a", source: "router-1", target: "action-1", sourceHandle: "branch-1", targetHandle: "target" },
      ],
    },
    {
      name: `${p} Review request (3 days after delivery)`,
      notes: "Uses Order update webhook URL from this flow (or duplicate webhook in Shopify).",
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          position: { x: 400, y: 100 },
          width: 280,
          height: 120,
          data: {
            selectedApp: "webhook",
            appIcon: null,
            selectedTrigger: "catch-raw-webhook",
            triggerType: "Catch raw webhook",
          },
        },
        routerNode("router-1", 280, "{{raw.fulfillment_status}} === 'fulfilled'"),
        delayAction("delay-1", 460, 3, "days"),
        templateAction(
          "action-1",
          640,
          sessionId,
          T.reviewRequest,
          "Hope you love your purchase!",
          ["{{raw.customer.first_name}}"]
        ),
      ],
      edges: [
        { id: "e1-r", source: "trigger-1", target: "router-1" },
        { id: "er-d", source: "router-1", target: "delay-1", sourceHandle: "branch-1", targetHandle: "target" },
        { id: "ed-a", source: "delay-1", target: "action-1" },
      ],
    },
  ];
}

// Back-compat aliases for older imports
export const EYEWEAR_SETUP_PREFIX = SHOPIFY_SETUP_PREFIX;
export const EYEWEAR_TEMPLATE_NAMES = SHOPIFY_TEMPLATE_NAMES;
export type EyewearTemplateDef = ShopifyTemplateDef;
export type EyewearFlowDef = ShopifyFlowDef;
