# WA Pay + Catalog — Full Guide

This guide covers **WhatsApp native payments (India)** with **Meta Commerce catalog**: setup, sending catalog messages, automatic cart checkout, manual Review and pay, and channel-by-channel instructions.

> **Account requirement:** Native in-chat **Review and pay** (`payment_gateway`) requires Meta **P2M (Person-to-Merchant)** eligibility on your WhatsApp Business Account (WABA). SMB / WhatsApp Business App numbers may see: *"Business is not eligible for P2M payments: not an enterprise account"*. Contact **whatsappindia-bizpayments-support@meta.com** to request access.

---

## 1. Meta setup (one time)

1. **Commerce Manager** — Create or connect catalog **Whatsapp products**; note **Catalog ID** (e.g. `873364941762213`).
2. **WhatsApp Manager** → your phone number → **Catalog** — Link catalog; enable **Show catalog icon** and **Add to cart**.
3. **WhatsApp Manager** → **Payment configurations** → **India** — Link **Razorpay** or **PayU**; note exact **configuration name** (e.g. `digitalebuzz-razorpay`).
4. **Panel** → **Commerce** — Select WhatsApp session → pick catalog → **Save & verify catalog**.
5. **Panel** → **WA Pay** — Enable catalog checkout, set payment config name + gateway, save.

Run migrations on server if not done:

```bash
npm run db:migrate-wa-pay
npm run db:migrate-wa-pay-orders
```

---

## 2. Two message types (important)

| Type | Meta API | Customer sees | When to use |
|------|----------|---------------|-------------|
| **Catalog product** | `interactive` → `product` / product list | Product card, browse, add to cart | Marketing, browse |
| **Review and pay** | `interactive` → `order_details` | Invoice + Pay in WhatsApp | Checkout / payment |

Templates and carousel **only send catalog cards**. **Review and pay** is a separate message (manual, flow, or auto after cart).

---

## 3. Full catalog → pay flow (production)

```text
Business sends catalog  →  Customer browses  →  Adds to cart  →  Submits cart
       ↓
WA Pay enabled: auto Review and pay  →  Address (physical)  →  Razorpay/UPI in WhatsApp
       ↓
Payment webhook  →  Order status (shipped/completed) from WA Pay page
```

**Fallback:** If WA Pay fails or P2M not enabled, enable **Shopify/Woo external checkout** on Commerce — customer gets store payment link instead.

---

## 4. How to send — by channel

### A. Inbox (24-hour window)

| Action | How |
|--------|-----|
| **Catalog product** | Shopping bag icon → Single product or Product list |
| **Review and pay** | Credit card icon → pick catalog product → **Send Review and pay** |
| **Payment link** (no P2M) | + menu → Payment request |

### B. Commerce page

| Action | Where |
|--------|--------|
| Test catalog product | Commerce → Test catalog send |
| Catalog broadcast | Commerce → Catalog broadcast |
| Test Review and pay | WA Pay → Send test Review and pay |

### C. Campaigns / Contacts broadcast

- **Product carousel template** — Templates → Create → Product Card Carousel → approve → send from Campaigns.
- Carousel shows catalog cards; customer can cart → WA Pay auto-reply if enabled.
- **Normal templates** — text/marketing; no native catalog unless URL button.

### D. Flows (automation)

| Action | Flow node |
|--------|-----------|
| Send template (incl. carousel) | Send Template |
| Multi-product from Shopify collection | Send collection |
| Review and pay (amount) | WhatsApp Pay |
| Razorpay link fallback | Send payment link |

### E. Automatic (no manual send)

When customer **submits catalog cart** in WhatsApp and **WA Pay** is enabled → server sends **Review and pay** with cart line items + catalog prices.

---

## 5. Physical vs digital goods

| Order type | Catalog product | Beneficiary | Typical use |
|------------|-----------------|-------------|-------------|
| **physical-goods** | Required (`catalog_id` + `retailer_id`) | Required (compliance) | Shipped products |
| **digital-goods** | Optional | No | Services, downloads, simple tests |

Set default on **WA Pay** settings page.

---

## 6. After payment

1. Meta sends **payment webhook** → panel updates order payment status.
2. **WA Pay → Recent orders** — mark **Shipped** or **Completed** (sends `order_status` to customer).
3. Optional: **Payment lookup** API per order (Meta PG doc Step 5).

---

## 7. Troubleshooting

| Error | Meaning | Fix |
|-------|---------|-----|
| **#131026 P2M / not enterprise** | WABA not eligible for native pay | Email Meta India payments support; use payment links or external checkout |
| **Product not found** | Wrong Content ID | Use dropdown or copy ID from Commerce Manager product page |
| **Catalog product required** | Physical goods without `retailer_id` | Select product in Inbox/WA Pay dialog |
| **Session not ready** | API creds not loaded | Reconnect WhatsApp; retry send |
| Inbox catalog works, pay fails | Account tier, not phone | P2M approval on WABA |

---

## 8. Meta WA Pay features — panel status

Features from [Meta India Payments docs](https://developers.facebook.com/docs/whatsapp/cloud-api/payments-api/payments-in/pg/) and related guides:

| Meta feature | Panel support | Notes |
|--------------|---------------|-------|
| Catalog product / list messages | ✅ Inbox, Commerce, chatbot | Browse + cart |
| Product carousel template | ✅ Templates, Campaigns, Flows | Marketing outside 24h |
| Cart webhook → Review and pay | ✅ WA Pay auto checkout | When cart submitted |
| Manual Review and pay | ✅ Inbox, WA Pay test, Flows | `order_details` |
| Payment gateway (Razorpay/PayU) | ✅ | Needs P2M WABA |
| Payment webhooks | ✅ | Updates `wa_pay_orders` |
| Order status (shipped/completed) | ✅ WA Pay page | `order_status` message |
| Payment lookup (GET) | ✅ Per order on WA Pay | Reconcile with PG |
| External Shopify/Woo checkout | ✅ Commerce | Fallback |
| Inbox Razorpay payment links | ✅ Payment request | No P2M needed |
| **Payment links in order_details** | 🔜 Not yet | Redirect checkout in in-app browser |
| **UPI intent (direct VPA)** | 🔜 Not yet | Alternative to PG |
| **Enhanced payment links** | 🔜 Not yet | Meta enhanced link flow |
| **Restrict payment options (web/UPI)** | 🔜 Not yet | High-value orders |
| **Refunds in payment webhook** | 🔜 Partial | Webhook parsing can extend |
| **Multi-config (MCC/purpose per category)** | ⚙️ Manual in Meta | One config name per send today |
| **TPV / PayU bank verification** | 🔜 Not yet | Enterprise PayU |
| **Beneficiary from customer address UI** | ⚙️ Meta collects at checkout | Panel sends placeholder for compliance |

Legend: ✅ implemented · 🔜 useful future addition · ⚙️ Meta-side or partial

---

## 9. Quick links in panel

- [Commerce](/commerce) — catalog setup, sync, broadcast  
- [WA Pay](/wa-pay) — enable checkout, test send, orders  
- [Commerce guide](/commerce/documentation) — carousel, flows, comparison table  
- [Templates](/templates/create) — product carousel  
- [Flows](/flows) — WhatsApp Pay action  

---

## 10. Support contacts

- **Meta India WA Pay:** whatsappindia-bizpayments-support@meta.com  
- **Razorpay:** use dashboard linked to Meta payment configuration  
- **Payment link domains:** Meta may need to allowlist domains for payment-link checkout (see Meta payment links doc)
