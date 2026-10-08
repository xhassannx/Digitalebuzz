import { storage } from "../storage";
import { normalizeShopifyDomain } from "./shopify-catalog-sync";
import { businessAPIManager } from "../whatsapp/business-api-client";
import { processWhatsAppCartWaPay } from "./wa-pay-cart-checkout";

export type WhatsAppOrderItem = {
  product_retailer_id: string;
  quantity: number;
  item_price?: number;
  currency?: string;
};

export type WhatsAppOrderPayload = {
  catalog_id?: string;
  text?: string;
  product_items: WhatsAppOrderItem[];
};

function normalizeCustomerPhone(waId: string): string {
  const digits = waId.replace(/@c\.us|@g\.us/gi, "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("+") ? digits : `+${digits}`;
}

function isNumericId(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

async function getConnectedOrgIntegration(organizationId: string, name: string) {
  const integrations = await storage.getIntegrationsByOrganization(organizationId);
  return integrations.find((i) => i.name === name && i.status === "connected");
}

async function createShopifyDraftCheckoutUrl(
  organizationId: string,
  items: WhatsAppOrderItem[],
  customerPhone: string
): Promise<string> {
  const integration = await getConnectedOrgIntegration(organizationId, "shopify");
  if (!integration?.credentials) {
    throw new Error("Shopify not connected");
  }
  const creds = integration.credentials as Record<string, string>;
  const shopDomain = normalizeShopifyDomain(
    (integration.config as Record<string, string>)?.shop_domain || creds.shop_domain || ""
  );
  const token = creds.access_token;
  if (!shopDomain || !token) {
    throw new Error("Shopify credentials incomplete");
  }

  const line_items = items.map((item) => {
    const id = String(item.product_retailer_id || "").trim();
    const qty = Math.max(1, Math.min(99, Number(item.quantity) || 1));
    if (isNumericId(id)) {
      return { variant_id: Number(id), quantity: qty };
    }
    return { sku: id, quantity: qty };
  });

  const phone = normalizeCustomerPhone(customerPhone);
  const draftBody: Record<string, unknown> = {
    draft_order: {
      line_items,
      note: "Created from WhatsApp catalog order",
      tags: "whatsapp-cart",
      ...(phone ? { customer: { phone } } : {}),
    },
  };

  const res = await fetch(
    `https://${shopDomain}.myshopify.com/admin/api/2024-01/draft_orders.json`,
    {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(draftBody),
    }
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      typeof data?.errors === "string"
        ? data.errors
        : data?.errors?.base?.[0] || "Shopify draft order failed"
    );
  }

  const url =
    data?.draft_order?.invoice_url ||
    data?.draft_order?.order_status_url ||
    data?.draft_order?.status_page_url;
  if (!url || typeof url !== "string") {
    throw new Error("Shopify did not return a checkout URL for this draft order");
  }
  return url;
}

async function resolveWooProductIdBySku(
  siteUrl: string,
  auth: string,
  skuOrId: string
): Promise<number | null> {
  if (isNumericId(skuOrId)) {
    return Number(skuOrId);
  }
  const res = await fetch(
    `${siteUrl}/wp-json/wc/v3/products?sku=${encodeURIComponent(skuOrId)}&per_page=1`,
    { headers: { Authorization: `Basic ${auth}` } }
  );
  const data = await res.json();
  if (!res.ok || !Array.isArray(data) || !data[0]?.id) {
    return null;
  }
  return Number(data[0].id);
}

async function createWooCheckoutUrl(
  organizationId: string,
  items: WhatsAppOrderItem[],
  customerPhone: string
): Promise<string> {
  const integration = await getConnectedOrgIntegration(organizationId, "woocommerce");
  if (!integration?.credentials) {
    throw new Error("WooCommerce not connected");
  }
  const creds = integration.credentials as Record<string, string>;
  const config = (integration.config || {}) as Record<string, string>;
  let siteUrl = (config.site_url || "").trim();
  if (!siteUrl.startsWith("http")) siteUrl = `https://${siteUrl}`;
  siteUrl = siteUrl.replace(/\/$/, "");

  const consumerKey = creds.consumer_key || creds.consumerKey || "";
  const consumerSecret = creds.consumer_secret || creds.consumerSecret || "";
  if (!siteUrl || !consumerKey || !consumerSecret) {
    throw new Error("WooCommerce credentials incomplete");
  }

  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  const line_items: Array<{ product_id: number; quantity: number }> = [];

  for (const item of items) {
    const retailerId = String(item.product_retailer_id || "").trim();
    if (!retailerId) continue;
    const productId = await resolveWooProductIdBySku(siteUrl, auth, retailerId);
    if (!productId) {
      throw new Error(`WooCommerce product not found for SKU/ID: ${retailerId}`);
    }
    line_items.push({
      product_id: productId,
      quantity: Math.max(1, Math.min(99, Number(item.quantity) || 1)),
    });
  }

  if (!line_items.length) {
    throw new Error("No valid line items for WooCommerce order");
  }

  const phone = normalizeCustomerPhone(customerPhone);
  const orderBody = {
    status: "pending",
    set_paid: false,
    customer_note: "WhatsApp catalog order",
    meta_data: [{ key: "whatsapp_cart", value: "1" }],
    line_items,
    billing: phone ? { phone } : undefined,
  };

  const res = await fetch(`${siteUrl}/wp-json/wc/v3/orders`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(orderBody),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || "WooCommerce order creation failed");
  }

  const payUrl = data.payment_url || data.checkout_payment_url;
  if (typeof payUrl === "string" && payUrl.startsWith("http")) {
    return payUrl;
  }
  if (typeof data.id === "number") {
    return `${siteUrl}/checkout/order-pay/${data.id}/?pay_for_order=true&key=${data.order_key || ""}`;
  }
  throw new Error("WooCommerce did not return a payment URL");
}

