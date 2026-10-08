-- Snapshot of GET {CUSTOMER_API_BASE_URL}/api/customer (redacted secrets). Read-only on whitelabel panel; updated by sync job only.
-- Single row id = 'singleton'.

CREATE TABLE IF NOT EXISTS platform_master_settings (
  id varchar PRIMARY KEY DEFAULT 'singleton',
  upstream_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  revenue_share_local jsonb,
  last_sync_at timestamptz,
  last_sync_status varchar(32),
  last_sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_master_settings_singleton CHECK (id = 'singleton')
);

INSERT INTO platform_master_settings (id) VALUES ('singleton')
ON CONFLICT (id) DO NOTHING;
