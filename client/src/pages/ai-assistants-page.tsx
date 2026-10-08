import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Sparkles, Plus, Loader2, Pencil, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useRatehonkPageSkin } from "@/panel-templates/ratehonk-v1/RatehonkSkinContext";
import { cn } from "@/lib/utils";

type AiAssistant = {
  id: string;
  name: string;
  promptType: string;
  agentRole?: string | null;
  model: string;
  createdAt?: string;
  updatedAt?: string;
};

const AGENT_ROLE_LABELS: Record<string, string> = {
  customer_support: "Customer Support Agent",
  coding: "Coding Assistant",
  sales: "Sales Assistant",
  general: "General Assistant",
};

export default function AiAssistantsPage() {
  const skin = useRatehonkPageSkin();
  const [isAtlas, setIsAtlas] = useState(false);
  const primaryBtnClass = skin
    ? "bg-[var(--rh-brand)] hover:bg-[var(--rh-brand-hover)] text-white"
    : "";
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    setIsAtlas(document.documentElement.dataset.panelTemplate === "helicoptic-v1");
  }, []);

  const { data: assistants = [], isLoading } = useQuery<AiAssistant[]>({
    queryKey: ["/api/ai-assistants"],
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/ai-assistants", { name });
      return res.json();
    },
    onSuccess: (data: AiAssistant) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-assistants"] });
      setCreateOpen(false);
      setNewName("");
      toast({ title: "AI Assistant created", description: "You can now configure settings and knowledge base." });
      setLocation(`/ai-assistants/${data.id}/edit`);
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/ai-assistants/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-assistants"] });
      toast({ title: "AI Assistant deleted" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) {
      toast({ variant: "destructive", title: "Name required", description: "Enter an assistant name." });
      return;
    }
    createMutation.mutate(name);
  };

  if (isLoading) {
    return (
      <div
        className={cn(
          "flex min-h-[300px] items-center justify-center",
          skin ? "" : "container mx-auto p-6",
          isAtlas && "rh-ai-assistants-list",
        )}
      >
        <Loader2
          className={cn(
            "h-8 w-8 animate-spin",
            skin ? "text-[var(--rh-brand)]" : "text-primary",
          )}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        skin ? "space-y-6" : "container mx-auto space-y-6 p-6",
        isAtlas && "rh-ai-assistants-list",
      )}
      data-testid="page-ai-assistants"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="ai-assistants-page-chrome min-w-0">
          <h1 className="text-3xl font-bold">AI Assistants</h1>
          <p className="text-muted-foreground">Manage AI Assistants</p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className={cn(primaryBtnClass, isAtlas && "rh-ai-primary-btn rounded-xl")}
        >
          <Plus className="h-4 w-4 mr-2" />
          Create AI Assistant
        </Button>
      </div>

      <div className={cn("rounded-lg border bg-card", skin && "rh-table-card")}>
        {assistants.length === 0 && isAtlas ? (
          <div className="rh-ai-empty">
            <div className="rh-ai-empty-icon">
              <Sparkles className="h-6 w-6" />
            </div>
            <p className="rh-ai-empty-title">No AI assistants yet</p>
            <p className="rh-ai-empty-desc">
              Create an assistant to configure prompts, knowledge base, and agent rules.
            </p>
            <Button
              onClick={() => setCreateOpen(true)}
              className={cn(primaryBtnClass, "rh-ai-primary-btn")}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create AI Assistant
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assistants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-12">
                    No AI assistants yet. Click &quot;Create AI Assistant&quot; to add one.
                  </TableCell>
                </TableRow>
              ) : (
                assistants.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {a.agentRole ? AGENT_ROLE_LABELS[a.agentRole] || a.agentRole : "-"}
                      </Badge>
                    </TableCell>
                    <TableCell>{a.model || "gpt-4o"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(isAtlas && "rounded-xl")}
                          onClick={() => setLocation(`/ai-assistants/${a.id}/edit`)}
                        >
                          <Pencil className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (confirm("Delete this AI assistant?")) deleteMutation.mutate(a.id);
                          }}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className={cn(isAtlas && "sm:rounded-2xl")}>
          <DialogHeader>
            <DialogTitle>Create AI Assistant</DialogTitle>
            <DialogDescription>
              Give your AI assistant a name. You can add OpenAI settings and knowledge base on the next screen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Assistant Name</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter assistant name"
                className={cn("mt-2", isAtlas && "rounded-xl border-[#e5e7eb]")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className={cn(isAtlas && "rounded-xl")} onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending || !newName.trim()}
              className={cn(primaryBtnClass, isAtlas && "rh-ai-primary-btn")}
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
