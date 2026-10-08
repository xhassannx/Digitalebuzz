-- Organization leads (first-time inbound WhatsApp messages + manual/import)
CREATE TABLE IF NOT EXISTS organization_leads (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  phone_number VARCHAR NOT NULL,
  name VARCHAR,
  email VARCHAR,
  source VARCHAR NOT NULL DEFAULT 'whatsapp',
  category VARCHAR,
  score INTEGER NOT NULL DEFAULT 50,
  priority VARCHAR NOT NULL DEFAULT 'medium',
  status VARCHAR NOT NULL DEFAULT 'new',
  assigned_to_user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  contact_id VARCHAR REFERENCES managed_contacts(id) ON DELETE SET NULL,
  session_id VARCHAR,
  first_message_preview TEXT,
  converted_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_leads_org_phone ON organization_leads(organization_id, phone_number);
CREATE INDEX IF NOT EXISTS idx_org_leads_org_created ON organization_leads(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_leads_status ON organization_leads(organization_id, status);
