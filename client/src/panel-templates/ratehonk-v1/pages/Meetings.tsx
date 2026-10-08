/** Nova / Atlas — Meetings calendar (full-height) */
import MeetingsPage from "@/pages/meetings-page";
import { RatehonkSkinProvider } from "../RatehonkSkinContext";
import { RhPageLayout } from "../components/rh";

export default function RatehonkMeetingsPage() {
  return (
    <RatehonkSkinProvider>
      <RhPageLayout
        fullBleed
        className="ratehonk-meetings flex h-full min-h-0 flex-1 flex-col overflow-hidden px-4 py-3 sm:px-6 sm:py-4 md:px-8 md:py-4"
        data-ratehonk-page="Meetings"
      >
        <div className="ratehonk-meetings-content flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <MeetingsPage />
        </div>
      </RhPageLayout>
    </RatehonkSkinProvider>
  );
}
