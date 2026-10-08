import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WebhookManager } from "@/components/webhook-manager";
import { Webhook, ArrowRight, Server, Globe, Shield } from "lucide-react";

export default function WebhookEventsPage() {
  return (
    <div
      className="atlas-manage-page atlas-webhooks-page container mx-auto p-6 space-y-6"
      data-testid="page-webhook-events"
    >
      <div className="rh-page-hero space-y-2">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Webhook className="h-8 w-8" />
          Webhooks
        </h1>
        <p className="text-muted-foreground">
          Configure endpoints to receive real-time WhatsApp events (messages, session, chat) at your URL.
        </p>
      </div>

      {/* How webhooks work */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            How webhooks work
          </CardTitle>
          <CardDescription>
            Event flow from WhatsApp to your server
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">WhatsApp</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-muted">
              <Server className="h-4 w-4" />
              Our server
            </span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-muted">
              <Globe className="h-4 w-4" />
              Your URL
            </span>
          </div>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">WhatsApp</strong> sends events (incoming message, delivery status, etc.) to our server at <code className="bg-muted px-1 rounded text-xs">/api/webhooks/whatsapp-business</code>.
            </li>
            <li>
              <strong className="text-foreground">Our server</strong> processes the event and forwards it to every webhook URL you configure below that is subscribed to that event type.
            </li>
            <li>
              <strong className="text-foreground">Your URL</strong> receives a POST request with JSON body <code className="bg-muted px-1 rounded text-xs">&#123; event, timestamp, data &#125;</code>. Use the <strong>signing secret</strong> (shown for each webhook) to verify the <code className="bg-muted px-1 rounded text-xs">X-Webhook-Signature</code> header (HMAC-SHA256).
            </li>
          </ol>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Shield className="h-4 w-4 text-green-600" />
            Always verify the signature on your endpoint to ensure the request came from us.
          </p>
        </CardContent>
      </Card>

      <WebhookManager />
    </div>
  );
}
