# Production Setup with PM2

This guide explains how to deploy and run the Helicoptic WhatsApp application in production using PM2.

## Prerequisites

1. **Node.js** (v18 or higher)
2. **PM2** installed globally: `npm install -g pm2`
3. **Environment variables** configured in `.env` file
4. **Database** configured and accessible

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Build the Application

Build both the client and server:

```bash
npm run build
```

This will:
- Build the React client to `dist/public/`
- Bundle the server to `dist/index.js`

## Step 3: Configure Environment Variables

**Important:** Make sure you have a `.env` file in the root directory of your project. The PM2 ecosystem config will automatically load it.

Create a `.env` file in the root directory with your production settings:

```env
# Server Configuration
NODE_ENV=production
PORT=5002

# Database (Neon PostgreSQL)
DATABASE_URL=your_production_database_url

# Session Secret (generate a strong random string)
SESSION_SECRET=your_session_secret_here

# Other environment variables as needed
# (Add any other required env vars from your application)
```

**Important:** Generate a strong `SESSION_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Step 4: Create Logs Directory

PM2 will write logs to the `logs/` directory:

```bash
mkdir -p logs
```

## Step 5: Start with PM2

### Option A: Using the Ecosystem File (Recommended)

```bash
pm2 start ecosystem.config.cjs
```

### Option B: Direct PM2 Command

```bash
pm2 start dist/index.js --name helicoptic-whatsapp --env production
```

## Step 6: Save PM2 Configuration

Save the current PM2 process list so it restarts on server reboot:

```bash
pm2 save
pm2 startup
```

The `pm2 startup` command will generate a command to run as root/sudo. Copy and run that command to enable auto-start on boot.

## PM2 Management Commands

### View Status
```bash
pm2 status
```

### View Logs
```bash
# All logs
pm2 logs

# Specific app logs
pm2 logs helicoptic-whatsapp

# Last 100 lines
pm2 logs helicoptic-whatsapp --lines 100
```

### Restart Application
```bash
pm2 restart helicoptic-whatsapp
```

### Stop Application
```bash
pm2 stop helicoptic-whatsapp
```

### Delete Application from PM2
```bash
pm2 delete helicoptic-whatsapp
```

### Monitor (Real-time Dashboard)
```bash
pm2 monit
```

## Updating the Application

When you need to update the application:

1. **Pull latest code** (if using git):
   ```bash
   git pull
   ```

2. **Install new dependencies** (if any):
   ```bash
   npm install
   ```

3. **Rebuild the application**:
   ```bash
   npm run build
   ```

4. **Restart PM2**:
   ```bash
   pm2 restart helicoptic-whatsapp
   ```

## Zero-Downtime Deployment (Optional)

For zero-downtime deployments, you can use PM2's cluster mode. Update `ecosystem.config.js`:

```javascript
{
  name: 'helicoptic-whatsapp',
  script: './dist/index.js',
  instances: 'max', // or specific number like 2
  exec_mode: 'cluster',
  // ... rest of config
}
```

**Note:** Cluster mode may not work well with WhatsApp Web.js clients as they maintain stateful connections. Use with caution.

## Troubleshooting

### Application won't start
- Check logs: `pm2 logs helicoptic-whatsapp`
- Verify environment variables are set correctly
- Ensure port is not already in use
- Check database connection

### High Memory Usage
- The `max_memory_restart: '1G'` setting will auto-restart if memory exceeds 1GB
- Adjust based on your server's capacity

### WhatsApp Sessions Not Working
- Ensure the `whatsapp-sessions/` directory has proper permissions
- Check that LocalAuth can read/write session files
- Verify file system permissions

### Port Already in Use
- Change `PORT` in `.env` file
- Or kill the process using the port:
  ```bash
  # Linux/Mac
  lsof -ti:5000 | xargs kill -9
  
  # Windows
  netstat -ano | findstr :5000
  taskkill /PID <PID> /F
  ```

## Production Checklist

- [ ] Environment variables configured
- [ ] Database migrations run (`npm run db:push` if needed)
- [ ] Application built (`npm run build`)
- [ ] PM2 installed globally
- [ ] Logs directory created
- [ ] PM2 process started
- [ ] PM2 startup configured
- [ ] Firewall configured (if applicable)
- [ ] Reverse proxy configured (nginx/Apache, if applicable)
- [ ] SSL certificate installed (if using HTTPS)

## Reverse Proxy Setup (Nginx Example)

If using Nginx as a reverse proxy:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Security Considerations

1. **Never commit `.env` file** - it's in `.gitignore`
2. **Use strong SESSION_SECRET**
3. **Enable HTTPS** in production
4. **Configure firewall** to only allow necessary ports
5. **Regular updates** - keep dependencies updated
6. **Monitor logs** for suspicious activity

