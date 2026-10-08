/**
 * RateHonk Gallery — Figma node 1:2650
 * https://www.figma.com/design/ghxCXiMgnQ5J8IGhPvTPMx/Rh-whatsapp?node-id=1-2650
 */
import GalleryPage from "@/pages/gallery-page";
import { RatehonkSkinProvider } from "../RatehonkSkinContext";
import { RhPageHeader, RhPageLayout } from "../components/rh";

export default function RatehonkGalleryPage() {
  return (
    <RatehonkSkinProvider>
      <RhPageLayout className="ratehonk-gallery" data-ratehonk-page="Gallery">
        <RhPageHeader
          title="Gallery"
          description="Media library for templates, campaigns, and quick replies."
        />
        <div className="ratehonk-gallery-content">
          <GalleryPage />
        </div>
      </RhPageLayout>
    </RatehonkSkinProvider>
  );
}
