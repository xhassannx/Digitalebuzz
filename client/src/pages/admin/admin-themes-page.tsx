// @ts-nocheck
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Palette, Sun, Save } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Organization = {
  id: string;
  name: string;
  ownerId: string;
  hasTheme?: boolean;
};

type Theme = {
  id: string;
  organizationId: string;
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

export default function AdminThemesPage() {
  const { toast } = useToast();
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");

  const { data: orgsData, isLoading: orgsLoading } = useQuery<{ organizations: Organization[] }>({
    queryKey: ['/api/admin/organizations'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/admin/organizations');
      return await res.json();
    },
  });

  const { data: themeData, isLoading: themeLoading, refetch: refetchTheme } = useQuery<{ theme: Theme | null }>({
    queryKey: ['/api/admin/organizations', selectedOrgId, 'theme'],
    queryFn: async () => {
      if (!selectedOrgId) return { theme: null };
      const res = await apiRequest('GET', `/api/admin/organizations/${selectedOrgId}/theme`);
      return await res.json();
    },
    enabled: !!selectedOrgId,
  });

  const saveThemeMutation = useMutation({
    mutationFn: async (themeData: Partial<Theme>) => {
      const res = await apiRequest('POST', `/api/admin/organizations/${selectedOrgId}/theme`, themeData);
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Theme saved", description: "Organization theme has been saved successfully" });
      refetchTheme();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to save theme", variant: "destructive" });
    },
  });

  const [theme, setTheme] = useState<Partial<Theme>>({});

  // Sync theme state when themeData changes
  useEffect(() => {
    if (themeData?.theme) {
      setTheme(themeData.theme);
    } else {
      setTheme({});
    }
  }, [themeData]);

  const handleSave = () => {
    if (!selectedOrgId) {
      toast({ title: "Error", description: "Please select an organization", variant: "destructive" });
      return;
    }
    saveThemeMutation.mutate(theme);
  };

  const organizations = orgsData?.organizations || [];
  const currentTheme = themeData?.theme || {};

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-semibold mb-2">Theme Customization</h1>
        <p className="text-muted-foreground">
          Customize accent colors per organization. Panel layouts are set under Admin → Panel templates.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Organization</CardTitle>
          <CardDescription>Choose an organization to customize its theme</CardDescription>
        </CardHeader>
        <CardContent>
          {orgsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Select an organization" />
              </SelectTrigger>
              <SelectContent>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name} {org.hasTheme && <span className="text-muted-foreground">(has theme)</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {selectedOrgId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Theme Colors
            </CardTitle>
            <CardDescription>
              Set HSL color values (e.g., "142 76% 38%" for hue saturation lightness)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Sun className="h-4 w-4" />
                <span className="font-medium">Theme Colors</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <ColorInput
                  label="Primary"
                  value={currentTheme.lightPrimary || ""}
                  onChange={(value) => setTheme({ ...theme, lightPrimary: value })}
                  placeholder="142 76% 38%"
                />
                <ColorInput
                  label="Primary Foreground"
                  value={currentTheme.lightPrimaryForeground || ""}
                  onChange={(value) => setTheme({ ...theme, lightPrimaryForeground: value })}
                  placeholder="0 0% 100%"
                />
                <ColorInput
                  label="Secondary"
                  value={currentTheme.lightSecondary || ""}
                  onChange={(value) => setTheme({ ...theme, lightSecondary: value })}
                  placeholder="142 15% 93%"
                />
                <ColorInput
                  label="Secondary Foreground"
                  value={currentTheme.lightSecondaryForeground || ""}
                  onChange={(value) => setTheme({ ...theme, lightSecondaryForeground: value })}
                  placeholder="142 20% 18%"
                />
                <ColorInput
                  label="Accent"
                  value={currentTheme.lightAccent || ""}
                  onChange={(value) => setTheme({ ...theme, lightAccent: value })}
                  placeholder="142 45% 94%"
                />
                <ColorInput
                  label="Accent Foreground"
                  value={currentTheme.lightAccentForeground || ""}
                  onChange={(value) => setTheme({ ...theme, lightAccentForeground: value })}
                  placeholder="142 50% 22%"
                />
                <ColorInput
                  label="Background"
                  value={currentTheme.lightBackground || ""}
                  onChange={(value) => setTheme({ ...theme, lightBackground: value })}
                  placeholder="142 15% 98%"
                />
                <ColorInput
                  label="Foreground"
                  value={currentTheme.lightForeground || ""}
                  onChange={(value) => setTheme({ ...theme, lightForeground: value })}
                  placeholder="142 12% 12%"
                />
                <ColorInput
                  label="Card"
                  value={currentTheme.lightCard || ""}
                  onChange={(value) => setTheme({ ...theme, lightCard: value })}
                  placeholder="0 0% 100%"
                />
                <ColorInput
                  label="Card Foreground"
                  value={currentTheme.lightCardForeground || ""}
                  onChange={(value) => setTheme({ ...theme, lightCardForeground: value })}
                  placeholder="142 12% 12%"
                />
                <ColorInput
                  label="Border"
                  value={currentTheme.lightBorder || ""}
                  onChange={(value) => setTheme({ ...theme, lightBorder: value })}
                  placeholder="142 10% 86%"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={handleSave} disabled={saveThemeMutation.isPending}>
                {saveThemeMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Theme
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ColorInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={label}>{label}</Label>
      <Input
        id={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

