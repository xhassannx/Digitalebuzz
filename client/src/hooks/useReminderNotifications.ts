"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { showNotification } from "./useNotifications";

type DueReminder = { id: string; message: string; reminderAt: string; contactId: string; contactName: string };

/**
 * Polls for due reminders and shows browser notifications (including when the tab is in background).
 * Ensures reminders and other notifications show even when the user is in another tab.
 */
export function useReminderNotifications(enabled = true) {
  const notifiedIds = useRef<Set<string>>(new Set());
  const cleanupCutoff = useRef(0);

  const { data: dueReminders = [] } = useQuery<DueReminder[]>({
    queryKey: ["/api/reminders/due"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/reminders/due");
      return res.json();
    },
    enabled,
    refetchInterval: (query) => {
      if (typeof document !== "undefined" && document.hidden) return 30_000; // same 30s when in another tab
      return 30_000;
    },
    staleTime: 20_000,
  });

  useEffect(() => {
    if (!dueReminders.length) return;

    const now = Date.now();
    if (cleanupCutoff.current === 0) cleanupCutoff.current = now;
    if (now - cleanupCutoff.current > 60 * 60 * 1000) {
      notifiedIds.current.clear();
      cleanupCutoff.current = now;
    }

    for (const r of dueReminders) {
      if (notifiedIds.current.has(r.id)) continue;
      notifiedIds.current.add(r.id);
      const body = r.contactName ? `${r.contactName}: ${r.message}` : r.message;
      const title = "Reminder";
      showNotification(title, {
        body: body.length > 120 ? body.slice(0, 117) + "..." : body,
        tag: `reminder-${r.id}`,
        data: { reminderId: r.id, contactId: r.contactId },
      }).catch(() => {});
    }
  }, [dueReminders]);
}
