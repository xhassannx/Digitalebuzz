/**
 * Diagnose Postgres connectivity (same config as the app).
 * Usage: npx tsx --env-file=.env scripts/db-ping.ts
 */
import { setDefaultResultOrder } from "node:dns";
import { lookup } from "node:dns/promises";
import { Pool } from "pg";
import {
  describePgTarget,
  getDatabaseUrl,
  getPgPoolConfig,
  isNeonUrl,
  parseDatabaseUrl,
  stripSslParamsFromDatabaseUrl,
} from "../db/pg-connection";

if (typeof setDefaultResultOrder === "function") {
  setDefaultResultOrder("ipv4first");
}

function stripQuotes(s: string): string {
  return s.trim().replace(/^["']|["']$/g, "");
}

async function resolveHost(host: string): Promise<void> {
  try {
    const v4 = await lookup(host, { family: 4, all: true });
    console.log(
      "[db-ping] A (IPv4):",
      v4.map((r) => r.address).join(", ") || "(none)"
    );
  } catch (e) {
    console.log("[db-ping] A (IPv4): FAIL", e instanceof Error ? e.message : e);
  }
  try {
    const v6 = await lookup(host, { family: 6, all: true });
    console.log(
      "[db-ping] AAAA (IPv6):",
      v6.map((r) => r.address).join(", ") || "(none)"
    );
  } catch {
    console.log("[db-ping] AAAA (IPv6): (none)");
  }
}

async function tryPool(label: string, config: ConstructorParameters<typeof Pool>[0]) {
  const pool = new Pool({ ...config, max: 1, connectionTimeoutMillis: 45_000 });
  const started = Date.now();
  try {
    const r = await pool.query("select 1 as ok");
    console.log(`[db-ping] ${label}: OK in ${Date.now() - started}ms`, r.rows[0]);
    return true;
  } catch (err) {
    console.error(
      `[db-ping] ${label}: FAIL in ${Date.now() - started}ms —`,
      err instanceof Error ? err.message : err
    );
    return false;
  } finally {
    await pool.end().catch(() => {});
  }
}

async function main() {
  const url = stripQuotes(getDatabaseUrl());
  console.log("[db-ping]", describePgTarget(url));

  const hostMatch = url.match(/@([^/:?]+)/);
  const host = hostMatch?.[1];
  if (host) await resolveHost(host);

  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 5000);
    const res = await fetch("https://api.ipify.org?format=text", { signal: ac.signal });
    clearTimeout(t);
    console.log(`[db-ping] This server's public IPv4: ${(await res.text()).trim()}`);
  } catch (e) {
    console.log(
      "[db-ping] Could not detect public IP:",
      e instanceof Error ? e.message : e
    );
  }

  if (isNeonUrl(url)) {
    console.log("[db-ping] Neon URL — skipping pg Pool tests.");
    return;
  }

  const cleaned = stripSslParamsFromDatabaseUrl(url);

  // Skip slow hostname test by default — it hangs on this VPS. Set DB_PING_HOSTNAME=1 to include.
  let aOk = false;
  if (process.env.DB_PING_HOSTNAME === "1") {
    aOk = await tryPool("one-liner style (hostname)", {
      connectionString: cleaned,
      ssl: { rejectUnauthorized: false },
    });
  } else {
    console.log("[db-ping] Skipping hostname one-liner (set DB_PING_HOSTNAME=1 to run)");
  }

  const bOk = await tryPool("getPgPoolConfig (app)", getPgPoolConfig(url));

  let cOk = false;
  if (host) {
    const ip = (await lookup(host, { family: 4 })).address;
    const parsed = parseDatabaseUrl(url);
    console.log(`[db-ping] Trying explicit IPv4 ${ip} + direct SSL (PG17)`);
    cOk = await tryPool("explicit IPv4+SNI+direct", {
      host: ip,
      port: parsed.port,
      user: parsed.user,
      password: parsed.password,
      database: parsed.database,
      ssl: { rejectUnauthorized: false, servername: host },
      sslnegotiation: "direct",
    });
  }

  if (bOk || cOk) {
    console.log("[db-ping] SUCCESS — rebuild app: npm run build:server && pm2 restart");
    process.exit(0);
  }

  if (aOk && !bOk) {
    console.error("[db-ping] hostname works but app config failed — unexpected.");
    process.exit(1);
  }

  console.error("[db-ping] All pg connects failed. Re-run: npm run db:probe");
  process.exit(1);
}

main().catch((err) => {
  console.error("[db-ping] FAIL", err instanceof Error ? err.message : err);
  process.exit(1);
});
