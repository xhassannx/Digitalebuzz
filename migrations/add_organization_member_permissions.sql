-- Add permissions column to organization_members (array of permission keys, stored as JSONB)
ALTER TABLE organization_members
ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT '[]'::jsonb;
