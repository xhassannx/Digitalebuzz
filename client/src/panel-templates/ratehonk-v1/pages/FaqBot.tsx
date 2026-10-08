/** RateHonk FAQ Bot — Figma node 1:1971 */
import FAQBotPage from "@/pages/faq-bot-page";
import { RatehonkSkinProvider } from "../RatehonkSkinContext";
import { RhPageHeader, RhPageLayout } from "../components/rh";

export default function RatehonkFaqBotPage() {
  return (
    <RatehonkSkinProvider>
      <RhPageLayout className="ratehonk-faq-bot" data-ratehonk-page="FaqBot">
        <RhPageHeader
          title="FAQ Bot"
          description="Configure automated FAQ responses for your customers."
        />
        <div className="ratehonk-faq-bot-content">
          <FAQBotPage />
        </div>
      </RhPageLayout>
    </RatehonkSkinProvider>
  );
}
