const API_VERSION = "2024-01";

const DEFAULT_TOPICS = [
  "products/create",
  "products/update",
  "products/delete",
  "orders/create",
  "orders/paid",
  "orders/cancelled",
  "checkouts/create",
  "checkouts/update",
  "customers/create",
];

export function canRegisterShopifyWebhooks(panelBaseUrl: string): {
  ok: boolean;
  reason?: string;
} {
  try {
    const u = new URL(panelBaseUrl.replace(/\/$/, ""));
    if (u.protocol !== "https:") {
      return {
        ok: false,
        reason:
          "Shopify webhooks require BASE_URL to be a public HTTPS URL (http://localhost is not accepted by Shopify).",
      };
    }
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
      return {
        ok: false,
        reason: "Shopify cannot deliver webhooks to localhost — set BASE_URL to your public domain.",
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "Invalid BASE_URL for Shopify webhooks." };
  }
}

export async function registerShopifyWebhooksForIntegration(opts: {
  integrationId: string;
  shopDomain: string;
  accessToken: string;
  panelBaseUrl: string;
  topics?: string[];
}): Promise<{ registered: string[]; errors: string[]; skipped?: boolean; skipReason?: string }> {
  const base = opts.panelBaseUrl.replace(/\/$/, "");
  const eligibility = canRegisterShopifyWebhooks(base);
  if (!eligibility.ok) {
    return {
      registered: [],
      errors: [eligibility.reason || "Webhook registration skipped"],
      skipped: true,
      skipReason: eligibility.reason,
    };
  }

  const address = `${base}/api/webhooks/shopify/${opts.integrationId}`;
  const topics = opts.topics || DEFAULT_TOPICS;
  const registered: string[] = [];
  const errors: string[] = [];

  for (const topic of topics) {
    try {
      const res = await fetch(
        `https://${opts.shopDomain}.myshopify.com/admin/api/${API_VERSION}/webhooks.json`,
        {
          method: "POST",
          headers: {
            "X-Shopify-Access-Token": opts.accessToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            webhook: {
              topic,
              address,
              format: "json",
            },
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        const msg =
          typeof data?.errors === "string"
            ? data.errors
            : JSON.stringify(data?.errors || data);
        if (String(msg).toLowerCase().includes("already been taken")) {
          registered.push(topic);
        } else {
          errors.push(`${topic}: ${msg}`);
        }
      } else {
        registered.push(topic);
      }
    } catch (e: unknown) {
      errors.push(`${topic}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { registered, errors };
}

export async function listShopifyRemoteWebhooks(opts: {
  shopDomain: string;
  accessToken: string;
}): Promise<Array<{ id: number; topic: string; address: string }>> {
  const res = await fetch(
    `https://${opts.shopDomain}.myshopify.com/admin/api/${API_VERSION}/webhooks.json`,
    {
      headers: { "X-Shopify-Access-Token": opts.accessToken },
    },
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      typeof data?.errors === "string" ? data.errors : JSON.stringify(data?.errors || data),
    );
  }
  return (data.webhooks || []).map((w: { id: number; topic: string; address: string }) => ({
    id: w.id,
    topic: w.topic,
    address: w.address,
  }));
}
