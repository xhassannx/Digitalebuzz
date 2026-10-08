# WhatsApp Panel – API Documentation

Complete API reference for integrating with the WhatsApp panel: Project API (external apps, CRMs, automation) and Dashboard API (panel UI).

---

## Base URL

All requests use your deployment base URL. Examples:

- **Production:** `https://your-domain.com`
- **Local:** `http://localhost:5002`

Project API base path: `{BASE_URL}/api/project/v1`

---

## Authentication

### Project API (external integrations)

Use an **API key** in the header. Create keys in the dashboard: **Settings → API Keys**.

| Header     | Value        |
|-----------|---------------|
| `X-API-Key` | `YOUR_API_KEY` |

Example:

```bash
curl -H "X-API-Key: wapi_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  "https://your-domain.com/api/project/v1"
```

### Dashboard API

Use **session auth** (cookie) or **Bearer token**:

| Header            | Value              |
|-------------------|--------------------|
| `Authorization`   | `Bearer YOUR_API_KEY` |

---

## Project API v1 (with examples)

Project API is for third-party systems: CRMs, websites, automation tools. All Project API endpoints require the `X-API-Key` header.

---

### 1. API info

**GET** `/api/project/v1`

Returns API name, version, and endpoint list.

**Example request:**

```bash
curl --request GET \
  --url https://your-domain.com/api/project/v1 \
  --header 'Accept: application/json' \
  --header 'X-API-Key: YOUR_API_KEY'
```

**Example response:**

```json
{
  "name": "Project API",
  "version": "1.0",
  "baseUrl": "https://your-domain.com/api/project/v1",
  "endpoints": {}
}
```

---

### 2. List sessions

**GET** `/api/project/v1/sessions`

Returns all WhatsApp sessions (connections) for the account. Use `sessionId` in send-message calls.

**Query:** `organizationId` (optional)

**Example request:**

```bash
curl --request GET \
  --url "https://your-domain.com/api/project/v1/sessions" \
  --header 'Accept: application/json' \
  --header 'X-API-Key: YOUR_API_KEY'
```

**Example response:**

```json
[
  {
    "sessionId": "wb_xxx",
    "status": "connected",
    "connectionType": "official"
  }
]
```

---

### 3. List templates

**GET** `/api/project/v1/templates`

Returns approved message templates. Use `name` and `language` in send-template.

**Query:** `organizationId`, `phoneNumberId` (optional)

**Example request:**

```bash
curl --request GET \
  --url "https://your-domain.com/api/project/v1/templates?phoneNumberId=123456789" \
  --header 'Accept: application/json' \
  --header 'X-API-Key: YOUR_API_KEY'
```

---

### 4. Send message (unified)

**POST** `/api/project/v1/messages`

Unified endpoint for text, image, video, audio, document, and template. Use `type` and the matching payload.

**Body:**

| Field       | Type   | Required | Description |
|------------|--------|----------|-------------|
| `sessionId` | string | Yes      | From list sessions |
| `to`        | string | Yes      | Recipient phone e.g. `919876543210` |
| `type`      | string | Yes      | `text` \| `image` \| `video` \| `audio` \| `document` \| `template` |
| `text`      | object | For text | `{ "body": "Hello" }` |
| `image`     | object | For image| `{ "link": "https://..." }` or `{ "id": "MEDIA_ID", "caption": "..." }` |
| `template`  | object | For template | `{ "name": "hello_world", "language": { "code": "en" } }` |

**Example – text:**

```bash
curl --request POST \
  --url https://your-domain.com/api/project/v1/messages \
  --header 'Content-Type: application/json' \
  --header 'X-API-Key: YOUR_API_KEY' \
  --data '{"sessionId":"YOUR_SESSION_ID","to":"919876543210","type":"text","text":{"body":"Hello from API"}}'
```

**Example – image by URL:**

```bash
curl --request POST \
  --url https://your-domain.com/api/project/v1/messages \
  --header 'Content-Type: application/json' \
  --header 'X-API-Key: YOUR_API_KEY' \
  --data '{"sessionId":"YOUR_SESSION_ID","to":"919876543210","type":"image","image":{"link":"https://example.com/img.jpg","caption":"Check this"}}'
```

**Example – template:**

```bash
curl --request POST \
  --url https://your-domain.com/api/project/v1/messages \
  --header 'Content-Type: application/json' \
  --header 'X-API-Key: YOUR_API_KEY' \
  --data '{"sessionId":"YOUR_SESSION_ID","to":"919876543210","type":"template","template":{"name":"hello_world","language":{"code":"en"}}}'
```

