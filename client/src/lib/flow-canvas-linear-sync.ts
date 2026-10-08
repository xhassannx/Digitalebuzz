/**
 * Keeps automation `nodes`/`edges` (canvas) and `linear_flow` (simple editor) aligned on save.
 */
import {
  LINEAR_FLOW_VERSION,
  allLinearTriggersFromDefinition,
  type LinearFlowDefinition,
  type LinearFlowDefinitionV2,
  type LinearFlowStep,
  type LinearFlowTrigger,
  toLinearFlowV2ForEdit,
} from "@shared/linear-flow";
import { getSimpleFlowApp } from "@/lib/simple-flow-catalog";

export type CanvasNodeForSync = {
  id: string;
  type?: string;
  position?: { x: number; y: number };
  width?: number;
  height?: number;
  data?: Record<string, unknown>;
};

export type CanvasEdgeForSync = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
};

const CANVAS_ACTION_TO_SIMPLE_APP: Record<string, string> = {
  "delay-for": "delay",
  "delay-until": "delay",
  "create-spreadsheet": "google_sheet",
  "create-spreadsheet-row": "google_sheet",
  "create-worksheet": "google_sheet",
  "find-worksheet": "google_sheet",
  "find-row": "google_sheet",
  "update-row": "google_sheet",
  "send-message": "whatsapp",
  "send-template": "whatsapp",
  "send-media": "whatsapp",
  "wait-for-reply": "whatsapp",
  "create-contact": "contact",
  "update-contact": "contact",
  "get-contact": "contact",
  "auto-assign-contact": "contact",
  "add-note": "contact",
  "add-tag": "contact",
  "custom-request-contact": "contact",
  "create-google-contact": "google_contacts",
  "update-google-contact": "google_contacts",
  "custom-request-google-contacts": "google_contacts",
  "create-event": "google_calendar",
  "update-event": "google_calendar",
  "custom-request-calendar": "google_calendar",
  "cancel-event": "calendly",
  "custom-request": "calendly",
  "openai-chat": "openai",
  "openai-generate": "openai",
  "custom-request-openai": "openai",
  "gemini-generate": "google_gemini",
  "gemini-chat": "google_gemini",
  "custom-request-gemini": "google_gemini",
};

/** Canvas utility actions (no selectedActionId) → simple appId */
const CANVAS_ACTION_NAME_TO_SIMPLE_APP: Record<string, string> = {
  delay: "delay",
  filter: "filter",
  "http request": "http_request",
  "date helper": "date_helper",
  "math helper": "math_helper",
  "text helper": "text_helper",
  datastore: "datastore",
  webhook: "webhook",
  smtp: "smtp",
  telegram: "telegram",
  shopify: "shopify",
  woocommerce: "woocommerce",
  "zoom (webhook)": "zoom_webhook",
};

const SIMPLE_APP_TO_CANVAS: Record<
  string,
  { selectedActionId: string; selectedAction: string; actionIcon: string | null }
> = {
  google_sheet: {
    selectedActionId: "create-spreadsheet-row",
    selectedAction: "Create spreadsheet row",
    actionIcon: "/icons/icon_1_spreadsheet_x32.png",
  },
  whatsapp: {
    selectedActionId: "send-message",
    selectedAction: "Send message",
    actionIcon: "/icons/whatsapp.svg",
  },
  google_contacts: {
    selectedActionId: "create-google-contact",
    selectedAction: "Create contact",
    actionIcon: "/icons/google-contact.png",
  },
  google_calendar: {
    selectedActionId: "create-event",
    selectedAction: "Create event",
    actionIcon: "/icons/calendar_31_2x.png",
  },
  calendly: {
    selectedActionId: "cancel-event",
    selectedAction: "Cancel Event",
    actionIcon: "/icons/calendly.svg",
  },
  openai: {
    selectedActionId: "openai-chat",
    selectedAction: "Chat completion",
    actionIcon: "/icons/openai.png",
  },
  google_gemini: {
    selectedActionId: "gemini-generate",
    selectedAction: "Generate content",
    actionIcon: "/icons/gemini.jpg",
  },
};

