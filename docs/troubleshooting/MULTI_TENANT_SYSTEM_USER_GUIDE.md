# Multi-Tenant System User Guide

## 🎯 Overview

This SaaS product supports **multiple tenants**, each with their own Facebook Business Manager account. Unlike single-tenant setups, we **cannot** use a single global System User token for all tenants.

## ✅ How It Works (Multi-Tenant)

### Current Implementation

1. **Uses User Access Token by Default**
   - The OAuth callback uses the **user's access token** to subscribe the app to WABA
   - This works for **most cases** and doesn't require any additional configuration
   - Each tenant's token is automatically used for their own WABA

2. **Optional: Per-Tenant System User Token**
   - If a tenant wants to use their own System User token, they can provide it
   - Stored in integration `credentials` as `system_user_token` and `system_user_id`
   - Only used for that specific tenant's WABA

3. **System User Assignment**
   - **Optional** - Usually not required
   - Each tenant manages their own System User in their Business Manager
   - Can be done manually or automatically if system user token is provided

## 🔧 How to Configure (Per Tenant - Optional)

### Option 1: Use User Access Token (Default - Recommended)

**No configuration needed!** The system automatically uses the user's access token from OAuth.

✅ **Pros:**
- Works immediately after OAuth
- No additional setup required
- Each tenant uses their own token automatically

⚠️ **Cons:**
- May not work if user token doesn't have `whatsapp_business_management` permission
- Some edge cases may require System User token

### Option 2: Provide System User Token (Advanced)

If a tenant wants to use their own System User token:

1. **Get System User Token from Meta Business Manager:**
   - Go to Meta Business Manager → Business Settings → System Users
   - Select System User (or create one)
   - Click "Generate New Token"
   - Select permissions: `whatsapp_business_management`, `whatsapp_business_messaging`
   - Copy the token and System User ID

2. **Store in Integration Credentials:**
   ```json
   {
     "access_token": "EAAG...",
     "expires_at": 1735689600000,
     "system_user_token": "EAAG...",  // Optional
     "system_user_id": "123456789"     // Optional
   }
   ```

3. **Implementation:**
   - Add UI in integration settings to let users provide their System User token
   - Store in `integration.credentials.system_user_token`
   - System will automatically use it for subscription and assignment

## 📋 What Happens During OAuth

### Step 1: OAuth Callback
1. User completes OAuth → Gets access token
2. System fetches phone numbers/WABAs using user's token
3. System subscribes app to WABA using:
   - User's system token (if provided in credentials)
   - OR user's access token (default)

### Step 2: App Subscription
```
POST /{WABA_ID}/subscribed_apps
Authorization: Bearer {user_token or system_token}
```

### Step 3: System User Assignment (Optional)
```
POST /{WABA_ID}/assigned_users
Authorization: Bearer {system_token}
Body: { user: "{system_user_id}", role: "ADMIN" }
```

### Step 4: Test Message
```
POST /{PHONE_NUMBER_ID}/messages
Authorization: Bearer {user_token}
```

## 🎯 Why This Works for Multi-Tenant

1. **No Global Configuration**
   - No need for `META_SYSTEM_USER_TOKEN` in `.env`
   - Each tenant uses their own token automatically

2. **Per-Tenant Isolation**
   - Each tenant's WABA is subscribed using their own token
   - No cross-tenant access issues

3. **Flexible**
   - Works with user token (default)
   - Can optionally use system token per tenant
   - System User assignment is optional

## 🔍 Troubleshooting

### Phone Numbers Still PENDING

**Check:**
1. Server logs for subscription success:
   ```
   [WhatsApp OAuth] ✅ App subscribed to WABA {wabaId} successfully
   ```

2. If subscription fails:
   - Check error code in logs
   - Ensure user token has `whatsapp_business_management` permission
   - Try providing System User token in integration settings

### Subscription Fails with User Token

**Solution:**
1. User provides System User token in integration settings
2. Or ensure user token has Advanced Access permissions:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`

### System User Assignment Needed

**When:**
- Subscription works but phone numbers still PENDING
- User wants to use System User for better permissions

**How:**
1. User goes to their Business Manager
2. Business Settings → System Users
3. Assign System User to WABA and Phone Number
4. (Optional) Provide System User token in integration settings for automatic assignment

## 📝 Implementation Notes

### Current Code Behavior

```typescript
// OAuth Callback
const integrationCredentials = existing?.credentials as any || {};
const userSystemToken = integrationCredentials.system_user_token;
const tokenForSubscription = userSystemToken || accessToken; // Use user token by default

// Subscribe to WABA
POST /{wabaId}/subscribed_apps
Authorization: Bearer {tokenForSubscription}
```

### Future Enhancement: UI for System User Token

Add to integration settings page:
```tsx
<Input
  label="System User Token (Optional)"
  type="password"
  value={systemUserToken}
  onChange={(e) => setSystemUserToken(e.target.value)}
  helperText="Get from Business Manager → System Users → Generate Token"
/>
```

## ✅ Summary

- ✅ **No `.env` configuration needed** - Works out of the box
- ✅ **Uses user's access token** - Each tenant automatically uses their own
- ✅ **Optional System User token** - Can be provided per tenant if needed
- ✅ **Multi-tenant friendly** - No global tokens, per-tenant isolation
- ✅ **Works for most cases** - User token subscription usually sufficient

The system is designed to work **without** any System User token configuration, using each tenant's OAuth token automatically. System User token is only needed for edge cases or advanced scenarios.

