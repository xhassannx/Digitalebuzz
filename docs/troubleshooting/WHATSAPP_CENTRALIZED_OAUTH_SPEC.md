# WhatsApp Business API – Centralized OAuth Flow Specification

This document describes the current WhatsApp integration flow and the **centralized OAuth architecture** needed so you only register **one redirect URL** in the Facebook Developer Console, instead of every whitelabel customer domain.

---

## 1. Current Architecture (Per-Customer OAuth)

### Current Flow (Each Customer Domain)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  CUSTOMER DOMAIN (e.g. customer1.helicopticsolutions.in)                        │
│  BASE_URL = https://customer1.helicopticsolutions.in                            │
└─────────────────────────────────────────────────────────────────────────────────┘

1. User clicks "Connect WhatsApp" on Integrations page
2. Frontend: GET /api/integrations/whatsapp-business/oauth/authorize
3. Server generates state, stores in DB, returns:
   authUrl = "https://www.facebook.com/v23.0/dialog/oauth?
     client_id=APP_ID&
     redirect_uri=https://customer1.helicopticsolutions.in/wb/callback&  ← MUST be in Facebook Console
     scope=whatsapp_business_messaging,whatsapp_business_management,...
     state=xxx"
4. Popup opens → User authorizes on Facebook
5. Facebook redirects to: https://customer1.helicopticsolutions.in/wb/callback?code=xxx&state=xxx
6. Server: GET /wb/callback
   - Exchanges code for access_token
   - Stores integration in DB (userId, organizationId, credentials)
   - Returns HTML that postMessage to opener, closes popup
7. Success: window.opener.location.href = BASE_URL/connect
```

**Problem:** Each whitelabel domain (customer1.com, customer2.com, …) needs its own redirect URI in Facebook Developer Console → Facebook Login → Valid OAuth Redirect URIs.

---

## 2. Centralized OAuth Architecture

### Goal

Use **one central domain** for the OAuth callback. Only this URL is added to Facebook:

```
https://oauth.yourcentraldomain.com/wb/callback
```

(or use your main panel domain if it’s the same server)

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  CUSTOMER DOMAIN (Whitelabel Instance)                                           │
│  e.g. https://customer1.helicopticsolutions.in                                  │
│  - Has its own DB, users, sessions                                              │
│  - CUSTOMER_API_BASE_URL = URL of the central/customer portal (see below)        │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ 1. User clicks Connect WhatsApp
                                    │ 2. Call central to get authUrl
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  CENTRAL OAUTH SERVER (CUSTOMER_API_BASE_URL)                                    │
│  e.g. https://app.helicopticsolutions.in  or  https://oauth.helicopticsolutions.in│
│  - Single redirect_uri in Facebook: https://app.helicopticsolutions.in/wb/callback
│  - Handles OAuth callback, exchanges code for token                              │
│  - Forwards tokens to customer instance via authenticated API                    │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ 3. Facebook redirects here with code
                                    │ 4. Exchange code → token
                                    │ 5. POST tokens to customer's receive-tokens endpoint
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  CUSTOMER DOMAIN (same as above)                                                 │
│  - New endpoint: POST /api/integrations/whatsapp-business/oauth/receive-tokens   │
│  - Receives tokens from central, stores integration in its DB                    │
│  - Redirects user to /connect or /integrations                                    │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Implementation Details for CUSTOMER_API_BASE_URL (Central Server)

The central server (where CUSTOMER_API_BASE_URL points) must implement:

### 3.1 Environment Variables (Central Server)

```env
# Facebook App (same app for all whitelabel customers)
FACEBOOK_APP_ID=your_app_id
FACEBOOK_APP_SECRET=your_app_secret

# Central domain – only this goes in Facebook redirect URIs
BASE_URL=https://app.helicopticsolutions.in   # or oauth subdomain

# Embedded Signup (optional but recommended)
EMBEDDED_SIGNUP_CONFIG_ID=your_config_id

# Webhook URL – where Meta sends WhatsApp webhooks (can be central or per-customer)
WEBHOOK_URL=https://app.helicopticsolutions.in/api/webhooks/whatsapp-business
```

### 3.2 Facebook Developer Console

Add **only** this redirect URI:

```
https://app.helicopticsolutions.in/wb/callback
```

(Replace with your actual central domain.)

---

### 3.3 API Endpoints on Central Server

#### A. Initiate OAuth (called by customer frontend or backend)

**Option A – Backend-to-backend (recommended):**

```
POST /api/oauth/whatsapp/initiate
Content-Type: application/json

