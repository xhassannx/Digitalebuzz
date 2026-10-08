-- Add themeMode and accentColor fields to organization_themes table
ALTER TABLE organization_themes 
ADD COLUMN IF NOT EXISTS theme_mode VARCHAR DEFAULT 'system';

ALTER TABLE organization_themes 
ADD COLUMN IF NOT EXISTS accent_color VARCHAR DEFAULT 'orange';

