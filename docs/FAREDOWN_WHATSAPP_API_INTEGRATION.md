# Faredown × Helicoptic WhatsApp — Project API Integration Guide

**Audience:** Faredown engineering (Backend / Cursor agent)  
**Brand:** Faredown — Upgrade. Bargain. Book.  
**Support:** support@faredown.com  
**Language:** `en` (duplicate as `en_US` / `en_GB` in Meta if required by WABA country)  
**Platform:** Helicoptic WhatsApp Business Panel — **Project API v1**  
**Version:** 1.0 — share with Faredown for wiring transactional WhatsApp

---

## Summary

Faredown already has Meta message templates mapped to B2C/B2B flows (OTP, booking confirmations, vouchers/tickets, invoices, cancellations, agent/deposit notices). This panel exposes a **Project API** so Faredown can send those templates from existing PHP/controllers instead of (or in addition to) email/SMS.

| What Faredown needs | Helicoptic API |
|---------------------|----------------|
| Send OTP / booking / cancel / B2B notices | `POST /api/project/v1/messages/send-template` |
| Send voucher/ticket/invoice **PDF** templates | `POST /api/project/v1/messages` (`type: "template"` + `headerDocumentUrl`) |
| Free-form support replies (inside 24h) | `POST /api/project/v1/messages/send-text` |
| Discover session + approved templates | `GET /api/project/v1/sessions`, `GET /api/project/v1/templates` |
| Receive customer replies / button taps | Webhooks + forwarding URL to Faredown |

> **Requirement:** Use a WhatsApp session with `connectionType: "official"` (WhatsApp Business Cloud API). Unofficial/QR sessions cannot send Meta templates.

---

## 1. Prerequisites (Helicoptic panel)

Before Faredown calls the API:

1. Connect **WhatsApp Business API (Official)** under Integrations — status **Connected**.
2. Create / sync all Meta templates listed in §6 (status **APPROVED**).
3. Create an API key: **Settings → API Keys**.
4. Note `BASE_URL` (public HTTPS), e.g. `https://whatsapp.your-domain.com`.
5. Call `GET /api/project/v1/sessions` and store the `sessionId` for the connected number.

### Auth header (every Project API call)

```http
X-API-Key: YOUR_API_KEY
Content-Type: application/json
```

(`Authorization: Bearer YOUR_API_KEY` is also accepted on many routes.)

### Base paths

| Purpose | Base |
|---------|------|
| Project API | `{BASE_URL}/api/project/v1` |
| Media upload | `{BASE_URL}/api/media/upload` |
| Webhook admin (panel) | `{BASE_URL}/api/webhooks` |

---

## 2. Quick start (copy into Faredown)

### 2.1 Resolve session

```bash
curl -s "{BASE_URL}/api/project/v1/sessions" \
  -H "X-API-Key: YOUR_API_KEY"
```

Use a session with `"connectionType": "official"` and status connected.

### 2.2 Confirm templates are approved

```bash
curl -s "{BASE_URL}/api/project/v1/templates" \
  -H "X-API-Key: YOUR_API_KEY"
```

Match by `name` (e.g. `fd_registration_otp`) and `language` / `status === APPROVED`.

### 2.3 Send a text-only template (OTP example)

```bash
curl -X POST "{BASE_URL}/api/project/v1/messages/send-template" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "YOUR_SESSION_ID",
    "to": "919876543210",
    "templateName": "fd_registration_otp",
    "languageCode": "en",
    "templateParams": ["482913"]
  }'
```

**Phone format:** digits only with country code, no `+` or spaces (e.g. `919876543210`).

**Success shape (typical):**

```json
{
  "id": "wamid.HBgL...",
  "status": "sent",
  "timestamp": "2026-07-11T08:00:00.000Z"
}
```

### 2.4 Send a document-header template (flight e-ticket PDF)

Prefer the **unified** messages endpoint — it accepts a public PDF URL and uploads it to Meta for you:

```bash
curl -X POST "{BASE_URL}/api/project/v1/messages" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
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
    "headerDocumentUrl": "https://faredown.com/path/to/flight_voucher.pdf"
  }'
```

