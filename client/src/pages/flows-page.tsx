import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, MoreVertical, Zap, X, Loader2, BookOpen, CalendarClock } from "lucide-react";
import { Link } from "wouter";

/** Dev-only seed buttons on the listing page (hidden in production UI). */
const SHOW_FLOW_SEED_BUTTONS = false;
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useInitialUrlSearch } from "@/hooks/use-initial-url-search";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  getDummyFlowTemplates,
  allocateUniqueFlowName,
  getEmptyCanvasFlowGraph,
  buildLinearFlowFromDummyTemplate,
} from "@/lib/dummy-flows";
import { getStarterFlowsToCreate, STARTER_FLOW_NAME_PREFIX } from "@/lib/starter-flow-pack";
import { buildAutofilledIntegrationDemoFlow } from "@/lib/integration-demo-flow-autofill";
import {
  allocateDripCampaignFlowName,
  buildContactDripCampaignFlow,
  CONTACT_DRIP_CAMPAIGN_FLOW_NAME,
} from "@/lib/contact-drip-campaign-flow";
import { useRatehonkPageSkin } from "@/panel-templates/ratehonk-v1/RatehonkSkinContext";
import { RhSearchField, RhSegmentedTabs } from "@/panel-templates/ratehonk-v1/components/rh";
import { cn } from "@/lib/utils";
import { useListPaginationState, parsePaginatedListResponse, useDebouncedValue, fetchLegacyListApi } from "@/lib/list-pagination";
import { ListPaginationFooter } from "@/components/list-pagination-footer";

type FlowStatus = "active" | "inactive" | "draft";

type AutomationFlow = {
  id: string;
  name: string;
  status: FlowStatus;
  createdAt: string;
  updatedAt: string;
  nodes?: unknown[];
  edges?: unknown[];
  linearFlow?: unknown;
};

