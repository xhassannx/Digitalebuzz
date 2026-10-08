import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  CalendarOff,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { cn } from "@/lib/utils";
import { useRatehonkPageSkin } from "@/panel-templates/ratehonk-v1/RatehonkSkinContext";
import { usePanelTemplate } from "@/panel-templates/PanelTemplateProvider";
import { RhSearchField } from "@/panel-templates/ratehonk-v1/components/rh";

type ExpiredUserRow = {
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  isActive: boolean;
  periodEnd: string;
  subscriptionStatus: string | null;
  planName: string | null;
  planDisplayName: string | null;
  dataDeletionAt: string | null;
  retentionDays: number;
  daysUntilDataDeletion: number | null;
  dataPurgedAt: string | null;
  organizationCount: number;
};

type ExpiredSubscriptionsResponse = {
  retention_months: number;
  retention_days: number;
  retention_months_options: number[];
  users: ExpiredUserRow[];
};

function displayName(row: ExpiredUserRow) {
  const name = [row.firstName, row.lastName].filter(Boolean).join(" ").trim();
  return name || row.email || row.userId.slice(0, 8);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "dd MMM yyyy");
}

export default function AdminExpiredSubscriptionsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const skin = useRatehonkPageSkin();
  const { templateId } = usePanelTemplate();
  const isAtlas = templateId === "helicoptic-v1";
  const [search, setSearch] = useState("");
  const [purgeUser, setPurgeUser] = useState<ExpiredUserRow | null>(null);

  const { data, isLoading, isFetching, refetch } = useQuery<ExpiredSubscriptionsResponse>({
    queryKey: ["/api/admin/expired-subscriptions"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/expired-subscriptions");
      return res.json();
    },
  });

  const retentionMonths = data?.retention_months ?? 3;
  const [draftMonths, setDraftMonths] = useState<string>("");
  const selectedMonths = draftMonths || String(retentionMonths);

  const primaryBtn = skin
    ? "bg-[var(--rh-brand)] hover:bg-[var(--rh-brand-hover)] text-white border-transparent"
    : "";
  const cardClass = skin
    ? "rounded-2xl border-[#e5e7eb] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
    : "";
  const inputClass = skin ? "h-11 rounded-xl border-[#e5e7eb]" : "";
  const mutedText = skin ? "text-[#717786]" : "text-muted-foreground";
  const titleText = skin ? "text-[#111c2d]" : "";

  const saveRetention = useMutation({
    mutationFn: async (months: number) => {
      const res = await apiRequest("PUT", "/api/admin/expired-subscriptions/retention", {
        months,
      });
      return res.json();
    },
    onSuccess: (body) => {
      setDraftMonths("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/expired-subscriptions"] });
      toast({
        title: "Retention updated",
        description: body?.message || `Data deletes after ${body?.retention_months} month(s).`,
      });
    },
    onError: (e: Error) => {
      toast({ variant: "destructive", title: "Could not save", description: e.message });
    },
  });

  const purgeMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest(
        "POST",
        `/api/admin/expired-subscriptions/${userId}/purge-data`,
      );
      return res.json();
    },
    onSuccess: (body) => {
      setPurgeUser(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/expired-subscriptions"] });
      toast({
        title: "Data deleted",
        description: body?.note || body?.message || "Business data removed; user account kept.",
      });
    },
    onError: (e: Error) => {
      toast({ variant: "destructive", title: "Delete failed", description: e.message });
    },
  });

  const rows = useMemo(() => {
    const list = data?.users ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((u) => {
      const hay = [u.email, u.firstName, u.lastName, u.phone, u.planDisplayName, u.planName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [data?.users, search]);

  const awaitingCount = rows.filter((r) => !r.dataPurgedAt).length;
  const purgedCount = rows.filter((r) => !!r.dataPurgedAt).length;

  return (
    <div
      className={cn(
        "admin-expired-subscriptions-page mx-auto max-w-7xl space-y-8 p-6 md:p-8",
        skin && "admin-expired-subscriptions-page--rh",
        isAtlas && "admin-expired-subscriptions-page--atlas",
      )}
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div
            className={cn(
              "mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl",
              skin
                ? "bg-[var(--rh-brand-soft,#ecfdf5)] text-[var(--rh-brand,#047857)]"
                : "bg-muted text-muted-foreground",
            )}
          >
            <CalendarOff className="h-5 w-5" />
          </div>
          <h1 className={cn("mb-2 text-3xl font-semibold tracking-tight", titleText)}>
            Expired subscriptions
          </h1>
          <p className={cn("max-w-2xl text-sm leading-6", mutedText)}>
            Users with no active plan (expired or never subscribed). Business data is removed after
            the retention window — the user account is always kept.
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          className={cn(skin && "h-11 w-11 rounded-xl border-[#e5e7eb]")}
          onClick={() => refetch()}
          title="Refresh"
          disabled={isFetching}
        >
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
        </Button>
      </header>

      <Card className={cardClass}>
        <CardHeader className="pb-3">
          <CardTitle className={cn("text-lg", titleText)}>Data deletion after expiry</CardTitle>
          <CardDescription className={cn(skin && "text-[#717786]")}>
            Choose how long to keep expired users&apos; business data before automatic deletion.
            One value is required (1, 2, or 3 months).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="w-full max-w-xs space-y-2">
            <Label htmlFor="retention-months" className={cn(skin && "text-[#414754]")}>
              Delete data after
            </Label>
            <Select value={selectedMonths} onValueChange={(v) => setDraftMonths(v)} required>
              <SelectTrigger id="retention-months" className={inputClass}>
                <SelectValue placeholder="Select months" />
              </SelectTrigger>
              <SelectContent>
                {(data?.retention_months_options ?? [1, 2, 3]).map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {m} month{m === 1 ? "" : "s"} ({m * 30} days)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            className={cn(skin && "rounded-xl", primaryBtn)}
            disabled={
              saveRetention.isPending ||
              !selectedMonths ||
              Number(selectedMonths) === retentionMonths
            }
            onClick={() => {
              const months = Number(selectedMonths);
              if (![1, 2, 3].includes(months)) {
                toast({
                  variant: "destructive",
                  title: "Required",
                  description: "Please select 1, 2, or 3 months.",
                });
                return;
              }
              saveRetention.mutate(months);
            }}
          >
            {saveRetention.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save retention"
            )}
          </Button>
          <p className={cn("text-sm sm:ml-auto", mutedText)}>
            Current:{" "}
            <strong className={titleText}>
              {retentionMonths} month(s)
            </strong>{" "}
            ({data?.retention_days ?? retentionMonths * 30} days)
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3 text-sm">
        <Badge
          variant="secondary"
          className={cn(
            skin && "rounded-lg border-transparent bg-[var(--rh-brand-soft,#ecfdf5)] text-[var(--rh-brand,#047857)]",
          )}
        >
          Expired users: {rows.length}
        </Badge>
        <Badge variant="outline" className={cn(skin && "rounded-lg border-[#e5e7eb] text-[#414754]")}>
          Awaiting data delete: {awaitingCount}
        </Badge>
        <Badge variant="outline" className={cn(skin && "rounded-lg border-[#e5e7eb] text-[#414754]")}>
          Data already deleted: {purgedCount}
        </Badge>
      </div>

      <Card className={cardClass}>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className={cn("text-lg", titleText)}>Expired users</CardTitle>
              <CardDescription className={cn(skin && "text-[#717786]")}>
                Manual delete removes business data only (contacts, chats, orgs). Login account stays.
              </CardDescription>
            </div>
            {skin ? (
              <RhSearchField
                value={search}
                onChange={setSearch}
                placeholder="Search users…"
                className="w-full sm:w-64"
              />
            ) : (
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search users…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2
                className={cn(
                  "h-8 w-8 animate-spin",
                  skin ? "text-[var(--rh-brand)]" : "text-muted-foreground",
                )}
              />
            </div>
          ) : rows.length === 0 ? (
            <p className={cn("py-12 text-center text-sm", mutedText)}>
              No expired subscription users found.
            </p>
          ) : (
            <div
              className={cn(
                "overflow-x-auto rounded-lg border",
                skin && "rounded-xl border-[#e5e7eb]",
              )}
            >
              <Table>
                <TableHeader>
                  <TableRow className={cn(skin && "border-[#eef2f1] hover:bg-transparent")}>
                    <TableHead className={cn(skin && "text-[#717786]")}>User</TableHead>
                    <TableHead className={cn(skin && "text-[#717786]")}>Plan</TableHead>
                    <TableHead className={cn(skin && "text-[#717786]")}>Expired / since</TableHead>
                    <TableHead className={cn(skin && "text-[#717786]")}>Data delete on</TableHead>
                    <TableHead className={cn(skin && "text-[#717786]")}>Status</TableHead>
                    <TableHead className={cn("text-right", skin && "text-[#717786]")}>
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const purged = !!row.dataPurgedAt;
                    const overdue =
                      !purged &&
                      row.daysUntilDataDeletion != null &&
                      row.daysUntilDataDeletion <= 0;
                    return (
                      <TableRow
                        key={row.userId}
                        className={cn(skin && "border-[#eef2f1] hover:bg-[#f8faf9]")}
                      >
                        <TableCell>
                          <div className={cn("font-medium", titleText)}>{displayName(row)}</div>
                          <div className={cn("text-xs", mutedText)}>{row.email || "—"}</div>
                          {row.phone && (
                            <div className={cn("text-xs", mutedText)}>{row.phone}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={titleText}>
                            {row.planDisplayName || row.planName || "No plan"}
                          </span>
                          <div className={cn("text-xs capitalize", mutedText)}>
                            {row.subscriptionStatus === "none"
                              ? "No subscription"
                              : row.subscriptionStatus || "—"}
                          </div>
                        </TableCell>
                        <TableCell className={cn("whitespace-nowrap", titleText)}>
                          {formatDate(row.periodEnd)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {purged ? (
                            <span className={mutedText}>
                              Deleted {formatDate(row.dataPurgedAt)}
                            </span>
                          ) : (
                            <>
                              <span className={titleText}>{formatDate(row.dataDeletionAt)}</span>
                              {row.daysUntilDataDeletion != null && (
                                <div
                                  className={cn(
                                    "text-xs",
                                    overdue
                                      ? "font-medium text-amber-700"
                                      : mutedText,
                                  )}
                                >
                                  {overdue
                                    ? "Due for auto-delete"
                                    : `${row.daysUntilDataDeletion} day(s) left`}
                                </div>
                              )}
                            </>
                          )}
                        </TableCell>
                        <TableCell>
                          {purged ? (
                            <Badge
                              className={cn(
                                "bg-emerald-50 text-emerald-800 hover:bg-emerald-50",
                                skin && "rounded-lg",
                              )}
                            >
                              Data deleted
                            </Badge>
                          ) : overdue ? (
                            <Badge variant="destructive" className={cn(skin && "rounded-lg")}>
                              Retention passed
                            </Badge>
                          ) : (
                            <Badge
                              variant="secondary"
                              className={cn(
                                skin &&
                                  "rounded-lg border-transparent bg-[var(--rh-brand-soft,#ecfdf5)] text-[var(--rh-brand,#047857)]",
                              )}
                            >
                              Awaiting retention
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="destructive"
                            size="sm"
                            className={cn(skin && "rounded-xl")}
                            onClick={() => setPurgeUser(row)}
                            disabled={purgeMutation.isPending}
                          >
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                            Delete data
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!purgeUser} onOpenChange={(open) => !open && setPurgeUser(null)}>
        <AlertDialogContent className={cn(skin && "rounded-2xl border-[#e5e7eb]")}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Delete business data?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                This will permanently delete organizations, contacts, chats, WhatsApp sessions, and
                related business data for{" "}
                <strong>{purgeUser ? displayName(purgeUser) : ""}</strong>
                {purgeUser?.email ? ` (${purgeUser.email})` : ""}.
              </p>
              <p className="font-medium text-foreground">
                The user account login will not be deleted — only their data.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={purgeMutation.isPending}
              className={cn(skin && "rounded-xl")}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className={cn(
                "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                skin && "rounded-xl",
              )}
              disabled={purgeMutation.isPending || !purgeUser}
              onClick={(e) => {
                e.preventDefault();
                if (purgeUser) purgeMutation.mutate(purgeUser.userId);
              }}
            >
              {purgeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete data only"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
