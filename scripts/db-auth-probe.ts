/**
 * Full pg.Client auth probe (TLS already works in db-probe; this tests startup/SCRAM).
 * Usage: npx tsx --env-file=.env scripts/db-auth-probe.ts
 */
import { setDefaultResultOrder } from "node:dns";
import { lookup } from "node:dns/promises";
import { Client } from "pg";
import { getDatabaseUrl, parseDatabaseUrl } from "../db/pg-connection";

if (typeof setDefaultResultOrder === "function") {
  setDefaultResultOrder("ipv4first");
}

function attachDebug(client: Client) {
  const con = (client as unknown as { connection?: NodeJS.EventEmitter }).connection;
  if (!con) return;
  for (const ev of [
    "connect",
    "sslconnect",
    "authenticationCleartextPassword",
    "authenticationMD5Password",
    "authenticationSASL",
    "authenticationSASLContinue",
    "authenticationSASLFinal",
    "backendKeyData",
    "readyForQuery",
    "error",
    "end",
  ]) {
    con.on(ev, (...args: unknown[]) => {
      const extra = ev === "error" && args[0] instanceof Error ? args[0].message : "";
      console.log(`[auth-probe] event:${ev}${extra ? ` — ${extra}` : ""}`);
    });
  }
}

async function tryConnect(label: string, config: ConstructorParameters<typeof Client>[0]) {
  console.log(`\n[auth-probe] === ${label} ===`);
  const client = new Client({
    ...config,
    connectionTimeoutMillis: 60_000,
  });
  attachDebug(client);
  const started = Date.now();
  try {
    await client.connect();
    const r = await client.query("select current_user, now()");
    console.log(`[auth-probe] ${label}: OK in ${Date.now() - started}ms`, r.rows[0]);
    await client.end();
    return true;
  } catch (err) {
    console.error(
      `[auth-probe] ${label}: FAIL in ${Date.now() - started}ms —`,
      err instanceof Error ? err.message : err
    );
    try {
      await client.end();
    } catch {
      /* ignore */
    }
    return false;
  }
}

async function main() {
  const url = getDatabaseUrl().trim().replace(/^["']|["']$/g, "");
  const parsed = parseDatabaseUrl(url);
  const ip = (await lookup(parsed.host, { family: 4 })).address;

  console.log("[auth-probe] user=", parsed.user);
  console.log("[auth-probe] database=", parsed.database);
  console.log("[auth-probe] passwordLength=", parsed.password.length);
  console.log("[auth-probe] passwordContainsAt=", parsed.password.includes("@"));
  console.log("[auth-probe] host=", parsed.host, "→", ip);
  console.log("[auth-probe] node=", process.version, "pg=", requirePgVersion());

  const baseSsl = { rejectUnauthorized: false as const, servername: parsed.host };

  // 0) Direct SSL (PG17 / RDS — matches psql ALPN postgresql)
  await tryConnect("IP+SNI+sslnegotiation:direct", {
    host: ip,
    port: parsed.port,
    user: parsed.user,
    password: parsed.password,
    database: parsed.database,
    ssl: baseSsl,
    sslnegotiation: "direct",
  });

  // 1) IP + SNI traditional SSLRequest
  await tryConnect("IP+SNI+rejectUnauthorized:false", {
    host: ip,
    port: parsed.port,
    user: parsed.user,
    password: parsed.password,
    database: parsed.database,
    ssl: baseSsl,
  });

  // 2) Force TLS1.2
  await tryConnect("IP+SNI+TLSv1.2", {
    host: ip,
    port: parsed.port,
    user: parsed.user,
    password: parsed.password,
    database: parsed.database,
    ssl: { ...baseSsl, maxVersion: "TLSv1.2", minVersion: "TLSv1.2" },
  });

  // 3) Hostname (known slow/hang on this VPS)
  if (process.env.DB_PING_HOSTNAME === "1") {
    await tryConnect("hostname", {
      host: parsed.host,
      port: parsed.port,
      user: parsed.user,
      password: parsed.password,
      database: parsed.database,
      ssl: { rejectUnauthorized: false },
    });
  } else {
    console.log("\n[auth-probe] skip hostname test (DB_PING_HOSTNAME=1 to enable)");
  }

  // 4) No SSL — expect clear error if RDS requires SSL
  await tryConnect("IP no-ssl (expect fail)", {
    host: ip,
    port: parsed.port,
    user: parsed.user,
    password: parsed.password,
    database: parsed.database,
    ssl: false,
  });
}

function requirePgVersion(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("pg/package.json").version as string;
  } catch {
    return "unknown";
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
