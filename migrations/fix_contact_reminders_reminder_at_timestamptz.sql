-- Store reminder due times as absolute instants so WhatsApp scheduler
-- compares correctly regardless of Postgres session TimeZone.
-- Existing naive TIMESTAMP values were written as Asia/Kolkata wall clocks
-- (server process TZ defaults to Asia/Kolkata).

ALTER TABLE contact_reminders
  ALTER COLUMN reminder_at TYPE timestamptz
  USING reminder_at AT TIME ZONE 'Asia/Kolkata';

ALTER TABLE contact_reminders
  ALTER COLUMN whatsapp_sent_at TYPE timestamptz
  USING CASE
    WHEN whatsapp_sent_at IS NULL THEN NULL
    ELSE whatsapp_sent_at AT TIME ZONE 'Asia/Kolkata'
  END;
