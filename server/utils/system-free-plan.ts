/**
 * System Free plan — locked default assigned to every new signup
 * (except users with `is_saas_owner = true`).
 * Limits match the admin "Features & Limits" Free plan configuration.
 *
 * Note: `npm run db:push` only syncs schema. This helper (and
 * `npm run db:migrate-system-free-plan`) inserts the Free row into each database.
 */
import { db } from "../../db";
import { plans } from "@shared/schema";
import { eq, ne, and, sql } from "drizzle-orm";
import { isMongoEnabled } from "../../db/mongo";
import { PlanModel } from "../models";
import crypto from "crypto";

export const SYSTEM_FREE_PLAN_NAME = "system_free";

export const SYSTEM_FREE_PLAN_FEATURES = {
  maxSessions: 1,
  maxMessagesPerMonth: 10,
  maxApiCallsPerMinute: 10,
  maxWebhooks: 1,
  maxContacts: 10,
  maxTeamMembers: 1,
  maxWorkflows: 1,
  maxChatbots: 1,
  maxWabaNumbers: 1,
  hasWhatsappBusinessApi: true,
  hasAnalytics: false,
  hasPrioritySupport: false,
  hasMessageHistorySync: false,
} as const;

const SYSTEM_FREE_PLAN_PAYLOAD = {
  name: SYSTEM_FREE_PLAN_NAME,
  slug: SYSTEM_FREE_PLAN_NAME,
  displayName: "Free",
  description: "Default free plan for new signups (system — not editable)",
  priceMonthly: 0,
  priceQuarterly: 0,
  priceYearly: 0,
  features: { ...SYSTEM_FREE_PLAN_FEATURES },
  isActive: true,
  status: "published" as const,
  isPopular: false,
  currency: "INR",
  defaultBillingCycle: "monthly" as const,
  planFeatures: [] as string[],
  autoAssignOnSignup: true,
  autoAssignTrialDays: 3,
  isSystemDefault: true,
};

/** Ensure columns exist on older DBs that only received partial schema syncs. */
async function ensureSystemFreePlanColumns(): Promise<void> {
  await db.execute(sql`ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_system_default boolean NOT NULL DEFAULT false`);
  await db.execute(sql`ALTER TABLE plans ADD COLUMN IF NOT EXISTS auto_assign_on_signup boolean DEFAULT false`);
  await db.execute(sql`ALTER TABLE plans ADD COLUMN IF NOT EXISTS auto_assign_trial_days integer DEFAULT 7`);
  // Trigger trg_set_updated_at requires this column (ensure_created_updated_at_columns.sql)
  await db.execute(sql`ALTER TABLE plans ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW()`);
}

/**
 * Ensures the locked Free plan exists with the correct limits and is the only
 * auto-assign-on-signup plan. Safe to call on startup and when a SaaS owner is set.
 *
 * Does NOT skip when other plans (Trial, Starter, …) already exist — always
 * creates/updates the system Free row and clears auto-assign on other plans.
 */
