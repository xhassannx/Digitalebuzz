# Contact Source Management Guide

This guide explains how contact sources work in the application and how to add new sync sources.

## Overview

The `managed_contacts` table now includes a `source` field that tracks where each contact came from. This allows you to:
- Filter contacts by source (e.g., show only WhatsApp contacts, Facebook leads, etc.)
- Track which integration/sync created each contact
- Maintain data lineage for contacts

## Supported Sources

### Current Sources

1. **`manual`** (default)
   - Contacts created manually by users
   - Default value for backward compatibility

2. **`whatsapp`**
   - Contacts created when a new phone number sends a WhatsApp message
   - Automatically set when messages are received from new numbers

3. **`facebook`**
   - Contacts synced from Facebook Lead Ads
   - Automatically set when leads are synced via the Facebook Lead Ads integration

### Future Sources

You can easily add more sources as needed:
- `import` - For CSV/Excel imports
- `api` - For API-created contacts
- `indiamart` - For IndiaMart integration
- `google_ads` - For Google Ads leads
- `linkedin` - For LinkedIn leads
- Any custom source name you need

## How It Works

### 1. WhatsApp Messages

When a new phone number sends a WhatsApp message:

```typescript
// In server/whatsapp/business-api-client.ts
await storage.createManagedContact({
  userId: session.userId,
  organizationId: session.organizationId || undefined,
  name: contactDisplayName,
  phoneNumber: phoneForManaged,
  source: 'whatsapp', // ✅ Automatically set
});
```

### 2. Facebook Lead Ads

When Facebook leads are synced:

```typescript
// In server/integrations/handlers/facebook-leads.ts
await storage.createManagedContact({
  userId,
  organizationId: organizationId || undefined,
  name,
  phoneNumber: phoneNumber || email || 'N/A',
  email: email || undefined,
  source: 'facebook', // ✅ Automatically set
  customFields,
  notes: `Synced from Facebook Lead Ads...`,
});
```

### 3. Manual Contacts

When users create contacts manually (via UI or API):

```typescript
// Default source is 'manual' if not specified
await storage.createManagedContact({
  userId,
  organizationId,
  name: 'John Doe',
  phoneNumber: '1234567890',
  // source: 'manual' (default)
});
```

## Adding a New Sync Source

To add a new sync source (e.g., IndiaMart, Google Ads, etc.):

### Step 1: Update the Schema (if needed)

The `source` field is already a `VARCHAR`, so it can accept any string value. No schema changes needed.

### Step 2: Set Source When Creating Contacts

In your sync/integration handler:

```typescript
// Example: IndiaMart integration
await storage.createManagedContact({
  userId,
  organizationId,
  name: contactName,
  phoneNumber: phoneNumber,
  email: email,
  source: 'indiamart', // ✅ Set your source name here
  customFields: {
    indiamart_lead_id: leadId,
    // ... other fields
  },
});
```

### Step 3: Update Existing Contacts (if needed)

If you're updating existing contacts:

```typescript
await storage.updateManagedContact(
  contactId,
  userId,
  organizationId,
  {
    source: 'indiamart', // ✅ Update source
    // ... other fields
  }
);
```

## Querying Contacts by Source

### In Database

```sql
-- Get all WhatsApp contacts
SELECT * FROM managed_contacts WHERE source = 'whatsapp';

-- Get all Facebook leads
SELECT * FROM managed_contacts WHERE source = 'facebook';

-- Get all contacts except manual
SELECT * FROM managed_contacts WHERE source != 'manual';

-- Count contacts by source
SELECT source, COUNT(*) as count 
FROM managed_contacts 
GROUP BY source;
```

### In Code

```typescript
// Get all contacts for a user
const allContacts = await storage.getManagedContactsByUser(userId, organizationId);

// Filter by source
const whatsappContacts = allContacts.filter(c => c.source === 'whatsapp');
const facebookContacts = allContacts.filter(c => c.source === 'facebook');
```

## Migration

If you need to backfill existing contacts with sources:

```sql
-- Backfill WhatsApp contacts
UPDATE managed_contacts 
SET source = 'whatsapp' 
WHERE source IS NULL 
  AND phone_number IN (
    SELECT DISTINCT number 
    FROM contacts 
    WHERE session_id IN (
      SELECT session_id 
      FROM whatsapp_sessions 
      WHERE connection_type = 'official'
    )
  );

-- Backfill Facebook leads
UPDATE managed_contacts 
SET source = 'facebook' 
WHERE source IS NULL 
  AND custom_fields::text LIKE '%facebook_lead_id%';
```

## Best Practices

1. **Always set source when creating contacts from syncs**
   - Don't rely on defaults for synced contacts
   - Use descriptive source names (e.g., `facebook`, `whatsapp`, `indiamart`)

2. **Update source when syncing existing contacts**
   - If a contact already exists and is synced from a new source, update the source
   - This maintains accurate data lineage

3. **Use consistent naming**
   - Use lowercase, underscore format (e.g., `facebook`, `whatsapp`, `google_ads`)
   - Avoid spaces and special characters

4. **Handle source conflicts**
   - If a contact exists from multiple sources, you may want to:
     - Keep the first source
     - Update to the most recent source
     - Store multiple sources in `customFields`

## Frontend Display

You can display the source in the UI:

```typescript
// In your contact list component
const getSourceBadge = (source: string) => {
  const badges = {
    'whatsapp': { label: 'WhatsApp', color: 'green' },
    'facebook': { label: 'Facebook', color: 'blue' },
    'manual': { label: 'Manual', color: 'gray' },
    // Add more as needed
  };
  return badges[source] || { label: source, color: 'gray' };
};
```

## Troubleshooting

### Issue: Contacts don't have source set

**Solution:**
- Check that your sync/integration code sets `source` when creating contacts
- Run the migration to add the `source` column if not already done
- Backfill existing contacts using the SQL queries above

### Issue: Source is always 'manual'

**Solution:**
- Verify that `source` is being set in your integration handler
- Check that the `source` field is included in the `createManagedContact` call
- Ensure the migration has been run

### Issue: Need to change source for existing contacts

**Solution:**
- Use SQL UPDATE queries to change sources in bulk
- Or update via the API/UI if needed

---

## Summary

The `source` field provides a simple way to track where contacts came from. By setting it consistently across all sync sources, you can:
- ✅ Filter and segment contacts by source
- ✅ Track data lineage
- ✅ Generate reports by source
- ✅ Improve contact management

Make sure to set `source` whenever you create or sync contacts from any integration!

