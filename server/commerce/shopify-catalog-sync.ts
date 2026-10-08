import { storage } from "../storage";
import { fetchMetaCatalogProducts, verifyMetaCatalogAccess } from "./meta-graph";
import { pushMetaCatalogBatch, type MetaCatalogBatchRequest } from "./catalog-sync-batch";
import {
  formatMetaCatalogPrice,
  parseShopifyPriceMajor,
  pickShopifyProductImage,
} from "./meta-catalog-product-fields";
import {
  probeMetaCatalogWriteAccess,
  resolveCatalogWriteAccessToken,
} from "./catalog-access-token";

export function normalizeShopifyDomain(raw: string): string {
  let s = raw.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "");
  s = s.replace(/\/$/, "");
  s = s.replace(/\.myshopify\.com$/, "");
  return s;
}

type ShopifyProduct = {
  id: number;
  title: string;
  body_html?: string;
  status?: string;
  variants?: Array<{
    id: number;
    price?: string;
    sku?: string;
  }>;
  image?: { src?: string };
  images?: Array<{ src?: string }>;
  handle?: string;
};

async function getConnectedOrgIntegration(organizationId: string, name: string) {
  const integrations = await storage.getIntegrationsByOrganization(organizationId);
  return integrations.find((i) => i.name === name && i.status === "connected");
}

function getShopifyIntegrationContext(organizationId: string) {
  return getConnectedOrgIntegration(organizationId, "shopify").then((integration) => {
    if (!integration?.credentials) {
      throw new Error("Shopify integration not connected");
    }
    const creds = integration.credentials as Record<string, string>;
    const config = (integration.config || {}) as Record<string, string>;
    const shopDomain = normalizeShopifyDomain(config.shop_domain || creds.shop_domain || "");
    const accessTokenShop = creds.access_token;
    if (!shopDomain || !accessTokenShop) {
      throw new Error("Shopify shop domain or access token missing");
    }
    return {
      shopDomain,
      accessTokenShop,
      shopName: config.shop_name || shopDomain,
    };
  });
}

export async function fetchShopifyActiveProducts(
  organizationId: string,
  limit = 500
): Promise<{
  shopDomain: string;
  shopName: string;
  products: ShopifyProduct[];
}> {
  const { shopDomain, accessTokenShop, shopName } = await getShopifyIntegrationContext(
    organizationId
  );
  const max = Math.min(Math.max(limit, 1), 500);
  const shopRes = await fetch(
    `https://${shopDomain}.myshopify.com/admin/api/2024-01/products.json?limit=${max}&status=active`,
    { headers: { "X-Shopify-Access-Token": accessTokenShop } }
  );
  const shopData = await shopRes.json();
  if (!shopRes.ok) {
    throw new Error(shopData?.errors || "Failed to fetch Shopify products");
  }
  return {
    shopDomain,
    shopName,
    products: (shopData.products || []) as ShopifyProduct[],
  };
}

function shopifyProductToMetaRequest(
  p: ShopifyProduct,
  shopDomain: string,
  brand = "Infamous"
): MetaCatalogBatchRequest | null {
  if (p.status && p.status !== "active") {
    return null;
  }
  const variant = p.variants?.[0];
  const retailerId = String(variant?.sku || variant?.id || p.id);
  const image = pickShopifyProductImage(p);
  const priceMajor = parseShopifyPriceMajor(variant?.price);
  const link = p.handle
    ? `https://${shopDomain}.myshopify.com/products/${p.handle}`
    : `https://${shopDomain}.myshopify.com`;

  return {
    method: "UPDATE",
    data: {
      id: retailerId,
      title: p.title?.slice(0, 200) || retailerId,
      description: (p.body_html || "").replace(/<[^>]+>/g, "").slice(0, 5000) || p.title,
      availability: "in stock",
      condition: "new",
      price: formatMetaCatalogPrice(priceMajor),
      image_link: image,
      link,
      brand: brand.slice(0, 100),
      origin_country: "IN",
      wa_compliance_category: "DEFAULT",
    },
  };
}

