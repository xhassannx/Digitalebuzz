// @ts-nocheck
import { storage } from '../storage';
import { whatsappManager as unofficialManager } from '../whatsapp/client';
import { businessAPIManager, resolveWhatsAppDocumentFilename, type TemplateMetaForAuth } from '../whatsapp/business-api-client';
import { mockWhatsappManager } from '../whatsapp/mock-client';
import { buildOfficialCarouselSendPayload } from '../whatsapp/carousel-send-payload';
import { flowButtonForTemplateMeta } from '../whatsapp/template-send-helpers';
import type { Campaign, CampaignRecipient, ManagedContact } from '@shared/schema';
import {
  CampaignSendRateLimiter,
  fetchMetaCampaignSendContext,
  isMetaThrottleError,
  resolveCampaignSendPacing,
} from './send-pacing';
import { isRecipientOptedOut } from '../opt-keyword-service';
import { readUploadBuffer } from '../utils/media-storage';
import { assertCampaignWalletBudget, resolveTemplateWalletCategory } from '../wallet/service';
import { categoryFromTemplateDb } from '../wallet/pricing';
import { isWalletBillingEnabled } from '../wallet/config';
import { isOrgCreditLineBilling } from '../credit-line/org-billing';

/** Meta / network errors where a short retry often succeeds (send API only). */
function isTransientCampaignSendError(message: string): boolean {
  return isMetaThrottleError(message);
}

// Helper to get the correct WhatsApp manager based on session connection type
async function getWhatsAppManager(sessionId: string, userId?: string, organizationId?: string) {
  const session = await storage.getSession(sessionId);
  if (!session) {
    console.error(`[Campaign Executor] Session not found: ${sessionId}`);
    return null;
  }
  
  if (session.status !== 'connected') {
    console.error(`[Campaign Executor] Session not connected: ${sessionId}, status: ${session.status}`);
    return null;
  }
  
  if (session.connectionType === 'official') {
    // For Business API, ensure credentials are loaded
    const creds = businessAPIManager['credentials'].get(sessionId);
    if (!creds) {
      // Try to restore session credentials from integrations table or user settings
      console.log(`[Campaign Executor] Business API credentials not in memory, attempting to restore for session: ${sessionId}`);
      try {
        const sessionUserId = userId || session.userId;
        const sessionOrgId = organizationId; // Use provided organizationId or try to get from session
        
        let accessToken: string | null = null;
        let phoneNumberId: string | null = null;
        let businessAccountId: string | null = null;
        let wabaId: string | null = null;

        // First, try to get credentials from integrations table
        try {
          const integration = await storage.getIntegrationByName("whatsapp-business", sessionUserId, sessionOrgId);
          if (integration?.status === "connected" && integration.credentials) {
            const credentials = integration.credentials as any;
            accessToken = credentials.access_token;
            
            // Get phoneNumberId and businessAccountId from session deviceInfo
            if (session.deviceInfo?.apiPhoneNumberId) {
              phoneNumberId = session.deviceInfo.apiPhoneNumberId;
            }
            if (session.deviceInfo?.businessAccountId) {
              businessAccountId = session.deviceInfo.businessAccountId;
            }
            if (session.deviceInfo?.wabaId) {
              wabaId = session.deviceInfo.wabaId;
            }
            
            console.log(`[Campaign Executor] Found credentials in integrations table`);
          }
        } catch (integrationError: any) {
          console.log(`[Campaign Executor] Could not get credentials from integration:`, integrationError.message);
        }

        // Fall back to user settings if integration didn't work
        if (!accessToken) {
          const settings = await storage.getUserSettings(sessionUserId);
          if (settings?.whatsappBusinessCredentials?.phoneNumberId === session.deviceInfo?.apiPhoneNumberId && 
              settings.whatsappBusinessCredentials.accessToken) {
            accessToken = settings.whatsappBusinessCredentials.accessToken;
            phoneNumberId = settings.whatsappBusinessCredentials.phoneNumberId;
            businessAccountId = settings.whatsappBusinessCredentials.businessAccountId;
            console.log(`[Campaign Executor] Found credentials in user settings`);
          }
        }

        // Restore session if we found credentials
        if (accessToken && phoneNumberId) {
          await businessAPIManager.restoreSession(sessionId, {
            phoneNumberId: phoneNumberId,
            accessToken: accessToken,
            businessAccountId: businessAccountId || undefined,
          });
          console.log(`[Campaign Executor] Successfully restored Business API session credentials`);
        } else {
          console.error(`[Campaign Executor] Cannot restore Business API credentials - not found in integrations or user settings`);
          console.error(`[Campaign Executor] Session deviceInfo:`, JSON.stringify(session.deviceInfo, null, 2));
          return null;
        }
      } catch (error: any) {
        console.error(`[Campaign Executor] Failed to restore Business API session:`, error.message);
        return null;
      }
    }
    return businessAPIManager;
  } else if (session.connectionType === 'unofficial') {
    return unofficialManager;
  } else {
    return mockWhatsappManager;
  }
}

export interface CampaignExecutionResult {
  success: boolean;
  sentCount: number;
  failedCount: number;
  errors: string[];
}

/** @deprecated Use CampaignExecutionResult */
type ExecutionResult = CampaignExecutionResult;

export type ExecuteCampaignOptions = {
  /** When true, do not enqueue the one-time background retry for failed recipients. */
  skipAutoRetrySchedule?: boolean;
};

