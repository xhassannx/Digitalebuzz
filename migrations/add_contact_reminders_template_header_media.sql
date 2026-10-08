-- Header media fields for reminder WhatsApp template auto-send
ALTER TABLE contact_reminders ADD COLUMN IF NOT EXISTS header_image_url TEXT;
ALTER TABLE contact_reminders ADD COLUMN IF NOT EXISTS header_image_id VARCHAR;
ALTER TABLE contact_reminders ADD COLUMN IF NOT EXISTS header_video_url TEXT;
ALTER TABLE contact_reminders ADD COLUMN IF NOT EXISTS header_video_id VARCHAR;
ALTER TABLE contact_reminders ADD COLUMN IF NOT EXISTS header_document_url TEXT;
ALTER TABLE contact_reminders ADD COLUMN IF NOT EXISTS header_document_id VARCHAR;
