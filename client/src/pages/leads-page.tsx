import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useLocation } from "wouter";
import {
  ChevronDown,
  Download,
  LayoutGrid,
  List,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  UserPlus,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useListPaginationState, parsePaginatedListResponse, useDebouncedValue } from "@/lib/list-pagination";
import { ListPaginationFooter } from "@/components/list-pagination-footer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useCurrentMemberPermissions } from "@/hooks/useCurrentMemberPermissions";
import { useRatehonkPageSkin } from "@/panel-templates/ratehonk-v1/RatehonkSkinContext";
import { RhSearchField } from "@/panel-templates/ratehonk-v1/components/rh";
import { LeadsKanbanBoard } from "@/components/leads/leads-kanban-board";
import { AddLeadDialog } from "@/components/leads/add-lead-dialog";
import { statusColor, statusLabel, type OrganizationLeadStatusRow, resolveDefaultLeadStatus } from "@/components/leads/lead-utils";
import { leadSourceLabel } from "@shared/lead-sources";
import { cn } from "@/lib/utils";

export type OrganizationLeadRow = {
  id: string;
  organizationId: string;
  userId?: string | null;
  phoneNumber: string;
  name?: string | null;
  email?: string | null;
  source: string;
  category?: string | null;
  score: number;
  priority: string;
  status: string;
  sortOrder?: number;
  assignedToUserId?: string | null;
  contactId?: string | null;
  sessionId?: string | null;
  firstMessagePreview?: string | null;
  companyName?: string | null;
  leadDate?: string | null;
  label?: string | null;
  estimateAmount?: number | null;
  reference?: string | null;
  address?: string | null;
  comment?: string | null;
  leadFromPhone?: string | null;
  createdAt: string;
};

const PRIORITY_OPTIONS = [
  { value: "all", label: "All priority" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
] as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  return digits ? `+${digits}` : phone;
}

