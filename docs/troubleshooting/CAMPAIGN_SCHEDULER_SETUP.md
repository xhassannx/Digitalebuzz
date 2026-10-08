# Campaign Scheduler Setup Guide

## How It Works

### Campaign Status Flow

1. **Creating a Campaign:**
   - When you create a campaign with a future `scheduledAt` date, the status is **automatically set to `'scheduled'`**
   - If `scheduledAt` is in the past or not provided, status remains `'draft'`

2. **Automatic Execution:**
   - The scheduler checks every **60 seconds** for campaigns ready to execute
   - It finds campaigns with:
     - Status = `'scheduled'` (or `'draft'` as fallback)
     - `scheduledAt` <= current time
   - Executes them automatically and updates status to `'running'` → `'completed'` or `'failed'`

### Scheduler Options

The campaign scheduler checks for scheduled campaigns and executes them automatically. There are two ways to run it:

### Option 1: Built-in Scheduler (Current Implementation)

The scheduler runs automatically when the server starts using `setInterval`. This works well for:
- Development environments
- Servers that are always running (VPS, cloud servers)
- Deployments with process managers (PM2, systemd, etc.)

**Pros:**
- ✅ No additional setup required
- ✅ Runs automatically when server starts
- ✅ Simple to maintain

**Cons:**
- ❌ Stops if server process crashes or restarts
- ❌ Requires server to be running continuously

### Option 2: Cron Job (Recommended for Production)

For production environments, use a cron job for better reliability:

#### Setup Steps:

1. **Create a cron job that runs every minute:**

```bash
# Edit crontab
crontab -e

# Add this line (runs every minute)
* * * * * cd /path/to/helicoptic-whatsapp && npx tsx server/scripts/run-scheduled-campaigns.ts >> /var/log/campaign-scheduler.log 2>&1
```

2. **Or use a wrapper script:**

Create `scripts/run-campaign-scheduler.sh`:
```bash
#!/bin/bash
cd /path/to/helicoptic-whatsapp
npx tsx server/scripts/run-scheduled-campaigns.ts >> /var/log/campaign-scheduler.log 2>&1
```

Make it executable:
```bash
chmod +x scripts/run-campaign-scheduler.sh
```

Add to crontab:
```bash
* * * * * /path/to/helicoptic-whatsapp/scripts/run-campaign-scheduler.sh
```

#### Cron Job Advantages:

- ✅ **Independent of Node.js process** - runs even if server restarts
- ✅ **More reliable** - cron daemon is always running
- ✅ **Better monitoring** - logs are separate from application logs
- ✅ **Survives server restarts** - cron jobs persist across reboots

#### Disable Built-in Scheduler When Using Cron:

If you use cron, you can disable the built-in scheduler by commenting out the line in `server/index.ts`:

```typescript
// Start campaign scheduler for scheduled campaigns
// startCampaignScheduler(); // Disabled - using cron job instead
```

## Testing

### Test the scheduler manually:

```bash
# Run once to test
npx tsx server/scripts/run-scheduled-campaigns.ts

# Check logs
tail -f /var/log/campaign-scheduler.log
```

### Test scheduled campaign:

1. Create a campaign with `scheduledAt` set to 1-2 minutes in the future
2. Wait for the scheduled time
3. Check campaign status - it should automatically execute

## Monitoring

### Check if scheduler is running:

**Built-in scheduler:**
- Check server logs for `[Campaign Scheduler]` messages
- Look for: `Starting campaign scheduler (checking every 60 seconds)`

**Cron job:**
- Check cron logs: `grep CRON /var/log/syslog` (Linux) or check cron output file
- Verify cron is running: `systemctl status cron` (Linux) or `service cron status`

### Debugging:

1. **Check scheduled campaigns:**
   ```sql
   SELECT id, name, status, scheduled_at, created_at 
   FROM campaigns 
   WHERE status = 'scheduled' 
   AND scheduled_at <= NOW();
   ```

2. **Check campaign execution logs:**
   - Server console logs show `[Campaign Scheduler]` messages
   - Cron logs show `[Campaign Scheduler Cron]` messages

3. **Verify campaign executed:**
   - Check campaign status changed from `scheduled` to `running` then `completed`
   - Check recipients have status updates

## Production Recommendations

1. **Use cron job** for production deployments
2. **Set up log rotation** for scheduler logs
3. **Monitor cron job** to ensure it's running
4. **Set up alerts** if campaigns fail to execute
5. **Test regularly** with test campaigns

## Troubleshooting

### Campaigns not executing:

1. Check if scheduler is running (built-in or cron)
2. Verify `scheduledAt` time has passed
3. Check campaign status - should be `scheduled` (automatically set when `scheduledAt` is provided)
4. Verify WhatsApp session is connected
5. Check server/cron logs for errors

**Note:** When you create a campaign with a future `scheduledAt` date, the status is automatically set to `'scheduled'`. The scheduler will execute it when the time arrives.

### Scheduler stops working:

1. **Built-in scheduler:** Restart the server
2. **Cron job:** Check cron service is running, verify cron job syntax

### Timezone issues:

- Ensure server timezone matches your timezone
- `scheduledAt` is stored in UTC, scheduler compares with server time
- Use consistent timezone for scheduling and execution

