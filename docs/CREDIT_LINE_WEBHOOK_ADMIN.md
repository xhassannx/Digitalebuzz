# Credit-line webhook on CUSTOMER_API_BASE_URL (admin)

This BSP/whitelabel panel already implements:

- `GET/POST /api/webhooks/credit-line`
- Forward fan-out when `WEBHOOK_FORWARD_URLS` (or runtime forwarding URLs) is set — same domains as Meta, path `/api/webhooks/credit-line`

## What to share with the credit-line supplier

```text
https://admin.digitalebuzz.com/api/webhooks/credit-line
```

Verify token = same `WEBHOOK_VERIFY_TOKEN` as Meta (no password).

## Admin host requirements

If `admin.digitalebuzz.com` runs **this same codebase** (or a deploy that includes `registerCreditLineRoutes`):

1. Deploy latest code with credit-line routes.
2. Set forwarding the same way Meta works, e.g.:

```env
WEBHOOK_FORWARD_URLS=https://bsp.digitalebuzz.com,https://www.waba.digitalanchal.com,https://app.waawii.com
```

(or keep using the Customers → WEBHOOK On list if that portal writes into the forwarder).

3. Supplier → admin `/api/webhooks/credit-line` → each `{domain}/api/webhooks/credit-line`.

If admin is a **separate** “Whitelabel Admin” CRM app, that app must:

1. Add `/api/webhooks/credit-line` (hub.challenge + POST).
2. Forward to each customer domain with path `/api/webhooks/credit-line` (mirror Meta’s `/api/webhooks/whatsapp-business` fan-out).

## Panel (this repo) checklist

1. `npm run db:migrate-wallet` (includes credit_line + debit_subscription).
2. Admin → Wallet billing → enable Interakt (token + solution ID).
3. Admin → Users → set org billing mode `credit_line` when applicable.
4. Billing page: pay SaaS plan from wallet (any billing mode).
5. Meta usage wallet debit only when org is `credit_line`.
