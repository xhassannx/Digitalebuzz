-- One-time automatic background retry of failed recipients after a campaign run finishes.
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS failed_auto_retry_at TIMESTAMP;
