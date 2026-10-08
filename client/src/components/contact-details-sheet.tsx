"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowLeft,
  Plus,
  Pencil,
  FileText,
  Clock,
  Bell,
  Zap,
  Trash2,
  Search,
  X,
  Loader2,
  Banknote,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { getPastelColorForName } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { fetchLegacyListApi } from "@/lib/legacy-list-api";
import { parsePaymentAmountInput } from "@/lib/payment-amount";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentMemberPermissions } from "@/hooks/useCurrentMemberPermissions";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { type OrganizationLeadStatusRow } from "@/components/leads/lead-utils";
import { useReminderTemplateCompose } from "@/features/reminders/useReminderTemplateCompose";
import {
  formatDateTimeLocalValue,
  parseDateTimeLocalValue,
} from "@/features/reminders/reminderDateTime";
import {
  ReminderComposeFields,
  ReminderTemplateConfigDialog,
} from "@/features/reminders/ReminderComposeFields";
import { reminderTitle } from "@/features/reminders/useRemindersPage";

type ContactTag = { id: string; name: string; color?: string };
type ContactNote = { id: string; message: string; createdAt: string; userId?: string; userFirstName?: string | null; userLastName?: string | null; userProfileImageUrl?: string | null };
type ContactReminder = {
  id: string;
  title?: string | null;
  message: string;
  notes?: string | null;
  reminderTo: string;
  reminderAt: string;
  createdAt: string;
  userId?: string;
  userFirstName?: string | null;
  userLastName?: string | null;
  userProfileImageUrl?: string | null;
  assigneeFirstName?: string | null;
  assigneeLastName?: string | null;
  assigneeEmail?: string | null;
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
  whatsappError?: string | null;
};
type ContactActivityEntry = {
  id: string;
  contactId: string;
  userId: string;
  action: "tag_added" | "tag_removed" | "note_added" | "reminder_added";
  metadata?: { tagId?: string; tagName?: string };
  createdAt: string;
  userFirstName?: string | null;
  userLastName?: string | null;
  userProfileImageUrl?: string | null;
};

type ContactLeadRow = {
  id: string;
  status: string;
  phoneNumber: string;
  name?: string | null;
};

type ContactPaymentRequestRow = {
  id: string;
  token: string;
  status: string;
  currency: string;
  amountMinor: number;
  gateway: string;
  gatewayPaymentId?: string | null;
  description?: string | null;
  createdAt: string;
  paidAt?: string | null;
};

export interface ContactDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactName: string;
  contactNumber: string;
  contactProfilePic?: string;
  /** Managed contact id if this chat is in contacts */
  contactId?: string | null;
  /** Tag ids for this contact */
  tagIds?: string[];
  /** Assigned user id */
  assignedTo?: string | null;
  /** Custom fields for this contact */
  customFields?: Record<string, unknown> | null;
  /** Contact source (e.g. whatsapp, import) */
  source?: string | null;
}

const SOURCE_OPTIONS = [
  "whatsapp",
  "Import",
  "Website",
  "Facebook",
  "Instagram",
  "Twitter",
  "LinkedIn",
  "Email",
  "Referral",
  "IndiaMart",
  "TradeIndia",
];

function formatPhoneDisplay(contactNumber: string): string {
  const digits = contactNumber.replace(/@c\.us|@g\.us|[^\d]/g, "").trim();
  return digits ? `+${digits}` : contactNumber || "";
}

// Default column fields to always show (match reference UI)
const DEFAULT_COLUMNS: { label: string; key: string }[] = [
  { label: "Email", key: "email" },
  { label: "Status", key: "status" },
  { label: "WABA Phone Number", key: "wabaPhoneNumber" },
  { label: "Form Name", key: "formName" },
  { label: "Page Name", key: "pageName" },
  { label: "City", key: "city" },
  { label: "Are You Using Any Whatsapp Marketing Tool?", key: "usingWhatsappTool" },
  { label: "Are you a Business Owner?", key: "businessOwner" },
  { label: "Are You A?", key: "areYouA" },
  { label: "Pricing", key: "pricing" },
];

function memberDisplayName(m: {
  userId: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  user?: { firstName?: string | null; lastName?: string | null; email?: string | null } | null;
}): string {
  const first = (m.user?.firstName ?? m.firstName ?? "").trim();
  const last = (m.user?.lastName ?? m.lastName ?? "").trim();
  const email = (m.user?.email ?? m.email ?? "").trim();
  const name = [first, last].filter(Boolean).join(" ").trim();
  if (name) return name;
  if (email) return email;
  return m.userId ? `User ${m.userId.slice(0, 8)}` : "Unknown user";
}

