import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Loader2, Minus, Plus, Receipt, X } from "lucide-react";
import { apiRequest, queryClient, resolveApiUrl } from "@/lib/queryClient";
import { normalizeInvoicePaymentStatus } from "@shared/invoice";
import { useToast } from "@/hooks/use-toast";
import { downloadInvoicePdf, generateInvoicePdfBlob } from "@/lib/invoice-pdf";
import { cn } from "@/lib/utils";
import {
  InvoiceDocumentView,
  INVOICE_TEMPLATE_THEME,
  buildContactInvoiceData,
  computeInvoiceLineItems,
  computeInvoiceGrandTotal,
  currencySymbol,
  formatInvoiceNumber,
  invoiceToFromContact,
  CURRENCY_OPTIONS,
  INVOICE_PAYMENT_STATUS_OPTIONS,
  type GstTypeStore,
  type InvoiceLineItemInput,
  type InvoicePaymentStatus,
  type InvoicePreviewSettings,
  type InvoiceToDetails,
} from "@/components/invoice/invoice-document";

type ContactForInvoice = {
  id: string;
  name: string | null;
  phoneNumber: string;
  email: string | null;
  customFields?: Record<string, unknown> | null;
};

export type { ContactForInvoice };

type OrganizationForInvoice = {
  id?: string;
  name?: string;
  website?: string | null;
  industry?: string | null;
};

const defaultLineItem = (defaultHsn: string, defaultGstPct: number): InvoiceLineItemInput => ({
  name: "",
  cost: 0,
  qty: 1,
  discount: 0,
  discountType: "overall",
  hsn: defaultHsn,
  igstPct: defaultGstPct,
  sgstPct: defaultGstPct / 2,
  cgstPct: defaultGstPct / 2,
  comments: "",
});

type ContactCreateInvoiceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: ContactForInvoice | null;
  organization?: OrganizationForInvoice | null;
  /** When provided (e.g. invoice list page), show a customer dropdown to pick the contact. */
  contactOptions?: ContactForInvoice[];
  onInvoiceCreated?: () => void;
  /** When set, dialog opens in edit mode for an existing sent invoice. */
  editInvoiceId?: string | null;
  onInvoiceUpdated?: () => void;
};

type StoredOrganizationInvoice = {
  id: string;
  contactId?: string | null;
  invoiceNo: string;
  gstType?: string | null;
  invoiceStatus?: string | null;
  currency?: string | null;
  amountPaid?: number | null;
  lineItems?: InvoiceLineItemInput[] | null;
  invoiceTo?: Partial<InvoiceToDetails> | null;
  emailAutomation?: boolean;
  whatsappAutomation?: boolean;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  invoiceDate?: string;
  isLocked?: boolean;
};

function formatStoredInvoiceDate(value?: string | null) {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
}

function gstTypeFromStored(value?: string | null): GstTypeStore {
  if (value === "non_gst" || value === "sgst_cgst") return value;
  return "igst";
}

function invoiceToFromStored(
  invoice: StoredOrganizationInvoice,
): InvoiceToDetails {
  const invTo = invoice.invoiceTo || {};
  return {
    customerName: invTo.customerName || invoice.customerName || "",
    customerContact: invTo.customerContact || invoice.customerName || "",
    customerPhone: invTo.customerPhone || invoice.customerPhone || "",
    customerEmail: invTo.customerEmail || invoice.customerEmail || "",
    customerCity: invTo.customerCity || "",
    customerAddress: invTo.customerAddress || "",
    customerGst: invTo.customerGst || "",
  };
}

function contactOptionLabel(c: ContactForInvoice) {
  const name = c.name?.trim() || "Unnamed";
  return `${name} (${c.phoneNumber})`;
}

function contactSearchValue(c: ContactForInvoice) {
  const name = c.name?.trim() || "";
  const phone = c.phoneNumber || "";
  const digits = phone.replace(/\D/g, "");
  return `${name} ${phone} ${digits} ${contactOptionLabel(c)}`.trim();
}

