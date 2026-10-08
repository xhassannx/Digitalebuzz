import { applySqlMigrationFile } from "./migration-runner";

applySqlMigrationFile("create_drip_campaigns.sql", "drip campaigns")
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
