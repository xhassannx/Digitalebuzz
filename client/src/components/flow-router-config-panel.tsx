import { useEffect, useState } from "react";
import type { Edge, Node } from "reactflow";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Trash2, Plus } from "lucide-react";
import { FlowFieldWithVariables } from "@/components/flow-field-with-variables";
import {
  defaultRouterConfig,
  newRouterCondition,
  newRouterConditionGroup,
  nextRouterBranchId,
  parseRouterConfig,
  ROUTER_OPERATOR_OPTIONS,
  routerOperatorLabel,
  syncRouterLegacyFields,
  type RouterBranch,
  type RouterCondition,
  type RouterConditionGroup,
  type RouterConfig,
  type RouterExecuteMode,
} from "@/lib/router-config";

type FlowRouterConfigPanelProps = {
  nodeId: string;
  nodes: Node[];
  edges: Edge[];
  config: unknown;
  onUpdateConfig: (nodeId: string, config: RouterConfig) => void;
  onAddBranch: (nodeId: string, branchId: string, branchName: string) => void;
  onRemoveBranch: (nodeId: string, branchId: string) => void;
};

export function FlowRouterConfigPanel({
  nodeId,
  nodes,
  edges,
  config,
  onUpdateConfig,
  onAddBranch,
  onRemoveBranch,
}: FlowRouterConfigPanelProps) {
  const [routerConfig, setRouterConfig] = useState<RouterConfig>(() =>
    parseRouterConfig(config)
  );

  useEffect(() => {
    setRouterConfig(parseRouterConfig(config));
  }, [nodeId, config]);

  const emit = (next: RouterConfig) => {
    const synced = syncRouterLegacyFields(next);
    setRouterConfig(synced);
    onUpdateConfig(nodeId, synced);
  };

  const conditionalBranches = routerConfig.branches.filter((b) => !b.isOtherwise);
  const otherwiseBranch =
    routerConfig.branches.find((b) => b.isOtherwise) ??
    ({ id: "otherwise", name: "Otherwise", isOtherwise: true } as RouterBranch);

  const updateBranch = (branchId: string, patch: Partial<RouterBranch>) => {
    emit({
      ...routerConfig,
      branches: routerConfig.branches.map((b) =>
        b.id === branchId ? { ...b, ...patch } : b
      ),
    });
  };

  const updateOrGroup = (
    branchId: string,
    groupId: string,
    patch: Partial<RouterConditionGroup>
  ) => {
    const branch = routerConfig.branches.find((b) => b.id === branchId);
    if (!branch || branch.isOtherwise) return;
    const groups = (branch.orGroups ?? []).map((g) =>
      g.id === groupId ? { ...g, ...patch } : g
    );
    updateBranch(branchId, { orGroups: groups });
  };

  const updateCondition = (
    branchId: string,
    groupId: string,
    conditionId: string,
    patch: Partial<RouterCondition>
  ) => {
    const branch = routerConfig.branches.find((b) => b.id === branchId);
    if (!branch || branch.isOtherwise) return;
    const groups = (branch.orGroups ?? []).map((g) => {
      if (g.id !== groupId) return g;
      return {
        ...g,
        conditions: g.conditions.map((c) =>
          c.id === conditionId ? { ...c, ...patch } : c
        ),
      };
    });
    updateBranch(branchId, { orGroups: groups });
  };

  const addAndCondition = (branchId: string, groupId: string) => {
    const branch = routerConfig.branches.find((b) => b.id === branchId);
    if (!branch || branch.isOtherwise) return;
    const groups = (branch.orGroups ?? []).map((g) =>
      g.id === groupId
        ? { ...g, conditions: [...g.conditions, newRouterCondition()] }
        : g
    );
    updateBranch(branchId, { orGroups: groups });
  };

  const removeCondition = (
    branchId: string,
    groupId: string,
    conditionId: string
  ) => {
    const branch = routerConfig.branches.find((b) => b.id === branchId);
    if (!branch || branch.isOtherwise) return;
    const groups = (branch.orGroups ?? [])
      .map((g) => {
        if (g.id !== groupId) return g;
        const next = g.conditions.filter((c) => c.id !== conditionId);
        return next.length ? { ...g, conditions: next } : null;
      })
      .filter(Boolean) as RouterConditionGroup[];
    updateBranch(branchId, {
      orGroups: groups.length ? groups : [newRouterConditionGroup()],
    });
  };

  const addOrGroup = (branchId: string) => {
    const branch = routerConfig.branches.find((b) => b.id === branchId);
    if (!branch || branch.isOtherwise) return;
    updateBranch(branchId, {
      orGroups: [...(branch.orGroups ?? []), newRouterConditionGroup()],
    });
  };

  const removeOrGroup = (branchId: string, groupId: string) => {
    const branch = routerConfig.branches.find((b) => b.id === branchId);
    if (!branch || branch.isOtherwise) return;
    const groups = (branch.orGroups ?? []).filter((g) => g.id !== groupId);
    updateBranch(branchId, {
      orGroups: groups.length ? groups : [newRouterConditionGroup()],
    });
  };

  const handleAddBranch = () => {
    const branchId = nextRouterBranchId(routerConfig.branches);
    const branchName = `Branch ${conditionalBranches.length + 1}`;
    const next: RouterConfig = syncRouterLegacyFields({
      ...routerConfig,
      branches: [
        ...routerConfig.branches.filter((b) => !b.isOtherwise),
        {
          id: branchId,
          name: branchName,
          orGroups: [newRouterConditionGroup()],
        },
        otherwiseBranch,
      ],
    });
    setRouterConfig(next);
    onUpdateConfig(nodeId, next);
    onAddBranch(nodeId, branchId, branchName);
  };

  const handleRemoveBranch = (branchId: string) => {
    if (conditionalBranches.length <= 1) return;
    const next: RouterConfig = syncRouterLegacyFields({
      ...routerConfig,
      branches: routerConfig.branches.filter((b) => b.id !== branchId),
    });
    setRouterConfig(next);
    onUpdateConfig(nodeId, next);
    onRemoveBranch(nodeId, branchId);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Router</h2>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-gray-600">
          Execute Branch <span className="text-red-500">*</span>
        </Label>
        <Select
          value={routerConfig.executeBranch}
          onValueChange={(value: RouterExecuteMode) =>
            emit({ ...routerConfig, executeBranch: value })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select execution mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="first_match">
              Only the first (left) matching branch
            </SelectItem>
            <SelectItem value="all_match">
              All matching branch from left to right
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Accordion
        type="multiple"
        defaultValue={conditionalBranches.map((b) => b.id)}
        className="space-y-2"
      >
        {conditionalBranches.map((branch, branchIndex) => (
          <AccordionItem
            key={branch.id}
            value={branch.id}
            className="border border-gray-200 rounded-lg bg-white px-3"
          >
            <AccordionTrigger className="py-3 hover:no-underline">
              <div className="flex items-center justify-between w-full pr-2">
                <span className="text-sm font-medium">{branch.name}</span>
                {conditionalBranches.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-600 hover:text-red-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveBranch(branch.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4 space-y-4">
              {(branch.orGroups ?? []).map((group, groupIndex) => (
                <div
                  key={group.id}
                  className="rounded-md border border-gray-100 bg-gray-50/80 p-3 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-gray-500">
                      {groupIndex === 0 ? "Conditions" : "OR Condition Group"}
                    </span>
                    {(branch.orGroups ?? []).length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-red-600"
                        onClick={() => removeOrGroup(branch.id, group.id)}
                      >
                        Remove group
                      </Button>
                    )}
                  </div>

                  {group.conditions.map((condition, condIndex) => (
                    <div
                      key={condition.id}
                      className="space-y-2 rounded border border-gray-200 bg-white p-3"
                    >
                      {condIndex > 0 && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                          AND
                        </span>
                      )}
                      <div className="space-y-2">
                        <FlowFieldWithVariables
                          id={`${branch.id}-${group.id}-${condition.id}-first`}
                          label="First value"
                          value={condition.firstValue}
                          nodes={nodes}
                          edges={edges}
                          currentNodeId={nodeId}
                          contextLabel={`${branch.name} — first value`}
                          onChange={(value) =>
                            updateCondition(branch.id, group.id, condition.id, {
                              firstValue: value,
                            })
                          }
                          placeholder="e.g. {{trigger.body}}"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-gray-600">Operator</Label>
                        <Select
                          value={condition.operator}
                          onValueChange={(value) =>
                            updateCondition(branch.id, group.id, condition.id, {
                              operator: value as RouterCondition["operator"],
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROUTER_OPERATOR_OPTIONS.map((op) => (
                              <SelectItem key={op} value={op}>
                                {routerOperatorLabel(op)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <FlowFieldWithVariables
                          id={`${branch.id}-${group.id}-${condition.id}-second`}
                          label="Second value"
                          value={condition.secondValue}
                          nodes={nodes}
                          edges={edges}
                          currentNodeId={nodeId}
                          contextLabel={`${branch.name} — second value`}
                          onChange={(value) =>
                            updateCondition(branch.id, group.id, condition.id, {
                              secondValue: value,
                            })
                          }
                          placeholder="Value to compare"
                        />
                      </div>
                      <div className="flex justify-end">
                        {group.conditions.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-red-600"
                            onClick={() =>
                              removeCondition(branch.id, group.id, condition.id)
                            }
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => addAndCondition(branch.id, group.id)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      AND
                    </Button>
                    {groupIndex === (branch.orGroups ?? []).length - 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => addOrGroup(branch.id)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        OR
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <div className="rounded-lg border border-dashed border-gray-200 bg-white px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-red-600">{otherwiseBranch.name}</span>
          <span className="text-xs text-gray-500">Fallback when no branch matches</span>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={handleAddBranch}>
          <Plus className="h-4 w-4 mr-1" />
          Branch
        </Button>
      </div>
    </div>
  );
}

export { defaultRouterConfig, parseRouterConfig, syncRouterLegacyFields };
