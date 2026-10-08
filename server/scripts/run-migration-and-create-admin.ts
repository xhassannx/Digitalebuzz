import "dotenv/config";
import { neon } from '@neondatabase/serverless';
import { db } from "../../db";
import { users, organizations, organizationMembers } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

async function runMigrationAndCreateAdmin() {
  const sql = neon(process.env.DATABASE_URL!);
  
  try {
    console.log("Step 1: Running database migration...");
    
    // Execute migration statements one by one
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_saas_owner BOOLEAN NOT NULL DEFAULT false`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true`;
    
    await sql`CREATE TABLE IF NOT EXISTS organization_themes (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id VARCHAR NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
      light_primary VARCHAR,
      light_primary_foreground VARCHAR,
      light_secondary VARCHAR,
      light_secondary_foreground VARCHAR,
      light_accent VARCHAR,
      light_accent_foreground VARCHAR,
      light_background VARCHAR,
      light_foreground VARCHAR,
      light_card VARCHAR,
      light_card_foreground VARCHAR,
      light_border VARCHAR,
      dark_primary VARCHAR,
      dark_primary_foreground VARCHAR,
      dark_secondary VARCHAR,
      dark_secondary_foreground VARCHAR,
      dark_accent VARCHAR,
      dark_accent_foreground VARCHAR,
      dark_background VARCHAR,
      dark_foreground VARCHAR,
      dark_card VARCHAR,
      dark_card_foreground VARCHAR,
      dark_border VARCHAR,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`;
    
    await sql`CREATE INDEX IF NOT EXISTS idx_org_themes_org ON organization_themes(organization_id)`;
    
    console.log("✅ Migration completed successfully!");

    console.log("\nStep 2: Creating SaaS owner account...");

    const email = "admin@saas-platform.com";
    const password = "Admin@123456";
    const firstName = "SaaS";
    const lastName = "Administrator";
    const organizationName = "SaaS Platform";

    // Check if user already exists
    const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    
    if (existingUser) {
      console.log("User already exists. Updating to SaaS owner...");
      // Update existing user to be SaaS owner
      const [updatedUser] = await db
        .update(users)
        .set({
          isSaaSOwner: true,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id))
        .returning();
      
      console.log("\n✅ SaaS Owner Account Ready!");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("📧 Email:", email);
      console.log("🔑 Password:", password);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const userId = crypto.randomUUID();
    const [newUser] = await db
      .insert(users)
      .values({
        id: userId,
        email,
        passwordHash,
        firstName,
        lastName,
        isSaaSOwner: true,
        isActive: true,
      })
      .returning();

    console.log("✅ User created:", newUser.id);

    // Create organization
    const [organization] = await db
      .insert(organizations)
      .values({
        id: crypto.randomUUID(),
        name: organizationName,
        ownerId: userId,
      })
      .returning();

    console.log("✅ Organization created:", organization.id);

    // Add user to organization as owner
    await db.insert(organizationMembers).values({
      id: crypto.randomUUID(),
      organizationId: organization.id,
      userId: userId,
      role: 'owner',
    });

    console.log("✅ Organization membership created");

    console.log("\n✅ SaaS Owner Account Created Successfully!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📧 Email:", email);
    console.log("🔑 Password:", password);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    // Get base URL from environment or use default
    const baseUrl = process.env.BASE_URL || "http://localhost:5002";
    console.log("\n🌐 Login URL:", `${baseUrl}/login`);
    console.log("📊 Admin Dashboard:", `${baseUrl}/admin/dashboard`);
    console.log("\n");

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    if (error.code === '42703') {
      console.error("\n⚠️  Migration may have failed. The database columns don't exist yet.");
      console.error("Please run the migration manually first:");
      console.error("  npm run db:push");
    }
    throw error;
  }
}

runMigrationAndCreateAdmin()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

