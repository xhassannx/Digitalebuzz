-- Automation flows table (flow builder / workflow automation)
CREATE TABLE IF NOT EXISTS automation_flows (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id VARCHAR REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'draft')),
  nodes JSONB DEFAULT '[]',
  edges JSONB DEFAULT '[]',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_flows_user ON automation_flows(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_flows_org ON automation_flows(organization_id);
CREATE INDEX IF NOT EXISTS idx_automation_flows_status ON automation_flows(status);
