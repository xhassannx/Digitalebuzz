-- Add organization_id column to messages table for multi-tenant support
-- This migration adds organization_id to the messages table to support organization-scoped messaging

-- Add organization_id column (nullable, as existing messages won't have it)
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS organization_id VARCHAR;

-- Add foreign key constraint to organizations table
ALTER TABLE messages 
ADD CONSTRAINT fk_messages_organization 
FOREIGN KEY (organization_id) 
REFERENCES organizations(id) 
ON DELETE CASCADE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_messages_organization 
ON messages(organization_id);

-- Add comment for documentation
COMMENT ON COLUMN messages.organization_id IS 'Organization ID for multi-tenant message scoping';

