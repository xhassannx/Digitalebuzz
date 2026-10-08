import { useEffect, useState, type ComponentProps } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  Copy,
  FileCode2,
  Globe2,
  Inbox,
  Link2,
  Loader2,
  MessageCircle,
  MessageSquare,
  Mic,
  MoreVertical,
  PanelsTopLeft,
  Phone,
  Plus,
  Settings2,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useRatehonkPageSkin } from "@/panel-templates/ratehonk-v1/RatehonkSkinContext";
import { RhButton } from "@/panel-templates/ratehonk-v1/components/rh";
import {
  buildWhatsAppWidgetEmbedSnippet,
  DEFAULT_WHATSAPP_CHAT_WIDGET_CONFIG,
  mergeWhatsAppChatWidgetConfig,
  normalizeWhatsAppPhone,
  isValidWhatsAppPhoneDigits,
  type WhatsAppChatWidgetConfig,
  type WhatsAppChatWidgetPhoneOption,
} from "@shared/whatsapp-chat-widget";

const WA_CHAT_BG =
  "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4ccc4' fill-opacity='0.45'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")";

function WidgetHeroBanner() {
  const skin = useRatehonkPageSkin();

  return (
    <section
      className={cn(
        "widget-hero-banner rounded-xl px-5 py-8 text-center sm:px-8 sm:py-10",
        skin
          ? "border border-[#cddaff] bg-[#f0f5ff]"
          : "border border-[#cfe8cf] bg-[#eef9ee]",
      )}
    >
      <h1
        className={cn(
          "text-2xl font-bold leading-tight tracking-tight sm:text-3xl lg:text-[2rem] lg:leading-snug",
          skin ? "text-[#0059bb]" : "text-[#1b7a1b]",
        )}
      >
        WhatsApp Chat Widget Generator
      </h1>
      <p
        className={cn(
          "mx-auto mt-4 max-w-3xl text-sm leading-relaxed sm:text-base",
          skin ? "text-[#414754]" : "text-zinc-600",
        )}
      >
        Bring conversational commerce to your website in a few easy steps — capture leads, answer
        questions, and connect visitors to your WhatsApp inbox. Customize the button and chat panel,
        then generate a snippet for any site.
      </p>
      <p className={cn("mt-4 text-sm italic", skin ? "text-[#717786]" : "text-zinc-500")}>
        Check the live preview of your WhatsApp widget on the right side of this page.
      </p>
    </section>
  );
}

function WidgetSettingsCard({ className, ...props }: ComponentProps<typeof Card>) {
  const skin = useRatehonkPageSkin();
  return <Card className={cn(skin && "widget-rh-card", className)} {...props} />;
}

const WIDGET_SETUP_STEPS = [
  {
    icon: Phone,
    title: "Choose a connected WhatsApp number",
    body: "Select a line from your inbox (Business API or WhatsApp Web). Visitor messages flow into the same conversations your team already handles.",
  },
  {
    icon: Settings2,
    title: "Configure the chat button",
    body: "Set button color, CTA text, position, spacing, and the default message. Use the live preview on the right to fine-tune the look.",
  },
  {
    icon: PanelsTopLeft,
    title: "Customize the chat widget",
    body: "Add brand name, welcome and teaser copy, panel styling, and live-chat options. Collect name or phone when you need richer lead context.",
  },
  {
    icon: FileCode2,
    title: "Save and generate your snippet",
    body: "Save settings, then tap Generate Snippet to copy embed code for any site. With the widget enabled, it also appears on your public login and marketing pages.",
  },
] as const;

const WIDGET_SETUP_BENEFITS = [
  {
    icon: Inbox,
    title: "One inbox for every channel",
    body: "Web widget chats and WhatsApp messages are managed in the same place — no switching tools.",
  },
  {
    icon: MessageSquare,
    title: "Real conversations, not forms",
    body: "Visitors start chatting immediately instead of filling out a form and waiting for a reply.",
  },
  {
    icon: Globe2,
    title: "Embed anywhere",
    body: "Paste one script on WordPress, Shopify, landing pages, or any HTML site you control.",
  },
  {
    icon: Sparkles,
    title: "Higher engagement",
    body: "Teaser bubble plus live chat creates a low-friction path from browse to conversation.",
  },
] as const;

