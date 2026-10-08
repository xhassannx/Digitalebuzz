# PENDING Status Troubleshooting Guide

If your phone number is still showing as **PENDING** on Meta after integration, follow these steps:

## Step 1: Run Diagnostic Check

We've added a diagnostic endpoint to check what's blocking the connection:

```bash
GET /api/integrations/whatsapp-business/diagnose/{PHONE_NUMBER_ID}
```

**Example:**
```
GET https://helicopticsolutions.in/api/integrations/whatsapp-business/diagnose/904511319417706
```

This will check:
- ✅ Phone number status and verification
- ✅ Access token validity
- ✅ WABA subscription status
- ✅ Message templates accessibility
- ✅ Specific recommendations

## Step 2: Check Server Logs

After integration, check your server logs for these messages:

```
[WhatsApp OAuth] ✅ App subscribed to WABA successfully
[WhatsApp OAuth] ✅ Phone number verification status: VERIFIED
[WhatsApp OAuth] 📋 IMPORTANT: Check for Pending Connection Requests
```

If you see warnings, follow the recommendations in the logs.

## Step 3: Most Common Fixes (90% of Cases)

### Fix 1: Approve Connection Request (MOST COMMON)

1. Go to [Meta Business Manager](https://business.facebook.com/)
2. Navigate to **Business Settings** → **Requests**
3. Look for any pending connection requests from your app
4. Click **"Approve"** for each request
5. Wait 1-2 minutes and check status again

**Why this happens:** When connecting via OAuth, Meta creates a connection request that must be manually approved.

---

### Fix 2: Generate New Access Token

1. Go to [Meta Apps Dashboard](https://developers.facebook.com/apps/)
2. Select your app → **WhatsApp** → **API Setup**
3. Find the phone number showing "pending" status
4. Click **"Generate Access Token"**
5. **IMPORTANT:** Select **"Opt in to all current and future accounts"**
6. Click **"Continue"**
7. Return to Phone Numbers Dashboard - status should be resolved

**Why this works:** Generating a new token with "Opt in to all accounts" explicitly approves the connection.

---

### Fix 3: Complete Business Portfolio (Especially Website)

1. Go to [Meta Business Manager](https://business.facebook.com/)
2. Navigate to **Business Settings** → **Business Info** → **Business Details**
3. Ensure **ALL** fields are filled:
   - ✅ Business Name
   - ✅ Legal Name (if applicable)
   - ✅ Business Category
   - ✅ Business Description
   - ✅ Business Address
   - ✅ Business Phone Number
   - ✅ **Business Website URL** (CRITICAL - often missing)
4. Save changes
5. Wait 5-10 minutes and check status again

**Why this matters:** Meta requires complete business information, especially the website URL, for verification.

---

### Fix 4: Check Display Name Approval

1. Go to [Meta Business Manager](https://business.facebook.com/)
2. Navigate to **WhatsApp Manager** → **Phone Numbers**
3. Click on your phone number
4. Go to **Profile** tab
5. Check display name status:
   - ✅ **Approved** - Should work
   - ⏳ **Pending Review** - Wait 24-48 hours
   - ❌ **Rejected** - Resubmit with compliant name

**Why this blocks:** Display name must be approved before status changes to CONNECTED.

---

### Fix 5: Verify Webhook Configuration

1. Go to [Meta Apps Dashboard](https://developers.facebook.com/apps/)
2. Select your app → **WhatsApp** → **Configuration** → **Webhooks**
3. Verify:
   - **Callback URL:** `https://helicopticsolutions.in/api/webhooks/whatsapp-business`
   - **Verify Token:** `helicoptic@2025` (or your `WEBHOOK_VERIFY_TOKEN` from `.env`)
   - **Subscribed Fields:**
     - ✅ `messages`
     - ✅ `message_template_status_update`
4. Click **"Verify and Save"** if not already verified

**Why this matters:** Webhook must be verified for Meta to send status updates.

---

### Fix 6: Send First Message (Activation)

The status changes to CONNECTED only after the first successful message send or receive:

**Option A: Have someone send a message**
1. Use any WhatsApp number (personal or business)
2. Send a message to your WhatsApp Business number
3. Check server logs for: `🎉 INCOMING MESSAGE RECEIVED`
4. Status should change to CONNECTED within 1-5 minutes

**Option B: Wait for auto-activation**
1. Wait 5-30 minutes after webhook is configured
2. Meta may auto-activate the number
3. Check Meta Dashboard periodically

---

## Step 4: Check Integration Logs

After running the diagnostic, check your server logs for detailed information:

```bash
# Look for these log messages:
[WhatsApp OAuth] ✅ App subscribed to WABA successfully
[WhatsApp OAuth] ✅ Access token is valid
[WhatsApp OAuth] ✅ Phone number verification status: VERIFIED
[WhatsApp OAuth] ⚠️  [Any warnings or errors]
```

## Step 5: Manual Status Refresh

If all checks pass but status is still PENDING:

1. **Wait 24-48 hours** - Meta may need time to review
2. **Check Meta Dashboard** - Status may have changed
3. **Re-run diagnostic** - Check if anything changed
4. **Contact Meta Support** - If still pending after 48 hours

---

## Quick Checklist

Use this checklist to fix PENDING status:

- [ ] **Approve Connection Request** (Business Settings → Requests)
- [ ] **Generate New Access Token** (Meta Apps Dashboard → WhatsApp > API Setup)
  - [ ] Select "Opt in to all current and future accounts"
- [ ] **Complete Business Portfolio** (Business Settings → Business Info → Business Details)
  - [ ] Business Name ✅
  - [ ] Legal Name ✅
  - [ ] Business Category ✅
  - [ ] Business Description ✅
  - [ ] Business Address ✅
  - [ ] Business Phone Number ✅
  - [ ] **Business Website URL** ✅ (CRITICAL)
- [ ] **Check Display Name Approval** (WhatsApp Manager → Phone Numbers → Profile)
- [ ] **Verify Webhook** (Meta Apps Dashboard → WhatsApp → Configuration → Webhooks)
- [ ] **Send/Receive First Message** (or wait 5-30 minutes for auto-activation)
- [ ] **Run Diagnostic** (`GET /api/integrations/whatsapp-business/diagnose/{PHONE_NUMBER_ID}`)

---

## Expected Timeline

- **Connection Request Approval:** Immediate (1-2 minutes)
- **Access Token Generation:** Immediate (1-2 minutes)
- **Display Name Approval:** 24-48 hours (Meta review)
- **First Message Activation:** 1-5 minutes after message
- **Auto-Activation:** 5-30 minutes after webhook configured
- **Meta Review:** Up to 48 hours for new accounts

---

## Still PENDING After All Steps?

If the number is still PENDING after completing all steps:

1. **Run the diagnostic endpoint** to get specific recommendations
2. **Check server logs** for any errors or warnings
3. **Verify all manual steps** were completed correctly
4. **Wait 48 hours** - Meta may need time to process
5. **Contact Meta Support** with:
   - Phone Number ID
   - WABA ID
   - Screenshots of Meta Dashboard
   - Diagnostic results

---

## References

- [Heltar Blog: Fix Pending Status](https://www.heltar.com/blogs/what-to-do-about-business-whatsapp-account-in-pending-status-cm4xrj4ra00c0o6ht4shl9c3p)
- [Meta WhatsApp Business API Docs](https://developers.facebook.com/docs/whatsapp)
- [Meta Business Manager](https://business.facebook.com/)

