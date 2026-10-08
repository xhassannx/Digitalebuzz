import { and, eq, isNotNull, lt } from "drizzle-orm";
import { db } from "../db";
import { users } from "@shared/schema";
import { storage } from "./storage";
import { isMongoEnabled } from "../db/mongo";
import { UserModel } from "./models";

const HOUR_MS = 60 * 60 * 1000;

export async function runTrialAccountExpiryTick(): Promise<void> {
  const now = new Date();
  let expired: any[];
  if (isMongoEnabled()) {
    const docs = await UserModel.find({
      isTrialAccount: true,
      isActive: true,
      trialExpiresAt: { $ne: null, $lt: now },
    }).lean();
    expired = docs.map((d) => ({ ...d, id: d._id }));
  } else {
    expired = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.isTrialAccount, true),
          eq(users.isActive, true),
          isNotNull(users.trialExpiresAt),
          lt(users.trialExpiresAt, now),
        ),
      );
  }

  for (const user of expired) {
    try {
      await storage.updateUser(user.id, {
        isActive: false,
        accountStatus: "suspended",
      });

      const sub = await storage.getActiveSubscriptionByUser(user.id);
      if (sub) {
        await storage.updateSubscription(sub.id, { status: "expired" });
      }

      console.log(`[TrialAccount] Deactivated expired trial user ${user.id} (${user.email})`);
    } catch (e: unknown) {
      console.error("[TrialAccount] Failed to deactivate user", user.id, e);
    }
  }
}

export function startTrialAccountScheduler(): void {
  if (process.env.DISABLE_TRIAL_ACCOUNT_SCHEDULER === "true") {
    console.log("[TrialAccount] Scheduler disabled (DISABLE_TRIAL_ACCOUNT_SCHEDULER=true)");
    return;
  }

  const intervalMs = Math.max(
    60_000,
    parseInt(process.env.TRIAL_ACCOUNT_SCHEDULER_INTERVAL_MS || String(HOUR_MS), 10) || HOUR_MS,
  );

  const tick = () => {
    void runTrialAccountExpiryTick().catch((e) => console.error("[TrialAccount] tick error:", e));
  };

  setTimeout(tick, 120_000);
  setInterval(tick, intervalMs);
  console.log(`[TrialAccount] Scheduler started: first run in 120s, then every ${Math.round(intervalMs / 1000)}s`);
}
