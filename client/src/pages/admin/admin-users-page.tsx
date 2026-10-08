// @ts-nocheck
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, queryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { signupSchema, type SignupInput } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClearableDateInput } from "@/components/ui/clearable-date-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, Search, Mail, Phone, Filter, Download, Package, ArrowUpDown, UserPlus, HardDrive, Database, FolderOpen } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { payOnboardingFeeIds } from "@/lib/pay-onboarding-fees";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatBytes } from "@shared/format-bytes";

type Organization = {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
};

type User = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone?: string | null;
  isSaaSOwner: boolean;
  isActive: boolean;
  createdAt: string;
  subscription?: {
    id: string;
    planId: string;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
  };
  plan?: { id: string; name: string; displayName: string };
  organizations?: Organization[];
  organizationCount?: number;
  primaryRole?: string | null;
  addonsCount?: number;
  storage?: {
    databaseBytes: number;
    directoryBytes: number;
    totalBytes: number;
  };
};

export default function AdminUsersPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [subExpiryFrom, setSubExpiryFrom] = useState("");
  const [subExpiryTo, setSubExpiryTo] = useState("");
  const [subStartFrom, setSubStartFrom] = useState("");
  const [subStartTo, setSubStartTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [subscriptionSheetOpen, setSubscriptionSheetOpen] = useState(false);
  const [addonsSheetOpen, setAddonsSheetOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [trialDays, setTrialDays] = useState<number | null>(null);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [createAsTrial, setCreateAsTrial] = useState(false);

  const createUserForm = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      organizationName: "",
      phone: "",
    },
  });

  const queryParams = new URLSearchParams();
  if (createdFrom) queryParams.set("createdFrom", createdFrom);
  if (createdTo) queryParams.set("createdTo", createdTo);
  if (subExpiryFrom) queryParams.set("subExpiryFrom", subExpiryFrom);
  if (subExpiryTo) queryParams.set("subExpiryTo", subExpiryTo);
  if (subStartFrom) queryParams.set("subStartFrom", subStartFrom);
  if (subStartTo) queryParams.set("subStartTo", subStartTo);

  const { data, isLoading, refetch } = useQuery<{ users: User[]; total?: number }>({
    queryKey: ["/api/admin/users", queryParams.toString()],
    queryFn: async () => {
      const url = `/api/admin/users${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
      const res = await apiRequest("GET", url);
      return await res.json();
    },
  });

  const { data: storageData, isLoading: storageLoading } = useQuery<{
    storage: Record<string, { databaseBytes: number; directoryBytes: number; totalBytes: number }>;
  }>({
    queryKey: ["/api/admin/users/storage-stats"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/users/storage-stats");
      return await res.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  const { data: plansData } = useQuery<{
    plans: {
      id: string;
      name: string;
      displayName: string;
      priceMonthly: number;
      priceQuarterly?: number;
      priceYearly?: number;
      defaultBillingCycle?: string | null;
      currency?: string | null;
      status?: string;
      isActive?: boolean;
    }[];
  }>({
    queryKey: ["/api/admin/plans"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/plans");
      return await res.json();
    },
  });

  const { data: userAddonsData, refetch: refetchAddons } = useQuery<{ addons: any[] }>({
    queryKey: ["/api/admin/users", selectedUser?.id, "addons"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/users/${selectedUser!.id}/addons`);
      return await res.json();
    },
    enabled: !!selectedUser && addonsSheetOpen,
  });

  const { data: availableAddonsData } = useQuery<{ addons: { id: string; name: string; description: string | null; price: number }[] }>({
    queryKey: ["/api/admin/addons"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/addons");
      return await res.json();
    },
    enabled: addonsSheetOpen,
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: SignupInput) => {
      const res = await apiRequest("POST", "/api/admin/users", { ...data, createAsTrial });
      return await res.json();
    },
    onSuccess: async (body: {
      onboardingFee?: { id: string; amountMinor: number; currency: string } | null;
      onboardingAccrual?: { status?: string; reason?: string };
    }) => {
      const feeId = body?.onboardingFee?.id;
      if (feeId && !createAsTrial) {
        toast({
          title: "User created — pay onboarding fee",
          description: "Complete payment to the SaaS owner for this customer now.",
        });
        try {
          await payOnboardingFeeIds([feeId], {
            onPaid: () => toast({ title: "Paid", description: "Onboarding fee paid to SaaS owner." }),
            onCashfreeOpened: () =>
              toast({
                title: "Payment page opened",
                description: "Complete payment in the new tab. Unpaid fees stay pending.",
              }),
            onVerifyError: (message) =>
              toast({
                variant: "destructive",
                title: "Payment verification failed",
                description: `${message} Pay later from Onboarding fees.`,
              }),
          });
        } catch (e: any) {
          toast({
            variant: "destructive",
            title: "Could not start payment",
            description: `${e?.message || "Pay later from Onboarding fees."} The fee is already pending.`,
          });
        }
      } else if (body?.onboardingAccrual?.status === "waived") {
        toast({
          title: "User created",
          description: "Included in free onboarding seats — no fee this month.",
        });
      } else if (body?.onboardingAccrual?.status === "skipped" && body?.onboardingAccrual?.reason === "trial") {
        toast({
          title: "User created",
          description: "Trial account — onboarding fee starts only after trial ends.",
        });
      } else {
        toast({
          title: "User created",
          description: createAsTrial
            ? "Trial account created — auto-deactivates after 3 days."
            : "User has been created successfully",
        });
      }
      setCreateUserOpen(false);
      setCreateAsTrial(false);
      createUserForm.reset();
      refetch();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create user", variant: "destructive" });
    },
  });

  const assignPlanMutation = useMutation({
    mutationFn: async (payload: { userId: string; planId: string; billingCycle?: string; startDate?: string; endDate?: string }) => {
      const { userId, planId, billingCycle, startDate, endDate } = payload;
      const res = await apiRequest("POST", `/api/admin/users/${userId}/assign-plan`, {
        planId,
        billingCycle,
        startDate,
        endDate,
      });
      return await res.json();
    },
    onSuccess: async (body: {
      onboardingFee?: { id: string } | null;
    }) => {
      toast({ title: "Plan assigned", description: "Subscription plan has been assigned successfully" });
      const feeId = body?.onboardingFee?.id;
      if (feeId) {
        toast({
          title: "Pay onboarding fee",
          description: "This customer now has an active plan — pay the SaaS owner fee now.",
        });
        try {
          await payOnboardingFeeIds([feeId], {
            onPaid: () => toast({ title: "Paid", description: "Onboarding fee paid to SaaS owner." }),
            onCashfreeOpened: () =>
              toast({
                title: "Payment page opened",
                description: "Complete payment in the new tab.",
              }),
            onVerifyError: (message) =>
              toast({
                variant: "destructive",
                title: "Payment verification failed",
                description: `${message} Pay later from Onboarding fees.`,
              }),
          });
        } catch (e: any) {
          toast({
            variant: "destructive",
            title: "Could not start payment",
            description: `${e?.message || "Pay later from Onboarding fees."} The fee is already pending.`,
          });
        }
      }
      setSubscriptionSheetOpen(false);
      setSelectedUser(null);
      refetch();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to assign plan", variant: "destructive" });
    },
  });

  const assignAddonMutation = useMutation({
    mutationFn: async ({ userId, addonId }: { userId: string; addonId: string }) => {
      const res = await apiRequest("POST", `/api/admin/users/${userId}/addons`, { addonId });
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Add-on assigned", description: "Add-on has been assigned successfully" });
      refetchAddons();
      refetch();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to assign add-on", variant: "destructive" });
    },
  });

  const removeAddonMutation = useMutation({
    mutationFn: async ({ userId, addonId }: { userId: string; addonId: string }) => {
      await apiRequest("DELETE", `/api/admin/users/${userId}/addons/${addonId}`);
    },
    onSuccess: () => {
      toast({ title: "Add-on removed", description: "Add-on has been removed successfully" });
      refetchAddons();
      refetch();
    },
  });

  const users = data?.users || [];
  const total = data?.total ?? users.length;
  const storageByUser = storageData?.storage ?? {};
  const plans = (plansData?.plans || []).filter((plan) => {
    // Filter out draft plans and inactive plans - only show published and active plans
    return plan.status !== 'draft' && plan.isActive !== false;
  });
  const userAddons = userAddonsData?.addons || [];
  const availableAddons = availableAddonsData?.addons || [];

  const getPlanDisplayPrice = (plan: {
    priceMonthly: number;
    priceQuarterly?: number;
    priceYearly?: number;
    defaultBillingCycle?: string | null;
  }) => {
    const cycle = (plan.defaultBillingCycle || "monthly").toLowerCase();
    if (cycle === "yearly") return plan.priceYearly ?? plan.priceMonthly;
    if (cycle === "quarterly") return plan.priceQuarterly ?? plan.priceMonthly;
    return plan.priceMonthly;
  };

  const filteredUsers = users.filter((user) => {
    const query = searchQuery.toLowerCase();
    return (
      user.email?.toLowerCase().includes(query) ||
      user.firstName?.toLowerCase().includes(query) ||
      user.lastName?.toLowerCase().includes(query) ||
      user.phone?.toLowerCase().includes(query)
    );
  });

  const openSubscriptionSheet = (user: User) => {
    setSelectedUser(user);
    setSelectedPlanId("");
    setTrialDays(null);
    setSubscriptionSheetOpen(true);
  };

  const handleConfirmPlan = () => {
    if (selectedUser && selectedPlanId) {
      const payload: any = { userId: selectedUser.id, planId: selectedPlanId };
      const selectedPlan = plans.find((p) => p.id === selectedPlanId);
      if (trialDays != null && trialDays > 0) {
        const start = new Date();
        const end = new Date(start);
        end.setDate(end.getDate() + trialDays);
        payload.startDate = start.toISOString();
        payload.endDate = end.toISOString();
        payload.billingCycle = "monthly";
      } else if (
        selectedPlan?.defaultBillingCycle === "monthly" ||
        selectedPlan?.defaultBillingCycle === "quarterly" ||
        selectedPlan?.defaultBillingCycle === "yearly"
      ) {
        payload.billingCycle = selectedPlan.defaultBillingCycle;
      }
      assignPlanMutation.mutate(payload);
    }
  };

  const openAddonsSheet = (user: User) => {
    setSelectedUser(user);
    setAddonsSheetOpen(true);
  };

  const formatSubscriptionDisplay = (user: User) => {
    const plan = user.plan?.displayName || user.plan?.name || "No plan";
    const status = user.subscription?.status === "active" ? "Active" : user.subscription?.status === "expired" ? "Expired" : "—";
    const start = user.subscription?.currentPeriodStart
      ? new Date(user.subscription.currentPeriodStart).toLocaleDateString()
      : "";
    const end = user.subscription?.currentPeriodEnd
      ? new Date(user.subscription.currentPeriodEnd).toLocaleDateString()
      : "";
    return `${plan} ${status} • ${start}${start && end ? " - " : ""}${end}`;
  };

  const handleExport = () => {
    const headers = ["Created At", "Org No", "Name", "Email", "Phone", "Subscription", "DB Storage", "Files Storage", "Total Storage", "Role", "Status"];
    const rows = filteredUsers.map((u) => {
      const storage = storageByUser[u.id] ?? u.storage ?? { databaseBytes: 0, directoryBytes: 0, totalBytes: 0 };
      return [
        new Date(u.createdAt).toLocaleDateString(),
        u.organizations?.[0]?.id?.slice(-6) ?? "",
        [u.firstName, u.lastName].filter(Boolean).join(" "),
        u.email ?? "",
        u.phone ?? "",
        formatSubscriptionDisplay(u),
        formatBytes(storage.databaseBytes ?? 0),
        formatBytes(storage.directoryBytes ?? 0),
        formatBytes(storage.totalBytes ?? 0),
        u.primaryRole ?? u.isSaaSOwner ? "Admin" : "User",
        u.isActive ? "Active" : "Inactive",
      ];
    });
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 w-full max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">Users</h1>
          <p className="text-sm text-muted-foreground mt-1">{total} organization owners</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create User</DialogTitle>
                <DialogDescription>Create a new user account with organization</DialogDescription>
              </DialogHeader>
              <Form {...createUserForm}>
                <form
                  onSubmit={createUserForm.handleSubmit((data) => createUserMutation.mutate(data))}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={createUserForm.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input placeholder="John" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createUserForm.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Doe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={createUserForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="john@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createUserForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mobile Number</FormLabel>
                        <FormControl>
                          <Input type="tel" placeholder="+91 9876543210" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createUserForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createUserForm.control}
                    name="organizationName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Organization Name</FormLabel>
                        <FormControl>
                          <Input placeholder="My Company" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <Label htmlFor="create-as-trial" className="text-sm font-medium">
                        Create as trial account
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Marks the account as trial and auto-deactivates after 3 days. No onboarding email is sent.
                      </p>
                    </div>
                    <Switch
                      id="create-as-trial"
                      checked={createAsTrial}
                      onCheckedChange={setCreateAsTrial}
                    />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setCreateUserOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createUserMutation.isPending}>
                      {createUserMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create User"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>User Management</CardTitle>
          <CardDescription>Search users and review subscription, storage, and add-ons</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-4 p-4 rounded-lg border bg-muted/30">
              <div>
                <label className="text-xs text-muted-foreground">Created At</label>
                <ClearableDateInput
                  showCalendarIcon={false}
                  value={createdFrom}
                  onChange={(e) => setCreatedFrom(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Created To</label>
                <ClearableDateInput
                  showCalendarIcon={false}
                  value={createdTo}
                  onChange={(e) => setCreatedTo(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Sub. Expiry</label>
                <ClearableDateInput
                  showCalendarIcon={false}
                  value={subExpiryFrom}
                  onChange={(e) => setSubExpiryFrom(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Sub. Expiry To</label>
                <ClearableDateInput
                  showCalendarIcon={false}
                  value={subExpiryTo}
                  onChange={(e) => setSubExpiryTo(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Sub. Start</label>
                <ClearableDateInput
                  showCalendarIcon={false}
                  value={subStartFrom}
                  onChange={(e) => setSubStartFrom(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Sub. Start To</label>
                <ClearableDateInput
                  showCalendarIcon={false}
                  value={subStartTo}
                  onChange={(e) => setSubStartTo(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table className="min-w-[1100px]">
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-[96px] whitespace-nowrap">
                      <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide">
                        Created <ArrowUpDown className="h-3 w-3 opacity-60" />
                      </span>
                    </TableHead>
                    <TableHead className="w-[72px] text-xs font-semibold uppercase tracking-wide">Org</TableHead>
                    <TableHead className="min-w-[160px] text-xs font-semibold uppercase tracking-wide">User</TableHead>
                    <TableHead className="min-w-[200px] text-xs font-semibold uppercase tracking-wide">Contact</TableHead>
                    <TableHead className="min-w-[180px] text-xs font-semibold uppercase tracking-wide">Subscription</TableHead>
                    <TableHead className="w-[120px] text-xs font-semibold uppercase tracking-wide">Storage</TableHead>
                    <TableHead className="w-[88px] text-xs font-semibold uppercase tracking-wide text-center">Add-ons</TableHead>
                    <TableHead className="w-[80px] text-xs font-semibold uppercase tracking-wide">Role</TableHead>
                    <TableHead className="w-[88px] text-xs font-semibold uppercase tracking-wide">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                        No users found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => {
                      const storage = storageByUser[user.id] ?? user.storage;
                      const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "—";
                      const initials = [user.firstName?.[0], user.lastName?.[0]].filter(Boolean).join("").toUpperCase() || "?";

                      return (
                        <TableRow key={user.id} className="align-top">
                          <TableCell className="text-muted-foreground text-xs whitespace-nowrap py-3">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs font-mono py-3">
                            {user.organizations?.[0]?.id?.slice(-6) ?? "—"}
                          </TableCell>
                          <TableCell className="py-3">
                            <Link href={`/admin/users/${user.id}`} className="flex items-center gap-2 hover:underline min-w-0">
                              <Avatar className="h-8 w-8 shrink-0">
                                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                              </Avatar>
                              <span className="font-medium text-sm truncate">{displayName}</span>
                            </Link>
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="space-y-1 text-xs min-w-0">
                              <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                                <Mail className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{user.email || "—"}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                                <Phone className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{user.phone || "—"}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <button
                              type="button"
                              onClick={() => openSubscriptionSheet(user)}
                              className="text-left hover:underline space-y-1 max-w-[220px]"
                            >
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-sm font-medium truncate">
                                  {user.plan?.displayName || user.plan?.name || "No plan"}
                                </span>
                                <Badge
                                  variant={user.subscription?.status === "active" ? "default" : "secondary"}
                                  className={`text-[10px] px-1.5 py-0 h-5 ${user.subscription?.status === "active" ? "bg-green-600 hover:bg-green-600" : ""}`}
                                >
                                  {user.subscription?.status === "active"
                                    ? "Active"
                                    : user.subscription?.status === "expired"
                                      ? "Expired"
                                      : "—"}
                                </Badge>
                              </div>
                              {user.subscription?.currentPeriodStart && user.subscription?.currentPeriodEnd && (
                                <p className="text-[11px] text-muted-foreground leading-tight">
                                  {new Date(user.subscription.currentPeriodStart).toLocaleDateString()} –{" "}
                                  {new Date(user.subscription.currentPeriodEnd).toLocaleDateString()}
                                </p>
                              )}
                            </button>
                          </TableCell>
                          <TableCell className="py-3">
                            {storageLoading && !storage ? (
                              <div className="inline-flex items-center gap-1.5 rounded-md border bg-muted/30 px-2 py-1">
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">…</span>
                              </div>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="inline-flex items-center gap-1.5 rounded-md border bg-muted/30 px-2 py-1 cursor-default">
                                    <HardDrive className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <span className="text-xs font-medium tabular-nums">
                                      {formatBytes(storage?.totalBytes ?? 0)}
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="text-xs space-y-1">
                                  <div className="flex items-center gap-2">
                                    <Database className="h-3.5 w-3.5" />
                                    <span>Database: {formatBytes(storage?.databaseBytes ?? 0)}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <FolderOpen className="h-3.5 w-3.5" />
                                    <span>Files: {formatBytes(storage?.directoryBytes ?? 0)}</span>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </TableCell>
                          <TableCell className="py-3 text-center">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => openAddonsSheet(user)}
                                  aria-label="Manage add-ons"
                                >
                                  <Package className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Add-ons{user.addonsCount ? ` (${user.addonsCount})` : ""}
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell className="py-3">
                            <Badge variant="outline" className="text-[10px] border-blue-500/50 text-blue-700 whitespace-nowrap">
                              {user.primaryRole || (user.isSaaSOwner ? "Admin" : "User")}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3">
                            <Badge
                              variant={user.isActive ? "default" : "secondary"}
                              className={`text-[10px] whitespace-nowrap ${user.isActive ? "bg-green-600 hover:bg-green-600" : ""}`}
                            >
                              {user.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subscription Slide Panel */}
      <Sheet open={subscriptionSheetOpen} onOpenChange={setSubscriptionSheetOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Subscription</SheetTitle>
            <SheetDescription>
              Assign or change the subscription plan for {selectedUser ? [selectedUser.firstName, selectedUser.lastName].filter(Boolean).join(" ") : ""}
            </SheetDescription>
          </SheetHeader>
          {selectedUser && (
            <div className="space-y-6 py-6">
              <div>
                <p className="text-sm font-medium mb-1">Current Plan</p>
                <p className="text-sm text-muted-foreground">
                  {selectedUser.plan?.displayName || selectedUser.plan?.name || "No plan"}{" "}
                  <Badge variant={selectedUser.subscription?.status === "active" ? "default" : "secondary"} className="ml-2">
                    {selectedUser.subscription?.status === "active" ? "ACTIVE" : selectedUser.subscription?.status || "—"}
                  </Badge>
                  {selectedUser.subscription?.currentPeriodEnd && (
                    <span className="ml-2 text-muted-foreground">
                      Exp: {new Date(selectedUser.subscription.currentPeriodEnd).toLocaleDateString()}
                    </span>
                  )}
                </p>
              </div>
              <div>
                <Label>Select Plan</Label>
                <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Choose a plan..." />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.displayName} ({plan.currency || "INR"} {(getPlanDisplayPrice(plan) / 100).toLocaleString()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Trial period (days) – optional</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="Leave empty for regular billing"
                  value={trialDays ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setTrialDays(v === "" ? null : parseInt(v) || 0);
                  }}
                  className="mt-2 max-w-[140px]"
                />
                <p className="text-xs text-muted-foreground mt-1">e.g., 7 for a week free trial</p>
              </div>
            </div>
          )}
          <SheetFooter>
            <Button variant="outline" onClick={() => setSubscriptionSheetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmPlan} disabled={!selectedPlanId || assignPlanMutation.isPending}>
              {assignPlanMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                "Confirm"
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Add-ons Slide Panel */}
      <Sheet open={addonsSheetOpen} onOpenChange={setAddonsSheetOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Manage Add-ons</SheetTitle>
            <SheetDescription>
              {selectedUser ? [selectedUser.firstName, selectedUser.lastName].filter(Boolean).join(" ") : ""} • {userAddons.length} active
            </SheetDescription>
          </SheetHeader>
          {selectedUser && (
            <div className="space-y-6 py-6">
              <div>
                <p className="text-sm font-medium mb-2">Active Add-ons</p>
                {userAddons.length === 0 ? (
                  <div className="rounded-lg border p-8 text-center text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No active add-ons</p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {userAddons.map((ua: any) => (
                      <li key={ua.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="font-medium">{ua.addon?.name}</p>
                          {ua.addon?.description && (
                            <p className="text-sm text-muted-foreground">{ua.addon.description}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAddonMutation.mutate({ userId: selectedUser.id, addonId: ua.addonId })}
                        >
                          Remove
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Add New Add-on</p>
                {availableAddons.filter((a) => !userAddons.some((ua: any) => ua.addonId === a.id)).length === 0 ? (
                  <div className="rounded-lg border p-6 text-center text-muted-foreground">
                    <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p>All add-ons assigned</p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {availableAddons
                      .filter((a) => !userAddons.some((ua: any) => ua.addonId === a.id))
                      .map((addon) => (
                        <li key={addon.id} className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <p className="font-medium">{addon.name}</p>
                            {addon.description && (
                              <p className="text-sm text-muted-foreground">{addon.description}</p>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => assignAddonMutation.mutate({ userId: selectedUser.id, addonId: addon.id })}
                          >
                            + Add
                          </Button>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </div>
          )}
          <SheetFooter>
            <Button variant="outline" onClick={() => setAddonsSheetOpen(false)}>
              Close
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
