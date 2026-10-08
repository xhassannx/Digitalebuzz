// @ts-nocheck
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Edit, Search, MoreHorizontal, ArrowUpDown, X, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const FEATURE_LIMITS = [
  { key: "maxMessagesPerMonth", label: "Messages per month", sublabel: "Outgoing WhatsApp messages per calendar month (per subscription)", max: 1_000_000_000 },
  { key: "maxSessions", label: "Active sessions", sublabel: "Simultaneous chat sessions allowed", max: 100 },
  { key: "maxContacts", label: "Contacts", sublabel: "Number of contacts", max: 500000 },
  { key: "maxTeamMembers", label: "Active Team Members", sublabel: "Number of active team members who can access the system", max: 50 },
  { key: "maxWorkflows", label: "Active Workflows", sublabel: "Number of active automation workflows", max: 50 },
  { key: "maxChatbots", label: "Active Chatbots", sublabel: "Number of active chatbots", max: 50 },
  { key: "maxWabaNumbers", label: "Active WABA Numbers", sublabel: "Number of active WhatsApp Business API numbers", max: 50 },
];

type Plan = {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  priceMonthly: number;
  priceQuarterly: number;
  priceYearly: number;
  features: Record<string, any>;
  isActive: boolean;
  status?: string;
  isPopular?: boolean;
  isInternational?: boolean;
  gstType?: string;
  gstPercent?: number;
  serviceChargePercent?: number;
  serviceChargeFixed?: number;
  currency?: string;
  defaultBillingCycle?: string;
  planFeatures?: string[];
  isSystemDefault?: boolean;
  createdAt: string;
};

