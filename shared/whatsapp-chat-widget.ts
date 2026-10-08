export type WhatsAppWidgetPosition = "bottom-right" | "bottom-left";

export interface WhatsAppChatWidgetPhoneOption {
  sessionId: string;
  phoneNumber: string;
  displayPhoneNumber: string;
  verifiedName: string;
  connectionType: "official" | "unofficial";
}

export interface WhatsAppChatWidgetConfig {
  enabled: boolean;
  widgetPublicId?: string;
  /** Connected inbox session used for this widget */
  sessionId?: string;
  /** connected = inbox line; manual = typed number for wa.me / embed */
  phoneInputMode?: "connected" | "manual";
  phoneNumber: string;
  button: {
    backgroundColor: string;
    ctaText: string;
    marginBottom: number;
    marginLeft: number;
    marginRight: number;
    borderRadius: number;
    position: WhatsAppWidgetPosition;
    defaultMessage: string;
  };
  panel: {
    brandName: string;
    brandSubtitle: string;
    brandColor: string;
    brandImageUrl: string;
    buttonText: string;
    defaultMessage: string;
    openOnButtonClick: boolean;
    showByDefault: boolean;
    showDelaySeconds: number;
    /** live = in-widget chat to inbox; whatsapp = open wa.me; both = live chat + WhatsApp link */
    chatMode: "live" | "whatsapp" | "both";
    welcomeMessage: string;
    /** Short greeting bubble shown above the button before the panel is opened */
    teaserMessage: string;
    collectVisitorName: boolean;
    collectVisitorPhone: boolean;
  };
  urlPersonalization: boolean;
}

export const DEFAULT_WHATSAPP_CHAT_WIDGET_CONFIG: WhatsAppChatWidgetConfig = {
  enabled: true,
  phoneNumber: "",
  button: {
    backgroundColor: "#25D366",
    ctaText: "Chat with us",
    marginBottom: 20,
    marginLeft: 20,
    marginRight: 20,
    borderRadius: 24,
    position: "bottom-right",
    defaultMessage: "Hi! I have a question.",
  },
  panel: {
    brandName: "Support",
    brandSubtitle: "Typically replies within an hour",
    brandColor: "#075E54",
    brandImageUrl: "",
    buttonText: "Start Chat",
    defaultMessage: "Hi! I have a question.",
    openOnButtonClick: true,
    showByDefault: false,
    showDelaySeconds: 0,
    chatMode: "live",
    welcomeMessage: "Enter your question below and a representative will get right back to you.",
    teaserMessage: "Hi! How can we help you today?",
    collectVisitorName: true,
    collectVisitorPhone: true,
  },
  urlPersonalization: false,
};

export function normalizeWhatsAppPhone(raw: string): string {
  return String(raw || "").replace(/\D/g, "");
}

export function isValidWhatsAppPhoneDigits(digits: string): boolean {
  const d = normalizeWhatsAppPhone(digits);
  return d.length >= 8 && d.length <= 15;
}

type SessionPhoneSource = {
  sessionId: string;
  status?: string;
  deletedAt?: Date | string | null;
  connectionType?: "official" | "unofficial" | string;
  deviceInfo?: {
    displayPhoneNumber?: string;
    phoneNumber?: string;
    verifiedName?: string;
    name?: string;
  } | null;
};

export function getSessionPhoneDigits(session: SessionPhoneSource): string {
  const di = session.deviceInfo || {};
  const raw = di.displayPhoneNumber || di.phoneNumber || "";
  return normalizeWhatsAppPhone(raw);
}

export function buildWhatsAppChatWidgetPhoneOptions(
  sessions: SessionPhoneSource[],
): WhatsAppChatWidgetPhoneOption[] {
  const seen = new Set<string>();
  const options: WhatsAppChatWidgetPhoneOption[] = [];

  for (const session of sessions) {
    if (session.status !== "connected" || session.deletedAt) continue;
    const phoneNumber = getSessionPhoneDigits(session);
    if (!phoneNumber || seen.has(phoneNumber)) continue;
    seen.add(phoneNumber);

    const di = session.deviceInfo || {};
    const displayPhoneNumber =
      di.displayPhoneNumber?.trim() ||
      di.phoneNumber?.trim() ||
      `+${phoneNumber}`;
    const verifiedName = di.verifiedName?.trim() || di.name?.trim() || "";

    options.push({
      sessionId: session.sessionId,
      phoneNumber,
      displayPhoneNumber,
      verifiedName,
      connectionType: session.connectionType === "official" ? "official" : "unofficial",
    });
  }

  return options.sort((a, b) => a.displayPhoneNumber.localeCompare(b.displayPhoneNumber));
}

export function mergeWhatsAppChatWidgetConfig(
  partial?: Partial<WhatsAppChatWidgetConfig> | null,
): WhatsAppChatWidgetConfig {
  const p = partial || {};
  const phoneInputMode =
    p.phoneInputMode ||
    (p.sessionId ? "connected" : p.phoneNumber ? "manual" : "connected");
  return {
    ...DEFAULT_WHATSAPP_CHAT_WIDGET_CONFIG,
    ...p,
    phoneInputMode,
    button: { ...DEFAULT_WHATSAPP_CHAT_WIDGET_CONFIG.button, ...(p.button || {}) },
    panel: { ...DEFAULT_WHATSAPP_CHAT_WIDGET_CONFIG.panel, ...(p.panel || {}) },
  };
}

export function buildWhatsAppWaMeUrl(phone: string, message: string): string {
  const digits = normalizeWhatsAppPhone(phone);
  if (!digits) return "https://wa.me/";
  const text = encodeURIComponent(message || "");
  return `https://wa.me/${digits}${text ? `?text=${text}` : ""}`;
}

export function buildWhatsAppWidgetEmbedSnippet(baseUrl: string, widgetPublicId: string): string {
  const origin = baseUrl.replace(/\/+$/, "");
  const scriptUrl = `${origin}/api/public/whatsapp-chat-widget/${widgetPublicId}.js`;
  return `<script
  type="text/javascript"
  src="${scriptUrl}"
  id="helicoptic-wa-widget"
  async
></script>`;
}

export { buildWhatsAppWidgetLoaderScript } from "./whatsapp-chat-widget-script";
