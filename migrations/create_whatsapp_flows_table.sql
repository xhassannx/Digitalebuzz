-- Create WhatsApp Flows table for managing WhatsApp Business API flows/forms
CREATE TABLE IF NOT EXISTS whatsapp_flows (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id VARCHAR REFERENCES organizations(id) ON DELETE CASCADE,
  flow_id VARCHAR, -- Meta flow ID (if published)
  name VARCHAR NOT NULL,
  business_account_id VARCHAR NOT NULL,
  category VARCHAR DEFAULT 'other',
  status VARCHAR NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  validation VARCHAR NOT NULL DEFAULT 'Valid' CHECK (validation IN ('Valid', 'Invalid')),
  screens JSONB NOT NULL,
  meta_data JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_flows_user ON whatsapp_flows(user_id);
CREATE INDEX IF NOT EXISTS idx_flows_org ON whatsapp_flows(organization_id);
CREATE INDEX IF NOT EXISTS idx_flows_business_account ON whatsapp_flows(business_account_id);
CREATE INDEX IF NOT EXISTS idx_flows_flow_id ON whatsapp_flows(flow_id);

COMMENT ON TABLE whatsapp_flows IS 'Stores WhatsApp Business API flows/forms created by users';

