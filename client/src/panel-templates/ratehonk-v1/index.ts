import type { PanelTemplateModule } from "../types";
import {
  getPanelTemplateDescription,
  getPanelTemplateDisplayName,
} from "@shared/panel-templates";
import { PanelLayout } from "./Layout";
import RatehonkDashboardPage from "./pages/Dashboard";
import {
  RatehonkAiAssistantsPage,
  RatehonkCampaignsPage,
  RatehonkChatbotsPage,
  RatehonkDummyChatbotsPage,
  RatehonkContactsPage,
  RatehonkLeadsPage,
  RatehonkLeadStatusSettingsPage,
  RatehonkFaqBotPage,
  RatehonkFlowsPage,
  RatehonkGalleryPage,
  RatehonkGroupsPage,
  RatehonkInboxPage,
  RatehonkIntegrationsPage,
  RatehonkCommercePage,
  RatehonkWaPayPage,
  RatehonkMySupportPage,
  RatehonkRemindersPage,
  RatehonkMeetingsPage,
  RatehonkMeetingsSettingsPage,
  RatehonkSettingsPage,
  RatehonkInvoicePage,
  RatehonkInvoiceListPage,
  RatehonkInvoiceRecurringPage,
  RatehonkWhatsAppChatWidgetPage,
  RatehonkWhatsAppLinkGeneratorPage,
  RatehonkTemplatesPage,
} from "./pages/wrapped";

const template: PanelTemplateModule = {
  meta: {
    id: "ratehonk-v1",
    name: getPanelTemplateDisplayName("ratehonk-v1"),
    description: getPanelTemplateDescription("ratehonk-v1"),
  },
  Layout: PanelLayout,
  pages: {
    Dashboard: RatehonkDashboardPage,
    Inbox: RatehonkInboxPage,
    Integrations: RatehonkIntegrationsPage,
    Commerce: RatehonkCommercePage,
    WaPay: RatehonkWaPayPage,
    Reminders: RatehonkRemindersPage,
    Meetings: RatehonkMeetingsPage,
    MeetingsSettings: RatehonkMeetingsSettingsPage,
    Groups: RatehonkGroupsPage,
    MySupport: RatehonkMySupportPage,
    Contacts: RatehonkContactsPage,
    Campaigns: RatehonkCampaignsPage,
    FaqBot: RatehonkFaqBotPage,
    Chatbots: RatehonkChatbotsPage,
    DummyChatbots: RatehonkDummyChatbotsPage,
    AiAssistants: RatehonkAiAssistantsPage,
    Flows: RatehonkFlowsPage,
    Gallery: RatehonkGalleryPage,
    Settings: RatehonkSettingsPage,
    Invoice: RatehonkInvoicePage,
    InvoiceList: RatehonkInvoiceListPage,
    InvoiceRecurring: RatehonkInvoiceRecurringPage,
    WhatsAppChatWidget: RatehonkWhatsAppChatWidgetPage,
    WhatsAppLinkGenerator: RatehonkWhatsAppLinkGeneratorPage,
    Templates: RatehonkTemplatesPage,
  },
};

export default template;
