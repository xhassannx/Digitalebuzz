import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Wallet, BookOpen } from "lucide-react";
import { Link } from "wouter";

type WalletBillingConfig = {
  enabled?: boolean;
  skipSaasSubscriptionForOfficialMessages?: boolean;
  markupEnabled?: boolean;
  markupMode?: "fixed_minor" | "percent";
  lowBalanceThresholdMinor?: number;
  allowNegativeBalance?: boolean;
  lowBalanceEmailEnabled?: boolean;
  useCountryRateVersions?: boolean;
  defaultCountryIso?: string;
  metaRatesMinor?: {
    marketing?: number;
    utility?: number;
    authentication?: number;
    service?: number;
  };
  markupByCategory?: {
    marketing?: number;
    utility?: number;
    authentication?: number;
    service?: number;
  };
};

type RateVersion = {
  id: string;
  countryIso: string;
  metaCategory: string;
  rateMinor: number;
  markupMinor?: number | null;
  validFrom: string;
  validTo?: string | null;
  notes?: string | null;
};

type MetaCategory = "marketing" | "utility" | "authentication" | "service";

const DEFAULT_META_PAISE: Record<MetaCategory, number> = {
  marketing: 85,
  utility: 35,
  authentication: 35,
  service: 0,
};

function suggestMetaRatePaise(
  countryIso: string,
  metaCategory: string,
  form: WalletBillingConfig,
  versions: RateVersion[]
): string {
  const cat = metaCategory as MetaCategory;
  const country = countryIso.trim().toUpperCase() || "IN";
  const forCountry = versions
    .filter((v) => v.countryIso.toUpperCase() === country && v.metaCategory === metaCategory)
    .sort((a, b) => new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime());
  if (forCountry[0]) return String(forCountry[0].rateMinor);
  const flat = form.metaRatesMinor?.[cat];
  if (flat != null && Number.isFinite(flat)) return String(flat);
  return String(DEFAULT_META_PAISE[cat] ?? 85);
}

function globalMarkupUnitPaise(metaRateMinor: number, metaCategory: string, form: WalletBillingConfig): number {
  if (!form.markupEnabled) return 0;
  const cat = metaCategory as MetaCategory;
  const raw = form.markupByCategory?.[cat] ?? 0;
  if (form.markupMode === "percent") return Math.round((metaRateMinor * raw) / 100);
  return Math.max(0, Math.round(raw));
}

function effectiveMarkupPaise(
  metaRateMinor: number,
  metaCategory: string,
  form: WalletBillingConfig,
  rateVersionMarkupMinor?: number | null
): number {
  if (!form.markupEnabled) return 0;
  if (rateVersionMarkupMinor != null) return Math.max(0, Math.round(rateVersionMarkupMinor));
  return globalMarkupUnitPaise(metaRateMinor, metaCategory, form);
}

function suggestMarkupPaise(
  countryIso: string,
  metaCategory: string,
  form: WalletBillingConfig,
  versions: RateVersion[]
): string {
  const country = countryIso.trim().toUpperCase() || "IN";
  const row = versions
    .filter((v) => v.countryIso.toUpperCase() === country && v.metaCategory === metaCategory)
    .sort((a, b) => new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime())[0];
  if (row?.markupMinor != null) return String(row.markupMinor);
  if (!form.markupEnabled) return "0";
  const cat = metaCategory as MetaCategory;
  const raw = form.markupByCategory?.[cat];
  if (raw != null && Number.isFinite(raw)) return String(raw);
  return "0";
}

