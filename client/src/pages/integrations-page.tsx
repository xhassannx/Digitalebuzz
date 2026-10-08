import { useState, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plug, Edit, Info, Loader2, Copy, CreditCard } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCurrentMemberPermissions } from "@/hooks/useCurrentMemberPermissions";
import { WhatsAppBusinessManager } from "@/components/whatsapp-business-manager";
import { useRatehonkPageSkin } from "@/panel-templates/ratehonk-v1/RatehonkSkinContext";
import {
  attachWhatsAppOAuthMessageListener,
  launchWhatsAppEmbeddedSignupSdk,
  runPostOAuthPhoneSync,
  type EmbeddedSignupLaunchConfig,
} from "@/lib/whatsapp-embedded-signup";
import {
  RhBadge,
  RhSearchField,
  RhSegmentedTabs,
} from "@/panel-templates/ratehonk-v1/components/rh";
import { cn } from "@/lib/utils";
import "@/panel-templates/shared/integrations-dialogs.css";
import {
  WhatsAppOnboardingChecklistDialog,
  type WhatsAppOnboardingPayload,
} from "@/components/whatsapp-onboarding-checklist-dialog";

type Integration = {
  id?: string;
  name: string;
  displayName: string;
  description: string;
  category: "featured" | "flow" | "helper";
  authType: "oauth" | "api_key" | "webhook" | "none";
  status?: "connected" | "not_connected" | "error";
  config?: Record<string, any>;
  credentials?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
};

const INTEGRATION_ICONS: Record<string, string> = {
  "whatsapp-business": "/icons/whatsapp.svg",
  "facebook-lead-ads": "/icons/facebook.svg",
  "google-calendar": "/icons/calendar_31_2x.png",
  "google-sheets": "/icons/icon_1_spreadsheet_x32.png",
  "shopify": "/icons/shopify.svg",
  "zoom-webhook": "/icons/zoom.ico",
  "google-gemini": "/icons/gemini.jpg",
  "openai": "/icons/openai.png",
  "woocommerce":"/icons/woocommerce.svg",
  "tradeindia":"/icons/trade.ico",
  "indiamart":"/icons/indiamart.png",
  "exportersindia":"/icons/expertsindia.ico",
  "calendly":"/icons/calendly.svg",
  "google-contacts":"/icons/google-contact.png",
  "smtp": "/icons/smtp.png",
  "telegram": "/icons/telegram.jpg",
  "n8n": "/icons/n8n.svg",
  "whatsapp-chat-widget": "/icons/whatsapp.svg",
  "whatsapp-link-generator": "/icons/whatsapp.svg",
};

/** Hidden from the integrations catalog (still supported server-side if already connected). */
const HIDDEN_INTEGRATION_NAMES = new Set(["n8n"]);

function normalizeShopifyDomain(raw: string): string {
  let s = raw.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "");
  s = s.replace(/\/$/, "");
  s = s.replace(/\.myshopify\.com$/, "");
  return s;
}

function normalizeWooCommerceSiteUrl(raw: string): string {
  let s = raw.trim();
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) {
    s = `https://${s}`;
  }
  return s.replace(/\/$/, "");
}

function integrationWebhookUrl(integrationName: string, integrationId: string): string {
  return `${window.location.origin}/api/webhooks/${integrationName}/${integrationId}`;
}

type IntegrationTab = "all" | "featured" | "flows";