const DEFAULT_TRIGGER_ID = "trigger-1";

export function sanitizeNodeData(data: Record<string, unknown> | undefined): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  if (!data || typeof data !== "object") return o;
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === "function") continue;
    o[k] = v;
  }
  return o;
}

function isLinearFlowTriggerSnapshot(v: unknown): v is LinearFlowTrigger {
  if (!v || typeof v !== "object") return false;
  const t = (v as Record<string, unknown>).type;
  return (
    t === "contact.created" ||
    t === "contact.updated" ||
    t === "contact.tag_added" ||
    t === "drip.sequence_started" ||
    t === "google_calendar.new_event"
  );
}

function inferLinearTriggerFromCanvasTrigger(triggerNode: CanvasNodeForSync | undefined): LinearFlowTrigger {
  if (!triggerNode || triggerNode.type !== "trigger") return { type: "contact.created" };
  const d = sanitizeNodeData(triggerNode.data);
  if (isLinearFlowTriggerSnapshot(d._linearTriggerSnapshot)) {
    return d._linearTriggerSnapshot;
  }
  const st = d.selectedTrigger;
  if (st === "contact-updated") {
    return { type: "contact.updated" };
  }
  if (st === "new-contact") {
    const cfg = d.config;
    if (cfg && typeof cfg === "object" && !Array.isArray(cfg)) {
      const c = cfg as Record<string, unknown>;
      if (typeof c.linearFlowTagName === "string" && c.linearFlowTagName.trim()) {
        return {
          type: "contact.tag_added",
          tagName: c.linearFlowTagName,
          tagId: typeof c.linearFlowTagId === "string" ? c.linearFlowTagId : undefined,
        };
      }
      if (typeof c.linearFlowDripCampaign === "string" || typeof c.linearFlowDripId === "string") {
        return {
          type: "drip.sequence_started",
          campaignName: typeof c.linearFlowDripCampaign === "string" ? c.linearFlowDripCampaign : undefined,
          campaignId: typeof c.linearFlowDripId === "string" ? c.linearFlowDripId : undefined,
        };
      }
    }
    return { type: "contact.created" };
  }
  if (st === "new-event" && String(d.selectedApp ?? "").trim() === "Google Calendar") {
    return { type: "google_calendar.new_event" };
  }
  return { type: "contact.created" };
}

function bfsOrderActionNodes(
  nodes: CanvasNodeForSync[],
  edges: CanvasEdgeForSync[],
  startId: string
): CanvasNodeForSync[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
  }
  const out: CanvasNodeForSync[] = [];
  const seen = new Set<string>();
  const q: string[] = startId ? [startId] : [];
  while (q.length) {
    const id = q.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = nodeById.get(id);
    if (!node) continue;
    if (node.type !== "trigger") out.push(node);
    for (const next of adj.get(id) ?? []) {
      if (!seen.has(next)) q.push(next);
    }
  }
  return out;
}

function resolveSimpleAppIdFromCanvasNode(data: Record<string, unknown>, nodeType: string): string {
  if (nodeType === "router") return "router";
  const actionId = String(data.selectedActionId ?? "").trim();
  if (actionId === "custom-request" && String(data.actionIcon ?? "").includes("calendly")) {
    return "calendly";
  }
  if (actionId && CANVAS_ACTION_TO_SIMPLE_APP[actionId]) return CANVAS_ACTION_TO_SIMPLE_APP[actionId];
  const name = String(data.selectedAction ?? "").trim().toLowerCase();
  if (name && CANVAS_ACTION_NAME_TO_SIMPLE_APP[name]) return CANVAS_ACTION_NAME_TO_SIMPLE_APP[name];
  if (actionId) return "webhook";
  return "webhook";
}

