import "dotenv/config";
import { spawnSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { applySqlMigrationFile, projectRoot } from "./migration-runner";
import { ensureSystemFreePlan } from "../utils/system-free-plan";

type SyncOptions = {
  skipPush: boolean;
  skipSql: boolean;
};

function parseArgs(): SyncOptions {
  const args = process.argv.slice(2);
  return {
    skipPush: args.includes("--skip-push"),
    skipSql: args.includes("--skip-sql"),
  };
}

function databaseHostHint(): string {
  const raw = process.env.DATABASE_URL?.trim();
  if (raw) {
    try {
      const u = new URL(raw);
      return `${u.hostname}:${u.port || "5432"}`;
    } catch {
      return "(DATABASE_URL set, unparseable)";
    }
  }
  if (process.env.PGHOST) {
    return `${process.env.PGHOST}:${process.env.PGPORT || "5432"}`;
  }
  return "(missing)";
}

function formatSyncError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const parts = [err.message].filter(Boolean);
  const anyErr = err as Error & { code?: string; errors?: unknown[] };
  if (anyErr.code) parts.push(`code=${anyErr.code}`);
  if (Array.isArray(anyErr.errors) && anyErr.errors.length > 0) {
    for (const nested of anyErr.errors) {
      if (nested instanceof Error && nested.message) parts.push(nested.message);
      else if (nested) parts.push(String(nested));
    }
  }
  if (parts.length === 0) parts.push(String(err));
  return parts.join(" | ");
}

function runDrizzlePush(): void {
  console.log("\n━━━ Step 1/2: Drizzle schema push (shared/schema.ts → database) ━━━");
  console.log(
    "⚠️  Running with --force (non-interactive). Tables in the DB but missing from schema.ts may be dropped.\n" +
      "    Use: npm run db:sync -- --skip-push   (SQL migrations only, no Drizzle push)\n"
  );
  // Single command string: with shell:true, args after -c become $0/$1 and are NOT passed to npx.
  const result = spawnSync("npx drizzle-kit push --force", {
    stdio: "inherit",
    shell: true,
    cwd: projectRoot(),
    env: process.env,
  });
  if (result.error) {
    throw new Error(`drizzle-kit push failed to start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `drizzle-kit push failed (exit ${result.status}). ` +
        `Check Postgres is reachable at ${databaseHostHint()} (ECONNREFUSED = wrong host or Postgres not running).`
    );
  }
  console.log("\n✅ Drizzle push completed\n");
}

async function runSqlManifest(): Promise<void> {
  console.log("━━━ Step 2/2: SQL migrations (migrations/sync-manifest.json) ━━━\n");
  const manifestPath = join(projectRoot(), "migrations", "sync-manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`Missing ${manifestPath}`);
  }
  const files = JSON.parse(readFileSync(manifestPath, "utf8")) as string[];
  if (!Array.isArray(files)) {
    throw new Error("sync-manifest.json must be a JSON array of filenames");
  }

  let applied = 0;
  let skipped = 0;
  for (const file of files) {
    const result = await applySqlMigrationFile(file);
    if (result === "applied") applied++;
    else skipped++;
  }

  console.log(`\n✅ SQL migrations done (${applied} new, ${skipped} already recorded)\n`);
}

async function main(): Promise<void> {
  const opts = parseArgs();
  console.log("🔄 Database sync starting...");
  console.log(
    `   DATABASE_URL: ${process.env.DATABASE_URL ? "(set)" : process.env.PGHOST || "(missing)"}`
  );
  console.log(`   DB host: ${databaseHostHint()}`);

  if (!opts.skipPush) {
    runDrizzlePush();
  } else {
    console.log("⏭  Skipping drizzle push (--skip-push)\n");
  }

  if (!opts.skipSql) {
    await runSqlManifest();
  } else {
    console.log("⏭  Skipping SQL migrations (--skip-sql)\n");
  }

  // Schema sync does not seed rows — ensure locked Free plan exists on every DB
  console.log("━━━ Seed: system Free plan (ensureSystemFreePlan) ━━━\n");
  try {
    const plan = await ensureSystemFreePlan();
    console.log(`✅ System Free plan ready: ${plan.id} (${plan.name})\n`);
  } catch (err) {
    console.error(
      "⚠️  Failed to ensure system Free plan (run: npm run db:migrate-system-free-plan):",
      formatSyncError(err)
    );
  }

  console.log("🎉 Database sync finished.");
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Database sync failed:", formatSyncError(err));
  console.error(
    `   Tip: verify DB host ${databaseHostHint()} — ECONNREFUSED means Postgres is not listening there.`
  );
  process.exit(1);
});
