import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WebsiteBuilderBreadcrumb } from "@/components/website-builder-breadcrumb";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWebsiteBuilderPage } from "@/hooks/useWebsiteBuilderPage";

type FaqItem = { question: string; answer: string };
type ProductSmmContent = { hero?: { headline?: string; subHeadline?: string }; faqs?: FaqItem[] };

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="bg-orange-200 dark:bg-orange-900/40 rounded-full py-1 px-4 text-sm font-medium text-center">
      {title}
    </div>
  );
}

export default function ProductSmmPage() {
  const { toast } = useToast();
  const { content, save, isSaving, isLoading } = useWebsiteBuilderPage<ProductSmmContent>("product-smm-page");

  const [hero, setHero] = useState({ headline: "", subHeadline: "" });
  const [faqs, setFaqs] = useState<FaqItem[]>([{ question: "", answer: "" }]);

  useEffect(() => {
    if (content?.hero) {
      setHero({ headline: content.hero.headline ?? "", subHeadline: content.hero.subHeadline ?? "" });
    }
    if (content?.faqs && Array.isArray(content.faqs) && content.faqs.length > 0) {
      setFaqs(content.faqs.map((f) => ({ question: f.question ?? "", answer: f.answer ?? "" })));
    }
  }, [content]);

  const addFaq = () => setFaqs((prev) => [...prev, { question: "", answer: "" }]);
  const removeFaq = (i: number) => setFaqs((prev) => prev.filter((_, idx) => idx !== i));
  const updateFaq = (i: number, field: keyof FaqItem, value: string) => {
    const next = [...faqs];
    next[i] = { ...next[i], [field]: value };
    setFaqs(next);
  };

  const handleSave = () => {
    save({ hero, faqs });
    toast({ title: "Saved successfully", description: "Product SMM page updated" });
  };

  return (
    <div className="p-6 md:p-8 max-w-[95%] mx-auto space-y-8">
      <WebsiteBuilderBreadcrumb currentPage="Product-Smm-Page" />
      <h1 className="text-2xl font-semibold">Set up your Product Social Media Management page</h1>

      <SectionHeader title="Hero Section" />
      <Card className="max-w-3xl mx-auto">
        <CardContent className="space-y-5 pt-6">
          <div>
            <label className="text-sm font-medium">Headline</label>
            <input
              value={hero.headline}
              onChange={(e) => setHero((p) => ({ ...p, headline: e.target.value }))}
              className="w-full border rounded-md px-3 py-2 text-sm mt-1"
              placeholder="Hero headline"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Sub-headline</label>
            <textarea
              rows={3}
              value={hero.subHeadline}
              onChange={(e) => setHero((p) => ({ ...p, subHeadline: e.target.value }))}
              className="w-full border rounded-md px-3 py-2 text-sm mt-1"
              placeholder="Sub-headline"
            />
          </div>
        </CardContent>
      </Card>

      <SectionHeader title="FAQ Section" />
      <Card className="max-w-3xl mx-auto">
        <CardContent className="space-y-4 pt-6">
          {faqs.map((faq, i) => (
            <div key={i} className="border rounded-lg p-4 space-y-2 relative">
              <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 text-red-500" onClick={() => removeFaq(i)}>
                <Trash2 size={16} />
              </Button>
              <input
                value={faq.question}
                onChange={(e) => updateFaq(i, "question", e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="Question"
              />
              <textarea
                rows={2}
                value={faq.answer}
                onChange={(e) => updateFaq(i, "answer", e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="Answer"
              />
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addFaq}>
            <Plus className="mr-2 h-4 w-4" /> Add FAQ
          </Button>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={isSaving || isLoading}>
        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Save
      </Button>
    </div>
  );
}