export default function AdminPlansPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [cycleFilter, setCycleFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<Plan | null>(null);

  const { data, isLoading, refetch } = useQuery<{ plans: Plan[] }>({
    queryKey: ["/api/admin/plans"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/plans");
      return await res.json();
    },
  });

  const ensureFreeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/plans/ensure-system-free");
      return await res.json();
    },
    onSuccess: (body) => {
      toast({
        title: "Free plan ready",
        description: body?.message || "System Free plan created (System / Default, Auto on signup 3d).",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Could not create Free plan",
        description:
          error?.message ||
          "On the server for this database, run: npm run db:migrate-system-free-plan",
        variant: "destructive",
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (planData: any) => {
      const res = await apiRequest("POST", "/api/admin/plans", planData);
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Plan created", description: "Subscription plan created successfully" });
      setIsCreateOpen(false);
      refetch();
      // Invalidate queries used by billing page to reflect changes
      queryClient.invalidateQueries({ queryKey: ['/api/plans'] });
      queryClient.invalidateQueries({ queryKey: ['/api/subscriptions/current'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create plan", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ planId, planData }: { planId: string; planData: any }) => {
      const res = await apiRequest("PUT", `/api/admin/plans/${planId}`, planData);
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Plan updated", description: "Subscription plan updated successfully" });
      setEditingPlan(null);
      refetch();
      // Invalidate queries used by billing page to reflect changes
      queryClient.invalidateQueries({ queryKey: ['/api/plans'] });
      queryClient.invalidateQueries({ queryKey: ['/api/subscriptions/current'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update plan", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (planId: string) => {
      const res = await apiRequest("DELETE", `/api/admin/plans/${planId}`);
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Plan deleted", description: "Subscription plan deleted successfully" });
      setDeletingPlan(null);
      refetch();
      // Invalidate queries used by billing page to reflect changes
      queryClient.invalidateQueries({ queryKey: ['/api/plans'] });
      queryClient.invalidateQueries({ queryKey: ['/api/subscriptions/current'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete plan", variant: "destructive" });
    },
  });

  const plans = data?.plans || [];
  const hasSystemFree = plans.some((p) => p.isSystemDefault || p.name === "system_free" || p.name === "free");
  const filtered = plans.filter((p) => {
    const matchSearch =
      !searchQuery ||
      p.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === "all" || (p.status || (p.isActive ? "published" : "draft")) === statusFilter;
    return matchSearch && matchStatus;
  });

  const getPriceForCycle = (plan: Plan) => {
    const cycle = cycleFilter === "all" ? plan.defaultBillingCycle || "monthly" : cycleFilter;
    if (cycle === "yearly") return plan.priceYearly;
    if (cycle === "quarterly") return plan.priceQuarterly;
    return plan.priceMonthly;
  };

  const formatPrice = (cents: number, currency: string = "INR") => {
    const sym = currency === "INR" ? "₹" : "$";
    return `${sym} ${(cents / 100).toLocaleString()}`;
  };

  const openEdit = (plan: Plan) => {
    if (plan.isSystemDefault) {
      toast({
        title: "System plan",
        description: "The system Free plan cannot be edited.",
        variant: "destructive",
      });
      return;
    }
    setEditingPlan(plan);
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold mb-2">Reseller Plans</h1>
          <p className="text-muted-foreground">Manage your pricing plans and subscriptions</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Plan
        </Button>
      </div>

      {!isLoading && !hasSystemFree && (
        <Card className="border-amber-200 bg-amber-50/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-amber-950">System Free plan missing</CardTitle>
            <CardDescription className="text-amber-900/80">
              This database has no locked Free plan (System / Default, Auto on signup 3d). Schema push alone
              does not create it — click below or run{" "}
              <code className="rounded bg-amber-100 px-1 text-xs">npm run db:migrate-system-free-plan</code>{" "}
              with this server&apos;s DATABASE_URL.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => ensureFreeMutation.mutate()}
              disabled={ensureFreeMutation.isPending}
              className="bg-[var(--rh-brand,#047857)] hover:bg-[var(--rh-brand-hover,#065f46)] text-white"
            >
              {ensureFreeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Free plan…
                </>
              ) : (
                "Create system Free plan"
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Plans</CardTitle>
          <CardDescription>Search and filter plans</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search plans..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
            <Select value={cycleFilter} onValueChange={setCycleFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Cycles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cycles</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer">
                      <span className="flex items-center gap-1">
                        Created At <ArrowUpDown className="h-3 w-3" />
                      </span>
                    </TableHead>
                    <TableHead>Plan Name</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>GST</TableHead>
                    <TableHead>Billing Cycle</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No plans found. Create your first plan.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((plan) => (
                      <TableRow key={plan.id}>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(plan.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate max-w-[200px]">{plan.displayName}</span>
                            {plan.isPopular && (
                              <Badge variant="secondary" className="text-xs">
                                Popular
                              </Badge>
                            )}
                            {plan.isSystemDefault && (
                              <Badge variant="outline" className="text-xs border-blue-500 text-blue-700">
                                System / Default
                              </Badge>
                            )}
                            {(plan as any).autoAssignOnSignup && (
                              <Badge variant="outline" className="text-xs border-green-500 text-green-700">
                                Auto on signup ({(plan as any).autoAssignTrialDays ?? 7}d)
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{formatPrice(getPriceForCycle(plan), plan.currency || "INR")}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{plan.gstType || "Inclusive"}</Badge>
                        </TableCell>
                        <TableCell className="capitalize">{plan.defaultBillingCycle || "Yearly"}</TableCell>
                        <TableCell>
                          <Badge
                            variant={plan.status === "published" || plan.isActive ? "default" : "secondary"}
                            className={plan.status === "published" || plan.isActive ? "bg-green-500" : ""}
                          >
                            {plan.status === "published" || plan.isActive ? "Published" : "Draft"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {plan.isSystemDefault ? (
                            <span className="text-xs text-muted-foreground">Locked</span>
                          ) : (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEdit(plan)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setDeletingPlan(plan)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <PlanSheet
        plan={editingPlan}
        isOpen={!!editingPlan || isCreateOpen}
        onClose={() => {
          setEditingPlan(null);
          setIsCreateOpen(false);
        }}
        onSave={(planData) => {
          if (editingPlan) {
            updateMutation.mutate({ planId: editingPlan.id, planData });
          } else {
            createMutation.mutate(planData);
          }
        }}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      <AlertDialog open={!!deletingPlan} onOpenChange={(open) => !open && setDeletingPlan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the plan{" "}
              <span className="font-semibold">{deletingPlan?.displayName}</span> and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deletingPlan) deleteMutation.mutate(deletingPlan.id);
              }}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PlanSheet({
  plan,
  isOpen,
  onClose,
  onSave,
  isLoading,
}: {
  plan: Plan | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  isLoading: boolean;
}) {
  const [form, setForm] = useState({
    name: "",
    displayName: "",
    description: "",
    status: "published",
    isPopular: false,
    isInternational: false,
    price: 0,
    currency: "INR",
    billingCycle: "yearly",
    gstType: "inclusive",
    gstPercent: 0,
    serviceChargePercent: 0,
    serviceChargeFixed: 0,
    maxContacts: 10000,
    maxTeamMembers: 5,
    maxWorkflows: 5,
    maxChatbots: 5,
    maxWabaNumbers: 10,
    maxSessions: 1,
    maxMessagesPerMonth: 100,
    planFeatures: [] as string[],
    newFeature: "",
    autoAssignOnSignup: false,
    autoAssignTrialDays: 7,
  });

  useEffect(() => {
    if (plan) {
      const f = plan.features || {};
      setForm({
        name: plan.name,
        displayName: plan.displayName,
        description: plan.description || "",
        status: plan.status || (plan.isActive ? "published" : "draft"),
        isPopular: plan.isPopular ?? false,
        isInternational: plan.isInternational ?? false,
        price: (plan.defaultBillingCycle === "yearly" ? plan.priceYearly : plan.defaultBillingCycle === "quarterly" ? plan.priceQuarterly : plan.priceMonthly) / 100,
        currency: (plan as any).currency || "INR",
        billingCycle: plan.defaultBillingCycle || "yearly",
        gstType: plan.gstType || "inclusive",
        gstPercent: plan.gstPercent || 0,
        serviceChargePercent: plan.serviceChargePercent || 0,
        serviceChargeFixed: (plan.serviceChargeFixed || 0) / 100,
        maxContacts: f.maxContacts ?? 10000,
        maxTeamMembers: f.maxTeamMembers ?? 5,
        maxWorkflows: f.maxWorkflows ?? 5,
        maxChatbots: f.maxChatbots ?? 5,
        maxWabaNumbers: f.maxWabaNumbers ?? 10,
        maxSessions: f.maxSessions ?? 1,
        maxMessagesPerMonth: f.maxMessagesPerMonth ?? 100,
        planFeatures: plan.planFeatures || [],
        newFeature: "",
        autoAssignOnSignup: (plan as any).autoAssignOnSignup ?? false,
        autoAssignTrialDays: (plan as any).autoAssignTrialDays ?? 7,
      });
    } else if (isOpen) {
      setForm({
        name: "",
        displayName: "",
        description: "",
        status: "published",
        isPopular: false,
        isInternational: false,
        price: 0,
        currency: "INR",
        billingCycle: "yearly",
        gstType: "inclusive",
        gstPercent: 0,
        serviceChargePercent: 0,
        serviceChargeFixed: 0,
        maxContacts: 10000,
        maxTeamMembers: 5,
        maxWorkflows: 5,
        maxChatbots: 5,
        maxWabaNumbers: 10,
        maxSessions: 1,
        maxMessagesPerMonth: 100,
        planFeatures: [],
        newFeature: "",
        autoAssignOnSignup: false,
        autoAssignTrialDays: 7,
      });
    }
  }, [plan, isOpen]);

  const addFeature = () => {
    if (form.newFeature.trim()) {
      setForm((f) => ({ ...f, planFeatures: [...f.planFeatures, f.newFeature.trim()], newFeature: "" }));
    }
  };

  const removeFeature = (i: number) => {
    setForm((f) => ({ ...f, planFeatures: f.planFeatures.filter((_, idx) => idx !== i) }));
  };

  const handleSave = () => {
    const priceCents = Math.round(form.price * 100);
    const features: Record<string, any> = {
      maxSessions: form.maxSessions,
      maxMessagesPerMonth: form.maxMessagesPerMonth,
      maxApiCallsPerMinute: 10,
      maxWebhooks: 1,
      hasWhatsappBusinessApi: true,
      hasAnalytics: true,
      hasPrioritySupport: false,
      hasMessageHistorySync: false,
      maxContacts: form.maxContacts,
      maxTeamMembers: form.maxTeamMembers,
      maxWorkflows: form.maxWorkflows,
      maxChatbots: form.maxChatbots,
      maxWabaNumbers: form.maxWabaNumbers,
    };
    const priceMonthly = form.billingCycle === "monthly" ? priceCents : form.billingCycle === "quarterly" ? Math.round(priceCents / 3) : Math.round(priceCents / 12);
    const priceQuarterly = form.billingCycle === "quarterly" ? priceCents : form.billingCycle === "monthly" ? priceCents * 3 : Math.round(priceCents / 4);
    const priceYearly = form.billingCycle === "yearly" ? priceCents : form.billingCycle === "monthly" ? priceCents * 12 : priceCents * 4;

    onSave({
      name: form.name || form.displayName?.toLowerCase().replace(/\s+/g, "-") || "plan",
      displayName: form.displayName,
      description: form.description,
      status: form.status,
      isPopular: form.isPopular,
      isInternational: form.isInternational,
      gstType: form.gstType,
      gstPercent: form.gstPercent,
      serviceChargePercent: form.serviceChargePercent,
      serviceChargeFixed: Math.round(form.serviceChargeFixed * 100),
      currency: form.currency,
      defaultBillingCycle: form.billingCycle,
      planFeatures: form.planFeatures,
      autoAssignOnSignup: form.autoAssignOnSignup,
      autoAssignTrialDays: form.autoAssignTrialDays,
      priceMonthly,
      priceQuarterly,
      priceYearly,
      features,
      isActive: form.status === "published",
    });
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader className="flex flex-row items-center justify-between">
          <div>
            <SheetTitle>{plan ? "Edit Plan" : "Create Plan"}</SheetTitle>
            <SheetDescription>{plan ? "Modify plan settings." : "Create a new pricing plan."}</SheetDescription>
          </div>
          {plan && (
            <Badge variant={form.status === "published" ? "default" : "secondary"}>
              {form.status}
            </Badge>
          )}
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Basic Information */}
          <div>
            <h3 className="font-medium mb-3">Basic Information</h3>
            <div className="space-y-4">
              <div>
                <Label>Plan Name *</Label>
                <Input
                  value={form.displayName}
                  onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                  placeholder="e.g., Pro Plan"
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Status *</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Description *</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Grow Your Business with Smart WhatsApp Automation!"
                  className="mt-2"
                  rows={2}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Popular</Label>
                  <p className="text-xs text-muted-foreground">Mark this plan as popular</p>
                </div>
                <Switch
                  checked={form.isPopular}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, isPopular: v }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>International</Label>
                </div>
                <Switch
                  checked={form.isInternational}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, isInternational: v }))}
                />
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <div>
                  <Label>Auto assign on signup</Label>
                  <p className="text-xs text-muted-foreground">Assign this plan to new users when they sign up (e.g., free trial)</p>
                </div>
                <Switch
                  checked={form.autoAssignOnSignup}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, autoAssignOnSignup: v }))}
                />
              </div>
              {form.autoAssignOnSignup && (
                <div>
                  <Label>Trial period (days)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.autoAssignTrialDays}
                    onChange={(e) => setForm((f) => ({ ...f, autoAssignTrialDays: parseInt(e.target.value) || 7 }))}
                    className="mt-2 max-w-[120px]"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Plan will be active for this many days (e.g., 7 for a week)</p>
                </div>
              )}
            </div>
          </div>

          {/* Pricing */}
          <div>
            <h3 className="font-medium mb-3">Pricing</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Price *</Label>
                <Input
                  type="number"
                  value={form.price || ""}
                  onChange={(e) => setForm((f) => ({ ...f, price: parseFloat(e.target.value) || 0 }))}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Currency *</Label>
                <Select value={form.currency} onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INR">₹ INR</SelectItem>
                    <SelectItem value="USD">$ USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Billing</Label>
                <Select value={form.billingCycle} onValueChange={(v) => setForm((f) => ({ ...f, billingCycle: v }))}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>GST Type</Label>
                <Select value={form.gstType} onValueChange={(v) => setForm((f) => ({ ...f, gstType: v }))}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inclusive">Inclusive</SelectItem>
                    <SelectItem value="exclusive">Exclusive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>GST %</Label>
                <Input
                  type="number"
                  value={form.gstPercent}
                  onChange={(e) => setForm((f) => ({ ...f, gstPercent: parseInt(e.target.value) || 0 }))}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Service / convenience fee (%)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.serviceChargePercent}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, serviceChargePercent: parseFloat(e.target.value) || 0 }))
                  }
                  className="mt-2"
                  placeholder="e.g. 2 for 2% of plan price"
                />
              </div>
              <div>
                <Label>Service / convenience fee (fixed)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.serviceChargeFixed}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, serviceChargeFixed: parseFloat(e.target.value) || 0 }))
                  }
                  className="mt-2"
                  placeholder={`Fixed amount in ${form.currency}`}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Added on top of plan price. For exclusive GST, GST is calculated on plan price + fees.
                </p>
              </div>
            </div>
          </div>

          {/* Features & Limits */}
          <div>
            <h3 className="font-medium mb-3">Features & Limits</h3>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Include</TableHead>
                    <TableHead>Feature</TableHead>
                    <TableHead>Limit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {FEATURE_LIMITS.map(({ key, label, sublabel, max }) => (
                    <TableRow key={key}>
                      <TableCell>
                        <Switch defaultChecked />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{label}</p>
                          <p className="text-xs text-muted-foreground">{sublabel}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={form[key as keyof typeof form] ?? 0}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, [key]: parseInt(e.target.value) || 0 }))
                          }
                          className="w-24"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Max: {max.toLocaleString()}</p>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Plan Features (marketing bullets) */}
          <div>
            <h3 className="font-medium mb-1">Plan Features</h3>
            <p className="text-sm text-muted-foreground mb-3">Add marketing features to display on plan selection page.</p>
            <p className="text-xs text-muted-foreground mb-2">{form.planFeatures.length} features</p>
            <div className="flex gap-2 mb-2">
              <Input
                placeholder="e.g., 24/7 Customer Support"
                value={form.newFeature}
                onChange={(e) => setForm((f) => ({ ...f, newFeature: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFeature())}
              />
              <Button type="button" variant="outline" size="sm" onClick={addFeature}>
                + Add
              </Button>
            </div>
            <ul className="space-y-1">
              {form.planFeatures.map((feat, i) => (
                <li key={i} className="flex items-center justify-between rounded border px-3 py-2">
                  <span>{feat}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => removeFeature(i)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading || !form.displayName}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {plan ? "Updating..." : "Creating..."}
              </>
            ) : plan ? (
              "Update Plan"
            ) : (
              "Create Plan"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
