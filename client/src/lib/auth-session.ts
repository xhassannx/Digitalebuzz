/** True after a successful /api/auth/user load in this tab (session was valid). */
let hadAuthenticatedSession = false;
let sessionExpiredHandled = false;
let redirectInProgress = false;

let onSessionExpiredCleanup: (() => void) | null = null;

/** Register React Query cleanup (called from queryClient module init). */
export function registerSessionExpiredCleanup(fn: () => void): void {
  onSessionExpiredCleanup = fn;
}

const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/admin/login",
  "/licensor-access",
  "/pay/",
  "/book/",
  "/support/ticket",
  "/subscribe",
  "/project-api",
  "/partner-with-us",
  "/privacy",
  "/terms",
  "/service-level-agreement",
  "/refund-policy",
  "/about",
  "/pricing",
  "/contact",
  "/features",
  "/testimonials",
  "/free-trial",
  "/white-label",
];

const PROTECTED_PATH_PREFIXES = [
  "/chat",
  "/dashboard",
  "/connect",
  "/send",
  "/groups",
  "/contacts",
  "/transactions",
  "/campaigns",
  "/templates",
  "/flows",
  "/tags",
  "/canned-messages",
  "/columns",
  "/integrations",
  "/commerce",
  "/settings",
  "/billing",
  "/organizations",
  "/gallery",
  "/faq",
  "/chatbots",
  "/ai-assistants",
  "/reminders",
  "/opts",
  "/webhooks",
  "/admin",
  "/support",
  "/my-support",
  "/api-docs",
  "/website-builder",
];

function currentPath(): string {
  if (typeof window === "undefined") return "/";
  return window.location.pathname || "/";
}

function isPublicMarketingOrAuthPath(path: string): boolean {
  if (path === "/") return true;
  return PUBLIC_PATH_PREFIXES.some((p) => path === p || path.startsWith(p));
}

function isProtectedPanelPath(path: string): boolean {
  if (path.startsWith("/admin/login")) return false;
  return PROTECTED_PATH_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

export function markAuthenticatedSession(): void {
  hadAuthenticatedSession = true;
  sessionExpiredHandled = false;
}

export function resetAuthSessionTracking(): void {
  hadAuthenticatedSession = false;
  sessionExpiredHandled = false;
  redirectInProgress = false;
}

/** After session expiry handling starts, block further API fetches in this tab. */
export function isApiFetchBlocked(): boolean {
  return sessionExpiredHandled || redirectInProgress;
}

function shouldForceLoginRedirect(): boolean {
  const path = currentPath();
  if (isPublicMarketingOrAuthPath(path) && !hadAuthenticatedSession) {
    return false;
  }
  if (hadAuthenticatedSession) return true;
  return isProtectedPanelPath(path);
}

function loginRedirectUrl(): string {
  const path = currentPath();
  const search = typeof window !== "undefined" ? window.location.search : "";
  const returnTo = `${path}${search}`;
  if (!returnTo || returnTo === "/" || returnTo.startsWith("/login")) {
    return "/login";
  }
  return `/login?redirect=${encodeURIComponent(returnTo)}`;
}

/**
 * Session expired or invalid — clear client state once and send user to login.
 * Safe to call from many parallel 401 responses; only runs once per expiry.
 */
export function handleSessionExpired(): void {
  if (sessionExpiredHandled || redirectInProgress) return;
  if (!shouldForceLoginRedirect()) return;

  sessionExpiredHandled = true;
  redirectInProgress = true;

  const url = loginRedirectUrl();

  try {
    onSessionExpiredCleanup?.();
  } catch {
    /* ignore */
  }

  void fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
    keepalive: true,
  });

  window.location.replace(url);
}
