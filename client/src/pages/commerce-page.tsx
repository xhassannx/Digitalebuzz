import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useRatehonkPageSkin } from "@/panel-templates/ratehonk-v1/RatehonkSkinContext";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  getCommerceFlowsToCreate,
  COMMERCE_FLOW_NAME_PREFIX,
} from "@/lib/commerce-flow-presets";
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
  ShoppingBag,
  ExternalLink,
  RefreshCw,
  Plug,
  GitBranch,
  CheckCircle2,
  BarChart3,
  Send,
  ShoppingCart,
  CreditCard,
  Download,
  BookOpen,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ContactRecipientPicker,
  phonesFromContactIds,
  phoneFromContactId,
  type ManagedContactPick,
} from "@/components/contact-recipient-picker";
import { fetchLegacyListApi } from "@/lib/legacy-list-api";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ShopifySetupResult = {
  success: boolean;
  brandName?: string;
  storeUrl?: string;
  summary: {
    flowsCreated: number;
    flowsSkipped: number;
    templatesSubmitted: number;
    templatesSkipped: number;
    templatesFailed: string[];
    assistantCreated: boolean;
    supportChatbotCreated: boolean;
    codChatbotCreated: boolean;
    shopifyWebhooksRegistered: boolean;
  };
  flows: Array<{ id: string; name: string; webhookUrl?: string; notes?: string }>;
  assistantId?: string;
  chatbots: Array<{ id: string; name: string }>;
  testing: string[];
  warnings: string[];
};

type CommerceSettings = {
  metaCatalogId: string | null;
  metaCatalogName: string | null;
  shopifySyncEnabled: boolean;
  woocommerceSyncEnabled: boolean;
  shopifyCheckoutEnabled: boolean;
  woocommerceCheckoutEnabled: boolean;
  shopifyLastSyncAt: string | null;
  woocommerceLastSyncAt: string | null;
  shopifyLastSyncStatus: string | null;
  woocommerceLastSyncStatus: string | null;
  shopifyLastSyncError: string | null;
  woocommerceLastSyncError: string | null;
  lastCartCheckoutAt: string | null;
  lastCartCheckoutStatus: string | null;
  lastCartCheckoutError: string | null;
  shopifyConnected: boolean;
  woocommerceConnected: boolean;
  whatsappNativePayEnabled?: boolean;
  metaPaymentConfigurationName?: string | null;
  metaPaymentGateway?: string | null;
  shopifyCollectionProductSets?: Record<
    string,
    { productSetId: string; title: string; syncedAt: string }
  >;
};

type CatalogProduct = { retailerId: string; name: string };

type SessionRow = {
  sessionId: string;
  name?: string;
  connectionType?: string;
  status?: string;
  deviceInfo?: {
    displayPhoneNumber?: string;
    phoneNumber?: string;
    verifiedName?: string;
    businessAccountName?: string;
  };
};

function sessionDisplayLabel(session: SessionRow): string {
  const phone =
    session.deviceInfo?.displayPhoneNumber?.trim() ||
    session.deviceInfo?.phoneNumber?.trim() ||
    "";
  const businessName =
    session.deviceInfo?.verifiedName?.trim() ||
    session.deviceInfo?.businessAccountName?.trim() ||
    session.name?.trim() ||
    "";
  if (phone && businessName) return `${phone} — ${businessName}`;
  if (phone) return phone;
  if (businessName) return businessName;
  return session.sessionId;
}

