import type { CSSProperties } from "react";
import type { PanelTemplateLayoutProps } from "../types";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./components/AppSidebar";
import { PanelHeader } from "./components/PanelHeader";
import { OnboardingOutstandingBanner } from "@/components/onboarding-outstanding-banner";
import { SubscriptionExpiryBanner } from "@/components/subscription-expiry-banner";
import { ReminderProvider } from "@/contexts/reminder-context";
import { tokens } from "./tokens";
import "./theme.css";

const sidebarStyle = {
  "--sidebar-width": tokens.layout.sidebarWidth,
  "--sidebar-width-icon": "3rem",
} as CSSProperties;

export function PanelLayout({ children, layoutFlags }: PanelTemplateLayoutProps) {
  const { isCreateTemplatePage, isFullHeightCanvasPage } = layoutFlags;

  return (
    <SidebarProvider style={sidebarStyle}>
      <ReminderProvider>
        <div
          className={`flex w-full min-w-0 flex-col ${isCreateTemplatePage ? "min-h-screen" : "h-screen"}`}
          data-panel-template="default"
        >
          <SubscriptionExpiryBanner />
          <div className="flex min-h-0 min-w-0 flex-1">
            <AppSidebar />
            <div className="flex min-w-0 flex-1 flex-col min-h-0">
              <PanelHeader />
              <OnboardingOutstandingBanner />
              <main
                className={`panel-main min-w-0 flex-1 ${
                  isCreateTemplatePage
                    ? "overflow-visible"
                    : isFullHeightCanvasPage
                      ? "min-h-0 overflow-hidden flex flex-col"
                      : "min-h-0 overflow-auto"
                }`}
              >
                {children}
              </main>
            </div>
          </div>
        </div>
      </ReminderProvider>
    </SidebarProvider>
  );
}
