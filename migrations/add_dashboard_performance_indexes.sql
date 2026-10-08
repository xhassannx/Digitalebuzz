-- Improves heavy dashboard/stat APIs and inbox message loads on self-hosted Postgres.
-- Safe to run multiple times.
-- @see https://www.postgresql.org/docs/current/sql-createindex.html (use CONCURRENTLY in prod if you need to avoid locks)

-- Inbox / chat thread: WHERE chat_id = ? ORDER BY timestamp (hottest path; was missing in base schema)
CREATE INDEX IF NOT EXISTS idx_messages_chat_timestamp
  ON messages(chat_id, "timestamp" DESC);

-- Message list by session (stats, filters)
CREATE INDEX IF NOT EXISTS idx_messages_session_fromme
  ON messages(session_id, from_me);

CREATE INDEX IF NOT EXISTS idx_messages_session_timestamp
  ON messages(session_id, "timestamp");

-- Lead-source aggregation by organization
CREATE INDEX IF NOT EXISTS idx_managed_contacts_org_source
  ON managed_contacts(organization_id, source);

-- Chat list by session (inbox sidebar sort)
CREATE INDEX IF NOT EXISTS idx_chats_session_last_message
  ON chats(session_id, last_message_time DESC NULLS LAST);

