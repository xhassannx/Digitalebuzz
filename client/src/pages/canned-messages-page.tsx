// @ts-nocheck
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, FileText, Pencil, Trash2, Star, ImageIcon, FolderOpen, Eye, Download } from "lucide-react";
import { useListPaginationState, parsePaginatedListResponse, useDebouncedValue } from "@/lib/list-pagination";
import { ListPaginationFooter } from "@/components/list-pagination-footer";
import { formatPanelUploadMaxMb } from "@shared/panel-upload-limits";

const LEGACY_STORAGE_KEY = "canned_messages";

/** Read canned messages from browser localStorage (old storage). */
function getLegacyCannedMessages(): CannedMessage[] {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : [];
    return list.map((m: any) => normalizeMessage(m));
  } catch {
    return [];
  }
}

export type CannedMessage = {
  id: string;
  name: string;
  type: "TEXT" | "IMAGE";
  text: string;
  imageUrl?: string;
  fileName?: string;
  createdBy: string;
  favourite?: boolean;
  createdAt: string;
};

function normalizeMessage(m: any): CannedMessage {
  if (m.name !== undefined && m.type !== undefined && m.createdBy !== undefined) return m as CannedMessage;
  return {
    id: m.id,
    name: m.title ?? m.name ?? "Untitled",
    type: (m.type as "TEXT" | "IMAGE") ?? "TEXT",
    text: m.content ?? m.text ?? "",
    imageUrl: m.imageUrl,
    fileName: m.fileName,
    createdBy: m.createdBy ?? "Me",
    favourite: m.favourite ?? false,
    createdAt: m.createdAt ?? new Date().toISOString(),
  };
}

