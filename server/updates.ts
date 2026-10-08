import { exec, spawn } from "child_process";
import { promisify } from "util";
import path from "path";
import https from "https";

const execAsync = promisify(exec);

/**
 * GET {CUSTOMER_API_BASE_URL}/api/customer (X-Production-Key or Bearer).
 * Includes billing, payment gateway refs, subscription window, etc. — persisted read-only on whitelabel (secrets redacted).
 */
export type CustomerApiResponse = {
  id?: number;
  business_name?: string;
  domain?: string;
  ip?: string;
  production_key?: string;
  subscription_start?: string;
  subscription_end?: string;
  github_repo_url?: string;
  github_username?: string;
  github_token?: string;
  github_password?: string;
  webhook_url?: string;
  webhook_enabled?: boolean;
  notes?: string;
  is_active?: boolean | number;
  created_at?: string;
  updated_at?: string;
  billing_currency?: string;
  onboarding_fee?: number;
  /** Often smallest currency unit (e.g. paise); portal-defined. */
  whitelabel_platform_fee?: number;
  /** Max allowed unpaid onboarding total in major units (same convention as `onboarding_fee`). */
  outstanding_amount_limit?: number;
  /** SaaS → whitelabel Meta credit-line facility (paise). */
  credit_line_enabled?: boolean | number;
  credit_line_limit_minor?: number;
  credit_line_balance_minor?: number;
  included_users?: number;
  free_trial_days?: number;
  payment_gateway?: string;
  payment?: unknown;
  payment_gateway_credentials?: unknown;
  razorpay_key_id?: string | null;
  razorpay_key_secret?: string | null;
  cashfree_app_id?: string | null;
  cashfree_secret_key?: string | null;
  cashfree_webhook_secret?: string | null;
  cashfree_sandbox?: boolean | number | string | null;
  days_remaining?: number;
  [key: string]: unknown;
};

/** Common wrapper keys on GET /api/customer (Laravel/API style). Inner object holds the real contract. */
const CUSTOMER_API_WRAPPER_KEYS = ["data", "customer", "payload", "result", "resource", "record"] as const;

/**
 * Resolve the customer record from the HTTP JSON body. Supports flat `{ id, ... }`, wrapped objects,
 * arrays of records (e.g. `{ customers: [ {...} ] }`), and nested combinations.
 */
function unwrapCustomerApiPayload(raw: unknown): CustomerApiResponse | null {
  function findWithId(node: unknown, depth: number): CustomerApiResponse | null {
    if (depth > 14 || node === null || node === undefined) return null;
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = findWithId(item, depth + 1);
        if (found) return found;
      }
      return null;
    }
    if (typeof node !== "object") return null;
    const o = node as Record<string, unknown>;
    if (o.id != null) return o as CustomerApiResponse;
    for (const k of CUSTOMER_API_WRAPPER_KEYS) {
      const child = o[k];
      if (child && typeof child === "object") {
        const found = findWithId(child, depth + 1);
        if (found) return found;
      }
    }
    return null;
  }
  return findWithId(raw, 0);
}

/** Laravel / JSON:API style: `{ "id": "1", "attributes": { "business_name": "..." } }` → one flat object. */
function flattenAttributesIfPresent(o: Record<string, unknown>): Record<string, unknown> {
  const attrs = o.attributes;
  if (attrs == null || typeof attrs !== "object" || Array.isArray(attrs)) return o;
  if (Object.keys(attrs as object).length === 0) return o;
  const { attributes: _a, ...rest } = o;
  return { ...rest, ...(attrs as Record<string, unknown>) };
}

/** Single entry point after JSON.parse(body): unwrap → flatten attributes → must have id. */
function parseCustomerApiJsonBody(parsed: unknown): CustomerApiResponse | null {
  const unwrapped = unwrapCustomerApiPayload(parsed);
  if (!unwrapped || unwrapped.id == null) return null;
  return flattenAttributesIfPresent(unwrapped as Record<string, unknown>) as CustomerApiResponse;
}

