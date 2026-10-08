import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useReminderContext } from "@/contexts/reminder-context";
import { useToast } from "@/hooks/use-toast";
import {
  format,
  addDays,
  subDays,
  startOfDay,
  isBefore,
  isSameDay,
} from "date-fns";
import {
  formatDateTimeLocalValue,
  parseDateTimeLocalValue,
} from "@/features/reminders/reminderDateTime";

export type ReminderTab = "all" | "due_today" | "overdue" | "upcoming";

export type ReminderItem = {
  id: string;
  title?: string | null;
  message: string;
  notes?: string | null;
  reminderAt: string;
  contactId: string;
  contactName: string;
  contactPhone?: string;
  reminderTo?: string;
  assigneeName?: string;
  templateName?: string | null;
  templateLanguage?: string | null;
  templateParams?: string[] | null;
  sessionId?: string | null;
  headerImageUrl?: string | null;
  headerImageId?: string | null;
  headerVideoUrl?: string | null;
  headerVideoId?: string | null;
  headerDocumentUrl?: string | null;
  headerDocumentId?: string | null;
  whatsappStatus?: string | null;
};

export type TeamMemberOption = {
  userId: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  role?: string;
};

export type ContactOption = {
  id: string;
  name: string | null;
  phoneNumber?: string | null;
};

export type ReminderTemplateOption = {
  id: string;
  name: string;
  language?: string;
  status?: string;
  phoneNumberId?: string | null;
  components?: Array<{ type?: string; text?: string; format?: string }>;
};

/** Count numbered body variables like {{1}}, {{2}} in a template. */
export function countTemplateBodyParams(template: ReminderTemplateOption | null | undefined): number {
  const body = template?.components?.find((c) => String(c.type || "").toUpperCase() === "BODY");
  const text = body?.text || "";
  const matches = Array.from(text.matchAll(/\{\{(\d+)\}\}/g));
  if (matches.length === 0) return 0;
  return Math.max(...matches.map((m) => parseInt(m[1], 10)));
}

export function getTemplateHeaderFormat(
  template: ReminderTemplateOption | null | undefined,
): "IMAGE" | "VIDEO" | "DOCUMENT" | "TEXT" | null {
  const header = template?.components?.find((c) => String(c.type || "").toUpperCase() === "HEADER");
  if (!header) return null;
  const format = String(header.format || "TEXT").toUpperCase();
  if (format === "IMAGE" || format === "VIDEO" || format === "DOCUMENT" || format === "TEXT") {
    return format;
  }
  return "TEXT";
}

export function getTemplateBodyText(template: ReminderTemplateOption | null | undefined): string {
  return template?.components?.find((c) => String(c.type || "").toUpperCase() === "BODY")?.text || "";
}

export function reminderTitle(title: string | null | undefined, message?: string): string {
  const fromTitle = (title || "").trim().replace(/\s+/g, " ");
  if (fromTitle) return fromTitle.length > 48 ? `${fromTitle.slice(0, 48)}…` : fromTitle;
  const cleaned = (message || "").trim().replace(/\s+/g, " ");
  if (!cleaned) return "Untitled reminder";
  return cleaned.length > 48 ? `${cleaned.slice(0, 48)}…` : cleaned;
}

export function reminderDueStatus(reminderAt: string | Date): "overdue" | "due_today" | "upcoming" {
  const due = new Date(reminderAt);
  const today = startOfDay(new Date());
  if (isSameDay(due, today)) return "due_today";
  if (isBefore(due, today)) return "overdue";
  return "upcoming";
}

