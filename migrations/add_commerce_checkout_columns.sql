-- WA cart → store checkout toggles + last checkout attempt
ALTER TABLE organization_commerce_settings
  ADD COLUMN IF NOT EXISTS shopify_checkout_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE organization_commerce_settings
  ADD COLUMN IF NOT EXISTS woocommerce_checkout_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE organization_commerce_settings
  ADD COLUMN IF NOT EXISTS last_cart_checkout_at TIMESTAMP;

ALTER TABLE organization_commerce_settings
  ADD COLUMN IF NOT EXISTS last_cart_checkout_status VARCHAR(32);

ALTER TABLE organization_commerce_settings
  ADD COLUMN IF NOT EXISTS last_cart_checkout_error TEXT;
