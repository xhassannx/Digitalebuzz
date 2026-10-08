// @ts-nocheck
import { useQuery } from "@tanstack/react-query";

function getOrganizationIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("organizationId");
}

export type WhiteLabelConfig = {
  organizationId?: string;
  "company-profile"?: Record<string, unknown>;
  homepage?: Record<string, unknown>;
  theme?: { websiteThemeColor?: string };
  [key: string]: Record<string, unknown> | string | undefined;
};

export function useWhiteLabelConfig() {
  const organizationId =
    getOrganizationIdFromUrl() ||
    (import.meta.env.VITE_WHITELABEL_ORG_ID as string | undefined) ||
    null;

  const { data, isPending, error } = useQuery({
    queryKey: ["/api/public/white-label/config", organizationId],
    queryFn: async () => {
      const url = organizationId
        ? `/api/public/white-label/config?organizationId=${encodeURIComponent(organizationId)}`
        : "/api/public/white-label/config";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 400) return { organizationId: null } as WhiteLabelConfig;
        throw new Error("Failed to load white-label config");
      }
      return res.json() as Promise<WhiteLabelConfig>;
    },
    retry: false,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const companyProfile = data?.["company-profile"] as Record<string, unknown> | undefined;
  const homepage = data?.["homepage"] as Record<string, unknown> | undefined;

  return {
    config: data,
    companyProfile,
    homepage,
    organizationId: data?.organizationId ?? organizationId,
    isLoading: isPending,
    error,
  };
}
