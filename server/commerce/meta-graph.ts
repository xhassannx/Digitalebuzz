// @ts-nocheck
const GRAPH_API_VERSION = "v23.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export type MetaCatalogProduct = {
  retailerId: string;
  name: string;
  description?: string;
  price?: string;
  currency?: string;
  imageUrl?: string;
};

export type MetaCatalogProductsFetchResult = {
  products: MetaCatalogProduct[];
  warning?: string;
  error?: string;
  verificationMode?: string;
};

function parseCatalogProductRows(items: Array<Record<string, unknown>>): MetaCatalogProduct[] {
  return items
    .map((row) => {
      const retailerId = String(row.retailer_id || row.id || "").trim();
      if (!retailerId) return null;
      const priceRaw = row.price;
      let price: string | undefined;
      let currency: string | undefined;
      if (typeof priceRaw === "string") {
        price = priceRaw;
      } else if (priceRaw && typeof priceRaw === "object") {
        const p = priceRaw as Record<string, unknown>;
        if (p.amount != null) price = String(p.amount);
        if (p.currency) currency = String(p.currency);
      }
      return {
        retailerId,
        name: String(row.name || retailerId),
        description: row.description ? String(row.description) : undefined,
        price,
        currency: currency || (row.currency ? String(row.currency) : undefined),
        imageUrl: row.image_url ? String(row.image_url) : undefined,
      };
    })
    .filter((p): p is MetaCatalogProduct => p !== null);
}

function filterCatalogProductsBySearch(
  products: MetaCatalogProduct[],
  search?: string
): MetaCatalogProduct[] {
  const q = search?.trim().toLowerCase();
  if (!q) return products;
  return products.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.retailerId.toLowerCase().includes(q) ||
      (p.description || "").toLowerCase().includes(q)
  );
}

export function isUnsupportedCatalogAccessError(message?: string): boolean {
  if (!message) return false;
  return (
    /unsupported get request/i.test(message) ||
    /unsupported post request/i.test(message) ||
    /does not exist, cannot be loaded due to missing permissions/i.test(message) ||
    /does not support this operation/i.test(message)
  );
}

/** GET/POST catalog Graph calls blocked (permissions, SMB, wrong catalog id). */
export function isMetaCatalogGraphBlockedError(message?: string): boolean {
  if (!message) return false;
  return isUnsupportedCatalogAccessError(message) || isSmbBusinessTypeError(message);
}

export const META_CATALOG_WRITE_BLOCKED_MESSAGE =
  "Meta blocked writing to this catalog with your WhatsApp token. For SMB accounts, ensure the catalog is linked in Commerce Manager and your Meta app has catalog_management approved, then reconnect WhatsApp. You can also add products in Commerce Manager, or use “Send test to phone” below (uses Shopify SKUs without API catalog upload).";

function catalogProductsPermissionHelp(catalogId: string): string {
  return (
    `Cannot list products for catalog ${catalogId} with this WhatsApp token. ` +
    `The catalog must belong to the same Meta Business and be linked under Commerce Manager → WhatsApp. ` +
    `If your Meta app has catalog_management approved, reconnect WhatsApp under Integrations so the token includes that permission. ` +
    `WhatsApp SMB accounts often cannot list products via API — use Shopify/WooCommerce sync or send by retailer ID in chat.`
  );
}

async function fetchCatalogProductsRaw(
  accessToken: string,
  catalogId: string,
  opts: { limit: number; fields: string; filter?: Record<string, unknown> }
): Promise<{ ok: boolean; items: Array<Record<string, unknown>>; error?: string }> {
  const url = new URL(`${GRAPH_BASE}/${catalogId}/products`);
  url.searchParams.set("fields", opts.fields);
  url.searchParams.set("limit", String(opts.limit));
  if (opts.filter) {
    url.searchParams.set("filter", JSON.stringify(opts.filter));
  }
  url.searchParams.set("access_token", accessToken);
  const res = await fetch(url.toString());
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    return {
      ok: false,
      items: [],
      error: graphErrorMessage(data, "Failed to load catalog products from Meta"),
    };
  }
  const items = (data?.data || []) as Array<Record<string, unknown>>;
  return { ok: true, items };
}

/**
 * Load catalog products with fallbacks; returns empty list + warning instead of throwing
 * when Meta blocks the edge (common for WhatsApp SMB tokens).
 */
