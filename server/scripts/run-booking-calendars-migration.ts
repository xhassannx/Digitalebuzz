import { applySqlMigrationFile } from "./migration-runner";

applySqlMigrationFile("create_booking_calendars.sql", "booking calendars")
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