export async function ensureSystemFreePlan(): Promise<{ id: string; name: string }> {
  if (isMongoEnabled()) {
    let plan = await PlanModel.findOne({ isSystemDefault: true }).lean();
    if (!plan) {
      plan = await PlanModel.findOne({ name: { $in: [SYSTEM_FREE_PLAN_NAME, "free"] } }).lean();
    }
    if (!plan) {
      const created = await PlanModel.create({
        _id: crypto.randomUUID(),
        ...SYSTEM_FREE_PLAN_PAYLOAD,
      });
      console.log(`[Plans] Ensured system Free plan in MongoDB (created id=${created._id})`);
      return { id: created._id, name: created.name };
    }
    await PlanModel.findByIdAndUpdate(plan._id, {
      $set: {
        displayName: "Free",
        description: SYSTEM_FREE_PLAN_PAYLOAD.description,
        priceMonthly: 0,
        priceQuarterly: 0,
        priceYearly: 0,
        features: { ...SYSTEM_FREE_PLAN_FEATURES },
        isActive: true,
        status: "published",
        currency: "INR",
        defaultBillingCycle: "monthly",
        autoAssignOnSignup: true,
        autoAssignTrialDays: 3,
        isSystemDefault: true,
        updatedAt: new Date(),
      },
    });
    console.log(`[Plans] Ensured system Free plan in MongoDB (updated id=${plan._id})`);
    return { id: plan._id, name: plan.name };
  }

  try {
    await ensureSystemFreePlanColumns();
  } catch (colErr) {
    console.warn(
      "[Plans] Could not ensure Free-plan columns (continuing):",
      colErr instanceof Error ? colErr.message : colErr,
    );
  }

  // Prefer existing system-default row (never invent from Trial/Starter by price)
  const [existingSystem] = await db
    .select()
    .from(plans)
    .where(eq(plans.isSystemDefault, true))
    .limit(1);

  // Or locked slug / legacy "free" by name only
  let plan = existingSystem;
  let action: "updated" | "created" = "updated";
  if (!plan) {
    const [byName] = await db
      .select()
      .from(plans)
      .where(eq(plans.name, SYSTEM_FREE_PLAN_NAME))
      .limit(1);
    plan = byName;
  }
  if (!plan) {
    const [legacyFree] = await db
      .select()
      .from(plans)
      .where(eq(plans.name, "free"))
      .limit(1);
    plan = legacyFree;
  }

  if (plan) {
    const [updated] = await db
      .update(plans)
      .set({
        // Normalize legacy slug "free" → "system_free" (do not rename other system-default rows)
        name: plan.name === "free" ? SYSTEM_FREE_PLAN_NAME : plan.name,
        displayName: "Free",
        description: SYSTEM_FREE_PLAN_PAYLOAD.description,
        priceMonthly: 0,
        priceQuarterly: 0,
        priceYearly: 0,
        features: { ...SYSTEM_FREE_PLAN_FEATURES },
        isActive: true,
        status: "published",
        currency: "INR",
        defaultBillingCycle: "monthly",
        autoAssignOnSignup: true,
        autoAssignTrialDays: 3,
        isSystemDefault: true,
        updatedAt: new Date(),
      } as any)
      .where(eq(plans.id, plan.id))
      .returning();
    plan = updated || plan;
  } else {
    const [created] = await db
      .insert(plans)
      .values(SYSTEM_FREE_PLAN_PAYLOAD as any)
      .returning();
    if (!created) {
      throw new Error("Failed to insert system Free plan");
    }
    plan = created;
    action = "created";
  }

  // Only the system free plan should auto-assign (leave other plans intact otherwise)
  await db
    .update(plans)
    .set({ autoAssignOnSignup: false } as any)
    .where(and(ne(plans.id, plan.id), eq(plans.autoAssignOnSignup, true)));

  console.log(`[Plans] System Free plan ${action}: ${plan.id} (${plan.name})`);
  return { id: plan.id, name: plan.name };
}

export function isSystemFreePlan(plan: { isSystemDefault?: boolean | null; name?: string | null } | null | undefined): boolean {
  if (!plan) return false;
  if (plan.isSystemDefault) return true;
  // Locked slug used by ensureSystemFreePlan when no legacy "free" row exists
  const name = (plan.name || "").toLowerCase();
  return name === SYSTEM_FREE_PLAN_NAME || name === "free";
}

/** Platform owners (`is_saas_owner`) must never receive the default Free plan. */
export function shouldSkipDefaultPlanAssignment(
  user: { isSaaSOwner?: boolean | null } | null | undefined,
): boolean {
  return Boolean(user?.isSaaSOwner);
}

/**
 * Cancel an active/latest system Free subscription for a SaaS owner.
 * Returns true when a Free subscription was cancelled.
 */
export async function clearSystemFreeSubscriptionForSaasOwner(userId: string): Promise<boolean> {
  const { storage } = await import("../storage");
  const user = await storage.getUser(userId);
  if (!user?.isSaaSOwner) return false;

  const subscription =
    (await storage.getActiveSubscriptionByUser(userId)) ||
    (await storage.getSubscriptionByUser(userId));
  if (!subscription || subscription.status === "cancelled") return false;

  const plan = await storage.getPlan(subscription.planId);
  if (!isSystemFreePlan(plan)) return false;

  await storage.updateSubscription(subscription.id, {
    status: "cancelled",
    cancelAtPeriodEnd: false,
  } as any);
  try {
    await storage.addSubscriptionHistory({
      userId,
      planId: subscription.planId,
      subscriptionId: subscription.id,
      action: "cancelled",
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
      billingCycle: (subscription.billingCycle as "monthly" | "quarterly" | "yearly") || "monthly",
    });
  } catch (histErr: any) {
    console.error(
      "[Plans] Failed to record Free-plan cancel for SaaS owner:",
      histErr?.message || histErr,
    );
  }
  console.log(`[Plans] Cleared system Free subscription for SaaS owner ${userId}`);
  return true;
}
