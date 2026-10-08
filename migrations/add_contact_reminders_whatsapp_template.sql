-- WhatsApp template auto-send fields for contact reminders
ALTER TABLE contact_reminders ADD COLUMN IF NOT EXISTS template_name VARCHAR;
ALTER TABLE contact_reminders ADD COLUMN IF NOT EXISTS template_language VARCHAR;
ALTER TABLE contact_reminders ADD COLUMN IF NOT EXISTS template_params JSONB;
ALTER TABLE contact_reminders ADD COLUMN IF NOT EXISTS session_id VARCHAR;
ALTER TABLE contact_reminders ADD COLUMN IF NOT EXISTS whatsapp_status VARCHAR NOT NULL DEFAULT 'none';
ALTER TABLE contact_reminders ADD COLUMN IF NOT EXISTS whatsapp_sent_at TIMESTAMP;
ALTER TABLE contact_reminders ADD COLUMN IF NOT EXISTS whatsapp_error TEXT;
CREATE INDEX IF NOT EXISTS idx_contact_reminders_wa_status ON contact_reminders (whatsapp_status, reminder_at);
