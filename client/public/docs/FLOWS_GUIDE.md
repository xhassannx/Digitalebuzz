# Automation Flows — User Guide

This guide explains how to create, publish, and maintain **automation flows** in the canvas editor (`/flows`).

## Quick start

1. Go to **Dashboard → Flows**.
2. Click **New Flow…** and choose **Canvas (advanced)**.
3. On the canvas, click the trigger node → **Configure** → pick an app (e.g. WhatsApp, Contact, Shopify).
4. Add action nodes (Send message, Delay, Router, etc.) and connect them below the trigger.
5. Configure each step (connection, fields, variables).
6. Click **Publish** in the editor header. Only **Active** flows run in production.

## Flow status

| Status | Meaning |
|--------|---------|
| **Active** | Published — triggers and actions run when events occur. |
| **Inactive** | Draft — saved but does not run until published. |

## Canvas editor basics

- **Trigger node** — starts the flow (one event type per trigger node).
- **Action nodes** — run after the trigger (WhatsApp send, CRM update, delay, etc.).
- **Router** — splits into **Branch 1** (condition true) and **Otherwise**.
- **Variables** — use `{{trigger.phone}}`, `{{contact.name}}`, `{{raw}}` in text fields; use **Insert variable** where available.
- **Webhook URL** — shown on trigger nodes for Shopify, generic webhook, etc. Copy it into the external service (must be **HTTPS** in production).

## Per-flow webhook URL

```
POST https://YOUR-DOMAIN/api/v2/webhook/flows/{flowId}
```

- Flow must be **Published (Active)**.
- Shopify sends `X-Shopify-Topic` automatically.
- Other services: use `?trigger=trigger-id` or header `X-Canvas-Trigger: trigger-id`.

## All triggers (by integration)

### Contact (CRM)

| Trigger | When it runs |
|---------|----------------|
| New Contact | Manual create, import, Facebook lead — not chat sync. |
| Contact Updated | Meaningful CRM field changes. |

### WhatsApp

| Trigger | When it runs |
|---------|----------------|
| Text Message Received | Inbound text (and similar). |
| List Message Reply | List picker reply. |
| Template Message Button Reply | Template quick-reply / button. |
| Interactive Message Button Reply | Interactive quick reply. |
| Form Message Response | WhatsApp Flow / NFM reply. |
| On First Message | First inbound message from that number in the chat. |

*Select the WhatsApp **connection** (session) on the trigger node to scope the flow.*

### Shopify

| Trigger | Shopify topic |
|---------|----------------|
| New Order | `orders/create` |
| New Paid Order | `orders/paid` |
| New Customer | `customers/create` |
| New Abandoned Checkout | `checkouts/create` or `checkouts/update` |
| New Cancelled Order | `orders/cancelled` |
| Updated Product | `products/update` |

Org webhook: `POST /api/webhooks/shopify/{integrationId}`

### WooCommerce

Product/order/coupon/customer created/updated/deleted, cart abandonment.  
Webhook: `POST /api/webhooks/woocommerce/{integrationId}`

### Calendly

| Trigger | Event |
|---------|--------|
| Event schedule | `invitee.created` |
| Event canceled | `invitee.canceled` |

Register webhook in Integrations → Calendly.

### Google Calendar

| Trigger | Notes |
|---------|--------|
| New event | Calendar push notification (`new-event`). |
| New calendar | UI only — use advanced webhook if needed. |

### Google Sheets

| Trigger | Notes |
|---------|--------|
| New spreadsheet rows | Polled every ~2 min when spreadsheet + worksheet configured. |
| New spreadsheets / New worksheets | Configure via webhook or future polling. |

### Scheduler

| Trigger | Default interval |
|---------|------------------|
| Every N minutes | 5 minutes |
| Every hour | 1 hour |
| Every day | 24 hours |
| Every week | 7 days |
| Every month | 30 days |

No external webhook required.

### Webhook / Zoom

| Trigger | Usage |
|---------|--------|
| Catch raw webhook | Any JSON body → `{{raw}}`, `{{trigger.*}}` |
| Zoom webhook | Zoom events via per-flow or custom URL |

### Leads & payments

| App | Trigger |
|-----|---------|
| IndiaMart | New Lead |
| TradeIndia | New Lead |
| JustDial | New Lead |
| Razorpay | Order Paid, Payment Captured |

## Common actions (runtime)

Fully supported in the automation runner:

- **Delay** (for / until)
- **WhatsApp** — Send message, Send template, Send media, Wait for reply
- **Contact** — Create, Update, Get, Add note, Auto assign, Custom HTTP
- **Router** — Branch 1 / Otherwise with conditions
- **OpenAI / Gemini** — Chat / generate
- **Google Sheets** — Create row
- **Google Contacts** — Create contact
- **Calendly** — Custom API request, Cancel event

Other canvas actions may appear in the UI but are not executed until wired on the server.

## Router conditions

Examples for **Branch 1 condition**:

- `{{trigger.body}} contains 'hello'`
- `{{trigger.status}} === 'paid'`
- `{{contact.source}} === 'shopify'`

If the condition is false, the flow follows **Otherwise**.

## Tips

1. Always **Publish** after changes.
2. Use a **public HTTPS** domain for Shopify/WooCommerce/webhooks (not `localhost`).
3. Test with a small flow: Trigger → Send message with `{{trigger.phone}}`.
4. Check server logs for `[Automation]` lines when debugging.

## Documentation

In-app guide: **Flows → Documentation** (`/flows/documentation`).
