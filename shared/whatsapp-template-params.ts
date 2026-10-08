/** Meta Cloud API template body/header text parameter limits (error 132018 if violated). */
export const WHATSAPP_TEMPLATE_PARAM_MAX_CHARS = 1024;

/**
 * WhatsApp rejects template variable values that contain newlines, tabs,
 * more than 4 consecutive spaces, or more than 1024 characters.
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates
 */
export function sanitizeWhatsAppTemplateParamText(value: unknown): string {
  let text = String(value ?? "");
  text = text.replace(/\r\n|\r|\n|\u2028|\u2029/g, " ");
  text = text.replace(/\t/g, " ");
  text = text.replace(/\u00a0/g, " ");
  text = text.replace(/ {5,}/g, "    ");
  text = text.trim();
  if (text.length > WHATSAPP_TEMPLATE_PARAM_MAX_CHARS) {
    text = text.slice(0, WHATSAPP_TEMPLATE_PARAM_MAX_CHARS);
  }
  return text;
}
