// @ts-nocheck
import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentMemberPermissions } from "@/hooks/useCurrentMemberPermissions";
import type { AddonSidebarFeature } from "@/components/addon-feature-route";
import {
  adminMenuItems,
  canShowSidebarItem,
  isSidebarLinkActive,
  manageMenuItems,
  platformMenuItems,
  platformTopMenuItems,
  platformTopMenuItemsBeforeLeads,
  platformTopMenuItemsAfterLeads,
  invoiceMenuItems,
  leadsMenuItems,
  websiteMenuItems,
  type SidebarMenuItemDef,
} from "./sidebar-menu-config";

export function usePanelSidebarMenu() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { hasPermission } = useCurrentMemberPermissions();

  const [isManageOpen, setIsManageOpen] = useState(
    manageMenuItems.some(
      (item) => location === item.url || location.startsWith(item.url + "/"),
    ),
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

  const { data: addonMenuFeatures } = useQuery({
    queryKey: ["/api/auth/addon-menu-features"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/auth/addon-menu-features");
      return res.json() as {
        webhookEvents: boolean;
        chatbot: boolean;
        flows: boolean;
        dripCampaigns: boolean;
        hasAssignments: boolean;
      };
    },
    staleTime: 30_000,
  });

  const allowAddonMenu = (key: AddonSidebarFeature): boolean => {
    if (user?.isSaaSOwner) return true;
    if (!addonMenuFeatures?.hasAssignments) return false;
    return addonMenuFeatures[key] ?? false;
  };

  const filterItems = (items: SidebarMenuItemDef[]) =>
    items.filter((item) => canShowSidebarItem(item, hasPermission, allowAddonMenu));

  return {
    location,
    user,
    hasPermission,
    isManageOpen,
    setIsManageOpen,
    isInvoiceOpen,
    setIsInvoiceOpen,
    isLeadsOpen,
    setIsLeadsOpen,
    isWebsiteOpen,
    setIsWebsiteOpen,
    platformTopItems: filterItems(platformTopMenuItems),
    platformTopItemsBeforeLeads: filterItems(platformTopMenuItemsBeforeLeads),
    platformTopItemsAfterLeads: filterItems(platformTopMenuItemsAfterLeads),
    platformItems: filterItems(platformMenuItems),
    invoiceItems: filterItems(invoiceMenuItems),
    leadsItems: filterItems(leadsMenuItems),
    manageItems: filterItems(manageMenuItems),
    adminItems: user?.isSaaSOwner ? adminMenuItems : [],
    websiteItems: user?.isSaaSOwner ? websiteMenuItems : [],
    isActive: (url: string) => isSidebarLinkActive(location, url),
  };
}
