-- Support ticketing (per organization)

CREATE TABLE IF NOT EXISTS support_tickets (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ticket_number INTEGER NOT NULL,
  access_token VARCHAR NOT NULL UNIQUE,
  subject VARCHAR NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'open',
  customer_email VARCHAR NOT NULL,
  customer_name VARCHAR NOT NULL,
  customer_user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  assigned_to_user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_support_tickets_org_number_unique ON support_tickets(organization_id, ticket_number);
CREATE INDEX IF NOT EXISTS idx_support_tickets_org ON support_tickets(organization_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned ON support_tickets(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_customer_user ON support_tickets(customer_user_id);

CREATE TABLE IF NOT EXISTS support_messages (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id VARCHAR NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  author_type VARCHAR NOT NULL,
  author_user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON support_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_created ON support_messages(created_at);

CREATE TABLE IF NOT EXISTS support_attachments (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id VARCHAR NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  message_id VARCHAR NOT NULL REFERENCES support_messages(id) ON DELETE CASCADE,
  file_name VARCHAR NOT NULL,
  file_path VARCHAR NOT NULL,
  mime_type VARCHAR NOT NULL,
  size_bytes INTEGER NOT NULL,
  uploaded_by VARCHAR NOT NULL,
  uploaded_by_user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_attachments_ticket ON support_attachments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_attachments_message ON support_attachments(message_id);
