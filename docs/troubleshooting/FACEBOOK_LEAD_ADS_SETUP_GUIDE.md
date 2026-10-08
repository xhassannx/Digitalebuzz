# Facebook Lead Ads Integration - Quick Setup Guide

## ⚠️ IMPORTANT: Fixing "This app needs at least one supported permission" Error

This error occurs when your Facebook App doesn't have the required permissions configured. Follow these steps:

### Step 1: Configure Facebook App Permissions

1. Go to [Facebook Developers](https://developers.facebook.com/apps/)
2. Select your app (or create a new one)
3. Go to **App Review** → **Permissions and Features**
4. Add these permissions:
   - ✅ `leads_retrieval` - **REQUIRED** for Lead Ads
   - ✅ `pages_read_engagement`
   - ✅ `pages_manage_metadata`
   - ✅ `pages_read_user_content`
   - ✅ `pages_manage_ads`

### Step 2: Configure OAuth Settings

1. Go to **Settings** → **Basic**
2. Add **Valid OAuth Redirect URIs**:
   ```
   https://your-domain.com/fb/callback
   http://localhost:5000/fb/callback  (for development)
   ```

### Step 3: Add Facebook Login Product

1. Go to **Products** → **Add Product**
2. Find **Facebook Login** and click **Set Up**
3. Configure:
   - Valid OAuth Redirect URIs (same as above)
   - Deauthorize Callback URL: `https://your-domain.com/fb/callback`

### Step 4: For Development Mode

If your app is in **Development Mode**:
- Only test users can use it
- Add yourself as a test user in **Roles** → **Test Users**
- Or switch to **Live Mode** (requires App Review for production)

### Step 5: Request Permissions (For Production)

For production use, you need to submit for App Review:
1. Go to **App Review** → **Permissions and Features**
2. Click **Request** next to each permission
3. Provide use case and screenshots
4. Wait for Facebook approval

---

## Environment Variables

Add to your `.env` file:

```env
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
BASE_URL=https://your-domain.com
FACEBOOK_WEBHOOK_VERIFY_TOKEN=your_webhook_token (optional)
```

---

## Required Files

Copy these files to your project:

1. `server/integrations/oauth/facebook.ts` - OAuth handler
2. `server/integrations/handlers/facebook-leads.ts` - Lead syncing logic
3. `client/src/components/facebook-leads-manager.tsx` - Frontend component
4. Register routes in `server/integrations/index.ts`

See the code files below.

