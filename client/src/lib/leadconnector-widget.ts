import { getPublicTemplateId } from "@/lib/public-template";

const WIDGET_ID = "67dbca4d0d1911e3bcb3e7e4";
const HIDE_STYLE_ID = "hide-leadconnector-panel-widget";

/** Authenticated panel routes — no third-party chat bubble over inbox composer */
const PANEL_PATH_PREFIXES = [
  "/chat",
  "/dashboard",
  "/connect",
  "/contacts",
  "/settings",
  "/integrations",
  "/reminders",
  "/groups",
  "/flows",
  "/templates",
  "/campaigns",
  "/drip-campaigns",
  "/gallery",
  "/canned",
  "/send-message",
  "/chatbots",
  "/ai-assistants",
  "/faq-bot",
  "/my-support",
  "/api-docs",
  "/webhook-events",
  "/admin",
  "/licensor",
  "/onboarding",
  "/billing",
  "/wallet",
  "/website",
];

export function isPanelAppPath(pathname: string = typeof window !== "undefined" ? window.location.pathname : ""): boolean {
  return PANEL_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function ensureHideStyle(): HTMLStyleElement {
  let style = document.getElementById(HIDE_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = HIDE_STYLE_ID;
    style.textContent = `
      body[data-panel-app="true"] #chat-widget-container,
      body[data-panel-app="true"] #lc_chat-widget,
      body[data-panel-app="true"] .lc_text-widget,
      body[data-panel-app="true"] [id^="lc_"],
      body[data-panel-app="true"] [class*="lc_text-widget"],
      body[data-panel-app="true"] [class*="leadconnector"],
      body[data-panel-app="true"] iframe[src*="leadconnectorhq.com"] {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
        opacity: 0 !important;
      }
    `;
    document.head.appendChild(style);
  }
  return style;
}

/** Hide LeadConnector bubble on panel; show on public marketing pages */
export function syncLeadConnectorWidgetVisibility(
  pathname?: string,
  options?: { forcePanelApp?: boolean },
): void {
  if (typeof document === "undefined") return;
  const path = pathname ?? window.location.pathname;
  const hide = options?.forcePanelApp === true || isPanelAppPath(path);
  document.body.dataset.panelApp = hide ? "true" : "false";
  if (hide) {
    ensureHideStyle();
  } else {
    document.getElementById(HIDE_STYLE_ID)?.remove();
  }
}

/** LeadConnector chat widget — only for public template 2, not on authenticated panel */
export function loadLeadConnectorWidgetIfTemplate2(): void {
  if (typeof document === "undefined") return;
  if (getPublicTemplateId() !== 2) return;
  if (isPanelAppPath()) return;
  if (document.querySelector(`script[data-widget-id="${WIDGET_ID}"]`)) return;

  const s = document.createElement("script");
  s.src = "https://widgets.leadconnectorhq.com/loader.js";
  s.async = true;
  s.setAttribute(
    "data-resources-url",
    "https://widgets.leadconnectorhq.com/chat-widget/loader.js",
  );
  s.setAttribute("data-widget-id", WIDGET_ID);
  document.body.appendChild(s);
}
