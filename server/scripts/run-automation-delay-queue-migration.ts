import { runSqlMigrationFile } from "./run-sql-migration-file";

runSqlMigrationFile(
  "create_automation_flow_scheduled_runs.sql",
  "automation_flow_scheduled_runs"
).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
