-- Check for triggers, views, or functions that might reference organization_id on messages table
-- Run this to diagnose the "column organization_id does not exist" error

-- Check for triggers on messages table
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'messages';

-- Check for views that reference messages table
SELECT 
    table_name,
    view_definition
FROM information_schema.views
WHERE view_definition LIKE '%messages%';

-- Check for functions that might reference messages.organization_id
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines
WHERE routine_definition LIKE '%messages%organization%'
   OR routine_definition LIKE '%organization_id%messages%';

-- Check the actual messages table structure
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'messages'
ORDER BY ordinal_position;

