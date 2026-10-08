import type { Express, Request, Response } from "express";

const DEFAULT_PWA_ICON = "/logo-main.png";

/** Matches client `getPublicTemplateId` — from root `.env` `VITE_TEMPLATE_ID` or `TEMPLATE_ID`. */
export function getPublicTemplateIdFromEnv(): number {
  const raw = process.env.VITE_TEMPLATE_ID || process.env.TEMPLATE_ID || "1";
  const n = Number.parseInt(String(raw), 10);
  return Number.isFinite(n) ? n : 1;
}

/** Templates 3 (login landing) and 4 (white-label marketing) use org branding for favicon / link previews. */
export function shouldInjectPublicBrandingMeta(): boolean {
  const id = getPublicTemplateIdFromEnv();
  return id === 3 || id === 4;
}

export type PublicBrandingAssets = {
  faviconUrl?: string;
  ogImageUrl?: string;
  /** Website Builder branding logo — used for PWA install / home-screen icon. */
  pwaIconUrl?: string;
};

type WebManifestIcon = {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
};

type WebManifestShortcut = {
  name: string;
  short_name: string;
  description: string;
  url: string;
  icons: WebManifestIcon[];
};

type WebManifest = {
  id: string;
  name: string;
  short_name: string;
  description: string;
  start_url: string;
  scope: string;
  display: string;
  display_override: string[];
  background_color: string;
  theme_color: string;
  orientation: string;
  icons: WebManifestIcon[];
  categories: string[];
  shortcuts: WebManifestShortcut[];
};

