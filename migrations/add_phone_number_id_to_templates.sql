-- Add phone_number_id column to message_templates table
ALTER TABLE message_templates 
ADD COLUMN IF NOT EXISTS phone_number_id VARCHAR;

-- Create index for phone_number_id
CREATE INDEX IF NOT EXISTS idx_templates_phone_number_id ON message_templates(phone_number_id);

