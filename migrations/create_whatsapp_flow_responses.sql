CREATE TABLE IF NOT EXISTS whatsapp_flow_responses (
  id VARCHAR PRIMARY KEY,
  flow_id VARCHAR REFERENCES whatsapp_flows(id) ON DELETE SET NULL,
  organization_id VARCHAR REFERENCES organizations(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id VARCHAR,
  phone VARCHAR NOT NULL,
  flow_name VARCHAR,
  response_data JSONB NOT NULL DEFAULT '{}',
  whatsapp_message_id VARCHAR,
  submitted_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flow_responses_flow ON whatsapp_flow_responses(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_responses_org ON whatsapp_flow_responses(organization_id);
CREATE INDEX IF NOT EXISTS idx_flow_responses_phone ON whatsapp_flow_responses(phone);
CREATE INDEX IF NOT EXISTS idx_flow_responses_submitted ON whatsapp_flow_responses(submitted_at);
