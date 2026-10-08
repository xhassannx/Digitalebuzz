# n8n Integration Plan for WhatsApp Panel

## What is n8n?

**n8n** (pronounced "n-eight-n") is an open-source workflow automation platform—similar to Zapier or Make. It lets you:

- Connect apps and services without writing code
- Build visual workflows by dragging and linking nodes
- Trigger automations via webhooks, schedules, or manual runs
- Use 400+ pre-built integrations (Slack, Google Sheets, CRM, etc.)
- Self-host on your server or use n8n Cloud

**Common use cases:** Sync data between tools, auto-reply to customers, enrich leads, run AI pipelines, build full business processes.

---

## How n8n Fits with the WhatsApp Panel

| Direction | Description |
|-----------|-------------|
| **Panel → n8n** | WhatsApp events (new message, message sent, etc.) are sent to n8n via webhooks. n8n workflows react in real time. |
| **n8n → Panel** | n8n workflows call the Panel's Project API to send messages, list chats, get contacts, etc. |

Together, you get **bidirectional automation**: incoming WhatsApp messages trigger n8n, and n8n can send replies or update systems.

---

## Integration Architecture

```
┌─────────────────┐     Webhook POST      ┌─────────────┐     HTTP Request      ┌──────────────────┐
│  WhatsApp       │ ───────────────────►  │    n8n      │ ───────────────────►  │  WhatsApp Panel  │
│  (Meta/User)    │   (event + data)     │  Workflow   │   (X-API-Key auth)    │  Project API     │
└─────────────────┘                      └─────────────┘                       └──────────────────┘
        │                                        │
        │                                        ▼
        │                                ┌───────────────┐
        │                                │  Other apps   │
        │                                │  (CRM, Slack, │
        │                                │   Sheets...)  │
        │                                └───────────────┘
        │
        ▼
┌─────────────────┐
│  WhatsApp Panel │  Stores message, triggers webhooks to n8n URL
│  (your server)  │
└─────────────────┘
```

---

## Phase 1: Panel → n8n (Webhook Triggers)

### What the Panel Already Has

- **Webhook manager** in Settings: add URL, select events
- **Events:** `message.received`, `message.sent`, `message.status_updated`, `session.connected`, `session.disconnected`, `chat.new`
- **Payload format:**
  ```json
  {
    "event": "message.received",
    "timestamp": "2025-03-17T10:30:00.000Z",
    "data": {
      "message": {
        "id": "...",
        "chatId": "...",
        "contactNumber": "919876543210",
        "content": "Hello",
        "type": "text",
        "sessionId": "...",
        ...
      }
    }
  }
  ```
- **Signature:** `X-Webhook-Signature` header (HMAC-SHA256 of body with webhook secret)

### Steps to Connect n8n

1. **Create an n8n workflow**
   - Add a **Webhook** node (trigger)
   - Set HTTP method: `POST`
   - Copy the **Production URL** (e.g. `https://your-n8n.com/webhook/abc123`)

2. **Add webhook in WhatsApp Panel**
   - Go to **Settings → Webhooks**
   - Add URL: `https://your-n8n.com/webhook/abc123`
   - Select events: e.g. `message.received`, `message.sent`
   - Save

3. **Activate the n8n workflow**
   - Toggle the workflow ON so the webhook URL is live

4. **Verify**
   - Send a test WhatsApp message to your number
   - Check n8n execution history for the incoming webhook

---

## Phase 2: n8n → Panel (API Actions)

### What the Panel API Offers

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/project/v1/sessions` | GET | List WhatsApp numbers |
| `/api/project/v1/messages` | POST | Send text, image, template, etc. |
| `/api/project/v1/messages/send-text` | POST | Send text only |
| `/api/project/v1/messages/send-template` | POST | Send template |
| `/api/project/v1/chats` | GET | List chats |
| `/api/project/v1/contacts` | GET/POST | List/create contacts |
| `/api/project/v1/templates` | GET | List templates |

**Auth:** `X-API-Key: YOUR_API_KEY` (from Settings → API Keys)

### Steps to Call Panel from n8n

1. **Create API key** in Panel: Settings → API Keys
2. **Add HTTP Request node** in n8n
   - Method: `POST` (for send) or `GET` (for list)
   - URL: `https://your-panel.com/api/project/v1/messages`
   - Headers: `X-API-Key: {{ $env.API_KEY }}` (use n8n credentials for secrets)
   - Body (for send-text):
     ```json
     {
       "sessionId": "{{ $json.data.message.sessionId }}",
       "to": "{{ $json.data.message.contactNumber }}",
       "type": "text",
       "text": { "body": "Thanks for your message! We'll reply soon." }
     }
     ```

3. **Chain nodes:** Webhook (trigger) → Process data → HTTP Request (send reply)

---

## Phase 3: Example Workflows

