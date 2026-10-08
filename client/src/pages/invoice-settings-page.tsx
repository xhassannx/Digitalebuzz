import { useRef, useState, useEffect, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Receipt,
  FileText,
  Coins,
  Zap,
  LayoutTemplate,
  Upload,
  Save,
  RotateCcw,
  Eye,
  Minus,
  Plus,
  ImageIcon,
  Trash2,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useRatehonkPageSkin } from "@/panel-templates/ratehonk-v1/RatehonkSkinContext";
import { RhButton, RhCard } from "@/panel-templates/ratehonk-v1/components/rh";
import { InvoiceTemplatePreviewModal } from "@/components/invoice-template-preview-modal";
import {
  clampSignatureSizePx,
  DEFAULT_SIGNATURE_SIZE_PX,
  MAX_SIGNATURE_SIZE_PX,
  MIN_SIGNATURE_SIZE_PX,
  signatureImageStyle,
  SIGNATURE_SIZE_STEP_PX,
  INVOICE_PARTNER_BANNER_URL,
  INVOICE_BANNER_NONE,
  INVOICE_BANNER_RECOMMENDED_WIDTH,
  INVOICE_BANNER_RECOMMENDED_HEIGHT,
  INVOICE_BANNER_MAX_BYTES,
  resolveInvoiceBannerUrl,
  isInvoiceBannerRemoved,
} from "@/components/invoice/invoice-document";
import { cn } from "@/lib/utils";

type InvoiceSettings = {
  invoiceBusinessName?: string | null;
  invoiceCompanyAddress?: string | null;
  invoiceCompanyPhone?: string | null;
  invoiceCompanyGstNo?: string | null;
  gstSignatureUrl?: string | null;
  gstSignatureSizePx?: number;
  gstInvoicePrefix?: string | null;
  gstInvoiceStart?: number;
  gstPercentage?: number | null;
  gstBankName?: string | null;
  gstAccountNo?: string | null;
  gstIfscCode?: string | null;
  gstPaymentUpiId?: string | null;
  gstEmailId?: string | null;
  gstTermsAndConditions?: string | null;
  nonGstSignatureUrl?: string | null;
  nonGstSignatureSizePx?: number;
  nonGstInvoicePrefix?: string | null;
  nonGstInvoiceStart?: number;
  nonGstBankName?: string | null;
  nonGstAccountNo?: string | null;
  nonGstIfscCode?: string | null;
  nonGstPaymentUpiId?: string | null;
  nonGstEmailId?: string | null;
  nonGstTermsAndConditions?: string | null;
  invoiceCurrency?: string;
  hsnCode?: string | null;
  emailAutomation?: boolean;
  whatsappAutomation?: boolean;
  selectedTemplateId?: number;
  invoiceBannerUrl?: string | null;
};

const CURRENCY_OPTIONS = [
  { value: "INR", label: "₹ - India" },
  { value: "USD", label: "$ - United States" },
  { value: "EUR", label: "€ - Euro" },
  { value: "GBP", label: "£ - United Kingdom" },
  { value: "AED", label: "د.إ - UAE" },
];

const INVOICE_TEMPLATE = { id: 1, label: "Classic" } as const;

const defaultForm: InvoiceSettings = {
  invoiceBusinessName: "",
  invoiceCompanyAddress: "",
  invoiceCompanyPhone: "",
  invoiceCompanyGstNo: "",
  gstSignatureUrl: null,
  gstSignatureSizePx: DEFAULT_SIGNATURE_SIZE_PX,
  gstInvoicePrefix: "",
  gstInvoiceStart: 1,
  gstPercentage: 18,
  gstBankName: "",
  gstAccountNo: "",
  gstIfscCode: "",
  gstPaymentUpiId: "",
  gstEmailId: "",
  gstTermsAndConditions: "",
  nonGstSignatureUrl: null,
  nonGstSignatureSizePx: DEFAULT_SIGNATURE_SIZE_PX,
  nonGstInvoicePrefix: "",
  nonGstInvoiceStart: 1,
  nonGstBankName: "",
  nonGstAccountNo: "",
  nonGstIfscCode: "",
  nonGstPaymentUpiId: "",
  nonGstEmailId: "",
  nonGstTermsAndConditions: "",
  invoiceCurrency: "INR",
  hsnCode: "",
  emailAutomation: false,
  whatsappAutomation: false,
  selectedTemplateId: 1,
  invoiceBannerUrl: null,
};