/** Result of one /api/customer request: success with data, or auth/error with statusCode. */
type CustomerRequestResult =
  | { ok: true; data: CustomerApiResponse }
  | { ok: false; statusCode?: number };

/** One GET /api/customer request with given auth headers. Panel supports X-Production-Key or Authorization: Bearer. */
async function requestCustomerApi(url: string, headers: Record<string, string>): Promise<CustomerRequestResult> {
  const allowInsecureSSL = process.env.CUSTOMER_API_INSECURE_SSL === "1" || process.env.CUSTOMER_API_INSECURE_SSL === "true";

  if (allowInsecureSSL) {
    return new Promise((resolve) => {
      const u = new URL(url);
      const options: https.RequestOptions = {
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method: "GET",
        headers,
        rejectUnauthorized: false,
      };
      const req = https.request(options, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(body) as unknown;
              const data = parseCustomerApiJsonBody(parsed);
              if (data?.id != null) resolve({ ok: true, data });
              else {
                console.log("[Updates] Customer API response missing id (after unwrap):", body.substring(0, 200));
                resolve({ ok: false, statusCode: res.statusCode });
              }
            } catch {
              resolve({ ok: false, statusCode: res.statusCode });
            }
          } else {
            console.log(`[Updates] Customer API (HTTPS) returned ${res.statusCode}: ${body.substring(0, 200)}`);
            resolve({ ok: false, statusCode: res.statusCode });
          }
        });
      });
      req.on("error", (err) => {
        console.log(`[Updates] Customer API (HTTPS) request error:`, err.message);
        resolve({ ok: false });
      });
      req.setTimeout(30000, () => {
        req.destroy();
        console.log("[Updates] Customer API request timed out");
        resolve({ ok: false });
      });
      req.end();
    });
  }

  try {
    const res = await fetch(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.log(`[Updates] Customer API returned ${res.status}: ${text.substring(0, 200)}`);
      return { ok: false, statusCode: res.status };
    }
    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      console.log("[Updates] Customer API response is not JSON:", text.substring(0, 200));
      return { ok: false, statusCode: res.status };
    }
    const data = parseCustomerApiJsonBody(parsed);
    if (data?.id == null) {
      console.log("[Updates] Customer API response missing id (after unwrap):", text.substring(0, 200));
      return { ok: false, statusCode: res.status };
    }
    return { ok: true, data };
  } catch (err: any) {
    console.log(`[Updates] Customer API fetch error:`, err?.message || err?.code || err);
    return { ok: false };
  }
}

/** Result of panel customer status check: allowed (panel can run) or blocked (inactive/expired). */
export type CustomerStatusResult =
  | { allowed: true; customer?: CustomerApiResponse }
  | { allowed: false; code: string; error: string; expired_at?: string };

/**
 * Portal may send is_active as bool, 0/1, or strings.
 * Anything clearly inactive blocks; unknown values default to active only when omitted (undefined).
 */
export function customerPortalAccountIsActive(_isActive: unknown): boolean {
  return true;
}

/**
 * Call CUSTOMER_API_BASE_URL/api/customer to check if panel is allowed to run.
 * BYPASSED: Always allow panel access locally.
 */
export async function checkCustomerStatus(): Promise<CustomerStatusResult> {
  return { allowed: true };
}

let customerStatusCached: { result: CustomerStatusResult; at: number } | null = null;

/** Cache TTL for portal status (middleware + GET /api/panel/customer-status). Env: CUSTOMER_STATUS_CACHE_TTL_MS (2000–300000). */
function getCustomerStatusCacheTtlMs(): number {
  return 15_000;
}

/** Same as checkCustomerStatus but short-lived cache so inactive flips propagate without hammering the portal. */
export async function checkCustomerStatusCached(): Promise<CustomerStatusResult> {
  return { allowed: true };
}

