// @ts-nocheck
import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Upload, Image as ImageIcon, Video, File, Music, Download, Trash2, Eye, Copy, CheckSquare, Square, MoreVertical, ExternalLink, CloudUpload } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRatehonkPageSkin } from "@/panel-templates/ratehonk-v1/RatehonkSkinContext";
import { RhSearchField, RhScrollTabs } from "@/panel-templates/ratehonk-v1/components/rh";
import { uploadGalleryFile } from "@/lib/gallery-upload";
import { preparePanelUploadFile } from "@/lib/prepare-panel-upload";
import {
  classifyPanelUploadFile,
  validatePanelUploadFile,
} from "@shared/panel-upload-limits";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PanelUploadLimitsHint } from "@/components/panel-upload-limits-hint";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  VideoUploadEditor,
  VideoGalleryPoster,
} from "@/components/video-upload-editor";
import { PdfThumbnail } from "@/components/pdf-thumbnail";
import { isPdfFileName } from "@/lib/render-pdf-thumbnail";

type MediaItem = {
  id: string;
  type: "image" | "video" | "document" | "audio";
  url: string;
  thumbnail?: string;
  name: string;
  size: number;
  uploadedAt: string;
  sessionId?: string;
};

/** Filename hints for audio (incl. WhatsApp `.mpeg` voice notes). */
const AUDIO_EXT =
  /\.(mp3|wav|m4a|aac|flac|opus|oga|mpeg|mpg|weba|amr|caf)$/i;

function isVideoFile(file: File): boolean {
  return classifyPanelUploadFile(file) === "video";
}

function validateFileForUpload(file: File): string | null {
  const result = validatePanelUploadFile(file);
  return result.ok ? null : result.error;
}

function collectValidFiles(files: File[]): {
  valid: File[];
  firstError: string | null;
} {
  const valid: File[] = [];
  let firstError: string | null = null;
  for (const file of files) {
    const err = validateFileForUpload(file);
    if (err) {
      if (!firstError) firstError = err;
      continue;
    }
    valid.push(file);
  }
  return { valid, firstError };
}

/** API may still mark some files as `document` (e.g. `.mpeg`); use name + type for tab, icon, and preview. */
function galleryItemIsAudio(item: MediaItem): boolean {
  if (item.type === "audio") return true;
  return AUDIO_EXT.test(item.name);
}

/** Reserve space for dialog chrome, title block, padding, and action buttons (px). */
const VIDEO_PREVIEW_CHROME_PX = 200;

function computeVideoDisplaySize(
  intrinsicW: number,
  intrinsicH: number
): { width: number; height: number } {
  if (!intrinsicW || !intrinsicH) {
    return { width: 320, height: 240 };
  }
  const maxW = Math.max(160, window.innerWidth - 24);
  const maxH = Math.max(160, window.innerHeight - VIDEO_PREVIEW_CHROME_PX);
  const scale = Math.min(maxW / intrinsicW, maxH / intrinsicH, 1);
  return {
    width: Math.round(intrinsicW * scale),
    height: Math.round(intrinsicH * scale),
  };
}

const GALLERY_TYPE_TABS = [
  { value: "all", label: "All" },
  { value: "image", label: "Images" },
  { value: "video", label: "Videos" },
  { value: "document", label: "Documents" },
  { value: "audio", label: "Audio" },
] as const;