export async function fetchMetaCatalogProductsResult(
  accessToken: string,
  catalogId: string,
  opts?: { limit?: number; search?: string; wabaId?: string }
): Promise<MetaCatalogProductsFetchResult> {
  const cid = String(catalogId || "").trim();
  if (!cid) {
    return { products: [], error: "Catalog ID is required" };
  }
  const limit = Math.min(Math.max(opts?.limit ?? 30, 1), 100);
  const fieldSets = [
    "retailer_id,name,description,price,currency,image_url",
    "retailer_id,name,description,image_url",
    "retailer_id,name",
  ];

  let lastError = "";
  for (const fields of fieldSets) {
    const page = await fetchCatalogProductsRaw(accessToken, cid, { limit, fields });
    if (page.ok) {
      return {
        products: filterCatalogProductsBySearch(parseCatalogProductRows(page.items), opts?.search),
      };
    }
    lastError = page.error || lastError;
    if (!isUnsupportedCatalogAccessError(lastError) && !isWrongGraphEdgeError(lastError)) {
      break;
    }
  }

  const wabaId = String(opts?.wabaId || "").trim();
  if (wabaId) {
    const verify = await verifyMetaCatalogAccess(accessToken, cid, { wabaId });
    if (verify.verificationMode === "smb_manual" || isSmbBusinessTypeError(lastError)) {
      return {
        products: [],
        warning:
          "WhatsApp SMB account: Meta does not allow loading catalog products through the API. " +
          "Products still work in WhatsApp if the catalog is linked in Commerce Manager → WhatsApp. " +
          "Use Shopify/WooCommerce sync, or send catalog messages using product retailer IDs manually.",
        verificationMode: "smb_manual",
      };
    }
    if (verify.valid && (verify.productCount ?? 0) > 0) {
      return {
        products: [],
        warning:
          "Catalog is reachable but product listing is blocked for this token. " +
          "Reconnect WhatsApp in Integrations after catalog_management is approved on your Meta app, " +
          "or sync products from Shopify/WooCommerce.",
        verificationMode: verify.verificationMode,
      };
    }
    if (!verify.valid && verify.message) {
      return { products: [], warning: verify.message, error: lastError };
    }
  }

  if (isUnsupportedCatalogAccessError(lastError) || isWrongGraphEdgeError(lastError)) {
    return {
      products: [],
      warning: catalogProductsPermissionHelp(cid),
      error: lastError,
    };
  }

  return {
    products: [],
    error: formatGraphError({ error: { message: lastError } }, lastError),
  };
}

const CATALOG_PRODUCT_FIELDS = "retailer_id,name,description,price,currency,image_url";

/** Direct Meta lookup by retailer_id / Content ID (works when list pagination misses the product). */
export async function fetchMetaCatalogProductByRetailerId(
  accessToken: string,
  catalogId: string,
  retailerId: string
): Promise<MetaCatalogProduct | null> {
  const guess = String(retailerId || "").trim();
  const cid = String(catalogId || "").trim();
  if (!guess || !cid) return null;

  const filters: Array<Record<string, unknown>> = [
    { retailer_id: { eq: guess } },
    { retailer_id: { is_any: [guess] } },
    { id: { eq: guess } },
  ];

  for (const filter of filters) {
    const page = await fetchCatalogProductsRaw(accessToken, cid, {
      limit: 5,
      fields: CATALOG_PRODUCT_FIELDS,
      filter,
    });
    if (page.ok && page.items.length) {
      const parsed = parseCatalogProductRows(page.items);
      const exact =
        parsed.find((p) => p.retailerId === guess) ||
        parsed.find((p) => p.retailerId.toLowerCase() === guess.toLowerCase());
      return exact || parsed[0] || null;
    }
  }
  return null;
}

export type ResolvedCatalogProduct = {
  product: MetaCatalogProduct | null;
  retailerId: string;
  resolvedFrom: "list" | "filter" | "name" | "guess";
  availableIds?: string[];
};

