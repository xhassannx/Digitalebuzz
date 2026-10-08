import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { AlertCircle, Loader2, RefreshCw, ChevronDown, ChevronUp, Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type WebhookLog = {
  id: string;
  eventType: string;
  field: string | null;
  payload: Record<string, unknown>;
  phoneNumberId: string | null;
  displayPhoneNumber: string | null;
  messageCount: number | null;
  statusCount: number | null;
  timestamp: string;
};

export default function WebhookLogsPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery<{ logs: WebhookLog[]; total: number }>({
    queryKey: ["/api/admin/webhook-logs", eventFilter],
    queryFn: async () => {
      const url = eventFilter === "all"
        ? "/api/admin/webhook-logs?limit=100"
        : `/api/admin/webhook-logs?limit=100&eventType=${encodeURIComponent(eventFilter)}`;
      const res = await apiRequest("GET", url);
      if (!res.ok) throw new Error("Failed to fetch webhook logs");
      return res.json();
    },
    retry: false,
  });

  if (user && !user.isSaaSOwner) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Access Denied
            </CardTitle>
            <CardContent className="pt-0">
              <Button onClick={() => setLocation("/dashboard")} variant="outline" className="w-full">
                Go to Dashboard
              </Button>
            </CardContent>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Meta Webhook Logs</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Raw webhook payloads from Meta (stored in <code className="text-xs">logs/webhook-logs/</code> as JSONL files)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={eventFilter} onValueChange={setEventFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events</SelectItem>
              <SelectItem value="messages">Messages</SelectItem>
              <SelectItem value="message_template_status_update">Template status</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load webhook logs.</p>
          </CardContent>
        </Card>
      ) : data?.logs?.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">No webhook logs yet. Logs are stored in <code className="bg-muted px-1 rounded text-xs">logs/webhook-logs/</code> as JSONL files.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data?.logs?.map((log) => (
            <Card key={log.id} className="overflow-hidden">
              <CardHeader
                className="py-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge variant={log.eventType === "messages" ? "default" : "secondary"}>
                      {log.eventType}
                    </Badge>
                    {log.phoneNumberId && (
                      <span className="text-sm text-muted-foreground">
                        Phone ID: {log.phoneNumberId}
                      </span>
                    )}
                    {log.displayPhoneNumber && (
                      <span className="text-sm text-muted-foreground">
                        {log.displayPhoneNumber}
                      </span>
                    )}
                    {log.messageCount != null && (
                      <span className="text-sm">
                        {log.messageCount} message(s)
                      </span>
                    )}
                    {log.statusCount != null && log.messageCount == null && (
                      <span className="text-sm">
                        {log.statusCount} status(es)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                    {expandedId === log.id ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </div>
              </CardHeader>
              {expandedId === log.id && (
                <CardContent className="pt-0 pb-4 border-t">
                  <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-96 mt-4">
                    {JSON.stringify(log.payload, null, 2)}
                  </pre>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
