import { isPanelAppPath } from "@/lib/leadconnector-widget";

const SCRIPT_ATTR = "data-helicoptic-wa-widget";
const WIDGET_ROOT_ID = "helicoptic-wa-widget-root";

declare global {
  interface Window {
    __helicopticWaWidgetLoaded?: boolean;
  }
}

function getOrganizationIdHint(): string | null {
  if (typeof window === "undefined") return null;
  const fromEnv = import.meta.env.VITE_WHITELABEL_ORG_ID as string | undefined;
  if (fromEnv?.trim()) return fromEnv.trim();
  const fromUrl = new URLSearchParams(window.location.search).get("organizationId");
  if (fromUrl?.trim()) return fromUrl.trim();
  return null;
}

async function resolvePublicOrganizationId(): Promise<string | null> {
  const hint = getOrganizationIdHint();
  if (hint) return hint;
  try {
    const res = await fetch("/api/public/white-label/config", { credentials: "include" });
    if (!res.ok) return null;
    const data = (await res.json()) as { organizationId?: string };
    return data.organizationId?.trim() || null;
  } catch {
    return null;
  }
}

function removeWhatsAppChatWidget(): void {
  document
    .querySelectorAll(
      `script[${SCRIPT_ATTR}], script#helicoptic-wa-widget, script[src*="whatsapp-chat-widget"]`,
    )
    .forEach((el) => el.remove());
  document.getElementById(WIDGET_ROOT_ID)?.remove();
  window.__helicopticWaWidgetLoaded = false;
}

export { removeWhatsAppChatWidget };

function appendWidgetScript(src: string): void {
  if (document.querySelector(`script[${SCRIPT_ATTR}]`)) return;

  const run = () => {
    if (!document.body) return;
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.setAttribute(SCRIPT_ATTR, "true");
    document.body.appendChild(s);
  };

  if (document.body) {
    run();
  } else {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  }
}

/** Loads org WhatsApp chat widget on public (logged-out) pages only. */
export async function syncWhatsAppChatWidget(
  pathname: string = typeof window !== "undefined" ? window.location.pathname : "",
  options?: { isAuthenticated?: boolean },
): Promise<void> {
  if (typeof document === "undefined") return;

  if (options?.isAuthenticated || isPanelAppPath(pathname)) {
    removeWhatsAppChatWidget();
    return;
  }

  const organizationId = await resolvePublicOrganizationId();
  const qs = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : "";
  appendWidgetScript(`/api/public/whatsapp-chat-widget/active.js${qs}`);
}

/** @deprecated Use syncWhatsAppChatWidget from App — kept for compatibility */
export function loadWhatsAppChatWidgetOnPublicPages(): void {
  void syncWhatsAppChatWidget();
}
