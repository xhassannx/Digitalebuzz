-- Add-on catalog: Drip Campaigns sidebar unlocked when this add-on is assigned to a user.
ALTER TABLE addons ADD COLUMN IF NOT EXISTS feature_drip_campaigns boolean NOT NULL DEFAULT false;
