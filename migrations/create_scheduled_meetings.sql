-- Meetings scheduled via Inbox "Send meet / booking link"
CREATE TABLE IF NOT EXISTS scheduled_meetings (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chat_id VARCHAR REFERENCES chats(id) ON DELETE SET NULL,
  contact_name VARCHAR NOT NULL,
  contact_number VARCHAR NOT NULL,
  customer_email VARCHAR,
  provider VARCHAR NOT NULL CHECK (provider IN ('google_meet', 'calendly')),
  title VARCHAR NOT NULL,
  meet_link TEXT NOT NULL,
  start_at TIMESTAMP NOT NULL,
  end_at TIMESTAMP NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  integration_id VARCHAR,
  whatsapp_session_id VARCHAR,
  external_event_id VARCHAR,
  status VARCHAR NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  source VARCHAR NOT NULL DEFAULT 'inbox' CHECK (source IN ('inbox', 'ai')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_meetings_org ON scheduled_meetings(organization_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_meetings_start ON scheduled_meetings(organization_id, start_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_meetings_provider ON scheduled_meetings(organization_id, provider);
CREATE INDEX IF NOT EXISTS idx_scheduled_meetings_chat ON scheduled_meetings(chat_id);
