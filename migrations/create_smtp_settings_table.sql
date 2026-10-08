CREATE TABLE IF NOT EXISTS smtp_settings (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  smtp_host VARCHAR NOT NULL,
  smtp_port INTEGER NOT NULL DEFAULT 587,
  smtp_secure BOOLEAN NOT NULL DEFAULT false,
  smtp_user VARCHAR NOT NULL,
  smtp_pass TEXT NOT NULL,
  from_email VARCHAR NOT NULL,
  from_name VARCHAR NOT NULL DEFAULT 'WhatsApp SaaS Platform',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_smtp_settings_user ON smtp_settings(user_id);