/** Resolve catalog product for WA Pay / checkout — list, filter, name, then trust guess (SMB). */
export async function resolveCatalogProductForCheckout(
  accessToken: string,
  catalogId: string,
  opts: { retailerIdGuess: string; itemNameGuess?: string }
): Promise<ResolvedCatalogProduct> {
  const guess = String(opts.retailerIdGuess || "").trim();
  const nameGuess = String(opts.itemNameGuess || "").trim();
  if (!guess && !nameGuess) {
    return { product: null, retailerId: "", resolvedFrom: "guess" };
  }

  const listed = await fetchMetaCatalogProductsResult(accessToken, catalogId, { limit: 100 });
  const products = listed.products || [];

  if (guess && products.length) {
    const lower = guess.toLowerCase();
    const fromList = products.find(
      (p) =>
        p.retailerId === guess ||
        p.retailerId.toLowerCase() === lower ||
        p.name.trim().toLowerCase() === lower
    );
    if (fromList) {
      return { product: fromList, retailerId: fromList.retailerId, resolvedFrom: "list" };
    }
  }

  if (nameGuess && products.length) {
    const lowerName = nameGuess.toLowerCase();
    const fromName = products.find((p) => p.name.trim().toLowerCase() === lowerName);
    if (fromName) {
      return { product: fromName, retailerId: fromName.retailerId, resolvedFrom: "name" };
    }
  }

  if (guess) {
    const fromFilter = await fetchMetaCatalogProductByRetailerId(accessToken, catalogId, guess);
    if (fromFilter) {
      return { product: fromFilter, retailerId: fromFilter.retailerId, resolvedFrom: "filter" };
    }
  }

  if (nameGuess) {
    const nameFilter = await fetchCatalogProductsRaw(accessToken, catalogId, {
      limit: 5,
      fields: CATALOG_PRODUCT_FIELDS,
      filter: { name: { i_contains: nameGuess.slice(0, 40) } },
    });
    if (nameFilter.ok && nameFilter.items.length) {
      const parsed = parseCatalogProductRows(nameFilter.items);
      const lowerName = nameGuess.toLowerCase();
      const match =
        parsed.find((p) => p.name.trim().toLowerCase() === lowerName) ||
        parsed.find((p) => p.name.trim().toLowerCase().includes(lowerName)) ||
        parsed[0];
      if (match) {
        return { product: match, retailerId: match.retailerId, resolvedFrom: "filter" };
      }
    }
  }

  if (nameGuess && products.length) {
    const partial = products.find((p) =>
      p.name.trim().toLowerCase().includes(nameGuess.toLowerCase())
    );
    if (partial) {
      return { product: partial, retailerId: partial.retailerId, resolvedFrom: "name" };
    }
  }

  return {
    product: null,
    retailerId: guess,
    resolvedFrom: "guess",
    availableIds: products.slice(0, 8).map((p) => `${p.name} → ${p.retailerId}`),
  };
}

/** Throws when products cannot be loaded (used by sync jobs). */
export async function fetchMetaCatalogProducts(
  accessToken: string,
  catalogId: string,
  opts?: { limit?: number; search?: string; wabaId?: string }
): Promise<MetaCatalogProduct[]> {
  const result = await fetchMetaCatalogProductsResult(accessToken, catalogId, opts);
  if (result.products.length > 0) return result.products;
  if (result.warning) return [];
  if (result.error) throw new Error(result.error);
  return [];
}

/**
 * Best-effort catalog product count for analytics dashboards.
 * Never throws — Meta permission/SMB errors return count null + note.
 */
