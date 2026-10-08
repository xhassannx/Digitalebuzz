# Facebook App Review - Facebook Login Confirmation Guide

Guide for answering the "Facebook Login Usage" question in Facebook App Review.

---

## 🎯 Question: Facebook Login Usage

**Question:**
> "In your response, please include confirmation of any use of Meta APIs or integrations pertaining to Facebook Login. If you are no longer using Facebook Login please tell us why and share general instructions for testing."

**Meta APIs Refer To:**
- Endpoints such as email, public_profile
- User permissions (user_friends, user_gender, user_birthday, etc.)
- Advanced access permissions

---

## ✅ Your Situation: Using OAuth BUT NOT Facebook Login

### Important Distinction:

**You ARE using:**
- ✅ Facebook OAuth for **business integrations** (Lead Ads, WhatsApp Business)
- ✅ Facebook Login **product** for OAuth flows

**You are NOT using:**
- ❌ Facebook Login for **user authentication** (sign-in/sign-up)
- ❌ User permissions (email, public_profile, user_friends, etc.)
- ❌ Facebook Login API for user login

---

## 📝 Recommended Answer

### Answer Template:

```
We are using Facebook OAuth through the Facebook Login product, but NOT for user authentication or login purposes.

Our Usage:
- We use Facebook OAuth exclusively for business integrations:
  1. Facebook Lead Ads integration - Businesses connect their Facebook Pages to sync leads
  2. WhatsApp Business integration - Businesses connect their WhatsApp Business Accounts for messaging

- We do NOT use Facebook Login for user authentication:
  - Our platform uses its own authentication system (email/password)
  - Users do not sign in with Facebook
  - We do not request user permissions (email, public_profile, user_friends, etc.)
  - We do not use Facebook Login API for user sign-in/sign-up

OAuth Flow:
- Businesses connect their Facebook/WhatsApp accounts via OAuth popup
- We request business permissions (leads_retrieval, whatsapp_business_messaging, etc.)
- We do NOT request user profile permissions
- OAuth is used only for business account connections, not user authentication

Testing Instructions:
1. Users sign up/login with email and password (not Facebook)
2. After login, users can go to Integrations page
3. Click "Connect" on Facebook Lead Ads or WhatsApp Business
4. OAuth popup opens for business account connection
5. User authorizes business permissions (not user profile permissions)
6. Integration connects successfully
7. User can then sync leads or manage WhatsApp Business accounts

We use Facebook Login product infrastructure for OAuth, but the OAuth flow is exclusively for business integrations, not for user authentication.
```

---

## 🎯 Key Points to Emphasize

### What You're Using:

1. **Facebook OAuth** ✅
   - For business integrations only
   - For connecting Facebook Pages (Lead Ads)
   - For connecting WhatsApp Business Accounts

2. **Business Permissions** ✅
   - `leads_retrieval`
   - `whatsapp_business_messaging`
   - `pages_manage_ads`
   - `business_management`
   - etc.

### What You're NOT Using:

1. **Facebook Login for User Auth** ❌
   - Users don't sign in with Facebook
   - No "Sign in with Facebook" button
   - No user profile permissions

2. **User Permissions** ❌
   - `email` (for user profile)
   - `public_profile` (for user profile)
   - `user_friends`
   - `user_gender`
   - `user_birthday`
   - etc.

---

## 📋 Complete Answer Template

### Copy-Paste Ready Answer:

