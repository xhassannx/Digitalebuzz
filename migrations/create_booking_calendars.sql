-- Personal booking calendars (public scheduling links)
CREATE TABLE IF NOT EXISTS booking_calendars (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  host_user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  description TEXT,
  slug VARCHAR NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  provider VARCHAR NOT NULL DEFAULT 'google_meet',
  integration_id VARCHAR,
  whatsapp_session_id VARCHAR,
  availability JSONB NOT NULL DEFAULT '{"timezone":"Asia/Kolkata","startTime":"09:00","endTime":"18:00","weekdays":[1,2,3,4,5]}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_calendars_slug ON booking_calendars(slug);
CREATE INDEX IF NOT EXISTS idx_booking_calendars_org ON booking_calendars(organization_id);
CREATE INDEX IF NOT EXISTS idx_booking_calendars_host ON booking_calendars(host_user_id);

ALTER TABLE scheduled_meetings ADD COLUMN IF NOT EXISTS booking_calendar_id VARCHAR;

CREATE INDEX IF NOT EXISTS idx_scheduled_meetings_booking_cal ON scheduled_meetings(booking_calendar_id);
