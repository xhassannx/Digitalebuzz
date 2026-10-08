import "dotenv/config";
import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

async function runOptKeywordsMigration() {
  const sql = neon(process.env.DATABASE_URL!);
  
  try {
    console.log("Running opt keywords migration...");
    
    // Read the migration file - handle both root and server directory execution
    const rootDir = process.cwd().endsWith('server') 
      ? path.join(process.cwd(), '..') 
      : process.cwd();
    const migrationPath = path.join(rootDir, 'migrations', 'create_opt_keywords_table.sql');
    
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
    
    console.log(`Found ${statements.length} SQL statement(s)...`);
    statements.forEach((s, i) => {
      console.log(`  Statement ${i + 1}: ${s.substring(0, 50)}...`);
    });
    
    // Execute each statement separately
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`\nExecuting statement ${i + 1}/${statements.length}...`);
        try {
          await sql(statement);
          console.log(`  ✅ Statement ${i + 1} executed successfully`);
        } catch (error: any) {
          // Ignore "already exists" errors for IF NOT EXISTS statements
          if (error.message && error.message.includes('already exists')) {
            console.log(`  ⚠️  Statement ${i + 1} skipped (already exists)`);
          } else if (error.code === '42P01' && statement.toLowerCase().includes('create index')) {
            // If table doesn't exist yet, the CREATE TABLE might not have run
            // This shouldn't happen with proper SQL, but handle it gracefully
            console.log(`  ⚠️  Index creation skipped (table might not exist yet)`);
          } else {
            throw error;
          }
        }
      }
    }
    
    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error: any) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runOptKeywordsMigration();