async function uploadSignature(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/invoice-settings/upload-signature", {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || "Upload failed");
  return data.url as string;
}

async function uploadBanner(file: File): Promise<string> {
  if (file.size > INVOICE_BANNER_MAX_BYTES) {
    throw new Error("Banner must be below 5 MB.");
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files are allowed.");
  }
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/invoice-settings/upload-banner", {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || "Banner upload failed");
  return data.url as string;
}

function SectionIcon({ children, skin }: { children: ReactNode; skin?: boolean }) {
  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
        skin ? "rounded-xl bg-[#dfe8ff] text-[#0059bb]" : "bg-primary/10 text-primary",
      )}
    >
      {children}
    </div>
  );
}

type InvoiceSectionCardProps = {
  skin: boolean;
  title: string;
  description: string;
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
};

function InvoiceSectionCard({
  skin,
  title,
  description,
  icon,
  action,
  children,
}: InvoiceSectionCardProps) {
  if (skin) {
    return (
      <RhCard className="rh-invoice-section">
        <div className="rh-invoice-section-header">
          <div className="flex min-w-0 flex-1 gap-3">
            {icon}
            <div className="min-w-0">
              <h2 className="text-lg font-semibold leading-7 text-[#111c2d]">{title}</h2>
              <p className="mt-0.5 text-sm text-[#717786]">{description}</p>
            </div>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
        <div className="rh-invoice-section-body space-y-6">{children}</div>
      </RhCard>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="flex gap-3">
          {icon}
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
        {action}
      </CardHeader>
      <CardContent className="space-y-6">{children}</CardContent>
    </Card>
  );
}

function fieldInputClass(skin: boolean) {
  return skin ? "h-11 rounded-xl border-[#e5e7eb] bg-white shadow-none focus-visible:ring-[#0059bb]" : "";
}

function InvoiceTemplatePreview({ variant }: { variant: number }) {
  const accents = ["border-t-blue-500", "border-t-emerald-500", "border-t-violet-500", "border-t-amber-500", "border-t-rose-500"];
  return (
    <div className={cn("h-36 w-full rounded border bg-white p-2 text-[8px] shadow-sm border-t-4", accents[variant % accents.length])}>
      <div className="flex justify-between mb-1">
        <div className="h-2 w-10 rounded bg-gray-200" />
        <div className="h-2 w-6 rounded bg-gray-100" />
      </div>
      <div className="space-y-0.5 mb-2">
        <div className="h-1.5 w-full rounded bg-gray-100" />
        <div className="h-1.5 w-3/4 rounded bg-gray-100" />
      </div>
      <div className="border-t pt-1 space-y-0.5">
        <div className="h-1 w-full rounded bg-gray-50" />
        <div className="h-1 w-full rounded bg-gray-50" />
        <div className="h-1 w-2/3 rounded bg-gray-50" />
      </div>
      <div className="mt-2 flex justify-end">
        <div className="h-2 w-8 rounded bg-primary/20" />
      </div>
    </div>
  );
}

function SignatureUpload({
  label,
  value,
  sizePx,
  onSizeChange,
  onChange,
  uploading,
  onUploadStart,
  onUploadEnd,
  skin,
}: {
  label: string;
  value?: string | null;
  sizePx: number;
  onSizeChange: (size: number) => void;
  onChange: (url: string) => void;
  uploading: boolean;
  onUploadStart: () => void;
  onUploadEnd: () => void;
  skin?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const clampedSize = clampSignatureSizePx(sizePx);
  const previewBoxHeight = Math.max(112, clampedSize + 32);

  const adjustSize = (delta: number) => {
    onSizeChange(clampSignatureSizePx(clampedSize + delta));
  };

  const handleFile = async (file: File) => {
    onUploadStart();
    try {
      const url = await uploadSignature(file);
      onChange(url);
    } finally {
      onUploadEnd();
    }
  };

  return (
    <div className="space-y-3">
      <Label>{label}</Label>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div
          className={cn(
            "flex w-40 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed bg-muted/30",
            skin && "rh-invoice-signature-preview w-44 border-[#d1d5db] bg-transparent",
          )}
          style={{ minHeight: previewBoxHeight }}
        >
          {value ? (
            <img src={value} alt="Signature" style={signatureImageStyle(clampedSize)} className="p-2" />
          ) : (
            <FileText className="h-8 w-8 text-muted-foreground/50" />
          )}
        </div>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label className="text-muted-foreground">Signature size</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={cn("h-8 w-8", skin && "rounded-lg border-[#e5e7eb]")}
                disabled={clampedSize <= MIN_SIGNATURE_SIZE_PX}
                onClick={() => adjustSize(-SIGNATURE_SIZE_STEP_PX)}
                aria-label="Decrease signature size"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                min={MIN_SIGNATURE_SIZE_PX}
                max={MAX_SIGNATURE_SIZE_PX}
                step={SIGNATURE_SIZE_STEP_PX}
                value={clampedSize}
                onChange={(e) => onSizeChange(clampSignatureSizePx(parseInt(e.target.value, 10) || DEFAULT_SIGNATURE_SIZE_PX))}
                className={cn("h-8 w-20 text-center tabular-nums", fieldInputClass(!!skin))}
              />
              <span className="text-sm text-muted-foreground">px</span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={cn("h-8 w-8", skin && "rounded-lg border-[#e5e7eb]")}
                disabled={clampedSize >= MAX_SIGNATURE_SIZE_PX}
                onClick={() => adjustSize(SIGNATURE_SIZE_STEP_PX)}
                aria-label="Increase signature size"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Adjust how large the signature appears on invoices ({MIN_SIGNATURE_SIZE_PX}–{MAX_SIGNATURE_SIZE_PX}px).
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = "";
            }}
          />
          {skin ? (
            <RhButton
              type="button"
              variant="outline"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              {uploading ? "Uploading…" : "Upload"}
            </RhButton>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function BannerUpload({
  value,
  onChange,
  uploading,
  onUploadStart,
  onUploadEnd,
  skin,
}: {
  value?: string | null;
  onChange: (url: string | null) => void;
  uploading: boolean;
  onUploadStart: () => void;
  onUploadEnd: () => void;
  skin?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const previewUrl = resolveInvoiceBannerUrl(value);
  const isRemoved = isInvoiceBannerRemoved(value);
  const isDefault = !value?.trim();
  const isCustom = Boolean(value?.trim()) && !isRemoved;

  const handleFile = async (file: File) => {
    onUploadStart();
    try {
      const url = await uploadBanner(file);
      onChange(url);
      toast({ title: "Banner uploaded", description: "Save settings to apply it on invoices." });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: e instanceof Error ? e.message : "Could not upload banner",
      });
    } finally {
      onUploadEnd();
    }
  };

  const statusText = isRemoved
    ? "Banner removed — invoices will show no header image."
    : isCustom
      ? "Custom banner selected."
      : `Showing default: ${INVOICE_PARTNER_BANNER_URL}`;

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "overflow-hidden rounded-lg border bg-muted/20",
          skin && "rounded-xl border-[#e5e7eb] bg-white",
        )}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Invoice banner preview"
            className="block w-full h-auto max-h-48 object-cover object-center"
          />
        ) : (
          <div
            className={cn(
              "flex h-28 items-center justify-center px-4 text-center text-sm",
              skin ? "text-[#717786]" : "text-muted-foreground",
            )}
          >
            No banner — header image will be hidden on invoices.
          </div>
        )}
      </div>
      <p className={cn("text-sm", skin ? "text-[#717786]" : "text-muted-foreground")}>
        <span className="font-medium text-foreground">Note:</span> Max file size{" "}
        <strong>5 MB</strong>. Recommended resolution{" "}
        <strong>
          {INVOICE_BANNER_RECOMMENDED_WIDTH} × {INVOICE_BANNER_RECOMMENDED_HEIGHT} px
        </strong>{" "}
        (widescreen ~2.6:1). Use the default partner banner, upload your own, or remove the banner.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void handleFile(file);
          }}
        />
        {skin ? (
          <RhButton
            type="button"
            variant="outline"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading…" : isCustom ? "Change banner" : "Upload banner"}
          </RhButton>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? "Uploading…" : isCustom ? "Change banner" : "Upload banner"}
          </Button>
        )}
        {!isDefault &&
          (skin ? (
            <RhButton
              type="button"
              variant="secondary"
              disabled={uploading}
              onClick={() => onChange(null)}
            >
              <RotateCcw className="h-4 w-4" />
              Use default banner
            </RhButton>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={uploading}
              onClick={() => onChange(null)}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Use default banner
            </Button>
          ))}
        {!isRemoved &&
          (skin ? (
            <RhButton
              type="button"
              variant="secondary"
              disabled={uploading}
              onClick={() => onChange(INVOICE_BANNER_NONE)}
            >
              <Trash2 className="h-4 w-4" />
              Remove banner
            </RhButton>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={uploading}
              onClick={() => onChange(INVOICE_BANNER_NONE)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove banner
            </Button>
          ))}
        <span className={cn("text-xs", skin ? "text-[#717786]" : "text-muted-foreground")}>
          {statusText}
        </span>
      </div>
    </div>
  );
}

