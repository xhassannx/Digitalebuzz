import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import * as fs from "fs";
import * as path from "path";

async function runMigration() {
  const sql = neon(process.env.DATABASE_URL!);
  
  const rootDir = process.cwd().endsWith('server') 
    ? path.join(process.cwd(), '..') 
    : process.cwd();
  const migrationPath = path.join(rootDir, 'migrations', 'add_theme_mode_accent_color.sql');
  
  if (!fs.existsSync(migrationPath)) {
    throw new Error(`Migration file not found at: ${migrationPath}`);
  }
  
  const migrationSQL = fs.readFileSync(migrationPath, "utf-8");

  // Split by semicolons and filter out empty statements
  // Remove comments first
  const cleanedSQL = migrationSQL
    .split('\n')
    .map(line => line.includes('--') ? line.substring(0, line.indexOf('--')) : line)
    .join('\n');
  
  const statements = cleanedSQL
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length > 10); // Filter out very short strings that are just whitespace

  console.log(`Found ${statements.length} SQL statement(s)...`);

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (statement.trim()) {
      console.log(`\nExecuting statement ${i + 1}/${statements.length}...`);
      try {
        await sql(statement);
        console.log(`  ✅ Statement ${i + 1} executed successfully`);
      } catch (error: any) {
        // Ignore "column already exists" errors
        if (error.message?.includes("already exists") || error.code === "42701" || error.code === "42P16") {
          console.log(`  ⚠️  Statement ${i + 1} skipped (already exists)`);
          continue;
        }
        console.error(`  ✗ Error executing statement ${i + 1}:`, error.message);
        throw error;
      }
    }
  }

  console.log("\nMigration completed successfully!");
  process.exit(0);
}

runMigration().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});

