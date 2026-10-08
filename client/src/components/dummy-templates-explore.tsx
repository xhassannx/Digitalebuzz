import { useMemo, useState } from "react";
import {
  TrendingUp,
  LayoutGrid,
  Star,
  ShoppingCart,
  GraduationCap,
  Building2,
  Video,
  HeartPulse,
  Car,
  Home,
  Briefcase,
  HandHeart,
  Image as ImageIcon,
  FileText,
  CheckCircle2,
  ExternalLink,
  Phone as PhoneIcon,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import {
  DUMMY_TEMPLATES,
  type DummyTemplate,
  type DummyTemplateButton,
  type DummyTemplateType,
} from "@/components/dummy-templates-data";

const CATEGORIES = [
  { id: "trending", label: "Trending", icon: TrendingUp },
  { id: "general", label: "General", icon: LayoutGrid },
  { id: "top-rated", label: "Top Rated", icon: Star },
  { id: "ecommerce", label: "Ecommerce", icon: ShoppingCart, group: "Industry" },
  { id: "education", label: "Education", icon: GraduationCap, group: "Industry" },
  { id: "banking", label: "Banking", icon: Building2, group: "Industry" },
  { id: "webinar", label: "Webinar", icon: Video, group: "Industry" },
  { id: "healthcare", label: "Healthcare", icon: HeartPulse, group: "Industry" },
  { id: "automobile", label: "Automobile", icon: Car, group: "Industry" },
  { id: "real-estate", label: "Real Estate", icon: Home, group: "Industry" },
  { id: "services", label: "Services", icon: Briefcase, group: "Industry" },
  { id: "non-profit", label: "Non profit", icon: HandHeart, group: "Industry" },
] as const;

const TYPE_STYLES: Record<DummyTemplateType, string> = {
  TEXT: "bg-emerald-50 text-emerald-700 border-emerald-100",
  IMAGE: "bg-orange-50 text-orange-700 border-orange-100",
  VIDEO: "bg-violet-50 text-violet-700 border-violet-100",
  FILE: "bg-pink-50 text-pink-700 border-pink-100",
};

function toTemplateVariableBody(text: string): string {
  return buildBodyAndSamples(text).body;
}

function buildBodyAndSamples(text: string): {
  body: string;
  sampleValues: Record<string, string>;
} {
  let index = 0;
  const sampleValues: Record<string, string> = {};
  const body = text
    .replace(/\{\{([^}]+)\}\}/g, (_m, inner: string) => {
      index += 1;
      sampleValues[String(index)] = String(inner).trim();
      return `{{${index}}}`;
    })
    .replace(/\[([^\]]+)\]/g, (_m, inner: string) => {
      index += 1;
      sampleValues[String(index)] = String(inner).trim();
      return `{{${index}}}`;
    });
  return { body, sampleValues };
}

function categoryLabel(categoryId: string): string {
  const found = CATEGORIES.find((c) => c.id === categoryId);
  return found?.label?.toUpperCase() ?? categoryId.toUpperCase();
}

const DUMMY_TO_META_CATEGORY: Record<string, "MARKETING" | "UTILITY"> = {
  trending: "MARKETING",
  general: "MARKETING",
  "top-rated": "MARKETING",
  ecommerce: "MARKETING",
  education: "UTILITY",
  banking: "UTILITY",
  webinar: "MARKETING",
  healthcare: "UTILITY",
  automobile: "MARKETING",
  "real-estate": "MARKETING",
  services: "MARKETING",
  "non-profit": "MARKETING",
};

export const DUMMY_TEMPLATE_DRAFT_KEY = "dummyTemplateDraft";

export type DummyTemplateDraft = {
  name: string;
  templateType: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
  bodyText: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  language: string;
  sampleValues: Record<string, string>;
  headerText?: string;
  footerText?: string;
  interactiveAction: "NONE" | "CALL_TO_ACTION" | "QUICK_REPLY" | "ALL";
  quickReplies: Array<{ id: string; text: string }>;
  urlButtons: Array<{ id: string; text: string; url: string; urlType: "STATIC" | "DYNAMIC" }>;
  phoneButtons: Array<{ id: string; text: string; phoneNumber: string; countryCode: string }>;
};

function toCreateTemplateType(
  type: DummyTemplateType,
): DummyTemplateDraft["templateType"] {
  if (type === "FILE") return "DOCUMENT";
  return type;
}

function resolveInteractiveAction(
  buttons: DummyTemplateButton[] | undefined,
): DummyTemplateDraft["interactiveAction"] {
  if (!buttons?.length) return "NONE";
  const hasQr = buttons.some((b) => b.type === "QUICK_REPLY");
  const hasCta = buttons.some((b) => b.type === "URL" || b.type === "PHONE_NUMBER");
  if (hasQr && hasCta) return "ALL";
  if (hasQr) return "QUICK_REPLY";
  if (hasCta) return "CALL_TO_ACTION";
  return "NONE";
}

