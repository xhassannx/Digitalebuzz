import { interpolateTemplate } from "./template-utils";

/**
 * Evaluate Branch 1 condition from router node config.
 * Supports: `{{path}} === 'value'`, `!==`, `contains`, `not_contains`, comparisons, or truthy literal.
 */
export function evaluateRouterCondition(
  condition: string,
  root: Record<string, unknown>
): boolean {
  const c = interpolateTemplate(condition.trim(), root).trim();
  if (!c) return false;

  const notContainsMatch = c.match(/^(.+?)\s+not_contains\s+(.+)$/i);
  if (notContainsMatch) {
    const left = stripQuotes(notContainsMatch[1].trim());
    const right = stripQuotes(notContainsMatch[2].trim());
    return !left.toLowerCase().includes(right.toLowerCase());
  }

  const containsMatch = c.match(/^(.+?)\s+contains\s+(.+)$/i);
  if (containsMatch) {
    const left = stripQuotes(containsMatch[1].trim());
    const right = stripQuotes(containsMatch[2].trim());
    return left.toLowerCase().includes(right.toLowerCase());
  }

  const gtMatch = c.match(/^(.+?)\s*>\s*(.+)$/);
  if (gtMatch) {
    return Number(stripQuotes(gtMatch[1].trim())) > Number(stripQuotes(gtMatch[2].trim()));
  }

  const ltMatch = c.match(/^(.+?)\s*<\s*(.+)$/);
  if (ltMatch) {
    return Number(stripQuotes(ltMatch[1].trim())) < Number(stripQuotes(ltMatch[2].trim()));
  }

  const eqMatch = c.match(/^(.+?)\s*===\s*(.+)$/);
  if (eqMatch) {
    return stripQuotes(eqMatch[1].trim()) === stripQuotes(eqMatch[2].trim());
  }

  const neMatch = c.match(/^(.+?)\s*!==\s*(.+)$/);
  if (neMatch) {
    return stripQuotes(neMatch[1].trim()) !== stripQuotes(neMatch[2].trim());
  }

  const lower = c.toLowerCase();
  if (lower === "true" || lower === "yes" || lower === "1") return true;
  if (lower === "false" || lower === "no" || lower === "0") return false;

  return c.length > 0;
}

function stripQuotes(s: string): string {
  return s.replace(/^['"]|['"]$/g, "");
}

export type FlowEdge = { source: string; target: string; sourceHandle?: string };

type RouterConditionRow = {
  firstValue?: string;
  operator?: string;
  secondValue?: string;
};

type RouterConditionGroup = {
  conditions?: RouterConditionRow[];
};

type RouterBranchRow = {
  id?: string;
  isOtherwise?: boolean;
  orGroups?: RouterConditionGroup[];
};

function evaluateStructuredCondition(
  row: RouterConditionRow,
  root: Record<string, unknown>
): boolean {
  const left = interpolateTemplate(String(row.firstValue ?? "").trim(), root).trim();
  const right = interpolateTemplate(String(row.secondValue ?? "").trim(), root).trim();
  const op = String(row.operator ?? "equal");

  switch (op) {
    case "not_equal":
      return left !== right;
    case "contains":
      return left.toLowerCase().includes(right.toLowerCase());
    case "not_contains":
      return !left.toLowerCase().includes(right.toLowerCase());
    case "greater_than":
      return Number(left) > Number(right);
    case "less_than":
      return Number(left) < Number(right);
    case "equal":
    default:
      return left === right;
  }
}

function evaluateStructuredBranch(
  branch: RouterBranchRow,
  root: Record<string, unknown>
): boolean {
  if (branch.isOtherwise) return true;
  const groups = Array.isArray(branch.orGroups) ? branch.orGroups : [];
  if (!groups.length) return false;
  return groups.some((group) => {
    const conditions = Array.isArray(group.conditions) ? group.conditions : [];
    if (!conditions.length) return false;
    return conditions.every((c) => evaluateStructuredCondition(c, root));
  });
}

function resolveMatchedBranchIds(
  cfg: Record<string, unknown>,
  root: Record<string, unknown>
): string[] {
  const branches = Array.isArray(cfg.branches)
    ? (cfg.branches as RouterBranchRow[])
    : [];
  const executeAll = cfg.executeBranch === "all_match";
  const conditional = branches.filter((b) => !b.isOtherwise);
  const otherwise = branches.find((b) => b.isOtherwise);

  if (conditional.length > 0) {
    const matched: string[] = [];
    for (const branch of conditional) {
      if (evaluateStructuredBranch(branch, root)) {
        if (branch.id) matched.push(branch.id);
        if (!executeAll) return matched;
      }
    }
    if (matched.length > 0) return matched;
    if (otherwise?.id) return [otherwise.id];
    return ["otherwise"];
  }

  const branch1Matches = evaluateRouterCondition(
    String(cfg.branch1Condition || ""),
    root
  );
  return [branch1Matches ? "branch-1" : "otherwise"];
}

/** Pick outgoing edge(s) from a router node based on branch config. */
export function pickRouterEdges(
  edges: FlowEdge[],
  routerNodeId: string,
  cfg: Record<string, unknown>,
  root: Record<string, unknown>
): FlowEdge[] {
  const handles = resolveMatchedBranchIds(cfg, root);
  const out: FlowEdge[] = [];

  for (const handle of handles) {
    const exact = edges.find(
      (e) => e.source === routerNodeId && e.sourceHandle === handle
    );
    if (exact) {
      out.push(exact);
      continue;
    }
    if (handle === "branch-1") {
      const legacy = edges.find(
        (e) => e.source === routerNodeId && !e.sourceHandle
      );
      if (legacy) out.push(legacy);
    }
  }

  if (out.length === 0) {
    const fallback = edges.find(
      (e) => e.source === routerNodeId && e.sourceHandle === "otherwise"
    );
    if (fallback) out.push(fallback);
  }

  return out;
}

/** @deprecated Use pickRouterEdges */
export function pickRouterEdge(
  edges: FlowEdge[],
  routerNodeId: string,
  branch1Matches: boolean
): FlowEdge | undefined {
  const want = branch1Matches ? "branch-1" : "otherwise";
  const exact = edges.find((e) => e.source === routerNodeId && e.sourceHandle === want);
  if (exact) return exact;
  if (branch1Matches) {
    return edges.find((e) => e.source === routerNodeId && !e.sourceHandle);
  }
  return edges.find((e) => e.source === routerNodeId && e.sourceHandle === "otherwise");
}
