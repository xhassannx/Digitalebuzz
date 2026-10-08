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
import { Save, Loader2, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWebsiteBuilderPage } from "@/hooks/useWebsiteBuilderPage";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/rich-text-editor";

type AboutSection = {
  id: string;
  title: string;
  content: string;
  bgColor?: string;
};

type WhiteLabelAboutContent = {
  title?: string;
  subtitle?: string;
  sections?: AboutSection[];
};

const DEFAULT_SECTIONS: AboutSection[] = [
  {
    id: "default-1",
    title: "Welcome",
    content: `<p>
      Welcome to <strong>YourBrand</strong>, your trusted partner
      for innovative solutions designed to help businesses communicate smarter, faster, and at scale.
    </p>
    <p>
      At <strong>YourBrand</strong>, we empower startups, small businesses, and
      growing enterprises to leverage the power of automation, integration, and customer engagement to drive
      growth and build lasting customer relationships.
    </p>`,
    bgColor: "bg-blue-50/70 dark:bg-blue-950/30",
  },
  {
    id: "default-2",
    title: "Who We Are",
    content: `<p>
      <strong>YourBrand</strong> is a technology-driven company focused on
      delivering reliable, scalable, and result-oriented
      solutions. We help businesses
      transform their operations into powerful sales, marketing, and
      customer support channels.
    </p>
    <p>
      Our mission is simple: to make business communication
      seamless, efficient, and conversion-focused using
      cutting-edge technology solutions.
    </p>`,
    bgColor: "bg-green-50/70 dark:bg-green-950/30",
  },
  {
    id: "default-3",
    title: "What We Do",
    content: `<p>
      We provide end-to-end solutions, including:
    </p>
    <ul>
      <li>Business automation and workflow setup</li>
      <li>Bulk messaging and broadcasting</li>
      <li>Automated workflows and chatbots</li>
      <li>Customer support and CRM integrations</li>
      <li>Template creation and management</li>
      <li>Campaign management and performance tracking</li>
    </ul>
    <p>
      Whether you want to generate leads, send notifications,
      recover abandoned carts, or provide instant customer
      support, we have solutions tailored to your business
      needs.
    </p>`,
    bgColor: "bg-purple-50/70 dark:bg-purple-950/30",
  },
  {
    id: "default-4",
    title: "Why Choose YourBrand",
    content: `<ul>
      <li>Official and compliant solutions</li>
      <li>Secure, reliable, and scalable infrastructure</li>
      <li>Easy-to-use automation tools and dashboard</li>
      <li>Dedicated onboarding and customer support</li>
      <li>Solutions tailored for businesses of all sizes</li>
    </ul>
    <p>
      We focus not just on technology, but on results—helping
      our clients increase engagement, improve response rates,
      and grow revenue.
    </p>`,
    bgColor: "bg-orange-50/70 dark:bg-orange-950/30",
  },
  {
    id: "default-5",
    title: "Our Mission",
    content: `<p>
      To enable businesses of all sizes to build meaningful customer relationships through simple, secure, and scalable communication solutions. We are committed to providing innovative tools that help our clients succeed.
    </p>`,
    bgColor: "bg-pink-50/70 dark:bg-pink-950/30",
  },
  {
    id: "default-6",
    title: "Our Vision",
    content: `<p>
      To become a leading solution provider by helping businesses communicate more effectively
      and build meaningful customer connections. We envision a future where every business can leverage technology to achieve their goals.
    </p>`,
    bgColor: "bg-blue-50/70 dark:bg-blue-950/30",
  },
  {
    id: "default-7",
    title: "Our Commitment",
    content: `<ul>
      <li>Data privacy and security</li>
      <li>Transparent pricing and processes</li>
      <li>Continuous innovation</li>
      <li>Long-term client success</li>
      <li>Exceptional customer support</li>
    </ul>`,
    bgColor: "bg-green-50/70 dark:bg-green-950/30",
  },
  {
    id: "default-8",
    title: "Get in Touch",
    content: `<p>
      If you're ready to grow your business with our solutions, <strong>YourBrand</strong> is here to help.
    </p>
    <p>
      <strong>Website:</strong> <a href="https://yourbrand.com" target="_blank" rel="noopener noreferrer">https://yourbrand.com</a><br />
      <strong>Email:</strong> <a href="mailto:support@yourbrand.com">support@yourbrand.com</a>
    </p>
    <p>
      Contact us today to learn how we can help transform your business communication.
    </p>`,
    bgColor: "bg-purple-50/70 dark:bg-purple-950/30",
  },
];

