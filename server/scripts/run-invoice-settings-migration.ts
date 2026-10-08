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
  console.log(`\nRunning ${relativePath} (${statements.length} statement(s))...`);
  await executeSqlStatements(statements);
  console.log(`  ✓ ${relativePath} applied`);
}

async function runMigration() {
  await runMigrationFile("create_organization_invoice_settings.sql");
  await runMigrationFile("add_invoice_signature_size.sql");
  await runMigrationFile("add_invoice_email_id.sql");
  await runMigrationFile("add_invoice_business_name.sql");
  await runMigrationFile("add_invoice_company_details.sql");
  await runMigrationFile("create_organization_invoices.sql");
  console.log("\nInvoice settings migrations completed.");
}

runMigration().catch((err) => {
  console.error(err);
  process.exit(1);
});