**Example response:**

```json
{
  "id": "wamid.xxx",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "status": "sent"
}
```

---

### 5. Send text message

**POST** `/api/project/v1/messages/send-text`

Sends a free-form text message. Recipient must have messaged within the last 24 hours (or use template for first outreach).

**Body:**

```json
{
  "sessionId": "YOUR_SESSION_ID",
  "to": "919876543210",
  "message": "Hello from API"
}
```

**Example request:**

```bash
curl --request POST \
  --url https://your-domain.com/api/project/v1/messages/send-text \
  --header 'Content-Type: application/json' \
  --header 'X-API-Key: YOUR_API_KEY' \
  --data '{"sessionId":"YOUR_SESSION_ID","to":"919876543210","message":"Hello from API"}'
```

**Example response:**

```json
{
  "id": "wamid.xxx",
  "status": "sent"
}
```

---

### 6. Send template message

**POST** `/api/project/v1/messages/send-template`

Sends an approved WhatsApp template. Supports body params and media header (image/video/document by WhatsApp media ID).

**Body:**

| Field            | Type   | Required | Description |
|-----------------|--------|----------|-------------|
| `sessionId`     | string | Yes      | WhatsApp Business session |
| `to`            | string | Yes      | e.g. `919876543210` |
| `templateName`  | string | Yes      | From list templates |
| `languageCode`  | string | No       | Default `en` |
| `templateParams`| array  | No       | Body params (positional or named) |
| `header`        | object | No       | `{ "type": "image"|"video"|"document", "id": "WHATSAPP_MEDIA_ID" }` |

**Example request:**

```bash
curl --request POST \
  --url https://your-domain.com/api/project/v1/messages/send-template \
  --header 'Content-Type: application/json' \
  --header 'X-API-Key: YOUR_API_KEY' \
  --data '{"sessionId":"YOUR_SESSION_ID","to":"919876543210","templateName":"hello_world","languageCode":"en"}'
```

**Example with header image:**

```json
{
  "sessionId": "YOUR_SESSION_ID",
  "to": "919876543210",
  "templateName": "promo_with_image",
  "languageCode": "en",
  "header": { "type": "image", "id": "MEDIA_ID_FROM_WHATSAPP" },
  "templateParams": ["Summer Sale", "20% off"]
}
```

---

### 7. Get message details

**GET** `/api/project/v1/messages/:messageId`

Returns message details by internal ID or WhatsApp message ID (wamid). Optional query: `sessionId`.

**Example request:**

```bash
curl --request GET \
  --url "https://your-domain.com/api/project/v1/messages/MESSAGE_ID?sessionId=wb_xxx" \
  --header 'Accept: application/json' \
  --header 'X-API-Key: YOUR_API_KEY'
```

**Example response:**

```json
{
  "type": "message",
  "id": "xxx",
  "project_id": "session_id",
  "phone_number": "919876543210",
  "sender": "AGENT",
  "message_content": { "text": "Hello" },
  "message_type": "TEXT",
  "status": "READ"
}
```

---

### 8. Campaign send (single recipient)

**POST** `/api/project/v1/campaign/send`

Aisensy-compatible: send template by campaign name, create/update contact, optional tags and attributes.

**Body:**

| Field           | Type   | Required | Description |
|----------------|--------|----------|-------------|
| `campaignName` | string | Yes      | Template name |
| `destination`  | string | Yes      | Phone with country code e.g. `+919876543210` |
| `userName`     | string | Yes      | Contact name |
| `templateParams` | array | No     | Template parameter values |
| `source`       | string | No       | Lead source |
| `tags`         | array  | No       | Tag names |
| `attributes`   | object | No       | Custom contact attributes |

**Example request:**

```bash
curl --request POST \
  --url https://your-domain.com/api/project/v1/campaign/send \
  --header 'Content-Type: application/json' \
  --header 'X-API-Key: YOUR_API_KEY' \
  --data '{"campaignName":"hello_world","destination":"+919876543210","userName":"John Doe","tags":["lead"],"attributes":{"email":"john@example.com"}}'
```

**Example response:**

```json
{
  "id": "wamid.xxx",
  "status": "sent"
}
```

---

### 9. List campaigns (templates)

**GET** `/api/project/v1/campaigns`

Returns approved templates as campaigns. Use `campaignName` in campaign/send. Query: `organizationId`, `phoneNumberId`, `type=broadcast` (optional).

