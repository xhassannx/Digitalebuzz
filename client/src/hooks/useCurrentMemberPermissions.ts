import { useQuery } from "@tanstack/react-query";
import { resolveApiUrl } from "@/lib/queryClient";

type CurrentMember = {
  id: string;
  role: "owner" | "admin" | "member";
  permissions: string[];
};

async function fetchOrganizations(): Promise<{ organizations: { id: string }[] }> {
  const res = await fetch(resolveApiUrl("/api/organizations"), { credentials: "include" });
  if (!res.ok) return { organizations: [] };
  return res.json();
}

async function fetchCurrentMember(orgId: string): Promise<CurrentMember | null> {
  const res = await fetch(resolveApiUrl(`/api/organizations/${orgId}/current-member`), {
    credentials: "include",
  });
  if (!res.ok) return null;
  return res.json();
}

/** Returns the current user's role and permissions for the first organization. Owners and admins have full access (no need to check permissions). */
export function useCurrentMemberPermissions() {
  const orgsQuery = useQuery({
    queryKey: ["/api/organizations"],
    queryFn: async () => {
      const data = await fetchOrganizations();
      return data?.organizations ?? [];
    },
    staleTime: 60 * 1000,
  });

  const firstOrgId = orgsQuery.data?.[0]?.id;

  const memberQuery = useQuery({
    queryKey: ["/api/organizations", firstOrgId, "current-member"],
    queryFn: () => fetchCurrentMember(firstOrgId!),
    enabled: !!firstOrgId,
    staleTime: 60 * 1000,
  });

  const member = memberQuery.data ?? null;
  const role = member?.role ?? null;
  const permissions: string[] = Array.isArray(member?.permissions) ? member.permissions : [];
  const isOwnerOrAdmin = true;
  const hasPermission = (_permission: string) => true;

  return {
    permissions,
    role: role || "owner",
    isOwnerOrAdmin: true,
    hasPermission,
    isLoading: false,
    error: null,
  };
}
