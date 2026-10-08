import React, {
  useState,
  useEffect,
  useRef,
  useContext,
  useMemo,
  useCallback,
  createContext,
} from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  NodeProps,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  EdgeProps,
  useReactFlow,
  ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";
import { Button } from "@/components/ui/button";
import { Input as BaseInput } from "@/components/ui/input";
import { Textarea as BaseTextarea } from "@/components/ui/textarea";

/** Textarea that keeps local state to prevent cursor jump when parent re-renders (e.g. React Flow node updates) */
function StableTextarea({
  value,
  onChange,
  ...props
}: React.ComponentProps<typeof BaseTextarea>) {
  const [local, setLocal] = useState(value ?? "");
  const lastSentRef = useRef(value ?? "");
  useEffect(() => {
    if (value !== lastSentRef.current) {
      lastSentRef.current = value ?? "";
      setLocal(value ?? "");
    }
  }, [value]);
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setLocal(v);
    lastSentRef.current = v;
    onChange?.(e);
  };
  return <BaseTextarea value={local} onChange={handleChange} {...props} />;
}

/** Input that keeps local state to prevent cursor jump when parent re-renders */
function StableInput({
  value,
  onChange,
  ...props
}: React.ComponentProps<typeof BaseInput>) {
  const [local, setLocal] = useState(value ?? "");
  const lastSentRef = useRef(value ?? "");
  useEffect(() => {
    if (value !== lastSentRef.current) {
      lastSentRef.current = value ?? "";
      setLocal(value ?? "");
    }
  }, [value]);
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setLocal(v);
    lastSentRef.current = v;
    onChange?.(e);
  };
  return <BaseInput value={local} onChange={handleChange} {...props} />;
}

/** Make every <Input /> and <Textarea /> in this file stable by default. */
const Input = StableInput;
const Textarea = StableTextarea;

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ArrowLeft,
  Save,
  Zap,
  MessageSquare,
  List,
  Image as ImageIcon,
  Link2,
  HelpCircle,
  Bot,
  Globe,
  X,
  Trash2,
  Copy,
  Pencil,
  Clock,
  GitBranch,
  FileText,
  ShoppingCart,
  MapPin,
  Columns3,
  Tag,
  User,
  Square,
  FileSpreadsheet,
  Database,
  ChevronRight,
  Search,
  AlertTriangle,
  Layers,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { fetchLegacyListApi } from "@/lib/legacy-list-api";
import { toast } from "@/hooks/use-toast";
import { GoogleSheetsResourcePickers } from "@/components/simple-flow/simple-flow-integration-pickers";
import { GoogleSheetsActionExtraFields } from "@/components/integrations/google-sheets-action-extra-fields";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { getAllTimezones } from "@/lib/timezones";
import type { WhatsappSession } from "@shared/schema";

type ChatbotNodeData = {
  nodeType: 'trigger' | 'send_text' | 'send_button' | 'send_list' | 'send_media' | 'send_cta' | 'ask_question' | 'ai_agent' | 'http' | 'delay' | 'condition' | 'send_template' | 'send_product' | 'ask_location' | 'update_columns' | 'update_tag' | 'fetch_contact' | 'stop_chatbot' | 'append_google_sheet';
  [key: string]: any;
};

type ChatbotNode = {
  id: string;
  nodeType: ChatbotNodeData['nodeType'];
  position: { x: number; y: number };
  data: Record<string, any>;
  connections: Array<{ from: string; to: string; fromHandle?: string; toHandle?: string }>;
};

type Chatbot = {
  id: string;
  name: string;
  status: "draft" | "published";
  nodes?: ChatbotNode[];
  createdAt: string;
  updatedAt: string;
};

type TriggerPhoneOption = {
  value: string; // sessionId
  label: string;
  phoneNumberId?: string;
  connectionType: "official" | "unofficial";
};

type AiAssistantOption = { id: string; name: string };

type TemplateOption = {
  id: string;
  name: string;
  language: string;
  templateId?: string;
  status?: string;
  /** From synced Meta template; used to auto-build body parameter fields */
  components?: Array<{ type?: string; text?: string }>;
};

/** Unique {{n}} placeholders in BODY, sorted by n (order expected by WhatsApp API). */
function getOrderedBodyNumericVariables(components: unknown): number[] {
  if (!Array.isArray(components)) return [];
  const bodyComp = components.find((c: any) => String(c?.type || "").toUpperCase() === "BODY");
  const text = bodyComp?.text;
  if (typeof text !== "string") return [];
  const re = /\{\{(\d+)\}\}/g;
  const nums: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = parseInt(m[1], 10);
    if (!Number.isNaN(n)) nums.push(n);
  }
  return [...new Set(nums)].sort((a, b) => a - b);
}

type ContactColumnOption = { id: string; label: string; type?: string; options?: string[] };
type ContactTagOption = { id: string; name: string; color?: string };

export type DataSelectorContext = {
  nodeId: string;
  fieldKey: string;
  contextLabel: string; // e.g. "Send Text Message" for the current form
  onInsert: (snippet: string) => void;
};

type NodeUiContextValue = {
  updateNodeData: (nodeId: string, data: Record<string, any>) => void;
  deleteNode: (nodeId: string) => void;
  duplicateNode: (nodeId: string) => void;
  triggerPhoneOptions: TriggerPhoneOption[];
  aiAssistants: AiAssistantOption[];
  templateOptions: TemplateOption[];
  contactColumns: ContactColumnOption[];
  contactTags: ContactTagOption[];
  saveAll: () => void;
  isSaving: boolean;
  isNodeDirty: (nodeId: string, data: ChatbotNodeData) => boolean;
  cancelNodeEdits: (nodeId: string) => void;
  requestLinkSave: (nextEdges?: Edge[]) => void;
  isLinkSaving: boolean;
  openDataSelector: (ctx: DataSelectorContext) => void;
  closeDataSelector: () => void;
};

// Node type labels and output fields for Data Selector
function getNodeTypeLabel(nodeType: ChatbotNodeData["nodeType"]): string {
  const labels: Record<string, string> = {
    trigger: "On Message",
    send_text: "Send Text Message",
    send_button: "Send Button Message",
    send_list: "Send List Message",
    send_media: "Send Media Message",
    send_cta: "Send CTA Message",
    ask_question: "Ask Question",
    ai_agent: "AI Agent",
    http: "HTTP",
    append_google_sheet: "Append to Google Sheet",
    delay: "Delay",
    condition: "Condition",
    send_template: "Send Template Message",
    send_product: "Send Product Message",
    ask_location: "Ask Location",
    update_columns: "Update Columns",
    update_tag: "Update Tag",
    fetch_contact: "Fetch Contact",
    stop_chatbot: "Stop Chatbot",
  };
  return labels[nodeType] || nodeType;
}

function getNodeOutputFields(nodeType: ChatbotNodeData["nodeType"]): { name: string; type: string }[] {
  const fields: Record<string, { name: string; type: string }[]> = {
    send_text: [{ name: "success", type: "boolean" }, { name: "status", type: "number" }, { name: "message", type: "string" }],
    send_button: [{ name: "success", type: "boolean" }, { name: "status", type: "number" }, { name: "body", type: "string" }],
    send_list: [{ name: "success", type: "boolean" }, { name: "status", type: "number" }, { name: "body", type: "string" }],
    send_media: [{ name: "success", type: "boolean" }, { name: "status", type: "number" }],
    send_cta: [{ name: "success", type: "boolean" }, { name: "status", type: "number" }, { name: "body", type: "string" }],
    ask_question: [{ name: "success", type: "boolean" }, { name: "status", type: "number" }, { name: "answer", type: "string" }, { name: "question", type: "string" }],
    delay: [{ name: "success", type: "boolean" }],
    condition: [{ name: "success", type: "boolean" }, { name: "branch", type: "string" }],
    update_columns: [{ name: "success", type: "boolean" }, { name: "columns", type: "object" }],
    update_tag: [{ name: "success", type: "boolean" }],
    fetch_contact: [{ name: "success", type: "boolean" }, { name: "contact", type: "object" }],
    http: [{ name: "success", type: "boolean" }, { name: "status", type: "number" }, { name: "body", type: "string" }],
    append_google_sheet: [{ name: "success", type: "boolean" }, { name: "error", type: "string" }],
    ai_agent: [{ name: "success", type: "boolean" }, { name: "response", type: "string" }],
    send_template: [{ name: "success", type: "boolean" }, { name: "status", type: "number" }],
    send_product: [{ name: "success", type: "boolean" }],
    ask_location: [{ name: "success", type: "boolean" }, { name: "location", type: "object" }],
    stop_chatbot: [],
    trigger: [
      { name: "message", type: "string" },
      { name: "messageType", type: "string" },
      { name: "buttonReplyTitle", type: "string" },
      { name: "buttonReplyId", type: "string" },
      { name: "listReplyTitle", type: "string" },
      { name: "listReplyId", type: "string" },
      { name: "senderName", type: "string" },
      { name: "senderId", type: "string" },
      { name: "receiverId", type: "string" },
    ],
  };
  return fields[nodeType] || [{ name: "success", type: "boolean" }, { name: "status", type: "number" }];
}

/** Plain-language labels in the Data Selector (non-technical users never see raw field ids alone). */
function fieldLabelForChatbotDataField(nodeType: ChatbotNodeData["nodeType"], fieldName: string): string {
  if (nodeType === "trigger") {
    const m: Record<string, string> = {
      message: "Incoming message (customer reply)",
      messageType: "Message type (text, button, list…)",
      buttonReplyTitle: "Button label they tapped",
      buttonReplyId: "Button ID they tapped",
      listReplyTitle: "List option they chose",
      listReplyId: "List option ID",
      senderName: "Customer name",
      senderId: "Customer phone / WhatsApp ID",
      receiverId: "Business WhatsApp number",
    };
    return m[fieldName] ?? fieldName;
  }
  if (nodeType === "ask_question") {
    if (fieldName === "answer") return "Their answer (this question)";
    if (fieldName === "question") return "Question text";
  }
  if (nodeType === "fetch_contact") {
    if (fieldName === "contact") return "Contact record";
  }
  if (nodeType === "http") {
    if (fieldName === "body") return "HTTP response body";
    if (fieldName === "status") return "HTTP status code";
  }
  if (nodeType === "append_google_sheet") {
    if (fieldName === "success") return "Sheet row saved";
    if (fieldName === "error") return "Error message (if any)";
  }
  return fieldName;
}

function getUpstreamNodeIds(nodes: Node<ChatbotNodeData>[], edges: Edge[], targetNodeId: string): string[] {
  const reverseEdges = new Map<string, string[]>();
  edges.forEach((e) => {
    if (!reverseEdges.has(e.target)) reverseEdges.set(e.target, []);
    reverseEdges.get(e.target)!.push(e.source);
  });
  const visited = new Set<string>();
  const queue = [targetNodeId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const sources = reverseEdges.get(id) || [];
    sources.forEach((s) => queue.push(s));
  }
  visited.delete(targetNodeId);
  return Array.from(visited);
}

const NodeUiContext = createContext<NodeUiContextValue | null>(null);

function useNodeUi() {
  const ctx = useContext(NodeUiContext);
  if (!ctx) throw new Error("useNodeUi must be used within NodeUiContext.Provider");
  return ctx;
}

function buildChatbotNodesFromFlow(nodes: Node<ChatbotNodeData>[], edges: Edge[]): ChatbotNode[] {
  const sortedNodes = [...nodes].sort((a, b) => a.id.localeCompare(b.id));

  return sortedNodes.map((node) => {
    const nodeEdges = edges
      .filter((e) => e.source === node.id)
      .sort((a, b) => {
        const ak = `${a.target}|${a.sourceHandle || ""}|${a.targetHandle || ""}`;
        const bk = `${b.target}|${b.sourceHandle || ""}|${b.targetHandle || ""}`;
        return ak.localeCompare(bk);
      });

    return {
      id: node.id,
      nodeType: node.data.nodeType,
      position: node.position,
      data: node.data,
      connections: nodeEdges.map((e) => ({
        from: e.source,
        to: e.target,
        fromHandle: e.sourceHandle || undefined,
        toHandle: e.targetHandle || undefined,
      })),
    };
  });
}

function buildChatbotSnapshot(input: {
  name: string;
  status: "draft" | "published";
  nodes: Node<ChatbotNodeData>[];
  edges: Edge[];
}): string {
  const chatbotNodes = buildChatbotNodesFromFlow(input.nodes, input.edges);
  return JSON.stringify({
    name: input.name,
    status: input.status,
    nodes: chatbotNodes,
  });
}

