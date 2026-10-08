/**
 * Shared Postgres connection helpers for white-label installs.
 * Supports Neon, Supabase, AWS RDS, Azure, DigitalOcean, Railway, Render,
 * and self-hosted Postgres (with or without SSL / self-signed certs).
 *
 * On some VPS hosts, `pg` connecting by RDS hostname hangs even though raw
 * TCP+TLS to the A-record IP works (scripts/db-probe.ts). Connect via IPv4
 * and set ssl.servername to the hostname for SNI.
 *
 * Note: some Node builds (and ESM default imports) have no dns.lookupSync —
 * resolveIpv4Sync() feature-detects and falls back to getent/dig/node -e.
 */

import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { isIP } from "node:net";
import type { PoolConfig } from "pg";

const requireDns = createRequire(import.meta.url);
const dnsCjs = requireDns("node:dns") as typeof import("node:dns") & {
  lookupSync?: (
    hostname: string,
    options: number | { family?: number }
  ) => { address: string; family: number };
};

if (typeof dnsCjs.setDefaultResultOrder === "function") {
  const order = (process.env.PG_DNS_RESULT_ORDER || "ipv4first").trim().toLowerCase();
  if (order === "ipv4first" || order === "verbatim") {
    dnsCjs.setDefaultResultOrder(order);
  }
}

