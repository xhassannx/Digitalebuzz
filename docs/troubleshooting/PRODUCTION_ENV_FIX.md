# Production .env Fix for WhatsApp OAuth

**Update:** The app now sanitizes `BASE_URL` (strips newlines, `#` comments) so malformed .env values are handled. You should still fix the .env for clarity.

## 1. Fix BASE_URL (CRITICAL)

**Current (WRONG):**
```env
BASE_URL="https://helicopticsolutions.in  
# or your production URL"
```

**Correct:**
```env
BASE_URL=https://helicopticsolutions.in
```

**Rules:**
- No quotes needed
- No spaces, newlines, or comments on the same line
- No trailing slash

---

## 2. Fix WEBHOOK_VERIFY_TOKEN

**Current (placeholder):**
```env
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token
```

**Correct (must match Meta Dashboard):**
```env
WEBHOOK_VERIFY_TOKEN=helicoptic@2025
```

---

## 3. Add App Domain in Facebook

1. Go to [Meta for Developers](https://developers.facebook.com) → Your App
2. **Settings** → **Basic**
3. Scroll to **App Domains**
4. Add: `helicopticsolutions.in`
5. Click **Save Changes**

---

## 4. After fixing .env

1. Restart your production server (e.g. `pm2 restart`)
2. Verify webhook: `curl "https://helicopticsolutions.in/api/webhooks/whatsapp-business?hub.mode=subscribe&hub.verify_token=helicoptic@2025&hub.challenge=test123"`
   - Should return: `test123`
