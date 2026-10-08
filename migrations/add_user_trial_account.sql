ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_trial_account boolean NOT NULL DEFAULT false;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS trial_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_users_trial_expires
  ON users (trial_expires_at)
  WHERE is_trial_account = true AND trial_expires_at IS NOT NULL;
