import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  countTemplateBodyParams,
  getTemplateHeaderFormat,
  type ReminderTemplateOption,
} from "@/features/reminders/useRemindersPage";

export type ReminderTemplateComposeState = {
  useTemplate: boolean;
  setUseTemplate: (on: boolean) => void;
  templateId: string;
  templateParams: string[];
  headerImageUrl: string;
  headerImageId: string;
  headerVideoUrl: string;
  headerVideoId: string;
  headerDocumentUrl: string;
  headerDocumentId: string;
  approvedTemplates: ReminderTemplateOption[];
  templatesLoading: boolean;
  selectedTemplate: ReminderTemplateOption | null;
  officialSession: any | null;
  selectTemplate: (key: string) => void;
  reopenTemplateConfig: () => void;
  templateConfigOpen: boolean;
  draftTemplate: ReminderTemplateOption | null;
  draftHeaderFormat: ReturnType<typeof getTemplateHeaderFormat>;
  draftTemplateParams: string[];
  setDraftTemplateParams: (v: string[]) => void;
  draftHeaderImageUrl: string;
  draftHeaderVideoUrl: string;
  draftHeaderDocumentUrl: string;
  draftMediaUrlInput: string;
  setDraftMediaUrlInput: (v: string) => void;
  applyDraftMediaUrl: () => void;
  uploadDraftMediaFile: (file: File) => Promise<void>;
  mediaUploading: boolean;
  confirmTemplateConfig: () => boolean;
  cancelTemplateConfig: () => void;
  resetTemplateCompose: () => void;
  loadFromReminder: (item: {
    templateName?: string | null;
    templateParams?: string[] | null;
    headerImageUrl?: string | null;
    headerImageId?: string | null;
    headerVideoUrl?: string | null;
    headerVideoId?: string | null;
    headerDocumentUrl?: string | null;
    headerDocumentId?: string | null;
  }) => void;
  buildTemplatePayload: () => Record<string, unknown> | null;
  templateConfigured: boolean;
};

