-- Migration: Add footer and button columns to messages table
-- Date: 2025-01-XX
-- Description: Adds columns to store footer text and button information separately from message body

-- Add footer column
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS footer TEXT;

-- Add footer button type column (enum: NONE, QUICK_REPLY, URL, PHONE_NUMBER)
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS footer_button_type VARCHAR(20) CHECK (footer_button_type IN ('NONE', 'QUICK_REPLY', 'URL', 'PHONE_NUMBER'));

-- Add footer button text column
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS footer_button_text TEXT;

-- Add footer button URL column
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS footer_button_url TEXT;

-- Add footer button phone column
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS footer_button_phone VARCHAR(50);

-- Add comments for documentation
COMMENT ON COLUMN messages.footer IS 'Footer text appended to the message';
COMMENT ON COLUMN messages.footer_button_type IS 'Type of button in footer: NONE, QUICK_REPLY, URL, or PHONE_NUMBER';
COMMENT ON COLUMN messages.footer_button_text IS 'Text displayed on the footer button';
COMMENT ON COLUMN messages.footer_button_url IS 'URL for URL-type footer buttons';
COMMENT ON COLUMN messages.footer_button_phone IS 'Phone number for PHONE_NUMBER-type footer buttons';

