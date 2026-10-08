-- Add organization_id column to webhooks table for multi-tenant support
-- This migration adds organization_id to the webhooks table to support organization-scoped webhooks

-- Add organization_id column (nullable, as existing webhooks won't have it)
ALTER TABLE webhooks 
ADD COLUMN IF NOT EXISTS organization_id VARCHAR;

-- Add foreign key constraint to organizations table
ALTER TABLE webhooks 
ADD CONSTRAINT fk_webhooks_organization 
FOREIGN KEY (organization_id) 
REFERENCES organizations(id) 
ON DELETE CASCADE;

-- Create index for better query performance (if it doesn't exist)
CREATE INDEX IF NOT EXISTS idx_webhooks_org 
ON webhooks(organization_id);

-- Add comment for documentation
COMMENT ON COLUMN webhooks.organization_id IS 'Organization ID for multi-tenant webhook scoping';

