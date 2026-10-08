# 🚀 Local Testing Guide - WhatsApp SaaS Platform

This guide will help you test the WhatsApp platform with **real devices** on your local machine.

---

## 📋 Prerequisites

### 1. System Requirements
- **Node.js** 18+ installed
- **PostgreSQL** database (local or cloud)
- **Chromium/Chrome** browser (for unofficial WhatsApp mode)
- **Git** for cloning the repository

### 2. Required Accounts
- **WhatsApp** phone number (for testing)
- **Razorpay** account (optional, for payment testing)
- **Stripe** account (optional, for payment testing)
- **WhatsApp Business API** credentials (optional, for official mode)

---

## 🔧 Setup Instructions

### Step 1: Clone and Install

```bash
# Clone the repository (or download from Replit)
git clone <your-repo-url>
cd whatsapp-saas-platform

# Install dependencies
npm install
```

### Step 2: Database Setup

**Option A: Local PostgreSQL**
```bash
# Install PostgreSQL (if not already installed)
# On macOS:
brew install postgresql
brew services start postgresql

# Create database
createdb whatsapp_saas

# Set database URL
export DATABASE_URL="postgresql://localhost:5432/whatsapp_saas"
```

**Option B: Cloud Database (Recommended)**
```bash
# Use the same Neon database from Replit
# Copy DATABASE_URL from Replit secrets
export DATABASE_URL="postgresql://user:password@host/database"
```

### Step 3: Environment Variables

**✨ Automatic Configuration:** All settings are loaded from `.env` file!

Create a `.env` file in the root directory by copying the example:

```bash
# Copy the example file
cp .env.example .env

# Edit with your values
notepad .env   # Windows
nano .env      # macOS/Linux
```

**Minimal Required Configuration:**

```env
# Database (REQUIRED)
DATABASE_URL=postgresql://localhost:5432/whatsapp_saas

# Session Secret (REQUIRED - Generate random string)
SESSION_SECRET=super-secret-random-key-change-me-12345

# Optional: Payment & WhatsApp Business API
# (Leave these empty for basic testing)
```

**🔐 Authentication for Local Development:**

The app uses **simple password-based authentication**:

- Email/password based signup and login
- Automatic organization creation on signup
- No external configuration needed
- Session-based authentication with PostgreSQL storage

**Startup Message:**

```bash
✅ Running with local password authentication.
   Access signup at /signup and login at /login
```

**Two authentication options:**

1. **Password Authentication** (For UI access):
   - Navigate to `/signup` to create account
   - Navigate to `/login` to sign in
   - Automatic organization creation on signup
   - Logout via user menu dropdown

2. **API Keys** (For programmatic access):
   - Create an API key in the UI after logging in
   - Use the `x-api-key` header in your requests
   - See "API Testing" section below

**📋 .env Template Reference:**

See `.env.example` for all available options including:
- ✅ Database configuration
- ✅ Session secrets
- ✅ Razorpay credentials (optional)
- ✅ Stripe credentials (optional)
- ✅ WhatsApp Business API credentials (optional)
- ✅ OIDC authentication (optional)

