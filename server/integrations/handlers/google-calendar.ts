import type { Express } from "express";
import { isAuthenticated } from "../../replitAuth";
import { resolveOrganizationContext } from "../../middleware/organization-context";
import { storage } from "../../storage";
import { triggerWebhooks } from "../../webhooks/delivery";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

async function getValidAccessToken(integration: any): Promise<string> {
  const creds = integration.credentials as any;
  if (!creds) throw new Error("No credentials");
  const expiresAt = creds.expires_at || 0;
  if (expiresAt && Date.now() < expiresAt - 60000) {
    return creds.access_token;
  }
  if (creds.refresh_token) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: creds.client_id || process.env.GOOGLE_CLIENT_ID || "",
        client_secret: creds.client_secret || process.env.GOOGLE_CLIENT_SECRET || "",
        refresh_token: creds.refresh_token,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) throw new Error("Failed to refresh token");
    const tokens = await res.json();
    creds.access_token = tokens.access_token;
    creds.expires_at = Date.now() + (tokens.expires_in * 1000);
    await storage.updateIntegration(integration.id, integration.userId, { credentials: creds });
    return creds.access_token;
  }
  return creds.access_token;
}

export function registerGoogleCalendarRoutes(app: Express) {
  const getUserId = (req: any): string => req.user?.claims?.sub || req.userId;

  app.get("/api/integrations/google-calendar/calendars", isAuthenticated, resolveOrganizationContext, async (req: any, res) => {
    try {
      const { connectionId } = req.query;
      if (!connectionId || typeof connectionId !== "string") {
        return res.status(400).json({ message: "connectionId is required" });
      }
      const userId = getUserId(req);
      const integration = await storage.getIntegration(connectionId, userId);
      if (!integration || integration.name !== "google-calendar" || integration.status !== "connected" || !integration.credentials) {
        return res.status(404).json({ message: "Google Calendar integration not found or not connected" });
      }
      const token = await getValidAccessToken(integration);
      const auth = `Bearer ${token}`;

      const calRes = await fetch(`${CALENDAR_API}/users/me/calendarList`, {
        headers: { Authorization: auth },
      });
      if (!calRes.ok) {
        const errText = await calRes.text();
        throw new Error(`Calendar API error: ${calRes.status} ${errText}`);
      }
      const data = await calRes.json();
      const calendars = (data.items || []).map((c: any) => ({
        id: c.id,
        name: c.summary || c.id,
        primary: !!c.primary,
      }));
      res.json({ calendars });
    } catch (error: any) {
      console.error("Google Calendar calendars error:", error);
      res.status(500).json({ message: error.message || "Failed to fetch calendars" });
    }
  });

  // Google Calendar push webhook – when you set up a watch via Calendar API, Google POSTs here on changes
  // URL: https://your-panel.com/api/webhooks/google-calendar/:integrationId
  app.post("/api/webhooks/google-calendar/:integrationId", async (req: any, res) => {
    try {
      const { integrationId } = req.params;
      const body = req.body || {};
      const resourceState = body.resourceState; // "sync" | "exists" | "not_exists"
      const resourceId = body.resourceId;

      const integration = await storage.getIntegrationById(integrationId);
      if (!integration || integration.name !== "google-calendar") {
        return res.status(404).json({ message: "Integration not found" });
      }
      const userId = integration.userId;

      if (resourceState === "exists") {
        await triggerWebhooks(userId, "google_calendar.event_created", { ...body, resourceState });
        if (process.env.AUTOMATION_FLOWS_ENABLED !== "false") {
          void import("../../automation/dispatch-runner")
            .then((m) =>
              m.onGoogleCalendarEventCreated({
                integrationId,
                userId,
                organizationId: integration.organizationId ?? null,
                body: { ...body, resourceState },
              })
            )
            .catch((e: unknown) => console.error("[Automation] google calendar trigger:", e));
        }
      } else if (resourceState === "not_exists") {
        await triggerWebhooks(userId, "google_calendar.event_deleted", { ...body, resourceState });
      } else {
        await triggerWebhooks(userId, "google_calendar.event_updated", { ...body, resourceState });
      }

      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error("Google Calendar webhook error:", error);
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });
}
