-- Extended lead form fields (CRM-style add lead)
ALTER TABLE organization_leads ADD COLUMN IF NOT EXISTS company_name VARCHAR;
ALTER TABLE organization_leads ADD COLUMN IF NOT EXISTS lead_date TIMESTAMP;
ALTER TABLE organization_leads ADD COLUMN IF NOT EXISTS label VARCHAR;
ALTER TABLE organization_leads ADD COLUMN IF NOT EXISTS estimate_amount REAL;
ALTER TABLE organization_leads ADD COLUMN IF NOT EXISTS reference VARCHAR;
ALTER TABLE organization_leads ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE organization_leads ADD COLUMN IF NOT EXISTS comment TEXT;
