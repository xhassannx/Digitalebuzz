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
import { ArrowLeft, Plus, Loader2, Edit, Trash2, CheckCircle2 } from "lucide-react";
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

const GEMINI_ICON = "/icons/gemini.jpg";
const INTEGRATION_NAME = "google-gemini" as const;

export default function GoogleGeminiConnectionsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [editingIntegrationId, setEditingIntegrationId] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [connectionName, setConnectionName] = useState("google-gemini");

  const { data: availableIntegrations = [], isLoading: isLoadingAvailable } = useQuery<Integration[]>({
    queryKey: ["/api/integrations/available"],
  });

  const { data: connectedIntegrations = [], isLoading: isLoadingConnected } = useQuery<Integration[]>({
    queryKey: ["/api/integrations"],
  });

  const geminiConnections = connectedIntegrations.filter((i) => i.name === INTEGRATION_NAME);
  const geminiDefinition = availableIntegrations.find((i) => i.name === INTEGRATION_NAME);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return "—";
    }
  };

  const connectMutation = useMutation({
    mutationFn: async ({
      integrationId,
      credentials,
      config,
    }: {
      integrationId?: string | null;
      credentials?: Record<string, any>;
      config?: Record<string, any>;
    }) => {
      if (integrationId) {
        const res = await apiRequest("PUT", `/api/integrations/${integrationId}`, {
          config,
          ...(credentials && Object.keys(credentials).length > 0 ? { credentials } : {}),
        });
        return res.json();
      }
      const res = await apiRequest("POST", "/api/integrations", {
        name: INTEGRATION_NAME,
        credentials,
        config,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      setIsConfigDialogOpen(false);
      setEditingIntegrationId(null);
      setApiKey("");
      setConnectionName("google-gemini");
      toast({
        title: "Integration connected",
        description: "Google Gemini connection has been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to connect",
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
        description: "Google Gemini connection has been disconnected.",
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

  const openAddModal = () => {
    setEditingIntegrationId(null);
    setApiKey("");
    setConnectionName("google-gemini");
    setIsConfigDialogOpen(true);
  };

  const openManageModal = (conn: Integration) => {
    setEditingIntegrationId(conn.id || null);
    setConnectionName(conn.config?.connectionName || "google-gemini");
    setApiKey("");
    setIsConfigDialogOpen(true);
  };

  const handleConfigSubmit = () => {
    if (!geminiDefinition) return;
    const credentials: Record<string, any> = {};
    const config: Record<string, any> = {};
    if (apiKey) credentials.apiKey = apiKey;
    config.connectionName = connectionName?.trim() || "google-gemini";

    if (!editingIntegrationId && Object.keys(credentials).length === 0) {
      toast({
        variant: "destructive",
        title: "API key required",
        description: "Enter your Gemini API key to connect.",
      });
      return;
    }

    connectMutation.mutate({
      integrationId: editingIntegrationId,
      credentials: Object.keys(credentials).length > 0 ? credentials : undefined,
      config,
    });
  };

  const submitDisabled = connectMutation.isPending || (!editingIntegrationId && !apiKey?.trim());

  if (isLoadingAvailable || isLoadingConnected) {
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
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/integrations")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">Integrations</p>
          <h1 className="text-2xl font-bold">Google Gemini Connections</h1>
        </div>
      </div>

      <Card className="border-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <img src={GEMINI_ICON} alt="Google Gemini" className="w-8 h-8 object-contain" />
              <CardTitle className="text-xl">Google Gemini</CardTitle>
            </div>
            {geminiConnections.length === 0 ? (
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={openAddModal}>
                <Plus className="h-4 w-4 mr-2" />
                Add Connection
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground max-w-md text-right">
                One connection per workspace. Use Manage to update the key or name, or remove it to add a new one.
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent>
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
              {geminiConnections.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No Google Gemini connection yet. Click &quot;Add Connection&quot; and paste an API key from Google AI
                    Studio.
                  </TableCell>
                </TableRow>
              ) : (
                geminiConnections.map((conn) => (
                  <TableRow key={conn.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <img src={GEMINI_ICON} alt="" className="w-5 h-5 object-contain" />
                        <span>{conn.config?.connectionName || "google-gemini"}</span>
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
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => openManageModal(conn)}>
                          <Edit className="h-4 w-4 mr-1" />
                          Manage
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDisconnect(conn)}
                          disabled={disconnectMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={isConfigDialogOpen}
        onOpenChange={(open) => {
          setIsConfigDialogOpen(open);
          if (!open) setEditingIntegrationId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingIntegrationId ? "Edit connection" : "Connect"}</DialogTitle>
            <DialogDescription>
              {editingIntegrationId
                ? "Update connection name or API key. Leave API key blank to keep the current key."
                : "Enter your Google AI Studio / Gemini API key."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="gemini-connection-name">Connection Name</Label>
              <Input
                id="gemini-connection-name"
                value={connectionName}
                onChange={(e) => setConnectionName(e.target.value)}
                placeholder="google-gemini"
              />
            </div>
            <div>
              <Label htmlFor="gemini-api-key">{editingIntegrationId ? "API Key (optional)" : "API Key *"}</Label>
              <Input
                id="gemini-api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIza…"
              />
              <p className="text-xs text-muted-foreground mt-1">Create a key in Google AI Studio (Gemini API).</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfigDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfigSubmit} disabled={submitDisabled}>
              {connectMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {editingIntegrationId ? "Saving..." : "Connecting..."}
                </>
              ) : editingIntegrationId ? (
                "Save"
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
