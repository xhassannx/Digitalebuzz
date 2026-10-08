import { applySqlMigrationFile } from "./migration-runner";

applySqlMigrationFile("add_booking_calendars_logo_url.sql", "booking calendars logo")
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
