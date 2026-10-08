/** RateHonk / Atlas Campaigns — shared shell; brand via --rh-brand */
import CampaignsPage from "@/pages/campaigns-page";
import { RatehonkSkinProvider } from "../RatehonkSkinContext";
import { RhPageHeader, RhPageLayout } from "../components/rh";

export default function RatehonkCampaignsPage() {
  return (
    <RatehonkSkinProvider>
      <RhPageLayout className="ratehonk-campaigns" data-ratehonk-page="Campaigns">
        <RhPageHeader
          title="Campaigns"
          description="Create and manage bulk messaging campaigns."
        />
        <div className="ratehonk-campaigns-content min-w-0">
          <CampaignsPage />
        </div>
      </RhPageLayout>
    </RatehonkSkinProvider>
  );
}
