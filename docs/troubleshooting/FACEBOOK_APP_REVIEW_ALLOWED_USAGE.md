# Facebook App Review - Allowed Usage Guide

Complete guide for filling out the "Allowed Usage" section for each permission during Facebook App Review.

---

## 🎯 Allowed Usage for `leads_retrieval`

### How will your app use this permission?

**Recommended Answer:**

```
Our app will use the leads_retrieval permission to:

1. Retrieve lead data from Facebook Lead Ads forms that our business clients have created
2. Access lead information including:
   - Contact details (name, email, phone number) from form fields
   - Form submission timestamps
   - Lead metadata (form ID, page ID, campaign information)
3. Sync retrieved leads to our clients' contact management systems
4. Display leads in our platform's dashboard for client review
5. Enable clients to export leads for CRM integration
6. Provide automated lead syncing on-demand or scheduled intervals

Use Case:
- Business clients connect their Facebook Pages via OAuth
- Clients select which Lead Ads forms to sync
- Our platform retrieves leads from those forms via Graph API
- Leads are automatically added to clients' contact databases
- Clients can view, manage, and export leads through our dashboard

Data Usage:
- Lead data is stored securely in our database
- Each client only sees their own leads (data isolation)
- Lead data is used solely for contact management and CRM purposes
- We do not share lead data with third parties
- Clients can delete their data at any time

Technical Implementation:
- Uses Facebook Graph API: GET /{form-id}/leads
- Handles pagination to retrieve all leads
- Processes field_data to extract contact information
- Syncs leads to managed contacts table
- Updates existing contacts if duplicate phone/email found
```

---

## 🎯 Allowed Usage for `pages_manage_ads`

### How will your app use this permission?

**Recommended Answer:**

```
Our app will use the pages_manage_ads permission to:

1. Access lead forms associated with Facebook Pages that our clients manage
2. Retrieve lead form metadata including:
   - Form ID, name, and status
   - Form structure and field definitions
   - Form creation and modification dates
3. List all lead forms for a given Facebook Page
4. Access form details to understand lead data structure
5. Enable clients to select which forms to sync leads from

Use Case:
- Business clients connect their Facebook Pages via OAuth
- Our platform lists all lead forms available on their pages
- Clients can see form names, status, and lead counts
- Clients select specific forms to sync leads from
- Our platform uses form IDs to retrieve leads via leads_retrieval permission

Data Usage:
- Form metadata is used to display available forms to clients
- Form information helps clients identify which forms to sync
- We do not modify or create forms (read-only access)
- Form data is used solely for lead retrieval purposes

Technical Implementation:
- Uses Facebook Graph API: GET /{page-id}/leadgen_forms
- Retrieves form list and metadata
- Displays forms in our platform's UI
- Uses form IDs for subsequent lead retrieval
```

---

## 🎯 Allowed Usage for `pages_show_list`

### How will your app use this permission?

**Recommended Answer:**

```
Our app will use the pages_show_list permission to:

1. Retrieve the list of Facebook Pages that the authenticated user manages or can access
2. Display those Page names and IDs in our product UI so the user can choose which Page to use for Lead Ads
3. Enable the next steps: listing lead generation forms for the selected Page and retrieving leads

Use Case:
- After the user completes Facebook Login (OAuth), we call the Graph API GET /me/accounts
- We show the returned Pages in a dropdown or list inside our Integrations / Facebook Lead Ads section
- The user selects a Page, then selects lead forms and syncs leads into our contact/CRM features

Data Usage:
- Page IDs and names are used only to power Lead Ads syncing for that customer
- We do not sell or share Page lists with third parties

Technical Implementation:
- Graph API: GET /me/accounts?fields=id,name,category,access_token
- Required so our SaaS customers can use their own Pages without manual Page ID entry
```

**App Review video:** The screencast must show, after login: **your app’s Page list/dropdown** (not only “Connected”). See `FACEBOOK_PAGES_SHOW_LIST_META_REVIEW.md`.

---

## 🎯 Allowed Usage for `whatsapp_business_messaging`

### How will your app use this permission?

**Recommended Answer:**

```
Our app will use the whatsapp_business_messaging permission to:

1. Send messages to customers via WhatsApp Business API on behalf of our business clients
2. Receive incoming messages from customers
3. Manage conversations between businesses and their customers
4. Send template messages that have been approved in Meta Business Manager
5. Handle message status updates (sent, delivered, read)
6. Process incoming webhooks for real-time message delivery

Use Case:
- Business clients connect their WhatsApp Business Accounts via OAuth
- Clients select their WhatsApp Business phone numbers
- Our platform provides a messaging interface for clients
- Clients can send text, media, location, and contact messages
- Clients receive and respond to customer messages
- All messaging is done through clients' own WhatsApp Business Accounts

Data Usage:
- Messages are stored securely in our database
- Each client only sees their own messages (data isolation)
- Message data is used solely for customer communication
- We do not share message data with third parties
- Clients can access their message history through our platform

Technical Implementation:
- Uses WhatsApp Business API: POST /{phone-number-id}/messages
- Sends messages via official WhatsApp Cloud API
- Receives webhooks for incoming messages
- Processes message status updates
- Stores messages in our database for client access
- Provides real-time messaging through WebSocket connections
```

