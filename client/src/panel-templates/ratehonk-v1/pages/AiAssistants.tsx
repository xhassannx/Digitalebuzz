/** RateHonk AI Assistants — Figma node 1:2252 */
import AiAssistantsPage from "@/pages/ai-assistants-page";
import { RatehonkSkinProvider } from "../RatehonkSkinContext";
import { RhPageHeader, RhPageLayout } from "../components/rh";

export default function RatehonkAiAssistantsPage() {
  return (
    <RatehonkSkinProvider>
      <RhPageLayout className="ratehonk-ai-assistants" data-ratehonk-page="AiAssistants">
        <RhPageHeader
          title="AI Assistants"
          description="Configure AI assistants for your team and automations."
        />
        <div className="ratehonk-ai-assistants-content">
          <AiAssistantsPage />
        </div>
      </RhPageLayout>
    </RatehonkSkinProvider>
  );
}
