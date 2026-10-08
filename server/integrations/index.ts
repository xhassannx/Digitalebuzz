// @ts-nocheck
import type { Express } from "express";
import crypto from "crypto";
import { storage } from "../storage";
import { insertIntegrationSchema } from "@shared/schema";
import { isAuthenticated } from "../replitAuth";
import { resolveOrganizationContext, requirePermission } from "../middleware/organization-context";
import { z } from "zod";
import { registerGoogleOAuthRoutes } from "./oauth/google";
import { registerFacebookOAuthRoutes } from "./oauth/facebook";
import { registerWhatsAppBusinessOAuthRoutes } from "./oauth/whatsapp-business";
import { registerSMTPRoutes } from "./handlers/smtp";
import { registerIndiaMartRoutes } from "./handlers/indiamart";
import { registerExportersIndiaRoutes } from "./handlers/exportersindia";
import { registerTradeIndiaRoutes } from "./handlers/tradeindia";
import { registerCalendlyRoutes } from "./handlers/calendly";
import { registerGoogleSheetsRoutes } from "./handlers/google-sheets";
import { registerGoogleCalendarRoutes } from "./handlers/google-calendar";
import { registerTelegramRoutes } from "./handlers/telegram";
import { registerShopifyRoutes } from "./handlers/shopify";
import { registerWooCommerceRoutes } from "./handlers/woocommerce";
import { registerJustDialRoutes } from "./handlers/justdial";
import { registerRazorpayFlowRoutes } from "./handlers/razorpay-flows";
import { registerFacebookLeadsRoutes } from "./handlers/facebook-leads";
import { registerWhatsAppBusinessRoutes } from "./handlers/whatsapp-business";
import { registerPaymentGatewayRoutes } from "./handlers/payment-gateways";
import {
  registerWhatsAppChatWidgetRoutes,
  defaultWhatsAppChatWidgetConfig,
} from "./handlers/whatsapp-chat-widget";
import { registerWhatsAppWidgetChatRoutes } from "./handlers/whatsapp-widget-chat";
import { mergeWhatsAppChatWidgetConfig } from "@shared/whatsapp-chat-widget";
import { RazorpayClient } from "../payment/razorpay-client";
import { razorpayAuthFailureHelp, isRazorpayAuthenticationError } from "../payment/saas-subscription-razorpay";

function mergeRazorpayCredentials(
  incoming: Record<string, unknown>,
  existing: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const merged = { ...incoming };
  const prev = (existing || {}) as Record<string, string>;
  const keySecret = String(merged.keySecret ?? merged.key_secret ?? "").trim();
  const keyId = String(merged.keyId ?? merged.key_id ?? "").trim();
  if (!keySecret && (prev.keySecret || prev.key_secret)) {
    merged.keySecret = prev.keySecret || prev.key_secret;
  }
  if (!keyId && (prev.keyId || prev.key_id)) {
    merged.keyId = prev.keyId || prev.key_id;
  }
  return merged;
}

async function verifyRazorpayOrgSubscriptionCredentials(credentials: Record<string, unknown>) {
  const keyId = String(credentials.keyId ?? credentials.key_id ?? "").trim();
  const keySecret = String(credentials.keySecret ?? credentials.key_secret ?? "").trim();
  if (!keyId || !keySecret) {
    throw new Error("Razorpay Key ID and Key Secret are required for organization subscription billing.");
  }
  const client = new RazorpayClient({ keyId, keySecret });
  await client.verifyCredentials();
}

