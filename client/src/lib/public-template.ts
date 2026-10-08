import { useEffect } from "react";

/** Matches vite.config / root `.env` `VITE_TEMPLATE_ID` or `TEMPLATE_ID`. */
export function getPublicTemplateId(): number {
  const raw = import.meta.env.VITE_TEMPLATE_ID;
  const n = Number.parseInt(String(raw ?? "1"), 10);
  return Number.isFinite(n) ? n : 1;
}

/**
 * Gradient + WhiteLabelHeader login/signup chrome: **template 4 only** (white-label landing), when org config exists.
 * Templates 1–3 use the standard simple auth layout (green primary button, minimal shell).
 */
export function shouldShowWhiteLabelAuthChrome(
  _organizationId?: string | null | undefined,
): boolean {
  return getPublicTemplateId() === 4;
}

/** Remove legacy `from=white-label` from URL when using template 4 so `/login` stays clean. */
export function useStripLegacyWhiteLabelAuthQuery(): void {
  useEffect(() => {
    if (getPublicTemplateId() !== 4) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("from") !== "white-label") return;
    params.delete("from");
    const qs = params.toString();
    const path = window.location.pathname;
    window.history.replaceState({}, "", qs ? `${path}?${qs}` : path);
  }, []);
}

/** Primary marketing CTA — template 4 signup (legacy /free-trial redirects here). */
export function wlSignupHref(link?: string | null): string {
  if (!link || link === "/free-trial") return "/signup";
  return link;
}
export type WlMarketingSegment =
  | ""
  | "about"
  | "features"
  | "pricing"
  | "testimonials"
  | "contact"
  | "privacy"
  | "terms";

/**
 * Template 4: paths are `/features`, `/pricing`, … (no `/white-label` prefix).
 * Other templates: keep legacy `/white-label/...` URLs for the WL site chrome.
 */
export function wlMarketingHref(segment: WlMarketingSegment): string {
  if (getPublicTemplateId() === 4) {
    if (!segment) return "/";
    return `/${segment}`;
  }
  if (!segment) return "/white-label";
  return `/white-label/${segment}`;
}

/** Full-screen marketing (no app sidebar) for template 4 at clean paths.
 * Omit `/`: when logged in, `/` is the panel dashboard and must keep the sidebar. */
export function isTemplate4MarketingFullscreenPath(pathname: string): boolean {
  if (getPublicTemplateId() !== 4) return false;
  const p = (pathname.split("?")[0].replace(/\/$/, "") || "/") as string;
  const full = new Set([
    "/features",
    "/pricing",
    "/about",
    "/testimonials",
    "/contact",
    "/privacy",
    "/terms",
    "/login",
    "/signup",
    "/forgot-password",
    "/free-trial",
    "/subscribe",
  ]);
  return full.has(p);
}
