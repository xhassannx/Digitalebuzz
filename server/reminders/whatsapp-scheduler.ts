/**
 * Reminder WhatsApp scheduler: sends selected templates or written messages when reminderAt is due.
 */
import { storage } from "../storage";
import { sendPanelTemplateFromFlow, sendPanelTextMessage } from "../panel-inbox-send";

const INTERVAL_MS = 15_000;

export async function runReminderWhatsAppCheck(): Promise<void> {
  try {
    const due = await storage.claimDueRemindersForWhatsApp(new Date(), 20);
    if (due.length === 0) return;

    const { isOrganizationPlanActive } = await import("../utils/org-subscription-gate");

    for (const reminder of due) {
      try {
        if (!reminder.organizationId) {
          await storage.markReminderWhatsAppFailed(reminder.id, "Missing organization");
          continue;
        }
        if (!(await isOrganizationPlanActive(reminder.organizationId))) {
          await storage.markReminderWhatsAppFailed(reminder.id, "Subscription expired");
          continue;
        }
        if (!reminder.sessionId?.trim()) {
          await storage.markReminderWhatsAppFailed(reminder.id, "Missing WhatsApp session");
          continue;
        }

        const contact = await storage.getManagedContactByOrganization(
          reminder.contactId,
          reminder.organizationId
        );
        const phone = (contact?.phoneNumber || "").trim();
        if (!phone) {
          await storage.markReminderWhatsAppFailed(reminder.id, "Contact has no phone number");
          continue;
        }

        const templateName = reminder.templateName?.trim();
        if (templateName) {
          await sendPanelTemplateFromFlow(reminder.userId, reminder.organizationId, {
            sessionId: reminder.sessionId,
            to: phone,
            templateName,
            templateLanguage: reminder.templateLanguage || "en",
            templateParams: Array.isArray(reminder.templateParams) ? reminder.templateParams : undefined,
            headerImageUrl: reminder.headerImageUrl || undefined,
            headerImageId: reminder.headerImageId || undefined,
            headerVideoUrl: reminder.headerVideoUrl || undefined,
            headerVideoId: reminder.headerVideoId || undefined,
            headerDocumentUrl: reminder.headerDocumentUrl || undefined,
            headerDocumentId: reminder.headerDocumentId || undefined,
          });
          await storage.markReminderWhatsAppSent(reminder.id);
          console.log(
            `[Reminder WhatsApp] Sent template "${templateName}" for reminder ${reminder.id} to ${phone}`
          );
        } else {
          const text = (reminder.message || "").trim();
          if (!text) {
            await storage.markReminderWhatsAppFailed(reminder.id, "Missing message text");
            continue;
          }
          await sendPanelTextMessage(reminder.userId, reminder.organizationId, {
            sessionId: reminder.sessionId,
            to: phone,
            message: text,
          });
          await storage.markReminderWhatsAppSent(reminder.id);
          console.log(
            `[Reminder WhatsApp] Sent text message for reminder ${reminder.id} to ${phone}`
          );
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Reminder WhatsApp] Failed reminder ${reminder.id}:`, msg);
        try {
          await storage.markReminderWhatsAppFailed(reminder.id, msg.slice(0, 500));
        } catch (markErr) {
          console.error(`[Reminder WhatsApp] Could not mark failed for ${reminder.id}:`, markErr);
        }
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Reminder WhatsApp Scheduler] Error:", msg);
  }
}

export function startReminderWhatsAppScheduler(): void {
  console.log("[Reminder WhatsApp Scheduler] Starting...");
  // Start polling immediately — never block the interval on a slow/hung DB requeue.
  setInterval(runReminderWhatsAppCheck, INTERVAL_MS);
  void runReminderWhatsAppCheck();

  // Best-effort: re-queue known failed/stuck sends so they can retry at the correct due time.
  void storage
    .requeueFailedReminderWhatsAppSends({ errorContains: "storage is not defined", limit: 100 })
    .then((n) => {
      if (n > 0) {
        console.log(`[Reminder WhatsApp Scheduler] Re-queued ${n} failed reminder(s)`);
      }
    })
    .catch((err) => {
      console.error("[Reminder WhatsApp Scheduler] Re-queue failed:", err);
    })
    .then(() => storage.requeueFailedReminderWhatsAppSends({ onlyDue: true, limit: 100 }))
    .then((n) => {
      if (n > 0) {
        console.log(`[Reminder WhatsApp Scheduler] Re-queued ${n} due failed reminder(s)`);
      }
    })
    .catch((err) => {
      console.error("[Reminder WhatsApp Scheduler] Due failed re-queue failed:", err);
    })
    .then(() => storage.requeueStuckReminderWhatsAppSends(2))
    .then((n) => {
      if (n > 0) {
        console.log(`[Reminder WhatsApp Scheduler] Reset ${n} stuck sending reminder(s)`);
      }
    })
    .catch((err) => {
      console.error("[Reminder WhatsApp Scheduler] Stuck-send reset failed:", err);
    });
}
