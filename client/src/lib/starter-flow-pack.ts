/**
 * One-click pack: canvas flows use the same sample graphs as “Add Sample Flows”;
 * simple flows use the full linear example pack (all apps + placeholders) per trigger type.
 */
import { getCanvasSampleGraphByIndex } from "@/lib/dummy-flows";
import { buildFullExampleLinearFlow } from "@/lib/simple-flow-all-examples";

export const STARTER_FLOW_NAME_PREFIX = "[Flow types]";

export type StarterFlowPostBody = {
  name: string;
  status: "draft" | "inactive";
  nodes?: unknown[];
  edges?: unknown[];
  linearFlow?: unknown;
};

export function getStarterFlowPack(): StarterFlowPostBody[] {
  const g0 = getCanvasSampleGraphByIndex(0);
  const g1 = getCanvasSampleGraphByIndex(1);

  return [
    {
      name: `${STARTER_FLOW_NAME_PREFIX} Canvas — example graph 1`,
      status: "draft",
      nodes: g0.nodes,
      edges: g0.edges,
    },
    {
      name: `${STARTER_FLOW_NAME_PREFIX} Canvas — example graph 2`,
      status: "draft",
      nodes: g1.nodes,
      edges: g1.edges,
    },
    {
      name: `${STARTER_FLOW_NAME_PREFIX} Simple — new contact (full examples)`,
      status: "draft",
      nodes: [],
      edges: [],
      linearFlow: buildFullExampleLinearFlow({ type: "contact.created" }),
    },
    {
      name: `${STARTER_FLOW_NAME_PREFIX} Simple — tag added (full examples)`,
      status: "draft",
      nodes: [],
      edges: [],
      linearFlow: buildFullExampleLinearFlow({ type: "contact.tag_added", tagName: "VIP" }),
    },
    {
      name: `${STARTER_FLOW_NAME_PREFIX} Simple — drip sequence (full examples)`,
      status: "draft",
      nodes: [],
      edges: [],
      linearFlow: buildFullExampleLinearFlow({
        type: "drip.sequence_started",
        campaignName: "Welcome series",
      }),
    },
  ];
}

export function getStarterFlowsToCreate(existingNames: Set<string>): StarterFlowPostBody[] {
  return getStarterFlowPack().filter((f) => !existingNames.has(f.name));
}