`headerDocumentUrl` must be a **publicly fetchable** HTTPS URL (or a path the Helicoptic server can read). Generate the same PDF Faredown already emails (`flight_voucher`, `hotel_voucher`, bus/car tickets).

### 2.5 Session text (support — only inside 24h window)

```bash
curl -X POST "{BASE_URL}/api/project/v1/messages/send-text" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "YOUR_SESSION_ID",
    "to": "919876543210",
    "message": "Thanks for contacting Faredown support. How can we help?"
  }'
```

Outside the 24-hour customer care window, use an approved **template** again (e.g. `fd_greeting_welcome` or a utility notice).

---

## 3. Core APIs (reference)

### 3.1 `POST /api/project/v1/messages/send-template`

Primary endpoint for **non-document** templates (OTP, confirmations, cancel, payment, B2B).

| Field | Required | Description |
|-------|----------|-------------|
| `sessionId` | Yes | From `GET /sessions` |
| `to` | Yes | E.164 digits, no `+` |
| `templateName` | Yes | Exact Meta template name |
| `languageCode` | No | Default `en` — must match approved language |
| `templateParams` | No | Ordered body vars `{{1}}`, `{{2}}`, … as string array |
| `header` | No | `{ "type": "image"\|"video"\|"document", "id": "WHATSAPP_MEDIA_ID" }` |
| `components` | No | Alias for `templateParams` (legacy) |

**AUTHENTICATION templates:** If the Meta template is category `AUTHENTICATION` with a copy-code / OTP button, Helicoptic duplicates the OTP onto the button component automatically. Pass the OTP only once in `templateParams[0]`.

### 3.2 `POST /api/project/v1/messages` (unified)

| Field | Required | Description |
|-------|----------|-------------|
| `sessionId` | Yes | Official session |
| `to` | Yes | Recipient phone |
| `type` | Yes | `text` \| `image` \| `video` \| `audio` \| `document` \| **`template`** |
| `template` | For template | `{ name, language: { code }, components? }` |
| `headerDocumentUrl` | For PDF headers | Public URL to PDF (server uploads to Meta) |
| `headerDocumentId` | Alt | Existing WhatsApp media id |
| `text` | For text | `{ "body": "..." }` |

**Recommended for Faredown vouchers/tickets/invoices.**

### 3.3 `POST /api/project/v1/messages/send-text`

Free-form body after the customer has messaged (or replied) within **24 hours**.

### 3.4 `GET /api/project/v1/sessions`

Returns sessions. Cache `sessionId` in Faredown config/env.

### 3.5 `GET /api/project/v1/templates`

List synced templates. Filter `APPROVED` before production sends.

### 3.6 Optional helpers

| Method | Path | Use |
|--------|------|-----|
| GET | `/api/project/v1/contacts/by-phone/:phone` | Lookup contact |
| POST | `/api/project/v1/contacts` | Upsert contact on register/book |
| GET | `/api/project/v1/chats/by-phone/:phone` | Conversation + recent messages |
| GET | `/api/project/v1/chats/messaging-window?chatId=` | Whether free-form text is allowed |
| GET | `/api/project/v1/messages?chatId=` | Message history |
| GET | `/api/project/v1/messages/:messageId` | Delivery / status detail |
| GET | `/api/project/v1/subscription` | Debug plan / send limits |
| POST | `/api/project/v1/campaign/send` | AiSensy-style single send (`campaignName` = template name) |

### 3.7 Media upload (optional)

```bash
curl -X POST "{BASE_URL}/api/media/upload" \
  -H "X-API-Key: YOUR_API_KEY" \
  -F "sessionId=YOUR_SESSION_ID" \
  -F "file=@./voucher.pdf"
```

Response includes `mediaId`. For **document headers**, prefer `headerDocumentUrl` on unified `POST /messages` (most reliable for PDFs). If you already have a WhatsApp document media id:

```json
{
  "sessionId": "...",
  "to": "...",
  "templateName": "fd_flight_eticket_voucher",
  "languageCode": "en",
  "templateParams": ["Sahil Kumar", "FD-FL-24071101", "ABC123", "DEL → BOM", "25 Jul 2026"],
  "header": { "type": "document", "id": "MEDIA_ID" }
}
```

