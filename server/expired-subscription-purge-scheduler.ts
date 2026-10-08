/**
 * After subscription expiry + configured retention months,
 * permanently delete the billing user's organization / business data.
 * The user account is kept so they can renew later.
 *
 * Skips SaaS owners. Idempotent via users.subscription_data_purged_at (auto path).
 */
import { db } from "../db";
import { users, organizations, subscriptions, organizationMembers, apiKeys } from "@shared/schema";
import { isMongoEnabled } from "../db/mongo";
import { eq, and, desc } from "drizzle-orm";
import { storage } from "./storage";
import {
  getSubscriptionDataRetentionDays,
  isPastDataRetention,
} from "./utils/org-subscription-gate";
import { isSubscriptionPeriodActiveByCalendarDay } from "./utils/subscription-calendar";

const DAY_MS = 24 * 60 * 60 * 1000;

async function markStaleSubscriptionsExpired(): Promise<number> {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.status, "active"));

  let marked = 0;
  for (const sub of rows) {
    if (!isSubscriptionPeriodActiveByCalendarDay(sub.currentPeriodEnd)) {
      await db
        .update(subscriptions)
        .set({ status: "expired", updatedAt: new Date() })
        .where(and(eq(subscriptions.id, sub.id), eq(subscriptions.status, "active")));
      marked += 1;
    }
  }
  return marked;
}

export type ExpiredSubscriptionUserRow = {
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  isActive: boolean;
  periodEnd: Date;
  subscriptionStatus: string | null;
  planName: string | null;
  planDisplayName: string | null;
  dataDeletionAt: string | null;
  retentionDays: number;
  daysUntilDataDeletion: number | null;
  dataPurgedAt: string | null;
  organizationCount: number;
};

async function findLatestSubscriptionByUser() {
  const allSubs = await db
    .select({
      userId: subscriptions.userId,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      status: subscriptions.status,
      planId: subscriptions.planId,
      createdAt: subscriptions.createdAt,
    })
    .from(subscriptions)
    .orderBy(desc(subscriptions.createdAt));

  const latestByUser = new Map<string, (typeof allSubs)[0]>();
  for (const row of allSubs) {
    if (!latestByUser.has(row.userId)) {
      latestByUser.set(row.userId, row);
    }
  }
  return latestByUser;
}

/**
 * Users with no active plan — expired subscription history and never-subscribed ("No plan").
 * Used by admin UI (includes those awaiting retention and already purged).
 */
export async function listExpiredSubscriptionUsers(): Promise<ExpiredSubscriptionUserRow[]> {
  const retentionDays = await getSubscriptionDataRetentionDays();
  const latestByUser = await findLatestSubscriptionByUser();
  const now = new Date();
  const out: ExpiredSubscriptionUserRow[] = [];

  const allUsers = await storage.getAllUsers();

  for (const user of allUsers) {
    if (!user || user.isSaaSOwner) continue;

    const active = await storage.getActiveSubscriptionByUser(user.id);
    if (active) continue;

    const latest = latestByUser.get(user.id);
    let end: Date;
    let subscriptionStatus: string | null = null;
    let planName: string | null = null;
    let planDisplayName: string | null = null;

    if (latest) {
      const periodEnd =
        latest.currentPeriodEnd instanceof Date
          ? latest.currentPeriodEnd
          : new Date(latest.currentPeriodEnd);
      // Period still valid → treated as entitled elsewhere; still "No plan" in admin when status ≠ active.
      // Include them only once the paid period has ended (otherwise they are not truly expired).
      if (!Number.isNaN(periodEnd.getTime()) && isSubscriptionPeriodActiveByCalendarDay(periodEnd)) {
        continue;
      }
      end = Number.isNaN(periodEnd.getTime())
        ? new Date(user.createdAt ?? now)
        : periodEnd;
      subscriptionStatus = latest.status ?? "expired";
      if (latest.planId) {
        try {
          const plan = await storage.getPlan(latest.planId);
          planName = plan?.name ?? null;
          planDisplayName = plan?.displayName ?? null;
        } catch {
          /* ignore */
        }
      }
    } else {
      // Never subscribed / no plan row — same retention anchor as panel gate (account createdAt).
      end = user.createdAt ? new Date(user.createdAt) : now;
      if (Number.isNaN(end.getTime())) end = now;
      subscriptionStatus = "none";
      planName = null;
      planDisplayName = null;
    }

    const dataDeletionAt = new Date(end.getTime());
    dataDeletionAt.setUTCDate(dataDeletionAt.getUTCDate() + retentionDays);
    const msLeft = dataDeletionAt.getTime() - now.getTime();
    const daysUntilDataDeletion = Math.ceil(msLeft / DAY_MS);

    const orgs = await storage.getOrganizationsByUser(user.id);

    out.push({
      userId: user.id,
      email: user.email ?? null,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      phone: user.phone ?? null,
      isActive: !!user.isActive,
      periodEnd: end,
      subscriptionStatus,
      planName,
      planDisplayName,
      dataDeletionAt: dataDeletionAt.toISOString(),
      retentionDays,
      daysUntilDataDeletion,
      dataPurgedAt: user.subscriptionDataPurgedAt
        ? new Date(user.subscriptionDataPurgedAt).toISOString()
        : null,
      organizationCount: orgs.length,
    });
  }

  out.sort((a, b) => a.periodEnd.getTime() - b.periodEnd.getTime());
  return out;
}

