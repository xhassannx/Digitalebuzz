// @ts-nocheck
import type { Express } from "express";
import crypto from "crypto";
import { storage } from "../storage";
import { db } from "../../db";
import { isMongoEnabled } from "../../db/mongo";
import {
  ManagedContactModel,
  IntegrationModel,
  ChatbotModel,
  AutomationFlowModel,
  GroupModel,
} from "../models";
import { isAuthenticated } from "../replitAuth";
import { isSaaSOwner } from "../middleware/admin-auth";
import {
  insertPlanSchema,
  insertOrganizationThemeSchema,
  addons,
  signupSchema,
  managedContacts,
  integrations,
  chatbots,
  automationFlows,
  groups,
  type PlatformMasterSettingsRow,
} from "@shared/schema";
import { redactCustomerPortalPayloadForStorage } from "../customer-portal-payload";
import { z } from "zod";
import { fromError } from "zod-validation-error";
import { eq, and, desc, inArray, sql, or, isNull } from "drizzle-orm";
import { readWebhookLogs } from "../webhooks/meta-webhook-logger";
import { rateLimiter } from "../middleware/rate-limiter";
import {
  mergeLiveContractForOutstandingLimit,
  normalizeWhitelabelPaymentGateway,
  parseOutstandingLimitMinorFromUpstreamPayload,
  readWhitelabelOnboardingContractFromUpstreamPayload,
} from "../whitelabel-onboarding-fee";
import { checkCustomerStatusCached, fetchCustomerFromApi } from "../updates";
import { sendEmail, sendWelcomeEmailAfterSignup } from "../utils/email";
import { TRIAL_ACCOUNT_DAYS, trialExpiresAtFromNow } from "@shared/trial-account";
import { ensureSystemFreePlan, isSystemFreePlan, shouldSkipDefaultPlanAssignment, clearSystemFreeSubscriptionForSaasOwner } from "../utils/system-free-plan";
import { getUserStorageStatsMap, storageStatsToObject } from "../utils/user-storage-stats";
import { accrueInitialWhitelabelOnboardingFee } from "../whitelabel-onboarding-accrual";
import { checkOnboardingOutstandingGateFresh } from "../onboarding-outstanding-gate";

async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, Math.max(items.length, 1)) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return results;
}

function toPublicPlatformMasterRow(row: PlatformMasterSettingsRow | undefined | null) {
  if (!row) return null;
  const raw = row.upstreamPayload;
  const up =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? redactCustomerPortalPayloadForStorage(raw as Record<string, unknown>)
      : {};
  const { revenueShareLocal: _revenueShareLocal, ...rest } = row;
  return { ...rest, upstreamPayload: up };
}

