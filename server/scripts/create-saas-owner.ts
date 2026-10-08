import "dotenv/config";
import { db } from "../../db";
import { users, organizations, organizationMembers } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";

async function createSaaSOwner() {
  const email = "admin@saas-platform.com";
  const password = "Admin@123456";
  const firstName = "SaaS";
  const lastName = "Administrator";
  const organizationName = "SaaS Platform";

  try {
    console.log("Creating SaaS owner account...");

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
      try {
        const { ensureSystemFreePlan } = await import("../utils/system-free-plan");
        await ensureSystemFreePlan();
      } catch (planErr: any) {
        console.error("Warning: could not ensure system Free plan:", planErr?.message || planErr);
      }
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
    console.log("\n🌐 Login URL: http://localhost:5002/login");
    console.log("   (or your production URL + /login)");
    console.log("\n📊 Admin Dashboard: http://localhost:5002/admin/dashboard");
    console.log("   (or your production URL + /admin/dashboard)");
    console.log("\n");

    try {
      const { ensureSystemFreePlan } = await import("../utils/system-free-plan");
      await ensureSystemFreePlan();
    } catch (planErr: any) {
      console.error("Warning: could not ensure system Free plan:", planErr?.message || planErr);
    }

  } catch (error: any) {
    console.error("❌ Error creating SaaS owner:", error);
    throw error;
  }
}

createSaaSOwner()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