const SECTION_BG_COLORS = [
  "bg-blue-50/70 dark:bg-blue-950/30",
  "bg-green-50/70 dark:bg-green-950/30",
  "bg-purple-50/70 dark:bg-purple-950/30",
  "bg-orange-50/70 dark:bg-orange-950/30",
  "bg-pink-50/70 dark:bg-pink-950/30",
];

export default function WhiteLabelAboutPage() {
  const { toast } = useToast();
  const { content, save, isSaving, isLoading } = useWebsiteBuilderPage<WhiteLabelAboutContent>("white-label-about");

  const [form, setForm] = useState({
    title: "About Us",
    subtitle: "Learn more about who we are and what we do",
    sections: DEFAULT_SECTIONS,
  });

  useEffect(() => {
    if (content && (content.title || content.subtitle || (content.sections && content.sections.length > 0))) {
      setForm({
        title: content.title || "About Us",
        subtitle: content.subtitle || "Learn more about who we are and what we do",
        sections: content.sections && content.sections.length > 0 
          ? content.sections 
          : DEFAULT_SECTIONS,
      });
    } else {
      // If no content, ensure default sections are loaded
      setForm((prev) => ({ ...prev, sections: DEFAULT_SECTIONS }));
    }
  }, [content]);

  const updateSection = (sectionId: string, field: keyof AboutSection, value: any) => {
    setForm((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === sectionId ? { ...section, [field]: value } : section
      ),
    }));
  };

  const addSection = () => {
    const newSection: AboutSection = {
      id: `section-${Date.now()}`,
      title: "New Section",
      content: "Enter section content here",
      bgColor: SECTION_BG_COLORS[form.sections.length % SECTION_BG_COLORS.length],
    };
    setForm((prev) => ({
      ...prev,
      sections: [...prev.sections, newSection],
    }));
  };

  const removeSection = (sectionId: string) => {
    setForm((prev) => ({
      ...prev,
      sections: prev.sections.filter((section) => section.id !== sectionId),
    }));
  };

  const handleSave = () => {
    save({
      title: form.title,
      subtitle: form.subtitle,
      sections: form.sections.filter((s) => s.title.trim() || s.content.trim()),
    });
    toast({ title: "Saved successfully", description: "About page updated" });
  };

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 max-w-[95%] mx-auto space-y-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-[95%] mx-auto space-y-6">
      <WebsiteBuilderBreadcrumb />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">White Label About</h1>
          <p className="text-muted-foreground mt-1">
            Manage your about page content and settings
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Page Header</CardTitle>
          <CardDescription>Configure the title and subtitle for your about page</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="About Us"
            />
          </div>
          <div>
            <Label>Subtitle</Label>
            <Textarea
              value={form.subtitle}
              onChange={(e) => setForm((prev) => ({ ...prev, subtitle: e.target.value }))}
              placeholder="Learn more about who we are and what we do"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>About Sections</CardTitle>
              <CardDescription>Add and manage sections for your about page</CardDescription>
            </div>
            <Button type="button" variant="outline" onClick={addSection}>
              <Plus className="mr-2 h-4 w-4" /> Add Section
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {form.sections.map((section, index) => (
            <Card key={section.id} className="border-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Section {index + 1}</CardTitle>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSection(section.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Section Title</Label>
                  <Input
                    value={section.title}
                    onChange={(e) => updateSection(section.id, "title", e.target.value)}
                    placeholder="e.g., Our Mission"
                  />
                </div>
                <div>
                  <Label>Section Content</Label>
                  <RichTextEditor
                    value={section.content}
                    onChange={(newContent) => updateSection(section.id, "content", newContent)}
                    placeholder="Enter section content..."
                  />
                </div>
                <div>
                  <Label>Background Color</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {SECTION_BG_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => updateSection(section.id, "bgColor", color)}
                        className={`w-12 h-12 rounded-md border-2 transition-all ${
                          section.bgColor === color ? "border-primary ring-2 ring-primary/20" : "border-border"
                        }`}
                        style={{
                          background: color.includes("blue") ? "#dbeafe" : 
                                     color.includes("green") ? "#dcfce7" :
                                     color.includes("purple") ? "#f3e8ff" :
                                     color.includes("orange") ? "#fed7aa" :
                                     "#fce7f3",
                        }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

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
