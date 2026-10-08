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
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWebsiteBuilderPage } from "@/hooks/useWebsiteBuilderPage";

type SocialLinksContent = {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  telegram?: string;
  linkedin?: string;
  youtube?: string;
};

export default function SocialLinks() {
  const { toast } = useToast();
  const { content, save, isSaving, isLoading } = useWebsiteBuilderPage<SocialLinksContent>("social-media-links");

  const [links, setLinks] = useState({
    facebook: "",
    instagram: "",
    twitter: "",
    telegram: "",
    linkedin: "",
    youtube: "",
  });

  useEffect(() => {
    if (content) {
      setLinks({
        facebook: content.facebook ?? "",
        instagram: content.instagram ?? "",
        twitter: content.twitter ?? "",
        telegram: content.telegram ?? "",
        linkedin: content.linkedin ?? "",
        youtube: content.youtube ?? "",
      });
    }
  }, [content]);

  const handleChange = (key: keyof typeof links, value: string) => {
    setLinks((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    save(links);
    toast({ title: "Social links saved", description: "Your social media links have been updated successfully." });
  };

  return (
    <div className="p-6 md:p-8 max-w-[95%] mx-auto space-y-6">
      <WebsiteBuilderBreadcrumb currentPage="Social-Media-Links" />

      {/* Page Title */}
      <h1 className="text-2xl font-semibold">Add Social Media Links</h1>

      {/* CENTERED CARD */}
      <Card className="max-w-xl mx-auto">
        <CardHeader>
          <CardTitle>Social Media Links</CardTitle>
          <CardDescription>
            Add your social media profiles to connect with your audience.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Facebook */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Facebook</label>
            <input
              type="url"
              placeholder="https://facebook.com/yourpage"
              value={links.facebook}
              onChange={(e) => handleChange("facebook", e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Your Facebook profile URL
            </p>
          </div>

          {/* Instagram */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Instagram</label>
            <input
              type="url"
              placeholder="https://instagram.com/yourprofile"
              value={links.instagram}
              onChange={(e) => handleChange("instagram", e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Your Instagram profile URL
            </p>
          </div>

          {/* Twitter / X */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Twitter / X</label>
            <input
              type="url"
              placeholder="https://twitter.com/yourusername"
              value={links.twitter}
              onChange={(e) => handleChange("twitter", e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Your Twitter / X profile URL
            </p>
          </div>

          {/* Telegram */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Telegram</label>
            <input
              type="url"
              placeholder="https://t.me/yourchannel"
              value={links.telegram}
              onChange={(e) => handleChange("telegram", e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Your Telegram profile URL
            </p>
          </div>

          {/* LinkedIn */}
          <div className="space-y-1">
            <label className="text-sm font-medium">LinkedIn</label>
            <input
              type="url"
              placeholder="https://linkedin.com/in/yourprofile"
              value={links.linkedin}
              onChange={(e) => handleChange("linkedin", e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Your LinkedIn profile URL
            </p>
          </div>

          {/* YouTube */}
          <div className="space-y-1">
            <label className="text-sm font-medium">YouTube</label>
            <input
              type="url"
              placeholder="https://youtube.com/@yourchannel"
              value={links.youtube}
              onChange={(e) => handleChange("youtube", e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Your YouTube channel URL
            </p>
          </div>

          {/* ACTION BUTTON */}
          <div className="pt-4 flex justify-end">
            <Button onClick={handleSubmit} disabled={isSaving || isLoading}>
              {isSaving && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Publish
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
