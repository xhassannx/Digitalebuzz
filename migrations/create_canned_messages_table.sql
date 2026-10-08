CREATE TABLE IF NOT EXISTS canned_messages (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR NOT NULL,
  type VARCHAR NOT NULL DEFAULT 'TEXT' CHECK (type IN ('TEXT', 'IMAGE')),
  text TEXT NOT NULL DEFAULT '',
  image_url VARCHAR,
  file_name VARCHAR,
  favourite BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_canned_messages_org ON canned_messages(organization_id);
