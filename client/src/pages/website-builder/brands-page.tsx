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
import { Badge } from "@/components/ui/badge";
import { WebsiteBuilderBreadcrumb } from "@/components/website-builder-breadcrumb";
import { Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWebsiteBuilderPage } from "@/hooks/useWebsiteBuilderPage";
import { uploadWebsiteBuilderImage } from "@/lib/website-builder-upload";
import { safeRandomId } from "@/lib/safe-random-id";

type BrandItem = { id: string; name: string; imageUrl?: string };
type BrandsContent = { brands?: BrandItem[] };

export default function BrandPage() {
  const { toast } = useToast();
  const { content, save, isSaving, isLoading } = useWebsiteBuilderPage<BrandsContent>("brands");

  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    imageUrl: null as string | null,
    imageUploading: false,
  });

  useEffect(() => {
    if (content?.brands && Array.isArray(content.brands) && content.brands.length > 0) {
      setBrands(
        content.brands.map((b) => ({
          id: (b as BrandItem).id || safeRandomId(),
          name: (b as BrandItem).name ?? "",
          imageUrl: (b as BrandItem).imageUrl,
        }))
      );
    }
  }, [content]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, name: e.target.value });
  };

  const handleImageChange = async (file: File | null) => {
    if (!file) return;
    setForm((prev) => ({ ...prev, imageUploading: true }));
    try {
      const { url } = await uploadWebsiteBuilderImage(file);
      setForm((prev) => ({ ...prev, imageUrl: url, imageUploading: false }));
      toast({ title: "Image uploaded", description: "Add brand to save it." });
    } catch {
      setForm((prev) => ({ ...prev, imageUploading: false }));
      toast({ title: "Upload failed", variant: "destructive" });
    }
  };

  const resetForm = () => {
    setForm({ name: "", imageUrl: null, imageUploading: false });
  };

  const handleAddBrand = () => {
    if (!form.name.trim()) return;
    const newBrands = [...brands, { id: safeRandomId(), name: form.name, imageUrl: form.imageUrl }];
    setBrands(newBrands);
    save({ brands: newBrands });
    resetForm();
    setIsModalOpen(false);
    toast({ title: "Brand Added", description: "Brand logo added successfully" });
  };

  const handleSaveAll = () => {
    save({ brands });
    toast({ title: "Saved", description: "Partner brands updated" });
  };

  /* -------------------- UI -------------------- */
  return (
    <div className="p-6 md:p-8 max-w-[95%] mx-auto space-y-6">
      <WebsiteBuilderBreadcrumb currentPage="Brands" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">All Brand Logos</h1>
        <Button onClick={() => setIsModalOpen(true)}>
          Add New Brand Logo
        </Button>
      </div>

      {/* EMPTY STATE */}
      {brands.length === 0 && (
        <div className="text-center text-muted-foreground mt-20">
          You have not uploaded any brand logos yet.
        </div>
      )}

      {/* BRAND GRID */}
      {brands.length > 0 && (
        <div className="grid md:grid-cols-4 gap-4">
          {brands.map((brand) => (
            <Card key={brand.id}>
              <CardContent className="p-4 text-center space-y-2">
                <div className="h-24 rounded bg-muted flex items-center justify-center mx-auto overflow-hidden">
                  {brand.imageUrl ? (
                    <img src={brand.imageUrl} alt={brand.name} className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-2xl font-bold text-muted-foreground">
                      {brand.name?.charAt(0)?.toUpperCase() || "?"}
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium">{brand.name}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-5">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Add New Brand</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-muted-foreground"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-muted-foreground">
              Enter the brand name and upload logo image.
            </p>

            {/* BRAND NAME */}
            <div>
              <label className="text-sm font-medium">Brand Name</label>
              <input
                value={form.name}
                onChange={handleChange}
                className="w-full border rounded-md px-3 py-2 text-sm mt-1"
                placeholder="Enter brand name"
              />
              <p className="text-xs text-muted-foreground mt-1">
                This is your brand's display name.
              </p>
            </div>

            {/* IMAGE UPLOAD */}
            <label className="block cursor-pointer">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImageChange(e.target.files?.[0])}
              />

              <div className="border-2 border-dashed rounded-lg h-40 flex flex-col items-center justify-center text-center">
                {form.imageUploading && (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                )}
                {!form.imageUploading && form.imageUrl ? (
                  <img src={form.imageUrl} alt="Preview" className="max-h-full object-contain" />
                ) : !form.imageUploading ? (
                  <>
                    <p className="text-sm text-muted-foreground">Click to upload or drag and drop</p>
                    <p className="text-xs text-muted-foreground">PNG, JPG, GIF up to 10MB</p>
                  </>
                ) : null}
              </div>
            </label>

            {/* ADD BUTTON */}
            <Button
              className="w-full"
              onClick={handleAddBrand}
              disabled={isSaving || !form.name.trim() || form.imageUploading}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Brand"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
