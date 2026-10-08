import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  InvoiceDocumentView,
  INVOICE_TEMPLATE_THEME,
  buildSampleInvoiceData,
  type InvoicePreviewSettings,
} from "@/components/invoice/invoice-document";

type InvoiceTemplatePreviewModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: number;
  settings: InvoicePreviewSettings;
};

export function InvoiceTemplatePreviewModal({
  open,
  onOpenChange,
  templateId,
  settings,
}: InvoiceTemplatePreviewModalProps) {
  const data = useMemo(
    () => buildSampleInvoiceData(templateId, settings, true),
    [templateId, settings],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto p-0 gap-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Invoice Preview — {INVOICE_TEMPLATE_THEME.label}</DialogTitle>
        </DialogHeader>
        <div className="bg-gray-100 p-4 sm:p-6">
          <div className="mx-auto max-w-3xl">
            <InvoiceDocumentView data={data} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type { InvoicePreviewSettings };
