import { Shield } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type SidebarAdminModeToggleProps = {
  adminMode: boolean;
  onAdminModeChange: (enabled: boolean) => void;
  className?: string;
};

/** Top-of-sidebar switch: platform menus vs admin menus (SaaS owner only). */
export function SidebarAdminModeToggle({
  adminMode,
  onAdminModeChange,
  className,
}: SidebarAdminModeToggleProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-[#f9f9ff] px-2.5 py-2",
        "group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-1 group-data-[collapsible=icon]:px-1.5 group-data-[collapsible=icon]:py-2",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:justify-center">
        <Shield
          className={cn(
            "h-4 w-4 shrink-0",
            adminMode ? "text-[#0059bb]" : "text-[#717786]",
          )}
          aria-hidden
        />
        <Label
          htmlFor="sidebar-admin-mode"
          className="cursor-pointer text-xs font-medium leading-tight text-[#414754] group-data-[collapsible=icon]:sr-only"
        >
          {adminMode ? "Admin menu" : "Platform menu"}
        </Label>
      </div>
      <Switch
        id="sidebar-admin-mode"
        checked={adminMode}
        onCheckedChange={onAdminModeChange}
        aria-label={adminMode ? "Showing admin menu" : "Showing platform menu"}
        className="shrink-0"
      />
    </div>
  );
}
