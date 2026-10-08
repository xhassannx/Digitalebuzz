"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useReminderContext } from "@/contexts/reminder-context";
import { apiRequest } from "@/lib/queryClient";
import { Clock, Bell } from "lucide-react";
import { format, startOfDay, addDays, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";

type UpcomingReminder = { id: string; message: string; reminderAt: string; contactId: string; contactName: string };

export function HeaderReminderButton() {
  const [, setLocation] = useLocation();
  const ctx = useReminderContext();
  const onOpenContactDetails = ctx?.onOpenContactDetails;
  const setPendingContactIdToOpen = ctx?.setPendingContactIdToOpen;
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"today" | "tomorrow">("today");

  const openContactChat = (contactId: string) => {
    setOpen(false);
    setPendingContactIdToOpen?.(contactId);
    setLocation(`/chat?contactId=${encodeURIComponent(contactId)}`);
  };

  const { data: reminders = [] } = useQuery<UpcomingReminder[]>({
    queryKey: ["/api/reminders/upcoming"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/reminders/upcoming");
      return res.json();
    },
    enabled: open,
  });

  const todayStart = startOfDay(new Date());
  const tomorrowStart = startOfDay(addDays(new Date(), 1));
  const filtered = reminders.filter((r) => {
    const d = new Date(r.reminderAt);
    return filter === "today" ? isSameDay(d, todayStart) : isSameDay(d, tomorrowStart);
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 relative rounded-full" aria-label="View reminders">
          <Clock className="h-5 w-5 text-muted-foreground" />
          {reminders.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium shadow-sm">
              {reminders.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 bg-gradient-to-b from-orange-50/50 via-orange-50/30 to-blue-50/50 dark:from-orange-950/20 dark:via-orange-950/10 dark:to-blue-950/20 border-orange-200/50 dark:border-orange-800/30" sideOffset={8}>
        <div className="p-4 border-b border-orange-200/50 dark:border-orange-800/30 bg-gradient-to-r from-orange-50/80 to-orange-50/60 dark:from-orange-950/30 dark:to-orange-950/20">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-sm text-orange-700 dark:text-orange-300">Reminders</h3>
            <span className="rounded-full bg-orange-500 text-white text-xs font-medium px-2 py-0.5 min-w-[24px] text-center shadow-sm">
              {filtered.length}
            </span>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={() => setFilter("today")}
              className={cn(
                "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200",
                filter === "today"
                  ? "bg-orange-500 hover:bg-orange-600 text-white border-0 shadow-sm"
                  : "border border-input bg-background hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setFilter("tomorrow")}
              className={cn(
                "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200",
                filter === "tomorrow"
                  ? "bg-orange-500 hover:bg-orange-600 text-white border-0 shadow-sm"
                  : "border border-input bg-background hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              Tomorrow
            </button>
          </div>
        </div>
        <div className="p-4 min-h-[80px] bg-gradient-to-b from-blue-50/30 to-orange-50/30 dark:from-blue-950/10 dark:to-orange-950/10">
          {filtered.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-orange-600/80 dark:text-orange-400/80">
                No reminders for {filter === "today" ? "today" : "tomorrow"}.
              </p>
              {onOpenContactDetails && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-orange-500 dark:text-orange-400 mt-2 h-auto p-0 hover:bg-transparent hover:text-orange-600 dark:hover:text-orange-300"
                  onClick={() => {
                    setOpen(false);
                    onOpenContactDetails();
                  }}
                >
                  Add reminder in Contact Details
                </Button>
              )}
            </div>
          ) : (
            <ul className="space-y-3 text-sm">
              {filtered.map((r) => (
                <li key={r.id} className="border-b border-orange-200/40 dark:border-orange-800/30 last:border-0 pb-3 last:pb-0">
                  <button
                    type="button"
                    onClick={() => openContactChat(r.contactId)}
                    className="w-full flex items-start gap-3 text-left rounded-lg p-1 -m-1 hover:bg-orange-100/50 dark:hover:bg-orange-900/20 transition-colors cursor-pointer"
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="rounded-full bg-orange-500 p-2 shadow-sm">
                        <Bell className="h-4 w-4 text-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-orange-800 dark:text-orange-200">
                        {r.contactName} · {format(new Date(r.reminderAt), "h:mm a")}
                      </p>
                      <p className="text-xs text-orange-600/70 dark:text-orange-400/70 mt-1">
                        {r.message}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
