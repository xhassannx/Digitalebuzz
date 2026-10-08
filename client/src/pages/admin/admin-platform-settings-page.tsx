import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { AlertCircle, ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const INTERNAL_KEYS = new Set(["_storedRedacted", "_storedAt", "_syncNote"]);

/** Synced from portal but not shown on this page (sensitive / operational credentials). */
const HIDDEN_FROM_UI_KEYS = new Set([
  "github_username",
  "github_repo_url",
  "github_token",
  "github_password",
  "payment_gateway",
  "payment",
  "payment_gateway_credentials",
  "razorpay_key_id",
  "razorpay_key_secret",
  "cashfree_app_id",
  "cashfree_secret_key",
  "cashfree_webhook_secret",
  "created_at",
  "updated_at",
]);

function parseUpstreamPayload(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      const o = JSON.parse(raw) as unknown;
      if (o && typeof o === "object" && !Array.isArray(o)) return o as Record<string, unknown>;
    } catch {
      /* ignore */
    }
  }
  return {};
}

function formatDisplayValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toLocaleString();
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "bigint") return String(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "—";
    if (trimmed === "[REDACTED]") return "Redacted";
    // Portal / JSON may send numbers as strings (e.g. "100", "0")
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) return trimmed;
    const t = Date.parse(trimmed);
    if (!Number.isNaN(t) && /^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      try {
        return new Date(t).toLocaleString();
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
  return "—";
}

/** Resolve field from portal payload (snake_case from API; camelCase fallback if ever stored). */
function portalFieldValue(p: Record<string, unknown>, snakeKey: string): unknown {
  if (snakeKey in p) return p[snakeKey];
  const camel = snakeKey.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
  if (camel !== snakeKey && camel in p) return p[camel];
  return undefined;
}

/** Mark snake + camel key so extras does not duplicate main/hidden rows when portal uses either form. */
function addKeyAliases(used: Set<string>, snakeKey: string) {
  used.add(snakeKey);
  const camel = snakeKey.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
  if (camel !== snakeKey) used.add(camel);
}

/** Portal may send booleans as 0/1 or strings; normalize for labeled rows. */
function normalizePortalFieldForDisplay(fieldKey: string, value: unknown): unknown {
  if (value === undefined) return undefined;
  if (fieldKey === "is_active" || fieldKey === "webhook_enabled") {
    if (value === true || value === 1 || value === "1" || value === "true" || value === "True") return true;
    if (value === false || value === 0 || value === "0" || value === "false" || value === "False") return false;
    if (fieldKey === "is_active" && typeof value === "string") {
      const t = value.trim().toLowerCase();
      if (["no", "inactive", "off", "disabled", "suspended", "blocked"].includes(t)) return false;
      if (["yes", "active", "on"].includes(t)) return true;
    }
  }
  return value;
}

function DetailRow({
  label,
  value,
  allowNestedJson,
}: {
  label: string;
  value: unknown;
  allowNestedJson?: boolean;
}) {
  const isPlainObject = value !== null && typeof value === "object" && !Array.isArray(value);
  const isArray = Array.isArray(value);
  if (allowNestedJson && (isPlainObject || isArray)) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-3 py-2.5 border-b border-border/50 last:border-0">
        <div className="text-sm font-medium text-muted-foreground">{label}</div>
        <div className="sm:col-span-2">
          <pre className="text-xs font-mono bg-muted/30 rounded-md p-2 overflow-auto max-h-48 whitespace-pre-wrap break-all">
            {JSON.stringify(value, null, 2)}
          </pre>
        </div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-3 py-2.5 border-b border-border/50 last:border-0">
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className="sm:col-span-2 text-sm break-words">{formatDisplayValue(value)}</div>
    </div>
  );
}

