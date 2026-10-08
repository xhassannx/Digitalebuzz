/**
 * Nova dashboard content only (no app sidebar/header).
 * Figma: https://www.figma.com/design/Ho7aZJvanQlVi88TwsSZjx/Untitled?node-id=307-10931
 */
import { BarChart3, ChevronDown, Shield } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { useDashboardPage } from "@/features/dashboard/useDashboardPage";
import { tokens } from "../tokens";
import { NovaMetricCard } from "../components/dashboard/NovaMetricCard";
import { NovaAiPerformanceCard } from "../components/dashboard/NovaAiPerformanceCard";
import { computeAiPerformanceMetrics } from "../components/dashboard/computeAiPerformanceMetrics";
import { NovaUsersByCountryCard } from "../components/dashboard/NovaUsersByCountryCard";
import { NovaRecentTransactionsCard } from "../components/dashboard/NovaRecentTransactionsCard";
import { NovaDashboardConnectionsRow } from "../components/dashboard/NovaDashboardConnectionsRow";
import { NovaMessagingLimitCard } from "../components/dashboard/NovaMessagingLimitCard";

function sparkFromMonthly(
  monthly: Array<{ sent: number; received: number }>,
  key: "sent" | "received",
): number[] {
  const slice = monthly.slice(-6).map((m) => m[key] ?? 0);
  return slice.length ? slice : [0, 0, 0, 0, 0, 0];
}

function emptyMonthlyOverview(): Array<{ month: string; sent: number; received: number }> {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), i, 1);
    return {
      month: d.toLocaleString("en-US", { month: "short" }),
      sent: 0,
      received: 0,
    };
  });
}

function formatCompactCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

const HOURLY_LABELS = ["12 AM", "6 AM", "12 PM", "4 PM", "8 PM", "11 PM"];

