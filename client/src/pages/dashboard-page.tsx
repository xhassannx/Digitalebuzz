
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  MessageSquare,
  Users,
  Send,
  TrendingUp,
  Activity,
  Plus,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  Megaphone,
  ContactRound,
  QrCode,
  UserPlus,
  Zap,
  ArrowUp,
  ArrowDown,
  Download,
  Globe,
  Phone,
  List,
  Grid,
  FileText,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  Facebook,
  Code,
  ShoppingCart,
  Linkedin,
  Search,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { usePanelTemplate } from "@/panel-templates/PanelTemplateProvider";

type DashboardStats = {
  totalSessions: number;
  activeSessions: number;
  totalMessages: number;
  totalMessagesSent: number;
  totalMessagesReceived: number;
  totalContacts: number;
  totalGroups: number;
  totalCampaigns: number;
  activeCampaigns: number;
  totalAgents: number;
  dailyMessages?: Array<{ day: string; date?: string; messages: number }>;
  monthlyMessages?: Array<{ month: string; sent: number; received: number }>;
  leadSourceBreakdown?: Record<string, { total: number; pending: number; assigned: number }>;
  messagingLimit?: {
    tier: string | null;
    tierLabel: string;
    qualityRating: string | null;
    dailyLimit: number | null;
    usedToday: number;
    remaining: number | null;
  } | null;
};

const COLORS = [
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
  "#ef4444",
  "#6b7280",
];

function dashboardStatsUrl(organizationId: string | undefined): string {
  const base = "/api/dashboard/stats";
  if (!organizationId) return base;
  return `${base}?organizationId=${encodeURIComponent(organizationId)}`;
}

