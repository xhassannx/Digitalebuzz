import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Plus, Loader2, Trash2, CheckCircle2, Copy, FileSpreadsheet } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Integration = {
  id?: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  authType: string;
  status?: "connected" | "not_connected" | "error";
  config?: Record<string, any>;
  credentials?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
};

const GOOGLE_SHEETS_ICON = "/icons/icon_1_spreadsheet_x32.png";

export default function GoogleSheetsConnectionsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isConnectDialogOpen, setIsConnectDialogOpen] = useState(false);
  const [connectionName, setConnectionName] = useState("google-sheets");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [redirectUri, setRedirectUri] = useState("");
  const [connectPending, setConnectPending] = useState(false);

  const { data: connectedIntegrations = [], isLoading: isLoadingConnected } = useQuery<Integration[]>({
    queryKey: ["/api/integrations"],
  });

  const googleSheetsConnections = connectedIntegrations.filter((i) => i.name === "google-sheets");

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return "—";
    }
  };

  const demoChatbotMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/chatbots/demo-google-sheet", {});
      return res.json() as Promise<{ chatbot?: { id: string }; message?: string }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chatbots"] });
      toast({
        title: "Demo chatbot ready",
        description: data?.message || "Open Chatbots and edit the new demo flow.",
      });
      if (data?.chatbot?.id) {
        setLocation(`/chatbots/${data.chatbot.id}`);
      }
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Could not create demo",
        description: error.message || "Connect Google Sheets and WhatsApp first.",
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      await apiRequest("DELETE", `/api/integrations/${integrationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      toast({
        title: "Connection removed",
        description: "Google Sheets connection has been disconnected.",
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

  const openAddModal = async () => {
    setConnectionName("google-sheets");
    setClientId("");
    setClientSecret("");
    try {
      const res = await apiRequest("GET", `/api/integrations/google/google-sheets/oauth/redirect-uri`);
      const data = await res.json();
      setRedirectUri(data.redirectUri || `${window.location.origin}/api/integrations/google/google-sheets/oauth/callback`);
    } catch {
      setRedirectUri(`${window.location.origin}/api/integrations/google/google-sheets/oauth/callback`);
    }
    setIsConnectDialogOpen(true);
  };

  const handleConnect = async () => {
    const trimmedClientId = clientId.trim();
    const trimmedClientSecret = clientSecret.trim();
    if (!trimmedClientId || !trimmedClientSecret) return;
    setConnectPending(true);
    try {
      const res = await apiRequest("POST", "/api/integrations/google/google-sheets/oauth/authorize", {
        clientId: trimmedClientId,
        clientSecret: trimmedClientSecret,
        connectionName: connectionName.trim() || "google-sheets",
      });
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
        return;
      }
      throw new Error("No auth URL returned");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to initiate Google Sheets connection",
      });
      setConnectPending(false);
    }
  };

  const copyRedirectUri = () => {
    if (redirectUri) {
      navigator.clipboard.writeText(redirectUri);
      toast({ title: "Copied", description: "Redirect URL copied to clipboard." });
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
            <img src={GOOGLE_SHEETS_ICON} alt="Google Sheets" className="w-8 h-8 object-contain" />
            <h1 className="text-2xl font-bold">Google Sheets Connections</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={googleSheetsConnections.length === 0 || demoChatbotMutation.isPending}
            onClick={() => demoChatbotMutation.mutate()}
            title="Creates a published demo chatbot using your connected Google account"
          >
            {demoChatbotMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4 mr-2" />
            )}
            Try demo chatbot (Sheets)
          </Button>
          <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={openAddModal}>
            <Plus className="h-4 w-4 mr-2" />
            Add Connection
          </Button>
        </div>
      </div>

      {googleSheetsConnections.length > 0 ? (
        <Card className="border border-dashed bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Try it without building from scratch</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Creates a <strong className="text-foreground">published</strong> demo chatbot:{" "}
              <strong className="text-foreground">On Message</strong> → <strong className="text-foreground">10 short questions</strong> →{" "}
              <strong className="text-foreground">Append to Google Sheet</strong>. It uses{" "}
              <strong className="text-foreground">your</strong> Google Sheets connection and{" "}
              <strong className="text-foreground">your</strong> WhatsApp session. If Google Drive API is enabled, the first spreadsheet in your Drive is
              pre-selected when possible.
            </p>
            <p className="text-xs">
              In your sheet, use row 1 headers: <code className="text-xs bg-muted px-1 rounded">Phone</code>,{" "}
              <code className="text-xs bg-muted px-1 rounded">Name</code>, then{" "}
              <code className="text-xs bg-muted px-1 rounded">Reply 01</code> … <code className="text-xs bg-muted px-1 rounded">Reply 10</code>, or click{" "}
              <strong className="text-foreground">Fetch fields</strong> in the builder after opening the last step.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={demoChatbotMutation.isPending}
              onClick={() => demoChatbotMutation.mutate()}
            >
              {demoChatbotMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
              Create demo chatbot now
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-2">
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Connection</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {googleSheetsConnections.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No Google Sheets connections yet. Click &quot;Add Connection&quot; to connect your Google Sheets account.
                  </TableCell>
                </TableRow>
              ) : (
                googleSheetsConnections.map((conn) => (
                  <TableRow key={conn.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <img src={GOOGLE_SHEETS_ICON} alt="" className="w-5 h-5 object-contain" />
                        <span>{conn.config?.connectionName || conn.config?.name || "google-sheets"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Verified
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(conn.createdAt)}</TableCell>
                    <TableCell>{formatDate(conn.updatedAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDisconnect(conn)}
                        disabled={disconnectMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Connect Dialog */}
      <Dialog open={isConnectDialogOpen} onOpenChange={setIsConnectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect</DialogTitle>
            <DialogDescription>Enter your Google Cloud OAuth credentials to connect Google Sheets.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="gs-connection-name">Connection Name</Label>
              <Input
                id="gs-connection-name"
                value={connectionName}
                onChange={(e) => setConnectionName(e.target.value)}
                placeholder="google-sheets"
              />
            </div>
            <div>
              <Label htmlFor="gs-redirect-uri">OAuth Redirect URL *</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="gs-redirect-uri"
                  readOnly
                  value={redirectUri}
                  className="flex-1 bg-muted font-mono text-sm"
                />
                <Button type="button" variant="outline" size="icon" onClick={copyRedirectUri} title="Copy URL">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                When asked to input a redirect URL in Google Cloud, enter the URL above.
              </p>
            </div>
            <div>
              <Label htmlFor="gs-client-id">Client ID *</Label>
              <Input
                id="gs-client-id"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Your Google OAuth Client ID"
                autoComplete="off"
              />
            </div>
            <div>
              <Label htmlFor="gs-client-secret">Client Secret *</Label>
              <Input
                id="gs-client-secret"
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="Your Google OAuth Client Secret"
                autoComplete="off"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConnectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConnect}
              disabled={
                !clientId?.trim() ||
                !clientSecret?.trim() ||
                connectPending
              }
            >
              {connectPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