export default function LeadsPage() {
  const skin = useRatehonkPageSkin();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { hasPermission } = useCurrentMemberPermissions();
  const canEdit = hasPermission("manage_contacts.edit");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [viewMode, setViewMode] = useState<"board" | "list">("board");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [source, setSource] = useState("all");
  const [assignedTo, setAssignedTo] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<OrganizationLeadRow | null>(null);
  const [addLeadDefaultStatus, setAddLeadDefaultStatus] = useState<string | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());

  const debouncedSearch = useDebouncedValue(search);
  const {
    currentPage,
    setCurrentPage,
    rowsPerPage,
    setRowsPerPage,
    resetPage,
    paginationParams,
  } = useListPaginationState(25);

  const { data: sourceOptionsData } = useQuery({
    queryKey: ["/api/leads/sources"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/leads/sources");
      return res.json() as { sources: Array<{ value: string; label: string }> };
    },
  });

  const sourceFilterOptions = useMemo(
    () => [{ value: "all", label: "All sources" }, ...(sourceOptionsData?.sources ?? [])],
    [sourceOptionsData?.sources],
  );

  const { data: statusData } = useQuery({
    queryKey: ["/api/leads/statuses"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/leads/statuses");
      return res.json() as { statuses: OrganizationLeadStatusRow[] };
    },
  });
  const leadStatuses = statusData?.statuses ?? [];

  const statusFilterOptions = useMemo(
    () => [
      { value: "all", label: "All status" },
      ...leadStatuses.map((s) => ({ value: s.slug, label: s.name })),
    ],
    [leadStatuses],
  );

  const queryKey = [
    "/api/leads",
    viewMode,
    debouncedSearch,
    status,
    priority,
    source,
    assignedTo,
    dateFrom,
    dateTo,
    currentPage,
    rowsPerPage,
  ] as const;

  const { data: listResponse, isLoading, refetch, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams(
        viewMode === "board" ? "board=1&limit=500&offset=0" : paginationParams.toString(),
      );
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (status !== "all") params.set("status", status);
      if (priority !== "all") params.set("priority", priority);
      if (source !== "all") params.set("source", source);
      if (assignedTo !== "all") params.set("assignedTo", assignedTo);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const res = await apiRequest("GET", `/api/leads?${params.toString()}`);
      return res.json();
    },
  });

  let { items: rows, total } = parsePaginatedListResponse<OrganizationLeadRow>(listResponse, "leads");

  useEffect(() => {
    resetPage();
  }, [debouncedSearch, status, priority, source, assignedTo, dateFrom, dateTo, resetPage]);

  const openEditLead = (lead: OrganizationLeadRow) => {
    setEditingLead(lead);
    setAddOpen(true);
  };

  const openAddLead = (statusSlug?: string) => {
    setEditingLead(null);
    setAddLeadDefaultStatus(
      statusSlug ?? resolveDefaultLeadStatus(leadStatuses),
    );
    setAddOpen(true);
  };

  const patchMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/leads/${id}`, data);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Update failed");
      }
      return res.json();
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/leads"] });
      const snapshots = queryClient.getQueriesData({ queryKey: ["/api/leads"] });
      queryClient.setQueriesData({ queryKey: ["/api/leads"] }, (old: unknown) => {
        if (!old || typeof old !== "object") return old;
        const obj = old as { leads?: OrganizationLeadRow[] };
        if (!Array.isArray(obj.leads)) return old;
        return {
          ...obj,
          leads: obj.leads.map((lead) => (lead.id === id ? { ...lead, ...data } : lead)),
        };
      });
      return { snapshots };
    },
    onError: (e: Error, _vars, context) => {
      context?.snapshots?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      toast({ variant: "destructive", title: "Update failed", description: e.message });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
    },
  });

  const handleChangeLeadStatus = async (leadId: string, statusSlug: string) => {
    const valid = leadStatuses.some((s) => s.slug === statusSlug);
    if (!valid) {
      toast({
        variant: "destructive",
        title: "Invalid status",
        description: "The selected status is not available for this organization.",
      });
      throw new Error("Invalid status");
    }
    await patchMutation.mutateAsync({ id: leadId, data: { status: statusSlug } });
    toast({ title: "Lead status updated successfully." });
  };

  const reorderMutation = useMutation({
    mutationFn: async ({ status, orderedIds }: { status: string; orderedIds: string[] }) => {
      const res = await apiRequest("PATCH", "/api/leads/reorder", { status, orderedIds });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Reorder failed");
      }
      return res.json();
    },
    onMutate: async ({ status, orderedIds }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/leads"] });
      const snapshots = queryClient.getQueriesData({ queryKey: ["/api/leads"] });
      const orderMap = new Map(orderedIds.map((id, index) => [id, index]));
      queryClient.setQueriesData({ queryKey: ["/api/leads"] }, (old: unknown) => {
        if (!old || typeof old !== "object") return old;
        const obj = old as { leads?: OrganizationLeadRow[] };
        if (!Array.isArray(obj.leads)) return old;
        return {
          ...obj,
          leads: obj.leads.map((lead) => {
            const index = orderMap.get(lead.id);
            if (index == null) return lead;
            return { ...lead, status, sortOrder: index };
          }),
        };
      });
      return { snapshots };
    },
    onError: (e: Error, _vars, context) => {
      context?.snapshots?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      toast({ variant: "destructive", title: "Reorder failed", description: e.message });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/leads/${id}`);
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      setDeleteId(null);
      setSelectedLeads((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast({ title: "Lead deleted" });
    },
    onError: (e: Error) => {
      toast({ variant: "destructive", title: "Error", description: e.message });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (leadIds: string[]) => {
      return apiRequest("POST", "/api/leads/bulk/delete", { leadIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      setBulkDeleteDialogOpen(false);
      setSelectedLeads(new Set());
      toast({
        title: "Success",
        description: "Leads deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete leads",
        variant: "destructive",
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (leads: Record<string, string>[]) => {
      const res = await apiRequest("POST", "/api/leads/import", { leads });
      return res.json();
    },
    onSuccess: (data: { created: number; skipped: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({
        title: "Import complete",
        description: `${data.created} created, ${data.skipped} skipped.`,
      });
    },
    onError: (e: Error) => {
      toast({ variant: "destructive", title: "Import failed", description: e.message });
    },
  });

  const openWhatsApp = (lead: OrganizationLeadRow) => {
    if (lead.contactId) {
      setLocation(`/chat?contactId=${encodeURIComponent(lead.contactId)}`);
      return;
    }
    const digits = lead.phoneNumber.replace(/[^\d]/g, "");
    setLocation(`/chat?phone=${encodeURIComponent(digits)}`);
  };

  const leadFromLabel = (lead: OrganizationLeadRow) => {
    if (lead.leadFromPhone?.trim()) return formatPhone(lead.leadFromPhone);
    return "—";
  };

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeads((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const pageIds = rows.map((lead) => lead.id);
    if (pageIds.length === 0) return;
    const allOnPageSelected = pageIds.every((id) => selectedLeads.has(id));
    setSelectedLeads((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const allOnCurrentPageSelected =
    rows.length > 0 && rows.every((lead) => selectedLeads.has(lead.id));
  const someOnCurrentPageSelected = rows.some((lead) => selectedLeads.has(lead.id));
  const selectedLeadsArray = Array.from(selectedLeads);

  const exportCsv = () => {
    if (selectedLeads.size === 0) {
      toast({
        variant: "destructive",
        title: "No leads selected",
        description: "Please select the lead first.",
      });
      return;
    }

    const toExport = rows.filter((lead) => selectedLeads.has(lead.id));
    const header = ["Name", "Phone", "Email", "Source", "Score", "Priority", "Status", "Lead From", "Date Added", "First Message"];
    const lines = toExport.map((r) =>
      [
        r.name || "",
        formatPhone(r.phoneNumber),
        r.email || "",
        leadSourceLabel(r.source || "", sourceFilterOptions),
        r.score,
        r.priority,
        statusLabel(leadStatuses, r.status),
        leadFromLabel(r),
        r.createdAt ? format(new Date(r.createdAt), "dd MMM yyyy") : "",
        r.firstMessagePreview || "",
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: "Export complete",
      description: `Exported ${toExport.length} lead${toExport.length === 1 ? "" : "s"}.`,
    });
  };

  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) {
        toast({ variant: "destructive", title: "Empty file", description: "CSV needs a header and at least one row." });
        return;
      }
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
      const leads = lines.slice(1).map((line) => {
        const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        const row: Record<string, string> = {};
        headers.forEach((h, i) => {
          row[h] = cols[i] || "";
        });
        return {
          name: row.name || row["customer name"] || "",
          phoneNumber: row.phone || row.phonenumber || row.mobile || "",
          email: row.email || "",
          source: "import",
        };
      });
      importMutation.mutate(leads);
    };
    reader.readAsText(file);
  };

  const primaryBtn = skin ? "bg-[#0059bb] hover:bg-[#004a9a] text-white" : "";
  const inputClass = skin ? "h-11 rounded-xl border-[#e5e7eb]" : "";
  const isBoardView = viewMode === "board";
  const pageShell = cn(
    "mx-auto w-full",
    isBoardView
      ? "flex h-full min-h-0 flex-1 flex-col gap-4 overflow-hidden"
      : "flex h-full min-h-0 flex-1 flex-col gap-4 overflow-y-auto",
    skin ? "p-4 sm:p-6 md:p-8" : "container max-w-[95%]",
    !skin && !isBoardView && "py-8",
  );

  return (
    <div className={pageShell}>
      {!skin && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <UserPlus className="h-7 w-7 text-sky-600" />
              Leads
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              New WhatsApp conversations and manually added prospects.
            </p>
          </div>
        </div>
      )}

      <div className="flex shrink-0 flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          {skin ? (
            <RhSearchField
              value={search}
              onChange={setSearch}
              placeholder="Search leads"
              className="min-w-[200px] flex-1 max-w-md"
            />
          ) : (
            <div className="relative min-w-[200px] flex-1 max-w-md">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search leads"
                className={cn("pl-9", inputClass)}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className={cn("w-[140px]", inputClass)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusFilterOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className={cn("w-[140px]", inputClass)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className={cn("w-[140px]", inputClass)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sourceFilterOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className={cn("w-[9.5rem]", inputClass)}
            title="From date"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className={cn("w-[9.5rem]", inputClass)}
            title="To date"
          />
          {(dateFrom || dateTo) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
              }}
            >
              Clear dates
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <Button
              variant="destructive"
              size="sm"
              className={cn(
                "disabled:opacity-100 disabled:pointer-events-none",
                skin && "rounded-xl",
              )}
              onClick={() => {
                if (selectedLeads.size === 0) {
                  toast({
                    title: "No leads selected",
                    description: "Please select at least one lead to delete",
                    variant: "destructive",
                  });
                  return;
                }
                setBulkDeleteDialogOpen(true);
              }}
              disabled={selectedLeads.size === 0}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className={skin ? "rounded-xl" : ""}>
                Export <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportCsv}>
                <Download className="mr-2 h-4 w-4" />
                Download CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="sm"
            className={skin ? "rounded-xl" : ""}
            disabled={!canEdit || importMutation.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImportFile(f);
              e.target.value = "";
            }}
          />
          <Button variant="outline" size="icon" className={skin ? "rounded-xl" : ""} onClick={() => refetch()} title="Refresh">
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </Button>
          <div className="flex items-center rounded-lg border border-[#e5e7eb] p-0.5">
            <Button
              type="button"
              variant={viewMode === "board" ? "default" : "ghost"}
              size="icon"
              className={cn("h-8 w-8 rounded-md", viewMode === "board" && skin && primaryBtn)}
              onClick={() => setViewMode("board")}
              title="Board view"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={viewMode === "list" ? "default" : "ghost"}
              size="icon"
              className={cn("h-8 w-8 rounded-md", viewMode === "list" && skin && primaryBtn)}
              onClick={() => setViewMode("list")}
              title="List view"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          {canEdit && (
            <Button
              size="sm"
              className={cn(primaryBtn)}
              onClick={() => openAddLead()}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Lead
            </Button>
          )}
        </div>
      </div>

      {viewMode === "board" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {isLoading ? (
            <div className="flex flex-1 justify-center py-16 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : leadStatuses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              Configure lead statuses under Leads → Lead Status in the sidebar.
            </p>
          ) : (
            <LeadsKanbanBoard
              className="h-full min-h-0 flex-1"
              leads={rows}
              statuses={leadStatuses}
              canEdit={canEdit}
              onOpenWhatsApp={openWhatsApp}
              onMoveLead={(id, statusSlug) => patchMutation.mutate({ id, data: { status: statusSlug } })}
              onReorderLeads={(statusSlug, orderedIds) =>
                reorderMutation.mutate({ status: statusSlug, orderedIds })
              }
              onAddLead={openAddLead}
              onEditLead={canEdit ? openEditLead : undefined}
              onChangeLeadStatus={canEdit ? handleChangeLeadStatus : undefined}
              onDeleteLead={canEdit ? (lead) => setDeleteId(lead.id) : undefined}
            />
          )}
        </div>
      ) : (
      <>
      {selectedLeads.size > 0 && (
        <p className="text-sm text-muted-foreground">
          {selectedLeads.size} of {total} row(s) selected.
        </p>
      )}
      <div className={cn("rounded-md border overflow-x-auto", skin && "border-[#e5e7eb] rounded-xl")}>
        {isLoading ? (
          <div className="flex justify-center py-16 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">
            {total === 0 && !search.trim()
              ? "No leads yet. They appear here when someone messages you for the first time."
              : "No leads match your filters."}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className={skin ? "bg-[#f8fafc]" : undefined}>
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      rows.length === 0
                        ? false
                        : allOnCurrentPageSelected
                          ? true
                          : someOnCurrentPageSelected
                            ? "indeterminate"
                            : false
                    }
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all leads on this page"
                  />
                </TableHead>
                <TableHead>Customer Name</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Lead From</TableHead>
                <TableHead>Date Added</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((lead) => {
                const displayName = lead.name?.trim() || formatPhone(lead.phoneNumber);
                return (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedLeads.has(lead.id)}
                        onCheckedChange={() => toggleLeadSelection(lead.id)}
                        aria-label={`Select ${displayName}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3 min-w-[180px]">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-sky-100 text-sky-700 text-xs font-semibold">
                            {initials(displayName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{displayName}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {formatPhone(lead.phoneNumber)}
                            {lead.email ? ` · ${lead.email}` : ""}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {canEdit ? (
                        <Select
                          value={lead.source || "unknown"}
                          onValueChange={(v) => patchMutation.mutate({ id: lead.id, data: { source: v } })}
                        >
                          <SelectTrigger className="h-8 w-[120px] border-0 shadow-none bg-transparent">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(sourceOptionsData?.sources ?? []).map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="capitalize text-sm">
                          {leadSourceLabel(lead.source || "unknown", sourceFilterOptions)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {canEdit ? (
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          className="h-8 w-16"
                          defaultValue={lead.score}
                          onBlur={(e) => {
                            const n = parseInt(e.target.value, 10);
                            if (!Number.isNaN(n) && n !== lead.score) {
                              patchMutation.mutate({ id: lead.id, data: { score: n } });
                            }
                          }}
                        />
                      ) : (
                        lead.score
                      )}
                    </TableCell>
                    <TableCell>
                      {canEdit ? (
                        <Select
                          value={lead.priority}
                          onValueChange={(v) => patchMutation.mutate({ id: lead.id, data: { priority: v } })}
                        >
                          <SelectTrigger className="h-8 w-[110px] border-0 shadow-none bg-transparent capitalize">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PRIORITY_OPTIONS.filter((o) => o.value !== "all").map((o) => (
                              <SelectItem key={o.value} value={o.value} className="capitalize">
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="capitalize text-sm">{lead.priority}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {canEdit ? (
                        <Select
                          value={lead.status}
                          onValueChange={(v) => patchMutation.mutate({ id: lead.id, data: { status: v } })}
                        >
                          <SelectTrigger className="h-8 min-w-[130px] border-0 shadow-none bg-transparent">
                            <span
                              className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold"
                              style={{ backgroundColor: statusColor(leadStatuses, lead.status) }}
                            >
                              {statusLabel(leadStatuses, lead.status)}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            {leadStatuses.map((o) => (
                              <SelectItem key={o.slug} value={o.slug}>
                                {o.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span
                          className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold"
                          style={{ backgroundColor: statusColor(leadStatuses, lead.status) }}
                        >
                          {statusLabel(leadStatuses, lead.status)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm whitespace-nowrap">{leadFromLabel(lead)}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {lead.createdAt ? format(new Date(lead.createdAt), "dd MMM yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Sync to WhatsApp"
                          onClick={() => openWhatsApp(lead)}
                        >
                          <MessageCircle className="h-4 w-4 text-emerald-600" />
                        </Button>
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Edit lead"
                            onClick={() => openEditLead(lead)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Delete"
                            onClick={() => setDeleteId(lead.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <ListPaginationFooter
        currentPage={currentPage}
        rowsPerPage={rowsPerPage}
        total={total}
        onPageChange={setCurrentPage}
        onRowsPerPageChange={setRowsPerPage}
      />
      </>
      )}

      <AddLeadDialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) {
            setAddLeadDefaultStatus(undefined);
            setEditingLead(null);
          }
        }}
        leadStatuses={leadStatuses}
        defaultStatusSlug={addLeadDefaultStatus}
        editingLead={editingLead}
        skin={!!skin}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete lead?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
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

      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedLeads.size} Lead{selectedLeads.size !== 1 ? "s" : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedLeads.size} selected lead
              {selectedLeads.size !== 1 ? "s" : ""}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                bulkDeleteMutation.mutate(selectedLeadsArray);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
