-- Add contact_display_name to contact_reminders so reminder dropdown shows the name user saw when creating (e.g. from chat)
ALTER TABLE contact_reminders ADD COLUMN IF NOT EXISTS contact_display_name VARCHAR;