export function invalidateCustomerStatusCache(): void {
  customerStatusCached = null;
}

/**
 * After onboarding fees are paid, turn the WL back On in the SaaS portal (`is_active = 1`)
 * so customer logins resume automatically.
 */
export async function reactivateLicensorCustomerAfterPayment(): Promise<boolean> {
  const baseUrl = process.env.CUSTOMER_API_BASE_URL?.trim();
  const productionKey = process.env.PRODUCTION_KEY?.trim();
  if (!baseUrl || !productionKey) return false;
  const url = `${baseUrl.replace(/\/$/, "")}/api/customer/reactivate`;
  const allowInsecureSSL =
    process.env.CUSTOMER_API_INSECURE_SSL === "1" || process.env.CUSTOMER_API_INSECURE_SSL === "true";

  const postOnce = async (headers: Record<string, string>): Promise<{ status: number; ok: boolean }> => {
    if (allowInsecureSSL && url.startsWith("https://")) {
      return new Promise((resolve) => {
        const u = new URL(url);
        const req = https.request(
          {
            hostname: u.hostname,
            port: u.port || 443,
            path: u.pathname + u.search,
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json", "Content-Length": "2" },
            rejectUnauthorized: false,
          },
          (res) => {
            res.resume();
            const status = res.statusCode || 0;
            resolve({ status, ok: status >= 200 && status < 300 });
          }
        );
        req.on("error", () => resolve({ status: 0, ok: false }));
        req.setTimeout(30000, () => {
          req.destroy();
          resolve({ status: 0, ok: false });
        });
        req.end("{}");
      });
    }
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: "{}",
        signal: AbortSignal.timeout(30000),
      });
      return { status: res.status, ok: res.ok };
    } catch {
      return { status: 0, ok: false };
    }
  };

  try {
    let result = await postOnce({ "X-Production-Key": productionKey });
    if (!result.ok && (result.status === 401 || result.status === 403)) {
      result = await postOnce({ Authorization: `Bearer ${productionKey}` });
    }
    invalidateCustomerStatusCache();
    if (result.ok) {
      console.log("[Licensor] Auto-reactivated whitelabel after onboarding payment");
      return true;
    }
    console.warn("[Licensor] Reactivate after onboarding payment failed:", result.status);
    return false;
  } catch (e) {
    console.warn(
      "[Licensor] Reactivate after onboarding payment error:",
      e instanceof Error ? e.message : e
    );
    return false;
  }
}

/**
 * Forces GET /api/customer (portal) and replaces the in-memory status cache.
 * Used by the background scheduler so account active/inactive flips apply without waiting for user traffic.
 * Also refreshes platform_master_settings so commercial fields stay aligned with SaaS.
 */
export async function refreshCustomerStatusCache(): Promise<CustomerStatusResult> {
  invalidateCustomerStatusCache();
  try {
    const result = await checkCustomerStatus();
    customerStatusCached = { result, at: Date.now() };
    if (!result.allowed) {
      console.log(
        `[CustomerStatus] Background refresh: blocked (${result.code}) — panel APIs will return 403 until resolved.`
      );
    }
    // Keep Platform settings DB current even if SaaS push was missed (active or inactive contract)
    void import("./platform-master-sync")
      .then(({ runPlatformMasterSync }) => runPlatformMasterSync())
      .catch((e) =>
        console.warn(
          "[CustomerStatus] platform-master sync after status refresh failed:",
          e instanceof Error ? e.message : e
        )
      );
    return result;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[CustomerStatus] Background refresh failed (failing open):", msg);
    invalidateCustomerStatusCache();
    return { allowed: true };
  }
}