function cannedMessagesUrl(organizationId: string | undefined, path = ""): string {
  const base = path ? `/api/canned-messages/${path}` : "/api/canned-messages";
  if (!organizationId) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}organizationId=${encodeURIComponent(organizationId)}`;
}

async function fetchCannedMessagesPage(
  organizationId: string | undefined,
  params: URLSearchParams
): Promise<unknown> {
  const url = cannedMessagesUrl(organizationId);
  const sep = url.includes("?") ? "&" : "?";
  const res = await apiRequest("GET", `${url}${sep}${params.toString()}`);
  if (!res.ok) throw new Error("Failed to load canned messages");
  return res.json();
}

export default function CannedMessagesPage() {
  const { toast } = useToast();
  const { data: user } = useAuth();
  const createdByName = user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() || user?.email : user?.email ?? "Me";

  const { data: orgData } = useQuery<{ organizations?: { id: string }[] }>({
    queryKey: ["/api/organizations"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/organizations");
      return res.json();
    },
  });
  const organizationsList = Array.isArray(orgData) ? orgData : (orgData?.organizations ?? []);
  const organizationId = organizationsList[0]?.id;

  const [searchQuery, setSearchQuery] = useState("");
  const {
    currentPage,
    setCurrentPage,
    rowsPerPage,
    setRowsPerPage,
    resetPage,
    paginationParams,
  } = useListPaginationState(10);
  const debouncedSearchQuery = useDebouncedValue(searchQuery);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<"TEXT" | "IMAGE">("TEXT");
  const [formText, setFormText] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formFileName, setFormFileName] = useState("");
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [previewMessage, setPreviewMessage] = useState<CannedMessage | null>(null);
  const [legacyImported, setLegacyImported] = useState(() => {
    try {
      return localStorage.getItem(LEGACY_STORAGE_KEY + "_imported") === "true";
    } catch {
      return false;
    }
  });

  const legacyMessages = useMemo(() => getLegacyCannedMessages(), []);
  const showLegacyBanner = legacyMessages.length > 0 && !legacyImported;

  const importFromLocalMutation = useMutation({
    mutationFn: async () => {
      const list = getLegacyCannedMessages();
      for (const m of list) {
        const res = await apiRequest("POST", cannedMessagesUrl(organizationId), {
          name: m.name.trim() || "Untitled",
          type: m.type,
          text: m.text?.trim() ?? "",
          imageUrl: m.imageUrl?.trim() || undefined,
          fileName: m.fileName?.trim() || undefined,
          favourite: m.favourite ?? false,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || err.error || "Import failed");
        }
      }
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      localStorage.setItem(LEGACY_STORAGE_KEY + "_imported", "true");
      setLegacyImported(true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canned-messages", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["canned-messages-input", organizationId] });
      toast({
        title: "Import complete",
        description: `${legacyMessages.length} canned message(s) have been moved to your account and will now sync across devices.`,
      });
    },
    onError: (e: any) => {
      toast({ title: "Import failed", description: e.message || "Could not import from this browser.", variant: "destructive" });
    },
  });

  const { data: galleryItems = [] } = useQuery<Array<{ id: string; url: string; name: string; type: string }>>({
    queryKey: ["/api/gallery", "image"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/gallery?type=image");
      return res.json();
    },
    enabled: galleryOpen,
  });

  const { data: messagesResponse, isLoading: isLoadingMessages } = useQuery({
    queryKey: ["canned-messages", organizationId, debouncedSearchQuery, currentPage, rowsPerPage],
    queryFn: async () => {
      const params = new URLSearchParams(paginationParams.toString());
      if (debouncedSearchQuery.trim()) params.set("search", debouncedSearchQuery.trim());
      return fetchCannedMessagesPage(organizationId, params);
    },
    enabled: !!organizationId,
  });

  const { items: rawMessages, total: totalMessages } = parsePaginatedListResponse<CannedMessage>(
    messagesResponse,
    "cannedMessages"
  );
  const messages: CannedMessage[] = useMemo(
    () => rawMessages.map(normalizeMessage),
    [rawMessages]
  );

  useEffect(() => {
    resetPage();
  }, [debouncedSearchQuery, resetPage]);

  const createMutation = useMutation({
    mutationFn: async (payload: { name: string; type: "TEXT" | "IMAGE"; text: string; imageUrl?: string; fileName?: string }) => {
      const res = await apiRequest("POST", cannedMessagesUrl(organizationId), {
        name: payload.name.trim(),
        type: payload.type,
        text: payload.text.trim(),
        imageUrl: payload.imageUrl?.trim() || undefined,
        fileName: payload.fileName?.trim() || undefined,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || "Failed to create");
      }
      return normalizeMessage(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canned-messages", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["canned-messages-input", organizationId] });
      closeDialog();
      toast({ title: "Canned message created", description: "Your message has been saved." });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message || "Failed to save.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; name: string; type: "TEXT" | "IMAGE"; text: string; imageUrl?: string; fileName?: string }) => {
      const res = await apiRequest("PATCH", cannedMessagesUrl(organizationId, payload.id), {
        name: payload.name.trim(),
        type: payload.type,
        text: payload.text.trim(),
        imageUrl: payload.imageUrl?.trim() || undefined,
        fileName: payload.fileName?.trim() || undefined,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || "Failed to update");
      }
      return normalizeMessage(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canned-messages", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["canned-messages-input", organizationId] });
      closeDialog();
      toast({ title: "Canned message updated", description: "Changes saved." });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message || "Failed to update.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", cannedMessagesUrl(organizationId, id));
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || "Failed to delete");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canned-messages", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["canned-messages-input", organizationId] });
      closeDialog();
      toast({ title: "Deleted", description: "Canned message removed." });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message || "Failed to delete.", variant: "destructive" });
    },
  });

  const toggleFavourite = async (m: CannedMessage) => {
    try {
      const res = await apiRequest("PATCH", cannedMessagesUrl(organizationId, m.id), { favourite: !m.favourite });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["canned-messages", organizationId] });
        queryClient.invalidateQueries({ queryKey: ["canned-messages-input", organizationId] });
      }
    } catch {
      toast({ title: "Error", description: "Failed to update favourite.", variant: "destructive" });
    }
  };

  function openCreate() {
    setEditingId(null);
    setFormName("");
    setFormType("TEXT");
    setFormText("");
    setFormImageUrl("");
    setFormFileName("");
    setDialogOpen(true);
  }

  function openEdit(m: CannedMessage) {
    setEditingId(m.id);
    setFormName(m.name);
    setFormType(m.type);
    setFormText(m.text);
    setFormImageUrl(m.imageUrl ?? "");
    setFormFileName(m.fileName ?? "");
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingId(null);
  }

  const handleSave = () => {
    if (!formName.trim()) {
      toast({ title: "Name required", description: "Pick a name which describes your message.", variant: "destructive" });
      return;
    }
    if (formType === "TEXT" && !formText.trim()) {
      toast({ title: "Text required", description: "Text is required when message type is TEXT.", variant: "destructive" });
      return;
    }
    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        name: formName,
        type: formType,
        text: formText,
        imageUrl: formImageUrl || undefined,
        fileName: formFileName || undefined,
      });
    } else {
      createMutation.mutate({
        name: formName,
        type: formType,
        text: formText,
        imageUrl: formImageUrl || undefined,
        fileName: formFileName || undefined,
      });
    }
  };

  return (
    <div
      className="atlas-manage-page atlas-canned-messages-page h-full overflow-auto"
      data-testid="page-canned-messages"
    >
      <div className="max-w-[95%] mx-auto p-6 space-y-6">
        <div className="rh-page-hero">
          <h1 className="text-3xl font-semibold">Canned Messages</h1>
        </div>

        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              You can save canned message templates and use them in live chat.
            </p>
          </CardContent>
        </Card>

        {showLegacyBanner && (
          <Card className="border-amber-500/50 bg-amber-500/5">
            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-sm">
                <strong>{legacyMessages.length} canned message(s)</strong> are stored only in this browser. Import them into your account so they sync everywhere (including when you log in on another device).
              </p>
              <Button
                variant="outline"
                className="border-amber-600 text-amber-700 hover:bg-amber-500/10 shrink-0"
                onClick={() => importFromLocalMutation.mutate()}
                disabled={importFromLocalMutation.isPending}
              >
                <Download className="h-4 w-4 mr-2" />
                {importFromLocalMutation.isPending ? "Importing…" : "Import to my account"}
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search canned message by name"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button onClick={openCreate} className="bg-green-600 hover:bg-green-700">
            <Plus className="h-4 w-4 mr-2" />
            Create
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoadingMessages ? (
              <div className="py-12 text-center text-muted-foreground">Loading canned messages...</div>
            ) : messages.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                {searchQuery.trim() ? "No canned messages match your search." : "No canned messages yet. Click Create to add one."}
              </div>
            ) : (
              <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Name</TableHead>
                    <TableHead className="w-[100px]">Type</TableHead>
                    <TableHead>Text</TableHead>
                    <TableHead className="w-[120px]">Created By</TableHead>
                    <TableHead className="w-[120px]">Action</TableHead>
                    <TableHead className="w-[80px]">Favourite</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {messages.map((msg) => (
                    <TableRow key={msg.id}>
                      <TableCell className="font-medium">{msg.name}</TableCell>
                      <TableCell>
                        <span className="text-sm">{msg.type}</span>
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate text-sm text-muted-foreground">
                        {msg.text || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{msg.createdBy}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPreviewMessage(msg)} title="Preview">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(msg)} title="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(msg.id)} title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleFavourite(msg)} title="Favourite">
                          <Star className={`h-4 w-4 ${msg.favourite ? "fill-amber-400 text-amber-500" : ""}`} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {totalMessages > 0 && (
                <ListPaginationFooter
                  total={totalMessages}
                  currentPage={currentPage}
                  rowsPerPage={rowsPerPage}
                  onPageChange={setCurrentPage}
                  onRowsPerPageChange={setRowsPerPage}
                  className="p-4 border-t"
                />
              )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto" data-testid="dialog-create-canned-message">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Canned Message" : "Create Canned Message"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Update your canned message." : "Pick a name which describes your message and add text or image."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                placeholder="Pick a name which describes your message."
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                data-testid="input-canned-name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Message Type</label>
              <Select value={formType} onValueChange={(v: "TEXT" | "IMAGE") => setFormType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TEXT">TEXT</SelectItem>
                  <SelectItem value="IMAGE">IMAGE</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Select one of the message types to proceed.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{formType === "IMAGE" ? "Text (optional)" : "Text"}</label>
              <Textarea
                placeholder="Type your message. You can use *bold* and _italic_. Personalize with {{variable_name}}."
                value={formText}
                onChange={(e) => setFormText(e.target.value)}
                className="min-h-[100px] resize-none"
                data-testid="input-canned-text"
              />
              <p className="text-xs text-muted-foreground">Text can be up to 4096 characters. Use {"{{variable_name}}"} for dynamic parameters.</p>
            </div>
            {formType === "IMAGE" && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Image</label>
                  <Input
                    placeholder={`Share public URL. Size < ${formatPanelUploadMaxMb("image")}MB, formats: png or jpg.`}
                    value={formImageUrl}
                    onChange={(e) => setFormImageUrl(e.target.value)}
                  />
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs text-muted-foreground">OR</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="bg-green-600/10 text-green-700 hover:bg-green-600/20 border-green-600/30"
                      onClick={() => setGalleryOpen(true)}
                    >
                      <FolderOpen className="h-4 w-4 mr-2" />
                      Upload from Gallery
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">File Name</label>
                  <Input
                    placeholder="Display name of media file, visible on download."
                    value={formFileName}
                    onChange={(e) => setFormFileName(e.target.value)}
                  />
                </div>
              </>
            )}
            {(formText || formImageUrl) && (
              <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
                <p className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Message Preview
                </p>
                {formImageUrl && (
                  <img src={formImageUrl} alt="Preview" className="max-h-32 rounded object-contain border" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                )}
                <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{formText || "No text"}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={
                createMutation.isPending ||
                updateMutation.isPending ||
                !formName.trim() ||
                (formType === "TEXT" && !formText.trim())
              }
              className="bg-green-600 hover:bg-green-700"
            >
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Message preview dialog */}
      <Dialog open={!!previewMessage} onOpenChange={(open) => !open && setPreviewMessage(null)}>
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30 pr-12">
            <DialogTitle className="text-base font-semibold m-0">{previewMessage?.name ?? "Message Preview"}</DialogTitle>
          </div>
          <div className="p-4 space-y-3">
            {previewMessage && (
              <>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                    <span className="text-green-600 font-semibold text-sm">WA</span>
                  </div>
                  <span className="text-xs">Message preview</span>
                </div>
                <div className="rounded-lg border bg-background p-3 shadow-sm space-y-2">
                  {previewMessage.type === "IMAGE" && previewMessage.imageUrl && (
                    <img
                      src={previewMessage.imageUrl}
                      alt={previewMessage.fileName ?? "Image"}
                      className="w-full rounded object-contain max-h-48 border"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  )}
                  {previewMessage.text ? (
                    <p className="text-sm text-foreground whitespace-pre-wrap break-words">{previewMessage.text}</p>
                  ) : previewMessage.type === "TEXT" ? (
                    <p className="text-sm text-muted-foreground italic">No text</p>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Gallery picker dialog */}
      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select from Gallery</DialogTitle>
            <DialogDescription>Choose an image to use in your canned message.</DialogDescription>
          </DialogHeader>
          {galleryItems.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No images in gallery. Upload images from the Gallery page.</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-4">
              {galleryItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="relative aspect-square rounded-lg overflow-hidden border-2 cursor-pointer hover:border-green-600 transition-colors group"
                  onClick={() => {
                    setFormImageUrl(item.url);
                    setFormFileName(item.name || item.url.split("/").pop() || "image.jpg");
                    setGalleryOpen(false);
                  }}
                >
                  <img
                    src={item.url}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-image.png"; }}
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.name}
                  </div>
                </button>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setGalleryOpen(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