const DEFAULT_WEB_MANIFEST: WebManifest = {
  id: "/",
  name: "Business Inbox",
  short_name: "Inbox",
  description: "WhatsApp inbox, chatbots, and automation for your business",
  start_url: "/chat?utm_source=homescreen",
  scope: "/",
  display: "standalone",
  display_override: ["standalone", "minimal-ui"],
  background_color: "#f9f9ff",
  theme_color: "#0059bb",
  orientation: "any",
  icons: [
    { src: DEFAULT_PWA_ICON, sizes: "192x192", type: "image/png", purpose: "any" },
    { src: DEFAULT_PWA_ICON, sizes: "512x512", type: "image/png", purpose: "any" },
    { src: DEFAULT_PWA_ICON, sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
  categories: ["business", "productivity", "communication"],
  shortcuts: [
    {
      name: "Inbox",
      short_name: "Inbox",
      description: "Open inbox",
      url: "/chat?utm_source=shortcut",
      icons: [{ src: DEFAULT_PWA_ICON, sizes: "192x192", type: "image/png" }],
    },
    {
      name: "Connect",
      short_name: "Connect",
      description: "Manage WhatsApp numbers",
      url: "/connect?utm_source=shortcut",
      icons: [{ src: DEFAULT_PWA_ICON, sizes: "192x192", type: "image/png" }],
    },
  ],
};

function trimUrl(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function extractPublicBrandingAssets(
  config: Record<string, Record<string, unknown>>,
): PublicBrandingAssets {
  const wl = config["white-label-logo"] as { logoUrl?: string; faviconUrl?: string } | undefined;
  const branding = config["branding-logos"] as {
    favicon?: { url?: string };
    websiteLogo?: { url?: string };
    panelLogo?: { url?: string };
  } | undefined;

  const websiteLogo =
    trimUrl(wl?.logoUrl) ||
    trimUrl(branding?.websiteLogo?.url) ||
    trimUrl(branding?.panelLogo?.url);

  const faviconOnly = trimUrl(wl?.faviconUrl) || trimUrl(branding?.favicon?.url);

  return {
    ogImageUrl: websiteLogo,
    // Tab icon prefers a dedicated favicon; otherwise use the branding logo.
    faviconUrl: faviconOnly || websiteLogo,
    // Chrome "Install app" uses the website branding logo first.
    pwaIconUrl: websiteLogo || faviconOnly,
  };
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

export function absolutePublicAssetUrl(
  url: string,
  req?: Pick<Request, "protocol" | "get">,
): string {
  if (/^https?:\/\//i.test(url)) return url;
  const proto = (req?.get("x-forwarded-proto") || req?.protocol || "https").split(",")[0].trim();
  const host = (req?.get("x-forwarded-host") || req?.get("host") || "localhost").split(",")[0].trim();
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${proto}://${host}${path}`;
}

/** Prefer same-origin relative paths so the PWA install dialog can fetch the icon. */
export function manifestIconSrc(
  url: string,
  req?: Pick<Request, "protocol" | "get">,
): string {
  if (url.startsWith("/")) return url;
  return absolutePublicAssetUrl(url, req);
}

export function mimeTypeForIconUrl(url: string): string {
  const path = url.split("?")[0].toLowerCase();
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".gif")) return "image/gif";
  if (path.endsWith(".ico")) return "image/x-icon";
  return "image/png";
}

function rewriteManifestIcons(icons: WebManifestIcon[], src: string, type: string): WebManifestIcon[] {
  return icons.map((icon) =>
    String(icon.src).includes("logo-main") ? { ...icon, src, type } : icon,
  );
}

export function buildPublicWebManifest(
  assets: PublicBrandingAssets,
  req?: Pick<Request, "protocol" | "get">,
): WebManifest {
  const manifest = structuredClone(DEFAULT_WEB_MANIFEST);
  const iconUrl = assets.pwaIconUrl || assets.faviconUrl;
  if (!iconUrl) return manifest;

  const src = manifestIconSrc(iconUrl, req);
  const type = mimeTypeForIconUrl(iconUrl);
  manifest.icons = rewriteManifestIcons(manifest.icons, src, type);
  manifest.shortcuts = manifest.shortcuts.map((shortcut) => ({
    ...shortcut,
    icons: rewriteManifestIcons(shortcut.icons, src, type),
  }));
  return manifest;
}

/**
 * Strip default Helicoptic icons and inject org favicon / apple-touch-icon when a branding logo exists.
 * OG images still apply for templates 3/4 only.
 */
export function injectPublicBrandingIntoIndexHtml(
  html: string,
  assets: PublicBrandingAssets,
  req?: Pick<Request, "protocol" | "get">,
): string {
  const headIcon = assets.faviconUrl || assets.pwaIconUrl;
  const injectOg = shouldInjectPublicBrandingMeta() && !!assets.ogImageUrl;
  if (!headIcon && !injectOg) return html;

  let out = html;
  if (headIcon) {
    out = out.replace(/\s*<link rel="icon"[^>]*href="\/logo-main\.png"[^>]*\/?>\s*/gi, "\n");
    out = out.replace(/\s*<link rel="apple-touch-icon"[^>]*href="\/logo-main\.png"[^>]*\/?>\s*/gi, "\n");
  }
  if (injectOg) {
    out = out.replace(/\s*<meta property="og:image"[^>]*\/?>\s*/gi, "\n");
    out = out.replace(/\s*<meta name="twitter:image"[^>]*\/?>\s*/gi, "\n");
  }

  const inserts: string[] = [];
  if (headIcon) {
    const href = absolutePublicAssetUrl(headIcon, req);
    const type = mimeTypeForIconUrl(headIcon);
    inserts.push(`<link rel="icon" type="${escapeAttr(type)}" href="${escapeAttr(href)}" data-public-branding="icon" />`);
    inserts.push(`<link rel="apple-touch-icon" href="${escapeAttr(href)}" data-public-branding="apple" />`);
  }
  if (injectOg && assets.ogImageUrl) {
    const href = absolutePublicAssetUrl(assets.ogImageUrl, req);
    inserts.push(`<meta property="og:image" content="${escapeAttr(href)}" data-public-branding="og-image" />`);
    inserts.push(`<meta name="twitter:image" content="${escapeAttr(href)}" data-public-branding="twitter-image" />`);
  }

  if (inserts.length > 0) {
    out = out.replace("</head>", `    ${inserts.join("\n    ")}\n  </head>`);
  }
  return out;
}

export async function loadPublicBrandingAssets(): Promise<PublicBrandingAssets> {
  try {
    let organizationId =
      process.env.WHITELABEL_ORG_ID || process.env.VITE_WHITELABEL_ORG_ID || null;
    if (!organizationId) {
      const { storage } = await import("./storage");
      const allOrgs = await storage.getAllOrganizations();
      organizationId = allOrgs[0]?.id ?? null;
    }
    if (!organizationId) return {};

    const { storage } = await import("./storage");
    const config = await storage.getWebsiteBuilderConfigForOrg(organizationId);
    return extractPublicBrandingAssets(config);
  } catch {
    return {};
  }
}

/** Served instead of the static Helicoptic `client/public/manifest.json`. */
export function registerPublicWebManifestRoute(app: Express): void {
  const sendManifest = async (req: Request, res: Response) => {
    try {
      const assets = await loadPublicBrandingAssets();
      const manifest = buildPublicWebManifest(assets, req);
      res.set({
        "Content-Type": "application/manifest+json; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      });
      res.json(manifest);
    } catch {
      res.set({
        "Content-Type": "application/manifest+json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.json(DEFAULT_WEB_MANIFEST);
    }
  };

  app.get("/manifest.json", sendManifest);
  app.head("/manifest.json", sendManifest);
}
