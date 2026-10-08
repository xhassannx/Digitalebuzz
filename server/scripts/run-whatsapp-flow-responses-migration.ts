import * as fs from "fs";
import * as path from "path";
import { runMigrationStatements, splitSqlStatements } from "./migration-sql-client";

async function runMigration() {
  const rootDir = process.cwd().endsWith("server")
    ? path.join(process.cwd(), "..")
    : process.cwd();
  const migrationPath = path.join(rootDir, "migrations", "create_whatsapp_flow_responses.sql");

  if (!fs.existsSync(migrationPath)) {
    throw new Error(`Migration file not found at: ${migrationPath}`);
  }

  const statements = splitSqlStatements(fs.readFileSync(migrationPath, "utf-8"));
  console.log(`Running whatsapp_flow_responses migration (${statements.length} statement(s))...`);
  await runMigrationStatements(statements);
  console.log("Migration completed successfully.");
}

runMigration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
