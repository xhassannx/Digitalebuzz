# Facebook App Review - Required Permissions Guide

This document outlines all permissions required for Facebook App Review for both **Facebook Lead Ads** and **WhatsApp Business** integrations.

---

## 📋 Facebook Lead Ads Integration

### Required Permissions for App Review

Your app currently requests these permissions:

#### 1. **`leads_retrieval`** ⭐ **CRITICAL - REQUIRES REVIEW**
- **Purpose**: Retrieve lead data from Facebook Lead Ads forms
- **Review Required**: ✅ **YES** - Must be approved for production
- **Use Case**: 
  - Fetch leads submitted through Facebook Lead Ads campaigns
  - Sync lead data to your contact management system
  - Process and store lead information for follow-up

**App Review Requirements:**
- ✅ Provide detailed use case explanation
- ✅ Submit demo video showing lead retrieval workflow
- ✅ Show how leads are stored and used
- ✅ Privacy policy URL (required)
- ✅ Terms of Service URL (recommended)

#### 2. **`pages_manage_ads`** ⭐ **REQUIRES REVIEW**
- **Purpose**: Manage ads and lead forms for Facebook Pages
- **Review Required**: ✅ **YES** - Required for managing lead forms
- **Use Case**:
  - Access lead forms associated with ad campaigns
  - Retrieve form metadata and structure
  - Manage lead form configurations

**App Review Requirements:**
- ✅ Explain why you need to manage ads
- ✅ Show how ads/forms are accessed
- ✅ Demonstrate read-only access if possible

#### 3. **`pages_read_engagement`** ✅ **STANDARD - NO REVIEW**
- **Purpose**: Read page engagement data
- **Review Required**: ❌ **NO** - Standard permission
- **Use Case**: Read basic page information and engagement metrics

#### 4. **`pages_manage_metadata`** ✅ **STANDARD - NO REVIEW**
- **Purpose**: Manage page metadata
- **Review Required**: ❌ **NO** - Standard permission
- **Use Case**: Update page settings and metadata

#### 5. **`pages_read_user_content`** ✅ **STANDARD - NO REVIEW**
- **Purpose**: Read user content on pages
- **Review Required**: ❌ **NO** - Standard permission
- **Use Case**: Read posts and content on pages

---

## 💬 WhatsApp Business Integration

### Required Permissions for App Review

Your app currently requests these permissions:

#### 1. **`whatsapp_business_messaging`** ⭐ **CRITICAL - REQUIRES REVIEW**
- **Purpose**: Send and receive messages via WhatsApp Business API
- **Review Required**: ✅ **YES** - Must be approved for production
- **Use Case**:
  - Send messages to customers via WhatsApp
  - Receive incoming messages
  - Manage conversations
  - Send template messages

**App Review Requirements:**
- ✅ Business verification (Facebook Business Manager must be verified)
- ✅ Provide use case explanation
- ✅ Demo video showing messaging functionality
- ✅ Show compliance with WhatsApp Business Policy
- ✅ Privacy policy URL (required)
- ✅ Terms of Service URL (required)

**Additional Requirements:**
- ✅ **Business Verification**: Your Facebook Business Manager account must be verified
- ✅ **WhatsApp Business Account**: Must have an approved WhatsApp Business Account
- ✅ **Phone Number Verification**: Phone number must be verified in Meta Business Manager

#### 2. **`whatsapp_business_management`** ⭐ **REQUIRES REVIEW**
- **Purpose**: Manage WhatsApp Business Account settings
- **Review Required**: ✅ **YES** - Required for managing WABA
- **Use Case**:
  - Access WhatsApp Business Accounts
  - Manage phone numbers
  - Access message templates
  - Configure business settings

**App Review Requirements:**
- ✅ Explain management use cases
- ✅ Show how business account data is accessed
- ✅ Demonstrate read-only access where possible

#### 3. **`business_management`** ✅ **STANDARD - NO REVIEW**
- **Purpose**: Access business accounts
- **Review Required**: ❌ **NO** - Standard permission
- **Use Case**: Access Meta Business Manager accounts

#### 4. **`pages_read_engagement`** ✅ **STANDARD - NO REVIEW**
- **Purpose**: Read page engagement data
- **Review Required**: ❌ **NO** - Standard permission
- **Use Case**: Read page information for WhatsApp Business

---

## 📝 App Review Submission Checklist

### Before Submitting for Review

#### Required Documents:
- [ ] **Privacy Policy URL** - Must be publicly accessible
- [ ] **Terms of Service URL** - Recommended, required for WhatsApp
- [ ] **App Icon** - 1024x1024px PNG
- [ ] **App Screenshots** - Showing key features
- [ ] **Demo Video** - Screen recording showing:
  - OAuth connection flow
  - Lead retrieval process (for Lead Ads)
  - Message sending/receiving (for WhatsApp)
  - Data storage and usage

