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
import { Loader2, Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWebsiteBuilderPage } from "@/hooks/useWebsiteBuilderPage";
import { uploadWebsiteBuilderImage } from "@/lib/website-builder-upload";
import { safeRandomId } from "@/lib/safe-random-id";

type SectionItem = { id: string; title: string; description: string };
type Section = { id: string; title: string; subtitle: string; imageUrl: string | null; imageUploading?: boolean; items: SectionItem[] };
type PrivacyContent = { hero?: { title?: string; description?: string; imageUrl?: string }; sections?: Array<{ id: string; title: string; subtitle: string; imageUrl?: string; items: SectionItem[] }> };

export default function PrivacyPolicy() {
  const { toast } = useToast();
  const { content, save, isSaving, isLoading } = useWebsiteBuilderPage<PrivacyContent>("privacy");

  const [data, setData] = useState({
    hero: { imageUrl: null as string | null, title: "", description: "", imageUploading: false },
    sections: [{ id: safeRandomId(), title: "", subtitle: "", imageUrl: null as string | null, items: [{ id: safeRandomId(), title: "", description: "" }] }] as Section[],
  });

  useEffect(() => {
    if (content?.hero) {
      setData((prev) => ({
        ...prev,
        hero: {
          ...prev.hero,
          title: content.hero!.title ?? "",
          description: content.hero!.description ?? "",
          imageUrl: content.hero!.imageUrl ?? null,
        },
      }));
    }
    if (content?.sections && Array.isArray(content.sections) && content.sections.length > 0) {
      setData((prev) => ({
        ...prev,
        sections: content.sections!.map((s) => ({
          id: s.id || safeRandomId(),
          title: s.title ?? "",
          subtitle: s.subtitle ?? "",
          imageUrl: (s as { imageUrl?: string }).imageUrl ?? null,
          items: (s.items || []).map((i) => ({ id: (i as SectionItem).id || safeRandomId(), title: (i as SectionItem).title ?? "", description: (i as SectionItem).description ?? "" })),
        })),
      }));
    }
  }, [content]);

  /* ===============================
     HELPERS
  =============================== */
  const updateHero = (key: string, value: string | null) => {
    setData((prev) => ({
      ...prev,
      hero: { ...prev.hero, [key]: value },
    }));
  };

  const handleHeroImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setData((prev) => ({ ...prev, hero: { ...prev.hero, imageUploading: true } }));
    try {
      const { url } = await uploadWebsiteBuilderImage(file);
      setData((prev) => ({ ...prev, hero: { ...prev.hero, imageUrl: url, imageUploading: false } }));
      toast({ title: "Image uploaded", description: "Save the page to keep it." });
    } catch {
      setData((prev) => ({ ...prev, hero: { ...prev.hero, imageUploading: false } }));
      toast({ title: "Upload failed", variant: "destructive" });
    }
  };

  const updateSection = (sectionId: string, key: string, value: string | null) => {
    setData((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId ? { ...s, [key]: value } : s
      ),
    }));
  };

  const handleSectionImageChange = async (sectionId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setData((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId ? { ...s, imageUploading: true } : s
      ),
    }));
    try {
      const { url } = await uploadWebsiteBuilderImage(file);
      setData((prev) => ({
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === sectionId ? { ...s, imageUrl: url, imageUploading: false } : s
        ),
      }));
      toast({ title: "Image uploaded", description: "Save the page to keep it." });
    } catch {
      setData((prev) => ({
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === sectionId ? { ...s, imageUploading: false } : s
        ),
      }));
      toast({ title: "Upload failed", variant: "destructive" });
    }
  };

  const addItem = (sectionId: string) => {
    setData((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              items: [
                ...s.items,
                {
                  id: safeRandomId(),
                  title: "",
                  description: "",
                },
              ],
            }
          : s
      ),
    }));
  };

  const updateItem = (sectionId: string, itemId: string, key: string, value: string) => {
    setData((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              items: s.items.map((i) =>
                i.id === itemId ? { ...i, [key]: value } : i
              ),
            }
          : s
      ),
    }));
  };

  const removeItem = (sectionId: string, itemId: string) => {
    setData((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              items: s.items.filter((i) => i.id !== itemId),
            }
          : s
      ),
    }));
  };

  const handlePublish = () => {
    const payload = {
      hero: { title: data.hero.title, description: data.hero.description, imageUrl: data.hero.imageUrl ?? undefined },
      sections: data.sections.map((s) => ({ id: s.id, title: s.title, subtitle: s.subtitle, imageUrl: s.imageUrl ?? undefined, items: s.items })),
    };
    save(payload);
    toast({ title: "Saved successfully", description: "Privacy Policy updated." });
  };

  /* ===============================
     UI
  =============================== */
  return (
    <div className="p-6 md:p-8 max-w-[95%] mx-auto space-y-8">
      <WebsiteBuilderBreadcrumb currentPage="Privacy Policy" />

      <h1 className="text-2xl font-semibold">
        Set up your Privacy Policy page
      </h1>

      {/* ================= HERO SECTION ================= */}
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Hero Section</CardTitle>
          <CardDescription>
            Main heading and description
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Image Upload */}
          <div
            onClick={() => document.getElementById("heroImage")?.click()}
            className="border border-dashed rounded-lg p-10 text-center cursor-pointer text-muted-foreground"
          >
            {data.hero.imageUploading && (
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-muted-foreground" />
            )}
            {!data.hero.imageUploading && data.hero.imageUrl ? (
              <img src={data.hero.imageUrl} alt="Hero" className="mx-auto max-h-40 object-contain" />
            ) : !data.hero.imageUploading ? (
              "Click to upload image"
            ) : null}
          </div>

          <input
            id="heroImage"
            type="file"
            hidden
            accept="image/*"
            onChange={handleHeroImageChange}
          />

          <input
            className="w-full border rounded-md px-3 py-2 text-sm"
            placeholder="Title"
            value={data.hero.title}
            onChange={(e) =>
              updateHero("title", e.target.value)
            }
          />

          <textarea
            rows={4}
            className="w-full border rounded-md px-3 py-2 text-sm"
            placeholder="Description"
            value={data.hero.description}
            onChange={(e) =>
              updateHero("description", e.target.value)
            }
          />
        </CardContent>
      </Card>

      {/* ================= INFORMATION SECTIONS ================= */}
      {data.sections.map((section) => (
        <Card key={section.id} className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle>Information Section</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Section Image */}
            <div
              onClick={() => document.getElementById(`section-${section.id}`)?.click()}
              className="border border-dashed rounded-lg p-8 text-center cursor-pointer text-muted-foreground"
            >
              {section.imageUploading && (
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
              )}
              {!section.imageUploading && section.imageUrl ? (
                <img src={section.imageUrl} alt="Section" className="mx-auto max-h-32 object-contain" />
              ) : !section.imageUploading ? (
                "Click to upload section image"
              ) : null}
            </div>

            <input
              id={`section-${section.id}`}
              type="file"
              hidden
              accept="image/*"
              onChange={(e) => handleSectionImageChange(section.id, e)}
            />

            <input
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="Section title"
              value={section.title}
              onChange={(e) =>
                updateSection(section.id, "title", e.target.value)
              }
            />

            <input
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="Subtitle"
              value={section.subtitle}
              onChange={(e) =>
                updateSection(
                  section.id,
                  "subtitle",
                  e.target.value
                )
              }
            />

            {/* ITEMS */}
            {section.items.map((item) => (
              <div
                key={item.id}
                className="border rounded-lg p-4 space-y-3 relative"
              >
                <button
                  onClick={() =>
                    removeItem(section.id, item.id)
                  }
                  className="absolute top-3 right-3 text-red-500"
                >
                  <Trash2 size={16} />
                </button>

                <input
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  placeholder="Item title"
                  value={item.title}
                  onChange={(e) =>
                    updateItem(
                      section.id,
                      item.id,
                      "title",
                      e.target.value
                    )
                  }
                />

                <textarea
                  rows={3}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  placeholder="Item description"
                  value={item.description}
                  onChange={(e) =>
                    updateItem(
                      section.id,
                      item.id,
                      "description",
                      e.target.value
                    )
                  }
                />
              </div>
            ))}

            <Button
              variant="outline"
              onClick={() => addItem(section.id)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </CardContent>
        </Card>
      ))}

      {/* ================= PUBLISH ================= */}
      <div className="flex justify-center">
        <Button
          onClick={handlePublish}
          disabled={isSaving || isLoading}
        >
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Publish
        </Button>
      </div>
    </div>
  );
}
