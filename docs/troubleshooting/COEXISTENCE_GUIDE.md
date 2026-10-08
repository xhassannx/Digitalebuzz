# WhatsApp Business App + API Panel Coexistence Guide

## Overview

When a business uses **both** the WhatsApp Business mobile app and this API panel, messages sent from the app may not sync to the panel unless the number is registered in **Coexistence Mode**.

## The Problem

- **Standard Cloud API**: Messages sent from the mobile app do **not** trigger webhooks. Only API-sent messages and incoming customer messages appear in the panel.
- **Coexistence Mode**: Messages sent from the app **do** trigger webhooks and sync to the panel.

## Why Some Panels Support App Sync

Different providers behave differently because:

- **On-Premise BSPs** may handle coexistence internally
- **Embedded Signup with coexistence** enables app sync when configured correctly
- **Standard Cloud API migration** (without coexistence) does not support app sync

## How to Enable Coexistence

### Option A: Meta Business Manager (Recommended if number is already connected)

If your number is **already** connected to Cloud API and you want to add app sync:

1. Go to [Meta Business Suite](https://business.facebook.com) → **WhatsApp Manager** (or **WhatsApp Accounts**).
2. Select your **WhatsApp Business Account (WABA)**.
3. Open **Phone Numbers** → select your number → **Settings**.
4. Find **WhatsApp Business App Coexistence** and **enable** it.
5. **Link the mobile app**:
   - Open **WhatsApp Business App** on your phone.
   - Go to **Settings** → **Linked Devices** → **Link a Device**.
   - Scan the QR code shown in Meta Business Manager (or follow the in-app linking flow).

### Option B: Embedded Signup (For new connections)

1. Connect via **Integrations → WhatsApp Business → Connect**. The OAuth flow must use Embedded Signup (configured via `EMBEDDED_SIGNUP_CONFIG_ID` in `.env`).

2. When Meta shows the phone number setup screen, you must choose:
   - ✅ **"Connect your WhatsApp Business App"** — keeps the app active and enables coexistence
   - ❌ **"Migrate to Cloud API"** — moves fully to API; app messages will not sync

3. Ensure your Meta app and `.env` include:
   ```env
   EMBEDDED_SIGNUP_CONFIG_ID=your_config_id
   ```

### Webhook Subscriptions (Already Configured)

The app subscribes to `messages` and `message_template_status_update`. This covers:
- Incoming customer messages (`value.messages`)
- Agent messages from app (`value.sent`) — when coexistence is enabled
- Delivery/read status updates (`value.statuses`)

## If Your Number Is Already Connected (Without Coexistence)

If you connected **before** choosing coexistence:

1. **Option 1**: Enable coexistence in Meta Business Manager (Option A above) — no need to disconnect.
2. **Option 2**: If Option 1 is not available:
   - **Remove** the number from the API (disconnect in Meta Business Manager or via our panel)
   - **Re-onboard** using the Embedded Signup flow
   - During setup, choose **"Connect your WhatsApp Business App"**

Numbers added manually in Meta Business Manager (outside Embedded Signup) may not support coexistence — use Option A if available.

## Verification

| Check | How to Verify |
|-------|---------------|
| Coexistence enabled | Meta Business Manager → Phone Numbers → Settings → Coexistence ON |
| App linked | WhatsApp Business App → Settings → Linked Devices shows linked device |
| Customer messages | If your webhook receives them, the webhook is configured correctly |
| App-sent messages | Send from app → they should appear in the panel; check server logs for `Processing X message(s) sent from WhatsApp Business app` |
| Meta status | **WhatsApp Manager → Phone Numbers** — number should show as connected. In the app: "Connected to Meta Business Platform" |

## Troubleshooting

- **App messages still not syncing?** See [COEXISTENCE_CHATGPT_ANALYSIS.md](./COEXISTENCE_CHATGPT_ANALYSIS.md) for a detailed checklist and webhook payload analysis.
- **Webhook logs**: Check `logs/webhook-logs/` (or your configured path) to confirm whether `value.sent` is present when you send from the app.

## Summary

| Goal | Action |
|------|--------|
| Use app + panel together | Enable coexistence in Meta (Option A) or use Embedded Signup with "Connect your WhatsApp Business App" (Option B) |
| API only | Use "Migrate to Cloud API" or send only from the panel |
| App only | Do not connect to Cloud API |

For full Embedded Signup setup (System User, subscriptions, etc.), see [EMBEDDED_SIGNUP_COMPLETE_FLOW.md](./EMBEDDED_SIGNUP_COMPLETE_FLOW.md).
