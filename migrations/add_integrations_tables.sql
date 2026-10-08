-- Create integrations table
CREATE TABLE IF NOT EXISTS integrations (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id VARCHAR REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  display_name VARCHAR NOT NULL,
  category VARCHAR NOT NULL CHECK (category IN ('featured', 'flow', 'helper')),
  status VARCHAR NOT NULL DEFAULT 'not_connected' CHECK (status IN ('connected', 'not_connected', 'error')),
  auth_type VARCHAR NOT NULL DEFAULT 'none' CHECK (auth_type IN ('oauth', 'api_key', 'webhook', 'none')),
  config JSONB,
  credentials JSONB,
  last_sync_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for integrations
CREATE INDEX IF NOT EXISTS idx_integrations_user ON integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_integrations_org ON integrations(organization_id);
CREATE INDEX IF NOT EXISTS idx_integrations_name ON integrations(name);

-- Create integration_oauth_states table
CREATE TABLE IF NOT EXISTS integration_oauth_states (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id VARCHAR REFERENCES organizations(id) ON DELETE CASCADE,
  integration_name VARCHAR NOT NULL,
  state VARCHAR NOT NULL UNIQUE,
  code_verifier VARCHAR,
  redirect_uri VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);

-- Create indexes for oauth states
CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON integration_oauth_states(state);
CREATE INDEX IF NOT EXISTS idx_oauth_states_user ON integration_oauth_states(user_id);