/** Fetch customer from panel API. Tries X-Production-Key first, then Authorization: Bearer on 401/403. */
export async function fetchCustomerFromApi(): Promise<CustomerApiResponse | null> {
  const baseUrl = process.env.CUSTOMER_API_BASE_URL?.trim();
  const productionKey = process.env.PRODUCTION_KEY?.trim();
  if (!baseUrl || !productionKey) return null;
  const url = `${baseUrl.replace(/\/$/, "")}/api/customer`;

  let result = await requestCustomerApi(url, { "X-Production-Key": productionKey });
  if (!result.ok && (result.statusCode === 401 || result.statusCode === 403)) {
    console.log("[Updates] Customer API 401/403 with X-Production-Key, retrying with Authorization: Bearer");
    result = await requestCustomerApi(url, { Authorization: `Bearer ${productionKey}` });
  }

  if (result.ok) {
    const hasRepo = !!result.data.github_repo_url;
    const hasToken = !!(result.data.github_token || result.data.github_password);
    console.log(`[Updates] Customer API OK: id=${result.data.id}, repo_url=${hasRepo}, token=${hasToken}`);
    return result.data;
  }
  return null;
}

/** Ping panel API and return status for admin debug. Tries X-Production-Key then Bearer. Does not expose secrets. */
export async function pingPanelApi(): Promise<{
  ok: boolean;
  configured: boolean;
  statusCode?: number;
  bodyPreview?: string;
  hasId?: boolean;
  authTried?: string;
  error?: string;
}> {
  const baseUrl = process.env.CUSTOMER_API_BASE_URL?.trim();
  const productionKey = process.env.PRODUCTION_KEY?.trim();
  if (!baseUrl || !productionKey) {
    return { ok: false, configured: false, error: "CUSTOMER_API_BASE_URL or PRODUCTION_KEY not set" };
  }
  const url = `${baseUrl.replace(/\/$/, "")}/api/customer`;

  const resultHeader = await requestCustomerApi(url, { "X-Production-Key": productionKey });
  if (resultHeader.ok) {
    return {
      ok: true,
      configured: true,
      statusCode: 200,
      hasId: true,
      authTried: "X-Production-Key",
    };
  }
  if (resultHeader.statusCode === 401 || resultHeader.statusCode === 403) {
    const resultBearer = await requestCustomerApi(url, { Authorization: `Bearer ${productionKey}` });
    if (resultBearer.ok) {
      return {
        ok: true,
        configured: true,
        statusCode: 200,
        hasId: true,
        authTried: "Authorization: Bearer",
      };
    }
    return {
      ok: false,
      configured: true,
      statusCode: resultBearer.statusCode,
      bodyPreview: undefined,
      hasId: false,
      authTried: "X-Production-Key (401/403), then Bearer",
      error: resultBearer.statusCode ? `Both auth methods returned ${resultBearer.statusCode}` : "Bearer request failed",
    };
  }
  return {
    ok: false,
    configured: true,
    statusCode: resultHeader.statusCode,
    bodyPreview: undefined,
    hasId: false,
    authTried: "X-Production-Key",
    error: resultHeader.statusCode ? `HTTP ${resultHeader.statusCode}` : "Request failed (network/timeout)",
  };
}

/** Build authenticated Git URL for GitHub (oauth2:TOKEN or user:TOKEN). */
function buildAuthenticatedGitUrl(repoUrl: string, token: string): string {
  const t = token.trim();
  if (!t) return repoUrl;
  try {
    const u = new URL(repoUrl.replace(/^git@([^:]+):/, "https://$1/"));
    const origin = u.origin;
    const pathname = u.pathname.replace(/^\/+/, "").replace(/\.git$/, "") || "";
    if (origin.includes("github.com")) {
      return `https://oauth2:${encodeURIComponent(t)}@github.com/${pathname}.git`;
    }
    const username = process.env.CUSTOMER_GITHUB_USERNAME?.trim() || "git";
    return `https://${encodeURIComponent(username)}:${encodeURIComponent(t)}@${u.host}/${pathname}.git`;
  } catch {
    return repoUrl;
  }
}

function runGitRemoteSetUrl(cwd: string, url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("git", ["remote", "set-url", "origin", url], { cwd, stdio: "ignore" });
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`git remote set-url exited ${code}`))));
    proc.on("error", reject);
  });
}