export async function resolveCommerceCatalogProductCount(
  accessToken: string,
  catalogId: string,
  opts?: { wabaId?: string }
): Promise<{
  count: number | null;
  note?: string;
  verificationMode?: string;
}> {
  const cid = String(catalogId || "").trim();
  if (!cid) return { count: null };

  try {
    const verify = await verifyMetaCatalogAccess(accessToken, cid, {
      wabaId: opts?.wabaId,
    });

    if (verify.verificationMode === "smb_manual") {
      return {
        count: null,
        note:
          verify.message ||
          "WhatsApp SMB: product count is not available via Meta API. The catalog can still work in WhatsApp when linked in Commerce Manager.",
        verificationMode: "smb_manual",
      };
    }

    if (verify.valid && verify.productCount != null) {
      return {
        count: verify.productCount,
        note: verify.message,
        verificationMode: verify.verificationMode,
      };
    }

    const listed = await fetchMetaCatalogProductsResult(accessToken, cid, {
      limit: 100,
      wabaId: opts?.wabaId,
    });
    if (listed.products.length > 0) {
      return {
        count: listed.products.length,
        verificationMode: listed.verificationMode,
      };
    }

    return {
      count: null,
      note: listed.warning || verify.message || listed.error,
      verificationMode: listed.verificationMode || verify.verificationMode,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (isUnsupportedCatalogAccessError(msg) || isSmbBusinessTypeError(msg)) {
      return {
        count: null,
        note: catalogProductsPermissionHelp(cid),
        verificationMode: "smb_manual",
      };
    }
    return { count: null, note: "Could not load catalog product count from Meta." };
  }
}

export type MetaOwnedCatalog = {
  id: string;
  name?: string;
  productCount?: number;
};

function formatGraphError(data: Record<string, unknown>, fallback: string): string {
  const err = data?.error as Record<string, unknown> | undefined;
  const msg = typeof err?.message === "string" ? err.message : fallback;
  const sub = err?.error_subcode != null ? Number(err.error_subcode) : null;
  if (/nonexisting field/i.test(msg)) {
    return msg;
  }
  if (sub === 33 || /unsupported get request/i.test(msg)) {
    return (
      `${msg} — Use the Product Catalog ID from Commerce Manager (not WABA/phone ID). ` +
      `The catalog must be linked to this WhatsApp account in Meta Commerce Manager, ` +
      `and the verify session’s token must belong to the same Meta Business. ` +
      `Use “List catalogs” on Commerce to pick a catalog linked to the selected session.`
    );
  }
  return msg;
}

function isWrongGraphEdgeError(error?: string): boolean {
  if (!error) return false;
  return (
    /nonexisting field/i.test(error) ||
    /unsupported get request/i.test(error) ||
    /does not exist/i.test(error)
  );
}

/** WhatsApp Cloud API SMB accounts cannot use WABA catalog management Graph edges. */
export function isSmbBusinessTypeError(message?: string): boolean {
  if (!message) return false;
  return /SMB business type|can not be performed on SMB|cannot be performed on SMB/i.test(
    message
  );
}

function graphErrorMessage(data: Record<string, unknown>, fallback: string): string {
  const err = data?.error as Record<string, unknown> | undefined;
  return typeof err?.message === "string" ? err.message : fallback;
}

/** Resolve WABA id from Cloud API phone number id (preferred over stale session wabaId). */
export async function resolveWabaIdFromPhoneNumber(
  accessToken: string,
  phoneNumberId: string
): Promise<string | null> {
  const pid = String(phoneNumberId || "").trim();
  if (!pid || pid === "unknown") return null;
  try {
    const url = `${GRAPH_BASE}/${pid}?fields=whatsapp_business_account{id}&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) return null;
    const id = data?.whatsapp_business_account?.id;
    return typeof id === "string" && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

function parseCatalogRows(data: Record<string, unknown>): MetaOwnedCatalog[] {
  const rows = (data?.data || []) as Array<Record<string, unknown>>;
  return rows
    .map((row) => {
      const id = String(row.id || "").trim();
      if (!id) return null;
      const productCount =
        row.product_count != null ? Number(row.product_count) : undefined;
      return {
        id,
        name: row.name ? String(row.name) : undefined,
        productCount: Number.isFinite(productCount) ? productCount : undefined,
      };
    })
    .filter((c): c is MetaOwnedCatalog => c !== null);
}

async function fetchCatalogListEdge(
  accessToken: string,
  ownerId: string,
  edge: "owned_product_catalogs" | "product_catalogs"
): Promise<{ catalogs: MetaOwnedCatalog[]; error?: string }> {
  const url = new URL(`${GRAPH_BASE}/${ownerId}/${edge}`);
  url.searchParams.set("fields", "id,name,product_count");
  url.searchParams.set("limit", "50");
  url.searchParams.set("access_token", accessToken);
  const res = await fetch(url.toString());
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    return {
      catalogs: [],
      error: formatGraphError(data, "Could not list catalogs"),
    };
  }
  return { catalogs: parseCatalogRows(data) };
}

/**
 * Catalogs reachable from a WhatsApp connection.
 * Session `businessAccountId` / `wabaId` is a WABA id — use `product_catalogs` on it.
 * `owned_product_catalogs` only works on a Meta Business id, not a WABA id.
 */
export async function listOwnedProductCatalogs(
  accessToken: string,
  wabaOrBusinessId: string
): Promise<{ catalogs: MetaOwnedCatalog[]; error?: string; smbAccount?: boolean }> {
  const ownerId = String(wabaOrBusinessId || "").trim();
  if (!ownerId) return { catalogs: [], error: "WABA ID required" };
  try {
    const waba = await fetchCatalogListEdge(accessToken, ownerId, "product_catalogs");
    if (waba.catalogs.length > 0) return waba;
    if (waba.error && !isWrongGraphEdgeError(waba.error)) {
      if (isSmbBusinessTypeError(waba.error)) {
        return {
          catalogs: [],
          error:
            "This WhatsApp account is SMB type — Meta does not allow listing catalogs via API. " +
            "Open Commerce Manager, copy your Catalog ID, paste it above, then click Save & verify.",
          smbAccount: true,
        };
      }
      return waba;
    }

    const owned = await fetchCatalogListEdge(
      accessToken,
      ownerId,
      "owned_product_catalogs"
    );
    if (owned.catalogs.length > 0) return owned;
    const combinedErr = waba.error || owned.error || "";
    if (isSmbBusinessTypeError(combinedErr)) {
      return {
        catalogs: [],
        error:
          "This WhatsApp account is SMB type — Meta does not allow listing catalogs via API. " +
          "Open Commerce Manager, copy your Catalog ID, paste it above, then click Save & verify.",
        smbAccount: true,
      };
    }
    return {
      catalogs: [],
      error:
        combinedErr ||
        "No product catalogs linked to this WhatsApp account. Link a catalog in Meta Commerce Manager → WhatsApp.",
    };
  } catch (e: unknown) {
    return {
      catalogs: [],
      error: e instanceof Error ? e.message : "Could not list catalogs",
    };
  }
}

function formatCatalogHint(catalogs: MetaOwnedCatalog[]): string {
  return catalogs
    .slice(0, 5)
    .map((c) => `${c.name || "Catalog"} (${c.id})`)
    .join(", ");
}

/**
 * SMB-safe check: read `/{catalog-id}/products` (often allowed when WABA catalog edges are not).
 */
async function verifyCatalogViaProductsEdge(
  accessToken: string,
  catalogId: string
): Promise<{ valid: boolean; name?: string; message?: string; productCount?: number }> {
  const url = new URL(`${GRAPH_BASE}/${catalogId}/products`);
  url.searchParams.set("fields", "retailer_id,name");
  url.searchParams.set("limit", "5");
  url.searchParams.set("access_token", accessToken);
  const res = await fetch(url.toString());
  const data = (await res.json()) as Record<string, unknown>;
  if (res.ok) {
    const rows = Array.isArray(data?.data) ? data.data.length : 0;
    return {
      valid: true,
      productCount: rows,
      message:
        rows > 0
          ? undefined
          : "Catalog is reachable but has no products yet. Add products in Meta Commerce Manager.",
    };
  }
  const msg = graphErrorMessage(data, "Cannot read products from this catalog");
  if (isSmbBusinessTypeError(msg)) {
    return {
      valid: true,
      message:
        "Catalog ID saved. WhatsApp SMB accounts cannot be fully verified via Meta API — " +
        "ensure this catalog is linked to your WhatsApp number in Commerce Manager → WhatsApp.",
    };
  }
  return { valid: false, message: formatGraphError(data, msg) };
}

/** Verify catalog is linked to the WABA / readable with this token. */
export async function verifyMetaCatalogAccess(
  accessToken: string,
  catalogId: string,
  opts?: { wabaId?: string; businessId?: string }
): Promise<{
  valid: boolean;
  name?: string;
  message?: string;
  productCount?: number;
  verificationMode?: "waba" | "catalog" | "products" | "smb_manual";
}> {
  const cid = String(catalogId || "").trim();
  if (!cid) {
    return { valid: false, message: "Catalog ID is required" };
  }
  const wabaId = String(opts?.wabaId || opts?.businessId || "").trim();
  let smbBlocked = false;
  let lastError = "Cannot access this catalog with your WhatsApp token";

  try {
    if (wabaId) {
      const { catalogs, error: listErr } = await fetchCatalogListEdge(
        accessToken,
        wabaId,
        "product_catalogs"
      );
      if (listErr && isSmbBusinessTypeError(listErr)) {
        smbBlocked = true;
      } else {
        const match = catalogs.find((c) => c.id === cid);
        if (match) {
          return {
            valid: true,
            name: match.name,
            productCount: match.productCount,
            verificationMode: "waba",
          };
        }
        if (catalogs.length > 0) {
          return {
            valid: false,
            message:
              `Catalog ${cid} is not linked to WhatsApp account ${wabaId}. ` +
              `Linked catalogs: ${formatCatalogHint(catalogs)}${catalogs.length > 5 ? ", …" : ""}. ` +
              `Link the catalog in Commerce Manager or pick one of the IDs above.`,
          };
        }
        if (listErr && !isWrongGraphEdgeError(listErr) && !isSmbBusinessTypeError(listErr)) {
          lastError = listErr;
        }
      }
    }

    const url = `${GRAPH_BASE}/${cid}?fields=id,name,product_count&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url);
    const data = (await res.json()) as Record<string, unknown>;
    if (res.ok) {
      const productCount =
        (data as { product_count?: number }).product_count != null
          ? Number((data as { product_count?: number }).product_count)
          : undefined;
      return {
        valid: true,
        name: data.name ? String(data.name) : undefined,
        productCount: Number.isFinite(productCount) ? productCount : undefined,
        verificationMode: "catalog",
      };
    }

    lastError = formatGraphError(data, lastError);
    if (isSmbBusinessTypeError(lastError)) {
      smbBlocked = true;
    }

    const viaProducts = await verifyCatalogViaProductsEdge(accessToken, cid);
    if (viaProducts.valid) {
      return { ...viaProducts, verificationMode: smbBlocked ? "smb_manual" : "products" };
    }
    lastError = viaProducts.message || lastError;

    if (smbBlocked) {
      return {
        valid: true,
        verificationMode: "smb_manual",
        message:
          "Catalog ID saved. For WhatsApp SMB accounts, link the catalog in Meta Commerce Manager → WhatsApp " +
          "(API catalog listing is not available for SMB business type).",
      };
    }

    if (wabaId) {
      const { catalogs, error: listErr } = await listOwnedProductCatalogs(
        accessToken,
        wabaId
      );
      if (catalogs.length > 0) {
        lastError += ` Catalogs linked to this WhatsApp account: ${formatCatalogHint(catalogs)}${catalogs.length > 5 ? ", …" : ""}.`;
      } else if (listErr && !/nonexisting field/i.test(listErr)) {
        lastError += ` ${listErr}`;
      } else if (!catalogs.length) {
        lastError +=
          " No catalog is linked to this WhatsApp account yet — connect one in Meta Commerce Manager → WhatsApp.";
      }
    }

    if (isUnsupportedCatalogAccessError(lastError)) {
      return {
        valid: true,
        verificationMode: "smb_manual",
        message:
          "Catalog ID saved. Meta cannot read or list this catalog with your WhatsApp token (common for SMB). " +
          "API sync from Shopify/WooCommerce may be blocked — use Commerce Manager data feed or manual upload.",
      };
    }

    return { valid: false, message: lastError };
  } catch (e: unknown) {
    const viaProducts = await verifyCatalogViaProductsEdge(accessToken, cid).catch(() => null);
    if (viaProducts?.valid) {
      return { ...viaProducts, verificationMode: "products" };
    }
    if (smbBlocked) {
      return {
        valid: true,
        verificationMode: "smb_manual",
        message:
          "Catalog ID saved. For WhatsApp SMB accounts, link the catalog in Meta Commerce Manager → WhatsApp.",
      };
    }
    const errMsg = e instanceof Error ? e.message : "";
    if (isUnsupportedCatalogAccessError(errMsg)) {
      return {
        valid: true,
        verificationMode: "smb_manual",
        message:
          "Catalog ID saved. Meta cannot verify this catalog via API with your token (common for SMB). " +
          "API sync from Shopify/WooCommerce may be blocked — use Commerce Manager data feed or manual upload.",
      };
    }
    return {
      valid: false,
      message: errMsg || "Catalog verification failed",
    };
  }
}

