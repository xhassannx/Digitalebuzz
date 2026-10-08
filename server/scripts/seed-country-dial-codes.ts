// @ts-nocheck
/**
 * Idempotent seed for `country_dial_codes`. Safe to run multiple times.
 *
 * Run after migrations / drizzle push: npm run db:seed-country-dials
 */

import "dotenv/config";
import { db } from "../../db";
import { countryDialCodes } from "@shared/schema";
import { getCountryDialSeedRows } from "../data/country-dial-codes-seed";

async function main() {
  const rows = getCountryDialSeedRows();
  const inserted = await db
    .insert(countryDialCodes)
    .values(rows)
    .onConflictDoNothing({
      target: [countryDialCodes.isoCode, countryDialCodes.dialPrefix, countryDialCodes.countryName],
    })
    .returning({ id: countryDialCodes.id });

  console.log(
    inserted.length > 0
      ? `Inserted ${inserted.length} new country dial code row(s) (${rows.length} definitions in seed).`
      : `No new rows (table already has data or ${rows.length} seed rows present).`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
