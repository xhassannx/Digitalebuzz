import { Switch, Route, useLocation } from "wouter";
import { syncLeadConnectorWidgetVisibility } from "@/lib/leadconnector-widget";
import { syncWhatsAppChatWidget } from "@/lib/whatsapp-chat-widget-loader";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { OrganizationThemeProvider } from "@/components/organization-theme-provider";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import ChatPage from "@/pages/chat-page";
import RemindersPage from "@/pages/reminders-page";
import MeetingsPage from "@/pages/meetings-page";
import MeetingsSettingsPage from "@/pages/meetings-settings-page";
import ConnectPage from "@/pages/connect-page";
import ApiDocsPage from "@/pages/api-docs-page";
import SettingsPage from "@/pages/settings-page";
import BillingPage from "@/pages/billing-page";
import WalletBillingPage from "@/pages/wallet-billing-page";
import AdminWalletSettingsPage from "@/pages/admin/admin-wallet-settings-page";
import WalletBillingGuidePage from "@/pages/wallet-billing-guide-page";
import InvoiceSettingsPage from "@/pages/invoice-settings-page";
import InvoiceListPage from "@/pages/invoice-list-page";
import InvoiceRecurringPage from "@/pages/invoice-recurring-page";
import LandingPage from "@/pages/landing-page";
import SendMessagePage from "@/pages/send-message-page";
import GroupsPage from "@/pages/groups-page";
import LeadStatusSettingsPage from "@/pages/lead-status-settings-page";
import LeadsPage from "@/pages/leads-page";
import ContactsPage from "@/pages/contacts-page";
import TransactionsPage from "@/pages/transactions-page";
import CampaignsPage from "@/pages/campaigns-page";
import CampaignDetailPage from "@/pages/campaign-detail-page";
import DripCampaignsPage from "@/pages/drip-campaigns-page";
import DripCampaignCreatePage from "@/pages/drip-campaign-create-page";
import TemplatesPage from "@/pages/templates-page";
import CreateTemplatePage from "@/pages/create-template-page";
import WhatsAppFlowsPage from "@/pages/whatsapp-flows-page";
import FlowsPage from "@/pages/flows-page";
import FlowsDocumentationPage from "@/pages/flows-documentation-page";
import CommerceDocumentationPage from "@/pages/commerce-documentation-page";
import FlowEditPage from "@/pages/flow-edit-page";
import SimpleFlowEditPage from "@/pages/simple-flow-edit-page";
import FlowBuilderPage from "@/pages/flow-builder-page";
import FlowResponsesPage from "@/pages/flow-responses-page";
import TagsPage from "@/pages/tags-page";
import ColumnsPage from "@/pages/columns-page";
import OrganizationsPage from "@/pages/organizations-page";
import DashboardPage from "@/pages/dashboard-page";
import SignupPage from "@/pages/signup-page";
import LoginPage from "@/pages/login-page";
import ForgotPasswordPage from "@/pages/forgot-password-page";
import ResetPasswordPage from "@/pages/reset-password-page";
import IntegrationsPage from "@/pages/integrations-page";
import CommercePage from "@/pages/commerce-page";
import WaPayPage from "@/pages/wa-pay-page";
import OpenAIConnectionsPage from "@/pages/openai-connections-page";
import GoogleGeminiConnectionsPage from "@/pages/google-gemini-connections-page";
import GoogleCalendarConnectionsPage from "@/pages/google-calendar-connections-page";
import GoogleSheetsConnectionsPage from "@/pages/google-sheets-connections-page";
import GoogleContactsConnectionsPage from "@/pages/google-contacts-connections-page";
import CalendlyConnectionsPage from "@/pages/calendly-connections-page";
import FacebookLeadAdsConnectionsPage from "@/pages/facebook-lead-ads-connections-page";
import IndiaMartIntegrationPage from "@/pages/indiamart-integration-page";
import ExportersIndiaIntegrationPage from "@/pages/exportersindia-integration-page";
import WhatsAppChatWidgetPage from "@/pages/whatsapp-chat-widget-page";
import WhatsAppLinkGeneratorPage from "@/pages/whatsapp-link-generator-page";
import AiAssistantsPage from "@/pages/ai-assistants-page";
import AiAssistantEditPage from "@/pages/ai-assistant-edit-page";
import GalleryPage from "@/pages/gallery-page";
import FAQBotPage from "@/pages/faq-bot-page";
import ChatbotsPage from "@/pages/chatbots-page";
import DummyChatbotsPage from "@/pages/dummy-chatbots-page";
import ChatbotBuilderPage from "@/pages/chatbot-builder-page";
import OptsManagementPage from "@/pages/opts-management-page";
import WebhookEventsPage from "@/pages/webhook-events-page";
import CannedMessagesPage from "@/pages/canned-messages-page";
import AdminDashboardPage from "@/pages/admin/admin-dashboard-page";
import AdminUsersPage from "@/pages/admin/admin-users-page";
import AdminExpiredSubscriptionsPage from "@/pages/admin/admin-expired-subscriptions-page";
import AdminUserDetailsPage from "@/pages/admin/admin-user-details-page";
import AdminAddonsPage from "@/pages/admin/admin-addons-page";
import AdminCouponsPage from "@/pages/admin/admin-coupons-page";
import AdminPlansPage from "@/pages/admin/admin-plans-page";
import AdminOrdersPage from "@/pages/admin/admin-orders-page";
import AdminOnboardingFeesPage from "@/pages/admin/admin-onboarding-fees-page";
import AdminThemesPage from "@/pages/admin/admin-themes-page";
import AdminPanelTemplatesPage from "@/pages/admin/admin-panel-templates-page";
import AdminLoginPage from "@/pages/admin/admin-login-page";
import UpdatesPage from "@/pages/admin/updates-page";
import EnvPage from "@/pages/admin/env-page";
import WebhookLogsPage from "@/pages/admin/webhook-logs-page";
import AdminPlatformSettingsPage from "@/pages/admin/admin-platform-settings-page";
import PlatformAdminRequiredPage from "@/pages/admin/platform-admin-required-page";
import LicensorAccessPage, { LicensorAccessRedirectIfAuthed } from "@/pages/licensor-access-page";
import RefundPolicyPage from "@/pages/refund-policy-page";
import ServiceLevelAgreementPage from "@/pages/service-level-agreement-page";
import ProjectApiPage from "@/pages/project-api-page";
import PartnerWithusPage from "@/pages/partnerwithus-page";
import PayLinkPage from "@/pages/pay-link-page";
import BookPage from "@/pages/book-page";
import { CustomerStatusGuard } from "@/components/customer-status-guard";
import {
  PanelTemplateProvider,
  usePanelTemplate,
} from "@/panel-templates/PanelTemplateProvider";
import { TemplatePageRoute } from "@/panel-templates/TemplatePageRoute";
import { PermissionGate } from "@/components/permission-gate";
import { AddonFeatureRoute } from "@/components/addon-feature-route";
import { ApiPermissionDeniedListener } from "@/components/api-permission-denied-listener";
import { usePublicBrandingHead } from "@/hooks/usePublicBrandingHead";

