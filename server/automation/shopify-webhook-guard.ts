/**
 * Prevent duplicate Shopify → automation runs when Shopify retries webhooks
 * (slow 200 responses) or the same delivery is processed twice.
 */

const WEBHOOK_ID_TTL_MS = 24 * 60 * 60 * 1000;
const ORDER_TOPIC_TTL_MS = 10 * 60 * 1000;

const seenWebhookIds = new Map<string, number>();
const seenOrderTopics = new Map<string, number>();

function prune(map: Map<string, number>, ttlMs: number) {
  const now = Date.now();
  if (map.size < 2000) return;
  for (const [k, t] of map) {
    if (now - t > ttlMs) map.delete(k);
  }
}

/** Returns true if this Shopify delivery should run (first time). */
export function shouldProcessShopifyWebhookDelivery(opts: {
  shopifyWebhookId?: string | null;
  organizationId?: string | null;
  integrationId: string;
  topic?: string | null;
  orderId?: string | number | null;
}): boolean {
  const now = Date.now();
  const webhookId = String(opts.shopifyWebhookId || "").trim();
  if (webhookId) {
    prune(seenWebhookIds, WEBHOOK_ID_TTL_MS);
    if (seenWebhookIds.has(webhookId)) {
      console.log(`[Shopify webhook] Duplicate delivery skipped (webhook-id=${webhookId})`);
      return false;
    }
    seenWebhookIds.set(webhookId, now);
  }

  const orderId = opts.orderId != null ? String(opts.orderId).trim() : "";
  const topic = String(opts.topic || "").trim();
  if (orderId && topic) {
    const key = `${opts.organizationId || opts.integrationId}:${topic}:${orderId}`;
    prune(seenOrderTopics, ORDER_TOPIC_TTL_MS);
    const prev = seenOrderTopics.get(key);
    if (prev != null && now - prev < ORDER_TOPIC_TTL_MS) {
      console.log(
        `[Shopify webhook] Duplicate ${topic} for order ${orderId} skipped (${ORDER_TOPIC_TTL_MS}ms window)`
      );
      return false;
    }
    seenOrderTopics.set(key, now);
  }

  return true;
}
