import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/lib/theme-provider";

type OrganizationTheme = {
  themeMode?: 'light' | null;
  accentColor?: 'grey' | 'pink' | 'red' | 'orange' | 'green' | 'blue' | 'yellow' | 'purple' | null;
  lightPrimary?: string | null;
  lightPrimaryForeground?: string | null;
  lightSecondary?: string | null;
  lightSecondaryForeground?: string | null;
  lightAccent?: string | null;
  lightAccentForeground?: string | null;
  lightBackground?: string | null;
  lightForeground?: string | null;
  lightCard?: string | null;
  lightCardForeground?: string | null;
  lightBorder?: string | null;
};

export function OrganizationThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { setTheme } = useTheme();
  
  // Get user's organizations to fetch themes
  const { data: orgsData } = useQuery<{ organizations: any[] } | Array<{ id: string; name: string }>>({
    queryKey: ['/api/organizations'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/organizations');
      const data = await res.json();
      return Array.isArray(data) ? data : (data.organizations || []);
    },
    enabled: !!user,
  });

  // Get theme for the first organization (or selected organization)
  const organizations = Array.isArray(orgsData) ? orgsData : orgsData?.organizations || [];
  const organizationId = organizations[0]?.id;
  
  const { data: themeData } = useQuery<{ theme: OrganizationTheme | null }>({
    queryKey: ['/api/organizations', organizationId, 'theme'],
    queryFn: async () => {
      if (!organizationId) return { theme: null };
      try {
        const res = await apiRequest('GET', `/api/organizations/${organizationId}/theme`);
        return await res.json();
      } catch {
        return { theme: null };
      }
    },
    enabled: !!organizationId,
  });

  // Apply theme mode from organization theme (always light)
  useEffect(() => {
    setTheme('light');
  }, [setTheme]);

  useEffect(() => {
    if (!themeData?.theme) return;

    const theme = themeData.theme;
    const root = document.documentElement;
    const isRatehonkPanel =
      root.dataset.panelTemplate === "ratehonk-v1" ||
      root.dataset.panelTemplate === "helicoptic-v1" ||
      root.dataset.rhShell === "1";

    // Apply light theme colors (RateHonk/Atlas use panel brand CSS variables instead)
    if (theme.lightPrimary && !isRatehonkPanel) {
      root.style.setProperty("--primary", theme.lightPrimary);
    }
    if (theme.lightPrimaryForeground && !isRatehonkPanel) {
      root.style.setProperty("--primary-foreground", theme.lightPrimaryForeground);
    }
    if (theme.lightSecondary) root.style.setProperty('--secondary', theme.lightSecondary);
    if (theme.lightSecondaryForeground) root.style.setProperty('--secondary-foreground', theme.lightSecondaryForeground);
    if (theme.lightAccent) root.style.setProperty('--accent', theme.lightAccent);
    if (theme.lightAccentForeground) root.style.setProperty('--accent-foreground', theme.lightAccentForeground);
    if (theme.lightBackground) root.style.setProperty('--background', theme.lightBackground);
    if (theme.lightForeground) root.style.setProperty('--foreground', theme.lightForeground);
    if (theme.lightCard) root.style.setProperty('--card', theme.lightCard);
    if (theme.lightCardForeground) root.style.setProperty('--card-foreground', theme.lightCardForeground);
    if (theme.lightBorder) root.style.setProperty('--border', theme.lightBorder);

    return () => {
      // Reset org theme overrides; keep Atlas/Nova brand primary set by PanelTemplateProvider
      if (!isRatehonkPanel) {
        root.style.removeProperty('--primary');
        root.style.removeProperty('--primary-foreground');
      }
      root.style.removeProperty('--secondary');
      root.style.removeProperty('--secondary-foreground');
      root.style.removeProperty('--accent');
      root.style.removeProperty('--accent-foreground');
      root.style.removeProperty('--background');
      root.style.removeProperty('--foreground');
      root.style.removeProperty('--card');
      root.style.removeProperty('--card-foreground');
      root.style.removeProperty('--border');
    };
  }, [themeData]);

  return <>{children}</>;
}

