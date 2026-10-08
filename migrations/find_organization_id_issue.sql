-- Find the source of "column organization_id does not exist" error
-- Run this in your PostgreSQL database

-- 1. Check for triggers on messages table
SELECT 
    t.trigger_name,
    t.event_manipulation,
    t.event_object_table,
    t.action_timing,
    t.action_statement
FROM information_schema.triggers t
WHERE t.event_object_table = 'messages';

-- 2. Check trigger function code (if triggers exist)
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_trigger pt ON pt.tgfoid = p.oid
JOIN pg_class pc ON pc.oid = pt.tgrelid
WHERE pc.relname = 'messages';

-- 3. Check for views that reference messages and organization_id
SELECT 
    table_name,
    view_definition
FROM information_schema.views
WHERE view_definition LIKE '%messages%'
  AND (view_definition LIKE '%organization_id%' 
       OR view_definition LIKE '%organizationId%');

-- 4. Check for any constraints that might reference organization_id
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'messages'::regclass
  AND pg_get_constraintdef(oid) LIKE '%organization%';

-- 5. List all columns in messages table (final check)
SELECT 
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'messages'
ORDER BY ordinal_position;

