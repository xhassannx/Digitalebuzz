import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  UserX,
  MessageSquare,
  Send,
  CalendarPlus,
  Ban,
  Activity,
  FileText,
  Calendar,
  Loader2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { apiRequest } from "@/lib/queryClient";
import { format, subMonths } from "date-fns";

type DashboardStats = {
  totalSessions: number;
  activeSessions: number;
  totalMessagesSent: number;
  totalMessagesReceived: number;
  totalContacts: number;
  totalGroups: number;
  totalAgents: number;
  dailyMessages?: Array<{ day: string; date?: string; messages: number }>;
  monthlyMessages?: Array<{ month: string; sent: number; received: number }>;
};

const SENT_COLOR = "#f97316";
const RECEIVED_COLOR = "#22c55e";
const ADMINS_COLOR = "#ef4444";

export default function WebsiteBuilderHomeDashboard() {
  const [monthRange, setMonthRange] = useState<"1m" | "3m" | "6m">("3m");
  const [reportRange, setReportRange] = useState("1 Year");

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/dashboard/stats");
      return res.json();
    },
    refetchInterval: 120_000,
    staleTime: 60_000,
  });

  const todaySent = useMemo(() => {
    const daily = stats?.dailyMessages ?? [];
    const today = format(new Date(), "yyyy-MM-dd");
    const todayRow = daily.find((d) => d.date === today);
    return todayRow?.messages ?? 0;
  }, [stats?.dailyMessages]);

  const todayReceived = useMemo(() => {
    const daily = stats?.dailyMessages ?? [];
    const today = format(new Date(), "yyyy-MM-dd");
    const todayRow = daily.find((d) => d.date === today);
    return todayRow?.messages ?? 0;
  }, [stats?.dailyMessages]);

  const monthlyMessages = stats?.monthlyMessages ?? [];
  const thisMonth = format(new Date(), "MMM");
  const sentThisMonth =
    monthlyMessages.find((m) => m.month === thisMonth)?.sent ?? 0;
  const receivedThisMonth =
    monthlyMessages.find((m) => m.month === thisMonth)?.received ?? 0;

  const chartData = useMemo(() => {
    const raw = stats?.monthlyMessages ?? [];
    const n = monthRange === "1m" ? 1 : monthRange === "3m" ? 3 : 6;
    const sliced = raw.slice(-n);
    const agents = stats?.totalAgents ?? 0;
    return sliced.map((row) => ({
      name: row.month,
      sent: row.sent,
      received: row.received,
      admins: agents,
    }));
  }, [stats?.monthlyMessages, stats?.totalAgents, monthRange]);

  const barChartData = useMemo(() => {
    const raw = stats?.monthlyMessages ?? [];
    const n = reportRange === "1 Year" ? 12 : 6;
    const sliced = raw.slice(-n);
    const agents = stats?.totalAgents ?? 0;
    return sliced.map((row) => ({
      name: row.month,
      sent: row.sent,
      received: row.received,
      admins: agents,
    }));
  }, [stats?.monthlyMessages, stats?.totalAgents, reportRange]);

  const dateRangeLabel = useMemo(() => {
    const end = new Date();
    const start = subMonths(end, monthRange === "1m" ? 1 : monthRange === "3m" ? 3 : 6);
    return `${format(start, "dd MMM yyyy")} - ${format(end, "dd MMM yyyy")}`;
  }, [monthRange]);

  const reportDateRangeLabel = useMemo(() => {
    const end = new Date();
    const start = reportRange === "1 Year" ? subMonths(end, 12) : subMonths(end, 6);
    return `${format(start, "MMM d, yyyy")} - ${format(end, "MMM d, yyyy")}`;
  }, [reportRange]);

  const kpis = [
    {
      title: "Total Admin",
      value: stats?.totalAgents ?? 0,
      icon: Users,
      iconBg: "bg-slate-100 text-slate-700",
    },
    {
      title: "Total Suspended Users",
      value: 0,
      icon: UserX,
      iconBg: "bg-amber-100 text-amber-700",
    },
    {
      title: "Total Messages Received",
      value: stats?.totalMessagesReceived ?? 0,
      icon: MessageSquare,
      iconBg: "bg-green-100 text-green-700",
    },
    {
      title: "Today's Messages Sent",
      value: todaySent,
      icon: Send,
      iconBg: "bg-blue-100 text-blue-700",
    },
    {
      title: "New Accounts This Year",
      value: 0,
      icon: CalendarPlus,
      iconBg: "bg-violet-100 text-violet-700",
    },
    {
      title: "Total Blocked Users",
      value: 0,
      icon: Ban,
      iconBg: "bg-red-100 text-red-700",
    },
    {
      title: "Messages Sent This Month",
      value: sentThisMonth,
      icon: Send,
      iconBg: "bg-blue-100 text-blue-700",
    },
    {
      title: "Messages Received This Month",
      value: receivedThisMonth,
      icon: MessageSquare,
      iconBg: "bg-green-100 text-green-700",
    },
    {
      title: "Total Active Users",
      value: stats?.activeSessions ?? stats?.totalAgents ?? 0,
      icon: Activity,
      iconBg: "bg-emerald-100 text-emerald-700",
    },
    {
      title: "Total Messages Sent",
      value: stats?.totalMessagesSent ?? 0,
      icon: Send,
      iconBg: "bg-blue-100 text-blue-700",
    },
    {
      title: "Today's Messages Received",
      value: todayReceived,
      icon: MessageSquare,
      iconBg: "bg-green-100 text-green-700",
    },
  ];

  return (
    <div className="p-6 md:p-8 max-w-[95%] mx-auto space-y-6">
      {/* Breadcrumb + Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Home</span>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard">
            <FileText className="mr-2 h-4 w-4" />
            View All reports
          </Link>
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {kpis.map((kpi) => (
              <Card key={kpi.title} className="border rounded-lg shadow-sm">
                <CardContent className="p-4 flex items-center gap-4">
                  <div
                    className={`p-2.5 rounded-lg ${kpi.iconBg}`}
                    aria-hidden
                  >
                    <kpi.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-muted-foreground truncate">
                      {kpi.title}
                    </p>
                    <p className="text-xl font-semibold tabular-nums">
                      {typeof kpi.value === "number"
                        ? kpi.value.toLocaleString()
                        : kpi.value}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_1fr] xl:grid-cols-[1.2fr_1fr]">
            {/* Monthly Report */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-lg">Monthly Report</CardTitle>
                  <span className="text-sm text-muted-foreground">
                    {dateRangeLabel}
                  </span>
                  <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    Cached
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value: number) => [value.toLocaleString(), ""]}
                        labelFormatter={(label) => `Month: ${label}`}
                      />
                      <Area
                        type="monotone"
                        dataKey="sent"
                        name="Sent message"
                        stackId="1"
                        stroke={SENT_COLOR}
                        fill={SENT_COLOR}
                        fillOpacity={0.6}
                      />
                      <Area
                        type="monotone"
                        dataKey="received"
                        name="Received message"
                        stackId="1"
                        stroke={RECEIVED_COLOR}
                        fill={RECEIVED_COLOR}
                        fillOpacity={0.6}
                      />
                      <Area
                        type="monotone"
                        dataKey="admins"
                        name="Admins"
                        stroke={ADMINS_COLOR}
                        fill={ADMINS_COLOR}
                        fillOpacity={0.3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-muted-foreground">
                  Showing total: Sent message, Received message and Admins
                </p>
                <div className="flex gap-2">
                  {(["1m", "3m", "6m"] as const).map((m) => (
                    <Button
                      key={m}
                      variant={monthRange === m ? "default" : "outline"}
                      size="sm"
                      onClick={() => setMonthRange(m)}
                    >
                      {m}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Date range + Report Bar Chart */}
            <div className="space-y-6">
              {/* Date Range Selector */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{reportDateRangeLabel}</span>
                    <select
                      className="border rounded-md px-3 py-1.5 text-sm bg-background"
                      value={reportRange}
                      onChange={(e) =>
                        setReportRange(e.target.value as "1 Year" | "6 Months")
                      }
                    >
                      <option value="1 Year">1 Year</option>
                      <option value="6 Months">6 Months</option>
                    </select>
                  </div>
                </CardContent>
              </Card>

              {/* Report Bar Chart */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Report Bar Chart</CardTitle>
                  <CardDescription className="text-xs">
                    Showing total Sent message, Received message and Admins
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="h-[220px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={barChartData}
                        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip
                          formatter={(value: number) => [value.toLocaleString(), ""]}
                        />
                        <Bar dataKey="sent" name="Sent" fill={SENT_COLOR} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="received" name="Received" fill={RECEIVED_COLOR} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="admins" name="Admins" fill={ADMINS_COLOR} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap gap-4 justify-end text-sm">
                    <span>
                      <span className="inline-block w-3 h-3 rounded-sm bg-orange-500 mr-1" />
                      Total Admins: {(stats?.totalAgents ?? 0).toLocaleString()}
                    </span>
                    <span>
                      <span className="inline-block w-3 h-3 rounded-sm bg-green-500 mr-1" />
                      Received Messages:{(stats?.totalMessagesReceived ?? 0).toLocaleString()}
                    </span>
                    <span>
                      <span className="inline-block w-3 h-3 rounded-sm bg-orange-500 mr-1" />
                      Sent Messages: {(stats?.totalMessagesSent ?? 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span>
                      <span className="inline-block w-2.5 h-2.5 rounded-sm bg-orange-500 mr-1 align-middle" />
                      Sent Messages
                    </span>
                    <span>
                      <span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-500 mr-1 align-middle" />
                      Received Messages
                    </span>
                    <span>
                      <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-500 mr-1 align-middle" />
                      Total Admins
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
