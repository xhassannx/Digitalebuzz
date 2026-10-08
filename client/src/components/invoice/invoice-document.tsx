import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { User, FileText, MapPin, Instagram, Facebook, MessageCircle, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildUpiPaymentUri, generateUpiQrDataUrl, isValidUpiId } from "@/lib/upi-qr";
import { formatInvoiceNumber, invoicePaymentStatusLabel, normalizeInvoicePaymentStatus, computeInvoicePaymentAmounts, type InvoicePaymentStatus } from "@shared/invoice";

export type InvoicePreviewSettings = {
  invoiceBusinessName?: string | null;
  invoiceCompanyAddress?: string | null;
  invoiceCompanyPhone?: string | null;
  invoiceCompanyGstNo?: string | null;
  gstInvoicePrefix?: string | null;
  gstInvoiceStart?: number;
  gstPercentage?: number | null;
  gstBankName?: string | null;
  gstAccountNo?: string | null;
  gstIfscCode?: string | null;
  gstPaymentUpiId?: string | null;
  gstEmailId?: string | null;
  gstTermsAndConditions?: string | null;
  gstSignatureUrl?: string | null;
  gstSignatureSizePx?: number | null;
  nonGstInvoicePrefix?: string | null;
  nonGstInvoiceStart?: number;
  nonGstBankName?: string | null;
  nonGstAccountNo?: string | null;
  nonGstIfscCode?: string | null;
  nonGstPaymentUpiId?: string | null;
  nonGstEmailId?: string | null;
  nonGstTermsAndConditions?: string | null;
  nonGstSignatureUrl?: string | null;
  nonGstSignatureSizePx?: number | null;
  invoiceCurrency?: string;
  hsnCode?: string | null;
  emailAutomation?: boolean;
  whatsappAutomation?: boolean;
  invoiceBannerUrl?: string | null;
};

export type GstTypeStore = "non_gst" | "igst" | "sgst_cgst";
export type LineDiscountType = "overall";

export type InvoiceLineItemInput = {
  name: string;
  desc?: string;
  comments?: string;
  cost: number;
  qty: number;
  discount: number;
  discountType?: LineDiscountType;
  hsn?: string;
  igstPct?: number;
  sgstPct?: number;
  cgstPct?: number;
};

export type ComputedInvoiceLineItem = InvoiceLineItemInput & {
  hsn: string;
  subTotal: number;
  tax: number;
  sgstTax: number;
  cgstTax: number;
  igstTax: number;
  lineTotal: number;
};

export const CURRENCY_OPTIONS = [
  { value: "INR", label: "₹ - India" },
  { value: "USD", label: "$ - United States" },
  { value: "EUR", label: "€ - Euro" },
  { value: "GBP", label: "£ - United Kingdom" },
  { value: "AED", label: "د.إ - UAE" },
] as const;

export type InvoiceToDetails = {
  customerName: string;
  customerContact: string;
  customerPhone: string;
  customerEmail: string;
  customerCity: string;
  customerAddress: string;
  customerGst: string;
};

export const INVOICE_PARTNER_BANNER_URL = "/invoice/partner-banner.png";
/** Stored in settings when the org opts out of a header banner. */
export const INVOICE_BANNER_NONE = "none";
/** Recommended banner size shown in settings (matches default partner banner). */
export const INVOICE_BANNER_RECOMMENDED_WIDTH = 1024;
export const INVOICE_BANNER_RECOMMENDED_HEIGHT = 397;
export const INVOICE_BANNER_MAX_BYTES = 5 * 1024 * 1024;

/** Resolves the banner image URL. Returns null when the banner is disabled. */
export function resolveInvoiceBannerUrl(customUrl?: string | null): string | null {
  const trimmed = customUrl?.trim();
  if (!trimmed) return INVOICE_PARTNER_BANNER_URL;
  if (trimmed === INVOICE_BANNER_NONE) return null;
  return trimmed;
}

export function isInvoiceBannerRemoved(customUrl?: string | null): boolean {
  return customUrl?.trim() === INVOICE_BANNER_NONE;
}

/** Google Maps link for invoice "Locate Us" footer (opens in new tab / PDF link). */
export const INVOICE_LOCATE_US_URL = "https://maps.app.goo.gl/tgczRqKJKB6tTQJBA";
export const INVOICE_LOCATE_US_TEXT = "Open location on Google Maps";

export const INVOICE_TEMPLATE_THEME = {
  label: "Classic",
  accent: "#0059bb",
  accentLight: "#e8f1fc",
};

