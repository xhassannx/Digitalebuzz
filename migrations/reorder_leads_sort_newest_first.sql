-- Reassign sort_order so newest leads appear first in each status column (0 = top).
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY organization_id, status
      ORDER BY created_at DESC
    ) - 1 AS ord
  FROM organization_leads
)
UPDATE organization_leads AS l
SET sort_order = r.ord
FROM ranked AS r
WHERE l.id = r.id;
