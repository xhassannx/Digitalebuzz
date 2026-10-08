/**
 * Writes migrations/seed_country_dial_codes_data.sql for manual Neon/psql runs.
 * Run: npx tsx server/scripts/generate-country-dial-sql.ts
 */

import * as fs from "fs";
import * as path from "path";
import { getCountryDialSeedRows } from "../data/country-dial-codes-seed";

function esc(s: string) {
  return `'${s.replace(/'/g, "''")}'`;
}

const rows = getCountryDialSeedRows();
const values = rows.map((r) => `(${esc(r.isoCode)}, ${esc(r.countryName)}, ${esc(r.dialPrefix)})`).join(",\n");

const sql = `-- country_dial_codes: plain INSERT for an empty table (no ON CONFLICT — avoids errors when the unique index is missing).
-- If you need idempotent re-runs, create the index first:
--   CREATE UNIQUE INDEX IF NOT EXISTS country_dial_codes_entry_unique
--     ON country_dial_codes (iso_code, dial_prefix, country_name);
-- then use npm run db:seed-country-dials or INSERT ... ON CONFLICT DO NOTHING.

INSERT INTO country_dial_codes (iso_code, country_name, dial_prefix)
VALUES
${values};
`;

const out = path.join(process.cwd(), "migrations", "seed_country_dial_codes_data.sql");
fs.writeFileSync(out, sql, "utf8");
console.log(`Wrote ${rows.length} rows to ${out}`);