function canvasNodeToLinearStep(node: CanvasNodeForSync): LinearFlowStep | null {
  const type = node.type || "action";
  if (type === "trigger") return null;
  const data = sanitizeNodeData(node.data);
  const actionId = String(data.selectedActionId ?? "");
  const actionLabel = String(data.selectedAction ?? "Action");
  const rawCfg = data.config;
  const config: Record<string, unknown> =
    rawCfg && typeof rawCfg === "object" && !Array.isArray(rawCfg) ? { ...(rawCfg as Record<string, unknown>) } : {};

  if (type === "router") {
    const branch1Condition =
      typeof config.branch1Condition === "string" ? config.branch1Condition : "";
    const skipStepsIfFalse = Math.max(0, Math.floor(Number(config.skipStepsIfFalse) || 1));
    return {
      id: node.id,
      appId: "router",
      actionLabel: String(data.selectedAction ?? "Router"),
      config: {
        branch1Condition,
        skipStepsIfFalse: skipStepsIfFalse || 1,
        branch1Description:
          typeof config.branch1Description === "string" ? config.branch1Description : "",
        otherwiseDescription:
          typeof config.otherwiseDescription === "string" ? config.otherwiseDescription : "",
      },
    };
  }

  const appId = resolveSimpleAppIdFromCanvasNode(data, type);
  const outCfg = { ...config };
  if (actionId) outCfg._canvasActionId = actionId;

  return {
    id: node.id,
    appId,
    actionLabel,
    config: outCfg,
  };
}

/** Derive `linear_flow` from the current canvas graph (BFS from primary trigger). */
export function linearFlowFromCanvasNodesEdges(
  nodes: CanvasNodeForSync[],
  edges: CanvasEdgeForSync[]
): LinearFlowDefinitionV2 {
  const triggerNodes = nodes.filter((n) => n.type === "trigger");
  const primaryTrigger =
    triggerNodes.find((n) => n.id === DEFAULT_TRIGGER_ID) ?? triggerNodes[0];
  const startId = primaryTrigger?.id ?? "";
  const ordered = bfsOrderActionNodes(nodes, edges, startId);
  const steps: LinearFlowStep[] = [];
  for (const node of ordered) {
    const step = canvasNodeToLinearStep(node);
    if (step) steps.push(step);
  }
  const inferred = triggerNodes.map((n) => inferLinearTriggerFromCanvasTrigger(n));
  const seen = new Set<string>();
  const unique: LinearFlowTrigger[] = [];
  for (const t of inferred) {
    const k = JSON.stringify(t);
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(t);
  }
  const trigger = unique[0] ?? inferLinearTriggerFromCanvasTrigger(primaryTrigger);
  const out: LinearFlowDefinitionV2 = {
    version: LINEAR_FLOW_VERSION,
    trigger,
    steps,
  };
  if (unique.length > 1) {
    out.triggers = unique;
  }
  return out;
}

function canvasTriggerDataFromLinear(t: LinearFlowTrigger): Record<string, unknown> {
  const snapshot: Record<string, unknown> = { _linearTriggerSnapshot: t };
  if (t.type === "contact.created") {
    return {
      ...snapshot,
      selectedApp: "Contact",
      appIcon: null,
      selectedTrigger: "new-contact",
      triggerType: "New Contact",
    };
  }
  if (t.type === "contact.updated") {
    return {
      ...snapshot,
      selectedApp: "Contact",
      appIcon: null,
      selectedTrigger: "contact-updated",
      triggerType: "Contact Updated",
    };
  }
  if (t.type === "contact.tag_added") {
    return {
      ...snapshot,
      selectedApp: "Contact",
      appIcon: null,
      selectedTrigger: "new-contact",
      triggerType: "New Contact",
      config: {
        linearFlowTagName: t.tagName,
        linearFlowTagId: t.tagId,
      },
    };
  }
  if (t.type === "google_calendar.new_event") {
    return {
      ...snapshot,
      selectedApp: "Google Calendar",
      appIcon: "/icons/calendar_31_2x.png",
      selectedTrigger: "new-event",
      triggerType: "New event",
    };
  }
  return {
    ...snapshot,
    selectedApp: "Contact",
    appIcon: null,
    selectedTrigger: "new-contact",
    triggerType: "New Contact",
    config: { linearFlowDripCampaign: t.campaignName, linearFlowDripId: t.campaignId },
  };
}