// Stable wrappers – inline component={() => <X />} creates new ref each render, causing ChatPage to unmount/remount and lose selectedChatId
function ChatPageWithPermission() {
  return (
    <PermissionGate permission="inbox.view">
      <TemplatePageRoute pageKey="Inbox" default={ChatPage} />
    </PermissionGate>
  );
}

function RemindersRoute() {
  return (
    <PermissionGate permission="reminders.view">
      <TemplatePageRoute pageKey="Reminders" default={RemindersPage} />
    </PermissionGate>
  );
}

function MeetingsRoute() {
  return (
    <PermissionGate permission="meetings.view">
      <TemplatePageRoute pageKey="Meetings" default={MeetingsPage} />
    </PermissionGate>
  );
}

function MeetingsSettingsRoute() {
  return (
    <PermissionGate permission="meetings.view">
      <TemplatePageRoute pageKey="MeetingsSettings" default={MeetingsSettingsPage} />
    </PermissionGate>
  );
}

function GroupsRoute() {
  return (
    <PermissionGate permission={["groups.view", "manage_contacts.view"]}>
      <TemplatePageRoute pageKey="Groups" default={GroupsPage} />
    </PermissionGate>
  );
}

function ContactsRoute() {
  return <TemplatePageRoute pageKey="Contacts" default={ContactsPage} />;
}

function LeadsRoute() {
  return (
    <PermissionGate permission="manage_contacts.view">
      <TemplatePageRoute pageKey="Leads" default={LeadsPage} />
    </PermissionGate>
  );
}

function LeadStatusSettingsRoute() {
  return (
    <PermissionGate permission="manage_contacts.edit">
      <TemplatePageRoute pageKey="LeadStatusSettings" default={LeadStatusSettingsPage} />
    </PermissionGate>
  );
}

function IntegrationsRoute() {
  return (
    <PermissionGate permission="integrations.view">
      <TemplatePageRoute pageKey="Integrations" default={IntegrationsPage} />
    </PermissionGate>
  );
}

function CommerceRoute() {
  return (
    <PermissionGate permission="integrations.view">
      <TemplatePageRoute pageKey="Commerce" default={CommercePage} />
    </PermissionGate>
  );
}

function WaPayRoute() {
  return (
    <PermissionGate permission="integrations.view">
      <TemplatePageRoute pageKey="WaPay" default={WaPayPage} />
    </PermissionGate>
  );
}

function WhatsAppChatWidgetRoute() {
  return (
    <PermissionGate permission="integrations.view">
      <TemplatePageRoute pageKey="WhatsAppChatWidget" default={WhatsAppChatWidgetPage} />
    </PermissionGate>
  );
}

function WhatsAppLinkGeneratorRoute() {
  return (
    <PermissionGate permission="integrations.view">
      <TemplatePageRoute pageKey="WhatsAppLinkGenerator" default={WhatsAppLinkGeneratorPage} />
    </PermissionGate>
  );
}

function AiAssistantsRoute() {
  return (
    <PermissionGate permission="ai_assistant.view">
      <TemplatePageRoute pageKey="AiAssistants" default={AiAssistantsPage} />
    </PermissionGate>
  );
}

