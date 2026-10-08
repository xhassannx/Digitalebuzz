import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useLocation, useRoute } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Clock3,
  Info,
  ListOrdered,
  Loader2,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DRIP_CAMPAIGN_GOALS,
  DRIP_DUPLICATE_STRATEGIES,
  DRIP_ENTRY_TRIGGERS,
  DRIP_MESSAGE_VARIABLES,
  DRIP_STEP_ACTIONS,
  DRIP_WAIT_UNITS,
  DRIP_WEEKDAYS,
  createDripCampaignSchema,
  dripTriggerLabel,
  getCampaignEntryTriggers,
  getCampaignSessionIds,
  getCampaignSendIntervalMinutes,
  leadStatusTriggerValue,
  normalizeLeadStatusSlug,
  parseLeadStatusSlug,
  type CreateDripCampaignInput,
  type DripCampaignStep,
} from "@shared/drip-campaigns";
import { parseZonedDateTimeLocal, toDatetimeLocalValue } from "@shared/timezone";
import { useRatehonkPageSkin } from "@/panel-templates/ratehonk-v1/RatehonkSkinContext";
import { RhCard } from "@/panel-templates/ratehonk-v1/components/rh";
import {
  rhBtnPrimary,
  rhMuted,
  rhPageTitle,
} from "@/panel-templates/ratehonk-v1/rhTheme";
import { cn } from "@/lib/utils";
import { safeRandomId } from "@/lib/safe-random-id";
import { DripTemplateConfigFields } from "@/components/drip-template-config-fields";
import type { ReactNode } from "react";

type TagRow = { id: string; name: string };
type WaPhone = {
  phoneNumberId: string;
  displayPhoneNumber?: string;
  verifiedName?: string;
  sessionId?: string;
};
type LeadStatus = { id: string; name: string; slug?: string; key?: string; color?: string };
type TeamMember = {
  userId?: string;
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  user?: { id?: string; email?: string; firstName?: string; lastName?: string };
};
type OrgRow = { id: string };

function emptyStep(): DripCampaignStep {
  return {
    id: safeRandomId(),
    waitValue: 1,
    waitUnit: "days",
    waitSpecificAt: null,
    actionType: "send_whatsapp",
    actionConfig: {
      messageFormat: "custom",
      messageText: "",
    },
  };
}

function SectionIcon({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--rh-brand-light,#d1fae5)] text-[var(--rh-brand,#047857)]">
      {children}
    </div>
  );
}

