import type { Edge, Node } from "reactflow";
import {
  defaultRouterConfig,
  parseRouterConfig,
  syncRouterLegacyFields,
  type RouterConfig,
} from "./router-config";

const VERTICAL_OFFSET = 220;
const BRANCH_X_OFFSET = 160;

type PreviousActionData = {
  selectedAction?: string | null;
  selectedActionId?: string | null;
  actionIcon?: string | null;
  config?: unknown;
  isChildOfTrigger?: boolean;
};

function makeActionNode(
  id: string,
  x: number,
  y: number,
  isChildOfTrigger: boolean,
  data?: Partial<PreviousActionData>
): Node {
  const hasPreviousAction =
    Boolean(data?.selectedAction) || Boolean(data?.selectedActionId);
  return {
    id,
    type: "action",
    position: { x, y },
    width: 280,
    height: 120,
    data: {
      selectedAction: hasPreviousAction ? data?.selectedAction ?? null : null,
      actionIcon: hasPreviousAction ? data?.actionIcon ?? null : null,
      selectedActionId: hasPreviousAction ? data?.selectedActionId ?? null : null,
      config: hasPreviousAction && data?.config ? data.config : undefined,
      isChildOfTrigger: data?.isChildOfTrigger ?? isChildOfTrigger,
    },
  };
}

function mkEdge(
  source: string,
  target: string,
  sourceHandle: string
): Edge {
  return {
    id: `edge-${source}-${target}-${sourceHandle}`,
    source,
    target,
    sourceHandle,
    targetHandle: "target",
  };
}

function findLegacyOutgoingEdge(
  routerNodeId: string,
  edges: Edge[]
): Edge | undefined {
  return edges.find(
    (e) =>
      e.source === routerNodeId &&
      (!e.sourceHandle ||
        e.sourceHandle === "source" ||
        (e.sourceHandle !== "otherwise" &&
          !e.sourceHandle.startsWith("branch-")))
  );
}

function isEmptyActionNode(node: Node | undefined): boolean {
  if (!node || node.type !== "action") return false;
  return !node.data?.selectedAction && !node.data?.selectedActionId;
}

/** Connect trigger → router and drop empty placeholder nodes from failed inserts. */
function connectParentToRouterIfNeeded(params: {
  routerNodeId: string;
  nodes: Node[];
  edges: Edge[];
  isChildOfTrigger: boolean;
}): { nodes: Node[]; edges: Edge[] } {
  const { routerNodeId, nodes, edges, isChildOfTrigger } = params;
  if (!isChildOfTrigger) return { nodes, edges };

  const incoming = edges.filter((e) => e.target === routerNodeId);
  if (incoming.length > 0) return { nodes, edges };

  const trigger = nodes.find((n) => n.type === "trigger");
  if (!trigger) return { nodes, edges };

  const triggerOut = edges.filter((e) => e.source === trigger.id);
  const placeholderEdge = triggerOut.find((e) => {
    if (e.target === routerNodeId) return false;
    return isEmptyActionNode(nodes.find((n) => n.id === e.target));
  });

  if (placeholderEdge) {
    const placeholderId = placeholderEdge.target;
    const nextEdges = edges
      .filter((e) => e.source !== placeholderId && e.target !== placeholderId)
      .map((e) =>
        e.id === placeholderEdge.id
          ? {
              ...e,
              id: `edge-${trigger.id}-${routerNodeId}-source`,
              target: routerNodeId,
              sourceHandle: "source",
              targetHandle: "target",
            }
          : e
      );
    return {
      nodes: nodes.filter((n) => n.id !== placeholderId),
      edges: nextEdges,
    };
  }

  if (!triggerOut.some((e) => e.target === routerNodeId)) {
    return {
      nodes,
      edges: [...edges, mkEdge(trigger.id, routerNodeId, "source")],
    };
  }

  return { nodes, edges };
}

function findOrphanActionBelowRouter(
  routerNode: Node,
  nodes: Node[],
  edges: Edge[]
): Node | undefined {
  const incomingTargets = new Set(edges.map((e) => e.target));
  const candidates = nodes.filter(
    (n) =>
      n.id !== routerNode.id &&
      n.type === "action" &&
      !incomingTargets.has(n.id) &&
      n.position.y >= routerNode.position.y + 80 &&
      Math.abs(n.position.x - routerNode.position.x) <= 320
  );
  if (candidates.length === 0) return undefined;
  return candidates.sort(
    (a, b) =>
      Math.abs(a.position.x - routerNode.position.x) -
        Math.abs(b.position.x - routerNode.position.x) ||
      a.position.y - b.position.y
  )[0];
}

