// @ts-nocheck
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WebsiteBuilderBreadcrumb } from "@/components/website-builder-breadcrumb";
import { Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWebsiteBuilderPage } from "@/hooks/useWebsiteBuilderPage";
import { uploadWebsiteBuilderImage } from "@/lib/website-builder-upload";
import { queryClient } from "@/lib/queryClient";

type LogoState = { url: string | null; width: string; uploading?: boolean };

export default function BrandingLogo() {
  const { toast } = useToast();

  /* -------------------- STATE -------------------- */
  const [logos, setLogos] = useState({
    favicon: { url: null as string | null, width: "", uploading: false },
    website: { url: null as string | null, width: "", uploading: false },
    panel: { url: null as string | null, width: "", uploading: false },
  });

  /* -------------------- FILE UPLOAD -------------------- */
  const handleFileChange = async (type: "favicon" | "website" | "panel", file: File | null) => {
    if (!file) return;
    setLogos((prev) => ({ ...prev, [type]: { ...prev[type], uploading: true } }));
    try {
      const { url } = await uploadWebsiteBuilderImage(file);
      setLogos((prev) => ({ ...prev, [type]: { ...prev[type], url, uploading: false } }));
      toast({ title: "Image uploaded", description: "Save to keep it." });
    } catch {
      setLogos((prev) => ({ ...prev, [type]: { ...prev[type], uploading: false } }));
      toast({ title: "Upload failed", variant: "destructive" });
    }
  };

  /* -------------------- WIDTH CHANGE -------------------- */
  const handleWidthChange = (type: "website" | "panel", value: string) => {
    setLogos((prev) => ({
      ...prev,
      [type]: { ...prev[type], width: value },
    }));
  };

  /* -------------------- REMOVE LOGO -------------------- */
  const removeLogo = (type: "favicon" | "website" | "panel") => {
    setLogos((prev) => ({
      ...prev,
      [type]: { url: null, width: prev[type].width, uploading: false },
    }));
  };

  const { content, save, isSaving, isLoading } = useWebsiteBuilderPage<{
    favicon?: { url?: string; width?: string };
    websiteLogo?: { url?: string; width?: string };
    panelLogo?: { url?: string; width?: string };
  }>("branding-logos");

  useEffect(() => {
    if (content?.favicon) {
      setLogos((p) => ({ ...p, favicon: { ...p.favicon, url: content.favicon!.url ?? p.favicon.url, width: content.favicon!.width ?? p.favicon.width } }));
    }
    if (content?.websiteLogo) {
      setLogos((p) => ({ ...p, website: { ...p.website, url: content.websiteLogo!.url ?? p.website.url, width: content.websiteLogo!.width ?? p.website.width } }));
    }
    if (content?.panelLogo) {
      setLogos((p) => ({ ...p, panel: { ...p.panel, url: content.panelLogo!.url ?? p.panel.url, width: content.panelLogo!.width ?? p.panel.width } }));
    }
  }, [content]);

  const handleSave = () => {
    save({
      favicon: { url: logos.favicon.url ?? undefined, width: logos.favicon.width },
      websiteLogo: { url: logos.website.url ?? undefined, width: logos.website.width },
      panelLogo: { url: logos.panel.url ?? undefined, width: logos.panel.width },
    });
    void queryClient.invalidateQueries({ queryKey: ["/api/public/white-label/config"] });
    toast({ title: "Saved successfully", description: "Branding logos updated" });
  };

  /* -------------------- UI -------------------- */
  return (
    <div className="p-6 md:p-8 max-w-[95%] mx-auto space-y-6">
      <WebsiteBuilderBreadcrumb currentPage="Branding Logos" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Branding Logos</h1>
        <Badge variant="outline">Website</Badge>
      </div>

      {/* GRID */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* FAVICON */}
        <LogoCard
          title="Favicon Icon"
          description="Upload an ICO or PNG file (max 2MB). Recommended size: 256×256"
          logo={logos.favicon}
          onFileChange={(file) => handleFileChange("favicon", file)}
          onRemove={() => removeLogo("favicon")}
        />

        {/* WEBSITE LOGO */}
        <LogoCard
          title="Website Logo"
          description="Upload a PNG, JPEG, or SVG file (max 2MB)"
          logo={logos.website}
          width={logos.website.width}
          onWidthChange={(v) => handleWidthChange("website", v)}
          onFileChange={(file) => handleFileChange("website", file)}
          onRemove={() => removeLogo("website")}
          showWidth
        />

        {/* PANEL LOGO */}
        <LogoCard
          title="Panel Logo"
          description="Upload a PNG, JPEG, or SVG file (max 2MB)"
          logo={logos.panel}
          width={logos.panel.width}
          onWidthChange={(v) => handleWidthChange("panel", v)}
          onFileChange={(file) => handleFileChange("panel", file)}
          onRemove={() => removeLogo("panel")}
          showWidth
        />
      </div>

      {/* SAVE */}
      <Button
        onClick={handleSave}
        disabled={isSaving || isLoading}
      >
        {isSaving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </>
        )}
      </Button>
    </div>
  );
}

/* -------------------- REUSABLE CARD -------------------- */
function LogoCard({
  title,
  description,
  logo,
  onFileChange,
  onRemove,
  showWidth,
  width,
  onWidthChange,
}: {
  title: string;
  description: string;
  logo: LogoState;
  onFileChange: (file: File | null) => void;
  onRemove: () => void;
  showWidth?: boolean;
  width?: string;
  onWidthChange?: (v: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* UPLOAD */}
        <label className="block cursor-pointer">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onFileChange(e.target.files?.[0])}
          />

          <div className="border-2 border-dashed rounded-lg h-40 flex items-center justify-center">
            {logo.uploading && <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />}
            {!logo.uploading && logo.url ? (
              <img src={logo.url} alt="Preview" className="max-h-full object-contain" />
            ) : !logo.uploading ? (
              <p className="text-sm text-muted-foreground">Click to upload</p>
            ) : null}
          </div>
        </label>

        {/* WIDTH */}
        {showWidth && onWidthChange && (
          <div className="flex gap-2">
            <input
              value={width ?? ""}
              onChange={(e) => onWidthChange(e.target.value)}
              className="border rounded-md px-3 py-2 text-sm w-full"
              placeholder="Enter width in pixels"
            />
            <Button type="button">Set Width</Button>
          </div>
        )}

        {/* REMOVE */}
        {logo.url && (
          <Button type="button" variant="destructive" onClick={onRemove}>
            Remove
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
 