**🔒 Security Note:** The `.env` file is automatically ignored by git (won't be committed).

### Step 4: Database Migration

```bash
# Push schema to database
npm run db:push

# If you get a data-loss warning
npm run db:push --force
```

### Step 5: Start the Application

```bash
# Start development server (Works on ALL platforms: Windows, macOS, Linux)
npm run dev
```

**✨ Cross-Platform Support:** The `npm run dev` command now works on **Windows, macOS, and Linux** thanks to the `cross-env` package!

The application will be available at:
- **Frontend**: http://localhost:5000
- **Backend API**: http://localhost:5000/api

---

## 📱 Testing with Real WhatsApp Devices

### Mode 1: Unofficial WhatsApp (QR Code) - **RECOMMENDED FOR LOCAL**

This mode uses `whatsapp-web.js` which connects via QR code scanning.

**Steps:**

1. **Navigate to Connect page**: http://localhost:5000/connect

2. **Click "Connect New Device"** - A QR code will be generated

3. **Scan QR with WhatsApp**:
   - Open WhatsApp on your phone
   - Go to **Settings** → **Linked Devices**
   - Tap **Link a Device**
   - Scan the QR code on your screen

4. **Wait for connection** - Status will change from "connecting" to "connected"

5. **Start testing**:
   - Go to **Chat** page
   - You'll see all your WhatsApp conversations
   - Send/receive messages in real-time
   - Test media, locations, contacts

**Important Notes:**
- ✅ Works on any local machine with Chrome/Chromium
- ✅ Supports multiple devices simultaneously
- ✅ Real-time message sync
- ⚠️ Requires stable internet connection
- ⚠️ WhatsApp may log out if inactive for 14 days

### Mode 2: Official WhatsApp Business API

This mode requires WhatsApp Business API credentials from Meta.

**Setup:**

1. **Get API Credentials**:
   - Visit [Meta for Developers](https://developers.facebook.com/)
   - Create a WhatsApp Business App
   - Get credentials:
     - Business Account ID
     - Phone Number ID
     - Access Token

2. **Configure in Settings**:
   - Go to **Settings** page
   - Navigate to **WhatsApp Business** tab
   - Enter your credentials:
     ```
     Business Account ID: 123456789
     Access Token: EAAxxxxxx
     Phone Number ID: 987654321
     ```
   - Click **Save Credentials**

3. **Create Official Session**:
   - Go to **Connect** page
   - Select **Connection Type**: Official (Business API)
   - Click **Connect New Device**
   - Session connects instantly (no QR needed)

4. **Test API messaging**:
   - Official mode supports:
     - Text messages
     - Media (images, videos, documents)
     - Location messages
     - Contact messages
     - Template messages

**Important Notes:**
- ✅ No QR scanning needed
- ✅ More reliable for production
- ✅ Better rate limits
- ⚠️ Requires approved WhatsApp Business account
- ⚠️ May have costs based on usage
- ⚠️ Requires webhook setup for incoming messages

---

## 🧪 Testing Features

### 1. Multi-Session Management

**Test multiple WhatsApp accounts:**

```bash
# Connect Device 1 (Personal)
1. Create session → Scan QR with personal WhatsApp
2. Name it "Personal WhatsApp"

# Connect Device 2 (Business)
1. Create another session → Scan QR with business WhatsApp
2. Name it "Business WhatsApp"

# Switch between devices in Chat page
- Use the session selector dropdown
- Each device shows its own conversations
```

### 2. Messaging Features

**Test various message types:**

```bash
# Text Messages
- Go to Chat page
- Select a conversation
- Send text messages
- Receive replies in real-time

# Media Messages
- Click attachment icon
- Upload image/video/document
- Add caption (optional)
- Send and verify delivery

# Location Messages
- Go to Send Message page
- Select Location tab
- Enter coordinates or address
- Send to a contact

# Contact Messages
- Select Contact tab
- Fill in contact details
- Send vCard to recipient
```

### 3. Contacts Management

**Organize your contacts:**

```bash
# Add Contact
1. Go to Contacts page
2. Click "Add Contact"
3. Fill in details (name, phone, email, notes)
4. Add tags (e.g., "Customer", "VIP", "Leads")

# Import Contacts
1. Prepare CSV file with columns: name, phoneNumber, email
2. Click "Import CSV"
3. Upload file
4. Contacts will be imported

# Export Contacts
- Click "Export CSV"
- Download contacts list
- Use in other systems
```

### 4. Campaign Testing

**Send bulk messages:**

```bash
# Create Campaign
1. Go to Campaigns page
2. Click "New Campaign"
3. Write message template (use {name} for personalization)
4. Select recipients (from contacts or tags)
5. Click "Execute Campaign"

# Monitor Results
- View delivery status per recipient
- Check success/failure counts
- Review analytics in Dashboard
```

### 5. Webhooks

**Test real-time events:**

```bash
# Setup Webhook
1. Go to Settings → Webhooks
2. Create webhook with URL: https://webhook.site/your-unique-id
3. Select events: message.received, session.connected
4. Add secret for signing

# Trigger Events
- Send message to your WhatsApp
- Connect/disconnect sessions
- Check webhook.site for received payloads

# Verify Signatures
- All webhooks include HMAC-SHA256 signature
- Use your secret to verify authenticity
```

---

## 🔍 Troubleshooting

### Issue: QR Code Not Generating

**Solution:**
```bash
# Check if Chromium is installed
which chromium-browser
which google-chrome

# Install Chromium (Ubuntu/Debian)
sudo apt-get install chromium-browser

# Install Chrome (macOS)
brew install --cask google-chrome

# Set executable path in code (if needed)
# Edit server/whatsapp/client.ts
# Add executablePath to puppeteer config
```

### Issue: Session Connection Timeout

**Solution:**
```bash
# Increase timeout in code
# Check internet connection
# Restart WhatsApp on phone
# Clear WhatsApp cache
# Try different network
```

### Issue: Messages Not Sending

**Solution:**
```bash
# Check session status (must be "connected")
# Verify phone number format: +1234567890 or 1234567890
# Check rate limits (100 requests/minute)
# Review server logs for errors
```

### Issue: WebSocket Disconnections

**Solution:**
```bash
# Check firewall settings
# Verify WebSocket port is open
# Check for proxy/VPN interference
# Review nginx/reverse proxy config (if using)
```

### Issue: Database Connection Errors

**Solution:**
```bash
# Verify DATABASE_URL is correct
# Check PostgreSQL is running:
pg_isready

# Restart PostgreSQL:
brew services restart postgresql  # macOS
sudo service postgresql restart   # Linux

# Check database exists:
psql -l | grep whatsapp_saas
```

---

## 📊 Monitoring & Logs

### View Application Logs

```bash
# Server logs (terminal output)
npm run dev

# Check for errors:
- Connection issues
- Database queries
- WhatsApp client status
- API request/response
```

### Database Queries

```bash
# Connect to database
psql $DATABASE_URL

# View sessions
SELECT id, "sessionId", "userId", status, "phoneNumber" FROM whatsapp_sessions;

# View messages
SELECT id, "sessionId", "chatId", body, "fromMe", timestamp FROM messages ORDER BY timestamp DESC LIMIT 10;

# View contacts
SELECT id, name, "phoneNumber", tags FROM managed_contacts;

# View campaigns
SELECT id, name, status, "recipientCount", "successCount", "failedCount" FROM campaigns;
```

### Performance Monitoring

```bash
# Monitor resource usage
top
htop

# Check database connections
SELECT count(*) FROM pg_stat_activity;

# Monitor API response times
# Check terminal logs for timing info
```

---

## 🚀 Production Deployment (Optional)

### Deploy to VPS/Server

```bash
# 1. Set up production server (Ubuntu 20.04+)
ssh user@your-server-ip

# 2. Install dependencies
sudo apt update
sudo apt install nodejs npm postgresql nginx

# 3. Clone repository
git clone <your-repo-url>
cd whatsapp-saas-platform

# 4. Install packages
npm install

# 5. Set environment variables
nano .env
# (Add all production secrets)

# 6. Build application
npm run build

# 7. Start with PM2
npm install -g pm2
pm2 start npm --name "whatsapp-saas" -- start
pm2 save
pm2 startup

# 8. Configure Nginx reverse proxy
sudo nano /etc/nginx/sites-available/whatsapp-saas
# (Add reverse proxy config)
sudo nginx -t
sudo systemctl restart nginx

# 9. Set up SSL with Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

### Environment Variables for Production

```bash
NODE_ENV=production
DATABASE_URL=postgresql://prod_user:password@localhost/whatsapp_saas_prod
SESSION_SECRET=<strong-random-secret>
```

---

## 🔑 Creating an API Key for Local Testing

After signing up, you can create API keys directly in the UI:

### Using the UI (Recommended)

1. **Sign up** at `/signup` (or login at `/login`)
2. **Navigate to API Keys** section in the dashboard
3. **Click "Create API Key"**
4. **Copy the generated key** - you'll need it for API requests

### Alternative: Using PostgreSQL Command Line

If you need to create an API key manually in the database:

```sql
-- Connect to your database
psql postgresql://localhost:5432/whatsapp_saas

-- 1. Find your user ID (after signing up via UI)
SELECT id, email FROM users;
-- Copy your user ID from the results

-- 2. Create an API key manually
INSERT INTO api_keys (user_id, key, name, organization_id)
VALUES (
  'your-user-id-here',           -- Replace with your actual user ID
  'wapi_test_local_dev_key_12345', -- Your custom API key
  'Local Test Key',                -- Key name
  (SELECT organization_id FROM organization_members WHERE user_id = 'your-user-id-here' LIMIT 1)
);

-- ✅ Success! You can now use this API key: wapi_test_local_dev_key_12345
```

### Alternative: Using a SQL Client

Use tools like **pgAdmin**, **DBeaver**, or **TablePlus** to run SQL commands with a GUI.

---

## 📚 API Testing with Postman/cURL

### Example API Requests

**1. Create Session**
```bash
curl -X POST http://localhost:5000/api/sessions \
  -H "Content-Type: application/json" \
  -H "x-api-key: wapi_test_local_dev_key_12345" \
  -d '{"name": "My WhatsApp Device", "connectionType": "unofficial"}'
```

**2. Get Sessions**
```bash
curl http://localhost:5000/api/sessions \
  -H "x-api-key: wapi_test_local_dev_key_12345"
```

**3. Send Text Message**
```bash
curl -X POST http://localhost:5000/api/messages/send-text \
  -H "Content-Type: application/json" \
  -H "x-api-key: wapi_test_local_dev_key_12345" \
  -d '{
    "sessionId": "your-session-id",
    "to": "+1234567890",
    "message": "Hello from API!"
  }'
```

**4. Send Bulk Messages**
```bash
curl -X POST http://localhost:5000/api/messages/send-bulk \
  -H "Content-Type: application/json" \
  -H "x-api-key: wapi_test_local_dev_key_12345" \
  -d '{
    "sessionId": "your-session-id",
    "recipients": ["+1234567890", "+0987654321"],
    "message": "Bulk message test!"
  }'
