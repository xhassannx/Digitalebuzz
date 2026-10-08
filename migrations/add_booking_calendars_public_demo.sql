-- Which booking calendar powers the public "Book a Demo" landing CTA
ALTER TABLE booking_calendars
  ADD COLUMN IF NOT EXISTS is_public_demo BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_booking_calendars_public_demo
  ON booking_calendars (organization_id, is_public_demo)
  WHERE is_public_demo = TRUE;
