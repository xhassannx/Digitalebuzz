import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRoute, useLocation, Link } from "wouter";
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  NodeProps,
  useReactFlow,
  ReactFlowInstance,
  NodeTypes,
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getBezierPath,
} from "reactflow";
import "reactflow/dist/style.css";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { FlowVariablePicker } from "@/components/flow-variable-picker";
import { FlowJsonDataField } from "@/components/flow-json-data-field";
import { FlowFieldWithVariables } from "@/components/flow-field-with-variables";
import { ContactFlowVariableChips } from "@/components/flow-contact-variable-chips";
import { appendFlowVariable } from "@/lib/flow-variable-utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ArrowLeft,
  Zap,
  X,
  MoreVertical,
  Check,
  Map,
  Maximize2,
  Minimize2,
  Search,
  Settings,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  Trash2,
  Loader2,
  RefreshCw,
  Copy,
  Clock,
  ListPlus,
  Image as ImageIcon,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useCurrentMemberPermissions } from "@/hooks/useCurrentMemberPermissions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { linearFlowFromCanvasNodesEdges } from "@/lib/flow-canvas-linear-sync";
import { GoogleSheetsActionExtraFields } from "@/components/integrations/google-sheets-action-extra-fields";
import { FlowRouterConfigPanel } from "@/components/flow-router-config-panel";
import {
  ensureRouterBranchGraph,
  addRouterBranchGraph,
  removeRouterBranchGraph,
  normalizeFlowEdges,
} from "@/lib/flow-router-graph";
import {
  getRouterBranches,
  routerBranchEdgeColor,
  routerBranchHandleLabel,
} from "@/lib/router-config";

type FlowStatus = "active" | "inactive" | "draft";

type AutomationFlow = {
  id: string;
  name: string;
  status: FlowStatus;
  createdAt: string;
  updatedAt: string;
  nodes?: FlowNode[];
  edges?: FlowEdge[];
};

type FlowNode = {
  id: string;
  type: string;
  position: { x: number; y: number };
  width?: number;
  height?: number;
  data: Record<string, any>;
};

type FlowEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

// Integration icons mapping
const INTEGRATION_ICONS: Record<string, string> = {
  "calendly": "/icons/calendly.svg",
  "google-calendar": "/icons/calendar_31_2x.png",
  "google-contacts": "/icons/google-contact.png",
  "google-sheets": "/icons/icon_1_spreadsheet_x32.png",
  "openai": "/icons/openai.png",
  "google-gemini": "/icons/gemini.jpg",
  "shopify": "/icons/shopify.svg",
  "zoom-webhook": "/icons/zoom.ico",
  "woocommerce": "/icons/woocommerce.svg",
  "tradeindia": "/icons/trade.ico",
  "indiamart": "/icons/indiamart.png",
  "whatsapp": "/icons/whatsapp.svg",
};

// App IDs to hide from the Select App modal (for now)
const HIDDEN_TRIGGER_APPS: string[] = [];
const HIDDEN_ACTION_APPS = ['woocommerce'];

// Normalize app display names for panel (match reference: WhatsApp, Contact)
// Only normalize exact app names, NOT trigger/action names like "Update Contact", "New Contact"
function getAppDisplayName(name: string | null | undefined): string {
  if (!name) return '';
  const n = name.toLowerCase().trim();
  if (n === 'whatsapp' || n === 'whatsapp-helicopticsolutions' || n === 'whatsapp helicopticsolutions') return 'WhatsApp';
  if (n === 'contact' || n === 'contacts' || n === 'contact-helicopticsolutions' || n === 'contact helicopticsolutions') return 'Contact';
  if (n === 'google-calendar') return 'Google Calendar';
  if (n === 'google-contacts') return 'Google Contacts';
  return name;
}

// Apps for child/action node selection (matching reference screenshots)
const AVAILABLE_ACTION_APPS = [
  { id: "calendly", name: "Calendly", icon: INTEGRATION_ICONS["calendly"] },
  { id: "contact-helicopticsolutions", name: "Contact", icon: null },
  { id: "datastore", name: "Datastore", icon: null },
  { id: "date-helper", name: "Date Helper", icon: null },
  { id: "delay", name: "Delay", icon: null },
  { id: "filter", name: "Filter", icon: null },
  { id: "google-contacts", name: "Google Contacts", icon: INTEGRATION_ICONS["google-contacts"] },
  { id: "google-gemini", name: "Google Gemini", icon: INTEGRATION_ICONS["google-gemini"] },
  { id: "google-sheets", name: "Google Sheets", icon: INTEGRATION_ICONS["google-sheets"] },
  { id: "http-request", name: "HTTP Request", icon: null },
  { id: "math-helper", name: "Math Helper", icon: null },
  { id: "openai", name: "OpenAI", icon: INTEGRATION_ICONS["openai"] },
  { id: "router", name: "Router", icon: "/icons/router.svg" },
  { id: "shopify", name: "Shopify", icon: INTEGRATION_ICONS["shopify"] },
  { id: "smtp", name: "SMTP", icon: null },
  { id: "telegram", name: "Telegram", icon: null },
  { id: "text-helper", name: "Text Helper", icon: null },
  { id: "whatsapp", name: "WhatsApp", icon: INTEGRATION_ICONS["whatsapp"] },
  { id: "webhook", name: "Webhook", icon: null },
  { id: "woocommerce", name: "Woocommerce", icon: INTEGRATION_ICONS["woocommerce"] },
  { id: "zoom-webhook", name: "Zoom (Webhook)", icon: INTEGRATION_ICONS["zoom-webhook"] },
  // Additional utility apps
  // { id: "data-helper", name: "Data Helper", icon: null },
  // { id: "scheduler", name: "Scheduler", icon: INTEGRATION_ICONS["google-calendar"] },
];

// Available apps for triggers (matching the screenshots)
const AVAILABLE_APPS = [
  { id: "calendly", name: "Calendly", icon: INTEGRATION_ICONS["calendly"] },
  { id: "contact-helicopticsolutions", name: "Contact", icon: null },
  { id: "google-calendar", name: "Google Calendar", icon: INTEGRATION_ICONS["google-calendar"] },
  { id: "google-sheets", name: "Google Sheets", icon: INTEGRATION_ICONS["google-sheets"] },
  { id: "indiamart", name: "Indiamart", icon: INTEGRATION_ICONS["indiamart"] },
  { id: "justdial", name: "Justdial", icon: null },
  { id: "razorpay", name: "Razorpay", icon: null },
  { id: "scheduler", name: "Scheduler", icon: INTEGRATION_ICONS["google-calendar"] },
  { id: "shopify", name: "Shopify", icon: INTEGRATION_ICONS["shopify"] },
  { id: "tradeindia", name: "Tradeindia", icon: INTEGRATION_ICONS["tradeindia"] },
  { id: "whatsapp", name: "WhatsApp", icon: INTEGRATION_ICONS["whatsapp"] },
  { id: "webhook", name: "Webhook", icon: null },
  { id: "woocommerce", name: "Woocommerce", icon: INTEGRATION_ICONS["woocommerce"] },
  { id: "zoom-webhook", name: "Zoom (Webhook)", icon: INTEGRATION_ICONS["zoom-webhook"] },
];

// Google Calendar triggers
const GOOGLE_CALENDAR_TRIGGERS = [
  { id: "new-calendar", name: "New calendar", description: "Triggers when a new calendar is created.", icon: INTEGRATION_ICONS["google-calendar"] },
  { id: "new-event", name: "New event", description: "Triggers when a new event is created.", icon: INTEGRATION_ICONS["google-calendar"] },
];

// Google Sheets actions (child node - second popup options)
/** Actions that pick an existing spreadsheet (not "create spreadsheet"). */
const GOOGLE_SHEETS_TARGET_SPREADSHEET_ACTIONS = new Set([
  "create-spreadsheet-row",
  "create-worksheet",
  "find-worksheet",
  "find-row",
  "update-row",
]);

const GOOGLE_SHEETS_ACTIONS = [
  { id: "create-spreadsheet", name: "Create spreadsheet", description: "Create a blank spreadsheet or duplicate an existing spreadsheet. Optionally, provide headers.", icon: INTEGRATION_ICONS["google-sheets"] },
  { id: "create-spreadsheet-row", name: "Create spreadsheet row", description: "Creates a new row in a specified spreadsheet.", icon: INTEGRATION_ICONS["google-sheets"] },
  { id: "create-worksheet", name: "Create worksheet", description: "Create a blank worksheet with a title. Optionally, provide headers.", icon: INTEGRATION_ICONS["google-sheets"] },
  { id: "find-worksheet", name: "Find worksheet", description: "Finds a worksheet by title. Optionally, create a worksheet if none are found.", icon: INTEGRATION_ICONS["google-sheets"] },
  { id: "find-row", name: "Find Row", description: "Find a row in a Google Sheet", icon: INTEGRATION_ICONS["google-sheets"] },
  { id: "update-row", name: "Update Row", description: "Update a row in a Google Sheet.", icon: INTEGRATION_ICONS["google-sheets"] },
];

// Google Sheets triggers
const GOOGLE_SHEETS_TRIGGERS = [
  { id: "new-spreadsheets", name: "New spreadsheets", description: "Triggers when you create a new spreadsheet.", icon: INTEGRATION_ICONS["google-sheets"] },
  { id: "new-worksheets", name: "New worksheets", description: "Triggers when you create a new worksheet in a spreadsheet.", icon: INTEGRATION_ICONS["google-sheets"] },
  { id: "new-spreadsheet-rows", name: "New spreadsheet rows", description: "Triggers when a new row is added to the bottom of a spreadsheet.", icon: INTEGRATION_ICONS["google-sheets"] },
];

// Calendly triggers
const CALENDLY_TRIGGERS = [
  { id: "event-canceled", name: "Event canceled", description: "Triggers when an event is canceled.", icon: INTEGRATION_ICONS["calendly"] },
  { id: "event-schedule", name: "Event schedule", description: "Triggers when a new event is scheduled.", icon: INTEGRATION_ICONS["calendly"] },
];

// Calendly actions (child node - second popup options)
const CALENDLY_ACTIONS = [
  { id: "cancel-event", name: "Cancel Event", description: "Cancel a scheduled event in Calendly.", icon: INTEGRATION_ICONS["calendly"] },
  { id: "custom-request", name: "Custom request", description: "Execute custom API requests using the authorized connections.", icon: INTEGRATION_ICONS["calendly"] },
];

// Google Calendar actions (child node)
const GOOGLE_CALENDAR_ACTIONS = [
  { id: "create-event", name: "Create event", description: "Create a new calendar event.", icon: INTEGRATION_ICONS["google-calendar"] },
  { id: "update-event", name: "Update event", description: "Update an existing calendar event.", icon: INTEGRATION_ICONS["google-calendar"] },
  { id: "custom-request-calendar", name: "Custom request", description: "Execute custom API requests.", icon: INTEGRATION_ICONS["google-calendar"] },
];

// Google Contacts actions (child node - uses google-contacts integration)
const GOOGLE_CONTACTS_ACTIONS = [
  { id: "create-google-contact", name: "Create contact", description: "Create a new contact in Google Contacts.", icon: INTEGRATION_ICONS["google-contacts"] },
  { id: "update-google-contact", name: "Update contact", description: "Update an existing Google Contact.", icon: INTEGRATION_ICONS["google-contacts"] },
  { id: "custom-request-google-contacts", name: "Custom request", description: "Execute custom API requests.", icon: INTEGRATION_ICONS["google-contacts"] },
];

// OpenAI actions (child node)
const OPENAI_ACTIONS = [
  { id: "openai-chat", name: "Chat completion", description: "Generate a response using OpenAI Chat API.", icon: INTEGRATION_ICONS["openai"] },
  { id: "openai-generate", name: "Generate text", description: "Generate text using OpenAI completions.", icon: INTEGRATION_ICONS["openai"] },
  { id: "custom-request-openai", name: "Custom request", description: "Execute custom API requests.", icon: INTEGRATION_ICONS["openai"] },
];

// Google Gemini actions (child node)
const GOOGLE_GEMINI_ACTIONS = [
  { id: "gemini-generate", name: "Generate content", description: "Generate content using Google Gemini.", icon: INTEGRATION_ICONS["google-gemini"] },
  { id: "gemini-chat", name: "Chat", description: "Chat with Gemini model.", icon: INTEGRATION_ICONS["google-gemini"] },
  { id: "custom-request-gemini", name: "Custom request", description: "Execute custom API requests.", icon: INTEGRATION_ICONS["google-gemini"] },
];

// Router actions - provides two-way branching (Branch 1 and Otherwise)
const ROUTER_ACTIONS = [
  { id: "router", name: "Router", description: "Route the flow into two paths: Branch 1 (when condition matches) and Otherwise (fallback).", icon: "/icons/router.svg" },
];

/** Canvas Delay sub-actions (matches reference: Delay for / Delay until). */
const DELAY_ACTIONS = [
  {
    id: "delay-for",
    name: "Delay for",
    description: "Delays the execution of the next action by a specified amount of time.",
    icon: null as string | null,
  },
  {
    id: "delay-until",
    name: "Delay until",
    description: "Delays the execution of the next action until a specified date and time in UTC ISO format.",
    icon: null as string | null,
  },
];

function delayForParts(
  unit: string,
  value: number
): { days: number; hours: number; minutes: number; seconds: number } {
  const v = Math.max(0, Math.floor(Number(value) || 0));
  const u = (unit || "minutes").toLowerCase();
  if (u === "weeks") return { days: v * 7, hours: 0, minutes: 0, seconds: 0 };
  if (u === "days") return { days: v, hours: 0, minutes: 0, seconds: 0 };
  if (u === "hours") return { days: 0, hours: v, minutes: 0, seconds: 0 };
  return { days: 0, hours: 0, minutes: v, seconds: 0 };
}

function inferDelayForFromConfig(cfg: Record<string, unknown>): { unit: string; value: number } {
  const unitRaw = typeof cfg.delayForUnit === "string" ? cfg.delayForUnit.toLowerCase() : "";
  const val = Math.max(0, Math.floor(Number(cfg.delayForValue) || 0));
  if (unitRaw && ["minutes", "hours", "days", "weeks"].includes(unitRaw)) {
    return { unit: unitRaw, value: val > 0 ? val : 1 };
  }
  const d = Math.max(0, Math.floor(Number(cfg.days) || 0));
  const h = Math.max(0, Math.floor(Number(cfg.hours) || 0));
  const m = Math.max(0, Math.floor(Number(cfg.minutes) || 0));
  const s = Math.max(0, Math.floor(Number(cfg.seconds) || 0));
  if (d === 0 && h === 0 && m === 0 && s === 0) return { unit: "minutes", value: 1 };
  if (d >= 7 && d % 7 === 0 && h === 0 && m === 0 && s === 0) return { unit: "weeks", value: d / 7 };
  if (h === 0 && m === 0 && s === 0) return { unit: "days", value: d };
  if (d === 0 && m === 0 && s === 0) return { unit: "hours", value: h };
  const totalMin = d * 24 * 60 + h * 60 + m + (s > 0 ? 1 : 0);
  return { unit: "minutes", value: Math.max(1, totalMin) };
}

// Contact triggers (managed contacts / CRM)
const CONTACT_TRIGGERS = [
  { id: "new-contact", name: "New Contact", description: "Triggers when a new contact is created.", icon: null },
  { id: "contact-updated", name: "Contact Updated", description: "Triggers when a contact is updated.", icon: null },
];

// Contact source options (matches contacts page)
const CONTACT_SOURCE_OPTIONS = [
  { value: "manual", label: "Manual" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "facebook", label: "Facebook" },
  { value: "import", label: "Import" },
  { value: "api", label: "API" },
  { value: "website", label: "Website" },
  { value: "indiamart", label: "IndiaMart" },
  { value: "google_ads", label: "Google Ads" },
  { value: "linkedin", label: "LinkedIn" },
];

// Contact actions (child node - second popup options)
const CONTACT_ACTIONS = [
  { id: "update-contact", name: "Update Contact", description: "Update a contact.", icon: null },
  { id: "get-contact", name: "Get Contact", description: "Fetch a contact by their ID.", icon: null },
  { id: "create-contact", name: "Create Contact", description: "Create a new contact.", icon: null },
  { id: "auto-assign-contact", name: "Auto Assign Contact", description: "Automatically assign a contact to users in a round-robin fashion.", icon: null },
  { id: "add-note", name: "Add Note", description: "Add a note to a contact.", icon: null },
  { id: "add-tag", name: "Add Tag", description: "Add a tag to a contact.", icon: null },
  { id: "custom-request-contact", name: "Custom request", description: "Execute custom API requests using the authorized connections.", icon: null },
];

// Indiamart triggers
const INDIAMART_TRIGGERS = [
  { id: "new-lead", name: "New Lead", description: "Triggers when a new lead is created.", icon: INTEGRATION_ICONS["indiamart"] },
];

// Justdial triggers
const JUSTDIAL_TRIGGERS = [
  { id: "justdial-new-lead", name: "New Lead", description: "Triggers when a new lead is created.", icon: null },
];

// Razorpay triggers
const RAZORPAY_TRIGGERS = [
  { id: "order-paid", name: "Order Paid", description: "Triggers (immediately if configured) when the webhook receives a request.", icon: null },
  { id: "payment-captured", name: "Payment Captured", description: "Triggers when the status of the payment is captured.", icon: null },
];

// Scheduler triggers
const SCHEDULER_TRIGGERS = [
  { id: "every-n-minutes", name: "Every N minutes", description: "Triggers every N minutes.", icon: INTEGRATION_ICONS["google-calendar"] },
  { id: "every-hour", name: "Every hour", description: "Triggers every hour.", icon: INTEGRATION_ICONS["google-calendar"] },
  { id: "every-day", name: "Every day", description: "Triggers every day.", icon: INTEGRATION_ICONS["google-calendar"] },
  { id: "every-week", name: "Every week", description: "Triggers every week.", icon: INTEGRATION_ICONS["google-calendar"] },
  { id: "every-month", name: "Every month", description: "Triggers every month.", icon: INTEGRATION_ICONS["google-calendar"] },
];

// Tradeindia triggers
const TRADEINDIA_TRIGGERS = [
  { id: "tradeindia-new-lead", name: "New Lead", description: "Triggers when a new lead is created.", icon: INTEGRATION_ICONS["tradeindia"] },
];

// Shopify triggers
const SHOPIFY_TRIGGERS = [
  {
    id: "new-order",
    name: "New Order",
    description: "Triggers on Shopify orders/create (new order placed).",
    icon: INTEGRATION_ICONS["shopify"],
  },
  {
    id: "new-paid-order",
    name: "New Paid Order",
    description: "Triggers on Shopify orders/paid (payment captured).",
    icon: INTEGRATION_ICONS["shopify"],
  },
  {
    id: "new-customer",
    name: "New Customer",
    description: "Triggers on Shopify customers/create.",
    icon: INTEGRATION_ICONS["shopify"],
  },
  {
    id: "new-abandoned-checkout",
    name: "New Abandoned Checkout",
    description: "Triggers on checkouts/create or checkouts/update (needs phone; skips completed checkouts).",
    icon: INTEGRATION_ICONS["shopify"],
  },
  {
    id: "new-cancelled-order",
    name: "New Cancelled Order",
    description: "Triggers on Shopify orders/cancelled.",
    icon: INTEGRATION_ICONS["shopify"],
  },
  {
    id: "updated-product",
    name: "Updated Product",
    description: "Triggers on products/create, products/update, or products/delete.",
    icon: INTEGRATION_ICONS["shopify"],
  },
];

/** WooCommerce webhook topic (X-WC-Webhook-Topic) for canvas trigger help text. */
const WOOCOMMERCE_TRIGGER_WEBHOOK_TOPICS: Record<string, string> = {
  "product-created": "product.created",
  "product-updated": "product.updated",
  "product-deleted": "product.deleted",
  "order-created": "order.created",
  "order-updated": "order.updated",
  "order-deleted": "order.deleted",
  "coupon-created": "coupon.created",
  "coupon-updated": "coupon.updated",
  "coupon-deleted": "coupon.deleted",
  "customer-created": "customer.created",
  "customer-updated": "customer.updated",
  "customer-deleted": "customer.deleted",
};

const SHOPIFY_TRIGGER_WEBHOOK_TOPICS: Record<string, string> = {
  "new-order": "orders/create",
  "new-paid-order": "orders/paid",
  "new-customer": "customers/create",
  "new-abandoned-checkout": "checkouts/create + checkouts/update",
  "new-cancelled-order": "orders/cancelled",
  "updated-product": "products/create | products/update | products/delete",
};

/** Friendly Shopify Admin webhook event labels for help text. */
const SHOPIFY_TRIGGER_ADMIN_EVENT_LABELS: Record<string, string> = {
  "new-order": "Order creation",
  "new-paid-order": "Order payment",
  "new-customer": "Customer creation",
  "new-abandoned-checkout": "Checkout creation + Checkout update",
  "new-cancelled-order": "Order cancellation",
  "updated-product": "Product creation / update / deletion",
};

// WhatsApp triggers
const WHATSAPP_TRIGGERS = [
  { id: "text-message-received", name: "Text Message Received", description: "Triggers when a message is received from WhatsApp.", icon: INTEGRATION_ICONS["whatsapp"] },
  { id: "list-message-reply", name: "List Message Reply", description: "Triggers when a list message reply button is pressed from a WhatsApp message.", icon: INTEGRATION_ICONS["whatsapp"] },
  { id: "template-message-button-reply", name: "Template Message Button Reply", description: "Triggers when a button reply is pressed from a WhatsApp template message.", icon: INTEGRATION_ICONS["whatsapp"] },
  { id: "interactive-message-button-reply", name: "Interactive Message Button Reply", description: "Triggers when a quick reply button is pressed from a Whatsapp interactive message.", icon: INTEGRATION_ICONS["whatsapp"] },
  { id: "form-message-response", name: "Form Message Response", description: "Triggers when a form message is responded to. This is typically used to capture responses from forms sent via WhatsApp.", icon: INTEGRATION_ICONS["whatsapp"] },
  { id: "on-first-message", name: "On First Message", description: "Triggers when a first message is received from WhatsApp.", icon: INTEGRATION_ICONS["whatsapp"] },
];

// WhatsApp actions (child node - second popup options)
const WHATSAPP_ACTIONS = [
  { id: "send-message", name: "Send message", description: "Number from message is sent.", icon: INTEGRATION_ICONS["whatsapp"] },
  { id: "send-template", name: "Send Template", description: "Number from template is sent.", icon: INTEGRATION_ICONS["whatsapp"] },
  { id: "send-media", name: "Send Media", description: "Number from media message is sent.", icon: INTEGRATION_ICONS["whatsapp"] },
  { id: "send-payment-link", name: "Send payment link", description: "Razorpay/Cashfree payment link via WhatsApp.", icon: INTEGRATION_ICONS["whatsapp"] },
  { id: "send-whatsapp-pay", name: "WhatsApp Pay", description: "Meta in-chat payment (India UPI). Falls back to payment link if not configured.", icon: INTEGRATION_ICONS["whatsapp"] },
  { id: "send-collection", name: "Send collection", description: "Multi-product message from a Shopify collection.", icon: INTEGRATION_ICONS["whatsapp"] },
  { id: "wait-for-reply", name: "Wait for Reply", description: "Wait for a reply from the user.", icon: INTEGRATION_ICONS["whatsapp"] },
];

function actionsForPendingApp(appId: string | undefined) {
  switch (appId) {
    case "google-sheets":
      return GOOGLE_SHEETS_ACTIONS;
    case "calendly":
      return CALENDLY_ACTIONS;
    case "contact-helicopticsolutions":
      return CONTACT_ACTIONS;
    case "google-calendar":
      return GOOGLE_CALENDAR_ACTIONS;
    case "google-contacts":
      return GOOGLE_CONTACTS_ACTIONS;
    case "openai":
      return OPENAI_ACTIONS;
    case "google-gemini":
      return GOOGLE_GEMINI_ACTIONS;
    case "router":
      return ROUTER_ACTIONS;
    case "delay":
      return DELAY_ACTIONS;
    default:
      return WHATSAPP_ACTIONS;
  }
}

// Webhook triggers
const WEBHOOK_TRIGGERS = [
  { id: "catch-raw-webhook", name: "Catch raw webhook", description: "Triggers (immediately if configured) when the webhook receives a request.", icon: null },
];

// Zoom (Webhook) triggers
const ZOOM_WEBHOOK_TRIGGERS = [
  { id: "zoom-webhook", name: "Zoom Webhook", description: "Triggers when a Zoom webhook is received.", icon: INTEGRATION_ICONS["zoom-webhook"] },
];

// WooCommerce triggers
const WOOCOMMERCE_TRIGGERS = [
  { id: "product-created", name: "Product created", description: "Triggers when a product is created.", icon: INTEGRATION_ICONS["woocommerce"] },
  { id: "product-updated", name: "Product updated", description: "Triggers when a product is updated.", icon: INTEGRATION_ICONS["woocommerce"] },
  { id: "product-deleted", name: "Product deleted", description: "Triggers when a product is deleted.", icon: INTEGRATION_ICONS["woocommerce"] },
  { id: "order-created", name: "Order Created", description: "Triggers when a new order is created.", icon: INTEGRATION_ICONS["woocommerce"] },
  { id: "order-updated", name: "Order updated", description: "Triggers when an order is updated.", icon: INTEGRATION_ICONS["woocommerce"] },
  { id: "order-deleted", name: "Order deleted", description: "Triggers when an order is deleted.", icon: INTEGRATION_ICONS["woocommerce"] },
  { id: "coupon-created", name: "Coupon Created", description: "Triggers when a new coupon is created.", icon: INTEGRATION_ICONS["woocommerce"] },
  { id: "coupon-updated", name: "Coupon Updated", description: "Triggers when a coupon is updated.", icon: INTEGRATION_ICONS["woocommerce"] },
  { id: "coupon-deleted", name: "Coupon Deleted", description: "Triggers when a coupon is deleted.", icon: INTEGRATION_ICONS["woocommerce"] },
  { id: "customer-created", name: "Customer Created", description: "Triggers when a new customer is created.", icon: INTEGRATION_ICONS["woocommerce"] },
  { id: "customer-updated", name: "Customer Updated", description: "Triggers when a customer is updated.", icon: INTEGRATION_ICONS["woocommerce"] },
  { id: "customer-deleted", name: "Customer Deleted", description: "Triggers when a customer is deleted.", icon: INTEGRATION_ICONS["woocommerce"] },
  { id: "new-cart-abandonment", name: "New Cart Abandonment", description: "Triggers when a new cart abandonment is created.", icon: INTEGRATION_ICONS["woocommerce"] },
];

function getCanvasTriggerDisplayName(data: Record<string, unknown> | undefined): string {
  if (!data) return 'Trigger';
  if (typeof data.triggerType === 'string' && data.triggerType.trim()) {
    return data.triggerType.trim();
  }
  const triggerId = String(data.selectedTrigger || '');
  const lists = [
    WHATSAPP_TRIGGERS,
    CONTACT_TRIGGERS,
    INDIAMART_TRIGGERS,
    JUSTDIAL_TRIGGERS,
    RAZORPAY_TRIGGERS,
    SCHEDULER_TRIGGERS,
    SHOPIFY_TRIGGERS,
    TRADEINDIA_TRIGGERS,
    WEBHOOK_TRIGGERS,
    ZOOM_WEBHOOK_TRIGGERS,
    WOOCOMMERCE_TRIGGERS,
    GOOGLE_CALENDAR_TRIGGERS,
    GOOGLE_SHEETS_TRIGGERS,
    CALENDLY_TRIGGERS,
  ];
  for (const list of lists) {
    const match = list.find((t) => t.id === triggerId);
    if (match) return match.name;
  }
  if (data.selectedApp) return getAppDisplayName(String(data.selectedApp));
  return 'Trigger';
}

function getCanvasActionDisplayName(data: Record<string, unknown> | undefined): string {
  if (!data) return 'Action';
  if (typeof data.selectedAction === 'string' && data.selectedAction.trim()) {
    return data.selectedAction.trim();
  }
  return 'Action';
}

