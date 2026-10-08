import type { Express } from "express";
import { isAuthenticated } from "../../replitAuth";
import { resolveOrganizationContext } from "../../middleware/organization-context";
import { storage } from "../../storage";

const TELEGRAM_API_BASE = "https://api.telegram.org/bot";

export function registerTelegramRoutes(app: Express) {
  const getUserId = (req: any): string => {
    return req.user?.claims?.sub || req.userId;
  };

  // Send Telegram message
  app.post("/api/integrations/telegram/send", isAuthenticated, resolveOrganizationContext, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      const { chatId, message, parseMode } = req.body;

      if (!chatId || !message) {
        return res.status(400).json({ message: "Missing chatId or message" });
      }

      const integration = await storage.getIntegrationByName("telegram", userId, organizationId);

      if (!integration || integration.status !== "connected" || !integration.credentials) {
        return res.status(404).json({ message: "Telegram integration not found or not connected" });
      }

      const credentials = integration.credentials as any;
      const botToken = credentials.apiKey || credentials.bot_token;

      if (!botToken) {
        return res.status(400).json({ message: "Telegram bot token not configured" });
      }

      const sendResponse = await fetch(`${TELEGRAM_API_BASE}${botToken}/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: parseMode || "HTML",
        }),
      });

      if (!sendResponse.ok) {
        const errorData = await sendResponse.json();
        throw new Error(errorData.description || "Failed to send Telegram message");
      }

      const result = await sendResponse.json();
      res.json({ success: true, messageId: result.result.message_id });
    } catch (error: any) {
      console.error("Telegram send error:", error);
      res.status(500).json({ message: error.message || "Failed to send Telegram message" });
    }
  });

  // Get Telegram updates (webhook setup)
  app.post("/api/integrations/telegram/webhook", async (req: any, res) => {
    try {
      const { update } = req.body;
      // Process Telegram webhook updates
      // TODO: Route to appropriate handler based on integration
      res.json({ ok: true });
    } catch (error: any) {
      console.error("Telegram webhook error:", error);
      res.status(500).json({ message: "Failed to process webhook" });
    }
  });
}

