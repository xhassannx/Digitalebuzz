const GRAPH_API_VERSION = "v23.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export type MetaCatalogBatchRequest = {
  method: "UPDATE" | "DELETE";
  data: Record<string, unknown>;
};

/** Push product rows to Meta Commerce catalog via items_batch. */
export async function pushMetaCatalogBatch(
  catalogId: string,
  accessToken: string,
  requests: MetaCatalogBatchRequest[]
): Promise<{ synced: number; errors: string[] }> {
  if (!requests.length) {
    return { synced: 0, errors: [] };
  }

  const batchRes = await fetch(`${GRAPH_BASE}/${catalogId}/items_batch`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      item_type: "PRODUCT_ITEM",
      requests,
    }),
  });
  const batchData = await batchRes.json();
  if (!batchRes.ok) {
    throw new Error(batchData?.error?.message || "Meta catalog batch sync failed");
  }

  const errors: string[] = [];
  if (Array.isArray(batchData?.handles) && batchData.handles.length === 0 && batchData?.error) {
    errors.push(String(batchData.error.message || batchData.error));
  }

  return { synced: requests.length, errors };
}
