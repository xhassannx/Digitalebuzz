import "dotenv/config";
import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

async function runCampaignMigration() {
  const sql = neon(process.env.DATABASE_URL!);
  
  try {
    console.log("Running campaign template fields migration...");
    
    // Read the migration file - handle both root and server directory execution
    const rootDir = process.cwd().endsWith('server') 
      ? path.join(process.cwd(), '..') 
      : process.cwd();
    const migrationPath = path.join(rootDir, 'migrations', 'add_campaign_template_fields.sql');
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found at: ${migrationPath}`);
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    // Split by semicolons and execute each statement separately
    // Remove comments and empty lines
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`Executing ${statements.length} SQL statement(s)...`);
    
    // Execute each statement separately
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`Executing statement ${i + 1}/${statements.length}...`);
        try {
          await sql(statement);
        } catch (error: any) {
          // Ignore "already exists" errors for IF NOT EXISTS statements
          if (error.message && error.message.includes('already exists')) {
            console.log(`  ⚠️  Statement ${i + 1} skipped (already exists)`);
          } else {
            throw error;
          }
        }
      }
    }
    
    console.log("✅ Campaign migration completed successfully!");
    process.exit(0);
  } catch (error: any) {
    console.error("❌ Migration failed:", error.message);
    console.error("Full error:", error);
    process.exit(1);
  }
}

runCampaignMigration();