function WidgetSetupGuide() {
  const skin = useRatehonkPageSkin();

  return (
    <WidgetSettingsCard className="widget-setup-guide overflow-hidden">
      <CardHeader
        className={cn(
          "border-b pb-6 text-center",
          skin ? "border-[#e8eaef] bg-gradient-to-b from-[#f8faff] to-white" : "bg-muted/30",
        )}
      >
        <CardTitle className={cn("text-xl sm:text-2xl", skin && "text-[#111c2d]")}>
          How to add the WhatsApp widget to your site
        </CardTitle>
        <CardDescription className={cn("mx-auto mt-2 max-w-2xl text-sm sm:text-base", skin && "text-[#717786]")}>
          Configure everything in Integrations, embed on external sites, or let it run automatically
          on your public pages.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-8 pt-8">
        <div className="grid gap-4 sm:grid-cols-2">
          {WIDGET_SETUP_STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={step.title}
                className={cn(
                  "widget-setup-step flex gap-4 rounded-xl border p-5 transition-shadow",
                  skin
                    ? "border-[#e5e7eb] bg-[#fafbff] hover:shadow-sm"
                    : "border-border bg-muted/20",
                )}
              >
                <div
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                    skin ? "bg-[#dfe8ff] text-[#0059bb]" : "bg-primary/10 text-primary",
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={2} />
                </div>
                <div className="min-w-0 space-y-2">
                  <span
                    className={cn(
                      "text-[11px] font-semibold uppercase tracking-wider",
                      skin ? "text-[#0059bb]" : "text-primary",
                    )}
                  >
                    Step {index + 1}
                  </span>
                  <h3 className={cn("text-sm font-semibold leading-snug sm:text-base", skin && "text-[#111c2d]")}>
                    {step.title}
                  </h3>
                  <p className={cn("text-sm leading-relaxed", skin ? "text-[#414754]" : "text-muted-foreground")}>
                    {step.body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div
          className={cn(
            "widget-setup-benefits rounded-xl border p-6 sm:p-8",
            skin ? "border-[#cddaff] bg-gradient-to-br from-[#f0f5ff] via-[#f8faff] to-white" : "border-primary/20 bg-muted/30",
          )}
        >
          <h3 className={cn("text-center text-lg font-semibold", skin && "text-[#0059bb]")}>
            Why use a WhatsApp widget?
          </h3>
          <p className={cn("mx-auto mt-2 max-w-xl text-center text-sm", skin ? "text-[#717786]" : "text-muted-foreground")}>
            Turn passive website traffic into active conversations.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {WIDGET_SETUP_BENEFITS.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex gap-3">
                  <div className={cn("mt-0.5 shrink-0", skin ? "text-[#0059bb]" : "text-primary")}>
                    <CheckCircle2 className="h-5 w-5" strokeWidth={2} />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Icon className={cn("h-4 w-4", skin ? "text-[#0059bb]" : "text-primary")} strokeWidth={2} />
                      <p className={cn("text-sm font-semibold", skin && "text-[#111c2d]")}>{item.title}</p>
                    </div>
                    <p className={cn("text-sm leading-relaxed", skin ? "text-[#414754]" : "text-muted-foreground")}>
                      {item.body}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </WidgetSettingsCard>
  );
}

function WidgetPreview({ config }: { config: WhatsAppChatWidgetConfig }) {
  const brandName = config.panel.brandName || "Support";
  const brandInitial = brandName.charAt(0).toUpperCase();
  const headerColor = config.panel.brandColor || "#075E54";
  const welcomeText =
    config.panel.welcomeMessage ||
    "Enter your question below and a representative will get right back to you.";
  const visitorPreview = config.panel.defaultMessage || "Hi, do you have any question?";
  const showLiveForm =
    config.panel.chatMode !== "whatsapp" &&
    (config.panel.collectVisitorName || config.panel.collectVisitorPhone);

  return (
    <div className="flex flex-col items-center justify-center py-2">
      {/* Smartphone frame */}
      <div
        className="relative w-full max-w-[280px] overflow-hidden rounded-[2rem] border-[6px] border-zinc-900 bg-zinc-900 shadow-2xl"
        style={{ aspectRatio: "9 / 19.5" }}
      >
        {/* Notch */}
        <div className="pointer-events-none absolute left-1/2 top-0 z-30 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-zinc-900" />

        {/* Screen */}
        <div className="flex h-full w-full flex-col overflow-hidden rounded-[1.4rem] bg-[#ece5dd]">
          {/* Status bar */}
          <div
            className="flex shrink-0 items-center justify-between px-5 pb-0.5 pt-2 text-[10px] font-medium text-white"
            style={{ backgroundColor: headerColor }}
          >
            <span>9:41</span>
            <div className="flex items-center gap-1 opacity-90">
              <span className="inline-block h-2 w-3 rounded-sm border border-white" />
              <span className="inline-block h-2 w-2 rounded-full border border-white" />
              <span className="inline-block h-2.5 w-4 rounded-sm border border-white" />
            </div>
          </div>

          {/* WhatsApp header */}
          <div
            className="flex shrink-0 items-center gap-2 px-2 pb-2.5 pt-0.5 text-white"
            style={{ backgroundColor: headerColor }}
          >
            <button
              type="button"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-white/10"
              aria-label="Back"
              tabIndex={-1}
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
            </button>

            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/25 text-sm font-bold">
              {config.panel.brandImageUrl ? (
                <img
                  src={config.panel.brandImageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                brandInitial
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-semibold leading-tight">{brandName}</div>
              <div className="truncate text-[11px] opacity-90">WhatsApp</div>
            </div>

            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10"
                aria-label="Call"
                tabIndex={-1}
              >
                <Phone className="h-[17px] w-[17px]" strokeWidth={2} />
              </button>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10"
                aria-label="Menu"
                tabIndex={-1}
              >
                <MoreVertical className="h-[18px] w-[18px]" strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* Chat area */}
          <div
            className="min-h-0 flex-1 overflow-y-auto px-2.5 py-3"
            style={{ backgroundColor: "#ece5dd", backgroundImage: WA_CHAT_BG }}
          >
            {/* Incoming (business) bubble */}
            <div className="mb-2 flex justify-start">
              <div className="relative max-w-[88%] rounded-lg rounded-tl-none bg-white px-2.5 py-1.5 shadow-sm">
                <p className="whitespace-pre-wrap text-[13px] leading-[1.35] text-zinc-900">
                  {welcomeText}
                </p>
                <span className="mt-0.5 block text-right text-[10px] text-zinc-400">9:41 AM</span>
              </div>
            </div>

            {showLiveForm && (
              <div className="mb-2 flex justify-start">
                <div className="relative max-w-[88%] rounded-lg rounded-tl-none bg-white px-2.5 py-2 shadow-sm">
                  <div className="space-y-1.5 text-[12px] text-zinc-600">
                    {config.panel.collectVisitorName && (
                      <div className="rounded border border-zinc-200 bg-zinc-50 px-2 py-1">
                        Your name
                      </div>
                    )}
                    {config.panel.collectVisitorPhone && (
                      <div className="rounded border border-zinc-200 bg-zinc-50 px-2 py-1">
                        Phone number
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="mt-2 w-full rounded-md py-1.5 text-center text-[12px] font-semibold text-white"
                    style={{ backgroundColor: headerColor }}
                    tabIndex={-1}
                  >
                    {config.panel.buttonText || "Start Chat"}
                  </button>
                  <span className="mt-0.5 block text-right text-[10px] text-zinc-400">9:41 AM</span>
                </div>
              </div>
            )}

            {/* Outgoing (visitor) preview bubble */}
            {config.panel.chatMode !== "whatsapp" && visitorPreview && (
              <div className="mb-2 flex justify-end">
                <div className="relative max-w-[88%] rounded-lg rounded-tr-none bg-[#d9fdd3] px-2.5 py-1.5 shadow-sm">
                  <p className="whitespace-pre-wrap text-[13px] leading-[1.35] text-zinc-900">
                    {visitorPreview}
                  </p>
                  <span className="mt-0.5 block text-right text-[10px] text-zinc-500">
                    9:42 AM ✓✓
                  </span>
                </div>
              </div>
            )}

            {config.panel.chatMode === "whatsapp" && (
              <div className="flex justify-center py-2">
                <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] text-zinc-600 shadow-sm">
                  Opens in WhatsApp app
                </span>
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="flex shrink-0 items-center gap-2 border-t border-zinc-300/60 bg-[#f0f0f0] px-2 py-2">
            <button
              type="button"
              className="flex h-9 w-9 shrink-0 items-center justify-center text-zinc-500"
              aria-label="Attach"
              tabIndex={-1}
            >
              <Plus className="h-6 w-6" strokeWidth={1.75} />
            </button>
            <div className="min-h-9 flex-1 rounded-full bg-white px-4 py-2 text-[14px] text-zinc-400 shadow-sm">
              Message
            </div>
            <button
              type="button"
              className="flex h-9 w-9 shrink-0 items-center justify-center text-zinc-500"
              aria-label="Voice message"
              tabIndex={-1}
            >
              <Mic className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>

      {/* Teaser bubble + floating button preview */}
      <div className="relative mt-5 flex w-full max-w-[280px] flex-col items-end gap-3">
        <div className="relative w-full max-w-[260px] rounded-2xl border border-zinc-200 bg-white p-4 pr-10 shadow-md">
          <div className="flex gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-base font-bold text-white"
              style={{ backgroundColor: headerColor }}
            >
              {config.panel.brandImageUrl ? (
                <img src={config.panel.brandImageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                brandInitial
              )}
            </div>
            <p className="text-sm leading-snug text-zinc-700">
              {config.panel.teaserMessage || "Hi! How can we help you today?"}
            </p>
          </div>
          <div className="absolute -bottom-1.5 right-10 h-3.5 w-3.5 rotate-45 border-b border-r border-zinc-200 bg-white" />
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2.5 px-5 py-3.5 text-base font-semibold text-white shadow-lg"
          style={{
            backgroundColor: config.button.backgroundColor,
            borderRadius: config.button.borderRadius,
          }}
          tabIndex={-1}
        >
          <MessageCircle className="h-4 w-4" />
          {config.button.ctaText || "Chat with us"}
        </button>
      </div>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        Teaser bubble + button · full chat opens on click
      </p>
    </div>
  );
}

export default function WhatsAppChatWidgetPage({ embedded }: { embedded?: boolean } = {}) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const skin = useRatehonkPageSkin();
  const [config, setConfig] = useState<WhatsAppChatWidgetConfig>(
    DEFAULT_WHATSAPP_CHAT_WIDGET_CONFIG,
  );
  const [snippetOpen, setSnippetOpen] = useState(false);
  const [snippetText, setSnippetText] = useState("");
  const [generatingSnippet, setGeneratingSnippet] = useState(false);

  const { data, isLoading, error } = useQuery({    queryKey: ["/api/integrations/whatsapp-chat-widget/config"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/integrations/whatsapp-chat-widget/config");
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error("Failed to load widget settings");
      }
      return res.json();
    },
    retry: false,
  });

  const { data: phoneNumbersData, isLoading: phonesLoading } = useQuery<{
    phoneNumbers: WhatsAppChatWidgetPhoneOption[];
  }>({
    queryKey: ["/api/integrations/whatsapp-chat-widget/phone-numbers"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/integrations/whatsapp-chat-widget/phone-numbers");
      if (!res.ok) throw new Error("Failed to load connected numbers");
      return res.json();
    },
    enabled: data !== null && !error,
  });

  const connectedPhones = phoneNumbersData?.phoneNumbers ?? [];

  useEffect(() => {
    if (data?.config) {
      setConfig(mergeWhatsAppChatWidgetConfig(data.config));
    }
  }, [data]);

  useEffect(() => {
    if (!connectedPhones.length) return;
    setConfig((prev) => {
      if (prev.phoneInputMode === "manual") return prev;
      const bySession = prev.sessionId
        ? connectedPhones.find((p) => p.sessionId === prev.sessionId)
        : undefined;
      const byPhone = prev.phoneNumber
        ? connectedPhones.find((p) => p.phoneNumber === prev.phoneNumber)
        : undefined;
      const selected = bySession || byPhone;
      if (selected) {
        return {
          ...prev,
          sessionId: selected.sessionId,
          phoneNumber: selected.phoneNumber,
        };
      }
      if (!prev.sessionId && !prev.phoneNumber) {
        const first = connectedPhones[0];
        return {
          ...prev,
          sessionId: first.sessionId,
          phoneNumber: first.phoneNumber,
        };
      }
      return prev;
    });
  }, [connectedPhones]);

  useEffect(() => {
    if (phonesLoading || connectedPhones.length > 0) return;
    setConfig((prev) =>
      prev.phoneInputMode === "manual"
        ? prev
        : { ...prev, phoneInputMode: "manual", sessionId: undefined },
    );
  }, [connectedPhones.length, phonesLoading]);

  const saveMutation = useMutation({    mutationFn: async () => {
      const res = await apiRequest("PUT", "/api/integrations/whatsapp-chat-widget/config", {
        config,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to save settings");
      }
      return res.json();
    },
    onSuccess: (result) => {
      setConfig(mergeWhatsAppChatWidgetConfig(result.config));
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/integrations/whatsapp-chat-widget/config"],
      });
      toast({ title: "Saved", description: "Chat widget settings updated." });
    },    onError: (e: Error) => {
      toast({ variant: "destructive", title: "Error", description: e.message });
    },
  });

  const selectPhone = (sessionId: string) => {
    const selected = connectedPhones.find((p) => p.sessionId === sessionId);
    if (!selected) return;
    setConfig((prev) => ({
      ...prev,
      phoneInputMode: "connected",
      sessionId: selected.sessionId,
      phoneNumber: selected.phoneNumber,
    }));
  };

  const setPhoneInputMode = (mode: "connected" | "manual") => {
    if (mode === "connected") {
      const selected =
        connectedPhones.find((p) => p.sessionId === config.sessionId) || connectedPhones[0];
      if (selected) {
        selectPhone(selected.sessionId);
      } else {
        setConfig((prev) => ({ ...prev, phoneInputMode: "connected" }));
      }
      return;
    }
    setConfig((prev) => ({
      ...prev,
      phoneInputMode: "manual",
      sessionId: undefined,
    }));
  };

  const setManualPhone = (raw: string) => {
    setConfig((prev) => ({
      ...prev,
      phoneInputMode: "manual",
      sessionId: undefined,
      phoneNumber: normalizeWhatsAppPhone(raw),
    }));
  };

  const phoneInputMode =
    config.phoneInputMode || (config.sessionId ? "connected" : config.phoneNumber ? "manual" : "connected");

  const hasValidWidgetPhone =
    phoneInputMode === "manual"
      ? isValidWhatsAppPhoneDigits(config.phoneNumber)
      : connectedPhones.some((p) => p.sessionId === config.sessionId);

  const manualPhoneBlocksLiveChat =
    phoneInputMode === "manual" &&
    (config.panel.chatMode === "live" || config.panel.chatMode === "both");

  const updateButton = <K extends keyof WhatsAppChatWidgetConfig["button"]>(    key: K,
    value: WhatsAppChatWidgetConfig["button"][K],
  ) => {
    setConfig((prev) => ({ ...prev, button: { ...prev.button, [key]: value } }));
  };

  const updatePanel = <K extends keyof WhatsAppChatWidgetConfig["panel"]>(
    key: K,
    value: WhatsAppChatWidgetConfig["panel"][K],
  ) => {
    setConfig((prev) => ({ ...prev, panel: { ...prev.panel, [key]: value } }));
  };

  const handleGenerateSnippet = async () => {
    if (!hasValidWidgetPhone) {
      toast({
        variant: "destructive",
        title: "WhatsApp number required",
        description: "Select a connected number or enter a valid number with country code.",
      });
      return;
    }

    setGeneratingSnippet(true);
    try {
      const res = await apiRequest("PUT", "/api/integrations/whatsapp-chat-widget/config", {
        config,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to save widget settings");
      }
      const result = await res.json();
      const savedConfig = mergeWhatsAppChatWidgetConfig(result.config);
      setConfig(savedConfig);
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/integrations/whatsapp-chat-widget/config"],
      });

      const widgetId = savedConfig.widgetPublicId;
      if (!widgetId) {
        throw new Error("Widget ID was not created. Try again.");
      }

      const snippet = buildWhatsAppWidgetEmbedSnippet(window.location.origin, widgetId);
      setSnippetText(snippet);
      setSnippetOpen(true);
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not generate snippet",
        description: e instanceof Error ? e.message : "Something went wrong",
      });
    } finally {
      setGeneratingSnippet(false);
    }
  };

  const handleCopySnippet = async () => {
    try {
      await navigator.clipboard.writeText(snippetText);
      toast({ title: "Copied", description: "Widget snippet copied to clipboard." });
    } catch {
      toast({
        variant: "destructive",
        title: "Copy failed",
        description: "Select the code and copy it manually.",
      });
    }
  };

  if (isLoading) {
    return (
      <div
        className={cn(
          "flex min-h-[400px] items-center justify-center",
          !skin && !embedded && "container mx-auto p-6",
        )}
      >
        <Loader2 className={cn("h-8 w-8 animate-spin", skin ? "text-[#0059bb]" : "text-primary")} />
      </div>
    );
  }

  if (error || data === null) {
    return (
      <div
        className={cn(
          "mx-auto max-w-lg space-y-4 text-center",
          !skin && !embedded && "container p-6",
        )}
      >
        <p className="text-muted-foreground">
          Enable the WhatsApp Chat Widget from Integrations first.
        </p>
        {skin ? (
          <RhButton variant="primary" onClick={() => setLocation("/integrations")}>
            Go to Integrations
          </RhButton>
        ) : (
          <Button onClick={() => setLocation("/integrations")}>Go to Integrations</Button>
        )}
      </div>
    );
  }

  const infoBanner = (
    <>
      The widget appears on public pages such as <strong>/login</strong>, <strong>/signup</strong>, and
      your marketing pages. It does not show inside the admin panel (Inbox, Integrations, etc.). Open
      a private/incognito window and visit <strong>/login</strong> to test it.
    </>
  );

  const saveButton = (
    <Button
      className={cn(skin && "hidden")}
      onClick={() => saveMutation.mutate()}
      disabled={saveMutation.isPending || !hasValidWidgetPhone}
    >
      {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      Save settings
    </Button>
  );

  const saveButtonNova = (
    <RhButton
      className={cn(!skin && "hidden")}
      onClick={() => saveMutation.mutate()}
      disabled={saveMutation.isPending || !hasValidWidgetPhone}
    >
      {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      Save settings
    </RhButton>
  );

  return (
    <div
      className={cn(
        skin ? "widget-rh-page space-y-6" : "container mx-auto space-y-6 p-6",
        embedded && !skin && "p-0",
      )}
    >
      {!embedded ? (
        <div className="widget-page-chrome space-y-6">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/integrations">Integrations</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>WhatsApp Chat Widget</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <Button variant="ghost" size="sm" className="-ml-2 w-fit" onClick={() => setLocation("/integrations")}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Integrations
          </Button>

          <Alert>
            <AlertDescription>{infoBanner}</AlertDescription>
          </Alert>
        </div>
      ) : skin ? (
        <div className="space-y-4">
          <RhButton variant="outline" className="w-fit" onClick={() => setLocation("/integrations")}>
            <ArrowLeft className="h-4 w-4" />
            Back to Integrations
          </RhButton>
          <div className="widget-rh-info">{infoBanner}</div>
        </div>
      ) : null}

      <WidgetHeroBanner />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-6">
          <WidgetSettingsCard>
            <CardHeader>
              <CardTitle>WhatsApp number</CardTitle>
              <CardDescription>
                Select a connected inbox line or enter a number manually (with country code) for wa.me
                and embed snippets.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {phonesLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading connected numbers…
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Number source</Label>
                    <RadioGroup
                      value={phoneInputMode}
                      onValueChange={(v) => setPhoneInputMode(v as "connected" | "manual")}
                      className="flex flex-wrap gap-6"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem
                          value="connected"
                          id="phone-source-connected"
                          disabled={connectedPhones.length === 0}
                        />
                        <Label htmlFor="phone-source-connected" className="font-normal">
                          Connected inbox number
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="manual" id="phone-source-manual" />
                        <Label htmlFor="phone-source-manual" className="font-normal">
                          Enter number manually
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {phoneInputMode === "connected" ? (
                    connectedPhones.length === 0 ? (
                      <Alert>
                        <AlertDescription className="space-y-3">
                          <p>
                            No connected numbers found. Connect a line in Inbox or use manual entry
                            above.
                          </p>
                          <Button type="button" variant="outline" size="sm" onClick={() => setLocation("/connect")}>
                            Connect WhatsApp number
                          </Button>
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <div className="space-y-2">
                        <Label htmlFor="phone">Connected number</Label>
                        <Select
                          value={config.sessionId || connectedPhones[0]?.sessionId || ""}
                          onValueChange={selectPhone}
                        >
                          <SelectTrigger id="phone">
                            <SelectValue placeholder="Select a connected number" />
                          </SelectTrigger>
                          <SelectContent>
                            {connectedPhones.map((phone) => (
                              <SelectItem key={phone.sessionId} value={phone.sessionId}>
                                {phone.displayPhoneNumber}
                                {phone.verifiedName ? ` — ${phone.verifiedName}` : ""}
                                {phone.connectionType === "official" ? " (Business API)" : " (WhatsApp Web)"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="manualPhone">WhatsApp number</Label>
                      <Input
                        id="manualPhone"
                        type="tel"
                        inputMode="tel"
                        placeholder="e.g. 919821273555"
                        value={
                          config.phoneNumber && phoneInputMode === "manual"
                            ? `+${config.phoneNumber}`
                            : ""
                        }
                        onChange={(e) => setManualPhone(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Include country code without spaces. Example: India <strong>91</strong> then
                        your 10-digit mobile number.
                      </p>
                    </div>
                  )}

                  {manualPhoneBlocksLiveChat && (
                    <Alert>
                      <AlertDescription>
                        Live chat in the widget needs a connected inbox number. For manual entry,
                        choose <strong>Open WhatsApp only</strong> in Chat Widget settings, or switch
                        to a connected number.
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}
              <div className="flex items-center justify-between">
                <Label htmlFor="enabled">Widget enabled</Label>
                <Switch
                  id="enabled"
                  checked={config.enabled}
                  disabled={!hasValidWidgetPhone}
                  onCheckedChange={(checked) =>
                    setConfig((prev) => ({ ...prev, enabled: checked }))
                  }
                />
              </div>
            </CardContent>
          </WidgetSettingsCard>
          <WidgetSettingsCard>
            <CardHeader>
              <CardTitle>Configure WhatsApp Chat Button</CardTitle>
              <CardDescription>
                Personalize the pre-filled user message for your WhatsApp button
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="ctaText">CTA text</Label>
                <Input
                  id="ctaText"
                  value={config.button.ctaText}
                  onChange={(e) => updateButton("ctaText", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="btnColor">Button background</Label>
                <div className="flex gap-2">
                  <Input
                    id="btnColor"
                    type="color"
                    className="h-10 w-14 p-1"
                    value={config.button.backgroundColor}
                    onChange={(e) => updateButton("backgroundColor", e.target.value)}
                  />
                  <Input
                    value={config.button.backgroundColor}
                    onChange={(e) => updateButton("backgroundColor", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="borderRadius">Border radius (px)</Label>
                <Input
                  id="borderRadius"
                  type="number"
                  min={0}
                  value={config.button.borderRadius}
                  onChange={(e) => updateButton("borderRadius", Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="marginBottom">Margin bottom (px)</Label>
                <Input
                  id="marginBottom"
                  type="number"
                  min={0}
                  value={config.button.marginBottom}
                  onChange={(e) => updateButton("marginBottom", Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="marginRight">Margin right (px)</Label>
                <Input
                  id="marginRight"
                  type="number"
                  min={0}
                  value={config.button.marginRight}
                  onChange={(e) => updateButton("marginRight", Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="marginLeft">Margin left (px)</Label>
                <Input
                  id="marginLeft"
                  type="number"
                  min={0}
                  value={config.button.marginLeft}
                  onChange={(e) => updateButton("marginLeft", Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="btnMessage">Default pre-filled message</Label>
                <Textarea
                  id="btnMessage"
                  rows={2}
                  value={config.button.defaultMessage}
                  onChange={(e) => updateButton("defaultMessage", e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Position</Label>
                <RadioGroup
                  value={config.button.position}
                  onValueChange={(v) =>
                    updateButton("position", v as WhatsAppChatWidgetConfig["button"]["position"])
                  }
                  className="flex gap-6"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="bottom-right" id="pos-right" />
                    <Label htmlFor="pos-right">Bottom right</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="bottom-left" id="pos-left" />
                    <Label htmlFor="pos-left">Bottom left</Label>
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
          </WidgetSettingsCard>

          <WidgetSettingsCard>
            <CardHeader>
              <CardTitle>Chat Widget</CardTitle>
              <CardDescription>
                You can personalize the user message based on your website&apos;s URL
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Chat mode</Label>
                <RadioGroup
                  value={config.panel.chatMode || "live"}
                  onValueChange={(v) =>
                    updatePanel("chatMode", v as WhatsAppChatWidgetConfig["panel"]["chatMode"])
                  }
                  className="grid gap-2 sm:grid-cols-3"
                >
                  <div className={cn("flex items-center gap-2 rounded-md border p-3", skin && "widget-rh-mode-option")}>
                    <RadioGroupItem value="live" id="mode-live" />
                    <Label htmlFor="mode-live" className="font-normal">
                      Live chat in widget (recommended)
                    </Label>
                  </div>
                  <div className={cn("flex items-center gap-2 rounded-md border p-3", skin && "widget-rh-mode-option")}>
                    <RadioGroupItem value="both" id="mode-both" />
                    <Label htmlFor="mode-both" className="font-normal">
                      Live chat + WhatsApp link
                    </Label>
                  </div>
                  <div className={cn("flex items-center gap-2 rounded-md border p-3", skin && "widget-rh-mode-option")}>
                    <RadioGroupItem value="whatsapp" id="mode-wa" />
                    <Label htmlFor="mode-wa" className="font-normal">
                      Open WhatsApp only
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="welcomeMessage">Welcome message</Label>
                <Textarea
                  id="welcomeMessage"
                  rows={2}
                  value={config.panel.welcomeMessage}
                  onChange={(e) => updatePanel("welcomeMessage", e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="teaserMessage">Teaser bubble message</Label>
                <Textarea
                  id="teaserMessage"
                  rows={2}
                  value={config.panel.teaserMessage}
                  onChange={(e) => updatePanel("teaserMessage", e.target.value)}
                  placeholder="Hi! How can we help you today?"
                />
                <p className="text-xs text-muted-foreground">
                  Short greeting shown in the small bubble above the button. The full chat opens only when visitors click the bubble or &quot;Chat with us&quot;.
                </p>
              </div>
              <div className="flex items-center justify-between sm:col-span-2">
                <Label htmlFor="collectName">Ask for visitor name</Label>
                <Switch
                  id="collectName"
                  checked={config.panel.collectVisitorName}
                  onCheckedChange={(checked) => updatePanel("collectVisitorName", checked)}
                />
              </div>
              <div className="flex items-center justify-between sm:col-span-2">
                <Label htmlFor="collectPhone">Ask for visitor phone</Label>
                <Switch
                  id="collectPhone"
                  checked={config.panel.collectVisitorPhone}
                  onCheckedChange={(checked) => updatePanel("collectVisitorPhone", checked)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brandName">Brand name</Label>
                <Input
                  id="brandName"
                  value={config.panel.brandName}
                  onChange={(e) => updatePanel("brandName", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brandSubtitle">Brand subtitle</Label>
                <Input
                  id="brandSubtitle"
                  value={config.panel.brandSubtitle}
                  onChange={(e) => updatePanel("brandSubtitle", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brandColor">Brand color</Label>
                <div className="flex gap-2">
                  <Input
                    id="brandColor"
                    type="color"
                    className="h-10 w-14 p-1"
                    value={config.panel.brandColor}
                    onChange={(e) => updatePanel("brandColor", e.target.value)}
                  />
                  <Input
                    value={config.panel.brandColor}
                    onChange={(e) => updatePanel("brandColor", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="brandImage">Brand image URL</Label>
                <Input
                  id="brandImage"
                  placeholder="https://..."
                  value={config.panel.brandImageUrl}
                  onChange={(e) => updatePanel("brandImageUrl", e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="panelBtn">Widget button text</Label>
                <Input
                  id="panelBtn"
                  value={config.panel.buttonText}
                  onChange={(e) => updatePanel("buttonText", e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="panelMessage">Default pre-filled message</Label>
                <Textarea
                  id="panelMessage"
                  rows={2}
                  value={config.panel.defaultMessage}
                  onChange={(e) => updatePanel("defaultMessage", e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between sm:col-span-2">
                <Label htmlFor="openOnClick">Open widget on button click</Label>
                <Switch
                  id="openOnClick"
                  checked={config.panel.openOnButtonClick}
                  onCheckedChange={(checked) => updatePanel("openOnButtonClick", checked)}
                />
              </div>
              <div className="flex items-center justify-between sm:col-span-2">
                <div>
                  <Label htmlFor="showDefault">Show teaser bubble by default</Label>
                  <p className="text-xs text-muted-foreground">
                    Shows a small welcome message above the button — not the full chat window.
                  </p>
                </div>
                <Switch
                  id="showDefault"
                  checked={config.panel.showByDefault}
                  onCheckedChange={(checked) => updatePanel("showByDefault", checked)}
                />
              </div>
              {config.panel.showByDefault && (
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="delay">Show after (seconds)</Label>
                  <Input
                    id="delay"
                    type="number"
                    min={0}
                    value={config.panel.showDelaySeconds}
                    onChange={(e) =>
                      updatePanel("showDelaySeconds", Number(e.target.value) || 0)
                    }
                  />
                </div>
              )}
              <div className="flex items-center justify-between sm:col-span-2">
                <div>
                  <Label htmlFor="urlPers">URL personalization</Label>
                  <p className="text-xs text-muted-foreground">
                    Append the current page URL to the WhatsApp message
                  </p>
                </div>
                <Switch
                  id="urlPers"
                  checked={config.urlPersonalization}
                  onCheckedChange={(checked) =>
                    setConfig((prev) => ({ ...prev, urlPersonalization: checked }))
                  }
                />
              </div>
            </CardContent>
          </WidgetSettingsCard>

          <WidgetSettingsCard className="widget-rh-generate-card">
            <CardContent className="flex flex-col items-center gap-3 pt-6">
              <Button
                type="button"
                className={cn(
                  "h-12 w-full max-w-md text-base font-semibold text-white shadow-md",
                  skin ? "hidden" : "bg-[#25D366] hover:bg-[#20bd5a]",
                )}
                onClick={handleGenerateSnippet}
                disabled={generatingSnippet || !hasValidWidgetPhone}
              >
                {generatingSnippet ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : null}
                Generate Snippet
              </Button>
              <RhButton
                type="button"
                className={cn(
                  "!h-12 w-full max-w-md !text-base font-semibold text-white shadow-md",
                  !skin && "hidden",
                )}
                style={{ backgroundColor: "#25D366" }}
                onClick={handleGenerateSnippet}
                disabled={generatingSnippet || !hasValidWidgetPhone}
              >
                {generatingSnippet ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                Generate Snippet
              </RhButton>
              <p className="max-w-md text-center text-xs text-muted-foreground">
                Saves your settings and creates an embed code you can paste on any website.
              </p>
            </CardContent>
          </WidgetSettingsCard>

          <div className={cn(skin && "widget-rh-save-bar", "flex gap-3")}>
            {saveButton}
            {saveButtonNova}
          </div>
        </div>

        <div className="xl:sticky xl:top-6 xl:self-start space-y-6">
          <WidgetSettingsCard className="widget-rh-preview overflow-hidden">
            <CardHeader className="border-b border-[#e8eaef] bg-white pb-4">
              <CardTitle>Live preview</CardTitle>
              <CardDescription>How the widget appears on a website</CardDescription>
            </CardHeader>
            <CardContent className="flex min-h-[520px] items-center justify-center px-4 py-6">
              <WidgetPreview config={config} />
            </CardContent>
          </WidgetSettingsCard>

          <WidgetSettingsCard>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Link2 className="h-4 w-4 text-[#25D366]" />
                WhatsApp Link Generator
              </CardTitle>
              <CardDescription>
                Create a shareable click-to-chat URL with a pre-filled message and QR code for social
                media, websites, and print.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                className="w-full bg-[#25D366] text-white hover:bg-[#1ebe57]"
                onClick={() => setLocation("/integrations/whatsapp-link-generator")}
              >
                Open link generator
              </Button>
            </CardContent>
          </WidgetSettingsCard>
        </div>
      </div>

      <WidgetSetupGuide />

      <Dialog open={snippetOpen} onOpenChange={setSnippetOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Here is your Widget Snippet</DialogTitle>
            <DialogDescription>
              Copy and paste this snippet inside the <code className="text-xs">&lt;head&gt;</code> tag
              of your webpage, or just before <code className="text-xs">&lt;/body&gt;</code>. Works on
              any site — WordPress, Shopify, custom HTML, etc.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <pre className="max-h-[220px] overflow-auto whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-zinc-800">
              {snippetText}
            </pre>
          </div>
          <div className="flex justify-center pt-2">
            <Button
              type="button"
              className="h-11 min-w-[180px] bg-[#25D366] text-base font-semibold text-white hover:bg-[#20bd5a]"
              onClick={handleCopySnippet}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy Snippet
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