function DripSectionCard({
  skin,
  title,
  description,
  icon,
  action,
  children,
}: {
  skin: boolean;
  title: string;
  description?: string;
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  if (skin) {
    return (
      <RhCard className="overflow-hidden p-0 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#f3f4f6] px-5 py-4 sm:px-6">
          <div className="flex min-w-0 flex-1 gap-3">
            {icon}
            <div className="min-w-0">
              <h2 className="text-lg font-semibold leading-7 text-[#111c2d]">{title}</h2>
              {description ? <p className="mt-0.5 text-sm text-[#717786]">{description}</p> : null}
            </div>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
        <div className="space-y-5 p-5 sm:p-6">{children}</div>
      </RhCard>
    );
  }

  return (
    <section className="rounded-xl border bg-card p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-emerald-600 font-medium">
          {icon}
          <span>{title}</span>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

const DEFAULT_FORM: CreateDripCampaignInput = {
  name: "",
  goal: "Lead Nurturing",
  entryTrigger: "manual",
  triggerConfig: { entryTriggers: ["manual"] },
  steps: [emptyStep()],
  timezone: "Asia/Kolkata",
  startTime: "09:00",
  endTime: "18:00",
  workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
  duplicateStrategy: "ignore",
  humanizerDelayMinutes: 0,
  sendIntervalMinutes: 2,
  stopOnReply: true,
  status: "draft",
};

export default function DripCampaignCreatePage() {
  const [, editParams] = useRoute("/drip-campaigns/:id/edit");
  const editId = editParams?.id;
  const isEdit = Boolean(editId);
  const { toast } = useToast();
  const skin = useRatehonkPageSkin();
  const [, setLocation] = useLocation();
  const [form, setForm] = useState<CreateDripCampaignInput>(DEFAULT_FORM);

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ["/api/drip-campaigns", editId],
    enabled: isEdit,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/drip-campaigns/${editId}`);
      return res.json();
    },
  });

  const { data: tags = [] } = useQuery<TagRow[]>({
    queryKey: ["/api/tags"],
  });

  const { data: phoneNumbersData } = useQuery<{ success?: boolean; phoneNumbers?: WaPhone[] }>({
    queryKey: ["/api/integrations/whatsapp-business/added-phones"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/integrations/whatsapp-business/added-phones");
      return res.json();
    },
  });
  const phoneNumbers = phoneNumbersData?.phoneNumbers || [];
  const selectablePhones = useMemo(
    () => phoneNumbers.filter((p) => !!p.sessionId),
    [phoneNumbers],
  );

  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState("");

  const selectedSessionIds = useMemo(
    () => getCampaignSessionIds(form),
    [form.sessionId, form.triggerConfig],
  );

  const toggleSessionId = (sessionId: string) => {
    if (!sessionId) return;
    setForm((p) => {
      const current = getCampaignSessionIds(p);
      const next = current.includes(sessionId)
        ? current.filter((id) => id !== sessionId)
        : [...current, sessionId];
      // Keep at least one number selected when toggling
      const safe = next.length > 0 ? next : current;
      return {
        ...p,
        sessionId: safe[0] || null,
        triggerConfig: {
          ...p.triggerConfig,
          sessionIds: safe,
        },
      };
    });
  };

  // Default-select first WhatsApp number when creating a new campaign
  useEffect(() => {
    if (isEdit || selectablePhones.length === 0) return;
    if (selectedSessionIds.length > 0) return;
    const first = selectablePhones[0];
    if (!first.sessionId) return;
    setSelectedPhoneNumberId(first.phoneNumberId);
    setForm((p) => ({
      ...p,
      sessionId: first.sessionId || null,
      triggerConfig: {
        ...p.triggerConfig,
        sessionIds: [first.sessionId!],
      },
    }));
  }, [isEdit, selectablePhones, selectedSessionIds.length]);

  // Keep template phone picker in sync with first selected session
  useEffect(() => {
    if (selectedSessionIds.length === 0 || selectablePhones.length === 0) return;
    const match = selectablePhones.find((p) => p.sessionId === selectedSessionIds[0]);
    if (match?.phoneNumberId && match.phoneNumberId !== selectedPhoneNumberId) {
      setSelectedPhoneNumberId(match.phoneNumberId);
    }
  }, [selectedSessionIds, selectablePhones, selectedPhoneNumberId]);

  const { data: orgs = [] } = useQuery<OrgRow[]>({
    queryKey: ["/api/organizations"],
  });
  const currentOrganizationId = orgs[0]?.id;

  const { data: leadStatusData, refetch: refetchLeadStatuses } = useQuery<{
    statuses?: LeadStatus[];
  } | LeadStatus[]>({
    queryKey: ["/api/leads/statuses"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/leads/statuses");
      return res.json();
    },
  });
  // Same cache key as Leads page (`{ statuses }`) — normalize so SPA nav from Leads doesn't crash.
  const leadStatuses: LeadStatus[] = Array.isArray(leadStatusData)
    ? leadStatusData
    : Array.isArray(leadStatusData?.statuses)
      ? leadStatusData.statuses
      : [];

  const [addTriggerOpen, setAddTriggerOpen] = useState(false);
  const [newTriggerName, setNewTriggerName] = useState("");

  const addLeadStatusMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/leads/statuses", { name });
      return res.json();
    },
    onSuccess: async (created: LeadStatus) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/leads/statuses"] });
      await refetchLeadStatuses();
      const slug = normalizeLeadStatusSlug(created.slug || created.key || created.name);
      if (slug) {
        const value = leadStatusTriggerValue(slug);
        setForm((p) => {
          const current = getCampaignEntryTriggers(p);
          const next = current.includes(value) ? current : [...current, value];
          return {
            ...p,
            entryTrigger: next[0] || value,
            triggerConfig: {
              ...p.triggerConfig,
              entryTriggers: next,
              pipelineStatus: slug,
            },
          };
        });
      }
      setAddTriggerOpen(false);
      setNewTriggerName("");
      toast({ title: "Entry trigger added", description: `"${created.name}" is now available.` });
    },
    onError: (e: Error) =>
      toast({ title: "Failed to add trigger", description: e.message, variant: "destructive" }),
  });

  const selectedEntryTriggers = useMemo(
    () => getCampaignEntryTriggers(form),
    [form.entryTrigger, form.triggerConfig],
  );

  const toggleEntryTrigger = (value: string) => {
    setForm((p) => {
      const current = getCampaignEntryTriggers(p);
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      // Keep at least one selected
      const safe = next.length > 0 ? next : current;
      const primary = safe[0] || "manual";
      const leadSlug = safe.map(parseLeadStatusSlug).find(Boolean) || undefined;
      return {
        ...p,
        entryTrigger: primary,
        triggerConfig: {
          ...p.triggerConfig,
          entryTriggers: safe,
          ...(leadSlug ? { pipelineStatus: leadSlug } : {}),
        },
      };
    });
  };

  const entryTriggerOptions = useMemo(() => {
    const builtins = DRIP_ENTRY_TRIGGERS.map((t) => ({
      value: t.value,
      label: t.label,
      group: "Built-in" as const,
    }));
    const statuses = leadStatuses
      .map((s) => {
        const slug = normalizeLeadStatusSlug(s.slug || s.key || s.name);
        if (!slug) return null;
        return {
          value: leadStatusTriggerValue(slug),
          label: s.name,
          group: "Lead Status" as const,
        };
      })
      .filter(Boolean) as Array<{ value: string; label: string; group: "Lead Status" }>;

    const options = [...builtins, ...statuses];
    for (const selected of selectedEntryTriggers) {
      if (selected && !options.some((o) => o.value === selected)) {
        options.push({
          value: selected,
          label: dripTriggerLabel(selected, {
            leadStatusNames: Object.fromEntries(
              leadStatuses.map((s) => [
                normalizeLeadStatusSlug(s.slug || s.key || s.name),
                s.name,
              ]),
            ),
          }),
          group: "Lead Status",
        });
      }
    }
    return options;
  }, [leadStatuses, selectedEntryTriggers]);

  const entryTriggerSummary = useMemo(() => {
    if (selectedEntryTriggers.length === 0) return "Select entry triggers";
    if (selectedEntryTriggers.length === 1) {
      return dripTriggerLabel(selectedEntryTriggers[0], {
        leadStatusNames: Object.fromEntries(
          leadStatuses.map((s) => [
            normalizeLeadStatusSlug(s.slug || s.key || s.name),
            s.name,
          ]),
        ),
      });
    }
    return `${selectedEntryTriggers.length} triggers selected`;
  }, [selectedEntryTriggers, leadStatuses]);

  const { data: team = [] } = useQuery<TeamMember[]>({
    queryKey: ["/api/organizations", currentOrganizationId, "members"],
    enabled: !!currentOrganizationId,
    queryFn: async () => {
      if (!currentOrganizationId) return [];
      try {
        const res = await apiRequest("GET", `/api/organizations/${currentOrganizationId}/members`);
        const json = await res.json();
        return Array.isArray(json) ? json : json?.members || [];
      } catch {
        return [];
      }
    },
  });

  const memberOptions = useMemo(() => {
    return team
      .map((m) => {
        const userId = m.userId || m.user?.id || m.id || "";
        const firstName = m.firstName || m.user?.firstName;
        const lastName = m.lastName || m.user?.lastName;
        const email = m.email || m.user?.email;
        return {
          userId,
          label: [firstName, lastName].filter(Boolean).join(" ") || email || userId,
        };
      })
      .filter((m) => m.userId);
  }, [team]);

  useEffect(() => {
    if (!existing) return;
    const entryTriggers = getCampaignEntryTriggers(existing);
    const sessionIds = getCampaignSessionIds(existing);
    setForm({
      name: existing.name || "",
      goal: existing.goal || "Lead Nurturing",
      entryTrigger: entryTriggers[0] || existing.entryTrigger || "manual",
      triggerConfig: {
        ...(existing.triggerConfig || {}),
        entryTriggers: entryTriggers.length ? entryTriggers : ["manual"],
        sessionIds,
      },
      sessionId: sessionIds[0] || existing.sessionId || null,
      steps:
        Array.isArray(existing.steps) && existing.steps.length
          ? existing.steps.map((s: DripCampaignStep) => ({
              ...emptyStep(),
              ...s,
              id: s.id || safeRandomId(),
              actionConfig: s.actionConfig || { messageFormat: "custom", messageText: "" },
            }))
          : [emptyStep()],
      timezone: existing.timezone || "Asia/Kolkata",
      startTime: existing.startTime || "09:00",
      endTime: existing.endTime || "18:00",
      workingDays: existing.workingDays?.length
        ? existing.workingDays
        : DEFAULT_FORM.workingDays,
      duplicateStrategy: existing.duplicateStrategy || "ignore",
      humanizerDelayMinutes: existing.humanizerDelayMinutes ?? 0,
      sendIntervalMinutes: getCampaignSendIntervalMinutes(existing),
      stopOnReply: existing.stopOnReply ?? true,
      status: existing.status || "draft",
    });
  }, [existing]);

  const saveMutation = useMutation({
    mutationFn: async (status: "draft" | "active") => {
      const triggers = getCampaignEntryTriggers(form);
      const sessionIds = getCampaignSessionIds(form);
      if (selectablePhones.length > 0 && sessionIds.length === 0) {
        throw new Error("Select at least one WhatsApp number for this drip campaign");
      }
      const sendIntervalMinutes = Math.max(
        0,
        Math.min(60, Math.floor(Number(form.sendIntervalMinutes) || 0)),
      );
      const payload = {
        ...form,
        status,
        entryTrigger: triggers[0] || form.entryTrigger || "manual",
        sessionId: sessionIds[0] || form.sessionId || null,
        sendIntervalMinutes,
        triggerConfig: {
          ...form.triggerConfig,
          entryTriggers: triggers.length ? triggers : ["manual"],
          sessionIds,
          sendIntervalMinutes,
        },
      };
      const parsed = createDripCampaignSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error(parsed.error.errors[0]?.message || "Invalid form");
      }
      if (isEdit && editId) {
        const res = await apiRequest("PATCH", `/api/drip-campaigns/${editId}`, parsed.data);
        return res.json();
      }
      const res = await apiRequest("POST", "/api/drip-campaigns", parsed.data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drip-campaigns"] });
      toast({ title: isEdit ? "Campaign updated" : "Drip campaign saved" });
      setLocation("/drip-campaigns");
    },
    onError: (e: Error) =>
      toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const primaryBtn = skin ? rhBtnPrimary : "bg-emerald-600 hover:bg-emerald-700 text-white";
  const outlineBtn = skin
    ? "rounded-xl border-[#e5e7eb] bg-white hover:bg-[#f8fafc] text-[#111c2d]"
    : "";
  const labelClass = skin
    ? "text-xs font-semibold uppercase tracking-wide text-[#717786]"
    : "text-xs uppercase tracking-wide text-muted-foreground";
  const fieldClass = skin
    ? "h-11 rounded-xl border-[#e5e7eb] bg-white shadow-none focus-visible:ring-[var(--rh-brand)]"
    : "";
  const pageShell = cn(
    "mx-auto w-full space-y-6 pb-28",
    skin
      ? "px-4 py-5 sm:px-8 sm:py-6 md:px-10 lg:px-12 max-w-[1100px]"
      : "p-4 md:p-6 max-w-5xl",
  );

  const updateStep = (index: number, patch: Partial<DripCampaignStep>) => {
    setForm((prev) => {
      const steps = [...prev.steps];
      steps[index] = { ...steps[index], ...patch };
      return { ...prev, steps };
    });
  };

  const updateStepConfig = (index: number, patch: Record<string, unknown>) => {
    setForm((prev) => {
      const steps = [...prev.steps];
      steps[index] = {
        ...steps[index],
        actionConfig: { ...(steps[index].actionConfig || {}), ...patch },
      };
      return { ...prev, steps };
    });
  };

  const moveStep = (index: number, dir: -1 | 1) => {
    setForm((prev) => {
      const next = index + dir;
      if (next < 0 || next >= prev.steps.length) return prev;
      const steps = [...prev.steps];
      [steps[index], steps[next]] = [steps[next], steps[index]];
      return { ...prev, steps };
    });
  };

  const timezoneOptions = useMemo(
    () => [
      "Asia/Kolkata",
      "UTC",
      "America/New_York",
      "America/Los_Angeles",
      "Europe/London",
      "Asia/Dubai",
      "Asia/Singapore",
    ],
    [],
  );

  if (isEdit && loadingExisting) {
    return (
      <div className={cn(pageShell, "flex items-center justify-center py-24 gap-2 text-muted-foreground")}>
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading campaign…
      </div>
    );
  }

  return (
    <div className={pageShell}>
      <div>
        <h1 className={skin ? rhPageTitle : "text-2xl md:text-3xl font-semibold tracking-tight"}>
          {isEdit ? "Edit Drip Campaign" : "Create Drip Campaign"}
        </h1>
        <p className={cn("mt-1 text-sm md:text-base", skin ? rhMuted : "text-muted-foreground")}>
          Build a drip campaign sequence with custom rules, schedules, and actions.
        </p>
      </div>

      {/* 1. Campaign Info */}
      <DripSectionCard
        skin={skin}
        title="1. Campaign Info & Trigger Settings"
        description="Name your campaign, set the goal, and choose when contacts enter the sequence."
        icon={
          skin ? (
            <SectionIcon>
              <Info className="h-5 w-5" />
            </SectionIcon>
          ) : (
            <Info className="h-4 w-4" />
          )
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className={labelClass}>Campaign Name</Label>
            <Input
              className={fieldClass}
              placeholder="e.g. Lead Nurturing Sequence"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label className={labelClass}>Campaign Goal</Label>
            <Select
              value={form.goal}
              onValueChange={(v) =>
                setForm((p) => ({ ...p, goal: v as CreateDripCampaignInput["goal"] }))
              }
            >
              <SelectTrigger className={fieldClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DRIP_CAMPAIGN_GOALS.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label className={labelClass}>WhatsApp Number(s)</Label>
          <p className={cn("text-xs", skin ? "text-[#717786]" : "text-muted-foreground")}>
            Select one or more numbers. This drip campaign will send only from the selected number(s).
          </p>
          {selectablePhones.length === 0 ? (
            <div
              className={cn(
                "rounded-xl border px-3 py-3 text-sm",
                skin ? "border-[#e5e7eb] bg-[#fafbff] text-[#717786]" : "bg-muted/30 text-muted-foreground",
              )}
            >
              No WhatsApp Business numbers found. Connect a number in Integrations first.
            </div>
          ) : (
            <div
              className={cn(
                "rounded-xl border divide-y",
                skin ? "border-[#e5e7eb] bg-white" : "border-border",
              )}
            >
              {selectablePhones.map((phone) => {
                const sid = phone.sessionId!;
                const checked = selectedSessionIds.includes(sid);
                const label =
                  phone.displayPhoneNumber ||
                  phone.verifiedName ||
                  phone.phoneNumberId;
                return (
                  <button
                    key={sid}
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-accent/50",
                      checked && (skin ? "bg-[var(--rh-brand-light)]/40" : "bg-accent/40"),
                    )}
                    onClick={() => toggleSessionId(sid)}
                  >
                    <Checkbox checked={checked} tabIndex={-1} className="pointer-events-none" />
                    <div className="min-w-0 flex-1">
                      <div className={cn("font-medium truncate", skin && "text-[#111c2d]")}>
                        {label}
                      </div>
                      {phone.verifiedName && phone.displayPhoneNumber ? (
                        <div className={cn("text-xs truncate", skin ? "text-[#717786]" : "text-muted-foreground")}>
                          {phone.verifiedName}
                        </div>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {selectedSessionIds.length > 0 ? (
            <p className={cn("text-xs", skin ? "text-[#717786]" : "text-muted-foreground")}>
              {selectedSessionIds.length} number{selectedSessionIds.length === 1 ? "" : "s"} selected
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_auto] items-end">
          <div className="space-y-2 min-w-0">
            <Label className={labelClass}>Choose Entry Trigger</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  className={cn(
                    "w-full justify-between font-normal h-10 px-3",
                    skin && "h-11 rounded-xl border-[#e5e7eb]",
                  )}
                >
                  <span className="truncate text-left">{entryTriggerSummary}</span>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <div className="max-h-72 overflow-y-auto py-1">
                  <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Built-in
                  </div>
                  {entryTriggerOptions
                    .filter((t) => t.group === "Built-in")
                    .map((t) => {
                      const checked = selectedEntryTriggers.includes(t.value);
                      return (
                        <button
                          key={t.value}
                          type="button"
                          className={cn(
                            "flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent",
                            checked && "bg-accent/60",
                          )}
                          onClick={() => toggleEntryTrigger(t.value)}
                        >
                          <Checkbox checked={checked} tabIndex={-1} className="pointer-events-none" />
                          <span>{t.label}</span>
                        </button>
                      );
                    })}
                  {entryTriggerOptions.some((t) => t.group === "Lead Status") ? (
                    <>
                      <div className="px-3 py-1.5 mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border-t">
                        Lead Status
                      </div>
                      {entryTriggerOptions
                        .filter((t) => t.group === "Lead Status")
                        .map((t) => {
                          const checked = selectedEntryTriggers.includes(t.value);
                          return (
                            <button
                              key={t.value}
                              type="button"
                              className={cn(
                                "flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent",
                                checked && "bg-accent/60",
                              )}
                              onClick={() => toggleEntryTrigger(t.value)}
                            >
                              <Checkbox checked={checked} tabIndex={-1} className="pointer-events-none" />
                              <span>{t.label}</span>
                            </button>
                          );
                        })}
                    </>
                  ) : null}
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <Button
            type="button"
            variant="outline"
            className={cn("gap-1 shrink-0", outlineBtn)}
            onClick={() => setAddTriggerOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Add trigger
          </Button>
        </div>
      </DripSectionCard>

      {/* 2. Sequence */}
      <DripSectionCard
        skin={skin}
        title="2. Automation Sequence Timeline"
        description="Define wait times and actions for each step in your drip sequence."
        icon={
          skin ? (
            <SectionIcon>
              <ListOrdered className="h-5 w-5" />
            </SectionIcon>
          ) : (
            <ListOrdered className="h-4 w-4" />
          )
        }
        action={
          <Button
            type="button"
            size="sm"
            className={cn("gap-1", primaryBtn)}
            onClick={() => setForm((p) => ({ ...p, steps: [...p.steps, emptyStep()] }))}
          >
            <Plus className="h-4 w-4" />
            Add Step
          </Button>
        }
      >
        <div className="space-y-4">
          {form.steps.map((step, index) => (
            <div
              key={step.id || index}
              className={cn(
                "border p-4 space-y-4",
                skin
                  ? "border-[#e5e7eb] bg-[#fafbff] rounded-xl"
                  : "rounded-lg bg-muted/20",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex h-7 w-7 items-center justify-center rounded-full text-white text-sm font-medium",
                      skin ? "bg-[var(--rh-brand)]" : "bg-emerald-600",
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium">Step {index + 1}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => moveStep(index, -1)}
                    disabled={index === 0}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => moveStep(index, 1)}
                    disabled={index === form.steps.length - 1}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        steps: p.steps.length <= 1 ? p.steps : p.steps.filter((_, i) => i !== index),
                      }))
                    }
                    disabled={form.steps.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label className={labelClass}>Wait</Label>
                  <Input
                    type="number"
                    min={0}
                    className={cn("w-24", fieldClass)}
                    disabled={step.waitUnit === "immediately" || step.waitUnit === "specific_datetime"}
                    value={step.waitValue}
                    onChange={(e) =>
                      updateStep(index, { waitValue: Math.max(0, parseInt(e.target.value || "0", 10)) })
                    }
                  />
                </div>
                <div className="space-y-1 min-w-[180px]">
                  <Label className={labelClass}>Unit</Label>
                  <Select
                    value={step.waitUnit}
                    onValueChange={(v) =>
                      updateStep(index, {
                        waitUnit: v as DripCampaignStep["waitUnit"],
                        waitValue: v === "immediately" ? 0 : step.waitValue || 1,
                      })
                    }
                  >
                    <SelectTrigger className={fieldClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DRIP_WAIT_UNITS.map((u) => (
                        <SelectItem key={u.value} value={u.value}>
                          {u.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {step.waitUnit === "specific_datetime" && (
                  <div className="space-y-1">
                    <Label className={labelClass}>Date & Time</Label>
                    <Input
                      type="datetime-local"
                      className={fieldClass}
                      value={
                        step.waitSpecificAt
                          ? toDatetimeLocalValue(step.waitSpecificAt, form.timezone)
                          : ""
                      }
                      onChange={(e) =>
                        updateStep(index, {
                          waitSpecificAt: e.target.value
                            ? parseZonedDateTimeLocal(e.target.value, form.timezone).toISOString()
                            : null,
                        })
                      }
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className={labelClass}>Select Action</Label>
                <Select
                  value={step.actionType}
                  onValueChange={(v) =>
                    updateStep(index, {
                      actionType: v as DripCampaignStep["actionType"],
                      actionConfig:
                        v === "send_whatsapp"
                          ? { messageFormat: "custom", messageText: "" }
                          : {},
                    })
                  }
                >
                  <SelectTrigger className={fieldClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DRIP_STEP_ACTIONS.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {step.actionType === "send_whatsapp" && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className={labelClass}>Format</Label>
                    <RadioGroup
                      value={step.actionConfig?.messageFormat || "custom"}
                      onValueChange={(v) => updateStepConfig(index, { messageFormat: v })}
                      className="flex flex-wrap gap-4"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="custom" id={`fmt-custom-${index}`} />
                        <Label htmlFor={`fmt-custom-${index}`} className="text-sm font-normal">
                          CUSTOM MESSAGE
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="meta_template" id={`fmt-meta-${index}`} />
                        <Label htmlFor={`fmt-meta-${index}`} className="text-sm font-normal">
                          META TEMPLATE
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {(step.actionConfig?.messageFormat || "custom") === "custom" ? (
                    <>
                      <div className="space-y-2">
                        <Label className={labelClass}>Message Text</Label>
                        <Textarea
                          rows={4}
                          className={skin ? "rounded-xl border-[#e5e7eb] bg-white shadow-none focus-visible:ring-[var(--rh-brand)]" : undefined}
                          placeholder="Type your message here..."
                          value={step.actionConfig?.messageText || ""}
                          onChange={(e) => updateStepConfig(index, { messageText: e.target.value })}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {DRIP_MESSAGE_VARIABLES.map((v) => (
                          <Button
                            key={v}
                            type="button"
                            variant="outline"
                            size="sm"
                            className={cn(
                              "h-7 text-xs",
                              skin
                                ? "text-[var(--rh-brand)] border-[var(--rh-brand-light,#d1fae5)]"
                                : "text-sky-700 border-sky-200",
                            )}
                            onClick={() =>
                              updateStepConfig(index, {
                                messageText: `${step.actionConfig?.messageText || ""}${v}`,
                              })
                            }
                          >
                            {v}
                          </Button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <DripTemplateConfigFields
                      config={step.actionConfig || {}}
                      phoneNumbers={phoneNumbers}
                      selectedPhoneNumberId={selectedPhoneNumberId}
                      autoOpen={!step.actionConfig?.templateName}
                      onPhoneNumberChange={(phoneNumberId, sessionId) => {
                        setSelectedPhoneNumberId(phoneNumberId);
                        if (sessionId) {
                          setForm((p) => ({ ...p, sessionId }));
                        }
                      }}
                      onChange={(patch) => updateStepConfig(index, patch)}
                    />
                  )}
                </div>
              )}
              {(step.actionType === "apply_label" || step.actionType === "remove_label") && (
                <div className="space-y-2">
                  <Label className={labelClass}>Label</Label>
                  <Select
                    value={step.actionConfig?.labelId || ""}
                    onValueChange={(v) => updateStepConfig(index, { labelId: v })}
                  >
                    <SelectTrigger className={fieldClass}>
                      <SelectValue placeholder="Select label" />
                    </SelectTrigger>
                    <SelectContent>
                      {tags.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {step.actionType === "move_pipeline_stage" && (
                <div className="space-y-2">
                  <Label className={labelClass}>Pipeline Stage</Label>
                  <Select
                    value={step.actionConfig?.pipelineStatus || ""}
                    onValueChange={(v) => updateStepConfig(index, { pipelineStatus: v })}
                  >
                    <SelectTrigger className={fieldClass}>
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {leadStatuses.map((s) => (
                        <SelectItem key={s.id || s.name} value={s.slug || s.key || s.name}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {step.actionType === "assign_lead" && (
                <div className="space-y-2">
                  <Label className={labelClass}>Assign To User</Label>
                  <Select
                    value={step.actionConfig?.assignToUserId || ""}
                    onValueChange={(v) => updateStepConfig(index, { assignToUserId: v })}
                  >
                    <SelectTrigger className={fieldClass}>
                      <SelectValue placeholder="Select user" />
                    </SelectTrigger>
                    <SelectContent>
                      {memberOptions.map((m) => (
                        <SelectItem key={m.userId} value={m.userId}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {step.actionType === "webhook" && (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label className={labelClass}>Webhook URL</Label>
                    <Input
                      className={fieldClass}
                      value={step.actionConfig?.webhookUrl || ""}
                      onChange={(e) => updateStepConfig(index, { webhookUrl: e.target.value })}
                      placeholder="https://example.com/hook"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className={labelClass}>Method</Label>
                    <Select
                      value={step.actionConfig?.webhookMethod || "POST"}
                      onValueChange={(v) => updateStepConfig(index, { webhookMethod: v })}
                    >
                      <SelectTrigger className={fieldClass}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="POST">POST</SelectItem>
                        <SelectItem value="GET">GET</SelectItem>
                        <SelectItem value="PUT">PUT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </DripSectionCard>

      {/* 3. Schedule */}
      <DripSectionCard
        skin={skin}
        title="3. Schedule & Timing Rules"
        description="Control timezone, sending hours, working days, and safety stop conditions."
        icon={
          skin ? (
            <SectionIcon>
              <Clock3 className="h-5 w-5" />
            </SectionIcon>
          ) : (
            <Clock3 className="h-4 w-4" />
          )
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label className={labelClass}>Execution Timezone</Label>
            <Select
              value={form.timezone}
              onValueChange={(v) => setForm((p) => ({ ...p, timezone: v }))}
            >
              <SelectTrigger className={fieldClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timezoneOptions.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className={labelClass}>Start Time</Label>
            <Input
              type="time"
              className={fieldClass}
              value={form.startTime}
              onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label className={labelClass}>End Time</Label>
            <Input
              type="time"
              className={fieldClass}
              value={form.endTime}
              onChange={(e) => setForm((p) => ({ ...p, endTime: e.target.value }))}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className={labelClass}>Working Days</Label>
          <div className="flex flex-wrap gap-3">
            {DRIP_WEEKDAYS.map((day) => {
              const checked = form.workingDays.includes(day);
              return (
                <label key={day} className="flex items-center gap-2 text-sm capitalize">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) =>
                      setForm((p) => ({
                        ...p,
                        workingDays: v
                          ? [...p.workingDays, day]
                          : p.workingDays.filter((d) => d !== day),
                      }))
                    }
                  />
                  {day}
                </label>
              );
            })}
          </div>
        </div>

        <div className={cn("pt-2 border-t space-y-4", skin && "border-[#f3f4f6]")}>
          <div className="flex items-center gap-2">
            {skin ? (
              <ShieldCheck className="h-4 w-4 text-[var(--rh-brand)]" />
            ) : (
              <ShieldCheck className={cn("h-4 w-4", skin ? "text-[var(--rh-brand)]" : "text-emerald-600")} />
            )}
            <h3 className="text-sm font-medium">Safety & Stop Conditions</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className={labelClass}>Duplicate Protection Strategy</Label>
              <Select
                value={form.duplicateStrategy}
                onValueChange={(v) =>
                  setForm((p) => ({
                    ...p,
                    duplicateStrategy: v as CreateDripCampaignInput["duplicateStrategy"],
                  }))
                }
              >
                <SelectTrigger className={fieldClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DRIP_DUPLICATE_STRATEGIES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className={labelClass}>Message send interval (minutes)</Label>
              <Input
                type="number"
                min={0}
                max={60}
                className={fieldClass}
                value={form.sendIntervalMinutes ?? 2}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    sendIntervalMinutes: Math.max(0, Math.min(60, parseInt(e.target.value || "0", 10) || 0)),
                  }))
                }
              />
              <p className={cn("text-xs", skin ? "text-[#717786]" : "text-muted-foreground")}>
                Minimum gap between WhatsApp messages to different contacts (e.g. leads in New).
                Default 2 minutes. Use 0 for no gap.
              </p>
            </div>
            <div className="space-y-2">
              <Label className={labelClass}>Humanizer Random Delay (Minutes)</Label>
              <Input
                type="number"
                min={0}
                max={120}
                className={fieldClass}
                value={form.humanizerDelayMinutes}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    humanizerDelayMinutes: Math.max(0, parseInt(e.target.value || "0", 10)),
                  }))
                }
              />
            </div>
          </div>

          <label
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3 cursor-pointer",
              skin && "rounded-xl border-[#e5e7eb] bg-[#fafbff]",
            )}
          >
            <Checkbox
              checked={form.stopOnReply}
              onCheckedChange={(v) => setForm((p) => ({ ...p, stopOnReply: !!v }))}
              className="mt-0.5"
            />
            <div>
              <div className="text-sm font-medium uppercase tracking-wide">
                Stop Campaign If Customer Replies
              </div>
              <p className={cn("text-xs mt-1", skin ? rhMuted : "text-muted-foreground")}>
                Cancels remaining steps when the contact sends any incoming WhatsApp reply.
              </p>
            </div>
          </label>
        </div>
      </DripSectionCard>

      <div
        className={cn(
          "flex flex-wrap items-center justify-end gap-2 sticky bottom-0 z-10 py-3 border-t",
          skin
            ? "-mx-4 sm:-mx-8 md:-mx-10 lg:-mx-12 px-4 sm:px-8 md:px-10 lg:px-12 border-[#e5e7eb] bg-white/95 backdrop-blur"
            : "bg-white",
        )}
      >
        <Button variant="outline" className={cn("gap-2", outlineBtn)} asChild>
          <Link href="/drip-campaigns">
            <X className="h-4 w-4" />
            Cancel
          </Link>
        </Button>
        <Button
          variant="secondary"
          className={cn("gap-2", outlineBtn)}
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate("draft")}
        >
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save as Draft
        </Button>
        <Button
          className={cn("gap-2", primaryBtn)}
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate("active")}
        >
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Drip Campaign
        </Button>
      </div>

      <Dialog open={addTriggerOpen} onOpenChange={setAddTriggerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add entry trigger</DialogTitle>
            <DialogDescription>
              Creates a new Lead Status and adds it to the entry trigger list. When a lead moves to
              this status, matching drip campaigns will enroll them.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="new-trigger-name" className={labelClass}>
              Lead status name
            </Label>
            <Input
              id="new-trigger-name"
              className={fieldClass}
              value={newTriggerName}
              onChange={(e) => setNewTriggerName(e.target.value)}
              placeholder="e.g. Hot Lead"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTriggerName.trim()) {
                  e.preventDefault();
                  addLeadStatusMutation.mutate(newTriggerName.trim());
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" className={outlineBtn} onClick={() => setAddTriggerOpen(false)}>
              Cancel
            </Button>
            <Button
              className={cn(primaryBtn)}
              disabled={!newTriggerName.trim() || addLeadStatusMutation.isPending}
              onClick={() => addLeadStatusMutation.mutate(newTriggerName.trim())}
            >
              {addLeadStatusMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Add trigger"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