/** Map user-entered id (Content ID, title) to Graph `retailer_id` when listing is allowed. */
export async function resolveCatalogRetailerIdForSend(
  accessToken: string,
  catalogId: string,
  guess: string
): Promise<{ retailerId: string; resolved: boolean; availableIds?: string[] }> {
  const g = String(guess || "").trim();
  if (!g) return { retailerId: g, resolved: false };

  const listed = await fetchMetaCatalogProductsResult(accessToken, catalogId, { limit: 100 });
  const products = listed.products || [];
  if (!products.length) {
    return { retailerId: g, resolved: false };
  }

  const lower = g.toLowerCase();
  const match = products.find(
    (p) =>
      p.retailerId === g ||
      p.retailerId.toLowerCase() === lower ||
      p.name.trim().toLowerCase() === lower
  );
  if (match) {
    return { retailerId: match.retailerId, resolved: match.retailerId !== g };
  }

  return {
    retailerId: g,
    resolved: false,
    availableIds: products.slice(0, 10).map((p) => `${p.name} → ${p.retailerId}`),
  };
}

export type WhatsAppCommerceDiagnosticCheck = {
  ok: boolean;
  label: string;
  detail?: string;
};

export type WhatsAppCommerceDiagnostics = {
  wabaId: string | null;
  phoneNumberId: string | null;
  configuredCatalogId: string | null;
  wabaLinkedCatalogs: MetaOwnedCatalog[];
  wabaListError?: string;
  smbAccount?: boolean;
  commerceSettings?: { is_catalog_visible?: boolean; is_cart_enabled?: boolean };
  commerceSettingsError?: string;
  catalogLinkedToWaba: boolean | null;
  checks: WhatsAppCommerceDiagnosticCheck[];
};

