import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

const STORAGE_KEY = "panel-sidebar-admin-mode";

function readStoredAdminMode(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "1";
}

/**
 * SaaS owners can switch sidebar between platform (normal) and admin menus — one set at a time.
 */
export function useSidebarAdminMode() {
  const { user } = useAuth();
  const isAdminUser = Boolean(user?.isSaaSOwner);

  const [adminMode, setAdminModeState] = useState(() =>
    isAdminUser ? readStoredAdminMode() : false,
  );

  useEffect(() => {
    if (isAdminUser) {
      setAdminModeState(readStoredAdminMode());
    } else {
      setAdminModeState(false);
    }
  }, [isAdminUser]);

  const setAdminMode = useCallback(
    (enabled: boolean) => {
      if (!isAdminUser) return;
      setAdminModeState(enabled);
      localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
    },
    [isAdminUser],
  );

  const showAdminMenus = isAdminUser && adminMode;
  const showPlatformMenus = !isAdminUser || !adminMode;

  return {
    isAdminUser,
    adminMode: isAdminUser && adminMode,
    setAdminMode,
    showAdminMenus,
    showPlatformMenus,
  };
}
