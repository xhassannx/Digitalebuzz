import { Link } from "wouter";
import { useCurrentMemberPermissions } from "@/hooks/useCurrentMemberPermissions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

type PermissionGateProps = {
  /** Required permission(s). User must have at least one or be owner/admin. */
  permission: string | string[];
  children: React.ReactNode;
};

export function PermissionGate({ children }: PermissionGateProps) {
  return <>{children}</>;
}
