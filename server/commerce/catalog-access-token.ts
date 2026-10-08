import { isMetaCatalogGraphBlockedError, isSmbBusinessTypeError } from "./meta-graph";
import { formatMetaCatalogPrice } from "./meta-catalog-product-fields";

const GRAPH = "https://graph.facebook.com/v23.0";

/** Prefer TSP system user token (catalog_management) for catalog Graph writes. */
export function resolveCatalogWriteAccessToken(whatsappAccessToken: string): string {
  const systemToken = process.env.META_SYSTEM_USER_TOKEN?.trim();
  if (systemToken) return systemToken;
  return whatsappAccessToken;
}

export type CatalogWriteProbe = {
  writable: boolean;
  message?: string;
  smbAccount?: boolean;
};

/**
 * Best-effort check that items_batch can reach this catalog with the given token.
 * Avoids fetching Shopify products when Meta will reject the upload anyway.
 */
export async function probeMetaCatalogWriteAccess(
  catalogId: string,
  accessToken: string
): Promise<CatalogWriteProbe> {
  const cid = String(catalogId || "").trim();
  if (!cid) {
    return { writable: false, message: "Meta catalog ID is required" };
  }

  const catRes = await fetch(
    `${GRAPH}/${cid}?fields=id,name&access_token=${encodeURIComponent(accessToken)}`
  );
  const catData = (await catRes.json()) as { error?: { message?: string }; id?: string };
  if (catRes.ok && catData.id) {
    return { writable: true };
  }

  const getMsg = catData?.error?.message || "";
  if (isSmbBusinessTypeError(getMsg)) {
    return {
      writable: false,
      smbAccount: true,
      message:
        "This WhatsApp account is SMB type — Meta blocks catalog API uploads. " +
        "Link the catalog in WhatsApp Manager → Catalog, then add products via Commerce Manager " +
        "data feed (CSV) or upload manually. API sync from Shopify is not available for SMB accounts.",
    };
  }

  if (isMetaCatalogGraphBlockedError(getMsg)) {
    return {
      writable: false,
      message:
        `Catalog ${cid} is not reachable with your Meta token (${getMsg}). ` +
        "Use the Product Catalog ID from Commerce Manager → Catalogs (not a Store ID). " +
        "Assign your TSP system user to the client's Meta Business with Catalog access, " +
        "link the catalog to the WhatsApp number in WhatsApp Manager → Catalog, then retry.",
    };
  }

  // GET may fail on SMB while POST would too — probe items_batch with empty-ish payload
  const batchRes = await fetch(`${GRAPH}/${cid}/items_batch`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      item_type: "PRODUCT_ITEM",
      requests: [
        {
          method: "UPDATE",
          data: {
            id: "__helicoptic_write_probe__",
            title: "probe",
            availability: "in stock",
            condition: "new",
            price: formatMetaCatalogPrice(1),
            link: "https://example.com/probe",
          },
        },
      ],
    }),
  });
  const batchData = (await batchRes.json()) as { error?: { message?: string } };
  if (batchRes.ok) {
    return { writable: true };
  }

  const batchMsg = batchData?.error?.message || getMsg || "Meta catalog write check failed";
  if (isSmbBusinessTypeError(batchMsg)) {
    return {
      writable: false,
      smbAccount: true,
      message:
        "WhatsApp SMB account: Meta blocked catalog API upload. " +
        "Use Commerce Manager → Data sources (CSV feed) or add products manually.",
    };
  }

  return {
    writable: false,
    message: isMetaCatalogGraphBlockedError(batchMsg)
      ? `${batchMsg} — Confirm catalog ID, system user assignment on the client's Meta Business, and WhatsApp Manager catalog link.`
      : batchMsg,
  };
}