/** Renders /api/customer snapshot as labeled fields (no raw JSON). */
function CustomerPortalDetailsView({
  payload,
  productionKeyFromEnv,
}: {
  payload: Record<string, unknown>;
  /** Live key from server env (portal JSON copy is redacted in DB). */
  productionKeyFromEnv: string | null;
}) {
  const p = parseUpstreamPayload(payload);
  const used = new Set<string>();

  const mainFields: { key: string; label: string }[] = [
    { key: "id", label: "Customer ID" },
    { key: "business_name", label: "Business name" },
    { key: "domain", label: "Domain" },
    { key: "ip", label: "Server IP" },
    { key: "is_active", label: "Account active" },
    { key: "notes", label: "Portal notes" },
    { key: "days_remaining", label: "Days remaining" },
    { key: "subscription_start", label: "Subscription start" },
    { key: "subscription_end", label: "Subscription end" },
    { key: "billing_currency", label: "Billing currency" },
    { key: "onboarding_fee", label: "Customer onboarding monthly fee (amount)" },
    { key: "whitelabel_platform_fee", label: "Whitelabel platform fee" },
    {
      key: "outstanding_amount_limit",
      label: "Outstanding unpaid cap (major amount, same units as onboarding fee)",
    },
    { key: "included_users", label: "Included users" },
    { key: "free_trial_days", label: "Free trial days" },
  ];

  const webhookFields: { key: string; label: string }[] = [
    { key: "webhook_url", label: "Webhook URL" },
    { key: "webhook_enabled", label: "Webhook enabled" },
  ];

  for (const { key } of mainFields) addKeyAliases(used, key);
  for (const { key } of webhookFields) addKeyAliases(used, key);
  addKeyAliases(used, "production_key");
  Array.from(HIDDEN_FROM_UI_KEYS).forEach((k) => addKeyAliases(used, k));
  Array.from(INTERNAL_KEYS).forEach((k) => used.add(k));

  const extras = Object.keys(p)
    .filter((k) => !used.has(k))
    .sort((a, b) => a.localeCompare(b));

  const hasMainOrWebhook =
    mainFields.some(({ key }) => portalFieldValue(p, key) !== undefined) ||
    webhookFields.some(({ key }) => portalFieldValue(p, key) !== undefined) ||
    productionKeyFromEnv != null ||
    portalFieldValue(p, "production_key") !== undefined ||
    portalFieldValue(p, "productionKey") !== undefined;

  const hasAny = hasMainOrWebhook || extras.length > 0;

  if (!hasAny) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No snapshot yet. Use <strong>Sync now</strong> when the customer portal is configured.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-2">Account & subscription</h3>
        <div className="rounded-lg border px-4">
          {mainFields.map(({ key, label }) => (
            <DetailRow
              key={key}
              label={label}
              value={normalizePortalFieldForDisplay(key, portalFieldValue(p, key))}
            />
          ))}
          <DetailRow
            label="Production key"
            value={
              productionKeyFromEnv ??
              portalFieldValue(p, "production_key") ??
              portalFieldValue(p, "productionKey")
            }
          />
        </div>
      </section>

      {/* <section>
        <h3 className="text-sm font-semibold text-foreground mb-2">Webhook</h3>
        <div className="rounded-lg border px-4">
          {webhookFields.map(({ key, label }) => (
            <DetailRow
              key={key}
              label={label}
              value={normalizePortalFieldForDisplay(key, portalFieldValue(p, key))}
            />
          ))}
        </div>
      </section> */}

      {extras.length > 0 ? (
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-2">Additional fields from portal</h3>
          <div className="rounded-lg border px-4">
            {extras.map((key) => (
              <DetailRow
                key={key}
                label={key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                value={p[key]}
                allowNestedJson
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

type PlatformMasterRow = {
  id: string;
  upstreamPayload: Record<string, unknown>;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  createdAt: string;
  updatedAt: string;
};

type SettingsResponse = {
  row: PlatformMasterRow | null;
  config: {
    customerApiConfigured: boolean;
    syncSourcePath: string;
    productionKey: string | null;
  };
};

export default function AdminPlatformSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<SettingsResponse>({
    queryKey: ["/api/admin/platform-master-settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/platform-master-settings");
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!user?.isSaaSOwner,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/platform-master-settings/sync");
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Sync failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/platform-master-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/onboarding-billing-alert"] });
      toast({ title: "Sync completed" });
    },
    onError: (e: Error) => {
      toast({ variant: "destructive", title: "Sync failed", description: e.message });
    },
  });

  if (user && !user.isSaaSOwner) {
    return (
      <div className="container max-w-lg mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Access denied
            </CardTitle>
            <CardDescription>Only the SaaS owner can open platform settings.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/dashboard">
              <Button variant="outline">Back to admin</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const row = data?.row;

  return (
    <div className="container max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/dashboard">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Admin
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Platform settings</h1>
      </div>

      {/* <p className="text-sm text-muted-foreground max-w-3xl">
        Whitelabel contract is loaded only from{" "}
        <code className="text-xs">GET {"{CUSTOMER_API_BASE_URL}"}/api/customer</code> (same auth as panel status). It
        is <strong>read-only</strong> on this panel: SaaS admin pushes updates automatically when you save a customer
        or payment gateways; this panel also refreshes every ~15 minutes. Use <strong>Sync now</strong> for an immediate
        pull. Most
        secrets are redacted in the database; the <strong>production key</strong> below is read from this
        instance&apos;s environment (same value used for sync).
      </p> */}

      {error ? (
        <Card className="border-destructive/50">
          <CardContent className="pt-6 text-sm text-destructive">
            {(error as Error).message}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          {/* <CardTitle>Upstream sync</CardTitle> */}
          {/* <CardDescription>
            {data?.config?.customerApiConfigured ? (
              <>
                Sync source:{" "}
                <code className="text-xs">{data.config.syncSourcePath}</code> on your customer portal.
              </>
            ) : (
              "Set CUSTOMER_API_BASE_URL and PRODUCTION_KEY in the environment to enable sync."
            )}
          </CardDescription> */}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending || !data?.config?.customerApiConfigured}
            >
              {syncMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sync Settings
            </Button>
            {row?.lastSyncAt ? (
              <span className="text-sm text-muted-foreground">
                Last sync: {new Date(row.lastSyncAt).toLocaleString()} —{" "}
                <span className="font-medium text-foreground">{row.lastSyncStatus || "—"}</span>
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">No sync recorded yet.</span>
            )}
          </div>
          {row?.lastSyncError ? (
            <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 rounded-md p-3">
              {row.lastSyncError}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Customer portal contract </CardTitle>
          {/* <CardDescription>
            Values mirror your customer portal&apos;s <code className="text-xs">/api/customer</code> for this tenant:
            <strong> null</strong> means the portal sent JSON null (often “not configured”). For example{" "}
            <code className="text-xs">payment_gateway: none</code> usually goes with null Cashfree/Razorpay fields. Other
            secrets show as <strong>Redacted</strong>. Extra keys appear under &quot;Additional fields&quot;.
          </CardDescription> */}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            <CustomerPortalDetailsView
              payload={row?.upstreamPayload ?? {}}
              productionKeyFromEnv={data?.config?.productionKey ?? null}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
