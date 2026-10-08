import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const defaultFormData = {
  title: "",
  name: "",
  description: "",
  email: "",
  address: "",
  phone: "",
};

export default function CompanyProfile() {
  const { toast } = useToast();
  const [formData, setFormData] = useState(defaultFormData);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/website-builder/company-profile"],
    queryFn: async () => {
      const res = await fetch("/api/website-builder/company-profile", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      return json;
    },
  });

  useEffect(() => {
    if (data?.content && typeof data.content === "object") {
      setFormData({
        title: data.content.title ?? "",
        name: data.content.name ?? "",
        description: data.content.description ?? "",
        email: data.content.email ?? "",
        address: data.content.address ?? "",
        phone: data.content.phone ?? "",
      });
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: async (payload: typeof defaultFormData) => {
      await apiRequest("POST", "/api/website-builder/company-profile", payload);
    },
    onSuccess: () => {
      toast({
        title: "Profile Saved",
        description: "Company profile saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/website-builder/company-profile"] });
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="p-6 md:p-8 max-w-[95%] mx-auto space-y-6">
      <WebsiteBuilderBreadcrumb currentPage="Company Profile" />

      {/* Page Title */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Set up your Company Profile
        </h1>
        <Badge variant="outline">Website</Badge>
      </div>

      {/* Card */}
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Company Information</CardTitle>
          <CardDescription>
            Enter your company details for the website
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Company Title */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Company Title
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="w-full border rounded-md px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-black"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Please enter the title.
            </p>
          </div>

          {/* Company Name */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Company Name
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full border rounded-md px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-black"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Please enter the company.
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Description
            </label>
            <textarea
              name="description"
              rows={3}
              value={formData.description}
              onChange={handleChange}
              className="w-full border rounded-md px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-black"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Please enter the description.
            </p>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full border rounded-md px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-black"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Please enter the email.
            </p>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Address
            </label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              className="w-full border rounded-md px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-black"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Please enter the address.
            </p>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Phone
            </label>
            <input
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="w-full border rounded-md px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-black"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Please enter the website phone number.
            </p>
          </div>

          {/* Save */}
          <Button
            className="w-full mt-4"
            onClick={() => mutation.mutate(formData)}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
