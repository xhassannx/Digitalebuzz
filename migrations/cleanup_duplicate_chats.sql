-- Cleanup script to merge duplicate chats and contacts for the same phone number
-- This script normalizes phone numbers and merges duplicates

-- Step 1: Create a function to normalize phone numbers
CREATE OR REPLACE FUNCTION normalize_phone(phone_number TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Remove @c.us, @g.us suffixes and + prefix
  RETURN TRIM(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(phone_number, '@c\.us$', '', 'i'), '@g\.us$', '', 'i'), '^\+', ''));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 2: Find and merge duplicate contacts
-- First, identify duplicate contacts (same normalized number, same session)
DO $$
DECLARE
  contact_record RECORD;
  target_contact_id VARCHAR;
  duplicate_contact_ids VARCHAR[];
BEGIN
  -- Group contacts by normalized number and session
  FOR contact_record IN
    SELECT 
      normalize_phone(c.number) as normalized_number,
      c.session_id,
      MIN(c.id) as keep_contact_id,
      ARRAY_AGG(c.id ORDER BY c.id) as all_contact_ids
    FROM contacts c
    GROUP BY normalize_phone(c.number), c.session_id
    HAVING COUNT(*) > 1
  LOOP
    -- Keep the first contact (oldest ID), merge others into it
    target_contact_id := contact_record.keep_contact_id;
    duplicate_contact_ids := contact_record.all_contact_ids[2:]; -- Skip first one
    
    -- Update all chats to use the target contact
    UPDATE chats 
    SET contact_id = target_contact_id 
    WHERE contact_id = ANY(duplicate_contact_ids);
    
    -- Delete duplicate contacts
    DELETE FROM contacts 
    WHERE id = ANY(duplicate_contact_ids);
    
    RAISE NOTICE 'Merged % duplicate contacts into contact %', 
      array_length(duplicate_contact_ids, 1), 
      target_contact_id;
  END LOOP;
END $$;

-- Step 3: Find and merge duplicate chats
DO $$
DECLARE
  chat_record RECORD;
  target_chat_id VARCHAR;
  duplicate_chat_ids VARCHAR[];
BEGIN
  -- Group chats by normalized contact number and session
  FOR chat_record IN
    SELECT 
      normalize_phone(c.contact_number) as normalized_number,
      c.session_id,
      MIN(c.id) as keep_chat_id,
      ARRAY_AGG(c.id ORDER BY c.id) as all_chat_ids
    FROM chats c
    GROUP BY normalize_phone(c.contact_number), c.session_id
    HAVING COUNT(*) > 1
  LOOP
    -- Keep the first chat (oldest ID), merge others into it
    target_chat_id := chat_record.keep_chat_id;
    duplicate_chat_ids := chat_record.all_chat_ids[2:]; -- Skip first one
    
    -- Update all messages to use the target chat
    UPDATE messages 
    SET chat_id = target_chat_id 
    WHERE chat_id = ANY(duplicate_chat_ids);
    
    -- Delete duplicate chats
    DELETE FROM chats 
    WHERE id = ANY(duplicate_chat_ids);
    
    RAISE NOTICE 'Merged % duplicate chats into chat %', 
      array_length(duplicate_chat_ids, 1), 
      target_chat_id;
  END LOOP;
END $$;

-- Step 4: Update contact names to use the best available name
-- If a contact has a proper name (not just a number), use it
UPDATE contacts c1
SET name = (
  SELECT c2.name 
  FROM contacts c2 
  WHERE normalize_phone(c2.number) = normalize_phone(c1.number)
    AND c2.session_id = c1.session_id
    AND c2.name != normalize_phone(c2.number) -- Has a real name
  ORDER BY LENGTH(c2.name) DESC -- Prefer longer names (usually more descriptive)
  LIMIT 1
)
WHERE c1.name = normalize_phone(c1.number); -- Only update if name is just the number

-- Step 5: Update chat contact names to match their contact
UPDATE chats c
SET contact_name = (
  SELECT co.name 
  FROM contacts co 
  WHERE co.id = c.contact_id
)
WHERE c.contact_id IS NOT NULL;

-- Step 6: Ensure all contact numbers have @c.us suffix (for consistency)
UPDATE contacts
SET number = number || '@c.us'
WHERE number NOT LIKE '%@c.us' 
  AND number NOT LIKE '%@g.us'
  AND is_group = false;

-- Step 7: Ensure all chat contact numbers have @c.us suffix (for consistency)
UPDATE chats
SET contact_number = contact_number || '@c.us'
WHERE contact_number NOT LIKE '%@c.us' 
  AND contact_number NOT LIKE '%@g.us'
  AND is_group = false;

-- Step 8: Drop the temporary function
DROP FUNCTION IF EXISTS normalize_phone(TEXT);

-- Summary
SELECT 
  'Cleanup complete!' as status,
  (SELECT COUNT(*) FROM contacts) as total_contacts,
  (SELECT COUNT(*) FROM chats) as total_chats,
  (SELECT COUNT(DISTINCT normalize_phone(number)) FROM contacts) as unique_contact_numbers,
  (SELECT COUNT(DISTINCT normalize_phone(contact_number)) FROM chats) as unique_chat_numbers;

