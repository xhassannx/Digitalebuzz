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
import { Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWebsiteBuilderPage } from "@/hooks/useWebsiteBuilderPage";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/rich-text-editor";
import { safeRandomId } from "@/lib/safe-random-id";

type TermsSection = {
  id: string;
  title: string;
  content: string;
};

type WhiteLabelTermsContent = {
  title?: string;
  subtitle?: string;
  sections?: TermsSection[];
};

export default function WhiteLabelTermsPage() {
  const { toast } = useToast();
  const { content, save, isSaving, isLoading } = useWebsiteBuilderPage<WhiteLabelTermsContent>("white-label-terms");

  // Default sections matching the display page
  const defaultSections: TermsSection[] = [
    {
      id: "default-1",
      title: "Terms and Condition",
      content: `<p><strong>Effective Date:</strong> 13 January 2026</p>
<p>
  Welcome to <strong>YourBrand</strong>. These Terms and
  Conditions ("Terms") govern your access to and use of our
  website{" "}
  <a href="https://yourbrand.com" target="_blank" rel="noopener noreferrer">
    https://yourbrand.com
  </a>{" "}
  and our WhatsApp Business API–related products and services.
</p>
<p>
  By accessing our website or using our services, you agree
  to be bound by these Terms. If you do not agree, please do
  not use our website or services.
</p>`,
    },
    {
      id: "default-2",
      title: "1. About Our Services",
      content: `<p>
  We provide WhatsApp Business API onboarding,
  messaging automation, broadcasting, and related
  communication services for businesses.
</p>`,
    },
    {
      id: "default-3",
      title: "2. Eligibility",
      content: `<ul>
  <li>You are at least 18 years of age</li>
  <li>You have the legal authority to enter into a binding agreement</li>
  <li>You are using our services for lawful business purposes only</li>
</ul>`,
    },
    {
      id: "default-4",
      title: "3. Services",
      content: `<ul>
  <li>Services are provided on a subscription or usage basis</li>
  <li>WhatsApp Business API approval is subject to Meta / WhatsApp policies</li>
  <li>We do not guarantee WhatsApp API approval</li>
  <li>We may modify, suspend, or discontinue services at any time</li>
</ul>`,
    },
    {
      id: "default-5",
      title: "4. User Responsibilities",
      content: `<ul>
  <li>Provide accurate and complete onboarding information</li>
  <li>Use WhatsApp API only for opted-in users</li>
  <li>Comply with applicable laws and WhatsApp policies</li>
  <li>Avoid spam, misleading, illegal, or abusive content</li>
</ul>
<p>
  Any misuse may result in immediate suspension or
  termination of services.
</p>`,
    },
    {
      id: "default-6",
      title: "5. WhatsApp Policies Compliance",
      content: `<ul>
  <li>Usage is governed by Meta / WhatsApp policies</li>
  <li>Message templates must be approved by WhatsApp</li>
  <li>WhatsApp may suspend numbers for violations</li>
  <li>We are not responsible for suspensions caused by policy breaches</li>
</ul>`,
    },
    {
      id: "default-7",
      title: "6. Payments and Billing",
      content: `<ul>
  <li>All prices are as stated unless otherwise indicated</li>
  <li>Payments must be made in advance</li>
  <li>Failure to pay may result in service suspension</li>
  <li>Prices are subject to change with prior notice</li>
</ul>`,
    },
    {
      id: "default-8",
      title: "7. Refund and Cancellation Policy",
      content: `<ul>
  <li>Payments are non-refundable unless explicitly stated</li>
  <li>Cancellations must be requested before renewal</li>
  <li>No refunds for partial usage or unused periods</li>
</ul>`,
    },
    {
      id: "default-9",
      title: "8. Data Privacy",
      content: `<p>
  Your use of our services is governed by our Privacy Policy.
  By using our services, you consent to data collection and
  processing as described therein.
</p>`,
    },
    {
      id: "default-10",
      title: "9. Intellectual Property",
      content: `<p>
  All content, branding, software, and materials are the
  intellectual property of our company. Unauthorized use is
  strictly prohibited.
</p>`,
    },
    {
      id: "default-11",
      title: "10. Limitation of Liability",
      content: `<ul>
  <li>Indirect, incidental, or consequential damages</li>
  <li>Loss of data, revenue, or business opportunities</li>
  <li>WhatsApp or Meta service disruptions</li>
</ul>
<p>
  Total liability shall not exceed the amount paid in the
  preceding three months.
</p>`,
    },
    {
      id: "default-12",
      title: "11. Indemnification",
      content: `<p>
  You agree to indemnify and hold harmless our company from claims
  arising from misuse of services or violation of these Terms.
</p>`,
    },
    {
      id: "default-13",
      title: "12. Termination",
      content: `<p>
  We may suspend or terminate access without prior notice for
  violations of these Terms or applicable laws.
</p>`,
    },
    {
      id: "default-14",
      title: "13. Governing Law and Jurisdiction",
      content: `<p>
  These Terms are governed by applicable laws. All disputes
  are subject to relevant jurisdiction.
</p>`,
    },
    {
      id: "default-15",
      title: "14. Changes to Terms",
      content: `<p>
  We may update these Terms periodically. Continued use
  indicates acceptance of the revised Terms.
</p>`,
    },
    {
      id: "default-16",
      title: "15. Contact Information",
      content: `<p>
  <strong>YourBrand</strong><br />
  Website: <a href="https://yourbrand.com" target="_blank" rel="noopener noreferrer">https://yourbrand.com</a><br />
  Email: <a href="mailto:support@yourbrand.com">support@yourbrand.com</a>
</p>`,
    },
  ];

  const [form, setForm] = useState({
    title: "Terms & Conditions",
    subtitle: "Please read these terms carefully before using our services.",
    sections: defaultSections,
  });

  useEffect(() => {
    if (content && (content.title || content.subtitle || (content.sections && content.sections.length > 0))) {
      // User has saved custom content
      setForm({
        title: content.title || "Terms & Conditions",
        subtitle: content.subtitle || "Please read these terms carefully before using our services.",
        sections: content.sections && content.sections.length > 0
          ? content.sections
          : defaultSections,
      });
    }
    // If no content, keep the default sections that are already in state
  }, [content]);

  const updateSection = (id: string, field: "title" | "content", value: string) => {
    setForm((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === id ? { ...s, [field]: value } : s
      ),
    }));
  };

  const addSection = () => {
    setForm((prev) => ({
      ...prev,
      sections: [
        ...prev.sections,
        {
          id: safeRandomId(),
          title: "",
          content: "",
        },
      ],
    }));
  };

  const removeSection = (id: string) => {
    setForm((prev) => ({
      ...prev,
      sections: prev.sections.filter((s) => s.id !== id),
    }));
  };

  const handleSave = () => {
    save({
      title: form.title,
      subtitle: form.subtitle,
      sections: form.sections.filter((s) => s.title.trim() || s.content.trim()),
    });
    toast({ title: "Saved successfully", description: "Terms & Conditions updated" });
  };

  return (
    <div className="p-6 md:p-8 max-w-[95%] mx-auto space-y-6">
      <WebsiteBuilderBreadcrumb currentPage="White Label Terms & Conditions" />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">White Label Terms & Conditions</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Page Settings</CardTitle>
          <CardDescription>
            Configure the title and subtitle for your terms & conditions page
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">Page Title</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Terms & Conditions"
            />
          </div>
          <div>
            <Label htmlFor="subtitle">Subtitle</Label>
            <Input
              id="subtitle"
              value={form.subtitle}
              onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
              placeholder="Please read these terms carefully..."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Terms & Conditions Sections</CardTitle>
          <CardDescription>
            Add and edit sections for your terms & conditions. Use HTML or plain text.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {form.sections.map((section, index) => (
            <Card key={section.id} className="border-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Section {index + 1}</CardTitle>
                  {form.sections.length > 1 && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => removeSection(section.id)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Section Title</Label>
                  <Input
                    value={section.title}
                    onChange={(e) => updateSection(section.id, "title", e.target.value)}
                    placeholder="e.g., 1. Acceptance of Terms"
                  />
                </div>
                <div>
                  <Label>Section Content</Label>
                  <RichTextEditor
                    value={section.content}
                    onChange={(newContent) => updateSection(section.id, "content", newContent)}
                    placeholder="Enter the content for this section. Use the toolbar to format text."
                  />
                </div>
              </CardContent>
            </Card>
          ))}

          <Button type="button" variant="outline" onClick={addSection}>
            Add Section
          </Button>
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
