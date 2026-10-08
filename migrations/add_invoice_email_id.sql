-- Business email shown on GST / Non-GST invoices
ALTER TABLE organization_invoice_settings
  ADD COLUMN IF NOT EXISTS gst_email_id VARCHAR;

ALTER TABLE organization_invoice_settings
  ADD COLUMN IF NOT EXISTS non_gst_email_id VARCHAR;
