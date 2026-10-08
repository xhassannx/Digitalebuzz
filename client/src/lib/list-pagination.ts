import { useCallback, useEffect, useMemo, useState } from "react";
import { coerceListApiResponse } from "@shared/list-pagination";

export { coerceListApiResponse } from "@shared/list-pagination";
export { fetchLegacyListApi, LEGACY_LIST_ITEM_KEYS } from "./legacy-list-api";

export type PaginatedListResponse<TItem, TKey extends string> = {
  total: number;
  limit: number;
  offset: number;
} & Record<TKey, TItem[]>;

export function parsePaginatedListResponse<TItem>(
  data: unknown,
  key: string
): { items: TItem[]; total: number; limit: number; offset: number } {
  const items = coerceListApiResponse<TItem>(data, key);
  if (Array.isArray(data)) {
    return { items, total: items.length, limit: items.length, offset: 0 };
  }
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    return {
      items,
      total: Number(obj.total) || items.length,
      limit: Number(obj.limit) || items.length,
      offset: Number(obj.offset) || 0,
    };
  }
  return { items: [], total: 0, limit: 0, offset: 0 };
}

export function useListPaginationState(initialRowsPerPage = 10) {
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(initialRowsPerPage);

  const resetPage = useCallback(() => setCurrentPage(1), []);

  const paginationParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("paginated", "1");
    params.set("limit", String(rowsPerPage));
    params.set("offset", String((currentPage - 1) * rowsPerPage));
    return params;
  }, [currentPage, rowsPerPage]);

  const totalPages = useCallback((total: number) => Math.max(1, Math.ceil(total / rowsPerPage)), [rowsPerPage]);

  return {
    currentPage,
    setCurrentPage,
    rowsPerPage,
    setRowsPerPage,
    resetPage,
    paginationParams,
    totalPages,
  };
}

/** Debounce search/filter text before hitting list APIs. */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
