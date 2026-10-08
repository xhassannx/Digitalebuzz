/**
 * Nova (Classic Blue) brand tokens for the shared RateHonk shell.
 * Atlas (Emerald) overrides these via CSS vars on html[data-panel-template="helicoptic-v1"].
 */
export const novaCssVars: Record<string, string> = {
  "--rh-brand": "#0059bb",
  "--rh-brand-hover": "#004a9a",
  "--rh-brand-light": "#dfe8ff",
  "--rh-brand-soft": "#e8f0fe",
  "--rh-nav-active-bg": "#dfe8ff",
  "--rh-nav-active-fg": "#0059bb",
  "--panel-brand": "#0059bb",
  "--panel-brand-hover": "#004a9a",
  "--primary": "211 100% 37%",
  "--primary-foreground": "0 0% 100%",
  "--ring": "211 100% 37%",
};

/**
 * Nova layout (ratehonk-v1) — Figma Untitled file
 * https://www.figma.com/design/Ho7aZJvanQlVi88TwsSZjx/Untitled
 */
export const tokens = {
  colors: {
    brand: "var(--rh-brand, #0059bb)",
    brandLight: "var(--rh-brand-light, #dfe8ff)",
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
