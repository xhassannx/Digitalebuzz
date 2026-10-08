import "dotenv/config";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { executeSqlStatements, splitSqlStatements } from "./sql-migration-client";

function projectRoot(): string {
  return process.cwd().endsWith("server") ? join(process.cwd(), "..") : process.cwd();
}

async function runMigrationFile(relativePath: string): Promise<void> {
  const migrationPath = join(projectRoot(), "migrations", relativePath);
  if (!existsSync(migrationPath)) {
    console.warn(`Skipping missing migration: ${relativePath}`);
    return;
  }
  const statements = splitSqlStatements(readFileSync(migrationPath, "utf8"));
  console.log(`Running ${relativePath} (${statements.length} statement(s))...`);
  await executeSqlStatements(statements);
  console.log(`  ✓ ${relativePath} applied`);
}

async function runMigration() {
  await runMigrationFile("create_organization_leads.sql");
  await runMigrationFile("create_organization_lead_statuses.sql");
  await runMigrationFile("add_organization_leads_form_fields.sql");
  await runMigrationFile("add_organization_leads_sort_order.sql");
  await runMigrationFile("reorder_leads_sort_newest_first.sql");
  console.log("\n✅ Leads migrations completed.");
}

runMigration().catch((err) => {
  console.error(err);
  process.exit(1);
});
