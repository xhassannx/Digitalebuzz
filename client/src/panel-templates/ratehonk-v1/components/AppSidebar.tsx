import { useState, useEffect } from "react";

import { Link, useLocation } from "wouter";

import {

  ChevronUp,

  CreditCard,

  Download,

  LogOut,

  Megaphone,

  Receipt,

  Settings,

  UserCircle,

  UserPlus,

} from "lucide-react";

import { cn } from "@/lib/utils";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";

import { useWhiteLabelConfig } from "@/hooks/useWhiteLabelConfig";

import { usePWAInstall } from "@/hooks/usePWAInstall";
import { PWAInstallInstructionsDialog } from "@/components/pwa-install-prompt";

import { useToast } from "@/hooks/use-toast";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";

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

  Sidebar,

  SidebarContent,

  SidebarFooter,

  SidebarGroup,

  SidebarGroupContent,

  SidebarGroupLabel,

  SidebarHeader,

  SidebarMenu,

  SidebarMenuButton,

  SidebarMenuItem,

  SidebarRail,

  useSidebar,

} from "@/components/ui/sidebar";

import { usePanelSidebarMenu } from "@/panel-templates/shared/usePanelSidebarMenu";
import { useSidebarAdminMode } from "@/hooks/use-sidebar-admin-mode";
import { SidebarAdminModeToggle } from "@/components/sidebar-admin-mode-toggle";
import { SidebarMenuCollapsibleGroup } from "@/components/sidebar-menu-collapsible-group";

import type { SidebarMenuItemDef } from "@/panel-templates/shared/sidebar-menu-config";

import { tokens } from "../tokens";



function isUsableLogoUrl(url?: string): boolean {

  if (!url?.trim()) return false;

  return (

    url.startsWith("http://") ||

    url.startsWith("https://") ||

    url.startsWith("/") ||

    url.startsWith("data:image/")

  );

}



function orgInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (parts.length === 1) {
    return (parts[0][0] ?? "W").toUpperCase();
  }
  return "WP";
}

function BrandMark({ label, className }: { label: string; className?: string }) {
  const initials = orgInitials(label);
  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-black text-white",
        initials.length > 2 ? "text-xs" : "text-sm",
        className,
      )}
      style={{ backgroundColor: tokens.colors.brand }}
      aria-hidden
    >
      {initials}
    </div>
  );
}



const menuBtnClass = cn(

  "h-10 rounded-lg px-3 text-sm font-medium text-[#414754] transition-colors",

  "hover:bg-[#f3f4f6] hover:text-[#111c2d]",

  "data-[active=true]:bg-[var(--rh-nav-active-bg)] data-[active=true]:text-[var(--rh-nav-active-fg)] data-[active=true]:font-semibold",

);



function NavMenuItem({

  item,

  active,

  onNavigate,

}: {

  item: SidebarMenuItemDef;

  active: boolean;

  onNavigate?: () => void;

}) {

  return (

    <SidebarMenuItem>

      <SidebarMenuButton asChild tooltip={item.title} className={menuBtnClass} isActive={active}>

        <Link href={item.url} onClick={onNavigate}>

          <item.icon className="h-5 w-5 shrink-0" />

          <span>{item.title}</span>

        </Link>

      </SidebarMenuButton>

    </SidebarMenuItem>

  );

}



