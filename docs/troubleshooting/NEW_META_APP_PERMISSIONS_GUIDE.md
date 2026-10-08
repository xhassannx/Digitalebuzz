# New Meta App - Complete Permissions Guide

Complete guide for requesting permissions when creating a **NEW Meta App** for Facebook Lead Ads and WhatsApp Business integrations.

---

## 🎯 Required Permissions for New Meta App

### For Facebook Lead Ads Integration

#### ⭐ **Permissions Requiring App Review:**

1. **`leads_retrieval`** ⭐ **CRITICAL**
   - **Purpose**: Retrieve lead data from Facebook Lead Ads forms
   - **Review Required**: ✅ YES
   - **Use Case**: Fetch and sync leads from Lead Ads campaigns
   - **Why Needed**: Core functionality for Lead Ads integration

2. **`pages_manage_ads`** ⭐ **REQUIRED**
   - **Purpose**: Access and manage lead forms associated with ad campaigns
   - **Review Required**: ✅ YES
   - **Use Case**: Retrieve lead forms, access form metadata
   - **Why Needed**: Required to access lead forms from pages

#### ✅ **Standard Permissions (No Review Needed):**

3. **`pages_read_engagement`** ✅
   - **Purpose**: Read page engagement data and basic page info
   - **Review Required**: ❌ NO
   - **Use Case**: Access page information, read page data
   - **Why Needed**: Standard permission for page access

4. **`pages_manage_metadata`** ✅
   - **Purpose**: Manage page metadata and settings
   - **Review Required**: ❌ NO
   - **Use Case**: Update page settings if needed
   - **Why Needed**: Standard permission

5. **`pages_read_user_content`** ✅
   - **Purpose**: Read user content on pages
   - **Review Required**: ❌ NO
   - **Use Case**: Read posts and content
   - **Why Needed**: Standard permission

---

### For WhatsApp Business Integration

#### ⭐ **Permissions Requiring App Review:**

1. **`whatsapp_business_messaging`** ⭐ **CRITICAL**
   - **Purpose**: Send and receive messages via WhatsApp Business API
   - **Review Required**: ✅ YES
   - **Use Case**: Send messages, receive incoming messages, manage conversations
   - **Why Needed**: Core functionality for WhatsApp messaging
   - **Additional Requirements**: 
     - Business verification required
     - WhatsApp Business Account must be approved

2. **`whatsapp_business_management`** ⭐ **REQUIRED**
   - **Purpose**: Manage WhatsApp Business Account settings
   - **Review Required**: ✅ YES
   - **Use Case**: Access WABA, manage phone numbers, access templates
   - **Why Needed**: Required to manage WhatsApp Business Accounts

#### ✅ **Standard Permissions (No Review Needed):**

3. **`business_management`** ✅
   - **Purpose**: Access Meta Business Manager accounts
   - **Review Required**: ❌ NO
   - **Use Case**: Access business accounts, list WABAs
   - **Why Needed**: Standard permission for business account access

4. **`pages_read_engagement`** ✅
   - **Purpose**: Read page engagement data
   - **Review Required**: ❌ NO
   - **Use Case**: Access page information for WhatsApp Business
   - **Why Needed**: Standard permission

---

## 📋 Complete Permission List for New Meta App

### Recommended Permissions to Request:

```typescript
// Facebook Lead Ads Permissions
const FACEBOOK_LEAD_ADS_PERMISSIONS = [
  "leads_retrieval",           // ⭐ Requires review
  "pages_manage_ads",          // ⭐ Requires review
  "pages_read_engagement",     // ✅ Standard
  "pages_manage_metadata",     // ✅ Standard
  "pages_read_user_content",   // ✅ Standard
];

// WhatsApp Business Permissions
const WHATSAPP_BUSINESS_PERMISSIONS = [
  "whatsapp_business_messaging",    // ⭐ Requires review
  "whatsapp_business_management",   // ⭐ Requires review
  "business_management",            // ✅ Standard
  "pages_read_engagement",          // ✅ Standard
];

// Combined List (for single app supporting both)
const ALL_META_PERMISSIONS = [
  // Lead Ads
  "leads_retrieval",
  "pages_manage_ads",
  "pages_read_engagement",
  "pages_manage_metadata",
  "pages_read_user_content",
  
  // WhatsApp Business
  "whatsapp_business_messaging",
  "whatsapp_business_management",
  "business_management",
];
```