---

## 🎯 Allowed Usage for `whatsapp_business_management`

### How will your app use this permission?

**Recommended Answer:**

```
Our app will use the whatsapp_business_management permission to:

1. Access WhatsApp Business Accounts (WABA) that our clients own
2. List available WhatsApp Business phone numbers
3. Retrieve phone number details (display number, verified name, status)
4. Access message templates that clients have created in Meta Business Manager
5. Sync templates for use in our messaging interface
6. Manage phone number configurations and settings

Use Case:
- Business clients connect their WhatsApp Business Accounts via OAuth
- Our platform lists all phone numbers associated with their WABA
- Clients can select which phone number to use for messaging
- Our platform syncs message templates from Meta Business Manager
- Clients can use approved templates in our messaging interface
- Each phone number becomes a separate messaging session

Data Usage:
- WABA and phone number data is used to display available options
- Template data is synced and displayed in our platform
- We do not modify WABA settings or phone numbers
- Data is used solely for messaging functionality
- Each client only sees their own WABA data (data isolation)

Technical Implementation:
- Uses Facebook Graph API: GET /me/owned_whatsapp_business_accounts
- Retrieves phone numbers: GET /{waba-id}/phone_numbers
- Syncs templates: GET /{waba-id}/message_templates
- Displays options in our platform's UI
- Uses phone number IDs for messaging operations
```

---

## 📋 Complete Allowed Usage Template

### For All Permissions Combined:

**Title:** SaaS Platform for Lead Management and WhatsApp Messaging

**Allowed Usage Summary:**

```
Our multi-tenant SaaS platform enables business clients to:

1. Facebook Lead Ads Integration:
   - Connect their Facebook Pages via OAuth
   - Access and list their Lead Ads forms
   - Retrieve leads from selected forms
   - Sync leads to contact management system
   - View and export leads through our dashboard

2. WhatsApp Business Integration:
   - Connect their WhatsApp Business Accounts via OAuth
   - Access their WhatsApp Business phone numbers
   - Send and receive messages via WhatsApp Business API
   - Use approved message templates
   - Manage customer conversations

Key Points:
- Each client connects their own Facebook/WhatsApp accounts
- Data is isolated per client (multi-tenant architecture)
- We provide the platform infrastructure
- Clients manage their own business data
- All data usage is for legitimate business purposes
- We comply with Meta's data usage policies
```

---

## ✅ Key Points to Emphasize

### For All Permissions:

1. **Data Isolation:**
   - Each client only sees their own data
   - Multi-tenant architecture ensures data separation
   - Clients cannot access each other's data

2. **Legitimate Business Use:**
   - Lead management and CRM integration
   - Customer communication via WhatsApp
   - Business workflow automation

3. **User Control:**
   - Clients connect their own accounts
   - Clients choose which forms/phone numbers to use
   - Clients can disconnect at any time

4. **Data Security:**
   - Secure data storage
   - Encrypted connections
   - Access controls in place

5. **Compliance:**
   - Follows Meta policies
   - Respects user privacy
   - Proper data handling

---

## 📝 Format for Submission

### For Each Permission, Use This Format:

**Permission Name:** [Permission Name]

**How will your app use this permission?**

[Use the detailed answer provided above]

**What user value does this provide?**

- Eliminates manual data entry
- Provides unified interface for managing leads and messages
- Enables integration with existing workflows
- Saves time and reduces errors

**How do you ensure data security?**

- OAuth-based authentication
- Encrypted data storage
- Data isolation per client
- Access controls and permissions
- Regular security audits

---

## 🎯 Quick Reference

### `leads_retrieval`:
- **Use**: Retrieve leads from Lead Ads forms
- **Value**: Automatic lead syncing to CRM
- **Security**: Client data isolation

### `pages_manage_ads`:
- **Use**: Access lead forms on Pages
- **Value**: List available forms for syncing
- **Security**: Read-only access, client isolation

### `whatsapp_business_messaging`:
- **Use**: Send/receive WhatsApp messages
- **Value**: Unified messaging interface
- **Security**: Client data isolation

### `whatsapp_business_management`:
- **Use**: Access WABA and phone numbers
- **Value**: Manage WhatsApp Business accounts
- **Security**: Client data isolation

---

## ✅ Checklist

Before submitting Allowed Usage:

- [ ] Clear explanation of how each permission is used
- [ ] User value clearly stated
- [ ] Data security measures mentioned
- [ ] Data isolation explained
- [ ] Compliance with Meta policies
- [ ] Technical implementation described
- [ ] Use cases provided
- [ ] No vague or unclear statements

---

**Last Updated**: 2024
**Status**: Ready for App Review submission

