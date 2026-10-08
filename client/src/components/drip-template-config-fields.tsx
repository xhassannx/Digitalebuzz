import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, resolveApiUrl, rewritePanelMediaUrlToCurrentOrigin } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Image as ImageIcon, Loader2, Settings2, Upload, Video } from "lucide-react";
import { fetchLegacyListApi } from "@/lib/legacy-list-api";
import { cn } from "@/lib/utils";

export type DripTemplateParam = { column?: string; fallback?: string };

export type DripTemplateActionConfig = {
  templateId?: string;
  templateName?: string;
  templateLanguage?: string;
  phoneNumberId?: string;
  templateParameters?: DripTemplateParam[];
  headerFormat?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
  headerImageId?: string;
  headerImageUrl?: string;
  headerVideoId?: string;
  headerVideoUrl?: string;
  headerDocumentId?: string;
  headerDocumentUrl?: string;
  [key: string]: unknown;
};

type WaPhone = {
  phoneNumberId: string;
  displayPhoneNumber?: string;
  verifiedName?: string;
  sessionId?: string;
};

type WaTemplate = {
  id?: string;
  templateId?: string;
  name: string;
  language?: string;
  category?: string;
  status?: string;
  components?: Array<{
    type?: string;
    format?: string;
    text?: string;
    buttons?: Array<{ type?: string; text?: string; url?: string }>;
  }>;
};

type ContactColumn = { id: string; label: string };

function resolveGalleryMediaUrl(url: string): string {
  if (!url) return url;
  const rewritten = rewritePanelMediaUrlToCurrentOrigin(url);
  if (rewritten.startsWith("http://") || rewritten.startsWith("https://")) return rewritten;
  return resolveApiUrl(rewritten.startsWith("/") ? rewritten : `/${rewritten}`);
}

function extractTemplateVariables(template: WaTemplate | undefined): number[] {
  if (!template?.components) return [];
  const bodyComponent = template.components.find((c) => c.type === "BODY");
  if (!bodyComponent?.text) return [];
  const matches = bodyComponent.text.match(/\{\{(\d+)\}\}/g);
  if (!matches) return [];
  const vars = matches.map((m) => parseInt(m.replace(/[{}]/g, ""), 10));
  return [...new Set(vars)].sort((a, b) => a - b);
}

function getHeaderFormat(
  template: WaTemplate | undefined,
): "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | undefined {
  const header = template?.components?.find((c) => c.type === "HEADER");
  if (!header?.format) return undefined;
  const format = String(header.format).toUpperCase();
  if (format === "IMAGE" || format === "VIDEO" || format === "DOCUMENT" || format === "TEXT") {
    return format;
  }
  return undefined;
}

function getPreviewText(template: WaTemplate | undefined, params: DripTemplateParam[]): string {
  const body = template?.components?.find((c) => c.type === "BODY")?.text || "";
  let text = body;
  extractTemplateVariables(template).forEach((varNum, index) => {
    const param = params[index];
    const value = param?.fallback?.trim() || param?.column || `{{${varNum}}}`;
    text = text.replace(new RegExp(`\\{\\{${varNum}\\}\\}`, "g"), value);
  });
  return text;
}

function emptyDraft(phoneNumberId?: string): DripTemplateActionConfig {
  return {
    phoneNumberId,
    templateId: "",
    templateName: "",
    templateLanguage: "en",
    templateParameters: [],
    headerFormat: undefined,
    headerImageId: undefined,
    headerImageUrl: undefined,
    headerVideoId: undefined,
    headerVideoUrl: undefined,
    headerDocumentId: undefined,
    headerDocumentUrl: undefined,
  };
}

type Props = {
  config: DripTemplateActionConfig;
  phoneNumbers: WaPhone[];
  selectedPhoneNumberId: string;
  onPhoneNumberChange: (phoneNumberId: string, sessionId?: string | null) => void;
  onChange: (patch: DripTemplateActionConfig) => void;
  /** Open the configure dialog immediately (e.g. when switching to Meta Template). */
  autoOpen?: boolean;
};

