import { processWhatsAppCartOrder, type WhatsAppOrderPayload } from "./cart-checkout";

/** Fire-and-forget WA catalog cart → store checkout when enabled. */
export function handleIncomingWhatsAppOrderMessage(opts: {
  organizationId: string | null | undefined;
  sessionId: string;
  customerWaId: string;
  order: unknown;
}): void {
  const organizationId = opts.organizationId?.trim();
  if (!organizationId || !opts.order || typeof opts.order !== "object") return;

  const raw = opts.order as Record<string, unknown>;
  const productItems = Array.isArray(raw.product_items) ? raw.product_items : [];
  if (!productItems.length) return;

  const payload: WhatsAppOrderPayload = {
    catalog_id: raw.catalog_id ? String(raw.catalog_id) : undefined,
    text: raw.text ? String(raw.text) : undefined,
    product_items: productItems.map((row) => {
      const item = row as Record<string, unknown>;
      return {
        product_retailer_id: String(item.product_retailer_id || ""),
        quantity: Number(item.quantity) || 1,
        item_price: item.item_price != null ? Number(item.item_price) : undefined,
        currency: item.currency ? String(item.currency) : undefined,
      };
    }),
  };

  void processWhatsAppCartOrder({
    organizationId,
    sessionId: opts.sessionId,
    customerWaId: opts.customerWaId,
    order: payload,
  }).catch((e) => console.warn("[Commerce] WA cart handler:", e));
}
