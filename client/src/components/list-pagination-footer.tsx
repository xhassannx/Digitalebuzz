import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CUSTOM_PAGE_SIZE_VALUE = "__custom__";

type ListPaginationFooterProps = {
  total: number;
  currentPage: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rows: number) => void;
  rowsPerPageOptions?: number[];
  allowCustomPageSize?: boolean;
  minCustomPageSize?: number;
  maxCustomPageSize?: number;
  className?: string;
};

export function ListPaginationFooter({
  total,
  currentPage,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  rowsPerPageOptions = [10, 25, 50, 100],
  allowCustomPageSize = false,
  minCustomPageSize = 1,
  maxCustomPageSize = 200,
  className,
}: ListPaginationFooterProps) {
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [customInput, setCustomInput] = useState(String(rowsPerPage));

  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));
  const isPresetPageSize = rowsPerPageOptions.includes(rowsPerPage);
  const selectValue = isPresetPageSize ? String(rowsPerPage) : CUSTOM_PAGE_SIZE_VALUE;

  if (total <= rowsPerPageOptions[0] && totalPages <= 1) return null;

  const from = total === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const to = Math.min(currentPage * rowsPerPage, total);

  const applyCustomPageSize = () => {
    const parsed = Number.parseInt(customInput.trim(), 10);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.min(maxCustomPageSize, Math.max(minCustomPageSize, parsed));
    onRowsPerPageChange(clamped);
    onPageChange(1);
    setCustomDialogOpen(false);
  };

  return (
    <>
      <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className ?? ""}`}>
        <p className="text-sm text-muted-foreground">
          Showing {from} to {to} of {total} entries
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={selectValue}
            onValueChange={(value) => {
              if (value === CUSTOM_PAGE_SIZE_VALUE) {
                setCustomInput(String(rowsPerPage));
                setCustomDialogOpen(true);
                return;
              }
              onRowsPerPageChange(Number(value));
              onPageChange(1);
            }}
          >
            <SelectTrigger className="h-8 w-[120px]">
              <SelectValue>
                {rowsPerPage} / page
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {rowsPerPageOptions.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} / page
                </SelectItem>
              ))}
              {allowCustomPageSize && (
                <SelectItem value={CUSTOM_PAGE_SIZE_VALUE}>
                  {isPresetPageSize ? "Custom..." : `Custom (${rowsPerPage})`}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => onPageChange(1)}>
            First
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground px-1">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
          >
            Next
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(totalPages)}
          >
            Last
          </Button>
        </div>
      </div>

      {allowCustomPageSize && (
        <Dialog open={customDialogOpen} onOpenChange={setCustomDialogOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Custom page size</DialogTitle>
              <DialogDescription>
                Enter how many contacts to show per page (max {maxCustomPageSize}).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label htmlFor="custom-page-size">Rows per page</Label>
              <Input
                id="custom-page-size"
                type="number"
                min={minCustomPageSize}
                max={maxCustomPageSize}
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyCustomPageSize();
                  }
                }}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCustomDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={applyCustomPageSize}>Apply</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
