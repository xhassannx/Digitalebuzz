-- Add-on catalog: sidebar features unlocked when this add-on is assigned to a user (OR across assignments).
ALTER TABLE addons ADD COLUMN IF NOT EXISTS feature_webhook_events boolean NOT NULL DEFAULT false;
ALTER TABLE addons ADD COLUMN IF NOT EXISTS feature_chatbot boolean NOT NULL DEFAULT false;
ALTER TABLE addons ADD COLUMN IF NOT EXISTS feature_flows boolean NOT NULL DEFAULT false;

-- Optional one-time: grant all three on existing catalog rows (uncomment if you want pre-migration add-ons to keep full access)
-- UPDATE addons SET feature_webhook_events = true, feature_chatbot = true, feature_flows = true;
