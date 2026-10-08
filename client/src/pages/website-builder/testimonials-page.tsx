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
import { Badge } from "@/components/ui/badge";
import { Save, Loader2, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWebsiteBuilderPage } from "@/hooks/useWebsiteBuilderPage";
import { safeRandomId } from "@/lib/safe-random-id";

type TestimonialItem = { id: string; quote: string; name: string; role: string; company: string };
type TestimonialsContent = { testimonials?: TestimonialItem[] };

export default function TestimonialPage() {
  const { toast } = useToast();
  const { content, save, isSaving, isLoading } = useWebsiteBuilderPage<TestimonialsContent>("client-testimonials");

  const [testimonials, setTestimonials] = useState<TestimonialItem[]>([
    { id: safeRandomId(), quote: "", name: "", role: "", company: "" },
  ]);

  useEffect(() => {
    if (content?.testimonials && Array.isArray(content.testimonials) && content.testimonials.length > 0) {
      setTestimonials(
        content.testimonials.map((t) => ({
          id: (t as TestimonialItem).id || safeRandomId(),
          quote: (t as TestimonialItem).quote ?? "",
          name: (t as TestimonialItem).name ?? "",
          role: (t as TestimonialItem).role ?? "",
          company: (t as TestimonialItem).company ?? "",
        }))
      );
    }
  }, [content]);

  const addTestimonial = () =>
    setTestimonials((prev) => [...prev, { id: safeRandomId(), quote: "", name: "", role: "", company: "" }]);
  const removeTestimonial = (id: string) => setTestimonials((prev) => prev.filter((t) => t.id !== id));
  const updateTestimonial = (id: string, field: keyof TestimonialItem, value: string) => {
    setTestimonials((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  };

  const handleSave = () => {
    save({ testimonials });
    toast({ title: "Saved", description: "Testimonials updated successfully" });
  };

  return (
    <div className="p-6 md:p-8 max-w-[95%] mx-auto space-y-6">
      <WebsiteBuilderBreadcrumb currentPage="Testimonials" />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Client Testimonials</h1>
        <Badge variant="outline">Website</Badge>
      </div>
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Testimonials</CardTitle>
          <CardDescription>Manage testimonials shown on your website</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {testimonials.map((t) => (
            <div key={t.id} className="border rounded-lg p-4 space-y-3 relative">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 text-red-500"
                onClick={() => removeTestimonial(t.id)}
              >
                <Trash2 size={16} />
              </Button>
              <textarea
                rows={2}
                value={t.quote}
                onChange={(e) => updateTestimonial(t.id, "quote", e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="Quote"
              />
              <input
                value={t.name}
                onChange={(e) => updateTestimonial(t.id, "name", e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="Name"
              />
              <input
                value={t.role}
                onChange={(e) => updateTestimonial(t.id, "role", e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="Role"
              />
              <input
                value={t.company}
                onChange={(e) => updateTestimonial(t.id, "company", e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="Company"
              />
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addTestimonial}>
            <Plus className="mr-2 h-4 w-4" /> Add Testimonial
          </Button>
        </CardContent>
      </Card>
      <Button onClick={handleSave} disabled={isSaving || isLoading}>
        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Save
      </Button>
    </div>
  );
}
