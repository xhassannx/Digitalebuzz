import LeadStatusSettingsPage from "@/pages/lead-status-settings-page";
import { RatehonkSkinProvider } from "../RatehonkSkinContext";
import { RhPageHeader, RhPageLayout } from "../components/rh";

export default function RatehonkLeadStatusSettingsPage() {
  return (
    <RatehonkSkinProvider>
      <RhPageLayout className="ratehonk-lead-status px-6 sm:px-8 md:px-12 lg:px-16" data-ratehonk-page="LeadStatusSettings">
        <RhPageHeader
          title="Lead Status"
          description="Configure pipeline columns for the Leads board."
        />
        <div className="ratehonk-lead-status-content min-w-0">
          <LeadStatusSettingsPage />
        </div>
      </RhPageLayout>
    </RatehonkSkinProvider>
  );
}
