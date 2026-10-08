// @ts-nocheck
import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueries, useMutation, useInfiniteQuery, keepPreviousData } from "@tanstack/react-query";
import { ContactListSidebar } from "@/components/contact-list-sidebar";
import { MessageThread } from "@/components/message-thread";
import { MessageInput } from "@/components/message-input";
import { ChatComposerShell } from "@/components/chat-composer-shell";
import { syncLeadConnectorWidgetVisibility } from "@/lib/leadconnector-widget";
import { ConversationHeader } from "@/components/conversation-header";
import { ContactDetailsSheet } from "@/components/contact-details-sheet";
import { CatalogSendDialog } from "@/components/catalog-send-dialog";
import { WaPaySendDialog } from "@/components/wa-pay-send-dialog";
import {
  ContactCreateInvoiceDialog,
  type ContactForInvoice,
} from "@/components/contact-create-invoice-dialog";
import { MessageSquare, Smartphone, FileText, Image as ImageIcon, Send, Filter, ArrowUpDown, X, Link2, File as FileIcon, Mountain, Video, Music, Plus, Phone, ArrowUp, ArrowDown, Check, Search, Tag, Users, SquareArrowOutUpRight, UserCheck, Trash2, Banknote, CalendarClock } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWebSocket } from "@/lib/websocket";
import { apiRequest, queryClient, resolveApiUrl } from "@/lib/queryClient";
import { uploadGalleryFiles } from "@/lib/upload-gallery-files";
import { fetchLegacyListApi } from "@/lib/legacy-list-api";
import { parsePaymentAmountInput } from "@/lib/payment-amount";
import { formatUnreadBadgeLabel } from "@/lib/format-unread-badge";
import { trimMessageCacheForChat } from "@/lib/message-query-cache";
import {
  appendMessageToInfinite,
  isMessagesInfiniteData,
  mergeMessageForCache,
  mergeMessagePages,
  trimMessagesInfiniteData,
  type MessagesCursor,
} from "@/lib/messages-infinite-cache";
import { useReminderContext } from "@/contexts/reminder-context";
import { useToast } from "@/hooks/use-toast";

function normalizePhoneDigits(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

function phonesMatchDigits(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a === b || a.endsWith(b) || b.endsWith(a);
}

function findContactByPhone<T extends { phoneNumber?: string }>(
  contacts: T[],
  normalizedIncoming: string
): T | undefined {
  const exact = contacts.find(
    (c) => normalizePhoneDigits(String(c.phoneNumber || "")) === normalizedIncoming
  );
  if (exact) return exact;
  return contacts.find((c) =>
    phonesMatchDigits(normalizePhoneDigits(String(c.phoneNumber || "")), normalizedIncoming)
  );
}
import { useCurrentMemberPermissions } from "@/hooks/useCurrentMemberPermissions";
import { useAuth } from "@/hooks/useAuth";
import { getPastelColorForName, cn } from "@/lib/utils";
import { useInitialUrlSearch } from "@/hooks/use-initial-url-search";
import { useInboxAccent } from "@/panel-templates/ratehonk-v1/useInboxAccent";
import { NovaChatListItem } from "@/panel-templates/ratehonk-v1/components/inbox/NovaChatListItem";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import type { Chat, Message, WhatsappSession } from "@shared/schema";
import {
  sanitizeWhatsAppTemplateParamText,
  WHATSAPP_TEMPLATE_PARAM_MAX_CHARS,
} from "@shared/whatsapp-template-params";

type ContactTag = {
  id: string;
  name: string;
  color: string;
};

/** Stable hash → pick a consistent emoji for unknown tag titles (distinct titles spread across the pool). */
function hashStringToIndex(s: string, modulo: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % modulo;
}

/** Diverse pool for titles without a keyword rule — same title always maps to the same emoji. */
const TAG_TITLE_EMOJI_POOL = [
  "📍", "🏙️", "🗺️", "🌆", "💼", "🎯", "🔥", "🆕", "💬", "📌", "🛟", "⭐", "🏆", "📉", "✅", "❌",
  "💰", "📊", "📅", "🤝", "📞", "✉️", "🔔", "🎁", "🚀", "⚡", "🌟", "💎", "🔖", "📎", "🎪",
  "🧲", "🔑", "🛒", "📝", "🏠", "🌍", "🎓", "💡", "🌈", "🎬", "🏷️", "📣", "🧩", "🎨", "🔮",
] as const;

/** Emoji + label for inbox list pills. Rules match tag title; fallback uses hash so titles get distinct emojis. */
function getChatListStatusTag(contactTagNames: string[]): { emoji: string; label: string } | null {
  if (!contactTagNames.length) return null;
  const name = contactTagNames[0];
  const lower = name.toLowerCase().trim();
  const pick = (emoji: string) => ({ emoji, label: name });

  // Order matters: more specific phrases before loose keywords.
  if (/not\s*interested|unqualified|disqualif/i.test(lower)) return pick("❌");
  if (/interested|engaged|qualified/i.test(lower)) return pick("✅");
  if (/lead\s*win|won\b|closed[\s_-]*won|deal\s*won/i.test(lower)) return pick("🏆");
  if (/\bhot\b|urgent/i.test(lower)) return pick("🔥");
  if (/cold|warm\s*lead/i.test(lower)) return pick("❄️");
  if (/negotiat|deal\b|pipeline|proposal/i.test(lower)) return pick("💼");
  if (/lost\b|dead|reject|churn/i.test(lower)) return pick("📉");
  if (/new\s*lead|fresh\s*lead/i.test(lower)) return pick("🎯");
  if (/\bnew\b|fresh|inbound|first[\s_-]*contact/i.test(lower)) return pick("🆕");
  if (/no\s*connect|disconnected|offline|unreachable/i.test(lower)) return pick("📵");
  if (/connected|online|active\s*user/i.test(lower)) return pick("🔌");
  if (/demo|trial|sandbox/i.test(lower)) return pick("🎬");
  if (/meeting|call\s*sched|appointment/i.test(lower)) return pick("📅");
  if (/delhi|mumbai|bangalore|bengaluru|hyderabad|chennai|kolkata|pune|city|location|region|zone|area\b/i.test(lower))
    return pick("📍");
  if (/low\s*budget|budget|pricing|cost/i.test(lower)) return pick("💰");
  if (/high\s*value|enterprise|premium/i.test(lower)) return pick("💎");
  if (/\bchat\b|inbox|message|conversation/i.test(lower)) return pick("💬");
  if (/\blead\b|prospect|opportunity/i.test(lower)) return pick("🎯");
  if (/follow[\s_-]*up|callback|remind/i.test(lower)) return pick("📌");
  if (/support|help\s*desk|ticket/i.test(lower)) return pick("🛟");
  if (/vip|priority|important/i.test(lower)) return pick("⭐");
  if (/email|newsletter/i.test(lower)) return pick("✉️");
  if (/phone|whatsapp|call\b/i.test(lower)) return pick("📞");
  if (/success|closed\b|converted/i.test(lower)) return pick("🎉");

  const idx = hashStringToIndex(lower, TAG_TITLE_EMOJI_POOL.length);
  return pick(TAG_TITLE_EMOJI_POOL[idx]!);
}

type SortField = "name" | "date" | "unread";
type SortOrder = "asc" | "desc";

const CHAT_LAST_SESSION_KEY = "chat-last-session-id";
const CHAT_LAST_SESSION_IDS_KEY = "chat-last-session-ids";
const CHAT_LAST_CHAT_ID_KEY = "chat-last-chat-id";
const MESSAGES_PAGE_SIZE = 40;

function readStoredLastChatId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const id = sessionStorage.getItem(CHAT_LAST_CHAT_ID_KEY);
  return id && id.length > 0 ? id : undefined;
}

function readStoredLastSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CHAT_LAST_SESSION_KEY);
}

function readStoredSessionIds(): string[] | null {
  if (typeof window === "undefined") return null;
  const multi = localStorage.getItem(CHAT_LAST_SESSION_IDS_KEY);
  if (multi) {
    try {
      const parsed = JSON.parse(multi);
      if (Array.isArray(parsed)) {
        return parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
      }
    } catch {
      /* ignore */
    }
  }
  const single = readStoredLastSessionId();
  return single ? [single] : null;
}

function getSessionDisplayLabel(session: WhatsappSession): string {
  return (
    session.deviceInfo?.displayPhoneNumber ||
    session.deviceInfo?.phoneNumber ||
    session.deviceInfo?.verifiedName ||
    session.sessionId?.slice(0, 12) ||
    "Unknown"
  );
}

async function fetchChatsForSession(sessionId: string, skipSync = true): Promise<Chat[]> {
  const qs = skipSync ? "?skipSync=1" : "";
  const res = await apiRequest("GET", `/api/chats/${encodeURIComponent(sessionId)}${qs}`);
  return res.json();
}

async function fetchMessagesPage(chatId: string, pageParam?: MessagesCursor): Promise<Message[]> {
  let url = `/api/messages/${encodeURIComponent(chatId)}?limit=${MESSAGES_PAGE_SIZE}`;
  if (pageParam) {
    url += `&beforeAt=${encodeURIComponent(pageParam.beforeAt)}&beforeId=${encodeURIComponent(pageParam.beforeId)}`;
  }
  const res = await apiRequest("GET", url);
  return res.json();
}

/** Soft-deleted (removed on Connect) — still returned with includeDeleted=true for history */
function isSessionSoftDeleted(s: WhatsappSession): boolean {
  const d = (s as { deletedAt?: string | Date | null }).deletedAt;
  return d != null && String(d).length > 0;
}

/** True when user can send messages / live sync — connected and not soft-deleted */
function isSessionReadyForInbox(s: WhatsappSession): boolean {
  const st = String(s.status ?? "").toLowerCase();
  return st === "connected" && !isSessionSoftDeleted(s);
}

/** Default session on load: prefer last stored only if still "ready"; else first ready; else stored if only history-only sessions exist; else first session */
function resolveDefaultChatSessionId(
  all: WhatsappSession[],
  ready: WhatsappSession[],
  stored: string | null
): string | undefined {
  if (all.length === 0) return undefined;
  const inList = (id: string) => all.some((s) => s.sessionId === id);
  if (stored && inList(stored) && ready.some((s) => s.sessionId === stored)) return stored;
  if (ready.length > 0) return ready[0].sessionId;
  if (stored && inList(stored)) return stored;
  return all[0]?.sessionId;
}

function getSessionAvailabilityLabel(s: WhatsappSession): string {
  if (isSessionSoftDeleted(s)) return "Removed";
  const st = String(s.status ?? "").toLowerCase();
  if (st === "connected") return "Connected";
  if (st === "disconnected") return "Disconnected";
  if (st === "connecting") return "Connecting";
  if (st === "qr") return "Scan QR";
  return s.status || "Unknown";
}

