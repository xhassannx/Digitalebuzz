-- Add industry and website fields to organizations table
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS industry VARCHAR,
ADD COLUMN IF NOT EXISTS website TEXT;

COMMENT ON COLUMN organizations.industry IS 'Industry type of the organization';
COMMENT ON COLUMN organizations.website IS 'Website URL of the organization';

