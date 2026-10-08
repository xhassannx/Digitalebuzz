// @ts-nocheck
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, RefreshCw, TrendingUp, Send, CheckCircle, CheckCheck, Eye, XCircle, Play, MousePointer, PlusCircle, Download, FileText, AlertTriangle, Users, Megaphone, Clock, MessageSquare, Reply, Rocket } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

type Campaign = {
  id: string;
  userId: string;
  organizationId: string;
  name: string;
  messageTemplate: string;
  status: string;
  scheduledAt: string | null;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  totalRecipients: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  templateId?: string;
  templateLanguage?: string;
  templateParameters?: Array<{ column?: string; fallback?: string }>;
  headerImageId?: string;
  headerImageUrl?: string;
  retryEnabled?: boolean;
  retrySteps?: Array<{ hours: number; minutes: number }> | null;
  retryAttemptCount?: number;
  retryNextAt?: string | null;
};

type CampaignRecipient = {
  id: string;
  campaignId: string;
  contactId: string | null;
  phoneNumber: string;
  name: string | null;
  status: string;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  errorMessage: string | null;
  messageId: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "#6b7280",
  sent: "#f97316",
  delivered: "#22c55e",
  read: "#3b82f6",
  seen: "#3b82f6",
  failed: "#ef4444",
  cta: "#8b5cf6", // Purple for CTA
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
  seen: "Seen",
  failed: "Failed",
  cta: "CTA Click",
};

/** Industry-style funnel: each stage is cumulative (% of total audience), like Wati/AiSensy reports. */
function computeCampaignFunnelMetrics(
  recipients: CampaignRecipient[],
  audienceSize: number,
  getLastStatus: (r: CampaignRecipient) => string,
  repliedCount: number
) {
  const total = audienceSize || recipients.length;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const pending = recipients.filter((r) => getLastStatus(r) === "pending").length;
  const failed = recipients.filter((r) => getLastStatus(r) === "failed").length;
  const sendOnlyFailed = recipients.filter(
    (r) => getLastStatus(r) === "failed" && !r.sentAt && !r.messageId
  ).length;

  const sent = Math.max(0, total - pending - sendOnlyFailed);
  const delivered = recipients.filter(
    (r) => r.deliveredAt || r.readAt || r.status === "delivered" || r.status === "read" || r.status === "seen"
  ).length;
  const read = recipients.filter(
    (r) => r.readAt || r.status === "read" || r.status === "seen"
  ).length;
  const replied = repliedCount;

  return {
    total,
    all: { count: total, percent: 100 },
    sent: { count: sent, percent: pct(sent) },
    delivered: { count: delivered, percent: pct(delivered) },
    read: { count: read, percent: pct(read) },
    replied: { count: replied, percent: pct(replied) },
    failed: { count: failed, percent: pct(failed) },
    pending,
    sendOnlyFailed,
  };
}

