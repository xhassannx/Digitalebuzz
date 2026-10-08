# Integration Status Not Showing as Connected - Fix

## Issue
After completing the WhatsApp Business Embedded Signup flow, the integration was not showing as "connected" in the UI, even though the backend was setting the status correctly.

## Root Causes

### 1. Missing `userId` Parameter in `updateIntegration` Call
The `updateIntegration` method requires three parameters:
- `id: string` - Integration ID
- `userId: string` - User ID (was missing)
- `data: Partial<InsertIntegration>` - Update data

**Fixed in:** `server/integrations/oauth/whatsapp-business.ts` (line 1855)

**Before:**
```typescript
await storage.updateIntegration(integration.id, {
  status: "connected",
  credentials: credentials,
});
```

**After:**
```typescript
await storage.updateIntegration(integration.id, userId, {
  status: "connected",
  credentials: credentials,
});
```

### 2. Frontend Not Refreshing After Connection
The frontend was invalidating queries but not explicitly refetching them, which could cause a race condition where the UI doesn't update immediately.

**Fixed in:** `client/src/pages/integrations-page.tsx` (lines 299-305)

**Changes:**
- Added explicit `refetchQueries` call after invalidation
- Added redirect to `/connect` page after successful connection
- Added query invalidation for `/api/integrations/whatsapp-business/added-phones`

## How to Find Your Embedded Signup Config ID

The Embedded Signup Config ID (`24760315386893718` in your case) should be obtained from your Meta Dashboard:

### Steps:
1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Select your app (e.g., "Helicoptic Solutions" - App ID: 1452687312416212)
3. Navigate to: **WhatsApp** → **Embedded Signup Builder**
4. In the "Embedded Signup Launch" section, look for:
   - **"Choose a Login Configuration"** dropdown
   - It should show **"ES Config"** or similar
5. The **config_id** is visible in:
   - The dropdown selection
   - The page URL
   - The page source (inspect element)

### Add to `.env`:
```env
EMBEDDED_SIGNUP_CONFIG_ID=24760315386893718
```

**Note:** Replace `24760315386893718` with your actual config_id from the Meta Dashboard.

## Verification

After these fixes:

1. **Backend:** Integration status is correctly set to `"connected"` in the database
2. **Frontend:** Integration status is immediately refreshed and displayed as "connected"
3. **User Experience:** After successful Embedded Signup, user is redirected to `/connect` page where they can see the connected status and manage phone numbers

## Testing

1. Complete the WhatsApp Business Embedded Signup flow
2. Check server logs for: `[Embedded Signup Process] ✅ Updated existing integration` or `✅ Created new integration`
3. Verify the integration shows as "connected" on the integrations page
4. Verify redirect to `/connect` page works correctly
5. Verify phone numbers are listed on the `/connect` page