const FLOW_FILTER_TABS = [
  { value: "all", label: "All flows" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
] as const;

export default function FlowsPage() {
  const skin = useRatehonkPageSkin();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  useInitialUrlSearch(setSearchQuery);
  const [filterTab, setFilterTab] = useState<"all" | "active" | "inactive">("all");
  const [sortBy, setSortBy] = useState("newest");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFlowName, setNewFlowName] = useState("");
  const [creatingAllTypes, setCreatingAllTypes] = useState(false);
  const [addingSmokeTest, setAddingSmokeTest] = useState(false);
  const [creatingDripTest, setCreatingDripTest] = useState(false);
  const {
    currentPage,
    setCurrentPage,
    rowsPerPage,
    setRowsPerPage,
    resetPage,
    paginationParams,
  } = useListPaginationState(10);
  const debouncedSearchQuery = useDebouncedValue(searchQuery);

  const { data: flowsResponse, isLoading } = useQuery({
    queryKey: ["/api/automation-flows", debouncedSearchQuery, filterTab, sortBy, currentPage, rowsPerPage],
    queryFn: async () => {
      const params = new URLSearchParams(paginationParams.toString());
      if (debouncedSearchQuery.trim()) params.set("search", debouncedSearchQuery.trim());
      if (filterTab === "active" || filterTab === "inactive") params.set("status", filterTab);
      if (sortBy) params.set("sort", sortBy);
      const res = await apiRequest("GET", `/api/automation-flows?${params.toString()}`);
      return res.json();
    },
  });

  const { items: flows, total: totalFlows } = parsePaginatedListResponse<AutomationFlow>(
    flowsResponse,
    "flows",
  );

  useEffect(() => {
    resetPage();
  }, [debouncedSearchQuery, filterTab, sortBy, resetPage]);

  const fetchExistingFlowNames = async () => {
    const allFlows = await fetchLegacyListApi<{ name: string }>("/api/automation-flows", "flows");
    return new Set(allFlows.map((f) => f.name));
  };

  const createMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      status?: string;
      nodes?: unknown[];
      edges?: unknown[];
      linearFlow?: unknown;
    }) => {
      const res = await apiRequest("POST", "/api/automation-flows", data);
      return res.json();
    },
    onSuccess: (flow) => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation-flows"] });
      toast({ title: "Flow created", description: `"${flow.name}" has been created.` });
      setLocation(`/flows/edit/${flow.id}`);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AutomationFlow> }) => {
      const res = await apiRequest("PUT", `/api/automation-flows/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation-flows"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/automation-flows/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation-flows"] });
      toast({ title: "Flow deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  /** Creates 5 starters: 2 canvas graphs from built-in samples + 3 simple flows (full example pack × 3 triggers). */
  const handleCreateAllFlowTypes = async () => {
    const existingNames = await fetchExistingFlowNames();
    const toCreate = getStarterFlowsToCreate(existingNames);
    if (toCreate.length === 0) {
      toast({
        title: "Already created",
        description: `All flows named "${STARTER_FLOW_NAME_PREFIX} …" are already in your list. Delete them to recreate.`,
      });
      return;
    }
    setCreatingAllTypes(true);
    try {
      for (const body of toCreate) {
        await apiRequest("POST", "/api/automation-flows", body);
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/automation-flows"] });
      toast({
        title: "Flow types created",
        description: `Added ${toCreate.length} flow(s): canvas graphs match “Add Sample Flows” examples 1–2; simple flows include the full integration example pack. Use ⋮ → Edit (canvas) or Edit (simple).`,
      });
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create starter flows",
        variant: "destructive",
      });
    } finally {
      setCreatingAllTypes(false);
    }
  };

  const handleCreateDripTestFlow = async () => {
    const taken = await fetchExistingFlowNames();
    setCreatingDripTest(true);
    try {
      const template = buildContactDripCampaignFlow();
      const name = allocateDripCampaignFlowName(taken);
      const res = await apiRequest("POST", "/api/automation-flows", {
        name,
        status: template.status,
        nodes: template.nodes,
        edges: template.edges,
        linearFlow: template.linearFlow,
      });
      const flow = await res.json();
      await queryClient.invalidateQueries({ queryKey: ["/api/automation-flows"] });
      toast({
        title: "Drip test flow created",
        description: `${name} — New Contact → tag → assign → welcome + 3 day follow-ups. Publish after configuring WhatsApp connection, then create a contact to test.`,
      });
      setLocation(`/flows/edit/${flow.id}`);
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create drip test flow",
        variant: "destructive",
      });
    } finally {
      setCreatingDripTest(false);
    }
  };

  const handleAddIntegrationSmokeTest = async () => {
    const taken = await fetchExistingFlowNames();
    setAddingSmokeTest(true);
    try {
      const p = await buildAutofilledIntegrationDemoFlow();
      const name = allocateUniqueFlowName(p.name, taken);
      const { autofillWarnings, connectedTags } = p;
      await apiRequest("POST", "/api/automation-flows", {
        name,
        status: p.status,
        nodes: p.nodes,
        edges: p.edges,
        linearFlow: p.linearFlow,
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/automation-flows"] });
      const stepsHint =
        connectedTags.length > 0
          ? ` Includes ${connectedTags.length} integration step(s): ${connectedTags.join(", ")}.`
          : "";
      const warnSuffix =
        autofillWarnings.length > 0
          ? ` Some items need manual setup: ${autofillWarnings.slice(0, 3).join(" ")}${
              autofillWarnings.length > 3 ? ` (+${autofillWarnings.length - 3} more)` : ""
            }`
          : " Connections and resources were filled from your Integrations page where available.";
      toast({
        title: "Integration test flow added",
        description: `${name}.${stepsHint} Open in Advanced editor to verify each step.${warnSuffix}`,
      });
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to add smoke-test flow",
        variant: "destructive",
      });
    } finally {
      setAddingSmokeTest(false);
    }
  };

  const handleSeedDummyFlows = async () => {
    const templates = getDummyFlowTemplates();
    const taken = await fetchExistingFlowNames();
    try {
      let added = 0;
      for (const t of templates) {
        const name = allocateUniqueFlowName(t.name, taken);
        taken.add(name);
        await apiRequest("POST", "/api/automation-flows", {
          name,
          status: t.status,
          nodes: t.nodes ?? [],
          edges: t.edges ?? [],
          linearFlow: buildLinearFlowFromDummyTemplate(t),
        });
        added += 1;
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/automation-flows"] });
      toast({
        title: "Sample flows added",
        description: `Created ${added} flow(s). Each includes a matching simple (linear) definition so Simple and Canvas editors show the same steps. Duplicate titles get “ (2)”, “ (3)”, etc.`,
      });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to add sample flows", variant: "destructive" });
    }
  };

  const handleCreateFlow = () => {
    const name = (newFlowName || "My Awesome Flow").trim();
    if (!name) return;
    setNewFlowName("");
    setShowCreateModal(false);
    const { nodes, edges } = getEmptyCanvasFlowGraph();
    createMutation.mutate({
      name,
      status: "inactive",
      nodes,
      edges,
      linearFlow: buildLinearFlowFromDummyTemplate({ nodes, edges }),
    });
  };

  const handleToggleStatus = (flow: AutomationFlow) => {
    const nextStatus = flow.status === "active" ? "inactive" : "active";
    updateMutation.mutate({ id: flow.id, data: { status: nextStatus } });
    toast({ title: nextStatus === "active" ? "Published" : "Unpublished", description: `Flow has been ${nextStatus === "active" ? "published" : "unpublished"}.` });
  };

  const handleDeleteFlow = (flow: AutomationFlow) => {
    if (!confirm(`Delete flow "${flow.name}"?`)) return;
    deleteMutation.mutate(flow.id);
  };

  const hasActiveFilters =
    !!debouncedSearchQuery.trim() || filterTab !== "all";

  const primaryBtnClass = skin
    ? "bg-[#0059bb] hover:bg-[#004a9a] text-white hover:text-white border-0"
    : "bg-orange-500 hover:bg-orange-600 text-white";

  const docLinkClass = skin ? "text-[#0059bb] hover:underline font-medium" : "text-orange-600 hover:underline font-medium";
  const editLinkClass = skin
    ? "font-medium text-[#0059bb] hover:underline"
    : "font-medium text-orange-600 hover:underline";

  const dripTestButton = (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCreateDripTestFlow}
      disabled={creatingDripTest}
      title={`Creates "${CONTACT_DRIP_CAMPAIGN_FLOW_NAME}" with tag, assign, note, WhatsApp messages, and 1-day delays`}
      className="shrink-0"
    >
      {creatingDripTest ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <CalendarClock className="h-4 w-4 mr-2" />
      )}
      Drip test flow
    </Button>
  );

  const newFlowButton = (
    <Button
      variant={skin ? "default" : "default"}
      size="sm"
      className={cn("shrink-0", primaryBtnClass)}
      onClick={() => setShowCreateModal(true)}
    >
      <Plus className="h-4 w-4 mr-2" />
      New flow
    </Button>
  );

  const filterToolbarControls = (
    <>
      {skin ? (
        <RhSearchField
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search flows…"
          className="w-full min-w-[180px] max-w-xs"
        />
      ) : (
        <div className="relative w-full min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search flows..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      )}
      <Select value={sortBy} onValueChange={setSortBy}>
        <SelectTrigger className={cn("w-[130px] shrink-0", skin && "rounded-xl border-[#e5e7eb] bg-white")}>
          <SelectValue placeholder="Sort" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">Newest</SelectItem>
          <SelectItem value="oldest">Oldest</SelectItem>
          <SelectItem value="name">Name</SelectItem>
        </SelectContent>
      </Select>
      <Button variant="outline" size="sm" asChild className="shrink-0">
        <Link href="/flows/documentation">
          <BookOpen className="h-4 w-4 mr-2" />
          Docs
        </Link>
      </Button>
      {dripTestButton}
    </>
  );

  return (
    <div className={cn("h-full overflow-auto", skin && "bg-[#f9f9ff]")}>
      <div
        className={cn(
          skin
            ? "rh-page-shell mx-auto h-full w-full max-w-[1400px] space-y-4 py-0 sm:space-y-6"
            : "max-w-[95%] mx-auto p-6 space-y-6",
        )}
      >
        <div className="flows-page-chrome">
          <div className="text-sm text-muted-foreground">Dashboard &gt; Flows</div>
          <div className="mt-4">
            <h1 className="text-3xl font-semibold">Flows</h1>
            <p className="text-muted-foreground mt-1">
              Create and manage your automation workflows.{" "}
              <Link href="/flows/documentation" className={docLinkClass}>
                View documentation
              </Link>
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {skin ? (
              <RhSegmentedTabs
                value={filterTab}
                onChange={(v) => setFilterTab(v as typeof filterTab)}
                options={[...FLOW_FILTER_TABS]}
                className="w-full max-w-md shrink-0"
              />
            ) : (
              <Tabs value={filterTab} onValueChange={(v) => setFilterTab(v as typeof filterTab)} className="shrink-0">
                <TabsList>
                  <TabsTrigger value="all">All flows</TabsTrigger>
                  <TabsTrigger value="active">Active</TabsTrigger>
                  <TabsTrigger value="inactive">Inactive</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
            <div className="flex shrink-0 justify-end">{newFlowButton}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">{filterToolbarControls}</div>
        </div>

        <Card className={cn(skin && "flows-table-card bg-white")}>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2
                  className={cn(
                    "h-8 w-8 animate-spin",
                    skin ? "text-[#0059bb]" : "text-muted-foreground",
                  )}
                />
              </div>
            ) : flows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground">
                  {totalFlows === 0 && !hasActiveFilters ? "No flows yet." : "No flows match your filters."}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Create an automation flow to get started.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {dripTestButton}
                  {newFlowButton}
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">NAME</TableHead>
                      <TableHead className="w-[120px]">STATUS</TableHead>
                      <TableHead className="w-[140px]">CREATED</TableHead>
                      <TableHead className="w-[140px]">UPDATED</TableHead>
                      <TableHead className="w-[80px]">ACTIONS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {flows.map((flow) => (
                      <TableRow key={flow.id}>
                        <TableCell>
                          <Link href={`/flows/edit/${flow.id}`} className={editLinkClass}>
                            {flow.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {flow.status === "active" ? (
                            <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                              <Zap className="h-3 w-3" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1 text-muted-foreground">
                              <X className="h-3 w-3" />
                              Inactive
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(flow.createdAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "2-digit",
                          })}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(flow.updatedAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "2-digit",
                          })}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setLocation(`/flows/edit/${flow.id}`)}>
                                Edit flow
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleToggleStatus(flow)}
                                disabled={updateMutation.isPending}
                              >
                                {flow.status === "active" ? "Unpublish" : "Publish"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleDeleteFlow(flow)}
                                disabled={deleteMutation.isPending}
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="border-t px-4 py-3">
                  <ListPaginationFooter
                    total={totalFlows}
                    currentPage={currentPage}
                    rowsPerPage={rowsPerPage}
                    onPageChange={setCurrentPage}
                    onRowsPerPageChange={setRowsPerPage}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create New Flow Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Flow</DialogTitle>
            <DialogDescription>
              Create a new automation flow. The canvas opens with one empty trigger — choose your app and event, then add
              action steps.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Flow Name</label>
            <Input
              placeholder="My Awesome Flow"
              value={newFlowName}
              onChange={(e) => setNewFlowName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Enter a descriptive name for your flow</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              variant={skin ? "ghost" : "default"}
              className={primaryBtnClass}
              onClick={handleCreateFlow}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Flow →
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
