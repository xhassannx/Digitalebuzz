# Fix: Facebook Login for Business - URL Blocked Issue

## 🔍 The Problem

You're using **"Facebook Login for Business"** product, and even though:
- ✅ Client OAuth login: ON
- ✅ Web OAuth login: ON  
- ✅ Correct callback URI is added

You're still getting "URL Blocked" error.

## ✅ Solution: Remove Base Domain URI

### Issue Identified

In your "Valid OAuth Redirect URIs" list, you have:
1. ✅ `https://pyramidlike-emilio-exigible.ngrok-free.dev/api/integrations/facebook-lead-ads/oauth/callback` (CORRECT - keep this)
2. ❌ `https://pyramidlike-emilio-exigible.ngrok-free.dev` (WRONG - remove this)

**With "Strict Mode" enabled**, having the base domain can cause conflicts. Facebook might be trying to match against the base domain instead of the full callback path.

### Fix Steps

1. **Go to Facebook Login → Settings**
2. **Scroll to "Valid OAuth Redirect URIs"**
3. **Remove the base domain URI:**
   - Find: `https://pyramidlike-emilio-exigible.ngrok-free.dev`
   - Click the **X** button to remove it
4. **Keep only the full callback URI:**
   - Keep: `https://pyramidlike-emilio-exigible.ngrok-free.dev/api/integrations/facebook-lead-ads/oauth/callback`
5. **Click "Save Changes"**
6. **Wait 2-3 minutes**
7. **Try connecting again**

## 🔍 Additional Checks for Facebook Login for Business

### Check 1: Marketing API Product

Since you're using Facebook Lead Ads, make sure:

1. Go to **Products** in left sidebar
2. Check if **"Marketing API"** is added
3. If not, click **"Add Product"** → **"Marketing API"** → **"Set Up"**

### Check 2: App Domains

1. Go to **Settings** → **Basic**
2. Scroll to **"App Domains"**
3. Make sure it contains: `pyramidlike-emilio-exigible.ngrok-free.dev`
   - Without `https://`
   - Without trailing slash
4. Click **"Save Changes"**

### Check 3: Verify Redirect URI Format

The redirect URI should be:
```
https://pyramidlike-emilio-exigible.ngrok-free.dev/api/integrations/facebook-lead-ads/oauth/callback
```

**Must have:**
- ✅ `https://` (not `http://`)
- ✅ Full path: `/api/integrations/facebook-lead-ads/oauth/callback`
- ✅ No trailing slash
- ✅ Exact match

### Check 4: Clear Cache and Retry

After removing the base domain:

1. **Clear browser cache** or use incognito window
2. **Restart your server:**
   ```bash
   # Stop server (Ctrl+C)
   npm run dev
   ```
3. **Wait 2-3 minutes** for Facebook to update
4. **Try connecting again**

## 🎯 Why This Happens

With **"Strict Mode"** enabled:
- Facebook requires **exact match** of redirect URIs
- Having both base domain AND full callback path can cause confusion
- Facebook might try to match against the shorter base domain first
- This causes the "URL Blocked" error even though the correct URI exists

## 📋 Final Checklist

- [ ] Removed base domain URI: `https://pyramidlike-emilio-exigible.ngrok-free.dev`
- [ ] Kept only full callback URI: `https://pyramidlike-emilio-exigible.ngrok-free.dev/api/integrations/facebook-lead-ads/oauth/callback`
- [ ] Clicked "Save Changes"
- [ ] Marketing API product added (if needed)
- [ ] App Domains contains: `pyramidlike-emilio-exigible.ngrok-free.dev`
- [ ] BASE_URL in .env matches: `https://pyramidlike-emilio-exigible.ngrok-free.dev`
- [ ] Server restarted
- [ ] Waited 2-3 minutes
- [ ] Tried connecting again

## 🆘 If Still Not Working

1. **Check server logs** - when you click "Connect", what redirect URI is being sent?
2. **Check browser console** - any errors?
3. **Verify ngrok is still running** - URL might have changed
4. **Try removing and re-adding** the callback URI

The most likely fix is **removing the base domain URI** and keeping only the full callback path.

