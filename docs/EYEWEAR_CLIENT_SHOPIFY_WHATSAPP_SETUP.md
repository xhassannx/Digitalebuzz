# Eyewear Store — Shopify + WhatsApp Automation Setup Guide

**Prepared for:** Eyewear / optical e-commerce client (Shopify)  
**Platform:** Helicoptic WhatsApp Business Panel  
**Version:** Draft — share with client before go-live  

---

## Summary

Your WhatsApp automation plan covers six areas. **The panel already supports all of them in code** — nothing new needs to be built from scratch. What the client (and your team) must do is **connect accounts, approve WhatsApp templates, and publish flows/chatbots**.

| Automation | Code ready? | Starting point in panel |
|------------|-------------|-------------------------|
| Recover abandoned carts | **Yes** — preset flow + Shopify webhooks | Commerce → Install presets → Flows |
| Order confirmation | **Yes** — preset flow | Same |
| Shipping updates (shipped / out for delivery / delivered) | **Yes** — build with Flow + Router (no single preset) | Flows (custom) |
| COD verification (“Reply YES…”) | **Yes** — Flow + Chatbot + optional HTTP | Flows + Chatbots |
| Customer support (one inbox) | **Yes** — Inbox + AI Assistant + Chatbot | AI Assistant + Chatbots |
| Broadcast campaigns | **Yes** — Campaigns + Commerce catalog broadcast | Campaigns + Templates |
| Collect reviews automatically | **Yes** — Flow + Delay + Template | Flows (custom) |

> **Important:** Marketing and post–24-hour messages require **Meta-approved WhatsApp templates**. Session replies (inside 24 hours after customer messages) can be free-form text.

---

## What the client must provide

- [ ] Shopify store admin access (or staff account with app install permission)
- [ ] Meta Business Manager + WhatsApp Business API number (connected in panel)
- [ ] Product catalog synced (frames, lenses, accessories)
- [ ] Brand copy for messages (or approve drafts below)
- [ ] Return / shipping / lens-size policy text for the AI knowledge base
- [ ] Review link (Google Reviews, Judge.me, Loox, etc.)
- [ ] Courier / shipping app details (for “out for delivery” status, if used)

---

## Phase 1 — Foundation (do this first)

### Step 1 — Connect WhatsApp Business API

1. Log in to the Helicoptic panel.
2. Go to **Integrations** → connect **WhatsApp Business API** (Official).
3. Complete Meta verification and connect the business phone number customers will message.
4. Confirm status shows **Connected**.

### Step 2 — Connect Shopify

1. Go to **Integrations** → **Shopify** → **Connect**.
2. Enter the store domain (e.g. `yourstore.myshopify.com`) and approve OAuth.
3. On success, the panel registers Shopify webhooks automatically (orders, checkouts, products).
4. **Requirement:** Panel `BASE_URL` must be a **public HTTPS domain** (not localhost).

**Webhooks registered by default:**

| Shopify topic | Used for |
|---------------|----------|
| `orders/create` | Order confirmation |
| `orders/paid` | Paid order follow-up |
| `checkouts/create` / `checkouts/update` | Abandoned cart recovery |
| `orders/cancelled` | Cancellation notice |
| `products/*` | Catalog sync |

### Step 3 — Commerce catalog

1. Open **Commerce**.
2. Select the connected WhatsApp session.
3. Link the **Meta catalog** (Commerce Manager) to the WhatsApp number.
4. **Sync products from Shopify** (or upload in Meta Commerce Manager).
5. Click **Save & verify catalog**.

### Step 4 — WhatsApp message templates

Create and submit templates in **Templates → Create**. Meta usually takes 24–48 hours to approve.

Suggested template names (lowercase, underscores):

| Template name | Use case |
|---------------|----------|
| `order_confirmed_eyewear` | Order placed |
| `cart_recovery_eyewear` | Abandoned cart |
| `order_shipped_eyewear` | Shipped |
| `order_out_for_delivery` | Out for delivery |
| `order_delivered_eyewear` | Delivered |
| `cod_confirm_eyewear` | COD — reply YES |
| `review_request_eyewear` | Review after delivery |
| `new_collection_launch` | Broadcast / VIP |

**Sample body — order confirmed**

```
Hi {{1}}, thank you for your order! 🕶️

Order #{{2}} is confirmed.
Total: {{3}}

We'll notify you when your frames are shipped.
Track updates here on WhatsApp.
```

Variables: `{{1}}` = name, `{{2}}` = order ID, `{{3}}` = total.

---

## Phase 2 — Automations (step by step)

### 1. Recover abandoned carts ✅ Preset available

**How it works**

1. Customer adds frames to cart on Shopify but does not checkout.
2. Shopify sends `checkouts/update` to the panel.
3. Published flow **“[Commerce] Shopify — abandoned checkout”** runs.
4. Customer receives a WhatsApp template with cart reminder + optional checkout link.

**Setup**

