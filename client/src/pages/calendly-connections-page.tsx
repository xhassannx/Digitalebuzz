import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
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
import { ArrowLeft, Plus, Loader2, Trash2, CheckCircle2 } from "lucide-react";
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

const CALENDLY_ICON = "/icons/calendly.svg";

export default function CalendlyConnectionsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isConnectDialogOpen, setIsConnectDialogOpen] = useState(false);
  const [connectionName, setConnectionName] = useState("calendly");
  const [personalToken, setPersonalToken] = useState("");
  const [connectPending, setConnectPending] = useState(false);

  const { data: connectedIntegrations = [], isLoading: isLoadingConnected } = useQuery<Integration[]>({
    queryKey: ["/api/integrations"],
  });

  const calendlyConnections = connectedIntegrations.filter((i) => i.name === "calendly");

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
      credentials,
      config,
    }: {
      credentials?: Record<string, any>;
      config?: Record<string, any>;
    }) => {
      const res = await apiRequest("POST", "/api/integrations", {
        name: "calendly",
        credentials,
        config,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      setIsConnectDialogOpen(false);
      setPersonalToken("");
      setConnectionName("calendly");
      setConnectPending(false);
      toast({
        title: "Integration connected",
        description: "Calendly connection has been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to connect",
      });
      setConnectPending(false);
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
        description: "Calendly connection has been disconnected.",
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
    setConnectionName("calendly");
    setPersonalToken("");
    setIsConnectDialogOpen(true);
  };

  const handleConnect = async () => {
    const trimmedToken = personalToken.trim();
    if (!trimmedToken) return;
    setConnectPending(true);
    try {
      // First verify the token
      const verifyRes = await apiRequest("POST", "/api/integrations/calendly/verify-token", {
        personalToken: trimmedToken,
      });
      const verifyData = await verifyRes.json();

      if (!verifyData.valid) {
        throw new Error(verifyData.message || "Invalid personal token");
      }

      // Token is valid, proceed with connection
      const credentials: Record<string, any> = {
        access_token: trimmedToken,
      };
      const config: Record<string, any> = {
        connectionName: connectionName.trim() || "calendly",
      };
      connectMutation.mutate({
        credentials,
        config,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to connect Calendly. Please verify your personal token is correct.",
      });
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
            <img src={CALENDLY_ICON} alt="Calendly" className="w-8 h-8 object-contain" />
            <h1 className="text-2xl font-bold">Calendly Connections</h1>
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
              {calendlyConnections.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No Calendly connections yet. Click &quot;Add Connection&quot; to connect your Calendly account.
                  </TableCell>
                </TableRow>
              ) : (
                calendlyConnections.map((conn) => (
                  <TableRow key={conn.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <img src={CALENDLY_ICON} alt="" className="w-5 h-5 object-contain" />
                        <span>{conn.config?.connectionName || conn.config?.name || "calendly"}</span>
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
            <DialogDescription>Enter your Calendly personal token to connect.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="calendly-connection-name">Connection Name</Label>
              <Input
                id="calendly-connection-name"
                value={connectionName}
                onChange={(e) => setConnectionName(e.target.value)}
                placeholder="calendly"
              />
            </div>
            <div>
              <Label htmlFor="calendly-personal-token">Personal token *</Label>
              <Input
                id="calendly-personal-token"
                type="password"
                value={personalToken}
                onChange={(e) => setPersonalToken(e.target.value)}
                placeholder="Your Calendly personal token"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Personal token which should be retrieved from Calendly.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConnectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConnect}
              disabled={
                !personalToken?.trim() ||
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
