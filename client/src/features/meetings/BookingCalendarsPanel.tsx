"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Copy, ExternalLink, ImagePlus, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  BOOKING_CALENDAR_THEMES,
  DEFAULT_BOOKING_CALENDAR_THEME,
  isBookingCalendarThemeId,
  type BookingCalendarThemeId,
} from "@shared/booking-calendar-themes";

type OrgMember = {
  userId: string;
  role?: string;
  user?: { firstName?: string | null; lastName?: string | null; email?: string | null };
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
};

type BookingCalendarRow = {
  id: string;
  name: string;
  description: string | null;
  logoUrl?: string | null;
  slug: string;
  durationMinutes: number;
  hostUserId: string;
  publicUrl: string;
  isActive: boolean;
  isPublicDemo?: boolean;
  theme?: string;
  maxBookingsPerSlot?: number;
  whatsappSessionId?: string | null;
  availability?: {
    timezone: string;
    startTime: string;
    endTime: string;
    weekdays: number[];
  };
  createdAt: string;
};

type WhatsAppSessionOption = {
  sessionId: string;
  label: string;
  connectionType?: string;
};

const WEEKDAY_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

const TIMEZONE_OPTIONS = ["Asia/Kolkata", "UTC", "America/New_York", "Europe/London", "Asia/Dubai"];

function memberLabel(m: OrgMember): string {
  const u = m.user || m;
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  return name || u.email || m.userId.slice(0, 8);
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "calendar"
  );
}