1. **Commerce** → **Install commerce flow presets**.
2. Open **Flows** → edit **“[Commerce] Shopify — abandoned checkout”**.
3. Set:
   - WhatsApp session = your connected number
   - Template = `cart_recovery_eyewear` (approved)
   - Phone field = `{{trigger.phone}}`
4. **Publish** the flow (status = Active).

**Suggested message**

```
Hi {{1}}, you left something in your cart 👓

Total: {{2}}

Complete your order before your frame sells out:
[checkout link in template button or URL]
```

**Tip:** Add a **Delay** (e.g. 1 hour) before the message so you do not message instant abandoners.

---

### 2. Order confirmation ✅ Preset available

**How it works**

1. Customer places order on Shopify.
2. Shopify sends `orders/create`.
3. Flow **“[Commerce] Shopify — new order confirmation”** sends WhatsApp confirmation.

**Setup**

1. Install presets (if not done).
2. Edit **“[Commerce] Shopify — new order confirmation”**.
3. Map template `order_confirmed_eyewear` and variables:
   - `{{trigger.name}}`
   - `{{trigger.order_id}}`
   - `{{trigger.total_price}}`
   - `{{trigger.phone}}`
4. Publish flow.

---

### 3. Shipping updates — Shipped / Out for delivery / Delivered ⚙️ Custom flow (code supports it)

There is **no single preset** for all three statuses. Shopify sends `orders/updated` when fulfillment changes. You build **one flow per status** (or one flow with **Router** branches).

**How it works**

1. You mark order fulfilled / shipped in Shopify (or shipping app updates status).
2. Shopify sends `orders/updated` to a **flow webhook URL**.
3. **Router** checks fulfillment / shipment fields.
4. Matching branch sends the correct WhatsApp template.

**Setup (per status — example: Shipped)**

1. **Flows** → **Create flow**.
2. Trigger: **Catch raw webhook** (or duplicate and adjust for each status).
3. Copy the flow webhook URL shown in the editor:  
   `https://YOUR-PANEL-DOMAIN/api/v2/webhook/flows/FLOW_ID`
4. In **Shopify Admin** → **Settings** → **Notifications** → **Webhooks** → **Create webhook**:
   - Event: **Order update**
   - URL: paste flow webhook URL above
   - Format: JSON
5. Add **Router** node:
   - Condition example: `{{raw.fulfillment_status}} === 'fulfilled'`  
     (exact field depends on your Shopify/shipping setup — test with one order first)
6. **Send Template** → `order_shipped_eyewear`.
7. Publish flow.

Repeat for **Out for delivery** and **Delivered** with different router conditions and templates (or one flow with multiple router branches).

**Suggested messages**

| Status | Message idea |
|--------|----------------|
| Shipped | “Your order #{{order}} is on the way! 📦 Tracking: {{tracking}}” |
| Out for delivery | “Your eyewear is out for delivery today 🚚” |
| Delivered | “Delivered! 👓 We hope you love your new frames.” |

---

### 4. COD verification — “Reply YES to confirm” ⚙️ Flow + Chatbot

**How it works**

1. New COD order on Shopify → Flow detects pending / COD payment.
2. WhatsApp template asks customer to **Reply YES**.
3. Customer replies **YES** → Chatbot catches reply and confirms (and optionally tags order in Shopify via HTTP).

**Setup — outbound (Flow)**

1. Create flow: Trigger **Shopify → New Order**.
2. Add **Router**:
   - Branch: `{{trigger.financial_status}} === 'pending'`  
     (adjust if your store uses different COD flags — test with a real COD order)
3. **Send Template** `cod_confirm_eyewear`:

```
Hi {{1}}, you placed a COD order #{{2}}.

Reply YES to confirm. We'll dispatch after confirmation.
```

4. Publish flow.

**Setup — inbound (Chatbot)**

1. **Chatbots** → Create **“COD Confirm”**.
2. Trigger: keyword **YES** (and optionally **yes**, **Yes**).
3. Optional **Condition**: only if contact has open COD order (advanced — or keep simple).
4. **Send text**: “Thank you! Your COD order is confirmed. We'll ship soon.”
5. Optional **HTTP Request** node → Shopify Admin API to add tag `cod_confirmed` on order (your implementer configures URL + token).
6. Publish chatbot on the same WhatsApp session.

---

### 5. Customer support — one inbox ✅ Ready

**How it works**

- All WhatsApp chats appear in **Inbox** (one place for the team).
- **AI Assistant** answers FAQs from your knowledge base.
- **Chatbot** handles first message (e.g. `hi`, `help`) and hands off to AI or human.

**Setup**

1. **AI Assistant** → Create e.g. **“Eyewear Support”**.
2. **Knowledge base** — add rich text or upload docs covering:
   - Lens sizes and prescriptions (what you need from customer)
   - Frame materials (acetate, metal, TR90, etc.)
   - Return & exchange policy
   - Delivery timelines by city / pincode
   - How to measure PD / frame size
   - Warranty
3. Connect **OpenAI** (or configured LLM) in Integrations.
4. **Agent rules** (optional): working hours, memory, smart KB search.
5. **Chatbots** → Flow:
   - Trigger: `hi`, `hello`, `help`
   - **AI Agent** → select “Eyewear Support”
   - Welcome: “Hi! 👓 Ask us about lens size, frame material, returns, or delivery.”
