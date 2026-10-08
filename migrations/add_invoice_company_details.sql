-- Seller / company details shown in "Invoice From" on PDFs
ALTER TABLE organization_invoice_settings
  ADD COLUMN IF NOT EXISTS invoice_company_address TEXT,
  ADD COLUMN IF NOT EXISTS invoice_company_phone VARCHAR,
  ADD COLUMN IF NOT EXISTS invoice_company_gst_no VARCHAR;
