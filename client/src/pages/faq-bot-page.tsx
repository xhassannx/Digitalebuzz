import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bot,
  Plus,
  Edit,
  Trash2,
  Search,
  MessageSquare,
  Settings,
  CheckCircle2,
  XCircle,
  Save,
  Loader2,
  ImageIcon,
  Video,
  FileText,
  Music,
  FolderOpen,
  Upload,
} from "lucide-react";
import { uploadGalleryFiles } from "@/lib/upload-gallery-files";
import { formatPanelUploadMaxMb } from "@shared/panel-upload-limits";
import type { FaqAnswerType } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useRatehonkPageSkin } from "@/panel-templates/ratehonk-v1/RatehonkSkinContext";
import { RhSearchField, RhSegmentedTabs } from "@/panel-templates/ratehonk-v1/components/rh";
import { cn } from "@/lib/utils";

type FaqAnswerType = "text" | "image" | "video" | "document";

type FAQItem = {
  id: string;
  question: string;
  answer: string;
  answerType?: FaqAnswerType | string;
  mediaUrl?: string | null;
  mediaFileName?: string | null;
  keywords: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

const FAQ_ANSWER_TYPE_OPTIONS: { value: FaqAnswerType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "image", label: "Image" },
  { value: "video", label: "Video" },
  { value: "document", label: "Document" },
  { value: "audio", label: "Audio" },
];

function faqAnswerTypeLabel(type?: string): string {
  return FAQ_ANSWER_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? "Text";
}

function galleryTypeForAnswer(type: FaqAnswerType): string {
  if (type === "image" || type === "video" || type === "document" || type === "audio") return type;
  return "all";
}

type FAQBotSettings = {
  enabled: boolean;
  welcomeMessage: string;
  fallbackMessage: string;
  autoReply: boolean;
};