export function DripTemplateConfigFields({
  config,
  phoneNumbers,
  selectedPhoneNumberId,
  onPhoneNumberChange,
  onChange,
  autoOpen = false,
}: Props) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [mediaUrlInput, setMediaUrlInput] = useState("");
  const [draft, setDraft] = useState<DripTemplateActionConfig>(emptyDraft(selectedPhoneNumberId));
  const [didAutoOpen, setDidAutoOpen] = useState(false);

  const openDialog = () => {
    setDraft({
      ...emptyDraft(selectedPhoneNumberId),
      ...config,
      phoneNumberId: config.phoneNumberId || selectedPhoneNumberId,
      templateParameters: Array.isArray(config.templateParameters)
        ? config.templateParameters.map((p) => ({ ...p }))
        : [],
    });
    setMediaUrlInput("");
    setDialogOpen(true);
  };

  useEffect(() => {
    if (autoOpen && !didAutoOpen && !config.templateName) {
      setDidAutoOpen(true);
      openDialog();
    }
  }, [autoOpen, didAutoOpen, config.templateName]);

  const phoneId = draft.phoneNumberId || selectedPhoneNumberId;

  const { data: templates = [], isLoading: templatesLoading } = useQuery<WaTemplate[]>({
    queryKey: ["/api/templates", phoneId, "drip-template-dialog"],
    queryFn: () => {
      const url = phoneId
        ? `/api/templates?phoneNumberId=${encodeURIComponent(phoneId)}`
        : "/api/templates";
      return fetchLegacyListApi<WaTemplate>(url, "templates");
    },
    enabled: dialogOpen,
  });

  const approvedTemplates = useMemo(
    () => templates.filter((t) => !t.status || String(t.status).toUpperCase() === "APPROVED"),
    [templates],
  );

  const selectedTemplate = useMemo(() => {
    const id = draft.templateId || draft.templateName;
    if (!id) return undefined;
    return approvedTemplates.find(
      (t) =>
        t.id === id ||
        t.templateId === id ||
        t.name === id ||
        t.name === draft.templateName,
    );
  }, [approvedTemplates, draft.templateId, draft.templateName]);

  const headerFormat = draft.headerFormat || getHeaderFormat(selectedTemplate);
  const needsMedia =
    headerFormat === "IMAGE" || headerFormat === "VIDEO" || headerFormat === "DOCUMENT";
  const galleryType =
    headerFormat === "VIDEO" ? "video" : headerFormat === "DOCUMENT" ? "document" : "image";

  const { data: columns = [] } = useQuery<ContactColumn[]>({
    queryKey: ["/api/columns", "drip-dialog"],
    queryFn: () => fetchLegacyListApi<ContactColumn>("/api/columns", "columns"),
    enabled: dialogOpen,
  });

  const { data: galleryItems = [] } = useQuery<any[]>({
    queryKey: ["/api/gallery", galleryType, "drip-dialog"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/gallery?type=${galleryType}`);
      const json = await res.json();
      return Array.isArray(json) ? json : json?.items || [];
    },
    enabled: galleryOpen,
  });

  const selectedPhone = phoneNumbers.find((p) => p.phoneNumberId === phoneId);
  const sessionId = selectedPhone?.sessionId || "";

  const patchDraft = (patch: Partial<DripTemplateActionConfig>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const mediaIdLabel =
    headerFormat === "VIDEO"
      ? "Video ID"
      : headerFormat === "DOCUMENT"
        ? "Document ID"
        : "Image ID";
  const activeMediaId =
    headerFormat === "VIDEO"
      ? draft.headerVideoId
      : headerFormat === "DOCUMENT"
        ? draft.headerDocumentId
        : draft.headerImageId;
  const activeMediaUrl =
    headerFormat === "VIDEO"
      ? draft.headerVideoUrl
      : headerFormat === "DOCUMENT"
        ? draft.headerDocumentUrl
        : draft.headerImageUrl;

  const previewSrc = activeMediaUrl ? resolveGalleryMediaUrl(activeMediaUrl) : "";

  // If we only have a WhatsApp media ID (no preview URL), resolve a display URL
  useEffect(() => {
    if (!dialogOpen || !activeMediaId || activeMediaUrl || !sessionId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiRequest(
          "GET",
          `/api/media/${encodeURIComponent(activeMediaId)}?sessionId=${encodeURIComponent(sessionId)}`,
        );
        const json = await res.json();
        const url = json?.url || json?.previewUrl || json?.mediaUrl;
        if (!cancelled && url) {
          if (headerFormat === "VIDEO") patchDraft({ headerVideoUrl: url });
          else if (headerFormat === "DOCUMENT") patchDraft({ headerDocumentUrl: url });
          else patchDraft({ headerImageUrl: url });
        }
      } catch {
        // Preview is optional; send still works with media ID
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dialogOpen, activeMediaId, activeMediaUrl, sessionId, headerFormat]);

  const uploadMediaMutation = useMutation({
    mutationFn: async ({
      file,
      mediaType,
      previewUrl,
    }: {
      file: File;
      mediaType: "image" | "video" | "document";
      previewUrl?: string;
    }) => {
      if (!sessionId) throw new Error("Select a WhatsApp number first");
      const formData = new FormData();
      formData.append("sessionId", sessionId);
      formData.append("file", file);
      formData.append("mediaType", mediaType);
      const response = await fetch(resolveApiUrl("/api/media/upload"), {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || error.message || "Failed to upload media");
      }
      const json = await response.json();
      return { ...json, localPreviewUrl: previewUrl };
    },
    onSuccess: (data, variables) => {
      const mediaId = data.mediaId || data.id || data.whatsappMediaId || "";
      // Upload often returns only mediaId — keep gallery/entered URL for preview (same as Inbox)
      const preview =
        data.previewUrl ||
        data.url ||
        data.mediaUrl ||
        data.localPreviewUrl ||
        variables.previewUrl ||
        "";
      if (!mediaId) {
        toast({
          title: "Upload completed but no media ID returned",
          description: "Try selecting the file again from gallery.",
          variant: "destructive",
        });
      }
      if (variables.mediaType === "video") {
        patchDraft({
          headerVideoId: mediaId || undefined,
          headerVideoUrl: preview || undefined,
          headerImageId: undefined,
          headerImageUrl: undefined,
          headerDocumentId: undefined,
          headerDocumentUrl: undefined,
        });
      } else if (variables.mediaType === "document") {
        patchDraft({
          headerDocumentId: mediaId || undefined,
          headerDocumentUrl: preview || undefined,
          headerImageId: undefined,
          headerImageUrl: undefined,
          headerVideoId: undefined,
          headerVideoUrl: undefined,
        });
      } else {
        patchDraft({
          headerImageId: mediaId || undefined,
          headerImageUrl: preview || undefined,
          headerVideoId: undefined,
          headerVideoUrl: undefined,
          headerDocumentId: undefined,
          headerDocumentUrl: undefined,
        });
      }
      toast({
        title: "Media uploaded",
        description: mediaId ? `${mediaIdLabel}: ${mediaId}` : undefined,
      });
    },
    onError: (e: Error) =>
      toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
  });

  const applyGalleryItem = async (item: any) => {
    const url = item.url || item.mediaUrl || item.fileUrl;
    if (!url || !sessionId) {
      toast({
        title: "Cannot use media",
        description: !sessionId ? "Select a WhatsApp number first" : "Missing media URL",
        variant: "destructive",
      });
      return;
    }
    const displayUrl = resolveGalleryMediaUrl(url);
    // Show preview immediately (Inbox behavior) — upload only provides WhatsApp media ID
    if (headerFormat === "VIDEO") {
      patchDraft({
        headerVideoUrl: displayUrl,
        headerImageUrl: undefined,
        headerDocumentUrl: undefined,
      });
    } else if (headerFormat === "DOCUMENT") {
      patchDraft({
        headerDocumentUrl: displayUrl,
        headerImageUrl: undefined,
        headerVideoUrl: undefined,
      });
    } else {
      patchDraft({
        headerImageUrl: displayUrl,
        headerVideoUrl: undefined,
        headerDocumentUrl: undefined,
      });
    }

    try {
      const response = await fetch(displayUrl);
      if (!response.ok) throw new Error("Failed to fetch media");
      const blob = await response.blob();
      const ext =
        headerFormat === "VIDEO"
          ? "video.mp4"
          : headerFormat === "DOCUMENT"
            ? "file.pdf"
            : "image.jpg";
      const fileName = item.fileName || item.name || ext;
      const file = new File([blob], fileName, { type: blob.type || "application/octet-stream" });
      uploadMediaMutation.mutate({
        file,
        mediaType: galleryType as "image" | "video" | "document",
        previewUrl: displayUrl,
      });
      setGalleryOpen(false);
    } catch (err: any) {
      toast({
        title: "Failed to use gallery item",
        description: err?.message || "Try again",
        variant: "destructive",
      });
    }
  };

  const uploadFromUrl = async () => {
    if (!mediaUrlInput || !sessionId) return;
    const displayUrl = mediaUrlInput.trim();
    try {
      if (headerFormat === "VIDEO") {
        patchDraft({ headerVideoUrl: displayUrl, headerImageUrl: undefined, headerDocumentUrl: undefined });
      } else if (headerFormat === "DOCUMENT") {
        patchDraft({ headerDocumentUrl: displayUrl, headerImageUrl: undefined, headerVideoUrl: undefined });
      } else {
        patchDraft({ headerImageUrl: displayUrl, headerVideoUrl: undefined, headerDocumentUrl: undefined });
      }

      const response = await fetch(displayUrl);
      if (!response.ok) throw new Error("Failed to fetch media from URL");
      const blob = await response.blob();
      const fileName = displayUrl.split("/").pop() || "media";
      const file = new File([blob], fileName, { type: blob.type || "application/octet-stream" });
      uploadMediaMutation.mutate({
        file,
        mediaType: galleryType as "image" | "video" | "document",
        previewUrl: displayUrl,
      });
      setMediaUrlInput("");
    } catch (err: any) {
      toast({
        title: "Failed to load media",
        description: err?.message || "Check the URL",
        variant: "destructive",
      });
    }
  };

  const applyToStep = () => {
    if (!draft.templateName && !draft.templateId) {
      toast({ title: "Select a template first", variant: "destructive" });
      return;
    }
    if (needsMedia && !activeMediaId && !activeMediaUrl) {
      toast({
        title: "Media required",
        description: `This template needs a ${String(headerFormat).toLowerCase()} header.`,
        variant: "destructive",
      });
      return;
    }
    const phone = phoneNumbers.find((p) => p.phoneNumberId === (draft.phoneNumberId || phoneId));
    if (phone?.sessionId) onPhoneNumberChange(phone.phoneNumberId, phone.sessionId);
    else if (draft.phoneNumberId) onPhoneNumberChange(draft.phoneNumberId, null);
    onChange({ ...draft, phoneNumberId: draft.phoneNumberId || phoneId });
    setDialogOpen(false);
  };

  const params = draft.templateParameters || [];
  const buttons = selectedTemplate?.components?.find((c) => c.type === "BUTTONS")?.buttons || [];
  const footerText = selectedTemplate?.components?.find((c) => c.type === "FOOTER")?.text;

  const summaryMediaId =
    config.headerImageId || config.headerVideoId || config.headerDocumentId || "";

  return (
    <div className="space-y-3 md:col-span-2">
      <div className="rounded-lg border bg-muted/10 p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Label className="text-sm font-medium">Meta Template</Label>
            <p className="text-sm text-muted-foreground mt-1">
              {config.templateName
                ? `${config.templateName}${config.templateLanguage ? ` (${config.templateLanguage})` : ""}`
                : "No template configured yet"}
            </p>
            {summaryMediaId ? (
              <p className="text-xs text-muted-foreground mt-1 break-all">
                {config.headerVideoId
                  ? "Video ID"
                  : config.headerDocumentId
                    ? "Document ID"
                    : "Image ID"}
                : {summaryMediaId}
              </p>
            ) : null}
            {(config.templateParameters?.length || 0) > 0 ? (
              <p className="text-xs text-muted-foreground mt-1">
                {config.templateParameters!.length} body parameter
                {config.templateParameters!.length === 1 ? "" : "s"} mapped
              </p>
            ) : null}
          </div>
          <Button type="button" className="gap-2 shrink-0" onClick={openDialog}>
            <Settings2 className="h-4 w-4" />
            {config.templateName ? "Edit Template" : "Configure Template"}
          </Button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Send Template Message</DialogTitle>
            <DialogDescription>Send a predefined message template</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
            {/* Preview */}
            <div className="bg-muted/30 rounded-lg p-6 flex flex-col overflow-hidden max-h-[640px]">
              <h3 className="text-lg font-semibold mb-4">Preview</h3>
              {selectedTemplate ? (
                <div
                  className="bg-[#e5ddd5] rounded-lg p-4 flex-1 min-h-[360px] overflow-y-auto"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle, rgba(0,0,0,0.05) 1px, transparent 1px)",
                    backgroundSize: "20px 20px",
                  }}
                >
                  <div
                    className="bg-white rounded-lg shadow-md p-4 max-w-[85%] mb-4 overflow-hidden"
                    style={{ borderRadius: "7.5px 7.5px 7.5px 0" }}
                  >
                    {headerFormat === "IMAGE" && previewSrc ? (
                      <div
                        className="relative overflow-hidden -mx-4 -mt-4 mb-2 rounded-t-[7.5px]"
                        style={{ width: "calc(100% + 2rem)", maxHeight: "260px" }}
                      >
                        <img
                          src={previewSrc}
                          alt="Template header"
                          className="block w-full h-auto object-cover"
                        />
                      </div>
                    ) : headerFormat === "IMAGE" && activeMediaId ? (
                      <div
                        className="min-h-[140px] -mx-4 -mt-4 mb-2 bg-gray-100 flex items-center justify-center text-xs text-muted-foreground rounded-t-[7.5px]"
                        style={{ width: "calc(100% + 2rem)" }}
                      >
                        Image uploaded (ID: {activeMediaId.slice(0, 16)}…)
                      </div>
                    ) : null}
                    {headerFormat === "VIDEO" && previewSrc ? (
                      <div
                        className="relative overflow-hidden -mx-4 -mt-4 mb-2 rounded-t-[7.5px]"
                        style={{ width: "calc(100% + 2rem)" }}
                      >
                        <video
                          src={previewSrc}
                          controls
                          className="w-full h-auto object-cover max-h-[260px]"
                        />
                      </div>
                    ) : null}

                    <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap mb-3">
                      {getPreviewText(selectedTemplate, params)}
                    </p>

                    {footerText ? (
                      <p className="text-xs text-gray-500 text-center mt-2 pt-2 border-t border-gray-200">
                        {footerText}
                      </p>
                    ) : null}

                    {buttons.length > 0 ? (
                      <div className="mt-3 space-y-1">
                        {buttons.map((button, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              "w-full text-center px-3 py-2 rounded-lg text-xs border",
                              button.type === "URL"
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : "bg-white text-gray-700 border-gray-300",
                            )}
                          >
                            {button.text || `Button ${idx + 1}`}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-h-[360px] rounded-lg border border-dashed flex items-center justify-center text-sm text-muted-foreground">
                  Select a template to preview
                </div>
              )}
            </div>

            {/* Config */}
            <div className="space-y-4 overflow-y-auto max-h-[640px] pr-1">
              {phoneNumbers.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Phone Number</Label>
                  <Select
                    value={phoneId}
                    onValueChange={(value) => {
                      const phone = phoneNumbers.find((p) => p.phoneNumberId === value);
                      onPhoneNumberChange(value, phone?.sessionId || null);
                      setDraft({
                        ...emptyDraft(value),
                        phoneNumberId: value,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select WhatsApp number" />
                    </SelectTrigger>
                    <SelectContent>
                      {phoneNumbers.map((phone) => (
                        <SelectItem key={phone.phoneNumberId} value={phone.phoneNumberId}>
                          {phone.displayPhoneNumber}
                          {phone.verifiedName ? ` (${phone.verifiedName})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm font-medium">Message Template</Label>
                <Select
                  value={draft.templateId || draft.templateName || ""}
                  onValueChange={(value) => {
                    const template = approvedTemplates.find(
                      (t) => (t.id || t.templateId) === value || t.name === value,
                    );
                    const vars = extractTemplateVariables(template);
                    const format = getHeaderFormat(template);
                    patchDraft({
                      templateId: template?.id || template?.templateId || value,
                      templateName: template?.name || value,
                      templateLanguage: template?.language || "en",
                      phoneNumberId: phoneId || undefined,
                      templateParameters: vars.map(() => ({ column: "", fallback: "" })),
                      headerFormat: format,
                      headerImageId: undefined,
                      headerImageUrl: undefined,
                      headerVideoId: undefined,
                      headerVideoUrl: undefined,
                      headerDocumentId: undefined,
                      headerDocumentUrl: undefined,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        templatesLoading
                          ? "Loading templates…"
                          : approvedTemplates.length
                            ? "Select a template"
                            : "No approved templates found"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {approvedTemplates.map((template) => {
                      const value = template.id || template.templateId || template.name;
                      return (
                        <SelectItem key={value} value={value}>
                          {template.name}
                          {template.category ? ` (${template.category})` : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {params.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Body Mapping</Label>
                  {params.map((param, paramIndex) => {
                    const varNum = paramIndex + 1;
                    return (
                      <div key={paramIndex} className="space-y-2 border rounded-lg p-3">
                        <Label className="text-xs font-medium">
                          Parameter {varNum} ({`{{${varNum}}}`})
                        </Label>
                        <div className="space-y-2">
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">
                              Select Column
                            </Label>
                            <Select
                              value={param.column || undefined}
                              onValueChange={(value) => {
                                const next = [...params];
                                next[paramIndex] = { ...next[paramIndex], column: value };
                                patchDraft({ templateParameters: next });
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select column" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="name">Name</SelectItem>
                                <SelectItem value="phoneNumber">Phone Number</SelectItem>
                                <SelectItem value="email">Email</SelectItem>
                                {columns.map((col) => (
                                  <SelectItem key={col.id} value={`customFields.${col.label}`}>
                                    {col.label} (Custom Field)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">
                              Manual value (optional)
                            </Label>
                            <Input
                              placeholder="Enter value"
                              value={param.fallback || ""}
                              maxLength={1024}
                              onChange={(e) => {
                                const next = [...params];
                                next[paramIndex] = {
                                  ...next[paramIndex],
                                  fallback: e.target.value.replace(/\r\n|\r|\n/g, " "),
                                };
                                patchDraft({ templateParameters: next });
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {needsMedia && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Media URL</Label>
                  <p className="text-xs text-muted-foreground">
                    This template has a {String(headerFormat).toLowerCase()} header. Select or
                    enter a media URL.
                  </p>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">From your gallery</span>
                      <Badge variant="secondary" className="text-xs">
                        Recommended
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => setGalleryOpen(true)}
                      disabled={!sessionId || uploadMediaMutation.isPending}
                    >
                      {headerFormat === "VIDEO" ? (
                        <Video className="w-4 h-4 mr-2" />
                      ) : headerFormat === "DOCUMENT" ? (
                        <FileText className="w-4 h-4 mr-2" />
                      ) : (
                        <ImageIcon className="w-4 h-4 mr-2" />
                      )}
                      Select media
                    </Button>
                    {activeMediaId ? (
                      <p className="text-xs text-muted-foreground break-all">
                        {mediaIdLabel}: {activeMediaId}
                      </p>
                    ) : null}
                    {uploadMediaMutation.isPending ? (
                      <p className="text-xs text-muted-foreground flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Uploading {String(headerFormat).toLowerCase()} to WhatsApp…
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 border-t" />
                    <span className="text-xs text-muted-foreground">OR</span>
                    <div className="flex-1 border-t" />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Enter URL directly</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter media URL (https://...)"
                        value={mediaUrlInput}
                        onChange={(e) => setMediaUrlInput(e.target.value)}
                        disabled={uploadMediaMutation.isPending}
                      />
                      <Button
                        type="button"
                        onClick={() => void uploadFromUrl()}
                        disabled={!mediaUrlInput || !sessionId || uploadMediaMutation.isPending}
                      >
                        {uploadMediaMutation.isPending ? "Uploading..." : "Upload"}
                      </Button>
                    </div>
                    {activeMediaId ? (
                      <p className="text-xs text-muted-foreground break-all">
                        {mediaIdLabel}: {activeMediaId}
                      </p>
                    ) : null}
                  </div>

                  {previewSrc ? (
                    <div className="rounded border p-2">
                      {headerFormat === "VIDEO" ? (
                        <video
                          src={previewSrc}
                          controls
                          className="max-h-32 max-w-full rounded"
                        />
                      ) : headerFormat === "IMAGE" ? (
                        <img
                          src={previewSrc}
                          alt="Header preview"
                          className="max-h-32 max-w-full rounded"
                        />
                      ) : (
                        <p className="text-xs text-muted-foreground truncate">{activeMediaUrl}</p>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={applyToStep} disabled={uploadMediaMutation.isPending}>
              Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto z-[80]">
          <DialogHeader>
            <DialogTitle>Select media from gallery</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {galleryItems.length === 0 ? (
              <p className="col-span-full text-sm text-muted-foreground py-8 text-center">
                No {galleryType} files in gallery
              </p>
            ) : (
              galleryItems.map((item: any) => {
                const url = item.url || item.mediaUrl || item.fileUrl;
                return (
                  <button
                    key={item.id || url}
                    type="button"
                    className={cn(
                      "rounded border p-2 text-left hover:border-primary transition-colors",
                      uploadMediaMutation.isPending && "opacity-50 pointer-events-none",
                    )}
                    onClick={() => void applyGalleryItem(item)}
                  >
                    {galleryType === "image" && url ? (
                      <img
                        src={resolveGalleryMediaUrl(url)}
                        alt=""
                        className="h-24 w-full object-cover rounded"
                      />
                    ) : galleryType === "video" && url ? (
                      <video
                        src={resolveGalleryMediaUrl(url)}
                        className="h-24 w-full object-cover rounded"
                      />
                    ) : (
                      <div className="flex h-24 items-center justify-center rounded bg-muted">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <p className="mt-1 truncate text-xs">{item.fileName || item.name || "Media"}</p>
                  </button>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
