// @ts-nocheck
import { storage } from "./storage";
import { sendWhitelabelPanelEmail } from "./utils/email";
import {
  isSubscriptionPeriodActiveByCalendarDay,
  subscriptionCalendarDaysFromTodayToEndDate,
  subscriptionCalendarTodayDateString,
} from "./utils/subscription-calendar";

const DAY_MS = 24 * 60 * 60 * 1000;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Daily job: subscription ending within 7 calendar days (one email per subscription per day),
 * and reactivation prompt when period has ended or status is expired (one per subscription per day).
 * SMTP: whitelabel admin Integrations → SMTP, then SaaS owner smtp_settings, then forgot-password / .env (see getWhitelabelPanelSmtpConfig).
 */
export async function runSubscriptionTransactionalEmailTick(): Promise<void> {
  const today = subscriptionCalendarTodayDateString();
  const baseUrl = (process.env.BASE_URL || "http://localhost:5001").split(/\s*[\n#]/)[0].trim().replace(/\/+$/, "");
  const billingUrl = `${baseUrl}/billing`;

  let subs: Awaited<ReturnType<typeof storage.getSubscriptionsEligibleForPanelReminders>>;
  try {
    subs = await storage.getSubscriptionsEligibleForPanelReminders();
  } catch (e: any) {
    console.error("[SubscriptionEmail] load subscriptions:", e?.message);
    return;
  }

  for (const sub of subs) {
    if (sub.status === "cancelled" || sub.status === "pending") continue;

    const user = await storage.getUser(sub.userId);
    const email = user?.email?.trim();
    if (!email) continue;

    const canonicalActive = await storage.getActiveSubscriptionByUser(sub.userId);

    const plan = await storage.getPlan(sub.planId);
    const planName = (plan?.displayName || plan?.name || "your plan").trim();
    const end = sub.currentPeriodEnd;
    const endDate = end instanceof Date ? end : new Date(end);
    const endLabel = Number.isNaN(endDate.getTime())
      ? "—"
      : endDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

    const periodStillActive = isSubscriptionPeriodActiveByCalendarDay(end);
    const needsReactivate = sub.status === "expired" || !periodStillActive;

    if (needsReactivate) {
      if (canonicalActive && canonicalActive.id !== sub.id) {
        continue;
      }
      const dedupeKey = `sub_expired_reactivate:${sub.id}:${today}`;
      try {
        if (await storage.panelTransactionalEmailLogExists(dedupeKey)) continue;
      } catch {
        continue;
      }
      const subject = "Your subscription has ended — renew to restore access";
      const name = user.firstName?.trim() || email.split("@")[0] || "there";
      const text = `Hello ${name},

Your panel subscription (${planName}) is no longer in an active billing period (ended ${endLabel}).

Renew here to restore access:
${billingUrl}

If you already renewed, you can ignore this message.

Best regards`;
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="font-family:system-ui,sans-serif;line-height:1.6;max-width:560px;margin:0 auto;padding:20px;">
<p>Hello ${escapeHtml(name)},</p>
<p>Your panel subscription (<strong>${escapeHtml(planName)}</strong>) is no longer in an active billing period (ended <strong>${escapeHtml(endLabel)}</strong>).</p>
<p><a href="${escapeHtml(billingUrl)}">Renew billing</a></p>
<p style="color:#666;font-size:14px;">If you already renewed, you can ignore this message.</p>
</body></html>`;
      const ok = await sendWhitelabelPanelEmail({ to: email, subject, text, html });
      if (ok) {
        try {
          await storage.insertPanelTransactionalEmailLog({
            userId: sub.userId,
            dedupeKey,
            notificationKind: "subscription_expired",
          });
        } catch (e: any) {
          console.warn("[SubscriptionEmail] log insert:", e?.message);
        }
      }
      continue;
    }

    if (sub.status !== "active") continue;
    if (!canonicalActive || canonicalActive.id !== sub.id) continue;

    const daysLeft = subscriptionCalendarDaysFromTodayToEndDate(end);
    if (daysLeft == null) continue;
    if (daysLeft < 1 || daysLeft > 7) continue;

    const dedupeKey = `sub_expiry_reminder:${sub.id}:${today}`;
    try {
      if (await storage.panelTransactionalEmailLogExists(dedupeKey)) continue;
    } catch {
      continue;
    }

    const subject =
      daysLeft === 1
        ? "Your subscription renews tomorrow — check billing"
        : `Your subscription ends in ${daysLeft} days — renew soon`;
    const name = user.firstName?.trim() || email.split("@")[0] || "there";
    const text = `Hello ${name},

Your plan (${planName}) current period ends on ${endLabel} (${daysLeft} calendar day(s) remaining on the panel billing calendar).

Review or renew here:
${billingUrl}

Best regards`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="font-family:system-ui,sans-serif;line-height:1.6;max-width:560px;margin:0 auto;padding:20px;">
<p>Hello ${escapeHtml(name)},</p>
<p>Your plan (<strong>${escapeHtml(planName)}</strong>) current period ends on <strong>${escapeHtml(endLabel)}</strong> (${daysLeft} calendar day(s) remaining).</p>
<p><a href="${escapeHtml(billingUrl)}">Open billing</a></p>
</body></html>`;
    const ok = await sendWhitelabelPanelEmail({ to: email, subject, text, html });
    if (ok) {
      try {
        await storage.insertPanelTransactionalEmailLog({
          userId: sub.userId,
          dedupeKey,
          notificationKind: "subscription_expiry_reminder",
        });
      } catch (e: any) {
        console.warn("[SubscriptionEmail] log insert:", e?.message);
      }
    }
  }
}

export function startSubscriptionEmailScheduler(): void {
  if (process.env.DISABLE_SUBSCRIPTION_EMAIL_SCHEDULER === "true") {
    console.log("[SubscriptionEmail] Scheduler disabled (DISABLE_SUBSCRIPTION_EMAIL_SCHEDULER=true)");
    return;
  }
  const intervalMs = Math.max(
    60_000,
    parseInt(process.env.SUBSCRIPTION_EMAIL_INTERVAL_MS || String(DAY_MS), 10) || DAY_MS
  );
  const tick = () => {
    void runSubscriptionTransactionalEmailTick().catch((e) =>
      console.error("[SubscriptionEmail] tick error:", e)
    );
  };
  setTimeout(tick, 180_000);
  setInterval(tick, intervalMs);
  console.log(
    `[SubscriptionEmail] Scheduler started: first run in 3m, then every ${Math.round(intervalMs / 1000)}s`
  );
}
