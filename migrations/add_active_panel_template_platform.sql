-- One active WhatsApp panel template for the whole deployment (all organizations on this domain).
ALTER TABLE platform_master_settings
ADD COLUMN IF NOT EXISTS active_panel_template_id VARCHAR NOT NULL DEFAULT 'default';
