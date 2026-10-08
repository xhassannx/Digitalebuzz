# WhatsApp prepaid wallet — guide for whitelabel owners and your customers

This guide explains how **Tech Partner wallet billing** works on your panel: what to set up in **Meta**, what to configure in **your admin area**, and what your **end customers** see when they send WhatsApp messages.

It is written for business users, not developers.

---

## 1. The idea in plain language

| Who | Role |
|-----|------|
| **You (whitelabel owner)** | You are the **Meta Tech Partner**. Meta sends **one bill** to **your** payment card for all WhatsApp usage across your customers. |
| **Your customer (organization)** | They connect their WhatsApp Business number on **your** panel. They **do not** add a card to Meta. They **reload a prepaid wallet** on your panel (via Razorpay). |
| **Your panel** | When they send a message through the **official WhatsApp API**, the system **deducts** an estimated cost from their wallet (Meta rate + optional markup you set). |

**Important:** Meta still decides the real price per country and message category. Your panel uses **rates you configure** so customers are charged fairly and you are not left paying Meta out of pocket.

**Money flow (simple):**

1. Your customer reloads wallet on your panel (Razorpay).
2. Customer sends WhatsApp messages through your panel.
3. Each successful official API send deducts from their wallet.
4. Meta bills **your** card monthly for all usage.

---

## 2. Set up billing on Meta (Tech Partner)

These steps are done in **Meta Business Manager**. Your technical partner may help with app URLs and webhooks; you own the **business and payment** side.

### 2.1 Confirm you are set up as a Tech Partner

1. You need a **Meta Business Portfolio** for your company (the partner), not only your customers’ businesses.
2. Your WhatsApp product should use the **tech partner** model (customers onboard through **your** Meta app / embedded signup on your panel).
3. If unsure, confirm with Meta or your implementation partner that your app is approved for **WhatsApp Business Platform** and multi-customer onboarding.

### 2.2 Add the payment method Meta will charge

This is the card Meta uses for **all** conversation charges under your partner account.

