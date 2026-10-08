import { Fragment, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  Filter,
  Loader2,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Send,
  Trash2,
  Upload,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { fetchLegacyListApi } from "@/lib/legacy-list-api";
import { useListPaginationState, parsePaginatedListResponse, useDebouncedValue } from "@/lib/list-pagination";
import { ListPaginationFooter } from "@/components/list-pagination-footer";
import {
  ContactCreateInvoiceDialog,
  type ContactForInvoice,
} from "@/components/contact-create-invoice-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useRatehonkPageSkin } from "@/panel-templates/ratehonk-v1/RatehonkSkinContext";
import { RhButton, RhCard, RhSearchField } from "@/panel-templates/ratehonk-v1/components/rh";
import { invoicePaymentStatusLabel } from "@shared/invoice";
import { cn } from "@/lib/utils";

export type OrganizationInvoiceRow = {
  id: string;
  organizationId: string;
  contactId?: string | null;
  invoiceNo: string;
  companyName?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  invoiceDate: string;
  gstType?: string | null;
  invoiceStatus?: string | null;
  currency?: string | null;
  totalAmount?: number | null;
  amountPaid?: number | null;
  amountPending?: number | null;
  pdfUrl?: string | null;
  lineItems?: unknown;
  invoiceTo?: unknown;
  isLocked?: boolean;
  createdByName?: string | null;
  createdAt: string;
};

const STATUS_OPTIONS = [
  { value: "all", label: "ALL" },
  { value: "due", label: "Due" },
  { value: "half_paid", label: "Half Paid" },
  { value: "paid", label: "Paid" },
] as const;

function gstTypeLabel(gstType?: string | null) {
  if (!gstType || gstType === "non_gst") return "Non GST";
  if (gstType === "sgst_cgst") return "SGST/CGST";
  return "GST";
}

function formatInvoiceDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "dd-MM-yyyy");
}

function rowStatusClass(status?: string | null) {
  if (status === "paid") return "bg-emerald-50/80 hover:bg-emerald-50";
  if (status === "half_paid") return "bg-amber-50/60 hover:bg-amber-50/80";
  return "";
}

export type InvoiceListPageProps = {
  /** Recurring payment view: outstanding invoices with Due Amount column. */
  mode?: "list" | "recurring";
};

