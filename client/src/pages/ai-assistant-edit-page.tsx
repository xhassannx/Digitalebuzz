import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Loader2, Save, Upload, Trash2, FileText, Plus, Pencil } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AiAssistantAgentRulesForm } from "@/components/ai-assistant-agent-rules-form";
import { DEFAULT_AGENT_RULES, parseAgentRules, type AiAssistantAgentRules } from "@shared/ai-agent-rules";
import { useRatehonkPageSkin } from "@/panel-templates/ratehonk-v1/RatehonkSkinContext";

type AiAssistant = {
  id: string;
  name: string;
  promptType: "predefined" | "custom";
  agentRole?: string | null;
  customPrompt?: string | null;
  openaiIntegrationId?: string | null;
  openaiApiKeyOverride?: string | null;
  hasApiKeyOverride?: boolean;
  model: string;
  agentRules?: Record<string, unknown> | null;
  knowledgeFiles?: {
    id: string;
    fileName: string;
    content?: string;
    sizeBytes: number;
    mimeType: string;
    createdAt?: string;
  }[];
};

const AGENT_ROLES = [
  { value: "customer_support", label: "Customer Support Agent", description: "Handles customer inquiries and provides support" },
  { value: "coding", label: "Coding Assistant", description: "Helps with programming and technical questions" },
  { value: "sales", label: "Sales Assistant", description: "Assists with sales inquiries and product information" },
  { value: "general", label: "General Assistant", description: "A versatile assistant for various tasks" },
];

const PREDEFINED_PROMPTS: Record<string, string> = {
  customer_support: `You are a helpful customer support agent. Your role is to:
- Answer customer questions clearly and accurately
- Provide solutions to common problems
- Be polite and professional at all times
- Escalate complex issues when necessary
- Maintain a positive and helpful tone throughout the conversation`,
  coding: `You are a coding assistant. Your role is to:
- Help with programming and technical questions
- Provide clear code examples and explanations
- Suggest best practices and improvements
- Debug and troubleshoot code issues`,
  sales: `You are a sales assistant. Your role is to:
- Assist with sales inquiries and product information
- Provide accurate pricing and availability when known
- Guide customers through the purchase process
- Maintain a professional and helpful tone`,
  general: `You are a versatile general assistant. Your role is to:
- Help with a wide range of tasks and questions
- Provide clear and accurate information
- Be helpful, polite, and professional
- Adapt to the user's needs`,
};

