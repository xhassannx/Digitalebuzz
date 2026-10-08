# WhatsApp panel in iframe + auto-login

You want: **floating button** → opens **iframe** → that URL **logs the user into your panel** (e.g. `/chat`) **without** typing email/password.

Your codebase **already** supports auto-login for this pattern using the **CRM API key** flow.

---

## 1. What you already have: `/crm-login`

**Route:** `GET /crm-login` (see `server/routes/crm.ts`)

**Behavior:**

1. Validates `apiKey` query param against your DB.
2. Calls `req.login(...)` and sets the **session cookie**.
3. **Redirects** to `redirect` (or `redirect_url`), default `/dashboard`.

**Example — open inbox/chat after login:**

```text
https://YOUR_PANEL_DOMAIN/crm-login?apiKey=USER_API_KEY&redirect=/chat
```

Use your real panel host, e.g. `https://wa.ratehonk.com`.

**Iframe `src` (same idea):**

```html
<iframe
  title="WhatsApp panel"
  src="https://YOUR_PANEL_DOMAIN/crm-login?apiKey=USER_API_KEY&redirect=/chat"
  style="width:100%;height:100%;border:0;"
></iframe>
```

So the “auto login URL” for the WhatsApp panel is **`/crm-login` + API key + redirect to `/chat`** (or `/dashboard`, etc.).

**API keys:** Users create them under your product’s API / settings (same keys used in Postman docs: `Project_API.postman_collection.json` → “CRM Auto-Login”).

---

## 2. Critical: cross-site iframe and cookies (why it often “doesn’t stay logged in”)

If the **parent page** is on **another domain** (e.g. `customer.com`) and the iframe loads **`YOUR_PANEL_DOMAIN`**, the session cookie is **third-party**.

- Your session is configured with **`sameSite: 'lax'`** (`server/replitAuth.ts`).
- In many browsers, **Lax** cookies set inside a **cross-origin iframe** are **not stored** or **not sent** reliably → user looks “not logged in” or session drops.

**What works more reliably:**

| Setup | Typical result |
|--------|----------------|
| Iframe **and** parent **same site** (e.g. both `*.ratehonk.com`) | Often OK with Lax |
| Parent **`customer.com`**, iframe **`wa.ratehonk.com`** | Often **broken** until cookie is `SameSite=None; Secure` |
| **New tab / `window.open`** to `/crm-login?...` | **First-party** navigation → session usually works |
| User already logged in on panel, same browser **top-level** visit | Cookie already first-party |

**If you must use a cross-site iframe**, you will likely need (ops + security review):

- Session cookie: **`sameSite: 'none'`** and **`secure: true`** in production **and** HTTPS only.  
  That affects **all** sessions for the app, not only embeds → discuss CSRF / security with your team before changing globally.

There is **no separate “iframe auto-login” flag** in code today; it’s the same session as normal login.

---

## 3. Security: putting `apiKey` in the iframe `src`

- Anyone who can **view page source** or **history** may see the URL → **treat API keys like passwords**.
- **Bad:** hardcode one API key in a **public** marketing site.
- **Better:**
  - **Server-side** on *your* customer portal: render iframe `src` pointing to a **short-lived link** you generate (one-time token → your backend exchanges to session, then redirect — *not implemented in repo by default*), or
  - Only embed on **authenticated** pages where the user already proved identity, and inject key from your server (still prefer short-lived tokens over long-lived API keys in URLs).

For **internal** dashboards (logged-in CRM user only), using `/crm-login?apiKey=...` generated server-side is more acceptable than on a public homepage.

---

## 4. Framing: `X-Frame-Options` / CSP

If the panel sends **`X-Frame-Options: DENY`** or **`frame-ancestors 'none'`**, the iframe will be **empty**.  
For embed you need either:

- A **dedicated** route (e.g. `/embed/chat`) that allows `frame-ancestors` for known partner origins, or  
- Relax headers globally (usually **not** recommended).

Check your reverse proxy (nginx, Cloudflare) and Express static/security middleware.

---

## 5. Recommended patterns

### A. Best reliability: **new window**, not iframe

```js
window.open(
  'https://YOUR_PANEL_DOMAIN/crm-login?apiKey=' + encodeURIComponent(apiKey) + '&redirect=/chat',
  'whatsappPanel',
  'width=420,height=720,noopener'
);
```

User gets a real first-party window → **Lax** session works like normal.

### B. Iframe on **same** registrable domain as panel

Example: `app.ratehonk.com` iframe loads `wa.ratehonk.com` — still often **cross-site**; may still need `None` unless you use **same** hostname.

### C. Iframe + `/crm-login` as today

Use only when parent is same-site or you’ve fixed **cookie SameSite** + **frame-ancestors** for embed.

---

## 6. Quick checklist

- [ ] Iframe `src` = `https://PANEL/crm-login?apiKey=...&redirect=/chat`
- [ ] User has a valid **API key** from your app
- [ ] **HTTPS** on panel
- [ ] If embed is **another domain**: verify cookie behavior; consider **popup** or **SameSite=None** (with security review)
- [ ] Allow **framing** for that URL if you use CSP / X-Frame-Options
- [ ] Do **not** expose long-lived API keys on **public** pages

---

## 7. Summary

| Question | Answer |
|----------|--------|
| Is there an auto-login URL? | **Yes:** `/crm-login?apiKey=...&redirect=/chat` |
| Does it work in an iframe? | **Sometimes** — cross-site iframes often need **`SameSite=None`** session cookies + **frame-ancestors** |
| Safer UX for “floating button”? | **`window.open`** to the same `/crm-login` URL |

If you want, we can add a **dedicated** `GET /embed/login?token=...` that consumes a **one-time token** (no API key in URL) and sets session — say the word and we can sketch it in code.