export async function deleteMetaCatalogProduct(
  catalogId: string,
  accessToken: string,
  retailerId: string
): Promise<void> {
  await pushMetaCatalogBatch(catalogId, accessToken, [
    { method: "DELETE", data: { id: retailerId } },
  ]);
}

export async function syncShopifyProductPayloadToMeta(opts: {
  organizationId: string;
  catalogId: string;
  accessToken: string;
  product: Record<string, unknown>;
}): Promise<{ synced: number; errors: string[] }> {
  const { shopDomain, shopName } = await getShopifyIntegrationContext(opts.organizationId);
  const req = shopifyProductToMetaRequest(opts.product as ShopifyProduct, shopDomain, shopName);
  if (!req) {
    return { synced: 0, errors: [] };
  }
  return pushMetaCatalogBatch(opts.catalogId, opts.accessToken, [req]);
}

export async function syncWooProductPayloadToMeta(opts: {
  organizationId: string;
  catalogId: string;
  accessToken: string;
  product: Record<string, unknown>;
}): Promise<{ synced: number; errors: string[] }> {
  const integration = await getConnectedOrgIntegration(opts.organizationId, "woocommerce");
  if (!integration?.credentials) {
    throw new Error("WooCommerce integration not connected");
  }
  const config = (integration.config || {}) as Record<string, string>;
  let siteUrl = (config.site_url || "").trim();
  if (!siteUrl.startsWith("http")) siteUrl = `https://${siteUrl}`;
  siteUrl = siteUrl.replace(/\/$/, "");

  const p = opts.product as {
    sku?: string;
    id?: number;
    name?: string;
    description?: string;
    price?: string;
    stock_status?: string;
    status?: string;
    images?: Array<{ src?: string }>;
    permalink?: string;
  };

  if (p.status && p.status !== "publish") {
    return { synced: 0, errors: [] };
  }

  const retailerId = String(p.sku || p.id || "");
  if (!retailerId) {
    return { synced: 0, errors: [] };
  }

  const priceMajor = parseShopifyPriceMajor(p.price);
  const image = p.images?.[0]?.src;

  return pushMetaCatalogBatch(opts.catalogId, opts.accessToken, [
    {
      method: "UPDATE",
      data: {
        id: retailerId,
        title: String(p.name || retailerId).slice(0, 200),
        description: (p.description || "").replace(/<[^>]+>/g, "").slice(0, 5000) || p.name,
        availability: p.stock_status === "outofstock" ? "out of stock" : "in stock",
        condition: "new",
        price: formatMetaCatalogPrice(priceMajor),
        image_link: image,
        link: p.permalink || siteUrl,
        origin_country: "IN",
        wa_compliance_category: "DEFAULT",
      },
    },
  ]);
}

/**
 * Push up to `limit` Shopify products into a Meta Commerce catalog (items_batch).
 */
export async function syncShopifyProductsToMetaCatalog(opts: {
  organizationId: string;
  catalogId: string;
  accessToken: string;
  limit?: number;
  wabaId?: string;
}): Promise<{ synced: number; errors: string[] }> {
  const { shopDomain, accessTokenShop, shopName } = await getShopifyIntegrationContext(opts.organizationId);
  const catalogWriteToken = resolveCatalogWriteAccessToken(opts.accessToken);

  const verify = await verifyMetaCatalogAccess(catalogWriteToken, opts.catalogId, {
    wabaId: opts.wabaId,
  });
  if (!verify.valid) {
    throw new Error(verify.message || "Meta catalog not accessible");
  }

  const writeProbe = await probeMetaCatalogWriteAccess(opts.catalogId, catalogWriteToken);
  if (!writeProbe.writable) {
    throw new Error(writeProbe.message || "Meta catalog is not writable with the current token");
  }

  const max = Math.min(opts.limit ?? 100, 500);
  const shopRes = await fetch(
    `https://${shopDomain}.myshopify.com/admin/api/2024-01/products.json?limit=${max}&status=active`,
    { headers: { "X-Shopify-Access-Token": accessTokenShop } }
  );
  const shopData = await shopRes.json();
  if (!shopRes.ok) {
    throw new Error(shopData?.errors || "Failed to fetch Shopify products");
  }

  const products = (shopData.products || []) as ShopifyProduct[];
  const requests: MetaCatalogBatchRequest[] = [];
  for (const p of products) {
    const req = shopifyProductToMetaRequest(p, shopDomain, shopName);
    if (req) requests.push(req);
  }

  return pushMetaCatalogBatch(opts.catalogId, catalogWriteToken, requests);
}

