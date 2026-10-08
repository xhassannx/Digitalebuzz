-- Add template message fields to campaigns table
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS template_id VARCHAR;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS template_language VARCHAR;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS template_parameters JSONB;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS header_image_id VARCHAR;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS header_image_url TEXT;

-- Add comments for documentation
COMMENT ON COLUMN campaigns.template_id IS 'WhatsApp template ID for template messages';
COMMENT ON COLUMN campaigns.template_language IS 'Template language code (e.g., en, en_US)';
COMMENT ON COLUMN campaigns.template_parameters IS 'Template parameter mapping configuration (array of {column, fallback})';
COMMENT ON COLUMN campaigns.header_image_id IS 'WhatsApp media ID for template header image';
COMMENT ON COLUMN campaigns.header_image_url IS 'URL for template header image (for preview/storage)';

