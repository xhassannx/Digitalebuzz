-- Per-organization WhatsApp panel UI template (full layout packages under client/src/panel-templates/)
ALTER TABLE organization_themes
ADD COLUMN IF NOT EXISTS panel_template_id VARCHAR DEFAULT 'default';