---

### 10. Create broadcast campaign

**POST** `/api/project/v1/campaigns`

Creates a broadcast campaign with optional recipients and schedule. Execute via **POST** `campaigns/:id/send`. Omit `scheduledAt` to run in 2 minutes.

**Body:**

| Field               | Type   | Required | Description |
|---------------------|--------|----------|-------------|
| `organizationId`   | string | Yes*     | * or first org |
| `sessionId`        | string | Yes      | From list sessions |
| `name`             | string | Yes      | Campaign name (your reference) |
| `messageTemplate`  | string | Yes      | Template name from list templates |
| `templateLanguage` | string | No       | Default `en` |
| `scheduledAt`      | string | No       | ISO 8601; omit = 2 min from now |
| `recipients`       | array  | No       | `[{ "phoneNumber", "name?", "contactId?" }]` |

**Example request:**

```bash
curl --request POST \
  --url https://your-domain.com/api/project/v1/campaigns \
  --header 'Content-Type: application/json' \
  --header 'X-API-Key: YOUR_API_KEY' \
  --data '{
    "organizationId": "YOUR_ORG_ID",
    "sessionId": "YOUR_SESSION_ID",
    "name": "Welcome Campaign",
    "messageTemplate": "hello_world",
    "templateLanguage": "en",
    "recipients": [
      { "phoneNumber": "919876543210", "name": "John Doe" },
      { "phoneNumber": "919876543211", "name": "Jane Smith" }
    ]
  }'
```

**Example response:**

```json
{
  "id": "campaign_uuid",
  "name": "Welcome Campaign",
  "status": "scheduled"
}
```

---

### 11. Get campaign / Execute / Analytics / Audience

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/project/v1/campaigns/:id`         | Get campaign details. Query: `organizationId` |
| POST   | `/api/project/v1/campaigns/:id/send`    | Execute campaign. Body/query: `organizationId` |
| GET    | `/api/project/v1/campaigns/:id/analytics`| Sent/delivered/read/failed. Query: `organizationId` |
| GET    | `/api/project/v1/campaigns/:id/audience` | Recipients list. Query: `organizationId` |

---

### 12. Contacts (Project API)

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/project/v1/contacts`              | List contacts. Query: `organizationId`, `tags` |
| GET    | `/api/project/v1/contacts/:id`         | Get contact by ID. Query: `organizationId` |
| GET    | `/api/project/v1/contacts/by-phone/:phone` | Get contact by phone. Query: `organizationId` |
| POST   | `/api/project/v1/contacts`             | Create or update contact (by phone) |
| PATCH  | `/api/project/v1/contacts/:id`         | Update contact. Query: `organizationId` |

**Create contact – example request:**

```bash
curl --request POST \
  --url https://your-domain.com/api/project/v1/contacts \
  --header 'Content-Type: application/json' \
  --header 'X-API-Key: YOUR_API_KEY' \
  --data '{"destination":"+919876543210","userName":"John Doe","source":"Website","tags":["lead"],"attributes":{"email":"john@example.com"}}'
```

**Example response:**

```json
{
  "id": "contact_id",
  "name": "John Doe",
  "phoneNumber": "919876543210"
}
```

---

### 13. Chats & messages (Project API)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/project/v1/chats` | List chats. Query: `sessionId` (optional) |
| GET | `/api/project/v1/chats/by-phone/:phone` | Get chat(s) and messages for phone. Query: `limit=200` (optional) |
| GET | `/api/project/v1/messages` | List messages for a chat. Query: `chatId` (required) |

---

### 14. Webhooks, templates, media (Project API)

| Method | Path | Description |
|--------|------|-------------|
| GET  | `/api/project/v1/webhooks`     | List webhooks. Query: `organizationId` |
| GET  | `/api/project/v1/webhooks/:id`  | Get webhook. Query: `organizationId` |
| DELETE | `/api/project/v1/webhooks/:id` | Delete webhook. Query: `organizationId` |
| GET  | `/api/project/v1/templates/:id`| Get template by id |
| DELETE | `/api/project/v1/templates/:id`| Delete template (local sync only) |
| GET  | `/api/project/v1/tags`         | List tags. Query: `organizationId` (optional) |
| GET  | `/api/project/v1/media/:mediaId` | Get media. Query: `sessionId` (required), `organizationId` (optional) |

---

## Media upload (for template headers / images by ID)

