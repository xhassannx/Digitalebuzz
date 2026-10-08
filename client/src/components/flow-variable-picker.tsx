import { useMemo, useState } from "react";
import type { Edge, Node } from "reactflow";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Database, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest } from "@/lib/queryClient";
import {
  buildFlowVariableCatalog,
  getFlowNodeDisplayLabel,
  getSheetTriggerConfig,
  findUpstreamTriggerNodes,
  type FlowVariableItem,
} from "@/lib/flow-variable-catalog";

type FlowVariablePickerProps = {
  nodes: Node[];
  edges: Edge[];
  currentNodeId: string;
  onInsert: (snippet: string) => void;
  /** Shown in the popover header */
  contextLabel?: string;
  className?: string;
};

export function FlowVariablePicker({
  nodes,
  edges,
  currentNodeId,
  onInsert,
  contextLabel = "Insert variable",
  className,
}: FlowVariablePickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedKey, setExpandedKey] = useState<string | null>("trigger");

  const triggerNode = useMemo(() => {
    const triggers = findUpstreamTriggerNodes(nodes, edges, currentNodeId);
    return triggers[0] ?? null;
  }, [nodes, edges, currentNodeId]);

  const sheetTriggerConfig = useMemo(
    () => getSheetTriggerConfig(triggerNode),
    [triggerNode]
  );

  const { data: sheetHeadersData, isLoading: sheetHeadersLoading } = useQuery<{ headers: string[] }>({
    queryKey: [
      "/api/integrations/google-sheets/header-row",
      sheetTriggerConfig?.connectionId,
      sheetTriggerConfig?.spreadsheetId,
      sheetTriggerConfig?.worksheetId,
    ],
    queryFn: async () => {
      const q = new URLSearchParams({
        connectionId: sheetTriggerConfig!.connectionId!,
        spreadsheetId: sheetTriggerConfig!.spreadsheetId!,
      });
      if (sheetTriggerConfig?.worksheetId) {
        q.set("sheetId", sheetTriggerConfig.worksheetId);
      }
      const res = await apiRequest("GET", `/api/integrations/google-sheets/header-row?${q}`);
      return res.json();
    },
    enabled: open && !!sheetTriggerConfig?.connectionId && !!sheetTriggerConfig?.spreadsheetId,
    staleTime: 60_000,
  });

  const catalog = useMemo(
    () =>
      buildFlowVariableCatalog(nodes, edges, currentNodeId, {
        sheetHeaders: sheetHeadersData?.headers,
      }),
    [nodes, edges, currentNodeId, sheetHeadersData?.headers]
  );

  const q = search.trim().toLowerCase();

  const filterItems = (items: FlowVariableItem[]) => {
    if (!q) return items;
    return items.filter(
      (i) =>
        i.label.toLowerCase().includes(q) ||
        i.snippet.toLowerCase().includes(q) ||
        (i.hint || "").toLowerCase().includes(q)
    );
  };

  const handleInsert = (snippet: string) => {
    onInsert(snippet);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={`nodrag nopan h-8 text-xs gap-1.5 ${className || ""}`}
        >
          <Database className="h-3.5 w-3.5" />
          Insert variable
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[340px] p-0 nodrag nopan"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="px-3 py-2 border-b">
          <p className="text-sm font-medium">{contextLabel}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
            Pick from your <strong>trigger</strong> or any <strong>earlier step</strong> in this flow.
            Use dot paths for webhook/Shopify fields, e.g.{" "}
            <code className="text-[10px] bg-muted px-0.5 rounded">{"{{trigger.email}}"}</code>.
          </p>
        </div>
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="pl-8 h-8 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <ScrollArea className="max-h-[min(360px,50vh)]">
          {sheetTriggerConfig && sheetHeadersLoading ? (
            <div className="flex items-center gap-2 px-3 py-4 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading sheet columns…
            </div>
          ) : null}
          <div className="p-1.5 space-y-0.5">
            {/* Trigger groups */}
            {catalog.triggerGroups.map((group) => {
              const items = filterItems(group.items);
              if (items.length === 0) return null;
              const key = `trigger-${group.id}`;
              const expanded = expandedKey === key;
              return (
                <div key={key}>
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/80 text-left text-xs font-medium"
                    onClick={() => setExpandedKey(expanded ? null : key)}
                  >
                    <ChevronRight
                      className={`h-3.5 w-3.5 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
                    />
                    <span className="truncate">{group.title}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">{items.length}</span>
                  </button>
                  {expanded && (
                    <div className="pl-4 pb-1 space-y-0.5">
                      {items.map((item) => (
                        <VariableRow key={item.snippet + item.label} item={item} onPick={handleInsert} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Upstream action steps */}
            {catalog.upstreamSteps.length === 0 ? (
              <p className="text-[11px] text-muted-foreground px-2 py-2">
                No earlier action steps in this path. Add steps between the trigger and this node to use their
                outputs.
              </p>
            ) : (
              catalog.upstreamSteps.map(({ node, variables }) => {
                const items = filterItems(variables);
                if (items.length === 0) return null;
                const key = `step-${node.id}`;
                const expanded = expandedKey === key;
                const label = getFlowNodeDisplayLabel(node);
                return (
                  <div key={key}>
                    <button
                      type="button"
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/80 text-left text-xs font-medium"
                      onClick={() => setExpandedKey(expanded ? null : key)}
                    >
                      <ChevronRight
                        className={`h-3.5 w-3.5 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
                      />
                      <span className="truncate" title={node.id}>
                        {label}
                      </span>
                      <span className="text-[10px] text-muted-foreground ml-auto">{items.length}</span>
                    </button>
                    {expanded && (
                      <div className="pl-4 pb-1 space-y-0.5">
                        <p className="text-[10px] text-muted-foreground px-1 pb-0.5 font-mono truncate">{node.id}</p>
                        {items.map((item) => (
                          <VariableRow key={item.snippet + item.label} item={item} onPick={handleInsert} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function VariableRow({ item, onPick }: { item: FlowVariableItem; onPick: (s: string) => void }) {
  return (
    <button
      type="button"
      className="w-full text-left px-2 py-1.5 rounded-md hover:bg-muted/80"
      onClick={() => onPick(item.snippet)}
    >
      <span className="text-xs block">{item.label}</span>
      <span className="text-[10px] font-mono text-muted-foreground block truncate">{item.snippet}</span>
      {item.hint ? <span className="text-[10px] text-muted-foreground block">{item.hint}</span> : null}
    </button>
  );
}