---

## 4. Faredown event → template → API

Wire these at the same points you currently send email/SMS.

| Faredown event (today) | Template name | API |
|------------------------|---------------|-----|
| Registration OTP (`auth.php`) | `fd_registration_otp` | `send-template` |
| Welcome email | `fd_registration_welcome` | `send-template` |
| Forgot password OTP | `fd_forgot_password_otp` | `send-template` |
| Account deletion OTP | `fd_account_deletion_otp` | `send-template` |
| Flight booking confirmed | `fd_flight_booking_confirmed` | `send-template` |
| Flight e-ticket PDF | `fd_flight_eticket_voucher` | `POST /messages` + `headerDocumentUrl` |
| Flight invoice PDF | `fd_flight_invoice` | `POST /messages` + `headerDocumentUrl` |
| Hotel booking confirmed | `fd_hotel_booking_confirmed` | `send-template` |
| Hotel voucher PDF | `fd_hotel_voucher` | `POST /messages` + `headerDocumentUrl` |
| Hotel invoice PDF | `fd_hotel_invoice` | `POST /messages` + `headerDocumentUrl` |
| Bus / car / sightseeing / transfers ticket | `fd_bus_ticket` / `fd_car_ticket` / `fd_sightseeing_ticket` / `fd_transfers_ticket` | `POST /messages` + `headerDocumentUrl` |
| Package confirmed | `fd_package_booking_confirmed` | `send-template` |
| Booking cancelled | `fd_booking_cancelled` | `send-template` |
| Payment pending/failed | `fd_payment_pending` | `send-template` |
| Resend voucher | `fd_resend_voucher` | `POST /messages` + `headerDocumentUrl` |
| Ancillary (TripAdd / BRB) | `fd_ancillary_confirmation` | `send-template` |
| Agent activated / deactivated | `fd_agent_account_activated` / `fd_agent_account_deactivated` | `send-template` |
| Deposit confirmed | `fd_deposit_confirmed` | `send-template` |
| First contact / re-engage | `fd_greeting_welcome` | `send-template` (MARKETING) |
| Customer replied / button tap | — | Webhook → optional `send-text` |

Suggested Faredown call sites (from template doc):

- `b2c/controllers/auth.php` — OTP + welcome  
- `flight_send_booking_confirmation_notification()`  
- `hotel_send_admin_booking_notification()` / `mail_send_hotel_voucher`  
- `voucher.php` email_ticket paths (bus/car/sightseeing/transfers)  
- Supervision account activate/deactivate / deposit  

---

## 5. Parameter rules

1. Body variables are **positional**: `templateParams[0]` → `{{1}}`, `[1]` → `{{2}}`, etc.
2. Do **not** put raw customer free-text that can break Meta policy; keep values short and structured.
3. Prefer **URL buttons** on the Meta template for deep links; do not stuff long URLs into body text when a button exists.
4. `languageCode` must match the approved template language exactly (`en` vs `en_US`).
5. Document templates need a **Header = Document** at Meta approval time (sample PDF). At send time, pass the live PDF via `headerDocumentUrl`.
6. Keep utility body copy non-promotional (no “discount / offer / sale” in UTILITY).

---

## 6. Full template catalog + sample payloads

All names below must be created in **Meta Business Manager → WhatsApp Manager → Message templates**, then synced into Helicoptic.

### 6.1 `fd_greeting_welcome` — MARKETING

| Var | Meaning | Sample |
|-----|---------|--------|
| `{{1}}` | First name | Sahil |

```json
{
  "sessionId": "SESSION_ID",
  "to": "919876543210",
  "templateName": "fd_greeting_welcome",
  "languageCode": "en",
  "templateParams": ["Sahil"]
}
```

Quick replies (Book Flight / Book Hotel / My Booking / Talk to Support) are fixed on the template. Handle taps via **webhook** inbound interactive / button reply.

---

### 6.2 `fd_registration_welcome` — UTILITY