To use **image/video/document** in template headers or send image by ID, upload first and use the returned WhatsApp **media ID**.

**POST** `/api/media/upload`

- **Auth:** Same as Project API: `X-API-Key: YOUR_API_KEY`
- **Body:** `multipart/form-data` with `sessionId` (text) and `file` (file)

**Example:**

```bash
curl -X POST "https://your-domain.com/api/media/upload" \
  -H "X-API-Key: YOUR_API_KEY" \
  -F "sessionId=YOUR_SESSION_ID" \
  -F "file=@/path/to/image.jpg"
```

**Response:** `{ "success": true, "mediaId": "1234567890...", "url": "..." }`. Use `mediaId` in send-template `header` or in unified message `image.id`.

---

## Sessions (Dashboard API)

Create and manage WhatsApp sessions. Use **Bearer** auth for dashboard; Project API can use **X-API-Key** for `/api/sessions/create` where supported.

| Method | Path | Description |
|--------|------|-------------|
| POST   | `/api/sessions/create` | Create session (QR or Business API) |
| GET    | `/api/sessions` | List all sessions |
| POST   | `/api/sessions/:sessionId/disconnect` | Disconnect session |
| DELETE | `/api/sessions/:sessionId` | Delete session |
| POST   | `/api/sessions/:sessionId/request-message-sync` | Request message sync |
| POST   | `/api/sessions/:sessionId/sync-messages` | Sync messages |
| GET    | `/api/message-sync-requests` | List message sync requests |

**Create session – example (unofficial / QR):**

```bash
curl -X POST -H "Authorization: Bearer YOUR_API_KEY" -H "Content-Type: application/json" \
  -d '{"connectionType":"unofficial"}' \
  https://your-domain.com/api/sessions/create
```

**Create session – example (official Business API):**

```bash
curl -X POST -H "Authorization: Bearer YOUR_API_KEY" -H "Content-Type: application/json" \
  -d '{
    "connectionType": "official",
    "businessApiCredentials": {
      "phoneNumberId": "YOUR_PHONE_NUMBER_ID",
      "accessToken": "YOUR_META_ACCESS_TOKEN",
      "businessAccountId": "YOUR_WABA_ID"
    }
  }' \
  https://your-domain.com/api/sessions/create
```

**Example response:**

```json
{
  "success": true,
  "sessionId": "session_1234567890_abc123",
  "session": {},
  "connectionType": "official"
}
```

---

## Messages (Dashboard API)

| Method | Path | Description |
|--------|------|-------------|
| POST  | `/api/messages/send-text`   | Send text message |
| POST  | `/api/messages/send-reaction`| Send reaction |
| POST  | `/api/messages/send-media`  | Send media (multipart) |
| POST  | `/api/messages/send-location`| Send location |
| POST  | `/api/messages/send-contact` | Send contact (vCard) |
| PATCH | `/api/messages/:messageId/status` | Update message status |

**Send text – example:**

```bash
curl --request POST \
  --url https://your-domain.com/api/messages/send-text \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --data '{"sessionId":"YOUR_SESSION_ID","to":"919876543210","message":"Hello"}'
```

**Send media – example (multipart):**

```bash
curl --request POST \
  --url https://your-domain.com/api/messages/send-media \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "sessionId=YOUR_SESSION_ID" \
  -F "to=919876543210" \
  -F "mediaType=image" \
  -F "file=@/path/to/image.jpg"
```

---

## Auth, Users, API Keys (Dashboard)

| Method | Path | Description |
|--------|------|-------------|
| GET   | `/api/auth/user` | Get current user profile |
| PATCH | `/api/auth/user` | Update current user profile |
| POST  | `/api/auth/change-password` | Change password |
| GET   | `/crm-login` | Auto-login with query `?apiKey=YOUR_KEY` (redirects to dashboard) |
| GET   | `/api/users/by-email` | Get user by email |
| POST  | `/api/users/invite` | Invite user |
| GET   | `/api/keys` | List API keys |
| POST  | `/api/keys` | Create API key |
| DELETE| `/api/keys/:id` | Delete API key |

---

## Webhooks, Chats, Media (Dashboard)

