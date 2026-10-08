import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { AddonSidebarFeature } from "@/components/addon-feature-route";
import {
  MessageSquare,
  QrCode,
  Settings,
  Code2,
  CreditCard,
  Users,
  ContactRound,
  Megaphone,
  Building2,
  LayoutDashboard,
  LogOut,
  UserCircle,
  ChevronUp,
  Plug,
  Image,
  Bot,
  Palette,
  LayoutTemplate,
  Tag,
  Columns,
  Bell,
  Webhook,
  Workflow,
  GitBranch,
  Code,
  FileText,
  FileKey,
  Wallet,
  Banknote,
  Phone,
  RotateCcw,
  Share2,
  ShieldCheck,
  Package,
  Receipt,
  UserPlus,
  Download,
  Sparkles,
  LifeBuoy,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";

import { SidebarMenuCollapsibleGroup } from "@/components/sidebar-menu-collapsible-group";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useAuth } from "@/hooks/useAuth";
import { useCurrentMemberPermissions } from "@/hooks/useCurrentMemberPermissions";
import { useWhiteLabelConfig } from "@/hooks/useWhiteLabelConfig";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { PWAInstallInstructionsDialog } from "@/components/pwa-install-prompt";
import { SidebarAdminModeToggle } from "@/components/sidebar-admin-mode-toggle";
import { useSidebarAdminMode } from "@/hooks/use-sidebar-admin-mode";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

import {
  adminMenuItems,
  manageMenuItems,
  platformMenuItems as menuItems,
  platformTopMenuItems,
  platformTopMenuItemsBeforeLeads,
  platformTopMenuItemsAfterLeads,
  invoiceMenuItems,
  leadsMenuItems,
  websiteMenuItems,
  isSidebarLinkActive,
} from "@/panel-templates/shared/sidebar-menu-config";

/* ---------------- COMPONENT ---------------- */

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { hasPermission } = useCurrentMemberPermissions();
  const { data: addonMenuFeatures } = useQuery({
    queryKey: ["/api/auth/addon-menu-features"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/auth/addon-menu-features");
      return res.json() as Promise<{
        webhookEvents: boolean;
        chatbot: boolean;
        flows: boolean;
        dripCampaigns: boolean;
        hasAssignments: boolean;
      }>;
    },
    staleTime: 30_000,
  });

  const allowAddonMenu = (key: AddonSidebarFeature): boolean => {
    if (user?.isSaaSOwner) return true;
    if (!addonMenuFeatures) return false;
    if (!addonMenuFeatures.hasAssignments) return false;
    return addonMenuFeatures[key];
  };
  const { config } = useWhiteLabelConfig();
  const { isInstalled, install, canNativeInstall, canShowInstallEntry } = usePWAInstall();
  const { toast } = useToast();
  const [installHelpOpen, setInstallHelpOpen] = useState(false);
  const { isAdminUser, adminMode, setAdminMode, showAdminMenus, showPlatformMenus } =
    useSidebarAdminMode();

  // Get logo from white-label-logo page config
  const whiteLabelLogoConfig = config?.["white-label-logo"] as { logoUrl?: string; logoSize?: number } | undefined;
  const logoUrl = whiteLabelLogoConfig?.logoUrl;
  const logoSize = whiteLabelLogoConfig?.logoSize || 60; // Default size for sidebar (larger than header)

  const [isManageOpen, setIsManageOpen] = useState(
    manageMenuItems.some(
      (item) => location === item.url || location.startsWith(item.url + "/")
    )
  );
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(
    invoiceMenuItems.some((item) => isSidebarLinkActive(location, item.url)),
  );
  const [isLeadsOpen, setIsLeadsOpen] = useState(
    leadsMenuItems.some((item) => isSidebarLinkActive(location, item.url)),
  );
  const [isWebsiteOpen, setIsWebsiteOpen] = useState(
    websiteMenuItems.some((item) =>
      item.url === "/website" ? location === "/website" : location.startsWith(item.url),
    ),
  );

  const handleLogout = () => {
    void logout();
  };

  const handleInstall = async () => {
    if (canNativeInstall) {
      const installed = await install();
      toast({
        title: installed ? "App installed" : "Installation cancelled",
        description: installed
          ? "Open Inbox from your home screen anytime."
          : "You can install later from the account menu.",
        variant: installed ? "default" : "destructive",
      });
      return;
    }
    setInstallHelpOpen(true);
  };

  const userInitials = user?.email?.slice(0, 2).toUpperCase() || "US";
  const userName = user?.email?.split("@")[0] || "User";

  /* COMPACT MENU BUTTON */
  const menuBtnClass =
    "h-10 px-4 text-[15px] font-medium rounded-lg transition-colors duration-200 " +
    "hover:bg-gray-100 data-[active=true]:bg-gray-200 text-gray-900 " +
    "dark:hover:bg-gray-800 dark:data-[active=true]:bg-gray-700 dark:text-gray-50";

  const filterPlatformItem = (item: (typeof platformTopMenuItems)[number]) => {
    if (item.addonFeature && !allowAddonMenu(item.addonFeature)) return false;
    if (!item.permission) return true;
    const perms = Array.isArray(item.permission) ? item.permission : [item.permission];
    return perms.some((p) => hasPermission(p));
  };

  const filteredLeadsMenuItems = leadsMenuItems.filter((item) => {
    if (item.addonFeature && !allowAddonMenu(item.addonFeature)) return false;
    if (!item.permission) return true;
    const perms = Array.isArray(item.permission) ? item.permission : [item.permission];
    return perms.some((p) => hasPermission(p));
  });

  const renderPlatformTopItem = (item: (typeof platformTopMenuItems)[number]) => (
    <SidebarMenuItem key={item.url}>
      <SidebarMenuButton
        asChild
        tooltip={item.title}
        className={menuBtnClass}
        isActive={
          item.url === "/chat"
            ? location.startsWith("/chat")
            : location === item.url || location.startsWith(item.url + "/")
        }
      >
        <Link href={item.url}>
          <item.icon className="h-5 w-5" />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar
      collapsible="icon"
      defaultCollapsed
      className="bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-50"
    >
      {/* ───── HEADER ───── */}
      <SidebarHeader
        className={cn(
          "flex flex-col gap-2 border-b border-gray-200 px-3 py-3 dark:border-gray-800",
          isAdminUser ? "min-h-0" : "h-16 items-center justify-center",
        )}
      >
        <Link href="/dashboard" className="flex items-center justify-center gap-2 sm:gap-3">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo"
              style={{
                width: `${logoSize}px`,
                height: `${logoSize}px`,
              }}
              className="object-contain rounded-lg"
            />
          ) : (
            " "
          )}
        </Link>
        {isAdminUser && (
          <SidebarAdminModeToggle
            adminMode={adminMode}
            onAdminModeChange={setAdminMode}
            className="w-full border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50"
          />
        )}
      </SidebarHeader>

      {/* ───── CONTENT ───── */}
   {/* <SidebarContent
  className={`
    transition-all
    ${isManageOpen ? "overflow-hidden" : "overflow-y-auto"}
    data-[collapsible=icon]:overflow-visible
  `}
> */}