function ContactPickerCombobox({
  contacts,
  value,
  onValueChange,
}: {
  contacts: ContactForInvoice[];
  value: string;
  onValueChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = contacts.find((c) => c.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-11 w-full justify-between font-normal"
        >
          <span className="truncate text-left">
            {selected ? contactOptionLabel(selected) : "Select customer name…"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search by name or phone number…" />
          <CommandList className="max-h-72">
            <CommandEmpty>No customer found.</CommandEmpty>
            <CommandGroup>
              {contacts.map((c) => (
                <CommandItem
                  key={c.id}
                  value={contactSearchValue(c)}
                  onSelect={() => {
                    onValueChange(c.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4 shrink-0", value === c.id ? "opacity-100" : "opacity-0")}
                  />
                  {contactOptionLabel(c)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function MoneyInput({
  currency,
  value,
  onChange,
  readOnly,
  className,
}: {
  currency: string;
  value: number | string;
  onChange?: (v: number) => void;
  readOnly?: boolean;
  className?: string;
}) {
  const sym = currencySymbol(currency);
  return (
    <div className={cn("relative", className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        {sym}
      </span>
      <Input
        type="number"
        min={0}
        step="0.01"
        readOnly={readOnly}
        className={cn("pl-8", readOnly && "bg-muted")}
        value={value}
        onChange={(e) => onChange?.(parseFloat(e.target.value) || 0)}
      />
    </div>
  );
}

export function ContactCreateInvoiceDialog({
  open,
  onOpenChange,
  contact,
  organization,
  contactOptions,
  onInvoiceCreated,
  editInvoiceId,
  onInvoiceUpdated,
}: ContactCreateInvoiceDialogProps) {
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const isEditMode = !!editInvoiceId;
  const [selectedContactId, setSelectedContactId] = useState("");
  const [gstTypeStore, setGstTypeStore] = useState<GstTypeStore>("igst");
  const [inclusiveGst, setInclusiveGst] = useState(false);
  const [invoiceCurrency, setInvoiceCurrency] = useState("INR");
  const [invoiceStatus, setInvoiceStatus] = useState<InvoicePaymentStatus>("due");
  const [amountPaid, setAmountPaid] = useState(0);
  const [lineItems, setLineItems] = useState<InvoiceLineItemInput[]>([defaultLineItem("998314", 18)]);
  const [invoiceTo, setInvoiceTo] = useState<InvoiceToDetails>({
    customerName: "",
    customerContact: "",
    customerPhone: "",
    customerEmail: "",
    customerCity: "",
    customerAddress: "",
    customerGst: "",
  });
  const [emailAutomation, setEmailAutomation] = useState(false);
  const [whatsappAutomation, setWhatsappAutomation] = useState(false);
  const [previewInvoiceNo, setPreviewInvoiceNo] = useState("");
  const [createdInvoiceNo, setCreatedInvoiceNo] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const lastPopulatedContactIdRef = useRef<string | null>(null);
  const editLoadedRef = useRef<string | null>(null);

  const isGst = gstTypeStore !== "non_gst";
  const defaultGstPct = 18;
  const defaultHsn = "998314";
  const showContactPicker = contactOptions !== undefined && !contact && !isEditMode;

  const { data: editInvoice, isLoading: editLoading } = useQuery<StoredOrganizationInvoice>({
    queryKey: ["/api/invoices", editInvoiceId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/invoices/${editInvoiceId}`);
      return res.json();
    },
    enabled: open && !!editInvoiceId,
  });

  const editContact = useMemo((): ContactForInvoice | null => {
    if (!editInvoice) return null;
    return {
      id: editInvoice.contactId || editInvoice.id,
      name: editInvoice.customerName,
      phoneNumber: editInvoice.customerPhone || "",
      email: editInvoice.customerEmail ?? null,
      customFields: (editInvoice.invoiceTo as Record<string, unknown>) || {},
    };
  }, [editInvoice]);

  const effectiveContact = useMemo(() => {
    if (isEditMode && editContact) return editContact;
    if (contact) return contact;
    if (!selectedContactId || !contactOptions?.length) return null;
    return contactOptions.find((c) => c.id === selectedContactId) ?? null;
  }, [isEditMode, editContact, contact, selectedContactId, contactOptions]);

  const { data: invoiceSettings, isLoading: settingsLoading } = useQuery<InvoicePreviewSettings>({
    queryKey: ["/api/invoice-settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/invoice-settings");
      return res.json();
    },
    enabled: open,
  });

  useEffect(() => {
    if (!open) {
      lastPopulatedContactIdRef.current = null;
      editLoadedRef.current = null;
      setGstTypeStore("igst");
      setInclusiveGst(false);
      setInvoiceCurrency("INR");
      setInvoiceStatus("due");
      setAmountPaid(0);
      setLineItems([defaultLineItem(defaultHsn, defaultGstPct)]);
      setPreviewInvoiceNo("");
      setCreatedInvoiceNo(null);
      setEmailAutomation(false);
      setWhatsappAutomation(false);
      setSelectedContactId("");
      setInvoiceTo({
        customerName: "",
        customerContact: "",
        customerPhone: "",
        customerEmail: "",
        customerCity: "",
        customerAddress: "",
        customerGst: "",
      });
      return;
    }
    if (contact?.id && !isEditMode) {
      setSelectedContactId(contact.id);
    }
  }, [open, contact?.id, isEditMode]);

  useEffect(() => {
    if (!open || !editInvoiceId || !editInvoice) return;
    if (editLoadedRef.current === editInvoiceId) return;
    editLoadedRef.current = editInvoiceId;

    setGstTypeStore(gstTypeFromStored(editInvoice.gstType));
    setInvoiceCurrency(editInvoice.currency || "INR");
    setInvoiceStatus(normalizeInvoicePaymentStatus(editInvoice.invoiceStatus));
    setAmountPaid(editInvoice.amountPaid ?? 0);
    const gstPct = invoiceSettings?.gstPercentage ?? defaultGstPct;
    const hsn = invoiceSettings?.hsnCode?.trim() || defaultHsn;
    const storedItems = Array.isArray(editInvoice.lineItems) ? editInvoice.lineItems : [];
    setLineItems(
      storedItems.length > 0 ? storedItems : [defaultLineItem(hsn, gstPct)],
    );
    setInvoiceTo(invoiceToFromStored(editInvoice));
    setEmailAutomation(!!editInvoice.emailAutomation);
    setWhatsappAutomation(!!editInvoice.whatsappAutomation);
    setPreviewInvoiceNo(editInvoice.invoiceNo);
    setCreatedInvoiceNo(null);
    setSelectedContactId(editInvoice.contactId || "");
    lastPopulatedContactIdRef.current = editInvoice.contactId || editInvoice.id;
  }, [open, editInvoiceId, editInvoice, invoiceSettings]);

  useEffect(() => {
    if (!open || !invoiceSettings || isEditMode) return;
    const gstPct = invoiceSettings.gstPercentage ?? 18;
    const hsn = invoiceSettings.hsnCode?.trim() || defaultHsn;
    setLineItems([defaultLineItem(hsn, gstPct)]);
    setInvoiceCurrency(invoiceSettings.invoiceCurrency || "INR");
    setEmailAutomation(!!invoiceSettings.emailAutomation);
    setWhatsappAutomation(!!invoiceSettings.whatsappAutomation);
    const prefix = isGst
      ? invoiceSettings.gstInvoicePrefix
      : invoiceSettings.nonGstInvoicePrefix;
    const start = isGst
      ? invoiceSettings.gstInvoiceStart ?? 1
      : invoiceSettings.nonGstInvoiceStart ?? 1;
    setPreviewInvoiceNo(formatInvoiceNumber(prefix, start));
  }, [open, invoiceSettings, isGst, isEditMode]);

  useEffect(() => {
    if (!open || isEditMode) return;

    const contactIdToUse = contact?.id ?? (showContactPicker ? selectedContactId : "");
    if (!contactIdToUse) return;
    if (lastPopulatedContactIdRef.current === contactIdToUse) return;

    const source = contact ?? contactOptions?.find((c) => c.id === contactIdToUse);
    if (!source) return;

    lastPopulatedContactIdRef.current = contactIdToUse;
    setInvoiceTo(invoiceToFromContact(source));
    setCreatedInvoiceNo(null);
  }, [open, contact, showContactPicker, selectedContactId, contactOptions]);

  const previewGrandTotal = useMemo(() => {
    const gstPct = invoiceSettings?.gstPercentage ?? defaultGstPct;
    const hsn = invoiceSettings?.hsnCode?.trim() || defaultHsn;
    const computed = computeInvoiceLineItems(lineItems, {
      gstTypeStore,
      inclusiveGst,
      defaultGstPct: gstPct,
      defaultHsn: hsn,
    });
    return computeInvoiceGrandTotal(computed);
  }, [lineItems, gstTypeStore, inclusiveGst, invoiceSettings]);

  const roundedGrandTotal = Math.round(previewGrandTotal * 100) / 100;

  useEffect(() => {
    if (invoiceStatus === "paid") {
      setAmountPaid(roundedGrandTotal);
    } else if (invoiceStatus === "due") {
      setAmountPaid(0);
    }
  }, [invoiceStatus, roundedGrandTotal]);

  useEffect(() => {
    if (invoiceStatus === "half_paid") {
      setAmountPaid((prev) => Math.min(roundedGrandTotal, Math.max(0, prev)));
    }
  }, [roundedGrandTotal, invoiceStatus]);

  const updateInvoiceTo = (patch: Partial<InvoiceToDetails>) => {
    setInvoiceTo((prev) => ({ ...prev, ...patch }));
  };

  const settingsForBuild = useMemo(
    () =>
      invoiceSettings
        ? { ...invoiceSettings, invoiceCurrency }
        : ({ invoiceCurrency } as InvoicePreviewSettings),
    [invoiceSettings, invoiceCurrency],
  );

  const invoiceData = useMemo(() => {
    if (!effectiveContact || !invoiceSettings) return null;
    return buildContactInvoiceData({
      settings: settingsForBuild,
      organizationName: organization?.name || "Your Company",
      organizationWebsite: organization?.website,
      contact: effectiveContact,
      gstTypeStore,
      inclusiveGst,
      invoiceCurrency,
      invoiceNo: createdInvoiceNo || previewInvoiceNo || "DRAFT",
      lineItems,
      invoiceTo,
      invoiceStatus,
      amountPaid: invoiceStatus === "half_paid" ? amountPaid : undefined,
      dateStr: isEditMode ? formatStoredInvoiceDate(editInvoice?.invoiceDate) : undefined,
    });
  }, [
    effectiveContact,
    invoiceSettings,
    settingsForBuild,
    organization,
    gstTypeStore,
    inclusiveGst,
    invoiceCurrency,
    previewInvoiceNo,
    createdInvoiceNo,
    lineItems,
    invoiceTo,
    invoiceStatus,
    amountPaid,
    isEditMode,
    editInvoice?.invoiceDate,
  ]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveContact || !invoiceData) throw new Error("No contact selected");
      if (isEditMode && editInvoice?.isLocked) throw new Error("Invoice is locked");
      const content = printRef.current;
      if (!content) throw new Error("Invoice preview not ready");

      const pdfBlob = await generateInvoicePdfBlob(content);
      const formData = new FormData();
      formData.append("pdf", pdfBlob, `invoice-${invoiceData.invoiceNo}.pdf`);
      formData.append(
        "data",
        JSON.stringify({
          gstTypeStore,
          isGst,
          inclusiveGst,
          invoiceCurrency,
          lineItems,
          invoiceTo,
          invoiceStatus,
          amountPaid: invoiceStatus === "half_paid" ? amountPaid : undefined,
          emailAutomation,
          whatsappAutomation,
        }),
      );

      const url = isEditMode
        ? `/api/invoices/${editInvoiceId}/update`
        : `/api/contacts/${effectiveContact.id}/create-invoice`;

      const res = await fetch(resolveApiUrl(url), {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || (isEditMode ? "Failed to update invoice" : "Failed to generate invoice"));
      }
      return res.json() as Promise<{
        invoiceNo: string;
        delivery?: {
          email?: { attempted: boolean; sent: boolean; error?: string };
          whatsapp?: { attempted: boolean; sent: boolean; error?: string };
        };
      }>;
    },
    onSuccess: (result) => {
      setCreatedInvoiceNo(result.invoiceNo);
      if (!isEditMode) {
        queryClient.invalidateQueries({ queryKey: ["/api/invoice-settings"] });
        queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices/summary"] });
      if (isEditMode) {
        queryClient.invalidateQueries({ queryKey: ["/api/invoices", editInvoiceId] });
        onInvoiceUpdated?.();
      } else {
        onInvoiceCreated?.();
      }

      const parts = [
        isEditMode ? `Invoice ${result.invoiceNo} updated.` : `Invoice ${result.invoiceNo} saved.`,
      ];
      if (result.delivery?.email?.attempted) {
        parts.push(
          result.delivery.email.sent
            ? "Sent via email."
            : `Email not sent: ${result.delivery.email.error || "unknown error"}`,
        );
      }
      if (result.delivery?.whatsapp?.attempted) {
        parts.push(
          result.delivery.whatsapp.sent
            ? "Sent via WhatsApp."
            : `WhatsApp not sent: ${result.delivery.whatsapp.error || "unknown error"}`,
        );
      }

      const hasDeliveryFailure =
        (result.delivery?.email?.attempted && !result.delivery.email.sent) ||
        (result.delivery?.whatsapp?.attempted && !result.delivery.whatsapp.sent);

      toast({
        variant: hasDeliveryFailure ? "destructive" : "default",
        title: hasDeliveryFailure
          ? isEditMode
            ? "Invoice updated with delivery issues"
            : "Invoice saved with delivery issues"
          : isEditMode
            ? "Invoice updated"
            : "Invoice generated",
        description: parts.join(" "),
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: isEditMode ? "Failed to update invoice" : "Failed to generate invoice",
        description: error.message,
      });
    },
  });

  const updateLine = (index: number, patch: Partial<InvoiceLineItemInput>) => {
    setLineItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addLineItem = () => {
    const gstPct = invoiceSettings?.gstPercentage ?? defaultGstPct;
    const hsn = invoiceSettings?.hsnCode?.trim() || defaultHsn;
    setLineItems((prev) => [...prev, defaultLineItem(hsn, gstPct)]);
  };

  const getLineComputed = (row: InvoiceLineItemInput) => {
    const gstPct = invoiceSettings?.gstPercentage ?? defaultGstPct;
    const hsn = invoiceSettings?.hsnCode?.trim() || defaultHsn;
    return computeInvoiceLineItems([row], {
      gstTypeStore,
      inclusiveGst,
      defaultGstPct: gstPct,
      defaultHsn: hsn,
    })[0]!;
  };

  const handleDownload = async () => {
    if (!invoiceData) return;
    const content = printRef.current;
    if (!content) return;
    try {
      setDownloadingPdf(true);
      const blob = await generateInvoicePdfBlob(content);
      downloadInvoicePdf(blob, invoiceData.invoiceNo);
      toast({
        title: "Download started",
        description: `Invoice ${invoiceData.invoiceNo}.pdf is downloading.`,
      });
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "PDF download failed",
        description: error instanceof Error ? error.message : "Could not generate PDF",
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const sym = currencySymbol(invoiceCurrency);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="create-invoice-dialog flex max-h-[96vh] w-[calc(100vw-2rem)] max-w-5xl flex-col gap-0 overflow-hidden p-4 sm:p-6">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            {isEditMode
              ? `Edit Invoice — ${previewInvoiceNo || editInvoice?.invoiceNo || "…"}`
              : `Create Invoice — ${effectiveContact?.name || effectiveContact?.phoneNumber || (showContactPicker ? "Select customer" : "Contact")}`}
          </DialogTitle>
        </DialogHeader>

        {(settingsLoading || !invoiceSettings || (isEditMode && editLoading)) ? (
          <div className="flex min-h-0 flex-1 items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="mx-auto min-h-0 w-full max-w-[56rem] flex-1 space-y-6 overflow-y-auto pr-1">
            {isEditMode ? (
              <p className="text-sm text-muted-foreground">
                Invoice #: <span className="font-semibold text-foreground">{previewInvoiceNo}</span>
                {editInvoice?.isLocked && (
                  <span className="ml-2 text-destructive">(Locked — cannot save changes)</span>
                )}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Next invoice #: <span className="font-semibold text-foreground">{previewInvoiceNo}</span>
              </p>
            )}

            <div className="space-y-3 rounded-lg border p-4">
              <Label className="text-base font-semibold">Invoice To</Label>
              {showContactPicker && (
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Customer <span className="text-destructive">*</span>
                  </Label>
                  <ContactPickerCombobox
                    contacts={contactOptions ?? []}
                    value={selectedContactId}
                    onValueChange={setSelectedContactId}
                  />
                </div>
              )}
              {showContactPicker && !selectedContactId ? (
                <p className="text-sm text-muted-foreground">
                  Select a customer above to fill invoice details.
                </p>
              ) : (
                <>
                  {showContactPicker && (
                    <p className="text-xs text-muted-foreground">
                      Details are pre-filled from the contact. You can edit any field for this invoice.
                    </p>
                  )}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Name</Label>
                  <Input
                    value={invoiceTo.customerName}
                    onChange={(e) => updateInvoiceTo({ customerName: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Contact Person</Label>
                  <Input
                    value={invoiceTo.customerContact}
                    onChange={(e) => updateInvoiceTo({ customerContact: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Phone Number</Label>
                  <Input
                    value={invoiceTo.customerPhone}
                    onChange={(e) => updateInvoiceTo({ customerPhone: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Email</Label>
                  <Input
                    type="email"
                    value={invoiceTo.customerEmail}
                    onChange={(e) => updateInvoiceTo({ customerEmail: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">City</Label>
                  <Input
                    value={invoiceTo.customerCity}
                    onChange={(e) => updateInvoiceTo({ customerCity: e.target.value })}
                  />
                </div>
                {isGst && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">GST No</Label>
                    <Input
                      value={invoiceTo.customerGst}
                      onChange={(e) => updateInvoiceTo({ customerGst: e.target.value })}
                    />
                  </div>
                )}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Address</Label>
                  <Textarea
                    rows={2}
                    value={invoiceTo.customerAddress}
                    onChange={(e) => updateInvoiceTo({ customerAddress: e.target.value })}
                  />
                </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border p-4">
              <div className="space-y-3">
                <Label className="text-sm font-semibold">
                  GST Type Store <span className="text-destructive">*</span>
                </Label>
                <RadioGroup
                  value={gstTypeStore}
                  onValueChange={(v) => setGstTypeStore(v as GstTypeStore)}
                  className="flex flex-wrap gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="non_gst" id="gst-non" />
                    <Label htmlFor="gst-non" className="font-normal cursor-pointer">Non GST</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="igst" id="gst-igst" />
                    <Label htmlFor="gst-igst" className="font-normal cursor-pointer">IGST</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="sgst_cgst" id="gst-sgst" />
                    <Label htmlFor="gst-sgst" className="font-normal cursor-pointer">SGST / CGST</Label>
                  </div>
                </RadioGroup>
                {isGst && (
                  <div className="flex items-center gap-3 pt-1">
                    <Switch id="inclusive-gst" checked={inclusiveGst} onCheckedChange={setInclusiveGst} />
                    <Label htmlFor="inclusive-gst" className="font-normal">Inclusive GST</Label>
                  </div>
                )}
              </div>
              <div className="w-full sm:w-48 space-y-1.5">
                <Label className="text-sm font-semibold">Invoice Currency</Label>
                <Select value={invoiceCurrency} onValueChange={setInvoiceCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-56 space-y-2">
                <Label className="text-sm font-semibold">
                  Invoice Status <span className="text-destructive">*</span>
                </Label>
                <RadioGroup
                  value={invoiceStatus}
                  onValueChange={(v) => {
                    const next = v as InvoicePaymentStatus;
                    setInvoiceStatus(next);
                    if (next === "half_paid") {
                      setAmountPaid(Math.round((roundedGrandTotal / 2) * 100) / 100);
                    }
                  }}
                  className="flex flex-col gap-2"
                >
                  {INVOICE_PAYMENT_STATUS_OPTIONS.map((opt) => (
                    <div key={opt.value} className="flex items-center gap-2">
                      <RadioGroupItem value={opt.value} id={`invoice-status-${opt.value}`} />
                      <Label htmlFor={`invoice-status-${opt.value}`} className="font-normal cursor-pointer">
                        {opt.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
                {invoiceStatus === "half_paid" && (
                  <div className="space-y-1.5 pt-1">
                    <Label className="text-xs font-semibold">Amount Paid</Label>
                    <MoneyInput
                      currency={invoiceCurrency}
                      value={amountPaid}
                      onChange={setAmountPaid}
                    />
                    <p className="text-xs text-muted-foreground">
                      Pending: {currencySymbol(invoiceCurrency)}
                      {Math.max(0, Math.round((roundedGrandTotal - amountPaid) * 100) / 100).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                )}
                {invoiceStatus === "paid" && (
                  <p className="text-xs text-muted-foreground pt-1">
                    Full amount ({currencySymbol(invoiceCurrency)}
                    {roundedGrandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) marked as paid.
                  </p>
                )}
                {invoiceStatus === "due" && (
                  <p className="text-xs text-muted-foreground pt-1">
                    Full amount ({currencySymbol(invoiceCurrency)}
                    {roundedGrandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) marked as pending.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {lineItems.map((row, index) => {
                const computed = getLineComputed(row);
                return (
                  <div key={index} className="relative rounded-lg border p-4 space-y-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-2 h-8 w-8"
                      disabled={lineItems.length <= 1}
                      onClick={() => setLineItems((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <X className="h-4 w-4" />
                    </Button>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pr-8">
                      <div className="sm:col-span-8 space-y-1.5">
                        <Label className="text-xs">Item <span className="text-destructive">*</span></Label>
                        <Input
                          placeholder="Product Name"
                          value={row.name}
                          onChange={(e) => updateLine(index, { name: e.target.value })}
                        />
                      </div>
                      {isGst && (
                        <div className="sm:col-span-4 space-y-1.5">
                          <Label className="text-xs">HSN Code <span className="text-destructive">*</span></Label>
                          <Input
                            value={row.hsn || ""}
                            onChange={(e) => updateLine(index, { hsn: e.target.value })}
                          />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
                      <div className="space-y-1.5 lg:col-span-2">
                        <Label className="text-xs">Cost <span className="text-destructive">*</span></Label>
                        <MoneyInput
                          currency={invoiceCurrency}
                          value={row.cost}
                          onChange={(v) => updateLine(index, { cost: v })}
                        />
                      </div>
                      <div className="space-y-1.5 lg:col-span-3">
                        <Label className="text-xs">Qty <span className="text-destructive">*</span></Label>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => updateLine(index, { qty: Math.max(1, row.qty - 1) })}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <Input
                            type="number"
                            min={1}
                            className="min-w-0 flex-1 text-center"
                            value={row.qty}
                            onChange={(e) => updateLine(index, { qty: parseInt(e.target.value, 10) || 1 })}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => updateLine(index, { qty: row.qty + 1 })}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1.5 lg:col-span-2">
                        <Label className="text-xs">Discount <span className="text-destructive">*</span></Label>
                        <Input
                          type="number"
                          min={0}
                          value={row.discount}
                          onChange={(e) => updateLine(index, { discount: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="space-y-1.5 lg:col-span-3">
                        <Label className="text-xs">Discount Type</Label>
                        <Select
                          value={row.discountType || "overall"}
                          onValueChange={() => updateLine(index, { discountType: "overall" })}
                        >
                          <SelectTrigger className="min-w-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="overall">Overall Discount</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5 lg:col-span-2">
                        <Label className="text-xs">Sub Total</Label>
                        <MoneyInput currency={invoiceCurrency} value={computed.subTotal} readOnly />
                      </div>
                    </div>

                    {isGst && (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {gstTypeStore === "igst" ? (
                          <div className="space-y-1.5">
                            <Label className="text-xs">IGST</Label>
                            <div className="relative">
                              <Input
                                type="number"
                                min={0}
                                step="0.1"
                                className="pr-8"
                                value={row.igstPct ?? invoiceSettings.gstPercentage ?? 18}
                                onChange={(e) =>
                                  updateLine(index, { igstPct: parseFloat(e.target.value) || 0 })
                                }
                              />
                              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="space-y-1.5">
                              <Label className="text-xs">SGST</Label>
                              <div className="relative">
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.1"
                                  className="pr-8"
                                  value={row.sgstPct ?? (invoiceSettings.gstPercentage ?? 18) / 2}
                                  onChange={(e) =>
                                    updateLine(index, { sgstPct: parseFloat(e.target.value) || 0 })
                                  }
                                />
                                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">CGST</Label>
                              <div className="relative">
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.1"
                                  className="pr-8"
                                  value={row.cgstPct ?? (invoiceSettings.gstPercentage ?? 18) / 2}
                                  onChange={(e) =>
                                    updateLine(index, { cgstPct: parseFloat(e.target.value) || 0 })
                                  }
                                />
                                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                              </div>
                            </div>
                          </>
                        )}
                        <div className="space-y-1.5">
                          <Label className="text-xs">Tax Amount</Label>
                          <div className="flex h-9 items-center rounded-md border bg-muted px-3 text-sm">
                            {sym} {computed.tax.toFixed(2)}
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Total Amount</Label>
                          <div className="flex h-9 items-center rounded-md border bg-muted px-3 text-sm font-medium">
                            {sym} {computed.lineTotal.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    )}

                    {!isGst && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="space-y-1.5 sm:col-start-4">
                          <Label className="text-xs">Total Amount</Label>
                          <div className="flex h-9 items-center rounded-md border bg-muted px-3 text-sm font-medium">
                            {sym} {computed.lineTotal.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label className="text-xs">Comments</Label>
                      <Textarea
                        rows={2}
                        placeholder="Comments"
                        value={row.comments || ""}
                        onChange={(e) => updateLine(index, { comments: e.target.value })}
                      />
                    </div>
                  </div>
                );
              })}

              <Button type="button" variant="default" onClick={addLineItem}>
                <Plus className="h-4 w-4 mr-2" /> Add Item
              </Button>
            </div>

            {invoiceData && (
              <div ref={printRef} className="overflow-x-auto rounded-lg bg-gray-100 p-3 sm:p-4">
                <InvoiceDocumentView data={invoiceData} theme={INVOICE_TEMPLATE_THEME} />
              </div>
            )}
          </div>
        )}

        <DialogFooter className="shrink-0 flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t pt-4">
          <div className="space-y-3 w-full sm:w-auto">
            <p className="text-sm font-semibold text-primary">Automation</p>
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-3">
                <Switch
                  id="email-automation"
                  checked={emailAutomation}
                  onCheckedChange={setEmailAutomation}
                />
                <Label htmlFor="email-automation" className="font-normal">Email Automation</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="whatsapp-automation"
                  checked={whatsappAutomation}
                  onCheckedChange={setWhatsappAutomation}
                />
                <Label htmlFor="whatsapp-automation" className="font-normal">Whatsapp Automation</Label>
              </div>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => saveMutation.mutate()}
              disabled={
                !invoiceData ||
                !effectiveContact ||
                saveMutation.isPending ||
                !!createdInvoiceNo ||
                (isEditMode && !!editInvoice?.isLocked)
              }
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {createdInvoiceNo
                ? isEditMode
                  ? "Saved"
                  : "Generated"
                : isEditMode
                  ? "Save"
                  : "Generate"}
            </Button>
            <Button type="button" variant="outline" onClick={handleDownload} disabled={!invoiceData || !effectiveContact || downloadingPdf}>
              {downloadingPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Download
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
