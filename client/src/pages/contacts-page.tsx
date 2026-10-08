// @ts-nocheck
import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { uploadGalleryFiles } from "@/lib/upload-gallery-files";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UserPlus, Plus, Trash2, Edit, Tag, Search, Download, Upload, X, Eye, Filter, Columns, Send, UserCheck, Calendar, Clock, Radio, File, Image as ImageIcon, Video, Music, Link2, Loader2, Phone, RefreshCw, ChevronDown, ChevronLeft, ChevronRight, Users, GripVertical, Mountain, MoreVertical, Receipt } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { fromAppZonedTime, DEFAULT_TIMEZONE } from "@shared/timezone";
import { ContactImportWizard } from "@/components/contact-import-wizard";
import { ContactDetailsSheet } from "@/components/contact-details-sheet";
import { PermissionGate } from "@/components/permission-gate";
import { useCurrentMemberPermissions } from "@/hooks/useCurrentMemberPermissions";
import { useListPaginationState, parsePaginatedListResponse, useDebouncedValue } from "@/lib/list-pagination";
import { CONTACTS_MAX_PAGE_SIZE } from "@shared/list-pagination";
import { sanitizeWhatsAppTemplateParamText, WHATSAPP_TEMPLATE_PARAM_MAX_CHARS } from "@shared/whatsapp-template-params";
import { fetchLegacyListApi } from "@/lib/legacy-list-api";
import { ListPaginationFooter } from "@/components/list-pagination-footer";
import { toastPlanLimitOrError } from "@/lib/plan-limit-toast";
import { useRatehonkPageSkin } from "@/panel-templates/ratehonk-v1/RatehonkSkinContext";
import { useInitialUrlSearch } from "@/hooks/use-initial-url-search";
import { cn } from "@/lib/utils";
import { ContactCreateInvoiceDialog } from "@/components/contact-create-invoice-dialog";

