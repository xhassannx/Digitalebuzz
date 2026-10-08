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

type AboutContent = { title?: string; about?: string; imageUrl?: string };

export default function AboutPage() {
  const { toast } = useToast();
  const { content, isLoading, save, isSaving } = useWebsiteBuilderPage<AboutContent>("about");

  const [form, setForm] = useState({
    title: "",
    about: "",
    imageUrl: null as string | null,
    imagePreview: null as string | null, // object URL or saved URL for display
    imageUploading: false,
  });

  useEffect(() => {
    if (content) {
      setForm((prev) => ({
        ...prev,
        title: content.title ?? "",
        about: content.about ?? "",
        imageUrl: content.imageUrl ?? null,
        imagePreview: content.imageUrl ?? null,
      }));
    }
  }, [content]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setForm((prev) => ({ ...prev, imageUploading: true, imagePreview: URL.createObjectURL(file) }));
    try {
      const { url } = await uploadWebsiteBuilderImage(file);
      setForm((prev) => ({ ...prev, imageUrl: url, imageUploading: false }));
      toast({ title: "Image uploaded", description: "Image will be saved when you click Publish." });
    } catch (err: unknown) {
      toast({ title: "Upload failed", description: (err as Error).message, variant: "destructive" });
      setForm((prev) => ({ ...prev, imageUploading: false, imagePreview: prev.imageUrl, imageUrl: prev.imageUrl }));
    }
    e.target.value = "";
  };

  const handleSave = () => {
    save({ title: form.title, about: form.about, imageUrl: form.imageUrl ?? undefined });
    toast({ title: "Published", description: "About Us page saved successfully" });
  };

  /* -------------------- UI -------------------- */
  return (
    <div className="p-6 md:p-8 max-w-[95%] mx-auto space-y-6">
      <WebsiteBuilderBreadcrumb currentPage="About" />

      {/* Page Title */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Set up your About Us page
        </h1>
        <Badge variant="outline">Website</Badge>
      </div>

      {/* Main Card */}
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>About Page Content</CardTitle>
          <CardDescription>
            Manage image and content for your About Us page
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* IMAGE UPLOAD */}
          <label className="block cursor-pointer">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />

            <div className="relative border-2 border-dashed rounded-lg h-64 flex items-center justify-center overflow-hidden">
              {form.imageUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}
              {form.imagePreview ? (
                <img
                  src={form.imagePreview}
                  alt="Preview"
                  className="max-h-full object-contain"
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {form.imageUploading ? "Uploading..." : "Upload image for your About Us page"}
                </p>
              )}
            </div>
          </label>

          {/* TITLE */}
          <div>
            <label className="text-sm font-medium">Title</label>
            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              className="w-full border rounded-md px-3 py-2 text-sm mt-1"
              placeholder="Enter a title for your About Us page"
            />
          </div>

          {/* ABOUT */}
          <div>
            <label className="text-sm font-medium">About</label>
            <textarea
              name="about"
              rows={6}
              value={form.about}
              onChange={handleChange}
              className="w-full border rounded-md px-3 py-2 text-sm mt-1"
              placeholder="Enter content for your About Us page"
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
                Publishing...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Publish
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
