-- Create subscription_history table (tracks plan assign/upgrade/renew per user)
-- Run this if the table was never created (e.g. DB existed before this table was in schema)
CREATE TABLE IF NOT EXISTS subscription_history (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id VARCHAR NOT NULL REFERENCES plans(id),
  subscription_id VARCHAR REFERENCES subscriptions(id) ON DELETE SET NULL,
  action VARCHAR NOT NULL CHECK (action IN ('assigned', 'upgraded', 'downgraded', 'renewed', 'expired', 'cancelled')),
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  billing_cycle VARCHAR NOT NULL CHECK (billing_cycle IN ('monthly', 'quarterly', 'yearly')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_history_user_id ON subscription_history(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_created_at ON subscription_history(created_at DESC);

COMMENT ON TABLE subscription_history IS 'Tracks subscription/plan changes per user (admin assign, upgrade, renew, etc.)';
