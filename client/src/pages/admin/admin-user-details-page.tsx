// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  Loader2,
  ArrowLeft,
  User,
  Mail,
  Phone,
  Lock,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Ban,
  History,
  ContactRound,
  Plug,
  Bot,
  GitBranch,
  List,
  Trash2,
  Activity,
  Wallet,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useListPaginationState, parsePaginatedListResponse } from "@/lib/list-pagination";
import { ListPaginationFooter } from "@/components/list-pagination-footer";

type UserDetail = {
  user: {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    isSaaSOwner: boolean;
    isActive: boolean;
    emailVerified: boolean;
    accountStatus: string;
    createdAt: string;
  };
  subscription: any;
  plan: any;
  organizations: any[];
  primaryRole: string | null;
  addons: any[];
};

type ActivityCounts = {
  contacts: number;
  integrations: number;
  chatbots: number;
  flows: number;
  lists: number;
};

type ContactRow = {
  id: string;
  name: string;
  phoneNumber: string;
  email: string | null;
  source: string | null;
  createdAt: string;
};

type IntegrationRow = {
  id: string;
  name: string;
  displayName: string;
  category: string;
  status: string;
  lastSyncAt: string | null;
  createdAt: string;
};

type ChatbotRow = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type FlowRow = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type ListRow = {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  createdAt: string;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function EmptyTableRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="h-24 text-center text-muted-foreground">
        {label}
      </TableCell>
    </TableRow>
  );
}

function TableLoadingRow({ colSpan }: { colSpan: number }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="h-24 text-center">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
      </TableCell>
    </TableRow>
  );
}

