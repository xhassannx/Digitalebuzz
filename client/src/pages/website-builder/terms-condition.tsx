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
import { WebsiteBuilderBreadcrumb } from "@/components/website-builder-breadcrumb";
import { Loader2, Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWebsiteBuilderPage } from "@/hooks/useWebsiteBuilderPage";
import { uploadWebsiteBuilderImage } from "@/lib/website-builder-upload";
import { safeRandomId } from "@/lib/safe-random-id";

type CardItem = { id: string; title: string; description: string };
type TermsContent = { hero?: { title?: string; description?: string; imageUrl?: string }; cards?: CardItem[] };

export default function TermsAndCondition() {
  const { toast } = useToast();
  const { content, save, isSaving, isLoading } = useWebsiteBuilderPage<TermsContent>("terms");

  const [terms, setTerms] = useState({
    hero: { imageUrl: null as string | null, title: "", description: "", imageUploading: false },
    cards: [{ id: safeRandomId(), title: "", description: "" }] as CardItem[],
  });

  useEffect(() => {
    if (content?.hero) {
      setTerms((prev) => ({
        ...prev,
        hero: {
          ...prev.hero,
          title: content.hero!.title ?? "",
          description: content.hero!.description ?? "",
          imageUrl: content.hero!.imageUrl ?? null,
        },
      }));
    }
    if (content?.cards && Array.isArray(content.cards) && content.cards.length > 0) {
      setTerms((prev) => ({ ...prev, cards: content.cards!.map((c) => ({ id: c.id || safeRandomId(), title: c.title ?? "", description: c.description ?? "" })) }));
    }
  }, [content]);

  /* ===============================
     HANDLERS
  =============================== */
  const updateHero = (key: string, value: string | null) => {
    setTerms((prev) => ({
      ...prev,
      hero: { ...prev.hero, [key]: value },
    }));
  };

  const handleHeroImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTerms((prev) => ({ ...prev, hero: { ...prev.hero, imageUploading: true } }));
    try {
      const { url } = await uploadWebsiteBuilderImage(file);
      setTerms((prev) => ({ ...prev, hero: { ...prev.hero, imageUrl: url, imageUploading: false } }));
      toast({ title: "Image uploaded", description: "Save the page to keep it." });
    } catch {
      setTerms((prev) => ({ ...prev, hero: { ...prev.hero, imageUploading: false } }));
      toast({ title: "Upload failed", variant: "destructive" });
    }
  };

  const updateCard = (id, key, value) => {
    setTerms((prev) => ({
      ...prev,
      cards: prev.cards.map((c) =>
        c.id === id ? { ...c, [key]: value } : c
      ),
    }));
  };

  const addCard = () => {
    setTerms((prev) => ({
      ...prev,
      cards: [
        ...prev.cards,
        {
          id: safeRandomId(),
          title: "",
          description: "",
        },
      ],
    }));
  };

  const removeCard = (id: string) => {
    setTerms((prev) => ({
      ...prev,
      cards: prev.cards.filter((c) => c.id !== id),
    }));
  };

  const handlePublish = () => {
    save({ hero: { title: terms.hero.title, description: terms.hero.description, imageUrl: terms.hero.imageUrl ?? undefined }, cards: terms.cards });
    toast({ title: "Terms & Conditions saved", description: "Page updated successfully." });
  };

  /* ===============================
     UI
  =============================== */
  return (
    <div className="p-6 md:p-8 max-w-[95%] mx-auto space-y-8">
      <WebsiteBuilderBreadcrumb currentPage="Terms & Conditions" />

      <h1 className="text-2xl font-semibold">
        Set up your Terms & Conditions page
      </h1>

      {/* ================= HERO SECTION ================= */}
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Hero Section</CardTitle>
          <CardDescription>
            Main heading and description for Terms & Conditions page.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Image Upload */}
          <div
            onClick={() =>
              document.getElementById("termsHeroImage")?.click()
            }
            className="border border-dashed rounded-lg p-10 text-center cursor-pointer text-muted-foreground"
          >
            {terms.hero.imageUploading && (
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-muted-foreground" />
            )}
            {!terms.hero.imageUploading && terms.hero.imageUrl ? (
              <img
                src={terms.hero.imageUrl}
                alt="Hero"
                className="mx-auto max-h-40 object-contain"
              />
            ) : !terms.hero.imageUploading ? (
              "Upload image for your Terms & Conditions page"
            ) : null}
          </div>

          <input
            id="termsHeroImage"
            type="file"
            hidden
            accept="image/*"
            onChange={handleHeroImageChange}
          />

          <input
            className="w-full border rounded-md px-3 py-2 text-sm"
            placeholder="Terms & Conditions"
            value={terms.hero.title}
            onChange={(e) => updateHero("title", e.target.value)}
          />

          <textarea
            rows={4}
            className="w-full border rounded-md px-3 py-2 text-sm"
            placeholder="Enter description for your Terms & Conditions page"
            value={terms.hero.description}
            onChange={(e) => updateHero("description", e.target.value)}
          />
        </CardContent>
      </Card>

      {/* ================= INFO CARDS ================= */}
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Info Cards Section</CardTitle>
          <CardDescription>
            Add multiple Terms & Conditions points.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {terms.cards.map((card, index) => (
            <div
              key={card.id}
              className="border rounded-lg p-4 space-y-3 relative"
            >
              <span className="text-xs text-muted-foreground">
                Card {index + 1}
              </span>

              <button
                onClick={() => removeCard(card.id)}
                className="absolute top-3 right-3 text-red-500"
              >
                <Trash2 size={16} />
              </button>

              <input
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="Card title"
                value={card.title}
                onChange={(e) =>
                  updateCard(card.id, "title", e.target.value)
                }
              />

              <textarea
                rows={4}
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="Card description"
                value={card.description}
                onChange={(e) =>
                  updateCard(
                    card.id,
                    "description",
                    e.target.value
                  )
                }
              />
            </div>
          ))}

          <Button variant="outline" onClick={addCard}>
            <Plus className="mr-2 h-4 w-4" />
            Add Card
          </Button>
        </CardContent>
      </Card>

      {/* ================= PUBLISH ================= */}
      <div className="flex justify-center">
        <Button onClick={handlePublish} disabled={isSaving || isLoading}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Publish
        </Button>
      </div>
    </div>
  );
}
