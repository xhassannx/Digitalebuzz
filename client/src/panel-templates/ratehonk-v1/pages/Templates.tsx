/** Nova / Atlas — WhatsApp Templates (full-height, table scrolls) */
import TemplatesPage from "@/pages/templates-page";
import { RatehonkSkinProvider } from "../RatehonkSkinContext";
import { RhPageLayout } from "../components/rh";

export default function RatehonkTemplatesPage() {
  return (
    <RatehonkSkinProvider>
      <RhPageLayout
        fullBleed
        className="ratehonk-templates flex h-full min-h-0 flex-1 flex-col overflow-hidden px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8"
        data-ratehonk-page="Templates"
      >
        <div className="ratehonk-templates-content flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <TemplatesPage />
        </div>
      </RhPageLayout>
    </RatehonkSkinProvider>
  );
}
