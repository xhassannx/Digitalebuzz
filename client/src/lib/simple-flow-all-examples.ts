/**
 * Full testing pack: one step per app/integration with placeholder keys (connectionId, tokens, URLs).
 * Use when seeding the simple editor or new simple flows.
 */
import { LINEAR_FLOW_VERSION, type LinearFlowDefinitionV2, type LinearFlowStep, type LinearFlowTrigger } from "@shared/linear-flow";
import { SIMPLE_FLOW_APPS, SIMPLE_FLOW_ACTION_EXCLUDED_APP_IDS } from "@/lib/simple-flow-catalog";

/** Stable IDs so diffs and docs stay readable; safe for client-only JSON. */
const S = {
  d1: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001",
  d2: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0002",
  f1: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0003",
  rt: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa001c",
  h1: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0004",
  dt: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0005",
  m1: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0006",
  t1: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0007",
  ds: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0008",
  wa: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0009",
  tg: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa000a",
  sm: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa000b",
  wh: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa000c",
  gs: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa000d",
  gc: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa000e",
  gem: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0010",
  oa: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0011",
  cal: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0012",
  sh: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0013",
  woo: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0014",
  zm: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0015",
  wa2: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0016",
  gs2: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0017",
  f2: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0018",
  wh2: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0019",
  crm: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0020",
} as const;

