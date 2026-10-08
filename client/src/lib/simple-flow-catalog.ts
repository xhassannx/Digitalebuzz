/** Apps available in the simple (linear) flow builder — mirrors canvas “action” apps where possible. Execution wiring comes later. */
export type SimpleFlowAppMeta = {
  id: string;
  label: string;
  description: string;
  defaultActionLabel: string;
  iconSrc?: string;
  /** Default JSON config when the step is added (pretty-printed in the editor). */
  defaultConfig?: Record<string, unknown>;
};

export const SIMPLE_FLOW_APPS: SimpleFlowAppMeta[] = [
  // —— Flow control (same concepts as canvas: Delay, Filter, HTTP, helpers) ——
  {
    id: "delay",
    label: "Delay",
    description:
      "Wait before the next step. Use between WhatsApp or emails for drip sequences (aligned with canvas Delay).",
    defaultActionLabel: "Wait",
    defaultConfig: { days: 0, hours: 0, minutes: 10, seconds: 0 },
  },
  {
    id: "filter",
    label: "Filter",
    description: "Only continue if conditions pass (same role as canvas Filter; friendly form or JSON for advanced cases).",
    defaultActionLabel: "Filter / condition",
    defaultConfig: {
      mode: "continue_if_match",
      combinator: "AND",
      description: "",
      conditions: [{ left: "{{contact.phone}}", operator: "contains", right: "" }],
    },
  },
  {
    id: "router",
    label: "Router",
    description:
      "Condition-based branching like the canvas Router: if branch1Condition is true, following steps are “Branch 1”; if false, your executor skips skipStepsIfFalse steps (Otherwise path). True two-way graphs still need the advanced editor.",
    defaultActionLabel: "Branch on condition",
    iconSrc: "/icons/router.svg",
    defaultConfig: {
      branch1Condition: "",
      branch1Description: "Runs when condition is true",
      otherwiseDescription: "When false, skip N steps then continue (standard path)",
      skipStepsIfFalse: 1,
    },
  },
  {
    id: "http_request",
    label: "HTTP request",
    description: "Method + URL + headers/body (canvas “HTTP Request” style).",
    defaultActionLabel: "HTTP request",
    defaultConfig: { method: "POST", url: "", headers: {}, body: {} },
  },
  {
    id: "date_helper",
    label: "Date helper",
    description: "Format or shift dates for later steps (canvas Date Helper).",
    defaultActionLabel: "Date helper",
    defaultConfig: { operation: "format", input: "{{contact.createdAt}}", format: "ISO" },
  },
  {
    id: "math_helper",
    label: "Math helper",
    description: "Numeric operations between steps (canvas Math Helper).",
    defaultActionLabel: "Math helper",
    defaultConfig: { operation: "add", a: 0, b: 0 },
  },
  {
    id: "text_helper",
    label: "Text helper",
    description: "String templates and transforms (canvas Text Helper).",
    defaultActionLabel: "Text helper",
    defaultConfig: { template: "Hello {{contact.name}}", operation: "template" },
  },
  {
    id: "datastore",
    label: "Datastore",
    description: "Read/write small key-value context during a run (canvas Datastore).",
    defaultActionLabel: "Datastore",
    defaultConfig: { operation: "set", key: "", value: "" },
  },
  // —— Messaging / drips ——
  {
    id: "whatsapp",
    label: "WhatsApp",
    description: "Send template or session message — stack with Delay steps for drip-style campaigns.",
    defaultActionLabel: "Send WhatsApp message",
    iconSrc: "/icons/whatsapp.svg",
    defaultConfig: { templateName: "", language: "en", bodyParams: [] as string[] },
  },
  {
    id: "telegram",
    label: "Telegram",
    description: "Send a Telegram message (configure bot token & chat in JSON).",
    defaultActionLabel: "Send Telegram message",
  },
  {
    id: "smtp",
    label: "SMTP / Email",
    description: "Send email via your connected mail settings.",
    defaultActionLabel: "Send email",
    defaultConfig: {
      useOrgSmtpSettings: true,
      to: "",
      subject: "",
      bodyHtml: "<p></p>",
    },
  },
  // —— Integrations ——
  {
    id: "webhook",
    label: "Webhook",
    description: "POST JSON to any URL (Zapier, Make, custom API).",
    defaultActionLabel: "Call webhook",
    defaultConfig: { method: "POST", url: "", body: {} as Record<string, unknown> },
  },
  {
    id: "contact",
    label: "Contact",
    description: "Create or update workspace CRM contacts (same actions as the canvas Contact app).",
    defaultActionLabel: "Create contact",
    defaultConfig: {
      firstName: "{{contact.firstName}}",
      lastName: "{{contact.lastName}}",
      email: "{{contact.email}}",
      phone: "{{contact.phone}}",
      notes: "",
      company: "",
      jobTitle: "",
      name: "{{contact.name}}",
      source: "whatsapp",
    },
  },
  {
    id: "google_sheet",
    label: "Google Sheets",
    description: "Append or update a row (uses Google Sheets connection).",
    defaultActionLabel: "Append sheet row",
    iconSrc: "/icons/icon_1_spreadsheet_x32.png",
    defaultConfig: {
      connectionId: "",
      spreadsheetId: "",
      worksheetId: "0",
      worksheetName: "",
      range: "A:E",
      row: {
        A: "{{contact.name}}",
        B: "{{contact.phone}}",
        C: "{{contact.email}}",
        D: "",
        E: "",
      },
    },
  },
  {
    id: "google_contacts",
    label: "Google Contacts",
    description: "Create or update a Google contact.",
    defaultActionLabel: "Sync to Google Contacts",
    iconSrc: "/icons/google-contact.png",
    defaultConfig: {
      connectionId: "",
      googleContactName: "{{contact.name}}",
      givenName: "{{contact.name}}",
      googleContactEmail: "{{contact.email}}",
      email: "{{contact.email}}",
      googleContactPhone: "{{contact.phone}}",
      phone: "{{contact.phone}}",
      notes: "",
    },
  },
  {
    id: "google_calendar",
    label: "Google Calendar",
    description:
      "Legacy: appears only when loading older flows. New automations should use a Google Calendar trigger in the advanced editor — calendar is not offered as a simple-flow action step.",
    defaultActionLabel: "Calendar action",
    iconSrc: "/icons/calendar_31_2x.png",
    defaultConfig: {
      connectionId: "",
      calendarId: "primary",
      summary: "Follow up: {{contact.name}}",
      eventSummary: "Follow up: {{contact.name}}",
      description: "",
      eventDescription: "",
      start: "{{contact.createdAt}}",
      eventStart: "{{contact.createdAt}}",
      end: "{{contact.createdAt}}",
      eventEnd: "{{contact.createdAt}}",
      timeZone: "Asia/Kolkata",
    },
  },
  {
    id: "google_gemini",
    label: "Google Gemini",
    description: "Run a prompt with Gemini (API / connection).",
    defaultActionLabel: "Run Gemini prompt",
    iconSrc: "/icons/gemini.jpg",
    defaultConfig: {
      connectionId: "",
      model: "gemini-1.5-flash",
      prompt: "",
      maxOutputTokens: 256,
    },
  },
  {
    id: "openai",
    label: "OpenAI",
    description: "Chat completion or text generation.",
    defaultActionLabel: "OpenAI completion",
    iconSrc: "/icons/openai.png",
    defaultConfig: {
      connectionId: "",
      model: "gpt-4o-mini",
      prompt: "",
    },
  },
  {
    id: "calendly",
    label: "Calendly",
    description: "Scheduling hooks (events, invitees) via Calendly integration.",
    defaultActionLabel: "Calendly action",
    iconSrc: "/icons/calendly.svg",
    defaultConfig: {
      connectionId: "",
      method: "GET",
      url: "https://api.calendly.com/users/me",
      data: "",
    },
  },
  {
    id: "shopify",
    label: "Shopify",
    description: "Shopify admin API actions (orders, customers).",
    defaultActionLabel: "Shopify action",
    iconSrc: "/icons/shopify.svg",
  },
  {
    id: "woocommerce",
    label: "WooCommerce",
    description: "WooCommerce REST hooks (orders, customers).",
    defaultActionLabel: "WooCommerce action",
    iconSrc: "/icons/woocommerce.svg",
  },
  {
    id: "zoom_webhook",
    label: "Zoom (webhook)",
    description: "Zoom-related webhook payloads (canvas Zoom Webhook).",
    defaultActionLabel: "Zoom webhook action",
    iconSrc: "/icons/zoom.ico",
  },
];