// Integration definitions with metadata
export const INTEGRATION_DEFINITIONS = {
  // Featured integrations
  "whatsapp-business": {
    name: "whatsapp-business",
    displayName: "Whatsapp Business",
    category: "featured" as const,
    authType: "oauth" as const,
    description: "Connect with customers on their favorite messaging app. Send updates, support messages, and more directly...",
  },
  "facebook-lead-ads": {
    name: "facebook-lead-ads",
    displayName: "Facebook Lead Ads",
    category: "featured" as const,
    authType: "oauth" as const,
    description: "Automate lead generation and manage customer inquiries directly from Facebook. Capture leads, respond to...",
  },
  razorpay: {
    name: "razorpay",
    displayName: "Razorpay",
    category: "featured" as const,
    authType: "api_key" as const,
    description:
      "Collect payments via payment links (e.g. WhatsApp) and optionally bill customer subscriptions on your whitelabel. Add keys from Razorpay Dashboard → API Keys; set webhooks using the URL from setup.",
  },
  cashfree: {
    name: "cashfree",
    displayName: "Cashfree",
    category: "featured" as const,
    authType: "api_key" as const,
    description:
      "Collect payments via Cashfree payment links and optionally use for organization subscription billing. Configure App ID & Secret from Cashfree Merchant Dashboard; add webhook URL from setup.",
  },
  stripe: {
    name: "stripe",
    displayName: "Stripe",
    category: "featured" as const,
    authType: "api_key" as const,
    description:
      "USD subscription checkout on the customer panel. Whitelabel admin only: add Secret key and Webhook signing secret from Stripe Dashboard, enable “Organization subscription billing”, and register the webhook URL from setup.",
  },
  "indiamart": {
    name: "indiamart",
    displayName: "IndiaMart",
    category: "featured" as const,
    authType: "api_key" as const,
    description: "Get leads from IndiaMart and sync them to our CRM.",
  },
  "exportersindia": {
    name: "exportersindia",
    displayName: "ExportersIndia",
    category: "featured" as const,
    authType: "api_key" as const,
    description: "Get leads from ExportersIndia and sync them to our CRM.",
  },
  // Flow integrations
  "calendly": {
    name: "calendly",
    displayName: "Calendly",
    category: "flow" as const,
    authType: "oauth" as const,
    description: "Configure and manage this flow integration",
  },
  "google-calendar": {
    name: "google-calendar",
    displayName: "Google Calendar",
    category: "flow" as const,
    authType: "oauth" as const,
    description: "Configure and manage this flow integration",
  },
  "google-contacts": {
    name: "google-contacts",
    displayName: "Google Contacts",
    category: "flow" as const,
    authType: "oauth" as const,
    description: "Configure and manage this flow integration",
  },
  "google-gemini": {
    name: "google-gemini",
    displayName: "Google Gemini",
    category: "flow" as const,
    authType: "api_key" as const,
    description: "Configure and manage this flow integration",
  },
  "google-sheets": {
    name: "google-sheets",
    displayName: "Google Sheets",
    category: "flow" as const,
    authType: "oauth" as const,
    description: "Configure and manage this flow integration",
  },
  "openai": {
    name: "openai",
    displayName: "OpenAI",
    category: "flow" as const,
    authType: "api_key" as const,
    description: "Configure and manage this flow integration",
  },
  "shopify": {
    name: "shopify",
    displayName: "Shopify",
    category: "flow" as const,
    authType: "api_key" as const,
    description: "Connect your Shopify store with Admin API credentials to power flows and webhooks.",
  },
  "smtp": {
    name: "smtp",
    displayName: "SMTP",
    category: "flow" as const,
    authType: "api_key" as const,
    description: "Configure and manage this flow integration",
  },
  "telegram": {
    name: "telegram",
    displayName: "Telegram",
    category: "flow" as const,
    authType: "api_key" as const,
    description: "Configure and manage this flow integration",
  },
  "tradeindia": {
    name: "tradeindia",
    displayName: "Tradeindia",
    category: "flow" as const,
    authType: "api_key" as const,
    description: "Configure and manage this flow integration",
  },
  "woocommerce": {
    name: "woocommerce",
    displayName: "Woocommerce",
    category: "flow" as const,
    authType: "api_key" as const,
    description: "Connect your WooCommerce store with REST API keys to power flows and webhooks.",
  },
  "zoom-webhook": {
    name: "zoom-webhook",
    displayName: "Zoom (Webhook)",
    category: "flow" as const,
    authType: "webhook" as const,
    description: "Configure and manage this flow integration",
  },
  "n8n": {
    name: "n8n",
    displayName: "n8n",
    category: "flow" as const,
    authType: "webhook" as const,
    description: "Connect WhatsApp events to n8n workflows. Receive messages, send replies, and automate with 400+ apps.",
  },
  "whatsapp-chat-widget": {
    name: "whatsapp-chat-widget",
    displayName: "WhatsApp Chat Widget",
    category: "helper" as const,
    authType: "none" as const,
    description:
      "Add a floating WhatsApp button and chat widget to your public website. Configure appearance and behavior from this panel — no code required.",
  },
  "whatsapp-link-generator": {
    name: "whatsapp-link-generator",
    displayName: "WhatsApp Link Generator",
    category: "helper" as const,
    authType: "none" as const,
    description:
      "Create a click-to-chat WhatsApp URL with a pre-filled message and QR code to share on social media, websites, and print.",
  },
} as const;

