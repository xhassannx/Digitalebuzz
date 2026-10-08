-- Add template and tracking fields to messages table
-- This migration adds support for WhatsApp Business API template messages and status tracking

-- Add WhatsApp Business API fields
ALTER TABLE messages ADD COLUMN IF NOT EXISTS whatsapp_message_id VARCHAR;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS campaign_id VARCHAR;

-- Add status timestamps
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMP;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS failed_at TIMESTAMP;

-- Add error tracking
ALTER TABLE messages ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS error_code VARCHAR;

-- Add template message fields
ALTER TABLE messages ADD COLUMN IF NOT EXISTS template_name VARCHAR;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS template_language VARCHAR;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS template_type VARCHAR CHECK (template_type IN ('TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT') OR template_type IS NULL);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS header_text TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS template_params JSONB;

-- Older DBs may use PG enums; current schema uses varchar (no enum type).
-- Only ADD VALUE when the type exists (Neon/PG12+ allows this inside a DO block).
DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'messages_type_enum') THEN
    ALTER TYPE messages_type_enum ADD VALUE IF NOT EXISTS 'template';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'messages_status_enum') THEN
    ALTER TYPE messages_status_enum ADD VALUE IF NOT EXISTS 'failed';
  END IF;
END
$migration$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_messages_whatsapp_id ON messages(whatsapp_message_id);
CREATE INDEX IF NOT EXISTS idx_messages_campaign ON messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);

-- Add foreign key constraint for campaign_id (if campaigns table exists)
DO $$
BEGIN
    ALTER TABLE messages
    ADD CONSTRAINT fk_messages_campaign
    FOREIGN KEY (campaign_id)
    REFERENCES campaigns(id)
    ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
END $$;