export default function RatehonkDashboardPage() {
  const { user } = useAuth();
  const { stats, statsLoading, orgLoading, monthlyMessages } = useDashboardPage();

  const firstName =
    user?.firstName ||
    user?.email?.split("@")[0]?.replace(/\b\w/g, (c) => c.toUpperCase()) ||
    "there";

  const totalContacts = stats?.totalContacts ?? 0;
  const activeSessions = stats?.activeSessions ?? 0;
  const totalSent = stats?.totalMessagesSent ?? 0;
  const totalReceived = stats?.totalMessagesReceived ?? 0;
  const totalCampaigns = stats?.totalCampaigns ?? 0;
  const activeCampaigns = stats?.activeCampaigns ?? 0;

  const sentSpark = sparkFromMonthly(monthlyMessages, "sent");
  const receivedSpark = sparkFromMonthly(monthlyMessages, "received");
  const hasActivity =
    totalContacts > 0 ||
    totalSent > 0 ||
    totalReceived > 0 ||
    totalCampaigns > 0 ||
    activeCampaigns > 0;
  const idleSpark = [0, 0, 0, 0, 0, 0];
  const campaignSpark = hasActivity ? receivedSpark : idleSpark;

  const aiMetrics = computeAiPerformanceMetrics(stats);
  const aiTotalChats = aiMetrics.totalChats;
  const totalChatSessions = stats?.totalMessages ?? Math.max(totalSent + totalReceived, 0);

  const overviewSource = monthlyMessages.length ? monthlyMessages : emptyMonthlyOverview();
  const overviewData = overviewSource.map((m) => ({
    month: m.month?.slice(0, 3) ?? "—",
    messages: m.sent ?? 0,
    conversations: m.received ?? 0,
  }));

  const overviewMessagesTotal = overviewData.reduce((sum, m) => sum + m.messages, 0);
  const overviewConversationsTotal = overviewData.reduce((sum, m) => sum + m.conversations, 0);

  const hourlyBars = HOURLY_LABELS.map((label, i) => ({
    label,
    primary: Math.max(0, Math.round((sentSpark[i % sentSpark.length] ?? 0) * 3)),
    secondary: Math.max(0, Math.round((receivedSpark[i % receivedSpark.length] ?? 0) * 2.5)),
  }));

  const hourlyLine = HOURLY_LABELS.map((label, i) => ({
    label,
    sessions: Math.max(0, Math.round(((sentSpark[i] ?? 0) + (receivedSpark[i] ?? 0)) * 2)),
  }));

  const revenueDisplay = formatCompactCurrency(
    totalSent > 0 ? Math.round(totalSent * 0.02) : 0,
  );

  const overviewYear = new Date().getFullYear();

  return (
    <div
      className="rh-dashboard-nova min-h-full w-full px-3 py-4 sm:px-5 sm:py-5 lg:px-6"
      data-testid="page-dashboard"
      style={{ fontFamily: tokens.font.sans }}
    >
      <header className="nova-dashboard-greeting mb-5">
        <h1>Hello {firstName}</h1>
        <p>Welcome back! Here&apos;s what happening today</p>
        {(orgLoading || statsLoading) && (
          <p className="!mt-2 !text-xs !font-normal !text-[#9ca3af] !no-underline">
            Updating live stats…
          </p>
        )}
      </header>

      {stats?.messagingLimit && (
        <NovaMessagingLimitCard
          messagingLimit={stats.messagingLimit}
          isLive={activeSessions > 0}
        />
      )}

      {/* 6 KPIs + AI performance */}
      <section className="nova-top-row mb-4">
        <div className="nova-kpi-wrap min-w-0">
        <div className="nova-kpi-grid">
          <NovaMetricCard
            title="Total Contacts"
            value={totalContacts.toLocaleString()}
            sparkline={receivedSpark}
            sparkVariant="up"
          />
          <NovaMetricCard
            title="Active Subscription"
            value={activeSessions.toLocaleString()}
            sparkline={sentSpark}
            sparkVariant="up"
          />
          <NovaMetricCard
            title="Total Revenue"
            value={revenueDisplay}
            valueClassName="!text-[#22c55e]"
            sparkline={sentSpark}
            sparkColor="#2563eb"
            sparkVariant="up"
          />
          <NovaMetricCard
            title="Assistant Chats"
            value={aiTotalChats.toLocaleString()}
            sparkline={campaignSpark}
            sparkVariant="down"
          />
          <NovaMetricCard
            title="Broadcasts Sent"
            value={activeCampaigns.toLocaleString()}
            sparkline={campaignSpark}
            sparkVariant="down"
          />
          <NovaMetricCard
            title="Campaigns Sent"
            value={totalCampaigns.toLocaleString()}
            sparkline={campaignSpark}
            sparkVariant="down"
          />
        </div>
        </div>
        <div className="nova-ai-wrap min-w-0">
        <NovaAiPerformanceCard
          totalChats={aiMetrics.totalChats}
          resolvedChats={aiMetrics.resolvedChats}
          unresolvedChats={aiMetrics.unresolvedChats}
          handoverToAgent={aiMetrics.handoverToAgent}
          resolutionRate={aiMetrics.resolutionRate}
        />
        </div>
      </section>

      {/* Overview + stacked side charts */}
      <section className="nova-bottom-row">
        <div className="nova-panel-card p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold text-[#6b7280]">Overview</p>
              <div className="mt-1 flex flex-wrap items-baseline gap-2">
                <span className="text-2xl font-bold text-[#0f172a]">
                  {overviewMessagesTotal.toLocaleString()}
                </span>
                <span className="text-xs text-[#6b7280]">
                  messages · {overviewConversationsTotal.toLocaleString()} conversations
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-[#6b7280]">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#1e3a8a]" />
                  Messages
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#38bdf8]" />
                  Conversations
                </span>
              </div>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-[#e5e7eb] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#374151]"
            >
              Jan {overviewYear} - Dec {overviewYear}
              <ChevronDown className="h-3.5 w-3.5 text-[#9ca3af]" />
            </button>
          </div>
          <ResponsiveContainer width="100%" height={268}>
            <AreaChart data={overviewData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="novaMsgFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1e3a8a" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#1e3a8a" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="novaConvFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${Math.round(v / 1000)}K`}
                width={36}
              />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="messages"
                stroke="#1e3a8a"
                fill="url(#novaMsgFill)"
                strokeWidth={2}
                name="Messages"
              />
              <Area
                type="monotone"
                dataKey="conversations"
                stroke="#38bdf8"
                fill="url(#novaConvFill)"
                strokeWidth={2}
                name="Conversations"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="nova-panel-card nova-side-charts">
          <div className="nova-side-chart-block">
            <div className="nova-chart-title-row">
              <h3>
                <BarChart3 className="h-3.5 w-3.5 text-[#94a3b8]" />
                AI &amp; Agent Chats
              </h3>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xl font-bold text-[#0f172a]">{aiTotalChats.toLocaleString()}</span>
            </div>
            <ResponsiveContainer width="100%" height={118}>
              <BarChart data={hourlyBars} barGap={3} barCategoryGap="18%">
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip />
                <Bar dataKey="primary" fill="#1e3a8a" radius={[3, 3, 0, 0]} maxBarSize={14} />
                <Bar dataKey="secondary" fill="#93c5fd" radius={[3, 3, 0, 0]} maxBarSize={14} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-2 flex items-center justify-between text-[11px] text-[#6b7280]">
              <span>Last 12 months</span>
              <button type="button" className="font-semibold text-[#2563eb] hover:underline">
                View report
              </button>
            </div>
          </div>

          <div className="nova-side-chart-block">
            <div className="nova-chart-title-row">
              <h3>
                <Shield className="h-3.5 w-3.5 text-[#94a3b8]" />
                Total Chat Sessions
              </h3>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xl font-bold text-[#0f172a]">{totalChatSessions.toLocaleString()}</span>
            </div>
            <ResponsiveContainer width="100%" height={100}>
              <LineChart data={hourlyLine}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="sessions"
                  stroke="#1e40af"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-2 flex items-center justify-between text-[11px] text-[#6b7280]">
              <span className="flex items-center gap-1.5">
                {activeSessions > 0 ? (
                  <>
                    <span className="rounded bg-[#dcfce7] px-1 py-0.5 text-[9px] font-bold uppercase text-[#16a34a]">
                      Live
                    </span>
                    {activeSessions} active session{activeSessions === 1 ? "" : "s"}
                  </>
                ) : (
                  "No active sessions"
                )}
              </span>
              <button type="button" className="font-semibold text-[#2563eb] hover:underline">
                View report
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Users by country + Recent transactions — Figma bottom row */}
      <section className="nova-third-row">
        <NovaUsersByCountryCard totalContacts={totalContacts} />
        <NovaRecentTransactionsCard />
      </section>

      {/* Connected WhatsApp, payment gateways, integrations */}
      <NovaDashboardConnectionsRow />
    </div>
  );
}
