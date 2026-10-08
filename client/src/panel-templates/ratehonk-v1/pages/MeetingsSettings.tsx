/** Nova / Atlas — Meetings settings (booking calendars) */
import MeetingsSettingsPage from "@/pages/meetings-settings-page";
import { RatehonkSkinProvider } from "../RatehonkSkinContext";
import { RhPageLayout } from "../components/rh";

export default function RatehonkMeetingsSettingsPage() {
  return (
    <RatehonkSkinProvider>
      <RhPageLayout
        fullBleed
        className="ratehonk-meetings-settings flex h-full min-h-0 flex-1 flex-col overflow-hidden px-4 py-3 sm:px-6 sm:py-4 md:px-8 md:py-4"
        data-ratehonk-page="MeetingsSettings"
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <MeetingsSettingsPage />
        </div>
      </RhPageLayout>
    </RatehonkSkinProvider>
  );
}
