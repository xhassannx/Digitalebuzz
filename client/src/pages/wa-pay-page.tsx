import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useRatehonkPageSkin } from "@/panel-templates/ratehonk-v1/RatehonkSkinContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  CreditCard,
  ShoppingCart,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import {
  ContactRecipientPicker,
  type ManagedContactPick,
} from "@/components/contact-recipient-picker";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { fetchLegacyListApi } from "@/lib/legacy-list-api";
import { useToast } from "@/hooks/use-toast";

type WaPaySettings = {
  metaCatalogId: string | null;
  metaCatalogName: string | null;
  waPayCatalogCheckoutEnabled: boolean;
  waPayOrderType: "physical-goods" | "digital-goods";
  metaPaymentConfigurationName: string | null;
  metaPaymentGateway: string | null;
  lastWaPayCheckoutAt: string | null;
  lastWaPayCheckoutStatus: string | null;
  lastWaPayCheckoutError: string | null;
  shopifyCheckoutEnabled: boolean;
  woocommerceCheckoutEnabled: boolean;
};

type SessionRow = {
  sessionId: string;
  connectionType?: string;
  status?: string;
  deviceInfo?: {
    displayPhoneNumber?: string;
    phoneNumber?: string;
    verifiedName?: string;
  };
};
function WaPayCard({ className, ...props }: ComponentProps<typeof Card>) {
  const skin = useRatehonkPageSkin();
  return <Card className={cn(skin && "commerce-rh-card", className)} {...props} />;
}

type WaPayOrderRow = {
  id: string;
  referenceId: string;
  customerWaId: string;
  amountMinor: number;
  currency: string;
  paymentStatus: string;
  orderStatus: string;
  paidAt: string | null;
  createdAt: string;
  pgTransactionId: string | null;
};

type CatalogProduct = {
  retailerId: string;
  name: string;
  price?: string;
};

