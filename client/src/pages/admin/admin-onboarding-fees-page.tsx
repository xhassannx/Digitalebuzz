// @ts-nocheck
import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

type OnboardingFeeRow = {
  id: string;
  userId: string;
  subscriptionId: string | null;
  trigger: string;
  amountMinor: number;
  currency: string;
  dueAt: string;
  status: string;
  paidAt: string | null;
  gatewayOrderId: string | null;
  gatewayPaymentId?: string | null;
  paymentGateway?: string | null;
  gatewayPayload?: Record<string, unknown> | null;
  createdAt: string;
  user?: {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
  };
};

type OnboardingSettlementRow = {
  id: string;
  gateway: string;
  gatewayOrderId: string;
  gatewayPaymentId: string | null;
  amountMinor: number;
  currency: string;
  feeIds: string[];
  status: string;
  rawGatewayResponse: Record<string, unknown> | null;
  createdAt: string;
  paidAt: string | null;
};

/** Outstanding line items only: pending/failed, due, positive amount. Paid/waived/cancelled/future-due → no checkbox. */
function isOnboardingFeeSelectable(f: OnboardingFeeRow): boolean {
  if (f.amountMinor <= 0) return false;
  if (f.status !== "pending" && f.status !== "failed") return false;
  return new Date(f.dueAt).getTime() <= Date.now();
}

type LicensorAccountState =
  | { allowed: true }
  | { allowed: false; code: string; error: string; expired_at?: string };