function GalleryRoute() {
  return (
    <PermissionGate permission="gallery.view">
      <TemplatePageRoute pageKey="Gallery" default={GalleryPage} />
    </PermissionGate>
  );
}

function FaqBotRoute() {
  return (
    <PermissionGate permission="faq_bot.view">
      <TemplatePageRoute pageKey="FaqBot" default={FAQBotPage} />
    </PermissionGate>
  );
}

function ChatbotsListRoute() {
  return (
    <AddonFeatureRoute permission="chatbot.view" feature="chatbot">
      <TemplatePageRoute pageKey="Chatbots" default={ChatbotsPage} />
    </AddonFeatureRoute>
  );
}

function DummyChatbotsRoute() {
  return (
    <AddonFeatureRoute permission="chatbot.view" feature="chatbot">
      <TemplatePageRoute pageKey="DummyChatbots" default={DummyChatbotsPage} />
    </AddonFeatureRoute>
  );
}

function FlowsListRoute() {
  return (
    <PermissionGate permission="flows.view">
      <TemplatePageRoute pageKey="Flows" default={FlowsPage} />
    </PermissionGate>
  );
}

function SettingsRoute() {
  return (
    <PermissionGate permission={["manage_settings.view", "manage_team.view", "organizations.view"]}>
      <TemplatePageRoute pageKey="Settings" default={SettingsPage} />
    </PermissionGate>
  );
}

function InvoiceSettingsRoute() {
  return (
    <PermissionGate permission="manage_settings.view">
      <TemplatePageRoute pageKey="Invoice" default={InvoiceSettingsPage} />
    </PermissionGate>
  );
}

function InvoiceListRoute() {
  return (
    <PermissionGate permission={["manage_settings.view", "manage_contacts.view"]}>
      <TemplatePageRoute pageKey="InvoiceList" default={InvoiceListPage} />
    </PermissionGate>
  );
}

function InvoiceRecurringRoute() {
  return (
    <PermissionGate permission={["manage_settings.view", "manage_contacts.view"]}>
      <TemplatePageRoute pageKey="InvoiceRecurring" default={InvoiceRecurringPage} />
    </PermissionGate>
  );
}

function MySupportRoute() {
  return <TemplatePageRoute pageKey="MySupport" default={MySupportPage} />;
}

function DashboardRoute() {
  return (
    <PermissionGate permission="view_analytics.view">
      <DashboardPage />
    </PermissionGate>
  );
}

function ConnectRoute() {
  return (
    <PermissionGate permission="manage_templates.view">
      <ConnectPage />
    </PermissionGate>
  );
}

function TransactionsRoute() {
  return (
    <PermissionGate permission="manage_contacts.view">
      <TransactionsPage />
    </PermissionGate>
  );
}

function CampaignsRoute() {
  return (
    <PermissionGate permission="manage_campaigns.view">
      <TemplatePageRoute pageKey="Campaigns" default={CampaignsPage} />
    </PermissionGate>
  );
}

function CampaignDetailRoute() {
  return (
    <PermissionGate permission="manage_campaigns.view">
      <CampaignDetailPage />
    </PermissionGate>
  );
}

function DripCampaignsRoute() {
  return (
    <AddonFeatureRoute permission="manage_campaigns.view" feature="dripCampaigns">
      <DripCampaignsPage />
    </AddonFeatureRoute>
  );
}

function DripCampaignCreateRoute() {
  return (
    <AddonFeatureRoute permission={["manage_campaigns.create", "manage_campaigns.edit"]} feature="dripCampaigns">
      <DripCampaignCreatePage />
    </AddonFeatureRoute>
  );
}

function DripCampaignEditRoute() {
  return (
    <AddonFeatureRoute permission={["manage_campaigns.edit", "manage_campaigns.create"]} feature="dripCampaigns">
      <DripCampaignCreatePage />
    </AddonFeatureRoute>
  );
}

function TemplatesRoute() {
  return (
    <PermissionGate permission="manage_templates.view">
      <TemplatePageRoute pageKey="Templates" default={TemplatesPage} />
    </PermissionGate>
  );
}

function CreateTemplateRoute() {
  return (
    <PermissionGate permission="manage_templates.create">
      <CreateTemplatePage />
    </PermissionGate>
  );
}

function FlowsDocumentationRoute() {
  return (
    <PermissionGate permission="flows.view">
      <FlowsDocumentationPage />
    </PermissionGate>
  );
}

function FlowEditRoute() {
  return (
    <PermissionGate permission="flows.view">
      <FlowEditPage />
    </PermissionGate>
  );
}

function SimpleFlowEditRoute() {
  return (
    <PermissionGate permission="flows.view">
      <SimpleFlowEditPage />
    </PermissionGate>
  );
}

function WhatsAppFlowsRoute() {
  return (
    <PermissionGate permission={["whatsapp_forms.view", "manage_templates.view"]}>
      <WhatsAppFlowsPage />
    </PermissionGate>
  );
}

function FlowResponsesRoute() {
  return (
    <PermissionGate permission={["whatsapp_forms.view", "manage_templates.view"]}>
      <FlowResponsesPage />
    </PermissionGate>
  );
}

