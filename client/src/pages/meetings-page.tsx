"use client";

import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  RefreshCw,
  Video,
  Link2,
  Clock,
  CheckCircle2,
  CalendarDays,
  CalendarCheck,
  Plus,
  Settings,
  CalendarClock,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useRatehonkPageSkin } from "@/panel-templates/ratehonk-v1/RatehonkSkinContext";
import { ScheduleMeetingDialog } from "@/features/meetings/ScheduleMeetingDialog";
import { RescheduleMeetingDialog } from "@/features/meetings/RescheduleMeetingDialog";

type MeetingProvider = "google_meet" | "calendly";

type ScheduledMeeting = {
  id: string;
  contactName: string;
  contactNumber: string;
  customerEmail: string | null;
  provider: MeetingProvider;
  title: string;
  meetLink: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  status: "scheduled" | "completed" | "cancelled";
  chatId: string | null;
  source: "inbox" | "ai" | "booking_page";
  bookingCalendarId?: string | null;
};

type BookingCalendarOption = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
};

type MeetingStats = {
  total: number;
  googleMeet: number;
  calendly: number;
  upcoming: number;
  today: number;
  completed: number;
  thisMonth: number;
  cancelled: number;
};

type CalendarView = "month" | "week" | "day" | "agenda";

const WEEK_STARTS_ON = 0 as const;

/** Soft pastel chips for calendar meeting tags */
const PASTEL_EVENT_STYLES = [
  "bg-[#d1fae5] text-[#047857] hover:bg-[#a7f3d0]", // mint
  "bg-[#e0f2fe] text-[#0369a1] hover:bg-[#bae6fd]", // sky
  "bg-[#ede9fe] text-[#6d28d9] hover:bg-[#ddd6fe]", // lavender
  "bg-[#ffedd5] text-[#c2410c] hover:bg-[#fed7aa]", // peach
  "bg-[#fce7f3] text-[#be185d] hover:bg-[#fbcfe8]", // pink
  "bg-[#fef9c3] text-[#a16207] hover:bg-[#fef08a]", // lemon
  "bg-[#ccfbf1] text-[#0f766e] hover:bg-[#99f6e4]", // teal
  "bg-[#dbeafe] text-[#1d4ed8] hover:bg-[#bfdbfe]", // blue
  "bg-[#ffe4e6] text-[#be123c] hover:bg-[#fecdd3]", // rose
  "bg-[#f3e8ff] text-[#7e22ce] hover:bg-[#e9d5ff]", // lilac
  "bg-[#ecfccb] text-[#4d7c0f] hover:bg-[#d9f99d]", // lime
  "bg-[#ffedd5] text-[#b45309] hover:bg-[#fde68a]", // amber
] as const;

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function providerLabel(p: MeetingProvider) {
  return p === "google_meet" ? "Google Meet" : "Calendly";
}

function providerColor(p: MeetingProvider) {
  return p === "google_meet"
    ? "bg-[#d1fae5] text-[#047857] border-[#a7f3d0]"
    : "bg-[#ede9fe] text-[#6d28d9] border-[#ddd6fe]";
}

