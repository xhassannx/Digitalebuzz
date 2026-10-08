# Fix: Still Getting "URL Blocked" After Adding URI

## 🔍 The Problem

Even though you've added the correct redirect URI, Facebook is still blocking it. This usually means:

1. **"Client OAuth Login" or "Web OAuth Login" is OFF**
2. **App Domains not set correctly**
3. **Caching issue**
4. **The actual redirect_uri being sent doesn't match exactly**

## ✅ Critical Checks

### Check 1: Enable OAuth Login Types

The toggles might be on a **different page** or **different section**. Check:

1. Go to: **Facebook Login** → **Settings**
2. Look for these toggles (they might be at the TOP of the page):
   - ✅ **"Client OAuth Login"** - Must be **ON** (blue/enabled)
   - ✅ **"Web OAuth Login"** - Must be **ON** (blue/enabled)
3. If you don't see them, try:
   - Scroll to the very top of the Settings page
   - Look in a different tab/section
   - They might be under "Quickstart" or "Products" → "Facebook Login"

**If these are OFF, that's your problem!** Facebook won't accept any redirect URIs if these are disabled.

### Check 2: App Domains

1. Go to: **Settings** → **Basic**
2. Scroll to **"App Domains"**
3. Make sure it contains: `pyramidlike-emilio-exigible.ngrok-free.dev`
   - ✅ Without `https://`
   - ✅ Without trailing slash
   - ✅ Exact match
4. Click **"Save Changes"**

### Check 3: Check What Redirect URI is Actually Being Sent

When you click "Connect", check the popup URL. It should show:
```
redirect_uri=https://pyramidlike-emilio-exigible.ngrok-free.dev/api/integrations/facebook-lead-ads/oauth/callback
```

**Common issues:**
- Trailing slash: `...callback/` (should be `...callback`)
- Different protocol: `http://` instead of `https://`
- Different path: missing `/api/integrations/facebook-lead-ads/oauth/callback`

### Check 4: Clear Everything and Re-add

Sometimes Facebook caches settings. Try:

1. **Remove** the callback URI from the list
2. Click **"Save Changes"**
3. Wait 30 seconds
4. **Add it back** exactly:
   ```
   https://pyramidlike-emilio-exigible.ngrok-free.dev/api/integrations/facebook-lead-ads/oauth/callback
   ```
5. Click **"Save Changes"**
6. Wait 2-3 minutes
7. Try again

### Check 5: Verify BASE_URL in .env

Make sure your `.env` file has:
```env
BASE_URL=https://pyramidlike-emilio-exigible.ngrok-free.dev
```

**Important:**
- No trailing slash
- Exact match with ngrok URL
- Uses `https://`

Then **restart your server**:
```bash
# Stop server (Ctrl+C)
npm run dev
```

## 🎯 Most Likely Issue: OAuth Login Types

Based on the error message saying "Make sure Client and Web OAuth Login are on", the most likely issue is that these toggles are **OFF**.

**Where to find them:**
1. Go to your Facebook App
2. Click **"Facebook Login"** in left sidebar
3. Look for **"Settings"** or **"Quickstart"**
4. Find these toggles:
   - **"Client OAuth Login"**
   - **"Web OAuth Login"**
5. Make sure both are **ON** (blue/enabled)
6. Click **"Save Changes"**

If you can't find them, they might be in:
- **Products** → **Facebook Login** → **Settings**
- Or at the very top of the Facebook Login settings page

## 🔄 Alternative: Check Browser Console

1. Open browser Developer Tools (F12)
2. Go to **Console** tab
3. Click "Connect" on Facebook Lead Ads
4. Look for any errors or the actual redirect_uri being used
5. Compare it with what's in Facebook settings

## 📋 Final Checklist

- [ ] **Client OAuth Login**: ON (blue/enabled)
- [ ] **Web OAuth Login**: ON (blue/enabled)
- [ ] **Valid OAuth Redirect URIs**: Contains exact callback path
- [ ] **App Domains**: Contains ngrok domain (without https://)
- [ ] **BASE_URL in .env**: Matches ngrok URL exactly
- [ ] **Server restarted** after .env change
- [ ] **Ngrok still running**
- [ ] **Waited 2-3 minutes** after saving Facebook settings
- [ ] **Tried incognito/private window**

## 🆘 If Still Not Working

1. **Take a screenshot** of:
   - Facebook Login → Settings page (showing all toggles)
   - Settings → Basic → App Domains section
   - Your server console when clicking "Connect"

2. **Check the popup URL** - copy the full `redirect_uri` parameter from the Facebook popup URL

3. **Verify ngrok is still running** - the URL might have changed

4. **Try removing and re-adding** the redirect URI

The most common cause is the OAuth Login toggles being OFF. Make sure to find and enable them!

