import { fetchShopifyActiveProducts } from "./shopify-catalog-sync";
import {
  formatMetaCatalogPrice,
  parseShopifyPriceMajor,
  pickShopifyProductImage,
} from "./meta-catalog-product-fields";

export type MetaWhatsAppCatalogCsvRow = {
  id: string;
  title: string;
  description: string;
  availability: "in stock" | "out of stock";
  condition: "new";
  price: string;
  link: string;
  image_link: string;
  brand: string;
  origin_country: string;
  wa_compliance_category: string;
};

const CSV_HEADERS: Array<keyof MetaWhatsAppCatalogCsvRow> = [
  "id",
  "title",
  "description",
  "availability",
  "condition",
  "price",
  "link",
  "image_link",
  "brand",
  "origin_country",
  "wa_compliance_category",
];

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function escapeCsv(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function shopifyProductToCsvRow(
  p: {
    id: number;
    title: string;
    body_html?: string;
    status?: string;
    handle?: string;
    variants?: Array<{ id: number; price?: string; sku?: string }>;
    image?: { src?: string };
    images?: Array<{ src?: string }>;
  },
  shopDomain: string,
  brand: string
): MetaWhatsAppCatalogCsvRow | null {
  if (p.status && p.status !== "active") return null;
  const variant = p.variants?.[0];
  const id = String(variant?.sku || variant?.id || p.id);
  const priceMajor = parseShopifyPriceMajor(variant?.price);
  const link = p.handle
    ? `https://${shopDomain}.myshopify.com/products/${p.handle}`
    : `https://${shopDomain}.myshopify.com`;
  const image = pickShopifyProductImage(p) || "";
  const description =
    stripHtml(p.body_html || "").slice(0, 5000) || p.title?.slice(0, 200) || id;

  return {
    id,
    title: (p.title || id).slice(0, 200),
    description,
    availability: "in stock",
    condition: "new",
    price: formatMetaCatalogPrice(priceMajor),
    link,
    image_link: image,
    brand: brand.slice(0, 100) || shopDomain,
    origin_country: "IN",
    wa_compliance_category: "DEFAULT",
  };
}

export function buildMetaWhatsAppCatalogCsv(rows: MetaWhatsAppCatalogCsvRow[]): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const row of rows) {
    lines.push(CSV_HEADERS.map((h) => escapeCsv(row[h])).join(","));
  }
  return `\uFEFF${lines.join("\r\n")}`;
}

/** Export active Shopify products as a Meta Commerce Manager CSV (for SMB / feed upload). */
export async function exportShopifyProductsToMetaCatalogCsv(opts: {
  organizationId: string;
  limit?: number;
}): Promise<{ csv: string; productCount: number; shopDomain: string; shopName: string }> {
  const { shopDomain, shopName, products } = await fetchShopifyActiveProducts(
    opts.organizationId,
    opts.limit ?? 500
  );

  const rows: MetaWhatsAppCatalogCsvRow[] = [];
  for (const p of products) {
    const row = shopifyProductToCsvRow(p, shopDomain, shopName);
    if (row) rows.push(row);
  }

  if (!rows.length) {
    throw new Error("No active Shopify products found to export");
  }

  return {
    csv: buildMetaWhatsAppCatalogCsv(rows),
    productCount: rows.length,
    shopDomain,
    shopName,
  };
}