| Var | Meaning | Sample |
|-----|---------|--------|
| `{{1}}` | First name | Sahil |
| `{{2}}` | Email | sahil@example.com |
| `{{3}}` | Registered at | Jul 11, 2026 at 1:45 PM (IST) |

```json
{
  "sessionId": "SESSION_ID",
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

---

### 6.3–6.5 Authentication OTPs

| Template | `{{1}}` |
|----------|---------|
| `fd_registration_otp` | 6-digit OTP |
| `fd_forgot_password_otp` | 6-digit OTP |
| `fd_account_deletion_otp` | 6-digit OTP |

```json
{
  "sessionId": "SESSION_ID",
  "to": "919876543210",
  "templateName": "fd_registration_otp",
  "languageCode": "en",
  "templateParams": ["482913"]
}
```

---

### 6.6 `fd_flight_booking_confirmed` — UTILITY

| Var | Meaning | Sample |
|-----|---------|--------|
| `{{1}}` | Customer name | Sahil Kumar |
| `{{2}}` | Status | confirmed |
| `{{3}}` | Booking ID | FD-FL-24071101 |
| `{{4}}` | Airline PNR | ABC123 |
| `{{5}}` | Route | DEL → BOM |
| `{{6}}` | Travel date | 25 Jul 2026 |
| `{{7}}` | Lead passenger | Sahil Kumar |
| `{{8}}` | Amount | INR 8,450 |

```json
{
  "sessionId": "SESSION_ID",
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

Often followed by §6.7 / §6.8 with PDF.

---

### 6.7 `fd_flight_eticket_voucher` — UTILITY + Document header

| Var | Sample |
|-----|--------|
| `{{1}}`–`{{5}}` | Name, Booking ID, PNR, Route, Date |

```json
{
  "sessionId": "SESSION_ID",
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
  "headerDocumentUrl": "https://YOUR_FAREDOWN_CDN/vouchers/FD-FL-24071101.pdf"
}
```

---

### 6.8 `fd_flight_invoice` — UTILITY + Document

| Var | Sample |
|-----|--------|
| `{{1}}` | Sahil Kumar |
| `{{2}}` | FD-FL-24071101 |
| `{{3}}` | INR 8,450 |
| `{{4}}` | CONFIRMED |

Same pattern as §6.7 with `template.name = "fd_flight_invoice"` and invoice PDF URL.

---

### 6.9 `fd_hotel_booking_confirmed` — UTILITY

| Var | Meaning | Sample |
|-----|---------|--------|
| `{{1}}` | Guest name | Sahil Kumar |
| `{{2}}` | Status | confirmed |
| `{{3}}` | Booking ID | FD-HT-24071188 |
| `{{4}}` | Hotel | The Grand Plaza, Dubai |
| `{{5}}` | Check-in | 20 Aug 2026 |
| `{{6}}` | Check-out | 23 Aug 2026 |
| `{{7}}` | Nights | 3 |
| `{{8}}` | Guests | 2 Adults, 1 Child |
| `{{9}}` | Amount | AED 1,290 |

```json
{
  "sessionId": "SESSION_ID",
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

---

### 6.10 `fd_hotel_voucher` — Document

Body vars: name, booking, hotel, check-in, check-out, supplier ref (`{{1}}`…`{{6}}`) + `headerDocumentUrl`.

### 6.11 `fd_hotel_invoice` — Document

Body vars: name, booking, hotel, amount (`{{1}}`…`{{4}}`) + PDF.

### 6.12–6.15 Tickets (Document)

| Template | Params (order) |
|----------|----------------|
| `fd_bus_ticket` | name, bookingId, route, travelDateTime, seats, amount |
| `fd_car_ticket` | name, bookingId, pickup, drop, dateTime, amount |
| `fd_sightseeing_ticket` | name, bookingId, activity, date, travellers, amount |
| `fd_transfers_ticket` | name, bookingId, from, to, dateTime, passengers, amount |

Use unified `POST /messages` + `headerDocumentUrl` for each.

---

### 6.16 `fd_package_booking_confirmed`

Params: name, status, packageBooking, flightRef, hotelRef, travelDates, amount.

### 6.17 `fd_booking_cancelled`

Params: name, serviceType (`flight`/`hotel`/`bus`), bookingId, refundText, status.

### 6.18 `fd_payment_pending`

Params: name, serviceType, reference, amount, reason.

### 6.19 `fd_resend_voucher` — Document

Params: name, docType (`flight e-ticket` / `hotel voucher`), bookingId, service, date + PDF URL.

### 6.20 `fd_ancillary_confirmation`

Params: name, booking, product, confirmationNo, details (prefer URL button on template for links).

### 6.21–6.23 B2B / supervision

| Template | Params |
|----------|--------|
| `fd_agent_account_activated` | agencyName, loginId, portalUrl |
| `fd_agent_account_deactivated` | agencyName, loginId |
| `fd_deposit_confirmed` | name, amount, accountId, txnRef, updatedBalance |

---

## 7. Suggested Faredown PHP helper (sketch)

```php
<?php
/**
 * Minimal Helicoptic Project API client for Faredown.
 * Put BASE_URL, API_KEY, SESSION_ID in env/config.
 */
function helicoptic_send_template(string $to, string $templateName, array $params, ?string $language = 'en'): array {
    $payload = [
        'sessionId' => getenv('HELICOPTIC_SESSION_ID'),
        'to' => preg_replace('/\D+/', '', $to),
        'templateName' => $templateName,
        'languageCode' => $language,
        'templateParams' => array_map('strval', $params),
    ];
    return helicoptic_request('POST', '/api/project/v1/messages/send-template', $payload);
}

function helicoptic_send_template_with_pdf(
    string $to,
    string $templateName,
    array $params,
    string $pdfPublicUrl,
    ?string $language = 'en'
): array {
    $bodyParams = [];
    foreach ($params as $p) {
        $bodyParams[] = ['type' => 'text', 'text' => (string) $p];
    }
    $payload = [
        'sessionId' => getenv('HELICOPTIC_SESSION_ID'),
        'to' => preg_replace('/\D+/', '', $to),
        'type' => 'template',
        'template' => [
            'name' => $templateName,
            'language' => ['code' => $language],
            'components' => [
                ['type' => 'body', 'parameters' => $bodyParams],
            ],
        ],
        'headerDocumentUrl' => $pdfPublicUrl,
    ];
    return helicoptic_request('POST', '/api/project/v1/messages', $payload);
}

function helicoptic_request(string $method, string $path, ?array $json = null): array {
    $url = rtrim(getenv('HELICOPTIC_BASE_URL'), '/') . $path;
    $ch = curl_init($url);
    $headers = [
        'X-API-Key: ' . getenv('HELICOPTIC_API_KEY'),
        'Accept: application/json',
    ];
    if ($json !== null) {
        $headers[] = 'Content-Type: application/json';
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($json));
    }
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 60,
    ]);
    $raw = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if ($raw === false) {
        throw new RuntimeException('Helicoptic curl error: ' . curl_error($ch));
    }
    $data = json_decode($raw, true) ?? [];
    if ($code >= 400) {
        throw new RuntimeException('Helicoptic HTTP ' . $code . ': ' . $raw);
    }
    return $data;
}

