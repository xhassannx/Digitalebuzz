import "dotenv/config";
import { applySqlMigrationFile } from "./migration-runner";
import { ensureSystemFreePlan } from "../utils/system-free-plan";

/**
 * Ensures the locked Free (System / Default) plan exists on DATABASE_URL.
 * db:push / schema sync alone does not insert this row.
 *
 * Safe to run on any environment — does not delete Trial/Starter/etc.
 *
 *   npm run db:migrate-system-free-plan
 *   npm run seed:system-free-plan
 */
async function main() {
  if (!process.env.DATABASE_URL && !process.env.PGHOST) {
    throw new Error("DATABASE_URL (or PGHOST) is not set in .env");
  }

  console.log("Applying ensure_system_free_plan.sql (columns + insert if missing)...");
  await applySqlMigrationFile("ensure_system_free_plan.sql", "system Free plan");

  console.log("Syncing Free plan via ensureSystemFreePlan (same as server boot)...");
  const plan = await ensureSystemFreePlan();
  console.log("System Free plan ready:", plan);
  console.log("Done. Open Admin → Plans — expect Free with System/Default and Auto on signup (3d).");
  process.exit(0);
}

main().catch((error) => {
  console.error("Failed to ensure system Free plan:", error);
  process.exit(1);
});
