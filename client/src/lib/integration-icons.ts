/** Icon paths for integrations — keep in sync with integrations catalog UI. */
export const INTEGRATION_ICON_PATHS: Record<string, string> = {
  "whatsapp-business": "/icons/whatsapp.svg",
  "facebook-lead-ads": "/icons/facebook.svg",
  "google-calendar": "/icons/calendar_31_2x.png",
  "google-sheets": "/icons/icon_1_spreadsheet_x32.png",
  shopify: "/icons/shopify.svg",
  "zoom-webhook": "/icons/zoom.ico",
  "google-gemini": "/icons/gemini.jpg",
  openai: "/icons/openai.png",
  woocommerce: "/icons/woocommerce.svg",
  tradeindia: "/icons/trade.ico",
  indiamart: "/icons/indiamart.png",
  exportersindia: "/icons/expertsindia.ico",
  calendly: "/icons/calendly.svg",
  "google-contacts": "/icons/google-contact.png",
  smtp: "/icons/smtp.png",
  telegram: "/icons/telegram.jpg",
  n8n: "/icons/n8n.svg",
  stripe: "/icons/stripe.png",
};

/** Payment gateways without a dedicated icon file use the card glyph in UI. */
export const PAYMENT_GATEWAY_NAMES = new Set(["razorpay", "cashfree", "stripe"]);

export function getIntegrationIconPath(name: string): string | undefined {
  return INTEGRATION_ICON_PATHS[name];
}

export function isPaymentGateway(name: string): boolean {
  return PAYMENT_GATEWAY_NAMES.has(name);
}
