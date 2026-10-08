-- Check for any triggers on the messages table that might reference organization_id
-- Run this in your PostgreSQL database

-- 1. Check for triggers on messages table
SELECT 
    t.trigger_name,
    t.event_manipulation,
    t.event_object_table,
    t.action_timing,
    t.action_statement,
    p.proname as function_name
FROM information_schema.triggers t
LEFT JOIN pg_trigger pt ON pt.tgname = t.trigger_name
LEFT JOIN pg_proc p ON p.oid = pt.tgfoid
WHERE t.event_object_table = 'messages';

-- 2. Check the actual trigger function code if triggers exist
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_trigger pt ON pt.tgfoid = p.oid
JOIN pg_class pc ON pc.oid = pt.tgrelid
WHERE pc.relname = 'messages'
  AND (pg_get_functiondef(p.oid) LIKE '%organization_id%' 
       OR pg_get_functiondef(p.oid) LIKE '%organizationId%');

-- 3. Check for views that reference messages
SELECT 
    table_name,
    view_definition
FROM information_schema.views
WHERE view_definition LIKE '%messages%'
  AND (view_definition LIKE '%organization_id%' 
       OR view_definition LIKE '%organizationId%');

-- 4. List all columns in messages table (double-check)
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'messages'
ORDER BY ordinal_position;

