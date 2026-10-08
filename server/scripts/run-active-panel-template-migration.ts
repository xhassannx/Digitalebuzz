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
  const migrationPath = path.join(
    rootDir,
    "migrations",
    "add_active_panel_template_platform.sql",
  );

  const migrationSQL = fs.readFileSync(migrationPath, "utf-8");
  const statement = migrationSQL
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .trim();

  console.log("Running active_panel_template_id migration...");
  await sql(statement);
  console.log("Done.");
  process.exit(0);
}

runMigration().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