function NodeInsertButtons({
  tone = 'orange',
  showParent = false,
  showChild = true,
  onInsertParent,
  onInsertChild,
}: {
  tone?: 'orange' | 'gray' | 'blue';
  showParent?: boolean;
  showChild?: boolean;
  onInsertParent?: () => void;
  onInsertChild?: () => void;
}) {
  if (!showParent && !showChild) return null;

  const ringClass =
    tone === 'blue'
      ? 'border-blue-400 text-blue-500 hover:bg-blue-50'
      : tone === 'gray'
        ? 'border-gray-400 text-gray-600 hover:bg-gray-50'
        : 'border-orange-400 text-orange-500 hover:bg-orange-50';

  return (
    <div className="absolute left-0 top-4 -translate-x-[calc(100%+10px)] flex flex-col gap-2 nodrag nopan z-10">
      {showParent ? (
        <button
          type="button"
          className={`flex h-7 w-7 items-center justify-center rounded-full border-2 bg-white shadow-sm transition-colors ${ringClass}`}
          aria-label="Insert parent node"
          title="Insert parent node"
          onClick={(e) => {
            e.stopPropagation();
            onInsertParent?.();
          }}
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </button>
      ) : null}
      {showChild ? (
        <button
          type="button"
          className={`flex h-7 w-7 items-center justify-center rounded-full border-2 bg-white shadow-sm transition-colors ${ringClass}`}
          aria-label="Insert child node"
          title="Insert child node"
          onClick={(e) => {
            e.stopPropagation();
            onInsertChild?.();
          }}
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function NodeConfigureButton({
  onClick,
  tone = 'orange',
}: {
  onClick: () => void;
  tone?: 'orange' | 'gray' | 'blue';
}) {
  const toneClass =
    tone === 'blue'
      ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
      : tone === 'gray'
        ? 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
        : 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100';
  return (
    <button
      type="button"
      className={`nodrag nopan w-full flex items-center justify-center gap-2 py-2 px-2 border rounded text-xs font-medium transition-colors ${toneClass}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <Settings className="h-3 w-3" />
      <span>Configure</span>
    </button>
  );
}

const TRIGGER_APPS_WITH_PICKER = [
  "google-calendar",
  "google-sheets",
  "calendly",
  "whatsapp",
  "contact-helicopticsolutions",
  "indiamart",
  "justdial",
  "razorpay",
  "scheduler",
  "shopify",
  "tradeindia",
  "webhook",
  "zoom-webhook",
  "woocommerce",
] as const;

function resolveTriggerAppMeta(
  selectedTrigger: string | undefined,
  selectedApp: string | undefined
): (typeof AVAILABLE_APPS)[number] | null {
  const triggerId = selectedTrigger || "";
  if (CONTACT_TRIGGERS.some((t) => t.id === triggerId)) {
    return AVAILABLE_APPS.find((a) => a.id === "contact-helicopticsolutions") ?? null;
  }
  if (GOOGLE_CALENDAR_TRIGGERS.some((t) => t.id === triggerId)) {
    return AVAILABLE_APPS.find((a) => a.id === "google-calendar") ?? null;
  }
  if (GOOGLE_SHEETS_TRIGGERS.some((t) => t.id === triggerId)) {
    return AVAILABLE_APPS.find((a) => a.id === "google-sheets") ?? null;
  }
  if (CALENDLY_TRIGGERS.some((t) => t.id === triggerId)) {
    return AVAILABLE_APPS.find((a) => a.id === "calendly") ?? null;
  }
  if (WHATSAPP_TRIGGERS.some((t) => t.id === triggerId)) {
    return AVAILABLE_APPS.find((a) => a.id === "whatsapp") ?? null;
  }
  if (INDIAMART_TRIGGERS.some((t) => t.id === triggerId)) {
    return AVAILABLE_APPS.find((a) => a.id === "indiamart") ?? null;
  }
  if (JUSTDIAL_TRIGGERS.some((t) => t.id === triggerId)) {
    return AVAILABLE_APPS.find((a) => a.id === "justdial") ?? null;
  }
  if (RAZORPAY_TRIGGERS.some((t) => t.id === triggerId)) {
    return AVAILABLE_APPS.find((a) => a.id === "razorpay") ?? null;
  }
  if (SCHEDULER_TRIGGERS.some((t) => t.id === triggerId)) {
    return AVAILABLE_APPS.find((a) => a.id === "scheduler") ?? null;
  }
  if (SHOPIFY_TRIGGERS.some((t) => t.id === triggerId)) {
    return AVAILABLE_APPS.find((a) => a.id === "shopify") ?? null;
  }
  if (TRADEINDIA_TRIGGERS.some((t) => t.id === triggerId)) {
    return AVAILABLE_APPS.find((a) => a.id === "tradeindia") ?? null;
  }
  if (WEBHOOK_TRIGGERS.some((t) => t.id === triggerId)) {
    return AVAILABLE_APPS.find((a) => a.id === "webhook") ?? null;
  }
  if (ZOOM_WEBHOOK_TRIGGERS.some((t) => t.id === triggerId)) {
    return AVAILABLE_APPS.find((a) => a.id === "zoom-webhook") ?? null;
  }
  if (WOOCOMMERCE_TRIGGERS.some((t) => t.id === triggerId)) {
    return AVAILABLE_APPS.find((a) => a.id === "woocommerce") ?? null;
  }
  const appLower = (selectedApp || "").toLowerCase();
  if (appLower.includes("contact")) {
    return AVAILABLE_APPS.find((a) => a.id === "contact-helicopticsolutions") ?? null;
  }
  return null;
}

/** Module-level handlers wired from FlowEditPage (survives API reload without callbacks in node.data). */
const flowNodeOpenTriggerPickerRef = { current: (_nodeId: string) => {} };
const flowNodeReconfigureTriggerRef = { current: (_nodeId: string) => {} };
const flowNodeOpenActionPickerRef = { current: (_nodeId: string) => {} };
const flowNodeReconfigureActionRef = { current: (_nodeId: string) => {} };

// Trigger Node Component
function TriggerNode({ data, selected, id }: NodeProps) {
  const isConfigured = !!(data.selectedTrigger || data.selectedApp);
  const triggerLabel = getCanvasTriggerDisplayName(data as Record<string, unknown>);
  const openConfigure = () => {
    if (id) {
      if (isConfigured) {
        flowNodeReconfigureTriggerRef.current(id);
      } else {
        flowNodeOpenTriggerPickerRef.current(id);
      }
    } else if (isConfigured) {
      data.onConfigureTrigger?.();
    } else {
      data.onChooseTrigger?.();
    }
  };

  return (
    <div className="relative">
      <NodeInsertButtons
        tone="orange"
        showChild
        onInsertChild={() => {
          if (data.onInsertChildNode) {
            data.onInsertChildNode();
          } else if (id) {
            flowNodeInsertChildRef.current(id);
          }
        }}
      />
      <div
        className={`flow-node-drag-handle px-4 py-3 bg-white border-2 rounded-lg shadow-sm cursor-grab active:cursor-grabbing ${selected ? 'border-orange-500' : 'border-orange-300'}`}
        style={{ minWidth: '280px' }}
      >
        <div className="flex items-start justify-between mb-2 gap-2">
          <div className="w-8" />
          <div className="flex-1 flex flex-col items-center text-center min-w-0 px-1">
            {isConfigured && data.appIcon ? (
              <img src={data.appIcon} alt="" className="w-6 h-6 mb-1 object-contain" />
            ) : (
              <Zap className="h-5 w-5 text-orange-500 mb-1" />
            )}
            <span className="font-medium text-sm leading-tight truncate max-w-full">
              {isConfigured ? triggerLabel : 'Trigger'}
            </span>
          </div>
          <div className="flex items-center gap-1 w-8 justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="nodrag nopan p-1 hover:bg-gray-100 rounded" onClick={(e) => e.stopPropagation()}>
                  <MoreVertical className="h-3 w-3 text-gray-500" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onSelect={() => openConfigure()}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Settings className="h-4 w-4 text-gray-600" />
                  <span>Configure Trigger</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    if (data.onInsertChildNode) {
                      data.onInsertChildNode();
                    } else if (id) {
                      flowNodeInsertChildRef.current(id);
                    }
                  }}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <ChevronDown className="h-4 w-4 text-gray-600" />
                  <span>Insert Child Node</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    if (data.onAddParallelTrigger) {
                      data.onAddParallelTrigger();
                    } else if (id) {
                      flowNodeAddParallelTriggerRef.current(id);
                    }
                  }}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <ListPlus className="h-4 w-4 text-gray-600" />
                  <span>Add parallel trigger</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <Handle type="source" position={Position.Bottom} id="source" className="w-3 h-3 bg-orange-500" />
        {!isConfigured ? (
          <button
            type="button"
            className="nodrag nopan w-full py-2.5 px-4 bg-orange-50 border border-orange-300 rounded-md text-orange-600 font-medium text-sm hover:bg-orange-100 flex items-center justify-center gap-2 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              openConfigure();
            }}
          >
            <span className="text-lg font-bold">+</span>
            Choose Trigger
          </button>
        ) : (
          <NodeConfigureButton tone="orange" onClick={openConfigure} />
        )}
      </div>
    </div>
  );
}

// Action Node Component
function ActionNode({ data, selected, id }: NodeProps) {
  const isChildOfTrigger = data.isChildOfTrigger || false;
  const isConfigured = !!(data.selectedAction || data.selectedActionId);
  const actionLabel = getCanvasActionDisplayName(data as Record<string, unknown>);
  const borderColor = isChildOfTrigger
    ? selected ? 'border-orange-500' : 'border-orange-300'
    : selected ? 'border-gray-500' : 'border-gray-300';
  const handleColor = isChildOfTrigger ? 'bg-orange-500' : 'bg-gray-500';
  const buttonBg = isChildOfTrigger ? 'bg-orange-50 border-orange-300' : 'bg-gray-50 border-gray-300';
  const buttonText = isChildOfTrigger ? 'text-orange-600' : 'text-gray-600';
  const buttonHover = isChildOfTrigger ? 'hover:bg-orange-100' : 'hover:bg-gray-100';
  const configureTone = isChildOfTrigger ? 'orange' : 'gray';

  const openConfigure = () => {
    if (id) {
      if (isConfigured) {
        flowNodeReconfigureActionRef.current(id);
      } else {
        flowNodeOpenActionPickerRef.current(id);
      }
    } else if (isConfigured) {
      data.onConfigureAction?.();
    } else {
      data.onChooseAction?.();
    }
  };

  return (
    <div className="relative">
      <NodeInsertButtons
        tone={configureTone}
        showParent
        showChild
        onInsertParent={() => {
          if (data.onInsertParentNode) {
            data.onInsertParentNode();
          } else if (id) {
            flowNodeInsertParentRef.current(id);
          }
        }}
        onInsertChild={() => {
          if (data.onInsertChildNode) {
            data.onInsertChildNode();
          } else if (id) {
            flowNodeInsertChildRef.current(id);
          }
        }}
      />
      <div
        className={`flow-node-drag-handle px-4 py-3 bg-white border-2 rounded-lg shadow-sm cursor-grab active:cursor-grabbing ${borderColor}`}
        style={{ minWidth: '280px' }}
      >
        <div className="flex items-start justify-between mb-2 gap-2">
          <div className="w-8" />
          <div className="flex-1 flex flex-col items-center text-center min-w-0 px-1">
            {isConfigured && data.actionIcon ? (
              <img src={data.actionIcon} alt="" className="w-6 h-6 mb-1 object-contain" />
            ) : null}
            <span className="font-medium text-sm leading-tight truncate max-w-full">
              {isConfigured ? actionLabel : 'Action'}
            </span>
          </div>
          <div className="flex items-center gap-1 w-8 justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="nodrag nopan p-1 hover:bg-gray-100 rounded" onClick={(e) => e.stopPropagation()}>
                  <MoreVertical className="h-3 w-3 text-gray-500" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onSelect={() => openConfigure()}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Settings className="h-4 w-4 text-gray-600" />
                  <span>Configure Action</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    if (data.onInsertParentNode) {
                      data.onInsertParentNode();
                    } else if (id) {
                      flowNodeInsertParentRef.current(id);
                    }
                  }}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <ChevronUp className="h-4 w-4 text-gray-600" />
                  <span>Insert Parent Node</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    if (data.onInsertChildNode) {
                      data.onInsertChildNode();
                    } else if (id) {
                      flowNodeInsertChildRef.current(id);
                    }
                  }}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <ChevronDown className="h-4 w-4 text-gray-600" />
                  <span>Insert Child Node</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    if (data.onDeleteNode) {
                      data.onDeleteNode();
                    } else if (id) {
                      flowNodeDeleteRef.current(id);
                    }
                  }}
                  className="flex items-center gap-2 cursor-pointer text-red-600 focus:text-red-600"
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                  <span>Delete Node</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <Handle type="target" position={Position.Top} id="target" className={`w-3 h-3 ${handleColor}`} />
        <Handle type="source" position={Position.Bottom} id="source" className={`w-3 h-3 ${handleColor}`} />
        {!isConfigured ? (
          <button
            type="button"
            className={`nodrag nopan w-full py-2.5 px-4 ${buttonBg} border ${buttonText} font-medium text-sm ${buttonHover} flex items-center justify-center gap-2 transition-colors`}
            onClick={(e) => {
              e.stopPropagation();
              openConfigure();
            }}
          >
            <span className="text-lg font-bold">+</span>
            Choose Action
          </button>
        ) : (
          <NodeConfigureButton tone={configureTone} onClick={openConfigure} />
        )}
      </div>
    </div>
  );
}

// Router Node — dynamic branch handles; labels shown on edges / config panel only
function RouterNode({ data, selected, id }: NodeProps) {
  const borderColor = selected ? 'border-blue-500' : 'border-blue-300';
  const branches = getRouterBranches(data?.config);
  const conditionalBranches = branches.filter((b) => !b.isOtherwise);
  const otherwiseBranch =
    branches.find((b) => b.isOtherwise) ??
    ({ id: "otherwise", name: "Otherwise", isOtherwise: true } as const);
  const displayBranches = [...conditionalBranches, otherwiseBranch];

  return (
    <div className="relative" style={{ minWidth: '280px' }}>
      <NodeInsertButtons
        tone="blue"
        showParent
        showChild
        onInsertParent={() => {
          if (data.onInsertParentNode) {
            data.onInsertParentNode();
          } else if (id) {
            flowNodeInsertParentRef.current(id);
          }
        }}
        onInsertChild={() => {
          if (data.onInsertChildNode) {
            data.onInsertChildNode();
          } else if (id) {
            flowNodeInsertChildRef.current(id);
          }
        }}
      />
      <div
        className={`flow-node-drag-handle px-4 py-3 bg-white border-2 rounded-lg shadow-sm cursor-grab active:cursor-grabbing ${borderColor} relative`}
      >
        <div className="flex items-start justify-between mb-2 gap-2">
          <div className="w-8" />
          <div className="flex-1 flex flex-col items-center text-center min-w-0 px-1">
            {data.routerIcon ? (
              <img src={data.routerIcon} alt="" className="w-6 h-6 mb-1 object-contain" />
            ) : null}
            <span className="font-medium text-sm leading-tight">Router</span>
          </div>
          <div className="flex items-center gap-1 w-8 justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="nodrag nopan p-1 hover:bg-gray-100 rounded" onClick={(e) => e.stopPropagation()}>
                  <MoreVertical className="h-3 w-3 text-gray-500" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onSelect={() => {
                    data.onConfigureAction?.();
                  }}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Settings className="h-4 w-4 text-gray-600" />
                  <span>Configure</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    if (data.onDeleteNode) {
                      data.onDeleteNode();
                    } else if (id) {
                      flowNodeDeleteRef.current(id);
                    }
                  }}
                  className="flex items-center gap-2 cursor-pointer text-red-600 focus:text-red-600"
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                  <span>Delete Node</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <Handle type="target" position={Position.Top} id="target" className="w-3 h-3 bg-blue-500" />
        <NodeConfigureButton
          tone="blue"
          onClick={() => {
            if (id) {
              flowNodeReconfigureActionRef.current(id);
            } else {
              data.onConfigureAction?.();
            }
          }}
        />
        <div className="relative mt-2 h-4 pb-1">
          {displayBranches.map((branch, index) => {
            const isOtherwise = branch.isOtherwise;
            const count = displayBranches.length;
            const left = `${((index + 0.5) / count) * 100}%`;
            return (
              <Handle
                key={`handle-${branch.id}`}
                type="source"
                position={Position.Bottom}
                id={branch.id}
                style={{ left }}
                className={`w-3 h-3 ${isOtherwise ? "bg-red-500" : "bg-blue-500"}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RouterBranchEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const label = String(data?.label ?? "");
  const color = String(data?.color ?? "#64748b");

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={{ ...style, stroke: color, strokeWidth: 2 }} />
      {label ? (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "none",
            }}
            className="nodrag nopan"
          >
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full border bg-white shadow-sm ${
                label === "Otherwise"
                  ? "text-red-600 border-red-200"
                  : "text-blue-600 border-blue-200"
              }`}
            >
              {label}
            </span>
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

/** Module-level handlers wired from FlowEditPage (node components render outside that scope). */
const flowNodeDeleteRef = { current: (_nodeId: string) => {} };
const flowNodeInsertChildRef = { current: (_parentNodeId?: string) => {} };
const flowNodeInsertParentRef = { current: (_childNodeId: string) => {} };
const flowNodeAddParallelTriggerRef = { current: (_triggerId: string) => {} };

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  router: RouterNode,
};

const edgeTypes = {
  routerBranch: RouterBranchEdge,
};

// WhatsApp session type from added-phones API
type WhatsAppSession = {
  sessionId: string;
  phoneNumberId: string;
  displayPhoneNumber?: string;
  verifiedName?: string;
  status?: string;
};

const EMPTY_WHATSAPP_SESSIONS: WhatsAppSession[] = [];

// Right Side Panel Components
function NodeConfigurationPanel({
  node,
  flowId,
  nodes,
  edges,
  onUpdateNodeData,
  onRouterAddBranch,
  onRouterRemoveBranch,
}: {
  node: Node | null;
  flowId: string;
  nodes: Node[];
  edges: Edge[];
  onUpdateNodeData?: (nodeId: string, data: Record<string, unknown>) => void;
  onRouterAddBranch?: (routerNodeId: string, branchId: string, branchName: string) => void;
  onRouterRemoveBranch?: (routerNodeId: string, branchId: string) => void;
}) {
  if (!node) return null;

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [isConnectionOpen, setIsConnectionOpen] = useState(true);
  const [isScopeOpen, setIsScopeOpen] = useState(true);
  const [isCalendarOpen, setIsCalendarOpen] = useState(true);
  const [isDriveOpen, setIsDriveOpen] = useState(true);
  const [isSpreadsheetOpen, setIsSpreadsheetOpen] = useState(true);
  const [isWorksheetOpen, setIsWorksheetOpen] = useState(true);
  const [isWebhookOpen, setIsWebhookOpen] = useState(true);
  const [isWebhookTestBusy, setIsWebhookTestBusy] = useState(false);
  const [isTestResultsOpen, setIsTestResultsOpen] = useState(false);
  const [testResultsTab, setTestResultsTab] = useState<'input' | 'output' | 'errors'>('input');
  const [testInput, setTestInput] = useState<string>("");
  const [testOutput, setTestOutput] = useState<string>("");
  const [testError, setTestError] = useState<string>("");
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<string>("");
  const [connectionSearchQuery, setConnectionSearchQuery] = useState("");
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isConnectionDropdownOpen, setIsConnectionDropdownOpen] = useState(false);
  const [selectedCalendar, setSelectedCalendar] = useState<string>("");
  const [calendarSearchQuery, setCalendarSearchQuery] = useState("");
  const [isCalendarDropdownOpen, setIsCalendarDropdownOpen] = useState(false);
  const [selectedDrive, setSelectedDrive] = useState<string>("");
  const [driveSearchQuery, setDriveSearchQuery] = useState("");
  const [isDriveDropdownOpen, setIsDriveDropdownOpen] = useState(false);
  const [selectedSpreadsheet, setSelectedSpreadsheet] = useState<string>("");
  const [spreadsheetSearchQuery, setSpreadsheetSearchQuery] = useState("");
  const [isSpreadsheetDropdownOpen, setIsSpreadsheetDropdownOpen] = useState(false);
  const [selectedWorksheet, setSelectedWorksheet] = useState<string>("");
  const [worksheetSearchQuery, setWorksheetSearchQuery] = useState("");
  const [isWorksheetDropdownOpen, setIsWorksheetDropdownOpen] = useState(false);
  const [isCopySpreadsheetDropdownOpen, setIsCopySpreadsheetDropdownOpen] = useState(false);
  const [copySpreadsheetSearchQuery, setCopySpreadsheetSearchQuery] = useState("");
  const [selectedScope, setSelectedScope] = useState<string>("");
  const [scopeSearchQuery, setScopeSearchQuery] = useState("");
  const [isScopeDropdownOpen, setIsScopeDropdownOpen] = useState(false);
  const [isTemplateOpen, setIsTemplateOpen] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [templateSearchQuery, setTemplateSearchQuery] = useState("");
  const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState(false);
  const [isPhoneNumberIdOpen, setIsPhoneNumberIdOpen] = useState(true);
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState<string>("");
  const [phoneNumberIdSearchQuery, setPhoneNumberIdSearchQuery] = useState("");
  const [isPhoneNumberIdDropdownOpen, setIsPhoneNumberIdDropdownOpen] = useState(false);
  const [replyPhone, setReplyPhone] = useState<string>("");
  const [timeoutUnit, setTimeoutUnit] = useState<string>("");
  const [timeoutValue, setTimeoutValue] = useState<string>("");
  const [isTimeoutUnitDropdownOpen, setIsTimeoutUnitDropdownOpen] = useState(false);
  const [mediaType, setMediaType] = useState<string>("");
  const [mediaUrl, setMediaUrl] = useState<string>("");
  const [mediaCaption, setMediaCaption] = useState<string>("");
  const [mediaTo, setMediaTo] = useState<string>("");
  const [isMediaTypeDropdownOpen, setIsMediaTypeDropdownOpen] = useState(false);
  const [templateTo, setTemplateTo] = useState<string>("");
  const [templateHeaderFormat, setTemplateHeaderFormat] = useState<string>("");
  const [templateHeaderImageUrl, setTemplateHeaderImageUrl] = useState<string>("");
  const [templateGalleryOpen, setTemplateGalleryOpen] = useState(false);
  const [mediaGalleryOpen, setMediaGalleryOpen] = useState(false);
  const [messageTo, setMessageTo] = useState<string>("");
  const [messageBody, setMessageBody] = useState<string>("");
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentDescription, setPaymentDescription] = useState<string>("");
  const [paymentCurrency, setPaymentCurrency] = useState<string>("INR");
  const [paymentBodyText, setPaymentBodyText] = useState<string>("");
  const [collectionId, setCollectionId] = useState<string>("");
  const [collectionTitle, setCollectionTitle] = useState<string>("");
  const [mediaFileName, setMediaFileName] = useState<string>("");
  const [templateDynamicFields, setTemplateDynamicFields] = useState<Array<{ index: number; value: string }>>([]);
  const [copySpreadsheetId, setCopySpreadsheetId] = useState<string>("");
  const [calendlyEventUuid, setCalendlyEventUuid] = useState<string>("");
  const [calendlyReason, setCalendlyReason] = useState<string>("");
  const [customRequestMethod, setCustomRequestMethod] = useState<string>("");
  const [customRequestUrl, setCustomRequestUrl] = useState<string>("");
  const [customRequestData, setCustomRequestData] = useState<string>("");
  // Contact action config
  const [contactSearchBy, setContactSearchBy] = useState<string>("");
  const [contactIdOrPhone, setContactIdOrPhone] = useState<string>("");
  const [contactName, setContactName] = useState<string>("");
  const [contactAssignTo, setContactAssignTo] = useState<string>("");
  const [contactSource, setContactSource] = useState<string>("");
  const [contactNote, setContactNote] = useState<string>("");
  const [contactPhone, setContactPhone] = useState<string>("");
  const [contactFirstName, setContactFirstName] = useState<string>("");
  const [contactLastName, setContactLastName] = useState<string>("");
  const [contactNotes, setContactNotes] = useState<string>("");
  const [contactCompany, setContactCompany] = useState<string>("");
  const [contactJobTitle, setContactJobTitle] = useState<string>("");
  const [contactTags, setContactTags] = useState<string>("");
  const [contactAllowDuplicate, setContactAllowDuplicate] = useState<string>("");
  const [contactEmail, setContactEmail] = useState<string>("");
  const [contactStatus, setContactStatus] = useState<string>("");
  const [contactOptIn, setContactOptIn] = useState<string>("");
  // Google Calendar action config
  const [calendarEventSummary, setCalendarEventSummary] = useState<string>("");
  const [calendarEventDescription, setCalendarEventDescription] = useState<string>("");
  const [calendarEventStart, setCalendarEventStart] = useState<string>("");
  const [calendarEventEnd, setCalendarEventEnd] = useState<string>("");
  const [calendarEventId, setCalendarEventId] = useState<string>("");
  // Google Contacts action config
  const [googleContactName, setGoogleContactName] = useState<string>("");
  const [googleContactEmail, setGoogleContactEmail] = useState<string>("");
  const [googleContactPhone, setGoogleContactPhone] = useState<string>("");
  const [googleContactResourceName, setGoogleContactResourceName] = useState<string>("");
  const [openaiPrompt, setOpenaiPrompt] = useState<string>("");
  const [openaiModel, setOpenaiModel] = useState<string>("gpt-4o");
  const [geminiPrompt, setGeminiPrompt] = useState<string>("");
  const [geminiModel, setGeminiModel] = useState<string>("gemini-1.5-flash");
  const [delayForUnit, setDelayForUnit] = useState<string>("minutes");
  const [delayForValue, setDelayForValue] = useState<string>("1");
  const [delayUntilIso, setDelayUntilIso] = useState<string>("");
  const [isDelayUnitDropdownOpen, setIsDelayUnitDropdownOpen] = useState(false);

  // Dropdown options data
  const [drives, setDrives] = useState<Array<{ id: string; name: string }>>([]);
  const [spreadsheets, setSpreadsheets] = useState<Array<{ id: string; name: string }>>([]);
  const [worksheets, setWorksheets] = useState<Array<{ id: string; name: string }>>([]);
  const [calendars, setCalendars] = useState<Array<{ id: string; name: string }>>([]);
  const [scopes, setScopes] = useState<Array<{ id: string; name: string }>>([]);
  const [templates, setTemplates] = useState<
    Array<{
      id: string;
      name: string;
      templateId?: string;
      components?: Array<{
        type?: string;
        format?: string;
        example?: { header_handle?: string[]; header_url?: string[] };
      }>;
    }>
  >([]);

  const { data: templateGalleryItems = [] } = useQuery<Array<{ id: string; url: string; name?: string }>>({
    queryKey: ["/api/gallery", "image", "flow-template-header"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/gallery?type=image");
      return await res.json();
    },
    enabled: templateGalleryOpen,
  });

  const flowMediaGalleryType = useMemo(() => {
    const t = String(mediaType || "Image").toLowerCase();
    if (t === "video") return "video";
    if (t === "audio") return "audio";
    if (t === "document") return "document";
    return "image";
  }, [mediaType]);

  const { data: flowMediaGalleryItems = [] } = useQuery<
    Array<{ id: string; url: string; name?: string; type?: string }>
  >({
    queryKey: ["/api/gallery", flowMediaGalleryType, "flow-send-media"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/gallery?type=${flowMediaGalleryType}`);
      return await res.json();
    },
    enabled: mediaGalleryOpen,
  });
  
  // Connection form state
  const [connectionName, setConnectionName] = useState("");
  const [personalToken, setPersonalToken] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [redirectUri, setRedirectUri] = useState("");
  const [connectPending, setConnectPending] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [businessAccountId, setBusinessAccountId] = useState("");
  // IndiaMart Configure modal (webhook URL, token, setup steps - same as integrations/indiamart page)
  const [isIndiaMartConfigureOpen, setIsIndiaMartConfigureOpen] = useState(false);
  const [indiaMartToken, setIndiaMartToken] = useState("");
  const [indiaMartWebhookUrl, setIndiaMartWebhookUrl] = useState("");
  const [indiaMartRegeneratePending, setIndiaMartRegeneratePending] = useState(false);

  const nodeTitle = node.type === 'trigger' 
    ? getAppDisplayName(node.data?.selectedApp || node.data?.triggerType || 'Event schedule')
    : getAppDisplayName(node.data?.selectedAction || 'Action');
  
  // For Google Calendar/Sheets/Calendly/WhatsApp triggers, use the appropriate integration name for connection filtering
  // For action nodes: WhatsApp actions (send-message, etc.) use whatsapp-business
  const selectedAppName = node.type === 'trigger' 
    ? (node.data?.selectedTrigger 
        ? (GOOGLE_CALENDAR_TRIGGERS.find(t => t.id === node.data.selectedTrigger) ? 'google-calendar' : 
           GOOGLE_SHEETS_TRIGGERS.find(t => t.id === node.data.selectedTrigger) ? 'google-sheets' : 
           CALENDLY_TRIGGERS.find(t => t.id === node.data.selectedTrigger) ? 'calendly' :
           WHATSAPP_TRIGGERS.find(t => t.id === node.data.selectedTrigger) ? 'whatsapp-business' :
           CONTACT_TRIGGERS.find(t => t.id === node.data.selectedTrigger) ? 'contacts' :
           INDIAMART_TRIGGERS.find(t => t.id === node.data.selectedTrigger) ? 'indiamart' :
           JUSTDIAL_TRIGGERS.find(t => t.id === node.data.selectedTrigger) ? 'justdial' :
           RAZORPAY_TRIGGERS.find(t => t.id === node.data.selectedTrigger) ? 'razorpay' :
           SCHEDULER_TRIGGERS.find(t => t.id === node.data.selectedTrigger) ? 'scheduler' :
           SHOPIFY_TRIGGERS.find(t => t.id === node.data.selectedTrigger) ? 'shopify' :
           TRADEINDIA_TRIGGERS.find(t => t.id === node.data.selectedTrigger) ? 'tradeindia' :
           WEBHOOK_TRIGGERS.find(t => t.id === node.data.selectedTrigger) ? 'webhook' :
           ZOOM_WEBHOOK_TRIGGERS.find(t => t.id === node.data.selectedTrigger) ? 'zoom-webhook' :
           WOOCOMMERCE_TRIGGERS.find(t => t.id === node.data.selectedTrigger) ? 'woocommerce' :
           (node.data?.selectedApp || '').toLowerCase().replace(/\s+/g, '-'))
        : (node.data?.selectedApp || '').toLowerCase().replace(/\s+/g, '-'))
    : (WHATSAPP_ACTIONS.find(a => a.id === node.data?.selectedActionId) ? 'whatsapp-business' : GOOGLE_SHEETS_ACTIONS.find(a => a.id === node.data?.selectedActionId) ? 'google-sheets' : CALENDLY_ACTIONS.find(a => a.id === node.data?.selectedActionId) ? 'calendly' : CONTACT_ACTIONS.find(a => a.id === node.data?.selectedActionId) ? 'contact-helicopticsolutions' : GOOGLE_CALENDAR_ACTIONS.find(a => a.id === node.data?.selectedActionId) ? 'google-calendar' : GOOGLE_CONTACTS_ACTIONS.find(a => a.id === node.data?.selectedActionId) ? 'google-contacts' : OPENAI_ACTIONS.find(a => a.id === node.data?.selectedActionId) ? 'openai' : GOOGLE_GEMINI_ACTIONS.find(a => a.id === node.data?.selectedActionId) ? 'google-gemini' : DELAY_ACTIONS.find(a => a.id === node.data?.selectedActionId) ? 'delay' : (node.data?.selectedAction || '').toLowerCase().replace(/\s+/g, '-'));

  // Fetch connected integrations
  const { data: connectedIntegrations = [] } = useQuery<Array<{ id: string; name: string; displayName: string; connectionName?: string; config?: { connectionName?: string; name?: string } }>>({
    queryKey: ['/api/integrations'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/integrations');
      return await res.json();
    },
  });

  // Fetch WhatsApp sessions (added phone numbers from /connect) when WhatsApp is selected (trigger or action)
  const isWhatsApp = selectedAppName === 'whatsapp-business' || selectedAppName === 'whatsapp';
  const showExternalWebhookUrl =
    node.type === 'trigger' &&
    (selectedAppName === 'webhook' ||
      selectedAppName === 'shopify' ||
      selectedAppName === 'woocommerce' ||
      selectedAppName === 'zoom-webhook' ||
      selectedAppName === 'indiamart' ||
      selectedAppName === 'justdial' ||
      selectedAppName === 'tradeindia' ||
      selectedAppName === 'razorpay' ||
      selectedAppName === 'calendly');
  const isContactCanvasTrigger =
    node.type === 'trigger' &&
    (node.data?.selectedTrigger === 'contact-updated' || node.data?.selectedTrigger === 'new-contact');
  const isGoogleSheetsRowTrigger =
    node.type === 'trigger' &&
    selectedAppName === 'google-sheets' &&
    node.data?.selectedTrigger === 'new-spreadsheet-rows';
  const flowHasGoogleSheetsRowTrigger = nodes.some(
    (n) => n.type === 'trigger' && n.data?.selectedTrigger === 'new-spreadsheet-rows'
  );
  const isWhatsAppTrigger = !!WHATSAPP_TRIGGERS.find(t => t.id === node.data?.selectedTrigger);
  const isWhatsAppAction = !!WHATSAPP_ACTIONS.find(a => a.id === node.data?.selectedActionId) ||
    (node.type === 'action' && (selectedAppName === 'whatsapp' || selectedAppName === 'whatsapp-business'));
  const isGoogleSheetsAction = !!GOOGLE_SHEETS_ACTIONS.find(a => a.id === node.data?.selectedActionId) ||
    (node.type === 'action' && selectedAppName === 'google-sheets');
  const isCalendlyAction = !!CALENDLY_ACTIONS.find(a => a.id === node.data?.selectedActionId) ||
    (node.type === 'action' && selectedAppName === 'calendly');
  const isContactAction = !!CONTACT_ACTIONS.find(a => a.id === node.data?.selectedActionId) ||
    (node.type === 'action' && selectedAppName === 'contact-helicopticsolutions');
  const isGoogleCalendarAction = !!GOOGLE_CALENDAR_ACTIONS.find(a => a.id === node.data?.selectedActionId) ||
    (node.type === 'action' && selectedAppName === 'google-calendar');
  const isGoogleContactsAction = !!GOOGLE_CONTACTS_ACTIONS.find(a => a.id === node.data?.selectedActionId) ||
    (node.type === 'action' && selectedAppName === 'google-contacts');
  const isOpenAIAction = !!OPENAI_ACTIONS.find(a => a.id === node.data?.selectedActionId) ||
    (node.type === 'action' && selectedAppName === 'openai');
  const isGeminiAction = !!GOOGLE_GEMINI_ACTIONS.find(a => a.id === node.data?.selectedActionId) ||
    (node.type === 'action' && selectedAppName === 'google-gemini');
  const isDelayAction =
    node.type === 'action' &&
    (!!DELAY_ACTIONS.find((a) => a.id === node.data?.selectedActionId) || selectedAppName === 'delay');
  const isRouterNode = node.type === 'router';
  const { data: whatsappSessionsData } = useQuery<{ success?: boolean; phoneNumbers?: WhatsAppSession[] }>({
    queryKey: ['/api/integrations/whatsapp-business/added-phones'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/integrations/whatsapp-business/added-phones');
      return await res.json();
    },
    // Fetch when: WhatsApp trigger, WhatsApp action, or any action node (so sessions are ready when user selects WhatsApp)
    enabled: (isWhatsApp && (isWhatsAppTrigger || isWhatsAppAction)) || node.type === 'action',
  });

  const whatsappSessions = useMemo(
    () => whatsappSessionsData?.phoneNumbers ?? EMPTY_WHATSAPP_SESSIONS,
    [whatsappSessionsData?.phoneNumbers]
  );

  // Fetch organization members for Contact Assign To dropdown
  const { data: organizationsData } = useQuery<{ organizations?: any[] } | any[]>({
    queryKey: ['/api/organizations'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/organizations');
      return await res.json();
    },
    enabled: isContactAction,
  });
  const organizationsList = Array.isArray(organizationsData) ? organizationsData : (organizationsData?.organizations || []);
  const currentOrganizationId = organizationsList[0]?.id;
  const { hasPermission } = useCurrentMemberPermissions();
  const canViewTeamMembers = hasPermission("manage_team.view");
  const { data: orgMembers = [] } = useQuery<any[]>({
    queryKey: ['/api/organizations', currentOrganizationId, 'members'],
    queryFn: async () => {
      if (!currentOrganizationId) return [];
      const res = await apiRequest('GET', `/api/organizations/${currentOrganizationId}/members`);
      return await res.json();
    },
    enabled: !!currentOrganizationId && isContactAction && canViewTeamMembers,
  });

  // Fetch tags for Contact Tags dropdown
  const { data: contactTagsList = [] } = useQuery<any[]>({
    queryKey: ['/api/tags'],
    queryFn: async () => {
      try {
        const res = await apiRequest('GET', '/api/tags');
        return await res.json();
      } catch {
        return [];
      }
    },
    enabled:
      isContactAction &&
      (node.data?.selectedActionId === 'create-contact' ||
        node.data?.selectedActionId === 'update-contact' ||
        node.data?.selectedActionId === 'add-tag'),
  });

  // Filter connections based on selected app
  const appConnections = connectedIntegrations.filter(conn => {
    if (!selectedAppName) return false;
    // Map app names to integration names
    const appToIntegrationMap: Record<string, string> = {
      'calendly': 'calendly',
      'google-calendar': 'google-calendar',
      'google-sheets': 'google-sheets',
      'google-sheet': 'google-sheets',
      'google-contacts': 'google-contacts',
      'openai': 'openai',
      'google-gemini': 'google-gemini',
      'whatsapp': 'whatsapp-business',
      'whatsapp-helicopticsolutions': 'whatsapp-business',
      'contacts': 'google-contacts',
      'contact-helicopticsolutions': '__internal_contact__', // Contact uses internal /api/contacts, no integration
      'indiamart': 'indiamart',
      'justdial': 'justdial',
      'razorpay': 'razorpay',
      'scheduler': 'scheduler',
      'shopify': 'shopify',
      'tradeindia': 'tradeindia',
      'webhook': 'webhook',
      'zoom-webhook': 'zoom-webhook',
      'woocommerce': 'woocommerce',
    };
    const integrationName = appToIntegrationMap[selectedAppName] || selectedAppName;
    if (integrationName === '__internal_contact__') return false; // Contact uses internal API, no connections
    return conn.name === integrationName;
  });

  // Connection options: for WhatsApp (trigger or action) use sessions from /connect, for others use integrations
  const connectionOptions = isWhatsApp && (isWhatsAppTrigger || isWhatsAppAction)
    ? whatsappSessions.map(s => ({ id: s.sessionId, ...s, _isSession: true as const }))
    : appConnections;

  // Get display label for a connection or WhatsApp session
  const getConnectionLabel = (
    conn: { id: string; connectionName?: string; config?: { connectionName?: string; name?: string }; displayName?: string; name?: string; displayPhoneNumber?: string; verifiedName?: string; _isSession?: boolean },
    index?: number
  ) => {
    if (conn._isSession) {
      const session = conn as unknown as WhatsAppSession & { _isSession: true };
      return session.displayPhoneNumber || session.verifiedName || session.sessionId || 'WhatsApp session';
    }
    const baseLabel = conn.config?.connectionName || conn.connectionName || conn.config?.name || conn.displayName || conn.name;
    if (conn.name === 'whatsapp-business' && (!baseLabel || baseLabel === 'Whatsapp Business' || baseLabel === 'WhatsApp Business')) {
      const suffix = index !== undefined ? ` #${index + 1}` : ` (${conn.id.slice(-6)})`;
      return `${baseLabel || 'WhatsApp Business'}${suffix}`;
    }
    return baseLabel || 'Unnamed connection';
  };

  const filteredConnections = connectionOptions.filter(conn =>
    getConnectionLabel(conn).toLowerCase().includes(connectionSearchQuery.toLowerCase())
  );

  // Sync selectedConnection, selectedPhoneNumberId, selectedTemplate from node config when node changes
  useEffect(() => {
    const configConnectionId = node.data?.config?.connectionId;
    const configPhoneNumberId = node.data?.config?.phoneNumberId;
    const configTemplateId = node.data?.config?.templateId;
    if (configConnectionId) {
      setSelectedConnection(configConnectionId);
      if (configPhoneNumberId) {
        setSelectedPhoneNumberId(configPhoneNumberId);
      } else if (isWhatsApp && whatsappSessions.length > 0) {
        const session = whatsappSessions.find((s: WhatsAppSession) => s.sessionId === configConnectionId);
        setSelectedPhoneNumberId(session?.phoneNumberId || '');
      } else {
        setSelectedPhoneNumberId('');
      }
    } else {
      setSelectedConnection('');
      setSelectedPhoneNumberId('');
    }
    setSelectedTemplate(configTemplateId || '');
    setReplyPhone((node?.data?.config as any)?.replyPhone || '');
    setTimeoutUnit((node?.data?.config as any)?.timeoutUnit || '');
    setTimeoutValue((node?.data?.config as any)?.timeoutValue || '');
    setMediaType((node?.data?.config as any)?.mediaType || '');
    setMediaUrl((node?.data?.config as any)?.mediaUrl || '');
    setMediaCaption((node?.data?.config as any)?.mediaCaption || '');
    setMediaTo((node?.data?.config as any)?.mediaTo || (node?.data?.config as any)?.to || '');
    const cfgTo = (node?.data?.config as any)?.templateTo || (node?.data?.config as any)?.to || '';
    const defaultSheetTo = flowHasGoogleSheetsRowTrigger ? '{{trigger.phone}}' : '';
    const nextTemplateTo = cfgTo || defaultSheetTo;
    setTemplateTo(nextTemplateTo);
    if (
      !cfgTo &&
      defaultSheetTo &&
      node.data?.selectedActionId === 'send-template' &&
      onUpdateNodeData
    ) {
      onUpdateNodeData(node.id, {
        config: { ...node.data?.config, templateTo: defaultSheetTo, to: defaultSheetTo },
      });
    }
    setTemplateHeaderImageUrl(String((node?.data?.config as any)?.headerImageUrl || ''));
    setTemplateHeaderFormat(
      String((node?.data?.config as any)?.headerFormat || (node?.data?.config as any)?.mediaType || '').toUpperCase()
    );
    setMessageTo((node?.data?.config as any)?.messageTo || (node?.data?.config as any)?.to || '');
    setMessageBody(
      (node?.data?.config as any)?.messageBody ||
        (node?.data?.config as any)?.body ||
        (node?.data?.config as any)?.text ||
        (node?.data?.config as any)?.message ||
        ""
    );
    setPaymentAmount(
      String((node?.data?.config as any)?.amount || (node?.data?.config as any)?.paymentAmount || "")
    );
    setPaymentDescription(String((node?.data?.config as any)?.description || (node?.data?.config as any)?.paymentDescription || ""));
    setPaymentCurrency(String((node?.data?.config as any)?.currency || "INR"));
    setPaymentBodyText(String((node?.data?.config as any)?.bodyText || ""));
    setCollectionId(String((node?.data?.config as any)?.collectionId || ""));
    setCollectionTitle(String((node?.data?.config as any)?.collectionTitle || (node?.data?.config as any)?.sectionTitle || ""));
    setMediaFileName((node?.data?.config as any)?.mediaFileName || (node?.data?.config as any)?.fileName || "");
    const cfgDynamic = (node?.data?.config as any)?.templateParams;
    if (Array.isArray(cfgDynamic)) {
      setTemplateDynamicFields(cfgDynamic.map((v: string, i: number) => ({ index: i + 1, value: String(v ?? '') })));
    } else if (cfgDynamic && typeof cfgDynamic === 'object') {
      const arr = Object.keys(cfgDynamic).sort((a, b) => parseInt(a) - parseInt(b)).map(k => ({ index: parseInt(k), value: String(cfgDynamic[k] ?? '') }));
      setTemplateDynamicFields(arr);
    } else {
      setTemplateDynamicFields([]);
    }
    setSelectedCalendar((node?.data?.config as any)?.calendarId || '');
    setSelectedDrive((node?.data?.config as any)?.driveId || '');
    setSelectedSpreadsheet((node?.data?.config as any)?.spreadsheetId || '');
    setSelectedWorksheet((node?.data?.config as any)?.worksheetId || '');
    setCopySpreadsheetId((node?.data?.config as any)?.copySpreadsheetId || '');
    setCalendlyEventUuid((node?.data?.config as any)?.eventUuid || '');
    setCalendlyReason((node?.data?.config as any)?.reason || '');
    setCustomRequestMethod((node?.data?.config as any)?.method || '');
    setCustomRequestUrl((node?.data?.config as any)?.url || '');
    setCustomRequestData((node?.data?.config as any)?.data || '');
    setContactSearchBy((node?.data?.config as any)?.searchByIdOrPhone || '');
    setContactIdOrPhone((node?.data?.config as any)?.contactIdOrPhone || '');
    setContactName((node?.data?.config as any)?.name || '');
    setContactAssignTo((node?.data?.config as any)?.assignTo || '');
    setContactSource((node?.data?.config as any)?.source || '');
    setContactNote((node?.data?.config as any)?.note || '');
    setContactPhone((node?.data?.config as any)?.phone || '');
    const cfg = (node?.data?.config || {}) as Record<string, unknown>;
    let fn = String(cfg.firstName ?? "");
    let ln = String(cfg.lastName ?? "");
    if (!fn && !ln && String(cfg.name ?? "").trim()) {
      const full = String(cfg.name).trim();
      const sp = full.indexOf(" ");
      if (sp === -1) {
        fn = full;
      } else {
        fn = full.slice(0, sp);
        ln = full.slice(sp + 1).trim();
      }
    }
    setContactFirstName(fn);
    setContactLastName(ln);
    setContactNotes(String(cfg.notes ?? ""));
    setContactCompany(String(cfg.company ?? ""));
    setContactJobTitle(String(cfg.jobTitle ?? ""));
    setContactTags((node?.data?.config as any)?.tags || '');
    setContactAllowDuplicate((node?.data?.config as any)?.allowDuplicate || '');
    setContactEmail((node?.data?.config as any)?.email || '');
    setContactStatus((node?.data?.config as any)?.status || '');
    setContactOptIn((node?.data?.config as any)?.optIn || '');
    setCalendarEventSummary((node?.data?.config as any)?.eventSummary || '');
    setCalendarEventDescription((node?.data?.config as any)?.eventDescription || '');
    setCalendarEventStart((node?.data?.config as any)?.eventStart || '');
    setCalendarEventEnd((node?.data?.config as any)?.eventEnd || '');
    setCalendarEventId((node?.data?.config as any)?.eventId || '');
    setGoogleContactName((node?.data?.config as any)?.googleContactName || '');
    setGoogleContactEmail((node?.data?.config as any)?.googleContactEmail || '');
    setGoogleContactPhone((node?.data?.config as any)?.googleContactPhone || '');
    setGoogleContactResourceName((node?.data?.config as any)?.googleContactResourceName || '');
    setOpenaiPrompt((node?.data?.config as any)?.prompt || '');
    setOpenaiModel((node?.data?.config as any)?.model || 'gpt-4o');
    setGeminiPrompt((node?.data?.config as any)?.prompt || '');
    setGeminiModel((node?.data?.config as any)?.model || 'gemini-1.5-flash');
    const delayCfg = (node?.data?.config || {}) as Record<string, unknown>;
    const isDelayNode =
      node?.type === 'action' &&
      (!!DELAY_ACTIONS.find((a) => a.id === node?.data?.selectedActionId) ||
        String(node?.data?.selectedAction || '').toLowerCase().trim() === 'delay');
    if (isDelayNode) {
      const inferred = inferDelayForFromConfig(delayCfg);
      setDelayForUnit(inferred.unit);
      setDelayForValue(String(inferred.value));
      setDelayUntilIso(typeof delayCfg.delayUntil === 'string' ? delayCfg.delayUntil : '');
    }
  }, [node?.id, node?.data?.config?.connectionId, node?.data?.config?.phoneNumberId, node?.data?.config?.templateId, node?.data?.config, node?.data?.selectedActionId, node?.data?.selectedAction, node?.type]);

  // Auto-load dynamic fields when template is selected (for Send Template)
  useEffect(() => {
    if (node.data?.selectedActionId !== 'send-template' || !selectedTemplate || templates.length === 0) return;
    const tpl = templates.find(t => t.name === selectedTemplate || (t as { templateId?: string }).templateId === selectedTemplate || t.id === selectedTemplate);
    const components = (tpl as any)?.components || [];
    const headerComp = components.find((c: any) => c.type === 'HEADER');
    const headerFormat = String(headerComp?.format || '').toUpperCase();
    setTemplateHeaderFormat(headerFormat);
    const bodyComp = components.find((c: any) => c.type === 'BODY');
    const matches = bodyComp?.text?.match(/\{\{(\d+)\}\}/g);
    const varNums = matches
      ? Array.from<number>(
          new Set<number>(matches.map((m: string) => parseInt(m.replace(/[{}]/g, ''), 10)))
        ).sort((a, b) => a - b)
      : [];
    const existingParams = (node?.data?.config as any)?.templateParams;
    const values = Array.isArray(existingParams) ? existingParams : [];
    const fields = varNums.map((i, idx) => ({ index: i, value: values[idx] ?? '' }));
    setTemplateDynamicFields(fields);
  }, [selectedTemplate, templates, node?.data?.selectedActionId]);

  // Fetch data when connection is selected
  useEffect(() => {
    if (!selectedConnection) {
      setDrives([]);
      setSpreadsheets([]);
      setWorksheets([]);
      setCalendars([]);
      setScopes([]);
      setTemplates([]);
      return;
    }

    // For WhatsApp, selectedConnection is sessionId; for others, it's integration id
    const connection = isWhatsApp
      ? whatsappSessions.find(s => s.sessionId === selectedConnection)
      : appConnections.find(c => c.id === selectedConnection);
    if (!connection && !isWhatsApp) return;

    const fetchConnectionData = async () => {
      try {
        // Fetch drives for Google Sheets (triggers and actions)
        const needsSheetsDrive = (node.data?.selectedTrigger === 'new-spreadsheets' || node.data?.selectedTrigger === 'new-worksheets' || node.data?.selectedTrigger === 'new-spreadsheet-rows') || GOOGLE_SHEETS_ACTIONS.some(a => a.id === node.data?.selectedActionId);
        if (selectedAppName === 'google-sheets' && needsSheetsDrive) {
          try {
            const res = await apiRequest('GET', `/api/integrations/google-sheets/drives?connectionId=${selectedConnection}`);
            const data = await res.json();
            setDrives(data.drives || []);
          } catch (error) {
            console.error('Failed to fetch drives:', error);
          }
        }

        // Fetch calendars for Google Calendar (trigger new-event or action create-event/update-event)
        const needsCalendars = selectedAppName === 'google-calendar' && (
          node.data?.selectedTrigger === 'new-event' ||
          ['create-event', 'update-event'].includes(node.data?.selectedActionId || '')
        );
        if (needsCalendars) {
          try {
            const res = await apiRequest('GET', `/api/integrations/google-calendar/calendars?connectionId=${selectedConnection}`);
            const data = await res.json();
            setCalendars(data.calendars || []);
          } catch (error) {
            console.error('Failed to fetch calendars:', error);
          }
        }

        // Fetch spreadsheets for Google Sheets (triggers and actions)
        const needsSheetsSpreadsheet =
          node.data?.selectedTrigger === 'new-worksheets' ||
          node.data?.selectedTrigger === 'new-spreadsheet-rows' ||
          GOOGLE_SHEETS_TARGET_SPREADSHEET_ACTIONS.has(node.data?.selectedActionId || '');
        if (selectedAppName === 'google-sheets' && selectedDrive && needsSheetsSpreadsheet) {
          try {
            const res = await apiRequest('GET', `/api/integrations/google-sheets/spreadsheets?connectionId=${selectedConnection}&driveId=${selectedDrive}`);
            const data = await res.json();
            setSpreadsheets(data.spreadsheets || []);
          } catch (error) {
            console.error('Failed to fetch spreadsheets:', error);
          }
        }

        // Fetch worksheets for Google Sheets (triggers and actions)
        const needsSheetsWorksheet = node.data?.selectedTrigger === 'new-spreadsheet-rows' || ['create-spreadsheet-row', 'find-row', 'update-row'].includes(node.data?.selectedActionId || '');
        if (selectedAppName === 'google-sheets' && selectedSpreadsheet && needsSheetsWorksheet) {
          try {
            const res = await apiRequest('GET', `/api/integrations/google-sheets/worksheets?connectionId=${selectedConnection}&spreadsheetId=${selectedSpreadsheet}`);
            const data = await res.json();
            setWorksheets(data.worksheets || []);
          } catch (error) {
            console.error('Failed to fetch worksheets:', error);
          }
        }

        // Fetch scopes for Calendly (User and Organization)
        if (selectedAppName === 'calendly' && (node.data?.selectedTrigger === 'event-canceled' || node.data?.selectedTrigger === 'event-schedule')) {
          const CALENDLY_SCOPE_FALLBACK = [
            { id: 'user', name: 'User' },
            { id: 'organization', name: 'Organization' },
          ];
          try {
            const res = await apiRequest('GET', `/api/integrations/calendly/scopes?connectionId=${selectedConnection}`);
            const data = await res.json();
            const apiScopes = data.scopes || [];
            setScopes(apiScopes.length > 0 ? apiScopes : CALENDLY_SCOPE_FALLBACK);
          } catch (error) {
            console.error('Failed to fetch scopes:', error);
            setScopes(CALENDLY_SCOPE_FALLBACK);
          }
        }

        // Fetch templates for WhatsApp - use phoneNumberId (like /templates page) when available
        if ((selectedAppName === 'whatsapp-business' || selectedAppName === 'whatsapp') && (WHATSAPP_TRIGGERS.find(t => t.id === node.data?.selectedTrigger) || node.data?.selectedActionId === 'send-template')) {
          try {
            const phoneId = selectedPhoneNumberId || (isWhatsApp && connection ? (connection as WhatsAppSession).phoneNumberId : undefined);
            if (phoneId) {
              const params = new URLSearchParams({ phoneNumberId: phoneId });
              if (currentOrganizationId) params.set('organizationId', currentOrganizationId);
              const res = await apiRequest('GET', `/api/templates?${params.toString()}`);
              const data = await res.json();
              setTemplates(Array.isArray(data) ? data : (data.templates || []));
            } else {
              const res = await apiRequest('GET', `/api/integrations/whatsapp-business/templates?connectionId=${selectedConnection}`);
              const data = await res.json();
              setTemplates(data.templates || []);
            }
          } catch (error) {
            console.error('Failed to fetch templates:', error);
          }
        }
      } catch (error) {
        console.error('Failed to fetch connection data:', error);
      }
    };

    fetchConnectionData();
  }, [selectedConnection, selectedPhoneNumberId, selectedDrive, selectedSpreadsheet, selectedAppName, node.data?.selectedTrigger, node.data?.selectedActionId, isWhatsApp, whatsappSessions]);

  // Fetch spreadsheets when drive changes
  useEffect(() => {
    if (!selectedConnection || !selectedDrive || selectedAppName !== 'google-sheets') {
      setSpreadsheets([]);
      setWorksheets([]);
      return;
    }

    const fetchSpreadsheets = async () => {
      try {
        const res = await apiRequest('GET', `/api/integrations/google-sheets/spreadsheets?connectionId=${selectedConnection}&driveId=${selectedDrive}`);
        const data = await res.json();
        setSpreadsheets(data.spreadsheets || []);
      } catch (error) {
        console.error('Failed to fetch spreadsheets:', error);
      }
    };

    fetchSpreadsheets();
  }, [selectedDrive, selectedConnection, selectedAppName]);

  // Fetch worksheets when spreadsheet changes
  useEffect(() => {
    if (!selectedConnection || !selectedSpreadsheet || selectedAppName !== 'google-sheets') {
      setWorksheets([]);
      return;
    }

    const fetchWorksheets = async () => {
      try {
        const res = await apiRequest('GET', `/api/integrations/google-sheets/worksheets?connectionId=${selectedConnection}&spreadsheetId=${selectedSpreadsheet}`);
        const data = await res.json();
        setWorksheets(data.worksheets || []);
      } catch (error) {
        console.error('Failed to fetch worksheets:', error);
      }
    };

    fetchWorksheets();
  }, [selectedSpreadsheet, selectedConnection, selectedAppName]);

  const isRawWebhookTrigger =
    node.type === "trigger" &&
    (node.data?.selectedTrigger === "catch-raw-webhook" ||
      node.data?.selectedTrigger === "zoom-webhook" ||
      selectedAppName === "webhook");
  const isExternalWebhookTrigger = showExternalWebhookUrl && !!node.data?.selectedTrigger;

  const loadWebhookTestPayload = async () => {
    const res = await apiRequest(
      "GET",
      `/api/flows/${flowId}/webhook-test-payload?nodeId=${encodeURIComponent(node.id)}&trigger=${encodeURIComponent(String(node.data?.selectedTrigger || ""))}`
    );
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || "Failed to load test payload");
    }
    return data as {
      url: string;
      headers: Record<string, string>;
      body: Record<string, unknown>;
      curl: string;
      postman: Record<string, unknown>;
      notes: string[];
      templateHints: string[];
      webhookCapable: boolean;
      label: string;
      triggerId: string;
      flowStatus?: string;
    };
  };

  const handleCopyWebhookTestPayload = async (kind: "body" | "curl" | "postman" | "headers") => {
    try {
      setIsWebhookTestBusy(true);
      const data = await loadWebhookTestPayload();
      let text = "";
      if (kind === "body") text = JSON.stringify(data.body, null, 2);
      else if (kind === "curl") text = data.curl;
      else if (kind === "headers") text = JSON.stringify(data.headers, null, 2);
      else text = JSON.stringify(data.postman, null, 2);
      await navigator.clipboard.writeText(text);
      setTestInput(
        JSON.stringify(
          {
            method: "POST",
            url: data.url,
            headers: data.headers,
            body: data.body,
            notes: data.notes,
            templateHints: data.templateHints,
          },
          null,
          2
        )
      );
      setIsTestResultsOpen(true);
      setTestResultsTab("input");
      toast({
        title: "Copied",
        description:
          kind === "curl"
            ? "cURL command copied — paste in terminal."
            : kind === "postman"
              ? "Postman collection JSON copied — Import → Raw text."
              : kind === "headers"
                ? "Headers JSON copied."
                : "Request body JSON copied for Postman.",
      });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Copy failed",
        description: e?.message || "Could not build test payload",
      });
    } finally {
      setIsWebhookTestBusy(false);
    }
  };

  const handleSendTestWebhook = async () => {
    try {
      setIsWebhookTestBusy(true);
      setTestError("");
      const res = await apiRequest("POST", `/api/flows/${flowId}/send-test-webhook`, {
        nodeId: node.id,
        triggerId: node.data?.selectedTrigger,
      });
      const data = await res.json();
      setTestInput(JSON.stringify(data.used || data, null, 2));
      setTestOutput(JSON.stringify(data, null, 2));
      setIsTestResultsOpen(true);
      if (!res.ok || !data.success) {
        setTestError(data.message || data.tip || "Test webhook did not run");
        setTestResultsTab("errors");
        toast({
          variant: "destructive",
          title: "Test did not run",
          description: data.message || data.tip || "Publish the flow and try again.",
        });
        return;
      }
      setTestResultsTab("output");
      toast({
        title: data.ran ? "Flow triggered" : "Webhook accepted",
        description:
          data.tip ||
          (data.ran
            ? "Check Runs / Inbox. Delay nodes still wait their configured time."
            : data.message),
      });
    } catch (e: any) {
      setTestError(e?.message || "Send failed");
      setTestResultsTab("errors");
      setIsTestResultsOpen(true);
      toast({
        variant: "destructive",
        title: "Send failed",
        description: e?.message || "Could not send test webhook",
      });
    } finally {
      setIsWebhookTestBusy(false);
    }
  };

  const handleRunTest = async () => {
    if (!isRawWebhookTrigger && !isExternalWebhookTrigger && !selectedConnection) {
      setTestError("Connection not found");
      setTestResultsTab('errors');
      setIsTestResultsOpen(true);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a connection first.",
      });
      return;
    }

    setIsTestRunning(true);
    setTestError("");
    setTestOutput("");
    setTestInput("");

    try {
      if (isRawWebhookTrigger || isExternalWebhookTrigger) {
        const testPayload = {
          triggerId: node.data?.selectedTrigger || "catch-raw-webhook",
        };
        const res = await apiRequest("POST", `/api/flows/${flowId}/nodes/${node.id}/test`, testPayload);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || data.message || "Test failed");
        }
        setTestInput(JSON.stringify(data.input || testPayload, null, 2));
        setTestOutput(JSON.stringify(data.output || data, null, 2));
        setTestResultsTab("output");
        setIsTestResultsOpen(true);
        return;
      }

      const connection = isWhatsApp
        ? whatsappSessions.find(s => s.sessionId === selectedConnection)
        : appConnections.find(c => c.id === selectedConnection);
      if (!connection) {
        throw new Error("Connection not found");
      }

      // Build test payload based on selected trigger and options
      const testPayload: Record<string, any> = {
        connectionId: selectedConnection,
        triggerId: node.data?.selectedTrigger || node.data?.selectedApp,
      };

      // Add trigger-specific options
      if (node.data?.selectedTrigger === 'new-event' && selectedCalendar) {
        testPayload.calendarId = selectedCalendar;
      }
      if ((node.data?.selectedTrigger === 'new-worksheets' || node.data?.selectedTrigger === 'new-spreadsheet-rows') && selectedSpreadsheet) {
        testPayload.spreadsheetId = selectedSpreadsheet;
      }
      if (node.data?.selectedTrigger === 'new-spreadsheet-rows' && selectedWorksheet) {
        testPayload.worksheetId = selectedWorksheet;
      }
      if ((node.data?.selectedTrigger === 'event-canceled' || node.data?.selectedTrigger === 'event-schedule') && selectedScope) {
        testPayload.scopeId = selectedScope;
      }

      const res = await apiRequest('POST', `/api/flows/${flowId}/nodes/${node.id}/test`, testPayload);
      const data = await res.json();

      setTestInput(JSON.stringify(testPayload, null, 2));
      setTestOutput(JSON.stringify(data.output || data, null, 2));
      setTestError(data.error || "");
      setTestResultsTab(data.error ? 'errors' : 'output');
      setIsTestResultsOpen(true);
    } catch (error: any) {
      setTestError(error.message || "Connection not found");
      setTestResultsTab('errors');
      setIsTestResultsOpen(true);
      toast({
        variant: "destructive",
        title: "Test Failed",
        description: error.message || "Failed to run test. Please check your connection.",
      });
    } finally {
      setIsTestRunning(false);
    }
  };

  const handleOpenConnectModal = async () => {
    if (!selectedAppName) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select an app first.",
      });
      return;
    }
    // For WhatsApp, + New navigates to Connect page to add phone numbers (sessions)
    if (isWhatsApp) {
      setLocation('/connect');
      return;
    }
    setConnectionName(selectedAppName);
    setPersonalToken("");
    setClientId("");
    setClientSecret("");
    setRedirectUri("");
    setApiKey("");
    setPhoneNumberId("");
    setBusinessAccountId("");
    
    // Fetch redirect URI for Google integrations
    if (selectedAppName.includes('google')) {
      try {
        const integrationName = selectedAppName.includes('calendar') ? 'google-calendar' : 
                               selectedAppName.includes('sheet') ? 'google-sheets' : 
                               selectedAppName.includes('contact') ? 'google-contacts' : selectedAppName;
        const res = await apiRequest("GET", `/api/integrations/google/${integrationName}/oauth/redirect-uri`);
        const data = await res.json();
        setRedirectUri(data.redirectUri || `${window.location.origin}/api/integrations/google/${integrationName}/oauth/callback`);
      } catch {
        const integrationName = selectedAppName.includes('calendar') ? 'google-calendar' : 
                               selectedAppName.includes('sheet') ? 'google-sheets' : 
                               selectedAppName.includes('contact') ? 'google-contacts' : selectedAppName;
        setRedirectUri(`${window.location.origin}/api/integrations/google/${integrationName}/oauth/callback`);
      }
    }

    // For IndiaMart: if already connected, open Configure modal (webhook URL, token, steps) instead of Connect form
    if (selectedAppName === 'indiamart') {
      try {
        const [configRes, webhookRes] = await Promise.all([
          apiRequest("GET", "/api/integrations/indiamart/config"),
          apiRequest("GET", "/api/integrations/indiamart/webhook-url"),
        ]);
        if (configRes.ok) {
          const configData = await configRes.json();
          setIndiaMartToken(configData.accessToken || "");
          let webhookUrl = "";
          if (webhookRes.ok) {
            const webhookData = await webhookRes.json();
            webhookUrl = webhookData.webhookUrl || "";
          }
          setIndiaMartWebhookUrl(webhookUrl);
          setIsIndiaMartConfigureOpen(true);
          return;
        }
      } catch {
        // Fall through to Connect modal if fetch fails
      }
    }
    
    setIsConnectModalOpen(true);
  };

  const handleCalendlyConnect = async () => {
    const token = personalToken.trim();
    if (!token) return;
    setConnectPending(true);
    try {
      const verifyRes = await apiRequest("POST", "/api/integrations/calendly/verify-token", {
        personalToken: token,
      });
      const verifyData = await verifyRes.json();

      if (!verifyData.valid) {
        throw new Error(verifyData.message || "Invalid personal token");
      }

      const credentials: Record<string, any> = {
        access_token: token,
      };
      const config: Record<string, any> = {
        connectionName: connectionName.trim() || "calendly",
      };
      
      await apiRequest("POST", "/api/integrations/connect", {
        integration: { name: "calendly", authType: "api_key" },
        credentials,
        config,
      });
      
      setIsConnectModalOpen(false);
      setPersonalToken("");
      setConnectionName(selectedAppName);
      setConnectPending(false);
      toast({
        title: "Connected",
        description: "Calendly connection has been added successfully.",
      });
      // Refresh connections
      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to connect Calendly. Please verify your personal token is correct.",
      });
      setConnectPending(false);
    }
  };

  const handleGoogleConnect = async () => {
    const trimmedClientId = clientId.trim();
    const trimmedClientSecret = clientSecret.trim();
    if (!trimmedClientId || !trimmedClientSecret) return;
    setConnectPending(true);
    try {
      const integrationName = selectedAppName.includes('calendar') ? 'google-calendar' : 
                             selectedAppName.includes('sheet') ? 'google-sheets' : 
                             selectedAppName.includes('contact') ? 'google-contacts' : selectedAppName;
      
      const res = await apiRequest("POST", `/api/integrations/google/${integrationName}/oauth/authorize`, {
        clientId: trimmedClientId,
        clientSecret: trimmedClientSecret,
        connectionName: connectionName.trim() || integrationName,
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
        description: error.message || "Failed to initiate OAuth flow",
      });
      setConnectPending(false);
    }
  };

  const handleIndiamartConnect = async () => {
    setConnectPending(true);
    try {
      const credentials: Record<string, any> = {};
      if (apiKey.trim()) {
        credentials.apiKey = apiKey.trim();
        credentials.accessToken = apiKey.trim();
      }
      const config: Record<string, any> = {
        connectionName: connectionName.trim() || "indiamart",
      };

      await apiRequest("POST", "/api/integrations", {
        name: "indiamart",
        credentials: Object.keys(credentials).length > 0 ? credentials : undefined,
        config,
      });

      setIsConnectModalOpen(false);
      setApiKey("");
      setConnectionName("");
      setConnectPending(false);
      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
      toast({
        title: "Connected",
        description: "IndiaMart connection has been added successfully.",
      });

      // Open Configure IndiaMart modal (same as integrations/indiamart page: webhook URL, token, setup steps)
      const [configRes, webhookRes] = await Promise.all([
        apiRequest("GET", "/api/integrations/indiamart/config"),
        apiRequest("GET", "/api/integrations/indiamart/webhook-url"),
      ]);
      if (configRes.ok) {
        const configData = await configRes.json();
        setIndiaMartToken(configData.accessToken || "");
        if (webhookRes.ok) {
          const webhookData = await webhookRes.json();
          setIndiaMartWebhookUrl(webhookData.webhookUrl || "");
        } else {
          setIndiaMartWebhookUrl("");
        }
        setIsIndiaMartConfigureOpen(true);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to connect IndiaMart.",
      });
      setConnectPending(false);
    }
  };

  const copyIndiaMartToken = () => {
    if (indiaMartToken) {
      navigator.clipboard.writeText(indiaMartToken);
      toast({ title: "Copied", description: "Access token copied to clipboard." });
    }
  };

  const copyIndiaMartWebhookUrl = () => {
    if (indiaMartWebhookUrl) {
      navigator.clipboard.writeText(indiaMartWebhookUrl);
      toast({ title: "Copied", description: "Webhook URL copied to clipboard." });
    }
  };

  const handleIndiaMartRegenerateToken = async () => {
    setIndiaMartRegeneratePending(true);
    try {
      const res = await apiRequest("POST", "/api/integrations/indiamart/regenerate-token");
      if (!res.ok) throw new Error("Failed to regenerate token");
      const data = await res.json();
      setIndiaMartToken(data.accessToken || "");
      if (data.webhookUrl) setIndiaMartWebhookUrl(data.webhookUrl);
      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
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

  const handleZoomWebhookConnect = async () => {
    const trimmedSecretToken = apiKey.trim();
    if (!trimmedSecretToken) return;
    setConnectPending(true);
    try {
      await apiRequest("POST", "/api/integrations", {
        name: "zoom-webhook",
        config: { connectionName: connectionName.trim() || "zoom-webhook" },
        credentials: { secretToken: trimmedSecretToken, secret_token: trimmedSecretToken },
      });
      setIsConnectModalOpen(false);
      setApiKey("");
      setConnectionName("");
      setConnectPending(false);
      toast({
        title: "Connected",
        description: "Zoom webhook connection has been added successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to connect Zoom webhook.",
      });
      setConnectPending(false);
    }
  };

  const handleWhatsAppConnect = async () => {
    const trimmedApiKey = apiKey.trim();
    const trimmedPhoneNumberId = phoneNumberId.trim();
    const trimmedBusinessAccountId = businessAccountId.trim();
    if (!trimmedApiKey || !trimmedPhoneNumberId || !trimmedBusinessAccountId) return;
    setConnectPending(true);
    try {
      const credentials: Record<string, any> = {
        apiKey: trimmedApiKey,
        phoneNumberId: trimmedPhoneNumberId,
        businessAccountId: trimmedBusinessAccountId,
      };
      const config: Record<string, any> = {
        connectionName: connectionName.trim() || "whatsapp-business",
      };
      
      await apiRequest("POST", "/api/integrations/connect", {
        integration: { name: "whatsapp-business", authType: "api_key" },
        credentials,
        config,
      });
      
      setIsConnectModalOpen(false);
      setApiKey("");
      setPhoneNumberId("");
      setBusinessAccountId("");
      setConnectionName(selectedAppName);
      setConnectPending(false);
      toast({
        title: "Connected",
        description: "WhatsApp Business connection has been added successfully. Go to Connect page to add phone numbers.",
      });
      // Refresh connections and WhatsApp sessions
      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/whatsapp-business/added-phones'] });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to connect WhatsApp Business. Please verify your credentials are correct.",
      });
      setConnectPending(false);
    }
  };

  return (
    <div className="space-y-4">
      {node.type === "router" ? (
        <FlowRouterConfigPanel
          nodeId={node.id}
          nodes={nodes}
          edges={edges}
          config={node.data?.config}
          onUpdateConfig={(nodeId, config) => {
            onUpdateNodeData?.(nodeId, { config });
          }}
          onAddBranch={(routerNodeId, branchId, branchName) => {
            onRouterAddBranch?.(routerNodeId, branchId, branchName);
          }}
          onRemoveBranch={(routerNodeId, branchId) => {
            onRouterRemoveBranch?.(routerNodeId, branchId);
          }}
        />
      ) : (
        <>
      <div className="mb-4">
        <h2 className="text-lg font-semibold">{nodeTitle}</h2>
      </div>

      {/* Delay — canvas action config (Delay for / Delay until); legacy nodes with only "Delay" use Delay for UI */}
      {isDelayAction && node.data?.selectedActionId === 'delay-until' && (
        <div className="border border-gray-200 rounded-lg bg-white">
          <div className="p-3 border-b border-gray-200 flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">Delay until</span>
          </div>
          <div className="p-3 pt-4 space-y-3">
            <div>
              <Label className="text-xs text-gray-600">Delay until (DateTime) *</Label>
              <Input
                placeholder="e.g. 2021-12-15T16:25:30Z"
                value={delayUntilIso}
                onChange={(e) => {
                  const v = e.target.value;
                  setDelayUntilIso(v);
                  onUpdateNodeData?.(node.id, {
                    config: { ...node.data?.config, delayUntil: v },
                  });
                }}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Delay until the specified date and time. Supports ISO 8601 with UTC conversion (e.g. 2021-12-15T16:25:30Z,
                2021-12-15T16:25:30+05:30).
              </p>
            </div>
          </div>
        </div>
      )}

      {isDelayAction && node.data?.selectedActionId !== 'delay-until' && (
        <div className="border border-gray-200 rounded-lg bg-white">
          <div className="p-3 border-b border-gray-200 flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">Delay for</span>
          </div>
          <div className="p-3 pt-4 space-y-3">
            <div>
              <Label className="text-xs text-gray-600">Delay for unit *</Label>
              <Popover open={isDelayUnitDropdownOpen} onOpenChange={setIsDelayUnitDropdownOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-left font-normal shadow-sm hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <span className={delayForUnit ? 'text-foreground' : 'text-muted-foreground'}>
                      {delayForUnit
                        ? delayForUnit.charAt(0).toUpperCase() + delayForUnit.slice(1)
                        : 'Select delay for unit'}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <div className="p-2">
                    {(['minutes', 'hours', 'days', 'weeks'] as const).map((unit) => (
                      <button
                        key={unit}
                        type="button"
                        onClick={() => {
                          setDelayForUnit(unit);
                          setIsDelayUnitDropdownOpen(false);
                          const n = Math.max(0, Math.floor(parseInt(delayForValue, 10) || 0)) || 1;
                          const parts = delayForParts(unit, n);
                          onUpdateNodeData?.(node.id, {
                            config: {
                              ...node.data?.config,
                              ...parts,
                              delayForUnit: unit,
                              delayForValue: n,
                            },
                          });
                        }}
                        className={`w-full rounded-md px-3 py-2 text-left text-sm hover:bg-gray-50 ${delayForUnit === unit ? 'bg-gray-100' : ''}`}
                      >
                        {unit.charAt(0).toUpperCase() + unit.slice(1)}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-gray-500 mt-1">Delay for unit, e.g. minutes, hours, days, weeks.</p>
            </div>
            <div>
              <Label className="text-xs text-gray-600">Delay for value *</Label>
              <Input
                type="number"
                min={0}
                placeholder="e.g. 1, 2, 3"
                value={delayForValue}
                onChange={(e) => {
                  const raw = e.target.value;
                  setDelayForValue(raw);
                  const n = Math.max(0, Math.floor(parseInt(raw, 10) || 0));
                  const parts = delayForParts(delayForUnit, n);
                  onUpdateNodeData?.(node.id, {
                    config: {
                      ...node.data?.config,
                      ...parts,
                      delayForUnit,
                      delayForValue: n,
                    },
                  });
                }}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">Delay for value, use a number, e.g. 1, 2, 3.</p>
            </div>
          </div>
        </div>
      )}

      {/* Connection Section - hide when trigger not configured, or for webhook/contacts/Contact (internal)/Router/Delay (no external connection) */}
      {node.type !== 'router' && selectedAppName !== 'delay' && (node.type !== 'trigger' || ((node.data?.selectedTrigger || node.data?.selectedApp) && selectedAppName !== 'webhook' && selectedAppName !== 'contacts')) && selectedAppName !== 'contact-helicopticsolutions' ? (
      <div className="border border-gray-200 rounded-lg bg-white">
        <button
          onClick={() => setIsConnectionOpen(!isConnectionOpen)}
          className="w-full flex items-center justify-between p-3 hover:bg-gray-50"
        >
          <span className="font-medium text-sm">Connection</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${isConnectionOpen ? '' : '-rotate-90'}`} />
        </button>
        {isConnectionOpen && (
          <div className="p-3 pt-4 space-y-3 border-t border-gray-200">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">
                {selectedAppName === 'google-calendar' ? 'Select a Google Calendar connection' : 
                 selectedAppName === 'google-sheets' ? 'Select a Google Sheets connection' : 
                 selectedAppName === 'google-contacts' ? 'Select a Google Contacts connection' :
                 selectedAppName === 'openai' ? 'Select an OpenAI connection' :
                 selectedAppName === 'google-gemini' ? 'Select a Google Gemini connection' :
                 selectedAppName === 'calendly' ? 'Select a Calendly connection' :
                 selectedAppName === 'contact-helicopticsolutions' ? 'Select a Contact connection' :
                 isWhatsApp ? 'Select a WhatsApp session' :
                 'Select a connection'}
              </label>
              <div className="flex gap-2">
                <Popover 
                  open={isConnectionDropdownOpen} 
                  onOpenChange={(open) => {
                    setIsConnectionDropdownOpen(open);
                    if (!open) {
                      setConnectionSearchQuery("");
                    }
                  }}
                >
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex-1 h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-left font-normal shadow-sm hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className={selectedConnection ? "text-foreground" : "text-muted-foreground"}>
                        {selectedConnection 
                          ? (() => {
                              const conn = connectionOptions.find(c => c.id === selectedConnection);
                              if (conn) {
                                return getConnectionLabel(
                                  conn as {
                                    id: string;
                                    connectionName?: string;
                                    config?: { connectionName?: string; name?: string };
                                    displayName?: string;
                                    name?: string;
                                    displayPhoneNumber?: string;
                                    verifiedName?: string;
                                    _isSession?: boolean;
                                  },
                                  (connectionOptions as Array<{ id: string }>).findIndex(
                                    (c) => c.id === conn.id
                                  )
                                );
                              }
                              const short = selectedConnection.length > 10 ? `…${selectedConnection.slice(-8)}` : selectedConnection;
                              return `Saved connection (${short})`;
                            })()
                          : selectedAppName === 'google-calendar' ? 'Select Google Calendar connection' : 
                            selectedAppName === 'google-sheets' ? 'Select Google Sheets connection' : 
                            selectedAppName === 'google-contacts' ? 'Select Google Contacts connection' :
                            selectedAppName === 'openai' ? 'Select OpenAI connection' :
                            selectedAppName === 'google-gemini' ? 'Select Google Gemini connection' :
                            selectedAppName === 'calendly' ? 'Select Calendly connection' :
                            selectedAppName === 'contact-helicopticsolutions' ? 'Select Contact connection' :
                            isWhatsApp ? 'Select WhatsApp session' :
                            'Select connection'}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <div className="p-2">
                      <div className="relative mb-2">
                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Search connections..."
                          value={connectionSearchQuery}
                          onChange={(e) => setConnectionSearchQuery(e.target.value)}
                          className="pl-8 h-8"
                          autoFocus
                        />
                      </div>
                      <ScrollArea className="h-[200px]">
                        {filteredConnections.length === 0 ? (
                          <div className="text-center py-8 text-sm text-gray-500">
                            {selectedAppName === 'google-calendar' 
                              ? 'No Google Calendar connections found. Click + New to add one.'
                              : selectedAppName === 'google-sheets'
                              ? 'No Google Sheets connections found. Click + New to add one.'
                              : selectedAppName === 'calendly'
                              ? 'No Calendly connections found. Click + New to add one.'
                              : selectedAppName === 'contact-helicopticsolutions'
                              ? 'No Contact connections found. Click + New to add one.'
                              : isWhatsApp
                              ? 'No WhatsApp sessions found. Go to Connect page to add phone numbers.'
                              : 'No connections found. Click + New to add one.'}
                          </div>
                        ) : (
                          <div className="space-y-0">
                            {filteredConnections.map((conn, index) => (
                              <button
                                key={conn.id}
                                onClick={() => {
                                  setSelectedConnection(conn.id);
                                  setConnectionSearchQuery("");
                                  setIsConnectionDropdownOpen(false);
                                  const session = ("_isSession" in conn && conn._isSession)
                                    ? (conn as unknown as WhatsAppSession & { _isSession: true })
                                    : null;
                                  const updates: Record<string, unknown> = { connectionId: conn.id };
                                  if (session?.phoneNumberId) {
                                    setSelectedPhoneNumberId(session.phoneNumberId);
                                    updates.phoneNumberId = session.phoneNumberId;
                                  }
                                  onUpdateNodeData?.(node.id, {
                                    config: { ...node.data?.config, ...updates },
                                  });
                                }}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-md ${
                                  selectedConnection === conn.id ? 'bg-gray-100' : ''
                                }`}
                              >
                                {getConnectionLabel(conn, index)}
                              </button>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </div>
                  </PopoverContent>
                </Popover>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={handleOpenConnectModal}
                  title={isWhatsApp ? "Go to Connect page to add phone numbers" : "Add new connection"}
                >
                  + New
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {selectedAppName === 'google-calendar' ? 'Choose the Google Calendar connection to use for this step.' : 
                 selectedAppName === 'google-sheets' ? 'Choose the Google Sheets connection to use for this step.' : 
                 selectedAppName === 'google-contacts' ? 'Choose the Google Contacts connection to use for this step.' :
                 selectedAppName === 'openai' ? 'Choose the OpenAI connection to use for this step.' :
                 selectedAppName === 'google-gemini' ? 'Choose the Google Gemini connection to use for this step.' :
                 selectedAppName === 'calendly' ? 'Choose the Calendly connection to use for this step.' :
                 selectedAppName === 'contact-helicopticsolutions' ? 'Choose the Contact connection to use for this step.' :
                 isWhatsApp ? 'Choose the WhatsApp phone number (session) to use for this step.' :
                 'Choose the connection to use for this step'}
              </p>
            </div>
          </div>
        )}
      </div>
      ) : null}

      {/* Cancel Event - for Calendly action */}
      {node.data?.selectedActionId === 'cancel-event' && isCalendlyAction && (
      <div className="border border-gray-200 rounded-lg bg-white mt-3">
        <div className="p-3 border-b border-gray-200">
          <span className="font-medium text-sm">Cancel Event</span>
        </div>
        <div className="p-3 pt-4 space-y-3">
          <div>
            <Label htmlFor="calendly-event-uuid" className="text-xs text-gray-600">Event UUID *</Label>
            <Input
              id="calendly-event-uuid"
              placeholder="The UUID of the event to cancel"
              value={calendlyEventUuid}
              onChange={(e) => {
                setCalendlyEventUuid(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, eventUuid: e.target.value } });
              }}
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">The UUID of the event to cancel</p>
          </div>
          <div>
            <Label htmlFor="calendly-reason" className="text-xs text-gray-600">Reason</Label>
            <Input
              id="calendly-reason"
              placeholder="Reason for cancellation"
              value={calendlyReason}
              onChange={(e) => {
                setCalendlyReason(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, reason: e.target.value } });
              }}
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">Reason for cancellation</p>
          </div>
        </div>
      </div>
      )}

      {/* Custom request - for Calendly action */}
      {node.data?.selectedActionId === 'custom-request' && isCalendlyAction && (
      <div className="border border-gray-200 rounded-lg bg-white mt-3">
        <div className="p-3 border-b border-gray-200">
          <span className="font-medium text-sm">Custom request</span>
        </div>
        <div className="p-3 pt-4 space-y-3">
          <div>
            <Label htmlFor="custom-request-method" className="text-xs text-gray-600">Method *</Label>
            <select
              id="custom-request-method"
              value={customRequestMethod}
              onChange={(e) => {
                setCustomRequestMethod(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, method: e.target.value } });
              }}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select method</option>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">The HTTP method we&apos;ll use to perform the request.</p>
          </div>
          <div>
            <Label htmlFor="custom-request-url" className="text-xs text-gray-600">URL *</Label>
            <Input
              id="custom-request-url"
              placeholder="https://api.example.com/endpoint"
              value={customRequestUrl}
              onChange={(e) => {
                setCustomRequestUrl(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, url: e.target.value } });
              }}
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">Any URL with a querystring will be re-encoded properly.</p>
          </div>
          <FlowJsonDataField
            id="custom-request-data"
            value={customRequestData}
            nodes={nodes}
            edges={edges}
            currentNodeId={node.id}
            helpText='Place raw JSON here. Strings can include variables, e.g. {"email": "{{contact.email}}", "name": "{{contact.name}}"} — expanded when the flow runs. Calendly URLs must start with https://api.calendly.com'
            onChange={(next) => {
              setCustomRequestData(next);
              onUpdateNodeData?.(node.id, { config: { ...node.data?.config, data: next } });
            }}
          />
        </div>
      </div>
      )}

      {/* Update Contact - for Contact action */}
      {node.data?.selectedActionId === 'update-contact' && isContactAction && (
      <div className="border border-gray-200 rounded-lg bg-white mt-3">
        <div className="p-3 border-b border-gray-200">
          <span className="font-medium text-sm">Update Contact</span>
        </div>
        <div className="p-3 pt-4 space-y-3">
          <div>
            <Label className="text-xs text-gray-600">Search by ID or Phone *</Label>
            <select
              value={contactSearchBy}
              onChange={(e) => {
                setContactSearchBy(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, searchByIdOrPhone: e.target.value } });
              }}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select search by id or phone</option>
              <option value="id">ID</option>
              <option value="phone">Phone</option>
            </select>
          </div>
          <div>
            <Label className="text-xs text-gray-600">Phone Number or Contact ID *</Label>
            <Input
              placeholder="Contact ID or phone number"
              value={contactIdOrPhone}
              onChange={(e) => {
                setContactIdOrPhone(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, contactIdOrPhone: e.target.value } });
              }}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600">Name *</Label>
            <Input
              placeholder="Contact name"
              value={contactName}
              onChange={(e) => {
                setContactName(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, name: e.target.value } });
              }}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600">Assign To</Label>
            <select
              value={contactAssignTo}
              onChange={(e) => {
                setContactAssignTo(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, assignTo: e.target.value } });
              }}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select assign to...</option>
              {orgMembers.map((m: any) => (
                <option key={m.id} value={m.email || m.id}>
                  {m.name || m.email || m.id}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Email of the user to assign the contact to</p>
          </div>
          <div>
            <Label className="text-xs text-gray-600">Source</Label>
            <select
              value={contactSource}
              onChange={(e) => {
                setContactSource(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, source: e.target.value } });
              }}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select source</option>
              {CONTACT_SOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Source of the contact eg. website, facebook, indiamart, etc.</p>
          </div>
          <div>
            <Label className="text-xs text-gray-600">Email</Label>
            <Input
              type="email"
              placeholder="Contact email"
              value={contactEmail}
              onChange={(e) => {
                setContactEmail(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, email: e.target.value } });
              }}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600">Status</Label>
            <Input
              placeholder="Contact status"
              value={contactStatus}
              onChange={(e) => {
                setContactStatus(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, status: e.target.value } });
              }}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600">Tags</Label>
            <select
              value={contactTags}
              onChange={(e) => {
                setContactTags(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, tags: e.target.value } });
              }}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select tags...</option>
              {contactTagsList.map((t: any) => (
                <option key={t.id} value={t.name || t.id}>
                  {t.name || t.id}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Adds a tag when this step runs</p>
          </div>
        </div>
      </div>
      )}

      {/* Get Contact - for Contact action */}
      {node.data?.selectedActionId === 'get-contact' && isContactAction && (
      <div className="border border-gray-200 rounded-lg bg-white mt-3">
        <div className="p-3 border-b border-gray-200">
          <span className="font-medium text-sm">Get Contact</span>
        </div>
        <div className="p-3 pt-4 space-y-3">
          <div>
            <Label className="text-xs text-gray-600">Is ID or Phone *</Label>
            <select
              value={contactSearchBy}
              onChange={(e) => {
                setContactSearchBy(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, searchByIdOrPhone: e.target.value } });
              }}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select is id or phone</option>
              <option value="id">ID</option>
              <option value="phone">Phone</option>
            </select>
          </div>
          <div>
            <Label className="text-xs text-gray-600">Contact ID or Phone *</Label>
            <Input
              placeholder="Contact ID or phone number"
              value={contactIdOrPhone}
              onChange={(e) => {
                setContactIdOrPhone(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, contactIdOrPhone: e.target.value } });
              }}
              className="mt-1"
            />
          </div>
        </div>
      </div>
      )}

      {/* Create Contact - for Contact action */}
      {node.data?.selectedActionId === 'create-contact' && isContactAction && (
      <div className="border border-gray-200 rounded-lg bg-white mt-3">
        <div className="p-3 border-b border-gray-200">
          <span className="font-medium text-sm">Create Contact</span>
          <p className="text-xs text-gray-500 mt-1">Uses your workspace contacts — no external connection.</p>
        </div>
        <div className="p-3 pt-4 space-y-3">
          <div>
            <Label className="text-xs text-gray-600">First name</Label>
            <Input
              placeholder="{{contact.firstName}}"
              value={contactFirstName}
              onChange={(e) => {
                const v = e.target.value;
                setContactFirstName(v);
                const combined = `${v} ${contactLastName}`.trim();
                onUpdateNodeData?.(node.id, {
                  config: {
                    ...node.data?.config,
                    firstName: v,
                    ...(combined ? { name: combined } : {}),
                  },
                });
              }}
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">Contact first name</p>
          </div>
          <div>
            <Label className="text-xs text-gray-600">Last name</Label>
            <Input
              placeholder="{{contact.lastName}}"
              value={contactLastName}
              onChange={(e) => {
                const v = e.target.value;
                setContactLastName(v);
                const combined = `${contactFirstName} ${v}`.trim();
                onUpdateNodeData?.(node.id, {
                  config: {
                    ...node.data?.config,
                    lastName: v,
                    ...(combined ? { name: combined } : {}),
                  },
                });
              }}
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">Contact last name</p>
          </div>
          <div>
            <Label className="text-xs text-gray-600">Email</Label>
            <Input
              type="email"
              placeholder="{{contact.email}}"
              value={contactEmail}
              onChange={(e) => {
                setContactEmail(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, email: e.target.value } });
              }}
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">Contact email address</p>
          </div>
          <div>
            <Label className="text-xs text-gray-600">Phone *</Label>
            <Input
              placeholder="{{contact.phone}}"
              value={contactPhone}
              onChange={(e) => {
                setContactPhone(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, phone: e.target.value } });
              }}
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">Contact phone number</p>
          </div>
          <div>
            <Label className="text-xs text-gray-600">Notes</Label>
            <textarea
              placeholder="Additional notes about the contact"
              value={contactNotes}
              onChange={(e) => {
                setContactNotes(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, notes: e.target.value } });
              }}
              rows={3}
              className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Additional notes about the contact</p>
          </div>
          <div>
            <Label className="text-xs text-gray-600">Company</Label>
            <Input
              placeholder="Company name"
              value={contactCompany}
              onChange={(e) => {
                setContactCompany(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, company: e.target.value } });
              }}
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">Company name</p>
          </div>
          <div>
            <Label className="text-xs text-gray-600">Job title</Label>
            <Input
              placeholder="Job title"
              value={contactJobTitle}
              onChange={(e) => {
                setContactJobTitle(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, jobTitle: e.target.value } });
              }}
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">Job title</p>
          </div>
          <div>
            <Label className="text-xs text-gray-600">Assigned To</Label>
            <select
              value={contactAssignTo}
              onChange={(e) => {
                setContactAssignTo(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, assignTo: e.target.value } });
              }}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select assign to...</option>
              {orgMembers.map((m: any) => (
                <option key={m.id} value={m.email || m.id}>
                  {m.name || m.email || m.id}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">User to assign the contact to</p>
          </div>
          <div>
            <Label className="text-xs text-gray-600">Source</Label>
            <select
              value={contactSource}
              onChange={(e) => {
                setContactSource(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, source: e.target.value } });
              }}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select source</option>
              {CONTACT_SOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Where this lead came from</p>
          </div>
          <div>
            <Label className="text-xs text-gray-600">Status</Label>
            <Input
              placeholder="Contact status"
              value={contactStatus}
              onChange={(e) => {
                setContactStatus(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, status: e.target.value } });
              }}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600">Opt In</Label>
            <select
              value={contactOptIn}
              onChange={(e) => {
                setContactOptIn(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, optIn: e.target.value } });
              }}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select opt in status</option>
              <option value="opted_in">Opted In</option>
              <option value="opted_out">Opted Out</option>
            </select>
          </div>
          <div>
            <Label className="text-xs text-gray-600">Tags</Label>
            <select
              value={contactTags}
              onChange={(e) => {
                setContactTags(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, tags: e.target.value } });
              }}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select tags...</option>
              {contactTagsList.map((t: any) => (
                <option key={t.id} value={t.name || t.id}>
                  {t.name || t.id}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Select tags from the list</p>
          </div>
          <div>
            <Label className="text-xs text-gray-600">Allow Duplicate</Label>
            <select
              value={contactAllowDuplicate}
              onChange={(e) => {
                setContactAllowDuplicate(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, allowDuplicate: e.target.value } });
              }}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select allow duplicate</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
        </div>
      </div>
      )}

      {/* Auto Assign Contact - for Contact action */}
      {node.data?.selectedActionId === 'auto-assign-contact' && isContactAction && (
      <div className="border border-gray-200 rounded-lg bg-white mt-3">
        <div className="p-3 border-b border-gray-200">
          <span className="font-medium text-sm">Auto Assign Contact</span>
        </div>
        <div className="p-3 pt-4 space-y-3">
          <div>
            <Label className="text-xs text-gray-600">Search by ID or Phone *</Label>
            <select
              value={contactSearchBy}
              onChange={(e) => {
                setContactSearchBy(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, searchByIdOrPhone: e.target.value } });
              }}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select search by id or phone</option>
              <option value="id">ID</option>
              <option value="phone">Phone</option>
            </select>
          </div>
          <div>
            <Label className="text-xs text-gray-600">Contact ID or Phone Number *</Label>
            <Input
              placeholder="The ID or phone number of the contact to assign"
              value={contactIdOrPhone}
              onChange={(e) => {
                setContactIdOrPhone(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, contactIdOrPhone: e.target.value } });
              }}
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">The ID or phone number of the contact to assign</p>
          </div>
          <div>
            <Label className="text-xs text-gray-600">Assign To *</Label>
            <select
              value={contactAssignTo}
              onChange={(e) => {
                setContactAssignTo(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, assignTo: e.target.value } });
              }}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select assign to...</option>
              {orgMembers.map((m: any) => (
                <option key={m.id} value={m.email || m.id}>
                  {m.name || m.email || m.id}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Select users from the list</p>
          </div>
        </div>
      </div>
      )}

      {/* Add Note - for Contact action */}
      {node.data?.selectedActionId === 'add-note' && isContactAction && (
      <div className="border border-gray-200 rounded-lg bg-white mt-3">
        <div className="p-3 border-b border-gray-200">
          <span className="font-medium text-sm">Add Note</span>
        </div>
        <div className="p-3 pt-4 space-y-3">
          <div>
            <Label className="text-xs text-gray-600">Search by ID or Phone *</Label>
            <select
              value={contactSearchBy}
              onChange={(e) => {
                setContactSearchBy(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, searchByIdOrPhone: e.target.value } });
              }}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select search by id or phone</option>
              <option value="id">ID</option>
              <option value="phone">Phone</option>
            </select>
          </div>
          <div>
            <Label className="text-xs text-gray-600">Contact ID or Phone Number *</Label>
            <Input
              placeholder="The ID or phone number of the contact to assign"
              value={contactIdOrPhone}
              onChange={(e) => {
                setContactIdOrPhone(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, contactIdOrPhone: e.target.value } });
              }}
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">The ID or phone number of the contact to assign</p>
          </div>
          <div>
            <Label className="text-xs text-gray-600">Note *</Label>
            <textarea
              placeholder="The note to add to the contact"
              value={contactNote}
              onChange={(e) => {
                setContactNote(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, note: e.target.value } });
              }}
              rows={4}
              className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">The note to add to the contact</p>
          </div>
        </div>
      </div>
      )}

      {/* Add Tag - for Contact action */}
      {node.data?.selectedActionId === 'add-tag' && isContactAction && (
      <div className="border border-gray-200 rounded-lg bg-white mt-3">
        <div className="p-3 border-b border-gray-200">
          <span className="font-medium text-sm">Add Tag</span>
        </div>
        <div className="p-3 pt-4 space-y-3">
          <div>
            <Label className="text-xs text-gray-600">Search by ID or Phone *</Label>
            <select
              value={contactSearchBy}
              onChange={(e) => {
                setContactSearchBy(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, searchByIdOrPhone: e.target.value } });
              }}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select search by id or phone</option>
              <option value="id">ID</option>
              <option value="phone">Phone</option>
            </select>
          </div>
          <div>
            <Label className="text-xs text-gray-600">Contact ID or Phone Number *</Label>
            <Input
              placeholder="Leave blank to use the contact from the trigger"
              value={contactIdOrPhone}
              onChange={(e) => {
                setContactIdOrPhone(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, contactIdOrPhone: e.target.value } });
              }}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600">Tag *</Label>
            <select
              value={contactTags}
              onChange={(e) => {
                setContactTags(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, tags: e.target.value } });
              }}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select tag...</option>
              {contactTagsList.map((t: any) => (
                <option key={t.id} value={t.name || t.id}>
                  {t.name || t.id}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Creates the tag if it does not exist yet</p>
          </div>
        </div>
      </div>
      )}

      {/* Custom request - for Contact action (same as Calendly) */}
      {node.data?.selectedActionId === 'custom-request-contact' && isContactAction && (
      <div className="border border-gray-200 rounded-lg bg-white mt-3">
        <div className="p-3 border-b border-gray-200">
          <span className="font-medium text-sm">Custom request</span>
        </div>
        <div className="p-3 pt-4 space-y-3">
          <div>
            <Label htmlFor="contact-custom-method" className="text-xs text-gray-600">Method *</Label>
            <select
              id="contact-custom-method"
              value={customRequestMethod}
              onChange={(e) => {
                setCustomRequestMethod(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, method: e.target.value } });
              }}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select method</option>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">The HTTP method we&apos;ll use to perform the request.</p>
          </div>
          <div>
            <Label htmlFor="contact-custom-url" className="text-xs text-gray-600">URL *</Label>
            <Input
              id="contact-custom-url"
              placeholder="https://api.example.com/endpoint"
              value={customRequestUrl}
              onChange={(e) => {
                setCustomRequestUrl(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, url: e.target.value } });
              }}
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">Any URL with a querystring will be re-encoded properly.</p>
          </div>
          <div>
            <Label htmlFor="contact-custom-data" className="text-xs text-gray-600">Data</Label>
            <textarea
              id="contact-custom-data"
              placeholder='{"key": "value"}'
              value={customRequestData}
              onChange={(e) => {
                setCustomRequestData(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, data: e.target.value } });
              }}
              rows={4}
              className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Place raw JSON data here.</p>
          </div>
        </div>
      </div>
      )}

      {/* Google Calendar - Create event */}
      {node.data?.selectedActionId === 'create-event' && isGoogleCalendarAction && (
      <div className="border border-gray-200 rounded-lg bg-white mt-3">
        <div className="p-3 border-b border-gray-200">
          <span className="font-medium text-sm">Create event</span>
        </div>
        <div className="p-3 pt-4 space-y-3">
          <div>
            <Label className="text-xs text-gray-600">Event summary *</Label>
            <Input
              placeholder="Meeting title"
              value={calendarEventSummary}
              onChange={(e) => {
                setCalendarEventSummary(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, eventSummary: e.target.value } });
              }}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600">Description</Label>
            <textarea
              placeholder="Event description"
              value={calendarEventDescription}
              onChange={(e) => {
                setCalendarEventDescription(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, eventDescription: e.target.value } });
              }}
              rows={3}
              className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600">Start (ISO 8601 or date-time) *</Label>
            <Input
              placeholder="2024-01-15T10:00:00"
              value={calendarEventStart}
              onChange={(e) => {
                setCalendarEventStart(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, eventStart: e.target.value } });
              }}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600">End (ISO 8601 or date-time) *</Label>
            <Input
              placeholder="2024-01-15T11:00:00"
              value={calendarEventEnd}
              onChange={(e) => {
                setCalendarEventEnd(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, eventEnd: e.target.value } });
              }}
              className="mt-1"
            />
          </div>
        </div>
      </div>
      )}

      {/* Google Calendar - Update event */}
      {node.data?.selectedActionId === 'update-event' && isGoogleCalendarAction && (
      <div className="border border-gray-200 rounded-lg bg-white mt-3">
        <div className="p-3 border-b border-gray-200">
          <span className="font-medium text-sm">Update event</span>
        </div>
        <div className="p-3 pt-4 space-y-3">
          <div>
            <Label className="text-xs text-gray-600">Event ID *</Label>
            <Input
              placeholder="Event ID to update"
              value={calendarEventId}
              onChange={(e) => {
                setCalendarEventId(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, eventId: e.target.value } });
              }}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600">Event summary</Label>
            <Input
              placeholder="Meeting title"
              value={calendarEventSummary}
              onChange={(e) => {
                setCalendarEventSummary(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, eventSummary: e.target.value } });
              }}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600">Start (ISO 8601)</Label>
            <Input
              placeholder="2024-01-15T10:00:00"
              value={calendarEventStart}
              onChange={(e) => {
                setCalendarEventStart(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, eventStart: e.target.value } });
              }}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600">End (ISO 8601)</Label>
            <Input
              placeholder="2024-01-15T11:00:00"
              value={calendarEventEnd}
              onChange={(e) => {
                setCalendarEventEnd(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, eventEnd: e.target.value } });
              }}
              className="mt-1"
            />
          </div>
        </div>
      </div>
      )}

      {/* Google Calendar - Custom request */}
      {node.data?.selectedActionId === 'custom-request-calendar' && isGoogleCalendarAction && (
      <div className="border border-gray-200 rounded-lg bg-white mt-3">
        <div className="p-3 border-b border-gray-200">
          <span className="font-medium text-sm">Custom request</span>
        </div>
        <div className="p-3 pt-4 space-y-3">
          <div>
            <Label className="text-xs text-gray-600">Method *</Label>
            <select
              value={customRequestMethod}
              onChange={(e) => {
                setCustomRequestMethod(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, method: e.target.value } });
              }}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select method</option>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>
          <div>
            <Label className="text-xs text-gray-600">URL *</Label>
            <Input
              placeholder="https://www.googleapis.com/calendar/v3/..."
              value={customRequestUrl}
              onChange={(e) => {
                setCustomRequestUrl(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, url: e.target.value } });
              }}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600">Data</Label>
            <textarea
              placeholder='{"key": "value"}'
              value={customRequestData}
              onChange={(e) => {
                setCustomRequestData(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, data: e.target.value } });
              }}
              rows={4}
              className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>
      )}

      {/* Google Contacts - Create contact */}
      {node.data?.selectedActionId === 'create-google-contact' && isGoogleContactsAction && (
      <div className="border border-gray-200 rounded-lg bg-white mt-3">
        <div className="p-3 border-b border-gray-200">
          <span className="font-medium text-sm">Create Google Contact</span>
        </div>
        <div className="p-3 pt-4 space-y-3">
          <div>
            <Label className="text-xs text-gray-600">Name *</Label>
            <Input
              placeholder="Contact name"
              value={googleContactName}
              onChange={(e) => {
                setGoogleContactName(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, googleContactName: e.target.value } });
              }}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600">Email</Label>
            <Input
              placeholder="email@example.com"
              value={googleContactEmail}
              onChange={(e) => {
                setGoogleContactEmail(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, googleContactEmail: e.target.value } });
              }}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600">Phone</Label>
            <Input
              placeholder="+1234567890"
              value={googleContactPhone}
              onChange={(e) => {
                setGoogleContactPhone(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, googleContactPhone: e.target.value } });
              }}
              className="mt-1"
            />
          </div>
        </div>
      </div>
      )}

      {/* Google Contacts - Update contact */}
      {node.data?.selectedActionId === 'update-google-contact' && isGoogleContactsAction && (
      <div className="border border-gray-200 rounded-lg bg-white mt-3">
        <div className="p-3 border-b border-gray-200">
          <span className="font-medium text-sm">Update Google Contact</span>
        </div>
        <div className="p-3 pt-4 space-y-3">
          <div>
            <Label className="text-xs text-gray-600">Contact resource name *</Label>
            <Input
              placeholder="people/xxx"
              value={googleContactResourceName}
              onChange={(e) => {
                setGoogleContactResourceName(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, googleContactResourceName: e.target.value } });
              }}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600">Name</Label>
            <Input
              placeholder="Contact name"
              value={googleContactName}
              onChange={(e) => {
                setGoogleContactName(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, googleContactName: e.target.value } });
              }}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600">Email</Label>
            <Input
              placeholder="email@example.com"
              value={googleContactEmail}
              onChange={(e) => {
                setGoogleContactEmail(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, googleContactEmail: e.target.value } });
              }}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600">Phone</Label>
            <Input
              placeholder="+1234567890"
              value={googleContactPhone}
              onChange={(e) => {
                setGoogleContactPhone(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, googleContactPhone: e.target.value } });
              }}
              className="mt-1"
            />
          </div>
        </div>
      </div>
      )}

      {/* Google Contacts - Custom request */}
      {node.data?.selectedActionId === 'custom-request-google-contacts' && isGoogleContactsAction && (
      <div className="border border-gray-200 rounded-lg bg-white mt-3">
        <div className="p-3 border-b border-gray-200">
          <span className="font-medium text-sm">Custom request</span>
        </div>
        <div className="p-3 pt-4 space-y-3">
          <div>
            <Label className="text-xs text-gray-600">Method *</Label>
            <select
              value={customRequestMethod}
              onChange={(e) => {
                setCustomRequestMethod(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, method: e.target.value } });
              }}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select method</option>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>
          <div>
            <Label className="text-xs text-gray-600">URL *</Label>
            <Input
              placeholder="https://people.googleapis.com/v1/..."
              value={customRequestUrl}
              onChange={(e) => {
                setCustomRequestUrl(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, url: e.target.value } });
              }}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600">Data</Label>
            <textarea
              placeholder='{"key": "value"}'
              value={customRequestData}
              onChange={(e) => {
                setCustomRequestData(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, data: e.target.value } });
              }}
              rows={4}
              className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>
      )}

      {/* OpenAI - Chat completion / Generate text */}
      {(node.data?.selectedActionId === 'openai-chat' || node.data?.selectedActionId === 'openai-generate') && isOpenAIAction && (
      <div className="border border-gray-200 rounded-lg bg-white mt-3">
        <div className="p-3 border-b border-gray-200">
          <span className="font-medium text-sm">OpenAI</span>
        </div>
        <div className="p-3 pt-4 space-y-3">
          <div>
            <Label className="text-xs text-gray-600">Model</Label>
            <select
              value={openaiModel}
              onChange={(e) => {
                setOpenaiModel(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, model: e.target.value } });
              }}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="gpt-4o">gpt-4o</option>
              <option value="gpt-4o-mini">gpt-4o-mini</option>
              <option value="gpt-4-turbo">gpt-4-turbo</option>
              <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
            </select>
          </div>
          <div>
            <Label className="text-xs text-gray-600">Prompt / Message *</Label>
            <textarea
              placeholder="Enter your prompt or chat message..."
              value={openaiPrompt}
              onChange={(e) => {
                setOpenaiPrompt(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, prompt: e.target.value } });
              }}
              rows={4}
              className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>
      )}

      {/* Google Gemini - Generate content / Chat */}
      {(node.data?.selectedActionId === 'gemini-generate' || node.data?.selectedActionId === 'gemini-chat') && isGeminiAction && (
      <div className="border border-gray-200 rounded-lg bg-white mt-3">
        <div className="p-3 border-b border-gray-200">
          <span className="font-medium text-sm">Google Gemini</span>
        </div>
        <div className="p-3 pt-4 space-y-3">
          <div>
            <Label className="text-xs text-gray-600">Model</Label>
            <select
              value={geminiModel}
              onChange={(e) => {
                setGeminiModel(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, model: e.target.value } });
              }}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="gemini-1.5-flash">gemini-1.5-flash</option>
              <option value="gemini-1.5-pro">gemini-1.5-pro</option>
              <option value="gemini-1.0-pro">gemini-1.0-pro</option>
            </select>
          </div>
          <div>
            <Label className="text-xs text-gray-600">Prompt *</Label>
            <textarea
              placeholder="Enter your prompt..."
              value={geminiPrompt}
              onChange={(e) => {
                setGeminiPrompt(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, prompt: e.target.value } });
              }}
              rows={4}
              className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>
      )}

      {/* Send message — To + body */}
      {(node.data?.selectedActionId === "send-message" || node.data?.selectedAction === "Send message") &&
        isWhatsAppAction && (
          <div className="border border-gray-200 rounded-lg bg-white mt-3">
            <div className="p-3 border-b border-gray-200">
              <span className="font-medium text-sm">Send message</span>
            </div>
            <div className="p-3 pt-4 space-y-3">
              <FlowFieldWithVariables
                id="send-message-to"
                label="To"
                required
                value={messageTo}
                placeholder="{{contact.phoneE164}}"
                helpText="Recipient phone. Use Insert variable for trigger or any earlier step in this flow."
                nodes={nodes}
                edges={edges}
                currentNodeId={node.id}
                contextLabel="To — phone number"
                mono
                showContactChips
                onChange={(next) => {
                  setMessageTo(next);
                  onUpdateNodeData?.(node.id, {
                    config: { ...node.data?.config, messageTo: next, to: next },
                  });
                }}
              />
              <FlowFieldWithVariables
                id="send-message-body"
                label="Message body"
                required
                multiline
                rows={5}
                value={messageBody}
                placeholder="Hi {{contact.firstName}}, your contact was updated."
                helpText="Text sent to the user. Variables from Contact Updated trigger and parent nodes are replaced when the flow runs."
                nodes={nodes}
                edges={edges}
                currentNodeId={node.id}
                contextLabel="Message body"
                mono
                onChange={(next) => {
                  setMessageBody(next);
                  onUpdateNodeData?.(node.id, {
                    config: { ...node.data?.config, messageBody: next, body: next, text: next },
                  });
                }}
              />
            </div>
          </div>
        )}

      {(node.data?.selectedActionId === "send-payment-link" ||
        node.data?.selectedActionId === "send-whatsapp-pay") &&
        isWhatsAppAction && (
          <div className="border border-gray-200 rounded-lg bg-white mt-3">
            <div className="p-3 border-b border-gray-200">
              <span className="font-medium text-sm">
                {node.data?.selectedActionId === "send-whatsapp-pay"
                  ? "WhatsApp Pay"
                  : "Send payment link"}
              </span>
            </div>
            <div className="p-3 pt-4 space-y-3">
              <FlowFieldWithVariables
                id="payment-to"
                label="To"
                required
                value={messageTo}
                placeholder="{{trigger.phone}}"
                helpText="Customer phone (E.164 digits). Use variables from Shopify/Woo trigger."
                nodes={nodes}
                edges={edges}
                currentNodeId={node.id}
                contextLabel="To"
                mono
                showContactChips
                onChange={(next) => {
                  setMessageTo(next);
                  onUpdateNodeData?.(node.id, {
                    config: {
                      ...node.data?.config,
                      paymentTo: next,
                      messageTo: next,
                      to: next,
                    },
                  });
                }}
              />
              <FlowFieldWithVariables
                id="payment-amount"
                label="Amount"
                required
                value={paymentAmount}
                placeholder="{{trigger.total_price}}"
                helpText="Major currency units (e.g. 499.00 for ₹499). Supports trigger variables."
                nodes={nodes}
                edges={edges}
                currentNodeId={node.id}
                contextLabel="Amount"
                mono
                onChange={(next) => {
                  setPaymentAmount(next);
                  onUpdateNodeData?.(node.id, {
                    config: { ...node.data?.config, amount: next, paymentAmount: next },
                  });
                }}
              />
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Currency</label>
                <Input
                  value={paymentCurrency}
                  onChange={(e) => {
                    const next = e.target.value.toUpperCase();
                    setPaymentCurrency(next);
                    onUpdateNodeData?.(node.id, {
                      config: { ...node.data?.config, currency: next },
                    });
                  }}
                  placeholder="INR"
                  className="h-9"
                />
              </div>
              <FlowFieldWithVariables
                id="payment-description"
                label="Description (optional)"
                value={paymentDescription}
                placeholder="Order {{trigger.order_id}}"
                nodes={nodes}
                edges={edges}
                currentNodeId={node.id}
                contextLabel="Description"
                onChange={(next) => {
                  setPaymentDescription(next);
                  onUpdateNodeData?.(node.id, {
                    config: {
                      ...node.data?.config,
                      description: next,
                      paymentDescription: next,
                    },
                  });
                }}
              />
              {node.data?.selectedActionId === "send-whatsapp-pay" && (
                <FlowFieldWithVariables
                  id="payment-body-text"
                  label="Payment message (optional)"
                  value={paymentBodyText}
                  placeholder="Complete payment for order {{trigger.order_id}}"
                  nodes={nodes}
                  edges={edges}
                  currentNodeId={node.id}
                  contextLabel="Body"
                  onChange={(next) => {
                    setPaymentBodyText(next);
                    onUpdateNodeData?.(node.id, {
                      config: { ...node.data?.config, bodyText: next },
                    });
                  }}
                />
              )}
              {node.data?.selectedActionId === "send-whatsapp-pay" && (
                <p className="text-xs text-muted-foreground">
                  Requires Commerce → WhatsApp native pay + Meta payment configuration. Otherwise
                  sends a Razorpay/Cashfree link automatically.
                </p>
              )}
            </div>
          </div>
        )}

      {node.data?.selectedActionId === "send-collection" && isWhatsAppAction && (
        <div className="border border-gray-200 rounded-lg bg-white mt-3">
          <div className="p-3 border-b border-gray-200">
            <span className="font-medium text-sm">Send Shopify collection</span>
          </div>
          <div className="p-3 pt-4 space-y-3">
            <FlowFieldWithVariables
              id="collection-to"
              label="To"
              required
              value={messageTo}
              placeholder="{{trigger.phone}}"
              nodes={nodes}
              edges={edges}
              currentNodeId={node.id}
              contextLabel="To"
              mono
              showContactChips
              onChange={(next) => {
                setMessageTo(next);
                onUpdateNodeData?.(node.id, {
                  config: { ...node.data?.config, messageTo: next, to: next },
                });
              }}
            />
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Shopify collection ID *</label>
              <Input
                value={collectionId}
                onChange={(e) => {
                  const next = e.target.value;
                  setCollectionId(next);
                  onUpdateNodeData?.(node.id, {
                    config: { ...node.data?.config, collectionId: next },
                  });
                }}
                placeholder="123456789"
                className="h-9 font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Find in Shopify Admin → Products → Collections → URL id. Sync products in Commerce
                first.
              </p>
            </div>
            <FlowFieldWithVariables
              id="collection-title"
              label="Section title"
              value={collectionTitle}
              placeholder="Summer sale"
              nodes={nodes}
              edges={edges}
              currentNodeId={node.id}
              contextLabel="Section title"
              onChange={(next) => {
                setCollectionTitle(next);
                onUpdateNodeData?.(node.id, {
                  config: {
                    ...node.data?.config,
                    collectionTitle: next,
                    sectionTitle: next,
                  },
                });
              }}
            />
            <FlowFieldWithVariables
              id="collection-body"
              label="Message body"
              value={messageBody}
              placeholder="Browse our {{collectionTitle}} picks"
              nodes={nodes}
              edges={edges}
              currentNodeId={node.id}
              contextLabel="Body"
              onChange={(next) => {
                setMessageBody(next);
                onUpdateNodeData?.(node.id, {
                  config: { ...node.data?.config, body: next, messageBody: next },
                });
              }}
            />
          </div>
        </div>
      )}

      {/* Phone Number Id Section - for WhatsApp action nodes (Send message, Send Template, etc.) */}
      {isWhatsAppAction && (
      <div className="border border-gray-200 rounded-lg bg-white mt-3">
        <button
          onClick={() => setIsPhoneNumberIdOpen(!isPhoneNumberIdOpen)}
          className="w-full flex items-center justify-between p-3 hover:bg-gray-50"
        >
          <span className="font-medium text-sm">Phone Number Id *</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${isPhoneNumberIdOpen ? '' : '-rotate-90'}`} />
        </button>
        {isPhoneNumberIdOpen && (
          <div className="p-3 pt-4 space-y-3 border-t border-gray-200">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Select phone number id</label>
              <Popover 
                open={isPhoneNumberIdDropdownOpen} 
                onOpenChange={(open) => {
                  setIsPhoneNumberIdDropdownOpen(open);
                  if (!open) setPhoneNumberIdSearchQuery("");
                }}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex-1 h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-left font-normal shadow-sm hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className={selectedPhoneNumberId ? "text-foreground" : "text-muted-foreground"}>
                      {selectedPhoneNumberId 
                        ? (() => {
                            const session = whatsappSessions.find(s => s.phoneNumberId === selectedPhoneNumberId || s.sessionId === selectedConnection);
                            return session ? (session.displayPhoneNumber || session.verifiedName || session.phoneNumberId) : selectedPhoneNumberId;
                          })()
                        : 'Select phone number id'}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <div className="p-2">
                    <div className="relative mb-2">
                      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search phone numbers..."
                        value={phoneNumberIdSearchQuery}
                        onChange={(e) => setPhoneNumberIdSearchQuery(e.target.value)}
                        className="pl-8 h-8"
                        autoFocus
                      />
                    </div>
                    <ScrollArea className="h-[200px]">
                      {whatsappSessions.filter(s => 
                        (s.displayPhoneNumber || s.verifiedName || s.phoneNumberId || '').toLowerCase().includes(phoneNumberIdSearchQuery.toLowerCase())
                      ).length === 0 ? (
                        <div className="text-center py-8 text-sm text-gray-500">
                          No WhatsApp sessions found. Go to Connect page to add phone numbers.
                        </div>
                      ) : (
                        <div className="space-y-0">
                          {whatsappSessions.filter(s => 
                            (s.displayPhoneNumber || s.verifiedName || s.phoneNumberId || '').toLowerCase().includes(phoneNumberIdSearchQuery.toLowerCase())
                          ).map((session) => (
                            <button
                              key={session.sessionId}
                              onClick={() => {
                                setSelectedPhoneNumberId(session.phoneNumberId);
                                setSelectedConnection(session.sessionId);
                                setPhoneNumberIdSearchQuery("");
                                setIsPhoneNumberIdDropdownOpen(false);
                                onUpdateNodeData?.(node.id, {
                                  config: { ...node.data?.config, phoneNumberId: session.phoneNumberId, connectionId: session.sessionId },
                                });
                              }}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-md ${
                                selectedPhoneNumberId === session.phoneNumberId ? 'bg-gray-100' : ''
                              }`}
                            >
                              {session.displayPhoneNumber || session.verifiedName || session.phoneNumberId || session.sessionId}
                            </button>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                </PopoverContent>
              </Popover>
              <div className="flex justify-end mt-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/integrations/whatsapp-business/added-phones'] })}
                  title="Refresh phone numbers"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">The phone number ID to send the message to.</p>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Reply Phone, Timeout unit, Timeout value - for Wait for Reply action */}
      {(node.data?.selectedActionId === 'wait-for-reply' || node.data?.selectedAction === 'Wait for Reply') && isWhatsAppAction && (
      <div className="border border-gray-200 rounded-lg bg-white mt-3">
        <div className="p-3 border-b border-gray-200">
          <span className="font-medium text-sm">Wait for Reply</span>
        </div>
        <div className="p-3 pt-4 space-y-3">
        <FlowFieldWithVariables
          id="wait-reply-phone"
          label="Reply Phone"
          required
          value={replyPhone}
          placeholder="{{contact.phoneE164}}"
          helpText="Phone number to watch for a reply (usually the same contact). Use Insert variable from trigger or earlier steps."
          nodes={nodes}
          edges={edges}
          currentNodeId={node.id}
          contextLabel="Reply phone"
          mono
          showContactChips
          onChange={(next) => {
            setReplyPhone(next);
            onUpdateNodeData?.(node.id, { config: { ...node.data?.config, replyPhone: next } });
          }}
        />
        <div className="border border-gray-200 rounded-lg bg-white p-3 pt-4">
          <label className="text-xs text-gray-600 mb-1 block">Timeout unit *</label>
          <Popover open={isTimeoutUnitDropdownOpen} onOpenChange={setIsTimeoutUnitDropdownOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex-1 h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-left font-normal shadow-sm hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <span className={timeoutUnit ? "text-foreground" : "text-muted-foreground"}>
                  {timeoutUnit || 'Select timeout unit'}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <div className="p-2">
                {['Minutes', 'Hours', 'Days', 'Weeks'].map((unit) => (
                  <button
                    key={unit}
                    onClick={() => {
                      setTimeoutUnit(unit);
                      setIsTimeoutUnitDropdownOpen(false);
                      onUpdateNodeData?.(node.id, { config: { ...node.data?.config, timeoutUnit: unit } });
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-md ${timeoutUnit === unit ? 'bg-gray-100' : ''}`}
                  >
                    {unit}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <p className="text-xs text-gray-500 mt-1">Timeout unit, e.g. minutes, hours, days, weeks.</p>
        </div>
        <div className="border border-gray-200 rounded-lg bg-white p-3 pt-4">
          <label className="text-xs text-gray-600 mb-1 block">Timeout value *</label>
          <Input
            type="number"
            min={1}
            placeholder="e.g. 1, 2, 3"
            value={timeoutValue}
            onChange={(e) => {
              setTimeoutValue(e.target.value);
              onUpdateNodeData?.(node.id, { config: { ...node.data?.config, timeoutValue: e.target.value } });
            }}
            className="h-9"
          />
          <p className="text-xs text-gray-500 mt-1">The timeout value, use a number, e.g. 1, 2, 3.</p>
        </div>
        </div>
      </div>
      )}

      {/* Send Template Section - To, Template Id, Dynamic Fields */}
      {node.data?.selectedActionId === 'send-template' && isWhatsAppAction && (
      <div className="border border-gray-200 rounded-lg bg-white mt-3">
        <div className="p-3 border-b border-gray-200">
          <span className="font-medium text-sm">Send Template</span>
        </div>
        <div className="p-3 pt-4 space-y-3">
          <div>
            <label className="text-xs text-gray-600 mb-1 block">To *</label>
            <Input
              placeholder={flowHasGoogleSheetsRowTrigger ? '{{trigger.phone}}' : '{{contact.phoneE164}}'}
              value={templateTo}
              onChange={(e) => {
                setTemplateTo(e.target.value);
                onUpdateNodeData?.(node.id, { config: { ...node.data?.config, templateTo: e.target.value, to: e.target.value } });
              }}
              className="h-9 font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Use a variable from your trigger or an earlier step — not a fixed number.{" "}
              {flowHasGoogleSheetsRowTrigger ? (
                <>
                  For Google Sheets rows use <code className="text-[10px] bg-gray-100 px-0.5 rounded">{"{{trigger.phone}}"}</code>{" "}
                  or <code className="text-[10px] bg-gray-100 px-0.5 rounded">{"{{contact.phone}}"}</code>.
                </>
              ) : (
                <>
                  <strong>Insert variable</strong> lists Contact, Webhook, Shopify, Calendar, and parent-step outputs.
                </>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <FlowVariablePicker
                nodes={nodes}
                edges={edges}
                currentNodeId={node.id}
                contextLabel="To — phone number"
                onInsert={(snippet) => {
                  const next = appendFlowVariable(templateTo, snippet);
                  setTemplateTo(next);
                  onUpdateNodeData?.(node.id, {
                    config: { ...node.data?.config, templateTo: next, to: next },
                  });
                }}
              />
              <ContactFlowVariableChips
                onInsert={(snippet) => {
                  setTemplateTo(snippet);
                  onUpdateNodeData?.(node.id, {
                    config: { ...node.data?.config, templateTo: snippet, to: snippet },
                  });
                }}
              />
            </div>
          </div>
        <button
          onClick={() => setIsTemplateOpen(!isTemplateOpen)}
          className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg border border-gray-200 mt-2"
        >
          <span className="font-medium text-sm">Template Id *</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${isTemplateOpen ? '' : '-rotate-90'}`} />
        </button>
        {isTemplateOpen && (
          <div className="p-3 pt-4 space-y-3 border-t border-gray-200">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Select template id</label>
              <Popover 
                open={isTemplateDropdownOpen} 
                onOpenChange={(open) => {
                  setIsTemplateDropdownOpen(open);
                  if (!open) setTemplateSearchQuery("");
                }}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex-1 h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-left font-normal shadow-sm hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className={selectedTemplate ? "text-foreground" : "text-muted-foreground"}>
                      {selectedTemplate ? (templates.find(t => t.name === selectedTemplate || (t as { templateId?: string }).templateId === selectedTemplate || t.id === selectedTemplate)?.name || selectedTemplate) : 'Select template id'}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <div className="p-2">
                    <div className="relative mb-2">
                      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search templates..."
                        value={templateSearchQuery}
                        onChange={(e) => setTemplateSearchQuery(e.target.value)}
                        className="pl-8 h-8"
                        autoFocus
                      />
                    </div>
                    <ScrollArea className="h-[200px]">
                      {templates.filter(t => 
                        (t.name || t.id || (t as { templateId?: string }).templateId || '').toLowerCase().includes(templateSearchQuery.toLowerCase())
                      ).length === 0 ? (
                        <div className="text-center py-8 text-sm text-gray-500">
                          {!selectedPhoneNumberId && !selectedConnection ? 'Select a phone number first.' : !selectedPhoneNumberId ? 'Select a phone number to see templates.' : 'No templates found for this number.'}
                        </div>
                      ) : (
                        <div className="space-y-0">
                          {templates.filter(t => {
                            const label = t.name || t.id || (t as { templateId?: string }).templateId || '';
                            return label.toLowerCase().includes(templateSearchQuery.toLowerCase());
                          }).map((tpl) => {
                            const tplName = tpl.name || (tpl as { templateId?: string }).templateId || tpl.id;
                            return (
                            <button
                              key={tpl.id || tplName}
                              onClick={() => {
                                setSelectedTemplate(tplName);
                                setTemplateSearchQuery("");
                                setIsTemplateDropdownOpen(false);
                                const components = tpl.components || [];
                                const hdr = components.find((c: any) => c.type === 'HEADER');
                                const hdrFormat = String(hdr?.format || '').toUpperCase();
                                const bodyComp = components.find((c: any) => c.type === 'BODY') as
                                  | { text?: string }
                                  | undefined;
                                const matches = bodyComp?.text?.match(/\{\{(\d+)\}\}/g);
                                const varNums = matches
                                  ? Array.from<number>(
                                      new Set<number>(
                                        matches.map((m: string) => parseInt(m.replace(/[{}]/g, ''), 10))
                                      )
                                    ).sort((a, b) => a - b)
                                  : [];
                                const templateParams = varNums.map(() => '');
                                setTemplateDynamicFields(
                                  varNums.map((i, idx) => ({ index: i, value: templateParams[idx] ?? '' }))
                                );
                                const exampleHeaderUrl =
                                  hdr?.example?.header_handle?.[0] ||
                                  hdr?.example?.header_url?.[0] ||
                                  '';
                                const galleryExampleUrl = exampleHeaderUrl.includes('/uploads/')
                                  ? exampleHeaderUrl
                                  : '';
                                const prevFormat = String(
                                  (node?.data?.config as any)?.headerFormat || ''
                                ).toUpperCase();
                                setTemplateHeaderFormat(hdrFormat);
                                if (galleryExampleUrl && hdrFormat === 'IMAGE') {
                                  setTemplateHeaderImageUrl(galleryExampleUrl);
                                } else if (hdrFormat !== 'IMAGE') {
                                  setTemplateHeaderImageUrl('');
                                }
                                const tplLanguage = String((tpl as { language?: string }).language || 'en');
                                const configPatch: Record<string, unknown> = {
                                  ...node.data?.config,
                                  templateId: tplName,
                                  templateName: tplName,
                                  templateLanguage: tplLanguage,
                                  languageCode: tplLanguage,
                                  templateParams,
                                  headerFormat: hdrFormat || undefined,
                                };
                                if (hdrFormat !== prevFormat) {
                                  if (hdrFormat !== 'IMAGE') configPatch.headerImageUrl = undefined;
                                  if (hdrFormat !== 'VIDEO') configPatch.headerVideoUrl = undefined;
                                  if (hdrFormat !== 'DOCUMENT') configPatch.headerDocumentUrl = undefined;
                                }
                                if (galleryExampleUrl && hdrFormat === 'IMAGE') {
                                  configPatch.headerImageUrl = galleryExampleUrl;
                                }
                                onUpdateNodeData?.(node.id, { config: configPatch });
                              }}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-md ${
                                selectedTemplate === tplName ? 'bg-gray-100' : ''
                              }`}
                            >
                              {tplName}
                            </button>
                          );})}
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                </PopoverContent>
              </Popover>
              <div className="flex justify-end mt-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={async () => {
                    const phoneId = selectedPhoneNumberId || whatsappSessions.find(s => s.sessionId === selectedConnection)?.phoneNumberId;
                    if (phoneId) {
                      try {
                        const params = new URLSearchParams({ phoneNumberId: phoneId });
                        if (currentOrganizationId) params.set('organizationId', currentOrganizationId);
                        const res = await apiRequest('GET', `/api/templates?${params.toString()}`);
                        const d = await res.json();
                        setTemplates(Array.isArray(d) ? d : (d.templates || []));
                      } catch {
                        setTemplates([]);
                      }
                    } else if (selectedConnection) {
                      try {
                        const res = await apiRequest('GET', `/api/integrations/whatsapp-business/templates?connectionId=${selectedConnection}`);
                        const d = await res.json();
                        setTemplates(d.templates || []);
                      } catch {
                        setTemplates([]);
                      }
                    }
                  }}
                  title="Refresh templates"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">The name of the template to be sent.</p>
            </div>
          </div>
        )}
        {templateHeaderFormat === 'IMAGE' && (
          <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
            <label className="text-xs text-gray-600 mb-1 block font-medium">Header image *</label>
            <p className="text-xs text-gray-500">
              This template has an IMAGE header. Pick from gallery or paste a public HTTPS URL. Use{" "}
              <strong>Insert variable</strong> for dynamic URLs (e.g. from contact custom fields).
            </p>
            <FlowFieldWithVariables
              id="send-template-header-image"
              label="Header image URL"
              required
              value={templateHeaderImageUrl}
              placeholder="https://yoursite.com/uploads/ORG/gallery/banner.jpg"
              helpText="Required for media templates. Gallery files under /uploads/… work best."
              nodes={nodes}
              edges={edges}
              currentNodeId={node.id}
              contextLabel="Header image URL"
              mono
              onChange={(next) => {
                setTemplateHeaderImageUrl(next);
                onUpdateNodeData?.(node.id, {
                  config: { ...node.data?.config, headerImageUrl: next, headerFormat: 'IMAGE' },
                });
              }}
            />
            <Button type="button" size="sm" variant="outline" onClick={() => setTemplateGalleryOpen(true)}>
              <ImageIcon className="h-4 w-4 mr-1" />
              Pick from gallery
            </Button>
            {templateHeaderImageUrl ? (
              <img
                src={templateHeaderImageUrl}
                alt="Header preview"
                className="max-h-24 rounded border object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : null}
          </div>
        )}
        {templateHeaderFormat === 'VIDEO' && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <FlowFieldWithVariables
              id="send-template-header-video"
              label="Header video URL"
              required
              value={String((node.data?.config as any)?.headerVideoUrl || '')}
              placeholder="https://yoursite.com/uploads/ORG/gallery/video.mp4"
              nodes={nodes}
              edges={edges}
              currentNodeId={node.id}
              contextLabel="Header video URL"
              mono
              onChange={(next) => {
                onUpdateNodeData?.(node.id, {
                  config: { ...node.data?.config, headerVideoUrl: next, headerFormat: 'VIDEO' },
                });
              }}
            />
          </div>
        )}
        {templateHeaderFormat === 'DOCUMENT' && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <FlowFieldWithVariables
              id="send-template-header-document"
              label="Header document URL"
              required
              value={String((node.data?.config as any)?.headerDocumentUrl || '')}
              placeholder="https://yoursite.com/uploads/ORG/gallery/file.pdf"
              nodes={nodes}
              edges={edges}
              currentNodeId={node.id}
              contextLabel="Header document URL"
              mono
              onChange={(next) => {
                onUpdateNodeData?.(node.id, {
                  config: { ...node.data?.config, headerDocumentUrl: next, headerFormat: 'DOCUMENT' },
                });
              }}
            />
          </div>
        )}
        {/* Dynamic Fields - template variables {{1}}, {{2}}, etc. */}
        <div className="mt-3 pt-3 border-t border-gray-200">
          <label className="text-xs text-gray-600 mb-1 block font-medium">Dynamic Fields</label>
          <p className="text-xs text-gray-500 mb-2">
            Template body placeholders ({"{{1}}"}, {"{{2}}"}…). Click <strong>Fetch Fields</strong> after choosing a template,
            then map each slot with <strong>Insert variable</strong> — from your trigger (Contact, Webhook, Shopify, etc.) or
            any earlier step in the flow.
          </p>
          {templateDynamicFields.length > 0 ? (
            <div className="space-y-2">
              {templateDynamicFields.map((f) => (
                <div key={f.index}>
                  <label className="text-xs text-gray-500 mb-0.5 block">Variable {f.index} (&#123;&#123;{f.index}&#125;&#125;)</label>
                  <Input
                    placeholder={`e.g. {{contact.name}} or {{trigger.email}} for {{${f.index}}}`}
                    value={f.value}
                    onChange={(e) => {
                      const next = templateDynamicFields.map(x => x.index === f.index ? { ...x, value: e.target.value } : x);
                      setTemplateDynamicFields(next);
                      onUpdateNodeData?.(node.id, {
                        config: { ...node.data?.config, templateParams: next.map(x => x.value) },
                      });
                    }}
                    className="h-9 font-mono text-sm"
                  />
                  <div className="mt-1.5">
                    <FlowVariablePicker
                      nodes={nodes}
                      edges={edges}
                      currentNodeId={node.id}
                      contextLabel={`Body variable {{${f.index}}}`}
                      onInsert={(snippet) => {
                        const merged = appendFlowVariable(f.value, snippet);
                        const next = templateDynamicFields.map((x) =>
                          x.index === f.index ? { ...x, value: merged } : x
                        );
                        setTemplateDynamicFields(next);
                        onUpdateNodeData?.(node.id, {
                          config: { ...node.data?.config, templateParams: next.map((x) => x.value) },
                        });
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 py-2">
              <span className="text-sm text-gray-500">No dynamic fields loaded yet.</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const tpl = templates.find(t => t.name === selectedTemplate || (t as { templateId?: string }).templateId === selectedTemplate || t.id === selectedTemplate);
                  const components = (tpl as any)?.components || [];
                  const bodyComp = components.find((c: any) => c.type === 'BODY');
                  const matches = bodyComp?.text?.match(/\{\{(\d+)\}\}/g);
                  const varNums = matches
                    ? Array.from<number>(
                        new Set<number>(
                          matches.map((m: string) => parseInt(m.replace(/[{}]/g, ''), 10))
                        )
                      ).sort((a, b) => a - b)
                    : [];
                  const fields = varNums.map(i => ({ index: i, value: templateDynamicFields.find(f => f.index === i)?.value ?? '' }));
                  setTemplateDynamicFields(fields);
                  if (fields.length > 0) {
                    onUpdateNodeData?.(node.id, { config: { ...node.data?.config, templateParams: fields.map(x => x.value) } });
                  }
                }}
              >
                Fetch Fields
              </Button>
            </div>
          )}
        </div>
        </div>
        <Dialog open={templateGalleryOpen} onOpenChange={setTemplateGalleryOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Select header image</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 py-2">
              {templateGalleryItems.length === 0 ? (
                <p className="col-span-full text-sm text-muted-foreground py-8 text-center">
                  No images in gallery. Upload from Settings → Gallery first.
                </p>
              ) : (
                templateGalleryItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="border rounded-lg overflow-hidden hover:ring-2 hover:ring-primary text-left"
                    onClick={() => {
                      const url = item.url.startsWith("/") ? item.url : item.url;
                      setTemplateHeaderImageUrl(url);
                      onUpdateNodeData?.(node.id, {
                        config: {
                          ...node.data?.config,
                          headerImageUrl: url,
                          headerFormat: "IMAGE",
                        },
                      });
                      setTemplateGalleryOpen(false);
                    }}
                  >
                    <img src={item.url} alt={item.name || "Gallery"} className="w-full h-24 object-cover" />
                    <span className="block text-[10px] p-1 truncate">{item.name || item.id}</span>
                  </button>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
      )}

      {/* Send Media Section - Media type, Media URL, Media caption, To */}
      {(node.data?.selectedActionId === 'send-media' || node.data?.selectedAction === 'Send Media') && isWhatsAppAction && (
      <div className="border border-gray-200 rounded-lg bg-white mt-3">
        <div className="p-3 border-b border-gray-200">
          <span className="font-medium text-sm">Send Media</span>
        </div>
        <div className="p-3 pt-4 space-y-3">
          <FlowFieldWithVariables
            id="send-media-to"
            label="To"
            required
            value={mediaTo}
            placeholder="{{contact.phoneE164}}"
            helpText="Recipient phone. Insert variable lists your trigger and all parent steps."
            nodes={nodes}
            edges={edges}
            currentNodeId={node.id}
            contextLabel="To — phone number"
            mono
            showContactChips
            onChange={(next) => {
              setMediaTo(next);
              onUpdateNodeData?.(node.id, { config: { ...node.data?.config, mediaTo: next, to: next } });
            }}
          />
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Media type *</label>
            <Popover open={isMediaTypeDropdownOpen} onOpenChange={setIsMediaTypeDropdownOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex-1 h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-left font-normal shadow-sm hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <span className={mediaType ? "text-foreground" : "text-muted-foreground"}>
                    {mediaType || 'Select media type'}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <div className="p-2">
                  {['Image', 'Video', 'Document', 'Audio'].map((type) => (
                    <button
                      key={type}
                      onClick={() => {
                        setMediaType(type);
                        setIsMediaTypeDropdownOpen(false);
                        onUpdateNodeData?.(node.id, { config: { ...node.data?.config, mediaType: type } });
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-md ${mediaType === type ? 'bg-gray-100' : ''}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <p className="text-xs text-gray-500 mt-1">The type of media to send.</p>
          </div>
          <FlowFieldWithVariables
            id="send-media-url"
            label="Media URL"
            required
            value={mediaUrl}
            placeholder="/uploads/ORG/gallery/photo.jpg or {{trigger.image_url}}"
            helpText="Pick from gallery (recommended) or paste a /uploads/… path or public HTTPS URL."
            nodes={nodes}
            edges={edges}
            currentNodeId={node.id}
            contextLabel="Media URL"
            mono
            onChange={(next) => {
              setMediaUrl(next);
              onUpdateNodeData?.(node.id, { config: { ...node.data?.config, mediaUrl: next } });
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setMediaGalleryOpen(true)}>
              <ImageIcon className="h-4 w-4 mr-1.5" />
              Pick from gallery
            </Button>
            {mediaUrl?.trim() && (mediaType === "Image" || !mediaType) && (
              <img
                src={
                  mediaUrl.startsWith("http") || mediaUrl.startsWith("/")
                    ? mediaUrl.startsWith("/")
                      ? `${window.location.origin}${mediaUrl}`
                      : mediaUrl
                    : undefined
                }
                alt="Media preview"
                className="h-12 w-12 rounded border object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            )}
          </div>
          <FlowFieldWithVariables
            id="send-media-filename"
            label="File name"
            value={mediaFileName}
            placeholder="invoice.pdf or {{contact.id}}.pdf"
            helpText="Required for Document type — shown to the recipient. Can include variables."
            nodes={nodes}
            edges={edges}
            currentNodeId={node.id}
            contextLabel="File name"
            mono
            onChange={(next) => {
              setMediaFileName(next);
              onUpdateNodeData?.(node.id, {
                config: { ...node.data?.config, mediaFileName: next, fileName: next },
              });
            }}
          />
          <FlowFieldWithVariables
            id="send-media-caption"
            label="Media caption"
            value={mediaCaption}
            placeholder="Optional caption — Hi {{contact.firstName}}"
            helpText="Optional caption for image, video, or document."
            nodes={nodes}
            edges={edges}
            currentNodeId={node.id}
            contextLabel="Media caption"
            mono
            onChange={(next) => {
              setMediaCaption(next);
              onUpdateNodeData?.(node.id, { config: { ...node.data?.config, mediaCaption: next } });
            }}
          />
        </div>
        <Dialog open={mediaGalleryOpen} onOpenChange={setMediaGalleryOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Select {flowMediaGalleryType === "video" ? "video" : flowMediaGalleryType === "document" ? "document" : flowMediaGalleryType === "audio" ? "audio" : "image"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 py-2">
              {flowMediaGalleryItems.length === 0 ? (
                <p className="col-span-full text-sm text-muted-foreground py-8 text-center">
                  No {flowMediaGalleryType} files in gallery. Upload from Settings → Gallery first.
                </p>
              ) : (
                flowMediaGalleryItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="border rounded-lg overflow-hidden hover:ring-2 hover:ring-primary text-left"
                    onClick={() => {
                      const url = item.url.startsWith("/") ? item.url : item.url;
                      setMediaUrl(url);
                      onUpdateNodeData?.(node.id, {
                        config: { ...node.data?.config, mediaUrl: url },
                      });
                      setMediaGalleryOpen(false);
                    }}
                  >
                    {item.type === "video" ? (
                      <div className="w-full h-24 bg-muted flex items-center justify-center text-xs text-muted-foreground">
                        Video
                      </div>
                    ) : item.type === "document" ? (
                      <div className="w-full h-24 bg-muted flex items-center justify-center text-xs text-muted-foreground px-2 text-center truncate">
                        {item.name || "Document"}
                      </div>
                    ) : (
                      <img src={item.url} alt={item.name || "Gallery"} className="w-full h-24 object-cover" />
                    )}
                    <span className="block text-[10px] p-1 truncate">{item.name || item.id}</span>
                  </button>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
      )}

      {/* Scope Section - only for Calendly triggers */}
      {node.type === 'trigger' && (node.data?.selectedTrigger === 'event-canceled' || node.data?.selectedTrigger === 'event-schedule') && (
        <div className="border border-gray-200 rounded-lg bg-white">
          <button
            onClick={() => setIsScopeOpen(!isScopeOpen)}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-50"
          >
            <span className="font-medium text-sm">Scope *</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${isScopeOpen ? '' : '-rotate-90'}`} />
          </button>
          {isScopeOpen && (
            <div className="p-3 pt-4 space-y-3 border-t border-gray-200">
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Select scope</label>
                <Popover 
                  open={isScopeDropdownOpen} 
                  onOpenChange={(open) => {
                    setIsScopeDropdownOpen(open);
                    if (!open) {
                      setScopeSearchQuery("");
                    }
                  }}
                >
                  <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-2 text-sm text-left font-normal shadow-sm hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className={selectedScope ? "text-foreground" : "text-muted-foreground"}>
                          {selectedScope 
                            ? (scopes.find(s => s.id === selectedScope)?.name || 'Select scope')
                            : 'Select scope'}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <div className="p-2">
                        <div className="relative mb-2">
                          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            placeholder="Search scope..."
                            value={scopeSearchQuery}
                            onChange={(e) => setScopeSearchQuery(e.target.value)}
                            className="pl-8 h-8"
                            autoFocus
                          />
                        </div>
                        <ScrollArea className="h-[200px]">
                          {scopes.filter(scope => 
                            scope.name.toLowerCase().includes(scopeSearchQuery.toLowerCase())
                          ).length === 0 ? (
                            <div className="text-center py-8 text-sm text-gray-500">
                              No options found.
                            </div>
                          ) : (
                            <div className="space-y-0">
                              {scopes.filter(scope => 
                                scope.name.toLowerCase().includes(scopeSearchQuery.toLowerCase())
                              ).map((scope) => (
                                <button
                                  key={scope.id}
                                  onClick={() => {
                                    setSelectedScope(scope.id);
                                    setScopeSearchQuery("");
                                    setIsScopeDropdownOpen(false);
                                  }}
                                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-md ${
                                    selectedScope === scope.id ? 'bg-gray-100' : ''
                                  }`}
                                >
                                  {scope.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </ScrollArea>
                      </div>
                    </PopoverContent>
                  </Popover>
                <p className="text-xs text-gray-500 mt-1">The scope of the webhook.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Calendar Section - for Google Calendar "New event" trigger and create-event/update-event actions */}
      {selectedAppName === 'google-calendar' && (
        (node.type === 'trigger' && node.data?.selectedTrigger === 'new-event') ||
        (isGoogleCalendarAction && ['create-event', 'update-event'].includes(node.data?.selectedActionId || ''))
      ) && (
        <div className="border border-gray-200 rounded-lg bg-white">
          <button
            onClick={() => setIsCalendarOpen(!isCalendarOpen)}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-50"
          >
            <span className="font-medium text-sm">Calendar *</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${isCalendarOpen ? '' : '-rotate-90'}`} />
          </button>
          {isCalendarOpen && (
            <div className="p-3 pt-4 space-y-3 border-t border-gray-200">
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Select calendar</label>
                <div className="flex gap-2">
                  <Popover 
                    open={isCalendarDropdownOpen} 
                    onOpenChange={(open) => {
                      setIsCalendarDropdownOpen(open);
                      if (!open) {
                        setCalendarSearchQuery("");
                      }
                    }}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="flex-1 h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-left font-normal shadow-sm hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className={selectedCalendar ? "text-foreground" : "text-muted-foreground"}>
                          {selectedCalendar 
                            ? (calendars.find(c => c.id === selectedCalendar)?.name || 'Select calendar')
                            : 'Select calendar'}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <div className="p-2">
                        <div className="relative mb-2">
                          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            placeholder="Search calendar..."
                            value={calendarSearchQuery}
                            onChange={(e) => setCalendarSearchQuery(e.target.value)}
                            className="pl-8 h-8"
                            autoFocus
                          />
                        </div>
                        <ScrollArea className="h-[200px]">
                          {calendars.filter(cal => 
                            cal.name.toLowerCase().includes(calendarSearchQuery.toLowerCase())
                          ).length === 0 ? (
                            <div className="text-center py-8 text-sm text-gray-500">
                              No options found.
                            </div>
                          ) : (
                            <div className="space-y-0">
                              {calendars.filter(cal => 
                                cal.name.toLowerCase().includes(calendarSearchQuery.toLowerCase())
                              ).map((cal) => (
                                <button
                                  key={cal.id}
                                  onClick={() => {
                                    setSelectedCalendar(cal.id);
                                    setCalendarSearchQuery("");
                                    setIsCalendarDropdownOpen(false);
                                    onUpdateNodeData?.(node.id, { config: { ...node.data?.config, calendarId: cal.id } });
                                  }}
                                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-md ${
                                    selectedCalendar === cal.id ? 'bg-gray-100' : ''
                                  }`}
                                >
                                  {cal.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </ScrollArea>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={async () => {
                      if (!selectedConnection) {
                        toast({ 
                          variant: "destructive",
                          title: "Error", 
                          description: "Please select a connection first." 
                        });
                        return;
                      }
                      try {
                        const res = await apiRequest('GET', `/api/integrations/google-calendar/calendars?connectionId=${selectedConnection}`);
                        const data = await res.json();
                        setCalendars(data.calendars || []);
                        toast({ title: "Synced", description: "Calendars refreshed successfully." });
                      } catch (error) {
                        toast({ 
                          variant: "destructive",
                          title: "Error", 
                          description: "Failed to sync calendars." 
                        });
                      }
                    }}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Choose which calendar to monitor for new events.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Drive Section - for Google Sheets triggers and actions */}
      {(node.type === 'trigger' && (node.data?.selectedTrigger === 'new-spreadsheets' || node.data?.selectedTrigger === 'new-worksheets' || node.data?.selectedTrigger === 'new-spreadsheet-rows') || isGoogleSheetsAction) && selectedAppName === 'google-sheets' && (
        <div className="border border-gray-200 rounded-lg bg-white">
          <button
            onClick={() => setIsDriveOpen(!isDriveOpen)}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-50"
          >
            <span className="font-medium text-sm">Drive</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${isDriveOpen ? '' : '-rotate-90'}`} />
          </button>
          {isDriveOpen && (
            <div className="p-3 pt-4 space-y-3 border-t border-gray-200">
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Select drive</label>
                <div className="flex gap-2">
                  <Popover 
                    open={isDriveDropdownOpen} 
                    onOpenChange={(open) => {
                      setIsDriveDropdownOpen(open);
                      if (!open) {
                        setDriveSearchQuery("");
                      }
                    }}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="flex-1 h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-left font-normal shadow-sm hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className={selectedDrive ? "text-foreground" : "text-muted-foreground"}>
                          {selectedDrive 
                            ? (drives.find(d => d.id === selectedDrive)?.name || 'Select drive')
                            : 'Select drive'}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <div className="p-2">
                        <div className="relative mb-2">
                          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            placeholder="Search drive..."
                            value={driveSearchQuery}
                            onChange={(e) => setDriveSearchQuery(e.target.value)}
                            className="pl-8 h-8"
                            autoFocus
                          />
                        </div>
                        <ScrollArea className="h-[200px]">
                          {drives.filter(drive => 
                            drive.name.toLowerCase().includes(driveSearchQuery.toLowerCase())
                          ).length === 0 ? (
                            <div className="text-center py-8 text-sm text-gray-500">
                              No options found.
                            </div>
                          ) : (
                            <div className="space-y-0">
                              {drives.filter(drive => 
                                drive.name.toLowerCase().includes(driveSearchQuery.toLowerCase())
                              ).map((drive) => (
                                <button
                                  key={drive.id}
                                  onClick={() => {
                                    setSelectedDrive(drive.id);
                                    setDriveSearchQuery("");
                                    setIsDriveDropdownOpen(false);
                                    onUpdateNodeData?.(node.id, { config: { ...node.data?.config, driveId: drive.id } });
                                  }}
                                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-md ${
                                    selectedDrive === drive.id ? 'bg-gray-100' : ''
                                  }`}
                                >
                                  {drive.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </ScrollArea>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={async () => {
                      if (!selectedConnection) {
                        toast({ 
                          variant: "destructive",
                          title: "Error", 
                          description: "Please select a connection first." 
                        });
                        return;
                      }
                      try {
                        const res = await apiRequest('GET', `/api/integrations/google-sheets/drives?connectionId=${selectedConnection}`);
                        const data = await res.json();
                        setDrives(data.drives || []);
                        toast({ title: "Synced", description: "Drives refreshed successfully." });
                      } catch (error) {
                        toast({ 
                          variant: "destructive",
                          title: "Error", 
                          description: "Failed to sync drives." 
                        });
                      }
                    }}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">The Google Drive where your spreadsheet resides. If nothing is selected, then your personal Google Drive will be used.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Optional template spreadsheet when creating a new file */}
      {isGoogleSheetsAction && node.data?.selectedActionId === 'create-spreadsheet' && selectedAppName === 'google-sheets' && (
        <div className="border border-gray-200 rounded-lg bg-white">
          <div className="p-3 space-y-3">
            <span className="font-medium text-sm block">Spreadsheet to copy</span>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Select spreadsheet to copy</label>
              <div className="flex gap-2">
                <Popover
                  open={isCopySpreadsheetDropdownOpen}
                  onOpenChange={(open) => {
                    setIsCopySpreadsheetDropdownOpen(open);
                    if (!open) setCopySpreadsheetSearchQuery("");
                  }}
                >
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex-1 h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-left font-normal shadow-sm hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className={copySpreadsheetId ? "text-foreground" : "text-muted-foreground"}>
                        {copySpreadsheetId
                          ? (spreadsheets.find((s) => s.id === copySpreadsheetId)?.name || "Selected")
                          : "Optional — duplicate an existing spreadsheet"}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <div className="p-2">
                      <div className="relative mb-2">
                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Search spreadsheet..."
                          value={copySpreadsheetSearchQuery}
                          onChange={(e) => setCopySpreadsheetSearchQuery(e.target.value)}
                          className="pl-8 h-8"
                          autoFocus
                        />
                      </div>
                      <ScrollArea className="h-[200px]">
                        <button
                          type="button"
                          onClick={() => {
                            setCopySpreadsheetId("");
                            setIsCopySpreadsheetDropdownOpen(false);
                            onUpdateNodeData?.(node.id, { config: { ...node.data?.config, copySpreadsheetId: "" } });
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-md"
                        >
                          None (blank spreadsheet)
                        </button>
                        {spreadsheets
                          .filter((s) => s.name.toLowerCase().includes(copySpreadsheetSearchQuery.toLowerCase()))
                          .map((spreadsheet) => (
                            <button
                              key={spreadsheet.id}
                              type="button"
                              onClick={() => {
                                setCopySpreadsheetId(spreadsheet.id);
                                setCopySpreadsheetSearchQuery("");
                                setIsCopySpreadsheetDropdownOpen(false);
                                onUpdateNodeData?.(node.id, {
                                  config: { ...node.data?.config, copySpreadsheetId: spreadsheet.id },
                                });
                              }}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-md ${
                                copySpreadsheetId === spreadsheet.id ? "bg-gray-100" : ""
                              }`}
                            >
                              {spreadsheet.name}
                            </button>
                          ))}
                      </ScrollArea>
                    </div>
                  </PopoverContent>
                </Popover>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    if (!selectedConnection || !selectedDrive) {
                      toast({
                        variant: "destructive",
                        title: "Error",
                        description: "Please select a connection and drive first.",
                      });
                      return;
                    }
                    try {
                      const res = await apiRequest(
                        "GET",
                        `/api/integrations/google-sheets/spreadsheets?connectionId=${selectedConnection}&driveId=${selectedDrive}`
                      );
                      const data = await res.json();
                      setSpreadsheets(data.spreadsheets || []);
                      toast({ title: "Synced", description: "Spreadsheets refreshed successfully." });
                    } catch {
                      toast({ variant: "destructive", title: "Error", description: "Failed to sync spreadsheets." });
                    }
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Choose a spreadsheet to duplicate as a template, or leave blank for an empty file.</p>
            </div>
          </div>
        </div>
      )}

      {/* Spreadsheet Section - for Google Sheets triggers and actions */}
      {((node.type === 'trigger' && (node.data?.selectedTrigger === 'new-worksheets' || node.data?.selectedTrigger === 'new-spreadsheet-rows')) || (isGoogleSheetsAction && GOOGLE_SHEETS_TARGET_SPREADSHEET_ACTIONS.has(node.data?.selectedActionId || ''))) && selectedAppName === 'google-sheets' && (
        <div className="border border-gray-200 rounded-lg bg-white">
          <button
            onClick={() => setIsSpreadsheetOpen(!isSpreadsheetOpen)}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-50"
          >
            <span className="font-medium text-sm">Spreadsheet *</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${isSpreadsheetOpen ? '' : '-rotate-90'}`} />
          </button>
          {isSpreadsheetOpen && (
            <div className="p-3 pt-4 space-y-3 border-t border-gray-200">
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Select spreadsheet</label>
                <div className="flex gap-2">
                  <Popover 
                    open={isSpreadsheetDropdownOpen} 
                    onOpenChange={(open) => {
                      setIsSpreadsheetDropdownOpen(open);
                      if (!open) {
                        setSpreadsheetSearchQuery("");
                      }
                    }}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="flex-1 h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-left font-normal shadow-sm hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className={selectedSpreadsheet ? "text-foreground" : "text-muted-foreground"}>
                          {selectedSpreadsheet 
                            ? (spreadsheets.find(s => s.id === selectedSpreadsheet)?.name || 'Select spreadsheet')
                            : 'Select spreadsheet'}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <div className="p-2">
                        <div className="relative mb-2">
                          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            placeholder="Search spreadsheet..."
                            value={spreadsheetSearchQuery}
                            onChange={(e) => setSpreadsheetSearchQuery(e.target.value)}
                            className="pl-8 h-8"
                            autoFocus
                          />
                        </div>
                        <ScrollArea className="h-[200px]">
                          {spreadsheets.filter(spreadsheet => 
                            spreadsheet.name.toLowerCase().includes(spreadsheetSearchQuery.toLowerCase())
                          ).length === 0 ? (
                            <div className="text-center py-8 text-sm text-gray-500">
                              No options found.
                            </div>
                          ) : (
                            <div className="space-y-0">
                              {spreadsheets.filter(spreadsheet => 
                                spreadsheet.name.toLowerCase().includes(spreadsheetSearchQuery.toLowerCase())
                              ).map((spreadsheet) => (
                                <button
                                  key={spreadsheet.id}
                                  onClick={() => {
                                    setSelectedSpreadsheet(spreadsheet.id);
                                    setSpreadsheetSearchQuery("");
                                    setIsSpreadsheetDropdownOpen(false);
                                    onUpdateNodeData?.(node.id, { config: { ...node.data?.config, spreadsheetId: spreadsheet.id } });
                                  }}
                                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-md ${
                                    selectedSpreadsheet === spreadsheet.id ? 'bg-gray-100' : ''
                                  }`}
                                >
                                  {spreadsheet.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </ScrollArea>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={async () => {
                      if (!selectedConnection || !selectedDrive) {
                        toast({ 
                          variant: "destructive",
                          title: "Error", 
                          description: "Please select a connection and drive first." 
                        });
                        return;
                      }
                      try {
                        const res = await apiRequest('GET', `/api/integrations/google-sheets/spreadsheets?connectionId=${selectedConnection}&driveId=${selectedDrive}`);
                        const data = await res.json();
                        setSpreadsheets(data.spreadsheets || []);
                        toast({ title: "Synced", description: "Spreadsheets refreshed successfully." });
                      } catch (error) {
                        toast({ 
                          variant: "destructive",
                          title: "Error", 
                          description: "Failed to sync spreadsheets." 
                        });
                      }
                    }}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">The spreadsheets in your Google Drive.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Worksheet Section - for Google Sheets triggers and actions */}
      {((node.type === 'trigger' && node.data?.selectedTrigger === 'new-spreadsheet-rows') || (isGoogleSheetsAction && ['create-spreadsheet-row', 'find-row', 'update-row'].includes(node.data?.selectedActionId || ''))) && selectedAppName === 'google-sheets' && (
        <div className="border border-gray-200 rounded-lg bg-white">
          <button
            onClick={() => setIsWorksheetOpen(!isWorksheetOpen)}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-50"
          >
            <span className="font-medium text-sm">Worksheet *</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${isWorksheetOpen ? '' : '-rotate-90'}`} />
          </button>
          {isWorksheetOpen && (
            <div className="p-3 pt-4 space-y-3 border-t border-gray-200">
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Select worksheet</label>
                <div className="flex gap-2">
                  <Popover 
                    open={isWorksheetDropdownOpen} 
                    onOpenChange={(open) => {
                      setIsWorksheetDropdownOpen(open);
                      if (!open) {
                        setWorksheetSearchQuery("");
                      }
                    }}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="flex-1 h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-left font-normal shadow-sm hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className={selectedWorksheet ? "text-foreground" : "text-muted-foreground"}>
                          {selectedWorksheet 
                            ? (worksheets.find(w => w.id === selectedWorksheet)?.name || 'Select worksheet')
                            : 'Select worksheet'}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <div className="p-2">
                        <div className="relative mb-2">
                          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            placeholder="Search worksheet..."
                            value={worksheetSearchQuery}
                            onChange={(e) => setWorksheetSearchQuery(e.target.value)}
                            className="pl-8 h-8"
                            autoFocus
                          />
                        </div>
                        <ScrollArea className="h-[200px]">
                          {worksheets.filter(worksheet => 
                            worksheet.name.toLowerCase().includes(worksheetSearchQuery.toLowerCase())
                          ).length === 0 ? (
                            <div className="text-center py-8 text-sm text-gray-500">
                              No options found.
                            </div>
                          ) : (
                            <div className="space-y-0">
                              {worksheets.filter(worksheet => 
                                worksheet.name.toLowerCase().includes(worksheetSearchQuery.toLowerCase())
                              ).map((worksheet) => (
                                <button
                                  key={worksheet.id}
                                  onClick={() => {
                                    setSelectedWorksheet(worksheet.id);
                                    setWorksheetSearchQuery("");
                                    setIsWorksheetDropdownOpen(false);
                                    onUpdateNodeData?.(node.id, { config: { ...node.data?.config, worksheetId: worksheet.id } });
                                  }}
                                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-md ${
                                    selectedWorksheet === worksheet.id ? 'bg-gray-100' : ''
                                  }`}
                                >
                                  {worksheet.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </ScrollArea>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={async () => {
                      if (!selectedConnection || !selectedSpreadsheet) {
                        toast({ 
                          variant: "destructive",
                          title: "Error", 
                          description: "Please select a connection and spreadsheet first." 
                        });
                        return;
                      }
                      try {
                        const res = await apiRequest('GET', `/api/integrations/google-sheets/worksheets?connectionId=${selectedConnection}&spreadsheetId=${selectedSpreadsheet}`);
                        const data = await res.json();
                        setWorksheets(data.worksheets || []);
                        toast({ title: "Synced", description: "Worksheets refreshed successfully." });
                      } catch (error) {
                        toast({ 
                          variant: "destructive",
                          title: "Error", 
                          description: "Failed to sync worksheets." 
                        });
                      }
                    }}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">The worksheets in your selected spreadsheet. You must have column headers.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {isGoogleSheetsAction &&
        selectedAppName === "google-sheets" &&
        GOOGLE_SHEETS_ACTIONS.some((a) => a.id === node.data?.selectedActionId) && (
          <GoogleSheetsActionExtraFields
            actionId={String(node.data?.selectedActionId || "")}
            config={(node.data?.config || {}) as Record<string, unknown>}
            applyConfigPatch={(patch) =>
              onUpdateNodeData?.(node.id, { config: { ...(node.data?.config || {}), ...patch } })
            }
            connectionId={selectedConnection}
            spreadsheetId={selectedSpreadsheet}
            worksheetId={selectedWorksheet}
            variant="canvas"
          />
        )}

      {/* Contact triggers — internal CRM events; no external webhook URL needed */}
      {isContactCanvasTrigger && (
        <div className="border border-blue-200 rounded-lg bg-blue-50/60 p-3 space-y-1">
          <p className="text-xs text-blue-950 leading-snug">
            <strong>{node.data?.selectedTrigger === 'new-contact' ? 'New Contact' : 'Contact Updated'}</strong> runs
            automatically inside this panel when a CRM contact is created or edited. You do <strong>not</strong> need
            to paste a webhook URL in Shopify or elsewhere.
          </p>
          {node.data?.selectedTrigger === 'contact-updated' ? (
            <p className="text-xs text-blue-900/90 leading-snug">
              Fires when name, phone, email, notes, source, or custom fields change in Contacts or Inbox (saved to CRM).
              Tag-only or assign-only changes do not trigger this flow. The flow must be <strong>Published</strong>.
            </p>
          ) : null}
        </div>
      )}

      {/* Google Sheets row trigger — polled by our server; no external webhook URL */}
      {isGoogleSheetsRowTrigger && (
        <div className="border border-emerald-200 rounded-lg bg-emerald-50/60 p-3 space-y-1">
          <p className="text-xs text-emerald-950 leading-snug">
            <strong>New spreadsheet rows</strong> does <strong>not</strong> use a webhook URL (nothing to paste in
            Google). This panel checks your sheet every ~2 minutes, reads new rows at the bottom, and runs the flow.
          </p>
          <p className="text-xs text-emerald-900/90 leading-snug">
            Connect <strong>Google Sheets</strong>, select <strong>spreadsheet + worksheet</strong> below, then{" "}
            <strong>Publish</strong> the flow. The first check only records the current row count — add a{" "}
            <strong>new row after publishing</strong> to test. Use <strong>Insert variable</strong> on Send Template for
            column values (e.g. <code className="text-[10px] bg-emerald-100/80 px-0.5 rounded">{"{{trigger.phone}}"}</code>
            ).
          </p>
        </div>
      )}

      {/* Webhook URL — only for external integrations (Shopify, raw webhook, etc.) */}
      {showExternalWebhookUrl && (
        <div className="border border-gray-200 rounded-lg bg-white">
          <button
            onClick={() => setIsWebhookOpen(!isWebhookOpen)}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-50"
          >
            <span className="font-medium text-sm">Webhook</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${isWebhookOpen ? '' : '-rotate-90'}`} />
          </button>
          {isWebhookOpen && (
            <div className="p-3 pt-4 space-y-3 border-t border-gray-200">
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Webhook URL</label>
                <div className="flex gap-2">
                  <Input 
                    value={`${import.meta.env.VITE_BASE_URL || window.location.origin}/api/v2/webhook/flows/${flowId}`}
                    readOnly
                    className="flex-1 text-xs"
                  />
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      const webhookUrl = `${import.meta.env.VITE_BASE_URL || window.location.origin}/api/v2/webhook/flows/${flowId}`;
                      navigator.clipboard.writeText(webhookUrl);
                      toast({ title: "Copied", description: "Webhook URL copied to clipboard." });
                    }}
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Paste this URL in Shopify (Settings → Notifications → Webhooks) or any service. The flow must be{" "}
                  <strong>Published</strong>. Shopify sends <code className="text-[10px] bg-muted px-0.5 rounded">X-Shopify-Topic</code>{" "}
                  automatically — pick the matching trigger above (e.g. New Order).
                </p>
                {selectedAppName === "shopify" && node.data?.selectedTrigger ? (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2 mt-2 leading-snug">
                    <strong>Shopify Admin webhook:</strong>{" "}
                    {SHOPIFY_TRIGGER_ADMIN_EVENT_LABELS[String(node.data.selectedTrigger)] ||
                      "matching event"}{" "}
                    → topic{" "}
                    <code className="text-[10px] bg-amber-100/80 px-0.5 rounded">
                      {SHOPIFY_TRIGGER_WEBHOOK_TOPICS[String(node.data.selectedTrigger)] ||
                        "matching your trigger"}
                    </code>
                    . Use public HTTPS (not localhost). Or register all topics via Integrations → Shopify
                    webhook:{" "}
                    <code className="text-[10px] break-all">
                      /api/webhooks/shopify/&lt;integrationId&gt;
                    </code>
                    .
                    {String(node.data.selectedTrigger) === "new-abandoned-checkout" ? (
                      <>
                        {" "}
                        Abandoned cart needs a phone on the checkout; completed checkouts are skipped.
                      </>
                    ) : null}
                    {["new-order", "new-paid-order", "new-cancelled-order", "new-customer"].includes(
                      String(node.data.selectedTrigger)
                    ) ? (
                      <> WhatsApp actions need {"{{trigger.phone}}"} on the order/customer.</>
                    ) : null}
                  </p>
                ) : null}
                {selectedAppName === "woocommerce" && node.data?.selectedTrigger ? (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2 mt-2 leading-snug">
                    <strong>WooCommerce:</strong> In Settings → Advanced → Webhooks, set topic{" "}
                    <code className="text-[10px] bg-amber-100/80 px-0.5 rounded">
                      {WOOCOMMERCE_TRIGGER_WEBHOOK_TOPICS[String(node.data.selectedTrigger)] ||
                        "matching your trigger"}
                    </code>{" "}
                    and delivery URL from Integrations:{" "}
                    <code className="text-[10px] break-all">/api/webhooks/woocommerce/&lt;integrationId&gt;</code>.
                    Flow must be <strong>Published</strong>. Use HTTPS — <code className="text-[10px]">localhost</code> will not receive webhooks.
                  </p>
                ) : null}
                {node.data?.selectedTrigger === "catch-raw-webhook" ? (
                  <p className="text-xs text-gray-500 mt-2">
                    Paste this URL in Make.com (HTTP POST, JSON body). Opening the URL in a browser should show{" "}
                    <strong>Ok</strong>. Flow must be <strong>Published</strong>. Map fields as{" "}
                    <code className="text-[10px] bg-muted px-0.5 rounded">{"{{trigger.name}}"}</code>,{" "}
                    <code className="text-[10px] bg-muted px-0.5 rounded">{"{{trigger.mobile}}"}</code>,{" "}
                    <code className="text-[10px] bg-muted px-0.5 rounded">{"{{raw}}"}</code>. Click{" "}
                    <strong>Run Test</strong> below for sample output.
                  </p>
                ) : null}

                {node.data?.selectedTrigger ? (
                  <div className="mt-3 space-y-2 rounded-md border border-sky-200 bg-sky-50/80 p-2.5">
                    <p className="text-xs font-medium text-sky-950">Test with Postman / curl</p>
                    <p className="text-[11px] text-sky-900/90 leading-snug">
                      Sample payload matches this trigger. Publish the flow, then POST to the webhook URL with the
                      copied headers + body. Or use <strong>Send test now</strong> from here.
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] bg-white"
                        disabled={isWebhookTestBusy}
                        onClick={() => handleCopyWebhookTestPayload("body")}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy body
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] bg-white"
                        disabled={isWebhookTestBusy}
                        onClick={() => handleCopyWebhookTestPayload("headers")}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy headers
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] bg-white"
                        disabled={isWebhookTestBusy}
                        onClick={() => handleCopyWebhookTestPayload("curl")}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy cURL
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] bg-white"
                        disabled={isWebhookTestBusy}
                        onClick={() => handleCopyWebhookTestPayload("postman")}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Postman JSON
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-[11px]"
                        disabled={isWebhookTestBusy}
                        onClick={handleSendTestWebhook}
                      >
                        {isWebhookTestBusy ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Zap className="h-3 w-3 mr-1" />
                        )}
                        Send test now
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Test Results Section */}
      <div className="border border-gray-200 rounded-lg bg-white">
        <button
          onClick={() => setIsTestResultsOpen(!isTestResultsOpen)}
          className="w-full flex items-center justify-between p-3 hover:bg-gray-50"
        >
          <span className="font-medium text-sm">Test Results</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${isTestResultsOpen ? '' : '-rotate-90'}`} />
        </button>
        {isTestResultsOpen && (
          <div className="p-3 pt-4 space-y-3 border-t border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex gap-2 border-b border-gray-200">
                <button 
                  onClick={() => setTestResultsTab('input')}
                  className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                    testResultsTab === 'input' 
                      ? 'border-gray-900 text-gray-900' 
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Input
                </button>
                <button 
                  onClick={() => setTestResultsTab('output')}
                  className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                    testResultsTab === 'output' 
                      ? 'border-gray-900 text-gray-900' 
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Output
                </button>
                <button 
                  onClick={() => setTestResultsTab('errors')}
                  className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                    testResultsTab === 'errors' 
                      ? 'border-gray-900 text-gray-900' 
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Errors
                </button>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleRunTest}
                disabled={isTestRunning}
                className="ml-auto"
              >
                {isTestRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Running...
                  </>
                ) : (
                  'Run Test'
                )}
              </Button>
            </div>
            <div className="min-h-[100px] max-h-[300px] overflow-auto">
              {testResultsTab === 'input' && (
                <div className="text-sm">
                  {testInput ? (
                    <pre className="bg-gray-50 p-3 rounded-md text-xs overflow-auto">{testInput}</pre>
                  ) : (
                    <p className="text-sm text-gray-500 py-4">No input data available</p>
                  )}
                </div>
              )}
              {testResultsTab === 'output' && (
                <div className="text-sm">
                  {testOutput ? (
                    <pre className="bg-gray-50 p-3 rounded-md text-xs overflow-auto">{testOutput}</pre>
                  ) : (
                    <p className="text-sm text-gray-500 py-4">No output data available</p>
                  )}
                </div>
              )}
              {testResultsTab === 'errors' && (
                <div className="text-sm">
                  {testError ? (
                    <div className="bg-red-50 border border-red-200 rounded-md p-3">
                      <div className="flex items-start gap-2">
                        <span className="text-red-600 text-lg">⚠️</span>
                        <p className="text-sm text-red-800">{testError}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 py-4">No errors</p>
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500">Run a test to see the output data from this step.</p>
          </div>
        )}
      </div>

      {/* Connect Modal */}
      <Dialog open={isConnectModalOpen} onOpenChange={setIsConnectModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect</DialogTitle>
            <DialogDescription>
              {selectedAppName === 'calendly' 
                ? 'Enter your Calendly personal token to connect.'
                : selectedAppName.includes('google')
                ? `Enter your ${selectedAppName.replace('google-', '').replace('-', ' ')} OAuth credentials to connect.`
                : selectedAppName === 'whatsapp-business' || selectedAppName === 'whatsapp'
                ? 'Enter your WhatsApp Business API credentials to connect.'
                : selectedAppName === 'indiamart'
                ? 'Enter your IndiaMart connection details. A token will be auto-generated if you leave the API key empty.'
                : selectedAppName === 'zoom-webhook'
                ? 'Enter your Zoom webhook connection details.'
                : `Enter your ${selectedAppName} connection details.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="connection-name">Connection Name</Label>
              <Input
                id="connection-name"
                value={connectionName}
                onChange={(e) => setConnectionName(e.target.value)}
                placeholder={selectedAppName}
              />
            </div>
            {selectedAppName === 'calendly' ? (
              <div>
                <Label htmlFor="personal-token">Personal token *</Label>
                <Input
                  id="personal-token"
                  type="password"
                  value={personalToken}
                  onChange={(e) => setPersonalToken(e.target.value)}
                  placeholder="Your Calendly personal token"
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Personal token which should be retrieved from Calendly.
                </p>
              </div>
            ) : selectedAppName.includes('google') ? (
              <>
                <div>
                  <Label htmlFor="client-id">Client ID *</Label>
                  <Input
                    id="client-id"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="Your Google Client ID"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <Label htmlFor="client-secret">Client Secret *</Label>
                  <Input
                    id="client-secret"
                    type="password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder="Your Google Client Secret"
                    autoComplete="off"
                  />
                </div>
                {redirectUri && (
                  <div>
                    <Label htmlFor="redirect-uri">Redirect URI</Label>
                    <div className="flex gap-2">
                      <Input
                        id="redirect-uri"
                        value={redirectUri}
                        readOnly
                        className="flex-1 text-xs"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(redirectUri);
                          toast({ title: "Copied", description: "Redirect URI copied to clipboard." });
                        }}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : selectedAppName === 'zoom-webhook' ? (
              <div>
                <Label htmlFor="zoom-secret-token">Secret Token *</Label>
                <Input
                  id="zoom-secret-token"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Your Zoom webhook secret token"
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Secret token of your Zoom webhook.
                </p>
              </div>
            ) : selectedAppName === 'indiamart' ? (
              <div>
                <Label htmlFor="indiamart-api-key">API Key (optional)</Label>
                <Input
                  id="indiamart-api-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Your IndiaMart API key, or leave empty to auto-generate"
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Leave empty to auto-generate a webhook token. Or enter your IndiaMart API key if you have one.
                </p>
              </div>
            ) : (selectedAppName === 'whatsapp-business' || selectedAppName === 'whatsapp') ? (
              <>
                <div>
                  <Label htmlFor="api-key">API Key *</Label>
                  <Input
                    id="api-key"
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Your WhatsApp Business API Key"
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    API Key which should be retrieved from your Meta Business Suite Developer Account.
                  </p>
                </div>
                <div>
                  <Label htmlFor="phone-number-id">Phone Number ID *</Label>
                  <Input
                    id="phone-number-id"
                    value={phoneNumberId}
                    onChange={(e) => setPhoneNumberId(e.target.value)}
                    placeholder="Your WhatsApp Phone Number ID"
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Phone Number ID from your WhatsApp Business Account.
                  </p>
                </div>
                <div>
                  <Label htmlFor="business-account-id">Business Account ID *</Label>
                  <Input
                    id="business-account-id"
                    value={businessAccountId}
                    onChange={(e) => setBusinessAccountId(e.target.value)}
                    placeholder="Your WhatsApp Business Account ID"
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Business Account ID from your Meta Business Suite.
                  </p>
                </div>
              </>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConnectModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={
                selectedAppName === 'calendly' 
                  ? handleCalendlyConnect 
                  : (selectedAppName === 'whatsapp-business' || selectedAppName === 'whatsapp')
                  ? handleWhatsAppConnect
                  : selectedAppName === 'indiamart'
                  ? handleIndiamartConnect
                  : selectedAppName === 'zoom-webhook'
                  ? handleZoomWebhookConnect
                  : handleGoogleConnect
              }
              disabled={
                selectedAppName === 'calendly' 
                  ? (!personalToken?.trim() || connectPending)
                  : (selectedAppName === 'whatsapp-business' || selectedAppName === 'whatsapp')
                  ? (!apiKey?.trim() || !phoneNumberId?.trim() || !businessAccountId?.trim() || connectPending)
                  : selectedAppName === 'indiamart'
                  ? connectPending
                  : selectedAppName === 'zoom-webhook'
                  ? (!apiKey?.trim() || connectPending)
                  : (!clientId?.trim() || !clientSecret?.trim() || connectPending)
              }
            >
              {connectPending ? (
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

      {/* Configure IndiaMart modal: Webhook URL, setup steps, token (same as integrations/indiamart page) */}
      <Dialog open={isIndiaMartConfigureOpen} onOpenChange={setIsIndiaMartConfigureOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configure IndiaMart</DialogTitle>
            <DialogDescription>
              Set up real-time lead notifications using IndiaMart&apos;s Push API integration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            {/* Webhook URL */}
            <div className="space-y-2">
              <Label>Webhook URL</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={indiaMartWebhookUrl || "Configure integration first"}
                  className="flex-1 bg-muted font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={copyIndiaMartWebhookUrl}
                  disabled={!indiaMartWebhookUrl}
                  title="Copy URL"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Copy this URL and paste it in your IndiaMart Seller Central account settings.
              </p>
            </div>

            {/* Push API Setup Steps */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Push API Setup Steps</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>Log in to your IndiaMart Seller Central account</li>
                <li>Navigate to Lead Manager → Settings → Integration Settings</li>
                <li>Select &quot;Push API Integration&quot;</li>
                <li>Copy and paste the webhook URL shown above</li>
                <li>Click on &quot;Test URL&quot; to verify the connection</li>
                <li>Save the settings to start receiving real-time leads</li>
              </ol>
            </div>

            {/* Token */}
            <div className="space-y-2 pt-4 border-t">
              <Label htmlFor="indiamart-token">Token</Label>
              <div className="flex gap-2 flex-wrap">
                <Input
                  id="indiamart-token"
                  readOnly
                  type="password"
                  value={indiaMartToken}
                  className="flex-1 min-w-[200px] bg-muted font-mono text-sm"
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleIndiaMartRegenerateToken}
                  disabled={indiaMartRegeneratePending}
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
              <p className="text-xs text-muted-foreground">
                This token is used to authenticate webhook requests from IndiaMart.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsIndiaMartConfigureOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => setIsIndiaMartConfigureOpen(false)}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </>
      )}
    </div>
  );
}

function FlowConfigurationPanel({ flow, name }: { flow: AutomationFlow | null; name: string }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold mb-4">Flow Configuration</h2>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-600 mb-1 block">Flow Name</label>
          <Input value={name || ''} readOnly className="text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-600 mb-1 block">Status</label>
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            {flow?.status === "draft" ? "Draft" : flow?.status === "active" ? "Active" : "Inactive"}
          </Badge>
        </div>
        <p className="text-xs text-gray-500 mt-4">
          Select a node to configure its settings, or edit the flow properties above.
        </p>
      </div>
    </div>
  );
}

export default function FlowEditPage() {
  const [, params] = useRoute("/flows/edit/:flowId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const flowId = params?.flowId;

  const { data: flowData, isLoading: flowLoading } = useQuery<AutomationFlow | null>({
    queryKey: ["/api/automation-flows", flowId],
    queryFn: async () => {
      if (!flowId) return null;
      try {
        const res = await apiRequest("GET", `/api/automation-flows/${flowId}`);
        return res.json();
      } catch {
        return null;
      }
    },
    enabled: !!flowId,
  });

  const [flow, setFlow] = useState<AutomationFlow | null>(null);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<FlowStatus>("draft");
  const [showAppModal, setShowAppModal] = useState(false);
  const [appSearchQuery, setAppSearchQuery] = useState("");
  const [showMinimap, setShowMinimap] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null);
  const reactFlowWrapperRef = useRef<HTMLDivElement>(null);
  const flowContainerRef = useRef<HTMLDivElement>(null);
  const hasLoadedFlowFromApiRef = useRef(false);
  const hasFitViewOnLoadRef = useRef(false);

  // Get user's connected integrations
  const { data: integrations = [] } = useQuery<Array<{ name: string; displayName: string; status: string }>>({
    queryKey: ['/api/integrations'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/integrations');
      return await res.json();
    },
  });

  // Initialize nodes and edges (use flowData for initial load since flow state updates async)
  const getInitialNodes = (f: AutomationFlow | null): Node[] => {
    if (f?.nodes && f.nodes.length > 0) {
      return f.nodes.map(n => ({
        ...n,
        type: n.type || 'trigger',
        width: n.width || 280,
        height: n.height || 120,
        data: { ...n.data },
      }));
    }
    return [{
      id: 'trigger-1',
      type: 'trigger',
      position: { x: 500, y: 300 },
      width: 280,
      height: 120,
      data: { selectedApp: null, appIcon: null },
    }];
  };

  const initialNodes: Node[] = getInitialNodes(flowData ?? flow);
  const initialEdges: Edge[] = (flowData ?? flow)?.edges || [];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const edgesRef = useRef<Edge[]>(initialEdges);
  const nodesRef = useRef<Node[]>(initialNodes);
  const lastAutosavedGraphRef = useRef<string | null>(null);
  const isInsertingChildRef = useRef<boolean>(false);
  const [minimapReady, setMinimapReady] = useState(false);
  const [selectedNodeForConfig, setSelectedNodeForConfig] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const [mobileConfigOpen, setMobileConfigOpen] = useState(false);
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [pendingAppForTrigger, setPendingAppForTrigger] = useState<{ app: typeof AVAILABLE_APPS[0]; nodeId: string | null } | null>(null);
  const [triggerSearchQuery, setTriggerSearchQuery] = useState("");
  const [showActionModal, setShowActionModal] = useState(false);
  const [pendingAppForAction, setPendingAppForAction] = useState<{ app: typeof AVAILABLE_APPS[0]; nodeId: string | null } | null>(null);
  const [actionSearchQuery, setActionSearchQuery] = useState("");
  
  // Keep edgesRef / nodesRef in sync for stable handler callbacks
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    hasLoadedFlowFromApiRef.current = false;
    hasFitViewOnLoadRef.current = false;
    lastAutosavedGraphRef.current = null;
    setSelectedNodeId(null);
  }, [flowId]);

  // Select trigger node after canvas is ready (defers heavy config panel mount; skip on mobile so canvas stays full width)
  useEffect(() => {
    if (isMobile) return;
    if (!hasLoadedFlowFromApiRef.current || nodes.length === 0 || selectedNodeId !== null) return;
    const triggerNode = nodes.find((n) => n.type === "trigger");
    if (!triggerNode) return;
    const t = window.setTimeout(() => setSelectedNodeId(triggerNode.id), 0);
    return () => window.clearTimeout(t);
  }, [flowId, nodes.length, selectedNodeId, isMobile]);

  const handleConfigureTrigger = useCallback((nodeId?: string) => {
    // Open the app selection modal to configure the trigger
    if (nodeId) {
      setSelectedNodeForConfig(nodeId);
    }
    setShowAppModal(true);
    toast({ title: "Configure Trigger", description: "Select an app to configure the trigger." });
  }, [toast]);

  const handleConfigureAction = useCallback((nodeId?: string) => {
    if (nodeId) {
      const node = nodesRef.current.find(n => n.id === nodeId);
      if (node?.type === 'router') {
        setSelectedNodeId(nodeId);
        setSelectedNodeForConfig(nodeId);
        return;
      }
      setSelectedNodeForConfig(nodeId);
    }
    setShowAppModal(true);
    toast({ title: "Configure Action", description: "Select an action to configure." });
  }, [toast]);

  // When reconfiguring an action that's already WhatsApp or Google Sheets - open action modal directly
  const handleReconfigureAction = useCallback((nodeId: string) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    const isWhatsAppAction = (node?.data?.selectedActionId && WHATSAPP_ACTIONS.some(a => a.id === node.data.selectedActionId)) ||
      WHATSAPP_ACTIONS.some(a => a.name === node?.data?.selectedAction);
    const isGoogleSheetsAction = (node?.data?.selectedActionId && GOOGLE_SHEETS_ACTIONS.some(a => a.id === node.data.selectedActionId)) ||
      GOOGLE_SHEETS_ACTIONS.some(a => a.name === node?.data?.selectedAction);
    const isCalendlyAction = (node?.data?.selectedActionId && CALENDLY_ACTIONS.some(a => a.id === node.data.selectedActionId)) ||
      CALENDLY_ACTIONS.some(a => a.name === node?.data?.selectedAction);
    const isContactAction = (node?.data?.selectedActionId && CONTACT_ACTIONS.some(a => a.id === node.data.selectedActionId)) ||
      CONTACT_ACTIONS.some(a => a.name === node?.data?.selectedAction);
    const isRouterNode = node?.type === 'router';
    const isDelayAction =
      DELAY_ACTIONS.some((a) => a.id === node?.data?.selectedActionId) ||
      String(node?.data?.selectedAction || '').toLowerCase().includes('delay');
    if (isRouterNode || isDelayAction) {
      setSelectedNodeId(nodeId);
      setSelectedNodeForConfig(nodeId);
      return;
    }
    if (isWhatsAppAction) {
      setSelectedNodeForConfig(nodeId);
      setPendingAppForAction({ app: { id: "whatsapp", name: "WhatsApp", icon: INTEGRATION_ICONS["whatsapp"] }, nodeId });
      setShowActionModal(true);
    } else if (isGoogleSheetsAction) {
      setSelectedNodeForConfig(nodeId);
      setPendingAppForAction({ app: { id: "google-sheets", name: "Google Sheets", icon: INTEGRATION_ICONS["google-sheets"] }, nodeId });
      setShowActionModal(true);
    } else if (isCalendlyAction) {
      setSelectedNodeForConfig(nodeId);
      setPendingAppForAction({ app: { id: "calendly", name: "Calendly", icon: INTEGRATION_ICONS["calendly"] }, nodeId });
      setShowActionModal(true);
    } else if (isContactAction) {
      setSelectedNodeForConfig(nodeId);
      setPendingAppForAction({ app: { id: "contact-helicopticsolutions", name: "Contact", icon: null }, nodeId });
      setShowActionModal(true);
    } else if ((node?.data?.selectedActionId && OPENAI_ACTIONS.some(a => a.id === node.data.selectedActionId)) || node?.data?.selectedAction === 'Chat completion' || node?.data?.selectedAction === 'Generate text') {
      setSelectedNodeForConfig(nodeId);
      setPendingAppForAction({ app: { id: "openai", name: "OpenAI", icon: INTEGRATION_ICONS["openai"] }, nodeId });
      setShowActionModal(true);
    } else if ((node?.data?.selectedActionId && GOOGLE_GEMINI_ACTIONS.some(a => a.id === node.data.selectedActionId)) || node?.data?.selectedAction === 'Generate content' || node?.data?.selectedAction === 'Chat') {
      setSelectedNodeForConfig(nodeId);
      setPendingAppForAction({ app: { id: "google-gemini", name: "Google Gemini", icon: INTEGRATION_ICONS["google-gemini"] }, nodeId });
      setShowActionModal(true);
    } else if ((node?.data?.selectedActionId && GOOGLE_CALENDAR_ACTIONS.some(a => a.id === node.data.selectedActionId))) {
      setSelectedNodeForConfig(nodeId);
      setPendingAppForAction({ app: { id: "google-calendar", name: "Google Calendar", icon: INTEGRATION_ICONS["google-calendar"] }, nodeId });
      setShowActionModal(true);
    } else if ((node?.data?.selectedActionId && GOOGLE_CONTACTS_ACTIONS.some(a => a.id === node.data.selectedActionId))) {
      setSelectedNodeForConfig(nodeId);
      setPendingAppForAction({ app: { id: "google-contacts", name: "Google Contacts", icon: INTEGRATION_ICONS["google-contacts"] }, nodeId });
      setShowActionModal(true);
    } else {
      handleConfigureAction(nodeId);
    }
  }, [handleConfigureAction]);

  const handleReconfigureTrigger = useCallback((nodeId: string) => {
    const node = nodesRef.current.find((n) => n.id === nodeId);
    if (!node) return;
    setSelectedNodeId(nodeId);
    setSelectedNodeForConfig(nodeId);
    const app = resolveTriggerAppMeta(
      String(node.data?.selectedTrigger || ""),
      String(node.data?.selectedApp || "")
    );
    if (app && (TRIGGER_APPS_WITH_PICKER as readonly string[]).includes(app.id)) {
      setPendingAppForTrigger({ app, nodeId });
      setShowTriggerModal(true);
      return;
    }
    setShowAppModal(true);
  }, []);

  // Helper function to check if a node has a trigger ancestor
  const hasTriggerAncestor = useCallback((nodeId: string, nodes: Node[], edges: Edge[]): boolean => {
    const visited = new Set<string>();
    const checkAncestors = (currentNodeId: string): boolean => {
      if (visited.has(currentNodeId)) return false;
      visited.add(currentNodeId);
      
      // Find parent nodes (nodes that have an edge pointing to this node)
      const parentEdges = edges.filter(e => e.target === currentNodeId);
      
      for (const edge of parentEdges) {
        const parentNode = nodes.find(n => n.id === edge.source);
        if (!parentNode) continue;
        
        // If parent is a trigger, return true
        if (parentNode.type === 'trigger') {
          return true;
        }
        
        // Recursively check if parent has a trigger ancestor
        if (checkAncestors(parentNode.id)) {
          return true;
        }
      }
      
      return false;
    };
    
    return checkAncestors(nodeId);
  }, []);

  const handleDeleteNode = useCallback((nodeId: string) => {
    setSelectedNodeId((id) => (id === nodeId ? null : id));
    setSelectedNodeForConfig((id) => (id === nodeId ? null : id));
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    lastAutosavedGraphRef.current = null;
    toast({ title: "Node Deleted", description: "The node has been removed." });
  }, [setNodes, setEdges, toast]);

  flowNodeDeleteRef.current = handleDeleteNode;

  const handleRouterAddBranch = useCallback(
    (routerNodeId: string, branchId: string) => {
      const nds = nodesRef.current;
      const eds = edgesRef.current;
      const isChildOfTrigger = hasTriggerAncestor(routerNodeId, nds, eds);
      const graph = addRouterBranchGraph({
        routerNodeId,
        branchId,
        nodes: nds,
        edges: eds,
        isChildOfTrigger,
      });
      setNodes(graph.nodes);
      setEdges(graph.edges);
      lastAutosavedGraphRef.current = null;
    },
    [hasTriggerAncestor]
  );

  const handleRouterRemoveBranch = useCallback((routerNodeId: string, branchId: string) => {
    const graph = removeRouterBranchGraph({
      routerNodeId,
      branchId,
      nodes: nodesRef.current,
      edges: edgesRef.current,
    });
    setNodes(graph.nodes);
    setEdges(graph.edges);
    lastAutosavedGraphRef.current = null;
  }, []);

  const handleInsertChildNode = useCallback(
    (parentNodeId?: string) => {
      if (isInsertingChildRef.current) return;
      isInsertingChildRef.current = true;
      window.setTimeout(() => {
        isInsertingChildRef.current = false;
      }, 300);

      const nds = nodesRef.current;
      const currentEdges = edgesRef.current;
      const parentNode = parentNodeId
        ? nds.find((n) => n.id === parentNodeId)
        : nds.find((n) => n.type === "trigger" || n.type === "action");

      if (!parentNode) {
        toast({
          variant: "destructive",
          title: "Cannot add node",
          description: "Select a trigger or action node first.",
        });
        return;
      }

      const existingChildIds = currentEdges
        .filter((e) => e.source === parentNode.id)
        .map((e) => e.target);
      const existingChildren = existingChildIds
        .map((cid) => nds.find((n) => n.id === cid))
        .filter(Boolean) as Node[];

      const newNodeId = `action-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const verticalOffset = 220;
      const parentHasTriggerAncestor =
        parentNode.type === "trigger" ||
        hasTriggerAncestor(parentNode.id, nds, currentEdges);

      const newNode: Node = {
        id: newNodeId,
        type: "action",
        position: { x: parentNode.position.x, y: parentNode.position.y + verticalOffset },
        width: 280,
        height: 120,
        data: {
          selectedAction: null,
          actionIcon: null,
          isChildOfTrigger: parentHasTriggerAncestor,
        },
      };

      let nextEdges: Edge[];

      if (existingChildren.length === 1) {
        const existingChild = existingChildren[0]!;
        newNode.position = {
          x: parentNode.position.x,
          y: (parentNode.position.y + existingChild.position.y) / 2,
        };
        nextEdges = currentEdges
          .filter((e) => !(e.source === parentNode.id && e.target === existingChild.id))
          .concat([
            {
              id: `edge-${parentNode.id}-${newNodeId}`,
              source: parentNode.id,
              target: newNodeId,
              sourceHandle: "source",
              targetHandle: "target",
            },
            {
              id: `edge-${newNodeId}-${existingChild.id}`,
              source: newNodeId,
              target: existingChild.id,
              sourceHandle: "source",
              targetHandle: "target",
            },
          ]);
      } else if (existingChildren.length > 1) {
        const lastChild = existingChildren.reduce((last, current) =>
          current.position.y > last.position.y ? current : last
        );
        newNode.position = {
          x: parentNode.position.x,
          y: lastChild.position.y + verticalOffset,
        };
        nextEdges = [
          ...currentEdges,
          {
            id: `edge-${parentNode.id}-${newNodeId}`,
            source: parentNode.id,
            target: newNodeId,
            sourceHandle: "source",
            targetHandle: "target",
          },
        ];
      } else {
        newNode.position = {
          x: parentNode.position.x,
          y: parentNode.position.y + verticalOffset,
        };
        nextEdges = [
          ...currentEdges,
          {
            id: `edge-${parentNode.id}-${newNodeId}`,
            source: parentNode.id,
            target: newNodeId,
            sourceHandle: "source",
            targetHandle: "target",
          },
        ];
      }

      setNodes((prev) => [...prev, newNode]);
      setEdges(nextEdges);
      lastAutosavedGraphRef.current = null;
      toast({
        title: "Child Node Added",
        description:
          existingChildren.length === 1
            ? "A new action was inserted between the parent and the next step."
            : "A new action node was added.",
      });
    },
    [setNodes, setEdges, toast, hasTriggerAncestor]
  );

  /** Second (or third…) trigger that shares the same first action as an existing trigger (contact created + updated + calendar, etc.). */
  const handleAddParallelTrigger = useCallback(
    (sourceTriggerId: string) => {
      const currentNodes = nodesRef.current;
      const sourceNode = currentNodes.find((n) => n.id === sourceTriggerId && n.type === "trigger");
      if (!sourceNode) return;
      const outgoing = edgesRef.current.filter((e) => e.source === sourceTriggerId);
      if (outgoing.length === 0) {
        toast({
          variant: "destructive",
          title: "Connect an action first",
          description:
            "Use “Insert child node” on this trigger so it links to an action. Parallel triggers reuse that first step.",
        });
        return;
      }
      const targetId = outgoing[0].target;
      const newId = `trigger-par-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const idx = currentNodes.filter((n) => n.type === "trigger").length;
      const newTrigger: Node = {
        id: newId,
        type: "trigger",
        position: {
          x: sourceNode.position.x + 300,
          y: sourceNode.position.y + Math.min(idx, 5) * 28,
        },
        width: 280,
        height: 120,
        data: { selectedApp: null, appIcon: null },
      };
      setNodes((nds) => [...nds, newTrigger]);
      setEdges((eds) => [
        ...eds,
        {
          id: `edge-${newId}-${targetId}-${Date.now()}`,
          source: newId,
          target: targetId,
          sourceHandle: "source",
          targetHandle: "target",
        },
      ]);
      toast({
        title: "Parallel trigger added",
        description: "Configure this trigger to another event; downstream actions stay shared.",
      });
    },
    [setNodes, setEdges, toast]
  );

  const handleInsertParentNode = useCallback((childNodeId: string) => {
    // Insert a new parent action node between the original parent and the selected child node
    // First, get current state synchronously
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    
    const childNode = currentNodes.find(n => n.id === childNodeId);
    if (!childNode) {
      toast({ 
        title: "Error", 
        description: "Child node not found.",
        variant: "destructive"
      });
      return;
    }
    
    // Find the original parent of the child node (required - must have a parent to insert between)
    const originalParentEdge = currentEdges.find(e => e.target === childNodeId);
    if (!originalParentEdge) {
      toast({ 
        title: "Cannot Insert Parent", 
        description: "Selected node must have a parent node to insert a parent above it.",
        variant: "destructive"
      });
      return;
    }
    
    const originalParent = currentNodes.find(n => n.id === originalParentEdge.source);
    if (!originalParent) {
      toast({ 
        title: "Error", 
        description: "Parent node not found.",
        variant: "destructive"
      });
      return;
    }
    
    const newNodeId = `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Calculate position: midway between original parent and child
    const midY = (originalParent.position.y + childNode.position.y) / 2;
    const alignedX = originalParent.position.x; // Align with original parent's X position
    
    // Position new parent node between original parent and child
    const newParentNode: Node = {
      id: newNodeId,
      type: 'action',
      position: {
        x: alignedX, // Align with original parent's X position
        y: midY, // Position midway between parent and child
      },
      width: 280,
      height: 120,
      data: {
        selectedAction: null,
        actionIcon: null,
        // Check if the original parent has a trigger ancestor (or is a trigger itself)
        // The new parent will inherit the same color as the original parent
        isChildOfTrigger: originalParent.type === 'trigger' || 
          hasTriggerAncestor(originalParent.id, currentNodes, currentEdges),
        onChooseAction: () => {
          // Will be set via useEffect
        },
        onConfigureAction: () => {
          // Will be set via useEffect
        },
        onInsertParentNode: () => {
          // Will be set via useEffect
        },
        onInsertChildNode: () => {
          // Will be set via useEffect
        },
        onDeleteNode: () => flowNodeDeleteRef.current(newNodeId),
      },
    };
    
    // Update edges: 
    // 1. Change original parent -> child edge to original parent -> new parent
    // 2. Add new edge: new parent -> child
    // This creates: Original Parent -> New Parent -> Child
    setEdges((eds) => {
      const updatedEdges = eds.map(edge => {
        // If this edge was from original parent to child, redirect it to the new parent
        if (edge.source === originalParent.id && edge.target === childNodeId) {
          return {
            ...edge,
            id: `edge-${originalParent.id}-${newNodeId}`, // Update edge ID
            target: newNodeId, // Point to new parent instead of child
            targetHandle: 'target',
          };
        }
        return edge;
      });
      
      // Add new edge from new parent to child
      updatedEdges.push({
        id: `edge-${newNodeId}-${childNodeId}`,
        source: newNodeId,
        target: childNodeId,
        sourceHandle: 'source',
        targetHandle: 'target',
      });
      
      return updatedEdges;
    });

    setNodes((nds) => [...nds, newParentNode]);
    lastAutosavedGraphRef.current = null;

    toast({
      title: "Parent Node Added",
      description: "A new action was inserted between the parent and this step.",
    });
  }, [setNodes, setEdges, toast, hasTriggerAncestor]);

  flowNodeInsertChildRef.current = handleInsertChildNode;
  flowNodeInsertParentRef.current = handleInsertParentNode;
  flowNodeAddParallelTriggerRef.current = handleAddParallelTrigger;

  flowNodeOpenTriggerPickerRef.current = (nodeId: string) => {
    setSelectedNodeForConfig(nodeId);
    setSelectedNodeId(nodeId);
    setShowAppModal(true);
  };
  flowNodeReconfigureTriggerRef.current = handleReconfigureTrigger;
  flowNodeOpenActionPickerRef.current = (nodeId: string) => {
    setSelectedNodeForConfig(nodeId);
    setSelectedNodeId(nodeId);
    setShowAppModal(true);
  };
  flowNodeReconfigureActionRef.current = handleReconfigureAction;

  // Attach node callbacks when edges change (isChildOfTrigger). Handlers use refs — no nodes dep loop.
  const applyNodeCallbacks = useCallback(
    (nds: Node[]) =>
      nds.map((node) => {
        if (node.type === "trigger") {
          return {
            ...node,
            width: node.width || 280,
            height: node.height || 120,
            data: {
              ...node.data,
              onChooseTrigger: () => {
                setSelectedNodeForConfig(node.id);
                setShowAppModal(true);
              },
              onConfigureTrigger: handleConfigureTrigger,
              onInsertChildNode: () => handleInsertChildNode(node.id),
              onAddParallelTrigger: () => handleAddParallelTrigger(node.id),
            },
          };
        }
        if (node.type === "action") {
          const isChildOfTrigger = hasTriggerAncestor(node.id, nds, edgesRef.current);
          return {
            ...node,
            width: node.width || 280,
            height: node.height || 120,
            data: {
              ...node.data,
              isChildOfTrigger,
              onChooseAction: () => {
                setSelectedNodeForConfig(node.id);
                setShowAppModal(true);
              },
              onConfigureAction: () => handleConfigureAction(node.id),
              onReconfigureAction: () => handleReconfigureAction(node.id),
              onSelectNode: () => setSelectedNodeId(node.id),
              onInsertParentNode: () => handleInsertParentNode(node.id),
              onInsertChildNode: () => handleInsertChildNode(node.id),
              onDeleteNode: () => flowNodeDeleteRef.current(node.id),
            },
          };
        }
        if (node.type === "router") {
          return {
            ...node,
            width: node.width || 280,
            height: node.height || 120,
            data: {
              ...node.data,
              onConfigureAction: () => handleConfigureAction(node.id),
              onInsertParentNode: () => handleInsertParentNode(node.id),
              onInsertChildNode: () => handleInsertChildNode(node.id),
              onDeleteNode: () => flowNodeDeleteRef.current(node.id),
            },
          };
        }
        return {
          ...node,
          width: node.width || 280,
          height: node.height || 120,
        };
      }),
    [
      handleConfigureTrigger,
      handleInsertChildNode,
      handleAddParallelTrigger,
      handleConfigureAction,
      handleReconfigureAction,
      handleInsertParentNode,
      hasTriggerAncestor,
    ]
  );

  useEffect(() => {
    if (!hasLoadedFlowFromApiRef.current) return;
    setNodes((nds) => applyNodeCallbacks(nds));
  }, [edges, nodes.length, applyNodeCallbacks, setNodes]);

  const nodesMissingDimensions = useMemo(
    () =>
      nodes.some(
        (n) => n.width == null || n.height == null || n.width === 0 || n.height === 0
      ),
    [nodes]
  );

  // Ensure nodes always have dimensions for minimap
  useEffect(() => {
    let minimapTimer: ReturnType<typeof setTimeout> | undefined;
    if (flowLoading || !hasLoadedFlowFromApiRef.current) {
      if (!minimapReady && nodes.length > 0) {
        minimapTimer = setTimeout(() => setMinimapReady(true), 100);
      }
      return () => {
        if (minimapTimer) clearTimeout(minimapTimer);
      };
    }
    if (nodes.length === 0) {
      setNodes([{
        id: 'trigger-1',
        type: 'trigger',
        position: { x: 500, y: 300 },
        width: 280,
        height: 120,
        data: {
          selectedApp: null,
          appIcon: null,
          onChooseTrigger: () => setShowAppModal(true),
          onConfigureTrigger: () => handleConfigureTrigger(),
          onInsertChildNode: () => handleInsertChildNode("trigger-1"),
          onAddParallelTrigger: () => handleAddParallelTrigger("trigger-1"),
          onDeleteNode: () => {
            // Delete trigger node
            setNodes((nds) => nds.filter(n => n.id !== 'trigger-1'));
            setEdges((eds) => eds.filter(e => e.source !== 'trigger-1' && e.target !== 'trigger-1'));
            toast({ title: "Trigger Deleted", description: "The trigger node has been removed." });
          },
        },
      }]);
    } else if (nodesMissingDimensions) {
      setNodes((nds) =>
        nds.map((node) => {
          const w = node.width ?? 280;
          const h = node.height ?? 120;
          if (node.width == null || node.height == null || node.width === 0 || node.height === 0) {
            return { ...node, width: w, height: h };
          }
          return node;
        })
      );
    }
    if (!minimapReady && nodes.length > 0) {
      minimapTimer = setTimeout(() => setMinimapReady(true), 100);
    }
    return () => {
      if (minimapTimer) clearTimeout(minimapTimer);
    };
  }, [
    flowLoading,
    nodes.length,
    nodesMissingDimensions,
    handleConfigureTrigger,
    handleInsertChildNode,
    handleAddParallelTrigger,
    setNodes,
    minimapReady,
  ]);

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      name?: string;
      status?: string;
      nodes?: unknown[];
      edges?: unknown[];
      linearFlow?: unknown;
    }) => {
      const res = await apiRequest("PUT", `/api/automation-flows/${flowId}`, payload);
      return res.json();
    },
    onSuccess: (updated) => {
      setFlow(updated);
      if (flowId) {
        queryClient.setQueryData(["/api/automation-flows", flowId], updated);
      }
    },
    onError: (err: Error) => {
      toast({ title: "Error saving", description: err.message, variant: "destructive" });
    },
  });

  const flowRecord = flow ?? flowData ?? null;

  // Auto-save flow when nodes/edges change (debounced, skips duplicate payloads)
  useEffect(() => {
    const loadedFlow = flow ?? flowData;
    if (!flowId || !loadedFlow?.id || !name.trim() || !hasLoadedFlowFromApiRef.current) return;

    const apiNodes = nodes.map((n) => ({
      id: n.id,
      type: n.type || "trigger",
      position: n.position,
      width: n.width || 280,
      height: n.height || 120,
      data: Object.fromEntries(
        Object.entries(n.data ?? {}).filter(([, v]) => typeof v !== "function")
      ),
    }));
    const apiEdges = edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      targetHandle: e.targetHandle ?? undefined,
    }));
    const graphSnapshot = JSON.stringify({ nodes: apiNodes, edges: apiEdges });
    if (graphSnapshot === lastAutosavedGraphRef.current) return;

    const t = setTimeout(() => {
      if (graphSnapshot === lastAutosavedGraphRef.current) return;
      lastAutosavedGraphRef.current = graphSnapshot;
      saveMutation.mutate({
        name: name.trim(),
        status,
        nodes: apiNodes,
        edges: apiEdges,
        linearFlow: linearFlowFromCanvasNodesEdges(apiNodes, apiEdges),
      });
    }, 1500);
    return () => clearTimeout(t);
  }, [flowId, flow?.id, flowData?.id, name, status, nodes, edges]);

  // Sync flowData from API into local state (nodes/edges only on first load per flow)
  useEffect(() => {
    if (!flowId) return;
    if (flowData) {
      setFlow(flowData);
      setName(flowData.name);
      setStatus((flowData.status as FlowStatus) || "draft");

      if (!hasLoadedFlowFromApiRef.current) {
        hasLoadedFlowFromApiRef.current = true;
        const stripNodeData = (data: Record<string, unknown> | undefined) =>
          Object.fromEntries(
            Object.entries(data ?? {}).filter(([, v]) => typeof v !== "function")
          );

        const loadedNodes: Array<{
          id: string;
          type: string;
          position: { x: number; y: number };
          width: number;
          height: number;
          data: Record<string, unknown>;
        }> =
          flowData.nodes && flowData.nodes.length > 0
            ? flowData.nodes.map((n: FlowNode) => ({
                id: n.id,
                type: n.type || "trigger",
                position: n.position,
                width: n.width || 280,
                height: n.height || 120,
                data: stripNodeData(n.data as Record<string, unknown>),
              }))
            : [
                {
                  id: "trigger-1",
                  type: "trigger",
                  position: { x: 500, y: 300 },
                  width: 280,
                  height: 120,
                  data: { selectedApp: null, appIcon: null },
                },
              ];

        const normalizedEdges = normalizeFlowEdges(
          (flowData.edges || []) as Edge[],
          loadedNodes as Node[]
        );
        setEdges(normalizedEdges);
        setNodes(applyNodeCallbacks(loadedNodes as Node[]));
        lastAutosavedGraphRef.current = JSON.stringify({
          nodes: loadedNodes,
          edges: normalizedEdges,
        });
        window.setTimeout(() => {
          if (hasFitViewOnLoadRef.current) return;
          const inst = reactFlowInstanceRef.current;
          if (!inst) return;
          inst.fitView({ padding: 0.35, duration: 250, maxZoom: 0.9 });
          hasFitViewOnLoadRef.current = true;
        }, 0);
      }
    } else if (!flowLoading && flowId) {
      setFlow(null);
    }
  }, [flowId, flowData, flowLoading, setNodes, setEdges]);

  const handleSave = () => {
    if (!flowRecord || !flowId || !name.trim()) return;
    const apiNodes = nodes.map((n) => ({
      id: n.id,
      type: n.type || "trigger",
      position: n.position,
      width: n.width || 280,
      height: n.height || 120,
      data: { ...n.data, onChooseTrigger: undefined },
    }));
    const apiEdges = edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      targetHandle: e.targetHandle ?? undefined,
    }));
    saveMutation.mutate(
      {
        name: name.trim(),
        status,
        nodes: apiNodes,
        edges: apiEdges,
        linearFlow: linearFlowFromCanvasNodesEdges(apiNodes, apiEdges),
      },
      {
        onSuccess: () => toast({ title: "Saved", description: "Flow updated." }),
      }
    );
  };

  function findSendTemplateMissingHeaderImage(
    apiNodes: Array<{ type?: string; data?: { selectedActionId?: string; config?: Record<string, unknown> } }>
  ): string | null {
    for (const n of apiNodes) {
      if (n.type !== "action" || n.data?.selectedActionId !== "send-template") continue;
      const cfg = n.data?.config || {};
      const fmt = String(cfg.headerFormat || "").toUpperCase();
      if (fmt === "IMAGE" && !String(cfg.headerImageUrl || "").trim()) {
        return "Send Template uses an IMAGE header template — pick a Header image from Gallery before publishing.";
      }
    }
    return null;
  }

  const handlePublish = () => {
    if (!flowRecord || !flowId || !name.trim()) return;
    const prevStatus = status;
    const nextStatus = status === "active" ? "inactive" : "active";
    if (nextStatus === "active") {
      const apiNodes = nodes.map((n) => ({
        type: n.type || "trigger",
        data: n.data,
      }));
      const headerErr = findSendTemplateMissingHeaderImage(apiNodes);
      if (headerErr) {
        toast({ title: "Cannot publish flow", description: headerErr, variant: "destructive" });
        return;
      }
    }
    setStatus(nextStatus);
    saveMutation.mutate(
      { name: name.trim(), status: nextStatus },
      {
        onSuccess: (updated) => {
          setFlow(updated);
          setStatus(updated.status as FlowStatus);
          toast({
            title: updated.status === "active" ? "Published" : "Unpublished",
            description: `Flow has been ${updated.status === "active" ? "published" : "unpublished"}.`,
          });
        },
        onError: () => {
          setStatus(prevStatus);
        },
      }
    );
  };

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) =>
      addEdge(
        {
          ...params,
          sourceHandle: params.sourceHandle ?? "source",
          targetHandle: params.targetHandle ?? "target",
        },
        eds
      )
    );
  }, [setEdges]);

  const handleTriggerSelect = (triggerId: string) => {
    if (!pendingAppForTrigger) return;

    // Check Google Calendar, Google Sheets, Calendly, and WhatsApp triggers
    const trigger = GOOGLE_CALENDAR_TRIGGERS.find(t => t.id === triggerId) || 
                    GOOGLE_SHEETS_TRIGGERS.find(t => t.id === triggerId) ||
                    CALENDLY_TRIGGERS.find(t => t.id === triggerId) ||
                    WHATSAPP_TRIGGERS.find(t => t.id === triggerId) ||
                    CONTACT_TRIGGERS.find(t => t.id === triggerId) ||
                    INDIAMART_TRIGGERS.find(t => t.id === triggerId) ||
                    JUSTDIAL_TRIGGERS.find(t => t.id === triggerId) ||
                    RAZORPAY_TRIGGERS.find(t => t.id === triggerId) ||
                    SCHEDULER_TRIGGERS.find(t => t.id === triggerId) ||
                    SHOPIFY_TRIGGERS.find(t => t.id === triggerId) ||
                    TRADEINDIA_TRIGGERS.find(t => t.id === triggerId) ||
                    WEBHOOK_TRIGGERS.find(t => t.id === triggerId) ||
                    ZOOM_WEBHOOK_TRIGGERS.find(t => t.id === triggerId) ||
                    WOOCOMMERCE_TRIGGERS.find(t => t.id === triggerId);
    if (!trigger) return;

    const nodeId = pendingAppForTrigger.nodeId;
    
    setNodes((nds) =>
      nds.map((node) => {
        if (nodeId && node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              selectedApp: trigger.name,
              appIcon: pendingAppForTrigger.app.icon,
              selectedTrigger: triggerId,
              triggerType: trigger.name,
              _linearTriggerSnapshot: undefined,
            },
          };
        } else if (!nodeId && node.type === 'trigger') {
          // Default behavior: configure trigger if no specific node selected
          return {
            ...node,
            data: {
              ...node.data,
              selectedApp: trigger.name,
              appIcon: pendingAppForTrigger.app.icon,
              selectedTrigger: triggerId,
              triggerType: trigger.name,
              _linearTriggerSnapshot: undefined,
            },
          };
        }
        return node;
      })
    );

    setShowTriggerModal(false);
    setTriggerSearchQuery("");
    setPendingAppForTrigger(null);
    if (nodeId) setSelectedNodeId(nodeId);
    toast({ 
      title: "Trigger selected", 
      description: `${trigger.name} trigger has been selected.` 
    });
  };

  const handleActionSelect = (actionId: string) => {
    if (!pendingAppForAction) return;

    const getAction = () => {
      switch (pendingAppForAction.app.id) {
        case 'whatsapp': return WHATSAPP_ACTIONS.find(a => a.id === actionId);
        case 'google-sheets': return GOOGLE_SHEETS_ACTIONS.find(a => a.id === actionId);
        case 'calendly': return CALENDLY_ACTIONS.find(a => a.id === actionId);
        case 'contact-helicopticsolutions': return CONTACT_ACTIONS.find(a => a.id === actionId);
        case 'google-calendar': return GOOGLE_CALENDAR_ACTIONS.find(a => a.id === actionId);
        case 'google-contacts': return GOOGLE_CONTACTS_ACTIONS.find(a => a.id === actionId);
        case 'openai': return OPENAI_ACTIONS.find(a => a.id === actionId);
        case 'google-gemini': return GOOGLE_GEMINI_ACTIONS.find(a => a.id === actionId);
        case 'router': return ROUTER_ACTIONS.find(a => a.id === actionId);
        case 'delay': return DELAY_ACTIONS.find(a => a.id === actionId);
        default: return null;
      }
    };
    const action = getAction();
    if (!action) return;

    const nodeId = pendingAppForAction.nodeId;
    const isRouter = actionId === 'router';

    if (isRouter && nodeId) {
      const currentNodes = nodesRef.current;
      const currentEdges = edgesRef.current;
      const targetNode = currentNodes.find((n) => n.id === nodeId);
      if (targetNode) {
        const isChildOfTrigger =
          targetNode.type === "trigger" ||
          hasTriggerAncestor(nodeId, currentNodes, currentEdges);
        const hadConfiguredAction =
          Boolean(targetNode.data?.selectedAction) ||
          Boolean(targetNode.data?.selectedActionId);
        const routerData = {
          ...targetNode.data,
          selectedAction: action.name,
          routerIcon: pendingAppForAction!.app.icon,
          selectedActionId: actionId,
          onConfigureAction: targetNode.data?.onConfigureAction,
          onDeleteNode: targetNode.data?.onDeleteNode,
        };
        const previousActionData = hadConfiguredAction
          ? {
              selectedAction: targetNode.data?.selectedAction,
              selectedActionId: targetNode.data?.selectedActionId,
              actionIcon: targetNode.data?.actionIcon,
              config: targetNode.data?.config,
              isChildOfTrigger:
                targetNode.type === "trigger" ||
                hasTriggerAncestor(nodeId, currentNodes, currentEdges),
            }
          : undefined;
        const nodesWithRouter = currentNodes.map((n) =>
          n.id === nodeId ? { ...targetNode, type: "router" as const, data: routerData } : n
        );
        const graph = ensureRouterBranchGraph({
          routerNodeId: nodeId,
          nodes: nodesWithRouter,
          edges: currentEdges,
          isChildOfTrigger:
            targetNode.type === "trigger" ||
            hasTriggerAncestor(nodeId, currentNodes, currentEdges),
          existingConfig: undefined,
          previousActionData,
        });
        const finalNodes = graph.nodes.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                type: "router" as const,
                data: {
                  ...(n.data as Record<string, unknown>),
                  selectedAction: action.name,
                  routerIcon: pendingAppForAction!.app.icon,
                  selectedActionId: actionId,
                  onConfigureAction: targetNode.data?.onConfigureAction,
                  onDeleteNode: targetNode.data?.onDeleteNode,
                  config: graph.config,
                },
              }
            : n
        );
        setNodes(finalNodes);
        setEdges(graph.edges);
        lastAutosavedGraphRef.current = null;
      }
    } else {
      setNodes((nds) =>
        nds.map((node) => {
          if (nodeId && node.id === nodeId) {
            if (pendingAppForAction!.app.id === 'delay') {
            const prevCfg =
              node.data?.config && typeof node.data.config === 'object' && !Array.isArray(node.data.config)
                ? { ...(node.data.config as Record<string, unknown>) }
                : {};
            let nextCfg: Record<string, unknown> = { ...prevCfg };
            if (actionId === 'delay-for') {
              const parts = delayForParts('minutes', 1);
              nextCfg = {
                ...nextCfg,
                ...parts,
                delayForUnit: 'minutes',
                delayForValue: 1,
              };
              delete nextCfg.delayUntil;
            } else if (actionId === 'delay-until') {
              nextCfg = {
                ...nextCfg,
                delayUntil: typeof prevCfg.delayUntil === 'string' ? prevCfg.delayUntil : '',
              };
            }
            return {
              ...node,
              data: {
                ...node.data,
                selectedAction: action.name,
                actionIcon: pendingAppForAction!.app.icon,
                selectedActionId: actionId,
                config: nextCfg,
              },
            };
          }
          return {
            ...node,
            data: {
              ...node.data,
              selectedAction: action.name,
              actionIcon: pendingAppForAction!.app.icon,
              selectedActionId: actionId,
            },
          };
        }
        return node;
      })
    );
    }

    setShowActionModal(false);
    setActionSearchQuery("");
    setPendingAppForAction(null);
    if (nodeId) setSelectedNodeId(nodeId);
    setSelectedNodeForConfig(null);
    toast({ 
      title: "Action selected", 
      description: `${action.name} action has been selected.` 
    });
  };

  const handleAppSelect = (appId: string) => {
    const app = (isActionContext ? AVAILABLE_ACTION_APPS : AVAILABLE_APPS).find(a => a.id === appId);
    if (!app) return;

    // Check if this is Google Calendar or Google Sheets and we're configuring a trigger
    const nodeType = selectedNodeForConfig 
      ? (nodes.find(n => n.id === selectedNodeForConfig)?.type === 'action' ? 'action' : 'trigger')
      : 'trigger';
    
    const triggerApps = ['google-calendar', 'google-sheets', 'calendly', 'whatsapp', 'contact-helicopticsolutions', 'indiamart', 'justdial', 'razorpay', 'scheduler', 'shopify', 'tradeindia', 'webhook', 'zoom-webhook', 'woocommerce'];
    if (triggerApps.includes(app.id) && nodeType === 'trigger') {
      // Store the app and node ID, then show trigger selection modal
      setPendingAppForTrigger({ app, nodeId: selectedNodeForConfig });
      setShowAppModal(false);
      setTimeout(() => setShowTriggerModal(true), 50);
      return;
    }

    // For WhatsApp, Google Sheets, Calendly, Contact, Google Calendar, Google Contacts, OpenAI, Gemini, or Router action node, show action selection modal
    if ((app.id === 'whatsapp' || app.id === 'google-sheets' || app.id === 'calendly' || app.id === 'contact-helicopticsolutions' || app.id === 'google-contacts' || app.id === 'openai' || app.id === 'google-gemini' || app.id === 'router' || app.id === 'delay') && nodeType === 'action') {
      setPendingAppForAction({ app, nodeId: selectedNodeForConfig });
      setShowAppModal(false);
      setTimeout(() => setShowActionModal(true), 50);
      return;
    }

    // For other apps or action nodes, proceed normally
    setNodes((nds) =>
      nds.map((node) => {
        if (selectedNodeForConfig && node.id === selectedNodeForConfig) {
          if (node.type === 'trigger') {
            return {
              ...node,
              data: {
                ...node.data,
                selectedApp: app.name,
                appIcon: app.icon,
              },
            };
          } else if (node.type === 'action') {
            return {
              ...node,
              data: {
                ...node.data,
                selectedAction: app.name,
                actionIcon: app.icon,
              },
            };
          }
        } else if (!selectedNodeForConfig && node.type === 'trigger') {
          // Default behavior: configure trigger if no specific node selected
          return {
            ...node,
            data: {
              ...node.data,
              selectedApp: app.name,
              appIcon: app.icon,
            },
          };
        }
        return node;
      })
    );

    setShowAppModal(false);
    setAppSearchQuery("");
    setSelectedNodeForConfig(null);
    toast({ 
      title: nodeType === 'action' ? "Action selected" : "Trigger selected", 
      description: `${app.name} ${nodeType} has been selected.` 
    });
  };


  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
    setSelectedNodeForConfig(node.id);
    setMobileConfigOpen(true);
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setMobileConfigOpen(false);
  }, []);

  const handleFitView = () => {
    reactFlowInstanceRef.current?.fitView({
      padding: 0.35,
      duration: 300,
      maxZoom: 1.2,
    });
  };

  const handleToggleMinimap = () => {
    setShowMinimap(!showMinimap);
  };

  const handleToggleFullscreen = () => {
    if (!isFullscreen) {
      if (flowContainerRef.current?.requestFullscreen) {
        flowContainerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const isActionContext = selectedNodeForConfig
    ? (nodes.find(n => n.id === selectedNodeForConfig)?.type === 'action')
    : false;
  const appsForModal = isActionContext ? AVAILABLE_ACTION_APPS : AVAILABLE_APPS;
  const filteredApps = appsForModal.filter(app =>
    (isActionContext ? !HIDDEN_ACTION_APPS.includes(app.id) : !HIDDEN_TRIGGER_APPS.includes(app.id)) &&
    app.name.toLowerCase().includes(appSearchQuery.toLowerCase())
  );

  const displayEdges = useMemo(() => {
    const nodeById: Record<string, Node> = {};
    for (const n of nodes) nodeById[n.id] = n;
    return edges.map((edge) => {
      const sourceNode = nodeById[edge.source];
      if (sourceNode?.type !== "router" || !edge.sourceHandle) return edge;
      const branches = getRouterBranches(sourceNode.data?.config);
      return {
        ...edge,
        type: "routerBranch",
        data: {
          label: routerBranchHandleLabel(edge.sourceHandle, branches),
          color: routerBranchEdgeColor(edge.sourceHandle),
        },
      };
    });
  }, [nodes, edges]);

  const flowConfigPanel = selectedNodeId ? (
    <NodeConfigurationPanel
      node={nodes.find((n) => n.id === selectedNodeId) || null}
      flowId={flowId || ""}
      nodes={nodes}
      edges={edges}
      onUpdateNodeData={(nodeId, data) => {
        setNodes((nds) =>
          nds.map((n) => {
            if (n.id !== nodeId) return n;
            const nextData: Record<string, unknown> = { ...(n.data as Record<string, unknown>), ...data };
            if (
              data &&
              typeof data === "object" &&
              "config" in data &&
              data.config != null &&
              typeof data.config === "object" &&
              !Array.isArray(data.config)
            ) {
              const prev =
                n.data?.config &&
                typeof n.data.config === "object" &&
                !Array.isArray(n.data.config)
                  ? (n.data.config as Record<string, unknown>)
                  : {};
              nextData.config = { ...prev, ...(data.config as Record<string, unknown>) };
            }
            return { ...n, data: nextData as Node["data"] };
          })
        );
      }}
      onRouterAddBranch={handleRouterAddBranch}
      onRouterRemoveBranch={handleRouterRemoveBranch}
    />
  ) : (
    <FlowConfigurationPanel flow={flowRecord} name={name} />
  );

  if (!flowId) {
    return (
      <div className="p-6">
        <Link href="/flows">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Flows
          </Button>
        </Link>
        <p className="mt-4 text-muted-foreground">Invalid flow.</p>
      </div>
    );
  }

  if (flowLoading) {
    return (
      <div className="p-6 flex items-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="text-muted-foreground">Loading flow...</span>
      </div>
    );
  }

  // Use flowData for not-found: `flow` state is synced in useEffect and is still null on the first paint after fetch.
  if (!flowLoading && flowId && !flowData) {
    return (
      <div className="p-6">
        <Link href="/flows">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Flows
          </Button>
        </Link>
        <p className="mt-4 text-muted-foreground">Flow not found.</p>
      </div>
    );
  }

  return (
    <div ref={flowContainerRef} className="rh-flow-builder flex flex-1 flex-col min-h-0 overflow-hidden bg-background">
      {/* Header - stays visible in fullscreen */}
      <div className="rh-flow-builder-header border-b bg-background px-6 py-4 shrink-0">
        <div className="rh-flow-builder-breadcrumb flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
            <Link href="/flows" className="hover:underline shrink-0">Dashboard</Link>
            <span className="shrink-0">&gt;</span>
            <Link href="/flows" className="hover:underline shrink-0">Flows</Link>
            <span className="shrink-0">&gt;</span>
            <span className="truncate">{flowId}</span>
          </div>
        </div>
        <div className="rh-flow-builder-header-row flex items-center justify-between mt-3">
          <div className="rh-flow-builder-title min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold truncate">{name || "New test"}</h1>
              <Badge
                variant="secondary"
                className={
                  status === "active"
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                    : status === "draft"
                      ? "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200"
                      : "bg-muted text-muted-foreground"
                }
              >
                {status === "draft" ? "Draft" : status === "active" ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="rh-flow-builder-subtitle text-sm text-muted-foreground mt-1">Edit your automation flow and publish when ready</p>
          </div>
          <div className="rh-flow-builder-actions flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleMinimap}
              className={showMinimap ? "bg-orange-50 border-orange-300" : ""}
            >
              <Map className="h-4 w-4 mr-2" />
              Minimap
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleFitView}
            >
              <Maximize2 className="h-4 w-4 mr-2" />
              Fit View
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleFullscreen}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="h-4 w-4 mr-2" />
                  Exit
                </>
              ) : (
                <>
                  <Maximize2 className="h-4 w-4 mr-2" />
                  Fullscreen
                </>
              )}
            </Button>
            <Button
              className="rh-flow-publish-btn bg-orange-500 hover:bg-orange-600"
              onClick={handlePublish}
              disabled={saveMutation.isPending}
            >
              <Check className="h-4 w-4 mr-2" />
              {status === "active" ? "Unpublish" : "Publish"}
            </Button>
          </div>
        </div>
      </div>

      {/* Flow Canvas and Right Panel */}
      <div className="flex-1 flex relative bg-[#fafafa] min-h-0">
        <div className="flex-1 relative min-h-0 bg-[#fafafa]" ref={reactFlowWrapperRef}>
          <div className="rh-builder-mobile-fab">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="shadow-md"
              onClick={() => {
                setSelectedNodeId(null);
                setMobileConfigOpen(true);
              }}
            >
              <Settings className="h-4 w-4 mr-2" />
              Flow settings
            </Button>
          </div>
          <ReactFlow
            nodes={nodes}
            edges={displayEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodesDraggable
            minZoom={0.25}
            maxZoom={1.6}
            defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
            onInit={(instance) => {
              reactFlowInstanceRef.current = instance;
            }}
            className="h-full w-full bg-[#fafafa] flow-canvas"
            defaultEdgeOptions={{ zIndex: -1 }}
            proOptions={{ hideAttribution: true }}
          >
          <Background id="dots" gap={16} size={1.5} color="#d1d5db" />
          <Controls />
          {showMinimap && nodes.length > 0 && (
            <MiniMap
              key={`minimap-${nodes.length}-${nodes.map(n => n.id).join('-')}`}
              nodeColor={(node) => {
                if (node.type === 'trigger') return '#22c55e'; // Green color for trigger
                return '#94a3b8';
              }}
              nodeStrokeWidth={3}
              nodeBorderRadius={4}
              nodeStrokeColor={(node) => {
                if (node.type === 'trigger') return '#16a34a'; // Darker green border for trigger
                return '#64748b';
              }}
              maskColor="rgba(34, 197, 94, 0.5)" // Green mask color for viewport indicator - more visible
              maskStrokeColor="rgba(34, 197, 94, 1)" // Green border for viewport indicator - solid
              maskStrokeWidth={2}
              style={{
                backgroundColor: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                width: '200px',
                height: '150px',
              }}
              position="bottom-right"
              pannable
              zoomable
            />
          )}
          </ReactFlow>
        </div>

        {/* Right Side Configuration Panel (desktop) */}
        <div className="rh-flow-builder-desktop-panel w-[480px] bg-gray-50 border-l border-gray-200 overflow-y-auto shrink-0">
          <div className="p-4">{flowConfigPanel}</div>
        </div>

        <Sheet
          open={isMobile && mobileConfigOpen}
          onOpenChange={(open) => {
            setMobileConfigOpen(open);
            if (!open) setSelectedNodeId(null);
          }}
        >
          <SheetContent side="bottom" className="rh-builder-sheet-content rounded-t-xl p-0">
            <SheetHeader className="px-4 pt-4 pb-2 border-b shrink-0">
              <SheetTitle>{selectedNodeId ? "Node settings" : "Flow settings"}</SheetTitle>
            </SheetHeader>
            <ScrollArea className="rh-builder-sheet-body max-h-[calc(88vh-4rem)]">
              <div className="p-4">{flowConfigPanel}</div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>

      {/* App Selection Modal */}
      <Dialog open={showAppModal} onOpenChange={setShowAppModal}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Select App</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {isActionContext ? "Choose an app or action for this step" : "Choose an app that provides triggers"}
            </p>
          </DialogHeader>
          <div className="mt-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Q Search apps..."
                value={appSearchQuery}
                onChange={(e) => setAppSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <ScrollArea className="h-[400px]">
              <div className="space-y-1 pr-4">
                {filteredApps.map((app) => (
                  <button
                    key={app.id}
                    onClick={() => handleAppSelect(app.id)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-gray-100 rounded-lg transition-colors text-left"
                  >
                    {app.icon ? (
                      <img 
                        src={app.icon} 
                        alt={app.name} 
                        className="w-8 h-8 object-contain flex-shrink-0"
                        onError={(e) => {
                          // Fallback to default icon if image fails to load
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent && !parent.querySelector('.fallback-icon')) {
                            const fallback = document.createElement('div');
                            fallback.className = 'fallback-icon w-8 h-8 bg-gray-200 rounded flex items-center justify-center flex-shrink-0';
                            fallback.innerHTML = `<span class="text-xs font-medium">${app.name.charAt(0)}</span>`;
                            parent.insertBefore(fallback, target);
                          }
                        }}
                      />
                    ) : (
                      <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-medium">{app.name.charAt(0)}</span>
                      </div>
                    )}
                    <span className="font-medium">{app.name}</span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Trigger Selection Modal for Google Calendar */}
      <Dialog open={showTriggerModal} onOpenChange={(open) => {
        setShowTriggerModal(open);
        if (!open) {
          setTriggerSearchQuery("");
          setPendingAppForTrigger(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Select trigger</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Choose a trigger from {pendingAppForTrigger?.app.name || 'Google Calendar'}
            </p>
          </DialogHeader>
          <div className="mt-4">
            <Button
              variant="ghost"
              onClick={() => {
                setShowTriggerModal(false);
                setShowAppModal(true);
              }}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Apps
            </Button>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search triggers..."
                value={triggerSearchQuery}
                onChange={(e) => setTriggerSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <ScrollArea className="h-[400px]">
              <div className="space-y-1 pr-4">
                {(pendingAppForTrigger?.app.id === 'google-calendar' 
                  ? GOOGLE_CALENDAR_TRIGGERS 
                  : pendingAppForTrigger?.app.id === 'google-sheets'
                  ? GOOGLE_SHEETS_TRIGGERS
                  : pendingAppForTrigger?.app.id === 'calendly'
                  ? CALENDLY_TRIGGERS
                  : pendingAppForTrigger?.app.id === 'whatsapp'
                  ? WHATSAPP_TRIGGERS
                  : pendingAppForTrigger?.app.id === 'contact-helicopticsolutions'
                  ? CONTACT_TRIGGERS
                  : pendingAppForTrigger?.app.id === 'indiamart'
                  ? INDIAMART_TRIGGERS
                  : pendingAppForTrigger?.app.id === 'justdial'
                  ? JUSTDIAL_TRIGGERS
                  : pendingAppForTrigger?.app.id === 'razorpay'
                  ? RAZORPAY_TRIGGERS
                  : pendingAppForTrigger?.app.id === 'scheduler'
                  ? SCHEDULER_TRIGGERS
                  : pendingAppForTrigger?.app.id === 'shopify'
                  ? SHOPIFY_TRIGGERS
                  : pendingAppForTrigger?.app.id === 'tradeindia'
                  ? TRADEINDIA_TRIGGERS
                  : pendingAppForTrigger?.app.id === 'webhook'
                  ? WEBHOOK_TRIGGERS
                  : pendingAppForTrigger?.app.id === 'zoom-webhook'
                  ? ZOOM_WEBHOOK_TRIGGERS
                  : pendingAppForTrigger?.app.id === 'woocommerce'
                  ? WOOCOMMERCE_TRIGGERS
                  : []).filter(trigger =>
                  trigger.name.toLowerCase().includes(triggerSearchQuery.toLowerCase()) ||
                  trigger.description.toLowerCase().includes(triggerSearchQuery.toLowerCase())
                ).map((trigger) => (
                  <button
                    key={trigger.id}
                    onClick={() => handleTriggerSelect(trigger.id)}
                    className="w-full flex items-start gap-3 p-3 hover:bg-gray-100 rounded-lg transition-colors text-left"
                  >
                    {trigger.icon ? (
                      <img 
                        src={trigger.icon} 
                        alt={trigger.name} 
                        className="w-8 h-8 object-contain flex-shrink-0 mt-0.5"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-medium">{trigger.name.charAt(0)}</span>
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="font-medium">{trigger.name}</div>
                      <div className="text-sm text-muted-foreground mt-0.5">{trigger.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Action Selection Modal - for WhatsApp child node (Send message, Send Template, etc.) */}
      <Dialog open={showActionModal} onOpenChange={(open) => {
        setShowActionModal(open);
        if (!open) {
          setActionSearchQuery("");
          setPendingAppForAction(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Select action</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Choose an action from {pendingAppForAction?.app.name || 'WhatsApp'}
            </p>
          </DialogHeader>
          <div className="mt-4">
            <Button
              variant="ghost"
              onClick={() => {
                setShowActionModal(false);
                setShowAppModal(true);
              }}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Apps
            </Button>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search actions..."
                value={actionSearchQuery}
                onChange={(e) => setActionSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <ScrollArea className="h-[400px]">
              <div className="space-y-1 pr-4">
                {actionsForPendingApp(pendingAppForAction?.app.id).filter(action =>
                  action.name.toLowerCase().includes(actionSearchQuery.toLowerCase()) ||
                  action.description.toLowerCase().includes(actionSearchQuery.toLowerCase())
                ).map((action) => (
                  <button
                    key={action.id}
                    onClick={() => handleActionSelect(action.id)}
                    className="w-full flex items-start gap-3 p-3 hover:bg-gray-100 rounded-lg transition-colors text-left"
                  >
                    {action.icon ? (
                      <img src={action.icon} alt={action.name} className="w-8 h-8 object-contain flex-shrink-0 mt-0.5" />
                    ) : (
                      <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-medium">{action.name.charAt(0)}</span>
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="font-medium">{action.name}</div>
                      <div className="text-sm text-muted-foreground mt-0.5">{action.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
