export type RouterConditionOperator =
  | "equal"
  | "not_equal"
  | "contains"
  | "not_contains"
  | "greater_than"
  | "less_than";

export type RouterCondition = {
  id: string;
  firstValue: string;
  operator: RouterConditionOperator;
  secondValue: string;
};

export type RouterConditionGroup = {
  id: string;
  conditions: RouterCondition[];
};

export type RouterBranch = {
  id: string;
  name: string;
  isOtherwise?: boolean;
  orGroups?: RouterConditionGroup[];
};

export type RouterExecuteMode = "first_match" | "all_match";

export type RouterConfig = {
  executeBranch: RouterExecuteMode;
  branches: RouterBranch[];
  /** Compiled from Branch 1 for legacy runners / linear sync */
  branch1Condition?: string;
  branch1Description?: string;
  otherwiseDescription?: string;
  skipStepsIfFalse?: number;
};

const OPERATOR_LABELS: Record<RouterConditionOperator, string> = {
  equal: "Equal",
  not_equal: "Not equal",
  contains: "Contains",
  not_contains: "Does not contain",
  greater_than: "Greater than",
  less_than: "Less than",
};

export function routerOperatorLabel(op: RouterConditionOperator): string {
  return OPERATOR_LABELS[op] ?? op;
}

export const ROUTER_OPERATOR_OPTIONS: RouterConditionOperator[] = [
  "equal",
  "not_equal",
  "contains",
  "not_contains",
  "greater_than",
  "less_than",
];

export function newRouterId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function newRouterCondition(): RouterCondition {
  return {
    id: newRouterId("cond"),
    firstValue: "",
    operator: "equal",
    secondValue: "",
  };
}

export function newRouterConditionGroup(): RouterConditionGroup {
  return { id: newRouterId("group"), conditions: [newRouterCondition()] };
}

export function defaultRouterConfig(): RouterConfig {
  return {
    executeBranch: "first_match",
    branches: [
      {
        id: "branch-1",
        name: "Branch 1",
        orGroups: [newRouterConditionGroup()],
      },
      {
        id: "otherwise",
        name: "Otherwise",
        isOtherwise: true,
      },
    ],
    branch1Condition: "",
    skipStepsIfFalse: 1,
  };
}

function escapeConditionLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export function compileRouterCondition(c: RouterCondition): string {
  const left = c.firstValue.trim();
  const right = c.secondValue.trim();
  if (!left && !right) return "";

  switch (c.operator) {
    case "equal":
      return `${left} === '${escapeConditionLiteral(right)}'`;
    case "not_equal":
      return `${left} !== '${escapeConditionLiteral(right)}'`;
    case "contains":
      return `${left} contains ${right.includes(" ") ? `'${escapeConditionLiteral(right)}'` : right}`;
    case "not_contains":
      return `${left} not_contains ${right.includes(" ") ? `'${escapeConditionLiteral(right)}'` : right}`;
    case "greater_than":
      return `${left} > ${right}`;
    case "less_than":
      return `${left} < ${right}`;
    default:
      return left;
  }
}

/** AND within group, OR between groups */
export function compileRouterBranchCondition(branch: RouterBranch): string {
  if (branch.isOtherwise) return "";
  const groups = branch.orGroups ?? [];
  const groupExprs = groups
    .map((g) => {
      const parts = (g.conditions ?? [])
        .map(compileRouterCondition)
        .filter(Boolean);
      if (parts.length === 0) return "";
      if (parts.length === 1) return parts[0];
      return `(${parts.join(" && ")})`;
    })
    .filter(Boolean);
  if (groupExprs.length === 0) return "";
  if (groupExprs.length === 1) return groupExprs[0];
  return groupExprs.map((e) => `(${e})`).join(" || ");
}

export function syncRouterLegacyFields(config: RouterConfig): RouterConfig {
  const branches = config.branches?.length ? config.branches : defaultRouterConfig().branches;
  const firstConditional = branches.find((b) => !b.isOtherwise);
  const branch1Condition = firstConditional
    ? compileRouterBranchCondition(firstConditional)
    : String(config.branch1Condition ?? "");
  const conditionalCount = branches.filter((b) => !b.isOtherwise).length;
  return {
    ...config,
    branches,
    branch1Condition,
    skipStepsIfFalse: Math.max(1, conditionalCount || Number(config.skipStepsIfFalse) || 1),
  };
}

