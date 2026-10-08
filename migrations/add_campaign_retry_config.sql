-- AiSensy-style multi-pass campaign retry (up to 3 delayed retries after completion)
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS retry_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS retry_steps JSONB;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS retry_attempt_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS retry_next_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_campaigns_retry_next_at ON campaigns (retry_next_at)
  WHERE retry_next_at IS NOT NULL;
