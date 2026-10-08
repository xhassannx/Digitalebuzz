/** Shared list pagination types for Manage section APIs and UI. */

export type ListPaginationParams = {
  limit: number;
  offset: number;
};

export type PaginatedListResult<T> = ListPaginationParams & {
  total: number;
  items: T[];
};

export type PaginatedApiResponse<TItem, TKey extends string = "items"> = ListPaginationParams & {
  total: number;
} & Record<TKey, TItem[]>;

const DEFAULT_LIMIT = 25;
const DEFAULT_MAX_LIMIT = 200;

/** Contacts list allows larger pages (e.g. show entire org directory in one view). */
export const CONTACTS_MAX_PAGE_SIZE = 5000;

export function parseListPaginationQuery(
  query: Record<string, unknown> | undefined,
  opts?: { defaultLimit?: number; maxLimit?: number }
): ListPaginationParams {
  const defaultLimit = opts?.defaultLimit ?? DEFAULT_LIMIT;
  const maxLimit = opts?.maxLimit ?? DEFAULT_MAX_LIMIT;

  let limit = Number.parseInt(String(query?.limit ?? defaultLimit), 10);
  let offset = Number.parseInt(String(query?.offset ?? 0), 10);

  if (!Number.isFinite(limit) || limit < 1) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;
  if (!Number.isFinite(offset) || offset < 0) offset = 0;

  return { limit, offset };
}

/** True when client wants `{ items, total, limit, offset }` instead of a bare array. */
export function isPaginatedListRequest(query: Record<string, unknown> | undefined): boolean {
  if (!query) return false;
  return query.paginated === "1" || query.paginated === "true";
}

/** Normalize list API JSON to a plain array (legacy bare array or paginated wrapper). */
export function coerceListApiResponse<T>(data: unknown, itemsKey: string): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const items = (data as Record<string, unknown>)[itemsKey];
    if (Array.isArray(items)) return items as T[];
  }
  return [];
}

export function paginateArray<T>(items: T[], pagination: ListPaginationParams): PaginatedListResult<T> {
  const total = items.length;
  const slice = items.slice(pagination.offset, pagination.offset + pagination.limit);
  return {
    items: slice,
    total,
    limit: pagination.limit,
    offset: pagination.offset,
  };
}

export function buildPaginatedResponse<TItem, TKey extends string>(
  key: TKey,
  result: PaginatedListResult<TItem>
): PaginatedApiResponse<TItem, TKey> {
  return {
    [key]: result.items,
    total: result.total,
    limit: result.limit,
    offset: result.offset,
  } as PaginatedApiResponse<TItem, TKey>;
}