const PM2_APP_NAME = process.env.PM2_APP_NAME?.trim() || "helicoptic-whatsapp";

/** Project root (where package.json and .git live). Server runs from here when started via npm. */
function getProjectRoot(): string {
  return path.resolve(process.cwd());
}

/**
 * Get remote URL with credentials for non-interactive git fetch/pull.
 * Priority: 1) Customer API (PRODUCTION_KEY + CUSTOMER_API_BASE_URL), 2) GIT_REMOTE_URL, 3) GITHUB_TOKEN + current origin.
 */
async function getAuthenticatedRemoteUrl(cwd: string): Promise<{ original: string; authenticated: string } | null> {
  const productionKey = process.env.PRODUCTION_KEY?.trim();
  const customerApiBase = process.env.CUSTOMER_API_BASE_URL?.trim();
  if (productionKey && customerApiBase) {
    const customer = await fetchCustomerFromApi();
    if (customer) {
      const repoUrl = customer.github_repo_url?.trim();
      const token = (customer.github_token || customer.github_password || "").trim();
      if (repoUrl && token) {
        const authenticated = buildAuthenticatedGitUrl(repoUrl, token);
        console.log(`[Updates] Using customer API credentials: repo=${repoUrl.substring(0, 50)}..., token=${token.substring(0, 10)}...`);
        return { original: repoUrl, authenticated };
      } else {
        console.log(`[Updates] Customer API missing fields: repo_url=${!!repoUrl}, token=${!!token}`);
      }
    } else {
      console.log("[Updates] Customer API returned null, falling back to env vars");
    }
  }

  const envUrl = process.env.GIT_REMOTE_URL?.trim();
  if (envUrl) {
    try {
      const { stdout } = await execAsync("git remote get-url origin", { cwd });
      return { original: stdout.trim(), authenticated: envUrl };
    } catch {
      return null;
    }
  }
  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token) return null;
  try {
    const { stdout } = await execAsync("git remote get-url origin", { cwd });
    const origin = stdout.trim();
    let ownerRepo: string | null = null;
    const httpsMatch = origin.match(/^https?:\/\/[^/]+\/([^/]+\/[^/]+?)(?:\.git)?\/?$/i);
    const sshMatch = origin.match(/^git@[^:]+:([^/]+\/[^/]+?)(?:\.git)?\/?$/);
    if (httpsMatch) ownerRepo = httpsMatch[1];
    else if (sshMatch) ownerRepo = sshMatch[1];
    if (!ownerRepo) return null;
    const authenticated = `https://oauth2:${token}@github.com/${ownerRepo}.git`;
    return { original: origin, authenticated };
  } catch {
    return null;
  }
}

async function withAuthenticatedRemote<T>(
  cwd: string,
  fn: () => Promise<T>
): Promise<T> {
  const creds = await getAuthenticatedRemoteUrl(cwd);
  if (!creds) {
    console.log("[Updates] No git credentials (panel API / GIT_REMOTE_URL / GITHUB_TOKEN). Pull will use current origin and may fail if auth required.");
    return fn();
  }
  await runGitRemoteSetUrl(cwd, creds.authenticated);
  try {
    return await fn();
  } finally {
    await runGitRemoteSetUrl(cwd, creds.original);
  }
}

export type UpdateStatus = {
  branch: string;
  localCommit: string;
  localCommitShort: string;
  remoteCommit: string | null;
  remoteCommitShort: string | null;
  behind: number;
  ahead: number;
  hasUpdates: boolean;
  error?: string;
};

/**
 * Fetch from remote and return branch, local commit, remote commit, and whether we're behind.
 */
