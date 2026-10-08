/**
 * Aggregated panel usage stats for SaaS licensor (PRODUCTION_KEY remote APIs).
 * No secrets — counts and public-ish labels only.
 */
import { db } from "../db";
import {
  users,
  organizations,
  plans,
  subscriptions,
  contacts,
  campaigns,
  chatbots,
  whatsappFlows,
  automationFlows,
  integrations,
  whatsappSessions,
  messageTemplates,
  whitelabelOnboardingFees,
  organizationWallets,
  organizationWhatsappBilling,
} from "@shared/schema";
import { sql, eq, and, gt, desc, or, ilike, count } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { storage } from "./storage";
import { getWhitelabelCreditLineFacility } from "./whitelabel-credit-line";
import { isWalletBillingEnabled, getWalletBillingConfig } from "./wallet/config";

export type RemotePanelCustomerRow = {
  id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  is_active: boolean;
  account_status: string | null;
  is_trial: boolean;
  trial_expires_at: string | null;
  created_at: string | null;
  organizations: Array<{ id: string; name: string; role: string | null }>;
  active_plan: string | null;
  plan_id: string | null;
  plan_slug: string | null;
  plan_price_monthly_minor: number | null;
  plan_currency: string | null;
  subscription_id: string | null;
  subscription_status: string | null;
  billing_cycle: string | null;
  subscription_period_start: string | null;
  subscription_period_end: string | null;
};

