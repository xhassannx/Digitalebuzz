import { useCallback, useEffect, useMemo, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookUser,
  Calendar,
  ChevronDown,
  Clock,
  ExternalLink,
  ListRestart,
  Loader2,
  Plus,
  Save,
  Search,
  Timer,
  Trash2,
  Workflow,
} from "lucide-react";
import {
  isLinearFlowDefinition,
  toLinearFlowV2ForEdit,
  type LinearFlowDefinition,
  type LinearFlowDefinitionV2,
  type LinearFlowStep,
  type LinearFlowTrigger,
} from "@shared/linear-flow";
import { apiRequest } from "@/lib/queryClient";
import { canvasGraphFromLinearFlow, type CanvasNodeForSync } from "@/lib/flow-canvas-linear-sync";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  defaultConfigJsonForApp,
  getSimpleFlowApp,
  SIMPLE_FLOW_APP_GROUPS,
} from "@/lib/simple-flow-catalog";
import { integrationStepFieldsForApp } from "@/components/simple-flow/integration-step-fields";
import {
  getAllExampleLinearFlowSteps,
  getCatalogAppIdsMissingFromExamplePack,
} from "@/lib/simple-flow-all-examples";
import { findCanvasAction, getCanvasActionsForSimpleApp } from "@/lib/simple-flow-canvas-actions";
import { defaultConfigJsonForSimpleAction, mergeConfigWhenChangingAction } from "@/lib/simple-flow-step-defaults";
import {
  linearTriggerFromContactPickId,
  SIMPLE_CONTACT_TRIGGER_ROWS,
  SIMPLE_TRIGGER_APP_ROWS,
  triggerSummary,
} from "@/lib/simple-flow-triggers";

type FlowStatus = "active" | "inactive" | "draft";

type AutomationFlowRow = {
  id: string;
  name: string;
  status: FlowStatus;
  createdAt: string;
  updatedAt: string;
  nodes?: unknown[];
  edges?: unknown[];
  linearFlow?: LinearFlowDefinition | null;
};

/** Sample / canvas flows often have nodes+edges but no `linear_flow`; that must not be confused with the simple builder. */
function flowRowHasCanvasNodes(row: AutomationFlowRow | null | undefined): boolean {
  return Array.isArray(row?.nodes) && row.nodes.length > 0;
}

type LocalStep = {
  id: string;
  appId: string;
  actionLabel: string;
  configJson: string;
};

function parseTriggerFromFlow(t: unknown): LinearFlowTrigger {
  if (!t || typeof t !== "object") return { type: "contact.created" };
  const o = t as Record<string, unknown>;
  if (o.type === "contact.updated") {
    return { type: "contact.updated" };
  }
  if (o.type === "contact.tag_added") {
    return {
      type: "contact.tag_added",
      tagId: typeof o.tagId === "string" ? o.tagId : undefined,
      tagName: typeof o.tagName === "string" ? o.tagName : undefined,
    };
  }
  if (o.type === "drip.sequence_started") {
    return {
      type: "drip.sequence_started",
      campaignId: typeof o.campaignId === "string" ? o.campaignId : undefined,
      campaignName: typeof o.campaignName === "string" ? o.campaignName : undefined,
    };
  }
  if (o.type === "google_calendar.new_event") {
    return { type: "google_calendar.new_event" };
  }
  return { type: "contact.created" };
}

function stepsToLocal(steps: LinearFlowStep[]): LocalStep[] {
  return steps.map((s) => ({
    id: s.id,
    appId: s.appId,
    actionLabel: s.actionLabel,
    configJson: JSON.stringify(s.config && typeof s.config === "object" ? s.config : {}, null, 2),
  }));
}

function readCanvasActionId(configJson: string): string {
  try {
    const o = JSON.parse(configJson || "{}") as Record<string, unknown>;
    return typeof o._canvasActionId === "string" ? o._canvasActionId.trim() : "";
  } catch {
    return "";
  }
}

function parseSteps(local: LocalStep[]): { ok: true; steps: LinearFlowStep[] } | { ok: false; message: string } {
  const out: LinearFlowStep[] = [];
  for (const s of local) {
    let config: Record<string, unknown> = {};
    const raw = s.configJson.trim();
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
          return { ok: false, message: `Step "${s.actionLabel}": config must be a JSON object.` };
        }
        config = parsed as Record<string, unknown>;
      } catch {
        return { ok: false, message: `Step "${s.actionLabel}": invalid JSON in configuration.` };
      }
    }
    out.push({
      id: s.id,
      appId: s.appId,
      actionLabel: s.actionLabel.trim() || "Untitled action",
      config,
    });
  }
  return { ok: true, steps: out };
}

function parseDelayParts(json: string): { days: number; hours: number; minutes: number; seconds: number } {
  try {
    const o = JSON.parse(json || "{}") as Record<string, unknown>;
    return {
      days: Math.max(0, Math.floor(Number(o.days) || 0)),
      hours: Math.max(0, Math.floor(Number(o.hours) || 0)),
      minutes: Math.max(0, Math.floor(Number(o.minutes) || 0)),
      seconds: Math.max(0, Math.floor(Number(o.seconds) || 0)),
    };
  } catch {
    return { days: 0, hours: 0, minutes: 10, seconds: 0 };
  }
}

