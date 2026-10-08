import type { ReactNode } from "react";
import { FileText, Receipt, Send } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type ChatComposerShellProps = {
  notice?: string;
  noticeExtra?: ReactNode;
  onSendTemplate?: () => void;
  templateDisabled?: boolean;
  onSendInvoice?: () => void;
  invoiceDisabled?: boolean;
  children?: ReactNode;
};

/** Wraps inbox composer + optional Business API notice with WhatsApp-like mobile footer */
export function ChatComposerShell({
  notice,
  noticeExtra,
  onSendTemplate,
  templateDisabled,
  onSendInvoice,
  invoiceDisabled,
  children,
}: ChatComposerShellProps) {
  const isMobile = useIsMobile();
  const showBar = Boolean(notice || noticeExtra || onSendTemplate || onSendInvoice);

  if (isMobile) {
    return (
      <div className="chat-composer-shell shrink-0 border-t border-[#e9edef] bg-[#f0f2f5]">
        {showBar ? (
          <div className="flex items-center gap-2 px-2 pb-0.5 pt-2">
            {notice ? (
              <p className="min-w-0 flex-1 text-[11px] leading-snug text-[#667781]">{notice}</p>
            ) : (
              <span className="min-w-0 flex-1" />
            )}
            {noticeExtra}
            {onSendInvoice ? (
              <button
                type="button"
                disabled={invoiceDisabled}
                onClick={onSendInvoice}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#e9edef] bg-white text-[#008069] shadow-sm disabled:opacity-50"
                aria-label="Send invoice"
                title="Send invoice"
                data-testid="button-send-invoice-mobile"
              >
                <Receipt className="h-4 w-4" />
              </button>
            ) : null}
            {onSendTemplate ? (
              <button
                type="button"
                disabled={templateDisabled}
                onClick={onSendTemplate}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#e9edef] bg-white text-[#008069] shadow-sm disabled:opacity-50"
                aria-label="Send template"
                title="Send template"
                data-testid="button-send-template-mobile"
              >
                <FileText className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        ) : null}
        {children}
      </div>
    );
  }

  return (
    <div className="border-t bg-card">
      {showBar ? (
        <div className="flex items-center justify-between gap-3 px-4 pb-1 pt-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {notice ? <p className="text-xs text-[#667781]">{notice}</p> : null}
            {noticeExtra}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {onSendInvoice ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onSendInvoice}
                className="h-7 shrink-0 text-xs"
                disabled={invoiceDisabled}
                data-testid="button-send-invoice"
              >
                <Receipt className="mr-1.5 h-3 w-3" />
                Send invoice
              </Button>
            ) : null}
            {onSendTemplate ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onSendTemplate}
                className="h-7 shrink-0 text-xs"
                disabled={templateDisabled}
                data-testid="button-send-template"
              >
                <Send className="mr-1.5 h-3 w-3" />
                Send template
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      {children}
    </div>
  );
}