export const DEFAULT_SIGNATURE_SIZE_PX = 48;
export const MIN_SIGNATURE_SIZE_PX = 24;
export const MAX_SIGNATURE_SIZE_PX = 160;
export const SIGNATURE_SIZE_STEP_PX = 8;

export function clampSignatureSizePx(size?: number | null): number {
  const n = size ?? DEFAULT_SIGNATURE_SIZE_PX;
  return Math.min(MAX_SIGNATURE_SIZE_PX, Math.max(MIN_SIGNATURE_SIZE_PX, Math.round(n)));
}

export function signatureImageStyle(sizePx?: number | null): CSSProperties {
  const px = clampSignatureSizePx(sizePx);
  return { height: px, maxWidth: Math.round(px * 2.5), objectFit: "contain" };
}

export { formatInvoiceNumber, invoicePaymentStatusLabel, normalizeInvoicePaymentStatus, computeInvoicePaymentAmounts, INVOICE_PAYMENT_STATUS_OPTIONS } from "@shared/invoice";
export type { InvoicePaymentStatus } from "@shared/invoice";

export function invoiceToFromContact(contact: {
  name?: string | null;
  phoneNumber?: string;
  email?: string | null;
  customFields?: Record<string, unknown> | null;
}): InvoiceToDetails {
  const cf = contact.customFields || {};
  return {
    customerName: contact.name || "",
    customerContact: String(cf.contactPerson || contact.name || ""),
    customerPhone: contact.phoneNumber || "",
    customerEmail: contact.email || "",
    customerCity: String(cf.city || cf.City || ""),
    customerAddress: String(cf.address || cf.Address || ""),
    customerGst: String(cf.gstNo || cf.gst || cf.GST || ""),
  };
}

export type InvoiceDocumentData = {
  brandShort: string;
  brandFull: string;
  brandGst?: string;
  invoiceNo: string;
  dateStr: string;
  gstPct: number;
  currency: string;
  isGst: boolean;
  gstTypeStore: GstTypeStore;
  inclusiveGst: boolean;
  invoiceTitle: string;
  invoiceStatus: InvoicePaymentStatus;
  companyEmail: string;
  companyPhone: string;
  companyPhone2?: string;
  companyAddress: string;
  customerName: string;
  customerContact?: string;
  customerPhone: string;
  customerEmail?: string;
  customerCity?: string;
  customerAddress?: string;
  customerGst?: string;
  lineItems: ComputedInvoiceLineItem[];
  subTotal: number;
  discount: number;
  taxTotal: number;
  sgstTotal: number;
  cgstTotal: number;
  igstTotal: number;
  grandTotal: number;
  amountPaid: number;
  amountPending: number;
  bankName: string;
  accountNo: string;
  ifsc: string;
  upi?: string;
  terms: string;
  signatureUrl?: string | null;
  signatureSizePx: number;
  website?: string;
  bannerUrl?: string | null;
};

const CURRENCY_SYMBOL: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  AED: "د.إ",
};

export function currencySymbol(currency: string) {
  return CURRENCY_SYMBOL[currency] || "₹";
}

