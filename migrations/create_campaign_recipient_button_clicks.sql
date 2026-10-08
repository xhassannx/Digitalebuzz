-- Track template button clicks per campaign recipient (for campaign analytics)
CREATE TABLE IF NOT EXISTS campaign_recipient_button_clicks (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_recipient_id VARCHAR NOT NULL REFERENCES campaign_recipients(id) ON DELETE CASCADE,
  campaign_id VARCHAR NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  button_id VARCHAR NOT NULL,
  button_title VARCHAR NOT NULL,
  clicked_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_button_clicks_campaign ON campaign_recipient_button_clicks(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_button_clicks_recipient ON campaign_recipient_button_clicks(campaign_recipient_id);
