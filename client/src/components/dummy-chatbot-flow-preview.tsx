import { useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  type Edge,
  type Node,
  type NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  Clock,
  GitBranch,
  HelpCircle,
  List,
  MessageSquare,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { DummyChatbotFlow } from "@/components/dummy-chatbot-flows";

type PreviewNodeData = {
  nodeType: string;
  customLabel?: string;
  message?: string;
  body?: string;
  headerText?: string;
  footer?: string;
  buttonText?: string;
  buttons?: Array<{ id?: string; text?: string }>;
  sections?: Array<{ title?: string; rows?: Array<{ id?: string; title?: string; description?: string }> }>;
  conditions?: Array<{ firstValue?: string; operator?: string; secondValue?: string }>;
};

function nodeTitle(data: PreviewNodeData): string {
  switch (data.nodeType) {
    case "trigger":
      return "On Message";
    case "send_text":
      return "Send Text Message";
    case "send_button":
      return "Send Button Message";
    case "send_list":
      return "Send List Message";
    case "send_media":
      return "Send Media Message";
    case "send_cta":
      return "Send CTA Message";
    case "send_product":
      return "Send Product Message";
    case "ask_location":
      return "Ask Location";
    case "ask_question":
      return "Ask Question";
    case "update_columns":
      return "Update Columns";
    case "update_tag":
      return "Update Tag";
    case "fetch_contact":
      return "Fetch Contact";
    case "stop_chatbot":
      return "Stop Chatbot";
    case "ai_agent":
      return "AI Agent";
    case "http":
      return "HTTP";
    case "condition":
      return "Condition";
    case "delay":
      return "Delay";
    default:
      return data.nodeType;
  }
}

function PreviewFlowNode({ data }: NodeProps<PreviewNodeData>) {
  const buttons = Array.isArray(data.buttons) ? data.buttons : [];
  const listRows =
    Array.isArray(data.sections)
      ? data.sections.flatMap((section) => (Array.isArray(section?.rows) ? section.rows : []))
      : [];
  const body = (data.body || data.message || "").toString();

  return (
    <div className="w-[280px] rounded-lg border border-[#e5e7eb] bg-white shadow-sm">
      {data.nodeType === "trigger" ? (
        <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !bg-[var(--rh-brand,#047857)]" />
      ) : (
        <>
          <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !bg-[var(--rh-brand,#047857)]" />
          {buttons.length === 0 && listRows.length === 0 && data.nodeType !== "condition" ? (
            <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !bg-[var(--rh-brand,#047857)]" />
          ) : null}
        </>
      )}

      <div
        className={cn(
          "rh-chatbot-node-header flex items-center gap-2 rounded-t-lg border-b px-3 py-2 text-sm font-semibold",
          data.nodeType === "condition"
            ? "bg-emerald-50 text-emerald-800"
            : data.nodeType === "trigger"
              ? "bg-[color-mix(in_srgb,var(--rh-brand,#047857)_10%,white)] text-[#111827]"
              : "bg-[#f8fafc] text-[#111827]",
        )}
      >
        {data.nodeType === "trigger" ? <Zap className="h-4 w-4 text-[var(--rh-brand,#047857)]" /> : null}
        {data.nodeType === "condition" ? <GitBranch className="h-4 w-4" /> : null}
        {data.nodeType === "send_list" ? <List className="h-4 w-4 text-[var(--rh-brand,#047857)]" /> : null}
        {data.nodeType === "ask_question" ? <HelpCircle className="h-4 w-4 text-[var(--rh-brand,#047857)]" /> : null}
        {data.nodeType === "send_text" || data.nodeType === "send_button" ? (
          <MessageSquare className="h-4 w-4 text-[var(--rh-brand,#047857)]" />
        ) : null}
        {nodeTitle(data)}
      </div>

      <div className="space-y-2 px-3 py-3 text-xs text-[#4b5563]">
        {data.headerText ? <p className="font-medium text-[#111827]">{data.headerText}</p> : null}
        {body ? <p className="whitespace-pre-wrap leading-5">{body}</p> : null}
        {data.nodeType === "trigger" ? (
          <p className="text-[#6b7280]">Starts this chatbot when a customer messages.</p>
        ) : null}

        {buttons.map((button) => (
          <div key={button.id || button.text} className="relative">
            <Handle
              type="source"
              position={Position.Right}
              id={`button:${button.id || button.text}`}
              className="!h-2.5 !w-2.5 !bg-[var(--rh-brand,#047857)]"
              style={{ top: "50%", transform: "translate(50%, -50%)" }}
            />
            <div className="rounded-md border border-[#e5e7eb] bg-[#f9fafb] px-2 py-1.5 text-center text-[#111827]">
              {button.text || "Button"}
            </div>
          </div>
        ))}

        {listRows.map((row) => (
          <div key={row.id || row.title} className="relative">
            <Handle
              type="source"
              position={Position.Right}
              id={`list:${row.id || row.title}`}
              className="!h-2.5 !w-2.5 !bg-[var(--rh-brand,#047857)]"
              style={{ top: "50%", transform: "translate(50%, -50%)" }}
            />
            <div className="rounded-md border border-[#e5e7eb] bg-[#f9fafb] px-2 py-1.5">
              <p className="font-medium text-[#111827]">{row.title || "Option"}</p>
              {row.description ? <p className="text-[11px] text-[#6b7280]">{row.description}</p> : null}
            </div>
          </div>
        ))}

        {data.buttonText ? (
          <p className="text-[11px] text-[#6b7280]">List button: {data.buttonText}</p>
        ) : null}
        {data.footer ? <p className="text-[11px] text-[#9ca3af]">{data.footer}</p> : null}

        {data.nodeType === "condition" ? (
          <div className="space-y-1.5">
            {(Array.isArray(data.conditions) ? data.conditions : []).map((condition, index) => (
              <p key={index} className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] text-emerald-800">
                {(condition.firstValue || "value") + " " + (condition.operator || "equals") + " " + (condition.secondValue || "")}
              </p>
            ))}
            <div className="relative pt-1">
              <Handle
                type="source"
                position={Position.Right}
                id="true"
                className="!h-2.5 !w-2.5 !bg-emerald-600"
                style={{ top: 10, transform: "translate(50%, -50%)" }}
              />
              <div className="rounded border bg-muted/30 px-2 py-1 text-center">True</div>
            </div>
            <div className="relative">
              <Handle
                type="source"
                position={Position.Right}
                id="false"
                className="!h-2.5 !w-2.5 !bg-slate-400"
                style={{ top: "50%", transform: "translate(50%, -50%)" }}
              />
              <div className="rounded border bg-muted/30 px-2 py-1 text-center">False</div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const previewNodeTypes = { preview: PreviewFlowNode };

const PALETTE = [
  { group: "Triggers", items: [{ icon: Zap, label: "On Message" }] },
  {
    group: "Message types",
    items: [
      { icon: MessageSquare, label: "Send Text Message" },
      { icon: MessageSquare, label: "Send Button Message" },
      { icon: List, label: "Send List Message" },
    ],
  },
  {
    group: "Actions",
    items: [
      { icon: HelpCircle, label: "Ask Question" },
      { icon: GitBranch, label: "Condition" },
      { icon: Clock, label: "Delay" },
    ],
  },
];

type DummyChatbotFlowPreviewDialogProps = {
  open: boolean;
  flow: DummyChatbotFlow | null;
  onOpenChange: (open: boolean) => void;
  onUseTemplate: () => void;
  usingTemplate?: boolean;
  primaryBtnClass?: string;
};

export function DummyChatbotFlowPreviewDialog({
  open,
  flow,
  onOpenChange,
  onUseTemplate,
  usingTemplate,
  primaryBtnClass,
}: DummyChatbotFlowPreviewDialogProps) {
  const nodes = useMemo<Node<PreviewNodeData>[]>(() => {
    if (!flow) return [];
    return flow.nodes.map((node) => ({
      id: node.id,
      type: "preview",
      position: node.position,
      data: { ...(node.data as PreviewNodeData), nodeType: node.nodeType },
      draggable: false,
      selectable: false,
    }));
  }, [flow]);

  const edges = useMemo<Edge[]>(() => {
    if (!flow) return [];
    const result: Edge[] = [];
    flow.nodes.forEach((node) => {
      node.connections.forEach((connection) => {
        const sourceHandle = connection.fromHandle || undefined;
        const targetHandle = connection.toHandle || undefined;
        result.push({
          id: `e-${connection.from}-${connection.to}-${sourceHandle || ""}-${targetHandle || ""}`,
          source: connection.from,
          target: connection.to,
          sourceHandle,
          targetHandle,
          animated: true,
          style: { stroke: "#67b8c9", strokeDasharray: "6 4" },
        });
      });
    });
    return result;
  }, [flow]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dummy-chatbot-flow-preview-dialog flex h-[min(86vh,860px)] max-h-[86vh] w-[min(96vw,1440px)] max-w-[min(96vw,1440px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(96vw,1440px)] [&>button.absolute]:hidden">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => onOpenChange(false)}
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <DialogTitle className="truncate text-base">{flow?.name || "Flow Preview"}</DialogTitle>
              <DialogDescription className="sr-only">
                Read-only preview of the dummy chatbot flow.
              </DialogDescription>
            </div>
          </div>
          <Button
            type="button"
            className={cn(
              "h-9 shrink-0",
              primaryBtnClass || "bg-[var(--rh-brand,#047857)] text-white hover:bg-[var(--rh-brand-hover,#065f46)]",
            )}
            disabled={usingTemplate}
            onClick={onUseTemplate}
          >
            {usingTemplate ? "Creating..." : "Use Template"}
          </Button>
        </div>

        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-52 shrink-0 overflow-y-auto border-r bg-[#f8fafc] p-3 sm:block">
            {PALETTE.map((group) => (
              <div key={group.group} className="mb-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
                  {group.group}
                </p>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.label}
                        className="flex items-center gap-2 rounded-md border border-[#e5e7eb] bg-white px-2.5 py-2 text-xs text-[#374151]"
                      >
                        <Icon className="h-3.5 w-3.5 text-[#6b7280]" />
                        {item.label}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <p className="px-1 text-[11px] leading-4 text-[#9ca3af]">
              Preview only. Use Template to create this chatbot and edit it in the builder.
            </p>
          </aside>

          <div className="h-full min-h-0 min-w-0 flex-1 bg-[#f3f6f8]">
            {flow ? (
              <ReactFlow
                className="h-full w-full"
                nodes={nodes}
                edges={edges}
                nodeTypes={previewNodeTypes}
                fitView
                fitViewOptions={{ padding: 0.18, minZoom: 0.35, maxZoom: 0.95 }}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                panOnDrag
                zoomOnScroll
                minZoom={0.2}
                maxZoom={1.4}
                proOptions={{ hideAttribution: true }}
                onInit={(instance) => {
                  window.setTimeout(() => {
                    instance.fitView({ padding: 0.18, minZoom: 0.35, maxZoom: 0.95, duration: 200 });
                  }, 120);
                }}
              >
                <Background gap={18} size={1} color="#d7dee5" />
                <Controls showInteractive={false} />
                <MiniMap
                  pannable
                  zoomable
                  className="!bg-white/90"
                  nodeColor={() => "#047857"}
                />
              </ReactFlow>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
