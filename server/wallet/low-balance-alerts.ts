import { db } from "../../db";
import { organizations, walletLowBalanceAlertState } from "@shared/schema";
import { eq } from "drizzle-orm";
import { storage } from "../storage";
import { sendWhitelabelPanelEmail } from "../utils/email";
import { getWalletBillingConfig, isWalletBillingEnabled } from "./config";
import { isMongoEnabled } from "../../db/mongo";
import { OrganizationModel, OrganizationWalletModel } from "../models";

const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatMoney(minor: number, currency: string): string {
  const sym = currency === "INR" ? "₹" : `${currency} `;
  return `${sym}${(minor / 100).toFixed(2)}`;
}

export async function maybeSendLowBalanceEmail(params: {
  organizationId: string;
  balanceMinor: number;
  currency: string;
  lastTransactionId?: string;
}): Promise<void> {
  if (!(await isWalletBillingEnabled())) return;
  const config = await getWalletBillingConfig();
  if (!config.lowBalanceEmailEnabled) return;

  const threshold = config.lowBalanceThresholdMinor ?? 0;
  if (threshold <= 0 || params.balanceMinor > threshold) return;

  let org: any;
  if (isMongoEnabled()) {
    org = await OrganizationModel.findById(params.organizationId).lean();
  } else {
    const [row] = await db.select().from(organizations).where(eq(organizations.id, params.organizationId)).limit(1);
    org = row;
  }
  if (!org) return;

  const owner = await storage.getUser(org.ownerId);
  const email = owner?.email?.trim();
  if (!email) return;

  const now = new Date();
  const [state] = await db
    .select()
    .from(walletLowBalanceAlertState)
    .where(eq(walletLowBalanceAlertState.organizationId, params.organizationId))
    .limit(1);

  if (state?.lastAlertAt && now.getTime() - state.lastAlertAt.getTime() < ALERT_COOLDOWN_MS) {
    return;
  }

  const today = now.toISOString().slice(0, 10);
  const dedupeKey = `wallet_low_balance:${params.organizationId}:${today}`;
  try {
    if (await storage.panelTransactionalEmailLogExists(dedupeKey)) return;
  } catch {
    return;
  }

  const baseUrl = (process.env.BASE_URL || "http://localhost:5001").split(/\s*[\n#]/)[0].trim().replace(/\/+$/, "");
  const walletUrl = `${baseUrl}/billing/wallet`;
  const name = owner?.firstName?.trim() || email.split("@")[0] || "there";
  const bal = formatMoney(params.balanceMinor, params.currency);
  const thr = formatMoney(threshold, params.currency);

  const subject = `WhatsApp wallet low balance — ${bal} remaining`;
  const text = `Hello ${name},

Your WhatsApp prepaid wallet for "${org.name}" is low.

Current balance: ${bal}
Alert threshold: ${thr}

Reload here to avoid blocked message sends:
${walletUrl}

Best regards`;

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.6;max-width:560px;">
<p>Hello ${escapeHtml(name)},</p>
<p>Your WhatsApp prepaid wallet for <strong>${escapeHtml(org.name)}</strong> is below the alert threshold.</p>
<ul>
<li>Balance: <strong>${escapeHtml(bal)}</strong></li>
<li>Threshold: ${escapeHtml(thr)}</li>
</ul>
<p><a href="${escapeHtml(walletUrl)}">Reload wallet</a> to keep sending official API messages.</p>
</body></html>`;

  const sent = await sendWhitelabelPanelEmail({ to: email, subject, text, html });
  if (!sent) return;

  await db
    .insert(walletLowBalanceAlertState)
    .values({
      organizationId: params.organizationId,
      lastAlertAt: now,
      lastBalanceMinor: params.balanceMinor,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: walletLowBalanceAlertState.organizationId,
      set: {
        lastAlertAt: now,
        lastBalanceMinor: params.balanceMinor,
        updatedAt: now,
      },
    });

  try {
    await storage.insertPanelTransactionalEmailLog({
      userId: org.ownerId,
      dedupeKey,
      notificationKind: "wallet_low_balance",
    });
  } catch (_) {}
}

/** Daily sweep: email orgs below threshold that were not alerted in 24h. */
export async function runWalletLowBalanceEmailTick(): Promise<void> {
  if (!(await isWalletBillingEnabled())) return;
  const config = await getWalletBillingConfig();
  if (!config.lowBalanceEmailEnabled) return;

  const threshold = config.lowBalanceThresholdMinor ?? 0;
  if (threshold <= 0) return;

  if (isMongoEnabled()) {
    const lowWallets = await OrganizationWalletModel.find({
      status: "active",
      balanceMinor: { $lte: threshold },
    }).lean();
    for (const w of lowWallets) {
      if (w.balanceMinor > threshold) continue;
      await maybeSendLowBalanceEmail({
        organizationId: w.organizationId,
        balanceMinor: w.balanceMinor,
        currency: w.currency,
      });
    }
    return;
  }

  const { organizationWallets } = await import("@shared/schema");
  const { lte, and } = await import("drizzle-orm");
  const lowWallets = await db
    .select()
    .from(organizationWallets)
    .where(
      and(eq(organizationWallets.status, "active"), lte(organizationWallets.balanceMinor, threshold))
    );

  for (const w of lowWallets) {
    if (w.balanceMinor > threshold) continue;
    await maybeSendLowBalanceEmail({
      organizationId: w.organizationId,
      balanceMinor: w.balanceMinor,
      currency: w.currency,
    });
  }
}
