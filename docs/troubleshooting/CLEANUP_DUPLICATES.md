# Cleanup Duplicate Chats and Contacts

This guide helps you clean up duplicate chats and contacts that were created due to phone number format inconsistencies.

## Problem

When phone numbers were stored in different formats (e.g., `919179388646` vs `919179388646@c.us`), the system created duplicate chats and contacts for the same phone number. This caused messages to appear in the wrong chat.

## Solution

We've fixed the code to normalize phone numbers before comparison. Now you need to clean up existing duplicates in your database.

## Cleanup Options

### Option 1: SQL Script (Recommended for Production)

Run the SQL migration script directly in your database:

```bash
# PostgreSQL
psql -d your_database_name -f migrations/cleanup_duplicate_chats.sql

# Or using your database connection string
psql $DATABASE_URL -f migrations/cleanup_duplicate_chats.sql
```

**What it does:**
- Creates a normalization function
- Merges duplicate contacts (keeps the oldest, moves all chats to it)
- Merges duplicate chats (keeps the oldest, moves all messages to it)
- Updates contact names to use the best available name
- Normalizes phone number formats (adds `@c.us` suffix where needed)
- Provides a summary of what was cleaned up

### Option 2: TypeScript Script (For Development)

Run the TypeScript cleanup script:

```bash
npx tsx scripts/cleanup-duplicates.ts
```

**What it does:**
- Same as SQL script but uses Drizzle ORM
- Provides detailed console output
- Shows progress as it processes duplicates

## What Gets Merged

1. **Duplicate Contacts**: Multiple contacts with the same normalized phone number in the same session
   - Keeps: The contact with the oldest ID
   - Merges: All chats are moved to the kept contact
   - Deletes: Duplicate contacts

2. **Duplicate Chats**: Multiple chats with the same normalized phone number in the same session
   - Keeps: The chat with the oldest ID
   - Merges: All messages are moved to the kept chat
   - Deletes: Duplicate chats

3. **Phone Number Normalization**: Ensures all numbers have consistent format
   - Adds `@c.us` suffix to individual contacts/chats
   - Preserves `@g.us` suffix for groups

## After Cleanup

1. **Test sending a message** - It should appear in the correct chat
2. **Check your chat list** - You should see only one chat per phone number
3. **Verify contact names** - Names should be preserved from the best source

## Rollback

If something goes wrong, you can restore from a database backup. The cleanup script doesn't delete any messages, only merges them into the correct chats.

## Verification

After running cleanup, verify with these queries:

```sql
-- Check for remaining duplicate contacts
SELECT 
  normalize_phone(number) as normalized,
  session_id,
  COUNT(*) as count
FROM contacts
GROUP BY normalize_phone(number), session_id
HAVING COUNT(*) > 1;

-- Check for remaining duplicate chats
SELECT 
  normalize_phone(contact_number) as normalized,
  session_id,
  COUNT(*) as count
FROM chats
GROUP BY normalize_phone(contact_number), session_id
HAVING COUNT(*) > 1;
```

If both queries return no rows, cleanup was successful!

