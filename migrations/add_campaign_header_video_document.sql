-- Add VIDEO and DOCUMENT header fields to campaigns (same pattern as image)
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS header_video_id VARCHAR;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS header_video_url TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS header_document_id VARCHAR;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS header_document_url TEXT;

COMMENT ON COLUMN campaigns.header_video_id IS 'WhatsApp media ID for template header video';
COMMENT ON COLUMN campaigns.header_video_url IS 'URL for template header video';
COMMENT ON COLUMN campaigns.header_document_id IS 'WhatsApp media ID for template header document';
COMMENT ON COLUMN campaigns.header_document_url IS 'URL for template header document';
