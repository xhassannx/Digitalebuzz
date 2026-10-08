-- Tech Partner prepaid wallet: per-organization balance, full transaction ledger, reload orders.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE platform_master_settings
  ADD COLUMN IF NOT EXISTS wallet_billing_config jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN platform_master_settings.wallet_billing_config IS
  'Tech partner wallet billing: enabled, meta rates (paise), optional markup, low balance threshold';

CREATE TABLE IF NOT EXISTS organization_wallets (
  organization_id varchar PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  balance_minor integer NOT NULL DEFAULT 0,
  currency varchar(10) NOT NULL DEFAULT 'INR',
  status varchar(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id varchar NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type varchar(32) NOT NULL CHECK (type IN (
    'reload', 'debit_message', 'debit_campaign', 'refund', 'adjustment'
  )),
  amount_minor integer NOT NULL,
  balance_after_minor integer NOT NULL,
  currency varchar(10) NOT NULL DEFAULT 'INR',
  meta_category varchar(32),
  meta_cost_minor integer,
  markup_minor integer NOT NULL DEFAULT 0,
  charged_minor integer NOT NULL DEFAULT 0,
  description text,
  reference_type varchar(64),
  reference_id varchar(255),
  gateway_order_id varchar(255),
  gateway_payment_id varchar(255),
  created_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_org_created ON wallet_transactions(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_reference ON wallet_transactions(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_gateway_order ON wallet_transactions(gateway_order_id);

CREATE TABLE IF NOT EXISTS wallet_reload_orders (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id varchar NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_minor integer NOT NULL,
  currency varchar(10) NOT NULL DEFAULT 'INR',
  status varchar(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')),
  payment_gateway varchar(32) NOT NULL DEFAULT 'razorpay',
  gateway_order_id varchar(255) NOT NULL,
  gateway_payment_id varchar(255),
  gateway_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

ALTER TABLE wallet_transactions ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE wallet_reload_orders ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_reload_gateway_order ON wallet_reload_orders(gateway_order_id);
CREATE INDEX IF NOT EXISTS idx_wallet_reload_org_status ON wallet_reload_orders(organization_id, status);