export function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL?.trim()) {
    return process.env.DATABASE_URL.trim().replace(/^["']|["']$/g, "");
  }
  const host = process.env.PGHOST;
  const port = process.env.PGPORT || "5432";
  const user = process.env.PGUSER;
  const password = process.env.PGPASSWORD;
  const database = process.env.PGDATABASE;
  if (host && user && password != null && database) {
    const encodedPassword = encodeURIComponent(password);
    return `postgresql://${user}:${encodedPassword}@${host}:${port}/${database}`;
  }
  throw new Error(
    "Database config required: set DATABASE_URL, or set PGHOST, PGUSER, PGPASSWORD, and PGDATABASE (PGPORT optional, default 5432)"
  );
}

/** Neon HTTP / serverless driver only — other hosts use node-postgres. */
export function isNeonUrl(url: string): boolean {
  return /neon\.tech/i.test(url);
}

function isManagedCloudPostgresHost(url: string): boolean {
  return (
    /\.rds\.amazonaws\.com/i.test(url) ||
    /\.supabase\.(co|com)/i.test(url) ||
    /pooler\.supabase/i.test(url) ||
    /\.neon\.tech/i.test(url) ||
    /\.azure\.com/i.test(url) ||
    /\.postgres\.database\.azure\.com/i.test(url) ||
    /\.db\.ondigitalocean\.com/i.test(url) ||
    /\.railway\.app/i.test(url) ||
    /\.render\.com/i.test(url) ||
    /\.aivencloud\.com/i.test(url) ||
    /\.elephantsql\.com/i.test(url) ||
    /\.timescaledb\.io/i.test(url) ||
    /\.cockroachlabs\.cloud/i.test(url)
  );
}

function parseRejectUnauthorizedEnv(): boolean | undefined {
  const raw = process.env.PGSSL_REJECT_UNAUTHORIZED?.trim().toLowerCase();
  if (raw === "true" || raw === "1" || raw === "yes") return true;
  if (raw === "false" || raw === "0" || raw === "no") return false;
  return undefined;
}

export function stripSslParamsFromDatabaseUrl(url: string): string {
  const q = url.indexOf("?");
  if (q < 0) return url;
  const base = url.slice(0, q);
  const kept = url
    .slice(q + 1)
    .split("&")
    .filter(Boolean)
    .filter((part) => {
      const key = part.split("=")[0]?.toLowerCase() ?? "";
      return key !== "ssl" && !key.startsWith("ssl");
    });
  return kept.length ? `${base}?${kept.join("&")}` : base;
}

export function parseDatabaseUrl(url: string): {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
} {
  const normalized = url.trim().replace(/^["']|["']$/g, "");
  const withProto = normalized.replace(/^postgres(ql)?:/i, "http:");
  let u: URL;
  try {
    u = new URL(withProto);
  } catch {
    throw new Error("Invalid DATABASE_URL");
  }
  const database = decodeURIComponent(
    (u.pathname.replace(/^\//, "").split("/")[0] || "").split("?")[0] || ""
  );
  if (!u.hostname || !database) {
    throw new Error("Invalid DATABASE_URL: missing host or database name");
  }
  return {
    host: decodeURIComponent(u.hostname),
    port: Number(u.port || 5432) || 5432,
    user: decodeURIComponent(u.username || ""),
    password: decodeURIComponent(u.password || ""),
    database,
  };
}

export type PgSslOption = false | { rejectUnauthorized: boolean; servername?: string };

export function getPgSslOption(url: string): PgSslOption | undefined {
  const envSsl = (process.env.DATABASE_SSL || process.env.PGSSL || "")
    .trim()
    .toLowerCase();
  if (envSsl === "disable" || envSsl === "false" || envSsl === "off") {
    return false;
  }

  const rejectFromEnv = parseRejectUnauthorizedEnv();
  const sslMode = url.match(/[?&]sslmode=([^&]+)/i)?.[1]?.toLowerCase();
  const sslTrue = /[?&]ssl=true/i.test(url);

  if (sslMode === "disable") return false;

  if (envSsl === "verify" || envSsl === "verify-full" || envSsl === "verify-ca") {
    return { rejectUnauthorized: rejectFromEnv ?? true };
  }
  if (envSsl === "require" || envSsl === "true" || envSsl === "on" || envSsl === "no-verify") {
    return { rejectUnauthorized: rejectFromEnv ?? false };
  }

  if (sslMode === "verify-ca" || sslMode === "verify-full") {
    return { rejectUnauthorized: rejectFromEnv ?? true };
  }

  if (sslMode === "no-verify") {
    return { rejectUnauthorized: rejectFromEnv ?? false };
  }

  const wantsSsl =
    sslMode === "require" ||
    sslMode === "prefer" ||
    sslMode === "allow" ||
    sslMode === "true" ||
    sslTrue ||
    isManagedCloudPostgresHost(url);

  if (!wantsSsl) {
    return undefined;
  }

  return { rejectUnauthorized: rejectFromEnv ?? false };
}

function defaultConnectionTimeoutMs(url: string): number {
  const raw = process.env.PG_CONNECTION_TIMEOUT_MS?.trim();
  if (raw) {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 1_000) return Math.min(n, 120_000);
  }
  // Cross-region RDS: SSL handshake alone can take 20–45s; keep timeout generous.
  return isManagedCloudPostgresHost(url) ? 120_000 : 15_000;
}

/**
 * Postgres 17+ / RDS: prefer direct TLS (ALPN postgresql), same as modern psql.
 * Traditional SSLRequest can hang on some VPS↔RDS paths even when raw TCP works.
 */
function getSslNegotiation(url: string): "direct" | "postgres" | undefined {
  const fromEnv = (process.env.PGSSLNEGOTIATION || "").trim().toLowerCase();
  if (fromEnv === "direct" || fromEnv === "postgres") return fromEnv;
  const fromUrl = url.match(/[?&]sslnegotiation=([^&]+)/i)?.[1]?.toLowerCase();
  if (fromUrl === "direct" || fromUrl === "postgres") return fromUrl;
  if (/\.rds\.amazonaws\.com/i.test(url)) return "direct";
  return undefined;
}

/** Resolve A record even when dns.lookupSync is missing from the Node build. */
export function resolveIpv4Sync(hostname: string): string {
  if (isIP(hostname)) return hostname;

  if (typeof dnsCjs.lookupSync === "function") {
    return dnsCjs.lookupSync(hostname, { family: 4 }).address;
  }

  try {
    const out = execFileSync("getent", ["ahostsv4", hostname], {
      encoding: "utf8",
      timeout: 8_000,
    });
    const ip = out.trim().split(/\s+/)[0];
    if (ip && isIP(ip)) return ip;
  } catch {
    /* ignore */
  }

  try {
    const out = execFileSync("dig", ["+short", "A", hostname], {
      encoding: "utf8",
      timeout: 8_000,
    });
    const ip = out.trim().split(/\n/).map((l) => l.trim()).find((l) => isIP(l));
    if (ip) return ip;
  } catch {
    /* ignore */
  }

  // Last resort: child Node process using dns.promises (always available).
  const out = execFileSync(
    process.execPath,
    [
      "-e",
      `require("dns").promises.lookup(${JSON.stringify(hostname)},{family:4}).then(r=>process.stdout.write(r.address),e=>{console.error(e);process.exit(1)})`,
    ],
    { encoding: "utf8", timeout: 12_000 }
  );
  const ip = out.trim();
  if (!ip || !isIP(ip)) {
    throw new Error(`Could not resolve IPv4 for ${hostname}`);
  }
  return ip;
}

export async function resolvePgIpv4(hostname: string): Promise<string> {
  if (isIP(hostname)) return hostname;
  const r = await dnsCjs.promises.lookup(hostname, { family: 4 });
  return r.address;
}

/**
 * Prefer connecting to resolved IPv4 with TLS servername = original hostname.
 * Set PG_CONNECT_BY_HOSTNAME=true to disable.
 */
export function getPgPoolConfig(
  url: string,
  extras: PoolConfig = {}
): PoolConfig {
  const parsed = parseDatabaseUrl(url);
  let ssl = getPgSslOption(url);
  let host = parsed.host;

  const forceHostname = (process.env.PG_CONNECT_BY_HOSTNAME || "")
    .trim()
    .toLowerCase();
  const useIp =
    forceHostname !== "true" &&
    forceHostname !== "1" &&
    forceHostname !== "yes" &&
    !isIP(parsed.host);

  if (useIp) {
    try {
      host = resolveIpv4Sync(parsed.host);
      if (ssl && typeof ssl === "object") {
        ssl = { ...ssl, servername: parsed.host };
      }
      if (process.env.DB_LOG_DNS !== "false") {
        console.log(`[DB] Connect via IPv4 ${host} (SNI ${parsed.host})`);
      }
    } catch (err) {
      console.warn(
        `[DB] IPv4 resolve failed for ${parsed.host}, using hostname:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  const sslNegotiation = getSslNegotiation(url);
  if (sslNegotiation && process.env.DB_LOG_DNS !== "false") {
    console.log(`[DB] sslnegotiation=${sslNegotiation}`);
  }

  return {
    host,
    port: parsed.port,
    user: parsed.user,
    password: parsed.password,
    database: parsed.database,
    ...(ssl !== undefined ? { ssl } : {}),
    ...(sslNegotiation ? { sslnegotiation: sslNegotiation } : {}),
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    connectionTimeoutMillis: defaultConnectionTimeoutMs(url),
    ...extras,
  };
}

export function describePgTarget(url: string): string {
  try {
    const p = parseDatabaseUrl(url);
    const ssl = getPgSslOption(url);
    const sslLabel =
      ssl === false
        ? "off"
        : ssl
          ? `on (rejectUnauthorized=${ssl.rejectUnauthorized})`
          : "default";
    return `${p.user}@${p.host}:${p.port}/${p.database} ssl=${sslLabel}`;
  } catch {
    return "(invalid DATABASE_URL)";
  }
}