export default function InvoiceSettingsPage() {
  const skin = useRatehonkPageSkin();
  const primaryBtnClass = skin ? "bg-[#0059bb] hover:bg-[#004a9a] text-white" : "";
  const { toast } = useToast();
  const [form, setForm] = useState<InvoiceSettings>(defaultForm);
  const [gstUploading, setGstUploading] = useState(false);
  const [nonGstUploading, setNonGstUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<number | null>(null);

  const { data, isLoading } = useQuery<InvoiceSettings>({
    queryKey: ["/api/invoice-settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/invoice-settings");
      return res.json();
    },
  });

  useEffect(() => {
    if (data) {
      setForm({
        ...defaultForm,
        ...data,
        gstSignatureSizePx: clampSignatureSizePx(data.gstSignatureSizePx),
        nonGstSignatureSizePx: clampSignatureSizePx(data.nonGstSignatureSizePx),
        selectedTemplateId: 1,
      });
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: InvoiceSettings) => {
      const res = await apiRequest("PUT", "/api/invoice-settings", {
        ...payload,
        selectedTemplateId: 1,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoice-settings"] });
      toast({ title: "Saved", description: "Invoice settings saved successfully." });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save invoice settings",
      });
    },
  });

  const resetStartMutation = useMutation({
    mutationFn: async (type: "gst" | "non_gst") => {
      const res = await apiRequest("POST", "/api/invoice-settings/reset-start", { type });
      return res.json();
    },
    onSuccess: (saved: InvoiceSettings) => {
      setForm((prev) => ({
        ...prev,
        gstInvoiceStart: saved.gstInvoiceStart ?? prev.gstInvoiceStart,
        nonGstInvoiceStart: saved.nonGstInvoiceStart ?? prev.nonGstInvoiceStart,
      }));
      queryClient.invalidateQueries({ queryKey: ["/api/invoice-settings"] });
      toast({ title: "Reset", description: "Invoice start number has been reset to 1." });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to reset invoice start",
      });
    },
  });

  const update = <K extends keyof InvoiceSettings>(key: K, value: InvoiceSettings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const pageShellClass = cn(
    "mx-auto w-full space-y-6 rh-page-gutter",
    skin
      ? "px-6 py-5 sm:px-10 sm:py-6 md:px-14 lg:px-16"
      : "max-w-[90%] px-10 sm:px-12 pt-10 pb-8",
  );

  const resetButton = (type: "gst" | "non_gst") =>
    skin ? (
      <RhButton
        type="button"
        variant="outline"
        disabled={resetStartMutation.isPending}
        onClick={() => resetStartMutation.mutate(type)}
      >
        <RotateCcw className="h-4 w-4" />
        Invoice Start Reset
      </RhButton>
    ) : (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={resetStartMutation.isPending}
        onClick={() => resetStartMutation.mutate(type)}
      >
        <RotateCcw className="h-4 w-4 mr-2" />
        Invoice Start Reset
      </Button>
    );

  const inputClass = fieldInputClass(!!skin);
  const formGridClass = cn(
    "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4",
    skin && "rh-invoice-field-grid",
  );

  if (isLoading) {
    return (
      <div className={cn(pageShellClass, "flex items-center justify-center min-h-[40vh]")}>
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className={pageShellClass}>
      <div className="invoice-page-chrome flex items-center gap-2">
        <Receipt className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Invoice Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your GST and Non-GST invoice templates</p>
        </div>
      </div>

      <InvoiceSectionCard
        skin={!!skin}
        title="GST Invoice"
        description="Manage your GST invoice signature, numbering, bank details, and terms."
        icon={<SectionIcon skin={!!skin}><FileText className="h-5 w-5" /></SectionIcon>}
        action={resetButton("gst")}
      >
          <SignatureUpload
            label="Invoice GST Signature"
            value={form.gstSignatureUrl}
            sizePx={form.gstSignatureSizePx ?? DEFAULT_SIGNATURE_SIZE_PX}
            onSizeChange={(size) => update("gstSignatureSizePx", size)}
            onChange={(url) => update("gstSignatureUrl", url)}
            uploading={gstUploading}
            onUploadStart={() => setGstUploading(true)}
            onUploadEnd={() => setGstUploading(false)}
            skin={!!skin}
          />
          <div className="space-y-2">
            <Label>Business Name</Label>
            <Input
              className={inputClass}
              value={form.invoiceBusinessName || ""}
              onChange={(e) => update("invoiceBusinessName", e.target.value)}
              placeholder="e.g. Example Private Limited"
            />
            <p className="text-xs text-muted-foreground">
              This name appears on your invoice PDF above the signature and in payment details.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Company Address</Label>
            <Textarea
              className={inputClass}
              rows={3}
              value={form.invoiceCompanyAddress || ""}
              onChange={(e) => update("invoiceCompanyAddress", e.target.value)}
              placeholder="Street, city, state, PIN"
            />
          </div>
          <div className={formGridClass}>
            <div className="space-y-2">
              <Label>Company Phone</Label>
              <Input
                className={inputClass}
                value={form.invoiceCompanyPhone || ""}
                onChange={(e) => update("invoiceCompanyPhone", e.target.value)}
                placeholder="+91 9999999999"
              />
            </div>
            <div className="space-y-2">
              <Label>Company GST No.</Label>
              <Input
                className={inputClass}
                value={form.invoiceCompanyGstNo || ""}
                onChange={(e) => update("invoiceCompanyGstNo", e.target.value)}
                placeholder="22AAAAA0000A1Z5"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Address, phone, and GST appear in the &quot;Invoice From&quot; section on your invoices.
          </p>
          <div className={formGridClass}>
            <div className="space-y-2">
              <Label>Invoice Prefix</Label>
              <Input
                className={inputClass}
                value={form.gstInvoicePrefix || ""}
                onChange={(e) => update("gstInvoicePrefix", e.target.value)}
                placeholder="e.g. INV"
              />
            </div>
            <div className="space-y-2">
              <Label>Invoice Start</Label>
              <Input
                className={inputClass}
                type="number"
                min={1}
                value={form.gstInvoiceStart ?? 1}
                onChange={(e) => update("gstInvoiceStart", parseInt(e.target.value, 10) || 1)}
              />
            </div>
            <div className="space-y-2">
              <Label>GST percentage</Label>
              <Input
                className={inputClass}
                type="number"
                min={0}
                max={100}
                value={form.gstPercentage ?? 18}
                onChange={(e) => update("gstPercentage", parseInt(e.target.value, 10) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label>Bank Name</Label>
              <Input
                className={inputClass}
                value={form.gstBankName || ""}
                onChange={(e) => update("gstBankName", e.target.value)}
                placeholder="ICICI BANK"
              />
            </div>
            <div className="space-y-2">
              <Label>Account No.</Label>
              <Input
                className={inputClass}
                value={form.gstAccountNo || ""}
                onChange={(e) => update("gstAccountNo", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>IFSC Code</Label>
              <Input
                className={inputClass}
                value={form.gstIfscCode || ""}
                onChange={(e) => update("gstIfscCode", e.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>GST Payment UPI ID</Label>
              <Input
                className={inputClass}
                value={form.gstPaymentUpiId || ""}
                onChange={(e) => update("gstPaymentUpiId", e.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2 lg:col-span-3">
              <Label>Email ID</Label>
              <Input
                className={inputClass}
                type="email"
                value={form.gstEmailId || ""}
                onChange={(e) => update("gstEmailId", e.target.value)}
                placeholder="billing@yourcompany.com"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Invoice Terms &amp; Conditions</Label>
            <Textarea
              className={inputClass}
              rows={5}
              value={form.gstTermsAndConditions || ""}
              onChange={(e) => update("gstTermsAndConditions", e.target.value)}
              placeholder="Enter terms and conditions for GST invoices..."
            />
          </div>
      </InvoiceSectionCard>

      <InvoiceSectionCard
        skin={!!skin}
        title="Non GST Invoice"
        description="Configure non-GST invoice details, payment info, and terms."
        icon={<SectionIcon skin={!!skin}><FileText className="h-5 w-5" /></SectionIcon>}
        action={resetButton("non_gst")}
      >
          <SignatureUpload
            label="Invoice Non-Gst Signature"
            value={form.nonGstSignatureUrl}
            sizePx={form.nonGstSignatureSizePx ?? DEFAULT_SIGNATURE_SIZE_PX}
            onSizeChange={(size) => update("nonGstSignatureSizePx", size)}
            onChange={(url) => update("nonGstSignatureUrl", url)}
            uploading={nonGstUploading}
            onUploadStart={() => setNonGstUploading(true)}
            onUploadEnd={() => setNonGstUploading(false)}
            skin={!!skin}
          />
          <div className={formGridClass}>
            <div className="space-y-2">
              <Label>Invoice Prefix</Label>
              <Input
                className={inputClass}
                value={form.nonGstInvoicePrefix || ""}
                onChange={(e) => update("nonGstInvoicePrefix", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Invoice Start</Label>
              <Input
                className={inputClass}
                type="number"
                min={1}
                value={form.nonGstInvoiceStart ?? 1}
                onChange={(e) => update("nonGstInvoiceStart", parseInt(e.target.value, 10) || 1)}
              />
            </div>
            <div className="space-y-2">
              <Label>Bank Name</Label>
              <Input
                className={inputClass}
                value={form.nonGstBankName || ""}
                onChange={(e) => update("nonGstBankName", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Account No.</Label>
              <Input
                className={inputClass}
                value={form.nonGstAccountNo || ""}
                onChange={(e) => update("nonGstAccountNo", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>IFSC Code</Label>
              <Input
                className={inputClass}
                value={form.nonGstIfscCode || ""}
                onChange={(e) => update("nonGstIfscCode", e.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>NON GST Payment UPI ID</Label>
              <Input
                className={inputClass}
                value={form.nonGstPaymentUpiId || ""}
                onChange={(e) => update("nonGstPaymentUpiId", e.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2 lg:col-span-3">
              <Label>Email ID</Label>
              <Input
                className={inputClass}
                type="email"
                value={form.nonGstEmailId || ""}
                onChange={(e) => update("nonGstEmailId", e.target.value)}
                placeholder="billing@yourcompany.com"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Invoice Terms &amp; Conditions</Label>
            <Textarea
              className={inputClass}
              rows={5}
              value={form.nonGstTermsAndConditions || ""}
              onChange={(e) => update("nonGstTermsAndConditions", e.target.value)}
              placeholder="Enter terms and conditions for Non-GST invoices..."
            />
          </div>
      </InvoiceSectionCard>

      <InvoiceSectionCard
        skin={!!skin}
        title="Currency & Tax Code"
        description="Set default invoice currency and HSN code for line items."
        icon={<SectionIcon skin={!!skin}><Coins className="h-5 w-5" /></SectionIcon>}
      >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
            <div className="space-y-2">
              <Label>Invoice Currency</Label>
              <Select
                value={form.invoiceCurrency || "INR"}
                onValueChange={(v) => update("invoiceCurrency", v)}
              >
                <SelectTrigger className={inputClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>HSN Code</Label>
              <Input
                className={inputClass}
                value={form.hsnCode || ""}
                onChange={(e) => update("hsnCode", e.target.value)}
                placeholder="8523"
              />
            </div>
          </div>
      </InvoiceSectionCard>

      <InvoiceSectionCard
        skin={!!skin}
        title="Automations"
        description="Automatically send invoice copies to customers via email or WhatsApp."
        icon={<SectionIcon skin={!!skin}><Zap className="h-5 w-5" /></SectionIcon>}
      >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={cn("flex items-center justify-between rounded-lg border p-4", skin && "rh-invoice-automation-tile")}>
              <div>
                <p className="font-medium text-[#111c2d]">Email Automation</p>
                <p className="text-sm text-[#717786]">Send invoice copy via email</p>
              </div>
              <Switch
                checked={!!form.emailAutomation}
                onCheckedChange={(v) => update("emailAutomation", v)}
              />
            </div>
            <div className={cn("flex items-center justify-between rounded-lg border p-4", skin && "rh-invoice-automation-tile")}>
              <div>
                <p className="font-medium text-[#111c2d]">Whatsapp Automation</p>
                <p className="text-sm text-[#717786]">Send invoice copy via WhatsApp</p>
              </div>
              <Switch
                checked={!!form.whatsappAutomation}
                onCheckedChange={(v) => update("whatsappAutomation", v)}
              />
            </div>
          </div>
      </InvoiceSectionCard>

      <InvoiceSectionCard
        skin={!!skin}
        title="Invoice banner"
        description="Header image shown at the top of every invoice PDF and preview."
        icon={<SectionIcon skin={!!skin}><ImageIcon className="h-5 w-5" /></SectionIcon>}
      >
        <BannerUpload
          value={form.invoiceBannerUrl}
          onChange={(url) => update("invoiceBannerUrl", url)}
          uploading={bannerUploading}
          onUploadStart={() => setBannerUploading(true)}
          onUploadEnd={() => setBannerUploading(false)}
          skin={!!skin}
        />
      </InvoiceSectionCard>

      <InvoiceSectionCard
        skin={!!skin}
        title="Invoice Template"
        description="Preview and manage your invoice design template."
        icon={<SectionIcon skin={!!skin}><LayoutTemplate className="h-5 w-5" /></SectionIcon>}
      >
          <div className={cn("max-w-[220px] space-y-3", skin && "rh-invoice-template-card")}>
            <InvoiceTemplatePreview variant={0} />
            <p className="text-xs text-center text-[#717786]">{INVOICE_TEMPLATE.label}</p>
            <div className="flex gap-2">
              {skin ? (
                <>
                  <RhButton type="button" variant="secondary" className="flex-1 text-xs" disabled>
                    Selected
                  </RhButton>
                  <RhButton
                    type="button"
                    variant="outline"
                    className="flex-1 text-xs"
                    onClick={() => setPreviewTemplate(INVOICE_TEMPLATE.id)}
                  >
                    <Eye className="h-3 w-3" />
                  </RhButton>
                </>
              ) : (
                <>
                  <Button type="button" size="sm" className={cn("flex-1 text-xs", primaryBtnClass)} disabled>
                    Selected
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs"
                    onClick={() => setPreviewTemplate(INVOICE_TEMPLATE.id)}
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          </div>
      </InvoiceSectionCard>

      <InvoiceTemplatePreviewModal
        open={previewTemplate !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewTemplate(null);
        }}
        templateId={previewTemplate ?? 1}
        settings={form}
      />

      <div className={cn("flex justify-end", skin && "rh-invoice-save-bar")}>
        {skin ? (
          <RhButton
            className="min-w-[140px]"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate(form)}
          >
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? "Saving…" : "Save settings"}
          </RhButton>
        ) : (
          <Button
            className={cn("min-w-[120px]", primaryBtnClass)}
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate(form)}
          >
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? "Saving…" : "Save"}
          </Button>
        )}
      </div>
    </div>
  );
}
