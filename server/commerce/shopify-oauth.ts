import crypto from "crypto";
import { storage } from "../storage";
import { registerShopifyWebhooksForIntegration } from "./shopify-webhooks-register";

const API_VERSION = "2024-01";

export function normalizeShopDomain(raw: string): string {
  let s = raw.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "");
  s = s.replace(/\/$/, "");
  if (!s.includes(".")) s = `${s}.myshopify.com`;
  if (!s.endsWith(".myshopify.com")) {
    const base = s.split(".")[0];
    s = `${base}.myshopify.com`;
  }
  return s;
}

/** Alias kept for collection sync imports */
export const normalizeShopifyDomain = normalizeShopDomain;

export function getShopifyOAuthConfig(): {
  apiKey: string;
  apiSecret: string;
  scopes: string;
} | null {
  const apiKey = (process.env.SHOPIFY_API_KEY || process.env.SHOPIFY_CLIENT_ID || "").trim();
  const apiSecret = (process.env.SHOPIFY_API_SECRET || process.env.SHOPIFY_CLIENT_SECRET || "").trim();
  if (!apiKey || !apiSecret) return null;
  const scopes =
    process.env.SHOPIFY_SCOPES ||
    "read_products,write_products,read_orders,read_draft_orders,write_draft_orders,read_customers";
  return { apiKey, apiSecret, scopes };
}

export function buildShopifyOAuthUrl(opts: {
  shop: string;
  redirectUri: string;
  state: string;
}): string {
  const cfg = getShopifyOAuthConfig();
  if (!cfg) throw new Error("Shopify OAuth not configured (SHOPIFY_API_KEY / SHOPIFY_API_SECRET)");
  const shop = normalizeShopDomain(opts.shop);
  const url = new URL(`https://${shop}/admin/oauth/authorize`);
  url.searchParams.set("client_id", cfg.apiKey);
  url.searchParams.set("scope", cfg.scopes);
  url.searchParams.set("redirect_uri", opts.redirectUri);
  url.searchParams.set("state", opts.state);
  return url.toString();
}

export async function exchangeShopifyOAuthCode(
  shop: string,
  code: string
): Promise<{ access_token: string; scope: string }> {
  const cfg = getShopifyOAuthConfig();
  if (!cfg) throw new Error("Shopify OAuth not configured");
  const shopHost = normalizeShopDomain(shop);
  const res = await fetch(`https://${shopHost}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: cfg.apiKey,
      client_secret: cfg.apiSecret,
      code,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Shopify token exchange failed");
  }
  return { access_token: data.access_token, scope: data.scope || cfg.scopes };
}

export async function completeShopifyOAuthConnection(opts: {
  userId: string;
  organizationId?: string;
  shop: string;
  accessToken: string;
  connectionName?: string;
  panelBaseUrl: string;
}): Promise<{
  integrationId: string;
  shopDomain: string;
  shopName: string;
  webhooks: { registered: string[]; errors: string[]; skipped?: boolean; skipReason?: string };
}> {
  const shopDomain = normalizeShopDomain(opts.shop).replace(/\.myshopify\.com$/, "");
  const shopRes = await fetch(`https://${shopDomain}.myshopify.com/admin/api/${API_VERSION}/shop.json`, {
    headers: { "X-Shopify-Access-Token": opts.accessToken },
  });
  const shopData = await shopRes.json();
  const shopName = shopData?.shop?.name || shopDomain;

  const orgIntegrations = opts.organizationId
    ? await storage.getIntegrationsByOrganization(opts.organizationId)
    : [];
  let existing = orgIntegrations.find((i) => i.name === "shopify" && i.status === "connected");
  if (!existing && !opts.organizationId) {
    const userIntegrations = await storage.getIntegrationsByUser(opts.userId);
    existing = userIntegrations.find((i) => i.name === "shopify" && i.status === "connected");
  }

  let integrationId: string;
  if (existing) {
    await storage.updateIntegration(existing.id, opts.userId, {
      status: "connected",
      credentials: {
        access_token: opts.accessToken,
        shop_domain: shopDomain,
      },
      config: {
        ...(existing.config as object),
        shop_domain: shopDomain,
        shop_name: shopName,
        connectionName: opts.connectionName || "shopify",
        oauth: true,
      },
    });
    integrationId = existing.id;
  } else {
    const created = await storage.createIntegration({
      userId: opts.userId,
      organizationId: opts.organizationId || undefined,
      name: "shopify",
      displayName: "Shopify",
      category: "flow",
      authType: "oauth",
      status: "connected",
      credentials: {
        access_token: opts.accessToken,
        shop_domain: shopDomain,
      },
      config: {
        shop_domain: shopDomain,
        shop_name: shopName,
        connectionName: opts.connectionName || "shopify",
        oauth: true,
      },
    });
    integrationId = created.id;
  }

  const webhooks = await registerShopifyWebhooksForIntegration({
    integrationId,
    shopDomain,
    accessToken: opts.accessToken,
    panelBaseUrl: opts.panelBaseUrl,
  });

  const webhookMeta = {
    webhooksRegistered: webhooks.registered,
    webhooksErrors: webhooks.errors,
    webhooksRegisteredAt: new Date().toISOString(),
    webhooksSkipped: webhooks.skipped || false,
    webhooksSkipReason: webhooks.skipReason || null,
  };

  const baseConfig = {
    ...(existing?.config as object),
    shop_domain: shopDomain,
    shop_name: shopName,
    connectionName: opts.connectionName || "shopify",
    oauth: true,
  };

  await storage.updateIntegration(integrationId, opts.userId, {
    config: {
      ...baseConfig,
      ...webhookMeta,
    },
  });

  if (webhooks.errors.length > 0) {
    console.warn(
      `[Shopify OAuth] Webhook registration partial failure for ${shopDomain}:`,
      webhooks.errors.join("; "),
    );
  } else {
    console.log(
      `[Shopify OAuth] Registered ${webhooks.registered.length} webhooks for ${shopDomain}`,
    );
  }

  return { integrationId, shopDomain, shopName, webhooks };
}

export function createShopifyOAuthState(): string {
  return crypto.randomBytes(24).toString("hex");
}