export async function executeCampaign(
  campaignId: string,
  userId: string,
  organizationId: string,
  options?: ExecuteCampaignOptions
): Promise<ExecutionResult> {
  const opts = options ?? {};
  const result: ExecutionResult = {
    success: false,
    sentCount: 0,
    failedCount: 0,
    errors: [],
  };

  console.log(`[Campaign Executor] ========================================`);
  console.log(`[Campaign Executor] 🎯 Starting campaign execution`);
  console.log(`[Campaign Executor] Campaign ID: ${campaignId}`);
  console.log(`[Campaign Executor] User ID: ${userId}`);
  console.log(`[Campaign Executor] Organization ID: ${organizationId || 'none'}`);
  console.log(`[Campaign Executor] ========================================`);

  try {
    const { isOrganizationPlanActive } = await import("../utils/org-subscription-gate");
    if (organizationId && !(await isOrganizationPlanActive(organizationId))) {
      throw new Error("Subscription expired — renew your plan to send campaigns");
    }

    // 1. Fetch campaign
    console.log(`[Campaign Executor] Step 1: Fetching campaign from database...`);
    const campaign = await storage.getCampaign(campaignId, userId, organizationId);
    if (!campaign) {
      console.error(`[Campaign Executor] ❌ Campaign not found: ${campaignId}`);
      throw new Error('Campaign not found');
    }
    console.log(`[Campaign Executor] ✅ Campaign found: ${campaign.name} (status: ${campaign.status})`);

    // 2. Validate campaign status
    // Allow execution if status is 'scheduled' or 'draft' (even if past scheduled time)
    // Block concurrent runs unless the previous run is stale (proxy timeout / crash left "running" + pending rows).
    const STALE_RUNNING_MS = 40 * 60 * 1000;
    if (campaign.status === 'running') {
      const startedAt = campaign.startedAt?.getTime() ?? 0;
      const ageMs = startedAt ? Date.now() - startedAt : STALE_RUNNING_MS + 1;
      if (ageMs < STALE_RUNNING_MS) {
        throw new Error('Campaign is already running');
      }
      console.warn(
        `[Campaign Executor] Resuming stale campaign run (${Math.round(ageMs / 60000)} min since startedAt); continuing with pending recipients only`
      );
    }
    if (campaign.status === 'completed' || campaign.status === 'failed') {
      const recipientRows = await storage.getCampaignRecipients(campaignId, userId, organizationId);
      const pendingCount = recipientRows.filter((r) => r.status === 'pending').length;
      if (pendingCount === 0) {
        throw new Error(
          campaign.status === 'failed'
            ? 'Campaign has failed and there are no pending recipients to retry'
            : 'Campaign has already completed'
        );
      }
      console.log(
        `[Campaign Executor] Campaign is ${campaign.status} but ${pendingCount} recipient(s) are pending — continuing (restart failed / auto-retry).`
      );
    }
    
    // Log if campaign is past its scheduled time
    if (campaign.scheduledAt) {
      const now = new Date();
      const timeDiff = Math.round((now.getTime() - campaign.scheduledAt.getTime()) / 1000);
      if (timeDiff > 0) {
        console.log(`[Campaign Executor] Campaign ${campaign.id} is ${timeDiff} seconds past its scheduled time (${campaign.scheduledAt.toISOString()})`);
      }
    }

    // 3. Get WhatsApp manager for the session
    console.log(`[Campaign Executor] Step 3: Getting WhatsApp manager for session: ${campaign.sessionId}`);
    console.log(`[Campaign Executor] Campaign details: name=${campaign.name}, userId=${userId}, organizationId=${organizationId || 'none'}`);
    
    const whatsappManager = await getWhatsAppManager(campaign.sessionId, userId, organizationId);
    if (!whatsappManager) {
      console.error(`[Campaign Executor] ❌ CRITICAL: WhatsApp manager is NULL - campaign will fail!`);
      // Get more details about why it failed
      console.error(`[Campaign Executor] ❌ WhatsApp manager is null for session: ${campaign.sessionId}`);
      const session = await storage.getSession(campaign.sessionId);
      if (!session) {
        console.error(`[Campaign Executor] ❌ Session not found in database: ${campaign.sessionId}`);
        throw new Error(`WhatsApp session not found: ${campaign.sessionId}`);
      }
      console.error(`[Campaign Executor] Session found but manager unavailable:`, {
        sessionId: session.sessionId,
        status: session.status,
        connectionType: session.connectionType,
        userId: session.userId,
      });
      if (session.status !== 'connected') {
        throw new Error(`WhatsApp session not connected: ${campaign.sessionId}, status: ${session.status}`);
      }
      throw new Error(`WhatsApp manager not available for session: ${campaign.sessionId}, connectionType: ${session.connectionType}`);
    }
    console.log(`[Campaign Executor] ✅ Successfully obtained WhatsApp manager for session: ${campaign.sessionId}`);
    
    // 3.5. Validate Business API credentials and phone number ID (for Business API campaigns)
    if (whatsappManager === businessAPIManager) {
      const session = await storage.getSession(campaign.sessionId);
      const creds = businessAPIManager['credentials'].get(campaign.sessionId);
      
      if (!creds) {
        throw new Error('Business API credentials not available. Please reconnect your WhatsApp Business integration.');
      }
      
      const phoneNumberId = session?.deviceInfo?.apiPhoneNumberId || creds.phoneNumberId;
      if (!phoneNumberId) {
        throw new Error('Phone number ID not found. Please reconnect your WhatsApp Business integration.');
      }
      
      // Validate phone number ID by making a test API call
      try {
        const baseUrl = 'https://graph.facebook.com';
        const apiVersion = 'v23.0';
        const testUrl = `${baseUrl}/${apiVersion}/${phoneNumberId}?fields=id,display_phone_number&access_token=${creds.accessToken}`;
        const testResponse = await fetch(testUrl);
        
        if (!testResponse.ok) {
          const errorData = await testResponse.json().catch(() => ({}));
          const errorCode = errorData.error?.code;
          const errorMessage = errorData.error?.message || 'Unknown error';
          
          if (errorCode === 100 || errorMessage.includes('invalid') || errorMessage.includes('does not exist')) {
            console.error(`[Campaign Executor] ❌ Phone number ID validation failed:`, {
              phoneNumberId,
              errorCode,
              errorMessage,
              sessionId: campaign.sessionId,
            });
            throw new Error(`Invalid phone number ID: The phone number ID (${phoneNumberId}) is invalid or doesn't exist. Please reconnect the phone number in Meta Business Manager.`);
          }
          
          console.warn(`[Campaign Executor] ⚠️  Phone number ID validation returned non-200 status:`, errorMessage);
        } else {
          const phoneData = await testResponse.json();
          console.log(`[Campaign Executor] ✅ Phone number ID validated successfully:`, {
            phoneNumberId: phoneData.id,
            displayPhoneNumber: phoneData.display_phone_number,
          });
        }
      } catch (validationError: any) {
        // If it's our custom error about invalid phone number ID, rethrow it
        if (validationError.message.includes('Invalid phone number ID')) {
          throw validationError;
        }
        // Otherwise, log warning but continue (might be network issue)
        console.warn(`[Campaign Executor] ⚠️  Could not validate phone number ID:`, validationError.message);
      }
    }

    // 4. Update campaign status to 'running'
    console.log(`[Campaign Executor] Step 4: Updating campaign status to 'running'...`);
    await storage.updateCampaignExecution(campaignId, userId, organizationId, {
      status: 'running',
      startedAt: new Date(),
    });
    console.log(`[Campaign Executor] ✅ Campaign status updated to 'running'`);

    // 5. Fetch pending recipients
    console.log(`[Campaign Executor] Step 5: Fetching campaign recipients...`);
    const allRecipients = await storage.getCampaignRecipients(campaignId, userId, organizationId);
    const pendingRecipients = allRecipients.filter(r => r.status === 'pending');
    console.log(`[Campaign Executor] Found ${allRecipients.length} total recipients, ${pendingRecipients.length} pending`);

    if (pendingRecipients.length === 0) {
      console.log(`[Campaign Executor] ⚠️  No pending recipients - marking campaign as completed`);
      // No pending recipients - mark campaign as completed
      await storage.updateCampaignExecution(campaignId, userId, organizationId, {
        status: 'completed',
        completedAt: new Date(),
      });
      result.success = true;
      console.log(`[Campaign Executor] ✅ Campaign marked as completed (no recipients)`);
      return result;
    }
    
    console.log(`[Campaign Executor] Step 6: Starting to send messages to ${pendingRecipients.length} recipients...`);

    const userTemplatesCache =
      campaign.templateId && campaign.templateLanguage
        ? await storage.getMessageTemplatesByUser(userId, organizationId)
        : [];

    const findApprovedCampaignTemplate = (templates: typeof userTemplatesCache) =>
      templates.find(
        (t) =>
          (t.id === campaign.templateId ||
            t.templateId === campaign.templateId ||
            t.name === campaign.messageTemplate) &&
          (t.status === 'APPROVED' || String(t.status || '').toLowerCase() === 'approved')
      );

    const campaignDbTemplate = findApprovedCampaignTemplate(userTemplatesCache);
    const campaignTemplateMeta: Record<string, unknown> =
      (campaignDbTemplate?.metaData || campaignDbTemplate?.metadata || {}) as Record<string, unknown>;

    const contactIdsUnique = [
      ...new Set(pendingRecipients.map((r) => r.contactId).filter((id): id is string => Boolean(id))),
    ];
    const contactsById: Map<string, ManagedContact> =
      organizationId && contactIdsUnique.length > 0
        ? await storage.getManagedContactsByIdsForOrganization(organizationId, contactIdsUnique)
        : new Map();

    const isMarketingTemplate =
      String(campaignDbTemplate?.category || '').toUpperCase() === 'MARKETING';

    let metaSendContext = {
      messagingLimitTier: null as string | null,
      qualityRating: null as string | null,
      throughputLevel: null as string | null,
      canSendMessage: null as boolean | null,
    };
    if (whatsappManager === businessAPIManager) {
      try {
        const session = await storage.getSession(campaign.sessionId);
        const phoneNumberId = session?.deviceInfo?.apiPhoneNumberId;
        const creds = businessAPIManager['credentials'].get(campaign.sessionId);
        if (phoneNumberId && creds?.accessToken) {
          metaSendContext = await fetchMetaCampaignSendContext(phoneNumberId, creds.accessToken);
          if (metaSendContext.canSendMessage === false) {
            console.warn(
              `[Campaign Executor] Meta health_status reports sending unavailable — using extra-slow pacing`
            );
          }
        }
      } catch (metaErr: any) {
        console.warn(`[Campaign Executor] Could not fetch Meta send limits:`, metaErr?.message || metaErr);
      }
    }

    const campaignSession = await storage.getSession(campaign.sessionId);
    if (
      campaignSession &&
      organizationId &&
      (await isWalletBillingEnabled()) &&
      (await isOrgCreditLineBilling(organizationId)) &&
      campaignSession.connectionType === 'official'
    ) {
      let walletCategory = await resolveTemplateWalletCategory(
        campaign.messageTemplate || '',
        userId,
        organizationId
      );
      if (campaign.templateId) {
        const tpl = userTemplatesCache.find(
          (t) =>
            t.id === campaign.templateId ||
            t.templateId === campaign.templateId ||
            t.name === campaign.messageTemplate
        );
        if (tpl) walletCategory = categoryFromTemplateDb(tpl.category);
      }
      const recipientPhones = pendingRecipients.map((r) => {
        const c = r.contactId ? contactsById.get(r.contactId) : undefined;
        return c?.phone || (r as { phone?: string; phoneNumber?: string }).phone || (r as { phoneNumber?: string }).phoneNumber || "";
      });
      await assertCampaignWalletBudget({
        organizationId,
        session: campaignSession,
        metaCategory: walletCategory,
        recipientPhones,
      });
    }

    const pacingPlan = resolveCampaignSendPacing({
      recipientCount: pendingRecipients.length,
      isMarketingTemplate,
      meta: metaSendContext,
    });

    let sendConcurrency = pacingPlan.sendConcurrency;
    let chunkPauseEvery = pacingPlan.chunkPauseEvery;
    let chunkPauseMs = pacingPlan.chunkPauseMs;
    let minIntervalMs = pacingPlan.minIntervalMs;

    const rawCampaignDelay = process.env.CAMPAIGN_INTER_MESSAGE_DELAY_MS;
    if (rawCampaignDelay !== undefined && String(rawCampaignDelay).trim() !== '') {
      const n = parseInt(String(rawCampaignDelay).trim(), 10);
      if (Number.isFinite(n)) minIntervalMs = Math.max(0, Math.min(120_000, n));
    }
    const rawConcurrency = process.env.CAMPAIGN_SEND_CONCURRENCY;
    if (rawConcurrency !== undefined && String(rawConcurrency).trim() !== '') {
      const n = parseInt(String(rawConcurrency).trim(), 10);
      if (Number.isFinite(n)) sendConcurrency = Math.max(1, Math.min(15, n));
    }
    const rawChunkEvery = process.env.CAMPAIGN_CHUNK_PAUSE_EVERY;
    if (rawChunkEvery !== undefined && String(rawChunkEvery).trim() !== '') {
      const n = parseInt(String(rawChunkEvery).trim(), 10);
      if (Number.isFinite(n)) chunkPauseEvery = Math.max(0, Math.min(500, n));
    }
    const rawChunkMs = process.env.CAMPAIGN_CHUNK_PAUSE_MS;
    if (rawChunkMs !== undefined && String(rawChunkMs).trim() !== '') {
      const n = parseInt(String(rawChunkMs).trim(), 10);
      if (Number.isFinite(n)) chunkPauseMs = Math.max(0, Math.min(600_000, n));
    }

    const sendRateLimiter = new CampaignSendRateLimiter(minIntervalMs);
    console.log(`[Campaign Executor] Send pacing (${pacingPlan.mode}): ${pacingPlan.summary}`);
    console.log(
      `[Campaign Executor] Estimated duration ~${Math.ceil(pacingPlan.estimatedSeconds / 60)} min for ${pendingRecipients.length} recipient(s) (CAMPAIGN_PACING_MODE=auto|safe|fast)`
    );
    if (sendConcurrency > 1) {
      console.log(`[Campaign Executor] Send concurrency ${sendConcurrency}`);
    }
    if (chunkPauseEvery > 0 && chunkPauseMs > 0) {
      console.log(
        `[Campaign Executor] Chunk cooldown: pause ${chunkPauseMs}ms every ${chunkPauseEvery} recipient(s)`
      );
    }

    const sleepMs = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

    const CAMPAIGN_SEND_MAX_ATTEMPTS = Math.min(
      5,
      Math.max(1, parseInt(String(process.env.CAMPAIGN_SEND_MAX_ATTEMPTS || '3').trim(), 10) || 3)
    );

    const PROGRESS_FLUSH_EVERY = 25;
    let sinceProgressFlush = 0;

    let messageActivityPending = 0;
    const flushMessageActivity = async (): Promise<void> => {
      if (messageActivityPending <= 0) return;
      const n = messageActivityPending;
      messageActivityPending = 0;
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      try {
        await storage.logMessageActivity({
          userId,
          organizationId,
          date: dateStr,
          messageCount: n,
        });
      } catch (e) {
        console.error('[Campaign Executor] Failed to log message activity:', e);
      }
    };

    const flushCampaignProgress = async (): Promise<void> => {
      sinceProgressFlush = 0;
      await flushMessageActivity();
      await storage.updateCampaignExecution(campaignId, userId, organizationId, {
        sentCount: campaign.sentCount + result.sentCount,
        failedCount: campaign.failedCount + result.failedCount,
      });
    };

    // 6. Optional: log phone number status (do not block sending — other platforms send with unverified numbers; Meta may still accept)
    if (whatsappManager === businessAPIManager) {
      try {
        const session = await storage.getSession(campaign.sessionId);
        const phoneNumberId = session?.deviceInfo?.apiPhoneNumberId;
        const creds = businessAPIManager['credentials'].get(campaign.sessionId);
        const verificationStatus = (session?.deviceInfo as any)?.codeVerificationStatus;
        if (verificationStatus && verificationStatus !== 'VERIFIED') {
          console.warn(`[Campaign Executor] Phone number status: ${verificationStatus}. Sending anyway (same as other platforms).`);
        }
        if (phoneNumberId && creds) {
          const phoneStatusResponse = await fetch(
            `https://graph.facebook.com/v23.0/${phoneNumberId}?fields=id,display_phone_number,code_verification_status&access_token=${creds.accessToken}`
          );
          if (phoneStatusResponse.ok) {
            const phoneStatus = await phoneStatusResponse.json();
            const status = phoneStatus.code_verification_status;
            if (status && status !== 'VERIFIED') {
              console.warn(`[Campaign Executor] API reports verification status: ${status}. Proceeding with send.`);
            }
          }
          // Do not block on 133010 from status check — send anyway (same as other platforms); Meta may still deliver.
        }
      } catch (verifyError: any) {
        console.warn(`[Campaign Executor] Could not check phone status:`, verifyError.message);
      }
    }

    // 6.5. Upload header image ONCE before processing recipients (if needed)
    // This prevents uploading the same image multiple times for each recipient
    let cachedHeaderImageId: string | null = campaign.headerImageId || null;
    if (!cachedHeaderImageId && campaign.headerImageUrl && whatsappManager === businessAPIManager) {
      try {
        console.log(`[Campaign Executor] Uploading header image from URL (once for all recipients): ${campaign.headerImageUrl}`);
        
        // Get credentials and business account ID for upload
        const session = await storage.getSession(campaign.sessionId);
        const creds = businessAPIManager['credentials'].get(campaign.sessionId);
        if (!creds) {
          throw new Error('Business API credentials not available');
        }
        
        const businessAccountId = session?.deviceInfo?.wabaId || creds.businessAccountId;
        if (!businessAccountId) {
          throw new Error('Business Account ID is required for template media uploads');
        }
        
        // Resolve the image URL (handle both absolute and relative paths)
        let imageUrl = campaign.headerImageUrl;
        let localImagePath: string | null = null;
        if (imageUrl.startsWith('/uploads/')) {
          localImagePath = imageUrl;
        } else if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
          try {
            const url = new URL(imageUrl);
            if (url.pathname.startsWith('/uploads/')) {
              localImagePath = url.pathname;
            }
          } catch {}
        }
        
        if (localImagePath) {
          const path = await import('path');
          let decodedPath = localImagePath;
          try { decodedPath = decodeURIComponent(localImagePath); } catch {}
          const imageBuffer = await readUploadBuffer(decodedPath);
          if (imageBuffer) {
            const fileName = path.basename(decodedPath);
            const uploadResult = await businessAPIManager.uploadMediaWithCredentials(
              {
                phoneNumberId: creds.phoneNumberId,
                accessToken: creds.accessToken,
                businessAccountId: businessAccountId,
              },
              imageBuffer,
              fileName,
              'IMAGE',
              false // Use regular /media endpoint - media ID is used for sending, asset handles are only for template creation
            );
            cachedHeaderImageId = uploadResult.id;
            console.log(`[Campaign Executor] Successfully uploaded header image, got media ID: ${cachedHeaderImageId}`);
            
            // Update campaign with the media ID for future use
            await storage.updateCampaign(campaign.id, userId, organizationId, {
              headerImageId: cachedHeaderImageId,
            });
          } else {
            console.warn(`[Campaign Executor] Image file not found at: ${decodedPath}`);
          }
        } else if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
          // Remote URL from another website - fetch and upload
          const imageResponse = await fetch(imageUrl);
          if (imageResponse.ok) {
            const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
            const fileName = imageUrl.split('/').pop() || 'image.jpg';
            const uploadResult = await businessAPIManager.uploadMediaWithCredentials(
              {
                phoneNumberId: creds.phoneNumberId,
                accessToken: creds.accessToken,
                businessAccountId: businessAccountId,
              },
              imageBuffer,
              fileName,
              'IMAGE',
              false // Use regular /media endpoint - media ID is used for sending, asset handles are only for template creation
            );
            cachedHeaderImageId = uploadResult.id;
            console.log(`[Campaign Executor] Successfully uploaded header image from URL, got media ID: ${cachedHeaderImageId}`);
            
            // Update campaign with the media ID for future use
            await storage.updateCampaign(campaign.id, userId, organizationId, {
              headerImageId: cachedHeaderImageId,
            });
          } else {
            console.warn(`[Campaign Executor] Failed to fetch image from URL: ${imageUrl}`);
          }
        }
      } catch (uploadError: any) {
        console.error(`[Campaign Executor] Failed to upload header image:`, uploadError.message);
        // If template requires header image, this will fail - but we'll try anyway
        // The error will be clearer when sending the message
      }
    }

    // 6.6. Upload header video ONCE if URL provided (same pattern as image)
    let cachedHeaderVideoId: string | null = campaign.headerVideoId || null;
    if (!cachedHeaderVideoId && campaign.headerVideoUrl && whatsappManager === businessAPIManager) {
      try {
        const videoUrl = campaign.headerVideoUrl;
        console.log(`[Campaign Executor] Uploading header video from URL (once): ${videoUrl}`);
        const session = await storage.getSession(campaign.sessionId);
        const creds = businessAPIManager['credentials'].get(campaign.sessionId);
        if (!creds) throw new Error('Business API credentials not available');
        const businessAccountId = session?.deviceInfo?.wabaId || creds.businessAccountId;
        const fs = await import('fs');
        const path = await import('path');
        let videoBuffer: Buffer; let fileName: string;
        let localVideoPath: string | null = null;
        if (videoUrl.startsWith('/uploads/')) {
          localVideoPath = videoUrl;
        } else if (videoUrl.startsWith('http://') || videoUrl.startsWith('https://')) {
          try {
            const url = new URL(videoUrl);
            if (url.pathname.startsWith('/uploads/')) {
              localVideoPath = url.pathname;
            }
          } catch {}
        }
        
        if (localVideoPath) {
          let decodedPath = localVideoPath;
          try { decodedPath = decodeURIComponent(localVideoPath); } catch {}
          const videoBuffer = await readUploadBuffer(decodedPath);
          if (videoBuffer) {
            const fileName = path.basename(decodedPath);
            const uploadResult = await businessAPIManager.uploadMediaWithCredentials(
              { phoneNumberId: creds.phoneNumberId, accessToken: creds.accessToken, businessAccountId },
              videoBuffer, fileName, 'VIDEO', false
            );
            cachedHeaderVideoId = uploadResult.id;
            await storage.updateCampaign(campaign.id, userId, organizationId, { headerVideoId: cachedHeaderVideoId });
          }
        } else if (videoUrl.startsWith('http://') || videoUrl.startsWith('https://')) {
          const r = await fetch(videoUrl);
          if (r.ok) {
            videoBuffer = Buffer.from(await r.arrayBuffer());
            fileName = videoUrl.split('/').pop() || 'video.mp4';
            const uploadResult = await businessAPIManager.uploadMediaWithCredentials(
              { phoneNumberId: creds.phoneNumberId, accessToken: creds.accessToken, businessAccountId },
              videoBuffer, fileName, 'VIDEO', false
            );
            cachedHeaderVideoId = uploadResult.id;
            await storage.updateCampaign(campaign.id, userId, organizationId, { headerVideoId: cachedHeaderVideoId });
          }
        }
      } catch (e: any) {
        console.error(`[Campaign Executor] Failed to upload header video:`, e.message);
      }
    }

    // 6.7. Upload header document ONCE if URL provided
    let cachedHeaderDocumentId: string | null = campaign.headerDocumentId || null;
    let cachedHeaderDocumentFilename: string | undefined;
    if (campaign.headerDocumentUrl) {
      cachedHeaderDocumentFilename = resolveWhatsAppDocumentFilename(
        undefined,
        campaign.headerDocumentUrl
      );
    }
    if (!cachedHeaderDocumentId && campaign.headerDocumentUrl && whatsappManager === businessAPIManager) {
      try {
        const docUrl = campaign.headerDocumentUrl;
        console.log(`[Campaign Executor] Uploading header document from URL (once): ${docUrl}`);
        const session = await storage.getSession(campaign.sessionId);
        const creds = businessAPIManager['credentials'].get(campaign.sessionId);
        if (!creds) throw new Error('Business API credentials not available');
        const businessAccountId = session?.deviceInfo?.wabaId || creds.businessAccountId;
        const fs = await import('fs');
        const path = await import('path');
        let docBuffer: Buffer; let fileName: string;
        let localDocPath: string | null = null;
        if (docUrl.startsWith('/uploads/')) {
          localDocPath = docUrl;
        } else if (docUrl.startsWith('http://') || docUrl.startsWith('https://')) {
          try {
            const url = new URL(docUrl);
            if (url.pathname.startsWith('/uploads/')) {
              localDocPath = url.pathname;
            }
          } catch {}
        }
        
        if (localDocPath) {
          let decodedPath = localDocPath;
          try { decodedPath = decodeURIComponent(localDocPath); } catch {}
          const docBuffer = await readUploadBuffer(decodedPath);
          if (docBuffer) {
            const fileName = path.basename(decodedPath);
            const uploadResult = await businessAPIManager.uploadMediaWithCredentials(
              { phoneNumberId: creds.phoneNumberId, accessToken: creds.accessToken, businessAccountId },
              docBuffer, fileName, 'DOCUMENT', false
            );
            cachedHeaderDocumentId = uploadResult.id;
            await storage.updateCampaign(campaign.id, userId, organizationId, { headerDocumentId: cachedHeaderDocumentId });
          }
        } else if (docUrl.startsWith('http://') || docUrl.startsWith('https://')) {
          const r = await fetch(docUrl);
          if (r.ok) {
            docBuffer = Buffer.from(await r.arrayBuffer());
            fileName = docUrl.split('/').pop() || 'document.pdf';
            const uploadResult = await businessAPIManager.uploadMediaWithCredentials(
              { phoneNumberId: creds.phoneNumberId, accessToken: creds.accessToken, businessAccountId },
              docBuffer, fileName, 'DOCUMENT', false
            );
            cachedHeaderDocumentId = uploadResult.id;
            await storage.updateCampaign(campaign.id, userId, organizationId, { headerDocumentId: cachedHeaderDocumentId });
          }
        }
      } catch (e: any) {
        console.error(`[Campaign Executor] Failed to upload header document:`, e.message);
      }
    }

    // 6.8. Media card carousel: validate URLs and upload header media once; reuse payload for every recipient
    let preparedCarouselSend: { cards: any[] } | undefined;
    if (whatsappManager === businessAPIManager && campaign.templateId && campaign.templateLanguage) {
      const sessionForCarousel = await storage.getSession(campaign.sessionId);
      const phoneNumberIdForTpl = sessionForCarousel?.deviceInfo?.apiPhoneNumberId;
      const userTemplatesCarousel = await storage.getMessageTemplatesByUser(
        userId,
        organizationId,
        phoneNumberIdForTpl
      );
      const dbTplCarousel = userTemplatesCarousel.find(
        (t) =>
          (t.id === campaign.templateId ||
            t.templateId === campaign.templateId ||
            t.name === campaign.messageTemplate) &&
          (t.status === 'APPROVED' || String(t.status || '').toLowerCase() === 'approved')
      );
      const tplMeta: any = dbTplCarousel?.metaData || dbTplCarousel?.metadata || {};
      const mediaCardsTpl = Array.isArray(tplMeta.mediaCards) ? tplMeta.mediaCards : [];
      const carouselTplComp = dbTplCarousel?.components?.find(
        (c: any) => String(c.type || '').toUpperCase() === 'CAROUSEL'
      );
      if (tplMeta.interactiveAction === 'MEDIA_CARD_CAROUSEL' && mediaCardsTpl.length >= 2) {
        if (!carouselTplComp?.cards || carouselTplComp.cards.length !== mediaCardsTpl.length) {
          throw new Error(
            'This media carousel template is missing WhatsApp carousel data in storage. Create the template again or run Sync Templates.'
          );
        }
        const rawUrls = campaign.carouselCardMediaUrls;
        if (!Array.isArray(rawUrls) || rawUrls.length !== mediaCardsTpl.length) {
          throw new Error(
            `This media carousel template requires ${mediaCardsTpl.length} media URL(s)—one per card—for the campaign.`
          );
        }
        const urls = rawUrls.map((u) => String(u ?? '').trim());
        if (urls.some((u) => !u)) {
          throw new Error('Each carousel card needs a selected image or video URL.');
        }
        if (!sessionForCarousel) {
          throw new Error('Session not found for carousel campaign send.');
        }
        preparedCarouselSend = await buildOfficialCarouselSendPayload(
          campaign.sessionId,
          sessionForCarousel,
          businessAPIManager,
          mediaCardsTpl,
          carouselTplComp,
          urls
        );
        console.log(
          `[Campaign Executor] Prepared carousel with ${preparedCarouselSend.cards.length} card(s) for all recipients`
        );
      }
    }

    let sessionChatsCache = await storage.getChatsBySession(campaign.sessionId);
    let sessionContactsCache = await storage.getContactsBySession(campaign.sessionId);

    const processOneRecipient = async (recipient: (typeof pendingRecipients)[number]): Promise<void> => {
      for (let attempt = 1; attempt <= CAMPAIGN_SEND_MAX_ATTEMPTS; attempt++) {
        try {
        // Format phone number for WhatsApp (must include country code)
        const phoneNumber = recipient.phoneNumber.replace(/[^\d+]/g, '');
        const formattedNumber = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;

        if (organizationId && (await isRecipientOptedOut(organizationId, formattedNumber))) {
          await storage.updateCampaignRecipientStatus(
            recipient.id,
            userId,
            organizationId,
            'failed',
            undefined,
            'Recipient has opted out'
          );
          result.failedCount++;
          return;
        }

        let sendResult: any;
        let messageBody = campaign.messageTemplate || ''; // Initialize message body
        
        // Map template parameters from campaign configuration (needed for both sending and storing)
        let templateParams: string[] = [];
        
        // Check if this is a template message campaign
        if (campaign.templateId && campaign.templateLanguage) {
          // Template message - get contact data for parameter mapping
          let contact: any = null;
          if (recipient.contactId) {
            contact = contactsById.get(recipient.contactId) ?? null;
            if (!contact) {
              try {
                contact = await storage.getManagedContact(recipient.contactId, userId, organizationId);
              } catch (error) {
                console.warn('Could not fetch contact for parameter mapping:', error);
              }
            }
          }

          // Import-and-broadcast often creates recipients with phone only (no contactId).
          // Resolve the managed contact by phone so column mappings like "name" use CSV/DB values.
          if (!contact && organizationId) {
            try {
              const digits = recipient.phoneNumber.replace(/\D/g, '');
              if (digits) {
                contact = await storage.findManagedContactByOrganizationAndPhoneDigits(organizationId, digits) ?? null;
              }
            } catch (error) {
              console.warn('Could not fetch contact by phone for parameter mapping:', error);
            }
          }
          
          // Use recipient data as fallback if contact not found
          if (!contact) {
            contact = {
              name: recipient.name,
              phoneNumber: recipient.phoneNumber,
              email: null,
              customFields: null,
            };
          }

          // Map template parameters from campaign configuration
          templateParams = [];
          if (campaign.templateParameters && Array.isArray(campaign.templateParameters)) {
            for (const paramConfig of campaign.templateParameters) {
              let value = paramConfig.fallback || '';
              
              if (paramConfig.column && contact) {
                // Get value from contact column
                if (paramConfig.column === 'name') {
                  value = contact.name || paramConfig.fallback || '';
                } else if (paramConfig.column === 'phoneNumber') {
                  value = contact.phoneNumber || paramConfig.fallback || '';
                } else if (paramConfig.column === 'email') {
                  value = contact.email || paramConfig.fallback || '';
                } else if (paramConfig.column.startsWith('customFields.')) {
                  const fieldName = paramConfig.column.replace('customFields.', '');
                  value = contact.customFields?.[fieldName] || paramConfig.fallback || '';
                }
              }
              
              templateParams.push(value);
            }
          }

          // Use cached header image ID (uploaded once before the loop)
          const headerImageId = cachedHeaderImageId;

          // Use Business API manager for template messages
          if (whatsappManager === businessAPIManager) {
            console.log(`[Campaign Executor] Sending template message to ${formattedNumber}`);
            console.log(`[Campaign Executor] Template: ${campaign.messageTemplate}, Language: ${campaign.templateLanguage}`);
            console.log(`[Campaign Executor] Template Parameters:`, templateParams);
            console.log(`[Campaign Executor] Header Image ID:`, headerImageId);
            
            // Get template body text to detect parameter format (named vs positional)
            // Also check if template requires header image
            // First try to get from database, then from Meta API
            let templateBodyText: string | undefined;
            let templateRequiresHeaderImage = false;
            let templateRequiresHeaderVideo = false;
            let templateRequiresHeaderDocument = false;
            try {
              // Try to get template from database first (will be fetched later in the code)
              const userTemplates = userTemplatesCache;
              let dbTemplate = userTemplates.find(t => 
                (t.id === campaign.templateId || 
                 t.templateId === campaign.templateId || 
                 t.name === campaign.messageTemplate) && 
                t.status === 'APPROVED'
              );
              
              if (dbTemplate?.components) {
                const bodyComponent = dbTemplate.components.find((c: any) => c.type === 'BODY');
                templateBodyText = bodyComponent?.text;
                
                const headerComponent = dbTemplate.components.find((c: any) => c.type === 'HEADER');
                if (headerComponent?.format === 'IMAGE') {
                  templateRequiresHeaderImage = true;
                  console.log(`[Campaign Executor] Template requires IMAGE header`);
                } else if (headerComponent?.format === 'VIDEO') {
                  templateRequiresHeaderVideo = true;
                  console.log(`[Campaign Executor] Template requires VIDEO header`);
                } else if (headerComponent?.format === 'DOCUMENT') {
                  templateRequiresHeaderDocument = true;
                  console.log(`[Campaign Executor] Template requires DOCUMENT header`);
                }
                
                console.log(`[Campaign Executor] Got template body text from database`);
              } else {
                // Try to fetch template from Meta API to get body text
                const session = await storage.getSession(campaign.sessionId);
                const creds = businessAPIManager['credentials'].get(campaign.sessionId);
                if (session && creds) {
                  const businessAccountId = session.deviceInfo?.wabaId || creds.businessAccountId;
                  if (businessAccountId) {
                    try {
                      const templateUrl = `https://graph.facebook.com/v23.0/${businessAccountId}/message_templates?name=${encodeURIComponent(campaign.messageTemplate)}&language=${encodeURIComponent(campaign.templateLanguage || 'en')}`;
                      const templateResponse = await fetch(templateUrl, {
                        headers: {
                          'Authorization': `Bearer ${creds.accessToken}`,
                        },
                      });
                      if (templateResponse.ok) {
                        const templateData = await templateResponse.json();
                        if (templateData.data && templateData.data.length > 0) {
                          const metaTemplate = templateData.data[0];
                          const bodyComp = metaTemplate.components?.find((c: any) => c.type === 'BODY');
                          templateBodyText = bodyComp?.text;
                          
                          const headerComp = metaTemplate.components?.find((c: any) => c.type === 'HEADER');
                          if (headerComp?.format === 'IMAGE') {
                            templateRequiresHeaderImage = true;
                            console.log(`[Campaign Executor] Template requires IMAGE header`);
                          } else if (headerComp?.format === 'VIDEO') {
                            templateRequiresHeaderVideo = true;
                            console.log(`[Campaign Executor] Template requires VIDEO header`);
                          } else if (headerComp?.format === 'DOCUMENT') {
                            templateRequiresHeaderDocument = true;
                            console.log(`[Campaign Executor] Template requires DOCUMENT header`);
                          }
                          
                          console.log(`[Campaign Executor] Fetched template body text from Meta API: ${templateBodyText?.substring(0, 100)}...`);
                        }
                      }
                    } catch (fetchError) {
                      console.warn(`[Campaign Executor] Could not fetch template body text:`, fetchError);
                    }
                  }
                }
              }
            } catch (error) {
              console.warn(`[Campaign Executor] Could not get template body text:`, error);
            }
            
            const headerVideoId = cachedHeaderVideoId;
            const headerDocumentId = cachedHeaderDocumentId;
            if (templateRequiresHeaderImage && !headerImageId) {
              throw new Error(`Template "${campaign.messageTemplate}" requires an IMAGE header, but no header image was provided. Please upload a header image for this campaign.`);
            }
            if (templateRequiresHeaderVideo && !headerVideoId) {
              throw new Error(`Template "${campaign.messageTemplate}" requires a VIDEO header. Provide headerVideoId or headerVideoUrl for this campaign.`);
            }
            if (templateRequiresHeaderDocument && !headerDocumentId) {
              throw new Error(`Template "${campaign.messageTemplate}" requires a DOCUMENT header. Provide headerDocumentId or headerDocumentUrl for this campaign.`);
            }

            let authTemplateMeta: TemplateMetaForAuth | null = null;
            try {
              const dbTplForAuth = userTemplatesCache.find(
                (t: any) =>
                  (t.id === campaign.templateId ||
                    t.templateId === campaign.templateId ||
                    t.name === campaign.messageTemplate) &&
                  (t.status === 'APPROVED' || String(t.status || '').toLowerCase() === 'approved')
              );
              if (dbTplForAuth && String(dbTplForAuth.category || '').toUpperCase() === 'AUTHENTICATION') {
                authTemplateMeta = { category: dbTplForAuth.category, components: dbTplForAuth.components };
              }
            } catch (_) {}

            const campaignWalletBilling =
              organizationId && recipient.id
                ? {
                    debitType: 'debit_campaign' as const,
                    referenceType: 'campaign_recipient',
                    referenceId: recipient.id,
                    description: `Campaign ${campaign.name} → ${formattedNumber}`,
                  }
                : undefined;

            sendResult = await businessAPIManager.sendTemplateMessage(
              campaign.sessionId,
              formattedNumber,
              campaign.messageTemplate, // Template name
              campaign.templateLanguage,
              templateParams.length > 0 ? templateParams : undefined,
              headerImageId || undefined,
              headerVideoId || undefined,
              headerDocumentId || undefined,
              templateBodyText, // Pass template body text to detect parameter format
              flowButtonForTemplateMeta(campaignTemplateMeta),
              preparedCarouselSend,
              undefined,
              undefined,
              campaign.headerDocumentUrl || undefined,
              authTemplateMeta,
              campaignWalletBilling,
              cachedHeaderDocumentFilename
            );
            
            console.log(`[Campaign Executor] Template message send result:`, {
              id: sendResult.id,
              status: sendResult.status,
              contacts: sendResult.contacts,
              warning: sendResult.warning,
            });
            
            // Check if message was actually accepted by WhatsApp
            if (!sendResult.id) {
              throw new Error('Template message was sent but WhatsApp did not return a message ID. The message may not be delivered.');
            }

            // Log important delivery information
            if (sendResult.status && sendResult.status.toLowerCase() === 'accepted') {
              console.log(`[Campaign Executor] ⚠️ Message accepted by WhatsApp API. Status: ${sendResult.status}. Delivery status will be updated via webhook.`);
              console.log(`[Campaign Executor] ⚠️ If message is not delivered, check: 1) Template approval status, 2) Phone number format, 3) Webhook configuration, 4) Recipient has not blocked the number`);
            } else if (sendResult.status && sendResult.status.toLowerCase() !== 'sent') {
              console.warn(`[Campaign Executor] ⚠️ Message status is '${sendResult.status}', which may indicate delivery issues.`);
            }
          } else {
            throw new Error('Template messages are only supported with WhatsApp Business API');
          }
        } else {
          // Regular text message - personalize template (replace {name} with recipient name if available)
          let message = campaign.messageTemplate;
          if (recipient.name) {
            message = message.replace(/{name}/gi, recipient.name);
          }

          if (whatsappManager === businessAPIManager && organizationId && recipient.id) {
            sendResult = await businessAPIManager.sendTextMessage(
              campaign.sessionId,
              formattedNumber,
              message,
              {
                walletBilling: {
                  debitType: 'debit_campaign',
                  referenceType: 'campaign_recipient',
                  referenceId: recipient.id,
                  description: `Campaign ${campaign.name} (session) → ${formattedNumber}`,
                },
              }
            );
          } else {
            sendResult = await whatsappManager.sendTextMessage(campaign.sessionId, formattedNumber, message);
          }
        }

        // Find or create chat for this recipient (reuse in-memory session caches — avoids O(n) DB reads per send)
        const chats = sessionChatsCache;
        let contactNumber = formattedNumber;
        if (!contactNumber.includes('@c.us') && !contactNumber.includes('@g.us')) {
          contactNumber = `${contactNumber}@c.us`;
        }

        let chat = chats.find((c) => {
          const chatNumber = c.contactNumber.replace('@c.us', '').replace('@g.us', '');
          const formattedClean = formattedNumber.replace('+', '');
          return chatNumber === formattedClean || c.contactNumber === contactNumber;
        });

        if (!chat) {
          let contact = sessionContactsCache.find((c) => c.number === contactNumber);

          if (!contact) {
            contact = await storage.createContact({
              sessionId: campaign.sessionId,
              name: recipient.name || formattedNumber.replace('@c.us', '').replace('+', ''),
              number: contactNumber,
              isGroup: false,
            });
            sessionContactsCache.push(contact);
          }

          const lastMessagePreview = campaign.templateId
            ? `Template: ${campaign.messageTemplate}`
            : campaign.messageTemplate || '';

          chat = await storage.createChat({
            sessionId: campaign.sessionId,
            contactId: contact.id,
            contactName: recipient.name || formattedNumber.replace('@c.us', '').replace('+', ''),
            contactNumber: contactNumber,
            lastMessage: lastMessagePreview.substring(0, 100),
            lastMessageTime: new Date(),
            unreadCount: 0,
            isGroup: false,
          });
          sessionChatsCache.push(chat);
        }

        // Store the message in the database
        try {
          const session = await storage.getSession(campaign.sessionId);
          const isTemplateMessage = campaign.templateId && campaign.templateLanguage;
          
          // Extract template information if this is a template message
          let templateFooter: string | null = null;
          let templateHeaderText: string | null = null;
          let templateType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | null = null;
          let messageBody = ''; // Initialize as empty, will be set from template or campaign
          let selectedTemplate: any = null; // Store template for later use
          let extractedButtons: any[] = []; // Store buttons from template
          
          if (isTemplateMessage && session?.connectionType === 'official') {
            try {
              // Get credentials for fetching template from Meta if needed
              const creds = businessAPIManager['credentials'].get(campaign.sessionId);
              
              const userTemplates = userTemplatesCache;
              console.log(`[Campaign Executor] Looking for template ID: ${campaign.templateId}, found ${userTemplates.length} templates`);
              
              // Try to find template by database ID first
              selectedTemplate = userTemplates.find(t => t.id === campaign.templateId && t.status === 'APPROVED');
              
              // If not found by ID, try to find by templateId field (Meta template ID)
              if (!selectedTemplate) {
                selectedTemplate = userTemplates.find(t => 
                  t.templateId === campaign.templateId && t.status === 'APPROVED'
                );
              }
              
              // If not found by ID, try to find by name (campaign.messageTemplate might be the template name)
              if (!selectedTemplate && campaign.messageTemplate) {
                selectedTemplate = userTemplates.find(t => 
                  (t.name === campaign.messageTemplate || t.templateId === campaign.messageTemplate) && 
                  t.status === 'APPROVED'
                );
                if (selectedTemplate) {
                  console.log(`[Campaign Executor] Found template by name: ${selectedTemplate.name}`);
                }
              }
              
              // If still not found and we have credentials, try to fetch from Meta API
              if (!selectedTemplate && creds && session?.deviceInfo?.wabaId) {
                console.log(`[Campaign Executor] Template not in database, fetching from Meta API...`);
                try {
                  const metaTemplates = await businessAPIManager.fetchMessageTemplates(creds, session.deviceInfo.wabaId);
                  // Try to find by name (campaign.messageTemplate is the template name used for sending)
                  const metaTemplate = metaTemplates.find((t: any) => 
                    t.name === campaign.messageTemplate || 
                    t.id === campaign.templateId ||
                    String(t.id) === String(campaign.templateId)
                  );
                  
                  if (metaTemplate) {
                    console.log(`[Campaign Executor] Found template in Meta: ${metaTemplate.name}`);
                    // Convert Meta template format to our format
                    selectedTemplate = {
                      id: campaign.templateId, // Use campaign templateId as database ID
                      name: metaTemplate.name,
                      templateId: metaTemplate.id || metaTemplate.name,
                      components: metaTemplate.components || [],
                      status: metaTemplate.status || 'APPROVED',
                    };
                    
                    // Check if template has BODY parameters and ensure we have enough templateParams
                    const bodyComponent = metaTemplate.components?.find((c: any) => c.type === 'BODY');
                    if (bodyComponent?.text) {
                      const paramCount = (bodyComponent.text.match(/\{\{\d+\}\}/g) || []).length;
                      console.log(`[Campaign Executor] Template "${metaTemplate.name}" has ${paramCount} BODY parameters`);
                      
                      // If template requires parameters but we don't have enough, pad with empty strings
                      if (paramCount > 0 && templateParams.length < paramCount) {
                        console.warn(`[Campaign Executor] Template requires ${paramCount} parameters but only ${templateParams.length} provided. Padding with empty strings.`);
                        while (templateParams.length < paramCount) {
                          templateParams.push('');
                        }
                      }
                    }
                  }
                } catch (metaError: any) {
                  console.warn(`[Campaign Executor] Could not fetch template from Meta:`, metaError.message);
                }
              }
              
              if (selectedTemplate) {
                console.log(`[Campaign Executor] Using template: ${selectedTemplate.name} (ID: ${selectedTemplate.id})`);
                
                // Extract footer
                const footerComponent = selectedTemplate.components?.find((c: any) => c.type === 'FOOTER');
                if (footerComponent?.text) {
                  templateFooter = footerComponent.text;
                }
                
                // Extract buttons
                const buttonsComponent = selectedTemplate.components?.find((c: any) => c.type === 'BUTTONS');
                if (buttonsComponent?.buttons && Array.isArray(buttonsComponent.buttons)) {
                  extractedButtons = buttonsComponent.buttons.map((btn: any) => ({
                    type: btn.type || 'QUICK_REPLY',
                    text: btn.text || '',
                    url: btn.url || null,
                    phoneNumber: btn.phone_number || btn.phoneNumber || null,
                  }));
                  console.log(`[Campaign Executor] Extracted ${extractedButtons.length} buttons from template`);
                }
                
                // Extract header
                const headerComponent = selectedTemplate.components?.find((c: any) => c.type === 'HEADER');
                if (headerComponent) {
                  templateType = (headerComponent.format || 'TEXT') as 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
                  if (headerComponent.format === 'TEXT' && headerComponent.text) {
                    templateHeaderText = headerComponent.text;
                    // Replace header parameters if any
                    if (templateParams && templateParams.length > 0) {
                      const headerParamCount = (headerComponent.text.match(/\{\{\d+\}\}/g) || []).length;
                      const headerParams = templateParams.slice(0, headerParamCount);
                      headerParams.forEach((param, index) => {
                        templateHeaderText = templateHeaderText!.replace(new RegExp(`\\{\\{${index + 1}\\}\\}`, 'g'), param);
                      });
                    }
                  }
                }
                
                // Build message body from template components
                const bodyComponent = selectedTemplate.components?.find((c: any) => c.type === 'BODY');
                if (bodyComponent?.text) {
                  let bodyText = bodyComponent.text;
                  // Replace template parameters
                  if (templateParams && templateParams.length > 0) {
                    templateParams.forEach((param, index) => {
                      bodyText = bodyText.replace(new RegExp(`\\{\\{${index + 1}\\}\\}`, 'g'), param || `{{${index + 1}}}`);
                    });
                  }
                  messageBody = bodyText;
                  console.log(`[Campaign Executor] Extracted message body from template: ${messageBody.substring(0, 50)}...`);
                } else {
                  // Template found but no BODY component - construct a message from other components
                  console.warn(`[Campaign Executor] Template ${selectedTemplate.name} has no BODY component`);
                  // Try to construct message from header + footer
                  const parts: string[] = [];
                  if (templateHeaderText) parts.push(templateHeaderText);
                  if (templateFooter) parts.push(templateFooter);
                  messageBody = parts.length > 0 ? parts.join('\n\n') : `Template message: ${selectedTemplate.name}`;
                }
              } else {
                // Template not found in database - try to fetch from Meta API as last resort
                console.warn(`[Campaign Executor] Template not found in database. Trying to fetch from Meta API...`);
                
                if (creds && session?.deviceInfo?.wabaId && campaign.messageTemplate) {
                  try {
                    const metaTemplates = await businessAPIManager.fetchMessageTemplates(creds, session.deviceInfo.wabaId);
                    const metaTemplate = metaTemplates.find((t: any) => 
                      t.name === campaign.messageTemplate || 
                      String(t.id) === String(campaign.templateId)
                    );
                    
                    if (metaTemplate) {
                      console.log(`[Campaign Executor] Found template in Meta API: ${metaTemplate.name}`);
                      // Extract body from Meta template
                      const bodyComponent = metaTemplate.components?.find((c: any) => c.type === 'BODY');
                      if (bodyComponent?.text) {
                        let bodyText = bodyComponent.text;
                        // Replace template parameters
                        if (templateParams && templateParams.length > 0) {
                          templateParams.forEach((param, index) => {
                            bodyText = bodyText.replace(new RegExp(`\\{\\{${index + 1}\\}\\}`, 'g'), param || `{{${index + 1}}}`);
                          });
                        }
                        messageBody = bodyText;
                        console.log(`[Campaign Executor] Extracted message body from Meta template: ${messageBody.substring(0, 50)}...`);
                        
                        // Also extract footer, buttons, and header for completeness
                        const footerComponent = metaTemplate.components?.find((c: any) => c.type === 'FOOTER');
                        if (footerComponent?.text) {
                          templateFooter = footerComponent.text;
                        }
                        
                        // Extract buttons from Meta template
                        const buttonsComponent = metaTemplate.components?.find((c: any) => c.type === 'BUTTONS');
                        if (buttonsComponent?.buttons && Array.isArray(buttonsComponent.buttons)) {
                          extractedButtons = buttonsComponent.buttons.map((btn: any) => ({
                            type: btn.type || 'QUICK_REPLY',
                            text: btn.text || '',
                            url: btn.url || null,
                            phoneNumber: btn.phone_number || btn.phoneNumber || null,
                          }));
                          console.log(`[Campaign Executor] Extracted ${extractedButtons.length} buttons from Meta template`);
                        }
                        
                        const headerComponent = metaTemplate.components?.find((c: any) => c.type === 'HEADER');
                        if (headerComponent) {
                          templateType = (headerComponent.format || 'TEXT') as 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
                          if (headerComponent.format === 'TEXT' && headerComponent.text) {
                            templateHeaderText = headerComponent.text;
                            if (templateParams && templateParams.length > 0) {
                              const headerParamCount = (headerComponent.text.match(/\{\{\d+\}\}/g) || []).length;
                              const headerParams = templateParams.slice(0, headerParamCount);
                              headerParams.forEach((param, index) => {
                                templateHeaderText = templateHeaderText!.replace(new RegExp(`\\{\\{${index + 1}\\}\\}`, 'g'), param);
                              });
                            }
                          }
                        }
                      } else {
                        console.warn(`[Campaign Executor] Meta template ${metaTemplate.name} has no BODY component`);
                        messageBody = `Template message: ${metaTemplate.name}`;
                      }
                    } else {
                      console.error(`[Campaign Executor] Template "${campaign.messageTemplate}" not found in Meta API either`);
                      messageBody = `Template message sent (Template: ${campaign.messageTemplate})`;
                    }
                  } catch (metaError: any) {
                    console.error(`[Campaign Executor] Error fetching template from Meta API:`, metaError.message);
                    messageBody = `Template message sent (Template: ${campaign.messageTemplate})`;
                  }
                } else {
                  // No credentials or template name - use generic message
                  console.error(`[Campaign Executor] Template with ID ${campaign.templateId} not found. Available templates:`, 
                    userTemplates.map(t => `${t.name} (${t.id})`).join(', ') || 'none');
                  messageBody = `Template message sent (Template: ${campaign.messageTemplate || campaign.templateId})`;
                }
              }
            } catch (error: any) {
              console.error(`[Campaign Executor] Could not extract template information:`, error.message);
              // Don't use campaign.messageTemplate as fallback - it might be the template name
              messageBody = `Template message sent (Error: ${error.message})`;
            }
          } else if (!isTemplateMessage) {
            // For regular messages, use the personalized message
            messageBody = campaign.messageTemplate || '';
            if (recipient.name) {
              messageBody = messageBody.replace(/{name}/gi, recipient.name);
            }
          } else {
            // Template message but not official connection type - use campaign messageTemplate
            messageBody = campaign.messageTemplate || '';
          }
          
          // Ensure messageBody is not empty
          if (!messageBody || messageBody.trim() === '') {
            messageBody = campaign.messageTemplate || 'Message sent';
          }

          // Get media URL if template has image or video header (for inbox display)
          let mediaUrl: string | null = null;
          if (isTemplateMessage) {
            if (templateType === 'VIDEO' && campaign.headerVideoUrl) {
              mediaUrl = campaign.headerVideoUrl;
            } else if ((templateType === 'IMAGE' || !templateType) && campaign.headerImageUrl) {
              mediaUrl = campaign.headerImageUrl;
            }
          }

          // Log the message body before storing
          console.log(`[Campaign Executor] Storing message with body: "${messageBody.substring(0, 100)}${messageBody.length > 100 ? '...' : ''}"`);

          // Prepare button data for storage
          let footerButtonType: 'NONE' | 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | null = null;
          let footerButtonText: string | null = null;
          let footerButtonUrl: string | null = null;
          let footerButtonPhone: string | null = null;
          
          if (extractedButtons.length > 0) {
            // Store buttons as JSON array in footerButtonText
            footerButtonText = JSON.stringify(extractedButtons);
            // Set button type based on first button (for backward compatibility)
            footerButtonType = extractedButtons[0].type as 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
            // For single button, also set individual fields (backward compatibility)
            if (extractedButtons.length === 1) {
              footerButtonUrl = extractedButtons[0].url || null;
              footerButtonPhone = extractedButtons[0].phoneNumber || null;
            }
            console.log(`[Campaign Executor] Storing ${extractedButtons.length} buttons with message`);
          }

          const storedMessage = await storage.createMessage({
            sessionId: campaign.sessionId,
            chatId: chat.id,
            campaignId: campaign.id,
            body: messageBody,
            fromMe: true,
            type: isTemplateMessage ? 'template' : 'text',
            status: 'sent',
            mediaUrl: mediaUrl,
            ...(preparedCarouselSend &&
              Array.isArray(campaign.carouselCardMediaUrls) &&
              campaign.carouselCardMediaUrls.length > 0 && {
                carouselCardMediaUrls: campaign.carouselCardMediaUrls.map((u) => String(u ?? '').trim()),
              }),
            footer: templateFooter || null,
            footerButtonType: footerButtonType,
            footerButtonText: footerButtonText,
            footerButtonUrl: footerButtonUrl,
            footerButtonPhone: footerButtonPhone,
            templateName: isTemplateMessage && selectedTemplate ? selectedTemplate.name : (campaign.messageTemplate || null),
            templateLanguage: campaign.templateLanguage || null,
            templateType: templateType,
            headerText: templateHeaderText,
            templateParams: campaign.templateParameters ? JSON.stringify(campaign.templateParameters) : null,
            whatsappMessageId: sendResult.id || null,
            sentAt: new Date(),
          });

          // Store WhatsApp message ID mapping for Business API status updates
          if (session?.connectionType === 'official' && sendResult.id) {
            businessAPIManager.storeMessageMapping(sendResult.id, storedMessage.id, campaign.sessionId);
          }

          // Update chat's last message - use the actual message body, not template name
          await storage.updateChat(chat.id, {
            lastMessage: messageBody.substring(0, 100), // Truncate for display
            lastMessageTime: new Date(),
          });

          console.log(`[Campaign Executor] Stored message in database for ${formattedNumber} with body: "${messageBody.substring(0, 50)}..."`);
        } catch (storeError: any) {
          console.error(`[Campaign Executor] Failed to store message in database:`, storeError);
          // Don't fail the campaign if message storage fails - message was already sent
        }

        // Update recipient status to 'sent'
        await storage.updateCampaignRecipientStatus(
          recipient.id,
          userId,
          organizationId,
          'sent',
          sendResult.id || undefined
        );

        result.sentCount++;

        messageActivityPending++;

        sinceProgressFlush++;
        if (sinceProgressFlush >= PROGRESS_FLUSH_EVERY) {
          await flushCampaignProgress();
        }
        return;
      } catch (error: any) {
        const errMsg = String(error?.message || 'Send failed');
        if (attempt < CAMPAIGN_SEND_MAX_ATTEMPTS && isMetaThrottleError(errMsg)) {
          sendRateLimiter.triggerThrottleCooldown();
          const backoff = Math.min(15_000, 800 * 2 ** (attempt - 1));
          console.warn(
            `[Campaign Executor] Meta throttle for ${recipient.phoneNumber} (attempt ${attempt}/${CAMPAIGN_SEND_MAX_ATTEMPTS}), retry in ${backoff}ms: ${errMsg.slice(0, 160)}`
          );
          await sleepMs(backoff);
          continue;
        }

        if (isMetaThrottleError(errMsg)) {
          sendRateLimiter.triggerThrottleCooldown();
        }

        console.error(`Failed to send message to ${recipient.phoneNumber}:`, error);

        // Update recipient status to 'failed'
        await storage.updateCampaignRecipientStatus(
          recipient.id,
          userId,
          organizationId,
          'failed',
          undefined,
          errMsg.slice(0, 2000)
        );

        result.failedCount++;
        result.errors.push(`${recipient.phoneNumber}: ${error.message}`);

        sinceProgressFlush++;
        if (sinceProgressFlush >= PROGRESS_FLUSH_EVERY) {
          await flushCampaignProgress();
        }
        return;
      }
    }
    };

    let processedSinceChunkPause = 0;

    for (let i = 0; i < pendingRecipients.length; i += sendConcurrency) {
      if (i > 0 && minIntervalMs > 0) {
        await sendRateLimiter.waitForBatch();
      }
      const batch = pendingRecipients.slice(i, i + sendConcurrency);
      await Promise.all(batch.map((r) => processOneRecipient(r)));
      processedSinceChunkPause += batch.length;
      if (
        chunkPauseEvery > 0 &&
        chunkPauseMs > 0 &&
        processedSinceChunkPause >= chunkPauseEvery &&
        i + sendConcurrency < pendingRecipients.length
      ) {
        console.log(
          `[Campaign Executor] Chunk cooldown after ${processedSinceChunkPause} recipient(s) — sleeping ${chunkPauseMs}ms`
        );
        await sleepMs(chunkPauseMs);
        processedSinceChunkPause = 0;
      }
    }

    await flushMessageActivity();

    // 7. Update campaign final status and counts
    const finalStatus = result.failedCount === pendingRecipients.length ? 'failed' : 'completed';
    await storage.updateCampaignExecution(campaignId, userId, organizationId, {
      status: finalStatus,
      completedAt: new Date(),
      sentCount: campaign.sentCount + result.sentCount,
      failedCount: campaign.failedCount + result.failedCount,
    });

    result.success = true;

    // Prefer user-configured multi-pass retries (AiSensy-style) over the legacy one-shot auto-retry.
    if (result.failedCount > 0) {
      const scheduledConfigured = await scheduleConfiguredRetryIfNeeded(
        campaignId,
        userId,
        organizationId
      );
      if (
        !scheduledConfigured &&
        !opts.skipAutoRetrySchedule &&
        process.env.CAMPAIGN_AUTO_RETRY_FAILED !== 'false'
      ) {
        scheduleAutoRetryFailedRecipientsOnce(campaignId, userId, organizationId);
      }
    }

    return result;

  } catch (error: any) {
    console.error('[Campaign Executor] ❌ Campaign execution error:', error);
    console.error('[Campaign Executor] Error details:', {
      campaignId,
      userId,
      organizationId,
      errorMessage: error.message,
      errorStack: error.stack,
      errorName: error.name,
    });
    
    // Try to get campaign details for better error reporting
    try {
      const campaign = await storage.getCampaign(campaignId, userId, organizationId);
      if (campaign) {
        console.error('[Campaign Executor] Campaign details at failure:', {
          name: campaign.name,
          status: campaign.status,
          sessionId: campaign.sessionId,
          scheduledAt: campaign.scheduledAt?.toISOString(),
          templateId: campaign.templateId,
          totalRecipients: campaign.totalRecipients,
        });
        
        // Check session status
        const session = await storage.getSession(campaign.sessionId);
        if (session) {
          console.error('[Campaign Executor] Session details:', {
            sessionId: session.sessionId,
            status: session.status,
            connectionType: session.connectionType,
          });
        } else {
          console.error('[Campaign Executor] ⚠️  Session not found in database!');
        }
      }
    } catch (detailError) {
      console.error('[Campaign Executor] Could not fetch campaign details:', detailError);
    }

    try {
      const n = await storage.markCampaignPendingRecipientsFailed(
        campaignId,
        userId,
        organizationId,
        `Campaign interrupted: ${String(error?.message || 'unknown error').slice(0, 1800)}`
      );
      if (n > 0) {
        console.error(`[Campaign Executor] Marked ${n} pending recipient(s) as failed after execution error`);
      }
    } catch (markErr) {
      console.error('[Campaign Executor] Failed to mark pending recipients as failed:', markErr);
    }
    
    // Mark campaign as failed
    try {
      await storage.updateCampaignExecution(campaignId, userId, organizationId, {
        status: 'failed',
        completedAt: new Date(),
      });
      console.error(`[Campaign Executor] ✅ Marked campaign ${campaignId} as failed due to: ${error.message}`);
    } catch (updateError) {
      console.error('[Campaign Executor] ❌ Failed to update campaign status:', updateError);
    }

    result.errors.push(error.message);
    return result;
  }
}

