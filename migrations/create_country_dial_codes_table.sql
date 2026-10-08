-- Reference data for template PHONE_NUMBER country prefixes.
-- After applying schema, populate rows: npm run db:seed-country-dials

CREATE TABLE IF NOT EXISTS country_dial_codes (
  id SERIAL PRIMARY KEY,
  iso_code VARCHAR(2) NOT NULL,
  country_name TEXT NOT NULL,
  dial_prefix VARCHAR(32) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS country_dial_codes_entry_unique
  ON country_dial_codes (iso_code, dial_prefix, country_name);
