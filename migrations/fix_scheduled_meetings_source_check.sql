-- Allow booking_page as a scheduled_meetings source
ALTER TABLE scheduled_meetings DROP CONSTRAINT IF EXISTS scheduled_meetings_source_check;
