import type { CSSProperties } from "react";
import type { PanelTemplateLayoutProps } from "../types";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "../ratehonk-v1/components/AppSidebar";
import { PanelHeader } from "../ratehonk-v1/components/PanelHeader";
import { OnboardingOutstandingBanner } from "@/components/onboarding-outstanding-banner";
import { SubscriptionExpiryBanner } from "@/components/subscription-expiry-banner";
import { ReminderProvider } from "@/contexts/reminder-context";
import { tokens } from "./tokens";
import { RatehonkSkinProvider } from "../ratehonk-v1/RatehonkSkinContext";
import "../ratehonk-v1/theme.css";
import "../ratehonk-v1/ratehonk-global.css";
import "../ratehonk-v1/page-skin.css";
import "../ratehonk-v1/inbox.css";
import "../ratehonk-v1/inbox-nova.css";
import "./inbox-atlas.css";
import "../ratehonk-v1/integrations.css";
import "../ratehonk-v1/commerce.css";
import "../ratehonk-v1/settings.css";
import "../ratehonk-v1/gallery.css";
import "../ratehonk-v1/flows.css";
import "../ratehonk-v1/panel-pages.css";
import "../ratehonk-v1/ratehonk-responsive.css";
import "../ratehonk-v1/dialogs-forms.css";
import "../ratehonk-v1/toasts.css";
import "../ratehonk-v1/tables-mobile.css";
import "../ratehonk-v1/builder-canvas.css";
import "../ratehonk-v1/dashboard-nova.css";
import "./dashboard-atlas.css";
import "./reminders-atlas.css";
import "./my-support-atlas.css";
import "./support-detail-atlas.css";
import "./faq-bot-atlas.css";
import "./chatbots-atlas.css";
import "./panel-templates-admin-atlas.css";
import "./connect-atlas.css";
import "./groups-atlas.css";
import "./contacts-atlas.css";
import "./templates-atlas.css";
import "./manage-pages-atlas.css";
import "./settings-atlas.css";
import "./ai-assistant-atlas.css";
import "./theme.css";
import "../ratehonk-v1/invoice.css";
import "../ratehonk-v1/whatsapp-chat-widget.css";
import "../ratehonk-v1/whatsapp-link-generator.css";

const sidebarStyle = {
  "--sidebar-width": tokens.layout.sidebarWidth,
  "--sidebar-width-icon": "4rem",
} as CSSProperties;

/**
 * Atlas Layout — Emerald Green RATEHONK shell
 * (same structure as Nova; brand tokens from helicoptic-v1/tokens).
 */
export function PanelLayout({ children, layoutFlags }: PanelTemplateLayoutProps) {
  const { isCreateTemplatePage, isFullHeightCanvasPage } = layoutFlags;

  return (
    <SidebarProvider style={sidebarStyle} defaultOpen>
      <ReminderProvider>
        <div
          className={`flex min-h-0 w-full min-w-0 flex-col ${isCreateTemplatePage ? "min-h-screen" : "h-screen"}`}
          data-panel-template="helicoptic-v1"
          data-rh-shell=""
          style={
            {
              fontFamily: tokens.font.sans,
              backgroundColor: tokens.colors.pageBg,
              "--rh-brand": tokens.colors.brand,
              "--rh-brand-hover": tokens.colors.brandHover,
              "--rh-brand-light": tokens.colors.brandLight,
              "--rh-brand-soft": tokens.colors.brandSoft,
              "--rh-nav-active-bg": tokens.colors.navActiveBg,
              "--rh-nav-active-fg": tokens.colors.navActiveFg,
              "--panel-brand": tokens.colors.brand,
              "--panel-brand-hover": tokens.colors.brandHover,
              "--primary": "160 94% 24%",
              "--primary-foreground": "0 0% 100%",
              "--ring": "160 94% 24%",
            } as CSSProperties
          }
        >
          <SubscriptionExpiryBanner />
          <div className="flex min-h-0 min-w-0 flex-1">
            <AppSidebar />
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <PanelHeader />
              <OnboardingOutstandingBanner />
              <main
                className={`panel-main ratehonk-page-skin min-w-0 flex-1 ${
                  isCreateTemplatePage
                    ? "overflow-visible"
                    : isFullHeightCanvasPage
                      ? "min-h-0 overflow-hidden flex flex-col"
                      : "min-h-0 overflow-auto"
                }`}
              >
                <RatehonkSkinProvider>{children}</RatehonkSkinProvider>
              </main>
            </div>
          </div>
        </div>
      </ReminderProvider>
    </SidebarProvider>
  );
}