export default function IntegrationsPage() {
  const skin = useRatehonkPageSkin();
  const [integrationTab, setIntegrationTab] = useState<IntegrationTab>("all");
  const pastelStyles = [
    {
      card: "bg-rose-50 border-rose-300",
      lightBtn: "bg-rose-100 text-rose-900 hover:bg-rose-200",
      darkBtn: "bg-rose-500 text-white hover:bg-rose-600",
    },
    {
      card: "bg-sky-50 border-sky-300",
      lightBtn: "bg-sky-100 text-sky-900 hover:bg-sky-200",
      darkBtn: "bg-sky-500 text-white hover:bg-sky-600",
    },
    {
      card: "bg-emerald-50 border-emerald-300",
      lightBtn: "bg-emerald-100 text-emerald-800 hover:bg-emerald-200",
      darkBtn: "bg-emerald-500 text-white hover:bg-emerald-600",
    },
    {
      card: "bg-violet-50 border-violet-300",
      lightBtn: "bg-violet-100 text-violet-800 hover:bg-violet-200",
      darkBtn: "bg-violet-500 text-white hover:bg-violet-600",
    },
    {
      card: "bg-amber-50 border-amber-300",
      lightBtn: "bg-amber-100 text-amber-800 hover:bg-amber-200",
      darkBtn: "bg-amber-500 text-white hover:bg-amber-600",
    },
  ];

  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("shopify") === "connected") {
      const webhookCount = params.get("webhooks");
      const webhookErrors = params.get("webhook_errors");
      const webhooksSkipped = params.get("webhooks_skipped") === "1";
      toast({
        title: "Shopify connected",
        description: webhooksSkipped
          ? `Store linked via OAuth. Webhooks were not registered — Shopify requires a public HTTPS BASE_URL (not localhost). Update BASE_URL on the server, then use Manage → Register webhooks.`
          : webhookErrors
            ? `Store linked via OAuth. ${webhookCount || 0} webhooks registered; some failed: ${decodeURIComponent(webhookErrors)}`
            : webhookCount && Number(webhookCount) > 0
              ? `Store linked via OAuth. ${webhookCount} webhooks registered automatically on your shop.`
              : "Store linked via OAuth.",
        variant: webhooksSkipped || webhookErrors ? "destructive" : "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      window.history.replaceState({}, "", "/integrations");
    }
    const shopifyErr = params.get("shopify_error");
    if (shopifyErr) {
      toast({
        variant: "destructive",
        title: "Shopify connection failed",
        description: decodeURIComponent(shopifyErr),
      });
      window.history.replaceState({}, "", "/integrations");
    }
  }, [toast]);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [connectionName, setConnectionName] = useState("openai");
  const [configData, setConfigData] = useState<Record<string, string>>({});
  const [isWhatsAppManagerOpen, setIsWhatsAppManagerOpen] = useState(false);
  const [selectedWhatsAppIntegration, setSelectedWhatsAppIntegration] = useState<Integration | null>(null);
  // Google Calendar Connect modal (OAuth with client ID/secret)
  const [isGoogleCalendarConnectOpen, setIsGoogleCalendarConnectOpen] = useState(false);
  const [googleCalendarConnectionName, setGoogleCalendarConnectionName] = useState("google-calendar");
  const [googleCalendarClientId, setGoogleCalendarClientId] = useState("");
  const [googleCalendarClientSecret, setGoogleCalendarClientSecret] = useState("");
  const [googleCalendarRedirectUri, setGoogleCalendarRedirectUri] = useState("");
  const [googleCalendarConnectPending, setGoogleCalendarConnectPending] = useState(false);
  // Google Sheets Connect modal (OAuth with client ID/secret)
  const [isGoogleSheetsConnectOpen, setIsGoogleSheetsConnectOpen] = useState(false);
  const [googleSheetsConnectionName, setGoogleSheetsConnectionName] = useState("google-sheets");
  const [googleSheetsClientId, setGoogleSheetsClientId] = useState("");
  const [googleSheetsClientSecret, setGoogleSheetsClientSecret] = useState("");
  const [googleSheetsRedirectUri, setGoogleSheetsRedirectUri] = useState("");
  const [googleSheetsConnectPending, setGoogleSheetsConnectPending] = useState(false);
  // Google Contacts Connect modal (OAuth with client ID/secret)
  const [isGoogleContactsConnectOpen, setIsGoogleContactsConnectOpen] = useState(false);
  const [googleContactsConnectionName, setGoogleContactsConnectionName] = useState("google-contacts");
  const [googleContactsClientId, setGoogleContactsClientId] = useState("");
  const [googleContactsClientSecret, setGoogleContactsClientSecret] = useState("");
  const [googleContactsRedirectUri, setGoogleContactsRedirectUri] = useState("");
  const [googleContactsConnectPending, setGoogleContactsConnectPending] = useState(false);
  // Calendly Connect modal (Personal Token)
  const [isCalendlyConnectOpen, setIsCalendlyConnectOpen] = useState(false);
  const [calendlyConnectionName, setCalendlyConnectionName] = useState("calendly");
  const [calendlyPersonalToken, setCalendlyPersonalToken] = useState("");
  const [calendlyConnectPending, setCalendlyConnectPending] = useState(false);
  const [isShopifyConnectOpen, setIsShopifyConnectOpen] = useState(false);
  const [shopifyConnectionName, setShopifyConnectionName] = useState("shopify");
  const [shopifyShopDomain, setShopifyShopDomain] = useState("");
  const [shopifyOAuthPending, setShopifyOAuthPending] = useState(false);
  const [shopifyRegisterWebhooksPending, setShopifyRegisterWebhooksPending] = useState(false);
  const [isShopifyConfigureOpen, setIsShopifyConfigureOpen] = useState(false);
  const [shopifyWebhookIntegrationId, setShopifyWebhookIntegrationId] = useState<string | null>(null);
  const [isWooCommerceConnectOpen, setIsWooCommerceConnectOpen] = useState(false);
  const [wooConnectionName, setWooConnectionName] = useState("woocommerce");
  const [wooSiteUrl, setWooSiteUrl] = useState("");
  const [wooConsumerKey, setWooConsumerKey] = useState("");
  const [wooConsumerSecret, setWooConsumerSecret] = useState("");
  const [wooConnectPending, setWooConnectPending] = useState(false);
  const [isWooCommerceConfigureOpen, setIsWooCommerceConfigureOpen] = useState(false);
  const [wooWebhookIntegrationId, setWooWebhookIntegrationId] = useState<string | null>(null);
  // IndiaMart Configure modal (Token display and regeneration)
  const [isIndiaMartConfigureOpen, setIsIndiaMartConfigureOpen] = useState(false);
  const [indiaMartToken, setIndiaMartToken] = useState("");
  const [indiaMartRegeneratePending, setIndiaMartRegeneratePending] = useState(false);
  const [indiaMartGeneratePending, setIndiaMartGeneratePending] = useState(false);
  // ExportersIndia Configure modal (Token display and regeneration)
  const [isExportersIndiaConfigureOpen, setIsExportersIndiaConfigureOpen] = useState(false);
  const [exportersIndiaToken, setExportersIndiaToken] = useState("");
  const [exportersIndiaRegeneratePending, setExportersIndiaRegeneratePending] = useState(false);
  const [exportersIndiaGeneratePending, setExportersIndiaGeneratePending] = useState(false);
  /** After Meta OAuth with multiple WABAs — pick which lines become inbox sessions (no server .env). */
  const [waPendingPickOpen, setWaPendingPickOpen] = useState(false);
  const [waPendingIntegrationId, setWaPendingIntegrationId] = useState<string | null>(null);
  const [waPendingPhones, setWaPendingPhones] = useState<
    Array<{ id: string; display_phone_number?: string; wabaName?: string; wabaId?: string; verified_name?: string }>
  >([]);
  const [waPendingSelectedIds, setWaPendingSelectedIds] = useState<Set<string>>(new Set());
  const [waPendingSubmitting, setWaPendingSubmitting] = useState(false);
  const [waOnboardingOpen, setWaOnboardingOpen] = useState(false);
  const [waOnboarding, setWaOnboarding] = useState<WhatsAppOnboardingPayload | null>(null);

  const showWaOnboardingChecklist = useCallback((onboarding: WhatsAppOnboardingPayload | null | undefined) => {
    if (onboarding?.steps?.length) {
      setWaOnboarding(onboarding);
      setWaOnboardingOpen(true);
    }
  }, []);

  const completeWaEmbeddedSignup = useCallback(
    async (payload: {
      businessId?: string;
      wabaId?: string;
      phoneNumberId?: string;
    }) => {
      for (let attempt = 0; attempt < 6; attempt++) {
        const res = await apiRequest("POST", "/api/whatsapp/complete-onboarding", payload);
        const data = await res.json();
        if (data.success) {
          return data as { onboarding?: WhatsAppOnboardingPayload };
        }
        if (data.code === "NO_INTEGRATION" && attempt < 5) {
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        throw new Error(data.error || "Failed to complete WhatsApp setup");
      }
      throw new Error("WhatsApp integration not ready — finish login and try again.");
    },
    []
  );

  const [isPaymentWizardOpen, setIsPaymentWizardOpen] = useState(false);
  const [paymentWizardProvider, setPaymentWizardProvider] = useState<"razorpay" | "cashfree" | "stripe" | null>(null);
  const [paymentWizardEditingId, setPaymentWizardEditingId] = useState<string | null>(null);
  const [paymentWizardPublicKey, setPaymentWizardPublicKey] = useState("");
  const [paymentWizardSecret, setPaymentWizardSecret] = useState("");
  const [paymentWizardWebhookSecret, setPaymentWizardWebhookSecret] = useState("");
  const [paymentWizardConnectionName, setPaymentWizardConnectionName] = useState("");
  const [paymentWizardForContacts, setPaymentWizardForContacts] = useState(true);
  const [paymentWizardForSubscription, setPaymentWizardForSubscription] = useState(false);
  const [paymentWizardPending, setPaymentWizardPending] = useState(false);

  const { data: availableIntegrations = [], isLoading: isLoadingAvailable } = useQuery<Integration[]>({
    queryKey: ["/api/integrations/available"],
  });

  const { data: connectedIntegrations = [], isLoading: isLoadingConnected } = useQuery<Integration[]>({
    queryKey: ["/api/integrations"],
  });

  const { isOwnerOrAdmin } = useCurrentMemberPermissions();

  const { data: paymentSetupInfo } = useQuery<{
    razorpayWebhookUrl?: string;
    razorpaySubscriptionWebhookUrl?: string;
    stripeSubscriptionWebhookUrl?: string;
    cashfreeWebhookUrl?: string;
    notes?: string[];
  }>({
    queryKey: ["/api/integrations/payment-gateways/setup-info"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/integrations/payment-gateways/setup-info");
      return res.json();
    },
    enabled: isPaymentWizardOpen,
  });

  const { data: shopifyWebhookStatus, refetch: refetchShopifyWebhookStatus } = useQuery<{
    webhookUrl: string;
    baseUrl: string;
    storedRegistered: string[];
    remoteWebhooks: Array<{ id: number; topic: string; address: string }>;
    remoteCount: number;
    remoteError?: string | null;
    note?: string;
  }>({
    queryKey: ["/api/integrations/shopify/webhook-status"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/integrations/shopify/webhook-status");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to load Shopify webhook status");
      }
      return data;
    },
    enabled: isShopifyConfigureOpen,
  });

  const openWaPendingPicker = useCallback(
    async (integrationId: string) => {
      try {
        const res = await apiRequest(
          "GET",
          `/api/integrations/whatsapp-business/pending-session-phones/${integrationId}`
        );
        if (!res.ok) {
          toast({
            variant: "destructive",
            title: "Could not load WhatsApp numbers",
            description: "Try refreshing the page or reconnect WhatsApp Business.",
          });
          return;
        }
        const data = await res.json();
        setWaPendingIntegrationId(integrationId);
        setWaPendingPhones(data.phones || []);
        setWaPendingSelectedIds(new Set());
        setWaPendingPickOpen(true);
      } catch (e: any) {
        toast({
          variant: "destructive",
          title: "Error",
          description: e.message || "Failed to load pending numbers",
        });
      }
    },
    [toast]
  );

  const connectedMap = new Map(connectedIntegrations.map((int) => [int.name, int]));

  const primaryConnectedByName = (name: string): Integration | undefined =>
    connectedIntegrations.find((i) => i.name === name && i.status === "connected");

  const statusForIntegrationName = (name: string): Integration["status"] => {
    const matches = connectedIntegrations.filter((i) => i.name === name);
    if (matches.some((i) => i.status === "connected")) return "connected";
    if (matches.length > 0) return matches[0].status ?? "not_connected";
    return "not_connected";
  };

  const integrations = availableIntegrations
    .filter((integration) => !HIDDEN_INTEGRATION_NAMES.has(integration.name))
    .map((integration) => {
      const connected = primaryConnectedByName(integration.name);
      return {
        ...integration,
        id: connected?.id,
        status: statusForIntegrationName(integration.name),
        config: connected?.config,
      };
    });

  const openPaymentWizard = useCallback(
    (
      provider: "razorpay" | "cashfree" | "stripe",
      opts?: { mode: "new" | "edit"; record?: Integration }
    ) => {
      setPaymentWizardProvider(provider);
      if (opts?.mode === "edit" && opts.record?.id) {
        setPaymentWizardEditingId(opts.record.id);
        const c = (opts.record.credentials || {}) as Record<string, string>;
        const cfg = (opts.record.config || {}) as Record<string, unknown>;
        if (provider === "razorpay") {
          setPaymentWizardPublicKey(c.keyId || c.key_id || "");
          setPaymentWizardSecret(c.keySecret || c.key_secret || "");
        } else if (provider === "stripe") {
          setPaymentWizardPublicKey("");
          setPaymentWizardSecret(c.secretKey || c.secret_key || "");
        } else {
          setPaymentWizardPublicKey(c.clientId || c.client_id || "");
          setPaymentWizardSecret(c.clientSecret || c.client_secret || "");
        }
        setPaymentWizardWebhookSecret(c.webhookSecret || c.webhook_secret || "");
        setPaymentWizardConnectionName(
          typeof cfg.connectionName === "string" ? cfg.connectionName : provider
        );
        setPaymentWizardForContacts(
          provider === "stripe" ? false : cfg.useForContactPayments !== false
        );
        setPaymentWizardForSubscription(!!cfg.useForOrgSubscription);
      } else {
        setPaymentWizardEditingId(null);
        setPaymentWizardPublicKey("");
        setPaymentWizardSecret("");
        setPaymentWizardWebhookSecret("");
        setPaymentWizardConnectionName(provider);
        if (provider === "stripe") {
          setPaymentWizardForContacts(false);
          setPaymentWizardForSubscription(true);
        } else {
          setPaymentWizardForContacts(true);
          setPaymentWizardForSubscription(false);
        }
      }
      setIsPaymentWizardOpen(true);
    },
    []
  );

  const submitPaymentWizard = useCallback(async () => {
    if (!paymentWizardProvider) return;
    const pub = paymentWizardPublicKey.trim();
    const sec = paymentWizardSecret.trim();
    const wh = paymentWizardWebhookSecret.trim();

    if (paymentWizardProvider === "stripe") {
      if (!isOwnerOrAdmin) {
        toast({
          variant: "destructive",
          title: "Not allowed",
          description: "Only organization owners and admins can configure Stripe for subscription billing.",
        });
        return;
      }
      if (!paymentWizardForSubscription) {
        toast({
          variant: "destructive",
          title: "Enable subscription billing",
          description: "Stripe is only used for organization subscription checkout. Turn on that option below.",
        });
        return;
      }
      if (!sec) {
        toast({
          variant: "destructive",
          title: "Missing secret key",
          description: "Paste your Stripe Secret key (sk_live_… or sk_test_…).",
        });
        return;
      }
      if (!wh) {
        toast({
          variant: "destructive",
          title: "Webhook signing secret required",
          description:
            "Add the endpoint in Stripe using the webhook URL below, then paste the signing secret (whsec_…).",
        });
        return;
      }
    } else {
      if (!paymentWizardForContacts && !paymentWizardForSubscription) {
        toast({
          variant: "destructive",
          title: "Choose a purpose",
          description: "Select at least one: contact payments and/or organization subscription billing.",
        });
        return;
      }
      if (!pub || !sec) {
        toast({
          variant: "destructive",
          title: "Missing credentials",
          description:
            paymentWizardProvider === "razorpay"
              ? "Key ID and Key Secret are required."
              : "App ID and Secret Key are required.",
        });
        return;
      }
    }

    const config: Record<string, unknown> = {
      connectionName: paymentWizardConnectionName.trim() || paymentWizardProvider,
      useForContactPayments: paymentWizardProvider === "stripe" ? false : paymentWizardForContacts,
      useForOrgSubscription: isOwnerOrAdmin ? paymentWizardForSubscription : false,
    };
    const credentials: Record<string, string> =
      paymentWizardProvider === "stripe"
        ? { secretKey: sec, webhookSecret: wh }
        : paymentWizardProvider === "razorpay"
          ? { keyId: pub, keySecret: sec }
          : { clientId: pub, clientSecret: sec };
    if (wh && paymentWizardProvider !== "stripe") credentials.webhookSecret = wh;

    setPaymentWizardPending(true);
    try {
      if (paymentWizardEditingId) {
        await apiRequest("PUT", `/api/integrations/${paymentWizardEditingId}`, { credentials, config });
        queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
        toast({ title: "Saved", description: "Payment gateway connection updated." });
      } else {
        const def = availableIntegrations.find((a) => a.name === paymentWizardProvider);
        if (!def) throw new Error("Integration definition not found");
        await apiRequest("POST", "/api/integrations", {
          name: paymentWizardProvider,
          credentials,
          config,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
        toast({ title: "Connected", description: `${def.displayName} has been connected.` });
      }
      setIsPaymentWizardOpen(false);
      setPaymentWizardProvider(null);
      setPaymentWizardEditingId(null);
    } catch (e: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to save payment gateway",
      });
    } finally {
      setPaymentWizardPending(false);
    }
  }, [
    paymentWizardProvider,
    paymentWizardForContacts,
    paymentWizardForSubscription,
    paymentWizardPublicKey,
    paymentWizardSecret,
    paymentWizardWebhookSecret,
    paymentWizardConnectionName,
    paymentWizardEditingId,
    isOwnerOrAdmin,
    availableIntegrations,
    toast,
    queryClient,
  ]);

  const connectMutation = useMutation({
    mutationFn: async ({ integration, credentials, config }: { integration: Integration; credentials?: Record<string, any>; config?: Record<string, any> }) => {
      const res = await apiRequest("POST", "/api/integrations", {
        name: integration.name,
        credentials,
        config,
      });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      setIsConfigDialogOpen(false);
      setApiKey("");
      setConnectionName("openai");
      setConfigData({});
      toast({
        title: "Integration connected",
        description: "The integration has been successfully connected.",
      });
      // After IndiaMart/ExportersIndia connect, navigate to their setup page for webhook URL
      if (variables.integration?.name === "indiamart") {
        setLocation("/integrations/indiamart");
      } else if (variables.integration?.name === "exportersindia") {
        setLocation("/integrations/exportersindia");
      } else if (variables.integration?.name === "whatsapp-chat-widget") {
        setLocation("/integrations/whatsapp-chat-widget");
      }
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to connect integration",
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
        title: "Integration disconnected",
        description: "The integration has been successfully disconnected.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to disconnect integration",
      });
    },
  });

  const openShopifyIntegration = useCallback((integration: Integration) => {
    const existing = connectedMap.get("shopify");
    setShopifyConnectionName((existing?.config?.connectionName as string) || "shopify");
    const domain =
      (existing?.config?.shop_domain as string) ||
      (existing?.credentials?.shop_domain as string) ||
      "";
    setShopifyShopDomain(domain);
    if (integration.status === "connected" && integration.id) {
      setShopifyWebhookIntegrationId(integration.id);
      setIsShopifyConfigureOpen(true);
    } else {
      setIsShopifyConnectOpen(true);
    }
  }, [connectedMap]);

  const openWooCommerceIntegration = useCallback((integration: Integration) => {
    const existing = connectedMap.get("woocommerce");
    setWooConnectionName((existing?.config?.connectionName as string) || "woocommerce");
    setWooSiteUrl((existing?.config?.site_url as string) || "");
    setWooConsumerKey("");
    setWooConsumerSecret("");
    if (integration.status === "connected" && integration.id) {
      setWooWebhookIntegrationId(integration.id);
      setIsWooCommerceConfigureOpen(true);
    } else {
      setIsWooCommerceConnectOpen(true);
    }
  }, [connectedMap]);

  const handleConnect = async (integration: Integration) => {
    const isConnected = integration.status === "connected";
    if (integration.authType === "oauth") {
      if (integration.name === "google-calendar") {
        setGoogleCalendarConnectionName("google-calendar");
        setGoogleCalendarClientId("");
        setGoogleCalendarClientSecret("");
        try {
          const res = await apiRequest("GET", `/api/integrations/google/google-calendar/oauth/redirect-uri`);
          const data = await res.json();
          setGoogleCalendarRedirectUri(data.redirectUri || `${window.location.origin}/api/integrations/google/google-calendar/oauth/callback`);
        } catch {
          setGoogleCalendarRedirectUri(`${window.location.origin}/api/integrations/google/google-calendar/oauth/callback`);
        }
        setIsGoogleCalendarConnectOpen(true);
      } else if (integration.name === "google-sheets") {
        setGoogleSheetsConnectionName("google-sheets");
        setGoogleSheetsClientId("");
        setGoogleSheetsClientSecret("");
        try {
          const res = await apiRequest("GET", `/api/integrations/google/google-sheets/oauth/redirect-uri`);
          const data = await res.json();
          setGoogleSheetsRedirectUri(data.redirectUri || `${window.location.origin}/api/integrations/google/google-sheets/oauth/callback`);
        } catch {
          setGoogleSheetsRedirectUri(`${window.location.origin}/api/integrations/google/google-sheets/oauth/callback`);
        }
        setIsGoogleSheetsConnectOpen(true);
      } else if (integration.name === "google-contacts") {
        setGoogleContactsConnectionName("google-contacts");
        setGoogleContactsClientId("");
        setGoogleContactsClientSecret("");
        try {
          const res = await apiRequest("GET", `/api/integrations/google/google-contacts/oauth/redirect-uri`);
          const data = await res.json();
          setGoogleContactsRedirectUri(data.redirectUri || `${window.location.origin}/api/integrations/google/google-contacts/oauth/callback`);
        } catch {
          setGoogleContactsRedirectUri(`${window.location.origin}/api/integrations/google/google-contacts/oauth/callback`);
        }
        setIsGoogleContactsConnectOpen(true);
      } else if (integration.name === "calendly") {
        setCalendlyConnectionName("calendly");
        setCalendlyPersonalToken("");
        setIsCalendlyConnectOpen(true);
      } else if (integration.name.startsWith("google-")) {
        try {
          const res = await apiRequest("GET", `/api/integrations/google/${integration.name}/oauth/authorize`);
          const data = await res.json();
          if (data.authUrl) {
            window.location.href = data.authUrl;
          }
        } catch (error: any) {
          toast({
            variant: "destructive",
            title: "Error",
            description: error.message || "Failed to initiate OAuth flow",
          });
        }
      } else if (integration.name === "facebook-lead-ads") {
        try {
          const res = await apiRequest("GET", `/api/integrations/facebook-lead-ads/oauth/authorize`);
          const data = await res.json();
          if (data.authUrl) {
            const width = 600;
            const height = 700;
            const left = window.screenX + (window.outerWidth - width) / 2;
            const top = window.screenY + (window.outerHeight - height) / 2;
            
            const popup = window.open(
              data.authUrl,
              "Facebook OAuth",
              `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
            );

            const messageHandler = (event: MessageEvent) => {
              if (event.data?.type === "FACEBOOK_OAUTH_SUCCESS") {
                window.removeEventListener("message", messageHandler);
                if (popup && !popup.closed) {
                  popup.close();
                }
                queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
                toast({
                  title: "Connected successfully",
                  description: "Facebook Lead Ads integration has been connected.",
                });
              } else if (event.data?.type === "FACEBOOK_OAUTH_ERROR") {
                window.removeEventListener("message", messageHandler);
                if (popup && !popup.closed) {
                  popup.close();
                }
                toast({
                  variant: "destructive",
                  title: "Connection failed",
                  description: event.data.error || "Failed to connect Facebook Lead Ads",
                });
              }
            };

            window.addEventListener("message", messageHandler);

            const checkPopup = setInterval(() => {
              if (popup?.closed) {
                clearInterval(checkPopup);
                window.removeEventListener("message", messageHandler);
              }
            }, 500);

            setTimeout(() => {
              clearInterval(checkPopup);
              window.removeEventListener("message", messageHandler);
              if (popup && !popup.closed) {
                popup.close();
              }
            }, 5 * 60 * 1000);
          }
        } catch (error: any) {
          toast({
            variant: "destructive",
            title: "Error",
            description: error.message || "Failed to initiate OAuth flow",
          });
        }
      } else if (integration.name === "whatsapp-business") {
        try {
          toast({
            title: "Connect WhatsApp Business",
            description:
              "Finish Meta embedded signup. After connect, add your tech partner as Partner in Meta and assign your billing card to this WhatsApp account.",
          });
          const res = await apiRequest("GET", `/api/integrations/whatsapp-business/oauth/authorize`);
          const data = await res.json();

          const finishEmbeddedSignup = async (
            signupBody: { state?: string; wabaId: string; phoneNumberId: string; businessId?: string },
            attempt = 0
          ): Promise<boolean> => {
            await apiRequest(
              "POST",
              "/api/integrations/whatsapp-business/oauth/embedded-signup-session",
              signupBody
            ).catch(() => {});

            const completeRes = await apiRequest("POST", "/api/whatsapp/complete-onboarding", signupBody);
            const completeData = await completeRes.json();
            if (completeData.success) return true;
            if (completeRes.status === 202 && attempt < 8) {
              await new Promise((r) => setTimeout(r, 2000));
              return finishEmbeddedSignup(signupBody, attempt + 1);
            }
            return false;
          };

          const afterPhonesSynced = () => {
            queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
            queryClient.invalidateQueries({ queryKey: ["/api/integrations/whatsapp-business"] });
            queryClient.invalidateQueries({ queryKey: ["/api/integrations/whatsapp-business/added-phones"] });
            queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
            queryClient.invalidateQueries({
              queryKey: ["/api/integrations/whatsapp-business/whatsapp-pending-lines"],
            });
          };

          const startPostOAuthPhoneSync = () => {
            void runPostOAuthPhoneSync(apiRequest, (result) => {
              afterPhonesSynced();
              toast({
                title: "WhatsApp number added",
                description: `Inbox session created (${result.phonesAdded} line(s)).`,
              });
            });
          };

          const oauthHandlers = (oauthState: string | undefined, popupRef: { current: Window | null }) => ({
            onOAuthSuccess: (payload?: { onboarding?: WhatsAppOnboardingPayload }) => {
              detachListener();
              if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
              afterPhonesSynced();
              startPostOAuthPhoneSync();
              showWaOnboardingChecklist(payload?.onboarding);
              toast({
                title: "Connected successfully",
                description: "WhatsApp Business connected — syncing your phone number…",
              });
            },
            onPhonePickRequired: (
              integrationId: string,
              payload?: { onboarding?: WhatsAppOnboardingPayload }
            ) => {
              detachListener();
              if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
              queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
              queryClient.invalidateQueries({
                queryKey: ["/api/integrations/whatsapp-business/whatsapp-pending-lines"],
              });
              if (integrationId) void openWaPendingPicker(integrationId);
              showWaOnboardingChecklist(payload?.onboarding);
              toast({
                title: "Choose WhatsApp numbers",
                description: "Your Meta account has more than one WhatsApp line. Select which ones to add to the inbox.",
              });
            },
            onOAuthError: (error: string) => {
              detachListener();
              if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
              toast({
                variant: "destructive",
                title: "Connection failed",
                description: error,
              });
            },
            onEmbeddedFinish: (body: {
              state?: string;
              wabaId: string;
              phoneNumberId: string;
              businessId?: string;
            }) => {
              void finishEmbeddedSignup(body).then(async (ok) => {
                if (ok) {
                  detachListener();
                  if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
                  queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/integrations/whatsapp-business"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/integrations/whatsapp-business/added-phones"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
                  try {
                    const onboard = await completeWaEmbeddedSignup({
                      businessId: body.businessId,
                      wabaId: body.wabaId,
                      phoneNumberId: body.phoneNumberId,
                    });
                    showWaOnboardingChecklist(onboard.onboarding);
                  } catch {
                    /* optional checklist */
                  }
                  toast({
                    title: "Connected successfully",
                    description: "WhatsApp Business phone number has been added and is ready to use.",
                  });
                } else {
                  toast({
                    variant: "destructive",
                    title: "WhatsApp setup incomplete",
                    description:
                      "Meta sent your WABA details but session creation is still pending. Wait a few seconds or reconnect — check server logs for [WhatsApp Embedded Signup].",
                  });
                }
              });
            },
          });

          let detachListener = () => {};
          const popupRef = { current: null as Window | null };
          const width = 600;
          const height = 700;
          const left = window.screenX + (window.outerWidth - width) / 2;
          const top = window.screenY + (window.outerHeight - height) / 2;
          const popupFeatures = `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`;

          // Prefer server-built authUrl — redirect_uri matches /wb/callback (FB.login SDK often mismatches → error 36008)
          if (data.authUrl) {
            popupRef.current = window.open(
              data.authUrl,
              "WhatsApp Business OAuth",
              popupFeatures
            );
            detachListener = attachWhatsAppOAuthMessageListener(
              popupRef.current,
              data.state as string | undefined,
              oauthHandlers(data.state, popupRef)
            );
          } else if (data.embeddedSignup) {
            detachListener = attachWhatsAppOAuthMessageListener(
              null,
              data.state as string | undefined,
              oauthHandlers(data.state, popupRef)
            );
            popupRef.current = await launchWhatsAppEmbeddedSignupSdk(
              data.embeddedSignup as EmbeddedSignupLaunchConfig
            );
          } else {
            throw new Error("OAuth URL not returned from server");
          }

          const checkPopup = setInterval(() => {
            if (popupRef.current?.closed) {
              clearInterval(checkPopup);
              detachListener();
            }
          }, 500);

          setTimeout(() => {
            clearInterval(checkPopup);
            detachListener();
            if (popupRef.current && !popupRef.current.closed) {
              popupRef.current.close();
            }
          }, 5 * 60 * 1000);
        } catch (error: any) {
          toast({
            variant: "destructive",
            title: "Error",
            description: error.message || "Failed to initiate OAuth flow",
          });
        }
      } else {
        toast({
          title: "OAuth integration",
          description: `OAuth flow for ${integration.displayName} will be implemented soon.`,
        });
      }
    } else if (integration.authType === "api_key") {
      const isConnected = integration?.status === "connected";
      if (integration.name === "shopify") {
        openShopifyIntegration(integration);
      } else if (integration.name === "woocommerce") {
        openWooCommerceIntegration(integration);
      } else if (integration.name === "razorpay" || integration.name === "cashfree" || integration.name === "stripe") {
        openPaymentWizard(integration.name as "razorpay" | "cashfree" | "stripe", { mode: "new" });
      } else if (integration.name === "tradeindia") {
        setSelectedIntegration(integration);
        setIsConfigDialogOpen(true);
        setApiKey("");
        setConfigData({});
        setConnectionName("tradeindia");
        // Pre-fill if already connected
        if (isConnected) {
          const existing = connectedMap.get("tradeindia");
          if (existing?.credentials) {
            setConfigData({
              profileId: existing.credentials.profileId || existing.credentials.profile_id || "",
              userId: existing.credentials.userId || existing.credentials.user_id || "",
            });
            setApiKey(existing.credentials.key || existing.credentials.apiKey || "");
            setConnectionName(existing.config?.connectionName || "tradeindia");
          }
        }
      } else if (integration.name === "indiamart" && isConnected) {
        // For connected IndiaMart, open configure modal
        const existing = connectedMap.get("indiamart");
        if (existing?.credentials?.accessToken || existing?.credentials?.apiKey) {
          setIndiaMartToken(existing.credentials.accessToken || existing.credentials.apiKey || "");
          setIsIndiaMartConfigureOpen(true);
        } else {
          // Fetch token from API
          apiRequest("GET", "/api/integrations/indiamart/config")
            .then(async (res) => {
              if (res.ok) {
                const data = await res.json();
                setIndiaMartToken(data.accessToken || "");
                setIsIndiaMartConfigureOpen(true);
              } else {
                setSelectedIntegration(integration);
                setIsConfigDialogOpen(true);
                setApiKey("");
              }
            })
            .catch(() => {
              setSelectedIntegration(integration);
              setIsConfigDialogOpen(true);
              setApiKey("");
            });
        }
      } else if (integration.name === "exportersindia" && isConnected) {
        // For connected ExportersIndia, open configure modal
        const existing = connectedMap.get("exportersindia");
        if (existing?.credentials?.accessToken || existing?.credentials?.apiKey) {
          setExportersIndiaToken(existing.credentials.accessToken || existing.credentials.apiKey || "");
          setIsExportersIndiaConfigureOpen(true);
        } else {
          // Fetch token from API
          apiRequest("GET", "/api/integrations/exportersindia/config")
            .then(async (res) => {
              if (res.ok) {
                const data = await res.json();
                setExportersIndiaToken(data.accessToken || "");
                setIsExportersIndiaConfigureOpen(true);
              } else {
                setSelectedIntegration(integration);
                setIsConfigDialogOpen(true);
                setApiKey("");
              }
            })
            .catch(() => {
              setSelectedIntegration(integration);
              setIsConfigDialogOpen(true);
              setApiKey("");
            });
        }
      } else {
        setSelectedIntegration(integration);
        setIsConfigDialogOpen(true);
        setApiKey("");
        setConfigData({});
        if (integration.name === "openai") {
          const existing = connectedMap.get("openai");
          setConnectionName(existing?.config?.connectionName || "openai");
        } else if (integration.name === "google-gemini") {
          const existing = connectedMap.get("google-gemini");
          setConnectionName(existing?.config?.connectionName || "google-gemini");
        } else if (integration.name === "indiamart" || integration.name === "exportersindia") {
          const existing = connectedMap.get(integration.name);
          setConnectionName(existing?.config?.connectionName || integration.name);
        } else if (integration.name === "zoom-webhook") {
          const existing = connectedMap.get("zoom-webhook");
          setConnectionName(existing?.config?.connectionName || "zoom-webhook");
          if (existing?.credentials) {
            const creds = existing.credentials as Record<string, string>;
            setApiKey(creds.secretToken || creds.secret_token || "");
          }
        }
      }
    } else if (integration.authType === "webhook") {
      if (integration.name === "zoom-webhook") {
        setSelectedIntegration(integration);
        setIsConfigDialogOpen(true);
        setApiKey("");
        setConfigData({});
        const existing = connectedMap.get("zoom-webhook");
        setConnectionName(existing?.config?.connectionName || "zoom-webhook");
        if (existing?.credentials) {
          const creds = existing.credentials as Record<string, string>;
          setApiKey(creds.secretToken || creds.secret_token || "");
        }
      } else if (integration.name === "n8n") {
        setSelectedIntegration(integration);
        setIsConfigDialogOpen(true);
        setApiKey("");
        setConfigData({});
        const existing = connectedMap.get("n8n");
        setConnectionName(existing?.config?.connectionName || "n8n");
        if (existing?.credentials) {
          const creds = existing.credentials as Record<string, string>;
          setConfigData({ webhookUrl: creds.webhookUrl || creds.webhook_url || "" });
        }
      } else {
        connectMutation.mutate({ integration });
      }
    } else {
      if (integration.name === "whatsapp-chat-widget" && integration.status === "connected") {
        setLocation("/integrations/whatsapp-chat-widget");
        return;
      }
      if (integration.name === "whatsapp-link-generator") {
        setLocation("/integrations/whatsapp-link-generator");
        return;
      }
      connectMutation.mutate({ integration });
    }
  };

  const handleDisconnect = (integration: Integration) => {
    if (integration.id) {
      disconnectMutation.mutate(integration.id);
    }
  };

  const handleGoogleCalendarConnect = async () => {
    const clientId = googleCalendarClientId.trim();
    const clientSecret = googleCalendarClientSecret.trim();
    if (!clientId || !clientSecret) return;
    setGoogleCalendarConnectPending(true);
    try {
      const res = await apiRequest("POST", "/api/integrations/google/google-calendar/oauth/authorize", {
        clientId,
        clientSecret,
        connectionName: googleCalendarConnectionName.trim() || "google-calendar",
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
        description: error.message || "Failed to initiate Google Calendar connection",
      });
      setGoogleCalendarConnectPending(false);
    }
  };

  const copyRedirectUri = () => {
    if (googleCalendarRedirectUri) {
      navigator.clipboard.writeText(googleCalendarRedirectUri);
      toast({ title: "Copied", description: "Redirect URL copied to clipboard." });
    }
  };

  const handleGoogleSheetsConnect = async () => {
    const clientId = googleSheetsClientId.trim();
    const clientSecret = googleSheetsClientSecret.trim();
    if (!clientId || !clientSecret) return;
    setGoogleSheetsConnectPending(true);
    try {
      const res = await apiRequest("POST", "/api/integrations/google/google-sheets/oauth/authorize", {
        clientId,
        clientSecret,
        connectionName: googleSheetsConnectionName.trim() || "google-sheets",
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
        description: error.message || "Failed to initiate Google Sheets connection",
      });
      setGoogleSheetsConnectPending(false);
    }
  };

  const copySheetsRedirectUri = () => {
    if (googleSheetsRedirectUri) {
      navigator.clipboard.writeText(googleSheetsRedirectUri);
      toast({ title: "Copied", description: "Redirect URL copied to clipboard." });
    }
  };

  const handleGoogleContactsConnect = async () => {
    const clientId = googleContactsClientId.trim();
    const clientSecret = googleContactsClientSecret.trim();
    if (!clientId || !clientSecret) return;
    setGoogleContactsConnectPending(true);
    try {
      const res = await apiRequest("POST", "/api/integrations/google/google-contacts/oauth/authorize", {
        clientId,
        clientSecret,
        connectionName: googleContactsConnectionName.trim() || "google-contacts",
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
      setGoogleContactsConnectPending(false);
    }
  };

  const copyContactsRedirectUri = () => {
    if (googleContactsRedirectUri) {
      navigator.clipboard.writeText(googleContactsRedirectUri);
      toast({ title: "Copied", description: "Redirect URL copied to clipboard." });
    }
  };

  const handleCalendlyConnect = async () => {
    const personalToken = calendlyPersonalToken.trim();
    if (!personalToken) return;
    setCalendlyConnectPending(true);
    try {
      // First verify the token
      const verifyRes = await apiRequest("POST", "/api/integrations/calendly/verify-token", {
        personalToken,
      });
      const verifyData = await verifyRes.json();

      if (!verifyData.valid) {
        throw new Error(verifyData.message || "Invalid personal token");
      }

      // Token is valid, proceed with connection
      const credentials: Record<string, any> = {
        access_token: personalToken,
      };
      const config: Record<string, any> = {
        connectionName: calendlyConnectionName.trim() || "calendly",
      };
      await connectMutation.mutateAsync({
        integration: { name: "calendly", authType: "api_key" } as Integration,
        credentials,
        config,
      });
      setIsCalendlyConnectOpen(false);
      setCalendlyPersonalToken("");
      setCalendlyConnectionName("calendly");
      setCalendlyConnectPending(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to connect Calendly. Please verify your personal token is correct.",
      });
      setCalendlyConnectPending(false);
    }
  };

  const handleShopifyOAuth = async () => {
    const shopDomain = normalizeShopifyDomain(shopifyShopDomain);
    if (!shopDomain) {
      toast({
        variant: "destructive",
        title: "Shop domain required",
        description: "Enter your store name (e.g. mystore) before connecting with Shopify.",
      });
      return;
    }
    setShopifyOAuthPending(true);
    try {
      const res = await apiRequest(
        "GET",
        `/api/integrations/shopify/oauth/install?shop=${encodeURIComponent(shopDomain)}&json=1`
      );
      const data = await res.json();
      if (!res.ok || !data.authUrl) {
        throw new Error(data.message || "Could not start Shopify OAuth");
      }
      window.location.href = data.authUrl;
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "OAuth unavailable",
        description:
          error instanceof Error
            ? error.message
            : "Shopify OAuth is not configured on the server. Contact your administrator.",
      });
      setShopifyOAuthPending(false);
    }
  };

  const handleRegisterShopifyWebhooks = async () => {
    setShopifyRegisterWebhooksPending(true);
    try {
      const res = await apiRequest("POST", "/api/integrations/shopify/register-webhooks");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to register webhooks");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      refetchShopifyWebhookStatus();
      if (data.skipped) {
        toast({
          variant: "destructive",
          title: "Webhooks not registered",
          description:
            data.skipReason ||
            "Set BASE_URL to your public HTTPS domain on the server, restart, then try again.",
        });
      } else if (data.registeredCount > 0) {
        toast({
          title: "Webhooks registered",
          description:
            data.remoteCount > 0
              ? `${data.registeredCount} topics registered. Verified ${data.remoteCount} on Shopify for your app.`
              : `${data.registeredCount} webhooks registered on your Shopify store.`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Webhook registration failed",
          description: (data.errors as string[] | undefined)?.join("; ") || "Unknown error",
        });
      }
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Webhook registration failed",
        description: error instanceof Error ? error.message : "Could not register webhooks",
      });
    } finally {
      setShopifyRegisterWebhooksPending(false);
    }
  };

  const handleShopifyDisconnect = () => {
    const connected = connectedMap.get("shopify");
    if (connected?.id) {
      disconnectMutation.mutate(connected.id, {
        onSuccess: () => {
          setIsShopifyConfigureOpen(false);
          setIsShopifyConnectOpen(false);
          setShopifyWebhookIntegrationId(null);
        },
      });
    }
  };

  const handleWooCommerceConnect = async () => {
    const siteUrl = normalizeWooCommerceSiteUrl(wooSiteUrl);
    const consumerKey = wooConsumerKey.trim();
    const consumerSecret = wooConsumerSecret.trim();
    if (!siteUrl || !consumerKey || !consumerSecret) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Store URL, consumer key, and consumer secret are required.",
      });
      return;
    }
    setWooConnectPending(true);
    try {
      const verifyRes = await apiRequest("POST", "/api/integrations/woocommerce/verify-credentials", {
        siteUrl,
        consumerKey,
        consumerSecret,
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.valid) {
        throw new Error(verifyData.message || "Invalid WooCommerce credentials");
      }

      const credentials = {
        consumer_key: consumerKey,
        consumer_secret: consumerSecret,
      };
      const config = {
        connectionName: wooConnectionName.trim() || "woocommerce",
        site_url: siteUrl,
      };
      const existing = connectedMap.get("woocommerce");
      let integrationId: string;
      if (existing?.id) {
        const updateRes = await apiRequest("PUT", `/api/integrations/${existing.id}`, {
          credentials,
          config,
        });
        const updated = await updateRes.json();
        if (!updateRes.ok) {
          throw new Error(updated.message || "Failed to update WooCommerce integration");
        }
        integrationId = updated.id || existing.id;
      } else {
        const createRes = await apiRequest("POST", "/api/integrations", {
          name: "woocommerce",
          credentials,
          config,
        });
        const created = await createRes.json();
        if (!createRes.ok) {
          throw new Error(created.message || "Failed to save WooCommerce integration");
        }
        integrationId = created.id as string;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      setIsWooCommerceConnectOpen(false);
      setWooConsumerKey("");
      setWooConsumerSecret("");
      setWooWebhookIntegrationId(integrationId);
      setIsWooCommerceConfigureOpen(true);
      toast({
        title: "WooCommerce connected",
        description:
          "Copy the webhook URL below into WooCommerce → Settings → Advanced → Webhooks.",
      });
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Connection failed",
        description: error instanceof Error ? error.message : "Failed to connect WooCommerce",
      });
    } finally {
      setWooConnectPending(false);
    }
  };

  const copyWebhookUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({ title: "Copied", description: "Webhook URL copied to clipboard." });
  };

  const handleConfigSubmit = () => {
    if (!selectedIntegration) return;

    const credentials: Record<string, any> = {};
    const config: Record<string, any> = {};

    if (selectedIntegration.name === "zoom-webhook") {
      if (apiKey) {
        credentials.secretToken = apiKey.trim();
        credentials.secret_token = apiKey.trim();
      }
      config.connectionName = connectionName?.trim() || "zoom-webhook";
    } else if (selectedIntegration.name === "n8n") {
      const webhookUrl = (configData.webhookUrl || apiKey || "").trim();
      if (webhookUrl) {
        credentials.webhookUrl = webhookUrl;
        credentials.webhook_url = webhookUrl;
      }
      config.connectionName = connectionName?.trim() || "n8n";
    } else if (selectedIntegration.authType === "api_key") {
      if (selectedIntegration.name === "smtp") {
        if (apiKey) credentials.password = apiKey;
        if (configData.username) credentials.username = configData.username;
        if (configData.host) config.host = configData.host;
        if (configData.port) config.port = parseInt(configData.port);
        if (configData.from) config.from = configData.from;
        if (configData.secure) config.secure = configData.secure === "true";
      } else if (selectedIntegration.name === "openai") {
        if (apiKey) credentials.apiKey = apiKey;
        config.connectionName = connectionName?.trim() || "openai";
      } else if (selectedIntegration.name === "google-gemini") {
        if (apiKey) credentials.apiKey = apiKey;
        config.connectionName = connectionName?.trim() || "google-gemini";
      } else if (selectedIntegration.name === "indiamart") {
        // For IndiaMart, generate access token if not provided
        if (apiKey) {
          credentials.apiKey = apiKey;
          credentials.accessToken = apiKey;
        }
        config.connectionName = connectionName?.trim() || "indiamart";
      } else if (selectedIntegration.name === "exportersindia") {
        // For ExportersIndia, generate access token if not provided
        if (apiKey) {
          credentials.apiKey = apiKey;
          credentials.accessToken = apiKey;
        }
        config.connectionName = connectionName?.trim() || "exportersindia";
      } else if (selectedIntegration.name === "tradeindia") {
        // For Tradeindia, store Profile ID, User ID, and Key
        if (configData.profileId) {
          credentials.profileId = configData.profileId;
          credentials.profile_id = configData.profileId; // Backward compatibility
        }
        if (configData.userId) {
          credentials.userId = configData.userId;
          credentials.user_id = configData.userId; // Backward compatibility
        }
        if (apiKey) {
          credentials.key = apiKey;
          credentials.apiKey = apiKey; // Backward compatibility
        }
        config.connectionName = connectionName?.trim() || "tradeindia";
      } else {
        if (apiKey) {
          credentials.apiKey = apiKey;
        }
      }
    }

    Object.keys(configData).forEach((key) => {
      if (configData[key] && !credentials[key] && !config[key]) {
        config[key] = configData[key];
      }
    });

    connectMutation.mutate({
      integration: selectedIntegration,
      credentials: Object.keys(credentials).length > 0 ? credentials : undefined,
      config: Object.keys(config).length > 0 ? config : undefined,
    });
  };

  const handleIndiaMartGenerateToken = async () => {
    if (!selectedIntegration || selectedIntegration.name !== "indiamart") return;
    setIndiaMartGeneratePending(true);
    try {
      await apiRequest("POST", "/api/integrations", {
        name: "indiamart",
        config: { connectionName: connectionName?.trim() || "indiamart" },
      });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      setIsConfigDialogOpen(false);
      setApiKey("");
      setConnectionName("");
      toast({
        title: "Token generated",
        description: "IndiaMart connection created. Copy the webhook URL and paste it in your IndiaMart Seller Central.",
      });
      const configRes = await apiRequest("GET", "/api/integrations/indiamart/config");
      if (configRes.ok) {
        const data = await configRes.json();
        setIndiaMartToken(data.accessToken || "");
        setIsIndiaMartConfigureOpen(true);
      } else {
        setLocation("/integrations/indiamart");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to generate token",
      });
    } finally {
      setIndiaMartGeneratePending(false);
    }
  };

  const handleIndiaMartRegenerateToken = async () => {
    setIndiaMartRegeneratePending(true);
    try {
      const res = await apiRequest("POST", "/api/integrations/indiamart/regenerate-token");
      if (!res.ok) {
        throw new Error("Failed to regenerate token");
      }
      const data = await res.json();
      setIndiaMartToken(data.accessToken);
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      toast({
        title: "Token regenerated",
        description: "New access token has been generated successfully.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to regenerate token",
      });
    } finally {
      setIndiaMartRegeneratePending(false);
    }
  };

  const copyIndiaMartToken = () => {
    if (indiaMartToken) {
      navigator.clipboard.writeText(indiaMartToken);
      toast({
        title: "Copied",
        description: "Access token copied to clipboard.",
      });
    }
  };

  const handleExportersIndiaGenerateToken = async () => {
    if (!selectedIntegration || selectedIntegration.name !== "exportersindia") return;
    setExportersIndiaGeneratePending(true);
    try {
      await apiRequest("POST", "/api/integrations", {
        name: "exportersindia",
        config: { connectionName: connectionName?.trim() || "exportersindia" },
      });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      setIsConfigDialogOpen(false);
      setApiKey("");
      setConnectionName("");
      toast({
        title: "Token generated",
        description: "ExportersIndia connection created. Copy the webhook URL and paste it in your ExportersIndia account.",
      });
      const configRes = await apiRequest("GET", "/api/integrations/exportersindia/config");
      if (configRes.ok) {
        const data = await configRes.json();
        setExportersIndiaToken(data.accessToken || "");
        setIsExportersIndiaConfigureOpen(true);
      } else {
        setLocation("/integrations/exportersindia");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to generate token",
      });
    } finally {
      setExportersIndiaGeneratePending(false);
    }
  };

  const handleExportersIndiaRegenerateToken = async () => {
    setExportersIndiaRegeneratePending(true);
    try {
      const res = await apiRequest("POST", "/api/integrations/exportersindia/regenerate-token");
      if (!res.ok) {
        throw new Error("Failed to regenerate token");
      }
      const data = await res.json();
      setExportersIndiaToken(data.accessToken);
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      toast({
        title: "Token regenerated",
        description: "New access token has been generated successfully.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to regenerate token",
      });
    } finally {
      setExportersIndiaRegeneratePending(false);
    }
  };

  const copyExportersIndiaToken = () => {
    if (exportersIndiaToken) {
      navigator.clipboard.writeText(exportersIndiaToken);
      toast({
        title: "Copied",
        description: "Access token copied to clipboard.",
      });
    }
  };

  const filteredFeatured = integrations.filter(
    (integration) =>
      integration.category === "featured" &&
      (integration.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        integration.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredFlows = integrations.filter(
    (integration) =>
      integration.category === "flow" &&
      (integration.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        integration.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredHelpers = integrations.filter(
    (integration) =>
      integration.category === "helper" &&
      (integration.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        integration.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredAll = integrations.filter(
    (integration) =>
      integration.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      integration.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const IntegrationCard = ({
    integration,
    index,
  }: {
    integration: Integration;
    index: number;
  }) => {
    const isConnected = integration.status === "connected";
    const icon = INTEGRATION_ICONS[integration.name] || "🔌";
    const colorSet = pastelStyles[index % pastelStyles.length];
    const usePaymentIcon =
      integration.name === "razorpay" || integration.name === "cashfree" || integration.name === "stripe";

    const cardClass = skin
      ? "integrations-rh-card border hover:shadow-md transition-all"
      : `${colorSet.card} border-2 hover:shadow-md transition-all`;

    return (
      <Card className={cardClass}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              {usePaymentIcon ? (
                <div className="w-10 h-10 rounded-lg bg-[#f9f9ff] border border-[#e5e7eb] flex items-center justify-center shrink-0">
                  <CreditCard className="h-6 w-6 text-[#414754]" aria-hidden />
                </div>
              ) : icon.startsWith('/') ? (
                <img src={icon} alt={integration.displayName} className="w-10 h-10 object-contain" />
              ) : (
                <div className="text-3xl">{icon}</div>
              )}
              <div className="flex-1 min-w-0">
                <CardTitle className={cn("text-lg font-bold truncate", skin && "text-[#111c2d]")}>
                  {integration.displayName}
                </CardTitle>
              </div>
            </div>
            {skin ? (
              <RhBadge tone={isConnected ? "success" : "neutral"} className="shrink-0 gap-1">
                <Info className="h-3 w-3" />
                {isConnected ? "Connected" : "Not connected"}
              </RhBadge>
            ) : (
              <Badge
                variant="outline"
                className={`flex items-center gap-1 shrink-0 ${
                  isConnected
                    ? "bg-green-100 text-green-800 border-green-300"
                    : "bg-gray-100 text-gray-600 border-gray-300"
                }`}
              >
                <Info className="h-3 w-3" />
                {isConnected ? "Connected" : "Not Connected"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <CardDescription
            className={cn("mb-4 min-h-[40px]", skin ? "text-[#414754]" : "text-gray-700")}
          >
            {integration.description}
          </CardDescription>
          {integration.name === "whatsapp-business" && (
            <p className="text-xs text-muted-foreground mb-4 border-l-2 border-primary/50 pl-2">
              Using both the app and this panel? Choose <strong>&quot;Connect your WhatsApp Business App&quot;</strong> during setup to sync messages.
            </p>
          )}
          {(integration.name === "razorpay" || integration.name === "cashfree") && (
            <p className="text-xs text-muted-foreground mb-4 border-l-2 border-primary/50 pl-2">
              Use <strong>Connect</strong> to add a merchant account. Mark whether this account collects payments from your contacts or bills subscriptions for organizations you host (owners/admins only for the latter). Add the webhook URL from setup in your gateway dashboard.
            </p>
          )}
          {integration.name === "stripe" && (
            <p className="text-xs text-muted-foreground mb-4 border-l-2 border-primary/50 pl-2">
              <strong>Whitelabel USD billing:</strong> SaaS owner connects Secret key + webhook signing secret, enables organization subscription billing, and registers the Stripe webhook URL from setup. Contact payment links use Razorpay or Cashfree, not Stripe.
            </p>
          )}
          {integration.name === "shopify" && (
            <p className="text-xs text-muted-foreground mb-4 border-l-2 border-primary/50 pl-2">
              Enter your shop domain (e.g. <span className="font-mono">ajicnj-pz</span>) and click{" "}
              <strong>Connect with Shopify</strong>. Webhooks for orders, products, and checkouts are registered
              automatically on connect.
            </p>
          )}
          {integration.name === "woocommerce" && (
            <p className="text-xs text-muted-foreground mb-4 border-l-2 border-primary/50 pl-2">
              Connect with store URL and <strong>REST API keys</strong> (WooCommerce → Settings → Advanced → REST API). After connect, add the webhook URL under Advanced → Webhooks to power <strong>Flows</strong> triggers.
            </p>
          )}
          <div className="flex gap-2">
            {(isConnected &&
              (integration.name === "facebook-lead-ads" ||
                integration.name === "whatsapp-business" ||
                integration.name === "openai" ||
                integration.name === "google-gemini" ||
                integration.name === "google-calendar" ||
                integration.name === "google-sheets" ||
                integration.name === "google-contacts" ||
                integration.name === "calendly" ||
                integration.name === "indiamart" ||
                integration.name === "exportersindia" ||
                integration.name === "whatsapp-chat-widget" ||
                integration.name === "zoom-webhook" ||
                integration.name === "shopify" ||
                integration.name === "woocommerce" ||
                integration.name === "razorpay" ||
                integration.name === "cashfree" ||
                integration.name === "stripe")) ||
            integration.name === "whatsapp-link-generator" ? (
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "flex-1 border-0",
                  skin ? "bg-[#dfe8ff] text-[#0059bb] hover:bg-[#cddaff]" : colorSet.lightBtn,
                )}
                onClick={() => {
                  if (integration.name === "facebook-lead-ads") {
                    setLocation("/integrations/facebook-lead-ads");
                  } else if (integration.name === "whatsapp-business") {
                    window.location.href = "/connect";
                  } else if (integration.name === "openai") {
                    setLocation("/integrations/openai");
                  } else if (integration.name === "google-gemini") {
                    setLocation("/integrations/google-gemini");
                  } else if (integration.name === "google-calendar") {
                    setLocation("/integrations/google-calendar");
                  } else if (integration.name === "google-sheets") {
                    setLocation("/integrations/google-sheets");
                  } else if (integration.name === "google-contacts") {
                    setLocation("/integrations/google-contacts");
                  } else if (integration.name === "calendly") {
                    setLocation("/integrations/calendly");
                  } else if (integration.name === "indiamart") {
                    setLocation("/integrations/indiamart");
                  } else if (integration.name === "exportersindia") {
                    setLocation("/integrations/exportersindia");
                  } else if (integration.name === "whatsapp-chat-widget") {
                    setLocation("/integrations/whatsapp-chat-widget");
                  } else if (integration.name === "whatsapp-link-generator") {
                    setLocation("/integrations/whatsapp-link-generator");
                  } else if (integration.name === "zoom-webhook") {
                    setSelectedIntegration(integration);
                    setIsConfigDialogOpen(true);
                    const existing = connectedMap.get("zoom-webhook");
                    setConnectionName(existing?.config?.connectionName || "zoom-webhook");
                    const creds = existing?.credentials as Record<string, string> | undefined;
                    setApiKey(creds?.secretToken || creds?.secret_token || "");
                  } else if (integration.name === "shopify") {
                    openShopifyIntegration(integration);
                  } else if (integration.name === "woocommerce") {
                    openWooCommerceIntegration(integration);
                  } else if (
                    integration.name === "razorpay" ||
                    integration.name === "cashfree" ||
                    integration.name === "stripe"
                  ) {
                    const rec = integration.id
                      ? connectedIntegrations.find((i) => i.id === integration.id)
                      : primaryConnectedByName(integration.name);
                    if (rec) {
                      openPaymentWizard(integration.name as "razorpay" | "cashfree" | "stripe", {
                        mode: "edit",
                        record: rec,
                      });
                    }
                  }
                }}
              >
                <Edit className="h-4 w-4 mr-2" />
                {integration.name === "whatsapp-link-generator" ? "Open" : "Manage"}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "flex-1 border-0 opacity-50",
                  skin ? "" : colorSet.lightBtn,
                )}
                disabled
              >
                <Edit className="h-4 w-4 mr-2" />
                Manage
              </Button>
            )}
            {integration.name !== "whatsapp-link-generator" &&
            !(isConnected && (integration.name === "shopify" || integration.name === "woocommerce")) ? (
            <Button
              size="sm"
              variant={skin ? "ghost" : "default"}
              className={cn(
                "flex-1 border-0",
                skin
                  ? "bg-[#0059bb] text-white hover:bg-[#004a9a] hover:text-white"
                  : cn("text-white", colorSet.darkBtn),
              )}
              onClick={() => handleConnect(integration)}
              disabled={connectMutation.isPending}
            >
              {connectMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plug className="h-4 w-4 mr-2" />
              )}
              {integration.authType === "api_key"
                ? integration.name === "openai"
                  ? "Connect"
                  : "Configure"
                : "Connect"}
            </Button>
            ) : null}
            {isConnected &&
            (integration.name === "shopify" || integration.name === "woocommerce") &&
            integration.id ? (
              <Button
                size="sm"
                variant="outline"
                className={cn(
                  "flex-1 border-0 text-destructive hover:text-destructive",
                  skin ? "bg-white hover:bg-red-50" : "",
                )}
                onClick={() => handleDisconnect(integration)}
                disabled={disconnectMutation.isPending}
              >
                {disconnectMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Disconnect
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    );
  };

  const integrationTabContent = (
    <>
      {integrationTab === "all" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className={cn("text-xl font-semibold", skin && "text-[#111c2d]")}>
              All Integrations
            </h2>
            {skin ? (
              <RhBadge>{filteredAll.length} apps</RhBadge>
            ) : (
              <Badge variant="secondary">{filteredAll.length} apps</Badge>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredAll.map((integration, index) => (
              <IntegrationCard key={integration.name} integration={integration} index={index} />
            ))}
          </div>
        </div>
      )}
      {integrationTab === "featured" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className={cn("text-xl font-semibold", skin && "text-[#111c2d]")}>Featured</h2>
            {skin ? (
              <RhBadge>{filteredFeatured.length} apps</RhBadge>
            ) : (
              <Badge variant="secondary">{filteredFeatured.length} apps</Badge>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredFeatured.map((integration, index) => (
              <IntegrationCard key={integration.name} integration={integration} index={index} />
            ))}
          </div>
        </div>
      )}
      {integrationTab === "flows" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className={cn("text-xl font-semibold", skin && "text-[#111c2d]")}>Flows</h2>
            {skin ? (
              <RhBadge>{filteredFlows.length + filteredHelpers.length} apps</RhBadge>
            ) : (
              <Badge variant="secondary">{filteredFlows.length + filteredHelpers.length} apps</Badge>
            )}
          </div>
          <div>
            <h3 className={cn("mb-4 text-lg font-medium", skin && "text-[#111c2d]")}>
              Flow Integrations
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredFlows.map((integration, index) => (
                <IntegrationCard key={integration.name} integration={integration} index={index} />
              ))}
            </div>
          </div>
          <div>
            <h3 className={cn("mb-4 text-lg font-medium", skin && "text-[#111c2d]")}>
              Helper Integrations
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredHelpers.map((integration, index) => (
                <IntegrationCard key={integration.name} integration={integration} index={index} />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (isLoadingAvailable || isLoadingConnected) {
    return (
      <div
        className={cn(
          skin ? "flex min-h-[400px] items-center justify-center" : "container mx-auto p-6 flex items-center justify-center min-h-[400px]",
        )}
      >
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading integrations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(skin ? "space-y-6" : "container mx-auto p-6 space-y-6")}>
      <div className={cn("integrations-page-chrome", skin ? "mb-6" : "mb-6")}>
        <div className="flex items-center gap-2">
          {!skin && <Plug className="h-6 w-6 text-primary" />}
          <h1 className="text-3xl font-bold">Integrations</h1>
        </div>
        {!skin && (
          <p className="mt-2 text-muted-foreground">
            Connect third-party services to your workspace.
          </p>
        )}
      </div>

      {skin ? (
        <RhSearchField
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search integrations…"
          className="max-w-xl"
        />
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
          <Input
            placeholder="Search integrations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      )}

      {skin ? (
        <div className="space-y-6">
          <RhSegmentedTabs
            value={integrationTab}
            onChange={setIntegrationTab}
            options={[
              { value: "all", label: "All" },
              { value: "featured", label: "Featured" },
              { value: "flows", label: "Flows" },
            ]}
          />
          {integrationTabContent}
        </div>
      ) : (
        <Tabs
          value={integrationTab}
          onValueChange={(v) => setIntegrationTab(v as IntegrationTab)}
          className="w-full"
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="featured">Featured</TabsTrigger>
            <TabsTrigger value="flows">Flows</TabsTrigger>
          </TabsList>
          <TabsContent value="all" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">All Integrations</h2>
              <Badge variant="secondary">{filteredAll.length} apps</Badge>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredAll.map((integration, index) => (
                <IntegrationCard key={integration.name} integration={integration} index={index} />
              ))}
            </div>
          </TabsContent>
          <TabsContent value="featured" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Featured</h2>
              <Badge variant="secondary">{filteredFeatured.length} apps</Badge>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredFeatured.map((integration, index) => (
                <IntegrationCard key={integration.name} integration={integration} index={index} />
              ))}
            </div>
          </TabsContent>
          <TabsContent value="flows" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Flows</h2>
              <Badge variant="secondary">{filteredFlows.length + filteredHelpers.length} apps</Badge>
            </div>
            <div>
              <h3 className="mb-4 text-lg font-medium">Flow Integrations</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredFlows.map((integration, index) => (
                  <IntegrationCard key={integration.name} integration={integration} index={index} />
                ))}
              </div>
            </div>
            <div>
              <h3 className="mb-4 text-lg font-medium">Helper Integrations</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredHelpers.map((integration, index) => (
                  <IntegrationCard key={integration.name} integration={integration} index={index} />
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Google Calendar Connect modal: OAuth with Client ID / Client Secret */}
      <Dialog open={isGoogleCalendarConnectOpen} onOpenChange={setIsGoogleCalendarConnectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect</DialogTitle>
            <DialogDescription>Enter your Google Cloud OAuth credentials to connect Google Calendar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="gc-connection-name">Connection Name</Label>
              <Input
                id="gc-connection-name"
                value={googleCalendarConnectionName}
                onChange={(e) => setGoogleCalendarConnectionName(e.target.value)}
                placeholder="google-calendar"
              />
            </div>
            <div>
              <Label htmlFor="gc-redirect-uri">OAuth Redirect URL *</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="gc-redirect-uri"
                  readOnly
                  value={googleCalendarRedirectUri}
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
              <Label htmlFor="gc-client-id">Client ID *</Label>
              <Input
                id="gc-client-id"
                value={googleCalendarClientId}
                onChange={(e) => setGoogleCalendarClientId(e.target.value)}
                placeholder="Your Google OAuth Client ID"
                autoComplete="off"
              />
            </div>
            <div>
              <Label htmlFor="gc-client-secret">Client Secret *</Label>
              <Input
                id="gc-client-secret"
                type="password"
                value={googleCalendarClientSecret}
                onChange={(e) => setGoogleCalendarClientSecret(e.target.value)}
                placeholder="Your Google OAuth Client Secret"
                autoComplete="off"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsGoogleCalendarConnectOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleGoogleCalendarConnect}
              disabled={
                !googleCalendarClientId?.trim() ||
                !googleCalendarClientSecret?.trim() ||
                googleCalendarConnectPending
              }
            >
              {googleCalendarConnectPending ? (
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

      {/* Google Sheets Connect modal: OAuth with Client ID / Client Secret */}
      <Dialog open={isGoogleSheetsConnectOpen} onOpenChange={setIsGoogleSheetsConnectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect</DialogTitle>
            <DialogDescription>Enter your Google Cloud OAuth credentials to connect Google Sheets.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="gs-connection-name">Connection Name</Label>
              <Input
                id="gs-connection-name"
                value={googleSheetsConnectionName}
                onChange={(e) => setGoogleSheetsConnectionName(e.target.value)}
                placeholder="google-sheets"
              />
            </div>
            <div>
              <Label htmlFor="gs-redirect-uri">OAuth Redirect URL *</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="gs-redirect-uri"
                  readOnly
                  value={googleSheetsRedirectUri}
                  className="flex-1 bg-muted font-mono text-sm"
                />
                <Button type="button" variant="outline" size="icon" onClick={copySheetsRedirectUri} title="Copy URL">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                When asked to input a redirect URL in Google Cloud, enter the URL above.
              </p>
            </div>
            <div>
              <Label htmlFor="gs-client-id">Client ID *</Label>
              <Input
                id="gs-client-id"
                value={googleSheetsClientId}
                onChange={(e) => setGoogleSheetsClientId(e.target.value)}
                placeholder="Your Google OAuth Client ID"
                autoComplete="off"
              />
            </div>
            <div>
              <Label htmlFor="gs-client-secret">Client Secret *</Label>
              <Input
                id="gs-client-secret"
                type="password"
                value={googleSheetsClientSecret}
                onChange={(e) => setGoogleSheetsClientSecret(e.target.value)}
                placeholder="Your Google OAuth Client Secret"
                autoComplete="off"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsGoogleSheetsConnectOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleGoogleSheetsConnect}
              disabled={
                !googleSheetsClientId?.trim() ||
                !googleSheetsClientSecret?.trim() ||
                googleSheetsConnectPending
              }
            >
              {googleSheetsConnectPending ? (
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

      {/* Google Contacts Connect modal: OAuth with Client ID / Client Secret */}
      <Dialog open={isGoogleContactsConnectOpen} onOpenChange={setIsGoogleContactsConnectOpen}>
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
                value={googleContactsConnectionName}
                onChange={(e) => setGoogleContactsConnectionName(e.target.value)}
                placeholder="google-contacts"
              />
            </div>
            <div>
              <Label htmlFor="gct-redirect-uri">OAuth Redirect URL *</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="gct-redirect-uri"
                  readOnly
                  value={googleContactsRedirectUri}
                  className="flex-1 bg-muted font-mono text-sm"
                />
                <Button type="button" variant="outline" size="icon" onClick={copyContactsRedirectUri} title="Copy URL">
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
                value={googleContactsClientId}
                onChange={(e) => setGoogleContactsClientId(e.target.value)}
                placeholder="Your Google OAuth Client ID"
                autoComplete="off"
              />
            </div>
            <div>
              <Label htmlFor="gct-client-secret">Client Secret *</Label>
              <Input
                id="gct-client-secret"
                type="password"
                value={googleContactsClientSecret}
                onChange={(e) => setGoogleContactsClientSecret(e.target.value)}
                placeholder="Your Google OAuth Client Secret"
                autoComplete="off"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsGoogleContactsConnectOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleGoogleContactsConnect}
              disabled={
                !googleContactsClientId?.trim() ||
                !googleContactsClientSecret?.trim() ||
                googleContactsConnectPending
              }
            >
              {googleContactsConnectPending ? (
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

      {/* Calendly Connect modal: Personal Token */}
      <Dialog open={isCalendlyConnectOpen} onOpenChange={setIsCalendlyConnectOpen}>
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
                value={calendlyConnectionName}
                onChange={(e) => setCalendlyConnectionName(e.target.value)}
                placeholder="calendly"
              />
            </div>
            <div>
              <Label htmlFor="calendly-personal-token">Personal token *</Label>
              <Input
                id="calendly-personal-token"
                type="password"
                value={calendlyPersonalToken}
                onChange={(e) => setCalendlyPersonalToken(e.target.value)}
                placeholder="Your Calendly personal token"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Personal token which should be retrieved from Calendly.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCalendlyConnectOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCalendlyConnect}
              disabled={
                !calendlyPersonalToken?.trim() ||
                calendlyConnectPending
              }
            >
              {calendlyConnectPending ? (
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

      <Dialog
        open={isPaymentWizardOpen}
        onOpenChange={(open) => {
          setIsPaymentWizardOpen(open);
          if (!open) {
            setPaymentWizardProvider(null);
            setPaymentWizardEditingId(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {paymentWizardProvider === "razorpay"
                ? "Razorpay"
                : paymentWizardProvider === "cashfree"
                  ? "Cashfree"
                  : paymentWizardProvider === "stripe"
                    ? "Stripe"
                    : "Payment gateway"}
            </DialogTitle>
            <DialogDescription>
              {paymentWizardProvider === "stripe" ? (
                <>
                  Store the SaaS owner&apos;s Stripe keys for USD panel subscription checkout only. Keys are not read
                  from server environment variables.
                </>
              ) : (
                <>
                  Store API keys for this organization. Payment links, hosted pay pages, and WhatsApp receipts will use
                  the connection you mark for contact payments; subscription checkout can use a separate connection
                  marked for organization billing (owners/admins only).
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="pg-connection-name">Connection name</Label>
              <Input
                id="pg-connection-name"
                value={paymentWizardConnectionName}
                onChange={(e) => setPaymentWizardConnectionName(e.target.value)}
                placeholder={paymentWizardProvider || "gateway"}
                autoComplete="off"
              />
            </div>
            {paymentWizardProvider !== "stripe" ? (
              <div>
                <Label htmlFor="pg-public">
                  {paymentWizardProvider === "cashfree" ? "App ID *" : "Key ID *"}
                </Label>
                <Input
                  id="pg-public"
                  value={paymentWizardPublicKey}
                  onChange={(e) => setPaymentWizardPublicKey(e.target.value)}
                  placeholder={paymentWizardProvider === "cashfree" ? "Cashfree App ID" : "rzp_…"}
                  autoComplete="off"
                />
              </div>
            ) : null}
            <div>
              <Label htmlFor="pg-secret">
                {paymentWizardProvider === "cashfree"
                  ? "Secret key *"
                  : paymentWizardProvider === "stripe"
                    ? "Secret key *"
                    : "Key secret *"}
              </Label>
              <Input
                id="pg-secret"
                type="password"
                value={paymentWizardSecret}
                onChange={(e) => setPaymentWizardSecret(e.target.value)}
                placeholder={
                  paymentWizardProvider === "stripe" ? "sk_live_… or sk_test_…" : "••••••••"
                }
                autoComplete="off"
              />
            </div>
            <div>
              <Label htmlFor="pg-webhook-secret">
                {paymentWizardProvider === "stripe"
                  ? "Webhook signing secret *"
                  : "Webhook secret (optional)"}
              </Label>
              <Input
                id="pg-webhook-secret"
                type="password"
                value={paymentWizardWebhookSecret}
                onChange={(e) => setPaymentWizardWebhookSecret(e.target.value)}
                placeholder={
                  paymentWizardProvider === "stripe" ? "whsec_…" : "For verifying gateway webhooks"
                }
                autoComplete="off"
              />
            </div>
            <div className="space-y-2 rounded-md border p-3 bg-muted/40">
              <p className="text-xs font-medium text-foreground">Use this account for</p>
              {paymentWizardProvider !== "stripe" ? (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={paymentWizardForContacts}
                    onCheckedChange={(v) => setPaymentWizardForContacts(v === true)}
                  />
                  Contact payment links (e.g. amount + WhatsApp pay link)
                </label>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Stripe is not used for contact payment links; use Razorpay or Cashfree for those.
                </p>
              )}
              {isOwnerOrAdmin ? (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={paymentWizardForSubscription}
                    onCheckedChange={(v) => setPaymentWizardForSubscription(v === true)}
                    disabled={paymentWizardProvider === "stripe"}
                  />
                  Organization subscription billing (whitelabel — charge your customers for this panel)
                </label>
              ) : (
                <p className="text-xs text-muted-foreground pl-6">
                  Only organization owners and admins can assign a gateway for subscription billing.
                </p>
              )}
            </div>
            {paymentSetupInfo?.razorpayWebhookUrl && paymentWizardProvider === "razorpay" ? (
              <div className="space-y-1">
                <Label>Razorpay webhook URL (contact payment links)</Label>
                <div className="flex gap-2">
                  <Input readOnly className="font-mono text-xs" value={paymentSetupInfo.razorpayWebhookUrl} />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      void navigator.clipboard.writeText(paymentSetupInfo.razorpayWebhookUrl || "");
                      toast({ title: "Copied" });
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}
            {paymentSetupInfo?.razorpaySubscriptionWebhookUrl && paymentWizardProvider === "razorpay" ? (
              <div className="space-y-1">
                <Label>Razorpay webhook URL (panel subscription billing)</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    className="font-mono text-xs"
                    value={paymentSetupInfo.razorpaySubscriptionWebhookUrl}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      void navigator.clipboard.writeText(
                        paymentSetupInfo.razorpaySubscriptionWebhookUrl || ""
                      );
                      toast({ title: "Copied" });
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}
            {paymentSetupInfo?.stripeSubscriptionWebhookUrl && paymentWizardProvider === "stripe" ? (
              <div className="space-y-1">
                <Label>Stripe webhook URL (panel subscription)</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    className="font-mono text-xs"
                    value={paymentSetupInfo.stripeSubscriptionWebhookUrl}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      void navigator.clipboard.writeText(paymentSetupInfo.stripeSubscriptionWebhookUrl || "");
                      toast({ title: "Copied" });
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}
            {paymentSetupInfo?.cashfreeWebhookUrl && paymentWizardProvider === "cashfree" ? (
              <div className="space-y-1">
                <Label>Cashfree webhook URL</Label>
                <div className="flex gap-2">
                  <Input readOnly className="font-mono text-xs" value={paymentSetupInfo.cashfreeWebhookUrl} />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      void navigator.clipboard.writeText(paymentSetupInfo.cashfreeWebhookUrl || "");
                      toast({ title: "Copied" });
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {paymentWizardEditingId ? (
              <Button
                type="button"
                variant="destructive"
                className="sm:mr-auto"
                disabled={disconnectMutation.isPending}
                onClick={() => {
                  if (!paymentWizardEditingId) return;
                  disconnectMutation.mutate(paymentWizardEditingId, {
                    onSuccess: () => {
                      setIsPaymentWizardOpen(false);
                      setPaymentWizardProvider(null);
                      setPaymentWizardEditingId(null);
                    },
                  });
                }}
              >
                Disconnect
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => setIsPaymentWizardOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void submitPaymentWizard()} disabled={paymentWizardPending}>
              {paymentWizardPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : paymentWizardEditingId ? (
                "Save"
              ) : (
                "Connect"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedIntegration?.name === "openai" ||
              selectedIntegration?.name === "google-gemini" ||
              selectedIntegration?.name === "tradeindia"
                ? "Connect"
                : selectedIntegration?.name === "indiamart" || selectedIntegration?.name === "exportersindia"
                ? `Connect ${selectedIntegration?.displayName}`
                : selectedIntegration?.name === "zoom-webhook"
                ? "Connect"
                : selectedIntegration?.name === "n8n"
                ? "Connect n8n"
                : `Configure ${selectedIntegration?.displayName}`}
            </DialogTitle>
            <DialogDescription>
              {selectedIntegration?.name === "openai"
                ? "Enter your OpenAI connection details."
                : selectedIntegration?.name === "google-gemini"
                ? "Enter your Google AI Studio / Gemini API key (or update the connection name)."
                : selectedIntegration?.name === "tradeindia"
                ? "Enter your Tradeindia connection details."
                : selectedIntegration?.name === "indiamart"
                ? "Get leads from IndiaMart and sync them to our CRM. A webhook token will be auto-generated. After connecting, you'll copy the webhook URL and paste it in your IndiaMart Seller Central (Lead Manager → Settings → Integration Settings)."
                : selectedIntegration?.name === "exportersindia"
                ? "Get leads from ExportersIndia and sync them to our CRM. A webhook token will be auto-generated. After connecting, you'll copy the webhook URL and paste it in your ExportersIndia account settings."
                : selectedIntegration?.name === "zoom-webhook"
                ? "Enter your Zoom webhook connection details."
                : selectedIntegration?.name === "n8n"
                ? "Paste your n8n Webhook node Production URL. WhatsApp events will be sent to this URL so n8n can automate workflows."
                : "Enter your API credentials to connect this integration."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedIntegration?.name === "zoom-webhook" ? (
              <>
                <div>
                  <Label htmlFor="connection-name">Connection Name</Label>
                  <Input
                    id="connection-name"
                    value={connectionName}
                    onChange={(e) => setConnectionName(e.target.value)}
                    placeholder="zoom-webhook"
                  />
                </div>
                <div>
                  <Label htmlFor="secret-token">Secret Token *</Label>
                  <Input
                    id="secret-token"
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Your Zoom webhook secret token"
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Secret token of your Zoom webhook.
                  </p>
                </div>
              </>
            ) : selectedIntegration?.name === "n8n" ? (
              <>
                <div>
                  <Label htmlFor="n8n-connection-name">Connection Name</Label>
                  <Input
                    id="n8n-connection-name"
                    value={connectionName}
                    onChange={(e) => setConnectionName(e.target.value)}
                    placeholder="n8n"
                  />
                </div>
                <div>
                  <Label htmlFor="n8n-webhook-url">n8n Webhook URL *</Label>
                  <Input
                    id="n8n-webhook-url"
                    value={configData.webhookUrl || ""}
                    onChange={(e) => setConfigData({ ...configData, webhookUrl: e.target.value })}
                    placeholder="https://your-n8n.com/webhook/..."
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Production webhook URL from your n8n workflow. Add a Webhook node, activate the workflow, and copy the Production URL.
                  </p>
                </div>
              </>
            ) : selectedIntegration?.authType === "api_key" && (
              <>
                {selectedIntegration.name === "openai" || selectedIntegration.name === "google-gemini" ? (
                  <>
                    <div>
                      <Label htmlFor={`${selectedIntegration.name}-connection-name`}>Connection Name</Label>
                      <Input
                        id={`${selectedIntegration.name}-connection-name`}
                        value={connectionName}
                        onChange={(e) => setConnectionName(e.target.value)}
                        placeholder={selectedIntegration.name === "google-gemini" ? "google-gemini" : "openai"}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`${selectedIntegration.name}-api-key`}>API Key *</Label>
                      <Input
                        id={`${selectedIntegration.name}-api-key`}
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={selectedIntegration.name === "google-gemini" ? "AIza… or Gemini API key" : "sk-..."}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {selectedIntegration.name === "google-gemini"
                          ? "Google AI Studio API key for Gemini."
                          : "OpenAI API key of your account."}
                      </p>
                    </div>
                  </>
                ) : selectedIntegration.name === "smtp" ? (
                  <>
                    <div>
                      <Label htmlFor="smtp-host">SMTP Host</Label>
                      <Input
                        id="smtp-host"
                        value={configData.host || ""}
                        onChange={(e) => setConfigData({ ...configData, host: e.target.value })}
                        placeholder="smtp.gmail.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="smtp-port">Port</Label>
                      <Input
                        id="smtp-port"
                        type="number"
                        value={configData.port || ""}
                        onChange={(e) => setConfigData({ ...configData, port: e.target.value })}
                        placeholder="587"
                      />
                    </div>
                    <div>
                      <Label htmlFor="smtp-username">Username/Email</Label>
                      <Input
                        id="smtp-username"
                        value={configData.username || ""}
                        onChange={(e) => setConfigData({ ...configData, username: e.target.value })}
                        placeholder="your-email@gmail.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="smtp-password">Password</Label>
                      <Input
                        id="smtp-password"
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Your email password or app password"
                      />
                    </div>
                    <div>
                      <Label htmlFor="smtp-from">From Email</Label>
                      <Input
                        id="smtp-from"
                        value={configData.from || ""}
                        onChange={(e) => setConfigData({ ...configData, from: e.target.value })}
                        placeholder="sender@example.com"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="smtp-secure"
                        checked={configData.secure === "true"}
                        onChange={(e) => setConfigData({ ...configData, secure: e.target.checked ? "true" : "false" })}
                        className="rounded"
                      />
                      <Label htmlFor="smtp-secure">Use SSL/TLS (port 465)</Label>
                    </div>
                  </>
                ) : selectedIntegration.name === "tradeindia" ? (
                  <>
                    <div>
                      <Label htmlFor="tradeindia-connection-name">Connection Name</Label>
                      <Input
                        id="tradeindia-connection-name"
                        value={connectionName}
                        onChange={(e) => setConnectionName(e.target.value)}
                        placeholder="tradeindia"
                      />
                    </div>
                    <div>
                      <Label htmlFor="tradeindia-profile-id">Profile ID *</Label>
                      <Input
                        id="tradeindia-profile-id"
                        value={configData.profileId || ""}
                        onChange={(e) => setConfigData({ ...configData, profileId: e.target.value })}
                        placeholder="Enter Profile ID"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Profile ID from your tradeindia account.
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="tradeindia-user-id">User ID *</Label>
                      <Input
                        id="tradeindia-user-id"
                        value={configData.userId || ""}
                        onChange={(e) => setConfigData({ ...configData, userId: e.target.value })}
                        placeholder="Enter User ID"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        User ID from your tradeindia account.
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="tradeindia-key">Key *</Label>
                      <Input
                        id="tradeindia-key"
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Enter Key"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Key from your tradeindia account.
                      </p>
                    </div>
                  </>
                ) : selectedIntegration.name === "indiamart" || selectedIntegration.name === "exportersindia" ? (
                  <>
                    <div>
                      <Label htmlFor="connection-name">Connection Name</Label>
                      <Input
                        id="connection-name"
                        value={connectionName}
                        onChange={(e) => setConnectionName(e.target.value)}
                        placeholder={selectedIntegration.name}
                      />
                    </div>
                    <div>
                      <Label htmlFor="api-key">API Key (optional)</Label>
                      <Input
                        id="api-key"
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Leave empty to auto-generate a webhook token"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Leave empty to auto-generate. Or enter your own API key if you have one. After connecting, you&apos;ll get a webhook URL to paste in your {selectedIntegration.displayName} account.
                      </p>
                    </div>
                  </>
                ) : (
                  <div>
                    <Label htmlFor="api-key">API Key</Label>
                    <Input
                      id="api-key"
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Enter your API key"
                    />
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfigDialogOpen(false)}>
              Cancel
            </Button>
            {(selectedIntegration?.name === "indiamart" || selectedIntegration?.name === "exportersindia") ? (
              <>
                <Button
                  variant="outline"
                  onClick={selectedIntegration?.name === "indiamart" ? handleIndiaMartGenerateToken : handleExportersIndiaGenerateToken}
                  disabled={
                    connectMutation.isPending ||
                    (selectedIntegration?.name === "indiamart" && indiaMartGeneratePending) ||
                    (selectedIntegration?.name === "exportersindia" && exportersIndiaGeneratePending)
                  }
                >
                  {(selectedIntegration?.name === "indiamart" && indiaMartGeneratePending) ||
                  (selectedIntegration?.name === "exportersindia" && exportersIndiaGeneratePending) ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Generate Token"
                  )}
                </Button>
                <Button
                  onClick={handleConfigSubmit}
                  disabled={connectMutation.isPending}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  {connectMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    "Connect"
                  )}
                </Button>
              </>
            ) : (
              <Button
                onClick={handleConfigSubmit}
                disabled={
                  connectMutation.isPending ||
                  (selectedIntegration?.name === "openai" && !apiKey?.trim()) ||
                  (selectedIntegration?.name === "google-gemini" && !apiKey?.trim()) ||
                  (selectedIntegration?.name === "tradeindia" && (!configData.profileId?.trim() || !configData.userId?.trim() || !apiKey?.trim())) ||
                  (selectedIntegration?.name === "zoom-webhook" && !apiKey?.trim()) ||
                  (selectedIntegration?.name === "n8n" && !(configData.webhookUrl || apiKey)?.trim())
                }
                className={selectedIntegration?.name === "zoom-webhook" || selectedIntegration?.name === "n8n" ? "bg-orange-500 hover:bg-orange-600 text-white" : undefined}
              >
                {connectMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  "Connect"
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={waPendingPickOpen}
        onOpenChange={(o) => {
          setWaPendingPickOpen(o);
          if (!o) {
            setWaPendingIntegrationId(null);
            setWaPendingPhones([]);
            setWaPendingSelectedIds(new Set());
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Choose WhatsApp inbox lines</DialogTitle>
            <DialogDescription>
              Select one or more numbers. Each row is a separate line in Meta (for example Team vs Support).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[50vh] overflow-y-auto py-2">
            {waPendingPhones.map((p) => (
              <div key={p.id} className="flex items-start gap-3 rounded-lg border p-3">
                <Checkbox
                  id={`wa-pick-${p.id}`}
                  checked={waPendingSelectedIds.has(p.id)}
                  onCheckedChange={(checked) => {
                    setWaPendingSelectedIds((prev) => {
                      const next = new Set(prev);
                      if (checked === true) next.add(p.id);
                      else next.delete(p.id);
                      return next;
                    });
                  }}
                />
                <Label htmlFor={`wa-pick-${p.id}`} className="cursor-pointer leading-tight flex-1">
                  <span className="font-medium block">{p.display_phone_number || p.id}</span>
                  <span className="text-sm text-muted-foreground">
                    {p.wabaName || "WhatsApp Business"}
                    {p.wabaId ? ` · WABA ${p.wabaId}` : ""}
                  </span>
                </Label>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setWaPendingPickOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={waPendingSelectedIds.size === 0 || waPendingSubmitting || !waPendingIntegrationId}
              onClick={async () => {
                if (!waPendingIntegrationId) return;
                const selectedCount = waPendingSelectedIds.size;
                setWaPendingSubmitting(true);
                try {
                  const res = await apiRequest(
                    "POST",
                    "/api/integrations/whatsapp-business/confirm-pending-session-phones",
                    {
                      integrationId: waPendingIntegrationId,
                      phoneNumberIds: Array.from(waPendingSelectedIds),
                    }
                  );
                  const body = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    throw new Error(body.message || "Failed to add numbers");
                  }
                  setWaPendingPickOpen(false);
                  setWaPendingIntegrationId(null);
                  setWaPendingPhones([]);
                  setWaPendingSelectedIds(new Set());
                  queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
                  queryClient.invalidateQueries({
                    queryKey: ["/api/integrations/whatsapp-business/whatsapp-pending-lines"],
                  });
                  queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
                  queryClient.invalidateQueries({
                    queryKey: ["/api/integrations/whatsapp-business/added-phones"],
                  });
                  toast({
                    title: "Numbers added",
                    description: `${body.added ?? selectedCount} inbox session(s) created.`,
                  });
                } catch (e: unknown) {
                  const msg = e instanceof Error ? e.message : "Failed to add numbers";
                  toast({ variant: "destructive", title: "Could not add numbers", description: msg });
                } finally {
                  setWaPendingSubmitting(false);
                }
              }}
            >
              {waPendingSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding…
                </>
              ) : (
                "Add selected"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedWhatsAppIntegration && (
        <WhatsAppBusinessManager
          integrationId={selectedWhatsAppIntegration.id}
          isOpen={isWhatsAppManagerOpen}
          onClose={() => {
            setIsWhatsAppManagerOpen(false);
            setSelectedWhatsAppIntegration(null);
          }}
        />
      )}

      {/* IndiaMart Configure modal: Token display and regeneration */}
      <Dialog open={isIndiaMartConfigureOpen} onOpenChange={setIsIndiaMartConfigureOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configure IndiaMart</DialogTitle>
            <DialogDescription>Get leads from IndiaMart and sync them to our CRM.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="indiamart-token">Token</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="indiamart-token"
                  readOnly
                  type="password"
                  value={indiaMartToken}
                  className="flex-1 bg-muted font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={copyIndiaMartToken}
                  disabled={!indiaMartToken}
                  title="Copy Token"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleIndiaMartRegenerateToken}
              disabled={indiaMartRegeneratePending}
              className="w-full"
            >
              {indiaMartRegeneratePending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Regenerating...
                </>
              ) : (
                "Regenerate Token"
              )}
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsIndiaMartConfigureOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setIsIndiaMartConfigureOpen(false);
                setLocation("/integrations/indiamart");
              }}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ExportersIndia Configure modal: Token display and regeneration */}
      <Dialog open={isExportersIndiaConfigureOpen} onOpenChange={setIsExportersIndiaConfigureOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configure ExportersIndia</DialogTitle>
            <DialogDescription>Get leads from ExportersIndia and sync them to our CRM.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="exportersindia-token">Token</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="exportersindia-token"
                  readOnly
                  type="password"
                  value={exportersIndiaToken}
                  className="flex-1 bg-muted font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={copyExportersIndiaToken}
                  disabled={!exportersIndiaToken}
                  title="Copy Token"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleExportersIndiaRegenerateToken}
              disabled={exportersIndiaRegeneratePending}
              className="w-full"
            >
              {exportersIndiaRegeneratePending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Regenerating...
                </>
              ) : (
                "Generate New Token"
              )}
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExportersIndiaConfigureOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setIsExportersIndiaConfigureOpen(false);
                setLocation("/integrations/exportersindia");
              }}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ExportersIndia Configure modal: Token display and regeneration */}
      <Dialog open={isExportersIndiaConfigureOpen} onOpenChange={setIsExportersIndiaConfigureOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configure ExportersIndia</DialogTitle>
            <DialogDescription>Get leads from ExportersIndia and sync them to our CRM.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="exportersindia-token">Token</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="exportersindia-token"
                  readOnly
                  type="password"
                  value={exportersIndiaToken}
                  className="flex-1 bg-muted font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={copyExportersIndiaToken}
                  disabled={!exportersIndiaToken}
                  title="Copy Token"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleExportersIndiaRegenerateToken}
              disabled={exportersIndiaRegeneratePending}
              className="w-full"
            >
              {exportersIndiaRegeneratePending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Regenerating...
                </>
              ) : (
                "Generate New Token"
              )}
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExportersIndiaConfigureOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setIsExportersIndiaConfigureOpen(false);
                setLocation("/integrations/exportersindia");
              }}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isShopifyConnectOpen} onOpenChange={setIsShopifyConnectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect Shopify</DialogTitle>
            <DialogDescription>
              Enter your shop domain and authorize via Shopify OAuth. Webhooks are registered automatically after
              connect. Example: <span className="font-mono">ajicnj-pz</span> → ajicnj-pz.myshopify.com
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="shopify-connection-name">Connection name</Label>
              <Input
                id="shopify-connection-name"
                value={shopifyConnectionName}
                onChange={(e) => setShopifyConnectionName(e.target.value)}
                placeholder="shopify"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="shopify-shop-domain">Shop domain *</Label>
              <Input
                id="shopify-shop-domain"
                value={shopifyShopDomain}
                onChange={(e) => setShopifyShopDomain(e.target.value)}
                placeholder="mystore or mystore.myshopify.com"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={() => setIsShopifyConnectOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleShopifyOAuth}
              disabled={shopifyOAuthPending}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {shopifyOAuthPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Redirecting…
                </>
              ) : (
                "Connect with Shopify"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isShopifyConfigureOpen} onOpenChange={setIsShopifyConfigureOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Shopify connected</DialogTitle>
            <DialogDescription>
              Webhooks are registered on your shop via the DigitalEBuzz Commerce app (OAuth). They do{" "}
              <strong>not</strong> appear under Shopify Admin → Settings → Notifications — that page is only for
              manual store webhooks.
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const shopifyConnected = connectedMap.get("shopify");
            const registered =
              shopifyWebhookStatus?.storedRegistered ||
              (shopifyConnected?.config?.webhooksRegistered as string[] | undefined) ||
              [];
            const webhookErrors = (shopifyConnected?.config?.webhooksErrors as string[] | undefined) || [];
            const webhooksSkipped = Boolean(shopifyConnected?.config?.webhooksSkipped);
            const skipReason = shopifyConnected?.config?.webhooksSkipReason as string | undefined;
            const remoteWebhooks = shopifyWebhookStatus?.remoteWebhooks || [];
            const webhookUrl =
              shopifyWebhookStatus?.webhookUrl ||
              (shopifyWebhookIntegrationId
                ? integrationWebhookUrl("shopify", shopifyWebhookIntegrationId)
                : "");
            const shopName =
              (shopifyConnected?.config?.shop_name as string | undefined) ||
              (shopifyConnected?.config?.shop_domain as string | undefined) ||
              "";
            return (
              <div className="space-y-3">
                {shopName ? (
                  <p className="text-sm">
                    Store: <strong>{shopName}</strong>
                  </p>
                ) : null}
                {registered.length > 0 ? (
                  <div className="rounded-md border bg-muted/40 p-3 text-sm">
                    <p className="font-medium text-green-700 dark:text-green-400">
                      {registered.length} webhook topics registered for your app
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {registered.join(", ")}
                    </p>
                    {shopifyWebhookStatus?.remoteCount != null ? (
                      <p className="text-muted-foreground mt-2 text-xs">
                        Verified on Shopify API: <strong>{shopifyWebhookStatus.remoteCount}</strong> active app
                        webhook{shopifyWebhookStatus.remoteCount === 1 ? "" : "s"}
                        {shopifyWebhookStatus.remoteError
                          ? ` (could not verify: ${shopifyWebhookStatus.remoteError})`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                ) : webhooksSkipped ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                    <p className="font-medium">Webhooks not registered yet</p>
                    <p className="mt-1 text-xs opacity-90">
                      {skipReason ||
                        "Shopify requires a public HTTPS BASE_URL. Set BASE_URL on your server, restart, then click Register webhooks below."}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Reconnect via OAuth or click Register webhooks to set up order and product events.
                  </p>
                )}
                {webhookErrors.length > 0 ? (
                  <p className="text-sm text-destructive">
                    Some webhooks failed: {webhookErrors.slice(0, 2).join("; ")}
                  </p>
                ) : null}
                {remoteWebhooks.length > 0 ? (
                  <div className="rounded-md border p-3 text-xs space-y-1 max-h-32 overflow-y-auto">
                    <p className="font-medium text-sm mb-1">Live on Shopify (app webhooks)</p>
                    {remoteWebhooks.map((wh) => (
                      <p key={wh.id} className="text-muted-foreground font-mono break-all">
                        {wh.topic} → {wh.address}
                      </p>
                    ))}
                  </div>
                ) : null}
                {webhookUrl ? (
                  <div className="space-y-2">
                    <Label>Webhook endpoint (your panel)</Label>
                    <div className="flex gap-2">
                      <Input readOnly value={webhookUrl} className="flex-1 font-mono text-xs" />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => copyWebhookUrl(webhookUrl)}
                        title="Copy webhook URL"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : null}
                <p className="text-xs text-muted-foreground border-l-2 border-primary/40 pl-2">
                  To view app webhooks in Shopify: open{" "}
                  <strong>dev.shopify.com → Apps → DigitalEBuzz Commerce → Monitoring / Logs</strong>, not Settings →
                  Notifications.
                </p>
              </div>
            );
          })()}
          <DialogFooter className="gap-2 sm:gap-0 flex-wrap">
            <Button
              type="button"
              variant="destructive"
              onClick={handleShopifyDisconnect}
              disabled={disconnectMutation.isPending}
            >
              {disconnectMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Disconnecting…
                </>
              ) : (
                "Disconnect store"
              )}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleRegisterShopifyWebhooks}
              disabled={shopifyRegisterWebhooksPending}
            >
              {shopifyRegisterWebhooksPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Registering…
                </>
              ) : (
                "Register webhooks"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const existing = connectedMap.get("shopify");
                setShopifyConnectionName((existing?.config?.connectionName as string) || "shopify");
                setShopifyShopDomain(
                  (existing?.config?.shop_domain as string) ||
                    (existing?.credentials?.shop_domain as string) ||
                    "",
                );
                setIsShopifyConfigureOpen(false);
                setIsShopifyConnectOpen(true);
              }}
            >
              Reconnect via OAuth
            </Button>
            <Button type="button" onClick={() => setIsShopifyConfigureOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isWooCommerceConnectOpen} onOpenChange={setIsWooCommerceConnectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect WooCommerce</DialogTitle>
            <DialogDescription>
              Create REST API keys in WooCommerce → Settings → Advanced → REST API (Read/Write). Use your store’s
              public URL.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="woo-connection-name">Connection name</Label>
              <Input
                id="woo-connection-name"
                value={wooConnectionName}
                onChange={(e) => setWooConnectionName(e.target.value)}
                placeholder="woocommerce"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="woo-site-url">Store URL *</Label>
              <Input
                id="woo-site-url"
                value={wooSiteUrl}
                onChange={(e) => setWooSiteUrl(e.target.value)}
                placeholder="https://your-store.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="woo-consumer-key">Consumer key *</Label>
              <Input
                id="woo-consumer-key"
                value={wooConsumerKey}
                onChange={(e) => setWooConsumerKey(e.target.value)}
                placeholder="ck_..."
                className="mt-1 font-mono text-sm"
              />
            </div>
            <div>
              <Label htmlFor="woo-consumer-secret">Consumer secret *</Label>
              <Input
                id="woo-consumer-secret"
                type="password"
                value={wooConsumerSecret}
                onChange={(e) => setWooConsumerSecret(e.target.value)}
                placeholder="cs_..."
                className="mt-1 font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsWooCommerceConnectOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleWooCommerceConnect}
              disabled={wooConnectPending}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {wooConnectPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verifying…
                </>
              ) : (
                "Connect"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isWooCommerceConfigureOpen} onOpenChange={setIsWooCommerceConfigureOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>WooCommerce setup</DialogTitle>
            <DialogDescription>
              Add a webhook in WooCommerce → Settings → Advanced → Webhooks. Delivery URL should be the value below;
              set the secret if your store requires it.
            </DialogDescription>
          </DialogHeader>
          {wooWebhookIntegrationId && (
            <div className="space-y-2">
              <Label>Webhook URL</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={integrationWebhookUrl("woocommerce", wooWebhookIntegrationId)}
                  className="flex-1 font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    copyWebhookUrl(integrationWebhookUrl("woocommerce", wooWebhookIntegrationId))
                  }
                  title="Copy webhook URL"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const existing = connectedMap.get("woocommerce");
                setWooConnectionName((existing?.config?.connectionName as string) || "woocommerce");
                setWooSiteUrl((existing?.config?.site_url as string) || "");
                setWooConsumerKey("");
                setWooConsumerSecret("");
                setIsWooCommerceConfigureOpen(false);
                setIsWooCommerceConnectOpen(true);
              }}
            >
              Update credentials
            </Button>
            <Button type="button" onClick={() => setIsWooCommerceConfigureOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WhatsAppOnboardingChecklistDialog
        open={waOnboardingOpen}
        onOpenChange={setWaOnboardingOpen}
        onboarding={waOnboarding}
      />
    </div>
  );
}