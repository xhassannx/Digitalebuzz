# Whitelabel: Numbers Not Showing on Connect Page After OAuth

## Problem

- OAuth flow completes successfully
- Integrations page shows WhatsApp Business as **connected**
- Connect page (e.g. https://digitalebuzz.com/connect) shows **no phone numbers**
- PM2 logs show errors like:
  - `(#200) You do not have permission to access this field`
  - `(#100) Missing Permission`
  - `Failed to fetch phone numbers for WABA`
  - `Failed to subscribe app to WABA`

## Root Cause

The **Facebook App** used by your whitelabel customer (their Client ID, Secret, Embedded Config) does not have sufficient permissions to:

1. **Fetch phone numbers** from the WhatsApp Business Account (WABA)
2. **Subscribe the app** to the WABA (required for numbers to show as CONNECTED)

The OAuth token is valid and can see the WABA ID in granular scopes, but cannot access phone numbers or perform subscription.

## Fix: Meta App & Business Manager Configuration

Your whitelabel customer (e.g. Digitalebuzz) must configure their **Meta App** and **Business Manager** as follows.

### Step 1: Request Advanced Access for Permissions

1. Go to [Meta for Developers](https://developers.facebook.com/) → Your App
2. **App Dashboard** → **WhatsApp** → **API Setup**
3. Under **Permissions**, ensure:
   - `whatsapp_business_management` – **Advanced Access** (not Standard)
   - `whatsapp_business_messaging` – **Advanced Access**
   - `business_management` – **Advanced Access**

4. If any show "Standard Access" or "Request Advanced Access", click and submit for review. Advanced Access is required for production.

### Step 2: Assign System User to WABA (Critical)

1. Go to [Meta Business Manager](https://business.facebook.com/) → **Business Settings**
2. **Users and assets** → **System Users**
3. Select the System User used for OAuth (e.g. "TSP-Digitalebuzz System User") or create one
4. Click **Add Assets** → **Apps** → Assign your WhatsApp app with **Full control**
5. Click **Add Assets** → **WhatsApp Accounts** → Select the WABA (e.g. ID `1385773062777132`) → **Full control**
6. Click **Add Assets** → **Phone Numbers** → Select the phone number(s) → **Full control**

### Step 3: Use System User Token (Recommended)

The user access token from Embedded Signup may have limited permissions. Using a **System User token** with proper asset assignment is more reliable:

1. In Business Manager → **System Users** → Select your System User
2. **Generate New Token**
3. Select permissions: `whatsapp_business_management`, `whatsapp_business_messaging`, `business_management`
4. Select the WABA as target (if prompted)
5. Copy the token

Then either:
- **Option A:** Store in integration credentials as `system_user_token` (if your platform supports it)
- **Option B:** Re-run the OAuth flow after completing Steps 1–2; the user token may work once assets are assigned

### Step 4: Verify Embedded Signup Config

1. Meta Dashboard → **WhatsApp** → **Embedded Signup** → **Embedded Signup Builder**
2. Ensure your config requests:
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
   - `business_management`

### Step 5: Disconnect and Reconnect

After completing the above:

1. Go to **Integrations** → WhatsApp Business → **Disconnect**
2. **Connect** again and complete the OAuth flow
3. Check PM2 logs for:
   - `[WhatsApp OAuth] ✅ Found X phone number(s) in WABA`
   - `[WhatsApp OAuth] ✅ App subscribed to WABA successfully`
   - `[WhatsApp OAuth] ✅ Automatically added phone number`

## Quick Checklist for Your Customer

- [ ] Meta App has **Advanced Access** for `whatsapp_business_management`, `whatsapp_business_messaging`, `business_management`
- [ ] System User is assigned to the WABA with **Full control**
- [ ] System User is assigned to Phone Numbers with **Full control**
- [ ] Embedded Signup config requests the correct permissions
- [ ] Disconnect and reconnect WhatsApp Business integration after changes

## References

- [Meta WhatsApp Business Management Permissions](https://developers.facebook.com/docs/whatsapp/embedded-signup/web/permissions)
- [Assign Assets to System Users](https://www.facebook.com/business/help/2041148702653215)
- [MULTI_TENANT_SYSTEM_USER_GUIDE.md](./MULTI_TENANT_SYSTEM_USER_GUIDE.md) – System User token configuration
