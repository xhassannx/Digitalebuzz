/**
 * Nova / Atlas — WhatsApp Link Generator (template-aware shell).
 */
import WhatsAppLinkGeneratorPage from "@/pages/whatsapp-link-generator-page";
import { RatehonkSkinProvider } from "../RatehonkSkinContext";
import { RhPageLayout } from "../components/rh";

export default function RatehonkWhatsAppLinkGeneratorPage() {
  return (
    <RatehonkSkinProvider>
      <RhPageLayout
        className="ratehonk-wa-link-generator"
        data-ratehonk-page="WhatsApp Link Generator"
      >
        <div className="ratehonk-wa-link-generator-content">
          <WhatsAppLinkGeneratorPage embedded />
        </div>
      </RhPageLayout>
    </RatehonkSkinProvider>
  );
}
