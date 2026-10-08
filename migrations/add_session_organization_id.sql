-- Scope WhatsApp sessions to an organization so reseller/org data stays isolated.
ALTER TABLE whatsapp_sessions
ADD COLUMN IF NOT EXISTS organization_id VARCHAR;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_whatsapp_sessions_organization'
  ) THEN
    ALTER TABLE whatsapp_sessions
      ADD CONSTRAINT fk_whatsapp_sessions_organization
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Backfill: prefer the membership where the user is owner/admin, then earliest join.
UPDATE whatsapp_sessions s
SET organization_id = sub.org_id
FROM (
  SELECT DISTINCT ON (om.user_id)
    om.user_id,
    om.organization_id AS org_id
  FROM organization_members om
  ORDER BY
    om.user_id,
    CASE om.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
    om.joined_at ASC
) sub
WHERE s.organization_id IS NULL
  AND s.user_id = sub.user_id;

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_org
  ON whatsapp_sessions(organization_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_org_status
  ON whatsapp_sessions(organization_id, status)
  WHERE deleted_at IS NULL;
