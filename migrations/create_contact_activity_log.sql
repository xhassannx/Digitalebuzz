-- Contact Activity Log (who did what: tag add/remove, note, reminder)
CREATE TABLE IF NOT EXISTS contact_activity_log (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  contact_id VARCHAR NOT NULL REFERENCES managed_contacts(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id VARCHAR REFERENCES organizations(id) ON DELETE CASCADE,
  action VARCHAR NOT NULL CHECK (action IN ('tag_added', 'tag_removed', 'note_added', 'reminder_added')),
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contact_activity_contact ON contact_activity_log(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_activity_org ON contact_activity_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_contact_activity_created ON contact_activity_log(created_at);
