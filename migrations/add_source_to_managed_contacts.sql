-- Add source column to managed_contacts table
-- This column tracks where the contact came from (e.g., 'manual', 'whatsapp', 'facebook', 'import', etc.)
ALTER TABLE managed_contacts ADD COLUMN IF NOT EXISTS source VARCHAR DEFAULT 'manual';

-- Update existing contacts that might have come from WhatsApp to have source 'whatsapp'
-- This is optional - you can run this if you want to backfill existing contacts
-- UPDATE managed_contacts SET source = 'whatsapp' WHERE source IS NULL AND phone_number IN (
--   SELECT DISTINCT number FROM contacts WHERE session_id IN (
--     SELECT session_id FROM whatsapp_sessions WHERE connection_type = 'official'
--   )
-- );

-- Update existing contacts that might have come from Facebook Leads to have source 'facebook'
-- This is optional - you can run this if you want to backfill existing contacts
-- UPDATE managed_contacts SET source = 'facebook' WHERE source IS NULL AND custom_fields::text LIKE '%facebook_lead_id%';

-- Create index on source for faster queries
CREATE INDEX IF NOT EXISTS idx_managed_contacts_source ON managed_contacts(source);