const DEFAULT_AUTO_RETRY_COOLDOWN_MS = 60_000;

/** Only retry recipients that failed before Meta accepted the message (no WhatsApp message id). */
function isSendFailureRecipient(r: { status: string; messageId?: string | null }): boolean {
  return r.status === 'failed' && !r.messageId;
}

function retryStepDelayMs(step: { hours?: number; minutes?: number } | null | undefined): number {
  const hours = Math.max(0, Number(step?.hours) || 0);
  const minutes = Math.max(0, Number(step?.minutes) || 0);
  return (hours * 60 + minutes) * 60_000;
}

/**
 * If the campaign has user-configured retry steps remaining and failed send recipients,
 * schedule the next durable retry via retryNextAt. Returns true when a configured retry was scheduled.
 */
async function scheduleConfiguredRetryIfNeeded(
  campaignId: string,
  userId: string,
  organizationId: string
): Promise<boolean> {
  const campaign = await storage.getCampaign(campaignId, userId, organizationId);
  if (!campaign?.retryEnabled) return false;

  const steps = Array.isArray(campaign.retrySteps) ? campaign.retrySteps : [];
  const nextIndex = Number(campaign.retryAttemptCount) || 0;
  if (nextIndex >= steps.length || nextIndex >= 3) return false;

  const recipients = await storage.getCampaignRecipients(campaignId, userId, organizationId);
  const failed = recipients.filter(isSendFailureRecipient);
  if (failed.length === 0) {
    console.log(
      `[Campaign Retry] ${campaignId}: configured retry enabled but no send-failure recipients — not scheduling`
    );
    return true; // still "handled" so we don't fire legacy one-shot retry
  }

  const delayMs = retryStepDelayMs(steps[nextIndex]);
  if (delayMs <= 0) return false;

  const nextAt = new Date(Date.now() + delayMs);
  await storage.scheduleCampaignConfiguredRetry(campaignId, userId, organizationId, nextAt);
  console.log(
    `[Campaign Retry] ${campaignId}: scheduled retry #${nextIndex + 1}/${steps.length} for ${failed.length} recipient(s) at ${nextAt.toISOString()}`
  );
  return true;
}

