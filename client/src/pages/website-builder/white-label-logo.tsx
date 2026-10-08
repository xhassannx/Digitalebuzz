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
import { Save, Loader2, Plus, Minus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWebsiteBuilderPage } from "@/hooks/useWebsiteBuilderPage";
import { uploadWebsiteBuilderImage } from "@/lib/website-builder-upload";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { queryClient } from "@/lib/queryClient";

type LogoState = { url: string | null; uploading?: boolean; size?: number };
type FaviconState = { url: string | null; uploading?: boolean };

export default function WhiteLabelLogo() {
  const { toast } = useToast();

  /* -------------------- STATE -------------------- */
  const [logo, setLogo] = useState<LogoState>({
    url: null,
    uploading: false,
    size: 40, // Default size in pixels
  });
  const [favicon, setFavicon] = useState<FaviconState>({
    url: null,
    uploading: false,
  });

  /* -------------------- FILE UPLOAD -------------------- */
  const handleFaviconChange = async (file: File | null) => {
    if (!file) return;
    setFavicon((prev) => ({ ...prev, uploading: true }));
    try {
      const { url } = await uploadWebsiteBuilderImage(file);
      setFavicon({ url, uploading: false });
      toast({ title: "Favicon uploaded", description: "Save to apply in the browser tab and link previews." });
    } catch {
      setFavicon((prev) => ({ ...prev, uploading: false }));
      toast({ title: "Upload failed", variant: "destructive" });
    }
  };

  const handleFileChange = async (file: File | null) => {
    if (!file) return;
    setLogo((prev) => ({ ...prev, uploading: true }));
    try {
      const { url } = await uploadWebsiteBuilderImage(file);
      setLogo((prev) => ({ 
        url, 
        uploading: false,
        size: prev.size || 40, // Preserve existing size or use default
      }));
      toast({ title: "Image uploaded", description: "Save to keep it." });
    } catch {
      setLogo((prev) => ({ ...prev, uploading: false }));
      toast({ title: "Upload failed", variant: "destructive" });
    }
  };

  /* -------------------- SIZE CONTROLS -------------------- */
  const increaseSize = () => {
    setLogo((prev) => ({
      ...prev,
      size: Math.min((prev.size || 40) + 5, 200), // Max 200px
    }));
  };

  const decreaseSize = () => {
    setLogo((prev) => ({
      ...prev,
      size: Math.max((prev.size || 40) - 5, 20), // Min 20px
    }));
  };

  const handleSizeChange = (value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      setLogo((prev) => ({
        ...prev,
        size: Math.max(20, Math.min(200, numValue)), // Clamp between 20 and 200
      }));
    }
  };

  /* -------------------- REMOVE LOGO -------------------- */
  const removeLogo = () => {
    setLogo({ url: null, uploading: false, size: 40 });
  };

  const { content, save, isSaving, isLoading } = useWebsiteBuilderPage<{
    logoUrl?: string;
    logoSize?: number;
    faviconUrl?: string;
  }>("white-label-logo");

  useEffect(() => {
    if (content) {
      setLogo((prev) => ({
        url: content.logoUrl || prev.url || null,
        uploading: false,
        size: content.logoSize || prev.size || 40,
      }));
      if (content.faviconUrl) {
        setFavicon((prev) => ({ ...prev, url: content.faviconUrl ?? prev.url }));
      }
    }
  }, [content]);

  const handleSave = () => {
    save({
      logoUrl: logo.url ?? undefined,
      logoSize: logo.size ?? 40,
      faviconUrl: favicon.url ?? undefined,
    });
    void queryClient.invalidateQueries({ queryKey: ["/api/public/white-label/config"] });
    toast({ title: "Saved successfully", description: "Branding logo and favicon updated" });
  };

  /* -------------------- UI -------------------- */
  return (
    <div className="p-6 md:p-8 max-w-[95%] mx-auto space-y-6">
      <WebsiteBuilderBreadcrumb currentPage="Branding Logo" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Branding Logo</h1>
        <Badge variant="outline">Website</Badge>
      </div>

      {/* Description */}
      <Card>
        <CardHeader>
          <CardTitle>Logo Settings</CardTitle>
          <CardDescription>
            Upload your website logo (header and WhatsApp link preview when the site URL is shared)
            and favicon (browser tab icon). Recommended logo size: 40×80px. Favicon: 256×256 PNG or ICO (max 2MB).
          </CardDescription>
        </CardHeader>
      </Card>

      {/* FAVICON */}
      <Card>
        <CardHeader>
          <CardTitle>Favicon</CardTitle>
          <CardDescription>
            Shown in the browser tab. Leave empty for no custom favicon on templates 3 and 4.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="block cursor-pointer">
            <input
              type="file"
              accept="image/*,.ico"
              className="hidden"
              onChange={(e) => handleFaviconChange(e.target.files?.[0] || null)}
            />
            <div className="border-2 border-dashed rounded-lg h-32 flex items-center justify-center">
              {favicon.uploading && (
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              )}
              {!favicon.uploading && favicon.url ? (
                <img src={favicon.url} alt="Favicon preview" className="max-h-16 max-w-16 object-contain" />
              ) : !favicon.uploading ? (
                <p className="text-sm text-muted-foreground">Click to upload favicon</p>
              ) : null}
            </div>
          </label>
          {favicon.url && (
            <Button type="button" variant="destructive" onClick={() => setFavicon({ url: null, uploading: false })}>
              Remove Favicon
            </Button>
          )}
        </CardContent>
      </Card>

      {/* LOGO CARD */}
      <Card>
        <CardHeader>
          <CardTitle>Website Logo</CardTitle>
          <CardDescription>
            Upload a PNG, JPEG, or SVG file (max 2MB)
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* UPLOAD */}
          <label className="block cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
            />

            <div className="border-2 border-dashed rounded-lg h-40 flex items-center justify-center">
              {logo.uploading && (
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              )}
              {!logo.uploading && logo.url ? (
                <img
                  src={logo.url}
                  alt="Logo Preview"
                  className="max-h-full max-w-full object-contain"
                />
              ) : !logo.uploading ? (
                <p className="text-sm text-muted-foreground">Click to upload</p>
              ) : null}
            </div>
          </label>

          {/* SIZE CONTROLS */}
          {logo.url && (
            <div className="space-y-3 p-4 bg-muted rounded-lg">
              <Label htmlFor="logo-size" className="text-sm font-medium">
                Logo Size: {logo.size || 40}px
              </Label>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={decreaseSize}
                  disabled={!logo.url || (logo.size || 40) <= 20}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  id="logo-size"
                  type="number"
                  min="20"
                  max="200"
                  value={logo.size || 40}
                  onChange={(e) => handleSizeChange(e.target.value)}
                  className="w-24 text-center"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={increaseSize}
                  disabled={!logo.url || (logo.size || 40) >= 200}
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground ml-2">
                  (20px - 200px)
                </span>
              </div>
            </div>
          )}

          {/* PREVIEW */}
          {logo.url && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">Preview:</p>
              <div className="flex items-center space-x-2">
                <img
                  src={logo.url}
                  alt="Logo Preview"
                  style={{
                    width: `${logo.size || 40}px`,
                    height: `${logo.size || 40}px`,
                  }}
                  className="object-contain rounded-lg"
                />
                <span className="text-sm text-muted-foreground">
                  This is how your logo will appear in the header ({logo.size || 40}px)
                </span>
              </div>
            </div>
          )}

          {/* REMOVE */}
          {logo.url && (
            <Button type="button" variant="destructive" onClick={removeLogo}>
              Remove Logo
            </Button>
          )}
        </CardContent>
      </Card>

      {/* SAVE */}
      <Button onClick={handleSave} disabled={isSaving || isLoading}>
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