function buildGraphSnapshot(nodes: Node<ChatbotNodeData>[], edges: Edge[]): string {
  const nodePart = [...nodes]
    .map((n) => ({ id: n.id, x: n.position?.x ?? 0, y: n.position?.y ?? 0, type: n.data?.nodeType }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const edgePart = [...edges]
    .map((e) => ({
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle || "",
      targetHandle: e.targetHandle || "",
    }))
    .sort((a, b) => `${a.source}|${a.target}|${a.sourceHandle}|${a.targetHandle}`.localeCompare(`${b.source}|${b.target}|${b.sourceHandle}|${b.targetHandle}`));

  return JSON.stringify({ nodePart, edgePart });
}

function buildEdgesSnapshot(edges: Edge[]): string {
  const edgePart = [...edges]
    .map((e) => ({
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle || "",
      targetHandle: e.targetHandle || "",
    }))
    .sort((a, b) => `${a.source}|${a.target}|${a.sourceHandle}|${a.targetHandle}`.localeCompare(`${b.source}|${b.target}|${b.sourceHandle}|${b.targetHandle}`));
  return JSON.stringify(edgePart);
}

type PersistedEdgePart = {
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
};

function getEdgesStorageKey(chatbotId: string) {
  return `chatbot-builder:${chatbotId}:edges`;
}

function readEdgesFromStorage(chatbotId: string): PersistedEdgePart[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getEdgesStorageKey(chatbotId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .map((e: any) => ({
        source: String(e?.source || ""),
        target: String(e?.target || ""),
        sourceHandle: e?.sourceHandle ? String(e.sourceHandle) : "",
        targetHandle: e?.targetHandle ? String(e.targetHandle) : "",
      }))
      .filter((e: PersistedEdgePart) => !!e.source && !!e.target);
  } catch {
    return null;
  }
}

function buildFlowEdgesFromParts(parts: PersistedEdgePart[]): Edge[] {
  return parts.map((p) => {
    const sh = p.sourceHandle || "";
    const th = p.targetHandle || "";
    return {
      id: `e${p.source}-${p.target}-${sh}-${th}`,
      source: p.source,
      target: p.target,
      sourceHandle: sh || undefined,
      targetHandle: th || undefined,
      type: "deletable",
      animated: true,
      zIndex: -1,
    };
  });
}

function repairEdgeHandles(nextEdges: Edge[], nextNodes: Node<ChatbotNodeData>[]): Edge[] {
  const nodeById = new Map(nextNodes.map((n) => [n.id, n] as const));

  return nextEdges.map((e) => {
    const src = nodeById.get(e.source);
    if (src?.data?.nodeType === "send_button") {
      const buttons = Array.isArray((src.data as any)?.buttons) ? ((src.data as any).buttons as any[]) : [];
      const buttonHandles = buttons
        .map((b) => (typeof b?.id === "string" && b.id.length ? `button:${b.id}` : ""))
        .filter(Boolean);
      const valid = [...buttonHandles, "default"];

      if (valid.length > 0) {
        const isValid = e.sourceHandle ? valid.includes(e.sourceHandle) : false;
        if (!isValid) {
          return { ...e, sourceHandle: valid[0] };
        }
      }
    }

    if (src?.data?.nodeType === "send_list") {
      const sections = Array.isArray((src.data as any)?.sections) ? ((src.data as any).sections as any[]) : [];
      const listHandles = sections.flatMap((s: any) =>
        (Array.isArray(s?.rows) ? s.rows : [])
          .filter((r: any) => typeof r?.id === "string" && r.id.length)
          .map((r: any) => `list:${r.id}`)
      );
      const valid = [...listHandles, "default"];
      if (valid.length > 0 && (!e.sourceHandle || !valid.includes(e.sourceHandle))) {
        return { ...e, sourceHandle: valid[0] };
      }
    }

    if (e.targetHandle) {
      return { ...e, targetHandle: undefined };
    }

    return e;
  });
}

// Custom Node Components (inline editors inside nodes)
function InlineNodeHeader({
  icon,
  title,
  defaultLabel,
  nodeId,
  selected,
}: {
  icon: React.ReactNode;
  title: string;
  defaultLabel: string;
  nodeId: string;
  selected: boolean;
}) {
  const { updateNodeData, deleteNode, duplicateNode } = useNodeUi();
  const [editOpen, setEditOpen] = useState(false);
  const [editValue, setEditValue] = useState(title);

  const handleOpenEdit = () => {
    setEditValue(title);
    setEditOpen(true);
  };
  const handleSaveEdit = () => {
    const trimmed = editValue.trim();
    updateNodeData(nodeId, { customLabel: trimmed || undefined });
    setEditOpen(false);
  };

  return (
    <div
      className={`rh-chatbot-node-header flex items-center justify-between gap-2 px-5 py-3.5 bg-card rounded-t-lg border-b ${
        selected ? "border-primary/40" : "border-border"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {icon}
        <span className="font-medium text-sm truncate">{title}</span>
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        <Popover open={editOpen} onOpenChange={setEditOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center"
              title="Edit name"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenEdit();
              }}
            >
              <Pencil className="w-4 h-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" align="start" onClick={(e) => e.stopPropagation()}>
            <Label className="text-sm font-medium">Form name</Label>
            <Input
              className="mt-1 h-9"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder={defaultLabel}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveEdit();
              }}
            />
            <p className="text-xs text-muted-foreground mt-1">Leave empty to use default: {defaultLabel}</p>
            <div className="flex justify-end gap-2 mt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={handleSaveEdit}>
                Save
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        <button
          type="button"
          className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center"
          title="Duplicate"
          onClick={(e) => {
            e.stopPropagation();
            duplicateNode(nodeId);
          }}
        >
          <Copy className="w-4 h-4" />
        </button>
        <button
          type="button"
          className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center"
          title="Delete"
          onClick={(e) => {
            e.stopPropagation();
            deleteNode(nodeId);
          }}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function HTTPNodeEditor({
  nodeId,
  data,
  updateNodeData,
  openDataSelector,
}: {
  nodeId: string;
  data: ChatbotNodeData;
  updateNodeData: (nodeId: string, data: Record<string, any>) => void;
  openDataSelector: (ctx: DataSelectorContext) => void;
}) {
  const headersRaw = data.headers;
  const headersArr = Array.isArray(headersRaw)
    ? headersRaw
    : headersRaw && typeof headersRaw === "object"
      ? Object.entries(headersRaw as Record<string, any>).map(([k, v]) => ({ key: k, value: String(v ?? "") }))
      : [];
  const safeHeaders = headersArr.length ? headersArr : [{ key: "", value: "" }];

  const paramsRaw = data.params;
  const paramsArr = Array.isArray(paramsRaw) ? paramsRaw : [];
  const safeParams = paramsArr.length ? paramsArr : [{ key: "", value: "" }];

  const setHeaders = (next: any[]) => updateNodeData(nodeId, { headers: next });
  const setParams = (next: any[]) => updateNodeData(nodeId, { params: next });

  const [httpTestLoading, setHttpTestLoading] = useState(false);
  const [httpTestResult, setHttpTestResult] = useState<{ status: number; statusText: string; body: string; ok: boolean } | null>(null);

  const hasBodyMethod = ['POST', 'PUT', 'PATCH'].includes((data.method || 'GET').toString().toUpperCase());

  const runHttpTest = async () => {
    const method = (data.method || "GET").toString().toUpperCase();
    const url = (data.url || "").trim();
    if (!url) {
      toast({ title: "URL required", variant: "destructive" });
      return;
    }
    setHttpTestLoading(true);
    setHttpTestResult(null);
    try {
      const headersObj: Record<string, string> = {};
      for (const h of safeHeaders) {
        const k = (h?.key || "").trim();
        if (k) headersObj[k] = (h?.value ?? "").trim();
      }
      const paramsObj: Record<string, string> = {};
      for (const p of safeParams) {
        const k = (p?.key || "").trim();
        if (k) paramsObj[k] = (p?.value ?? "").trim();
      }
      const searchParams = new URLSearchParams(paramsObj);
      const fullUrl = searchParams.toString() ? `${url}${url.includes("?") ? "&" : "?"}${searchParams}` : url;
      const body = (data.body || "").trim();
      const res = await apiRequest("POST", "/api/chatbot/http-test", {
        method,
        url: fullUrl,
        headers: headersObj,
        body: body || undefined,
      });
      const json = await res.json();
      setHttpTestResult({
        status: json.status ?? 0,
        statusText: json.statusText ?? "",
        body: typeof json.body === "string" ? json.body : JSON.stringify(json.body ?? "", null, 2),
        ok: json.ok ?? (json.status >= 200 && json.status < 300),
      });
    } catch (err: any) {
      setHttpTestResult({
        status: 0,
        statusText: err?.message || "Request failed",
        body: err?.message || String(err),
        ok: false,
      });
    } finally {
      setHttpTestLoading(false);
    }
  };

  return (
    <>
      <div>
        <Label className="text-sm font-medium">HTTP Method</Label>
        <Select value={(data.method || "GET").toString().toUpperCase()} onValueChange={(v) => updateNodeData(nodeId, { method: v })}>
          <SelectTrigger className="mt-1 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="GET">GET</SelectItem>
            <SelectItem value="POST">POST</SelectItem>
            <SelectItem value="PUT">PUT</SelectItem>
            <SelectItem value="PATCH">PATCH</SelectItem>
            <SelectItem value="DELETE">DELETE</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm font-medium">URL</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              openDataSelector({
                nodeId,
                fieldKey: "url",
                contextLabel: "HTTP URL",
                onInsert: (snippet) => updateNodeData(nodeId, { url: (data.url || "") + snippet }),
              });
            }}
          >
            <Database className="h-3.5 w-3.5 mr-1" />
            Insert variable
          </Button>
        </div>
        <Input className="mt-1 h-9" value={data.url || ""} onChange={(e) => updateNodeData(nodeId, { url: e.target.value })} placeholder="https://api.example.com/endpoint" />
      </div>

      <Tabs defaultValue="headers" className="w-full">
        <TabsList className={`grid w-full ${hasBodyMethod ? 'grid-cols-4' : 'grid-cols-3'}`}>
          <TabsTrigger value="headers">Headers</TabsTrigger>
          <TabsTrigger value="params">Params</TabsTrigger>
          {hasBodyMethod && <TabsTrigger value="body">Body</TabsTrigger>}
          <TabsTrigger value="test">Test</TabsTrigger>
        </TabsList>
        <TabsContent value="headers" className="space-y-2 mt-2">
          {safeHeaders.map((h: any, idx: number) => (
            <div key={idx} className="rounded-lg border bg-muted/5 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  className="h-9"
                  value={h?.key || ""}
                  onChange={(e) => {
                    const next = [...safeHeaders];
                    next[idx] = { ...(next[idx] || {}), key: e.target.value };
                    setHeaders(next);
                  }}
                  placeholder="Header key"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => {
                    const next = safeHeaders.filter((_x: any, i: number) => i !== idx);
                    setHeaders(next.length ? next : [{ key: "", value: "" }]);
                  }}
                  title="Delete header"
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
              <div className="flex gap-2">
                <Textarea
                  className="min-h-[64px] flex-1"
                  rows={4}
                  value={h?.value || ""}
                  onChange={(e) => {
                    const next = [...safeHeaders];
                    next[idx] = { ...(next[idx] || {}), value: e.target.value };
                    setHeaders(next);
                  }}
                  placeholder="Header value"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    openDataSelector({
                      nodeId,
                      fieldKey: `headers[${idx}].value`,
                      contextLabel: "HTTP Headers",
                      onInsert: (snippet) => {
                        const next = [...safeHeaders];
                        next[idx] = { ...(next[idx] || {}), value: (next[idx]?.value || "") + snippet };
                        setHeaders(next);
                      },
                    });
                  }}
                  title="Insert variable"
                >
                  <Database className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" className="w-full justify-start" onClick={() => setHeaders([...safeHeaders, { key: "", value: "" }])}>
            + Add Header
          </Button>
        </TabsContent>
        <TabsContent value="params" className="space-y-2 mt-2">
          {safeParams.map((p: any, idx: number) => (
            <div key={idx} className="rounded-lg border bg-muted/5 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  className="h-9"
                  value={p?.key || ""}
                  onChange={(e) => {
                    const next = [...safeParams];
                    next[idx] = { ...(next[idx] || {}), key: e.target.value };
                    setParams(next);
                  }}
                  placeholder="Param key"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => {
                    const next = safeParams.filter((_x: any, i: number) => i !== idx);
                    setParams(next.length ? next : [{ key: "", value: "" }]);
                  }}
                  title="Delete param"
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
              <div className="flex gap-2">
                <Input
                  className="h-9 flex-1"
                  value={p?.value || ""}
                  onChange={(e) => {
                    const next = [...safeParams];
                    next[idx] = { ...(next[idx] || {}), value: e.target.value };
                    setParams(next);
                  }}
                  placeholder="Param value"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    openDataSelector({
                      nodeId,
                      fieldKey: `params[${idx}].value`,
                      contextLabel: "HTTP Params",
                      onInsert: (snippet) => {
                        const next = [...safeParams];
                        next[idx] = { ...(next[idx] || {}), value: (next[idx]?.value || "") + snippet };
                        setParams(next);
                      },
                    });
                  }}
                  title="Insert variable"
                >
                  <Database className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" className="w-full justify-start" onClick={() => setParams([...safeParams, { key: "", value: "" }])}>
            + Add Param
          </Button>
        </TabsContent>
        {hasBodyMethod && (
          <TabsContent value="body" className="mt-2">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm font-medium">Body</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  openDataSelector({
                    nodeId,
                    fieldKey: "body",
                    contextLabel: "HTTP Body",
                    onInsert: (snippet) => updateNodeData(nodeId, { body: (data.body || "") + snippet }),
                  });
                }}
              >
                <Database className="h-3.5 w-3.5 mr-1" />
                Insert variable
              </Button>
            </div>
            <Textarea className="mt-1" rows={4} value={data.body || ""} onChange={(e) => updateNodeData(nodeId, { body: e.target.value })} placeholder='{"example":"value"}' />
            <p className="text-xs text-muted-foreground mt-1">
              Tip: For JSON APIs, add <span className="font-medium">Content-Type: application/json</span> in Headers.
            </p>
          </TabsContent>
        )}
        <TabsContent value="test" className="mt-2 space-y-2">
          <Button type="button" variant="outline" className="w-full" onClick={runHttpTest} disabled={httpTestLoading}>
            {httpTestLoading ? "Sending..." : "Test Request"}
          </Button>
          {httpTestResult && (
            <div className="rounded-lg border bg-muted/5 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant={httpTestResult.ok ? "default" : "destructive"}>
                  {httpTestResult.status} {httpTestResult.statusText}
                </Badge>
              </div>
              <Textarea
                className="min-h-[120px] font-mono text-xs"
                readOnly
                value={httpTestResult.body}
                placeholder="Response body"
              />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}

function AppendGoogleSheetNodeEditor({
  nodeId,
  data,
  updateNodeData,
}: {
  nodeId: string;
  data: ChatbotNodeData;
  updateNodeData: (nodeId: string, patch: Record<string, any>) => void;
}) {
  const { openDataSelector, contactColumns = [] } = useNodeUi();

  const contactColumnHints = useMemo(
    () => contactColumns.map((c) => ({ id: c.id, label: c.label || c.id })),
    [contactColumns]
  );

  const configJson = useMemo(
    () =>
      JSON.stringify({
        connectionId: data.connectionId || "",
        driveId: data.driveId || "root",
        spreadsheetId: data.spreadsheetId || "",
        worksheetId: data.worksheetId || "",
        row: typeof data.row === "object" && data.row && !Array.isArray(data.row) ? data.row : {},
      }),
    [data.connectionId, data.driveId, data.spreadsheetId, data.worksheetId, data.row]
  );

  const onConfigJsonUpdate = useCallback(
    (next: string) => {
      try {
        const p = JSON.parse(next) as Record<string, unknown>;
        updateNodeData(nodeId, { ...p });
      } catch {
        /* ignore invalid JSON */
      }
    },
    [nodeId, updateNodeData]
  );

  const sheetConfig = useMemo(() => {
    const row =
      typeof data.row === "object" && data.row && !Array.isArray(data.row) ? (data.row as Record<string, unknown>) : {};
    return {
      row,
      sheetHeaderFields: Array.isArray(data.sheetHeaderFields) ? data.sheetHeaderFields : undefined,
      spreadsheetHeader: data.spreadsheetHeader,
    };
  }, [data.row, data.sheetHeaderFields, data.spreadsheetHeader]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Uses a Google Sheets connection from Integrations. Pick spreadsheet and tab, then map columns. Values support
        chatbot variables (for example {"{{user_input}}"}, {"{{onMessage.senderName}}"}).
      </p>
      <GoogleSheetsResourcePickers configJson={configJson} onUpdate={onConfigJsonUpdate} canvasActionId="create-spreadsheet-row" />
      <GoogleSheetsActionExtraFields
        actionId="create-spreadsheet-row"
        config={sheetConfig}
        applyConfigPatch={(patch) => updateNodeData(nodeId, patch)}
        connectionId={String(data.connectionId || "")}
        spreadsheetId={String(data.spreadsheetId || "")}
        worksheetId={String(data.worksheetId || "")}
        variant="simple"
        columnVariablePicker={{
          nodeId,
          open: (ctx) =>
            openDataSelector({
              nodeId,
              fieldKey: ctx.fieldKey,
              contextLabel: ctx.contextLabel,
              onInsert: ctx.onInsert,
            }),
        }}
        contactColumnHints={contactColumnHints.length ? contactColumnHints : undefined}
      />
    </div>
  );
}

function InlineNodeBody({
  nodeId,
  data,
}: {
  nodeId: string;
  data: ChatbotNodeData;
}) {
  const { updateNodeData, triggerPhoneOptions, aiAssistants = [], templateOptions = [], contactColumns = [], contactTags = [], openDataSelector } = useNodeUi();

  const selectedSendTemplate = useMemo(() => {
    if (data.nodeType !== "send_template") return null;
    return (
      templateOptions.find(
        (t) => t.name === (data.templateName || "") && t.language === (data.templateLanguage || "en")
      ) ?? null
    );
  }, [data.nodeType, data.templateName, data.templateLanguage, templateOptions]);

  useEffect(() => {
    if (data.nodeType !== "send_template") return;
    const slots = getOrderedBodyNumericVariables(selectedSendTemplate?.components);
    const current = Array.isArray(data.templateParams) ? data.templateParams.map((p: any) => String(p ?? "")) : [];
    if (slots.length === 0) {
      if (current.length > 0) {
        updateNodeData(nodeId, { templateParams: [] });
      }
      return;
    }
    const next = slots.map((_, i) => (i < current.length ? current[i] : ""));
    const unchanged =
      next.length === current.length && next.every((v, i) => v === (typeof current[i] === "string" ? current[i] : String(current[i] ?? "")));
    if (!unchanged) {
      updateNodeData(nodeId, { templateParams: next });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-sync param count when template changes only; omit templateParams to avoid resetting on each keystroke
  }, [data.nodeType, selectedSendTemplate, nodeId, updateNodeData]);

  // Spacious form body (reference-style): no scroll, auto height, clear visibility.
  const bodyWrap = "px-5 py-4 space-y-4 nodrag overflow-visible";

  const wrap = (content: React.ReactNode) => <div className={bodyWrap}>{content}</div>;

  // Normalize Send Button buttons to objects with stable ids; WhatsApp allows max 20 chars per button title.
  useEffect(() => {
    if (data.nodeType !== "send_button") return;
    const raw = Array.isArray(data.buttons) ? data.buttons : [];
    const normalized = raw.map((b: any, idx: number) => {
      if (typeof b === "string") return { id: `btn-${idx + 1}`, text: b.slice(0, 20) };
      const text = (typeof b?.text === "string" ? b.text : "").slice(0, 20);
      const id = typeof b?.id === "string" && b.id.length ? b.id : `btn-${idx + 1}`;
      return { ...(b || {}), id, text };
    });

    const rawKey = JSON.stringify(raw);
    const normKey = JSON.stringify(normalized);
    if (rawKey !== normKey) {
      updateNodeData(nodeId, { buttons: normalized });
    }
  }, [data.nodeType, data.buttons, nodeId, updateNodeData]);

  // Normalize Send List rows to objects with stable ids so each row can have its own handle id.
  useEffect(() => {
    if (data.nodeType !== "send_list") return;
    const sections = Array.isArray(data.sections) ? data.sections : [];
    let changed = false;
    const normalized = sections.map((section: any, sectionIdx: number) => {
      const rows = Array.isArray(section?.rows) ? section.rows : [];
      const normRows = rows.map((r: any, idx: number) => {
        const hasId = typeof r?.id === "string" && r.id.length;
        // Stable ids (not Date.now): server adds unique WhatsApp ids per send; handles stay list:<id>
        const id = hasId ? r.id : `row-${sectionIdx}-${idx}`;
        if (!hasId) changed = true;
        return { ...(r || {}), id, title: r?.title ?? "", description: r?.description ?? "" };
      });
      return { ...(section || {}), title: section?.title ?? "", rows: normRows };
    });
    if (changed) {
      updateNodeData(nodeId, { sections: normalized });
    }
  }, [data.nodeType, data.sections, nodeId, updateNodeData]);

  switch (data.nodeType) {
    case "trigger":
      return wrap(
        <>
          <div>
            <Label className="text-sm font-medium">Message Type</Label>
            <Select value={data.messageType || "text"} onValueChange={(v) => updateNodeData(nodeId, { messageType: v })}>
              <SelectTrigger className="mt-2 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="list_reply">List Reply</SelectItem>
                <SelectItem value="button_reply">Button Reply</SelectItem>
                <SelectItem value="template_button_reply">Template Button Reply</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-medium">Keywords</Label>
            <div className="mt-2">
              <KeywordTagsInput
                keywords={Array.isArray(data.keywords) ? data.keywords : []}
                onChange={(keywords) => updateNodeData(nodeId, { keywords })}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {['list_reply', 'button_reply', 'template_button_reply'].includes(data.messageType)
                ? 'Keywords match the selected option text. Leave empty to match any.'
                : 'Separate keywords with commas.'}
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-muted/10 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Enable Fuzzy Matching</p>
              <p className="text-xs text-muted-foreground">Allow partial keyword matches with configurable sensitivity.</p>
            </div>
            <Switch checked={data.fuzzyMatching ?? true} onCheckedChange={(v) => updateNodeData(nodeId, { fuzzyMatching: v })} />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Match Sensitivity</Label>
              <span className="text-xs text-muted-foreground">{Number(data.matchSensitivity ?? 80)}%</span>
            </div>
            <input
              className="mt-2 w-full accent-primary"
              type="range"
              min={0}
              max={100}
              value={Number(data.matchSensitivity ?? 80)}
              onChange={(e) => updateNodeData(nodeId, { matchSensitivity: Number(e.target.value) })}
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Loose</span>
              <span>Exact</span>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">Phone Numbers</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="mt-2 h-9 w-full justify-start text-left font-normal"
                >
                  {(() => {
                    const selectedIds = Array.isArray(data.triggerSessionIds) ? data.triggerSessionIds : (data.triggerSessionId ? [data.triggerSessionId] : []);
                    const validIds = selectedIds.filter((id) => triggerPhoneOptions.some((o) => o.value === id));
                    if (validIds.length === 0) {
                      return "Select Phone Numbers";
                    }
                    if (validIds.length === 1) {
                      const opt = triggerPhoneOptions.find((o) => o.value === validIds[0]);
                      return opt?.label || "1 selected";
                    }
                    return `${validIds.length} phone numbers selected`;
                  })()}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="start">
                <div className="max-h-[300px] overflow-y-auto p-2">
                  {triggerPhoneOptions.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">No connected numbers found</div>
                  ) : (
                    triggerPhoneOptions.map((opt) => {
                      const selectedIds = Array.isArray(data.triggerSessionIds) ? data.triggerSessionIds : (data.triggerSessionId ? [data.triggerSessionId] : []);
                      const isChecked = selectedIds.includes(opt.value);
                      return (
                        <div
                          key={opt.value}
                          className="flex items-center space-x-2 p-2 hover:bg-accent rounded cursor-pointer"
                          onClick={() => {
                            const currentIds = Array.isArray(data.triggerSessionIds) ? data.triggerSessionIds : (data.triggerSessionId ? [data.triggerSessionId] : []);
                            let newIds: string[];
                            if (isChecked) {
                              newIds = currentIds.filter((id) => id !== opt.value);
                            } else {
                              newIds = [...currentIds, opt.value];
                            }
                            // Update both old and new format for backward compatibility
                            const selectedOptions = newIds.map((id) => triggerPhoneOptions.find((o) => o.value === id)).filter(Boolean) as typeof triggerPhoneOptions;
                            updateNodeData(nodeId, {
                              triggerSessionIds: newIds,
                              triggerSessionId: newIds.length === 1 ? newIds[0] : "", // Keep for backward compat
                              triggerPhoneNumberId: selectedOptions.length === 1 ? selectedOptions[0]?.phoneNumberId || "" : "",
                              triggerDisplayPhoneNumber: selectedOptions.map((o) => o.label).join(", "),
                              triggerConnectionType: selectedOptions.length > 0 ? selectedOptions[0]?.connectionType || "" : "",
                            });
                          }}
                        >
                          <Checkbox checked={isChecked} />
                          <Label className="text-sm font-normal cursor-pointer flex-1">{opt.label}</Label>
                        </div>
                      );
                    })
                  )}
                </div>
              </PopoverContent>
            </Popover>
            {(() => {
              const selectedIds = Array.isArray(data.triggerSessionIds) ? data.triggerSessionIds : (data.triggerSessionId ? [data.triggerSessionId] : []);
              const validIds = selectedIds.filter((id) => triggerPhoneOptions.some((o) => o.value === id));
              if (validIds.length > 0) {
                return (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {validIds.map((id) => {
                      const opt = triggerPhoneOptions.find((o) => o.value === id);
                      if (!opt) return null;
                      return (
                        <Badge key={id} variant="secondary" className="text-xs">
                          {opt.label}
                          <button
                            type="button"
                            className="ml-1 hover:text-destructive"
                            onClick={() => {
                              const currentIds = Array.isArray(data.triggerSessionIds) ? data.triggerSessionIds : (data.triggerSessionId ? [data.triggerSessionId] : []);
                              const newIds = currentIds.filter((sid) => sid !== id).filter((sid) => triggerPhoneOptions.some((o) => o.value === sid));
                              const selectedOptions = newIds.map((sid) => triggerPhoneOptions.find((o) => o.value === sid)).filter(Boolean) as typeof triggerPhoneOptions;
                              updateNodeData(nodeId, {
                                triggerSessionIds: newIds,
                                triggerSessionId: newIds.length === 1 ? newIds[0] : "",
                                triggerPhoneNumberId: selectedOptions.length === 1 ? selectedOptions[0]?.phoneNumberId || "" : "",
                                triggerDisplayPhoneNumber: selectedOptions.map((o) => o.label).join(", "),
                                triggerConnectionType: selectedOptions.length > 0 ? selectedOptions[0]?.connectionType || "" : "",
                              });
                            }}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </>
      );

    case "send_text":
      return wrap(
        <>
          <div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm font-medium">Message</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  openDataSelector({
                    nodeId,
                    fieldKey: "message",
                    contextLabel: "Send Text Message",
                    onInsert: (snippet) => updateNodeData(nodeId, { message: (data.message || "") + snippet }),
                  });
                }}
              >
                <Database className="h-3.5 w-3.5 mr-1" />
                Insert variable
              </Button>
            </div>
            <StableTextarea
              className="mt-2 min-h-[120px] resize-y"
              rows={6}
              value={data.message || ""}
              onChange={(e) => updateNodeData(nodeId, { message: e.target.value })}
              placeholder="Enter your message..."
              maxLength={1024}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Only {1024 - ((data.message || "")?.length || 0)}/1024 characters are allowed
            </p>
          </div>
        </>
      );

    case "send_button":
      // Each button has its own source handle on the right (link per button)
      const buttonsRaw = Array.isArray(data.buttons) ? data.buttons : [];
      const buttons = buttonsRaw.map((b: any, idx: number) => {
        if (typeof b === "string") return { id: `btn-${idx + 1}`, text: b };
        return { id: b?.id || `btn-${idx + 1}`, text: b?.text || "" };
      });

      const headerType = (data.headerType || "none").toString().toLowerCase();
      const headerText = (data.headerText || "").toString();
      const headerUrl = (data.headerUrl || "").toString();
      const headerUrlLabel =
        headerType === "video" ? "Video URL" : headerType === "document" ? "Document URL" : "Image URL";

      return wrap(
        <>
          <div>
            <Label className="text-sm font-medium">Header Type</Label>
            <Select
              value={headerType}
              onValueChange={(v) => {
                // Reset irrelevant header fields when switching type
                const nextType = (v || "none").toString().toLowerCase();
                if (nextType === "text") {
                  updateNodeData(nodeId, { headerType: nextType, headerUrl: "" });
                } else if (["image", "video", "document"].includes(nextType)) {
                  updateNodeData(nodeId, { headerType: nextType, headerText: "" });
                } else {
                  updateNodeData(nodeId, { headerType: "none", headerText: "", headerUrl: "" });
                }
              }}
            >
              <SelectTrigger className="mt-2 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="image">Image</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="document">Document</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {headerType === "text" ? (
            <div>
              <Label className="text-sm font-medium">Header Text</Label>
              <Input
                className="mt-1 h-9"
                value={headerText}
                onChange={(e) => updateNodeData(nodeId, { headerText: e.target.value.slice(0, 60) })}
                placeholder="Enter header text"
                maxLength={60}
              />
              <p className="text-xs text-muted-foreground mt-1 text-right">
                {60 - (headerText?.length || 0)} characters left
              </p>
            </div>
          ) : null}

          {["image", "video", "document"].includes(headerType) ? (
            <div>
              <Label className="text-sm font-medium">{headerUrlLabel}</Label>
              <Input
                className="mt-1 h-9"
                value={headerUrl}
                onChange={(e) => updateNodeData(nodeId, { headerUrl: e.target.value })}
                placeholder="https://example.com/file"
              />
            </div>
          ) : null}

          <div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm font-medium">Body Text</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  openDataSelector({
                    nodeId,
                    fieldKey: "body",
                    contextLabel: "Send Button Message",
                    onInsert: (snippet) => updateNodeData(nodeId, { body: (data.body || "") + snippet }),
                  });
                }}
              >
                <Database className="h-3.5 w-3.5 mr-1" />
                Insert variable
              </Button>
            </div>
            <StableTextarea
              className="mt-2 min-h-[120px] resize-y"
              rows={6}
              value={data.body || ""}
              onChange={(e) => updateNodeData(nodeId, { body: e.target.value })}
              placeholder="Enter message body..."
              maxLength={1024}
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">{1024 - ((data.body || "")?.length || 0)} characters left</p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Button Title</Label>
            {buttons.map((btn: any, idx: number) => (
              <div key={btn.id || idx} className="relative flex items-start gap-2 pr-12 overflow-visible">
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`button:${btn.id || idx}`}
                  className="!bg-primary !w-3 !h-3 !z-10"
                  style={{
                    position: "absolute",
                    right: -10,
                    top: "50%",
                    transform: "translate(50%, -50%)",
                  }}
                />
                <div className="flex-1 min-w-0">
                  <StableInput
                    className="h-9 w-full"
                    value={(btn?.text || "").toString().slice(0, 20)}
                    onChange={(e) => {
                      const nextText = e.target.value.slice(0, 20);
                      const current = buttons;
                      const next = current.map((b: any, i: number) => (i === idx ? { ...(b || {}), text: nextText } : b));
                      updateNodeData(nodeId, { buttons: next });
                    }}
                    placeholder={`Button ${idx + 1} title`}
                    maxLength={20}
                  />
                  <p className="text-xs text-muted-foreground mt-1 text-right">
                    {Math.max(0, 20 - ((btn?.text || "").toString().length || 0))} characters left
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => {
                    const current = buttons;
                    const next = current.filter((_b: any, i: number) => i !== idx);
                    updateNodeData(nodeId, { buttons: next });
                  }}
                  title="Delete button"
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={buttons.length >= 3}
              onClick={() => {
                const current = buttons;
                updateNodeData(nodeId, { buttons: [...current, { id: `btn-${Date.now()}`, text: "" }] });
              }}
            >
              + Add Button
            </Button>
            <p className="text-xs text-muted-foreground">Max 3 buttons. Each button title: 20 characters max (WhatsApp limit).</p>
          </div>

          <div>
            <Label className="text-sm font-medium">Footer Text</Label>
            <StableInput
              className="mt-1 h-9"
              value={data.footer || ""}
              onChange={(e) => updateNodeData(nodeId, { footer: e.target.value.slice(0, 60) })}
              placeholder="Enter footer text"
              maxLength={60}
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">{60 - ((data.footer || "")?.length || 0)} characters left</p>
          </div>
        </>
      );

    case "send_list": {
      const headerType = (data.headerType || "none").toString();
      const headerText = (data.headerText || "").toString();
      const sections = Array.isArray(data.sections) ? data.sections : [];
      const safeSections =
        sections.length > 0
          ? sections
          : [
              {
                title: "",
                rows: [{ id: `row-${Date.now()}`, title: "", description: "" }],
              },
            ];

      const setSections = (nextSections: any[]) => updateNodeData(nodeId, { sections: nextSections });

      return wrap(
        <>
          <div className="rounded-md border border-amber-300 bg-amber-50 p-2.5 text-amber-900">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <p className="text-[11px] leading-4">
                Interactive list menus are supported on official WhatsApp Business API sessions.
                On unsupported/unofficial sessions, this node falls back to text and follows the default path.
              </p>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">Header Type</Label>
            <Select value={headerType} onValueChange={(v) => {
              const nextType = (v || "none").toString();
              if (nextType === "text") {
                updateNodeData(nodeId, { headerType: nextType });
              } else {
                updateNodeData(nodeId, { headerType: nextType, headerText: "" });
              }
            }}>
              <SelectTrigger className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="text">Text</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {headerType === "text" ? (
            <div>
              <Label className="text-sm font-medium">Header Text</Label>
              <StableInput
                className="mt-1 h-9"
                value={headerText}
                onChange={(e) => updateNodeData(nodeId, { headerText: e.target.value.slice(0, 60) })}
                placeholder="Enter header text"
                maxLength={60}
              />
              <p className="text-xs text-muted-foreground mt-1 text-right">
                {60 - (headerText?.length || 0)} characters left
              </p>
            </div>
          ) : null}

          <div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm font-medium">Body Text</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  openDataSelector({
                    nodeId,
                    fieldKey: "body",
                    contextLabel: "Send List Message",
                    onInsert: (snippet) => updateNodeData(nodeId, { body: (data.body || "") + snippet }),
                  });
                }}
              >
                <Database className="h-3.5 w-3.5 mr-1" />
                Insert variable
              </Button>
            </div>
            <StableTextarea
              className="mt-2 min-h-[120px] resize-y"
              rows={6}
              value={data.body || ""}
              onChange={(e) => updateNodeData(nodeId, { body: e.target.value })}
              placeholder="Enter message body..."
              maxLength={1024}
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">
              {1024 - ((data.body || "")?.length || 0)} characters left
            </p>
          </div>

          <div>
            <Label className="text-sm font-medium">Button Text</Label>
            <StableInput
              className="mt-2 h-9"
              value={(data.buttonText ?? "").toString()}
              onChange={(e) => updateNodeData(nodeId, { buttonText: e.target.value.slice(0, 20) })}
              placeholder="View Options"
              maxLength={20}
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">
              {20 - (((data.buttonText ?? "") as string)?.length || 0)} characters left
            </p>
          </div>

          <div className="space-y-3">
            {safeSections.map((section: any, sectionIdx: number) => {
              const rows = Array.isArray(section?.rows) ? section.rows : [];
              const safeRows = rows.length > 0 ? rows : [{ title: "", description: "" }];

              return (
                <div key={sectionIdx} className="rounded-lg border bg-muted/5 p-3 space-y-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <Label className="text-sm font-medium">Section Title</Label>
                      <StableInput
                        className="mt-1 h-9"
                        value={(section?.title || "").toString()}
                        onChange={(e) => {
                          const next = [...safeSections];
                          next[sectionIdx] = { ...(next[sectionIdx] || {}), title: e.target.value.slice(0, 24), rows: safeRows };
                          setSections(next);
                        }}
                        placeholder="Section title"
                        maxLength={24}
                      />
                      <p className="text-xs text-muted-foreground mt-1 text-right">
                        {24 - ((section?.title || "")?.length || 0)} characters left
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 mt-6"
                      onClick={() => {
                        const next = safeSections.filter((_s: any, i: number) => i !== sectionIdx);
                        setSections(next.length ? next : [{ title: "", rows: [{ id: `row-${Date.now()}`, title: "", description: "" }] }]);
                      }}
                      title="Delete section"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>

                  {safeRows.map((row: any, rowIdx: number) => (
                    <div key={row?.id || rowIdx} className="space-y-2">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 relative pr-12 overflow-visible">
                          <Label className="text-sm font-medium">Row Title</Label>
                          <div className="relative flex items-center gap-2 mt-1">
                            <StableInput
                              className="h-9 flex-1"
                              value={(row?.title || "").toString()}
                              onChange={(e) => {
                                const next = [...safeSections];
                                const nextRows = [...safeRows];
                                nextRows[rowIdx] = { ...(nextRows[rowIdx] || {}), title: e.target.value.slice(0, 24) };
                                next[sectionIdx] = { ...(next[sectionIdx] || {}), rows: nextRows };
                                setSections(next);
                              }}
                              placeholder="Row title"
                              maxLength={24}
                            />
                            <Handle
                              type="source"
                              position={Position.Right}
                              id={`list:${row?.id || `row-${sectionIdx}-${rowIdx}`}`}
                              className="!bg-primary !w-3 !h-3 !z-10"
                              style={{ position: "absolute", right: -10, top: "50%", transform: "translate(50%, -50%)" }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 text-right">
                            {24 - ((row?.title || "")?.length || 0)} characters left
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 mt-6"
                          onClick={() => {
                            const next = [...safeSections];
                            const nextRows = safeRows.filter((_r: any, i: number) => i !== rowIdx);
                            next[sectionIdx] = { ...(next[sectionIdx] || {}), rows: nextRows.length ? nextRows : [{ id: `row-${Date.now()}`, title: "", description: "" }] };
                            setSections(next);
                          }}
                          title="Delete row"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>

                      <div>
                        <Label className="text-sm font-medium">Row Description (Optional)</Label>
                        <StableTextarea
                          className="mt-1"
                          rows={5}
                          value={(row?.description || "").toString()}
                          onChange={(e) => {
                            const next = [...safeSections];
                            const nextRows = [...safeRows];
                            nextRows[rowIdx] = { ...(nextRows[rowIdx] || {}), description: e.target.value.slice(0, 72) };
                            next[sectionIdx] = { ...(next[sectionIdx] || {}), rows: nextRows };
                            setSections(next);
                          }}
                          placeholder="Row description"
                          maxLength={72}
                        />
                        <p className="text-xs text-muted-foreground mt-1 text-right">
                          {72 - ((row?.description || "")?.length || 0)} characters left
                        </p>
                      </div>
                    </div>
                  ))}

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        const next = [...safeSections];
                        const nextRows = [...safeRows, { id: `row-${Date.now()}`, title: "", description: "" }];
                        next[sectionIdx] = { ...(next[sectionIdx] || {}), rows: nextRows };
                        setSections(next);
                      }}
                    >
                      + Add Row
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        const next = [...safeSections, { title: "", rows: [{ id: `row-${Date.now()}`, title: "", description: "" }] }];
                        setSections(next);
                      }}
                    >
                      + Add Section
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div>
            <Label className="text-sm font-medium">Footer Text</Label>
            <StableInput
              className="mt-1 h-9"
              value={data.footer || ""}
              onChange={(e) => updateNodeData(nodeId, { footer: e.target.value.slice(0, 60) })}
              placeholder="Enter footer text"
              maxLength={60}
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">
              {60 - ((data.footer || "")?.length || 0)} characters left
            </p>
          </div>
        </>
      );
    }

    case "send_media": {
      const mediaType = (data.mediaType || "image").toString().toLowerCase();
      const urlLabel =
        mediaType === "video"
          ? "Video URL"
          : mediaType === "document"
            ? "Document URL"
            : mediaType === "audio"
              ? "Audio URL"
              : "Image URL";

      return wrap(
        <>
          <div>
            <Label className="text-sm font-medium">Media Type</Label>
            <Select value={mediaType} onValueChange={(v) => updateNodeData(nodeId, { mediaType: v })}>
              <SelectTrigger className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="image">Image</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="document">Document</SelectItem>
                <SelectItem value="audio">Audio</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-medium">{urlLabel}</Label>
            <Input className="mt-1 h-9" value={data.url || ""} onChange={(e) => updateNodeData(nodeId, { url: e.target.value })} placeholder="https://..." />
          </div>

          <div>
            <Label className="text-sm font-medium">Caption (Optional)</Label>
            <StableTextarea
              className="mt-1"
              rows={5}
              value={data.caption || ""}
              onChange={(e) => updateNodeData(nodeId, { caption: e.target.value })}
              placeholder="Enter caption..."
              maxLength={1024}
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">
              {1024 - ((data.caption || "")?.length || 0)} characters left
            </p>
          </div>
        </>
      );
    }

    case "send_cta": {
      const headerType = (data.headerType || "none").toString().toLowerCase();
      return wrap(
        <>
          <div>
            <Label className="text-sm font-medium">Header Type</Label>
            <Select value={headerType} onValueChange={(v) => updateNodeData(nodeId, { headerType: v })}>
              <SelectTrigger className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="image">Image</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="document">Document</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {headerType === "text" ? (
            <div>
              <Label className="text-sm font-medium">Display text</Label>
              <Input
                className="mt-1 h-9"
                value={(data.headerText || "").toString()}
                onChange={(e) => updateNodeData(nodeId, { headerText: e.target.value.slice(0, 20) })}
                placeholder="Enter display text"
                maxLength={20}
              />
              <p className="text-xs text-muted-foreground mt-1 text-right">{20 - ((data.headerText || "")?.length || 0)} characters left</p>
            </div>
          ) : null}

          {["image", "video", "document"].includes(headerType) ? (
            <div>
              <Label className="text-sm font-medium">Header {headerType === "image" ? "Image" : headerType === "video" ? "Video" : "Document"} URL</Label>
              <Input
                className="mt-1 h-9"
                value={(data.headerUrl || "").toString()}
                onChange={(e) => updateNodeData(nodeId, { headerUrl: e.target.value })}
                placeholder={`Enter ${headerType} URL (https://...)`}
              />
              <p className="text-xs text-muted-foreground mt-1">Must be a public HTTPS URL. Supported: JPEG, PNG for images.</p>
            </div>
          ) : null}

          <div>
            <Label className="text-sm font-medium">Button URL</Label>
            <Input
              className="mt-1 h-9"
              value={data.url || ""}
              onChange={(e) => updateNodeData(nodeId, { url: e.target.value })}
              placeholder="URL that opens when button is clicked"
            />
          </div>

          <div>
            <Label className="text-sm font-medium">Footer Text</Label>
            <StableInput
              className="mt-1 h-9"
              value={data.footer || ""}
              onChange={(e) => updateNodeData(nodeId, { footer: e.target.value.slice(0, 60) })}
              placeholder="Enter footer text"
              maxLength={60}
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">{60 - ((data.footer || "")?.length || 0)} characters left</p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm font-medium">Body Text</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  openDataSelector({
                    nodeId,
                    fieldKey: "body",
                    contextLabel: "Send CTA Message",
                    onInsert: (snippet) => updateNodeData(nodeId, { body: (data.body || "") + snippet }),
                  });
                }}
              >
                <Database className="h-3.5 w-3.5 mr-1" />
                Insert variable
              </Button>
            </div>
            <StableTextarea
              className="mt-2 min-h-[100px] resize-y"
              rows={5}
              value={data.body || ""}
              onChange={(e) => updateNodeData(nodeId, { body: e.target.value })}
              placeholder="Enter message body (optional)"
              maxLength={1024}
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">{1024 - ((data.body || "")?.length || 0)} characters left</p>
          </div>

          <div>
            <Label className="text-sm font-medium">Button Title</Label>
            <Input
              className="mt-2 h-9"
              value={(data.displayText || "").toString()}
              onChange={(e) => updateNodeData(nodeId, { displayText: e.target.value.slice(0, 20) })}
              placeholder="Button label"
              maxLength={20}
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">{20 - ((data.displayText || "")?.length || 0)} characters left</p>
          </div>

          <div>
            <Label className="text-sm font-medium">Delay before next message (seconds)</Label>
            <Input
              type="number"
              min={0}
              max={300}
              className="mt-1 h-9"
              value={data.delayBeforeNext ?? 30}
              onChange={(e) => updateNodeData(nodeId, { delayBeforeNext: Math.max(0, parseInt(e.target.value, 10) || 0) })}
              placeholder="30"
            />
            <p className="text-xs text-muted-foreground mt-1">WhatsApp doesn&apos;t notify when CTA is clicked. Add a delay (e.g. 30–60s) so users can open the link before the next message.</p>
          </div>
        </>
      );
    }

    case "send_product":
      return wrap(
        <>
          <div>
            <Label className="text-sm font-medium">Catalog ID</Label>
            <Input
              className="mt-1 h-9"
              value={data.catalogId ?? ""}
              onChange={(e) => updateNodeData(nodeId, { catalogId: e.target.value })}
              placeholder="Enter catalog ID"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Product Retailer ID</Label>
            <Input
              className="mt-1 h-9"
              value={data.productId ?? data.productRetailerId ?? ""}
              onChange={(e) => updateNodeData(nodeId, { productId: e.target.value, productRetailerId: e.target.value })}
              placeholder="Enter product retailer ID"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Body Text</Label>
            <StableTextarea
              className="mt-1"
              rows={5}
              value={data.body ?? ""}
              onChange={(e) => updateNodeData(nodeId, { body: e.target.value })}
              placeholder="Enter message body..."
              maxLength={1024}
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">{1024 - ((data.body ?? "")?.length || 0)} characters left</p>
          </div>
          <div>
            <Label className="text-sm font-medium">Footer Text</Label>
            <Input
              className="mt-1 h-9"
              value={data.footer ?? ""}
              onChange={(e) => updateNodeData(nodeId, { footer: e.target.value.slice(0, 60) })}
              placeholder="Enter footer text"
              maxLength={60}
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">{60 - ((data.footer ?? "")?.length || 0)} characters left</p>
          </div>
        </>
      );

    case "ask_location":
      return wrap(
        <>
          <div>
            <Label className="text-sm font-medium">Location Request Message</Label>
            <Textarea
              className="mt-1"
              rows={5}
              value={data.message ?? ""}
              onChange={(e) => updateNodeData(nodeId, { message: e.target.value })}
              placeholder="Enter message to request user's location..."
              maxLength={1024}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Only {1024 - ((data.message ?? "")?.length || 0)}/1024 characters are allowed
            </p>
          </div>
        </>
      );

    case "ask_question":
      return wrap(
        <>
          <div>
            <Label className="text-sm font-medium">Message</Label>
            <Textarea
              className="mt-1"
              rows={5}
              value={data.message || ""}
              onChange={(e) => updateNodeData(nodeId, { message: e.target.value })}
              placeholder="Enter your question..."
              maxLength={1024}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Only {1024 - ((data.message || "")?.length || 0)}/1024 characters are allowed
            </p>
          </div>

          <div>
            <Label className="text-sm font-medium">Response Format</Label>
            <Select value={data.responseFormat || "any"} onValueChange={(v) => updateNodeData(nodeId, { responseFormat: v })}>
              <SelectTrigger className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any Response</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="regex">Regex</SelectItem>
                <SelectItem value="media">Media</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-medium">Validation Message</Label>
            <Input
              className="mt-1 h-9"
              value={data.validationMessage || ""}
              onChange={(e) => updateNodeData(nodeId, { validationMessage: e.target.value })}
              placeholder="Message shown when validation fails"
            />
            <p className="text-xs text-muted-foreground mt-1">Message shown when validation fails</p>
          </div>

          <div>
            <Label className="text-sm font-medium">Retry Count</Label>
            <Input
              className="mt-1 h-9"
              type="number"
              min={1}
              max={10}
              value={data.retryCount ?? 3}
              onChange={(e) => updateNodeData(nodeId, { retryCount: Math.min(10, Math.max(1, parseInt(e.target.value) || 1)) })}
              placeholder="1-10"
            />
            <p className="text-xs text-muted-foreground mt-1">Number of retry attempts (1-10) before proceeding</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Timeout Value</Label>
              <Input
                className="mt-1 h-9"
                type="number"
                value={data.timeoutValue ?? 60}
                min={1}
                onChange={(e) => updateNodeData(nodeId, { timeoutValue: parseInt(e.target.value) || 60 })}
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Unit</Label>
              <Select value={data.timeoutUnit || "seconds"} onValueChange={(v) => updateNodeData(nodeId, { timeoutUnit: v })}>
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="seconds">Seconds</SelectItem>
                  <SelectItem value="minutes">Minutes</SelectItem>
                  <SelectItem value="hours">Hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">Timeout Message</Label>
            <Textarea
              className="mt-1"
              rows={5}
              value={data.timeoutMessage || ""}
              onChange={(e) => updateNodeData(nodeId, { timeoutMessage: e.target.value })}
              placeholder="Message shown when the timeout is reached"
              maxLength={1024}
            />
            <p className="text-xs text-muted-foreground mt-1">Message shown when the timeout is reached</p>
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-muted/10 px-3 py-2">
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium">Continue on Timeout</p>
              <span title="If enabled, skip timeout message and proceed to next step when timeout is reached" className="text-muted-foreground cursor-help">ⓘ</span>
            </div>
            <Switch checked={!!data.continueOnTimeout} onCheckedChange={(v) => updateNodeData(nodeId, { continueOnTimeout: v })} />
          </div>
        </>
      );

    case "ai_agent": {
      const assistantId = data.assistantId || data.assistant || "";
      return wrap(
        <>
          <div>
            <Label className="text-sm font-medium">Stop Agent Keywords</Label>
            <div className="mt-1">
              <KeywordTagsInput keywords={Array.isArray(data.stopKeywords) ? data.stopKeywords : []} onChange={(stopKeywords) => updateNodeData(nodeId, { stopKeywords })} />
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">Assistant</Label>
            <Select
              value={assistantId}
              onValueChange={(v) => updateNodeData(nodeId, { assistantId: v, assistant: v })}
            >
              <SelectTrigger className="mt-1 h-9">
                <SelectValue placeholder="Select an assistant" />
              </SelectTrigger>
              <SelectContent>
                {aiAssistants.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
                {aiAssistants.length === 0 ? (
                  <SelectItem value="__no_assistants__" disabled>No assistants — create one in AI Assistant</SelectItem>
                ) : null}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Timeout Value</Label>
              <Input
                className="mt-1 h-9"
                type="number"
                value={data.timeoutValue ?? 5}
                min={1}
                onChange={(e) => updateNodeData(nodeId, { timeoutValue: parseInt(e.target.value) || 5 })}
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Unit</Label>
              <Select value={data.timeoutUnit || "minutes"} onValueChange={(v) => updateNodeData(nodeId, { timeoutUnit: v })}>
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minutes">Minutes</SelectItem>
                  <SelectItem value="hours">Hours</SelectItem>
                  <SelectItem value="seconds">Seconds</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">Welcome Message</Label>
            <Textarea className="mt-1" rows={5} value={data.welcomeMessage || ""} onChange={(e) => updateNodeData(nodeId, { welcomeMessage: e.target.value })} />
          </div>

          <div>
            <Label className="text-sm font-medium">Timeout Message (Optional)</Label>
            <Textarea
              className="mt-1"
              rows={5}
              value={data.timeoutMessage || ""}
              onChange={(e) => updateNodeData(nodeId, { timeoutMessage: e.target.value })}
              placeholder="Message shown when the timeout is reached"
            />
            <p className="text-xs text-muted-foreground mt-1">Message shown when the timeout is reached</p>
          </div>
        </>
      );
    }

    case "http":
      return wrap(<HTTPNodeEditor nodeId={nodeId} data={data} updateNodeData={updateNodeData} openDataSelector={openDataSelector} />);

    case "append_google_sheet":
      return wrap(<AppendGoogleSheetNodeEditor nodeId={nodeId} data={data} updateNodeData={updateNodeData} />);

    case "delay": {
      const delayType = data.delayType || "delay_for";
      const timezones = getAllTimezones();
      return wrap(
        <>
          <div>
            <Label className="text-sm font-medium">Delay Type</Label>
            <Select value={delayType} onValueChange={(v) => updateNodeData(nodeId, { delayType: v })}>
              <SelectTrigger className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="delay_for">Delay for</SelectItem>
                <SelectItem value="delay_until_date">Delay until date</SelectItem>
                <SelectItem value="delay_until_weekday">Delay until specific weekday</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">Choose how you want to configure the delay</p>
          </div>

          {delayType === "delay_for" && (
            <>
              <div>
                <Label className="text-sm font-medium">Value</Label>
                <Input
                  className="mt-1 h-9"
                  type="number"
                  min={1}
                  value={data.delayValue ?? 1}
                  onChange={(e) => updateNodeData(nodeId, { delayValue: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                />
                <p className="text-xs text-muted-foreground mt-1">Enter delay duration</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Unit</Label>
                <Select value={data.delayUnit || "minutes"} onValueChange={(v) => updateNodeData(nodeId, { delayUnit: v })}>
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seconds">Seconds</SelectItem>
                    <SelectItem value="minutes">Minutes</SelectItem>
                    <SelectItem value="hours">Hours</SelectItem>
                    <SelectItem value="days">Days</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Select time unit</p>
              </div>
            </>
          )}

          {delayType === "delay_until_date" && (
            <>
              <div>
                <Label className="text-sm font-medium">Delay Until Date</Label>
                <Input
                  className="mt-1 h-9"
                  type="datetime-local"
                  value={data.delayUntilDate || ""}
                  onChange={(e) => updateNodeData(nodeId, { delayUntilDate: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">Select the date and time to delay until</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Timezone</Label>
                <Select value={data.delayTimezone || "Asia/Kolkata"} onValueChange={(v) => updateNodeData(nodeId, { delayTimezone: v })}>
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue placeholder="Choose timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {timezones.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Choose the timezone for this delay</p>
              </div>
            </>
          )}

          {delayType === "delay_until_weekday" && (
            <>
              <div>
                <Label className="text-sm font-medium">Weekday</Label>
                <Select value={data.delayWeekday || "1"} onValueChange={(v) => updateNodeData(nodeId, { delayWeekday: v })}>
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Sunday</SelectItem>
                    <SelectItem value="1">Monday</SelectItem>
                    <SelectItem value="2">Tuesday</SelectItem>
                    <SelectItem value="3">Wednesday</SelectItem>
                    <SelectItem value="4">Thursday</SelectItem>
                    <SelectItem value="5">Friday</SelectItem>
                    <SelectItem value="6">Saturday</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Select the target weekday</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Time</Label>
                <Input
                  className="mt-1 h-9"
                  type="time"
                  value={data.delayUntilTime || "09:00"}
                  onChange={(e) => updateNodeData(nodeId, { delayUntilTime: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">Select the time on the chosen weekday</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Timezone</Label>
                <Select value={data.delayTimezone || "Asia/Kolkata"} onValueChange={(v) => updateNodeData(nodeId, { delayTimezone: v })}>
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue placeholder="Choose timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {timezones.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Choose the timezone for this delay</p>
              </div>
            </>
          )}
        </>
      );
    }

    case "condition": {
      const conditionsList = Array.isArray(data.conditions) ? data.conditions : [{ firstValue: '', operator: 'equals', secondValue: '' }];
      const CONDITION_OPERATORS = [
        { value: 'equals', label: 'Equals' },
        { value: 'not_equals', label: 'Not Equals' },
        { value: 'contains', label: 'Contains' },
        { value: 'starts_with', label: 'Starts With' },
        { value: 'ends_with', label: 'Ends With' },
        { value: 'is_phone', label: 'Is Phone Number' },
        { value: 'is_email', label: 'Is Email' },
        { value: 'greater_than', label: 'Greater Than' },
        { value: 'less_than', label: 'Less Than' },
        { value: 'matches_regex', label: 'Matches Regex' },
        { value: 'fuzzy_match', label: 'Fuzzy Match' },
        { value: 'within_working_hours', label: 'Within Working Hours' },
        { value: 'outside_working_hours', label: 'Outside Working Hours' },
      ];
      return wrap(
        <>
          <div>
            <Label className="text-sm font-medium">Match</Label>
            <Select value={data.matchType || "all"} onValueChange={(v) => updateNodeData(nodeId, { matchType: v })}>
              <SelectTrigger className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All conditions</SelectItem>
                <SelectItem value="any">Any condition</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm font-medium">First value</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  openDataSelector({
                    nodeId,
                    fieldKey: "condition_0_firstValue",
                    contextLabel: "Condition — First value",
                    onInsert: (snippet) => {
                      const next = [...conditionsList];
                      next[0] = { ...(next[0] || {}), firstValue: (next[0]?.firstValue ?? "") + snippet };
                      updateNodeData(nodeId, { conditions: next });
                    },
                  });
                }}
              >
                <Database className="h-3.5 w-3.5 mr-1" />
                Insert variable
              </Button>
            </div>
            <Input
              className="mt-1 h-9"
              value={conditionsList[0]?.firstValue ?? ''}
              onChange={(e) => {
                const next = [...conditionsList];
                next[0] = { ...(next[0] || {}), firstValue: e.target.value };
                updateNodeData(nodeId, { conditions: next });
              }}
              placeholder="Select or enter first value"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Condition</Label>
            <Select
              value={conditionsList[0]?.operator ?? 'equals'}
              onValueChange={(v) => {
                const next = [...conditionsList];
                next[0] = { ...(next[0] || {}), operator: v };
                updateNodeData(nodeId, { conditions: next });
              }}
            >
              <SelectTrigger className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONDITION_OPERATORS.map((op) => (
                  <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!['is_phone', 'is_email'].includes(conditionsList[0]?.operator ?? '') && (
            <div>
              <div className="flex items-center justify-between gap-2">
                <Label className="text-sm font-medium">Second value</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    openDataSelector({
                      nodeId,
                      fieldKey: "condition_0_secondValue",
                      contextLabel: "Condition — Second value",
                      onInsert: (snippet) => {
                        const next = [...conditionsList];
                        next[0] = { ...(next[0] || {}), secondValue: (next[0]?.secondValue ?? "") + snippet };
                        updateNodeData(nodeId, { conditions: next });
                      },
                    });
                  }}
                >
                  <Database className="h-3.5 w-3.5 mr-1" />
                  Insert variable
                </Button>
              </div>
              <Input
                className="mt-1 h-9"
                value={conditionsList[0]?.secondValue ?? ''}
                onChange={(e) => {
                  const next = [...conditionsList];
                  next[0] = { ...(next[0] || {}), secondValue: e.target.value };
                  updateNodeData(nodeId, { conditions: next });
                }}
                placeholder="Compare with value"
              />
            </div>
          )}
          {conditionsList.some((c: any) => (c?.operator ?? '') === 'fuzzy_match') && (
            <div>
              <Label className="text-sm font-medium">Match Sensitivity: {(data.matchSensitivity ?? 80)}%</Label>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-muted-foreground">Exact Match</span>
                <Slider
                  className="flex-1"
                  value={[data.matchSensitivity ?? 80]}
                  onValueChange={([v]) => updateNodeData(nodeId, { matchSensitivity: v })}
                  min={0}
                  max={100}
                  step={5}
                />
                <span className="text-xs text-muted-foreground">Very Loose</span>
              </div>
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start"
            onClick={() => updateNodeData(nodeId, { conditions: [...conditionsList, { firstValue: '', operator: 'equals', secondValue: '' }] })}
          >
            + Add Condition
          </Button>
          {conditionsList.length > 1 ? (
            <div className="space-y-2 mt-2">
              {conditionsList.slice(1).map((c: any, idx: number) => (
                <div key={idx} className="rounded-lg border bg-muted/5 p-2 space-y-2 flex flex-col">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">Condition {idx + 2}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        const next = conditionsList.filter((_: any, i: number) => i !== idx + 1);
                        updateNodeData(nodeId, { conditions: next.length ? next : [{ firstValue: '', operator: 'equals', secondValue: '' }] });
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-[11px]">First value</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          const condIdx = idx + 1;
                          openDataSelector({
                            nodeId,
                            fieldKey: `condition_${condIdx}_firstValue`,
                            contextLabel: `Condition ${condIdx + 1} — First value`,
                            onInsert: (snippet) => {
                              const next = [...conditionsList];
                              next[condIdx] = {
                                ...(next[condIdx] || {}),
                                firstValue: (next[condIdx]?.firstValue ?? "") + snippet,
                              };
                              updateNodeData(nodeId, { conditions: next });
                            },
                          });
                        }}
                      >
                        <Database className="h-3.5 w-3.5 mr-1" />
                        Insert variable
                      </Button>
                    </div>
                    <Input
                      className="mt-1 h-9"
                      value={c?.firstValue ?? ''}
                      onChange={(e) => {
                        const next = [...conditionsList];
                        next[idx + 1] = { ...(next[idx + 1] || {}), firstValue: e.target.value };
                        updateNodeData(nodeId, { conditions: next });
                      }}
                      placeholder="First value"
                    />
                  </div>
                  <Select
                    value={c?.operator ?? 'equals'}
                    onValueChange={(v) => {
                      const next = [...conditionsList];
                      next[idx + 1] = { ...(next[idx + 1] || {}), operator: v };
                      updateNodeData(nodeId, { conditions: next });
                    }}
                  >
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONDITION_OPERATORS.map((op) => (
                        <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!['is_phone', 'is_email'].includes(c?.operator ?? '') && (
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-[11px]">Second value</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            const condIdx = idx + 1;
                            openDataSelector({
                              nodeId,
                              fieldKey: `condition_${condIdx}_secondValue`,
                              contextLabel: `Condition ${condIdx + 1} — Second value`,
                              onInsert: (snippet) => {
                                const next = [...conditionsList];
                                next[condIdx] = {
                                  ...(next[condIdx] || {}),
                                  secondValue: (next[condIdx]?.secondValue ?? "") + snippet,
                                };
                                updateNodeData(nodeId, { conditions: next });
                              },
                            });
                          }}
                        >
                          <Database className="h-3.5 w-3.5 mr-1" />
                          Insert variable
                        </Button>
                      </div>
                      <Input
                        className="mt-1 h-9"
                        value={c?.secondValue ?? ''}
                        onChange={(e) => {
                          const next = [...conditionsList];
                          next[idx + 1] = { ...(next[idx + 1] || {}), secondValue: e.target.value };
                          updateNodeData(nodeId, { conditions: next });
                        }}
                        placeholder="Second value"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : null}
          <div className="pt-2 border-t mt-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">Outputs</p>
            <div className="flex flex-col gap-2">
              <div className="relative flex items-center gap-2 pr-10 overflow-visible">
                <Handle
                  type="source"
                  position={Position.Right}
                  id="true"
                  className="!bg-primary !w-3 !h-3 !z-10"
                  style={{ position: "absolute", right: -10, top: "50%", transform: "translate(50%, -50%)" }}
                />
                <div className="flex-1 rounded border bg-muted/20 px-2 py-1.5 text-center text-xs">True</div>
              </div>
              <div className="relative flex items-center gap-2 pr-10 overflow-visible">
                <Handle
                  type="source"
                  position={Position.Right}
                  id="false"
                  className="!bg-primary !w-3 !h-3 !z-10"
                  style={{ position: "absolute", right: -10, top: "50%", transform: "translate(50%, -50%)" }}
                />
                <div className="flex-1 rounded border bg-muted/20 px-2 py-1.5 text-center text-xs">False</div>
              </div>
            </div>
          </div>
        </>
      );
    }

    case "send_template": {
      const templateParams = Array.isArray(data.templateParams) ? data.templateParams : [];
      const selectedTemplate = templateOptions.find(
        (t) => t.name === (data.templateName || '') && t.language === (data.templateLanguage || 'en')
      );
      const bodyVariableSlots = getOrderedBodyNumericVariables(selectedTemplate?.components);
      return wrap(
        <>
          <div>
            <Label className="text-sm font-medium">Template</Label>
            <Select
              value={
                selectedTemplate
                  ? `${selectedTemplate.name}|${selectedTemplate.language}`
                  : data.templateName && data.templateLanguage
                    ? `${data.templateName}|${data.templateLanguage}`
                    : '__none__'
              }
              onValueChange={(v) => {
                if (v === '__none__') {
                  updateNodeData(nodeId, { templateName: '', templateLanguage: 'en' });
                  return;
                }
                const [name, lang] = v.split('|');
                updateNodeData(nodeId, { templateName: name || '', templateLanguage: lang || 'en' });
              }}
            >
              <SelectTrigger className="mt-1 h-9">
                <SelectValue placeholder="Select template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select template</SelectItem>
                {templateOptions.length === 0 ? (
                  <SelectItem value="__no_templates__" disabled>No approved templates — sync in Message Templates</SelectItem>
                ) : (
                  templateOptions.map((t, idx) => (
                    <SelectItem key={t.id || `${t.name}|${t.language}|${idx}`} value={`${t.name}|${t.language}`}>
                      {t.name} ({t.language})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">Choose an approved WhatsApp template</p>
          </div>
          <div>
            <Label className="text-sm font-medium">Template language</Label>
            <Input
              className="mt-1 h-9"
              value={data.templateLanguage || 'en'}
              onChange={(e) => updateNodeData(nodeId, { templateLanguage: e.target.value })}
              placeholder="e.g. en, en_US"
            />
          </div>
          <div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm font-medium">Recipient number</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  openDataSelector({
                    nodeId,
                    fieldKey: "recipientNumber",
                    contextLabel: "Send Template Message",
                    onInsert: (snippet) => updateNodeData(nodeId, { recipientNumber: (data.recipientNumber || "") + snippet }),
                  });
                }}
              >
                <Database className="h-3.5 w-3.5 mr-1" />
                Insert variable
              </Button>
            </div>
            <Input
              className="mt-1 h-9"
              value={data.recipientNumber ?? ''}
              onChange={(e) => updateNodeData(nodeId, { recipientNumber: e.target.value })}
              placeholder="Enter recipient number or {{nodeId.senderId}}"
            />
            <p className="text-xs text-muted-foreground mt-1">Leave empty to use current chat contact. Use Data Selector to insert senderId, receiverId, etc.</p>
          </div>
          <div>
            <Label className="text-sm font-medium">Phone number</Label>
            <Select
              value={data.sessionId || ''}
              onValueChange={(v) => updateNodeData(nodeId, { sessionId: v })}
            >
              <SelectTrigger className="mt-1 h-9">
                <SelectValue placeholder="Select phone number" />
              </SelectTrigger>
              <SelectContent>
                {triggerPhoneOptions.length === 0 ? (
                  <SelectItem value="" disabled>No connected numbers</SelectItem>
                ) : (
                  triggerPhoneOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">Sending number (Business API)</p>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id={`${nodeId}-form-template`}
              checked={!!data.isFormTemplate}
              onCheckedChange={(checked) => updateNodeData(nodeId, { isFormTemplate: !!checked })}
            />
            <Label htmlFor={`${nodeId}-form-template`} className="text-sm font-medium cursor-pointer">
              Form template (template has a Flow/Form button)
            </Label>
          </div>
          <p className="text-xs text-muted-foreground -mt-1">Enable when the selected template opens a WhatsApp Flow form</p>
          <div>
            <Label className="text-sm font-medium">Body parameters</Label>
            {!data.templateName ? (
              <p className="text-xs text-muted-foreground mt-1">Select a template to see body variable fields.</p>
            ) : bodyVariableSlots.length === 0 ? (
              <p className="text-xs text-muted-foreground mt-1">
                This template has no {'{{n}}'} placeholders in the body. Nothing to fill here.
              </p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mt-1">
                  One field per variable in the template body (in API order: {'{{1}}'}, {'{{2}}'}, …).
                </p>
                {bodyVariableSlots.map((slotNum, idx: number) => (
                  <div key={`${slotNum}-${idx}`} className="mt-2">
                    <Label className="text-xs text-muted-foreground mb-1 block">{`{{${slotNum}}}`}</Label>
                    <Input
                      className="h-9"
                      value={typeof templateParams[idx] === 'string' ? templateParams[idx] : ''}
                      onChange={(e) => {
                        const next = bodyVariableSlots.map((_, i) =>
                          i === idx ? e.target.value : typeof templateParams[i] === 'string' ? templateParams[i] : ''
                        );
                        updateNodeData(nodeId, { templateParams: next });
                      }}
                      placeholder={`Value for {{${slotNum}}}`}
                    />
                  </div>
                ))}
              </>
            )}
          </div>
        </>
      );
    }

    case "update_columns": {
      const columnUpdates = Array.isArray(data.columnUpdates) ? data.columnUpdates : [];
      return wrap(
        <>
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Column Updates</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => updateNodeData(nodeId, { columnUpdates: [...columnUpdates, { columnId: "", value: "" }] })}
            >
              + Add Column
            </Button>
          </div>
          <div className="space-y-3">
            {columnUpdates.length === 0 ? (
              <p className="text-xs text-muted-foreground">Add column updates to set contact fields when this step runs.</p>
            ) : (
              columnUpdates.map((entry: { columnId?: string; value?: string }, idx: number) => (
                <div key={idx} className="rounded-lg border bg-muted/5 p-2 space-y-2 flex flex-col">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Label className="text-[11px]">Column</Label>
                      <Select
                        value={(entry.columnId || "") || "__none__"}
                        onValueChange={(v) => {
                          const next = [...columnUpdates];
                          next[idx] = { ...next[idx], columnId: v === "__none__" ? "" : v };
                          updateNodeData(nodeId, { columnUpdates: next });
                        }}
                      >
                        <SelectTrigger className="mt-1 h-9">
                          <SelectValue placeholder="Select a column" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Select a column</SelectItem>
                          {contactColumns.map((col) => (
                            <SelectItem key={col.id} value={col.id}>
                              {col.label}
                            </SelectItem>
                          ))}
                          {contactColumns.length === 0 ? (
                            <SelectItem value="__empty__" disabled>No columns — create them in Columns</SelectItem>
                          ) : null}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-destructive mt-5"
                      onClick={() => {
                        const next = columnUpdates.filter((_: any, i: number) => i !== idx);
                        updateNodeData(nodeId, { columnUpdates: next.length ? next : [] });
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-[11px]">Value</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDataSelector({
                            nodeId,
                            fieldKey: `columnUpdate_${idx}_value`,
                            contextLabel: "Update Columns",
                            onInsert: (snippet) => {
                              const next = [...columnUpdates];
                              next[idx] = { ...next[idx], value: (entry.value ?? "") + snippet };
                              updateNodeData(nodeId, { columnUpdates: next });
                            },
                          });
                        }}
                      >
                        <Database className="h-3.5 w-3.5 mr-1" />
                        Insert variable
                      </Button>
                    </div>
                    <Input
                      className="mt-1 h-9"
                      value={entry.value ?? ""}
                      onChange={(e) => {
                        const next = [...columnUpdates];
                        next[idx] = { ...next[idx], value: e.target.value };
                        updateNodeData(nodeId, { columnUpdates: next });
                      }}
                      placeholder="Enter the value to update the column with"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">You can use dynamic variables.</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      );
    }

    case "update_tag": {
      const tagIds = Array.isArray(data.tagIds) ? data.tagIds : [];
      const action = (data.action === "remove" ? "remove" : "add") as "add" | "remove";
      return wrap(
        <>
          <div>
            <Label className="text-xs font-medium">Tags to Assign</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="mt-1 h-9 w-full justify-start text-left font-normal"
                >
                  {tagIds.length === 0
                    ? "Select tags to assign..."
                    : tagIds.length === 1
                      ? contactTags.find((t) => t.id === tagIds[0])?.name || "1 tag selected"
                      : `${tagIds.length} tags selected`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0" align="start">
                <div className="max-h-[240px] overflow-y-auto p-2">
                  {contactTags.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">No tags — create them in Tags</div>
                  ) : (
                    contactTags.map((tag) => {
                      const isChecked = tagIds.includes(tag.id);
                      return (
                        <div
                          key={tag.id}
                          className="flex items-center space-x-2 p-2 hover:bg-accent rounded cursor-pointer"
                          onClick={() => {
                            const next = isChecked ? tagIds.filter((id) => id !== tag.id) : [...tagIds, tag.id];
                            updateNodeData(nodeId, { tagIds: next });
                          }}
                        >
                          <Checkbox checked={isChecked} />
                          <span
                            className="inline-block w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: tag.color || "#6b7280" }}
                          />
                          <Label className="text-sm font-normal cursor-pointer flex-1">{tag.name}</Label>
                        </div>
                      );
                    })
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground mt-1">
              Select one or more tags to {action === "add" ? "add to" : "remove from"} the contact.
            </p>
          </div>
          <div>
            <Label className="text-sm font-medium">Action</Label>
            <Select value={action} onValueChange={(v: "add" | "remove") => updateNodeData(nodeId, { action: v })}>
              <SelectTrigger className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="add">Add tags to contact</SelectItem>
                <SelectItem value="remove">Remove tags from contact</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      );
    }

    case "fetch_contact": {
      return wrap(
        <>
          <div>
            <Label className="text-xs font-medium">Fetch Contact</Label>
            <p className="text-xs text-muted-foreground mt-1">
              This action fetches the current contact and exposes all custom columns from Manage → Columns. You can
              reference values in later steps using node variables (e.g. {"{{nodeId.columns.email}}"}).
            </p>
          </div>
          <div>
            <Label className="text-xs font-medium">Available Columns</Label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {contactColumns.length === 0 ? (
                <span className="text-xs text-muted-foreground">No columns — create them in Columns</span>
              ) : (
                contactColumns.map((col) => (
                  <Badge key={col.id} variant="secondary" className="text-xs font-normal">
                    {col.label}
                  </Badge>
                ))
              )}
            </div>
          </div>
        </>
      );
    }

    case "stop_chatbot":
      return wrap(
        <p className="text-sm text-muted-foreground">
          Stopping the session will reset the chatbot to its initial state.
        </p>
      );

    default:
      // Keep other node types usable (simple placeholder) — can expand same way as above.
      return wrap(<p className="text-sm text-muted-foreground">This node type editor will appear here.</p>);
  }
}

function TriggerNode({ id, data, selected }: NodeProps<ChatbotNodeData>) {
  const { isNodeDirty, saveAll, cancelNodeEdits, isSaving } = useNodeUi();
  const dirty = isNodeDirty(id, data);

  return (
    <div className="flex flex-col items-stretch relative z-10">
      <div className={`rh-chatbot-node-card bg-card border-2 rounded-lg w-[380px] shadow-sm ${selected ? "border-primary" : "border-border"}`}>
        <Handle type="source" position={Position.Right} className="!bg-primary !w-3 !h-3" />
        <InlineNodeHeader
          icon={<Zap className="w-4 h-4 text-primary" />}
          title={(data.customLabel ?? "") || "On Message"}
          defaultLabel="On Message"
          nodeId={id}
          selected={selected}
        />
        <InlineNodeBody nodeId={id} data={data} />
      </div>

      {dirty ? (
        <div className="mt-2 flex justify-end gap-2 nodrag w-[380px]">
          <Button
            type="button"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              cancelNodeEdits(id);
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isSaving}
            onClick={(e) => {
              e.stopPropagation();
              saveAll();
            }}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ActionNode({ id, data, selected }: NodeProps<ChatbotNodeData>) {
  const { isNodeDirty, saveAll, cancelNodeEdits, isSaving } = useNodeUi();
  const dirty = isNodeDirty(id, data);

  const getIcon = () => {
    switch (data.nodeType) {
      case 'send_text':
        return <MessageSquare className="w-4 h-4" />;
      case 'send_button':
        return <MessageSquare className="w-4 h-4" />;
      case 'send_list':
        return <List className="w-4 h-4" />;
      case 'send_media':
        return <ImageIcon className="w-4 h-4" />;
      case 'send_cta':
        return <Link2 className="w-4 h-4" />;
      case 'ask_question':
        return <HelpCircle className="w-4 h-4" />;
      case 'ai_agent':
        return <Bot className="w-4 h-4" />;
      case 'http':
        return <Globe className="w-4 h-4" />;
      case 'append_google_sheet':
        return <FileSpreadsheet className="w-4 h-4" />;
      case 'delay':
        return <Clock className="w-4 h-4" />;
      case 'condition':
        return <GitBranch className="w-4 h-4" />;
      case 'send_template':
        return <FileText className="w-4 h-4" />;
      case 'send_product':
        return <ShoppingCart className="w-4 h-4" />;
      case 'ask_location':
        return <MapPin className="w-4 h-4" />;
      case 'update_columns':
        return <Columns3 className="w-4 h-4" />;
      case 'update_tag':
        return <Tag className="w-4 h-4" />;
      case 'fetch_contact':
        return <User className="w-4 h-4" />;
      case 'stop_chatbot':
        return <Square className="w-4 h-4" />;
      default:
        return <MessageSquare className="w-4 h-4" />;
    }
  };

  const getLabel = () => {
    switch (data.nodeType) {
      case 'send_text':
        return 'Send Text Message';
      case 'send_button':
        return 'Send Button Message';
      case 'send_list':
        return 'Send List Message';
      case 'send_media':
        return 'Send Media Message';
      case 'send_cta':
        return 'Send CTA Message';
      case 'ask_question':
        return 'Ask Question';
      case 'ai_agent':
        return 'AI Agent';
      case 'http':
        return 'HTTP';
      case 'append_google_sheet':
        return 'Append to Google Sheet';
      case 'delay':
        return 'Delay';
      case 'condition':
        return 'Condition';
      case 'send_template':
        return 'Send Template Message';
      case 'send_product':
        return 'Send Product Message';
      case 'ask_location':
        return 'Ask Location';
      case 'update_columns':
        return 'Update Columns';
      case 'update_tag':
        return 'Update Tag';
      case 'fetch_contact':
        return 'Fetch Contact';
      case 'stop_chatbot':
        return 'Stop Chatbot';
      default:
        return 'Action';
    }
  };

  return (
    <div className="flex flex-col items-stretch overflow-visible relative z-10">
      <div className={`rh-chatbot-node-card bg-card border-2 rounded-lg w-[380px] shadow-sm overflow-visible ${selected ? "border-primary" : "border-border"}`}>
        {data.nodeType === "ask_question" ? (
          <>
            <Handle
              type="target"
              position={Position.Left}
              className="!bg-primary !w-3 !h-3 !z-10"
              style={{ position: "absolute", left: -10, top: 24, transform: "translate(-50%, -50%)" }}
            />
            <Handle
              type="source"
              position={Position.Right}
              id="default"
              className="!bg-primary !w-3 !h-3 !z-10"
              style={{ position: "absolute", right: -10, top: 24, transform: "translate(50%, -50%)" }}
            />
          </>
        ) : (
          <>
            <Handle
              type="target"
              position={Position.Left}
              className="!bg-primary !w-3 !h-3"
              style={
                data.nodeType === "send_list"
                  ? { position: "absolute", left: -10, top: 24, transform: "translate(-50%, -50%)" }
                  : undefined
              }
            />
            {/* Send Button / Send List: extra top-right handle. Condition: true/false. Others: single source handle. */}
            {data.nodeType === "stop_chatbot" ? null : data.nodeType === "send_button" || data.nodeType === "send_list" ? (
              <Handle type="source" position={Position.Right} id="default" className="!bg-primary !w-3 !h-3" style={{ position: 'absolute', right: -10, top: 24, transform: 'translate(50%, -50%)' }} />
            ) : data.nodeType === "condition" ? null : (
              <Handle type="source" position={Position.Right} className="!bg-primary !w-3 !h-3" />
            )}
          </>
        )}
        <InlineNodeHeader
          icon={getIcon()}
          title={(data.customLabel ?? "") || getLabel()}
          defaultLabel={getLabel()}
          nodeId={id}
          selected={selected}
        />
        <InlineNodeBody nodeId={id} data={data} />
      </div>

      {dirty ? (
        <div className="mt-2 flex justify-end gap-2 nodrag w-[380px]">
          <Button
            type="button"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              cancelNodeEdits(id);
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isSaving}
            onClick={(e) => {
              e.stopPropagation();
              saveAll();
            }}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
}: EdgeProps) {
  const { setEdges } = useReactFlow();
  const { requestLinkSave } = useNodeUi();
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
          }}
          className="nodrag nopan"
        >
          <button
            type="button"
            onClick={() =>
              setEdges((eds) => {
                const next = eds.filter((e) => e.id !== id);
                requestLinkSave(next);
                return next;
              })
            }
            className="h-5 w-5 rounded-full bg-background border shadow flex items-center justify-center text-xs hover:bg-muted"
            title="Unlink"
          >
            ×
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
};

const edgeTypes = {
  deletable: DeletableEdge,
};

const INCOMING_MESSAGE_FIELDS: { name: string; label: string; type: string }[] = [
  { name: "message", label: "Incoming message (customer reply)", type: "string" },
  { name: "messageType", label: "Message type (text, button, list…)", type: "string" },
  { name: "buttonReplyTitle", label: "Button label they tapped", type: "string" },
  { name: "buttonReplyId", label: "Button ID they tapped", type: "string" },
  { name: "listReplyTitle", label: "List option they chose", type: "string" },
  { name: "listReplyId", label: "List option ID", type: "string" },
  { name: "senderName", label: "Customer name", type: "string" },
  { name: "senderId", label: "Customer phone / WhatsApp ID", type: "string" },
  { name: "receiverId", label: "Your WhatsApp number", type: "string" },
];

const DATA_SELECTOR_QUICK_INSERTS: { label: string; snippet: string }[] = [
  { label: "Incoming message", snippet: "{{onMessage.message}}" },
  { label: "Button they tapped", snippet: "{{onMessage.buttonReplyTitle}}" },
  { label: "List item they chose", snippet: "{{onMessage.listReplyTitle}}" },
  { label: "Customer name", snippet: "{{onMessage.senderName}}" },
  { label: "Customer phone / ID", snippet: "{{onMessage.senderId}}" },
  { label: "Latest answer (Ask Question)", snippet: "{{user_input}}" },
  { label: "Contact email (after Fetch Contact)", snippet: "{{contact.email}}" },
  { label: "Contact name (after Fetch Contact)", snippet: "{{contact.name}}" },
  { label: "Contact phone (after Fetch Contact)", snippet: "{{contact.phoneNumber}}" },
];

function DataSelectorPanel({
  nodes,
  edges,
  context,
  onClose,
}: {
  nodes: Node<ChatbotNodeData>[];
  edges: Edge[];
  context: DataSelectorContext;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>("incoming");

  const incomingFields = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return INCOMING_MESSAGE_FIELDS;
    return INCOMING_MESSAGE_FIELDS.filter(
      (f) => f.label.toLowerCase().includes(q) || f.name.toLowerCase().includes(q)
    );
  }, [search]);

  const upstreamIds = useMemo(
    () => getUpstreamNodeIds(nodes, edges, context.nodeId),
    [nodes, edges, context.nodeId]
  );

  const upstreamNodes = useMemo(() => {
    return upstreamIds
      .map((id) => {
        const n = nodes.find((nd) => nd.id === id);
        return n ? { id: n.id, nodeType: n.data?.nodeType as ChatbotNodeData["nodeType"], label: getNodeTypeLabel(n.data?.nodeType) } : null;
      })
      .filter(Boolean) as { id: string; nodeType: ChatbotNodeData["nodeType"]; label: string }[];
  }, [upstreamIds, nodes]);

  const filteredNodes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return upstreamNodes;
    return upstreamNodes.filter(
      (n) => n.label.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)
    );
  }, [upstreamNodes, search]);

  const handleSelectVariable = (
    nodeId: string,
    fieldName: string,
    nodeType?: ChatbotNodeData["nodeType"]
  ) => {
    if (nodeType === "trigger") {
      context.onInsert(`{{onMessage.${fieldName}}}`);
    } else {
      context.onInsert(`{{${nodeId}.${fieldName}}}`);
    }
    onClose();
  };

  const handleSelectIncomingField = (fieldName: string) => {
    context.onInsert(`{{onMessage.${fieldName}}}`);
    onClose();
  };

  const handleQuickInsert = (snippet: string) => {
    context.onInsert(snippet);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-end p-4 sm:p-6 pointer-events-none">
    <div className="pointer-events-auto w-[min(320px,calc(100vw-2rem))] rounded-lg border bg-card shadow-lg flex flex-col max-h-[min(80vh,calc(100dvh-2rem))] nodrag nopan">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b">
        <div className="flex items-center gap-2 min-w-0">
          <Database className="h-5 w-5 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate">Data Selector</h3>
            <p className="text-xs text-muted-foreground truncate">{context.contextLabel}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose} title="Close">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="px-3 py-2 border-b space-y-2 bg-muted/20">
        <p className="text-[11px] font-medium text-muted-foreground">Quick insert — tap a button (nothing to type)</p>
        <div className="flex flex-wrap gap-1.5">
          {DATA_SELECTOR_QUICK_INSERTS.map((q) => (
            <Button
              key={q.label}
              type="button"
              variant="secondary"
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => handleQuickInsert(q.snippet)}
            >
              {q.label}
            </Button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground leading-snug">
          Use <strong className="font-medium">Incoming WhatsApp message</strong> for what the customer just sent (text, button tap, list pick). Earlier steps are listed below.
        </p>
      </div>
      <div className="p-2 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search variables..."
            className="pl-8 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <ScrollArea className="flex-1 min-h-[200px]">
        <div className="p-2 space-y-0.5">
          <div>
            <button
              type="button"
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md hover:bg-muted/80 text-left bg-primary/5"
              onClick={() => setExpandedId(expandedId === "incoming" ? null : "incoming")}
            >
              <span className="text-sm font-medium truncate">Incoming WhatsApp message</span>
              <span className="text-xs text-muted-foreground shrink-0">
                {INCOMING_MESSAGE_FIELDS.length} fields
              </span>
              <ChevronRight
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expandedId === "incoming" ? "rotate-90" : ""}`}
              />
            </button>
            {expandedId === "incoming" && (
              <div className="pl-3 pr-2 pb-2 space-y-0.5">
                {incomingFields.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-3 py-2">No matching fields.</p>
                ) : (
                  incomingFields.map((f) => (
                    <button
                      key={f.name}
                      type="button"
                      className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-md hover:bg-muted/80 text-left"
                      onClick={() => handleSelectIncomingField(f.name)}
                    >
                      <span className="text-xs min-w-0">{f.label}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{f.type}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          {filteredNodes.length === 0 ? (
            search.trim() ? (
              <p className="text-xs text-muted-foreground px-2 py-4 text-center">No matching earlier steps.</p>
            ) : null
          ) : (
            filteredNodes.map((n) => (
              <div key={n.id}>
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md hover:bg-muted/80 text-left"
                  onClick={() => setExpandedId(expandedId === n.id ? null : n.id)}
                >
                  <span className="text-sm font-medium truncate">{n.label}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {getNodeOutputFields(n.nodeType).length} fields available
                  </span>
                  <ChevronRight
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expandedId === n.id ? "rotate-90" : ""}`}
                  />
                </button>
                {expandedId === n.id && (
                  <div className="pl-3 pr-2 pb-2 space-y-0.5">
                    {getNodeOutputFields(n.nodeType).map((f) => (
                      <button
                        key={f.name}
                        type="button"
                        className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-md hover:bg-muted/80 text-left"
                        onClick={() => handleSelectVariable(n.id, f.name, n.nodeType)}
                      >
                        <span className="text-xs min-w-0">{fieldLabelForChatbotDataField(n.nodeType, f.name)}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{f.type}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
    </div>
  );
}

type ChatbotSidebarItem = {
  nodeType: ChatbotNodeData["nodeType"];
  label: string;
  icon: React.ReactNode;
  keywords?: string[];
};

type ChatbotSidebarGroups = {
  triggers: ChatbotSidebarItem[];
  actions: ChatbotSidebarItem[];
  triggersTotal: number;
  actionsTotal: number;
};

function ChatbotComponentsSidebar({
  componentSearch,
  onComponentSearchChange,
  sidebar,
  onSidebarDragStart,
  onAddComponent,
  className,
}: {
  componentSearch: string;
  onComponentSearchChange: (value: string) => void;
  sidebar: ChatbotSidebarGroups;
  onSidebarDragStart: (event: React.DragEvent, nodeType: ChatbotNodeData["nodeType"]) => void;
  onAddComponent?: (nodeType: ChatbotNodeData["nodeType"]) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col bg-muted/50", className)}>
      <div className="p-4 border-b">
        <Input
          placeholder="Search components..."
          className="w-full"
          value={componentSearch}
          onChange={(e) => onComponentSearchChange(e.target.value)}
        />
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold mb-2">
              Triggers ({sidebar.triggers.length}
              {componentSearch.trim() ? `/${sidebar.triggersTotal}` : ""})
            </h3>
            <div className="space-y-1">
              {sidebar.triggers.map((t) => (
                <Button
                  key={t.nodeType}
                  variant="outline"
                  className="w-full justify-start"
                  draggable
                  onDragStart={(e) => onSidebarDragStart(e, t.nodeType)}
                  onClick={() => onAddComponent?.(t.nodeType)}
                >
                  {t.icon}
                  {t.label}
                </Button>
              ))}
              {sidebar.triggers.length === 0 ? (
                <p className="text-xs text-muted-foreground px-2 py-1">No triggers match your search.</p>
              ) : null}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-2">
              Actions ({sidebar.actions.length}
              {componentSearch.trim() ? `/${sidebar.actionsTotal}` : ""})
            </h3>
            <div className="space-y-1">
              {sidebar.actions.map((a) => (
                <Button
                  key={a.nodeType}
                  variant="outline"
                  className="w-full justify-start"
                  draggable
                  onDragStart={(e) => onSidebarDragStart(e, a.nodeType)}
                  onClick={() => onAddComponent?.(a.nodeType)}
                >
                  {a.icon}
                  {a.label}
                </Button>
              ))}
              {sidebar.actions.length === 0 ? (
                <p className="text-xs text-muted-foreground px-2 py-1">No actions match your search.</p>
              ) : null}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

export default function ChatbotBuilderPage() {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [componentsSheetOpen, setComponentsSheetOpen] = useState(false);

  // Extract chatbot ID from URL
  const pathParts = location.split('/');
  const chatbotId = pathParts[pathParts.indexOf('chatbots') + 1];

  const [chatbotName, setChatbotName] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [componentSearch, setComponentSearch] = useState("");
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [dataSelectorOpen, setDataSelectorOpen] = useState(false);
  const [dataSelectorContext, setDataSelectorContext] = useState<DataSelectorContext | null>(null);
  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null);
  const reactFlowWrapperRef = useRef<HTMLDivElement | null>(null);
  const hasFitViewOnLoadRef = useRef(false);
  const nodeDataBaselineRef = useRef<Record<string, string>>({});

  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string>("");
  const [lastSavedGraphSnapshot, setLastSavedGraphSnapshot] = useState<string>("");
  const [lastSavedMetaSnapshot, setLastSavedMetaSnapshot] = useState<string>("");
  const [lastSavedEdgesSnapshot, setLastSavedEdgesSnapshot] = useState<string>("");

  const currentSnapshot = useMemo(() => {
    return buildChatbotSnapshot({
      name: chatbotName,
      status: isPublished ? "published" : "draft",
      nodes,
      edges,
    });
  }, [chatbotName, isPublished, nodes, edges]);

  const currentMetaSnapshot = useMemo(() => {
    return JSON.stringify({ name: chatbotName, status: isPublished ? "published" : "draft" });
  }, [chatbotName, isPublished]);

  const currentGraphSnapshot = useMemo(() => buildGraphSnapshot(nodes, edges), [nodes, edges]);
  const currentEdgesSnapshot = useMemo(() => buildEdgesSnapshot(edges), [edges]);

  // Persist links locally so refresh never clears them (server is still the source of truth when available).
  const edgesStorageKey = useMemo(() => {
    if (!chatbotId || chatbotId === "undefined") return "";
    return getEdgesStorageKey(chatbotId);
  }, [chatbotId]);

  useEffect(() => {
    if (!edgesStorageKey) return;
    try {
      localStorage.setItem(edgesStorageKey, currentEdgesSnapshot);
    } catch {
      // ignore storage failures (private mode, quota, etc.)
    }
  }, [edgesStorageKey, currentEdgesSnapshot]);

  const isDirty = useMemo(() => {
    if (!lastSavedSnapshot) return false;
    return currentSnapshot !== lastSavedSnapshot;
  }, [currentSnapshot, lastSavedSnapshot]);

  const isMetaDirty = useMemo(() => {
    if (!lastSavedMetaSnapshot) return false;
    return currentMetaSnapshot !== lastSavedMetaSnapshot;
  }, [currentMetaSnapshot, lastSavedMetaSnapshot]);

  type SidebarItem = {
    nodeType: ChatbotNodeData["nodeType"];
    label: string;
    icon: React.ReactNode;
    keywords?: string[];
  };

  const sidebar = useMemo(() => {
    const triggers: SidebarItem[] = [
      {
        nodeType: "trigger",
        label: "On Message",
        icon: <Zap className="w-4 h-4 mr-2" />,
        keywords: ["trigger", "message", "keyword"],
      },
    ];

    const actions: SidebarItem[] = [
      { nodeType: "delay", label: "Delay", icon: <Clock className="w-4 h-4 mr-2" />, keywords: ["wait", "pause", "timer"] },
      { nodeType: "condition", label: "Condition", icon: <GitBranch className="w-4 h-4 mr-2" />, keywords: ["branch", "if", "logic"] },
      { nodeType: "send_template", label: "Send Template Message", icon: <FileText className="w-4 h-4 mr-2" />, keywords: ["template", "approved"] },
      { nodeType: "send_text", label: "Send Text Message", icon: <MessageSquare className="w-4 h-4 mr-2" />, keywords: ["text", "message"] },
      { nodeType: "send_button", label: "Send Button Message", icon: <MessageSquare className="w-4 h-4 mr-2" />, keywords: ["button", "quick reply"] },
      { nodeType: "send_list", label: "Send List Message", icon: <List className="w-4 h-4 mr-2" />, keywords: ["list", "menu"] },
      { nodeType: "send_media", label: "Send Media Message", icon: <ImageIcon className="w-4 h-4 mr-2" />, keywords: ["image", "video", "document", "audio"] },
      { nodeType: "send_cta", label: "Send CTA Message", icon: <Link2 className="w-4 h-4 mr-2" />, keywords: ["cta", "link", "url"] },
      { nodeType: "send_product", label: "Send Product Message", icon: <ShoppingCart className="w-4 h-4 mr-2" />, keywords: ["product", "catalog"] },
      { nodeType: "ask_location", label: "Ask Location", icon: <MapPin className="w-4 h-4 mr-2" />, keywords: ["location", "address", "map"] },
      { nodeType: "ask_question", label: "Ask Question", icon: <HelpCircle className="w-4 h-4 mr-2" />, keywords: ["question", "input"] },
      { nodeType: "update_columns", label: "Update Columns", icon: <Columns3 className="w-4 h-4 mr-2" />, keywords: ["columns", "contact", "data"] },
      { nodeType: "update_tag", label: "Update Tag", icon: <Tag className="w-4 h-4 mr-2" />, keywords: ["tag", "label"] },
      { nodeType: "fetch_contact", label: "Fetch Contact", icon: <User className="w-4 h-4 mr-2" />, keywords: ["contact", "fetch"] },
      { nodeType: "stop_chatbot", label: "Stop Chatbot", icon: <Square className="w-4 h-4 mr-2" />, keywords: ["stop", "end"] },
      { nodeType: "ai_agent", label: "AI Agent", icon: <Bot className="w-4 h-4 mr-2" />, keywords: ["ai", "assistant"] },
      { nodeType: "http", label: "HTTP", icon: <Globe className="w-4 h-4 mr-2" />, keywords: ["api", "webhook", "request"] },
      {
        nodeType: "append_google_sheet",
        label: "Append to Google Sheet",
        icon: <FileSpreadsheet className="w-4 h-4 mr-2" />,
        keywords: ["google", "sheet", "spreadsheet", "row", "excel", "export"],
      },
    ];

    const q = componentSearch.trim().toLowerCase();
    const matches = (item: SidebarItem) => {
      if (!q) return true;
      if (item.label.toLowerCase().includes(q)) return true;
      if (item.nodeType.toLowerCase().includes(q)) return true;
      const kw = Array.isArray(item.keywords) ? item.keywords : [];
      return kw.some((k) => k.toLowerCase().includes(q));
    };

    return {
      triggersTotal: triggers.length,
      actionsTotal: actions.length,
      triggers: triggers.filter(matches),
      actions: actions.filter(matches),
    };
  }, [componentSearch]);

  // Note: we intentionally DO NOT auto-save. Saving happens only when user clicks Save.

  // Connected devices / phone numbers (same sources as Connect Device)
  const { data: sessions = [] } = useQuery<WhatsappSession[]>({
    queryKey: ["/api/sessions"],
    refetchInterval: () => (typeof document !== "undefined" && document.hidden ? 60_000 : 15_000),
    staleTime: 10_000,
  });

  const { data: addedPhonesData } = useQuery<{
    success: boolean;
    phoneNumbers: Array<{
      sessionId: string;
      phoneNumberId: string;
      displayPhoneNumber?: string;
      verifiedName?: string;
      status?: string;
      codeVerificationStatus?: string;
    }>;
  }>({
    queryKey: ["/api/integrations/whatsapp-business/added-phones"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/integrations/whatsapp-business/added-phones");
      return await res.json();
    },
    enabled: true,
    refetchInterval: () => (typeof document !== "undefined" && document.hidden ? 60_000 : 30_000),
    staleTime: 15_000,
  });

  const triggerPhoneOptions = useMemo((): TriggerPhoneOption[] => {
    const options: TriggerPhoneOption[] = [];
    const seenSessionIds = new Set<string>();
    const seenPhoneIds = new Set<string>();

    // Source of truth: active added Business API phones (excludes soft-deleted / disconnected)
    (addedPhonesData?.phoneNumbers || []).forEach((p) => {
      if (!p.sessionId) return;
      if (p.status === "disconnected") return;
      if (seenSessionIds.has(p.sessionId)) return;
      if (p.phoneNumberId && seenPhoneIds.has(p.phoneNumberId)) return;
      seenSessionIds.add(p.sessionId);
      if (p.phoneNumberId) seenPhoneIds.add(p.phoneNumberId);
      const status = (p.codeVerificationStatus || p.status || "").toString();
      const baseLabel = p.displayPhoneNumber || p.phoneNumberId;
      const label = status ? `${baseLabel} (${status})` : baseLabel;
      options.push({
        value: p.sessionId,
        label,
        phoneNumberId: p.phoneNumberId,
        connectionType: "official",
      });
    });

    // Fallback: currently connected official sessions only (never soft-deleted — API already filters)
    sessions
      .filter(
        (s) =>
          s.status === "connected" &&
          s.connectionType === "official" &&
          !(s as { deletedAt?: string | Date | null }).deletedAt
      )
      .forEach((s) => {
        if (seenSessionIds.has(s.sessionId)) return;
        const phoneId = s.deviceInfo?.apiPhoneNumberId;
        if (phoneId && seenPhoneIds.has(phoneId)) return;
        seenSessionIds.add(s.sessionId);
        if (phoneId) seenPhoneIds.add(phoneId);
        const label =
          s.deviceInfo?.displayPhoneNumber ||
          s.deviceInfo?.phoneNumber ||
          s.deviceInfo?.name ||
          s.sessionId;
        options.push({
          value: s.sessionId,
          label,
          phoneNumberId: phoneId || undefined,
          connectionType: "official",
        });
      });

    return options;
  }, [addedPhonesData?.phoneNumbers, sessions]);

  // Drop deleted / disconnected numbers from node selections so they no longer show as selected
  useEffect(() => {
    if (!addedPhonesData) return; // wait until phones API has resolved
    const available = new Set(triggerPhoneOptions.map((o) => o.value));

    const remapSessionId = (id: string): string | null => {
      if (available.has(id)) return id;
      if (id.startsWith("wb_")) {
        const phoneId = id.split("_")[1];
        const match = triggerPhoneOptions.find((o) => o.phoneNumberId === phoneId);
        return match?.value ?? null;
      }
      return null;
    };

    setNodes((nds) => {
      let changed = false;
      const next = nds.map((node) => {
        const data = node.data as ChatbotNodeData & Record<string, any>;
        if (!data) return node;
        let nextData = data;
        let nodeChanged = false;

        const rawIds: string[] = Array.isArray(data.triggerSessionIds)
          ? data.triggerSessionIds.filter(Boolean)
          : data.triggerSessionId
            ? [String(data.triggerSessionId)]
            : [];

        if (rawIds.length > 0) {
          const remapped = rawIds
            .map(remapSessionId)
            .filter((id): id is string => !!id);
          const unique = Array.from(new Set(remapped));
          const same =
            unique.length === rawIds.length && unique.every((id, i) => id === rawIds[i]);
          if (!same) {
            nodeChanged = true;
            const selectedOptions = unique
              .map((id) => triggerPhoneOptions.find((o) => o.value === id))
              .filter(Boolean) as TriggerPhoneOption[];
            nextData = {
              ...nextData,
              triggerSessionIds: unique,
              triggerSessionId: unique.length === 1 ? unique[0] : "",
              triggerPhoneNumberId:
                selectedOptions.length === 1 ? selectedOptions[0]?.phoneNumberId || "" : "",
              triggerDisplayPhoneNumber: selectedOptions.map((o) => o.label).join(", "),
              triggerConnectionType:
                selectedOptions.length > 0 ? selectedOptions[0]?.connectionType || "" : "",
            };
          }
        }

        if (data.sessionId) {
          const remapped = remapSessionId(String(data.sessionId)) || "";
          if (remapped !== data.sessionId) {
            nodeChanged = true;
            nextData = { ...nextData, sessionId: remapped };
          }
        }

        if (!nodeChanged) return node;
        changed = true;
        return { ...node, data: nextData };
      });
      return changed ? next : nds;
    });
  }, [addedPhonesData, triggerPhoneOptions, setNodes]);

  const { data: chatbot, isLoading } = useQuery<Chatbot>({
    queryKey: ['/api/chatbots', chatbotId],
    queryFn: async () => {
      if (!chatbotId || chatbotId === 'undefined') {
        throw new Error('Invalid chatbot ID');
      }
      const response = await apiRequest('GET', `/api/chatbots/${chatbotId}`);
      return await response.json();
    },
    enabled: !!chatbotId && chatbotId !== 'undefined',
  });

  const { data: aiAssistantsList = [] } = useQuery<AiAssistantOption[]>({
    queryKey: ["/api/ai-assistants"],
  });

  const { data: templatesList = [] } = useQuery<
    Array<{
      id: string;
      name: string;
      language?: string;
      templateId?: string;
      status?: string;
      components?: TemplateOption["components"];
    }>
  >({
    queryKey: ["/api/templates"],
    queryFn: () => fetchLegacyListApi("/api/templates", "templates"),
  });
  const templateOptions: TemplateOption[] = useMemo(() => {
    const seen = new Set<string>();
    return (templatesList || [])
      .filter((t) => (t.status || "").toUpperCase() === "APPROVED")
      .filter((t) => {
        const key = `${t.name}|${(t.language || "en").toString()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((t) => ({
        id: t.id,
        name: t.name,
        language: (t.language || "en").toString(),
        templateId: t.templateId,
        status: t.status,
        components: t.components,
      }));
  }, [templatesList]);

  const { data: contactColumnsList = [] } = useQuery<ContactColumnOption[]>({
    queryKey: ["/api/columns"],
    queryFn: () => fetchLegacyListApi("/api/columns", "columns"),
  });

  const { data: contactTagsList = [] } = useQuery<ContactTagOption[]>({
    queryKey: ["/api/tags"],
    queryFn: () => fetchLegacyListApi("/api/tags", "tags"),
  });

  useEffect(() => {
    if (chatbot) {
      setChatbotName(chatbot.name);
      setIsPublished(chatbot.status === 'published');

      // Convert chatbot nodes to ReactFlow nodes
      const flowNodes: Node<ChatbotNodeData>[] = (chatbot.nodes || []).map((node) => ({
        id: node.id,
        type: node.nodeType === 'trigger' ? 'trigger' : 'action',
        position: node.position,
        data: { ...node.data, nodeType: node.nodeType },
      }));

      // Convert connections to edges
      const flowEdges: Edge[] = [];
      (chatbot.nodes || []).forEach((node) => {
        node.connections.forEach((conn) => {
          const sh = conn.fromHandle || "";
          const th = conn.toHandle || "";
          flowEdges.push({
            // IMPORTANT: include handles so multiple links don't overwrite on reload
            id: `e${conn.from}-${conn.to}-${sh}-${th}`,
            source: conn.from,
            target: conn.to,
            sourceHandle: conn.fromHandle,
            targetHandle: conn.toHandle,
            type: 'deletable',
            animated: true,
            zIndex: -1,
          });
        });
      });

      // If the backend returned no links (or the user refreshed before server save),
      // fall back to locally persisted links so they never disappear on refresh.
      let edgesToApply = flowEdges;
      if (edgesToApply.length === 0 && chatbotId && chatbotId !== "undefined") {
        const parts = readEdgesFromStorage(chatbotId);
        if (parts?.length) {
          const nodeIds = new Set(flowNodes.map((n) => n.id));
          const filtered = parts.filter((p) => nodeIds.has(p.source) && nodeIds.has(p.target));
          edgesToApply = buildFlowEdgesFromParts(filtered);
        }
      }

      edgesToApply = repairEdgeHandles(edgesToApply, flowNodes);

      setNodes(flowNodes);
      setEdges(edgesToApply);

      // Baseline data used for per-node Save/Cancel buttons
      const nextBaseline: Record<string, string> = {};
      flowNodes.forEach((n) => {
        nextBaseline[n.id] = JSON.stringify(n.data ?? {});
      });
      nodeDataBaselineRef.current = nextBaseline;

      setLastSavedSnapshot(
        buildChatbotSnapshot({
          name: chatbot.name,
          status: chatbot.status,
          nodes: flowNodes,
          edges: edgesToApply,
        })
      );
      setLastSavedMetaSnapshot(JSON.stringify({ name: chatbot.name, status: chatbot.status }));

      setLastSavedGraphSnapshot(buildGraphSnapshot(flowNodes, edgesToApply));
      setLastSavedEdgesSnapshot(buildEdgesSnapshot(edgesToApply));

      // Fit view (zoomed out) once after loading nodes/edges
      window.setTimeout(() => {
        if (hasFitViewOnLoadRef.current) return;
        const inst = reactFlowInstanceRef.current;
        if (!inst) return;
        inst.fitView({ padding: 0.45, duration: 250, maxZoom: 0.85 });
        hasFitViewOnLoadRef.current = true;
      }, 0);
    }
  }, [chatbot, setNodes, setEdges]);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node<ChatbotNodeData>) => {
    setSelectedNodeId(node.id);
  }, []);

  const onSidebarDragStart = useCallback(
    (event: React.DragEvent, nodeType: ChatbotNodeData["nodeType"]) => {
      event.dataTransfer.setData("application/reactflow", nodeType);
      event.dataTransfer.setData("text/plain", nodeType);
      event.dataTransfer.effectAllowed = "move";
    },
    []
  );

  const onCanvasDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onCanvasDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const nodeType = (
        event.dataTransfer.getData("application/reactflow") ||
        event.dataTransfer.getData("text/plain")
      ) as ChatbotNodeData["nodeType"];
      if (!nodeType) return;

      const inst = reactFlowInstanceRef.current as any;
      const wrapper = reactFlowWrapperRef.current;
      const bounds = wrapper?.getBoundingClientRect();
      const relativePoint = bounds
        ? { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
        : { x: 180, y: 160 };

      const position =
        inst && typeof inst.screenToFlowPosition === "function"
          ? inst.screenToFlowPosition({ x: event.clientX, y: event.clientY })
          : inst && typeof inst.project === "function"
            ? inst.project(relativePoint)
            : relativePoint;

      const newId = `node-${Date.now()}`;
      const newNode: Node<ChatbotNodeData> = {
        id: newId,
        type: nodeType === "trigger" ? "trigger" : "action",
        position,
        data: {
          nodeType,
          ...getDefaultNodeData(nodeType),
        },
      };

      nodeDataBaselineRef.current[newId] = JSON.stringify(newNode.data ?? {});
      setNodes((nds) => [...nds, newNode]);

      setSelectedNodeId(newId);
    },
    [setNodes]
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const status = isPublished ? 'published' : 'draft';
      const chatbotNodes = buildChatbotNodesFromFlow(nodes, edges);
      const triggerNode = chatbotNodes.find((n) => n.nodeType === "trigger");
      const triggerData = triggerNode?.data as any;
      // Support both old format (single triggerSessionId) and new format (array triggerSessionIds)
      const triggerSessionIds = Array.isArray(triggerData?.triggerSessionIds) 
        ? triggerData.triggerSessionIds 
        : (triggerData?.triggerSessionId ? [triggerData.triggerSessionId] : []);
      const triggerSessionId = triggerSessionIds.length > 0 ? triggerSessionIds[0] : null; // Use first for backward compatibility
      const savedSnapshot = buildChatbotSnapshot({
        name: chatbotName,
        status,
        nodes,
        edges,
      });
      const savedGraphSnapshot = buildGraphSnapshot(nodes, edges);

      // Update chatbot
      await apiRequest('PATCH', `/api/chatbots/${chatbotId}`, {
        name: chatbotName,
        status,
        // Also persist the selected trigger phone/session at chatbot level for backend use.
        // Use first session ID for backward compatibility
        sessionId: triggerSessionId,
      });

      // Save nodes
      await apiRequest('POST', `/api/chatbots/${chatbotId}/nodes`, {
        nodes: chatbotNodes.map((node) => ({
          // IMPORTANT: persist node id so connections survive refresh/back
          id: node.id,
          chatbotId, // required by backend schema
          nodeType: node.nodeType,
          position: node.position,
          data: node.data,
          connections: node.connections,
        })),
      });

      return { savedSnapshot, savedGraphSnapshot };
    },
    onSuccess: (data: any) => {
      if (data?.savedSnapshot) {
        setLastSavedSnapshot(data.savedSnapshot);
      }
      if (data?.savedGraphSnapshot) {
        setLastSavedGraphSnapshot(data.savedGraphSnapshot);
      }
      setLastSavedMetaSnapshot(JSON.stringify({ name: chatbotName, status: isPublished ? "published" : "draft" }));
      setLastSavedEdgesSnapshot(buildEdgesSnapshot(edges));

      // After a successful save, reset per-node baselines so Save/Cancel buttons disappear.
      const nextBaseline: Record<string, string> = {};
      nodes.forEach((n: any) => {
        nextBaseline[n.id] = JSON.stringify(n.data ?? {});
      });
      nodeDataBaselineRef.current = nextBaseline;

      // Don't refetch immediately after save: if the backend response is missing `connections`,
      // the editor would rebuild and appear "unlinked". Instead, update cache from current graph.
      queryClient.setQueryData(['/api/chatbots', chatbotId], (prev: any) => {
        const status = isPublished ? 'published' : 'draft';
        const chatbotNodes = buildChatbotNodesFromFlow(nodes, edges);
        return {
          ...(prev || {}),
          id: chatbotId,
          name: chatbotName,
          status,
          nodes: chatbotNodes,
        };
      });
      toast({
        title: "Chatbot saved",
        description: "Your changes have been saved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  // Auto-save ONLY linking/unlinking (edges) immediately on edge changes.
  // It intentionally does NOT auto-save node form edits: if a node is "dirty", we save its baseline data instead.
  const linkSaveMutation = useMutation({
    mutationFn: async (nextEdges?: Edge[]) => {
      const edgesToSave = nextEdges ?? edges;

      const nodesForSave: Node<ChatbotNodeData>[] = nodes.map((n) => {
        const baseline = nodeDataBaselineRef.current[n.id];
        if (!baseline) return n;
        const dirty = JSON.stringify(n.data ?? {}) !== baseline;
        if (!dirty) return n;
        try {
          const parsed = JSON.parse(baseline);
          return { ...n, data: parsed };
        } catch {
          return n;
        }
      });

      const chatbotNodes = buildChatbotNodesFromFlow(nodesForSave, edgesToSave);

      await apiRequest('POST', `/api/chatbots/${chatbotId}/nodes`, {
        nodes: chatbotNodes.map((node) => ({
          id: node.id,
          chatbotId,
          nodeType: node.nodeType,
          position: node.position,
          data: node.data,
          connections: node.connections,
        })),
      });

      return buildEdgesSnapshot(edgesToSave);
    },
    onSuccess: (savedEdgesSnapshot: string) => {
      setLastSavedGraphSnapshot(buildGraphSnapshot(nodes, edges));
      setLastSavedEdgesSnapshot(savedEdgesSnapshot);
      // Keep cache aligned without refetching
      queryClient.setQueryData(['/api/chatbots', chatbotId], (prev: any) => {
        const status = isPublished ? 'published' : 'draft';
        const chatbotNodes = buildChatbotNodesFromFlow(nodes, edges);
        return {
          ...(prev || {}),
          id: chatbotId,
          name: chatbotName,
          status,
          nodes: chatbotNodes,
        };
      });
    },
    onError: () => {
      toast({
        title: "Link not saved",
        description: "Auto-save for linking failed. Please click Save.",
        variant: "destructive",
      });
    },
  });

  const requestLinkSave = useCallback(
    (nextEdges?: Edge[]) => {
      // Skip if nothing changed
      const snap = buildEdgesSnapshot(nextEdges ?? edges);
      if (lastSavedEdgesSnapshot && snap === lastSavedEdgesSnapshot) return;
      if (saveMutation.isPending || linkSaveMutation.isPending) return;
      linkSaveMutation.mutate(nextEdges);
    },
    [edges, lastSavedEdgesSnapshot, saveMutation.isPending, linkSaveMutation]
  );

  const onConnect = useCallback(
    (params: Connection) => {
      if (params.source && params.target) {
        setEdges((eds) => {
          const next = addEdge(
            {
              ...params,
              type: "deletable",
              animated: true,
              zIndex: -1,
            },
            eds
          );
          // Immediately persist links so refresh/back keeps them
          requestLinkSave(next);
          return next;
        });
      }
    },
    [setEdges, requestLinkSave]
  );

  const addNode = (nodeType: ChatbotNodeData['nodeType']) => {
    const NODE_W = 220;
    const NODE_H = 60;
    const GAP_X = 260;
    const GAP_Y = 120;

    const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : undefined;
    const base = selectedNode ? { x: selectedNode.position.x + GAP_X, y: selectedNode.position.y } : { x: 120, y: 120 };

    // avoid placing on top of other nodes
    const isOccupied = (x: number, y: number) =>
      nodes.some((n) => Math.abs((n.position?.x ?? 0) - x) < NODE_W && Math.abs((n.position?.y ?? 0) - y) < NODE_H);

    // Try to keep it near the base and avoid drifting too far down
    const candidates: Array<{ x: number; y: number }> = [
      { x: base.x, y: base.y },
      { x: base.x, y: base.y + GAP_Y },
      { x: base.x, y: base.y - GAP_Y },
      { x: base.x + GAP_X, y: base.y },
      { x: base.x + GAP_X, y: base.y + GAP_Y },
      { x: base.x + GAP_X, y: base.y - GAP_Y },
      { x: base.x, y: base.y + GAP_Y * 2 },
      { x: base.x, y: base.y - GAP_Y * 2 },
    ];

    let x = base.x;
    let y = base.y;
    const pick = candidates.find((c) => !isOccupied(c.x, c.y));
    if (pick) {
      x = pick.x;
      y = pick.y;
    } else {
      // fallback: stack downward from base
      let guard = 0;
      while (isOccupied(x, y) && guard < 50) {
        y += GAP_Y;
        guard += 1;
      }
    }

    const newNode: Node<ChatbotNodeData> = {
      id: `node-${Date.now()}`,
      type: nodeType === 'trigger' ? 'trigger' : 'action',
      position: { x, y },
      data: {
        nodeType,
        ...getDefaultNodeData(nodeType),
      },
    };
    nodeDataBaselineRef.current[newNode.id] = JSON.stringify(newNode.data ?? {});
    setNodes((nds) => [...nds, newNode]);
    setSelectedNodeId(newNode.id);

    // Keep the newly added node centered on screen
    window.setTimeout(() => {
      const inst = reactFlowInstanceRef.current;
      if (!inst) return;
      inst.setCenter(x + NODE_W / 2, y + NODE_H / 2, { zoom: 1, duration: 250 });
    }, 0);
  };

  const getDefaultNodeData = (nodeType: ChatbotNodeData['nodeType']): Record<string, any> => {
    switch (nodeType) {
      case 'trigger':
        return {
          messageType: "text",
          keywords: [],
          fuzzyMatching: true,
          // Selected connected numbers/sessions for this trigger (multiple)
          triggerSessionIds: [] as string[],
          triggerSessionId: "", // Keep for backward compatibility
          triggerPhoneNumberId: "",
          triggerDisplayPhoneNumber: "",
          triggerConnectionType: "",
        };
      case 'send_text':
        return { message: '' };
      case 'send_button':
        return { headerType: 'none', headerText: '', headerUrl: '', body: '', buttons: [{ id: `btn-${Date.now()}`, text: '' }], footer: '' };
      case 'send_list':
        // Keep defaults aligned with the editor (uses `sections` + `buttonText`)
        return {
          headerType: 'none',
          body: '',
          buttonText: 'View Options',
          sections: [{ title: '', rows: [{ id: `row-${Date.now()}`, title: '', description: '' }] }],
          footer: '',
        };
      case 'send_media':
        return { mediaType: 'image', url: '', caption: '' };
      case 'send_cta':
        return { headerType: 'none', body: '', displayText: '', url: '', footer: '', delayBeforeNext: 30 };
      case 'ask_question':
        return {
          message: '',
          responseFormat: 'any',
          validationMessage: '',
          retryCount: 3,
          timeoutValue: 60,
          timeoutUnit: 'seconds',
          timeoutMessage: '',
          continueOnTimeout: false,
        };
      case 'ai_agent':
        return { stopKeywords: [], assistant: '', assistantId: '', timeoutValue: 5, timeoutUnit: 'minutes', welcomeMessage: '', timeoutMessage: '' };
      case 'http':
        return { url: '', method: 'GET', headers: [], params: [], body: '' };
      case 'append_google_sheet':
        return {
          connectionId: '',
          driveId: 'root',
          spreadsheetId: '',
          worksheetId: '',
          row: {} as Record<string, string>,
        };
      case 'delay':
        return { delayType: 'delay_for', delayValue: 1, delayUnit: 'minutes', delayUntilDate: '', delayTimezone: 'Asia/Kolkata', delayWeekday: '1', delayUntilTime: '09:00' };
      case 'condition':
        return { matchType: 'all', conditions: [{ firstValue: '', operator: 'equals', secondValue: '' }], matchSensitivity: 80 };
      case 'send_template':
        return { templateName: '', templateLanguage: 'en', templateParams: [], recipientNumber: '', sessionId: '', isFormTemplate: false };
      case 'send_product':
        return { catalogId: '', productId: '', productRetailerId: '', body: '', footer: '' };
      case 'ask_location':
        return { message: '', buttonText: 'Share Location' };
      case 'update_columns':
        return { columnUpdates: [] };
      case 'update_tag':
        return { tagIds: [], action: 'add' };
      case 'fetch_contact':
        return { contactField: '' };
      case 'stop_chatbot':
        return {};
      default:
        return {};
    }
  };

  const addNodeFromPalette = useCallback(
    (nodeType: ChatbotNodeData["nodeType"]) => {
      const inst = reactFlowInstanceRef.current;
      const wrapper = reactFlowWrapperRef.current;
      const bounds = wrapper?.getBoundingClientRect();
      const center = bounds
        ? { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }
        : { x: 240, y: 180 };

      const position =
        inst && typeof inst.screenToFlowPosition === "function"
          ? inst.screenToFlowPosition(center)
          : { x: 200, y: 200 };

      const newId = `node-${Date.now()}`;
      const newNode: Node<ChatbotNodeData> = {
        id: newId,
        type: nodeType === "trigger" ? "trigger" : "action",
        position,
        data: {
          nodeType,
          ...getDefaultNodeData(nodeType),
        },
      };

      nodeDataBaselineRef.current[newId] = JSON.stringify(newNode.data ?? {});
      setNodes((nds) => [...nds, newNode]);
      setSelectedNodeId(newId);
      setComponentsSheetOpen(false);
    },
    [setNodes]
  );

  const updateNodeData = (nodeId: string, data: Record<string, any>) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
      )
    );
  };

  const deleteNode = (nodeId: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    delete nodeDataBaselineRef.current[nodeId];
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
  };

  const duplicateNode = (nodeId: string) => {
    const source = nodes.find((n) => n.id === nodeId);
    if (!source) return;
    const newId = `node-${Date.now()}`;
    const newNode: Node<ChatbotNodeData> = {
      id: newId,
      type: source.type,
      position: { x: (source.position?.x ?? 0) + 260, y: source.position?.y ?? 0 },
      data: { ...JSON.parse(JSON.stringify(source.data || {})) },
    };
    setNodes((nds) => [...nds, newNode]);
    nodeDataBaselineRef.current[newId] = JSON.stringify(newNode.data ?? {});
    setSelectedNodeId(newId);
    window.setTimeout(() => {
      const inst = reactFlowInstanceRef.current;
      if (inst) inst.setCenter(newNode.position.x + 110, newNode.position.y + 30, { zoom: 1, duration: 250 });
    }, 0);
  };

  const isNodeDirty = useCallback((nodeId: string, data: ChatbotNodeData) => {
    const baseline = nodeDataBaselineRef.current[nodeId];
    if (!baseline) return false;
    return JSON.stringify(data ?? {}) !== baseline;
  }, []);

  const cancelNodeEdits = useCallback(
    (nodeId: string) => {
      const baseline = nodeDataBaselineRef.current[nodeId];
      if (!baseline) return;
      let parsed: any = null;
      try {
        parsed = JSON.parse(baseline);
      } catch {
        return;
      }
      setNodes((nds) => nds.map((n) => (n.id === nodeId ? { ...n, data: parsed } : n)));
    },
    [setNodes]
  );

  // Check for invalid chatbot ID
  if (!chatbotId || chatbotId === 'undefined') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">Invalid chatbot ID</p>
          <Button onClick={() => setLocation('/chatbots')} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Chatbots
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-muted-foreground">Loading chatbot...</div>
      </div>
    );
  }

  if (!chatbot) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">Chatbot not found</p>
          <Button onClick={() => setLocation('/chatbots')} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Chatbots
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rh-chatbot-builder flex flex-1 flex-col min-h-0 overflow-hidden bg-background">
      {/* Header */}
      <div className="rh-chatbot-builder-header border-b bg-card shrink-0">
        <div className="rh-chatbot-builder-header-top">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setLocation('/chatbots')} aria-label="Back to chatbots">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Input
            value={chatbotName}
            onChange={(e) => setChatbotName(e.target.value)}
            className="rh-chatbot-name-input w-48"
            placeholder="Chatbot name"
          />
        </div>
        <div className="rh-chatbot-builder-header-meta px-1 pb-1 md:px-0 md:pb-0">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md border bg-muted/50">
            <Switch
              checked={isPublished}
              onCheckedChange={(checked) => {
                setIsPublished(checked);
                if (chatbotId && chatbotId !== 'undefined') {
                  saveMutation.mutate();
                }
              }}
              id="published"
            />
            <Label htmlFor="published" className="text-sm font-medium cursor-pointer">
              {isPublished ? 'Published' : 'Draft'}
            </Label>
            {isPublished && (
              <Badge variant="default" className="ml-1 text-xs">
                Active
              </Badge>
            )}
          </div>
          {(saveMutation.isPending || isDirty || isMetaDirty) && (
            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              <Save className="w-4 h-4 mr-2" />
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0">
        <ChatbotComponentsSidebar
          className="rh-chatbot-builder-desktop-sidebar w-64 border-r shrink-0"
          componentSearch={componentSearch}
          onComponentSearchChange={setComponentSearch}
          sidebar={sidebar}
          onSidebarDragStart={onSidebarDragStart}
          onAddComponent={addNodeFromPalette}
        />

        <Sheet open={componentsSheetOpen} onOpenChange={setComponentsSheetOpen}>
          <SheetContent side="bottom" className="rh-builder-sheet-content rounded-t-xl p-0">
            <SheetHeader className="px-4 pt-4 pb-2 border-b shrink-0">
              <SheetTitle>Components</SheetTitle>
            </SheetHeader>
            <div className="rh-builder-sheet-body">
              <ChatbotComponentsSidebar
                className="h-full min-h-[50vh]"
                componentSearch={componentSearch}
                onComponentSearchChange={setComponentSearch}
                sidebar={sidebar}
                onSidebarDragStart={onSidebarDragStart}
                onAddComponent={addNodeFromPalette}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* Main Canvas */}
        <div
          className="flex-1 relative min-h-0"
          ref={reactFlowWrapperRef}
          onDragOver={onCanvasDragOver}
          onDrop={onCanvasDrop}
        >
          <div className="rh-builder-mobile-fab">
            <Button type="button" size="sm" className="shadow-md" onClick={() => setComponentsSheetOpen(true)}>
              <Layers className="w-4 h-4 mr-2" />
              Components
            </Button>
          </div>
          {dataSelectorOpen && dataSelectorContext && (
            <DataSelectorPanel
              nodes={nodes}
              edges={edges}
              context={dataSelectorContext}
              onClose={() => {
                setDataSelectorOpen(false);
                setDataSelectorContext(null);
              }}
            />
          )}
          <NodeUiContext.Provider
            value={{
              updateNodeData,
              deleteNode,
              duplicateNode,
              triggerPhoneOptions,
              aiAssistants: aiAssistantsList,
              templateOptions,
              contactColumns: contactColumnsList,
              contactTags: contactTagsList,
              saveAll: () => saveMutation.mutate(),
              isSaving: saveMutation.isPending,
              isNodeDirty,
              cancelNodeEdits,
              requestLinkSave,
              isLinkSaving: linkSaveMutation.isPending,
              openDataSelector: (ctx) => {
                setDataSelectorContext(ctx);
                setDataSelectorOpen(true);
              },
              closeDataSelector: () => {
                setDataSelectorOpen(false);
                setDataSelectorContext(null);
              },
            }}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              onPaneClick={() => setSelectedNodeId(null)}
              onDragOver={onCanvasDragOver}
              onDrop={onCanvasDrop}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              minZoom={0.25}
              maxZoom={1.6}
              defaultViewport={{ x: 0, y: 0, zoom: 0.6 }}
              onInit={(instance) => {
                reactFlowInstanceRef.current = instance;
              }}
              className="h-full w-full bg-background chatbot-flow-canvas"
              defaultEdgeOptions={{ zIndex: -1 }}
            >
              <Background id="dots" gap={20} size={1} />
              <Controls />
              <MiniMap />
            </ReactFlow>
          </NodeUiContext.Provider>
        </div>
      </div>
    </div>
  );
}

// Keyword Tags Input Component
function KeywordTagsInput({ keywords, onChange }: { keywords: string[]; onChange: (keywords: string[]) => void }) {
  const [inputValue, setInputValue] = useState('');

  const addKeyword = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !keywords.includes(trimmed)) {
      onChange([...keywords, trimmed]);
      setInputValue('');
    }
  };

  const removeKeyword = (keyword: string) => {
    onChange(keywords.filter((k) => k !== keyword));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addKeyword();
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {keywords.map((keyword) => (
          <Badge key={keyword} variant="secondary" className="flex items-center gap-1">
            {keyword}
            <button
              onClick={() => removeKeyword(keyword)}
              className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
      </div>
      <Input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add keyword..."
        onBlur={addKeyword}
      />
    </div>
  );
}
