import { useEffect } from "react";
import { useLocation } from "wouter";

export default function OrganizationsPage() {
  const [, setLocation] = useLocation();

  // Redirect to settings page since one tenant = one organization
  useEffect(() => {
    setLocation("/settings?tab=organisation", { replace: true });
  }, [setLocation]);

  return null;
}
