# Embedded Signup Complete Flow Implementation

> **Using both WhatsApp Business App and the API panel?** See [COEXISTENCE_GUIDE.md](./COEXISTENCE_GUIDE.md) for how to enable message sync from the app.

## ✅ What We've Implemented

### 1. **Backend: Complete Onboarding Endpoint** (`/api/whatsapp/complete-onboarding`)
- ✅ Receives `businessId`, `wabaId`, `phoneNumberId` from Embedded Signup completion
- ✅ Assigns System User to WABA (if `META_SYSTEM_USER_TOKEN` and `META_SYSTEM_USER_ID` are configured)
- ✅ Subscribes app to WABA using `POST /{wabaId}/subscribed_apps` (CRITICAL - prevents PENDING)
- ✅ Verifies phone number status
- ✅ Sends test message to activate phone number
- ✅ Automatically adds phone number to system

### 2. **Backend: OAuth Callback Improvements**
- ✅ Uses system user token for subscription (if available)
- ✅ Subscribes app to all found WABAs
- ✅ Sends test messages to activate phone numbers
- ✅ Automatically adds phone numbers after OAuth
- ✅ Retries WABA discovery after 30 seconds if nothing found initially

### 3. **Frontend: Embedded Signup Event Listener**
- ✅ Listens for `WA_EMBEDDED_SIGNUP` event from Facebook SDK
- ✅ Calls `/api/whatsapp/complete-onboarding` when signup completes
- ✅ Handles success/error states

## ⚠️ What's Missing (Compared to Reference Implementation)

### 1. **Frontend: Facebook SDK Integration**
The reference implementation uses Facebook SDK to launch Embedded Signup, but we're using OAuth redirect flow.

**Reference Implementation:**
```javascript
window.FB.login(
  function (response) {
    if (response.authResponse) {
      console.log("Embedded Signup started");
    }
  },
  {
    scope: "business_management,whatsapp_business_management,whatsapp_business_messaging",
    extras: {
      setup: {
        business: {},
        phone_number: {},
      },
    },
  }
);
```

**Our Current Implementation:**
- Uses OAuth redirect URL with `config_id` and `extras` parameters
- This works, but doesn't provide the `WA_EMBEDDED_SIGNUP` event directly

### 2. **Environment Variables**
Add these to your `.env` file:

```env
# System User Token (for assigning system user and subscribing app)
META_SYSTEM_USER_TOKEN=EAAG...
META_SYSTEM_USER_ID=123456789

# Embedded Signup Config ID (already configured)
EMBEDDED_SIGNUP_CONFIG_ID=24760315386893718
```

**How to Get System User Token:**
1. Go to Meta Business Manager → Business Settings → System Users
2. Select your System User (or create one)
3. Click "Generate New Token"
4. Select permissions: `whatsapp_business_management`, `whatsapp_business_messaging`
5. Copy the token and System User ID

### 3. **OAuth Callback vs Embedded Signup Event**
**Current Flow:**
- User clicks "Connect" → OAuth popup opens → User completes Embedded Signup → OAuth callback receives code → We fetch phone numbers/WABAs → We subscribe app → We add phone numbers

**Reference Flow:**
- User clicks "Connect" → Facebook SDK launches Embedded Signup → User completes signup → `WA_EMBEDDED_SIGNUP` event fires → We call `/api/whatsapp/complete-onboarding` with IDs directly

**Both flows work**, but the reference flow is more direct because:
- IDs are provided directly (no need to fetch)
- Event fires immediately after signup completes
- Less API calls needed

## 🔧 How to Fix the Two Issues

### Issue 1: Numbers Not Automatically Adding

**Root Cause:** OAuth callback may not find phone numbers immediately after Embedded Signup completes.

**Solution:** The code now:
1. ✅ Automatically adds phone numbers found during OAuth callback
2. ✅ Retries after 30 seconds if nothing found initially
3. ✅ Listens for Embedded Signup completion event (if using Facebook SDK)

