-- Technical team transfer fields for support tickets
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS transferred_to_technical BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS transferred_to_technical_at TIMESTAMPTZ;

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS technical_ticket_id VARCHAR;

CREATE INDEX IF NOT EXISTS idx_support_tickets_transferred_technical
  ON support_tickets (transferred_to_technical)
  WHERE transferred_to_technical = true;
