import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { useRatehonkPageSkin } from "@/panel-templates/ratehonk-v1/RatehonkSkinContext";
import { RhSearchField } from "@/panel-templates/ratehonk-v1/components/rh";
import { LEAD_STATUS_COLOR_PRESETS } from "@shared/lead-statuses";
import { cn } from "@/lib/utils";
import type { OrganizationLeadStatusRow } from "@/components/leads/lead-utils";

type StatusForm = {
  name: string;
  color: string;
  isDefault: boolean;
};

const emptyForm = (): StatusForm => ({ name: "", color: LEAD_STATUS_COLOR_PRESETS[0], isDefault: false });

export default function LeadStatusSettingsPage() {
  const skin = useRatehonkPageSkin();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OrganizationLeadStatusRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OrganizationLeadStatusRow | null>(null);
  const [form, setForm] = useState<StatusForm>(emptyForm());

  const { data, isLoading } = useQuery({
    queryKey: ["/api/leads/statuses"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/leads/statuses");
      return res.json() as { statuses: OrganizationLeadStatusRow[] };
    },
  });

  const statuses = data?.statuses ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return statuses;
    return statuses.filter((s) => s.name.toLowerCase().includes(q) || s.slug.includes(q));
  }, [statuses, search]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        color: form.color,
        isDefault: form.isDefault,
      };
      if (editing) {
        const res = await apiRequest("PATCH", `/api/leads/statuses/${editing.id}`, payload);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || "Update failed");
        }
        return res.json();
      }
      const res = await apiRequest("POST", "/api/leads/statuses", payload);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Create failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads/statuses"] });
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm());
      toast({ title: editing ? "Status updated" : "Status created" });
    },
    onError: (e: Error) => {
      toast({ variant: "destructive", title: "Error", description: e.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/leads/statuses/${id}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Delete failed");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads/statuses"] });
      setDeleteTarget(null);
      toast({ title: "Status deleted" });
    },
    onError: (e: Error) => {
      toast({ variant: "destructive", title: "Error", description: e.message });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const res = await apiRequest("PATCH", "/api/leads/statuses/reorder", { orderedIds });
      if (!res.ok) throw new Error("Reorder failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads/statuses"] });
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (row: OrganizationLeadStatusRow) => {
    setEditing(row);
    setForm({ name: row.name, color: row.color, isDefault: row.isDefault });
    setDialogOpen(true);
  };

  const moveRow = (index: number, direction: -1 | 1) => {
    const list = [...statuses];
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    reorderMutation.mutate(list.map((s) => s.id));
  };

  const inputClass = skin ? "h-11 rounded-xl border-[#e5e7eb]" : "";
  const pageShell = cn(
    "mx-auto w-full space-y-6 rh-page-gutter",
    skin
      ? "px-6 py-5 sm:px-10 sm:py-6 md:px-14 lg:px-16"
      : "container max-w-3xl px-6 sm:px-10 py-8",
  );
  const primaryBtn = skin ? "bg-[#0059bb] hover:bg-[#004a9a] text-white" : "";

  return (
    <div className={pageShell}>
      {!skin && (
        <div>
          <h1 className="text-2xl font-bold text-[#111c2d]">Lead Status</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure pipeline columns shown on the Leads board.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white p-1">
          <Button type="button" size="sm" className={cn("rounded-md", skin && primaryBtn)}>
            Status
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {skin ? (
            <RhSearchField value={search} onChange={setSearch} placeholder="Search status" className="w-48" />
          ) : (
            <div className="relative w-48">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className={cn("pl-9", inputClass)}
                placeholder="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}
          <Button className={cn(primaryBtn)} onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Lead Status
          </Button>
        </div>
      </div>

      <div className={cn("rounded-xl border border-[#e5e7eb] bg-white", skin && "shadow-sm")}>
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No statuses found.</p>
        ) : (
          <ul className="divide-y divide-[#e5e7eb]">
            {filtered.map((row, index) => {
              const realIndex = statuses.findIndex((s) => s.id === row.id);
              return (
                <li key={row.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex flex-col gap-0.5 text-[#9ca3af]">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={realIndex <= 0 || reorderMutation.isPending}
                      onClick={() => moveRow(realIndex, -1)}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <GripVertical className="h-4 w-4 mx-auto opacity-40" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={realIndex >= statuses.length - 1 || reorderMutation.isPending}
                      onClick={() => moveRow(realIndex, 1)}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f3f4f6] text-sm font-semibold text-[#414754]">
                    {realIndex + 1}
                  </span>
                  <span
                    className="inline-flex min-w-[120px] items-center justify-center rounded-md px-4 py-2 text-sm font-semibold text-[#111c2d]"
                    style={{ backgroundColor: row.color }}
                  >
                    {row.name}
                    {row.isDefault ? (
                      <span className="ml-2 text-[10px] font-normal opacity-70">(default)</span>
                    ) : null}
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                      onClick={() => openEdit(row)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 border-rose-200 text-rose-600 hover:bg-rose-50"
                      onClick={() => setDeleteTarget(row)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Lead Status" : "Add Lead Status"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Hot Lead"
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {LEAD_STATUS_COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={cn(
                      "h-8 w-8 rounded-full border-2 transition-transform",
                      form.color === c ? "border-[#0059bb] scale-110" : "border-transparent",
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                  />
                ))}
              </div>
              <Input
                value={form.color}
                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                placeholder="#dbeafe"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="isDefault"
                checked={form.isDefault}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isDefault: v === true }))}
              />
              <Label htmlFor="isDefault" className="font-normal cursor-pointer">
                Default status for new leads
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className={primaryBtn}
              disabled={!form.name.trim() || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{deleteTarget?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Leads using this status must be moved before deletion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
