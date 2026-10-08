// @ts-nocheck
import type { Express } from "express";
import { isAuthenticated } from "../../replitAuth";
import { resolveOrganizationContext } from "../../middleware/organization-context";
import { storage } from "../../storage";
import {
  clearPendingPhoneSelectionFromConfig,
  createOfficialSessionsForOAuthPhones,
} from "../oauth/whatsapp-oauth-phone-sessions";

const FACEBOOK_GRAPH_API_VERSION = "v23.0";
const FACEBOOK_GRAPH_API_BASE = `https://graph.facebook.com/${FACEBOOK_GRAPH_API_VERSION}`;
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;

export function registerWhatsAppBusinessRoutes(app: Express) {
  const getUserId = (req: any): string => {
    return req.user?.claims?.sub || req.userId;
  };

  // Get user's WhatsApp Business phone numbers
  app.get("/api/integrations/whatsapp-business/phone-numbers", isAuthenticated, resolveOrganizationContext, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;

      // Get ALL WhatsApp Business integrations to support multiple accounts
      const allIntegrations = await storage.getIntegrationsByUser(userId, organizationId);
      const whatsappIntegrations = allIntegrations.filter(
        (int) => int.name === "whatsapp-business" && int.status === "connected" && int.credentials
      );

      if (whatsappIntegrations.length === 0) {
        return res.status(404).json({ message: "WhatsApp Business integration not found or not connected" });
      }

      // Fetch phone numbers from all integrations
      let allPhoneNumbers: any[] = [];
      
      for (const integration of whatsappIntegrations) {
        const credentials = integration.credentials as any;
        const accessToken = credentials.access_token;

        if (!accessToken) {
          console.warn(`[WhatsApp Phone Numbers] Integration ${integration.id} has no access token, skipping...`);
          continue;
        }

        console.log(`[WhatsApp Phone Numbers] Fetching phone numbers from integration ${integration.id} for user ${userId}, org ${organizationId || 'none'}`);
        console.log(`[WhatsApp Phone Numbers] Using access token: ${accessToken.substring(0, 20)}...`);
        
        let integrationPhoneNumbers: any[] = [];

        // First, try to get WABA IDs from token granular scopes (for SYSTEM_USER tokens)
        let wabaIdsFromToken: string[] = [];
        try {
          console.log(`[WhatsApp Phone Numbers] Checking token for WABA IDs in granular scopes...`);
          const debugTokenResponse = await fetch(
            `${FACEBOOK_GRAPH_API_BASE}/debug_token?input_token=${accessToken}&access_token=${FACEBOOK_APP_ID || ''}|${FACEBOOK_APP_SECRET || ''}`
          );
          if (debugTokenResponse.ok) {
            const debugData = await debugTokenResponse.json();
            if (debugData.data?.granular_scopes) {
              const seenWabaIds = new Set<string>();
              for (const scope of debugData.data.granular_scopes) {
                if (scope.scope === 'whatsapp_business_management' || scope.scope === 'whatsapp_business_messaging') {
                  if (scope.target_ids && Array.isArray(scope.target_ids)) {
                    for (const wabaId of scope.target_ids) {
                      if (!seenWabaIds.has(wabaId)) {
                        seenWabaIds.add(wabaId);
                        wabaIdsFromToken.push(wabaId);
                      }
                    }
                  }
                }
              }
              // Deduplicate WABA IDs
              wabaIdsFromToken = [...new Set(wabaIdsFromToken)];
              if (wabaIdsFromToken.length > 0) {
                console.log(`[WhatsApp Phone Numbers] Found unique WABA ID(s) in token: ${wabaIdsFromToken.join(', ')}`);
              }
            }
          }
        } catch (error) {
          console.error(`[WhatsApp Phone Numbers] Error checking token for WABA IDs:`, error);
        }

        // Approach 0: Use WABA IDs directly from token granular scopes (for SYSTEM_USER tokens)
        if (wabaIdsFromToken.length > 0) {
          console.log(`[WhatsApp Phone Numbers] Approach 0: Using WABA IDs from token granular scopes...`);
          for (const wabaId of wabaIdsFromToken) {
            try {
              console.log(`[WhatsApp Phone Numbers] Fetching phone numbers for WABA: ${wabaId}`);
              const phoneNumbersResponse = await fetch(
                `${FACEBOOK_GRAPH_API_BASE}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating&access_token=${accessToken}`
              );

              if (phoneNumbersResponse.ok) {
                const phoneNumbersData = await phoneNumbersResponse.json();
                const phoneNumbers = phoneNumbersData.data || [];
                console.log(`[WhatsApp Phone Numbers] Found ${phoneNumbers.length} phone number(s) in WABA ${wabaId}`);

                // Get WABA info for enrichment
                try {
                  const wabaInfoResponse = await fetch(
                    `${FACEBOOK_GRAPH_API_BASE}/${wabaId}?fields=id,name&access_token=${accessToken}`
                  );
                  let wabaName = wabaId;
                  if (wabaInfoResponse.ok) {
                    const wabaInfo = await wabaInfoResponse.json();
                    wabaName = wabaInfo.name || wabaId;
                  }

                  const enrichedNumbers = phoneNumbers.map((phone: any) => ({
                    ...phone,
                    wabaId: wabaId,
                    wabaName: wabaName,
                  }));

                  integrationPhoneNumbers = integrationPhoneNumbers.concat(enrichedNumbers);
                } catch (wabaInfoError) {
                  // If we can't get WABA info, still add the phone numbers
                  const enrichedNumbers = phoneNumbers.map((phone: any) => ({
                    ...phone,
                    wabaId: wabaId,
                    wabaName: wabaId,
                  }));
                  integrationPhoneNumbers = integrationPhoneNumbers.concat(enrichedNumbers);
                }
              } else {
                const errorData = await phoneNumbersResponse.json().catch(() => ({}));
                console.error(`[WhatsApp Phone Numbers] Failed to fetch phone numbers for WABA ${wabaId}:`, errorData);
              }
            } catch (error: any) {
              console.error(`[WhatsApp Phone Numbers] Error fetching phone numbers for WABA ${wabaId}:`, error);
            }
          }
        }

        // Try multiple approaches to get phone numbers (fallback for regular user tokens)
        try {
          // Approach 1: Get via business accounts
          console.log(`[WhatsApp Phone Numbers] Approach 1: Fetching business accounts...`);
          const businessAccountsResponse = await fetch(
            `${FACEBOOK_GRAPH_API_BASE}/me/businesses?fields=id,name&access_token=${accessToken}`
          );

          if (businessAccountsResponse.ok) {
            const businessAccountsData = await businessAccountsResponse.json();
            const businessAccounts = businessAccountsData.data || [];
            console.log(`[WhatsApp Phone Numbers] Found ${businessAccounts.length} business account(s)`);

            // Get phone numbers from each business account
            for (const businessAccount of businessAccounts) {
              try {
                console.log(`[WhatsApp Phone Numbers] Fetching WABAs for business account: ${businessAccount.name} (${businessAccount.id})`);
                // Get WhatsApp Business Accounts
                const wabaResponse = await fetch(
                  `${FACEBOOK_GRAPH_API_BASE}/${businessAccount.id}/owned_whatsapp_business_accounts?fields=id,name&access_token=${accessToken}`
                );

                if (wabaResponse.ok) {
                  const wabaData = await wabaResponse.json();
                  const wabaAccounts = wabaData.data || [];
                  console.log(`[WhatsApp Phone Numbers] Found ${wabaAccounts.length} WABA(s) for business ${businessAccount.id}`);

                  // Get phone numbers from each WABA
                  for (const waba of wabaAccounts) {
                    console.log(`[WhatsApp Phone Numbers] Fetching phone numbers for WABA: ${waba.name} (${waba.id})`);
                    const phoneNumbersResponse = await fetch(
                      `${FACEBOOK_GRAPH_API_BASE}/${waba.id}/phone_numbers?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating&access_token=${accessToken}`
                    );

                    if (phoneNumbersResponse.ok) {
                      const phoneNumbersData = await phoneNumbersResponse.json();
                      const phoneNumbers = phoneNumbersData.data || [];
                      console.log(`[WhatsApp Phone Numbers] Found ${phoneNumbers.length} phone number(s) in WABA ${waba.id}`);

                      // Enrich with business account and WABA info
                      const enrichedNumbers = phoneNumbers.map((phone: any) => ({
                        ...phone,
                        businessAccountId: businessAccount.id,
                        businessAccountName: businessAccount.name,
                        wabaId: waba.id,
                        wabaName: waba.name,
                      }));

                      integrationPhoneNumbers = integrationPhoneNumbers.concat(enrichedNumbers);
                    } else {
                      const errorData = await phoneNumbersResponse.json().catch(() => ({}));
                      console.error(`[WhatsApp Phone Numbers] Failed to fetch phone numbers for WABA ${waba.id}:`, errorData);
                    }
                  }
                } else {
                  const errorData = await wabaResponse.json().catch(() => ({}));
                  console.error(`[WhatsApp Phone Numbers] Failed to fetch WABAs for business ${businessAccount.id}:`, errorData);
                }
              } catch (error: any) {
                console.error(`[WhatsApp Phone Numbers] Error fetching phone numbers for business account ${businessAccount.id}:`, error);
              }
            }
          } else {
            const errorData = await businessAccountsResponse.json().catch(() => ({}));
            console.error("[WhatsApp Phone Numbers] Failed to fetch business accounts:", errorData);
            console.error("[WhatsApp Phone Numbers] Response status:", businessAccountsResponse.status, businessAccountsResponse.statusText);
          }
        } catch (error: any) {
          console.error("Error in business accounts approach:", error);
        }

        // Approach 2: Try direct WABA access if business accounts didn't work
        if (integrationPhoneNumbers.length === 0) {
        console.log(`[WhatsApp Phone Numbers] Approach 2: Trying direct WABA access...`);
        try {
          // Try to get WABAs directly
          const wabaDirectResponse = await fetch(
            `${FACEBOOK_GRAPH_API_BASE}/me/owned_whatsapp_business_accounts?fields=id,name&access_token=${accessToken}`
          );

          if (wabaDirectResponse.ok) {
            const wabaDirectData = await wabaDirectResponse.json();
            const wabaAccounts = wabaDirectData.data || [];
            console.log(`[WhatsApp Phone Numbers] Found ${wabaAccounts.length} WABA(s) via direct access`);

            for (const waba of wabaAccounts) {
              console.log(`[WhatsApp Phone Numbers] Fetching phone numbers for WABA: ${waba.name} (${waba.id})`);
              const phoneNumbersResponse = await fetch(
                `${FACEBOOK_GRAPH_API_BASE}/${waba.id}/phone_numbers?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating&access_token=${accessToken}`
              );

              if (phoneNumbersResponse.ok) {
                const phoneNumbersData = await phoneNumbersResponse.json();
                const phoneNumbers = phoneNumbersData.data || [];
                console.log(`[WhatsApp Phone Numbers] Found ${phoneNumbers.length} phone number(s) in WABA ${waba.id}`);

                const enrichedNumbers = phoneNumbers.map((phone: any) => ({
                  ...phone,
                  wabaId: waba.id,
                  wabaName: waba.name,
                }));

                allPhoneNumbers = allPhoneNumbers.concat(enrichedNumbers);
              } else {
                const errorData = await phoneNumbersResponse.json().catch(() => ({}));
                console.error(`[WhatsApp Phone Numbers] Failed to fetch phone numbers for WABA ${waba.id}:`, errorData);
                console.error(`[WhatsApp Phone Numbers] Response status: ${phoneNumbersResponse.status} ${phoneNumbersResponse.statusText}`);
              }
            }
          } else {
            const errorData = await wabaDirectResponse.json().catch(() => ({}));
            console.error("[WhatsApp Phone Numbers] Failed to fetch WABAs via direct access:", errorData);
            console.error(`[WhatsApp Phone Numbers] Response status: ${wabaDirectResponse.status} ${wabaDirectResponse.statusText}`);
          }
        } catch (error: any) {
          console.error("[WhatsApp Phone Numbers] Error in direct WABA approach:", error);
        }
      }

        // Approach 3: Try getting phone numbers via business manager
        if (integrationPhoneNumbers.length === 0) {
        console.log(`[WhatsApp Phone Numbers] Approach 3: Trying via business manager...`);
        try {
          // Get business manager accounts
          const businessManagerResponse = await fetch(
            `${FACEBOOK_GRAPH_API_BASE}/me?fields=businesses{id,name,owned_whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name,code_verification_status,quality_rating}}}&access_token=${accessToken}`
          );

          if (businessManagerResponse.ok) {
            const businessManagerData = await businessManagerResponse.json();
            console.log(`[WhatsApp Phone Numbers] Business manager data:`, JSON.stringify(businessManagerData, null, 2));
            
            if (businessManagerData.businesses?.data) {
              for (const business of businessManagerData.businesses.data) {
                if (business.owned_whatsapp_business_accounts?.data) {
                  for (const waba of business.owned_whatsapp_business_accounts.data) {
                    if (waba.phone_numbers?.data) {
                      const enrichedNumbers = waba.phone_numbers.data.map((phone: any) => ({
                        ...phone,
                        businessAccountId: business.id,
                        businessAccountName: business.name,
                        wabaId: waba.id,
                        wabaName: waba.name,
                      }));
                      integrationPhoneNumbers = integrationPhoneNumbers.concat(enrichedNumbers);
                      console.log(`[WhatsApp Phone Numbers] Found ${waba.phone_numbers.data.length} phone number(s) via business manager`);
                    }
                  }
                }
              }
            }
          } else {
            const errorData = await businessManagerResponse.json().catch(() => ({}));
            console.error("[WhatsApp Phone Numbers] Failed to fetch via business manager:", errorData);
            console.error(`[WhatsApp Phone Numbers] Response status: ${businessManagerResponse.status} ${businessManagerResponse.statusText}`);
          }
        } catch (error: any) {
          console.error("[WhatsApp Phone Numbers] Error in business manager approach:", error);
        }
      }

        // Approach 4: Try getting phone numbers via me/owned_whatsapp_business_accounts
        // Note: me/whatsapp_business_accounts does not exist; use owned_whatsapp_business_accounts
        if (integrationPhoneNumbers.length === 0) {
        console.log(`[WhatsApp Phone Numbers] Approach 4: Trying me/owned_whatsapp_business_accounts...`);
        try {
          const allWABAsResponse = await fetch(
            `${FACEBOOK_GRAPH_API_BASE}/me/owned_whatsapp_business_accounts?fields=id,name,phone_numbers{id,display_phone_number,verified_name,code_verification_status,quality_rating}&access_token=${accessToken}`
          );

          if (allWABAsResponse.ok) {
            const allWABAsData = await allWABAsResponse.json();
            const wabaAccounts = allWABAsData.data || [];
            console.log(`[WhatsApp Phone Numbers] Found ${wabaAccounts.length} accessible WABA(s)`);

            for (const waba of wabaAccounts) {
              if (waba.phone_numbers?.data) {
                const enrichedNumbers = waba.phone_numbers.data.map((phone: any) => ({
                  ...phone,
                  wabaId: waba.id,
                  wabaName: waba.name,
                }));
                allPhoneNumbers = allPhoneNumbers.concat(enrichedNumbers);
                console.log(`[WhatsApp Phone Numbers] Found ${waba.phone_numbers.data.length} phone number(s) in WABA ${waba.id}`);
              }
            }
          } else {
            const errorData = await allWABAsResponse.json().catch(() => ({}));
            console.error("[WhatsApp Phone Numbers] Failed to fetch all WABAs:", errorData);
            console.error(`[WhatsApp Phone Numbers] Response status: ${allWABAsResponse.status} ${allWABAsResponse.statusText}`);
          }
        } catch (error: any) {
          console.error("[WhatsApp Phone Numbers] Error in all WABAs approach:", error);
        }
      }

        // Tag each phone with integrationId so add-phone and send use the correct Meta account
        const withIntegrationId = integrationPhoneNumbers.map((p: any) => ({ ...p, integrationId: integration.id }));
        allPhoneNumbers = allPhoneNumbers.concat(withIntegrationId);
        console.log(`[WhatsApp Phone Numbers] Added ${integrationPhoneNumbers.length} phone number(s) from integration ${integration.id}`);
      }

      // Deduplicate phone numbers by their ID to avoid showing the same number twice
      const seenPhoneIds = new Map<string, any>();
      for (const phone of allPhoneNumbers) {
        const phoneId = phone.id;
        if (phoneId && !seenPhoneIds.has(phoneId)) {
          seenPhoneIds.set(phoneId, phone);
        }
      }
      allPhoneNumbers = Array.from(seenPhoneIds.values());
      
      console.log(`[WhatsApp Phone Numbers] Total unique phone numbers found from ${whatsappIntegrations.length} integration(s): ${allPhoneNumbers.length}`);

      if (allPhoneNumbers.length === 0) {
        console.warn(`[WhatsApp Phone Numbers] ⚠️  No phone numbers found. This could mean:`);
        console.warn(`  - No WhatsApp Business Account is set up in Meta Business Manager`);
        console.warn(`  - No phone numbers are registered in the WhatsApp Business Account`);
        console.warn(`  - Access token doesn't have required permissions`);
        console.warn(`  - User needs to complete the embedded signup flow to create/select a WABA`);
        
        // Try to debug token permissions
        try {
          console.log(`[WhatsApp Phone Numbers] Debug: Checking token permissions...`);
          // Use app access token for debug_token endpoint (app_id|app_secret)
          const appAccessToken = FACEBOOK_APP_ID && FACEBOOK_APP_SECRET 
            ? `${FACEBOOK_APP_ID}|${FACEBOOK_APP_SECRET}` 
            : accessToken; // Fallback to user token if app credentials not available
          const debugTokenResponse = await fetch(
            `${FACEBOOK_GRAPH_API_BASE}/debug_token?input_token=${accessToken}&access_token=${appAccessToken}`
          );
          if (debugTokenResponse.ok) {
            const debugData = await debugTokenResponse.json();
            console.log(`[WhatsApp Phone Numbers] Token debug info:`, JSON.stringify(debugData, null, 2));
            if (debugData.data) {
              console.log(`[WhatsApp Phone Numbers] Token scopes:`, debugData.data.scopes || 'not available');
              console.log(`[WhatsApp Phone Numbers] Token expires at:`, debugData.data.expires_at ? new Date(debugData.data.expires_at * 1000).toISOString() : 'not available');
              console.log(`[WhatsApp Phone Numbers] Token is valid:`, debugData.data.is_valid || false);
              if (debugData.data.error) {
                console.error(`[WhatsApp Phone Numbers] Token error:`, debugData.data.error);
              }
            }
          } else {
            const errorData = await debugTokenResponse.json().catch(() => ({}));
            console.error(`[WhatsApp Phone Numbers] Failed to debug token:`, errorData);
          }
        } catch (debugError) {
          console.error(`[WhatsApp Phone Numbers] Error debugging token:`, debugError);
        }
      }

      res.json({
        success: true,
        phoneNumbers: allPhoneNumbers,
        count: allPhoneNumbers.length,
        ...(allPhoneNumbers.length === 0 && {
          message: "No phone numbers found. Please ensure you have completed the WhatsApp Business setup in Meta Business Manager and have at least one phone number registered.",
          troubleshooting: [
            "Complete the embedded signup flow to create/select a WhatsApp Business Account",
            "Register a phone number in your WhatsApp Business Account via Meta Business Manager",
            "Ensure your access token has 'whatsapp_business_management' permission",
            "Check that your WhatsApp Business Account is properly linked to your Meta Business Manager"
          ]
        })
      });
    } catch (error: any) {
      console.error("[WhatsApp Phone Numbers] ❌ Error fetching WhatsApp Business phone numbers:", error);
      console.error("[WhatsApp Phone Numbers] Error details:", {
        message: error.message,
        stack: error.stack,
        userId,
        organizationId,
      });
      res.status(500).json({ 
        success: false,
        message: error.message || "Failed to fetch WhatsApp Business phone numbers",
        error: error.message,
        phoneNumbers: [],
        count: 0,
      });
    }
  });

  /** Any WhatsApp integrations waiting for user to choose which Meta lines to add (after multi-WABA OAuth). */
  app.get(
    "/api/integrations/whatsapp-business/whatsapp-pending-lines",
    isAuthenticated,
    resolveOrganizationContext,
    async (req: any, res) => {
      try {
        const userId = getUserId(req);
        const organizationId = req.context?.organizationId;
        const all = await storage.getIntegrationsByUser(userId, organizationId);
        const items: { integrationId: string; phones: unknown[] }[] = [];
        for (const int of all) {
          if (int.name !== "whatsapp-business") continue;
          const pending = (int.config as any)?.pendingWhatsAppPhoneSelection;
          if (pending?.phones?.length) {
            items.push({ integrationId: int.id, phones: pending.phones });
          }
        }
        res.json({ items });
      } catch (e: any) {
        console.error("[whatsapp-pending-lines]", e);
        res.status(500).json({ message: e.message || "Failed to list pending lines" });
      }
    }
  );

  /** Pending Meta lines after OAuth when multiple WABAs — user picks in Integrations (no .env). */
  app.get(
    "/api/integrations/whatsapp-business/pending-session-phones/:integrationId",
    isAuthenticated,
    resolveOrganizationContext,
    async (req: any, res) => {
      try {
        const userId = getUserId(req);
        const organizationId = req.context?.organizationId;
        const { integrationId } = req.params;
        const int = await storage.getIntegration(integrationId, userId);
        if (!int || int.name !== "whatsapp-business") {
          return res.status(404).json({ message: "Integration not found" });
        }
        if (organizationId && int.organizationId && int.organizationId !== organizationId) {
          return res.status(403).json({ message: "Forbidden" });
        }
        const pending = (int.config as any)?.pendingWhatsAppPhoneSelection;
        if (!pending?.phones?.length) {
          return res.status(404).json({ message: "No pending phone selection" });
        }
        res.json({ integrationId: int.id, phones: pending.phones });
      } catch (e: any) {
        console.error("[pending-session-phones]", e);
        res.status(500).json({ message: e.message || "Failed to load pending phones" });
      }
    }
  );

  app.post(
    "/api/integrations/whatsapp-business/confirm-pending-session-phones",
    isAuthenticated,
    resolveOrganizationContext,
    async (req: any, res) => {
      try {
        const userId = getUserId(req);
        const organizationId = req.context?.organizationId;
        const { integrationId, phoneNumberIds } = req.body || {};
        if (!integrationId || !Array.isArray(phoneNumberIds) || phoneNumberIds.length === 0) {
          return res.status(400).json({
            message: "integrationId and non-empty phoneNumberIds[] are required",
          });
        }
        const int = await storage.getIntegration(integrationId, userId);
        if (!int || int.name !== "whatsapp-business" || int.status !== "connected") {
          return res.status(404).json({ message: "Integration not found" });
        }
        if (organizationId && int.organizationId && int.organizationId !== organizationId) {
          return res.status(403).json({ message: "Forbidden" });
        }
        const creds = int.credentials as Record<string, any> | null;
        const accessToken = creds?.access_token;
        if (!accessToken) {
          return res.status(400).json({ message: "Integration has no access token; reconnect WhatsApp." });
        }
        const pending = (int.config as any)?.pendingWhatsAppPhoneSelection;
        const pendingPhones = pending?.phones as Array<{ id: string }> | undefined;
        if (!pendingPhones?.length) {
          return res.status(400).json({ message: "No pending phone selection for this integration" });
        }
        const allowed = new Set(pendingPhones.map((p) => String(p.id)));
        const ids = phoneNumberIds.map((x: unknown) => String(x));
        for (const id of ids) {
          if (!allowed.has(id)) {
            return res.status(400).json({
              message: `Phone number id ${id} is not in the pending list for this connection`,
            });
          }
        }
        const selected = pendingPhones.filter((p) => ids.includes(String(p.id)));
        await createOfficialSessionsForOAuthPhones({
          userId,
          integrationId: int.id,
          accessToken,
          phones: selected,
        });
        await storage.updateIntegration(int.id, userId, {
          config: clearPendingPhoneSelectionFromConfig(int.config as any),
        });
        res.json({ success: true, added: selected.length });
      } catch (e: any) {
        console.error("[confirm-pending-session-phones]", e);
        res.status(500).json({ message: e.message || "Failed to confirm phones" });
      }
    }
  );

  // Add phone number and create session
  app.post("/api/integrations/whatsapp-business/add-phone", isAuthenticated, resolveOrganizationContext, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      // Accept all phone number details from request body (integrationId required when multiple Meta accounts)
      const { 
        phoneNumberId, 
        businessAccountId, 
        businessAccountName,
        wabaId,
        wabaName,
        displayPhoneNumber,
        verifiedName,
        qualityRating,
        codeVerificationStatus,
        integrationId: bodyIntegrationId,
      } = req.body;

      if (!phoneNumberId) {
        return res.status(400).json({ message: "Phone Number ID is required" });
      }

      if (organizationId) {
        const { assertPlanQuota, sendPlanQuotaDenial } = await import("../../utils/plan-quotas");
        const existingOfficial = (await storage.getSessionsByOrganization(organizationId)).filter(
          (s: any) =>
            String(s.connectionType || "").toLowerCase().includes("official") ||
            !!(s.deviceInfo?.apiPhoneNumberId || s.phoneNumberId),
        );
        const alreadyLinked = existingOfficial.some(
          (s: any) => String(s.deviceInfo?.apiPhoneNumberId || s.phoneNumberId || "") === String(phoneNumberId),
        );
        if (!alreadyLinked) {
          const quota = await assertPlanQuota({ userId, organizationId, kind: "waba_numbers" });
          if (quota) return sendPlanQuotaDenial(res, quota);
        }
      }

      // Check if session already exists for this phone number (refresh path) – before calling Meta API
      // Use String() to handle string/number mismatch (Meta API may return id as string or number)
      const phoneNumberIdStr = String(phoneNumberId);
      const existingSessionsEarly = await storage.getSessionsByUser(userId);
      const existingSessionEarly = existingSessionsEarly.find(
        (s) => s.connectionType === 'official' && String(s.deviceInfo?.apiPhoneNumberId || '') === phoneNumberIdStr
      );

      if (existingSessionEarly) {
        // Restore soft-deleted session if it was removed from connect panel
        const wasDeleted = (existingSessionEarly as any).deletedAt;
        if (wasDeleted) {
          await storage.updateSession(existingSessionEarly.sessionId, {
            deletedAt: null,
            status: 'connecting',
          } as any);
        }
        // Refresh path: find which integration can access this Phone Number ID (supports multiple Meta accounts)
        const allIntegrations = await storage.getIntegrationsByUser(userId, organizationId);
        const whatsappIntegrations = allIntegrations.filter(
          (i: any) => i.name === "whatsapp-business" && i.status === "connected" && i.credentials
        );
        let integrationForRefresh: any = null;
        if (bodyIntegrationId) {
          integrationForRefresh = whatsappIntegrations.find((i: any) => i.id === bodyIntegrationId) || null;
        }
        if (!integrationForRefresh) {
          for (const int of whatsappIntegrations) {
            const creds = int.credentials as any;
            const token = creds?.access_token;
            if (!token) continue;
            try {
              const checkRes = await fetch(
                `${FACEBOOK_GRAPH_API_BASE}/${phoneNumberId}?fields=id&access_token=${encodeURIComponent(token)}`
              );
              if (checkRes.ok) {
                integrationForRefresh = int;
                console.log(`[Add Phone] Refresh: found integration ${int.id} that can access Phone Number ID ${phoneNumberId}`);
                break;
              }
            } catch (_) {
              continue;
            }
          }
        }
        if (!integrationForRefresh || !integrationForRefresh.credentials) {
          return res.status(400).json({
            message: "No connected WhatsApp Business account can access this phone number. Reconnect the Meta account that owns this number in Integrations, then try Refresh connection again.",
            error: "INTEGRATION_NOT_FOUND",
            phoneNumberId: phoneNumberId,
          });
        }
        const credsRefresh = integrationForRefresh.credentials as any;
        const accessTokenRefresh = credsRefresh.access_token;
        const finalBusinessAccountIdRefresh = businessAccountId || (existingSessionEarly.deviceInfo as any)?.businessAccountId;
        const finalDisplayPhoneNumberRefresh = displayPhoneNumber || (existingSessionEarly.deviceInfo as any)?.displayPhoneNumber || (existingSessionEarly.deviceInfo as any)?.phoneNumber;
        const finalVerifiedNameRefresh = verifiedName || (existingSessionEarly.deviceInfo as any)?.verifiedName || (existingSessionEarly.deviceInfo as any)?.name;
        const finalWabaIdRefresh = wabaId || (existingSessionEarly.deviceInfo as any)?.wabaId;
        const finalWabaNameRefresh = wabaName || (existingSessionEarly.deviceInfo as any)?.wabaName;
        const { businessAPIManager } = await import('../../whatsapp/business-api-client');
        try {
          await businessAPIManager.disconnectSession(existingSessionEarly.sessionId);
        } catch (_) {}
        await storage.updateSession(existingSessionEarly.sessionId, {
          status: 'connecting',
          deviceInfo: {
            ...(existingSessionEarly.deviceInfo || {}),
            platform: 'WhatsApp Business API',
            phoneNumber: finalDisplayPhoneNumberRefresh,
            displayPhoneNumber: finalDisplayPhoneNumberRefresh,
            name: finalVerifiedNameRefresh || 'Business Account',
            verifiedName: finalVerifiedNameRefresh,
            apiPhoneNumberId: phoneNumberId,
            businessAccountId: finalBusinessAccountIdRefresh,
            businessAccountName: businessAccountName,
            wabaId: finalWabaIdRefresh,
            wabaName: finalWabaNameRefresh,
            integrationId: integrationForRefresh.id,
          },
        });
        await businessAPIManager.createSession(existingSessionEarly.sessionId, {
          phoneNumberId: phoneNumberId,
          accessToken: accessTokenRefresh,
          businessAccountId: finalBusinessAccountIdRefresh,
        });
        return res.status(200).json({
          message: "Session already existed; connection refreshed with current WhatsApp Business account.",
          sessionId: existingSessionEarly.sessionId,
          refreshed: true,
        });
      }

      // New-add path: use the integration that owns this phone (required when multiple Meta accounts)
      let integration;
      if (bodyIntegrationId) {
        integration = await storage.getIntegration(bodyIntegrationId, userId);
        if (!integration) {
          return res.status(404).json({ message: "Integration not found. Use the integration that owns this phone number." });
        }
        if (integration.name !== "whatsapp-business") {
          return res.status(400).json({ message: "Integration is not a WhatsApp Business integration" });
        }
      } else {
        integration = await storage.getIntegrationByName("whatsapp-business", userId, organizationId);
      }

      if (!integration || integration.status !== "connected" || !integration.credentials) {
        return res.status(404).json({ message: "WhatsApp Business integration not found or not connected" });
      }

      const credentials = integration.credentials as any;
      const accessToken = credentials.access_token;

      const phoneResponse = await fetch(
        `${FACEBOOK_GRAPH_API_BASE}/${phoneNumberId}?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating,whatsapp_business_account{id}&access_token=${accessToken}`
      );

      if (!phoneResponse.ok) {
        const errorData = await phoneResponse.json().catch(() => ({}));
        
        // Check for account not registered error
        if (errorData.error?.code === 133010) {
          return res.status(400).json({
            message: "Phone number not registered",
            error: "ACCOUNT_NOT_REGISTERED",
            details: "The phone number is not registered with Meta. Please complete the phone number registration and verification process in Meta Business Manager first.",
            phoneNumberId: phoneNumberId,
          });
        }
        
        throw new Error(errorData.error?.message || "Failed to fetch phone number details");
      }

      const phoneData = await phoneResponse.json();
      
      // Use verification status from request body if available, otherwise from API response
      let phoneVerificationStatus = codeVerificationStatus || phoneData.code_verification_status;
      
      // Check verification status - UNVERIFIED numbers are rejected
      let status = phoneVerificationStatus || 'UNKNOWN';
      
      if (status === 'UNVERIFIED') {
        console.warn(`[Add Phone] ❌ Phone number ${phoneNumberId} is UNVERIFIED`);
        return res.status(400).json({
          message: "Phone number not verified",
          error: "PHONE_NOT_VERIFIED",
          details: `The phone number is UNVERIFIED. Please complete the phone number verification process in Meta Business Manager first. If you're using Embedded Signup, the number should auto-verify. Otherwise, verify it manually in Meta Business Manager.`,
          phoneNumberId: phoneNumberId,
          verificationStatus: status,
          helpUrl: "https://business.facebook.com/help/149790234973220",
        });
      }
      
      // CRITICAL: If PENDING, try to convert to VERIFIED by triggering connection flow
      // This simulates clicking "Generate access token" in Meta's UI
      if (status === 'PENDING') {
        console.warn(`[Add Phone] ⚠️  Phone number ${phoneNumberId} is PENDING - attempting to convert to VERIFIED...`);
        
        try {
          // Step 1: Fetch via WABA to register connection (wabaId from request body)
          if (wabaId) {
            const wabaCheckResponse = await fetch(
              `${FACEBOOK_GRAPH_API_BASE}/${wabaId}?fields=id,name,phone_numbers{id,display_phone_number,code_verification_status}&access_token=${accessToken}`
            );
            
            if (wabaCheckResponse.ok) {
              const wabaCheckData = await wabaCheckResponse.json();
              if (wabaCheckData.phone_numbers?.data) {
                const phoneInWaba = wabaCheckData.phone_numbers.data.find((p: any) => p.id === phoneNumberId);
                if (phoneInWaba && phoneInWaba.code_verification_status === 'VERIFIED') {
                  console.log(`[Add Phone] ✅ Phone number found as VERIFIED in WABA - updating status`);
                  phoneVerificationStatus = 'VERIFIED';
                  status = 'VERIFIED';
                }
              }
            }
          }
          
          // Step 2: Make a request to message templates endpoint to trigger connection
          if (status === 'PENDING') {
            const templateCheckResponse = await fetch(
              `${FACEBOOK_GRAPH_API_BASE}/${phoneNumberId}/message_templates?access_token=${accessToken}`
            );
            
            if (templateCheckResponse.ok) {
              // Re-check status after triggering connection
              const recheckResponse = await fetch(
                `${FACEBOOK_GRAPH_API_BASE}/${phoneNumberId}?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating&access_token=${accessToken}`
              );
              
              if (recheckResponse.ok) {
                const recheckData = await recheckResponse.json();
                if (recheckData.code_verification_status === 'VERIFIED') {
                  console.log(`[Add Phone] ✅ Phone number status changed to VERIFIED after connection trigger`);
                  phoneVerificationStatus = 'VERIFIED';
                  status = 'VERIFIED';
                } else {
                  phoneVerificationStatus = recheckData.code_verification_status;
                  status = recheckData.code_verification_status;
                }
              }
            }
          }
          
          // If still PENDING after all attempts, reject it to prevent messaging issues
          if (status === 'PENDING') {
            console.error(`[Add Phone] ❌ Phone number ${phoneNumberId} is still PENDING after connection attempts`);
            return res.status(400).json({
              message: "Phone number verification is PENDING",
              error: "PHONE_PENDING",
              details: `The phone number is still PENDING after connection attempts. This prevents sending messages. Please ensure:` +
                `\n1. Business verification is complete in Meta Business Manager` +
                `\n2. Phone number has been active on WhatsApp Business App for 7+ days` +
                `\n3. All business information (especially website) is complete in Meta Business Manager` +
                `\n4. Try using the Embedded Signup flow instead of manually adding numbers`,
              phoneNumberId: phoneNumberId,
              verificationStatus: status,
              helpUrl: "https://business.facebook.com/help/149790234973220",
            });
          }
        } catch (pendingError: any) {
          console.error(`[Add Phone] Error attempting to convert PENDING to VERIFIED:`, pendingError.message);
          // Reject PENDING numbers to prevent messaging issues
          return res.status(400).json({
            message: "Phone number verification is PENDING",
            error: "PHONE_PENDING",
            details: `The phone number is PENDING and cannot be added. This prevents sending messages. Please ensure:` +
              `\n1. Business verification is complete in Meta Business Manager` +
              `\n2. Phone number has been active on WhatsApp Business App for 7+ days` +
              `\n3. All business information (especially website) is complete in Meta Business Manager` +
              `\n4. Try using the Embedded Signup flow instead of manually adding numbers`,
            phoneNumberId: phoneNumberId,
            verificationStatus: status,
            helpUrl: "https://business.facebook.com/help/149790234973220",
          });
        }
      }
      
      // Only allow VERIFIED numbers to proceed
      if (status !== 'VERIFIED') {
        console.warn(`[Add Phone] ❌ Phone number ${phoneNumberId} has status "${status}" - only VERIFIED numbers can be added`);
        return res.status(400).json({
          message: "Phone number verification status is not VERIFIED",
          error: "PHONE_NOT_VERIFIED",
          details: `The phone number has status "${status}" (expected VERIFIED). Please verify the phone number in Meta Business Manager first.`,
          phoneNumberId: phoneNumberId,
          verificationStatus: status,
          helpUrl: "https://business.facebook.com/help/149790234973220",
        });
      }
      
      console.log(`[Add Phone] ✅ Phone number ${phoneNumberId} is VERIFIED - proceeding with addition`);
      const graphWabaId = phoneData.whatsapp_business_account?.id as string | undefined;
      const finalBusinessAccountId =
        businessAccountId || phoneData.business_account_id || graphWabaId;
      const finalWabaId = wabaId || graphWabaId;
      const finalDisplayPhoneNumber = displayPhoneNumber || phoneData.display_phone_number;
      const finalVerifiedName = verifiedName || phoneData.verified_name;
      const finalQualityRating = qualityRating || phoneData.quality_rating?.overall_status || phoneData.quality_rating;
      const finalCodeVerificationStatus = codeVerificationStatus || phoneData.code_verification_status;

      // Check if session already exists for this phone number (reconnect after delete)
      const existingSessions = await storage.getSessionsByUser(userId);
      const existingSession = existingSessions.find(
        (s) => s.connectionType === 'official' && 
        String(s.deviceInfo?.apiPhoneNumberId || '') === phoneNumberIdStr
      );

      const { businessAPIManager } = await import('../../whatsapp/business-api-client');

      if (existingSession) {
        // Reconnect scenario: same phone was re-added (or was soft-deleted from connect panel).
        // Refresh the existing session and restore chat history by clearing deletedAt.
        try {
          await businessAPIManager.disconnectSession(existingSession.sessionId);
        } catch (_) {
          // Session may not be in memory (e.g. after server restart)
        }
        const prevInfo = existingSession.deviceInfo || {};
        await storage.updateSession(existingSession.sessionId, {
          status: 'connecting',
          deletedAt: null,
          organizationId: organizationId || existingSession.organizationId || undefined,
          deviceInfo: {
            ...prevInfo,
            platform: 'WhatsApp Business API',
            phoneNumber: finalDisplayPhoneNumber,
            displayPhoneNumber: finalDisplayPhoneNumber,
            name: finalVerifiedName || 'Business Account',
            verifiedName: finalVerifiedName,
            apiPhoneNumberId: phoneNumberId,
            businessAccountId: finalBusinessAccountId ?? (prevInfo as any).businessAccountId,
            businessAccountName: businessAccountName,
            wabaId: finalWabaId ?? (prevInfo as any).wabaId,
            wabaName: wabaName,
            qualityRating: finalQualityRating,
            codeVerificationStatus: finalCodeVerificationStatus,
            integrationId: integration.id,
          },
        });
        await businessAPIManager.createSession(existingSession.sessionId, {
          phoneNumberId: phoneNumberId,
          accessToken: accessToken,
          businessAccountId: finalBusinessAccountId,
        });
        return res.status(200).json({
          message: "Session already existed; connection refreshed with current WhatsApp Business account.",
          sessionId: existingSession.sessionId,
          refreshed: true,
        });
      }

      // Create a new session for this phone number
      const sessionId = `wb_${phoneNumberId}_${Date.now()}`;
      
      // Create session in storage first with all phone number details (integrationId = which Meta account owns this phone)
      await storage.createSession({
        userId,
        organizationId: organizationId || undefined,
        sessionId,
        connectionType: 'official',
        status: 'connecting',
        deviceInfo: {
          platform: 'WhatsApp Business API',
          phoneNumber: finalDisplayPhoneNumber,
          displayPhoneNumber: finalDisplayPhoneNumber,
          name: finalVerifiedName || 'Business Account',
          verifiedName: finalVerifiedName,
          apiPhoneNumberId: phoneNumberId,
          businessAccountId: finalBusinessAccountId,
          businessAccountName: businessAccountName,
          wabaId: finalWabaId,
          wabaName: wabaName,
          qualityRating: finalQualityRating,
          codeVerificationStatus: finalCodeVerificationStatus,
          integrationId: integration.id,
        },
      });

      // Create session in WhatsApp Business API manager
      await businessAPIManager.createSession(sessionId, {
        phoneNumberId: phoneNumberId,
        accessToken: accessToken,
        businessAccountId: finalBusinessAccountId,
      });

      // CRITICAL: Register phone number connection with Meta to show as "CONNECTED" status
      // This simulates clicking "Generate access token" in Meta's Quickstart page
      // When you generate an access token for a phone number, Meta automatically changes status from PENDING to CONNECTED
      try {
        console.log(`[Add Phone] 🔄 Registering phone number connection with Meta to show as CONNECTED...`);
        
        // Step 1: Fetch phone number details to ensure it exists
        const phoneResponse = await fetch(
          `${FACEBOOK_GRAPH_API_BASE}/${phoneNumberId}?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating&access_token=${accessToken}`
        );
        
        if (!phoneResponse.ok) {
          const errorData = await phoneResponse.json().catch(() => ({}));
          console.warn(`[Add Phone] ⚠️  Could not fetch phone details:`, errorData.error?.message || 'Unknown error');
          // Don't throw, continue with other steps
        } else {
          const phoneData = await phoneResponse.json();
          console.log(`[Add Phone] ✅ Fetched phone details for ${phoneNumberId} (${phoneData.display_phone_number || phoneNumberId})`);
          console.log(`[Add Phone]    Verification Status: ${phoneData.code_verification_status || 'UNKNOWN'}`);
        }
        
        // Step 2: Register connection via WABA - This is CRITICAL for CONNECTED status
        // Fetching phone numbers via WABA registers the connection with Meta
        if (finalWabaId) {
          try {
            console.log(`[Add Phone] 🔄 Registering connection via WABA ${finalWabaId}...`);
            const wabaResponse = await fetch(
              `${FACEBOOK_GRAPH_API_BASE}/${finalWabaId}?fields=id,name,message_template_namespace,account_review_status,ownership_type,phone_numbers{id,display_phone_number,code_verification_status,verified_name,quality_rating}&access_token=${accessToken}`
            );
            
            if (wabaResponse.ok) {
              const wabaData = await wabaResponse.json();
              console.log(`[Add Phone] ✅ Registered connection via WABA: ${wabaData.name || finalWabaId}`);
              
              // Check if phone number is in the WABA's phone numbers list
              // This validates the connection and helps Meta recognize it as CONNECTED
              if (wabaData.phone_numbers?.data) {
                const phoneInWaba = wabaData.phone_numbers.data.find((p: any) => p.id === phoneNumberId);
                if (phoneInWaba) {
                  console.log(`[Add Phone] ✅ Phone number found in WABA's phone numbers list`);
                  console.log(`[Add Phone]    Phone verification status in WABA: ${phoneInWaba.code_verification_status || 'UNKNOWN'}`);
                  
                  // Update status if different
                  if (phoneInWaba.code_verification_status && phoneInWaba.code_verification_status !== finalCodeVerificationStatus) {
                    console.log(`[Add Phone] 📊 Status changed from ${finalCodeVerificationStatus} to ${phoneInWaba.code_verification_status}`);
                    const updatedSession = await storage.getSession(sessionId);
                    if (updatedSession) {
                      await storage.updateSession(sessionId, {
                        deviceInfo: {
                          ...updatedSession.deviceInfo,
                          codeVerificationStatus: phoneInWaba.code_verification_status,
                        },
                      });
                    }
                  }
                } else {
                  console.warn(`[Add Phone] ⚠️  Phone number ${phoneNumberId} not found in WABA's phone numbers list`);
                }
              }
            } else {
              const errorData = await wabaResponse.json().catch(() => ({}));
              console.warn(`[Add Phone] ⚠️  Could not register via WABA:`, errorData.error?.message || 'Unknown error');
            }
          } catch (wabaError: any) {
            console.warn(`[Add Phone] ⚠️  Error registering via WABA:`, wabaError.message);
          }
        }
        
        // Step 3: CRITICAL - Subscribe App to WABA and Override Webhook Callback (based on working Laravel reference)
        // The Laravel reference does TWO calls:
        // 1. First: Subscribe app to WABA with subscribed_fields
        // 2. Second: Override callback URI with override_callback_uri and verify_token (THIS IS WHAT MAKES NUMBERS CONNECTED)
        // This is the #1 cause of PENDING status - missing the override_callback_uri call
        if (finalWabaId) {
          try {
            console.log(`[Add Phone] 🔄 Step 1: Subscribing app to WABA ${finalWabaId}...`);
            
            // Step 1: Subscribe app to WABA with webhook fields
            const subscribeResponse = await fetch(
              `${FACEBOOK_GRAPH_API_BASE}/${finalWabaId}/subscribed_apps`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  subscribed_fields: ['messages', 'message_template_status_update']
                }),
              }
            );
            
            if (subscribeResponse.ok) {
              const subscribeData = await subscribeResponse.json();
              console.log(`[Add Phone] ✅ Step 1: App subscribed to WABA successfully`);
              console.log(`[Add Phone]    Response:`, JSON.stringify(subscribeData));
              
              // CRITICAL STEP 2: Override callback URI with our webhook URL
              // Based on Laravel reference: This is what makes numbers show as CONNECTED on Meta
              const WEBHOOK_URL = process.env.WEBHOOK_URL || `https://${process.env.REPL_SLUG || 'localhost'}.repl.co/api/webhooks/whatsapp-business`;
              const webhookVerifyToken = process.env.WEBHOOK_VERIFY_TOKEN || 'helicoptic@2025';
              
              console.log(`[Add Phone] 🔄 Step 2: Overriding webhook callback URI (CRITICAL for CONNECTED status)...`);
              console.log(`[Add Phone]    Webhook URL: ${WEBHOOK_URL}`);
              console.log(`[Add Phone]    Verify Token: ${webhookVerifyToken}`);
              
              const webhookOverrideResponse = await fetch(
                `${FACEBOOK_GRAPH_API_BASE}/${finalWabaId}/subscribed_apps`,
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    override_callback_uri: WEBHOOK_URL,
                    verify_token: webhookVerifyToken
                  }),
                }
              );
              
              if (webhookOverrideResponse.ok) {
                const webhookOverrideData = await webhookOverrideResponse.json();
                console.log(`[Add Phone] ✅ Step 2: Webhook callback URI overridden successfully`);
                console.log(`[Add Phone]    Response:`, JSON.stringify(webhookOverrideData));
                console.log(`[Add Phone]    🎉 This is CRITICAL - this makes numbers show as CONNECTED on Meta`);
                console.log(`[Add Phone]    ✅ Both subscription steps completed - phone number should activate`);
              } else {
                const webhookOverrideError = await webhookOverrideResponse.json().catch(() => ({}));
                console.warn(`[Add Phone] ⚠️  Step 2: Failed to override webhook callback URI`);
                console.warn(`[Add Phone]    Error:`, webhookOverrideError.error?.message || 'Unknown error');
                console.warn(`[Add Phone]    This may cause numbers to remain PENDING`);
                console.warn(`[Add Phone]    Webhook URL: ${WEBHOOK_URL}`);
                console.warn(`[Add Phone]    Verify Token: ${webhookVerifyToken}`);
              }
            } else {
              const errorData = await subscribeResponse.json().catch(() => ({}));
              const errorCode = errorData.error?.code;
              const errorMessage = errorData.error?.message || 'Unknown error';
              
              console.error(`[Add Phone] ❌ Step 1: Failed to subscribe app to WABA:`, errorMessage);
              console.error(`[Add Phone]    Error code: ${errorCode}`);
              console.error(`[Add Phone]    This is CRITICAL - without app subscription, status will remain PENDING`);
            }
          } catch (subscribeError: any) {
            console.error(`[Add Phone] ❌ Error subscribing app to WABA:`, subscribeError.message);
          }
        }
        
        // Step 4: CRITICAL - Check if phone number is registered with WhatsApp Cloud API
        // If number is not available in WhatsApp (can't receive messages), we need to register it
        // This is why you can't send messages from WhatsApp app to the number
        let numberRegistered = false;
        let useHelloWorld = false;
        
        try {
          console.log(`[Add Phone] 🔄 Checking if phone number is registered with WhatsApp Cloud API...`);
          console.log(`[Add Phone]    If number is not registered, it won't be available in WhatsApp app`);
          
          // Try to access message templates endpoint - this will fail if number is not registered
          const templatesCheckResponse = await fetch(
            `${FACEBOOK_GRAPH_API_BASE}/${phoneNumberId}/message_templates?access_token=${accessToken}`
          );
          
          if (templatesCheckResponse.ok) {
            const templatesData = await templatesCheckResponse.json();
            const templates = templatesData.data || [];
            useHelloWorld = templates.some((t: any) => t.name === 'hello_world');
            console.log(`[Add Phone] ✅ Phone number is registered - found ${templates.length} template(s)`);
            console.log(`[Add Phone]    hello_world exists: ${useHelloWorld}`);
            numberRegistered = true;
          } else {
            const errorData = await templatesCheckResponse.json().catch(() => ({}));
            const errorCode = errorData.error?.code;
            const errorMessage = errorData.error?.message || 'Unknown error';
            
            // If number is not registered (error 133010), try to register it
            if (errorCode === 133010) {
              console.warn(`[Add Phone] ⚠️  Phone number not registered (Error 133010)`);
              console.warn(`[Add Phone]    Number is NOT available in WhatsApp - cannot receive messages`);
              console.warn(`[Add Phone]    This is why you can't send messages from WhatsApp app to this number`);
              console.warn(`[Add Phone]    Attempting to register number with WhatsApp Cloud API...`);
              
              // Try to register the number (without PIN first - for Embedded Signup, PIN is not needed)
              // For manually added numbers, PIN might be required
              try {
                const registerResponse = await fetch(
                  `${FACEBOOK_GRAPH_API_BASE}/${phoneNumberId}/register`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${accessToken}`,
                    },
                    body: JSON.stringify({
                      messaging_product: 'whatsapp',
                      // Don't include PIN - try without first
                    }),
                  }
                );
                
                if (registerResponse.ok) {
                  const registerData = await registerResponse.json();
                  console.log(`[Add Phone] ✅ Phone number registered successfully with WhatsApp Cloud API`);
                  console.log(`[Add Phone]    Response:`, JSON.stringify(registerData));
                  console.log(`[Add Phone]    Number should now be available for receiving messages in WhatsApp app`);
                  numberRegistered = true;
                  
                  // Wait a moment for registration to process
                  await new Promise(resolve => setTimeout(resolve, 2000));
                  
                  // Now try to fetch templates again
                  const templatesRetryResponse = await fetch(
                    `${FACEBOOK_GRAPH_API_BASE}/${phoneNumberId}/message_templates?access_token=${accessToken}`
                  );
                  
                  if (templatesRetryResponse.ok) {
                    const templatesRetryData = await templatesRetryResponse.json();
                    const templates = templatesRetryData.data || [];
                    useHelloWorld = templates.some((t: any) => t.name === 'hello_world');
                    console.log(`[Add Phone] ✅ Connection registered via message templates endpoint`);
                    console.log(`[Add Phone]    Found ${templates.length} template(s), hello_world exists: ${useHelloWorld}`);
                  }
                } else {
                  const registerErrorData = await registerResponse.json().catch(() => ({}));
                  const registerErrorCode = registerErrorData.error?.code;
                  const registerErrorMessage = registerErrorData.error?.message || 'Unknown error';
                  
                  // Automatic retries with increasing delays
                  // Meta may need time to process registration, especially for Embedded Signup
                  console.warn(`[Add Phone] ⚠️  Registration failed (may be timing issue)`);
                  console.warn(`[Add Phone]    Automatically retrying in 30 seconds, then 2 minutes, then 5 minutes...`);
                  
                  const registrationRetryDelays = [30 * 1000, 2 * 60 * 1000, 5 * 60 * 1000]; // 30s, 2min, 5min
                  
                  registrationRetryDelays.forEach((delay, index) => {
                    setTimeout(async () => {
                      try {
                        console.log(`[Add Phone] 🔄 [Auto Retry ${index + 1}/${registrationRetryDelays.length}] Attempting registration...`);
                        
                        const retryRegisterResponse = await fetch(
                          `${FACEBOOK_GRAPH_API_BASE}/${phoneNumberId}/register`,
                          {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${accessToken}`,
                            },
                            body: JSON.stringify({
                              messaging_product: 'whatsapp',
                            }),
                          }
                        );
                        
                        if (retryRegisterResponse.ok) {
                          const retryRegisterData = await retryRegisterResponse.json();
                          console.log(`[Add Phone] ✅ [Auto Retry ${index + 1}] Registration succeeded!`);
                          console.log(`[Add Phone]    Number is now available for receiving messages in WhatsApp app`);
                          numberRegistered = true;
                          
                          // Verify registration by fetching templates
                          try {
                            const verifyTemplatesResponse = await fetch(
                              `${FACEBOOK_GRAPH_API_BASE}/${phoneNumberId}/message_templates?access_token=${accessToken}`
                            );
                            if (verifyTemplatesResponse.ok) {
                              const verifyTemplatesData = await verifyTemplatesResponse.json();
                              const templates = verifyTemplatesData.data || [];
                              useHelloWorld = templates.some((t: any) => t.name === 'hello_world');
                              console.log(`[Add Phone] ✅ Verified: Number is now accessible`);
                              console.log(`[Add Phone]    Found ${templates.length} template(s), hello_world exists: ${useHelloWorld}`);
                            }
                          } catch (verifyError: any) {
                            // Ignore verification errors
                          }
                          return; // Success - stop retrying
                        } else {
                          const retryErrorData = await retryRegisterResponse.json().catch(() => ({}));
                          const retryErrorCode = retryErrorData.error?.code;
                          const retryErrorMessage = retryErrorData.error?.message || 'Unknown error';
                          
                          if (index === registrationRetryDelays.length - 1) {
                            // Last retry failed
                            console.warn(`[Add Phone] ⚠️  [Auto Retry ${index + 1}] All retries exhausted`);
                            console.warn(`[Add Phone]    Error: ${retryErrorMessage} (code: ${retryErrorCode})`);
                            console.warn(`[Add Phone]    Meta may auto-register the number within 5-10 minutes`);
                            console.warn(`[Add Phone]    Number will become available automatically`);
                          } else {
                            console.log(`[Add Phone] ⚠️  [Auto Retry ${index + 1}] Still not registered: ${retryErrorMessage}`);
                            console.log(`[Add Phone]    Will retry again in ${(registrationRetryDelays[index + 1] - delay) / 1000} seconds...`);
                          }
                        }
                      } catch (retryError: any) {
                        if (index === registrationRetryDelays.length - 1) {
                          console.warn(`[Add Phone] ⚠️  [Auto Retry ${index + 1}] All retries exhausted`);
                          console.warn(`[Add Phone]    Meta may auto-register the number within 5-10 minutes`);
                        }
                      }
                    }, delay);
                  });
                }
              } catch (registerError: any) {
                console.warn(`[Add Phone] ⚠️  Error attempting registration:`, registerError.message);
              }
            } else {
              console.warn(`[Add Phone] ⚠️  Could not check templates:`, errorMessage);
            }
          }
        } catch (templatesError: any) {
          console.warn(`[Add Phone] ⚠️  Error checking phone number registration:`, templatesError.message);
        }
        
        // Step 5: Register connection by accessing phone number's business account relationship
        // This helps Meta recognize the phone number is connected to our SaaS
        if (finalBusinessAccountId) {
          try {
            console.log(`[Add Phone] 🔄 Registering connection via business account ${finalBusinessAccountId}...`);
            
            // Fetch business account to register the connection
            const businessAccountResponse = await fetch(
              `${FACEBOOK_GRAPH_API_BASE}/${finalBusinessAccountId}?fields=id,name,owned_whatsapp_business_accounts{id,name,phone_numbers{id}}&access_token=${accessToken}`
            );
            
            if (businessAccountResponse.ok) {
              const businessAccountData = await businessAccountResponse.json();
              console.log(`[Add Phone] ✅ Registered connection via business account: ${businessAccountData.name || finalBusinessAccountId}`);
            }
          } catch (businessAccountError: any) {
            console.warn(`[Add Phone] ⚠️  Error registering via business account:`, businessAccountError.message);
          }
        }
        
        // Step 6: Final status check - Verify the connection is registered
        try {
          console.log(`[Add Phone] 🔄 Verifying final connection status...`);
          
          // Wait a moment for Meta to process the connection
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const statusResponse = await fetch(
            `${FACEBOOK_GRAPH_API_BASE}/${phoneNumberId}?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating&access_token=${accessToken}`
          );
          
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            console.log(`[Add Phone] ✅ Final phone number verification status: ${statusData.code_verification_status || 'UNKNOWN'}`);
            console.log(`[Add Phone] 💡 Phone number should now show as "CONNECTED" in Meta's WhatsApp Manager`);
            
            // Update the session with the latest status from Meta
            if (statusData.code_verification_status && statusData.code_verification_status !== finalCodeVerificationStatus) {
              console.log(`[Add Phone] 📊 Status changed from ${finalCodeVerificationStatus} to ${statusData.code_verification_status}`);
              const updatedSession = await storage.getSession(sessionId);
              if (updatedSession) {
                await storage.updateSession(sessionId, {
                  deviceInfo: {
                    ...updatedSession.deviceInfo,
                    codeVerificationStatus: statusData.code_verification_status,
                  },
                });
              }
            }
            
            if (statusData.code_verification_status === 'PENDING') {
              console.error(`[Add Phone] ❌ Phone number is still PENDING after connection registration`);
              console.error(`[Add Phone] 💡 This may require:`);
              console.error(`[Add Phone]    - Completing business verification in Meta Business Manager`);
              console.error(`[Add Phone]    - Ensuring phone number has been active on WhatsApp Business App for 7+ days`);
              console.error(`[Add Phone]    - Completing all business information (especially website) in Meta Business Manager`);
              
              // CRITICAL: Reject PENDING numbers to prevent messaging issues
              // Update session status to disconnected
              await storage.updateSession(sessionId, {
                status: 'disconnected',
                deviceInfo: {
                  ...(await storage.getSession(sessionId))?.deviceInfo,
                  codeVerificationStatus: 'PENDING',
                },
              });
              
              // Return error response
              return res.status(400).json({
                success: false,
                message: "Phone number verification is still PENDING",
                error: "PHONE_STILL_PENDING",
                details: `The phone number is still PENDING after connection registration. This prevents sending messages. Please ensure:` +
                  `\n1. Business verification is complete in Meta Business Manager` +
                  `\n2. Phone number has been active on WhatsApp Business App for 7+ days` +
                  `\n3. All business information (especially website) is complete in Meta Business Manager` +
                  `\n4. Try using the Embedded Signup flow instead of manually adding numbers`,
                phoneNumber: {
                  id: phoneNumberId,
                  displayPhoneNumber: statusData.display_phone_number,
                  verificationStatus: 'PENDING',
                  isVerified: false,
                },
                helpUrl: "https://business.facebook.com/help/149790234973220",
              });
            } else if (statusData.code_verification_status === 'VERIFIED') {
              console.log(`[Add Phone] ✅ Phone number is VERIFIED and should show as CONNECTED on Meta`);
            } else {
              console.warn(`[Add Phone] ⚠️  Phone number status: ${statusData.code_verification_status} - May not be able to send messages`);
            }
          }
        } catch (statusError: any) {
          console.warn(`[Add Phone] ⚠️  Error checking final status:`, statusError.message);
        }
        
        // Step 6: Send test template message to trigger CONNECTED status
        // CRITICAL: This is what triggers PENDING → CONNECTED status change
        // Must use template message (hello_world) - free-form messages won't work
        // Reuse useHelloWorld variable from Step 4 (already checked above)
        // If not checked yet, check again for hello_world template
        if (useHelloWorld === false) {
          try {
            console.log(`[Add Phone] 🔄 Checking for hello_world template...`);
            const templatesCheckResponse = await fetch(
              `${FACEBOOK_GRAPH_API_BASE}/${phoneNumberId}/message_templates?access_token=${accessToken}`
            );
            
            if (templatesCheckResponse.ok) {
              const templatesData = await templatesCheckResponse.json();
              const templates = templatesData.data || [];
              useHelloWorld = templates.some((t: any) => t.name === 'hello_world');
              console.log(`[Add Phone]    Found ${templates.length} template(s), hello_world exists: ${useHelloWorld}`);
            }
          } catch (templateCheckError: any) {
            console.warn(`[Add Phone] ⚠️  Could not check templates:`, templateCheckError.message);
          }
        }
        
        try {
          console.log(`[Add Phone] 🔄 Sending test template message to activate phone number (CRITICAL)...`);
          
          // Send template message if hello_world exists, otherwise try free-form
          const testMessageResponse = await fetch(
            `${FACEBOOK_GRAPH_API_BASE}/${phoneNumberId}/messages`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
              },
              body: JSON.stringify(useHelloWorld ? {
                messaging_product: 'whatsapp',
                to: finalDisplayPhoneNumber,
                type: 'template',
                template: {
                  name: 'hello_world',
                  language: {
                    code: 'en_US'
                  }
                }
              } : {
                messaging_product: 'whatsapp',
                to: finalDisplayPhoneNumber,
                type: 'text',
                text: {
                  body: 'WhatsApp Connected Successfully ✅'
                }
              }),
            }
          );
          
          if (testMessageResponse.ok) {
            const testMessageData = await testMessageResponse.json();
            console.log(`[Add Phone] ✅ Test message sent successfully`);
            console.log(`[Add Phone]    Message ID: ${testMessageData.messages?.[0]?.id || 'N/A'}`);
            console.log(`[Add Phone]    Type: ${useHelloWorld ? 'template (hello_world)' : 'text'}`);
            console.log(`[Add Phone]    This should trigger status change to CONNECTED on Meta`);
            console.log(`[Add Phone]    Status usually updates within 1-5 minutes`);
          } else {
            const errorData = await testMessageResponse.json().catch(() => ({}));
            const errorCode = errorData.error?.code;
            const errorMessage = errorData.error?.message || 'Unknown error';
            
            console.warn(`[Add Phone] ⚠️  Test message not sent:`, errorMessage);
            console.warn(`[Add Phone]    Error code: ${errorCode}`);
            
            if (errorCode === 133010) {
              console.error(`[Add Phone] ❌ CRITICAL: Account not registered (Error 133010)`);
              console.error(`[Add Phone]    This means the phone number is VERIFIED but not yet activated for messaging`);
              console.error(`[Add Phone]    🔄 Scheduling background retry to send test message...`);
              console.error(`[Add Phone]    📋 Will automatically retry in 2 minutes, then 5 minutes, then 10 minutes`);
              
              // Schedule multiple background retries with increasing delays
              const retryDelays = [2 * 60 * 1000, 5 * 60 * 1000, 10 * 60 * 1000]; // 2 min, 5 min, 10 min
              
              retryDelays.forEach((delay, index) => {
                setTimeout(async () => {
                  try {
                    console.log(`[Add Phone] 🔄 [Background Retry ${index + 1}/${retryDelays.length}] Attempting to send test message...`);
                    console.log(`[Add Phone]    Phone Number ID: ${phoneNumberId}`);
                    console.log(`[Add Phone]    Display Number: ${finalDisplayPhoneNumber}`);
                    
                    const retryMessageResponse = await fetch(
                      `${FACEBOOK_GRAPH_API_BASE}/${phoneNumberId}/messages`,
                      {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${accessToken}`,
                        },
                        body: JSON.stringify(useHelloWorld ? {
                          messaging_product: 'whatsapp',
                          to: finalDisplayPhoneNumber,
                          type: 'template',
                          template: {
                            name: 'hello_world',
                            language: {
                              code: 'en_US'
                            }
                          }
                        } : {
                          messaging_product: 'whatsapp',
                          to: finalDisplayPhoneNumber,
                          type: 'text',
                          text: {
                            body: 'WhatsApp Connected Successfully ✅'
                          }
                        }),
                      }
                    );
                    
                    if (retryMessageResponse.ok) {
                      const retryMessageData = await retryMessageResponse.json();
                      console.log(`[Add Phone] ✅ [Background Retry ${index + 1}] Test message sent successfully!`);
                      console.log(`[Add Phone]    Message ID: ${retryMessageData.messages?.[0]?.id || 'N/A'}`);
                      console.log(`[Add Phone]    Type: ${useHelloWorld ? 'template (hello_world)' : 'text'}`);
                      console.log(`[Add Phone]    🎉 Phone number should now be activated and show as CONNECTED on Meta`);
                      console.log(`[Add Phone]    Status usually updates within 1-5 minutes`);
                      return; // Success - stop retrying
                    } else {
                      const retryErrorData = await retryMessageResponse.json().catch(() => ({}));
                      const retryErrorCode = retryErrorData.error?.code;
                      const retryErrorMessage = retryErrorData.error?.message || 'Unknown error';
                      
                      if (retryErrorCode === 133010) {
                        console.log(`[Add Phone] ⚠️  [Background Retry ${index + 1}] Still not registered:`, retryErrorMessage);
                        if (index === retryDelays.length - 1) {
                          console.log(`[Add Phone]    All retries exhausted. Will wait for user to send first message instead.`);
                        } else {
                          console.log(`[Add Phone]    Will retry again in ${(retryDelays[index + 1] - delay) / 1000 / 60} minutes...`);
                        }
                      } else {
                        console.log(`[Add Phone] ⚠️  [Background Retry ${index + 1}] Failed:`, retryErrorMessage);
                        console.log(`[Add Phone]    Error code: ${retryErrorCode}`);
                      }
                    }
                  } catch (retryError: any) {
                    console.log(`[Add Phone] ⚠️  [Background Retry ${index + 1}] Error:`, retryError.message);
                    if (index === retryDelays.length - 1) {
                      console.log(`[Add Phone]    All retries exhausted. Will wait for user to send first message instead.`);
                    }
                  }
                }, delay);
              });
            } else {
              console.warn(`[Add Phone]    This may be because:`);
              console.warn(`[Add Phone]    1. Phone number is not VERIFIED yet`);
              console.warn(`[Add Phone]    2. hello_world template not approved`);
              console.warn(`[Add Phone]    3. Webhook not configured in Meta`);
              console.warn(`[Add Phone]    Phone number will still work once these are resolved`);
            }
          }
        } catch (testMessageError: any) {
          console.warn(`[Add Phone] ⚠️  Could not send test message:`, testMessageError.message);
          console.warn(`[Add Phone]    This is not critical - status will update after first successful message`);
        }
        
        console.log(`[Add Phone] ✅ Phone number connection registration completed - should show as CONNECTED on Meta`);
      } catch (error: any) {
        console.error(`[Add Phone] Error in connection registration flow:`, error.message);
        // Don't fail the phone addition if this fails, but log the error
      }

      // Ensure all phone number details are preserved after session creation/update
      // The businessAPIManager might update the session, so we need to ensure all details are still there
      const updatedSession = await storage.getSession(sessionId);
      if (updatedSession) {
        const updatedDeviceInfo = {
          ...updatedSession.deviceInfo,
          // Preserve all phone number details
          apiPhoneNumberId: phoneNumberId,
          businessAccountId: finalBusinessAccountId,
          businessAccountName: businessAccountName,
          wabaId: finalWabaId,
          wabaName: wabaName,
          displayPhoneNumber: finalDisplayPhoneNumber,
          verifiedName: finalVerifiedName,
          qualityRating: finalQualityRating,
          codeVerificationStatus: finalCodeVerificationStatus,
          phoneNumber: finalDisplayPhoneNumber,
          name: finalVerifiedName || 'Business Account',
        };
        
        // Only update if any details are missing
        const needsUpdate = !updatedDeviceInfo.wabaId || !updatedDeviceInfo.businessAccountName || !updatedDeviceInfo.qualityRating;
        if (needsUpdate) {
          await storage.updateSession(sessionId, {
            deviceInfo: updatedDeviceInfo,
          });
        }
      }

      // Sync templates for this phone number
      try {
        // Use WABA ID for fetching templates (not businessAccountId)
        const wabaIdForTemplates = finalWabaId || finalBusinessAccountId;
        if (!wabaIdForTemplates) {
          console.warn(`WABA ID not available for phone ${phoneNumberId}, skipping template sync`);
        } else {
          const templates = await businessAPIManager.fetchMessageTemplates(
            {
              phoneNumberId: phoneNumberId,
              accessToken: accessToken,
              businessAccountId: finalBusinessAccountId,
            },
            wabaIdForTemplates // Use WABA ID, not businessAccountId
          );
          await storage.syncMessageTemplates(userId, templates, phoneNumberId);
          console.log(`Auto-synced ${templates.length} message templates for phone ${phoneNumberId}`);
        }
      } catch (syncError: any) {
        console.error(`Error auto-syncing templates for phone ${phoneNumberId}:`, syncError);
        // Don't fail the entire phone addition if template sync fails
      }

      // If phone number is PENDING, schedule automatic status check
      if (finalCodeVerificationStatus === 'PENDING') {
        console.log(`[Add Phone] 📋 Phone number ${phoneNumberId} is PENDING - scheduling automatic verification check`);
        
        // Schedule automatic status check after 30 seconds, 2 minutes, and 5 minutes
        // This allows time for Embedded Signup to auto-verify the number
        const checkStatus = async (delay: number) => {
          setTimeout(async () => {
            try {
              const statusResponse = await fetch(
                `${FACEBOOK_GRAPH_API_BASE}/${phoneNumberId}?fields=code_verification_status&access_token=${accessToken}`
              );
              
              if (statusResponse.ok) {
                const statusData = await statusResponse.json();
                const newStatus = statusData.code_verification_status;
                
                if (newStatus === 'VERIFIED') {
                  console.log(`[Add Phone] ✅ Phone number ${phoneNumberId} auto-verified! Status changed from PENDING to VERIFIED`);
                  
                  // Update session with verified status
                  const updatedSession = await storage.getSession(sessionId);
                  if (updatedSession) {
                    await storage.updateSession(sessionId, {
                      deviceInfo: {
                        ...updatedSession.deviceInfo,
                        codeVerificationStatus: 'VERIFIED',
                      },
                    });
                    console.log(`[Add Phone] ✅ Updated session ${sessionId} with VERIFIED status`);
                  }
                } else if (newStatus === 'PENDING') {
                  console.log(`[Add Phone] ⏳ Phone number ${phoneNumberId} still PENDING after ${delay/1000}s`);
                } else {
                  console.log(`[Add Phone] 📊 Phone number ${phoneNumberId} status: ${newStatus}`);
                }
              }
            } catch (error: any) {
              console.error(`[Add Phone] Error checking status for ${phoneNumberId}:`, error.message);
            }
          }, delay);
        };
        
        // Check status at 30s, 2min, 5min intervals
        checkStatus(30000);  // 30 seconds
        checkStatus(120000); // 2 minutes
        checkStatus(300000); // 5 minutes
      }

      // Return success response
      res.json({
        success: true,
        message: finalCodeVerificationStatus === 'PENDING' 
          ? "Phone number added successfully. Status is PENDING - it will be automatically checked and updated when verified."
          : "Phone number added successfully",
        sessionId: sessionId,
        phoneNumber: {
          id: phoneNumberId,
          displayPhoneNumber: finalDisplayPhoneNumber,
          verifiedName: finalVerifiedName,
          verificationStatus: finalCodeVerificationStatus,
          isVerified: finalCodeVerificationStatus === 'VERIFIED',
        },
        ...(finalCodeVerificationStatus === 'PENDING' && {
          note: "The phone number is currently PENDING verification. If you used Embedded Signup, it should auto-verify shortly. The system will automatically check and update the status.",
          warning: "If you manually entered this phone number (instead of using Embedded Signup), it may remain PENDING on Meta. To avoid this, complete the Embedded Signup flow during OAuth connection, which automatically registers phone numbers as CONNECTED.",
          recommendations: [
            "Complete the Embedded Signup flow during OAuth (don't manually add numbers)",
            "Ensure all business information is complete in Meta Business Manager (especially website)",
            "Wait 24-48 hours for Meta's review process",
            "Ensure the phone number has been active on WhatsApp Business App for 7+ days"
          ]
        }),
      });
  } catch (error: any) {
    console.error("Error adding WhatsApp Business phone number:", error);
    res.status(500).json({
      message: error.message || "Failed to add phone number",
    });
  }
});

  // Register phone number with PIN (for manual registration when PIN is required)
  app.post("/api/integrations/whatsapp-business/register-phone", isAuthenticated, resolveOrganizationContext, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      const { phoneNumberId, pin } = req.body;

      if (!phoneNumberId) {
        return res.status(400).json({ message: "Phone Number ID is required" });
      }

      if (!pin) {
        return res.status(400).json({ 
          message: "PIN is required. Check your SMS for the 6-digit PIN sent by Meta.",
          error: "PIN_REQUIRED"
        });
      }

      const integration = await storage.getIntegrationByName("whatsapp-business", userId, organizationId);

      if (!integration || integration.status !== "connected" || !integration.credentials) {
        return res.status(404).json({ message: "WhatsApp Business integration not found or not connected" });
      }

      const credentials = integration.credentials as any;
      const accessToken = credentials.access_token;

      console.log(`[Register Phone] 🔄 Registering phone number ${phoneNumberId} with PIN...`);

      // Call the register endpoint with PIN
      const registerResponse = await fetch(
        `${FACEBOOK_GRAPH_API_BASE}/${phoneNumberId}/register`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            pin: pin.toString(), // Ensure PIN is a string
          }),
        }
      );

      if (!registerResponse.ok) {
        const errorData = await registerResponse.json().catch(() => ({}));
        const errorCode = errorData.error?.code;
        const errorMessage = errorData.error?.message || 'Unknown error';

        console.error(`[Register Phone] ❌ Registration failed:`, errorMessage);
        console.error(`[Register Phone]    Error code: ${errorCode}`);

        return res.status(registerResponse.status).json({
          success: false,
          message: "Phone number registration failed",
          error: errorMessage,
          errorCode: errorCode,
          details: errorData.error,
        });
      }

      const registerData = await registerResponse.json();
      console.log(`[Register Phone] ✅ Phone number registered successfully`);
      console.log(`[Register Phone]    Response:`, JSON.stringify(registerData));

      // Update session status if it exists
      const sessions = await storage.getSessionsByUser(userId);
      const session = sessions.find(
        (s) => s.connectionType === 'official' && 
        s.deviceInfo?.apiPhoneNumberId === phoneNumberId
      );

      if (session) {
        await storage.updateSession(session.sessionId, {
          status: 'connected',
          deviceInfo: {
            ...session.deviceInfo,
            codeVerificationStatus: 'VERIFIED', // Registration should make it VERIFIED
          },
        });
        console.log(`[Register Phone] ✅ Updated session ${session.sessionId} status`);
      }

      res.json({
        success: true,
        message: "Phone number registered successfully. Status should now show as CONNECTED on Meta.",
        phoneNumber: {
          id: phoneNumberId,
          registered: true,
        },
      });
    } catch (error: any) {
      console.error("Error registering phone number:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to register phone number",
      });
    }
  });

  // Get all added phone numbers (sessions)
  app.get("/api/integrations/whatsapp-business/added-phones", isAuthenticated, resolveOrganizationContext, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;

      // When in org context, use org-scoped sessions so team members see the same connected numbers as admin
      const sessions = organizationId
        ? await storage.getSessionsByOrganization(organizationId)
        : await storage.getSessionsByUser(userId);
      const whatsappBusinessSessions = sessions.filter(
        (s) =>
          s.connectionType === 'official' &&
          s.deviceInfo?.apiPhoneNumberId &&
          !(s as any).deletedAt &&
          (s.status === 'connected' || s.status === 'connecting')
      );

      // Prefer one entry per Meta phone number ID (newest session wins)
      const byPhoneId = new Map<string, (typeof whatsappBusinessSessions)[0]>();
      for (const session of whatsappBusinessSessions) {
        const phoneId = String(session.deviceInfo?.apiPhoneNumberId || "");
        if (!phoneId) continue;
        const existing = byPhoneId.get(phoneId);
        if (!existing || new Date(session.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
          byPhoneId.set(phoneId, session);
        }
      }

      const phoneNumbers = Array.from(byPhoneId.values()).map((session) => {
        const deviceInfo = session.deviceInfo || {};
        
        // Return all stored phone number details from deviceInfo
        return {
          sessionId: session.sessionId,
          phoneNumberId: deviceInfo.apiPhoneNumberId,
          integrationId: deviceInfo.integrationId,
          displayPhoneNumber: deviceInfo.displayPhoneNumber || deviceInfo.phoneNumber,
          verifiedName: deviceInfo.verifiedName || deviceInfo.name,
          businessAccountId: deviceInfo.businessAccountId,
          businessAccountName: deviceInfo.businessAccountName,
          wabaId: deviceInfo.wabaId,
          wabaName: deviceInfo.wabaName,
          qualityRating: deviceInfo.qualityRating,
          codeVerificationStatus: deviceInfo.codeVerificationStatus,
          status: session.status,
          createdAt: session.createdAt,
          lastActive: session.lastActive,
        };
      });

      res.json({
        success: true,
        phoneNumbers,
        count: phoneNumbers.length,
      });
    } catch (error: any) {
      console.error("Error fetching added phone numbers:", error);
      res.status(500).json({ 
        message: error.message || "Failed to fetch added phone numbers",
        error: error.message 
      });
    }
  });

  // Delete phone number (session) - soft delete to preserve chat history on reconnect
  app.delete("/api/integrations/whatsapp-business/delete-phone/:sessionId", isAuthenticated, resolveOrganizationContext, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { sessionId } = req.params;

      // Verify session belongs to user
      const session = await storage.getSession(sessionId);
      if (!session || session.userId !== userId) {
        return res.status(404).json({ 
          success: false,
          message: "Session not found" 
        });
      }

      // Verify it's a WhatsApp Business session
      if (session.connectionType !== 'official' || !session.deviceInfo?.apiPhoneNumberId) {
        return res.status(400).json({ 
          success: false,
          message: "This is not a WhatsApp Business phone number session" 
        });
      }

      const phoneNumberId = session.deviceInfo.apiPhoneNumberId;
      const integrationId = session.deviceInfo.integrationId;

      // Deregister from Meta so the number is disconnected on Meta's side too
      try {
        const integration = integrationId
          ? await storage.getIntegration(integrationId, userId)
          : await storage.getIntegrationByName("whatsapp-business", userId, req.context?.organizationId);
        const accessToken = integration?.credentials && (integration.credentials as any).access_token;
        if (accessToken) {
          const deregisterRes = await fetch(
            `${FACEBOOK_GRAPH_API_BASE}/${phoneNumberId}/deregister`,
            {
              method: "POST",
              headers: { "Authorization": `Bearer ${accessToken}` },
            }
          );
          if (deregisterRes.ok) {
            console.log(`[Delete Phone] ✅ Deregistered phone ${phoneNumberId} from Meta`);
          } else {
            const errData = await deregisterRes.json().catch(() => ({}));
            const errMsg = errData.error?.message || "Unknown error";
            // Dual-mode numbers cannot be deregistered via API – user must disconnect from WhatsApp Business app
            if (errData.error?.code === 133016 || errMsg.includes("deregister") || errMsg.includes("dual")) {
              console.warn(`[Delete Phone] ⚠️ Could not deregister from Meta (may be dual-mode): ${errMsg}`);
            } else {
              console.warn(`[Delete Phone] ⚠️ Meta deregister failed (continuing with local delete): ${errMsg}`);
            }
          }
        } else {
          console.warn(`[Delete Phone] ⚠️ No access token for integration, skipping Meta deregister`);
        }
      } catch (deregisterErr: any) {
        console.warn(`[Delete Phone] ⚠️ Meta deregister error (continuing with local delete):`, deregisterErr.message);
      }

      // Soft delete: disconnect from memory but keep session + chats for reconnect
      try {
        const { businessAPIManager } = await import('../../whatsapp/business-api-client');
        await businessAPIManager.disconnectSession(sessionId);
      } catch (_) {
        // Session may not be in memory (e.g. after server restart)
      }
      await storage.updateSession(sessionId, {
        status: 'disconnected',
        deletedAt: new Date(),
      } as any);

      // Drop this number from chatbot triggers / template send nodes so it no longer appears selected
      try {
        const organizationId = req.context?.organizationId;
        await storage.removeWhatsAppSessionFromChatbots({
          sessionId,
          phoneNumberId: phoneNumberId ? String(phoneNumberId) : undefined,
          userId,
          organizationId,
        });
      } catch (scrubErr: any) {
        console.warn(`[Delete Phone] ⚠️ Could not scrub chatbot references:`, scrubErr?.message || scrubErr);
      }

      res.json({
        success: true,
        message: "Phone number removed and disconnected from Meta (when possible). Chat history will be restored when you reconnect.",
      });
    } catch (error: any) {
      console.error("Error deleting phone number:", error);
      res.status(500).json({ 
        success: false,
        message: error.message || "Failed to delete phone number",
        error: error.message 
      });
    }
  });

  // Fetch templates from WhatsApp Business
  app.get("/api/integrations/whatsapp-business/templates", isAuthenticated, resolveOrganizationContext, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      const { connectionId } = req.query;

      let integration: any;
      let accessToken: string;
      let businessAccountId: string | undefined;
      let phoneNumberId: string | undefined;
      let wabaId: string | undefined;

      // If connectionId looks like a sessionId (e.g. wb_xxx), resolve from session
      if (connectionId && typeof connectionId === "string" && connectionId.startsWith("wb_")) {
        const session = await storage.getSession(connectionId);
        if (!session || session.userId !== userId) {
          return res.status(404).json({ message: "WhatsApp session not found" });
        }
        if (session.connectionType !== "official" || !session.deviceInfo?.apiPhoneNumberId) {
          return res.status(400).json({ message: "Invalid WhatsApp Business session" });
        }
        const integrationId = session.deviceInfo.integrationId;
        integration = integrationId
          ? await storage.getIntegration(integrationId, userId)
          : await storage.getIntegrationByName("whatsapp-business", userId, organizationId);
        if (!integration || integration.status !== "connected" || !integration.credentials) {
          return res.status(404).json({ message: "WhatsApp Business integration not found or not connected" });
        }
        accessToken = (integration.credentials as any).access_token;
        businessAccountId = session.deviceInfo?.businessAccountId;
        phoneNumberId = session.deviceInfo?.apiPhoneNumberId;
        wabaId = session.deviceInfo?.wabaId || (session.deviceInfo as any)?.businessAccountId;
      } else {
        integration = await storage.getIntegrationByName("whatsapp-business", userId, organizationId);
        if (!integration || integration.status !== "connected" || !integration.credentials) {
          return res.status(404).json({ message: "WhatsApp Business integration not found or not connected" });
        }
        const credentials = integration.credentials as any;
        accessToken = credentials.access_token;
        phoneNumberId = credentials.phoneNumberId || integration.config?.phoneNumberId;
        businessAccountId = credentials.businessAccountId || integration.config?.businessAccountId;
        wabaId = (integration.config as any)?.wabaId || businessAccountId;
      }

      if (!phoneNumberId) {
        return res.status(400).json({ message: "Phone number not selected. Please select a phone number first." });
      }

      // message_templates must be fetched from WABA (WhatsApp Business Account), NOT phone number ID
      if (!wabaId) {
        // Fetch WABA ID from phone number
        const phoneResponse = await fetch(
          `${FACEBOOK_GRAPH_API_BASE}/${phoneNumberId}?fields=whatsapp_business_account&access_token=${accessToken}`
        );
        if (phoneResponse.ok) {
          const phoneData = await phoneResponse.json();
          wabaId = phoneData.whatsapp_business_account?.id;
        }
      }
      if (!wabaId) {
        return res.status(400).json({ message: "Could not determine WhatsApp Business Account. Please ensure the phone number is properly connected." });
      }

      const templatesResponse = await fetch(
        `${FACEBOOK_GRAPH_API_BASE}/${wabaId}/message_templates?access_token=${accessToken}`
      );

      if (!templatesResponse.ok) {
        const errorData = await templatesResponse.json().catch(() => ({}));
        throw new Error(errorData.error?.message || "Failed to fetch templates");
      }

      const templatesData = await templatesResponse.json();
      const templates = templatesData.data || [];

      res.json({
        success: true,
        templates,
        count: templates.length,
      });
    } catch (error: any) {
      console.error("Error fetching WhatsApp Business templates:", error);
      res.status(500).json({ 
        message: error.message || "Failed to fetch templates",
        error: error.message 
      });
    }
  });

  // Refresh phone number verification status (for PENDING numbers that may have auto-verified)
  app.post("/api/integrations/whatsapp-business/refresh-phone-status/:phoneNumberId", isAuthenticated, resolveOrganizationContext, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      const { phoneNumberId } = req.params;

      if (!phoneNumberId) {
        return res.status(400).json({ message: "Phone Number ID is required" });
      }

      const integration = await storage.getIntegrationByName("whatsapp-business", userId, organizationId);

      if (!integration || integration.status !== "connected" || !integration.credentials) {
        return res.status(404).json({ message: "WhatsApp Business integration not found or not connected" });
      }

      const credentials = integration.credentials as any;
      const accessToken = credentials.access_token;

      // Get phone number details including verification status
      const phoneResponse = await fetch(
        `${FACEBOOK_GRAPH_API_BASE}/${phoneNumberId}?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating&access_token=${accessToken}`
      );

      if (!phoneResponse.ok) {
        const errorData = await phoneResponse.json().catch(() => ({}));
        return res.status(phoneResponse.status).json({
          message: errorData.error?.message || "Failed to fetch phone number status",
          error: errorData.error,
        });
      }

      const phoneData = await phoneResponse.json();
      const verificationStatus = phoneData.code_verification_status || 'UNKNOWN';

      // Update session if it exists
      const sessions = await storage.getSessionsByUser(userId);
      const session = sessions.find(
        (s) => s.connectionType === 'official' && 
        s.deviceInfo?.apiPhoneNumberId === phoneNumberId
      );

      if (session) {
        await storage.updateSession(session.sessionId, {
          status: isVerified ? (session.status === 'disconnected' ? 'disconnected' : 'connected') : session.status,
          deviceInfo: {
            ...session.deviceInfo,
            codeVerificationStatus: verificationStatus,
            qualityRating: phoneData.quality_rating,
          },
        });
        console.log(`[Refresh Status] Updated session ${session.sessionId} with status: ${verificationStatus}`);
      }

      const isVerified = verificationStatus === 'VERIFIED';
      const canSendMessages = isVerified;

      res.json({
        success: true,
        phoneNumber: {
          id: phoneData.id,
          displayPhoneNumber: phoneData.display_phone_number,
          verifiedName: phoneData.verified_name,
          verificationStatus: verificationStatus,
          qualityRating: phoneData.quality_rating,
          isVerified: isVerified,
          canSendMessages: canSendMessages,
        },
        message: isVerified 
          ? "Phone number is now verified and ready to send messages"
          : verificationStatus === 'PENDING'
          ? "Phone number verification is still pending. If you used Embedded Signup, it may auto-verify shortly. Otherwise, please complete verification in Meta Business Manager."
          : verificationStatus === 'UNVERIFIED'
          ? "Phone number is not verified. Please verify it in Meta Business Manager."
          : `Phone number verification status: ${verificationStatus}. Please verify the phone number in Meta Business Manager.`,
        helpUrl: "https://business.facebook.com/help/149790234973220",
        updated: true,
      });
    } catch (error: any) {
      console.error("Error refreshing phone number status:", error);
      res.status(500).json({ 
        message: error.message || "Failed to refresh phone number status",
        error: error.message 
      });
    }
  });

  // Check phone number verification status
  app.get("/api/integrations/whatsapp-business/check-phone-status/:phoneNumberId", isAuthenticated, resolveOrganizationContext, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      const { phoneNumberId } = req.params;

      if (!phoneNumberId) {
        return res.status(400).json({ message: "Phone Number ID is required" });
      }

      const integration = await storage.getIntegrationByName("whatsapp-business", userId, organizationId);

      if (!integration || integration.status !== "connected" || !integration.credentials) {
        return res.status(404).json({ message: "WhatsApp Business integration not found or not connected" });
      }

      const credentials = integration.credentials as any;
      const accessToken = credentials.access_token;

      // Get phone number details including verification status
      const phoneResponse = await fetch(
        `${FACEBOOK_GRAPH_API_BASE}/${phoneNumberId}?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating&access_token=${accessToken}`
      );

      if (!phoneResponse.ok) {
        const errorData = await phoneResponse.json().catch(() => ({}));
        return res.status(phoneResponse.status).json({
          message: errorData.error?.message || "Failed to fetch phone number status",
          error: errorData.error,
        });
      }

      const phoneData = await phoneResponse.json();
      const verificationStatus = phoneData.code_verification_status || 'UNKNOWN';

      // Check if phone number is verified
      const isVerified = verificationStatus === 'VERIFIED';
      const canSendMessages = isVerified;

      res.json({
        success: true,
        phoneNumber: {
          id: phoneData.id,
          displayPhoneNumber: phoneData.display_phone_number,
          verifiedName: phoneData.verified_name,
          verificationStatus: verificationStatus,
          qualityRating: phoneData.quality_rating,
          isVerified: isVerified,
          canSendMessages: canSendMessages,
        },
        message: isVerified 
          ? "Phone number is verified and ready to send messages"
          : verificationStatus === 'PENDING'
          ? "Phone number verification is pending. Please complete verification in Meta Business Manager."
          : verificationStatus === 'UNVERIFIED'
          ? "Phone number is not verified. Please verify it in Meta Business Manager."
          : `Phone number verification status: ${verificationStatus}. Please verify the phone number in Meta Business Manager.`,
        helpUrl: "https://business.facebook.com/help/149790234973220",
      });
    } catch (error: any) {
      console.error("Error checking phone number status:", error);
      res.status(500).json({ 
        message: error.message || "Failed to check phone number status",
        error: error.message 
      });
    }
  });

  // Sync templates for a specific phone number
  app.post("/api/integrations/whatsapp-business/sync-templates/:phoneNumberId", isAuthenticated, resolveOrganizationContext, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      const { phoneNumberId } = req.params;

      if (!phoneNumberId) {
        return res.status(400).json({ message: "Phone Number ID is required" });
      }

      const sessions = await storage.getSessionsByUser(userId);
      const session = sessions.find(
        (s) => s.connectionType === 'official' && 
        s.deviceInfo?.apiPhoneNumberId === phoneNumberId
      );

      if (!session) {
        return res.status(404).json({ 
          message: `No session found for phone number ${phoneNumberId}. Please connect the phone number first.` 
        });
      }

      // Prefer integration from session (multi-account); fallback to getIntegrationByName
      let integration = session.deviceInfo?.integrationId
        ? await storage.getIntegration(session.deviceInfo.integrationId, userId)
        : null;
      if (!integration?.credentials) {
        integration = await storage.getIntegrationByName("whatsapp-business", userId, organizationId);
      }
      if (!integration || integration.status !== "connected" || !integration.credentials) {
        return res.status(404).json({ message: "WhatsApp Business integration not found or not connected" });
      }

      const credentials = integration.credentials as any;
      const accessToken = credentials.access_token;

      // Resolve WABA ID - prefer listing me/owned_whatsapp_business_accounts (phone node may not have whatsapp_business_account)
      let wabaId = session.deviceInfo?.wabaId;

      const resolveWabaFromAccountList = async (): Promise<string | null> => {
        const res = await fetch(
          `${FACEBOOK_GRAPH_API_BASE}/me/owned_whatsapp_business_accounts?fields=id,name,phone_numbers{id}&access_token=${accessToken}`
        );
        if (!res.ok) return null;
        const data = await res.json();
        const wabas = data.data || [];
        for (const waba of wabas) {
          const phones = waba.phone_numbers?.data || [];
          if (phones.some((p: any) => String(p.id) === String(phoneNumberId))) {
            return waba.id;
          }
        }
        return null;
      };

      const freshWabaId = await resolveWabaFromAccountList();
      if (freshWabaId) {
        wabaId = freshWabaId;
        if (session.deviceInfo?.wabaId !== freshWabaId) {
          await storage.updateSession(session.sessionId, {
            deviceInfo: { ...session.deviceInfo, wabaId: freshWabaId } as any,
          });
        }
      }

      if (!wabaId) {
        return res.status(400).json({
          message: `Could not determine WhatsApp Business Account for phone ${phoneNumberId}. Please reconnect the integration in Integrations → WhatsApp Business.`,
        });
      }

      // Import business API manager
      const { businessAPIManager } = await import('../../whatsapp/business-api-client');
      
      // Fetch templates using WABA ID
      const templates = await businessAPIManager.fetchMessageTemplates(
        {
          phoneNumberId: phoneNumberId,
          accessToken: accessToken,
          businessAccountId: session.deviceInfo?.businessAccountId,
        },
        wabaId
      );

      if (organizationId) {
        await storage.backfillMessageTemplatesOrganizationForPhone(userId, phoneNumberId, organizationId);
      }
      // Sync templates with org context when available
      await storage.syncMessageTemplates(userId, templates, phoneNumberId, organizationId || undefined);

      res.json({
        success: true,
        message: `Successfully synced ${templates.length} templates for phone ${phoneNumberId}`,
        count: templates.length,
      });
    } catch (error: any) {
      console.error("Error syncing templates:", error);
      res.status(500).json({ 
        message: error.message || "Failed to sync templates",
        error: error.message 
      });
    }
  });

  // Diagnostic endpoint to check why phone number is still PENDING
  app.get("/api/integrations/whatsapp-business/diagnose/:phoneNumberId", isAuthenticated, resolveOrganizationContext, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const phoneNumberId = req.params.phoneNumberId;
      
      if (!phoneNumberId) {
        return res.status(400).json({
          success: false,
          message: "Phone number ID is required"
        });
      }

      // Get integration to get access token
      const integration = await storage.getIntegrationByName("whatsapp-business", userId, req.organizationId);
      if (!integration || integration.status !== "connected") {
        return res.status(400).json({
          success: false,
          message: "WhatsApp Business integration not connected"
        });
      }

      const credentials = integration.credentials as any;
      const accessToken = credentials.access_token || credentials.accessToken;

      if (!accessToken) {
        return res.status(400).json({
          success: false,
          message: "Access token not found"
        });
      }

      const diagnostics: any = {
        phoneNumberId,
        timestamp: new Date().toISOString(),
        checks: {},
        recommendations: []
      };

      // Check 1: Phone number status
      try {
        const phoneResponse = await fetch(
          `${FACEBOOK_GRAPH_API_BASE}/${phoneNumberId}?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating,account_mode&access_token=${accessToken}`
        );
        
        if (phoneResponse.ok) {
          const phoneData = await phoneResponse.json();
          diagnostics.checks.phoneNumber = {
            status: 'ok',
            data: {
              displayPhoneNumber: phoneData.display_phone_number,
              verifiedName: phoneData.verified_name,
              codeVerificationStatus: phoneData.code_verification_status,
              qualityRating: phoneData.quality_rating,
              accountMode: phoneData.account_mode
            }
          };

          if (phoneData.code_verification_status === 'PENDING') {
            diagnostics.recommendations.push({
              priority: 'HIGH',
              issue: 'Phone number verification is PENDING',
              solutions: [
                '1. Check Meta Business Manager → Business Settings → Requests → Approve any pending connection requests',
                '2. Check if display name is "Pending Review" in Meta Dashboard → Wait 24-48 hours for approval',
                '3. Ensure business website URL is set in Business Settings → Business Info → Business Details',
                '4. Generate new access token in Meta Apps Dashboard → WhatsApp > API Setup → Generate Access Token',
                '5. Have someone send a message to the number to activate it'
              ]
            });
          }

          if (!phoneData.verified_name) {
            diagnostics.recommendations.push({
              priority: 'HIGH',
              issue: 'Display name is not set',
              solutions: [
                'Set display name in Meta Dashboard → WhatsApp Manager → Phone Numbers → Profile'
              ]
            });
          }
        } else {
          const errorData = await phoneResponse.json().catch(() => ({}));
          diagnostics.checks.phoneNumber = {
            status: 'error',
            error: errorData.error?.message || 'Unknown error',
            code: errorData.error?.code
          };
        }
      } catch (error: any) {
        diagnostics.checks.phoneNumber = {
          status: 'error',
          error: error.message
        };
      }

      // Check 2: Access token validity
      try {
        const tokenDebugResponse = await fetch(
          `${FACEBOOK_GRAPH_API_BASE}/debug_token?input_token=${accessToken}&access_token=${accessToken}`
        );
        
        if (tokenDebugResponse.ok) {
          const tokenDebugData = await tokenDebugResponse.json();
          const tokenData = tokenDebugData.data;
          
          diagnostics.checks.accessToken = {
            status: tokenData.is_valid ? 'ok' : 'error',
            isValid: tokenData.is_valid,
            expiresAt: tokenData.expires_at ? new Date(tokenData.expires_at * 1000).toISOString() : 'Never',
            scopes: tokenData.scopes || [],
            isExpired: tokenData.expires_at ? tokenData.expires_at * 1000 < Date.now() : false
          };

          if (!tokenData.is_valid || (tokenData.expires_at && tokenData.expires_at * 1000 < Date.now())) {
            diagnostics.recommendations.push({
              priority: 'CRITICAL',
              issue: 'Access token is invalid or expired',
              solutions: [
                'Go to Meta Apps Dashboard → WhatsApp > API Setup',
                'Select the phone number → Click "Generate Access Token"',
                'Select "Opt in to all current and future accounts" → Click Continue'
              ]
            });
          }
        }
      } catch (error: any) {
        diagnostics.checks.accessToken = {
          status: 'error',
          error: error.message
        };
      }

      // Check 3: WABA subscription
      try {
        // Try to get WABA ID from phone number
        const phoneResponse = await fetch(
          `${FACEBOOK_GRAPH_API_BASE}/${phoneNumberId}?fields=whatsapp_business_account&access_token=${accessToken}`
        );
        
        if (phoneResponse.ok) {
          const phoneData = await phoneResponse.json();
          const wabaId = phoneData.whatsapp_business_account?.id;
          
          if (wabaId) {
            // Check if app is subscribed to WABA
            const subscribedAppsResponse = await fetch(
              `${FACEBOOK_GRAPH_API_BASE}/${wabaId}/subscribed_apps?access_token=${accessToken}`
            );
            
            if (subscribedAppsResponse.ok) {
              const subscribedAppsData = await subscribedAppsResponse.json();
              const appId = process.env.FACEBOOK_APP_ID;
              const isSubscribed = subscribedAppsData.data?.some((app: any) => app.id === appId);
              
              diagnostics.checks.wabaSubscription = {
                status: isSubscribed ? 'ok' : 'error',
                wabaId,
                isSubscribed,
                subscribedApps: subscribedAppsData.data || []
              };

              if (!isSubscribed) {
                diagnostics.recommendations.push({
                  priority: 'CRITICAL',
                  issue: 'App is not subscribed to WABA',
                  solutions: [
                    'This should happen automatically during OAuth',
                    'If not subscribed, the number will remain PENDING',
                    'Try reconnecting the integration'
                  ]
                });
              }
            }
          }
        }
      } catch (error: any) {
        diagnostics.checks.wabaSubscription = {
          status: 'error',
          error: error.message
        };
      }

      // Check 4: Message templates (to verify number is registered)
      try {
        const templatesResponse = await fetch(
          `${FACEBOOK_GRAPH_API_BASE}/${phoneNumberId}/message_templates?access_token=${accessToken}`
        );
        
        if (templatesResponse.ok) {
          const templatesData = await templatesResponse.json();
          diagnostics.checks.messageTemplates = {
            status: 'ok',
            templateCount: templatesData.data?.length || 0,
            hasHelloWorld: templatesData.data?.some((t: any) => t.name === 'hello_world') || false
          };
        } else {
          const errorData = await templatesResponse.json().catch(() => ({}));
          diagnostics.checks.messageTemplates = {
            status: 'error',
            error: errorData.error?.message || 'Unknown error',
            code: errorData.error?.code
          };

          if (errorData.error?.code === 133010) {
            diagnostics.recommendations.push({
              priority: 'CRITICAL',
              issue: 'Phone number is not registered with WhatsApp Cloud API (Error 133010)',
              solutions: [
                'The number needs to be registered before it can send/receive messages',
                'This should happen automatically, but may need manual registration',
                'Try sending a message from another WhatsApp number to activate it'
              ]
            });
          }
        }
      } catch (error: any) {
        diagnostics.checks.messageTemplates = {
          status: 'error',
          error: error.message
        };
      }

      // Summary
      const criticalIssues = diagnostics.recommendations.filter((r: any) => r.priority === 'CRITICAL').length;
      const highIssues = diagnostics.recommendations.filter((r: any) => r.priority === 'HIGH').length;

      diagnostics.summary = {
        criticalIssues,
        highIssues,
        totalIssues: diagnostics.recommendations.length,
        status: criticalIssues > 0 ? 'CRITICAL' : highIssues > 0 ? 'NEEDS_ATTENTION' : 'OK'
      };

      res.json({
        success: true,
        diagnostics
      });
    } catch (error: any) {
      console.error(`[Diagnose Phone] Error:`, error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  });
}