---

## ❌ Permissions You DON'T Need

### Skip These Permissions:

1. **`whatsapp_business_manage_events`** ❌
   - **Why Skip**: Using webhooks instead of API event subscriptions
   - **Alternative**: Webhook endpoints work without this permission

2. **`Meta oEmbed Read`** ❌
   - **Why Skip**: Not embedding Facebook/Instagram content
   - **Not Used**: No oEmbed functionality needed

3. **`instagram_business_manage_messages`** ❌
   - **Why Skip**: No Instagram integration
   - **Not Used**: Instagram features not implemented

4. **`instagram_manage_events`** ❌
   - **Why Skip**: No Instagram integration
   - **Not Used**: Instagram events not needed

5. **`email`** ❌
   - **Why Skip**: Get email from lead forms, not user profile
   - **Alternative**: Lead forms contain email in `field_data`

6. **`public_profile`** ⚠️
   - **Status**: Usually auto-included by Facebook
   - **Action**: Don't explicitly request (Facebook includes automatically)

7. **`Page Public Content Access`** ❌
   - **Why Skip**: **DEPRECATED** - Don't use
   - **Replacement**: Use `pages_read_engagement` instead

---

## 🚀 Step-by-Step: Requesting Permissions in New Meta App

### Step 1: Create Meta App

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Click **"My Apps"** → **"Create App"**
3. Select **"Business"** as app type
4. Fill in app details:
   - App Name
   - App Contact Email
   - Business Account (if you have one)

### Step 2: Add Products

1. **Facebook Login** (for OAuth)
   - Go to **Products** → **Facebook Login** → **Set Up**
   - Configure OAuth redirect URIs

2. **WhatsApp** (for WhatsApp Business)
   - Go to **Products** → **WhatsApp** → **Set Up**
   - This enables WhatsApp Business API access

### Step 3: Request Permissions

1. Go to **App Review** → **Permissions and Features**
2. Find each permission from the list above
3. Click **"Request"** or **"Start a Submission"** for permissions requiring review

### Step 4: Permissions Requiring Review

Request these **ONE AT A TIME** or as a **group**:

#### Group 1: Facebook Lead Ads
- `leads_retrieval`
- `pages_manage_ads`

#### Group 2: WhatsApp Business
- `whatsapp_business_messaging`
- `whatsapp_business_management`

#### Standard Permissions (No Review):
- `pages_read_engagement`
- `pages_manage_metadata`
- `pages_read_user_content`
- `business_management`

These are usually **automatically approved** or available immediately.

---

## 📝 App Review Submission Requirements

### For Each Permission Requiring Review:

#### 1. **Use Case Description**
Explain:
- What your app does
- Why you need this permission
- How users benefit
- How data is used

#### 2. **Demo Video** (Required)
Create a 2-5 minute screen recording showing:
- OAuth connection flow
- Feature usage (lead retrieval or messaging)
- Data handling
- User interface

#### 3. **Privacy Policy URL** (Required)
- Must be publicly accessible
- Must explain data collection and usage
- Must comply with Meta's policies

#### 4. **Terms of Service URL** (Recommended)
- Required for WhatsApp Business
- Recommended for Lead Ads

#### 5. **Test User Instructions** (If Needed)
- Provide test accounts if reviewers need to test
- Include login credentials
- Explain test workflow

---

## 🎯 Recommended Request Strategy

### Option 1: Request All at Once (Recommended)
**Submit all permissions requiring review together:**
- `leads_retrieval`
- `pages_manage_ads`
- `whatsapp_business_messaging`
- `whatsapp_business_management`

**Pros:**
- Single review process
- Faster overall approval
- Coordinated review

**Cons:**
- More complex submission
- All must be approved together

### Option 2: Request Separately
**Submit Lead Ads and WhatsApp separately:**

**Phase 1: Lead Ads**
- `leads_retrieval`
- `pages_manage_ads`

