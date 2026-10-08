import type { Express } from "express";
import { randomBytes } from "crypto";
import { isAuthenticated } from "../../replitAuth";
import { resolveOrganizationContext } from "../../middleware/organization-context";
import { storage } from "../../storage";
import { dispatchLeadFlowsForIntegration, normalizeLeadsFromWebhookBody } from "../../automation/lead-dispatch";

const BASE_URL = (process.env.BASE_URL || process.env.WEBHOOK_URL || "http://localhost:5002")
  .split(/\s*[\n#]/)[0]
  .trim()
  .replace(/\/+$/, "");

function generateAccessToken(): string {
  return randomBytes(32).toString("hex");
}

export function registerJustDialRoutes(app: Express) {
  const getUserId = (req: any): string => req.user?.claims?.sub || req.userId;

  app.get("/api/integrations/justdial/webhook-url", isAuthenticated, resolveOrganizationContext, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      const integration = await storage.getIntegrationByName("justdial", userId, organizationId);
      if (!integration || integration.status !== "connected") {
        return res.status(404).json({ message: "JustDial integration not found or not connected" });
      }
      const credentials = (integration.credentials || {}) as Record<string, string>;
      const accessToken = credentials.accessToken || credentials.apiKey;
      if (!accessToken) {
        return res.status(400).json({ message: "Access token not configured" });
      }
      res.json({ webhookUrl: `${BASE_URL}/api/webhook/justdial/${accessToken}` });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: msg || "Failed to generate webhook URL" });
    }
  });

  app.post("/api/integrations/justdial/regenerate-token", isAuthenticated, resolveOrganizationContext, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      const integration = await storage.getIntegrationByName("justdial", userId, organizationId);
      if (!integration?.id) {
        return res.status(404).json({ message: "JustDial integration not found" });
      }
      const newAccessToken = generateAccessToken();
      const credentials = (integration.credentials || {}) as Record<string, string>;
      await storage.updateIntegration(integration.id, userId, {
        credentials: { ...credentials, accessToken: newAccessToken, apiKey: newAccessToken },
      });
      res.json({
        accessToken: newAccessToken,
        webhookUrl: `${BASE_URL}/api/webhook/justdial/${newAccessToken}`,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: msg });
    }
  });

  app.post("/api/webhook/justdial/:accessToken", async (req: any, res) => {
    try {
      const { accessToken } = req.params;
      const body = (req.body || {}) as Record<string, unknown>;
      const integrations = await storage.getIntegrationsByUser("", undefined);
      const integration = integrations.find(
        (int) =>
          int.name === "justdial" &&
          ((int.credentials as Record<string, string>)?.accessToken === accessToken ||
            (int.credentials as Record<string, string>)?.apiKey === accessToken)
      );
      if (!integration?.id) {
        return res.status(404).json({ message: "Integration not found" });
      }

      const leads = normalizeLeadsFromWebhookBody(body);
      let processed = 0;
      if (process.env.AUTOMATION_FLOWS_ENABLED !== "false" && leads.length > 0) {
        processed = await dispatchLeadFlowsForIntegration({
          canvasTriggerId: "justdial-new-lead",
          integration: {
            id: integration.id,
            userId: integration.userId,
            organizationId: integration.organizationId,
          },
          leads,
        });
      }

      console.log(`[JustDial Webhook] ${processed} lead(s) for integration ${integration.id}`);
      res.json({ success: true, processed });
    } catch (error: unknown) {
      console.error("JustDial webhook error:", error);
      res.status(500).json({ message: "Failed to process webhook" });
    }
  });
}
