-- Create Contact Columns table for managing custom contact fields
CREATE TABLE IF NOT EXISTS contact_columns (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id VARCHAR REFERENCES organizations(id) ON DELETE CASCADE,
  label VARCHAR NOT NULL,
  type VARCHAR NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'email', 'number', 'textarea', 'phone', 'select', 'date')),
  options JSONB, -- For SELECT type - array of option strings
  visible BOOLEAN NOT NULL DEFAULT true,
  required BOOLEAN NOT NULL DEFAULT false,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_columns_user ON contact_columns(user_id);
CREATE INDEX IF NOT EXISTS idx_columns_org ON contact_columns(organization_id);

COMMENT ON TABLE contact_columns IS 'Stores custom column definitions for contact management';

