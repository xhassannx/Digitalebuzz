import type { ComponentType, ReactNode } from "react";
import type { PanelTemplateId } from "@shared/panel-templates";

export type PanelTemplateMeta = {
  id: PanelTemplateId;
  name: string;
  description: string;
};

/** Shell: sidebar position, header, main content area. */
export type PanelTemplateLayoutProps = {
  children: ReactNode;
  /** Route-specific layout flags from the app router */
  layoutFlags: PanelLayoutFlags;
};

export type PanelLayoutFlags = {
  isCreateTemplatePage: boolean;
  isFullHeightCanvasPage: boolean;
};

/**
 * Optional per-route views. Missing keys fall back to the default template's page.
 * Add entries as you build customer-specific screens.
 */
export type PanelTemplatePageKey =
  | "Dashboard"
  | "Inbox"
  | "Integrations"
  | "Commerce"
  | "WaPay"
  | "Reminders"
  | "Meetings"
  | "MeetingsSettings"
  | "Groups"
  | "MySupport"
  | "Contacts"
  | "Leads"
  | "LeadStatusSettings"
  | "Campaigns"
  | "FaqBot"
  | "Chatbots"
  | "DummyChatbots"
  | "AiAssistants"
  | "Flows"
  | "Gallery"
  | "Settings"
  | "Invoice"
  | "InvoiceList"
  | "InvoiceRecurring"
  | "WhatsAppChatWidget"
  | "WhatsAppLinkGenerator"
  | "Templates";

export type PanelTemplatePages = Partial<
  Record<PanelTemplatePageKey, ComponentType>
>;

export type PanelTemplateModule = {
  meta: PanelTemplateMeta;
  Layout: ComponentType<PanelTemplateLayoutProps>;
  pages?: PanelTemplatePages;
};

export type LoadedPanelTemplate = PanelTemplateModule & {
  id: PanelTemplateId;
};
