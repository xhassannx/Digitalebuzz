# Licensor / customer portal ↔ Whitelabel panel API

The whitelabel installation shares **`PRODUCTION_KEY`** with the licensor portal (`CUSTOMER_API_BASE_URL`). The panel exposes **read-only onboarding data** and an **admin login bypass** so the source-code provider can audit outstanding fees or open the same admin URLs as the SaaS owner.

**Security:** `PRODUCTION_KEY` is equivalent to root access for these endpoints and for `POST /api/remote/admin-login`. Store it only on servers, never in public repos or client-only apps.

---

## 3. Panel summary (credit-line, wallets, org id)

**`GET`** `{PANEL_ORIGIN}/api/remote/panel-summary`

Returns `whitelabel_org_id` (from panel env `WHITELABEL_ORG_ID`), live SaaS credit-line facility balance, wallet billing flags, org billing mode counts, and credit-line org list.

## 4. Admin login (one-time panel URL)

**`POST`** `{PANEL_ORIGIN}/api/remote/admin-login`  
Headers: production key. Body optional: `{ "redirect": "/admin/onboarding-fees" }`.

Response includes **`login_url`** / **`login_token`**. The SaaS portal opens `login_url` in a new tab so the session cookie is set on the **panel host** (cross-host `Set-Cookie` forwarding does not work).

**`GET`** `{PANEL_ORIGIN}/api/remote/admin-login/consume?token=…`  
Consumes the one-time token (2 minutes, single use), establishes SaaS-owner session, redirects.

Same-origin callers (e.g. `/licensor-access`) also receive a session on the POST response.

---

## Authentication (all `/api/remote/*` routes except consume)

Send **either**:

- Header: `X-Production-Key: <same value as PRODUCTION_KEY on the whitelabel server>`, or  
- Header: `Authorization: Bearer <PRODUCTION_KEY>`

Same pattern as existing remote deploy routes:

- `GET /api/updates/status-remote`
- `POST /api/updates/sync-remote`

---

## 1. Onboarding summary (for your portal dashboard)

**`GET`** `{PANEL_ORIGIN}/api/remote/onboarding-summary`

Example:

```bash
curl -sS -H "X-Production-Key: YOUR_PRODUCTION_KEY" \
  "https://customer-panel.example.com/api/remote/onboarding-summary"
```

Response (shape may grow; stable fields intended for portals):

| Field | Meaning |
|--------|--------|
| `panel_base_url` | Resolved public base URL when possible |
| `admin_onboarding_fees_url` | Direct link to the same UI as **Admin → Onboarding fees** |
| `licensor_access_url` | Link to browser login page using production key (`/licensor-access`) |
| `outstanding_total_minor` | Sum of unpaid onboarding rows (`pending` + `failed`, `amount_minor`) |
| `outstanding_amount_limit_minor` | From synced `/api/customer` `outstanding_amount_limit` (**major** units, e.g. INR rupees — same as `onboarding_fee`), converted to smallest units for this field |
| `over_outstanding_limit` | `true` if total &gt; limit (when limit set) |
| `payable_line_count` | Rows currently selectable for **Pay outstanding** |
| `line_counts_by_status` | Counts by status |
| `configured_batch_gateway` | Internal gateway id from contract (or `null`) |
| `billing_currency` | From synced contract |
| `platform_last_sync_at` / `platform_last_sync_status` | Last platform master sync |

#### Example response `200 OK` (`GET /api/remote/onboarding-summary`)

```json
{
  "panel_base_url": "https://helicopticsolutions.in",
  "admin_onboarding_fees_path": "/admin/onboarding-fees",
  "admin_onboarding_fees_url": "https://helicopticsolutions.in/admin/onboarding-fees",
  "licensor_access_path": "/licensor-access",
  "licensor_access_url": "https://helicopticsolutions.in/licensor-access",
  "billing_currency": "INR",
  "outstanding_amount_limit_minor": 1000000,
  "outstanding_total_minor": 8500,
  "over_outstanding_limit": false,
  "payable_line_count": 3,
  "line_counts_by_status": {
    "pending": 4,
    "paid": 12,
    "failed": 0,
    "waived": 1,
    "cancelled": 0
  },
  "configured_batch_gateway": "razorpay",
  "platform_last_sync_at": "2026-03-28T10:15:00.000Z",
  "platform_last_sync_status": "ok"
}
```

Notes:

- `panel_base_url` / `*_url` fields may be `null` if `BASE_URL` / `PUBLIC_APP_URL` is unset and the request does not yield a reliable host (e.g. some CLI calls).
- `outstanding_amount_limit_minor` is `null` if the synced contract has no limit. The portal field `outstanding_amount_limit` is interpreted as **major** currency (same as monthly `onboarding_fee`), not pre-scaled to paise.
- `configured_batch_gateway` is `null` if `payment_gateway` is missing or unsupported in the synced contract.
- `platform_last_sync_at` / `platform_last_sync_status` are `null` if platform master has never synced.

---

## 2. Onboarding line items (optional detail)

