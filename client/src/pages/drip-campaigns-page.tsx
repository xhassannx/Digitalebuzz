import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Plus,
  Upload,
  Wand2,
  MoreVertical,
  Play,
  Pause,
  Trash2,
  Pencil,
  Loader2,
} from "lucide-react";
import { dripTriggerLabel, getCampaignEntryTriggers } from "@shared/drip-campaigns";
import { useRatehonkPageSkin } from "@/panel-templates/ratehonk-v1/RatehonkSkinContext";
import { RhCard } from "@/panel-templates/ratehonk-v1/components/rh";
import { rhMuted, rhPageTitle } from "@/panel-templates/ratehonk-v1/rhTheme";
import { cn } from "@/lib/utils";

type LeadStatus = { id: string; name: string; slug?: string; key?: string };

type DripCampaignRow = {
  id: string;
  name: string;
  goal: string;
  entryTrigger: string;
  triggerConfig?: { entryTriggers?: string[] } | null;
  status: string;
  activeContacts: number;
  totalEnrolled: number;
  updatedAt: string;
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  paused: "bg-amber-50 text-amber-700 border-amber-200",
  archived: "bg-gray-100 text-gray-600 border-gray-200",
};

export default function DripCampaignsPage() {
  const { toast } = useToast();
  const skin = useRatehonkPageSkin();
  const [, setLocation] = useLocation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: campaignsData, isLoading } = useQuery<DripCampaignRow[] | { campaigns?: DripCampaignRow[] }>({
    queryKey: ["/api/drip-campaigns"],
  });
  const campaigns: DripCampaignRow[] = Array.isArray(campaignsData)
    ? campaignsData
    : Array.isArray(campaignsData?.campaigns)
      ? campaignsData.campaigns
      : [];

  const { data: leadStatusData } = useQuery<{ statuses?: LeadStatus[] } | LeadStatus[]>({
    queryKey: ["/api/leads/statuses"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/leads/statuses");
      return res.json();
    },
  });
  // Same cache key as Leads page (`{ statuses }`) — normalize so SPA nav from Leads doesn't crash.
  const leadStatuses: LeadStatus[] = Array.isArray(leadStatusData)
    ? leadStatusData
    : Array.isArray(leadStatusData?.statuses)
      ? leadStatusData.statuses
      : [];

  const leadStatusNames = useMemo(
    () =>
      Object.fromEntries(
        leadStatuses.map((s) => [s.slug || s.key || s.name, s.name]).filter(([k]) => !!k),
      ) as Record<string, string>,
    [leadStatuses],
  );

  const activateMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/drip-campaigns/${id}/activate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drip-campaigns"] });
      toast({
        title: "Campaign activated",
        description: "Leads already in matching status boards were enrolled.",
      });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const pauseMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/drip-campaigns/${id}/pause`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drip-campaigns"] });
      toast({ title: "Campaign paused" });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/drip-campaigns/${id}`);
    },
    onSuccess: () => {
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/drip-campaigns"] });
      toast({ title: "Campaign deleted" });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const importMutation = useMutation({
    mutationFn: async (payload: unknown) => {
      await apiRequest("POST", "/api/drip-campaigns/import", { campaign: payload });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drip-campaigns"] });
      toast({ title: "Campaign imported" });
    },
    onError: (e: Error) => toast({ title: "Import failed", description: e.message, variant: "destructive" }),
  });

  const onImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      importMutation.mutate(json);
    } catch {
      toast({ title: "Invalid JSON file", variant: "destructive" });
    }
  };

  const primaryBtn = skin
    ? "bg-[var(--rh-brand)] hover:bg-[var(--rh-brand-hover)] text-white"
    : "bg-emerald-600 hover:bg-emerald-700 text-white";

  const pageShell = cn(
    "mx-auto w-full space-y-6",
    skin
      ? "px-4 py-5 sm:px-8 sm:py-6 md:px-10 lg:px-12 max-w-[1400px]"
      : "p-4 md:p-6 max-w-[1400px]",
  );

  const tableBody = (
    <>
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-3 border-b",
          skin ? "border-[#f3f4f6] bg-[#fafbff]" : "bg-muted/30",
        )}
      >
        <Wand2
          className={cn("h-4 w-4", skin ? "text-[var(--rh-brand)]" : "text-teal-600")}
        />
        <h2 className={cn("font-medium text-sm", skin && "text-[#111c2d]")}>
          Active Automation Workflows
        </h2>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading automations…
        </div>
      ) : campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center text-muted-foreground">
          <Wand2 className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-sm">No automations found. Create or import your first sequence!</p>
          <Button
            className={cn("mt-4 gap-2", primaryBtn)}
            onClick={() => setLocation("/drip-campaigns/create")}
          >
            <Plus className="h-4 w-4" />
            Create Automation
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="uppercase text-xs tracking-wide">Campaign Details</TableHead>
                <TableHead className="uppercase text-xs tracking-wide">Goal & Trigger</TableHead>
                <TableHead className="uppercase text-xs tracking-wide">Active Contacts</TableHead>
                <TableHead className="uppercase text-xs tracking-wide">Total Enrolled</TableHead>
                <TableHead className="uppercase text-xs tracking-wide">Status</TableHead>
                <TableHead className="uppercase text-xs tracking-wide text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/drip-campaigns/${c.id}/edit`} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{c.goal}</div>
                    <div className="text-xs text-muted-foreground">
                      {getCampaignEntryTriggers(c)
                        .map((t) => dripTriggerLabel(t, { leadStatusNames }))
                        .join(", ")}
                    </div>
                  </TableCell>
                  <TableCell>{c.activeContacts}</TableCell>
                  <TableCell>{c.totalEnrolled}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn("capitalize", STATUS_STYLES[c.status] || STATUS_STYLES.draft)}
                    >
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setLocation(`/drip-campaigns/${c.id}/edit`)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        {c.status !== "active" ? (
                          <DropdownMenuItem onClick={() => activateMutation.mutate(c.id)}>
                            <Play className="h-4 w-4 mr-2" />
                            Activate
                          </DropdownMenuItem>
                        ) : (
                          <>
                            <DropdownMenuItem onClick={() => activateMutation.mutate(c.id)}>
                              <Play className="h-4 w-4 mr-2" />
                              Sync board leads
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => pauseMutation.mutate(c.id)}>
                              <Pause className="h-4 w-4 mr-2" />
                              Pause
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(c.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );

  return (
    <div className={pageShell}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className={skin ? rhPageTitle : "text-2xl md:text-3xl font-semibold tracking-tight"}>
            CRM Automations
          </h1>
          <p
            className={cn(
              "mt-1 text-sm md:text-base max-w-2xl",
              skin ? rhMuted : "text-muted-foreground",
            )}
          >
            Manage premium HubSpot/GoHighLevel-style automation flows, marketing campaigns, and
            auto-responders.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImportFile(f);
              e.target.value = "";
            }}
          />
          <Button
            variant="outline"
            className={cn("gap-2", skin && "rounded-xl border-[#e5e7eb]")}
            onClick={() => fileRef.current?.click()}
            disabled={importMutation.isPending}
          >
            {importMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Import Campaign
          </Button>
          <Button className={cn("gap-2", primaryBtn)} onClick={() => setLocation("/drip-campaigns/create")}>
            <Plus className="h-4 w-4" />
            Create Automation
          </Button>
        </div>
      </div>

      {skin ? (
        <RhCard className="overflow-hidden p-0 shadow-sm">{tableBody}</RhCard>
      ) : (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">{tableBody}</div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete drip campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the campaign and all enrollments. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
