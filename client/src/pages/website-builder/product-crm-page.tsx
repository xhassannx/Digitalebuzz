// @ts-nocheck
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWebsiteBuilderPage } from "@/hooks/useWebsiteBuilderPage";
import { uploadWebsiteBuilderImage } from "@/lib/website-builder-upload";

type FaqItem = { question: string; answer: string };
type ProductCrmContent = { hero?: { headline?: string; subHeadline?: string; imageUrl?: string }; faqs?: FaqItem[] };

export default function ProductCrmPage() {
  const { toast } = useToast();
  const { content, save, isSaving, isLoading } = useWebsiteBuilderPage<ProductCrmContent>("product-crm-page");

  const [hero, setHero] = useState({
    headline: "",
    subHeadline: "",
    imageUrl: null as string | null,
    imageUploading: false,
  });
  const [faqs, setFaqs] = useState<FaqItem[]>([{ question: "", answer: "" }]);

  useEffect(() => {
    if (content?.hero) {
      setHero((prev) => ({
        ...prev,
        headline: content.hero!.headline ?? "",
        subHeadline: content.hero!.subHeadline ?? "",
        imageUrl: content.hero!.imageUrl ?? null,
      }));
    }
    if (content?.faqs && Array.isArray(content.faqs) && content.faqs.length > 0) {
      setFaqs(content.faqs.map((f) => ({ question: f.question ?? "", answer: f.answer ?? "" })));
    }
  }, [content]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setHero((prev) => ({ ...prev, imageUploading: true }));
    try {
      const { url } = await uploadWebsiteBuilderImage(file);
      setHero((prev) => ({ ...prev, imageUrl: url, imageUploading: false }));
      toast({ title: "Image uploaded", description: "Save the page to keep it." });
    } catch {
      setHero((prev) => ({ ...prev, imageUploading: false }));
      toast({ title: "Upload failed", variant: "destructive" });
    }
  };

  const addFaq = () => setFaqs((prev) => [...prev, { question: "", answer: "" }]);
  const removeFaq = (index: number) => setFaqs((prev) => prev.filter((_, i) => i !== index));
  const updateFaq = (index: number, field: keyof FaqItem, value: string) => {
    const updated = [...faqs];
    updated[index] = { ...updated[index], [field]: value };
    setFaqs(updated);
  };

  const handleSave = () => {
    save({ hero: { headline: hero.headline, subHeadline: hero.subHeadline, imageUrl: hero.imageUrl ?? undefined }, faqs });
    toast({ title: "Saved successfully", description: "Product CRM page data stored" });
  };

  return (
    <div className="p-6 md:p-8 max-w-[95%] mx-auto space-y-8">
      <h1 className="text-2xl font-semibold">
        Set up your Product CRM page
      </h1>

      {/* HERO SECTION */}
      <SectionHeader title="Hero Section" />

      <Card className="max-w-3xl mx-auto">
        <CardContent className="space-y-5 pt-6">
          {/* IMAGE UPLOAD */}
          <label className="block">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />

            <div className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer">
              {hero.imageUploading && (
                <Loader2 className="mx-auto h-10 w-10 animate-spin text-muted-foreground" />
              )}
              {!hero.imageUploading && hero.imageUrl ? (
                <img src={hero.imageUrl} alt="Hero" className="mx-auto max-h-40 object-contain" />
              ) : !hero.imageUploading ? (
                <span className="text-sm text-muted-foreground">Click to upload hero image</span>
              ) : null}
            </div>
          </label>

          {/* HEADLINE */}
          <div>
            <label className="text-sm font-medium">
              Hero Section Headline
            </label>
            <input
              value={hero.headline}
              onChange={(e) =>
                setHero({ ...hero, headline: e.target.value })
              }
              className="w-full border rounded-md px-3 py-2 text-sm mt-1"
            />
          </div>

          {/* SUB HEADLINE */}
          <div>
            <label className="text-sm font-medium">
              Hero Section Sub-headline
            </label>
            <textarea
              rows={3}
              value={hero.subHeadline}
              onChange={(e) =>
                setHero({
                  ...hero,
                  subHeadline: e.target.value,
                })
              }
              className="w-full border rounded-md px-3 py-2 text-sm mt-1"
            />
          </div>

          <Button
            size="sm"
            onClick={() => handleSave()}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Publishing...
              </>
            ) : (
              "Publish Hero Section"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* FAQ SECTION */}
      <SectionHeader title="FAQ Section" />

      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>FAQ Questions</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="border rounded-lg p-4 space-y-3 relative"
            >
              {faqs.length > 1 && (
                <button
                  type="button"
                  className="absolute top-3 right-3 text-red-500"
                  onClick={() => removeFaq(index)}
                >
                  <Trash2 size={16} />
                </button>
              )}

              <div>
                <label className="text-sm font-medium">
                  Question
                </label>
                <input
                  value={faq.question}
                  onChange={(e) =>
                    updateFaq(index, "question", e.target.value)
                  }
                  className="w-full border rounded-md px-3 py-2 text-sm mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium">
                  Answer
                </label>
                <textarea
                  rows={3}
                  value={faq.answer}
                  onChange={(e) =>
                    updateFaq(index, "answer", e.target.value)
                  }
                  className="w-full border rounded-md px-3 py-2 text-sm mt-1"
                />
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addFaq}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add FAQ
          </Button>

          <Button
            size="sm"
            onClick={() => handleSave()}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Publish FAQ Section"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/* -------- Section Bar -------- */
function SectionHeader({ title }) {
  return (
    <div className="bg-orange-200 rounded-full py-1 px-4 text-sm font-medium text-center">
      {title}
    </div>
  );
}
