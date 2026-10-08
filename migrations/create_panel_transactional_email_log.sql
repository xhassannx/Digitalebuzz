-- Dedupes panel transactional emails (welcome, subscription reminders / reactivation).
CREATE TABLE IF NOT EXISTS panel_transactional_email_log (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dedupe_key VARCHAR(512) NOT NULL,
  notification_kind VARCHAR(64) NOT NULL,
  sent_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT panel_transactional_email_log_dedupe_key_unique UNIQUE (dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_panel_transactional_email_log_user
  ON panel_transactional_email_log(user_id);
