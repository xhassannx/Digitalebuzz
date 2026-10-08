# Meta App Review – WhatsApp Business Messaging Screencast Script

**Purpose:** Pass Meta's App Review for `whatsapp_business_messaging` permission.  
**Rejection reason:** "SC failed to show sending of message from APP to WA or WA to APP."

This script ensures your screencast clearly demonstrates the **end-to-end experience** Meta requires.

---

## Prerequisites Before Recording

1. **Set app UI to English** – Ensure all labels, buttons, and menus are in English.
2. **Use a test WhatsApp Business number** – Have a phone with WhatsApp Business app or a test number connected.
3. **Have a second phone** – To send messages TO your app (WA → APP flow).
4. **Screen recording tool** – OBS, Loom, or built-in screen recorder. Record at 1080p if possible.
5. **Add captions/tooltips** – Use a video editor or overlay text during recording to explain each step.

---

## Screencast Script (5–7 minutes)

### Part 1: Meta Login Flow (1–2 min)

| Step | Action | Caption / Narration |
|------|--------|---------------------|
| 1 | Open your app in browser (e.g. `https://yourapp.com`) | "This is our WhatsApp Business messaging dashboard." |
| 2 | Go to **Integrations** (sidebar) | "We connect WhatsApp Business via Meta OAuth." |
| 3 | Click **Connect** on WhatsApp Business | "Clicking Connect starts the Meta login flow." |
| 4 | Meta OAuth popup opens – show Facebook/Meta login | "User logs in with their Meta account." |
| 5 | User grants permissions (whatsapp_business_messaging, etc.) | "User grants access to WhatsApp Business permissions." |
| 6 | Popup closes, app shows "Connected" | "Connection complete. WhatsApp Business is now linked." |

---

### Part 2: Connect Phone Number (if needed)

| Step | Action | Caption / Narration |
|------|--------|---------------------|
| 7 | Go to **Connect** or **WhatsApp Templates** page | "We add the phone number that will send and receive messages." |
| 8 | Click **Add Phone Number** and complete flow | "Phone number is connected to our app." |
| 9 | Ensure status shows **Connected** | "Phone is ready for messaging." |

---

### Part 3: APP → WA (Send message FROM app TO WhatsApp) – **CRITICAL**

| Step | Action | Caption / Narration |
|------|--------|---------------------|
| 10 | Go to **Inbox** (or **Chat** in sidebar) | "This is our Inbox where we manage WhatsApp conversations." |
| 11 | Select a chat (or create one by having the test phone message you first) | "Selecting a conversation." |
| 12 | Type a message in the input box (e.g. "Hello from our app!") | "Typing a message in our app." |
| 13 | Click **Send** (or press Enter) | "Sending the message via WhatsApp Business API." |
| 14 | **Show the message appearing on the recipient's WhatsApp** (second phone) | "The message is delivered to the customer's WhatsApp. This proves APP → WA messaging." |

**Important:** Split screen or cut to the phone showing the received message. Meta reviewers must see the message arrive on WhatsApp.

---

### Part 4: WA → APP (Receive message FROM WhatsApp TO app) – **CRITICAL**

| Step | Action | Caption / Narration |
|------|--------|---------------------|
| 15 | On the **second phone**, open WhatsApp and send a message to your Business number | "The customer sends a message from their WhatsApp." |
| 16 | **Show the message appearing in your app's Inbox** (within a few seconds) | "The message is received in our app in real time. This proves WA → APP messaging." |
| 17 | Optionally reply from the app again | "We can reply directly from the dashboard." |

**Important:** The reviewer must see the message go from WhatsApp (phone) → your app (screen).

---

### Part 5: Optional – Additional Use Case (30 sec)

| Step | Action | Caption / Narration |
|------|--------|---------------------|
| 18 | Show **Campaigns** or **Templates** if you use them | "We also send template messages for marketing and support." |
| 19 | Or show **Chatbots** replying automatically | "Automated replies use the same WhatsApp Business API." |

---

## Submission Notes (copy into Meta App Review)

Paste this in the **Submission Notes** field when resubmitting:

```
Our app uses the WhatsApp Business API (whatsapp_business_messaging) for two-way messaging:

1. APP → WA: Business users send messages from our web dashboard to their customers' WhatsApp. Messages are delivered via the WhatsApp Business API.

2. WA → APP: When customers reply on WhatsApp, messages are received in our app via Meta webhooks and displayed in the Inbox in real time.

The screencast demonstrates:
- Complete Meta OAuth login and permission grant
- Sending a message from our app to a WhatsApp recipient (message visible on phone)
- Receiving a message from WhatsApp in our app (message sent from phone, visible in dashboard)

Our app is a web-based dashboard. We use server-to-server integration with Meta's API; the frontend does not show the raw API calls, but the end-to-end flow (compose → send → deliver on WhatsApp, and receive on WhatsApp → appear in app) is fully shown.
```

---

## If You Use System User Token

If your app uses a **System User token** (no user-facing Meta login in the flow), add:

```
Note: Our app uses a System User access token for server-to-server API access. The Meta login flow is performed once during initial setup by the account admin. The screencast shows the messaging use case from the business user's perspective (sending and receiving messages in our dashboard).
```

---

## Best Practices Checklist

- [ ] **English UI** – All buttons, labels, and menus in English
- [ ] **Captions** – Add text overlays explaining each step
- [ ] **Tooltips** – Briefly explain what buttons do (e.g. "Send – delivers message via WhatsApp API")
- [ ] **APP → WA** – Clearly show message sent from app arriving on WhatsApp (phone screen)
- [ ] **WA → APP** – Clearly show message sent from phone appearing in app
- [ ] **No sensitive data** – Use test numbers and generic messages
- [ ] **1080p** – Record at 1080p for clarity
- [ ] **5–7 minutes** – Long enough to show full flow, not too long

---

## Quick Reference: App Routes

| Route | Purpose |
|-------|---------|
| `/integrations` | Connect WhatsApp Business (Meta OAuth) |
| `/connect` | Add phone numbers, manage WhatsApp connection |
| `/chat` | Inbox – send and receive messages (main demo) |
| `/campaigns` | Bulk messaging (optional) |
| `/chatbots` | Automated replies (optional) |

---

## Common Rejection Avoidance

1. **Do not** only show the OAuth flow – you must show messaging.
2. **Do not** skip the phone – reviewers must see the message on WhatsApp.
3. **Do** show both directions: APP→WA and WA→APP.
4. **Do** add captions – reviewers may watch without sound.
5. **Do** mention server-to-server or System User in notes if applicable.
