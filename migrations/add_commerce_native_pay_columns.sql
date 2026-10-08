-- WhatsApp native in-chat pay + collection merchandising metadata
ALTER TABLE organization_commerce_settings
  ADD COLUMN IF NOT EXISTS whatsapp_native_pay_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE organization_commerce_settings
  ADD COLUMN IF NOT EXISTS meta_payment_configuration_name VARCHAR(128);

ALTER TABLE organization_commerce_settings
  ADD COLUMN IF NOT EXISTS meta_payment_gateway VARCHAR(32) DEFAULT 'razorpay';

ALTER TABLE organization_commerce_settings
  ADD COLUMN IF NOT EXISTS shopify_collection_product_sets JSONB DEFAULT '{}'::jsonb;
