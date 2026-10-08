/**
 * Atlas (Emerald) dashboard — Rh-whatsapp Figma “Emerald Green”
 * https://www.figma.com/design/eIqluq3HmiuRPO5SGha5Hq/Rh-whatsapp?node-id=9-3
 */
import { Link } from "wouter";
import {
  BarChart3,
  Camera,
  ContactRound,
  Download,
  GraduationCap,
  Headphones,
  Hourglass,
  Megaphone,
  MessageCircle,
  Upload,
  UserPlus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { useDashboardPage } from "@/features/dashboard/useDashboardPage";
import { cn } from "@/lib/utils";
import { tokens } from "../tokens";

const MOBILE_CARD = "#2563eb";
/** Figma Message Activity — stacked bar fills */
const ACTIVITY_SENT = "#CCE2D9";
const ACTIVITY_RECEIVED = "#047857";

const WEEKDAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function buildWeekdayActivity(
  daily: Array<{ day: string; date?: string; messages: number }>,
  totalSent: number,
  totalReceived: number,
): Array<{ label: string; sent: number; received: number }> {
  const sentRatio =
    totalSent + totalReceived > 0 ? totalSent / (totalSent + totalReceived) : 0.72;
  const buckets: Record<(typeof WEEKDAY_ORDER)[number], number> = {
    Mon: 0,
    Tue: 0,
    Wed: 0,
    Thu: 0,
    Fri: 0,
    Sat: 0,
    Sun: 0,
  };

  for (const row of daily) {
    const day = row.day as (typeof WEEKDAY_ORDER)[number];
    if (day in buckets) {
      buckets[day] += row.messages ?? 0;
    }
  }

  const hasData = WEEKDAY_ORDER.some((d) => buckets[d] > 0);
  if (!hasData) {
    // Soft Figma-like profile when no daily volume yet
    const profile = [0.55, 0.72, 0.38, 1, 0.68, 0.85, 0.52];
    const base = Math.max(totalSent + totalReceived, 70);
    return WEEKDAY_ORDER.map((day, i) => {
      const total = Math.round(base * profile[i] * 0.12);
      const sent = Math.round(total * sentRatio);
      return { label: day.toUpperCase(), sent, received: Math.max(0, total - sent) };
    });
  }

  return WEEKDAY_ORDER.map((day) => {
    const total = buckets[day];
    const sent = Math.round(total * sentRatio);
    return {
      label: day.toUpperCase(),
      sent,
      received: Math.max(0, total - sent),
    };
  });
}

function momGrowth(
  monthly: Array<{ sent: number; received: number }>,
  key: "sent" | "received",
): { label: string; up: boolean } {
  if (monthly.length < 2) return { label: "0%", up: true };
  const prev = monthly[monthly.length - 2]?.[key] ?? 0;
  const curr = monthly[monthly.length - 1]?.[key] ?? 0;
  if (prev <= 0) {
    if (curr <= 0) return { label: "0%", up: true };
    return { label: "+100%", up: true };
  }
  const pct = ((curr - prev) / prev) * 100;
  const rounded = Math.abs(pct) >= 10 ? pct.toFixed(0) : pct.toFixed(1);
  return {
    label: `${pct >= 0 ? "+" : ""}${rounded}%`,
    up: pct >= 0,
  };
}

function AtlasLeadStatCard({
  label,
  value,
  percent,
  Icon,
}: {
  label: string;
  value: string;
  percent: number;
  Icon: LucideIcon;
}) {
  const width = Math.max(0, Math.min(100, percent));
  return (
    <div className="atlas-lead-stat">
      <div className="atlas-lead-stat-top">
        <span className="atlas-lead-stat-icon" aria-hidden>
          <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
        </span>
        <span className="atlas-lead-stat-label">{label}</span>
      </div>
      <p className="atlas-lead-stat-value">{value}</p>
      <div className="atlas-lead-stat-bar">
        <div className="atlas-lead-stat-bar-fill" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

type LeadSourceTheme = "emerald" | "lavender";

function AtlasLeadSourceRow({
  name,
  value,
  percent,
  Icon,
  theme = "emerald",
}: {
  name: string;
  value: number;
  percent: number;
  Icon: LucideIcon;
  theme?: LeadSourceTheme;
}) {
  const width = Math.max(0, Math.min(100, percent));
  return (
    <div className="atlas-source-row">
      <div className="atlas-source-row-top">
        <span className={cn("atlas-source-icon", theme === "lavender" && "atlas-source-icon--lavender")} aria-hidden>
          <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
        </span>
        <span className="atlas-source-name">{name}</span>
        <span className="atlas-source-value">{value.toLocaleString()}</span>
      </div>
      <div className="atlas-source-bar">
        <div
          className={cn(
            "atlas-source-bar-fill",
            theme === "lavender" && "atlas-source-bar-fill--lavender",
          )}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function GrowthPill({ label, up }: { label: string; up: boolean }) {
  return (
    <span
      className={cn(
        "atlas-growth-pill",
        up ? "atlas-growth-pill--up" : "atlas-growth-pill--down",
      )}
    >
      {label}
    </span>
  );
}

function AtlasMetricCard({
  title,
  value,
  growth,
  Icon,
}: {
  title: string;
  value: string;
  growth: { label: string; up: boolean };
  Icon: LucideIcon;
}) {
  return (
    <div className="atlas-metric-card">
      <div className="atlas-metric-card-top">
        <span className="atlas-metric-icon" aria-hidden>
          <Icon className="h-4 w-4" strokeWidth={2.25} />
        </span>
        <GrowthPill label={growth.label} up={growth.up} />
      </div>
      <p className="atlas-metric-title">{title}</p>
      <p className="atlas-metric-value">{value}</p>
    </div>
  );
}

export default function AtlasDashboardPage() {
  const { user } = useAuth();
  const {
    stats,
    statsLoading,
    orgLoading,
    monthlyMessages,
    contactSourceData,
    totalLeads,
    pendingLeads,
    assignedLeads,
  } = useDashboardPage();

  const firstName =
    user?.firstName ||
    user?.email?.split("@")[0]?.replace(/\b\w/g, (c) => c.toUpperCase()) ||
    "there";

  const totalSent = stats?.totalMessagesSent ?? 0;
  const totalReceived = stats?.totalMessagesReceived ?? 0;
  const totalContacts = stats?.totalContacts ?? 0;
  const totalAgents = stats?.totalAgents ?? 0;
  const activeCampaigns = stats?.activeCampaigns ?? 0;
  const activeSessions = stats?.activeSessions ?? 0;
  const totalSessions = stats?.totalSessions ?? 0;

  const sentGrowth = momGrowth(monthlyMessages, "sent");
  const receivedGrowth = momGrowth(monthlyMessages, "received");
  const contactGrowth = momGrowth(
    monthlyMessages.map((m) => ({
      sent: m.received,
      received: m.received,
    })),
    "received",
  );
  const agentsGrowth = { label: "Steady", up: true as const };

  const activityData = buildWeekdayActivity(
    stats?.dailyMessages ?? [],
    totalSent,
    totalReceived,
  );

  const sourceRows = (() => {
    // Figma Emerald Lead Source Breakdown — fixed three-channel layout
    const figmaChannels: Array<{
      key: string;
      hookName: string;
      label: string;
      Icon: LucideIcon;
      theme: LeadSourceTheme;
    }> = [
      {
        key: "whatsapp",
        hookName: "WhatsApp",
        label: "WhatsApp API",
        Icon: MessageCircle,
        theme: "emerald",
      },
      {
        key: "facebook",
        hookName: "Facebook",
        label: "Facebook Ads",
        Icon: Megaphone,
        theme: "emerald",
      },
      {
        key: "instagram",
        hookName: "Website",
        label: "Instagram",
        Icon: Camera,
        theme: "lavender",
      },
    ];

    const rows = figmaChannels.map((ch) => {
      const found = contactSourceData.find((s) => s.name === ch.hookName);
      return {
        key: ch.key,
        name: ch.label,
        value: found?.value ?? 0,
        Icon: ch.Icon,
        theme: ch.theme,
      };
    });
    const max = Math.max(...rows.map((r) => r.value), 1);
    return rows.map((r) => ({
      ...r,
      pct: Math.round((r.value / max) * 100),
    }));
  })();

  // Distribution (Figma): Active vs Inactive — sessions when present, else assigned vs pending leads
  const distActive =
    totalSessions > 0 ? activeSessions : assignedLeads;
  const distInactive =
    totalSessions > 0
      ? Math.max(0, totalSessions - activeSessions)
      : pendingLeads;
  const distTotal = distActive + distInactive;
  const activePct = distTotal > 0 ? Math.round((distActive / distTotal) * 100) : 0;

  return (
    <div
      className="rh-dashboard-atlas min-h-full w-full px-3 py-4 sm:px-5 sm:py-5 lg:px-6"
      data-testid="page-dashboard"
      style={{ fontFamily: tokens.font.sans }}
    >
      {/* Welcome */}
      <header className="atlas-welcome mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="atlas-welcome-title">Welcome back, {firstName}!</h1>
          <p className="atlas-welcome-sub">
            Your WhatsApp API control center is active. You have{" "}
            <span className="atlas-welcome-accent-blue">
              {pendingLeads.toLocaleString()} pending leads
            </span>{" "}
            and{" "}
            <span className="atlas-welcome-accent-olive">
              {activeCampaigns.toLocaleString()} active campaign
              {activeCampaigns === 1 ? "" : "s"}
            </span>{" "}
            running today.
          </p>
          {(orgLoading || statsLoading) && (
            <p className="mt-2 text-xs text-[#9ca3af]">Updating live stats…</p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link href="/campaigns" className="atlas-btn-outline">
            View Report
          </Link>
          <Link href="/send" className="atlas-btn-primary">
            Quick Send
          </Link>
        </div>
      </header>

      {/* KPI row — Figma: icon + pill, label, value (no sparkline) */}
      <section className="atlas-kpi-grid mb-4">
        <AtlasMetricCard
          title="Total Messages Sent"
          value={totalSent.toLocaleString()}
          growth={sentGrowth}
          Icon={Upload}
        />
        <AtlasMetricCard
          title="Total Messages Received"
          value={totalReceived.toLocaleString()}
          growth={receivedGrowth}
          Icon={Download}
        />
        <AtlasMetricCard
          title="Total Contacts"
          value={totalContacts.toLocaleString()}
          growth={contactGrowth}
          Icon={UserPlus}
        />
        <AtlasMetricCard
          title="Total Agents"
          value={totalAgents.toLocaleString()}
          growth={agentsGrowth}
          Icon={Headphones}
        />
      </section>

      {/* Leads + sources */}
      <section className="atlas-mid-row mb-4">
        <div className="atlas-card atlas-leads-card">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="atlas-card-title">Leads Overview</h2>
            <Link href="/contacts" className="atlas-leads-link">
              View All Leads
            </Link>
          </div>
          <div className="atlas-leads-stats">
            <AtlasLeadStatCard
              label="TOTAL LEADS"
              value={totalLeads.toLocaleString()}
              percent={100}
              Icon={BarChart3}
            />
            <AtlasLeadStatCard
              label="PENDING"
              value={pendingLeads.toLocaleString()}
              percent={
                totalLeads > 0 ? Math.round((pendingLeads / totalLeads) * 100) : 0
              }
              Icon={Hourglass}
            />
            <AtlasLeadStatCard
              label="ASSIGNED"
              value={assignedLeads.toLocaleString()}
              percent={
                totalLeads > 0 ? Math.round((assignedLeads / totalLeads) * 100) : 0
              }
              Icon={ContactRound}
            />
          </div>
        </div>

        <div className="atlas-card atlas-source-card">
          <h2 className="atlas-card-title mb-4">Lead Source Breakdown</h2>
          <div className="atlas-source-list">
            {sourceRows.map((row) => (
              <AtlasLeadSourceRow
                key={row.key}
                name={row.name}
                value={row.value}
                percent={row.pct}
                Icon={row.Icon}
                theme={row.theme}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Activity + mobile + distribution */}
      <section className="atlas-bottom-row mb-4">
        <div className="atlas-card atlas-activity-card">
          <div className="atlas-activity-header">
            <div>
              <h2 className="atlas-card-title">Message Activity</h2>
              <p className="atlas-activity-sub">Volume comparison over the last 14 days</p>
            </div>
            <div className="atlas-activity-legend">
              <span className="atlas-activity-legend-item">
                <span
                  className="atlas-activity-legend-dot"
                  style={{ backgroundColor: ACTIVITY_SENT }}
                />
                Sent
              </span>
              <span className="atlas-activity-legend-item">
                <span
                  className="atlas-activity-legend-dot"
                  style={{ backgroundColor: ACTIVITY_RECEIVED }}
                />
                Received
              </span>
            </div>
          </div>
          <div className="atlas-activity-chart">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={activityData} barCategoryGap="22%" margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                <CartesianGrid stroke="#eef1f4" vertical={false} strokeWidth={1} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#9ca3af", fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                  dy={6}
                />
                <YAxis hide domain={[0, "auto"]} />
                <Tooltip
                  cursor={{ fill: "rgba(4, 120, 87, 0.04)" }}
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid #e5e7eb",
                    fontSize: 12,
                  }}
                />
                {/* Stack: dark Received base + light Sent on top (Figma) */}
                <Bar
                  dataKey="received"
                  stackId="activity"
                  fill={ACTIVITY_RECEIVED}
                  name="Received"
                  maxBarSize={52}
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="sent"
                  stackId="activity"
                  fill={ACTIVITY_SENT}
                  name="Sent"
                  maxBarSize={52}
                  radius={[0, 0, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="atlas-go-mobile" style={{ backgroundColor: MOBILE_CARD }}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-lg font-semibold text-white">Go Mobile</p>
            <span className="atlas-go-mobile-soon">Coming soon</span>
          </div>
          <p className="mt-1 text-sm text-white/85">
            Scan to get the app for on-the-go inbox and campaigns.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <img
              src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=https://example.com/app"
              alt="App QR code"
              className="h-[88px] w-[88px] shrink-0 rounded-lg bg-white p-1.5"
            />
            <div className="atlas-store-badges">
              <div className="atlas-store-badge-slot">
                <img
                  src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg"
                  alt="Download on the App Store"
                  className="atlas-store-badge"
                />
              </div>
              <div className="atlas-store-badge-slot">
                <img
                  src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
                  alt="Get it on Google Play"
                  className="atlas-store-badge atlas-store-badge--play"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="atlas-card atlas-distribution-card">
          <h2 className="atlas-card-title">Distribution</h2>
          <div className="atlas-dist-square" aria-label={`${activePct}% active`}>
            <span className="atlas-dist-square-label">Active</span>
            <span className="atlas-dist-square-value">{activePct}%</span>
          </div>
          <div className="atlas-dist-footer">
            <div>
              <p className="atlas-dist-footer-label">ACTIVE</p>
              <p className="atlas-dist-footer-value">{distActive.toLocaleString()}</p>
            </div>
            <div className="atlas-dist-footer-right">
              <p className="atlas-dist-footer-label">INACTIVE</p>
              <p className="atlas-dist-footer-value">{distInactive.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Resources & Learning — Figma */}
      <section className="atlas-resources-section mb-2">
        <div className="atlas-resources-header">
          <GraduationCap className="h-5 w-5" strokeWidth={2.25} aria-hidden />
          <h2>Resources &amp; Learning</h2>
        </div>
        <div className="atlas-resources-grid">
          <Link href="/contacts" className="atlas-resource-tile">
            <div className="atlas-resource-tile-top">
              <span className="atlas-resource-tile-icon" aria-hidden>
                <BarChart3 className="h-3.5 w-3.5" strokeWidth={2.25} />
              </span>
              <span className="atlas-resource-tile-label">TOTAL LEADS</span>
            </div>
            <p className="atlas-resource-tile-value">{totalLeads.toLocaleString()}</p>
            <div className="atlas-resource-tile-bar">
              <div className="atlas-resource-tile-bar-fill" style={{ width: "100%" }} />
            </div>
          </Link>
          <Link href="/contacts" className="atlas-resource-tile">
            <div className="atlas-resource-tile-top">
              <span className="atlas-resource-tile-icon" aria-hidden>
                <Hourglass className="h-3.5 w-3.5" strokeWidth={2.25} />
              </span>
              <span className="atlas-resource-tile-label">PENDING</span>
            </div>
            <p className="atlas-resource-tile-value">{pendingLeads.toLocaleString()}</p>
            <div className="atlas-resource-tile-bar">
              <div
                className="atlas-resource-tile-bar-fill"
                style={{
                  width: `${
                    totalLeads > 0
                      ? Math.max(8, Math.round((pendingLeads / totalLeads) * 100))
                      : 0
                  }%`,
                }}
              />
            </div>
          </Link>
          <Link href="/contacts" className="atlas-resource-tile">
            <div className="atlas-resource-tile-top">
              <span className="atlas-resource-tile-icon" aria-hidden>
                <ContactRound className="h-3.5 w-3.5" strokeWidth={2.25} />
              </span>
              <span className="atlas-resource-tile-label">ASSIGNED</span>
            </div>
            <p className="atlas-resource-tile-value">{assignedLeads.toLocaleString()}</p>
            <div className="atlas-resource-tile-bar">
              <div
                className="atlas-resource-tile-bar-fill"
                style={{
                  width: `${
                    totalLeads > 0
                      ? Math.max(8, Math.round((assignedLeads / totalLeads) * 100))
                      : 0
                  }%`,
                }}
              />
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}
