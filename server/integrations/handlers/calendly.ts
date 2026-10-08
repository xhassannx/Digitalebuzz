import type { Express } from "express";
import { isAuthenticated } from "../../replitAuth";
import { resolveOrganizationContext } from "../../middleware/organization-context";
import { storage } from "../../storage";
import { triggerWebhooks } from "../../webhooks/delivery";
import { calendlyEventToCanvasTrigger } from "../../automation/webhook-context";
import { dispatchOrgFlowsForCanvasTrigger } from "../../automation/flow-webhook";

const CALENDLY_API_BASE = "https://api.calendly.com";

export function registerCalendlyRoutes(app: Express) {
  const getUserId = (req: any): string => {
    return req.user?.claims?.sub || req.userId;
  };

  // Verify Calendly personal token
  app.post("/api/integrations/calendly/verify-token", isAuthenticated, async (req: any, res) => {
    try {
      const { personalToken } = req.body;

      if (!personalToken) {
        return res.status(400).json({ message: "Personal token is required" });
      }

      // Verify token by calling Calendly API - use /users/me endpoint
      const verifyResponse = await fetch(`${CALENDLY_API_BASE}/users/me`, {
        headers: {
          Authorization: `Bearer ${personalToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!verifyResponse.ok) {
        if (verifyResponse.status === 401) {
          return res.status(401).json({ 
            valid: false,
            message: "Invalid personal token. Please check your token and try again." 
          });
        }
        return res.status(verifyResponse.status).json({ 
          valid: false,
          message: "Failed to verify token. Please try again." 
        });
      }

      const userData = await verifyResponse.json();
      
      res.json({ 
        valid: true,
        message: "Token verified successfully",
        user: userData.resource || {}
      });
    } catch (error: any) {
      console.error("Calendly token verification error:", error);
      res.status(500).json({ 
        valid: false,
        message: error.message || "Failed to verify token" 
      });
    }
  });

  // Get Calendly scopes (user and organization) for webhook setup
  app.get("/api/integrations/calendly/scopes", isAuthenticated, resolveOrganizationContext, async (req: any, res) => {
    try {
      const { connectionId } = req.query;
      if (!connectionId || typeof connectionId !== "string") {
        return res.status(400).json({ message: "connectionId is required" });
      }
      const userId = getUserId(req);
      const integration = await storage.getIntegration(connectionId, userId);
      if (!integration || integration.name !== "calendly" || integration.status !== "connected" || !integration.credentials) {
        return res.status(404).json({ message: "Calendly integration not found or not connected" });
      }
      const credentials = integration.credentials as any;
      const accessToken = credentials.access_token;
      const userResponse = await fetch(`${CALENDLY_API_BASE}/users/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!userResponse.ok) {
        throw new Error("Failed to fetch Calendly user");
      }
      const userData = await userResponse.json();
      const resource = userData.resource || {};
      const scopes: Array<{ id: string; name: string }> = [];
      if (resource.uri) {
        scopes.push({ id: resource.uri, name: "User" });
      }
      if (resource.current_organization) {
        scopes.push({ id: resource.current_organization, name: "Organization" });
      }
      if (scopes.length === 0) {
        scopes.push({ id: "user", name: "User" }, { id: "organization", name: "Organization" });
      }
      res.json({ scopes });
    } catch (error: any) {
      console.error("Calendly scopes error:", error);
      res.status(500).json({ message: error.message || "Failed to fetch Calendly scopes" });
    }
  });

  // Get Calendly events/webhooks
  app.get("/api/integrations/calendly/events", isAuthenticated, resolveOrganizationContext, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      const integration = await storage.getIntegrationByName("calendly", userId, organizationId);

      if (!integration || integration.status !== "connected" || !integration.credentials) {
        return res.status(404).json({ message: "Calendly integration not found or not connected" });
      }

      const credentials = integration.credentials as any;
      const accessToken = credentials.access_token;

      const eventsResponse = await fetch(`${CALENDLY_API_BASE}/scheduled_events`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!eventsResponse.ok) {
        throw new Error("Failed to fetch Calendly events");
      }

      const events = await eventsResponse.json();
      res.json(events);
    } catch (error: any) {
      console.error("Calendly events error:", error);
      res.status(500).json({ message: error.message || "Failed to fetch Calendly events" });
    }
  });

  // Create Calendly webhook subscription (so we receive invitee.created, invitee.canceled)
  app.post("/api/integrations/calendly/webhook-subscriptions", isAuthenticated, resolveOrganizationContext, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      const { connectionId, scope } = req.body || {};
      if (!connectionId || typeof connectionId !== "string") {
        return res.status(400).json({ message: "connectionId is required" });
      }
      const integration = await storage.getIntegration(connectionId, userId);
      if (!integration || integration.name !== "calendly" || integration.status !== "connected" || !integration.credentials) {
        return res.status(404).json({ message: "Calendly integration not found or not connected" });
      }
      const credentials = integration.credentials as any;
      const accessToken = credentials.access_token;
      const baseUrl = (process.env.BASE_URL || "").split(/\s*[\n#]/)[0].trim().replace(/\/+$/, "") || `${req.protocol}://${req.get("host")}`;
      const callbackUrl = `${baseUrl}/api/webhooks/calendly/${integration.id}`;

      const userResponse = await fetch(`${CALENDLY_API_BASE}/users/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!userResponse.ok) throw new Error("Failed to fetch Calendly user");
      const userData = await userResponse.json();
      const resource = userData.resource || {};
      const orgUri = scope === "organization" && resource.current_organization
        ? resource.current_organization
        : resource.uri;

      if (!orgUri) {
        return res.status(400).json({ message: "Could not determine Calendly scope (user or organization)" });
      }

      const subRes = await fetch(`${CALENDLY_API_BASE}/webhook_subscriptions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: callbackUrl,
          events: ["invitee.created", "invitee.canceled", "routing_form_submission.created"],
          organization: orgUri,
          scope: scope === "organization" ? "organization" : "user",
        }),
      });

      if (!subRes.ok) {
        const err = await subRes.json().catch(() => ({}));
        return res.status(subRes.status).json({
          message: err.message || "Failed to create Calendly webhook subscription",
          details: err,
        });
      }
      const subData = await subRes.json();
      const webhookUri = subData.resource?.uri;
      await storage.updateIntegration(integration.id, userId, {
        config: { ...(integration.config || {}), calendlyWebhookUri: webhookUri },
      });
      res.json({ success: true, callbackUrl, subscription: subData.resource });
    } catch (error: any) {
      console.error("Calendly webhook subscription error:", error);
      res.status(500).json({ message: error.message || "Failed to create webhook subscription" });
    }
  });

  // Calendly webhook receiver (Calendly POSTs here when events occur)
  app.post("/api/webhooks/calendly/:integrationId", async (req: any, res) => {
    try {
      const { integrationId } = req.params;
      const body = req.body || {};
      const event = body.event;
      const payload = body.payload || {};

      const integration = await storage.getIntegrationById(integrationId);
      if (!integration || integration.name !== "calendly") {
        return res.status(404).json({ message: "Integration not found" });
      }
      const userId = integration.userId;

      if (event === "invitee.created") {
        await triggerWebhooks(userId, "calendly.invitee_created", {
          event: "invitee.created",
          payload,
          invitee: payload.invitee,
          calendlyEvent: payload.event,
          questions_and_answers: payload.questions_and_answers,
        });
      } else if (event === "invitee.canceled") {
        await triggerWebhooks(userId, "calendly.invitee_canceled", {
          event: "invitee.canceled",
          payload,
          invitee: payload.invitee,
          calendlyEvent: payload.event,
          cancel_reason: payload.cancel_reason,
        });
      } else if (event === "routing_form_submission.created") {
        await triggerWebhooks(userId, "calendly.routing_form_submission", {
          event: "routing_form_submission.created",
          payload,
          submission: payload.routing_form_submission,
        });
      }

      const canvasTriggerId = event ? calendlyEventToCanvasTrigger(event) : null;
      if (canvasTriggerId && process.env.AUTOMATION_FLOWS_ENABLED !== "false") {
        try {
          await dispatchOrgFlowsForCanvasTrigger({
            canvasTriggerId,
            organizationId: integration.organizationId,
            ownerUserId: userId,
            body: { event, payload, ...payload },
            topic: event,
            integrationConnectionId: integration.id,
          });
        } catch (e: unknown) {
          console.error("[Automation] Calendly → canvas flows:", e);
        }
      }

      res.status(200).json({ received: true, canvasTriggerId: canvasTriggerId || null });
    } catch (error: any) {
      console.error("Calendly webhook error:", error);
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });
}

