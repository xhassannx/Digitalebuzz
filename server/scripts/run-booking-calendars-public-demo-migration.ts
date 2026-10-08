import { applySqlMigrationFile } from "./migration-runner";

applySqlMigrationFile(
  "add_booking_calendars_public_demo.sql",
  "booking calendars public demo flag",
)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
