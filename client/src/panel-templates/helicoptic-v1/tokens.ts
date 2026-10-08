/**
 * Atlas layout (helicoptic-v1) — Rh-whatsapp Emerald Green
 * https://www.figma.com/design/ghxCXiMgnQ5J8IGhPvTPMx/Rh-whatsapp
 *
 * Shares the RateHonk panel shell with Nova; brand tokens are emerald.
 */
export const tokens = {
  colors: {
    brand: "#047857",
    brandHover: "#065f46",
    brandLight: "#d1fae5",
    brandSoft: "#ecfdf5",
    sidebarBg: "#ffffff",
    headerBg: "#ffffff",
    pageBg: "#f5f5f5",
    cardBg: "#ffffff",
    textPrimary: "#374151",
    textSecondary: "#4b5563",
    textMuted: "#6b7280",
    textPlaceholder: "#9ca3af",
    border: "#e5e7eb",
    success: "#51c85f",
    danger: "#dc2626",
    ctaText: "#ffffff",
    /** Soft active nav (Emerald “Refined Aesthetic” Figma) */
    navActiveBg: "#d1fae5",
    navActiveFg: "#047857",
  },
  layout: {
    sidebarWidth: "280px",
    headerHeight: "64px",
    navRadius: "8px",
  },
  font: {
    sans: '"Inter", system-ui, -apple-system, sans-serif',
  },
} as const;

/** CSS custom properties applied when Atlas (Emerald) is active. */
export const atlasCssVars: Record<string, string> = {
  "--rh-brand": tokens.colors.brand,
  "--rh-brand-hover": tokens.colors.brandHover,
  "--rh-brand-light": tokens.colors.brandLight,
  "--rh-brand-soft": tokens.colors.brandSoft,
  "--rh-nav-active-bg": tokens.colors.navActiveBg,
  "--rh-nav-active-fg": tokens.colors.navActiveFg,
  "--sidebar-accent": "160 84% 90%",
  "--sidebar-accent-foreground": "160 84% 25%",
  "--panel-brand": tokens.colors.brand,
  "--panel-brand-hover": tokens.colors.brandHover,
  "--primary": "160 94% 24%",
  "--primary-foreground": "0 0% 100%",
  "--ring": "160 94% 24%",
};
