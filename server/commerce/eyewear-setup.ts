import { randomUUID } from "crypto";
import type { InsertChatbotNode } from "@shared/schema";
import { storage } from "../storage";
import { businessAPIManager } from "../whatsapp/business-api-client";
import { resolveOfficialCredentialsForSession } from "./session-credentials";
import { registerShopifyWebhooksForIntegration } from "./shopify-webhooks-register";
import {
  buildShopifyAutomationFlows,
  buildShopifySupportKnowledgeBase,
  buildShopifyWhatsAppTemplates,
  normalizeBrandName,
  normalizeStoreUrl,
  shopifyAssistantName,
  shopifyCodChatbotName,
  shopifySupportChatbotName,
  SHOPIFY_SETUP_PREFIX,
  type ShopifySetupBrand,
  type ShopifyTemplateDef,
} from "./eyewear-automation-pack";

const BASE_URL = (process.env.BASE_URL || "http://localhost:5002")
  .split(/\s*[\n#]/)[0]
  .trim()
  .replace(/\/+$/, "");

export type ShopifyAutomationsSetupResult = {
  success: boolean;
  brandName: string;
  storeUrl: string;
  summary: {
    flowsCreated: number;
    flowsSkipped: number;
    templatesSubmitted: number;
    templatesSkipped: number;
    templatesFailed: string[];
    assistantCreated: boolean;
    supportChatbotCreated: boolean;
    codChatbotCreated: boolean;
    shopifyWebhooksRegistered: boolean;
  };
  flows: Array<{ id: string; name: string; webhookUrl?: string; notes?: string }>;
  assistantId?: string;
  chatbots: Array<{ id: string; name: string }>;
  testing: string[];
  warnings: string[];
};

/** @deprecated Use ShopifyAutomationsSetupResult */
export type EyewearSetupResult = ShopifyAutomationsSetupResult;

function flowWebhookUrl(flowId: string): string {
  return `${BASE_URL}/api/v2/webhook/flows/${flowId}`;
}

function metaTemplateComponents(t: ShopifyTemplateDef) {
  return [
    {
      type: "BODY" as const,
      text: t.bodyText,
      example: { body_text: [t.samples] },
    },
    ...(t.footerText ? [{ type: "FOOTER" as const, text: t.footerText }] : []),
  ];
}

async function fetchShopifyShopProfile(opts: {
  shopDomain: string;
  accessToken: string;
}): Promise<{ name?: string; domain?: string; myshopifyDomain?: string }> {
  try {
    let host = opts.shopDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!host.includes(".")) host = `${host}.myshopify.com`;
    const res = await fetch(`https://${host}/admin/api/2024-01/shop.json`, {
      headers: { "X-Shopify-Access-Token": opts.accessToken },
    });
    if (!res.ok) return {};
    const data = await res.json();
    const shop = data?.shop || {};
    return {
      name: shop.name ? String(shop.name) : undefined,
      domain: shop.domain ? String(shop.domain) : undefined,
      myshopifyDomain: shop.myshopify_domain ? String(shop.myshopify_domain) : undefined,
    };
  } catch {
    return {};
  }
}

async function submitShopifyTemplate(opts: {
  userId: string;
  organizationId: string;
  template: ShopifyTemplateDef;
  accessToken: string;
  businessAccountId: string;
  phoneNumberId: string;
}): Promise<"created" | "skipped" | "failed"> {
  const existing = await storage.getMessageTemplatesByOrganization(opts.organizationId);
  if (existing.some((t) => t.name === opts.template.name)) return "skipped";

  try {
    const metaTemplate = await businessAPIManager.createMessageTemplate(
      {
        phoneNumberId: opts.phoneNumberId,
        accessToken: opts.accessToken,
        businessAccountId: opts.businessAccountId,
      },
      opts.businessAccountId,
      {
        name: opts.template.name,
        language: "en",
        category: opts.template.category,
        components: metaTemplateComponents(opts.template),
      }
    );
    await storage.upsertMessageTemplate({
      userId: opts.userId,
      organizationId: opts.organizationId,
      templateId: metaTemplate.id || metaTemplate.message_template_id || opts.template.name,
      name: metaTemplate.name || opts.template.name,
      language: "en",
      status: "PENDING",
      category: opts.template.category,
      phoneNumberId: opts.phoneNumberId,
      components: metaTemplateComponents(opts.template),
      metaData: { createdVia: "shopify-automations-setup", submittedAt: new Date().toISOString() },
    });
    return "created";
  } catch (e) {
    console.error(`[Shopify setup] Template ${opts.template.name} failed:`, e);
    return "failed";
  }
}

async function createSupportChatbot(opts: {
  userId: string;
  organizationId: string;
  sessionId: string;
  assistantId: string;
  brandName: string;
}): Promise<{ id: string; name: string } | null> {
  const name = shopifySupportChatbotName(opts.brandName);
  const existing = await storage.getChatbotsByOrganization(opts.organizationId);
  if (existing.some((c) => c.name === name)) return null;

  const triggerId = randomUUID();
  const aiId = randomUUID();
  const nodes: InsertChatbotNode[] = [
    {
      id: triggerId,
      nodeType: "trigger",
      position: { x: 100, y: 100 },
      data: {
        nodeType: "trigger",
        messageType: "text",
        keywords: ["hi", "hello", "help", "hey"],
        fuzzyMatching: true,
        triggerSessionIds: [opts.sessionId],
        triggerSessionId: opts.sessionId,
        triggerPhoneNumberId: "",
        triggerDisplayPhoneNumber: "",
        triggerConnectionType: "",
      },
      connections: [{ from: triggerId, to: aiId }],
    },
    {
      id: aiId,
      nodeType: "ai_agent",
      position: { x: 400, y: 100 },
      data: {
        nodeType: "ai_agent",
        assistantId: opts.assistantId,
        welcomeMessage: `Hi! Welcome to ${opts.brandName}. Ask us about orders, delivery, returns, or products.`,
        stopKeywords: [],
      },
      connections: [],
    },
  ];

  const chatbot = await storage.createChatbot({
    userId: opts.userId,
    organizationId: opts.organizationId,
    name,
    status: "published",
    sessionId: opts.sessionId,
  });
  await storage.upsertChatbotNodes(chatbot.id, nodes);
  return { id: chatbot.id, name: chatbot.name };
}

async function createCodChatbot(opts: {
  userId: string;
  organizationId: string;
  sessionId: string;
  brandName: string;
}): Promise<{ id: string; name: string } | null> {
  const name = shopifyCodChatbotName(opts.brandName);
  const existing = await storage.getChatbotsByOrganization(opts.organizationId);
  if (existing.some((c) => c.name === name)) return null;

  const triggerId = randomUUID();
  const replyId = randomUUID();
  const nodes: InsertChatbotNode[] = [
    {
      id: triggerId,
      nodeType: "trigger",
      position: { x: 100, y: 100 },
      data: {
        nodeType: "trigger",
        messageType: "text",
        keywords: ["YES", "yes", "Yes"],
        fuzzyMatching: false,
        triggerSessionIds: [opts.sessionId],
        triggerSessionId: opts.sessionId,
        triggerPhoneNumberId: "",
        triggerDisplayPhoneNumber: "",
        triggerConnectionType: "",
      },
      connections: [{ from: triggerId, to: replyId }],
    },
    {
      id: replyId,
      nodeType: "send_text",
      position: { x: 400, y: 100 },
      data: {
        nodeType: "send_text",
        body: `Thank you! Your COD order is confirmed. We will dispatch your ${opts.brandName} order soon.`,
      },
      connections: [],
    },
  ];

  const chatbot = await storage.createChatbot({
    userId: opts.userId,
    organizationId: opts.organizationId,
    name,
    status: "published",
    sessionId: opts.sessionId,
  });
  await storage.upsertChatbotNodes(chatbot.id, nodes);
  return { id: chatbot.id, name: chatbot.name };
}

async function ensureAiAssistant(opts: {
  userId: string;
  organizationId: string;
  brand: ShopifySetupBrand;
}): Promise<string> {
  const brandName = normalizeBrandName(opts.brand.brandName);
  const assistantName = shopifyAssistantName(brandName);
  const kb = buildShopifySupportKnowledgeBase(opts.brand);
  const kbFileName = `${brandName} — FAQ`;

  const assistants = await storage.getAiAssistantsByOrganization(opts.organizationId);
  const existing = assistants.find((a) => a.name === assistantName);
  if (existing) {
    const files = await storage.getAiAssistantKnowledgeFiles(existing.id);
    if (!files.some((f) => f.fileName === kbFileName || f.fileName.includes(brandName))) {
      await storage.addAiAssistantKnowledgeFile({
        assistantId: existing.id,
        fileName: kbFileName,
        content: kb,
        sizeBytes: Buffer.byteLength(kb, "utf-8"),
        mimeType: "text/rich",
      });
    }
    return existing.id;
  }

  const storeUrl = normalizeStoreUrl(opts.brand.storeUrl);
  const assistant = await storage.createAiAssistant({
    userId: opts.userId,
    organizationId: opts.organizationId,
    name: assistantName,
    promptType: "predefined",
    agentRole: "customer_support",
    customPrompt: `You are a friendly customer support agent for ${brandName}${
      storeUrl ? ` (${storeUrl})` : ""
    }. Answer from the knowledge base. Be concise and helpful. Do not invent order or tracking details.`,
    model: "gpt-4o-mini",
  });
  await storage.addAiAssistantKnowledgeFile({
    assistantId: assistant.id,
    fileName: kbFileName,
    content: kb,
    sizeBytes: Buffer.byteLength(kb, "utf-8"),
    mimeType: "text/rich",
  });
  return assistant.id;
}

export async function runShopifyAutomationsSetup(opts: {
  userId: string;
  organizationId: string;
  brandName?: string;
  storeUrl?: string;
}): Promise<ShopifyAutomationsSetupResult> {
  const warnings: string[] = [];
  const testing: string[] = [];
  const flowsOut: ShopifyAutomationsSetupResult["flows"] = [];
  const chatbotsOut: ShopifyAutomationsSetupResult["chatbots"] = [];

  const sessions = await storage.getSessionsByOrganization(opts.organizationId);
  const session =
    sessions.find((s) => s.connectionType === "official" && s.status === "connected") ||
    sessions.find((s) => s.status === "connected");
  if (!session) {
    throw new Error("Connect WhatsApp Business API first (Integrations → WhatsApp).");
  }

  const creds = await resolveOfficialCredentialsForSession(
    session.sessionId,
    opts.userId,
    opts.organizationId
  );
  if (!creds?.accessToken || !creds.phoneNumberId) {
    throw new Error("WhatsApp credentials not found. Reconnect WhatsApp Business API.");
  }

  const shopify = (await storage.getIntegrationsByOrganization(opts.organizationId)).find(
    (i) => i.name === "shopify" && i.status === "connected"
  );
  if (!shopify) {
    throw new Error("Connect Shopify first (Integrations → Shopify).");
  }

  const cfg = (shopify.config || {}) as Record<string, unknown>;
  const credentials = shopify.credentials as Record<string, string> | null;
  const shopDomain =
    (cfg.shop_domain as string) ||
    (cfg.shopDomain as string) ||
    credentials?.shop_domain ||
    "";
  const accessToken = credentials?.access_token || "";

  let brandName = normalizeBrandName(opts.brandName);
  let storeUrl = normalizeStoreUrl(opts.storeUrl);

  if ((!opts.brandName?.trim() || !storeUrl) && shopDomain && accessToken) {
    const shop = await fetchShopifyShopProfile({ shopDomain, accessToken });
    if (!opts.brandName?.trim() && shop.name) brandName = normalizeBrandName(shop.name);
    if (!storeUrl && (shop.domain || shop.myshopifyDomain)) {
      storeUrl = normalizeStoreUrl(shop.domain || shop.myshopifyDomain);
    }
  }
  if (!opts.brandName?.trim() && brandName === "Our Store" && shopDomain) {
    brandName = normalizeBrandName(String(shopDomain).split(".")[0]);
  }

  const brand: ShopifySetupBrand = { brandName, storeUrl };

  let shopifyWebhooksRegistered = false;
  try {
    if (shopDomain && accessToken) {
      const webhooks = await registerShopifyWebhooksForIntegration({
        integrationId: shopify.id,
        shopDomain,
        accessToken,
        panelBaseUrl: BASE_URL,
      });
      await storage.updateIntegration(shopify.id, opts.userId, {
        config: {
          ...cfg,
          webhooksRegistered: webhooks.registered,
          webhooksErrors: webhooks.errors,
          webhooksRegisteredAt: new Date().toISOString(),
          webhooksSkipped: webhooks.skipped || false,
          webhooksSkipReason: webhooks.skipReason,
        },
      });
      shopifyWebhooksRegistered = webhooks.registered.length > 0 && !webhooks.skipped;
    }
  } catch (e) {
    warnings.push(
      `Shopify webhooks: ${e instanceof Error ? e.message : "registration failed"} — use Integrations → Register webhooks manually.`
    );
  }

  let templatesSubmitted = 0;
  let templatesSkipped = 0;
  const templatesFailed: string[] = [];
  const templates = buildShopifyWhatsAppTemplates(brandName);
  const wabaId =
    creds.businessAccountId ||
    (session.deviceInfo?.wabaId as string | undefined) ||
    (session.deviceInfo?.businessAccountId as string | undefined) ||
    "";

  if (!wabaId) {
    warnings.push("WABA ID not found — templates were not submitted to Meta. Create templates manually.");
  } else {
    for (const t of templates) {
      const result = await submitShopifyTemplate({
        userId: opts.userId,
        organizationId: opts.organizationId,
        template: t,
        accessToken: creds.accessToken,
        businessAccountId: wabaId,
        phoneNumberId: creds.phoneNumberId,
      });
      if (result === "created") templatesSubmitted++;
      else if (result === "skipped") templatesSkipped++;
      else templatesFailed.push(t.name);
    }
  }

  const assistantId = await ensureAiAssistant({
    userId: opts.userId,
    organizationId: opts.organizationId,
    brand,
  });

  const supportBot = await createSupportChatbot({
    userId: opts.userId,
    organizationId: opts.organizationId,
    sessionId: session.sessionId,
    assistantId,
    brandName,
  });
  if (supportBot) chatbotsOut.push(supportBot);

  const codBot = await createCodChatbot({
    userId: opts.userId,
    organizationId: opts.organizationId,
    sessionId: session.sessionId,
    brandName,
  });
  if (codBot) chatbotsOut.push(codBot);

  const existingFlows = await storage.getAutomationFlowsByOrganization(opts.organizationId);
  // Only skip duplicate [Shopify] flows — do not treat old Intense Focus / Commerce packs as this setup.
  const existingNames = new Set(
    existingFlows.filter((f) => f.name.startsWith(SHOPIFY_SETUP_PREFIX)).map((f) => f.name)
  );

  let flowsCreated = 0;
  let flowsSkipped = 0;
  const flowDefs = buildShopifyAutomationFlows(session.sessionId);

  for (const def of flowDefs) {
    if (existingNames.has(def.name)) {
      flowsSkipped++;
      const existing = existingFlows.find((f) => f.name === def.name);
      if (existing) {
        const isWebhook = def.nodes.some(
          (n) => n.data?.selectedTrigger === "catch-raw-webhook"
        );
        flowsOut.push({
          id: existing.id,
          name: existing.name,
          webhookUrl: isWebhook ? flowWebhookUrl(existing.id) : undefined,
          notes: def.notes,
        });
      }
      continue;
    }
    const flow = await storage.createAutomationFlow({
      userId: opts.userId,
      organizationId: opts.organizationId,
      name: def.name,
      status: "inactive",
      nodes: def.nodes,
      edges: def.edges,
      linearFlow: null,
    });
    flowsCreated++;
    const isWebhook = def.nodes.some((n) => n.data?.selectedTrigger === "catch-raw-webhook");
    flowsOut.push({
      id: flow.id,
      name: flow.name,
      webhookUrl: isWebhook ? flowWebhookUrl(flow.id) : undefined,
      notes: def.notes,
    });
  }

  const openAi = await storage.getIntegrationByName("openai", opts.userId, opts.organizationId);
  if (!openAi || openAi.status !== "connected") {
    warnings.push("OpenAI is not connected — link OpenAI in Integrations so the support bot can reply with AI.");
  }

  if (templatesSubmitted > 0) {
    testing.push("Wait 24–48 hours for Meta to approve WhatsApp templates (Templates page).");
  }
  testing.push(`Flows → open each ${SHOPIFY_SETUP_PREFIX} flow → Publish when templates show APPROVED.`);
  testing.push(
    "Shopify Admin → Settings → Notifications → Webhooks → Order update → paste shipping/review flow webhook URL."
  );
  testing.push("Place a test order with your WhatsApp number → expect one order confirmation.");
  testing.push("Abandon a test cart → expect recovery message after 1 hour (when flow is published).");
  testing.push(`Message hi on WhatsApp → ${brandName} support bot should reply.`);
  testing.push("Place COD test order → COD template → reply YES → confirmation message.");
  testing.push("Unpublish any old [Intense Focus] or duplicate [Commerce] flows so each event sends only once.");

  return {
    success: true,
    brandName,
    storeUrl,
    summary: {
      flowsCreated,
      flowsSkipped,
      templatesSubmitted,
      templatesSkipped,
      templatesFailed,
      assistantCreated: true,
      supportChatbotCreated: !!supportBot,
      codChatbotCreated: !!codBot,
      shopifyWebhooksRegistered,
    },
    flows: flowsOut,
    assistantId,
    chatbots: chatbotsOut,
    testing,
    warnings,
  };
}

/** @deprecated Use runShopifyAutomationsSetup */
export async function runEyewearAutomationSetup(opts: {
  userId: string;
  organizationId: string;
  brandName?: string;
  storeUrl?: string;
}): Promise<ShopifyAutomationsSetupResult> {
  return runShopifyAutomationsSetup(opts);
}