function FlowBuilderCreateRoute() {
  return (
    <PermissionGate permission={["whatsapp_forms.create", "manage_templates.create"]}>
      <FlowBuilderPage />
    </PermissionGate>
  );
}

function FlowBuilderEditRoute() {
  return (
    <PermissionGate permission={["whatsapp_forms.edit", "manage_templates.edit"]}>
      <FlowBuilderPage />
    </PermissionGate>
  );
}

function TagsRoute() {
  return (
    <PermissionGate permission={["tags.view", "manage_contacts.view"]}>
      <TagsPage />
    </PermissionGate>
  );
}

function CannedMessagesRoute() {
  return (
    <PermissionGate permission="canned_messages.view">
      <CannedMessagesPage />
    </PermissionGate>
  );
}

function ColumnsRoute() {
  return (
    <PermissionGate permission="columns.view">
      <ColumnsPage />
    </PermissionGate>
  );
}

function CommerceDocumentationRoute() {
  return (
    <PermissionGate permission="integrations.view">
      <CommerceDocumentationPage />
    </PermissionGate>
  );
}

function AiAssistantEditRoute() {
  return (
    <PermissionGate permission="ai_assistant.view">
      <AiAssistantEditPage />
    </PermissionGate>
  );
}

function ChatbotBuilderRoute() {
  return (
    <AddonFeatureRoute permission="chatbot.view" feature="chatbot">
      <ChatbotBuilderPage />
    </AddonFeatureRoute>
  );
}

function OptsManagementRoute() {
  return (
    <PermissionGate permission="opts_management.view">
      <OptsManagementPage />
    </PermissionGate>
  );
}

function WebhookEventsRoute() {
  return (
    <AddonFeatureRoute permission={["webhook_events.view", "manage_settings.webhook"]} feature="webhookEvents">
      <WebhookEventsPage />
    </AddonFeatureRoute>
  );
}

function OrganizationsRoute() {
  return (
    <PermissionGate permission="organizations.view">
      <OrganizationsPage />
    </PermissionGate>
  );
}

function ApiDocsRoute() {
  return (
    <PermissionGate permission="api_endpoints.view">
      <ApiDocsPage />
    </PermissionGate>
  );
}

function BillingRoute() {
  // Always allow billing so expired users can renew (PermissionGate fails when
  // org/permission APIs were blocked by subscription middleware).
  return <BillingPage />;
}

function RedirectWhiteLabelHome() {
  return <ReplaceTo to="/" />;
}

function RedirectToDashboard() {
  return <ReplaceTo to="/dashboard" />;
}

function RedirectWhiteLabelFeatures() {
  return <ReplaceTo to="/features" />;
}

function RedirectWhiteLabelPricing() {
  return <ReplaceTo to="/pricing" />;
}

function RedirectWhiteLabelAbout() {
  return <ReplaceTo to="/about" />;
}

function RedirectWhiteLabelTestimonials() {
  return <ReplaceTo to="/testimonials" />;
}

function RedirectWhiteLabelContact() {
  return <ReplaceTo to="/contact" />;
}

function RedirectWhiteLabelPrivacy() {
  return <ReplaceTo to="/privacy" />;
}

function RedirectWhiteLabelTerms() {
  return <ReplaceTo to="/terms" />;
}

/** Keep notification hooks out of AppContent so chat updates don't remount route pages. */
function GlobalNotificationHosts({ remindersEnabled }: { remindersEnabled: boolean }) {
  useNotifications();
  useMessageNotifications();
  useReminderNotifications(remindersEnabled);
  return null;
}

