-- Optional custom invoice header banner (default remains /invoice/partner-banner.png).
ALTER TABLE organization_invoice_settings
  ADD COLUMN IF NOT EXISTS invoice_banner_url TEXT;