function DelayStepFields({ configJson, onUpdate }: { configJson: string; onUpdate: (next: string) => void }) {
  const parsed = useMemo(() => parseDelayParts(configJson), [configJson]);
  const [days, setDays] = useState(parsed.days);
  const [hours, setHours] = useState(parsed.hours);
  const [minutes, setMinutes] = useState(parsed.minutes);
  const [seconds, setSeconds] = useState(parsed.seconds);

  useEffect(() => {
    setDays(parsed.days);
    setHours(parsed.hours);
    setMinutes(parsed.minutes);
    setSeconds(parsed.seconds);
  }, [parsed.days, parsed.hours, parsed.minutes, parsed.seconds]);

  const emit = (d: number, h: number, m: number, sec: number) => {
    onUpdate(
      JSON.stringify(
        {
          days: d,
          hours: h,
          minutes: m,
          seconds: sec,
        },
        null,
        2
      )
    );
  };

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Clock className="h-4 w-4 text-muted-foreground" />
        Wait duration
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-1">
          <Label className="text-xs">Days</Label>
          <Input
            type="number"
            min={0}
            value={days}
            onChange={(e) => {
              const v = Math.max(0, parseInt(e.target.value, 10) || 0);
              setDays(v);
              emit(v, hours, minutes, seconds);
            }}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Hours</Label>
          <Input
            type="number"
            min={0}
            value={hours}
            onChange={(e) => {
              const v = Math.max(0, parseInt(e.target.value, 10) || 0);
              setHours(v);
              emit(days, v, minutes, seconds);
            }}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Minutes</Label>
          <Input
            type="number"
            min={0}
            value={minutes}
            onChange={(e) => {
              const v = Math.max(0, parseInt(e.target.value, 10) || 0);
              setMinutes(v);
              emit(days, hours, v, seconds);
            }}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Seconds</Label>
          <Input
            type="number"
            min={0}
            value={seconds}
            onChange={(e) => {
              const v = Math.max(0, parseInt(e.target.value, 10) || 0);
              setSeconds(v);
              emit(days, hours, minutes, v);
            }}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Stack delays between WhatsApp or email steps to build drip-style sequences (same idea as the canvas Delay node).
      </p>
    </div>
  );
}

const FILTER_OPERATORS: { value: string; label: string }[] = [
  { value: "equal", label: "Equal" },
  { value: "not_equal", label: "Not equal" },
  { value: "greater_than", label: "Greater than" },
  { value: "less_than", label: "Less than" },
  { value: "greater_than_or_equal", label: "Greater than or equal" },
  { value: "less_than_or_equal", label: "Less than or equal" },
  { value: "contains", label: "Contains" },
  { value: "does_not_contain", label: "Does not contain" },
];

type FilterRow = { left: string; operator: string; right: string };

function parseFilterConfig(json: string): { description: string; rows: FilterRow[] } {
  try {
    const o = JSON.parse(json || "{}") as Record<string, unknown>;
    const description = typeof o.description === "string" ? o.description : "";
    if (Array.isArray(o.conditions) && o.conditions.length > 0) {
      const rows = (o.conditions as Record<string, unknown>[]).map((c) => ({
        left: String(c?.left ?? ""),
        operator:
          typeof c?.operator === "string" && FILTER_OPERATORS.some((x) => x.value === c.operator)
            ? c.operator
            : "equal",
        right: String(c?.right ?? ""),
      }));
      return { description, rows };
    }
    if (typeof o.expression === "string" && o.expression.trim()) {
      return {
        description,
        rows: [{ left: o.expression, operator: "equal", right: "" }],
      };
    }
    return { description, rows: [{ left: "{{contact.phone}}", operator: "contains", right: "+91" }] };
  } catch {
    return { description: "", rows: [{ left: "", operator: "equal", right: "" }] };
  }
}