export function parseRouterConfig(raw: unknown): RouterConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return defaultRouterConfig();
  }
  const o = raw as Record<string, unknown>;
  const legacyCondition =
    typeof o.branch1Condition === "string" ? o.branch1Condition : "";

  if (Array.isArray(o.branches) && o.branches.length > 0) {
    const branches = o.branches
      .map((b) => normalizeBranch(b))
      .filter(Boolean) as RouterBranch[];
    const hasOtherwise = branches.some((b) => b.isOtherwise);
    const normalized: RouterConfig = {
      executeBranch: o.executeBranch === "all_match" ? "all_match" : "first_match",
      branches: hasOtherwise
        ? branches
        : [...branches, { id: "otherwise", name: "Otherwise", isOtherwise: true }],
      branch1Condition: legacyCondition,
      branch1Description:
        typeof o.branch1Description === "string" ? o.branch1Description : "",
      otherwiseDescription:
        typeof o.otherwiseDescription === "string" ? o.otherwiseDescription : "",
      skipStepsIfFalse: Math.max(
        0,
        Math.floor(Number(o.skipStepsIfFalse) || 1)
      ),
    };
    return syncRouterLegacyFields(normalized);
  }

  if (legacyCondition.trim()) {
    return syncRouterLegacyFields({
      executeBranch: "first_match",
      branches: [
        {
          id: "branch-1",
          name: "Branch 1",
          orGroups: [
            {
              id: newRouterId("group"),
              conditions: [
                {
                  id: newRouterId("cond"),
                  firstValue: legacyCondition,
                  operator: "equal",
                  secondValue: "",
                },
              ],
            },
          ],
        },
        { id: "otherwise", name: "Otherwise", isOtherwise: true },
      ],
      branch1Condition: legacyCondition,
      branch1Description:
        typeof o.branch1Description === "string" ? o.branch1Description : "",
      otherwiseDescription:
        typeof o.otherwiseDescription === "string" ? o.otherwiseDescription : "",
      skipStepsIfFalse: Math.max(
        0,
        Math.floor(Number(o.skipStepsIfFalse) || 1)
      ),
    });
  }

  return defaultRouterConfig();
}

function normalizeBranch(raw: unknown): RouterBranch | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const b = raw as Record<string, unknown>;
  const id = typeof b.id === "string" && b.id.trim() ? b.id.trim() : newRouterId("branch");
  const name = typeof b.name === "string" && b.name.trim() ? b.name.trim() : id;
  const isOtherwise = b.isOtherwise === true || id === "otherwise";

  if (isOtherwise) {
    return { id: id === "otherwise" ? "otherwise" : id, name, isOtherwise: true };
  }

  const orGroups: RouterConditionGroup[] = [];
  if (Array.isArray(b.orGroups)) {
    for (const g of b.orGroups) {
      if (!g || typeof g !== "object" || Array.isArray(g)) continue;
      const gr = g as Record<string, unknown>;
      const conditions: RouterCondition[] = [];
      if (Array.isArray(gr.conditions)) {
        for (const c of gr.conditions) {
          if (!c || typeof c !== "object" || Array.isArray(c)) continue;
          const cr = c as Record<string, unknown>;
          conditions.push({
            id:
              typeof cr.id === "string" && cr.id.trim()
                ? cr.id.trim()
                : newRouterId("cond"),
            firstValue: typeof cr.firstValue === "string" ? cr.firstValue : "",
            operator: normalizeOperator(cr.operator),
            secondValue: typeof cr.secondValue === "string" ? cr.secondValue : "",
          });
        }
      }
      orGroups.push({
        id:
          typeof gr.id === "string" && gr.id.trim()
            ? gr.id.trim()
            : newRouterId("group"),
        conditions: conditions.length ? conditions : [newRouterCondition()],
      });
    }
  }

  return {
    id,
    name,
    orGroups: orGroups.length ? orGroups : [newRouterConditionGroup()],
  };
}

function normalizeOperator(value: unknown): RouterConditionOperator {
  if (typeof value === "string" && ROUTER_OPERATOR_OPTIONS.includes(value as RouterConditionOperator)) {
    return value as RouterConditionOperator;
  }
  return "equal";
}

export function getRouterBranches(rawConfig: unknown): RouterBranch[] {
  return parseRouterConfig(rawConfig).branches;
}

export function nextRouterBranchId(branches: RouterBranch[]): string {
  const conditional = branches.filter((b) => !b.isOtherwise);
  let n = conditional.length + 1;
  while (branches.some((b) => b.id === `branch-${n}`)) n += 1;
  return `branch-${n}`;
}

export function routerBranchHandleLabel(branchId: string | undefined, branches: RouterBranch[]): string {
  if (!branchId) return "";
  if (branchId === "otherwise") return "Otherwise";
  const match = branches.find((b) => b.id === branchId);
  return match?.name ?? branchId;
}

export function routerBranchEdgeColor(branchId: string | undefined): string {
  if (branchId === "otherwise") return "#ef4444";
  return "#3b82f6";
}
