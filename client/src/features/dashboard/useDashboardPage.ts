import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export type DashboardStats = {
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

export const DASHBOARD_CHART_COLORS = [
  "#0059bb",
  "#22c55e",
  "#3b82f6",
  "#f97316",
  "#a855f7",
  "#ec4899",
  "#eab308",
  "#6b7280",
];

function dashboardStatsUrl(organizationId: string | undefined): string {
  const base = "/api/dashboard/stats";
  if (!organizationId) return base;
  return `${base}?organizationId=${encodeURIComponent(organizationId)}`;
}

export function useDashboardPage() {
  const { data: orgData, isLoading: orgLoading } = useQuery<
    { organizations?: { id: string }[] } | { id: string }[]
  >({
    queryKey: ["/api/organizations"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/organizations");
      return res.json();
    },
  });

  const organizationsList = Array.isArray(orgData)
    ? orgData
    : (orgData?.organizations ?? []);
  const organizationId = organizationsList[0]?.id;

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats", organizationId],
    queryFn: async () => {
      const res = await apiRequest("GET", dashboardStatsUrl(organizationId));
      return res.json();
    },
    enabled: !!organizationId,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const monthlyMessages = stats?.monthlyMessages ?? [];
  const leadSourceBreakdown = stats?.leadSourceBreakdown ?? {};

  const contactSourceData = (() => {
    const sourceConfig: Record<string, { label: string; color: string }> = {
      manual: { label: "Manual", color: DASHBOARD_CHART_COLORS[0] },
      whatsapp: { label: "WhatsApp", color: DASHBOARD_CHART_COLORS[1] },
      facebook: { label: "Facebook", color: DASHBOARD_CHART_COLORS[2] },
      import: { label: "Import", color: DASHBOARD_CHART_COLORS[3] },
      api: { label: "API", color: DASHBOARD_CHART_COLORS[4] },
      indiamart: { label: "IndiaMart", color: DASHBOARD_CHART_COLORS[5] },
      google_ads: { label: "Google Ads", color: DASHBOARD_CHART_COLORS[6] },
      linkedin: { label: "LinkedIn", color: DASHBOARD_CHART_COLORS[7] },
      website: { label: "Website", color: DASHBOARD_CHART_COLORS[0] },
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

    return allSourcesOrder.map((source, index) => {
      const data = leadSourceBreakdown[source] || { total: 0 };
      const config = sourceConfig[source] || {
        label: source.charAt(0).toUpperCase() + source.slice(1),
        color: DASHBOARD_CHART_COLORS[index % DASHBOARD_CHART_COLORS.length],
      };
      return {
        name: config.label,
        value: data.total || 0,
        color: config.color,
      };
    });
  })();

  const totalLeads = stats?.totalContacts ?? 0;
  const pendingLeads = Object.values(leadSourceBreakdown).reduce(
    (sum, s) => sum + (s.pending ?? 0),
    0,
  );
  const assignedLeads = Object.values(leadSourceBreakdown).reduce(
    (sum, s) => sum + (s.assigned ?? 0),
    0,
  );

  return {
    organizationId,
    orgLoading,
    statsLoading,
    stats,
    monthlyMessages,
    leadSourceBreakdown,
    contactSourceData,
    totalLeads,
    pendingLeads,
    assignedLeads,
  };
}