function FilterStepFields({ configJson, onUpdate }: { configJson: string; onUpdate: (next: string) => void }) {
  const [description, setDescription] = useState(() => parseFilterConfig(configJson).description);
  const [rows, setRows] = useState<FilterRow[]>(() => parseFilterConfig(configJson).rows);

  useEffect(() => {
    const p = parseFilterConfig(configJson);
    setDescription(p.description);
    setRows(p.rows);
  }, [configJson]);

  const emit = (desc: string, r: FilterRow[]) => {
    onUpdate(
      JSON.stringify(
        {
          mode: "continue_if_match",
          combinator: "AND",
          description: desc,
          conditions: r.map((row) => ({ left: row.left, operator: row.operator, right: row.right })),
        },
        null,
        2
      )
    );
  };

  const updateRow = (i: number, patch: Partial<FilterRow>) => {
    const next = rows.map((row, j) => (j === i ? { ...row, ...patch } : row));
    setRows(next);
    emit(description, next);
  };

  const addRow = () => {
    const next = [...rows, { left: "", operator: "equal", right: "" }];
    setRows(next);
    emit(description, next);
  };

  const removeRow = (i: number) => {
    const next = rows.filter((_, j) => j !== i);
    const safe = next.length ? next : [{ left: "", operator: "equal", right: "" }];
    setRows(safe);
    emit(description, safe);
  };

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <p className="text-sm font-medium">Continue only if all conditions match (AND)</p>
      <p className="text-xs text-muted-foreground">
        First value = field from your contact or trigger (e.g. <code className="text-[11px]">{"{{contact.email}}"}</code>
        ). Second value = what to compare to.
      </p>
      <div className="space-y-2">
        <Label className="text-xs">Note (optional)</Label>
        <Input
          value={description}
          onChange={(e) => {
            const v = e.target.value;
            setDescription(v);
            emit(v, rows);
          }}
          placeholder="e.g. Only leads with a phone number"
        />
      </div>
      <div className="space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="rounded-md border bg-background p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Condition {i + 1}</span>
              {rows.length > 1 ? (
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => removeRow(i)}>
                  Remove
                </Button>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">First value</Label>
              <Input
                value={row.left}
                onChange={(e) => updateRow(i, { left: e.target.value })}
                placeholder="{{contact.phone}}"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Operator</Label>
              <Select value={row.operator} onValueChange={(v) => updateRow(i, { operator: v })}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FILTER_OPERATORS.map((op) => (
                    <SelectItem key={op.value} value={op.value}>
                      {op.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Second value</Label>
              <Input
                value={row.right}
                onChange={(e) => updateRow(i, { right: e.target.value })}
                placeholder="Compare to this text or {{contact.tag}}"
              />
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="w-full" onClick={addRow}>
          <Plus className="h-4 w-4 mr-1" />
          Add condition (AND)
        </Button>
      </div>
      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronDown className="h-3 w-3" />
          Advanced: raw JSON
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <Textarea className="font-mono text-xs min-h-[80px]" value={configJson} readOnly />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function parseRouterConfig(json: string) {
  try {
    const o = JSON.parse(json || "{}") as Record<string, unknown>;
    return {
      branch1Condition: String(o.branch1Condition ?? ""),
      skipStepsIfFalse: Math.max(0, Math.floor(Number(o.skipStepsIfFalse) || 1)),
      branch1Description: String(o.branch1Description ?? ""),
      otherwiseDescription: String(o.otherwiseDescription ?? ""),
    };
  } catch {
    return {
      branch1Condition: "",
      skipStepsIfFalse: 1,
      branch1Description: "",
      otherwiseDescription: "",
    };
  }
}

function RouterStepFields({ configJson, onUpdate }: { configJson: string; onUpdate: (next: string) => void }) {
  const [branch1Condition, setBranch1Condition] = useState(() => parseRouterConfig(configJson).branch1Condition);
  const [skipStepsIfFalse, setSkipStepsIfFalse] = useState(() => parseRouterConfig(configJson).skipStepsIfFalse);
  const [branch1Description, setBranch1Description] = useState(() => parseRouterConfig(configJson).branch1Description);
  const [otherwiseDescription, setOtherwiseDescription] = useState(() => parseRouterConfig(configJson).otherwiseDescription);

  useEffect(() => {
    const p = parseRouterConfig(configJson);
    setBranch1Condition(p.branch1Condition);
    setSkipStepsIfFalse(p.skipStepsIfFalse);
    setBranch1Description(p.branch1Description);
    setOtherwiseDescription(p.otherwiseDescription);
  }, [configJson]);

  const emit = (patch: Partial<ReturnType<typeof parseRouterConfig>>) => {
    const next = {
      branch1Condition: patch.branch1Condition ?? branch1Condition,
      skipStepsIfFalse: patch.skipStepsIfFalse ?? skipStepsIfFalse,
      branch1Description: patch.branch1Description ?? branch1Description,
      otherwiseDescription: patch.otherwiseDescription ?? otherwiseDescription,
    };
    onUpdate(JSON.stringify(next, null, 2));
  };

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <p className="text-sm font-medium">Branch on condition (Router)</p>
      <p className="text-xs text-muted-foreground">
        If the condition is true, the next steps are treated as Branch 1. If false, skip the number of steps below, then continue.
      </p>
      <div className="space-y-1">
        <Label className="text-xs">Condition (true = Branch 1)</Label>
        <Textarea
          className="min-h-[72px] text-sm"
          value={branch1Condition}
          onChange={(e) => {
            const v = e.target.value;
            setBranch1Condition(v);
            emit({ branch1Condition: v });
          }}
          placeholder='e.g. contact.tags?.includes("VIP")'
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Skip how many steps if false?</Label>
        <Input
          type="number"
          min={0}
          value={skipStepsIfFalse}
          onChange={(e) => {
            const v = Math.max(0, parseInt(e.target.value, 10) || 0);
            setSkipStepsIfFalse(v);
            emit({ skipStepsIfFalse: v });
          }}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Branch 1 label (optional)</Label>
        <Input
          value={branch1Description}
          onChange={(e) => {
            const v = e.target.value;
            setBranch1Description(v);
            emit({ branch1Description: v });
          }}
          placeholder="VIP path"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Otherwise label (optional)</Label>
        <Input
          value={otherwiseDescription}
          onChange={(e) => {
            const v = e.target.value;
            setOtherwiseDescription(v);
            emit({ otherwiseDescription: v });
          }}
          placeholder="Standard path after skip"
        />
      </div>
      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronDown className="h-3 w-3" />
          Advanced: raw JSON
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <Textarea className="font-mono text-xs min-h-[80px]" value={configJson} readOnly />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function configHintForStep(appId: string): string {
  switch (appId) {
    case "whatsapp":
      return "Use the fields above; add Delay steps between sends for drips.";
    case "filter":
      return "";
    case "router":
      return "";
    case "http_request":
      return "Headers and body accept JSON. Invalid JSON is saved as plain text where supported.";
    case "delay":
      return "";
    case "google_sheet":
    case "google_calendar":
    case "contact":
    case "google_contacts":
    case "openai":
    case "google_gemini":
    case "calendly":
    case "smtp":
    case "webhook":
    case "date_helper":
    case "math_helper":
    case "text_helper":
    case "datastore":
      return "";
    default:
      return "Edit JSON below for advanced options. Connection IDs come from the Integrations page after you connect an app.";
  }
}

export default function SimpleFlowEditPage() {
  const [, params] = useRoute("/flows/simple/:flowId");
  const [, setLocation] = useLocation();
  const flowId = params?.flowId;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [status, setStatus] = useState<FlowStatus>("draft");
  const [trigger, setTrigger] = useState<LinearFlowTrigger>({ type: "contact.created" });
  const [localSteps, setLocalSteps] = useState<LocalStep[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [actionPickerOpen, setActionPickerOpen] = useState(false);
  const [actionPickerAppId, setActionPickerAppId] = useState<string | null>(null);
  const [actionSearchQuery, setActionSearchQuery] = useState("");
  const [actionPickerReturnToAdd, setActionPickerReturnToAdd] = useState(false);
  const [changeActionStepId, setChangeActionStepId] = useState<string | null>(null);
  const [triggerPickerOpen, setTriggerPickerOpen] = useState(false);
  const [triggerPickerPhase, setTriggerPickerPhase] = useState<"apps" | "contact-events">("apps");
  const [triggerSearchQuery, setTriggerSearchQuery] = useState("");

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const missing = getCatalogAppIdsMissingFromExamplePack();
    if (missing.length) console.warn("[Simple flow] Example pack missing catalog app ids:", missing);
  }, []);

  const { data: flowData, isLoading } = useQuery<AutomationFlowRow | null>({
    queryKey: ["/api/automation-flows", flowId],
    queryFn: async () => {
      if (!flowId) return null;
      const res = await apiRequest("GET", `/api/automation-flows/${flowId}`);
      return res.json();
    },
    enabled: !!flowId,
  });

  useEffect(() => {
    if (!flowData) return;
    setName(flowData.name ?? "");
    setStatus((flowData.status as FlowStatus) || "draft");
    const lf = flowData.linearFlow;
    if (lf && isLinearFlowDefinition(lf)) {
      const v2 = toLinearFlowV2ForEdit(lf);
      setTrigger(parseTriggerFromFlow(v2.trigger));
      if (v2.steps.length > 0) {
        setLocalSteps(stepsToLocal(v2.steps));
      } else {
        setLocalSteps(stepsToLocal(getAllExampleLinearFlowSteps()));
      }
    } else if (flowRowHasCanvasNodes(flowData)) {
      // Canvas-only (e.g. "Add Sample Flows"): do not inject the unrelated full example pack.
      setTrigger({ type: "contact.created" });
      setLocalSteps([]);
    } else {
      setTrigger({ type: "contact.created" });
      setLocalSteps(stepsToLocal(getAllExampleLinearFlowSteps()));
    }
  }, [flowData?.id, flowData?.updatedAt]);

  const saveMutation = useMutation({
    mutationFn: async (body: {
      name: string;
      status: FlowStatus;
      linearFlow: LinearFlowDefinitionV2;
      nodes: unknown[];
      edges: unknown[];
    }) => {
      const res = await apiRequest("PUT", `/api/automation-flows/${flowId}`, body);
      return res.json() as Promise<AutomationFlowRow>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation-flows"] });
      toast({ title: "Saved", description: "Simple and canvas views are now in sync for this flow." });
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const handleSave = useCallback(() => {
    if (!flowId || !name.trim()) {
      toast({ title: "Name required", description: "Enter a flow name before saving.", variant: "destructive" });
      return;
    }
    const parsed = parseSteps(localSteps);
    if (!parsed.ok) {
      toast({ title: "Fix configuration", description: parsed.message, variant: "destructive" });
      return;
    }
    const linearFlow: LinearFlowDefinitionV2 = {
      version: 2,
      trigger,
      steps: parsed.steps,
    };
    const { nodes, edges } = canvasGraphFromLinearFlow(linearFlow, {
      existingNodes: Array.isArray(flowData?.nodes) ? (flowData.nodes as CanvasNodeForSync[]) : undefined,
    });
    saveMutation.mutate({ name: name.trim(), status, linearFlow, nodes, edges });
  }, [flowId, name, status, localSteps, trigger, saveMutation, toast, flowData?.nodes]);

  const addStep = useCallback((appId: string) => {
    const meta = getSimpleFlowApp(appId);
    if (!meta) return;
    const actions = getCanvasActionsForSimpleApp(appId);
    if (actions && actions.length > 0) {
      setAddOpen(false);
      setActionPickerReturnToAdd(true);
      setChangeActionStepId(null);
      setActionPickerAppId(appId);
      setActionSearchQuery("");
      setActionPickerOpen(true);
      return;
    }
    setLocalSteps((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        appId: meta.id,
        actionLabel: meta.defaultActionLabel,
        configJson: defaultConfigJsonForApp(meta.id),
      },
    ]);
    setAddOpen(false);
  }, []);

  const applyCanvasActionSelection = useCallback(
    (actionId: string, actionName: string) => {
      const appId = actionPickerAppId;
      if (!appId) return;
      if (changeActionStepId) {
        setLocalSteps((prev) =>
          prev.map((s) =>
            s.id === changeActionStepId
              ? {
                  ...s,
                  actionLabel: actionName,
                  configJson: mergeConfigWhenChangingAction(appId, actionId, s.configJson),
                }
              : s
          )
        );
      } else {
        setLocalSteps((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            appId,
            actionLabel: actionName,
            configJson: defaultConfigJsonForSimpleAction(appId, actionId),
          },
        ]);
      }
      setActionPickerOpen(false);
      setActionPickerAppId(null);
      setActionSearchQuery("");
      setChangeActionStepId(null);
      setActionPickerReturnToAdd(false);
    },
    [actionPickerAppId, changeActionStepId]
  );

  const openChangeActionPicker = useCallback((step: LocalStep) => {
    const actions = getCanvasActionsForSimpleApp(step.appId);
    if (!actions?.length) return;
    setActionPickerReturnToAdd(false);
    setChangeActionStepId(step.id);
    setActionPickerAppId(step.appId);
    setActionSearchQuery("");
    setActionPickerOpen(true);
  }, []);

  const moveStep = useCallback((index: number, dir: -1 | 1) => {
    setLocalSteps((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  }, []);

  const removeStep = useCallback((id: string) => {
    setLocalSteps((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const updateStep = useCallback((id: string, patch: Partial<Pick<LocalStep, "actionLabel" | "configJson">>) => {
    setLocalSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const examplePackCount = useMemo(() => getAllExampleLinearFlowSteps().length, []);

  const reloadExampleSteps = useCallback(() => {
    setLocalSteps(stepsToLocal(getAllExampleLinearFlowSteps()));
    toast({
      title: "Examples loaded",
      description: `${examplePackCount} steps restored. Set YOUR_* / connectionId values, then Save.`,
    });
  }, [toast, examplePackCount]);

  const dirtyHint = useMemo(() => {
    if (!flowData?.linearFlow && localSteps.length === 0) {
      return "This flow has no simple definition saved yet. Add steps and save.";
    }
    return null;
  }, [flowData?.linearFlow, localSteps.length]);

  const triggerLine = useMemo(() => triggerSummary(trigger), [trigger]);
  const triggerHostLabel = useMemo(
    () => (typeof window !== "undefined" ? window.location.hostname || "this workspace" : "this workspace"),
    []
  );

  if (!flowId) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Missing flow id.</p>
      </div>
    );
  }

  if (isLoading && !flowData) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <div className="text-sm text-muted-foreground">
        <button type="button" className="hover:underline text-left" onClick={() => setLocation("/flows")}>
          Flows
        </button>
        <span> / Simple builder</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-orange-500/15 p-2 text-orange-600 dark:text-orange-400">
            <Workflow className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Simple automation</h1>
            <p className="text-muted-foreground text-sm mt-1 max-w-xl">
              Linear automations: trigger → ordered steps. Saving here updates the canvas graph to match (and saving on
              the canvas updates the simple view). Layout on the canvas is preserved when step ids stay the same.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={reloadExampleSteps}>
            <ListRestart className="h-4 w-4 mr-1" />
            Reset to {examplePackCount} examples
          </Button>
          <Button variant="outline" size="sm" onClick={() => setLocation(`/flows/edit/${flowId}`)}>
            <ExternalLink className="h-4 w-4 mr-1" />
            Advanced editor
          </Button>
          <Button
            className="bg-orange-500 hover:bg-orange-600"
            size="sm"
            onClick={handleSave}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save
          </Button>
        </div>
      </div>

      {dirtyHint && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          {dirtyHint}
        </div>
      )}

      {flowData &&
      flowRowHasCanvasNodes(flowData) &&
      (!flowData.linearFlow || !isLinearFlowDefinition(flowData.linearFlow)) ? (
        <div className="rounded-md border border-violet-200 bg-violet-50 px-3 py-3 text-sm text-violet-950 dark:border-violet-900/50 dark:bg-violet-950/35 dark:text-violet-100">
          <p className="font-medium">Canvas only — not synced yet</p>
          <p className="mt-1.5 text-violet-900/90 dark:text-violet-100/90">
            This flow has a graph but no saved simple definition. Open <span className="font-medium">Advanced editor</span>{" "}
            to see it on the canvas, or add steps here and <span className="font-medium">Save</span> to create both{" "}
            <code className="text-xs">linear_flow</code> and an updated graph so both editors match.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => flowId && setLocation(`/flows/edit/${flowId}`)}
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            Open canvas editor
          </Button>
        </div>
      ) : null}

      <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-950 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100">
        <strong className="font-medium">Testing checklist:</strong> each step lists keys such as{" "}
        <code className="text-xs">connectionId</code>, <code className="text-xs">YOUR_*</code>, tokens, and URLs — replace
        those with your Calendly, Shopify, Google Sheets/Contacts, OpenAI, Gemini, WhatsApp Business, Telegram,
        SMTP, WooCommerce, and Zoom values. <strong className="font-medium">Save</strong> updates both the simple list
        and the canvas graph. Editing on the canvas auto-saves <code className="text-xs">linear_flow</code> too.
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Flow settings</CardTitle>
          <CardDescription>Name and publish state apply to the whole flow record.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sf-name">Name</Label>
            <Input id="sf-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My automation" />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as FlowStatus)}>
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="active">Active</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Trigger</CardTitle>
              <CardDescription>
                Choose an app (e.g. Contact) and the event — same idea as the advanced editor trigger node.
              </CardDescription>
            </div>
            <Badge variant="secondary">Step 0</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <p className="text-sm font-medium">{triggerLine.primary}</p>
              <p className="text-xs text-muted-foreground">
                {triggerLine.secondary ? `${triggerLine.secondary} · ` : null}
                Event that starts this flow.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setTriggerPickerPhase("apps");
                setTriggerSearchQuery("");
                setTriggerPickerOpen(true);
              }}
            >
              Change trigger
            </Button>
          </div>
          {trigger.type === "contact.tag_added" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sf-tag-name">Tag name (optional)</Label>
                <Input
                  id="sf-tag-name"
                  placeholder="e.g. VIP"
                  value={trigger.type === "contact.tag_added" ? (trigger.tagName ?? "") : ""}
                  onChange={(e) =>
                    setTrigger({
                      type: "contact.tag_added",
                      tagName: e.target.value || undefined,
                      tagId: trigger.type === "contact.tag_added" ? trigger.tagId : undefined,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sf-tag-id">Tag id (optional)</Label>
                <Input
                  id="sf-tag-id"
                  placeholder="Internal id if known"
                  value={trigger.type === "contact.tag_added" ? (trigger.tagId ?? "") : ""}
                  onChange={(e) =>
                    setTrigger({
                      type: "contact.tag_added",
                      tagName: trigger.type === "contact.tag_added" ? trigger.tagName : undefined,
                      tagId: e.target.value || undefined,
                    })
                  }
                />
              </div>
            </div>
          )}
          {trigger.type === "drip.sequence_started" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sf-drip-name">Sequence name</Label>
                <Input
                  id="sf-drip-name"
                  placeholder="e.g. Onboarding week 1"
                  value={trigger.type === "drip.sequence_started" ? (trigger.campaignName ?? "") : ""}
                  onChange={(e) =>
                    setTrigger({
                      type: "drip.sequence_started",
                      campaignName: e.target.value || undefined,
                      campaignId: trigger.type === "drip.sequence_started" ? trigger.campaignId : undefined,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sf-drip-id">Sequence / campaign id (optional)</Label>
                <Input
                  id="sf-drip-id"
                  placeholder="For API or executor matching"
                  value={trigger.type === "drip.sequence_started" ? (trigger.campaignId ?? "") : ""}
                  onChange={(e) =>
                    setTrigger({
                      type: "drip.sequence_started",
                      campaignName: trigger.type === "drip.sequence_started" ? trigger.campaignName : undefined,
                      campaignId: e.target.value || undefined,
                    })
                  }
                />
              </div>
            </div>
          )}
          {(trigger.type === "contact.created" || trigger.type === "contact.updated") && (
            <p className="text-xs text-muted-foreground">
              {trigger.type === "contact.created"
                ? "Runs when a new contact is created. Combine with Delay + WhatsApp steps for welcome drips."
                : "Runs when an existing contact is updated. Use later steps or conditions to narrow which updates matter."}
            </p>
          )}
          {trigger.type === "google_calendar.new_event" && (
            <p className="text-xs text-muted-foreground">
              Runs when a new event is created on the connected Google Calendar (configure the trigger connection in the
              advanced editor). Use <code className="text-[10px]">{"{{trigger.*}}"}</code> placeholders that match your
              webhook or executor payload.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Steps</h2>
          <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add step
          </Button>
        </div>

        {localSteps.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm space-y-2">
              <p>No steps yet.</p>
              <p>
                Example drip: <strong>WhatsApp</strong> → <strong>Delay</strong> 2 days → <strong>WhatsApp</strong> →{" "}
                <strong>SMTP</strong>.
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {localSteps.map((step, index) => {
              const meta = getSimpleFlowApp(step.appId);
              const hint = configHintForStep(step.appId);
              const canvasAid = readCanvasActionId(step.configJson);
              const actionMeta = canvasAid ? findCanvasAction(step.appId, canvasAid) : undefined;
              const integrationForm = integrationStepFieldsForApp(step.appId, {
                configJson: step.configJson,
                onUpdate: (next) => updateStep(step.id, { configJson: next }),
                canvasActionId: canvasAid || undefined,
              });
              const canChangeAction = !!getCanvasActionsForSimpleApp(step.appId)?.length;
              return (
                <li key={step.id}>
                  <Card>
                    <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
                      <div className="flex items-center gap-2 min-w-0">
                        {meta?.iconSrc ? (
                          <img src={meta.iconSrc} alt="" className="h-8 w-8 rounded shrink-0 object-contain" />
                        ) : (
                          <div className="h-8 w-8 rounded bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                            {meta?.label?.charAt(0) ?? "?"}
                          </div>
                        )}
                        <div className="min-w-0">
                          <CardTitle className="text-sm font-medium truncate">{meta?.label ?? step.appId}</CardTitle>
                          {actionMeta ? (
                            <Badge variant="secondary" className="mt-1 text-[10px] font-normal">
                              {actionMeta.name}
                            </Badge>
                          ) : null}
                          <CardDescription className="text-xs line-clamp-2 mt-1">{meta?.description}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant="outline">#{index + 1}</Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={index === 0}
                          onClick={() => moveStep(index, -1)}
                          aria-label="Move up"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={index === localSteps.length - 1}
                          onClick={() => moveStep(index, 1)}
                          aria-label="Move down"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => removeStep(step.id)}
                          aria-label="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="space-y-2 flex-1 min-w-[160px]">
                          <Label htmlFor={`label-${step.id}`}>Step label</Label>
                          <Input
                            id={`label-${step.id}`}
                            value={step.actionLabel}
                            onChange={(e) => updateStep(step.id, { actionLabel: e.target.value })}
                          />
                        </div>
                        {canChangeAction ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            onClick={() => openChangeActionPicker(step)}
                          >
                            Change action
                          </Button>
                        ) : null}
                      </div>
                      {step.appId === "delay" ? (
                        integrationForm != null ? (
                          <div className="space-y-2">
                            {integrationForm}
                            {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
                          </div>
                        ) : (
                          <DelayStepFields
                            configJson={step.configJson}
                            onUpdate={(next) => updateStep(step.id, { configJson: next })}
                          />
                        )
                      ) : step.appId === "filter" ? (
                        <FilterStepFields configJson={step.configJson} onUpdate={(next) => updateStep(step.id, { configJson: next })} />
                      ) : step.appId === "router" ? (
                        <RouterStepFields configJson={step.configJson} onUpdate={(next) => updateStep(step.id, { configJson: next })} />
                      ) : integrationForm != null ? (
                        <div className="space-y-2">
                          {integrationForm}
                          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label htmlFor={`cfg-${step.id}`}>Configuration (JSON)</Label>
                          <Textarea
                            id={`cfg-${step.id}`}
                            className="font-mono text-xs min-h-[100px]"
                            value={step.configJson}
                            onChange={(e) => updateStep(step.id, { configJson: e.target.value })}
                            spellCheck={false}
                          />
                          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add step</DialogTitle>
            <DialogDescription>
              Flow control tools match the canvas builder; integrations behave the same as action nodes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {SIMPLE_FLOW_APP_GROUPS.map((group, gi) => (
              <div key={group.title} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {group.ids.map((id) => {
                    const app = getSimpleFlowApp(id);
                    if (!app) return null;
                    return (
                      <button
                        key={app.id}
                        type="button"
                        className="flex gap-3 rounded-lg border p-3 text-left hover:bg-muted/60 transition-colors"
                        onClick={() => addStep(app.id)}
                      >
                        {app.iconSrc ? (
                          <img src={app.iconSrc} alt="" className="h-10 w-10 shrink-0 object-contain" />
                        ) : (
                          <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center text-sm font-medium shrink-0">
                            {app.label.charAt(0)}
                          </div>
                        )}
                        <span>
                          <span className="font-medium text-sm block">{app.label}</span>
                          <span className="text-xs text-muted-foreground line-clamp-2">{app.description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                {gi < SIMPLE_FLOW_APP_GROUPS.length - 1 ? <Separator className="mt-4" /> : null}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={actionPickerOpen}
        onOpenChange={(open) => {
          setActionPickerOpen(open);
          if (!open) {
            setActionSearchQuery("");
            setActionPickerAppId(null);
            setChangeActionStepId(null);
            setActionPickerReturnToAdd(false);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Select action</DialogTitle>
            <DialogDescription>
              Choose an action from {getSimpleFlowApp(actionPickerAppId ?? "")?.label ?? "this app"} (same as the
              advanced canvas editor).
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 flex flex-col gap-3 min-h-0 flex-1">
            <Button
              type="button"
              variant="ghost"
              className="w-fit -ml-2"
              onClick={() => {
                setActionPickerOpen(false);
                setActionPickerAppId(null);
                setChangeActionStepId(null);
                setActionSearchQuery("");
                if (actionPickerReturnToAdd) setAddOpen(true);
                setActionPickerReturnToAdd(false);
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {actionPickerReturnToAdd ? "Back to apps" : "Close"}
            </Button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search actions..."
                value={actionSearchQuery}
                onChange={(e) => setActionSearchQuery(e.target.value)}
              />
            </div>
            <ScrollArea className="h-[min(400px,50vh)] pr-3">
              <div className="space-y-1">
                {(getCanvasActionsForSimpleApp(actionPickerAppId ?? "") ?? [])
                  .filter(
                    (a) =>
                      a.name.toLowerCase().includes(actionSearchQuery.toLowerCase()) ||
                      a.description.toLowerCase().includes(actionSearchQuery.toLowerCase())
                  )
                  .map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      className="flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors hover:bg-muted"
                      onClick={() => applyCanvasActionSelection(action.id, action.name)}
                    >
                      {action.icon ? (
                        <img src={action.icon} alt="" className="mt-0.5 h-8 w-8 shrink-0 object-contain" />
                      ) : (
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted text-xs font-medium">
                          {action.name.charAt(0)}
                        </div>
                      )}
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{action.name}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{action.description}</span>
                      </span>
                    </button>
                  ))}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={triggerPickerOpen}
        onOpenChange={(open) => {
          setTriggerPickerOpen(open);
          if (!open) {
            setTriggerPickerPhase("apps");
            setTriggerSearchQuery("");
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{triggerPickerPhase === "apps" ? "Select trigger source" : "Select trigger"}</DialogTitle>
            <DialogDescription>
              {triggerPickerPhase === "apps"
                ? "Choose which app or entry type starts this automation."
                : `Choose a trigger from Contact (${triggerHostLabel}).`}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-1 flex flex-col gap-3 min-h-0 flex-1">
            {triggerPickerPhase === "contact-events" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => {
                  setTriggerPickerPhase("apps");
                  setTriggerSearchQuery("");
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to apps
              </Button>
            ) : null}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder={triggerPickerPhase === "apps" ? "Search sources..." : "Search triggers..."}
                value={triggerSearchQuery}
                onChange={(e) => setTriggerSearchQuery(e.target.value)}
              />
            </div>
            <ScrollArea className="h-[min(360px,45vh)] pr-3">
              <div className="space-y-1">
                {triggerPickerPhase === "apps"
                  ? SIMPLE_TRIGGER_APP_ROWS.filter(
                      (r) =>
                        r.name.toLowerCase().includes(triggerSearchQuery.trim().toLowerCase()) ||
                        r.description.toLowerCase().includes(triggerSearchQuery.trim().toLowerCase())
                    ).map((row) => (
                      <button
                        key={row.id}
                        type="button"
                        className="flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors hover:bg-muted"
                        onClick={() => {
                          if (row.id === "contact") {
                            setTriggerPickerPhase("contact-events");
                            setTriggerSearchQuery("");
                            return;
                          }
                          if (row.id === "google_calendar") {
                            setTrigger({ type: "google_calendar.new_event" });
                            setTriggerPickerOpen(false);
                            return;
                          }
                          setTrigger({ type: "drip.sequence_started" });
                          setTriggerPickerOpen(false);
                        }}
                      >
                        <div
                          className={
                            row.id === "contact"
                              ? "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-400/20 text-amber-800 dark:text-amber-200"
                              : row.id === "google_calendar"
                                ? "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-sky-500/15 text-sky-800 dark:text-sky-200"
                                : "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-violet-500/15 text-violet-700 dark:text-violet-300"
                          }
                        >
                          {row.id === "contact" ? (
                            <BookUser className="h-5 w-5" />
                          ) : row.id === "google_calendar" ? (
                            <Calendar className="h-5 w-5" />
                          ) : (
                            <Timer className="h-5 w-5" />
                          )}
                        </div>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{row.name}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">{row.description}</span>
                        </span>
                      </button>
                    ))
                  : SIMPLE_CONTACT_TRIGGER_ROWS.filter(
                      (r) =>
                        r.name.toLowerCase().includes(triggerSearchQuery.trim().toLowerCase()) ||
                        r.description.toLowerCase().includes(triggerSearchQuery.trim().toLowerCase())
                    ).map((row) => (
                      <button
                        key={row.pickId}
                        type="button"
                        className="flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors hover:bg-muted"
                        onClick={() => {
                          setTrigger(linearTriggerFromContactPickId(row.pickId));
                          setTriggerPickerOpen(false);
                        }}
                      >
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-400/20 text-amber-800 dark:text-amber-200">
                          <BookUser className="h-5 w-5" />
                        </div>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{row.name}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">{row.description}</span>
                        </span>
                      </button>
                    ))}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