async function findUserIdsEligibleForPurge(): Promise<
  Array<{ userId: string; periodEnd: Date; email: string | null }>
> {
  const retentionDays = await getSubscriptionDataRetentionDays();
  const candidates: Array<{ userId: string; periodEnd: Date; email: string | null }> = [];
  const latestByUser = await findLatestSubscriptionByUser();
  const allUsers = await storage.getAllUsers();

  for (const user of allUsers) {
    if (!user || user.isSaaSOwner) continue;
    if (user.subscriptionDataPurgedAt) continue;

    const active = await storage.getActiveSubscriptionByUser(user.id);
    if (active) continue;

    const latest = latestByUser.get(user.id);
    let periodEnd: Date;

    if (latest) {
      periodEnd =
        latest.currentPeriodEnd instanceof Date
          ? latest.currentPeriodEnd
          : new Date(latest.currentPeriodEnd);
      if (Number.isNaN(periodEnd.getTime())) continue;
      if (isSubscriptionPeriodActiveByCalendarDay(periodEnd)) continue;
    } else {
      periodEnd = user.createdAt ? new Date(user.createdAt) : new Date();
      if (Number.isNaN(periodEnd.getTime())) continue;
    }

    if (!isPastDataRetention(periodEnd, new Date(), retentionDays)) continue;

    candidates.push({
      userId: user.id,
      periodEnd,
      email: user.email ?? null,
    });
  }

  return candidates;
}

/**
 * Delete organization / WhatsApp / API business data. Keeps the user login and billing history.
 * Recreates an empty owned organization so the account can renew cleanly.
 */
export async function purgeExpiredUserBusinessData(
  userId: string,
  opts?: { force?: boolean },
): Promise<{ purged: boolean; message: string }> {
  const user = await storage.getUser(userId);
  if (!user) {
    return { purged: false, message: "User not found" };
  }
  if (user.isSaaSOwner) {
    console.warn(`[ExpiredPurge] Refusing to purge SaaS owner ${userId}`);
    return { purged: false, message: "Cannot purge SaaS owner data" };
  }

  if (!opts?.force && user.subscriptionDataPurgedAt) {
    return { purged: false, message: "Business data was already purged for this user" };
  }

  // Clear invite references that may lack ON DELETE
  try {
    await db
      .update(organizationMembers)
      .set({ invitedBy: null } as any)
      .where(eq(organizationMembers.invitedBy, userId));
  } catch (e) {
    console.warn("[ExpiredPurge] Could not clear invitedBy refs:", (e as Error)?.message);
  }

  // WhatsApp sessions (not FK-linked to orgs)
  try {
    const sessions = await storage.getSessionsByUser(userId);
    for (const session of sessions) {
      await storage.deleteSession(session.id);
    }
  } catch (e) {
    console.warn("[ExpiredPurge] Session wipe issue:", (e as Error)?.message);
  }

  // API keys (org id is not always FK-cascaded)
  try {
    const keys = await storage.getApiKeysByUser(userId);
    for (const key of keys) {
      await storage.deleteApiKey(key.id);
    }
  } catch (e) {
    console.warn("[ExpiredPurge] API key wipe issue:", (e as Error)?.message);
  }

  // Also delete any api_keys rows still pointing at this user
  try {
    await db.delete(apiKeys).where(eq(apiKeys.userId, userId));
  } catch {
    /* ignore if table shape differs */
  }

  const ownedOrgs = await db
    .select()
    .from(organizations)
    .where(eq(organizations.ownerId, userId));

  for (const org of ownedOrgs) {
    console.log(`[ExpiredPurge] Deleting organization data ${org.id} (${org.name}) for user ${userId}`);
    await storage.deleteOrganization(org.id);
  }

  // Leave other orgs as member only (remove memberships)
  await db.delete(organizationMembers).where(eq(organizationMembers.userId, userId));

  // Fresh empty org so login / renew still has an organization context
  const display =
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    user.email?.split("@")[0] ||
    "Workspace";
  const organization = await storage.createOrganization({
    name: `${display}'s Workspace`,
    ownerId: userId,
  });
  await storage.addOrganizationMember({
    organizationId: organization.id,
    userId,
    role: "owner",
  });

  await db
    .update(users)
    .set({ subscriptionDataPurgedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId));

  console.log(
    `[ExpiredPurge] Business data purged for user ${userId} (${user.email || "no-email"}); account retained`,
  );
  return { purged: true, message: "Business data deleted; user account retained" };
}

