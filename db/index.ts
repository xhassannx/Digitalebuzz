import { drizzle as neonDrizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { drizzle as pgDrizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../shared/schema';
import {
  describePgTarget,
  getDatabaseUrl,
  getPgPoolConfig,
  isNeonUrl,
} from './pg-connection';
import { isMongoEnabled } from './mongo';

let databaseUrl = '';
let isRds = false;

try {
  databaseUrl = getDatabaseUrl();
  isRds = /\.rds\.amazonaws\.com/i.test(databaseUrl);
} catch (err: any) {
  if (isMongoEnabled()) {
    console.log('[DB] Running in pure MongoDB mode (PostgreSQL DATABASE_URL not configured)');
  } else {
    throw err;
  }
}

function getPgPoolMax(): number {
  const raw = process.env.PG_POOL_MAX;
  if (raw !== undefined && String(raw).trim() !== '') {
    const n = parseInt(String(raw).trim(), 10);
    return Number.isFinite(n) ? Math.max(1, Math.min(50, n)) : 10;
  }
  // Cross-region RDS handshakes are slow (~30–45s); avoid opening many at once.
  return isRds ? 5 : 10;
}

function getPgPoolMin(): number {
  const raw = process.env.PG_POOL_MIN;
  if (raw !== undefined && String(raw).trim() !== '') {
    const n = parseInt(String(raw).trim(), 10);
    return Number.isFinite(n) ? Math.max(0, Math.min(10, n)) : 0;
  }
  return isRds ? 1 : 0;
}

function getPgIdleTimeoutMs(): number {
  const raw = process.env.PG_IDLE_TIMEOUT_MS;
  if (raw !== undefined && String(raw).trim() !== '') {
    const n = parseInt(String(raw).trim(), 10);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  // Keep RDS sockets warm — recreating them takes 26–45s on this path.
  return isRds ? 600_000 : 30_000;
}

let resolveDbReady!: () => void;
/** Resolves after the first successful pool query (or immediately for Neon/Mongo). */
export const dbReady = new Promise<void>((resolve) => {
  resolveDbReady = resolve;
});

/**
 * Await until DB warmup succeeds, or until timeoutMs (default 3 min).
 * Use before starting schedulers so they don't stampede a cold RDS pool.
 */
export async function waitForDb(timeoutMs = 180_000): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      dbReady,
      new Promise<void>((resolve) => {
        timer = setTimeout(() => {
          console.warn(
            `[DB] waitForDb timed out after ${timeoutMs}ms — continuing (queries may still be slow)`
          );
          resolve();
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function warmupPgPool(pool: Pool): Promise<void> {
  const attempts = 5;
  for (let i = 1; i <= attempts; i++) {
    const started = Date.now();
    try {
      await pool.query("select 1 as ok");
      console.log(`[DB] Startup ping OK in ${Date.now() - started}ms (attempt ${i})`);
      resolveDbReady();
      return;
    } catch (err) {
      console.error(
        `[DB] Startup ping FAILED attempt ${i}/${attempts} in ${Date.now() - started}ms:`,
        err instanceof Error ? err.message : err
      );
      if (i < attempts) {
        await new Promise((r) => setTimeout(r, 3_000));
      }
    }
  }
  console.error(
    "[DB] Startup ping gave up — background jobs will wait via waitForDb timeout"
  );
  // Still resolve so the process is not wedged forever if RDS is briefly down.
  resolveDbReady();
}

let pgPool: Pool | null = null;
let db: any;

if (!databaseUrl) {
  // Pure MongoDB mode proxy fallback
  db = new Proxy({}, {
    get: (_target, prop) => {
      if (prop === 'query' || prop === 'select' || prop === 'insert') {
        return () => {
          throw new Error(`[DB] PostgreSQL operation "${String(prop)}" called while running in pure MongoDB mode`);
        };
      }
      return undefined;
    }
  });
  resolveDbReady();
} else if (isNeonUrl(databaseUrl)) {
  console.log(`[DB] Using Neon HTTP driver → ${describePgTarget(databaseUrl)}`);
  db = neonDrizzle(neon(databaseUrl), { schema });
  resolveDbReady();
} else {
  const poolConfig = getPgPoolConfig(databaseUrl, {
    max: getPgPoolMax(),
    min: getPgPoolMin(),
    idleTimeoutMillis: getPgIdleTimeoutMs(),
  });
  console.log(`[DB] Using node-postgres → ${describePgTarget(databaseUrl)}`);
  console.log(
    `[DB] pool max=${poolConfig.max} min=${poolConfig.min} idleTimeoutMs=${poolConfig.idleTimeoutMillis} connectTimeoutMs=${poolConfig.connectionTimeoutMillis}`
  );
  pgPool = new Pool(poolConfig);
  db = pgDrizzle(pgPool, { schema });
  void warmupPgPool(pgPool);
}

export { db };

export {
  describePgTarget,
  getDatabaseUrl,
  getPgPoolConfig,
  getPgSslOption,
  isNeonUrl,
  parseDatabaseUrl,
  stripSslParamsFromDatabaseUrl,
} from './pg-connection';