**Phase 2: WhatsApp Business**
- `whatsapp_business_messaging`
- `whatsapp_business_management`

**Pros:**
- Can launch Lead Ads first
- Easier to manage
- Focused submissions

**Cons:**
- Two separate reviews
- Takes longer overall

---

## ✅ Pre-Submission Checklist

Before submitting for App Review:

### App Configuration:
- [ ] App created and configured
- [ ] App icon uploaded (1024x1024px)
- [ ] App screenshots added
- [ ] Privacy Policy URL added
- [ ] Terms of Service URL added (for WhatsApp)
- [ ] OAuth redirect URIs configured
- [ ] App domains added

### Documentation:
- [ ] Use case descriptions written
- [ ] Demo video created (2-5 minutes)
- [ ] Test user accounts prepared (if needed)
- [ ] All features tested and working

### Business Requirements (WhatsApp):
- [ ] Business Manager account verified
- [ ] WhatsApp Business Account approved
- [ ] Phone number verified
- [ ] Business verification documents submitted

### Testing:
- [ ] OAuth flow tested
- [ ] Lead retrieval tested (for Lead Ads)
- [ ] Messaging tested (for WhatsApp)
- [ ] All error cases handled
- [ ] Data security measures in place

---

## 📊 Permission Priority

### High Priority (Request First):
1. ⭐ `leads_retrieval` - Critical for Lead Ads
2. ⭐ `whatsapp_business_messaging` - Critical for WhatsApp
3. ⭐ `pages_manage_ads` - Required for lead forms
4. ⭐ `whatsapp_business_management` - Required for WABA

### Standard (Available Immediately):
- ✅ `pages_read_engagement`
- ✅ `pages_manage_metadata`
- ✅ `pages_read_user_content`
- ✅ `business_management`

---

## 🔄 Development vs Production

### Development Mode:
- ✅ All permissions work immediately
- ✅ No review needed
- ✅ Limited to test users/roles
- ✅ Perfect for testing

### Production Mode:
- ⚠️ Requires App Review for advanced permissions
- ⚠️ Must submit use cases and demo videos
- ✅ Available to all users after approval
- ✅ Full functionality

**Recommendation**: Start in Development Mode, test everything, then submit for review.

---

## 📚 Additional Resources

- [Meta App Review Guide](https://developers.facebook.com/docs/app-review)
- [Facebook Lead Ads API](https://developers.facebook.com/docs/marketing-api/leadgen)
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)
- [Business Verification](https://www.facebook.com/business/help/2058515294227817)
- [Permission Reference](https://developers.facebook.com/docs/permissions/reference)

---

## 💡 Pro Tips

1. **Be Specific**: Clearly explain why each permission is needed
2. **Show Value**: Demonstrate user benefits in demo video
3. **Follow Policies**: Ensure compliance with Meta policies
4. **Test First**: Test everything in Development Mode before review
5. **Be Responsive**: Answer reviewer questions quickly
6. **Document Everything**: Keep records of use cases and workflows

---

## 🎯 Final Permission List for New Meta App

### Request These:
```typescript
[
  // Lead Ads (Requires Review)
  "leads_retrieval",              // ⭐ Review required
  "pages_manage_ads",             // ⭐ Review required
  
  // Lead Ads (Standard)
  "pages_read_engagement",        // ✅ Standard
  "pages_manage_metadata",        // ✅ Standard
  "pages_read_user_content",      // ✅ Standard
  
  // WhatsApp Business (Requires Review)
  "whatsapp_business_messaging",  // ⭐ Review required
  "whatsapp_business_management", // ⭐ Review required
  
  // WhatsApp Business (Standard)
  "business_management",          // ✅ Standard
]
```

### Don't Request These:
- ❌ `whatsapp_business_manage_events` (using webhooks)
- ❌ `Meta oEmbed Read` (not used)
- ❌ `instagram_business_manage_messages` (no Instagram)
- ❌ `instagram_manage_events` (no Instagram)
- ❌ `email` (get from leads)
- ❌ `Page Public Content Access` (deprecated)
- ⚠️ `public_profile` (auto-included)

---

**Last Updated**: 2024
**Status**: Ready for new Meta App creation

