import "dotenv/config";
import { applySqlMigrationFile } from "./migration-runner";

/** @deprecated Use `npm run db:sync` or applySqlMigrationFile from migration-runner */
export async function runSqlMigrationFile(relativePath: string, label: string): Promise<void> {
  await applySqlMigrationFile(relativePath, label);
}

const relativePath = process.argv[2];
const label = process.argv[3];

if (!relativePath) {
  console.error("Usage: tsx server/scripts/run-sql-migration-file.ts <file.sql> [label]");
  process.exit(1);
}

applySqlMigrationFile(relativePath, label)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