export function registerAdminRoutes(app: Express) {
  // Helper to get user ID from request
  const getUserId = (req: any): string => {
    return req.user?.claims?.sub || req.user?.id;
  };

  // ========== USERS MANAGEMENT ==========
  
  // Get all users (admin only) — keep this fast; storage loads via /api/admin/users/storage-stats
  app.get("/api/admin/users", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      const { createdFrom, createdTo, subExpiryFrom, subExpiryTo, subStartFrom, subStartTo } = req.query;

      // Cap concurrency so ~200 users don't open 1000+ simultaneous DB queries
      let usersWithDetails = await mapPool(users, 8, async (user) => {
        try {
          const subscription = await storage.getActiveSubscriptionByUser(user.id);
          const plan = subscription ? await storage.getPlan(subscription.planId) : null;
          const organizations = await storage.getOrganizationsByUser(user.id);
          const orgMembers = organizations.length > 0
            ? await storage.getOrganizationMembers(organizations[0].id)
            : [];
          const member = orgMembers.find((m) => m.userId === user.id);
          const userAddons = await storage.getAddonsByUser(user.id);
          return {
            ...user,
            subscription,
            plan,
            organizations,
            organizationCount: organizations.length,
            primaryRole: member?.role ?? null,
            addonsCount: userAddons.length,
          };
        } catch (userError: any) {
          console.warn("[Admin] Partial user enrichment failed:", {
            userId: user.id,
            error: userError?.message || String(userError),
          });
          return {
            ...user,
            subscription: null,
            plan: null,
            organizations: [],
            organizationCount: 0,
            primaryRole: null,
            addonsCount: 0,
          };
        }
      });

      // Apply date filters
      if (createdFrom) {
        const from = new Date(createdFrom as string).getTime();
        usersWithDetails = usersWithDetails.filter((u) => new Date(u.createdAt!).getTime() >= from);
      }
      if (createdTo) {
        const to = new Date(createdTo as string).getTime();
        usersWithDetails = usersWithDetails.filter((u) => new Date(u.createdAt!).getTime() <= to);
      }
      if (subExpiryFrom) {
        const from = new Date(subExpiryFrom as string).getTime();
        usersWithDetails = usersWithDetails.filter(
          (u) => u.subscription && new Date(u.subscription.currentPeriodEnd).getTime() >= from
        );
      }
      if (subExpiryTo) {
        const to = new Date(subExpiryTo as string).getTime();
        usersWithDetails = usersWithDetails.filter(
          (u) => u.subscription && new Date(u.subscription.currentPeriodEnd).getTime() <= to
        );
      }
      if (subStartFrom) {
        const from = new Date(subStartFrom as string).getTime();
        usersWithDetails = usersWithDetails.filter(
          (u) => u.subscription && new Date(u.subscription.currentPeriodStart).getTime() >= from
        );
      }
      if (subStartTo) {
        const to = new Date(subStartTo as string).getTime();
        usersWithDetails = usersWithDetails.filter(
          (u) => u.subscription && new Date(u.subscription.currentPeriodStart).getTime() <= to
        );
      }

      // Only show organization owners in the users list (exclude team members who are only member/admin)
      usersWithDetails = usersWithDetails.filter((u) =>
        u.organizations?.some((org: { ownerId: string }) => org.ownerId === u.id)
      );

      res.json({ users: usersWithDetails, total: usersWithDetails.length });
    } catch (error: any) {
      console.error("[Admin] Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users", error: error.message });
    }
  });

  // Per-user storage (DB + uploads/). Separate so the users table can render immediately.
  app.get("/api/admin/users/storage-stats", isAuthenticated, isSaaSOwner, async (_req: any, res) => {
    try {
      const map = await getUserStorageStatsMap();
      res.json({ storage: storageStatsToObject(map) });
    } catch (error: any) {
      console.error("[Admin] Error fetching user storage stats:", error);
      res.status(500).json({ message: "Failed to fetch storage stats", error: error.message });
    }
  });

  // Create user (admin only)
  app.post("/api/admin/users", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const result = signupSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: fromError(result.error).toString(),
        });
      }
      const { email, password, firstName, lastName, organizationName, phone } = result.data;
      const createAsTrial = req.body?.createAsTrial === true || req.body?.createAsTrial === "true";

      if (!createAsTrial) {
        try {
          const gate = await checkOnboardingOutstandingGateFresh();
          if (!gate.allowed) {
            return res.status(403).json({
              message:
                "Pay outstanding onboarding fees before creating more customers. Unpaid total has reached your licensor outstanding limit.",
              code: gate.code,
              outstanding_minor: gate.outstandingMinor,
              limit_minor: gate.limitMinor,
            });
          }
        } catch {
          /* fail open if gate cannot be evaluated */
        }
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }

      const bcrypt = await import("bcryptjs");
      const passwordHash = await bcrypt.default.hash(password, 10);
      const crypto = await import("crypto");
      const userId = crypto.randomUUID();

      await storage.upsertUser({
        id: userId,
        email,
        passwordHash,
        firstName,
        lastName,
        phone,
        isTrialAccount: createAsTrial,
        trialExpiresAt: createAsTrial ? trialExpiresAtFromNow(TRIAL_ACCOUNT_DAYS) : null,
      });

      const organization = await storage.createOrganization({
        name: organizationName,
        ownerId: userId,
      });
      await storage.addOrganizationMember({
        organizationId: organization.id,
        userId,
        role: "owner",
      });

      // Auto-assign plan on create if configured (never for SaaS platform owners)
      const createdUser = await storage.getUser(userId);
      const autoAssignPlan = shouldSkipDefaultPlanAssignment(createdUser)
        ? undefined
        : await storage.getAutoAssignPlan();
      if (autoAssignPlan) {
        const trialDays = createAsTrial
          ? TRIAL_ACCOUNT_DAYS
          : ((autoAssignPlan as any).autoAssignTrialDays ?? 7);
        const start = new Date();
        const end = createAsTrial ? trialExpiresAtFromNow(TRIAL_ACCOUNT_DAYS) : new Date(start);
        if (!createAsTrial) {
          end.setDate(end.getDate() + trialDays);
        }
        try {
          const subscription = await storage.createSubscription({
            userId,
            planId: autoAssignPlan.id,
            billingCycle: "monthly",
            currentPeriodStart: start,
            currentPeriodEnd: end,
            status: "active",
          });
          await storage.addSubscriptionHistory({
            userId,
            planId: autoAssignPlan.id,
            subscriptionId: subscription.id,
            action: "assigned",
            periodStart: start,
            periodEnd: end,
            billingCycle: "monthly",
          });
        } catch (subErr) {
          console.error("[Admin] Failed to auto-assign plan on user create:", subErr);
        }
      }

      const user = await storage.getUser(userId);
      void sendWelcomeEmailAfterSignup({
        userId,
        email,
        firstName,
        organizationName,
        isTrialAccount: createAsTrial,
      }).catch((err) => console.error("[Admin] Onboarding email:", err));

      let onboardingAccrual: Awaited<ReturnType<typeof accrueInitialWhitelabelOnboardingFee>> | null = null;
      try {
        onboardingAccrual = await accrueInitialWhitelabelOnboardingFee(userId, "assigned");
      } catch (accrualErr) {
        console.error("[Admin] Onboarding fee accrual on user create:", accrualErr);
      }

      res.status(201).json({
        user,
        isTrialAccount: createAsTrial,
        onboardingAccrual,
        onboardingFee:
          onboardingAccrual?.status === "accrued"
            ? {
                id: onboardingAccrual.fee.id,
                amountMinor: onboardingAccrual.fee.amountMinor,
                currency: onboardingAccrual.fee.currency,
                trigger: onboardingAccrual.fee.trigger,
                status: onboardingAccrual.fee.status,
              }
            : null,
      });
    } catch (error: any) {
      console.error("[Admin] Error creating user:", error);
      res.status(500).json({ message: "Failed to create user", error: error.message });
    }
  });

  // Get all orders (payments) - admin only
  app.get("/api/admin/orders", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const { search, status, itemName, createdFrom, createdTo, limit, offset } = req.query;
      const { payments: orders, total } = await storage.getAllPaymentsForAdmin({
        search: search as string,
        status: status as string,
        itemName: itemName as string,
        createdFrom: createdFrom as string,
        createdTo: createdTo as string,
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
      });
      res.json({ orders, total });
    } catch (error: any) {
      console.error("[Admin] Error fetching orders:", error);
      res.status(500).json({ message: "Failed to fetch orders", error: error.message });
    }
  });

  // Get subscription/plan history for a user - admin only
  app.get("/api/admin/users/:userId/plan-history", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const history = await storage.getSubscriptionHistoryByUser(userId);
      res.json({ history });
    } catch (error: any) {
      console.error("[Admin] Error fetching plan history:", error);
      res.status(500).json({ message: "Failed to fetch plan history", error: error.message });
    }
  });

  // Helper: resolve org IDs for a user (admin activity scoping)
  async function getAdminUserOrgIds(userId: string): Promise<string[]> {
    const organizations = await storage.getOrganizationsByUser(userId);
    return organizations.map((o) => o.id).filter(Boolean);
  }

  async function assertAdminUserOwnsOrg(userId: string, organizationId: string | null | undefined): Promise<boolean> {
    if (!organizationId) return false;
    const orgIds = await getAdminUserOrgIds(userId);
    return orgIds.includes(organizationId);
  }

  function parseAdminPagination(query: any): { limit: number; offset: number } {
    const limit = Math.min(Math.max(Number.parseInt(String(query.limit ?? "10"), 10) || 10, 1), 100);
    const offset = Math.max(Number.parseInt(String(query.offset ?? "0"), 10) || 0, 0);
    return { limit, offset };
  }

  async function getAdminActivityCounts(userId: string, orgIds: string[]) {
    if (isMongoEnabled()) {
      const contactFilter: any = orgIds.length
        ? { $or: [{ organizationId: { $in: orgIds } }, { organization_id: { $in: orgIds } }] }
        : { _id: null };
      const integrationFilter: any = orgIds.length
        ? {
            $or: [
              { organizationId: { $in: orgIds } },
              { organization_id: { $in: orgIds } },
              { userId, organizationId: { $exists: false } },
              { userId, organizationId: null },
            ],
          }
        : { userId };
      const chatbotFilter: any = orgIds.length
        ? {
            $or: [
              { organizationId: { $in: orgIds } },
              { organization_id: { $in: orgIds } },
              { userId, organizationId: { $exists: false } },
              { userId, organizationId: null },
            ],
          }
        : { userId };
      const flowFilter: any = orgIds.length
        ? {
            $or: [
              { organizationId: { $in: orgIds } },
              { organization_id: { $in: orgIds } },
              { userId, organizationId: { $exists: false } },
              { userId, organizationId: null },
            ],
          }
        : { userId };
      const listFilter: any = orgIds.length
        ? { $or: [{ organizationId: { $in: orgIds } }, { organization_id: { $in: orgIds } }] }
        : { _id: null };

      const [contacts, integrationsCount, chatbotsCount, flows, lists] = await Promise.all([
        ManagedContactModel.countDocuments(contactFilter),
        IntegrationModel.countDocuments(integrationFilter),
        ChatbotModel.countDocuments(chatbotFilter),
        AutomationFlowModel.countDocuments(flowFilter),
        GroupModel.countDocuments(listFilter),
      ]);

      return {
        contacts,
        integrations: integrationsCount,
        chatbots: chatbotsCount,
        flows,
        lists,
      };
    }

    const orgContactWhere = orgIds.length ? inArray(managedContacts.organizationId, orgIds) : sql`false`;
    const orgIntegrationWhere = orgIds.length
      ? or(inArray(integrations.organizationId, orgIds), and(eq(integrations.userId, userId), isNull(integrations.organizationId)))
      : eq(integrations.userId, userId);
    const orgChatbotWhere = orgIds.length
      ? or(inArray(chatbots.organizationId, orgIds), and(eq(chatbots.userId, userId), isNull(chatbots.organizationId)))
      : eq(chatbots.userId, userId);
    const orgFlowWhere = orgIds.length
      ? or(inArray(automationFlows.organizationId, orgIds), and(eq(automationFlows.userId, userId), isNull(automationFlows.organizationId)))
      : eq(automationFlows.userId, userId);
    const orgListWhere = orgIds.length ? inArray(groups.organizationId, orgIds) : sql`false`;

    const [[contactsRow], [integrationsRow], [chatbotsRow], [flowsRow], [listsRow]] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(managedContacts).where(orgContactWhere),
      db.select({ count: sql<number>`count(*)::int` }).from(integrations).where(orgIntegrationWhere),
      db.select({ count: sql<number>`count(*)::int` }).from(chatbots).where(orgChatbotWhere),
      db.select({ count: sql<number>`count(*)::int` }).from(automationFlows).where(orgFlowWhere),
      db.select({ count: sql<number>`count(*)::int` }).from(groups).where(orgListWhere),
    ]);

    return {
      contacts: Number(contactsRow?.count ?? 0),
      integrations: Number(integrationsRow?.count ?? 0),
      chatbots: Number(chatbotsRow?.count ?? 0),
      flows: Number(flowsRow?.count ?? 0),
      lists: Number(listsRow?.count ?? 0),
    };
  }

  // Activity counts summary
  app.get("/api/admin/users/:userId/activities", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const organizations = await storage.getOrganizationsByUser(userId);
      const orgIds = organizations.map((o) => o.id).filter(Boolean);
      const counts = await getAdminActivityCounts(userId, orgIds);
      res.json({ counts, organizations });
    } catch (error: any) {
      console.error("[Admin] Error fetching user activities:", error);
      res.status(500).json({ message: "Failed to fetch user activities", error: error.message });
    }
  });

  // Paginated contacts
  app.get("/api/admin/users/:userId/activities/contacts", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const orgIds = await getAdminUserOrgIds(userId);
      const { limit, offset } = parseAdminPagination(req.query);
      if (!orgIds.length) {
        return res.json({ contacts: [], total: 0, limit, offset });
      }

      const whereClause = inArray(managedContacts.organizationId, orgIds);
      const [{ total }] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(managedContacts)
        .where(whereClause);
      const rows = await db
        .select({
          id: managedContacts.id,
          name: managedContacts.name,
          phoneNumber: managedContacts.phoneNumber,
          email: managedContacts.email,
          source: managedContacts.source,
          organizationId: managedContacts.organizationId,
          createdAt: managedContacts.createdAt,
          updatedAt: managedContacts.updatedAt,
        })
        .from(managedContacts)
        .where(whereClause)
        .orderBy(desc(managedContacts.createdAt))
        .limit(limit)
        .offset(offset);

      res.json({ contacts: rows, total: Number(total) || 0, limit, offset });
    } catch (error: any) {
      console.error("[Admin] Error fetching contacts:", error);
      res.status(500).json({ message: "Failed to fetch contacts", error: error.message });
    }
  });

  // Paginated integrations
  app.get("/api/admin/users/:userId/activities/integrations", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const orgIds = await getAdminUserOrgIds(userId);
      const { limit, offset } = parseAdminPagination(req.query);
      const whereClause = orgIds.length
        ? or(inArray(integrations.organizationId, orgIds), and(eq(integrations.userId, userId), isNull(integrations.organizationId)))
        : eq(integrations.userId, userId);

      const [{ total }] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(integrations)
        .where(whereClause);
      const rows = await db
        .select({
          id: integrations.id,
          name: integrations.name,
          displayName: integrations.displayName,
          category: integrations.category,
          status: integrations.status,
          authType: integrations.authType,
          lastSyncAt: integrations.lastSyncAt,
          errorMessage: integrations.errorMessage,
          organizationId: integrations.organizationId,
          createdAt: integrations.createdAt,
          updatedAt: integrations.updatedAt,
        })
        .from(integrations)
        .where(whereClause)
        .orderBy(desc(integrations.createdAt))
        .limit(limit)
        .offset(offset);

      res.json({ integrations: rows, total: Number(total) || 0, limit, offset });
    } catch (error: any) {
      console.error("[Admin] Error fetching integrations:", error);
      res.status(500).json({ message: "Failed to fetch integrations", error: error.message });
    }
  });

  // Paginated chatbots
  app.get("/api/admin/users/:userId/activities/chatbots", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const orgIds = await getAdminUserOrgIds(userId);
      const { limit, offset } = parseAdminPagination(req.query);
      const whereClause = orgIds.length
        ? or(inArray(chatbots.organizationId, orgIds), and(eq(chatbots.userId, userId), isNull(chatbots.organizationId)))
        : eq(chatbots.userId, userId);

      const [{ total }] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(chatbots)
        .where(whereClause);
      const rows = await db
        .select({
          id: chatbots.id,
          name: chatbots.name,
          status: chatbots.status,
          sessionId: chatbots.sessionId,
          organizationId: chatbots.organizationId,
          createdAt: chatbots.createdAt,
          updatedAt: chatbots.updatedAt,
        })
        .from(chatbots)
        .where(whereClause)
        .orderBy(desc(chatbots.updatedAt))
        .limit(limit)
        .offset(offset);

      res.json({ chatbots: rows, total: Number(total) || 0, limit, offset });
    } catch (error: any) {
      console.error("[Admin] Error fetching chatbots:", error);
      res.status(500).json({ message: "Failed to fetch chatbots", error: error.message });
    }
  });

  // Paginated flows
  app.get("/api/admin/users/:userId/activities/flows", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const orgIds = await getAdminUserOrgIds(userId);
      const { limit, offset } = parseAdminPagination(req.query);
      const whereClause = orgIds.length
        ? or(inArray(automationFlows.organizationId, orgIds), and(eq(automationFlows.userId, userId), isNull(automationFlows.organizationId)))
        : eq(automationFlows.userId, userId);

      const [{ total }] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(automationFlows)
        .where(whereClause);
      const rows = await db
        .select({
          id: automationFlows.id,
          name: automationFlows.name,
          status: automationFlows.status,
          organizationId: automationFlows.organizationId,
          createdAt: automationFlows.createdAt,
          updatedAt: automationFlows.updatedAt,
        })
        .from(automationFlows)
        .where(whereClause)
        .orderBy(desc(automationFlows.updatedAt))
        .limit(limit)
        .offset(offset);

      res.json({ flows: rows, total: Number(total) || 0, limit, offset });
    } catch (error: any) {
      console.error("[Admin] Error fetching flows:", error);
      res.status(500).json({ message: "Failed to fetch flows", error: error.message });
    }
  });

  // Paginated lists (groups)
  app.get("/api/admin/users/:userId/activities/lists", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const orgIds = await getAdminUserOrgIds(userId);
      const { limit, offset } = parseAdminPagination(req.query);
      if (!orgIds.length) {
        return res.json({ lists: [], total: 0, limit, offset });
      }

      const whereClause = inArray(groups.organizationId, orgIds);
      const [{ total }] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(groups)
        .where(whereClause);
      const rows = await db
        .select({
          id: groups.id,
          name: groups.name,
          description: groups.description,
          whatsappGroupId: groups.whatsappGroupId,
          organizationId: groups.organizationId,
          createdAt: groups.createdAt,
          updatedAt: groups.updatedAt,
        })
        .from(groups)
        .where(whereClause)
        .orderBy(desc(groups.createdAt))
        .limit(limit)
        .offset(offset);

      const lists = await Promise.all(
        rows.map(async (g) => {
          const members = g.organizationId
            ? await storage.getGroupMembersByOrganization(g.id, g.organizationId)
            : [];
          return { ...g, memberCount: members.length };
        })
      );

      res.json({
        lists,
        total: Number(total) || 0,
        limit,
        offset,
      });
    } catch (error: any) {
      console.error("[Admin] Error fetching lists:", error);
      res.status(500).json({ message: "Failed to fetch lists", error: error.message });
    }
  });

  // Delete a contact belonging to the user's organization(s)
  app.delete("/api/admin/users/:userId/contacts/:contactId", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const { userId, contactId } = req.params;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const orgIds = await getAdminUserOrgIds(userId);
      let contact: any = null;
      for (const orgId of orgIds) {
        contact = await storage.getManagedContactByOrganization(contactId, orgId);
        if (contact) break;
      }
      if (!contact) return res.status(404).json({ message: "Contact not found for this user" });

      await storage.deleteManagedContact(contact.id, contact.userId, contact.organizationId);
      res.json({ message: "Contact deleted", id: contactId });
    } catch (error: any) {
      console.error("[Admin] Error deleting contact:", error);
      res.status(500).json({ message: "Failed to delete contact", error: error.message });
    }
  });

  // Bulk delete contacts
  app.post("/api/admin/users/:userId/contacts/bulk-delete", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { contactIds } = req.body || {};
      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ message: "contactIds array is required" });
      }
      if (contactIds.length > 500) {
        return res.status(400).json({ message: "Cannot delete more than 500 contacts at once" });
      }

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const orgIds = await getAdminUserOrgIds(userId);
      if (!orgIds.length) {
        return res.status(404).json({ message: "No organizations found for this user" });
      }

      const uniqueIds = [...new Set(contactIds.map((id: unknown) => String(id)).filter(Boolean))];
      const found = await db
        .select({
          id: managedContacts.id,
          userId: managedContacts.userId,
          organizationId: managedContacts.organizationId,
        })
        .from(managedContacts)
        .where(and(inArray(managedContacts.id, uniqueIds), inArray(managedContacts.organizationId, orgIds)));

      const results: { contactId: string; success: boolean; error?: string }[] = [];
      const foundIds = new Set(found.map((c) => c.id));

      for (const id of uniqueIds) {
        if (!foundIds.has(id)) {
          results.push({ contactId: id, success: false, error: "Contact not found for this user" });
        }
      }

      for (const contact of found) {
        try {
          await storage.deleteManagedContact(contact.id, contact.userId, contact.organizationId!);
          results.push({ contactId: contact.id, success: true });
        } catch (err: any) {
          results.push({ contactId: contact.id, success: false, error: err?.message || "Delete failed" });
        }
      }

      res.json({
        results,
        successCount: results.filter((r) => r.success).length,
        failedCount: results.filter((r) => !r.success).length,
      });
    } catch (error: any) {
      console.error("[Admin] Error bulk deleting contacts:", error);
      res.status(500).json({ message: "Failed to bulk delete contacts", error: error.message });
    }
  });

  // Enable/disable chatbot (published <-> draft)
  app.patch("/api/admin/users/:userId/chatbots/:chatbotId", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const { userId, chatbotId } = req.params;
      const { status } = req.body || {};
      if (status !== "published" && status !== "draft") {
        return res.status(400).json({ message: "status must be 'published' or 'draft'" });
      }

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const orgIds = await getAdminUserOrgIds(userId);
      let chatbot: Awaited<ReturnType<typeof storage.getChatbotByOrganization>> = undefined;
      for (const orgId of orgIds) {
        const found = await storage.getChatbotByOrganization(chatbotId, orgId);
        if (found) {
          chatbot = found;
          break;
        }
      }
      if (!chatbot) {
        chatbot = await storage.getChatbot(chatbotId, userId);
      }
      if (!chatbot) return res.status(404).json({ message: "Chatbot not found for this user" });

      const updated = chatbot.organizationId
        ? await storage.updateChatbotByOrganization(chatbotId, chatbot.organizationId, { status })
        : await storage.updateChatbot(chatbotId, chatbot.userId, chatbot.organizationId || undefined, { status });

      if (!updated) return res.status(404).json({ message: "Failed to update chatbot" });
      res.json({
        chatbot: {
          id: updated.id,
          name: updated.name,
          status: updated.status,
          sessionId: updated.sessionId,
          organizationId: updated.organizationId,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
        },
      });
    } catch (error: any) {
      console.error("[Admin] Error updating chatbot:", error);
      res.status(500).json({ message: "Failed to update chatbot", error: error.message });
    }
  });

  // Enable/disable automation flow (active <-> inactive)
  app.patch("/api/admin/users/:userId/flows/:flowId", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const { userId, flowId } = req.params;
      const { status } = req.body || {};
      if (status !== "active" && status !== "inactive") {
        return res.status(400).json({ message: "status must be 'active' or 'inactive'" });
      }

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const flow = await storage.getAutomationFlowById(flowId);
      if (!flow) return res.status(404).json({ message: "Flow not found" });

      const ownsOrg = await assertAdminUserOwnsOrg(userId, flow.organizationId);
      const ownsUser = flow.userId === userId;
      if (!ownsOrg && !ownsUser) {
        return res.status(404).json({ message: "Flow not found for this user" });
      }

      const updated = flow.organizationId
        ? await storage.updateAutomationFlowByOrganization(flowId, flow.organizationId, { status })
        : await storage.updateAutomationFlow(flowId, flow.userId, flow.organizationId || undefined, { status });

      if (!updated) return res.status(404).json({ message: "Failed to update flow" });
      res.json({
        flow: {
          id: updated.id,
          name: updated.name,
          status: updated.status,
          organizationId: updated.organizationId,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
        },
      });
    } catch (error: any) {
      console.error("[Admin] Error updating flow:", error);
      res.status(500).json({ message: "Failed to update flow", error: error.message });
    }
  });

  // Get single user details (admin only)
  app.get("/api/admin/users/:userId", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const subscription = await storage.getActiveSubscriptionByUser(userId);
      const plan = subscription ? await storage.getPlan(subscription.planId) : null;
      const organizations = await storage.getOrganizationsByUser(userId);
      const userAddons = await storage.getAddonsByUser(userId);
      let primaryRole: string | null = null;
      if (organizations.length > 0) {
        const members = await storage.getOrganizationMembers(organizations[0].id);
        const m = members.find((x) => x.userId === userId);
        primaryRole = m?.role ?? null;
      }

      res.json({
        user,
        subscription,
        plan,
        organizations,
        primaryRole,
        addons: userAddons,
      });
    } catch (error: any) {
      console.error("[Admin] Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user", error: error.message });
    }
  });

  // Update user (admin only)
  app.put("/api/admin/users/:userId", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { isSaaSOwner, isActive, firstName, lastName, email, phone, emailVerified, accountStatus, password } = req.body;

      const updateData: any = {};
      if (isSaaSOwner !== undefined) updateData.isSaaSOwner = isSaaSOwner;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (accountStatus !== undefined) updateData.accountStatus = accountStatus;
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (email !== undefined) updateData.email = email;
      if (phone !== undefined) updateData.phone = phone;
      if (emailVerified !== undefined) updateData.emailVerified = emailVerified;
      if (password !== undefined && password !== "") {
        const bcrypt = await import("bcryptjs");
        updateData.passwordHash = await bcrypt.hash(password, 10);
      }

      const updatedUser = await storage.updateUser(userId, updateData);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // When a SaaS owner is set, ensure Free exists for other signups — but never keep Free on the owner
      if (isSaaSOwner === true) {
        try {
          await ensureSystemFreePlan();
        } catch (planErr) {
          console.error("[Admin] Failed to ensure system Free plan after SaaS owner set:", planErr);
        }
        try {
          await clearSystemFreeSubscriptionForSaasOwner(userId);
        } catch (clearErr) {
          console.error("[Admin] Failed to clear Free plan for new SaaS owner:", clearErr);
        }
      }

      res.json({ user: updatedUser });
    } catch (error: any) {
      console.error("[Admin] Error updating user:", error);
      res.status(500).json({ message: "Failed to update user", error: error.message });
    }
  });

  // Activate/Deactivate user
  app.post("/api/admin/users/:userId/activate", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const updatedUser = await storage.updateUser(userId, { isActive: true });
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ user: updatedUser });
    } catch (error: any) {
      console.error("[Admin] Error activating user:", error);
      res.status(500).json({ message: "Failed to activate user", error: error.message });
    }
  });

  app.post("/api/admin/users/:userId/deactivate", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const updatedUser = await storage.updateUser(userId, { isActive: false });
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ user: updatedUser });
    } catch (error: any) {
      console.error("[Admin] Error deactivating user:", error);
      res.status(500).json({ message: "Failed to deactivate user", error: error.message });
    }
  });

  // Assign plan to user (admin only)
  app.post("/api/admin/users/:userId/assign-plan", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { planId, billingCycle, startDate, endDate } = req.body;

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const plan = await storage.getPlan(planId);
      if (!plan) return res.status(404).json({ message: "Plan not found" });
      if (!plan.isActive) return res.status(400).json({ message: "Cannot assign an inactive plan. Activate the plan first in Plans settings." });
      if (user.isSaaSOwner && isSystemFreePlan(plan)) {
        return res.status(400).json({
          message: "Cannot assign the Free plan to a SaaS platform owner (is_saas_owner).",
        });
      }

      const cycle: "monthly" | "quarterly" | "yearly" =
        billingCycle === "monthly" || billingCycle === "quarterly" || billingCycle === "yearly"
          ? billingCycle
          : (plan.defaultBillingCycle as "monthly" | "quarterly" | "yearly" | null) || "monthly";
      const start = startDate ? new Date(startDate) : new Date();
      let end: Date;
      if (endDate) {
        end = new Date(endDate);
      } else {
        const months = cycle === "yearly" ? 12 : cycle === "quarterly" ? 3 : 1;
        end = new Date(start);
        end.setMonth(end.getMonth() + months);
      }

      const existing = await storage.getSubscriptionByUser(userId);
      let subscription;
      if (existing) {
        subscription = await storage.updateSubscription(existing.id, {
          planId,
          billingCycle: cycle,
          currentPeriodStart: start,
          currentPeriodEnd: end,
          status: "active",
          paymentGateway: "manual",
        });
      } else {
        subscription = await storage.createSubscription({
          userId,
          planId,
          billingCycle: cycle,
          currentPeriodStart: start,
          currentPeriodEnd: end,
          status: "active",
          paymentGateway: "manual",
        });
      }
      if (!subscription) return res.status(500).json({ message: "Failed to save subscription" });

      // Ensure only this subscription is active: cancel any other subscriptions for this user
      try {
        await storage.cancelOtherSubscriptionsForUser(userId, subscription.id);
      } catch (cancelErr: any) {
        console.error("[Admin] Could not cancel other subscriptions:", cancelErr?.message || cancelErr);
      }

      // Record subscription history (required for audit; table must exist – run migrations/create_subscription_history_table.sql if missing)
      try {
        await storage.addSubscriptionHistory({
          userId,
          planId,
          subscriptionId: subscription.id,
          action: existing ? "upgraded" : "assigned",
          periodStart: start,
          periodEnd: end,
          billingCycle: cycle as "monthly" | "quarterly" | "yearly",
        });
      } catch (histErr: any) {
        console.error("[Admin] Failed to add subscription history – run migration create_subscription_history_table.sql if table is missing:", histErr?.message || histErr);
        console.error("[Admin] Subscription history error stack:", histErr?.stack);
      }

      // Create manual payment record for admin-assigned plan
      const amount = cycle === "yearly" ? plan.priceYearly : cycle === "quarterly" ? plan.priceQuarterly : plan.priceMonthly;
      try {
        await storage.createPayment({
          subscriptionId: subscription.id,
          userId,
          amount,
          currency: "INR",
          status: "completed",
          paymentGateway: "manual",
          completedAt: new Date(),
        });
      } catch (payErr) {
        console.warn("[Admin] Could not create manual payment record:", payErr);
      }

      let onboardingAccrual: Awaited<ReturnType<typeof accrueInitialWhitelabelOnboardingFee>> | null = null;
      try {
        onboardingAccrual = await accrueInitialWhitelabelOnboardingFee(userId, "assigned");
      } catch (accrualErr) {
        console.error("[Admin] Onboarding fee accrual on assign-plan:", accrualErr);
      }

      // Catch up any past-due monthly rows (e.g. trial ended before admin assigned plan).
      try {
        const master = await storage.getPlatformMasterSettings();
        const contract = readWhitelabelOnboardingContractFromUpstreamPayload(master?.upstreamPayload ?? null);
        if (contract) {
          const fresh = await storage.getUser(userId);
          if (fresh) {
            const { runWhitelabelOnboardingForUser } = await import("../onboarding-monthly-scheduler");
            await runWhitelabelOnboardingForUser(fresh, contract, new Date());
          }
        }
      } catch (catchUpErr) {
        console.error("[Admin] Onboarding fee catch-up on assign-plan:", catchUpErr);
      }

      res.json({
        subscription,
        onboardingAccrual,
        onboardingFee:
          onboardingAccrual?.status === "accrued"
            ? {
                id: onboardingAccrual.fee.id,
                amountMinor: onboardingAccrual.fee.amountMinor,
                currency: onboardingAccrual.fee.currency,
                trigger: onboardingAccrual.fee.trigger,
                status: onboardingAccrual.fee.status,
              }
            : null,
      });
    } catch (error: any) {
      console.error("[Admin] Error assigning plan:", error);
      res.status(500).json({ message: "Failed to assign plan", error: error.message });
    }
  });

  // Get user add-ons
  app.get("/api/admin/users/:userId/addons", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const userAddons = await storage.getAddonsByUser(userId);
      res.json({ addons: userAddons });
    } catch (error: any) {
      console.error("[Admin] Error fetching user add-ons:", error);
      res.status(500).json({ message: "Failed to fetch add-ons", error: error.message });
    }
  });

  // Assign add-on to user
  app.post("/api/admin/users/:userId/addons", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { addonId } = req.body;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const assigned = await storage.assignAddonToUser(userId, addonId);
      res.status(201).json({ addon: assigned });
    } catch (error: any) {
      console.error("[Admin] Error assigning add-on:", error);
      res.status(500).json({ message: "Failed to assign add-on", error: error.message });
    }
  });

  // Remove add-on from user
  app.delete("/api/admin/users/:userId/addons/:addonId", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const { userId, addonId } = req.params;
      await storage.removeAddonFromUser(userId, addonId);
      res.json({ message: "Add-on removed" });
    } catch (error: any) {
      console.error("[Admin] Error removing add-on:", error);
      res.status(500).json({ message: "Failed to remove add-on", error: error.message });
    }
  });

  // ========== ADD-ONS CATALOG ==========

  app.get("/api/admin/addons", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const addonsList = await storage.getAllAddonsAdmin();
      res.json({ addons: addonsList });
    } catch (error: any) {
      console.error("[Admin] Error fetching add-ons:", error);
      res.status(500).json({ message: "Failed to fetch add-ons", error: error.message });
    }
  });

  app.post("/api/admin/addons", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const {
        name,
        displayName,
        description,
        type,
        price,
        currency,
        billingCycle,
        billingType,
        featureWebhookEvents,
        featureChatbot,
        featureFlows,
        featureDripCampaigns,
      } = req.body;
      const [addon] = await db
        .insert(addons)
        .values({
          name: name || displayName || "Add-on",
          displayName: displayName || name,
          description: description ?? null,
          type: type ?? "custom",
          price: price ?? 0,
          currency: currency ?? "INR",
          billingCycle: billingCycle ?? "monthly",
          billingType: billingType ?? "recurring",
          featureWebhookEvents: featureWebhookEvents === true,
          featureChatbot: featureChatbot === true,
          featureFlows: featureFlows === true,
          featureDripCampaigns: featureDripCampaigns === true,
        })
        .returning();
      res.status(201).json({ addon });
    } catch (error: any) {
      console.error("[Admin] Error creating add-on:", error);
      res.status(500).json({ message: "Failed to create add-on", error: error.message });
    }
  });

  app.put("/api/admin/addons/:addonId", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const { addonId } = req.params;
      const {
        name,
        displayName,
        description,
        type,
        price,
        currency,
        billingCycle,
        billingType,
        isActive,
        featureWebhookEvents,
        featureChatbot,
        featureFlows,
        featureDripCampaigns,
      } = req.body;
      const updates: Record<string, any> = { updatedAt: new Date() };
      if (name !== undefined) updates.name = name;
      if (displayName !== undefined) updates.displayName = displayName;
      if (description !== undefined) updates.description = description;
      if (type !== undefined) updates.type = type;
      if (price !== undefined) updates.price = price;
      if (currency !== undefined) updates.currency = currency;
      if (billingCycle !== undefined) updates.billingCycle = billingCycle;
      if (billingType !== undefined) updates.billingType = billingType;
      if (isActive !== undefined) updates.isActive = isActive;
      if (featureWebhookEvents !== undefined) updates.featureWebhookEvents = !!featureWebhookEvents;
      if (featureChatbot !== undefined) updates.featureChatbot = !!featureChatbot;
      if (featureFlows !== undefined) updates.featureFlows = !!featureFlows;
      if (featureDripCampaigns !== undefined) updates.featureDripCampaigns = !!featureDripCampaigns;
      const [addon] = await db.update(addons).set(updates).where(eq(addons.id, addonId)).returning();
      if (!addon) return res.status(404).json({ message: "Add-on not found" });
      res.json({ addon });
    } catch (error: any) {
      console.error("[Admin] Error updating add-on:", error);
      res.status(500).json({ message: "Failed to update add-on", error: error.message });
    }
  });

  app.delete("/api/admin/addons/:addonId", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const { addonId } = req.params;
      await db.delete(addons).where(eq(addons.id, addonId));
      res.json({ message: "Add-on deleted" });
    } catch (error: any) {
      console.error("[Admin] Error deleting add-on:", error);
      res.status(500).json({ message: "Failed to delete add-on", error: error.message });
    }
  });

  // ========== COUPONS MANAGEMENT ==========

  app.get("/api/admin/coupons", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const couponsList = await storage.getAllCoupons();
      res.json({ coupons: couponsList });
    } catch (error: any) {
      console.error("[Admin] Error fetching coupons:", error);
      res.status(500).json({ message: "Failed to fetch coupons", error: error.message });
    }
  });

  app.post("/api/admin/coupons", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const { code, name, description, discountType, discountValue, maxUses, expiryDate } = req.body;
      if (!code || !name) {
        return res.status(400).json({ message: "Code and name are required" });
      }
      const existing = await storage.getCouponByCode(code);
      if (existing) {
        return res.status(400).json({ message: "Coupon code already exists" });
      }
      const coupon = await storage.createCoupon({
        code: code.trim().toUpperCase(),
        name,
        description: description ?? null,
        discountType: discountType ?? "percent",
        discountValue: discountValue ?? 0,
        maxUses: maxUses ?? 1,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
      });
      res.status(201).json({ coupon });
    } catch (error: any) {
      console.error("[Admin] Error creating coupon:", error);
      res.status(500).json({ message: "Failed to create coupon", error: error.message });
    }
  });

  app.put("/api/admin/coupons/:couponId", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const { couponId } = req.params;
      const { code, name, description, discountType, discountValue, maxUses, expiryDate, isActive } = req.body;
      const coupon = await storage.getCoupon(couponId);
      if (!coupon) return res.status(404).json({ message: "Coupon not found" });
      if (code && code !== coupon.code) {
        const existing = await storage.getCouponByCode(code);
        if (existing) return res.status(400).json({ message: "Coupon code already exists" });
      }
      const updates: Record<string, any> = {};
      if (code !== undefined) updates.code = code;
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (discountType !== undefined) updates.discountType = discountType;
      if (discountValue !== undefined) updates.discountValue = discountValue;
      if (maxUses !== undefined) updates.maxUses = maxUses;
      if (expiryDate !== undefined) updates.expiryDate = expiryDate ? new Date(expiryDate) : null;
      if (isActive !== undefined) updates.isActive = isActive;
      const updated = await storage.updateCoupon(couponId, updates);
      res.json({ coupon: updated });
    } catch (error: any) {
      console.error("[Admin] Error updating coupon:", error);
      res.status(500).json({ message: "Failed to update coupon", error: error.message });
    }
  });

  app.delete("/api/admin/coupons/:couponId", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const { couponId } = req.params;
      await storage.deleteCoupon(couponId);
      res.json({ message: "Coupon deleted" });
    } catch (error: any) {
      console.error("[Admin] Error deleting coupon:", error);
      res.status(500).json({ message: "Failed to delete coupon", error: error.message });
    }
  });

  // ========== ORGANIZATIONS MANAGEMENT ==========

  // Get all organizations (admin only)
  app.get("/api/admin/organizations", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const organizations = await storage.getAllOrganizations();
      
      // Get owner info and member count for each organization
      const orgsWithDetails = await Promise.all(
        organizations.map(async (org) => {
          const owner = await storage.getUser(org.ownerId);
          const members = await storage.getOrganizationMembers(org.id);
          const theme = await storage.getOrganizationTheme(org.id);
          return {
            ...org,
            owner,
            memberCount: members.length,
            hasTheme: !!theme,
          };
        })
      );

      res.json({ organizations: orgsWithDetails });
    } catch (error: any) {
      console.error("[Admin] Error fetching organizations:", error);
      res.status(500).json({ message: "Failed to fetch organizations", error: error.message });
    }
  });

  // ========== SUBSCRIPTION PLANS MANAGEMENT ==========

  // Get all plans (admin only) — ensure locked Free/default plan exists in this DB
  app.get("/api/admin/plans", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      try {
        await ensureSystemFreePlan();
      } catch (planErr) {
        console.error("[Admin] Failed to ensure system Free plan before listing:", planErr);
      }
      const plans = await storage.getAllPlans();
      res.json({ plans });
    } catch (error: any) {
      console.error("[Admin] Error fetching plans:", error);
      res.status(500).json({ message: "Failed to fetch plans", error: error.message });
    }
  });

  /** Explicit seed for DBs that only ran schema push — creates Free System/Default if missing. */
  app.post("/api/admin/plans/ensure-system-free", isAuthenticated, isSaaSOwner, async (_req: any, res) => {
    try {
      const plan = await ensureSystemFreePlan();
      const plans = await storage.getAllPlans();
      res.json({
        message: "System Free plan is ready (System / Default, Auto on signup 3d)",
        plan,
        plans,
      });
    } catch (error: any) {
      console.error("[Admin] ensure-system-free:", error);
      res.status(500).json({
        message: "Failed to ensure system Free plan",
        error: error?.message,
        hint: "On the server with DATABASE_URL for this DB, run: npm run db:migrate-system-free-plan",
      });
    }
  });

  // Create plan (admin only)
  app.post("/api/admin/plans", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const body = { ...req.body };
      delete body.isSystemDefault; // never creatable via API
      // System Free owns auto-assign; other plans cannot steal it
      const allPlans = await storage.getAllPlans();
      if (allPlans.some((p) => isSystemFreePlan(p as any))) {
        body.autoAssignOnSignup = false;
      }

      const result = insertPlanSchema.safeParse(body);
      if (!result.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: fromError(result.error).toString(),
        });
      }

      const plan = await storage.createPlan(result.data);
      res.status(201).json({ plan });
    } catch (error: any) {
      console.error("[Admin] Error creating plan:", error);
      res.status(500).json({ message: "Failed to create plan", error: error.message });
    }
  });

  // Update plan (admin only)
  app.put("/api/admin/plans/:planId", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const { planId } = req.params;
      const plan = await storage.getPlan(planId);
      if (!plan) {
        return res.status(404).json({ message: "Plan not found" });
      }

      if (isSystemFreePlan(plan as any)) {
        return res.status(403).json({
          message: "The system Free plan cannot be edited. It is the locked default for new signups.",
        });
      }

      const body = { ...req.body };
      delete body.isSystemDefault;
      const allPlans = await storage.getAllPlans();
      if (allPlans.some((p) => isSystemFreePlan(p as any) && p.id !== planId)) {
        body.autoAssignOnSignup = false;
      }

      // Merge existing plan with updates
      const updatedData = { ...plan, ...body };
      delete (updatedData as any).isSystemDefault;
      const result = insertPlanSchema.safeParse(updatedData);
      if (!result.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: fromError(result.error).toString(),
        });
      }

      // Update plan
      const updatedPlan = await storage.updatePlan(planId, result.data);
      if (!updatedPlan) {
        return res.status(404).json({ message: "Plan not found" });
      }
      res.json({ plan: updatedPlan });
    } catch (error: any) {
      console.error("[Admin] Error updating plan:", error);
      res.status(500).json({ message: "Failed to update plan", error: error.message });
    }
  });

  // Delete plan (admin only)
  app.delete("/api/admin/plans/:planId", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const { planId } = req.params;
      const plan = await storage.getPlan(planId);
      if (!plan) {
        return res.status(404).json({ message: "Plan not found" });
      }

      if (isSystemFreePlan(plan as any)) {
        return res.status(403).json({
          message: "The system Free plan cannot be deleted. It is the locked default for new signups.",
        });
      }

      await storage.deletePlan(planId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Admin] Error deleting plan:", error);
      res.status(500).json({ message: "Failed to delete plan", error: error.message });
    }
  });

  // ========== THEME CUSTOMIZATION ==========

  // Get organization theme (admin only)
  app.get("/api/admin/organizations/:organizationId/theme", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const { organizationId } = req.params;
      const theme = await storage.getOrganizationTheme(organizationId);
      res.json({ theme });
    } catch (error: any) {
      console.error("[Admin] Error fetching theme:", error);
      res.status(500).json({ message: "Failed to fetch theme", error: error.message });
    }
  });

  // Create or update organization theme (admin only) — colors only; panel template is domain-wide
  app.post("/api/admin/organizations/:organizationId/theme", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const { organizationId } = req.params;
      const body = { ...req.body, organizationId };
      delete body.panelTemplateId;

      const result = insertOrganizationThemeSchema.safeParse(body);
      
      if (!result.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: fromError(result.error).toString(),
        });
      }

      const theme = await storage.createOrUpdateOrganizationTheme(result.data);
      res.json({ theme });
    } catch (error: any) {
      console.error("[Admin] Error saving theme:", error);
      res.status(500).json({ message: "Failed to save theme", error: error.message });
    }
  });

  // Delete organization theme (admin only)
  app.delete("/api/admin/organizations/:organizationId/theme", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const { organizationId } = req.params;
      await storage.deleteOrganizationTheme(organizationId);
      res.json({ message: "Theme deleted successfully" });
    } catch (error: any) {
      console.error("[Admin] Error deleting theme:", error);
      res.status(500).json({ message: "Failed to delete theme", error: error.message });
    }
  });

  // ========== PANEL TEMPLATES (domain-wide, one active for all organizations) ==========

  app.get("/api/admin/panel-templates", isAuthenticated, isSaaSOwner, async (_req: any, res) => {
    try {
      const { PANEL_TEMPLATE_CATALOG } = await import("@shared/panel-templates");
      const activePanelTemplateId = await storage.getActivePanelTemplateId();
      res.json({
        templates: PANEL_TEMPLATE_CATALOG.filter((t) => t.enabled),
        activePanelTemplateId,
      });
    } catch (error: any) {
      console.error("[Admin] Error fetching panel templates:", error);
      res.status(500).json({ message: "Failed to fetch panel templates", error: error.message });
    }
  });

  app.put("/api/admin/panel-templates/active", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const { panelTemplateId } = req.body ?? {};
      const { resolvePanelTemplateId } = await import("@shared/panel-templates");
      const resolved = resolvePanelTemplateId(panelTemplateId);
      const row = await storage.setActivePanelTemplateId(resolved);
      res.json({
        activePanelTemplateId: row.activePanelTemplateId,
        message: "Panel template updated for all organizations on this domain",
      });
    } catch (error: any) {
      console.error("[Admin] Error setting active panel template:", error);
      res.status(500).json({ message: "Failed to set panel template", error: error.message });
    }
  });

  // ========== STATISTICS ==========

  // Get admin dashboard statistics
  app.get("/api/admin/stats", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      const organizations = await storage.getAllOrganizations();
      const plans = await storage.getAllPlans();
      
      const activeUsers = users.filter(u => u.isActive).length;
      const inactiveUsers = users.filter(u => !u.isActive).length;
      const saasOwners = users.filter(u => u.isSaaSOwner).length;

      // Get subscription counts
      const subscriptions = await Promise.all(
        users.map(u => storage.getSubscriptionByUser(u.id))
      );
      const activeSubscriptions = subscriptions.filter(s => s && s.status === 'active').length;

      const connectedNumbers = await storage.countConnectedSessions();
      const onboardedUsers = users.filter(u => !u.isSaaSOwner).length;
      const totalResellers = organizations.length;

      res.json({
        totalUsers: users.length,
        onboardedUsers,
        activeUsers,
        inactiveUsers,
        saasOwners,
        totalResellers,
        totalOrganizations: organizations.length,
        totalPlans: plans.length,
        activeSubscriptions,
        connectedNumbers,
      });
    } catch (error: any) {
      console.error("[Admin] Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch statistics", error: error.message });
    }
  });

  // ========== RATE LIMITING ==========

  // Reset rate limit for a specific user (admin only)
  app.post("/api/admin/rate-limit/reset/:userId", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const { userId } = req.params;
      rateLimiter.reset(userId);
      console.log(`[Admin] Rate limit reset for user ${userId} by admin ${getUserId(req)}`);
      res.json({ success: true, message: `Rate limit reset for user ${userId}` });
    } catch (error: any) {
      console.error("[Admin] Error resetting rate limit:", error);
      res.status(500).json({ message: "Failed to reset rate limit", error: error.message });
    }
  });

  // Reset rate limit for all users (admin only)
  app.post("/api/admin/rate-limit/reset-all", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      (rateLimiter as any).limits.clear();
      console.log(`[Admin] All rate limits reset by admin ${getUserId(req)}`);
      res.json({ success: true, message: "All rate limits reset" });
    } catch (error: any) {
      console.error("[Admin] Error resetting all rate limits:", error);
      res.status(500).json({ message: "Failed to reset all rate limits", error: error.message });
    }
  });

  // ========== PLATFORM MASTER SETTINGS (whitelabel / upstream sync; read-only contract) ==========

  app.get("/api/admin/platform-master-settings", isAuthenticated, isSaaSOwner, async (_req: any, res) => {
    try {
      const row = await storage.getPlatformMasterSettings();
      const productionKey = process.env.PRODUCTION_KEY?.trim() || null;
      res.json({
        row: toPublicPlatformMasterRow(row),
        config: {
          customerApiConfigured: !!(process.env.CUSTOMER_API_BASE_URL?.trim() && productionKey),
          /** Whitelabel contract JSON always comes from this path on the customer portal (not editable here). */
          syncSourcePath: "/api/customer",
          /** Same key this instance uses for portal API calls; not stored in DB (payload redacts portal copy). */
          productionKey,
        },
      });
    } catch (error: any) {
      console.error("[Admin] platform-master-settings GET:", error);
      res.status(500).json({ message: "Failed to load platform settings", error: error.message });
    }
  });

  app.post("/api/admin/platform-master-settings/sync", isAuthenticated, isSaaSOwner, async (_req: any, res) => {
    try {
      const { runPlatformMasterSync } = await import("../platform-master-sync");
      await runPlatformMasterSync();
      const row = await storage.getPlatformMasterSettings();
      res.json({ ok: true, row: toPublicPlatformMasterRow(row) });
    } catch (error: any) {
      console.error("[Admin] platform-master-settings sync:", error);
      res.status(500).json({ message: "Sync failed", error: error.message });
    }
  });

  /**
   * Licensor portal state (is_active, etc.): 200 JSON, not 403 — registered before customer-status `app.use`
   * so SaaS owners can read suspension while the rest of the panel is blocked.
   */
  app.get("/api/panel/licensor-account-state", isAuthenticated, isSaaSOwner, async (_req: any, res) => {
    try {
      const result = await checkCustomerStatusCached();
      if (result.allowed) {
        return res.json({ allowed: true as const });
      }
      return res.json({
        allowed: false as const,
        code: result.code,
        error: result.error,
        ...(result.expired_at ? { expired_at: result.expired_at } : {}),
      });
    } catch (error: any) {
      console.error("[Panel] licensor-account-state:", error);
      res.status(500).json({ message: "Failed to read licensor account state", error: error.message });
    }
  });

  /**
   * After paying onboarding fees, owner asks the licensor to turn the installation back on.
   * Email recipient: LICENSOR_ACTIVATION_EMAIL or SUPPORT_EMAIL (optional); always logged when missing.
   */
  app.post("/api/panel/request-account-activation", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const uid = getUserId(req);
      const user = await storage.getUser(uid);
      const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 2000) : "";
      const baseUrl =
        process.env.BASE_URL?.trim() ||
        process.env.PUBLIC_APP_URL?.trim() ||
        process.env.VITE_BASE_URL?.trim() ||
        "(set BASE_URL or PUBLIC_APP_URL)";
      const to =
        process.env.LICENSOR_ACTIVATION_EMAIL?.trim() || process.env.SUPPORT_EMAIL?.trim() || "";
      const subject = `[Whitelabel panel] Reactivation request — ${user?.email || uid}`;
      const text = [
        "The SaaS owner submitted a reactivation request (typically after paying onboarding fees).",
        "",
        `Owner user id: ${uid}`,
        `Owner email: ${user?.email || "—"}`,
        `Panel URL hint: ${baseUrl}`,
        "",
        note ? `Note from owner:\n${note}` : "(no note)",
        "",
        "Please re-enable this customer in your licensor portal (e.g. set is_active) when billing is satisfied.",
      ].join("\n");

      if (to) {
        const emailedOk = await sendEmail({ to, subject, text, userId: uid });
        return res.json({
          ok: true,
          emailed: emailedOk,
          message: emailedOk
            ? "Your licensor was notified by email."
            : "SMTP is misconfigured; your request was logged on the server. Contact your licensor directly.",
        });
      }

      console.log("[Panel] request-account-activation (set LICENSOR_ACTIVATION_EMAIL to email the licensor):\n", text);
      res.json({
        ok: true,
        emailed: false,
        message:
          "Request logged. Add LICENSOR_ACTIVATION_EMAIL (or SUPPORT_EMAIL) on the server to email your licensor automatically, or contact them directly to reactivate your account.",
      });
    } catch (error: any) {
      console.error("[Panel] request-account-activation:", error);
      res.status(500).json({ message: "Failed to submit request", error: error.message });
    }
  });

  // Customer onboarding monthly fees (licensor contract from synced /api/customer): SaaS owner pays via Razorpay or Cashfree per payment_gateway.
  // Batch payment history for onboarding fees (separate from subscription orders / payments table).
  app.get("/api/admin/onboarding-fee-settlements", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 100, 300);
      const offset = parseInt(req.query.offset as string, 10) || 0;
      const { settlements, total } = await storage.getWhitelabelOnboardingSettlementsForAdmin({ limit, offset });
      res.json({ settlements, total });
    } catch (error: any) {
      console.error("[Admin] onboarding-fee-settlements GET:", error);
      res.status(500).json({ message: "Failed to list onboarding fee settlements", error: error.message });
    }
  });

  app.get("/api/admin/onboarding-billing-alert", isAuthenticated, isSaaSOwner, async (_req: any, res) => {
    try {
      const master = await storage.getPlatformMasterSettings();
      const live = await fetchCustomerFromApi();
      const merged = mergeLiveContractForOutstandingLimit(master?.upstreamPayload ?? null, live);
      const limitMinor = parseOutstandingLimitMinorFromUpstreamPayload(merged);
      const outstandingMinor = await storage.getTotalOutstandingWhitelabelOnboardingMinor();
      const billingCurrency =
        merged &&
        typeof merged === "object" &&
        !Array.isArray(merged) &&
        typeof (merged as Record<string, unknown>).billing_currency === "string"
          ? String((merged as Record<string, unknown>).billing_currency)
          : null;
      const overLimit = limitMinor != null && outstandingMinor >= limitMinor;
      res.json({
        limitMinor,
        outstandingMinor,
        overLimit,
        billingCurrency,
      });
    } catch (error: any) {
      console.error("[Admin] onboarding-billing-alert GET:", error);
      res.status(500).json({ message: "Failed to load onboarding billing alert", error: error.message });
    }
  });

  app.get("/api/admin/onboarding-fees/recalculate-status", isAuthenticated, isSaaSOwner, async (_req: any, res) => {
    try {
      res.json({ available: true, usedAt: null });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to load recalculate status" });
    }
  });

  app.post("/api/admin/onboarding-fees/recalculate", isAuthenticated, isSaaSOwner, async (_req: any, res) => {
    try {
      const { recalculateWhitelabelOnboardingFees } = await import("../whitelabel-onboarding-recalculate");
      const result = await recalculateWhitelabelOnboardingFees();
      res.json({ ok: true, ...result });
    } catch (error: any) {
      const status = error?.statusCode === 400 ? 400 : 500;
      res.status(status).json({
        message: error?.message || "Recalculate failed",
        ...(error?.debug ? { debug: error.debug } : {}),
      });
    }
  });

  app.get("/api/admin/onboarding-fees", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 200, 500);
      const offset = parseInt(req.query.offset as string, 10) || 0;
      const { fees, total } = await storage.getWhitelabelOnboardingFeesForAdmin({ status, limit, offset });
      const master = await storage.getPlatformMasterSettings();
      const up = master?.upstreamPayload;
      let batchPaymentGateway: "razorpay" | "cashfree" | null = null;
      if (up && typeof up === "object" && !Array.isArray(up)) {
        const v = (up as Record<string, unknown>).payment_gateway;
        batchPaymentGateway = normalizeWhitelabelPaymentGateway(typeof v === "string" ? v : "");
      }
      res.json({ fees, total, batchPaymentGateway });
    } catch (error: any) {
      console.error("[Admin] onboarding-fees GET:", error);
      res.status(500).json({ message: "Failed to list onboarding fees", error: error.message });
    }
  });

  app.post("/api/admin/onboarding-fees/create-order", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const bodySchema = z.object({ ids: z.array(z.string()).min(1) });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: fromError(parsed.error).toString() });
      }
      const rows = await storage.getWhitelabelOnboardingFeesByIds(parsed.data.ids);
      if (rows.length !== parsed.data.ids.length) {
        return res.status(400).json({ message: "One or more fee rows were not found" });
      }
      const now = Date.now();
      for (const r of rows) {
        if (r.amountMinor <= 0) {
          return res.status(400).json({ message: "Cannot pay waived or zero-amount rows" });
        }
        if (r.status !== "pending" && r.status !== "failed") {
          return res.status(400).json({ message: `Row ${r.id.slice(0, 8)} is not payable (status: ${r.status})` });
        }
        if (new Date(r.dueAt).getTime() > now) {
          return res.status(400).json({ message: `Row ${r.id.slice(0, 8)} is not due yet` });
        }
      }
      const totalMinor = rows.reduce((s, r) => s + r.amountMinor, 0);
      const master = await storage.getPlatformMasterSettings();
      const { fetchCustomerFromApi } = await import("../updates");
      const customer = await fetchCustomerFromApi();
      if (!customer) {
        return res.status(503).json({
          message: "Could not load licensor /api/customer (check CUSTOMER_API_BASE_URL and PRODUCTION_KEY)",
        });
      }
      const {
        resolveWhitelabelBatchPaymentGateway,
        getRazorpayKeysFromCustomerApi,
        getCashfreeKeysFromCustomerApi,
        gatewayEntityToJsonRecord,
      } = await import("../whitelabel-onboarding-fee");
      const gw = resolveWhitelabelBatchPaymentGateway({
        upstreamPayload: master?.upstreamPayload ?? null,
        customer,
      });
      if (!gw) {
        return res.status(400).json({
          message:
            "payment_gateway is missing or unsupported for onboarding batch pay. Set payment_gateway to razorpay or cashfree on the licensor portal and sync Platform settings.",
        });
      }
      const currency = (rows[0]?.currency || "INR").toUpperCase();

      if (gw === "razorpay") {
        const keys = getRazorpayKeysFromCustomerApi(customer);
        if (!keys) {
          return res.status(503).json({
            message: "Razorpay key_id / key_secret missing on licensor /api/customer response",
          });
        }
        const { RazorpayClient } = await import("../payment/razorpay-client");
        const rz = new RazorpayClient(keys);
        const order = await rz.createOrder({
          amount: totalMinor,
          currency,
          receipt: `wlob_${Date.now()}`,
          notes: { feeIds: parsed.data.ids.join(",") },
        });
        await storage.setWhitelabelOnboardingFeeGatewayOrder(parsed.data.ids, order.id);
        return res.json({
          gateway: "razorpay",
          orderId: order.id,
          amountMinor: totalMinor,
          currency,
          keyId: keys.keyId,
          feeIds: parsed.data.ids,
        });
      }

      const cfKeys = getCashfreeKeysFromCustomerApi(customer);
      if (!cfKeys) {
        return res.status(503).json({
          message: "Cashfree app_id / secret_key missing on licensor /api/customer response",
        });
      }
      const { createCashfreePaymentLink } = await import("../payments/contact-gateway");
      const linkId = `wlob_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
      const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
      const host = req.get("host") || "localhost";
      const notifyUrl = `${proto}://${host}/api/webhooks/payments/cashfree`;
      const payer = await storage.getUser(getUserId(req));
      const phoneDigits =
        (payer?.phone && String(payer.phone).replace(/\D/g, "").slice(-12)) || "999999999999";
      const created = await createCashfreePaymentLink({
        clientId: cfKeys.clientId,
        clientSecret: cfKeys.clientSecret,
        linkId,
        amountRupees: totalMinor / 100,
        currency,
        customerPhoneDigits: phoneDigits,
        purpose: "Customer onboarding monthly fee (licensor contract)",
        notifyUrl,
        useSandbox: cfKeys.useSandbox,
      });
      const settlement = await storage.insertWhitelabelOnboardingSettlement({
        gateway: "cashfree",
        gatewayOrderId: created.link_id,
        gatewayPaymentId: null,
        amountMinor: totalMinor,
        currency,
        feeIds: parsed.data.ids,
        status: "pending",
        rawGatewayResponse: {
          stage: "checkout_started",
          payment_link_url: created.link_url,
          link_id: created.link_id,
        },
      });
      await storage.setWhitelabelOnboardingFeeGatewayOrder(parsed.data.ids, created.link_id);
      return res.json({
        gateway: "cashfree",
        settlementId: settlement.id,
        paymentLinkUrl: created.link_url,
        linkId: created.link_id,
        amountMinor: totalMinor,
        currency,
        feeIds: parsed.data.ids,
      });
    } catch (error: any) {
      console.error("[Admin] onboarding-fees create-order:", error);
      res.status(500).json({ message: error?.message || "Failed to create order" });
    }
  });

  app.post("/api/admin/onboarding-fees/verify", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const bodySchema = z.object({
        razorpay_order_id: z.string(),
        razorpay_payment_id: z.string(),
        razorpay_signature: z.string(),
      });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: fromError(parsed.error).toString() });
      }
      const { fetchCustomerFromApi } = await import("../updates");
      const customer = await fetchCustomerFromApi();
      if (!customer) return res.status(503).json({ message: "Could not load licensor /api/customer" });
      const { getRazorpayKeysFromCustomerApi } = await import("../whitelabel-onboarding-fee");
      const keys = getRazorpayKeysFromCustomerApi(customer);
      if (!keys) return res.status(503).json({ message: "Razorpay keys missing on licensor contract" });
      const { RazorpayClient } = await import("../payment/razorpay-client");
      const rz = new RazorpayClient(keys);
      const ok = rz.verifyPaymentSignature({
        razorpay_order_id: parsed.data.razorpay_order_id,
        razorpay_payment_id: parsed.data.razorpay_payment_id,
        razorpay_signature: parsed.data.razorpay_signature,
      });
      if (!ok) return res.status(400).json({ message: "Invalid payment signature" });
      const feeRows = await storage.getWhitelabelOnboardingFeesByGatewayOrderId(parsed.data.razorpay_order_id);
      if (!feeRows.length) return res.status(404).json({ message: "No onboarding fee rows for this order" });
      const ids = feeRows.map((f) => f.id);
      const { gatewayEntityToJsonRecord } = await import("../whitelabel-onboarding-fee");
      let paymentJson: Record<string, unknown> | null = null;
      let orderJson: Record<string, unknown> | null = null;
      try {
        const paymentEntity = await rz.getPayment(parsed.data.razorpay_payment_id);
        paymentJson = gatewayEntityToJsonRecord(paymentEntity);
      } catch (e: unknown) {
        console.warn("[Admin] onboarding-fees verify: could not fetch Razorpay payment", e);
      }
      try {
        const orderEntity = await rz.getOrder(parsed.data.razorpay_order_id);
        orderJson = gatewayEntityToJsonRecord(orderEntity);
      } catch (e: unknown) {
        console.warn("[Admin] onboarding-fees verify: could not fetch Razorpay order", e);
      }
      const paidPayload: Record<string, unknown> = {
        stage: "paid",
        source: "razorpay_checkout_verify",
        checkout: {
          razorpay_order_id: parsed.data.razorpay_order_id,
          razorpay_payment_id: parsed.data.razorpay_payment_id,
        },
        payment: paymentJson,
        order: orderJson,
      };
      await storage.markWhitelabelOnboardingSettlementPaid(
        parsed.data.razorpay_order_id,
        parsed.data.razorpay_payment_id,
        paidPayload
      );
      await storage.markWhitelabelOnboardingFeesPaid(ids, parsed.data.razorpay_payment_id, {
        paymentGateway: "razorpay",
        gatewayPayload: paidPayload,
      });
      try {
        const { afterWhitelabelOnboardingFeesPaid } = await import("../onboarding-outstanding-gate");
        await afterWhitelabelOnboardingFeesPaid();
      } catch {
        /* ignore */
      }
      res.json({ success: true, updated: ids.length, gatewayPaymentId: parsed.data.razorpay_payment_id });
    } catch (error: any) {
      console.error("[Admin] onboarding-fees verify:", error);
      res.status(500).json({ message: error?.message || "Verify failed" });
    }
  });

  // ========== WEBSITE BUILDER ==========

  // Get Meta webhook logs from files (owner only)
  app.get("/api/admin/webhook-logs", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
      const offset = parseInt(req.query.offset as string) || 0;
      const eventType = req.query.eventType as string | undefined;
      const daysBack = Math.min(parseInt(req.query.daysBack as string) || 30, 90);

      const logs = readWebhookLogs({ limit, offset, eventType, daysBack });
      res.json({ logs, total: logs.length });
    } catch (error: any) {
      console.error("[Admin] Error fetching webhook logs:", error);
      res.status(500).json({ message: "Failed to fetch webhook logs", error: error?.message });
    }
  });

  // ========== EXPIRED SUBSCRIPTIONS / DATA RETENTION ==========

  app.get("/api/admin/expired-subscriptions", isAuthenticated, isSaaSOwner, async (_req: any, res) => {
    try {
      const {
        listExpiredSubscriptionUsers,
      } = await import("../expired-subscription-purge-scheduler");
      const {
        getSubscriptionDataRetentionMonths,
        getSubscriptionDataRetentionDays,
        SUBSCRIPTION_DATA_RETENTION_MONTHS_OPTIONS,
      } = await import("../utils/subscription-data-retention");
      const [users, retentionMonths, retentionDays] = await Promise.all([
        listExpiredSubscriptionUsers(),
        getSubscriptionDataRetentionMonths(),
        getSubscriptionDataRetentionDays(),
      ]);
      res.json({
        retention_months: retentionMonths,
        retention_days: retentionDays,
        retention_months_options: SUBSCRIPTION_DATA_RETENTION_MONTHS_OPTIONS,
        users: users.map((u) => ({
          ...u,
          periodEnd: u.periodEnd.toISOString(),
        })),
      });
    } catch (error: any) {
      console.error("[Admin] expired-subscriptions list:", error);
      res.status(500).json({ message: "Failed to list expired subscriptions", error: error?.message });
    }
  });

  app.put("/api/admin/expired-subscriptions/retention", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const { normalizeRetentionMonths } = await import("../utils/subscription-data-retention");
      const months = normalizeRetentionMonths(req.body?.months ?? req.body?.retention_months);
      if (![1, 2, 3].includes(Number(req.body?.months ?? req.body?.retention_months))) {
        return res.status(400).json({
          message: "Retention months is required and must be 1, 2, or 3",
        });
      }
      const row = await storage.setSubscriptionDataRetentionMonths(months);
      res.json({
        retention_months: row.subscriptionDataRetentionMonths,
        retention_days: months * 30,
        message: `Data will be deleted ${months} month${months === 1 ? "" : "s"} after plan expiry`,
      });
    } catch (error: any) {
      console.error("[Admin] expired-subscriptions retention:", error);
      res.status(500).json({ message: "Failed to update retention", error: error?.message });
    }
  });

  app.post(
    "/api/admin/expired-subscriptions/:userId/purge-data",
    isAuthenticated,
    isSaaSOwner,
    async (req: any, res) => {
      try {
        const userId = String(req.params.userId || "").trim();
        if (!userId) return res.status(400).json({ message: "User id required" });
        const target = await storage.getUser(userId);
        if (!target) return res.status(404).json({ message: "User not found" });
        if (target.isSaaSOwner) {
          return res.status(400).json({ message: "Cannot purge SaaS owner data" });
        }
        const { purgeExpiredUserBusinessData } = await import(
          "../expired-subscription-purge-scheduler"
        );
        const result = await purgeExpiredUserBusinessData(userId, { force: true });
        if (!result.purged) {
          return res.status(400).json({ message: result.message });
        }
        res.json({
          message: result.message,
          userId,
          note: "User account was kept; only business data was deleted.",
        });
      } catch (error: any) {
        console.error("[Admin] purge-data:", error);
        res.status(500).json({ message: "Failed to delete user data", error: error?.message });
      }
    },
  );

}