/** Run one due configured retry pass (called from scheduler). */
export async function runConfiguredCampaignRetry(campaignId: string): Promise<void> {
  const claimed = await storage.claimDueCampaignRetry(campaignId);
  if (!claimed) return;

  const userId = claimed.userId;
  const organizationId = claimed.organizationId || '';
  const recipients = await storage.getCampaignRecipients(campaignId, userId, organizationId);
  const failed = recipients.filter(isSendFailureRecipient);
  if (failed.length === 0) {
    console.log(`[Campaign Retry] ${campaignId}: claimed retry but no send-failures left — skipping`);
    return;
  }

  console.log(
    `[Campaign Retry] ${campaignId}: starting configured retry #${claimed.retryAttemptCount} for ${failed.length} recipient(s)`
  );

  for (const r of failed) {
    await storage.updateCampaignRecipientStatus(r.id, userId, organizationId, 'pending');
  }

  try {
    const { enqueueCampaignExecution } = await import('./execution-queue');
    await enqueueCampaignExecution(campaignId, userId, organizationId, {
      skipAutoRetrySchedule: true,
    });
    console.log(`[Campaign Retry] ${campaignId}: configured retry pass finished`);
  } catch (err: any) {
    console.error(`[Campaign Retry] ${campaignId}: retry execute failed:`, err?.message || err);
  }
}

