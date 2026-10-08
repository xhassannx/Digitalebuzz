import type { CSSProperties } from "react";

type WhiteLabelLogoConfig = {
  logoUrl?: string;
  logoSize?: number | string;
};

type BrandingLogosConfig = {
  websiteLogo?: { url?: string; width?: string };
  panelLogo?: { url?: string; width?: string };
};

export type WhiteLabelWebsiteLogo = {
  logoUrl?: string;
  logoSize: number;
};

function parseLogoSize(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return undefined;
}

function clampLogoSize(value: number): number {
  return Math.max(20, Math.min(200, Math.round(value)));
}

/** Square logo box — matches website builder preview (width + height + object-fit contain). */
export function whiteLabelLogoImageStyle(logoSize: number, scale = 1): CSSProperties {
  const size = clampLogoSize(logoSize * scale);
  return {
    width: size,
    height: size,
    maxWidth: size,
    maxHeight: size,
    objectFit: "contain",
    display: "block",
    flexShrink: 0,
  };
}

/** Website logo URL + size from white-label-logo and branding-logos builder pages. */
export function resolveWhiteLabelWebsiteLogo(
  config: Record<string, unknown> | undefined,
  defaultSize = 40,
): WhiteLabelWebsiteLogo {
  const whiteLabelLogo = config?.["white-label-logo"] as WhiteLabelLogoConfig | undefined;
  const brandingLogos = config?.["branding-logos"] as BrandingLogosConfig | undefined;

  const logoUrl =
    whiteLabelLogo?.logoUrl?.trim() ||
    brandingLogos?.websiteLogo?.url?.trim() ||
    brandingLogos?.panelLogo?.url?.trim() ||
    undefined;

  const sizeFromWhiteLabel = parseLogoSize(whiteLabelLogo?.logoSize);
  const sizeFromBranding = parseLogoSize(brandingLogos?.websiteLogo?.width);
  const configuredSize = sizeFromWhiteLabel ?? sizeFromBranding ?? defaultSize;
  const logoSize = clampLogoSize(configuredSize);

  return { logoUrl, logoSize };
}

export function whiteLabelNavHeight(logoSize: number): number {
  return Math.max(64, clampLogoSize(logoSize) + 16);
}
