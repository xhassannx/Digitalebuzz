import { SidebarTrigger } from "@/components/ui/sidebar";
import { HeaderReminderButton } from "@/components/header-reminder-button";
import { ThemeSelector } from "@/components/theme-selector";

export function PanelHeader() {
  return (
    <header className="flex shrink-0 items-center justify-between border-b p-2">
      <SidebarTrigger data-testid="button-sidebar-toggle" />
      <div className="flex items-center gap-2">
        <span className="mr-1 text-base font-bold text-orange-500 dark:text-orange-400">
          Reminders
        </span>
        <HeaderReminderButton />
        <ThemeSelector />
      </div>
    </header>
  );
}
