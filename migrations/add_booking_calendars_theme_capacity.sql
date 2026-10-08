-- Theme + per-slot capacity for public booking calendars.
-- Defaults keep existing calendars working (emerald theme, capacity 1).

ALTER TABLE booking_calendars
  ADD COLUMN IF NOT EXISTS theme VARCHAR(32) NOT NULL DEFAULT 'emerald';

ALTER TABLE booking_calendars
  ADD COLUMN IF NOT EXISTS max_bookings_per_slot INTEGER NOT NULL DEFAULT 1;
