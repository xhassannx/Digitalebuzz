-- Add SaaS admin fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_saas_owner BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Create organization_themes table
CREATE TABLE IF NOT EXISTS organization_themes (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  -- Light theme colors (HSL format)
  light_primary VARCHAR,
  light_primary_foreground VARCHAR,
  light_secondary VARCHAR,
  light_secondary_foreground VARCHAR,
  light_accent VARCHAR,
  light_accent_foreground VARCHAR,
  light_background VARCHAR,
  light_foreground VARCHAR,
  light_card VARCHAR,
  light_card_foreground VARCHAR,
  light_border VARCHAR,
  -- Dark theme colors (HSL format)
  dark_primary VARCHAR,
  dark_primary_foreground VARCHAR,
  dark_secondary VARCHAR,
  dark_secondary_foreground VARCHAR,
  dark_accent VARCHAR,
  dark_accent_foreground VARCHAR,
  dark_background VARCHAR,
  dark_foreground VARCHAR,
  dark_card VARCHAR,
  dark_card_foreground VARCHAR,
  dark_border VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index for organization themes
CREATE INDEX IF NOT EXISTS idx_org_themes_org ON organization_themes(organization_id);

-- Add comment
COMMENT ON TABLE organization_themes IS 'Stores custom theme colors for organizations in SaaS platform';

