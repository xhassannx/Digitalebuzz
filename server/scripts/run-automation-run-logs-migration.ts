import { runSqlMigrationFile } from "./run-sql-migration-file";

runSqlMigrationFile(
  "create_automation_flow_run_logs.sql",
  "automation flow run logs"
).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
