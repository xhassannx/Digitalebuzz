/**
 * Nova (ratehonk-v1) — WhatsApp Chat Widget settings.
 */
import WhatsAppChatWidgetPage from "@/pages/whatsapp-chat-widget-page";
import { RatehonkSkinProvider } from "../RatehonkSkinContext";
import { RhPageLayout } from "../components/rh";

export default function RatehonkWhatsAppChatWidgetPage() {
  return (
    <RatehonkSkinProvider>
      <RhPageLayout
        className="ratehonk-whatsapp-chat-widget"
        data-ratehonk-page="WhatsApp Chat Widget"
      >
        <div className="ratehonk-whatsapp-chat-widget-content">
          <WhatsAppChatWidgetPage embedded />
        </div>
      </RhPageLayout>
    </RatehonkSkinProvider>
  );
}
