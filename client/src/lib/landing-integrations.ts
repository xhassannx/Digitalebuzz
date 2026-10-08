import { getIntegrationIconPath } from "./integration-icons";

/** Product integrations for marketing (sync with server `INTEGRATION_DEFINITIONS`; excludes hidden `n8n`). */
export const LANDING_INTEGRATION_ITEMS = [
  { name: "whatsapp-business", displayName: "WhatsApp" },
  { name: "facebook-lead-ads", displayName: "Facebook Lead Ads" },
  { name: "shopify", displayName: "Shopify" },
  { name: "woocommerce", displayName: "WooCommerce" },
  { name: "google-sheets", displayName: "Google Sheets" },
  { name: "google-calendar", displayName: "Google Calendar" },
  { name: "google-contacts", displayName: "Google Contacts" },
  { name: "google-gemini", displayName: "Google Gemini" },
  { name: "calendly", displayName: "Calendly" },
  { name: "openai", displayName: "OpenAI" },
  { name: "telegram", displayName: "Telegram" },
  { name: "razorpay", displayName: "Razorpay" },
  { name: "cashfree", displayName: "Cashfree" },
  { name: "stripe", displayName: "Stripe" },
  { name: "indiamart", displayName: "IndiaMart" },
  { name: "exportersindia", displayName: "ExportersIndia" },
  { name: "tradeindia", displayName: "Trade India" },
  { name: "smtp", displayName: "SMTP" },
  { name: "zoom-webhook", displayName: "Zoom" },
] as const;

export function getLandingIntegrationIconSrc(name: string): string | undefined {
  return getIntegrationIconPath(name);
}
