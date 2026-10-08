-- Contact payment links (Razorpay / Cashfree) — run on deploy if not using drizzle push
CREATE TABLE IF NOT EXISTS contact_payment_requests (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(64) NOT NULL UNIQUE,
  organization_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  integration_id VARCHAR REFERENCES integrations(id) ON DELETE SET NULL,
  contact_id VARCHAR REFERENCES managed_contacts(id) ON DELETE SET NULL,
  gateway VARCHAR(32) NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  gateway_link_id VARCHAR(255),
  gateway_payment_id VARCHAR(255),
  short_url TEXT,
  customer_phone VARCHAR(32),
  description TEXT,
  whatsapp_session_id VARCHAR(128),
  metadata JSONB,
  paid_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_payment_req_org ON contact_payment_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_contact_payment_req_gateway_link ON contact_payment_requests(gateway, gateway_link_id);
