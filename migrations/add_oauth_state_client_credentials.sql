-- Add optional client credentials to integration_oauth_states for per-connection Google OAuth
ALTER TABLE integration_oauth_states
  ADD COLUMN IF NOT EXISTS client_id VARCHAR,
  ADD COLUMN IF NOT EXISTS client_secret VARCHAR;
