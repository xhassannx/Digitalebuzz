import type { Express } from "express";
import { randomBytes } from "crypto";
import { isAuthenticated } from "../../replitAuth";
import { resolveOrganizationContext } from "../../middleware/organization-context";
import { storage } from "../../storage";

const EXPORTERSINDIA_API_BASE = process.env.EXPORTERSINDIA_API_BASE || "https://api.exportersindia.com";
const BASE_URL = (process.env.BASE_URL || process.env.WEBHOOK_URL || "http://localhost:5002").split(/\s*[\n#]/)[0].trim().replace(/\/+$/, "");

// Generate a secure random token
function generateAccessToken(): string {
  return randomBytes(32).toString("hex");
}

export function registerExportersIndiaRoutes(app: Express) {
  const getUserId = (req: any): string => {
    return req.user?.claims?.sub || req.userId;
  };

  // Get ExportersIndia configuration
  app.get("/api/integrations/exportersindia/config", isAuthenticated, resolveOrganizationContext, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      const integration = await storage.getIntegrationByName("exportersindia", userId, organizationId);

      if (!integration || integration.status !== "connected") {
        return res.status(404).json({ message: "ExportersIndia integration not found or not connected" });
      }

      const credentials = integration.credentials as any;
      const accessToken = credentials.accessToken || credentials.apiKey || credentials.api_key;

      res.json({
        accessToken: accessToken || null,
        integrationId: integration.id,
      });
    } catch (error: any) {
      console.error("ExportersIndia config error:", error);
      res.status(500).json({ message: error.message || "Failed to fetch configuration" });
    }
  });

  // Get webhook URL
  app.get("/api/integrations/exportersindia/webhook-url", isAuthenticated, resolveOrganizationContext, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      const integration = await storage.getIntegrationByName("exportersindia", userId, organizationId);

      if (!integration || integration.status !== "connected") {
        return res.status(404).json({ message: "ExportersIndia integration not found or not connected" });
      }

      const credentials = integration.credentials as any;
      const accessToken = credentials.accessToken || credentials.apiKey || credentials.api_key;

      if (!accessToken) {
        return res.status(400).json({ message: "Access token not configured" });
      }

      const webhookUrl = `${BASE_URL}/api/webhook/exportersindia/${accessToken}`;
      res.json({ webhookUrl });
    } catch (error: any) {
      console.error("ExportersIndia webhook URL error:", error);
      res.status(500).json({ message: error.message || "Failed to generate webhook URL" });
    }
  });

  // Regenerate access token
  app.post("/api/integrations/exportersindia/regenerate-token", isAuthenticated, resolveOrganizationContext, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      const integration = await storage.getIntegrationByName("exportersindia", userId, organizationId);

      if (!integration || integration.status !== "connected") {
        return res.status(404).json({ message: "ExportersIndia integration not found or not connected" });
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

      const webhookUrl = `${BASE_URL}/api/webhook/exportersindia/${newAccessToken}`;
      res.json({
        accessToken: newAccessToken,
        webhookUrl,
      });
    } catch (error: any) {
      console.error("ExportersIndia regenerate token error:", error);
      res.status(500).json({ message: error.message || "Failed to regenerate token" });
    }
  });

  // Sync leads from ExportersIndia
  app.post("/api/integrations/exportersindia/sync-leads", isAuthenticated, resolveOrganizationContext, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      const { integrationId, startDate, endDate } = req.body;

      // Get ExportersIndia integration
      let integration;
      if (integrationId) {
        integration = await storage.getIntegration(integrationId, userId);
      } else {
        integration = await storage.getIntegrationByName("exportersindia", userId, organizationId);
      }

      if (!integration || integration.status !== "connected" || !integration.credentials) {
        return res.status(404).json({ message: "ExportersIndia integration not found or not connected" });
      }

      const credentials = integration.credentials as any;
      const apiKey = credentials.apiKey || credentials.api_key;

      if (!apiKey) {
        return res.status(400).json({ message: "ExportersIndia API key not configured" });
      }

      // Fetch leads from ExportersIndia API
      const leadsResponse = await fetch(`${EXPORTERSINDIA_API_BASE}/leads`, {
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
        throw new Error(errorData.message || "Failed to fetch leads from ExportersIndia");
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
      console.error("ExportersIndia sync error:", error);
      res.status(500).json({ message: error.message || "Failed to sync leads from ExportersIndia" });
    }
  });

  // Webhook endpoint for ExportersIndia to push leads (using access token in URL)
  app.post("/api/webhook/exportersindia/:accessToken", async (req: any, res) => {
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
          int.name === "exportersindia" &&
          ((int.credentials as any)?.accessToken === token ||
            (int.credentials as any)?.apiKey === token ||
            (int.credentials as any)?.api_key === token)
      );

      if (!integration) {
        return res.status(404).json({ message: "Integration not found" });
      }

      // Process leads
      // TODO: Store leads in managed contacts or trigger webhooks
      const leadsToProcess = leads || req.body.data || [];
      
      console.log(`[ExportersIndia Webhook] Received ${leadsToProcess.length} leads for integration ${integration.id}`);

      res.json({ success: true, processed: Array.isArray(leadsToProcess) ? leadsToProcess.length : 0 });
    } catch (error: any) {
      console.error("ExportersIndia webhook error:", error);
      res.status(500).json({ message: "Failed to process webhook" });
    }
  });

  // Legacy webhook endpoint (backward compatibility)
  app.post("/api/integrations/exportersindia/webhook", async (req: any, res) => {
    try {
      const { api_key, leads } = req.body;

      if (!api_key || !leads) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Find integration by API key
      const integrations = await storage.getIntegrationsByUser("", undefined);
      const integration = integrations.find(
        (int) => int.name === "exportersindia" && (int.credentials as any)?.apiKey === api_key
      );

      if (!integration) {
        return res.status(404).json({ message: "Integration not found" });
      }

      // Process leads
      const leadsToProcess = Array.isArray(leads) ? leads : [leads];
      console.log(`[ExportersIndia Webhook] Received ${leadsToProcess.length} leads for integration ${integration.id}`);

      res.json({ success: true, processed: leadsToProcess.length });
    } catch (error: any) {
      console.error("ExportersIndia webhook error:", error);
      res.status(500).json({ message: "Failed to process webhook" });
    }
  });
}