function formatOrderSummary(items: WhatsAppOrderItem[]): string {
  return items
    .map(
      (i) =>
        `• ${i.product_retailer_id} × ${Math.max(1, Number(i.quantity) || 1)}`
    )
    .join("\n");
}

/**
 * When a customer submits a WhatsApp catalog cart, create a store checkout link and reply.
 */
export async function processWhatsAppCartOrder(opts: {
  organizationId: string;
  sessionId: string;
  customerWaId: string;
  order: WhatsAppOrderPayload;
}): Promise<{ checkoutUrl?: string; replied: boolean }> {
  const items = (opts.order.product_items || []).filter((i) =>
    String(i.product_retailer_id || "").trim()
  );
  if (!items.length) {
    return { replied: false };
  }

  const settings = await storage.getOrganizationCommerceSettings(opts.organizationId);
  if (!settings?.metaCatalogId) {
    return { replied: false };
  }

  if (settings.waPayCatalogCheckoutEnabled) {
    try {
      const waPay = await processWhatsAppCartWaPay(opts);
      if (waPay.replied) {
        return { replied: true };
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "WA Pay checkout failed";
      console.warn("[Commerce] WA Pay failed, trying store checkout if enabled:", msg);
    }
  }

  let checkoutUrl: string | undefined;
  let store: "shopify" | "woocommerce" | null = null;

  try {
    if (settings.shopifyCheckoutEnabled) {
      const shopify = await getConnectedOrgIntegration(opts.organizationId, "shopify");
      if (shopify) {
        checkoutUrl = await createShopifyDraftCheckoutUrl(
          opts.organizationId,
          items,
          opts.customerWaId
        );
        store = "shopify";
      }
    }

    if (!checkoutUrl && settings.woocommerceCheckoutEnabled) {
      const woo = await getConnectedOrgIntegration(opts.organizationId, "woocommerce");
      if (woo) {
        checkoutUrl = await createWooCheckoutUrl(
          opts.organizationId,
          items,
          opts.customerWaId
        );
        store = "woocommerce";
      }
    }

    if (!checkoutUrl) {
      return { replied: false };
    }

    const intro = opts.order.text?.trim() || "Thanks for your order!";
    const summary = formatOrderSummary(items);
    const replyText = `${intro}\n\n${summary}\n\nComplete your purchase here:\n${checkoutUrl}`;

    if (!businessAPIManager.isClientReady(opts.sessionId)) {
      throw new Error("WhatsApp session not ready to send checkout link");
    }

    await businessAPIManager.sendTextMessage(opts.sessionId, opts.customerWaId, replyText);

    await storage.upsertOrganizationCommerceSettings(opts.organizationId, {
      lastCartCheckoutAt: new Date(),
      lastCartCheckoutStatus: "success",
      lastCartCheckoutError: null,
    });

    console.log(
      `[Commerce] Cart checkout (${store}) sent to ${opts.customerWaId.slice(0, 12)}…`
    );

    return { checkoutUrl, replied: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Cart checkout failed";
    console.warn("[Commerce] Cart checkout error:", msg);
    await storage.upsertOrganizationCommerceSettings(opts.organizationId, {
      lastCartCheckoutAt: new Date(),
      lastCartCheckoutStatus: "error",
      lastCartCheckoutError: msg,
    });
    return { replied: false };
  }
}

export function formatWhatsAppOrderMessageBody(order: WhatsAppOrderPayload): string {
  const items = order.product_items || [];
  if (!items.length) {
    return order.text?.trim() || "[Catalog order]";
  }
  const lines = items.map(
    (i) => `• ${i.product_retailer_id} × ${Math.max(1, Number(i.quantity) || 1)}`
  );
  const header = order.text?.trim() || "Catalog order";
  return `${header}\n${lines.join("\n")}`;
}
