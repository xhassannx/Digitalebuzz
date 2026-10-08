import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  BookOpen,
  ShoppingBag,
  Package,
  LayoutList,
  Layers,
  GitBranch,
  CreditCard,
  MessageSquare,
  Bot,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
      {steps.map((step, i) => (
        <li key={i} dangerouslySetInnerHTML={{ __html: step }} />
      ))}
    </ol>
  );
}

const COMPARE_ROWS = [
  {
    feature: "Single product",
    where: "Inbox → shopping bag icon → Single product tab",
    window: "24-hour chat window",
    approval: "No",
  },
  {
    feature: "Product list (2–30 items)",
    where: "Inbox → Product list tab, or Commerce → Catalog broadcast",
    window: "24-hour chat window",
    approval: "No",
  },
  {
    feature: "Product carousel (swipe cards)",
    where: "Templates → Create → Product Card Carousel",
    window: "Any time (template message)",
    approval: "Yes — Meta must approve",
  },
  {
    feature: "Shopify collection",
    where: "Commerce → Shopify collections → Send collection message",
    window: "24-hour chat window",
    approval: "No",
  },
  {
    feature: "Review and pay (WA Pay)",
    where: "Inbox → credit card icon, WA Pay test, Flows → WhatsApp Pay, auto after cart",
    window: "24-hour chat window (manual); cart reply anytime",
    approval: "No (P2M WABA required)",
  },
];

