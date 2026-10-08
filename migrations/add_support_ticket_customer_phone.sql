ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(32);
