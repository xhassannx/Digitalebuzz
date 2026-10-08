import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import * as fs from "fs";
import * as path from "path";

async function runContactNotesRemindersMigration() {
  const sql = neon(process.env.DATABASE_URL!);

  try {
    console.log("Running contact notes and reminders migration...");

    const rootDir = process.cwd().endsWith("server") ? path.join(process.cwd(), "..") : process.cwd();
    const migrationPath = path.join(rootDir, "migrations", "create_contact_notes_reminders.sql");

    if (!fs.existsSync(migrationPath)) {
      throw new Error("Migration file not found at: " + migrationPath);
    }

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
      if (statement.trim()) {
        console.log("Executing statement " + (i + 1) + "/" + statements.length + "...");
        try {
          await sql(statement);
          console.log("  Statement " + (i + 1) + " executed successfully");
        } catch (error: any) {
          if (error.message && error.message.includes("already exists")) {
            console.log("  Statement " + (i + 1) + " skipped (already exists)");
          } else {
            throw error;
          }
        }
      }
    }

    console.log("Contact notes and reminders migration completed successfully!");
    process.exit(0);
  } catch (error: any) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

runContactNotesRemindersMigration();
