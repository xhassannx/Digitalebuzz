-- Signature image display size (pixels) for GST and Non-GST invoices
ALTER TABLE organization_invoice_settings
  ADD COLUMN IF NOT EXISTS gst_signature_size_px INTEGER DEFAULT 48;

ALTER TABLE organization_invoice_settings
  ADD COLUMN IF NOT EXISTS non_gst_signature_size_px INTEGER DEFAULT 48;