function cloneConfig(config: Record<string, unknown>): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) {
    if (k.startsWith("_") && k !== "_canvasActionId") continue;
    o[k] = v;
  }
  return o;
}

function linearStepToCanvasActionNode(
  step: LinearFlowStep,
  position: { x: number; y: number }
): CanvasNodeForSync {
  const cfg = cloneConfig(step.config);
  const aid = typeof cfg._canvasActionId === "string" ? cfg._canvasActionId : "";
  delete cfg._canvasActionId;

  const mapped = SIMPLE_APP_TO_CANVAS[step.appId];
  if (mapped) {
    const selectedActionId = aid || mapped.selectedActionId;
    return {
      id: step.id,
      type: "action",
      position,
      width: 280,
      height: 120,
      data: {
        selectedAction: step.actionLabel?.trim() || mapped.selectedAction,
        selectedActionId,
        actionIcon: mapped.actionIcon,
        config: cfg,
      },
    };
  }

  const meta = getSimpleFlowApp(step.appId);
  return {
    id: step.id,
    type: "action",
    position,
    width: 280,
    height: 120,
    data: {
      selectedAction: step.actionLabel?.trim() || meta?.label || step.appId,
      selectedActionId: aid || undefined,
      actionIcon: meta?.iconSrc ?? null,
      config: Object.keys(cfg).length ? cfg : {},
    },
  };
}

function linearStepToCanvasRouterNode(
  step: LinearFlowStep,
  position: { x: number; y: number }
): CanvasNodeForSync {
  const cfg = step.config;
  const branch1Condition =
    typeof cfg.branch1Condition === "string" ? cfg.branch1Condition : "";
  return {
    id: step.id,
    type: "router",
    position,
    width: 280,
    height: 120,
    data: {
      selectedAction: step.actionLabel || "Router",
      routerIcon: "/icons/router.svg",
      selectedActionId: "router",
      config: { branch1Condition },
    },
  };
}

function existingPosition(
  id: string,
  fallback: { x: number; y: number },
  existingById: Map<string, CanvasNodeForSync>
): { x: number; y: number } {
  return existingById.get(id)?.position ?? fallback;
}

/**
 * Build canvas `nodes` + `edges` from a linear definition so the advanced editor matches the simple builder.
 * Router steps use `skipStepsIfFalse` to split branch-1 vs merge (same convention as sample flows).
 */
