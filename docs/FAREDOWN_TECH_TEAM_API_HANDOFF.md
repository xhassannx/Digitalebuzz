# Faredown Tech Team — WhatsApp Send API Handoff

**From:** Helicoptic WhatsApp Platform  
**For:** Faredown engineering (travel website backend / panel)  
**Purpose:** Send Meta-approved WhatsApp templates (`fd_*`) from Faredown using our Project API  
**Language:** `en` (use exact language code shown as APPROVED in templates list)

---

## Credentials you will receive from Helicoptic

Fill these once (do not commit secrets to git):

| Config | Example / notes |
|--------|-----------------|
| `BASE_URL` | `https://YOUR_PANEL_DOMAIN` (HTTPS, no trailing slash) |
| `API_KEY` | Created in panel → **Settings → API Keys** |
| `SESSION_ID` | From `GET /api/project/v1/sessions` — must be **official** (WhatsApp Business Cloud API) |

Every request needs:

```http
X-API-Key: <API_KEY>
Content-Type: application/json
```

Phone numbers: **digits only with country code**, no `+` or spaces.  
Example: `919876543210`

---

## APIs you will use (only these)

### 1) List sessions (one-time / setup)

```http
GET {BASE_URL}/api/project/v1/sessions
```

Pick the connected official session → store `sessionId`.

### 2) List approved templates (verify before go-live)

```http
GET {BASE_URL}/api/project/v1/templates
```

Confirm each `fd_*` name exists with status **APPROVED** and note the exact `language` (e.g. `en` or `en_US`).

### 3) Send template (OTP, confirmations, cancel, B2B — no PDF)

```http
POST {BASE_URL}/api/project/v1/messages/send-template
```

```json
{
  "sessionId": "YOUR_SESSION_ID",
  "to": "919876543210",
  "templateName": "fd_registration_otp",
  "languageCode": "en",
  "templateParams": ["482913"]
}
```

- `templateParams[0]` → `{{1}}`, `[1]` → `{{2}}`, …  
- AUTHENTICATION OTP templates: pass OTP once in `templateParams`; copy-code button is handled by the platform.

**Typical success**

```json
{
  "id": "wamid.HBgL...",
  "status": "sent"
}
```

Log `id` against your user/booking id.

### 4) Send template with PDF header (vouchers, tickets, invoices)

```http
POST {BASE_URL}/api/project/v1/messages
```

```json
{
  "sessionId": "YOUR_SESSION_ID",
  "to": "919876543210",
  "type": "template",
  "template": {
    "name": "fd_flight_eticket_voucher",
    "language": { "code": "en" },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "Sahil Kumar" },
          { "type": "text", "text": "FD-FL-24071101" },
          { "type": "text", "text": "ABC123" },
          { "type": "text", "text": "DEL → BOM" },
          { "type": "text", "text": "25 Jul 2026" }
        ]
      }
    ]
  },
  "headerDocumentUrl": "https://faredown.com/path/to/voucher.pdf"
}
```

`headerDocumentUrl` must be a **public HTTPS URL** your PDF is already available at (same file you email today). Our API fetches it and attaches it as the WhatsApp document header.

### 5) Free-form support reply (only inside 24-hour customer window)

```http
POST {BASE_URL}/api/project/v1/messages/send-text
```

```json
{
  "sessionId": "YOUR_SESSION_ID",
  "to": "919876543210",
  "message": "Thanks for contacting Faredown. How can we help?"
}
```

Outside 24h → use a template again (e.g. `fd_greeting_welcome`).

### 6) Optional helpers

| Method | Path | Use |
|--------|------|-----|
| GET | `/api/project/v1/contacts/by-phone/:phone` | Lookup contact |
| POST | `/api/project/v1/contacts` | Upsert contact |
| GET | `/api/project/v1/chats/by-phone/:phone` | Chat history |
| GET | `/api/project/v1/chats/messaging-window?chatId=` | Is free-form text allowed? |
| GET | `/api/project/v1/subscription` | Debug send limits / plan |

---

## Which template → which API

