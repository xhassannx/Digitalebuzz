import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Wallet, Loader2, AlertTriangle, Download, BookOpen } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

declare global {
  interface Window {
    Razorpay: any;
  }
}

function loadRazorpayScript(): Promise<void> {
  if (typeof window.Razorpay === "function") return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
  if (existing) {
    return new Promise((resolve, reject) => {
      if (typeof window.Razorpay === "function") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Razorpay")));
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => {
      if (typeof window.Razorpay === "function") resolve();
      else reject(new Error("Razorpay script loaded but checkout is unavailable"));
    };
    script.onerror = () => reject(new Error("Failed to load Razorpay checkout script"));
    document.body.appendChild(script);
  });
}

type WalletTx = {
  id: string;
  type: string;
  amountMinor: number;
  balanceAfterMinor: number;
  metaCategory?: string | null;
  recipientCountryIso?: string | null;
  metaCostMinor?: number | null;
  markupMinor?: number;
  chargedMinor?: number;
  description?: string | null;
  createdAt: string;
};

type WalletSummary = {
  config: { enabled: boolean; currency: string; markupEnabled: boolean; lowBalanceThresholdMinor: number };
  wallet: { balanceMinor: number; currency: string; status: string; lowBalance: boolean };
  transactions: WalletTx[];
};

function formatInr(minor: number, currency = "INR") {
  if (currency !== "INR") return `${(minor / 100).toFixed(2)} ${currency}`;
  return `₹${(minor / 100).toFixed(2)}`;
}

function txTypeLabel(type: string) {
  const map: Record<string, string> = {
    reload: "Reload",
    debit_message: "Message",
    debit_campaign: "Campaign",
    refund: "Refund",
    adjustment: "Adjustment",
  };
  return map[type] || type;
}

export default function WalletBillingPage() {
  const { toast } = useToast();
  const [reloadAmount, setReloadAmount] = useState("500");

  const { data: platformConfig } = useQuery<{ config: { enabled?: boolean } }>({
    queryKey: ["/api/wallet/config"],
  });

  const { data: summary, isLoading } = useQuery<WalletSummary>({
    queryKey: ["/api/wallet/summary"],
    enabled: !!platformConfig?.config?.enabled,
  });

  const reloadMutation = useMutation({
    mutationFn: async (amountMinor: number) => {
      const res = await apiRequest("POST", "/api/wallet/reload/create-order", { amountMinor });
      return res.json();
    },
    onSuccess: async (data: any) => {
      if (!data.order?.id || !data.keyId) {
        toast({ title: "Reload failed", description: "Invalid checkout response", variant: "destructive" });
        return;
      }
      try {
        await loadRazorpayScript();
      } catch (e: any) {
        toast({
          title: "Reload failed",
          description: e?.message || "Could not load Razorpay checkout",
          variant: "destructive",
        });
        return;
      }
      if (typeof window.Razorpay !== "function") {
        toast({
          title: "Reload failed",
          description: "Razorpay checkout is not available in this browser",
          variant: "destructive",
        });
        return;
      }
      const options = {
        key: data.keyId,
        amount: data.order.amount,
        currency: data.order.currency,
        name: "WhatsApp Wallet",
        description: "Prepaid balance for Meta conversation usage",
        order_id: data.order.id,
        method: {
          upi: true,
          card: true,
          netbanking: true,
          wallet: true,
        },
        prefill: {},
        notes: {
          purpose: "wallet_reload",
        },
        handler: async (response: any) => {
          try {
            const verifyRes = await apiRequest("POST", "/api/wallet/reload/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            if (verifyRes.ok) {
              queryClient.invalidateQueries({ queryKey: ["/api/wallet/summary"] });
              toast({ title: "Wallet reloaded", description: "Balance updated successfully." });
            } else {
              const err = await verifyRes.json();
              throw new Error(err.error || "Verification failed");
            }
          } catch (e: any) {
            toast({ title: "Verification failed", description: e.message, variant: "destructive" });
          }
        },
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    },
    onError: (e: Error) => {
      toast({ title: "Reload failed", description: e.message, variant: "destructive" });
    },
  });

  if (!platformConfig?.config?.enabled) {
    return (
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-muted-foreground">Wallet billing is not enabled on this platform.</p>
      </div>
    );
  }

  const balance = summary?.wallet?.balanceMinor ?? 0;
  const currency = summary?.wallet?.currency || "INR";

  return (
    <div className="w-full min-w-0 px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-7 w-7 text-emerald-600" />
            WhatsApp Wallet
          </h1>
          <p className="text-muted-foreground mt-1">
            Prepaid balance for WhatsApp Business API usage. Meta bills your tech partner; this wallet tracks your usage
            {summary?.config.markupEnabled ? " including platform markup" : ""}.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/billing/wallet/guide">
            <BookOpen className="h-4 w-4 mr-2" />
            How wallet billing works
          </Link>
        </Button>
      </div>

      {summary?.wallet?.lowBalance && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="pt-4 flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            Low balance — reload to avoid blocked sends.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Current balance</CardTitle>
            <CardDescription>Available for official API sends</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <p className="text-3xl font-bold">{formatInr(balance, currency)}</p>
            )}
            <Badge variant="outline" className="mt-2">
              {summary?.wallet?.status || "active"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reload wallet</CardTitle>
            <CardDescription>Pay via UPI, cards, netbanking, or wallets (Razorpay)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                value={reloadAmount}
                onChange={(e) => setReloadAmount(e.target.value)}
                placeholder="Amount in ₹"
              />
              <Button
                disabled={reloadMutation.isPending}
                onClick={() => {
                  const rupees = parseFloat(reloadAmount);
                  if (!Number.isFinite(rupees) || rupees < 1) {
                    toast({ title: "Enter at least ₹1", variant: "destructive" });
                    return;
                  }
                  reloadMutation.mutate(Math.round(rupees * 100));
                }}
              >
                {reloadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reload"}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {[500, 1000, 2500, 5000].map((n) => (
                <Button key={n} variant="outline" size="sm" onClick={() => setReloadAmount(String(n))}>
                  ₹{n}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Transaction history</CardTitle>
            <CardDescription>
              Reloads and per-message debits (country-based Meta rates when enabled)
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                const res = await fetch("/api/wallet/transactions/export.csv", { credentials: "include" });
                if (!res.ok) throw new Error("Export failed");
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "wallet-transactions.csv";
                a.click();
                URL.revokeObjectURL(url);
              } catch (e: any) {
                toast({ title: "Export failed", description: e.message, variant: "destructive" });
              }
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(summary?.transactions || []).map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {format(new Date(tx.createdAt), "dd MMM yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={tx.amountMinor >= 0 ? "default" : "secondary"}>
                        {txTypeLabel(tx.type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-md text-sm text-muted-foreground">
                      {tx.description || "—"}
                      {tx.metaCategory && (
                        <span className="block text-xs mt-0.5">
                          {tx.recipientCountryIso && `${tx.recipientCountryIso} · `}
                          {tx.metaCategory}
                          {tx.metaCostMinor != null && ` · Meta ${formatInr(tx.metaCostMinor, currency)}`}
                          {tx.markupMinor > 0 && ` · Markup ${formatInr(tx.markupMinor, currency)}`}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${tx.amountMinor >= 0 ? "text-emerald-600" : ""}`}>
                      {tx.amountMinor >= 0 ? "+" : ""}
                      {formatInr(tx.amountMinor, currency)}
                    </TableCell>
                    <TableCell className="text-right text-sm">{formatInr(tx.balanceAfterMinor, currency)}</TableCell>
                  </TableRow>
                ))}
                {!summary?.transactions?.length && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No transactions yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
