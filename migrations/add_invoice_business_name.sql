-- Business / company name shown on generated invoices
ALTER TABLE organization_invoice_settings
  ADD COLUMN IF NOT EXISTS invoice_business_name VARCHAR;