function buildDummyTemplateDraft(item: DummyTemplate): DummyTemplateDraft {
  const { body, sampleValues } = buildBodyAndSamples(item.preview);
  const buttons = item.buttons ?? [];
  const ts = Date.now();
  return {
    name: item.id.replace(/[^a-z0-9_]/gi, "_").toLowerCase(),
    templateType: toCreateTemplateType(item.type),
    bodyText: body,
    category: DUMMY_TO_META_CATEGORY[item.category] ?? "MARKETING",
    language: "en",
    sampleValues,
    headerText: item.type === "TEXT" ? item.title : undefined,
    footerText: item.footer,
    interactiveAction: resolveInteractiveAction(buttons),
    quickReplies: buttons
      .filter((b): b is Extract<DummyTemplateButton, { type: "QUICK_REPLY" }> => b.type === "QUICK_REPLY")
      .map((b, i) => ({ id: `qr-${ts}-${i}`, text: b.text })),
    urlButtons: buttons
      .filter((b): b is Extract<DummyTemplateButton, { type: "URL" }> => b.type === "URL")
      .map((b, i) => ({
        id: `url-${ts}-${i}`,
        text: b.text,
        url: b.url,
        urlType: "STATIC" as const,
      })),
    phoneButtons: buttons
      .filter((b): b is Extract<DummyTemplateButton, { type: "PHONE_NUMBER" }> => b.type === "PHONE_NUMBER")
      .map((b, i) => ({
        id: `phone-${ts}-${i}`,
        text: b.text,
        phoneNumber: b.phoneNumber.replace(/^\+?91/, "").replace(/\D/g, "") || b.phoneNumber,
        countryCode: "+91",
      })),
  };
}

function buttonLabel(btn: DummyTemplateButton): string {
  if (btn.type === "QUICK_REPLY") return "Quick Reply";
  if (btn.type === "URL") return "URL";
  return "Call";
}

type DummyTemplatesExploreProps = {
  primaryBtnClass?: string;
  outlineBtnClass?: string;
  brandColor?: boolean;
  phoneNumberId?: string | null;
};

