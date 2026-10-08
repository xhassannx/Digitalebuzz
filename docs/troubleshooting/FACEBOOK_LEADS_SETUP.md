# Meta Facebook Lead Ads Integration Setup Guide

This guide will walk you through setting up Meta (Facebook) Lead Ads integration for your application.

## 📋 Prerequisites

Before you begin, ensure you have:
- A Meta Business Account
- A Facebook Page (required for Lead Ads)
- Admin access to Meta Business Manager
- Your application deployed with a publicly accessible URL (for OAuth callbacks)

## 🔧 Step 1: Create a Facebook App

1. **Go to Meta for Developers**
   - Visit [https://developers.facebook.com/](https://developers.facebook.com/)
   - Log in with your Facebook account

2. **Create a New App**
   - Click **"My Apps"** → **"Create App"**
   - Select **"Business"** as the app type
   - Fill in:
     - **App Name**: Your application name (e.g., "Helicoptic WhatsApp")
     - **App Contact Email**: Your email address
   - Click **"Create App"**

3. **Add Products to Your App**
   - In your app dashboard, find **"Add Products"** section
   - Add the following products:
     - ✅ **Facebook Login** (required for OAuth)
     - ✅ **Marketing API** (required for Lead Ads)

## 🔑 Step 2: Configure App Settings

1. **Basic Settings**
   - Go to **Settings** → **Basic**
   - Note down your **App ID** and **App Secret** (you'll need these)
   - Add your **App Domains** (e.g., `yourdomain.com`)
   - Add **Privacy Policy URL** (required)
   - Add **Terms of Service URL** (optional but recommended)

2. **Facebook Login Settings** ⚠️ **CRITICAL STEP**
   - Go to **Facebook Login** → **Settings**
   
   **Enable OAuth Login Types:**
   - ✅ **Client OAuth Login** - Toggle ON
   - ✅ **Web OAuth Login** - Toggle ON
   - Click **"Save Changes"**
   
   **Add Valid OAuth Redirect URIs:**
   - Scroll to **"Valid OAuth Redirect URIs"** section
   - Click **"Add URI"**
   - Add your redirect URI(s) based on your `BASE_URL`:
     
     **For Production:**
     ```
     https://yourdomain.com/api/integrations/facebook-lead-ads/oauth/callback
     ```
     
     **For Local Development:**
     ```
     http://localhost:5000/api/integrations/facebook-lead-ads/oauth/callback
     ```
     
     **If using both (recommended):**
     ```
     https://yourdomain.com/api/integrations/facebook-lead-ads/oauth/callback
     http://localhost:5000/api/integrations/facebook-lead-ads/oauth/callback
     ```
   
   **Important Notes:**
   - Replace `yourdomain.com` with your actual domain from `BASE_URL` in `.env`
   - The URI must match EXACTLY (case-sensitive, no trailing slash)
   - Format: `${BASE_URL}/api/integrations/facebook-lead-ads/oauth/callback`
   - Click **"Save Changes"** after adding
   
   **Add App Domains (Optional but Recommended):**
   - Go to **Settings** → **Basic**
   - Add your domain to **"App Domains"** (without http/https): `yourdomain.com`
   - Click **"Save Changes"**

3. **App Review & Permissions**
   - Go to **App Review** → **Permissions and Features**
   - The following permissions are automatically available in **Development Mode**:
     - ✅ `leads_retrieval` - **Required** for accessing Lead Ads data
     - ✅ `pages_read_engagement` - Read page engagement data
     - ✅ `pages_manage_metadata` - Manage page metadata
     - ✅ `pages_read_user_content` - Read user content on pages
     - ✅ `pages_manage_ads` - **Required** for managing lead forms and Lead Ads

   **Important Notes:**
   - ✅ **Development Mode**: All permissions work immediately - no review needed!
   - ✅ **Perfect for Testing**: You can test everything right away
   - ⚠️ **Production Mode**: `leads_retrieval` requires App Review before going live
   - 📝 **To Go Live**: Submit your app for review with a use case explanation and demo video

## 🔐 Step 3: Configure Environment Variables

Add the following environment variables to your `.env` file:

```env
# Facebook Lead Ads Configuration
FACEBOOK_APP_ID=your_app_id_here
FACEBOOK_APP_SECRET=your_app_secret_here
BASE_URL=https://yourdomain.com  # or http://localhost:5000 for local development
FACEBOOK_WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token  # Optional: for webhook verification
```

**Where to find these values:**
- **App ID**: Settings → Basic → App ID
- **App Secret**: Settings → Basic → App Secret (click "Show" to reveal)
- **BASE_URL**: Your application's public URL

## 📱 Step 4: Set Up Facebook Page & Lead Ads

1. **Create or Select a Facebook Page**
   - You need a Facebook Page to create Lead Ads
   - Go to [Facebook Pages](https://www.facebook.com/pages/create)
   - Create a new page or use an existing one

2. **Create a Lead Ad Form**
   - Go to [Facebook Ads Manager](https://www.facebook.com/adsmanager/)
   - Create a new campaign → Select **"Leads"** objective
   - Set up your ad and create a Lead Form
   - Configure the form fields you want to collect

3. **Get Page Access Token**
   - The OAuth flow will handle this automatically
   - Ensure the user connecting has admin access to the Page

## 🔗 Step 5: Connect Integration in Your App

1. **Start Your Application**
   ```bash
   npm run dev
   ```

2. **Navigate to Integrations Page**
   - Go to `/integrations` in your application
   - Find **"Facebook Lead Ads"** integration
   - Click **"Connect"**

3. **Authorize Access**
   - You'll be redirected to Facebook
   - Log in and grant permissions
   - Authorize access to your Pages
   - You'll be redirected back to your app

4. **Verify Connection**
   - The integration should show as **"Connected"**
   - You should see your Facebook user info

## 📊 Step 6: Retrieve Leads (API Usage)

After connecting, you can retrieve leads using the Facebook Graph API. Here's how the integration works:

### Current Implementation

The integration stores:
- **Access Token**: Long-lived token (60 days)
- **User Info**: Facebook user ID and name
- **Expiration**: Token expiration timestamp

### Retrieving Leads via Graph API

To retrieve leads, you'll need to:

1. **Get Page Access Token**
   ```javascript
   // Get pages the user manages
   GET https://graph.facebook.com/v18.0/me/accounts?access_token={access_token}
   ```

2. **Get Lead Forms**
   ```javascript
   // Get lead forms for a page
   GET https://graph.facebook.com/v18.0/{page_id}/leadgen_forms?access_token={page_access_token}
   ```

3. **Get Leads**
   ```javascript
   // Get leads from a form
   GET https://graph.facebook.com/v18.0/{leadgen_form_id}/leads?access_token={page_access_token}
   ```

### Available API Endpoints

The integration includes the following endpoints (already implemented):

1. **Sync Leads**
   ```bash
   POST /api/integrations/facebook-lead-ads/sync-leads
   ```
   Request body:
   ```json
   {
     "integrationId": "optional",
     "pageId": "optional - specific page ID",
     "formId": "optional - specific form ID",
     "startDate": "2024-01-01",
     "endDate": "2024-12-31"
   }
   ```
   Returns all leads from all pages/forms (or filtered by pageId/formId).

2. **Get User's Pages**
   ```bash
   GET /api/integrations/facebook-lead-ads/pages
   ```
   Returns list of Facebook pages the user manages.

3. **Get Lead Forms for a Page**
   ```bash
   GET /api/integrations/facebook-lead-ads/forms/:pageId
   ```
   Returns all lead forms for a specific page.

4. **Webhook Endpoint** (for real-time lead notifications)
   ```bash
   GET/POST /api/integrations/facebook-lead-ads/webhook
   ```
   Handles Facebook webhook verification and lead events.

## 🔔 Step 7: Set Up Webhooks (Optional)

For real-time lead notifications, set up webhooks:

1. **Configure Webhook in Facebook App**
   - Go to **Webhooks** in your app settings
   - Add webhook URL: `https://yourdomain.com/api/integrations/facebook-lead-ads/webhook`
   - Subscribe to **Leadgen** events

2. **Verify Webhook**
   - Facebook will send a GET request with `hub.verify_token` and `hub.challenge`
   - Your endpoint must respond with the challenge
   - Set `FACEBOOK_WEBHOOK_VERIFY_TOKEN` in your environment variables
   - Use the same token when configuring the webhook in Facebook App settings

3. **Handle Lead Events**
   - Facebook will POST lead data when a new lead is generated
   - Process and store the lead data

## ⚠️ Important Notes

### Development vs Production

#### ✅ **Development Mode (Perfect for Testing!)**

**Yes, you can absolutely use Development Mode for testing!** Here's what you need to know:

**Advantages:**
- ✅ **No App Review Required** - Start testing immediately
- ✅ **Full API Access** - All permissions work without review
- ✅ **Perfect for Development** - Test your integration before going live
- ✅ **Free** - No additional costs

**Limitations:**
- ⚠️ **Limited Users** - Only app admins, developers, and testers can use it
- ⚠️ **Not Public** - Regular users cannot connect
- ⚠️ **25 User Limit** - Maximum 25 test users/roles

**How to Use Development Mode:**

1. **Add Test Users/Roles:**
   - Go to your Facebook App → **Roles** → **Roles**
   - Click **"Add People"**
   - Add Facebook users as:
     - **Administrators** - Full access (you)
     - **Developers** - Can test the app
     - **Testers** - Can test the app
   - Users must accept the role invitation

2. **Test the Integration:**
   - Any user with Admin/Developer/Tester role can connect
   - All API calls work normally
   - Lead retrieval works perfectly
   - No restrictions on functionality

3. **Switch to Production (When Ready):**
   - Go to **App Review** → **Permissions and Features**
   - Request `leads_retrieval` permission
   - Submit for review with:
     - Use case description
     - Demo video showing the integration
     - Privacy policy URL
   - Once approved, your app goes live

**Recommended Testing Workflow:**
```
1. Create App → Keep in Development Mode ✅
2. Add yourself as Admin/Developer
3. Test OAuth connection
4. Test lead retrieval
5. Test all features
6. When ready → Submit for App Review
7. After approval → Switch to Production
```

#### 🚀 **Production Mode**

- Requires App Review for `leads_retrieval` permission
- Must provide use case and demo video
- Can take several days for approval
- Once approved, any Facebook user can connect

### Token Management

- **Short-lived tokens**: Expire in 1-2 hours
- **Long-lived tokens**: Expire in 60 days (automatically handled)
- **Page tokens**: Don't expire but can be revoked
- **Token refresh**: Implement automatic refresh before expiration

### Permissions Required

The integration requests these scopes:
- `leads_retrieval` - **Critical** for Lead Ads
- `pages_read_engagement` - Read page data
- `pages_manage_metadata` - Manage page settings
- `pages_read_user_content` - Read page content

### Rate Limits

Facebook API has rate limits:
- **User-level**: 200 calls per hour per user
- **App-level**: Higher limits based on app usage
- Implement retry logic with exponential backoff

## 🐛 Troubleshooting

### Common Issues

1. **"App not active" / "This app is not accessible right now"** ⚠️ **MOST COMMON**
   
   **Cause:** The Facebook App is in Development Mode and the user trying to connect is not added as a role.
   
   **Solution:**
   - Go to [Meta for Developers](https://developers.facebook.com/)
   - Select your app
   - Navigate to **Settings** → **Basic** (or **Roles** → **Roles**)
   - Scroll down to **"App Roles"** section
   - Click **"Add People"** button
   - Enter the Facebook email/name of the user trying to connect
   - Select role: **Administrator** (recommended) or **Developer** or **Tester**
   - Click **"Add"**
   - **Important:** The user must accept the role invitation (check their email/Facebook notifications)
   - After accepting, wait 1-2 minutes and try connecting again
   
   **Quick Fix Steps:**
   ```
   1. Go to developers.facebook.com/apps
   2. Select your app
   3. Go to Roles → Roles
   4. Click "Add People"
   5. Add yourself/team members as Administrators
   6. Accept the invitation
   7. Try connecting again
   ```
   
   **Alternative:** If you want to allow any user to connect (not recommended for testing):
   - Go to **App Review** → **Permissions and Features**
   - Submit your app for review
   - Once approved, switch to **Production Mode**

2. **"URL Blocked" / "Redirect URI Not Whitelisted"** ⚠️ **COMMON**
   
   **Cause:** Redirect URI not added to Facebook App OAuth settings or OAuth login types disabled.
   
   **Solution:**
   - Go to **Facebook Login** → **Settings**
   - ✅ Enable **"Client OAuth Login"** (toggle ON)
   - ✅ Enable **"Web OAuth Login"** (toggle ON)
   - Scroll to **"Valid OAuth Redirect URIs"**
   - Add your exact redirect URI: `${BASE_URL}/api/integrations/facebook-lead-ads/oauth/callback`
   - Example: `https://yourdomain.com/api/integrations/facebook-lead-ads/oauth/callback`
   - Make sure it matches EXACTLY (no trailing slash, correct protocol)
   - Click **"Save Changes"**
   - Wait 1-2 minutes and try again
   
   **Quick Check:**
   - Verify `BASE_URL` in your `.env` file
   - Redirect URI = `${BASE_URL}/api/integrations/facebook-lead-ads/oauth/callback`
   - Must match exactly in Facebook settings (case-sensitive)

3. **"Invalid OAuth Redirect URI"**
   - Ensure redirect URI matches exactly in Facebook App settings
   - Go to **Facebook Login** → **Settings**
   - Check **Valid OAuth Redirect URIs** includes:
     - `http://localhost:5000/api/integrations/facebook-lead-ads/oauth/callback` (for local)
     - `https://yourdomain.com/api/integrations/facebook-lead-ads/oauth/callback` (for production)
   - Check for trailing slashes or protocol mismatches (http vs https)

3. **"leads_retrieval permission not granted"**
   - In Development Mode: User must be added as admin/developer/tester
   - In Production Mode: App must be submitted for review and approved
   - Check **App Review** → **Permissions and Features** to see permission status

4. **"Token expired"**
   - Long-lived tokens expire after 60 days
   - Implement token refresh logic
   - Reconnect the integration to get a new token

5. **"Page access denied"**
   - User must have admin access to the Facebook Page
   - Check page permissions in Business Manager
   - Ensure the Facebook account has the right role on the page

6. **"App ID or App Secret incorrect"**
   - Double-check `.env` file has correct values
   - Go to **Settings** → **Basic** in your Facebook App
   - Copy **App ID** exactly (no spaces)
   - Click **"Show"** next to App Secret and copy it exactly
   - Restart your server after updating `.env`

### Debug Mode

Enable debug mode in Facebook App:
- Go to **Settings** → **Advanced**
- Enable **"Is Embedded"** if using iframe
- Check **"Require App Secret"** for webhooks

## 📚 Additional Resources

- [Facebook Lead Ads API Documentation](https://developers.facebook.com/docs/marketing-api/leadgen)
- [Facebook Graph API Explorer](https://developers.facebook.com/tools/explorer/)
- [Facebook App Review Guide](https://developers.facebook.com/docs/app-review)
- [OAuth 2.0 Flow Documentation](https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow)

## ✅ Checklist

### For Testing (Development Mode):
- [ ] Facebook App created and set to **Development Mode**
- [ ] Added yourself as Admin/Developer in App Roles
- [ ] OAuth redirect URIs added
- [ ] Environment variables set (`FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `BASE_URL`)
- [ ] Facebook Page created and accessible
- [ ] Test connection successful
- [ ] Lead retrieval tested
- [ ] All features working as expected

### Before Going Live (Production Mode):
- [ ] App tested thoroughly in Development Mode
- [ ] Privacy Policy URL added to app settings
- [ ] Use case documentation prepared
- [ ] Demo video created showing the integration
- [ ] App submitted for review
- [ ] `leads_retrieval` permission approved
- [ ] App switched to Production Mode
- [ ] Webhook configured (if using real-time updates)

---

**Need Help?** Check the codebase:
- OAuth implementation: `server/integrations/oauth/facebook.ts`
- Integration routes: `server/integrations/index.ts`
- Frontend UI: `client/src/pages/integrations-page.tsx`

