import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Clock, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAllTimezones } from "@/lib/timezones";
import { resolveAppTimezone } from "@shared/timezone";
import {
  DEFAULT_LIVE_CHAT_OFF_HOURS_MESSAGE,
  DEFAULT_LIVE_CHAT_WELCOME_MESSAGE,
  LIVE_CHAT_DAYS,
  formatTimezoneWithOffset,
  getDefaultLiveChatWorkingHours,
  isWithinLiveChatWorkingHours,
  parseLiveChatWorkingHours,
  type LiveChatDayKey,
  type LiveChatSettingsPayload,
  type LiveChatWorkingHours,
} from "@shared/live-chat-settings";

type LiveChatSettingsTabProps = {
  isAtlas?: boolean;
};

function MessagePreview({
  text,
  disabled,
  placeholder,
}: {
  text: string;
  disabled: boolean;
  placeholder: string;
}) {
  const display = text.trim() || placeholder;
  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <div className="relative rounded-2xl border bg-background px-4 py-3 shadow-sm">
        <div className="mb-2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
          WA
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{display}</p>
      </div>
      {disabled && (
        <p className="mt-3 text-sm text-muted-foreground">Your auto response is disabled.</p>
      )}
    </div>
  );
}

export function LiveChatSettingsTab({ isAtlas }: LiveChatSettingsTabProps) {
  const { toast } = useToast();
  const defaultTimezone = resolveAppTimezone();
  const timezones = useMemo(() => {
    const all = getAllTimezones();
    const preferred = [defaultTimezone, "Asia/Kolkata"].filter(Boolean);
    return Array.from(new Set([...preferred, ...all]));
  }, [defaultTimezone]);
  const [form, setForm] = useState<LiveChatSettingsPayload>({
    welcomeEnabled: false,
    welcomeMessage: "",
    offHoursEnabled: false,
    offHoursMessage: "",
    workingHours: getDefaultLiveChatWorkingHours(),
  });
  const [configureKind, setConfigureKind] = useState<"welcome" | "offHours" | null>(null);
  const [draftMessage, setDraftMessage] = useState("");

  const { data, isLoading } = useQuery<LiveChatSettingsPayload>({
    queryKey: ["/api/live-chat-settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/live-chat-settings");
      return res.json();
    },
  });

  useEffect(() => {
    if (!data) return;
    const workingHours = parseLiveChatWorkingHours(data.workingHours);
    setForm({
      welcomeEnabled: data.welcomeEnabled === true,
      welcomeMessage: data.welcomeMessage || "",
      offHoursEnabled: data.offHoursEnabled === true,
      offHoursMessage: data.offHoursMessage || "",
      workingHours: {
        ...workingHours,
        timezone: workingHours.timezone || defaultTimezone,
      },
    });
  }, [data, defaultTimezone]);

  const saveMutation = useMutation({
    mutationFn: async (patch: Partial<LiveChatSettingsPayload>) => {
      const res = await apiRequest("PATCH", "/api/live-chat-settings", patch);
      return res.json() as Promise<LiveChatSettingsPayload>;
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(["/api/live-chat-settings"], saved);
      setForm({
        welcomeEnabled: saved.welcomeEnabled === true,
        welcomeMessage: saved.welcomeMessage || "",
        offHoursEnabled: saved.offHoursEnabled === true,
        offHoursMessage: saved.offHoursMessage || "",
        workingHours: parseLiveChatWorkingHours(saved.workingHours),
      });
    },
    onError: (error: any) => {
      toast({
        title: "Could not save live chat settings",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const patchForm = (patch: Partial<LiveChatSettingsPayload>) => {
    setForm((prev) => {
      const next = {
        ...prev,
        ...patch,
        workingHours: patch.workingHours || prev.workingHours,
      };
      saveMutation.mutate({
        ...patch,
        workingHours: next.workingHours,
      });
      return next;
    });
  };

  const updateWorkingHours = (nextHours: LiveChatWorkingHours) => {
    setForm((prev) => ({ ...prev, workingHours: nextHours }));
    saveMutation.mutate({ workingHours: nextHours });
  };

  const updateDay = (key: LiveChatDayKey, dayPatch: Partial<LiveChatWorkingHours["days"][LiveChatDayKey]>) => {
    const nextHours: LiveChatWorkingHours = {
      ...form.workingHours,
      days: {
        ...form.workingHours.days,
        [key]: { ...form.workingHours.days[key], ...dayPatch },
      },
    };
    updateWorkingHours(nextHours);
  };

  const withinHours = isWithinLiveChatWorkingHours(form.workingHours);
  const openConfigure = (kind: "welcome" | "offHours") => {
    setDraftMessage(kind === "welcome" ? form.welcomeMessage : form.offHoursMessage);
    setConfigureKind(kind);
  };

  const saveConfiguredMessage = () => {
    if (configureKind === "welcome") {
      patchForm({ welcomeMessage: draftMessage });
    } else if (configureKind === "offHours") {
      patchForm({ offHoursMessage: draftMessage });
    }
    setConfigureKind(null);
    toast({ title: "Message saved" });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        Loading live chat settings...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Live Chat Settings</h2>
        <p className="text-sm text-muted-foreground">
          Send an automated reply on a contact&apos;s first message, using working hours to choose welcome or off-hours text.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className={cn(isAtlas && "rh-settings-card")}>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Welcome Message</CardTitle>
                <CardDescription>
                  Automated reply for the first query during working hours.
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.welcomeEnabled}
                  onCheckedChange={(checked) =>
                    patchForm({
                      welcomeEnabled: checked,
                      ...(checked && !form.welcomeMessage.trim()
                        ? { welcomeMessage: DEFAULT_LIVE_CHAT_WELCOME_MESSAGE }
                        : {}),
                    })
                  }
                  aria-label="Enable welcome message"
                />
                <Button type="button" variant="outline" size="sm" onClick={() => openConfigure("welcome")}>
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Configure
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <MessagePreview
              text={form.welcomeMessage}
              disabled={!form.welcomeEnabled}
              placeholder={DEFAULT_LIVE_CHAT_WELCOME_MESSAGE}
            />
          </CardContent>
        </Card>

        <Card className={cn(isAtlas && "rh-settings-card")}>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Off Hours Message</CardTitle>
                <CardDescription>
                  Automated reply for the first query outside working hours.
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.offHoursEnabled}
                  onCheckedChange={(checked) =>
                    patchForm({
                      offHoursEnabled: checked,
                      ...(checked && !form.offHoursMessage.trim()
                        ? { offHoursMessage: DEFAULT_LIVE_CHAT_OFF_HOURS_MESSAGE }
                        : {}),
                    })
                  }
                  aria-label="Enable off hours message"
                />
                <Button type="button" variant="outline" size="sm" onClick={() => openConfigure("offHours")}>
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Configure
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <MessagePreview
              text={form.offHoursMessage}
              disabled={!form.offHoursEnabled}
              placeholder={DEFAULT_LIVE_CHAT_OFF_HOURS_MESSAGE}
            />
          </CardContent>
        </Card>
      </div>

      <Card className={cn(isAtlas && "rh-settings-card")}>
        <CardHeader>
          <CardTitle>Working Hours</CardTitle>
          <CardDescription>Configure day-wise working hours for automated replies.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="live-chat-timezone">Timezone</Label>
            <select
              id="live-chat-timezone"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.workingHours.timezone || defaultTimezone}
              onChange={(e) =>
                updateWorkingHours({ ...form.workingHours, timezone: e.target.value })
              }
            >
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz === defaultTimezone
                    ? `${formatTimezoneWithOffset(tz)} (default)`
                    : formatTimezoneWithOffset(tz)}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Right now this schedule is {withinHours ? "within working hours" : "outside working hours"}.
            </p>
          </div>

          <div className="divide-y rounded-lg border">
            {LIVE_CHAT_DAYS.map((day) => {
              const schedule = form.workingHours.days[day.key];
              return (
                <div
                  key={day.key}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3 min-w-[7rem]">
                    <span className="w-10 text-sm font-medium">{day.label}</span>
                    <Switch
                      checked={schedule.enabled}
                      onCheckedChange={(checked) => updateDay(day.key, { enabled: checked })}
                      aria-label={`${day.label} working day`}
                    />
                  </div>
                  {schedule.enabled ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative">
                        <input
                          type="time"
                          value={schedule.startTime}
                          onChange={(e) => {
                            if (!e.target.value) return;
                            updateDay(day.key, { startTime: e.target.value });
                          }}
                          className="h-9 w-[9.5rem] rounded-md border border-input bg-background px-3 pr-9 text-sm"
                          aria-label={`${day.label} start time`}
                        />
                        <Clock className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      </div>
                      <span className="text-sm text-muted-foreground">To</span>
                      <div className="relative">
                        <input
                          type="time"
                          value={schedule.endTime}
                          onChange={(e) => {
                            if (!e.target.value) return;
                            updateDay(day.key, { endTime: e.target.value });
                          }}
                          className="h-9 w-[9.5rem] rounded-md border border-input bg-background px-3 pr-9 text-sm"
                          aria-label={`${day.label} end time`}
                        />
                        <Clock className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Closed</span>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={configureKind !== null} onOpenChange={(open) => !open && setConfigureKind(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {configureKind === "offHours" ? "Configure off hours message" : "Configure welcome message"}
            </DialogTitle>
            <DialogDescription>
              This text is sent automatically on a contact&apos;s first WhatsApp message
              {configureKind === "offHours" ? " outside working hours." : " during working hours."}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={8}
            value={draftMessage}
            onChange={(e) => setDraftMessage(e.target.value)}
            placeholder={
              configureKind === "offHours"
                ? DEFAULT_LIVE_CHAT_OFF_HOURS_MESSAGE
                : DEFAULT_LIVE_CHAT_WELCOME_MESSAGE
            }
            maxLength={4096}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfigureKind(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveConfiguredMessage} disabled={saveMutation.isPending}>
              Save message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
