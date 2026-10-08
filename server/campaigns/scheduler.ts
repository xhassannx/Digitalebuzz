// @ts-nocheck
import { storage } from '../storage';
import { enqueueCampaignExecution } from './execution-queue';
import { campaigns } from '@shared/schema';
import { db } from '../../db';
import { eq, and, lte, or, isNotNull } from 'drizzle-orm';
import { isMongoEnabled } from '../../db/mongo';
import { CampaignModel } from '../models';

/**
 * Check for scheduled campaigns that are ready to execute
 * Runs every minute to check for campaigns scheduled to run now or in the past
 */
export async function checkScheduledCampaigns(): Promise<void> {
  try {
    const now = new Date();
    // Commented out verbose scheduler check logs - uncomment for debugging
    // console.log(`[Campaign Scheduler] Checking for scheduled campaigns at ${now.toISOString()} (${now.toLocaleString()})`);
    
    // Find campaigns that are scheduled and whose scheduledAt time has passed
    // Also check draft campaigns with scheduledAt in the past (in case status wasn't updated)
    // IMPORTANT: We check for campaigns with status 'scheduled' OR 'draft' that have scheduledAt <= now
    // This ensures campaigns that are past their scheduled time will be executed even if they're still in 'scheduled' status
    let scheduledCampaigns;
    try {
      if (isMongoEnabled()) {
        const docs = await CampaignModel.find({
          status: { $in: ['scheduled', 'draft'] },
          scheduledAt: { $ne: null, $lte: now },
        })
          .sort({ scheduledAt: 1 })
          .lean();
        scheduledCampaigns = docs.map((d) => ({ ...d, id: d._id }));
      } else {
        scheduledCampaigns = await db
          .select()
          .from(campaigns)
          .where(
            and(
              or(
                eq(campaigns.status, 'scheduled'),
                eq(campaigns.status, 'draft')
              ),
              isNotNull(campaigns.scheduledAt),
              lte(campaigns.scheduledAt, now)
            )
          )
          .orderBy(campaigns.scheduledAt);
      }
      
      // console.log(`[Campaign Scheduler] Database query completed successfully`);
      // console.log(`[Campaign Scheduler] Query found ${scheduledCampaigns.length} campaign(s) with status 'scheduled' or 'draft' and scheduledAt <= ${now.toISOString()}`);
    } catch (dbError: any) {
      // Handle case where migration hasn't run yet (missing columns like header_video_id)
      if (dbError.message && dbError.message.includes('does not exist') && dbError.message.includes('header_')) {
        console.warn('[Campaign Scheduler] ⚠️  Database schema mismatch detected. Please run migration: migrations/add_campaign_header_video_document.sql');
        console.warn('[Campaign Scheduler] ⚠️  Scheduler will skip this check until migration is applied.');
        scheduledCampaigns = []; // Return empty array to prevent crash
      } else {
        console.error('[Campaign Scheduler] ❌ Database query failed:', dbError);
        console.error('[Campaign Scheduler] Database error details:', {
          message: dbError.message,
          stack: dbError.stack,
        });
        throw dbError; // Re-throw if it's a different error
      }
    }

    if (scheduledCampaigns.length > 0) {
      console.log(`[Campaign Scheduler] ✅ Found ${scheduledCampaigns.length} campaign(s) ready to execute at ${now.toISOString()}`);
      scheduledCampaigns.forEach(c => {
        const timeDiff = c.scheduledAt ? Math.round((now.getTime() - c.scheduledAt.getTime()) / 1000) : 0;
        const timeDiffMinutes = Math.round(timeDiff / 60);
        console.log(`  - Campaign: ${c.name} (ID: ${c.id})`);
        console.log(`    Status: ${c.status} (will be executed even if still 'scheduled')`);
        console.log(`    Scheduled: ${c.scheduledAt?.toISOString()} (${timeDiff}s ago / ${timeDiffMinutes} minutes ago)`);
        console.log(`    Session: ${c.sessionId}`);
        if (timeDiff > 300) { // More than 5 minutes late
          console.log(`    ⚠️  WARNING: Campaign is ${timeDiffMinutes} minutes late!`);
        }
      });
    } else {
      // Commented out "no campaigns" log - uncomment for debugging
      // console.log(`[Campaign Scheduler] No campaigns ready to execute (checked at ${now.toISOString()})`);
      
      // Also log a summary of all scheduled campaigns for debugging
      // try {
      //   const allScheduled = await db
      //     .select()
      //     .from(campaigns)
      //     .where(eq(campaigns.status, 'scheduled'));
      //   
      //   if (allScheduled.length > 0) {
      //     console.log(`[Campaign Scheduler] Debug: Found ${allScheduled.length} campaign(s) with status 'scheduled' in database:`);
      //     allScheduled.forEach(c => {
      //       const timeDiff = c.scheduledAt ? Math.round((now.getTime() - c.scheduledAt.getTime()) / 1000) : 0;
      //       console.log(`  - ${c.name}: scheduledAt=${c.scheduledAt?.toISOString()}, timeDiff=${timeDiff}s`);
      //     });
      //   }
      // } catch (debugError) {
      //   // Ignore debug query errors
      // }
    }

    // Execute each scheduled campaign
    for (const campaign of scheduledCampaigns) {
      try {
        if (campaign.organizationId) {
          const { isOrganizationPlanActive } = await import("../utils/org-subscription-gate");
          if (!(await isOrganizationPlanActive(campaign.organizationId))) {
            console.log(
              `[Campaign Scheduler] Skipping campaign ${campaign.id} — subscription expired`
            );
            continue;
          }
        }

        // Only log when campaigns are actually executing (not every check)
        console.log(`[Campaign Scheduler] 🚀 STARTING EXECUTION for campaign: ${campaign.id} (${campaign.name})`);
        // console.log(`[Campaign Scheduler] ========================================`);
        // console.log(`[Campaign Scheduler] Campaign Name: ${campaign.name}`);
        // console.log(`[Campaign Scheduler] Campaign Status: ${campaign.status}`);
        // console.log(`[Campaign Scheduler] Scheduled At: ${campaign.scheduledAt?.toISOString()}`);
        // console.log(`[Campaign Scheduler] Session ID: ${campaign.sessionId}`);
        // console.log(`[Campaign Scheduler] User ID: ${campaign.userId}`);
        // console.log(`[Campaign Scheduler] Organization ID: ${campaign.organizationId || 'none'}`);
        // console.log(`[Campaign Scheduler] ========================================`);
        
        // Execute campaign (this will update status to 'running' and then 'completed' or 'failed')
        const executionResult = await enqueueCampaignExecution(
          campaign.id,
          campaign.userId,
          campaign.organizationId || ''
        );
        
        console.log(`[Campaign Scheduler] ✅ EXECUTION COMPLETED for campaign: ${campaign.id} - success=${executionResult.success}, sent=${executionResult.sentCount}, failed=${executionResult.failedCount}`);
        // console.log(`[Campaign Scheduler] ========================================`);
        if (executionResult.errors.length > 0) {
          console.log(`[Campaign Scheduler] Errors: ${executionResult.errors.join(', ')}`);
        }
        // console.log(`[Campaign Scheduler] ========================================`);
      } catch (error: any) {
        console.error(`[Campaign Scheduler] ❌ Failed to execute campaign ${campaign.id} (${campaign.name}):`, error);
        console.error(`[Campaign Scheduler] Error details:`, {
          message: error.message,
          stack: error.stack,
          errorName: error.name,
          campaignId: campaign.id,
          campaignName: campaign.name,
          sessionId: campaign.sessionId,
          scheduledAt: campaign.scheduledAt?.toISOString(),
          userId: campaign.userId,
          organizationId: campaign.organizationId,
        });
        
        // Note: The executor should have already marked the campaign as failed
        // But we'll try to update it here as a fallback if the executor didn't
        try {
          const currentCampaign = await storage.getCampaign(campaign.id, campaign.userId, campaign.organizationId || '');
          if (currentCampaign && currentCampaign.status !== 'failed') {
            await storage.updateCampaignExecution(campaign.id, campaign.userId, campaign.organizationId || '', {
              status: 'failed',
              completedAt: new Date(),
            });
            console.error(`[Campaign Scheduler] ✅ Marked campaign ${campaign.id} as failed (fallback)`);
          } else {
            console.log(`[Campaign Scheduler] Campaign ${campaign.id} status is already: ${currentCampaign?.status || 'unknown'}`);
          }
        } catch (updateError) {
          console.error(`[Campaign Scheduler] ❌ Failed to update campaign status:`, updateError);
        }
      }
    }

    await checkConfiguredCampaignRetries();
  } catch (error: any) {
    console.error('[Campaign Scheduler] ❌ Error checking scheduled campaigns:', error);
    console.error('[Campaign Scheduler] Error message:', error.message);
    console.error('[Campaign Scheduler] Error stack:', error.stack);
    // Don't throw - we want the scheduler to keep running even if one check fails
  }
}