function buildFaqUrl(path: string, organizationId: string | undefined): string {
  const base = path.startsWith("/") ? path : `/api/faq${path ? `/${path}` : ""}`;
  if (!organizationId) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}organizationId=${encodeURIComponent(organizationId)}`;
}

const FAQ_TABS = [
  { value: "faqs", label: "FAQs" },
  { value: "settings", label: "Settings" },
] as const;

const ANSWER_TYPE_TABS: { value: FaqAnswerType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "image", label: "Image" },
  { value: "video", label: "Video" },
  { value: "document", label: "Document" },
];

function answerTypeLabel(type?: string | null) {
  const t = (type || "text").toLowerCase();
  if (t === "image") return "Image";
  if (t === "video") return "Video";
  if (t === "document") return "Document";
  return "Text";
}

function faqAnswerPreview(item: FAQItem) {
  const type = (item.answerType || "text").toLowerCase();
  if (type === "text") return item.answer;
  const cap = item.caption?.trim();
  const file = item.answer.split("/").pop() || "Media file";
  return cap ? `${answerTypeLabel(type)}: ${cap}` : `${answerTypeLabel(type)}: ${file}`;
}

async function uploadFaqMedia(
  file: File,
  answerType: FaqAnswerType,
  organizationId: string | undefined,
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const url = buildFaqUrl(`upload?type=${encodeURIComponent(answerType)}`, organizationId);
  const res = await fetch(url, {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || "Upload failed");
  return data.url as string;
}

export default function FAQBotPage() {
  const skin = useRatehonkPageSkin();
  const primaryBtnClass = skin
    ? "bg-[var(--rh-brand)] hover:bg-[var(--rh-brand-hover)] text-white"
    : "";
  const [isAtlas, setIsAtlas] = useState(false);
  useEffect(() => {
    if (typeof document !== "undefined") {
      setIsAtlas(document.documentElement.dataset.panelTemplate === "helicoptic-v1");
    }
  }, []);
  const { toast } = useToast();
  const [faqTab, setFaqTab] = useState<"faqs" | "settings">("faqs");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "drafts">("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFAQ, setEditingFAQ] = useState<FAQItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [answerType, setAnswerType] = useState<FaqAnswerType>("text");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaFileName, setMediaFileName] = useState("");
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const mediaFileInputRef = useRef<HTMLInputElement>(null);
  const [keywords, setKeywords] = useState("");
  const [settingsForm, setSettingsForm] = useState<FAQBotSettings>({
    enabled: false,
    welcomeMessage: "Hello! How can I help you today?",
    fallbackMessage: "I'm sorry, I don't have an answer for that. Please contact support.",
    autoReply: true,
  });

  const { data: orgData } = useQuery<{ organizations?: { id: string }[] }>({
    queryKey: ["/api/organizations"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/organizations");
      return res.json();
    },
  });
  const organizationsList = Array.isArray(orgData) ? orgData : (orgData?.organizations ?? []);
  const organizationId = organizationsList[0]?.id;

  // Fetch FAQ items (org-scoped)
  const { data: faqItems = [], isLoading } = useQuery<FAQItem[]>({
    queryKey: ["/api/faq", organizationId],
    queryFn: async () => {
      const res = await apiRequest("GET", buildFaqUrl("", organizationId));
      return res.json();
    },
    enabled: !!organizationId,
  });

  // Fetch FAQ Bot settings (org-scoped)
  const { data: botSettings } = useQuery<FAQBotSettings>({
    queryKey: ["/api/faq/settings", organizationId],
    queryFn: async () => {
      const res = await apiRequest("GET", buildFaqUrl("settings", organizationId));
      return res.json();
    },
    enabled: !!organizationId,
  });

  useEffect(() => {
    if (!botSettings) return;
    setSettingsForm({
      enabled: botSettings.enabled,
      welcomeMessage: botSettings.welcomeMessage || "",
      fallbackMessage: botSettings.fallbackMessage || "",
      autoReply: botSettings.autoReply !== false,
    });
  }, [botSettings?.enabled, botSettings?.welcomeMessage, botSettings?.fallbackMessage, botSettings?.autoReply]);

  const saveSettingsMutation = useMutation({
    mutationFn: async (data: FAQBotSettings) => {
      const res = await apiRequest("PATCH", buildFaqUrl("settings", organizationId), data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/faq/settings", organizationId] });
      toast({ title: "Settings saved", description: "FAQ Bot configuration updated." });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to save settings" });
    },
  });

  const { data: galleryItems = [] } = useQuery<Array<{ id: string; url: string; name: string; type: string }>>({
    queryKey: ["/api/gallery", galleryTypeForAnswer(answerType)],
    queryFn: async () => {
      const type = galleryTypeForAnswer(answerType);
      const res = await apiRequest("GET", `/api/gallery?type=${type}`);
      return res.json();
    },
    enabled: galleryOpen && answerType !== "text",
  });

  const filteredFAQs = faqItems.filter((item) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      item.question.toLowerCase().includes(q) ||
      item.answer.toLowerCase().includes(q) ||
      item.keywords.some((keyword) => keyword.toLowerCase().includes(q));
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" ? item.isActive : !item.isActive);
    return matchesSearch && matchesStatus;
  });

  const createMutation = useMutation({
    mutationFn: async (data: {
      question: string;
      answer: string;
      answerType: FaqAnswerType;
      mediaUrl?: string;
      mediaFileName?: string;
      keywords: string[];
    }) => {
      const res = await apiRequest("POST", buildFaqUrl("", organizationId), data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/faq", organizationId] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "FAQ added",
        description: "The FAQ item has been successfully added.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add FAQ item",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: {
        question: string;
        answer: string;
        answerType: FaqAnswerType;
        mediaUrl?: string;
        mediaFileName?: string;
        keywords: string[];
        isActive?: boolean;
      };
    }) => {
      const res = await apiRequest("PUT", buildFaqUrl(id, organizationId), data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/faq", organizationId] });
      setIsDialogOpen(false);
      setEditingFAQ(null);
      resetForm();
      toast({
        title: "FAQ updated",
        description: "The FAQ item has been successfully updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update FAQ item",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", buildFaqUrl(id, organizationId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/faq", organizationId] });
      setDeleteConfirmId(null);
      toast({
        title: "FAQ deleted",
        description: "The FAQ item has been successfully deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete FAQ item",
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await apiRequest("PATCH", buildFaqUrl(id, organizationId), { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/faq", organizationId] });
    },
  });

  const resetForm = () => {
    setQuestion("");
    setAnswer("");
    setAnswerType("text");
    setMediaUrl("");
    setMediaFileName("");
    setKeywords("");
  };

  const handleEdit = (item: FAQItem) => {
    setEditingFAQ(item);
    setQuestion(item.question);
    setAnswer(item.answer);
    setAnswerType((item.answerType as FaqAnswerType) || "text");
    setMediaUrl(item.mediaUrl || "");
    setMediaFileName(item.mediaFileName || "");
    setKeywords(item.keywords.join(", "));
    setIsDialogOpen(true);
  };

  const handleMediaFileSelect = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploadingMedia(true);
    try {
      const result = await uploadGalleryFiles(files, { toast, queryClient });
      if (result.uploaded > 0) {
        const type = galleryTypeForAnswer(answerType);
        const res = await apiRequest("GET", `/api/gallery?type=${type}`);
        const items: Array<{ url: string; name: string }> = await res.json();
        const latest = items[0];
        if (latest?.url) {
          setMediaUrl(latest.url);
          if (!mediaFileName.trim()) setMediaFileName(latest.name || "");
        }
      }
    } finally {
      setUploadingMedia(false);
    }
  };

  const isFormValid = () => {
    if (!question.trim()) return false;
    if (answerType === "text") return !!answer.trim();
    return !!mediaUrl.trim();
  };

  const handleSubmit = () => {
    const keywordsArray = keywords
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    const payload = {
      question: question.trim(),
      answer: answer.trim(),
      answerType,
      mediaUrl: answerType === "text" ? undefined : mediaUrl.trim(),
      mediaFileName: answerType === "text" ? undefined : mediaFileName.trim() || undefined,
      keywords: keywordsArray,
    };

    if (!isFormValid()) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description:
          answerType === "text"
            ? "Question and answer text are required."
            : "Question and media file are required.",
      });
      return;
    }

    if (editingFAQ) {
      updateMutation.mutate({
        id: editingFAQ.id,
        data: payload,
      });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className={cn(skin ? "space-y-6" : "container mx-auto p-6 space-y-6")}>
      <div className="flex items-center justify-between gap-4">
        <div className={cn("flex items-center gap-2 faq-bot-page-chrome")}>
          <Bot className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">FAQ Bot</h1>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              className={primaryBtnClass}
              onClick={() => {
                resetForm();
                setEditingFAQ(null);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add FAQ
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingFAQ ? "Edit FAQ" : "Add New FAQ"}</DialogTitle>
              <DialogDescription>
                Create a FAQ the bot can reply with text, image, video, document, or audio.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="question">Question</Label>
                <Input
                  id="question"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Enter the question..."
                />
              </div>
              <div>
                <Label htmlFor="answer-type">Answer Type</Label>
                <Select
                  value={answerType}
                  onValueChange={(v) => {
                    const next = v as FaqAnswerType;
                    setAnswerType(next);
                    if (next === "text") {
                      setMediaUrl("");
                      setMediaFileName("");
                    }
                  }}
                >
                  <SelectTrigger id="answer-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FAQ_ANSWER_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {answerType === "text" ? (
                <div>
                  <Label htmlFor="answer">Answer</Label>
                  <Textarea
                    id="answer"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Enter the text answer..."
                    rows={4}
                  />
                </div>
              ) : (
                <>
                  <div>
                    <Label htmlFor="media-url">Media URL</Label>
                    <Input
                      id="media-url"
                      value={mediaUrl}
                      onChange={(e) => setMediaUrl(e.target.value)}
                      placeholder="/uploads/... or https://..."
                    />
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setGalleryOpen(true)}
                      >
                        <FolderOpen className="h-4 w-4 mr-2" />
                        Pick from Gallery
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploadingMedia}
                        onClick={() => mediaFileInputRef.current?.click()}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {uploadingMedia ? "Uploading…" : "Upload File"}
                      </Button>
                      <input
                        ref={mediaFileInputRef}
                        type="file"
                        className="hidden"
                        accept={
                          answerType === "image"
                            ? "image/*"
                            : answerType === "video"
                              ? "video/*"
                              : answerType === "audio"
                                ? "audio/*"
                                : undefined
                        }
                        onChange={(e) => {
                          void handleMediaFileSelect(e.target.files);
                          e.target.value = "";
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Max size depends on type (e.g. image ~{formatPanelUploadMaxMb("image")}MB). Use gallery for best results.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="media-file-name">File name (optional)</Label>
                    <Input
                      id="media-file-name"
                      value={mediaFileName}
                      onChange={(e) => setMediaFileName(e.target.value)}
                      placeholder="Display name when customer downloads"
                    />
                  </div>
                  <div>
                    <Label htmlFor="caption">Caption (optional)</Label>
                    <Textarea
                      id="caption"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="Caption sent with image, video, or document"
                      rows={3}
                    />
                  </div>
                  {mediaUrl && answerType === "image" && (
                    <img
                      src={mediaUrl}
                      alt="Preview"
                      className="max-h-40 rounded border object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  )}
                </>
              )}
              <div>
                <Label htmlFor="keywords">Keywords (comma-separated)</Label>
                <Input
                  id="keywords"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="keyword1, keyword2, keyword3"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Keywords help the bot match user questions to this FAQ
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!isFormValid() || createMutation.isPending || updateMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                {editingFAQ ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isAtlas ? (
        <div className="rh-faq-atlas-tabs" role="tablist">
          {FAQ_TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={faqTab === t.value}
              onClick={() => setFaqTab(t.value)}
              className={cn("rh-faq-atlas-tab", faqTab === t.value && "is-active")}
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : skin ? (
        <RhSegmentedTabs
          value={faqTab}
          onChange={setFaqTab}
          options={[...FAQ_TABS]}
          className="max-w-xs"
        />
      ) : null}

      <Tabs
        value={faqTab}
        onValueChange={(v) => setFaqTab(v as "faqs" | "settings")}
        className="w-full"
      >
        {!skin && (
          <TabsList>
            <TabsTrigger value="faqs">FAQs</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
        )}

        <TabsContent value="faqs" className="space-y-4">
          {isAtlas ? (
            <div className="rh-faq-atlas-toolbar">
              <RhSearchField
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search FAQs by keyword…"
                className="min-w-0 flex-1"
              />
              <div className="rh-faq-atlas-filters" role="group" aria-label="Filter FAQs">
                {([
                  { value: "all", label: "All" },
                  { value: "active", label: "Active" },
                  { value: "drafts", label: "Drafts" },
                ] as const).map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setStatusFilter(f.value)}
                    className={cn(
                      "rh-faq-atlas-filter",
                      statusFilter === f.value && "is-active",
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          ) : skin ? (
            <RhSearchField
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search FAQs…"
              className="max-w-xl"
            />
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
              <Input
                placeholder="Search FAQs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          )}

          {/* FAQ List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-4">
                <div
                  className={cn(
                    "mx-auto h-16 w-16 animate-spin rounded-full border-4 border-t-transparent",
                    skin ? "border-[var(--rh-brand)]" : "border-primary",
                  )}
                />
                <p className="text-muted-foreground">Loading FAQs...</p>
              </div>
            </div>
          ) : filteredFAQs.length === 0 ? (
            isAtlas ? (
              <div className="rh-faq-empty">
                <div className="rh-faq-empty-icon">
                  <MessageSquare className="h-7 w-7" />
                </div>
                <h3 className="rh-faq-empty-title">No FAQs found</h3>
                <p className="rh-faq-empty-desc">
                  {searchQuery || statusFilter !== "all"
                    ? "Try adjusting your search or filters to find what you're looking for."
                    : "You haven't created any FAQs for your bot yet. Build a knowledge base to help your customers get instant answers to common questions."}
                </p>
                {!searchQuery && statusFilter === "all" && (
                  <Button
                    className={cn("rh-faq-empty-cta", primaryBtnClass)}
                    onClick={() => setIsDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create your first FAQ
                  </Button>
                )}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <MessageSquare className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No FAQs found</h3>
                  <p className="text-muted-foreground mb-4">
                    {searchQuery
                      ? "Try adjusting your search terms"
                      : "Create your first FAQ to get started"}
                  </p>
                  {!searchQuery && (
                    <Button className={primaryBtnClass} onClick={() => setIsDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add FAQ
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          ) : (
            <div className="space-y-4">
              {filteredFAQs.map((item) => (
                <Card key={item.id} className={cn(skin && "rh-panel-card")}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-lg">{item.question}</CardTitle>
                          <Badge variant="secondary" className="text-xs">
                            {faqAnswerTypeLabel(item.answerType)}
                          </Badge>
                        </div>
                        <CardDescription className="mt-2">
                          {item.answerType && item.answerType !== "text" ? (
                            <span className="flex flex-col gap-2">
                              {item.mediaUrl && (
                                <span className="text-xs font-mono break-all">{item.mediaUrl}</span>
                              )}
                              {item.answer ? <span>{item.answer}</span> : null}
                            </span>
                          ) : (
                            item.answer
                          )}
                        </CardDescription>
                        {item.answerType === "image" && item.mediaUrl && (
                          <img
                            src={item.mediaUrl}
                            alt=""
                            className="mt-2 max-h-24 rounded border object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={item.isActive ? "default" : "secondary"}>
                          {item.isActive ? (
                            <>
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Active
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3 w-3 mr-1" />
                              Inactive
                            </>
                          )}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-wrap gap-2">
                        {item.keywords.map((keyword, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleActiveMutation.mutate({ id: item.id, isActive: !item.isActive })}
                        >
                          {item.isActive ? "Deactivate" : "Activate"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleEdit(item)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeleteConfirmId(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bot Configuration</CardTitle>
              <CardDescription>Configure how the FAQ bot responds to customers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable FAQ Bot</Label>
                  <p className="text-sm text-muted-foreground">
                    Turn on automatic FAQ responses for incoming messages
                  </p>
                </div>
                <Switch
                  checked={settingsForm.enabled}
                  onCheckedChange={(v) => setSettingsForm((s) => ({ ...s, enabled: v }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="welcome-message">Welcome Message</Label>
                <Textarea
                  id="welcome-message"
                  value={settingsForm.welcomeMessage}
                  onChange={(e) => setSettingsForm((s) => ({ ...s, welcomeMessage: e.target.value }))}
                  placeholder="Hello! How can I help you today?"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Sent on the customer&apos;s first message when FAQ Bot handles the reply
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fallback-message">Fallback Message</Label>
                <Textarea
                  id="fallback-message"
                  value={settingsForm.fallbackMessage}
                  onChange={(e) => setSettingsForm((s) => ({ ...s, fallbackMessage: e.target.value }))}
                  placeholder="I'm sorry, I don't have an answer for that. Please contact support."
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Sent when no FAQ keyword or question matches the customer message
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto Reply</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically reply to messages without manual intervention
                  </p>
                </div>
                <Switch
                  checked={settingsForm.autoReply}
                  onCheckedChange={(v) => setSettingsForm((s) => ({ ...s, autoReply: v }))}
                />
              </div>

              <Button
                className={primaryBtnClass}
                onClick={() => saveSettingsMutation.mutate(settingsForm)}
                disabled={saveSettingsMutation.isPending}
              >
                {saveSettingsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the FAQ item.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Choose from Gallery</DialogTitle>
            <DialogDescription>Select a {faqAnswerTypeLabel(answerType).toLowerCase()} file for this FAQ.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            {galleryItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No files in gallery. Upload from Gallery page first.</p>
            ) : (
              galleryItems.map((file) => (
                <button
                  key={file.id}
                  type="button"
                  className="flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted/50"
                  onClick={() => {
                    setMediaUrl(file.url);
                    setMediaFileName(file.name);
                    setGalleryOpen(false);
                  }}
                >
                  {file.type === "image" ? (
                    <ImageIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
                  ) : file.type === "video" ? (
                    <Video className="h-5 w-5 shrink-0 text-muted-foreground" />
                  ) : file.type === "audio" ? (
                    <Music className="h-5 w-5 shrink-0 text-muted-foreground" />
                  ) : (
                    <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                  )}
                  <span className="text-sm truncate">{file.name}</span>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

