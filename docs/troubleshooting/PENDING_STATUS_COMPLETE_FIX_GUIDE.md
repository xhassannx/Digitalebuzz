# Complete Guide: Fix WhatsApp Business "Pending" Status

Based on [Heltar's comprehensive guide](https://www.heltar.com/blogs/what-to-do-about-business-whatsapp-account-in-pending-status-cm4xrj4ra00c0o6ht4shl9c3p) and Meta's requirements, here are all the common causes and solutions for PENDING status.

## ✅ What We've Implemented Automatically

Our system now automatically handles:
1. ✅ **App Subscription to WABA** - Critical step that prevents PENDING status
2. ✅ **Phone Number Registration** - Automatic registration with retries
3. ✅ **Test Message Sending** - Background retries to activate the number
4. ✅ **Access Token Validation** - Checks if token is valid and not expired
5. ✅ **Business Portfolio Check** - Verifies business details are complete
6. ✅ **Comprehensive Logging** - Clear guidance on what to check

## ⚠️ Common Causes & Manual Fixes Required

### 1. **Pending Connection Request** (MOST COMMON)

**Problem:** Meta Business Manager has a pending connection request that needs approval.

**Solution:**
1. Go to [Meta Business Manager](https://business.facebook.com/)
2. Navigate to **Business Settings** → **Requests**
3. Find any pending connection requests from this app
4. Click **"Approve"** for each request
5. Refresh the WhatsApp Manager page

**Why this happens:** When connecting via OAuth, Meta creates a connection request that must be manually approved in Business Settings.

---

### 2. **Expired or Invalid Access Token**

**Problem:** The access token used for authentication is expired or invalid.

**Solution:**
1. Go to [Meta Apps Dashboard](https://developers.facebook.com/apps/)
2. Select your app → **WhatsApp** → **API Setup**
3. Find the phone number showing "pending" status
4. Click **"Generate Access Token"**
5. Select **"Opt in to all current and future accounts"**
6. Click **"Continue"**
7. Return to Phone Numbers Dashboard - status should be resolved

**Why this happens:** Access tokens expire after a certain period. Third-party SaaS platforms may use expired tokens.

---

### 3. **Missing Business Website URL** (CRITICAL)

**Problem:** Meta requires a valid business website URL for verification. Missing website causes PENDING status.

**Solution:**
1. Go to [Meta Business Manager](https://business.facebook.com/)
2. Navigate to **Business Settings** → **Business Info** → **Business Details**
3. Ensure ALL fields are filled:
   - ✅ Business Name
   - ✅ Legal Name (if applicable)
   - ✅ Business Category
   - ✅ Business Description
   - ✅ Business Address
   - ✅ Business Phone Number
   - ✅ **Business Website URL** (CRITICAL - often missing)
4. Save changes and refresh WhatsApp Manager

**Why this happens:** Meta uses business website as a key verification factor. Without it, accounts remain PENDING.

---

### 4. **Display Name "Pending Review"**

**Problem:** Display name is still under Meta review, blocking CONNECTED status.

**Solution:**
1. Go to [Meta Business Manager](https://business.facebook.com/)
2. Navigate to **WhatsApp Manager** → **Phone Numbers**
3. Click on your phone number
4. Go to **Profile** tab
5. Check display name status:
   - ✅ **Approved** - Green checkmark (should work)
   - ⏳ **Pending Review** - Yellow warning (wait 24-48 hours)
   - ❌ **Rejected** - Red X (resubmit with compliant name)
6. Wait for Meta to approve (usually 24-48 hours)

**Why this happens:** Meta reviews all display names to ensure compliance. Until approved, status remains PENDING.

---

### 5. **Incomplete Registration (Missing OTP/PIN)**

**Problem:** Registration process was incomplete, missing OTP or PIN entry.

**Solution:**
1. Check SMS for 6-digit PIN from Meta
2. If PIN is required, use our manual registration endpoint:
   ```
   POST /api/integrations/whatsapp-business/register-phone
   {
     "phoneNumberId": "YOUR_PHONE_NUMBER_ID",
     "pin": "XXXXXX"
   }
   ```
3. Or register via Meta Dashboard → WhatsApp Manager → Phone Numbers

**Note:** For Embedded Signup, Meta should auto-register without PIN. If PIN is required, it's unusual.

---

### 6. **Meta Review Pending (Up to 48 Hours)**

**Problem:** Meta is still reviewing the newly added account or number.

**Solution:**
1. Wait up to **48 hours** for Meta to complete review
2. Check Meta Dashboard periodically
3. Status will change to CONNECTED automatically after review

**Why this happens:** Meta reviews all new WhatsApp Business accounts for compliance and security.

---

### 7. **Webhook Not Configured or Verified**

**Problem:** Webhook is missing, not configured, or verification failed.

**Solution:**
1. Go to [Meta Apps Dashboard](https://developers.facebook.com/apps/)
2. Select your app → **WhatsApp** → **Configuration** → **Webhooks**
3. Configure:
   - **Callback URL:** `https://helicopticsolutions.in/api/webhooks/whatsapp-business`
   - **Verify Token:** `helicoptic@2025` (or your `WEBHOOK_VERIFY_TOKEN` from `.env`)
4. Subscribe to fields:
   - ✅ `messages`
   - ✅ `message_template_status_update`
5. Click **"Verify and Save"**

**Why this happens:** Webhook is required for Meta to send status updates. Without it, status remains PENDING.

---

### 8. **First Message Not Sent/Received**

**Problem:** Status changes to CONNECTED only after first successful message send or receive.

**Solution:**
1. **Option 1:** Have someone send a message to your WhatsApp Business number
   - Use any WhatsApp number (personal or business)
   - Send any message: "Hello", "Test", etc.
   - Webhook will receive it and activate the number
2. **Option 2:** Wait 5-30 minutes for Meta to auto-activate
3. **Option 3:** Our system automatically sends a test message (with retries)

**Why this happens:** Meta requires a successful API interaction to mark the number as CONNECTED.

---

## 🔍 How to Diagnose

### Check Server Logs

After integration, look for these log messages:

```
[WhatsApp OAuth] ✅ Access token is valid
[WhatsApp OAuth] ✅ App subscribed to WABA successfully
[WhatsApp OAuth] ✅ Phone number verification status: VERIFIED
[WhatsApp OAuth] 📋 IMPORTANT: Check for Pending Connection Requests
```

### Check Meta Dashboard

1. **Phone Numbers Dashboard:**
   - Go to WhatsApp Manager → Phone Numbers
   - Check status: Should be "Connected" (green), not "Pending" (yellow)

2. **Business Settings → Requests:**
   - Check for pending connection requests
   - Approve any requests from this app

3. **Business Info:**
   - Ensure all fields are complete, especially website URL

4. **Webhook Configuration:**
   - Verify webhook URL is configured
   - Verify token matches your `.env` file

---

## 📋 Quick Checklist

Use this checklist to fix PENDING status:

- [ ] **Approve Connection Request** (Business Settings → Requests)
- [ ] **Generate New Access Token** (Meta Apps Dashboard → WhatsApp > API Setup)
- [ ] **Complete Business Portfolio** (Business Settings → Business Info → Business Details)
  - [ ] Business Name ✅
  - [ ] Legal Name ✅
  - [ ] Business Category ✅
  - [ ] Business Description ✅
  - [ ] Business Address ✅
  - [ ] Business Phone Number ✅
  - [ ] **Business Website URL** ✅ (CRITICAL)
- [ ] **Check Display Name Approval** (WhatsApp Manager → Phone Numbers → Profile)
- [ ] **Configure Webhook** (Meta Apps Dashboard → WhatsApp → Configuration → Webhooks)
- [ ] **Send/Receive First Message** (or wait 5-30 minutes for auto-activation)
- [ ] **Wait for Meta Review** (up to 48 hours for new accounts)

---

## 🎯 Most Common Fix (90% of Cases)

**If number is PENDING, do this first:**

1. **Approve Connection Request:**
   - Meta Business Manager → Business Settings → Requests
   - Approve any pending requests

2. **Generate New Access Token:**
   - Meta Apps Dashboard → WhatsApp > API Setup
   - Select pending number → "Generate Access Token"
   - Select "Opt in to all current and future accounts"

3. **Check Business Website:**
   - Business Settings → Business Info → Business Details
   - Ensure website URL is filled

**After these 3 steps, status should change to CONNECTED within 1-5 minutes.**

---

## 📚 References

- [Heltar Blog: Fix Pending Status](https://www.heltar.com/blogs/what-to-do-about-business-whatsapp-account-in-pending-status-cm4xrj4ra00c0o6ht4shl9c3p)
- [Meta WhatsApp Business API Docs](https://developers.facebook.com/docs/whatsapp)
- [Meta Business Manager](https://business.facebook.com/)

---

## 💡 Why Other SaaS Platforms Auto-Connect

Other SaaS platforms that auto-connect numbers typically:
1. ✅ Are Official BSPs (Business Solution Providers) with Meta partnerships
2. ✅ Have complete business verification (all info including website)
3. ✅ Use pre-verified phone numbers (active for 7+ days)
4. ✅ Have better Embedded Signup setup with all prerequisites met
5. ✅ Use System User tokens for more reliable subscription

Our system now implements all automatic steps possible. Manual approval of connection requests and business portfolio completion are the main remaining manual steps.