**`GET`** `{PANEL_ORIGIN}/api/remote/onboarding-fees?limit=200&offset=0&status=pending`

- `status`: omit or `all`, or `pending` / `paid` / `failed` / `waived` / `cancelled`
- `limit`: max 500

Returns `{ total, limit, offset, lines }` where each line includes customer email/name, amounts, due/paid dates, status (no secrets).

#### Example response `200 OK` (`GET /api/remote/onboarding-fees?limit=2&offset=0&status=pending`)

```json
{
  "total": 4,
  "limit": 2,
  "offset": 0,
  "lines": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "user_id": "usr_01HZXXXX",
      "customer_email": "customer@example.com",
      "customer_name": "Jane Doe",
      "trigger": "monthly",
      "amount_minor": 17000,
      "currency": "INR",
      "due_at": "2026-03-01T00:00:00.000Z",
      "status": "pending",
      "paid_at": null,
      "created_at": "2026-03-01T08:00:00.000Z",
      "gateway_payment_id": null
    },
    {
      "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "user_id": "usr_01HZYYYY",
      "customer_email": "other@example.com",
      "customer_name": null,
      "trigger": "monthly",
      "amount_minor": 17000,
      "currency": "INR",
      "due_at": "2026-03-01T00:00:00.000Z",
      "status": "pending",
      "paid_at": null,
      "created_at": "2026-03-01T08:00:01.000Z",
      "gateway_payment_id": null
    }
  ]
}
```

- `total` is the number of rows **after** the status filter, **before** pagination (same as admin list).
- UUIDs and user ids are examples; your installation will differ.

---

## 3. Browser login as SaaS owner (bypass email/password)

### Option A — Page on the whitelabel panel

1. Open: `{PANEL_ORIGIN}/licensor-access`
2. Paste **PRODUCTION_KEY** and submit.
3. Session cookie is set; you are logged in as the installation **SaaS owner** (same as normal admin).

### Option B — API from the browser (same origin only)

**`POST`** `{PANEL_ORIGIN}/api/remote/admin-login`  
Headers: `X-Production-Key`, `Content-Type: application/json`  
Body (optional): `{ "redirect": "/admin/onboarding-fees" }`  
Fetch with **`credentials: 'include'`** so the session cookie is stored.

### Option C — Server-to-server (your portal backend)

Your licensor backend calls `POST /api/remote/admin-login` with the key; the **Set-Cookie** header applies only to the HTTP client you use (e.g. not the end-user’s browser unless you proxy carefully). Prefer **Option A** or **B** for human admins.

#### Example response `200 OK` (`POST /api/remote/admin-login`)

Body sent: `{ "redirect": "/admin/onboarding-fees" }` (optional; omit `{}` or send `{}`).

```json
{
  "ok": true,
  "message": "Logged in as SaaS owner. Use credentials: include on this origin; then open /admin.",
  "user": {
    "id": "01HZXXXXXXXXXXXXXXXX",
    "email": "owner@example.com",
    "firstName": "Admin",
    "lastName": "User",
    "isSaaSOwner": true
  },
  "suggested_redirect": "/admin/onboarding-fees"
}
```

The response also includes **`Set-Cookie`** for the session when the client accepts cookies (browser with `credentials: 'include'` on the same site).

#### Example response `503` (no SaaS owner user on DB)

```json
{
  "error": "No SaaS owner user exists on this installation (cannot impersonate admin)"
}
```

---

## Error responses (all `/api/remote/*`)

**`401`** — wrong or missing key:

```json
{
  "error": "Invalid or missing production key",
  "hint": "Send header X-Production-Key or Authorization: Bearer <PRODUCTION_KEY>"
}
```

**`503`** — `PRODUCTION_KEY` not set on the whitelabel server:

```json
{
  "error": "PRODUCTION_KEY is not configured on this panel"
}
```

**`500`** — unexpected failure (summary / list / session):

```json
{
  "error": "Failed to load onboarding summary"
}
```

(Message text may vary; always check HTTP status.)

---

## CORS (only if your portal **frontend** calls `/api/remote/*` cross-origin)

Server-to-server `curl` / backend HTTP clients do **not** need CORS.

If a browser on another origin must call these APIs, set on the whitelabel server:

```env
LICENSOR_CORS_ORIGIN=https://your-licensor-portal.example.com
```

Exact origin only (scheme + host + port). Then preflight `OPTIONS` is handled for `/api/remote/*`.

---

## Customer-status gate

Routes under **`/api/remote`** are **not** blocked when the licensor marks the installation inactive (`is_active: false`), so your portal can still read onboarding totals and (if you use the login endpoint from the panel origin) open **Onboarding fees** to pay.

---

## Quick reference

| Method | Path | Purpose |
|--------|------|--------|
| GET | `/api/remote/onboarding-summary` | Outstanding totals, limits, links |
| GET | `/api/remote/onboarding-fees` | Paginated fee lines |
| POST | `/api/remote/admin-login` | Session as SaaS owner |
| GET | `/licensor-access` | UI to paste key and sign in |
