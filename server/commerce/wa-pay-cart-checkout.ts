import { storage } from "../storage";
import { sendWhatsAppNativePaymentMessage } from "./whatsapp-native-payment";
import type { WhatsAppOrderItem, WhatsAppOrderPayload } from "./cart-checkout";
import {
  createWaPayOrder,
  normalizeWaPayReferenceId,
  type WaPayLineItem,
} from "./wa-pay-order-store";
import { ensureOfficialSessionReadyForSend } from "./session-credentials";

export type WaPayOrderType = "physical-goods" | "digital-goods";

function normalizeCustomerWaId(waId: string): string {
  return waId.replace(/@c\.us|@s\.whatsapp\.net/gi, "").replace(/\D/g, "");
}

/** Meta cart webhook item_price is in major currency units (e.g. 1299 = ₹1,299). */
function itemPriceToMinor(item: WhatsAppOrderItem): number {
  const raw = Number(item.item_price);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.round(raw * 100);
}

function buildNativePayItems(items: WhatsAppOrderItem[]): Array<{
  name: string;
  amountMinor: number;
  quantity: number;
  retailerId: string;
}> {
  const lines: Array<{ name: string; amountMinor: number; quantity: number; retailerId: string }> = [];

  for (const item of items) {
    const retailerId = String(item.product_retailer_id || "").trim();
    if (!retailerId) continue;
    const qty = Math.max(1, Math.min(99, Number(item.quantity) || 1));
    const amountMinor = itemPriceToMinor(item);
    if (amountMinor < 1) {
      throw new Error(
        `Missing price for catalog item "${retailerId}". Ensure products in Meta catalog include price.`
      );
    }
    const label = retailerId.replace(/[-_]/g, " ").slice(0, 60);
    lines.push({
      name: label || "Product",
      amountMinor,
      quantity: qty,
      retailerId,
    });
  }

  if (!lines.length) {
    throw new Error("No valid line items for WA Pay checkout");
  }
  return lines;
}

function resolveOrderType(raw: string | null | undefined): WaPayOrderType {
  return raw === "digital-goods" ? "digital-goods" : "physical-goods";
}

/**
 * When WA Pay catalog checkout is enabled, reply to a catalog cart with
 * interactive order_details (review_and_pay) instead of an external store link.
 */
export async function processWhatsAppCartWaPay(opts: {
  organizationId: string;
  sessionId: string;
  customerWaId: string;
  order: WhatsAppOrderPayload;
}): Promise<{ replied: boolean; messageId?: string }> {
  const items = (opts.order.product_items || []).filter((i) =>
    String(i.product_retailer_id || "").trim()
  );
  if (!items.length) return { replied: false };

  const settings = await storage.getOrganizationCommerceSettings(opts.organizationId);
  if (!settings?.waPayCatalogCheckoutEnabled) {
    return { replied: false };
  }

  const configName = settings.metaPaymentConfigurationName?.trim();
  if (!configName) {
    throw new Error("Set Meta payment configuration name on the WA Pay page");
  }

  if (!settings.metaCatalogId) {
    throw new Error("Meta catalog not configured — set up catalog in Commerce first");
  }

  const session = await storage.getSession(opts.sessionId);
  if (!session) {
    throw new Error("WhatsApp session not found");
  }
  await ensureOfficialSessionReadyForSend(
    opts.sessionId,
    session.userId,
    opts.organizationId
  );

  const currency = String(items.find((i) => i.currency)?.currency || "INR").toUpperCase();
  const nativeItems = buildNativePayItems(items);
  const referenceId = normalizeWaPayReferenceId(
    `wc${Date.now().toString(36)}${normalizeCustomerWaId(opts.customerWaId).slice(-4)}`
  );
  const intro = opts.order.text?.trim() || "Review your order and pay securely in WhatsApp.";
  const orderType = resolveOrderType(settings.waPayOrderType);
  const amountMinor = nativeItems.reduce(
    (sum, i) => sum + i.amountMinor * i.quantity,
    0
  );
  const lineItems: WaPayLineItem[] = nativeItems.map((i) => ({
    retailerId: i.retailerId,
    name: i.name,
    amountMinor: i.amountMinor,
    quantity: i.quantity,
  }));

  try {
    const result = await sendWhatsAppNativePaymentMessage({
      sessionId: opts.sessionId,
      to: opts.customerWaId,
      referenceId,
      bodyText: intro,
      currency,
      items: nativeItems,
      paymentConfigurationName: configName,
      paymentGateway: settings.metaPaymentGateway === "payu" ? "payu" : "razorpay",
      orderType,
      catalogId: opts.order.catalog_id || settings.metaCatalogId,
    });

    await createWaPayOrder({
      organizationId: opts.organizationId,
      sessionId: opts.sessionId,
      customerWaId: opts.customerWaId.replace(/@c\.us|@s\.whatsapp\.net/gi, ""),
      referenceId,
      paymentConfigurationName: configName,
      paymentGateway: settings.metaPaymentGateway === "payu" ? "payu" : "razorpay",
      orderType,
      catalogId: opts.order.catalog_id || settings.metaCatalogId || undefined,
      amountMinor,
      currency,
      paymentStatus: "pending",
      orderStatus: "pending",
      orderDetailsMessageId: result.messageId,
      lineItems,
    });

    await storage.upsertOrganizationCommerceSettings(opts.organizationId, {
      lastWaPayCheckoutAt: new Date(),
      lastWaPayCheckoutStatus: "success",
      lastWaPayCheckoutError: null,
      whatsappNativePayEnabled: true,
    });

    console.log(
      `[WA Pay] review_and_pay sent for cart → ${opts.customerWaId.slice(0, 12)}… ref=${referenceId}`
    );

    return { replied: true, messageId: result.messageId };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "WA Pay cart checkout failed";
    console.warn("[WA Pay] Cart checkout error:", msg);
    await storage.upsertOrganizationCommerceSettings(opts.organizationId, {
      lastWaPayCheckoutAt: new Date(),
      lastWaPayCheckoutStatus: "error",
      lastWaPayCheckoutError: msg,
    });
    throw e instanceof Error ? e : new Error(msg);
  }
}
