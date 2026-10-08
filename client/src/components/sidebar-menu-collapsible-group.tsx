import type { ComponentType } from "react";
import { Link } from "wouter";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";

export type SidebarCollapsibleMenuItem = {
  title: string;
  url: string;
  icon: ComponentType<{ className?: string }>;
};

type SidebarMenuCollapsibleGroupProps = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  items: SidebarCollapsibleMenuItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isGroupActive?: boolean;
  isItemActive: (url: string) => boolean;
  onItemNavigate?: () => void;
  menuBtnClass?: string;
  subMenuBtnClass?: string;
  subMenuClassName?: string;
};

/**
 * Sidebar group with children: accordion when expanded, flyout menu when collapsed to icon rail.
 */
export function SidebarMenuCollapsibleGroup({
  label,
  icon: Icon,
  items,
  open,
  onOpenChange,
  isGroupActive = false,
  isItemActive,
  onItemNavigate,
  menuBtnClass,
  subMenuBtnClass,
  subMenuClassName,
}: SidebarMenuCollapsibleGroupProps) {
  const { state, isMobile } = useSidebar();
  const iconRail = state === "collapsed" && !isMobile;

  if (items.length === 0) {
    return null;
  }

  if (iconRail) {
    return (
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              className={menuBtnClass}
              isActive={isGroupActive}
              aria-label={label}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="sr-only">{label}</span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="right"
            align="start"
            sideOffset={8}
            className="min-w-[12rem]"
          >
            <DropdownMenuLabel>{label}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {items.map((item) => (
              <DropdownMenuItem key={item.url} asChild>
                <Link
                  href={item.url}
                  className={cn(
                    "flex cursor-pointer items-center gap-2",
                    isItemActive(item.url) && "bg-accent font-medium text-accent-foreground",
                  )}
                  onClick={onItemNavigate}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span>{item.title}</span>
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton className={menuBtnClass} isActive={isGroupActive}>
            <Icon className="h-5 w-5 shrink-0" />
            <span className="flex-1 text-left">{label}</span>
            <ChevronDown
              className={cn(
                "ml-auto h-4 w-4 shrink-0 transition-transform",
                open && "rotate-180",
              )}
            />
          </SidebarMenuButton>
        </CollapsibleTrigger>
      </SidebarMenuItem>
      <CollapsibleContent>
        <SidebarMenuSub className={subMenuClassName}>
          {items.map((item) => (
            <SidebarMenuSubItem key={item.url}>
              <SidebarMenuSubButton
                asChild
                isActive={isItemActive(item.url)}
                className={subMenuBtnClass}
              >
                <Link href={item.url} onClick={onItemNavigate}>
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  );
}