/** Ensure a router has Branch 1 + Otherwise child action nodes wired on the canvas. */
export function ensureRouterBranchGraph(params: {
  routerNodeId: string;
  nodes: Node[];
  edges: Edge[];
  isChildOfTrigger: boolean;
  existingConfig?: unknown;
  previousActionData?: PreviousActionData;
}): { nodes: Node[]; edges: Edge[]; config: RouterConfig } {
  const {
    routerNodeId,
    nodes,
    edges,
    isChildOfTrigger,
    existingConfig,
    previousActionData,
  } = params;
  const routerNode = nodes.find((n) => n.id === routerNodeId);
  if (!routerNode) {
    return { nodes, edges, config: defaultRouterConfig() };
  }

  const parsed = parseRouterConfig(existingConfig ?? routerNode.data?.config);
  const config = syncRouterLegacyFields(parsed);

  const connected = connectParentToRouterIfNeeded({
    routerNodeId,
    nodes,
    edges,
    isChildOfTrigger,
  });
  let nextNodes = connected.nodes;
  let nextEdges = connected.edges;

  const outgoing = nextEdges.filter((e) => e.source === routerNodeId);
  const hasBranch1 = outgoing.some((e) => e.sourceHandle === "branch-1");
  const hasOtherwise = outgoing.some((e) => e.sourceHandle === "otherwise");

  if (hasBranch1 && hasOtherwise) {
    return { nodes: nextNodes, edges: nextEdges, config };
  }

  const legacyChildEdge = findLegacyOutgoingEdge(routerNodeId, nextEdges);
  const orphanBelow = !legacyChildEdge
    ? findOrphanActionBelowRouter(routerNode, nextNodes, nextEdges)
    : undefined;

  nextEdges = nextEdges.filter(
    (e) =>
      !(
        e.source === routerNodeId &&
        e.id === legacyChildEdge?.id
      )
  );

  const rx = routerNode.position.x;
  const ry = routerNode.position.y;

  if (!hasBranch1) {
    if (legacyChildEdge) {
      nextEdges.push(
        mkEdge(routerNodeId, legacyChildEdge.target, "branch-1")
      );
    } else if (
      orphanBelow &&
      !(previousActionData?.selectedAction || previousActionData?.selectedActionId)
    ) {
      nextEdges.push(mkEdge(routerNodeId, orphanBelow.id, "branch-1"));
    } else {
      const branch1Id = `action-${Date.now()}-b1-${Math.random().toString(36).slice(2, 6)}`;
      nextNodes.push(
        makeActionNode(
          branch1Id,
          rx - BRANCH_X_OFFSET,
          ry + VERTICAL_OFFSET,
          isChildOfTrigger,
          previousActionData
        )
      );
      nextEdges.push(mkEdge(routerNodeId, branch1Id, "branch-1"));
    }
  }

  if (!hasOtherwise) {
    const otherwiseId = `action-${Date.now()}-ow-${Math.random().toString(36).slice(2, 6)}`;
    nextNodes.push(
      makeActionNode(
        otherwiseId,
        rx + BRANCH_X_OFFSET,
        ry + VERTICAL_OFFSET,
        isChildOfTrigger
      )
    );
    nextEdges.push(mkEdge(routerNodeId, otherwiseId, "otherwise"));
  }

  return { nodes: nextNodes, edges: nextEdges, config };
}

export function addRouterBranchGraph(params: {
  routerNodeId: string;
  branchId: string;
  nodes: Node[];
  edges: Edge[];
  isChildOfTrigger: boolean;
}): { nodes: Node[]; edges: Edge[] } {
  const { routerNodeId, branchId, nodes, edges, isChildOfTrigger } = params;
  const routerNode = nodes.find((n) => n.id === routerNodeId);
  if (!routerNode) return { nodes, edges };

  if (edges.some((e) => e.source === routerNodeId && e.sourceHandle === branchId)) {
    return { nodes, edges };
  }

  const conditionalCount = edges.filter(
    (e) =>
      e.source === routerNodeId &&
      e.sourceHandle &&
      e.sourceHandle.startsWith("branch-") &&
      e.sourceHandle !== "otherwise"
  ).length;

  const branchIndex = conditionalCount;
  const spread =
    conditionalCount <= 1
      ? BRANCH_X_OFFSET
      : (BRANCH_X_OFFSET * 2) / conditionalCount;
  const newNodeId = `action-${Date.now()}-${branchId}`;
  const x = routerNode.position.x - BRANCH_X_OFFSET + branchIndex * spread;

  const newNode = makeActionNode(
    newNodeId,
    x,
    routerNode.position.y + VERTICAL_OFFSET,
    isChildOfTrigger
  );

  return {
    nodes: [...nodes, newNode],
    edges: [...edges, mkEdge(routerNodeId, newNodeId, branchId)],
  };
}

export function removeRouterBranchGraph(params: {
  routerNodeId: string;
  branchId: string;
  nodes: Node[];
  edges: Edge[];
}): { nodes: Node[]; edges: Edge[] } {
  const { routerNodeId, branchId, nodes, edges } = params;
  const branchEdge = edges.find(
    (e) => e.source === routerNodeId && e.sourceHandle === branchId
  );
  if (!branchEdge) return { nodes, edges };

  const orphanId = branchEdge.target;
  const orphanStillUsed = edges.some(
    (e) =>
      e.id !== branchEdge.id &&
      (e.source === orphanId || e.target === orphanId)
  );

  return {
    nodes: orphanStillUsed ? nodes : nodes.filter((n) => n.id !== orphanId),
    edges: edges.filter((e) => e.id !== branchEdge.id),
  };
}

/** Normalize saved edges so they match explicit handle ids on nodes. */
export function normalizeFlowEdges(edges: Edge[], nodes: Node[]): Edge[] {
  return edges.map((edge) => {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);
    let sourceHandle = edge.sourceHandle ?? undefined;
    let targetHandle = edge.targetHandle ?? undefined;

    if (
      sourceNode &&
      (sourceNode.type === "trigger" || sourceNode.type === "action") &&
      !sourceHandle
    ) {
      sourceHandle = "source";
    }
    if (
      targetNode &&
      (targetNode.type === "action" || targetNode.type === "router") &&
      !targetHandle
    ) {
      targetHandle = "target";
    }
    if (sourceNode?.type === "router" && sourceHandle === "source") {
      sourceHandle = "branch-1";
    }

    return {
      ...edge,
      sourceHandle,
      targetHandle,
    };
  });
}
