import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WebsiteBuilderBreadcrumb } from "@/components/website-builder-breadcrumb";
import { Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWebsiteBuilderPage } from "@/hooks/useWebsiteBuilderPage";

export default function ContactPage() {
  const { toast } = useToast();
  const { content, save, isSaving, isLoading } = useWebsiteBuilderPage<{ address?: string; email?: string; phone?: string }>("contact");

  const [form, setForm] = useState({
    address: "",
    email: "",
    phone: "",
  });

  useEffect(() => {
    if (content) {
      setForm({
        address: content.address ?? "",
        email: content.email ?? "",
        phone: content.phone ?? "",
      });
    }
  }, [content]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = () => {
    save(form);
    toast({ title: "Saved successfully", description: "Contact details updated" });
  };

  /* -------------------- UI -------------------- */
  return (
    <div className="p-6 md:p-8 max-w-[95%] mx-auto space-y-6">
      <WebsiteBuilderBreadcrumb currentPage="Contact" />

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Contact Us</h1>
        <Badge variant="outline">Website</Badge>
      </div>

      {/* Card */}
      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
          <CardDescription>
            Manage contact details shown on your website
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* ADDRESS */}
          <div>
            <label className="text-sm font-medium">Address</label>
            <input
              name="address"
              value={form.address}
              onChange={handleChange}
              className="w-full border rounded-md px-3 py-2 text-sm mt-1"
              placeholder="Enter company address"
            />
          </div>

          {/* EMAIL */}
          <div>
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className="w-full border rounded-md px-3 py-2 text-sm mt-1"
              placeholder="Enter contact email"
            />
          </div>

          {/* PHONE */}
          <div>
            <label className="text-sm font-medium">Phone</label>
            <input
              name="phone"
              value={form.phone}
              onChange={handleChange}
              className="w-full border rounded-md px-3 py-2 text-sm mt-1"
              placeholder="Enter phone number"
            />
          </div>

          {/* SUBMIT */}
          <Button
            onClick={handleSubmit}
            disabled={isSaving || isLoading}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Submit
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
