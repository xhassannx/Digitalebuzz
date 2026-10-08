import { applySqlMigrationFile } from "./migration-runner";

applySqlMigrationFile("fix_scheduled_meetings_source_check.sql", "scheduled meetings source check")
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
