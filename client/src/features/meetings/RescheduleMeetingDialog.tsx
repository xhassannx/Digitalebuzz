"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarClock, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export type RescheduleMeeting = {
  id: string;
  contactName: string;
  contactNumber: string;
  provider: "google_meet" | "calendly";
  title: string;
  meetLink: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  status: "scheduled" | "completed" | "cancelled";
};

function providerLabel(p: RescheduleMeeting["provider"]) {
  return p === "google_meet" ? "Google Meet" : "Calendly";
}

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return format(new Date(), "yyyy-MM-dd'T'HH:mm");
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

export function RescheduleMeetingDialog({
  open,
  onOpenChange,
  meeting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meeting: RescheduleMeeting | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [datetimeLocal, setDatetimeLocal] = useState("");
  const [durationMin, setDurationMin] = useState(30);
  const [notifyCustomer, setNotifyCustomer] = useState(true);

  useEffect(() => {
    if (!open || !meeting) return;
    setDatetimeLocal(toDatetimeLocal(meeting.startAt));
    setDurationMin(meeting.durationMinutes || 30);
    setNotifyCustomer(true);
  }, [open, meeting]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!meeting) throw new Error("No meeting selected");
      if (!datetimeLocal.trim()) throw new Error("Choose date and time");
      const startIso = new Date(datetimeLocal).toISOString();
      const res = await apiRequest("PATCH", `/api/meetings/${meeting.id}/reschedule`, {
        startTime: startIso,
        durationMinutes: durationMin,
        notifyCustomer,
      });
      return res.json() as Promise<{
        meeting: RescheduleMeeting;
        notified?: boolean;
        warning?: string;
      }>;
    },
    onSuccess: (data) => {
      toast({
        title: "Meeting rescheduled",
        description: data.warning
          ? data.warning
          : data.notified
            ? "Updated time and notified the customer on WhatsApp."
            : "Meeting time updated.",
      });
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meetings/stats"] });
    },
    onError: (e: Error) => {
      toast({
        title: "Could not reschedule",
        description: e.message,
        variant: "destructive",
      });
    },
  });

  if (!meeting) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-meetings-reschedule">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-[var(--rh-brand,#047857)]" />
            Reschedule meeting
          </DialogTitle>
          <DialogDescription>
            Update the date and time for this meeting. Optionally notify the customer on WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-xl border border-[#e5e7eb] bg-[#f8fafc] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-[#111c2d]">{meeting.contactName}</p>
              <Badge variant="outline" className="text-[10px]">
                {providerLabel(meeting.provider)}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-[#717786]">{meeting.title}</p>
            <p className="mt-0.5 text-xs text-[#717786]">
              Current: {format(new Date(meeting.startAt), "MMM d, yyyy · h:mm a")} ·{" "}
              {meeting.durationMinutes} min
            </p>
            <a
              href={meeting.meetLink}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--rh-brand,#047857)] hover:underline"
            >
              Open meeting link
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">New date &amp; time</Label>
            <Input
              type="datetime-local"
              value={datetimeLocal}
              onChange={(e) => setDatetimeLocal(e.target.value)}
              className="h-9 rounded-xl border-[#e5e7eb]"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Duration (minutes)</Label>
            <Input
              type="number"
              min={15}
              max={480}
              step={15}
              value={durationMin}
              onChange={(e) =>
                setDurationMin(Math.max(15, Math.min(480, parseInt(e.target.value, 10) || 30)))
              }
              className="h-9 rounded-xl border-[#e5e7eb]"
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-[#e5e7eb] px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#111c2d]">Notify customer</p>
              <p className="text-xs text-[#717786]">Send the new time on WhatsApp with the same link</p>
            </div>
            <Switch checked={notifyCustomer} onCheckedChange={setNotifyCustomer} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" className="rounded-xl border-[#e5e7eb]" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className={cn(
              "bg-[var(--rh-brand,#047857)] hover:bg-[var(--rh-brand-hover,#036649)]",
              "rounded-xl",
            )}
            disabled={mutation.isPending || !datetimeLocal.trim()}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Reschedule"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