export default function ChatPage() {
  const accent = useInboxAccent();
  const isMobile = useIsMobile();
  const [selectedChatId, setSelectedChatId] = useState<string | undefined>(readStoredLastChatId);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>(() => readStoredSessionIds() ?? []);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  useInitialUrlSearch(setSearchQuery);
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);
  const [filterAssigned, setFilterAssigned] = useState(false);
  const [filterUnassigned, setFilterUnassigned] = useState(false);
  const [filterAssignedToUserId, setFilterAssignedToUserId] = useState<string | null>(null);
  const [assignmentMode, setAssignmentMode] = useState(false);
  const [selectedContactPhones, setSelectedContactPhones] = useState<Set<string>>(new Set());
  const [assignTagOpen, setAssignTagOpen] = useState(false);
  const [assignToUserOpen, setAssignToUserOpen] = useState(false);
  const [assignToUserSelectedId, setAssignToUserSelectedId] = useState<string>("");
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [contactDetailsOpen, setContactDetailsOpen] = useState(false);
  const [chatPaymentDialogOpen, setChatPaymentDialogOpen] = useState(false);
  const [chatPayAmount, setChatPayAmount] = useState("");
  const [chatPayDesc, setChatPayDesc] = useState("");
  const [chatPayIntegrationId, setChatPayIntegrationId] = useState("");
  const [chatPayWaSessionId, setChatPayWaSessionId] = useState("");
  const [chatPayCustomerEmail, setChatPayCustomerEmail] = useState("");
  const [meetDialogOpen, setMeetDialogOpen] = useState(false);
  const [catalogDialogOpen, setCatalogDialogOpen] = useState(false);
  const [waPayDialogOpen, setWaPayDialogOpen] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [contactForInvoice, setContactForInvoice] = useState<ContactForInvoice | null>(null);
  const [meetProvider, setMeetProvider] = useState<"google_meet" | "calendly">("google_meet");
  const [meetDatetimeLocal, setMeetDatetimeLocal] = useState("");
  const [meetDurationMin, setMeetDurationMin] = useState(30);
  const [meetGoogleIntegrationId, setMeetGoogleIntegrationId] = useState("");
  const [meetCalendlyIntegrationId, setMeetCalendlyIntegrationId] = useState("");
  const [meetCalendlyUrlOverride, setMeetCalendlyUrlOverride] = useState("");
  const [meetCustomerEmail, setMeetCustomerEmail] = useState("");
  const [meetWaSessionId, setMeetWaSessionId] = useState("");
  const [permanentDeleteOpen, setPermanentDeleteOpen] = useState(false);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<WhatsappSession | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { hasPermission, isOwnerOrAdmin, isLoading: memberPermsLoading } = useCurrentMemberPermissions();
  const { isConnected: wsConnected } = useWebSocket(); // Connect to WebSocket for real-time updates

  const { data: sessions = [], isLoading: isLoadingSessions } = useQuery<WhatsappSession[]>({
    queryKey: ['/api/sessions', 'includeDeleted=true'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/sessions?includeDeleted=true');
      return res.json();
    },
    refetchInterval: (query) => {
      if (query.state.status === "error") return false;
      return wsConnected ? false : (typeof document !== "undefined" && document.hidden ? 120_000 : 60_000);
    },
    refetchOnWindowFocus: false, // Prevents refetch burst when template dialog closes – was causing Welcome to Inbox
    staleTime: 30_000,
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await apiRequest("DELETE", `/api/sessions/${encodeURIComponent(sessionId)}/permanent`);
      return res.json();
    },
    onSuccess: (_data, sessionId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions", "includeDeleted=true"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      if (typeof window !== "undefined") {
        const last = localStorage.getItem(CHAT_LAST_SESSION_KEY);
        if (last === sessionId) localStorage.removeItem(CHAT_LAST_SESSION_KEY);
        const storedIds = readStoredSessionIds();
        if (storedIds?.includes(sessionId)) {
          const next = storedIds.filter((id) => id !== sessionId);
          if (next.length > 0) {
            localStorage.setItem(CHAT_LAST_SESSION_IDS_KEY, JSON.stringify(next));
          } else {
            localStorage.removeItem(CHAT_LAST_SESSION_IDS_KEY);
          }
        }
      }
      setSelectedSessionIds((cur) => cur.filter((id) => id !== sessionId));
      toast({
        title: "Number permanently removed",
        description: "This WhatsApp number and its stored inbox history were deleted.",
      });
      setPermanentDeleteOpen(false);
      setPermanentDeleteTarget(null);
    },
    onError: (e: Error) => {
      toast({ title: "Could not delete", description: e.message, variant: "destructive" });
    },
  });

  // Get tags for filtering
  const { data: tags = [] } = useQuery<ContactTag[]>({
    queryKey: ["/api/tags"],
    queryFn: () => fetchLegacyListApi<ContactTag>("/api/tags", "tags"),
  });

  /** Contacts API returns tag ids; inbox pills need display names from /api/tags */
  const tagIdToName = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tags) m.set(t.id, t.name);
    return m;
  }, [tags]);

  // Get managed contacts with tags and assignment for filtering chats (lightweight inbox index)
  const { data: managedContacts = [] } = useQuery<Array<{
    id: string;
    name?: string;
    phoneNumber: string;
    tags?: string[];
    customFields?: Record<string, string>;
    source?: string;
  }>>({
    queryKey: ["/api/contacts/inbox-index"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/contacts/inbox-index");
      return res.json();
    },
    staleTime: 120_000,
    gcTime: 10 * 60_000,
  });

  // Get organizations and team members for Assigned To filter (only fetch members if user can view team)
  const { data: orgData } = useQuery<{ organizations?: any[] } | any[]>({
    queryKey: ["/api/organizations"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/organizations");
      const data = await res.json();
      return data;
    },
  });
  const organizationsList = Array.isArray(orgData) ? orgData : (orgData?.organizations || []);
  const orgId = organizationsList[0]?.id;
  const canViewTeamMembers = hasPermission("manage_team.view");
  const { data: teamMembers = [] } = useQuery<any[]>({
    queryKey: ["/api/organizations", orgId, "members"],
    queryFn: async () => {
      if (!orgId) return [];
      const res = await apiRequest("GET", `/api/organizations/${orgId}/members`);
      return res.json();
    },
    enabled: !!orgId && canViewTeamMembers,
  });

  // Memoized maps — rebuilding every render was O(n contacts) and triggered heavy child work on large CRM lists
  const { phoneNumberToTags, phoneToContact, phoneToAssignedTo } = useMemo(() => {
    const tagsMap = new Map<string, string[]>();
    const contactMap = new Map<string, { id: string; customFields?: Record<string, string>; source?: string }>();
    const assignedMap = new Map<string, string>();
    managedContacts.forEach((contact: { id: string; phoneNumber: string; tags?: string[]; customFields?: Record<string, string>; source?: string }) => {
      const normalizedPhone = contact.phoneNumber.replace(/[^\d]/g, '');
      tagsMap.set(normalizedPhone, contact.tags || []);
      contactMap.set(normalizedPhone, { id: contact.id, customFields: contact.customFields || {}, source: contact.source });
      if (contact.customFields?.assignedTo) {
        assignedMap.set(normalizedPhone, contact.customFields.assignedTo);
      }
    });
    return { phoneNumberToTags: tagsMap, phoneToContact: contactMap, phoneToAssignedTo: assignedMap };
  }, [managedContacts]);

  const applyAssignmentInboxFilter =
    !!orgId && !memberPermsLoading && !isOwnerOrAdmin && !!user?.id;

  // All sessions from API (include soft-deleted) — user may select any to view stored chat history
  const allSessionsForChat = sessions;
  const sessionsForInbox = useMemo(
    () => sessions.filter(isSessionReadyForInbox),
    [sessions]
  );
  const sessionsNotReadyForInbox = useMemo(
    () => sessions.filter((s) => !isSessionReadyForInbox(s)),
    [sessions]
  );

  // Keep a ref of current selection so the effect always sees the latest (avoids stale closure when effect runs after send/mutation)
  const selectedSessionIdsRef = useRef(selectedSessionIds);
  selectedSessionIdsRef.current = selectedSessionIds;

  // Preserve selected chat during refetch – prevents "Welcome to Inbox" flash when API calls or new messages arrive
  const lastKnownSelectedChatRef = useRef<Chat | null>(null);
  const selectedChatIdRef = useRef<string | undefined>(readStoredLastChatId());
  /** After mobile back, block sessionStorage restore until user picks a chat again */
  const chatListOnlyRef = useRef(false);

  const handleMobileBackToList = useCallback(() => {
    chatListOnlyRef.current = true;
    setSelectedChatId(undefined);
    selectedChatIdRef.current = undefined;
    lastKnownSelectedChatRef.current = null;
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(CHAT_LAST_CHAT_ID_KEY);
    }
  }, []);

  // Snap selection before paint: never keep deleted/disconnected as active; prefer last good session from localStorage, else first ready.
  useLayoutEffect(() => {
    if (allSessionsForChat.length === 0) {
      if (selectedSessionIdsRef.current.length > 0) setSelectedSessionIds([]);
      return;
    }
    const current = selectedSessionIdsRef.current;
    const validCurrent = current.filter((id) => allSessionsForChat.some((s) => s.sessionId === id));
    if (validCurrent.length > 0 && validCurrent.length === current.length) return;

    const stored = readStoredSessionIds();
    const storedValid =
      stored?.filter((id) => allSessionsForChat.some((s) => s.sessionId === id)) ?? [];

    let next: string[];
    if (validCurrent.length > 0) {
      next = validCurrent;
    } else if (storedValid.length > 0) {
      next = storedValid;
    } else if (sessionsForInbox.length > 0) {
      next = sessionsForInbox.map((s) => s.sessionId);
    } else {
      next = allSessionsForChat.map((s) => s.sessionId);
    }

    if (JSON.stringify(next) !== JSON.stringify(current)) {
      setSelectedSessionIds(next);
    }
  }, [allSessionsForChat, sessionsForInbox]);

  // Persist last selected sessions so they survive refresh and navigation
  useEffect(() => {
    if (selectedSessionIds.length > 0 && typeof window !== "undefined") {
      localStorage.setItem(CHAT_LAST_SESSION_IDS_KEY, JSON.stringify(selectedSessionIds));
      localStorage.setItem(CHAT_LAST_SESSION_KEY, selectedSessionIds[0]);
    }
  }, [selectedSessionIds]);

  // Persist selectedChatId so we can restore after refetch/refresh – prevents full screen Welcome flash
  useEffect(() => {
    if (selectedChatId && typeof window !== "undefined") {
      sessionStorage.setItem(CHAT_LAST_CHAT_ID_KEY, selectedChatId);
    }
  }, [selectedChatId]);

  // Drop previous thread from react-query cache when switching chats (gcTime alone can leave many large arrays in memory)
  const prevMessagesChatIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const prev = prevMessagesChatIdRef.current;
    if (prev && prev !== selectedChatId) {
      queryClient.removeQueries({ queryKey: ["/api/messages", prev], exact: true });
    }
    prevMessagesChatIdRef.current = selectedChatId;
  }, [selectedChatId]);

  // Clear template selection and reply context when chat changes
  useEffect(() => {
    setSelectedTemplateId(null);
    setSelectedTemplate(null);
    setTemplateParams([]);
    setHeaderImageId(null);
    setHeaderFormat(null);
    setReplyingTo(null);
  }, [selectedChatId]);

  // Effective session filter — any session in the list (incl. removed/disconnected for history)
  const resolvedSessionIds = useMemo(() => {
    const validSelected = selectedSessionIds.filter((id) =>
      allSessionsForChat.some((s) => s.sessionId === id)
    );
    if (validSelected.length > 0) return validSelected;

    const stored = readStoredSessionIds();
    const storedValid =
      stored?.filter((id) => allSessionsForChat.some((s) => s.sessionId === id)) ?? [];
    if (storedValid.length > 0) return storedValid;

    if (sessionsForInbox.length > 0) return sessionsForInbox.map((s) => s.sessionId);
    return allSessionsForChat.map((s) => s.sessionId);
  }, [selectedSessionIds, allSessionsForChat, sessionsForInbox]);

  const resolvedSessionIdsRef = useRef(resolvedSessionIds);
  resolvedSessionIdsRef.current = resolvedSessionIds;

  const chatsSessionIds = useMemo(() => {
    if (resolvedSessionIds.length > 0) return resolvedSessionIds;
    const stored = readStoredSessionIds();
    return stored ?? [];
  }, [resolvedSessionIds]);

  const toggleSessionSelection = useCallback((sessionId: string) => {
    setSelectedSessionIds((prev) => {
      const validPrev = prev.filter((id) => allSessionsForChat.some((s) => s.sessionId === id));
      const current = validPrev.length > 0 ? validPrev : resolvedSessionIdsRef.current;
      const isSelected = current.includes(sessionId);
      if (isSelected) {
        if (current.length <= 1) return current;
        return current.filter((id) => id !== sessionId);
      }
      return [...current, sessionId];
    });
  }, [allSessionsForChat]);

  const sessionDropdownLabel = useMemo(() => {
    const selected = resolvedSessionIds
      .map((id) => allSessionsForChat.find((s) => s.sessionId === id))
      .filter(Boolean) as WhatsappSession[];
    if (selected.length === 0) return "Select numbers";
    if (selected.length === 1) return getSessionDisplayLabel(selected[0]);
    if (selected.length === resolvedSessionIds.length && sessionsForInbox.length === selected.length) {
      return "All numbers";
    }
    return `${selected.length} numbers`;
  }, [resolvedSessionIds, allSessionsForChat, sessionsForInbox.length]);

  const chatQueries = useQueries({
    queries: chatsSessionIds.map((sessionId) => ({
      queryKey: ["/api/chats", sessionId],
      queryFn: () => fetchChatsForSession(sessionId, true),
      enabled: !!sessionId,
      placeholderData: keepPreviousData,
      refetchInterval: (query) => {
        if (query.state.status === "error") return false;
        const session = allSessionsForChat.find((s) => s.sessionId === sessionId);
        const ready = !!(session && isSessionReadyForInbox(session));
        return wsConnected || !ready
          ? false
          : typeof document !== "undefined" && document.hidden
            ? 120_000
            : 90_000;
      },
      refetchOnWindowFocus: false,
      staleTime: 60_000,
      gcTime: 10 * 60_000,
    })),
  });

  const chats = useMemo(() => chatQueries.flatMap((q) => q.data ?? []), [chatQueries]);
  const isLoadingChats = chatQueries.some((q) => q.isLoading);
  const isFetchingChats = chatQueries.some((q) => q.isFetching);

  // Subscribe to router location so we re-render when reminder dropdown navigates to /chat?contactId=... (already on /chat)
  const [location] = useLocation();
  const search = typeof window !== "undefined" ? window.location.search : "";
  const contactIdFromUrl =
    (location?.includes("?") ? new URLSearchParams(location.split("?")[1]).get("contactId") : null) ||
    (search ? new URLSearchParams(search).get("contactId") : null);
  const phoneFromUrl =
    (location?.includes("?") ? new URLSearchParams(location.split("?")[1]).get("phone") : null) ||
    (search ? new URLSearchParams(search).get("phone") : null);

  // Open chat from URL ?contactId=... or ?phone=... (e.g. Leads / Reminders). useLayoutEffect so this runs before useEffect(session restore)
  // — otherwise restore from sessionStorage can batch after this and overwrite the correct chat with the last-opened thread.
  useLayoutEffect(() => {
    try {
      if (!Array.isArray(chats) || chats.length === 0) return;

      let chatToSelect: (typeof chats)[number] | undefined;

      if (contactIdFromUrl) {
        // Reminder API returns managed contact id; chats.contactId is WhatsApp contact id, so match by managed contact -> phone -> chat
        chatToSelect = chats.find((c) => (c as { contactId?: string | null }).contactId === contactIdFromUrl);
        if (!chatToSelect && Array.isArray(managedContacts)) {
          const contact = managedContacts.find((c: { id: string; phoneNumber?: string }) => c.id === contactIdFromUrl);
          if (contact?.phoneNumber) {
            const norm = String(contact.phoneNumber).replace(/[^\d]/g, "");
            chatToSelect = chats.find((c) => String(c.contactNumber).replace(/[^\d]/g, "") === norm) ?? undefined;
          }
        }
      } else if (phoneFromUrl) {
        const norm = String(phoneFromUrl).replace(/[^\d]/g, "");
        if (norm) {
          chatToSelect = chats.find((c) => String(c.contactNumber).replace(/[^\d]/g, "") === norm) ?? undefined;
        }
      }

      if (!chatToSelect?.id) return;

      chatListOnlyRef.current = false;
      setSelectedChatId(chatToSelect.id);
      selectedChatIdRef.current = chatToSelect.id;
      if (typeof window !== "undefined") {
        sessionStorage.setItem(CHAT_LAST_CHAT_ID_KEY, chatToSelect.id);
        const url = new URL(window.location.href);
        url.searchParams.delete("contactId");
        url.searchParams.delete("phone");
        window.history.replaceState(null, "", url.pathname + (url.search || ""));
      }
    } catch (_) {
      // Avoid breaking the page if URL or chat resolution fails
    }
  }, [chats, managedContacts, contactIdFromUrl, phoneFromUrl]);

  // Messages: use effectiveSelectedChatId so we keep fetching when selectedChatId is preserved in ref during refetch
  const messagesQueryChatId = selectedChatId ?? selectedChatIdRef.current;
  const {
    data: messagesInfinite,
    isLoading: isLoadingMessages,
    isPlaceholderData: isMessagesPlaceholder,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<Message[]>({
    queryKey: ['/api/messages', messagesQueryChatId],
    enabled: !!messagesQueryChatId,
    initialPageParam: undefined as MessagesCursor | undefined,
    queryFn: ({ pageParam }) => fetchMessagesPage(messagesQueryChatId!, pageParam),
    getNextPageParam: (lastPage) => {
      if (!lastPage?.length || lastPage.length < MESSAGES_PAGE_SIZE) return undefined;
      const oldest = lastPage[0];
      const ts = oldest.timestamp ? new Date(oldest.timestamp as unknown as string).toISOString() : '';
      if (!ts || !oldest.id) return undefined;
      return { beforeAt: ts, beforeId: oldest.id };
    },
    placeholderData: keepPreviousData,
    refetchInterval: (query) => {
      if (query.state.status === "error") return false;
      return wsConnected ? false : (typeof document !== "undefined" && document.hidden ? 90_000 : 60_000);
    },
    refetchOnWindowFocus: false,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const prefetchChatMessages = useCallback((chatId: string) => {
    void queryClient.prefetchInfiniteQuery({
      queryKey: ["/api/messages", chatId],
      queryFn: ({ pageParam }) => fetchMessagesPage(chatId, pageParam as MessagesCursor | undefined),
      initialPageParam: undefined as MessagesCursor | undefined,
      staleTime: 30_000,
    });
  }, []);

  const messages = useMemo(() => {
    if (!selectedChatId) return [];
    // keepPreviousData shows the prior chat until the new thread loads — never render that in the UI
    if (isMessagesPlaceholder) return [];
    if (!messagesInfinite?.pages?.length) return [];
    const merged = mergeMessagePages(messagesInfinite.pages);
    if (merged.length > 0 && merged[0].chatId && merged[0].chatId !== selectedChatId) return [];
    return merged;
  }, [messagesInfinite, selectedChatId, isMessagesPlaceholder]);

  const isThreadLoading =
    !!selectedChatId && (isLoadingMessages || isMessagesPlaceholder) && messages.length === 0;

  // Mark incoming messages as read when they're viewed
  // useEffect(() => {
  //   if (!messages.length || !selectedChatId) return;

  //   // Find unread incoming messages (fromMe === false and status !== 'read')
  //   const unreadIncomingMessages = messages.filter(
  //     msg => !msg.fromMe && msg.status !== 'read' && msg.status !== 'failed'
  //   );

  //   if (unreadIncomingMessages.length === 0) return;

  //   // Mark each unread message as read
  //   const markAsRead = async (messageId: string) => {
  //     try {
  //       await apiRequest('PATCH', `/api/messages/${messageId}/status`, {
  //         status: 'read',
  //       });
  //     } catch (error) {
  //       console.error('Failed to mark message as read:', error);
  //     }
  //   };

  //   // Mark all unread messages as read (with a small delay to avoid rate limiting)
  //   unreadIncomingMessages.forEach((msg, index) => {
  //     setTimeout(() => {
  //       markAsRead(msg.id);
  //     }, index * 100); // 100ms delay between each request
  //   });
  // }, [messages, selectedChatId]);


  // Bulk assign tag mutation
  const bulkAssignTagMutation = useMutation({
    mutationFn: async ({ contactIds, tagId }: { contactIds: string[]; tagId: string }) => {
      const res = await apiRequest("POST", "/api/contacts/bulk/tags", {
        contactIds,
        tagId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/inbox-index"] });
      setSelectedContactPhones(new Set());
      setAssignmentMode(false);
      setAssignTagOpen(false);
      toast({ title: "Tag assigned", description: "Selected contacts have been updated." });
    },
    onError: (e: any) => {
      toast({ title: "Failed to assign", description: e.message, variant: "destructive" });
    },
  });

  const handleAssignTag = (tagId: string) => {
    const contactIds: string[] = [];
    selectedContactPhones.forEach((phone) => {
      const contact = phoneToContact.get(phone.replace(/[^\d]/g, ""));
      if (contact) contactIds.push(contact.id);
    });
    if (contactIds.length === 0) {
      toast({
        title: "No matching contacts",
        description: "Sync contacts from chats first, or selected numbers are not in your contact list.",
        variant: "destructive",
      });
      return;
    }
    bulkAssignTagMutation.mutate({ contactIds, tagId });
  };

  const optInUpdateMutation = useMutation({
    mutationFn: async ({ contactId, optIn, existingCustomFields }: { contactId: string; optIn: boolean; existingCustomFields?: Record<string, string> }) => {
      const res = await apiRequest("PATCH", `/api/contacts/${contactId}`, {
        customFields: { ...(existingCustomFields || {}), optIn: optIn ? "true" : "false" },
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/inbox-index"] });
    },
    onError: (e: any) => {
      toast({ title: "Failed to update OptIn", description: e.message, variant: "destructive" });
    },
  });

  const renameChatContactMutation = useMutation({
    mutationFn: async ({ chatId, contactName }: { chatId: string; contactName: string }) => {
      const res = await apiRequest("PATCH", `/api/chats/${encodeURIComponent(chatId)}/contact-name`, {
        contactName,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/inbox-index"] });
      toast({
        title: "Name updated",
        description: "The name is saved in inbox and contacts (when a CRM contact exists for this number).",
      });
    },
    onError: (e: Error) => {
      toast({ title: "Could not update name", description: e.message, variant: "destructive" });
    },
  });

  const bulkAssignToUserMutation = useMutation({
    mutationFn: async ({ contactIds, userId }: { contactIds: string[]; userId: string }) => {
      const res = await apiRequest("POST", "/api/contacts/bulk/assign", {
        contactIds,
        assignedToUserId: userId,
      });
      return res.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/inbox-index"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      setSelectedContactPhones(new Set());
      setAssignmentMode(false);
      setAssignToUserOpen(false);
      setAssignToUserSelectedId("");
      toast({
        title: "Assigned",
        description: `${result.successCount ?? 0} contact(s) assigned successfully`,
      });
    },
    onError: (e: any) => {
      toast({ title: "Failed to assign", description: e.message, variant: "destructive" });
    },
  });

  const handleAssignToUser = () => {
    if (!assignToUserSelectedId) {
      toast({ title: "Select a user", description: "Please select a team member to assign to.", variant: "destructive" });
      return;
    }
    const contactIds: string[] = [];
    selectedContactPhones.forEach((phone) => {
      const contact = phoneToContact.get(phone.replace(/[^\d]/g, ""));
      if (contact) contactIds.push(contact.id);
    });
    if (contactIds.length === 0) {
      toast({
        title: "No matching contacts",
        description: "Sync contacts from chats first, or selected numbers are not in your contact list.",
        variant: "destructive",
      });
      return;
    }
    bulkAssignToUserMutation.mutate({ contactIds, userId: assignToUserSelectedId });
  };

  // Mark chat as read when user opens/views it
  useEffect(() => {
    if (!selectedChatId) return;
    apiRequest("PATCH", `/api/chats/${selectedChatId}/read`)
      .then(() => {
        setLocallyReadChats((prev) => new Set(prev).add(selectedChatId));
        // Update chats cache in place instead of invalidating – invalidating causes "Welcome to Inbox" flash when new message arrives
        queryClient.setQueriesData<Chat[]>({ queryKey: ['/api/chats'] }, (old) => {
          if (!old || !Array.isArray(old)) return old;
          return old.map((c) =>
            c.id === selectedChatId ? { ...c, unreadCount: 0 } : c
          ) as Chat[];
        });
      })
      .catch(() => {});
  }, [selectedChatId]);

  // Persist selectedChatId in ref – when APIs refetch, selectedChatId must not be lost
  if (selectedChatId) selectedChatIdRef.current = selectedChatId;

  const effectiveSelectedChatId = selectedChatId ?? selectedChatIdRef.current;

  // Restore selectedChatId if it was cleared during refetch – use ref first, then sessionStorage
  useEffect(() => {
    if (chatListOnlyRef.current) return;
    // Deep-linking from Reminders (?contactId= managed contact id): never restore last-opened chat in the same tick —
    // that was overwriting the intended conversation (race with open-from-URL).
    if (typeof window !== "undefined") {
      try {
        if (new URLSearchParams(window.location.search).get("contactId")) return;
      } catch {
        /* ignore */
      }
    }
    if (effectiveSelectedChatId && !selectedChatId && resolvedSessionIds.length > 0) {
      setSelectedChatId(effectiveSelectedChatId);
      return;
    }
    // Fallback: restore from sessionStorage when both state and ref are empty (e.g. after refetch cleared everything)
    if (!selectedChatId && !selectedChatIdRef.current && resolvedSessionIds.length > 0 && Array.isArray(chats) && chats.length > 0 && typeof window !== "undefined") {
      const stored = sessionStorage.getItem(CHAT_LAST_CHAT_ID_KEY);
      if (stored && chats.some((c) => c.id === stored)) {
        setSelectedChatId(stored);
        selectedChatIdRef.current = stored;
      }
    }
  }, [effectiveSelectedChatId, selectedChatId, resolvedSessionIds, chats]);
  const selectedChatFromList = chats.find(chat => chat.id === effectiveSelectedChatId);
  // Preserve chat during refetch: when API invalidates chats or new message arrives, chats may briefly not contain
  // the selected chat. Use lastKnownSelectedChatRef to avoid flashing "Welcome to Inbox".
  if (selectedChatFromList) {
    lastKnownSelectedChatRef.current = selectedChatFromList;
  }
  const selectedChat = selectedChatFromList ?? (effectiveSelectedChatId ? lastKnownSelectedChatRef.current ?? undefined : undefined);

  const activeSession = useMemo(() => {
    if (selectedChat?.sessionId) {
      return allSessionsForChat.find((s) => s.sessionId === selectedChat.sessionId);
    }
    const firstReady = resolvedSessionIds.find((id) =>
      sessionsForInbox.some((s) => s.sessionId === id)
    );
    const fallbackId = firstReady ?? resolvedSessionIds[0];
    return fallbackId
      ? allSessionsForChat.find((s) => s.sessionId === fallbackId)
      : undefined;
  }, [selectedChat?.sessionId, resolvedSessionIds, allSessionsForChat, sessionsForInbox]);

  const isActiveSessionReady = !!(activeSession && isSessionReadyForInbox(activeSession));

  // Clear selected chat when its WhatsApp number is unchecked in the filter
  useEffect(() => {
    const chatSessionId = selectedChat?.sessionId ?? lastKnownSelectedChatRef.current?.sessionId;
    if (!chatSessionId) return;
    if (!resolvedSessionIds.includes(chatSessionId)) {
      setSelectedChatId(undefined);
      selectedChatIdRef.current = undefined;
      lastKnownSelectedChatRef.current = null;
      if (typeof window !== "undefined") sessionStorage.removeItem(CHAT_LAST_CHAT_ID_KEY);
    }
  }, [resolvedSessionIds, selectedChat?.sessionId]);

  const showMobileChatList = !isMobile || !effectiveSelectedChatId;
  const showMobileChatPane = !isMobile || !!effectiveSelectedChatId;

  const showSessionInToolbar =
    allSessionsForChat.length > 1 || sessionsNotReadyForInbox.length > 0;

  const selectedTagName =
    selectedTagFilter === "all"
      ? "All"
      : tags.find((t) => t.id === selectedTagFilter)?.name ?? "Tag";

  useEffect(() => {
    if (isMobile && showMobileChatPane) {
      syncLeadConnectorWidgetVisibility("/chat");
    }
  }, [isMobile, showMobileChatPane]);

  // Only clear selection when chat is truly gone (deleted) – NOT during refetch. Removed aggressive clear that caused Welcome flash.
  const reminderContext = useReminderContext();

  // When user clicks a reminder in the dropdown while already on /chat, open that contact's chat (context is set before navigation)
  useLayoutEffect(() => {
    const pending = reminderContext?.pendingContactIdToOpen;
    if (!pending || !Array.isArray(chats) || chats.length === 0) return;
    const contact = Array.isArray(managedContacts)
      ? managedContacts.find((c: { id: string; phoneNumber?: string }) => c.id === pending)
      : null;
    if (contact?.phoneNumber) {
      const norm = String(contact.phoneNumber).replace(/[^\d]/g, "");
      const chatToSelect = chats.find((c) => String(c.contactNumber).replace(/[^\d]/g, "") === norm);
      if (chatToSelect?.id) {
        chatListOnlyRef.current = false;
        setSelectedChatId(chatToSelect.id);
        selectedChatIdRef.current = chatToSelect.id;
        reminderContext?.setPendingContactIdToOpen(null);
        if (typeof window !== "undefined") {
          sessionStorage.setItem(CHAT_LAST_CHAT_ID_KEY, chatToSelect.id);
          const url = new URL(window.location.href);
          url.searchParams.delete("contactId");
          window.history.replaceState(null, "", url.pathname + (url.search || ""));
        }
      }
    }
  }, [reminderContext?.pendingContactIdToOpen, reminderContext?.setPendingContactIdToOpen, chats, managedContacts]);

  // If CRM assigns the open chat to someone else, drop selection so the thread is not stuck on a hidden conversation
  useEffect(() => {
    if (!user?.id || !orgId || isOwnerOrAdmin || memberPermsLoading) return;
    const selId = selectedChatId ?? selectedChatIdRef.current;
    if (!selId) return;
    const chat = lastKnownSelectedChatRef.current;
    if (!chat || chat.id !== selId) return;
    const norm = String(chat.contactNumber).replace(/\D/g, "");
    const row = managedContacts.find(
      (c: { phoneNumber: string }) => String(c.phoneNumber).replace(/\D/g, "") === norm
    );
    const assignee =
      row?.customFields?.assignedTo && String(row.customFields.assignedTo).trim() !== ""
        ? String(row.customFields.assignedTo).trim()
        : undefined;
    if (assignee && assignee !== user.id) {
      setSelectedChatId(undefined);
      selectedChatIdRef.current = undefined;
      lastKnownSelectedChatRef.current = null;
      if (typeof window !== "undefined") sessionStorage.removeItem(CHAT_LAST_CHAT_ID_KEY);
    }
  }, [managedContacts, user?.id, orgId, isOwnerOrAdmin, memberPermsLoading, selectedChatId]);

  // Sync reminder context for header reminder icon (main app header, not inbox)
  useEffect(() => {
    if (!reminderContext) return;
    if (!selectedChat) {
      reminderContext.setReminderContext(null, undefined);
      return;
    }
    const norm = selectedChat.contactNumber.replace(/[^\d]/g, "");
    const byPhone = managedContacts.filter((c: { phoneNumber?: string }) => String(c.phoneNumber || "").replace(/[^\d]/g, "") === norm);
    const nameMatch = byPhone.find((c: { name?: string }) => (c.name || "").trim() === (selectedChat.contactName || "").trim());
    const contactId = (nameMatch ?? byPhone[0])?.id ?? phoneToContact.get(norm)?.id ?? null;
    reminderContext.setReminderContext(contactId, () => setContactDetailsOpen(true));
    return () => reminderContext.setReminderContext(null, undefined);
  }, [reminderContext, selectedChat?.id, selectedChat?.contactNumber, selectedChat?.contactName, managedContacts]);

  /** Load payment/scheduling options when user can view or edit contacts (edit alone used to 403 GET /api/payments/options). */
  const canLoadChatPaymentAndScheduling =
    !memberPermsLoading &&
    (hasPermission("manage_contacts.view") || hasPermission("manage_contacts.edit")) &&
    !!selectedChat?.id;

  const canSendChatPaymentFromInput =
    !memberPermsLoading && hasPermission("manage_contacts.edit") && !!selectedChat?.id;

  const { data: chatPaymentOptions } = useQuery<{
    emailCopyAvailable?: boolean;
    integrations: Array<{ id: string; name: string; displayName?: string; connectionName?: string }>;
    whatsappSessions: Array<{ sessionId: string; label: string }>;
  }>({
    queryKey: ["/api/payments/options"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/payments/options");
      return res.json();
    },
    enabled: canLoadChatPaymentAndScheduling,
    staleTime: 60_000,
  });

  const showChatPaymentInInput =
    canSendChatPaymentFromInput &&
    !!chatPaymentOptions?.integrations?.length &&
    !!chatPaymentOptions?.whatsappSessions?.length;

  useEffect(() => {
    if (!chatPaymentDialogOpen || !chatPaymentOptions?.integrations?.length) return;
    setChatPayIntegrationId((prev) =>
      prev && chatPaymentOptions.integrations.some((i) => i.id === prev)
        ? prev
        : chatPaymentOptions.integrations[0].id
    );
  }, [chatPaymentDialogOpen, chatPaymentOptions]);

  useEffect(() => {
    if (!chatPaymentDialogOpen || !chatPaymentOptions?.whatsappSessions?.length) return;
    const sessions = chatPaymentOptions.whatsappSessions;
    const activeId = activeSession?.sessionId;
    const activeInList = activeId && sessions.some((s) => s.sessionId === activeId);
    setChatPayWaSessionId((prev) => {
      if (prev && sessions.some((s) => s.sessionId === prev)) return prev;
      if (activeInList && activeId) return activeId;
      return sessions[0].sessionId;
    });
  }, [chatPaymentDialogOpen, chatPaymentOptions, activeSession?.sessionId]);

  const chatPaymentRequestMutation = useMutation({
    mutationFn: async () => {
      if (!selectedChat?.id) throw new Error("No chat selected");
      const amt = parsePaymentAmountInput(chatPayAmount);
      const body: Record<string, unknown> = {
        chatId: selectedChat.id,
        amount: amt,
        currency: "INR",
      };
      if (chatPayDesc.trim()) body.description = chatPayDesc.trim();
      if (chatPayIntegrationId) body.integrationId = chatPayIntegrationId;
      if (chatPayWaSessionId) body.whatsappSessionId = chatPayWaSessionId;
      if (chatPayCustomerEmail.trim()) body.customerEmail = chatPayCustomerEmail.trim();
      const res = await apiRequest("POST", "/api/payments/contact-request", body);
      return res.json() as Promise<{ warning?: string }>;
    },
    onSuccess: (data) => {
      toast({
        title: "Payment request sent",
        description: data.warning || "The customer received your panel payment link on WhatsApp.",
      });
      setChatPaymentDialogOpen(false);
      setChatPayAmount("");
      setChatPayDesc("");
      setChatPayCustomerEmail("");
      if (selectedChat?.contactNumber) {
        const norm = selectedChat.contactNumber.replace(/[^\d]/g, "");
        const row = managedContacts.find(
          (c: { phoneNumber: string }) => String(c.phoneNumber).replace(/\D/g, "") === norm
        );
        if (row?.id) queryClient.invalidateQueries({ queryKey: ["/api/payments/contact-requests", row.id] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/payments/contact-requests"] });
      if (selectedChat?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/messages", selectedChat.id] });
      }
    },
    onError: (e: Error) => {
      toast({ title: "Payment request failed", description: e.message, variant: "destructive" });
    },
  });

  const { data: schedulingChatOptions } = useQuery<{
    emailCopyAvailable?: boolean;
    googleMeet: boolean;
    calendly: boolean;
    googleCalendarConnections: Array<{ id: string; label: string }>;
    calendlyConnections: Array<{ id: string; label: string }>;
    whatsappSessions: Array<{ sessionId: string; label: string }>;
  }>({
    queryKey: ["/api/scheduling/chat-options"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/scheduling/chat-options");
      return res.json();
    },
    enabled: canLoadChatPaymentAndScheduling,
    staleTime: 60_000,
  });

  const showMeetLinkInInput =
    canSendChatPaymentFromInput &&
    !!(schedulingChatOptions?.googleMeet || schedulingChatOptions?.calendly) &&
    !!schedulingChatOptions?.whatsappSessions?.length;

  useEffect(() => {
    if (!meetDialogOpen || !schedulingChatOptions) return;
    if (schedulingChatOptions.googleMeet) {
      setMeetProvider("google_meet");
    } else if (schedulingChatOptions.calendly) {
      setMeetProvider("calendly");
    }
    const g = schedulingChatOptions.googleCalendarConnections;
    if (g?.length) {
      setMeetGoogleIntegrationId((prev) => (prev && g.some((x) => x.id === prev) ? prev : g[0].id));
    }
    const c = schedulingChatOptions.calendlyConnections;
    if (c?.length) {
      setMeetCalendlyIntegrationId((prev) => (prev && c.some((x) => x.id === prev) ? prev : c[0].id));
    }
    const sessions = schedulingChatOptions.whatsappSessions;
    if (sessions?.length) {
      const activeId = activeSession?.sessionId;
      const inList = activeId && sessions.some((s) => s.sessionId === activeId);
      setMeetWaSessionId((prev) => {
        if (prev && sessions.some((s) => s.sessionId === prev)) return prev;
        if (inList && activeId) return activeId;
        return sessions[0].sessionId;
      });
    }
    const slotMs = 15 * 60 * 1000;
    const d = new Date(Math.ceil(Date.now() / slotMs) * slotMs);
    const pad = (n: number) => String(n).padStart(2, "0");
    setMeetDatetimeLocal(
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    );
  }, [meetDialogOpen, schedulingChatOptions, activeSession?.sessionId]);

  const meetLinkMutation = useMutation({
    mutationFn: async () => {
      if (!selectedChat?.id) throw new Error("No chat selected");
      if (!meetDatetimeLocal.trim()) throw new Error("Choose date and time");
      const startIso = new Date(meetDatetimeLocal).toISOString();
      const body: Record<string, unknown> = {
        chatId: selectedChat.id,
        provider: meetProvider,
        startTime: startIso,
        durationMinutes: meetDurationMin,
        whatsappSessionId: meetWaSessionId || undefined,
      };
      if (meetProvider === "google_meet" && meetGoogleIntegrationId) {
        body.integrationId = meetGoogleIntegrationId;
      }
      if (meetProvider === "calendly" && meetCalendlyIntegrationId) {
        body.integrationId = meetCalendlyIntegrationId;
      }
      if (meetProvider === "calendly" && meetCalendlyUrlOverride.trim()) {
        body.calendlySchedulingUrl = meetCalendlyUrlOverride.trim();
      }
      if (meetCustomerEmail.trim()) {
        body.customerEmail = meetCustomerEmail.trim();
      }
      const res = await apiRequest("POST", "/api/scheduling/send-meet-link", body);
      return res.json() as Promise<{ link?: string }>;
    },
    onSuccess: () => {
      toast({ title: "Meet link sent", description: "The customer received the message on WhatsApp." });
      setMeetDialogOpen(false);
      setMeetCalendlyUrlOverride("");
      setMeetCustomerEmail("");
      if (selectedChat?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/messages", selectedChat.id] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meetings/stats"] });
    },
    onError: (e: Error) => {
      toast({ title: "Could not send meet link", description: e.message, variant: "destructive" });
    },
  });

  // Check if active session is Business API
  const isBusinessAPI = activeSession?.connectionType === 'official';

  const { data: commerceSettings } = useQuery<{ metaCatalogId?: string | null }>({
    queryKey: ["/api/commerce/settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/commerce/settings");
      return res.json();
    },
    enabled: isBusinessAPI,
    staleTime: 60_000,
  });

  const showCatalogInInput =
    isBusinessAPI &&
    !memberPermsLoading &&
    hasPermission("inbox.send") &&
    !!commerceSettings?.metaCatalogId &&
    !!activeSession?.sessionId &&
    isSessionReadyForInbox(activeSession) &&
    !!selectedChat?.contactNumber;

  const { data: waPaySettings } = useQuery<{
    metaPaymentConfigurationName?: string | null;
    metaCatalogId?: string | null;
  }>({
    queryKey: ["/api/wa-pay/settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/wa-pay/settings");
      return res.json();
    },
    enabled: isBusinessAPI && hasPermission("inbox.send"),
    staleTime: 60_000,
  });

  const showWaPayInInput =
    showCatalogInInput && !!waPaySettings?.metaPaymentConfigurationName?.trim();

  const showSendInvoiceInInput =
    !memberPermsLoading && hasPermission("manage_contacts.edit") && !!selectedChat?.id;

  const chatContactForInvoice = useMemo((): ContactForInvoice | null => {
    if (!selectedChat?.contactNumber) return null;
    const norm = normalizePhoneDigits(selectedChat.contactNumber);
    const c = findContactByPhone(managedContacts, norm);
    if (!c) return null;
    const emailField = c.customFields?.email;
    return {
      id: c.id,
      name: c.name ?? selectedChat.contactName ?? null,
      phoneNumber: c.phoneNumber || selectedChat.contactNumber,
      email: typeof emailField === "string" && emailField.trim() ? emailField.trim() : null,
      customFields: c.customFields ?? null,
    };
  }, [selectedChat, managedContacts]);

  const handleOpenSendInvoice = useCallback(() => {
    if (!chatContactForInvoice) {
      toast({
        title: "Contact not found",
        description: "Add this contact under Contacts before sending an invoice.",
        variant: "destructive",
      });
      return;
    }
    setContactForInvoice(chatContactForInvoice);
    setInvoiceDialogOpen(true);
  }, [chatContactForInvoice, toast]);

  // Template modal state (must be declared before queries that reference templateDialogOpen)
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [selectedMediaPreviewCardIndex, setSelectedMediaPreviewCardIndex] = useState(0);
  const [selectedProductPreviewCardIndex, setSelectedProductPreviewCardIndex] = useState(0);
  const [templateParams, setTemplateParams] = useState<Array<{ column?: string; fallback?: string }>>([]);
  const [headerImageId, setHeaderImageId] = useState<string | null>(null);
  const [headerImageUrl, setHeaderImageUrl] = useState<string | null>(null);
  const [headerVideoId, setHeaderVideoId] = useState<string | null>(null);
  const [headerVideoUrl, setHeaderVideoUrl] = useState<string | null>(null);
  const [headerDocumentId, setHeaderDocumentId] = useState<string | null>(null);
  const [headerDocumentUrl, setHeaderDocumentUrl] = useState<string | null>(null);
  const [headerDocumentFilename, setHeaderDocumentFilename] = useState<string | null>(null);
  const [headerFormat, setHeaderFormat] = useState<string | null>(null);
  /** Send-time media URL per carousel card (indexed like template metaData.mediaCards) */
  const [carouselCardMediaUrls, setCarouselCardMediaUrls] = useState<(string | null)[]>([]);
  /** When set, gallery selection applies to this carousel card index instead of header */
  const [galleryCarouselCardIndex, setGalleryCarouselCardIndex] = useState<number | null>(null);
  const [galleryDialogOpen, setGalleryDialogOpen] = useState(false);

  // Get templates for Business API — fetch all org templates (do not pass phoneNumberId;
  // server returns [] when phoneNumberId is not in the user's connected session set).
  const activePhoneNumberId =
    activeSession?.connectionType === "official"
      ? (activeSession.deviceInfo as any)?.apiPhoneNumberId
      : undefined;
  const canViewTemplates = hasPermission("manage_templates.view");
  const { data: templatesRaw = [], isLoading: templatesLoading } = useQuery<any[]>({
    queryKey: ["/api/templates", "inbox-send"],
    queryFn: () => fetchLegacyListApi("/api/templates", "templates"),
    enabled: isBusinessAPI && canViewTemplates,
  });

  const templatesForSession = useMemo(() => {
    if (!activePhoneNumberId) return templatesRaw;
    return templatesRaw.filter(
      (t) => !t.phoneNumberId || t.phoneNumberId === activePhoneNumberId
    );
  }, [templatesRaw, activePhoneNumberId]);

  const filteredTemplates = useMemo(
    () =>
      isBusinessAPI
        ? templatesForSession.filter(
            (t) => String(t.status || "").toUpperCase() === "APPROVED"
          )
        : [],
    [isBusinessAPI, templatesForSession]
  );

  const templateDropdownHint = useMemo(() => {
    if (templatesLoading) return "Loading templates…";
    if (templatesRaw.length === 0) {
      return "No templates synced — open Manage → Whatsapp Templates and sync from Meta";
    }
    if (templatesForSession.length === 0 && activePhoneNumberId) {
      return "No templates for this WhatsApp number — sync templates for the inbox number you selected";
    }
    const pending = templatesForSession.filter(
      (t) => String(t.status || "").toUpperCase() !== "APPROVED"
    ).length;
    if (pending > 0) {
      return `No approved templates (${pending} pending/rejected on Meta)`;
    }
    return "No approved templates — create one under Manage → Whatsapp Templates";
  }, [templatesLoading, templatesRaw, templatesForSession, activePhoneNumberId]);

  // Get contact columns for template body mapping
  const { data: contactColumns = [] } = useQuery<any[]>({
    queryKey: ["/api/columns"],
    queryFn: () => fetchLegacyListApi("/api/columns", "columns"),
    enabled: templateDialogOpen,
  });
  const [galleryViewMode, setGalleryViewMode] = useState<"gallery" | "url">("gallery");
  const [galleryFileType, setGalleryFileType] = useState<"all" | "image" | "video" | "audio" | "document">("image");
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [locallyReadChats, setLocallyReadChats] = useState<Set<string>>(new Set());

  // Get phone numbers for Business API
  const { data: phoneNumbersData } = useQuery<{ success: boolean; phoneNumbers: any[] }>({
    queryKey: ['/api/integrations/whatsapp-business/added-phones'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/integrations/whatsapp-business/added-phones');
      return await res.json();
    },
    enabled: isBusinessAPI && templateDialogOpen,
  });

  // Get gallery media items
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

  // Extract template parameters from message body
  const extractTemplateParams = (message: string): Array<{ column?: string; fallback?: string }> => {
    const paramRegex = /\{\{(\d+)\}\}/g;
    const matches = Array.from(message.matchAll(paramRegex));
    if (matches.length === 0) return [];
    
    const paramNumbers = [...new Set(matches.map(m => parseInt(m[1])))].sort((a, b) => a - b);
    return paramNumbers.map(() => ({ column: '', fallback: '' }));
  };

  // Get contact for selected chat (for template param resolution)
  const contactForTemplate = selectedChat && managedContacts.length > 0
    ? (() => {
        const norm = (s: string) => String(s || '').replace(/[^\d]/g, '');
        const chatNorm = norm(selectedChat.contactNumber);
        const mc = managedContacts.find((c: any) => norm(c.phoneNumber) === chatNorm);
        return mc ? {
          name: mc.name ?? selectedChat.contactName ?? '',
          phoneNumber: mc.phoneNumber ?? selectedChat.contactNumber ?? '',
          email: (mc as any).email ?? '',
          customFields: mc.customFields ?? {},
        } : {
          name: selectedChat.contactName ?? '',
          phoneNumber: selectedChat.contactNumber ?? '',
          email: '',
          customFields: {},
        };
      })()
    : null;

  // Resolve param value from contact (column or fallback)
  const resolveParamValue = (param: { column?: string; fallback?: string }, contact: typeof contactForTemplate): string => {
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
        const col = contactColumns.find((c: any) => c.id === param.column);
        if (col && contact.customFields) raw = contact.customFields[col.label] || param.fallback || '';
        else raw = param.fallback || '';
      }
    } else {
      raw = param.fallback || '';
    }
    return sanitizeWhatsAppTemplateParamText(raw);
  };

  // Get preview text with resolved params
  const getPreviewText = (template: any, params: Array<{ column?: string; fallback?: string }>, contact: typeof contactForTemplate): string => {
    if (!template?.components) return '';
    const bodyComponent = template.components.find((c: any) => c.type === 'BODY');
    if (!bodyComponent?.text) return '';
    const matches = bodyComponent.text.match(/\{\{(\d+)\}\}/g);
    if (!matches) return bodyComponent.text;
    const vars = [...new Set(matches.map((m: string) => parseInt(m.replace(/[{}]/g, ''))))].sort((a, b) => a - b);
    let text = bodyComponent.text;
    vars.forEach((varNum, index) => {
      if (index >= params.length) return;
      const param = params[index];
      const value = resolveParamValue(param, contact) || `{{${varNum}}}`;
      text = text.replace(new RegExp(`\\{\\{${varNum}\\}\\}`, 'g'), value);
    });
    return text;
  };

  // Handle template selection
  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setSelectedMediaPreviewCardIndex(0);
    setSelectedProductPreviewCardIndex(0);
    setGalleryCarouselCardIndex(null);
    const template = filteredTemplates.find(
      (t) => t.id === templateId || t.templateId === templateId
    );
    if (template) {
      setSelectedTemplate(template);
      const tmplMeta = template?.metaData || template?.metadata || {};
      const mcs = Array.isArray(tmplMeta.mediaCards) ? tmplMeta.mediaCards : [];
      if (tmplMeta.interactiveAction === 'MEDIA_CARD_CAROUSEL' && mcs.length > 0) {
        setCarouselCardMediaUrls(Array.from({ length: mcs.length }, () => null));
      } else {
        setCarouselCardMediaUrls([]);
      }
      
      // Check for HEADER component
      const headerComponent = template.components?.find((c: any) => c.type === 'HEADER');
      if (headerComponent) {
        const format = headerComponent.format || 'TEXT';
        setHeaderFormat(format);
        setHeaderImageId(null);
        setHeaderImageUrl(null);
        setHeaderVideoId(null);
        setHeaderVideoUrl(null);
        setHeaderDocumentId(null);
        setHeaderDocumentUrl(null);
        setHeaderDocumentFilename(null);
      } else {
        setHeaderFormat(null);
        setHeaderImageId(null);
        setHeaderImageUrl(null);
        setHeaderVideoId(null);
        setHeaderVideoUrl(null);
        setHeaderDocumentId(null);
        setHeaderDocumentUrl(null);
        setHeaderDocumentFilename(null);
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
      setHeaderImageUrl(null);
      setHeaderVideoId(null);
      setHeaderVideoUrl(null);
      setHeaderDocumentId(null);
      setHeaderDocumentUrl(null);
      setHeaderDocumentFilename(null);
      setTemplateParams([]);
      setCarouselCardMediaUrls([]);
    }
  };

  const sendTextMutation = useMutation({
    mutationFn: async (data: {
      message?: string;
      templateName?: string;
      templateLanguage?: string;
      templateParams?: string[];
      headerImageId?: string;
      headerVideoId?: string;
      headerVideoUrl?: string;
      headerDocumentId?: string;
      headerDocumentUrl?: string;
      headerDocumentFilename?: string;
      carouselCardMediaUrls?: string[];
      replyToMessageId?: string;
      quotedBody?: string;
      quotedFromMe?: boolean;
    }) => {
      if (!activeSession || !selectedChat) {
        throw new Error('No active session or chat selected');
      }

      const payload: any = {
        sessionId: activeSession.sessionId,
        to: selectedChat.contactNumber,
      };

      // If template is selected, use template fields
      if (data.templateName) {
        payload.templateName = data.templateName;
        payload.templateLanguage = data.templateLanguage || 'en';
        // Only include templateParams if they exist and have non-empty values
        if (data.templateParams && data.templateParams.length > 0) {
          const nonEmptyParams = data.templateParams.filter(p => p && p.trim().length > 0);
          if (nonEmptyParams.length > 0) {
            payload.templateParams = nonEmptyParams;
          }
        }
        if (data.headerImageId !== undefined && data.headerImageId !== null && data.headerImageId !== '') {
          payload.headerImageId = data.headerImageId;
        }
        if (data.headerVideoId !== undefined && data.headerVideoId !== null && data.headerVideoId !== '') {
          payload.headerVideoId = data.headerVideoId;
        }
        if (data.headerVideoUrl !== undefined && data.headerVideoUrl !== null && data.headerVideoUrl !== '') {
          payload.headerVideoUrl = data.headerVideoUrl;
        }
        if (data.headerDocumentId !== undefined && data.headerDocumentId !== null && data.headerDocumentId !== '') {
          payload.headerDocumentId = data.headerDocumentId;
        }
        if (data.headerDocumentUrl !== undefined && data.headerDocumentUrl !== null && data.headerDocumentUrl !== '') {
          payload.headerDocumentUrl = data.headerDocumentUrl;
        }
        if (data.headerDocumentFilename !== undefined && data.headerDocumentFilename !== null && data.headerDocumentFilename !== '') {
          payload.headerDocumentFilename = data.headerDocumentFilename;
        }
        if (data.carouselCardMediaUrls && data.carouselCardMediaUrls.length > 0) {
          payload.carouselCardMediaUrls = data.carouselCardMediaUrls;
        }
      } else {
        // Regular text message (optionally a reply)
        payload.message = data.message;
        if (data.replyToMessageId) {
          payload.replyToMessageId = data.replyToMessageId;
          if (data.quotedBody !== undefined) payload.quotedBody = data.quotedBody;
          if (data.quotedFromMe !== undefined) payload.quotedFromMe = data.quotedFromMe;
        }
      }

      const res = await apiRequest('POST', '/api/messages/send-text', payload);
      return await res.json();
    },
    onSuccess: (data: any, variables) => {
      // CRITICAL: Do NOT invalidate – triggers refetch cascade that clears selectedChatId. Update cache in place only.
      const chatId = selectedChatId ?? selectedChatIdRef.current;
      const msg = data?.message;
      if (chatId && msg) {
        queryClient.setQueryData<unknown>(['/api/messages', chatId], (old) => {
          if (isMessagesInfiniteData(old)) {
            return appendMessageToInfinite(old, msg as Message);
          }
          const arr = Array.isArray(old) ? (old as Message[]) : [];
          if (!arr.length) {
            return trimMessagesInfiniteData({
              pages: [[msg as Message]],
              pageParams: [undefined],
            });
          }
          if (arr.some((m: Message) => m.id === msg.id)) {
            const merged = arr.map((m) =>
              m.id === msg.id ? mergeMessageForCache(m, msg as Message) : m
            );
            return trimMessagesInfiniteData({
              pages: [trimMessageCacheForChat(merged)],
              pageParams: [undefined],
            });
          }
          const next = [...arr, msg as Message].sort(
            (a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()
          );
          return trimMessagesInfiniteData({
            pages: [trimMessageCacheForChat(next)],
            pageParams: [undefined],
          });
        });
      }
      if (chatId) {
        const now = new Date();
        const persistedBody =
          typeof data?.message?.body === 'string' && data.message.body.trim() ? data.message.body.trim() : '';
        const lastMsg = (persistedBody || variables?.message || variables?.templateName || '[Message]') as string;
        queryClient.setQueriesData<Chat[]>({ queryKey: ['/api/chats'] }, (old) => {
          if (!old || !Array.isArray(old)) return old;
          return old.map((c) =>
            c.id === chatId ? { ...c, lastMessageTime: now, lastMessage: lastMsg } : c
          ) as Chat[];
        });
      }
      setSelectedTemplateId(null);
      setSelectedTemplate(null);
      setTemplateParams([]);
      setHeaderImageId(null);
      setHeaderImageUrl(null);
      setHeaderVideoId(null);
      setHeaderVideoUrl(null);
      setHeaderDocumentId(null);
      setHeaderDocumentUrl(null);
      setHeaderDocumentFilename(null);
      setHeaderFormat(null);
      setCarouselCardMediaUrls([]);
      setGalleryCarouselCardIndex(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send message",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const sendMediaMutation = useMutation({
    mutationFn: async ({ file, type, caption }: { file: File; type: string; caption?: string }) => {
      if (!activeSession || !selectedChat) {
        throw new Error('No active session or chat selected');
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('sessionId', activeSession.sessionId);
      formData.append('to', selectedChat.contactNumber);
      formData.append('mediaType', type);
      if (caption) formData.append('caption', caption);

      const response = await fetch(resolveApiUrl('/api/messages/send-media'), {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        let message = 'Failed to send media';
        try {
          const text = await response.text();
          if (text) {
            const body = JSON.parse(text);
            message = body.message || body.error || message;
          } else {
            message = `${response.status} ${response.statusText}`;
          }
        } catch {
          message = `${response.status} ${response.statusText}`;
        }
        throw new Error(message);
      }

      return response.json();
    },
    onSuccess: () => {
      const chatId = selectedChatId ?? selectedChatIdRef.current;
      if (chatId) {
        const now = new Date();
        queryClient.setQueriesData<Chat[]>({ queryKey: ['/api/chats'] }, (old) => {
          if (!old || !Array.isArray(old)) return old;
          return old.map((c) =>
            c.id === chatId ? { ...c, lastMessageTime: now, lastMessage: '[Media]' } : c
          ) as Chat[];
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send media",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const sendCannedMediaMutation = useMutation({
    mutationFn: async ({ imagePath, caption, fileName }: { imagePath: string; caption?: string; fileName?: string }) => {
      if (!activeSession || !selectedChat) throw new Error('No active session or chat selected');
      const res = await apiRequest('POST', '/api/messages/send-canned-media', {
        sessionId: activeSession.sessionId,
        to: selectedChat.contactNumber,
        imagePath,
        caption: caption || undefined,
        fileName: fileName || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      const chatId = selectedChatId ?? selectedChatIdRef.current;
      if (chatId) {
        const now = new Date();
        queryClient.setQueriesData<Chat[]>({ queryKey: ['/api/chats'] }, (old) => {
          if (!old || !Array.isArray(old)) return old;
          return old.map((c) =>
            c.id === chatId ? { ...c, lastMessageTime: now, lastMessage: '[Media]' } : c
          ) as Chat[];
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send image",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  // Upload media for template header (image, video, or document)
  const uploadMediaMutation = useMutation({
    mutationFn: async ({ sessionId, file, mediaType }: { sessionId: string; file: File; mediaType?: 'image' | 'video' | 'document' }) => {
      const formData = new FormData();
      formData.append('sessionId', sessionId);
      formData.append('file', file);
      if (mediaType) formData.append('mediaType', mediaType);

      const response = await fetch(resolveApiUrl('/api/media/upload'), {
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
      const mediaType = variables.mediaType || 'image';
      if (data.mediaId) {
        if (mediaType === 'video') {
          setHeaderVideoId(data.mediaId);
          if (data.url) setHeaderVideoUrl(data.url);
        } else if (mediaType === 'document') {
          setHeaderDocumentId(data.mediaId);
          if (data.url || data.previewUrl) setHeaderDocumentUrl(data.url || data.previewUrl);
          const originalName =
            data.filename ||
            variables.file?.name ||
            null;
          if (originalName) setHeaderDocumentFilename(originalName);
        } else {
          setHeaderImageId(data.mediaId);
          if (data.url) setHeaderImageUrl(data.url);
        }
      } else {
        console.error('[Chat Page] Upload response missing mediaId:', data);
        toast({
          title: "Upload incomplete",
          description: `${mediaType === 'video' ? 'Video' : mediaType === 'document' ? 'Document' : 'Image'} upload completed but media ID was not returned. Please try again.`,
          variant: "destructive",
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

  const handleSendText = async (message: string) => {
    if (selectedTemplate && isBusinessAPI && templateDialogOpen) {
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

      const stMeta = selectedTemplate?.metaData || selectedTemplate?.metadata || {};
      const stCards = Array.isArray(stMeta.mediaCards) ? stMeta.mediaCards : [];
      const isCarouselSend =
        stMeta.interactiveAction === 'MEDIA_CARD_CAROUSEL' && stCards.length > 0;
      if (isCarouselSend) {
        const missingIdx: number[] = [];
        for (let i = 0; i < stCards.length; i++) {
          const u = carouselCardMediaUrls[i];
          if (!u || !String(u).trim()) missingIdx.push(i + 1);
        }
        if (missingIdx.length > 0) {
          toast({
            title: "Carousel media required",
            description: `Select an image or video for every card (missing card(s): ${missingIdx.join(", ")}). Creation-time media is not sent—only what you pick here.`,
            variant: "destructive",
          });
          return;
        }
      }
      
      sendTextMutation.mutate({
        templateName: selectedTemplate.name,
        templateLanguage: selectedTemplate.language || 'en',
        templateParams: templateParams.length > 0
          ? templateParams.map((p) => resolveParamValue(p, contactForTemplate))
          : undefined,
        headerImageId: headerFormat === 'IMAGE' ? (headerImageId || undefined) : undefined,
        headerVideoId: headerFormat === 'VIDEO' ? (headerVideoId || undefined) : undefined,
        headerVideoUrl: headerFormat === 'VIDEO' && !headerVideoId && headerVideoUrl ? headerVideoUrl : undefined,
        headerDocumentId: headerFormat === 'DOCUMENT' ? (headerDocumentId || undefined) : undefined,
        headerDocumentUrl: headerFormat === 'DOCUMENT' ? (headerDocumentUrl || undefined) : undefined,
        headerDocumentFilename:
          headerFormat === 'DOCUMENT'
            ? (headerDocumentFilename ||
                (headerDocumentUrl ? headerDocumentUrl.split('/').pop()?.split('?')[0] : undefined) ||
                undefined)
            : undefined,
        carouselCardMediaUrls: isCarouselSend
          ? (carouselCardMediaUrls.map((u) => String(u!).trim()) as string[])
          : undefined,
      });
      // Clear template selection and close dialog immediately (like backup – keep dialog open until user clicks Send)
      setSelectedTemplateId(null);
      setSelectedTemplate(null);
      setTemplateParams([]);
      setHeaderImageId(null);
      setHeaderImageUrl(null);
      setHeaderVideoId(null);
      setHeaderVideoUrl(null);
      setHeaderDocumentId(null);
      setHeaderDocumentUrl(null);
      setHeaderDocumentFilename(null);
      setHeaderFormat(null);
      setCarouselCardMediaUrls([]);
      setGalleryCarouselCardIndex(null);
      setImageUrlInput('');
      setReplyingTo(null);
      setTemplateDialogOpen(false);
    } else {
      // Send regular text message (with reply context if replying)
      sendTextMutation.mutate({
        message,
        replyToMessageId: replyingTo?.id,
        quotedBody: replyingTo?.body ?? undefined,
        quotedFromMe: replyingTo?.fromMe,
      });
      setReplyingTo(null);
    }
  };

  const handleSendMedia = (
    file: File,
    type: 'image' | 'video' | 'audio' | 'document',
    caption?: string,
    callbacks?: { onSuccess?: () => void; onError?: (error: Error) => void }
  ) => {
    if (callbacks) {
      sendMediaMutation.mutate(
        { file, type, caption },
        {
          onSuccess: () => {
            callbacks.onSuccess?.();
          },
          onError: (error: any) => {
            const err = error instanceof Error ? error : new Error(String(error?.message ?? error));
            toast({
              title: "Failed to send media",
              description: err.message || "Please try again",
              variant: "destructive",
            });
            callbacks.onError?.(err);
          },
        }
      );
    } else {
      sendMediaMutation.mutate({ file, type, caption });
    }
  };

  const handleSendCannedImage = (payload: { imagePath: string; caption?: string; fileName?: string }) => {
    sendCannedMediaMutation.mutate(payload);
  };

  const startChatbotMutation = useMutation({
    mutationFn: async (chatbotId: string) => {
      if (!selectedChat?.sessionId || !selectedChat?.contactNumber) {
        throw new Error("No chat selected");
      }
      const res = await apiRequest("POST", `/api/chatbots/${encodeURIComponent(chatbotId)}/start`, {
        sessionId: selectedChat.sessionId,
        to: selectedChat.contactNumber,
      });
      return res.json() as Promise<{ success: boolean; chatbotName?: string; message?: string }>;
    },
    onSuccess: (data) => {
      toast({
        title: "Chatbot started",
        description: data?.chatbotName
          ? `"${data.chatbotName}" is sending to this chat.`
          : "Chatbot flow started for this contact.",
      });
      if (selectedChat?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/messages", selectedChat.id] });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Could not start chatbot",
        description: error.message || "Failed to start chatbot",
        variant: "destructive",
      });
    },
  });

  const handleStartChatbot = (chatbotId: string) => {
    if (startChatbotMutation.isPending) return;
    startChatbotMutation.mutate(chatbotId);
  };

  if (isLoadingSessions) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background p-8" data-testid="page-chat">
        <div className="text-center space-y-4">
          <div className="w-32 h-32 mx-auto rounded-full bg-muted flex items-center justify-center">
            <MessageSquare className="h-16 w-16 text-muted-foreground animate-pulse" />
          </div>
          <p className="text-sm text-muted-foreground">Loading sessions...</p>
        </div>
      </div>
    );
  }

  if (allSessionsForChat.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background p-8" data-testid="page-chat">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-32 h-32 mx-auto rounded-full bg-muted flex items-center justify-center">
            <MessageSquare className="h-16 w-16 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-lg mb-2">No WhatsApp numbers</p>
            <p className="text-sm text-muted-foreground mb-4">
              Connect your WhatsApp Business number on Connect to use the inbox.
            </p>
            <a
              href="/connect"
              className="inline-flex items-center justify-center rounded-lg text-sm font-medium h-10 px-4 py-2 bg-primary text-primary-foreground hover-elevate active-elevate-2"
            >
              Connect Device
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("flex h-full w-full min-w-0 flex-col overflow-hidden", accent.pageBg)}
      data-testid="page-chat"
    >
      <div className={cn("flex min-h-0 min-w-0 flex-1 overflow-hidden", accent.pageBg)}>
        {/* Left Sidebar — full screen on mobile when no chat selected */}
        <div
          className={cn(
            accent.sidebarWidth,
            "flex h-full min-w-0 flex-col overflow-hidden border-r bg-card",
            !showMobileChatList && "hidden",
            isMobile && showMobileChatList && "w-full max-w-full flex-1",
          )}
        >
          {/* Inbox toolbar: row 1 = tag + number + actions; row 2 = search only */}
          <div className="shrink-0 border-b bg-card" data-testid="inbox-list-toolbar">
            <div className="flex min-w-0 items-center gap-1.5 border-b border-border/60 px-2 py-2 lg:px-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={selectedTagFilter !== "all" ? "secondary" : "outline"}
                    size="icon"
                    className={cn(
                      "h-9 w-9 shrink-0",
                      selectedTagFilter === "all" && accent.tagAllActive,
                    )}
                    title={`Tags: ${selectedTagName}`}
                    aria-label={`Filter by tag: ${selectedTagName}`}
                    data-testid="button-tag-filter"
                  >
                    <Tag className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="z-[100] max-h-[min(280px,50vh)] w-52 overflow-y-auto">
                  <DropdownMenuLabel>Tags</DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() => setSelectedTagFilter("all")}
                    className="cursor-pointer"
                  >
                    <div className="flex w-full items-center gap-2">
                      {selectedTagFilter === "all" && <Check className="h-4 w-4 shrink-0" />}
                      <span className={selectedTagFilter === "all" ? "" : "ml-6"}>All</span>
                    </div>
                  </DropdownMenuItem>
                  {tags.map((tag) => (
                    <DropdownMenuItem
                      key={tag.id}
                      onClick={() => setSelectedTagFilter(tag.id)}
                      className="cursor-pointer"
                    >
                      <div className="flex w-full items-center gap-2">
                        {selectedTagFilter === tag.id && <Check className="h-4 w-4 shrink-0" />}
                        <span
                          className={cn("truncate", selectedTagFilter === tag.id ? "" : "ml-6")}
                          style={
                            selectedTagFilter === tag.id ? { color: tag.color } : undefined
                          }
                        >
                          {tag.name}
                        </span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {showSessionInToolbar ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-9 min-w-0 flex-1 justify-between truncate bg-background px-2 text-xs font-normal"
                      data-testid="select-session"
                    >
                      <span className="flex min-w-0 items-center gap-1.5 truncate">
                        <Smartphone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{sessionDropdownLabel}</span>
                      </span>
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="z-[100] max-h-[min(320px,50vh)] w-64 overflow-y-auto">
                    <DropdownMenuLabel>WhatsApp numbers</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {sessionsForInbox.map((session) => {
                      const label = getSessionDisplayLabel(session);
                      const checked = resolvedSessionIds.includes(session.sessionId);
                      return (
                        <DropdownMenuItem
                          key={session.sessionId}
                          className="cursor-pointer"
                          onSelect={(e) => e.preventDefault()}
                          onClick={() => toggleSessionSelection(session.sessionId)}
                        >
                          <div className="flex w-full min-w-0 items-center gap-2 py-0.5">
                            <Checkbox
                              checked={checked}
                              className="shrink-0"
                              onCheckedChange={() => toggleSessionSelection(session.sessionId)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
                            <Badge variant="default" className="shrink-0 px-1.5 py-0 text-[10px]">
                              Active
                            </Badge>
                          </div>
                        </DropdownMenuItem>
                      );
                    })}
                    {sessionsNotReadyForInbox.length > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        {sessionsNotReadyForInbox.map((session) => {
                          const label = getSessionDisplayLabel(session);
                          const checked = resolvedSessionIds.includes(session.sessionId);
                          return (
                            <DropdownMenuItem
                              key={`unavail-${session.sessionId}`}
                              className="cursor-pointer"
                              onSelect={(e) => e.preventDefault()}
                              onClick={() => toggleSessionSelection(session.sessionId)}
                            >
                              <div className="flex w-full min-w-0 items-center gap-2 py-0.5">
                                <Checkbox
                                  checked={checked}
                                  className="shrink-0"
                                  onCheckedChange={() => toggleSessionSelection(session.sessionId)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                                  {label}
                                </span>
                                <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px]">
                                  {getSessionAvailabilityLabel(session)}
                                </Badge>
                              </div>
                            </DropdownMenuItem>
                          );
                        })}
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    aria-label="Filter and sort conversations"
                    data-testid="button-inbox-filter"
                  >
                    <Filter className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Filter Conversations</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setFilterUnreadOnly(!filterUnreadOnly)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center gap-2 w-full">
                      {filterUnreadOnly && <Check className="h-4 w-4" />}
                      <span className={filterUnreadOnly ? "" : "ml-6"}>Unread</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setFilterAssigned(!filterAssigned)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center gap-2 w-full">
                      {filterAssigned && <Check className="h-4 w-4" />}
                      <span className={filterAssigned ? "" : "ml-6"}>Assigned</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setFilterUnassigned(!filterUnassigned)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center gap-2 w-full">
                      {filterUnassigned && <Check className="h-4 w-4" />}
                      <span className={filterUnassigned ? "" : "ml-6"}>Unassigned</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <span>Assigned To...</span>
                      {/* <ChevronRight className="h-4 w-4 ml-auto" /> */}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem onClick={() => setFilterAssignedToUserId(null)} className="cursor-pointer">
                        <div className="flex items-center gap-2 w-full">
                          {!filterAssignedToUserId && <Check className="h-4 w-4" />}
                          <span className={!filterAssignedToUserId ? "" : "ml-6"}>All</span>
                        </div>
                      </DropdownMenuItem>
                      {teamMembers.length === 0 ? (
                        <DropdownMenuItem className="text-muted-foreground">No team members</DropdownMenuItem>
                      ) : (
                        teamMembers.map((m: any) => {
                          const name = m.user?.firstName ? `${m.user.firstName} ${m.user.lastName || ''}`.trim() : m.user?.email || `User ${m.userId?.slice(0, 8)}`;
                          return (
                            <DropdownMenuItem key={m.id} onClick={() => setFilterAssignedToUserId(m.userId)} className="cursor-pointer">
                              <div className="flex items-center gap-2 w-full">
                                {filterAssignedToUserId === m.userId && <Check className="h-4 w-4" />}
                                <span className={filterAssignedToUserId === m.userId ? "" : "ml-6"}>{name}</span>
                              </div>
                            </DropdownMenuItem>
                          );
                        })
                      )}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Sort By</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => { setSortField("name"); setSortOrder(sortField === "name" && sortOrder === "asc" ? "desc" : "asc"); }} className="cursor-pointer">
                    <div className="flex items-center gap-2 w-full">
                      {sortField === "name" && <Check className="h-4 w-4" />}
                      <span className={sortField === "name" ? "" : "ml-6"}>Name</span>
                      {sortField === "name" && (sortOrder === "asc" ? <ArrowUp className="h-3 w-3 ml-auto" /> : <ArrowDown className="h-3 w-3 ml-auto" />)}
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setSortField("date"); setSortOrder(sortField === "date" && sortOrder === "asc" ? "desc" : "asc"); }} className="cursor-pointer">
                    <div className="flex items-center gap-2 w-full">
                      {sortField === "date" && <Check className="h-4 w-4" />}
                      <span className={sortField === "date" ? "" : "ml-6"}>Date</span>
                      {sortField === "date" && (sortOrder === "asc" ? <ArrowUp className="h-3 w-3 ml-auto" /> : <ArrowDown className="h-3 w-3 ml-auto" />)}
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setSortField("unread"); setSortOrder(sortField === "unread" && sortOrder === "asc" ? "desc" : "asc"); }} className="cursor-pointer">
                    <div className="flex items-center gap-2 w-full">
                      {sortField === "unread" && <Check className="h-4 w-4" />}
                      <span className={sortField === "unread" ? "" : "ml-6"}>Unread Count</span>
                      {sortField === "unread" && (sortOrder === "asc" ? <ArrowUp className="h-3 w-3 ml-auto" /> : <ArrowDown className="h-3 w-3 ml-auto" />)}
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {/* <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" title="Open in new window">
                <SquareArrowOutUpRight className="h-4 w-4" />
              </Button> */}
              {assignmentMode ? (
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    variant="secondary"
                    size="icon"
                    title="Assign selected to team member"
                    className={cn("h-9 w-9", accent.iconBtn)}
                    onClick={() => setAssignToUserOpen(true)}
                  >
                    <UserCheck className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    title="Assign tag to selected contacts"
                    className={cn("h-9 w-9", accent.iconBtn)}
                    onClick={() => setAssignTagOpen(true)}
                  >
                    <Tag className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Exit selection mode"
                    className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setAssignmentMode(false);
                      setSelectedContactPhones(new Set());
                      setAssignToUserOpen(false);
                      setAssignTagOpen(false);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  title="Select contacts to assign or tag"
                  className="h-9 w-9 shrink-0"
                  onClick={() => setAssignmentMode(true)}
                >
                  <Users className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className={cn("px-2 py-2 lg:px-3", accent.pageBg)}>
              <div className="relative min-w-0">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search here..."
                  className={cn("h-9 w-full pl-9", accent.searchInput)}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-inbox-search"
                />
              </div>
            </div>
          </div>

          <AlertDialog
            open={permanentDeleteOpen}
            onOpenChange={(open) => {
              setPermanentDeleteOpen(open);
              if (!open) setPermanentDeleteTarget(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Permanently delete this number?</AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <span>
                    This removes{" "}
                    <strong>
                      {permanentDeleteTarget?.deviceInfo?.displayPhoneNumber ||
                        permanentDeleteTarget?.deviceInfo?.phoneNumber ||
                        permanentDeleteTarget?.deviceInfo?.verifiedName ||
                        "this WhatsApp number"}
                    </strong>{" "}
                    from your workspace and deletes all stored chats and messages for it. You cannot undo this.
                  </span>
                  <span className="block text-amber-700 dark:text-amber-400 text-sm">
                    Only use this after the number was removed on Connect. To use the number again later, connect it again as a new session.
                  </span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={permanentDeleteMutation.isPending}>Cancel</AlertDialogCancel>
                <Button
                  variant="destructive"
                  disabled={permanentDeleteMutation.isPending || !permanentDeleteTarget}
                  onClick={() => {
                    if (permanentDeleteTarget) {
                      permanentDeleteMutation.mutate(permanentDeleteTarget.sessionId);
                    }
                  }}
                >
                  {permanentDeleteMutation.isPending ? "Deleting…" : "Delete permanently"}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Assign tag dialog - shown when user selects contacts and clicks tag icon */}
          <Dialog open={assignTagOpen} onOpenChange={setAssignTagOpen}>
            <DialogContent className="sm:max-w-xs">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  Assign tag
                </DialogTitle>
                <DialogDescription>
                  {selectedContactPhones.size > 0
                    ? `Assign a tag to ${selectedContactPhones.size} selected contact${selectedContactPhones.size !== 1 ? "s" : ""}`
                    : "Select contacts using the checkboxes in the list first."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1 max-h-48 overflow-y-auto py-2">
                {tags.map((tag) => (
                  <Button
                    key={tag.id}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => handleAssignTag(tag.id)}
                    disabled={bulkAssignTagMutation.isPending}
                  >
                    <span className="w-3 h-3 rounded-full mr-2 shrink-0" style={{ backgroundColor: tag.color }} />
                    {tag.name}
                  </Button>
                ))}
                {tags.length === 0 && <p className="text-xs text-muted-foreground">No tags. Create in Settings → Tags.</p>}
              </div>
            </DialogContent>
          </Dialog>

          {/* Assign to user dialog */}
          <Dialog open={assignToUserOpen} onOpenChange={(open) => { setAssignToUserOpen(open); if (!open) setAssignToUserSelectedId(""); }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Assign {selectedContactPhones.size} contact{selectedContactPhones.size !== 1 ? "s" : ""}
                </DialogTitle>
                <DialogDescription>
                  {selectedContactPhones.size > 0
                    ? `Assign ${selectedContactPhones.size} selected contact${selectedContactPhones.size !== 1 ? "s" : ""}`
                    : "Select contacts using the checkboxes in the list first."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Select user</Label>
                  <Select value={assignToUserSelectedId} onValueChange={setAssignToUserSelectedId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {teamMembers.length === 0 ? (
                        <div className="p-3 text-sm text-muted-foreground">No team members. Add in Settings → Team.</div>
                      ) : (
                        teamMembers.map((m: any) => {
                          const name = m.user?.firstName ? `${m.user.firstName} ${m.user.lastName || ""}`.trim() : m.user?.email || `User ${m.userId?.slice(0, 8)}`;
                          return (
                            <SelectItem key={m.id} value={m.userId}>{name}</SelectItem>
                          );
                        })
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAssignToUserOpen(false)}>Cancel</Button>
                <Button
                  className={accent.primaryBtn}
                  onClick={handleAssignToUser}
                  disabled={!assignToUserSelectedId || selectedContactPhones.size === 0 || bulkAssignToUserMutation.isPending}
                >
                  {bulkAssignToUserMutation.isPending ? (
                    <>Assigning...</>
                  ) : (
                    <>
                      <Users className="h-4 w-4 mr-2" />
                      Assign
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Contact List */}
          <ScrollArea className={cn("flex-1", accent.pageBg)}>
            {isLoadingChats && chats.length === 0 ? (
              <div className="p-8 text-center">
                <div
                  className={cn(
                    "w-8 h-8 border-4 border-t-transparent rounded-full animate-spin mx-auto",
                    accent.spinner,
                  )}
                />
                <p className="text-sm text-muted-foreground mt-2">Loading chats...</p>
              </div>
            ) : chats.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <p className="text-sm mb-2">No conversations yet</p>
                <p className="text-xs mt-2">
                  Chats will appear here once you receive or send messages
                </p>
              </div>
            ) : (
              <div className={accent.isRatehonk ? "nova-chat-list" : "divide-y"}>
                {chats
                  .filter((chat) => {
                    const normalizedChatNumber = chat.contactNumber
                      .replace('@c.us', '')
                      .replace('@g.us', '')
                      .replace(/[^\d]/g, '');
                    const contactTags = phoneNumberToTags.get(normalizedChatNumber) || [];
                    const matchesSearch =
                      chat.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      chat.contactNumber.includes(searchQuery) ||
                      chat.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase());
                    const matchesTag = selectedTagFilter === "all" || contactTags.includes(selectedTagFilter);
                    const matchesUnread = !filterUnreadOnly || chat.unreadCount > 0;
                    const hasTags = contactTags.length > 0;
                    const matchesAssigned = !filterAssigned || hasTags;
                    const matchesUnassigned = !filterUnassigned || !hasTags;
                    const assignedTo = phoneToAssignedTo.get(normalizedChatNumber);
                    const matchesAssignedTo = !filterAssignedToUserId || assignedTo === filterAssignedToUserId;
                    const matchesInboxAssignment =
                      !applyAssignmentInboxFilter ||
                      !assignedTo ||
                      assignedTo === user?.id;
                    return (
                      matchesSearch &&
                      matchesTag &&
                      matchesUnread &&
                      matchesAssigned &&
                      matchesUnassigned &&
                      matchesAssignedTo &&
                      matchesInboxAssignment
                    );
                  })
                  .sort((a, b) => {
                    let comparison = 0;
                    
                    if (sortField === "name") {
                      comparison = a.contactName.localeCompare(b.contactName);
                    } else if (sortField === "date") {
                      const dateA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
                      const dateB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
                      comparison = dateA - dateB;
                    } else if (sortField === "unread") {
                      comparison = (a.unreadCount || 0) - (b.unreadCount || 0);
                    }
                    
                    return sortOrder === "asc" ? comparison : -comparison;
                  })
                  .map((chat) => {
                    const normalizedPhone = chat.contactNumber.replace(/[^\d]/g, '');
                    const contactTagIds = phoneNumberToTags.get(normalizedPhone) || [];
                    const contactTagNames = contactTagIds.map((id) => tagIdToName.get(id) ?? id);
                    const statusTag = getChatListStatusTag(contactTagNames);
                    const isSelected = selectedContactPhones.has(normalizedPhone);
                    const pastelColor = getPastelColorForName(chat.contactName);

                    if (accent.isRatehonk) {
                      return (
                        <NovaChatListItem
                          key={chat.id}
                          chat={chat}
                          isActive={selectedChatId === chat.id}
                          assignmentMode={assignmentMode}
                          isAssignmentSelected={isSelected}
                          pastelColor={pastelColor}
                          checkboxClassName={accent.checkbox}
                          showUnreadBadge={!locallyReadChats.has(chat.id)}
                          statusTag={statusTag}
                          contactTagNames={contactTagNames}
                          onPrefetch={() => prefetchChatMessages(chat.id)}
                          onSelect={() => {
                            chatListOnlyRef.current = false;
                            setSelectedChatId(chat.id);
                          }}
                          onAssignmentToggle={(checked) => {
                            setSelectedContactPhones((prev) => {
                              const next = new Set(prev);
                              if (checked) next.add(normalizedPhone);
                              else next.delete(normalizedPhone);
                              return next;
                            });
                          }}
                        />
                      );
                    }

                    return (
                    <div
                      key={chat.id}
                      className={cn(
                        "w-full min-h-16 grid gap-3 py-3 px-4 text-left transition-colors",
                        selectedChatId === chat.id && !assignmentMode
                          ? accent.listSelected
                          : accent.listHover,
                      )}
                      style={{
                        gridTemplateColumns: assignmentMode
                          ? "auto 1fr 72px"
                          : "1fr 72px",
                      }}
                    >
                      {assignmentMode && (
                        <Checkbox
                          checked={isSelected}
                          className={cn(accent.checkbox, "shrink-0 mt-3")}
                          onCheckedChange={(checked) => {
                            setSelectedContactPhones((prev) => {
                              const next = new Set(prev);
                              if (checked) next.add(normalizedPhone);
                              else next.delete(normalizedPhone);
                              return next;
                            });
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                      <button
                        onMouseEnter={() => prefetchChatMessages(chat.id)}
                        onClick={() => {
                          if (assignmentMode) return;
                          chatListOnlyRef.current = false;
                          setSelectedChatId(chat.id);
                        }}
                        className="flex w-full min-w-0 items-start gap-3 overflow-hidden text-left"
                      >
                        <div className="relative shrink-0">
                          <div
                            className="relative flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold"
                            style={{
                              backgroundColor: pastelColor.bgStyle,
                              color: pastelColor.textStyle,
                            }}
                          >
                            {chat.contactName
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2)}
                            <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-[#25d366] p-0.5 dark:border-card">
                              <svg
                                viewBox="0 0 24 24"
                                className="h-full w-full fill-white text-white"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path d="M17.472 14.382c-.297-.149-1.758-1.123-2.03-1.25-.272-.128-.47-.191-.669.191-.198.382-.768 1.25-.941 1.507-.173.256-.347.29-.644.097-.297-.191-1.253-.463-2.386-1.475-.881-.788-1.477-1.761-1.65-2.056-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                              </svg>
                            </div>
                          </div>
                          {chat.unreadCount > 0 && !locallyReadChats.has(chat.id) && (
                            <Badge
                              className={cn(
                                "absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full p-0 text-xs text-white",
                                accent.unreadBadge,
                              )}
                            >
                              {formatUnreadBadgeLabel(chat.unreadCount)}
                            </Badge>
                          )}
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5 overflow-hidden">
                          <p className="truncate text-sm font-bold text-[#111b21] dark:text-foreground">
                            {chat.contactName}
                          </p>
                          {chat.lastMessage && (
                            <p className="line-clamp-2 break-words text-xs text-muted-foreground">
                              {chat.lastMessage}
                            </p>
                          )}
                          {statusTag && (
                            <span
                              className="mt-1 inline-flex w-fit max-w-full items-center gap-1 self-start rounded-md border border-neutral-300/90 bg-neutral-200 px-1.5 py-0.5 text-[11px] font-medium leading-tight text-neutral-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-600 dark:text-zinc-50"
                              title={contactTagNames.length > 1 ? contactTagNames.join(", ") : undefined}
                            >
                              <span className="shrink-0" aria-hidden>
                                {statusTag.emoji}
                              </span>
                              <span className="min-w-0 truncate">{statusTag.label}</span>
                            </span>
                          )}
                        </div>
                      </button>
                      <span className="self-start pt-1 text-right text-xs whitespace-nowrap text-muted-foreground">
                        {chat.lastMessageTime ? (() => {
                          const date = new Date(chat.lastMessageTime);
                          const today = new Date();
                          if (date.toDateString() === today.toDateString()) {
                            const hours = date.getHours();
                            const minutes = date.getMinutes().toString().padStart(2, '0');
                            const ampm = hours >= 12 ? 'pm' : 'am';
                            const h12 = hours % 12 || 12;
                            return `${h12}:${minutes} ${ampm}`;
                          }
                          const day = date.getDate().toString().padStart(2, '0');
                          const month = (date.getMonth() + 1).toString().padStart(2, '0');
                          const year = date.getFullYear();
                          return `${day}/${month}/${year}`;
                        })() : '—'}
                      </span>
                    </div>
                    );
                  })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right Pane — full screen on mobile when a chat is open */}
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
            !showMobileChatPane && "hidden",
            isMobile && showMobileChatPane && "w-full max-w-full",
          )}
        >
          {assignmentMode && (
            <div
              className={cn(
                "shrink-0 text-white px-4 py-3 text-sm font-medium flex items-center justify-between gap-2",
                accent.banner,
              )}
            >
              <span className="flex-1 text-center">Select contacts, then use the assign icon (user or tag) in the sidebar to assign to team or assign tags</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-white hover:bg-white/20 shrink-0"
                onClick={() => { setAssignmentMode(false); setSelectedContactPhones(new Set()); }}
                title="Exit selection mode"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          {selectedChat ? (
            <>
              {!isActiveSessionReady && activeSession && (
                <div className="shrink-0 bg-amber-500/90 text-amber-950 px-4 py-2 text-sm flex items-center justify-center gap-2">
                  <span>
                    {isSessionSoftDeleted(activeSession)
                      ? "This number was removed on Connect — chat history only. Re-add it on "
                      : "Number disconnected — viewing chat history only. Reconnect on "}
                    <a href="/connect" className="underline font-medium">
                      Connect
                    </a>
                    {!isSessionSoftDeleted(activeSession) ? " to send messages." : "."}
                  </span>
                </div>
              )}
              <ConversationHeader
                contactName={selectedChat.contactName}
                contactNumber={selectedChat.contactNumber}
                contactProfilePic={selectedChat.contactProfilePic ?? undefined}
                activeDeviceName={activeSession?.deviceInfo?.name ?? undefined}
                onBack={isMobile ? handleMobileBackToList : undefined}
                optIn={(() => {
                  const norm = normalizePhoneDigits(selectedChat.contactNumber);
                  const c = findContactByPhone(managedContacts, norm);
                  if (!c) return true;
                  return c.customFields?.optIn !== "false";
                })()}
                onOptInChange={(() => {
                  const norm = normalizePhoneDigits(selectedChat.contactNumber);
                  const c = findContactByPhone(managedContacts, norm);
                  if (!c) return undefined;
                  return (checked: boolean) => optInUpdateMutation.mutate({ contactId: c.id, optIn: checked, existingCustomFields: c.customFields });
                })()}
                onHeaderClick={() => setContactDetailsOpen(true)}
                onRenameContact={
                  hasPermission("manage_contacts.edit") && selectedChat.id
                    ? async (newName: string) => {
                        await renameChatContactMutation.mutateAsync({
                          chatId: selectedChat.id,
                          contactName: newName,
                        });
                      }
                    : undefined
                }
                isRenaming={renameChatContactMutation.isPending}
              />
              <ContactDetailsSheet
                open={contactDetailsOpen}
                onOpenChange={setContactDetailsOpen}
                contactName={selectedChat.contactName}
                contactNumber={selectedChat.contactNumber}
                contactProfilePic={selectedChat.contactProfilePic ?? undefined}
                contactId={(() => {
                  const norm = selectedChat.contactNumber.replace(/[^\d]/g, "");
                  const byPhone = managedContacts.filter((c: { phoneNumber?: string }) => String(c.phoneNumber || "").replace(/[^\d]/g, "") === norm);
                  const nameMatch = byPhone.find((c: { name?: string }) => (c.name || "").trim() === (selectedChat.contactName || "").trim());
                  return (nameMatch ?? byPhone[0])?.id ?? phoneToContact.get(norm)?.id ?? null;
                })()}
                tagIds={(() => {
                  const norm = selectedChat.contactNumber.replace(/[^\d]/g, "");
                  return phoneNumberToTags.get(norm) ?? [];
                })()}
                assignedTo={(() => {
                  const norm = selectedChat.contactNumber.replace(/[^\d]/g, "");
                  return phoneToAssignedTo.get(norm) ?? null;
                })()}
                customFields={(() => {
                  const norm = selectedChat.contactNumber.replace(/[^\d]/g, "");
                  return phoneToContact.get(norm)?.customFields ?? {};
                })()}
                source={(() => {
                  const norm = selectedChat.contactNumber.replace(/[^\d]/g, "");
                  return phoneToContact.get(norm)?.source ?? "whatsapp";
                })()}
              />
              <MessageThread
                key={selectedChat.id}
                messages={messages}
                isLoadingThread={isThreadLoading}
                templates={templatesForSession}
                contactName={selectedChat.contactName}
                contactProfilePic={selectedChat.contactProfilePic ?? undefined}
                sessionId={activeSession?.sessionId ?? undefined}
                chatId={selectedChat.id ?? undefined}
                hasMoreOlder={!!hasNextPage}
                isFetchingOlder={isFetchingNextPage}
                fetchOlderMessages={() => fetchNextPage()}
                onReply={setReplyingTo}
                onReact={async (message, emoji) => {
                  if (!activeSession?.sessionId) {
                    toast({ title: "Cannot react", description: "No active session.", variant: "destructive" });
                    return;
                  }
                  if (!isActiveSessionReady) {
                    toast({ title: "Cannot react", description: "Reconnect the number to send reactions.", variant: "destructive" });
                    return;
                  }
                  if (!message.whatsappMessageId) {
                    toast({ title: "Cannot react", description: "This message cannot be reacted to (e.g. older messages).", variant: "destructive" });
                    return;
                  }
                  try {
                    await apiRequest('POST', '/api/messages/send-reaction', {
                      sessionId: activeSession.sessionId,
                      messageId: message.whatsappMessageId,
                      emoji,
                    });
                  } catch (err: any) {
                    toast({
                      title: "Reaction failed",
                      description: err?.message || "Could not send reaction.",
                      variant: "destructive",
                    });
                  }
                }}
              />
              
              {/* Conversation Expired Banner */}
              {(() => {
                const hasButtonClickedInChat = messages.some(m => !m.fromMe && ((m as any).footerButtonType === 'QUICK_REPLY' || (m as any).footer_button_type === 'QUICK_REPLY'));
                const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
                const isExpired = lastMessage && !lastMessage.fromMe && (() => {
                  const lastMessageTime = new Date(lastMessage.timestamp);
                  const now = new Date();
                  const hoursDiff = (now.getTime() - lastMessageTime.getTime()) / (1000 * 60 * 60);
                  return hoursDiff > 24;
                })();
                
                return isExpired && isBusinessAPI ? (
                  <div className="border-t bg-destructive/10 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-destructive">Conversation expired</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          More than 24 hours have passed since the customer's last reply. You cannot send messages in this conversation anymore until the customer sends you a message again.
                        </p>
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        {hasButtonClickedInChat && (
                          <span className="text-xs font-medium text-[#25d366] whitespace-nowrap">Button clicked</span>
                        )}
                        <Button
                          onClick={() => setTemplateDialogOpen(true)}
                          size="sm"
                          disabled={!isActiveSessionReady}
                        >
                          <Send className="w-4 h-4 mr-2" />
                          Send template
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Message Input - Show for non-Business API or Business API within 24-hour window */}
              {(() => {
                // For Business API, check if customer has messaged within 24 hours
                if (isBusinessAPI) {
                  const lastIncomingMessage = messages.filter(m => !m.fromMe).sort((a, b) => 
                    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                  )[0];
                  
                  if (lastIncomingMessage) {
                    const lastMessageTime = new Date(lastIncomingMessage.timestamp);
                    const now = new Date();
                    const hoursDiff = (now.getTime() - lastMessageTime.getTime()) / (1000 * 60 * 60);
                    const within24Hours = hoursDiff <= 24;
                    
                    // Show regular message input if within 24-hour window
                    if (within24Hours) {
                      const hasButtonClickedInChat = messages.some(m => !m.fromMe && ((m as any).footerButtonType === 'QUICK_REPLY' || (m as any).footer_button_type === 'QUICK_REPLY'));
                      return (
                        <ChatComposerShell
                          notice="Free-form messages allowed (24h window)"
                          noticeExtra={
                            hasButtonClickedInChat ? (
                              <span className="shrink-0 text-[10px] font-medium text-[#25d366]">Button clicked</span>
                            ) : undefined
                          }
                          onSendTemplate={() => setTemplateDialogOpen(true)}
                          templateDisabled={!isActiveSessionReady}
                          onSendInvoice={showSendInvoiceInInput ? handleOpenSendInvoice : undefined}
                          invoiceDisabled={!isActiveSessionReady}
                        >
                          <MessageInput
                            chatId={selectedChat.id}
                            onSendText={handleSendText}
                            onSendMedia={handleSendMedia}
                            onSendCannedImage={handleSendCannedImage}
                            onStartChatbot={handleStartChatbot}
                            disabled={!isActiveSessionReady}
                            replyTo={replyingTo ? { id: replyingTo.id, body: replyingTo.body ?? "" } : null}
                            onClearReply={() => setReplyingTo(null)}
                            showPaymentRequest={showChatPaymentInInput}
                            onPaymentRequest={() => setChatPaymentDialogOpen(true)}
                            showMeetLink={showMeetLinkInInput}
                            onMeetLink={() => setMeetDialogOpen(true)}
                            showCatalogProduct={showCatalogInInput}
                            onCatalogProduct={() => setCatalogDialogOpen(true)}
                            showWaPay={showWaPayInInput}
                            onWaPay={() => setWaPayDialogOpen(true)}
                          />
                        </ChatComposerShell>
                      );
                    } else {
                      // Outside 24-hour window - only templates allowed
                      const hasButtonClickedInChat = messages.some(m => !m.fromMe && ((m as any).footerButtonType === 'QUICK_REPLY' || (m as any).footer_button_type === 'QUICK_REPLY'));
                      return (
                        <ChatComposerShell
                          notice="24h window expired — use a template"
                          noticeExtra={
                            hasButtonClickedInChat ? (
                              <span className="shrink-0 text-[10px] font-medium text-[#25d366]">Button clicked</span>
                            ) : undefined
                          }
                          onSendTemplate={() => setTemplateDialogOpen(true)}
                          templateDisabled={!isActiveSessionReady}
                          onSendInvoice={showSendInvoiceInInput ? handleOpenSendInvoice : undefined}
                          invoiceDisabled={!isActiveSessionReady}
                        />
                      );
                    }
                  } else {
                    // No incoming messages yet - only templates allowed
                    const hasButtonClickedInChat = messages.some(m => !m.fromMe && ((m as any).footerButtonType === 'QUICK_REPLY' || (m as any).footer_button_type === 'QUICK_REPLY'));
                    return (
                      <ChatComposerShell
                        notice="Customer must message first, or use a template"
                        noticeExtra={
                          hasButtonClickedInChat ? (
                            <span className="shrink-0 text-[10px] font-medium text-[#25d366]">Button clicked</span>
                          ) : undefined
                        }
                        onSendTemplate={() => setTemplateDialogOpen(true)}
                        templateDisabled={!isActiveSessionReady}
                        onSendInvoice={showSendInvoiceInInput ? handleOpenSendInvoice : undefined}
                        invoiceDisabled={!isActiveSessionReady}
                      />
                    );
                  }
                } else {
                  // Non-Business API - always show regular input
                  return (
                    <ChatComposerShell
                      onSendInvoice={showSendInvoiceInInput ? handleOpenSendInvoice : undefined}
                      invoiceDisabled={!isActiveSessionReady}
                    >
                      <MessageInput
                        chatId={selectedChat.id}
                        onSendText={handleSendText}
                        onSendMedia={handleSendMedia}
                        onSendCannedImage={handleSendCannedImage}
                        onStartChatbot={handleStartChatbot}
                        disabled={!isActiveSessionReady}
                        replyTo={replyingTo ? { id: replyingTo.id, body: replyingTo.body ?? "" } : null}
                        onClearReply={() => setReplyingTo(null)}
                        showPaymentRequest={showChatPaymentInInput}
                        onPaymentRequest={() => setChatPaymentDialogOpen(true)}
                        showMeetLink={showMeetLinkInInput}
                        onMeetLink={() => setMeetDialogOpen(true)}
                        showCatalogProduct={showCatalogInInput}
                        onCatalogProduct={() => setCatalogDialogOpen(true)}
                        showWaPay={showWaPayInInput}
                        onWaPay={() => setWaPayDialogOpen(true)}
                      />
                    </ChatComposerShell>
                  );
                }
              })()}
            </>
          ) : (
            <div 
              className="flex-1 flex items-center justify-center bg-[#ffffff]"
            >
              <div className="text-center space-y-8 max-w-md">
                <div>
                  <h2 className="text-4xl font-bold mb-4 text-black">Welcome to Inbox!</h2>
                  <p className="text-black">
                    Select a contact from the list to start a conversation. Your messages will appear here.
                  </p>
                </div>
                <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Card className="cursor-pointer hover:shadow-lg transition-shadow bg-[#202c33] border-[#2a3942]">
                    <CardContent className="p-6 text-center">
                      <div
                        className={cn(
                          "w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center",
                          accent.emptyIconWrap,
                        )}
                      >
                        <MessageSquare className={cn("h-6 w-6", accent.emptyIcon)} />
                      </div>
                      <p className="text-sm font-medium text-white">Real-time Chat</p>
                    </CardContent>
                  </Card>
                  <Card className="cursor-pointer hover:shadow-lg transition-shadow bg-[#202c33] border-[#2a3942]">
                    <CardContent className="p-6 text-center">
                      <div
                        className={cn(
                          "w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center",
                          accent.emptyIconWrap,
                        )}
                      >
                        <FileText className={cn("h-6 w-6", accent.emptyIcon)} />
                      </div>
                      <p className="text-sm font-medium text-white">Templates</p>
                    </CardContent>
                  </Card>
                  <Card className="cursor-pointer hover:shadow-lg transition-shadow bg-[#202c33] border-[#2a3942]">
                    <CardContent className="p-6 text-center">
                      <div
                        className={cn(
                          "w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center",
                          accent.emptyIconWrap,
                        )}
                      >
                        <ImageIcon className={cn("h-6 w-6", accent.emptyIcon)} />
                      </div>
                      <p className="text-sm font-medium text-white">Media Sharing</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showCatalogInInput && activeSession?.sessionId && selectedChat?.contactNumber ? (
        <CatalogSendDialog
          open={catalogDialogOpen}
          onOpenChange={setCatalogDialogOpen}
          sessionId={activeSession.sessionId}
          to={selectedChat.contactNumber}
          catalogId={commerceSettings?.metaCatalogId}
        />
      ) : null}

      {showWaPayInInput && activeSession?.sessionId && selectedChat?.contactNumber ? (
        <WaPaySendDialog
          open={waPayDialogOpen}
          onOpenChange={setWaPayDialogOpen}
          sessionId={activeSession.sessionId}
          to={selectedChat.contactNumber}
          contactName={selectedChat.contactName}
          catalogId={commerceSettings?.metaCatalogId}
        />
      ) : null}

      <ContactCreateInvoiceDialog
        open={invoiceDialogOpen}
        onOpenChange={setInvoiceDialogOpen}
        contact={contactForInvoice}
        organization={organizationsList[0] ?? null}
        onInvoiceCreated={() => {
          if (selectedChat?.id) {
            queryClient.invalidateQueries({ queryKey: ["/api/messages", selectedChat.id] });
          }
        }}
      />

      <Dialog open={chatPaymentDialogOpen} onOpenChange={setChatPaymentDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-chat-payment-request">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-emerald-600" />
              Send payment request
            </DialogTitle>
            <DialogDescription>
              Creates a secure pay link on your panel ({typeof window !== "undefined" ? window.location.origin : ""}/pay/…), sends it on WhatsApp, and records the request when paid.
            </DialogDescription>
          </DialogHeader>
          {!chatPaymentOptions?.integrations?.length ? (
            <p className="text-sm text-muted-foreground">
              Connect Razorpay or Cashfree under Integrations (with contact payments enabled).
            </p>
          ) : !chatPaymentOptions?.whatsappSessions?.length ? (
            <p className="text-sm text-muted-foreground">Connect a WhatsApp session to deliver the link.</p>
          ) : (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Amount (INR)</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 499"
                    value={chatPayAmount}
                    onChange={(e) => setChatPayAmount(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Gateway</Label>
                  <Select value={chatPayIntegrationId} onValueChange={setChatPayIntegrationId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {chatPaymentOptions.integrations.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {String(i.connectionName || i.displayName || i.name)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">WhatsApp session</Label>
                <Select value={chatPayWaSessionId} onValueChange={setChatPayWaSessionId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {chatPaymentOptions.whatsappSessions.map((s) => (
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
                  value={chatPayDesc}
                  onChange={(e) => setChatPayDesc(e.target.value)}
                  className="h-9"
                />
              </div>
              {chatPaymentOptions?.emailCopyAvailable ? (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Customer email (optional)</Label>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="Also send the pay link by email"
                    value={chatPayCustomerEmail}
                    onChange={(e) => setChatPayCustomerEmail(e.target.value)}
                    className="h-9"
                  />
                  <p className="text-xs text-muted-foreground">
                    Shown when SMTP is configured (Integrations or Settings).
                  </p>
                </div>
              ) : null}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setChatPaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={
                chatPaymentRequestMutation.isPending ||
                !chatPaymentOptions?.integrations?.length ||
                !chatPaymentOptions?.whatsappSessions?.length
              }
              onClick={() => chatPaymentRequestMutation.mutate()}
            >
              {chatPaymentRequestMutation.isPending ? "Sending…" : "Send link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={meetDialogOpen} onOpenChange={setMeetDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-chat-meet-link">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-sky-600" />
              Send meet / booking link
            </DialogTitle>
            <DialogDescription>
              Sends a WhatsApp message with a <strong>Google Meet</strong> link (new calendar event) or your{" "}
              <strong>Calendly</strong> booking page. This button only appears when the integration is connected.
            </DialogDescription>
          </DialogHeader>
          {!schedulingChatOptions?.whatsappSessions?.length ? (
            <p className="text-sm text-muted-foreground">Connect a WhatsApp session to send the message.</p>
          ) : !(schedulingChatOptions.googleMeet || schedulingChatOptions.calendly) ? (
            <p className="text-sm text-muted-foreground">
              Connect Google Calendar or Calendly under Integrations to use this feature.
            </p>
          ) : (
            <div className="space-y-4 py-2">
              {(schedulingChatOptions.googleMeet && schedulingChatOptions.calendly) ||
              schedulingChatOptions.googleMeet ||
              schedulingChatOptions.calendly ? (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Link type</Label>
                  <RadioGroup
                    value={meetProvider}
                    onValueChange={(v) => setMeetProvider(v as "google_meet" | "calendly")}
                    className="flex flex-col gap-2"
                  >
                    {schedulingChatOptions.googleMeet ? (
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <RadioGroupItem value="google_meet" id="meet-google" />
                        <span>Google Meet (new event)</span>
                      </label>
                    ) : null}
                    {schedulingChatOptions.calendly ? (
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <RadioGroupItem value="calendly" id="meet-calendly" />
                        <span>Calendly (scheduling page)</span>
                      </label>
                    ) : null}
                  </RadioGroup>
                </div>
              ) : null}

              {meetProvider === "google_meet" && schedulingChatOptions.googleCalendarConnections.length > 1 ? (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Google connection</Label>
                  <Select value={meetGoogleIntegrationId} onValueChange={setMeetGoogleIntegrationId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {schedulingChatOptions.googleCalendarConnections.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {meetProvider === "calendly" && schedulingChatOptions.calendlyConnections.length > 1 ? (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Calendly connection</Label>
                  <Select value={meetCalendlyIntegrationId} onValueChange={setMeetCalendlyIntegrationId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {schedulingChatOptions.calendlyConnections.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Date &amp; time</Label>
                <Input
                  type="datetime-local"
                  value={meetDatetimeLocal}
                  onChange={(e) => setMeetDatetimeLocal(e.target.value)}
                  className="h-9"
                />
              </div>

              {meetProvider === "google_meet" ? (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Duration (minutes)</Label>
                  <Input
                    type="number"
                    min={15}
                    max={480}
                    step={15}
                    value={meetDurationMin}
                    onChange={(e) => setMeetDurationMin(Math.max(15, Math.min(480, parseInt(e.target.value, 10) || 30)))}
                    className="h-9"
                  />
                </div>
              ) : null}

              {meetProvider === "calendly" ? (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Custom Calendly URL (optional)</Label>
                  <Input
                    type="url"
                    placeholder="https://calendly.com/… (overrides auto-detected link)"
                    value={meetCalendlyUrlOverride}
                    onChange={(e) => setMeetCalendlyUrlOverride(e.target.value)}
                    className="h-9"
                  />
                </div>
              ) : null}

              <div className="space-y-1">
                <Label className="text-xs font-semibold">WhatsApp session</Label>
                <Select value={meetWaSessionId} onValueChange={setMeetWaSessionId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {schedulingChatOptions.whatsappSessions.map((s) => (
                      <SelectItem key={s.sessionId} value={s.sessionId}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {schedulingChatOptions?.emailCopyAvailable ? (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Customer email (optional)</Label>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="Also send the link by email"
                    value={meetCustomerEmail}
                    onChange={(e) => setMeetCustomerEmail(e.target.value)}
                    className="h-9"
                  />
                  <p className="text-xs text-muted-foreground">
                    Shown when SMTP is configured (Integrations or Settings).
                  </p>
                </div>
              ) : null}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setMeetDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-sky-600 hover:bg-sky-700"
              disabled={
                meetLinkMutation.isPending ||
                !schedulingChatOptions?.whatsappSessions?.length ||
                !(schedulingChatOptions?.googleMeet || schedulingChatOptions?.calendly)
              }
              onClick={() => meetLinkMutation.mutate()}
            >
              {meetLinkMutation.isPending ? "Sending…" : "Send to chat"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                      {/* Header media first — WhatsApp shows image, then body, then buttons */}
                      {headerFormat === 'IMAGE' && headerImageUrl && (
                        <div
                          className="relative overflow-hidden -mx-4 -mt-4 mb-2 rounded-t-[7.5px]"
                          style={{ width: 'calc(100% + 2rem)', maxHeight: '300px' }}
                        >
                          <img src={headerImageUrl} alt="Template header" className="block w-full h-auto object-cover" />
                        </div>
                      )}
                      {headerFormat === 'VIDEO' && headerVideoUrl && (
                        <div
                          className="relative overflow-hidden -mx-4 -mt-4 mb-2 rounded-t-[7.5px]"
                          style={{ width: 'calc(100% + 2rem)', maxHeight: '300px' }}
                        >
                          <video src={headerVideoUrl} controls className="block w-full h-auto object-cover" />
                        </div>
                      )}
                      {headerFormat === 'DOCUMENT' && (headerDocumentUrl || headerDocumentId) && (
                        <div
                          className="relative overflow-hidden -mx-4 -mt-4 mb-2 bg-[#e9edef] px-4 py-6 flex flex-col items-center gap-2 rounded-t-[7.5px]"
                          style={{ width: 'calc(100% + 2rem)' }}
                        >
                          <FileText className="h-10 w-10 text-[#54656f]" />
                          <p className="text-xs text-[#54656f] text-center truncate max-w-full px-2">
                            {headerDocumentUrl
                              ? (headerDocumentUrl.split('/').pop() || 'Document attached')
                              : 'Document attached'}
                          </p>
                        </div>
                      )}

                      {/* Body */}
                      {selectedTemplate.components?.find((c: any) => c.type === 'BODY')?.text && (() => {
                        const bodyText = getPreviewText(selectedTemplate, templateParams, contactForTemplate);
                        return (
                          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap mb-3">
                            {bodyText}
                          </p>
                        );
                      })()}

                      {(() => {
                        const templateMeta = selectedTemplate?.metaData || selectedTemplate?.metadata || {};
                        const productCards = Array.isArray(templateMeta.productCards) ? templateMeta.productCards : [];
                        const isProductCarousel =
                          templateMeta.interactiveAction === "PRODUCT_CARD_CAROUSEL" && productCards.length > 0;

                        if (!isProductCarousel) return null;

                        const currentProduct = productCards[selectedProductPreviewCardIndex];
                        if (!currentProduct) return null;

                        return (
                          <div className="mb-3">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs text-gray-600">
                                Product Card Carousel ({productCards.length} card{productCards.length > 1 ? "s" : ""})
                              </p>
                              {productCards.length > 1 && (
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() => setSelectedProductPreviewCardIndex((prev) => Math.max(0, prev - 1))}
                                    disabled={selectedProductPreviewCardIndex === 0}
                                  >
                                    <ChevronLeft className="h-4 w-4" />
                                  </Button>
                                  <span className="text-xs text-muted-foreground">
                                    {selectedProductPreviewCardIndex + 1}/{productCards.length}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() =>
                                      setSelectedProductPreviewCardIndex((prev) =>
                                        Math.min(productCards.length - 1, prev + 1)
                                      )
                                    }
                                    disabled={selectedProductPreviewCardIndex === productCards.length - 1}
                                  >
                                    <ChevronRight className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </div>
                            <div className="border rounded-lg p-3 bg-gray-50">
                              <div className="w-full min-h-[120px] rounded-lg bg-gray-200 flex flex-col items-center justify-center text-sm text-gray-600 gap-1 mb-2">
                                <span className="font-medium text-gray-800">
                                  {currentProduct.productName || currentProduct.productRetailerId || "Catalog product"}
                                </span>
                                {currentProduct.productRetailerId ? (
                                  <span className="text-xs text-gray-500">ID: {currentProduct.productRetailerId}</span>
                                ) : null}
                              </div>
                              <button type="button" className="w-full text-left px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs text-gray-700">
                                {currentProduct.buttonLabel || "View"}
                                {(productCards[0]?.buttonType || "spm") === "url" ? " ↗" : ""}
                              </button>
                            </div>
                          </div>
                        );
                      })()}

                      {(() => {
                        const templateMeta = selectedTemplate?.metaData || selectedTemplate?.metadata || {};
                        const mediaCards = Array.isArray(templateMeta.mediaCards) ? templateMeta.mediaCards : [];
                        const isMediaCarousel = templateMeta.interactiveAction === 'MEDIA_CARD_CAROUSEL' && mediaCards.length > 0;

                        if (!isMediaCarousel) return null;

                        const currentCard = mediaCards[selectedMediaPreviewCardIndex];
                        if (!currentCard) return null;
                        const selectedCarouselUrl = carouselCardMediaUrls[selectedMediaPreviewCardIndex];
                        const cardMediaPreview =
                          typeof selectedCarouselUrl === "string" && selectedCarouselUrl.trim()
                            ? selectedCarouselUrl.trim()
                            : null;

                        return (
                          <div className="mb-3">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs text-gray-600">Media Card Carousel ({mediaCards.length} card{mediaCards.length > 1 ? 's' : ''})</p>
                              {mediaCards.length > 1 && (
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() => setSelectedMediaPreviewCardIndex((prev) => Math.max(0, prev - 1))}
                                    disabled={selectedMediaPreviewCardIndex === 0}
                                  >
                                    <ChevronLeft className="h-4 w-4" />
                                  </Button>
                                  <span className="text-xs text-muted-foreground">{selectedMediaPreviewCardIndex + 1}/{mediaCards.length}</span>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() => setSelectedMediaPreviewCardIndex((prev) => Math.min(mediaCards.length - 1, prev + 1))}
                                    disabled={selectedMediaPreviewCardIndex === mediaCards.length - 1}
                                  >
                                    <ChevronRight className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </div>

                            <div className="border rounded-lg p-3 bg-gray-50">
                              {currentCard.mediaType === 'IMAGE' && cardMediaPreview ? (
                                <img src={cardMediaPreview} alt={`Media card ${selectedMediaPreviewCardIndex + 1}`} className="w-full h-40 object-cover rounded mb-2" />
                              ) : currentCard.mediaType === 'IMAGE' ? (
                                <div className="w-full min-h-[140px] rounded-lg bg-gray-200 flex items-center justify-center text-sm text-sky-500 mb-2">
                                  [Image]
                                </div>
                              ) : null}
                              {currentCard.mediaType === 'VIDEO' && cardMediaPreview ? (
                                <video
                                  src={cardMediaPreview}
                                  controls
                                  className="w-full max-h-40 object-cover rounded mb-2 bg-black"
                                />
                              ) : currentCard.mediaType === 'VIDEO' && !cardMediaPreview ? (
                                <div className="w-full min-h-[140px] rounded-lg bg-gray-200 flex items-center justify-center text-sm text-sky-500 mb-2">
                                  [Video]
                                </div>
                              ) : null}

                              {currentCard.bodyText && (
                                <p className="text-sm text-gray-700 mb-2 whitespace-pre-wrap">{currentCard.bodyText}</p>
                              )}

                              {Array.isArray(currentCard.buttons) && currentCard.buttons.length > 0 && (
                                <div className="space-y-1">
                                  {currentCard.buttons.map((button: any, index: number) => (
                                    <button key={index} className="w-full text-left px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs text-gray-700">
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
                      {((selectedTemplate?.metaData || selectedTemplate?.metadata || {}).interactiveAction !== 'MEDIA_CARD_CAROUSEL') &&
                        (selectedTemplate?.metaData || selectedTemplate?.metadata || {}).interactiveAction !== 'PRODUCT_CARD_CAROUSEL' &&
                        selectedTemplate.components?.find((c: any) => c.type === 'FOOTER')?.text && (
                        <p className="text-xs text-gray-500 text-center mt-2 pt-2 border-t border-gray-200">
                          {selectedTemplate.components.find((c: any) => c.type === 'FOOTER').text}
                        </p>
                      )}
                      
                      {/* Buttons */}
                      {((selectedTemplate?.metaData || selectedTemplate?.metadata || {}).interactiveAction !== 'MEDIA_CARD_CAROUSEL') &&
                        (selectedTemplate?.metaData || selectedTemplate?.metadata || {}).interactiveAction !== 'PRODUCT_CARD_CAROUSEL' &&
                        selectedTemplate.components?.find((c: any) => c.type === 'BUTTONS') && (() => {
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
                  <Select value={selectedChat?.contactNumber || ''} disabled>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Phone Number" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={selectedChat?.contactNumber || ''}>
                        {selectedChat?.contactNumber || ''}
                      </SelectItem>
                    </SelectContent>
                  </Select>
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
                        filteredTemplates.map((template) => {
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
                  {!templatesLoading && filteredTemplates.length === 0 && (
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
                                value={param.column || undefined}
                                onValueChange={(value) => {
                                  const newParams = [...templateParams];
                                  newParams[index] = { ...newParams[index], column: value };
                                  setTemplateParams(newParams);
                                }}
                                modal={false}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select column" />
                                </SelectTrigger>
                                <SelectContent position="popper" className="z-[250]">
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
                                {(param.fallback || '').length}/{WHATSAPP_TEMPLATE_PARAM_MAX_CHARS}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Media card carousel — send-time media only (one per card) */}
                {selectedTemplate &&
                  (() => {
                    const stMeta = selectedTemplate.metaData || selectedTemplate.metadata || {};
                    const carCards = Array.isArray(stMeta.mediaCards) ? stMeta.mediaCards : [];
                    if (stMeta.interactiveAction !== 'MEDIA_CARD_CAROUSEL' || carCards.length === 0) {
                      return null;
                    }
                    return (
                      <div className="space-y-3 border rounded-lg p-4 bg-muted/20">
                        <div>
                          <Label className="text-sm font-medium">Carousel media</Label>
                          <p className="text-xs text-muted-foreground mt-1">
                            Required: pick one {carCards.some((c: any) => c.mediaType === 'VIDEO') ? 'image or video' : 'image'}{' '}
                            per card. WhatsApp delivers only these files—not the media used when the template was created.
                          </p>
                        </div>
                        <div className="space-y-2 max-h-[220px] overflow-y-auto">
                          {carCards.map((card: any, idx: number) => (
                            <div
                              key={`car-${idx}`}
                              className="flex flex-col gap-2 border rounded-md p-3 bg-background"
                            >
                              <span className="text-xs font-medium">
                                Card {idx + 1} · {card.mediaType === 'VIDEO' ? 'Video' : 'Image'}
                              </span>
                              {carouselCardMediaUrls[idx] ? (
                                <p
                                  className="text-xs text-muted-foreground truncate"
                                  title={carouselCardMediaUrls[idx] || ''}
                                >
                                  {String(carouselCardMediaUrls[idx]).length > 56
                                    ? `${String(carouselCardMediaUrls[idx]).slice(0, 56)}…`
                                    : carouselCardMediaUrls[idx]}
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
                                  setGalleryFileType(card.mediaType === 'VIDEO' ? 'video' : 'image');
                                  setGalleryViewMode('gallery');
                                  setGalleryDialogOpen(true);
                                }}
                                disabled={!activeSession || !isActiveSessionReady}
                              >
                                {card.mediaType === 'VIDEO' ? (
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

                {/* Media URL Section (IMAGE, VIDEO, or DOCUMENT header) */}
                {selectedTemplate && (headerFormat === 'IMAGE' || headerFormat === 'VIDEO' || headerFormat === 'DOCUMENT') && (
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">
                      {headerFormat === 'DOCUMENT' ? 'Document' : 'Media URL'}
                    </Label>
                    {headerFormat === 'VIDEO' && (
                      <p className="text-xs text-muted-foreground">This template has a video header. Select or enter a video URL.</p>
                    )}
                    {headerFormat === 'DOCUMENT' && (
                      <p className="text-xs text-muted-foreground">This template has a document header. Select a file from gallery or enter a document URL.</p>
                    )}
                    
                    {/* From Gallery */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">From your gallery</span>
                        <Badge variant="secondary" className="text-xs">Recommended</Badge>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setGalleryCarouselCardIndex(null);
                          setGalleryFileType(
                            headerFormat === 'VIDEO'
                              ? 'video'
                              : headerFormat === 'DOCUMENT'
                                ? 'document'
                                : 'image',
                          );
                          setGalleryDialogOpen(true);
                        }}
                        className="w-full"
                        disabled={!activeSession || !isActiveSessionReady}
                      >
                        {headerFormat === 'VIDEO' ? (
                          <Video className="w-4 h-4 mr-2" />
                        ) : headerFormat === 'DOCUMENT' ? (
                          <FileText className="w-4 h-4 mr-2" />
                        ) : (
                          <ImageIcon className="w-4 h-4 mr-2" />
                        )}
                        Select {headerFormat === 'DOCUMENT' ? 'document' : 'media'}
                      </Button>
                      {headerFormat === 'IMAGE' && headerImageId && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Image ID: {headerImageId.substring(0, 30)}...
                        </p>
                      )}
                      {headerFormat === 'VIDEO' && headerVideoId && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Video ID: {headerVideoId.substring(0, 30)}...
                        </p>
                      )}
                      {headerFormat === 'DOCUMENT' && headerDocumentId && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Document ID: {headerDocumentId.substring(0, 30)}...
                        </p>
                      )}
                      {headerFormat === 'DOCUMENT' && !headerDocumentId && headerDocumentUrl && (
                        <p className="text-xs text-muted-foreground mt-1 truncate" title={headerDocumentUrl}>
                          Document: {headerDocumentUrl.split('/').pop() || headerDocumentUrl}
                        </p>
                      )}
                      {uploadMediaMutation.isPending && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Uploading {headerFormat === 'VIDEO' ? 'video' : headerFormat === 'DOCUMENT' ? 'document' : 'image'} to WhatsApp...
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
                          placeholder={
                            headerFormat === 'VIDEO'
                              ? "Enter video URL (https://...)"
                              : headerFormat === 'DOCUMENT'
                                ? "Enter document URL (https://...)"
                                : "Enter media URL (https://...)"
                          }
                          value={imageUrlInput}
                          onChange={(e) => setImageUrlInput(e.target.value)}
                          disabled={uploadMediaMutation.isPending}
                        />
                        <Button
                          onClick={async () => {
                            if (imageUrlInput && activeSession) {
                              const isVideo = headerFormat === 'VIDEO';
                              const isDocument = headerFormat === 'DOCUMENT';
                              try {
                                if (isVideo) setHeaderVideoUrl(imageUrlInput);
                                else if (isDocument) {
                                  setHeaderDocumentUrl(imageUrlInput);
                                  const nameFromUrl = imageUrlInput.split('/').pop()?.split('?')[0];
                                  if (nameFromUrl) setHeaderDocumentFilename(decodeURIComponent(nameFromUrl));
                                }
                                else setHeaderImageUrl(imageUrlInput);
                                
                                const response = await fetch(imageUrlInput);
                                if (!response.ok) {
                                  throw new Error(
                                    isVideo
                                      ? 'Failed to fetch video from URL'
                                      : isDocument
                                        ? 'Failed to fetch document from URL'
                                        : 'Failed to fetch image from URL',
                                  );
                                }
                                const blob = await response.blob();
                                const ext = isVideo
                                  ? (blob.type?.includes('video') ? '.mp4' : 'video.mp4')
                                  : isDocument
                                    ? (blob.type?.includes('pdf') ? 'document.pdf' : 'document.bin')
                                    : 'image.jpg';
                                const fileName = imageUrlInput.split('/').pop() || ext;
                                const file = new (window as any).File([blob], fileName, { type: blob.type });
                                
                                uploadMediaMutation.mutate({
                                  sessionId: activeSession.sessionId,
                                  file: file,
                                  mediaType: isVideo ? 'video' : isDocument ? 'document' : 'image',
                                });
                                
                                setImageUrlInput('');
                              } catch (error: any) {
                                toast({
                                  title: isVideo
                                    ? "Failed to load video"
                                    : isDocument
                                      ? "Failed to load document"
                                      : "Failed to load image",
                                  description: error.message || "Please check the URL and try again",
                                  variant: "destructive",
                                });
                              }
                            }
                          }}
                          disabled={!imageUrlInput || uploadMediaMutation.isPending || !activeSession || !isActiveSessionReady}
                        >
                          {uploadMediaMutation.isPending ? "Uploading..." : "Upload"}
                        </Button>
                      </div>
                      {headerFormat === 'IMAGE' && headerImageId && (
                        <p className="text-xs text-muted-foreground">
                          Image ID: {headerImageId.substring(0, 30)}...
                        </p>
                      )}
                      {headerFormat === 'VIDEO' && headerVideoId && (
                        <p className="text-xs text-muted-foreground">
                          Video ID: {headerVideoId.substring(0, 30)}...
                        </p>
                      )}
                      {headerFormat === 'DOCUMENT' && headerDocumentId && (
                        <p className="text-xs text-muted-foreground">
                          Document ID: {headerDocumentId.substring(0, 30)}...
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
                    onClick={() => {
                      if (!selectedTemplate) {
                        toast({
                          title: "Template required",
                          description: "Please select a template",
                          variant: "destructive",
                        });
                        return;
                      }
                      
                      // Check if template requires image header
                      if (headerFormat === 'IMAGE') {
                        if (uploadMediaMutation.isPending) return;
                        if (headerImageUrl && !headerImageId) {
                          toast({
                            title: "Image upload incomplete",
                            description: "The image upload did not complete. Please try selecting the image again.",
                            variant: "destructive",
                          });
                          return;
                        }
                        if (!headerImageId && !headerImageUrl) {
                          toast({
                            title: "Image required",
                            description: "This template requires an image header. Please select an image first.",
                            variant: "destructive",
                          });
                          return;
                        }
                        if (!headerImageId) {
                          toast({
                            title: "Image required",
                            description: "Please wait for the image upload to complete, or select an image again.",
                            variant: "destructive",
                          });
                          return;
                        }
                      }
                      
                      // Check if template requires video header
                      if (headerFormat === 'VIDEO') {
                        if (uploadMediaMutation.isPending) return;
                        // Allow sending with headerVideoUrl; backend will resolve
                        if (!headerVideoId && !headerVideoUrl) {
                          toast({
                            title: "Video required",
                            description: "This template requires a video header. Please select or enter a video URL.",
                            variant: "destructive",
                          });
                          return;
                        }
                      }

                      // Check if template requires document header
                      if (headerFormat === 'DOCUMENT') {
                        if (uploadMediaMutation.isPending) return;
                        if (!headerDocumentId && !headerDocumentUrl) {
                          toast({
                            title: "Document required",
                            description: "This template requires a document header. Please select a document or enter a document URL.",
                            variant: "destructive",
                          });
                          return;
                        }
                      }
                      
                      handleSendText('');
                    }}
                    disabled={sendTextMutation.isPending || !selectedTemplate || uploadMediaMutation.isPending}
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

      {/* Gallery Dialog */}
      {isBusinessAPI && (
        <Dialog open={galleryDialogOpen} onOpenChange={setGalleryDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileIcon className="w-5 h-5" />
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
                    <FileIcon className="w-4 h-4" />
                    Documents
                  </Button>
                  <div className="flex-1"></div>
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
                {mediaItems.length > 0 ? (
                  <div className="grid grid-cols-4 gap-4">
                    {mediaItems.map((item: any) => (
                      <div
                        key={item.id}
                        className="relative aspect-square rounded-lg overflow-hidden border-2 cursor-pointer hover:border-primary transition-colors group"
                        onClick={async () => {
                          if (galleryCarouselCardIndex !== null && selectedTemplate && activeSession) {
                            const cardIdx = galleryCarouselCardIndex;
                            const meta = selectedTemplate.metaData || selectedTemplate.metadata || {};
                            const carCs = Array.isArray(meta.mediaCards) ? meta.mediaCards : [];
                            const expectVideo = carCs[cardIdx]?.mediaType === 'VIDEO';
                            const expectImage = carCs[cardIdx]?.mediaType === 'IMAGE';
                            const typeOk =
                              (expectImage && item.type === 'image') ||
                              (expectVideo && item.type === 'video');
                            if (!typeOk) {
                              toast({
                                title: 'Wrong media type',
                                description: `Card ${cardIdx + 1} requires ${expectVideo ? 'a video' : 'an image'}.`,
                                variant: 'destructive',
                              });
                              return;
                            }
                            setCarouselCardMediaUrls((prev) => {
                              const next = [...prev];
                              next[cardIdx] = item.url;
                              return next;
                            });
                            setGalleryDialogOpen(false);
                            setGalleryCarouselCardIndex(null);
                            return;
                          }
                          const isImage = headerFormat === 'IMAGE' && item.type === 'image';
                          const isVideo = headerFormat === 'VIDEO' && item.type === 'video';
                          const isDocument = headerFormat === 'DOCUMENT' && item.type === 'document';
                          if ((isImage || isVideo || isDocument) && activeSession) {
                            try {
                              if (isImage) setHeaderImageUrl(item.url);
                              else if (isVideo) setHeaderVideoUrl(item.url);
                              else {
                                setHeaderDocumentUrl(item.url);
                                if (item.name) setHeaderDocumentFilename(item.name);
                              }
                              
                              const response = await fetch(item.url);
                              if (!response.ok) throw new Error('Failed to fetch file');
                              const blob = await response.blob();
                              const file = new (window as any).File([blob], item.name, { type: blob.type });
                              
                              uploadMediaMutation.mutate({
                                sessionId: activeSession.sessionId,
                                file: file,
                                mediaType: isVideo ? 'video' : isDocument ? 'document' : 'image',
                              });
                              
                              setGalleryDialogOpen(false);
                            } catch (error: any) {
                              toast({
                                title: isVideo
                                  ? "Failed to load video"
                                  : isDocument
                                    ? "Failed to load document"
                                    : "Failed to load image",
                                description: (error as Error).message || "Please try again",
                                variant: "destructive",
                              });
                            }
                          }
                        }}
                      >
                        {item.type === 'image' ? (
                          <img 
                            src={item.url} 
                            alt={item.name} 
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/placeholder-image.png';
                            }}
                          />
                        ) : item.type === 'video' ? (
                          <div className="w-full h-full bg-muted flex items-center justify-center">
                            <Video className="w-8 h-8 text-muted-foreground" />
                          </div>
                        ) : item.type === 'audio' ? (
                          <div className="w-full h-full bg-muted flex items-center justify-center">
                            <Music className="w-8 h-8 text-muted-foreground" />
                          </div>
                        ) : (
                          <div className="w-full h-full bg-muted flex items-center justify-center">
                            <FileIcon className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                          {item.name}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    {galleryFileType === 'image' ? (
                      <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    ) : galleryFileType === 'video' ? (
                      <Video className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    ) : galleryFileType === 'audio' ? (
                      <Music className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    ) : galleryFileType === 'document' ? (
                      <FileIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    ) : (
                      <FileIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    )}
                    <p className="text-sm">
                      {galleryFileType === 'all' 
                        ? 'No files in gallery' 
                        : `No ${galleryFileType}s in gallery`}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 mt-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Enter file URL (https://...)</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://..."
                      value={imageUrlInput}
                      onChange={(e) => setImageUrlInput(e.target.value)}
                    />
                    <Button
                      onClick={() => {
                        if (imageUrlInput) {
                          if (galleryCarouselCardIndex !== null && selectedTemplate) {
                            const meta = selectedTemplate.metaData || selectedTemplate.metadata || {};
                            const carCs = Array.isArray(meta.mediaCards) ? meta.mediaCards : [];
                            const idx = galleryCarouselCardIndex;
                            const expectVideo = carCs[idx]?.mediaType === 'VIDEO';
                            const isVideoUrl =
                              /\.(mp4|webm|mov|avi|3gp)(\?|#|$)/i.test(imageUrlInput) ||
                              /\/video\//i.test(imageUrlInput);
                            if (expectVideo && !isVideoUrl) {
                              toast({
                                title: 'URL may not be a video',
                                description: `Card ${idx + 1} expects a video URL (.mp4, etc.).`,
                                variant: 'destructive',
                              });
                              return;
                            }
                            if (!expectVideo && isVideoUrl) {
                              toast({
                                title: 'URL is a video',
                                description: `Card ${idx + 1} expects an image URL.`,
                                variant: 'destructive',
                              });
                              return;
                            }
                            setCarouselCardMediaUrls((prev) => {
                              const next = [...prev];
                              next[idx] = imageUrlInput;
                              return next;
                            });
                            setGalleryDialogOpen(false);
                            setGalleryCarouselCardIndex(null);
                            setImageUrlInput('');
                            return;
                          }
                          if (headerFormat === 'VIDEO') {
                            setHeaderVideoUrl(imageUrlInput);
                          } else if (headerFormat === 'DOCUMENT') {
                            setHeaderDocumentUrl(imageUrlInput);
                            const nameFromUrl = imageUrlInput.split('/').pop()?.split('?')[0];
                            if (nameFromUrl) setHeaderDocumentFilename(decodeURIComponent(nameFromUrl));
                          } else {
                            setHeaderImageUrl(imageUrlInput);
                          }
                          setGalleryDialogOpen(false);
                        }
                      }}
                    >
                      Select
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setGalleryDialogOpen(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
