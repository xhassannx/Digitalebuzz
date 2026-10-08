-- Fix for "column organization_id does not exist" error on messages table
-- This migration ensures no triggers, views, or constraints reference organization_id on messages

-- Drop any triggers that might reference organization_id on messages
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_table = 'messages'
          AND action_statement LIKE '%organization_id%'
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON messages CASCADE';
        RAISE NOTICE 'Dropped trigger: %', r.trigger_name;
    END LOOP;
END $$;

-- Drop any views that might reference messages.organization_id
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT table_name 
        FROM information_schema.views 
        WHERE view_definition LIKE '%messages%organization_id%'
           OR view_definition LIKE '%organization_id%messages%'
    LOOP
        EXECUTE 'DROP VIEW IF EXISTS ' || quote_ident(r.table_name) || ' CASCADE';
        RAISE NOTICE 'Dropped view: %', r.table_name;
    END LOOP;
END $$;

-- Verify messages table doesn't have organization_id column
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'messages' 
          AND column_name = 'organization_id'
    ) THEN
        RAISE EXCEPTION 'messages table has organization_id column - this should not exist!';
    ELSE
        RAISE NOTICE 'Confirmed: messages table does not have organization_id column';
    END IF;
END $$;