export function getAllExampleLinearFlowSteps(): LinearFlowStep[] {
  return [
    {
      id: S.d1,
      appId: "delay",
      actionLabel: "Wait 10 minutes (drip spacing)",
      config: { days: 0, hours: 0, minutes: 10, seconds: 0 },
    },
    {
      id: S.f1,
      appId: "filter",
      actionLabel: "Only if contact has phone",
      config: {
        description: "Skip when phone missing",
        expression: "contact.phone != null && contact.phone.length > 5",
      },
    },
    {
      id: S.rt,
      appId: "router",
      actionLabel: "Router — VIP vs standard path",
      config: {
        branch1Condition: "contact.tags?.includes('VIP')",
        branch1Description: "If true: following steps are the VIP branch (same idea as canvas Router → Branch 1).",
        otherwiseDescription:
          "If false: executor skips the next skipStepsIfFalse steps, then continues (Otherwise path). Tune the number to match how many VIP-only steps you listed.",
        skipStepsIfFalse: 3,
        notes:
          "Canvas Router has two edges; in a linear list you approximate with skipStepsIfFalse. Use the advanced editor for arbitrary DAGs.",
      },
    },
    {
      id: S.h1,
      appId: "http_request",
      actionLabel: "HTTP POST to internal API",
      config: {
        method: "POST",
        url: "https://YOUR_API_HOST/api/contacts/sync",
        headers: {
          Authorization: "Bearer YOUR_API_TOKEN",
          "Content-Type": "application/json",
        },
        body: { contactId: "{{contact.id}}", source: "simple_flow" },
      },
    },
    {
      id: S.dt,
      appId: "date_helper",
      actionLabel: "Format signup date",
      config: {
        operation: "format",
        input: "{{contact.createdAt}}",
        format: "ISO",
        timezone: "YOUR_TIMEZONE",
      },
    },
    {
      id: S.m1,
      appId: "math_helper",
      actionLabel: "Compute lead score delta",
      config: { operation: "add", a: "{{contact.score}}", b: 5 },
    },
    {
      id: S.t1,
      appId: "text_helper",
      actionLabel: "Build greeting line",
      config: {
        operation: "template",
        template: "Hi {{contact.firstName}}, welcome from YOUR_BRAND",
      },
    },
    {
      id: S.ds,
      appId: "datastore",
      actionLabel: "Store run context",
      config: { operation: "set", key: "lastStep", value: "pre_whatsapp" },
    },
    {
      id: S.wa,
      appId: "whatsapp",
      actionLabel: "Send WhatsApp template (message 1)",
      config: {
        connectionId: "YOUR_WHATSAPP_BUSINESS_CONNECTION_ID",
        templateName: "hello_world",
        language: "en",
        bodyParams: ["{{contact.name}}", "YOUR_COMPANY_NAME"],
        to: "{{contact.phoneE164}}",
      },
    },
    {
      id: S.tg,
      appId: "telegram",
      actionLabel: "Telegram notify sales",
      config: {
        botToken: "YOUR_TELEGRAM_BOT_TOKEN",
        chatId: "YOUR_TELEGRAM_CHAT_ID",
        text: "New lead: {{contact.name}} {{contact.phone}}",
        parseMode: "HTML",
      },
    },
    {
      id: S.sm,
      appId: "smtp",
      actionLabel: "Send email via org SMTP",
      config: {
        useOrgSmtpSettings: true,
        to: "{{contact.email}}",
        subject: "Welcome — YOUR_SUBJECT",
        bodyHtml: "<p>Hi {{contact.name}}</p>",
        replyTo: "YOUR_REPLY_TO_EMAIL",
      },
    },
    {
      id: S.wh,
      appId: "webhook",
      actionLabel: "Outbound webhook (Zapier / Make)",
      config: {
        method: "POST",
        url: "https://hooks.zapier.com/hooks/catch/YOUR_ZAPIER_ID/",
        headers: { "X-Signature": "YOUR_HMAC_SECRET" },
        body: { event: "contact.created", contact: "{{contact}}", flowId: "{{flow.id}}" },
      },
    },
    {
      id: S.gs,
      appId: "google_sheet",
      actionLabel: "Append row to Google Sheet",
      config: {
        connectionId: "YOUR_GOOGLE_SHEETS_CONNECTION_ID",
        spreadsheetId: "YOUR_SPREADSHEET_ID",
        worksheetName: "Leads",
        range: "A:E",
        row: {
          A: "{{contact.name}}",
          B: "{{contact.phone}}",
          C: "{{contact.email}}",
          D: "{{contact.createdAt}}",
          E: "simple_flow",
        },
      },
    },
    {
      id: S.crm,
      appId: "contact",
      actionLabel: "Create workspace contact (CRM)",
      config: {
        _canvasActionId: "create-contact",
        firstName: "{{contact.firstName}}",
        lastName: "{{contact.lastName}}",
        email: "{{contact.email}}",
        phone: "{{contact.phone}}",
        source: "whatsapp",
      },
    },
    {
      id: S.gc,
      appId: "google_contacts",
      actionLabel: "Create Google Contact",
      config: {
        connectionId: "YOUR_GOOGLE_CONTACTS_CONNECTION_ID",
        givenName: "{{contact.firstName}}",
        familyName: "{{contact.lastName}}",
        phone: "{{contact.phoneE164}}",
        email: "{{contact.email}}",
        notes: "Imported from YOUR_CRM",
      },
    },
    {
      id: S.gem,
      appId: "google_gemini",
      actionLabel: "Gemini — summarize lead",
      config: {
        connectionId: "YOUR_GEMINI_OR_GOOGLE_AI_CONNECTION_ID",
        model: "gemini-1.5-flash",
        prompt:
          "Summarize this lead in one sentence for a CRM note: name={{contact.name}} tags={{contact.tags}}",
        maxOutputTokens: 256,
      },
    },
    {
      id: S.oa,
      appId: "openai",
      actionLabel: "OpenAI — classify intent",
      config: {
        connectionId: "YOUR_OPENAI_CONNECTION_ID",
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Classify as hot|warm|cold. Reply one word only." },
          { role: "user", content: "{{contact.lastMessage}}" },
        ],
        temperature: 0.2,
      },
    },
    {
      id: S.cal,
      appId: "calendly",
      actionLabel: "Calendly — custom API (example)",
      config: {
        connectionId: "YOUR_CALENDLY_CONNECTION_ID",
        method: "GET",
        path: "/scheduled_events",
        query: { organization: "YOUR_CALENDLY_ORG_URI", count: 1 },
        notes: "Replace with cancel-event or invitee actions from canvas parity when executor supports it.",
      },
    },
    {
      id: S.sh,
      appId: "shopify",
      actionLabel: "Shopify — REST example (customer lookup)",
      config: {
        shopDomain: "YOUR_SHOP.myshopify.com",
        accessTokenRef: "YOUR_SHOPIFY_ADMIN_TOKEN_OR_VAULT_KEY",
        method: "GET",
        path: "/admin/api/2024-01/customers/search.json",
        query: { query: "email:{{contact.email}}" },
      },
    },
    {
      id: S.woo,
      appId: "woocommerce",
      actionLabel: "WooCommerce — REST example",
      config: {
        siteUrl: "https://YOUR_WORDPRESS_SITE",
        consumerKey: "YOUR_WC_CONSUMER_KEY",
        consumerSecret: "YOUR_WC_CONSUMER_SECRET",
        method: "GET",
        path: "/wp-json/wc/v3/customers",
        query: { email: "{{contact.email}}" },
      },
    },
    {
      id: S.zm,
      appId: "zoom_webhook",
      actionLabel: "Zoom — verify / forward payload",
      config: {
        secretToken: "YOUR_ZOOM_WEBHOOK_SECRET",
        expectedEvent: "meeting.started",
        forwardToUrl: "https://YOUR_BACKEND/zoom/webhook",
        notes: "Validate Zoom signature before trusting body.",
      },
    },
    {
      id: S.d2,
      appId: "delay",
      actionLabel: "Wait 1 day (drip day 2)",
      config: { days: 1, hours: 0, minutes: 0, seconds: 0 },
    },
    {
      id: S.wa2,
      appId: "whatsapp",
      actionLabel: "WhatsApp template — drip follow-up",
      config: {
        connectionId: "YOUR_WHATSAPP_BUSINESS_CONNECTION_ID",
        templateName: "YOUR_SECOND_TEMPLATE_NAME",
        language: "en",
        bodyParams: ["{{contact.name}}"],
        to: "{{contact.phoneE164}}",
      },
    },
    {
      id: S.gs2,
      appId: "google_sheet",
      actionLabel: "Update existing row by phone",
      config: {
        connectionId: "YOUR_GOOGLE_SHEETS_CONNECTION_ID",
        spreadsheetId: "YOUR_SPREADSHEET_ID",
        worksheetName: "Leads",
        operation: "update_row",
        matchColumn: "B",
        matchValue: "{{contact.phone}}",
        updates: { E: "drip_sent_day2", F: "{{now}}" },
      },
    },
    {
      id: S.f2,
      appId: "filter",
      actionLabel: "Only if tag VIP",
      config: {
        description: "VIP branch",
        expression: "contact.tags.includes('VIP')",
      },
    },
    {
      id: S.wh2,
      appId: "webhook",
      actionLabel: "Second webhook (e.g. internal analytics)",
      config: {
        method: "POST",
        url: "https://YOUR_ANALYTICS_ENDPOINT/events",
        headers: { "X-API-Key": "YOUR_ANALYTICS_KEY" },
        body: { name: "drip_completed", contactId: "{{contact.id}}" },
      },
    },
  ];
}

export function buildFullExampleLinearFlow(trigger: LinearFlowTrigger = { type: "contact.created" }): LinearFlowDefinitionV2 {
  return {
    version: LINEAR_FLOW_VERSION,
    trigger,
    steps: getAllExampleLinearFlowSteps(),
  };
}

/** Catalog ids that have no step in the pack — intended to stay empty. */
export function getCatalogAppIdsMissingFromExamplePack(): string[] {
  const seen = new Set(getAllExampleLinearFlowSteps().map((s) => s.appId));
  return SIMPLE_FLOW_APPS.filter(
    (a) => !seen.has(a.id) && !SIMPLE_FLOW_ACTION_EXCLUDED_APP_IDS.has(a.id)
  ).map((a) => a.id);
}