export default function AdminOnboardingFeesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedOnboardingIds, setSelectedOnboardingIds] = useState<Set<string>>(new Set());
  const [cashfreeAwaitingWebhook, setCashfreeAwaitingWebhook] = useState(false);
  const [gatewayPayloadDialog, setGatewayPayloadDialog] = useState<{
    title: string;
    payload: Record<string, unknown>;
  } | null>(null);
  const [activationNote, setActivationNote] = useState("");

  const { data: licensorState } = useQuery<LicensorAccountState>({
    queryKey: ["/api/panel/licensor-account-state"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const licensorInactive =
    licensorState && licensorState.allowed === false && licensorState.code === "ACCOUNT_INACTIVE";

  const activationRequestMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/panel/request-account-activation", {
        note: activationNote.trim() || undefined,
      });
      return (await res.json()) as { ok?: boolean; message?: string };
    },
    onSuccess: (body) => {
      toast({
        title: "Request sent",
        description: typeof body?.message === "string" ? body.message : "Your licensor has been notified.",
      });
      setActivationNote("");
    },
    onError: (e: Error) => {
      toast({ variant: "destructive", title: "Request failed", description: e.message });
    },
  });


  const { data: billingAlert } = useQuery<{
    limitMinor: number | null;
    outstandingMinor: number;
    overLimit: boolean;
    billingCurrency: string | null;
  }>({
    queryKey: ["/api/admin/onboarding-billing-alert"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/onboarding-billing-alert");
      return await res.json();
    },
  });

  const { data: onboardingData, isLoading: onboardingLoading } = useQuery<{
    fees: OnboardingFeeRow[];
    total: number;
    batchPaymentGateway?: "razorpay" | "cashfree" | null;
  }>({
    queryKey: ["/api/admin/onboarding-fees"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/onboarding-fees?limit=200");
      return await res.json();
    },
    refetchInterval: cashfreeAwaitingWebhook ? 4000 : false,
  });

  const { data: settlementsData, isLoading: settlementsLoading } = useQuery<{
    settlements: OnboardingSettlementRow[];
    total: number;
  }>({
    queryKey: ["/api/admin/onboarding-fee-settlements"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/onboarding-fee-settlements?limit=150");
      return await res.json();
    },
    refetchInterval: cashfreeAwaitingWebhook ? 4000 : false,
  });

  useEffect(() => {
    if (!cashfreeAwaitingWebhook) return;
    const t = window.setTimeout(() => setCashfreeAwaitingWebhook(false), 120_000);
    return () => window.clearTimeout(t);
  }, [cashfreeAwaitingWebhook]);

  const selectedOnboardingKey = Array.from(selectedOnboardingIds).sort().join(",");
  useEffect(() => {
    if (!cashfreeAwaitingWebhook || selectedOnboardingIds.size === 0 || !onboardingData?.fees) return;
    const fees = onboardingData.fees;
    const allPaid = Array.from(selectedOnboardingIds).every((id) => {
      const f = fees.find((x) => x.id === id);
      return f?.status === "paid";
    });
    if (allPaid) {
      setSelectedOnboardingIds(new Set());
      setCashfreeAwaitingWebhook(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/onboarding-fee-settlements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/onboarding-billing-alert"] });
      toast({ title: "Paid", description: "Selected onboarding fees are marked paid." });
    }
  }, [onboardingData?.fees, cashfreeAwaitingWebhook, selectedOnboardingKey, queryClient, toast]);

  const selectableOutstanding = useMemo(
    () => (onboardingData?.fees ?? []).filter(isOnboardingFeeSelectable),
    [onboardingData?.fees],
  );

  const allOutstandingSelected =
    selectableOutstanding.length > 0 && selectableOutstanding.every((f) => selectedOnboardingIds.has(f.id));
  const someOutstandingSelected =
    selectableOutstanding.some((f) => selectedOnboardingIds.has(f.id)) && !allOutstandingSelected;

  const payOnboardingMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await apiRequest("POST", "/api/admin/onboarding-fees/create-order", { ids });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Failed to start payment");
      return body as
        | {
            gateway: "razorpay";
            settlementId?: string;
            orderId: string;
            amountMinor: number;
            currency: string;
            keyId: string;
            feeIds: string[];
          }
        | {
            gateway: "cashfree";
            settlementId?: string;
            paymentLinkUrl: string;
            linkId: string;
            amountMinor: number;
            currency: string;
            feeIds: string[];
          };
    },
    onSuccess: (data) => {
      if (data.gateway === "cashfree") {
        setCashfreeAwaitingWebhook(true);
        window.open(data.paymentLinkUrl, "_blank", "noopener,noreferrer");
        toast({
          title: "Payment page opened",
          description:
            "Complete payment in the new tab. This list refreshes automatically for a short time after confirmation.",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/onboarding-fees"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/onboarding-fee-settlements"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/onboarding-billing-alert"] });
        return;
      }

      const options: Record<string, unknown> = {
        key: data.keyId,
        amount: data.amountMinor,
        currency: data.currency,
        order_id: data.orderId,
        name: "Customer onboarding monthly fee",
        description: "Licensor contract (Platform settings sync)",
        handler: async (response: {
          razorpay_order_id?: string;
          razorpay_payment_id?: string;
          razorpay_signature?: string;
        }) => {
          try {
            const verifyRes = await apiRequest("POST", "/api/admin/onboarding-fees/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            const vBody = await verifyRes.json().catch(() => ({}));
            if (!verifyRes.ok) throw new Error(vBody.message || "Verification failed");
            queryClient.invalidateQueries({ queryKey: ["/api/admin/onboarding-fees"] });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/onboarding-fee-settlements"] });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/onboarding-billing-alert"] });
            setSelectedOnboardingIds(new Set());
            toast({ title: "Paid", description: "Selected monthly onboarding fees marked paid." });
          } catch (e: unknown) {
            toast({
              variant: "destructive",
              title: "Verification failed",
              description: e instanceof Error ? e.message : "Unknown error",
            });
          }
        },
        theme: { color: "#0f172a" },
      };

      const open = () => {
        const rz = window.Razorpay ? new window.Razorpay(options) : null;
        rz?.open();
      };

      if (!window.Razorpay) {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = open;
        document.body.appendChild(script);
      } else {
        open();
      }
    },
    onError: (e: Error) => {
      toast({ variant: "destructive", title: "Payment start failed", description: e.message });
    },
  });

  const formatAmount = (amount: number, currency: string) => {
    return `${currency} ${(amount / 100).toLocaleString()}`;
  };

  const formatDate = (d: string) => {
    return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  /** Month/year for the billed period (monthly rows use `dueAt` as the charge anchor). */
  const formatBillMonth = (d: string) => {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return "—";
    return dt.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  };

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto space-y-8">
      {licensorInactive && licensorState && licensorState.allowed === false ? (
        <Alert className="border-amber-600/60 bg-amber-500/10">
          <AlertTitle className="text-amber-950 dark:text-amber-100">Licensor has suspended this panel</AlertTitle>
          <AlertDescription className="text-amber-950/90 dark:text-amber-50/90 space-y-3 mt-2">
            <p>{licensorState.error}</p>
            <p className="text-sm">
              Pay outstanding onboarding fees below. After payment, customer logins start automatically. If they do not,
              send a reactivation request (email if <code className="text-xs">LICENSOR_ACTIVATION_EMAIL</code> is
              configured on the server).
            </p>
            <Textarea
              placeholder="Optional message (payment reference, transaction id, etc.)"
              value={activationNote}
              onChange={(e) => setActivationNote(e.target.value)}
              rows={3}
              className="resize-none bg-background text-sm max-w-xl"
            />
            <Button
              type="button"
              variant="secondary"
              disabled={activationRequestMutation.isPending}
              onClick={() => activationRequestMutation.mutate()}
            >
              {activationRequestMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Request account reactivation
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      <div>
        <h1 className="text-3xl font-semibold mb-2">Onboarding fees</h1>
        {billingAlert ? (
          <p className="text-sm text-muted-foreground">
            Unpaid total:{" "}
            <strong>
              {formatAmount(billingAlert.outstandingMinor, billingAlert.billingCurrency || "INR")}
            </strong>
            {billingAlert.limitMinor != null ? (
              <>
                {" "}
                · Outstanding limit:{" "}
                <strong>{formatAmount(billingAlert.limitMinor, billingAlert.billingCurrency || "INR")}</strong>
                {billingAlert.overLimit ? (
                  <span className="text-destructive font-medium"> — panel locked until you pay</span>
                ) : null}
              </>
            ) : (
              <> · Set outstanding limit on the SaaS owner portal to auto-lock this panel</>
            )}
          </p>
        ) : null}
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Monthly line items</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Only <strong>end-customers</strong> (Users list / website signup org owners) — not team members from
              Settings → Team, and not WL admin. Fee amount per row comes from synced{" "}
              <code className="text-xs">onboarding_fee</code> on your SaaS licensor contract.
            </p>
          </div>
          <div className="flex flex-col items-stretch sm:items-end gap-1 shrink-0">
            <Button
              type="button"
              disabled={
                selectedOnboardingIds.size === 0 ||
                payOnboardingMutation.isPending ||
                !onboardingData?.batchPaymentGateway
              }
              title={
                !onboardingData?.batchPaymentGateway
                  ? "Set payment_gateway on the licensor portal, then Sync on Platform settings."
                  : undefined
              }
              onClick={() => payOnboardingMutation.mutate(Array.from(selectedOnboardingIds))}
            >
              {payOnboardingMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Pay outstanding
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {onboardingLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (onboardingData?.fees ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No fee rows yet. Website signups appear here as <strong>pending</strong>. Customers created from this
              panel should open checkout immediately. Monthly renewal rows continue while a subscription is active.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 align-middle">
                      {selectableOutstanding.length > 0 ? (
                        <Checkbox
                          checked={
                            allOutstandingSelected ? true : someOutstandingSelected ? "indeterminate" : false
                          }
                          onCheckedChange={(checked) => {
                            if (checked === true) {
                              setSelectedOnboardingIds((prev) => {
                                const next = new Set(prev);
                                for (const f of selectableOutstanding) next.add(f.id);
                                return next;
                              });
                            } else {
                              setSelectedOnboardingIds((prev) => {
                                const next = new Set(prev);
                                for (const f of selectableOutstanding) next.delete(f.id);
                                return next;
                              });
                            }
                          }}
                          aria-label="Select all outstanding fees"
                          title="Select all outstanding"
                        />
                      ) : null}
                    </TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Bill month</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Fee</TableHead>
                    <TableHead>Due date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Txn ref</TableHead>
                    <TableHead className="w-24">Payment details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(onboardingData?.fees ?? []).map((f) => {
                    const selectable = isOnboardingFeeSelectable(f);
                    const name =
                      [f.user?.firstName, f.user?.lastName].filter(Boolean).join(" ") ||
                      f.user?.email ||
                      "—";
                    return (
                      <TableRow key={f.id}>
                        <TableCell className="align-middle">
                          {selectable ? (
                            <Checkbox
                              checked={selectedOnboardingIds.has(f.id)}
                              onCheckedChange={(v) => {
                                setSelectedOnboardingIds((prev) => {
                                  const next = new Set(prev);
                                  if (v === true) next.add(f.id);
                                  else next.delete(f.id);
                                  return next;
                                });
                              }}
                              aria-label={`Select fee for ${name}`}
                            />
                          ) : null}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(f.createdAt)}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatBillMonth(f.dueAt)}</TableCell>
                        <TableCell>
                          <Link href={`/admin/users/${f.userId}`}>
                            <span className="hover:underline">{name}</span>
                          </Link>
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {f.user?.email ?? ""}
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">{f.trigger}</TableCell>
                        <TableCell>
                          {f.amountMinor <= 0 ? "—" : formatAmount(f.amountMinor, f.currency)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(f.dueAt)}</TableCell>
                        <TableCell>
                          <Badge variant={f.status === "paid" ? "default" : f.status === "waived" ? "secondary" : "outline"}>
                            {f.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[140px]">
                          <span className="text-xs font-mono truncate block" title={f.gatewayPaymentId ?? ""}>
                            {f.gatewayPaymentId ? `${f.gatewayPaymentId.slice(0, 14)}…` : "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {f.gatewayPayload && typeof f.gatewayPayload === "object" ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() =>
                                setGatewayPayloadDialog({
                                  title: `Line item ${f.id.slice(0, 8)}…`,
                                  payload: f.gatewayPayload as Record<string, unknown>,
                                })
                              }
                            >
                              View
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
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

      <Card>
        <CardHeader>
          <CardTitle>Batch payments</CardTitle>
          {/* <CardDescription className="space-y-2 max-w-3xl">
            <p>
              <strong>Batch payments</strong> are the receipts for each time you click <strong>Pay outstanding</strong>{" "}
              and complete one checkout for multiple line items above. Each row is one payment transaction: total amount,
              which fee line IDs were included, order or link id, and status until payment is confirmed.
            </p>
            <p className="text-muted-foreground">
              Use this table to audit past checkouts. To pay again, select rows in <strong>Monthly line items</strong> —
              not here.
            </p>
          </CardDescription> */}
        </CardHeader>
        <CardContent>
          {settlementsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (settlementsData?.settlements ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No batch payments yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Created</TableHead>
                    <TableHead>Order / link ID</TableHead>
                    <TableHead>Payment ID</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Lines</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-28">Payload</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(settlementsData?.settlements ?? []).map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(s.createdAt)}</TableCell>
                      <TableCell className="max-w-[160px]">
                        <span className="text-xs font-mono truncate block" title={s.gatewayOrderId}>
                          {s.gatewayOrderId}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[140px]">
                        <span className="text-xs font-mono truncate block" title={s.gatewayPaymentId ?? ""}>
                          {s.gatewayPaymentId ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell>{formatAmount(s.amountMinor, s.currency)}</TableCell>
                      <TableCell>{Array.isArray(s.feeIds) ? s.feeIds.length : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={s.status === "paid" ? "default" : "outline"}>{s.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {s.rawGatewayResponse && typeof s.rawGatewayResponse === "object" ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() =>
                              setGatewayPayloadDialog({
                                title: `Batch payment ${s.gatewayOrderId.slice(0, 12)}…`,
                                payload: s.rawGatewayResponse as Record<string, unknown>,
                              })
                            }
                          >
                            View
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!gatewayPayloadDialog} onOpenChange={(open) => !open && setGatewayPayloadDialog(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="pr-8">{gatewayPayloadDialog?.title ?? "Payment details"}</DialogTitle>
          </DialogHeader>
          <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto whitespace-pre-wrap break-all max-h-[60vh]">
            {gatewayPayloadDialog ? JSON.stringify(gatewayPayloadDialog.payload, null, 2) : ""}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