```
CONFIRMATION OF FACEBOOK LOGIN USAGE:

We are using Facebook OAuth through the Facebook Login product, but NOT for user authentication purposes.

USE CASE:
Our platform uses Facebook OAuth exclusively for business integrations:
1. Facebook Lead Ads Integration: Businesses connect their Facebook Pages via OAuth to sync leads from Lead Ads campaigns
2. WhatsApp Business Integration: Businesses connect their WhatsApp Business Accounts via OAuth to manage messaging

WHAT WE USE:
- Facebook OAuth flow (via Facebook Login product infrastructure)
- Business permissions: leads_retrieval, pages_manage_ads, whatsapp_business_messaging, whatsapp_business_management, business_management, pages_read_engagement
- OAuth redirect URI: [Your callback URL]

WHAT WE DO NOT USE:
- Facebook Login for user authentication (users sign in with email/password, not Facebook)
- User profile permissions (email, public_profile, user_friends, user_gender, user_birthday, etc.)
- Facebook Login API for user sign-in/sign-up
- Any user profile data from Facebook

TESTING INSTRUCTIONS:
1. User Registration/Login:
   - Users create accounts with email and password (not Facebook)
   - Users log in with email/password credentials
   - No Facebook Login button is present on login/signup pages

2. Business Integration Connection:
   - After login, navigate to Integrations page
   - Click "Connect" on "Facebook Lead Ads" or "WhatsApp Business"
   - OAuth popup opens requesting business permissions
   - User authorizes business account access
   - Integration connects successfully

3. Integration Usage:
   - Facebook Lead Ads: User can sync leads from their Facebook Pages
   - WhatsApp Business: User can manage WhatsApp Business phone numbers and messaging

The OAuth flow is used exclusively for connecting business accounts (Facebook Pages, WhatsApp Business Accounts), not for user authentication or accessing user profile data.
```

---

## 🔍 What Meta is Looking For

### They Want to Know:

1. ✅ **Are you using Facebook Login for user auth?**
   - **Your Answer:** No - we use email/password authentication

2. ✅ **Are you requesting user permissions?**
   - **Your Answer:** No - we only request business permissions

3. ✅ **What are you using Facebook OAuth for?**
   - **Your Answer:** Business integrations only (Lead Ads, WhatsApp Business)

4. ✅ **How can they test it?**
   - **Your Answer:** Provide testing instructions (see template above)

---

## 📝 Testing Instructions (Detailed)

### For App Reviewers:

**Step 1: User Authentication (No Facebook Login)**
1. Go to login page: `[Your URL]/login`
2. Notice there is NO "Sign in with Facebook" button
3. Users sign in with email and password
4. This confirms we don't use Facebook Login for user auth

**Step 2: Business Integration (Facebook OAuth)**
1. After login, go to Integrations page: `[Your URL]/integrations`
2. Find "Facebook Lead Ads" integration
3. Click "Connect" button
4. OAuth popup opens
5. Notice it requests BUSINESS permissions (leads_retrieval, pages_manage_ads)
6. Notice it does NOT request user profile permissions (email, public_profile)
7. Authorize the connection
8. Integration connects successfully

**Step 3: Verify No User Profile Access**
1. Check that we don't access user's Facebook profile
2. Check that we don't request user permissions
3. Check that OAuth is only for business account connections

---

## ✅ Key Points Summary

### What to Confirm:

1. ✅ **Using Facebook OAuth** - Yes, for business integrations
2. ✅ **Using Facebook Login Product** - Yes, for OAuth infrastructure
3. ❌ **Using Facebook Login for User Auth** - No
4. ❌ **Requesting User Permissions** - No
5. ✅ **Requesting Business Permissions** - Yes

---

## 🎯 Quick Answer (Short Version)

```
We use Facebook OAuth through the Facebook Login product, but NOT for user authentication.

Usage:
- Facebook OAuth is used exclusively for business integrations (Facebook Lead Ads and WhatsApp Business)
- Users authenticate with email/password, not Facebook
- We request business permissions (leads_retrieval, whatsapp_business_messaging, etc.), not user profile permissions

Testing:
1. Users sign up/login with email/password (no Facebook Login button)
2. After login, users can connect Facebook/WhatsApp business accounts via OAuth
3. OAuth requests business permissions only, not user profile data
```

---

## 📋 Checklist

Before submitting:

- [ ] Confirmed we're NOT using Facebook Login for user auth
- [ ] Confirmed we ARE using OAuth for business integrations
- [ ] Listed which business permissions we request
- [ ] Confirmed we don't request user permissions
- [ ] Provided clear testing instructions
- [ ] Explained the distinction clearly

---

**Last Updated**: 2024
**Status**: Ready for App Review submission

