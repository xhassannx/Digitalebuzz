import { runSqlMigrationFile } from "./run-sql-migration-file";

async function main() {
  await runSqlMigrationFile(
    "create_automation_flow_scheduled_runs.sql",
    "automation delay queue"
  );
  await runSqlMigrationFile(
    "create_automation_flow_run_logs.sql",
    "automation run logs"
  );
  console.log("\nAll automation migrations completed.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
