import { useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OrganizationLeadRow } from "@/pages/leads-page";
import type { OrganizationLeadStatusRow } from "./lead-utils";

type ChangeLeadStatusModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: OrganizationLeadRow | null;
  statuses: OrganizationLeadStatusRow[];
  onSelectStatus: (statusSlug: string) => Promise<void>;
};

function contrastTextColor(hex: string): string {
  const raw = hex.replace("#", "").trim();
  if (raw.length !== 6) return "#ffffff";
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return "#ffffff";
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.58 ? "#111c2d" : "#ffffff";
}

export function ChangeLeadStatusModal({
  open,
  onOpenChange,
  lead,
  statuses,
  onSelectStatus,
}: ChangeLeadStatusModalProps) {
  const [submittingSlug, setSubmittingSlug] = useState<string | null>(null);
  const currentSlug = lead?.status ?? "";

  const handleSelect = async (slug: string) => {
    if (!lead || submittingSlug) return;
    if (slug === currentSlug) {
      onOpenChange(false);
      return;
    }
    const valid = statuses.some((s) => s.slug === slug);
    if (!valid) return;

    setSubmittingSlug(slug);
    try {
      await onSelectStatus(slug);
      onOpenChange(false);
    } catch {
      // Parent handles error toast
    } finally {
      setSubmittingSlug(null);
    }
  };

  const leadLabel = lead?.name?.trim() || lead?.phoneNumber || "Lead";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submittingSlug) onOpenChange(next);
      }}
    >
      <DialogContent
        className="max-w-md gap-0 overflow-hidden p-0 sm:max-w-lg [&>button.absolute]:hidden"
        aria-describedby="change-lead-status-desc"
      >
        <div className="flex items-center justify-between border-b border-[#e5e7eb] bg-white px-4 py-3 sm:px-5">
          <DialogTitle className="text-base font-semibold text-[#111c2d] sm:text-lg">
            Change Lead Status
          </DialogTitle>
          <button
            type="button"
            className="rounded-md p-1 text-[#717786] transition hover:bg-[#f3f4f6] hover:text-[#111c2d] disabled:opacity-50"
            onClick={() => onOpenChange(false)}
            disabled={!!submittingSlug}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <DialogDescription id="change-lead-status-desc" className="sr-only">
          Choose a new status for {leadLabel}. The lead will move to the selected column.
        </DialogDescription>

        <div className="max-h-[min(70vh,520px)] overflow-y-auto overscroll-contain px-3 py-4 sm:px-4">
          <div className="flex flex-col gap-2">
            {statuses.map((status) => {
              const isCurrent = status.slug === currentSlug;
              const isLoading = submittingSlug === status.slug;
              const textColor = contrastTextColor(status.color);

              return (
                <button
                  key={status.id}
                  type="button"
                  disabled={!!submittingSlug}
                  onClick={() => handleSelect(status.slug)}
                  className={cn(
                    "relative flex w-full items-center justify-between rounded-md px-4 py-3 text-sm font-semibold transition",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4c1d95] focus-visible:ring-offset-2",
                    "disabled:cursor-not-allowed disabled:opacity-70",
                    isCurrent && "ring-2 ring-[#111c2d]/25 ring-offset-1",
                  )}
                  style={{
                    backgroundColor: status.color,
                    color: textColor,
                  }}
                >
                  <span className="truncate pr-8">{status.name}</span>
                  <span className="absolute right-3 flex h-5 w-5 items-center justify-center">
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" style={{ color: textColor }} />
                    ) : isCurrent ? (
                      <Check className="h-5 w-5" style={{ color: textColor }} aria-hidden />
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end border-t border-[#e5e7eb] bg-[#f8fafc] px-4 py-3 sm:px-5">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={!!submittingSlug}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