import { useNotifications } from "@/hooks/useNotifications";
import { useMessageNotifications } from "@/hooks/useMessageNotifications";
import { useReminderNotifications } from "@/hooks/useReminderNotifications";
import { Fragment, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import WhiteLabelLandingPage from "@/pages/white-label/landing-page-1/landing-page";

import WhiteLabelFeaturesPage from "@/pages/white-label/landing-page-1/features-page";
import WhiteLabelPricingPage from "@/pages/white-label/landing-page-1/pricing-page";
import WhiteLabelTestimonialsPage from "@/pages/white-label/landing-page-1/testimonials-page";
import WhiteLabelContactPage from "@/pages/white-label/landing-page-1/contact-page";
import WhiteLabelFreeTrialPage from "@/pages/white-label/landing-page-1/free-trial-page";
import CompanyProfile from "./pages/website-builder/company-profile";
import AboutPageWebsite from "./pages/website-builder/about-page";
import BrandingLogo from "./pages/website-builder/branding-logo";
import WhiteLabelLogo from "./pages/website-builder/white-label-logo";
import WhiteLabelPrivacyEditor from "./pages/website-builder/white-label-privacy";
import WhiteLabelTermsEditor from "./pages/website-builder/white-label-terms";
import WhiteLabelPricingEditor from "./pages/website-builder/white-label-pricing";
import WhiteLabelAboutEditor from "./pages/website-builder/white-label-about";
import BrandPage from "./pages/website-builder/brands-page";
import ConnectWithus from "./pages/website-builder/connect-withus";
import ContactPageWebsite from "./pages/website-builder/contact-page";
import CustomScript from "./pages/website-builder/customscript";
import PartnerBrand from "./pages/website-builder/partnerbrand";
import PrivacyPolicy from "./pages/website-builder/privacypolicy";
import ProductCrmPage from "./pages/website-builder/product-crm-page";
import ProductSmmPage from "./pages/website-builder/product-smm-page";
import ProductWaPage from "./pages/website-builder/product-wa-page";
import WebsiteBuilderHomeDashboard from "./pages/website-builder/home-dashboard";
import HomePage from "./pages/website-builder/homepage";
import RefundPolicy from "./pages/website-builder/refundpolicy";
import TermsAndCondition from "./pages/website-builder/terms-condition";
import TestimonialsPage from "./pages/website-builder/testimonials-page";
import ThemeSettings from "./pages/website-builder/theme-settings";
import SocialLinks from "./pages/website-builder/social-links";
import WhiteLabelPrivacyPage from "./pages/white-label/landing-page-1/privacy";
import WhiteLabelTermsPage from "./pages/white-label/landing-page-1/terms";
import WhiteLabelAboutPage from "./pages/white-label/landing-page-1/about";
import SupportTicketsListPage from "./pages/support-tickets-list-page";
import SupportTicketDetailPage from "./pages/support-ticket-detail-page";
import MySupportPage from "./pages/my-support-page";
import MySupportTicketDetailPage from "./pages/my-support-ticket-detail-page";
import PublicSupportTicketPage from "./pages/public-support-ticket-page";
import WhiteLabelSupportPage from "./pages/white-label/support-page";
import { getPublicTemplateId, isTemplate4MarketingFullscreenPath } from "@/lib/public-template";
import {
  ReplaceTo,
  PublicAboutPage,
  PublicPricingPage,
  PublicContactPage,
  PublicPrivacyPage,
  PublicTermsPage,
  PublicFeaturesPage,
  PublicSubscribePage,
  PublicTestimonialsPage,
} from "@/lib/public-marketing-routes";

/** Logged-out "/" and catch-all — from root `.env`: `TEMPLATE_ID` or `VITE_TEMPLATE_ID` (1–4). */
function getPublicLandingPageComponent() {
  switch (getPublicTemplateId()) {
    case 2:
      return PartnerWithusPage;
    case 3:
      return LoginPage;
    case 4:
      return WhiteLabelLandingPage;
    case 1:
    default:
      return LandingPage;
  }
}

const PublicLandingPage = getPublicLandingPageComponent();

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        {getPublicTemplateId() === 4 ? (
          <Fragment key="t4-wl-redirects">
            <Route path="/white-label" component={RedirectWhiteLabelHome} />
            <Route path="/white-label/features" component={RedirectWhiteLabelFeatures} />
            <Route path="/white-label/pricing" component={RedirectWhiteLabelPricing} />
            <Route path="/white-label/about" component={RedirectWhiteLabelAbout} />
            <Route path="/white-label/testimonials" component={RedirectWhiteLabelTestimonials} />
            <Route path="/white-label/contact" component={RedirectWhiteLabelContact} />
            <Route path="/white-label/privacy" component={RedirectWhiteLabelPrivacy} />
            <Route path="/white-label/terms" component={RedirectWhiteLabelTerms} />
          </Fragment>
        ) : null}
        <Route path="/features" component={PublicFeaturesPage} />
        <Route path="/testimonials" component={PublicTestimonialsPage} />
        <Route path="/white-label" component={WhiteLabelLandingPage} />
        <Route path="/white-label/features" component={WhiteLabelFeaturesPage} />
        <Route path="/white-label/pricing" component={WhiteLabelPricingPage} />
        <Route path="/white-label/about" component={WhiteLabelAboutPage} />
        <Route path="/white-label/testimonials" component={WhiteLabelTestimonialsPage} />
        <Route path="/white-label/contact" component={WhiteLabelContactPage} />
        <Route path="/white-label/privacy" component={WhiteLabelPrivacyPage} />
        <Route path="/white-label/terms" component={WhiteLabelTermsPage} />
        <Route path="/white-label/support" component={WhiteLabelSupportPage} />
        <Route path="/support/ticket" component={PublicSupportTicketPage} />
        <Route path="/free-trial" component={WhiteLabelFreeTrialPage} />
        <Route path="/admin/login" component={AdminLoginPage} />
        <Route path="/licensor-access" component={LicensorAccessPage} />
        <Route path="/signup" component={SignupPage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/reset-password/:token" component={ResetPasswordPage} />
        <Route path="/privacy" component={PublicPrivacyPage} />
        <Route path="/terms" component={PublicTermsPage} />
        <Route path="/service-level-agreement" component={ServiceLevelAgreementPage} />
        <Route path="/refund-policy" component={RefundPolicyPage} />
        <Route path="/project-api" component={ProjectApiPage} />
        <Route path="/about" component={PublicAboutPage} />
        <Route path="/partner-with-us" component={PartnerWithusPage} />
        <Route path="/pricing" component={PublicPricingPage} />
        <Route path="/subscribe" component={PublicSubscribePage} />
        <Route path="/contact" component={PublicContactPage} />
        <Route path="/pay/:token" component={PayLinkPage} />
        <Route path="/book/:slug" component={BookPage} />
        <Route path="/" component={PublicLandingPage} />
        <Route component={PublicLandingPage} />
      </Switch>
    );
  }

  return (
    <CustomerStatusGuard>
      <Switch>
        {getPublicTemplateId() === 4 ? (
          <Fragment key="t4-wl-redirects-authed">
            <Route path="/white-label" component={RedirectWhiteLabelHome} />
            <Route path="/white-label/features" component={RedirectWhiteLabelFeatures} />
            <Route path="/white-label/pricing" component={RedirectWhiteLabelPricing} />
            <Route path="/white-label/about" component={RedirectWhiteLabelAbout} />
            <Route path="/white-label/testimonials" component={RedirectWhiteLabelTestimonials} />
            <Route path="/white-label/contact" component={RedirectWhiteLabelContact} />
            <Route path="/white-label/privacy" component={RedirectWhiteLabelPrivacy} />
            <Route path="/white-label/terms" component={RedirectWhiteLabelTerms} />
          </Fragment>
        ) : null}
        <Route path="/features" component={PublicFeaturesPage} />
        <Route path="/testimonials" component={PublicTestimonialsPage} />
        <Route path="/about" component={PublicAboutPage} />
        <Route path="/pricing" component={PublicPricingPage} />
        <Route path="/contact" component={PublicContactPage} />
        <Route path="/licensor-access" component={LicensorAccessRedirectIfAuthed} />
        <Route path="/login" component={RedirectToDashboard} />
        <Route path="/signup" component={RedirectToDashboard} />
        <Route path="/forgot-password" component={RedirectToDashboard} />
        <Route path="/reset-password/:token" component={RedirectToDashboard} />
        <Route path="/pay/:token" component={PayLinkPage} />
        <Route path="/book/:slug" component={BookPage} />
        <Route path="/" component={DashboardRoute} />
        <Route path="/dashboard" component={DashboardRoute} />
        <Route path="/chat" component={ChatPageWithPermission} />
        <Route path="/reminders" component={RemindersRoute} />
        <Route path="/meetings/settings" component={MeetingsSettingsRoute} />
        <Route path="/meetings" component={MeetingsRoute} />
        <Route path="/connect" component={ConnectRoute} />
        <Route path="/send" component={SendMessagePage} />
        <Route path="/groups" component={GroupsRoute} />
        <Route path="/contacts" component={ContactsRoute} />
        <Route path="/leads" component={LeadsRoute} />
        <Route path="/leads/settings/status" component={LeadStatusSettingsRoute} />
        <Route path="/transactions" component={TransactionsRoute} />
        <Route path="/campaigns" component={CampaignsRoute} />
        <Route path="/campaigns/:id" component={CampaignDetailRoute} />
        <Route path="/drip-campaigns" component={DripCampaignsRoute} />
        <Route path="/drip-campaigns/create" component={DripCampaignCreateRoute} />
        <Route path="/drip-campaigns/:id/edit" component={DripCampaignEditRoute} />
        <Route path="/templates" component={TemplatesRoute} />
        <Route path="/templates/create" component={CreateTemplateRoute} />
        <Route path="/flows" component={FlowsListRoute} />
        <Route path="/flows/documentation" component={FlowsDocumentationRoute} />
        <Route path="/flows/edit/:flowId" component={FlowEditRoute} />
        <Route path="/flows/simple/:flowId" component={SimpleFlowEditRoute} />
        <Route path="/whatsapp-flows" component={WhatsAppFlowsRoute} />
        <Route path="/whatsapp-flows/responses/:flowId" component={FlowResponsesRoute} />
        <Route path="/whatsapp-flows/:businessAccountId/create" component={FlowBuilderCreateRoute} />
        <Route path="/whatsapp-flows/:businessAccountId/edit/:flowId" component={FlowBuilderEditRoute} />
        <Route path="/tags" component={TagsRoute} />
        <Route path="/canned-messages" component={CannedMessagesRoute} />
        <Route path="/columns" component={ColumnsRoute} />
        <Route path="/integrations" component={IntegrationsRoute} />
        <Route path="/commerce" component={CommerceRoute} />
        <Route path="/wa-pay" component={WaPayRoute} />
        <Route path="/commerce/documentation" component={CommerceDocumentationRoute} />
        <Route path="/integrations/openai" component={OpenAIConnectionsPage} />
        <Route path="/integrations/google-gemini" component={GoogleGeminiConnectionsPage} />
        <Route path="/integrations/google-calendar" component={GoogleCalendarConnectionsPage} />
        <Route path="/integrations/google-sheets" component={GoogleSheetsConnectionsPage} />
        <Route path="/integrations/google-contacts" component={GoogleContactsConnectionsPage} />
        <Route path="/integrations/calendly" component={CalendlyConnectionsPage} />
        <Route path="/integrations/facebook-lead-ads" component={FacebookLeadAdsConnectionsPage} />
        <Route path="/integrations/indiamart" component={IndiaMartIntegrationPage} />
        <Route path="/integrations/exportersindia" component={ExportersIndiaIntegrationPage} />
        <Route path="/integrations/whatsapp-chat-widget" component={WhatsAppChatWidgetRoute} />
        <Route path="/integrations/whatsapp-link-generator" component={WhatsAppLinkGeneratorRoute} />
        <Route path="/ai-assistants" component={AiAssistantsRoute} />
        <Route path="/ai-assistants/:id/edit" component={AiAssistantEditRoute} />
        <Route path="/gallery" component={GalleryRoute} />
        <Route path="/faq-bot" component={FaqBotRoute} />
        <Route path="/chatbots/dummy" component={DummyChatbotsRoute} />
        <Route path="/chatbots" component={ChatbotsListRoute} />
        <Route path="/chatbots/:id" component={ChatbotBuilderRoute} />
        <Route path="/opts-management" component={OptsManagementRoute} />
        <Route path="/webhook-events" component={WebhookEventsRoute} />
        <Route path="/organizations" component={OrganizationsRoute} />
        <Route path="/api-docs" component={ApiDocsRoute} />
        <Route path="/billing" component={BillingRoute} />
        <Route path="/billing/wallet" component={() => <PermissionGate permission="billing.view"><WalletBillingPage /></PermissionGate>} />
        <Route path="/billing/wallet/guide" component={() => <PermissionGate permission="billing.view"><WalletBillingGuidePage /></PermissionGate>} />
        <Route path="/invoice/settings" component={InvoiceSettingsRoute} />
        <Route path="/invoice/list" component={InvoiceListRoute} />
        <Route path="/invoice/recurring" component={InvoiceRecurringRoute} />
        <Route path="/invoice" component={InvoiceSettingsRoute} />
        <Route path="/settings" component={SettingsRoute} />
        <Route path="/support/ticket" component={PublicSupportTicketPage} />
        <Route path="/my-support" component={MySupportRoute} />
        <Route path="/my-support/:id" component={MySupportTicketDetailPage} />
        <Route path="/white-label/support" component={WhiteLabelSupportPage} />
        {/* White-label preview – view landing page (with your saved changes) while logged in */}
        <Route path="/white-label" component={WhiteLabelLandingPage} />
        <Route path="/white-label/features" component={WhiteLabelFeaturesPage} />
        <Route path="/white-label/pricing" component={WhiteLabelPricingPage} />
        <Route path="/white-label/privacy" component={WhiteLabelPrivacyPage} />
        <Route path="/white-label/terms" component={WhiteLabelTermsPage} />
        <Route path="/white-label/about" component={WhiteLabelAboutPage} />

        <Route path="/white-label/testimonials" component={WhiteLabelTestimonialsPage} />
        <Route path="/white-label/contact" component={WhiteLabelContactPage} />
        <Route path="/free-trial" component={WhiteLabelFreeTrialPage} />
        <Route path="/privacy" component={PublicPrivacyPage} />
        <Route path="/terms" component={PublicTermsPage} />
        <Route path="/service-level-agreement" component={ServiceLevelAgreementPage} />
        <Route path="/refund-policy" component={RefundPolicyPage} />
        <Route path="/subscribe" component={PublicSubscribePage} />
        {user && (
          <>
            <Route path="/admin" component={AdminDashboardPage} />
            <Route path="/admin/dashboard" component={AdminDashboardPage} />
            <Route path="/admin/users/:userId" component={AdminUserDetailsPage} />
            <Route path="/admin/users" component={AdminUsersPage} />
            <Route path="/admin/expired-subscriptions" component={AdminExpiredSubscriptionsPage} />
            <Route path="/admin/orders" component={AdminOrdersPage} />
            <Route path="/admin/onboarding-fees" component={AdminOnboardingFeesPage} />
            <Route path="/admin/plans" component={AdminPlansPage} />
            <Route path="/admin/add-ons" component={AdminAddonsPage} />
            <Route path="/admin/coupons" component={AdminCouponsPage} />
            <Route path="/admin/themes" component={AdminThemesPage} />
            <Route path="/admin/panel-templates" component={AdminPanelTemplatesPage} />
            <Route path="/admin/updates" component={UpdatesPage} />
            <Route path="/admin/env" component={EnvPage} />
            <Route path="/admin/webhook-logs" component={WebhookLogsPage} />
            <Route path="/admin/platform-settings" component={AdminPlatformSettingsPage} />
            <Route path="/admin/wallet-billing" component={AdminWalletSettingsPage} />
            <Route path="/admin/wallet-billing/guide" component={WalletBillingGuidePage} />
            <Route path="/admin/support" component={SupportTicketsListPage} />
            <Route path="/admin/support/:id" component={SupportTicketDetailPage} />
            <Route path="/website" component={WebsiteBuilderHomeDashboard} />
            <Route path="/website/company-profile" component={CompanyProfile} />
            <Route path="/website/homepage" component={HomePage} />

            <Route path="/website/product-crm-page" component={ProductCrmPage} />
            <Route path="/website/product-wa-page" component={ProductWaPage} />
            <Route path="/website/product-smm-page" component={ProductSmmPage} />
            <Route path="/website/about" component={AboutPageWebsite} />
            <Route path="/website/privacy" component={PrivacyPolicy} />
            <Route path="/website/refund" component={RefundPolicy} />
            <Route path="/website/terms" component={TermsAndCondition} />
            <Route path="/website/contact" component={ContactPageWebsite} />
            <Route path="/website/branding-logos" component={BrandingLogo} />
            <Route path="/website/white-label-logo" component={WhiteLabelLogo} />
            <Route path="/website/white-label-privacy" component={WhiteLabelPrivacyEditor} />
            <Route path="/website/white-label-terms" component={WhiteLabelTermsEditor} />
            <Route path="/website/white-label-pricing" component={WhiteLabelPricingEditor} />
            <Route path="/website/white-label-about" component={WhiteLabelAboutEditor} />
            <Route path="/website/client-testimonials" component={TestimonialsPage} />
            <Route path="/website/brands" component={BrandPage} />
            <Route path="/website/connect-with-us-section" component={ConnectWithus} />
            <Route path="/website/scripts" component={CustomScript} />
            <Route path="/website/theme" component={ThemeSettings} />
            <Route path="/website/social-media-links" component={SocialLinks} />
          </>
        )}
        <Route component={NotFound} />
      </Switch>
    </CustomerStatusGuard>
  );
}

