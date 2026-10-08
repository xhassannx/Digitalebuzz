import { applySqlMigrationFile } from "./migration-runner";

applySqlMigrationFile("create_organization_live_chat_settings.sql", "live chat settings")
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
