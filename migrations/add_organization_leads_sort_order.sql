ALTER TABLE organization_leads
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_org_leads_status_sort
  ON organization_leads(organization_id, status, sort_order);

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY organization_id, status
      ORDER BY created_at ASC
    ) - 1 AS ord
  FROM organization_leads
)
UPDATE organization_leads AS l
SET sort_order = r.ord
FROM ranked AS r
WHERE l.id = r.id;