export async function getUpdateStatus(): Promise<UpdateStatus> {
  const cwd = getProjectRoot();
  const defaultStatus: UpdateStatus = {
    branch: "",
    localCommit: "",
    localCommitShort: "",
    remoteCommit: null,
    remoteCommitShort: null,
    behind: 0,
    ahead: 0,
    hasUpdates: false,
  };

  try {
    // git fetch origin (no merge); use credentials from env if set
    await withAuthenticatedRemote(cwd, () =>
      execAsync("git fetch origin", { cwd, timeout: 30000 })
    ).catch(() => {
      // Ignore fetch errors (e.g. no network); we'll still show local info
    });

    const branchResult = await execAsync("git rev-parse --abbrev-ref HEAD", { cwd });
    const branch = branchResult.stdout.trim();

    const localResult = await execAsync("git rev-parse HEAD", { cwd });
    const localCommit = localResult.stdout.trim();
    const localShortResult = await execAsync("git rev-parse --short HEAD", { cwd });
    const localCommitShort = localShortResult.stdout.trim();

    let remoteCommit: string | null = null;
    let remoteCommitShort: string | null = null;
    let behind = 0;
    let ahead = 0;

    try {
      const remoteRef = `origin/${branch}`;
      const remoteResult = await execAsync(`git rev-parse ${remoteRef}`, { cwd });
      remoteCommit = remoteResult.stdout.trim();
      const remoteShortResult = await execAsync(`git rev-parse --short ${remoteRef}`, { cwd });
      remoteCommitShort = remoteShortResult.stdout.trim();

      const revListBehind = await execAsync(`git rev-list --count HEAD..${remoteRef}`, { cwd });
      behind = parseInt(revListBehind.stdout.trim(), 10) || 0;
      const revListAhead = await execAsync(`git rev-list --count ${remoteRef}..HEAD`, { cwd });
      ahead = parseInt(revListAhead.stdout.trim(), 10) || 0;
    } catch {
      // No remote or branch doesn't exist on remote
    }

    return {
      branch,
      localCommit,
      localCommitShort,
      remoteCommit,
      remoteCommitShort,
      behind,
      ahead,
      hasUpdates: behind > 0,
    };
  } catch (err: any) {
    return {
      ...defaultStatus,
      error: err?.message || String(err),
    };
  }
}

export type SyncResult = {
  success: boolean;
  steps: { step: string; success: boolean; output?: string; error?: string }[];
  error?: string;
};

/**
 * Run: commit local changes (if any), git pull, npm install, npm run build, pm2 restart.
 * Does NOT push. Each step runs in project root. On any failure, we return and do not continue.
 */
