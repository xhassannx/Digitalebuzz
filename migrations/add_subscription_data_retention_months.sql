-- Configurable months after plan expiry before business data is auto-purged (keep user account).
ALTER TABLE platform_master_settings
  ADD COLUMN IF NOT EXISTS subscription_data_retention_months integer NOT NULL DEFAULT 3;

ALTER TABLE platform_master_settings
  DROP CONSTRAINT IF EXISTS platform_master_settings_retention_months_check;

ALTER TABLE platform_master_settings
  ADD CONSTRAINT platform_master_settings_retention_months_check
  CHECK (subscription_data_retention_months IN (1, 2, 3));

-- Marks that expired-subscription business data was purged (user row retained).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS subscription_data_purged_at timestamptz;