function AuthenticatedLayoutInner() {
  const [location] = useLocation();
  const { template, isLoading } = usePanelTemplate();

  useEffect(() => {
    syncLeadConnectorWidgetVisibility(location, { forcePanelApp: true });
    return () => {
      if (typeof document !== "undefined") {
        document.body.dataset.panelApp = "false";
      }
    };
  }, [location]);

  const isCreateTemplatePage = location.startsWith("/templates/create");
  const isFullHeightCanvasPage =
    location === "/chat" ||
    location === "/leads" ||
    location === "/templates" ||
    location === "/contacts" ||
    location === "/reminders" ||
    location === "/flows" ||
    location.startsWith("/flows/edit/") ||
    (/^\/chatbots\/[^/]+$/.test(location) && location !== "/chatbots/dummy") ||
    /^\/admin\/support\/[^/]+$/.test(location) ||
    /^\/my-support\/[^/]+$/.test(location);

  const isWhiteLabelPage =
    location.startsWith("/white-label") ||
    isTemplate4MarketingFullscreenPath(location) ||
    location === "/free-trial" ||
    location.startsWith("/subscribe") ||
    location.startsWith("/pay/") ||
    location.startsWith("/book/");

  if (isWhiteLabelPage) {
    return (
      <div className="h-screen w-full overflow-auto">
        <Router />
      </div>
    );
  }

  if (isLoading || !template) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <div
            className="w-12 h-12 border-4 rounded-full animate-spin mx-auto"
            style={{
              borderColor: "var(--rh-brand, hsl(var(--primary)))",
              borderTopColor: "transparent",
            }}
          />
          <p className="text-muted-foreground text-sm">Loading panel…</p>
        </div>
      </div>
    );
  }

  const Layout = template.Layout;

  return (
    <Layout
      layoutFlags={{ isCreateTemplatePage, isFullHeightCanvasPage }}
    >
      <Router />
      <PWAInstallPrompt />
    </Layout>
  );
}