export function useReminderTemplateCompose(opts: {
  enabled: boolean;
  organizationId?: string;
}): ReminderTemplateComposeState {
  const { toast } = useToast();
  const { enabled, organizationId } = opts;

  const [useTemplate, setUseTemplateRaw] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [templateParams, setTemplateParams] = useState<string[]>([]);
  const [headerImageUrl, setHeaderImageUrl] = useState("");
  const [headerImageId, setHeaderImageId] = useState("");
  const [headerVideoUrl, setHeaderVideoUrl] = useState("");
  const [headerVideoId, setHeaderVideoId] = useState("");
  const [headerDocumentUrl, setHeaderDocumentUrl] = useState("");
  const [headerDocumentId, setHeaderDocumentId] = useState("");

  const [templateConfigOpen, setTemplateConfigOpen] = useState(false);
  const [draftTemplateKey, setDraftTemplateKey] = useState("");
  const [draftTemplateParams, setDraftTemplateParams] = useState<string[]>([]);
  const [draftHeaderImageUrl, setDraftHeaderImageUrl] = useState("");
  const [draftHeaderImageId, setDraftHeaderImageId] = useState("");
  const [draftHeaderVideoUrl, setDraftHeaderVideoUrl] = useState("");
  const [draftHeaderVideoId, setDraftHeaderVideoId] = useState("");
  const [draftHeaderDocumentUrl, setDraftHeaderDocumentUrl] = useState("");
  const [draftHeaderDocumentId, setDraftHeaderDocumentId] = useState("");
  const [draftMediaUrlInput, setDraftMediaUrlInput] = useState("");
  const [mediaUploading, setMediaUploading] = useState(false);

  const { data: sessions = [] } = useQuery<any[]>({
    queryKey: ["/api/sessions", "reminder-compose"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/sessions");
      const data = await res.json();
      return Array.isArray(data) ? data : (data.sessions ?? []);
    },
    enabled,
  });

  const officialSession = useMemo(() => {
    const list = Array.isArray(sessions) ? sessions : [];
    const official = list.filter(
      (s: any) => s?.connectionType === "official" && !s?.deletedAt,
    );
    return (
      official.find((s: any) => String(s?.status || "").toLowerCase() === "connected") ||
      official[0] ||
      null
    );
  }, [sessions]);

  const sessionPhoneNumberId =
    officialSession?.connectionType === "official"
      ? (officialSession.deviceInfo as any)?.apiPhoneNumberId
      : undefined;

  const { data: templatesRaw = [], isLoading: templatesLoading } = useQuery<ReminderTemplateOption[]>({
    queryKey: ["/api/reminders/templates", "compose", organizationId, sessionPhoneNumberId],
    enabled: enabled && useTemplate && !!organizationId,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (organizationId) params.set("organizationId", organizationId);
      if (sessionPhoneNumberId) params.set("phoneNumberId", String(sessionPhoneNumberId));
      const res = await apiRequest("GET", `/api/reminders/templates?${params.toString()}`);
      const data = await res.json();
      const items = Array.isArray(data) ? data : (data.templates ?? data.items ?? []);
      return items as ReminderTemplateOption[];
    },
  });

  const approvedTemplates = useMemo(() => {
    let list = (templatesRaw || []).filter(
      (t) => String(t.status || "").toUpperCase() === "APPROVED",
    );
    if (sessionPhoneNumberId) {
      list = list.filter((t) => !t.phoneNumberId || t.phoneNumberId === sessionPhoneNumberId);
    }
    return list;
  }, [templatesRaw, sessionPhoneNumberId]);

  const selectedTemplate = useMemo(
    () => approvedTemplates.find((t) => t.id === templateId || t.name === templateId) || null,
    [approvedTemplates, templateId],
  );

  const draftTemplate = useMemo(
    () => approvedTemplates.find((t) => t.id === draftTemplateKey || t.name === draftTemplateKey) || null,
    [approvedTemplates, draftTemplateKey],
  );

  const draftHeaderFormat = useMemo(() => getTemplateHeaderFormat(draftTemplate), [draftTemplate]);

  const clearMedia = () => {
    setHeaderImageUrl("");
    setHeaderImageId("");
    setHeaderVideoUrl("");
    setHeaderVideoId("");
    setHeaderDocumentUrl("");
    setHeaderDocumentId("");
  };

  const resetTemplateCompose = () => {
    setUseTemplateRaw(false);
    setTemplateId("");
    setTemplateParams([]);
    clearMedia();
    setTemplateConfigOpen(false);
    setDraftTemplateKey("");
    setDraftMediaUrlInput("");
  };

  const setUseTemplate = (on: boolean) => {
    setUseTemplateRaw(on);
    if (!on) {
      setTemplateId("");
      setTemplateParams([]);
      clearMedia();
      setTemplateConfigOpen(false);
    }
  };

  const openTemplateConfig = (templateKey: string, preferExisting = false) => {
    const tpl = approvedTemplates.find((t) => t.id === templateKey || t.name === templateKey);
    const count = countTemplateBodyParams(tpl);
    setDraftTemplateKey(templateKey);
    const reuse =
      preferExisting &&
      (templateId === templateKey || templateId === tpl?.name || templateId === tpl?.id);
    setDraftTemplateParams(
      reuse && templateParams.length
        ? Array.from({ length: Math.max(count, templateParams.length) }, (_, i) => templateParams[i] ?? "")
        : Array.from({ length: count }, () => ""),
    );
    if (reuse) {
      setDraftHeaderImageUrl(headerImageUrl);
      setDraftHeaderImageId(headerImageId);
      setDraftHeaderVideoUrl(headerVideoUrl);
      setDraftHeaderVideoId(headerVideoId);
      setDraftHeaderDocumentUrl(headerDocumentUrl);
      setDraftHeaderDocumentId(headerDocumentId);
    } else {
      setDraftHeaderImageUrl("");
      setDraftHeaderImageId("");
      setDraftHeaderVideoUrl("");
      setDraftHeaderVideoId("");
      setDraftHeaderDocumentUrl("");
      setDraftHeaderDocumentId("");
    }
    setDraftMediaUrlInput("");
    setTemplateConfigOpen(true);
  };

  const selectTemplate = (templateKey: string) => openTemplateConfig(templateKey, false);
  const reopenTemplateConfig = () => {
    if (!templateId) return;
    openTemplateConfig(templateId, true);
  };

  const cancelTemplateConfig = () => {
    setTemplateConfigOpen(false);
    setDraftTemplateKey("");
    setDraftMediaUrlInput("");
  };

  const confirmTemplateConfig = () => {
    if (!draftTemplate?.name) {
      toast({ title: "Select a template", variant: "destructive" });
      return false;
    }
    const format = getTemplateHeaderFormat(draftTemplate);
    const needed = countTemplateBodyParams(draftTemplate);
    if (needed > 0 && draftTemplateParams.slice(0, needed).some((p) => !String(p || "").trim())) {
      toast({ title: "Please fill all template variables", variant: "destructive" });
      return false;
    }
    if (format === "IMAGE" && !draftHeaderImageUrl.trim() && !draftHeaderImageId.trim()) {
      toast({ title: "Please add an image for this template", variant: "destructive" });
      return false;
    }
    if (format === "VIDEO" && !draftHeaderVideoUrl.trim() && !draftHeaderVideoId.trim()) {
      toast({ title: "Please add a video for this template", variant: "destructive" });
      return false;
    }
    if (format === "DOCUMENT" && !draftHeaderDocumentUrl.trim() && !draftHeaderDocumentId.trim()) {
      toast({ title: "Please add a document for this template", variant: "destructive" });
      return false;
    }
    setTemplateId(draftTemplate.name);
    setTemplateParams(draftTemplateParams.slice(0, needed));
    setHeaderImageUrl(format === "IMAGE" ? draftHeaderImageUrl : "");
    setHeaderImageId(format === "IMAGE" ? draftHeaderImageId : "");
    setHeaderVideoUrl(format === "VIDEO" ? draftHeaderVideoUrl : "");
    setHeaderVideoId(format === "VIDEO" ? draftHeaderVideoId : "");
    setHeaderDocumentUrl(format === "DOCUMENT" ? draftHeaderDocumentUrl : "");
    setHeaderDocumentId(format === "DOCUMENT" ? draftHeaderDocumentId : "");
    setTemplateConfigOpen(false);
    return true;
  };

  const applyDraftMediaUrl = () => {
    const url = draftMediaUrlInput.trim();
    if (!url) return;
    const format = draftHeaderFormat;
    if (format === "IMAGE") {
      setDraftHeaderImageUrl(url);
      setDraftHeaderImageId("");
    } else if (format === "VIDEO") {
      setDraftHeaderVideoUrl(url);
      setDraftHeaderVideoId("");
    } else if (format === "DOCUMENT") {
      setDraftHeaderDocumentUrl(url);
      setDraftHeaderDocumentId("");
    }
    setDraftMediaUrlInput("");
  };

  const uploadDraftMediaFile = async (file: File) => {
    if (!officialSession?.sessionId) {
      toast({ title: "Connect WhatsApp Business first", variant: "destructive" });
      return;
    }
    const format = draftHeaderFormat;
    if (format !== "IMAGE" && format !== "VIDEO" && format !== "DOCUMENT") return;
    setMediaUploading(true);
    try {
      const formData = new FormData();
      formData.append("sessionId", officialSession.sessionId);
      formData.append("file", file);
      const response = await fetch("/api/media/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed to upload media");
      }
      const data = await response.json();
      const preview = data.previewUrl || "";
      if (format === "IMAGE") {
        setDraftHeaderImageId(data.mediaId || "");
        if (preview) setDraftHeaderImageUrl(preview);
      } else if (format === "VIDEO") {
        setDraftHeaderVideoId(data.mediaId || "");
        if (preview) setDraftHeaderVideoUrl(preview);
      } else {
        setDraftHeaderDocumentId(data.mediaId || "");
        if (preview) setDraftHeaderDocumentUrl(preview);
      }
      toast({ title: "Media uploaded" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message, variant: "destructive" });
    } finally {
      setMediaUploading(false);
    }
  };

  const loadFromReminder = (item: {
    templateName?: string | null;
    templateParams?: string[] | null;
    headerImageUrl?: string | null;
    headerImageId?: string | null;
    headerVideoUrl?: string | null;
    headerVideoId?: string | null;
    headerDocumentUrl?: string | null;
    headerDocumentId?: string | null;
  }) => {
    const hasTemplate = !!(item.templateName && item.templateName.trim());
    setUseTemplateRaw(hasTemplate);
    if (hasTemplate) {
      setTemplateId(item.templateName || "");
      setTemplateParams(Array.isArray(item.templateParams) ? item.templateParams.map(String) : []);
      setHeaderImageUrl(item.headerImageUrl || "");
      setHeaderImageId(item.headerImageId || "");
      setHeaderVideoUrl(item.headerVideoUrl || "");
      setHeaderVideoId(item.headerVideoId || "");
      setHeaderDocumentUrl(item.headerDocumentUrl || "");
      setHeaderDocumentId(item.headerDocumentId || "");
    } else {
      setTemplateId("");
      setTemplateParams([]);
      clearMedia();
    }
  };

  const buildTemplatePayload = (): Record<string, unknown> | null => {
    if (!useTemplate) return { useTemplate: false };
    if (!templateId) return null;
    if (!officialSession?.sessionId) return null;
    return {
      useTemplate: true,
      templateName: selectedTemplate?.name || templateId,
      templateLanguage: selectedTemplate?.language || "en",
      templateParams,
      sessionId: officialSession.sessionId,
      headerImageUrl: headerImageUrl || undefined,
      headerImageId: headerImageId || undefined,
      headerVideoUrl: headerVideoUrl || undefined,
      headerVideoId: headerVideoId || undefined,
      headerDocumentUrl: headerDocumentUrl || undefined,
      headerDocumentId: headerDocumentId || undefined,
      message: "",
    };
  };

  const templateConfigured = !useTemplate || (!!templateId && !!officialSession?.sessionId);

  return {
    useTemplate,
    setUseTemplate,
    templateId,
    templateParams,
    headerImageUrl,
    headerImageId,
    headerVideoUrl,
    headerVideoId,
    headerDocumentUrl,
    headerDocumentId,
    approvedTemplates,
    templatesLoading,
    selectedTemplate,
    officialSession,
    selectTemplate,
    reopenTemplateConfig,
    templateConfigOpen,
    draftTemplate,
    draftHeaderFormat,
    draftTemplateParams,
    setDraftTemplateParams,
    draftHeaderImageUrl,
    draftHeaderVideoUrl,
    draftHeaderDocumentUrl,
    draftMediaUrlInput,
    setDraftMediaUrlInput,
    applyDraftMediaUrl,
    uploadDraftMediaFile,
    mediaUploading,
    confirmTemplateConfig,
    cancelTemplateConfig,
    resetTemplateCompose,
    loadFromReminder,
    buildTemplatePayload,
    templateConfigured,
  };
}
