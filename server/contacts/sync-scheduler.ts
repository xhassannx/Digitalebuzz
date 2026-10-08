import { storage } from "../storage";

// Helper function to normalize phone numbers for comparison
function normalizePhoneNumber(phoneNumber: string): string {
  // Remove @c.us, @g.us suffixes and any + prefix
  return phoneNumber.replace('@c.us', '').replace('@g.us', '').replace(/^\+/, '').trim();
}

/**
 * Sync managed contacts from chats
 * This ensures all contacts that appear in /chat are also in /contacts
 */
async function syncContactsFromChats(): Promise<void> {
  try {
    console.log('[Contacts Sync Scheduler] Starting background sync...');
    
    // Get all users (we'll sync for all users)
    // Note: In a multi-tenant system, we might want to get all organizations instead
    const allSessions = await storage.getAllSessions();
    
    // Group sessions by userId and organizationId
    const sessionsByUser = new Map<string, Array<{ userId: string; organizationId: string | null; sessionId: string }>>();
    
    type SessionGroup = { userId: string; organizationId: string | null; sessionId: string };
    for (const session of allSessions) {
      const orgId = (session as { organizationId?: string | null }).organizationId ?? null;
      const key = `${session.userId}\0${orgId ?? 'none'}`;
      if (!sessionsByUser.has(key)) {
        sessionsByUser.set(key, []);
      }
      sessionsByUser.get(key)!.push({
        userId: session.userId,
        organizationId: orgId,
        sessionId: session.sessionId,
      } as SessionGroup);
    }
    
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    
    // Process each user/organization combination (Array.from avoids downlevelIteration)
    for (const [, sessions] of Array.from(sessionsByUser.entries())) {
      // Use first session's userId/organizationId (all in group are same). Do NOT parse from key:
      // key contains UUIDs with dashes, so split('-') would break and produce invalid userId.
      const userId = sessions[0].userId;
      const organizationId = sessions[0].organizationId;
      
      try {
        // Skip if user no longer exists (e.g. deleted) to avoid FK violation
        const user = await storage.getUser(userId);
        if (!user) {
          console.warn('[Contacts Sync Scheduler] Skipping sessions for non-existent user:', userId);
          continue;
        }
        
        // Get existing managed contacts for this user/organization (storage expects string; use '' for no org)
        const orgIdForStorage = organizationId ?? '';
        const existingManagedContacts = await storage.getManagedContactsByUser(userId, orgIdForStorage);
        const managedContactsByPhone = new Map<string, typeof existingManagedContacts[0]>();
        
        // Index managed contacts by normalized phone number
        existingManagedContacts.forEach(mc => {
          const normalizedPhone = mc.phoneNumber.replace(/[^\d]/g, '');
          if (!managedContactsByPhone.has(normalizedPhone)) {
            managedContactsByPhone.set(normalizedPhone, mc);
          }
        });
        
        // Process all chats from all sessions for this user
        for (const sessionInfo of sessions) {
          try {
            const chats = await storage.getChatsBySession(sessionInfo.sessionId);
            
            for (const chat of chats) {
              try {
                // Skip groups
                if (chat.isGroup) {
                  totalSkipped++;
                  continue;
                }
                
                // Normalize phone number (remove @c.us, @g.us, +, and non-digits)
                const normalizedPhone = normalizePhoneNumber(chat.contactNumber).replace(/[^\d]/g, '');
                
                if (!normalizedPhone || normalizedPhone.length < 10) {
                  totalSkipped++;
                  continue;
                }
                
                // Check if managed contact already exists
                const existingManagedContact = managedContactsByPhone.get(normalizedPhone);
                
                if (!existingManagedContact) {
                  // Create new managed contact
                  const contactName = chat.contactName && chat.contactName !== normalizedPhone
                    ? chat.contactName
                    : normalizedPhone;
                  
                  await storage.createManagedContact(
                    {
                      userId,
                      organizationId: orgIdForStorage || undefined,
                      name: contactName,
                      phoneNumber: normalizedPhone,
                      source: "whatsapp",
                    },
                    { skipAutomation: true }
                  );
                  
                  // Add to map to avoid duplicates in same sync
                  managedContactsByPhone.set(normalizedPhone, {
                    id: '', // Not needed for map lookup
                    userId,
                    organizationId: organizationId || '',
                    phoneNumber: normalizedPhone,
                    name: contactName,
                    email: null,
                    source: 'whatsapp',
                    customFields: null,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  } as any);
                  
                  totalCreated++;
                } else if (existingManagedContact.source !== 'whatsapp') {
                  // Update source to 'whatsapp' if it's different
                  await storage.updateManagedContact(
                    existingManagedContact.id,
                    userId,
                    orgIdForStorage,
                    { source: "whatsapp" },
                    { skipAutomation: true }
                  );
                  totalUpdated++;
                } else {
                  totalSkipped++;
                }
              } catch (chatError: any) {
                // Log but continue processing other chats
                console.warn('[Contacts Sync Scheduler] Error processing chat:', chat.id, chatError.message);
              }
            }
          } catch (sessionError: any) {
            // Log but continue processing other sessions
            console.warn('[Contacts Sync Scheduler] Error processing session:', sessionInfo.sessionId, sessionError.message);
          }
        }
      } catch (userError: any) {
        // Log but continue processing other users
        console.warn('[Contacts Sync Scheduler] Error processing user:', userId, userError.message);
      }
    }
    
    if (totalCreated > 0 || totalUpdated > 0) {
      console.log('[Contacts Sync Scheduler] ✅ Sync completed:', {
        created: totalCreated,
        updated: totalUpdated,
        skipped: totalSkipped,
      });
    }
  } catch (error: any) {
    console.error('[Contacts Sync Scheduler] ❌ Error in background sync:', error);
    console.error('[Contacts Sync Scheduler] Error details:', error.message, error.stack);
  }
}