```

**5. Get Chats**
```bash
curl http://localhost:5000/api/chats/your-session-id \
  -H "x-api-key: wapi_test_local_dev_key_12345"
```

**6. Create Contact**
```bash
curl -X POST http://localhost:5000/api/contacts \
  -H "Content-Type: application/json" \
  -H "x-api-key: wapi_test_local_dev_key_12345" \
  -d '{
    "name": "John Doe",
    "phoneNumber": "+1234567890"
  }'
```

**7. Create Campaign**
```bash
curl -X POST http://localhost:5000/api/campaigns \
  -H "Content-Type: application/json" \
  -H "x-api-key: wapi_test_local_dev_key_12345" \
  -d '{
    "name": "Test Campaign",
    "message": "Hi {name}, this is a test!",
    "contactIds": ["contact-id-1", "contact-id-2"],
    "sessionId": "your-session-id"
  }'
```

---

## ✅ Testing Checklist

Use this checklist to ensure all features work:

### Core Features
- [ ] User authentication (login/logout)
- [ ] Create WhatsApp session (QR code generation)
- [ ] Scan QR and connect device
- [ ] Receive real-time messages
- [ ] Send text messages
- [ ] Send media messages (image, video, document)
- [ ] Send location messages
- [ ] Send contact messages
- [ ] Disconnect session

### Multi-Device
- [ ] Connect multiple WhatsApp accounts
- [ ] Switch between sessions in Chat page
- [ ] Each session shows correct conversations
- [ ] Messages route to correct device

### Contacts & Groups
- [ ] Add/edit/delete contacts
- [ ] Import contacts from CSV
- [ ] Export contacts to CSV
- [ ] Add/remove tags on contacts
- [ ] Filter contacts by tags
- [ ] Create/manage groups
- [ ] Add/remove group members

### Campaigns
- [ ] Create campaign with template
- [ ] Select recipients (contacts/tags)
- [ ] Execute campaign
- [ ] View delivery status
- [ ] Monitor campaign analytics

### Organizations & Teams
- [ ] Create organization
- [ ] Invite team members
- [ ] Assign roles (admin/member)
- [ ] Organization data isolation
- [ ] Role-based permissions

### Webhooks
- [ ] Create webhook
- [ ] Select events
- [ ] Verify signature
- [ ] Receive event payloads
- [ ] Retry failed webhooks

### Billing & Subscriptions (if configured)
- [ ] View plans
- [ ] Subscribe to plan (Razorpay/Stripe)
- [ ] Check usage limits
- [ ] View payment history
- [ ] Automatic subscription renewal

### Settings
- [ ] Save payment credentials (encrypted)
- [ ] Save WhatsApp Business API credentials
- [ ] Configure webhooks
- [ ] Update user profile

---

## 🆘 Getting Help

If you encounter issues:

1. **Check Logs**: Review terminal output for errors
2. **Database**: Verify database connection and schema
3. **WhatsApp**: Ensure phone has stable connection
4. **Chromium**: Confirm browser is installed for unofficial mode
5. **Firewall**: Check ports 5000 (app) and 5432 (database) are open

**Common Solutions:**
- Restart the application: `Ctrl+C`, then `npm run dev`
- Clear WhatsApp session data: Delete from database
- Reinstall dependencies: `rm -rf node_modules package-lock.json && npm install`
- Reset database: `npm run db:push --force`

---

## 🎯 Next Steps

After successful local testing:

1. **Production Deployment**: Deploy to VPS or cloud platform
2. **Domain Setup**: Configure custom domain and SSL
3. **Scaling**: Add load balancer for multiple instances
4. **Monitoring**: Set up logging and error tracking
5. **Backups**: Implement automated database backups

**Happy Testing! 🚀**
