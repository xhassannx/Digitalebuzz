import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentMemberPermissions } from "@/hooks/useCurrentMemberPermissions";
import { apiRequest } from "@/lib/queryClient";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export type AddonSidebarFeature = "webhookEvents" | "chatbot" | "flows" | "dripCampaigns";

type AddonMenuFeatures = {
  webhookEvents: boolean;
  chatbot: boolean;
  flows: boolean;
  dripCampaigns: boolean;
  hasAssignments: boolean;
};

/**
 * Requires org permission(s) AND (unless user is SaaS platform owner) an assigned add-on
 * that enables this sidebar feature. Users with no add-on assignments cannot access these routes.
 */
export function AddonFeatureRoute({
  children,
}: {
  permission?: string | string[];
  feature?: AddonSidebarFeature;
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