/** Grouped picker sections (order matches “utilities first”, then messaging, then integrations). */
export const SIMPLE_FLOW_APP_GROUPS: { title: string; ids: string[] }[] = [
  {
    title: "Flow control & logic",
    ids: [
      "delay",
      "filter",
      "router",
      "http_request",
      "date_helper",
      "math_helper",
      "text_helper",
      "datastore",
    ],
  },
  {
    title: "Messaging & drips",
    ids: ["whatsapp", "telegram", "smtp"],
  },
  {
    title: "Integrations",
    ids: [
      "webhook",
      "google_sheet",
      "contact",
      "google_contacts",
      "google_gemini",
      "openai",
      "calendly",
      "shopify",
      "woocommerce",
      "zoom_webhook",
    ],
  },
];

/** Apps not listed in SIMPLE_FLOW_APP_GROUPS — e.g. trigger-only integrations or legacy rows. */
export const SIMPLE_FLOW_ACTION_EXCLUDED_APP_IDS = new Set<string>(["google_calendar"]);

export function getSimpleFlowApp(appId: string): SimpleFlowAppMeta | undefined {
  return SIMPLE_FLOW_APPS.find((a) => a.id === appId);
}

export function defaultConfigJsonForApp(appId: string): string {
  const meta = getSimpleFlowApp(appId);
  const base = meta?.defaultConfig ?? {};
  return JSON.stringify(base, null, 2);
}
