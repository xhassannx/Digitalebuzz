# Debug: Full Embedded Signup Flow Not Showing

## Problem

When connecting WhatsApp Business, you're seeing a basic OAuth dialog with only two options:
- "Connect your existing WhatsApp Business app"
- "Start with a new WhatsApp phone number"

Instead of the full embedded signup flow with:
- Business portfolio selection
- Business information form
- WhatsApp Business account creation/selection
- WhatsApp Business profile creation

## Root Causes

1. **`EMBEDDED_SIGNUP_CONFIG_ID` not set in `.env`**
2. **Server not restarted after adding config_id**
3. **Config_id not being read from `.env`**
4. **Wrong config_id being used**

## Step-by-Step Debugging

### Step 1: Verify `.env` File

1. **Check if `EMBEDDED_SIGNUP_CONFIG_ID` exists in `.env`:**
   ```env
   EMBEDDED_SIGNUP_CONFIG_ID=24760315386893718
   ```

2. **Verify it's on a new line (no spaces before/after):**
   ```env
   # Correct:
   EMBEDDED_SIGNUP_CONFIG_ID=24760315386893718
   
   # Wrong:
   EMBEDDED_SIGNUP_CONFIG_ID = 24760315386893718  # (spaces around =)
   # EMBEDDED_SIGNUP_CONFIG_ID=24760315386893718  # (commented out)
   ```

3. **Check for typos:**
   - Should be exactly: `EMBEDDED_SIGNUP_CONFIG_ID`
   - Not: `EMBEDDED_SIGNUP_CONFIG`, `EMBEDDED_CONFIG_ID`, etc.

### Step 2: Check Server Logs

When you click "Connect" on WhatsApp Business, check your server logs:

**✅ If config_id is being read correctly:**
```
[WhatsApp OAuth] ✅ Using Embedded Signup Config ID: 24760315386893718
[WhatsApp OAuth] Full OAuth URL (first 200 chars): https://www.facebook.com/v21.0/dialog/oauth?client_id=1452687312416212&redirect_uri=...
```

**❌ If config_id is NOT being read:**
```
[WhatsApp OAuth] ⚠️  EMBEDDED_SIGNUP_CONFIG_ID not set or empty!
[WhatsApp OAuth] Current value: ""
[WhatsApp OAuth] This will show basic OAuth flow instead of full embedded signup.
```

### Step 3: Verify OAuth URL

1. **Open browser developer tools (F12)**
2. **Go to Network tab**
3. **Click "Connect" on WhatsApp Business**
4. **Look for the OAuth request**
5. **Check the URL - it should include:**
   - `setup=true`
   - `config_id=24760315386893718`
   - `v21.0` (not `v18.0`)

**Correct URL should look like:**
```
https://www.facebook.com/v21.0/dialog/oauth?
  client_id=1452687312416212&
  redirect_uri=...&
  scope=...&
  state=...&
  response_type=code&
  setup=true&
  config_id=24760315386893718
```

**If URL shows `v18.0` or missing `config_id`:**
- Server is using old code
- Restart server after updating `.env`

### Step 4: Restart Server

**After updating `.env` file, ALWAYS restart server:**

```bash
# Stop server (Ctrl+C)
npm run dev
```

**Important:** Environment variables are only loaded when the server starts!

### Step 5: Clear Browser Cache

OAuth popups are heavily cached:

1. **Use Incognito/Private Browsing Mode:**
   - Chrome: Ctrl+Shift+N
   - Firefox: Ctrl+Shift+P
   - Edge: Ctrl+Shift+N

2. **Or Clear Browser Cache:**
   - Clear cookies and cached images/files
   - Try connecting again

## Quick Fix Checklist

- [ ] `EMBEDDED_SIGNUP_CONFIG_ID=24760315386893718` exists in `.env`
- [ ] No spaces around `=` sign
- [ ] Not commented out (no `#` before it)
- [ ] Server restarted after adding to `.env`
- [ ] Server logs show: `✅ Using Embedded Signup Config ID: 24760315386893718`
- [ ] OAuth URL includes `config_id=24760315386893718`
- [ ] OAuth URL uses `v21.0` (not `v18.0`)
- [ ] Tried connecting in incognito/private mode

## Common Issues

### Issue 1: Config ID Not in `.env`

**Symptom:** Server logs show warning about config_id not set

**Fix:**
1. Add to `.env`:
   ```env
   EMBEDDED_SIGNUP_CONFIG_ID=24760315386893718
   ```
2. Restart server

### Issue 2: Server Not Restarted

**Symptom:** Changes to `.env` not taking effect

**Fix:**
1. Stop server (Ctrl+C)
2. Start server: `npm run dev`
3. Try connecting again

### Issue 3: Wrong Config ID

**Symptom:** Config_id is set but still showing basic flow

**Fix:**
1. Verify config_id in Meta Dashboard
2. Check which config has "helicopticsolutions" linked
3. Use that config_id in `.env`

### Issue 4: Browser Cache

**Symptom:** Still seeing old OAuth dialog

**Fix:**
1. Use incognito/private browsing mode
2. Or clear browser cache completely

## Expected Result

After fixing:

1. **Server logs show:**
   ```
   [WhatsApp OAuth] ✅ Using Embedded Signup Config ID: 24760315386893718
   ```

2. **OAuth URL includes:**
   - `setup=true`
   - `config_id=24760315386893718`
   - `v21.0`

3. **OAuth dialog shows:**
   - Business portfolio selection (with "helicopticsolutions" available)
   - Business information form
   - WhatsApp Business account creation/selection
   - WhatsApp Business profile creation

## Still Not Working?

1. **Check server logs** - What do they say about config_id?
2. **Check OAuth URL** - Does it include `config_id` parameter?
3. **Verify config_id in Meta Dashboard** - Is `24760315386893718` the correct one?
4. **Try different config_id** - Test with one of the other 3 configs

