import { applySqlMigrationFile } from "./migration-runner";

applySqlMigrationFile(
  "add_booking_calendars_theme_capacity.sql",
  "booking calendars theme + capacity",
)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
