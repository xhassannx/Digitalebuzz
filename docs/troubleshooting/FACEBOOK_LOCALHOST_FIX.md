# Fix: Facebook Invalid Redirect URI for Localhost

## 🚨 Problem
Facebook rejects `http://localhost:5002` because:
- Facebook requires **HTTPS** for redirect URIs
- Custom ports on localhost may not be accepted
- Your app might be in **Live Mode** (stricter validation)

## ✅ Solution 1: Use Ngrok (Easiest - 5 Minutes)

### Step 1: Install Ngrok
1. Download from: https://ngrok.com/download
2. Extract the file
3. Sign up for free account: https://dashboard.ngrok.com/signup

### Step 2: Authenticate Ngrok
Open terminal/command prompt and run:
```bash
ngrok authtoken YOUR_AUTH_TOKEN
```
(Get your auth token from ngrok dashboard after signup)

### Step 3: Start Tunnel
In a new terminal, run:
```bash
ngrok http 5002
```

You'll see output like:
```
Forwarding   https://abc123.ngrok.io -> http://localhost:5002
```

### Step 4: Update Facebook App Settings
1. Go to: https://developers.facebook.com/apps
2. Select your app
3. Go to **Facebook Login** → **Settings**
4. Add to **Valid OAuth Redirect URIs**:
   ```
   https://abc123.ngrok.io/api/integrations/facebook-lead-ads/oauth/callback
   ```
   (Replace `abc123.ngrok.io` with your actual ngrok URL)
5. Click **"Save Changes"**

### Step 5: Update Your .env File
```env
BASE_URL=https://abc123.ngrok.io
FACEBOOK_APP_ID=1452687312416212
FACEBOOK_APP_SECRET=your_app_secret_here
```

### Step 6: Restart Your Server
```bash
npm run dev
```

### Step 7: Access Your App
Use the ngrok URL: `https://abc123.ngrok.io`

**Note:** Free ngrok URLs change each time you restart ngrok. For permanent URL, upgrade to paid plan or use Solution 2.

---

## ✅ Solution 2: Use Custom Domain with HTTPS

### Step 1: Edit Hosts File

**Windows:**
1. Open Notepad as Administrator
2. Open file: `C:\Windows\System32\drivers\etc\hosts`
3. Add line:
   ```
   127.0.0.1    localdev.yourdomain.com
   ```
4. Save

**Mac/Linux:**
```bash
sudo nano /etc/hosts
```
Add:
```
127.0.0.1    localdev.yourdomain.com
```

### Step 2: Set Up HTTPS Server
You'll need to configure your Express server to use HTTPS with a self-signed certificate.

### Step 3: Update Facebook Settings
- App Domains: `localdev.yourdomain.com`
- Valid OAuth Redirect URIs: `https://localdev.yourdomain.com:5002/api/integrations/facebook-lead-ads/oauth/callback`

---

## ✅ Solution 3: Check App Mode (Simplest Check)

If your app is in **Development Mode**, try:

1. Go to **Settings** → **Basic**
2. Check **"App Mode"** - should be **"Development"**
3. Try adding just:
   ```
   http://localhost/api/integrations/facebook-lead-ads/oauth/callback
   ```
   (Without port number)

4. Also add `localhost` to **App Domains**

**Note:** This might work if app is in Development Mode, but HTTPS is still recommended.

---

## 🎯 Recommended: Use Ngrok

**Why Ngrok?**
- ✅ Quick setup (5 minutes)
- ✅ Free HTTPS tunnel
- ✅ Works immediately
- ✅ No server configuration needed

**Steps Summary:**
1. Install ngrok
2. Run: `ngrok http 5002`
3. Copy HTTPS URL
4. Add to Facebook: `https://your-ngrok-url.ngrok.io/api/integrations/facebook-lead-ads/oauth/callback`
5. Update `.env`: `BASE_URL=https://your-ngrok-url.ngrok.io`
6. Restart server
7. Test!

---

## 🔄 If Ngrok URL Changes

If you restart ngrok and get a new URL:
1. Update Facebook App settings with new URL
2. Update `.env` file with new URL
3. Restart your server

For permanent URL, upgrade ngrok or use Solution 2.

