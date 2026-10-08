import { useEffect } from "react";
import { getPublicTemplateId } from "@/lib/public-template";

type BrandingConfig = {
  "white-label-logo"?: { logoUrl?: string; faviconUrl?: string };
  "branding-logos"?: {
    favicon?: { url?: string };
    websiteLogo?: { url?: string };
    panelLogo?: { url?: string };
  };
};

const DATA_ATTR = "data-public-branding";

function clearBrandingHeadTags() {
  document.querySelectorAll(`link[${DATA_ATTR}], meta[${DATA_ATTR}]`).forEach((el) => el.remove());
  document
    .querySelectorAll('link[rel="icon"][href="/logo-main.png"], link[rel="apple-touch-icon"][href="/logo-main.png"]')
    .forEach((el) => el.remove());
}

function upsertLink(rel: string, href: string, marker: string) {
  const existing = document.querySelector(`link[${DATA_ATTR}="${marker}"]`) as HTMLLinkElement | null;
  if (existing) {
    existing.href = href;
    return;
  }
  const link = document.createElement("link");
  link.rel = rel;
  link.href = href;
  link.setAttribute(DATA_ATTR, marker);
  document.head.appendChild(link);
}

function upsertMeta(property: string, content: string, marker: string) {
  let el = document.querySelector(`meta[${DATA_ATTR}="${marker}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    if (property.startsWith("og:")) {
      el.setAttribute("property", property);
    } else {
      el.setAttribute("name", property);
    }
    el.setAttribute(DATA_ATTR, marker);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

/**
 * Apply favicon / apple-touch-icon from Website Builder branding logo.
 * WhatsApp crawlers rely on server-injected HTML; this keeps the browser tab in sync after SPA load.
 * The Chrome "Install app" icon comes from GET /manifest.json (server), not these tags.
 */
export function usePublicBrandingHead() {
  useEffect(() => {
    const templateId = getPublicTemplateId();
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/public/white-label/config", { credentials: "include" });
        if (!res.ok || cancelled) return;
        const config = (await res.json()) as BrandingConfig;

        const wl = config["white-label-logo"];
        const branding = config["branding-logos"];
        const websiteLogo =
          wl?.logoUrl?.trim() ||
          branding?.websiteLogo?.url?.trim() ||
          branding?.panelLogo?.url?.trim();
        const faviconUrl =
          wl?.faviconUrl?.trim() || branding?.favicon?.url?.trim() || websiteLogo;
        const ogImageUrl = websiteLogo;

        if (cancelled) return;

        clearBrandingHeadTags();

        if (faviconUrl) {
          upsertLink("icon", faviconUrl, "icon");
          upsertLink("apple-touch-icon", faviconUrl, "apple");
        }
        if (ogImageUrl && (templateId === 3 || templateId === 4)) {
          upsertMeta("og:image", ogImageUrl, "og-image");
          upsertMeta("twitter:image", ogImageUrl, "twitter-image");
        }
      } catch {
        /* ignore — server HTML injection is the source of truth for crawlers */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}
