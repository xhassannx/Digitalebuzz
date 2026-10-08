"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarClock, Loader2, Search } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

type MeetingProvider = "google_meet" | "calendly";

type SchedulingOptions = {
  emailCopyAvailable?: boolean;
  googleMeet: boolean;
  calendly: boolean;
  googleCalendarConnections: Array<{ id: string; label: string }>;
  calendlyConnections: Array<{ id: string; label: string }>;
  whatsappSessions: Array<{ sessionId: string; label: string; connectionType?: string }>;
};

type ContactOption = {
  id: string;
  name: string;
  phoneNumber: string;
  email?: string | null;
};

function defaultDatetimeLocal(forDate?: Date | null): string {
  const base = forDate ? new Date(forDate) : new Date();
  if (!forDate) {
    base.setMinutes(0, 0, 0);
    base.setHours(base.getHours() + 1);
  } else {
    const now = new Date();
    const sameDay =
      base.getFullYear() === now.getFullYear() &&
      base.getMonth() === now.getMonth() &&
      base.getDate() === now.getDate();
    if (sameDay) {
      base.setTime(now.getTime());
      base.setMinutes(0, 0, 0);
      base.setHours(base.getHours() + 1);
    } else {
      base.setHours(10, 0, 0, 0);
    }
  }
  return format(base, "yyyy-MM-dd'T'HH:mm");
}