#### Use Case Documentation:
- [ ] **Clear description** of what your app does
- [ ] **Why each permission is needed**
- [ ] **How data is used** and stored
- [ ] **User benefits** and value proposition

#### Testing:
- [ ] **Test users added** to app roles
- [ ] **All features tested** and working
- [ ] **Error handling** implemented
- [ ] **Data security** measures in place

---

## 🎥 Demo Video Requirements

### For Facebook Lead Ads:
1. Show OAuth connection flow
2. Display list of pages/forms
3. Demonstrate lead retrieval
4. Show how leads are synced to contacts
5. Show data storage and management

### For WhatsApp Business:
1. Show OAuth connection flow
2. Display phone numbers available
3. Demonstrate sending a message
4. Show template message usage
5. Show message history/conversations

**Video Tips:**
- Keep it under 5 minutes
- Show real data (use test accounts)
- Highlight key features
- Show error handling
- Demonstrate user value

---

## 📋 Permission Summary Table

| Permission | Lead Ads | WhatsApp | Review Required | Notes |
|------------|----------|----------|-----------------|-------|
| `leads_retrieval` | ✅ | ❌ | ✅ YES | Critical for Lead Ads |
| `pages_manage_ads` | ✅ | ❌ | ✅ YES | Required for lead forms |
| `whatsapp_business_messaging` | ❌ | ✅ | ✅ YES | Critical for WhatsApp |
| `whatsapp_business_management` | ❌ | ✅ | ✅ YES | Required for WABA |
| `pages_read_engagement` | ✅ | ✅ | ❌ NO | Standard permission |
| `pages_manage_metadata` | ✅ | ❌ | ❌ NO | Standard permission |
| `pages_read_user_content` | ✅ | ❌ | ❌ NO | Standard permission |
| `business_management` | ❌ | ✅ | ❌ NO | Standard permission |

---

## 🚀 Step-by-Step App Review Process

### Step 1: Prepare Your App
1. Complete all development and testing
2. Ensure all features work correctly
3. Add privacy policy and terms of service
4. Prepare demo video and screenshots

### Step 2: Request Permissions
1. Go to **App Dashboard** → **App Review** → **Permissions and Features**
2. Find each permission that requires review
3. Click **"Request"** or **"Start a Submission"**
4. Fill out the permission request form

### Step 3: Submit for Review
1. Complete all required fields:
   - Use case description
   - Demo video URL
   - Privacy policy URL
   - Test user instructions (if needed)
2. Submit the request
3. Wait for review (typically 3-7 business days)

### Step 4: Respond to Feedback
- Facebook may request additional information
- Respond promptly to any questions
- Provide clarifications if needed

### Step 5: Approval
- Once approved, permissions are available
- Switch app to **Production Mode**
- Permissions work for all users

---

## ⚠️ Common Rejection Reasons

### Lead Ads:
- ❌ Insufficient use case explanation
- ❌ Missing demo video
- ❌ Privacy policy not accessible
- ❌ Not showing how leads are used
- ❌ Violating Facebook Lead Ads policy

### WhatsApp Business:
- ❌ Business Manager not verified
- ❌ WhatsApp Business Account not approved
- ❌ Missing compliance documentation
- ❌ Not following WhatsApp Business Policy
- ❌ Insufficient use case explanation

---

## 📚 Additional Resources

- [Facebook App Review Guide](https://developers.facebook.com/docs/app-review)
- [Facebook Lead Ads API Docs](https://developers.facebook.com/docs/marketing-api/leadgen)
- [WhatsApp Business API Docs](https://developers.facebook.com/docs/whatsapp)
- [WhatsApp Business Policy](https://www.whatsapp.com/legal/business-policy)
- [Facebook Business Verification](https://www.facebook.com/business/help/2058515294227817)

---

## 💡 Tips for Success

1. **Be Specific**: Clearly explain why each permission is needed
2. **Show Value**: Demonstrate user benefits in your demo
3. **Follow Policies**: Ensure compliance with all Facebook/WhatsApp policies
4. **Test Thoroughly**: Make sure everything works before submitting
5. **Be Responsive**: Answer reviewer questions quickly
6. **Document Everything**: Keep records of your use cases and workflows

---

## 🔄 Current Implementation

Your app currently requests:

**Facebook Lead Ads:**
```typescript
const FACEBOOK_SCOPES = [
  "leads_retrieval",           // ⭐ Requires review
  "pages_read_engagement",     // ✅ Standard
  "pages_manage_metadata",     // ✅ Standard
  "pages_read_user_content",   // ✅ Standard
  "pages_manage_ads",          // ⭐ Requires review
];
```

**WhatsApp Business:**
```typescript
const WHATSAPP_BUSINESS_SCOPES = [
  "whatsapp_business_messaging",    // ⭐ Requires review
  "whatsapp_business_management",   // ⭐ Requires review
  "business_management",             // ✅ Standard
  "pages_read_engagement",          // ✅ Standard
];
```

---

**Last Updated**: 2024
**Status**: Ready for App Review submission

