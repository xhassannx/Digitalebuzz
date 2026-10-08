import type { Request } from "express";
import {
  buildPaginatedResponse,
  coerceListApiResponse,
  CONTACTS_MAX_PAGE_SIZE,
  isPaginatedListRequest,
  paginateArray,
  parseListPaginationQuery,
  type ListPaginationParams,
  type PaginatedListResult,
} from "@shared/list-pagination";

export {
  buildPaginatedResponse,
  coerceListApiResponse,
  CONTACTS_MAX_PAGE_SIZE,
  isPaginatedListRequest,
  paginateArray,
  parseListPaginationQuery,
  type ListPaginationParams,
  type PaginatedListResult,
};

export function parseListSearch(query: Record<string, unknown> | undefined): string {
  const raw = query?.search;
  return typeof raw === "string" ? raw.trim() : "";
}

export function listPaginationFromRequest(
  req: Request,
  opts?: { defaultLimit?: number; maxLimit?: number }
): ListPaginationParams {
  return parseListPaginationQuery(req.query as Record<string, unknown>, opts);
}

/** Paginated JSON object, or legacy bare array when `paginated=1` is omitted. */
export function respondOrgList<T>(
  res: import("express").Response,
  req: Request,
  key: string,
  items: T[]
): void {
  if (!isPaginatedListRequest(req.query as Record<string, unknown>)) {
    res.json(items);
    return;
  }
  const pagination = listPaginationFromRequest(req);
  const page = paginateArray(items, pagination);
  res.json(buildPaginatedResponse(key, page));
}
