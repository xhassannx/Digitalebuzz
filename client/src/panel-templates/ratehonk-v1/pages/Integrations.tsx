/**
 * RateHonk Integrations — Figma node 1:365
 * https://www.figma.com/design/ghxCXiMgnQ5J8IGhPvTPMx/Rh-whatsapp?node-id=1-365
 */
import IntegrationsPage from "@/pages/integrations-page";
import { RatehonkSkinProvider } from "../RatehonkSkinContext";
import { RhPageHeader, RhPageLayout } from "../components/rh";

export default function RatehonkIntegrationsPage() {
  return (
    <RatehonkSkinProvider>
      <RhPageLayout className="ratehonk-integrations" data-ratehonk-page="Integrations">
        <RhPageHeader
          title="Integrations"
          description="Connect third-party services to your workspace."
        />
        <div className="ratehonk-integrations-content">
          <IntegrationsPage />
        </div>
      </RhPageLayout>
    </RatehonkSkinProvider>
  );
}