export function ContactDetailsSheet({
  open,
  onOpenChange,
  contactName,
  contactNumber,
  contactProfilePic,
  contactId,
  tagIds = [],
  assignedTo,
  customFields = {},
  source = "whatsapp",
}: ContactDetailsSheetProps) {
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  const [displayTagIds, setDisplayTagIds] = useState<string[]>(tagIds ?? []);
  useEffect(() => {
    setDisplayTagIds(tagIds ?? []);
  }, [tagIds, contactId]);
  const displayPhone = formatPhoneDisplay(contactNumber);
  const pastelColor = getPastelColorForName(contactName);
  const initials = contactName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const { data: tags = [] } = useQuery<ContactTag[]>({
    queryKey: ["/api/tags"],
    queryFn: () => fetchLegacyListApi("/api/tags", "tags"),
    enabled: open,
  });

  const { data: orgData } = useQuery<{ organizations?: { id: string }[] } | { id: string }[]>({
    queryKey: ["/api/organizations"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/organizations");
      return res.json();
    },
    enabled: open,
  });
  const organizationsList = Array.isArray(orgData) ? orgData : (orgData?.organizations ?? []);
  const orgId = organizationsList[0]?.id;
  const { hasPermission } = useCurrentMemberPermissions();
  const canViewTeamMembers = hasPermission("manage_team.view");
  const canManageReminders =
    hasPermission("reminders.create") || hasPermission("manage_contacts.edit");
  const canViewPaymentHistory =
    !!contactId && (hasPermission("manage_contacts.view") || hasPermission("manage_contacts.edit"));
  const canRequestPayment = !!contactId && hasPermission("manage_contacts.edit");
  const canViewLeads = hasPermission("manage_contacts.view");
  const canEditLeads = hasPermission("manage_contacts.edit");

  const phoneDigits = useMemo(
    () => contactNumber.replace(/@c\.us|@g\.us|[^\d]/g, "").trim(),
    [contactNumber],
  );

  const { data: leadStatusData } = useQuery<{ statuses: OrganizationLeadStatusRow[] }>({
    queryKey: ["/api/leads/statuses"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/leads/statuses");
      if (!res.ok) throw new Error("Failed to load lead statuses");
      return res.json();
    },
    enabled: open && canViewLeads,
  });
  const leadStatuses = leadStatusData?.statuses ?? [];

  const { data: contactLead, isLoading: contactLeadLoading } = useQuery<ContactLeadRow | null>({
    queryKey: ["/api/leads/by-phone", phoneDigits],
    queryFn: async () => {
      if (!phoneDigits) return null;
      const res = await apiRequest("GET", `/api/leads/by-phone/${encodeURIComponent(phoneDigits)}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to load lead");
      return res.json();
    },
    enabled: open && canViewLeads && !!phoneDigits,
  });

  const updateLeadStatusMutation = useMutation({
    mutationFn: async (statusSlug: string) => {
      if (!phoneDigits) throw new Error("Phone number required");

      // "Not assigned" — remove lead from pipeline if one exists
      if (statusSlug === "__none__") {
        if (!contactLead?.id) return null;
        const res = await apiRequest("DELETE", `/api/leads/${contactLead.id}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || "Failed to unassign lead");
        }
        return null;
      }

      const valid = leadStatuses.some((s) => s.slug === statusSlug);
      if (!valid) throw new Error("Invalid lead status");

      if (contactLead?.id) {
        const res = await apiRequest("PATCH", `/api/leads/${contactLead.id}`, { status: statusSlug });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || "Failed to update lead status");
        }
        return res.json();
      }

      const res = await apiRequest("POST", "/api/leads", {
        phoneNumber: phoneDigits,
        name: contactName?.trim() || undefined,
        contactId: contactId || undefined,
        source: source?.trim() || "whatsapp",
        status: statusSlug,
      });
      if (res.status === 409) {
        const existingRes = await apiRequest(
          "GET",
          `/api/leads/by-phone/${encodeURIComponent(phoneDigits)}`,
        );
        if (existingRes.ok) {
          const existing = (await existingRes.json()) as ContactLeadRow;
          const patchRes = await apiRequest("PATCH", `/api/leads/${existing.id}`, {
            status: statusSlug,
          });
          if (!patchRes.ok) {
            const err = await patchRes.json().catch(() => ({}));
            throw new Error(err.message || "Failed to update lead status");
          }
          return patchRes.json();
        }
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to create lead");
      }
      return res.json();
    },
    onSuccess: (_data, statusSlug) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads/by-phone", phoneDigits] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({
        title: statusSlug === "__none__" ? "Lead unassigned" : "Lead status updated",
      });
    },
    onError: (e: Error) => {
      toast({ title: "Failed to update lead status", description: e.message, variant: "destructive" });
    },
  });

  const currentLeadStatusSlug = contactLead?.status ?? "__none__";
  const { data: teamMembers = [] } = useQuery<
    {
      userId: string;
      role?: string;
      firstName?: string | null;
      lastName?: string | null;
      email?: string | null;
      user?: { firstName?: string | null; lastName?: string | null; email?: string | null } | null;
    }[]
  >({
    queryKey: ["/api/organizations", orgId, "members"],
    queryFn: async () => {
      if (!orgId) return [];
      const res = await apiRequest("GET", `/api/organizations/${orgId}/members`);
      const data = await res.json();
      const raw = Array.isArray(data) ? data : (data.members ?? []);
      return raw.map((m: any) => ({
        userId: m.userId || m.user?.id || m.id,
        role: m.role,
        firstName: m.firstName ?? m.user?.firstName ?? null,
        lastName: m.lastName ?? m.user?.lastName ?? null,
        email: m.email ?? m.user?.email ?? null,
        user: m.user
          ? {
              firstName: m.user.firstName ?? m.firstName ?? null,
              lastName: m.user.lastName ?? m.lastName ?? null,
              email: m.user.email ?? m.email ?? null,
            }
          : {
              firstName: m.firstName ?? null,
              lastName: m.lastName ?? null,
              email: m.email ?? null,
            },
      })).filter((m: { userId?: string }) => !!m.userId);
    },
    enabled: !!orgId && open && (canViewTeamMembers || canManageReminders),
  });
  const reminderAssignableMembers = useMemo(() => {
    const list = [...teamMembers];
    if (authUser?.id && !list.some((m) => m.userId === authUser.id)) {
      list.unshift({
        userId: authUser.id,
        user: {
          firstName: authUser.firstName ?? undefined,
          lastName: authUser.lastName ?? undefined,
          email: authUser.email ?? undefined,
        },
      });
    }
    const selfId = authUser?.id;
    return list.sort((a, b) => {
      if (selfId && a.userId === selfId) return -1;
      if (selfId && b.userId === selfId) return 1;
      return memberDisplayName(a).localeCompare(memberDisplayName(b));
    });
  }, [teamMembers, authUser]);

  const defaultReminderToUserId = useCallback((): string => {
    if (authUser?.id) return authUser.id;
    return "";
  }, [authUser?.id]);
  // Only members (role === 'member') in Assigned To dropdown – exclude owner/admin
  const assignableMembers = teamMembers.filter((m) => m.role === "member");
  const assignedToIsMember = assignedTo && assignableMembers.some((m) => m.userId === assignedTo);
  const assignedToDisplayName =
    assignedTo && !assignedToIsMember
      ? (() => {
          const m = teamMembers.find((x) => x.userId === assignedTo);
          return m?.user?.firstName
            ? (m.user.firstName + " " + (m.user.lastName ?? "")).trim()
            : m?.user?.email ?? "User " + assignedTo.slice(0, 8);
        })()
      : null;

  const { data: contactColumns = [] } = useQuery<{ id: string; label: string; type?: string; order?: number }[]>({
    queryKey: ["/api/columns"],
    queryFn: () => fetchLegacyListApi("/api/columns", "columns"),
    enabled: open,
  });

  const updateContactMutation = useMutation({
    mutationFn: async (data: { customFields?: Record<string, unknown>; tags?: string[]; assignedTo?: string; source?: string }) => {
      if (!contactId) throw new Error("Contact not synced");
      const res = await apiRequest("PATCH", "/api/contacts/" + contactId, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      toast({ title: "Contact updated" });
    },
    onError: (e: Error) => {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    },
  });

  const assignTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      if (!contactId) throw new Error("Contact not synced");
      await apiRequest("POST", `/api/contacts/${contactId}/tags`, { tagId });
    },
    onSuccess: (_data, tagId) => {
      setDisplayTagIds((prev) => (prev.includes(tagId) ? prev : [...prev, tagId]));
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      if (contactId) queryClient.invalidateQueries({ queryKey: ["/api/contacts", contactId, "activity"] });
      toast({ title: "Tag added", description: "The tag has been added to the contact successfully." });
    },
    onError: (e: Error) => toast({ title: "Failed to add tag", description: e.message, variant: "destructive" }),
  });

  const removeTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      if (!contactId) throw new Error("Contact not synced");
      await apiRequest("DELETE", `/api/contacts/${contactId}/tags/${tagId}`);
    },
    onSuccess: (_data, tagId) => {
      setDisplayTagIds((prev) => prev.filter((id) => id !== tagId));
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      if (contactId) queryClient.invalidateQueries({ queryKey: ["/api/contacts", contactId, "activity"] });
      toast({ title: "Tag removed", description: "The tag has been removed from the contact." });
    },
    onError: (e: Error) => toast({ title: "Failed to remove tag", description: e.message, variant: "destructive" }),
  });

  const sortedColumns = [...contactColumns].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const defaultKeys = new Set(DEFAULT_COLUMNS.map((c) => c.key));
  const extraColumns = sortedColumns.filter((c) => !defaultKeys.has(c.id) && !defaultKeys.has(c.label));
  const hasContact = !!contactId;

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDesc, setPaymentDesc] = useState("");
  const [paymentIntegrationId, setPaymentIntegrationId] = useState("");
  const [paymentSessionId, setPaymentSessionId] = useState("");
  const [paymentCustomerEmail, setPaymentCustomerEmail] = useState("");

  const { data: paymentOptions } = useQuery<{
    emailCopyAvailable?: boolean;
    integrations: { id: string; name: string; displayName: string; connectionName?: unknown }[];
    whatsappSessions: { sessionId: string; label: string }[];
  }>({
    queryKey: ["/api/payments/options"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/payments/options");
      return res.json();
    },
    enabled: open && canRequestPayment,
  });

  const { data: contactPaymentRequests = [], isLoading: contactPaymentRequestsLoading } = useQuery<
    ContactPaymentRequestRow[]
  >({
    queryKey: ["/api/payments/contact-requests", contactId],
    queryFn: async () => {
      if (!contactId) return [];
      const qs = new URLSearchParams({ contactId, limit: "30" });
      return fetchLegacyListApi(
        `/api/payments/contact-requests?${qs.toString()}`,
        "transactions"
      );
    },
    enabled: open && canViewPaymentHistory,
  });

  useEffect(() => {
    if (!paymentOptions?.integrations?.length) return;
    setPaymentIntegrationId((prev) => {
      if (prev && paymentOptions.integrations.some((i) => i.id === prev)) return prev;
      return paymentOptions.integrations[0].id;
    });
  }, [paymentOptions]);

  useEffect(() => {
    if (!paymentOptions?.whatsappSessions?.length) return;
    setPaymentSessionId((prev) => {
      if (prev && paymentOptions.whatsappSessions.some((s) => s.sessionId === prev)) return prev;
      return paymentOptions.whatsappSessions[0].sessionId;
    });
  }, [paymentOptions]);

  const contactPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!contactId) throw new Error("Sync contact first");
      const amt = parsePaymentAmountInput(paymentAmount);
      const body: Record<string, unknown> = {
        contactId,
        amount: amt,
        currency: "INR",
      };
      if (paymentDesc.trim()) body.description = paymentDesc.trim();
      if (paymentIntegrationId) body.integrationId = paymentIntegrationId;
      if (paymentSessionId) body.whatsappSessionId = paymentSessionId;
      if (paymentCustomerEmail.trim()) body.customerEmail = paymentCustomerEmail.trim();
      const res = await apiRequest("POST", "/api/payments/contact-request", body);
      return res.json() as Promise<{ warning?: string }>;
    },
    onSuccess: (data) => {
      toast({
        title: "Payment link sent",
        description: data.warning || "A WhatsApp message was sent with the payment link.",
      });
      setPaymentAmount("");
      setPaymentDesc("");
      setPaymentCustomerEmail("");
      queryClient.invalidateQueries({ queryKey: ["/api/payments/contact-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/contact-requests", contactId] });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const [tagSearch, setTagSearch] = useState("");
  const [columnsEditOpen, setColumnsEditOpen] = useState(false);
  const [columnsFormValues, setColumnsFormValues] = useState<Record<string, string>>({});

  const getColumnValue = (keyOrLabel: string, fromId?: string) => {
    const cf = customFields ?? {};
    return String(cf[keyOrLabel] ?? cf[fromId ?? ""] ?? "-");
  };

  // Notes
  const [addNoteOpen, setAddNoteOpen] = useState(false);
  const [noteMessage, setNoteMessage] = useState("");
  const { data: notes = [] } = useQuery<ContactNote[]>({
    queryKey: ["/api/contacts", contactId, "notes"],
    queryFn: async () => {
      if (!contactId) return [];
      const res = await apiRequest("GET", `/api/contacts/${contactId}/notes`);
      return res.json();
    },
    enabled: !!contactId && open,
  });
  const createNoteMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!contactId) throw new Error("Contact not synced");
      const res = await apiRequest("POST", `/api/contacts/${contactId}/notes`, { message });
      return res.json();
    },
    onSuccess: () => {
      setNoteMessage("");
      setAddNoteOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", contactId, "notes"] });
      if (contactId) queryClient.invalidateQueries({ queryKey: ["/api/contacts", contactId, "activity"] });
      toast({ title: "Note added" });
    },
    onError: (e: Error) => toast({ title: "Failed to add note", description: e.message, variant: "destructive" }),
  });
  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      if (!contactId) throw new Error("Contact not synced");
      await apiRequest("DELETE", `/api/contacts/${contactId}/notes/${noteId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/contacts", contactId, "notes"] }),
    onError: (e: Error) => toast({ title: "Failed to delete note", description: e.message, variant: "destructive" }),
  });
  const [editingNote, setEditingNote] = useState<{ id: string; message: string } | null>(null);
  const [editNoteMessage, setEditNoteMessage] = useState("");
  const updateNoteMutation = useMutation({
    mutationFn: async ({ noteId, message }: { noteId: string; message: string }) => {
      if (!contactId) throw new Error("Contact not synced");
      const res = await apiRequest("PATCH", `/api/contacts/${contactId}/notes/${noteId}`, { message });
      return res.json();
    },
    onSuccess: () => {
      setEditingNote(null);
      setEditNoteMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", contactId, "notes"] });
      toast({ title: "Note updated" });
    },
    onError: (e: Error) => toast({ title: "Failed to update note", description: e.message, variant: "destructive" }),
  });

  // Reminders
  const [addReminderOpen, setAddReminderOpen] = useState(false);
  const [reminderTo, setReminderTo] = useState("");
  const [reminderTitleValue, setReminderTitleValue] = useState("");
  const [reminderMessage, setReminderMessage] = useState("");
  const [reminderNotes, setReminderNotes] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [editingReminder, setEditingReminder] = useState<ContactReminder | null>(null);
  const [editReminderTo, setEditReminderTo] = useState("");
  const [editReminderTitle, setEditReminderTitle] = useState("");
  const [editReminderMessage, setEditReminderMessage] = useState("");
  const [editReminderNotes, setEditReminderNotes] = useState("");
  const [editReminderAt, setEditReminderAt] = useState("");

  const reminderCompose = useReminderTemplateCompose({
    enabled: addReminderOpen || !!editingReminder,
    organizationId: orgId,
  });

  const openAddReminderDialog = () => {
    setReminderTo(defaultReminderToUserId());
    setReminderTitleValue("");
    setReminderMessage("");
    setReminderNotes("");
    setReminderAt("");
    reminderCompose.resetTemplateCompose();
    setAddReminderOpen(true);
  };

  useEffect(() => {
    if (!addReminderOpen) return;
    if (reminderTo && reminderAssignableMembers.some((m) => m.userId === reminderTo)) return;
    const defaultUserId = defaultReminderToUserId();
    if (defaultUserId) setReminderTo(defaultUserId);
  }, [addReminderOpen, defaultReminderToUserId, reminderAssignableMembers, reminderTo]);

  const { data: reminders = [] } = useQuery<ContactReminder[]>({
    queryKey: ["/api/contacts", contactId, "reminders"],
    queryFn: async () => {
      if (!contactId) return [];
      const res = await apiRequest("GET", `/api/contacts/${contactId}/reminders`);
      return res.json();
    },
    enabled: !!contactId && open,
  });
  const createReminderMutation = useMutation({
    mutationFn: async () => {
      if (!contactId) throw new Error("Contact not synced");
      if (!reminderTo || !reminderAt || !reminderTitleValue.trim()) {
        throw new Error("Please fill all required fields");
      }
      const reminderAtIso = parseDateTimeLocalValue(reminderAt).toISOString();
      const payload: Record<string, unknown> = {
        reminderTo,
        title: reminderTitleValue.trim(),
        reminderAt: reminderAtIso,
        contactDisplayName: contactName,
      };
      if (reminderCompose.useTemplate) {
        const tpl = reminderCompose.buildTemplatePayload();
        if (!tpl || tpl.useTemplate === false) {
          throw new Error("Please select and configure a WhatsApp template");
        }
        Object.assign(payload, tpl);
      } else {
        payload.useTemplate = false;
        payload.message = reminderMessage.trim();
        if (reminderMessage.trim()) {
          if (!reminderCompose.officialSession?.sessionId) {
            throw new Error("Connect an official WhatsApp Business number to send the message at due date");
          }
          payload.sessionId = reminderCompose.officialSession.sessionId;
        }
      }
      payload.notes = reminderNotes.trim();
      const res = await apiRequest("POST", "/api/contacts/" + contactId + "/reminders", payload);
      return res.json();
    },
    onSuccess: () => {
      const usedTemplate = reminderCompose.useTemplate;
      const usedMessage = !!reminderMessage.trim();
      setReminderTo("");
      setReminderTitleValue("");
      setReminderMessage("");
      setReminderNotes("");
      setReminderAt("");
      reminderCompose.resetTemplateCompose();
      setAddReminderOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", contactId, "reminders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders/upcoming"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders/list"] });
      if (contactId) queryClient.invalidateQueries({ queryKey: ["/api/contacts", contactId, "activity"] });
      toast({
        title: "Reminder saved",
        description: usedTemplate
          ? "WhatsApp template will send automatically at the due date."
          : usedMessage
            ? "WhatsApp message will send automatically at the due date."
            : undefined,
      });
    },
    onError: (e: Error) => toast({ title: "Failed to save reminder", description: e.message, variant: "destructive" }),
  });
  const deleteReminderMutation = useMutation({
    mutationFn: async (reminderId: string) => {
      if (!contactId) throw new Error("Contact not synced");
      await apiRequest("DELETE", "/api/contacts/" + contactId + "/reminders/" + reminderId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/contacts", contactId, "reminders"] }),
    onError: (e: Error) => toast({ title: "Failed to delete reminder", description: e.message, variant: "destructive" }),
  });
  const updateReminderMutation = useMutation({
    mutationFn: async () => {
      if (!contactId || !editingReminder) throw new Error("Contact not synced");
      if (!editReminderTo || !editReminderAt || !editReminderTitle.trim()) {
        throw new Error("Please fill all required fields");
      }
      const reminderAtIso = parseDateTimeLocalValue(editReminderAt).toISOString();
      const payload: Record<string, unknown> = {
        reminderTo: editReminderTo,
        title: editReminderTitle.trim(),
        reminderAt: reminderAtIso,
        contactDisplayName: contactName,
      };
      if (reminderCompose.useTemplate) {
        const tpl = reminderCompose.buildTemplatePayload();
        if (!tpl || tpl.useTemplate === false) {
          throw new Error("Please select and configure a WhatsApp template");
        }
        Object.assign(payload, tpl);
        if (!payload.sessionId && editingReminder.sessionId) {
          payload.sessionId = editingReminder.sessionId;
        }
      } else {
        payload.useTemplate = false;
        payload.message = editReminderMessage.trim();
        if (editReminderMessage.trim()) {
          const sid = reminderCompose.officialSession?.sessionId || editingReminder.sessionId;
          if (!sid) {
            throw new Error("Connect an official WhatsApp Business number to send the message at due date");
          }
          payload.sessionId = sid;
        }
      }
      payload.notes = editReminderNotes.trim();
      const res = await apiRequest(
        "PATCH",
        `/api/contacts/${contactId}/reminders/${editingReminder.id}`,
        payload,
      );
      return res.json();
    },
    onSuccess: () => {
      setEditingReminder(null);
      setEditReminderTo("");
      setEditReminderTitle("");
      setEditReminderMessage("");
      setEditReminderNotes("");
      setEditReminderAt("");
      reminderCompose.resetTemplateCompose();
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", contactId, "reminders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders/upcoming"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders/list"] });
      toast({ title: "Reminder updated" });
    },
    onError: (e: Error) => toast({ title: "Failed to update reminder", description: e.message, variant: "destructive" }),
  });

  const openEditReminder = (r: ContactReminder) => {
    setEditingReminder(r);
    setEditReminderTo(r.reminderTo);
    const existingTitle = r.title?.trim();
    setEditReminderTitle(existingTitle || reminderTitle(null, r.message));
    setEditReminderNotes(r.notes?.trim() || "");
    const hasTemplate = !!(r.templateName && r.templateName.trim());
    if (hasTemplate) {
      setEditReminderMessage("");
    } else {
      setEditReminderMessage(
        existingTitle && r.message.trim() !== existingTitle ? r.message : r.message,
      );
    }
    setEditReminderAt(formatDateTimeLocalValue(r.reminderAt));
    reminderCompose.loadFromReminder(r);
  };

  const getReminderToName = (r: ContactReminder | string) => {
    if (typeof r !== "string") {
      const assigneeName = [r.assigneeFirstName, r.assigneeLastName].filter(Boolean).join(" ").trim();
      if (assigneeName) return assigneeName;
      if (r.assigneeEmail?.trim()) return r.assigneeEmail.trim();
      const fromMembers = reminderAssignableMembers.find((x) => x.userId === r.reminderTo);
      if (fromMembers) return memberDisplayName(fromMembers);
      if (/^[0-9a-f-]{20,}$/i.test(r.reminderTo)) return `User ${r.reminderTo.slice(0, 8)}`;
      return r.reminderTo;
    }
    const m = reminderAssignableMembers.find((x) => x.userId === r);
    if (m) return memberDisplayName(m);
    if (/^[0-9a-f-]{20,}$/i.test(r)) return `User ${r.slice(0, 8)}`;
    return r;
  };

  const { data: contactActivity = [] } = useQuery<ContactActivityEntry[]>({
    queryKey: ["/api/contacts", contactId, "activity"],
    queryFn: async () => {
      if (!contactId) return [];
      const res = await apiRequest("GET", `/api/contacts/${contactId}/activity`);
      return res.json();
    },
    enabled: !!contactId && open,
  });

  const getActivityUserDisplayName = (entry: ContactActivityEntry) => {
    const first = (entry.userFirstName ?? "").trim();
    const last = (entry.userLastName ?? "").trim();
    if (first || last) return (first + " " + last).trim();
    return "Someone";
  };

  const getCreatorDisplayName = (item: { userFirstName?: string | null; userLastName?: string | null }) => {
    const first = (item.userFirstName ?? "").trim();
    const last = (item.userLastName ?? "").trim();
    if (first || last) return (first + " " + last).trim();
    return "Someone";
  };

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-4xl flex flex-col p-0 bg-gradient-to-b from-violet-50/80 to-rose-50/60 dark:from-violet-950/30 dark:to-rose-950/20"
        onPointerDownOutside={(e) => onOpenChange(false)}
      >
        <SheetHeader className="border-b border-violet-200/60 dark:border-violet-800/40 bg-white/70 dark:bg-black/20 backdrop-blur-sm px-4 py-4 space-y-0 text-left">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-full hover:bg-violet-100 dark:hover:bg-violet-900/40"
              onClick={() => onOpenChange(false)}
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <SheetTitle className="text-xl font-bold tracking-tight text-foreground">Contact Details</SheetTitle>
          </div>
          <div className="flex items-center gap-4 pt-4">
            <Avatar className="h-14 w-14 shrink-0 ring-2 ring-white dark:ring-violet-900/50 shadow-md">
              {contactProfilePic ? (
                <AvatarImage src={contactProfilePic} alt={contactName} />
              ) : null}
              <AvatarFallback
                className={cn("text-lg font-bold", pastelColor.bg, pastelColor.text)}
                style={{ backgroundColor: pastelColor.bgStyle, color: pastelColor.textStyle }}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-xl font-bold text-foreground truncate">{contactName}</p>
              <p className="text-sm font-medium text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5 min-w-0">
                <span className="capitalize shrink-0">{source && source.trim() ? source : "whatsapp"}</span>
                <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-[#25D366]" aria-hidden>
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                </span>
                <span className="truncate">{displayPhone}</span>
              </p>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-5 min-w-0">
            <div className="space-y-2 rounded-xl bg-white/80 dark:bg-white/5 p-3 border border-violet-100 dark:border-violet-900/30">
              <Label className="text-sm font-bold text-foreground uppercase tracking-wide">Source</Label>
              <Select
                value={source && source.trim() ? source : "whatsapp"}
                disabled={!hasContact}
                onValueChange={(value) => {
                  if (!contactId) return;
                  updateContactMutation.mutate({ source: value });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt.charAt(0).toUpperCase() + opt.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 rounded-xl bg-white/80 dark:bg-white/5 p-3 border border-rose-100 dark:border-rose-900/30">
              <Label className="text-sm font-bold text-foreground uppercase tracking-wide">Assigned To</Label>
              <Select
                value={assignedTo && assignedTo.trim() !== "" ? assignedTo : "__none__"}
                disabled={!hasContact}
                onValueChange={(value) => {
                  if (!contactId) return;
                  const next = value === "__none__" ? undefined : value;
                  updateContactMutation.mutate({
                    customFields: { ...customFields, assignedTo: next },
                  });
                }}
              >
                <SelectTrigger>
                  {assignedToDisplayName != null ? (
                    <span className="truncate">{assignedToDisplayName}</span>
                  ) : (
                    <SelectValue placeholder="Select user" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Not assigned</SelectItem>
                  {assignableMembers.map((m) => {
                    const name = m.user?.firstName
                      ? (m.user.firstName + " " + (m.user.lastName ?? "")).trim()
                      : m.user?.email ?? "User " + m.userId.slice(0, 8);
                    return (
                      <SelectItem key={m.userId} value={m.userId}>
                        {name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 rounded-xl bg-white/80 dark:bg-white/5 p-3 border border-amber-100 dark:border-amber-900/30">
              <Label className="text-sm font-bold text-foreground uppercase tracking-wide">Tags</Label>
              <div className="flex flex-wrap gap-2 min-h-10 rounded-lg border border-amber-200/60 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-950/20 px-3 py-2.5">
                {displayTagIds.map((id) => {
                  const tag = tags.find((t) => t.id === id);
                  const isRemoving = removeTagMutation.isPending && removeTagMutation.variables === tag?.id;
                  return tag ? (
                    <span
                      key={tag.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-800 dark:text-violet-200 px-3 py-1 text-sm font-bold"
                    >
                      {tag.name}
                      {hasContact && (
                        <button
                          type="button"
                          className="rounded hover:bg-muted p-0.5 disabled:opacity-70 disabled:pointer-events-none"
                          onClick={() => removeTagMutation.mutate(tag.id)}
                          aria-label={"Remove " + tag.name}
                          disabled={removeTagMutation.isPending}
                        >
                          {isRemoving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            "×"
                          )}
                        </button>
                      )}
                    </span>
                  ) : null;
                })}
                {hasContact && (
                  <Select
                    value=""
                    onValueChange={(value) => {
                      if (value && !displayTagIds.includes(value)) assignTagMutation.mutate(value);
                    }}
                    onOpenChange={(open) => !open && setTagSearch("")}
                    disabled={assignTagMutation.isPending}
                  >
                    <SelectTrigger className="h-auto w-auto min-w-[120px] border-0 shadow-none gap-1 bg-transparent">
                      {assignTagMutation.isPending ? (
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Adding...
                        </span>
                      ) : (
                        <SelectValue placeholder="Add or select tags..." />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      <div className="p-2 border-b" onClick={(e) => e.stopPropagation()}>
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search tags..."
                            value={tagSearch}
                            onChange={(e) => setTagSearch(e.target.value)}
                            className="pl-8 h-8"
                          />
                        </div>
                      </div>
                      {tags
                        .filter((t) => !displayTagIds.includes(t.id) && (!tagSearch.trim() || t.name.toLowerCase().includes(tagSearch.toLowerCase())))
                        .map((tag) => (
                          <SelectItem key={tag.id} value={tag.id}>
                            {tag.name}
                          </SelectItem>
                        ))}
                      {tags.filter((t) => !displayTagIds.includes(t.id) && (!tagSearch.trim() || t.name.toLowerCase().includes(tagSearch.toLowerCase()))).length === 0 && (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">No tags found</div>
                      )}
                    </SelectContent>
                  </Select>
                )}
                {!hasContact && (
                  <span className="text-xs text-muted-foreground">Sync contact to add tags</span>
                )}
              </div>
            </div>

            {canViewLeads && leadStatuses.length > 0 ? (
              <div className="space-y-2 rounded-xl bg-white/80 dark:bg-white/5 p-3 border border-indigo-100 dark:border-indigo-900/30">
                <Label className="text-sm font-bold text-foreground uppercase tracking-wide">
                  Lead Status
                </Label>
                {contactLeadLoading ? (
                  <div className="flex h-10 items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading lead status…
                  </div>
                ) : (
                  <Select
                    value={currentLeadStatusSlug}
                    disabled={
                      !canEditLeads ||
                      !phoneDigits ||
                      updateLeadStatusMutation.isPending
                    }
                    onValueChange={(value) => updateLeadStatusMutation.mutate(value)}
                  >
                    <SelectTrigger>
                      {updateLeadStatusMutation.isPending ? (
                        <span className="inline-flex items-center gap-2 text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving…
                        </span>
                      ) : (
                        <SelectValue placeholder="Not assigned" />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Not assigned</SelectItem>
                      {leadStatuses.map((s) => (
                        <SelectItem key={s.id} value={s.slug}>
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/10"
                              style={{ backgroundColor: s.color }}
                            />
                            {s.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {!contactLead && !contactLeadLoading && phoneDigits ? (
                  <p className="text-xs text-muted-foreground">
                    Not in Leads yet — choose a status to add this contact to the pipeline.
                  </p>
                ) : null}
                {!canEditLeads ? (
                  <p className="text-xs text-muted-foreground">View only — contact edit permission required.</p>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-2 rounded-xl bg-white/80 dark:bg-white/5 p-3 border border-sky-100 dark:border-sky-900/30">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-bold text-foreground uppercase tracking-wide">Columns</Label>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-sky-100 dark:hover:bg-sky-900/40" asChild aria-label="Add column">
                    <Link href="/columns">
                      <Plus className="h-4 w-4" />
                    </Link>
                  </Button>
                  {hasContact && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-lg hover:bg-sky-100 dark:hover:bg-sky-900/40"
                      aria-label="Edit columns"
                      onClick={() => {
                        const vals: Record<string, string> = {};
                        DEFAULT_COLUMNS.forEach((c) => {
                          const v = (customFields ?? {})[c.key];
                          vals[c.key] = typeof v === "string" ? v : v != null ? String(v) : "";
                        });
                        extraColumns.forEach((c) => {
                          const v = (customFields ?? {})[c.id] ?? (customFields ?? {})[c.label];
                          vals[c.id] = typeof v === "string" ? v : v != null ? String(v) : "";
                        });
                        setColumnsFormValues(vals);
                        setColumnsEditOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="rounded-lg border border-sky-200/60 dark:border-sky-800/40 overflow-hidden">
                {DEFAULT_COLUMNS.map((col, i) => (
                  <div key={col.key} className={cn("flex items-center justify-between px-3 py-2.5 text-sm", i % 2 === 0 ? "bg-sky-50/60 dark:bg-sky-950/20" : "bg-white/50 dark:bg-white/5")}>
                    <span className="font-semibold text-foreground shrink-0">{col.label}</span>
                    <span className="truncate max-w-[180px] text-right font-medium">{getColumnValue(col.key)}</span>
                  </div>
                ))}
                {extraColumns.map((col, i) => (
                  <div key={col.id} className={cn("flex items-center justify-between px-3 py-2.5 text-sm", (DEFAULT_COLUMNS.length + i) % 2 === 0 ? "bg-sky-50/60 dark:bg-sky-950/20" : "bg-white/50 dark:bg-white/5")}>
                    <span className="font-semibold text-foreground shrink-0">{col.label}</span>
                    <span className="truncate max-w-[180px] text-right font-medium">{getColumnValue(col.label, col.id)}</span>
                  </div>
                ))}
              </div>
            </div>

            {canViewPaymentHistory ? (
              <div className="space-y-3 rounded-xl bg-white/80 dark:bg-white/5 p-3 border border-emerald-100 dark:border-emerald-900/30">
                <div className="flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <Label className="text-sm font-bold text-foreground uppercase tracking-wide">Payments</Label>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Past requests</p>
                  {contactPaymentRequestsLoading ? (
                    <div className="flex items-center justify-center py-6 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : contactPaymentRequests.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No payment requests yet for this contact.</p>
                  ) : (
                    <ScrollArea className="h-[220px] rounded-lg border border-emerald-200/50 dark:border-emerald-900/40">
                      <ul className="divide-y divide-emerald-100/80 dark:divide-emerald-900/30">
                        {contactPaymentRequests.map((row) => {
                          const amountMajor = (row.amountMinor / 100).toFixed(2);
                          const paid = row.status === "paid";
                          const created = row.createdAt ? format(new Date(row.createdAt), "dd MMM yyyy, HH:mm") : "—";
                          return (
                            <li key={row.id} className="px-2.5 py-2 text-xs space-y-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-semibold tabular-nums">
                                      {row.currency} {amountMajor}
                                    </span>
                                    {paid ? (
                                      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200 px-1.5 py-0.5 text-[10px] font-bold uppercase">
                                        <CheckCircle2 className="h-3 w-3" />
                                        Paid
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200 px-1.5 py-0.5 text-[10px] font-bold uppercase">
                                        <Clock className="h-3 w-3" />
                                        {row.status || "Pending"}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-muted-foreground mt-0.5">{created}</p>
                                  {row.description ? (
                                    <p className="text-[11px] text-muted-foreground truncate" title={row.description}>
                                      {row.description}
                                    </p>
                                  ) : null}
                                  {row.gatewayPaymentId ? (
                                    <p className="text-[10px] font-mono text-muted-foreground break-all pt-0.5">
                                      Txn: {row.gatewayPaymentId}
                                    </p>
                                  ) : null}
                                  <p className="text-[10px] text-muted-foreground capitalize">{row.gateway}</p>
                                </div>
                                {!paid ? (
                                  <Button variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-[11px]" asChild>
                                    <a href={`/pay/${row.token}`} target="_blank" rel="noopener noreferrer">
                                      <ExternalLink className="h-3 w-3 mr-1" />
                                      Pay link
                                    </a>
                                  </Button>
                                ) : null}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </ScrollArea>
                  )}
                </div>

                {canRequestPayment ? (
                  <>
                    <div className="border-t border-emerald-100 dark:border-emerald-900/40 pt-3 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">New request</p>
                      {!paymentOptions?.integrations?.length ? (
                        <p className="text-xs text-muted-foreground">
                          Connect Razorpay or Cashfree under Integrations (with contact payments enabled) to send a link.
                        </p>
                      ) : !paymentOptions?.whatsappSessions?.length ? (
                        <p className="text-xs text-muted-foreground">
                          Add a connected WhatsApp Business session to send the payment link on WhatsApp.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs font-semibold">Amount (INR)</Label>
                              <Input
                                type="text"
                                inputMode="decimal"
                                placeholder="e.g. 499"
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                                className="h-9"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs font-semibold">Gateway</Label>
                              <Select value={paymentIntegrationId} onValueChange={setPaymentIntegrationId}>
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent>
                                  {paymentOptions.integrations.map((i) => (
                                    <SelectItem key={i.id} value={i.id}>
                                      {String(i.connectionName || i.displayName)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs font-semibold">WhatsApp session</Label>
                            <Select value={paymentSessionId} onValueChange={setPaymentSessionId}>
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent>
                                {paymentOptions.whatsappSessions.map((s) => (
                                  <SelectItem key={s.sessionId} value={s.sessionId}>
                                    {s.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs font-semibold">Note (optional)</Label>
                            <Input
                              placeholder="Shown on payment page"
                              value={paymentDesc}
                              onChange={(e) => setPaymentDesc(e.target.value)}
                              className="h-9"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs font-semibold">Customer email (optional)</Label>
                            <Input
                              type="email"
                              autoComplete="off"
                              placeholder="Also send the pay link by email"
                              value={paymentCustomerEmail}
                              onChange={(e) => setPaymentCustomerEmail(e.target.value)}
                              className="h-9"
                            />
                            <p className="text-[11px] text-muted-foreground">
                              {paymentOptions?.emailCopyAvailable
                                ? "Requires SMTP under Integrations or Settings."
                                : "SMTP not configured — link will be sent on WhatsApp only."}
                            </p>
                          </div>
                          <Button
                            type="button"
                            className="w-full font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                            disabled={contactPaymentMutation.isPending}
                            onClick={() => contactPaymentMutation.mutate()}
                          >
                            {contactPaymentMutation.isPending ? (
                              <span className="inline-flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Sending…
                              </span>
                            ) : (
                              "Create link & send on WhatsApp"
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-[11px] text-muted-foreground border-t border-emerald-100 dark:border-emerald-900/40 pt-2">
                    Only users with contact edit permission can send new payment links.
                  </p>
                )}
              </div>
            ) : null}

            <Tabs defaultValue="notes" className="w-full">
              <TabsList className="grid w-full grid-cols-3 h-11 rounded-xl bg-violet-100/80 dark:bg-violet-900/30 p-1 border border-violet-200/60 dark:border-violet-800/40">
                <TabsTrigger value="notes" className="gap-2 text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-violet-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-violet-800/50 dark:data-[state=active]:text-violet-200 rounded-lg">
                  <FileText className="h-4 w-4" /> Notes
                </TabsTrigger>
                <TabsTrigger value="activity" className="gap-2 text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-violet-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-violet-800/50 dark:data-[state=active]:text-violet-200 rounded-lg">
                  <Clock className="h-4 w-4" /> Activity
                </TabsTrigger>
                <TabsTrigger value="reminders" className="gap-2 text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-violet-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-violet-800/50 dark:data-[state=active]:text-violet-200 rounded-lg">
                  <Bell className="h-4 w-4" /> Reminders
                </TabsTrigger>
              </TabsList>
              <TabsContent value="notes" className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-bold text-foreground">Notes</Label>
                  {hasContact && (
                    <Button variant="ghost" size="sm" className="h-9 font-semibold rounded-lg bg-violet-100 hover:bg-violet-200 dark:bg-violet-900/40 dark:hover:bg-violet-800/50" onClick={() => setAddNoteOpen(true)}>
                      <Plus className="h-4 w-4 mr-1" /> Add
                    </Button>
                  )}
                </div>
                {notes.length === 0 ? (
                  <div className="rounded-xl border border-violet-200/60 dark:border-violet-800/40 bg-violet-50/50 dark:bg-violet-950/20 flex flex-col items-center justify-center py-12 text-sm font-medium text-muted-foreground">
                    <Zap className="h-12 w-12 mb-3 text-violet-400 dark:text-violet-500" />
                    <p className="font-semibold text-foreground">No notes found</p>
                    {hasContact && (
                      <Button variant="outline" size="sm" className="mt-4 font-bold bg-violet-500 hover:bg-violet-600 text-white border-0 rounded-lg" onClick={() => setAddNoteOpen(true)}>
                        <Plus className="h-4 w-4 mr-1" /> Add a note
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-violet-200/60 dark:border-violet-800/40 overflow-hidden overflow-x-auto">
                    <table className="w-full text-sm min-w-[560px]">
                      <thead>
                        <tr className="border-b border-violet-200/60 dark:border-violet-800/40 bg-violet-100/70 dark:bg-violet-900/30">
                          <th className="text-left px-3 py-2.5 font-bold text-foreground whitespace-nowrap">Created At</th>
                          <th className="text-left px-3 py-2.5 font-bold text-foreground">Message</th>
                          <th className="text-left px-3 py-2.5 font-bold text-foreground whitespace-nowrap">Created by</th>
                          <th className="text-right px-3 py-2.5 font-bold text-foreground whitespace-nowrap w-24">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {notes.map((note) => {
                          const creatorName = getCreatorDisplayName(note);
                          const creatorInitial = creatorName.slice(0, 1).toUpperCase();
                          return (
                            <tr key={note.id} className="border-b border-violet-100 dark:border-violet-900/20 last:border-0 bg-white/50 dark:bg-white/5">
                              <td className="px-3 py-2.5 whitespace-nowrap font-medium text-muted-foreground">{format(new Date(note.createdAt), "MMM d, yyyy HH:mm")}</td>
                              <td className="px-3 py-2.5 break-words font-medium">{note.message}</td>
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-8 w-8 rounded-full border-2 border-white dark:border-violet-900/50 shadow-sm bg-violet-100 dark:bg-violet-900/40">
                                    {note.userProfileImageUrl ? (
                                      <AvatarImage src={note.userProfileImageUrl} alt={creatorName} />
                                    ) : null}
                                    <AvatarFallback className="text-xs font-bold text-violet-800 dark:text-violet-200 bg-violet-200/80 dark:bg-violet-800/60">
                                      {creatorInitial}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="font-medium text-foreground">{creatorName}</span>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <div className="flex items-center justify-end gap-0.5">
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-violet-600 rounded-lg" onClick={() => { setEditingNote({ id: note.id, message: note.message }); setEditNoteMessage(note.message); }} aria-label="Edit note">
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive rounded-lg" onClick={() => deleteNoteMutation.mutate(note.id)} aria-label="Delete note">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="activity" className="mt-3 space-y-0">
                {!contactId ? (
                  <div className="rounded-xl border border-violet-200/60 dark:border-violet-800/40 bg-violet-50/50 dark:bg-violet-950/20 text-sm font-semibold text-muted-foreground text-center py-10">
                    Sync contact to see activity.
                  </div>
                ) : contactActivity.length === 0 ? (
                  <div className="rounded-xl border border-violet-200/60 dark:border-violet-800/40 bg-violet-50/50 dark:bg-violet-950/20 text-sm font-semibold text-muted-foreground text-center py-10">
                    No activity yet.
                  </div>
                ) : (
                  <div className="rounded-xl border border-violet-200/60 dark:border-violet-800/40 overflow-hidden bg-white/60 dark:bg-white/5">
                    <div className="relative max-h-[360px] overflow-y-auto py-2">
                      {/* Vertical timeline line */}
                      <div className="absolute left-[27px] top-6 bottom-6 w-0.5 bg-emerald-300 dark:bg-emerald-600/60" aria-hidden />
                      {contactActivity.map((entry) => {
                        const displayName = getActivityUserDisplayName(entry);
                        const initial = displayName.slice(0, 1).toUpperCase();
                        const label =
                          entry.action === "tag_added" && entry.metadata?.tagName
                            ? `Added tags: ${entry.metadata.tagName}.`
                            : entry.action === "tag_removed" && entry.metadata?.tagName
                              ? `Removed tags: ${entry.metadata.tagName}.`
                              : entry.action === "note_added"
                                ? "Added a note."
                                : entry.action === "reminder_added"
                                  ? "Added a reminder."
                                  : "Updated contact.";
                        return (
                          <div key={entry.id} className="relative flex gap-3 px-4 py-2.5 items-start">
                            <div className="relative z-10 shrink-0">
                              <Avatar className="h-10 w-10 rounded-full border-2 border-white dark:border-violet-900/50 shadow-sm bg-emerald-100 dark:bg-emerald-900/40">
                                {entry.userProfileImageUrl ? (
                                  <AvatarImage src={entry.userProfileImageUrl} alt={displayName} />
                                ) : null}
                                <AvatarFallback className="text-sm font-bold text-emerald-800 dark:text-emerald-200 bg-emerald-200/80 dark:bg-emerald-800/60">
                                  {initial}
                                </AvatarFallback>
                              </Avatar>
                            </div>
                            <div className="min-w-0 flex-1 pt-0.5">
                              <p className="text-sm font-bold text-foreground">{label}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{displayName}</p>
                              <p className="text-xs text-muted-foreground mt-1">{format(new Date(entry.createdAt), "MMMM d, yyyy")}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="reminders" className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-bold text-foreground">Reminders</Label>
                  {hasContact && (
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/40 dark:hover:bg-rose-800/50" onClick={openAddReminderDialog} aria-label="Add reminder">
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {reminders.length === 0 ? (
                  <div className="rounded-xl border border-rose-200/60 dark:border-rose-800/40 bg-rose-50/50 dark:bg-rose-950/20 flex flex-col items-center justify-center py-12 text-sm font-medium text-muted-foreground">
                    <p className="font-semibold text-foreground">No reminders found</p>
                    {hasContact && (
                      <Button variant="outline" size="sm" className="mt-4 font-bold rounded-lg bg-rose-500 hover:bg-rose-600 text-white border-0" onClick={openAddReminderDialog}>
                        <Plus className="h-4 w-4 mr-1" /> Add reminder
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-rose-200/60 dark:border-rose-800/40 overflow-hidden overflow-x-auto">
                    <table className="w-full text-sm min-w-[720px]">
                      <thead>
                        <tr className="border-b border-rose-200/60 dark:border-rose-800/40 bg-rose-100/70 dark:bg-rose-900/30">
                          <th className="text-left px-3 py-2.5 font-bold text-foreground whitespace-nowrap">Reminder Date</th>
                          <th className="text-left px-3 py-2.5 font-bold text-foreground">Message</th>
                          <th className="text-left px-3 py-2.5 font-bold text-foreground whitespace-nowrap">Reminder To</th>
                          <th className="text-left px-3 py-2.5 font-bold text-foreground whitespace-nowrap">Created At</th>
                          <th className="text-left px-3 py-2.5 font-bold text-foreground whitespace-nowrap">Created by</th>
                          <th className="text-right px-3 py-2.5 font-bold text-foreground whitespace-nowrap w-24">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reminders.map((r, i) => {
                          const creatorName = getCreatorDisplayName(r);
                          const creatorInitial = creatorName.slice(0, 1).toUpperCase();
                          return (
                            <tr key={r.id} className={cn("border-b border-rose-100 dark:border-rose-900/20 last:border-0", i % 2 === 0 ? "bg-rose-50/40 dark:bg-rose-950/10" : "bg-white/50 dark:bg-white/5")}>
                              <td className="px-3 py-2.5 whitespace-nowrap font-medium">{format(new Date(r.reminderAt), "MM/dd/yyyy h:mm a")}</td>
                              <td className="px-3 py-2.5 break-words font-medium">
                                {r.templateName
                                  ? `Template: ${r.templateName}`
                                  : reminderTitle(r.title, r.message)}
                                {!r.templateName && r.title && r.message && r.message.trim() !== r.title.trim() ? (
                                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground line-clamp-2">
                                    {r.message}
                                  </span>
                                ) : null}
                                {r.whatsappStatus && r.whatsappStatus !== "none" ? (
                                  <span
                                    className={cn(
                                      "mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                      r.whatsappStatus === "sent" && "bg-emerald-100 text-emerald-800",
                                      r.whatsappStatus === "pending" && "bg-amber-100 text-amber-800",
                                      r.whatsappStatus === "sending" && "bg-sky-100 text-sky-800",
                                      r.whatsappStatus === "failed" && "bg-red-100 text-red-800",
                                    )}
                                  >
                                    WhatsApp: {r.whatsappStatus}
                                    {r.whatsappStatus === "failed" && r.whatsappError
                                      ? ` — ${r.whatsappError.slice(0, 80)}`
                                      : ""}
                                  </span>
                                ) : null}
                              </td>
                              <td className="px-3 py-2.5 font-medium">{getReminderToName(r)}</td>
                              <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap font-medium">{format(new Date(r.createdAt), "MMM d, yyyy")}</td>
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-8 w-8 rounded-full border-2 border-white dark:border-rose-900/50 shadow-sm bg-rose-100 dark:bg-rose-900/40">
                                    {r.userProfileImageUrl ? (
                                      <AvatarImage src={r.userProfileImageUrl} alt={creatorName} />
                                    ) : null}
                                    <AvatarFallback className="text-xs font-bold text-rose-800 dark:text-rose-200 bg-rose-200/80 dark:bg-rose-800/60">
                                      {creatorInitial}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="font-medium text-foreground">{creatorName}</span>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <div className="flex items-center justify-end gap-0.5">
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-rose-600 rounded-lg" onClick={() => openEditReminder(r)} aria-label="Edit reminder">
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive rounded-lg" onClick={() => deleteReminderMutation.mutate(r.id)} aria-label="Delete reminder">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>

    {/* Add Note dialog */}
    <Dialog open={addNoteOpen} onOpenChange={setAddNoteOpen}>
      <DialogContent className="sm:max-w-md border-violet-200 bg-gradient-to-b from-violet-50/50 to-white dark:from-violet-950/30 dark:to-background">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Notes</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-center gap-2 text-base font-bold text-foreground">
            <Zap className="h-5 w-5 text-violet-500" />
            Add a new note
          </div>
          <Textarea
            placeholder="Type your note here..."
            value={noteMessage}
            onChange={(e) => setNoteMessage(e.target.value)}
            className="min-h-[120px] resize-y"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" className="font-semibold" onClick={() => setAddNoteOpen(false)}>Cancel</Button>
          <Button className="font-bold bg-violet-500 hover:bg-violet-600 text-white" onClick={() => noteMessage.trim() && createNoteMutation.mutate(noteMessage.trim())} disabled={!noteMessage.trim() || createNoteMutation.isPending}>
            <Plus className="h-4 w-4 mr-1" /> Add Note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Edit Note dialog */}
    <Dialog open={!!editingNote} onOpenChange={(open) => !open && setEditingNote(null)}>
      <DialogContent className="sm:max-w-md border-violet-200 bg-gradient-to-b from-violet-50/50 to-white dark:from-violet-950/30 dark:to-background">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Edit Note</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-center gap-2 text-base font-bold text-foreground">
            <Pencil className="h-5 w-5 text-violet-500" />
            Update note message
          </div>
          <Textarea
            placeholder="Type your note here..."
            value={editNoteMessage}
            onChange={(e) => setEditNoteMessage(e.target.value)}
            className="min-h-[120px] resize-y"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" className="font-semibold" onClick={() => setEditingNote(null)}>Cancel</Button>
          <Button
            className="font-bold bg-violet-500 hover:bg-violet-600 text-white"
            onClick={() => editingNote && editNoteMessage.trim() && updateNoteMutation.mutate({ noteId: editingNote.id, message: editNoteMessage.trim() })}
            disabled={!editingNote || !editNoteMessage.trim() || updateNoteMutation.isPending}
          >
            <Pencil className="h-4 w-4 mr-1" /> Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Edit Columns dialog - all fields in one modal */}
    <Dialog open={columnsEditOpen} onOpenChange={setColumnsEditOpen}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto border-sky-200 bg-gradient-to-b from-sky-50/50 to-white dark:from-sky-950/30 dark:to-background">
        <DialogHeader>
          <div className="flex items-center justify-between pr-8">
            <DialogTitle className="text-xl font-bold">Columns</DialogTitle>
            <div className="flex gap-1">
              <Link href="/columns" onClick={() => setColumnsEditOpen(false)}>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Add column">
                  <Plus className="h-4 w-4" />
                </Button>
              </Link>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setColumnsEditOpen(false)} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-4">
          {/* Left column */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>WABA Phone Number</Label>
              <Input
                placeholder="Enter WABA phone number"
                value={columnsFormValues.wabaPhoneNumber ?? ""}
                onChange={(e) => setColumnsFormValues((v) => ({ ...v, wabaPhoneNumber: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={columnsFormValues.status && columnsFormValues.status.trim() ? columnsFormValues.status : "__select__"}
                onValueChange={(v) => setColumnsFormValues((prev) => ({ ...prev, status: v === "__select__" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__select__">Select</SelectItem>
                  <SelectItem value="Lead">Lead</SelectItem>
                  <SelectItem value="Qualified">Qualified</SelectItem>
                  <SelectItem value="Customer">Customer</SelectItem>
                  <SelectItem value="Lost">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Page Name</Label>
              <Input
                placeholder="Enter page name"
                value={columnsFormValues.pageName ?? ""}
                onChange={(e) => setColumnsFormValues((v) => ({ ...v, pageName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Are You Using Any Whatsapp Marketing Tool?</Label>
              <Input
                placeholder="Enter are you using any whatsapp marketing tool"
                value={columnsFormValues.usingWhatsappTool ?? ""}
                onChange={(e) => setColumnsFormValues((v) => ({ ...v, usingWhatsappTool: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Are You A?</Label>
              <Input
                placeholder="Enter are you a?"
                value={columnsFormValues.areYouA ?? ""}
                onChange={(e) => setColumnsFormValues((v) => ({ ...v, areYouA: e.target.value }))}
              />
            </div>
          </div>
          {/* Right column */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="Enter email"
                value={columnsFormValues.email ?? ""}
                onChange={(e) => setColumnsFormValues((v) => ({ ...v, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Form Name</Label>
              <Input
                placeholder="Enter form name"
                value={columnsFormValues.formName ?? ""}
                onChange={(e) => setColumnsFormValues((v) => ({ ...v, formName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input
                placeholder="Enter city"
                value={columnsFormValues.city ?? ""}
                onChange={(e) => setColumnsFormValues((v) => ({ ...v, city: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Are you a Business Owner?</Label>
              <Input
                placeholder="Enter are you a business owner?"
                value={columnsFormValues.businessOwner ?? ""}
                onChange={(e) => setColumnsFormValues((v) => ({ ...v, businessOwner: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Pricing</Label>
              <Input
                type="number"
                placeholder="Enter pricing"
                value={columnsFormValues.pricing ?? ""}
                onChange={(e) => setColumnsFormValues((v) => ({ ...v, pricing: e.target.value }))}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            className="font-bold bg-sky-500 hover:bg-sky-600 text-white"
            onClick={() => {
              const next = { ...(customFields ?? {}) } as Record<string, string>;
              DEFAULT_COLUMNS.forEach((c) => {
                next[c.key] = (columnsFormValues[c.key] ?? "").trim();
              });
              extraColumns.forEach((c) => {
                next[c.id] = (columnsFormValues[c.id] ?? "").trim();
              });
              updateContactMutation.mutate({ customFields: next });
              setColumnsEditOpen(false);
            }}
            disabled={updateContactMutation.isPending}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Add Reminder dialog */}
    <Dialog
      open={addReminderOpen}
      onOpenChange={(open) => {
        setAddReminderOpen(open);
        if (!open) reminderCompose.resetTemplateCompose();
      }}
    >
      <DialogContent className="sm:max-w-md border-rose-200 bg-gradient-to-b from-rose-50/50 to-white dark:from-rose-950/30 dark:to-background">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Reminders</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Reminder To</Label>
            <Select value={reminderTo || undefined} onValueChange={setReminderTo}>
              <SelectTrigger>
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent>
                {reminderAssignableMembers.length === 0 ? (
                  <SelectItem value="__none__" disabled>
                    No team members available
                  </SelectItem>
                ) : (
                  reminderAssignableMembers.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      {memberDisplayName(m)}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <ReminderComposeFields
            compose={reminderCompose}
            title={reminderTitleValue}
            onTitleChange={setReminderTitleValue}
            message={reminderMessage}
            onMessageChange={setReminderMessage}
            notes={reminderNotes}
            onNotesChange={setReminderNotes}
          />
          <div className="space-y-2">
            <Label>Reminder Date & Time</Label>
            <Input
              type="datetime-local"
              value={reminderAt}
              onChange={(e) => setReminderAt(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Timezone: Asia/Kolkata (IST). WhatsApp sends at this time.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="font-semibold" onClick={() => setAddReminderOpen(false)}>Cancel</Button>
          <Button
            className="font-bold bg-rose-500 hover:bg-rose-600 text-white"
            onClick={() => createReminderMutation.mutate()}
            disabled={
              !reminderTo ||
              !reminderAt ||
              !reminderTitleValue.trim() ||
              (reminderCompose.useTemplate && !reminderCompose.templateConfigured) ||
              createReminderMutation.isPending
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Edit Reminder dialog */}
    <Dialog
      open={!!editingReminder}
      onOpenChange={(open) => {
        if (!open) {
          setEditingReminder(null);
          reminderCompose.resetTemplateCompose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md border-rose-200 bg-gradient-to-b from-rose-50/50 to-white dark:from-rose-950/30 dark:to-background">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Edit Reminder</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="font-semibold">Reminder To</Label>
            <Select value={editReminderTo || undefined} onValueChange={setEditReminderTo}>
              <SelectTrigger>
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent>
                {reminderAssignableMembers.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {memberDisplayName(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ReminderComposeFields
            compose={reminderCompose}
            title={editReminderTitle}
            onTitleChange={setEditReminderTitle}
            message={editReminderMessage}
            onMessageChange={setEditReminderMessage}
            notes={editReminderNotes}
            onNotesChange={setEditReminderNotes}
          />
          <div className="space-y-2">
            <Label className="font-semibold">Reminder Date & Time</Label>
            <Input
              type="datetime-local"
              value={editReminderAt}
              onChange={(e) => setEditReminderAt(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Timezone: Asia/Kolkata (IST). WhatsApp sends at this time.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="font-semibold" onClick={() => setEditingReminder(null)}>Cancel</Button>
          <Button
            className="font-bold bg-rose-500 hover:bg-rose-600 text-white"
            onClick={() => updateReminderMutation.mutate()}
            disabled={
              !editingReminder ||
              !editReminderTo ||
              !editReminderAt ||
              !editReminderTitle.trim() ||
              (reminderCompose.useTemplate && !reminderCompose.templateConfigured) ||
              updateReminderMutation.isPending
            }
          >
            <Pencil className="h-4 w-4 mr-1" /> Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <ReminderTemplateConfigDialog
      compose={reminderCompose}
      primaryBtnClass="font-bold bg-rose-500 hover:bg-rose-600 text-white"
    />
  </>
  );
}
