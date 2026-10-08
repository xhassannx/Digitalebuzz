# Display Name "Pending Review" - Blocking CONNECTED Status

## Issue
Phone number shows as **PENDING** on Meta, and display name shows as **"Pending Review"**. This can block the phone number from transitioning to **CONNECTED** status.

## Root Cause
Meta requires the display name to be **approved** before the phone number can show as **CONNECTED**. If the display name is still in review, the phone number will remain **PENDING** even if all other steps are complete.

## What We've Done
✅ **All activation steps are complete:**
1. ✅ App subscribed to WABA
2. ✅ Connection registered via message templates endpoint
3. ✅ Connection registered via business account
4. ✅ Test message sent (or scheduled for retry)
5. ✅ Webhook configured (if done in Meta Dashboard)

## What's Blocking
❌ **Display name is "Pending Review"**
- Meta is reviewing the display name "Vani Technologies"
- This review typically takes **24-48 hours**
- Until approved, phone number will remain **PENDING**

## Solutions

### Solution 1: Wait for Display Name Approval (Recommended)
1. **Check Meta Dashboard:**
   - Go to [Meta Business Manager](https://business.facebook.com/)
   - Navigate to **WhatsApp Manager** → **Phone Numbers**
   - Find your phone number
   - Check display name status

2. **Wait for Approval:**
   - Meta typically approves display names within **24-48 hours**
   - You'll receive a notification when approved
   - Once approved, status should change to **CONNECTED** automatically

3. **After Approval:**
   - Status should change to **CONNECTED** within 1-5 minutes
   - If not, check webhook configuration
   - Or have someone send a message to activate

### Solution 2: Resubmit Display Name (If Rejected)
If display name was rejected:
1. Go to Meta Dashboard → WhatsApp Manager → Phone Numbers
2. Click on your phone number
3. Go to **Profile** tab
4. Edit display name
5. Resubmit for approval

### Solution 3: Send First Incoming Message (Alternative)
Even if display name is pending, you can try:
1. **Have someone send a message** to your WhatsApp Business number
2. **Webhook will receive the message**
3. **This may activate the number** even if display name is pending
4. **Status may change to CONNECTED** after first message

## How to Check Display Name Status

### Via Meta Dashboard:
1. Go to [Meta Business Manager](https://business.facebook.com/)
2. Navigate to **WhatsApp Manager** → **Phone Numbers**
3. Click on your phone number
4. Go to **Profile** tab
5. Check display name status:
   - ✅ **Approved** - Green checkmark
   - ⏳ **Pending Review** - Yellow warning icon
   - ❌ **Rejected** - Red X icon

### Via API (Limited):
The API doesn't directly show display name approval status, but you can check:
```bash
GET /{PHONE_NUMBER_ID}?fields=verified_name,code_verification_status
```

If `verified_name` exists, the display name is set (but may still be in review).

## Current Status Check

After integration, check server logs for:
```
[WhatsApp OAuth] ✅ Phone number verification status: VERIFIED
[WhatsApp OAuth]    Display Name: Vani Technologies
[WhatsApp OAuth]    ⚠️  If display name is "Pending Review" in Meta Dashboard, this can block CONNECTED status
```

## Expected Timeline

1. **Display Name Approval:** 24-48 hours (Meta review)
2. **Status Change to CONNECTED:** 1-5 minutes after approval
3. **Or:** After first incoming message (if webhook is configured)

## Troubleshooting

### If Display Name is Approved but Still PENDING:
1. ✅ Check webhook is configured in Meta Dashboard
2. ✅ Check webhook is verified (responds to GET requests)
3. ✅ Have someone send a message to activate
4. ✅ Wait 5-30 minutes for Meta to auto-activate

### If Display Name is Rejected:
1. Edit display name in Meta Dashboard
2. Ensure it follows Meta's guidelines:
   - Business name or brand name
   - No special characters
   - No misleading information
3. Resubmit for approval

## Next Steps

1. **Wait for display name approval** (24-48 hours)
2. **Check Meta Dashboard** periodically for status update
3. **Once approved**, status should change to **CONNECTED** automatically
4. **If still PENDING after approval**, try sending a message to activate

## Important Notes

- ⚠️ **Display name approval is required** for CONNECTED status
- ⏳ **Review takes 24-48 hours** (Meta's process)
- ✅ **All other steps are complete** - just waiting for approval
- 💡 **First incoming message** may activate even if display name is pending

