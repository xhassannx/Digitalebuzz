# Fix: "Error while pairing Cloud API" (Import contacts step)

This error occurs during the **Embedded Signup** flow when connecting a WhatsApp Business App number to the Cloud API. Meta fails to complete the "Import contacts and chat history" step.

## Root causes & solutions

### 1. **Webhook not reachable by Meta** (most common)

During pairing, Meta's servers must reach your webhook URL to verify the connection. If they cannot, pairing fails.

**Webhook URL:** `{BASE_URL}/api/webhooks/whatsapp-business`  
Example: `https://helicopticsolutions.in/api/webhooks/whatsapp-business`

**Checks:**
- [ ] **Production:** Use `BASE_URL=https://helicopticsolutions.in` (HTTPS, no trailing slash)
- [ ] **ngrok:** Free ngrok shows an interstitial "Visit Site" page for automated requests. Meta gets HTML instead of your webhook response → verification fails.
  - **Fix:** Use ngrok paid plan, or test on production URL instead
- [ ] **localhost:** Meta cannot reach `http://localhost:5002`. Use ngrok or deploy to production.
- [ ] **Firewall:** Ensure your server accepts inbound HTTPS on port 443 (or your port).

**Test webhook manually:**
```bash
# Replace with your actual URL and verify token
curl "https://helicopticsolutions.in/api/webhooks/whatsapp-business?hub.mode=subscribe&hub.verify_token=helicoptic@2025&hub.challenge=test123"
# Should return: test123
```

---

### 2. **Webhook verify token mismatch**

Meta sends the token you configured in the Dashboard. Your app must accept the same token.

**In Meta Dashboard:**  
WhatsApp → Configuration → Webhooks → Edit → **Verify Token** = the value you enter

**In .env:**  
`WEBHOOK_VERIFY_TOKEN=helicoptic@2025` (or same value as in Dashboard)

**Important:** The token in `.env` must match exactly what you configured in Meta Dashboard.

---

### 3. **Webhook not configured in Meta before pairing**

Configure the webhook before running Embedded Signup.

**Steps:**
1. Meta Dashboard → Your App → WhatsApp → Configuration
2. Webhook → Edit
3. **Callback URL:** `https://helicopticsolutions.in/api/webhooks/whatsapp-business`

   (Or your ngrok URL if testing: `https://xxx.ngrok-free.dev/api/webhooks/whatsapp-business`)
4. **Verify Token:** `helicoptic@2025` (or your chosen token)
5. Subscribe to: `messages`, `message_template_status_update`
6. Click **Verify and Save**

---

### 4. **Business verification incomplete**

Some steps require Business Verification to be complete.

**Checks:**
- [ ] Meta Business Manager → Security Center → Business Verification = Complete
- [ ] Business details: name, website, address, industry filled
- [ ] Website URL is valid and reachable

---

### 5. **Phone number / WhatsApp Business App issues**

- [ ] **Coexistence:** If using the Business App, ensure the number has been active on the Business App for 7+ days
- [ ] **2FA:** Enable 2FA on the Facebook account used for Business Manager
- [ ] **Number not banned:** Use a number that has not been banned or restricted

---

### 6. **Retry after a delay**

Transient errors can occur on Meta’s side. Wait 15–30 minutes and try again.

---

## Quick checklist

| Item | Status |
|------|--------|
| `BASE_URL` in .env = production URL (no trailing slash, no comment on same line) | |
| Webhook URL reachable from the internet (e.g. `curl` test) | |
| Webhook configured in Meta Dashboard with correct URL | |
| `WEBHOOK_VERIFY_TOKEN` in .env = Verify Token in Meta Dashboard | |
| Business verification complete | |
| Not using ngrok free tier (or using production URL) | |

---

## Recommended .env for production

```env
BASE_URL=https://helicopticsolutions.in
WEBHOOK_VERIFY_TOKEN=helicoptic@2025
```

---

## If still failing

1. **Server logs:** Check for `[Business API Webhook]` logs when Meta verifies the webhook.
2. **Meta Dashboard:** WhatsApp → Configuration → Webhooks → confirm URL and status.
3. **Report to Meta:** Use the "Report error to Helicoptic Solutions!" link in the error dialog and include the error ID (e.g. `#N/A:019c807a-0559-7b62-aa86-b3e4ac630e6a`).