/** Read commerce flags for a Cloud API phone number. */
export async function fetchWhatsAppCommerceSettings(
  accessToken: string,
  phoneNumberId: string
): Promise<{
  isCatalogVisible?: boolean;
  isCartEnabled?: boolean;
  empty?: boolean;
  error?: string;
}> {
  const pid = String(phoneNumberId || "").trim();
  if (!pid) return { error: "Phone number ID required" };
  try {
    const url = new URL(`${GRAPH_BASE}/${pid}/whatsapp_commerce_settings`);
    url.searchParams.set("access_token", accessToken);
    const res = await fetch(url.toString());
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      return { error: graphErrorMessage(data, "Could not read commerce settings") };
    }
    const row = ((data?.data as unknown[]) || [])[0] as Record<string, unknown> | undefined;
    if (!row) {
      return { empty: true, isCatalogVisible: false };
    }
    return {
      isCatalogVisible: row.is_catalog_visible === true,
      isCartEnabled: row.is_cart_enabled === true,
    };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Commerce settings check failed" };
  }
}

export function catalogNotLinkedToPhoneMessage(catalogId: string, phoneHint?: string): string {
  return (
    `Products exist in catalog ${catalogId}, but this WhatsApp phone${phoneHint ? ` (${phoneHint})` : ""} is not connected to that catalog yet — ` +
    `whatsapp_commerce_settings is empty / catalog not visible. ` +
    `Open WhatsApp Manager → select this phone number → Catalog → connect "Whatsapp products" (ID ${catalogId}). ` +
    `SMB accounts cannot link via API; use WhatsApp Manager UI only. Wait up to 1 hour after linking, then retry.`
  );
}

