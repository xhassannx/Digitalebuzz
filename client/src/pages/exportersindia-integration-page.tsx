import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, Copy, RefreshCw } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const EXPORTERSINDIA_ICON = "/icons/expertsindia.ico";

export default function ExportersIndiaIntegrationPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [webhookUrl, setWebhookUrl] = useState("");
  const [accessToken, setAccessToken] = useState("");

  // Fetch integration details and webhook URL
  const { data: integrationData, isLoading: isLoadingIntegration } = useQuery({
    queryKey: ["/api/integrations/exportersindia/config"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/integrations/exportersindia/config");
      if (!res.ok) {
        if (res.status === 404) {
          return null; // Integration not configured yet
        }
        throw new Error("Failed to fetch ExportersIndia configuration");
      }
      return await res.json();
    },
  });

  // Fetch webhook URL
  const { data: webhookData, isLoading: isLoadingWebhook } = useQuery({
    queryKey: ["/api/integrations/exportersindia/webhook-url"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/integrations/exportersindia/webhook-url");
      if (!res.ok) {
        throw new Error("Failed to fetch webhook URL");
      }
      return await res.json();
    },
    enabled: !!integrationData,
  });

  useEffect(() => {
    if (webhookData?.webhookUrl) {
      setWebhookUrl(webhookData.webhookUrl);
    }
    if (integrationData?.accessToken) {
      setAccessToken(integrationData.accessToken);
    }
  }, [webhookData, integrationData]);

  // Regenerate token mutation
  const regenerateTokenMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/integrations/exportersindia/regenerate-token");
      if (!res.ok) {
        throw new Error("Failed to regenerate token");
      }
      return await res.json();
    },
    onSuccess: (data) => {
      setAccessToken(data.accessToken);
      if (data.webhookUrl) {
        setWebhookUrl(data.webhookUrl);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/exportersindia/config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/exportersindia/webhook-url"] });
      toast({
        title: "Token regenerated",
        description: "New access token has been generated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to regenerate token",
      });
    },
  });

  const copyWebhookUrl = () => {
    if (webhookUrl) {
      navigator.clipboard.writeText(webhookUrl);
      toast({
        title: "Copied",
        description: "Webhook URL copied to clipboard.",
      });
    }
  };

  const copyToken = () => {
    if (accessToken) {
      navigator.clipboard.writeText(accessToken);
      toast({
        title: "Copied",
        description: "Access token copied to clipboard.",
      });
    }
  };

  if (isLoadingIntegration || isLoadingWebhook) {
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
    <div className="container mx-auto p-6 md:p-8 max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/integrations")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <img src={EXPORTERSINDIA_ICON} alt="ExportersIndia" className="w-8 h-8 object-contain" />
            <h1 className="text-2xl font-bold">Exporters India Push API Integration</h1>
          </div>
        </div>
      </div>

      <Card className="border-2">
        <CardHeader>
          <CardTitle>Set up real-time lead notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="text-muted-foreground mb-4">
              Set up real-time lead notifications using Exporters India&apos;s Push API integration.
            </p>
          </div>

          {/* Webhook URL */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Webhook URL</label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={webhookUrl || "Configure integration first"}
                className="flex-1 bg-muted font-mono text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={copyWebhookUrl}
                disabled={!webhookUrl}
                title="Copy URL"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Copy this URL and paste it in your Exporters India account settings.
            </p>
          </div>

          {/* Setup Steps */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Push API Setup Steps</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>Log in to your Exporters India account</li>
              <li>Go to My Enquiries → CRM Integration</li>
              <li>Enable the Push API integration option</li>
              <li>Copy and paste the webhook URL shown above into the Webhook URL field</li>
              <li>Save the settings to activate the integration</li>
              <li>Save the settings to start receiving real-time leads</li>
            </ol>
          </div>

          {/* Access Token Display (if configured) */}
          {accessToken && (
            <div className="space-y-2 pt-4 border-t">
              <label className="text-sm font-medium">Access Token</label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  type="password"
                  value={accessToken}
                  className="flex-1 bg-muted font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={copyToken}
                  title="Copy Token"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => regenerateTokenMutation.mutate()}
                  disabled={regenerateTokenMutation.isPending}
                >
                  {regenerateTokenMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Regenerating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Regenerate Token
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                This token is used to authenticate webhook requests from Exporters India.
              </p>
            </div>
          )}

          {!integrationData && (
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-4">
                ExportersIndia integration is not configured yet. Please configure it from the Integrations page.
              </p>
              <Button onClick={() => setLocation("/integrations")}>
                Go to Integrations
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
