import { coerceListApiResponse } from "@shared/list-pagination";
import { apiRequest } from "./queryClient";

/** Response item keys for Manage list APIs that support optional pagination. */
export const LEGACY_LIST_ITEM_KEYS = {
  contacts: "contacts",
  tags: "tags",
  columns: "columns",
  campaigns: "campaigns",
  groups: "groups",
  templates: "templates",
  flows: "flows",
  webhooks: "webhooks",
  cannedMessages: "cannedMessages",
  transactions: "transactions",
} as const;

export type LegacyListItemKey = (typeof LEGACY_LIST_ITEM_KEYS)[keyof typeof LEGACY_LIST_ITEM_KEYS];

/**
 * Fetch a list endpoint without `paginated=1`.
 * Always returns a plain array so pickers, dashboards, and inbox code stay safe.
 */
export async function fetchLegacyListApi<T>(
  url: string,
  itemsKey: LegacyListItemKey
): Promise<T[]> {
  const res = await apiRequest("GET", url);
  return coerceListApiResponse<T>(await res.json(), itemsKey);
}

export { coerceListApiResponse };
