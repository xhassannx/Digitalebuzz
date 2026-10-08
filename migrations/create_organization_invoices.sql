-- Sent invoices per organization (contact invoices)
CREATE TABLE IF NOT EXISTS organization_invoices (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id VARCHAR REFERENCES managed_contacts(id) ON DELETE SET NULL,
  invoice_no VARCHAR NOT NULL,
  company_name VARCHAR,
  customer_name VARCHAR,
  customer_phone VARCHAR,
  customer_email VARCHAR,
  invoice_date TIMESTAMP NOT NULL DEFAULT NOW(),
  gst_type VARCHAR,
  invoice_status VARCHAR DEFAULT 'due',
  currency VARCHAR DEFAULT 'INR',
  total_amount REAL,
  amount_paid REAL,
  amount_pending REAL,
  pdf_url TEXT,
  line_items JSONB,
  invoice_to JSONB,
  email_automation BOOLEAN NOT NULL DEFAULT FALSE,
  whatsapp_automation BOOLEAN NOT NULL DEFAULT FALSE,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  created_by_name VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_invoices_org ON organization_invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_invoices_date ON organization_invoices(organization_id, invoice_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_invoices_org_no ON organization_invoices(organization_id, invoice_no);
