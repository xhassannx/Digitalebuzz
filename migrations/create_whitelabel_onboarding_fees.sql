-- Tracks per-customer onboarding fees owed by the whitelabel operator to the licensor (from synced /api/customer contract).
CREATE TABLE IF NOT EXISTS whitelabel_onboarding_fees (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id VARCHAR REFERENCES subscriptions(id) ON DELETE SET NULL,
  subscription_history_id VARCHAR REFERENCES subscription_history(id) ON DELETE SET NULL,
  trigger VARCHAR(32) NOT NULL CHECK (trigger IN ('assigned', 'purchased', 'renewed', 'upgraded', 'monthly')),
  amount_minor INTEGER NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  due_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'waived', 'failed', 'cancelled')),
  paid_at TIMESTAMPTZ,
  gateway_order_id VARCHAR(255),
  gateway_payment_id VARCHAR(255),
  payment_gateway VARCHAR(32),
  gateway_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whitelabel_onboarding_fees_user_id ON whitelabel_onboarding_fees(user_id);
CREATE INDEX IF NOT EXISTS idx_whitelabel_onboarding_fees_status_due ON whitelabel_onboarding_fees(status, due_at DESC);
CREATE INDEX IF NOT EXISTS idx_whitelabel_onboarding_fees_gateway_order ON whitelabel_onboarding_fees(gateway_order_id);

COMMENT ON TABLE whitelabel_onboarding_fees IS 'Customer onboarding monthly fee lines from licensor contract, accrual via scheduler, paid via SaaS owner Orders page';