export async function syncWooProductsToMetaCatalog(opts: {
  organizationId: string;
  catalogId: string;
  accessToken: string;
  limit?: number;
  wabaId?: string;
}): Promise<{ synced: number; errors: string[] }> {
  const integration = await getConnectedOrgIntegration(opts.organizationId, "woocommerce");
  if (!integration?.credentials) {
    throw new Error("WooCommerce integration not connected");
  }
  const creds = integration.credentials as Record<string, string>;
  const config = (integration.config || {}) as Record<string, string>;
  let siteUrl = (config.site_url || "").trim();
  if (!siteUrl.startsWith("http")) siteUrl = `https://${siteUrl}`;
  siteUrl = siteUrl.replace(/\/$/, "");

  const consumerKey = creds.consumer_key || creds.consumerKey || "";
  const consumerSecret = creds.consumer_secret || creds.consumerSecret || "";
  if (!siteUrl || !consumerKey || !consumerSecret) {
    throw new Error("WooCommerce site URL or API keys missing");
  }

  const catalogWriteToken = resolveCatalogWriteAccessToken(opts.accessToken);

  const verify = await verifyMetaCatalogAccess(catalogWriteToken, opts.catalogId, {
    wabaId: opts.wabaId,
  });
  if (!verify.valid) {
    throw new Error(verify.message || "Meta catalog not accessible");
  }

  const writeProbe = await probeMetaCatalogWriteAccess(opts.catalogId, catalogWriteToken);
  if (!writeProbe.writable) {
    throw new Error(writeProbe.message || "Meta catalog is not writable with the current token");
  }

  const max = Math.min(opts.limit ?? 100, 500);
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  const wooRes = await fetch(
    `${siteUrl}/wp-json/wc/v3/products?per_page=${max}&status=publish`,
    { headers: { Authorization: `Basic ${auth}` } }
  );
  const wooData = await wooRes.json();
  if (!wooRes.ok) {
    const msg =
      wooData?.message || (typeof wooData === "string" ? wooData : "Failed to fetch WooCommerce products");
    throw new Error(msg);
  }

  const products = Array.isArray(wooData) ? wooData : [];
  const requests: MetaCatalogBatchRequest[] = [];

  for (const p of products) {
    const retailerId = String(p.sku || p.id);
    const priceMajor = parseShopifyPriceMajor(p.price);
    const image = p.images?.[0]?.src;
    requests.push({
      method: "UPDATE",
      data: {
        id: retailerId,
        title: String(p.name || retailerId).slice(0, 200),
        description: (p.description || "").replace(/<[^>]+>/g, "").slice(0, 5000) || p.name,
        availability: p.stock_status === "outofstock" ? "out of stock" : "in stock",
        condition: "new",
        price: formatMetaCatalogPrice(priceMajor),
        image_link: image,
        link: p.permalink || siteUrl,
        origin_country: "IN",
        wa_compliance_category: "DEFAULT",
      },
    });
  }

  return pushMetaCatalogBatch(opts.catalogId, catalogWriteToken, requests);
}

export { fetchMetaCatalogProducts };