function formatInrMinor(minor: number): string {
  return `₹${(minor / 100).toLocaleString("en-IN")}`;
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "Never";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function sessionLabel(s: SessionRow): string {
  const phone = s.deviceInfo?.displayPhoneNumber || s.deviceInfo?.phoneNumber || "";
  const name = s.deviceInfo?.verifiedName || "";
  if (phone && name) return `${phone} — ${name}`;
  return phone || name || s.sessionId;
}

export default function WaPayPage({ embedded }: { embedded?: boolean } = {}) {
  const { toast } = useToast();
  const skin = useRatehonkPageSkin();

  const [enabled, setEnabled] = useState(false);
  const [orderType, setOrderType] = useState<"physical-goods" | "digital-goods">("physical-goods");
  const [configName, setConfigName] = useState("");
  const [gateway, setGateway] = useState("razorpay");
  const [sessionId, setSessionId] = useState("");
  const [testContactId, setTestContactId] = useState("");
  const [testAmount, setTestAmount] = useState("100");
  const [testItemName, setTestItemName] = useState("Test product");
  const [testProductId, setTestProductId] = useState("");

  const { data: settings, isLoading } = useQuery<WaPaySettings>({
    queryKey: ["/api/wa-pay/settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/wa-pay/settings");
      return res.json();
    },
  });

  const { data: sessions = [] } = useQuery<SessionRow[]>({
    queryKey: ["/api/sessions"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/sessions");
      return res.json();
    },
  });

  const { data: contacts = [] } = useQuery<ManagedContactPick[]>({
    queryKey: ["/api/contacts"],
    queryFn: () => fetchLegacyListApi<ManagedContactPick>("/api/contacts", "contacts"),
    staleTime: 60_000,
  });

  const officialSessions = useMemo(
    () => sessions.filter((s) => s.connectionType === "official" && s.status === "connected"),
    [sessions]
  );

  useEffect(() => {
    if (!settings) return;
    setEnabled(settings.waPayCatalogCheckoutEnabled ?? false);
    setOrderType(settings.waPayOrderType === "digital-goods" ? "digital-goods" : "physical-goods");
    setConfigName(settings.metaPaymentConfigurationName || "");
    setGateway(settings.metaPaymentGateway || "razorpay");
  }, [settings]);

  useEffect(() => {
    if (!sessionId && officialSessions.length) {
      setSessionId(officialSessions[0].sessionId);
    }
  }, [officialSessions, sessionId]);

  const { data: diagnostics, refetch: refetchDiagnostics, isFetching: diagLoading } = useQuery({
    queryKey: ["/api/wa-pay/diagnostics", sessionId],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/wa-pay/diagnostics?sessionId=${encodeURIComponent(sessionId)}`
      );
      return res.json() as Promise<{
        isCartEnabled?: boolean;
        isCatalogVisible?: boolean;
        configuredCatalogLinked?: boolean;
        smbAccount?: boolean;
        waPayCatalogCheckoutEnabled?: boolean;
        metaPaymentConfigurationName?: string | null;
        issues?: string[];
      }>;
    },
    enabled: !!sessionId,
    staleTime: 30_000,
  });

  const { data: catalogProductsForTest } = useQuery<{
    products: CatalogProduct[];
    warning?: string;
    commerceNote?: string;
  }>({
    queryKey: ["/api/commerce/catalog/products", sessionId, settings?.metaCatalogId],
    queryFn: async () => {
      const qs = new URLSearchParams({
        sessionId,
        catalogId: settings!.metaCatalogId!.trim(),
        limit: "100",
      });
      const res = await apiRequest("GET", `/api/commerce/catalog/products?${qs}`);
      return res.json();
    },
    enabled: !!sessionId && !!settings?.metaCatalogId?.trim(),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!testProductId) return;
    const product = (catalogProductsForTest?.products || []).find(
      (p) => p.retailerId === testProductId
    );
    if (!product) return;
    setTestItemName(product.name);
    const priceMatch = product.price?.match(/^([\d,.]+)/);
    if (priceMatch) {
      const major = parseFloat(priceMatch[1].replace(/,/g, ""));
      if (Number.isFinite(major) && major > 0) {
        setTestAmount(String(major));
      }
    }
  }, [testProductId, catalogProductsForTest?.products]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", "/api/wa-pay/settings", {
        waPayCatalogCheckoutEnabled: enabled,
        waPayOrderType: orderType,
        metaPaymentConfigurationName: configName.trim(),
        metaPaymentGateway: gateway as "razorpay" | "payu",
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "WA Pay settings saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/wa-pay/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/commerce/settings"] });
    },
    onError: (e: Error) => {
      toast({ title: "Could not save", description: e.message, variant: "destructive" });
    },
  });

  const { data: ordersData, refetch: refetchOrders } = useQuery<{ orders: WaPayOrderRow[] }>({
    queryKey: ["/api/wa-pay/orders"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/wa-pay/orders");
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const orderStatusMutation = useMutation({
    mutationFn: async (opts: {
      orderId: string;
      orderStatus: "processing" | "partially_shipped" | "shipped" | "completed" | "canceled";
    }) => {
      const res = await apiRequest("POST", `/api/wa-pay/orders/${opts.orderId}/order-status`, {
        orderStatus: opts.orderStatus,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Order status sent to customer" });
      refetchOrders();
    },
    onError: (e: Error) => {
      toast({ title: "Order status failed", description: e.message, variant: "destructive" });
    },
  });

  const testSendMutation = useMutation({
    mutationFn: async () => {
      const contact = contacts.find((c) => c.id === testContactId);
      const to = contact?.phoneNumber?.trim();
      if (!to) throw new Error("Select a contact with a phone number");
      const amount = parseFloat(testAmount);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a valid amount");
      if (amount < 10) throw new Error("Minimum amount is ₹10 for WhatsApp pay test");
      if (orderType === "physical-goods" && catalogReady && !testProductId.trim()) {
        throw new Error("Select a catalog product for physical-goods WA Pay");
      }
      const res = await apiRequest("POST", "/api/wa-pay/test-send", {
        sessionId,
        to,
        amountMajor: amount,
        itemName: testItemName.trim() || "Test order",
        productRetailerId: testProductId.trim() || undefined,
        beneficiaryName: contact?.name?.trim() || undefined,
        orderType,
        bodyText: "Review your order and pay in WhatsApp",
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Test payment sent",
        description: "Customer should see Review and pay in WhatsApp.",
      });
      refetchOrders();
    },
    onError: (e: Error) => {
      toast({ title: "Test send failed", description: e.message, variant: "destructive" });
    },
  });

  const catalogReady = !!settings?.metaCatalogId?.trim();
  const hasFallback =
    (settings?.shopifyCheckoutEnabled || settings?.woocommerceCheckoutEnabled) ?? false;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-6 pb-10", skin && "commerce-rh-page")}>
      {!embedded ? (
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <CreditCard className="h-7 w-7" />
            WA Pay
          </h1>
          <p className="text-muted-foreground mt-1 max-w-3xl">
            In-WhatsApp checkout: when a customer submits a catalog cart, send{" "}
            <strong>Review and pay</strong> (order details → address → payment) instead of an
            external store link. Catalog setup stays on the{" "}
            <Link href="/commerce" className="text-primary underline-offset-2 hover:underline">
              Commerce
            </Link>{" "}
            page — this page controls the payment journey.{" "}
            <Link
              href="/commerce/documentation#wa-pay-catalog"
              className="text-primary underline-offset-2 hover:underline"
            >
              Full WA Pay + catalog guide
            </Link>
          </p>
        </div>
      ) : null}

      <WaPayCard>
        <CardHeader>
          <CardTitle className="text-lg">How it works</CardTitle>
          <CardDescription>Matches Meta&apos;s WhatsApp Payments API ecommerce flow</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid sm:grid-cols-5 gap-3 text-sm">
            {[
              { step: "1", label: "Product message", hint: "Send from Inbox / Commerce" },
              { step: "2", label: "Customer adds to cart", hint: "Native WhatsApp catalog UI" },
              { step: "3", label: "Order details", hint: "review_and_pay message" },
              { step: "4", label: "Provide address", hint: "Physical goods only" },
              { step: "5", label: "Pay in WhatsApp", hint: "UPI / gateway in Meta UI" },
            ].map((s) => (
              <li key={s.step} className="border rounded-lg p-3 bg-muted/30">
                <span className="text-xs font-semibold text-primary">Step {s.step}</span>
                <p className="font-medium mt-1">{s.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.hint}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </WaPayCard>

      <WaPayCard className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
        <CardContent className="pt-6 flex gap-3 items-start">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm space-y-2">
            <p className="font-medium">Native in-chat pay requires Meta P2M eligibility</p>
            <p className="text-muted-foreground">
              If test send fails with{" "}
              <strong>“not eligible for P2M payments: not an enterprise account”</strong>, your
              WhatsApp number is not approved for native <strong>Review and pay</strong> yet. Razorpay
              linked in Meta Manager is not enough — Meta must enable P2M on your WABA.
            </p>
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
              <li>
                Email{" "}
                <a href="mailto:whatsappindia-bizpayments-support@meta.com" className="underline">
                  whatsappindia-bizpayments-support@meta.com
                </a>{" "}
                with your WABA ID and business phone to request enterprise / P2M access.
              </li>
              <li>
                Until then use{" "}
                <Link href="/commerce" className="underline">
                  Commerce
                </Link>{" "}
                → Shopify/Woo <strong>external checkout</strong> on cart submit.
              </li>
              <li>Or send Razorpay payment links from Inbox — works without P2M.</li>
            </ul>
          </div>
        </CardContent>
      </WaPayCard>

      {!catalogReady ? (
        <WaPayCard className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="pt-6 flex gap-3 items-start">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Catalog required first</p>
              <p className="text-sm text-muted-foreground mt-1">
                Link a Meta catalog on the Commerce page before enabling WA Pay cart checkout.
              </p>
              <Button asChild size="sm" className="mt-3" variant="outline">
                <Link href="/commerce">
                  Open Commerce <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </WaPayCard>
      ) : null}

      <WaPayCard>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Catalog cart → WA Pay
          </CardTitle>
          <CardDescription>
            When enabled, submitting a catalog cart in WhatsApp triggers{" "}
            <code className="text-xs bg-muted px-1 rounded">review_and_pay</code> automatically.
            Shopify/Woo external checkout on Commerce still works as fallback if WA Pay fails
            {hasFallback ? " (currently enabled there)." : " (enable there if you want a fallback)."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 border rounded-lg p-4">
            <div>
              <Label htmlFor="wa-pay-enabled" className="text-base">
                Enable catalog cart checkout via WA Pay
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Catalog: {settings?.metaCatalogName || settings?.metaCatalogId || "—"}
              </p>
            </div>
            <Switch
              id="wa-pay-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
              disabled={!catalogReady}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Order type</Label>
              <Select
                value={orderType}
                onValueChange={(v) => setOrderType(v as "physical-goods" | "digital-goods")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="physical-goods">
                    Physical goods (shipping address in WhatsApp)
                  </SelectItem>
                  <SelectItem value="digital-goods">Digital goods (no address step)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Payment gateway</Label>
              <Select value={gateway} onValueChange={setGateway}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="razorpay">Razorpay</SelectItem>
                  <SelectItem value="payu">PayU</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Meta payment configuration name</Label>
            <Input
              value={configName}
              onChange={(e) => setConfigName(e.target.value)}
              placeholder="As shown in Meta Business Manager → Payments"
            />
            <p className="text-xs text-muted-foreground">
              Link Razorpay or PayU in Meta BM before going live. India UPI only for native pay.
            </p>
          </div>

          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            Save WA Pay settings
          </Button>

          <p className="text-xs text-muted-foreground">
            Last cart WA Pay: {formatTime(settings?.lastWaPayCheckoutAt)}
            {settings?.lastWaPayCheckoutStatus === "error" && settings.lastWaPayCheckoutError
              ? ` — ${settings.lastWaPayCheckoutError}`
              : settings?.lastWaPayCheckoutStatus
                ? ` — ${settings.lastWaPayCheckoutStatus}`
                : ""}
          </p>
        </CardContent>
      </WaPayCard>

      <WaPayCard>
        <CardHeader>
          <CardTitle className="text-lg">Diagnostics &amp; test</CardTitle>
          <CardDescription>
            Confirm cart is enabled on your WhatsApp number, then send a test Review and pay message.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>WhatsApp session</Label>
              <Select value={sessionId} onValueChange={setSessionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select connected number" />
                </SelectTrigger>
                <SelectContent>
                  {officialSessions.map((s) => (
                    <SelectItem key={s.sessionId} value={s.sessionId}>
                      {sessionLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                size="sm"
                disabled={!sessionId || diagLoading}
                onClick={() => refetchDiagnostics()}
              >
                {diagLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <span className="ml-2">Refresh diagnostics</span>
              </Button>
            </div>
          </div>

          {diagnostics ? (
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant={diagnostics.isCartEnabled ? "default" : "secondary"}>
                Cart {diagnostics.isCartEnabled ? "enabled" : "disabled"}
              </Badge>
              <Badge variant={diagnostics.isCatalogVisible ? "default" : "secondary"}>
                Catalog visible {diagnostics.isCatalogVisible ? "yes" : "no"}
              </Badge>
              <Badge variant={diagnostics.configuredCatalogLinked ? "default" : "secondary"}>
                Catalog linked {diagnostics.configuredCatalogLinked ? "yes" : "no"}
              </Badge>
              {diagnostics.issues?.length ? (
                <p className="w-full text-xs text-amber-800 dark:text-amber-200 mt-1">
                  {diagnostics.issues.join(" ")}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="border rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium">Send test Review and pay</p>
            <p className="text-xs text-muted-foreground">
              For catalog checkout, pick a product from your Meta catalog (same list as Commerce).
              Production flow: customer browses catalog → adds to cart → WA Pay sends Review and pay
              automatically.
            </p>
            {!catalogReady ? (
              <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2">
                Save your Meta catalog on the{" "}
                <Link href="/commerce" className="underline">
                  Commerce
                </Link>{" "}
                page first to load products here.
              </p>
            ) : null}
            {(catalogProductsForTest?.warning || catalogProductsForTest?.commerceNote) ? (
              <p className="text-xs text-amber-800 dark:text-amber-200">
                {catalogProductsForTest.warning || catalogProductsForTest.commerceNote}
              </p>
            ) : null}
            <ContactRecipientPicker
              mode="single"
              label="Test recipient"
              selectedIds={testContactId ? new Set([testContactId]) : new Set()}
              onSelectionChange={(ids) => setTestContactId(Array.from(ids)[0] || "")}
            />
            {catalogReady ? (
              <div className="space-y-1">
                <Label>Catalog product {orderType === "physical-goods" ? "(required)" : "(optional)"}</Label>
                {(catalogProductsForTest?.products || []).length > 0 ? (
                  <Select value={testProductId || undefined} onValueChange={setTestProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select catalog product" />
                    </SelectTrigger>
                    <SelectContent>
                      {(catalogProductsForTest?.products || []).map((p) => (
                        <SelectItem key={p.retailerId} value={p.retailerId}>
                          {p.name} ({p.retailerId})
                          {p.price ? ` — ${p.price}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={testProductId}
                    onChange={(e) => setTestProductId(e.target.value)}
                    placeholder="Content ID from Commerce Manager (e.g. 50181822078660)"
                  />
                )}
              </div>
            ) : null}
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Amount (INR)</Label>
                <Input
                  value={testAmount}
                  onChange={(e) => setTestAmount(e.target.value)}
                  placeholder="1299"
                  disabled={!!testProductId && orderType === "physical-goods"}
                />
              </div>
              <div className="space-y-1">
                <Label>Item name</Label>
                <Input
                  value={testItemName}
                  onChange={(e) => setTestItemName(e.target.value)}
                  placeholder="Test product"
                  disabled={!!testProductId}
                />
              </div>
            </div>
            <Button
              size="sm"
              disabled={
                !sessionId ||
                !testContactId ||
                testSendMutation.isPending ||
                (orderType === "physical-goods" && catalogReady && !testProductId.trim())
              }
              onClick={() => testSendMutation.mutate()}
            >
              {testSendMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Send test payment
            </Button>
          </div>

            <p className="text-xs text-muted-foreground mt-2">
              To send a catalog <strong>product card</strong> (browse only), use{" "}
              <Link href="/commerce" className="underline">
                Commerce → Test catalog send
              </Link>
              . WA Pay sends the <strong>Review and pay</strong> invoice after cart submit or from this
              test. For physical goods, always pick a real catalog product.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              If you see <strong>#131026</strong>: update WhatsApp, select a catalog product, or try{" "}
              <strong>Digital goods</strong> for a simple test.
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <ExternalLink className="h-3 w-3" />
              Meta docs:{" "}
              <a
                href="https://developers.facebook.com/documentation/business-messaging/whatsapp/payments/payments-in/pg"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Payments via payment gateways (India)
              </a>
              . Enable cart in WhatsApp Manager if diagnostics show cart disabled.
            </p>
        </CardContent>
      </WaPayCard>

      <WaPayCard>
        <CardHeader>
          <CardTitle className="text-lg">Recent orders</CardTitle>
          <CardDescription>
            Payment webhooks update status automatically. After payment, mark shipped or completed
            here (sends Meta <code className="text-xs">order_status</code> to the customer).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(ordersData?.orders || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No WA Pay orders yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Reference</th>
                    <th className="py-2 pr-3 font-medium">Customer</th>
                    <th className="py-2 pr-3 font-medium">Amount</th>
                    <th className="py-2 pr-3 font-medium">Payment</th>
                    <th className="py-2 pr-3 font-medium">Order</th>
                    <th className="py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(ordersData?.orders || []).map((o) => (
                    <tr key={o.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-mono text-xs">{o.referenceId}</td>
                      <td className="py-2 pr-3">{o.customerWaId}</td>
                      <td className="py-2 pr-3">{formatInrMinor(o.amountMinor)}</td>
                      <td className="py-2 pr-3">
                        <Badge variant={o.paymentStatus === "captured" ? "default" : "secondary"}>
                          {o.paymentStatus}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3">{o.orderStatus}</td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-1">
                          {o.paymentStatus === "captured" && o.orderStatus !== "shipped" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              disabled={orderStatusMutation.isPending}
                              onClick={() =>
                                orderStatusMutation.mutate({
                                  orderId: o.id,
                                  orderStatus: "shipped",
                                })
                              }
                            >
                              Shipped
                            </Button>
                          ) : null}
                          {o.paymentStatus === "captured" && o.orderStatus !== "completed" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              disabled={orderStatusMutation.isPending}
                              onClick={() =>
                                orderStatusMutation.mutate({
                                  orderId: o.id,
                                  orderStatus: "completed",
                                })
                              }
                            >
                              Completed
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </WaPayCard>

      <WaPayCard>
        <CardHeader>
          <CardTitle className="text-lg">Meta integration checklist</CardTitle>
          <CardDescription>
            Per Meta&apos;s{" "}
            <a
              href="https://developers.facebook.com/documentation/business-messaging/whatsapp/payments/payments-in/pg"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Payments API guide
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>
              <strong className="text-foreground">Step 1–3:</strong> Catalog cart →{" "}
              <code className="text-xs">order_details</code> / Review and pay — handled by WA Pay
              when enabled.
            </li>
            <li>
              <strong className="text-foreground">Step 4–5:</strong> Payment webhooks + Meta payment
              lookup API — handled automatically when payment completes.
            </li>
            <li>
              <strong className="text-foreground">Step 6:</strong> After capture, customer gets{" "}
              <code className="text-xs">order_status: processing</code>. Use Recent orders below to
              mark shipped / completed.
            </li>
            <li>
              <strong className="text-foreground">Physical goods:</strong> Customer adds shipping
              address inside WhatsApp; use <em>Physical goods</em> order type for that UI.
            </li>
          </ul>
        </CardContent>
      </WaPayCard>
    </div>
  );
}
