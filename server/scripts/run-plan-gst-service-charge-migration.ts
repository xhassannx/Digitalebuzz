import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import * as fs from "fs";
import * as path from "path";

async function runMigration() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set in .env");
  }

  const sql = neon(process.env.DATABASE_URL);
  const rootDir = process.cwd().endsWith("server")
    ? path.join(process.cwd(), "..")
    : process.cwd();
  const migrationPath = path.join(rootDir, "migrations", "add_plan_gst_service_charge.sql");

  if (!fs.existsSync(migrationPath)) {
    throw new Error(`Migration file not found at: ${migrationPath}`);
  }

  const migrationSQL = fs.readFileSync(migrationPath, "utf-8");
  const cleanedSQL = migrationSQL
    .split("\n")
    .map((line) => (line.includes("--") ? line.substring(0, line.indexOf("--")) : line))
    .join("\n");

  const statements = cleanedSQL
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  console.log(`Running plan GST/service charge migration (${statements.length} statement(s))...`);

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    console.log(`\nExecuting statement ${i + 1}/${statements.length}...`);
    await sql(statement);
    console.log(`  Statement ${i + 1} executed successfully`);
  }

  console.log("\nPlan GST/service charge migration completed.");
}

runMigration().catch((err) => {
  console.error(err);
  process.exit(1);
});
