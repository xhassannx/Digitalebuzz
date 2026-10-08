/** RateHonk Chatbots — Figma node 1:2104 */
import ChatbotsPage from "@/pages/chatbots-page";
import { RatehonkSkinProvider } from "../RatehonkSkinContext";
import { RhPageHeader, RhPageLayout } from "../components/rh";

export default function RatehonkChatbotsPage() {
  return (
    <RatehonkSkinProvider>
      <RhPageLayout className="ratehonk-chatbots" data-ratehonk-page="Chatbots">
        <RhPageHeader
          title="Chatbots"
          description="Build and manage conversational chatbot flows."
        />
        <div className="ratehonk-chatbots-content">
          <ChatbotsPage />
        </div>
      </RhPageLayout>
    </RatehonkSkinProvider>
  );
}
