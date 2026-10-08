/** Stored in `automation_flows.linear_flow` — independent from canvas nodes/edges. */
export const LINEAR_FLOW_VERSION = 2 as const;
export const LINEAR_FLOW_VERSION_MIN = 1 as const;

/** v1 only had `contact.created`; v2 adds tag + drip-style entry triggers; `contact.updated` aligns with canvas Contact triggers. */
export type LinearFlowTrigger =
  | { type: "contact.created" }
  | { type: "contact.updated" }
  | { type: "contact.tag_added"; tagId?: string; tagName?: string }
  | { type: "drip.sequence_started"; campaignName?: string; campaignId?: string }
  /** Matches canvas Google Calendar trigger node (`new-event`). */
  | { type: "google_calendar.new_event" };

export type LinearFlowStep = {
  id: string;
  appId: string;
  actionLabel: string;
  config: Record<string, unknown>;
};

export type LinearFlowDefinitionV1 = {
  version: 1;
  trigger: { type: "contact.created" };
  steps: LinearFlowStep[];
};

export type LinearFlowDefinitionV2 = {
  version: typeof LINEAR_FLOW_VERSION;
  trigger: LinearFlowTrigger;
  /** When set, this flow starts on any of these entry events (same action chain). Omitted if only `trigger` applies. */
  triggers?: LinearFlowTrigger[];
  steps: LinearFlowStep[];
};

export type LinearFlowDefinition = LinearFlowDefinitionV1 | LinearFlowDefinitionV2;

export function createEmptyLinearFlow(): LinearFlowDefinitionV2 {
  return {
    version: LINEAR_FLOW_VERSION,
    trigger: { type: "contact.created" },
    steps: [],
  };
}

function isTriggerShape(t: unknown): t is LinearFlowTrigger {
  if (!t || typeof t !== "object") return false;
  const ty = (t as Record<string, unknown>).type;
  return (
    ty === "contact.created" ||
    ty === "contact.updated" ||
    ty === "contact.tag_added" ||
    ty === "drip.sequence_started" ||
    ty === "google_calendar.new_event"
  );
}

export function isLinearFlowDefinition(v: unknown): v is LinearFlowDefinition {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  const ver = o.version;
  if (ver !== 1 && ver !== 2) return false;
  if (!isTriggerShape(o.trigger)) return false;
  if (o.triggers !== undefined) {
    if (!Array.isArray(o.triggers)) return false;
    for (const t of o.triggers) {
      if (!isTriggerShape(t)) return false;
    }
  }
  return Array.isArray(o.steps);
}

/** Normalize loaded JSON to a v2 definition for editing (keeps steps, upgrades version + trigger shape). */
export function toLinearFlowV2ForEdit(v: LinearFlowDefinition): LinearFlowDefinitionV2 {
  if (v.version === 2) return v;
  return {
    version: LINEAR_FLOW_VERSION,
    trigger: { type: "contact.created" },
    steps: v.steps,
  };
}

/** Maps a linear trigger to the canvas trigger node’s `selectedTrigger` id (for server-side flow matching). */
export function linearTriggerToCanvasSelectedTrigger(t: LinearFlowTrigger): string | undefined {
  switch (t.type) {
    case "contact.created":
      return "new-contact";
    case "contact.updated":
      return "contact-updated";
    case "contact.tag_added":
    case "drip.sequence_started":
      return "new-contact";
    case "google_calendar.new_event":
      return "new-event";
    default:
      return undefined;
  }
}

export function allLinearTriggersFromDefinition(lf: LinearFlowDefinitionV2): LinearFlowTrigger[] {
  const raw: LinearFlowTrigger[] = [...(lf.triggers ?? []), lf.trigger];
  const seen = new Set<string>();
  const out: LinearFlowTrigger[] = [];
  for (const t of raw) {
    const k = JSON.stringify(t);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

export function allCanvasSelectedTriggersFromLinearFlow(lf: LinearFlowDefinitionV2): string[] {
  const ids = allLinearTriggersFromDefinition(lf)
    .map(linearTriggerToCanvasSelectedTrigger)
    .filter((x): x is string => !!x);
  return [...new Set(ids)];
}