export default function InvoiceListPage({ mode = "list" }: InvoiceListPageProps) {
  const isRecurring = mode === "recurring";
  const skin = useRatehonkPageSkin();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editInvoiceId, setEditInvoiceId] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search);
  const {
    currentPage,
    setCurrentPage,
    rowsPerPage,
    setRowsPerPage,
    resetPage,
    paginationParams,
  } = useListPaginationState(10);

  const queryKey = [
    "/api/invoices",
    isRecurring ? "recurring" : "list",
    debouncedSearch,
    status,
    dateFrom,
    dateTo,
    currentPage,
    rowsPerPage,
  ] as const;

  const { data: listResponse, isLoading, refetch, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams(paginationParams.toString());
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (status !== "all") params.set("status", status);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (isRecurring) params.set("pendingOnly", "true");
      const res = await apiRequest("GET", `/api/invoices?${params.toString()}`);
      return res.json();
    },
  });

  const { data: summary } = useQuery({
    queryKey: ["/api/invoices/summary", isRecurring ? "recurring" : "list", debouncedSearch, status, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (status !== "all") params.set("status", status);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (isRecurring) params.set("pendingOnly", "true");
      const res = await apiRequest("GET", `/api/invoices/summary?${params.toString()}`);
      return res.json();
    },
  });

  const { data: contacts = [] } = useQuery<ContactForInvoice[]>({
    queryKey: ["/api/contacts", "invoice-picker"],
    queryFn: () => fetchLegacyListApi<ContactForInvoice>("/api/contacts", "contacts"),
    enabled: createDialogOpen || !!editInvoiceId,
  });

  const { data: organizationsData } = useQuery({
    queryKey: ["/api/organizations"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/organizations");
      return res.json();
    },
    enabled: createDialogOpen || !!editInvoiceId,
  });

  const organizationsList = Array.isArray(organizationsData)
    ? organizationsData
    : organizationsData?.organizations ?? [];

  const { items: rows, total } = parsePaginatedListResponse<OrganizationInvoiceRow>(
    listResponse,
    "invoices",
  );

  useEffect(() => {
    resetPage();
  }, [debouncedSearch, status, dateFrom, dateTo, resetPage]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/invoices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices/summary"] });
      setDeleteId(null);
      toast({ title: "Deleted", description: "Invoice removed from list." });
    },
    onError: (e: Error) => {
      toast({ variant: "destructive", title: "Error", description: e.message });
    },
  });

  const resendMutation = useMutation({
    mutationFn: async ({ id, channel }: { id: string; channel: "email" | "whatsapp" }) => {
      const res = await apiRequest("POST", `/api/invoices/${id}/resend`, { channel });
      return res.json();
    },
    onSuccess: (_data, vars) => {
      toast({
        title: "Sent",
        description:
          vars.channel === "email"
            ? "Invoice emailed to customer again."
            : "Invoice sent on WhatsApp again.",
      });
    },
    onError: (e: Error) => {
      toast({ variant: "destructive", title: "Send failed", description: e.message });
    },
  });

  const toggleSelectAll = () => {
    if (selectedIds.size === rows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.map((r) => r.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportCsv = () => {
    const header = [
      "Invoice No",
      "Company",
      "Customer",
      "Mobile",
      "Date",
      "GST Type",
      "Status",
      "Total",
      "Paid",
      "Pending",
      "Created By",
    ];
    const lines = rows.map((r) =>
      [
        r.invoiceNo,
        r.companyName || "",
        r.customerName || "",
        r.customerPhone || "",
        formatInvoiceDate(r.invoiceDate),
        gstTypeLabel(r.gstType),
        invoicePaymentStatusLabel((r.invoiceStatus as "due") || "due"),
        r.totalAmount ?? "",
        r.amountPaid ?? "",
        r.amountPending ?? "",
        r.createdByName || "",
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${isRecurring ? "recurring-payments" : "invoices"}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const primaryBtn = skin ? "bg-[#0059bb] hover:bg-[#004a9a] text-white" : "";
  const inputClass = skin ? "h-11 rounded-xl border-[#e5e7eb]" : "";

  const pageShell = cn(
    "mx-auto w-full space-y-6 rh-page-gutter",
    skin
      ? "px-6 py-5 sm:px-10 sm:py-6 md:px-14 lg:px-16"
      : "container max-w-[92%] px-6 sm:px-10 py-8",
  );

  const tableHeaderClass = skin
    ? "bg-[var(--rh-brand-soft,#ecfdf5)] text-[#414754] text-sm font-semibold"
    : "bg-primary text-primary-foreground";

  return (
    <div className={pageShell}>
      <div className={cn("rh-page-hero invoice-list-page-chrome flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between")}>
        <div>
          <h1 className={cn("text-2xl font-bold flex items-center gap-2", skin && "text-[30px] font-semibold text-[#111c2d]")}>
            {isRecurring ? <RefreshCw className="h-7 w-7 text-primary" /> : <Receipt className="h-7 w-7 text-primary" />}
            {isRecurring ? "Recurring payment" : "Invoice"}
          </h1>
          <p className={cn("text-sm text-muted-foreground mt-1", skin && "text-[#717786]")}>
            {isRecurring
              ? "Invoices with outstanding due amounts"
              : "Sent invoices for your organization"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className={skin ? "rounded-xl border-[#e5e7eb]" : ""}>
                Reports <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Invoice summary</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>Total: {summary?.total ?? 0}</DropdownMenuItem>
              <DropdownMenuItem disabled>Paid: {summary?.paid ?? 0}</DropdownMenuItem>
              <DropdownMenuItem disabled>Due: {summary?.due ?? 0}</DropdownMenuItem>
              <DropdownMenuItem disabled>Half paid: {summary?.halfPaid ?? 0}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>
                Pending amount: ₹{(summary?.pendingAmount ?? 0).toLocaleString("en-IN")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="icon" className={skin ? "rounded-xl" : ""} onClick={exportCsv} title="Download CSV">
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className={skin ? "rounded-xl" : ""} onClick={() => refetch()} title="Refresh">
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </Button>
          <Button variant="outline" size="icon" className={skin ? "rounded-xl" : ""} title="Import (coming soon)" disabled>
            <Upload className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {skin ? (
        <RhCard className="space-y-4 p-4 sm:p-5">
          <ToolbarContent
            skin={!!skin}
            search={search}
            setSearch={setSearch}
            dateFrom={dateFrom}
            setDateFrom={setDateFrom}
            dateTo={dateTo}
            setDateTo={setDateTo}
            status={status}
            setStatus={setStatus}
            primaryBtn={primaryBtn}
            inputClass={inputClass}
            onCreateInvoice={() => setCreateDialogOpen(true)}
          />
          <InvoiceTable
            skin={!!skin}
            showDueAmount={isRecurring}
            rows={rows}
            isLoading={isLoading}
            expandedId={expandedId}
            setExpandedId={setExpandedId}
            selectedIds={selectedIds}
            toggleSelect={toggleSelect}
            toggleSelectAll={toggleSelectAll}
            tableHeaderClass={tableHeaderClass}
            onView={(row) => row.pdfUrl && window.open(row.pdfUrl, "_blank")}
            onEdit={(row) => setEditInvoiceId(row.id)}
            onResend={(row, channel) => resendMutation.mutate({ id: row.id, channel })}
            onDelete={setDeleteId}
            resendPending={resendMutation.isPending}
          />
          <ListPaginationFooter
            total={total}
            currentPage={currentPage}
            rowsPerPage={rowsPerPage}
            onPageChange={setCurrentPage}
            onRowsPerPageChange={setRowsPerPage}
          />
        </RhCard>
      ) : (
        <div className="rounded-lg border bg-card shadow-sm space-y-4 p-4">
          <ToolbarContent
            skin={false}
            search={search}
            setSearch={setSearch}
            dateFrom={dateFrom}
            setDateFrom={setDateFrom}
            dateTo={dateTo}
            setDateTo={setDateTo}
            status={status}
            setStatus={setStatus}
            primaryBtn={primaryBtn}
            inputClass={inputClass}
            onCreateInvoice={() => setCreateDialogOpen(true)}
          />
          <InvoiceTable
            skin={false}
            showDueAmount={isRecurring}
            rows={rows}
            isLoading={isLoading}
            expandedId={expandedId}
            setExpandedId={setExpandedId}
            selectedIds={selectedIds}
            toggleSelect={toggleSelect}
            toggleSelectAll={toggleSelectAll}
            tableHeaderClass={tableHeaderClass}
            onView={(row) => row.pdfUrl && window.open(row.pdfUrl, "_blank")}
            onEdit={(row) => setEditInvoiceId(row.id)}
            onResend={(row, channel) => resendMutation.mutate({ id: row.id, channel })}
            onDelete={setDeleteId}
            resendPending={resendMutation.isPending}
          />
          <ListPaginationFooter
            total={total}
            currentPage={currentPage}
            rowsPerPage={rowsPerPage}
            onPageChange={setCurrentPage}
            onRowsPerPageChange={setRowsPerPage}
          />
        </div>
      )}

      <ContactCreateInvoiceDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        contact={null}
        contactOptions={contacts}
        organization={organizationsList[0] ?? null}
        onInvoiceCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
          queryClient.invalidateQueries({ queryKey: ["/api/invoices/summary"] });
        }}
      />

      <ContactCreateInvoiceDialog
        open={!!editInvoiceId}
        onOpenChange={(open) => !open && setEditInvoiceId(null)}
        contact={null}
        organization={organizationsList[0] ?? null}
        editInvoiceId={editInvoiceId}
        onInvoiceUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
          queryClient.invalidateQueries({ queryKey: ["/api/invoices/summary"] });
        }}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the invoice record from your list. The PDF file may remain on the server.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ToolbarContent({
  skin,
  search,
  setSearch,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  status,
  setStatus,
  primaryBtn,
  inputClass,
  onCreateInvoice,
}: {
  skin: boolean;
  search: string;
  setSearch: (v: string) => void;
  dateFrom: string;
  setDateFrom: (v: string) => void;
  dateTo: string;
  setDateTo: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  primaryBtn: string;
  inputClass: string;
  onCreateInvoice: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {skin ? (
          <RhButton type="button" onClick={onCreateInvoice}>
            <Plus className="h-4 w-4" />
            Create Invoice
          </RhButton>
        ) : (
          <Button type="button" className={primaryBtn} onClick={onCreateInvoice}>
            <Plus className="h-4 w-4 mr-2" />
            Create Invoice
          </Button>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {skin ? (
            <RhSearchField
              className="w-full sm:w-64"
              value={search}
              onChange={setSearch}
              placeholder="Search invoices…"
            />
          ) : (
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className={cn("pl-9", inputClass)}
                placeholder="Search invoices…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={cn("w-[9.5rem]", inputClass)} />
            <span className="text-muted-foreground">To</span>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={cn("w-[9.5rem]", inputClass)} />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className={cn("w-[8.5rem]", inputClass)}>
              <Filter className="h-3.5 w-3.5 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function InvoiceTable({
  skin,
  showDueAmount = false,
  rows,
  isLoading,
  expandedId,
  setExpandedId,
  selectedIds,
  toggleSelect,
  toggleSelectAll,
  tableHeaderClass,
  onView,
  onEdit,
  onResend,
  onDelete,
  resendPending,
}: {
  skin: boolean;
  showDueAmount?: boolean;
  rows: OrganizationInvoiceRow[];
  isLoading: boolean;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  toggleSelectAll: () => void;
  tableHeaderClass: string;
  onView: (row: OrganizationInvoiceRow) => void;
  onEdit: (row: OrganizationInvoiceRow) => void;
  onResend: (row: OrganizationInvoiceRow, channel: "email" | "whatsapp") => void;
  onDelete: (id: string) => void;
  resendPending: boolean;
}) {
  const allSelected = rows.length > 0 && selectedIds.size === rows.length;
  const colSpan = showDueAmount ? 14 : 11;

  if (isLoading) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        {showDueAmount
          ? "No invoices with due amounts found."
          : "No invoices found. Create an invoice from Contacts to see it here."}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[#e5e7eb]">
      <table className={cn("w-full border-collapse text-sm", showDueAmount ? "min-w-[1280px]" : "min-w-[1100px]")}>
        <thead>
          <tr className={tableHeaderClass}>
            <th className="w-10 p-3">
              <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} aria-label="Select all" />
            </th>
            <th className="w-8 p-3" />
            <th className="p-3 text-left w-12">No.</th>
            <th className="p-3 text-left">Actions</th>
            <th className="p-3 text-left">Invoice No.</th>
            <th className="p-3 text-left">Company Name</th>
            <th className="p-3 text-left">Customer Name</th>
            <th className="p-3 text-left">Mobile</th>
            <th className="p-3 text-left">Date</th>
            <th className="p-3 text-left">GST Type</th>
            {showDueAmount && (
              <>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-right">Due Amount</th>
                <th className="p-3 text-left">Status</th>
              </>
            )}
            <th className="p-3 text-left">Created By</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const expanded = expandedId === row.id;
            const serial = index + 1;
            const dueAmount = Number(row.amountPending) || 0;
            return (
              <Fragment key={row.id}>
                <tr className={cn("border-t", rowStatusClass(row.invoiceStatus))}>
                  <td className="p-3">
                    <Checkbox
                      checked={selectedIds.has(row.id)}
                      onCheckedChange={() => toggleSelect(row.id)}
                      aria-label={`Select ${row.invoiceNo}`}
                    />
                  </td>
                  <td className="p-3">
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => setExpandedId(expanded ? null : row.id)}
                      aria-label="Expand row"
                    >
                      {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  </td>
                  <td className="p-3 tabular-nums">{serial}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap items-center gap-1">
                      <ActionIcon title="Preview" onClick={() => onView(row)} disabled={!row.pdfUrl}>
                        <Eye className="h-4 w-4 text-sky-600" />
                      </ActionIcon>
                      <ActionIcon
                        title="Edit"
                        onClick={() => onEdit(row)}
                        disabled={row.isLocked}
                      >
                        <Pencil className="h-4 w-4 text-emerald-700" />
                      </ActionIcon>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            title="Send again"
                            disabled={
                              resendPending ||
                              !row.pdfUrl ||
                              (!row.customerEmail && !row.customerPhone)
                            }
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent hover:bg-muted disabled:opacity-40 disabled:pointer-events-none"
                          >
                            <Send className="h-4 w-4 text-violet-600" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuLabel>Send invoice again</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            disabled={!row.customerEmail || resendPending}
                            onClick={() => onResend(row, "email")}
                          >
                            <Mail className="mr-2 h-4 w-4" />
                            Email to customer
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={!row.customerPhone || resendPending}
                            onClick={() => onResend(row, "whatsapp")}
                          >
                            <MessageCircle className="mr-2 h-4 w-4" />
                            WhatsApp to customer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <ActionIcon title="Delete" onClick={() => onDelete(row.id)} disabled={row.isLocked}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </ActionIcon>
                    </div>
                  </td>
                  <td className="p-3 font-medium">{row.invoiceNo}</td>
                  <td className="p-3 max-w-[140px] truncate" title={row.companyName || ""}>
                    {row.companyName || "—"}
                  </td>
                  <td className="p-3">{row.customerName || "—"}</td>
                  <td className="p-3 tabular-nums">{row.customerPhone || "—"}</td>
                  <td className="p-3 whitespace-nowrap">{formatInvoiceDate(row.invoiceDate)}</td>
                  <td className="p-3">{gstTypeLabel(row.gstType)}</td>
                  {showDueAmount && (
                    <>
                      <td className="p-3 text-right tabular-nums whitespace-nowrap">
                        {(row.totalAmount ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right tabular-nums whitespace-nowrap font-semibold text-amber-700">
                        {dueAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {invoicePaymentStatusLabel((row.invoiceStatus as "due") || "due")}
                      </td>
                    </>
                  )}
                  <td className="p-3">{row.createdByName || "—"}</td>
                </tr>
                {expanded && (
                  <tr className="border-t bg-muted/30">
                    <td colSpan={colSpan} className="p-4 text-sm">
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        <p>
                          <span className="font-medium">Status:</span>{" "}
                          {invoicePaymentStatusLabel((row.invoiceStatus as "due") || "due")}
                        </p>
                        <p>
                          <span className="font-medium">Total:</span> {row.currency || "INR"}{" "}
                          {(row.totalAmount ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </p>
                        <p>
                          <span className="font-medium">Paid:</span> {(row.amountPaid ?? 0).toFixed(2)}
                        </p>
                        <p>
                          <span className="font-medium">Due Amount:</span>{" "}
                          <span className="font-semibold text-amber-700">{dueAmount.toFixed(2)}</span>
                        </p>
                        {row.customerEmail && (
                          <p>
                            <span className="font-medium">Email:</span> {row.customerEmail}
                          </p>
                        )}
                        {row.pdfUrl && (
                          <p className="sm:col-span-2">
                            <span className="font-medium">PDF:</span>{" "}
                            <a href={row.pdfUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                              Open invoice PDF
                            </a>
                          </p>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ActionIcon({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent hover:bg-muted disabled:opacity-40 disabled:pointer-events-none"
    >
      {children}
    </button>
  );
}
