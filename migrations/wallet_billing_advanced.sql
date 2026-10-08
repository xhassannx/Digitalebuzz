-- Country-effective Meta rates, reconciliation, low-balance tracking, richer ledger.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS wallet_meta_rate_versions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  country_iso varchar(8) NOT NULL DEFAULT 'DEFAULT',
  meta_category varchar(32) NOT NULL CHECK (meta_category IN ('marketing', 'utility', 'authentication', 'service')),
  rate_minor integer NOT NULL,
  currency varchar(10) NOT NULL DEFAULT 'INR',
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz,
  notes text,
  created_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Drizzle `$defaultFn` is JS-only: tables created via `drizzle-kit push` have NOT NULL id
-- with no SQL DEFAULT. CREATE TABLE IF NOT EXISTS won't add it — set explicitly.
ALTER TABLE wallet_meta_rate_versions ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

CREATE INDEX IF NOT EXISTS idx_wallet_rate_country_cat_valid
  ON wallet_meta_rate_versions(country_iso, meta_category, valid_from DESC);

CREATE TABLE IF NOT EXISTS wallet_meta_invoices (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  period_label varchar(64) NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  meta_total_minor integer NOT NULL,
  currency varchar(10) NOT NULL DEFAULT 'INR',
  source varchar(32) NOT NULL DEFAULT 'manual',
  notes text,
  uploaded_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_meta_invoices_period ON wallet_meta_invoices(period_start, period_end);

CREATE TABLE IF NOT EXISTS wallet_reconciliation_runs (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  invoice_id varchar NOT NULL REFERENCES wallet_meta_invoices(id) ON DELETE CASCADE,
  status varchar(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  estimated_meta_minor integer NOT NULL DEFAULT 0,
  actual_meta_minor integer NOT NULL,
  variance_minor integer NOT NULL DEFAULT 0,
  adjustment_transaction_id varchar,
  organization_scope varchar(32) NOT NULL DEFAULT 'platform',
  notes text,
  created_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS wallet_low_balance_alert_state (
  organization_id varchar PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  last_alert_at timestamptz,
  last_balance_minor integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE wallet_transactions
  ADD COLUMN IF NOT EXISTS recipient_country_iso varchar(8),
  ADD COLUMN IF NOT EXISTS rate_version_id varchar;

ALTER TABLE wallet_transactions
  DROP CONSTRAINT IF EXISTS wallet_transactions_rate_version_id_fkey;

ALTER TABLE wallet_transactions
  ADD CONSTRAINT wallet_transactions_rate_version_id_fkey
  FOREIGN KEY (rate_version_id) REFERENCES wallet_meta_rate_versions(id) ON DELETE SET NULL;

ALTER TABLE wallet_reconciliation_runs
  DROP CONSTRAINT IF EXISTS wallet_reconciliation_runs_adjustment_transaction_id_fkey;

ALTER TABLE wallet_reconciliation_runs
  ADD CONSTRAINT wallet_reconciliation_runs_adjustment_transaction_id_fkey
  FOREIGN KEY (adjustment_transaction_id) REFERENCES wallet_transactions(id) ON DELETE SET NULL;

ALTER TABLE wallet_meta_invoices ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE wallet_reconciliation_runs ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

INSERT INTO wallet_meta_rate_versions (id, country_iso, meta_category, rate_minor, currency, valid_from, notes)
SELECT gen_random_uuid()::text, v.country_iso, v.meta_category, v.rate_minor, 'INR', '2020-01-01'::timestamptz, 'Initial seed'
FROM (VALUES
  ('DEFAULT', 'marketing', 85),
  ('DEFAULT', 'utility', 35),
  ('DEFAULT', 'authentication', 35),
  ('DEFAULT', 'service', 0),
  ('IN', 'marketing', 85),
  ('IN', 'utility', 35),
  ('IN', 'authentication', 35),
  ('IN', 'service', 0)
) AS v(country_iso, meta_category, rate_minor)
WHERE NOT EXISTS (SELECT 1 FROM wallet_meta_rate_versions LIMIT 1);