function eventBarClass(meeting: ScheduledMeeting) {
  const idx = hashString(meeting.id || meeting.contactName || meeting.startAt) % PASTEL_EVENT_STYLES.length;
  return PASTEL_EVENT_STYLES[idx];
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  icon: typeof CalendarIcon;
}) {
  return (
    <Card className="meetings-stat-card rounded-xl border border-[#e5e7eb] bg-white shadow-sm">
      <CardContent className="flex items-start gap-3 p-3.5">
        <div className="meetings-stat-icon mt-0.5 rounded-lg bg-[var(--rh-brand-soft,#ecfdf5)] p-2">
          <Icon className="h-4 w-4 text-[var(--rh-brand,#047857)]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[#717786]">{label}</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums leading-none text-[#111c2d]">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MeetingChip({
  meeting,
  compact,
  onReschedule,
}: {
  meeting: ScheduledMeeting;
  compact?: boolean;
  onReschedule: (meeting: ScheduledMeeting) => void;
}) {
  const start = new Date(meeting.startAt);
  const timeLabel = format(start, "HH:mm");
  const phone = meeting.contactNumber?.replace(/@c\.us|@g\.us/gi, "").trim();
  const phoneDisplay = phone && phone !== "public-booking" ? phone : null;
  const email = meeting.customerEmail?.trim() || null;
  const contactLine = [meeting.contactName, email, phoneDisplay].filter(Boolean).join(" · ");
  const titleParts = [meeting.title, meeting.contactName, email, phoneDisplay]
    .filter(Boolean)
    .join(" · ");

  return (
    <button
      type="button"
      title={`${titleParts} — click to reschedule`}
      className={cn(
        "block w-full rounded-md px-1.5 py-0.5 text-left text-[10px] font-medium leading-tight transition-colors",
        compact ? "whitespace-normal" : "truncate",
        eventBarClass(meeting),
      )}
      onClick={(e) => {
        e.stopPropagation();
        onReschedule(meeting);
      }}
    >
      {compact ? (
        <>
          <span className="block truncate">
            {timeLabel} {meeting.contactName}
          </span>
          {(email || phoneDisplay) && (
            <span className="mt-0.5 block truncate font-normal opacity-90">
              {[email, phoneDisplay].filter(Boolean).join(" · ")}
            </span>
          )}
        </>
      ) : (
        <span className="block truncate">
          {timeLabel} · {meeting.title}
          {contactLine ? ` · ${contactLine}` : ""}
        </span>
      )}
    </button>
  );
}

export default function MeetingsPage() {
  const skin = useRatehonkPageSkin();
  const [cursor, setCursor] = useState(() => new Date());
  const [view, setView] = useState<CalendarView>("month");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date | null>(null);
  const [rescheduleMeeting, setRescheduleMeeting] = useState<ScheduledMeeting | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [calendarFilter, setCalendarFilter] = useState<string>("all");

  const primaryBtn = skin
    ? "bg-[var(--rh-brand)] hover:bg-[var(--rh-brand-hover)] text-white"
    : "bg-[var(--rh-brand,#047857)] hover:bg-[var(--rh-brand-hover,#036649)] text-white";
  const outlineClass = "rounded-xl border-[#e5e7eb]";
  const inputClass = "h-8 rounded-xl border-[#e5e7eb] bg-white";

  const openScheduleForDate = (day: Date) => {
    setScheduleDate(day);
    setScheduleOpen(true);
  };

  const openReschedule = (meeting: ScheduledMeeting) => {
    setRescheduleMeeting(meeting);
  };

  const filterBounds = useMemo(() => {
    let from: Date | null = null;
    let to: Date | null = null;
    if (dateFrom) {
      const d = parseISO(dateFrom);
      if (!Number.isNaN(d.getTime())) from = startOfDay(d);
    }
    if (dateTo) {
      const d = parseISO(dateTo);
      if (!Number.isNaN(d.getTime())) to = endOfDay(d);
    }
    if (from && to && from > to) {
      return { from: to, to: from };
    }
    return { from, to };
  }, [dateFrom, dateTo]);

  const hasDateFilter = !!(filterBounds.from || filterBounds.to);

  const range = useMemo(() => {
    // Custom date filter drives agenda-style range when both ends are set
    if (filterBounds.from && filterBounds.to && view === "agenda") {
      return {
        from: filterBounds.from,
        to: filterBounds.to,
        label: `${format(filterBounds.from, "MMM d")} – ${format(filterBounds.to, "MMM d, yyyy")}`,
      };
    }
    if (view === "month") {
      const monthStart = startOfMonth(cursor);
      const monthEnd = endOfMonth(cursor);
      return {
        from: startOfWeek(monthStart, { weekStartsOn: WEEK_STARTS_ON }),
        to: endOfWeek(monthEnd, { weekStartsOn: WEEK_STARTS_ON }),
        label: format(cursor, "MMMM yyyy"),
      };
    }
    if (view === "week") {
      const from = startOfWeek(cursor, { weekStartsOn: WEEK_STARTS_ON });
      const to = endOfWeek(cursor, { weekStartsOn: WEEK_STARTS_ON });
      return {
        from,
        to,
        label: `${format(from, "MMM d")} – ${format(to, "MMM d, yyyy")}`,
      };
    }
    if (view === "day") {
      return {
        from: startOfDay(cursor),
        to: endOfDay(cursor),
        label: format(cursor, "EEEE, MMM d, yyyy"),
      };
    }
    const from = startOfMonth(cursor);
    return {
      from,
      to: addDays(from, 60),
      label: format(cursor, "MMMM yyyy"),
    };
  }, [cursor, view, filterBounds.from, filterBounds.to]);

  const queryRange = useMemo(() => {
    let from = range.from;
    let to = range.to;
    if (filterBounds.from && filterBounds.from < from) from = filterBounds.from;
    if (filterBounds.to && filterBounds.to > to) to = filterBounds.to;
    return { from, to };
  }, [range.from, range.to, filterBounds.from, filterBounds.to]);

  const bookingCalendarId =
    calendarFilter !== "all" ? calendarFilter : undefined;

  const { data: calendarsData } = useQuery<{ calendars: BookingCalendarOption[] }>({
    queryKey: ["/api/booking-calendars"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/booking-calendars");
      return res.json();
    },
  });

  const bookingCalendars = calendarsData?.calendars ?? [];

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<MeetingStats>({
    queryKey: ["/api/meetings/stats", bookingCalendarId ?? "all"],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (bookingCalendarId) qs.set("bookingCalendarId", bookingCalendarId);
      const url = qs.toString() ? `/api/meetings/stats?${qs}` : "/api/meetings/stats";
      const res = await apiRequest("GET", url);
      return res.json();
    },
  });

  const {
    data: meetingsData,
    isLoading: meetingsLoading,
    refetch: refetchMeetings,
    isFetching,
  } = useQuery<{ meetings: ScheduledMeeting[] }>({
    queryKey: [
      "/api/meetings",
      queryRange.from.toISOString(),
      queryRange.to.toISOString(),
      bookingCalendarId ?? "all",
    ],
    queryFn: async () => {
      const qs = new URLSearchParams({
        from: queryRange.from.toISOString(),
        to: queryRange.to.toISOString(),
      });
      if (bookingCalendarId) qs.set("bookingCalendarId", bookingCalendarId);
      const res = await apiRequest("GET", `/api/meetings?${qs}`);
      return res.json();
    },
  });

  const meetings = useMemo(() => {
    const all = meetingsData?.meetings ?? [];
    if (!hasDateFilter) return all;
    return all.filter((m) => {
      const t = new Date(m.startAt);
      if (Number.isNaN(t.getTime())) return false;
      if (filterBounds.from && filterBounds.to) {
        return isWithinInterval(t, { start: filterBounds.from, end: filterBounds.to });
      }
      if (filterBounds.from && t < filterBounds.from) return false;
      if (filterBounds.to && t > filterBounds.to) return false;
      return true;
    });
  }, [meetingsData?.meetings, hasDateFilter, filterBounds.from, filterBounds.to]);

  const applyDateFrom = (value: string) => {
    setDateFrom(value);
    if (value) {
      const d = parseISO(value);
      if (!Number.isNaN(d.getTime())) setCursor(d);
    }
  };

  const applyDateTo = (value: string) => {
    setDateTo(value);
    if (value && !dateFrom) {
      const d = parseISO(value);
      if (!Number.isNaN(d.getTime())) setCursor(d);
    }
  };

  const clearDateFilter = () => {
    setDateFrom("");
    setDateTo("");
  };

  const meetingsByDay = useMemo(() => {
    const map = new Map<string, ScheduledMeeting[]>();
    for (const m of meetings) {
      const key = format(new Date(m.startAt), "yyyy-MM-dd");
      const list = map.get(key) || [];
      list.push(m);
      map.set(key, list);
    }
    return map;
  }, [meetings]);

  const goPrev = () => {
    if (view === "month" || view === "agenda") setCursor((d) => addMonths(d, -1));
    else if (view === "week") setCursor((d) => addWeeks(d, -1));
    else setCursor((d) => addDays(d, -1));
  };

  const goNext = () => {
    if (view === "month" || view === "agenda") setCursor((d) => addMonths(d, 1));
    else if (view === "week") setCursor((d) => addWeeks(d, 1));
    else setCursor((d) => addDays(d, 1));
  };

  const goToday = () => setCursor(new Date());

  const refresh = () => {
    void refetchStats();
    void refetchMeetings();
  };

  const monthDays = useMemo(() => {
    if (view !== "month") return [];
    return eachDayOfInterval({ start: range.from, end: range.to });
  }, [view, range.from, range.to]);

  const weekDays = useMemo(() => {
    if (view !== "week") return [];
    return eachDayOfInterval({ start: range.from, end: range.to });
  }, [view, range.from, range.to]);

  const loading = statsLoading || meetingsLoading;
  const totalCount = stats?.total ?? 0;

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-1 flex-col overflow-hidden",
        skin ? "gap-3" : "gap-4 p-4 md:p-6",
        "atlas-reminders rh-reminders-tasks atlas-meetings rh-meetings-page",
      )}
      data-testid="page-meetings"
    >
      {/* Hero — matches Reminders */}
      <div className="atlas-rem-page-hero atlas-rem-page-hero--v2 shrink-0">
        <div className="atlas-rem-page-hero-glow" aria-hidden />
        <div className="atlas-rem-page-hero-inner">
          <div className="min-w-0 flex-1">
            <p className="atlas-rem-page-hero-eyebrow">Scheduling & booking links</p>
            <div className="mt-1 flex flex-wrap items-center gap-2.5">
              <h1 className="atlas-rem-page-hero-title">Meetings</h1>
              <Badge variant="secondary" className="atlas-rem-page-hero-badge">
                {totalCount} Meeting{totalCount === 1 ? "" : "s"}
              </Badge>
            </div>
            <p className="atlas-rem-page-hero-desc">
              View your calendar and schedule Google Meet or Calendly links for customers.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Select value={calendarFilter} onValueChange={setCalendarFilter}>
              <SelectTrigger className={cn(outlineClass, "h-10 w-[200px] bg-white")}>
                <SelectValue placeholder="Select calendar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All calendars</SelectItem>
                {bookingCalendars.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" className={cn(outlineClass, "h-10")} asChild>
              <Link href="/meetings/settings">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </Button>
            <Button
              className={cn("atlas-rem-page-hero-cta", primaryBtn, "rounded-xl")}
              onClick={() => {
                setScheduleDate(new Date());
                setScheduleOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Schedule Meeting
            </Button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
        {/* KPI cards — white surfaces */}
        <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
          <StatCard label="Total Meetings" value={stats?.total ?? 0} icon={CalendarDays} />
          <StatCard label="Google Meet" value={stats?.googleMeet ?? 0} icon={Video} />
          <StatCard label="Calendly" value={stats?.calendly ?? 0} icon={Link2} />
          <StatCard label="Upcoming" value={stats?.upcoming ?? 0} icon={Clock} />
          <StatCard label="Completed" value={stats?.completed ?? 0} icon={CheckCircle2} />
          <StatCard label="This Month" value={stats?.thisMonth ?? 0} icon={CalendarCheck} />
          <StatCard label="Cancelled" value={stats?.cancelled ?? 0} icon={CalendarIcon} />
          <StatCard label="Today" value={stats?.today ?? 0} icon={CalendarDays} />
        </div>

        {/* Date filter + calendar shell */}
        <div className="meetings-calendar-shell flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-sm">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#e5e7eb] bg-white px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant="outline"
                size="icon"
                className={cn("h-8 w-8", outlineClass)}
                onClick={goPrev}
                aria-label="Previous"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className={cn("h-8", outlineClass)} onClick={goToday}>
                Today
              </Button>
              <Button
                variant="outline"
                size="icon"
                className={cn("h-8 w-8", outlineClass)}
                onClick={goNext}
                aria-label="Next"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="ml-2 text-sm font-semibold text-[#111c2d]">{range.label}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <Label htmlFor="meetings-date-from" className="sr-only">
                  From date
                </Label>
                <Input
                  id="meetings-date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => applyDateFrom(e.target.value)}
                  className={cn("w-[9.5rem]", inputClass)}
                  title="From date"
                />
                <span className="text-xs text-[#717786]">to</span>
                <Label htmlFor="meetings-date-to" className="sr-only">
                  To date
                </Label>
                <Input
                  id="meetings-date-to"
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(e) => applyDateTo(e.target.value)}
                  className={cn("w-[9.5rem]", inputClass)}
                  title="To date"
                />
                {hasDateFilter ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-[#717786]"
                    onClick={clearDateFilter}
                  >
                    <X className="h-3.5 w-3.5" />
                    Clear
                  </Button>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-1 rounded-lg border border-[#e5e7eb] bg-[#f8fafc] p-0.5">
                {(["month", "week", "day", "agenda"] as CalendarView[]).map((v) => (
                  <Button
                    key={v}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-7 rounded-md px-2.5 capitalize",
                      view === v
                        ? "bg-[var(--rh-brand,#047857)] text-white hover:bg-[var(--rh-brand-hover,#036649)] hover:text-white"
                        : "text-[#414754] hover:bg-white",
                    )}
                    onClick={() => setView(v)}
                  >
                    {v}
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-0.5 h-7 w-7 text-[#414754]"
                  onClick={refresh}
                  disabled={isFetching}
                  aria-label="Refresh"
                >
                  {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          {hasDateFilter ? (
            <div className="flex shrink-0 items-center gap-2 border-b border-[#e5e7eb] bg-[var(--rh-brand-soft,#ecfdf5)] px-3 py-1.5 text-xs text-[var(--rh-brand,#047857)]">
              <CalendarIcon className="h-3.5 w-3.5" />
              Showing meetings
              {filterBounds.from ? ` from ${format(filterBounds.from, "MMM d, yyyy")}` : ""}
              {filterBounds.to ? ` to ${format(filterBounds.to, "MMM d, yyyy")}` : ""}
              <span className="text-[#717786]">· {meetings.length} result{meetings.length === 1 ? "" : "s"}</span>
            </div>
          ) : null}

          <div className="min-h-[420px] flex-1 overflow-auto bg-white">
            {loading ? (
              <div className="flex h-80 items-center justify-center text-[#717786]">
                <Loader2 className="mr-2 h-5 w-5 animate-spin text-[var(--rh-brand,#047857)]" />
                Loading meetings…
              </div>
            ) : view === "month" ? (
              <div className="flex h-full min-h-[420px] flex-col bg-white">
                <div className="grid grid-cols-7 border-b border-[#e5e7eb] bg-white text-center text-xs font-medium text-[#717786]">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <div key={d} className="px-1 py-2.5">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid flex-1 grid-cols-7 auto-rows-fr bg-white">
                  {monthDays.map((day) => {
                    const key = format(day, "yyyy-MM-dd");
                    const dayMeetings = meetingsByDay.get(key) || [];
                    const inMonth = isSameMonth(day, cursor);
                    return (
                      <button
                        type="button"
                        key={key}
                        onClick={() => openScheduleForDate(day)}
                        className={cn(
                          "min-h-[88px] border-b border-r border-[#e5e7eb] bg-white p-1.5 text-left align-top transition-colors hover:bg-[#f8fafc]",
                          !inMonth && "bg-[#fafafa] text-[#9ca3af]",
                          isToday(day) && "bg-[color-mix(in_srgb,var(--rh-brand,#047857)_6%,white)]",
                        )}
                      >
                        <span
                          className={cn(
                            "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium text-[#111c2d]",
                            isToday(day) && "bg-[var(--rh-brand,#047857)] text-white",
                          )}
                        >
                          {format(day, "d")}
                        </span>
                        <div className="mt-1 space-y-0.5">
                          {dayMeetings.slice(0, 3).map((m) => (
                            <MeetingChip key={m.id} meeting={m} compact onReschedule={openReschedule} />
                          ))}
                          {dayMeetings.length > 3 ? (
                            <p className="px-1 text-[10px] text-[#717786]">+{dayMeetings.length - 3} more</p>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : view === "week" ? (
              <div className="flex h-full min-h-[420px] flex-col bg-white">
                <div className="grid grid-cols-7 border-b border-[#e5e7eb] bg-white text-center text-xs font-medium text-[#717786]">
                  {weekDays.map((d) => (
                    <div
                      key={d.toISOString()}
                      className={cn(
                        "px-1 py-2",
                        isToday(d) && "text-[var(--rh-brand,#047857)]",
                      )}
                    >
                      <div>{format(d, "EEE")}</div>
                      <div
                        className={cn(
                          "text-sm font-semibold text-[#111c2d]",
                          isToday(d) && "text-[var(--rh-brand,#047857)]",
                        )}
                      >
                        {format(d, "d")}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid flex-1 grid-cols-7 bg-white">
                  {weekDays.map((day) => {
                    const key = format(day, "yyyy-MM-dd");
                    const dayMeetings = meetingsByDay.get(key) || [];
                    return (
                      <div
                        key={key}
                        role="button"
                        tabIndex={0}
                        onClick={() => openScheduleForDate(day)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openScheduleForDate(day);
                          }
                        }}
                        className={cn(
                          "min-h-[280px] cursor-pointer border-r border-[#e5e7eb] bg-white p-2 transition-colors hover:bg-[#f8fafc]",
                          isToday(day) && "bg-[color-mix(in_srgb,var(--rh-brand,#047857)_6%,white)]",
                        )}
                      >
                        <div className="space-y-1">
                          {dayMeetings.length === 0 ? (
                            <p className="pt-6 text-center text-xs text-[#9ca3af]">Click to schedule</p>
                          ) : (
                            dayMeetings.map((m) => (
                              <MeetingChip key={m.id} meeting={m} onReschedule={openReschedule} />
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : view === "day" ? (
              <div className="bg-white p-4">
                {(() => {
                  const key = format(cursor, "yyyy-MM-dd");
                  const dayMeetings = meetingsByDay.get(key) || [];
                  if (dayMeetings.length === 0) {
                    return (
                      <div className="flex h-64 flex-col items-center justify-center text-[#717786]">
                        <CalendarIcon className="mb-2 h-8 w-8 opacity-40" />
                        <p className="text-sm">No meetings on this day</p>
                        <Button
                          variant="ghost"
                          className="mt-1 text-[var(--rh-brand,#047857)]"
                          onClick={() => openScheduleForDate(cursor)}
                        >
                          Schedule a meeting
                        </Button>
                      </div>
                    );
                  }
                  return (
                    <ul className="space-y-3">
                      {dayMeetings.map((m) => (
                        <li
                          key={m.id}
                          className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[#e5e7eb] bg-white p-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-[#111c2d]">{m.title}</p>
                              <Badge variant="outline" className={cn("text-[10px]", providerColor(m.provider))}>
                                {providerLabel(m.provider)}
                              </Badge>
                            </div>
                            <p className="mt-1 text-sm text-[#717786]">
                              {format(new Date(m.startAt), "h:mm a")} – {format(new Date(m.endAt), "h:mm a")}
                              {" · "}
                              {m.durationMinutes} min
                            </p>
                            <p className="mt-0.5 text-sm text-[#414754]">
                              {m.contactName}
                              {m.customerEmail ? ` · ${m.customerEmail}` : ""}
                              {m.contactNumber && m.contactNumber !== "public-booking"
                                ? ` · ${m.contactNumber.replace(/@c\.us|@g\.us/gi, "")}`
                                : ""}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className={outlineClass}
                              onClick={() => openReschedule(m)}
                            >
                              <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
                              Reschedule
                            </Button>
                            <Button variant="outline" size="sm" className={outlineClass} asChild>
                              <a href={m.meetLink} target="_blank" rel="noreferrer">
                                Open link
                                <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                              </a>
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  );
                })()}
              </div>
            ) : (
              <div className="bg-white p-4">
                {meetings.length === 0 ? (
                  <div className="flex h-64 flex-col items-center justify-center text-[#717786]">
                    <CalendarIcon className="mb-2 h-8 w-8 opacity-40" />
                    <p className="text-sm">No meetings in this period</p>
                    <p className="mt-1 max-w-sm text-center text-xs">
                      Click a date on the calendar or use <strong>Schedule Meeting</strong> to send a link to a
                      customer.
                    </p>
                    <Button
                      variant="ghost"
                      className="mt-2 text-[var(--rh-brand,#047857)]"
                      onClick={() => {
                        setScheduleDate(new Date());
                        setScheduleOpen(true);
                      }}
                    >
                      Schedule a meeting
                    </Button>
                  </div>
                ) : (
                  <ul className="divide-y divide-[#e5e7eb]">
                    {meetings.map((m) => {
                      const start = new Date(m.startAt);
                      return (
                        <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="w-16 shrink-0 text-center">
                              <p className="text-xs font-medium uppercase text-[#717786]">{format(start, "MMM")}</p>
                              <p className="text-xl font-semibold leading-none text-[#111c2d]">
                                {format(start, "d")}
                              </p>
                              <p className="mt-0.5 text-[10px] text-[#717786]">{format(start, "EEE")}</p>
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate font-medium text-[#111c2d]">{m.contactName}</p>
                                <Badge variant="outline" className={cn("text-[10px]", providerColor(m.provider))}>
                                  {providerLabel(m.provider)}
                                </Badge>
                              </div>
                              <p className="mt-0.5 text-sm text-[#717786]">
                                {format(start, "h:mm a")} · {m.durationMinutes} min · {m.title}
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className={outlineClass}
                              onClick={() => openReschedule(m)}
                            >
                              <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
                              Reschedule
                            </Button>
                            <Button variant="outline" size="sm" className={outlineClass} asChild>
                              <a href={m.meetLink} target="_blank" rel="noreferrer">
                                Open link
                                <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                              </a>
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <ScheduleMeetingDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        initialDate={scheduleDate}
      />
      <RescheduleMeetingDialog
        open={!!rescheduleMeeting}
        onOpenChange={(open) => {
          if (!open) setRescheduleMeeting(null);
        }}
        meeting={rescheduleMeeting}
      />
    </div>
  );
}
