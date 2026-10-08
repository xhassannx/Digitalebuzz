/**
 * Atlas Reminders — GHL-style Tasks table (Emerald skin via reminders-atlas.css).
 * Behaviour shared with Nova through RemindersPage + useRemindersPage.
 */
import RemindersPage from "@/pages/reminders-page";
import { RatehonkSkinProvider } from "../../ratehonk-v1/RatehonkSkinContext";
import { RhPageLayout } from "../../ratehonk-v1/components/rh";

export default function AtlasRemindersPage() {
  return (
    <RatehonkSkinProvider>
      <RhPageLayout
        fullBleed
        className="ratehonk-reminders atlas-reminders flex h-full min-h-0 flex-1 flex-col overflow-hidden px-4 py-3 sm:px-6 sm:py-4 md:px-8 md:py-4"
        data-ratehonk-page="Reminders"
      >
        <div className="ratehonk-reminders-content flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <RemindersPage />
        </div>
      </RhPageLayout>
    </RatehonkSkinProvider>
  );
}