function AuthenticatedLayout() {
  return (
    <PanelTemplateProvider>
      <AuthenticatedLayoutInner />
    </PanelTemplateProvider>
  );
}

function PublicAppShell() {
  return <Router />;
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();
  usePublicBrandingHead();

  useEffect(() => {
    // SPA navigation keeps scroll position; reset so marketing pages (footer/header links) start at top.
    if (typeof window === "undefined") return;
    if (window.location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location]);

  useEffect(() => {
    syncLeadConnectorWidgetVisibility(location, { forcePanelApp: !!isAuthenticated });
    if (isLoading) return;
    void syncWhatsAppChatWidget(location, { isAuthenticated: !!isAuthenticated });
  }, [location, isAuthenticated, isLoading]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <OrganizationThemeProvider>
        <ApiPermissionDeniedListener />
        <GlobalNotificationHosts remindersEnabled />
        <AuthenticatedLayout />
      </OrganizationThemeProvider>
    );
  }

  return (
    <>
      <GlobalNotificationHosts remindersEnabled={false} />
      <Router />
    </>
  );
}

function ServiceWorkerUpdateBanner() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    const onUpdate = (e: Event) => {
      const ev = e as CustomEvent<{ registration: ServiceWorkerRegistration }>;
      if (ev.detail?.registration?.waiting) setRegistration(ev.detail.registration);
    };
    window.addEventListener("service-worker-update", onUpdate);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        if (reg.waiting) setRegistration(reg);
      });
    }
    return () => window.removeEventListener("service-worker-update", onUpdate);
  }, []);

  const handleReload = () => {
    if (!registration?.waiting) return;
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
    navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true });
  };

  if (!registration?.waiting) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-center gap-3 text-sm font-medium shadow-md">
      <span>Reload to get notifications in other tabs</span>
      <Button size="sm" variant="secondary" className="bg-amber-100 hover:bg-amber-200 text-amber-950" onClick={handleReload}>
        Reload
      </Button>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <ServiceWorkerUpdateBanner />
          <AppContent />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
