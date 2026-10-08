// @ts-nocheck
import { useState, useEffect } from "react";
import { useQuery, useMutation, queryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, ArrowLeft, MoreHorizontal, Search, ArrowUpDown } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/** Unchecked state must stay visible on white dialog backgrounds (default `bg-input` is too faint). */
const ADDON_MENU_SWITCH_CLASS = cn(
  "shrink-0 border-2 border-transparent",
  "data-[state=unchecked]:border-neutral-400 data-[state=unchecked]:bg-neutral-200",
  "data-[state=unchecked]:shadow-sm",
  "dark:data-[state=unchecked]:border-neutral-500 dark:data-[state=unchecked]:bg-neutral-700",
  "data-[state=checked]:border-transparent",
  /* Knob: clearer edge on gray track when off */
  "[&_span]:data-[state=unchecked]:bg-white [&_span]:data-[state=unchecked]:shadow [&_span]:data-[state=unchecked]:ring-1 [&_span]:data-[state=unchecked]:ring-neutral-400/80"
);

const ADDON_TYPES = [
  { value: "team", label: "Additional Team Members", tag: "Team" },
  { value: "workflow", label: "Additional Workflows", tag: "Workflow" },
  { value: "chatbot", label: "Additional Chatbots", tag: "Chatbot" },
  { value: "waba", label: "Additional WABA Numbers", tag: "Waba" },
  { value: "custom", label: "Custom", tag: "Custom" },
];

type Addon = {
  id: string;
  name: string;
  displayName: string | null;
  description: string | null;
  type: string | null;
  price: number;
  currency: string | null;
  billingCycle: string | null;
  billingType: string | null;
  isActive: boolean;
  featureWebhookEvents?: boolean;
  featureChatbot?: boolean;
  featureFlows?: boolean;
  featureDripCampaigns?: boolean;
  createdAt: string;
};

