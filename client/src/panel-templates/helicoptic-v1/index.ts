import type { PanelTemplateModule } from "../types";
import {
  getPanelTemplateDescription,
  getPanelTemplateDisplayName,
} from "@shared/panel-templates";
import { PanelLayout } from "./Layout";
import AtlasDashboardPage from "./pages/Dashboard";
import AtlasRemindersPage from "./pages/Reminders";
import AtlasMeetingsPage from "./pages/Meetings";
import AtlasMeetingsSettingsPage from "./pages/MeetingsSettings";
import AtlasMySupportPage from "./pages/MySupport";
import {
  RatehonkAiAssistantsPage,
  RatehonkCampaignsPage,
  RatehonkChatbotsPage,
  RatehonkDummyChatbotsPage,
  RatehonkContactsPage,
  RatehonkFaqBotPage,
  RatehonkFlowsPage,
  RatehonkGalleryPage,
  RatehonkGroupsPage,
  RatehonkInboxPage,
  RatehonkIntegrationsPage,
  RatehonkCommercePage,
  RatehonkWaPayPage,
  RatehonkSettingsPage,
  RatehonkInvoicePage,
  RatehonkInvoiceListPage,
  RatehonkInvoiceRecurringPage,
  RatehonkLeadsPage,
  RatehonkLeadStatusSettingsPage,
  RatehonkWhatsAppChatWidgetPage,
  RatehonkWhatsAppLinkGeneratorPage,
  RatehonkTemplatesPage,
} from "../ratehonk-v1/pages/wrapped";

/**
 * Atlas Layout = Emerald Green RATEHONK UI from Rh-whatsapp Figma.
 * Dashboard follows Emerald Green board; other pages reuse Nova + emerald tokens.
 */
const template: PanelTemplateModule = {
  meta: {
    id: "helicoptic-v1",
    name: getPanelTemplateDisplayName("helicoptic-v1"),
    description: getPanelTemplateDescription("helicoptic-v1"),
  },
  Layout: PanelLayout,
  pages: {
    Dashboard: AtlasDashboardPage,
    Inbox: RatehonkInboxPage,
    Integrations: RatehonkIntegrationsPage,
    Commerce: RatehonkCommercePage,
    WaPay: RatehonkWaPayPage,
    Reminders: AtlasRemindersPage,
    Meetings: AtlasMeetingsPage,
    MeetingsSettings: AtlasMeetingsSettingsPage,
    Groups: RatehonkGroupsPage,
    MySupport: AtlasMySupportPage,
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
    Leads: RatehonkLeadsPage,
    LeadStatusSettings: RatehonkLeadStatusSettingsPage,
    WhatsAppChatWidget: RatehonkWhatsAppChatWidgetPage,
    WhatsAppLinkGenerator: RatehonkWhatsAppLinkGeneratorPage,
    Templates: RatehonkTemplatesPage,
  },
};

export default template;
