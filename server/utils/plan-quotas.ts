/**
 * Plan feature quotas (contacts, team, chatbots, workflows, WABA).
 * -1 or undefined/null limit = unlimited.
 */
import { storage } from "../storage";

export type PlanQuotaKind =
  | "contacts"
  | "team_members"
  | "chatbots"
  | "workflows"
  | "waba_numbers";

export type PlanQuotaDenial = {
  status: 403 | 429;
  body: {
    error: string;
    message: string;
    upgradeRequired: true;
    currentPlan?: string;
    usage?: { current: number; limit: number };
  };
};

function limitOf(features: Record<string, unknown> | null | undefined, key: string): number | null {
  if (!features || typeof features !== "object") return null;
  const raw = (features as any)[key];
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n === -1) return null; // unlimited
  return Math.max(0, Math.floor(n));
}

function denial(
  error: string,
  message: string,
  planName: string | undefined,
  current: number,
  limit: number,
  status: 403 | 429 = 429,
): PlanQuotaDenial {
  return {
    status,
    body: {
      error,
      message,
      upgradeRequired: true,
      currentPlan: planName,
      usage: { current, limit },
    },
  };
}

async function resolvePlanContext(userId: string) {
  const user = await storage.getUser(userId);
  if (user?.isSaaSOwner) {
    return { bypass: true as const };
  }
  const { subscription, effectiveUserId } = await storage.getEffectiveActiveSubscription(userId);
  if (!subscription) {
    return {
      bypass: false as const,
      denial: denial(
        "No active subscription",
        "Your subscription is missing or expired. Please renew or upgrade your plan to continue.",
        undefined,
        0,
        0,
        403,
      ),
    };
  }
  const plan = await storage.getPlan(subscription.planId);
  if (!plan || !plan.isActive) {
    return {
      bypass: false as const,
      denial: denial(
        "Invalid or inactive subscription plan",
        "Please select an active subscription plan to continue.",
        plan?.name,
        0,
        0,
        403,
      ),
    };
  }
  return { bypass: false as const, plan, effectiveUserId, subscription };
}

/**
 * Enforce a plan quota before creating/activating a resource.
 * `addCount` is how many new items are about to be added (default 1).
 * Returns null if allowed, or a denial payload to send as JSON.
 */
export async function assertPlanQuota(_options: {
  userId: string;
  organizationId: string;
  kind: PlanQuotaKind;
  addCount?: number;
  activating?: boolean;
}): Promise<PlanQuotaDenial | null> {
  // BYPASSED: All resources are unlimited
  return null;
}

export function sendPlanQuotaDenial(res: any, denialResult: PlanQuotaDenial) {
  return res.status(denialResult.status).json(denialResult.body);
}
