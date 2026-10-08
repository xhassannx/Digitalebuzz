# Facebook OAuth Troubleshooting Checklist

## ✅ Step-by-Step Verification

### 1. Verify Facebook App Settings

Go to: https://developers.facebook.com/apps → Your App → Facebook Login → Settings

**Check these EXACTLY:**

- [ ] **Client OAuth Login**: Must be **ON** (toggle enabled)
- [ ] **Web OAuth Login**: Must be **ON** (toggle enabled)
- [ ] **Valid OAuth Redirect URIs** contains EXACTLY:
  ```
  https://pyramidlike-emilio-exigible.ngrok-free.dev/api/integrations/facebook-lead-ads/oauth/callback
  ```
  - ✅ Starts with `https://`
  - ✅ No trailing slash
  - ✅ Exact path: `/api/integrations/facebook-lead-ads/oauth/callback`
  - ✅ No extra spaces

### 2. Verify App Domains

Go to: Settings → Basic → App Domains

- [ ] Contains: `pyramidlike-emilio-exigible.ngrok-free.dev`
  - ✅ Without `https://`
  - ✅ Without trailing slash
  - ✅ Exact match

### 3. Verify .env File

Check your `.env` file:

```env
BASE_URL=https://pyramidlike-emilio-exigible.ngrok-free.dev
FACEBOOK_APP_ID=1452687312416212
FACEBOOK_APP_SECRET=your_app_secret_here
```

- [ ] `BASE_URL` matches ngrok URL exactly
- [ ] No trailing slash
- [ ] Uses `https://` (not `http://`)

### 4. Verify Server Restart

- [ ] Stopped the server completely (Ctrl+C)
- [ ] Restarted with `npm run dev`
- [ ] Server is running on port 5002
- [ ] No errors in server console

### 5. Verify Ngrok

- [ ] Ngrok is running: `ngrok http 5002`
- [ ] Ngrok shows: `Forwarding https://pyramidlike-emilio-exigible.ngrok-free.dev -> http://localhost:5002`
- [ ] Ngrok terminal is still open and running

### 6. Clear Browser Cache

- [ ] Cleared browser cache
- [ ] Tried incognito/private window
- [ ] Or hard refresh: Ctrl+Shift+R (Windows) / Cmd+Shift+R (Mac)

## 🔍 Common Issues & Fixes

### Issue 1: Changes Not Saved
**Symptom:** Settings look correct but still getting error

**Fix:**
- Make sure you clicked **"Save Changes"** button after adding URI
- Wait 2-3 minutes for Facebook to propagate changes
- Try logging out and back into Facebook

### Issue 2: Typo in URI
**Symptom:** URI doesn't match exactly

**Fix:**
- Copy-paste the exact URI from this checklist
- Check for:
  - Extra spaces
  - Wrong characters
  - Missing `/api/` part
  - Wrong path: should be `/api/integrations/facebook-lead-ads/oauth/callback`

### Issue 3: OAuth Types Not Enabled
**Symptom:** Redirect URI added but OAuth types disabled

**Fix:**
- Go to Facebook Login → Settings
- Toggle **"Client OAuth Login"** to ON
- Toggle **"Web OAuth Login"** to ON
- Click **"Save Changes"**

### Issue 4: App Domain Missing
**Symptom:** URI added but domain not in App Domains

**Fix:**
- Go to Settings → Basic
- Add: `pyramidlike-emilio-exigible.ngrok-free.dev`
- Save changes

### Issue 5: BASE_URL Mismatch
**Symptom:** Server using different URL than Facebook

**Fix:**
- Check `.env` file `BASE_URL` matches ngrok URL exactly
- Restart server after changing `.env`
- Verify server logs show correct BASE_URL

## 🧪 Test the Redirect URI

### Manual Test:
1. Open browser
2. Go to: `https://pyramidlike-emilio-exigible.ngrok-free.dev/api/integrations/facebook-lead-ads/oauth/callback`
3. You should see an error (expected - needs OAuth flow)
4. But it confirms the URL is accessible

### Check Server Logs:
When you click "Connect", check server console for:
- What redirect URI is being used
- Any errors in the OAuth flow

## 📋 Exact Values to Use

**Redirect URI (copy this exactly):**
```
https://pyramidlike-emilio-exigible.ngrok-free.dev/api/integrations/facebook-lead-ads/oauth/callback
```

**App Domain:**
```
pyramidlike-emilio-exigible.ngrok-free.dev
```

**BASE_URL in .env:**
```
BASE_URL=https://pyramidlike-emilio-exigible.ngrok-free.dev
```

## 🆘 Still Not Working?

1. **Double-check everything** in this checklist
2. **Take screenshots** of:
   - Facebook Login Settings page
   - App Domains section
   - Your .env file (hide secret)
3. **Check server logs** for any errors
4. **Try a different browser** or incognito mode