/**
 * Run due AiSensy-style configured retries (retry_next_at <= now).
 */
export async function checkConfiguredCampaignRetries(): Promise<void> {
  try {
    const due = await storage.getDueCampaignRetries();
    if (due.length === 0) return;

    const { runConfiguredCampaignRetry } = await import('./executor');
    console.log(`[Campaign Scheduler] Found ${due.length} configured retry pass(es) due`);

    for (const campaign of due) {
      try {
        console.log(
          `[Campaign Scheduler] 🔁 Running configured retry for ${campaign.id} (${campaign.name}) attempt=${campaign.retryAttemptCount}`
        );
        await runConfiguredCampaignRetry(campaign.id);
      } catch (error: any) {
        console.error(
          `[Campaign Scheduler] ❌ Configured retry failed for ${campaign.id}:`,
          error?.message || error
        );
      }
    }
  } catch (error: any) {
    console.error('[Campaign Scheduler] ❌ Error checking configured retries:', error?.message || error);
  }
}

/**
 * Start the campaign scheduler
 * Checks for scheduled campaigns every 30 seconds for better accuracy
 */
export function startCampaignScheduler(): void {
  try {
    console.log('[Campaign Scheduler] ========================================');
    console.log('[Campaign Scheduler] 🚀 Starting campaign scheduler');
    console.log('[Campaign Scheduler] ⏰ Default check interval: 30 seconds (override with CAMPAIGN_SCHEDULER_INTERVAL_MS)');
    console.log('[Campaign Scheduler] ========================================');
    
    // Check immediately on startup
    console.log('[Campaign Scheduler] Running initial check...');
    checkScheduledCampaigns().catch(err => {
      console.error('[Campaign Scheduler] ❌ Error in initial check:', err);
    });
    
    const intervalMs = (() => {
      const raw = process.env.CAMPAIGN_SCHEDULER_INTERVAL_MS;
      if (raw !== undefined && String(raw).trim() !== '') {
        const n = parseInt(String(raw).trim(), 10);
        return Number.isFinite(n) ? Math.max(15_000, Math.min(300_000, n)) : 60_000;
      }
      return 30_000; // unchanged default (30s)
    })();
    console.log(`[Campaign Scheduler] ⏰ Checking every ${intervalMs}ms`);

    const intervalId = setInterval(() => {
      checkScheduledCampaigns().catch(err => {
        console.error('[Campaign Scheduler] ❌ Error in scheduled check:', err);
      });
    }, intervalMs);
    
    // Log a heartbeat every 5 minutes to confirm scheduler is running
    setInterval(() => {
      // Commented out heartbeat logs - uncomment for debugging
      // console.log('[Campaign Scheduler] 💓 Scheduler heartbeat - still running (last check was 30s ago)');
    }, 300000); // 5 minutes
    
    console.log('[Campaign Scheduler] ✅ Scheduler started successfully');
  } catch (error: any) {
    console.error('[Campaign Scheduler] ❌ CRITICAL: Failed to start scheduler:', error);
    console.error('[Campaign Scheduler] Error stack:', error.stack);
  }
}

