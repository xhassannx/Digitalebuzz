import { useEffect } from "react";

/**
 * Listens for api-permission-denied events (e.g. on 403). We do not show a toast here
 * because PermissionGate already shows "Access restricted" at the top of the page,
 * and a second bottom-right toast would be redundant.
 */
export function ApiPermissionDeniedListener() {
  useEffect(() => {
    const handler = () => {
      // No-op: access restricted message is already shown by PermissionGate
    };
    window.addEventListener("api-permission-denied", handler);
    return () => window.removeEventListener("api-permission-denied", handler);
  }, []);

  return null;
}