function formatSyncTime(iso: string | null | undefined): string {
  if (!iso) return "Never";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

type MetaCatalogRow = { id: string; name?: string; productCount?: number };

function formatMetaCatalogLabel(c: MetaCatalogRow): string {
  const name = c.name?.trim() || "Catalog";
  const count =
    c.productCount != null ? ` · ${c.productCount} product${c.productCount === 1 ? "" : "s"}` : "";
  return `${name} (${c.id})${count}`;
}

function CommerceCard({ className, ...props }: ComponentProps<typeof Card>) {
  const skin = useRatehonkPageSkin();
  return <Card className={cn(skin && "commerce-rh-card", className)} {...props} />;
}

type CommercePageProps = {
  /** Hide page title when Nova template already shows RhPageHeader. */
  embedded?: boolean;
};

export default function CommercePage({ embedded }: CommercePageProps = {}) {
  const { toast } = useToast();
  const skin = useRatehonkPageSkin();
  const [catalogId, setCatalogId] = useState("");
  const [catalogName, setCatalogName] = useState("");
  const [verifySessionId, setVerifySessionId] = useState("");
  const [syncSessionId, setSyncSessionId] = useState("");
  const [testContactId, setTestContactId] = useState("");
  const [testProductId, setTestProductId] = useState("");
  const [broadcastContactIds, setBroadcastContactIds] = useState<Set<string>>(new Set());
  const [broadcastProductIds, setBroadcastProductIds] = useState<string[]>([]);
  const [broadcastBody, setBroadcastBody] = useState("Browse our catalog");
  const [nativePayEnabled, setNativePayEnabled] = useState(false);
  const [metaPaymentConfigName, setMetaPaymentConfigName] = useState("");
  const [metaPaymentGateway, setMetaPaymentGateway] = useState("razorpay");
  const [collectionContactId, setCollectionContactId] = useState("");
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [shopifySetupResult, setShopifySetupResult] = useState<ShopifySetupResult | null>(null);
  const [setupBrandName, setSetupBrandName] = useState("");
  const [setupStoreUrl, setSetupStoreUrl] = useState("");

  const { data: settings, isLoading } = useQuery<CommerceSettings>({
    queryKey: ["/api/commerce/settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/commerce/settings");
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
    () =>
      sessions.filter(
        (s) => s.connectionType === "official" && s.status === "connected"
      ),
    [sessions]
  );

  useEffect(() => {
    if (settings?.metaCatalogId != null) {
      setCatalogId(settings.metaCatalogId || "");
    }
    if (settings?.metaCatalogName != null) {
      setCatalogName(settings.metaCatalogName || "");
    }
    if (settings) {
      setNativePayEnabled(settings.whatsappNativePayEnabled ?? false);
      setMetaPaymentConfigName(settings.metaPaymentConfigurationName || "");
      setMetaPaymentGateway(settings.metaPaymentGateway || "razorpay");
    }
  }, [
    settings?.metaCatalogId,
    settings?.metaCatalogName,
    settings?.whatsappNativePayEnabled,
    settings?.metaPaymentConfigurationName,
    settings?.metaPaymentGateway,
  ]);

  useEffect(() => {
    if (!verifySessionId && officialSessions.length) {
      setVerifySessionId(officialSessions[0].sessionId);
      setSyncSessionId(officialSessions[0].sessionId);
    }
  }, [officialSessions, verifySessionId]);

  const {
    data: metaCatalogsData,
    isLoading: metaCatalogsLoading,
    isFetching: metaCatalogsFetching,
    refetch: refetchMetaCatalogs,
    error: metaCatalogsError,
  } = useQuery({
    queryKey: ["/api/commerce/meta-catalogs", verifySessionId],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/commerce/meta-catalogs?sessionId=${encodeURIComponent(verifySessionId)}`
      );
      return res.json() as Promise<{
        catalogs: MetaCatalogRow[];
        wabaId?: string;
        smbAccount?: boolean;
        message?: string;
        commerceNote?: string;
      }>;
    },
    enabled: !!verifySessionId && officialSessions.length > 0,
    staleTime: 60_000,
  });

  const metaCatalogs = metaCatalogsData?.catalogs ?? [];
  const metaCatalogsSmb = !!metaCatalogsData?.smbAccount;
  const metaCatalogsNote =
    metaCatalogsData?.commerceNote || metaCatalogsData?.message || null;

  const catalogSelectOptions = useMemo(() => {
    const rows = [...metaCatalogs];
    if (catalogId.trim() && !rows.some((c) => c.id === catalogId.trim())) {
      rows.unshift({
        id: catalogId.trim(),
        name: catalogName.trim() || settings?.metaCatalogName || "Saved catalog",
      });
    }
    return rows;
  }, [metaCatalogs, catalogId, catalogName, settings?.metaCatalogName]);

  const showManualCatalogId =
    metaCatalogsSmb ||
    (!metaCatalogsLoading &&
      !metaCatalogsFetching &&
      catalogSelectOptions.length === 0 &&
      !!verifySessionId);

  const saveMutation = useMutation({
    mutationFn: async (opts?: { nativePayOnly?: boolean }) => {
      const res = await apiRequest("PUT", "/api/commerce/settings", {
        ...(opts?.nativePayOnly
          ? {
              whatsappNativePayEnabled: nativePayEnabled,
              metaPaymentConfigurationName: metaPaymentConfigName.trim(),
              metaPaymentGateway: metaPaymentGateway as "razorpay" | "payu",
            }
          : {
              metaCatalogId: catalogId.trim(),
              metaCatalogName: catalogName.trim() || undefined,
              sessionId: verifySessionId || undefined,
            }),
      });
      return res.json();
    },
    onSuccess: (data: { commerceVerificationNote?: string | null }) => {
      const note = data?.commerceVerificationNote?.trim();
      toast({
        title: "Commerce settings saved",
        ...(note ? { description: note } : {}),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/commerce/settings"] });
    },
    onError: (e: Error) => {
      toast({ title: "Could not save", description: e.message, variant: "destructive" });
    },
  });

  const shopifySyncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/commerce/sync/shopify", {
        sessionId: syncSessionId,
        limit: 100,
      });
      return res.json();
    },
    onSuccess: (data: { synced?: number; errors?: number }) => {
      toast({
        title: "Shopify sync complete",
        description: `Synced ${data.synced ?? 0} product(s) to Meta catalog.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/commerce/settings"] });
    },
    onError: (e: Error) => {
      toast({ title: "Shopify sync failed", description: e.message, variant: "destructive" });
    },
  });

  const shopifyCsvMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", "/api/commerce/sync/shopify/csv?limit=500");
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename =
        match?.[1] || `whatsapp-catalog-${new Date().toISOString().slice(0, 10)}.csv`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      return { ok: true };
    },
    onSuccess: () => {
      toast({
        title: "CSV downloaded",
        description:
          "Upload this file in Commerce Manager → Catalog → Data sources. Required for many SMB WhatsApp accounts.",
      });
    },
    onError: (e: Error) => {
      toast({ title: "CSV export failed", description: e.message, variant: "destructive" });
    },
  });

  const { data: existingFlows = [] } = useQuery<Array<{ name: string }>>({
    queryKey: ["/api/automation-flows"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/automation-flows");
      return res.json();
    },
  });

  const installPresetsMutation = useMutation({
    mutationFn: async () => {
      const names = new Set(existingFlows.map((f) => f.name));
      const toCreate = getCommerceFlowsToCreate(names);
      if (!toCreate.length) {
        return { created: 0, skipped: true };
      }
      for (const flow of toCreate) {
        const res = await apiRequest("POST", "/api/automation-flows", flow);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || "Failed to create flow");
        }
      }
      return { created: toCreate.length, skipped: false };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation-flows"] });
      if (result.skipped) {
        toast({
          title: "Presets already installed",
          description: `Flows starting with "${COMMERCE_FLOW_NAME_PREFIX}" already exist.`,
        });
      } else {
        toast({
          title: "Commerce flows created",
          description: `Added ${result.created} draft flow(s). Open Flows, set your WhatsApp session & template, then publish.`,
        });
      }
    },
    onError: (e: Error) => {
      toast({ title: "Could not install presets", description: e.message, variant: "destructive" });
    },
  });

  const shopifySetupMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/commerce/shopify-automations-setup", {
        brandName: setupBrandName.trim() || undefined,
        storeUrl: setupStoreUrl.trim() || undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Setup failed");
      return data as ShopifySetupResult;
    },
    onSuccess: (result) => {
      setShopifySetupResult(result);
      queryClient.invalidateQueries({ queryKey: ["/api/automation-flows"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chatbots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-assistants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({
        title: "Shopify automations installed",
        description: `Created ${result.summary.flowsCreated} flow(s) for ${
          result.brandName || "your store"
        }. Publish flows after Meta template approval.`,
      });
    },
    onError: (e: Error) => {
      toast({ title: "Setup failed", description: e.message, variant: "destructive" });
    },
  });

  const { data: analytics } = useQuery({
    queryKey: ["/api/commerce/analytics", syncSessionId],
    queryFn: async () => {
      const qs = syncSessionId ? `?sessionId=${encodeURIComponent(syncSessionId)}` : "";
      const res = await apiRequest("GET", `/api/commerce/analytics${qs}`);
      return res.json() as {
        catalogProductCount?: number | null;
        commerceAnalyticsNote?: string | null;
        lastCartCheckoutAt?: string | null;
        lastCartCheckoutStatus?: string | null;
      };
    },
    enabled: !!settings?.metaCatalogId,
  });

  const { data: catalogProductsForTools } = useQuery<{
    products: CatalogProduct[];
    warning?: string;
    commerceNote?: string;
  }>({
    queryKey: ["/api/commerce/catalog/products", syncSessionId, catalogId],
    queryFn: async () => {
      const qs = new URLSearchParams({
        sessionId: syncSessionId,
        catalogId: catalogId.trim(),
        limit: "40",
      });
      const res = await apiRequest("GET", `/api/commerce/catalog/products?${qs}`);
      return res.json();
    },
    enabled: !!syncSessionId && !!catalogId.trim(),
    staleTime: 60_000,
  });

  const { data: shopifyCollectionsData } = useQuery<{
    collections: Array<{ id: string; title: string; productsCount?: number }>;
    productSets: Record<string, { productSetId: string; title: string; syncedAt: string }>;
  }>({
    queryKey: ["/api/commerce/shopify/collections"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/commerce/shopify/collections");
      return res.json();
    },
    enabled: !!settings?.shopifyConnected,
  });

  const collectionSyncMutation = useMutation({
    mutationFn: async (opts: { collectionId: string; collectionTitle: string; mode: "catalog" | "product_set" }) => {
      const res = await apiRequest("POST", "/api/commerce/shopify/collections/sync", {
        sessionId: syncSessionId,
        collectionId: opts.collectionId,
        collectionTitle: opts.collectionTitle,
        mode: opts.mode,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Collection synced to Meta" });
      queryClient.invalidateQueries({ queryKey: ["/api/commerce/shopify/collections"] });
    },
    onError: (e: Error) => {
      const smb =
        /Meta blocked writing|catalog_management|SMB/i.test(e.message) ||
        /Elastic Search rule/i.test(e.message);
      toast({
        title: smb ? "Meta catalog API limited" : "Sync failed",
        description: e.message,
        variant: smb ? "default" : "destructive",
      });
    },
  });

  const collectionSendMutation = useMutation({
    mutationFn: async () => {
      const to = phoneFromContactId(contacts, collectionContactId).replace(/\s/g, "");
      if (!to) throw new Error("Select a contact with a valid phone number");
      const res = await apiRequest("POST", "/api/commerce/shopify/collections/send", {
        sessionId: syncSessionId,
        to,
        collectionId: selectedCollectionId,
        body: "Browse this collection",
      });
      return res.json();
    },
    onSuccess: () => toast({ title: "Collection message sent" }),
    onError: (e: Error) => {
      toast({ title: "Send failed", description: e.message, variant: "destructive" });
    },
  });

  const autoSyncMutation = useMutation({
    mutationFn: async (patch: {
      shopifySyncEnabled?: boolean;
      woocommerceSyncEnabled?: boolean;
      shopifyCheckoutEnabled?: boolean;
      woocommerceCheckoutEnabled?: boolean;
    }) => {
      const res = await apiRequest("PUT", "/api/commerce/settings", patch);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commerce/settings"] });
    },
    onError: (e: Error) => {
      toast({ title: "Could not update auto-sync", description: e.message, variant: "destructive" });
    },
  });

  const testSendMutation = useMutation({
    mutationFn: async () => {
      const to = phoneFromContactId(contacts, testContactId).replace(/\s/g, "");
      if (!to) throw new Error("Select a contact with a valid phone number");
      const res = await apiRequest("POST", "/api/messages/send-catalog-product", {
        sessionId: syncSessionId,
        to,
        productRetailerId: testProductId.trim(),
        body: "Test catalog product from Commerce",
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Test product sent", description: "Check WhatsApp on the selected contact." });
    },
    onError: (e: Error) => {
      toast({ title: "Test send failed", description: e.message, variant: "destructive" });
    },
  });

  const broadcastMutation = useMutation({
    mutationFn: async () => {
      const recipients = phonesFromContactIds(contacts, broadcastContactIds);
      if (recipients.length === 0) {
        throw new Error("Select at least one contact");
      }
      const res = await apiRequest("POST", "/api/commerce/broadcast-catalog", {
        sessionId: syncSessionId,
        recipients,
        productRetailerIds: broadcastProductIds,
        body: broadcastBody,
        sectionTitle: "Products",
      });
      return (await res.json()) as { sent: number; failed: number; errors: string[] };
    },
    onSuccess: (data) => {
      toast({
        title: "Catalog broadcast finished",
        description: `Sent to ${data.sent} recipient(s)${data.failed ? `, ${data.failed} failed` : ""}.`,
      });
    },
    onError: (e: Error) => {
      toast({ title: "Broadcast failed", description: e.message, variant: "destructive" });
    },
  });

  const wooSyncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/commerce/sync/woocommerce", {
        sessionId: syncSessionId,
        limit: 100,
      });
      return res.json();
    },
    onSuccess: (data: { synced?: number; errors?: number }) => {
      toast({
        title: "WooCommerce sync complete",
        description: `Synced ${data.synced ?? 0} product(s) to Meta catalog.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/commerce/settings"] });
    },
    onError: (e: Error) => {
      toast({ title: "WooCommerce sync failed", description: e.message, variant: "destructive" });
    },
  });

  return (
    <div
      className={cn(
        skin ? "space-y-6" : embedded ? "space-y-6" : "container max-w-4xl py-8 space-y-6"
      )}
    >
      {!embedded ? (
        <div className="commerce-page-chrome flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <ShoppingBag className="h-8 w-8 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Commerce</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Connect your Meta Commerce catalog for WhatsApp product messages. Sync Shopify or
                WooCommerce products into that catalog, then send from Inbox or chatbots.{" "}
                <Link href="/commerce/documentation" className="underline font-medium text-foreground">
                  View guide
                </Link>
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild className="shrink-0">
            <Link href="/commerce/documentation">
              <BookOpen className="h-4 w-4 mr-2" />
              Docs
            </Link>
          </Button>
        </div>
      ) : null}

      <CommerceCard>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            Meta setup checklist
          </CardTitle>
          <CardDescription>Complete these in Meta Business Suite before going live.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
            <li>Create or select a catalog in Commerce Manager.</li>
            <li>Link the catalog to your WhatsApp Business Account (phone number).</li>
            <li>
              Optionally assign your BSP as catalog partner (Settings → Partners) if Meta prompts
              you.
            </li>
            <li>Select your catalog below and save — we verify access with your WABA token.</li>
            <li>Sync products from Shopify/Woo, then send from Inbox or broadcasts below.</li>
          </ol>
        </CardContent>
      </CommerceCard>

      <CommerceCard>
        <CardHeader>
          <CardTitle className="text-lg">Meta catalog</CardTitle>
          <CardDescription>
            Choose a catalog linked to your WhatsApp Business account. Catalogs load from Meta when
            you select a session. SMB accounts may require entering the catalog ID manually.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 gap-2 px-2 text-muted-foreground">
                <BookOpen className="h-4 w-4" />
                How to find catalog ID in Meta
                <ChevronDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div
                className={cn(
                  "rounded-lg border p-4 text-sm space-y-3 mt-2",
                  skin ? "commerce-rh-inset" : "bg-muted/40"
                )}
              >
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                  <li>
                    Open{" "}
                    <a
                      href="https://business.facebook.com/commerce"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-foreground"
                    >
                      Meta Commerce Manager
                    </a>{" "}
                    → select the business → <strong>Catalog</strong>.
                  </li>
                  <li>
                    Copy the numeric <strong>Catalog ID</strong> from the URL or catalog settings
                    (product catalog ID — not Store ID or WABA ID).
                  </li>
                  <li>
                    In{" "}
                    <a
                      href="https://business.facebook.com/wa/manage/home/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-foreground"
                    >
                      WhatsApp Manager
                    </a>{" "}
                    → your number → <strong>Catalog</strong> → connect the same catalog.
                  </li>
                  <li>
                    Select your WhatsApp session below, pick the catalog, then{" "}
                    <strong>Save &amp; verify catalog</strong>.
                  </li>
                </ol>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : (
            <>
              {settings?.metaCatalogName ? (
                <p className="text-sm">
                  Saved catalog: <strong>{settings.metaCatalogName}</strong>
                  {settings.metaCatalogId ? (
                    <span className="text-muted-foreground"> ({settings.metaCatalogId})</span>
                  ) : null}
                </p>
              ) : null}

              {officialSessions.length ? (
                <div className="space-y-2">
                  <Label>WhatsApp session</Label>
                  <Select value={verifySessionId} onValueChange={setVerifySessionId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select session" />
                    </SelectTrigger>
                    <SelectContent>
                      {officialSessions.map((s) => (
                        <SelectItem key={s.sessionId} value={s.sessionId}>
                          {sessionDisplayLabel(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Catalogs load automatically for the selected session.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Connect WhatsApp Business API under{" "}
                  <Link href="/integrations" className="underline font-medium">
                    Integrations
                  </Link>{" "}
                  to load and verify catalogs.
                </p>
              )}

              {verifySessionId && officialSessions.length ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="meta-catalog-select">Product catalog</Label>
                    {(metaCatalogsLoading || metaCatalogsFetching) && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Loading from Meta…
                      </span>
                    )}
                  </div>

                  {metaCatalogsError ? (
                    <p className="text-sm text-destructive">
                      {(metaCatalogsError as Error).message || "Could not load catalogs from Meta."}
                    </p>
                  ) : null}

                  {metaCatalogsSmb && metaCatalogs.length === 0 ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                      <p className="font-medium">SMB account — enter catalog ID manually</p>
                      <p className="mt-1 opacity-90">
                        {metaCatalogsNote ||
                          "Meta does not list catalogs via API for SMB WhatsApp accounts. Paste the Catalog ID from Commerce Manager below."}
                      </p>
                    </div>
                  ) : null}

                  {catalogSelectOptions.length > 0 ? (
                    <Select
                      value={catalogId || undefined}
                      onValueChange={(id) => {
                        setCatalogId(id);
                        const match = catalogSelectOptions.find((c) => c.id === id);
                        setCatalogName(match?.name?.trim() || "");
                      }}
                    >
                      <SelectTrigger id="meta-catalog-select">
                        <SelectValue placeholder="Select a catalog linked to this WhatsApp number" />
                      </SelectTrigger>
                      <SelectContent>
                        {catalogSelectOptions.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {formatMetaCatalogLabel(c)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : !metaCatalogsLoading &&
                    !metaCatalogsFetching &&
                    !metaCatalogsSmb &&
                    verifySessionId ? (
                    <p className="text-sm text-muted-foreground">
                      {metaCatalogsNote ||
                        "No catalogs linked to this WhatsApp account. Link a catalog in Meta Commerce Manager → WhatsApp, then refresh."}
                    </p>
                  ) : null}

                  {showManualCatalogId && (
                    <div className="space-y-2">
                      <Label htmlFor="meta-catalog-id-manual">Catalog ID (manual)</Label>
                      <Input
                        id="meta-catalog-id-manual"
                        placeholder="e.g. 1234567890123456"
                        value={catalogId}
                        onChange={(e) => {
                          setCatalogId(e.target.value);
                          if (metaCatalogsSmb) setCatalogName("");
                        }}
                      />
                    </div>
                  )}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void refetchMetaCatalogs()}
                  disabled={
                    metaCatalogsFetching || !verifySessionId || !officialSessions.length
                  }
                >
                  {metaCatalogsFetching ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Refreshing…
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh catalogs
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => saveMutation.mutate(undefined)}
                  disabled={saveMutation.isPending || !catalogId.trim() || !verifySessionId}
                >
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save & verify catalog"
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </CommerceCard>

      <CommerceCard>
        <CardHeader>
          <CardTitle className="text-lg">Store sync → Meta catalog</CardTitle>
          <CardDescription>
            Manual sync pushes up to 100 products per run. Turn on auto-sync to update Meta when
            products change (store webhooks) and refresh the full catalog every 6 hours. Connect
            stores on Integrations and register webhooks there (product create/update/delete).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!catalogId.trim() ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              <p className="font-medium">Catalog ID required</p>
              <p className="mt-1 opacity-90">
                Enter your Meta Catalog ID in the section above and click{" "}
                <strong>Save &amp; verify catalog</strong>. Sync, auto-sync, checkout toggles, and
                product tools stay disabled until then.
              </p>
            </div>
          ) : null}
          {officialSessions.length ? (
            <div className="space-y-2">
              <Label>WhatsApp session (access token)</Label>
              <Select value={syncSessionId} onValueChange={setSyncSessionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select session" />
                </SelectTrigger>
                <SelectContent>
                  {officialSessions.map((s) => (
                    <SelectItem key={s.sessionId} value={s.sessionId}>
                      {sessionDisplayLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border rounded-lg p-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">Shopify</span>
                {settings?.shopifyConnected ? (
                  <Badge variant="secondary">Connected</Badge>
                ) : (
                  <Badge variant="outline">Not connected</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Last sync: {formatSyncTime(settings?.shopifyLastSyncAt)}
                {settings?.shopifyLastSyncStatus === "error" && settings.shopifyLastSyncError
                  ? ` — ${settings.shopifyLastSyncError}`
                  : ""}
              </p>
              <div className="flex items-center gap-2 pt-1">
                <Switch
                  id="shopify-auto-sync"
                  checked={settings?.shopifySyncEnabled ?? false}
                  disabled={!settings?.shopifyConnected || !catalogId.trim() || autoSyncMutation.isPending}
                  onCheckedChange={(checked) =>
                    autoSyncMutation.mutate({ shopifySyncEnabled: checked })
                  }
                />
                <Label htmlFor="shopify-auto-sync" className="text-xs font-normal cursor-pointer">
                  Auto-sync on product webhooks + scheduled full sync
                </Label>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {!settings?.shopifyConnected ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href="/integrations">
                    <Plug className="mr-2 h-4 w-4" />
                    Connect
                  </Link>
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                disabled={!settings?.shopifyConnected || shopifyCsvMutation.isPending}
                onClick={() => shopifyCsvMutation.mutate()}
              >
                {shopifyCsvMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Download CSV
                  </>
                )}
              </Button>
              <Button
                size="sm"
                disabled={
                  !settings?.shopifyConnected ||
                  !catalogId.trim() ||
                  !syncSessionId ||
                  shopifySyncMutation.isPending
                }
                onClick={() => shopifySyncMutation.mutate()}
              >
                {shopifySyncMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sync now
                  </>
                )}
              </Button>
            </div>
          </div>

          {settings?.shopifyLastSyncStatus === "error" &&
          settings.shopifyLastSyncError &&
          /SMB|Unsupported post|not reachable|does not support/i.test(
            settings.shopifyLastSyncError
          ) ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
              <p className="font-medium">API sync blocked — use CSV feed (SMB / permissions)</p>
              <p className="mt-1 opacity-90">
                Click <strong>Download CSV</strong> above, then in Commerce Manager open your
                catalog → <strong>Data sources</strong> → Add items → Upload the CSV. After Meta
                processes the feed (up to ~1 hour), products appear in WhatsApp catalog messages.
              </p>
            </div>
          ) : null}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border rounded-lg p-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">WooCommerce</span>
                {settings?.woocommerceConnected ? (
                  <Badge variant="secondary">Connected</Badge>
                ) : (
                  <Badge variant="outline">Not connected</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Last sync: {formatSyncTime(settings?.woocommerceLastSyncAt)}
                {settings?.woocommerceLastSyncStatus === "error" &&
                settings.woocommerceLastSyncError
                  ? ` — ${settings.woocommerceLastSyncError}`
                  : ""}
              </p>
              <div className="flex items-center gap-2 pt-1">
                <Switch
                  id="woo-auto-sync"
                  checked={settings?.woocommerceSyncEnabled ?? false}
                  disabled={
                    !settings?.woocommerceConnected || !catalogId.trim() || autoSyncMutation.isPending
                  }
                  onCheckedChange={(checked) =>
                    autoSyncMutation.mutate({ woocommerceSyncEnabled: checked })
                  }
                />
                <Label htmlFor="woo-auto-sync" className="text-xs font-normal cursor-pointer">
                  Auto-sync on product webhooks + scheduled full sync
                </Label>
              </div>
            </div>
            <div className="flex gap-2">
              {!settings?.woocommerceConnected ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href="/integrations">
                    <Plug className="mr-2 h-4 w-4" />
                    Connect
                  </Link>
                </Button>
              ) : null}
              <Button
                size="sm"
                disabled={
                  !settings?.woocommerceConnected ||
                  !catalogId.trim() ||
                  !syncSessionId ||
                  wooSyncMutation.isPending
                }
                onClick={() => wooSyncMutation.mutate()}
              >
                {wooSyncMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sync now
                  </>
                )}
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <ExternalLink className="h-3 w-3" />
            Shopify webhooks: products/create, products/update, products/delete. Woo: product.created,
            product.updated, product.deleted.
          </p>
        </CardContent>
      </CommerceCard>

      <CommerceCard>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            WA cart → store checkout
          </CardTitle>
          <CardDescription>
            When a customer submits a catalog cart in WhatsApp, we create a Shopify draft invoice or
            WooCommerce pay link and reply automatically. Product retailer IDs must match store
            SKUs (or Shopify variant IDs).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 border rounded-lg p-4">
            <div className="flex items-center gap-2">
              <Switch
                id="shopify-checkout"
                checked={settings?.shopifyCheckoutEnabled ?? false}
                disabled={
                  !settings?.shopifyConnected || !catalogId.trim() || autoSyncMutation.isPending
                }
                onCheckedChange={(checked) =>
                  autoSyncMutation.mutate({ shopifyCheckoutEnabled: checked })
                }
              />
              <Label htmlFor="shopify-checkout" className="font-normal cursor-pointer">
                Shopify checkout (draft order invoice URL)
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="woo-checkout"
                checked={settings?.woocommerceCheckoutEnabled ?? false}
                disabled={
                  !settings?.woocommerceConnected || !catalogId.trim() || autoSyncMutation.isPending
                }
                onCheckedChange={(checked) =>
                  autoSyncMutation.mutate({ woocommerceCheckoutEnabled: checked })
                }
              />
              <Label htmlFor="woo-checkout" className="font-normal cursor-pointer">
                WooCommerce checkout (order payment URL)
              </Label>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Last cart checkout: {formatSyncTime(settings?.lastCartCheckoutAt)}
            {settings?.lastCartCheckoutStatus === "error" && settings.lastCartCheckoutError
              ? ` — ${settings.lastCartCheckoutError}`
              : ""}
          </p>
        </CardContent>
      </CommerceCard>

      {settings?.metaCatalogId ? (
        <CommerceCard>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Commerce overview
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div className="border rounded-lg p-3 sm:col-span-2">
              <p className="text-muted-foreground text-xs">Catalog products</p>
              <p className="font-semibold text-lg">
                {analytics?.catalogProductCount != null ? analytics.catalogProductCount : "—"}
              </p>
              {analytics?.commerceAnalyticsNote ? (
                <p className="text-xs text-amber-800 dark:text-amber-200 mt-1 leading-snug">
                  {analytics.commerceAnalyticsNote}
                </p>
              ) : null}
            </div>
            <div className="border rounded-lg p-3">
              <p className="text-muted-foreground text-xs">Shopify sync</p>
              <p className="font-medium">{settings.shopifyLastSyncStatus || "—"}</p>
            </div>
            <div className="border rounded-lg p-3">
              <p className="text-muted-foreground text-xs">Woo sync</p>
              <p className="font-medium">{settings.woocommerceLastSyncStatus || "—"}</p>
            </div>
            <div className="border rounded-lg p-3">
              <p className="text-muted-foreground text-xs">Cart checkout</p>
              <p className="font-medium">{settings.lastCartCheckoutStatus || "—"}</p>
            </div>
          </CardContent>
        </CommerceCard>
      ) : null}

      <CommerceCard>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Send className="h-5 w-5" />
            Test catalog send
          </CardTitle>
          <CardDescription>
            Send one catalog product to a contact from your list. Requires an active 24-hour messaging
            window if the contact has not messaged recently.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(catalogProductsForTools?.warning || catalogProductsForTools?.commerceNote) ? (
            <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2">
              {catalogProductsForTools.warning || catalogProductsForTools.commerceNote}
            </p>
          ) : null}
          <div className="grid sm:grid-cols-2 gap-3">
            <ContactRecipientPicker
              mode="single"
              label="Recipient"
              selectedIds={testContactId ? new Set([testContactId]) : new Set()}
              onSelectionChange={(ids) => setTestContactId(Array.from(ids)[0] || "")}
            />
            <div className="space-y-1">
              <Label>Product retailer ID</Label>
              {(catalogProductsForTools?.products || []).length > 0 ? (
                <Select value={testProductId} onValueChange={setTestProductId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select catalog product" />
                  </SelectTrigger>
                  <SelectContent>
                    {(catalogProductsForTools?.products || []).map((p) => (
                      <SelectItem key={p.retailerId} value={p.retailerId}>
                        {p.name} ({p.retailerId})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <>
                  <Input
                    value={testProductId}
                    onChange={(e) => setTestProductId(e.target.value)}
                    placeholder="e.g. jamcrm or retailer id from Meta"
                  />
                  <p className="text-xs text-muted-foreground leading-snug">
                    Manual products in Commerce Manager often have no SKU field — use the{" "}
                    <strong>Content ID</strong> at the top of the product page (e.g.{" "}
                    <code className="text-[10px] bg-muted px-0.5 rounded">46zl0hszmz</code>). If that
                    fails, try the product <strong>title</strong> (<code className="text-[10px] bg-muted px-0.5 rounded">jamcrm</code>
                    ). Item group ID is not the send id.
                  </p>
                </>
              )}
            </div>
          </div>
          <Button
            size="sm"
            disabled={
              !syncSessionId || !testContactId || !testProductId || testSendMutation.isPending
            }
            onClick={() => testSendMutation.mutate()}
          >
            {testSendMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Send test product"
            )}
          </Button>
        </CardContent>
      </CommerceCard>

      <CommerceCard>
        <CardHeader>
          <CardTitle className="text-lg">Catalog broadcast</CardTitle>
          <CardDescription>
            Send a multi-product catalog message (up to 30 products) to contacts from your list.
            Requires campaign send permission.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ContactRecipientPicker
            mode="multiple"
            label="Recipients"
            selectedIds={broadcastContactIds}
            onSelectionChange={setBroadcastContactIds}
          />
          <div className="space-y-1">
            <Label>Message body</Label>
            <Input value={broadcastBody} onChange={(e) => setBroadcastBody(e.target.value)} />
          </div>
          {(catalogProductsForTools?.warning || catalogProductsForTools?.commerceNote) &&
          !(catalogProductsForTools?.products || []).length ? (
            <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2">
              {catalogProductsForTools.warning || catalogProductsForTools.commerceNote}
            </p>
          ) : null}
          <div className="space-y-2 max-h-40 overflow-y-auto border rounded-lg p-3">
            <Label className="text-xs">Products to include</Label>
            {(catalogProductsForTools?.products || []).map((p) => (
              <div key={p.retailerId} className="flex items-center gap-2">
                <Checkbox
                  id={`bc-${p.retailerId}`}
                  checked={broadcastProductIds.includes(p.retailerId)}
                  onCheckedChange={(checked) => {
                    setBroadcastProductIds((prev) =>
                      checked
                        ? [...prev, p.retailerId].slice(0, 30)
                        : prev.filter((id) => id !== p.retailerId)
                    );
                  }}
                />
                <Label htmlFor={`bc-${p.retailerId}`} className="text-xs font-normal cursor-pointer">
                  {p.name}
                </Label>
              </div>
            ))}
          </div>
          <Button
            disabled={
              !syncSessionId ||
              broadcastProductIds.length < 1 ||
              broadcastContactIds.size < 1 ||
              broadcastMutation.isPending
            }
            onClick={() => broadcastMutation.mutate()}
          >
            {broadcastMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              "Send catalog broadcast"
            )}
          </Button>
        </CardContent>
      </CommerceCard>

      <CommerceCard>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            WhatsApp native pay (Meta)
          </CardTitle>
          <CardDescription>
            In-chat UPI payment via Meta payment configuration (India). Requires Razorpay/PayU linked in
            Meta Business Manager. If disabled, flows use Razorpay/Cashfree payment links instead.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="native-pay-toggle">Enable native pay</Label>
            <Switch
              id="native-pay-toggle"
              checked={nativePayEnabled}
              onCheckedChange={setNativePayEnabled}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Payment configuration name</Label>
              <Input
                value={metaPaymentConfigName}
                onChange={(e) => setMetaPaymentConfigName(e.target.value)}
                placeholder="As shown in Meta BM → Payments"
              />
            </div>
            <div className="space-y-1">
              <Label>Gateway</Label>
              <Select value={metaPaymentGateway} onValueChange={setMetaPaymentGateway}>
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
          <Button
            size="sm"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate({ nativePayOnly: true })}
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save payment settings"}
          </Button>
        </CardContent>
      </CommerceCard>

      {settings?.shopifyConnected ? (
        <CommerceCard>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              Shopify collections → WhatsApp
            </CardTitle>
            <CardDescription>
              Sync a collection to your Meta catalog or create a product set, then send a multi-product
              catalog message. If Meta blocks API uploads (common on WhatsApp SMB), add products in Commerce
              Manager or use <strong>Send to contact</strong> below — it sends Shopify SKUs without uploading to Meta.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Collection</Label>
              <Select value={selectedCollectionId} onValueChange={setSelectedCollectionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select collection" />
                </SelectTrigger>
                <SelectContent>
                  {(shopifyCollectionsData?.collections || []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title} ({c.productsCount ?? "?"} products)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedCollectionId &&
              shopifyCollectionsData?.productSets?.[selectedCollectionId] && (
                <p className="text-xs text-muted-foreground">
                  Meta product set:{" "}
                  {shopifyCollectionsData.productSets[selectedCollectionId].productSetId} (synced{" "}
                  {formatSyncTime(
                    shopifyCollectionsData.productSets[selectedCollectionId].syncedAt
                  )}
                  )
                </p>
              )}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={!selectedCollectionId || collectionSyncMutation.isPending}
                onClick={() => {
                  const col = shopifyCollectionsData?.collections?.find(
                    (c) => c.id === selectedCollectionId
                  );
                  if (!col) return;
                  collectionSyncMutation.mutate({
                    collectionId: col.id,
                    collectionTitle: col.title,
                    mode: "catalog",
                  });
                }}
              >
                Sync products to catalog
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!selectedCollectionId || collectionSyncMutation.isPending}
                onClick={() => {
                  const col = shopifyCollectionsData?.collections?.find(
                    (c) => c.id === selectedCollectionId
                  );
                  if (!col) return;
                  collectionSyncMutation.mutate({
                    collectionId: col.id,
                    collectionTitle: col.title,
                    mode: "product_set",
                  });
                }}
              >
                Create Meta product set
              </Button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t">
              <ContactRecipientPicker
                mode="single"
                label="Send to contact"
                selectedIds={collectionContactId ? new Set([collectionContactId]) : new Set()}
                onSelectionChange={(ids) => setCollectionContactId(Array.from(ids)[0] || "")}
              />
              <div className="flex items-end">
                <Button
                  size="sm"
                  disabled={
                    !syncSessionId ||
                    !selectedCollectionId ||
                    !collectionContactId ||
                    collectionSendMutation.isPending
                  }
                  onClick={() => collectionSendMutation.mutate()}
                >
                  {collectionSendMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Send collection message"
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </CommerceCard>
      ) : null}

      <CommerceCard>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Shopify Automations Setup
          </CardTitle>
          <CardDescription>
            One-click setup for any Shopify store: abandoned cart, order confirm, COD, shipping,
            reviews, WhatsApp templates, AI support assistant, and support/COD chatbots. Requires
            Shopify + WhatsApp connected.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="shopify-setup-brand">Brand / store name</Label>
              <Input
                id="shopify-setup-brand"
                placeholder="e.g. Acme Store (optional — auto from Shopify)"
                value={setupBrandName}
                onChange={(e) => setSetupBrandName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="shopify-setup-url">Store website URL</Label>
              <Input
                id="shopify-setup-url"
                placeholder="e.g. https://yourstore.com (optional)"
                value={setupStoreUrl}
                onChange={(e) => setSetupStoreUrl(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={
                shopifySetupMutation.isPending ||
                !settings?.shopifyConnected
              }
              onClick={() => shopifySetupMutation.mutate()}
            >
              {shopifySetupMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Shopify Automations Setup
            </Button>
            <Button variant="outline" asChild>
              <Link href="/flows">Open Flows</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/chatbots">Open Chatbots</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/templates">Open Templates</Link>
            </Button>
          </div>
        </CardContent>
      </CommerceCard>

      <CommerceCard>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Automation presets
          </CardTitle>
          <CardDescription>
            Install draft flows for Shopify (order, paid, abandoned cart, cancelled) and WooCommerce
            (order created/updated). Edit WhatsApp session and template in each flow, connect store
            webhooks on Integrations, then publish.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            disabled={installPresetsMutation.isPending}
            onClick={() => installPresetsMutation.mutate()}
          >
            {installPresetsMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <GitBranch className="mr-2 h-4 w-4" />
            )}
            Install commerce flow presets
          </Button>
          <Button variant="outline" asChild>
            <Link href="/flows">Open Flows</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/commerce/documentation#carousel">How to create carousel</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/templates/create">Create product carousel template</Link>
          </Button>
        </CardContent>
      </CommerceCard>

      <Dialog open={!!shopifySetupResult} onOpenChange={(open) => !open && setShopifySetupResult(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Shopify Automations Setup complete</DialogTitle>
            <DialogDescription>
              Review what was created for {shopifySetupResult?.brandName || "your store"}, then
              follow the test steps below.
            </DialogDescription>
          </DialogHeader>
          {shopifySetupResult ? (
            <div className="space-y-4 text-sm">
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  Flows: {shopifySetupResult.summary.flowsCreated} created,{" "}
                  {shopifySetupResult.summary.flowsSkipped} already existed
                </li>
                <li>
                  Templates: {shopifySetupResult.summary.templatesSubmitted} submitted to Meta,{" "}
                  {shopifySetupResult.summary.templatesSkipped} skipped
                </li>
                {shopifySetupResult.summary.templatesFailed.length > 0 ? (
                  <li className="text-destructive">
                    Failed templates: {shopifySetupResult.summary.templatesFailed.join(", ")}
                  </li>
                ) : null}
                <li>
                  Chatbots:{" "}
                  {shopifySetupResult.chatbots.map((c) => c.name).join(", ") || "already existed"}
                </li>
              </ul>
              {shopifySetupResult.flows.some((f) => f.webhookUrl) ? (
                <div>
                  <p className="font-medium mb-1">Shipping / review webhook URLs</p>
                  <p className="text-muted-foreground text-xs mb-2">
                    Shopify Admin → Settings → Notifications → Webhooks → Order update
                  </p>
                  {shopifySetupResult.flows
                    .filter((f) => f.webhookUrl)
                    .map((f) => (
                      <div key={f.id} className="mb-2">
                        <p className="text-xs font-medium">{f.name}</p>
                        <code className="text-xs break-all block bg-muted p-2 rounded">
                          {f.webhookUrl}
                        </code>
                      </div>
                    ))}
                </div>
              ) : null}
              {shopifySetupResult.warnings.length > 0 ? (
                <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3">
                  <p className="font-medium text-amber-800 dark:text-amber-200">Warnings</p>
                  <ul className="list-disc pl-5 mt-1 text-amber-900 dark:text-amber-100">
                    {shopifySetupResult.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div>
                <p className="font-medium mb-1">How to test</p>
                <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                  {shopifySetupResult.testing.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
