import * as React from "react"

import { cn } from "@/lib/utils"
import { useTableMobileLabels } from "@/components/ui/use-table-mobile-labels"

export interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  /** Stack rows as labeled cards on small screens (default true). */
  responsive?: boolean
  /** Keep horizontal scroll on mobile instead of stacking. */
  scrollOnMobile?: boolean
}

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, responsive = true, scrollOnMobile = false, ...props }, ref) => {
    const wrapperRef = React.useRef<HTMLDivElement>(null)
    const stackOnMobile = responsive && !scrollOnMobile
    useTableMobileLabels(wrapperRef, stackOnMobile)

    return (
      <div
        ref={wrapperRef}
        className={cn(
          "rh-table-root relative min-w-0 w-full",
          scrollOnMobile
            ? "rh-table-scroll-mode overflow-auto"
            : stackOnMobile
              ? "overflow-visible md:overflow-auto"
              : "overflow-auto",
        )}
      >
        <table
          ref={ref}
          className={cn(
            "rh-data-table w-full caption-bottom text-sm",
            scrollOnMobile && "rh-table-scroll",
            className,
          )}
          {...props}
        />
      </div>
    )
  },
)
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
      className
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "p-4 align-middle [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
