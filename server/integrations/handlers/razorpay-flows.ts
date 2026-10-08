import type { Express } from "express";
import { storage } from "../../storage";
import { razorpayEventToCanvasTrigger } from "../../automation/webhook-context";
import { dispatchOrgFlowsForCanvasTrigger } from "../../automation/flow-webhook";

/**
 * Razorpay webhooks for canvas automation flows (order paid, payment captured).
 * Configure in Razorpay Dashboard → Webhooks → URL:
 *   https://your-domain/api/webhooks/razorpay/flows/:integrationId
 */
export function registerRazorpayFlowRoutes(app: Express) {
  app.post("/api/webhooks/razorpay/flows/:integrationId", async (req: any, res) => {
    try {
      const { integrationId } = req.params;
      const body =
        req.body && typeof req.body === "object" && !Array.isArray(req.body)
          ? (req.body as Record<string, unknown>)
          : {};
      const event = typeof body.event === "string" ? body.event : "";

      const integration = await storage.getIntegrationById(integrationId);
      if (!integration || integration.name !== "razorpay") {
        return res.status(404).json({ message: "Integration not found" });
      }

      const canvasTriggerId = event ? razorpayEventToCanvasTrigger(event) : null;
      if (canvasTriggerId && process.env.AUTOMATION_FLOWS_ENABLED !== "false") {
        await dispatchOrgFlowsForCanvasTrigger({
          canvasTriggerId,
          organizationId: integration.organizationId,
          ownerUserId: integration.userId,
          body,
          topic: event,
          integrationConnectionId: integration.id,
        });
      }

      res.status(200).json({ received: true, canvasTriggerId: canvasTriggerId || null });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("Razorpay flow webhook error:", msg);
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });
}
