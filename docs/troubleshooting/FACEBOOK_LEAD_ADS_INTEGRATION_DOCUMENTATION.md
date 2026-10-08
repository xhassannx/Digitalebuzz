# Facebook Lead Ads Integration - Complete Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Setup & Configuration](#setup--configuration)
4. [OAuth Flow](#oauth-flow)
5. [API Endpoints](#api-endpoints)
6. [Data Flow](#data-flow)
7. [Database Schema](#database-schema)
8. [Frontend Components](#frontend-components)
9. [Integration Steps](#integration-steps)
10. [Error Handling](#error-handling)
11. [Webhooks](#webhooks)
12. [Code Examples](#code-examples)

---

## Overview

The Facebook Lead Ads integration allows businesses to automatically sync leads from Facebook Lead Ads campaigns into their contact management system. When users submit information through Facebook Lead Ads forms, the integration fetches these leads and creates or updates contacts in the system.

### Key Features
- **OAuth Authentication**: Secure connection to Facebook using OAuth 2.0
- **Lead Syncing**: Fetch leads from Facebook Lead Ads forms
- **Contact Management**: Automatically create/update contacts from leads
- **Field Mapping**: Map Facebook form fields to contact custom fields
- **Date Filtering**: Sync leads within specific date ranges
- **Webhook Support**: Real-time lead notifications (optional)

### Prerequisites
- Facebook App with Lead Ads permissions
- Facebook Page with admin access
- Facebook Lead Ads forms created in Ads Manager
- Environment variables configured (see Setup section)

---

## Architecture

### Component Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  FacebookLeadsManager Component                      │   │
│  │  - Page selection                                     │   │
│  │  - Form selection                                     │   │
│  │  - Date range filtering                               │   │
│  │  - Sync trigger                                       │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ HTTP Requests
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Express)                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  OAuth Routes (facebook.ts)                          │   │
│  │  - /oauth/authorize                                  │   │
│  │  - /fb/callback                                       │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Lead Handler (facebook-leads.ts)                    │   │
│  │  - /sync-leads                                        │   │
│  │  - /pages                                             │   │
│  │  - /forms/:pageId                                     │   │
│  │  - /webhook (GET/POST)                                │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Graph API Calls
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Facebook Graph API (v18.0)                     │
│  - OAuth token exchange                                    │
│  - Pages retrieval                                         │
│  - Lead forms retrieval                                    │
│  - Leads data fetching                                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Data Storage
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Database (PostgreSQL)                     │
│  - integrations table                                       │
│  - managed_contacts table                                   │
│  - integration_oauth_states table                            │
└─────────────────────────────────────────────────────────────┘
```

### File Structure

```
server/
├── integrations/
│   ├── index.ts                    # Integration registry
│   ├── oauth/
│   │   └── facebook.ts            # OAuth flow handlers
│   └── handlers/
│       └── facebook-leads.ts      # Lead syncing logic
└── storage.ts                      # Database operations

client/
└── src/
    ├── components/
    │   └── facebook-leads-manager.tsx  # UI component
    └── pages/
        └── integrations-page.tsx        # Integration listing

shared/
└── schema.ts                        # Database schemas
```

---

## Setup & Configuration

### 1. Environment Variables

Add these to your `.env` file:

```env
# Facebook OAuth Configuration
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
BASE_URL=https://your-domain.com

# Optional: Webhook verification token
FACEBOOK_WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token
```

### 2. Facebook App Setup

1. **Create Facebook App**
   - Go to [Facebook Developers](https://developers.facebook.com/)
   - Create a new app or use existing
   - Add "Facebook Login" product

2. **Configure OAuth Settings**
   - Valid OAuth Redirect URIs: `https://your-domain.com/fb/callback`
   - Note: Facebook uses shorter callback path `/fb/callback` instead of full path

3. **Request Permissions**
   Required permissions:
   - `leads_retrieval` - Retrieve lead data
   - `pages_read_engagement` - Read page engagement
   - `pages_manage_metadata` - Manage page metadata
   - `pages_read_user_content` - Read user content on pages
   - `pages_manage_ads` - Manage ads and lead forms

4. **App Review** (for production)
   - Submit app for review with required permissions
   - For testing, use test users and development mode

### 3. Database Schema

The integration uses these tables:

- **integrations**: Stores OAuth credentials and integration status
- **managed_contacts**: Stores synced contacts from leads
- **integration_oauth_states**: Temporary OAuth state storage

See [Database Schema](#database-schema) section for details.

---

## OAuth Flow

### Flow Diagram

```
User clicks "Connect" 
    │
    ▼
Frontend calls GET /api/integrations/facebook-lead-ads/oauth/authorize
    │
    ▼
Backend generates OAuth state, stores it, returns auth URL
    │
    ▼
Frontend opens popup with Facebook OAuth URL
    │
    ▼
User authorizes on Facebook
    │
    ▼
Facebook redirects to /fb/callback?code=...&state=...
    │
    ▼
Backend verifies state, exchanges code for access token
    │
    ▼
Backend exchanges short-lived token for long-lived token (60 days)
    │
    ▼
Backend saves integration with credentials
    │
    ▼
Callback page sends postMessage to parent window
    │
    ▼
Frontend receives success message, refreshes integration list
```

### Implementation Details

**File**: `server/integrations/oauth/facebook.ts`

**Key Functions**:
- `registerFacebookOAuthRoutes()`: Registers OAuth endpoints
- State management: Uses `integration_oauth_states` table to prevent CSRF
- Token exchange: Converts authorization code → short-lived token → long-lived token
- Error handling: Returns HTML pages that communicate with parent window via `postMessage`

**OAuth Scopes**:
```typescript
const FACEBOOK_SCOPES = [
  "leads_retrieval",
  "pages_read_engagement",
  "pages_manage_metadata",
  "pages_read_user_content",
  "pages_manage_ads",
];
```

**Token Storage**:
```typescript
const credentials = {
  access_token: string,      // Long-lived token (60 days)
  expires_at: number,        // Timestamp in milliseconds
  token_type: "Bearer",
};
```

---

## API Endpoints

### 1. OAuth Authorization

**GET** `/api/integrations/facebook-lead-ads/oauth/authorize`

Initiates OAuth flow.

**Request**: 
- Headers: `Authorization: Bearer <token>`
- Query: None

**Response**:
```json
{
  "authUrl": "https://www.facebook.com/v18.0/dialog/oauth?..."
}
```

**Implementation**:
- Generates random state token
- Stores state in database with expiration (10 minutes)
- Builds Facebook OAuth URL with required scopes
- Returns URL for frontend to open in popup

---

### 2. OAuth Callback

**GET** `/fb/callback`

Handles Facebook OAuth callback.

**Request**:
- Query params:
  - `code`: Authorization code from Facebook
  - `state`: State token for verification
  - `error`: Error code (if authorization failed)

**Response**: HTML page that:
- Verifies state token
- Exchanges code for access token
- Exchanges for long-lived token
- Saves integration
- Sends `postMessage` to parent window
- Closes popup

**Error Handling**:
- Returns HTML with error message
- Sends error via `postMessage` to parent window

---

### 3. Sync Leads

**POST** `/api/integrations/facebook-lead-ads/sync-leads`

Fetches leads from Facebook and syncs them to contacts.

**Request Body**:
```json
{
  "integrationId": "optional-integration-id",
  "pageId": "optional-page-id",
  "formId": "optional-form-id",
  "startDate": "2024-01-01",  // Optional ISO date string
  "endDate": "2024-12-31"      // Optional ISO date string
}
```

**Response**:
```json
{
  "success": true,
  "leads": [...],                    // Array of lead objects
  "count": 150,
  "syncedContactsCount": 120,        // New contacts created
  "updatedContactsCount": 25,         // Existing contacts updated
  "skippedContactsCount": 5,          // Leads skipped (no phone/email)
  "syncedContactIds": ["id1", ...],  // IDs of synced contacts
  "errorDetails": [...],             // Errors if any
  "syncedAt": "2024-01-15T10:30:00Z",
  "pagesProcessed": 2
}
```

**Process Flow**:
1. Validates integration and access token
2. Fetches user's Facebook pages (or specific page)
3. For each page, fetches lead forms
4. For each form, fetches leads (with pagination)
5. For each lead:
   - Extracts field data (phone, email, name, custom fields)
   - Checks if contact exists (by phone or email)
   - Creates new contact or updates existing
   - Stores Facebook metadata in custom fields
6. Returns summary statistics

**Field Extraction Logic**:
```typescript
// Automatically detects common fields:
- Phone: fields containing "phone", "mobile", "tel"
- Email: fields containing "email"
- Name: fields containing "name", "full_name", "first_name", "last_name"
- All other fields: stored in customFields
```

**Custom Fields Stored**:
```typescript
{
  ...leadFields,                    // All form fields
  facebook_lead_id: string,          // Facebook lead ID
  facebook_form_id: string,          // Form ID
  facebook_form_name: string,        // Form name
  facebook_page_id: string,          // Page ID
  facebook_page_name: string,        // Page name
  synced_at: string,                 // ISO timestamp
  last_synced_at: string             // For updates
}
```

---

### 4. Get Pages

**GET** `/api/integrations/facebook-lead-ads/pages`

Retrieves user's Facebook pages.

**Request**: 
- Headers: `Authorization: Bearer <token>`

**Response**:
```json
{
  "success": true,
  "pages": [
    {
      "id": "page-id",
      "name": "Page Name",
      "category": "Business"
    }
  ],
  "count": 3
}
```

---

### 5. Get Forms

**GET** `/api/integrations/facebook-lead-ads/forms/:pageId`

Retrieves lead forms for a specific page.

**Request**:
- Path param: `pageId` - Facebook page ID
- Headers: `Authorization: Bearer <token>`

**Response**:
```json
{
  "success": true,
  "forms": [
    {
      "id": "form-id",
      "name": "Form Name",
      "status": "ACTIVE",
      "leads_count": 150
    }
  ],
  "count": 5
}
```

---

### 6. Webhook Verification

**GET** `/api/integrations/facebook-lead-ads/webhook`

Verifies webhook subscription (Facebook requirement).

**Request**:
- Query params:
  - `hub.mode`: "subscribe"
  - `hub.verify_token`: Verification token
  - `hub.challenge`: Challenge string from Facebook

**Response**: Returns `hub.challenge` if token matches

---

### 7. Webhook Handler

**POST** `/api/integrations/facebook-lead-ads/webhook`

Receives real-time lead notifications (optional feature).

**Request Body** (Facebook format):
```json
{
  "object": "page",
  "entry": [
    {
      "changes": [
        {
          "field": "leadgen",
          "value": {
            "leadgen_id": "lead-id",
            "form_id": "form-id",
            "page_id": "page-id"
          }
        }
      ]
    }
  ]
}
```

**Response**: `{ "success": true }`

**Note**: Currently logs the lead but doesn't process it. To implement:
1. Fetch full lead details using Graph API
2. Call sync logic to create/update contact

---

## Data Flow

### Lead Sync Process

```
1. User selects page and form in UI
   │
   ▼
2. Frontend calls POST /sync-leads
   │
   ▼
3. Backend validates integration and token
   │
   ▼
4. Backend fetches pages from Graph API
   GET /me/accounts?fields=id,name,access_token
   │
   ▼
5. Backend fetches forms for each page
   GET /{page-id}/leadgen_forms?fields=id,name,status
   │
   ▼
6. Backend fetches leads for each form (with pagination)
   GET /{form-id}/leads?fields=id,created_time,field_data
   │
   ▼
7. For each lead:
   - Parse field_data array
   - Extract phone, email, name
   - Check if contact exists (by phone/email)
   │
   ├─► Contact exists: Update with new data
   │   - Merge custom fields
   - Add Facebook metadata
   - Update notes
   │
   └─► Contact doesn't exist: Create new
       - Set source = 'facebook'
       - Store all fields in customFields
       - Add Facebook metadata
       - Set notes with form/page info
   │
   ▼
8. Return summary with counts and contact IDs
```

### Contact Matching Logic

Contacts are matched using:
1. **Phone number** (exact match)
2. **Email** (case-insensitive match)

If a match is found, the contact is **updated** with:
- New lead data merged into custom fields
- Facebook metadata updated
- Notes appended with sync timestamp

If no match is found, a **new contact** is created.

---

## Database Schema

### integrations Table

Stores integration configuration and credentials.

```sql
CREATE TABLE integrations (
  id VARCHAR PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  organization_id VARCHAR,
  name VARCHAR NOT NULL,              -- 'facebook-lead-ads'
  display_name VARCHAR NOT NULL,      -- 'Facebook Lead Ads'
  category VARCHAR NOT NULL,           -- 'featured'
  status VARCHAR DEFAULT 'not_connected',  -- 'connected', 'not_connected', 'error'
  auth_type VARCHAR DEFAULT 'none',   -- 'oauth'
  config JSONB,                       -- { userId, name }
  credentials JSONB,                  -- { access_token, expires_at, token_type }
  last_sync_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Example credentials JSON**:
```json
{
  "access_token": "EAABwzLix...",
  "expires_at": 1735689600000,
  "token_type": "Bearer"
}
```

**Example config JSON**:
```json
{
  "userId": "123456789",
  "name": "John Doe"
}
```

---

### managed_contacts Table

Stores contacts synced from Facebook leads.

```sql
CREATE TABLE managed_contacts (
  id VARCHAR PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  organization_id VARCHAR,
  name VARCHAR NOT NULL,
  phone_number VARCHAR NOT NULL,
  email VARCHAR,
  source VARCHAR DEFAULT 'manual',     -- 'facebook' for Facebook leads
  custom_fields JSONB,                -- All form fields + Facebook metadata
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Example custom_fields JSON**:
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "company": "Acme Corp",
  "facebook_lead_id": "123456789",
  "facebook_form_id": "987654321",
  "facebook_form_name": "Contact Form",
  "facebook_page_id": "111222333",
  "facebook_page_name": "My Business Page",
  "synced_at": "2024-01-15T10:30:00Z"
}
```

---

### integration_oauth_states Table

Temporary storage for OAuth state tokens.

```sql
CREATE TABLE integration_oauth_states (
  id VARCHAR PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  organization_id VARCHAR,
  integration_name VARCHAR NOT NULL,  -- 'facebook-lead-ads'
  state VARCHAR NOT NULL UNIQUE,      -- Random state token
  code_verifier VARCHAR,              -- For PKCE (not used for Facebook)
  redirect_uri VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL       -- 10 minutes from creation
);
```

---

## Frontend Components

### FacebookLeadsManager Component

**File**: `client/src/components/facebook-leads-manager.tsx`

**Props**:
```typescript
type FacebookLeadsManagerProps = {
  integrationId?: string;
  isOpen: boolean;
  onClose: () => void;
};
```

**Features**:
- Step-by-step wizard UI
- Page selection dropdown
- Form selection dropdown (filtered by page)
- Date range picker (optional)
- Sync button with loading state
- Results display with lead details

**State Management**:
- Uses React Query for data fetching
- Caches pages and forms data
- Invalidates queries after sync

**Usage**:
```tsx
<FacebookLeadsManager
  integrationId={integration.id}
  isOpen={isDialogOpen}
  onClose={() => setIsDialogOpen(false)}
/>
```

**API Calls**:
1. `GET /api/integrations/facebook-lead-ads/pages` - Fetch pages
2. `GET /api/integrations/facebook-lead-ads/forms/:pageId` - Fetch forms
3. `POST /api/integrations/facebook-lead-ads/sync-leads` - Sync leads

---

### Integration Page

**File**: `client/src/pages/integrations-page.tsx`

**Features**:
- Lists all available integrations
- Shows connection status
- "Connect" button opens OAuth popup
- "Manage" button opens FacebookLeadsManager
- Handles OAuth success/error messages

**OAuth Flow**:
```typescript
// 1. Open OAuth popup
const res = await apiRequest("GET", `/api/integrations/facebook-lead-ads/oauth/authorize`);
const { authUrl } = await res.json();
const popup = window.open(authUrl, "Facebook OAuth", "width=600,height=700");

// 2. Listen for success message
window.addEventListener("message", (event) => {
  if (event.data.type === "FACEBOOK_OAUTH_SUCCESS") {
    // Refresh integration list
    queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
  }
});
```

---

## Integration Steps

### Step 1: Register Integration Definition

**File**: `server/integrations/index.ts`

```typescript
export const INTEGRATION_DEFINITIONS = {
  "facebook-lead-ads": {
    name: "facebook-lead-ads",
    displayName: "Facebook Lead Ads",
    category: "featured",
    authType: "oauth",
    description: "Automate lead generation...",
  },
};
```

---

### Step 2: Register OAuth Routes

**File**: `server/integrations/index.ts`

```typescript
import { registerFacebookOAuthRoutes } from "./oauth/facebook";

export function registerIntegrationRoutes(app: Express) {
  registerFacebookOAuthRoutes(app);
}
```

---

### Step 3: Register Lead Handler Routes

**File**: `server/integrations/index.ts`

```typescript
import { registerFacebookLeadsRoutes } from "./handlers/facebook-leads";

export function registerIntegrationRoutes(app: Express) {
  registerFacebookLeadsRoutes(app);
}
```

---

### Step 4: Add Frontend Component

**File**: `client/src/pages/integrations-page.tsx`

```typescript
import { FacebookLeadsManager } from "@/components/facebook-leads-manager";

// In component:
{isConnected && integration.name === "facebook-lead-ads" && (
  <FacebookLeadsManager
    integrationId={integration.id}
    isOpen={isLeadsManagerOpen}
    onClose={() => setIsLeadsManagerOpen(false)}
  />
)}
```

---

## Error Handling

### Common Errors

1. **Token Expired**
   - Error: `"Facebook access token has expired"`
   - Solution: User must reconnect integration
   - Detection: `credentials.expires_at < Date.now()`

2. **No Pages Found**
   - Error: `"No Facebook pages found"`
   - Solution: User must have admin access to at least one page
   - Check: Verify page permissions in Facebook

3. **No Forms Found**
   - Error: `"No lead forms found"`
   - Solution: Create lead forms in Facebook Ads Manager
   - Check: Ensure forms are ACTIVE status

4. **Invalid Credentials**
   - Error: `"Facebook access token not configured"`
   - Solution: Reconnect integration
   - Check: Verify `credentials.access_token` exists

5. **Missing Phone/Email**
   - Leads without phone or email are skipped
   - Logged in `skippedContactsCount`
   - Solution: Ensure lead forms collect phone or email

### Error Response Format

```json
{
  "message": "Error description",
  "error": "Detailed error message"
}
```

---

## Webhooks

### Setup Webhook (Optional)

1. **Configure Webhook URL in Facebook App**
   - Callback URL: `https://your-domain.com/api/integrations/facebook-lead-ads/webhook`
   - Verify Token: Set in `FACEBOOK_WEBHOOK_VERIFY_TOKEN` env var
   - Subscribe to: `leadgen` field

2. **Verification Process**
   - Facebook sends GET request with `hub.verify_token`
   - Backend verifies token matches
   - Returns `hub.challenge` if valid

3. **Lead Notifications**
   - Facebook sends POST request when new lead is created
   - Backend receives lead ID, form ID, page ID
   - Currently logs but doesn't process (see TODO in code)

### Implementing Webhook Processing

To process webhooks in real-time:

```typescript
// In webhook POST handler
if (change.field === "leadgen") {
  const leadId = change.value.leadgen_id;
  const formId = change.value.form_id;
  const pageId = change.value.page_id;
  
  // Fetch full lead details
  const leadResponse = await fetch(
    `${FACEBOOK_GRAPH_API_BASE}/${leadId}?fields=id,created_time,field_data&access_token=${pageAccessToken}`
  );
  const lead = await leadResponse.json();
  
  // Process lead (reuse sync logic)
  await processLead(lead, formId, pageId, userId, organizationId);
}
```

---

## Code Examples

### Complete Sync Function

```typescript
async function syncFacebookLeads(
  userId: string,
  organizationId: string,
  pageId?: string,
  formId?: string,
  startDate?: string,
  endDate?: string
) {
  // 1. Get integration
  const integration = await storage.getIntegrationByName(
    "facebook-lead-ads",
    userId,
    organizationId
  );
  
  // 2. Get access token
  const accessToken = integration.credentials.access_token;
  
  // 3. Fetch pages
  const pagesResponse = await fetch(
    `${FACEBOOK_GRAPH_API_BASE}/me/accounts?fields=id,name,access_token&access_token=${accessToken}`
  );
  const pages = (await pagesResponse.json()).data;
  
  // 4. Fetch forms
  const formsResponse = await fetch(
    `${FACEBOOK_GRAPH_API_BASE}/${pageId}/leadgen_forms?fields=id,name,status&access_token=${accessToken}`
  );
  const forms = (await formsResponse.json()).data;
  
  // 5. Fetch leads
  const leadsResponse = await fetch(
    `${FACEBOOK_GRAPH_API_BASE}/${formId}/leads?fields=id,created_time,field_data&access_token=${accessToken}`
  );
  const leads = (await leadsResponse.json()).data;
  
  // 6. Process each lead
  for (const lead of leads) {
    const fieldData = lead.field_data || [];
    let phoneNumber = null;
    let email = null;
    let name = null;
    
    // Extract fields
    for (const field of fieldData) {
      const fieldName = field.name?.toLowerCase() || '';
      const fieldValue = field.values?.[0] || '';
      
      if (fieldName.includes('phone')) phoneNumber = fieldValue;
      if (fieldName.includes('email')) email = fieldValue;
      if (fieldName.includes('name')) name = fieldValue;
    }
    
    // Create or update contact
    if (phoneNumber || email) {
      const existingContact = await findContactByPhoneOrEmail(phoneNumber, email);
      
      if (existingContact) {
        await storage.updateManagedContact(existingContact.id, userId, organizationId, {
          customFields: { ...existingContact.customFields, ...leadFields },
        });
      } else {
        await storage.createManagedContact({
          userId,
          organizationId,
          name: name || 'Facebook Lead',
          phoneNumber: phoneNumber || email,
          email,
          source: 'facebook',
          customFields: leadFields,
        });
      }
    }
  }
}
```

### Frontend Sync Call

```typescript
const syncLeads = async () => {
  try {
    const response = await fetch('/api/integrations/facebook-lead-ads/sync-leads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        pageId: selectedPageId,
        formId: selectedFormId,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
    });
    
    const data = await response.json();
    console.log(`Synced ${data.syncedContactsCount} contacts`);
  } catch (error) {
    console.error('Sync failed:', error);
  }
};
```

---

## Testing

### Manual Testing Steps

1. **OAuth Flow**
   - Click "Connect" on Facebook Lead Ads integration
   - Verify popup opens with Facebook login
   - Complete authorization
   - Verify popup closes and integration shows "Connected"

2. **Page Selection**
   - Open Facebook Leads Manager
   - Verify pages load in dropdown
   - Select a page
   - Verify forms load for that page

3. **Lead Sync**
   - Select a form
   - Optionally set date range
   - Click "Sync Leads"
   - Verify leads are fetched and contacts created
   - Check contacts page to verify new contacts

4. **Contact Updates**
   - Sync same leads again
   - Verify existing contacts are updated (not duplicated)
   - Check custom fields contain Facebook metadata

### Test Data

Create test lead forms in Facebook Ads Manager with:
- Phone number field
- Email field
- Name field
- Custom fields (e.g., Company, Message)

Submit test leads and verify they sync correctly.

---

## Troubleshooting

### Issue: "No pages found"
- **Cause**: User doesn't have admin access to any pages
- **Fix**: Grant admin access in Facebook Page settings

### Issue: "Token expired"
- **Cause**: Long-lived token expired (60 days)
- **Fix**: User must reconnect integration

### Issue: "No forms found"
- **Cause**: No lead forms created for the page
- **Fix**: Create lead forms in Facebook Ads Manager

### Issue: Leads not syncing
- **Check**: Verify form status is "ACTIVE"
- **Check**: Verify leads exist in Facebook Ads Manager
- **Check**: Check server logs for API errors

### Issue: Contacts not created
- **Check**: Verify leads have phone or email
- **Check**: Check `skippedContactsCount` in response
- **Check**: Verify database connection

---

## Security Considerations

1. **OAuth State**: Always validate state token to prevent CSRF
2. **Token Storage**: Store tokens securely, never log them
3. **HTTPS**: Always use HTTPS in production
4. **Token Expiration**: Check token expiration before API calls
5. **Error Messages**: Don't expose sensitive info in error messages
6. **Webhook Verification**: Always verify webhook tokens

---

## Future Enhancements

1. **Automatic Sync**: Schedule periodic syncs
2. **Webhook Processing**: Process real-time lead notifications
3. **Field Mapping UI**: Allow users to map form fields to contact fields
4. **Duplicate Detection**: More sophisticated matching logic
5. **Bulk Operations**: Batch contact creation for performance
6. **Analytics**: Track sync statistics and lead conversion

---

## Support

For issues or questions:
1. Check server logs for detailed error messages
2. Verify Facebook App permissions and configuration
3. Test with Facebook Graph API Explorer
4. Review Facebook Lead Ads API documentation

---

## References

- [Facebook Graph API Documentation](https://developers.facebook.com/docs/graph-api)
- [Facebook Lead Ads API](https://developers.facebook.com/docs/marketing-api/leadgen)
- [Facebook OAuth Documentation](https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow)

---

**Last Updated**: 2024-01-15
**Version**: 1.0.0

