import DummyChatbotsPage from "@/pages/dummy-chatbots-page";
import { RatehonkSkinProvider } from "../RatehonkSkinContext";
import { RhPageHeader, RhPageLayout } from "../components/rh";

export default function RatehonkDummyChatbotsPage() {
  return (
    <RatehonkSkinProvider>
      <RhPageLayout className="ratehonk-chatbots" data-ratehonk-page="DummyChatbots">
        <RhPageHeader
          title="Dummy Chatbots"
          description="Preview dummy chatbot templates and use them in your flows."
        />
        <div className="ratehonk-chatbots-content">
          <DummyChatbotsPage />
        </div>
      </RhPageLayout>
    </RatehonkSkinProvider>
  );
}