const MODELS = [
  { value: "gpt-4o", label: "GPT-4o", desc: "Most advanced model" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini", desc: "Fast and efficient" },
  { value: "gpt-4-turbo", label: "GPT-4 Turbo", desc: "Enhanced performance" },
  { value: "gpt-4", label: "GPT-4", desc: "Original GPT-4 model" },
  { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo", desc: "Cost-effective option" },
];

const MAX_FILE_SIZE = 1024 * 1024; // 1MB

export default function AiAssistantEditPage() {
  const [, params] = useRoute("/ai-assistants/:id/edit");
  const [, setLocation] = useLocation();
  const id = params?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const skin = useRatehonkPageSkin();
  const [isAtlas, setIsAtlas] = useState(false);
  const primaryBtnClass = skin
    ? "bg-[var(--rh-brand)] hover:bg-[var(--rh-brand-hover)] text-white"
    : "";

  useEffect(() => {
    setIsAtlas(document.documentElement.dataset.panelTemplate === "helicoptic-v1");
  }, []);

  const [name, setName] = useState("");
  const [promptType, setPromptType] = useState<"predefined" | "custom">("predefined");
  const [agentRole, setAgentRole] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [openaiIntegrationId, setOpenaiIntegrationId] = useState<string | "">("");
  const [openaiApiKeyOverride, setOpenaiApiKeyOverride] = useState("");
  const [model, setModel] = useState("gpt-4o");
  const [showApiKey, setShowApiKey] = useState(false);
  const [richTextOpen, setRichTextOpen] = useState(false);
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [kbFileName, setKbFileName] = useState("");
  const [kbContent, setKbContent] = useState("");
  const [agentRules, setAgentRules] = useState<AiAssistantAgentRules>({ ...DEFAULT_AGENT_RULES });
  const [urlImportOpen, setUrlImportOpen] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importUrlName, setImportUrlName] = useState("Web page");

  const { data: assistant, isLoading } = useQuery<AiAssistant>({
    queryKey: ["/api/ai-assistants", id],
    enabled: !!id,
  });

  // Fetch organizations to pass org context for integrations (required for OpenAI connections to show)
  const { data: orgData } = useQuery<{ organizations?: { id: string }[] } | { id: string }[]>({
    queryKey: ["/api/organizations"],
  });
  const organizationsList = Array.isArray(orgData) ? orgData : (orgData?.organizations ?? []);
  const organizationId = organizationsList[0]?.id;

  const { data: integrations = [] } = useQuery<{ id: string; name: string; status: string; config?: Record<string, any>; displayName?: string }[]>({
    queryKey: ["/api/integrations", organizationId],
    queryFn: async () => {
      const url = organizationId
        ? `/api/integrations?organizationId=${encodeURIComponent(organizationId)}`
        : "/api/integrations";
      const res = await apiRequest("GET", url);
      return res.json();
    },
    enabled: true,
  });
  // Show all OpenAI integrations with a valid id (case-insensitive name match)
  const openaiIntegrations = (integrations as any[]).filter(
    (i: any) => i?.name?.toLowerCase() === "openai" && i.id
  );
  const calendarIntegrations = (integrations as any[]).map((i: any) => ({
    id: i.id,
    label: i.config?.connectionName || i.displayName || i.name,
    provider: i.name,
  }));

  const knowledgeFiles = assistant?.knowledgeFiles ?? [];
  const refetchAssistant = () => queryClient.invalidateQueries({ queryKey: ["/api/ai-assistants", id] });

  useEffect(() => {
    if (!assistant) return;
    setName(assistant.name);
    setPromptType(assistant.promptType || "predefined");
    setAgentRole(assistant.agentRole || "");
    setCustomPrompt(
      assistant.customPrompt ||
        PREDEFINED_PROMPTS[assistant.agentRole || ""] ||
        PREDEFINED_PROMPTS.customer_support
    );
    setOpenaiIntegrationId(assistant.openaiIntegrationId || "");
    setModel(assistant.model || "gpt-4o");
    setAgentRules(parseAgentRules(assistant.agentRules));
  }, [assistant?.id]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", `/api/ai-assistants/${id}`, {
        name: name.trim(),
        promptType,
        agentRole: agentRole || null,
        customPrompt: customPrompt.trim() || null,
        openaiIntegrationId: openaiIntegrationId || null,
        openaiApiKeyOverride: openaiApiKeyOverride.trim() || null,
        model,
        agentRules,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-assistants", id] });
      toast({ title: "Saved", description: "AI Assistant settings updated." });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/ai-assistants/${id}/knowledge-files`, {
        method: "POST",
        body: form,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || res.statusText);
      }
      return res.json();
    },
    onSuccess: () => {
      refetchAssistant();
      toast({ title: "File uploaded", description: "Knowledge base file added." });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Upload failed", description: error.message });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      await apiRequest("DELETE", `/api/ai-assistants/${id}/knowledge-files/${fileId}`);
    },
    onSuccess: () => {
      refetchAssistant();
      toast({ title: "Entry removed" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const saveRichTextMutation = useMutation({
    mutationFn: async () => {
      const payload = { fileName: kbFileName.trim(), content: kbContent };
      if (editingFileId) {
        const res = await apiRequest("PUT", `/api/ai-assistants/${id}/knowledge-files/${editingFileId}`, payload);
        return res.json();
      }
      const res = await apiRequest("POST", `/api/ai-assistants/${id}/knowledge-files/rich-text`, payload);
      return res.json();
    },
    onSuccess: () => {
      const wasEdit = !!editingFileId;
      refetchAssistant();
      setRichTextOpen(false);
      setEditingFileId(null);
      setKbFileName("");
      setKbContent("");
      toast({
        title: wasEdit ? "Knowledge base updated" : "Knowledge base created",
        description: "Active chats will use the new content on the next message.",
      });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Save failed", description: error.message });
    },
  });

  const openCreateRichText = () => {
    setEditingFileId(null);
    setKbFileName("Knowledge base");
    setKbContent("");
    setRichTextOpen(true);
  };

  const openEditRichText = (file: NonNullable<AiAssistant["knowledgeFiles"]>[number]) => {
    setEditingFileId(file.id);
    setKbFileName(file.fileName);
    setKbContent(file.content || "");
    setRichTextOpen(true);
  };

  const formatKbDate = (value?: string) => {
    if (!value) return "—";
    try {
      return new Date(value).toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return "—";
    }
  };

  const kbCharCount = kbContent.length;
  const kbSizeKb = new TextEncoder().encode(kbContent).length / 1024;

  const importUrlMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/ai-assistants/${id}/knowledge-files/from-url`, {
        url: importUrl.trim(),
        fileName: importUrlName.trim() || "Web page",
      });
      return res.json();
    },
    onSuccess: () => {
      refetchAssistant();
      setUrlImportOpen(false);
      setImportUrl("");
      toast({ title: "URL imported", description: "Web page added to knowledge base." });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Import failed", description: error.message });
    },
  });

  const applyDefaults = () => {
    setAgentRules({
      ...DEFAULT_AGENT_RULES,
      workingHours: {
        ...DEFAULT_AGENT_RULES.workingHours,
        enabled: true,
        timezone: "Asia/Kolkata",
        startTime: "11:00",
        endTime: "19:00",
        weekdays: [1, 2, 3, 4, 5],
      },
      followUp: {
        ...DEFAULT_AGENT_RULES.followUp,
        enabled: true,
        delayHours: 1,
        message:
          "We noticed that you have not booked or confirmed the meeting yet. Kindly book the meeting and confirm the status.",
      },
      useKnowledgeSearch: true,
      memoryTurns: 10,
      calendar: { ...DEFAULT_AGENT_RULES.calendar, enabled: false, provider: "google-calendar" },
    });
    toast({ title: "Defaults applied", description: "Review Agent Rules and connect Google Calendar or Calendly." });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.toLowerCase().split(".").pop();
    if (!["txt", "md", "pdf"].includes(ext || "")) {
      toast({ variant: "destructive", title: "Invalid file", description: "Only .txt, .md, and .pdf files are allowed." });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast({ variant: "destructive", title: "File too large", description: "File must be 1MB or smaller." });
      return;
    }
    uploadMutation.mutate(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().match(/\.(txt|md|pdf)$/)) {
        toast({ variant: "destructive", title: "Invalid file", description: "Only .txt, .md, and .pdf files are allowed." });
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast({ variant: "destructive", title: "File too large", description: "File must be 1MB or smaller." });
        return;
      }
      uploadMutation.mutate(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  if (!id) {
    setLocation("/ai-assistants");
    return null;
  }

  if (isLoading || !assistant) {
    return (
      <div
        className={cn(
          "flex min-h-[300px] items-center justify-center",
          skin ? "p-4 sm:p-6 md:p-8" : "container mx-auto p-6",
          isAtlas && "rh-ai-assistant-atlas",
        )}
      >
        <Loader2
          className={cn(
            "h-8 w-8 animate-spin",
            isAtlas ? "text-[var(--rh-brand,#047857)]" : "text-primary",
          )}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "space-y-6",
        skin ? "p-4 sm:p-6 md:p-8" : "container mx-auto p-6",
        isAtlas && "rh-ai-assistant-atlas",
      )}
      data-testid="page-ai-assistant-edit"
    >
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/ai-assistants")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <p className="text-sm text-muted-foreground">Dashboard &gt; AI Assistant &gt; Edit</p>
          <h1 className="text-2xl font-bold">Edit AI Assistant</h1>
        </div>
      </div>

      <Tabs defaultValue="settings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
          <TabsTrigger value="rules">Agent Rules</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Give your AI assistant a name and basic configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Assistant Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Support Bot" className="mt-2" />
                <p className="text-xs text-muted-foreground mt-1">Choose a descriptive name for your AI assistant</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Prompt Configuration</CardTitle>
              <CardDescription>Choose between predefined prompts or create your own custom prompt</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 p-1 rounded-lg bg-muted">
                <Button
                  type="button"
                  variant={promptType === "predefined" ? "secondary" : "ghost"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setPromptType("predefined")}
                >
                  Predefined Prompts
                </Button>
                <Button
                  type="button"
                  variant={promptType === "custom" ? "secondary" : "ghost"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setPromptType("custom")}
                >
                  Custom Prompt
                </Button>
              </div>
              {promptType === "predefined" && (
                <div>
                  <Label>Select Agent Role</Label>
                  <div className="grid gap-2 mt-2">
                    {AGENT_ROLES.map((r) => (
                      <div
                        key={r.value}
                        onClick={() => {
                          setAgentRole(r.value);
                          setCustomPrompt(PREDEFINED_PROMPTS[r.value]);
                        }}
                        className={`p-3 rounded-lg border cursor-pointer ${agentRole === r.value ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                      >
                        <div className="font-medium">{r.label}</div>
                        <div className="text-sm text-muted-foreground">{r.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <Label>Customize Prompt</Label>
                <Textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="You are a helpful assistant..."
                  rows={10}
                  className="mt-2 font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {promptType === "predefined"
                    ? "Start with a predefined prompt and customize it to fit your specific needs"
                    : "Enter your full system prompt. You can paste content from a .txt file (e.g. rules, FAQs, pricing)."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI Configuration</CardTitle>
              <CardDescription>Select your AI provider and model preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>AI Provider</Label>
                <p className="text-sm text-muted-foreground mt-1">OpenAI (use a connection from Integrations or enter API key below)</p>
              </div>
              <div>
                <Label>Use OpenAI connection (optional)</Label>
                <select
                  value={openaiIntegrationId}
                  onChange={(e) => setOpenaiIntegrationId(e.target.value)}
                  className="w-full mt-2 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">— None (use API key below) —</option>
                  {openaiIntegrations.map((int: any) => (
                    <option key={int.id} value={int.id}>
                      {int.config?.connectionName || int.displayName || "OpenAI"}
                      {int.status !== "connected" ? " (not connected)" : ""}
                    </option>
                  ))}
                </select>
                {openaiIntegrations.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    No OpenAI connections yet. Add one from <strong>Integrations → OpenAI Connections</strong>, or enter an API key below.
                  </p>
                )}
              </div>
              <div>
                <Label>API Key {!openaiIntegrationId ? "*" : "(optional override)"}</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    type={showApiKey ? "text" : "password"}
                    value={openaiApiKeyOverride}
                    onChange={(e) => setOpenaiApiKeyOverride(e.target.value)}
                    placeholder={
                      openaiIntegrationId
                        ? `Using ${openaiIntegrations.find((i: any) => i.id === openaiIntegrationId)?.config?.connectionName || openaiIntegrations.find((i: any) => i.id === openaiIntegrationId)?.displayName || "connection"}'s API key (leave blank)`
                        : assistant?.hasApiKeyOverride && !openaiApiKeyOverride
                          ? "•••••••• (API key configured)"
                          : "sk-... (required if no connection selected)"
                    }
                  />
                  <Button type="button" variant="outline" size="icon" onClick={() => setShowApiKey(!showApiKey)}>
                    {showApiKey ? "Hide" : "Show"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {!openaiIntegrationId
                    ? "Enter your OpenAI API key and click Save Assistant. The chatbot will not reply to AI questions until a key or connection is set."
                    : "Leave blank to use the selected connection's API key, or enter an override."}
                </p>
              </div>
              <div>
                <Label>Model</Label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full mt-2 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {MODELS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label} — {m.desc}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          <Button
            className={cn(primaryBtnClass, isAtlas && "rh-ai-primary-btn rounded-xl")}
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Assistant
          </Button>
        </TabsContent>

        <TabsContent value="knowledge" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle>Knowledge Base</CardTitle>
                <CardDescription>
                  Create and manage knowledge for your AI assistant. Rich text and .txt files are included in every AI reply.
                  Tip: edit an existing entry instead of adding a second copy — multiple entries are all searched together.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Button
                  type="button"
                  className={cn(primaryBtnClass, isAtlas && "rh-ai-primary-btn rounded-xl")}
                  onClick={() => openCreateRichText()}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add rich text
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.pdf"
                className="hidden"
                onChange={handleFileSelect}
              />
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-medium">Or upload .txt, .md, or .pdf (up to 1MB)</p>
                <div className="flex justify-center gap-2 mt-3">
                  <Button type="button" variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setUrlImportOpen(true); }}>
                    Import from URL
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Click to upload or drag and drop</p>
              </div>

              {knowledgeFiles.length === 0 ? (
                isAtlas ? (
                  <div className="rh-ai-empty">
                    <div className="rh-ai-empty-icon">
                      <FileText className="h-6 w-6" />
                    </div>
                    <p className="rh-ai-empty-title">No knowledge entries yet</p>
                    <p className="rh-ai-empty-desc">
                      Add rich text or upload a .txt file so your assistant can answer from your content.
                    </p>
                    <Button
                      type="button"
                      className={cn(primaryBtnClass, "rh-ai-primary-btn rounded-xl")}
                      onClick={() => openCreateRichText()}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add rich text
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No knowledge entries yet. Add rich text or upload a .txt file to get started.
                  </p>
                )
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {knowledgeFiles.map((f) => (
                        <TableRow key={f.id}>
                          <TableCell className="font-medium">{f.fileName}</TableCell>
                          <TableCell>{f.mimeType === "text/rich" ? "Rich text" : "File"}</TableCell>
                          <TableCell>{(f.sizeBytes / 1024).toFixed(1)} KB</TableCell>
                          <TableCell>{formatKbDate(f.createdAt)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {f.mimeType === "text/rich" || f.content != null ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Edit"
                                  onClick={() => openEditRichText(f)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              ) : null}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:bg-destructive/10"
                                title="Delete"
                                onClick={() => deleteFileMutation.mutate(f.id)}
                                disabled={deleteFileMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog open={richTextOpen} onOpenChange={setRichTextOpen}>
            <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>{editingFileId ? "Edit rich text" : "Add rich text"}</DialogTitle>
                <DialogDescription>
                  Add detailed instructions, greeting flows, service details, and rules for your AI assistant.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 overflow-y-auto flex-1 pr-1">
                <div>
                  <Label htmlFor="kb-file-name">File name *</Label>
                  <Input
                    id="kb-file-name"
                    value={kbFileName}
                    onChange={(e) => setKbFileName(e.target.value)}
                    placeholder="e.g. Product knowledge base"
                    className="mt-2"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="kb-content">Content *</Label>
                    <span className="text-xs text-muted-foreground">
                      {kbCharCount.toLocaleString()} chars · {kbSizeKb.toFixed(1)} KB / 1024 KB max
                    </span>
                  </div>
                  <Textarea
                    id="kb-content"
                    value={kbContent}
                    onChange={(e) => setKbContent(e.target.value)}
                    placeholder="Paste your greeting message, service details, booking rules, FAQs..."
                    rows={22}
                    className="mt-2 font-mono text-sm leading-relaxed"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Tip: Include greeting scripts, service descriptions, booking links, working hours, and follow-up rules.
                    All content here is sent to the AI as context when it replies in a chatbot flow.
                  </p>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setRichTextOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  className={cn(primaryBtnClass, isAtlas && "rh-ai-primary-btn rounded-xl")}
                  onClick={() => saveRichTextMutation.mutate()}
                  disabled={saveRichTextMutation.isPending || !kbFileName.trim() || !kbContent.trim() || kbSizeKb > 1024}
                >
                  {saveRichTextMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="rules" className="space-y-6">
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={applyDefaults}>
              Apply defaults
            </Button>
          </div>
          <AiAssistantAgentRulesForm
            rules={agentRules}
            onChange={setAgentRules}
            calendarIntegrations={calendarIntegrations}
          />
          <Button
            className={cn(primaryBtnClass, isAtlas && "rh-ai-primary-btn rounded-xl")}
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Agent Rules
          </Button>
        </TabsContent>

        <Dialog open={urlImportOpen} onOpenChange={setUrlImportOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import from URL</DialogTitle>
              <DialogDescription>Fetch a web page and add its text to the knowledge base.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>URL</Label>
                <Input className="mt-2" value={importUrl} onChange={(e) => setImportUrl(e.target.value)} placeholder="https://example.com" />
              </div>
              <div>
                <Label>Name</Label>
                <Input className="mt-2" value={importUrlName} onChange={(e) => setImportUrlName(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUrlImportOpen(false)}>Cancel</Button>
              <Button
                className={cn(primaryBtnClass, isAtlas && "rh-ai-primary-btn rounded-xl")}
                onClick={() => importUrlMutation.mutate()}
                disabled={importUrlMutation.isPending || !importUrl.trim()}
              >
                {importUrlMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Import
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Tabs>
    </div>
  );
}