export function BookingCalendarsPanel({
  outlineClass,
  embedded,
}: {
  outlineClass?: string;
  /** When true, omit outer card chrome (for use inside Settings dialog). */
  embedded?: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [hostUserId, setHostUserId] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [logoUrl, setLogoUrl] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [theme, setTheme] = useState<BookingCalendarThemeId>(DEFAULT_BOOKING_CALENDAR_THEME);
  const [maxBookingsPerSlot, setMaxBookingsPerSlot] = useState(1);
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [whatsappSessionId, setWhatsappSessionId] = useState("");

  const { data: orgData } = useQuery<{ organizations?: { id: string }[]; id?: string } | { id: string }[]>({
    queryKey: ["/api/organizations"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/organizations");
      return res.json();
    },
  });

  const organizationId = useMemo(() => {
    if (Array.isArray(orgData)) return orgData[0]?.id;
    if (orgData && "organizations" in orgData && Array.isArray(orgData.organizations)) {
      return orgData.organizations[0]?.id;
    }
    return undefined;
  }, [orgData]);

  const { data: members = [] } = useQuery<OrgMember[]>({
    queryKey: ["/api/organizations", organizationId, "members"],
    enabled: !!organizationId && createOpen,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/organizations/${organizationId}/members`);
      const data = await res.json();
      return Array.isArray(data) ? data : data.members || [];
    },
  });

  const { data: schedulingOptions } = useQuery<{
    whatsappSessions: WhatsAppSessionOption[];
  }>({
    queryKey: ["/api/scheduling/chat-options"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/scheduling/chat-options");
      return res.json();
    },
    enabled: createOpen,
  });

  const whatsappSessions = schedulingOptions?.whatsappSessions ?? [];

  const { data: calendarsData, isLoading } = useQuery<{
    calendars: BookingCalendarRow[];
    publicDemoCalendarId?: string | null;
  }>({
    queryKey: ["/api/booking-calendars"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/booking-calendars");
      return res.json();
    },
  });

  const calendars = calendarsData?.calendars ?? [];
  const publicDemoCalendarId =
    calendarsData?.publicDemoCalendarId ??
    calendars.find((c) => c.isPublicDemo)?.id ??
    null;

  useEffect(() => {
    if (!createOpen) return;
    if (!hostUserId && user?.id) setHostUserId(user.id);
    else if (!hostUserId && members[0]?.userId) setHostUserId(members[0].userId);
  }, [createOpen, hostUserId, user?.id, members]);

  useEffect(() => {
    if (!createOpen) return;
    if (whatsappSessionId) return;
    if (whatsappSessions[0]) {
      setWhatsappSessionId(whatsappSessions[0].sessionId);
    }
  }, [createOpen, whatsappSessionId, whatsappSessions]);

  useEffect(() => {
    if (name && !slug) setSlug(slugify(name));
  }, [name, slug]);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setSlug("");
    setDurationMinutes(30);
    setLogoUrl("");
    setHostUserId(user?.id || "");
    setTheme(DEFAULT_BOOKING_CALENDAR_THEME);
    setMaxBookingsPerSlot(1);
    setTimezone("Asia/Kolkata");
    setStartTime("09:00");
    setEndTime("18:00");
    setWeekdays([1, 2, 3, 4, 5]);
    setWhatsappSessionId("");
  };

  const openCreate = () => {
    resetForm();
    setCreateOpen(true);
  };

  const openEdit = (c: BookingCalendarRow) => {
    setEditingId(c.id);
    setName(c.name);
    setSlug(c.slug);
    setHostUserId(c.hostUserId);
    setDurationMinutes(c.durationMinutes);
    setLogoUrl(c.logoUrl || "");
    setTheme(
      c.theme && isBookingCalendarThemeId(c.theme) ? c.theme : DEFAULT_BOOKING_CALENDAR_THEME,
    );
    setMaxBookingsPerSlot(c.maxBookingsPerSlot ?? 1);
    setTimezone(c.availability?.timezone || "Asia/Kolkata");
    setStartTime(c.availability?.startTime || "09:00");
    setEndTime(c.availability?.endTime || "18:00");
    setWeekdays(
      c.availability?.weekdays?.length ? [...c.availability.weekdays] : [1, 2, 3, 4, 5],
    );
    setWhatsappSessionId(c.whatsappSessionId || "");
    setCreateOpen(true);
  };

  const closeFormDialog = (open: boolean) => {
    setCreateOpen(open);
    if (!open) resetForm();
  };

  const toggleWeekday = (day: number) => {
    setWeekdays((prev) => {
      if (prev.includes(day)) {
        if (prev.length <= 1) return prev;
        return prev.filter((d) => d !== day);
      }
      return [...prev, day].sort((a, b) => a - b);
    });
  };

  const uploadLogo = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }
    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/gallery/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || "Upload failed");
      }
      // Prefer relative url so the public book page works on the same origin
      setLogoUrl(String(data.url || data.fullUrl || "").trim());
      toast({ title: "Image uploaded" });
    } catch (e: unknown) {
      toast({
        title: "Upload failed",
        description: e instanceof Error ? e.message : "Could not upload image",
        variant: "destructive",
      });
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Calendar name is required");
      if (!hostUserId) throw new Error("Select a team member");
      if (!whatsappSessionId) throw new Error("Select a WhatsApp number to send booking confirmations");
      if (weekdays.length === 0) throw new Error("Select at least one available day");
      if (startTime >= endTime) throw new Error("End time must be after start time");
      const res = await apiRequest("POST", "/api/booking-calendars", {
        name: name.trim(),
        hostUserId,
        slug: slug.trim() || undefined,
        durationMinutes,
        logoUrl: logoUrl.trim() || undefined,
        theme,
        maxBookingsPerSlot,
        whatsappSessionId,
        availability: {
          timezone,
          startTime,
          endTime,
          weekdays,
        },
      });
      return res.json() as Promise<{ calendar: BookingCalendarRow }>;
    },
    onSuccess: (data) => {
      toast({ title: "Calendar created", description: "Your scheduling link is ready." });
      closeFormDialog(false);
      setShareUrl(data.calendar.publicUrl);
      queryClient.invalidateQueries({ queryKey: ["/api/booking-calendars"] });
    },
    onError: (e: Error) => {
      toast({ title: "Could not create calendar", description: e.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingId) throw new Error("No calendar selected");
      if (!name.trim()) throw new Error("Calendar name is required");
      if (!hostUserId) throw new Error("Select a team member");
      if (!whatsappSessionId) throw new Error("Select a WhatsApp number to send booking confirmations");
      if (weekdays.length === 0) throw new Error("Select at least one available day");
      if (startTime >= endTime) throw new Error("End time must be after start time");
      const res = await apiRequest("PATCH", `/api/booking-calendars/${editingId}`, {
        name: name.trim(),
        hostUserId,
        durationMinutes,
        logoUrl: logoUrl.trim() || null,
        theme,
        maxBookingsPerSlot,
        whatsappSessionId,
        availability: {
          timezone,
          startTime,
          endTime,
          weekdays,
        },
      });
      return res.json() as Promise<{ calendar: BookingCalendarRow | null }>;
    },
    onSuccess: () => {
      toast({ title: "Calendar updated" });
      closeFormDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/booking-calendars"] });
    },
    onError: (e: Error) => {
      toast({ title: "Could not update calendar", description: e.message, variant: "destructive" });
    },
  });

  const saving = createMutation.isPending || updateMutation.isPending;
  const isEditing = !!editingId;

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/booking-calendars/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Calendar deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/booking-calendars"] });
    },
    onError: (e: Error) => {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    },
  });

  const publicDemoMutation = useMutation({
    mutationFn: async (calendarId: string | null) => {
      const res = await apiRequest("PUT", "/api/booking-calendars/public-demo", { calendarId });
      return res.json();
    },
    onSuccess: (_data, calendarId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/booking-calendars"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/book-demo"] });
      toast({
        title: calendarId ? "Book a Demo calendar updated" : "Book a Demo calendar cleared",
        description: calendarId
          ? "The landing page header will open this calendar."
          : "The Book a Demo button will be hidden until you select a calendar.",
      });
    },
    onError: (e: Error) => {
      toast({
        title: "Could not update Book a Demo calendar",
        description: e.message,
        variant: "destructive",
      });
    },
  });

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied" });
    } catch {
      toast({ title: "Could not copy", variant: "destructive" });
    }
  };

  return (
    <div
      className={cn(
        !embedded && "rounded-xl border border-[#e5e7eb] bg-white shadow-sm",
        embedded && "bg-white",
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 px-4 py-3",
          !embedded && "border-b border-[#e5e7eb]",
          embedded && "border-b border-[#e5e7eb] px-0 pt-0",
        )}
      >
        <div>
          <p className="text-sm font-semibold text-[#111c2d]">Personal booking calendars</p>
          <p className="text-xs text-[#717786]">
            Create a public scheduling link customers can use to book with you.
          </p>
        </div>
        <Button
          size="sm"
          className="rounded-xl bg-[var(--rh-brand,#047857)] hover:bg-[var(--rh-brand-hover,#036649)]"
          onClick={openCreate}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          New calendar
        </Button>
      </div>

      {calendars.length > 0 && (
        <div
          className={cn(
            "border-b border-[#e5e7eb] bg-[#f9fafb] px-4 py-3",
            embedded && "px-0",
          )}
        >
          <Label className="text-sm font-semibold text-[#111c2d]">
            Calendar for Book a Demo
          </Label>
          <p className="mt-0.5 text-xs text-[#717786]">
            Choose which calendar opens when visitors click{" "}
            <span className="font-medium">Book a Demo</span> on the landing page header.
          </p>
          <div className="mt-2 max-w-md">
            <Select
              value={publicDemoCalendarId || "__none__"}
              onValueChange={(value) => {
                publicDemoMutation.mutate(value === "__none__" ? null : value);
              }}
              disabled={publicDemoMutation.isPending}
            >
              <SelectTrigger className={cn("bg-white", outlineClass)}>
                <SelectValue placeholder="Select a calendar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None (hide button)</SelectItem>
                {calendars
                  .filter((c) => c.isActive)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} (/book/{c.slug})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className={cn("p-3", embedded && "px-0 pb-0")}>
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-[#717786]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading calendars…
          </div>
        ) : calendars.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-[#717786]">
            <CalendarPlus className="h-8 w-8 opacity-40" />
            <p className="text-sm">No booking calendars yet</p>
            <Button
              variant="ghost"
              className="text-[var(--rh-brand,#047857)]"
              onClick={openCreate}
            >
              Create your first calendar
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-[#e5e7eb]">
            {calendars.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-[#111c2d]">{c.name}</p>
                    <Badge variant="outline" className="text-[10px]">
                      Personal
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        c.isActive
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-rose-200 bg-rose-50 text-rose-800",
                      )}
                    >
                      {c.isActive ? "Active" : "Inactive"}
                    </Badge>
                    {c.isPublicDemo && (
                      <Badge
                        variant="outline"
                        className="border-sky-200 bg-sky-50 text-[10px] text-sky-800"
                      >
                        Book a Demo
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-[#717786]">
                    {c.durationMinutes} min · up to {c.maxBookingsPerSlot ?? 1} per slot · /book/{c.slug}
                    {c.whatsappSessionId ? "" : " · WhatsApp not set"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn("h-8", outlineClass)}
                    onClick={() => openEdit(c)}
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn("h-8", outlineClass)}
                    onClick={() => copyLink(c.publicUrl)}
                  >
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                    Copy link
                  </Button>
                  <Button variant="outline" size="sm" className={cn("h-8", outlineClass)} asChild>
                    <a href={c.publicUrl} target="_blank" rel="noreferrer">
                      Open
                      <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-[#717786]"
                    onClick={() => deleteMutation.mutate(c.id)}
                    aria-label="Delete calendar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* New / edit calendar — personal booking only (no type picker) */}
      <Dialog open={createOpen} onOpenChange={closeFormDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" data-testid="dialog-new-booking-calendar">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit calendar" : "New calendar"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update theme, timing, capacity, and host for this booking calendar."
                : "Personal booking — one-on-one or group slots with a team member. Generates a public scheduling link."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Calendar image</Label>
              <div className="flex items-center gap-3">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#e5e7eb] bg-[#f8fafc]">
                  {logoUrl ? (
                    <img src={logoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImagePlus className="h-6 w-6 text-[#9ca3af]" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadLogo(file);
                    }}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl border-[#e5e7eb]"
                      disabled={logoUploading}
                      onClick={() => logoInputRef.current?.click()}
                    >
                      {logoUploading ? (
                        <>
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          Uploading…
                        </>
                      ) : (
                        <>
                          <ImagePlus className="mr-1.5 h-3.5 w-3.5" />
                          Select image
                        </>
                      )}
                    </Button>
                    {logoUrl ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="rounded-xl text-[#717786]"
                        onClick={() => setLogoUrl("")}
                      >
                        <X className="mr-1 h-3.5 w-3.5" />
                        Remove
                      </Button>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-[#717786]">Shown on the public booking page above the calendar name.</p>
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Calendar name</Label>
              <Input
                placeholder="(eg) Outbound reach"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!isEditing) setSlug(slugify(e.target.value));
                }}
                className="h-9 rounded-xl border-[#e5e7eb]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Select team member</Label>
              <Select value={hostUserId} onValueChange={setHostUserId}>
                <SelectTrigger className="h-9 rounded-xl border-[#e5e7eb]">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      {memberLabel(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">WhatsApp session</Label>
              {whatsappSessions.length === 0 ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  No connected WhatsApp number found. Connect one under Integrations / Connect so booking
                  confirmations can be sent on WhatsApp.
                </p>
              ) : (
                <Select value={whatsappSessionId} onValueChange={setWhatsappSessionId}>
                  <SelectTrigger className="h-9 rounded-xl border-[#e5e7eb]">
                    <SelectValue placeholder="Select number" />
                  </SelectTrigger>
                  <SelectContent>
                    {whatsappSessions.map((s) => (
                      <SelectItem key={s.sessionId} value={s.sessionId}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-[11px] text-[#717786]">
                Booking confirmations are sent from this connected number to the guest&apos;s WhatsApp.
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Custom URL</Label>
              <div className="flex items-center gap-0 overflow-hidden rounded-xl border border-[#e5e7eb]">
                <span className="shrink-0 bg-[#f8fafc] px-2.5 py-2 text-xs text-[#717786]">/book/</span>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(slugify(e.target.value) || e.target.value.toLowerCase())}
                  placeholder="my-calendar"
                  disabled={isEditing}
                  className="h-9 rounded-none border-0 focus-visible:ring-0 disabled:opacity-70"
                />
              </div>
              {isEditing ? (
                <p className="text-[11px] text-[#717786]">URL slug cannot be changed after creation.</p>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Meeting duration (min)</Label>
                <Input
                  type="number"
                  min={15}
                  max={480}
                  step={15}
                  value={durationMinutes}
                  onChange={(e) =>
                    setDurationMinutes(Math.max(15, Math.min(480, parseInt(e.target.value, 10) || 30)))
                  }
                  className="h-9 rounded-xl border-[#e5e7eb]"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Persons per slot</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={maxBookingsPerSlot}
                  onChange={(e) =>
                    setMaxBookingsPerSlot(Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1)))
                  }
                  className="h-9 rounded-xl border-[#e5e7eb]"
                />
                <p className="text-[11px] text-[#717786]">Max bookings at the same time.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Calendar theme</Label>
              <div className="grid grid-cols-5 gap-2">
                {BOOKING_CALENDAR_THEMES.map((t) => {
                  const selected = theme === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTheme(t.id)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-xl border p-2 transition-all",
                        selected
                          ? "border-transparent ring-2 ring-offset-1"
                          : "border-[#e5e7eb] hover:border-[#cbd5e1]",
                      )}
                      style={
                        selected
                          ? { boxShadow: `0 0 0 2px ${t.brand}` }
                          : undefined
                      }
                      title={t.label}
                    >
                      <span
                        className="h-7 w-7 rounded-full shadow-sm ring-1 ring-black/5"
                        style={{ backgroundColor: t.brand }}
                      />
                      <span className="text-[10px] font-medium text-[#414754]">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-[#e5e7eb] bg-[#f8fafc]/80 p-3">
              <p className="text-xs font-semibold text-[#111c2d]">Availability timing</p>
              <div className="space-y-1">
                <Label className="text-[11px] text-[#717786]">Timezone</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger className="h-9 rounded-xl border-[#e5e7eb] bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONE_OPTIONS.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] text-[#717786]">Start time</Label>
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="h-9 rounded-xl border-[#e5e7eb] bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-[#717786]">End time</Label>
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="h-9 rounded-xl border-[#e5e7eb] bg-white"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-[#717786]">Available days</Label>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAY_OPTIONS.map((d) => {
                    const on = weekdays.includes(d.value);
                    return (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => toggleWeekday(d.value)}
                        className={cn(
                          "rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                          on
                            ? "bg-[var(--rh-brand,#047857)] text-white"
                            : "bg-white text-[#717786] ring-1 ring-[#e5e7eb] hover:bg-[#f1f5f9]",
                        )}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => closeFormDialog(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-xl bg-[var(--rh-brand,#047857)] hover:bg-[var(--rh-brand-hover,#036649)]"
              disabled={saving}
              onClick={() => (isEditing ? updateMutation.mutate() : createMutation.mutate())}
            >
              {saving ? (isEditing ? "Saving…" : "Creating…") : isEditing ? "Save changes" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share scheduling link */}
      <Dialog open={!!shareUrl} onOpenChange={(o) => !o && setShareUrl(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share calendar</DialogTitle>
            <DialogDescription>Copy the scheduling link and send it to customers.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input readOnly value={shareUrl || ""} className="h-9 rounded-xl border-[#e5e7eb]" />
            <Button
              className="shrink-0 rounded-xl bg-[var(--rh-brand,#047857)] hover:bg-[var(--rh-brand-hover,#036649)]"
              onClick={() => shareUrl && copyLink(shareUrl)}
            >
              Copy
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" asChild>
              <a href={shareUrl || "#"} target="_blank" rel="noreferrer">
                Open booking page
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
