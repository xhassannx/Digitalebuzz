/**
 * RateHonk Flows — Figma node 1:2444
 * https://www.figma.com/design/ghxCXiMgnQ5J8IGhPvTPMx/Rh-whatsapp?node-id=1-2444
 */
import FlowsPage from "@/pages/flows-page";
import { RatehonkSkinProvider } from "../RatehonkSkinContext";
import { RhPageHeader, RhPageLayout } from "../components/rh";

export default function RatehonkFlowsPage() {
  return (
    <RatehonkSkinProvider>
      <RhPageLayout fullBleed className="ratehonk-flows flex h-full min-h-0 flex-col" data-ratehonk-page="Flows">
        <div className="shrink-0 px-6 pt-6 md:px-8">
          <RhPageHeader
            title="Flows"
            description="Create and manage automation workflows for your conversations."
          />
        </div>
        <div className="ratehonk-flows-content min-h-0 flex-1 overflow-hidden">
          <FlowsPage />
        </div>
      </RhPageLayout>
    </RatehonkSkinProvider>
  );
}
