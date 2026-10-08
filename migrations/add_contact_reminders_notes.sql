-- Internal notes for reminders (not sent on WhatsApp)
ALTER TABLE contact_reminders ADD COLUMN IF NOT EXISTS notes TEXT;