// Examples:
// helicoptic_send_template($phone, 'fd_registration_otp', [$otp]);
// helicoptic_send_template_with_pdf($phone, 'fd_flight_eticket_voucher', [$name,$id,$pnr,$route,$date], $pdfUrl);
```

Env vars for Faredown:

```env
HELICOPTIC_BASE_URL=https://your-helicoptic-domain.com
HELICOPTIC_API_KEY=wapi_xxxxxxxx
HELICOPTIC_SESSION_ID=wb_xxxxxxxx
```

---

## 8. Inbound messages & button replies (webhooks)

Transactional outbound is enough for OTP/booking PDFs. For **greeting quick replies** and live support, Faredown should receive inbound events.

### Panel setup

1. In Helicoptic: configure a **webhook / forwarding URL** pointing at Faredown, e.g.  
   `https://api.faredown.com/webhooks/whatsapp-helicoptic`
2. Endpoint must accept `POST` JSON and respond `200` quickly.
3. On button reply (e.g. “My Booking”), Faredown can:
   - look up booking by phone, then  
   - `send-template` / `send-text` as appropriate.

### Useful Project API after inbound

| Need | Call |
|------|------|
| Find chat by phone | `GET /api/project/v1/chats/by-phone/{phone}` |
| Check 24h window | `GET /api/project/v1/chats/messaging-window?chatId=` |
| Reply in session | `POST /api/project/v1/messages/send-text` |

