import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { executeSqlStatements, splitSqlStatements } from "./sql-migration-client";

async function runMigration() {
  const rootDir = process.cwd().endsWith("server")
    ? path.join(process.cwd(), "..")
    : process.cwd();
  const migrationPath = path.join(
    rootDir,
    "migrations",
    "add_wa_pay_catalog_checkout_columns.sql",
  );

  if (!fs.existsSync(migrationPath)) {
    throw new Error(`Migration file not found at: ${migrationPath}`);
  }

  const migrationSQL = fs.readFileSync(migrationPath, "utf-8");
  const statements = splitSqlStatements(migrationSQL);

  console.log(`Running WA Pay migration (${statements.length} statement(s))...`);

  for (let i = 0; i < statements.length; i++) {
    console.log(`\nExecuting statement ${i + 1}/${statements.length}...`);
    await executeSqlStatements([statements[i]]);
    console.log(`  Statement ${i + 1} executed successfully`);
  }

  console.log("\nWA Pay migration completed.");
}

runMigration().catch((err) => {
  console.error(err);
  process.exit(1);
});
