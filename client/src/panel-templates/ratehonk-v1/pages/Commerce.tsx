/**
 * Nova (ratehonk-v1) — Commerce with Figma-aligned chrome.
 */
import CommercePage from "@/pages/commerce-page";
import { RatehonkSkinProvider } from "../RatehonkSkinContext";
import { RhPageHeader, RhPageLayout } from "../components/rh";

export default function RatehonkCommercePage() {
  return (
    <RatehonkSkinProvider>
      <RhPageLayout className="ratehonk-commerce" data-ratehonk-page="Commerce">
        <RhPageHeader
          title="Commerce"
          description="Meta catalog, store sync, and WhatsApp product messages."
        />
        <div className="ratehonk-commerce-content">
          <CommercePage embedded />
        </div>
      </RhPageLayout>
    </RatehonkSkinProvider>
  );
}