| Template name | Category | Call |
|---------------|----------|------|
| `fd_greeting_welcome` | MARKETING | `send-template` |
| `fd_registration_welcome` | UTILITY | `send-template` |
| `fd_registration_otp` | AUTH | `send-template` |
| `fd_forgot_password_otp` | AUTH | `send-template` |
| `fd_account_deletion_otp` | AUTH | `send-template` |
| `fd_flight_booking_confirmed` | UTILITY | `send-template` |
| `fd_flight_eticket_voucher` | UTILITY + PDF | `POST /messages` + `headerDocumentUrl` |
| `fd_flight_invoice` | UTILITY + PDF | `POST /messages` + `headerDocumentUrl` |
| `fd_hotel_booking_confirmed` | UTILITY | `send-template` |
| `fd_hotel_voucher` | UTILITY + PDF | `POST /messages` + `headerDocumentUrl` |
| `fd_hotel_invoice` | UTILITY + PDF | `POST /messages` + `headerDocumentUrl` |
| `fd_bus_ticket` | UTILITY + PDF | `POST /messages` + `headerDocumentUrl` |
| `fd_car_ticket` | UTILITY + PDF | `POST /messages` + `headerDocumentUrl` |
| `fd_sightseeing_ticket` | UTILITY + PDF | `POST /messages` + `headerDocumentUrl` |
| `fd_transfers_ticket` | UTILITY + PDF | `POST /messages` + `headerDocumentUrl` |
| `fd_package_booking_confirmed` | UTILITY | `send-template` |
| `fd_booking_cancelled` | UTILITY | `send-template` |
| `fd_payment_pending` | UTILITY | `send-template` |
| `fd_resend_voucher` | UTILITY + PDF | `POST /messages` + `headerDocumentUrl` |
| `fd_ancillary_confirmation` | UTILITY | `send-template` |
| `fd_agent_account_activated` | UTILITY | `send-template` |
| `fd_agent_account_deactivated` | UTILITY | `send-template` |
| `fd_deposit_confirmed` | UTILITY | `send-template` |

---

## Sample payloads (copy-paste)

### Registration OTP

```json
{
  "sessionId": "YOUR_SESSION_ID",
  "to": "919876543210",
  "templateName": "fd_registration_otp",
  "languageCode": "en",
  "templateParams": ["482913"]
}
```

### Registration welcome

```json
{
  "sessionId": "YOUR_SESSION_ID",
  "to": "919876543210",
  "templateName": "fd_registration_welcome",
  "languageCode": "en",
  "templateParams": [
    "Sahil",
    "sahil@example.com",
    "Jul 11, 2026 at 1:45 PM (IST)"
  ]
}
```

### Flight booking confirmed

```json
{
  "sessionId": "YOUR_SESSION_ID",
  "to": "919876543210",
  "templateName": "fd_flight_booking_confirmed",
  "languageCode": "en",
  "templateParams": [
    "Sahil Kumar",
    "confirmed",
    "FD-FL-24071101",
    "ABC123",
    "DEL → BOM",
    "25 Jul 2026",
    "Sahil Kumar",
    "INR 8,450"
  ]
}
```

### Hotel booking confirmed

```json
{
  "sessionId": "YOUR_SESSION_ID",
  "to": "919876543210",
  "templateName": "fd_hotel_booking_confirmed",
  "languageCode": "en",
  "templateParams": [
    "Sahil Kumar",
    "confirmed",
    "FD-HT-24071188",
    "The Grand Plaza, Dubai",
    "20 Aug 2026",
    "23 Aug 2026",
    "3",
    "2 Adults, 1 Child",
    "AED 1,290"
  ]
}
```

### Booking cancelled

```json
{
  "sessionId": "YOUR_SESSION_ID",
  "to": "919876543210",
  "templateName": "fd_booking_cancelled",
  "languageCode": "en",
  "templateParams": [
    "Sahil Kumar",
    "flight",
    "FD-FL-24071101",
    "INR 7,200 (processing 5–7 days)",
    "CANCELLED"
  ]
}
```

### Payment pending / failed

```json
{
  "sessionId": "YOUR_SESSION_ID",
  "to": "919876543210",
  "templateName": "fd_payment_pending",
  "languageCode": "en",
  "templateParams": [
    "Sahil Kumar",
    "flight",
    "FD-FL-24071101",
    "INR 8,450",
    "Payment gateway timeout"
  ]
}
```

### Flight e-ticket PDF

```json
{
  "sessionId": "YOUR_SESSION_ID",
  "to": "919876543210",
  "type": "template",
  "template": {
    "name": "fd_flight_eticket_voucher",
    "language": { "code": "en" },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "Sahil Kumar" },
          { "type": "text", "text": "FD-FL-24071101" },
          { "type": "text", "text": "ABC123" },
          { "type": "text", "text": "DEL → BOM" },
          { "type": "text", "text": "25 Jul 2026" }
        ]
      }
    ]
  },
  "headerDocumentUrl": "https://YOUR_CDN/vouchers/FD-FL-24071101.pdf"
}
```

### Hotel voucher PDF

