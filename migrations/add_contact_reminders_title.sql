-- Add title to contact_reminders so list/popup can show a short title separate from message
ALTER TABLE contact_reminders ADD COLUMN IF NOT EXISTS title VARCHAR;
