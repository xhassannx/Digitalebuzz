# Floating WhatsApp button + iframe — guide only

This doc is **only** about putting a **fixed (floating) WhatsApp control** on a website and opening **content inside an `<iframe>`** (e.g. your chat page or a small “contact” page).  
Meta does **not** provide an official “WhatsApp chat iframe” for the Cloud API; this pattern is **your** page inside an iframe, or a **wa.me** link (no iframe).

---

## 1. Two common patterns

| Pattern | Use when |
|--------|-----------|
| **A. Button → `wa.me` (no iframe)** | You only need “Click to chat on WhatsApp”. Simplest, no embedding issues. |
| **B. Button → toggle iframe** | You want a **small panel** (your own URL) with text, form, or web chat UI. |

For **B**, the iframe `src` must be a **page you control** (e.g. `https://yourdomain.com/widget/whatsapp`).

---

## 2. Pattern A — floating button only (recommended if you don’t need a panel)

Replace `PHONE` with full international number, no `+` or spaces (e.g. `919876543210`).

```html
<a
  href="https://wa.me/PHONE?text=Hi"
  target="_blank"
  rel="noopener noreferrer"
  class="wa-float"
  aria-label="Chat on WhatsApp"
>
  <!-- SVG or image icon -->
</a>

<style>
  .wa-float {
    position: fixed;
    right: 20px;
    bottom: 20px;
    z-index: 99999;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: #25d366;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(0,0,0,.25);
  }
</style>
```

**No iframe** — avoids `X-Frame-Options`, cookies, and mobile Safari quirks.

---

## 3. Pattern B — floating button + iframe panel

### Behaviour

1. Green button fixed at **bottom-right** (or left).
2. Click **opens** a small box that contains an `<iframe src="…">`.
3. Second click (or ×) **closes** the box.

### Minimal HTML + JS + CSS

```html
<!-- Place before </body> on the customer site -->
<div id="wa-widget-root">
  <button type="button" id="wa-toggle" class="wa-btn" aria-expanded="false" aria-controls="wa-panel" aria-label="Open WhatsApp chat">
    <!-- WhatsApp icon -->
  </button>
  <div id="wa-panel" class="wa-panel" hidden>
    <button type="button" class="wa-close" id="wa-close" aria-label="Close">&times;</button>
    <iframe
      id="wa-frame"
      title="WhatsApp"
      src="https://YOUR-DOMAIN.com/path/to/your-widget-page"
      loading="lazy"
    ></iframe>
  </div>
</div>

<style>
  #wa-widget-root { position: fixed; right: 16px; bottom: 16px; z-index: 999999; font-family: system-ui, sans-serif; }
  .wa-btn {
    width: 56px; height: 56px; border-radius: 50%; border: none; cursor: pointer;
    background: #25d366; box-shadow: 0 4px 12px rgba(0,0,0,.2);
  }
  .wa-panel {
    position: absolute; bottom: 64px; right: 0;
    width: min(380px, 100vw - 32px); height: min(520px, 70vh);
    background: #fff; border-radius: 12px; overflow: hidden;
    box-shadow: 0 8px 32px rgba(0,0,0,.2);
  }
  .wa-panel[hidden] { display: none !important; }
  .wa-close {
    position: absolute; top: 8px; right: 8px; z-index: 2;
    width: 32px; height: 32px; border: none; background: #eee; border-radius: 50%; cursor: pointer;
  }
  #wa-frame { width: 100%; height: 100%; border: 0; display: block; }
</style>

<script>
  (function () {
    var t = document.getElementById('wa-toggle');
    var p = document.getElementById('wa-panel');
    var c = document.getElementById('wa-close');
    var f = document.getElementById('wa-frame');
    function openP() {
      p.hidden = false;
      t.setAttribute('aria-expanded', 'true');
      // Lazy-set src if you want to defer load:
      // if (!f.src) f.src = 'https://YOUR-DOMAIN.com/widget/whatsapp';
    }
    function closeP() {
      p.hidden = true;
      t.setAttribute('aria-expanded', 'false');
    }
    t.addEventListener('click', function () { p.hidden ? openP() : closeP(); });
    c.addEventListener('click', closeP);
  })();
</script>
```

Replace `YOUR-DOMAIN.com/path/to/your-widget-page` with the real URL.

---

## 4. What the iframe page should be

- **Lightweight**: small HTML, fast load (logo, short text, **“Open WhatsApp”** button → `wa.me`, optional form).
- **Public**: no login required **or** your product decision (logged-in widget is harder in third-party sites).
- **HTTPS** only.

**Important:** If the URL is your **main SaaS app** (e.g. full `/chat`), the server must **allow framing**:

- If you send `X-Frame-Options: DENY` or `SAMEORIGIN`, the iframe will be **blank** on other domains.
- For a **dedicated widget route**, you can use `Content-Security-Policy: frame-ancestors https://client-site.com` (adjust per customer) instead of blocking all frames.

---

## 5. Sandbox (optional, stricter embed)

If you don’t need scripts inside the iframe page:

```html
<iframe
  src="..."
  sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
  ...
></iframe>
```

Tighten/loosen `sandbox` based on what the widget page does.

---

## 6. Mobile

- Use `width: min(380px, 100vw - 32px)` so the panel doesn’t overflow.
- `70vh` height avoids covering the whole screen; adjust as needed.
- iOS Safari: test **open/close** and **focus** (keyboard) inside the iframe.

---

## 7. Checklist

- [ ] Decide **A (wa.me only)** vs **B (iframe)**.
- [ ] For **B**: host a **small widget URL**; fix **frame-ancestors** / **X-Frame-Options** for customer domains if embedding externally.
- [ ] **HTTPS** everywhere.
- [ ] **z-index** high enough (`999999` is usually fine).
- [ ] **aria-label** / **aria-expanded** for accessibility.

---

## 8. What this is *not*

- Not a substitute for **WhatsApp Cloud API** webhooks or inbox — those run on **your server**.
- Not an official Meta “iframe SDK” — Meta’s consumer chat is typically **wa.me** / **WhatsApp Business app** links.

For **embed on many customer websites**, consider shipping a **single JS snippet** that injects the same HTML as in section 3, with `src` pointing to your hosted widget.