export function canvasGraphFromLinearFlow(
  linearInput: LinearFlowDefinition,
  options?: { existingNodes?: CanvasNodeForSync[] }
): { nodes: CanvasNodeForSync[]; edges: CanvasEdgeForSync[] } {
  const linear = toLinearFlowV2ForEdit(linearInput);
  const existingById = new Map((options?.existingNodes ?? []).map((n) => [n.id, n]));
  const nodes: CanvasNodeForSync[] = [];
  const edges: CanvasEdgeForSync[] = [];
  let edgeSeq = 0;
  const mkEdge = (
    source: string,
    target: string,
    sourceHandle?: string,
    targetHandle?: string
  ) => {
    const sh = sourceHandle ? `-${sourceHandle}` : "";
    edges.push({
      id: `e-${source}-${target}${sh}-${edgeSeq++}`,
      source,
      target,
      sourceHandle,
      targetHandle,
    });
  };

  const triggerId =
    existingById.size > 0
      ? [...existingById.values()].find((n) => n.type === "trigger")?.id ?? DEFAULT_TRIGGER_ID
      : DEFAULT_TRIGGER_ID;

  const entryTriggers = allLinearTriggersFromDefinition(linear);
  const triggerIds: string[] = [];
  for (let ti = 0; ti < entryTriggers.length; ti++) {
    const tid = ti === 0 ? triggerId : `trigger-par-${ti + 1}`;
    triggerIds.push(tid);
    const tpos =
      ti === 0
        ? existingPosition(tid, { x: 400, y: 100 }, existingById)
        : existingPosition(tid, { x: 400 + ti * 300, y: 100 }, existingById);
    nodes.push({
      id: tid,
      type: "trigger",
      position: tpos,
      width: 280,
      height: 120,
      data: canvasTriggerDataFromLinear(entryTriggers[ti]),
    });
  }

  const steps = linear.steps;
  let i = 0;
  let prevId = triggerIds[0] ?? triggerId;
  let centerY = 280;

  while (i < steps.length) {
    const s = steps[i];
    if (s.appId !== "router") {
      const pos = existingPosition(s.id, { x: 400, y: centerY }, existingById);
      const n = linearStepToCanvasActionNode(s, pos);
      nodes.push(n);
      if (i === 0 && triggerIds.length > 1) {
        for (const tid of triggerIds) {
          mkEdge(tid, n.id);
        }
      } else {
        mkEdge(prevId, n.id);
      }
      prevId = n.id;
      centerY += 180;
      i += 1;
      continue;
    }

    const skipRaw = Number(s.config?.skipStepsIfFalse);
    const skip = Math.max(1, Math.floor(Number.isFinite(skipRaw) ? skipRaw : 1));
    const rPos = existingPosition(s.id, { x: 400, y: centerY }, existingById);
    const routerNode = linearStepToCanvasRouterNode(s, rPos);
    nodes.push(routerNode);
    if (i === 0 && triggerIds.length > 1) {
      for (const tid of triggerIds) {
        mkEdge(tid, routerNode.id);
      }
    } else {
      mkEdge(prevId, routerNode.id);
    }
    centerY += 180;
    i += 1;

    const branchSteps = steps.slice(i, i + skip);
    i += skip;
    const mergeStep = steps[i];

    if (branchSteps.length === 0) {
      if (mergeStep) {
        const pos = existingPosition(mergeStep.id, { x: 400, y: centerY }, existingById);
        const mn = linearStepToCanvasActionNode(mergeStep, pos);
        nodes.push(mn);
        mkEdge(routerNode.id, mn.id, "otherwise", "target");
        prevId = mn.id;
        centerY += 180;
        i += 1;
      } else {
        prevId = routerNode.id;
      }
      continue;
    }

    let branchY = centerY;
    for (let b = 0; b < branchSteps.length; b++) {
      const bs = branchSteps[b];
      const pos = existingPosition(bs.id, { x: 200, y: branchY }, existingById);
      const bn = linearStepToCanvasActionNode(bs, pos);
      nodes.push(bn);
      if (b === 0) {
        mkEdge(routerNode.id, bn.id, "branch-1", "target");
      } else {
        mkEdge(branchSteps[b - 1].id, bn.id);
      }
      branchY += 180;
    }
    const lastBranchId = branchSteps[branchSteps.length - 1].id;

    if (mergeStep) {
      const mPos = existingPosition(mergeStep.id, { x: 600, y: centerY }, existingById);
      const mn = linearStepToCanvasActionNode(mergeStep, mPos);
      nodes.push(mn);
      mkEdge(routerNode.id, mn.id, "otherwise", "target");
      mkEdge(lastBranchId, mn.id);
      prevId = mn.id;
      centerY = mPos.y + 180;
      i += 1;
    } else {
      prevId = lastBranchId;
    }
  }

  return { nodes, edges };
}