export default function CommerceDocumentationPage() {
  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-8 pb-16">
        <div className="text-sm text-muted-foreground">
          <Link href="/commerce" className="hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Commerce
          </Link>
        </div>

        <div>
          <h1 className="text-3xl font-semibold flex items-center gap-2">
            <BookOpen className="h-8 w-8 text-emerald-600" />
            Commerce guide
          </h1>
          <p className="text-muted-foreground mt-2">
            How to send products on WhatsApp — single, list, carousel, chatbot, flows, payments, and
            Shopify collections.
          </p>
        </div>

        <Card id="setup">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-emerald-600" />
              1. Setup (do this first)
            </CardTitle>
            <CardDescription>Required before any product message works</CardDescription>
          </CardHeader>
          <CardContent>
            <StepList
              steps={[
                'Connect <strong class="text-foreground">Official WhatsApp Business API</strong> under Integrations.',
                'Create a catalog in <a href="https://business.facebook.com/commerce" target="_blank" rel="noopener noreferrer" class="underline text-foreground">Meta Commerce Manager</a> and link it to your WhatsApp number in WhatsApp Manager.',
                'Open <strong class="text-foreground"><a href="/commerce" class="underline">Commerce</a></strong> → select your WhatsApp session → pick catalog → <strong class="text-foreground">Save &amp; verify catalog</strong>.',
                'Add products to the catalog (sync from Shopify/Woo on Commerce, or upload manually in Meta).',
              ]}
            />
          </CardContent>
        </Card>

        <Card id="single">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-emerald-600" />
              2. Send a single product (Inbox)
            </CardTitle>
            <CardDescription>One catalog card inside the customer&apos;s 24-hour window</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <StepList
              steps={[
                'Open <strong class="text-foreground"><a href="/chat" class="underline">Inbox</a></strong> and select a contact.',
                'Click the <strong class="text-foreground">shopping bag</strong> icon → Single product or Product list.',
                'Or click the <strong class="text-foreground">credit card</strong> icon to send <strong class="text-foreground">Review and pay</strong> (WA Pay checkout invoice).',
                'Search and tap a product, then send.',
              ]}
            />
            <p className="text-xs text-muted-foreground border-t pt-3">
              Alternative: Commerce → <strong>Test catalog send</strong> for testing with any contact
              from your list.
            </p>
          </CardContent>
        </Card>

        <Card id="list">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LayoutList className="h-5 w-5 text-emerald-600" />
              3. Send multiple products (product list)
            </CardTitle>
            <CardDescription>Scrollable catalog list — up to 30 products</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <StepList
              steps={[
                'In <strong class="text-foreground">Inbox</strong>, open the catalog dialog → <strong class="text-foreground">Product list</strong> tab.',
                'Select up to 30 products (checkboxes), add message text, click <strong class="text-foreground">Send N products</strong>.',
                'Or use <strong class="text-foreground"><a href="/commerce" class="underline">Commerce</a> → Catalog broadcast</strong> to send to multiple contacts at once.',
              ]}
            />
            <p className="text-xs text-muted-foreground border-t pt-3">
              This is <strong>not</strong> a swipe carousel — it is Meta&apos;s multi-product list
              message. Works only inside the 24-hour window.
            </p>
          </CardContent>
        </Card>

        <Card id="carousel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-emerald-600" />
              4. Create a product carousel template
            </CardTitle>
            <CardDescription>
              Swipeable product cards — for marketing outside the 24-hour window
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A carousel is an <strong className="text-foreground">approved marketing template</strong>,
              not a session message. Meta must review and approve it before you can send.
            </p>
            <StepList
              steps={[
                'Go to <strong class="text-foreground"><a href="/templates/create" class="underline">Templates → Create</a></strong> (or Commerce → Create product carousel template).',
                'Set template name (lowercase, underscores), language, and <strong class="text-foreground">body text</strong> (required).',
                'Under <strong class="text-foreground">Interactive Actions</strong>, select <strong class="text-foreground">Product Card Carousel</strong> — not Media Card Carousel.',
                'Confirm <strong class="text-foreground">Meta catalog ID</strong> (auto-filled from Commerce).',
                'Click <strong class="text-foreground">Add Card</strong> at least <strong class="text-foreground">twice</strong> (Meta requires 2–10 cards at creation).',
                'For each card: pick a catalog product, set button label (e.g. Shop Now), choose button type — <strong class="text-foreground">View in WhatsApp</strong> or <strong class="text-foreground">Open URL</strong> (same type on all cards).',
                'Click <strong class="text-foreground">Submit Template</strong> and wait for status <strong class="text-foreground">APPROVED</strong> on the Templates page.',
              ]}
            />
            <div className="rounded-lg border bg-muted/40 p-4 text-sm space-y-2">
              <p className="font-medium text-foreground">After approval — how to send</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>
                  <strong className="text-foreground">Inbox</strong> — pick the carousel template when
                  messaging a contact
                </li>
                <li>
                  <strong className="text-foreground">Campaigns</strong> — bulk send to many contacts
                </li>
                <li>
                  <strong className="text-foreground">Flows</strong> — add Send Template action with the
                  carousel template
                </li>
              </ul>
            </div>
            <Button size="sm" asChild className="bg-emerald-600 hover:bg-emerald-700">
              <Link href="/templates/create">Create carousel template</Link>
            </Button>
          </CardContent>
        </Card>

        <Card id="chatbot">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-emerald-600" />
              5. Add products in chatbot
            </CardTitle>
            <CardDescription>Automatic replies with one catalog product</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <StepList
              steps={[
                'Open <strong class="text-foreground"><a href="/chatbots" class="underline">Chatbots</a></strong> → edit or create a bot.',
                'Add a <strong class="text-foreground">Send Product Message</strong> node from the palette.',
                'Enter <strong class="text-foreground">Catalog ID</strong> (from Commerce) and <strong class="text-foreground">Product Retailer ID</strong> (Content ID from Meta catalog).',
                'Optional: body and footer text on the product card.',
                'Connect the node after your trigger (keyword, first message, etc.) and publish.',
              ]}
            />
            <p className="text-xs text-muted-foreground border-t pt-3">
              Chatbot supports <strong>single product only</strong>. For multiple products use Inbox
              product list, Commerce broadcast, or a carousel template in a Send Template node.
            </p>
          </CardContent>
        </Card>

        <Card id="flows">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-emerald-600" />
              6. Use with Flows (automation)
            </CardTitle>
            <CardDescription>Shopify/Woo events → WhatsApp actions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <StepList
              steps={[
                'On Commerce, click <strong class="text-foreground">Install commerce flow presets</strong> — creates draft flows for orders, abandoned cart, etc.',
                'Open <strong class="text-foreground"><a href="/flows" class="underline">Flows</a></strong>, edit each draft: set WhatsApp session, approved template name, and variables.',
                'Connect store webhooks on <strong class="text-foreground"><a href="/integrations" class="underline">Integrations</a></strong>, then publish the flow.',
              ]}
            />
            <p className="text-sm font-medium text-foreground">WhatsApp actions you can add manually</p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>
                <strong className="text-foreground">Send collection</strong> — multi-product from a
                Shopify collection ID
              </li>
              <li>
                <strong className="text-foreground">WhatsApp Pay</strong> — in-chat UPI (see below)
              </li>
              <li>
                <strong className="text-foreground">Send payment link</strong> — Razorpay/Cashfree
                fallback
              </li>
              <li>
                <strong className="text-foreground">Send Template</strong> — any approved template
                including carousel
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card id="native-pay">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-emerald-600" />
              7. WhatsApp native pay (Meta)
            </CardTitle>
            <CardDescription>In-chat UPI / gateway payments for India</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <StepList
              steps={[
                'In Meta Business Manager, set up Payments with Razorpay or PayU.',
                'On <strong class="text-foreground"><a href="/wa-pay" class="underline">WA Pay</a></strong> → enable catalog checkout, enter payment configuration name exactly as in Meta, choose gateway, save.',
                'In <strong class="text-foreground"><a href="/chat" class="underline">Inbox</a></strong>, use the <strong class="text-foreground">credit card</strong> icon to send <strong class="text-foreground">Review and pay</strong> with a catalog product.',
                'In Flows, add <strong class="text-foreground">WhatsApp Pay</strong> action with amount (e.g. {{trigger.total_price}}) and recipient {{trigger.phone}}.',
              ]}
            />
            <p className="text-xs text-muted-foreground border-t pt-3">
              Full catalog + WA Pay steps: see section <a href="#wa-pay-catalog" class="underline font-medium text-foreground">WA Pay + catalog</a> below.
              If native pay is not configured, flows fall back to a payment link.
            </p>
          </CardContent>
        </Card>

        <Card id="wa-pay-catalog">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-violet-600" />
              9. WA Pay + catalog (full process)
            </CardTitle>
            <CardDescription>
              From catalog browse to payment — Inbox, broadcast, carousel, and automatic cart checkout
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              <strong className="text-foreground">Catalog messages</strong> let customers browse and add
              to cart. <strong className="text-foreground">Review and pay</strong> is the separate checkout
              invoice. You cannot embed Review and pay inside a normal or carousel template.
            </p>

            <p className="font-medium text-foreground">Recommended production flow</p>
            <StepList
              steps={[
                'Setup: Commerce → catalog + WA Pay → payment config (see section 1 on this page).',
                'Send catalog: Inbox shopping bag, Commerce broadcast, or approved product carousel campaign.',
                'Customer adds products to cart in WhatsApp and taps Send cart.',
                'If WA Pay enabled: panel auto-sends Review and pay with cart items and catalog prices.',
                'Customer pays in WhatsApp (UPI/card via Razorpay) — requires P2M-eligible WABA.',
                'Track orders on WA Pay page; mark shipped/completed to notify customer.',
              ]}
            />

            <p className="font-medium text-foreground">Manual Review and pay (without waiting for cart)</p>
            <StepList
              steps={[
                '<strong class="text-foreground">Inbox</strong> → credit card icon → select catalog product → Send Review and pay.',
                '<strong class="text-foreground">WA Pay</strong> page → Diagnostics & test → same test send.',
                '<strong class="text-foreground">Flows</strong> → WhatsApp Pay node (amount + phone variable).',
              ]}
            />

            <p className="font-medium text-foreground">P2M / enterprise requirement</p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              If Meta returns &quot;not eligible for P2M payments: not an enterprise account&quot;, native
              Review and pay will not deliver until Meta enables P2M on your WABA. Email{" "}
              <a href="mailto:whatsappindia-bizpayments-support@meta.com" className="underline">
                whatsappindia-bizpayments-support@meta.com
              </a>
              . Until then use Commerce external checkout (Shopify/Woo) or Inbox payment links.
            </p>

            <p className="font-medium text-foreground">Future Meta features we can add</p>
            <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-1">
              <li>Payment links inside order_details (redirect checkout — works on more account types)</li>
              <li>UPI intent / direct VPA configurations</li>
              <li>Enhanced payment links flow</li>
              <li>Restrict payment methods (e.g. web-only above ₹5L)</li>
              <li>Refund events in payment webhooks</li>
              <li>PayU TPV / bank verification fields</li>
            </ul>
            <p className="text-xs text-muted-foreground">
              Detailed matrix: <code className="bg-muted px-1 rounded">docs/WA_PAY_CATALOG.md</code> in
              the repo.
            </p>
          </CardContent>
        </Card>

        <Card id="shopify">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-emerald-600" />
              8. Shopify collections → WhatsApp
            </CardTitle>
            <CardDescription>Send a whole collection as a product list</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <StepList
              steps={[
                'Connect Shopify on Integrations.',
                'On Commerce → <strong class="text-foreground">Shopify collections</strong>, select a collection.',
                'Click <strong class="text-foreground">Sync products to catalog</strong> (or Create Meta product set for ads).',
                'Pick a contact → <strong class="text-foreground">Send collection message</strong>.',
                'For automation: Flow → <strong class="text-foreground">Send collection</strong> with Shopify collection ID and {{trigger.phone}}.',
              ]}
            />
          </CardContent>
        </Card>

        <section id="compare" className="space-y-4">
          <h2 className="text-xl font-semibold">Quick comparison</h2>
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Where</TableHead>
                    <TableHead>24h window?</TableHead>
                    <TableHead>Meta approval?</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {COMPARE_ROWS.map((row) => (
                    <TableRow key={row.feature}>
                      <TableCell className="font-medium">{row.feature}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{row.where}</TableCell>
                      <TableCell className="text-sm">{row.window}</TableCell>
                      <TableCell className="text-sm">{row.approval}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Common issues</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong className="text-foreground">No products in dropdown</strong> — verify catalog on
              Commerce and ensure products exist in Meta.
            </p>
            <p>
              <strong className="text-foreground">Carousel submit fails</strong> — add at least 2 cards;
              all cards must use the same button type.
            </p>
            <p>
              <strong className="text-foreground">Send failed outside 24h</strong> — use an approved
              template (carousel or text), not Inbox catalog send.
            </p>
            <p>
              <strong className="text-foreground">WA Pay #131026 P2M</strong> — WABA needs Meta P2M
              approval; use payment links or external checkout until enabled.
            </p>
            <p>
              <strong className="text-foreground">Wrong product ID</strong> — use Meta Content ID
              (retailer ID), not Shopify SKU alone unless synced to catalog.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