Human agents can also handle the same chats in the Helicoptic **Inbox** UI.

---

## 9. Errors & operational notes

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| 400 “Template messages require WhatsApp Business API” | Unofficial session | Use official Cloud API session |
| 400 “WhatsApp Business API not ready” | Token / reconnect needed | Reconnect Integration in panel |
| Template send fails / Meta error | Name/language mismatch or not APPROVED | `GET /templates`, match exact name + language |
| Document header error | Missing PDF | Pass `headerDocumentUrl` on unified `/messages` |
| Free-form text rejected | Outside 24h window | Send a template instead |
| Subscription / usage errors | Plan inactive or limit | `GET /api/project/v1/subscription` |
| Wrong recipient | Bad phone format | Digits + country code only |

**Idempotency tip:** On book confirm, send confirmation template once; send voucher PDF as a second call. Log Helicoptic `id` (`wamid…`) against Faredown booking id for support.

**Retries:** Prefer retry on network/5xx only. Do not blindly retry OTP on 200 — user may get duplicate codes.

---

## 10. Meta submit checklist (Faredown WABA)

1. Submit **AUTHENTICATION** OTP templates first.  
2. Submit **UTILITY** booking + voucher templates with **sample PDFs** for document headers.  
3. Submit **MARKETING** `fd_greeting_welcome` last (stricter review).  
4. Body &lt; 1024 chars; match button domains to verified website.  
5. After approval, sync in Helicoptic Templates, then wire PHP as in §4.

---

## 11. Minimal go-live order

1. Panel: WABA connected + API key + `sessionId`.  
2. Meta: approve at least `fd_registration_otp` + one booking + one document voucher.  
3. Faredown: env vars + helpers (§7).  
4. Wire OTP path end-to-end (highest ROI).  
5. Wire flight/hotel confirm + PDF.  
6. Wire remaining tickets / cancel / payment.  
7. Add webhook for greeting buttons + support.  
8. Keep email as fallback until WhatsApp delivery rates are verified.

---

## 12. Cursor agent prompt (paste into Faredown repo)

Use this when asking Cursor to implement the integration:

```text
Integrate Helicoptic WhatsApp Project API for Faredown transactional messages.

Config (env):
- HELICOPTIC_BASE_URL
- HELICOPTIC_API_KEY
- HELICOPTIC_SESSION_ID

Rules:
- Auth header: X-API-Key
- Phone: digits with country code, no +
- Text/OTP/confirm/cancel/B2B: POST /api/project/v1/messages/send-template
  body: { sessionId, to, templateName, languageCode: "en", templateParams: string[] }
- PDF vouchers/tickets/invoices: POST /api/project/v1/messages
  type "template", template.name + language + body components, plus headerDocumentUrl = public PDF URL
- Support replies inside 24h: POST /api/project/v1/messages/send-text
- Do not call Meta Graph directly; use Helicoptic Project API only
- Wire at: auth OTP/welcome, flight_send_booking_confirmation_notification,
  hotel voucher/confirm, voucher.php ticket emails, cancel/payment, agent deposit/activate
- Template names start with fd_ (see FAREDOWN_WHATSAPP_API_INTEGRATION.md catalog)
- Log wamid response id against booking/user id; fail soft and keep email fallback
```

---

## 13. Contact / ownership

| Party | Owns |
|-------|------|
| Helicoptic | WABA connection in panel, API keys, inbox, template sync, delivery to Meta |
| Faredown | Meta template content approval (or shared WABA), PDF generation, when to send, customer PII mapping, webhook consumer |

For panel API details beyond this guide, see Helicoptic `docs/API.md` and the in-app **Project API** / Postman collection.