export default function AdminUserDetailsPage() {
  const [, params] = useRoute("/admin/users/:userId");
  const userId = params?.userId ?? "";
  const { toast } = useToast();
  const [form, setForm] = useState<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    password: string;
    accountStatus: string;
    emailVerified: boolean;
  }>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    accountStatus: "active",
    emailVerified: false,
  });
  const [activityTab, setActivityTab] = useState("contacts");
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [singleDelete, setSingleDelete] = useState<{ id: string; name: string } | null>(null);

  const contactsPaging = useListPaginationState(10);
  const integrationsPaging = useListPaginationState(10);
  const chatbotsPaging = useListPaginationState(10);
  const flowsPaging = useListPaginationState(10);
  const listsPaging = useListPaginationState(10);

  const { data, isLoading, refetch } = useQuery<UserDetail>({
    queryKey: [`/api/admin/users/${userId}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/users/${userId}`);
      const json = await res.json();
      if (json.user) {
        setForm({
          firstName: json.user.firstName ?? "",
          lastName: json.user.lastName ?? "",
          email: json.user.email ?? "",
          phone: json.user.phone ?? "",
          password: "",
          accountStatus: json.user.accountStatus ?? "active",
          emailVerified: json.user.emailVerified ?? false,
        });
      }
      return json;
    },
    enabled: !!userId,
  });

  const { data: planHistoryData } = useQuery<{
    history: {
      plan?: { displayName?: string; name?: string };
      action: string;
      periodStart: string;
      periodEnd: string;
      createdAt: string;
    }[];
  }>({
    queryKey: [`/api/admin/users/${userId}/plan-history`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/users/${userId}/plan-history`);
      return await res.json();
    },
    enabled: !!userId,
  });

  const { data: activitySummary, isLoading: countsLoading } = useQuery<{ counts: ActivityCounts }>({
    queryKey: [`/api/admin/users/${userId}/activities`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/users/${userId}/activities`);
      return await res.json();
    },
    enabled: !!userId,
  });

  const contactsQuery = useQuery({
    queryKey: [
      `/api/admin/users/${userId}/activities/contacts`,
      contactsPaging.currentPage,
      contactsPaging.rowsPerPage,
    ],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/admin/users/${userId}/activities/contacts?${contactsPaging.paginationParams.toString()}`
      );
      return parsePaginatedListResponse<ContactRow>(await res.json(), "contacts");
    },
    enabled: !!userId && activityTab === "contacts",
  });

  const integrationsQuery = useQuery({
    queryKey: [
      `/api/admin/users/${userId}/activities/integrations`,
      integrationsPaging.currentPage,
      integrationsPaging.rowsPerPage,
    ],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/admin/users/${userId}/activities/integrations?${integrationsPaging.paginationParams.toString()}`
      );
      return parsePaginatedListResponse<IntegrationRow>(await res.json(), "integrations");
    },
    enabled: !!userId && activityTab === "integrations",
  });

  const chatbotsQuery = useQuery({
    queryKey: [
      `/api/admin/users/${userId}/activities/chatbots`,
      chatbotsPaging.currentPage,
      chatbotsPaging.rowsPerPage,
    ],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/admin/users/${userId}/activities/chatbots?${chatbotsPaging.paginationParams.toString()}`
      );
      return parsePaginatedListResponse<ChatbotRow>(await res.json(), "chatbots");
    },
    enabled: !!userId && activityTab === "chatbots",
  });

  const flowsQuery = useQuery({
    queryKey: [
      `/api/admin/users/${userId}/activities/flows`,
      flowsPaging.currentPage,
      flowsPaging.rowsPerPage,
    ],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/admin/users/${userId}/activities/flows?${flowsPaging.paginationParams.toString()}`
      );
      return parsePaginatedListResponse<FlowRow>(await res.json(), "flows");
    },
    enabled: !!userId && activityTab === "flows",
  });

  const listsQuery = useQuery({
    queryKey: [
      `/api/admin/users/${userId}/activities/lists`,
      listsPaging.currentPage,
      listsPaging.rowsPerPage,
    ],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/admin/users/${userId}/activities/lists?${listsPaging.paginationParams.toString()}`
      );
      return parsePaginatedListResponse<ListRow>(await res.json(), "lists");
    },
    enabled: !!userId && activityTab === "lists",
  });

  const contactRows = contactsQuery.data?.items ?? [];
  const pageContactIds = useMemo(() => contactRows.map((c) => c.id), [contactRows]);
  const allOnPageSelected =
    pageContactIds.length > 0 && pageContactIds.every((id) => selectedContactIds.has(id));
  const someOnPageSelected =
    pageContactIds.some((id) => selectedContactIds.has(id)) && !allOnPageSelected;

  useEffect(() => {
    setSelectedContactIds(new Set());
  }, [contactsPaging.currentPage, contactsPaging.rowsPerPage, userId]);

  const invalidateActivityData = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/admin/users/${userId}/activities`] });
    queryClient.invalidateQueries({ queryKey: [`/api/admin/users/${userId}/activities/contacts`] });
    queryClient.invalidateQueries({ queryKey: [`/api/admin/users/${userId}/activities/chatbots`] });
    queryClient.invalidateQueries({ queryKey: [`/api/admin/users/${userId}/activities/flows`] });
  };

  const updateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("PUT", `/api/admin/users/${userId}`, payload);
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Profile updated", description: "User profile has been updated successfully" });
      refetch();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update profile", variant: "destructive" });
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      const res = await apiRequest("DELETE", `/api/admin/users/${userId}/contacts/${contactId}`);
      return await res.json();
    },
    onSuccess: (_data, contactId) => {
      toast({ title: "Contact deleted", description: "The contact has been removed." });
      setSingleDelete(null);
      setSelectedContactIds((prev) => {
        const next = new Set(prev);
        next.delete(contactId);
        return next;
      });
      invalidateActivityData();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete contact", variant: "destructive" });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (contactIds: string[]) => {
      const res = await apiRequest("POST", `/api/admin/users/${userId}/contacts/bulk-delete`, { contactIds });
      return await res.json();
    },
    onSuccess: (result) => {
      const successCount = result?.successCount ?? 0;
      const failedCount = result?.failedCount ?? 0;
      toast({
        title: "Contacts deleted",
        description:
          failedCount > 0
            ? `Deleted ${successCount}, failed ${failedCount}.`
            : `Successfully deleted ${successCount} contact${successCount === 1 ? "" : "s"}.`,
      });
      setBulkDeleteOpen(false);
      setSelectedContactIds(new Set());
      invalidateActivityData();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete contacts", variant: "destructive" });
    },
  });

  const toggleChatbotMutation = useMutation({
    mutationFn: async ({ chatbotId, enabled }: { chatbotId: string; enabled: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${userId}/chatbots/${chatbotId}`, {
        status: enabled ? "published" : "draft",
      });
      return await res.json();
    },
    onSuccess: (_data, vars) => {
      toast({
        title: vars.enabled ? "Chatbot enabled" : "Chatbot disabled",
        description: vars.enabled ? "Chatbot is now published." : "Chatbot set to draft.",
      });
      invalidateActivityData();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update chatbot", variant: "destructive" });
    },
  });

  const toggleFlowMutation = useMutation({
    mutationFn: async ({ flowId, enabled }: { flowId: string; enabled: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${userId}/flows/${flowId}`, {
        status: enabled ? "active" : "inactive",
      });
      return await res.json();
    },
    onSuccess: (_data, vars) => {
      toast({
        title: vars.enabled ? "Flow enabled" : "Flow disabled",
        description: vars.enabled ? "Flow is now active." : "Flow is now inactive.",
      });
      invalidateActivityData();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update flow", variant: "destructive" });
    },
  });

  const handleUpdate = () => {
    const payload: any = {
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phone: form.phone,
      accountStatus: form.accountStatus,
      emailVerified: form.emailVerified,
      isActive: form.accountStatus === "active",
    };
    if (form.password) payload.password = form.password;
    updateMutation.mutate(payload);
  };

  const toggleSelectAllOnPage = (checked: boolean | "indeterminate") => {
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      if (checked === true) {
        pageContactIds.forEach((id) => next.add(id));
      } else {
        pageContactIds.forEach((id) => next.delete(id));
      }
      return next;
    });
  };

  const toggleContactSelection = (id: string) => {
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const displayName = [data?.user?.firstName, data?.user?.lastName].filter(Boolean).join(" ") || "User";
  const initials =
    [data?.user?.firstName?.[0], data?.user?.lastName?.[0]].filter(Boolean).join("").toUpperCase() || "?";

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const counts = activitySummary?.counts ?? {
    contacts: 0,
    integrations: 0,
    chatbots: 0,
    flows: 0,
    lists: 0,
  };

  const activityStats = [
    { key: "contacts", label: "Contacts", value: counts.contacts, icon: ContactRound, accent: "text-sky-600 bg-sky-50" },
    { key: "integrations", label: "Integrations", value: counts.integrations, icon: Plug, accent: "text-violet-600 bg-violet-50" },
    { key: "chatbots", label: "Chatbots", value: counts.chatbots, icon: Bot, accent: "text-emerald-600 bg-emerald-50" },
    { key: "flows", label: "Flows", value: counts.flows, icon: GitBranch, accent: "text-amber-600 bg-amber-50" },
    { key: "lists", label: "Lists", value: counts.lists, icon: List, accent: "text-rose-600 bg-rose-50" },
  ];

  const selectedCount = selectedContactIds.size;
  const deleting = deleteContactMutation.isPending || bulkDeleteMutation.isPending;

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Users
      </Link>

      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-50 via-white to-slate-100/80 p-6 md:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-sky-100/60 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-emerald-100/50 blur-2xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-white shadow-sm">
              <AvatarFallback className="bg-slate-900 text-lg text-white">{initials}</AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{displayName}</h1>
                <Badge
                  variant={data.user.isActive ? "default" : "secondary"}
                  className={data.user.isActive ? "bg-emerald-500 hover:bg-emerald-500" : ""}
                >
                  {data.user.isActive ? "Active" : "Inactive"}
                </Badge>
                {data.user.isSaaSOwner && (
                  <Badge variant="outline" className="border-violet-400 text-violet-700">
                    ADMIN
                  </Badge>
                )}
                {data.primaryRole && (
                  <Badge variant="outline" className="capitalize">
                    {data.primaryRole}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {data.user.email || "No email"}
                {data.user.phone ? ` · ${data.user.phone}` : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                Joined {formatDate(data.user.createdAt)}
                {data.organizations?.[0]?.name ? ` · ${data.organizations[0].name}` : ""}
              </p>
            </div>
          </div>
          <div className="rounded-xl border bg-white/80 px-4 py-3 backdrop-blur-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current plan</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">
              {data.plan?.displayName || data.plan?.name || "No plan"}
            </p>
            {data.subscription && (
              <p className="text-xs text-muted-foreground capitalize">{data.subscription.status}</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4 text-sky-600" />
              Personal Information
            </CardTitle>
            <CardDescription>Update user profile details</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                  className="pl-10"
                  placeholder="First name"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                placeholder="Last name"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="pl-10"
                  placeholder="+1234567890"
                />
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="password">Password (optional)</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="pl-10"
                  placeholder="Leave blank to keep current password"
                />
              </div>
              <p className="text-xs text-muted-foreground">Leave empty to keep the current password.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-violet-600" />
              Administrative Controls
            </CardTitle>
            <CardDescription>Manage role and account status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>User Role</Label>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="capitalize">
                  {data.primaryRole || "member"}
                </Badge>
                <span className="text-xs text-muted-foreground">Set at organization level</span>
              </div>
            </div>
            <div className="space-y-3">
              <Label>Account Status</Label>
              <RadioGroup
                value={form.accountStatus}
                onValueChange={(v) => setForm((f) => ({ ...f, accountStatus: v }))}
                className="flex flex-col gap-2"
              >
                <div className="flex items-center space-x-2 rounded-lg border px-3 py-2">
                  <RadioGroupItem value="active" id="active" />
                  <Label htmlFor="active" className="flex flex-1 cursor-pointer items-center gap-2 font-normal">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Active
                  </Label>
                </div>
                <div className="flex items-center space-x-2 rounded-lg border px-3 py-2">
                  <RadioGroupItem value="suspended" id="suspended" />
                  <Label htmlFor="suspended" className="flex flex-1 cursor-pointer items-center gap-2 font-normal">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Suspended
                  </Label>
                </div>
                <div className="flex items-center space-x-2 rounded-lg border px-3 py-2">
                  <RadioGroupItem value="blocked" id="blocked" />
                  <Label htmlFor="blocked" className="flex flex-1 cursor-pointer items-center gap-2 font-normal">
                    <Ban className="h-4 w-4 text-red-500" />
                    Blocked
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-3">
              <div>
                <Label className="text-sm">Email Verified</Label>
                <p className="text-xs text-muted-foreground">Mark email as verified</p>
              </div>
              <Switch
                checked={form.emailVerified}
                onCheckedChange={(v) => setForm((f) => ({ ...f, emailVerified: v }))}
              />
            </div>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending} className="w-full">
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Profile"
              )}
            </Button>
          </CardContent>
        </Card>

        {data.organizations?.[0]?.id ? (
          <div className="lg:col-span-2 space-y-4">
            <OrgCreditLineBillingCard organizationId={data.organizations[0].id} orgName={data.organizations[0].name} />
            <OrgWalletAdminCard organizationId={data.organizations[0].id} orgName={data.organizations[0].name} />
          </div>
        ) : null}
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-sky-600" />
            User Activities
          </CardTitle>
          <CardDescription>
            Paginated activity tables. Select multiple contacts to delete them in one action. Enable or disable
            chatbots and flows from here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {countsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {activityStats.map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <button
                      key={stat.key}
                      type="button"
                      onClick={() => setActivityTab(stat.key)}
                      className={`rounded-xl border p-4 text-left transition-all hover:border-slate-300 hover:shadow-sm ${
                        activityTab === stat.key ? "border-slate-400 ring-1 ring-slate-200" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${stat.accent}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="text-2xl font-semibold tabular-nums text-slate-900">{stat.value}</span>
                      </div>
                      <p className="mt-2 text-sm font-medium text-slate-700">{stat.label}</p>
                    </button>
                  );
                })}
              </div>

              <Tabs value={activityTab} onValueChange={setActivityTab}>
                <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
                  <TabsTrigger value="contacts" className="gap-1.5">
                    <ContactRound className="h-3.5 w-3.5" />
                    Contacts
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                      {counts.contacts}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="integrations" className="gap-1.5">
                    <Plug className="h-3.5 w-3.5" />
                    Integrations
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                      {counts.integrations}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="chatbots" className="gap-1.5">
                    <Bot className="h-3.5 w-3.5" />
                    Chatbots
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                      {counts.chatbots}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="flows" className="gap-1.5">
                    <GitBranch className="h-3.5 w-3.5" />
                    Flows
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                      {counts.flows}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="lists" className="gap-1.5">
                    <List className="h-3.5 w-3.5" />
                    Lists
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                      {counts.lists}
                    </Badge>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="contacts" className="mt-4 space-y-3">
                  {selectedCount > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
                      <p className="text-sm font-medium">
                        {selectedCount} contact{selectedCount === 1 ? "" : "s"} selected
                      </p>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setSelectedContactIds(new Set())}>
                          Clear
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setBulkDeleteOpen(true)}
                          disabled={deleting}
                        >
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                          Delete selected
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox
                              checked={
                                pageContactIds.length === 0
                                  ? false
                                  : allOnPageSelected
                                    ? true
                                    : someOnPageSelected
                                      ? "indeterminate"
                                      : false
                              }
                              onCheckedChange={toggleSelectAllOnPage}
                              aria-label="Select all contacts on this page"
                              disabled={contactRows.length === 0}
                            />
                          </TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="w-[80px] text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contactsQuery.isLoading ? (
                          <TableLoadingRow colSpan={7} />
                        ) : !contactRows.length ? (
                          <EmptyTableRow colSpan={7} label="No contacts found" />
                        ) : (
                          contactRows.map((contact) => (
                            <TableRow key={contact.id} data-state={selectedContactIds.has(contact.id) ? "selected" : undefined}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedContactIds.has(contact.id)}
                                  onCheckedChange={() => toggleContactSelection(contact.id)}
                                  aria-label={`Select ${contact.name}`}
                                />
                              </TableCell>
                              <TableCell className="font-medium">{contact.name || "—"}</TableCell>
                              <TableCell className="font-mono text-xs">{contact.phoneNumber || "—"}</TableCell>
                              <TableCell className="text-muted-foreground">{contact.email || "—"}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="capitalize">
                                  {contact.source || "manual"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground">{formatDate(contact.createdAt)}</TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => setSingleDelete({ id: contact.id, name: contact.name })}
                                  disabled={deleting}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  <ListPaginationFooter
                    total={contactsQuery.data?.total ?? 0}
                    currentPage={contactsPaging.currentPage}
                    rowsPerPage={contactsPaging.rowsPerPage}
                    onPageChange={contactsPaging.setCurrentPage}
                    onRowsPerPageChange={contactsPaging.setRowsPerPage}
                  />
                </TabsContent>

                <TabsContent value="integrations" className="mt-4 space-y-3">
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Integration</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Last sync</TableHead>
                          <TableHead>Connected</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {integrationsQuery.isLoading ? (
                          <TableLoadingRow colSpan={5} />
                        ) : !(integrationsQuery.data?.items?.length) ? (
                          <EmptyTableRow colSpan={5} label="No integrations connected" />
                        ) : (
                          integrationsQuery.data.items.map((integration) => (
                            <TableRow key={integration.id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{integration.displayName}</p>
                                  <p className="text-xs text-muted-foreground">{integration.name}</p>
                                </div>
                              </TableCell>
                              <TableCell className="capitalize text-muted-foreground">{integration.category}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={integration.status === "connected" ? "default" : "secondary"}
                                  className={
                                    integration.status === "connected"
                                      ? "bg-emerald-500 hover:bg-emerald-500"
                                      : integration.status === "error"
                                        ? "bg-red-500 hover:bg-red-500 text-white"
                                        : ""
                                  }
                                >
                                  {integration.status?.replace(/_/g, " ")}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground">{formatDate(integration.lastSyncAt)}</TableCell>
                              <TableCell className="text-muted-foreground">{formatDate(integration.createdAt)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  <ListPaginationFooter
                    total={integrationsQuery.data?.total ?? 0}
                    currentPage={integrationsPaging.currentPage}
                    rowsPerPage={integrationsPaging.rowsPerPage}
                    onPageChange={integrationsPaging.setCurrentPage}
                    onRowsPerPageChange={integrationsPaging.setRowsPerPage}
                  />
                </TabsContent>

                <TabsContent value="chatbots" className="mt-4 space-y-3">
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Updated</TableHead>
                          <TableHead className="w-[120px] text-right">Enabled</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {chatbotsQuery.isLoading ? (
                          <TableLoadingRow colSpan={4} />
                        ) : !(chatbotsQuery.data?.items?.length) ? (
                          <EmptyTableRow colSpan={4} label="No chatbots found" />
                        ) : (
                          chatbotsQuery.data.items.map((bot) => {
                            const enabled = bot.status === "published";
                            const toggling =
                              toggleChatbotMutation.isPending &&
                              toggleChatbotMutation.variables?.chatbotId === bot.id;
                            return (
                              <TableRow key={bot.id}>
                                <TableCell className="font-medium">{bot.name}</TableCell>
                                <TableCell>
                                  <Badge
                                    variant={enabled ? "default" : "secondary"}
                                    className={enabled ? "bg-emerald-500 hover:bg-emerald-500" : ""}
                                  >
                                    {bot.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground">{formatDate(bot.updatedAt)}</TableCell>
                                <TableCell className="text-right">
                                  <div className="inline-flex items-center gap-2">
                                    {toggling && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                                    <Switch
                                      checked={enabled}
                                      disabled={toggleChatbotMutation.isPending}
                                      onCheckedChange={(v) =>
                                        toggleChatbotMutation.mutate({ chatbotId: bot.id, enabled: v })
                                      }
                                    />
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  <ListPaginationFooter
                    total={chatbotsQuery.data?.total ?? 0}
                    currentPage={chatbotsPaging.currentPage}
                    rowsPerPage={chatbotsPaging.rowsPerPage}
                    onPageChange={chatbotsPaging.setCurrentPage}
                    onRowsPerPageChange={chatbotsPaging.setRowsPerPage}
                  />
                </TabsContent>

                <TabsContent value="flows" className="mt-4 space-y-3">
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Updated</TableHead>
                          <TableHead className="w-[120px] text-right">Enabled</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {flowsQuery.isLoading ? (
                          <TableLoadingRow colSpan={4} />
                        ) : !(flowsQuery.data?.items?.length) ? (
                          <EmptyTableRow colSpan={4} label="No flows found" />
                        ) : (
                          flowsQuery.data.items.map((flow) => {
                            const enabled = flow.status === "active";
                            const toggling =
                              toggleFlowMutation.isPending && toggleFlowMutation.variables?.flowId === flow.id;
                            return (
                              <TableRow key={flow.id}>
                                <TableCell className="font-medium">{flow.name}</TableCell>
                                <TableCell>
                                  <Badge
                                    variant={enabled ? "default" : "secondary"}
                                    className={enabled ? "bg-emerald-500 hover:bg-emerald-500" : ""}
                                  >
                                    {flow.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground">{formatDate(flow.updatedAt)}</TableCell>
                                <TableCell className="text-right">
                                  <div className="inline-flex items-center gap-2">
                                    {toggling && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                                    <Switch
                                      checked={enabled}
                                      disabled={toggleFlowMutation.isPending}
                                      onCheckedChange={(v) =>
                                        toggleFlowMutation.mutate({ flowId: flow.id, enabled: v })
                                      }
                                    />
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  <ListPaginationFooter
                    total={flowsQuery.data?.total ?? 0}
                    currentPage={flowsPaging.currentPage}
                    rowsPerPage={flowsPaging.rowsPerPage}
                    onPageChange={flowsPaging.setCurrentPage}
                    onRowsPerPageChange={flowsPaging.setRowsPerPage}
                  />
                </TabsContent>

                <TabsContent value="lists" className="mt-4 space-y-3">
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>List name</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Members</TableHead>
                          <TableHead>Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {listsQuery.isLoading ? (
                          <TableLoadingRow colSpan={4} />
                        ) : !(listsQuery.data?.items?.length) ? (
                          <EmptyTableRow colSpan={4} label="No lists found" />
                        ) : (
                          listsQuery.data.items.map((list) => (
                            <TableRow key={list.id}>
                              <TableCell className="font-medium">{list.name}</TableCell>
                              <TableCell className="max-w-[280px] truncate text-muted-foreground">
                                {list.description || "—"}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">{list.memberCount}</Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground">{formatDate(list.createdAt)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  <ListPaginationFooter
                    total={listsQuery.data?.total ?? 0}
                    currentPage={listsPaging.currentPage}
                    rowsPerPage={listsPaging.rowsPerPage}
                    onPageChange={listsPaging.setCurrentPage}
                    onRowsPerPageChange={listsPaging.setRowsPerPage}
                  />
                </TabsContent>
              </Tabs>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-slate-600" />
            Current Plan & History
          </CardTitle>
          <CardDescription>Current subscription and previous plan history</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.subscription && data.plan ? (
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-sm font-medium text-muted-foreground">Current Plan</p>
              <p className="text-lg font-semibold">{data.plan.displayName || data.plan.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatDate(data.subscription.currentPeriodStart)} – {formatDate(data.subscription.currentPeriodEnd)} ·{" "}
                <span className="capitalize">{data.subscription.status}</span>
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No active subscription</p>
          )}
          {planHistoryData?.history && planHistoryData.history.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">Plan History</p>
              <div className="space-y-2">
                {planHistoryData.history.map((h: any, i: number) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 border-b py-2 last:border-0">
                    <span className="font-medium">{h.plan?.displayName || h.plan?.name || "Plan"}</span>
                    <Badge variant="outline" className="capitalize">
                      {h.action}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {formatDate(h.periodStart)} – {formatDate(h.periodEnd)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {(!planHistoryData?.history || planHistoryData.history.length === 0) && !data.subscription && (
            <p className="text-sm text-muted-foreground">No plan history yet</p>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!singleDelete} onOpenChange={(open) => !open && setSingleDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete contact?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-medium text-foreground">{singleDelete?.name || "this contact"}</span> from the
              user&apos;s account. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteContactMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteContactMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (singleDelete) deleteContactMutation.mutate(singleDelete.id);
              }}
            >
              {deleteContactMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedCount} contacts?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected contacts from the user&apos;s account. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={bulkDeleteMutation.isPending || selectedCount === 0}
              onClick={(e) => {
                e.preventDefault();
                bulkDeleteMutation.mutate(Array.from(selectedContactIds));
              }}
            >
              {bulkDeleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                `Delete ${selectedCount}`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function OrgCreditLineBillingCard({
  organizationId,
  orgName,
}: {
  organizationId: string;
  orgName?: string;
}) {
  const { toast } = useToast();
  const { data, refetch, isLoading } = useQuery({
    queryKey: [`/api/admin/credit-line/org/${organizationId}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/credit-line/org/${organizationId}`);
      return res.json();
    },
  });

  const billing = data?.billing;
  const [mode, setMode] = useState<"self_pay" | "credit_line">("self_pay");
  const [provider, setProvider] = useState("interakt");

  useEffect(() => {
    if (!billing) return;
    setMode(billing.billingMode === "credit_line" ? "credit_line" : "self_pay");
    setProvider(billing.creditLineProvider || "interakt");
  }, [billing]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/admin/credit-line/org/${organizationId}`, {
        billingMode: mode,
        creditLineProvider: mode === "credit_line" ? provider : null,
        creditLineStatus: mode === "credit_line" ? "pending" : "inactive",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save billing mode");
      return json;
    },
    onSuccess: () => {
      toast({ title: "WhatsApp billing mode updated" });
      refetch();
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">WhatsApp billing mode</CardTitle>
        <CardDescription>
          {orgName ? `${orgName} · ` : ""}
          self_pay = Meta Graph for sends (no Meta wallet debit). credit_line = template sends via supplier +
          wallet Meta debit. Wallet can still pay subscriptions in both modes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as "self_pay" | "credit_line")}
              className="flex flex-col gap-2"
            >
              <div className="flex items-center space-x-2 rounded-lg border px-3 py-2">
                <RadioGroupItem value="self_pay" id={`self_pay_${organizationId}`} />
                <Label htmlFor={`self_pay_${organizationId}`} className="cursor-pointer font-normal">
                  self_pay — customer pays Meta; create templates + session via Graph
                </Label>
              </div>
              <div className="flex items-center space-x-2 rounded-lg border px-3 py-2">
                <RadioGroupItem value="credit_line" id={`credit_line_${organizationId}`} />
                <Label htmlFor={`credit_line_${organizationId}`} className="cursor-pointer font-normal">
                  credit_line — supplier for template send (MM Lite); Graph for template create + custom
                </Label>
              </div>
            </RadioGroup>
            {mode === "credit_line" ? (
              <div className="space-y-2">
                <Label>Provider</Label>
                <Input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="interakt" />
              </div>
            ) : null}
            {billing ? (
              <p className="text-xs text-muted-foreground">
                Status: {billing.creditLineStatus}
                {billing.creditLineWabaId ? ` · WABA ${billing.creditLineWabaId}` : ""}
                {billing.lastError ? ` · ${billing.lastError}` : ""}
              </p>
            ) : null}
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save billing mode
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function formatWalletInr(minor: number) {
  return `₹${(Number(minor || 0) / 100).toFixed(2)}`;
}

function OrgWalletAdminCard({
  organizationId,
  orgName,
}: {
  organizationId: string;
  orgName?: string;
}) {
  const { toast } = useToast();
  const [amountRupees, setAmountRupees] = useState("500");
  const [description, setDescription] = useState("");
  const [recoverOrderId, setRecoverOrderId] = useState("");
  const [recoverPaymentId, setRecoverPaymentId] = useState("");

  const { data, refetch, isLoading } = useQuery({
    queryKey: [`/api/admin/wallet-billing/org/${organizationId}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/wallet-billing/org/${organizationId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load wallet");
      return json;
    },
  });

  const wallet = data?.wallet;
  const transactions = (data?.transactions || []) as Array<{
    id: string;
    type: string;
    amountMinor: number;
    balanceAfterMinor: number;
    description?: string | null;
    createdAt: string;
    createdByUserId?: string | null;
  }>;

  const adjustMutation = useMutation({
    mutationFn: async (direction: "credit" | "debit") => {
      const rupees = parseFloat(amountRupees);
      if (!Number.isFinite(rupees) || rupees <= 0) {
        throw new Error("Enter a positive amount in rupees");
      }
      const amountMinor = Math.round(rupees * 100) * (direction === "credit" ? 1 : -1);
      const res = await apiRequest("POST", "/api/admin/wallet-billing/adjustment", {
        organizationId,
        amountMinor,
        description:
          description.trim() ||
          (direction === "credit" ? "Admin wallet credit" : "Admin wallet debit"),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Adjustment failed");
      return json;
    },
    onSuccess: (json, direction) => {
      toast({
        title: direction === "credit" ? "Wallet credited" : "Wallet debited",
        description: `New balance ${formatWalletInr(json?.wallet?.wallet?.balanceMinor ?? json?.transaction?.balanceAfterMinor)}`,
      });
      setDescription("");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/summary"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const recoverMutation = useMutation({
    mutationFn: async () => {
      if (!recoverOrderId.trim() || !recoverPaymentId.trim()) {
        throw new Error("Razorpay order id and payment id are required");
      }
      const res = await apiRequest("POST", "/api/admin/wallet-billing/complete-reload", {
        razorpay_order_id: recoverOrderId.trim(),
        razorpay_payment_id: recoverPaymentId.trim(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not complete reload");
      return json;
    },
    onSuccess: (json) => {
      toast({
        title: "Reload credited",
        description: `Balance ${formatWalletInr(json.balanceMinor)}`,
      });
      setRecoverOrderId("");
      setRecoverPaymentId("");
      refetch();
    },
    onError: (e: any) => toast({ title: "Recover failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Wallet className="h-4 w-4" />
          Prepaid wallet
        </CardTitle>
        <CardDescription>
          {orgName ? `${orgName} · ` : ""}
          Manual credit/debit writes the same ledger rows customers see on Billing → Wallet (type{" "}
          <code className="text-xs">adjustment</code>).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-2xl font-semibold tabular-nums">
                {formatWalletInr(wallet?.balanceMinor)}
              </div>
              <Badge variant={wallet?.status === "active" ? "default" : "secondary"}>
                {wallet?.status || "—"}
              </Badge>
              {wallet?.lowBalance ? (
                <Badge variant="destructive">Low balance</Badge>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] items-end">
              <div className="space-y-2">
                <Label>Amount (₹)</Label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={amountRupees}
                  onChange={(e) => setAmountRupees(e.target.value)}
                />
              </div>
              <Button
                type="button"
                disabled={adjustMutation.isPending}
                onClick={() => adjustMutation.mutate("credit")}
              >
                {adjustMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Credit"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={adjustMutation.isPending}
                onClick={() => adjustMutation.mutate("debit")}
              >
                Debit
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Description (stored on transaction)</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Compensating failed Razorpay verify"
              />
            </div>

            <div className="rounded-lg border p-3 space-y-3">
              <p className="text-sm font-medium">Recover Razorpay reload</p>
              <p className="text-xs text-muted-foreground">
                If payment succeeded in Razorpay but verify returned Invalid signature, paste IDs from the
                network payload to credit the pending reload order.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  placeholder="order_…"
                  value={recoverOrderId}
                  onChange={(e) => setRecoverOrderId(e.target.value)}
                />
                <Input
                  placeholder="pay_…"
                  value={recoverPaymentId}
                  onChange={(e) => setRecoverPaymentId(e.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={recoverMutation.isPending}
                onClick={() => recoverMutation.mutate()}
              >
                {recoverMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Complete reload from Razorpay
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Recent transactions</p>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-muted-foreground text-sm">
                          No transactions yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      transactions.slice(0, 15).map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell className="text-xs whitespace-nowrap">
                            {tx.createdAt ? new Date(tx.createdAt).toLocaleString() : "—"}
                          </TableCell>
                          <TableCell className="text-xs">{tx.type}</TableCell>
                          <TableCell className="text-xs tabular-nums">
                            {tx.amountMinor >= 0 ? "+" : ""}
                            {formatWalletInr(tx.amountMinor)}
                          </TableCell>
                          <TableCell className="text-xs tabular-nums">
                            {formatWalletInr(tx.balanceAfterMinor)}
                          </TableCell>
                          <TableCell className="text-xs max-w-[220px] truncate">
                            {tx.description || "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
