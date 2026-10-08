/** Atlas — Meetings calendar */
import MeetingsPage from "@/pages/meetings-page";
import { RatehonkSkinProvider } from "../../ratehonk-v1/RatehonkSkinContext";
import { RhPageLayout } from "../../ratehonk-v1/components/rh";

export default function AtlasMeetingsPage() {
  return (
    <RatehonkSkinProvider>
      <RhPageLayout
        fullBleed
        className="atlas-meetings-shell ratehonk-meetings flex h-full min-h-0 flex-1 flex-col overflow-hidden px-4 py-3 sm:px-6 sm:py-4 md:px-8 md:py-4"
        data-ratehonk-page="Meetings"
      >
        <div className="ratehonk-meetings-content flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <MeetingsPage />
        </div>
      </RhPageLayout>
    </RatehonkSkinProvider>
  );
}