export function DummyTemplatesExplore({
  primaryBtnClass,
  outlineBtnClass,
  phoneNumberId,
}: DummyTemplatesExploreProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [activeCategory, setActiveCategory] = useState<string>("ecommerce");
  const [previewItem, setPreviewItem] = useState<DummyTemplate | null>(null);

  const submitDummyTemplate = (item: DummyTemplate) => {
    const draft = buildDummyTemplateDraft(item);
    try {
      sessionStorage.setItem(DUMMY_TEMPLATE_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      toast({
        title: "Could not prepare template",
        description: "Please try again.",
        variant: "destructive",
      });
      return;
    }
    const params = new URLSearchParams();
    params.set("fromDummy", "1");
    if (phoneNumberId) params.set("phoneNumberId", phoneNumberId);
    setLocation(`/templates/create?${params.toString()}`);
  };

  const filtered = useMemo(() => {
    if (activeCategory === "trending") {
      return DUMMY_TEMPLATES.filter(
        (t) => t.category === "trending" || t.badge === "Popular" || t.badge === "5X RECOVERY",
      );
    }
    if (activeCategory === "top-rated") {
      return DUMMY_TEMPLATES.filter(
        (t) => t.category === "top-rated" || t.badge === "Most Used" || t.badge === "Most Popular",
      );
    }
    if (activeCategory === "general") {
      return DUMMY_TEMPLATES.filter((t) => t.category === "general" || t.category === "trending");
    }
    return DUMMY_TEMPLATES.filter((t) => t.category === activeCategory);
  }, [activeCategory]);

  const industryStarted = CATEGORIES.findIndex((c) => "group" in c && c.group === "Industry");

  return (
    <div className="flex min-h-0 flex-1 gap-4 overflow-hidden p-4">
      <aside className="hidden w-44 shrink-0 flex-col gap-0.5 overflow-y-auto sm:flex md:w-48">
        {CATEGORIES.map((cat, index) => {
          const Icon = cat.icon;
          const showIndustryLabel = index === industryStarted;
          return (
            <div key={cat.id}>
              {showIndustryLabel && (
                <p className="mb-1 mt-3 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Industry
                </p>
              )}
              <button
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                  activeCategory === cat.id
                    ? "bg-[color-mix(in_srgb,var(--rh-brand,#047857)_12%,white)] font-medium text-[var(--rh-brand,#047857)]"
                    : "text-[#414754] hover:bg-muted/60",
                )}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-80" />
                {cat.label}
              </button>
            </div>
          );
        })}
      </aside>

      <div className="min-h-0 min-w-0 flex-1 overflow-auto">
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1 sm:hidden">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs font-medium",
                activeCategory === cat.id
                  ? "border-[var(--rh-brand,#047857)] bg-[color-mix(in_srgb,var(--rh-brand,#047857)_12%,white)] text-[var(--rh-brand,#047857)]"
                  : "border-[#e5e7eb] text-muted-foreground",
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <LayoutGrid className="mb-3 h-10 w-10 opacity-40" />
            <p>No dummy templates in this category yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  className="relative flex flex-col rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
                >
                  {item.badge && (
                    <span className="absolute left-0 top-3 rounded-r-md bg-[var(--rh-brand,#047857)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      {item.badge}
                    </span>
                  )}
                  <div className="mb-3 flex justify-center pt-2">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--rh-brand,#047857)_10%,white)] text-[var(--rh-brand,#047857)]">
                      <Icon className="h-7 w-7" />
                    </div>
                  </div>
                  <h3 className="text-center text-base font-semibold text-[#111c2d]">{item.title}</h3>
                  <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                    <Badge
                      variant="outline"
                      className={cn("rounded-md px-2 py-0 text-[10px] font-semibold uppercase", TYPE_STYLES[item.type])}
                    >
                      {item.type}
                    </Badge>
                    {item.buttons?.slice(0, 2).map((btn, idx) => (
                      <Badge
                        key={`${item.id}-btn-${idx}`}
                        variant="outline"
                        className="rounded-md border-[#e5e7eb] bg-[#f8faf9] px-2 py-0 text-[10px] font-medium text-[#414754]"
                      >
                        {buttonLabel(btn)}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-3 line-clamp-5 flex-1 whitespace-pre-line text-center text-sm leading-relaxed text-[#6b7280]">
                    {item.preview}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className={cn("h-9", outlineBtnClass || "rounded-lg border-[#d1d5db]")}
                      onClick={() => setPreviewItem(item)}
                    >
                      Preview
                    </Button>
                    <Button
                      type="button"
                      className={cn(
                        "h-9",
                        primaryBtnClass || "bg-[var(--rh-brand,#047857)] hover:bg-[var(--rh-brand-hover,#065f46)] text-white",
                        "rounded-lg",
                      )}
                      onClick={() => submitDummyTemplate(item)}
                    >
                      Submit
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!previewItem} onOpenChange={(open) => !open && setPreviewItem(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Template Preview</DialogTitle>
            <DialogDescription>{previewItem?.title}</DialogDescription>
          </DialogHeader>
          {previewItem && (
            <div className="mt-4 space-y-4">
              <div className="rounded-lg border bg-muted/30 p-6">
                {previewItem.type === "IMAGE" && (
                  <div className="mb-3 flex h-48 w-full items-center justify-center rounded-lg bg-muted px-4 text-center text-sm text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <ImageIcon className="h-8 w-8 opacity-50" />
                      <span>Image header (select media when sending)</span>
                    </div>
                  </div>
                )}
                {previewItem.type === "VIDEO" && (
                  <div className="mb-3 flex h-48 w-full items-center justify-center rounded-lg bg-muted px-4 text-center text-sm text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Video className="h-8 w-8 opacity-50" />
                      <span>Video header (select media when sending)</span>
                    </div>
                  </div>
                )}
                {previewItem.type === "FILE" && (
                  <div className="mb-3 flex h-48 w-full items-center justify-center rounded-lg bg-muted px-4 text-center text-sm text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="h-8 w-8 opacity-50" />
                      <span>Document header (select file when sending)</span>
                    </div>
                  </div>
                )}

                <div className="mb-3 whitespace-pre-wrap text-sm">
                  {toTemplateVariableBody(previewItem.preview)}
                </div>

                {previewItem.footer && (
                  <div className="border-t pt-3 text-xs text-muted-foreground">{previewItem.footer}</div>
                )}

                {previewItem.buttons && previewItem.buttons.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {previewItem.buttons.map((btn, index) => (
                      <Button
                        key={`${previewItem.id}-preview-btn-${index}`}
                        variant="outline"
                        size="sm"
                        className="w-full justify-start"
                        type="button"
                      >
                        {btn.type === "URL" && <ExternalLink className="mr-2 h-3 w-3" />}
                        {btn.type === "PHONE_NUMBER" && <PhoneIcon className="mr-2 h-3 w-3" />}
                        {btn.type === "QUICK_REPLY" && <MessageSquare className="mr-2 h-3 w-3" />}
                        {btn.text}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <div className="mt-1">
                    <Badge className="bg-green-500 text-white hover:bg-green-600">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Approved
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Category:</span>
                  <div className="mt-1">{categoryLabel(previewItem.category)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Language:</span>
                  <div className="mt-1">en</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Template ID:</span>
                  <div className="mt-1 font-mono text-xs">{previewItem.id}</div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" className={outlineBtnClass} onClick={() => setPreviewItem(null)}>
                  Close
                </Button>
                <Button
                  className={cn(
                    primaryBtnClass || "bg-[var(--rh-brand,#047857)] text-white",
                    "rounded-lg",
                  )}
                  onClick={() => {
                    submitDummyTemplate(previewItem);
                    setPreviewItem(null);
                  }}
                >
                  Submit
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
