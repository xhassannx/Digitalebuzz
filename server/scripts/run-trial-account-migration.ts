import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import * as fs from "fs";
import * as path from "path";

async function runMigration() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set in .env");
  }

  const sql = neon(process.env.DATABASE_URL);
  const rootDir = process.cwd().endsWith("server") ? path.join(process.cwd(), "..") : process.cwd();
  const migrationPath = path.join(rootDir, "migrations", "add_user_trial_account.sql");

  if (!fs.existsSync(migrationPath)) {
    throw new Error(`Migration file not found at: ${migrationPath}`);
  }

  const migrationSQL = fs.readFileSync(migrationPath, "utf-8");
  const statements = migrationSQL
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    await sql(statement);
    console.log("✅ Executed:", statement.slice(0, 60).replace(/\s+/g, " "), "...");
  }

  console.log("\nTrial account migration completed.");
  process.exit(0);
}

runMigration().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
