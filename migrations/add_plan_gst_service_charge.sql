-- Plan GST + convenience / service charge columns (SaaS billing)
ALTER TABLE plans ADD COLUMN IF NOT EXISTS gst_type varchar DEFAULT 'inclusive';
ALTER TABLE plans ADD COLUMN IF NOT EXISTS gst_percent integer DEFAULT 0;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS service_charge_percent integer DEFAULT 0;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS service_charge_fixed integer DEFAULT 0;