export function ScheduleMeetingDialog({
  open,
  onOpenChange,
  initialDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate?: Date | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [provider, setProvider] = useState<MeetingProvider>("google_meet");
  const [datetimeLocal, setDatetimeLocal] = useState(() => defaultDatetimeLocal(initialDate));
  const [durationMin, setDurationMin] = useState(30);
  const [waSessionId, setWaSessionId] = useState("");
  const [googleIntegrationId, setGoogleIntegrationId] = useState("");
  const [calendlyIntegrationId, setCalendlyIntegrationId] = useState("");
  const [calendlyUrlOverride, setCalendlyUrlOverride] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [contactId, setContactId] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [selectedContactLabel, setSelectedContactLabel] = useState("");

  const { data: options, isLoading: optionsLoading } = useQuery<SchedulingOptions>({
    queryKey: ["/api/scheduling/chat-options"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/scheduling/chat-options");
      return res.json();
    },
    enabled: open,
  });

  const { data: contactResults = [], isFetching: contactsFetching } = useQuery<ContactOption[]>({
    queryKey: ["/api/contacts", "meeting-picker", contactSearch],
    enabled: open && contactSearch.trim().length >= 1 && !contactId,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", "20");
      params.set("offset", "0");
      params.set("search", contactSearch.trim());
      const res = await apiRequest("GET", `/api/contacts?${params.toString()}`);
      const data = await res.json();
      const items = data.contacts ?? data.items ?? (Array.isArray(data) ? data : []);
      return items.map((c: any) => ({
        id: c.id,
        name: c.name,
        phoneNumber: c.phoneNumber,
        email: c.email ?? null,
      }));
    },
  });

  useEffect(() => {
    if (!open) return;
    setDatetimeLocal(defaultDatetimeLocal(initialDate));
    setContactId("");
    setContactSearch("");
    setSelectedContactLabel("");
    setCustomerEmail("");
    setCalendlyUrlOverride("");
    setDurationMin(30);
  }, [open, initialDate]);

  useEffect(() => {
    if (!open || !options) return;
    if (options.googleMeet) setProvider("google_meet");
    else if (options.calendly) setProvider("calendly");
    if (options.whatsappSessions[0]) setWaSessionId(options.whatsappSessions[0].sessionId);
    if (options.googleCalendarConnections[0]) {
      setGoogleIntegrationId(options.googleCalendarConnections[0].id);
    }
    if (options.calendlyConnections[0]) {
      setCalendlyIntegrationId(options.calendlyConnections[0].id);
    }
  }, [open, options]);

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      if (!contactId) throw new Error("Select a customer");
      if (!datetimeLocal.trim()) throw new Error("Choose date and time");
      const startIso = new Date(datetimeLocal).toISOString();
      const body: Record<string, unknown> = {
        contactId,
        provider,
        startTime: startIso,
        durationMinutes: durationMin,
        whatsappSessionId: waSessionId || undefined,
      };
      if (provider === "google_meet" && googleIntegrationId) {
        body.integrationId = googleIntegrationId;
      }
      if (provider === "calendly" && calendlyIntegrationId) {
        body.integrationId = calendlyIntegrationId;
      }
      if (provider === "calendly" && calendlyUrlOverride.trim()) {
        body.calendlySchedulingUrl = calendlyUrlOverride.trim();
      }
      if (customerEmail.trim()) {
        body.customerEmail = customerEmail.trim();
      }
      const res = await apiRequest("POST", "/api/scheduling/send-meet-link", body);
      return res.json() as Promise<{ link?: string; meetingId?: string }>;
    },
    onSuccess: () => {
      toast({
        title: "Meeting scheduled",
        description: "The meet / booking link was sent to the customer on WhatsApp.",
      });
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meetings/stats"] });
    },
    onError: (e: Error) => {
      toast({
        title: "Could not schedule meeting",
        description: e.message,
        variant: "destructive",
      });
    },
  });

  const canSend =
    !!contactId &&
    !!options?.whatsappSessions?.length &&
    !!(options?.googleMeet || options?.calendly) &&
    !!datetimeLocal.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-meetings-schedule">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-[var(--rh-brand,#047857)]" />
            Schedule meeting
          </DialogTitle>
          <DialogDescription>
            Pick a customer and send a <strong>Google Meet</strong> link or your{" "}
            <strong>Calendly</strong> booking page on WhatsApp.
          </DialogDescription>
        </DialogHeader>

        {optionsLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading options…
          </div>
        ) : !options?.whatsappSessions?.length ? (
          <p className="text-sm text-muted-foreground">
            Connect a WhatsApp session to send the message.{" "}
            <Link href="/connect" className="text-sky-700 underline">
              Connect WhatsApp
            </Link>
          </p>
        ) : !(options.googleMeet || options.calendly) ? (
          <p className="text-sm text-muted-foreground">
            Connect Google Calendar or Calendly under{" "}
            <Link href="/integrations" className="text-sky-700 underline">
              Integrations
            </Link>{" "}
            to use this feature.
          </p>
        ) : (
          <div className="space-y-4 py-1">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Customer</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={contactId ? selectedContactLabel : contactSearch}
                  onChange={(e) => {
                    setContactId("");
                    setSelectedContactLabel("");
                    setContactSearch(e.target.value);
                  }}
                  placeholder="Search contacts by name or phone…"
                  className="h-9 pl-8"
                  autoComplete="off"
                />
              </div>
              {contactId ? (
                <p className="text-xs text-emerald-700">Selected — clear the field to pick another.</p>
              ) : null}
              {!contactId && contactSearch.trim().length >= 1 ? (
                <div className="max-h-40 overflow-y-auto rounded-md border bg-background">
                  {contactsFetching ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">Searching…</p>
                  ) : contactResults.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">No customers found.</p>
                  ) : (
                    contactResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={cn(
                          "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted/60",
                        )}
                        onClick={() => {
                          setContactId(c.id);
                          const label = `${c.name || "Contact"}${c.phoneNumber ? ` · ${c.phoneNumber}` : ""}`;
                          setSelectedContactLabel(label);
                          setContactSearch(label);
                          if (c.email && !customerEmail) setCustomerEmail(String(c.email));
                        }}
                      >
                        <span className="font-medium">{c.name || c.phoneNumber || "Contact"}</span>
                        {c.phoneNumber ? (
                          <span className="text-xs text-muted-foreground">{c.phoneNumber}</span>
                        ) : null}
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>

            {(options.googleMeet || options.calendly) && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Link type</Label>
                <RadioGroup
                  value={provider}
                  onValueChange={(v) => setProvider(v as MeetingProvider)}
                  className="flex flex-col gap-2"
                >
                  {options.googleMeet ? (
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <RadioGroupItem value="google_meet" id="meetings-google" />
                      <span>Google Meet (new event)</span>
                    </label>
                  ) : null}
                  {options.calendly ? (
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <RadioGroupItem value="calendly" id="meetings-calendly" />
                      <span>Calendly (scheduling page)</span>
                    </label>
                  ) : null}
                </RadioGroup>
              </div>
            )}

            {provider === "google_meet" && options.googleCalendarConnections.length > 1 ? (
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Google connection</Label>
                <Select value={googleIntegrationId} onValueChange={setGoogleIntegrationId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.googleCalendarConnections.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {provider === "calendly" && options.calendlyConnections.length > 1 ? (
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Calendly connection</Label>
                <Select value={calendlyIntegrationId} onValueChange={setCalendlyIntegrationId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.calendlyConnections.map((i) => (
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
                value={datetimeLocal}
                onChange={(e) => setDatetimeLocal(e.target.value)}
                className="h-9"
              />
            </div>

            {provider === "google_meet" ? (
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
                  className="h-9"
                />
              </div>
            ) : null}

            {provider === "calendly" ? (
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Custom Calendly URL (optional)</Label>
                <Input
                  type="url"
                  placeholder="https://calendly.com/… (overrides auto-detected link)"
                  value={calendlyUrlOverride}
                  onChange={(e) => setCalendlyUrlOverride(e.target.value)}
                  className="h-9"
                />
              </div>
            ) : null}

            <div className="space-y-1">
              <Label className="text-xs font-semibold">WhatsApp session</Label>
              <Select value={waSessionId} onValueChange={setWaSessionId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {options.whatsappSessions.map((s) => (
                    <SelectItem key={s.sessionId} value={s.sessionId}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {options.emailCopyAvailable ? (
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Customer email (optional)</Label>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="Also send the link by email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="h-9"
                />
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
            <Button
              type="button"
              className="bg-[var(--rh-brand,#047857)] hover:bg-[var(--rh-brand-hover,#036649)]"
              disabled={scheduleMutation.isPending || !canSend}
              onClick={() => scheduleMutation.mutate()}
            >
            {scheduleMutation.isPending ? "Sending…" : "Schedule & send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
