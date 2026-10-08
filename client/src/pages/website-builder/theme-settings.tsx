import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { WebsiteBuilderBreadcrumb } from "@/components/website-builder-breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWebsiteBuilderPage } from "@/hooks/useWebsiteBuilderPage";

const PANEL_THEMES = [
  { key: "zinc", label: "Zinc", color: "#18181b" },
  { key: "red", label: "Red", color: "#dc2626" },
  { key: "rose", label: "Rose", color: "#e11d48" },
  { key: "orange", label: "Orange", color: "#f97316" },
  { key: "green", label: "Green", color: "#22c55e" },
  { key: "blue", label: "Blue", color: "#2563eb" },
  { key: "yellow", label: "Yellow", color: "#facc15" },
  { key: "violet", label: "Violet", color: "#7c3aed" },
];

type ThemeContent = { websiteThemeColor?: string; adminPanelTheme?: string };

export default function ThemeSettings() {
  const { toast } = useToast();
  const { content, save, isSaving, isLoading } = useWebsiteBuilderPage<ThemeContent>("theme");

  const [themeColor, setThemeColor] = useState("#10b222");
  const [panelTheme, setPanelTheme] = useState("orange");

  useEffect(() => {
    if (content?.websiteThemeColor) setThemeColor(content.websiteThemeColor);
    if (content?.adminPanelTheme) setPanelTheme(content.adminPanelTheme);
  }, [content]);

  const handleApply = () => {
    save({ websiteThemeColor: themeColor, adminPanelTheme: panelTheme });
    toast({ title: "Theme Applied", description: "Theme settings updated successfully" });
  };

  /* -------------------- UI -------------------- */
  return (
    <div className="p-6 md:p-8 max-w-[95%] mx-auto space-y-6">
      <WebsiteBuilderBreadcrumb currentPage="Theme" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Select Theme Color</h1>
        <Badge variant="outline">Website</Badge>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Theme Settings</CardTitle>
          <CardDescription>
            Customize website and admin panel appearance
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* COLOR PICKER */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Select a color
            </label>

            <input
              type="color"
              value={themeColor}
              onChange={(e) => setThemeColor(e.target.value)}
              className="h-24 w-24 border rounded-md cursor-pointer"
            />

            <p className="text-xs text-muted-foreground">
              Select a primary theme color for your website
            </p>
          </div>

          {/* COLOR VALUE */}
          <div>
            <label className="text-sm font-medium">
              Selected Color Value
            </label>
            <input
              value={themeColor}
              readOnly
              className="w-full border rounded-md px-3 py-2 text-sm mt-1"
            />
          </div>

          {/* PANEL THEME */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Panel Theme
            </label>
            <p className="text-xs text-muted-foreground">
              Choose a theme for your admin panel
            </p>

            <div className="grid grid-cols-3 gap-3">
              {PANEL_THEMES.map((theme) => (
                <button
                  key={theme.key}
                  type="button"
                  onClick={() => setPanelTheme(theme.key)}
                  className={`border rounded-md p-3 flex items-center gap-2 text-sm ${
                    panelTheme === theme.key
                      ? "ring-2 ring-black"
                      : ""
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: theme.color }}
                  />
                  {theme.label}
                  {panelTheme === theme.key && (
                    <span className="ml-auto">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* APPLY */}
          <Button
            onClick={() => handleApply()}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Applying...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Apply Theme Settings
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
