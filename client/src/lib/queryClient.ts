// @ts-nocheck
import { QueryClient, QueryFunction } from "@tanstack/react-query";
import {
  handleSessionExpired,
  isApiFetchBlocked,
  registerSessionExpiredCleanup,
} from "./auth-session";

const PANEL_BLOCKED_CODES = ["ACCOUNT_INACTIVE", "SUBSCRIPTION_EXPIRED", "ONBOARDING_OUTSTANDING_LIMIT"];

/** Base URL for API requests from Vite env. Set VITE_BASE_URL in production (e.g. https://helicopticsolutions.in). */
function getApiBaseUrl(): string {
  const env = import.meta.env?.VITE_BASE_URL;
  if (typeof env === "string" && env.trim()) return env.replace(/\/$/, "");
  return "";
}

/**
 * DB rows often store absolute production URLs (e.g. https://panel.example/uploads/...).
 * When you run the panel on localhost, fetch() and credentialed requests become cross-origin
 * and fail unless the remote site sends CORS headers (static uploads usually do not).
 * Paths that are always served by this app (/uploads, /api) are rewritten to the current origin.
 */
export function rewritePanelMediaUrlToCurrentOrigin(url: string): string {
  if (typeof window === "undefined") return url;
  if (!url.startsWith("http://") && !url.startsWith("https://")) return url;
  try {
    const u = new URL(url);
    const p = u.pathname;
    if (p.startsWith("/uploads/") || p.startsWith("/api/")) {
      return `${window.location.origin}${p}${u.search}`;
    }
  } catch {
    // ignore invalid URL
  }
  return url;
}

/** Resolve URL for fetch: use relative path when base equals current origin so API always hits same server. */
export function resolveApiUrl(url: string): string {
  const base = getApiBaseUrl();
  if (!base) return url;
  // When base is same as current origin or running locally, use relative URL to avoid cross-origin issues
  try {
    const baseOrigin = new URL(base).origin;
    if (
      typeof window !== "undefined" &&
      (window.location?.origin === baseOrigin ||
        window.location?.hostname === "localhost" ||
        window.location?.hostname === "127.0.0.1")
    ) {
      return url;
    }
  } catch {
    // ignore invalid base URL
  }
  return url.startsWith("/") ? base + url : url;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    if (res.status === 401) {
      handleSessionExpired();
    }
    const text = (await res.text()) || res.statusText;
    let err: Error & { code?: string } = new Error(`${res.status}: ${text}`);
    try {
      const json = JSON.parse(text);
      // Prefer detailed `message` when both exist (e.g. { error: "Creation failed", message: "Meta: …" })
      const detailMsg =
        typeof json.message === "string" && json.message.trim() ? json.message.trim() : undefined;
      const shortErr =
        typeof json.error === "string" && json.error.trim() ? json.error.trim() : undefined;
      const msg = detailMsg ?? shortErr;
      if (typeof msg === "string") {
        err = new Error(msg) as Error & { code?: string };
        if (json.code) err.code = json.code;
      }
      if (res.status === 404) {
        const base = getApiBaseUrl();
        const hint =
          !base && typeof window !== "undefined" && !window.location?.hostname?.includes("localhost")
            ? " On production, set VITE_BASE_URL to your panel URL (e.g. https://helicopticsolutions.in)."
            : "";
        err = new Error((msg ?? "API endpoint not found") + hint) as Error & { code?: string };
      }
      if (res.status === 403 && json.code && PANEL_BLOCKED_CODES.includes(json.code)) {
        window.dispatchEvent(
          new CustomEvent("panel-blocked", {
            detail: {
              code: json.code,
              error: json.error || msg || "Access denied.",
              expired_at: json.expired_at,
              data_deletion_at: json.data_deletion_at,
              retention_days: json.retention_days,
            },
          })
        );
      } else if (res.status === 403 && typeof json.message === "string") {
        window.dispatchEvent(
          new CustomEvent("api-permission-denied", { detail: { message: json.message } })
        );
      }
    } catch {
      // use default err
    }
    throw err;
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  if (isApiFetchBlocked()) {
    throw new Error("Session expired");
  }
  const fullUrl = resolveApiUrl(url);
  const res = await fetch(fullUrl, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;
    if (isApiFetchBlocked()) {
      if (unauthorizedBehavior === "returnNull") {
        return null as T;
      }
      throw new Error("Session expired");
    }
    const res = await fetch(resolveApiUrl(url), {
      credentials: "include",
    });

    if (res.status === 401) {
      handleSessionExpired();
      if (isApiFetchBlocked() || unauthorizedBehavior === "returnNull") {
        return null as T;
      }
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      gcTime: 5 * 60 * 1000, // 5 min - garbage collect unused cache to prevent "Out of Memory" / Aw Snap
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

registerSessionExpiredCleanup(() => {
  queryClient.setQueryData(["/api/auth/user"], null);
  void queryClient.cancelQueries();
});
