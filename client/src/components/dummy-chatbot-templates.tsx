import {
  BookOpen,
  Building2,
  Car,
  ClipboardList,
  CreditCard,
  Eye,
  FileLock,
  Gamepad2,
  Headset,
  HeartPulse,
  Home,
  Phone,
  Rocket,
  Search,
  ShoppingCart,
  Ticket,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DummyChatbotRegionId =
  | "ecommerce"
  | "education"
  | "automotive"
  | "it-services"
  | "real-estate"
  | "saas-apps"
  | "gaming"
  | "entertainment"
  | "finance-banking"
  | "healthcare";

export type DummyChatbotTemplate = {
  id: string;
  region: DummyChatbotRegionId;
  title: string;
  subtitle: string;
  badge: string;
  statPercent: string;
  statLabel: string;
  description: string;
  tags: string[];
  features: Array<{ icon: LucideIcon; label: string }>;
};

export const DUMMY_CHATBOT_PRIMARY_REGIONS: Array<{ id: "all" | DummyChatbotRegionId; label: string }> = [
  { id: "all", label: "All" },
  { id: "ecommerce", label: "Ecommerce" },
  { id: "education", label: "Education" },
  { id: "automotive", label: "Automotive" },
  { id: "it-services", label: "IT Services" },
  { id: "real-estate", label: "Real Estate" },
  { id: "saas-apps", label: "SaaS/Apps" },
  { id: "gaming", label: "Gaming" },
  { id: "entertainment", label: "Entertainment" },
  { id: "finance-banking", label: "Finance and Banking" },
];

export const DUMMY_CHATBOT_MORE_REGIONS: Array<{ id: DummyChatbotRegionId; label: string }> = [
  { id: "healthcare", label: "Healthcare" },
];

export const DUMMY_CHATBOT_TEMPLATES: DummyChatbotTemplate[] = [
  {
    id: "order-support-bot",
    region: "ecommerce",
    title: "Order Support Bot",
    subtitle: "Faster order help",
    badge: "Popular",
    statPercent: "42%",
    statLabel: "Faster order help",
    description: "Help shoppers track orders, returns, and delivery updates.",
    tags: ["Orders", "Support"],
    features: [
      { icon: ShoppingCart, label: "Order status" },
      { icon: Search, label: "Track shipment" },
      { icon: Phone, label: "Talk to support" },
    ],
  },
  {
    id: "syllabus-checker",
    region: "education",
    title: "Syllabus Checker",
    subtitle: "Instant syllabus lookup",
    badge: "Helpful",
    statPercent: "40%",
    statLabel: "Instant syllabus lookup",
    description: "This Bot helps you access syllabus details for any",
    tags: ["Syllabus", "Exam prep", "Subjects"],
    features: [
      { icon: BookOpen, label: "Quick subject-wise syllabus lookup" },
      { icon: ClipboardList, label: "Exam level wise topic clarity" },
      { icon: FileLock, label: "Direct access to Sharda University PDFs" },
    ],
  },
  {
    id: "test-drive-assistant",
    region: "automotive",
    title: "Test Drive Assistant",
    subtitle: "Book a test drive",
    badge: "Useful",
    statPercent: "38%",
    statLabel: "Book a test drive",
    description: "Help buyers pick a model, city, and slot for a test drive.",
    tags: ["Cars", "Booking"],
    features: [
      { icon: Car, label: "Choose model" },
      { icon: ClipboardList, label: "Pick a slot" },
      { icon: Phone, label: "Dealer callback" },
    ],
  },
  {
    id: "it-helpdesk-bot",
    region: "it-services",
    title: "IT Helpdesk Bot",
    subtitle: "Resolve tickets faster",
    badge: "Helpful",
    statPercent: "41%",
    statLabel: "Resolve tickets faster",
    description: "Guide users through common IT issues and raise a ticket.",
    tags: ["IT", "Support"],
    features: [
      { icon: Headset, label: "Issue triage" },
      { icon: ClipboardList, label: "Raise ticket" },
      { icon: Phone, label: "Escalate" },
    ],
  },
  {
    id: "real-estate-helper",
    region: "real-estate",
    title: "Real Estate Helper",
    subtitle: "Improve buyer engagement",
    badge: "High Impact",
    statPercent: "45%",
    statLabel: "Improve buyer engagement",
    description: "Assist buyers with property search.",
    tags: ["Property", "Real Estate"],
    features: [
      { icon: Home, label: "Property Search" },
      { icon: Search, label: "Shortlist" },
      { icon: Phone, label: "Callback" },
    ],
  },
  {
    id: "saas-onboarding-bot",
    region: "saas-apps",
    title: "SaaS Onboarding Bot",
    subtitle: "Activate new users",
    badge: "Useful",
    statPercent: "37%",
    statLabel: "Activate new users",
    description: "Walk new users through setup, plans, and product help.",
    tags: ["SaaS", "Onboarding"],
    features: [
      { icon: Rocket, label: "Get started" },
      { icon: ClipboardList, label: "Choose plan" },
      { icon: Headset, label: "Talk to success" },
    ],
  },
  {
    id: "game-support-bot",
    region: "gaming",
    title: "Game Support Bot",
    subtitle: "Keep players playing",
    badge: "Popular",
    statPercent: "39%",
    statLabel: "Keep players playing",
    description: "Help players with account, rewards, and game issues.",
    tags: ["Gaming", "Support"],
    features: [
      { icon: Gamepad2, label: "Account help" },
      { icon: Ticket, label: "Rewards" },
      { icon: Headset, label: "Report issue" },
    ],
  },
  {
    id: "event-booking-bot",
    region: "entertainment",
    title: "Event Booking Bot",
    subtitle: "Sell more tickets",
    badge: "Trending",
    statPercent: "36%",
    statLabel: "Sell more tickets",
    description: "Let fans pick an event, date, and book tickets on chat.",
    tags: ["Events", "Tickets"],
    features: [
      { icon: Ticket, label: "Browse events" },
      { icon: ClipboardList, label: "Pick a date" },
      { icon: Phone, label: "Confirm booking" },
    ],
  },
  {
    id: "banking-assistant",
    region: "finance-banking",
    title: "Banking Assistant",
    subtitle: "Self-serve banking help",
    badge: "Trusted",
    statPercent: "43%",
    statLabel: "Self-serve banking help",
    description: "Help customers with balance, cards, and EMI queries.",
    tags: ["Banking", "Finance"],
    features: [
      { icon: CreditCard, label: "Card help" },
      { icon: ClipboardList, label: "EMI reminder" },
      { icon: Phone, label: "Fraud desk" },
    ],
  },
  {
    id: "clinic-appointment-bot",
    region: "healthcare",
    title: "Clinic Appointment Bot",
    subtitle: "Book visits faster",
    badge: "Help",
    statPercent: "34%",
    statLabel: "Book visits faster",
    description: "Let patients book, reschedule, or ask about reports.",
    tags: ["Clinic", "Appointments"],
    features: [
      { icon: HeartPulse, label: "Book visit" },
      { icon: Building2, label: "Choose clinic" },
      { icon: Phone, label: "Call clinic" },
    ],
  },
];

type DummyChatbotTemplateCardProps = {
  template: DummyChatbotTemplate;
  primaryBtnClass?: string;
  outlineBtnClass?: string;
  onFlowPreview?: (template: DummyChatbotTemplate) => void;
  onUseTemplate?: (template: DummyChatbotTemplate) => void;
};

export function DummyChatbotTemplateCard({
  template,
  primaryBtnClass,
  outlineBtnClass,
  onFlowPreview,
  onUseTemplate,
}: DummyChatbotTemplateCardProps) {
  return (
    <article className="flex h-full flex-col rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold leading-6 text-[#111827]">{template.title}</h3>
          <p className="mt-0.5 text-sm text-[#6b7280]">{template.subtitle}</p>
        </div>
        <span className="shrink-0 rounded-md bg-[#7c3aed] px-2 py-0.5 text-[11px] font-semibold leading-5 text-white">
          {template.badge}
        </span>
      </div>

      <p className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-[#16a34a]">
        <TrendingUp className="h-4 w-4" />
        {template.statPercent}
        <span className="font-medium">~ {template.statLabel}</span>
      </p>

      <p className="mt-3 text-sm leading-5 text-[#6b7280]">{template.description}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {template.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-[#f3f4f6] px-2.5 py-1 text-[11px] font-medium text-[#4b5563]"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 border-t border-[#f3f4f6] pt-4">
        {template.features.map((feature) => {
          const Icon = feature.icon;
          return (
            <div key={feature.label} className="flex flex-col items-center text-center">
              <Icon className="h-4 w-4 text-[#9ca3af]" />
              <p className="mt-2 text-[11px] leading-4 text-[#6b7280]">{feature.label}</p>
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        variant="outline"
        className={cn(
          "mt-5 h-10 w-full gap-2 text-sm font-semibold shadow-none",
          "border-[color-mix(in_srgb,var(--rh-brand,#047857)_32%,#e5e7eb)]",
          "bg-[var(--rh-brand-soft,#ecfdf5)] text-[var(--rh-brand,#047857)]",
          "hover:border-[var(--rh-brand,#047857)] hover:bg-[var(--rh-brand-light,#d1fae5)]",
          "hover:text-[var(--rh-brand-hover,#065f46)]",
          outlineBtnClass || "rounded-lg",
        )}
        onClick={() => onFlowPreview?.(template)}
      >
        <Eye className="h-4 w-4" />
        Chatbot Preview
      </Button>

      <Button
        type="button"
        className={cn(
          "mt-2 h-10 w-full text-sm font-semibold",
          primaryBtnClass || "bg-[var(--rh-brand,#047857)] text-white hover:bg-[var(--rh-brand-hover,#065f46)]",
          "rounded-lg",
        )}
        onClick={() => onUseTemplate?.(template)}
      >
        Use this Template
      </Button>
    </article>
  );
}

type DummyChatbotTemplatesGridProps = {
  templates?: DummyChatbotTemplate[];
  primaryBtnClass?: string;
  outlineBtnClass?: string;
  onFlowPreview?: (template: DummyChatbotTemplate) => void;
  onUseTemplate?: (template: DummyChatbotTemplate) => void;
};

export function DummyChatbotTemplatesGrid({
  templates = DUMMY_CHATBOT_TEMPLATES,
  primaryBtnClass,
  outlineBtnClass,
  onFlowPreview,
  onUseTemplate,
}: DummyChatbotTemplatesGridProps) {
  if (templates.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#e5e7eb] bg-white py-16 text-center text-sm text-muted-foreground">
        No dummy chatbot templates found.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {templates.map((template) => (
        <DummyChatbotTemplateCard
          key={template.id}
          template={template}
          primaryBtnClass={primaryBtnClass}
          outlineBtnClass={outlineBtnClass}
          onFlowPreview={onFlowPreview}
          onUseTemplate={onUseTemplate}
        />
      ))}
    </div>
  );
}