### 1. Auto-reply on New Message

```
[Webhook] → [IF: message type = text] → [HTTP Request: POST /api/project/v1/messages]
```

### 2. Add Contact to Google Sheet

```
[Webhook] → [Extract contactNumber, content] → [Google Sheets: Append row]
```

### 3. Notify Slack on New Message

```
[Webhook] → [Slack: Send message] (include contact + message body)
```

### 4. CRM Sync (Create/Update Contact)

```
[Webhook] → [HTTP Request: GET /api/project/v1/contacts/by-phone/:phone]
         → [IF not found] → [HTTP Request: POST /api/project/v1/contacts]
         → [Update CRM]
```

### 5. AI-Powered Reply

```
[Webhook] → [OpenAI/ChatGPT node] → [HTTP Request: POST /api/project/v1/messages]
```

---

## Phase 4: Optional Enhancements (Build into Panel)

| Enhancement | Description | Effort |
|-------------|-------------|--------|
| **n8n preset URL** | Add "Connect to n8n" button that opens n8n webhook creation with pre-filled Panel webhook URL | Low |
| **n8n template export** | Export a ready-made n8n workflow JSON (Webhook + HTTP Request) users can import | Low |
| **Docs page** | Dedicated "Integrations → n8n" page with copy-paste examples and video | Low |
| **Webhook test** | "Send test event" button to verify n8n receives payload | Medium |
| **n8n OAuth / deep link** | If n8n Cloud supports it, one-click connect from Panel | High |

---

## Implementation Checklist

### Immediate (No Code Changes)

- [ ] Document webhook payload schema (events, `data` structure)
- [ ] Add n8n section to docs/API.md or create docs/N8N_GUIDE.md
- [ ] Create sample n8n workflow JSON for import

### Short Term (Small Code Changes)

- [ ] Add "Test webhook" button in Webhook Manager (sends sample payload)
- [ ] Add n8n-specific help text in webhook form: "For n8n: use Webhook node Production URL"
- [ ] Ensure webhook events include `sessionId` in `data` for API calls

### Medium Term (If Desired)

- [ ] Pre-built n8n template: "WhatsApp Panel – Message to Slack" workflow
- [ ] Integration page: "n8n" card with setup steps and link to n8n.io

---

## Webhook Event Reference (for n8n)

| Event | When | `data` contains |
|-------|------|-----------------|
| `message.received` | Incoming message | `message` (id, chatId, contactNumber, content, type, sessionId, ...) |
| `message.sent` | Outgoing message sent | `message` |
| `message.status_updated` | Delivery/read status | `message` (with status) |
| `session.connected` | WhatsApp number connected | `session` |
| `session.disconnected` | WhatsApp number disconnected | `session` |
| `chat.new` | New conversation | `chat` |
| `contact.created` | New contact created | `contact` |
| `contact.updated` | Contact updated | `contact` |
| `contact.deleted` | Contact deleted | `contact` |
| `contact.tag_added` | Tag assigned to contact | `contact`, `tag` |
| `contact.tag_removed` | Tag removed from contact | `contact`, `tag` |

**Umbrella events:** `messages` = all message.* events; `contacts` = all contact.* events; `app_events` = all app integration events.

**App integration events:**
| Event | When | `data` contains |
|-------|------|-----------------|
| `calendly.invitee_created` | Calendly appointment booked | `invitee`, `calendlyEvent`, `questions_and_answers` |
| `calendly.invitee_canceled` | Calendly appointment canceled | `invitee`, `calendlyEvent`, `cancel_reason` |
| `calendly.routing_form_submission` | Calendly routing form submitted | `submission` |
| `google_calendar.event_created` | Google Calendar event created | `resourceState`, `resourceId` |
| `google_calendar.event_updated` | Google Calendar event updated | `resourceState`, `resourceId` |
| `google_calendar.event_deleted` | Google Calendar event deleted | `resourceState`, `resourceId` |
| `shopify.order_created` | New Shopify order | `order`, `topic` |
| `shopify.order_updated` | Shopify order updated | `order`, `topic` |
| `shopify.customer_created` | New Shopify customer | `customer`, `topic` |
| `facebook_lead_ads.lead_received` | Facebook Lead Ads lead | `leadId`, `formId`, `pageId`, `change` |

---

## Security Notes

- **Webhook signature:** Verify `X-Webhook-Signature` in n8n (HMAC-SHA256 with webhook secret) to ensure requests are from your Panel
- **API key:** Store in n8n credentials, never in workflow JSON
- **HTTPS:** Use HTTPS for both Panel and n8n webhook URLs

---

## Resources

- [n8n Documentation](https://docs.n8n.io/)
- [n8n Webhook Node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/)
- [WhatsApp Panel API](docs/API.md)
- [Project API Postman Collection](client/public/Project_API.postman_collection.json)
