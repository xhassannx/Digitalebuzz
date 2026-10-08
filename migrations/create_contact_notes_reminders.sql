-- Contact Notes table (per-contact note entries)
CREATE TABLE IF NOT EXISTS contact_notes (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  contact_id VARCHAR NOT NULL REFERENCES managed_contacts(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id VARCHAR REFERENCES organizations(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contact_notes_contact ON contact_notes(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_notes_org ON contact_notes(organization_id);

-- Contact Reminders table
CREATE TABLE IF NOT EXISTS contact_reminders (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  contact_id VARCHAR NOT NULL REFERENCES managed_contacts(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id VARCHAR REFERENCES organizations(id) ON DELETE CASCADE,
  reminder_to VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  reminder_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contact_reminders_contact ON contact_reminders(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_reminders_org ON contact_reminders(organization_id);
CREATE INDEX IF NOT EXISTS idx_contact_reminders_at ON contact_reminders(reminder_at);
