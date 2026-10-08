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

type PrivacySection = {
  id: string;
  title: string;
  content: string;
};

type WhiteLabelPrivacyContent = {
  title?: string;
  subtitle?: string;
  sections?: PrivacySection[];
};

export default function WhiteLabelPrivacyPage() {
  const { toast } = useToast();
  const { content, save, isSaving, isLoading } = useWebsiteBuilderPage<WhiteLabelPrivacyContent>("white-label-privacy");

  // Default sections matching the display page
  const defaultSections: PrivacySection[] = [
    {
      id: "default-1",
      title: "Privacy Policy",
      content: `<p><strong>Effective Date:</strong> 13 January 2026</p>
<p>
  <strong>YourBrand</strong> ("we", "our", "us") operates the website{" "}
  <a href="https://yourbrand.com" target="_blank" rel="noopener noreferrer">
    https://yourbrand.com
  </a>.
  We provide WhatsApp Business API and related services. This Privacy Policy explains how we collect, use, disclose, and
  protect your information when you visit our website or use our services.
</p>
<p>
  By accessing or using our website and services, you agree
  to the collection and use of information in accordance with
  this Privacy Policy.
</p>`,
    },
    {
      id: "default-2",
      title: "1. Information We Collect",
      content: `<h4>1.1 Personal Information</h4>
<ul>
  <li>Full name</li>
  <li>Email address</li>
  <li>Phone number / WhatsApp number</li>
  <li>Business name and details</li>
  <li>Billing and payment information</li>
</ul>

<h4>1.2 Automatically Collected Information</h4>
<ul>
  <li>IP address</li>
  <li>Browser type and version</li>
  <li>Device information</li>
  <li>Pages visited and time spent</li>
  <li>Referring URLs</li>
</ul>

<h4>1.3 WhatsApp API Data</h4>
<p>
  While using our WhatsApp Business API services, we may
  process WhatsApp phone numbers, message templates, message
  logs (as required for service delivery), and metadata
  related to message delivery and performance.
</p>
<p>
  We do not read or store personal message content
  unnecessarily and process data strictly as required to
  provide our services.
</p>`,
    },
    {
      id: "default-3",
      title: "2. How We Use Your Information",
      content: `<ul>
  <li>Provide, operate, and maintain our services</li>
  <li>Set up and manage WhatsApp Business API accounts</li>
  <li>Communicate regarding inquiries, support, or updates</li>
  <li>Process payments and invoices</li>
  <li>Improve website performance and user experience</li>
  <li>Ensure compliance with legal and regulatory requirements</li>
</ul>`,
    },
    {
      id: "default-4",
      title: "3. Data Sharing and Disclosure",
      content: `<p>We do not sell, trade, or rent your personal information.</p>
<ul>
  <li>With WhatsApp / Meta Platforms Inc. for API operations</li>
  <li>With trusted service providers under confidentiality obligations</li>
  <li>To comply with legal obligations or government requests</li>
  <li>To protect the rights, property, or safety of our company</li>
</ul>`,
    },
    {
      id: "default-5",
      title: "4. Data Security",
      content: `<p>
  We implement appropriate technical and organizational measures
  to protect your data. However, no internet transmission is
  100% secure, and absolute security cannot be guaranteed.
</p>`,
    },
    {
      id: "default-6",
      title: "5. Data Retention",
      content: `<p>
  We retain personal information only as long as necessary to
  fulfill the purposes outlined in this policy and comply with
  legal requirements.
</p>`,
    },
    {
      id: "default-7",
      title: "6. Cookies and Tracking Technologies",
      content: `<ul>
  <li>Analyze website traffic</li>
  <li>Improve user experience</li>
  <li>Understand user behavior</li>
</ul>
<p>You can disable cookies through your browser settings.</p>`,
    },
    {
      id: "default-8",
      title: "7. Your Rights",
      content: `<ul>
  <li>Access your personal data</li>
  <li>Request correction or deletion</li>
  <li>Withdraw consent for data processing</li>
</ul>`,
    },
    {
      id: "default-9",
      title: "8. Third-Party Links",
      content: `<p>
  Our website may contain links to third-party websites. We are
  not responsible for their privacy practices and encourage
  reviewing their policies.
</p>`,
    },
    {
      id: "default-10",
      title: "9. Children's Privacy",
      content: `<p>
  Our services are not intended for individuals under 18 years
  of age. We do not knowingly collect personal data from
  children.
</p>`,
    },
    {
      id: "default-11",
      title: "10. Changes to This Privacy Policy",
      content: `<p>
  We may update this Privacy Policy periodically. Updates will
  be posted on this page with a revised effective date.
</p>`,
    },
    {
      id: "default-12",
      title: "11. Contact Us",
      content: `<p>
  <strong>YourBrand</strong><br />
  Website: <a href="https://yourbrand.com" target="_blank" rel="noopener noreferrer">https://yourbrand.com</a><br />
  Email: <a href="mailto:support@yourbrand.com">support@yourbrand.com</a>
</p>`,
    },
  ];

  const [form, setForm] = useState({
    title: "Privacy Policy",
    subtitle: "Your privacy is important to us. Please review how we handle your data.",
    sections: defaultSections,
  });

  useEffect(() => {
    if (content && (content.title || content.subtitle || (content.sections && content.sections.length > 0))) {
      // User has saved custom content
      setForm({
        title: content.title || "Privacy Policy",
        subtitle: content.subtitle || "Your privacy is important to us. Please review how we handle your data.",
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
    toast({ title: "Saved successfully", description: "Privacy Policy updated" });
  };

  return (
    <div className="p-6 md:p-8 max-w-[95%] mx-auto space-y-6">
      <WebsiteBuilderBreadcrumb currentPage="White Label Privacy Policy" />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">White Label Privacy Policy</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Page Settings</CardTitle>
          <CardDescription>
            Configure the title and subtitle for your privacy policy page
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">Page Title</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Privacy Policy"
            />
          </div>
          <div>
            <Label htmlFor="subtitle">Subtitle</Label>
            <Input
              id="subtitle"
              value={form.subtitle}
              onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
              placeholder="Your privacy is important to us..."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Privacy Policy Sections</CardTitle>
          <CardDescription>
            Add and edit sections for your privacy policy. Use HTML or plain text.
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
                    placeholder="e.g., 1. Information We Collect"
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
