import type { CSSProperties } from "react";
import type { PanelTemplateLayoutProps } from "../types";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./components/AppSidebar";
import { PanelHeader } from "./components/PanelHeader";
import { OnboardingOutstandingBanner } from "@/components/onboarding-outstanding-banner";
import { SubscriptionExpiryBanner } from "@/components/subscription-expiry-banner";
import { ReminderProvider } from "@/contexts/reminder-context";
import { tokens } from "./tokens";
import { RatehonkSkinProvider } from "./RatehonkSkinContext";
import "./theme.css";
import "./ratehonk-global.css";
import "./page-skin.css";
import "./inbox.css";
import "./inbox-nova.css";
import "./integrations.css";
import "./commerce.css";
import "./settings.css";
import "./gallery.css";
import "./flows.css";
import "./panel-pages.css";
import "./ratehonk-responsive.css";
import "./dialogs-forms.css";
import "./toasts.css";
import "./tables-mobile.css";
import "./builder-canvas.css";
import "./dashboard-nova.css";
import "./invoice.css";
import "./whatsapp-chat-widget.css";
import "./whatsapp-link-generator.css";

const sidebarStyle = {
  "--sidebar-width": tokens.layout.sidebarWidth,
  "--sidebar-width-icon": "4rem",
} as CSSProperties;

export function PanelLayout({ children, layoutFlags }: PanelTemplateLayoutProps) {
  const { isCreateTemplatePage, isFullHeightCanvasPage } = layoutFlags;

  return (
    <SidebarProvider style={sidebarStyle} defaultOpen>
      <ReminderProvider>
        <div
          className={`flex min-h-0 w-full min-w-0 flex-col ${isCreateTemplatePage ? "min-h-screen" : "h-screen"}`}
          data-panel-template="ratehonk-v1"
          data-rh-shell=""
          style={{
            fontFamily: tokens.font.sans,
            backgroundColor: tokens.colors.pageBg,
          }}
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
