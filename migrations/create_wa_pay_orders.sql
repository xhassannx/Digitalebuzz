-- WA Pay order tracking (catalog cart → order_details → payment webhooks)
CREATE TABLE IF NOT EXISTS wa_pay_orders (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id VARCHAR NOT NULL,
  customer_wa_id VARCHAR(64) NOT NULL,
  reference_id VARCHAR(35) NOT NULL,
  payment_configuration_name VARCHAR(128) NOT NULL,
  payment_gateway VARCHAR(32) NOT NULL DEFAULT 'razorpay',
  order_type VARCHAR(32) NOT NULL DEFAULT 'physical-goods',
  catalog_id VARCHAR(64),
  amount_minor INTEGER NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  payment_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  order_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  order_details_message_id VARCHAR(255),
  pg_order_id VARCHAR(255),
  pg_transaction_id VARCHAR(255),
  payment_method VARCHAR(32),
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_payment_payload JSONB,
  paid_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_pay_orders_reference ON wa_pay_orders(organization_id, reference_id);
CREATE INDEX IF NOT EXISTS idx_wa_pay_orders_org_created ON wa_pay_orders(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_pay_orders_session ON wa_pay_orders(session_id);
