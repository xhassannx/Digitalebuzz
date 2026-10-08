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
type RefundContent = { hero?: { title?: string; description?: string; imageUrl?: string }; cards?: CardItem[] };

export default function RefundPolicy() {
  const { toast } = useToast();
  const { content, save, isSaving, isLoading } = useWebsiteBuilderPage<RefundContent>("refund");

  const [data, setData] = useState({
    hero: { imageUrl: null as string | null, title: "", description: "", imageUploading: false },
    cards: [{ id: safeRandomId(), title: "", description: "" }] as CardItem[],
  });

  useEffect(() => {
    if (content?.hero) {
      setData((prev) => ({
        ...prev,
        hero: { ...prev.hero, title: content.hero!.title ?? "", description: content.hero!.description ?? "", imageUrl: content.hero!.imageUrl ?? null },
      }));
    }
    if (content?.cards && Array.isArray(content.cards) && content.cards.length > 0) {
      setData((prev) => ({ ...prev, cards: content.cards!.map((c) => ({ id: c.id || safeRandomId(), title: c.title ?? "", description: c.description ?? "" })) }));
    }
  }, [content]);

  /* ===============================
     HELPERS
  =============================== */
  const updateHero = (key: string, value: string | File | null) => {
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
    } catch (err: unknown) {
      toast({ title: "Upload failed", description: (err as Error).message, variant: "destructive" });
      setData((prev) => ({ ...prev, hero: { ...prev.hero, imageUploading: false } }));
    }
    e.target.value = "";
  };

  const updateCard = (cardId: string, key: string, value: string) => {
    setData((prev) => ({
      ...prev,
      cards: prev.cards.map((c) =>
        c.id === cardId ? { ...c, [key]: value } : c
      ),
    }));
  };

  const addCard = () => {
    setData((prev) => ({
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

  const removeCard = (cardId: string) => {
    setData((prev) => ({
      ...prev,
      cards: prev.cards.filter((c) => c.id !== cardId),
    }));
  };

  const handlePublish = () => {
    save({ hero: { title: data.hero.title, description: data.hero.description, imageUrl: data.hero.imageUrl ?? undefined }, cards: data.cards });
    toast({ title: "Refund Policy saved", description: "Your refund policy has been updated successfully." });
  };

  /* ===============================
     UI
  =============================== */
  return (
    <div className="p-6 md:p-8 max-w-[95%] mx-auto space-y-8">
      <WebsiteBuilderBreadcrumb currentPage="Refund Policy" />

      <h1 className="text-2xl font-semibold">
        Set up your Refund Policy page
      </h1>

      {/* ================= HERO SECTION ================= */}
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Hero Section</CardTitle>
          <CardDescription>
            Main heading and description for your Refund Policy page.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Image Upload */}
          <div
            onClick={() =>
              document.getElementById("refundHeroImage").click()
            }
            className="relative border border-dashed rounded-lg p-10 text-center cursor-pointer text-muted-foreground overflow-hidden"
          >
            {data.hero.imageUploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            )}
            {data.hero.imageUrl ? (
              <img
                src={data.hero.imageUrl}
                alt="Hero"
                className="mx-auto max-h-40 object-contain"
              />
            ) : (
              "Click to upload image"
            )}
          </div>

          <input
            id="refundHeroImage"
            type="file"
            hidden
            accept="image/*"
            onChange={handleHeroImageChange}
          />

          <input
            className="w-full border rounded-md px-3 py-2 text-sm"
            placeholder="Refund Policy"
            value={data.hero.title}
            onChange={(e) =>
              updateHero("title", e.target.value)
            }
          />

          <textarea
            rows={4}
            className="w-full border rounded-md px-3 py-2 text-sm"
            placeholder="Enter refund policy description"
            value={data.hero.description}
            onChange={(e) =>
              updateHero("description", e.target.value)
            }
          />
        </CardContent>
      </Card>

      {/* ================= INFO CARDS ================= */}
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Info Cards Section</CardTitle>
          <CardDescription>
            Add refund policy points as cards.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {data.cards.map((card) => (
            <div
              key={card.id}
              className="border rounded-lg p-4 space-y-3 relative"
            >
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
                rows={3}
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
