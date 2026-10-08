import type { Express } from "express";
import { randomBytes } from "crypto";
import { isAuthenticated } from "../../replitAuth";
import { resolveOrganizationContext } from "../../middleware/organization-context";
import { storage } from "../../storage";
import { dispatchLeadFlowsForIntegration, normalizeLeadsFromWebhookBody } from "../../automation/lead-dispatch";

const INDIAMART_API_BASE = process.env.INDIAMART_API_BASE || "https://api.indiamart.com";
const BASE_URL = (process.env.BASE_URL || process.env.WEBHOOK_URL || "http://localhost:5002").split(/\s*[\n#]/)[0].trim().replace(/\/+$/, "");

// Generate a secure random token
function generateAccessToken(): string {
  return randomBytes(32).toString("hex");
}

export function registerIndiaMartRoutes(app: Express) {
  const getUserId = (req: any): string => {
    return req.user?.claims?.sub || req.userId;
  };

  // Get IndiaMart configuration
  app.get("/api/integrations/indiamart/config", isAuthenticated, resolveOrganizationContext, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      const integration = await storage.getIntegrationByName("indiamart", userId, organizationId);

      if (!integration || integration.status !== "connected") {
        return res.status(404).json({ message: "IndiaMart integration not found or not connected" });
      }

      const credentials = integration.credentials as any;
      const accessToken = credentials.accessToken || credentials.apiKey || credentials.api_key;

      res.json({
        accessToken: accessToken || null,
        integrationId: integration.id,
      });
    } catch (error: any) {
      console.error("IndiaMart config error:", error);
      res.status(500).json({ message: error.message || "Failed to fetch configuration" });
    }
  });

  // Get webhook URL
  app.get("/api/integrations/indiamart/webhook-url", isAuthenticated, resolveOrganizationContext, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      const integration = await storage.getIntegrationByName("indiamart", userId, organizationId);

      if (!integration || integration.status !== "connected") {
        return res.status(404).json({ message: "IndiaMart integration not found or not connected" });
      }

      const credentials = integration.credentials as any;
      const accessToken = credentials.accessToken || credentials.apiKey || credentials.api_key;

      if (!accessToken) {
        return res.status(400).json({ message: "Access token not configured" });
      }

      const webhookUrl = `${BASE_URL}/api/webhook/indiamart/${accessToken}`;
      res.json({ webhookUrl });
    } catch (error: any) {
      console.error("IndiaMart webhook URL error:", error);
      res.status(500).json({ message: error.message || "Failed to generate webhook URL" });
    }
  });

  // Regenerate access token
  app.post("/api/integrations/indiamart/regenerate-token", isAuthenticated, resolveOrganizationContext, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      const integration = await storage.getIntegrationByName("indiamart", userId, organizationId);

      if (!integration || integration.status !== "connected") {
        return res.status(404).json({ message: "IndiaMart integration not found or not connected" });
      }

      const newAccessToken = generateAccessToken();
      const credentials = integration.credentials as any || {};
      
      await storage.updateIntegration(integration.id!, userId, {
        credentials: {
          ...credentials,
          accessToken: newAccessToken,
          apiKey: newAccessToken, // Keep apiKey for backward compatibility
        },
      });

      const webhookUrl = `${BASE_URL}/api/webhook/indiamart/${newAccessToken}`;
      res.json({
        accessToken: newAccessToken,
        webhookUrl,
      });
    } catch (error: any) {
      console.error("IndiaMart regenerate token error:", error);
      res.status(500).json({ message: error.message || "Failed to regenerate token" });
    }
  });

  // Sync leads from IndiaMart
  app.post("/api/integrations/indiamart/sync-leads", isAuthenticated, resolveOrganizationContext, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      const { integrationId, startDate, endDate } = req.body;

      // Get IndiaMart integration
      let integration;
      if (integrationId) {
        integration = await storage.getIntegration(integrationId, userId);
      } else {
        integration = await storage.getIntegrationByName("indiamart", userId, organizationId);
      }

      if (!integration || integration.status !== "connected" || !integration.credentials) {
        return res.status(404).json({ message: "IndiaMart integration not found or not connected" });
      }

      const credentials = integration.credentials as any;
      const apiKey = credentials.apiKey || credentials.api_key;

      if (!apiKey) {
        return res.status(400).json({ message: "IndiaMart API key not configured" });
      }

      // Fetch leads from IndiaMart API
      const leadsResponse = await fetch(`${INDIAMART_API_BASE}/leads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate,
        }),
      });

      if (!leadsResponse.ok) {
        const errorData = await leadsResponse.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to fetch leads from IndiaMart");
      }

      const leadsData = await leadsResponse.json();
      const leads = leadsData.leads || leadsData.data || [];

      // Update last sync time
      await storage.updateIntegration(integration.id!, userId, {
        lastSyncAt: new Date(),
      });

      res.json({
        success: true,
        leads,
        count: leads.length,
        syncedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("IndiaMart sync error:", error);
      res.status(500).json({ message: error.message || "Failed to sync leads from IndiaMart" });
    }
  });

  // Webhook endpoint for IndiaMart to push leads (using access token in URL)
  app.post("/api/webhook/indiamart/:accessToken", async (req: any, res) => {
    try {
      const { accessToken } = req.params;
      const { leads, api_key } = req.body;

      // Support both URL token and body api_key for backward compatibility
      const token = accessToken || api_key;

      if (!token) {
        return res.status(400).json({ message: "Missing access token" });
      }

      // Find integration by access token
      // Note: In production, you'd want to verify the webhook signature
      const integrations = await storage.getIntegrationsByUser("", undefined);
      const integration = integrations.find(
        (int) =>
          int.name === "indiamart" &&
          ((int.credentials as any)?.accessToken === token ||
            (int.credentials as any)?.apiKey === token ||
            (int.credentials as any)?.api_key === token)
      );

      if (!integration) {
        return res.status(404).json({ message: "Integration not found" });
      }

      const leadsToProcess = normalizeLeadsFromWebhookBody(req.body || {});
      let processed = 0;
      if (process.env.AUTOMATION_FLOWS_ENABLED !== "false" && leadsToProcess.length > 0) {
        processed = await dispatchLeadFlowsForIntegration({
          canvasTriggerId: "new-lead",
          integration: {
            id: integration.id!,
            userId: integration.userId,
            organizationId: integration.organizationId,
          },
          leads: leadsToProcess,
        });
      }

      console.log(`[IndiaMart Webhook] ${processed} lead(s) for integration ${integration.id}`);
      res.json({ success: true, processed });
    } catch (error: any) {
      console.error("IndiaMart webhook error:", error);
      res.status(500).json({ message: "Failed to process webhook" });
    }
  });

  // Legacy webhook endpoint (backward compatibility)
  app.post("/api/integrations/indiamart/webhook", async (req: any, res) => {
    try {
      const { api_key, leads } = req.body;

      if (!api_key || !leads) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Find integration by API key
      const integrations = await storage.getIntegrationsByUser("", undefined);
      const integration = integrations.find(
        (int) => int.name === "indiamart" && (int.credentials as any)?.apiKey === api_key
      );

      if (!integration) {
        return res.status(404).json({ message: "Integration not found" });
      }

      const leadsToProcess = normalizeLeadsFromWebhookBody({ leads, ...(req.body || {}) });
      let processed = 0;
      if (process.env.AUTOMATION_FLOWS_ENABLED !== "false" && leadsToProcess.length > 0) {
        processed = await dispatchLeadFlowsForIntegration({
          canvasTriggerId: "new-lead",
          integration: {
            id: integration.id!,
            userId: integration.userId,
            organizationId: integration.organizationId,
          },
          leads: leadsToProcess,
        });
      }
      console.log(`[IndiaMart Webhook] ${processed} lead(s) for integration ${integration.id}`);
      res.json({ success: true, processed });
    } catch (error: any) {
      console.error("IndiaMart webhook error:", error);
      res.status(500).json({ message: "Failed to process webhook" });
    }
  });
}