export function formatInvoiceMoney(amount: number, currency: string) {
  const sym = CURRENCY_SYMBOL[currency] || "₹";
  return `${sym}${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function amountInWords(amount: number): string {
  const ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
  const teens = ["ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

  function under1000(n: number): string {
    if (n === 0) return "";
    if (n < 10) return ones[n]!;
    if (n < 20) return teens[n - 10]!;
    if (n < 100) return `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ""}`.trim();
    return `${ones[Math.floor(n / 100)]} hundred${n % 100 ? ` ${under1000(n % 100)}` : ""}`.trim();
  }

  const int = Math.floor(amount);
  if (int < 1000) return under1000(int);
  if (int < 100000) {
    const th = Math.floor(int / 1000);
    const rem = int % 1000;
    return `${under1000(th)} thousand${rem ? ` ${under1000(rem)}` : ""}`;
  }
  const lakh = Math.floor(int / 100000);
  const rem = int % 100000;
  return `${under1000(lakh)} lakh${rem ? ` ${amountInWords(rem)}` : ""}`;
}

function brandInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase())
    .join("")
    .slice(0, 2) || "CO";
}

function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

export function computeInvoiceLineItems(
  items: InvoiceLineItemInput[],
  options: {
    gstTypeStore: GstTypeStore;
    inclusiveGst: boolean;
    defaultGstPct: number;
    defaultHsn: string;
  },
): ComputedInvoiceLineItem[] {
  const { gstTypeStore, inclusiveGst, defaultGstPct, defaultHsn } = options;
  const isGst = gstTypeStore !== "non_gst";

  return items.map((item) => {
    const hsn = item.hsn?.trim() || defaultHsn;
    const gross = item.cost * item.qty;
    const discount = item.discount || 0;
    const baseAfterDiscount = Math.max(0, gross - discount);
    const desc = item.comments?.trim() || item.desc?.trim() || undefined;

    if (!isGst) {
      return {
        ...item,
        desc,
        hsn,
        subTotal: roundMoney(baseAfterDiscount),
        tax: 0,
        sgstTax: 0,
        cgstTax: 0,
        igstTax: 0,
        lineTotal: roundMoney(baseAfterDiscount),
      };
    }

    const igstPct = item.igstPct ?? defaultGstPct;
    const sgstPct = item.sgstPct ?? defaultGstPct / 2;
    const cgstPct = item.cgstPct ?? defaultGstPct / 2;
    const totalTaxPct = gstTypeStore === "igst" ? igstPct : sgstPct + cgstPct;

    if (inclusiveGst) {
      const taxable = baseAfterDiscount / (1 + totalTaxPct / 100);
      const tax = baseAfterDiscount - taxable;
      const igstTax = gstTypeStore === "igst" ? tax : 0;
      const sgstTax = gstTypeStore === "sgst_cgst" ? tax * (sgstPct / totalTaxPct) : 0;
      const cgstTax = gstTypeStore === "sgst_cgst" ? tax * (cgstPct / totalTaxPct) : 0;
      return {
        ...item,
        desc,
        hsn,
        subTotal: roundMoney(taxable),
        tax: roundMoney(tax),
        igstTax: roundMoney(igstTax),
        sgstTax: roundMoney(sgstTax),
        cgstTax: roundMoney(cgstTax),
        lineTotal: roundMoney(baseAfterDiscount),
      };
    }

    const tax = roundMoney((baseAfterDiscount * totalTaxPct) / 100);
    const igstTax = gstTypeStore === "igst" ? tax : 0;
    const sgstTax = gstTypeStore === "sgst_cgst" ? roundMoney((baseAfterDiscount * sgstPct) / 100) : 0;
    const cgstTax = gstTypeStore === "sgst_cgst" ? roundMoney((baseAfterDiscount * cgstPct) / 100) : 0;

    return {
      ...item,
      desc,
      hsn,
      subTotal: roundMoney(baseAfterDiscount),
      tax,
      igstTax,
      sgstTax,
      cgstTax,
      lineTotal: roundMoney(baseAfterDiscount + tax),
    };
  });
}

export function computeInvoiceGrandTotal(lineItems: ComputedInvoiceLineItem[]) {
  return roundMoney(lineItems.reduce((sum, row) => sum + row.lineTotal, 0));
}

export function buildContactInvoiceData(params: {
  settings: InvoicePreviewSettings;
  organizationName: string;
  organizationWebsite?: string | null;
  organizationEmail?: string | null;
  contact: {
    name?: string | null;
    phoneNumber?: string;
    email?: string | null;
    customFields?: Record<string, unknown> | null;
  };
  gstTypeStore?: GstTypeStore;
  isGst?: boolean;
  inclusiveGst?: boolean;
  invoiceCurrency?: string;
  invoiceNo: string;
  lineItems: InvoiceLineItemInput[];
  invoiceTo?: Partial<InvoiceToDetails>;
  invoiceStatus?: InvoicePaymentStatus;
  amountPaid?: number | null;
  /** When set (e.g. editing an existing invoice), use this date on the document. */
  dateStr?: string;
}): InvoiceDocumentData {
  const {
    settings,
    organizationName,
    contact,
    invoiceNo,
    lineItems,
    invoiceTo,
    inclusiveGst = false,
    invoiceCurrency,
    invoiceStatus = "due",
    amountPaid: amountPaidInput,
  } = params;
  const gstTypeStore: GstTypeStore =
    params.gstTypeStore ?? (params.isGst === false ? "non_gst" : "igst");
  const isGst = gstTypeStore !== "non_gst";
  const currency = invoiceCurrency || settings.invoiceCurrency || "INR";
  const gstPct = settings.gstPercentage ?? 18;
  const defaultHsn = settings.hsnCode?.trim() || "998314";
  const defaults = invoiceToFromContact(contact);
  const to = { ...defaults, ...invoiceTo };
  const today = new Date();
  const dateStr =
    params.dateStr ||
    `${String(today.getDate()).padStart(2, "0")}-${String(today.getMonth() + 1).padStart(2, "0")}-${today.getFullYear()}`;
  const computed = computeInvoiceLineItems(lineItems, {
    gstTypeStore,
    inclusiveGst,
    defaultGstPct: gstPct,
    defaultHsn,
  });
  const subTotal = computed.reduce((s, l) => s + l.subTotal, 0);
  const discount = computed.reduce((s, l) => s + l.discount, 0);
  const taxTotal = computed.reduce((s, l) => s + l.tax, 0);
  const sgstTotal = computed.reduce((s, l) => s + l.sgstTax, 0);
  const cgstTotal = computed.reduce((s, l) => s + l.cgstTax, 0);
  const igstTotal = computed.reduce((s, l) => s + l.igstTax, 0);
  const grandTotal = computeInvoiceGrandTotal(computed);
  const status = normalizeInvoicePaymentStatus(invoiceStatus);
  const { amountPaid, amountPending } = computeInvoicePaymentAmounts(status, grandTotal, amountPaidInput);

  const businessName =
    settings.invoiceBusinessName?.trim() ||
    organizationName.trim() ||
    "Your Company";

  return {
    brandShort: businessName.split(/\s+/).slice(0, 2).join(" ") || businessName,
    brandFull: businessName,
    invoiceNo,
    dateStr,
    gstPct,
    currency,
    isGst,
    gstTypeStore,
    inclusiveGst,
    invoiceTitle: isGst ? "TAX Invoice" : "Invoice",
    invoiceStatus: status,
    companyEmail:
      (isGst ? settings.gstEmailId : settings.nonGstEmailId)?.trim() ||
      params.organizationEmail?.trim() ||
      "",
    companyPhone: settings.invoiceCompanyPhone?.trim() || "",
    companyAddress: settings.invoiceCompanyAddress?.trim() || "",
    brandGst: isGst ? settings.invoiceCompanyGstNo?.trim() || undefined : undefined,
    customerName: to.customerName || "Customer",
    customerContact: to.customerContact || undefined,
    customerPhone: to.customerPhone,
    customerEmail: to.customerEmail || undefined,
    customerCity: to.customerCity || undefined,
    customerAddress: to.customerAddress || undefined,
    customerGst: to.customerGst || undefined,
    lineItems: computed,
    subTotal,
    discount,
    taxTotal,
    sgstTotal,
    cgstTotal,
    igstTotal,
    grandTotal,
    amountPaid,
    amountPending,
    bankName: (isGst ? settings.gstBankName : settings.nonGstBankName)?.trim() || "",
    accountNo: (isGst ? settings.gstAccountNo : settings.nonGstAccountNo)?.trim() || "",
    ifsc: (isGst ? settings.gstIfscCode : settings.nonGstIfscCode)?.trim() || "",
    upi: (
      gstTypeStore === "non_gst"
        ? settings.nonGstPaymentUpiId
        : settings.gstPaymentUpiId
    )?.trim() || undefined,
    terms:
      (isGst ? settings.gstTermsAndConditions : settings.nonGstTermsAndConditions)?.trim() ||
      "Payment due within 15 days. Goods once sold will not be taken back.",
    signatureUrl: isGst ? settings.gstSignatureUrl : settings.nonGstSignatureUrl,
    signatureSizePx: clampSignatureSizePx(
      isGst ? settings.gstSignatureSizePx : settings.nonGstSignatureSizePx,
    ),
    website: params.organizationWebsite || undefined,
    bannerUrl: resolveInvoiceBannerUrl(settings.invoiceBannerUrl),
  };
}

export function buildSampleInvoiceData(
  templateId: number,
  settings: InvoicePreviewSettings,
  isGst: boolean,
): InvoiceDocumentData {
  const brands = [
    { full: "Nova Commerce Pvt. Ltd.", short: "NovaLine" },
    { full: "Summit Retail Solutions", short: "Summit Hub" },
  ];
  const brand = brands[templateId % brands.length]!;
  const businessName = settings.invoiceBusinessName?.trim() || brand.full;
  const prefix = isGst ? settings.gstInvoicePrefix : settings.nonGstInvoicePrefix;
  const start = isGst ? (settings.gstInvoiceStart ?? 1) : (settings.nonGstInvoiceStart ?? 1);
  const invoiceNo = formatInvoiceNumber(prefix, start + 100 + templateId);
  const lineItems: InvoiceLineItemInput[] = isGst
    ? [{ name: "Server + 5 Email id", cost: 4000, qty: 1, discount: 0 }]
    : [
        { name: "Product 1", cost: 2222, qty: 1, discount: 0 },
        { name: "Product 2", cost: 4444, qty: 1, discount: 0 },
      ];

  return buildContactInvoiceData({
    settings,
    organizationName: businessName,
    organizationWebsite: "samplemerchant-demo.in",
    organizationEmail: `billing@${brand.short.toLowerCase()}.in`,
    contact: {
      name: "Yash TradeLink",
      phoneNumber: "919876543210",
      email: "client@demo.in",
      customFields: { city: "Indore", contactPerson: "Gaurav", gstNo: "23AABCY7890K5Z3" },
    },
    gstTypeStore: isGst ? "igst" : "non_gst",
    invoiceNo,
    lineItems,
  });
}

function SignatureLogo({
  signatureUrl,
  short,
  sizePx,
}: {
  signatureUrl?: string | null;
  short: string;
  sizePx: number;
}) {
  const px = clampSignatureSizePx(sizePx);

  if (signatureUrl) {
    return (
      <div className="flex flex-col items-center justify-center">
        <img src={signatureUrl} alt="Company signature" style={signatureImageStyle(px)} />
      </div>
    );
  }

  const letter = brandInitials(short);
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-gray-400"
        style={{ height: px, width: px, fontSize: Math.max(12, Math.round(px * 0.35)) }}
      >
        {letter}
      </div>
      <span className="text-[9px] text-gray-400">No signature</span>
    </div>
  );
}

function UpiPaymentQrCode({
  upiId,
  payeeName,
  amount,
  currency,
  invoiceNo,
}: {
  upiId?: string;
  payeeName: string;
  amount: number;
  currency: string;
  invoiceNo: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const validUpi = upiId && isValidUpiId(upiId) ? upiId.trim() : "";
  const qrSizePx = 148;

  useEffect(() => {
    if (!validUpi) {
      setDataUrl(null);
      return;
    }
    let cancelled = false;
    const uri = buildUpiPaymentUri({
      upiId: validUpi,
      payeeName,
      amount: amount > 0 ? amount : undefined,
      currency,
      note: invoiceNo ? `Invoice ${invoiceNo}` : undefined,
    });
    generateUpiQrDataUrl(uri, qrSizePx)
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [validUpi, payeeName, amount, currency, invoiceNo]);

  if (!validUpi) {
    return (
      <div className="flex h-36 w-36 shrink-0 items-center justify-center rounded border border-dashed border-gray-300 bg-gray-50 p-2 text-center text-[10px] text-gray-400">
        Add UPI ID in Invoice settings
      </div>
    );
  }

  if (!dataUrl) {
    return (
      <div className="h-36 w-36 shrink-0 animate-pulse rounded border border-gray-200 bg-gray-100" />
    );
  }

  return (
    <img
      src={dataUrl}
      alt={`UPI payment QR for ${validUpi}`}
      className="h-36 w-36 shrink-0 rounded border border-gray-300 bg-white object-contain p-1.5"
    />
  );
}

function InvoiceAmount({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("text-xs font-semibold tabular-nums", className)}>
      {children}
    </span>
  );
}

function SectionHeader({ icon: Icon, title, accent }: { icon: typeof User; title: string; accent: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-white" style={{ backgroundColor: accent }}>
      <Icon className="h-3 w-3" />
      {title}
    </div>
  );
}

function InvoiceStatusBadge({
  status,
  accent,
}: {
  status: InvoicePaymentStatus;
  accent: string;
}) {
  const label = invoicePaymentStatusLabel(status);
  const styles: Record<InvoicePaymentStatus, { bg: string; color: string }> = {
    due: { bg: "#fef2f2", color: "#b91c1c" },
    half_paid: { bg: "#fffbeb", color: "#b45309" },
    paid: { bg: "#ecfdf5", color: "#047857" },
  };
  const s = styles[status];
  return (
    <span
      className="inline-block rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wide sm:text-sm"
      style={{ backgroundColor: s.bg, color: s.color, border: `1px solid ${accent}22` }}
    >
      {label}
    </span>
  );
}

export function InvoiceDocumentView({
  data,
  theme = INVOICE_TEMPLATE_THEME,
  className,
  id,
}: {
  data: InvoiceDocumentData;
  theme?: typeof INVOICE_TEMPLATE_THEME;
  className?: string;
  id?: string;
}) {
  const gstHeaders =
    data.gstTypeStore === "sgst_cgst"
      ? ["#", "Product Name", "HSN Code", "Cost", "Qty", "Discount", "SGST", "CGST", "Total Amount"]
      : ["#", "Product Name", "HSN Code", "Cost", "Qty", "Discount", "IGST", "Total Amount"];
  const nonGstHeaders = ["#", "Product Name", "Cost", "Qty", "Discount", "Total Amount"];

  return (
    <div
      id={id}
      className={cn(
        "invoice-pdf-root overflow-hidden rounded-lg border bg-white shadow-lg text-xs text-gray-800",
        className,
      )}
    >
      {data.bannerUrl ? (
        <div className="border-b bg-white">
          <img
            src={data.bannerUrl}
            alt="Invoice banner"
            className="block w-full h-auto"
          />
        </div>
      ) : null}

      <div className="grid grid-cols-3 items-center gap-1.5 border-b px-3 py-2">
        <div className="flex flex-col items-center justify-center">
          <SignatureLogo signatureUrl={data.signatureUrl} short={data.brandShort} sizePx={data.signatureSizePx} />
          <p className="mt-1 max-w-[140px] text-center text-[11px] font-bold leading-tight text-gray-800">
            {data.brandFull}
          </p>
        </div>
        <div className="text-center">
          <h2 className="text-base font-bold" style={{ color: theme.accent }}>
            {data.invoiceTitle}
          </h2>
        </div>
        <div className="text-right text-xs">
          <p><span className="font-semibold">Invoice No:</span> <InvoiceAmount>{data.invoiceNo}</InvoiceAmount></p>
          <p><span className="font-semibold">Date:</span> <InvoiceAmount>{data.dateStr}</InvoiceAmount></p>
          <p className="mt-1 flex items-center justify-end gap-1.5">
            <span className="font-semibold">Status:</span>
            <InvoiceStatusBadge status={data.invoiceStatus} accent={theme.accent} />
          </p>
        </div>
      </div>

      <div className="grid border-b sm:grid-cols-2">
        <div className="border-b sm:border-b-0 sm:border-r">
          <SectionHeader icon={Building2} title="Invoice From" accent={theme.accent} />
          <div className="space-y-0.5 p-2.5 leading-snug">
            <p><span className="font-semibold">Name:</span> {data.brandFull}</p>
            {data.companyAddress && (
              <p><span className="font-semibold">Address:</span> {data.companyAddress}</p>
            )}
            {data.companyPhone && (
              <p>
                <span className="font-semibold">Phone Number:</span>{" "}
                <InvoiceAmount>{data.companyPhone}</InvoiceAmount>
              </p>
            )}
            {data.companyEmail && (
              <p><span className="font-semibold">Email:</span> {data.companyEmail}</p>
            )}
            {data.isGst && data.brandGst && (
              <p>
                <span className="font-semibold">GST No:</span>{" "}
                <InvoiceAmount>{data.brandGst}</InvoiceAmount>
              </p>
            )}
            {data.website && (
              <p><span className="font-semibold">Website:</span> {data.website}</p>
            )}
          </div>
        </div>
        <div>
          <SectionHeader icon={User} title="Invoice To" accent={theme.accent} />
          <div className="space-y-0.5 p-2.5 leading-snug">
            <p><span className="font-semibold">Name:</span> {data.customerName}</p>
            {data.customerContact && <p><span className="font-semibold">Contact Person:</span> {data.customerContact}</p>}
            <p><span className="font-semibold">Phone Number:</span> <InvoiceAmount>{data.customerPhone}</InvoiceAmount></p>
            {data.customerEmail && <p><span className="font-semibold">Email:</span> {data.customerEmail}</p>}
            {data.customerCity && <p><span className="font-semibold">City:</span> {data.customerCity}</p>}
            {data.customerAddress && <p><span className="font-semibold">Address:</span> {data.customerAddress}</p>}
            {data.isGst && data.customerGst && (
              <p><span className="font-semibold">GST No:</span> <InvoiceAmount>{data.customerGst}</InvoiceAmount></p>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] table-fixed border-collapse text-xs">
          <colgroup>
            <col className="w-[5%]" />
            <col className={data.isGst ? "w-[28%]" : "w-[36%]"} />
            {data.isGst ? <col className="w-[12%]" /> : null}
            <col className="w-[12%]" />
            <col className="w-[8%]" />
            <col className="w-[12%]" />
            {data.isGst && data.gstTypeStore === "igst" ? <col className="w-[11%]" /> : null}
            {data.isGst && data.gstTypeStore === "sgst_cgst" ? (
              <>
                <col className="w-[8%]" />
                <col className="w-[8%]" />
              </>
            ) : null}
            <col className="w-[14%]" />
          </colgroup>
          <thead>
            <tr className="text-white" style={{ backgroundColor: theme.accent }}>
              {(data.isGst ? gstHeaders : nonGstHeaders).map((h) => (
                <th
                  key={h}
                  className={cn(
                    "border border-white/20 px-2 py-1.5 text-left text-xs font-semibold",
                    h === "Product Name" && "min-w-[10rem]",
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.lineItems.map((row, i) => (
              <tr key={i} className="border-b">
                <td className="border px-2 py-1.5 align-top"><InvoiceAmount>{i + 1}</InvoiceAmount></td>
                <td className="border px-2 py-1.5 align-top break-words">
                  <p className="font-medium">{row.name || "—"}</p>
                  {row.desc && <p className="text-[10px] text-gray-500">{row.desc}</p>}
                </td>
                {data.isGst && (
                  <td className="border px-2 py-1.5 align-top"><InvoiceAmount>{row.hsn}</InvoiceAmount></td>
                )}
                <td className="border px-2 py-1.5 align-top whitespace-nowrap">
                  <InvoiceAmount>{formatInvoiceMoney(row.cost, data.currency)}</InvoiceAmount>
                </td>
                <td className="border px-2 py-1.5 align-top">
                  <InvoiceAmount>{row.qty}</InvoiceAmount>
                </td>
                <td className="border px-2 py-1.5 align-top whitespace-nowrap">
                  <InvoiceAmount>{formatInvoiceMoney(row.discount, data.currency)}</InvoiceAmount>
                </td>
                {data.isGst && data.gstTypeStore === "igst" && (
                  <td className="border px-2 py-1.5 align-top whitespace-nowrap">
                    <InvoiceAmount>{formatInvoiceMoney(row.igstTax, data.currency)}</InvoiceAmount>
                  </td>
                )}
                {data.isGst && data.gstTypeStore === "sgst_cgst" && (
                  <>
                    <td className="border px-2 py-1.5 align-top whitespace-nowrap">
                      <InvoiceAmount>{formatInvoiceMoney(row.sgstTax, data.currency)}</InvoiceAmount>
                    </td>
                    <td className="border px-2 py-1.5 align-top whitespace-nowrap">
                      <InvoiceAmount>{formatInvoiceMoney(row.cgstTax, data.currency)}</InvoiceAmount>
                    </td>
                  </>
                )}
                <td className="border px-2 py-1.5 align-top whitespace-nowrap">
                  <InvoiceAmount className="text-sm">{formatInvoiceMoney(row.lineTotal, data.currency)}</InvoiceAmount>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-0 border-b text-xs md:grid-cols-2">
        <div className="border-b p-3 sm:border-b-0 sm:border-r md:p-4">
          <SectionHeader icon={FileText} title="Payments Details" accent={theme.accent} />
          <div className="mt-2 flex flex-wrap items-start gap-4 leading-snug">
            <div className="min-w-0 flex-1 space-y-0.5">
              <p><span className="font-semibold">Bank Name:</span> {data.bankName || "—"}</p>
              <p>
                <span className="font-semibold">Account No:</span>{" "}
                <InvoiceAmount>{data.accountNo || "—"}</InvoiceAmount>
              </p>
              <p>
                <span className="font-semibold">IFSC Code:</span>{" "}
                <InvoiceAmount>{data.ifsc || "—"}</InvoiceAmount>
              </p>
              {data.upi && (
                <p>
                  <span className="font-semibold">UPI ID:</span>{" "}
                  <InvoiceAmount>{data.upi}</InvoiceAmount>
                </p>
              )}
              {data.companyEmail && (
                <p>
                  <span className="font-semibold">Email:</span>{" "}
                  {data.companyEmail}
                </p>
              )}
            </div>
            <UpiPaymentQrCode
              upiId={data.upi}
              payeeName={data.brandFull}
              amount={data.grandTotal}
              currency={data.currency}
              invoiceNo={data.invoiceNo}
            />
          </div>
        </div>
        <div className="p-3 md:p-4">
          <div className="space-y-0 border border-gray-200 leading-snug">
            <div className="flex justify-between border-b px-2 py-1.5">
              <span>Sub Total</span>
              <InvoiceAmount>{formatInvoiceMoney(data.subTotal, data.currency)}</InvoiceAmount>
            </div>
            <div className="flex justify-between border-b px-2 py-1.5">
              <span>Discount</span>
              <InvoiceAmount>{formatInvoiceMoney(data.discount, data.currency)}</InvoiceAmount>
            </div>
            {data.isGst && data.gstTypeStore === "igst" && (
              <div className="flex justify-between border-b px-2 py-1.5">
                <span>IGST</span>
                <InvoiceAmount>{formatInvoiceMoney(data.igstTotal, data.currency)}</InvoiceAmount>
              </div>
            )}
            {data.isGst && data.gstTypeStore === "sgst_cgst" && (
              <>
                <div className="flex justify-between border-b px-2 py-1.5">
                  <span>SGST</span>
                  <InvoiceAmount>{formatInvoiceMoney(data.sgstTotal, data.currency)}</InvoiceAmount>
                </div>
                <div className="flex justify-between border-b px-2 py-1.5">
                  <span>CGST</span>
                  <InvoiceAmount>{formatInvoiceMoney(data.cgstTotal, data.currency)}</InvoiceAmount>
                </div>
              </>
            )}
            <div className="flex justify-between px-2 py-2 text-sm font-bold text-white" style={{ backgroundColor: theme.accent }}>
              <span>Total</span>
              <span className="tabular-nums">{formatInvoiceMoney(data.grandTotal, data.currency)}</span>
            </div>
            <div className="flex justify-between border-t border-emerald-200 bg-emerald-50 px-2 py-1.5">
              <span className="font-semibold text-emerald-800">Amount Paid</span>
              <InvoiceAmount className="text-emerald-800">
                {formatInvoiceMoney(data.amountPaid, data.currency)}
              </InvoiceAmount>
            </div>
            <div className="flex justify-between border-t border-red-200 bg-red-50 px-2 py-1.5">
              <span className="font-semibold text-red-800">Amount Pending</span>
              <InvoiceAmount className="text-red-800">
                {formatInvoiceMoney(data.amountPending, data.currency)}
              </InvoiceAmount>
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 py-2 text-center text-xs font-semibold text-white" style={{ backgroundColor: theme.accent }}>
        IN WORDS : <span className="tabular-nums">{amountInWords(data.grandTotal)}</span>
      </div>

      <div className="grid gap-2 border-b p-2.5 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-sm font-bold" style={{ color: theme.accent }}>Terms &amp; Conditions</p>
          <p className="text-xs leading-snug text-gray-600">{data.terms}</p>
          {data.website && <p className="mt-1 text-xs text-blue-600 underline">{data.website}</p>}
        </div>
        <div className="flex flex-col items-end">
          {data.signatureUrl ? (
            <img
              src={data.signatureUrl}
              alt="Authorized signature"
              style={signatureImageStyle(Math.min(data.signatureSizePx, 48))}
            />
          ) : (
            <div className="h-8 w-28 border-b border-dashed border-gray-400" />
          )}
          <p className="mt-1 text-xs font-semibold text-gray-600">Authorized Signature</p>
        </div>
      </div>

      <div className="space-y-2 p-2.5 text-center">
        <p className="text-sm font-bold tracking-wide" style={{ color: theme.accent }}>Thank You Please Visit Again</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          <div className="flex items-center justify-center gap-1.5 rounded-lg py-2 text-[10px] font-semibold text-white" style={{ background: `linear-gradient(135deg, ${theme.accent} 0%, #312e81 100%)` }}>
            <Instagram className="h-3.5 w-3.5" /> FOLLOW US ON INSTAGRAM
          </div>
          <a
            href={INVOICE_LOCATE_US_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-invoice-pdf-link={INVOICE_LOCATE_US_URL}
            className="flex flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-2 text-[10px] font-semibold text-white no-underline hover:opacity-95"
            style={{ background: `linear-gradient(135deg, ${theme.accent} 0%, #1e3a5f 100%)` }}
          >
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              LOCATE US
            </span>
            <span className="text-[9px] font-normal leading-tight underline decoration-white/70">
              {INVOICE_LOCATE_US_TEXT}
            </span>
          </a>
        </div>
        {data.website && <p className="text-[9px] text-gray-500">{data.website}</p>}
        <div className="flex items-center justify-center gap-2 text-gray-500">
          <Facebook className="h-3.5 w-3.5" />
          <Instagram className="h-3.5 w-3.5" />
          <MessageCircle className="h-3.5 w-3.5" />
        </div>
      </div>
    </div>
  );
}
