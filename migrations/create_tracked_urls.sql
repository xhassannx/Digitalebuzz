CREATE TABLE IF NOT EXISTS tracked_urls (
  id VARCHAR PRIMARY KEY,
  code VARCHAR NOT NULL UNIQUE,
  destination_url TEXT NOT NULL,
  organization_id VARCHAR REFERENCES organizations(id) ON DELETE CASCADE,
  user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  campaign_id VARCHAR REFERENCES campaigns(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracked_urls_org ON tracked_urls(organization_id);
CREATE INDEX IF NOT EXISTS idx_tracked_urls_campaign ON tracked_urls(campaign_id);

CREATE TABLE IF NOT EXISTS tracked_url_clicks (
  id VARCHAR PRIMARY KEY,
  tracked_url_id VARCHAR NOT NULL REFERENCES tracked_urls(id) ON DELETE CASCADE,
  campaign_id VARCHAR REFERENCES campaigns(id) ON DELETE SET NULL,
  ip VARCHAR,
  user_agent TEXT,
  clicked_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracked_url_clicks_url ON tracked_url_clicks(tracked_url_id);
CREATE INDEX IF NOT EXISTS idx_tracked_url_clicks_campaign ON tracked_url_clicks(campaign_id);