export default function AdminAddonsPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [addonToEdit, setAddonToEdit] = useState<Addon | null>(null);

  const { data, isLoading, refetch } = useQuery<{ addons: Addon[] }>({
    queryKey: ["/api/admin/addons"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/addons");
      return await res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", "/api/admin/addons", payload);
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Add-on created", description: "Add-on has been created successfully" });
      setIsCreateOpen(false);
      refetch();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create add-on", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...payload }: Record<string, unknown> & { id: string }) => {
      const res = await apiRequest("PUT", `/api/admin/addons/${id}`, payload);
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Add-on updated", description: "Changes saved." });
      setAddonToEdit(null);
      refetch();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update add-on", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (addonId: string) => {
      await apiRequest("DELETE", `/api/admin/addons/${addonId}`);
    },
    onSuccess: () => {
      toast({ title: "Add-on deleted", description: "Add-on has been deleted" });
      refetch();
    },
  });

  const addons = data?.addons || [];
  const filtered = addons.filter((a) => {
    const matchSearch =
      !searchQuery ||
      a.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchType = typeFilter === "all" || a.type === typeFilter;
    return matchSearch && matchType;
  });

  const formatPrice = (cents: number, currency: string = "INR") => {
    const sym = currency === "INR" ? "₹" : "$";
    return `${sym} ${(cents / 100).toLocaleString()}`;
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold mb-2">Add-ons</h1>
          <p className="text-muted-foreground">Manage add-ons that can be attached to your plans</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Add-on
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add-ons</CardTitle>
          <CardDescription>Search and manage add-ons</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search add-ons..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {ADDON_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
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
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        No add-ons found. Create your first add-on to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((addon) => (
                      <TableRow key={addon.id}>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(addon.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="font-medium">{addon.displayName || addon.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                          {addon.description || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {ADDON_TYPES.find((t) => t.value === addon.type)?.label || addon.type || "custom"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {formatPrice(addon.price, addon.currency || "INR")}{" "}
                          <span className="text-muted-foreground text-xs">
                            / {addon.billingCycle || "monthly"} ({addon.billingType || "recurring"})
                          </span>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setAddonToEdit(addon)}>Edit</DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => deleteMutation.mutate(addon.id)}
                                disabled={deleteMutation.isPending}
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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

      <CreateAddonDialog
        open={isCreateOpen || !!addonToEdit}
        onClose={() => {
          setIsCreateOpen(false);
          setAddonToEdit(null);
        }}
        editingAddon={addonToEdit}
        onSubmit={(form) => {
          const payload = {
            name: form.displayName || form.name,
            displayName: form.displayName,
            description: form.description,
            type: form.type,
            price: Math.round((form.price || 0) * 100),
            currency: form.currency,
            billingCycle: form.billingCycle,
            billingType: form.billingType,
            featureWebhookEvents: form.featureWebhookEvents,
            featureChatbot: form.featureChatbot,
            featureFlows: form.featureFlows,
            featureDripCampaigns: form.featureDripCampaigns,
          };
          if (addonToEdit) {
            updateMutation.mutate({ id: addonToEdit.id, ...payload });
          } else {
            createMutation.mutate(payload);
          }
        }}
        isLoading={createMutation.isPending || updateMutation.isPending}
        addonTypes={ADDON_TYPES}
      />
    </div>
  );
}

function CreateAddonDialog({
  open,
  onClose,
  onSubmit,
  isLoading,
  addonTypes,
  editingAddon,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (form: any) => void;
  isLoading: boolean;
  addonTypes: { value: string; label: string; tag: string }[];
  editingAddon?: Addon | null;
}) {
  const [form, setForm] = useState({
    type: "custom",
    name: "",
    displayName: "",
    description: "",
    price: 0,
    currency: "INR",
    billingCycle: "monthly",
    billingType: "recurring",
    featureWebhookEvents: false,
    featureChatbot: false,
    featureFlows: false,
    featureDripCampaigns: false,
  });

  useEffect(() => {
    if (!open) return;
    if (editingAddon) {
      setForm({
        type: editingAddon.type || "custom",
        name: editingAddon.name,
        displayName: editingAddon.displayName || editingAddon.name,
        description: editingAddon.description || "",
        price: (editingAddon.price || 0) / 100,
        currency: editingAddon.currency || "INR",
        billingCycle: editingAddon.billingCycle || "monthly",
        billingType: editingAddon.billingType || "recurring",
        featureWebhookEvents: !!editingAddon.featureWebhookEvents,
        featureChatbot: !!editingAddon.featureChatbot,
        featureFlows: !!editingAddon.featureFlows,
        featureDripCampaigns: !!editingAddon.featureDripCampaigns,
      });
    } else {
      setForm({
        type: "custom",
        name: "",
        displayName: "",
        description: "",
        price: 0,
        currency: "INR",
        billingCycle: "monthly",
        billingType: "recurring",
        featureWebhookEvents: false,
        featureChatbot: false,
        featureFlows: false,
        featureDripCampaigns: false,
      });
    }
  }, [open, editingAddon]);

  const handleSubmit = () => {
    onSubmit(form);
    if (!editingAddon) {
      setForm({
        type: "custom",
        name: "",
        displayName: "",
        description: "",
        price: 0,
        currency: "INR",
        billingCycle: "monthly",
        billingType: "recurring",
        featureWebhookEvents: false,
        featureChatbot: false,
        featureFlows: false,
        featureDripCampaigns: false,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingAddon ? "Edit Add-on" : "Create New Add-on"}</DialogTitle>
          <DialogDescription>
            {editingAddon ? "Update catalog details and menu access flags." : "Create an add-on that can be attached to plans."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Add-on Type *</Label>
            <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select add-on type" />
              </SelectTrigger>
              <SelectContent>
                {addonTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label} ({t.tag})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">The type determines (per user, per workflow, etc.).</p>
          </div>
          <div>
            <Label>Display Name *</Label>
            <Input
              placeholder="e.g., Additional Team Members"
              value={form.displayName}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value, name: e.target.value }))}
              className="mt-2"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              placeholder="Brief description of the add-on..."
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="mt-2"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Price *</Label>
              <Input
                type="number"
                placeholder="0"
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
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Billing Cycle *</Label>
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
              <Label>Billing Type *</Label>
              <Select value={form.billingType} onValueChange={(v) => setForm((f) => ({ ...f, billingType: v }))}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recurring">Recurring</SelectItem>
                  <SelectItem value="onetime">One-time</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Recurring: Charged every billing cycle. One-time: Charged once.
              </p>
            </div>
          </div>
          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-medium">Menu access when assigned to a user</p>
            <p className="text-xs text-muted-foreground">
              Turn on to show the matching sidebar items for users who have this add-on assigned. Users without a matching add-on do not see those menus.
            </p>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="addon-feat-webhook" className="cursor-pointer">
                Webhook events
              </Label>
              <Switch
                id="addon-feat-webhook"
                className={ADDON_MENU_SWITCH_CLASS}
                checked={form.featureWebhookEvents}
                onCheckedChange={(v) => setForm((f) => ({ ...f, featureWebhookEvents: v }))}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="addon-feat-chatbot" className="cursor-pointer">
                Chatbot
              </Label>
              <Switch
                id="addon-feat-chatbot"
                className={ADDON_MENU_SWITCH_CLASS}
                checked={form.featureChatbot}
                onCheckedChange={(v) => setForm((f) => ({ ...f, featureChatbot: v }))}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="addon-feat-flows" className="cursor-pointer">
                Flows
              </Label>
              <Switch
                id="addon-feat-flows"
                className={ADDON_MENU_SWITCH_CLASS}
                checked={form.featureFlows}
                onCheckedChange={(v) => setForm((f) => ({ ...f, featureFlows: v }))}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="addon-feat-drip" className="cursor-pointer">
                Drip Campaigns
              </Label>
              <Switch
                id="addon-feat-drip"
                className={ADDON_MENU_SWITCH_CLASS}
                checked={form.featureDripCampaigns}
                onCheckedChange={(v) => setForm((f) => ({ ...f, featureDripCampaigns: v }))}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !form.displayName}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : editingAddon ? (
              "Save changes"
            ) : (
              "Create Add-on"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