export default function DashboardPage() {
  const { template, isLoading: templateLoading } = usePanelTemplate();
  if (templateLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  const TemplateDashboard = template?.pages?.Dashboard;
  if (TemplateDashboard) {
    return <TemplateDashboard />;
  }
  return <DashboardDefaultPage />;
}

function DashboardDefaultPage() {
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");

  const { data: orgData, isLoading: orgLoading } = useQuery<{ organizations?: { id: string }[] }>({
    queryKey: ["/api/organizations"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/organizations");
      return res.json();
    },
  });
  const organizationsList = Array.isArray(orgData) ? orgData : (orgData?.organizations ?? []);
  const organizationId = organizationsList[0]?.id;

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats", organizationId],
    queryFn: async () => {
      const res = await apiRequest("GET", dashboardStatsUrl(organizationId));
      return await res.json();
    },
    enabled: !!organizationId,
    // Reduce pressure on dashboard aggregates while keeping near-real-time updates.
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const monthlyMessages = stats?.monthlyMessages ?? [];
  const leadSourceBreakdown = stats?.leadSourceBreakdown ?? {};

  // Contact source distribution
  const contactSourceData = (() => {
    const sourceConfig: Record<string, { label: string; color: string }> = {
      manual: { label: "Manual", color: COLORS[0] },
      whatsapp: { label: "WhatsApp", color: COLORS[1] },
      facebook: { label: "Facebook", color: COLORS[2] },
      import: { label: "Import", color: COLORS[3] },
      api: { label: "API", color: COLORS[4] },
      indiamart: { label: "IndiaMart", color: COLORS[5] },
      google_ads: { label: "Google Ads", color: COLORS[6] },
      linkedin: { label: "LinkedIn", color: COLORS[7] },
      website: { label: "Website", color: COLORS[0] },
    };

    const breakdown = leadSourceBreakdown;
    const allSourcesOrder = ['manual', 'whatsapp', 'facebook', 'import', 'api', 'indiamart', 'google_ads', 'linkedin', 'website'];
    
    return allSourcesOrder.map((source, index) => {
      const data = breakdown[source] || { total: 0 };
      const config = sourceConfig[source] || { label: source.charAt(0).toUpperCase() + source.slice(1), color: COLORS[index % COLORS.length] };
      
      return {
        name: config.label,
        value: data.total || 0,
        color: config.color,
      };
    });
  })();

  return (
    <>
    <div className="p-6 space-y-6" data-testid="page-dashboard">
      <div>
        <h1 className="text-3xl font-semibold" data-testid="text-page-title">
          Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">
          Welcome to your WhatsApp API control center
        </p>
        {(orgLoading || statsLoading) && (
          <p className="text-xs text-muted-foreground mt-2">Loading live dashboard stats…</p>
        )}
      </div>

      {/* Top 4 Metrics */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Sent - Blue */}
        <Card className="bg-[#cfe5ff] border border-blue-200 rounded-md shadow-sm hover:shadow-md transition">
          <CardHeader className="pb-1">
            <CardTitle className="text-base font-bold text-slate-700">
              Total Messages Sent
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-3xl font-semibold text-slate-900">
              {stats?.totalMessagesSent?.toLocaleString() || "0"}
            </div>
            <div className="p-2 rounded-full bg-blue-200">
              <ArrowUp className="h-5 w-5 text-blue-700" />
            </div>
          </CardContent>
        </Card>

        {/* Received - Lime */}
        <Card className="bg-[#e6fb8f] border border-lime-300 rounded-md shadow-sm hover:shadow-md transition">
          <CardHeader className="pb-1">
            <CardTitle className="text-base font-bold text-slate-700">
              Total Messages Received
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-3xl font-semibold text-slate-900">
              {stats?.totalMessagesReceived?.toLocaleString() || "0"}
            </div>
            <div className="p-2 rounded-full bg-lime-300">
              <ArrowDown className="h-5 w-5 text-lime-800" />
            </div>
          </CardContent>
        </Card>

        {/* Contacts - Purple */}
        <Card className="bg-[#efd9ff] border border-purple-200 rounded-md shadow-sm hover:shadow-md transition">
          <CardHeader className="pb-1">
            <CardTitle className="text-base font-bold text-slate-700">
              Total Contacts
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-3xl font-semibold text-slate-900">
              {stats?.totalContacts?.toLocaleString() || "0"}
            </div>
            <div className="p-2 rounded-full bg-purple-200">
              <Users className="h-5 w-5 text-purple-700" />
            </div>
          </CardContent>
        </Card>

        {/* Agents - Peach */}
        <Card className="bg-[#ffe8df] border border-orange-200 rounded-md shadow-sm hover:shadow-md transition">
          <CardHeader className="pb-1">
            <CardTitle className="text-base font-bold text-slate-700">
              Total Agents
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-3xl font-semibold text-slate-900">
              {stats?.totalAgents?.toLocaleString() || "0"}
            </div>
            <div className="p-2 rounded-full bg-orange-200">
              <UserPlus className="h-5 w-5 text-orange-700" />
            </div>
          </CardContent>
        </Card>
      </div>

      {stats?.messagingLimit && (
        <Card className="border border-amber-200 bg-amber-50/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Activity className="h-4 w-4" />
              WhatsApp Messaging Limit
            </CardTitle>
            <CardDescription>
              Meta business-initiated conversations in a rolling 24-hour period
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-wrap items-end gap-8">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Remaining Quota</p>
                <div className="text-3xl font-semibold text-blue-600">
                  {stats.messagingLimit.remaining != null
                    ? stats.messagingLimit.remaining.toLocaleString()
                    : stats.messagingLimit.dailyLimit == null
                      ? "Unlimited"
                      : "—"}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Used / Limit</p>
                <div className="text-xl font-semibold text-slate-900">
                  {stats.messagingLimit.usedToday.toLocaleString()}
                  {stats.messagingLimit.dailyLimit != null && (
                    <span className="text-base text-muted-foreground font-normal">
                      {" "}/ {stats.messagingLimit.dailyLimit.toLocaleString()}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Tier: {stats.messagingLimit.tierLabel}
                  {stats.messagingLimit.qualityRating && (
                    <> · Quality: {stats.messagingLimit.qualityRating}</>
                  )}
                </p>
              </div>
            </div>
            {stats.messagingLimit.remaining != null && stats.messagingLimit.remaining < 50 && (
              <Badge variant="destructive">Low quota</Badge>
            )}
          </CardContent>
        </Card>
      )}

      {/* Leads Analytics and QR Code Section */}
      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr] items-stretch">
        {/* LEFT: Leads Summary */}
        <div className="flex flex-col h-full gap-3">
          {/* Total Leads */}
          <div className="flex items-center justify-between min-h-[96px] p-5 rounded-xl border border-primary/30 bg-background shadow-lg">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary text-primary-foreground">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-semibold">Total Leads</p>
                <p className="text-sm opacity-80">All leads in the system</p>
              </div>
            </div>
            <p className="text-3xl font-bold">
              {stats?.totalContacts?.toLocaleString() || "0"}
            </p>
          </div>

          {/* Pending Leads */}
          <div className="flex items-center justify-between min-h-[96px] p-5 rounded-xl border border-yellow-500/30 bg-background shadow-lg">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-yellow-500 text-white">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-semibold">Pending Leads</p>
                <p className="text-sm opacity-80">Awaiting assignment</p>
              </div>
            </div>
            <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
              {Math.floor((stats?.totalContacts || 0) * 0.9).toLocaleString()}
            </p>
          </div>

          {/* Assigned Leads */}
          <div className="flex items-center justify-between min-h-[96px] p-5 rounded-xl border border-green-600/30 bg-background shadow-lg">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-600 text-white">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-semibold">Assigned Leads</p>
                <p className="text-sm opacity-80">Assigned to agents</p>
              </div>
            </div>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">
              {Math.floor((stats?.totalContacts || 0) * 0.1).toLocaleString()}
            </p>
          </div>
        </div>

        {/* RIGHT: QR Code + App Download */}
        <div className="relative rounded-2xl p-[1px] bg-gradient-to-br from-emerald-50 via-sky-100 to-indigo-200 dark:from-emerald-900/20 dark:via-sky-900/20 dark:to-indigo-900/20 ring-1 ring-inset ring-sky-900/200 dark:ring-white/70">
          <Card className="h-full rounded-2xl bg-white/90 dark:bg-background/80 border border-emerald-100 dark:border-white/10 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Mobile app coming soon...
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* QR + Store Icons */}
              <div className="flex items-center justify-between gap-4 rounded-xl bg-gradient-to-br from-white to-emerald-50/60 dark:from-muted/40 dark:to-muted/20 border border-emerald-100/60 dark:border-white/10 p-4">
                {/* QR */}
                <div className="relative">
                  <img
                    src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=https://example.com/app"
                    alt="QR Code"
                    className="w-[120px] h-[120px] rounded-lg"
                  />

                  {/* Center App Icon */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-white dark:bg-background rounded-md p-1 shadow-sm">
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        className="text-emerald-500"
                      >
                        <path
                          d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"
                          fill="currentColor"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Store Badges */}
                <div className="flex flex-col gap-2">
                  <a href="#" className="inline-block">
                    <img
                      src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
                      alt="Get it on Google Play"
                      className="h-9 w-auto"
                    />
                  </a>

                  <a href="#" className="inline-block">
                    <img
                      src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg"
                      alt="Download on the App Store"
                      className="h-7 w-auto pl-2"
                    />
                  </a>
                </div>
              </div>

              {/* Key Features */}
              <div className="text-xs">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-slate-500 font-medium">
                    Key Features
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                  {[
                    "Real-time notifications",
                    "Live Chat",
                    "Lead Management",
                    "Analytics Dashboard",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="text-slate-700 dark:text-slate-200">
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Lead Source Breakdown and Contact Distribution */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Lead Source Breakdown */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Lead Source Breakdown</CardTitle>
              <Button variant="outline" size="sm">
                9 Sources
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            <div className="space-y-4 max-h-[500px] overflow-y-auto">
              {(() => {
                const sourceConfig: Record<
                  string,
                  { label: string; icon: any; color: string }
                > = {
                  manual: { label: "Manual", icon: UserPlus, color: "text-blue-500" },
                  whatsapp: { label: "WhatsApp", icon: MessageSquare, color: "text-green-500" },
                  facebook: { label: "Facebook", icon: Facebook, color: "text-blue-600" },
                  import: { label: "Import", icon: Download, color: "text-orange-500" },
                  api: { label: "API", icon: Code, color: "text-purple-500" },
                  indiamart: { label: "IndiaMart", icon: ShoppingCart, color: "text-yellow-500" },
                  google_ads: { label: "Google Ads", icon: Search, color: "text-red-500" },
                  linkedin: { label: "LinkedIn", icon: Linkedin, color: "text-blue-700" },
                  website: { label: "Website", icon: Globe, color: "text-cyan-500" },
                };

                const allSourcesOrder = [
                  "manual",
                  "whatsapp",
                  "facebook",
                  "import",
                  "api",
                  "indiamart",
                  "google_ads",
                  "linkedin",
                  "website",
                ];

                const breakdown = stats?.leadSourceBreakdown || {};

                return allSourcesOrder.map((source) => {
                  const data = breakdown[source] || {
                    total: 0,
                    pending: 0,
                    assigned: 0,
                  };

                  const config =
                    sourceConfig[source] || {
                      label: source,
                      icon: FileText,
                      color: "text-gray-500",
                    };

                  const Icon = config.icon;

                  return (
                    <div
                      key={source}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`h-5 w-5 ${config.color}`} />
                        <div>
                          <p className="font-medium">{config.label}</p>
                          <p className="text-sm text-muted-foreground">
                            {data.total.toLocaleString()} total leads
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="font-medium">
                          Total {data.total.toLocaleString()}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Pending {data.pending.toLocaleString()} • Assigned{" "}
                          {data.assigned.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </CardContent>
        </Card>

        {/* Contact Source Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Source Distribution</CardTitle>
            <CardDescription>Distribution of contacts by source</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={contactSourceData.filter(item => item.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {contactSourceData.filter(item => item.value > 0).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Show all sources in a legend */}
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium text-center mb-3">All Sources</p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {contactSourceData.map((entry, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-muted-foreground">{entry.name}: {entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Source Detail Cards */}
      {/* <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Import",
            total: 0.66,
            pending: 0.65,
            assigned: 0.01,
            bg: "bg-blue-50",
            border: "border-blue-400",
            text: "text-blue-900",
            icon: Download,
          },
          {
            label: "WhatsApp",
            total: 0.2,
            pending: 0.14,
            assigned: 0.06,
            bg: "bg-green-50",
            border: "border-green-400",
            text: "text-green-900",
            icon: MessageSquare,
          },
          {
            label: "Facebook",
            total: 0.1,
            pending: 0.08,
            assigned: 0.02,
            bg: "bg-purple-50",
            border: "border-purple-400",
            text: "text-purple-900",
            icon: Globe,
          },
          {
            label: "Website",
            total: 0.02,
            pending: 0.017,
            assigned: 0.003,
            bg: "bg-orange-50",
            border: "border-orange-400",
            text: "text-orange-900",
            icon: Globe,
          },
        ].map((item, i) => {
          const Icon = item.icon;

          return (
            <div
              key={i}
              className={`p-3 rounded-xl border-2 ${item.bg} ${item.border} hover:shadow-md hover:-translate-y-0.5 transition-all`}
            >
              <div className="flex items-center justify-between">
                <p className={`text-base font-semibold ${item.text}`}>
                  {item.label}
                </p>
                <Icon className={`h-5 w-5 ${item.text} opacity-80`} />
              </div>

              <p className={`text-2xl font-bold mt-2 ${item.text}`}>
                {Math.floor((stats?.totalContacts || 0) * item.total).toLocaleString()}
              </p>

              <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                <div className="rounded-md bg-white/80 border border-black/10 p-1.5 text-center shadow-lg text-black">
                  <p className="font-medium leading-tight text-black">Pending</p>
                  <p className="font-bold text-black">
                    {Math.floor((stats?.totalContacts || 0) * item.pending).toLocaleString()}
                  </p>
                </div>

                <div className="rounded-md bg-white/80 border border-black/10 p-1.5 text-center shadow-lg text-black">
                  <p className="font-medium leading-tight text-black">Assigned</p>
                  <p className="font-bold text-black">
                    {Math.floor((stats?.totalContacts || 0) * item.assigned).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div> */}

      {/* Messages Chart */}
      <Card className="rounded-xl ring-1 ring-border dark:ring-white/10 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            Sent and Received Messages
          </CardTitle>
        </CardHeader>

        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyMessages}>
              <CartesianGrid
                strokeDasharray="3 3"
                className="stroke-muted"
                opacity={0.3}
              />

              <XAxis dataKey="month" className="text-xs" />
              <YAxis className="text-xs" />

              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />

              <Legend />

              <Bar
                dataKey="sent"
                fill="hsl(var(--primary))"
                radius={[6, 6, 0, 0]}
                name="Sent"
              />

              <Bar
                dataKey="received"
                fill="hsl(var(--muted-foreground))"
                radius={[6, 6, 0, 0]}
                name="Received"
              />
            </BarChart>
          </ResponsiveContainer>

          <p className="mt-2 text-center text-xs text-muted-foreground">
            Showing total sent and received messages for the last 6 months
          </p>
        </CardContent>
      </Card>

      {/* Platform Walkthrough & Tutorials */}
      <Card className="mt-8 border-border/60">
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl font-extrabold tracking-tight flex items-center gap-3">
            Platform Walkthrough & Tutorials
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/15 text-primary font-semibold">
              Learn Faster
            </span>
          </CardTitle>

          <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
            📘
            <span className="hover:underline cursor-pointer font-medium">
              Read Platform Guide
            </span>
          </p>
        </CardHeader>

        <CardContent className="space-y-10">
          {/* Video Section */}
          <div>
            <h3 className="text-base font-bold tracking-wide text-foreground flex items-center gap-2 mb-4">
              <span className="w-1.5 h-5 rounded-full bg-primary" />
              Getting Started Videos
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                "https://www.youtube-nocookie.com/embed/XO6SOsFnj3k",
  "https://www.youtube-nocookie.com/embed/ihmXQx1EyxE",
              ].map((url, i) => (
                <div
                  key={i}
                  className="group relative rounded-xl overflow-hidden border bg-black transition hover:-translate-y-1 hover:shadow-xl"
                >
                  <iframe
                    className="w-full h-[230px]"
                    src={url}
                    title="Platform Tutorial"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />

                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                    <div className="bg-white/90 text-black rounded-full px-4 py-2 text-sm font-semibold shadow">
                      ▶ Watch Tutorial
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

    {/* ================= HELP TOPICS ================= */}
    <div>
      <h3 className="text-base font-bold tracking-wide text-foreground flex items-center gap-2 mb-5">
        <span className="w-1.5 h-5 rounded-full bg-primary" />
        Help Topics & Guides
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            title: "Template",
            bg: "bg-indigo-50",
            text: "text-indigo-900",
            hover: "hover:text-indigo-950",
            items: [
              "How to Create WhatsApp Template Message?",
              "Use chatbot parameters for leads",
              "Add Quick Reply to Template Message",
              "Message formatting guideline",
            ],
          },
          {
            title: "Campaign",
            bg: "bg-emerald-50",
            text: "text-emerald-900",
            hover: "hover:text-emerald-950",
            items: [
              "Audience segregation for Broadcast",
              "Upgrade WhatsApp Tier Limit",
              "Import up to 2 lakh contacts",
            ],
          },
          {
            title: "Live Chat & Attribute",
            bg: "bg-amber-50",
            text: "text-amber-900",
            hover: "hover:text-amber-950",
            items: [
              "Add user attributes manually",
              "Add / Remove tags",
              "Generate media links",
              "Chat Profile & First Message Tag",
            ],
          },
          {
            title: "Chatbot & Integration",
            bg: "bg-rose-50",
            text: "text-rose-900",
            hover: "hover:text-rose-950",
            items: [
              "Setup Welcome WhatsApp Chatbot",
              "Create WhatsApp Button",
              "Generate WhatsApp Link",
            ],
          },
        ].map((section, idx) => (
          <div
            key={idx}
            className={`rounded-xl border ${section.bg} p-4 transition hover:-translate-y-0.5 cursor-pointer`}
          >
            <h4
              className={`text-sm font-extrabold tracking-wide mb-2 flex items-center gap-2 ${section.text}`}
            >
              📂 {section.title}
            </h4>

            {/* Accent Line */}
            <div className={`h-0.5 w-10 rounded-full mb-3 ${section.text}`} />

            <ul className="space-y-2">
              {section.items.map((item, i) => (
                <li
                  key={i}
                  className={`flex items-start gap-2 text-sm font-medium cursor-pointer ${section.text} ${section.hover} hover:underline`}
                >
                  ➜ <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  </CardContent>
</Card>



    </div>
   
    
     </>
  );
}
