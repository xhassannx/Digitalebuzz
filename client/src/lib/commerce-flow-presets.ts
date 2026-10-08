/** Commerce automation presets — canvas flows (Shopify / WooCommerce → WhatsApp). */
import type { AutomationFlow } from "@/lib/dummy-flows";

export const COMMERCE_FLOW_NAME_PREFIX = "[Commerce]";

function baseTriggerNode(
  appId: string,
  selectedTrigger: string,
  triggerType: string,
  y = 100
) {
  return {
    id: "trigger-1",
    type: "trigger",
    position: { x: 400, y },
    width: 280,
    height: 120,
    data: { selectedApp: appId, appIcon: null, selectedTrigger, triggerType },
  };
}

function sendTemplateAction(y: number, message: string, templateParams: string[] = ["{{trigger.name}}"]) {
  return {
    id: "action-1",
    type: "action",
    position: { x: 400, y },
    width: 280,
    height: 120,
    data: {
      selectedAction: "Send Template",
      actionIcon: "/icons/whatsapp.svg",
      selectedActionId: "send-template",
      config: {
        connectionId: "YOUR_WHATSAPP_SESSION_ID",
        templateId: "YOUR_APPROVED_TEMPLATE_NAME",
        templateLanguage: "en",
        templateTo: "{{trigger.phone}}",
        templateParams,
        message,
      },
    },
  };
}

function sendPaymentLinkAction(y: number, amount = "{{trigger.total_price}}", description = "Order {{trigger.order_id}}") {
  return {
    id: "action-1",
    type: "action",
    position: { x: 400, y },
    width: 280,
    height: 120,
    data: {
      selectedAction: "Send payment link",
      actionIcon: "/icons/whatsapp.svg",
      selectedActionId: "send-payment-link",
      config: {
        connectionId: "YOUR_WHATSAPP_SESSION_ID",
        paymentTo: "{{trigger.phone}}",
        amount,
        currency: "INR",
        description,
      },
    },
  };
}

function sendMessageAction(y: number, text: string) {
  return {
    id: "action-1",
    type: "action",
    position: { x: 400, y },
    width: 280,
    height: 120,
    data: {
      selectedAction: "Send Message",
      actionIcon: "/icons/whatsapp.svg",
      selectedActionId: "send-message",
      config: {
        connectionId: "YOUR_WHATSAPP_SESSION_ID",
        message: text,
        to: "{{trigger.phone}}",
      },
    },
  };
}

export function getCommerceFlowPresets(): Omit<AutomationFlow, "id">[] {
  const now = new Date().toISOString();
  return [
    {
      name: `${COMMERCE_FLOW_NAME_PREFIX} Shopify — new order confirmation`,
      status: "inactive",
      createdAt: now,
      updatedAt: now,
      nodes: [
        baseTriggerNode("shopify", "new-order", "New Order"),
        sendTemplateAction(
          280,
          "Thanks {{trigger.name}}! Order {{trigger.order_id}} is confirmed. Total: {{trigger.total_price}}.",
          ["{{trigger.name}}", "{{trigger.order_id}}", "{{trigger.total_price}}"]
        ),
      ],
      edges: [{ id: "e1-2", source: "trigger-1", target: "action-1" }],
    },
    {
      name: `${COMMERCE_FLOW_NAME_PREFIX} Shopify — order paid (send payment follow-up)`,
      status: "inactive",
      createdAt: now,
      updatedAt: now,
      nodes: [
        baseTriggerNode("shopify", "new-paid-order", "New Paid Order"),
        sendMessageAction(
          280,
          "Hi {{trigger.name}}, we received payment of {{trigger.total_price}} for order {{trigger.order_id}}. Thank you!"
        ),
      ],
      edges: [{ id: "e1-2", source: "trigger-1", target: "action-1" }],
    },
    {
      name: `${COMMERCE_FLOW_NAME_PREFIX} Shopify — abandoned checkout`,
      status: "inactive",
      createdAt: now,
      updatedAt: now,
      nodes: [
        baseTriggerNode("shopify", "new-abandoned-checkout", "New Abandoned Checkout"),
        sendTemplateAction(
          280,
          "Hi {{trigger.name}}, you left items in your cart ({{trigger.total_price}}). Complete checkout when ready.",
          ["{{trigger.name}}", "{{trigger.total_price}}"]
        ),
      ],
      edges: [{ id: "e1-2", source: "trigger-1", target: "action-1" }],
    },
    {
      name: `${COMMERCE_FLOW_NAME_PREFIX} Shopify — order cancelled`,
      status: "inactive",
      createdAt: now,
      updatedAt: now,
      nodes: [
        baseTriggerNode("shopify", "new-cancelled-order", "Order Cancelled"),
        sendTemplateAction(
          280,
          "Hi {{trigger.name}}, order {{trigger.order_id}} was cancelled. Reply if you need help.",
          ["{{trigger.name}}", "{{trigger.order_id}}"]
        ),
      ],
      edges: [{ id: "e1-2", source: "trigger-1", target: "action-1" }],
    },
    {
      name: `${COMMERCE_FLOW_NAME_PREFIX} WooCommerce — order created`,
      status: "inactive",
      createdAt: now,
      updatedAt: now,
      nodes: [
        baseTriggerNode("woocommerce", "order-created", "Order Created"),
        sendTemplateAction(
          280,
          "Thank you {{trigger.name}}! We received order #{{trigger.order_id}} ({{trigger.total}}).",
          ["{{trigger.name}}", "{{trigger.order_id}}", "{{trigger.total}}"]
        ),
      ],
      edges: [{ id: "e1-2", source: "trigger-1", target: "action-1" }],
    },
    {
      name: `${COMMERCE_FLOW_NAME_PREFIX} WooCommerce — order updated`,
      status: "inactive",
      createdAt: now,
      updatedAt: now,
      nodes: [
        baseTriggerNode("woocommerce", "order-updated", "Order Updated"),
        sendTemplateAction(
          280,
          "Hi {{trigger.name}}, your order #{{trigger.order_id}} status is now: {{trigger.status}}.",
          ["{{trigger.name}}", "{{trigger.order_id}}", "{{trigger.status}}"]
        ),
      ],
      edges: [{ id: "e1-2", source: "trigger-1", target: "action-1" }],
    },
    {
      name: `${COMMERCE_FLOW_NAME_PREFIX} Shopify — collect payment (payment link)`,
      status: "inactive",
      createdAt: now,
      updatedAt: now,
      nodes: [
        baseTriggerNode("shopify", "new-order", "New Order"),
        sendPaymentLinkAction(
          280,
          "{{trigger.total_price}}",
          "Payment for order {{trigger.order_id}}"
        ),
      ],
      edges: [{ id: "e1-2", source: "trigger-1", target: "action-1" }],
    },
    {
      name: `${COMMERCE_FLOW_NAME_PREFIX} Razorpay — payment captured`,
      status: "inactive",
      createdAt: now,
      updatedAt: now,
      nodes: [
        baseTriggerNode("razorpay", "payment-captured", "Payment Captured"),
        sendMessageAction(
          280,
          "Payment received ({{trigger.amount}} {{trigger.currency}}). Ref: {{trigger.payment_id}}. Thank you!"
        ),
      ],
      edges: [{ id: "e1-2", source: "trigger-1", target: "action-1" }],
    },
  ];
}

export function getCommerceFlowsToCreate(existingNames: Set<string>) {
  return getCommerceFlowPresets().filter((f) => !existingNames.has(f.name));
}
