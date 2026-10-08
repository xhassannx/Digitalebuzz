// @ts-nocheck
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Plus, Upload, MoreVertical, Edit, Trash2, Search, Copy, Download, AlertTriangle, FileSpreadsheet, Loader2, Globe, MessageSquare, LayoutGrid } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { toast } from "@/hooks/use-toast";
import { toastPlanLimitOrError } from "@/lib/plan-limit-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRatehonkPageSkin } from "@/panel-templates/ratehonk-v1/RatehonkSkinContext";
import { RhSearchField } from "@/panel-templates/ratehonk-v1/components/rh";
import { cn } from "@/lib/utils";

const chatbotSchema = z.object({
  name: z.string().min(1, "Chatbot name is required"),
});

type ChatbotFormData = z.infer<typeof chatbotSchema>;

type Chatbot = {
  id: string;
  name: string;
  status: "draft" | "published";
  createdAt: string;
  updatedAt: string;
};

export default function ChatbotsPage() {
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
  const [location, setLocation] = useLocation();
  const [match] = useRoute("/chatbots/:id");
  const chatbotId = match?.params?.id;
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedChatbot, setSelectedChatbot] = useState<Chatbot | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [cloningChatbotId, setCloningChatbotId] = useState<string | null>(null);
  const [downloadingChatbotId, setDownloadingChatbotId] = useState<string | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChatbotFormData>({
    resolver: zodResolver(chatbotSchema),
  });

  const { data: chatbots = [], isLoading } = useQuery<Chatbot[]>({
    queryKey: ["/api/chatbots"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/chatbots");
      const data = await res.json();
      // Ensure we return an array
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: addedPhonesData } = useQuery<{ phoneNumbers?: Array<{ code_verification_status?: string; displayPhoneNumber?: string }> }>({
    queryKey: ["/api/integrations/whatsapp-business/added-phones"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/integrations/whatsapp-business/added-phones");
      return res.json();
    },
  });
  const hasUnverifiedBusinessNumber = (addedPhonesData?.phoneNumbers ?? []).some(
    (p) => (p as { code_verification_status?: string }).code_verification_status === "NOT_VERIFIED"
  );

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "draft" | "published" }) => {
      const res = await apiRequest("PATCH", `/api/chatbots/${id}`, { status });
      return res.json();
    },
    onMutate: ({ id }) => {
      setStatusUpdatingId(id);
    },
    onSuccess: (_data, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chatbots"] });
      toast({
        title: status === "published" ? "Chatbot published" : "Chatbot unpublished",
        description:
          status === "published"
            ? "This chatbot is now live and will respond to messages."
            : "This chatbot is now in draft mode.",
      });
    },
    onError: (error: any) => {
      toastPlanLimitOrError(toast, error, "Status update failed");
    },
    onSettled: () => {
      setStatusUpdatingId(null);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ChatbotFormData) => {
      const res = await apiRequest("POST", "/api/chatbots", data);
      const chatbot = await res.json();
      return chatbot;
    },
    onSuccess: (chatbot) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chatbots"] });
      setCreateDialogOpen(false);
      reset();
      toast({
        title: "Chatbot created",
        description: "Chatbot created successfully",
      });
      // Navigate to builder - ensure we have the ID
      if (chatbot && chatbot.id) {
        setLocation(`/chatbots/${chatbot.id}`);
      } else {
        console.error("Chatbot created but no ID in response:", chatbot);
        toast({
          title: "Warning",
          description: "Chatbot created but could not navigate to builder",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toastPlanLimitOrError(toast, error, "Failed to create chatbot");
    },
  });

  const demoGoogleSheetMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/chatbots/demo-google-sheet", {});
      return res.json() as Promise<{ chatbot?: { id: string }; message?: string }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chatbots"] });
      toast({
        title: "Demo chatbot created",
        description: data?.message || "Uses your Google Sheets connection and WhatsApp session.",
      });
      if (data?.chatbot?.id) {
        setLocation(`/chatbots/${data.chatbot.id}`);
      }
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Demo failed",
        description: error.message || "Connect Google Sheets (Integrations) and WhatsApp first.",
      });
    },
  });

  const demoHttpMutation = useMutation({
    mutationFn: async () => {
      const token = window.prompt("Paste Bearer token (without 'Bearer ' prefix):", "");
      if (!token || !token.trim()) {
        throw new Error("Bearer token is required to create HTTP demo chatbot.");
      }
      const payload = {
        getUrl: "http://demo.attendbits.com/api/master/task/chatbot/tasks/41",
        postUrl: "http://demo.attendbits.com/api/master/task/chatbot/update-by-index",
        bearerToken: token.trim(),
        employeeId: 41,
      };
      const res = await apiRequest("POST", "/api/chatbots/demo-http-test", payload);
      return res.json() as Promise<{ chatbotId?: string; name?: string }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chatbots"] });
      toast({
        title: "HTTP demo chatbot created",
        description: data?.name || "GET + POST test bot created and published.",
      });
      if (data?.chatbotId) {
        setLocation(`/chatbots/${data.chatbotId}`);
      }
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Demo failed",
        description: error.message || "Could not create HTTP demo chatbot.",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/chatbots/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chatbots"] });
      setDeleteDialogOpen(false);
      setSelectedChatbot(null);
      toast({
        title: "Chatbot deleted",
        description: "Chatbot deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete chatbot",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const raw = await file.text();
      const parsed = JSON.parse(raw);

      // Support multiple formats:
      // 1) Our exported format: { chatbot: {...}, nodes: [...] }
      // 2) Direct: { name, status?, sessionId?, nodes? }
      const importedChatbot = parsed?.chatbot ?? parsed;
      const importedNodes = parsed?.nodes ?? importedChatbot?.nodes ?? [];

      const name = String(importedChatbot?.name ?? "Imported Chatbot").trim() || "Imported Chatbot";
      const sessionId = importedChatbot?.sessionId ?? null;

      // Create new chatbot (import always starts as draft)
      const createRes = await apiRequest("POST", "/api/chatbots", {
        name,
        status: "draft",
        ...(sessionId ? { sessionId } : {}),
      });
      const created = await createRes.json();

      // Save nodes (if any)
      if (Array.isArray(importedNodes) && importedNodes.length > 0) {
        const nodesPayload = importedNodes.map((n: any) => ({
          chatbotId: created.id,
          nodeType: n.nodeType ?? n.node_type ?? n.type,
          position: n.position,
          data: n.data ?? {},
          connections: Array.isArray(n.connections) ? n.connections : [],
        }));
        await apiRequest("POST", `/api/chatbots/${created.id}/nodes`, { nodes: nodesPayload });
      }

      return created;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chatbots"] });
      setImportDialogOpen(false);
      setImportFile(null);
      toast({
        title: "Chatbot imported",
        description: "Chatbot imported successfully",
      });
      if (created?.id) {
        setLocation(`/chatbots/${created.id}`);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to import chatbot",
        description: error?.message || "Please upload a valid chatbot JSON file",
        variant: "destructive",
      });
    },
  });

  const handleImportChatbot = () => {
    if (!importFile) {
      toast({
        title: "No file selected",
        description: "Please choose a chatbot .json file to import.",
        variant: "destructive",
      });
      return;
    }
    if (!importFile.name.toLowerCase().endsWith(".json")) {
      toast({
        title: "Invalid file type",
        description: "Please upload a .json file.",
        variant: "destructive",
      });
      return;
    }
    importMutation.mutate(importFile);
  };

  const cloneMutation = useMutation({
    mutationFn: async (chatbot: Chatbot) => {
      // Fetch full chatbot (includes nodes)
      const fullRes = await apiRequest("GET", `/api/chatbots/${chatbot.id}`);
      const full = await fullRes.json();

      // Create new chatbot (force draft on clone)
      const newName = `${full.name || chatbot.name} (Copy)`;
      const createRes = await apiRequest("POST", "/api/chatbots", {
        name: newName,
        status: "draft",
        sessionId: full.sessionId || undefined,
      });
      const created = await createRes.json();

      // Clone nodes (if any)
      const nodes = Array.isArray(full.nodes) ? full.nodes : [];
      if (nodes.length > 0) {
        const clonedNodes = nodes.map((n: any) => ({
          chatbotId: created.id,
          nodeType: n.nodeType,
          position: n.position,
          data: n.data,
          connections: Array.isArray(n.connections) ? n.connections : [],
        }));
        await apiRequest("POST", `/api/chatbots/${created.id}/nodes`, { nodes: clonedNodes });
      }

      return created;
    },
    onMutate: (chatbot) => {
      setCloningChatbotId(chatbot.id);
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chatbots"] });
      toast({
        title: "Chatbot cloned",
        description: "Chatbot cloned successfully",
      });
      if (created?.id) {
        setLocation(`/chatbots/${created.id}`);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to clone chatbot",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setCloningChatbotId(null);
    },
  });

  const handleDownloadChatbot = async (chatbot: Chatbot) => {
    try {
      setDownloadingChatbotId(chatbot.id);
      const fullRes = await apiRequest("GET", `/api/chatbots/${chatbot.id}`);
      const full = await fullRes.json();

      const fileNameSafe = String(full.name || chatbot.name || "chatbot")
        .trim()
        .replace(/[^a-z0-9-_ ]/gi, "")
        .replace(/\s+/g, "_")
        .slice(0, 60);

      const payload = {
        exportedAt: new Date().toISOString(),
        chatbot: {
          id: full.id,
          name: full.name,
          status: full.status,
          sessionId: full.sessionId || null,
          createdAt: full.createdAt,
          updatedAt: full.updatedAt,
        },
        nodes: Array.isArray(full.nodes) ? full.nodes : [],
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileNameSafe || "chatbot"}_${chatbot.id}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Download started",
        description: "Chatbot JSON has been downloaded.",
      });
    } catch (error: any) {
      toast({
        title: "Failed to download chatbot",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setDownloadingChatbotId(null);
    }
  };

  const filteredChatbots = chatbots.filter((chatbot) =>
    chatbot.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (data: ChatbotFormData) => {
    createMutation.mutate(data);
  };

  const handleDelete = () => {
    if (selectedChatbot) {
      deleteMutation.mutate(selectedChatbot.id);
    }
  };

  return (
    <div className={cn("flex flex-1 flex-col space-y-6", skin ? "" : "p-6")}>
      {hasUnverifiedBusinessNumber && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-200">
              WhatsApp Business number is not verified
            </p>
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
              Messages are sent normally. For best deliverability, verify your number in Meta Business
              Manager (Connect).
            </p>
            <Link
              href="/connect"
              className="mt-2 inline-block text-sm font-medium text-amber-800 underline dark:text-amber-200"
            >
              Verify in Connect →
            </Link>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="chatbots-page-chrome min-w-0 space-y-4">
          <div className="text-sm text-muted-foreground">Dashboard &gt; Chatbot-V2</div>
          <div>
            <h1 className="text-3xl font-bold">Chatbots</h1>
            <p className="mt-1 text-muted-foreground">Manage Chatbots</p>
          </div>
        </div>
        <div className={cn("flex flex-wrap items-center justify-end gap-2", skin && "ml-auto w-full sm:w-auto")}>
          {!isAtlas && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={demoGoogleSheetMutation.isPending}
                onClick={() => demoGoogleSheetMutation.mutate()}
                title="Creates a published demo: 10 questions → Google Sheet (needs Sheets + WhatsApp)"
              >
                {demoGoogleSheetMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                )}
                Demo: Google Sheet
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={demoHttpMutation.isPending}
                onClick={() => demoHttpMutation.mutate()}
                title="Creates a published demo: ask reply -> HTTP GET -> HTTP POST"
              >
                {demoHttpMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Globe className="w-4 h-4 mr-2" />
                )}
                Demo: HTTP Test
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation("/chatbots/dummy")}
          >
            <LayoutGrid className="w-4 h-4 mr-2" />
            Dummy Chatbot
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportDialogOpen(true)}
          >
            <Upload className="w-4 h-4 mr-2" />
            Import Chatbot
          </Button>
          <Button
            onClick={() => setCreateDialogOpen(true)}
            size="sm"
            className={primaryBtnClass}
            data-testid="button-create-chatbot"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Chatbot
          </Button>
        </div>
      </div>

      {skin ? (
        <RhSearchField
          className="max-w-sm"
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search chatbots…"
        />
      ) : (
        <div className="flex items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
            <Input
              placeholder="Search chatbots..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading chatbots...</div>
        </div>
      ) : filteredChatbots.length === 0 ? (
        isAtlas ? (
          <div className="rh-chatbots-empty">
            <div className="rh-chatbots-empty-icon">
              <MessageSquare className="h-7 w-7" />
            </div>
            <h3 className="rh-chatbots-empty-title">No chatbots found</h3>
            <p className="rh-chatbots-empty-desc">
              {searchQuery
                ? "Try adjusting your search to find what you're looking for."
                : "You haven't created any chatbots yet. Start by building your first automated assistant to engage with your visitors."}
            </p>
            {!searchQuery && (
              <Button
                onClick={() => setCreateDialogOpen(true)}
                className={cn("rh-chatbots-empty-cta", primaryBtnClass)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create your first chatbot
              </Button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">No chatbots found</p>
              <Button
                onClick={() => setCreateDialogOpen(true)}
                size="sm"
                className={primaryBtnClass}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create your first chatbot
              </Button>
            </div>
          </div>
        )
      ) : (
        <div className={cn("rounded-lg border", skin && "rh-table-card bg-white")}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Chatbot ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredChatbots.map((chatbot) => (
                <TableRow
                  key={chatbot.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setLocation(`/chatbots/${chatbot.id}`)}
                >
                  <TableCell className="font-medium">{chatbot.name}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-sm">
                    {chatbot.id}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Switch
                      checked={chatbot.status === "published"}
                      disabled={statusUpdatingId === chatbot.id}
                      onCheckedChange={(checked) =>
                        updateStatusMutation.mutate({
                          id: chatbot.id,
                          status: checked ? "published" : "draft",
                        })
                      }
                      aria-label={
                        chatbot.status === "published"
                          ? "Published — turn off to set as draft"
                          : "Draft — turn on to publish"
                      }
                      className={skin ? "data-[state=checked]:bg-[var(--rh-brand)]" : undefined}
                    />
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setLocation(`/chatbots/${chatbot.id}`)}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => cloneMutation.mutate(chatbot)}
                            disabled={cloningChatbotId === chatbot.id}
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            {cloningChatbotId === chatbot.id ? "Cloning..." : "Clone"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => void handleDownloadChatbot(chatbot)}
                            disabled={downloadingChatbotId === chatbot.id}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            {downloadingChatbotId === chatbot.id ? "Preparing..." : "Download"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedChatbot(chatbot);
                              setDeleteDialogOpen(true);
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Chatbot</DialogTitle>
            <DialogDescription>
              Create a new chatbot to automate your conversations
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(handleCreate)}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Chatbot Name</label>
                <Input
                  {...register("name")}
                  placeholder="Enter chatbot name"
                  className={errors.name ? "border-destructive" : ""}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">
                    {errors.name.message}
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreateDialogOpen(false);
                  reset();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Chatbot</DialogTitle>
            <DialogDescription>
              Upload the chatbot JSON file (downloaded from the “Download” option).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Input
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setImportFile(file);
              }}
            />
            {importFile && (
              <p className="text-sm text-muted-foreground">
                Selected: {importFile.name}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setImportDialogOpen(false);
                setImportFile(null);
              }}
              disabled={importMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleImportChatbot}
              disabled={!importFile || importMutation.isPending}
            >
              {importMutation.isPending ? "Importing..." : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Chatbot</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedChatbot?.name}"? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setSelectedChatbot(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