6. Publish chatbot.

**Example questions the bot should answer**

| Customer asks | KB should include |
|---------------|-------------------|
| Lens size? | Size chart, prescription upload process |
| Frame material? | Per product line materials |
| Return policy? | Days, condition, refund method |
| Delivery date? | Standard / express SLA by region |

Team can **take over** any chat manually from Inbox (human reply stops the bot for that contact).

---

### 6. Broadcast campaigns ✅ Ready

**How it works**

- **Campaigns** — bulk send approved **marketing templates** to contact lists.
- **Commerce → Catalog broadcast** — send product lists to selected contacts (24-hour window rules apply).
- **Product carousel templates** — swipeable product cards for launches and sales.

**Setup — festival / flash sale**

1. Create approved template `new_collection_launch` or `flash_sale_eyewear`.
2. **Campaigns** → **Create campaign** → select template.
3. Audience: all contacts, or filter by **tags** (e.g. `VIP`, `repeat_buyer`).
4. Schedule or send.

**Campaign types from your plan**

| Type | Panel approach |
|------|----------------|
| New launches | Carousel template + Campaign |
| Restocks | Catalog broadcast or template with collection link |
| Flash sales | Campaign + urgency copy in template |
| Festival offers | Scheduled campaign |
| VIP customers | Tag contacts `VIP` → campaign to that segment |

---

### 7. Collect reviews automatically ⚙️ Custom flow (code supports it)

**How it works**

1. Order marked **delivered** (Shopify `orders/updated` or shipping webhook).
2. Flow waits **2–3 days** (Delay node).
3. Sends review template with link.

**Setup**

1. Flow: **Catch raw webhook** (order update) + Router on delivered status.
2. **Delay for** → 72 hours (or 48).
3. **Send Template** `review_request_eyewear`:

```
Hi {{1}}, hope you're enjoying your new eyewear! ⭐

Would you share a quick review? It helps other customers choose the right frame.

{{review_link}}
```

4. Publish flow.

---

## Phase 3 — Go-live checklist

### Connections

- [ ] WhatsApp Business API — Connected
- [ ] Shopify — Connected, webhooks registered
- [ ] Meta catalog linked and products synced
- [ ] OpenAI (or LLM) connected for AI support

### Flows published (Active)

- [ ] Abandoned checkout recovery
- [ ] New order confirmation
- [ ] Shipped / out for delivery / delivered (as applicable)
- [ ] COD outbound message
- [ ] Review request (optional)

### Chatbots published

- [ ] Main support bot (`hi` → AI Agent)
- [ ] COD YES confirmation bot (if using COD)

### Templates approved by Meta

- [ ] All templates used in flows and campaigns show status **APPROVED**

### Test orders (recommended)

- [ ] Place test order on Shopify → receive order confirmation on WhatsApp
- [ ] Abandon test cart → receive recovery message (after delay if configured)
- [ ] Message `hi` on WhatsApp → receive welcome + AI reply
- [ ] Place COD test order → receive COD template → reply YES → confirmation
- [ ] Fulfill test order → receive shipped / delivered messages
- [ ] Send test campaign to internal numbers only

---

## Roles — who does what

| Task | Client | Helicoptic / agency |
|------|--------|---------------------|
| Shopify admin access | ✓ | |
| Meta Business / WABA | ✓ | Assist connect |
| Write policy & product FAQ content | ✓ | Format KB |
| Approve message copy & templates | ✓ | Draft copy |
| Connect integrations in panel | | ✓ |
| Install commerce presets & publish flows | | ✓ |
| Build shipping / review / COD flows | | ✓ |
| Create & submit WhatsApp templates | | ✓ |
| End-to-end testing | Joint | ✓ |

---

## Timeline estimate

| Phase | Duration |
|-------|----------|
| Connections (WhatsApp + Shopify + catalog) | 1–2 days |
| Template creation + Meta approval | 2–5 days |
| Flow & chatbot configuration | 2–3 days |
| Testing & fixes | 1–2 days |
| **Total** | **~1–2 weeks** (mostly waiting on Meta template approval) |

---

## Support & documentation (in panel)

- **Commerce guide:** Commerce page → documentation link  
- **Flows guide:** Flows → documentation  
- **Inbox:** All customer conversations in one place  

---

## Notes for implementers

1. **Production server** must run the **latest panel code** so incoming Shopify/WhatsApp webhooks trigger flows and chatbots (not only store messages in the inbox).
2. Phone numbers on Shopify orders must be present (customer or shipping phone) or WhatsApp automations cannot send.
3. `orders/updated` is **not** in the one-click Shopify preset list — use **Catch raw webhook** + Router per the shipping section above.
4. Inside the **24-hour customer service window**, Inbox can send free-form replies; outside it, use **approved templates** only.

---

*Document generated for client onboarding. Customize store name, template text, and router conditions after the first test orders on the client’s Shopify store.*
