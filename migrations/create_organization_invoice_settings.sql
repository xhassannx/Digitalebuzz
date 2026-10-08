-- Organization invoice template settings (GST / Non-GST)
-- Matches existing production table shape (id PK, organization_id unique).
CREATE TABLE IF NOT EXISTS organization_invoice_settings (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  gst_signature_url TEXT,
  gst_invoice_prefix VARCHAR,
  gst_invoice_start INTEGER DEFAULT 1,
  gst_percentage INTEGER DEFAULT 18,
  gst_bank_name VARCHAR,
  gst_account_no VARCHAR,
  gst_ifsc_code VARCHAR,
  gst_payment_upi_id VARCHAR,
  gst_email_id VARCHAR,
  gst_terms_and_conditions TEXT,
  non_gst_signature_url TEXT,
  non_gst_invoice_prefix VARCHAR,
  non_gst_invoice_start INTEGER DEFAULT 1,
  non_gst_bank_name VARCHAR,
  non_gst_account_no VARCHAR,
  non_gst_ifsc_code VARCHAR,
  non_gst_payment_upi_id VARCHAR,
  non_gst_email_id VARCHAR,
  non_gst_terms_and_conditions TEXT,
  invoice_currency VARCHAR DEFAULT 'INR',
  hsn_code VARCHAR,
  email_automation BOOLEAN NOT NULL DEFAULT FALSE,
  whatsapp_automation BOOLEAN NOT NULL DEFAULT FALSE,
  selected_template_id INTEGER DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_invoice_settings_org ON organization_invoice_settings(organization_id);