Request body:
{
  "customerInstanceUrl": "https://customer1.helicopticsolutions.in",  // Where to send tokens
  "userId": "user-uuid-from-customer-db",
  "organizationId": "org-uuid-from-customer-db",
  "returnPath": "/connect",  // Where to redirect user after success (e.g. /connect or /integrations)
  "authToken": "PRODUCTION_KEY_or_shared_secret"  // So central can authenticate when POSTing back
}

Response:
{
  "authUrl": "https://www.facebook.com/v23.0/dialog/oauth?client_id=...&redirect_uri=https://app.helicopticsolutions.in/wb/callback&state=...",
  "state": "unique-state-id"
}
```

**Option B – Redirect-based:**

```
GET /api/oauth/whatsapp/authorize?
  customer_url=https://customer1.helicopticsolutions.in&
  user_id=xxx&
  org_id=xxx&
  return_path=/connect&
  auth_token=PRODUCTION_KEY

→ Redirects to Facebook OAuth with state containing customer_url, user_id, org_id, return_path, auth_token
```

#### B. OAuth Callback (Facebook redirects here)

```
GET /wb/callback?code=xxx&state=xxx
```

Logic:

1. Validate `state` (load from DB or verify signature).
2. Exchange `code` for `access_token` via Facebook Graph API.
3. Fetch WABA IDs, phone numbers, etc. (same as current `whatsapp-business.ts` callback).
4. **POST to customer instance:**

   ```
   POST {customerInstanceUrl}/api/integrations/whatsapp-business/oauth/receive-tokens
   Headers:
     X-Production-Key: {authToken}   # or Authorization: Bearer {authToken}
   Content-Type: application/json

   Body:
   {
     "access_token": "...",
     "token_type": "bearer",
     "expires_in": 5183944,
     "userId": "user-uuid",
     "organizationId": "org-uuid",
     "phoneNumbers": [...],
     "wabas": [...]
   }
   ```

5. Return HTML that:
   - Redirects user to `{customerInstanceUrl}{returnPath}` (e.g. `/connect`), or
   - Uses `postMessage` to opener if opened in popup.

---

## 4. Implementation on Customer Instance (This Codebase / Whitelabel Panel)

The customer instance (each whitelabel deployment) needs:

### 4.1 New Endpoint: Receive Tokens from Central

```
POST /api/integrations/whatsapp-business/oauth/receive-tokens
Headers:
  X-Production-Key: PRODUCTION_KEY   (must match env on central)
  OR Authorization: Bearer PRODUCTION_KEY

