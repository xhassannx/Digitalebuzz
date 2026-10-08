// @ts-nocheck
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, TrendingUp, Calendar, CreditCard, Zap, Wallet } from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  computePlanCheckoutBreakdown,
  hasPlanPricingExtras,
  type PlanBillingCycle,
} from "@shared/plan-pricing";

// Declare Razorpay type for TypeScript
declare global {
  interface Window {
    Razorpay: any;
  }
}

type PlanFeatures = {
  maxSessions: number;
  maxMessagesPerMonth: number;
  maxApiCallsPerMinute: number;
  maxWebhooks: number;
  maxContacts?: number;
  maxTeamMembers?: number;
  maxWorkflows?: number;
  maxChatbots?: number;
  maxWabaNumbers?: number;
  hasWhatsappBusinessApi: boolean;
  hasAnalytics: boolean;
  hasPrioritySupport: boolean;
  hasMessageHistorySync?: boolean;
  messageHistorySyncPricePerMB?: number;
  maxMessageHistorySyncMB?: number;
};

type Plan = {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  priceMonthly: number;
  priceQuarterly: number;
  priceYearly: number;
  currency?: string;
  defaultBillingCycle?: string;
  gstType?: string | null;
  gstPercent?: number | null;
  serviceChargePercent?: number | null;
  serviceChargeFixed?: number | null;
  status?: string | null;
  features: PlanFeatures;
  isActive: boolean;
  createdAt: Date;
  /** Marketing bullets from Admin → Plans */
  planFeatures?: string[];
};

/** Same five rows as Admin → Plans → Features & Limits (order preserved). */
const BILLING_PLAN_LIMIT_ROWS: { key: keyof PlanFeatures; label: string }[] = [
  { key: "maxContacts", label: "Contacts" },
  { key: "maxTeamMembers", label: "Active team members" },
  { key: "maxWorkflows", label: "Active workflows" },
  { key: "maxChatbots", label: "Active chatbots" },
  { key: "maxWabaNumbers", label: "Active WABA numbers" },
];

function getBillingPlanFeatureBullets(plan: Plan): string[] {
  const f = plan.features;
  const lines: string[] = [];
  for (const { key, label } of BILLING_PLAN_LIMIT_ROWS) {
    const raw = f[key];
    if (raw === undefined || raw === null) continue;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (Number.isNaN(n)) continue;
    const value = n === -1 ? "Unlimited" : n.toLocaleString();
    lines.push(`${label}: ${value}`);
  }
  return lines.length > 0 ? lines : ["Feature limits are not set for this plan."];
}

