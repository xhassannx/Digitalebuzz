/** RateHonk Leads — CRM-style lead list */
import LeadsPage from "@/pages/leads-page";
import { RatehonkSkinProvider } from "../RatehonkSkinContext";
import { RhPageHeader, RhPageLayout } from "../components/rh";

export default function RatehonkLeadsPage() {
  return (
    <RatehonkSkinProvider>
      <RhPageLayout
        fullBleed
        className="ratehonk-leads flex h-full min-h-0 flex-1 flex-col px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8"
        data-ratehonk-page="Leads"
      >
        <div className="shrink-0">
          <RhPageHeader
            title="Leads"
            description="First-time WhatsApp messages and manually added prospects."
          />
        </div>
        <div className="ratehonk-leads-content flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <LeadsPage />
        </div>
      </RhPageLayout>
    </RatehonkSkinProvider>
  );
}
