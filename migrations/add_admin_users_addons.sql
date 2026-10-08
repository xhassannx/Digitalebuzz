-- Add phone, emailVerified, accountStatus to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone varchar;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status varchar DEFAULT 'active';
UPDATE users SET account_status = 'active' WHERE account_status IS NULL;

-- Add-ons catalog
CREATE TABLE IF NOT EXISTS addons (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL,
  description text,
  price integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

-- User add-ons assignments
CREATE TABLE IF NOT EXISTS user_addons (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addon_id varchar NOT NULL REFERENCES addons(id) ON DELETE CASCADE,
  assigned_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_addons_user ON user_addons(user_id);
CREATE INDEX IF NOT EXISTS idx_user_addons_addon ON user_addons(addon_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_addons_unique ON user_addons(user_id, addon_id);
