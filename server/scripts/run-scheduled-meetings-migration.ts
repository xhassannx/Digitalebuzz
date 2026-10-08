import { applySqlMigrationFile } from "./migration-runner";

applySqlMigrationFile("create_scheduled_meetings.sql", "scheduled meetings")
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