function QuickReportCard({
  label,
  count,
  percent,
  icon: Icon,
  iconClass,
}: {
  label: string;
  count: number;
  percent: number;
  icon: typeof Send;
  iconClass?: string;
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="mt-2 text-xl font-semibold leading-none">
              {percent}%
              <span className="ml-1 text-sm font-normal text-muted-foreground">({count})</span>
            </p>
          </div>
          <div className={`rounded-lg p-2 shrink-0 ${iconClass || "bg-muted"}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OverviewMetaCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Send;
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 flex items-start gap-3">
        <div className="rounded-lg bg-muted p-2 shrink-0">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-sm font-medium mt-1 break-words">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CampaignDetailPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/campaigns/:id");
  const campaignId = params?.id;

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [createFromCampaignOpen, setCreateFromCampaignOpen] = useState(false);
  const [createFromCampaignStatuses, setCreateFromCampaignStatuses] = useState<Set<string>>(new Set());

  const { data: campaign, isLoading: campaignLoading } = useQuery<Campaign>({
    queryKey: ["/api/campaigns", campaignId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/campaigns/${campaignId}`);
      return await res.json();
    },
    enabled: !!campaignId,
    refetchInterval: (query) =>
      query.state.data?.status === "running" || query.state.data?.status === "scheduled" ? 5000 : false,
  });

  const { data: recipients = [], isLoading: recipientsLoading } = useQuery<CampaignRecipient[]>({
    queryKey: ["/api/campaigns", campaignId, "recipients"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/campaigns/${campaignId}/recipients`);
      return await res.json();
    },
    enabled: !!campaignId,
    refetchInterval: campaign?.status === "running" || campaign?.status === "scheduled" ? 5000 : false,
  });

  // Fetch template details if templateId exists (org-scoped)
  const orgId = campaign?.organizationId;
  const { data: template } = useQuery<any>({
    queryKey: ["/api/templates", orgId, campaign?.templateId],
    queryFn: async () => {
      if (!campaign?.templateId) return null;
      const params = new URLSearchParams({ templateId: campaign.templateId });
      if (orgId) params.set("organizationId", orgId);
      const res = await apiRequest("GET", `/api/templates?${params.toString()}`);
      const templates = await res.json();
      return Array.isArray(templates) ? templates.find((t: any) => (t.id || t.templateId) === campaign.templateId) : templates;
    },
    enabled: !!campaign?.templateId,
  });

  const { data: buttonClicks = [] } = useQuery<Array<{ buttonId: string; buttonTitle: string; count: number }>>({
    queryKey: ["/api/campaigns", campaignId, "button-clicks"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/campaigns/${campaignId}/button-clicks`);
      return res.json();
    },
    enabled: !!campaignId,
  });

  // Get unique recipients who clicked any button (CTA report)
  const { data: ctaRecipientIds = [] } = useQuery<string[]>({
    queryKey: ["/api/campaigns", campaignId, "cta-recipients"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/campaigns/${campaignId}/cta-recipients`);
      return res.json();
    },
    enabled: !!campaignId,
  });

  // Get CTA click timestamps per recipient (first click timestamp)
  const { data: ctaTimestamps = {} } = useQuery<Record<string, string>>({
    queryKey: ["/api/campaigns", campaignId, "cta-timestamps"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/campaigns/${campaignId}/cta-timestamps`);
      return res.json();
    },
    enabled: !!campaignId,
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId] });
      await queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "recipients"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "button-clicks"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "cta-recipients"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "cta-timestamps"] });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Campaign data refreshed",
      });
    },
  });

  // Restart campaign for failed recipients only
  const restartFailedMutation = useMutation({
    mutationFn: async (includeDeliveryFailures = false) => {
      const res = await apiRequest("POST", `/api/campaigns/${campaignId}/restart-failed`, {
        includeDeliveryFailures,
      });
      return await res.json();
    },
    onSuccess: (data: { accepted?: boolean; message?: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "recipients"] });
      toast({
        title: data?.accepted ? "Retry started" : "Success",
        description:
          data?.message ||
          (data?.accepted
            ? "Retries are running in the background. Refresh shortly to see results."
            : "Campaign restarted for failed recipients"),
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to restart campaign",
      });
    },
  });

  // Resend: restart failed OR execute for pending
  const resendMutation = useMutation({
    mutationFn: async ({ failedCount, pendingCount }: { failedCount: number; pendingCount: number }) => {
      if (failedCount > 0) {
        const res = await apiRequest("POST", `/api/campaigns/${campaignId}/restart-failed`, {
          includeDeliveryFailures: false,
        });
        return await res.json();
      }
      if (pendingCount > 0) {
        const res = await apiRequest("POST", `/api/campaigns/${campaignId}/execute`);
        return await res.json();
      }
      throw new Error("No messages to resend");
    },
    onSuccess: (data: { accepted?: boolean; message?: string; sentCount?: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "recipients"] });
      toast({
        title: data?.accepted ? "Send started" : "Success",
        description:
          data?.message ||
          (data?.accepted
            ? "Sending in the background. Refresh this page in a minute to see progress."
            : `Resent ${data?.sentCount || 0} message(s)`),
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to resend",
      });
    },
  });

  if (!campaignId || campaignId === 'undefined') {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Invalid campaign ID</p>
      </div>
    );
  }

  if (campaignLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-muted-foreground">Loading campaign...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Campaign not found</p>
      </div>
    );
  }

  // Each contact counted ONCE by their LAST status (same logic as Recent Activity timeline).
  // Read wins (even if errorMessage later). Failed overrides Sent/Delivered (sent then failed → count as failed).
  const getLastStatus = (r: CampaignRecipient): string => {
    if (r.readAt || r.status === "read" || r.status === "seen") return "read";
    if (r.status === "failed" || r.errorMessage) return "failed";
    if (r.deliveredAt || r.status === "delivered") return "delivered";
    if (r.sentAt || r.status === "sent") return "sent";
    return "pending";
  };

  // Filter recipients by status (using getLastStatus for consistency)
  // CTA filter shows recipients who clicked any button
  const filteredRecipients = recipients.filter(r => {
    if (statusFilter === "all") return true;
    if (statusFilter === "cta") return ctaRecipientIds.includes(r.id);
    return getLastStatus(r) === statusFilter;
  });

  // Pagination
  const totalPages = Math.ceil(filteredRecipients.length / rowsPerPage);
  const paginatedRecipients = filteredRecipients.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );
  const totalMessages = recipients.length || campaign.totalRecipients || 0;
  const pendingCount = recipients.filter(r => getLastStatus(r) === "pending").length;
  const sentCountExclusive = recipients.filter(r => getLastStatus(r) === "sent").length;
  const deliveredCountExclusive = recipients.filter(r => getLastStatus(r) === "delivered").length;
  const readCountExclusive = recipients.filter(r => getLastStatus(r) === "read").length;
  const failedCount = recipients.filter(r => getLastStatus(r) === "failed").length;
  const sendFailedCount = recipients.filter(r => getLastStatus(r) === "failed" && !r.messageId).length;
  const deliveryFailedCount = recipients.filter(r => getLastStatus(r) === "failed" && !!r.messageId).length;
  const ctaCount = ctaRecipientIds.length;

  const funnel = computeCampaignFunnelMetrics(recipients, totalMessages, getLastStatus, ctaCount);

  const deliveryRate = funnel.delivered.percent;
  const engagementRate = funnel.read.percent;
  const failureRate = funnel.failed.percent;
  const processedCount = recipients.filter((r) => getLastStatus(r) !== "pending").length;
  const campaignProgress =
    totalMessages > 0 ? Math.min(100, Math.round((processedCount / totalMessages) * 100)) : 0;
  const estimatedMinutesRemaining =
    campaign?.status === "running" && pendingCount > 0
      ? Math.max(1, Math.ceil((pendingCount * 1.2) / 60))
      : 0;

  const failureReasons = (() => {
    const counts = new Map<string, number>();
    for (const r of recipients) {
      if (getLastStatus(r) !== "failed") continue;
      const label = r.errorMessage?.trim()
        ? r.errorMessage.trim()
        : r.messageId
          ? "Delivery failed (WhatsApp rejected after send)"
          : "Send failed before WhatsApp accepted the message";
      counts.set(label, (counts.get(label) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  })();

  const handleExportQuickReport = () => {
    const rows = [
      { Metric: "All", Count: funnel.all.count, Percent: `${funnel.all.percent}%` },
      { Metric: "Sent", Count: funnel.sent.count, Percent: `${funnel.sent.percent}%` },
      { Metric: "Delivered", Count: funnel.delivered.count, Percent: `${funnel.delivered.percent}%` },
      { Metric: "Read", Count: funnel.read.count, Percent: `${funnel.read.percent}%` },
      { Metric: "Replied", Count: funnel.replied.count, Percent: `${funnel.replied.percent}%` },
      { Metric: "Failed", Count: funnel.failed.count, Percent: `${funnel.failed.percent}%` },
    ];
    const headers = ["Metric", "Count", "Percent"];
    const csv = [
      headers.join(","),
      ...rows.map((row) => headers.map((h) => `"${String(row[h as keyof typeof row]).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${campaign.name}_Quick_Report_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    toast({ title: "Report exported", description: "Quick report CSV downloaded." });
  };

  const processedAt = campaign.completedAt || campaign.startedAt || campaign.updatedAt;
  const triggerLabel = campaign.scheduledAt
    ? format(new Date(campaign.scheduledAt), "MMM do, yyyy h:mm a")
    : "Immediately";
  const statusLabel = (campaign.status || "draft").toUpperCase();

  // Export function - exports filtered recipients to CSV
  const handleExportMessages = () => {
    const dataToExport = filteredRecipients.map(r => {
      const lastStatus = getLastStatus(r);
      return {
        Phone: r.phoneNumber,
        Name: r.name || "",
        Status: STATUS_LABELS[lastStatus] || lastStatus,
        "Sent At": r.sentAt ? format(new Date(r.sentAt), "MM/dd/yyyy, h:mm:ss a") : "",
        "Delivered At": r.deliveredAt ? format(new Date(r.deliveredAt), "MM/dd/yyyy, h:mm:ss a") : "",
        "Read At": r.readAt ? format(new Date(r.readAt), "MM/dd/yyyy, h:mm:ss a") : "",
        "Error Message": r.errorMessage || "",
      };
    });

    // Create CSV content
    const headers = Object.keys(dataToExport[0] || {});
    const csvContent = [
      headers.join(","),
      ...dataToExport.map(row => 
        headers.map(header => {
          const value = row[header as keyof typeof row] || "";
          // Escape commas and quotes in CSV
          return `"${String(value).replace(/"/g, '""')}"`;
        }).join(",")
      )
    ].join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const statusLabel = statusFilter === "all" ? "All" : STATUS_LABELS[statusFilter] || statusFilter;
    link.setAttribute("download", `${campaign.name}_${statusLabel}_Messages_${format(new Date(), "yyyy-MM-dd")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadCampaignReport = async (kind: string, label: string) => {
    try {
      const res = await apiRequest("GET", `/api/campaigns/${campaignId}/reports/${kind}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${campaign.name}_${kind}_${format(new Date(), "yyyy-MM-dd")}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "Report downloaded", description: `${label} CSV is ready.` });
    } catch (e: any) {
      toast({ title: "Download failed", description: e?.message || "Could not export report", variant: "destructive" });
    }
  };

  // Get export button text based on status filter
  const getExportButtonText = () => {
    if (statusFilter === "all") return "Export All Messages";
    const statusLabel = STATUS_LABELS[statusFilter] || statusFilter;
    return `Export ${statusLabel} Messages`;
  };

  // Status data: each contact counted once by last status only (same as Recent Activity).
  // Pie chart uses only message statuses so slices sum to totalMessages.
  const statusDataForChart = [
    { name: "Pending", value: pendingCount, color: STATUS_COLORS.pending },
    { name: "Sent", value: sentCountExclusive, color: STATUS_COLORS.sent },
    { name: "Delivered", value: deliveredCountExclusive, color: STATUS_COLORS.delivered },
    { name: "Read", value: readCountExclusive, color: STATUS_COLORS.read },
    { name: "Failed", value: failedCount, color: STATUS_COLORS.failed },
  ];
  // Full list for Status Summary (message statuses + CTA recipients as separate metric)
  const statusData = [
    ...statusDataForChart,
    { name: "CTA", value: ctaCount, color: "#8b5cf6" },
  ];

  // Recent activity - show ALL recipients with their current status and all status updates
  const recentActivity = recipients
    .map(r => {
      const activities: Array<{ type: string; timestamp: string }> = [];
      
      // Add all status updates for this recipient (in chronological order: sent -> delivered -> read)
      if (r.sentAt) {
        activities.push({ type: "sent", timestamp: r.sentAt });
      }
      if (r.deliveredAt) {
        activities.push({ type: "delivered", timestamp: r.deliveredAt });
      }
      if (r.readAt) {
        activities.push({ type: "read", timestamp: r.readAt });
      }
      
      // Add CTA click if recipient clicked any button (count once per recipient)
      if (ctaRecipientIds.includes(r.id) && ctaTimestamps[r.id]) {
        activities.push({ type: "cta", timestamp: ctaTimestamps[r.id] });
      }
      
      // If no activities but has a status, show the status
      if (r.status === 'failed') {
        activities.push({ type: "failed", timestamp: (r.sentAt || campaign.createdAt) as string });
      }
      
      if (activities.length === 0) {
        const timestamp = r.sentAt || r.deliveredAt || r.readAt || campaign.createdAt;
        activities.push({ type: r.status || 'pending', timestamp: timestamp as string });
      }
      
      // Sort by timestamp chronologically (oldest first) - shows status progression date-wise
      activities.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      // Get current status
      const currentStatus = r.status || 'pending';
      
      return {
        id: r.id,
        phone: r.phoneNumber,
        name: r.name,
        status: currentStatus,
        activities: activities,
        mostRecentTimestamp: activities.length > 0 ? activities[activities.length - 1].timestamp : campaign.createdAt,
        errorMessage: r.errorMessage,
        clickedCTA: ctaRecipientIds.includes(r.id),
      };
    })
    .sort((a, b) => {
      // Sort by most recent timestamp (most recent first)
      return new Date(b.mostRecentTimestamp).getTime() - new Date(a.mostRecentTimestamp).getTime();
    });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/campaigns")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-semibold">{campaign.name}</h1>
            <p className="text-muted-foreground mt-1">
              Created on {format(new Date(campaign.createdAt), "MMMM do, yyyy")}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => refreshMutation.mutate()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh Report
        </Button>
      </div>

      {(campaign.status === "running" || campaign.status === "scheduled") && (
        <div className="rounded-lg border border-blue-500/40 bg-blue-500/10 p-4">
          <div className="flex items-start gap-3">
            <RefreshCw className="h-5 w-5 text-blue-600 shrink-0 mt-0.5 animate-spin" />
            <div className="flex-1 space-y-2">
              <p className="font-medium text-blue-900 dark:text-blue-100">
                Campaign is sending in the background
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Sends are auto-paced from your WhatsApp tier and number quality (not fixed 2s gaps).
                Meta limits are respected with safety margins so rate-limit errors are avoided.
                {pendingCount > 0 && estimatedMinutesRemaining > 0
                  ? ` Roughly ${estimatedMinutesRemaining} minute(s) remaining for ${pendingCount} pending recipient(s).`
                  : ""}
              </p>
              <Progress value={campaignProgress} className="h-2" />
              <p className="text-xs text-blue-700 dark:text-blue-300">
                {processedCount} of {totalMessages} processed ({campaignProgress}%)
              </p>
            </div>
          </div>
        </div>
      )}

      {campaign.retryEnabled && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 flex items-start gap-3">
          <Clock className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-emerald-900 dark:text-emerald-100">
              Retry Campaign enabled
            </p>
            <p className="text-sm text-emerald-800 dark:text-emerald-200">
              {(campaign.retrySteps?.length || 0)} automatic retry pass
              {(campaign.retrySteps?.length || 0) === 1 ? "" : "es"} configured
              {typeof campaign.retryAttemptCount === "number"
                ? ` · ${campaign.retryAttemptCount} started`
                : ""}
              {campaign.retryNextAt
                ? ` · next retry ${format(new Date(campaign.retryNextAt), "PPp")}`
                : campaign.retryAttemptCount &&
                    campaign.retrySteps &&
                    campaign.retryAttemptCount >= campaign.retrySteps.length
                  ? " · all retries finished"
                  : ""}
            </p>
          </div>
        </div>
      )}

      {failedCount > 0 && failureRate >= 20 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-900 dark:text-amber-100">
              High failure rate ({failureRate}%)
            </p>
            <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
              Most failures come from WhatsApp delivery limits, invalid numbers, opt-outs, or template quality — not from the app stopping early.
              Scaling to 2,000–3,000 contacts works, but expect longer send times and keep lists clean.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Quick Report</h2>
              <p className="text-sm text-muted-foreground">
                Funnel metrics (% of audience) — same format as WhatsApp campaign API reports
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => refreshMutation.mutate()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Report
              </Button>
              <Button variant="default" size="sm" onClick={handleExportQuickReport}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            <QuickReportCard label="All" count={funnel.all.count} percent={funnel.all.percent} icon={Rocket} iconClass="bg-slate-100 text-slate-700" />
            <QuickReportCard label="Sent" count={funnel.sent.count} percent={funnel.sent.percent} icon={Send} iconClass="bg-orange-100 text-orange-700" />
            <QuickReportCard label="Delivered" count={funnel.delivered.count} percent={funnel.delivered.percent} icon={CheckCheck} iconClass="bg-green-100 text-green-700" />
            <QuickReportCard label="Read" count={funnel.read.count} percent={funnel.read.percent} icon={Eye} iconClass="bg-blue-100 text-blue-700" />
            <QuickReportCard label="Replied" count={funnel.replied.count} percent={funnel.replied.percent} icon={Reply} iconClass="bg-violet-100 text-violet-700" />
            <QuickReportCard label="Failed" count={funnel.failed.count} percent={funnel.failed.percent} icon={XCircle} iconClass="bg-red-100 text-red-700" />
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-3">Campaign Overview</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <OverviewMetaCard label="Campaign Status" value={statusLabel} icon={CheckCircle} />
              <OverviewMetaCard label="Campaign name" value={campaign.name} icon={Megaphone} />
              <OverviewMetaCard label="Trigger Campaign" value={triggerLabel} icon={Clock} />
              <OverviewMetaCard
                label="Processed At"
                value={processedAt ? format(new Date(processedAt), "do MMM, yyyy h:mm a") : "—"}
                icon={Clock}
              />
              <OverviewMetaCard label="Audience Type" value="Contact list" icon={Users} />
              <OverviewMetaCard label="Audience Size" value={String(funnel.total)} icon={Users} />
              <OverviewMetaCard
                label="Template / Messages"
                value={campaign.messageTemplate || template?.name || "1"}
                icon={MessageSquare}
              />
              {campaign.templateLanguage ? (
                <OverviewMetaCard label="Template language" value={campaign.templateLanguage} icon={FileText} />
              ) : null}
            </div>
          </div>

          {/* Summary rates (derived from funnel) */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Engagement Rate</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{engagementRate}%</div>
                <p className="text-xs text-muted-foreground mt-1">{funnel.read.count} read of {funnel.total} audience</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{deliveryRate}%</div>
                <p className="text-xs text-muted-foreground mt-1">{funnel.delivered.count} delivered of {funnel.total} audience</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Sent</CardTitle>
                <Send className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{funnel.sent.percent}%</div>
                <p className="text-xs text-muted-foreground mt-1">{funnel.sent.count} accepted by WhatsApp</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Button clicks</CardTitle>
                <MousePointer className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{funnel.replied.count}</div>
                <p className="text-xs text-muted-foreground mt-1">Shown as Replied in Quick Report</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Status Breakdown - Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Status Breakdown</CardTitle>
                <p className="text-xs text-muted-foreground">Distribution of message statuses</p>
              </CardHeader>
              <CardContent>
                {statusDataForChart.some(item => item.value > 0) ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={statusDataForChart.filter(item => item.value > 0)}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {statusDataForChart.filter(item => item.value > 0).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-64 text-muted-foreground">
                    No data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Status Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Status Summary</CardTitle>
                <p className="text-xs text-muted-foreground">Each contact counted by their last status only</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {statusData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-sm">{item.name}</span>
                    </div>
                    <span className="text-sm font-medium">
                      {item.value} {item.name === "CTA" ? "recipients" : "messages"}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {failedCount > 0 && failureReasons.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Failure reasons</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Top errors from failed recipients — export Messages tab for full details
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {failureReasons.map(([reason, count]) => (
                  <div key={reason} className="flex items-start justify-between gap-3 py-1.5 border-b last:border-0">
                    <span className="text-sm text-muted-foreground flex-1">{reason}</span>
                    <span className="text-sm font-medium shrink-0">{count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Template button click counts */}
          {buttonClicks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <MousePointer className="w-4 h-4" />
                  Button clicks
                </CardTitle>
                <p className="text-xs text-muted-foreground">How many customers clicked each template button</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {buttonClicks.map((b) => (
                    <div key={b.buttonId} className="flex items-center justify-between py-1.5 border-b last:border-0">
                      <span className="text-sm">{b.buttonTitle || b.buttonId}</span>
                      <span className="text-sm font-medium">{b.count} click{b.count !== 1 ? "s" : ""}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {/* Recent Activity */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
                  <p className="text-xs text-muted-foreground">All contacts with their statuses</p>
                </div>
                <div className="flex items-center gap-2">
                  {sendFailedCount > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => restartFailedMutation.mutate(false)}
                      disabled={restartFailedMutation.isPending}
                      className="h-8"
                    >
                      {restartFailedMutation.isPending ? (
                        <>
                          <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                          Restarting...
                        </>
                      ) : (
                        <>
                          <Play className="h-3 w-3 mr-1" />
                          Restart Failed ({sendFailedCount})
                        </>
                      )}
                    </Button>
                  )}
                  {deliveryFailedCount > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Retry ${deliveryFailedCount} delivery-failed message(s)? This may send duplicate messages to recipients who already received them.`,
                          )
                        ) {
                          restartFailedMutation.mutate(true);
                        }
                      }}
                      disabled={restartFailedMutation.isPending}
                      className="h-8 border-amber-300 text-amber-900 hover:bg-amber-50"
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Retry Delivery Failed ({deliveryFailedCount})
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => refreshMutation.mutate()}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {recentActivity.length > 0 ? (
                    recentActivity.map((recipient) => (
                      <div key={recipient.id} className="space-y-2 pb-3 border-b last:border-0">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium">{recipient.phone}</div>
                          <Badge 
                            variant="outline" 
                            className="text-xs"
                            style={{ 
                              backgroundColor: `${STATUS_COLORS[recipient.status]}20`,
                              color: STATUS_COLORS[recipient.status],
                              borderColor: STATUS_COLORS[recipient.status],
                            }}
                          >
                            {STATUS_LABELS[recipient.status]}
                          </Badge>
                        </div>
                        {recipient.errorMessage && (
                          <div className="text-xs text-destructive pl-2">
                            Error: {recipient.errorMessage}
                          </div>
                        )}
                        <div className="space-y-1 pl-2">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Status timeline (date-wise)</p>
                          {recipient.activities.map((activity, actIndex) => (
                            <div key={actIndex} className="flex items-center gap-2">
                              <Badge 
                                variant="outline" 
                                className="text-xs"
                                style={{ 
                                  backgroundColor: `${STATUS_COLORS[activity.type]}20`,
                                  color: STATUS_COLORS[activity.type],
                                  borderColor: STATUS_COLORS[activity.type],
                                }}
                              >
                                {STATUS_LABELS[activity.type]}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(activity.timestamp), "dd-MM-yyyy HH:mm:ss")}
                              </span>
                            </div>
                          ))}
                          {recipient.activities.length === 0 && (
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(recipient.mostRecentTimestamp), "dd-MM-yyyy HH:mm:ss")}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No recipients yet</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Message Template Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Message Template</CardTitle>
                <p className="text-xs text-muted-foreground">Preview of sent message</p>
              </CardHeader>
              <CardContent>
                {template ? (
                  <div className="space-y-3">
                    <div className="bg-background border rounded-lg p-4 space-y-3 max-h-96 overflow-y-auto">
                      {/* Header Image */}
                      {template.components?.find((c: any) => c.type === 'HEADER' && c.format === 'IMAGE') && (
                        campaign.headerImageUrl ? (
                          <img 
                            src={campaign.headerImageUrl} 
                            alt="Template header" 
                            className="w-full rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-full h-32 bg-muted rounded-lg flex items-center justify-center text-muted-foreground text-sm">
                            Header Image
                          </div>
                        )
                      )}
                      
                      {/* Header Text */}
                      {template.components?.find((c: any) => c.type === 'HEADER' && c.format === 'TEXT') && (
                        <div className="text-sm font-semibold">
                          {template.components.find((c: any) => c.type === 'HEADER' && c.format === 'TEXT')?.text}
                        </div>
                      )}
                      
                      {/* Body */}
                      {template.components?.find((c: any) => c.type === 'BODY')?.text && (() => {
                        let bodyText = template.components.find((c: any) => c.type === 'BODY').text;
                        // Replace template parameters with fallback values or sample values
                        if (campaign.templateParameters && campaign.templateParameters.length > 0) {
                          campaign.templateParameters.forEach((param, index) => {
                            const value = param.fallback || `{{${index + 1}}}`;
                            bodyText = bodyText.replace(new RegExp(`\\{\\{${index + 1}\\}\\}`, 'g'), value);
                          });
                        } else {
                          // Replace with sample values if no parameters
                          bodyText = bodyText.replace(/\{\{(\d+)\}\}/g, (match, num) => {
                            return `Sample${num}`;
                          });
                        }
                        return (
                          <div className="text-sm whitespace-pre-wrap">
                            {bodyText.split('\n').map((line: string, i: number) => (
                              <div key={i}>{line}</div>
                            ))}
                          </div>
                        );
                      })()}
                      
                      {/* Footer */}
                      {template.components?.find((c: any) => c.type === 'FOOTER')?.text && (
                        <div className="text-xs text-muted-foreground pt-2 border-t">
                          {template.components.find((c: any) => c.type === 'FOOTER').text}
                        </div>
                      )}
                      
                      {/* Buttons */}
                      {template.components?.filter((c: any) => c.type === 'BUTTONS').map((buttonGroup: any, idx: number) => (
                        <div key={idx} className="pt-2 border-t space-y-2">
                          {buttonGroup.buttons?.map((button: any, btnIdx: number) => (
                            <div key={btnIdx}>
                              {button.type === 'QUICK_REPLY' && (
                                <div className="text-xs bg-muted rounded px-2 py-1 inline-block">
                                  {button.text}
                                </div>
                              )}
                              {button.type === 'URL' && (
                                <div className="text-xs text-blue-500 underline">
                                  {button.text} - {button.url}
                                </div>
                              )}
                              {button.type === 'PHONE_NUMBER' && (
                                <div className="text-xs text-blue-500">
                                  {button.text} - {button.phone_number}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                      <div className="w-4 h-4 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-blue-500 text-[10px]">i</span>
                      </div>
                      <p>This is just a preview. The actual message may appear differently.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="bg-muted rounded-lg p-4 max-h-64 overflow-y-auto">
                      <p className="text-sm whitespace-pre-wrap">{campaign.messageTemplate}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This is just a preview. The actual message may appear differently.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Message Status List</h2>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={(value) => {
                setStatusFilter(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="read">Read</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="cta">CTA</SelectItem>
                    </SelectContent>
                  </Select>
              <Button
                variant="outline"
                onClick={() => resendMutation.mutate({ failedCount, pendingCount })}
                disabled={(failedCount === 0 && pendingCount === 0) || resendMutation.isPending}
              >
                {resendMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Resending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Resend{failedCount > 0 || pendingCount > 0 ? ` (${failedCount + pendingCount})` : ""}
                  </>
                )}
              </Button>
              <Button
                onClick={() => setCreateFromCampaignOpen(true)}
              >
                <PlusCircle className="w-4 h-4 mr-2" />
                Create new campaign
              </Button>
            </div>
          </div>

          {/* Dialog: Select contacts by status for new campaign */}
          <Dialog open={createFromCampaignOpen} onOpenChange={setCreateFromCampaignOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create new campaign from contacts</DialogTitle>
                <p className="text-sm text-muted-foreground">Select which status(es) to include. A new campaign form will open with those contacts.</p>
              </DialogHeader>
              <div className="space-y-3 py-4">
                {(["pending", "sent", "delivered", "read", "failed"] as const).map((status) => {
                  const count = recipients.filter(r => getLastStatus(r) === status).length;
                  return (
                    <label key={status} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={createFromCampaignStatuses.has(status)}
                        onCheckedChange={(checked) => {
                          setCreateFromCampaignStatuses(prev => {
                            const next = new Set(prev);
                            if (checked) next.add(status); else next.delete(status);
                            return next;
                          });
                        }}
                      />
                      <span className="text-sm">{STATUS_LABELS[status]}</span>
                      <span className="text-sm text-muted-foreground">({count})</span>
                    </label>
                  );
                })}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateFromCampaignOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => {
                    const selected = recipients.filter(r => createFromCampaignStatuses.has(getLastStatus(r)));
                    if (selected.length === 0) {
                      toast({ title: "Select at least one status", variant: "destructive" });
                      return;
                    }
                    const initialRecipients = selected.map(r => ({ phoneNumber: r.phoneNumber, name: r.name || undefined }));
                    setCreateFromCampaignOpen(false);
                    setCreateFromCampaignStatuses(new Set());
                    try {
                      sessionStorage.setItem("campaigns_initialRecipients", JSON.stringify(initialRecipients));
                    } catch (_) {}
                    setLocation("/campaigns");
                  }}
                >
                  Continue to campaign form
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recipientsLoading ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : paginatedRecipients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        No messages found
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedRecipients.map((recipient) => {
                      const lastStatus = getLastStatus(recipient);
                      return (
                        <TableRow key={recipient.id}>
                          <TableCell className="font-medium">{recipient.phoneNumber}</TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline"
                              style={{ 
                                backgroundColor: `${STATUS_COLORS[lastStatus]}20`,
                                color: STATUS_COLORS[lastStatus],
                                borderColor: STATUS_COLORS[lastStatus],
                              }}
                            >
                              {STATUS_LABELS[lastStatus]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {recipient.sentAt 
                              ? format(new Date(recipient.sentAt), "MM/dd/yyyy, h:mm:ss a")
                              : "-"
                            }
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Export Campaign Data Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Export Campaign Data</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={handleExportMessages}
                disabled={filteredRecipients.length === 0}
                className="w-full sm:w-auto"
              >
                <FileText className="w-4 h-4 mr-2" />
                {getExportButtonText()}
              </Button>
              <Button variant="outline" onClick={() => downloadCampaignReport("button-clicks", "Button clicks")}>
                Button Clicks
              </Button>
              <Button variant="outline" onClick={() => downloadCampaignReport("url-clicks", "URL clicks")}>
                URL Clicks
              </Button>
              <Button variant="outline" onClick={() => downloadCampaignReport("delivery", "Delivery status")}>
                Delivery Status
              </Button>
              <Button variant="outline" onClick={() => downloadCampaignReport("read", "Read status")}>
                Read Status
              </Button>
              <Button variant="outline" onClick={() => downloadCampaignReport("failed", "Failed messages")}>
                Failed Messages
              </Button>
            </CardContent>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * rowsPerPage + 1} to {Math.min(currentPage * rowsPerPage, filteredRecipients.length)} of {filteredRecipients.length} results
              </p>
              <div className="flex items-center gap-2">
                <Select value={rowsPerPage.toString()} onValueChange={(value) => {
                  setRowsPerPage(parseInt(value));
                  setCurrentPage(1);
                }}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    &lt; Previous
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next &gt;
                  </Button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Status Distribution</CardTitle>
                <p className="text-xs text-muted-foreground">Detailed breakdown of message statuses</p>
              </CardHeader>
              <CardContent>
                {statusDataForChart.some(item => item.value > 0) ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={statusDataForChart.filter(item => item.value > 0)}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {statusDataForChart.filter(item => item.value > 0).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-64 text-muted-foreground">
                    No data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Status Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Status Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {statusData.map((item) => {
                  const percentage = totalMessages > 0 ? (item.value / totalMessages) * 100 : 0;
                  return (
                    <div key={item.name} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-sm font-medium">{item.name}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">{item.value} messages</span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Activity Status Types */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Activity Status Types</CardTitle>
              <p className="text-xs text-muted-foreground">Detailed breakdown by activity type</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Read Status */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.read }} />
                      <span>Read</span>
                    </div>
                    <span className="font-medium">{funnel.read.count} ({funnel.read.percent}%)</span>
                  </div>
                  <Progress value={funnel.read.percent} className="h-2" />
                </div>

                {/* Delivered Status */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.delivered }} />
                      <span>Delivered</span>
                    </div>
                    <span className="font-medium">{funnel.delivered.count} ({funnel.delivered.percent}%)</span>
                  </div>
                  <Progress value={funnel.delivered.percent} className="h-2" />
                </div>

                {/* Sent Status */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.sent }} />
                      <span>Sent</span>
                    </div>
                    <span className="font-medium">{funnel.sent.count} ({funnel.sent.percent}%)</span>
                  </div>
                  <Progress value={funnel.sent.percent} className="h-2" />
                </div>

                {/* Pending Status */}
                {pendingCount > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.pending }} />
                        <span>Pending</span>
                      </div>
                      <span className="font-medium">{pendingCount} messages</span>
                    </div>
                    <Progress 
                      value={totalMessages > 0 ? Math.round((pendingCount / totalMessages) * 100) : 0} 
                      className="h-2"
                    />
                  </div>
                )}

                {/* Failed Status */}
                {failedCount > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.failed }} />
                        <span>Failed</span>
                      </div>
                      <span className="font-medium">{failedCount} messages</span>
                    </div>
                    <Progress 
                      value={totalMessages > 0 ? Math.round((failedCount / totalMessages) * 100) : 0} 
                      className="h-2"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

