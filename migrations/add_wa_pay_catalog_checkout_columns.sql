-- WA Pay: catalog cart → in-WhatsApp review_and_pay checkout
ALTER TABLE organization_commerce_settings
  ADD COLUMN IF NOT EXISTS wa_pay_catalog_checkout_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE organization_commerce_settings
  ADD COLUMN IF NOT EXISTS wa_pay_order_type VARCHAR(32) NOT NULL DEFAULT 'physical-goods';

ALTER TABLE organization_commerce_settings
  ADD COLUMN IF NOT EXISTS last_wa_pay_checkout_at TIMESTAMP;

ALTER TABLE organization_commerce_settings
  ADD COLUMN IF NOT EXISTS last_wa_pay_checkout_status VARCHAR(32);

ALTER TABLE organization_commerce_settings
  ADD COLUMN IF NOT EXISTS last_wa_pay_checkout_error TEXT;