```json
{
  "sessionId": "YOUR_SESSION_ID",
  "to": "919876543210",
  "type": "template",
  "template": {
    "name": "fd_hotel_voucher",
    "language": { "code": "en" },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "Sahil Kumar" },
          { "type": "text", "text": "FD-HT-24071188" },
          { "type": "text", "text": "The Grand Plaza, Dubai" },
          { "type": "text", "text": "20 Aug 2026" },
          { "type": "text", "text": "23 Aug 2026" },
          { "type": "text", "text": "HB-998877" }
        ]
      }
    ]
  },
  "headerDocumentUrl": "https://YOUR_CDN/vouchers/FD-HT-24071188.pdf"
}
```

### Bus / car / sightseeing / transfers / invoice / resend

Same PDF pattern as above. Body param order = `{{1}}`…`{{N}}` from your Meta template. Template names:

- `fd_bus_ticket` — name, bookingId, route, dateTime, seats, amount  
- `fd_car_ticket` — name, bookingId, pickup, drop, dateTime, amount  
- `fd_sightseeing_ticket` — name, bookingId, activity, date, travellers, amount  
- `fd_transfers_ticket` — name, bookingId, from, to, dateTime, passengers, amount  
- `fd_flight_invoice` — name, bookingId, amount, status  
- `fd_hotel_invoice` — name, bookingId, hotel, amount  
- `fd_resend_voucher` — name, docType, bookingId, service, date  

### Agent / deposit (B2B)

```json
{
  "sessionId": "YOUR_SESSION_ID",
  "to": "919876543210",
  "templateName": "fd_agent_account_activated",
  "languageCode": "en",
  "templateParams": [
    "Travel World Agency",
    "agent@travelworld.com",
    "https://agent.faredown.com"
  ]
}
```

```json
{
  "sessionId": "YOUR_SESSION_ID",
  "to": "919876543210",
  "templateName": "fd_deposit_confirmed",
  "languageCode": "en",
  "templateParams": [
    "Travel World Agency",
    "INR 50,000",
    "AG-1001",
    "TXN-998877",
    "INR 1,25,000"
  ]
}
```

### Greeting (marketing)

```json
{
  "sessionId": "YOUR_SESSION_ID",
  "to": "919876543210",
  "templateName": "fd_greeting_welcome",
  "languageCode": "en",
  "templateParams": ["Sahil"]
}
```

Quick-reply buttons (Book Flight / Book Hotel / My Booking / Talk to Support) are fixed on the Meta template. To react to taps, configure a **webhook forwarding URL** with Helicoptic (optional second phase).

---

## Where to call from Faredown (suggested)

| Faredown event | Template |
|----------------|----------|
| Registration OTP | `fd_registration_otp` |
| Welcome email | `fd_registration_welcome` |
| Forgot / delete OTP | `fd_forgot_password_otp` / `fd_account_deletion_otp` |
| Flight confirmed | `fd_flight_booking_confirmed` then PDF templates |
| Hotel confirmed | `fd_hotel_booking_confirmed` then voucher/invoice PDF |
| Bus/car/SS/transfer ticket | matching `fd_*_ticket` + PDF |
| Cancel / payment fail | `fd_booking_cancelled` / `fd_payment_pending` |
| Agent activate / deposit | `fd_agent_account_*` / `fd_deposit_confirmed` |

Keep email as fallback until WhatsApp delivery is verified.

---

## Curl smoke tests

```bash
# 1) Session
curl -s "$BASE_URL/api/project/v1/sessions" -H "X-API-Key: $API_KEY"

# 2) Templates
curl -s "$BASE_URL/api/project/v1/templates" -H "X-API-Key: $API_KEY"

# 3) OTP
curl -s -X POST "$BASE_URL/api/project/v1/messages/send-template" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"to\":\"919876543210\",\"templateName\":\"fd_registration_otp\",\"languageCode\":\"en\",\"templateParams\":[\"123456\"]}"
```

---

## Common errors

| Issue | Fix |
|-------|-----|
| Template requires Business API | Use official Cloud API `sessionId`, not QR/unofficial |
| API not ready | Reconnect WhatsApp Business in Helicoptic Integrations |
| Template not found / Meta reject | Name + `languageCode` must match APPROVED template exactly |
| Document header missing | Use `POST /messages` with `headerDocumentUrl` (public PDF) |
| Free-form text fails | Outside 24h window — send a template |
| 401 | Wrong / missing `X-API-Key` |

---

## Ownership

| Helicoptic | Faredown |
|------------|----------|
| WABA connection, API key, session, inbox | When to send, phone + template params, PDF URLs |
| Delivery to Meta Cloud API | Map booking fields → `templateParams` |
| Template sync from Meta | Keep Meta templates APPROVED |

**Do not call Meta Graph API directly.** Send only through Helicoptic Project API above.

---

## Full reference (optional)

Longer guide with PHP helper sketch: `docs/FAREDOWN_WHATSAPP_API_INTEGRATION.md` in the Helicoptic repo.
