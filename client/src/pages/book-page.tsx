"use client";

import { useEffect, useMemo, useState } from "react";
import { useRoute } from "wouter";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { Calendar as CalendarIcon, CheckCircle2, ChevronLeft, ChevronRight, Clock, Globe, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { resolveBookingCalendarTheme } from "@shared/booking-calendar-themes";

type PublicCalendar = {
  name: string;
  description: string | null;
  logoUrl?: string | null;
  durationMinutes: number;
  hostName: string;
  timezone: string;
  theme?: string;
  maxBookingsPerSlot?: number;
  availability?: {
    timezone: string;
    startTime: string;
    endTime: string;
    weekdays: number[];
  };
};

type Slot = {
  startIso: string;
  endIso: string;
  label: string;
};

const WEEK_STARTS_ON = 0 as const;

export default function BookPage() {
  const [, params] = useRoute("/book/:slug");
  const slug = params?.slug;

  const [calendar, setCalendar] = useState<PublicCalendar | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [unavailableMessage, setUnavailableMessage] = useState("Host is not available for this time.");
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);

  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<{
    meetLink: string;
    when: string;
    hostName: string;
    durationMinutes: number;
  } | null>(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      setError("Invalid link");
      return;
    }
    let cancelled = false;
    fetch(`/api/public/book/${encodeURIComponent(slug)}`)
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (cancelled) return;
        if (!ok) setError(typeof j.message === "string" ? j.message : "Calendar not found");
        else setCalendar(j as PublicCalendar);
      })
      .catch(() => {
        if (!cancelled) setError("Network error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!slug || !selectedDate) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    setSlotsLoading(true);
    setSelectedSlot(null);
    setSlotError(null);
    const date = format(selectedDate, "yyyy-MM-dd");
    fetch(`/api/public/book/${encodeURIComponent(slug)}/slots?date=${encodeURIComponent(date)}`)
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (cancelled) return;
        if (!ok) {
          setSlots([]);
          setSlotError(typeof j.message === "string" ? j.message : "Could not load times");
        } else {
          setSlots((j.slots || []) as Slot[]);
          if (typeof j.unavailableMessage === "string") setUnavailableMessage(j.unavailableMessage);
        }
      })
      .catch(() => {
        if (!cancelled) setSlotError("Network error");
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, selectedDate]);

  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(cursor);
    const monthEnd = endOfMonth(cursor);
    return eachDayOfInterval({
      start: startOfWeek(monthStart, { weekStartsOn: WEEK_STARTS_ON }),
      end: endOfWeek(monthEnd, { weekStartsOn: WEEK_STARTS_ON }),
    });
  }, [cursor]);

  const book = async () => {
    if (!slug || !selectedSlot) return;
    if (!guestName.trim()) {
      setSlotError("Please enter your name");
      return;
    }
    if (!guestEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())) {
      setSlotError("Please enter a valid email");
      return;
    }
    if (guestPhone.replace(/\D/g, "").length < 8) {
      setSlotError("Please enter a valid phone number");
      return;
    }
    setSubmitting(true);
    setSlotError(null);
    try {
      const res = await fetch(`/api/public/book/${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: selectedSlot.startIso,
          guestName: guestName.trim(),
          guestEmail: guestEmail.trim(),
          guestPhone: guestPhone.trim(),
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setSlotError(typeof j.message === "string" ? j.message : unavailableMessage);
        // Refresh slots if unavailable
        if (j.code === "unavailable" && selectedDate) {
          const date = format(selectedDate, "yyyy-MM-dd");
          const r2 = await fetch(
            `/api/public/book/${encodeURIComponent(slug)}/slots?date=${encodeURIComponent(date)}`,
          );
          const j2 = await r2.json();
          if (r2.ok) setSlots(j2.slots || []);
          setSelectedSlot(null);
        }
        return;
      }
      setConfirmed({
        meetLink: j.meetLink,
        when: j.when,
        hostName: j.hostName,
        durationMinutes: j.durationMinutes,
      });
    } catch {
      setSlotError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8fafc]">
        <Loader2 className="h-10 w-10 animate-spin text-[var(--rh-brand,#047857)]" />
      </div>
    );
  }

  if (error || !calendar) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] p-4">
        <div className="max-w-md rounded-xl border bg-white p-8 text-center shadow-sm">
          <XCircle className="mx-auto mb-3 h-12 w-12 text-destructive" />
          <p className="font-semibold">{error || "Something went wrong"}</p>
        </div>
      </div>
    );
  }

  if (confirmed) {
    const doneTheme = resolveBookingCalendarTheme(calendar.theme);
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-[#f8fafc] p-4"
        style={{
          ["--rh-brand" as string]: doneTheme.brand,
          ["--rh-brand-hover" as string]: doneTheme.brandHover,
          ["--rh-brand-soft" as string]: doneTheme.brandSoft,
        }}
      >
        <div className="w-full max-w-md rounded-xl border bg-white p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-[var(--rh-brand,#047857)]" />
          <h1 className="text-xl font-semibold text-[#111c2d]">Meeting booked</h1>
          <p className="mt-2 text-sm text-[#414754]">
            Your meeting with <strong>{confirmed.hostName}</strong> is confirmed for{" "}
            <strong>{confirmed.when}</strong> ({confirmed.durationMinutes} min).
          </p>
          <Button
            className="mt-6 w-full rounded-xl bg-[var(--rh-brand,#047857)] hover:bg-[var(--rh-brand-hover,#036649)]"
            asChild
          >
            <a href={confirmed.meetLink} target="_blank" rel="noreferrer">
              Open meeting link
            </a>
          </Button>
        </div>
      </div>
    );
  }

  const today = startOfDay(new Date());
  const selectionLabel = selectedSlot
    ? `${selectedSlot.label}, ${selectedDate ? format(selectedDate, "EEE, MMM d, yyyy") : ""}`
    : selectedDate
      ? format(selectedDate, "EEE, MMM d, yyyy")
      : null;

  const themeTokens = resolveBookingCalendarTheme(calendar.theme);
  const themeStyle = {
    ["--rh-brand" as string]: themeTokens.brand,
    ["--rh-brand-hover" as string]: themeTokens.brandHover,
    ["--rh-brand-soft" as string]: themeTokens.brandSoft,
  };

  return (
    <div
      className="book-page relative min-h-screen overflow-hidden px-3 py-8 sm:px-6 sm:py-10"
      style={themeStyle}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_color-mix(in_srgb,var(--rh-brand,#047857)_14%,#f8fafc)_0%,#eef2f7_45%,#e8eef5_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-16 h-72 w-72 rounded-full bg-[color-mix(in_srgb,var(--rh-brand,#047857)_12%,transparent)] blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 bottom-10 h-64 w-64 rounded-full bg-[color-mix(in_srgb,var(--rh-brand,#047857)_8%,transparent)] blur-3xl"
      />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/90 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.35)] backdrop-blur-sm md:min-h-[700px] md:flex-row">
        {/* Left info */}
        <aside className="relative w-full overflow-hidden border-b border-[#e5e7eb]/70 bg-gradient-to-b from-[#f8fafc] to-[#f3f6f9] p-8 md:w-[300px] md:border-b-0 md:border-r md:p-10">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[color-mix(in_srgb,var(--rh-brand,#047857)_10%,transparent)] blur-2xl"
          />
          {calendar.logoUrl ? (
            <div className="relative mb-5 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-white bg-white p-1.5 shadow-md ring-1 ring-black/5">
              <img src={calendar.logoUrl} alt="" className="max-h-full max-w-full object-contain" />
            </div>
          ) : (
            <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--rh-brand-soft,#ecfdf5)] text-2xl font-bold text-[var(--rh-brand,#047857)] shadow-sm ring-1 ring-[color-mix(in_srgb,var(--rh-brand,#047857)_18%,transparent)]">
              {(calendar.hostName || calendar.name).charAt(0).toUpperCase()}
            </div>
          )}
          <h1 className="relative text-2xl font-semibold tracking-tight text-[#111c2d]">{calendar.name}</h1>
          {calendar.description ? (
            <p className="relative mt-2 text-sm leading-relaxed text-[#717786]">{calendar.description}</p>
          ) : null}
          <div className="relative mt-6 space-y-3 text-sm text-[#414754]">
            <p className="flex items-center gap-2.5 rounded-xl bg-white/70 px-3 py-2 shadow-sm ring-1 ring-black/[0.03]">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--rh-brand-soft,#ecfdf5)]">
                <Clock className="h-3.5 w-3.5 text-[var(--rh-brand,#047857)]" />
              </span>
              {calendar.durationMinutes} min
            </p>
            {selectionLabel ? (
              <p className="flex items-start gap-2.5 rounded-xl bg-white/70 px-3 py-2 shadow-sm ring-1 ring-black/[0.03]">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--rh-brand-soft,#ecfdf5)]">
                  <CalendarIcon className="h-3.5 w-3.5 text-[var(--rh-brand,#047857)]" />
                </span>
                <span className="pt-1">{selectionLabel}</span>
              </p>
            ) : null}
            <p className="flex items-center gap-2.5 rounded-xl bg-white/70 px-3 py-2 text-sm text-[#717786] shadow-sm ring-1 ring-black/[0.03]">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--rh-brand-soft,#ecfdf5)]">
                <Globe className="h-3.5 w-3.5 text-[var(--rh-brand,#047857)]" />
              </span>
              {calendar.timezone}
            </p>
          </div>
          <p className="relative mt-8 text-sm text-[#717786]">Hosted by {calendar.hostName}</p>
        </aside>

        {/* Main */}
        <div className="min-w-0 flex-1 bg-gradient-to-br from-white via-white to-[color-mix(in_srgb,var(--rh-brand,#047857)_4%,white)] p-6 sm:p-8 lg:p-10">
          <h2 className="mb-6 text-xl font-semibold tracking-tight text-[#111c2d]">Select Date &amp; Time</h2>
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
            {/* Month grid */}
            <div className="min-w-0 flex-[1.4] lg:max-w-none">
              <div className="overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--rh-brand,#047857)_12%,#e5e7eb)] bg-white/80 p-4 shadow-[0_12px_32px_-18px_rgba(4,120,87,0.35)] sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-2 rounded-xl bg-gradient-to-r from-[color-mix(in_srgb,var(--rh-brand,#047857)_8%,white)] to-transparent px-1 py-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-full text-[#414754] hover:bg-white hover:text-[var(--rh-brand,#047857)] hover:shadow-sm"
                    onClick={() => setCursor((d) => addMonths(d, -1))}
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <span className="text-base font-semibold tracking-tight text-[#111c2d] sm:text-lg">
                    {format(cursor, "MMMM yyyy")}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-full text-[#414754] hover:bg-white hover:text-[var(--rh-brand,#047857)] hover:shadow-sm"
                    onClick={() => setCursor((d) => addMonths(d, 1))}
                    aria-label="Next month"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>

                <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94a3b8] sm:gap-2 sm:text-xs">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <div key={d} className="py-2">
                      {d}
                    </div>
                  ))}
                </div>

                <div className="mt-1 grid grid-cols-7 gap-1.5 sm:gap-2">
                  {monthDays.map((day) => {
                    const past = isBefore(day, today);
                    const inMonth = isSameMonth(day, cursor);
                    const selected = selectedDate && isSameDay(day, selectedDate);
                    const todayDay = isToday(day);
                    const disabled = past || !inMonth;
                    return (
                      <button
                        key={day.toISOString()}
                        type="button"
                        disabled={disabled}
                        onClick={() => setSelectedDate(day)}
                        className={cn(
                          "group relative flex aspect-square w-full max-h-[3.75rem] items-center justify-center rounded-2xl text-sm font-semibold transition-all duration-200 sm:text-base",
                          !inMonth && "text-[#cbd5e1]",
                          past && inMonth && "cursor-not-allowed text-[#cbd5e1]",
                          !disabled &&
                            !selected &&
                            "text-[#0f172a] hover:-translate-y-0.5 hover:bg-[var(--rh-brand-soft,#ecfdf5)] hover:text-[var(--rh-brand,#047857)] hover:shadow-md",
                          todayDay &&
                            !selected &&
                            !disabled &&
                            "bg-[color-mix(in_srgb,var(--rh-brand,#047857)_8%,white)] text-[var(--rh-brand,#047857)] ring-1 ring-[color-mix(in_srgb,var(--rh-brand,#047857)_28%,transparent)]",
                          selected &&
                            "scale-[1.04] bg-[var(--rh-brand,#047857)] text-white shadow-[0_10px_22px_-8px_rgba(4,120,87,0.65)] ring-2 ring-[color-mix(in_srgb,var(--rh-brand,#047857)_35%,white)]",
                        )}
                      >
                        <span className="relative z-10">{format(day, "d")}</span>
                        {todayDay && !selected ? (
                          <span className="absolute bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[var(--rh-brand,#047857)]" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Time slots + form */}
            <div className="w-full lg:w-[280px] lg:shrink-0">
              {!selectedDate ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#d1d5db] bg-[#f8fafc]/80 px-4 py-14 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--rh-brand-soft,#ecfdf5)] text-[var(--rh-brand,#047857)]">
                    <CalendarIcon className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-[#414754]">Pick a date</p>
                  <p className="mt-1 text-xs text-[#717786]">Available times will show here</p>
                </div>
              ) : slotsLoading ? (
                <div className="flex items-center justify-center rounded-2xl border border-[#e5e7eb] bg-white py-14 text-[#717786]">
                  <Loader2 className="h-6 w-6 animate-spin text-[var(--rh-brand,#047857)]" />
                </div>
              ) : slots.length === 0 ? (
                <p className="rounded-2xl border border-[#e5e7eb] bg-[#f8fafc] p-5 text-center text-sm text-[#717786]">
                  {unavailableMessage}
                </p>
              ) : (
                <div className="rounded-2xl border border-[color-mix(in_srgb,var(--rh-brand,#047857)_12%,#e5e7eb)] bg-white/90 p-3 shadow-[0_12px_28px_-20px_rgba(4,120,87,0.4)]">
                  <p className="mb-3 px-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#94a3b8]">
                    {format(selectedDate, "EEE, MMM d")}
                  </p>
                  <div className="max-h-[380px] space-y-2 overflow-y-auto pr-1">
                    {slots.map((s) => {
                      const active = selectedSlot?.startIso === s.startIso;
                      return (
                        <button
                          key={s.startIso}
                          type="button"
                          onClick={() => {
                            setSelectedSlot(s);
                            setSlotError(null);
                          }}
                          className={cn(
                            "flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-all duration-200",
                            active
                              ? "border-[var(--rh-brand,#047857)] bg-[var(--rh-brand,#047857)] text-white shadow-[0_8px_18px_-8px_rgba(4,120,87,0.7)]"
                              : "border-[color-mix(in_srgb,var(--rh-brand,#047857)_22%,#e5e7eb)] bg-white text-[var(--rh-brand,#047857)] hover:-translate-y-0.5 hover:border-[var(--rh-brand,#047857)] hover:bg-[var(--rh-brand-soft,#ecfdf5)] hover:shadow-md",
                          )}
                        >
                          <span>{s.label}</span>
                          {active ? <span className="text-[11px] font-semibold tracking-wide">Selected</span> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedSlot ? (
                <div className="mt-4 space-y-3 rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
                  <div className="space-y-1">
                    <Label className="text-xs">Your name *</Label>
                    <Input
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className="h-9 rounded-xl"
                      placeholder="Full name"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Email <span className="text-rose-600">*</span>
                    </Label>
                    <Input
                      type="email"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      className="h-9 rounded-xl"
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">
                      WhatsApp phone <span className="text-rose-600">*</span>
                    </Label>
                    <Input
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      className="h-9 rounded-xl"
                      placeholder="9198…"
                      required
                    />
                  </div>
                  {slotError ? (
                    <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                      {slotError}
                    </p>
                  ) : null}
                  <Button
                    className="w-full rounded-xl bg-[var(--rh-brand,#047857)] shadow-[0_10px_24px_-12px_rgba(4,120,87,0.8)] transition-transform hover:bg-[var(--rh-brand-hover,#036649)] hover:shadow-[0_12px_28px_-10px_rgba(4,120,87,0.85)] active:scale-[0.99]"
                    disabled={submitting}
                    onClick={() => void book()}
                  >
                    {submitting ? "Booking…" : "Confirm booking"}
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
