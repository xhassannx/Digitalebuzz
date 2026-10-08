import { applySqlMigrationFile } from "./migration-runner";

applySqlMigrationFile(
  "fix_contact_reminders_reminder_at_timestamptz.sql",
  "contact reminders reminder_at timestamptz",
)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
