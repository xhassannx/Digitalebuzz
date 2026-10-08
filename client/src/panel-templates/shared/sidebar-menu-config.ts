import type { ComponentType } from "react";
import type { AddonSidebarFeature } from "@/components/addon-feature-route";
import {
  MessageSquare,
  QrCode,
  Settings,
  Code2,
  CreditCard,
  Users,
  ContactRound,
  UserPlus,
  Megaphone,
  Building2,
  LayoutDashboard,
  Plug,
  ShoppingBag,
  Image,
  Bot,
  Tag,
  Columns,
  Bell,
  Webhook,
  Workflow,
  GitBranch,
  FileText,
  FileKey,
  Wallet,
  Banknote,
  ShieldCheck,
  Package,
  Receipt,
  Download,
  Sparkles,
  LifeBuoy,
  LayoutTemplate,
  List,
  LayoutGrid,
  Settings2,
  RefreshCw,
  CalendarOff,
  Wand2,
  Calendar,
} from "lucide-react";

export type SidebarMenuItemDef = {
  title: string;
  icon: ComponentType<{ className?: string }>;
  url: string;
  permission?: string | string[];
  addonFeature?: AddonSidebarFeature;
};

/** Shown at top of Platform group — items before Leads (Dashboard, Inbox). */
export const platformTopMenuItemsBeforeLeads: SidebarMenuItemDef[] = [
  { title: "Dashboard", icon: LayoutDashboard, url: "/dashboard", permission: "view_analytics.view" },
  { title: "Inbox", icon: MessageSquare, url: "/chat", permission: "inbox.view" },
];

/** Platform top items after Leads. */
export const platformTopMenuItemsAfterLeads: SidebarMenuItemDef[] = [
  { title: "Reminders", icon: Bell, url: "/reminders", permission: "reminders.view" },
  { title: "Meetings", icon: Calendar, url: "/meetings", permission: "meetings.view" },
  { title: "My support", icon: LifeBuoy, url: "/my-support" },
  {
    title: "Flows",
    icon: GitBranch,
    url: "/flows",
    permission: "flows.view",
    addonFeature: "flows",
  },
  {
    title: "Drip Campaigns",
    icon: Wand2,
    url: "/drip-campaigns",
    permission: "manage_campaigns.view",
    addonFeature: "dripCampaigns",
  },
];

/** Shown at top of Platform group (fixed order). */
export const platformTopMenuItems: SidebarMenuItemDef[] = [
  ...platformTopMenuItemsBeforeLeads,
  ...platformTopMenuItemsAfterLeads,
];

/** Platform items after Manage (excludes Dashboard & Inbox). */
export const platformMenuItems: SidebarMenuItemDef[] = [
  { title: "Integrations", icon: Plug, url: "/integrations", permission: "integrations.view" },
  { title: "Commerce", icon: ShoppingBag, url: "/commerce", permission: "integrations.view" },
  { title: "WA Pay", icon: Wallet, url: "/wa-pay", permission: "integrations.view" },
  { title: "Gallery", icon: Image, url: "/gallery", permission: "gallery.view" },
  { title: "FAQ Bot", icon: Bot, url: "/faq-bot", permission: "faq_bot.view" },
  { title: "Chatbot", icon: Bot, url: "/chatbots", permission: "chatbot.view", addonFeature: "chatbot" },
  { title: "AI Assistant", icon: Sparkles, url: "/ai-assistants", permission: "ai_assistant.view" },
  { title: "Organizations", icon: Building2, url: "/organizations", permission: "organizations.view" },
  { title: "API Endpoints", icon: Code2, url: "/api-docs", permission: "api_endpoints.view" },
  { title: "Billing", icon: CreditCard, url: "/billing", permission: "billing.view" },
  { title: "WhatsApp Wallet", icon: Wallet, url: "/billing/wallet", permission: "billing.view" },
  {
    title: "Settings",
    icon: Settings,
    url: "/settings",
    permission: ["manage_settings.view", "manage_team.view", "organizations.view"],
  },
];

/** Leads submenu (board + status settings). */
export const leadsMenuItems: SidebarMenuItemDef[] = [
  { title: "Board", icon: LayoutGrid, url: "/leads", permission: "manage_contacts.view" },
  { title: "Lead Status", icon: Settings2, url: "/leads/settings/status", permission: "manage_contacts.edit" },
];

/** Invoice submenu (Setting + List + Recurring payment). */
export const invoiceMenuItems: SidebarMenuItemDef[] = [
  { title: "Setting", icon: Settings2, url: "/invoice/settings", permission: "manage_settings.view" },
  { title: "List", icon: List, url: "/invoice/list", permission: ["manage_settings.view", "manage_contacts.view"] },
  {
    title: "Recurring payment",
    icon: RefreshCw,
    url: "/invoice/recurring",
    permission: ["manage_settings.view", "manage_contacts.view"],
  },
];

