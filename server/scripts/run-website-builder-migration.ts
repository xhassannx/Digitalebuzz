import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import * as fs from "fs";
import * as path from "path";

async function runWebsiteBuilderMigration() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    console.log("Running website_builder_pages migration...");

    const rootDir = process.cwd().endsWith("server")
      ? path.join(process.cwd(), "..")
      : process.cwd();
    const migrationPath = path.join(
      rootDir,
      "migrations",
      "add_website_builder_pages.sql"
    );

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found at: ${migrationPath}`);
    }

    const migrationSQL = fs.readFileSync(migrationPath, "utf-8");

    // Split by semicolon; strip comment-only lines from each statement
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

    console.log(`Found ${statements.length} SQL statement(s)...`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ";";
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      try {
        await sql(statement);
        console.log(`  ✅ Statement ${i + 1} executed successfully`);
      } catch (error: any) {
        if (
          error.message &&
          (error.message.includes("already exists") ||
            error.message.includes("duplicate key"))
        ) {
          console.log(`  ⚠️  Statement ${i + 1} skipped (already exists)`);
        } else {
          throw error;
        }
      }
    }

    console.log("✅ Website builder migration completed successfully!");
    process.exit(0);
  } catch (error: any) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

runWebsiteBuilderMigration();