**To Ensure It Works:**
- Check server logs for: `[WhatsApp OAuth] ✅ Automatically added phone number`
- If you see "Found 0 phone number(s)", wait 30 seconds and check again
- Or manually add from `/connect` page

### Issue 2: Numbers Showing as PENDING on Meta

**Root Cause:** Missing critical post-signup steps:
1. ❌ App not subscribed to WABA (`POST /{WABA_ID}/subscribed_apps`)
2. ❌ System User not assigned to WABA
3. ❌ Test message not sent

**Solution:** The code now:
1. ✅ Subscribes app to WABA (using system user token if available)
2. ✅ Assigns System User to WABA (if `META_SYSTEM_USER_TOKEN` configured)
3. ✅ Sends test message to activate phone number

**To Ensure It Works:**
1. **Set System User Token in `.env`:**
   ```env
   META_SYSTEM_USER_TOKEN=EAAG...
   META_SYSTEM_USER_ID=123456789
   ```

2. **Check Server Logs:**
   - Look for: `[WhatsApp OAuth] ✅ App subscribed to WABA successfully`
   - Look for: `[WhatsApp OAuth] ✅ System User assigned to WABA successfully`
   - Look for: `[WhatsApp OAuth] ✅ Test message sent successfully`

3. **If Subscription Fails:**
   - Check error code in logs
   - Ensure app has Advanced Access for `whatsapp_business_messaging`
   - Ensure System User has permissions for WABA

## 📋 Complete Checklist

### Backend Setup
- [x] `/api/whatsapp/complete-onboarding` endpoint created
- [x] OAuth callback subscribes app to WABA
- [x] OAuth callback sends test message
- [x] OAuth callback automatically adds phone numbers
- [ ] `META_SYSTEM_USER_TOKEN` set in `.env`
- [ ] `META_SYSTEM_USER_ID` set in `.env`

### Frontend Setup
- [x] Embedded Signup event listener added
- [ ] Facebook SDK loaded (optional - only if using SDK flow)

### Meta App Configuration
- [ ] System User created in Business Manager
- [ ] System User has permissions: `whatsapp_business_management`, `whatsapp_business_messaging`
- [ ] App has Advanced Access for `whatsapp_business_messaging`
- [ ] App has Advanced Access for `whatsapp_business_management`
- [ ] Business verification complete (including website)

## 🎯 Expected Result

After completing Embedded Signup:
1. ✅ Phone number automatically added to system
2. ✅ Phone number shows as **CONNECTED** (not PENDING) on Meta
3. ✅ Can send messages immediately
4. ✅ Status persists across sessions

## 🐛 Troubleshooting

### Phone Numbers Still PENDING
1. Check server logs for subscription errors
2. Verify System User Token is set correctly
3. Verify System User is assigned to WABA manually in Business Manager
4. Check app permissions in Meta Dashboard

### Phone Numbers Not Auto-Added
1. Check server logs for "Found 0 phone number(s)"
2. Wait 30 seconds and check again (retry mechanism)
3. Manually add from `/connect` page
4. Check OAuth callback logs for errors

### Subscription Fails
1. Check error code in logs
2. Verify System User Token has correct permissions
3. Try with user access token (fallback already implemented)
4. Check Meta Dashboard for app permissions

## 📝 Next Steps

1. **Add System User Token to `.env`:**
   ```env
   META_SYSTEM_USER_TOKEN=your_token_here
   META_SYSTEM_USER_ID=your_user_id_here
   ```

2. **Test the Flow:**
   - Connect WhatsApp Business
   - Check server logs for subscription success
   - Check Meta Dashboard for CONNECTED status
   - Verify phone number appears in `/connect` page

3. **Monitor Logs:**
   - Look for subscription success messages
   - Look for test message success
   - Look for phone number auto-addition

4. **If Still PENDING:**
   - Manually assign System User in Business Manager
   - Check business verification status
   - Verify phone number eligibility (7+ days active)

