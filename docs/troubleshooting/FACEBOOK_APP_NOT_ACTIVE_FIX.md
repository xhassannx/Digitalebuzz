# Fix: "App not active" Error - Quick Guide

## 🚨 Error Message
```
App not active
This app is not accessible right now and the app developer is aware of the issue. 
You will be able to log in when the app is reactivated.
```

## ✅ Solution (5 Minutes)

### Step 1: Go to Your Facebook App
1. Visit [https://developers.facebook.com/apps](https://developers.facebook.com/apps)
2. Log in with your Facebook account
3. Click on your app name

### Step 2: Add Yourself as Administrator
1. In the left sidebar, click **"Roles"** → **"Roles"**
   - OR go to **"Settings"** → **"Basic"** and scroll to **"App Roles"**
2. Click the **"Add People"** button
3. Enter your Facebook email or name
4. Select **"Administrator"** role
5. Click **"Add"**

### Step 3: Accept the Invitation
1. Check your email inbox (the email associated with your Facebook account)
2. Look for an email from Facebook about app role invitation
3. Click **"Accept"** in the email
4. OR check Facebook notifications and accept there

### Step 4: Wait and Retry
1. Wait 1-2 minutes for the changes to propagate
2. Go back to your application
3. Try connecting Facebook Lead Ads again
4. ✅ It should work now!

## 🔍 Why This Happens

Facebook apps in **Development Mode** can only be accessed by:
- ✅ App Administrators
- ✅ App Developers  
- ✅ App Testers

Regular Facebook users **cannot** access apps in Development Mode until:
- The app is switched to Production Mode, AND
- The app has been approved by Facebook App Review

## 📝 Alternative: Add Multiple Users

If you need to test with multiple users:

1. Go to **Roles** → **Roles**
2. Click **"Add People"** for each user
3. Add them as **Developer** or **Tester** role
4. Each user must accept their invitation

**Note:** Maximum 25 users can be added in Development Mode.

## 🚀 When Ready for Production

Once testing is complete:

1. Go to **App Review** → **Permissions and Features**
2. Request `leads_retrieval` permission
3. Submit for review with:
   - Use case description
   - Demo video
   - Privacy policy URL
4. After approval → Switch to **Production Mode**
5. Then any Facebook user can connect!

---

**Still having issues?** Check:
- ✅ Are you logged into Facebook with the correct account?
- ✅ Did you accept the role invitation?
- ✅ Did you wait 1-2 minutes after accepting?
- ✅ Is the app in Development Mode? (Check Settings → Basic)