export async function runWhatsAppCommerceDiagnostics(
  accessToken: string,
  opts: { phoneNumberId: string; wabaId: string; configuredCatalogId?: string }
): Promise<WhatsAppCommerceDiagnostics> {
  const phoneNumberId = String(opts.phoneNumberId || "").trim();
  const wabaId = String(opts.wabaId || "").trim();
  const configuredCatalogId = String(opts.configuredCatalogId || "").trim() || null;
  const checks: WhatsAppCommerceDiagnosticCheck[] = [];

  if (configuredCatalogId) {
    checks.push({
      ok: true,
      label: "Catalog ID configured in panel",
      detail: configuredCatalogId,
    });
  } else {
    checks.push({
      ok: false,
      label: "Catalog ID configured in panel",
      detail: "Missing — save catalog ID in Commerce settings.",
    });
  }

  const { catalogs, error: wabaListError, smbAccount } = await listOwnedProductCatalogs(
    accessToken,
    wabaId
  );

  let catalogLinkedToWaba: boolean | null = null;
  if (smbAccount) {
    checks.push({
      ok: false,
      label: "Catalog linked on WhatsApp Business Account (API check)",
      detail:
        "SMB account — API cannot list linked catalogs. In WhatsApp Manager → Catalog, confirm catalog " +
        (configuredCatalogId || "(your ID)") +
        " is connected to this phone number.",
    });
    catalogLinkedToWaba = null;
  } else if (catalogs.length > 0) {
    catalogLinkedToWaba = configuredCatalogId
      ? catalogs.some((c) => c.id === configuredCatalogId)
      : true;
    checks.push({
      ok: !!catalogLinkedToWaba,
      label: "Configured catalog linked to this WABA",
      detail: catalogLinkedToWaba
        ? "Match found."
        : `Linked on WABA: ${formatCatalogHint(catalogs)}. Update Commerce settings or reconnect the correct catalog in WhatsApp Manager.`,
    });
  } else {
    catalogLinkedToWaba = false;
    checks.push({
      ok: false,
      label: "Catalog linked on WhatsApp Business Account",
      detail:
        wabaListError ||
        "No catalog on this WABA. WhatsApp Manager → Catalog → Connect catalog (873364941762213).",
    });
  }

  let commerceSettings: WhatsAppCommerceDiagnostics["commerceSettings"];
  let commerceSettingsError: string | undefined;
  if (phoneNumberId) {
    const url = new URL(`${GRAPH_BASE}/${phoneNumberId}/whatsapp_commerce_settings`);
    url.searchParams.set("access_token", accessToken);
    const res = await fetch(url.toString());
    const data = (await res.json()) as Record<string, unknown>;
    if (res.ok) {
      const row = ((data?.data as unknown[]) || [])[0] as Record<string, unknown> | undefined;
      commerceSettings = {
        is_catalog_visible: row?.is_catalog_visible as boolean | undefined,
        is_cart_enabled: row?.is_cart_enabled as boolean | undefined,
      };
      checks.push({
        ok: commerceSettings.is_catalog_visible === true,
        label: "Catalog visible on this phone number",
        detail:
          commerceSettings.is_catalog_visible === true
            ? "is_catalog_visible=true"
            : "Run POST .../whatsapp_commerce_settings?is_catalog_visible=true or enable in WhatsApp Manager.",
      });
    } else {
      commerceSettingsError = graphErrorMessage(data, "Could not read commerce settings");
      checks.push({
        ok: false,
        label: "Catalog visible on this phone number",
        detail: commerceSettingsError,
      });
    }
  }

  return {
    wabaId,
    phoneNumberId,
    configuredCatalogId,
    wabaLinkedCatalogs: catalogs,
    wabaListError,
    smbAccount,
    commerceSettings,
    commerceSettingsError,
    catalogLinkedToWaba,
    checks,
  };
}