/**
 * Start the contacts sync scheduler
 * Syncs contacts from chats every 5 minutes
 */
export function startContactsSyncScheduler(): void {
  try {
    console.log('[Contacts Sync Scheduler] ========================================');
    console.log('[Contacts Sync Scheduler] 🚀 Starting contacts sync scheduler');
    console.log('[Contacts Sync Scheduler] ⏰ Default sync interval: 5 minutes (override with CONTACTS_SYNC_INTERVAL_MS)');
    console.log('[Contacts Sync Scheduler] ========================================');
    
    // Run initial sync after 1 minute (to let server fully start)
    setTimeout(() => {
      syncContactsFromChats().catch(err => {
        console.error('[Contacts Sync Scheduler] ❌ Error in initial sync:', err);
      });
    }, 60000); // 1 minute delay
    
    const intervalMs = (() => {
      const raw = process.env.CONTACTS_SYNC_INTERVAL_MS;
      if (raw !== undefined && String(raw).trim() !== '') {
        const n = parseInt(String(raw).trim(), 10);
        return Number.isFinite(n) ? Math.max(60_000, Math.min(3_600_000, n)) : 300_000;
      }
      return 300_000; // unchanged default (5 min)
    })();
    console.log(`[Contacts Sync Scheduler] ⏰ Syncing every ${intervalMs}ms`);

    const intervalId = setInterval(() => {
      syncContactsFromChats().catch(err => {
        console.error('[Contacts Sync Scheduler] ❌ Error in scheduled sync:', err);
      });
    }, intervalMs);
    
    console.log('[Contacts Sync Scheduler] ✅ Scheduler started successfully');
  } catch (error: any) {
    console.error('[Contacts Sync Scheduler] ❌ CRITICAL: Failed to start scheduler:', error);
    console.error('[Contacts Sync Scheduler] Error stack:', error.stack);
  }
}