export default function GalleryPage() {
  const skin = useRatehonkPageSkin();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [selectedType, setSelectedType] = useState<
    "all" | "image" | "video" | "document" | "audio"
  >("all");
  const [uploading, setUploading] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadValidationError, setUploadValidationError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusMessage, setUploadStatusMessage] = useState<string | null>(null);
  const [currentUploadName, setCurrentUploadName] = useState<string | null>(null);
  const [pendingVideoFile, setPendingVideoFile] = useState<File | null>(null);
  const [videoPreviewSize, setVideoPreviewSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const remeasureVideoPreview = useCallback(() => {
    const el = previewVideoRef.current;
    if (!el || !el.videoWidth || !el.videoHeight) return;
    setVideoPreviewSize(computeVideoDisplaySize(el.videoWidth, el.videoHeight));
  }, []);

  useEffect(() => {
    if (selectedMedia?.type !== "video") {
      setVideoPreviewSize(null);
      return;
    }
    const onResize = () => remeasureVideoPreview();
    window.addEventListener("resize", onResize);
    const t = window.setTimeout(() => remeasureVideoPreview(), 0);
    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(t);
    };
  }, [selectedMedia?.type, selectedMedia?.id, remeasureVideoPreview]);

  // Fetch all items once; tab filtering is client-side so misclassified audio (e.g. `.mpeg`) still appears under Audio.
  const { data: mediaItems = [], isLoading } = useQuery<MediaItem[]>({
    queryKey: ["/api/gallery"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/gallery");
      return await res.json();
    },
  });

  const filteredMedia = mediaItems.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType =
      selectedType === "all" ||
      (selectedType === "audio" && galleryItemIsAudio(item)) ||
      (selectedType === "document" &&
        item.type === "document" &&
        !galleryItemIsAudio(item)) ||
      (selectedType !== "all" &&
        selectedType !== "audio" &&
        selectedType !== "document" &&
        item.type === selectedType);
    return matchesSearch && matchesType;
  });

  const performUpload = useCallback(
    async (valid: File[]) => {
      if (valid.length === 0) return;

      setUploading(true);
      setUploadProgress(0);
      let uploadedCount = 0;
      try {
        for (const file of valid) {
          setCurrentUploadName(file.name);
          setUploadProgress(0);
          const prepared = await preparePanelUploadFile(file);
          if (prepared.compressed) {
            const savedKb = Math.round(prepared.savedBytes / 1024);
            toast({
              title: "Image optimized",
              description: `${file.name} reduced by ~${savedKb} KB before upload.`,
              duration: 3500,
            });
          }
          await uploadGalleryFile(prepared.file, (pct) => setUploadProgress(pct), {
            onRetry: (nextAttempt) => {
              toast({
                title: "Retrying upload",
                description: `Connection issue — trying again (attempt ${nextAttempt})…`,
                duration: 4000,
              });
            },
          });
          uploadedCount++;
        }
        queryClient.invalidateQueries({ queryKey: ["/api/gallery"] });
        toast({
          title: "Success",
          description:
            uploadedCount === 1
              ? "File uploaded successfully"
              : `${uploadedCount} files uploaded successfully`,
        });
        setUploadStatusMessage(
          uploadedCount === 1
            ? "Upload complete."
            : `${uploadedCount} files uploaded successfully.`
        );
        setUploadProgress(100);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Failed to upload file";
        toast({
          title: "Error",
          description: message,
          variant: "destructive",
        });
      } finally {
        setUploading(false);
        setCurrentUploadName(null);
      }
    },
    [queryClient, toast]
  );

  const processIncomingFiles = useCallback(
    (files: File[]) => {
      const list = Array.from(files);
      const { valid, firstError } = collectValidFiles(list);
      setUploadValidationError(firstError);
      setUploadStatusMessage(null);
      if (valid.length === 0) {
        return;
      }
      if (
        list.length === 1 &&
        valid.length === 1 &&
        isVideoFile(valid[0])
      ) {
        setPendingVideoFile(valid[0]);
        return;
      }
      void performUpload(valid);
    },
    [performUpload]
  );

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/gallery/${id}`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gallery"] });
      setSelectedMedia(null);
      toast({
        title: "Success",
        description: "File deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete file",
        variant: "destructive",
      });
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const promises = ids.map((id) => apiRequest("DELETE", `/api/gallery/${id}`));
      await Promise.all(promises);
      return { deleted: ids.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/gallery"] });
      setSelectedIds(new Set());
      setSelectedMedia(null);
      toast({
        title: "Success",
        description: `${data.deleted} file(s) deleted successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete files",
        variant: "destructive",
      });
    },
  });

  const openUploadModal = () => {
    setUploadStatusMessage(null);
    setUploadValidationError(null);
    setUploadProgress(0);
    setPendingVideoFile(null);
    setUploadModalOpen(true);
  };

  const resetUploadModalState = () => {
    setUploadValidationError(null);
    setUploadStatusMessage(null);
    setUploadProgress(0);
    setCurrentUploadName(null);
    setPendingVideoFile(null);
    dragDepthRef.current = 0;
    setDragActive(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUploadModalOpenChange = (open: boolean) => {
    setUploadModalOpen(open);
    if (!open) {
      resetUploadModalState();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processIncomingFiles(Array.from(files));
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDropZoneDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current += 1;
    setDragActive(true);
  };

  const handleDropZoneDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setDragActive(false);
    }
  };

  const handleDropZoneDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setDragActive(false);
    const dropped = e.dataTransfer.files;
    if (dropped && dropped.length > 0) {
      processIncomingFiles(Array.from(dropped));
    }
  };

  const handleDropZoneClick = () => {
    if (!uploading && !pendingVideoFile) {
      fileInputRef.current?.click();
    }
  };

  const handleVideoEditorConfirm = (file: File) => {
    setPendingVideoFile(null);
    setUploadValidationError(null);
    void performUpload([file]);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this file?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (confirm(`Are you sure you want to delete ${ids.length} file(s)?`)) {
      bulkDeleteMutation.mutate(ids);
    }
  };

  const handleDownload = (item: MediaItem) => {
    const link = document.createElement("a");
    link.href = item.url;
    link.download = item.name;
    link.click();
  };

  const handleBulkDownload = () => {
    const selectedItems = filteredMedia.filter((item) => selectedIds.has(item.id));
    selectedItems.forEach((item) => {
      setTimeout(() => handleDownload(item), 100); // Stagger downloads
    });
    toast({
      title: "Downloading",
      description: `Starting download of ${selectedItems.length} file(s)...`,
    });
  };

  const toFullUrl = (url: string) => {
    if (!url) return url;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    const base = (import.meta.env?.VITE_BASE_URL || window.location.origin).replace(/\/+$/, "");
    return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  const handleCopyUrls = () => {
    const selectedItems = filteredMedia.filter((item) => selectedIds.has(item.id));
    const urls = selectedItems.map((item) => toFullUrl(item.url)).join("\n");
    navigator.clipboard.writeText(urls);
    toast({
      title: "Copied",
      description: `Copied ${selectedItems.length} URL(s) to clipboard`,
    });
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredMedia.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredMedia.map((item) => item.id)));
    }
  };

  const isAllSelected = filteredMedia.length > 0 && selectedIds.size === filteredMedia.length;
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < filteredMedia.length;

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const getMediaIcon = (type: string) => {
    switch (type) {
      case "image":
        return <ImageIcon className="h-8 w-8" />;
      case "video":
        return <Video className="h-8 w-8" />;
      case "audio":
        return <Music className="h-8 w-8" />;
      case "document":
        return <File className="h-8 w-8" />;
      default:
        return <File className="h-8 w-8" />;
    }
  };

  return (
    <div className={cn(skin ? "space-y-6" : "container mx-auto p-6 space-y-6")}>
      <div className="rh-page-hero flex items-center justify-between gap-4">
        <div className={cn("flex items-center gap-2 gallery-page-chrome")}>
          <ImageIcon className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Gallery</h1>
        </div>
        <Button
          onClick={openUploadModal}
          className={cn(skin && "bg-[#0059bb] hover:bg-[#004a9a] text-white")}
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload Media
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {skin ? (
          <RhSearchField
            className="flex-1"
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search media…"
          />
        ) : (
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
            <Input
              placeholder="Search media..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        )}
        {filteredMedia.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleSelectAll}
              className="flex items-center gap-2"
            >
              {isAllSelected ? (
                <CheckSquare className="h-4 w-4" />
              ) : isIndeterminate ? (
                <Square className="h-4 w-4 border-2" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              {isAllSelected ? "Deselect All" : "Select All"}
            </Button>
          </div>
        )}
      </div>

      {/* Bulk Actions Toolbar */}
      {selectedIds.size > 0 && (
        <div
          className={cn(
            "flex items-center gap-2 p-4 rounded-lg",
            skin ? "gallery-bulk-bar" : "bg-muted",
          )}
        >
          <span className="text-sm font-medium">
            {selectedIds.size} file(s) selected
          </span>
          <div className="flex gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyUrls}
              className="flex items-center gap-2"
            >
              <Copy className="h-4 w-4" />
              Copy URLs
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkDownload}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download All
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={bulkDeleteMutation.isPending}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {bulkDeleteMutation.isPending ? "Deleting..." : "Delete All"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {skin ? (
        <RhScrollTabs
          value={selectedType}
          onChange={(v) => setSelectedType(v as typeof selectedType)}
          options={[...GALLERY_TYPE_TABS]}
        />
      ) : null}

      <Tabs value={selectedType} onValueChange={(v) => setSelectedType(v as typeof selectedType)}>
        {!skin && (
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="image">Images</TabsTrigger>
            <TabsTrigger value="video">Videos</TabsTrigger>
            <TabsTrigger value="document">Documents</TabsTrigger>
            <TabsTrigger value="audio">Audio</TabsTrigger>
          </TabsList>
        )}

        <TabsContent value={selectedType} className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-4">
                <div
                  className={cn(
                    "w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mx-auto",
                    skin ? "border-[#0059bb]" : "border-primary",
                  )}
                />
                <p className="text-muted-foreground">Loading media...</p>
              </div>
            </div>
          ) : filteredMedia.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ImageIcon className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No media found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery
                  ? "Try adjusting your search terms"
                  : "Upload your first media file to get started"}
              </p>
              {!searchQuery && (
                <Button
                  onClick={openUploadModal}
                  className={cn(skin && "bg-[#0059bb] hover:bg-[#004a9a] text-white")}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Media
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredMedia.map((item) => {
                const isSelected = selectedIds.has(item.id);
                const showMediaThumbnail =
                  item.type === "image" ||
                  item.type === "video" ||
                  (item.type === "document" &&
                    isPdfFileName(item.name) &&
                    !galleryItemIsAudio(item));
                return (
                  <Card
                    key={item.id}
                    className={cn(
                      "group cursor-pointer transition-colors",
                      skin
                        ? cn(
                            "gallery-media-card",
                            isSelected && "gallery-media-selected",
                          )
                        : cn(
                            "hover:border-primary",
                            isSelected && "border-primary ring-2 ring-primary",
                          ),
                    )}
                    onClick={() => {
                      if (selectedIds.size > 0) {
                        toggleSelect(item.id);
                      } else {
                        setSelectedMedia(item);
                      }
                    }}
                  >
                    <CardContent className="p-0">
                      <div className="relative aspect-square bg-muted flex items-center justify-center overflow-hidden rounded-t-lg">
                        {/* Selection Checkbox */}
                        <div
                          className="absolute top-2 left-2 z-10"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelect(item.id);
                          }}
                        >
                          <div className="bg-background/80 backdrop-blur-sm rounded p-1">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelect(item.id)}
                              className="h-5 w-5"
                            />
                          </div>
                        </div>
                        {/* Three-dot menu */}
                        <div className="absolute top-2 right-2 z-10" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="icon"
                                variant="secondary"
                                className="h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem
                                onClick={() => {
                                  navigator.clipboard.writeText(toFullUrl(item.url));
                                  toast({ title: "Copied", description: "URL copied to clipboard" });
                                }}
                              >
                                <Copy className="h-4 w-4 mr-2" />
                                Copy URL
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDownload(item)}>
                                <Download className="h-4 w-4 mr-2" />
                                Download
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => window.open(item.url, "_blank")}>
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Open in new tab
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setSelectedMedia(item)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Preview
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDelete(item.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      {item.type === "image" ? (
                        <img
                          src={item.url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const fallback = target.nextElementSibling as HTMLElement;
                            if (fallback) {
                              fallback.style.display = 'flex';
                            }
                          }}
                        />
                      ) : item.type === "video" ? (
                        <VideoGalleryPoster
                          src={item.url}
                          className="h-full w-full object-cover"
                        />
                      ) : item.type === "document" && isPdfFileName(item.name) ? (
                        <PdfThumbnail
                          src={item.url}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                      <div
                        className={`text-muted-foreground ${
                          showMediaThumbnail ? "hidden" : "flex"
                        } items-center justify-center`}
                      >
                        {getMediaIcon(galleryItemIsAudio(item) ? "audio" : item.type)}
                      </div>
                      <div className={`absolute inset-0 bg-black/0 transition-colors flex items-center justify-center ${
                        selectedIds.size > 0 ? "opacity-0" : "opacity-0 group-hover:opacity-100"
                      } group-hover:bg-black/50`}>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(item);
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMedia(item);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(item.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <div className="flex items-center justify-between mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {formatFileSize(item.size)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.uploadedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Upload modal */}
      <Dialog open={uploadModalOpen} onOpenChange={handleUploadModalOpenChange}>
        <DialogContent
          className={cn(
            "rounded-xl border-0 p-0 shadow-xl overflow-hidden gap-0",
            pendingVideoFile
              ? "max-w-[min(100vw-2rem,44rem)] sm:max-w-2xl"
              : "max-w-[min(100vw-2rem,28rem)] sm:max-w-md"
          )}
        >
          <div className="p-6 pb-4 border-b bg-background">
            <DialogHeader className="space-y-1 pr-8">
              <DialogTitle className="text-xl font-semibold tracking-tight">
                {pendingVideoFile ? "Video upload" : "Upload Media"}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {pendingVideoFile
                  ? "Preview the thumbnail, scrub to pick a frame, then upload."
                  : "Add images, videos, audio, or documents to your gallery."}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="p-6 pt-4 space-y-4">
            {pendingVideoFile ? (
              <VideoUploadEditor
                file={pendingVideoFile}
                onCancel={() => setPendingVideoFile(null)}
                onConfirm={handleVideoEditorConfirm}
              />
            ) : (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                  accept="image/*,video/*,audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.opus,.mpeg,.mpg,.weba,.amr,.caf,.pdf,.doc,.docx,.txt"
                />
                <button
                  type="button"
                  onClick={handleDropZoneClick}
                  onDragEnter={handleDropZoneDragEnter}
                  onDragLeave={handleDropZoneDragLeave}
                  onDragOver={handleDropZoneDragOver}
                  onDrop={handleDrop}
                  disabled={uploading}
                  className={cn(
                    "w-full rounded-xl border-2 border-dashed transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    "min-h-[220px] flex flex-col items-center justify-center gap-2 px-4 py-8 text-center sm:min-h-[240px]",
                    "bg-muted/30 hover:bg-muted/50",
                    dragActive && "border-primary bg-primary/5 ring-2 ring-primary/20 scale-[1.01]",
                    !dragActive && "border-muted-foreground/25",
                    uploading && "pointer-events-none opacity-70"
                  )}
                >
                  <CloudUpload
                    className={cn(
                      "h-12 w-12 shrink-0",
                      dragActive ? "text-primary" : "text-primary/80"
                    )}
                    aria-hidden
                  />
                  <span className="text-base font-semibold text-foreground">
                    Drag &amp; Drop files here
                  </span>
                  <span className="text-sm text-muted-foreground max-w-[280px]">
                    or click to browse files
                  </span>
                  <PanelUploadLimitsHint className="mt-1 max-w-[min(100%,20rem)]" />
                </button>
              </>
            )}
            {uploadValidationError && (
              <p
                className="text-sm text-destructive text-center"
                role="alert"
              >
                {uploadValidationError}
              </p>
            )}
            {uploading && (
              <div className="space-y-2">
                {currentUploadName && (
                  <p className="text-xs text-muted-foreground truncate text-center">
                    Uploading: {currentUploadName}
                  </p>
                )}
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-xs text-muted-foreground text-center tabular-nums">
                  {uploadProgress}%
                </p>
              </div>
            )}
            {!uploading && uploadStatusMessage && !pendingVideoFile && (
              <p className="text-sm text-center font-medium text-green-600 dark:text-green-500">
                {uploadStatusMessage}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Media Preview Dialog */}
      <Dialog open={!!selectedMedia} onOpenChange={() => setSelectedMedia(null)}>
        <DialogContent
          className={cn(
            selectedMedia?.type === "video"
              ? "flex w-fit max-w-[calc(100vw-1rem)] flex-col overflow-x-hidden overflow-y-auto p-3 sm:gap-3 sm:p-4"
              : "max-w-4xl",
          )}
        >
          {selectedMedia?.type === "video" ? (
            <div
              className={cn(
                "flex min-w-0 flex-col gap-2 sm:gap-3",
                !videoPreviewSize && "max-w-[calc(100vw-2rem)]",
              )}
              style={
                videoPreviewSize
                  ? { width: videoPreviewSize.width }
                  : { minWidth: 200 }
              }
            >
              <DialogHeader className="shrink-0 space-y-1 pr-8 text-left">
                <DialogTitle className="break-words text-base sm:text-lg">
                  {selectedMedia.name}
                </DialogTitle>
                <DialogDescription>
                  {formatFileSize(selectedMedia.size)} •{" "}
                  {new Date(selectedMedia.uploadedAt).toLocaleString()}
                </DialogDescription>
              </DialogHeader>
              <div
                className="shrink-0 overflow-hidden rounded-md bg-black/[0.06] dark:bg-black/50"
                style={
                  videoPreviewSize
                    ? {
                        width: videoPreviewSize.width,
                        height: videoPreviewSize.height,
                      }
                    : { minHeight: 180, minWidth: 120 }
                }
              >
                <video
                  ref={previewVideoRef}
                  src={selectedMedia.url}
                  controls
                  playsInline
                  preload="metadata"
                  className="h-full w-full rounded-md object-contain"
                  onLoadedMetadata={(e) => {
                    const v = e.currentTarget;
                    setVideoPreviewSize(
                      computeVideoDisplaySize(v.videoWidth, v.videoHeight)
                    );
                  }}
                />
              </div>
              <div className="flex shrink-0 flex-wrap gap-2 border-t border-border/60 pt-3">
                <Button onClick={() => handleDownload(selectedMedia)}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleDelete(selectedMedia.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          ) : (
            <>
              <DialogHeader className="space-y-1 pr-8 text-left">
                <DialogTitle>{selectedMedia?.name}</DialogTitle>
                <DialogDescription>
                  {selectedMedia && formatFileSize(selectedMedia.size)} •{" "}
                  {selectedMedia && new Date(selectedMedia.uploadedAt).toLocaleString()}
                </DialogDescription>
              </DialogHeader>
              {selectedMedia && (
                <div className="space-y-4">
                  {selectedMedia.type === "image" ? (
                    <img
                      src={selectedMedia.url}
                      alt={selectedMedia.name}
                      className="w-full h-auto rounded-lg"
                    />
                  ) : galleryItemIsAudio(selectedMedia) ? (
                    <div className="flex w-full flex-col items-center gap-4 rounded-lg border bg-muted/30 p-6">
                      <Music className="h-16 w-16 text-muted-foreground" />
                      <audio
                        controls
                        src={selectedMedia.url}
                        className="w-full max-w-md"
                        preload="metadata"
                      >
                        Your browser does not support audio playback.
                      </audio>
                    </div>
                  ) : selectedMedia.type === "document" &&
                    isPdfFileName(selectedMedia.name) &&
                    !galleryItemIsAudio(selectedMedia) ? (
                    <div className="flex max-h-[75vh] w-full justify-center overflow-hidden rounded-lg border bg-muted/20 p-2">
                      <PdfThumbnail
                        src={selectedMedia.url}
                        alt={selectedMedia.name}
                        className="max-h-[70vh] w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 bg-muted rounded-lg">
                      <File className="h-16 w-16 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">{selectedMedia.name}</p>
                      <Button className="mt-4" onClick={() => handleDownload(selectedMedia)}>
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => handleDownload(selectedMedia)}>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleDelete(selectedMedia.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