type ManagedContact = {
  id: string;
  userId: string;
  organizationId: string;
  phoneNumber: string;
  name: string | null;
  email: string | null;
  source: string | null;
  customFields: Record<string, any> | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

type ContactTag = {
  id: string;
  userId: string;
  organizationId: string;
  name: string;
  color: string;
  createdAt: string;
};

const contactSchema = z.object({
  phoneNumber: z.string().min(1, "Phone number is required"),
  name: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  source: z.string().optional(),
  customFields: z.record(z.any()).optional(),
});

const tagSchema = z.object({
  name: z.string().min(1, "Tag name is required"),
  color: z.string().min(1, "Color is required"),
});

type ContactInput = z.infer<typeof contactSchema>;
type TagInput = z.infer<typeof tagSchema>;

const TAG_COLORS = [
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Yellow", value: "#eab308" },
  { name: "Green", value: "#22c55e" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Purple", value: "#a855f7" },
  { name: "Pink", value: "#ec4899" },
  { name: "Gray", value: "#6b7280" },
];

// Gallery Grid Component
function GalleryGrid({ 
  fileType, 
  selectedPhoneNumberId, 
  onSelect 
}: { 
  fileType: "all" | "image" | "video" | "audio" | "document";
  selectedPhoneNumberId: string;
  onSelect: (url: string, itemType?: string) => void;
}) {
  const { toast } = useToast();
  
  // Fetch gallery items from API
  // Note: Query runs automatically when component mounts (when dialog is open)
  const { data: galleryItems = [], isLoading } = useQuery<Array<{ id: string; url: string; name: string; type: string }>>({
    queryKey: ["/api/gallery", fileType],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", `/api/gallery?type=${fileType}`);
        return await res.json();
      } catch (error) {
        // If API doesn't exist yet, return empty array
        return [];
      }
    },
  });

  if (isLoading) {
    return (
      <div className="border-2 border-dashed rounded-lg p-12 text-center">
        <p className="text-sm text-muted-foreground">Loading gallery...</p>
      </div>
    );
  }

  if (galleryItems.length === 0) {
    return (
      <div className="border-2 border-dashed rounded-lg p-12 text-center">
        <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No files found</p>
        <p className="text-xs text-muted-foreground mt-1">Upload files to see them here</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-4">
      {galleryItems.map((item) => (
        <div
          key={item.id}
          className="relative group cursor-pointer border rounded-lg overflow-hidden hover:border-primary transition-colors"
          onClick={() => onSelect(item.url, item.type)}
        >
          {item.type === "image" ? (
            <img
              src={item.url}
              alt={item.name}
              className="w-full h-32 object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-32 bg-muted flex items-center justify-center">
              <File className="w-8 h-8 text-muted-foreground" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center">
            <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="p-2 bg-background">
            <p className="text-xs truncate">{item.name}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

import { CONTACT_SOURCE_OPTIONS, contactSourceLabel } from "@shared/contact-sources";

// Table columns that can be shown/hidden and reordered (checkbox and actions columns are always visible)
const CONTACT_TABLE_COLUMNS: { id: string; label: string }[] = [
  { id: "createdAt", label: "Created" },
  { id: "name", label: "Name" },
  { id: "phoneNumber", label: "Phone" },
  { id: "source", label: "Source" },
  { id: "tags", label: "Tags" },
  { id: "optIn", label: "Opt In" },
  { id: "assignedAt", label: "Assigned At" },
  { id: "assignedTo", label: "Assigned To" },
  { id: "email", label: "Email" },
  { id: "status", label: "Status" },
  { id: "wabaPhoneNumber", label: "WABA Phone Number" },
  { id: "billNo", label: "Bill No" },
  { id: "action", label: "Action" },
];

const DEFAULT_COLUMN_ORDER = CONTACT_TABLE_COLUMNS.map((c) => c.id);
const ACTION_COLUMN_ID = "action";

/** Keep Action pinned as the final column (after any dynamic /columns fields). */
function withActionColumnLast(order: string[]): string[] {
  const withoutAction = order.filter((id) => id !== ACTION_COLUMN_ID);
  return [...withoutAction, ACTION_COLUMN_ID];
}

// Build full table columns list: static + dynamic (from /columns) where visible; Action always last
function useAllTableColumns(contactColumns: any[]) {
  return useMemo(() => {
    const actionCol = CONTACT_TABLE_COLUMNS.find((c) => c.id === ACTION_COLUMN_ID)!;
    const staticWithoutAction = CONTACT_TABLE_COLUMNS.filter((c) => c.id !== ACTION_COLUMN_ID);
    const dynamic = (contactColumns || [])
      .filter((c: any) => c.visible)
      .map((c: any) => ({ id: c.id, label: c.label }));
    return [...staticWithoutAction, ...dynamic, actionCol];
  }, [contactColumns]);
}

export default function ContactsPage() {
  const skin = useRatehonkPageSkin();
  const [isAtlas, setIsAtlas] = useState(false);
  useEffect(() => {
    if (typeof document !== "undefined") {
      setIsAtlas(document.documentElement.dataset.panelTemplate === "helicoptic-v1");
    }
  }, []);
  const primaryBtnClass = skin
    ? "bg-[var(--rh-brand)] hover:bg-[var(--rh-brand-hover)] text-white"
    : "";
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  useInitialUrlSearch(setSearchQuery);
  const [selectedContact, setSelectedContact] = useState<ManagedContact | null>(null);
  const [selectedTag, setSelectedTag] = useState<ContactTag | null>(null);
  const [filterTag, setFilterTag] = useState<string>("all");
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [createTagDialogOpen, setCreateTagDialogOpen] = useState(false);
  const [editTagDialogOpen, setEditTagDialogOpen] = useState(false);
  const [deleteTagDialogOpen, setDeleteTagDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [contactDetailsOpen, setContactDetailsOpen] = useState(false);
  const [selectedContactForDetails, setSelectedContactForDetails] = useState<ManagedContact | null>(null);
  const [broadcastDialogOpen, setBroadcastDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [bulkTagDialogOpen, setBulkTagDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const {
    currentPage,
    setCurrentPage,
    rowsPerPage,
    setRowsPerPage,
    resetPage,
    paginationParams,
  } = useListPaginationState(10);
  const [scheduleBroadcast, setScheduleBroadcast] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(undefined);
  const [scheduleTime, setScheduleTime] = useState("");
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [templateParameters, setTemplateParameters] = useState<Array<{ column?: string; fallback?: string }>>([]);
  const [headerImageUrl, setHeaderImageUrl] = useState<string>("");
  const [headerImageId, setHeaderImageId] = useState<string | null>(null);
  const [headerVideoUrl, setHeaderVideoUrl] = useState<string>("");
  const [headerVideoId, setHeaderVideoId] = useState<string | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState<string>("");
  /** Broadcast: send-time media URL per carousel card (same as chat templates) */
  const [broadcastCarouselCardMediaUrls, setBroadcastCarouselCardMediaUrls] = useState<(string | null)[]>([]);
  const [galleryCarouselCardIndex, setGalleryCarouselCardIndex] = useState<number | null>(null);
  const [broadcastCarouselPreviewIndex, setBroadcastCarouselPreviewIndex] = useState(0);
  const [galleryDialogOpen, setGalleryDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [templateParams, setTemplateParams] = useState<Array<{ column?: string; fallback?: string }>>([]);
  const [headerFormat, setHeaderFormat] = useState<string | null>(null);
  const [selectedContactForTemplate, setSelectedContactForTemplate] = useState<ManagedContact | null>(null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [contactForInvoice, setContactForInvoice] = useState<ManagedContact | null>(null);
  const [galleryFileType, setGalleryFileType] = useState<"all" | "image" | "video" | "audio" | "document">("all");
  const [galleryViewMode, setGalleryViewMode] = useState<"gallery" | "url">("gallery");
  const [galleryUrlInput, setGalleryUrlInput] = useState<string>("");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<"direct" | "broadcast">("direct");
  type PendingImportForBroadcast = {
    file: File;
    mappings: Array<{ field: string; csvHeader: string | null; type?: string; required?: boolean }>;
    validCount: number;
  };
  const [pendingImportForBroadcast, setPendingImportForBroadcast] = useState<PendingImportForBroadcast | null>(null);
  const [importAndBroadcastPending, setImportAndBroadcastPending] = useState(false);
  const [filtersDialogOpen, setFiltersDialogOpen] = useState(false);
  const [columnsDropdownOpen, setColumnsDropdownOpen] = useState(false);
  const [columnOrder, setColumnOrder] = useState<string[]>(() => DEFAULT_COLUMN_ORDER);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CONTACT_TABLE_COLUMNS.map((c) => [c.id, true]))
  );
  const [columnSearchQuery, setColumnSearchQuery] = useState("");

  // Applied filters (sent to API). Persisted when user clicks Apply.
  type ContactListFilters = {
    search?: string;
    createdDateFrom?: string;
    createdDateTo?: string;
    updatedDateFrom?: string;
    updatedDateTo?: string;
    reminderDateFrom?: string;
    reminderDateTo?: string;
    assignedDateFrom?: string;
    assignedDateTo?: string;
    source?: string;
    assignedTo?: string[];
    tagIds?: string[];
    noTagsOnly?: boolean;
    unassignedOnly?: boolean;
    optInStatus?: "all" | "opted_in" | "opted_out";
    duplicate?: "all" | "duplicates" | "non_duplicates";
    email?: string;
    /** Filter by dynamic column values (column id -> search string) */
    customFieldFilters?: Record<string, string>;
  };
  const [appliedFilters, setAppliedFilters] = useState<ContactListFilters>({});
  // Local form state while the Filters dialog is open (reset to appliedFilters when dialog opens)
  const [filterForm, setFilterForm] = useState<ContactListFilters>({});
  const debouncedSearchQuery = useDebouncedValue(searchQuery);
  const effectiveSearch =
    debouncedSearchQuery.trim() || appliedFilters.search?.trim() || "";

  const { data: contactsResponse, isLoading } = useQuery({
    queryKey: ["/api/contacts", appliedFilters, effectiveSearch, filterTag, currentPage, rowsPerPage],
    queryFn: async () => {
      const params = new URLSearchParams(paginationParams.toString());
      if (effectiveSearch) params.set("search", effectiveSearch);
      if (appliedFilters.createdDateFrom) params.set("createdDateFrom", appliedFilters.createdDateFrom);
      if (appliedFilters.createdDateTo) params.set("createdDateTo", appliedFilters.createdDateTo);
      if (appliedFilters.updatedDateFrom) params.set("updatedDateFrom", appliedFilters.updatedDateFrom);
      if (appliedFilters.updatedDateTo) params.set("updatedDateTo", appliedFilters.updatedDateTo);
      if (appliedFilters.reminderDateFrom) params.set("reminderDateFrom", appliedFilters.reminderDateFrom);
      if (appliedFilters.reminderDateTo) params.set("reminderDateTo", appliedFilters.reminderDateTo);
      if (appliedFilters.assignedDateFrom) params.set("assignedDateFrom", appliedFilters.assignedDateFrom);
      if (appliedFilters.assignedDateTo) params.set("assignedDateTo", appliedFilters.assignedDateTo);
      if (appliedFilters.source) params.set("source", appliedFilters.source);
      if (appliedFilters.assignedTo?.length) appliedFilters.assignedTo.forEach((id) => params.append("assignedTo", id));
      if (filterTag !== "all") params.append("tagIds", filterTag);
      else if (appliedFilters.tagIds?.length) appliedFilters.tagIds.forEach((id) => params.append("tagIds", id));
      if (appliedFilters.noTagsOnly) params.set("noTagsOnly", "true");
      if (appliedFilters.email) params.set("email", appliedFilters.email);
      if (appliedFilters.unassignedOnly) params.set("unassignedOnly", "true");
      if (appliedFilters.optInStatus && appliedFilters.optInStatus !== "all") params.set("optInStatus", appliedFilters.optInStatus);
      if (appliedFilters.duplicate && appliedFilters.duplicate !== "all") params.set("duplicate", appliedFilters.duplicate);
      if (appliedFilters.customFieldFilters && Object.keys(appliedFilters.customFieldFilters).length > 0) {
        for (const [columnId, value] of Object.entries(appliedFilters.customFieldFilters)) {
          if (value?.trim()) params.set(`customField.${columnId}`, value.trim());
        }
      }
      const res = await apiRequest("GET", `/api/contacts?${params.toString()}`);
      return res.json();
    },
  });

  const { items: contacts, total: totalContacts } = parsePaginatedListResponse<ManagedContact>(
    contactsResponse,
    "contacts"
  );

  useEffect(() => {
    resetPage();
  }, [effectiveSearch, filterTag, appliedFilters, resetPage]);

  const { data: tags = [] } = useQuery<ContactTag[]>({
    queryKey: ["/api/tags"],
    queryFn: () => fetchLegacyListApi<ContactTag>("/api/tags", "tags"),
  });

  // Get organizations (same logic as Settings page for consistency)
  const { data: organizationsData } = useQuery<{ organizations?: any[] } | any[]>({
    queryKey: ["/api/organizations"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/organizations");
      const data = await res.json();
      return data;
    },
  });

  const organizationsList = Array.isArray(organizationsData)
    ? organizationsData
    : (organizationsData?.organizations || []);
  const currentOrganizationId = organizationsList[0]?.id;

  const { hasPermission, isOwnerOrAdmin } = useCurrentMemberPermissions();
  const canViewTeam = isOwnerOrAdmin || hasPermission("manage_team.view");

  // Get organization members only when user has permission (avoids 403 for members without manage_team.view)
  const { data: members = [] } = useQuery<any[]>({
    queryKey: ["/api/organizations", currentOrganizationId, "members"],
    queryFn: async () => {
      if (!currentOrganizationId) return [];
      const res = await apiRequest("GET", `/api/organizations/${currentOrganizationId}/members`);
      return await res.json();
    },
    enabled: !!currentOrganizationId && canViewTeam,
  });

  // Get connected WhatsApp numbers (sessions)
  const { data: sessions = [] } = useQuery<any[]>({
    queryKey: ["/api/sessions"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/sessions");
      return res.json();
    },
  });
  const connectedNumbers = sessions.filter((s: any) => s.status === "connected");

  // Get WhatsApp Business phone numbers for broadcast
  const { data: phoneNumbersData } = useQuery<{ success: boolean; phoneNumbers: any[] }>({
    queryKey: ['/api/integrations/whatsapp-business/added-phones'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/integrations/whatsapp-business/added-phones');
      return await res.json();
    },
    enabled: broadcastDialogOpen,
  });

  // Get templates for broadcast (org-scoped, filtered by phone number)
  const { data: templates = [] } = useQuery<any[]>({
    queryKey: ["/api/templates", currentOrganizationId, selectedPhoneNumberId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (currentOrganizationId) params.set("organizationId", currentOrganizationId);
      if (selectedPhoneNumberId) params.set("phoneNumberId", selectedPhoneNumberId);
      const q = params.toString();
      const url = q ? `/api/templates?${q}` : "/api/templates";
      return fetchLegacyListApi(url, "templates");
    },
    enabled: broadcastDialogOpen && !!currentOrganizationId,
  });

  // Get active session for template sending
  const connectedSessions = sessions.filter((s: any) => s.status === "connected");
  const activeSession = connectedSessions.length > 0 ? connectedSessions[0] : null;
  const isBusinessAPI = activeSession?.connectionType === 'official';

  // Get templates for template dialog — fetch all org templates (avoid phoneNumberId mismatch → empty [])
  const templateDialogPhoneNumberId = activeSession?.connectionType === 'official' ? (activeSession.deviceInfo as any)?.apiPhoneNumberId : undefined;
  const { data: templateDialogTemplatesRaw = [], isLoading: templateDialogTemplatesLoading } = useQuery<any[]>({
    queryKey: ['/api/templates', 'contacts-send'],
    queryFn: () => fetchLegacyListApi("/api/templates", "templates"),
    enabled: isBusinessAPI && templateDialogOpen,
  });

  const templateDialogTemplatesForSession = templateDialogPhoneNumberId
    ? templateDialogTemplatesRaw.filter(
        (t: any) => !t.phoneNumberId || t.phoneNumberId === templateDialogPhoneNumberId
      )
    : templateDialogTemplatesRaw;

  // Filter approved templates for Business API
  const filteredTemplates = isBusinessAPI 
    ? templateDialogTemplatesForSession.filter((t: any) => String(t.status || '').toUpperCase() === 'APPROVED')
    : [];

  const templateDropdownHint = (() => {
    if (templateDialogTemplatesLoading) return 'Loading templates…';
    if (templateDialogTemplatesRaw.length === 0) {
      return 'No templates synced — open Manage → Whatsapp Templates and sync from Meta';
    }
    if (templateDialogTemplatesForSession.length === 0 && templateDialogPhoneNumberId) {
      return 'No templates for this WhatsApp number — sync templates for the selected inbox number';
    }
    const pending = templateDialogTemplatesForSession.filter(
      (t: any) => String(t.status || '').toUpperCase() !== 'APPROVED'
    ).length;
    if (pending > 0) {
      return `No approved templates (${pending} pending/rejected on Meta)`;
    }
    return 'No approved templates — create one under Manage → Whatsapp Templates';
  })();

  // Get gallery media items for template header
  const { data: mediaItems = [] } = useQuery<any[]>({
    queryKey: ['/api/gallery', galleryFileType],
    queryFn: async () => {
      const url = galleryFileType === 'all' 
        ? '/api/gallery?type=all'
        : `/api/gallery?type=${galleryFileType}`;
      const res = await apiRequest('GET', url);
      return await res.json();
    },
    enabled: galleryDialogOpen,
  });

  // Get contact columns for create/edit form, table visibility, filters, and broadcast parameter mapping
  const { data: contactColumns = [] } = useQuery<any[]>({
    queryKey: ["/api/columns"],
    queryFn: () => fetchLegacyListApi("/api/columns", "columns"),
  });

  const allTableColumns = useAllTableColumns(contactColumns);

  // Visible columns for the table; Action is always shown and always last
  const visibleTableColumnIds = useMemo(
    () =>
      withActionColumnLast(
        columnOrder.filter(
          (id) => id === ACTION_COLUMN_ID || columnVisibility[id] !== false
        )
      ),
    [columnOrder, columnVisibility]
  );

  // When contact columns load, add visible dynamic columns to order and visibility (Action stays last)
  useEffect(() => {
    const dynamic = (contactColumns || []).filter((c: any) => c.visible).map((c: any) => c.id);
    setColumnOrder((prev) => {
      const withoutAction = prev.filter((id) => id !== ACTION_COLUMN_ID);
      const existing = new Set(withoutAction);
      const toAdd = dynamic.filter((id: string) => !existing.has(id));
      const next = withActionColumnLast([...withoutAction, ...toAdd]);
      if (next.length === prev.length && next.every((id, i) => id === prev[i])) return prev;
      return next;
    });
    if (dynamic.length === 0) return;
    setColumnVisibility((prev) => {
      const next = { ...prev };
      let changed = false;
      dynamic.forEach((id: string) => {
        if (next[id] === undefined) {
          next[id] = true;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [contactColumns]);

  // Extract variables from template body
  const extractTemplateVariables = (template: any): number[] => {
    if (!template?.components) return [];
    const bodyComponent = template.components.find((c: any) => c.type === 'BODY');
    if (!bodyComponent?.text) return [];
    const matches = bodyComponent.text.match(/\{\{(\d+)\}\}/g);
    if (!matches) return [];
    const vars = matches.map((m: string) => parseInt(m.replace(/[{}]/g, '')));
    return [...new Set(vars)].sort((a, b) => a - b);
  };

  // Get preview text with replaced parameters
  const getPreviewText = (template: any, params: Array<{ column?: string; fallback?: string }>, contact?: ManagedContact): string => {
    if (!template?.components) return '';
    const bodyComponent = template.components.find((c: any) => c.type === 'BODY');
    if (!bodyComponent?.text) return '';
    
    let text = bodyComponent.text;
    
    // Extract variable numbers from template (e.g., {{1}}, {{2}})
    const varNumbers = extractTemplateVariables(template);
    
    // Replace each variable with its corresponding parameter value
    varNumbers.forEach((varNum, index) => {
      if (index >= params.length) return; // Skip if no parameter for this variable
      
      const param = params[index];
      let value = '';
      
      // If column is selected and contact is available, try to get value from contact first
      if (param.column && contact) {
        if (param.column === 'name') {
          value = contact.name || '';
        } else if (param.column === 'phoneNumber') {
          value = contact.phoneNumber || '';
        } else if (param.column === 'email') {
          value = contact.email || '';
        } else if (param.column.startsWith('customFields.')) {
          const fieldName = param.column.replace('customFields.', '');
          value = contact.customFields?.[fieldName] || '';
        } else {
          // Custom column - find by ID
          const column = contactColumns.find((c: any) => c.id === param.column);
          if (column && contact.customFields) {
            value = contact.customFields[column.label] || '';
          }
        }
      }
      
      // Use fallback if column value is empty
      if (!value && param.fallback) {
        value = param.fallback;
      }
      
      // Replace all occurrences of {{varNum}} with the value
      // If value is still empty, keep the placeholder
      text = text.replace(new RegExp(`\\{\\{${varNum}\\}\\}`, 'g'), value || `{{${varNum}}}`);
    });
    
    return text;
  };

  const contactForm = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      phoneNumber: "",
      name: "",
      email: "",
      source: "manual",
      customFields: {},
    },
  });

  const editContactForm = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
  });

  // Populate edit form when contact is selected and dialog opens
  useEffect(() => {
    if (selectedContact && editDialogOpen) {
      editContactForm.reset({
        phoneNumber: selectedContact.phoneNumber || "",
        name: selectedContact.name || "",
        email: selectedContact.email || "",
        source: selectedContact.source || "manual",
        customFields: selectedContact.customFields || {},
      });
    }
  }, [selectedContact, editDialogOpen]);

  const tagForm = useForm<TagInput>({
    resolver: zodResolver(tagSchema),
    defaultValues: {
      name: "",
      color: TAG_COLORS[0].value,
    },
  });

  const editTagForm = useForm<TagInput>({
    resolver: zodResolver(tagSchema),
  });

  // Extract template parameters from message body (for template dialog)
  const extractTemplateParams = (message: string): Array<{ column?: string; fallback?: string }> => {
    const paramRegex = /\{\{(\d+)\}\}/g;
    const matches = Array.from(message.matchAll(paramRegex));
    if (matches.length === 0) return [];
    
    const paramNumbers = [...new Set(matches.map(m => parseInt(m[1])))].sort((a, b) => a - b);
    return paramNumbers.map(() => ({ column: '', fallback: '' }));
  };

  // Resolve param value from contact (column or fallback)
  const resolveParamValue = (param: { column?: string; fallback?: string }, contact: ManagedContact | null): string => {
    if (!param) return '';
    let raw = '';
    if (param.column && contact) {
      if (param.column === 'name') raw = contact.name || param.fallback || '';
      else if (param.column === 'phoneNumber') raw = contact.phoneNumber || param.fallback || '';
      else if (param.column === 'email') raw = contact.email || param.fallback || '';
      else if (param.column.startsWith('customFields.')) {
        const fieldName = param.column.replace('customFields.', '');
        raw = (contact.customFields?.[fieldName] ?? param.fallback) || '';
      } else {
        const column = contactColumns.find((c: any) => c.id === param.column);
        if (column && contact.customFields) raw = contact.customFields[column.label] || param.fallback || '';
        else raw = param.fallback || '';
      }
    } else {
      raw = param.fallback || '';
    }
    return sanitizeWhatsAppTemplateParamText(raw);
  };

  // Handle template selection (for template dialog)
  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = filteredTemplates.find((t: any) => t.id === templateId);
    if (template) {
      setSelectedTemplate(template);
      
      // Check for HEADER component
      const headerComponent = template.components?.find((c: any) => c.type === 'HEADER');
      if (headerComponent) {
        const format = headerComponent.format || 'TEXT';
        setHeaderFormat(format);
        setHeaderImageId(null);
        setHeaderImageUrl("");
        setHeaderVideoId(null);
        setHeaderVideoUrl("");
      } else {
        setHeaderFormat(null);
        setHeaderImageId(null);
        setHeaderImageUrl("");
        setHeaderVideoId(null);
        setHeaderVideoUrl("");
      }
      
      // Extract body text and parameters
      const bodyComponent = template.components?.find((c: any) => c.type === 'BODY');
      if (bodyComponent?.text) {
        const params = extractTemplateParams(bodyComponent.text);
        setTemplateParams(params);
      } else {
        setTemplateParams([]);
      }
    } else {
      setSelectedTemplate(null);
      setHeaderFormat(null);
      setHeaderImageId(null);
      setHeaderImageUrl("");
      setHeaderVideoId(null);
      setHeaderVideoUrl("");
      setTemplateParams([]);
    }
  };

  // Handle opening template dialog for a contact
  const handleOpenTemplateDialog = (contact: ManagedContact) => {
    setSelectedContactForTemplate(contact);
    setTemplateDialogOpen(true);
    // Reset template selection when opening dialog
    setSelectedTemplateId(null);
    setSelectedTemplate(null);
    setTemplateParams([]);
    setHeaderImageId(null);
    setHeaderFormat(null);
    setHeaderImageUrl("");
    setImageUrlInput("");
  };

  const handleOpenCreateInvoice = (contact: ManagedContact) => {
    setContactForInvoice(contact);
    setInvoiceDialogOpen(true);
  };

  // Handle sending template message
  const handleSendTemplate = async () => {
    if (!selectedTemplate || !selectedContactForTemplate) {
      toast({
        title: "Template required",
        description: "Please select a template",
        variant: "destructive",
      });
      return;
    }

    // Validate that all required parameters have column or manual value
    if (templateParams.length > 0) {
      const emptyParams = templateParams
        .map((p, i) => ({ p, i }))
        .filter(({ p }) => !p?.column && (!p?.fallback || p.fallback.trim().length === 0))
        .map(({ i }) => i + 1);
      if (emptyParams.length > 0) {
        toast({
          title: "Missing Parameters",
          description: `Please select a column or enter a value for parameter(s) ${emptyParams.join(', ')}.`,
          variant: "destructive",
        });
        return;
      }
    }

    // Check if template requires image or video header
    if (headerFormat === 'IMAGE' || headerFormat === 'VIDEO') {
      if (uploadMediaMutation.isPending) {
        toast({
          title: "Media uploading",
          description: "Please wait for the media to finish uploading before sending.",
          variant: "default",
        });
        return;
      }
      const needImage = headerFormat === 'IMAGE';
      const hasImage = headerImageId || headerImageUrl;
      const hasVideo = headerVideoId || headerVideoUrl;
      if (needImage) {
        if (headerImageUrl && !headerImageId) {
          toast({
            title: "Image upload incomplete",
            description: "The image upload did not complete. Please try selecting the image again.",
            variant: "destructive",
          });
          return;
        }
        if (!hasImage) {
          toast({
            title: "Image required",
            description: "This template requires an image header. Please select an image first.",
            variant: "destructive",
          });
          return;
        }
      } else {
        if (headerVideoUrl && !headerVideoId) {
          toast({
            title: "Video upload incomplete",
            description: "The video upload did not complete. Please try selecting the video again.",
            variant: "destructive",
          });
          return;
        }
        if (!hasVideo) {
          toast({
            title: "Video required",
            description: "This template requires a video header. Please select a video first.",
            variant: "destructive",
          });
          return;
        }
      }
    }

    // Resolve template params: use column value from contact, or fallback
    const resolvedParams = templateParams.length > 0
      ? templateParams.map((p) => resolveParamValue(p, selectedContactForTemplate))
      : undefined;

    sendTemplateMutation.mutate({
      templateName: selectedTemplate.name,
      templateLanguage: selectedTemplate.language || 'en',
      templateParams: resolvedParams,
      headerImageId: headerFormat === 'IMAGE' ? (headerImageId || undefined) : undefined,
      headerVideoId: headerFormat === 'VIDEO' ? (headerVideoId || undefined) : undefined,
      to: selectedContactForTemplate.phoneNumber,
    });
  };

  const createMutation = useMutation({
    mutationFn: (data: ContactInput) => apiRequest("POST", "/api/contacts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setCreateDialogOpen(false);
      contactForm.reset();
      toast({
        title: "Success",
        description: "Contact created successfully",
      });
    },
    onError: (error: any) => {
      toastPlanLimitOrError(toast, error, "Error");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: ContactInput) => apiRequest("PATCH", `/api/contacts/${selectedContact?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setEditDialogOpen(false);
      setSelectedContact(null);
      toast({
        title: "Success",
        description: "Contact updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update contact",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/contacts/${selectedContact?.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setDeleteDialogOpen(false);
      setSelectedContact(null);
      setSelectedContacts(new Set());
      toast({
        title: "Success",
        description: "Contact deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete contact",
        variant: "destructive",
      });
    },
  });

  const createTagMutation = useMutation({
    mutationFn: (data: TagInput) => apiRequest("POST", "/api/tags", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      setCreateTagDialogOpen(false);
      tagForm.reset();
      toast({
        title: "Success",
        description: "Tag created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create tag",
        variant: "destructive",
      });
    },
  });

  const updateTagMutation = useMutation({
    mutationFn: (data: TagInput) => apiRequest("PATCH", `/api/tags/${selectedTag?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      setEditTagDialogOpen(false);
      setSelectedTag(null);
      toast({
        title: "Success",
        description: "Tag updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update tag",
        variant: "destructive",
      });
    },
  });

  const deleteTagMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/tags/${selectedTag?.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      setDeleteTagDialogOpen(false);
      setSelectedTag(null);
      toast({
        title: "Success",
        description: "Tag deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete tag",
        variant: "destructive",
      });
    },
  });

  const assignTagMutation = useMutation({
    mutationFn: ({ contactId, tagId }: { contactId: string; tagId: string }) =>
      apiRequest("POST", `/api/contacts/${contactId}/tags`, { tagId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setTagDialogOpen(false);
      toast({
        title: "Success",
        description: "Tag assigned successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to assign tag",
        variant: "destructive",
      });
    },
  });

  const syncFromChatsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/contacts/sync-from-chats");
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      const stats = data.stats || {};
      toast({
        title: "Sync Completed",
        description: `Created: ${stats.created || 0}, Updated: ${stats.updated || 0}, Skipped: ${stats.skipped || 0}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync contacts from chats",
        variant: "destructive",
      });
    },
  });

  // Auto-sync from chats when idle on Contacts page. Lightweight: 15s interval, only when tab visible, background API (no spinner)
  const lastPointerMoveRef = useRef<number>(Date.now());
  const autoSyncInProgressRef = useRef(false);
  useEffect(() => {
    const IDLE_MS = 15000; // 15 seconds - reduces API load vs 3s
    const handlePointerMove = () => { lastPointerMoveRef.current = Date.now(); };
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") return; // Pause when tab in background
      if (Date.now() - lastPointerMoveRef.current < IDLE_MS) return;
      if (autoSyncInProgressRef.current) return;
      autoSyncInProgressRef.current = true;
      apiRequest("POST", "/api/contacts/sync-from-chats")
        .then((res) => res.json())
        .then(() => queryClient.invalidateQueries({ queryKey: ["/api/contacts"] }))
        .catch(() => {})
        .finally(() => { autoSyncInProgressRef.current = false; });
    }, IDLE_MS);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      clearInterval(interval);
    };
  }, []);

  const removeTagMutation = useMutation({
    mutationFn: ({ contactId, tagId }: { contactId: string; tagId: string }) =>
      apiRequest("DELETE", `/api/contacts/${contactId}/tags/${tagId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({
        title: "Success",
        description: "Tag removed successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove tag",
        variant: "destructive",
      });
    },
  });

  // Upload media for template header (image or video)
  const uploadMediaMutation = useMutation({
    mutationFn: async ({ sessionId, file, mediaType }: { sessionId: string; file: File; mediaType?: 'image' | 'video' }) => {
      const formData = new FormData();
      formData.append('sessionId', sessionId);
      formData.append('file', file);

      const response = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload media');
      }
      
      return response.json();
    },
    onSuccess: (data, variables) => {
      const isVideo = variables.mediaType === 'video';
      if (isVideo) {
        setHeaderVideoId(data.mediaId);
        if (data.previewUrl) setHeaderVideoUrl(data.previewUrl);
        toast({
          title: "Video uploaded",
          description: `Video uploaded successfully. Media ID: ${data.mediaId?.substring(0, 20)}...`,
        });
      } else {
        setHeaderImageId(data.mediaId);
        if (data.previewUrl) setHeaderImageUrl(data.previewUrl);
        toast({
          title: "Image uploaded",
          description: `Image uploaded successfully. Media ID: ${data.mediaId?.substring(0, 20)}...`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload media",
        variant: "destructive",
      });
    },
  });

  // Send template message mutation
  const sendTemplateMutation = useMutation({
    mutationFn: async (data: { 
      templateName: string; 
      templateLanguage: string; 
      templateParams?: string[]; 
      headerImageId?: string;
      headerVideoId?: string;
      to: string;
    }) => {
      if (!activeSession) {
        throw new Error('No active session');
      }

      const payload: any = {
        sessionId: activeSession.sessionId,
        to: data.to,
        templateName: data.templateName,
        templateLanguage: data.templateLanguage || 'en',
      };

      if (data.templateParams && data.templateParams.length > 0) {
        const nonEmptyParams = data.templateParams.filter(p => p && p.trim().length > 0);
        if (nonEmptyParams.length > 0) {
          payload.templateParams = nonEmptyParams;
        }
      }

      if (data.headerImageId) payload.headerImageId = data.headerImageId;
      if (data.headerVideoId) payload.headerVideoId = data.headerVideoId;

      return await apiRequest('POST', '/api/messages/send-text', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
      setTemplateDialogOpen(false);
      setSelectedTemplateId(null);
      setSelectedTemplate(null);
      setTemplateParams([]);
      setHeaderImageId(null);
      setHeaderVideoId(null);
      setHeaderFormat(null);
      setHeaderImageUrl("");
      setHeaderVideoUrl("");
      setImageUrlInput("");
      setSelectedContactForTemplate(null);
      toast({
        title: "Template sent",
        description: "Template message sent successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send template",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  // Broadcast mutation - now creates a campaign
  const broadcastMutation = useMutation({
    mutationFn: async (data: { 
      campaignName: string; 
      phoneNumbers: string[]; 
      templateId: string; 
      phoneNumberId: string; 
      templateParameters: Array<{ column?: string; fallback?: string }>;
      headerImageId?: string;
      headerImageUrl?: string;
      headerVideoId?: string;
      headerVideoUrl?: string;
      carouselCardMediaUrls?: string[];
      scheduledAt?: string;
      /** When set (e.g. after CSV import), used instead of looking up names from the in-memory contacts list */
      recipientsOverride?: Array<{ phoneNumber: string; name?: string; contactId?: string }>;
    }) => {
      // Find the selected template
      const selectedTemplate = templates.find((t: any) => (t.id || t.templateId) === data.templateId);
      if (!selectedTemplate) {
        throw new Error('Template not found');
      }

      // Find the session ID for the selected phone number
      const phoneNumber = phoneNumbersData?.phoneNumbers?.find((p: any) => p.phoneNumberId === data.phoneNumberId);
      if (!phoneNumber) {
        throw new Error('Phone number not found');
      }

      const recipients =
        data.recipientsOverride && data.recipientsOverride.length > 0
          ? data.recipientsOverride.map((r) => ({
              phoneNumber: r.phoneNumber,
              ...(r.name ? { name: r.name } : {}),
              ...(r.contactId ? { contactId: r.contactId } : {}),
            }))
          : data.phoneNumbers.map((phone) => {
              const c = contacts.find((x) => x.phoneNumber === phone);
              return {
                phoneNumber: phone,
                ...(c?.name ? { name: c.name } : {}),
                ...(c?.id ? { contactId: c.id } : {}),
              };
            });

      // Create campaign via API
      const campaignData: any = {
        name: data.campaignName,
        sessionId: phoneNumber.sessionId,
        messageTemplate: selectedTemplate.name, // Store template name
        templateId: data.templateId,
        templateLanguage: selectedTemplate.language || 'en',
        templateParameters: data.templateParameters,
        headerImageId: data.headerImageId,
        headerImageUrl: data.headerImageUrl,
        headerVideoId: data.headerVideoId,
        headerVideoUrl: data.headerVideoUrl,
        ...(data.carouselCardMediaUrls &&
          data.carouselCardMediaUrls.length > 0 && { carouselCardMediaUrls: data.carouselCardMediaUrls }),
        recipients,
      };

      // Add scheduled time if explicitly provided
      // If not provided, backend will automatically schedule for 2 minutes from now
      if (data.scheduledAt) {
        campaignData.scheduledAt = data.scheduledAt;
      }
      // Don't set status - backend will set it to 'scheduled' automatically

      const response = await apiRequest("POST", "/api/campaigns", campaignData);
      const campaign = await response.json();
      
      // Campaign is now automatically scheduled for 2 minutes from creation if no schedule was provided
      // No need to execute immediately - the scheduler will handle it
      
      return campaign;
    },
    onSuccess: (campaign) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      setBroadcastDialogOpen(false);
      toast({
        title: "Success",
        description: campaign.scheduledAt
          ? `Campaign "${campaign.name}" scheduled successfully`
          : `Campaign "${campaign.name}" scheduled for 2 minutes from now`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create campaign",
        variant: "destructive",
      });
    },
  });

  // Bulk assign tag mutation
  const bulkAssignTagMutation = useMutation({
    mutationFn: async ({ contactIds, tagId }: { contactIds: string[]; tagId: string }) => {
      const response = await apiRequest("POST", "/api/contacts/bulk/tags", { contactIds, tagId });
      return await response.json();
    },
    onSuccess: (result) => {
      if (result.successCount > 0) {
        queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
        setBulkTagDialogOpen(false);
        setSelectedContacts(new Set());
        toast({
          title: "Success",
          description: `Tags assigned to ${result.successCount} contact(s) successfully`,
        });
      } else {
        const errors = result.results?.filter((r: any) => !r.success).map((r: any) => r.error).join(', ') || 'Unknown error';
        toast({
          title: "Error",
          description: `Failed to assign tags: ${errors}`,
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      console.error('Error assigning tags:', error);
      let errorMessage = error.message || "Failed to assign tags";
      // Try to parse error message from response
      if (error.message && error.message.includes(':')) {
        try {
          const errorText = error.message.split(':')[1]?.trim();
          if (errorText) {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.message || errorJson.error || errorMessage;
          }
        } catch {
          // If parsing fails, use original message
        }
      }
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (contactIds: string[]) => {
      return apiRequest("POST", "/api/contacts/bulk/delete", { contactIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setBulkDeleteDialogOpen(false);
      setSelectedContacts(new Set());
      toast({
        title: "Success",
        description: "Contacts deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete contacts",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (contact: ManagedContact) => {
    setSelectedContact(contact);
    editContactForm.reset({
      phoneNumber: contact.phoneNumber,
      name: contact.name || "",
      email: contact.email || "",
      source: contact.source || "manual",
      customFields: contact.customFields || {},
    });
    setEditDialogOpen(true);
  };

  const handleView = (contact: ManagedContact) => {
    setSelectedContact(contact);
    setViewDialogOpen(true);
  };

  const handleEditTag = (tag: ContactTag) => {
    setSelectedTag(tag);
    editTagForm.reset({
      name: tag.name,
      color: tag.color,
    });
    setEditTagDialogOpen(true);
  };

  // Download sample CSV — header unquoted for column detection; phone column uses tab prefix so Excel keeps it as text (avoids scientific notation)
  const handleDownloadSampleCSV = () => {
    const headerRow = "Name,Phone Number,Email,Source,Tags";
    const escape = (cell: string) => `"${String(cell).replace(/"/g, '""')}"`;
    const sampleRows = [
      ["John Doe", "\t919876543210", "john.doe@example.com", "import", "Lead"],
      ["Jane Smith", "\t919987654321", "jane.smith@example.com", "website", "Lead;VIP"],
      ["Bob Johnson", "\t911234567890", "bob.johnson@example.com", "manual", ""],
    ];
    const dataCsv = sampleRows.map((row) => row.map(escape).join(",")).join("\r\n");
    const csv = "\uFEFF" + headerRow + "\r\n" + dataCsv;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "sample_contacts.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({
      title: "Sample CSV Downloaded",
      description: "Use digits with country code for Phone Number (e.g. 919876543210). In Excel, set the column to Text to avoid scientific notation.",
    });
  };

  // Import contacts mutation (source and tags come from CSV columns)
  const importContactsMutation = useMutation({
    mutationFn: async ({ file, andBroadcast }: { file: File; andBroadcast: boolean }) => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/contacts/import", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to import contacts");
      }
      
      const result = await response.json();
      return { ...result, andBroadcast };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setImportDialogOpen(false);
      setImportFile(null);
      toast({
        title: "Import Successful",
        description: `Successfully imported ${data.successCount || 0} contact(s). ${data.errorCount || 0} error(s).`,
      });
      if (data.andBroadcast) {
        if (Array.isArray(data.importedContactIds) && data.importedContactIds.length > 0) {
          setSelectedContacts(new Set(data.importedContactIds));
          setBroadcastDialogOpen(true);
        } else {
          toast({
            title: "No new contacts to broadcast",
            description: "All contacts in the file already exist. Broadcast only runs on newly imported contacts.",
            variant: "destructive",
          });
        }
      }
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import contacts",
        variant: "destructive",
      });
    },
  });

  const handleImport = () => {
    if (!importFile) {
      toast({
        title: "No File Selected",
        description: "Please select a CSV file to import",
        variant: "destructive",
      });
      return;
    }
    
    if (!importFile.name.endsWith(".csv")) {
      toast({
        title: "Invalid File Type",
        description: "Please select a CSV file",
        variant: "destructive",
      });
      return;
    }
    
    importContactsMutation.mutate({
      file: importFile,
      andBroadcast: importMode === "broadcast",
    });
  };

  const handleExport = () => {
    if (selectedContacts.size === 0) {
      toast({
        title: "No contacts selected",
        description: "Please select at least one contact to export.",
        variant: "destructive",
      });
      return;
    }

    const toExport = contacts.filter((c) => selectedContacts.has(c.id));

    const csv = [
      ["Name", "Phone Number", "Email", "Tags", "Source", "Created"].join(","),
      ...toExport.map((c) =>
        [
          c.name || "",
          c.phoneNumber,
          c.email || "",
          c.tags
            .map((tagId) => {
              const tag = tags.find((t) => t.id === tagId);
              return tag?.name || "";
            })
            .filter(Boolean)
            .join(";"),
          c.source || "",
          new Date(c.createdAt).toLocaleDateString(),
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contacts-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: `Exported ${toExport.length} contact${toExport.length === 1 ? "" : "s"}`,
    });
  };

  const toggleContactSelection = (contactId: string) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedContacts(newSelected);
  };

  const paginatedContacts = contacts;

  /** Select-all in the table header only toggles the current page (e.g. 25 rows), not the full filtered list. */
  const toggleSelectAll = () => {
    const pageIds = paginatedContacts.map((c) => c.id);
    if (pageIds.length === 0) return;
    const allOnPageSelected = pageIds.every((id) => selectedContacts.has(id));
    const next = new Set(selectedContacts);
    if (allOnPageSelected) {
      pageIds.forEach((id) => next.delete(id));
    } else {
      pageIds.forEach((id) => next.add(id));
    }
    setSelectedContacts(next);
  };

  const allOnCurrentPageSelected =
    paginatedContacts.length > 0 && paginatedContacts.every((c) => selectedContacts.has(c.id));
  const someOnCurrentPageSelected = paginatedContacts.some((c) => selectedContacts.has(c.id));

  const selectedContactsArray = Array.from(selectedContacts);
  const selectedContactsData = contacts.filter(c => selectedContacts.has(c.id));

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffInMinutes = diffMs / (1000 * 60);
      const diffInHours = diffMs / (1000 * 60 * 60);

      if (diffInHours >= 24) {
        return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      }
      if (diffInHours < 1) {
        const mins = Math.max(0, Math.floor(diffInMinutes));
        return mins <= 1 ? "1 minute ago" : `${mins} minutes ago`;
      }
      const hours = Math.floor(diffInHours);
      return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
    } catch {
      return "-";
    }
  };

  const getSource = (contact: ManagedContact) => {
    return contact.source || "-";
  };

  const getSourceLabel = (source: string | null) => contactSourceLabel(source);

  const getWABAPhoneNumber = (contact: ManagedContact) => {
    return contact.customFields?.wabaPhoneNumber || contact.customFields?.phoneNumberId || "-";
  };

  const getAssignedTo = (contact: ManagedContact) => {
    const assignedTo = contact.customFields?.assignedTo;
    if (!assignedTo) return "Not Assigned";
    // Try to find member info
    const member = members.find((m: any) => m.userId === assignedTo);
    if (member?.user) {
      // Build full name from firstName and lastName, fallback to email
      const fullName = member.user.firstName 
        ? `${member.user.firstName}${member.user.lastName ? ` ${member.user.lastName}` : ''}`
        : null;
      return fullName || member.user.email || "Unknown User";
    }
    return `User ${assignedTo.substring(0, 8)}...`;
  };

  const getAssignedAt = (contact: ManagedContact) => {
    const assignedAt = contact.customFields?.assignedAt;
    if (!assignedAt) return "-";
    try {
      return formatDate(assignedAt);
    } catch {
      return "-";
    }
  };

  return (
    <PermissionGate permission="manage_contacts.view">
    <div
      className={cn(
        "flex h-full min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden",
        skin ? "gap-3" : "gap-6 p-6",
        isAtlas && "rh-contacts-atlas",
      )}
      data-testid="page-contacts"
    >
      <div className="rh-page-hero flex shrink-0 items-start justify-between gap-4">
        <div className="contacts-page-chrome min-w-0">
          <h1 className="text-3xl font-semibold" data-testid="text-page-title">
            Contacts
          </h1>
          <p className="mt-1 text-muted-foreground">
            {isAtlas
              ? "Manage your business leads and WhatsApp audience interactions."
              : "Manage your contacts with tags and custom fields"}
          </p>
          <div className="contacts-page-meta mt-2 flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              Teams: {!currentOrganizationId ? "No organization" : !canViewTeam ? "—" : `${members.length} member(s)`}
            </span>
            <span className="flex items-center gap-1">
              <Phone className="w-3.5 h-3.5" />
              Connected: {connectedNumbers.length} WhatsApp number(s)
            </span>
          </div>
        </div>
        <div className={cn("flex flex-wrap gap-2", skin && "ml-auto justify-end pt-0.5")}>
          <Button 
            variant="outline" 
            data-testid="button-sync-from-chats" 
            onClick={() => syncFromChatsMutation.mutate()}
            disabled={syncFromChatsMutation.isPending}
            className={cn(isAtlas && "rounded-xl border-[#e5e7eb]")}
          >
            {syncFromChatsMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Sync from Chats
              </>
            )}
          </Button>
          <Button
            variant="outline"
            data-testid="button-export-contacts"
            onClick={handleExport}
            className={cn(isAtlas && "rounded-xl border-[#e5e7eb]")}
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button 
            variant="outline" 
            data-testid="button-import-contacts"
            onClick={() => {
              setImportMode("direct");
              setImportDialogOpen(true);
            }}
            className={cn(isAtlas && "rounded-xl border-[#e5e7eb]")}
          >
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
          <ContactImportWizard
            open={importDialogOpen}
            onOpenChange={(open) => {
              setImportDialogOpen(open);
              if (!open) {
                setImportFile(null);
              }
            }}
            importMode={importMode}
            onImportComplete={(importedIds, finalImportMode) => {
              queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
              if (finalImportMode === "direct" && importedIds.length > 0) {
                setSelectedContacts(new Set(importedIds));
              }
            }}
            onImportAndBroadcastRequest={(file, mappings, validCount) => {
              setPendingImportForBroadcast({ file, mappings, validCount });
              setImportDialogOpen(false);
              setImportFile(null);
              setBroadcastDialogOpen(true);
            }}
          />
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button
                data-testid="button-create-contact"
                className={cn(
                  skin ? primaryBtnClass : "bg-orange-500 hover:bg-orange-600",
                  isAtlas && "rounded-xl",
                )}
              >
                <Plus className="w-4 h-4 mr-2" />
                {isAtlas ? "Create Contact" : "Create..."}
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="dialog-create-contact" className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Contact</DialogTitle>
              </DialogHeader>
              <Form {...contactForm}>
                <form onSubmit={contactForm.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={contactForm.control}
                      name="phoneNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl>
                            <Input data-testid="input-phone" placeholder="+1234567890" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={contactForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name (Optional)</FormLabel>
                          <FormControl>
                            <Input data-testid="input-name" placeholder="John Doe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={contactForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email (Optional)</FormLabel>
                          <FormControl>
                            <Input data-testid="input-email" type="email" placeholder="john@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={contactForm.control}
                      name="source"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Source</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || "manual"}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select source" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {CONTACT_SOURCE_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  {/* Dynamic column fields from /columns */}
                  <div className="grid grid-cols-2 gap-4">
                    {[...(contactColumns || [])]
                      .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
                      .map((col: any) => (
                        <FormField
                          key={col.id}
                          control={contactForm.control}
                          name={`customFields.${col.id}` as const}
                          render={({ field }) => (
                            <FormItem className={col.type === "textarea" ? "col-span-2" : ""}>
                              <FormLabel>
                                {col.label}
                                {col.required ? " *" : ""}
                              </FormLabel>
                              <FormControl>
                                {col.type === "textarea" ? (
                                  <Textarea
                                    placeholder={`Enter ${col.label.toLowerCase()}`}
                                    value={field.value ?? ""}
                                    onChange={(e) => field.onChange(e.target.value)}
                                    rows={2}
                                  />
                                ) : col.type === "select" ? (
                                  <Select
                                    onValueChange={field.onChange}
                                    value={field.value ?? ""}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder={`Select ${col.label.toLowerCase()}`} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(Array.isArray(col.options) ? col.options : []).map((opt: string) => (
                                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : col.type === "date" ? (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                                        {field.value ? format(new Date(field.value), "PPP") : `Choose ${col.label.toLowerCase()}`}
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                      <CalendarComponent
                                        mode="single"
                                        selected={field.value ? new Date(field.value) : undefined}
                                        onSelect={(d) => field.onChange(d ? format(d, "yyyy-MM-dd") : "")}
                                        initialFocus
                                      />
                                    </PopoverContent>
                                  </Popover>
                                ) : (
                                  <Input
                                    type={col.type === "number" ? "number" : col.type === "email" ? "email" : "text"}
                                    placeholder={`Enter ${col.label.toLowerCase()}`}
                                    value={field.value ?? ""}
                                    onChange={(e) => field.onChange(e.target.value)}
                                  />
                                )}
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ))}
                  </div>
                  <DialogFooter>
                    <Button type="submit" data-testid="button-submit-create" disabled={createMutation.isPending}>
                      {createMutation.isPending ? "Creating..." : "Add Contact"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Action Bar */}
      <div
        className={cn(
          "flex shrink-0 items-center justify-between gap-3",
          isAtlas && "rh-contacts-batch-bar",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          {isAtlas && (
            <span className="rh-contacts-selected-count mr-1">
              {selectedContacts.size} item{selectedContacts.size === 1 ? "" : "s"} selected
            </span>
          )}
          <Button 
            variant="outline" 
            size="sm"
            className={cn(
              "disabled:opacity-100 disabled:pointer-events-none",
              isAtlas && "rounded-lg border-[#e5e7eb]",
            )}

            onClick={() => {
              if (selectedContacts.size === 0) {
                toast({
                  title: "No contacts selected",
                  description: "Please select at least one contact to broadcast",
                  variant: "destructive",
                });
                return;
              }
              setBroadcastDialogOpen(true);
            }}
            disabled={selectedContacts.size === 0}
          >
            <Send className="w-4 h-4 mr-2" />
            Broadcast
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            className={cn(
              "disabled:opacity-100 disabled:pointer-events-none",
              isAtlas && "rounded-lg border-[#e5e7eb]",
            )}

            onClick={() => {
              if (selectedContacts.size === 0) {
                toast({
                  title: "No contacts selected",
                  description: "Please select at least one contact to assign",
                  variant: "destructive",
                });
                return;
              }
              setAssignDialogOpen(true);
            }}
            disabled={selectedContacts.size === 0}
          >
            <UserCheck className="w-4 h-4 mr-2" />
            Assign
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className={cn(
              "disabled:opacity-100 disabled:pointer-events-none",
              isAtlas && "rounded-lg border-[#e5e7eb]",
            )}

            onClick={() => {
              if (selectedContacts.size === 0) {
                toast({
                  title: "No contacts selected",
                  description: "Please select at least one contact to assign tags",
                  variant: "destructive",
                });
                return;
              }
              setBulkTagDialogOpen(true);
            }}
            disabled={selectedContacts.size === 0}
          >
            <Tag className="w-4 h-4 mr-2" />
            Assign Tag
          </Button>
          <Button 
            variant="destructive" 
            size="sm"
            className={cn(
              "disabled:opacity-100 disabled:pointer-events-none",
              isAtlas && "rounded-lg",
            )}

            onClick={() => {
              if (selectedContacts.size === 0) {
                toast({
                  title: "No contacts selected",
                  description: "Please select at least one contact to delete",
                  variant: "destructive",
                });
                return;
              }
              setBulkDeleteDialogOpen(true);
            }}
            disabled={selectedContacts.size === 0}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>
        {!isAtlas && selectedContacts.size > 0 && (
          <div className="text-sm text-muted-foreground">
            {selectedContacts.size} of {totalContacts} row(s) selected.
          </div>
        )}
      </div>

      {/* Search and Filter Bar */}
      <div className={cn("flex shrink-0 items-center", skin || isAtlas ? "gap-3" : "gap-4")}>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            data-testid="input-search-contacts"
            placeholder={isAtlas ? "Search contacts, tags, or phone numbers..." : "Search records..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn("pl-10", isAtlas && "h-10 rounded-xl border-[#e5e7eb]")}
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => { setFilterForm({ ...appliedFilters }); setFiltersDialogOpen(true); }}>
          <Filter className="w-4 h-4 mr-2" />
          Filters
        </Button>
        <DropdownMenu open={columnsDropdownOpen} onOpenChange={setColumnsDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Columns className="w-4 h-4 mr-2" />
              Columns
              <ChevronDown className="w-4 h-4 ml-2 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 p-0" sideOffset={4}>
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search options..."
                  value={columnSearchQuery}
                  onChange={(e) => setColumnSearchQuery(e.target.value)}
                  className="pl-8 h-8"
                />
              </div>
            </div>
            <div className="p-2 border-b">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-muted-foreground h-8"
                onClick={() => {
                  setColumnOrder(withActionColumnLast(allTableColumns.map((c) => c.id)));
                  setColumnVisibility(Object.fromEntries(allTableColumns.map((c) => [c.id, true])));
                }}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reset column order
              </Button>
            </div>
            <div className="max-h-64 overflow-y-auto p-1">
              {withActionColumnLast(columnOrder)
                .map((id) => allTableColumns.find((c) => c.id === id))
                .filter(Boolean)
                .filter((col) => !columnSearchQuery.trim() || col!.label.toLowerCase().includes(columnSearchQuery.trim().toLowerCase()))
                .map((col) => (
                  <div
                    key={col!.id}
                    className="flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-muted/80 cursor-default"
                  >
                    <Checkbox
                      checked={col!.id === ACTION_COLUMN_ID || columnVisibility[col!.id] !== false}
                      disabled={col!.id === ACTION_COLUMN_ID}
                      onCheckedChange={(checked) => {
                        if (col!.id === ACTION_COLUMN_ID) return;
                        setColumnVisibility((prev) => ({ ...prev, [col!.id]: checked !== false }));
                      }}
                      className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground border-primary"
                    />
                    <span className="flex-1 text-sm truncate">{col!.label}</span>
                    <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                  </div>
                ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Filters Dialog */}
      <Dialog open={filtersDialogOpen} onOpenChange={setFiltersDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col overflow-hidden gap-0 p-0">
          <div className="shrink-0 px-6 pt-6">
            <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <DialogTitle>Filters</DialogTitle>
            </DialogHeader>
          </div>
          <div className="rh-dialog-scroll-body min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-2">
          <div className="space-y-4">
            <div>
              <Label className="text-sm text-muted-foreground">Search by Name or Phone</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or phone..."
                  value={filterForm.search ?? ""}
                  onChange={(e) => setFilterForm((f) => ({ ...f, search: e.target.value || undefined }))}
                  className="pl-9"
                />
              </div>
            </div>

            <div>
              <Label className="text-sm text-muted-foreground">Email</Label>
              <Input
                placeholder="Filter by email..."
                value={filterForm.email ?? ""}
                onChange={(e) => setFilterForm((f) => ({ ...f, email: e.target.value || undefined }))}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-muted-foreground">Created Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full mt-1 justify-start text-left font-normal">
                      <Calendar className="mr-2 h-4 w-4" />
                      {filterForm.createdDateFrom || filterForm.createdDateTo
                        ? `${filterForm.createdDateFrom ? format(new Date(filterForm.createdDateFrom), "MMM d, yyyy") : "..."} – ${filterForm.createdDateTo ? format(new Date(filterForm.createdDateTo), "MMM d, yyyy") : "..."}`
                        : "Select date range"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <div className="p-2 space-y-2">
                      <div>
                        <Label className="text-xs">From</Label>
                        <CalendarComponent
                          mode="single"
                          selected={filterForm.createdDateFrom ? new Date(filterForm.createdDateFrom) : undefined}
                          onSelect={(d) => setFilterForm((f) => ({ ...f, createdDateFrom: d ? format(d, "yyyy-MM-dd") : undefined }))}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">To</Label>
                        <CalendarComponent
                          mode="single"
                          selected={filterForm.createdDateTo ? new Date(filterForm.createdDateTo) : undefined}
                          onSelect={(d) => setFilterForm((f) => ({ ...f, createdDateTo: d ? format(d, "yyyy-MM-dd") : undefined }))}
                        />
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Reminder Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full mt-1 justify-start text-left font-normal">
                      <Calendar className="mr-2 h-4 w-4" />
                      {filterForm.reminderDateFrom || filterForm.reminderDateTo
                        ? `${filterForm.reminderDateFrom ? format(new Date(filterForm.reminderDateFrom), "MMM d, yyyy") : "..."} – ${filterForm.reminderDateTo ? format(new Date(filterForm.reminderDateTo), "MMM d, yyyy") : "..."}`
                        : "Select date range"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <div className="p-2 space-y-2">
                      <div>
                        <Label className="text-xs">From</Label>
                        <CalendarComponent
                          mode="single"
                          selected={filterForm.reminderDateFrom ? new Date(filterForm.reminderDateFrom) : undefined}
                          onSelect={(d) => setFilterForm((f) => ({ ...f, reminderDateFrom: d ? format(d, "yyyy-MM-dd") : undefined }))}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">To</Label>
                        <CalendarComponent
                          mode="single"
                          selected={filterForm.reminderDateTo ? new Date(filterForm.reminderDateTo) : undefined}
                          onSelect={(d) => setFilterForm((f) => ({ ...f, reminderDateTo: d ? format(d, "yyyy-MM-dd") : undefined }))}
                        />
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div>
              <Label className="text-sm text-muted-foreground">Assigned Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full mt-1 justify-start text-left font-normal">
                    <Calendar className="mr-2 h-4 w-4" />
                    {filterForm.assignedDateFrom || filterForm.assignedDateTo
                      ? `${filterForm.assignedDateFrom ? format(new Date(filterForm.assignedDateFrom), "MMM d, yyyy") : "..."} – ${filterForm.assignedDateTo ? format(new Date(filterForm.assignedDateTo), "MMM d, yyyy") : "..."}`
                      : "Select date range"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="p-2 space-y-2">
                    <div>
                      <Label className="text-xs">From</Label>
                      <CalendarComponent
                        mode="single"
                        selected={filterForm.assignedDateFrom ? new Date(filterForm.assignedDateFrom) : undefined}
                        onSelect={(d) => setFilterForm((f) => ({ ...f, assignedDateFrom: d ? format(d, "yyyy-MM-dd") : undefined }))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">To</Label>
                      <CalendarComponent
                        mode="single"
                        selected={filterForm.assignedDateTo ? new Date(filterForm.assignedDateTo) : undefined}
                        onSelect={(d) => setFilterForm((f) => ({ ...f, assignedDateTo: d ? format(d, "yyyy-MM-dd") : undefined }))}
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label className="text-sm text-muted-foreground">Updated Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full mt-1 justify-start text-left font-normal">
                    <Calendar className="mr-2 h-4 w-4" />
                    {filterForm.updatedDateFrom || filterForm.updatedDateTo
                      ? `${filterForm.updatedDateFrom ? format(new Date(filterForm.updatedDateFrom), "MMM d, yyyy") : "..."} – ${filterForm.updatedDateTo ? format(new Date(filterForm.updatedDateTo), "MMM d, yyyy") : "..."}`
                      : "Select date range"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="p-2 space-y-2">
                    <div>
                      <Label className="text-xs">From</Label>
                      <CalendarComponent
                        mode="single"
                        selected={filterForm.updatedDateFrom ? new Date(filterForm.updatedDateFrom) : undefined}
                        onSelect={(d) => setFilterForm((f) => ({ ...f, updatedDateFrom: d ? format(d, "yyyy-MM-dd") : undefined }))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">To</Label>
                      <CalendarComponent
                        mode="single"
                        selected={filterForm.updatedDateTo ? new Date(filterForm.updatedDateTo) : undefined}
                        onSelect={(d) => setFilterForm((f) => ({ ...f, updatedDateTo: d ? format(d, "yyyy-MM-dd") : undefined }))}
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label className="text-sm text-muted-foreground">Source</Label>
              <Select
                value={filterForm.source ?? "all"}
                onValueChange={(v) => setFilterForm((f) => ({ ...f, source: v === "all" ? undefined : v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select or type a source..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {CONTACT_SOURCE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm text-muted-foreground">Assigned To</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full mt-1 justify-start text-left font-normal">
                    <Users className="mr-2 h-4 w-4" />
                    {filterForm.assignedTo?.length
                      ? `${filterForm.assignedTo.length} user(s) selected`
                      : "Select users..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" align="start">
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {members.map((m: any) => (
                      <label key={m.userId} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={filterForm.assignedTo?.includes(m.userId) ?? false}
                          onCheckedChange={(checked) => {
                            setFilterForm((f) => ({
                              ...f,
                              assignedTo: checked
                                ? [...(f.assignedTo ?? []), m.userId]
                                : (f.assignedTo ?? []).filter((id) => id !== m.userId),
                            }));
                          }}
                        />
                        <span className="text-sm">{m.user?.firstName ?? m.user?.email ?? m.userId}</span>
                      </label>
                    ))}
                    {members.length === 0 && <p className="text-sm text-muted-foreground">No team members</p>}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label className="text-sm text-muted-foreground">Tags</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full mt-1 justify-start text-left font-normal">
                    <Tag className="mr-2 h-4 w-4" />
                    {filterForm.noTagsOnly
                      ? "Not assigned tag"
                      : filterForm.tagIds?.length
                        ? `${filterForm.tagIds.length} tag(s) selected`
                        : "Select tags..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" align="start">
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    <label className="flex items-center gap-2 cursor-pointer font-medium">
                      <Checkbox
                        checked={filterForm.noTagsOnly ?? false}
                        onCheckedChange={(checked) => {
                          setFilterForm((f) => ({
                            ...f,
                            noTagsOnly: !!checked,
                            ...(checked ? { tagIds: undefined } : {}),
                          }));
                        }}
                      />
                      <span className="text-sm">Not assigned tag</span>
                    </label>
                    <div className="border-t pt-2 mt-2 space-y-1">
                      {tags.map((t) => (
                        <label key={t.id} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={filterForm.tagIds?.includes(t.id) ?? false}
                            disabled={filterForm.noTagsOnly}
                            onCheckedChange={(checked) => {
                              setFilterForm((f) => ({
                                ...f,
                                tagIds: checked
                                  ? [...(f.tagIds ?? []), t.id]
                                  : (f.tagIds ?? []).filter((id) => id !== t.id),
                              }));
                            }}
                          />
                          <span className="text-sm" style={{ color: t.color }}>{t.name}</span>
                        </label>
                      ))}
                    </div>
                    {tags.length === 0 && <p className="text-sm text-muted-foreground">No tags</p>}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label className="text-sm text-muted-foreground">Status</Label>
              <Input
                placeholder="Filter by status..."
                value={filterForm.customFieldFilters?.status ?? ""}
                onChange={(e) =>
                  setFilterForm((f) => ({
                    ...f,
                    customFieldFilters: {
                      ...(f.customFieldFilters ?? {}),
                      status: e.target.value || undefined,
                    },
                  }))
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">WABA Phone Number</Label>
              <Input
                placeholder="Filter by WABA phone number..."
                value={filterForm.customFieldFilters?.wabaPhoneNumber ?? ""}
                onChange={(e) =>
                  setFilterForm((f) => ({
                    ...f,
                    customFieldFilters: {
                      ...(f.customFieldFilters ?? {}),
                      wabaPhoneNumber: e.target.value || undefined,
                    },
                  }))
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Bill No</Label>
              <Input
                placeholder="Filter by bill no..."
                value={filterForm.customFieldFilters?.billNo ?? ""}
                onChange={(e) =>
                  setFilterForm((f) => ({
                    ...f,
                    customFieldFilters: {
                      ...(f.customFieldFilters ?? {}),
                      billNo: e.target.value || undefined,
                    },
                  }))
                }
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-muted-foreground">Opt-In Status</Label>
                <Select
                  value={filterForm.optInStatus ?? "all"}
                  onValueChange={(v: "all" | "opted_in" | "opted_out") => setFilterForm((f) => ({ ...f, optInStatus: v }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All contacts</SelectItem>
                    <SelectItem value="opted_in">Opted in</SelectItem>
                    <SelectItem value="opted_out">Opted out</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Duplicate</Label>
                <Select
                  value={filterForm.duplicate ?? "all"}
                  onValueChange={(v: "all" | "duplicates" | "non_duplicates") => setFilterForm((f) => ({ ...f, duplicate: v }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All contacts</SelectItem>
                    <SelectItem value="duplicates">Duplicates</SelectItem>
                    <SelectItem value="non_duplicates">Non-duplicates</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label className="text-sm">Show unassigned only</Label>
              <Switch
                checked={filterForm.unassignedOnly ?? false}
                onCheckedChange={(checked) => setFilterForm((f) => ({ ...f, unassignedOnly: checked }))}
              />
            </div>

            {(contactColumns || []).length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Filter by column</Label>
                <div className="space-y-2 rounded-lg border p-3">
                  {[...(contactColumns || [])]
                    .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
                    .map((col: any) => (
                      <div key={col.id}>
                        <Label className="text-xs text-muted-foreground">{col.label}</Label>
                        <Input
                          placeholder={`Contains...`}
                          value={filterForm.customFieldFilters?.[col.id] ?? ""}
                          onChange={(e) =>
                            setFilterForm((f) => ({
                              ...f,
                              customFieldFilters: {
                                ...(f.customFieldFilters ?? {}),
                                [col.id]: e.target.value || undefined,
                              },
                            }))
                          }
                          className="mt-1"
                        />
                      </div>
                    ))}
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">Filter combined with AND</p>
          </div>
          </div>
          <DialogFooter className="shrink-0 border-t bg-background px-6 py-4 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setAppliedFilters({});
                setFilterForm({});
                setFiltersDialogOpen(false);
                setCurrentPage(1);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setAppliedFilters({ ...filterForm });
                setFiltersDialogOpen(false);
                setCurrentPage(1);
              }}
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contacts Table — only this region scrolls; column headers stay sticky */}
      <Card className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
        isAtlas && "rh-contacts-table-card",
      )}>
        <CardContent className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-0">
          {isLoading ? (
            <div className="flex flex-1 items-center justify-center py-12">
              <div
                className={cn(
                  "h-8 w-8 animate-spin rounded-full border-b-2",
                  skin ? "border-[var(--rh-brand)]" : "border-primary",
                )}
              ></div>
            </div>
          ) : totalContacts === 0 ? (
            isAtlas ? (
              <div className="rh-contacts-empty flex-1">
                <div className="rh-contacts-empty-icon">
                  <UserPlus className="h-7 w-7" />
                </div>
                <h3 className="rh-contacts-empty-title">No contacts found</h3>
                <p className="rh-contacts-empty-desc">
                  {searchQuery || (filterTag && filterTag !== "all") || Object.keys(appliedFilters).length > 0
                    ? "Try adjusting your filters to find what you're looking for."
                    : "Your contact list is currently empty. Start by importing your WhatsApp chats or creating a contact manually."}
                </p>
                {!(searchQuery || (filterTag && filterTag !== "all") || Object.keys(appliedFilters).length > 0) && (
                  <div className="rh-contacts-empty-actions">
                    <Button
                      className={cn(primaryBtnClass, "rounded-xl")}
                      onClick={() => setCreateDialogOpen(true)}
                      data-testid="button-create-first-contact"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create First Contact
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-xl border-[#e5e7eb]"
                      onClick={() => syncFromChatsMutation.mutate()}
                      disabled={syncFromChatsMutation.isPending}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Sync From Chats
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center py-12">
                <UserPlus className="w-16 h-16 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No contacts found</p>
                <p className="text-muted-foreground mt-1">
                  {searchQuery || (filterTag && filterTag !== "all") || Object.keys(appliedFilters).length > 0 ? "Try adjusting your filters" : "Add your first contact to get started"}
                </p>
              </div>
            )
          ) : (
            <div className="rh-contacts-table-scroll min-h-0 w-full min-w-0 flex-1 overflow-auto border-b [scrollbar-gutter:stable]">
              <Table className="min-w-max">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky top-0 z-20 w-12 bg-[var(--rh-brand-soft,#ecfdf5)] shadow-[0_1px_0_0_hsl(var(--border))]">
                      <Checkbox
                        checked={
                          paginatedContacts.length === 0
                            ? false
                            : allOnCurrentPageSelected
                              ? true
                              : someOnCurrentPageSelected
                                ? "indeterminate"
                                : false
                        }
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 w-12 bg-[var(--rh-brand-soft,#ecfdf5)] shadow-[0_1px_0_0_hsl(var(--border))]"></TableHead>
                    {visibleTableColumnIds.map((id) => (
                        <TableHead
                          key={id}
                          className="sticky top-0 z-20 bg-[var(--rh-brand-soft,#ecfdf5)] shadow-[0_1px_0_0_hsl(var(--border))]"
                        >
                          {allTableColumns.find((c) => c.id === id)?.label ?? id}
                        </TableHead>
                      ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedContacts.map((contact) => (
                    <TableRow 
                      key={contact.id} 
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={(e) => {
                        // Don't open details if clicking on interactive elements
                        const target = e.target as HTMLElement;
                        if (
                          target.closest('button') ||
                          target.closest('input[type="checkbox"]') ||
                          target.closest('[role="menuitem"]') ||
                          target.closest('[role="combobox"]')
                        ) {
                          return;
                        }
                        setSelectedContactForDetails(contact);
                        setContactDetailsOpen(true);
                      }}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedContacts.has(contact.id)}
                          onCheckedChange={() => toggleContactSelection(contact.id)}
                        />
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleView(contact);
                          }}
                          className="h-8 w-8 p-0"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                      {visibleTableColumnIds.map((id) => {
                          if (id === "createdAt") {
                            return (
                              <TableCell key={id} className="text-sm text-muted-foreground">
                                {formatDate(contact.createdAt)}
                              </TableCell>
                            );
                          }
                          if (id === "name") {
                            return (
                              <TableCell key={id}>
                                <div className="font-medium text-red-500">{contact.name || contact.phoneNumber}</div>
                              </TableCell>
                            );
                          }
                          if (id === "phoneNumber") {
                            return (
                              <TableCell key={id} className="text-sm">
                                {contact.phoneNumber}
                              </TableCell>
                            );
                          }
                          if (id === "source") {
                            return (
                              <TableCell key={id}>
                                {getSource(contact) !== "-" ? (
                                  <Badge variant="outline" className="text-xs">
                                    {getSourceLabel(contact.source)}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            );
                          }
                          if (id === "tags") {
                            const tagIdsToShow =
                              appliedFilters.tagIds?.length > 0
                                ? (contact.tags || []).filter((tagId) => appliedFilters.tagIds!.includes(tagId))
                                : (contact.tags || []);
                            return (
                              <TableCell key={id}>
                                <div className="flex flex-wrap gap-1">
                                  {tagIdsToShow.length > 0 ? (
                                    tagIdsToShow.map((tagId) => {
                                      const tag = tags.find((t) => t.id === tagId);
                                      return tag ? (
                                        <Badge
                                          key={tagId}
                                          variant="secondary"
                                          style={{ backgroundColor: tag.color + "20", borderColor: tag.color, color: tag.color }}
                                          className="text-xs"
                                        >
                                          {tag.name}
                                        </Badge>
                                      ) : null;
                                    })
                                  ) : (
                                    <span className="text-muted-foreground text-xs">-</span>
                                  )}
                                </div>
                              </TableCell>
                            );
                          }
                          if (id === "optIn") {
                            return (
                              <TableCell key={id}>
                                <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500">
                                  Yes
                                </Badge>
                              </TableCell>
                            );
                          }
                          if (id === "assignedAt") {
                            return (
                              <TableCell key={id} className="text-sm text-muted-foreground">
                                {getAssignedAt(contact)}
                              </TableCell>
                            );
                          }
                          if (id === "assignedTo") {
                            return (
                              <TableCell key={id}>
                                {getAssignedTo(contact) === "Not Assigned" ? (
                                  <Badge variant="outline" className="text-red-500 border-red-500">Not Assigned</Badge>
                                ) : (
                                  <Badge variant="outline">{getAssignedTo(contact)}</Badge>
                                )}
                              </TableCell>
                            );
                          }
                          if (id === "email") {
                            return (
                              <TableCell key={id} className="text-sm">
                                {contact.email || <span className="text-muted-foreground">-</span>}
                              </TableCell>
                            );
                          }
                          if (id === "status") {
                            return (
                              <TableCell key={id}>
                                <span className="text-muted-foreground">-</span>
                              </TableCell>
                            );
                          }
                          if (id === "wabaPhoneNumber") {
                            return (
                              <TableCell key={id} className="text-sm">
                                {getWABAPhoneNumber(contact) !== "-" ? (
                                  getWABAPhoneNumber(contact)
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            );
                          }
                          if (id === "billNo") {
                            return (
                              <TableCell key={id}>
                                <span className="text-muted-foreground">-</span>
                              </TableCell>
                            );
                          }
                          if (id === "action") {
                            return (
                              <TableCell key={id} onClick={(e) => e.stopPropagation()}>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                    >
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenCreateInvoice(contact);
                                      }}
                                    >
                                      <Receipt className="h-4 w-4 mr-2" />
                                      Create Invoice
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenTemplateDialog(contact);
                                      }}
                                      disabled={!isBusinessAPI}
                                    >
                                      <Send className="h-4 w-4 mr-2" />
                                      Send Template
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEdit(contact);
                                      }}
                                    >
                                      <Edit className="h-4 w-4 mr-2" />
                                      Edit
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            );
                          }
                          // Dynamic column from /columns (visible)
                          const dynamicCol = (contactColumns || []).find((c: any) => c.id === id);
                          if (dynamicCol) {
                            const val = contact.customFields?.[id];
                            return (
                              <TableCell key={id} className="text-sm">
                                {val != null && String(val).trim() !== "" ? String(val) : <span className="text-muted-foreground">-</span>}
                              </TableCell>
                            );
                          }
                          return <TableCell key={id}>-</TableCell>;
                        })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        {totalContacts > 0 && (
          <div className="shrink-0 space-y-2 border-t px-4 py-3">
            {selectedContacts.size > 0 && (
              <p className="text-sm text-muted-foreground">
                {selectedContacts.size} of {totalContacts} row(s) selected.
              </p>
            )}
            <ListPaginationFooter
              total={totalContacts}
              currentPage={currentPage}
              rowsPerPage={rowsPerPage}
              onPageChange={setCurrentPage}
              onRowsPerPageChange={setRowsPerPage}
              allowCustomPageSize={skin}
              maxCustomPageSize={CONTACTS_MAX_PAGE_SIZE}
            />
          </div>
        )}
      </Card>

      {/* View Contact Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Contact Details</DialogTitle>
          </DialogHeader>
          {selectedContact && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Name</label>
                  <p className="text-lg font-medium">{selectedContact.name || selectedContact.phoneNumber}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Phone Number</label>
                  <p className="text-lg">{selectedContact.phoneNumber}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="text-lg">{selectedContact.email || "-"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Source</label>
                  <p className="text-lg">{getSourceLabel(selectedContact.source)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Created</label>
                  <p className="text-lg">{formatDate(selectedContact.createdAt)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">WABA Phone Number</label>
                  <p className="text-lg">{getWABAPhoneNumber(selectedContact)}</p>
                </div>
              </div>
              {selectedContact.tags && selectedContact.tags.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {selectedContact.tags.map((tagId) => {
                      const tag = tags.find(t => t.id === tagId);
                      return tag ? (
                        <Badge
                          key={tagId}
                          variant="secondary"
                          style={{ backgroundColor: tag.color + "20", borderColor: tag.color, color: tag.color }}
                        >
                          {tag.name}
                        </Badge>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => handleEdit(selectedContact)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button variant="outline" onClick={() => {
                  setViewDialogOpen(false);
                  setSelectedContact(selectedContact);
                  setTagDialogOpen(true);
                }}>
                  <Tag className="w-4 h-4 mr-2" />
                  Manage Tags
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Contact Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent data-testid="dialog-edit-contact" className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
          </DialogHeader>
          <Form {...editContactForm}>
            <form onSubmit={editContactForm.handleSubmit((data) => updateMutation.mutate(data))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editContactForm.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input data-testid="input-edit-phone" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editContactForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input data-testid="input-edit-name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editContactForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input data-testid="input-edit-email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editContactForm.control}
                  name="source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || "manual"}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select source" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CONTACT_SOURCE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {/* Dynamic column fields from /columns */}
              <div className="grid grid-cols-2 gap-4">
                {[...(contactColumns || [])]
                  .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
                  .map((col: any) => (
                    <FormField
                      key={col.id}
                      control={editContactForm.control}
                      name={`customFields.${col.id}` as const}
                      render={({ field }) => (
                        <FormItem className={col.type === "textarea" ? "col-span-2" : ""}>
                          <FormLabel>
                            {col.label}
                            {col.required ? " *" : ""}
                          </FormLabel>
                          <FormControl>
                            {col.type === "textarea" ? (
                              <Textarea
                                placeholder={`Enter ${col.label.toLowerCase()}`}
                                value={field.value ?? ""}
                                onChange={(e) => field.onChange(e.target.value)}
                                rows={2}
                              />
                            ) : col.type === "select" ? (
                              <Select
                                onValueChange={field.onChange}
                                value={field.value ?? ""}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={`Select ${col.label.toLowerCase()}`} />
                                </SelectTrigger>
                                <SelectContent>
                                  {(Array.isArray(col.options) ? col.options : []).map((opt: string) => (
                                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : col.type === "date" ? (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                                    {field.value ? format(new Date(field.value), "PPP") : `Choose ${col.label.toLowerCase()}`}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <CalendarComponent
                                    mode="single"
                                    selected={field.value ? new Date(field.value) : undefined}
                                    onSelect={(d) => field.onChange(d ? format(d, "yyyy-MM-dd") : "")}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                            ) : (
                              <Input
                                type={col.type === "number" ? "number" : col.type === "email" ? "email" : "text"}
                                placeholder={`Enter ${col.label.toLowerCase()}`}
                                value={field.value ?? ""}
                                onChange={(e) => field.onChange(e.target.value)}
                              />
                            )}
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
              </div>
              <DialogFooter>
                <Button type="submit" data-testid="button-submit-edit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Contact Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-contact">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this contact? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-delete"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manage Tags Dialog */}
      <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
        <DialogContent data-testid="dialog-manage-tags" className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Tags - {selectedContact?.name || selectedContact?.phoneNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Assigned Tags</p>
              <div className="flex flex-wrap gap-2">
                {selectedContact?.tags && selectedContact.tags.length > 0 ? (
                  selectedContact.tags.map((tagId) => {
                    const tag = tags.find(t => t.id === tagId);
                    return tag ? (
                      <Badge
                        key={tagId}
                        style={{ backgroundColor: tag.color + "40" }}
                        className="cursor-pointer"
                        onClick={() => removeTagMutation.mutate({ contactId: selectedContact.id, tagId })}
                        data-testid={`badge-assigned-tag-${tagId}`}
                      >
                        {tag.name}
                        <X className="w-3 h-3 ml-1" />
                      </Badge>
                    ) : null;
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">No tags assigned</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Available Tags</p>
              <div className="flex flex-wrap gap-2">
                {tags
                  .filter(tag => !selectedContact?.tags?.includes(tag.id))
                  .map((tag) => (
                    <Badge
                      key={tag.id}
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => assignTagMutation.mutate({ contactId: selectedContact!.id, tagId: tag.id })}
                      data-testid={`badge-available-tag-${tag.id}`}
                    >
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                        {tag.name}
                      </div>
                    </Badge>
                  ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Broadcast Dialog */}
      <Dialog open={broadcastDialogOpen} onOpenChange={(open) => {
        setBroadcastDialogOpen(open);
        if (!open) {
          setPendingImportForBroadcast(null);
          setSelectedPhoneNumberId("");
          setSelectedTemplateId("");
          setTemplateParameters([]);
          setHeaderImageUrl("");
          setHeaderImageId(null);
          setHeaderVideoUrl("");
          setHeaderVideoId(null);
          setBroadcastCarouselCardMediaUrls([]);
          setGalleryCarouselCardIndex(null);
          setBroadcastCarouselPreviewIndex(0);
          setScheduleBroadcast(false);
          setScheduleDate(undefined);
          setScheduleTime("");
        }
      }}>
        <DialogContent className="flex h-[min(90vh,95dvh)] max-h-[95dvh] min-h-0 w-full max-w-6xl flex-col gap-0 overflow-hidden p-0">
          <div className="shrink-0 px-6 pt-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Send className="w-5 h-5" />
                Broadcast to {pendingImportForBroadcast ? pendingImportForBroadcast.validCount : selectedContacts.size} contact{(pendingImportForBroadcast ? pendingImportForBroadcast.validCount : selectedContacts.size) !== 1 ? 's' : ''}
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                {pendingImportForBroadcast
                  ? `Send a WhatsApp message to ${pendingImportForBroadcast.validCount} contact${pendingImportForBroadcast.validCount !== 1 ? 's' : ''} (to be imported from CSV).`
                  : `Send a WhatsApp message to ${selectedContacts.size} selected contact${selectedContacts.size !== 1 ? 's' : ''}`}
              </p>
            </DialogHeader>
          </div>
          <div className="rh-dialog-scroll-body min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
          <div className="grid grid-cols-2 gap-6">
            {/* Left Column - Form Fields */}
            <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Campaign Name</label>
              <Input placeholder="Enter campaign name" id="campaign-name" />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">WhatsApp Business Number</label>
              <Select value={selectedPhoneNumberId} onValueChange={(value) => {
                setSelectedPhoneNumberId(value);
                setSelectedTemplateId(""); // Reset template when phone number changes
                setTemplateParameters([]);
                setHeaderImageUrl("");
                setHeaderVideoUrl("");
                setHeaderImageId(null);
                setHeaderVideoId(null);
                setBroadcastCarouselCardMediaUrls([]);
                setGalleryCarouselCardIndex(null);
                setBroadcastCarouselPreviewIndex(0);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select WhatsApp Business Number" />
                </SelectTrigger>
                <SelectContent>
                  {phoneNumbersData?.phoneNumbers && phoneNumbersData.phoneNumbers.length > 0 ? (
                    phoneNumbersData.phoneNumbers.map((phone: any) => (
                      <SelectItem key={phone.phoneNumberId} value={phone.phoneNumberId}>
                        {phone.displayPhoneNumber} {phone.verifiedName ? `(${phone.verifiedName})` : ''}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-2 text-sm text-muted-foreground">No phone numbers available</div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Message Template</label>
              <Select value={selectedTemplateId} onValueChange={(templateId) => {
                setSelectedTemplateId(templateId);
                setBroadcastCarouselPreviewIndex(0);
                setGalleryCarouselCardIndex(null);
                const template = templates.find((t: any) => (t.id || t.templateId) === templateId);
                if (template) {
                  const tmplMeta = template?.metaData || template?.metadata || {};
                  const mcs = Array.isArray(tmplMeta.mediaCards) ? tmplMeta.mediaCards : [];
                  if (tmplMeta.interactiveAction === 'MEDIA_CARD_CAROUSEL' && mcs.length > 0) {
                    setBroadcastCarouselCardMediaUrls(Array.from({ length: mcs.length }, () => null));
                  } else {
                    setBroadcastCarouselCardMediaUrls([]);
                  }
                  const vars = extractTemplateVariables(template);
                  setTemplateParameters(vars.map(() => ({ column: '', fallback: '' })));
                } else {
                  setTemplateParameters([]);
                  setBroadcastCarouselCardMediaUrls([]);
                }
              }} disabled={!selectedPhoneNumberId}>
                <SelectTrigger>
                  <SelectValue placeholder={selectedPhoneNumberId ? "Select a template" : "Select phone number first"} />
                </SelectTrigger>
                <SelectContent>
                  {templates.length > 0 ? (
                    templates
                      .filter((template: any) => template.status === 'APPROVED' || template.status === 'approved')
                      .map((template: any) => (
                        <SelectItem key={template.id || template.templateId} value={template.id || template.templateId}>
                          {template.name} ({template.category || 'N/A'})
                        </SelectItem>
                      ))
                  ) : (
                    <div className="p-2 text-sm text-muted-foreground">
                      {selectedPhoneNumberId ? "No templates available" : "Select phone number first"}
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Dynamic Parameters */}
            {selectedTemplateId && templateParameters.length > 0 && (
              <div className="space-y-3">
                <label className="text-sm font-medium block">Template Parameters</label>
                {templateParameters.map((param, index) => {
                  const varNum = index + 1;
                  return (
                    <div key={index} className="space-y-2 border rounded-lg p-3">
                      <label className="text-sm font-medium">Parameter {varNum}</label>
                      <div className="space-y-2">
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Select Column</label>
                          <Select
                            value={param.column || ''}
                            onValueChange={(value) => {
                              const newParams = [...templateParameters];
                              newParams[index] = { ...newParams[index], column: value };
                              setTemplateParameters(newParams);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select column" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="name">Name</SelectItem>
                              <SelectItem value="phoneNumber">Phone Number</SelectItem>
                              <SelectItem value="email">Email</SelectItem>
                              {contactColumns.map((col: any) => (
                                <SelectItem key={col.id} value={`customFields.${col.label}`}>
                                  {col.label} (Custom Field)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Fallback value (optional)</label>
                          <Input
                            placeholder="Enter fallback value"
                            value={param.fallback || ''}
                            maxLength={WHATSAPP_TEMPLATE_PARAM_MAX_CHARS}
                            onChange={(e) => {
                              const newParams = [...templateParameters];
                              newParams[index] = {
                                ...newParams[index],
                                fallback: e.target.value.replace(/\r\n|\r|\n/g, " "),
                              };
                              setTemplateParameters(newParams);
                            }}
                          />
                          {/* Show preview of what will be used */}
                          {param.fallback ? (
                            <p className="text-xs text-muted-foreground mt-1">
                              Fallback value: <span className="font-medium">{param.fallback}</span>
                            </p>
                          ) : param.column ? (
                            <p className="text-xs text-muted-foreground mt-1">
                              Will use value from: <span className="font-medium">{param.column === 'name' ? 'Name' : param.column === 'phoneNumber' ? 'Phone Number' : param.column === 'email' ? 'Email' : param.column.replace('customFields.', '')}</span>
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Media card carousel — one image/video per card (send-time URLs, same as chat) */}
            {selectedTemplateId &&
              (() => {
                const template = templates.find((t: any) => (t.id || t.templateId) === selectedTemplateId);
                const stMeta = template?.metaData || template?.metadata || {};
                const carCards = Array.isArray(stMeta.mediaCards) ? stMeta.mediaCards : [];
                if (stMeta.interactiveAction !== "MEDIA_CARD_CAROUSEL" || carCards.length === 0) {
                  return null;
                }
                const phoneNumber = phoneNumbersData?.phoneNumbers?.find((p: any) => p.phoneNumberId === selectedPhoneNumberId);
                return (
                  <div className="space-y-3 border rounded-lg p-4 bg-muted/20">
                    <div>
                      <label className="text-sm font-medium block">Carousel media</label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Required: one {carCards.some((c: any) => c.mediaType === "VIDEO") ? "image or video" : "image"} per
                        card. WhatsApp uses these files when the message is sent (not only the template draft media).
                      </p>
                    </div>
                    <div className="space-y-2 max-h-[220px] overflow-y-auto">
                      {carCards.map((card: any, idx: number) => (
                        <div key={`bcar-${idx}`} className="flex flex-col gap-2 border rounded-md p-3 bg-background">
                          <span className="text-xs font-medium">
                            Card {idx + 1} · {card.mediaType === "VIDEO" ? "Video" : "Image"}
                          </span>
                          {broadcastCarouselCardMediaUrls[idx] ? (
                            <p
                              className="text-xs text-muted-foreground truncate"
                              title={broadcastCarouselCardMediaUrls[idx] || ""}
                            >
                              {String(broadcastCarouselCardMediaUrls[idx]).length > 56
                                ? `${String(broadcastCarouselCardMediaUrls[idx]).slice(0, 56)}…`
                                : broadcastCarouselCardMediaUrls[idx]}
                            </p>
                          ) : (
                            <p className="text-xs text-amber-700 dark:text-amber-500">No file selected</p>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full sm:w-auto"
                            onClick={() => {
                              setGalleryCarouselCardIndex(idx);
                              setGalleryFileType(card.mediaType === "VIDEO" ? "video" : "image");
                              setGalleryViewMode("gallery");
                              setGalleryDialogOpen(true);
                            }}
                            disabled={!phoneNumber}
                          >
                            {card.mediaType === "VIDEO" ? (
                              <Video className="w-4 h-4 mr-2" />
                            ) : (
                              <ImageIcon className="w-4 h-4 mr-2" />
                            )}
                            Select from gallery
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

            {/* Media URL (if template has IMAGE or VIDEO header) */}
            {selectedTemplateId && (() => {
              const template = templates.find((t: any) => (t.id || t.templateId) === selectedTemplateId);
              const headerComponent = template?.components?.find((c: any) => c.type === 'HEADER' && (c.format === 'IMAGE' || c.format === 'VIDEO'));
              const phoneNumber = phoneNumbersData?.phoneNumbers?.find((p: any) => p.phoneNumberId === selectedPhoneNumberId);
              const isVideoHeader = headerComponent?.format === 'VIDEO';
              
              return headerComponent ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium block">Media URL</label>
                  
                  {/* From Gallery */}
                  <div className="space-y-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => setGalleryDialogOpen(true)}
                      disabled={uploadMediaMutation.isPending}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Select media
                      <span className="ml-2 text-xs text-orange-500">Recommended</span>
                    </Button>
                    
                    <div className="text-xs text-muted-foreground text-center">OR</div>
                    
                    {/* Enter URL */}
                    <div className="space-y-2">
                      <Input
                        placeholder="Enter media URL (image or video, https://...)"
                        value={imageUrlInput}
                        onChange={(e) => setImageUrlInput(e.target.value)}
                        disabled={uploadMediaMutation.isPending}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={async () => {
                          if (imageUrlInput && phoneNumber) {
                            try {
                              const response = await fetch(imageUrlInput);
                              if (!response.ok) {
                                throw new Error('Failed to fetch media from URL');
                              }
                              const blob = await response.blob();
                              const isVideo = blob.type.startsWith('video/');
                              const isImage = blob.type.startsWith('image/');
                              if (isVideoHeader && !isVideo) {
                                toast({
                                  title: "Invalid media",
                                  description: "This template requires a video. Please use a video URL.",
                                  variant: "destructive",
                                });
                                return;
                              }
                              if (!isVideoHeader && !isImage) {
                                toast({
                                  title: "Invalid media",
                                  description: "This template requires an image. Please use an image URL.",
                                  variant: "destructive",
                                });
                                return;
                              }
                              const fileName = imageUrlInput.split('/').pop() || (isVideo ? 'video.mp4' : 'image.jpg');
                              const file = new (window as any).File([blob], fileName, { type: blob.type });
                              if (isVideoHeader) {
                                setHeaderVideoUrl(imageUrlInput);
                                uploadMediaMutation.mutate({
                                  sessionId: phoneNumber.sessionId,
                                  file,
                                  mediaType: 'video',
                                });
                              } else {
                                setHeaderImageUrl(imageUrlInput);
                                uploadMediaMutation.mutate({
                                  sessionId: phoneNumber.sessionId,
                                  file,
                                  mediaType: 'image',
                                });
                              }
                              setImageUrlInput('');
                            } catch (error: any) {
                              toast({
                                title: "Error",
                                description: error.message || "Failed to process media URL",
                                variant: "destructive",
                              });
                            }
                          }
                        }}
                        disabled={!imageUrlInput || !phoneNumber || uploadMediaMutation.isPending}
                      >
                        {uploadMediaMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            Upload from URL
                          </>
                        )}
                      </Button>
                    </div>
                    
                    {/* Preview */}
                    {(headerImageUrl || headerVideoUrl) && (
                      <div className="mt-2 p-2 border rounded">
                        {headerVideoUrl ? (
                          <>
                            <video src={headerVideoUrl} controls className="max-w-full max-h-32 rounded" />
                            {headerVideoId && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Media ID: {headerVideoId.substring(0, 20)}...
                              </p>
                            )}
                          </>
                        ) : (
                          <>
                            <img src={headerImageUrl} alt="Header preview" className="max-w-full max-h-32 rounded" />
                            {headerImageId && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Media ID: {headerImageId.substring(0, 20)}...
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : null;
            })()}
            <div>
              <label className="text-sm font-medium mb-2 block">Recipients</label>
              <Input 
                value={pendingImportForBroadcast 
                  ? `${pendingImportForBroadcast.validCount} contact${pendingImportForBroadcast.validCount !== 1 ? 's' : ''} (to be imported from CSV)` 
                  : selectedContactsData.map(c => c.phoneNumber).join(', ')} 
                readOnly 
                className="bg-muted"
              />
            </div>
            </div>
            
            {/* Right Column - Preview */}
            <div className="space-y-4">
            <div className="border rounded-lg p-4 bg-muted/50 min-h-[200px]">
              <p className="text-sm font-medium mb-3">Preview</p>
              {selectedTemplateId ? (
                (() => {
                  const selectedTemplate = templates.find((t: any) => (t.id || t.templateId) === selectedTemplateId);
                  
                  if (!selectedTemplate) {
                    return <p className="text-muted-foreground">Template not found</p>;
                  }

                  const headerComponent = selectedTemplate.components?.find((c: any) => c.type === 'HEADER');
                  const bodyComponent = selectedTemplate.components?.find((c: any) => c.type === 'BODY');
                  const footerComponent = selectedTemplate.components?.find((c: any) => c.type === 'FOOTER');
                  const buttonComponents = selectedTemplate.components?.filter((c: any) => c.type === 'BUTTONS') || [];
                  const templateMetaBr = selectedTemplate.metaData || selectedTemplate.metadata || {};
                  const mediaCardsBr = Array.isArray(templateMetaBr.mediaCards) ? templateMetaBr.mediaCards : [];
                  const isMediaCarouselBr =
                    templateMetaBr.interactiveAction === "MEDIA_CARD_CAROUSEL" && mediaCardsBr.length > 0;

                  // Get preview text with replaced parameters (without contact data - use only fallback values)
                  const previewText = getPreviewText(selectedTemplate, templateParameters, undefined);

                  return (
                    <div className="bg-[#e5ddd5] rounded-lg p-4 flex-1 min-h-[400px] overflow-y-auto" style={{ backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.05) 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
                      <div className="bg-white rounded-lg shadow-md p-4 max-w-[85%] ml-0 mb-4" style={{ borderRadius: '7.5px 7.5px 7.5px 0' }}>
                        {/* Header Image or Video (hidden for media carousel — cards carry media) */}
                        {!isMediaCarouselBr && (headerComponent?.format === 'IMAGE' || headerComponent?.format === 'VIDEO') && (
                          <div className="relative w-full rounded-lg overflow-hidden -mx-4 -mt-4 mb-2" style={{ maxHeight: '300px' }}>
                            {headerComponent?.format === 'VIDEO' && (headerVideoUrl || headerVideoId) ? (
                              headerVideoUrl ? (
                                <video src={headerVideoUrl} controls className="w-full h-auto object-cover" />
                              ) : (
                                <div className="bg-gray-200 rounded-lg p-8 text-center text-xs text-gray-500">
                                  <span>[Video]</span>
                                </div>
                              )
                            ) : headerComponent?.format === 'IMAGE' && (headerImageUrl || headerImageId) ? (
                              headerImageUrl ? (
                                <img src={headerImageUrl} alt="Header" className="w-full h-auto object-cover" onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }} />
                              ) : (
                                <div className="bg-gray-200 rounded-lg p-8 text-center text-xs text-gray-500">
                                  <span>[Image]</span>
                                </div>
                              )
                            ) : (
                              <div className="bg-gray-200 rounded-lg p-8 text-center text-xs text-gray-500">
                                <span>{headerComponent?.format === 'VIDEO' ? '[Video]' : '[Image]'}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Body Text */}
                        {previewText && (
                          <p className="text-sm text-[#303030] leading-relaxed whitespace-pre-wrap break-words">
                            {previewText.split('\n').map((line, i) => (
                              <span key={i}>
                                {line}
                                {i < previewText.split('\n').length - 1 && <br />}
                              </span>
                            ))}
                          </p>
                        )}

                        {/* Carousel cards + per-card buttons (preview) */}
                        {isMediaCarouselBr &&
                          (() => {
                            const currentCard = mediaCardsBr[broadcastCarouselPreviewIndex];
                            if (!currentCard) return null;
                            const selectedCarouselUrl =
                              broadcastCarouselCardMediaUrls[broadcastCarouselPreviewIndex];
                            const cardMediaPreview =
                              typeof selectedCarouselUrl === "string" && selectedCarouselUrl.trim()
                                ? selectedCarouselUrl.trim()
                                : null;
                            return (
                              <div className="mb-2 mt-3">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-xs text-[#667781]">
                                    Carousel · {mediaCardsBr.length} card{mediaCardsBr.length > 1 ? "s" : ""}
                                  </p>
                                  {mediaCardsBr.length > 1 && (
                                    <div className="flex items-center gap-2">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-7 w-7 p-0"
                                        onClick={() =>
                                          setBroadcastCarouselPreviewIndex((p) => Math.max(0, p - 1))
                                        }
                                        disabled={broadcastCarouselPreviewIndex === 0}
                                      >
                                        <ChevronLeft className="h-4 w-4" />
                                      </Button>
                                      <span className="text-xs text-muted-foreground">
                                        {broadcastCarouselPreviewIndex + 1}/{mediaCardsBr.length}
                                      </span>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-7 w-7 p-0"
                                        onClick={() =>
                                          setBroadcastCarouselPreviewIndex((p) =>
                                            Math.min(mediaCardsBr.length - 1, p + 1)
                                          )
                                        }
                                        disabled={broadcastCarouselPreviewIndex === mediaCardsBr.length - 1}
                                      >
                                        <ChevronRight className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                                <div className="border rounded-lg p-3 bg-gray-50">
                                  {currentCard.mediaType === "IMAGE" && cardMediaPreview ? (
                                    <img
                                      src={cardMediaPreview}
                                      alt={`Card ${broadcastCarouselPreviewIndex + 1}`}
                                      className="w-full h-40 object-cover rounded mb-2"
                                    />
                                  ) : currentCard.mediaType === "IMAGE" ? (
                                    <div className="w-full min-h-[140px] rounded-lg bg-gray-200 flex items-center justify-center text-sm text-sky-500 mb-2">
                                      [Image]
                                    </div>
                                  ) : null}
                                  {currentCard.mediaType === "VIDEO" && cardMediaPreview ? (
                                    <video
                                      src={cardMediaPreview}
                                      controls
                                      className="w-full max-h-40 object-cover rounded mb-2 bg-black"
                                    />
                                  ) : currentCard.mediaType === "VIDEO" && !cardMediaPreview ? (
                                    <div className="w-full min-h-[140px] rounded-lg bg-gray-200 flex items-center justify-center text-sm text-sky-500 mb-2">
                                      [Video]
                                    </div>
                                  ) : null}
                                  {currentCard.bodyText && (
                                    <p className="text-sm text-gray-700 mb-2 whitespace-pre-wrap">
                                      {currentCard.bodyText}
                                    </p>
                                  )}
                                  {Array.isArray(currentCard.buttons) && currentCard.buttons.length > 0 && (
                                    <div className="space-y-1">
                                      {currentCard.buttons.map((button: any, index: number) => (
                                        <button
                                          key={index}
                                          type="button"
                                          className="w-full text-left px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs text-gray-700"
                                        >
                                          {button.text || `Button ${index + 1}`}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })()}

                        {/* Footer */}
                        {!isMediaCarouselBr && footerComponent?.text && (
                          <p className="text-xs text-[#667781] text-center mt-2 pt-2 border-t border-[#667781]/20">
                            {footerComponent.text}
                          </p>
                        )}

                        {/* Buttons (template-level; carousel uses per-card buttons above) */}
                        {!isMediaCarouselBr && buttonComponents.length > 0 && (
                          <div className="mt-4 space-y-2 border-t border-gray-200 pt-4">
                            {buttonComponents.map((buttonGroup: any, idx: number) => {
                              if (buttonGroup.buttons) {
                                return buttonGroup.buttons.map((btn: any, btnIdx: number) => {
                                  if (btn.type === 'QUICK_REPLY') {
                                    return (
                                      <button
                                        key={`${idx}-${btnIdx}`}
                                        className="w-full text-left px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm text-gray-700 transition-colors"
                                      >
                                        {btn.text}
                                      </button>
                                    );
                                  } else if (btn.type === 'PHONE_NUMBER') {
                                    return (
                                      <button
                                        key={`${idx}-${btnIdx}`}
                                        className="w-full text-left px-3 py-2 bg-[#25D366] hover:bg-[#20BA5A] text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
                                      >
                                        <Phone className="h-4 w-4" />
                                        {btn.text || 'Call Now'}
                                      </button>
                                    );
                                  } else if (btn.type === 'URL') {
                                    return (
                                      <button
                                        key={`${idx}-${btnIdx}`}
                                        className="w-full text-left px-3 py-2 bg-[#25D366] hover:bg-[#20BA5A] text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
                                      >
                                        <Link2 className="h-4 w-4" />
                                        {btn.text}
                                      </button>
                                    );
                                  }
                                  return null;
                                });
                              }
                              return null;
                            })}
                          </div>
                        )}

                        {/* Timestamp and read receipt */}
                        <div className="flex justify-end mt-2">
                          <span className="text-xs text-[#667781]">{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                          <svg className="w-4 h-4 ml-1 text-[#53bdeb]" fill="currentColor" viewBox="0 0 16 15">
                            <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.174.532.074l6.275-3.577a.444.444 0 0 0 .19-.631l-.494-.762a.302.302 0 0 0-.338-.15zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.174.532.074l6.275-3.577a.444.444 0 0 0 .19-.631l-.494-.762a.302.302 0 0 0-.338-.15z"/>
                          </svg>
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <p className="text-muted-foreground">Select a template to preview</p>
              )}
            </div>
            </div>
          </div>
          </div>

          <div className="shrink-0 space-y-4 border-t bg-background px-6 py-4">
          {/* Schedule Section - Full Width */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-2">
             <Switch
  checked={scheduleBroadcast}
  onCheckedChange={setScheduleBroadcast}
  className="
    data-[state=unchecked]:bg-white
    data-[state=unchecked]:ring-1
    data-[state=unchecked]:ring-black/20
    data-[state=checked]:bg-primary
    [&>span]:bg-black
    [&>span]:shadow-md
  "
/>

              <label className="text-sm font-medium">Schedule Broadcast</label>
            </div>
            <p className="text-xs text-muted-foreground">Choose when to send this broadcast</p>
          </div>
          {scheduleBroadcast && (
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Schedule Date & Time</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <Calendar className="mr-2 h-4 w-4" />
                      {scheduleDate ? format(scheduleDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={scheduleDate}
                      onSelect={setScheduleDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Time</label>
                <Input 
                  type="time" 
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                />
              </div>
            </div>
          )}
          </div>
          <DialogFooter className="shrink-0 border-t bg-background px-6 py-4 sm:flex-row sm:justify-end sm:space-x-2">
              <Button variant="outline" onClick={() => setBroadcastDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                className="bg-primary"
                onClick={async () => {
                  const campaignName = (document.getElementById('campaign-name') as HTMLInputElement)?.value || '';
                  if (!selectedPhoneNumberId) {
                    toast({ title: "Error", description: "Please select a WhatsApp Business Number", variant: "destructive" });
                    return;
                  }
                  if (!selectedTemplateId) {
                    toast({ title: "Error", description: "Please select a message template", variant: "destructive" });
                    return;
                  }
                  const template = templates.find((t: any) => (t.id || t.templateId) === selectedTemplateId);
                  const tmplMetaBc = template?.metaData || template?.metadata || {};
                  const carCardsBc = Array.isArray(tmplMetaBc.mediaCards) ? tmplMetaBc.mediaCards : [];
                  if (
                    tmplMetaBc.interactiveAction === "MEDIA_CARD_CAROUSEL" &&
                    carCardsBc.length >= 2 &&
                    (broadcastCarouselCardMediaUrls.length !== carCardsBc.length ||
                      broadcastCarouselCardMediaUrls.some((u) => !String(u ?? "").trim()))
                  ) {
                    toast({
                      title: "Carousel media required",
                      description: `Select media for all ${carCardsBc.length} carousel cards before broadcasting.`,
                      variant: "destructive",
                    });
                    return;
                  }
                  const carouselPayload =
                    tmplMetaBc.interactiveAction === "MEDIA_CARD_CAROUSEL" && carCardsBc.length >= 2
                      ? (broadcastCarouselCardMediaUrls.map((u) => String(u!).trim()) as string[])
                      : undefined;
                  const headerComponent = template?.components?.find((c: any) => c.type === 'HEADER' && (c.format === 'IMAGE' || c.format === 'VIDEO'));
                  if (headerComponent) {
                    const isVideoHeader = headerComponent.format === 'VIDEO';
                    const hasMedia = isVideoHeader ? (headerVideoId || headerVideoUrl) : (headerImageId || headerImageUrl);
                    if (!hasMedia) {
                      toast({
                        title: isVideoHeader ? "Video required" : "Image required",
                        description: isVideoHeader ? "This template requires a video header. Please upload a video first." : "This template requires an image header. Please upload an image first.",
                        variant: "destructive",
                      });
                      return;
                    }
                  }
                  let scheduledAt: string | undefined;
                  if (scheduleBroadcast && scheduleDate && scheduleTime) {
                    const [hours, minutes] = scheduleTime.split(':');
                    const wall = new Date(
                      scheduleDate.getFullYear(),
                      scheduleDate.getMonth(),
                      scheduleDate.getDate(),
                      parseInt(hours, 10) || 0,
                      parseInt(minutes, 10) || 0,
                      0,
                      0
                    );
                    scheduledAt = fromAppZonedTime(wall, DEFAULT_TIMEZONE).toISOString();
                  }

                  if (pendingImportForBroadcast) {
                    setImportAndBroadcastPending(true);
                    try {
                      const formData = new FormData();
                      formData.append('file', pendingImportForBroadcast.file);
                      formData.append('mappings', JSON.stringify(pendingImportForBroadcast.mappings));
                      const res = await fetch('/api/contacts/import/final', { method: 'POST', body: formData, credentials: 'include' });
                      if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        throw new Error(err.error || res.statusText);
                      }
                      const data = await res.json();
                      const phoneNumbers: string[] = data.processedPhoneNumbers ?? [];
                      const processedContacts: Array<{ id: string; phoneNumber: string; name: string }> =
                        Array.isArray(data.processedContacts) ? data.processedContacts : [];
                      const recipientsOverride =
                        processedContacts.length > 0
                          ? processedContacts.map((c) => ({
                              phoneNumber: c.phoneNumber,
                              name: c.name,
                              contactId: c.id,
                            }))
                          : phoneNumbers.map((phone) => ({ phoneNumber: phone }));
                      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
                      broadcastMutation.mutate({
                        campaignName,
                        phoneNumbers,
                        templateId: selectedTemplateId,
                        phoneNumberId: selectedPhoneNumberId,
                        templateParameters,
                        headerImageId: headerImageId || undefined,
                        headerImageUrl: headerImageUrl || undefined,
                        headerVideoId: headerVideoId || undefined,
                        headerVideoUrl: headerVideoUrl || undefined,
                        carouselCardMediaUrls: carouselPayload,
                        scheduledAt,
                        recipientsOverride,
                      }, {
                        onSettled: () => setImportAndBroadcastPending(false),
                        onSuccess: () => setPendingImportForBroadcast(null),
                      });
                    } catch (e: any) {
                      toast({ title: "Error", description: e?.message || "Import failed", variant: "destructive" });
                      setImportAndBroadcastPending(false);
                    }
                    return;
                  }

                  const phoneNumbers = selectedContactsData.map(c => c.phoneNumber);
                  broadcastMutation.mutate({
                    campaignName,
                    phoneNumbers,
                    templateId: selectedTemplateId,
                    phoneNumberId: selectedPhoneNumberId,
                    templateParameters,
                    headerImageId: headerImageId || undefined,
                    headerImageUrl: headerImageUrl || undefined,
                    headerVideoId: headerVideoId || undefined,
                    headerVideoUrl: headerVideoUrl || undefined,
                    carouselCardMediaUrls: carouselPayload,
                    scheduledAt,
                  });
                }}
                disabled={broadcastMutation.isPending || importAndBroadcastPending}
              >
                <Send className="w-4 h-4 mr-2" />
                {pendingImportForBroadcast
                  ? (importAndBroadcastPending ? "Importing..." : "Import and Broadcast")
                  : (broadcastMutation.isPending ? "Sending..." : "Broadcast")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Gallery Dialog */}
        <Dialog open={galleryDialogOpen} onOpenChange={setGalleryDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <File className="w-5 h-5" />
                Select File
              </DialogTitle>
            </DialogHeader>
            
            {/* Gallery View Mode Tabs */}
            <div className="flex gap-2 border-b pb-2">
              <Button
                variant={galleryViewMode === "gallery" ? "default" : "ghost"}
                size="sm"
                onClick={() => setGalleryViewMode("gallery")}
                className="flex items-center gap-2"
              >
                <ImageIcon className="w-4 h-4" />
                My Gallery
              </Button>
              <Button
                variant={galleryViewMode === "url" ? "default" : "ghost"}
                size="sm"
                onClick={() => setGalleryViewMode("url")}
                className="flex items-center gap-2"
              >
                <Link2 className="w-4 h-4" />
                Enter URL
              </Button>
            </div>

            {galleryViewMode === "gallery" ? (
              <div className="space-y-4">
                {/* File Type Filters */}
                <div className="flex gap-2 border-b pb-2">
                  <Button
                    variant={galleryFileType === "all" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setGalleryFileType("all")}
                  >
                    All
                  </Button>
                  <Button
                    variant={galleryFileType === "image" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setGalleryFileType("image")}
                    className="flex items-center gap-2"
                  >
                    <ImageIcon className="w-4 h-4" />
                    Photos
                  </Button>
                  <Button
                    variant={galleryFileType === "video" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setGalleryFileType("video")}
                    className="flex items-center gap-2"
                  >
                    <Video className="w-4 h-4" />
                    Videos
                  </Button>
                  <Button
                    variant={galleryFileType === "audio" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setGalleryFileType("audio")}
                    className="flex items-center gap-2"
                  >
                    <Music className="w-4 h-4" />
                    Audio
                  </Button>
                  <Button
                    variant={galleryFileType === "document" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setGalleryFileType("document")}
                    className="flex items-center gap-2"
                  >
                    <File className="w-4 h-4" />
                    Documents
                  </Button>
                </div>

                {/* Add Files Button */}
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = galleryFileType === "all" ? "*/*" : 
                        galleryFileType === "image" ? "image/*" :
                        galleryFileType === "video" ? "video/*" :
                        galleryFileType === "audio" ? "audio/*" : "*";
                      input.multiple = true;
                      input.onchange = async (e) => {
                        const files = (e.target as HTMLInputElement).files;
                        if (files && files.length > 0) {
                          await uploadGalleryFiles(files, { toast, queryClient });
                        }
                      };
                      input.click();
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Files
                  </Button>
                </div>

                {/* Gallery Grid */}
                <GalleryGrid 
                  fileType={galleryFileType}
                  selectedPhoneNumberId={selectedPhoneNumberId}
                  onSelect={async (url, itemType) => {
                    const phoneNumber = phoneNumbersData?.phoneNumbers?.find((p: any) => p.phoneNumberId === selectedPhoneNumberId);
                    const template = selectedTemplateId ? templates.find((t: any) => (t.id || t.templateId) === selectedTemplateId) : null;

                    if (broadcastDialogOpen && galleryCarouselCardIndex !== null && template) {
                      const meta = template.metaData || template.metadata || {};
                      const carCs = Array.isArray(meta.mediaCards) ? meta.mediaCards : [];
                      const cardIdx = galleryCarouselCardIndex;
                      const expectVideo = carCs[cardIdx]?.mediaType === "VIDEO";
                      const expectImage = carCs[cardIdx]?.mediaType === "IMAGE";
                      const typeOk =
                        (expectImage && itemType === "image") || (expectVideo && itemType === "video");
                      if (!typeOk) {
                        toast({
                          title: "Wrong media type",
                          description: `Card ${cardIdx + 1} requires ${expectVideo ? "a video" : "an image"}.`,
                          variant: "destructive",
                        });
                        return;
                      }
                      setBroadcastCarouselCardMediaUrls((prev) => {
                        const next = [...prev];
                        next[cardIdx] = url;
                        return next;
                      });
                      setGalleryDialogOpen(false);
                      setGalleryCarouselCardIndex(null);
                      return;
                    }

                    setGalleryDialogOpen(false);
                    const headerComp = template?.components?.find((c: any) => c.type === 'HEADER' && (c.format === 'IMAGE' || c.format === 'VIDEO'));
                    const isVideoHeader = headerComp?.format === 'VIDEO';

                    if (broadcastDialogOpen && headerComp && phoneNumber) {
                      try {
                        const response = await fetch(url);
                        if (!response.ok) throw new Error('Failed to fetch media from URL');
                        const blob = await response.blob();
                        const isVideo = (itemType === 'video') || blob.type.startsWith('video/');
                        const isImage = (itemType === 'image') || blob.type.startsWith('image/');
                        if (isVideoHeader && !isVideo) {
                          toast({ title: "Invalid selection", description: "This template requires a video. Please select a video.", variant: "destructive" });
                          return;
                        }
                        if (!isVideoHeader && !isImage) {
                          toast({ title: "Invalid selection", description: "This template requires an image. Please select an image.", variant: "destructive" });
                          return;
                        }
                        const fileName = url.split('/').pop() || (isVideo ? 'video.mp4' : 'image.jpg');
                        const file = new (window as any).File([blob], fileName, { type: blob.type });
                        if (isVideoHeader) {
                          setHeaderVideoUrl(url);
                          uploadMediaMutation.mutate({ sessionId: phoneNumber.sessionId, file, mediaType: 'video' });
                        } else {
                          setHeaderImageUrl(url);
                          uploadMediaMutation.mutate({ sessionId: phoneNumber.sessionId, file, mediaType: 'image' });
                        }
                      } catch (error: any) {
                        toast({ title: "Failed to load media", description: error.message || "Please try again", variant: "destructive" });
                      }
                      return;
                    }
                    if (templateDialogOpen && activeSession) {
                      setHeaderImageUrl(url);
                      try {
                        const response = await fetch(url);
                        if (!response.ok) throw new Error('Failed to fetch image from URL');
                        const blob = await response.blob();
                        const fileName = url.split('/').pop() || 'image.jpg';
                        const file = new (window as any).File([blob], fileName, { type: blob.type });
                        uploadMediaMutation.mutate({ sessionId: activeSession.sessionId, file });
                      } catch (error: any) {
                        toast({ title: "Failed to load image", description: error.message || "Please check the URL and try again", variant: "destructive" });
                      }
                    }
                  }}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Enter file URL (https://...)</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://..."
                      value={galleryUrlInput}
                      onChange={(e) => setGalleryUrlInput(e.target.value)}
                    />
                    <Button
                      onClick={async () => {
                        if (galleryUrlInput) {
                          if (
                            broadcastDialogOpen &&
                            galleryCarouselCardIndex !== null &&
                            selectedTemplateId
                          ) {
                            const tpl = templates.find((t: any) => (t.id || t.templateId) === selectedTemplateId);
                            const meta = tpl?.metaData || tpl?.metadata || {};
                            const carCs = Array.isArray(meta.mediaCards) ? meta.mediaCards : [];
                            const idx = galleryCarouselCardIndex;
                            const expectVideo = carCs[idx]?.mediaType === "VIDEO";
                            const isVideoUrl =
                              /\.(mp4|webm|mov|avi|3gp)(\?|#|$)/i.test(galleryUrlInput) ||
                              /\/video\//i.test(galleryUrlInput);
                            if (expectVideo && !isVideoUrl) {
                              toast({
                                title: "URL may not be a video",
                                description: `Card ${idx + 1} expects a video URL (.mp4, etc.).`,
                                variant: "destructive",
                              });
                              return;
                            }
                            if (!expectVideo && isVideoUrl) {
                              toast({
                                title: "URL is a video",
                                description: `Card ${idx + 1} expects an image URL.`,
                                variant: "destructive",
                              });
                              return;
                            }
                            setBroadcastCarouselCardMediaUrls((prev) => {
                              const next = [...prev];
                              next[idx] = galleryUrlInput;
                              return next;
                            });
                            setGalleryDialogOpen(false);
                            setGalleryCarouselCardIndex(null);
                            setGalleryUrlInput("");
                            return;
                          }
                          const phoneNumber = phoneNumbersData?.phoneNumbers?.find((p: any) => p.phoneNumberId === selectedPhoneNumberId);
                          if (phoneNumber) {
                            try {
                              const response = await fetch(galleryUrlInput);
                              if (!response.ok) throw new Error('Failed to fetch media from URL');
                              const blob = await response.blob();
                              const isVideo = blob.type.startsWith('video/');
                              const template = selectedTemplateId ? templates.find((t: any) => (t.id || t.templateId) === selectedTemplateId) : null;
                              const headerComp = template?.components?.find((c: any) => c.type === 'HEADER' && (c.format === 'IMAGE' || c.format === 'VIDEO'));
                              const isVideoHeader = headerComp?.format === 'VIDEO';
                              const fileName = galleryUrlInput.split('/').pop() || (isVideo ? 'video.mp4' : 'image.jpg');
                              const file = new (window as any).File([blob], fileName, { type: blob.type });
                              if (headerComp && isVideoHeader && isVideo) {
                                setHeaderVideoUrl(galleryUrlInput);
                                uploadMediaMutation.mutate({ sessionId: phoneNumber.sessionId, file, mediaType: 'video' });
                              } else if (headerComp && !isVideoHeader && !isVideo) {
                                setHeaderImageUrl(galleryUrlInput);
                                uploadMediaMutation.mutate({ sessionId: phoneNumber.sessionId, file, mediaType: 'image' });
                              } else {
                                setHeaderImageUrl(galleryUrlInput);
                                uploadMediaMutation.mutate({ sessionId: phoneNumber.sessionId, file });
                              }
                            } catch (error: any) {
                              console.error('Error uploading media:', error);
                            }
                          }
                          setGalleryDialogOpen(false);
                          setGalleryUrlInput("");
                        }
                      }}
                      disabled={!galleryUrlInput || uploadMediaMutation.isPending}
                    >
                      {uploadMediaMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        'Select'
                      )}
                    </Button>
                  </div>
                </div>
                {galleryUrlInput && (
                  <div className="border-2 border-dashed rounded-lg p-8 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Link2 className="w-12 h-12 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Enter a file URL to preview</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setGalleryCarouselCardIndex(null);
                  setGalleryDialogOpen(false);
                }}
              >
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5" />
              Assign {selectedContacts.size} contact{selectedContacts.size !== 1 ? 's' : ''}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Assign {selectedContacts.size} selected contact{selectedContacts.size !== 1 ? 's' : ''}
            </p>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Select user</label>
              <Select onValueChange={async (userId) => {
                try {
                  // Assign contacts to selected user
                  const response = await apiRequest("POST", "/api/contacts/bulk/assign", {
                    contactIds: selectedContactsArray,
                    assignedToUserId: userId,
                  });
                  const result = await response.json();
                  
                  if (result.successCount > 0) {
                    queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
                    setAssignDialogOpen(false);
                    setSelectedContacts(new Set());
                    toast({
                      title: "Success",
                      description: `${result.successCount} contact(s) assigned successfully`,
                    });
                  } else {
                    const errors = result.results?.filter((r: any) => !r.success).map((r: any) => r.error).join(', ') || 'Unknown error';
                    toast({
                      title: "Error",
                      description: `Failed to assign contacts: ${errors}`,
                      variant: "destructive",
                    });
                  }
                } catch (error: any) {
                  console.error('Error assigning contacts:', error);
                  let errorMessage = error.message || "Failed to assign contacts";
                  // Try to parse error message from response
                  if (error.message && error.message.includes(':')) {
                    try {
                      const errorText = error.message.split(':')[1]?.trim();
                      if (errorText) {
                        const errorJson = JSON.parse(errorText);
                        errorMessage = errorJson.message || errorJson.error || errorMessage;
                      }
                    } catch {
                      // If parsing fails, use original message
                    }
                  }
                  toast({
                    title: "Error",
                    description: errorMessage,
                    variant: "destructive",
                  });
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {!currentOrganizationId ? (
                    <div className="p-3 text-sm text-muted-foreground">
                      Create or join an organization in Settings first.
                    </div>
                  ) : members.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground">
                      No team members found. Invite members in Settings → Team.
                    </div>
                  ) : (
                    members.map((member: any) => {
                      // Build full name from firstName and lastName, fallback to email
                      const fullName = member.user?.firstName 
                        ? `${member.user.firstName}${member.user.lastName ? ` ${member.user.lastName}` : ''}`
                        : null;
                      const displayName = fullName || member.user?.email || `User ${member.userId?.substring(0, 8)}...` || 'Unknown User';
                      const roleLabel = member.role === 'owner' || member.role === 'admin' ? ` (${member.role.toUpperCase()})` : '';
                      return (
                        <SelectItem key={member.id} value={member.userId}>
                          {displayName}{roleLabel}
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Assign Tag Dialog */}
      <Dialog open={bulkTagDialogOpen} onOpenChange={setBulkTagDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5" />
              Assign tags to {selectedContacts.size} contact{selectedContacts.size !== 1 ? 's' : ''}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Assign tags to {selectedContacts.size} selected contact{selectedContacts.size !== 1 ? 's' : ''}
            </p>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Select tags...</label>
              <div className="border rounded-lg p-3 max-h-60 overflow-y-auto">
                <div className="flex items-center gap-2 mb-2">
                  <Search className="w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Search tags..." className="border-0 p-0 h-auto" />
                </div>
                <div className="space-y-2">
                  {tags.map((tag) => (
                    <div
                      key={tag.id}
                      className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer"
                      onClick={() => {
                        bulkAssignTagMutation.mutate({
                          contactIds: selectedContactsArray,
                          tagId: tag.id,
                        });
                      }}
                    >
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                      <span className="text-sm">{tag.name}</span>
                    </div>
                  ))}
                  {tags.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No tags available</p>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkTagDialogOpen(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedContacts.size} Contact{selectedContacts.size !== 1 ? 's' : ''}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedContacts.size} selected contact{selectedContacts.size !== 1 ? 's' : ''}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                bulkDeleteMutation.mutate(selectedContactsArray);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Template Message Dialog */}
      {isBusinessAPI && (
        <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Send Template Message</DialogTitle>
              <DialogDescription>Send a predefined message template</DialogDescription>
            </DialogHeader>
            
            <div className="grid grid-cols-2 gap-6 mt-4">
              {/* Left Panel - Preview */}
              <div className="flex-[1] bg-muted/30 rounded-lg p-6 flex flex-col overflow-hidden max-h-[600px]">
                <h3 className="text-lg font-semibold mb-4 flex-shrink-0">Preview</h3>
                {selectedTemplate ? (
                  <div className="bg-[#e5ddd5] rounded-lg p-4 flex-1 min-h-[400px] overflow-y-auto" style={{ backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.05) 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
                    <div className="bg-white rounded-lg shadow-md p-4 max-w-[85%] ml-0 mb-4" style={{ borderRadius: '7.5px 7.5px 7.5px 0' }}>
                      {/* Header Image */}
                      {headerFormat === 'IMAGE' && headerImageUrl && (
                        <div
                          className="relative overflow-hidden -mx-4 -mt-4 mb-2 rounded-t-[7.5px]"
                          style={{ width: 'calc(100% + 2rem)', maxHeight: '300px' }}
                        >
                          <img src={headerImageUrl} alt="Template header" className="block w-full h-auto object-cover" />
                        </div>
                      )}
                      
                      {/* Body */}
                      {selectedTemplate.components?.find((c: any) => c.type === 'BODY')?.text && (() => {
                        const bodyText = getPreviewText(selectedTemplate, templateParams, selectedContactForTemplate || undefined);
                        return (
                          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                            {bodyText}
                          </p>
                        );
                      })()}
                      
                      {/* Footer */}
                      {selectedTemplate.components?.find((c: any) => c.type === 'FOOTER')?.text && (
                        <p className="text-xs text-gray-500 text-center mt-2 pt-2 border-t border-gray-200">
                          {selectedTemplate.components.find((c: any) => c.type === 'FOOTER').text}
                        </p>
                      )}
                      
                      {/* Buttons */}
                      {selectedTemplate.components?.find((c: any) => c.type === 'BUTTONS') && (() => {
                        const buttonsComponent = selectedTemplate.components.find((c: any) => c.type === 'BUTTONS');
                        const buttons = buttonsComponent?.buttons || [];
                        
                        if (buttons.length === 0) return null;
                        
                        return (
                          <div className="mt-4 space-y-2 border-t border-gray-200 pt-4">
                            {buttons.map((button: any, index: number) => {
                              if (button.type === 'QUICK_REPLY') {
                                return (
                                  <button key={index} className="w-full text-left px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm text-gray-700 transition-colors">
                                    {button.text || `Quick Reply ${index + 1}`}
                                  </button>
                                );
                              } else if (button.type === 'URL') {
                                return (
                                  <button key={index} className="w-full text-left px-3 py-2 bg-[#25D366] hover:bg-[#20BA5A] text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors">
                                    <Link2 className="h-4 w-4" />
                                    {button.text || `Button ${index + 1}`}
                                  </button>
                                );
                              } else if (button.type === 'PHONE_NUMBER') {
                                return (
                                  <button key={index} className="w-full text-left px-3 py-2 bg-[#25D366] hover:bg-[#20BA5A] text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors">
                                    <Phone className="h-4 w-4" />
                                    {button.text || `Button ${index + 1}`}
                                  </button>
                                );
                              }
                              return null;
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ) : (
                  <div className="bg-muted rounded-lg p-12 flex flex-col items-center justify-center text-center flex-1">
                    <Mountain className="w-16 h-16 text-muted-foreground mb-4" />
                    <p className="text-sm font-medium">No Template Selected</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Please select a template to preview the message
                    </p>
                  </div>
                )}
              </div>

              {/* Right Panel - Send Template Message */}
              <div className="flex-[1] space-y-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Phone Number</Label>
                  <Input
                    value={selectedContactForTemplate?.phoneNumber || ''}
                    disabled
                    className="bg-muted"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium mb-2 block">Message Template</Label>
                  <Select
                    value={selectedTemplateId ?? undefined}
                    onValueChange={handleTemplateSelect}
                    modal={false}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a template" />
                    </SelectTrigger>
                    <SelectContent position="popper" className="z-[250]">
                      {filteredTemplates.length > 0 ? (
                        filteredTemplates.map((template: any) => {
                          const itemValue = String(template.id || template.templateId || "");
                          if (!itemValue) return null;
                          return (
                            <SelectItem key={itemValue} value={itemValue}>
                              {template.name} ({template.category})
                            </SelectItem>
                          );
                        })
                      ) : (
                        <SelectItem value="__no_templates__" disabled>
                          {templateDropdownHint}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {!templateDialogTemplatesLoading && filteredTemplates.length === 0 && (
                    <p className="text-sm text-muted-foreground mt-2">{templateDropdownHint}</p>
                  )}
                </div>

                {/* Body Mapping */}
                {selectedTemplate && templateParams.length > 0 && (
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Body Mapping</Label>
                    {templateParams.map((param, index) => {
                      const varNum = index + 1;
                      return (
                        <div key={index} className="space-y-2 border rounded-lg p-3">
                          <Label className="text-xs font-medium">Parameter {varNum} ({`{{${varNum}}}`})</Label>
                          <div className="space-y-2">
                            <div>
                              <Label className="text-xs text-muted-foreground mb-1 block">Select Column</Label>
                              <Select
                                value={param.column || ''}
                                onValueChange={(value) => {
                                  const newParams = [...templateParams];
                                  newParams[index] = { ...newParams[index], column: value };
                                  setTemplateParams(newParams);
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select column" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="name">Name</SelectItem>
                                  <SelectItem value="phoneNumber">Phone Number</SelectItem>
                                  <SelectItem value="email">Email</SelectItem>
                                  {contactColumns.map((col: any) => (
                                    <SelectItem key={col.id} value={`customFields.${col.label}`}>
                                      {col.label} (Custom Field)
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground mb-1 block">Manual value (optional)</Label>
                              <Input
                                placeholder="Enter value"
                                value={param.fallback || ''}
                                maxLength={WHATSAPP_TEMPLATE_PARAM_MAX_CHARS}
                                onChange={(e) => {
                                  const newParams = [...templateParams];
                                  newParams[index] = {
                                    ...newParams[index],
                                    fallback: e.target.value.replace(/\r\n|\r|\n/g, " "),
                                  };
                                  setTemplateParams(newParams);
                                }}
                              />
                              <p className="text-[11px] text-muted-foreground">
                                Max {WHATSAPP_TEMPLATE_PARAM_MAX_CHARS} characters.
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Media URL Section (image or video header) */}
                {selectedTemplate && (headerFormat === 'IMAGE' || headerFormat === 'VIDEO') && (
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Media URL</Label>
                    
                    {/* From Gallery */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">From your gallery</span>
                        <Badge variant="secondary" className="text-xs">Recommended</Badge>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setGalleryFileType(headerFormat === 'VIDEO' ? 'video' : 'image');
                          setGalleryDialogOpen(true);
                        }}
                        className="w-full"
                        disabled={!activeSession}
                      >
                        <ImageIcon className="w-4 h-4 mr-2" />
                        Select media
                      </Button>
                      {(headerImageUrl || headerVideoUrl) && !headerImageId && !headerVideoId && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Media selected. Please upload to get media ID.
                        </p>
                      )}
                      {(headerImageId || headerVideoId) && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Media ID: {(headerImageId || headerVideoId)?.substring(0, 30)}...
                        </p>
                      )}
                      {uploadMediaMutation.isPending && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Uploading media to WhatsApp...
                        </p>
                      )}
                    </div>

                    {/* OR Divider */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 border-t"></div>
                      <span className="text-xs text-muted-foreground">OR</span>
                      <div className="flex-1 border-t"></div>
                    </div>

                    {/* Enter URL */}
                    <div className="space-y-2">
                      <Label className="text-sm">Enter URL directly</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Enter media URL (https://...)"
                          value={imageUrlInput}
                          onChange={(e) => setImageUrlInput(e.target.value)}
                          disabled={uploadMediaMutation.isPending}
                        />
                        <Button
                          onClick={async () => {
                            if (imageUrlInput && activeSession) {
                              try {
                                const response = await fetch(imageUrlInput);
                                if (!response.ok) throw new Error('Failed to fetch media from URL');
                                const blob = await response.blob();
                                const fileName = imageUrlInput.split('/').pop() || (blob.type.startsWith('video/') ? 'video.mp4' : 'image.jpg');
                                const file = new (window as any).File([blob], fileName, { type: blob.type });
                                if (headerFormat === 'VIDEO') {
                                  setHeaderVideoUrl(imageUrlInput);
                                  uploadMediaMutation.mutate({ sessionId: activeSession.sessionId, file, mediaType: 'video' });
                                } else {
                                  setHeaderImageUrl(imageUrlInput);
                                  uploadMediaMutation.mutate({ sessionId: activeSession.sessionId, file, mediaType: 'image' });
                                }
                                setImageUrlInput('');
                              } catch (error: any) {
                                toast({
                                  title: "Failed to load media",
                                  description: error.message || "Please check the URL and try again",
                                  variant: "destructive",
                                });
                              }
                            }
                          }}
                          disabled={!imageUrlInput || uploadMediaMutation.isPending || !activeSession}
                        >
                          {uploadMediaMutation.isPending ? "Uploading..." : "Upload"}
                        </Button>
                      </div>
                      {(headerImageId || headerVideoId) && (
                        <p className="text-xs text-muted-foreground">
                          Media ID: {(headerImageId || headerVideoId)?.substring(0, 30)}...
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <DialogFooter className="mt-6">
                  <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSendTemplate}
                    disabled={sendTemplateMutation.isPending || !selectedTemplate || uploadMediaMutation.isPending}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Send Template
                  </Button>
                </DialogFooter>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <ContactCreateInvoiceDialog
        open={invoiceDialogOpen}
        onOpenChange={setInvoiceDialogOpen}
        contact={contactForInvoice}
        organization={organizationsList[0] ?? null}
      />

      {/* Contact Details Sheet */}
      {selectedContactForDetails && (
        <ContactDetailsSheet
          open={contactDetailsOpen}
          onOpenChange={setContactDetailsOpen}
          contactName={selectedContactForDetails.name || selectedContactForDetails.phoneNumber}
          contactNumber={selectedContactForDetails.phoneNumber}
          contactProfilePic={undefined}
          contactId={selectedContactForDetails.id}
          tagIds={selectedContactForDetails.tags || []}
          assignedTo={(() => {
            const assignedToValue = selectedContactForDetails.customFields?.assignedTo;
            return typeof assignedToValue === 'string' ? assignedToValue : null;
          })()}
          customFields={selectedContactForDetails.customFields || {}}
          source={selectedContactForDetails.source || "whatsapp"}
        />
      )}
    </div>
    </PermissionGate>
  );
}