export function useRemindersPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const setPendingContactIdToOpen = useReminderContext()?.setPendingContactIdToOpen;

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<ReminderTab>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("any");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<ReminderItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<ReminderItem | null>(null);

  const [formContactId, setFormContactId] = useState("");
  const [formContactSearch, setFormContactSearch] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formUseTemplate, setFormUseTemplate] = useState(false);
  const [formTemplateId, setFormTemplateId] = useState("");
  const [formTemplateParams, setFormTemplateParams] = useState<string[]>([]);
  const [formHeaderImageUrl, setFormHeaderImageUrl] = useState("");
  const [formHeaderImageId, setFormHeaderImageId] = useState("");
  const [formHeaderVideoUrl, setFormHeaderVideoUrl] = useState("");
  const [formHeaderVideoId, setFormHeaderVideoId] = useState("");
  const [formHeaderDocumentUrl, setFormHeaderDocumentUrl] = useState("");
  const [formHeaderDocumentId, setFormHeaderDocumentId] = useState("");
  const [templateConfigOpen, setTemplateConfigOpen] = useState(false);
  const [draftTemplateKey, setDraftTemplateKey] = useState("");
  const [draftTemplateParams, setDraftTemplateParams] = useState<string[]>([]);
  const [draftHeaderImageUrl, setDraftHeaderImageUrl] = useState("");
  const [draftHeaderImageId, setDraftHeaderImageId] = useState("");
  const [draftHeaderVideoUrl, setDraftHeaderVideoUrl] = useState("");
  const [draftHeaderVideoId, setDraftHeaderVideoId] = useState("");
  const [draftHeaderDocumentUrl, setDraftHeaderDocumentUrl] = useState("");
  const [draftHeaderDocumentId, setDraftHeaderDocumentId] = useState("");
  const [draftMediaUrlInput, setDraftMediaUrlInput] = useState("");
  const [mediaUploading, setMediaUploading] = useState(false);
  const [formReminderTo, setFormReminderTo] = useState("");
  const [formReminderAt, setFormReminderAt] = useState("");

  const { data: orgData } = useQuery<{ organizations?: { id: string }[] } | { id: string }[]>({
    queryKey: ["/api/organizations"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/organizations");
      return res.json();
    },
  });
  const organizationsList = Array.isArray(orgData) ? orgData : (orgData?.organizations ?? []);
  const organizationId = organizationsList[0]?.id;

  const { data: members = [] } = useQuery<TeamMemberOption[]>({
    queryKey: ["/api/organizations", organizationId, "members"],
    enabled: !!organizationId,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/organizations/${organizationId}/members`);
      const data = await res.json();
      const raw = Array.isArray(data) ? data : (data.members ?? []);
      return raw.map((m: any) => ({
        userId: m.userId || m.user?.id || m.id,
        firstName: m.firstName ?? m.user?.firstName ?? null,
        lastName: m.lastName ?? m.user?.lastName ?? null,
        email: m.email ?? m.user?.email ?? null,
        role: m.role,
      })).filter((m: TeamMemberOption) => !!m.userId);
    },
  });

  const queryParams = useMemo(() => {
    const now = startOfDay(new Date());
    let dateFrom = "";
    let dateTo = "";
    if (dateFromFilter || dateToFilter) {
      dateFrom = dateFromFilter;
      dateTo = dateToFilter;
    } else if (tab === "due_today") {
      dateFrom = format(now, "yyyy-MM-dd");
      dateTo = dateFrom;
    } else if (tab === "overdue") {
      dateFrom = format(subDays(now, 3650), "yyyy-MM-dd");
      dateTo = format(subDays(now, 1), "yyyy-MM-dd");
    } else if (tab === "upcoming") {
      dateFrom = format(addDays(now, 1), "yyyy-MM-dd");
      dateTo = format(addDays(now, 3650), "yyyy-MM-dd");
    }
    const p = new URLSearchParams();
    if (organizationId) p.set("organizationId", organizationId);
    if (dateFrom) p.set("from", dateFrom);
    if (dateTo) p.set("to", dateTo);
    if (search.trim()) p.set("search", search.trim());
    if (assigneeFilter !== "any") p.set("reminderTo", assigneeFilter);
    return p.toString();
  }, [organizationId, tab, search, assigneeFilter, dateFromFilter, dateToFilter]);

  const { data: reminders = [], isLoading } = useQuery<ReminderItem[]>({
    queryKey: ["/api/reminders/list", queryParams],
    queryFn: async () => {
      const url = queryParams ? `/api/reminders/list?${queryParams}` : "/api/reminders/list";
      const res = await apiRequest("GET", url);
      return res.json();
    },
  });

  const filteredReminders = useMemo(() => {
    let rows = [...reminders];
    if (statusFilter === "overdue") {
      rows = rows.filter((r) => reminderDueStatus(r.reminderAt) === "overdue");
    } else if (statusFilter === "due_today") {
      rows = rows.filter((r) => reminderDueStatus(r.reminderAt) === "due_today");
    } else if (statusFilter === "upcoming") {
      rows = rows.filter((r) => reminderDueStatus(r.reminderAt) === "upcoming");
    }
    rows.sort((a, b) => {
      const aT = new Date(a.reminderAt).getTime();
      const bT = new Date(b.reminderAt).getTime();
      return sortDir === "asc" ? aT - bT : bT - aT;
    });
    return rows;
  }, [reminders, statusFilter, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredReminders.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedReminders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredReminders.slice(start, start + pageSize);
  }, [filteredReminders, currentPage, pageSize]);

  const counts = useMemo(() => {
    let dueToday = 0;
    let overdue = 0;
    let upcoming = 0;
    for (const r of reminders) {
      const s = reminderDueStatus(r.reminderAt);
      if (s === "due_today") dueToday += 1;
      else if (s === "overdue") overdue += 1;
      else upcoming += 1;
    }
    return {
      all: reminders.length,
      due_today: dueToday,
      overdue,
      upcoming,
    };
  }, [reminders]);

  const { data: sessions = [] } = useQuery<any[]>({
    queryKey: ["/api/sessions", "reminders"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/sessions");
      const data = await res.json();
      return Array.isArray(data) ? data : (data.sessions ?? []);
    },
    enabled: addOpen || !!editItem,
  });

  const officialSession = useMemo(() => {
    const list = Array.isArray(sessions) ? sessions : [];
    const official = list.filter(
      (s: any) => s?.connectionType === "official" && !s?.deletedAt,
    );
    return (
      official.find((s: any) => String(s?.status || "").toLowerCase() === "connected") ||
      official[0] ||
      null
    );
  }, [sessions]);

  const sessionPhoneNumberId =
    officialSession?.connectionType === "official"
      ? (officialSession.deviceInfo as any)?.apiPhoneNumberId
      : undefined;

  const { data: templatesRaw = [], isLoading: templatesLoading } = useQuery<ReminderTemplateOption[]>({
    queryKey: ["/api/reminders/templates", organizationId, sessionPhoneNumberId],
    enabled: (addOpen || !!editItem) && formUseTemplate && !!organizationId,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (organizationId) params.set("organizationId", organizationId);
      if (sessionPhoneNumberId) params.set("phoneNumberId", String(sessionPhoneNumberId));
      const res = await apiRequest("GET", `/api/reminders/templates?${params.toString()}`);
      const data = await res.json();
      const items = Array.isArray(data) ? data : (data.templates ?? data.items ?? []);
      return items as ReminderTemplateOption[];
    },
  });

  const approvedTemplates = useMemo(() => {
    let list = (templatesRaw || []).filter(
      (t) => String(t.status || "").toUpperCase() === "APPROVED",
    );
    if (sessionPhoneNumberId) {
      list = list.filter((t) => !t.phoneNumberId || t.phoneNumberId === sessionPhoneNumberId);
    }
    return list;
  }, [templatesRaw, sessionPhoneNumberId]);

  const selectedTemplate = useMemo(
    () => approvedTemplates.find((t) => t.id === formTemplateId || t.name === formTemplateId) || null,
    [approvedTemplates, formTemplateId],
  );

  const draftTemplate = useMemo(
    () => approvedTemplates.find((t) => t.id === draftTemplateKey || t.name === draftTemplateKey) || null,
    [approvedTemplates, draftTemplateKey],
  );

  const draftHeaderFormat = useMemo(() => getTemplateHeaderFormat(draftTemplate), [draftTemplate]);

  const setFormUseTemplateAndReset = (on: boolean) => {
    setFormUseTemplate(on);
    if (on) {
      setFormMessage("");
    } else {
      setFormTemplateId("");
      setFormTemplateParams([]);
      setFormHeaderImageUrl("");
      setFormHeaderImageId("");
      setFormHeaderVideoUrl("");
      setFormHeaderVideoId("");
      setFormHeaderDocumentUrl("");
      setFormHeaderDocumentId("");
      setTemplateConfigOpen(false);
    }
  };

  const openTemplateConfig = (templateKey: string, preferExisting = false) => {
    const tpl = approvedTemplates.find((t) => t.id === templateKey || t.name === templateKey);
    const count = countTemplateBodyParams(tpl);
    setDraftTemplateKey(templateKey);
    const reuse =
      preferExisting &&
      (formTemplateId === templateKey || formTemplateId === tpl?.name || formTemplateId === tpl?.id);
    setDraftTemplateParams(
      reuse && formTemplateParams.length
        ? Array.from({ length: Math.max(count, formTemplateParams.length) }, (_, i) => formTemplateParams[i] ?? "")
        : Array.from({ length: count }, () => ""),
    );
    if (reuse) {
      setDraftHeaderImageUrl(formHeaderImageUrl);
      setDraftHeaderImageId(formHeaderImageId);
      setDraftHeaderVideoUrl(formHeaderVideoUrl);
      setDraftHeaderVideoId(formHeaderVideoId);
      setDraftHeaderDocumentUrl(formHeaderDocumentUrl);
      setDraftHeaderDocumentId(formHeaderDocumentId);
    } else {
      setDraftHeaderImageUrl("");
      setDraftHeaderImageId("");
      setDraftHeaderVideoUrl("");
      setDraftHeaderVideoId("");
      setDraftHeaderDocumentUrl("");
      setDraftHeaderDocumentId("");
    }
    setDraftMediaUrlInput("");
    setTemplateConfigOpen(true);
  };

  const selectTemplate = (templateKey: string) => {
    openTemplateConfig(templateKey, false);
  };

  const reopenTemplateConfig = () => {
    if (!formTemplateId) return;
    openTemplateConfig(formTemplateId, true);
  };

  const cancelTemplateConfig = () => {
    setTemplateConfigOpen(false);
    setDraftTemplateKey("");
    setDraftMediaUrlInput("");
  };

  const confirmTemplateConfig = () => {
    if (!draftTemplate?.name) {
      toast({ title: "Select a template", variant: "destructive" });
      return;
    }
    const format = getTemplateHeaderFormat(draftTemplate);
    const needed = countTemplateBodyParams(draftTemplate);
    if (needed > 0 && draftTemplateParams.slice(0, needed).some((p) => !String(p || "").trim())) {
      toast({ title: "Please fill all template variables", variant: "destructive" });
      return;
    }
    if (format === "IMAGE" && !draftHeaderImageUrl.trim() && !draftHeaderImageId.trim()) {
      toast({ title: "Please add an image for this template", variant: "destructive" });
      return;
    }
    if (format === "VIDEO" && !draftHeaderVideoUrl.trim() && !draftHeaderVideoId.trim()) {
      toast({ title: "Please add a video for this template", variant: "destructive" });
      return;
    }
    if (format === "DOCUMENT" && !draftHeaderDocumentUrl.trim() && !draftHeaderDocumentId.trim()) {
      toast({ title: "Please add a document for this template", variant: "destructive" });
      return;
    }
    setFormTemplateId(draftTemplate.name);
    setFormTemplateParams(draftTemplateParams.slice(0, needed));
    setFormHeaderImageUrl(format === "IMAGE" ? draftHeaderImageUrl : "");
    setFormHeaderImageId(format === "IMAGE" ? draftHeaderImageId : "");
    setFormHeaderVideoUrl(format === "VIDEO" ? draftHeaderVideoUrl : "");
    setFormHeaderVideoId(format === "VIDEO" ? draftHeaderVideoId : "");
    setFormHeaderDocumentUrl(format === "DOCUMENT" ? draftHeaderDocumentUrl : "");
    setFormHeaderDocumentId(format === "DOCUMENT" ? draftHeaderDocumentId : "");
    setTemplateConfigOpen(false);
  };

  const applyDraftMediaUrl = async () => {
    const url = draftMediaUrlInput.trim();
    if (!url) return;
    const format = draftHeaderFormat;
    if (format === "IMAGE") {
      setDraftHeaderImageUrl(url);
      setDraftHeaderImageId("");
    } else if (format === "VIDEO") {
      setDraftHeaderVideoUrl(url);
      setDraftHeaderVideoId("");
    } else if (format === "DOCUMENT") {
      setDraftHeaderDocumentUrl(url);
      setDraftHeaderDocumentId("");
    }
    setDraftMediaUrlInput("");
  };

  const uploadDraftMediaFile = async (file: File) => {
    if (!officialSession?.sessionId) {
      toast({ title: "Connect WhatsApp Business first", variant: "destructive" });
      return;
    }
    const format = draftHeaderFormat;
    if (format !== "IMAGE" && format !== "VIDEO" && format !== "DOCUMENT") return;
    setMediaUploading(true);
    try {
      const formData = new FormData();
      formData.append("sessionId", officialSession.sessionId);
      formData.append("file", file);
      const response = await fetch("/api/media/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed to upload media");
      }
      const data = await response.json();
      const preview = data.previewUrl || "";
      if (format === "IMAGE") {
        setDraftHeaderImageId(data.mediaId || "");
        if (preview) setDraftHeaderImageUrl(preview);
      } else if (format === "VIDEO") {
        setDraftHeaderVideoId(data.mediaId || "");
        if (preview) setDraftHeaderVideoUrl(preview);
      } else {
        setDraftHeaderDocumentId(data.mediaId || "");
        if (preview) setDraftHeaderDocumentUrl(preview);
      }
      toast({ title: "Media uploaded" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message, variant: "destructive" });
    } finally {
      setMediaUploading(false);
    }
  };

  const { data: contactSearchResults = [] } = useQuery<ContactOption[]>({
    queryKey: ["/api/contacts", "reminder-picker", formContactSearch, organizationId],
    enabled: addOpen && formContactSearch.trim().length >= 1,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", "20");
      params.set("offset", "0");
      if (formContactSearch.trim()) params.set("search", formContactSearch.trim());
      const res = await apiRequest("GET", `/api/contacts?${params.toString()}`);
      const data = await res.json();
      const items = data.contacts ?? data.items ?? (Array.isArray(data) ? data : []);
      return items.map((c: any) => ({
        id: c.id,
        name: c.name,
        phoneNumber: c.phoneNumber,
      }));
    },
  });

  const resetForm = () => {
    setFormContactId("");
    setFormContactSearch("");
    setFormTitle("");
    setFormMessage("");
    setFormNotes("");
    setFormUseTemplate(false);
    setFormTemplateId("");
    setFormTemplateParams([]);
    setFormHeaderImageUrl("");
    setFormHeaderImageId("");
    setFormHeaderVideoUrl("");
    setFormHeaderVideoId("");
    setFormHeaderDocumentUrl("");
    setFormHeaderDocumentId("");
    setTemplateConfigOpen(false);
    setFormReminderTo("");
    setFormReminderAt(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  };

  const openAdd = () => {
    resetForm();
    if (members[0]?.userId) setFormReminderTo(members[0].userId);
    setAddOpen(true);
  };

  const openEdit = (item: ReminderItem) => {
    setEditItem(item);
    const existingTitle = item.title?.trim();
    setFormTitle(existingTitle || item.message.trim());
    setFormNotes(item.notes?.trim() || "");
    const hasTemplate = !!(item.templateName && item.templateName.trim());
    setFormUseTemplate(hasTemplate);
    if (hasTemplate) {
      setFormMessage("");
      setFormTemplateId(item.templateName || "");
      setFormTemplateParams(Array.isArray(item.templateParams) ? item.templateParams.map(String) : []);
      setFormHeaderImageUrl(item.headerImageUrl || "");
      setFormHeaderImageId(item.headerImageId || "");
      setFormHeaderVideoUrl(item.headerVideoUrl || "");
      setFormHeaderVideoId(item.headerVideoId || "");
      setFormHeaderDocumentUrl(item.headerDocumentUrl || "");
      setFormHeaderDocumentId(item.headerDocumentId || "");
    } else {
      setFormMessage(
        existingTitle && item.message.trim() !== existingTitle ? item.message : "",
      );
      setFormTemplateId("");
      setFormTemplateParams([]);
      setFormHeaderImageUrl("");
      setFormHeaderImageId("");
      setFormHeaderVideoUrl("");
      setFormHeaderVideoId("");
      setFormHeaderDocumentUrl("");
      setFormHeaderDocumentId("");
    }
    setFormReminderTo(item.reminderTo || "");
    setFormReminderAt(formatDateTimeLocalValue(item.reminderAt));
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!formContactId || !formTitle.trim() || !formReminderTo || !formReminderAt) {
        throw new Error("Please fill all required fields");
      }
      if (formUseTemplate) {
        if (!selectedTemplate?.name && !formTemplateId) throw new Error("Please select and configure a WhatsApp template");
        if (!officialSession?.sessionId) {
          throw new Error("Connect an official WhatsApp Business number to send templates");
        }
        const format = getTemplateHeaderFormat(selectedTemplate);
        const needed = countTemplateBodyParams(selectedTemplate);
        if (needed > 0 && formTemplateParams.slice(0, needed).some((p) => !String(p || "").trim())) {
          throw new Error("Please configure all template variables");
        }
        if (format === "IMAGE" && !formHeaderImageUrl && !formHeaderImageId) {
          throw new Error("Please configure the template image");
        }
        if (format === "VIDEO" && !formHeaderVideoUrl && !formHeaderVideoId) {
          throw new Error("Please configure the template video");
        }
      } else if (formMessage.trim() && !officialSession?.sessionId) {
        throw new Error("Connect an official WhatsApp Business number to send the message at due date");
      }
      const contact = contactSearchResults.find((c) => c.id === formContactId);
      const reminderAtIso = parseDateTimeLocalValue(formReminderAt).toISOString();
      const payload: Record<string, unknown> = {
        reminderTo: formReminderTo,
        title: formTitle.trim(),
        notes: formNotes.trim(),
        reminderAt: reminderAtIso,
        contactDisplayName: contact?.name || contact?.phoneNumber || undefined,
      };
      if (formUseTemplate) {
        payload.useTemplate = true;
        payload.templateName = selectedTemplate?.name || formTemplateId;
        payload.templateLanguage = selectedTemplate?.language || "en";
        payload.templateParams = formTemplateParams;
        payload.sessionId = officialSession.sessionId;
        payload.message = "";
        payload.headerImageUrl = formHeaderImageUrl || undefined;
        payload.headerImageId = formHeaderImageId || undefined;
        payload.headerVideoUrl = formHeaderVideoUrl || undefined;
        payload.headerVideoId = formHeaderVideoId || undefined;
        payload.headerDocumentUrl = formHeaderDocumentUrl || undefined;
        payload.headerDocumentId = formHeaderDocumentId || undefined;
      } else {
        payload.useTemplate = false;
        payload.message = formMessage.trim();
        if (formMessage.trim() && officialSession?.sessionId) {
          payload.sessionId = officialSession.sessionId;
        }
      }
      await apiRequest("POST", `/api/contacts/${formContactId}/reminders`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders/list"] });
      toast({
        title: "Reminder created",
        description: formUseTemplate
          ? "WhatsApp template will send automatically at the due date."
          : formMessage.trim()
            ? "WhatsApp message will send automatically at the due date."
            : undefined,
      });
      setAddOpen(false);
      resetForm();
    },
    onError: (e: Error) => {
      toast({ title: "Could not create reminder", description: e.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editItem || !formTitle.trim() || !formReminderTo || !formReminderAt) {
        throw new Error("Please fill all required fields");
      }
      if (formUseTemplate) {
        if (!selectedTemplate?.name && !formTemplateId) {
          throw new Error("Please select and configure a WhatsApp template");
        }
        if (!officialSession?.sessionId && !editItem.sessionId) {
          throw new Error("Connect an official WhatsApp Business number to send templates");
        }
      } else if (formMessage.trim() && !officialSession?.sessionId && !editItem.sessionId) {
        throw new Error("Connect an official WhatsApp Business number to send the message at due date");
      }
      const reminderAtIso = parseDateTimeLocalValue(formReminderAt).toISOString();
      const payload: Record<string, unknown> = {
        reminderTo: formReminderTo,
        title: formTitle.trim(),
        notes: formNotes.trim(),
        reminderAt: reminderAtIso,
        contactDisplayName: editItem.contactName,
      };
      if (formUseTemplate) {
        const tplName = selectedTemplate?.name || formTemplateId;
        payload.useTemplate = true;
        payload.templateName = tplName;
        payload.templateLanguage = selectedTemplate?.language || editItem.templateLanguage || "en";
        payload.templateParams = formTemplateParams;
        payload.sessionId = officialSession?.sessionId || editItem.sessionId;
        payload.message = "";
        payload.headerImageUrl = formHeaderImageUrl || null;
        payload.headerImageId = formHeaderImageId || null;
        payload.headerVideoUrl = formHeaderVideoUrl || null;
        payload.headerVideoId = formHeaderVideoId || null;
        payload.headerDocumentUrl = formHeaderDocumentUrl || null;
        payload.headerDocumentId = formHeaderDocumentId || null;
      } else {
        payload.useTemplate = false;
        payload.message = formMessage.trim();
        if (formMessage.trim()) {
          payload.sessionId = officialSession?.sessionId || editItem.sessionId;
        }
      }
      await apiRequest("PATCH", `/api/contacts/${editItem.contactId}/reminders/${editItem.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders/list"] });
      toast({ title: "Reminder updated" });
      setEditItem(null);
    },
    onError: (e: Error) => {
      toast({ title: "Could not update reminder", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (item: ReminderItem) => {
      await apiRequest("DELETE", `/api/contacts/${item.contactId}/reminders/${item.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders/list"] });
      toast({ title: "Reminder deleted" });
      setDeleteItem(null);
    },
    onError: (e: Error) => {
      toast({ title: "Could not delete reminder", description: e.message, variant: "destructive" });
    },
  });

  const openContactChat = (contactId: string) => {
    setPendingContactIdToOpen?.(contactId);
    setLocation(`/chat?contactId=${encodeURIComponent(contactId)}`);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllOnPage = () => {
    const ids = pagedReminders.map((r) => r.id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const memberLabel = (m: TeamMemberOption) => {
    const name = [m.firstName, m.lastName].filter(Boolean).join(" ").trim();
    return name || m.email || m.userId;
  };

  const emptyHint =
    search.trim() ||
    assigneeFilter !== "any" ||
    statusFilter !== "all" ||
    dateFromFilter ||
    dateToFilter
      ? "Try adjusting filters or search."
      : "No reminders yet. Click + Add Reminder to create one, or add from a contact in Inbox.";

  const setTabAndReset = (v: ReminderTab) => {
    setTab(v);
    setDateFromFilter("");
    setDateToFilter("");
    setPage(1);
  };
  const setSearchAndReset = (v: string) => {
    setSearch(v);
    setPage(1);
  };
  const setAssigneeAndReset = (v: string) => {
    setAssigneeFilter(v);
    setPage(1);
  };
  const setStatusAndReset = (v: string) => {
    setStatusFilter(v);
    setPage(1);
  };
  const setDateFromAndReset = (v: string) => {
    setDateFromFilter(v);
    setPage(1);
  };
  const setDateToAndReset = (v: string) => {
    setDateToFilter(v);
    setPage(1);
  };

  return {
    search,
    setSearch: setSearchAndReset,
    tab,
    setTab: setTabAndReset,
    assigneeFilter,
    setAssigneeFilter: setAssigneeAndReset,
    statusFilter,
    setStatusFilter: setStatusAndReset,
    dateFromFilter,
    setDateFromFilter: setDateFromAndReset,
    dateToFilter,
    setDateToFilter: setDateToAndReset,
    sortDir,
    setSortDir,
    page: currentPage,
    setPage,
    pageSize,
    setPageSize: (n: number) => {
      setPageSize(n);
      setPage(1);
    },
    totalCount: filteredReminders.length,
    totalPages,
    selectedIds,
    toggleSelect,
    toggleSelectAllOnPage,
    members,
    memberLabel,
    reminders: pagedReminders,
    isLoading,
    openContactChat,
    emptyHint,
    counts,
    addOpen,
    setAddOpen,
    openAdd,
    editItem,
    setEditItem,
    openEdit,
    deleteItem,
    setDeleteItem,
    formContactId,
    setFormContactId,
    formContactSearch,
    setFormContactSearch,
    contactSearchResults,
    formTitle,
    setFormTitle,
    formMessage,
    setFormMessage,
    formNotes,
    setFormNotes,
    formUseTemplate,
    setFormUseTemplate: setFormUseTemplateAndReset,
    formTemplateId,
    selectTemplate,
    reopenTemplateConfig,
    formTemplateParams,
    setFormTemplateParams,
    formHeaderImageUrl,
    formHeaderVideoUrl,
    formHeaderDocumentUrl,
    approvedTemplates,
    templatesLoading,
    selectedTemplate,
    officialSession,
    templateConfigOpen,
    setTemplateConfigOpen,
    draftTemplate,
    draftTemplateKey,
    draftHeaderFormat,
    draftTemplateParams,
    setDraftTemplateParams,
    draftHeaderImageUrl,
    draftHeaderVideoUrl,
    draftHeaderDocumentUrl,
    draftMediaUrlInput,
    setDraftMediaUrlInput,
    applyDraftMediaUrl,
    uploadDraftMediaFile,
    mediaUploading,
    confirmTemplateConfig,
    cancelTemplateConfig,
    formReminderTo,
    setFormReminderTo,
    formReminderAt,
    setFormReminderAt,
    createMutation,
    updateMutation,
    deleteMutation,
  };
}
