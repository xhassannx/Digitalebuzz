-- Live chat auto-reply settings (welcome / off-hours) and per-contact send tracking
CREATE TABLE IF NOT EXISTS organization_live_chat_settings (
  organization_id VARCHAR PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  welcome_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  welcome_message TEXT NOT NULL DEFAULT '',
  off_hours_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  off_hours_message TEXT NOT NULL DEFAULT '',
  working_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS live_chat_auto_reply_state (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id VARCHAR NOT NULL,
  contact_number VARCHAR(32) NOT NULL,
  last_kind VARCHAR(16) NOT NULL,
  last_sent_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS live_chat_auto_reply_state_org_session_contact
  ON live_chat_auto_reply_state (organization_id, session_id, contact_number);

CREATE INDEX IF NOT EXISTS idx_live_chat_auto_reply_org
  ON live_chat_auto_reply_state (organization_id);
