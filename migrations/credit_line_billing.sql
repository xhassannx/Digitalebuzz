-- Per-org WhatsApp billing mode + multi-supplier credit-line provider config.
-- self_pay: Meta usage not wallet-debited. Template CRUD and session via Graph.
-- credit_line: template sends via supplier middleware. Meta usage debit from wallet.

ALTER TABLE platform_master_settings
  ADD COLUMN IF NOT EXISTS credit_line_providers_config jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN platform_master_settings.credit_line_providers_config IS
  'Map of credit-line supplier configs keyed by provider id (interakt, etc.)';

CREATE TABLE IF NOT EXISTS organization_whatsapp_billing (
  organization_id varchar PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  billing_mode varchar(32) NOT NULL DEFAULT 'self_pay'
    CHECK (billing_mode IN ('self_pay', 'credit_line')),
  credit_line_provider varchar(64),
  credit_line_status varchar(32) NOT NULL DEFAULT 'inactive'
    CHECK (credit_line_status IN ('inactive', 'pending', 'active', 'error')),
  credit_line_waba_id varchar(64),
  credit_line_phone_number_id varchar(64),
  credit_line_metadata jsonb,
  last_error text,
  updated_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_wa_billing_mode
  ON organization_whatsapp_billing(billing_mode, credit_line_provider);
