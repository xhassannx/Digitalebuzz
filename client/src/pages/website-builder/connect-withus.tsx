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

type ConnectContent = { imageUrl?: string };

export default function ConnectWithus() {
  const { toast } = useToast();
  const { content, save, isSaving, isLoading } = useWebsiteBuilderPage<ConnectContent>("connect-with-us-section");

  const [image, setImage] = useState({
    imageUrl: null as string | null,
    uploading: false,
  });

  useEffect(() => {
    if (content?.imageUrl) {
      setImage((prev) => ({ ...prev, imageUrl: content.imageUrl ?? null }));
    }
  }, [content]);

  const handleImageChange = async (file: File | null) => {
    if (!file) return;
    setImage((prev) => ({ ...prev, uploading: true }));
    try {
      const { url } = await uploadWebsiteBuilderImage(file);
      setImage((prev) => ({ ...prev, imageUrl: url, uploading: false }));
      toast({ title: "Image uploaded", description: "Save to keep it." });
    } catch {
      setImage((prev) => ({ ...prev, uploading: false }));
      toast({ title: "Upload failed", variant: "destructive" });
    }
  };

  const handlePublish = () => {
    save({ imageUrl: image.imageUrl ?? undefined });
    toast({ title: "Image Published", description: "Connect With Us image updated successfully" });
  };

  /* -------------------- UI -------------------- */
  return (
    <div className="p-6 md:p-8 max-w-[95%] mx-auto space-y-6">
      <WebsiteBuilderBreadcrumb currentPage="Connect-With-Us-Section" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Set Image for Connect With Us Section
        </h1>
        <Badge variant="outline">Website</Badge>
      </div>

      {/* Card */}
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Connect With Us Image</CardTitle>
          <CardDescription>
            Upload and publish image for Connect With Us section
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* IMAGE UPLOAD */}
          <label className="block cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleImageChange(e.target.files?.[0])}
            />

            <div className="border-2 border-dashed rounded-lg h-64 flex items-center justify-center text-center">
              {image.uploading && (
                <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
              )}
              {!image.uploading && image.imageUrl ? (
                <img src={image.imageUrl} alt="Connect With Us" className="max-h-full object-contain" />
              ) : !image.uploading ? (
                <div className="space-y-2">
                  <div className="w-14 h-14 mx-auto rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                    ⬆️
                  </div>
                  <p className="text-sm text-muted-foreground">Upload image for your hero section</p>
                </div>
              ) : null}
            </div>
          </label>

          {/* PUBLISH */}
          <Button
            onClick={handlePublish}
            disabled={isSaving || isLoading}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Publishing...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Publish Image
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