export function AppSidebar() {

  const { user, logout } = useAuth();

  const { data: organizations = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/organizations"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/organizations");
      const data = await res.json();
      return Array.isArray(data) ? data : (data.organizations || []);
    },
    enabled: !!user,
  });

  const panelBrandTitle = organizations[0]?.name?.trim() || "WhatsApp Panel";

  const { config } = useWhiteLabelConfig();

  const { isInstalled, install, canNativeInstall, canShowInstallEntry } = usePWAInstall();

  const { toast } = useToast();
  const [installHelpOpen, setInstallHelpOpen] = useState(false);

  const { setOpenMobile, isMobile } = useSidebar();
  const [location] = useLocation();

  useEffect(() => {
    setOpenMobile(false);
  }, [location, setOpenMobile]);

  const {

    platformTopItemsBeforeLeads,

    platformTopItemsAfterLeads,

    platformItems,

    invoiceItems,

    leadsItems,

    manageItems,

    adminItems,

    websiteItems,

    isManageOpen,

    setIsManageOpen,

    isInvoiceOpen,

    setIsInvoiceOpen,

    isLeadsOpen,

    setIsLeadsOpen,

    isWebsiteOpen,

    setIsWebsiteOpen,

    isActive,

    hasPermission,

  } = usePanelSidebarMenu();

  const { isAdminUser, adminMode, setAdminMode, showAdminMenus, showPlatformMenus } =
    useSidebarAdminMode();

  const logoUrl = (config?.["white-label-logo"] as { logoUrl?: string } | undefined)?.logoUrl;

  const [logoLoadFailed, setLogoLoadFailed] = useState(false);

  const showUploadedLogo = isUsableLogoUrl(logoUrl) && !logoLoadFailed;



  useEffect(() => {

    setLogoLoadFailed(false);

  }, [logoUrl]);



  const closeMobile = () => {

    if (isMobile) setOpenMobile(false);

  };



  const userInitials =

    user?.firstName && user?.lastName

      ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()

      : user?.firstName

        ? user.firstName.slice(0, 2).toUpperCase()

        : user?.email?.slice(0, 2).toUpperCase() || "US";

  const userName = user?.email?.split("@")[0] || "User";

  const displayName =

    user?.firstName && user?.lastName

      ? `${user.firstName} ${user.lastName}`

      : userName.replace(/\b\w/g, (c) => c.toUpperCase());



  return (

    <Sidebar

      collapsible="icon"

      className="ratehonk-sidebar border-[#e5e7eb] bg-white text-[#111c2d]"

      style={{ fontFamily: tokens.font.sans }}

    >

      <SidebarHeader className="border-b border-[#e5e7eb] px-3 py-4">

        <Link

          href="/dashboard"

          className="flex items-center gap-3 overflow-hidden group-data-[collapsible=icon]:justify-center"

          onClick={closeMobile}

        >

          {showUploadedLogo ? (

            <img

              src={logoUrl}

              alt=""

              className="h-10 w-10 shrink-0 rounded-lg object-contain group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8"

              onError={() => setLogoLoadFailed(true)}

            />

          ) : (

            <BrandMark
              label={panelBrandTitle}
              className="group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:text-xs"
            />

          )}

          <div className="min-w-0 group-data-[collapsible=icon]:hidden">

            <p

              className="truncate text-xl font-black leading-none"

              style={{ color: tokens.colors.brand }}

            >

              {panelBrandTitle}

            </p>

            <p className="text-xs font-medium" style={{ color: tokens.colors.textMuted }}>

              Business inbox

            </p>

          </div>

        </Link>

        {isAdminUser && (
          <SidebarAdminModeToggle
            adminMode={adminMode}
            onAdminModeChange={setAdminMode}
            className="mt-3 w-full"
          />
        )}

      </SidebarHeader>



      <SidebarContent className="px-1 py-2">

        {showPlatformMenus && (
        <SidebarGroup>

          <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-wider text-[#717786]">

            Platform

          </SidebarGroupLabel>

          <SidebarGroupContent>

            <SidebarMenu className="gap-0.5">

              {platformTopItemsBeforeLeads.map((item) => (

                <NavMenuItem

                  key={item.url}

                  item={item}

                  active={isActive(item.url)}

                  onNavigate={closeMobile}

                />

              ))}



              {leadsItems.length > 0 && (
                <SidebarMenuCollapsibleGroup
                  label="Leads"
                  icon={UserPlus}
                  items={leadsItems}
                  open={isLeadsOpen}
                  onOpenChange={setIsLeadsOpen}
                  isGroupActive={leadsItems.some((i) => isActive(i.url))}
                  isItemActive={isActive}
                  onItemNavigate={closeMobile}
                  menuBtnClass={menuBtnClass}
                  subMenuBtnClass="rounded-md text-[#414754] hover:bg-[#f3f4f6] data-[active=true]:bg-[#dfe8ff] data-[active=true]:text-[#0059bb]"
                  subMenuClassName="ml-2 border-[#e5e7eb] pl-2"
                />
              )}



              {platformTopItemsAfterLeads.map((item) => (

                <NavMenuItem

                  key={item.url}

                  item={item}

                  active={isActive(item.url)}

                  onNavigate={closeMobile}

                />

              ))}



              <SidebarMenuCollapsibleGroup
                label="Manage"
                icon={Settings}
                items={manageItems}
                open={isManageOpen}
                onOpenChange={setIsManageOpen}
                isGroupActive={manageItems.some((i) => isActive(i.url))}
                isItemActive={isActive}
                onItemNavigate={closeMobile}
                menuBtnClass={menuBtnClass}
                subMenuBtnClass="rounded-md text-[#414754] hover:bg-[#f3f4f6] data-[active=true]:bg-[var(--rh-nav-active-bg)] data-[active=true]:text-[var(--rh-nav-active-fg)]"
                subMenuClassName="ml-2 border-[#e5e7eb] pl-2"
              />



              {invoiceItems.length > 0 && (
                <SidebarMenuCollapsibleGroup
                  label="Invoice"
                  icon={Receipt}
                  items={invoiceItems}
                  open={isInvoiceOpen}
                  onOpenChange={setIsInvoiceOpen}
                  isGroupActive={invoiceItems.some((i) => isActive(i.url))}
                  isItemActive={isActive}
                  onItemNavigate={closeMobile}
                  menuBtnClass={menuBtnClass}
                  subMenuBtnClass="rounded-md text-[#414754] hover:bg-[#f3f4f6] data-[active=true]:bg-[#dfe8ff] data-[active=true]:text-[#0059bb]"
                  subMenuClassName="ml-2 border-[#e5e7eb] pl-2"
                />
              )}



              {platformItems.map((item) => (

                <NavMenuItem

                  key={item.url}

                  item={item}

                  active={isActive(item.url)}

                  onNavigate={closeMobile}

                />

              ))}

            </SidebarMenu>

          </SidebarGroupContent>

        </SidebarGroup>
        )}



        {showAdminMenus && (adminItems.length > 0 || websiteItems.length > 0) && (

          <SidebarGroup>

            <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-wider text-[#717786]">

              Admin

            </SidebarGroupLabel>

            <SidebarGroupContent>

              <SidebarMenu className="gap-0.5">

                {adminItems.map((item) => (

                  <NavMenuItem

                    key={item.url}

                    item={item}

                    active={isActive(item.url)}

                    onNavigate={closeMobile}

                  />

                ))}



                <SidebarMenuCollapsibleGroup
                  label="Website Builder"
                  icon={Settings}
                  items={websiteItems}
                  open={isWebsiteOpen}
                  onOpenChange={setIsWebsiteOpen}
                  isGroupActive={websiteItems.some((i) => isActive(i.url))}
                  isItemActive={isActive}
                  onItemNavigate={closeMobile}
                  menuBtnClass={menuBtnClass}
                  subMenuBtnClass="rounded-md text-[#414754] hover:bg-[#f3f4f6] data-[active=true]:bg-[var(--rh-nav-active-bg)] data-[active=true]:text-[var(--rh-nav-active-fg)]"
                  subMenuClassName="ml-2 border-[#e5e7eb] pl-2"
                />

              </SidebarMenu>

            </SidebarGroupContent>

          </SidebarGroup>

        )}

      </SidebarContent>



      <SidebarFooter className="gap-2 border-t border-[#e5e7eb] p-3">

        {hasPermission("manage_campaigns.view") && (

          <SidebarMenu>

            <SidebarMenuItem>

              <SidebarMenuButton

                asChild

                tooltip="Create Campaign"

                className="panel-cta-btn h-10 rounded-lg bg-[var(--rh-brand)] font-semibold text-white hover:bg-[var(--rh-brand-hover)] hover:text-white data-[active=true]:bg-[var(--rh-brand-hover)]"

              >

                <Link href="/campaigns" onClick={closeMobile}>

                  <Megaphone className="h-5 w-5 shrink-0" />

                  <span>Create Campaign</span>

                </Link>

              </SidebarMenuButton>

            </SidebarMenuItem>

          </SidebarMenu>

        )}



        {!isMobile && (
        <DropdownMenu>

          <DropdownMenuTrigger asChild>

            <button

              type="button"

              className="flex w-full items-center gap-3 rounded-lg p-2 hover:bg-[#f3f4f6] group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2"

            >

              <Avatar className="h-9 w-9 shrink-0">

                <AvatarFallback className="bg-[var(--rh-brand-light)] text-xs font-semibold text-[var(--rh-brand)]">

                  {userInitials}

                </AvatarFallback>

              </Avatar>

              <div className="min-w-0 flex-1 text-left group-data-[collapsible=icon]:hidden">

                <p className="truncate text-sm font-semibold text-[#111c2d]">{displayName}</p>

                <p className="truncate text-xs text-[#717786]">{user?.email}</p>

              </div>

              <ChevronUp className="h-4 w-4 shrink-0 text-[#717786] group-data-[collapsible=icon]:hidden" />

            </button>

          </DropdownMenuTrigger>

          <DropdownMenuContent side="top" align="start" className="w-56">

            <DropdownMenuLabel>My Account</DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuItem asChild>

              <Link href="/settings" onClick={closeMobile}>

                <UserCircle className="mr-2 h-4 w-4" />

                Profile & Settings

              </Link>

            </DropdownMenuItem>

            <DropdownMenuItem asChild>

              <Link href="/billing" onClick={closeMobile}>

                <CreditCard className="mr-2 h-4 w-4" />

                Billing

              </Link>

            </DropdownMenuItem>

            {canShowInstallEntry && (

              <DropdownMenuItem

                onClick={async () => {

                  if (canNativeInstall) {

                    const ok = await install();

                    toast({

                      title: ok ? "App installed" : "Installation cancelled",

                      description: ok ? "Open Inbox from your home screen." : undefined,

                      variant: ok ? "default" : "destructive",

                    });

                    return;

                  }

                  setInstallHelpOpen(true);

                }}

              >

                <Download className="mr-2 h-4 w-4" />

                Install app shortcut

              </DropdownMenuItem>

            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={() => void logout()}>

              <LogOut className="mr-2 h-4 w-4" />

              Log out

            </DropdownMenuItem>

          </DropdownMenuContent>

        </DropdownMenu>
        )}

      </SidebarFooter>



      <SidebarRail className="hover:after:bg-[#e5e7eb]" />

      <PWAInstallInstructionsDialog open={installHelpOpen} onOpenChange={setInstallHelpOpen} />

    </Sidebar>

  );

}


