// @ts-nocheck
import type { Express } from "express";
import { randomUUID } from "crypto";
import { isAuthenticated } from "../../replitAuth";
import { resolveOrganizationContext } from "../../middleware/organization-context";
import { storage } from "../../storage";
import {
  buildWhatsAppChatWidgetPhoneOptions,
  buildWhatsAppWidgetLoaderScript,
  mergeWhatsAppChatWidgetConfig,
  normalizeWhatsAppPhone,
  type WhatsAppChatWidgetConfig,
} from "@shared/whatsapp-chat-widget";

const BASE_URL = (process.env.BASE_URL || "http://localhost:5002")
  .split(/\s*[\n#]/)[0]
  .trim()
  .replace(/\/+$/, "");

function getUserId(req: any): string {
  return req.user?.claims?.sub || req.userId;
}

async function getOrgWidgetIntegration(req: any) {
  const userId = getUserId(req);
  const organizationId = req.context?.organizationId;
  return storage.getIntegrationByName("whatsapp-chat-widget", userId, organizationId);
}

async function getOrgConnectedPhoneOptions(organizationId: string | undefined, userId: string) {
  const sessions = organizationId
    ? await storage.getSessionsByOrganization(organizationId)
    : await storage.getSessionsByUser(userId);
  return buildWhatsAppChatWidgetPhoneOptions(sessions);
}

async function resolvePublicOrganizationId(req: any): Promise<string | undefined> {
  let organizationId =
    (req.query.organizationId as string) ||
    process.env.WHITELABEL_ORG_ID ||
    process.env.VITE_WHITELABEL_ORG_ID;
  if (organizationId) return organizationId;

  const userId = req.user?.claims?.sub || req.user?.id || req.userId;
  if (userId) {
    const orgs = await storage.getOrganizationsByUser(userId);
    if (orgs.length > 0) return orgs[0].id;
  }

  const allOrgs = await storage.getAllOrganizations();
  return allOrgs.length > 0 ? allOrgs[0].id : undefined;
}

async function getWidgetIntegrationForOrganization(organizationId: string) {
  const integrations = await storage.getIntegrationsByOrganization(organizationId);
  return integrations.find(
    (i) => i.name === "whatsapp-chat-widget" && i.status === "connected",
  );
}

export function registerWhatsAppChatWidgetRoutes(app: Express) {
  app.get(
    "/api/integrations/whatsapp-chat-widget/phone-numbers",
    isAuthenticated,
    resolveOrganizationContext,
    async (req: any, res) => {
      try {
        const userId = getUserId(req);
        const organizationId = req.context?.organizationId;
        const phoneNumbers = await getOrgConnectedPhoneOptions(organizationId, userId);
        res.json({ phoneNumbers });
      } catch (error: any) {
        console.error("[WhatsAppChatWidget] phone-numbers error:", error);
        res.status(500).json({ message: error.message || "Failed to load phone numbers" });
      }
    },
  );

  app.get(
    "/api/integrations/whatsapp-chat-widget/config",
    isAuthenticated,
    resolveOrganizationContext,
    async (req: any, res) => {
      try {
        const integration = await getOrgWidgetIntegration(req);
        if (!integration || integration.status !== "connected") {
          return res.status(404).json({ message: "WhatsApp Chat Widget is not set up yet" });
        }
        const config = mergeWhatsAppChatWidgetConfig(integration.config as WhatsAppChatWidgetConfig);
        res.json({
          integrationId: integration.id,
          config,
        });
      } catch (error: any) {
        console.error("[WhatsAppChatWidget] config GET error:", error);
        res.status(500).json({ message: error.message || "Failed to load widget config" });
      }
    },
  );

  app.put(
    "/api/integrations/whatsapp-chat-widget/config",
    isAuthenticated,
    resolveOrganizationContext,
    async (req: any, res) => {
      try {
        const userId = getUserId(req);
        const organizationId = req.context?.organizationId;
        const integration = await getOrgWidgetIntegration(req);
        if (!integration?.id) {
          return res.status(404).json({ message: "WhatsApp Chat Widget is not set up yet" });
        }

        const incoming = mergeWhatsAppChatWidgetConfig(req.body?.config);
        const phoneOptions = await getOrgConnectedPhoneOptions(organizationId, userId);
        const phoneInputMode =
          incoming.phoneInputMode ||
          (incoming.sessionId ? "connected" : incoming.phoneNumber ? "manual" : "connected");

        if (phoneInputMode === "connected") {
          incoming.phoneInputMode = "connected";
          if (incoming.enabled && phoneOptions.length === 0) {
            return res.status(400).json({
              message: "Connect a WhatsApp number or switch to manual entry",
            });
          }

          if (incoming.sessionId) {
            const selected = phoneOptions.find((p) => p.sessionId === incoming.sessionId);
            if (!selected) {
              return res.status(400).json({ message: "Selected WhatsApp number is not connected" });
            }
            incoming.phoneNumber = selected.phoneNumber;
          } else if (incoming.phoneNumber) {
            incoming.phoneNumber = normalizeWhatsAppPhone(incoming.phoneNumber);
            const selected = phoneOptions.find((p) => p.phoneNumber === incoming.phoneNumber);
            if (!selected) {
              return res.status(400).json({ message: "Selected WhatsApp number is not connected" });
            }
            incoming.sessionId = selected.sessionId;
          }
        } else {
          incoming.phoneInputMode = "manual";
          incoming.sessionId = undefined;
          incoming.phoneNumber = normalizeWhatsAppPhone(incoming.phoneNumber);
          if (incoming.enabled && !incoming.phoneNumber) {
            return res.status(400).json({ message: "Enter a WhatsApp number with country code" });
          }
          if (incoming.phoneNumber && incoming.phoneNumber.length < 8) {
            return res.status(400).json({
              message: "Enter a valid WhatsApp number with country code (e.g. 919821273555)",
            });
          }
        }

        if (incoming.enabled && !incoming.phoneNumber) {
          return res.status(400).json({ message: "Select or enter a WhatsApp number" });
        }

        if (!incoming.widgetPublicId) {
          incoming.widgetPublicId = randomUUID();
        }

        const updated = await storage.updateIntegration(integration.id, userId, {
          status: "connected",
          config: incoming,
        });

        if (!updated) {
          return res.status(403).json({ message: "Failed to update widget settings" });
        }

        const config = mergeWhatsAppChatWidgetConfig(updated.config as WhatsAppChatWidgetConfig);
        res.json({
          integrationId: updated.id,
          config,
        });
      } catch (error: any) {
        console.error("[WhatsAppChatWidget] config PUT error:", error);
        res.status(500).json({ message: error.message || "Failed to save widget config" });
      }
    },
  );

  app.get("/api/public/whatsapp-chat-widget/active.js", async (req, res) => {
    try {
      const organizationId = await resolvePublicOrganizationId(req);
      if (!organizationId) {
        return res.type("application/javascript").send("// widget unavailable");
      }

      const integration = await getWidgetIntegrationForOrganization(organizationId);
      if (!integration) {
        return res.type("application/javascript").send("// widget not configured");
      }

      const config = mergeWhatsAppChatWidgetConfig(integration.config as WhatsAppChatWidgetConfig);
      if (!config.enabled || !normalizeWhatsAppPhone(config.phoneNumber)) {
        return res.type("application/javascript").send("// widget disabled");
      }

      const script = buildWhatsAppWidgetLoaderScript(config, BASE_URL);
      res.setHeader("Cache-Control", "public, max-age=300");
      res.type("application/javascript").send(script);
    } catch (error: any) {
      console.error("[WhatsAppChatWidget] active script error:", error);
      res.status(500).send("// widget error");
    }
  });

  app.get("/api/public/whatsapp-chat-widget/:widgetId.js", async (req, res) => {
    try {
      const widgetId = String(req.params.widgetId || "").replace(/\.js$/i, "").trim();
      if (!widgetId || widgetId === "active") {
        return res.status(400).send("// invalid widget id");
      }

      const integration = await storage.getWhatsAppChatWidgetByPublicId(widgetId);
      if (!integration) {
        return res.status(404).send("// widget not found");
      }

      const config = mergeWhatsAppChatWidgetConfig(integration.config as WhatsAppChatWidgetConfig);
      if (!config.enabled || !normalizeWhatsAppPhone(config.phoneNumber)) {
        return res.type("application/javascript").send("// widget disabled");
      }

      const script = buildWhatsAppWidgetLoaderScript(config, BASE_URL);
      res.setHeader("Cache-Control", "public, max-age=300");
      res.type("application/javascript").send(script);
    } catch (error: any) {
      console.error("[WhatsAppChatWidget] public script error:", error);
      res.status(500).send("// widget error");
    }
  });
}

export function defaultWhatsAppChatWidgetConfig(): WhatsAppChatWidgetConfig {
  const config = mergeWhatsAppChatWidgetConfig({});
  config.widgetPublicId = randomUUID();
  return config;
}