async function enrichPanelCustomerRow(u: {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  accountStatus: string | null;
  isTrialAccount: boolean;
  trialExpiresAt: Date | null;
  createdAt: Date | null;
}): Promise<RemotePanelCustomerRow> {
  let activePlan: string | null = null;
  let planId: string | null = null;
  let planSlug: string | null = null;
  let planPrice: number | null = null;
  let planCurrency: string | null = null;
  let subscriptionId: string | null = null;
  let planStatus: string | null = null;
  let billingCycle: string | null = null;
  let periodStart: string | null = null;
  let periodEnd: string | null = null;
  const orgList: Array<{ id: string; name: string; role: string | null }> = [];

  try {
    const { subscription } = await storage.getEffectiveActiveSubscription(u.id);
    if (subscription) {
      subscriptionId = subscription.id;
      planStatus = subscription.status;
      billingCycle = subscription.billingCycle || null;
      periodStart =
        subscription.currentPeriodStart instanceof Date
          ? subscription.currentPeriodStart.toISOString()
          : subscription.currentPeriodStart
            ? String(subscription.currentPeriodStart)
            : null;
      periodEnd =
        subscription.currentPeriodEnd instanceof Date
          ? subscription.currentPeriodEnd.toISOString()
          : subscription.currentPeriodEnd
            ? String(subscription.currentPeriodEnd)
            : null;
      const plan = await storage.getPlan(subscription.planId);
      if (plan) {
        activePlan = plan.displayName || plan.name;
        planId = plan.id;
        planSlug = plan.name;
        planPrice = plan.priceMonthly ?? null;
        planCurrency = plan.currency || "INR";
      }
    }
  } catch {
    /* ignore */
  }

  try {
    const orgs = await storage.getOrganizationsByUser(u.id);
    for (const org of orgs.slice(0, 5)) {
      let role: string | null = null;
      try {
        const mine = await storage.getOrganizationMember(org.id, u.id);
        role = mine?.role ?? (org.ownerId === u.id ? "owner" : null);
      } catch {
        role = org.ownerId === u.id ? "owner" : null;
      }
      orgList.push({ id: org.id, name: org.name, role });
    }
  } catch {
    /* ignore */
  }

  return {
    id: u.id,
    email: u.email,
    phone: u.phone,
    first_name: u.firstName,
    last_name: u.lastName,
    name: [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || null,
    is_active: !!u.isActive,
    account_status: u.accountStatus,
    is_trial: !!u.isTrialAccount,
    trial_expires_at:
      u.trialExpiresAt instanceof Date
        ? u.trialExpiresAt.toISOString()
        : u.trialExpiresAt
          ? String(u.trialExpiresAt)
          : null,
    created_at:
      u.createdAt instanceof Date ? u.createdAt.toISOString() : u.createdAt ? String(u.createdAt) : null,
    organizations: orgList,
    active_plan: activePlan,
    plan_id: planId,
    plan_slug: planSlug,
    plan_price_monthly_minor: planPrice,
    plan_currency: planCurrency,
    subscription_id: subscriptionId,
    subscription_status: planStatus,
    billing_cycle: billingCycle,
    subscription_period_start: periodStart,
    subscription_period_end: periodEnd,
  };
}

/**
 * Paginated non–SaaS-owner customers for licensor Revenue UI.
 * GET /api/remote/panel-customers?limit=25&offset=0&q=&active=1
 */
export async function listRemotePanelCustomers(opts: {
  limit?: number;
  offset?: number;
  q?: string;
  activeOnly?: boolean;
}): Promise<{ total: number; limit: number; offset: number; customers: RemotePanelCustomerRow[] }> {
  const limit = Math.min(Math.max(Number(opts.limit) || 25, 1), 100);
  const offset = Math.max(Number(opts.offset) || 0, 0);
  const q = (opts.q || "").trim();

  const conditions: SQL[] = [eq(users.isSaaSOwner, false)];
  if (opts.activeOnly) {
    conditions.push(eq(users.isActive, true));
    conditions.push(eq(users.accountStatus, "active"));
  }
  if (q) {
    const pattern = `%${q}%`;
    const search = or(
      ilike(users.email, pattern),
      ilike(users.firstName, pattern),
      ilike(users.lastName, pattern),
      ilike(users.phone, pattern)
    );
    if (search) conditions.push(search);
  }

  const whereExpr = conditions.length === 1 ? conditions[0] : and(...conditions);

  const [totalRow] = await db.select({ total: count() }).from(users).where(whereExpr);
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      phone: users.phone,
      firstName: users.firstName,
      lastName: users.lastName,
      isActive: users.isActive,
      accountStatus: users.accountStatus,
      isTrialAccount: users.isTrialAccount,
      trialExpiresAt: users.trialExpiresAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(whereExpr)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  const customers = await Promise.all(rows.map((u) => enrichPanelCustomerRow(u)));

  return {
    total: Number(totalRow?.total) || 0,
    limit,
    offset,
    customers,
  };
}

async function countByStatus(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  statusCol: any
): Promise<Record<string, number>> {
  const rows = await db
    .select({
      status: statusCol,
      count: sql<number>`count(*)::int`,
    })
    .from(table)
    .groupBy(statusCol);
  const out: Record<string, number> = {};
  for (const r of rows) {
    const key = r.status == null ? "null" : String(r.status);
    out[key] = Number(r.count) || 0;
  }
  return out;
}

export async function buildRemotePanelOverview(): Promise<Record<string, unknown>> {
  const now = new Date();

  const [
    [userAgg],
    [orgAgg],
    [planAgg],
    [contactAgg],
    [sessionAgg],
    [templateAgg],
    [campaignAgg],
    [chatbotAgg],
    [waFlowAgg],
    [autoFlowAgg],
    [integrationAgg],
    [walletAgg],
    [feeAgg],
    [activeSubAgg],
    planBreakdown,
    subStatusCounts,
    campaignStatusCounts,
    chatbotStatusCounts,
    waFlowStatusCounts,
    autoFlowStatusCounts,
    integrationStatusCounts,
    sessionStatusCounts,
    feeStatusCounts,
    billingRows,
    master,
  ] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${users.isActive} = true and ${users.accountStatus} = 'active')::int`,
        saas_owners: sql<number>`count(*) filter (where ${users.isSaaSOwner} = true)::int`,
        customers: sql<number>`count(*) filter (where ${users.isSaaSOwner} = false)::int`,
        customers_active: sql<number>`count(*) filter (where ${users.isSaaSOwner} = false and ${users.isActive} = true and ${users.accountStatus} = 'active')::int`,
        trial: sql<number>`count(*) filter (where ${users.isTrialAccount} = true)::int`,
        suspended: sql<number>`count(*) filter (where ${users.accountStatus} = 'suspended')::int`,
        blocked: sql<number>`count(*) filter (where ${users.accountStatus} = 'blocked')::int`,
      })
      .from(users),
    db.select({ total: sql<number>`count(*)::int` }).from(organizations),
    db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${plans.isActive} = true)::int`,
        published: sql<number>`count(*) filter (where ${plans.status} = 'published')::int`,
      })
      .from(plans),
    db.select({ total: sql<number>`count(*)::int` }).from(contacts),
    db
      .select({
        total: sql<number>`count(*)::int`,
        connected: sql<number>`count(*) filter (where ${whatsappSessions.status} = 'connected' and ${whatsappSessions.deletedAt} is null)::int`,
        not_deleted: sql<number>`count(*) filter (where ${whatsappSessions.deletedAt} is null)::int`,
      })
      .from(whatsappSessions),
    db.select({ total: sql<number>`count(*)::int` }).from(messageTemplates),
    db.select({ total: sql<number>`count(*)::int` }).from(campaigns),
    db.select({ total: sql<number>`count(*)::int` }).from(chatbots),
    db.select({ total: sql<number>`count(*)::int` }).from(whatsappFlows),
    db.select({ total: sql<number>`count(*)::int` }).from(automationFlows),
    db.select({ total: sql<number>`count(*)::int` }).from(integrations),
    db
      .select({
        org_count: sql<number>`count(*)::int`,
        balance_sum_minor: sql<number>`coalesce(sum(${organizationWallets.balanceMinor}), 0)::bigint`,
      })
      .from(organizationWallets),
    db
      .select({
        total: sql<number>`count(*)::int`,
        outstanding_minor: sql<number>`coalesce(sum(${whitelabelOnboardingFees.amountMinor}) filter (where ${whitelabelOnboardingFees.status} in ('pending', 'failed')), 0)::bigint`,
        paid_minor: sql<number>`coalesce(sum(${whitelabelOnboardingFees.amountMinor}) filter (where ${whitelabelOnboardingFees.status} = 'paid'), 0)::bigint`,
      })
      .from(whitelabelOnboardingFees),
    db
      .select({
        total: sql<number>`count(*)::int`,
      })
      .from(subscriptions)
      .where(
        and(eq(subscriptions.status, "active"), gt(subscriptions.currentPeriodEnd, now))
      ),
    db
      .select({
        plan_id: plans.id,
        plan_name: plans.displayName,
        plan_slug: plans.name,
        price_monthly: plans.priceMonthly,
        currency: plans.currency,
        active_subscribers: sql<number>`count(${subscriptions.id}) filter (where ${subscriptions.status} = 'active' and ${subscriptions.currentPeriodEnd} > now())::int`,
        total_subscriptions: sql<number>`count(${subscriptions.id})::int`,
      })
      .from(plans)
      .leftJoin(subscriptions, eq(subscriptions.planId, plans.id))
      .groupBy(plans.id, plans.displayName, plans.name, plans.priceMonthly, plans.currency)
      .orderBy(
        desc(
          sql`count(${subscriptions.id}) filter (where ${subscriptions.status} = 'active' and ${subscriptions.currentPeriodEnd} > now())`
        )
      )
      .limit(50),
    countByStatus(subscriptions, subscriptions.status),
    countByStatus(campaigns, campaigns.status),
    countByStatus(chatbots, chatbots.status),
    countByStatus(whatsappFlows, whatsappFlows.status),
    countByStatus(automationFlows, automationFlows.status),
    countByStatus(integrations, integrations.status),
    countByStatus(whatsappSessions, whatsappSessions.status),
    countByStatus(whitelabelOnboardingFees, whitelabelOnboardingFees.status),
    db.select().from(organizationWhatsappBilling),
    storage.getPlatformMasterSettings(),
  ]);

  const modeCounts: Record<string, number> = { self_pay: 0, credit_line: 0 };
  const creditLineStatusCounts: Record<string, number> = {};
  for (const row of billingRows) {
    const mode = row.billingMode || "self_pay";
    modeCounts[mode] = (modeCounts[mode] || 0) + 1;
    if (mode === "credit_line") {
      const st = row.creditLineStatus || "inactive";
      creditLineStatusCounts[st] = (creditLineStatusCounts[st] || 0) + 1;
    }
  }

  let creditLineFacility: Record<string, unknown> | null = null;
  try {
    const facility = await getWhitelabelCreditLineFacility();
    creditLineFacility = {
      configured: facility.configured,
      enabled: facility.enabled,
      balance_minor: facility.balanceMinor,
      limit_minor: facility.limitMinor,
      currency: facility.currency,
    };
  } catch {
    creditLineFacility = null;
  }

  let walletConfig: Record<string, unknown> = { enabled: await isWalletBillingEnabled() };
  try {
    const cfg = await getWalletBillingConfig();
    walletConfig = {
      enabled: !!cfg.enabled,
      currency: cfg.currency || "INR",
      markup_enabled: !!cfg.markupEnabled,
      low_balance_threshold_minor: cfg.lowBalanceThresholdMinor ?? 0,
    };
  } catch {
    /* keep minimal */
  }

  return {
    generated_at: now.toISOString(),
    users: {
      total: Number(userAgg?.total) || 0,
      active: Number(userAgg?.active) || 0,
      saas_owners: Number(userAgg?.saas_owners) || 0,
      customers: Number(userAgg?.customers) || 0,
      customers_active: Number(userAgg?.customers_active) || 0,
      trial_accounts: Number(userAgg?.trial) || 0,
      suspended: Number(userAgg?.suspended) || 0,
      blocked: Number(userAgg?.blocked) || 0,
    },
    organizations: {
      total: Number(orgAgg?.total) || 0,
    },
    plans: {
      total: Number(planAgg?.total) || 0,
      active: Number(planAgg?.active) || 0,
      published: Number(planAgg?.published) || 0,
      breakdown: planBreakdown.map((p) => ({
        plan_id: p.plan_id,
        name: p.plan_name,
        slug: p.plan_slug,
        price_monthly_minor: p.price_monthly,
        currency: p.currency || "INR",
        active_subscribers: Number(p.active_subscribers) || 0,
        total_subscriptions: Number(p.total_subscriptions) || 0,
      })),
    },
    subscriptions: {
      active_now: Number(activeSubAgg?.total) || 0,
      by_status: subStatusCounts,
    },
    contacts: {
      total: Number(contactAgg?.total) || 0,
    },
    whatsapp_sessions: {
      total: Number(sessionAgg?.total) || 0,
      connected: Number(sessionAgg?.connected) || 0,
      not_deleted: Number(sessionAgg?.not_deleted) || 0,
      by_status: sessionStatusCounts,
    },
    message_templates: {
      total: Number(templateAgg?.total) || 0,
    },
    campaigns: {
      total: Number(campaignAgg?.total) || 0,
      by_status: campaignStatusCounts,
    },
    chatbots: {
      total: Number(chatbotAgg?.total) || 0,
      by_status: chatbotStatusCounts,
    },
    whatsapp_flows: {
      total: Number(waFlowAgg?.total) || 0,
      by_status: waFlowStatusCounts,
    },
    automation_flows: {
      total: Number(autoFlowAgg?.total) || 0,
      by_status: autoFlowStatusCounts,
    },
    integrations: {
      total: Number(integrationAgg?.total) || 0,
      by_status: integrationStatusCounts,
    },
    onboarding_fees: {
      total_rows: Number(feeAgg?.total) || 0,
      outstanding_minor: Number(feeAgg?.outstanding_minor) || 0,
      paid_minor: Number(feeAgg?.paid_minor) || 0,
      by_status: feeStatusCounts,
    },
    wallet_billing: walletConfig,
    org_wallets: {
      count: Number(walletAgg?.org_count) || 0,
      balance_sum_minor: Number(walletAgg?.balance_sum_minor) || 0,
    },
    org_billing_mode_counts: modeCounts,
    credit_line_status_counts: creditLineStatusCounts,
    credit_line_facility: creditLineFacility,
    platform_last_sync_at: master?.lastSyncAt
      ? master.lastSyncAt instanceof Date
        ? master.lastSyncAt.toISOString()
        : String(master.lastSyncAt)
      : null,
    platform_last_sync_status: master?.lastSyncStatus ?? null,
  };
}
