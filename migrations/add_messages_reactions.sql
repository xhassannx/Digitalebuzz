-- Add reactions column to messages table for storing emoji reactions (from me and from contacts)
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS reactions jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN messages.reactions IS 'Array of { emoji: string, fromMe: boolean } - one entry per participant (latest reaction wins)';