export function registerIntegrationRoutes(app: Express) {
  const getUserId = (req: any): string => {
    return req.user?.claims?.sub || req.userId;
  };

  // Get all available integrations
  app.get("/api/integrations/available", isAuthenticated, async (req: any, res) => {
    try {
      const integrations = Object.values(INTEGRATION_DEFINITIONS);
      res.json(integrations);
    } catch (error: any) {
      console.error("Error fetching available integrations:", error);
      res.status(500).json({ message: "Failed to fetch available integrations" });
    }
  });

  // Get connected integrations – org-scoped so team members see all org integrations
  app.get("/api/integrations", isAuthenticated, resolveOrganizationContext, requirePermission("integrations.view"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;

      const userIntegrations = organizationId
        ? await storage.getIntegrationsByOrganization(organizationId)
        : await storage.getIntegrationsByUser(userId, organizationId);

      const enriched = userIntegrations.map(integration => {
        const definition = INTEGRATION_DEFINITIONS[integration.name as keyof typeof INTEGRATION_DEFINITIONS];
        return {
          ...integration,
          displayName: definition?.displayName || integration.displayName,
          description: definition?.description || "",
        };
      });
      
      res.json(enriched);
    } catch (error: any) {
      console.error("Error fetching integrations:", error);
      res.status(500).json({ message: "Failed to fetch integrations" });
    }
  });

  // Get specific integration
  app.get("/api/integrations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const integration = await storage.getIntegration(req.params.id, userId);
      
      if (!integration) {
        return res.status(404).json({ message: "Integration not found" });
      }
      
      const definition = INTEGRATION_DEFINITIONS[integration.name as keyof typeof INTEGRATION_DEFINITIONS];
      res.json({
        ...integration,
        displayName: definition?.displayName || integration.displayName,
        description: definition?.description || "",
      });
    } catch (error: any) {
      console.error("Error fetching integration:", error);
      res.status(500).json({ message: "Failed to fetch integration" });
    }
  });

  // Create/Connect integration
  app.post("/api/integrations", isAuthenticated, resolveOrganizationContext, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      const { name, config, credentials } = req.body;

      if (!name || !INTEGRATION_DEFINITIONS[name as keyof typeof INTEGRATION_DEFINITIONS]) {
        return res.status(400).json({ message: "Invalid integration name" });
      }

      const definition = INTEGRATION_DEFINITIONS[name as keyof typeof INTEGRATION_DEFINITIONS];
      
      if (name === "whatsapp-chat-widget") {
        const widgetConfig = {
          ...defaultWhatsAppChatWidgetConfig(),
          ...(config || {}),
        };
        const existingWidget = await storage.getIntegrationByName(name, userId, organizationId);
        if (existingWidget) {
          const updated = await storage.updateIntegration(existingWidget.id!, userId, {
            status: "connected",
            config: mergeWhatsAppChatWidgetConfig({
              ...(existingWidget.config as object),
              ...widgetConfig,
            }),
          });
          return res.json(updated);
        }
        const integration = await storage.createIntegration({
          userId,
          organizationId,
          name,
          displayName: definition.displayName,
          category: definition.category,
          status: "connected",
          authType: definition.authType,
          config: widgetConfig,
          credentials: {},
        });
        return res.status(201).json(integration);
      }

      // For WhatsApp Business and OpenAI, always create a new integration to allow multiple connections
      if (name === "whatsapp-business" || name === "openai") {
        const integration = await storage.createIntegration({
          userId,
          organizationId,
          name,
          displayName: definition.displayName,
          category: definition.category,
          status: "connected",
          authType: definition.authType,
          config: config || {},
          credentials: credentials || {},
        });
        return res.status(201).json(integration);
      }
      
      // For IndiaMart and ExportersIndia, generate access token if not provided
      let finalCredentials = credentials || {};
      if (name === "indiamart" || name === "exportersindia") {
        const { randomBytes } = await import("crypto");
        const generateAccessToken = () => randomBytes(32).toString("hex");
        
        // If no token provided, generate one
        if (!finalCredentials.accessToken && !finalCredentials.apiKey && !finalCredentials.api_key) {
          const accessToken = generateAccessToken();
          finalCredentials = {
            ...finalCredentials,
            accessToken,
            apiKey: accessToken, // Keep apiKey for backward compatibility
          };
        } else if (finalCredentials.apiKey && !finalCredentials.accessToken) {
          // If apiKey provided but no accessToken, use apiKey as accessToken
          finalCredentials.accessToken = finalCredentials.apiKey;
        } else if (finalCredentials.accessToken && !finalCredentials.apiKey) {
          // If accessToken provided but no apiKey, use accessToken as apiKey
          finalCredentials.apiKey = finalCredentials.accessToken;
        }
      }
      
      // For n8n: create or update webhook when webhookUrl is provided
      if (name === "n8n") {
        const webhookUrl = (String(finalCredentials.webhookUrl || finalCredentials.webhook_url || "")).trim();
        if (webhookUrl) {
          const existingN8n = await storage.getIntegrationByName(name, userId, organizationId);
          const webhookSecret = `whsec_${crypto.randomUUID()}`;
          const webhookEvents = ["messages", "contacts", "app_events", "session.connected", "session.disconnected", "chat.new"] as const; // Messages, contacts, app integrations, sessions, chats

          if (existingN8n?.config?.n8nWebhookId) {
            await storage.updateWebhook(existingN8n.config.n8nWebhookId, {
              url: webhookUrl,
              secret: webhookSecret,
              events: webhookEvents,
              status: "active",
            });
          } else {
            const webhook = await storage.createWebhook({
              userId,
              organizationId: organizationId || undefined,
              url: webhookUrl,
              events: webhookEvents,
              secret: webhookSecret,
              status: "active",
            });
            (finalCredentials as any)._n8nWebhookId = webhook.id;
          }
        }
      }

      // For other integrations, check if integration already exists
      const existing = await storage.getIntegrationByName(name, userId, organizationId);
      
      if (existing) {
        // Update existing integration; only send credentials if provided (avoid clearing when re-configuring)
        const updatePayload: { status: string; config?: Record<string, any>; credentials?: Record<string, any> } = { status: "connected" };
        if (config !== undefined) updatePayload.config = config;
        if (credentials !== undefined) {
          if (name === "razorpay") {
            finalCredentials = mergeRazorpayCredentials(finalCredentials, existing.credentials as Record<string, unknown>);
          }
          updatePayload.credentials = finalCredentials;
        }
        const nextConfig = updatePayload.config ?? (existing.config as Record<string, unknown> | undefined);
        if (
          name === "razorpay" &&
          nextConfig?.useForOrgSubscription === true &&
          updatePayload.credentials
        ) {
          try {
            await verifyRazorpayOrgSubscriptionCredentials(updatePayload.credentials);
          } catch (verifyErr: any) {
            return res.status(400).json({
              message: isRazorpayAuthenticationError(verifyErr?.message)
                ? razorpayAuthFailureHelp()
                : verifyErr?.message || "Could not verify Razorpay credentials",
            });
          }
        }
        const updated = await storage.updateIntegration(existing.id, userId, updatePayload);
        return res.json(updated);
      }

      if (
        name === "razorpay" &&
        (config as Record<string, unknown> | undefined)?.useForOrgSubscription === true
      ) {
        try {
          await verifyRazorpayOrgSubscriptionCredentials(finalCredentials);
        } catch (verifyErr: any) {
          return res.status(400).json({
            message: isRazorpayAuthenticationError(verifyErr?.message)
              ? razorpayAuthFailureHelp()
              : verifyErr?.message || "Could not verify Razorpay credentials",
          });
        }
      }

      // Create new integration
      const finalConfig: Record<string, any> = { ...(config || {}) };
      if (name === "n8n" && (finalCredentials as any)._n8nWebhookId) {
        finalConfig.n8nWebhookId = (finalCredentials as any)._n8nWebhookId;
        delete (finalCredentials as any)._n8nWebhookId;
      }
      const integration = await storage.createIntegration({
        userId,
        organizationId,
        name,
        displayName: definition.displayName,
        category: definition.category,
        status: "connected",
        authType: definition.authType,
        config: finalConfig,
        credentials: finalCredentials,
      });

      res.status(201).json(integration);
    } catch (error: any) {
      console.error("Error creating integration:", error);
      res.status(500).json({ message: error.message || "Failed to create integration" });
    }
  });

  // Update integration
  app.put("/api/integrations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { config, credentials, status } = req.body;

      const existing = await storage.getIntegration(req.params.id, userId);
      if (!existing) {
        return res.status(404).json({ message: "Integration not found" });
      }

      const updateData: any = {};
      if (config !== undefined) updateData.config = config;
      if (credentials !== undefined) {
        updateData.credentials =
          existing.name === "razorpay"
            ? mergeRazorpayCredentials(credentials, existing.credentials as Record<string, unknown>)
            : credentials;
      }
      if (status !== undefined) updateData.status = status;

      const nextConfig = updateData.config ?? (existing.config as Record<string, unknown> | undefined);
      if (
        existing.name === "razorpay" &&
        nextConfig?.useForOrgSubscription === true &&
        updateData.credentials
      ) {
        try {
          await verifyRazorpayOrgSubscriptionCredentials(updateData.credentials);
        } catch (verifyErr: any) {
          return res.status(400).json({
            message: isRazorpayAuthenticationError(verifyErr?.message)
              ? razorpayAuthFailureHelp()
              : verifyErr?.message || "Could not verify Razorpay credentials",
          });
        }
      }

      const updated = await storage.updateIntegration(req.params.id, userId, updateData);
      
      if (!updated) {
        return res.status(404).json({ message: "Integration not found" });
      }

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating integration:", error);
      res.status(500).json({ message: error.message || "Failed to update integration" });
    }
  });

  // Delete/Disconnect integration
  app.delete("/api/integrations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      
      // Get integration details before deleting to check if it's WhatsApp Business
      const integration = await storage.getIntegration(req.params.id, userId);
      
      // Delete the integration
      await storage.deleteIntegration(req.params.id, userId);
      
      // If it's WhatsApp Business, clean up associated sessions
      if (integration && integration.name === "whatsapp-business") {
        console.log(`[Integration Delete] Cleaning up WhatsApp Business sessions for user ${userId}`);
        try {
          // Get all WhatsApp sessions for this user
          const sessions = await storage.getSessionsByUser(userId);
          
          // Delete sessions that are using Business API (official connection type)
          for (const session of sessions) {
            if (session.connectionType === 'official') {
              console.log(`[Integration Delete] Deleting session ${session.sessionId} (${session.name || 'unnamed'})`);
              await storage.deleteSession(session.sessionId);
            }
          }
          console.log(`[Integration Delete] Cleaned up WhatsApp Business sessions`);
        } catch (sessionError: any) {
          console.error(`[Integration Delete] Error cleaning up sessions:`, sessionError);
          // Don't fail the integration deletion if session cleanup fails
        }
      }
      
      res.json({ message: "Integration deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting integration:", error);
      res.status(500).json({ message: "Failed to delete integration" });
    }
  });

  // Register OAuth routes
  registerGoogleOAuthRoutes(app);
  registerFacebookOAuthRoutes(app);
  registerWhatsAppBusinessOAuthRoutes(app);

  // Register integration-specific routes
  registerSMTPRoutes(app);
  registerIndiaMartRoutes(app);
  registerExportersIndiaRoutes(app);
  registerTradeIndiaRoutes(app);
  registerCalendlyRoutes(app);
  registerGoogleSheetsRoutes(app);
  registerGoogleCalendarRoutes(app);
  registerTelegramRoutes(app);
  registerShopifyRoutes(app);
  registerWooCommerceRoutes(app);
  registerJustDialRoutes(app);
  registerRazorpayFlowRoutes(app);
  registerFacebookLeadsRoutes(app);
  registerWhatsAppBusinessRoutes(app);
  registerPaymentGatewayRoutes(app);
  registerWhatsAppChatWidgetRoutes(app);
  registerWhatsAppWidgetChatRoutes(app);
}

