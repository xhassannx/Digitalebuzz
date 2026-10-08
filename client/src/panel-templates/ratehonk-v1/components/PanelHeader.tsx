// @ts-nocheck
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, LogOut, Settings, UserCircle } from "lucide-react";
import { GlobalHeaderSearch } from "./GlobalHeaderSearch";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { HeaderReminderButton } from "@/components/header-reminder-button";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { tokens } from "../tokens";

function profileInitials(user: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
} | null): string {
  if (user?.firstName) {
    const last = user.lastName?.charAt(0) ?? "";
    return `${user.firstName.charAt(0)}${last}`.toUpperCase();
  }
  return user?.email?.slice(0, 2).toUpperCase() || "US";
}

function isRedundantOrgName(orgName: string, personName: string): boolean {
  const org = orgName.trim().toLowerCase();
  const person = personName.trim().toLowerCase();
  if (!org || !person) return false;
  return org === person || person.includes(org) || org.includes(person);
}

export function PanelHeader() {
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

  const organization = organizations[0];
  const initials = profileInitials(user);

  const personName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.email?.split("@")[0]?.replace(/\b\w/g, (c) => c.toUpperCase()) || "User";

  const headerLine = personName;
  const showOrgInMenu =
    !!organization?.name && !isRedundantOrgName(organization.name, personName);

  const roleLabel = user?.isSaaSOwner ? "Admin" : "Member";

  return (
    <header
      className="panel-header flex h-16 shrink-0 items-center gap-4 border-b px-4 md:px-6"
      style={{
        backgroundColor: tokens.colors.headerBg,
        borderColor: tokens.colors.border,
        fontFamily: tokens.font.sans,
      }}
    >
      <SidebarTrigger
        data-testid="button-sidebar-toggle"
        className="shrink-0 text-[#414754] hover:bg-[var(--rh-brand-light)]"
      />

      <GlobalHeaderSearch />

      <div className="ml-auto flex items-center gap-3">
        <HeaderReminderButton />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-[var(--rh-brand-light)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rh-brand)]"
              aria-label="Account menu"
            >
              <Avatar className="h-9 w-9">
                <AvatarImage src={user?.profileImageUrl || undefined} alt="" />
                <AvatarFallback className="bg-[var(--rh-brand-light)] text-xs font-semibold text-[var(--rh-brand)]">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden max-w-[140px] truncate text-left leading-tight min-[480px]:block md:max-w-xs">
                <p className="max-w-[200px] truncate text-sm font-semibold text-[#111c2d] md:max-w-xs">
                  {headerLine}
                </p>
                <p className="text-[10px] font-normal uppercase tracking-wide text-[#717786]">
                  {roleLabel}
                </p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-semibold text-[#111c2d]">{personName}</p>
              <p className="truncate text-xs text-[#717786]">{user?.email}</p>
              {showOrgInMenu ? (
                <p className="mt-1 truncate text-xs text-[#717786]">{organization.name}</p>
              ) : null}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <UserCircle className="mr-2 h-4 w-4" />
                Profile &amp; Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/billing">
                <CreditCard className="mr-2 h-4 w-4" />
                Billing
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void logout()}>
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
