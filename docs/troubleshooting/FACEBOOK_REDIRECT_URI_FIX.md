# Fix: "URL Blocked - Redirect URI Not Whitelisted" Error

## 🚨 Error Message
```
URL Blocked
This redirect failed because the redirect URI is not whitelisted in the app's Client OAuth Settings. 
Make sure Client and Web OAuth Login are on and add all your app domains as Valid OAuth Redirect URIs.
```

## ✅ Solution - Step by Step

### Step 1: Check Your BASE_URL

First, check what `BASE_URL` you have in your `.env` file:

```env
BASE_URL=https://yourdomain.com  # or http://localhost:5000
```

Your redirect URI will be: `${BASE_URL}/api/integrations/facebook-lead-ads/oauth/callback`

**Examples:**
- If `BASE_URL=http://localhost:5000` → Redirect URI: `http://localhost:5000/api/integrations/facebook-lead-ads/oauth/callback`
- If `BASE_URL=https://myapp.com` → Redirect URI: `https://myapp.com/api/integrations/facebook-lead-ads/oauth/callback`
- If `BASE_URL=https://myapp.herokuapp.com` → Redirect URI: `https://myapp.herokuapp.com/api/integrations/facebook-lead-ads/oauth/callback`

### Step 2: Go to Facebook App Settings

1. Visit [https://developers.facebook.com/apps](https://developers.facebook.com/apps)
2. Select your app
3. In the left sidebar, click **"Facebook Login"** → **"Settings"**

### Step 3: Enable OAuth Login Types

Make sure these are **ON** (enabled):
- ✅ **Client OAuth Login** - Must be ON
- ✅ **Web OAuth Login** - Must be ON

If they're off, toggle them ON and click **"Save Changes"**

### Step 4: Add Valid OAuth Redirect URIs

1. Scroll down to **"Valid OAuth Redirect URIs"** section
2. Click **"Add URI"** button
3. Add your redirect URI(s):

   **For Production:**
   ```
   https://yourdomain.com/api/integrations/facebook-lead-ads/oauth/callback
   ```

   **For Local Development (HTTPS Required):**
   
   ⚠️ **Facebook requires HTTPS** - `http://localhost` URLs may be rejected!
   
   **Option A: Use Ngrok (Recommended)**
   ```
   https://your-ngrok-url.ngrok.io/api/integrations/facebook-lead-ads/oauth/callback
   ```
   See `FACEBOOK_LOCALHOST_FIX.md` for ngrok setup instructions.
   
   **Option B: Try without port (Development Mode only)**
   ```
   http://localhost/api/integrations/facebook-lead-ads/oauth/callback
   ```
   Note: This may not work if app is in Live Mode.

4. **Important:** Copy the exact URL from your `.env` BASE_URL + `/api/integrations/facebook-lead-ads/oauth/callback`
5. Click **"Save Changes"**

### Step 5: Add App Domains (If Required)

1. Go to **Settings** → **Basic**
2. Scroll to **"App Domains"** section
3. Add your domain (without http/https):
   - For production: `yourdomain.com`
   - For localhost: `localhost` (optional, but can help)
4. Click **"Save Changes"**

### Step 6: Verify Settings

Your Facebook Login settings should look like:

```
✅ Client OAuth Login: ON
✅ Web OAuth Login: ON

Valid OAuth Redirect URIs:
- https://yourdomain.com/api/integrations/facebook-lead-ads/oauth/callback
- http://localhost:5000/api/integrations/facebook-lead-ads/oauth/callback (if testing locally)
```

### Step 7: Test Again

1. Wait 1-2 minutes for changes to propagate
2. Go back to your application
3. Try connecting Facebook Lead Ads again
4. ✅ It should work now!

## 🔍 Common Mistakes to Avoid

### ❌ Wrong:
- Adding `https://yourdomain.com` (missing the callback path)
- Adding `https://yourdomain.com/oauth/callback` (wrong path)
- Using `http://` for production (should be `https://`)
- Adding trailing slash: `https://yourdomain.com/api/integrations/facebook-lead-ads/oauth/callback/` (extra slash)

### ✅ Correct:
- `https://yourdomain.com/api/integrations/facebook-lead-ads/oauth/callback` (exact match)
- `http://localhost:5000/api/integrations/facebook-lead-ads/oauth/callback` (for local)

## 📋 Quick Checklist

- [ ] Checked BASE_URL in `.env` file
- [ ] Enabled "Client OAuth Login" in Facebook App
- [ ] Enabled "Web OAuth Login" in Facebook App
- [ ] Added exact redirect URI to "Valid OAuth Redirect URIs"
- [ ] Added app domain to "App Domains" (if required)
- [ ] Saved all changes
- [ ] Waited 1-2 minutes
- [ ] Tested connection again

## 🐛 Still Not Working?

1. **Double-check the exact URL:**
   - Go to your `.env` file
   - Copy the `BASE_URL` value exactly
   - Add `/api/integrations/facebook-lead-ads/oauth/callback` to it
   - Make sure it matches EXACTLY in Facebook settings (case-sensitive, no trailing slash)

2. **Check for typos:**
   - `facebook-lead-ads` (with hyphens, not underscores)
   - `/oauth/callback` (not `/callback` or `/oauth`)

3. **Verify protocol:**
   - Production must use `https://`
   - Localhost can use `http://`

4. **Clear browser cache** and try again

5. **Check Facebook App Status:**
   - Make sure app is not restricted or disabled
   - Check if you're added as Administrator/Developer

---

**Need Help?** Share your `BASE_URL` from `.env` and I can tell you the exact redirect URI to add!