/** @deprecated Use purgeExpiredUserBusinessData — does not delete the user. */
export async function purgeExpiredUserAccount(userId: string): Promise<void> {
  await purgeExpiredUserBusinessData(userId, { force: true });
}

export async function runExpiredSubscriptionPurge(): Promise<{
  markedExpired: number;
  purged: number;
  errors: number;
  retentionDays: number;
}> {
  if (isMongoEnabled()) {
    return { markedExpired: 0, purged: 0, errors: 0, retentionDays: 90 };
  }
  const retentionDays = await getSubscriptionDataRetentionDays();
  const markedExpired = await markStaleSubscriptionsExpired();
  const eligible = await findUserIdsEligibleForPurge();
  let purged = 0;
  let errors = 0;

  for (const row of eligible) {
    try {
      console.log(
        `[ExpiredPurge] Purging business data for user ${row.userId} (${row.email}) — period ended ${row.periodEnd.toISOString()} (≥${retentionDays}d retention)`,
      );
      const result = await purgeExpiredUserBusinessData(row.userId);
      if (result.purged) purged += 1;
    } catch (e) {
      errors += 1;
      console.error(`[ExpiredPurge] Failed for ${row.userId}:`, e);
    }
  }

  if (markedExpired || purged || errors) {
    console.log(
      `[ExpiredPurge] Done: markedExpired=${markedExpired} purged=${purged} errors=${errors} retentionDays=${retentionDays}`,
    );
  }

  return { markedExpired, purged, errors, retentionDays };
}

export function startExpiredSubscriptionPurgeScheduler(): void {
  if (process.env.DISABLE_EXPIRED_SUBSCRIPTION_PURGE === "true") {
    console.log("[ExpiredPurge] Disabled (DISABLE_EXPIRED_SUBSCRIPTION_PURGE=true)");
    return;
  }

  const raw = process.env.EXPIRED_SUBSCRIPTION_PURGE_INTERVAL_MS?.trim();
  const parsed = raw ? parseInt(raw, 10) : NaN;
  const intervalMs = Number.isFinite(parsed)
    ? Math.min(Math.max(parsed, 60 * 60 * 1000), 7 * DAY_MS)
    : DAY_MS;

  const tick = () => {
    void runExpiredSubscriptionPurge().catch((e) =>
      console.error("[ExpiredPurge] Scheduler tick failed:", e),
    );
  };

  setTimeout(tick, 5 * 60 * 1000);
  setInterval(tick, intervalMs);
  void getSubscriptionDataRetentionDays()
    .then((days) => {
      console.log(
        `[ExpiredPurge] Scheduler started: retention=${days}d (admin-configurable 1–3 months), first run in 5m, then every ${Math.round(intervalMs / 3600000)}h`,
      );
    })
    .catch((e) => {
      console.error(
        "[ExpiredPurge] Could not read retention setting at startup (scheduler still armed):",
        (e as Error)?.message || e,
      );
    });
}
