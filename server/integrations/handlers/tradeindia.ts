import type { Express } from "express";
import { isAuthenticated } from "../../replitAuth";
import { resolveOrganizationContext } from "../../middleware/organization-context";
import { storage } from "../../storage";
import { dispatchLeadFlowsForIntegration, normalizeLeadsFromWebhookBody } from "../../automation/lead-dispatch";

const TRADEINDIA_API_BASE = process.env.TRADEINDIA_API_BASE || "https://api.tradeindia.com";

export function registerTradeIndiaRoutes(app: Express) {
  const getUserId = (req: any): string => {
    return req.user?.claims?.sub || req.userId;
  };

  // Sync leads from Tradeindia
  app.post("/api/integrations/tradeindia/sync-leads", isAuthenticated, resolveOrganizationContext, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      const { integrationId, startDate, endDate } = req.body;

      // Get Tradeindia integration
      let integration;
      if (integrationId) {
        integration = await storage.getIntegration(integrationId, userId);
      } else {
        integration = await storage.getIntegrationByName("tradeindia", userId, organizationId);
      }

      if (!integration || integration.status !== "connected" || !integration.credentials) {
        return res.status(404).json({ message: "Tradeindia integration not found or not connected" });
      }

      const credentials = integration.credentials as any;
      const profileId = credentials.profileId || credentials.profile_id;
      const userId_tradeindia = credentials.userId || credentials.user_id;
      const key = credentials.key || credentials.apiKey;

      if (!profileId || !userId_tradeindia || !key) {
        return res.status(400).json({ message: "Tradeindia credentials not configured" });
      }

      // Fetch leads from Tradeindia API
      const leadsResponse = await fetch(`${TRADEINDIA_API_BASE}/leads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${key}`,
        },
        body: JSON.stringify({
          profile_id: profileId,
          user_id: userId_tradeindia,
          start_date: startDate,
          end_date: endDate,
        }),
      });

      if (!leadsResponse.ok) {
        const errorData = await leadsResponse.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to fetch leads from Tradeindia");
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
      console.error("Tradeindia sync error:", error);
      res.status(500).json({ message: error.message || "Failed to sync leads from Tradeindia" });
    }
  });

  // Webhook endpoint for Tradeindia to push leads
  app.post("/api/webhook/tradeindia", async (req: any, res) => {
    try {
      const { profile_id, user_id, key, leads } = req.body;

      if (!profile_id || !user_id || !key || !leads) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Find integration by credentials
      // Note: In production, you'd want to verify the webhook signature
      const integrations = await storage.getIntegrationsByUser("", undefined);
      const integration = integrations.find(
        (int) =>
          int.name === "tradeindia" &&
          ((int.credentials as any)?.profileId === profile_id ||
            (int.credentials as any)?.profile_id === profile_id) &&
          ((int.credentials as any)?.userId === user_id ||
            (int.credentials as any)?.user_id === user_id) &&
          ((int.credentials as any)?.key === key ||
            (int.credentials as any)?.apiKey === key)
      );

      if (!integration) {
        return res.status(404).json({ message: "Integration not found" });
      }

      const leadsToProcess = normalizeLeadsFromWebhookBody({ leads, ...(req.body || {}) });
      let processed = 0;
      if (process.env.AUTOMATION_FLOWS_ENABLED !== "false" && leadsToProcess.length > 0) {
        processed = await dispatchLeadFlowsForIntegration({
          canvasTriggerId: "tradeindia-new-lead",
          integration: {
            id: integration.id!,
            userId: integration.userId,
            organizationId: integration.organizationId,
          },
          leads: leadsToProcess,
        });
      }

      console.log(`[Tradeindia Webhook] ${processed} lead(s) for integration ${integration.id}`);
      res.json({ success: true, processed });
    } catch (error: any) {
      console.error("Tradeindia webhook error:", error);
      res.status(500).json({ message: "Failed to process webhook" });
    }
  });
}