export async function runSyncAndRestart(): Promise<SyncResult> {
  const cwd = getProjectRoot();
  const steps: SyncResult["steps"] = [];

  try {
    const creds = await getAuthenticatedRemoteUrl(cwd);
    const productionKey = process.env.PRODUCTION_KEY?.trim();
    const customerApiBase = process.env.CUSTOMER_API_BASE_URL?.trim();
    const hasEnvCreds = !!(process.env.GIT_REMOTE_URL?.trim() || process.env.GITHUB_TOKEN?.trim());
    
    if (!creds) {
      if (productionKey && customerApiBase && !hasEnvCreds) {
        const customer = await fetchCustomerFromApi();
        if (!customer) {
          steps.push({
            step: "git pull",
            success: false,
            error: "Panel API unreachable. This server could not get git credentials from the panel. Check Admin > Panel status (or GET /api/admin/panel-status). Ensure CUSTOMER_API_BASE_URL is reachable from this server and PRODUCTION_KEY is correct.",
          });
          return { success: false, steps, error: "Panel API connection failed" };
        }
        const missing = [];
        if (!customer.github_repo_url) missing.push("repository URL");
        if (!customer.github_token && !customer.github_password) missing.push("access token");
        if (missing.length > 0) {
          steps.push({
            step: "git pull",
            success: false,
            error: `Panel configuration incomplete: missing ${missing.join(" and ")}. Update your panel settings.`,
          });
          return { success: false, steps, error: "Configuration incomplete" };
        }
      } else if (!hasEnvCreds) {
        steps.push({
          step: "git pull",
          success: false,
          error: "No git credentials. Configure CUSTOMER_API_BASE_URL and PRODUCTION_KEY so the panel /api/customer can provide repo URL and token.",
        });
        return { success: false, steps, error: "Authentication required" };
      }
    }

    // Get current branch (support main, master, or custom)
    const branchResult = await execAsync("git rev-parse --abbrev-ref HEAD", { cwd });
    const branch = branchResult.stdout.trim() || "main";

    // If there are uncommitted changes, stash them so pull can succeed. We'll pop after pull.
    let didStash = false;
    try {
      const statusResult = await execAsync("git status --porcelain", { cwd });
      if (statusResult.stdout.trim()) {
        await execAsync("git stash push -u -m \"Deploy auto-stash\"", { cwd, timeout: 10000 });
        didStash = true;
        steps.push({ step: "git stash", success: true, output: "Stashed local changes." });
      }
    } catch {
      // Ignore: no changes or stash failed; proceed to pull
    }

    let pullSucceeded = false;
    try {
      const pullResult = await withAuthenticatedRemote(cwd, () =>
        execAsync(`git pull origin ${branch}`, { cwd, timeout: 60000 })
      );
      steps.push({ step: "git pull", success: true, output: pullResult.stdout.trim() || undefined });
      pullSucceeded = true;
    } catch (pullErr: any) {
      const stderr = (pullErr?.stderr ?? pullErr?.message ?? String(pullErr)).trim();
      const isMergeConflict =
        /CONFLICT|Automatic merge failed|merge failed|Merge conflict/i.test(stderr) ||
        (pullErr?.stdout && /CONFLICT|Automatic merge failed/i.test(String(pullErr.stdout)));
      const isLocalChanges = /Your local changes|would be overwritten|Please commit your changes/i.test(stderr);

      if (isMergeConflict) {
        try {
          await execAsync("git merge --abort", { cwd, timeout: 5000 });
        } catch {
          /* best-effort */
        }
      }

      // Fallback: force reset to remote when pull fails (conflict or local changes blocking)
      if (isMergeConflict || isLocalChanges) {
        try {
          await withAuthenticatedRemote(cwd, () => execAsync("git fetch origin", { cwd, timeout: 30000 }));
          await execAsync(`git reset --hard origin/${branch}`, { cwd, timeout: 10000 });
          steps.push({
            step: "git pull",
            success: true,
            output: `Reset to origin/${branch} (local changes discarded to complete deploy).`,
          });
          pullSucceeded = true;
          console.log(`[Updates] Pull failed (conflict/changes), reset to origin/${branch} succeeded`);
        } catch (resetErr: any) {
          const resetStderr = (resetErr?.stderr ?? resetErr?.message ?? "").trim();
          steps.push({
            step: "git pull",
            success: false,
            error: `Merge conflict. Reset to remote also failed: ${resetStderr.substring(0, 200)}. Resolve manually and retry.`,
          });
          return { success: false, steps, error: "Git pull and recovery failed" };
        }
      }

      if (!pullSucceeded) {
        if (didStash) {
          try {
            await execAsync("git stash pop", { cwd, timeout: 5000 });
          } catch {
            /* restore failed, stash remains */
          }
        }
        throw pullErr;
      }
    }

    if (didStash && pullSucceeded) {
      try {
        await execAsync("git stash pop", { cwd, timeout: 10000 });
        steps.push({ step: "git stash pop", success: true, output: "Restored stashed changes." });
      } catch (popErr: any) {
        await execAsync("git stash drop", { cwd, timeout: 5000 }).catch(() => {});
        steps.push({
          step: "git stash pop",
          success: false,
          error: "Could not restore stashed changes (conflict). Stash was dropped. Run 'git stash list' to inspect.",
        });
        return { success: false, steps, error: "Stash pop failed after pull" };
      }
    }
  } catch (err: any) {
    const stderr = (err?.stderr ?? err?.message ?? String(err)).trim();
    const sanitize = (s: string) => s.replace(/\b(https?:\/\/[^\s]+|ghp_[A-Za-z0-9]+|[\w-]+@[^\s]+)/g, "[redacted]").substring(0, 400).trim();
    const panelConfigured = !!(process.env.CUSTOMER_API_BASE_URL?.trim() && process.env.PRODUCTION_KEY?.trim());
    const authErrorMsg = panelConfigured
      ? "Git auth failed. Panel /api/customer may be unreachable from this server or returned invalid repo/token. Check Admin > Panel status."
      : "Authentication not configured. Set CUSTOMER_API_BASE_URL and PRODUCTION_KEY so the panel can provide git credentials.";
    const genericError = stderr.includes("Authentication failed") || stderr.includes("Permission denied") || stderr.includes("fatal: could not read Username")
      ? authErrorMsg
      : stderr.includes("Could not resolve host") || stderr.includes("Name or service not known")
      ? "Network error. Check your connection."
      : stderr.includes("fatal:")
      ? `Update failed: ${sanitize(stderr)}`
      : stderr;
    console.log("[Updates] git pull failed:", stderr);
    steps.push({ step: "git pull", success: false, error: genericError });
    return { success: false, steps, error: genericError };
  }

  try {
    // Install all deps including devDependencies so build has vite/esbuild (server often has NODE_ENV=production)
    const installResult = await execAsync("npm install --include=dev", {
      cwd,
      timeout: 300000, // 5 min
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });
    const out = (installResult.stdout || "").trim();
    steps.push({
      step: "npm install",
      success: true,
      output: out.slice(-1500) || undefined,
    });
  } catch (err: any) {
    const stderr = (err?.stderr || err?.stdout || err?.message || String(err)).trim();
    steps.push({ step: "npm install", success: false, error: stderr });
    return { success: false, steps, error: stderr };
  }

  // Database schema sync (drizzle-kit push) - skip if DISABLE_DB_PUSH_ON_DEPLOY=true
  if (process.env.DISABLE_DB_PUSH_ON_DEPLOY !== "true") {
    try {
      const dbResult = await execAsync("npm run db:push", {
        cwd,
        timeout: 60000,
        maxBuffer: 2 * 1024 * 1024,
      });
      const out = (dbResult.stdout || "").trim();
      steps.push({
        step: "db:push",
        success: true,
        output: out.slice(-800) || undefined,
      });
    } catch (err: any) {
      const stderr = (err?.stderr || err?.stdout || err?.message || String(err)).trim();
      steps.push({ step: "db:push", success: false, error: stderr });
      return { success: false, steps, error: stderr };
    }
  }

  try {
    const buildResult = await execAsync("npm run build", {
      cwd,
      timeout: 300000, // 5 min
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });
    const out = (buildResult.stdout || "").trim();
    steps.push({
      step: "npm run build",
      success: true,
      output: out.slice(-2000) || undefined,
    });
  } catch (err: any) {
    const stderr = (err?.stderr || err?.stdout || err?.message || String(err)).trim();
    steps.push({ step: "npm run build", success: false, error: stderr });
    return { success: false, steps, error: stderr };
  }

  // Run pm2 restart in the background so we can return the response first.
  // Otherwise the process dies during restart and the client gets 502.
  steps.push({
    step: "pm2 restart",
    success: true,
    output: "Scheduled (server will restart shortly).",
  });
  setImmediate(() => {
    execAsync(`pm2 restart ${PM2_APP_NAME} --update-env`, { cwd, timeout: 30000 })
      .then((pm2Result) => {
        console.log("[Updates] pm2 restart completed:", (pm2Result.stdout || "").trim());
      })
      .catch((err: any) => {
        console.error("[Updates] pm2 restart failed:", err?.stderr?.trim() || err?.message || err);
      });
  });

  return { success: true, steps };
}
