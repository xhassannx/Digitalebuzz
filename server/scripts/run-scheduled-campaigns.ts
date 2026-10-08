#!/usr/bin/env node
/**
 * Standalone script to check and execute scheduled campaigns
 * Can be run via cron job for production deployments
 * 
 * Usage:
 *   npx tsx server/scripts/run-scheduled-campaigns.ts
 * 
 * Cron example (runs every minute):
 *   * * * * * cd /path/to/project && npx tsx server/scripts/run-scheduled-campaigns.ts >> /var/log/campaign-scheduler.log 2>&1
 */

import 'dotenv/config';
import { checkScheduledCampaigns } from '../campaigns/scheduler';

async function main() {
  console.log(`[Campaign Scheduler Cron] Starting scheduled campaign check at ${new Date().toISOString()}`);
  
  try {
    await checkScheduledCampaigns();
    console.log(`[Campaign Scheduler Cron] Completed check at ${new Date().toISOString()}`);
    process.exit(0);
  } catch (error: any) {
    console.error(`[Campaign Scheduler Cron] Error:`, error);
    process.exit(1);
  }
}

main();

