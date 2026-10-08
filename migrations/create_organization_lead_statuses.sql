-- Configurable lead pipeline statuses per organization
CREATE TABLE IF NOT EXISTS organization_lead_statuses (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  slug VARCHAR NOT NULL,
  color VARCHAR NOT NULL DEFAULT '#dbeafe',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_lead_statuses_org_slug ON organization_lead_statuses(organization_id, slug);
CREATE INDEX IF NOT EXISTS idx_org_lead_statuses_sort ON organization_lead_statuses(organization_id, sort_order);