function PlanPriceBreakdown({
  plan,
  billingCycle,
  formatPrice,
  compact = false,
}: {
  plan: Plan;
  billingCycle: PlanBillingCycle;
  formatPrice: (cents: number, currency?: string) => string;
  compact?: boolean;
}) {
  const currency = plan.currency || "INR";
  const breakdown = computePlanCheckoutBreakdown(plan, billingCycle);
  const showExtras = hasPlanPricingExtras(plan) || breakdown.serviceChargeMinor > 0;

  if (!showExtras && breakdown.totalMinor === breakdown.baseMinor) {
    return null;
  }

  const gstLabel =
    breakdown.gstType === "exclusive"
      ? `GST (${breakdown.gstPercent}%)`
      : breakdown.gstPercent > 0
        ? `GST included (${breakdown.gstPercent}%)`
        : null;

  if (compact) {
    return (
      <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
        {breakdown.gstType === "exclusive" && breakdown.gstPercent > 0 && (
          <p>+ GST ({breakdown.gstPercent}%): {formatPrice(breakdown.gstMinor, currency)}</p>
        )}
        {breakdown.serviceChargeMinor > 0 && (
          <p>+ Convenience fee: {formatPrice(breakdown.serviceChargeMinor, currency)}</p>
        )}
        {breakdown.gstType === "inclusive" && breakdown.gstPercent > 0 && (
          <p>Includes {breakdown.gstPercent}% GST</p>
        )}
        {((breakdown.gstType === "exclusive" && breakdown.gstPercent > 0) ||
          breakdown.serviceChargeMinor > 0) && (
          <p>
            Total payable:{" "}
            <span className="font-medium text-foreground">
              {formatPrice(breakdown.totalMinor, currency)}
            </span>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5 text-sm border-t pt-3 mt-2">
      <div className="flex justify-between gap-2">
        <span className="text-muted-foreground">Plan price</span>
        <span>{formatPrice(breakdown.baseMinor, currency)}</span>
      </div>
      {breakdown.serviceChargeMinor > 0 && (
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Convenience fee</span>
          <span>{formatPrice(breakdown.serviceChargeMinor, currency)}</span>
        </div>
      )}
      {breakdown.gstPercent > 0 && (
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">{gstLabel}</span>
          <span>
            {breakdown.gstType === "exclusive"
              ? formatPrice(breakdown.gstMinor, currency)
              : formatPrice(breakdown.gstMinor, currency)}
          </span>
        </div>
      )}
      <div className="flex justify-between gap-2 font-semibold pt-1">
        <span>Total payable</span>
        <span data-testid="text-upgrade-total">{formatPrice(breakdown.totalMinor, currency)}</span>
      </div>
      {breakdown.gstType === "inclusive" && breakdown.gstPercent > 0 && (
        <p className="text-xs text-muted-foreground">Listed price includes GST; convenience fee added separately.</p>
      )}
    </div>
  );
}

type Subscription = {
  id: string;
  userId: string;
  planId: string;
  status: string;
  billingCycle: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  plan?: Plan;
};

type Payment = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  gateway: string;
  createdAt: string;
};

export default function BillingPage() {
  const { toast } = useToast();
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [paymentGateway, setPaymentGateway] = useState<'razorpay' | 'stripe' | 'wallet'>('stripe');

  const { data: subscriptionPayload, isLoading: subLoading } = useQuery<{
    subscription: Subscription | null;
    accessActive?: boolean;
    renewalRequired?: boolean;
  }>({
    queryKey: ['/api/subscriptions/current'],
  });
  const subscription = subscriptionPayload;
  const accessActive = subscriptionPayload?.accessActive !== false;
  const renewalRequired = !!subscriptionPayload?.renewalRequired;

  const { data: plans, isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ['/api/plans'],
  });

  const { data: paymentsData } = useQuery<{ payments: Payment[] }>({
    queryKey: ['/api/payments/history'],
  });

  const { data: walletPlatform } = useQuery<{ config: { enabled?: boolean } }>({
    queryKey: ['/api/wallet/config'],
  });

  const { data: walletSummary } = useQuery<{
    wallet?: { balanceMinor?: number; currency?: string };
  }>({
    queryKey: ['/api/wallet/summary'],
    enabled: !!walletPlatform?.config?.enabled,
  });

  const walletBalanceMinor = walletSummary?.wallet?.balanceMinor ?? 0;

  const cancelMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/subscriptions/cancel', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subscriptions/current'] });
      toast({
        title: "Subscription cancelled",
        description: "Your subscription will remain active until the end of the current billing period.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const upgradeMutation = useMutation({
    mutationFn: async (data: { planId: string; billingCycle: string; gateway: string }) => {
      if (data.gateway === 'wallet') {
        const res = await apiRequest('POST', '/api/payments/checkout-wallet', data);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Wallet checkout failed');
        return json;
      }
      if (data.gateway === 'razorpay') {
        const res = await apiRequest('POST', '/api/payments/create-razorpay-order', data);
        return await res.json();
      } else {
        const res = await apiRequest('POST', '/api/payments/checkout-stripe', data);
        return await res.json();
      }
    },
    onSuccess: (data: any) => {
      if (data.paidVia === 'wallet' || data.requiresPayment === false) {
        queryClient.invalidateQueries({ queryKey: ['/api/subscriptions/current'] });
        queryClient.invalidateQueries({ queryKey: ['/api/payments/history'] });
        queryClient.invalidateQueries({ queryKey: ['/api/wallet/summary'] });
        toast({
          title: data.paidVia === 'wallet' ? "Paid from wallet" : "Plan activated",
          description:
            data.paidVia === 'wallet'
              ? "Subscription activated and deducted from your prepaid wallet."
              : "Your plan has been updated successfully.",
        });
        setUpgradeDialogOpen(false);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      } else if (data.subscription?.entity === "subscription" || data.order?.id) {
        const chargeInr =
          typeof data.chargeAmountInr === "number"
            ? data.chargeAmountInr
            : selectedPlan
              ? getPrice(selectedPlan, billingCycle) / 100
              : undefined;
        const useOrderCheckout = Boolean(data.order?.id);
        const razorpayOptions: Record<string, unknown> = {
          key: data.keyId,
          name: selectedPlan?.displayName || "Subscription",
          description:
            chargeInr != null
              ? `₹${chargeInr.toFixed(2)} — ${selectedPlan?.description || ""}`.trim()
              : selectedPlan?.description || "",
          handler: async function (response: any) {
            try {
              const verifyRes = await fetch("/api/payments/verify-razorpay", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ...(useOrderCheckout
                    ? { razorpay_order_id: response.razorpay_order_id }
                    : { razorpay_subscription_id: response.razorpay_subscription_id }),
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                }),
                credentials: "include",
              });

              if (verifyRes.ok) {
                const verifyData = await verifyRes.json().catch(() => ({}));
                queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/current"] });
                const delivery = verifyData?.invoiceDelivery;
                const deliveryNote =
                  delivery?.email?.sent && delivery?.whatsapp?.sent
                    ? " Invoice sent to your email and WhatsApp."
                    : delivery?.email?.sent
                      ? " Invoice sent to your email."
                      : delivery?.whatsapp?.sent
                        ? " Invoice sent to your WhatsApp."
                        : "";
                toast({
                  title: "Subscription activated!",
                  description: `Your subscription has been activated successfully.${deliveryNote}`,
                });
                setUpgradeDialogOpen(false);
              } else {
                throw new Error("Payment verification failed");
              }
            } catch (error: any) {
              toast({
                title: "Payment verification failed",
                description: error.message || "Please contact support if payment was deducted.",
                variant: "destructive",
              });
            }
          },
          prefill: {
            email: "",
          },
          theme: {
            color: "#3399cc",
          },
        };

        if (useOrderCheckout) {
          razorpayOptions.order_id = data.order.id;
        } else {
          razorpayOptions.subscription_id = data.subscription.id;
        }

        // Load Razorpay script if not already loaded
        if (!window.Razorpay) {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = () => {
            const razorpay = new window.Razorpay(razorpayOptions);
            razorpay.open();
          };
          document.body.appendChild(script);
        } else {
          const razorpay = new window.Razorpay(razorpayOptions);
          razorpay.open();
        }
        setUpgradeDialogOpen(false);
      } else {
        toast({
          title: "Checkout unavailable",
          description:
            data?.error ||
            "Payment could not be started. Check Razorpay configuration or try again.",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (renewalRequired && upgradeDialogOpen) setPaymentGateway("razorpay");
  }, [renewalRequired, upgradeDialogOpen]);

  const handleUpgradeClick = (plan: Plan) => {
    setSelectedPlan(plan);
    setUpgradeDialogOpen(true);
  };

  const handleUpgradeConfirm = () => {
    if (!selectedPlan) return;

    upgradeMutation.mutate({
      planId: selectedPlan.id,
      billingCycle,
      gateway: paymentGateway,
    });
  };

  const currentPlan = subscription?.subscription?.plan;

  const getPrice = (plan: Plan, cycle: string) => {
    const normalized =
      cycle === "monthly" || cycle === "quarterly" || cycle === "yearly" ? cycle : "monthly";
    return computePlanCheckoutBreakdown(plan, normalized).totalMinor;
  };

  const getCheckoutBreakdown = (plan: Plan, cycle: PlanBillingCycle) =>
    computePlanCheckoutBreakdown(plan, cycle);

  const formatPrice = (cents: number, currency: string = "USD") => {
    const sym = currency === "INR" ? "₹" : "$";
    return `${sym}${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (subLoading || plansLoading) {
    return (
      <div className="atlas-manage-page atlas-billing-page flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="text-muted-foreground">Loading subscription plans...</div>
        </div>
      </div>
    );
  }

  // Show error if plans failed to load
  if (plans === undefined && !plansLoading) {
    return (
      <div className="atlas-manage-page atlas-billing-page flex items-center justify-center h-full">
        <Card className="max-w-md">
          <CardContent className="py-8 text-center">
            <p className="text-destructive font-medium mb-2">Failed to load subscription plans</p>
            <p className="text-sm text-muted-foreground mb-4">
              Please check your connection and try again.
            </p>
            <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/plans'] })}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="atlas-manage-page atlas-billing-page h-full overflow-auto"
      data-testid="page-billing"
    >
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="rh-page-hero">
          <h1 className="text-3xl font-semibold">Billing & Subscription</h1>
          <p className="text-muted-foreground mt-1">
            Manage your subscription and upgrade your plan
          </p>
        </div>

        {walletPlatform?.config?.enabled && (
          <Alert>
            <Wallet className="h-4 w-4" />
            <AlertTitle>WhatsApp prepaid wallet</AlertTitle>
            <AlertDescription>
              Official API Meta usage is billed from wallet only when your org is on credit_line.
              You can also pay SaaS subscription from wallet (any mode).{" "}
              <Link href="/billing/wallet" className="font-medium underline">
                Open wallet
              </Link>
            </AlertDescription>
          </Alert>
        )}

        {renewalRequired && (
          <Alert className="border-amber-600/50 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Subscription renewal required</AlertTitle>
            <AlertDescription>
              Your billing period has ended (period end date is today or earlier in India time). Choose a plan below and complete payment with Razorpay or Stripe to restore access.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <Card data-testid="card-current-plan">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Current Plan</CardTitle>
                {subscription?.subscription && (
                  <Badge
                    data-testid="badge-subscription-status"
                    variant={
                      subscription.subscription.status === "active" && accessActive ? "default" : "secondary"
                    }
                  >
                    {renewalRequired ? "renewal due" : subscription.subscription.status}
                  </Badge>
                )}
              </div>
              <CardDescription>Your active subscription details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentPlan ? (
                <>
                  <div>
                    <div className="text-2xl font-bold" data-testid="text-plan-name">
                      {currentPlan.displayName || currentPlan.name}
                    </div>
                    {(currentPlan.priceMonthly > 0 ||
                      currentPlan.priceQuarterly > 0 ||
                      currentPlan.priceYearly > 0) && (
                      <div className="text-muted-foreground text-sm" data-testid="text-billing-cycle">
                        {subscription?.subscription?.billingCycle} billing
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Features &amp; limits
                    </p>
                    {getBillingPlanFeatureBullets(currentPlan).map((line, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm">{line}</span>
                      </div>
                    ))}
                  </div>

                  {subscription?.subscription && (
                    <>
                      <Separator />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Period:</span>
                          <span data-testid="text-billing-period">
                            {formatDate(subscription.subscription.currentPeriodStart)} -{' '}
                            {formatDate(subscription.subscription.currentPeriodEnd)}
                          </span>
                        </div>
                        {subscription.subscription.cancelAtPeriodEnd && (
                          <div className="text-sm text-destructive">
                            Cancels at period end
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="text-muted-foreground">No active subscription</div>
              )}
            </CardContent>
            {currentPlan && currentPlan.name !== 'Free' && !subscription?.subscription?.cancelAtPeriodEnd && accessActive && (
              <CardFooter>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => cancelMutation.mutate()}
                  disabled={cancelMutation.isPending}
                  data-testid="button-cancel-subscription"
                >
                  Cancel Subscription
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-4">Available Plans</h2>
          {!plans || plans.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center space-y-4">
                <div className="text-muted-foreground">
                  <p className="font-medium mb-2">No subscription plans available</p>
                  <p className="text-sm">
                    Subscription plans need to be seeded in the database. 
                    Please run the seed script or contact your administrator.
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/plans'] })}
                >
                  Refresh Plans
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {plans.map((plan) => {
              const isCurrentPlan = currentPlan?.id === plan.id;
              const planLockedAsCurrent = isCurrentPlan && accessActive;
              const billingCycle = (plan.defaultBillingCycle || "monthly") as PlanBillingCycle;
              const breakdown = getCheckoutBreakdown(plan, billingCycle);
              const listPrice = breakdown.baseMinor;
              const billingPeriod = billingCycle === 'yearly' ? '/year' : billingCycle === 'quarterly' ? '/quarter' : '/month';
              const isFreePlan = listPrice === 0;
              // Expired / no active plan: do not allow assigning Free again (must pick a paid plan)
              const freeBlockedAfterExpiry = isFreePlan && !accessActive;
              const selectDisabled = planLockedAsCurrent || freeBlockedAfterExpiry;

              return (
                <Card key={plan.id} data-testid={`card-plan-${plan.name.toLowerCase()}`}>
                  <CardHeader>
                    <CardTitle>{plan.displayName}</CardTitle>
                    <div className="text-3xl font-bold">
                      {listPrice === 0 ? 'Free' : formatPrice(listPrice, plan.currency || "INR")}
                      {listPrice > 0 && <span className="text-sm font-normal text-muted-foreground">{billingPeriod}</span>}
                    </div>
                    {listPrice > 0 && (
                      <PlanPriceBreakdown
                        plan={plan}
                        billingCycle={billingCycle}
                        formatPrice={formatPrice}
                        compact
                      />
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2 text-sm">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Features &amp; limits
                      </p>
                      {getBillingPlanFeatureBullets(plan).map((line, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <span>{line}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      className="w-full"
                      variant={planLockedAsCurrent || freeBlockedAfterExpiry ? 'secondary' : 'default'}
                      disabled={selectDisabled}
                      title={
                        freeBlockedAfterExpiry
                          ? "Free plan is not available after your subscription expired. Choose a paid plan."
                          : undefined
                      }
                      onClick={() => handleUpgradeClick(plan)}
                      data-testid={`button-select-${plan.name.toLowerCase()}`}
                    >
                      {planLockedAsCurrent
                        ? 'Current Plan'
                        : freeBlockedAfterExpiry
                          ? 'Unavailable'
                          : isCurrentPlan && renewalRequired
                            ? 'Renew'
                            : isFreePlan
                              ? 'Downgrade'
                              : 'Upgrade'}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
          )}
        </div>

        <Card data-testid="card-payment-history">
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
            <CardDescription>Your recent payments and invoices</CardDescription>
          </CardHeader>
          <CardContent>
            {paymentsData?.payments && paymentsData.payments.length > 0 ? (
              <div className="space-y-3">
                {paymentsData.payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-3 border rounded-md"
                    data-testid={`payment-${payment.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">
                          {formatPrice(payment.amount, payment.currency)} {payment.currency.toUpperCase()}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(payment.createdAt)} · {payment.gateway}
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant={payment.status === 'completed' ? 'default' : 'secondary'}
                      data-testid={`badge-payment-status-${payment.id}`}
                    >
                      {payment.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground text-center py-8">
                No payment history
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
        <DialogContent data-testid="dialog-upgrade-plan">
          <DialogHeader>
            <DialogTitle>Upgrade to {selectedPlan?.displayName}</DialogTitle>
            <DialogDescription>
              Choose your billing cycle and payment method
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Billing Cycle</Label>
              <Select value={billingCycle} onValueChange={(v: any) => setBillingCycle(v)}>
                <SelectTrigger data-testid="select-billing-cycle">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">
                    Monthly —{" "}
                    {selectedPlan &&
                      formatPrice(
                        getCheckoutBreakdown(selectedPlan, "monthly").baseMinor,
                        selectedPlan.currency || "INR"
                      )}
                    /month
                  </SelectItem>
                  <SelectItem value="quarterly">
                    Quarterly —{" "}
                    {selectedPlan &&
                      formatPrice(
                        getCheckoutBreakdown(selectedPlan, "quarterly").baseMinor,
                        selectedPlan.currency || "INR"
                      )}{" "}
                    /quarter
                  </SelectItem>
                  <SelectItem value="yearly">
                    Yearly —{" "}
                    {selectedPlan &&
                      formatPrice(
                        getCheckoutBreakdown(selectedPlan, "yearly").baseMinor,
                        selectedPlan.currency || "INR"
                      )}
                    /year
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Payment Gateway</Label>
              <RadioGroup value={paymentGateway} onValueChange={(v: any) => setPaymentGateway(v)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="stripe" id="stripe" data-testid="radio-stripe" />
                  <Label htmlFor="stripe">Stripe (USD)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="razorpay" id="razorpay" data-testid="radio-razorpay" />
                  <Label htmlFor="razorpay">Razorpay (INR)</Label>
                </div>
                {walletPlatform?.config?.enabled ? (
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="wallet" id="wallet" data-testid="radio-wallet" />
                    <Label htmlFor="wallet">
                      Prepaid wallet (₹{(walletBalanceMinor / 100).toFixed(2)} available)
                    </Label>
                  </div>
                ) : null}
              </RadioGroup>
            </div>

            {selectedPlan && (
              <div className="bg-muted p-4 rounded-md">
                <PlanPriceBreakdown
                  plan={selectedPlan}
                  billingCycle={billingCycle}
                  formatPrice={formatPrice}
                />
                {billingCycle !== "monthly" && (
                  <div className="text-xs text-muted-foreground mt-2">
                    Billed {billingCycle === "quarterly" ? "every 3 months" : "annually"}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUpgradeDialogOpen(false)} data-testid="button-cancel-upgrade">
              Cancel
            </Button>
            <Button
              onClick={handleUpgradeConfirm}
              disabled={upgradeMutation.isPending}
              data-testid="button-confirm-upgrade"
            >
              {upgradeMutation.isPending ? 'Processing...' : 'Continue to Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
