import "dotenv/config";
import { createHash } from "crypto";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { runMigrationStatements, splitSqlStatements } from "./migration-sql-client";

export function projectRoot(): string {
  return process.cwd().endsWith("server") ? join(process.cwd(), "..") : process.cwd();
}

const MIGRATIONS_TABLE = "_helicoptic_sql_migrations";

const SKIP_ERROR_CODES = new Set([
  "42701", // duplicate_column
  "42710", // duplicate_object
  "42P07", // duplicate_table
  "42P16", // invalid_table_definition (column already exists variants)
  "23505", // unique_violation on create index sometimes
]);

function shouldSkipStatementError(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  if (e.code && SKIP_ERROR_CODES.has(e.code)) return true;
  const msg = (e.message || "").toLowerCase();
  return (
    msg.includes("already exists") ||
    msg.includes("duplicate column") ||
    msg.includes("duplicate key")
  );
}

async function ensureMigrationsTable(): Promise<void> {
  // Prefer a fixed sequence name (not SERIAL) so Postgres does not create
  // `_helicoptic_sql_migrations_id_seq1` when the base name already exists —
  // drizzle-kit then tries to DROP that sequence and fails (2BP01).
  // Existing DBs that already use `_id_seq1` are left alone (IF NOT EXISTS).
  const seq = `${MIGRATIONS_TABLE}_id_seq`;
  await runMigrationStatements([
    `CREATE SEQUENCE IF NOT EXISTS ${seq} AS integer INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1 NO CYCLE`,
    `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id INTEGER PRIMARY KEY DEFAULT nextval('${seq}'),
      filename VARCHAR(512) NOT NULL UNIQUE,
      checksum VARCHAR(64) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
  ]);
}

async function isMigrationApplied(filename: string): Promise<boolean> {
  const pool = await getQueryPool();
  try {
    const res = await pool.query(
      `SELECT 1 FROM ${MIGRATIONS_TABLE} WHERE filename = $1 LIMIT 1`,
      [filename]
    );
    return (res.rowCount ?? 0) > 0;
  } finally {
    await pool.end();
  }
}

async function recordMigration(filename: string, checksum: string): Promise<void> {
  const pool = await getQueryPool();
  try {
    await pool.query(
      `INSERT INTO ${MIGRATIONS_TABLE} (filename, checksum) VALUES ($1, $2)
       ON CONFLICT (filename) DO NOTHING`,
      [filename, checksum]
    );
  } finally {
    await pool.end();
  }
}

async function getQueryPool() {
  const { Pool } = await import("pg");
  const { getDatabaseUrl, getPgPoolConfig } = await import("./migration-sql-client-url");
  return new Pool(getPgPoolConfig(getDatabaseUrl()));
}

function fileChecksum(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export async function applySqlMigrationFile(
  relativePath: string,
  label?: string
): Promise<"applied" | "skipped"> {
  const filename = relativePath.replace(/\\/g, "/");
  const migrationPath = join(projectRoot(), "migrations", filename);
  if (!existsSync(migrationPath)) {
    throw new Error(`Migration file not found: ${migrationPath}`);
  }

  const content = readFileSync(migrationPath, "utf8");
  const checksum = fileChecksum(content);
  const display = label || filename;

  await ensureMigrationsTable();
  if (await isMigrationApplied(filename)) {
    console.log(`⏭  ${display} (already recorded)`);
    return "skipped";
  }

  const statements = splitSqlStatements(content);
  console.log(`▶  ${display} (${statements.length} statement(s))`);

  for (let i = 0; i < statements.length; i++) {
    try {
      await runMigrationStatements([statements[i]]);
      console.log(`   ✓ ${i + 1}/${statements.length}`);
    } catch (err) {
      if (shouldSkipStatementError(err)) {
        console.log(`   ~ ${i + 1}/${statements.length} (already applied)`);
        continue;
      }
      throw err;
    }
  }

  await recordMigration(filename, checksum);
  console.log(`✅ ${display}`);
  return "applied";
}