export default function AdminWalletSettingsPage() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<{ config: WalletBillingConfig }>({
    queryKey: ["/api/admin/wallet-billing/config"],
  });
  const { data: facilityData, isLoading: facilityLoading } = useQuery<{
    facility: {
      configured: boolean;
      enabled: boolean;
      balanceMinor: number;
      limitMinor: number;
      currency: string;
    };
  }>({
    queryKey: ["/api/admin/wallet-billing/whitelabel-credit-line"],
  });
  const { data: ratesData, refetch: refetchRates } = useQuery<{ versions: RateVersion[] }>({
    queryKey: ["/api/admin/wallet-billing/rate-versions"],
  });
  const { data: invoiceData, refetch: refetchInvoices } = useQuery<{
    invoices: { id: string; periodLabel: string; metaTotalMinor: number; periodStart: string; periodEnd: string }[];
    runs: { id: string; varianceMinor: number; estimatedMetaMinor: number; actualMetaMinor: number; status: string }[];
  }>({
    queryKey: ["/api/admin/wallet-billing/invoices"],
  });

  const [form, setForm] = useState<WalletBillingConfig>({});
  const [newRate, setNewRate] = useState({
    countryIso: "IN",
    metaCategory: "marketing",
    rateMinor: "85",
    markupMinor: "15",
    validFrom: new Date().toISOString().slice(0, 16),
  });
  const [invoiceForm, setInvoiceForm] = useState({
    periodLabel: "",
    periodStart: "",
    periodEnd: "",
    metaTotalMinor: "",
  });

  useEffect(() => {
    if (data?.config) setForm(data.config);
  }, [data?.config]);

  const versions = ratesData?.versions ?? [];
  const lastRateKey = useRef<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    const key = `${newRate.countryIso}|${newRate.metaCategory}`;
    if (lastRateKey.current === key) return;
    lastRateKey.current = key;
    setNewRate((r) => ({
      ...r,
      rateMinor: suggestMetaRatePaise(r.countryIso, r.metaCategory, form, versions),
      markupMinor: suggestMarkupPaise(r.countryIso, r.metaCategory, form, versions),
    }));
  }, [newRate.metaCategory, newRate.countryIso, form, versions, isLoading]);

  const saveMutation = useMutation({
    mutationFn: async (body: WalletBillingConfig) => {
      const res = await apiRequest("PATCH", "/api/admin/wallet-billing/config", body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/wallet-billing/config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/config"] });
      toast({ title: "Wallet settings saved" });
    },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const setRate = (key: keyof NonNullable<WalletBillingConfig["metaRatesMinor"]>, paise: string) => {
    const n = parseInt(paise, 10);
    setForm((f) => ({
      ...f,
      metaRatesMinor: { ...f.metaRatesMinor, [key]: Number.isFinite(n) ? n : 0 },
    }));
  };

  const setMarkup = (key: keyof NonNullable<WalletBillingConfig["markupByCategory"]>, val: string) => {
    const n = parseInt(val, 10);
    setForm((f) => ({
      ...f,
      markupByCategory: { ...f.markupByCategory, [key]: Number.isFinite(n) ? n : 0 },
    }));
  };

  return (
    <div className="w-full min-w-0 px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-7 w-7 shrink-0" />
            Tech Partner Wallet Billing
          </h1>
          <p className="text-muted-foreground mt-1 max-w-4xl">
            Customers reload a prepaid wallet; Meta charges your tech partner card. Optional markup per conversation
            category (paise).
          </p>
        </div>
        <Button variant="outline" asChild className="shrink-0">
          <Link href="/admin/wallet-billing/guide">
            <BookOpen className="h-4 w-4 mr-2" />
            Setup guide
          </Link>
        </Button>
      </div>

      {!facilityLoading && facilityData?.facility ? (
        <Card>
          <CardHeader>
            <CardTitle>SaaS credit-line facility</CardTitle>
            <CardDescription>
              Allocation from your licensor for credit_line Meta usage. Org wallets are separate — each billable
              credit-line send also burns this facility (Meta cost). Ask SaaS to recharge when empty.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!facilityData.facility.configured ? (
              <p className="text-sm text-muted-foreground">
                Licensor API not configured (CUSTOMER_API_BASE_URL / PRODUCTION_KEY). Facility metering is skipped.
              </p>
            ) : (
              <div className="flex flex-wrap gap-6 text-sm">
                <div>
                  <div className="text-muted-foreground">Status</div>
                  <div className="font-medium">
                    {facilityData.facility.enabled ? "Enabled" : "Disabled"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Balance</div>
                  <div className="font-medium">
                    {facilityData.facility.currency === "INR" ? "₹" : `${facilityData.facility.currency} `}
                    {(facilityData.facility.balanceMinor / 100).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Limit</div>
                  <div className="font-medium">
                    {facilityData.facility.currency === "INR" ? "₹" : `${facilityData.facility.currency} `}
                    {(facilityData.facility.limitMinor / 100).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <div className="space-y-6 min-w-0">
      <Card>
        <CardHeader>
          <CardTitle>Mode</CardTitle>
          <CardDescription>Enable wallet billing for all organizations on this panel</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="enabled" className="flex-1">Wallet billing enabled</Label>
            <Switch
              id="enabled"
              checked={!!form.enabled}
              onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="skipSub" className="flex-1">Skip SaaS subscription check for official API sends</Label>
            <Switch
              id="skipSub"
              checked={form.skipSaasSubscriptionForOfficialMessages !== false}
              onCheckedChange={(v) => setForm((f) => ({ ...f, skipSaasSubscriptionForOfficialMessages: v }))}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="markup" className="flex-1">Markup enabled (optional)</Label>
            <Switch
              id="markup"
              checked={!!form.markupEnabled}
              onCheckedChange={(v) => setForm((f) => ({ ...f, markupEnabled: v }))}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="lowEmail" className="flex-1">Low balance email alerts</Label>
            <Switch
              id="lowEmail"
              checked={form.lowBalanceEmailEnabled !== false}
              onCheckedChange={(v) => setForm((f) => ({ ...f, lowBalanceEmailEnabled: v }))}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="countryRates" className="flex-1">Country + effective-dated rates</Label>
            <Switch
              id="countryRates"
              checked={form.useCountryRateVersions !== false}
              onCheckedChange={(v) => setForm((f) => ({ ...f, useCountryRateVersions: v }))}
            />
          </div>
          </div>
          <div className="space-y-4">
          <div className="space-y-2">
            <Label>Default country ISO (fallback)</Label>
            <Input
              value={form.defaultCountryIso || "IN"}
              onChange={(e) => setForm((f) => ({ ...f, defaultCountryIso: e.target.value.toUpperCase() }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Low balance alert threshold (paise)</Label>
            <Input
              type="number"
              value={form.lowBalanceThresholdMinor ?? 5000}
              onChange={(e) =>
                setForm((f) => ({ ...f, lowBalanceThresholdMinor: parseInt(e.target.value, 10) || 0 }))
              }
            />
            <p className="text-xs text-muted-foreground">e.g. 5000 = ₹50</p>
          </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Meta rates (paise per conversation)</CardTitle>
          <CardDescription>Estimated debit per billable message; reconcile with Meta invoices later</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(["marketing", "utility", "authentication", "service"] as const).map((cat) => (
            <div key={cat}>
              <Label className="capitalize">{cat}</Label>
              <Input
                type="number"
                value={form.metaRatesMinor?.[cat] ?? ""}
                onChange={(e) => setRate(cat, e.target.value)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {form.markupEnabled && (
        <Card>
          <CardHeader>
            <CardTitle>Default markup (paise or %)</CardTitle>
            <CardDescription>
              Used when a rate version row leaves markup blank. Per-country markup is set in Rate versions below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Markup mode</Label>
              <select
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={form.markupMode || "fixed_minor"}
                onChange={(e) =>
                  setForm((f) => ({ ...f, markupMode: e.target.value as "fixed_minor" | "percent" }))
                }
              >
                <option value="fixed_minor">Fixed paise per message</option>
                <option value="percent">Percent of Meta cost</option>
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(["marketing", "utility", "authentication", "service"] as const).map((cat) => (
                <div key={cat}>
                  <Label className="capitalize">{cat}</Label>
                  <Input
                    type="number"
                    value={form.markupByCategory?.[cat] ?? ""}
                    onChange={(e) => setMarkup(cat, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
        </div>

        <div className="space-y-6 min-w-0">
      <Card>
        <CardHeader>
          <CardTitle>Rate versions (country + effective date)</CardTitle>
          <CardDescription>
            Each row stores <strong>Meta charge</strong> and optional <strong>markup (paise)</strong> for that country
            and message type. Leave markup empty to use default markup above. Use DEFAULT country as fallback.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Country</Label>
              <Input
                placeholder="IN, US, DEFAULT"
                value={newRate.countryIso}
                onChange={(e) => setNewRate((r) => ({ ...r, countryIso: e.target.value.toUpperCase() }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Message type</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input px-3 text-sm"
                value={newRate.metaCategory}
                onChange={(e) => setNewRate((r) => ({ ...r, metaCategory: e.target.value }))}
              >
                <option value="marketing">marketing</option>
                <option value="utility">utility</option>
                <option value="authentication">authentication</option>
                <option value="service">service</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Meta charge (paise)</Label>
              <Input
                type="number"
                placeholder="e.g. 85"
                value={newRate.rateMinor}
                onChange={(e) => setNewRate((r) => ({ ...r, rateMinor: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Markup (paise, this country)</Label>
              <Input
                type="number"
                disabled={!form.markupEnabled}
                placeholder={form.markupEnabled ? "e.g. 15 (blank = default)" : "Enable markup above"}
                value={newRate.markupMinor}
                onChange={(e) => setNewRate((r) => ({ ...r, markupMinor: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Valid from</Label>
              <Input
                type="datetime-local"
                value={newRate.validFrom}
                onChange={(e) => setNewRate((r) => ({ ...r, validFrom: e.target.value }))}
              />
            </div>
          </div>
          {form.markupEnabled && (
            <p className="text-xs text-muted-foreground">
              Preview: Meta {newRate.rateMinor || 0} + markup{" "}
              {effectiveMarkupPaise(
                parseInt(newRate.rateMinor, 10) || 0,
                newRate.metaCategory,
                form,
                newRate.markupMinor.trim() === ""
                  ? null
                  : parseInt(newRate.markupMinor, 10) || 0
              )}{" "}
              ={" "}
              {(parseInt(newRate.rateMinor, 10) || 0) +
                effectiveMarkupPaise(
                  parseInt(newRate.rateMinor, 10) || 0,
                  newRate.metaCategory,
                  form,
                  newRate.markupMinor.trim() === "" ? null : parseInt(newRate.markupMinor, 10) || 0
                )}{" "}
              paise per message.
              {newRate.markupMinor.trim() === "" ? " (blank markup uses default above.)" : ""}
            </p>
          )}
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                const markupTrim = newRate.markupMinor.trim();
                const res = await apiRequest("POST", "/api/admin/wallet-billing/rate-versions", {
                  countryIso: newRate.countryIso,
                  metaCategory: newRate.metaCategory,
                  rateMinor: parseInt(newRate.rateMinor, 10),
                  markupMinor:
                    markupTrim === "" ? null : Math.max(0, parseInt(markupTrim, 10) || 0),
                  validFrom: new Date(newRate.validFrom).toISOString(),
                });
                if (!res.ok) throw new Error((await res.json()).error);
                refetchRates();
                toast({ title: "Rate version added" });
              } catch (e: any) {
                toast({ title: "Failed", description: e.message, variant: "destructive" });
              }
            }}
          >
            Add rate version
          </Button>
          <div className="rounded-md border overflow-auto max-h-[min(28rem,50vh)] w-full">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-2 font-medium">Country</th>
                  <th className="p-2 font-medium">Type</th>
                  <th className="p-2 font-medium text-right">Meta (paise)</th>
                  <th className="p-2 font-medium text-right">Markup (paise)</th>
                  <th className="p-2 font-medium text-right">Customer pays</th>
                  <th className="p-2 font-medium">From</th>
                </tr>
              </thead>
              <tbody>
                {versions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-3 text-muted-foreground text-center">
                      No rate versions yet
                    </td>
                  </tr>
                ) : (
                  versions.map((v) => {
                    const markup = effectiveMarkupPaise(v.rateMinor, v.metaCategory, form, v.markupMinor);
                    return (
                      <tr key={v.id} className="border-t">
                        <td className="p-2">{v.countryIso}</td>
                        <td className="p-2 capitalize">{v.metaCategory}</td>
                        <td className="p-2 text-right tabular-nums">{v.rateMinor}</td>
                        <td className="p-2 text-right tabular-nums">
                          {markup}
                          {v.markupMinor != null ? (
                            <span className="block text-[10px] text-muted-foreground">row</span>
                          ) : (
                            <span className="block text-[10px] text-muted-foreground">default</span>
                          )}
                        </td>
                        <td className="p-2 text-right tabular-nums font-medium">{v.rateMinor + markup}</td>
                        <td className="p-2 text-muted-foreground">
                          {new Date(v.validFrom).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Meta invoice reconciliation</CardTitle>
          <CardDescription>
            Enter Meta partner invoice total for a period; compare to sum of wallet meta_cost_minor debits.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              placeholder="Period label (e.g. 2026-04)"
              value={invoiceForm.periodLabel}
              onChange={(e) => setInvoiceForm((f) => ({ ...f, periodLabel: e.target.value }))}
            />
            <Input
              type="number"
              placeholder="Meta total paise"
              value={invoiceForm.metaTotalMinor}
              onChange={(e) => setInvoiceForm((f) => ({ ...f, metaTotalMinor: e.target.value }))}
            />
            <Input
              type="datetime-local"
              value={invoiceForm.periodStart}
              onChange={(e) => setInvoiceForm((f) => ({ ...f, periodStart: e.target.value }))}
            />
            <Input
              type="datetime-local"
              value={invoiceForm.periodEnd}
              onChange={(e) => setInvoiceForm((f) => ({ ...f, periodEnd: e.target.value }))}
            />
          </div>
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                const res = await apiRequest("POST", "/api/admin/wallet-billing/invoices", {
                  periodLabel: invoiceForm.periodLabel,
                  periodStart: new Date(invoiceForm.periodStart).toISOString(),
                  periodEnd: new Date(invoiceForm.periodEnd).toISOString(),
                  metaTotalMinor: parseInt(invoiceForm.metaTotalMinor, 10),
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.error);
                const rec = await apiRequest("POST", "/api/admin/wallet-billing/reconcile", {
                  invoiceId: json.invoice.id,
                });
                const recJson = await rec.json();
                refetchInvoices();
                toast({
                  title: "Reconciliation complete",
                  description: `Variance: ${recJson.run?.varianceMinor ?? 0} paise`,
                });
              } catch (e: any) {
                toast({ title: "Failed", description: e.message, variant: "destructive" });
              }
            }}
          >
            Save invoice & reconcile
          </Button>
          {(invoiceData?.runs || []).slice(0, 5).map((r) => (
            <p key={r.id} className="text-xs text-muted-foreground">
              Run {r.status}: estimated {r.estimatedMetaMinor} vs actual {r.actualMetaMinor} (variance{" "}
              {r.varianceMinor})
            </p>
          ))}
        </CardContent>
      </Card>
        </div>
      </div>

      <CreditLineProvidersCard />

      <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
        {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Save settings
      </Button>
    </div>
  );
}

/** Read-only: Interakt / credit-line provider is configured on the SaaS portal and synced here. */
function CreditLineProvidersCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/credit-line/providers"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/credit-line/providers");
      return res.json();
    },
  });

  const { data: webhookInfo } = useQuery({
    queryKey: ["/api/admin/credit-line/webhook-info"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/credit-line/webhook-info");
      return res.json();
    },
  });

  const { data: facilityData } = useQuery<{
    facility: {
      configured: boolean;
      enabled: boolean;
      balanceMinor: number;
      limitMinor: number;
      currency: string;
    };
  }>({
    queryKey: ["/api/admin/wallet-billing/whitelabel-credit-line"],
  });

  const interakt = data?.providers?.interakt || {};
  const managedBySaas = data?.managedBySaas !== false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Credit-line providers</CardTitle>
        <CardDescription>
          {managedBySaas
            ? "Managed on the SaaS owner portal (Credit-line settings) and synced to this panel. Per-org mode is still set on Admin → Users → user details."
            : "Multi-supplier middleware for template sends. Configure Interakt on the SaaS portal when CUSTOMER_API_BASE_URL is set."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {webhookInfo?.url ? (
          <div className="rounded-lg border bg-muted/40 px-3 py-3 space-y-1">
            <Label>Webhook URL to share with credit-line supplier</Label>
            <p className="font-mono text-xs break-all select-all">{webhookInfo.url}</p>
            <p className="text-xs text-muted-foreground">
              {webhookInfo.note ||
                "Give this as the default callback URL for number-connect / WABA_ONBOARDED."}{" "}
              Verify token: {webhookInfo.verifyTokenHint}.
            </p>
          </div>
        ) : null}

        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <div className="text-muted-foreground">Interakt</div>
              <div className="font-medium">
                {interakt.enabled ? "Enabled" : "Disabled"}
                {interakt.accessTokenSet ? " · token set" : " · token missing"}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Partner solution ID</div>
              <div className="font-mono text-xs break-all">{interakt.solutionId || "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">API base</div>
              <div className="font-mono text-xs break-all">{interakt.apiBaseUrl || "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">MM Lite</div>
              <div className="font-medium">{interakt.mmLiteEnabled !== false ? "On" : "Off"}</div>
            </div>
            {facilityData?.facility?.configured ? (
              <div className="sm:col-span-2">
                <div className="text-muted-foreground">SaaS facility on this panel</div>
                <div className="font-medium">
                  {facilityData.facility.enabled ? "Enabled" : "Disabled"} · balance{" "}
                  {facilityData.facility.currency === "INR" ? "₹" : `${facilityData.facility.currency} `}
                  {(facilityData.facility.balanceMinor / 100).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}{" "}
                  / limit{" "}
                  {(facilityData.facility.limitMinor / 100).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
