import { useQuery } from "@tanstack/react-query";
import { ApiEndpointCard } from "@/components/api-endpoint-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, RefreshCw, Download, Loader2 } from "lucide-react";
import { useState } from "react";
import type { ApiEndpoint } from "@shared/schema";

export default function ApiDocsPage() {
  const [apiKey] = useState("whatsapp_api_key_" + Math.random().toString(36).substring(2, 15));
  const [copiedKey, setCopiedKey] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const { data: config, isLoading } = useQuery<{ baseUrl: string; endpoints: ApiEndpoint[] }>({
    queryKey: ["/api/api-docs/config"],
    queryFn: async () => {
      const res = await fetch("/api/api-docs/config", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load API config");
      return res.json();
    },
  });

  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const postmanCollectionUrl = "/api/api-docs/postman-collection";

  const baseUrl = config?.baseUrl || "https://your-domain.com";
  const endpoints = config?.endpoints || [];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8" data-testid="page-api-docs">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold mb-2">API Documentation</h1>
          <p className="text-muted-foreground">
            Complete API reference for WhatsApp integration
          </p>
        </div>
        <Button variant="outline" className="shrink-0" asChild>
          <a href={postmanCollectionUrl} download="whatsapp-panel-api-postman-collection.json">
            <Download className="h-4 w-4 mr-2" />
            Download Postman Collection
          </a>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Base URL</CardTitle>
          <CardDescription>
            All API requests should be made to this base URL
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono">
              {isLoading ? "Loading..." : baseUrl}
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                navigator.clipboard.writeText(baseUrl);
                setCopiedKey(true);
                setTimeout(() => setCopiedKey(false), 2000);
              }}
              disabled={isLoading}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Authentication</CardTitle>
          <CardDescription>
            Use an API key to authenticate your requests. Create keys in Settings → API Keys.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Project API (external integrations)</p>
            <p className="text-xs text-muted-foreground">
              Include in header: <code className="bg-muted px-1 py-0.5 rounded">X-API-Key: YOUR_API_KEY</code>
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Dashboard API</p>
            <p className="text-xs text-muted-foreground">
              Include in header: <code className="bg-muted px-1 py-0.5 rounded">Authorization: Bearer YOUR_API_KEY</code>
            </p>
          </div>
          <div className="flex gap-2">
            <Input
              value={showKey ? apiKey : '••••••••••••••••••••'}
              readOnly
              className="font-mono text-sm"
              data-testid="input-api-key"
            />
            <Button variant="outline" onClick={() => setShowKey(!showKey)} data-testid="button-toggle-key">
              {showKey ? 'Hide' : 'Show'}
            </Button>
            <Button variant="outline" onClick={handleCopyKey} data-testid="button-copy-key">
              {copiedKey ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-xl font-semibold">Available Endpoints ({endpoints.length})</h2>
          <a href="/project-api" className="text-sm text-primary hover:underline">
            Full Project API docs with examples →
          </a>
        </div>
        <p className="text-sm text-muted-foreground">
          Click the expand icon (▼) on each endpoint to see request payload, cURL example, and response. Project API endpoints are expanded by default.
        </p>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {endpoints.map((endpoint, index) => (
              <ApiEndpointCard key={`${endpoint.method}-${endpoint.path}-${index}`} endpoint={endpoint} />
            ))}
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
          <CardDescription>
            Follow these steps to integrate WhatsApp messaging into your application
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold flex-shrink-0">
                1
              </div>
              <div>
                <p className="font-medium">Create a Session</p>
                <p className="text-sm text-muted-foreground">
                  Use the <code className="bg-muted px-1 py-0.5 rounded">/api/sessions/create</code> endpoint to generate a QR code
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold flex-shrink-0">
                2
              </div>
              <div>
                <p className="font-medium">Scan QR Code</p>
                <p className="text-sm text-muted-foreground">
                  Open WhatsApp on your phone and scan the QR code from the response
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold flex-shrink-0">
                3
              </div>
              <div>
                <p className="font-medium">Send Messages</p>
                <p className="text-sm text-muted-foreground">
                  Once connected, use the send-text or send-media endpoints to send messages
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
