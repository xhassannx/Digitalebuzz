import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClearableDateInput } from "@/components/ui/clearable-date-input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, Loader2, Trash2, CheckCircle2, ChevronDown, ChevronRight, Download, AlertCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Integration = {
  id?: string;
  name: string;
  displayName: string;
  config?: Record<string, any>;
  credentials?: Record<string, any>;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
};

type FacebookPage = {
  id: string;
  name: string;
  category?: string;
};

type FacebookForm = {
  id: string;
  name: string;
  status: string;
  leads_count?: number;
};

const FACEBOOK_ICON = "/icons/facebook.svg";

export default function FacebookLeadAdsConnectionsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [expandedConnectionId, setExpandedConnectionId] = useState<string | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string>("");
  const [selectedFormId, setSelectedFormId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const { data: connectedIntegrations = [], isLoading: isLoadingConnected } = useQuery<Integration[]>({
    queryKey: ["/api/integrations"],
  });

  const facebookConnections = connectedIntegrations.filter((i) => i.name === "facebook-lead-ads");

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return "—";
    }
  };

  const disconnectMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      await apiRequest("DELETE", `/api/integrations/${integrationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      setExpandedConnectionId(null);
      toast({
        title: "Connection removed",
        description: "Facebook Lead Ads connection has been disconnected.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to disconnect",
      });
    },
  });

  const handleDisconnect = (conn: Integration) => {
    if (conn.id) disconnectMutation.mutate(conn.id);
  };

  const [connectPending, setConnectPending] = useState(false);

  const handleConnect = async () => {
    try {
      setConnectPending(true);
      const res = await apiRequest("GET", `/api/integrations/facebook-lead-ads/oauth/authorize`);
      const data = await res.json();
      if (data.authUrl) {
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        const popup = window.open(
          data.authUrl,
          "Facebook OAuth",
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
        );
        const messageHandler = (event: MessageEvent) => {
          if (event.data?.type === "FACEBOOK_OAUTH_SUCCESS") {
            window.removeEventListener("message", messageHandler);
            popup?.close();
            queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
            toast({ title: "Connected", description: "Facebook Lead Ads connection added." });
          } else if (event.data?.type === "FACEBOOK_OAUTH_ERROR") {
            window.removeEventListener("message", messageHandler);
            popup?.close();
            toast({ variant: "destructive", title: "Connection failed", description: event.data.error });
          }
        };
        window.addEventListener("message", messageHandler);
        const check = setInterval(() => {
          if (popup?.closed) {
            clearInterval(check);
            window.removeEventListener("message", messageHandler);
          }
        }, 500);
        setTimeout(() => {
          clearInterval(check);
          window.removeEventListener("message", messageHandler);
          popup?.close();
        }, 5 * 60 * 1000);
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setConnectPending(false);
    }
  };

  if (isLoadingConnected) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-[95%] mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/integrations")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <img src={FACEBOOK_ICON} alt="Facebook" className="w-8 h-8 object-contain" />
            <h1 className="text-2xl font-bold">Facebook Lead Ads Connections</h1>
          </div>
        </div>
        <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleConnect} disabled={connectPending}>
          {connectPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
          Add Connection
        </Button>
      </div>

      <Card className="border-2">
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Connection</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {facebookConnections.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No Facebook Lead Ads connections yet. Go to Integrations and click &quot;Connect&quot; on Facebook Lead Ads to add a connection.
                  </TableCell>
                </TableRow>
              ) : (
                facebookConnections.map((conn) => (
                  <ConnectionRow
                    key={conn.id}
                    conn={conn}
                    formatDate={formatDate}
                    isExpanded={expandedConnectionId === conn.id}
                    onToggle={() => setExpandedConnectionId((v) => (v === conn.id ? null : conn.id ?? null))}
                    onDisconnect={() => handleDisconnect(conn)}
                    disconnectPending={disconnectMutation.isPending}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ConnectionRow({
  conn,
  formatDate,
  isExpanded,
  onToggle,
  onDisconnect,
  disconnectPending,
}: {
  conn: Integration;
  formatDate: (s?: string) => string;
  isExpanded: boolean;
  onToggle: () => void;
  onDisconnect: () => void;
  disconnectPending: boolean;
}) {
  const { toast } = useToast();
  const [selectedPageId, setSelectedPageId] = useState<string>("");
  const [selectedFormId, setSelectedFormId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const { data: pagesData, isLoading: isLoadingPages } = useQuery<{
    success: boolean;
    pages: FacebookPage[];
    count: number;
  }>({
    queryKey: ["/api/integrations/facebook-lead-ads/pages", conn.id, isExpanded],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/integrations/facebook-lead-ads/pages?integrationId=${conn.id}`);
      return res.json();
    },
    enabled: isExpanded && !!conn.id,
  });

  const { data: formsData, isLoading: isLoadingForms } = useQuery<{
    success: boolean;
    forms: FacebookForm[];
    count: number;
  }>({
    queryKey: ["/api/integrations/facebook-lead-ads/forms", selectedPageId, conn.id, isExpanded],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/integrations/facebook-lead-ads/forms/${selectedPageId}?integrationId=${conn.id}`);
      return res.json();
    },
    enabled: isExpanded && !!conn.id && !!selectedPageId,
  });

  const syncLeadsMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = {
        integrationId: conn.id!,
        pageId: selectedPageId,
        formId: selectedFormId,
      };
      if (startDate) body.startDate = startDate;
      if (endDate) body.endDate = endDate;
      const res = await apiRequest("POST", "/api/integrations/facebook-lead-ads/sync-leads", body);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      const created = data.syncedContactsCount || 0;
      const updated = data.updatedContactsCount || 0;
      toast({
        title: "Leads synced successfully",
        description: `Processed ${data.count || 0} leads. ${created} created, ${updated} updated.`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Sync failed",
        description: error.message || "Failed to sync leads.",
      });
    },
  });

  const pages = pagesData?.pages || [];
  const forms = formsData?.forms || [];

  return (
    <>
      <TableRow>
        <TableCell className="w-10">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onToggle}
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <img src={FACEBOOK_ICON} alt="" className="w-5 h-5 object-contain" />
            <span>{conn.config?.name || conn.config?.userId || "Facebook Lead Ads"}</span>
          </div>
        </TableCell>
        <TableCell>
          <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Connected
          </Badge>
        </TableCell>
        <TableCell>{formatDate(conn.createdAt)}</TableCell>
        <TableCell>{formatDate(conn.updatedAt)}</TableCell>
        <TableCell className="text-right">
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={onDisconnect}
            disabled={disconnectPending}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </TableCell>
      </TableRow>
      {isExpanded && conn.id && (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/30 p-6">
            <div className="space-y-4">
              <h4 className="font-medium">Facebook Pages</h4>
              {isLoadingPages ? (
                <div className="flex items-center gap-2 py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading pages...
                </div>
              ) : pages.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <p>No Facebook pages found.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Select Page</label>
                    <Select value={selectedPageId} onValueChange={(v) => { setSelectedPageId(v); setSelectedFormId(""); }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a Facebook page" />
                      </SelectTrigger>
                      <SelectContent>
                        {pages.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} {p.category && `(${p.category})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedPageId && (
                    <>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Select Lead Form</label>
                        {isLoadingForms ? (
                          <div className="flex items-center gap-2 py-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading forms...
                          </div>
                        ) : forms.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No lead forms found for this page.</p>
                        ) : (
                          <Select value={selectedFormId} onValueChange={setSelectedFormId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a lead form" />
                            </SelectTrigger>
                            <SelectContent>
                              {forms.filter((f) => f.status === "ACTIVE").map((f) => (
                                <SelectItem key={f.id} value={f.id}>
                                  {f.name} {f.leads_count != null && `(${f.leads_count} leads)`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      {selectedFormId && (
                        <div className="flex flex-wrap items-center gap-2">
                          <ClearableDateInput
                            showCalendarIcon={false}
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="h-9 w-[160px] text-sm"
                          />
                          <ClearableDateInput
                            showCalendarIcon={false}
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="h-9 w-[160px] text-sm"
                          />
                          <Button
                            size="sm"
                            onClick={() => syncLeadsMutation.mutate()}
                            disabled={syncLeadsMutation.isPending}
                          >
                            {syncLeadsMutation.isPending ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Syncing...
                              </>
                            ) : (
                              <>
                                <Download className="h-4 w-4 mr-2" />
                                Sync Leads
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