1. Go to [business.facebook.com](https://business.facebook.com).
2. Open **Settings** → **Billing & payments** (or **Payment settings**).
3. Add a valid **credit/debit card** for the business that owns the partner app.
4. Confirm billing country and currency (often **INR** for India-focused partners).
5. Enable **email alerts** for invoices and payment failures.

**Rule:** If Meta cannot charge this card, official API messaging can stop for everyone—even if customers still have wallet balance on your panel.

### 2.3 What Meta bills (conversation categories)

| Category | Typical use |
|----------|-------------|
| **Marketing** | Promotions, campaigns, marketing templates |
| **Utility** | Order updates, account info (subject to Meta window rules) |
| **Authentication** | OTP / login codes |
| **Service** | Inbox replies and session messages in the customer care window |

Copy Meta’s published **conversation pricing** by country into your panel (section 3.3).

### 2.4 What customers do *not* do on Meta billing

- They connect WhatsApp on **your** panel (embedded signup / connect flow).
- They **should not** add a Meta payment method for API usage—that is **your** partner billing.
- They **do** need an approved, connected number.

### 2.5 Meta invoice vs your panel wallet

| Meta invoice | Your panel wallet |
|--------------|-------------------|
| One bill to **your** card | Many debits per **customer organization** |
| Actual amounts after the month | Estimated per message at send time |

Use **reconciliation** in admin (section 3.5) each month.

---

## 3. Configure the system on your panel (whitelabel admin)

Log in as **platform owner / SaaS admin**.

### 3.1 One-time technical prerequisite

Your implementation partner runs the wallet database setup once on the server (`npm run db:migrate-wallet`). Optional: `npm run db:seed-country-dials` for country-based phone matching.

### 3.2 Turn on wallet billing

1. Sidebar: **Admin → Wallet billing**.
2. Turn **Wallet billing enabled** **ON**.
3. Click **Save settings**.

### 3.3 Set Meta rates (what you deduct per message)

**Simple (one rate for everyone):**

- Under **Meta rates**, enter amounts in **paise** (100 paise = ₹1).
- Example: ₹0.85 marketing → enter **85**.
- Set all four categories.

**By country (recommended for international customers):**

- Turn **Country + effective-dated rates** **ON**.
- Set **Default country ISO** (e.g. `IN`).
- Add **Rate versions** per country and category; use `DEFAULT` as fallback.
- Each row has **Meta charge (paise)** and **Markup (paise)** for that country (e.g. IN marketing Meta 85 + markup 15).
- Leave markup blank on a row to use **default markup** from the Markup section.
- When Meta changes prices, add a new row with a new **valid from** date.

### 3.4 Optional markup (your revenue)

1. Turn **Markup enabled** **ON**.
2. Set **default markup** per category (used when a rate row has no markup).
3. In **Rate versions**, set **per-country markup** in paise (e.g. IN +15, US +20). Row markup overrides the default for that country.
4. Or use **percent** default markup when row markup is blank (percent does not apply when row has fixed markup paise).

### 3.5 Alerts and policies

| Setting | What it does |
|---------|----------------|
| **Low balance threshold** | Warning when balance is low (paise; 5000 = ₹50). |
| **Low balance email alerts** | Emails when low (needs platform **SMTP/email**). |
| **Skip SaaS subscription check for official API sends** | Wallet can cover official sends without a SaaS message plan. |
| **Allow negative balance** | Credit line (usually **OFF**). |

### 3.6 Razorpay (customer wallet reload)

1. **Admin → Platform settings** — set **Razorpay Key ID** and **Secret**.
2. Minimum reload **₹1**; maximum single reload **₹50,000**.

Wallet reload via Cashfree is not available yet.

### 3.7 Reconcile with Meta each month

On **Wallet billing → Meta invoice reconciliation**:

1. Enter period, dates, and Meta total (paise).
2. **Save invoice & reconcile**.
3. Review variance vs wallet meta costs.

---

## 4. What your customers do

### 4.1 Connect WhatsApp

Use your normal **Connect WhatsApp** / integrations flow until the number is **connected**. No Meta card required for API usage.

### 4.2 Open the wallet

**WhatsApp Wallet** in the sidebar (`/billing/wallet`), or **Billing** → **Open wallet**. Needs **billing.view** permission.

### 4.3 Reload balance

Enter amount → **Reload** → complete **Razorpay** payment.

### 4.4 What reduces balance

Successful **official API** sends: inbox, campaigns, chatbots, API messages, etc. Amount depends on recipient **country** and message **category**. Failed sends are not charged.

### 4.5 When sends are blocked

**Insufficient wallet** — customer must reload.

### 4.6 History and export

**Transaction history** and **Download CSV** on the wallet page.

---

## 5. Rollout checklist

- [ ] Meta partner **payment method** active
- [ ] Test customer connects a number
- [ ] **Wallet billing enabled** in admin
- [ ] Meta rates configured
- [ ] **Razorpay** live on production
- [ ] SMTP for low-balance emails (optional)
- [ ] Test inbox + template + campaign → debits in wallet
- [ ] Monthly **reconciliation** process

---

## 6. FAQ

**Do customers pay Meta directly?**  
No. Meta bills **you**. Customers pay **you** via the wallet.

**Is the wallet charge exactly Meta’s bill?**  
It uses **your configured rates**. Reconcile monthly and update rates when Meta changes prices.

**What if balance is zero?**  
Official sends stop until reload.

**Are reactions charged?**  
No.

**Utility free inside 24 hours?**  
Meta has special rules; the panel may still debit utility at your configured rate until advanced rules are added.

---

## 7. Where things live in the panel

| Task | Who | Where |
|------|-----|--------|
| Meta payment card | You | Meta Business Manager → Billing |
| Enable wallet & rates | You | Admin → **Wallet billing** |
| Setup guide (this doc) | You | Admin → **Wallet billing** → **Setup guide** |
| Razorpay keys | You | Admin → **Platform settings** |
| Reload & history | Customer | **WhatsApp Wallet** |

---

*Tech Partner prepaid wallet — official WhatsApp API sends deduct from customer wallet balance.*
