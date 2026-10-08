-- Batch payment records for onboarding fee line items (separate from subscription `payments` / Orders list).
CREATE TABLE IF NOT EXISTS whitelabel_onboarding_settlements (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway VARCHAR(32) NOT NULL CHECK (gateway IN ('razorpay', 'cashfree')),
  gateway_order_id VARCHAR(255) NOT NULL UNIQUE,
  gateway_payment_id VARCHAR(255),
  amount_minor INTEGER NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  fee_ids JSONB NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
  raw_gateway_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_onboarding_settlements_status_created
  ON whitelabel_onboarding_settlements (status, created_at DESC);

COMMENT ON TABLE whitelabel_onboarding_settlements IS 'One row per Razorpay order / Cashfree link batch pay for onboarding fee line items';

ALTER TABLE whitelabel_onboarding_fees
  ADD COLUMN IF NOT EXISTS payment_gateway VARCHAR(32),
  ADD COLUMN IF NOT EXISTS gateway_payload JSONB;

COMMENT ON COLUMN whitelabel_onboarding_fees.payment_gateway IS 'razorpay or cashfree after successful batch pay';
COMMENT ON COLUMN whitelabel_onboarding_fees.gateway_payload IS 'Gateway snapshot (payment fetch / webhook) for this line item';
