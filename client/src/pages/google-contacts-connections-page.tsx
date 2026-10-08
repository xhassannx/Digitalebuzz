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
import { ArrowLeft, Plus, Loader2, Trash2, CheckCircle2, Copy } from "lucide-react";
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

const GOOGLE_CONTACTS_ICON = "/icons/google-contact.png";

export default function GoogleContactsConnectionsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isConnectDialogOpen, setIsConnectDialogOpen] = useState(false);
  const [connectionName, setConnectionName] = useState("google-contacts");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [redirectUri, setRedirectUri] = useState("");
  const [connectPending, setConnectPending] = useState(false);

  const { data: connectedIntegrations = [], isLoading: isLoadingConnected } = useQuery<Integration[]>({
    queryKey: ["/api/integrations"],
  });

  const googleContactsConnections = connectedIntegrations.filter((i) => i.name === "google-contacts");

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
      toast({
        title: "Connection removed",
        description: "Google Contacts connection has been disconnected.",
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
    setConnectionName("google-contacts");
    setClientId("");
    setClientSecret("");
    try {
      const res = await apiRequest("GET", `/api/integrations/google/google-contacts/oauth/redirect-uri`);
      const data = await res.json();
      setRedirectUri(data.redirectUri || `${window.location.origin}/api/integrations/google/google-contacts/oauth/callback`);
    } catch {
      setRedirectUri(`${window.location.origin}/api/integrations/google/google-contacts/oauth/callback`);
    }
    setIsConnectDialogOpen(true);
  };

  const handleConnect = async () => {
    const trimmedClientId = clientId.trim();
    const trimmedClientSecret = clientSecret.trim();
    if (!trimmedClientId || !trimmedClientSecret) return;
    setConnectPending(true);
    try {
      const res = await apiRequest("POST", "/api/integrations/google/google-contacts/oauth/authorize", {
        clientId: trimmedClientId,
        clientSecret: trimmedClientSecret,
        connectionName: connectionName.trim() || "google-contacts",
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
        description: error.message || "Failed to initiate Google Contacts connection",
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
            <img src={GOOGLE_CONTACTS_ICON} alt="Google Contacts" className="w-8 h-8 object-contain" />
            <h1 className="text-2xl font-bold">Google Contacts Connections</h1>
          </div>
        </div>
        <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={openAddModal}>
          <Plus className="h-4 w-4 mr-2" />
          Add Connection
        </Button>
      </div>

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
              {googleContactsConnections.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No Google Contacts connections yet. Click &quot;Add Connection&quot; to connect your Google Contacts account.
                  </TableCell>
                </TableRow>
              ) : (
                googleContactsConnections.map((conn) => (
                  <TableRow key={conn.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <img src={GOOGLE_CONTACTS_ICON} alt="" className="w-5 h-5 object-contain" />
                        <span>{conn.config?.connectionName || conn.config?.name || "google-contacts"}</span>
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
            <DialogDescription>Enter your Google Cloud OAuth credentials to connect Google Contacts.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="gct-connection-name">Connection Name</Label>
              <Input
                id="gct-connection-name"
                value={connectionName}
                onChange={(e) => setConnectionName(e.target.value)}
                placeholder="google-contacts"
              />
            </div>
            <div>
              <Label htmlFor="gct-redirect-uri">OAuth Redirect URL *</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="gct-redirect-uri"
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
              <Label htmlFor="gct-client-id">Client ID *</Label>
              <Input
                id="gct-client-id"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Your Google OAuth Client ID"
                autoComplete="off"
              />
            </div>
            <div>
              <Label htmlFor="gct-client-secret">Client Secret *</Label>
              <Input
                id="gct-client-secret"
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
