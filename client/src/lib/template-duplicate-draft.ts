/** Shared draft shape for create-template-page prefills (dummy + duplicate). */
export const TEMPLATE_PREFILL_DRAFT_KEY = "dummyTemplateDraft";

export type TemplatePrefillDraft = {
  name: string;
  templateType: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION";
  bodyText: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  language: string;
  sampleValues: Record<string, string>;
  headerText?: string;
  footerText?: string;
  mediaUrl?: string;
  interactiveAction:
    | "NONE"
    | "CALL_TO_ACTION"
    | "QUICK_REPLY"
    | "ALL"
    | "PRODUCT_CARD_CAROUSEL"
    | "MEDIA_CARD_CAROUSEL"
    | "FORM";
  quickReplies: Array<{ id: string; text: string }>;
  urlButtons: Array<{ id: string; text: string; url: string; urlType: "STATIC" | "DYNAMIC" }>;
  phoneButtons: Array<{ id: string; text: string; phoneNumber: string; countryCode: string }>;
  productCards?: Array<{
    id: string;
    buttonLabel: string;
    productRetailerId: string;
    productName?: string;
    buttonType?: "spm" | "url";
  }>;
  mediaCards?: Array<{
    id: string;
    mediaType: "IMAGE" | "VIDEO";
    mediaUrl?: string;
    bodyText?: string;
    buttons?: Array<{ type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER"; text: string; url?: string; phoneNumber?: string }>;
  }>;
  formButtonText?: string;
  selectedFlow?: { id: string; name: string; flowId: string } | null;
  metaCatalogId?: string;
};

type MessageTemplateLike = {
  id?: string;
  name?: string;
  language?: string;
  category?: string;
  components?: Array<any>;
  metadata?: Record<string, any>;
  metaData?: Record<string, any>;
};

function uid(prefix: string, i: number) {
  return `${prefix}-${Date.now()}-${i}`;
}

function resolveInteractiveAction(
  buttons: Array<any>,
  metaAction?: string,
): TemplatePrefillDraft["interactiveAction"] {
  const allowed = new Set([
    "NONE",
    "CALL_TO_ACTION",
    "QUICK_REPLY",
    "ALL",
    "PRODUCT_CARD_CAROUSEL",
    "MEDIA_CARD_CAROUSEL",
    "FORM",
  ]);
  if (metaAction && allowed.has(metaAction)) {
    return metaAction as TemplatePrefillDraft["interactiveAction"];
  }
  if (!buttons.length) return "NONE";
  const hasQr = buttons.some((b) => b.type === "QUICK_REPLY");
  const hasCta = buttons.some((b) => b.type === "URL" || b.type === "PHONE_NUMBER");
  if (hasQr && hasCta) return "ALL";
  if (hasQr) return "QUICK_REPLY";
  if (hasCta) return "CALL_TO_ACTION";
  return "NONE";
}

function extractSampleValues(body: any, meta: Record<string, any>): Record<string, string> {
  if (meta.sampleValues && typeof meta.sampleValues === "object") {
    return { ...meta.sampleValues };
  }
  const samples: Record<string, string> = {};
  const exampleRow = body?.example?.body_text?.[0];
  if (Array.isArray(exampleRow)) {
    exampleRow.forEach((val: string, idx: number) => {
      samples[String(idx + 1)] = String(val ?? "");
    });
  }
  return samples;
}

function duplicateTemplateName(name: string | undefined): string {
  const base = (name || "template")
    .replace(/_copy(_\d+)?$/i, "")
    .replace(/[^a-z0-9_]/gi, "_")
    .toLowerCase()
    .slice(0, 480);
  return `${base || "template"}_copy`;
}

/** Build a create-form draft from an existing message template (Meta or unofficial). */
export function buildMessageTemplateDuplicateDraft(
  template: MessageTemplateLike,
): TemplatePrefillDraft {
  const components = template.components || [];
  const meta: Record<string, any> =
    (template as any).metaData || template.metadata || {};
  const header = components.find((c: any) => c.type === "HEADER");
  const body = components.find((c: any) => c.type === "BODY");
  const footer = components.find((c: any) => c.type === "FOOTER");
  const buttons = components.find((c: any) => c.type === "BUTTONS")?.buttons || [];

  let templateType: TemplatePrefillDraft["templateType"] = "TEXT";
  let mediaUrl = "";
  let headerText = "";

  if (header?.format === "IMAGE") {
    templateType = "IMAGE";
    mediaUrl =
      header.example?.header_handle?.[0] ||
      header.mediaUrl ||
      meta.mediaUrl ||
      "";
  } else if (header?.format === "VIDEO") {
    templateType = "VIDEO";
    mediaUrl =
      header.example?.header_handle?.[0] ||
      header.mediaUrl ||
      meta.mediaUrl ||
      "";
  } else if (header?.format === "DOCUMENT") {
    templateType = "DOCUMENT";
    mediaUrl =
      header.example?.header_handle?.[0] ||
      header.mediaUrl ||
      meta.mediaUrl ||
      "";
  } else if (header?.format === "LOCATION") {
    templateType = "LOCATION";
  } else if (header?.text) {
    headerText = header.text;
  }

  const categoryRaw = String(template.category || meta.category || "UTILITY").toUpperCase();
  const category = (
    ["MARKETING", "UTILITY", "AUTHENTICATION"].includes(categoryRaw)
      ? categoryRaw
      : "UTILITY"
  ) as TemplatePrefillDraft["category"];

  const interactiveAction = resolveInteractiveAction(buttons, meta.interactiveAction);

  return {
    name: duplicateTemplateName(template.name),
    templateType,
    bodyText: body?.text || "",
    category,
    language: (template.language || "en").toLowerCase(),
    sampleValues: extractSampleValues(body, meta),
    headerText: headerText || undefined,
    footerText: footer?.text || undefined,
    mediaUrl: mediaUrl || undefined,
    interactiveAction,
    quickReplies: buttons
      .filter((b: any) => b.type === "QUICK_REPLY")
      .map((b: any, i: number) => ({ id: uid("qr", i), text: b.text || "" })),
    urlButtons: buttons
      .filter((b: any) => b.type === "URL")
      .map((b: any, i: number) => ({
        id: uid("url", i),
        text: b.text || "",
        url: b.url || "",
        urlType: (b.url || "").includes("{{") ? ("DYNAMIC" as const) : ("STATIC" as const),
      })),
    phoneButtons: buttons
      .filter((b: any) => b.type === "PHONE_NUMBER")
      .map((b: any, i: number) => {
        const raw = String(b.phone_number || b.phoneNumber || "");
        const digits = raw.replace(/\D/g, "");
        const phoneNumber = digits.startsWith("91") && digits.length > 10 ? digits.slice(2) : digits;
        return {
          id: uid("phone", i),
          text: b.text || "",
          phoneNumber: phoneNumber || raw,
          countryCode: "+91",
        };
      }),
    productCards: Array.isArray(meta.productCards)
      ? meta.productCards.map((c: any, i: number) => ({
          id: c.id || uid("pc", i),
          buttonLabel: c.buttonLabel || "View",
          productRetailerId: c.productRetailerId || "",
          productName: c.productName,
          buttonType: c.buttonType === "url" ? "url" : "spm",
        }))
      : undefined,
    mediaCards: Array.isArray(meta.mediaCards)
      ? meta.mediaCards.map((c: any, i: number) => ({
          id: c.id || uid("mc", i),
          mediaType: c.mediaType === "VIDEO" ? "VIDEO" : "IMAGE",
          mediaUrl: c.mediaUrl,
          bodyText: c.bodyText,
          buttons: c.buttons,
        }))
      : undefined,
    formButtonText: meta.formButtonText || meta.flowButtonText,
    selectedFlow: meta.selectedFlow || meta.flow || null,
    metaCatalogId: meta.metaCatalogId || meta.catalogId,
  };
}
