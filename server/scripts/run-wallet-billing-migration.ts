import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import * as fs from "fs";
import * as path from "path";

async function runSqlFile(sql: ReturnType<typeof neon>, fileName: string) {
  const rootDir = process.cwd().endsWith("server") ? path.join(process.cwd(), "..") : process.cwd();
  const migrationPath = path.join(rootDir, "migrations", fileName);

  if (!fs.existsSync(migrationPath)) {
    throw new Error("Migration file not found at: " + migrationPath);
  }

  console.log("\n=== " + fileName + " ===");
  const migrationSQL = fs.readFileSync(migrationPath, "utf-8");

  const statements = migrationSQL
    .split(";")
    .map((s) =>
      s
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim()
    )
    .filter((s) => s.length > 0);

  console.log("Found " + statements.length + " SQL statement(s)...");

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (!statement.trim()) continue;
    console.log("Executing statement " + (i + 1) + "/" + statements.length + "...");
    try {
      await sql(statement);
      console.log("  OK");
    } catch (error: any) {
      const msg = error?.message || String(error);
      if (
        msg.includes("already exists") ||
        msg.includes("duplicate") ||
        msg.includes("42701")
      ) {
        console.log("  Skipped (already applied)");
      } else {
        throw error;
      }
    }
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set in .env");
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    console.log("Running wallet billing migrations...");
    await runSqlFile(sql, "create_org_wallet_billing.sql");
    await runSqlFile(sql, "wallet_billing_advanced.sql");
    await runSqlFile(sql, "wallet_rate_version_markup.sql");
    await runSqlFile(sql, "credit_line_billing.sql");
    await runSqlFile(sql, "wallet_debit_subscription.sql");
    console.log("\nWallet billing migrations completed.");
    process.exit(0);
  } catch (error: any) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

main();
