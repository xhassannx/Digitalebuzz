import { storage } from "../storage";
import { normalizeShopDomain } from "./shopify-oauth";
import { pushMetaCatalogBatch } from "./catalog-sync-batch";
import {
  formatMetaCatalogPrice,
  parseShopifyPriceMajor,
  pickShopifyProductImage,
} from "./meta-catalog-product-fields";

const API_VERSION = "2024-01";
const GRAPH_API_VERSION = "v23.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export type ShopifyCollectionRow = {
  id: string;
  title: string;
  handle?: string;
  productsCount?: number;
};

async function getShopifyCreds(organizationId: string) {
  const integrations = await storage.getIntegrationsByOrganization(organizationId);
  const integration = integrations.find((i) => i.name === "shopify" && i.status === "connected");
  if (!integration?.credentials) throw new Error("Shopify not connected");
  const creds = integration.credentials as Record<string, string>;
  const shopDomain = normalizeShopDomain(
    (integration.config as Record<string, string>)?.shop_domain || creds.shop_domain || ""
  ).replace(/\.myshopify\.com$/, "");
  const accessTokenShop = creds.access_token;
  if (!shopDomain || !accessTokenShop) throw new Error("Shopify credentials incomplete");
  return { shopDomain, accessTokenShop, integration };
}

export async function listShopifyCollections(
  organizationId: string
): Promise<ShopifyCollectionRow[]> {
  const { shopDomain, accessTokenShop } = await getShopifyCreds(organizationId);
  const res = await fetch(
    `https://${shopDomain}.myshopify.com/admin/api/${API_VERSION}/custom_collections.json?limit=50`,
    { headers: { "X-Shopify-Access-Token": accessTokenShop } }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.errors || "Failed to list Shopify collections");
  const rows = (data.custom_collections || []) as Array<{
    id: number;
    title: string;
    handle?: string;
    products_count?: number;
  }>;
  return rows.map((c) => ({
    id: String(c.id),
    title: c.title,
    handle: c.handle,
    productsCount: c.products_count,
  }));
}

export async function getShopifyCollectionProductRetailerIds(
  organizationId: string,
  collectionId: string,
  limit = 30
): Promise<string[]> {
  const { shopDomain, accessTokenShop } = await getShopifyCreds(organizationId);
  const res = await fetch(
    `https://${shopDomain}.myshopify.com/admin/api/${API_VERSION}/collections/${collectionId}/products.json?limit=${Math.min(limit, 50)}`,
    { headers: { "X-Shopify-Access-Token": accessTokenShop } }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.errors || "Failed to load collection products");
  const products = (data.products || []) as Array<{
    id: number;
    variants?: Array<{ sku?: string; id: number }>;
  }>;
  const ids: string[] = [];
  for (const p of products) {
    const v = p.variants?.[0];
    ids.push(String(v?.sku || v?.id || p.id));
  }
  return ids.filter(Boolean);
}

/** Create or update a Meta catalog product set from a Shopify collection. */
export async function syncShopifyCollectionToMetaProductSet(opts: {
  organizationId: string;
  catalogId: string;
  accessToken: string;
  collectionId: string;
  collectionTitle: string;
}): Promise<{ productSetId: string; productCount: number }> {
  const retailerIds = await getShopifyCollectionProductRetailerIds(
    opts.organizationId,
    opts.collectionId,
    100
  );
  if (!retailerIds.length) {
    throw new Error("Collection has no products to sync");
  }

  // Meta product set filters use retailer_id + is_any (not product_retailer_id / or-eq).
  const uniqueIds = [...new Set(retailerIds.map((id) => String(id).trim()).filter(Boolean))].slice(
    0,
    100
  );
  const filter = {
    retailer_id: { is_any: uniqueIds },
  };

  const createRes = await fetch(`${GRAPH_BASE}/${opts.catalogId}/product_sets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: opts.collectionTitle.slice(0, 100),
      filter,
    }),
  });
  const createData = await createRes.json();
  if (!createRes.ok) {
    const errMsg = createData?.error?.message || "Meta product set creation failed";
    if (/valid Elastic Search rule/i.test(errMsg)) {
      throw new Error(
        `${errMsg} — Sync products to the catalog first so these retailer IDs exist in Meta, then create the product set. SKUs used: ${uniqueIds.slice(0, 5).join(", ")}${uniqueIds.length > 5 ? ", …" : ""}.`
      );
    }
    throw new Error(errMsg);
  }

  const productSetId = String(createData.id || "");
  return { productSetId, productCount: retailerIds.length };
}

export async function syncCollectionProductsToMetaCatalog(opts: {
  organizationId: string;
  catalogId: string;
  accessToken: string;
  collectionId: string;
  limit?: number;
}): Promise<{ synced: number }> {
  const { shopDomain, accessTokenShop } = await getShopifyCreds(opts.organizationId);
  const max = Math.min(opts.limit ?? 50, 100);
  const res = await fetch(
    `https://${shopDomain}.myshopify.com/admin/api/${API_VERSION}/collections/${opts.collectionId}/products.json?limit=${max}`,
    { headers: { "X-Shopify-Access-Token": accessTokenShop } }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.errors || "Failed to fetch collection products");

  const products = (data.products || []) as Array<{
    id: number;
    title: string;
    body_html?: string;
    variants?: Array<{ sku?: string; id: number; price?: string }>;
    image?: { src?: string };
    handle?: string;
  }>;

  if (!products.length) {
    throw new Error("This Shopify collection has no active products");
  }

  const requests = products.map((p) => {
    const variant = p.variants?.[0];
    const retailerId = String(variant?.sku || variant?.id || p.id);
    const priceMajor = parseShopifyPriceMajor(variant?.price);
    const link = p.handle
      ? `https://${shopDomain}.myshopify.com/products/${p.handle}`
      : `https://${shopDomain}.myshopify.com`;
    return {
      method: "UPDATE" as const,
      data: {
        id: retailerId,
        title: p.title?.slice(0, 200) || retailerId,
        description: (p.body_html || "").replace(/<[^>]+>/g, "").slice(0, 5000) || p.title,
        availability: "in stock",
        condition: "new",
        price: formatMetaCatalogPrice(priceMajor),
        image_link: pickShopifyProductImage(p),
        link,
        brand: shopDomain,
        origin_country: "IN",
        wa_compliance_category: "DEFAULT",
      },
    };
  });

  const result = await pushMetaCatalogBatch(opts.catalogId, opts.accessToken, requests);
  return { synced: result.synced };
}

/** Send a multi-product catalog message using products from a Shopify collection. */
export async function getCollectionCatalogSendPayload(opts: {
  organizationId: string;
  collectionId: string;
  body?: string;
  sectionTitle?: string;
  limit?: number;
}): Promise<{
  productRetailerIds: string[];
  body: string;
  sectionTitle: string;
}> {
  const retailerIds = await getShopifyCollectionProductRetailerIds(
    opts.organizationId,
    opts.collectionId,
    opts.limit ?? 30
  );
  if (!retailerIds.length) {
    throw new Error("Collection has no products with retailer IDs");
  }
  return {
    productRetailerIds: retailerIds.slice(0, 30),
    body: opts.body || "Browse this collection",
    sectionTitle: (opts.sectionTitle || "Collection").slice(0, 24),
  };
}
