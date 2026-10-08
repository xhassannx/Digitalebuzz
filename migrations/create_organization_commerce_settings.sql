-- Organization commerce: Meta catalog + store sync flags
CREATE TABLE IF NOT EXISTS organization_commerce_settings (
  organization_id VARCHAR PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  meta_catalog_id VARCHAR,
  meta_catalog_name VARCHAR,
  shopify_sync_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  woocommerce_sync_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  shopify_last_sync_at TIMESTAMP,
  woocommerce_last_sync_at TIMESTAMP,
  shopify_last_sync_status VARCHAR(32),
  woocommerce_last_sync_status VARCHAR(32),
  shopify_last_sync_error TEXT,
  woocommerce_last_sync_error TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_commerce_meta_catalog ON organization_commerce_settings(meta_catalog_id);