export function formatWaPayDeliveryError(code: number | undefined, details?: string): string | null {
  const d = String(details || "").trim();
  if (
    /not eligible for P2M|P2M payments|not an enterprise account|enterprise account/i.test(d)
  ) {
    return (
      "Your WhatsApp Business account is not eligible for native in-chat payments (P2M). " +
      "Meta requires an enterprise Cloud API WABA for payment_gateway checkout — SMB / WhatsApp Business App " +
      "numbers often cannot use Review and pay even with Razorpay linked. " +
      "Contact Meta at whatsappindia-bizpayments-support@meta.com to request P2M eligibility, or use " +
      "Commerce → Shopify/Woo external checkout / Inbox payment links until approved."
    );
  }
  if (code === 131026) {
    return (
      `Message undeliverable (#131026). ${d ? `Meta: ${d}` : "Check catalog product, order type, and WhatsApp app version."}`
    );
  }
  if (code === 131031) {
    return "Recipient is not registered on WhatsApp (#131031). Check the phone number.";
  }
  return null;
}

export function formatCatalogProductSendError(
  rawMessage: string,
  ctx: {
    catalogId: string;
    retailerId: string;
    wabaHint?: string;
    availableIds?: string[];
    catalogVerifyMessage?: string;
  }
): string {
  const detailsMatch = rawMessage.match(/details["']?\s*:\s*["']([^"']+)["']/i);
  const metaDetails = detailsMatch?.[1] || "";
  const is131009 = /131009|parameter value is not valid/i.test(rawMessage);
  const productNotInCatalog =
    /product not found for product_retailer_id/i.test(rawMessage) ||
    /none of the products|check your catalog/i.test(rawMessage) ||
    /none of the products|check your catalog/i.test(metaDetails);

  if (!is131009 && !productNotInCatalog) {
    return rawMessage;
  }

  const lines = [
    metaDetails || rawMessage,
    "",
    "Common fixes:",
    `• Product ${ctx.retailerId} may exist in Commerce Manager but WhatsApp Cloud API does not see catalog ${ctx.catalogId} on this phone yet. Open Business Settings → Accounts → WhatsApp accounts → your account → Settings → Connected catalog → select "Whatsapp products" (${ctx.catalogId}). WhatsApp Manager toggles alone are not always enough.`,
    `• GET /api/commerce/diagnostics?sessionId=… — if commerce_settings is empty, disconnect/reconnect catalog on the phone in WhatsApp Manager, wait 24–48h, or contact Meta support (common for SMB / is_on_biz_app numbers).`,
    "• Commerce Manager → Whatsapp products → Status and issues: fix all rows (price, image, WhatsApp/India). Delete test product id=probe.",
    "• Session product messages need the recipient to message your business number within 24 hours first.",
  ];
  if (ctx.catalogVerifyMessage) {
    lines.push(`• Catalog check: ${ctx.catalogVerifyMessage}`);
  }
  if (ctx.availableIds?.length) {
    lines.push(`• IDs Meta returned for this catalog: ${ctx.availableIds.join("; ")}`);
  }
  if (ctx.wabaHint) {
    lines.push(`• ${ctx.wabaHint}`);
  }
  return lines.join("\n");
}