Body: (from central server)
{
  "access_token": "...",
  "token_type": "bearer",
  "expires_in": 5183944,
  "userId": "...",
  "organizationId": "...",
  "phoneNumbers": [...],
  "wabas": [...]
}
```

Implementation:

- Verify `X-Production-Key` or `Authorization` matches `PRODUCTION_KEY`.
- Create/update integration for `userId` + `organizationId` with the provided credentials.
- Create sessions for phone numbers (mirror logic from `whatsapp-business.ts` callback).
- Return `{ success: true }`.

### 4.2 Modify OAuth Initiation

**Current:** `GET /api/integrations/whatsapp-business/oauth/authorize` builds `authUrl` with `redirect_uri = BASE_URL/wb/callback`.

**New:** Call central server to get `authUrl`:

```javascript
// Instead of building authUrl locally:
const centralUrl = process.env.OAUTH_CENTRAL_URL || process.env.CUSTOMER_API_BASE_URL;
const res = await fetch(`${centralUrl}/api/oauth/whatsapp/initiate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    customerInstanceUrl: process.env.BASE_URL,  // This instance's URL
    userId,
    organizationId,
    returnPath: '/connect',
    authToken: process.env.PRODUCTION_KEY,
  }),
});
const { authUrl } = await res.json();
res.json({ authUrl });
```

### 4.3 Environment Variables (Customer Instance)

```env
# This customer's public URL
BASE_URL=https://customer1.helicopticsolutions.in

# Central OAuth server (where CUSTOMER_API_BASE_URL runs)
OAUTH_CENTRAL_URL=https://app.helicopticsolutions.in
# OR reuse:
# CUSTOMER_API_BASE_URL=https://app.helicopticsolutions.in

# Shared secret for central → customer API calls
PRODUCTION_KEY=WL-xxxxxxxx-MLKG22FD
```

---

## 5. Webhook Handling (WhatsApp Messages)

Meta allows **one webhook URL per WABA**. Two approaches:

### Option A: Central Webhook + Forward to Customers

- Configure Meta webhook: `https://app.helicopticsolutions.in/api/webhooks/whatsapp-business`
- Central server receives events and forwards to customer instances via `WEBHOOK_FORWARD_URLS` or similar.
- Each customer instance has `/api/webhooks/whatsapp-business` and processes events for its own sessions.

### Option B: Per-Customer Webhook Override

- During OAuth callback, use Meta’s API to override the webhook URL per WABA.
- Current code already does this: `override_callback_uri` in `whatsapp-business.ts`.
- For centralized OAuth, the central server would need to know each customer’s webhook URL and set it per WABA.

Recommendation: Option A (central webhook + forward) is simpler and keeps one URL in Meta.

---

## 6. Key Files in This Codebase

| File | Purpose |
|------|---------|
| `server/integrations/oauth/whatsapp-business.ts` | OAuth authorize + callback, token exchange, integration creation |
| `server/integrations/handlers/whatsapp-business.ts` | Add phone, phone numbers, add-phone flow |
| `server/routes.ts` | `/api/webhooks/whatsapp-business` (webhook) |
| `server/webhooks/forwarder.ts` | Forward webhooks to multiple URLs |
| `client/src/pages/integrations-page.tsx` | Connect WhatsApp button, popup, postMessage handling |

---

## 7. OAuth State Storage

Current: `storage.createOAuthState({ userId, organizationId, integrationName, state, redirectUri, expiresAt })`.

For centralized flow:

- **Central server:** Store state with `customerInstanceUrl`, `userId`, `organizationId`, `returnPath`, `authToken`.
- **Customer instance:** No OAuth state needed for initiation; it only receives tokens via `receive-tokens`.

---

## 8. Session / Cookie Consideration

OAuth callback is on the **central** domain. The user’s session cookie is on the **customer** domain. So:

- `/wb/callback` on central does **not** have the user’s session.
- Initiation must include `userId` and `organizationId` (from customer session) in the request to central.
- Central uses that to include `userId`/`organizationId` in the `receive-tokens` payload.

---

## 9. Summary for Cursor (CUSTOMER_API_BASE_URL Side)

Implement on the central server (CUSTOMER_API_BASE_URL):

1. **POST /api/oauth/whatsapp/initiate**
   - Input: `customerInstanceUrl`, `userId`, `organizationId`, `returnPath`, `authToken`
   - Store state (e.g. in DB or signed JWT)
   - Return `authUrl` with `redirect_uri = BASE_URL/wb/callback` (central domain)

2. **GET /wb/callback**
   - Exchange `code` for token
   - Load state → get `customerInstanceUrl`, `userId`, `organizationId`, `returnPath`, `authToken`
   - Fetch WABAs/phone numbers (same as current callback)
   - POST to `{customerInstanceUrl}/api/integrations/whatsapp-business/oauth/receive-tokens` with `X-Production-Key: authToken`
   - Return HTML that redirects user to `{customerInstanceUrl}{returnPath}`

3. **Facebook Developer Console**
   - Add only: `https://{central-domain}/wb/callback`

4. **Webhook (optional)**
   - Use central webhook and forward to customer instances if needed.

---

## 10. Reference: Current OAuth Scopes

```javascript
const WHATSAPP_BUSINESS_SCOPES = [
  "whatsapp_business_messaging",
  "whatsapp_business_management",
  "business_management",
  "pages_read_engagement",
];
```

---

## 11. Reference: Token Exchange URL

```
GET https://graph.facebook.com/v23.0/oauth/access_token?
  client_id={APP_ID}&
  client_secret={APP_SECRET}&
  redirect_uri={REDIRECT_URI}&
  code={CODE}
```

Response: `{ access_token, token_type, expires_in }`