export const manageMenuItems: SidebarMenuItemDef[] = [
  { title: "Whatsapp Templates", icon: QrCode, url: "/connect", permission: "manage_templates.view" },
  { title: "Groups", icon: Users, url: "/groups", permission: ["groups.view", "manage_contacts.view"] },
  { title: "Contacts", icon: ContactRound, url: "/contacts", permission: "manage_contacts.view" },
  { title: "Transactions", icon: Banknote, url: "/transactions", permission: "manage_contacts.view" },
  { title: "Campaigns", icon: Megaphone, url: "/campaigns", permission: "manage_campaigns.view" },
  {
    title: "Whatsapp Forms",
    icon: Workflow,
    url: "/whatsapp-flows",
    permission: ["whatsapp_forms.view", "manage_templates.view"],
  },
  { title: "Canned Messages", icon: FileText, url: "/canned-messages", permission: "canned_messages.view" },
  { title: "Tags", icon: Tag, url: "/tags", permission: ["tags.view", "manage_contacts.view"] },
  { title: "Columns", icon: Columns, url: "/columns", permission: "columns.view" },
  { title: "Opts Management", icon: Bell, url: "/opts-management", permission: "opts_management.view" },
  {
    title: "Webhook Events",
    icon: Webhook,
    url: "/webhook-events",
    permission: ["webhook_events.view", "manage_settings.webhook"],
    addonFeature: "webhookEvents",
  },
];

export const adminMenuItems: SidebarMenuItemDef[] = [
  { title: "Dashboard", icon: LayoutDashboard, url: "/admin/dashboard" },
  { title: "Users", icon: Users, url: "/admin/users" },
  { title: "Expired subscriptions", icon: CalendarOff, url: "/admin/expired-subscriptions" },
  { title: "Orders", icon: Receipt, url: "/admin/orders" },
  { title: "Onboarding fees", icon: Wallet, url: "/admin/onboarding-fees" },
  { title: "Plans", icon: CreditCard, url: "/admin/plans" },
  { title: "Add-ons", icon: Package, url: "/admin/add-ons" },
  { title: "Coupons", icon: Tag, url: "/admin/coupons" },
  { title: "Panel templates", icon: LayoutTemplate, url: "/admin/panel-templates" },
  { title: "Updates", icon: Download, url: "/admin/updates" },
  { title: "Platform settings", icon: Settings, url: "/admin/platform-settings" },
  { title: "Wallet billing", icon: Wallet, url: "/admin/wallet-billing" },
  { title: "Update .env", icon: FileKey, url: "/admin/env" },
  { title: "Webhook Logs", icon: Webhook, url: "/admin/webhook-logs" },
  { title: "Support Tickets", icon: LifeBuoy, url: "/admin/support" },
];

export const websiteMenuItems: SidebarMenuItemDef[] = [
  { title: "Home", icon: LayoutDashboard, url: "/website" },
  { title: "Landing Page", icon: Users, url: "/website/homepage" },
  { title: "Privacy Policy", icon: ShieldCheck, url: "/website/white-label-privacy" },
  { title: "Terms and conditions", icon: FileText, url: "/website/white-label-terms" },
  { title: "Branding Logo", icon: Image, url: "/website/white-label-logo" },
  { title: "Pricing and Plans", icon: CreditCard, url: "/website/white-label-pricing" },
  { title: "About Us", icon: Tag, url: "/website/white-label-about" },
];

export function canShowSidebarItem(
  item: SidebarMenuItemDef,
  hasPermission: (p: string) => boolean,
  allowAddonMenu: (key: AddonSidebarFeature) => boolean,
): boolean {
  if (item.addonFeature && !allowAddonMenu(item.addonFeature)) return false;
  if (!item.permission) return true;
  const perms = Array.isArray(item.permission) ? item.permission : [item.permission];
  return perms.some((p) => hasPermission(p));
}

export function isSidebarLinkActive(location: string, url: string): boolean {
  if (url === "/dashboard") return location === "/dashboard" || location === "/";
  if (url === "/website") return location === "/website";
  if (url === "/invoice/settings") {
    return location === "/invoice" || location === "/invoice/settings" || location.startsWith("/invoice/settings/");
  }
  if (url === "/invoice/list") {
    return location === "/invoice/list" || location.startsWith("/invoice/list/");
  }
  if (url === "/invoice/recurring") {
    return location === "/invoice/recurring" || location.startsWith("/invoice/recurring/");
  }
  if (url === "/leads") {
    return location === "/leads" || (location.startsWith("/leads/") && !location.startsWith("/leads/settings"));
  }
  if (url === "/leads/settings/status") {
    return location === "/leads/settings/status" || location.startsWith("/leads/settings/status/");
  }
  return location === url || location.startsWith(url + "/");
}
