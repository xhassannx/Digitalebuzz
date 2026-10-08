import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookOpen, ExternalLink } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type TriggerRow = { name: string; id: string; when: string };

function TriggerTable({ rows }: { rows: TriggerRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Trigger</TableHead>
          <TableHead className="w-[180px]">ID</TableHead>
          <TableHead>When it runs</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="font-medium">{r.name}</TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground">{r.id}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{r.when}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

const CONTACT_TRIGGERS: TriggerRow[] = [
  { name: "New Contact", id: "new-contact", when: "Manual create, CSV import, Facebook leads (not chat sync)." },
  { name: "Contact Updated", id: "contact-updated", when: "Meaningful CRM field updates." },
];

const WHATSAPP_TRIGGERS: TriggerRow[] = [
  { name: "Text Message Received", id: "text-message-received", when: "Inbound text or media with body." },
  { name: "List Message Reply", id: "list-message-reply", when: "User picks a list option." },
  { name: "Template Message Button Reply", id: "template-message-button-reply", when: "Template button click." },
  { name: "Interactive Message Button Reply", id: "interactive-message-button-reply", when: "Quick reply on interactive message." },
  { name: "Form Message Response", id: "form-message-response", when: "WhatsApp Flow / form submission." },
  { name: "On First Message", id: "on-first-message", when: "First inbound message from that customer in the chat." },
];

const SHOPIFY_TRIGGERS: TriggerRow[] = [
  { name: "New Order", id: "new-order", when: "orders/create — Admin: Order creation. Needs phone for WhatsApp." },
  { name: "New Paid Order", id: "new-paid-order", when: "orders/paid — Admin: Order payment. Needs phone for WhatsApp." },
  { name: "New Customer", id: "new-customer", when: "customers/create — Admin: Customer creation. Needs phone for WhatsApp." },
  {
    name: "New Abandoned Checkout",
    id: "new-abandoned-checkout",
    when: "checkouts/create + checkouts/update — needs phone; skips completed checkouts",
  },
  { name: "New Cancelled Order", id: "new-cancelled-order", when: "orders/cancelled — Admin: Order cancellation." },
  {
    name: "Updated Product",
    id: "updated-product",
    when: "products/create, products/update, products/delete",
  },
];

const CALENDLY_TRIGGERS: TriggerRow[] = [
  { name: "Event schedule", id: "event-schedule", when: "Calendly invitee.created" },
  { name: "Event canceled", id: "event-canceled", when: "invitee.canceled" },
];

const SHEETS_TRIGGERS: TriggerRow[] = [
  { name: "New spreadsheet rows", id: "new-spreadsheet-rows", when: "New row detected (poller; set spreadsheet + worksheet on trigger)." },
  { name: "New spreadsheets", id: "new-spreadsheets", when: "New spreadsheet created (webhook / manual)." },
  { name: "New worksheets", id: "new-worksheets", when: "New sheet tab in a spreadsheet." },
];

const SCHEDULER_TRIGGERS: TriggerRow[] = [
  { name: "Every N minutes", id: "every-n-minutes", when: "Repeating timer (default 5 min)." },
  { name: "Every hour", id: "every-hour", when: "Hourly." },
  { name: "Every day", id: "every-day", when: "Daily." },
  { name: "Every week", id: "every-week", when: "Weekly." },
  { name: "Every month", id: "every-month", when: "Monthly." },
];

export default function FlowsDocumentationPage() {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-domain.com";

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-8 pb-16">
        <div className="text-sm text-muted-foreground">
          <Link href="/flows" className="hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Flows
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold flex items-center gap-2">
              <BookOpen className="h-8 w-8 text-orange-500" />
              Flows documentation
            </h1>
            <p className="text-muted-foreground mt-2">
              Create automation workflows in the canvas editor, connect triggers to actions, and publish when ready.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href="/docs/FLOWS_GUIDE.md" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Markdown guide
            </a>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Creating a flow</CardTitle>
            <CardDescription>Step-by-step from the Flows list</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>
                Open <strong className="text-foreground">Flows</strong> and click <strong className="text-foreground">New Flow…</strong>.
              </li>
              <li>Choose <strong className="text-foreground">Canvas (advanced)</strong> and name your flow.</li>
              <li>Click the trigger node → <strong className="text-foreground">Configure</strong> → select an app and trigger type.</li>
              <li>Add steps with <strong className="text-foreground">+</strong> below the trigger (WhatsApp, Contact, Delay, Router, etc.).</li>
              <li>Configure each node: connection, phone/template fields, variables via <strong className="text-foreground">Insert variable</strong>.</li>
              <li>Click <strong className="text-foreground">Publish</strong> in the editor. Only <strong className="text-foreground">Active</strong> flows run.</li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Variables</CardTitle>
            <CardDescription>Use in message body, template parameters, router conditions, and contact fields</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              <code className="bg-muted px-1 rounded">{"{{trigger.phone}}"}</code>,{" "}
              <code className="bg-muted px-1 rounded">{"{{trigger.email}}"}</code>,{" "}
              <code className="bg-muted px-1 rounded">{"{{trigger.body}}"}</code> — from the trigger payload.
            </p>
            <p>
              <code className="bg-muted px-1 rounded">{"{{contact.name}}"}</code>,{" "}
              <code className="bg-muted px-1 rounded">{"{{contact.phone}}"}</code> — from CRM / enriched WhatsApp context.
            </p>
            <p>
              <code className="bg-muted px-1 rounded">{"{{raw}}"}</code> — full webhook JSON (Shopify, catch-raw-webhook, etc.).
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Webhook URL (per flow)</CardTitle>
            <CardDescription>Shown on the trigger node under Webhook</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <code className="block bg-muted p-3 rounded text-xs break-all">
              POST {origin}/api/v2/webhook/flows/&#123;flowId&#125;
            </code>
            <p className="text-sm text-muted-foreground">
              The flow must be published. Shopify sends <code className="text-xs bg-muted px-1 rounded">X-Shopify-Topic</code> automatically.
              For other apps use <code className="text-xs bg-muted px-1 rounded">?trigger=trigger-id</code> or header{" "}
              <code className="text-xs bg-muted px-1 rounded">X-Canvas-Trigger</code>. Use HTTPS in production (not localhost).
            </p>
          </CardContent>
        </Card>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Triggers reference</h2>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contact</CardTitle>
            </CardHeader>
            <CardContent>
              <TriggerTable rows={CONTACT_TRIGGERS} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">WhatsApp</CardTitle>
              <CardDescription>Select a WhatsApp Business connection on the trigger node.</CardDescription>
            </CardHeader>
            <CardContent>
              <TriggerTable rows={WHATSAPP_TRIGGERS} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Shopify</CardTitle>
              <CardDescription>
                Per-flow webhook or org URL: <code className="text-xs">{origin}/api/webhooks/shopify/&#123;integrationId&#125;</code>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TriggerTable rows={SHOPIFY_TRIGGERS} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Calendly</CardTitle>
            </CardHeader>
            <CardContent>
              <TriggerTable rows={CALENDLY_TRIGGERS} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Google Sheets</CardTitle>
            </CardHeader>
            <CardContent>
              <TriggerTable rows={SHEETS_TRIGGERS} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Scheduler</CardTitle>
              <CardDescription>No external webhook — runs on a timer while the server is up.</CardDescription>
            </CardHeader>
            <CardContent>
              <TriggerTable rows={SCHEDULER_TRIGGERS} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Other integrations</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                <strong className="text-foreground">Webhook:</strong> catch-raw-webhook — any JSON body.
              </p>
              <p>
                <strong className="text-foreground">Zoom:</strong> zoom-webhook.
              </p>
              <p>
                <strong className="text-foreground">WooCommerce:</strong> product/order/coupon/customer events — webhook{" "}
                <code className="text-xs bg-muted px-1 rounded">/api/webhooks/woocommerce/&#123;integrationId&#125;</code>
              </p>
              <p>
                <strong className="text-foreground">IndiaMart / TradeIndia / JustDial:</strong> new-lead, tradeindia-new-lead,
                justdial-new-lead — use webhook URLs from Integrations.
              </p>
              <p>
                <strong className="text-foreground">Razorpay:</strong> order-paid, payment-captured —{" "}
                <code className="text-xs bg-muted px-1 rounded">/api/webhooks/razorpay/flows/&#123;integrationId&#125;</code>
              </p>
              <p>
                <strong className="text-foreground">Google Calendar:</strong> new-event (calendar push).
              </p>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Router &amp; actions</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>
              <strong className="text-foreground">Router</strong> — Branch 1 runs when the condition is true (e.g.{" "}
              <code className="bg-muted px-1 rounded">{"{{trigger.body}} contains 'order'"}</code>); otherwise the
              Otherwise branch runs.
            </p>
            <p>
              <strong className="text-foreground">Supported actions</strong> include Delay, WhatsApp send/template/media,
              Contact create/update/get/note/assign, OpenAI, Gemini, Google Sheets create row, Google Contacts create,
              Calendly custom request and cancel event.
            </p>
          </CardContent>
        </Card>

        <div className="flex justify-center pt-4">
          <Button asChild className="bg-orange-500 hover:bg-orange-600">
            <Link href="/flows">Go to Flows</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