function scheduleAutoRetryFailedRecipientsOnce(
  campaignId: string,
  userId: string,
  organizationId: string
): void {
  if (process.env.CAMPAIGN_AUTO_RETRY_FAILED === 'false') return;
  setImmediate(() => {
    void runAutoRetryFailedRecipientsOnce(campaignId, userId, organizationId).catch((err) =>
      console.error('[Campaign Auto-Retry] Unhandled error:', err)
    );
  });
}

async function runAutoRetryFailedRecipientsOnce(
  campaignId: string,
  userId: string,
  organizationId: string
): Promise<void> {
  const rawCooldown = process.env.CAMPAIGN_AUTO_RETRY_FAILED_COOLDOWN_MS;
  const cooldownMs =
    rawCooldown !== undefined && String(rawCooldown).trim() !== ''
      ? Math.max(0, Math.min(300_000, parseInt(String(rawCooldown).trim(), 10) || 0))
      : DEFAULT_AUTO_RETRY_COOLDOWN_MS;

  const claimed = await storage.claimCampaignFailedAutoRetry(campaignId, userId, organizationId);
  if (!claimed) {
    return;
  }

  if (cooldownMs > 0) {
    await new Promise<void>((r) => setTimeout(r, cooldownMs));
  }

  const recipients = await storage.getCampaignRecipients(campaignId, userId, organizationId);
  const failed = recipients.filter(isSendFailureRecipient);
  if (failed.length === 0) {
    console.log(`[Campaign Auto-Retry] ${campaignId}: no send-failure recipients after cooldown — skipping send pass`);
    return;
  }

  console.log(
    `[Campaign Auto-Retry] ${campaignId}: one-time retry for ${failed.length} failed recipient(s) (background)`
  );

  for (const r of failed) {
    await storage.updateCampaignRecipientStatus(r.id, userId, organizationId, 'pending');
  }

  try {
    const { enqueueCampaignExecution } = await import('./execution-queue');
    await enqueueCampaignExecution(campaignId, userId, organizationId, {
      skipAutoRetrySchedule: true,
    });
    console.log(`[Campaign Auto-Retry] ${campaignId}: background retry pass finished`);
  } catch (err: any) {
    console.error(`[Campaign Auto-Retry] ${campaignId}: retry execute failed:`, err?.message || err);
  }
}