<SidebarContent
  className="
    overflow-y-auto
    data-[collapsible=icon]:overflow-visible
  "
>
    {showPlatformMenus && (
     <SidebarGroup>
          <SidebarGroupLabel className="text-gray-700 dark:text-gray-300 group-data-[collapsible=icon]:hidden">
            Platform
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {platformTopMenuItemsBeforeLeads.filter(filterPlatformItem).map(renderPlatformTopItem)}

              {filteredLeadsMenuItems.length > 0 && (
                <SidebarMenuCollapsibleGroup
                  label="Leads"
                  icon={UserPlus}
                  items={filteredLeadsMenuItems}
                  open={isLeadsOpen}
                  onOpenChange={setIsLeadsOpen}
                  isGroupActive={leadsMenuItems.some((item) => isSidebarLinkActive(location, item.url))}
                  isItemActive={(url) => isSidebarLinkActive(location, url)}
                  menuBtnClass={menuBtnClass}
                  subMenuBtnClass="h-9 px-3 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                  subMenuClassName="ml-2 border-l border-gray-200 dark:border-gray-800 pl-2"
                />
              )}

              {platformTopMenuItemsAfterLeads.filter(filterPlatformItem).map(renderPlatformTopItem)}

              <SidebarMenuCollapsibleGroup
                label="Manage"
                icon={Settings}
                items={manageMenuItems.filter((item) => {
                  if (item.addonFeature && !allowAddonMenu(item.addonFeature)) return false;
                  if (!item.permission) return true;
                  const perms = Array.isArray(item.permission) ? item.permission : [item.permission];
                  return perms.some((p) => hasPermission(p));
                })}
                open={isManageOpen}
                onOpenChange={setIsManageOpen}
                isGroupActive={manageMenuItems.some(
                  (item) =>
                    location === item.url || location.startsWith(item.url + "/"),
                )}
                isItemActive={(url) => location === url || location.startsWith(url + "/")}
                menuBtnClass={menuBtnClass}
                subMenuBtnClass="h-9 px-3 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                subMenuClassName="ml-2 border-l border-gray-200 dark:border-gray-800 pl-2"
              />

              {invoiceMenuItems.filter((item) => {
                if (item.addonFeature && !allowAddonMenu(item.addonFeature)) return false;
                if (!item.permission) return true;
                const perms = Array.isArray(item.permission) ? item.permission : [item.permission];
                return perms.some((p) => hasPermission(p));
              }).length > 0 && (
                <SidebarMenuCollapsibleGroup
                  label="Invoice"
                  icon={Receipt}
                  items={invoiceMenuItems.filter((item) => {
                    if (item.addonFeature && !allowAddonMenu(item.addonFeature)) return false;
                    if (!item.permission) return true;
                    const perms = Array.isArray(item.permission) ? item.permission : [item.permission];
                    return perms.some((p) => hasPermission(p));
                  })}
                  open={isInvoiceOpen}
                  onOpenChange={setIsInvoiceOpen}
                  isGroupActive={invoiceMenuItems.some((item) => isSidebarLinkActive(location, item.url))}
                  isItemActive={(url) => isSidebarLinkActive(location, url)}
                  menuBtnClass={menuBtnClass}
                  subMenuBtnClass="h-9 px-3 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                  subMenuClassName="ml-2 border-l border-gray-200 dark:border-gray-800 pl-2"
                />
              )}

              {/* Other menus */}
              {menuItems
                .filter((item) => {
                  if (item.addonFeature && !allowAddonMenu(item.addonFeature)) return false;
                  if (!item.permission) return true;
                  const perms = Array.isArray(item.permission) ? item.permission : [item.permission];
                  return perms.some((p) => hasPermission(p));
                })
                .map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                       tooltip={item.title}
                      className={menuBtnClass}
                      isActive={location === item.url}
                    >
                      <Link href={item.url}>
                        <item.icon className="h-5 w-5" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
    )}
    {showAdminMenus && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-gray-700 dark:text-gray-300 group-data-[collapsible=icon]:hidden">
              Admin
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-0.5">
                {adminMenuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      className={menuBtnClass}
                      isActive={location === item.url}
                    >
                      <Link href={item.url}>
                        <item.icon className="h-5 w-5" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                <SidebarMenuCollapsibleGroup
                  label="Website Builder"
                  icon={Settings}
                  items={websiteMenuItems}
                  open={isWebsiteOpen}
                  onOpenChange={setIsWebsiteOpen}
                  isGroupActive={websiteMenuItems.some((item) =>
                    item.url === "/website" ? location === "/website" : location.startsWith(item.url),
                  )}
                  isItemActive={(url) =>
                    url === "/website" ? location === "/website" : location.startsWith(url)
                  }
                  menuBtnClass={menuBtnClass}
                  subMenuBtnClass="h-9 px-3 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                  subMenuClassName="ml-2 border-l border-gray-200 dark:border-gray-800 pl-2"
                />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

      </SidebarContent>

      {/* ───── FOOTER ───── */}
      <SidebarFooter className="border-t border-gray-200 dark:border-gray-800 p-2">
        <DropdownMenu>
         <DropdownMenuTrigger asChild>
  <button
    className="
      flex w-full items-center gap-3 rounded-xl p-3
      hover:bg-gray-100 dark:hover:bg-gray-800
      group-data-[collapsible=icon]:justify-center
      group-data-[collapsible=icon]:p-2
    "
  >
    <Avatar className="h-9 w-9">
      <AvatarFallback>{userInitials}</AvatarFallback>
    </Avatar>

    {/* hide user info when collapsed */}
    <div className="flex-1 text-left group-data-[collapsible=icon]:hidden">
      <p className="text-sm font-medium">{userName}</p>
      <p className="text-xs text-gray-600 dark:text-gray-400">{user?.email}</p>
    </div>

    {/* hide chevron when collapsed */}
    <ChevronUp className="h-4 w-4 group-data-[collapsible=icon]:hidden" />
  </button>
</DropdownMenuTrigger>

          <DropdownMenuContent side="top" align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <UserCircle className="mr-2 h-4 w-4" />
                Profile & Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/billing">
                <CreditCard className="mr-2 h-4 w-4" />
                Billing
              </Link>
            </DropdownMenuItem>
            {canShowInstallEntry && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void handleInstall()}>
                  <Download className="mr-2 h-4 w-4" />
                  Install app shortcut
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
      <PWAInstallInstructionsDialog open={installHelpOpen} onOpenChange={setInstallHelpOpen} />
    </Sidebar>
  );
}