| Method | Path | Description |
|--------|------|-------------|
| GET   | `/api/webhooks` | List webhooks |
| POST  | `/api/webhooks` | Create webhook |
| PATCH | `/api/webhooks/:id` | Update webhook |
| DELETE| `/api/webhooks/:id` | Delete webhook |
| GET   | `/api/webhooks/forwarding-urls` | Get forwarding URLs |
| POST  | `/api/webhooks/forwarding-urls` | Add forwarding URL |
| DELETE| `/api/webhooks/forwarding-urls` | Remove forwarding URL |
| GET   | `/api/chats/:sessionId` | Get chats for session |
| GET   | `/api/chats` | Get all chats |
| PATCH | `/api/chats/:chatId/read` | Mark chat as read |
| GET   | `/api/messages/:chatId` | Get messages for chat |
| POST  | `/api/media/upload` | Upload media |
| GET   | `/api/media/:mediaId` | Get media |
| GET   | `/api/media-proxy` | Proxy media URL |

Resumable upload: `POST /api/media/resumable/start`, `POST /api/media/resumable/upload`, `GET /api/media/resumable/status/:uploadSessionId`, `POST /api/media/resumable/resume`, `POST /api/media/resumable/complete`.

---

## Other endpoints (summary)

- **Dashboard:** `GET /api/dashboard/stats`
- **Website Builder:** `GET/POST /api/website-builder/company-profile`, `GET/POST /api/website-builder/homepage`, `POST /api/website-builder/upload/image`, `GET/POST /api/website-builder/:pageKey`
- **WhatsApp Business webhooks (public):** `GET/POST /api/webhooks/whatsapp-business`, `GET /api/webhooks/whatsapp-business/debug`
- **Public:** `GET /api/public/white-label/config`
- **Plans & billing:** `GET /api/plans`, `GET /api/subscriptions/current`, `GET /api/usage/current`, `POST /api/payments/create-razorpay-order`, `POST /api/payments/verify-razorpay`, `POST /api/payments/checkout-stripe`, `POST /api/subscriptions/cancel`, `GET /api/payments/history`
- **Settings:** `GET/POST /api/settings`, `POST /api/settings/sync-templates`, `POST /api/settings/test-email`, `POST /api/settings/test-whatsapp-business`
- **WhatsApp Flows:** `GET/POST /api/whatsapp-flows`, `GET/PATCH/DELETE /api/whatsapp-flows/:flowId`
- **Templates:** `GET/POST /api/templates`
- **Gallery:** `POST /api/gallery/upload`, `GET /api/gallery`, `DELETE /api/gallery/:id`
- **Organizations:** `GET/POST /api/organizations`, `PATCH /api/organizations/:id`, org theme, members CRUD
- **Contacts (dashboard):** `GET/POST /api/contacts`, `PATCH/DELETE /api/contacts/:id`, bulk tags, assign, import, sync, bulk delete
- **Tags:** `GET/POST /api/tags`, `PATCH/DELETE /api/tags/:id`
- **Opt keywords:** `GET /api/opt-keywords`, `POST /api/opt-keywords`
- **Columns:** `GET /api/columns`
- **Chatbots:** `GET /api/chatbots`
- **CRM:** `POST /api/crm/register` – Register or update user from external CRM; returns user + API key + subscription; enforces tenant_id.

---

## Errors

| Code | Meaning |
|------|---------|
| **401 Unauthorized** | Missing or invalid API key. Use `X-API-Key` (Project API) or `Authorization: Bearer` (Dashboard). |
| **404 Session not found** | `sessionId` does not exist or does not belong to your account. |
| **400 Validation failed** | Invalid or missing body (e.g. missing `sessionId`, `to`, or `message`). |
| **400 WhatsApp Business API not ready** | Reconnect the number in Integrations and retry. |
| **500** | Server or WhatsApp API error; body may include `error` and `message`. |

---

## Quick start

1. Create an API key in the dashboard: **Settings → API Keys**.
2. **Project API – send template (Aisensy-style):**  
   `GET /api/project/v1/campaigns` → then `POST /api/project/v1/campaign/send` with `campaignName`, `destination`, `userName`, and optional `templateParams`, `tags`, `attributes`, `source`.
3. **Project API – REST-style:**  
   `GET /api/project/v1/sessions` for `sessionId` → `POST /api/project/v1/messages` with `type` (`text`, `image`, `video`, `audio`, `document`, `template`) and the matching payload. Or use `send-text` / `send-template`.
4. **Contacts:**  
   `POST /api/project/v1/contacts` to create/update by phone; `GET /api/project/v1/contacts` to list. `GET /api/project/v1/webhooks` for webhook URLs.

For an interactive list and Postman collection, use the in-app **API Endpoints** page (requires permission `api_endpoints.view`). For Project API only, see the **Project API** page in the app.
