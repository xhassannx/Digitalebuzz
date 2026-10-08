// @ts-nocheck
import { randomBytes } from "crypto";
import { storage } from "../../storage";
import type { Express } from "express";
import { isAuthenticated } from "../../replitAuth";
import { resolveOrganizationContext } from "../../middleware/organization-context";
import {
  createOfficialSessionsForOAuthPhones,
  filterEligiblePhonesForInbox,
  mergePendingPhoneSelectionIntoConfig,
  summarizePhoneForPending,
} from "./whatsapp-oauth-phone-sessions";
import {
  completeEmbeddedSignupForUser,
  discoverAndCreateWhatsAppSessions,
  persistEmbeddedSignupSession,
  readEmbeddedSignupFromOAuthState,
  tryCompleteFromStashedSession,
} from "./whatsapp-embedded-signup-complete";
import {
  runWhatsAppPostOnboarding,
  resolveWhatsAppWebhookCallbackUri,
  webhookVerifyTokenForMetaOverride,
} from "./whatsapp-post-onboarding";

const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID; // WhatsApp Business uses same Facebook App
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
// Sanitize BASE_URL: strip newlines, # comments, extra spaces (common .env mistake: "url  \n# comment")
const BASE_URL = (process.env.BASE_URL || "http://localhost:5000")
  .split(/\s*[\n#]/)[0]
  .trim()
  .replace(/\/+$/, ""); // no trailing slash
// Webhook URL Meta calls: licensor CUSTOMER_API_BASE_URL when set, else WEBHOOK_URL / BASE_URL
const _metaWebhook = resolveWhatsAppWebhookCallbackUri();
const WEBHOOK_URL =
  _metaWebhook.url || `${BASE_URL}/api/webhooks/whatsapp-business`;
if (_metaWebhook.source === "central") {
  console.log(
    `[WhatsApp OAuth] Using central webhook for Meta: ${WEBHOOK_URL} (CUSTOMER_API_BASE_URL / OAUTH_CENTRAL_URL)`
  );
}
// Embedded Signup Config ID - Get this from Meta Dashboard > WhatsApp > Embedded Signup Builder
// It's the config_id shown in the "Choose a Login Configuration" dropdown (e.g., "ES Config")
const EMBEDDED_SIGNUP_CONFIG_ID = process.env.EMBEDDED_SIGNUP_CONFIG_ID || "";
const GRAPH_API_VERSION = "v23.0";
// Centralized OAuth: when set, authorize calls central server instead of building authUrl locally
// Set USE_CENTRALIZED_OAUTH=false to use local OAuth (with coexistence) while keeping CUSTOMER_API_BASE_URL/PRODUCTION_KEY for webhooks
const USE_CENTRALIZED_OAUTH = (process.env.USE_CENTRALIZED_OAUTH ?? "true").toLowerCase() !== "false";
const OAUTH_CENTRAL_URL = (process.env.OAUTH_CENTRAL_URL || process.env.CUSTOMER_API_BASE_URL || "").trim().replace(/\/+$/, "");
const PRODUCTION_KEY = (process.env.PRODUCTION_KEY || "").trim();
const FACEBOOK_GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// Note: For multi-tenant SaaS, we use the user's access token for subscription
// Each tenant can optionally provide their own system user token in integration credentials
// System User assignment is handled manually by each tenant in their Business Manager

const WHATSAPP_BUSINESS_SCOPES = [
  "whatsapp_business_messaging",
  "whatsapp_business_management",
  "business_management", // Required to access business accounts
  "pages_read_engagement", // Required to read page info
];

export function registerWhatsAppBusinessOAuthRoutes(app: Express) {
  const getUserId = (req: any): string => {
    return req.user?.claims?.sub || req.userId;
  };

  // Initiate WhatsApp Business OAuth flow
  app.get("/api/integrations/whatsapp-business/oauth/authorize", isAuthenticated, resolveOrganizationContext, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      const preferLocalEmbeddedSignup = Boolean(EMBEDDED_SIGNUP_CONFIG_ID?.trim());

      // Centralized OAuth: call central server to get authUrl (single redirect URL in Facebook Console)
      // Skip central when Embedded Signup is configured â€” central flow cannot receive WA_EMBEDDED_SIGNUP postMessage reliably
      if (
        USE_CENTRALIZED_OAUTH &&
        !preferLocalEmbeddedSignup &&
        OAUTH_CENTRAL_URL &&
        PRODUCTION_KEY
      ) {
        try {
          const centralRes = await fetch(`${OAUTH_CENTRAL_URL}/api/oauth/whatsapp/initiate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              customerInstanceUrl: BASE_URL,
              userId,
              organizationId: organizationId || undefined,
              returnPath: "/connect",
              authToken: PRODUCTION_KEY,
            }),
          });
          if (centralRes.ok) {
            const { authUrl } = await centralRes.json();
            if (authUrl) {
              console.log(`[WhatsApp OAuth] Using centralized OAuth from ${OAUTH_CENTRAL_URL}`);
              return res.json({ authUrl });
            }
          }
          const errText = await centralRes.text();
          console.error(`[WhatsApp OAuth] Central initiate failed:`, centralRes.status, errText);
        } catch (centralErr: any) {
          console.error("[WhatsApp OAuth] Central initiate error:", centralErr.message);
          return res.status(502).json({ message: "Failed to get OAuth URL from central server. Check OAUTH_CENTRAL_URL and PRODUCTION_KEY." });
        }
      }

      if (preferLocalEmbeddedSignup && USE_CENTRALIZED_OAUTH && OAUTH_CENTRAL_URL) {
        console.log(
          `[WhatsApp OAuth] Using local Embedded Signup OAuth (EMBEDDED_SIGNUP_CONFIG_ID set; required for WABA/phone session info)`
        );
      }

      if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
        return res.status(500).json({ message: "WhatsApp Business OAuth not configured. Please set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET in environment variables." });
      }

      // Local OAuth: generate state and build authUrl (requires this domain in Facebook redirect URIs)
      const state = randomBytes(32).toString("hex");
      const redirectUri = `${BASE_URL}/wb/callback`;

      await storage.createOAuthState({
        userId,
        organizationId,
        integrationName: "whatsapp-business",
        state,
        redirectUri,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      });

      // Build authorization URL with embedded signup flow
      // This enables the full setup flow with business portfolio selection, 
      // business information, and WhatsApp Business account/profile creation
      // Using v23.0 to match Meta's latest embedded signup requirements
      const scopes = WHATSAPP_BUSINESS_SCOPES.join(",");
      const authUrl = new URL("https://www.facebook.com/v23.0/dialog/oauth");
      authUrl.searchParams.set("client_id", FACEBOOK_APP_ID);
      authUrl.searchParams.set("app_id", FACEBOOK_APP_ID); // Also set app_id (required for embedded signup)
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("scope", scopes);
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("display", "popup"); // Use popup display for embedded signup
      authUrl.searchParams.set("override_default_response_type", "true"); // Match reference flow (app.veblika.com)
      
      const embeddedSignupExtras: {
        version: string;
        setup: Record<string, unknown>;
        features: Array<{ name: string }>;
        featureType: string;
        sessionInfoVersion: string;
      } = {
        version: "v4",
        setup: {},
        features: [{ name: "marketing_messages_lite" }],
        featureType: "whatsapp_business_app_onboarding",
        sessionInfoVersion: "3",
      };

      // Fill setup (partner business + optional credit-line solutionID)
      {
        const { buildEmbeddedSignupSetup } = await import("../../credit-line/embedded-signup");
        embeddedSignupExtras.setup = await buildEmbeddedSignupSetup(organizationId);
      }

      if (EMBEDDED_SIGNUP_CONFIG_ID && EMBEDDED_SIGNUP_CONFIG_ID.trim() !== "") {
        authUrl.searchParams.set("config_id", EMBEDDED_SIGNUP_CONFIG_ID.trim());
        const extras = {
          ...embeddedSignupExtras,
          setup: embeddedSignupExtras.setup || {},
        };
        authUrl.searchParams.set("extras", JSON.stringify(extras));
        
        console.log(`[WhatsApp OAuth] ðŸ“‹ Note: Phone numbers may show as PENDING if:`);
        console.log(`  - Business verification is incomplete (missing website, etc.)`);
        console.log(`  - Phone number hasn't been active on WhatsApp Business App for 7+ days`);
        console.log(`  - Business information is incomplete in Meta Business Manager`);
        console.log(`  - Phone number was previously connected to another WABA`);
        
        console.log(`[WhatsApp OAuth] âœ… Using Embedded Signup Config ID: ${EMBEDDED_SIGNUP_CONFIG_ID}`);
        console.log(`[WhatsApp OAuth] âœ… Enabled WhatsApp Business App Onboarding feature (coexistence)`);
        if ((embeddedSignupExtras.setup as any)?.solutionID) {
          console.log(
            `[WhatsApp OAuth] Credit-line solutionID set for Embedded Signup:`,
            (embeddedSignupExtras.setup as any).solutionID,
          );
        } else {
          console.warn(
            `[WhatsApp OAuth] No solutionID in Embedded Signup extras.setup — standard Meta ES (customer billing), not Interakt credit-line.`,
          );
          console.warn(
            `[WhatsApp OAuth] For credit-line: Admin → Users → set org billing mode to credit_line (Interakt enabled + Partner Solution ID). Meta Partner Solution must be ACTIVE.`,
          );
        }
        console.log(`[WhatsApp OAuth] âœ… Using API version v23.0 for embedded signup`);
        console.log(`[WhatsApp OAuth] Full OAuth URL (first 300 chars): ${authUrl.toString().substring(0, 300)}...`);
      } else {
        console.warn(`[WhatsApp OAuth] âš ï¸  EMBEDDED_SIGNUP_CONFIG_ID not set or empty!`);
        console.warn(`[WhatsApp OAuth] Current value: "${EMBEDDED_SIGNUP_CONFIG_ID}"`);
        console.warn(`[WhatsApp OAuth] This will show basic OAuth flow instead of full embedded signup.`);
        console.warn(`[WhatsApp OAuth] Add EMBEDDED_SIGNUP_CONFIG_ID=24760315386893718 to .env file`);
        console.warn(`[WhatsApp OAuth] Get config_id from: Meta Dashboard > WhatsApp > Embedded Signup Builder`);
      }

      const payload: Record<string, unknown> = {
        authUrl: authUrl.toString(),
        state,
        creditLineSignup: {
          solutionIdApplied: !!(embeddedSignupExtras.setup as any)?.solutionID,
          solutionId: (embeddedSignupExtras.setup as any)?.solutionID || null,
        },
      };
      if (EMBEDDED_SIGNUP_CONFIG_ID && EMBEDDED_SIGNUP_CONFIG_ID.trim() !== "") {
        payload.embeddedSignup = {
          appId: FACEBOOK_APP_ID,
          configId: EMBEDDED_SIGNUP_CONFIG_ID.trim(),
          state,
          callbackUrl: redirectUri,
          extras: embeddedSignupExtras,
        };
      }
      res.json(payload);
    } catch (error: any) {
      console.error("Error initiating WhatsApp Business OAuth:", error);
      res.status(500).json({ message: "Failed to initiate OAuth flow" });
    }
  });

  // WhatsApp Business OAuth callback
  app.get("/wb/callback", isAuthenticated, async (req: any, res) => {
    try {
      const { code, state, error, error_reason, error_description } = req.query;

      if (error) {
        const errorMsg = error_description || error_reason || error;
        const errorHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>WhatsApp Business OAuth Error</title>
          </head>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'WHATSAPP_BUSINESS_OAUTH_ERROR', 
                  error: '${errorMsg}' 
                }, '*');
                setTimeout(() => {
                  window.close();
                }, 2000);
              } else {
                window.location.href = '${BASE_URL}/integrations?error=${encodeURIComponent(errorMsg as string)}';
              }
            </script>
            <p>Error: ${errorMsg}. This window will close automatically...</p>
          </body>
          </html>
        `;
        return res.send(errorHtml);
      }

      if (!code || !state) {
        const errorHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>WhatsApp Business OAuth Error</title>
          </head>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'WHATSAPP_BUSINESS_OAUTH_ERROR', 
                  error: 'missing_parameters' 
                }, '*');
                setTimeout(() => {
                  window.close();
                }, 2000);
              } else {
                window.location.href = '${BASE_URL}/integrations?error=missing_parameters';
              }
            </script>
            <p>Missing parameters. This window will close automatically...</p>
          </body>
          </html>
        `;
        return res.send(errorHtml);
      }

      // Verify state
      let oauthState = await storage.getOAuthState(state as string);
      if (!oauthState) {
        console.warn(`[WhatsApp OAuth] State '${state}' not found directly in storage, attempting recovery...`);
        const fallbackUserId = req.user?.id || req.session?.passport?.user?.id;
        if (fallbackUserId) {
          oauthState = await storage.getLatestActiveOAuthState(fallbackUserId, "whatsapp-business");
        }
        if (!oauthState && fallbackUserId) {
          console.warn(`[WhatsApp OAuth] Recovering OAuth state from authenticated user ${fallbackUserId}`);
          oauthState = {
            id: "recovered",
            userId: fallbackUserId,
            organizationId: req.context?.organizationId || req.user?.currentOrganizationId || req.user?.organizationId,
            integrationName: "whatsapp-business",
            state: state as string,
            redirectUri: `${BASE_URL}/wb/callback`,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          } as any;
        }
      }
      if (!oauthState) {
        console.error(`[WhatsApp OAuth] ❌ Invalid or expired OAuth state: ${state}`);
        const errorHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>WhatsApp Business OAuth Error</title>
          </head>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'WHATSAPP_BUSINESS_OAUTH_ERROR', 
                  error: 'invalid_state' 
                }, '*');
                setTimeout(() => {
                  window.close();
                }, 2000);
              } else {
                window.location.href = '${BASE_URL}/integrations?error=invalid_state';
              }
            </script>
            <p>Invalid state. This window will close automatically...</p>
          </body>
          </html>
        `;
        return res.send(errorHtml);
      }

      const redirectUriForToken = oauthState.redirectUri || `${BASE_URL}/wb/callback`;

      // Exchange code for access token
      const tokenUrl = new URL("https://graph.facebook.com/v23.0/oauth/access_token");
      tokenUrl.searchParams.set("client_id", FACEBOOK_APP_ID!);
      tokenUrl.searchParams.set("client_secret", FACEBOOK_APP_SECRET!);
      tokenUrl.searchParams.set("redirect_uri", redirectUriForToken);
      tokenUrl.searchParams.set("code", code as string);

      console.log(`[WhatsApp OAuth] Token exchange redirect_uri=${redirectUriForToken}`);

      const tokenResponse = await fetch(tokenUrl.toString(), {
        method: "GET",
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        console.error("Token exchange error:", errorData);
        const errorHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>WhatsApp Business OAuth Error</title>
          </head>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'WHATSAPP_BUSINESS_OAUTH_ERROR', 
                  error: 'token_exchange_failed' 
                }, '*');
                setTimeout(() => {
                  window.close();
                }, 2000);
              } else {
                window.location.href = '${BASE_URL}/integrations?error=token_exchange_failed';
              }
            </script>
            <p>Token exchange failed. This window will close automatically...</p>
          </body>
          </html>
        `;
        return res.send(errorHtml);
      }

      const tokens = await tokenResponse.json();

      // Get long-lived token (60 days)
      const longLivedTokenUrl = new URL("https://graph.facebook.com/v23.0/oauth/access_token");
      longLivedTokenUrl.searchParams.set("grant_type", "fb_exchange_token");
      longLivedTokenUrl.searchParams.set("client_id", FACEBOOK_APP_ID!);
      longLivedTokenUrl.searchParams.set("client_secret", FACEBOOK_APP_SECRET!);
      longLivedTokenUrl.searchParams.set("fb_exchange_token", tokens.access_token);

      const longLivedResponse = await fetch(longLivedTokenUrl.toString(), {
        method: "GET",
      });

      let accessToken = tokens.access_token;
      let expiresAt = Date.now() + (tokens.expires_in * 1000);

      if (longLivedResponse.ok) {
        const longLivedTokens = await longLivedResponse.json();
        accessToken = longLivedTokens.access_token;
        expiresAt = Date.now() + (longLivedTokens.expires_in * 1000);
      }

      // Get user info
      const userInfoResponse = await fetch(`https://graph.facebook.com/v23.0/me?access_token=${accessToken}`);
      let userInfo: any = {};
      if (userInfoResponse.ok) {
        userInfo = await userInfoResponse.json();
      }

      // Save integration
      const existing = await storage.getIntegrationByName(
        "whatsapp-business",
        oauthState.userId,
        oauthState.organizationId || undefined
      );

      const credentials = {
        access_token: accessToken,
        expires_at: expiresAt,
        token_type: "Bearer",
      };

      const config = {
        userId: userInfo.id,
        name: userInfo.name,
      };

      // Always create a new integration to allow multiple WhatsApp Business accounts
      // Don't update existing - allow users to connect multiple Facebook accounts
      const newIntegration = await storage.createIntegration({
        userId: oauthState.userId,
        organizationId: oauthState.organizationId || undefined,
        name: "whatsapp-business",
        displayName: "WhatsApp Business",
        category: "featured",
        status: "connected",
        authType: "oauth",
        credentials,
        config,
      });
      console.log(`[WhatsApp OAuth] New integration created successfully (id: ${newIntegration.id})`);

      const embeddedFromOAuthState = readEmbeddedSignupFromOAuthState(oauthState);
      if (embeddedFromOAuthState?.wabaId || embeddedFromOAuthState?.phoneNumberId) {
        await persistEmbeddedSignupSession({
          userId: oauthState.userId,
          state: oauthState.state,
          wabaId: embeddedFromOAuthState.wabaId,
          phoneNumberId: embeddedFromOAuthState.phoneNumberId,
          businessId: embeddedFromOAuthState.businessId,
        });
      }

      /** When Meta returns multiple lines, we save pending phones and ask the user in the app (no .env needed). */
      let postOAuthPhonePickIntegrationId: string | null = null;

      // After OAuth callback, perform CRITICAL Embedded Signup post-flow steps
      // These steps are MANDATORY to prevent PENDING status
      try {
        console.log(`[WhatsApp OAuth] ðŸ”„ Performing Embedded Signup post-flow steps (sync=v3)...`);
        
        // Fetch all available phone numbers and WABAs
        const FACEBOOK_GRAPH_API_VERSION = "v23.0";
        const FACEBOOK_GRAPH_API_BASE = `https://graph.facebook.com/${FACEBOOK_GRAPH_API_VERSION}`;

        // credit_line + Partner Solution ID: TP-signup owns Meta Graph — do not re-call
        // subscribed_apps / assigned_users / register (overwrites Haptik/Interakt permissions).
        let skipMetaGraphSignupForCreditLine = false;
        try {
          const { shouldSkipMetaGraphSignupForCreditLine } = await import(
            "../../credit-line/skip-meta-graph-signup"
          );
          const skip = await shouldSkipMetaGraphSignupForCreditLine(oauthState.organizationId);
          skipMetaGraphSignupForCreditLine = skip.skip;
          if (skip.skip) {
            console.log(`[WhatsApp OAuth] Skipping Meta Graph signup mutations — ${skip.reason}`);
          }
        } catch (skipErr: any) {
          console.warn(
            `[WhatsApp OAuth] credit_line skip check failed:`,
            skipErr?.message || skipErr
          );
        }
        
        // Try multiple approaches to get phone numbers and WABAs
        // Use the same approach as the phone-numbers endpoint
        let allPhoneNumbers: any[] = [];
        let allWABAs: any[] = [];
        
        // Approach 0: Get WABA IDs from token granular scopes (MOST RELIABLE)
        let wabaIdsFromToken: string[] = [];
        try {
          console.log(`[WhatsApp OAuth] ðŸ”„ Checking token for WABA IDs in granular scopes...`);
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
              wabaIdsFromToken = [...new Set(wabaIdsFromToken)];
              if (wabaIdsFromToken.length > 0) {
                console.log(`[WhatsApp OAuth] âœ… Found ${wabaIdsFromToken.length} WABA ID(s) in token granular scopes: ${wabaIdsFromToken.join(', ')}`);
              } else {
                const grantedScopes = debugData.data?.scopes || [];
                console.warn(
                  `[WhatsApp OAuth] âš ï¸  No WABA IDs in granular scopes. Token scopes: ${grantedScopes.join(", ") || "none"}`
                );
                console.warn(
                  `[WhatsApp OAuth]    token type: ${debugData.data?.type || "unknown"}, user_id: ${debugData.data?.user_id || "n/a"}`
                );
                console.warn(
                  `[WhatsApp OAuth]    granular_scopes:`,
                  JSON.stringify(debugData.data.granular_scopes)
                );
                console.warn(
                  `[WhatsApp OAuth]    ðŸ’¡ If FINISH postMessage or account_update webhook fires, stashed WABA/phone will still be used`
                );
              }
            } else {
              console.warn(
                `[WhatsApp OAuth] âš ï¸  debug_token has no granular_scopes. scopes:`,
                (debugData.data?.scopes || []).join(", ") || "none"
              );
              console.warn(
                `[WhatsApp OAuth]    token type: ${debugData.data?.type || "unknown"}, user_id: ${debugData.data?.user_id || "n/a"}`
              );
            }
          } else {
            const dbgErr = await debugTokenResponse.json().catch(() => ({}));
            console.warn(
              `[WhatsApp OAuth] âš ï¸  debug_token failed:`,
              dbgErr.error?.message || debugTokenResponse.status
            );
          }
        } catch (error: any) {
          console.warn(`[WhatsApp OAuth] âš ï¸  Error checking token for WABA IDs:`, error.message);
        }

        // Embedded Signup postMessage may arrive before Graph lists WABAs â€” use stashed IDs
        if (wabaIdsFromToken.length === 0) {
          const fromStash = await tryCompleteFromStashedSession(oauthState.userId, accessToken, newIntegration.id);
          if (fromStash.length > 0) {
            allPhoneNumbers = allPhoneNumbers.concat(fromStash);
            for (const p of fromStash) {
              if (p.wabaId) allWABAs.push({ id: p.wabaId, name: p.wabaName || p.wabaId });
            }
            console.log(
              `[WhatsApp OAuth] âœ… Recovered ${fromStash.length} phone(s) from Embedded Signup session info`
            );
          }
        }
        
        // Fetch phone numbers from WABAs found in token
        if (wabaIdsFromToken.length > 0) {
          console.log(`[WhatsApp OAuth] ðŸ”„ Fetching phone numbers from WABAs found in token...`);
          for (const wabaId of wabaIdsFromToken) {
            try {
              allWABAs.push({ id: wabaId });
              
              const phoneNumbersResponse = await fetch(
                `${FACEBOOK_GRAPH_API_BASE}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating,last_onboarded_time&access_token=${accessToken}`
              );
              
              if (phoneNumbersResponse.ok) {
                const phoneNumbersData = await phoneNumbersResponse.json();
                const phoneNumbers = phoneNumbersData.data || [];
                console.log(`[WhatsApp OAuth] âœ… Found ${phoneNumbers.length} phone number(s) in WABA ${wabaId}`);
                
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
                  allPhoneNumbers = allPhoneNumbers.concat(enrichedNumbers);
                } catch (wabaInfoError: any) {
                  const enrichedNumbers = phoneNumbers.map((phone: any) => ({
                    ...phone,
                    wabaId: wabaId,
                    wabaName: wabaId,
                  }));
                  allPhoneNumbers = allPhoneNumbers.concat(enrichedNumbers);
                }
              } else {
                const errorData = await phoneNumbersResponse.json().catch(() => ({}));
                console.warn(`[WhatsApp OAuth] âš ï¸  Failed to fetch phone numbers for WABA ${wabaId}:`, errorData.error?.message || 'Unknown error');
              }
            } catch (error: any) {
              console.error(`[WhatsApp OAuth] âŒ Error fetching phone numbers for WABA ${wabaId}:`, error.message);
            }
          }
        }
        
        // Approach 1: Get via business accounts (fallback)
        if (allPhoneNumbers.length === 0) {
          try {
            console.log(`[WhatsApp OAuth] ðŸ”„ Fetching business accounts (fallback)...`);
            const businessAccountsResponse = await fetch(
              `${FACEBOOK_GRAPH_API_BASE}/me/businesses?fields=id,name&access_token=${accessToken}`
            );
            
            if (businessAccountsResponse.ok) {
              const businessAccountsData = await businessAccountsResponse.json();
              const businessAccounts = businessAccountsData.data || [];
              console.log(`[WhatsApp OAuth] âœ… Found ${businessAccounts.length} business account(s)`);
              
              for (const businessAccount of businessAccounts) {
                try {
                  const wabaResponse = await fetch(
                    `${FACEBOOK_GRAPH_API_BASE}/${businessAccount.id}/owned_whatsapp_business_accounts?fields=id,name&access_token=${accessToken}`
                  );
                  
                  if (wabaResponse.ok) {
                    const wabaData = await wabaResponse.json();
                    const wabaAccounts = wabaData.data || [];
                    
                    for (const waba of wabaAccounts) {
                      allWABAs.push({
                        id: waba.id,
                        name: waba.name,
                        businessAccountId: businessAccount.id,
                        businessAccountName: businessAccount.name,
                      });
                      
                      const phoneNumbersResponse = await fetch(
                        `${FACEBOOK_GRAPH_API_BASE}/${waba.id}/phone_numbers?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating,last_onboarded_time&access_token=${accessToken}`
                      );
                      
                      if (phoneNumbersResponse.ok) {
                        const phoneNumbersData = await phoneNumbersResponse.json();
                        const phoneNumbers = phoneNumbersData.data || [];
                        
                        const enrichedNumbers = phoneNumbers.map((phone: any) => ({
                          ...phone,
                          businessAccountId: businessAccount.id,
                          businessAccountName: businessAccount.name,
                          wabaId: waba.id,
                          wabaName: waba.name,
                        }));
                        allPhoneNumbers = allPhoneNumbers.concat(enrichedNumbers);
                      }
                    }
                  }
                } catch (error: any) {
                  console.warn(`[WhatsApp OAuth] âš ï¸  Error fetching WABAs for business ${businessAccount.id}:`, error.message);
                }
              }
            } else {
              const errorData = await businessAccountsResponse.json().catch(() => ({}));
              console.warn(`[WhatsApp OAuth] âš ï¸  Failed to fetch business accounts:`, errorData.error?.message || 'Unknown error');
            }
          } catch (error: any) {
            console.error(`[WhatsApp OAuth] âŒ Error fetching via business accounts:`, error.message);
          }
        }

        // Approach 2: me/owned_whatsapp_business_accounts (direct WABA access - works when me/businesses is empty)
        if (allPhoneNumbers.length === 0) {
          try {
            console.log(`[WhatsApp OAuth] ðŸ”„ Fetching owned WABAs directly (fallback)...`);
            const wabaDirectResponse = await fetch(
              `${FACEBOOK_GRAPH_API_BASE}/me/owned_whatsapp_business_accounts?fields=id,name&access_token=${accessToken}`
            );
            if (wabaDirectResponse.ok) {
              const wabaDirectData = await wabaDirectResponse.json();
              const wabaAccounts = wabaDirectData.data || [];
              console.log(`[WhatsApp OAuth] âœ… Found ${wabaAccounts.length} WABA(s) via me/owned_whatsapp_business_accounts`);
              for (const waba of wabaAccounts) {
                allWABAs.push({ id: waba.id, name: waba.name });
                const phoneNumbersResponse = await fetch(
                  `${FACEBOOK_GRAPH_API_BASE}/${waba.id}/phone_numbers?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating,last_onboarded_time&access_token=${accessToken}`
                );
                if (phoneNumbersResponse.ok) {
                  const phoneNumbersData = await phoneNumbersResponse.json();
                  const phoneNumbers = phoneNumbersData.data || [];
                  const enrichedNumbers = phoneNumbers.map((phone: any) => ({
                    ...phone,
                    wabaId: waba.id,
                    wabaName: waba.name,
                  }));
                  allPhoneNumbers = allPhoneNumbers.concat(enrichedNumbers);
                }
              }
            }
          } catch (error: any) {
            console.warn(`[WhatsApp OAuth] âš ï¸  Error fetching owned WABAs:`, error.message);
          }
        }
        
        // Deduplicate phone numbers and WABAs
        const seenPhoneIds = new Map<string, any>();
        for (const phone of allPhoneNumbers) {
          const phoneId = phone.id;
          if (phoneId && !seenPhoneIds.has(phoneId)) {
            seenPhoneIds.set(phoneId, phone);
          }
        }
        allPhoneNumbers = Array.from(seenPhoneIds.values());

        if (allPhoneNumbers.length > 1) {
          const preview = allPhoneNumbers
            .map((p) => `${p.display_phone_number || p.id} (WABA ${p.wabaName || p.wabaId})`)
            .join("; ");
          console.log(
            `[WhatsApp OAuth] Token returned ${allPhoneNumbers.length} Cloud API line(s) (often one per WABA), not duplicates of one number: ${preview}`
          );
        }
        const eligiblePhones = filterEligiblePhonesForInbox(allPhoneNumbers);
        const deferMultiLinePicker = eligiblePhones.length > 1;
        const phonesForAutoSession = deferMultiLinePicker ? [] : eligiblePhones;

        const seenWabaIds = new Map<string, any>();
        for (const waba of allWABAs) {
          if (waba.id && !seenWabaIds.has(waba.id)) {
            seenWabaIds.set(waba.id, waba);
          }
        }
        allWABAs = Array.from(seenWabaIds.values());
        
        console.log(`[WhatsApp OAuth] Found ${allPhoneNumbers.length} phone number(s) and ${allWABAs.length} WABA(s) after OAuth connection`);
        
        // CRITICAL: For Embedded Signup, perform required post-signup steps
        // These steps are MANDATORY to prevent PENDING status
        
        // Collect unique WABA IDs from both phone numbers and direct WABA list
        const uniqueWabaIds = new Set<string>();
        for (const phone of allPhoneNumbers) {
          if (phone.wabaId) {
            uniqueWabaIds.add(phone.wabaId);
          }
        }
        for (const waba of allWABAs) {
          if (waba.id) {
            uniqueWabaIds.add(waba.id);
          }
        }
        
        // Add WABA IDs from token granular scopes (already fetched above)
        for (const wabaId of wabaIdsFromToken) {
          uniqueWabaIds.add(wabaId);
        }
        
        console.log(`[WhatsApp OAuth] ðŸ”„ Found ${uniqueWabaIds.size} unique WABA(s) to subscribe`);
        
        if (uniqueWabaIds.size === 0) {
          console.warn(`[WhatsApp OAuth] âš ï¸  No WABAs found to subscribe!`);
          console.warn(`[WhatsApp OAuth]    This might mean:`);
          console.warn(`[WhatsApp OAuth]    1. Embedded Signup hasn't created WABA yet (will retry in 30 seconds)`);
          console.warn(`[WhatsApp OAuth]    2. Access token doesn't have whatsapp_business_management permission`);
          console.warn(`[WhatsApp OAuth]    3. Phone numbers need to be added manually first`);
          
          // Schedule a retry after 30 seconds to check for WABAs/phone numbers
          // Embedded Signup might take a few moments to create WABAs
          setTimeout(async () => {
            try {
              console.log(`[WhatsApp OAuth] ðŸ”„ Retrying to find WABAs and phone numbers after 30 seconds...`);
              
              // Retry fetching phone numbers
              const retryWabaIds: string[] = [];
              const retryDebugTokenResponse = await fetch(
                `${FACEBOOK_GRAPH_API_BASE}/debug_token?input_token=${accessToken}&access_token=${FACEBOOK_APP_ID || ''}|${FACEBOOK_APP_SECRET || ''}`
              );
              
              if (retryDebugTokenResponse.ok) {
                const retryDebugData = await retryDebugTokenResponse.json();
                if (retryDebugData.data?.granular_scopes) {
                  for (const scope of retryDebugData.data.granular_scopes) {
                    if (scope.scope === 'whatsapp_business_management' || scope.scope === 'whatsapp_business_messaging') {
                      if (scope.target_ids && Array.isArray(scope.target_ids)) {
                        for (const wabaId of scope.target_ids) {
                          if (!retryWabaIds.includes(wabaId)) {
                            retryWabaIds.push(wabaId);
                          }
                        }
                      }
                    }
                  }
                }
              }
              
              // Subscribe to any WABAs found
              for (const wabaId of retryWabaIds) {
                try {
                  if (skipMetaGraphSignupForCreditLine) {
                    console.log(
                      `[WhatsApp OAuth] Retry: skip Meta subscribed_apps for WABA ${wabaId} (credit_line + solutionID)`
                    );
                    continue;
                  }
                  const retrySubscribeResponse = await fetch(
                    `${FACEBOOK_GRAPH_API_BASE}/${wabaId}/subscribed_apps`,
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
                  
                  if (retrySubscribeResponse.ok) {
                    console.log(`[WhatsApp OAuth] âœ… Retry: App subscribed to WABA ${wabaId} successfully`);
                  }
                } catch (error: any) {
                  console.warn(`[WhatsApp OAuth] âš ï¸  Retry: Error subscribing to WABA ${wabaId}:`, error.message);
                }
              }
            } catch (error: any) {
              console.error(`[WhatsApp OAuth] âŒ Error in retry:`, error.message);
            }
          }, 30000); // 30 seconds delay
        }
        
        // Step 1: Subscribe App to WABA (CRITICAL - #1 cause of PENDING)
        // This is REQUIRED after Embedded Signup
        // Without this, status will remain PENDING forever
        // For multi-tenant: Use user's access token (works for most cases)
        // If user has provided system user token in credentials, use that instead
        const integrationCredentials = existing?.credentials as any || {};
        const userSystemToken = integrationCredentials.system_user_token;
        
        // CRITICAL: Try System User token first (if available), then fallback to user token
        // System User tokens are more reliable for subscription
        // The other SaaS likely uses System User token for this step
        const tokenForSubscription = userSystemToken || accessToken;
        
        // Step 1.5: Verify access token is valid and not expired
        // According to Heltar blog: Expired or invalid access tokens cause PENDING status
        try {
          console.log(`[WhatsApp OAuth] ðŸ”„ Verifying access token validity...`);
          const tokenDebugResponse = await fetch(
            `${FACEBOOK_GRAPH_API_BASE}/debug_token?input_token=${accessToken}&access_token=${accessToken}`
          );
          
          if (tokenDebugResponse.ok) {
            const tokenDebugData = await tokenDebugResponse.json();
            const tokenData = tokenDebugData.data;
            
            if (tokenData.is_valid) {
              console.log(`[WhatsApp OAuth] âœ… Access token is valid`);
              console.log(`[WhatsApp OAuth]    Expires at: ${tokenData.expires_at ? new Date(tokenData.expires_at * 1000).toISOString() : 'Never'}`);
              console.log(`[WhatsApp OAuth]    Scopes: ${tokenData.scopes?.join(', ') || 'N/A'}`);
              
              // Check if token is expired
              if (tokenData.expires_at && tokenData.expires_at * 1000 < Date.now()) {
                console.warn(`[WhatsApp OAuth] âš ï¸  Access token is EXPIRED - this can cause PENDING status`);
                console.warn(`[WhatsApp OAuth]    ðŸ’¡ Solution: Generate new access token in Meta Apps Dashboard`);
                console.warn(`[WhatsApp OAuth]    ðŸ’¡ Go to WhatsApp > API Setup > Generate Access Token`);
              }
            } else {
              console.warn(`[WhatsApp OAuth] âš ï¸  Access token is INVALID - this will cause PENDING status`);
              console.warn(`[WhatsApp OAuth]    Error: ${tokenDebugData.error?.message || 'Unknown error'}`);
              console.warn(`[WhatsApp OAuth]    ðŸ’¡ Solution: Generate new access token in Meta Apps Dashboard`);
            }
          }
        } catch (tokenError: any) {
          console.warn(`[WhatsApp OAuth] âš ï¸  Could not verify access token:`, tokenError.message);
        }
        
        // Step 1.6: Check business portfolio details (especially website)
        // According to Heltar blog: Missing business website causes PENDING status
        try {
          console.log(`[WhatsApp OAuth] ðŸ”„ Checking business portfolio details...`);
          
          // Try to fetch business account info to check if details are complete
          for (const wabaId of uniqueWabaIds) {
            try {
              const businessInfoResponse = await fetch(
                `${FACEBOOK_GRAPH_API_BASE}/${wabaId}?fields=id,name,timezone_id,message_template_namespace&access_token=${accessToken}`
              );
              
              if (businessInfoResponse.ok) {
                const businessInfo = await businessInfoResponse.json();
                console.log(`[WhatsApp OAuth] âœ… WABA ${wabaId} details:`, businessInfo.name || 'N/A');
                console.log(`[WhatsApp OAuth]    ðŸ’¡ Ensure business website is set in Meta Business Manager`);
                console.log(`[WhatsApp OAuth]    ðŸ’¡ Go to Business Settings > Business Info > Business Details`);
                console.log(`[WhatsApp OAuth]    ðŸ’¡ Missing website URL can cause PENDING status`);
              }
            } catch (businessError: any) {
              // Ignore - not critical
            }
          }
        } catch (portfolioError: any) {
          // Ignore - not critical
        }
        
        // Step 1.7: Verify webhook is configured (optional check, but helpful)
        // Note: Webhook should be configured in Meta Dashboard before this
        console.log(`[WhatsApp OAuth] ðŸ“‹ Webhook URL: ${WEBHOOK_URL}`);
        console.log(`[WhatsApp OAuth]    Ensure this is configured in Meta Dashboard â†’ WhatsApp â†’ Configuration â†’ Webhooks`);
        console.log(`[WhatsApp OAuth]    Verify token: ${process.env.WEBHOOK_VERIFY_TOKEN || 'Not set in .env'}`);
        
        for (const wabaId of uniqueWabaIds) {
          try {
            if (skipMetaGraphSignupForCreditLine) {
              console.log(
                `[WhatsApp OAuth] Skipping Meta Graph subscribed_apps for WABA ${wabaId} (credit_line + solutionID — TP signup owns this)`
              );
              continue;
            }
            console.log(`[WhatsApp OAuth] ðŸ”„ Subscribing app to WABA ${wabaId} (REQUIRED STEP)...`);
            console.log(`[WhatsApp OAuth]    Using ${userSystemToken ? 'user-provided system user' : 'user access'} token`);
            console.log(`[WhatsApp OAuth]    âš ï¸  If subscription fails, try using a System User token (more reliable)`);
            
            // CRITICAL: Subscribe app to WABA (STEP 1) - Based on working Laravel reference
            // Laravel does: POST /{WABA_ID}/subscribed_apps with NO body (empty call)
            // This ensures the app is subscribed to the WABA
            console.log(`[WhatsApp OAuth] ðŸ”„ Step 1: Subscribing app to WABA ${wabaId} (Laravel reference method)...`);
            const subscribeResponse = await fetch(
              `${FACEBOOK_GRAPH_API_BASE}/${wabaId}/subscribed_apps`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${tokenForSubscription}`,
                  'Content-Type': 'application/json',
                },
                // Laravel reference: First call has NO body parameters
                body: JSON.stringify({}),
              }
            );
            
            if (subscribeResponse.ok) {
              const subscribeData = await subscribeResponse.json();
              console.log(`[WhatsApp OAuth] âœ… Step 1: App subscribed to WABA ${wabaId} successfully`);
              console.log(`[WhatsApp OAuth]    Response:`, JSON.stringify(subscribeData));
              
              // CRITICAL: Override callback URI with our webhook URL (STEP 2)
              // Based on working Laravel reference: This is what makes numbers show as CONNECTED
              // Laravel does: POST /{WABA_ID}/subscribed_apps with override_callback_uri and verify_token
              const webhookVerifyToken = webhookVerifyTokenForMetaOverride();
              console.log(`[WhatsApp OAuth] ðŸ”„ Step 2: Overriding webhook callback URI (CRITICAL for CONNECTED status)...`);
              console.log(`[WhatsApp OAuth]    Webhook URL: ${WEBHOOK_URL}`);
              console.log(`[WhatsApp OAuth]    Verify Token: ${webhookVerifyToken}`);
              
              const webhookOverrideResponse = await fetch(
                `${FACEBOOK_GRAPH_API_BASE}/${wabaId}/subscribed_apps`,
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${tokenForSubscription}`,
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
                console.log(`[WhatsApp OAuth] âœ… Step 2: Webhook callback URI overridden successfully`);
                console.log(`[WhatsApp OAuth]    Response:`, JSON.stringify(webhookOverrideData));
                
                // CRITICAL STEP 3: Verify webhook override was successful (Laravel reference does this)
                // Laravel fetches subscribed_apps after override to verify
                console.log(`[WhatsApp OAuth] ðŸ”„ Step 3: Verifying webhook subscription...`);
                const verifyResponse = await fetch(
                  `${FACEBOOK_GRAPH_API_BASE}/${wabaId}/subscribed_apps?access_token=${tokenForSubscription}`
                );
                
                if (verifyResponse.ok) {
                  const verifyData = await verifyResponse.json();
                  console.log(`[WhatsApp OAuth] âœ… Step 3: Webhook subscription verified`);
                  console.log(`[WhatsApp OAuth]    Subscribed apps:`, JSON.stringify(verifyData));
                  
                  // Check if our webhook URL is in the response
                  const hasWebhookOverride = JSON.stringify(verifyData).includes(WEBHOOK_URL);
                  if (hasWebhookOverride) {
                    console.log(`[WhatsApp OAuth]    âœ… Webhook URL confirmed in subscription`);
                  }
                }
                
                console.log(`[WhatsApp OAuth]    ðŸŽ‰ This is CRITICAL - this makes numbers show as CONNECTED on Meta`);
                console.log(`[WhatsApp OAuth]    âœ… All subscription steps completed - phone numbers should activate`);
              } else {
                const webhookOverrideError = await webhookOverrideResponse.json().catch(() => ({}));
                console.error(`[WhatsApp OAuth] âŒ Step 2: Failed to override webhook callback URI`);
                console.error(`[WhatsApp OAuth]    Error:`, webhookOverrideError.error?.message || 'Unknown error');
                console.error(`[WhatsApp OAuth]    Error code:`, webhookOverrideError.error?.code);
                console.error(`[WhatsApp OAuth]    âš ï¸  CRITICAL: Without webhook override, numbers will remain PENDING`);
                console.error(`[WhatsApp OAuth]    Webhook URL: ${WEBHOOK_URL}`);
                console.error(`[WhatsApp OAuth]    Verify Token: ${webhookVerifyToken}`);
              }
              
              // CRITICAL: Wait a moment after subscription for Meta to process
              await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
              console.log(`[WhatsApp OAuth]    â³ Waited 2 seconds for Meta to process subscription...`);
            } else {
              const errorData = await subscribeResponse.json().catch(() => ({}));
              const errorCode = errorData.error?.code;
              const errorMessage = errorData.error?.message || 'Unknown error';
              
              console.error(`[WhatsApp OAuth] âŒ Failed to subscribe app to WABA ${wabaId}`);
              console.error(`[WhatsApp OAuth]    Error: ${errorMessage}`);
              console.error(`[WhatsApp OAuth]    Error code: ${errorCode}`);
              console.error(`[WhatsApp OAuth]    Status: ${subscribeResponse.status}`);
              console.error(`[WhatsApp OAuth]    âš ï¸  CRITICAL: Without app subscription, phone numbers will remain PENDING`);
              
              // Try with user access token as fallback if system token was used and failed
              if (userSystemToken && tokenForSubscription === userSystemToken) {
                console.log(`[WhatsApp OAuth] ðŸ”„ Retrying subscription with user access token...`);
                const retrySubscribeResponse = await fetch(
                  `${FACEBOOK_GRAPH_API_BASE}/${wabaId}/subscribed_apps`,
                  {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${accessToken}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      subscribed_fields: ['messages', 'message_template_status_update']
                      // Note: callback_url is NOT accepted by Meta API - webhook is configured separately in Dashboard
                    }),
                  }
                );
                
                if (retrySubscribeResponse.ok) {
                  console.log(`[WhatsApp OAuth] âœ… App subscribed to WABA ${wabaId} using user token`);
                } else {
                  const retryErrorData = await retrySubscribeResponse.json().catch(() => ({}));
                  console.error(`[WhatsApp OAuth] âŒ Retry also failed:`, retryErrorData.error?.message || 'Unknown error');
                }
              }
              
              // Check for common error codes
              if (errorCode === 100) {
                console.error(`[WhatsApp OAuth]    ðŸ’¡ This might mean the app doesn't have permission to subscribe`);
                console.error(`[WhatsApp OAuth]    ðŸ’¡ Ensure app has Advanced Access for whatsapp_business_messaging`);
                console.error(`[WhatsApp OAuth]    ðŸ’¡ Or provide a System User Token in integration settings`);
              } else if (errorCode === 190) {
                console.error(`[WhatsApp OAuth]    ðŸ’¡ This might mean the access token doesn't have required permissions`);
                console.error(`[WhatsApp OAuth]    ðŸ’¡ Ensure token has whatsapp_business_management permission`);
              }
            }
          } catch (subscribeError: any) {
            console.error(`[WhatsApp OAuth] âŒ Error subscribing app to WABA ${wabaId}:`, subscribeError.message);
          }
        }
        
        // Step 2: Assign System User to WABA (Multi-tenant: Optional, per-tenant)
        // For multi-tenant SaaS, each tenant manages their own System User
        // If user has provided system user token and ID, try to assign automatically
        const userSystemUserId = integrationCredentials.system_user_id;
        
        if (userSystemToken && userSystemUserId) {
          // Try to assign system user automatically
          for (const wabaId of uniqueWabaIds) {
            try {
              if (skipMetaGraphSignupForCreditLine) {
                console.log(
                  `[WhatsApp OAuth] Skipping Meta assigned_users for WABA ${wabaId} (credit_line + solutionID)`
                );
                continue;
              }
              console.log(`[WhatsApp OAuth] ðŸ”„ Assigning System User to WABA ${wabaId}...`);
              const assignUserResponse = await fetch(
                `${FACEBOOK_GRAPH_API_BASE}/${wabaId}/assigned_users`,
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${userSystemToken}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    user: userSystemUserId,
                    role: 'ADMIN',
                  }),
                }
              );
              
              if (assignUserResponse.ok) {
                const assignData = await assignUserResponse.json();
                console.log(`[WhatsApp OAuth] âœ… System User assigned to WABA ${wabaId} successfully`);
              } else {
                const errorData = await assignUserResponse.json().catch(() => ({}));
                console.warn(`[WhatsApp OAuth] âš ï¸  Failed to assign System User:`, errorData.error?.message || 'Unknown error');
                console.warn(`[WhatsApp OAuth]    This may require manual assignment in Business Manager`);
              }
            } catch (assignError: any) {
              console.warn(`[WhatsApp OAuth] âš ï¸  Error assigning System User:`, assignError.message);
            }
          }
        } else {
          // Log instructions for manual assignment (multi-tenant friendly)
          console.log(`[WhatsApp OAuth] ðŸ“‹ IMPORTANT: System User Assignment (Optional)`);
          console.log(`[WhatsApp OAuth]    For best results, assign System User to WABA in your Business Manager:`);
          console.log(`[WhatsApp OAuth]    1. Go to Meta Business Manager â†’ Business Settings â†’ System Users`);
          console.log(`[WhatsApp OAuth]    2. Select your System User (or create one)`);
          console.log(`[WhatsApp OAuth]    3. Click "Assign Assets"`);
          console.log(`[WhatsApp OAuth]    4. Assign WhatsApp Business Account with FULL CONTROL`);
          console.log(`[WhatsApp OAuth]    5. Assign Phone Number with FULL CONTROL`);
          console.log(`[WhatsApp OAuth]    Note: This is optional - subscription with user token usually works`);
        }
        
        // For each phone number, perform post-signup activation steps
        // CRITICAL: Based on Laravel reference, we need to:
        // 1. Check phone number platform_type BEFORE webhook subscription
        // 2. Register phone number if platform_type != 'CLOUD_API'
        // 3. Then proceed with webhook subscription
        for (const phone of allPhoneNumbers) {
          try {
            console.log(`[WhatsApp OAuth] ðŸ”„ Processing phone number ${phone.id}...`);
            
            // Step 1: Fetch phone number details with platform_type (Laravel reference)
            // Laravel fetches: display_phone_number,certificate,name_status,new_certificate,new_name_status,last_onboarded_time
            // But also checks platform_type, so we need to include it
            let phoneNumberRecord: any = null;
            let platformType = 'UNKNOWN';
            
            if (phone.wabaId) {
              try {
                console.log(`[WhatsApp OAuth] ðŸ”„ Fetching phone number records from WABA ${phone.wabaId}...`);
                // Laravel uses: GET /{WABA_ID}/phone_numbers?fields=display_phone_number,certificate,name_status,new_certificate,new_name_status,last_onboarded_time
                // But we also need platform_type
                const phoneNumbersResponse = await fetch(
                  `${FACEBOOK_GRAPH_API_BASE}/${phone.wabaId}/phone_numbers?fields=id,display_phone_number,platform_type,certificate,name_status,new_certificate,new_name_status,last_onboarded_time&access_token=${accessToken}`
                );
                
                if (phoneNumbersResponse.ok) {
                  const phoneNumbersData = await phoneNumbersResponse.json();
                  const phoneNumbers = phoneNumbersData.data || [];
                  
                  // Find the current phone number record (Laravel reference line 91-93)
                  phoneNumberRecord = phoneNumbers.find((p: any) => p.id === phone.id);
                  
                  if (phoneNumberRecord) {
                    platformType = phoneNumberRecord.platform_type || 'UNKNOWN';
                    console.log(`[WhatsApp OAuth] âœ… Found phone number record`);
                    console.log(`[WhatsApp OAuth]    Platform Type: ${platformType}`);
                    console.log(`[WhatsApp OAuth]    Display Number: ${phoneNumberRecord.display_phone_number || 'N/A'}`);
                    
                    // CRITICAL: Check platform_type and register if needed (Laravel reference lines 95-114)
                    // This is what makes the number show as "Registered" instead of "Verified"
                    if (platformType !== 'CLOUD_API') {
                      if (skipMetaGraphSignupForCreditLine) {
                        console.log(
                          `[WhatsApp OAuth] Skipping Meta /register for phone ${phone.id} (credit_line + solutionID — TP signup owns registration)`
                        );
                      } else {
                      console.warn(`[WhatsApp OAuth] âš ï¸  Phone number platform_type is ${platformType}, not CLOUD_API`);
                      console.warn(`[WhatsApp OAuth]    Registering phone number with WhatsApp Cloud API to get "Registered" status...`);
                      
                      try {
                        // Laravel reference: POST /{PHONE_NUMBER_ID}/register with messaging_product and pin
                        // CRITICAL: Laravel ALWAYS includes PIN '123456' when platform_type != 'CLOUD_API'
                        // This is what makes the number show as "Registered" instead of "Verified"
                        // For Embedded Signup, PIN might not be required, but including it ensures proper registration
                        console.log(`[WhatsApp OAuth]    Calling /register with PIN (like Laravel) to get "Registered" status...`);
                        
                        const registerResponse = await fetch(
                          `${FACEBOOK_GRAPH_API_BASE}/${phone.id}/register`,
                          {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${accessToken}`,
                            },
                            body: JSON.stringify({
                              messaging_product: 'whatsapp',
                              pin: '123456', // Laravel ALWAYS includes this - ensures "Registered" status instead of "Verified"
                              // Note: For Embedded Signup, PIN might not be required, but including it ensures proper registration
                              // If PIN is wrong, Meta will return an error, but for most cases this works
                            }),
                          }
                        );
                        
                        if (registerResponse.ok) {
                          const registerData = await registerResponse.json();
                          console.log(`[WhatsApp OAuth] âœ… Phone number registered successfully with WhatsApp Cloud API`);
                          console.log(`[WhatsApp OAuth]    Response:`, JSON.stringify(registerData));
                          console.log(`[WhatsApp OAuth]    ðŸ’¡ Number should now show as "Registered" instead of "Verified"`);
                          
                          // Fetch updated phone numbers (Laravel reference line 110)
                          // Wait a moment for Meta to update the status
                          await new Promise(resolve => setTimeout(resolve, 2000));
                          
                          const updatedPhoneNumbersResponse = await fetch(
                            `${FACEBOOK_GRAPH_API_BASE}/${phone.wabaId}/phone_numbers?fields=id,display_phone_number,platform_type&access_token=${accessToken}`
                          );
                          
                          if (updatedPhoneNumbersResponse.ok) {
                            const updatedPhoneNumbersData = await updatedPhoneNumbersResponse.json();
                            const updatedPhoneNumbers = updatedPhoneNumbersData.data || [];
                            phoneNumberRecord = updatedPhoneNumbers.find((p: any) => p.id === phone.id);
                            if (phoneNumberRecord) {
                              platformType = phoneNumberRecord.platform_type || 'UNKNOWN';
                              console.log(`[WhatsApp OAuth]    Updated Platform Type: ${platformType}`);
                              console.log(`[WhatsApp OAuth]    âœ… Number should now be "Registered" in Meta Dashboard`);
                            }
                          }
                        } else {
                          const registerError = await registerResponse.json().catch(() => ({}));
                          console.warn(`[WhatsApp OAuth] âš ï¸  Phone number registration failed:`, registerError.error?.message || 'Unknown error');
                          console.warn(`[WhatsApp OAuth]    Error code:`, registerError.error?.code);
                          console.warn(`[WhatsApp OAuth]    ðŸ’¡ If PIN is required, check SMS for 6-digit PIN from Meta`);
                          console.warn(`[WhatsApp OAuth]    ðŸ’¡ Then use POST /api/integrations/whatsapp-business/register-phone with PIN`);
                        }
                      } catch (registerError: any) {
                        console.warn(`[WhatsApp OAuth] âš ï¸  Error registering phone number:`, registerError.message);
                      }
                      }
                    } else {
                      console.log(`[WhatsApp OAuth] âœ… Phone number platform_type is CLOUD_API - already registered with Cloud API`);
                      console.log(`[WhatsApp OAuth]    ðŸ’¡ Number should show as "Registered" in Meta Dashboard`);
                      console.log(`[WhatsApp OAuth]    ðŸ’¡ No /register call needed - CLOUD_API means already registered`);
                      console.log(`[WhatsApp OAuth]    ðŸ’¡ Proceeding with webhook subscription to ensure "Registered" status`);
                      
                      // CRITICAL: For CLOUD_API numbers, we need to ensure they're fully activated
                      // Access message templates to "touch" the number and ensure it's active
                      try {
                        console.log(`[WhatsApp OAuth] ðŸ”„ Verifying CLOUD_API number is active by accessing message templates...`);
                        const templatesVerifyResponse = await fetch(
                          `${FACEBOOK_GRAPH_API_BASE}/${phone.id}/message_templates?access_token=${accessToken}`
                        );
                        
                        if (templatesVerifyResponse.ok) {
                          const templatesData = await templatesVerifyResponse.json();
                          const templates = templatesData.data || [];
                          console.log(`[WhatsApp OAuth] âœ… CLOUD_API number is active - found ${templates.length} template(s)`);
                          console.log(`[WhatsApp OAuth]    ðŸ’¡ Number should now show as "Registered" in Meta Dashboard`);
                          numberRegistered = true; // Mark as registered for later steps
                          useHelloWorld = templates.some((t: any) => t.name === 'hello_world');
                        } else {
                          const errorData = await templatesVerifyResponse.json().catch(() => ({}));
                          console.warn(`[WhatsApp OAuth] âš ï¸  Could not access templates:`, errorData.error?.message || 'Unknown error');
                          console.warn(`[WhatsApp OAuth]    This might mean the number needs activation`);
                        }
                      } catch (verifyError: any) {
                        console.warn(`[WhatsApp OAuth] âš ï¸  Error verifying number:`, verifyError.message);
                      }
                    }
                  } else {
                    console.warn(`[WhatsApp OAuth] âš ï¸  Phone number ${phone.id} not found in WABA's phone numbers list`);
                  }
                }
              } catch (phoneNumbersError: any) {
                console.warn(`[WhatsApp OAuth] âš ï¸  Error fetching phone numbers from WABA:`, phoneNumbersError.message);
              }
            }
            
            // Step 2: Fetch phone number details for status check
            const phoneTouchResponse = await fetch(
              `${FACEBOOK_GRAPH_API_BASE}/${phone.id}?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating&access_token=${accessToken}`
            );
            
            if (phoneTouchResponse.ok) {
              const phoneData = await phoneTouchResponse.json();
              console.log(`[WhatsApp OAuth] âœ… Phone number details fetched for ${phone.id} (${phoneData.display_phone_number || phone.id})`);
              console.log(`[WhatsApp OAuth]    Status: ${phoneData.code_verification_status || 'UNKNOWN'}`);
              console.log(`[WhatsApp OAuth]    Platform Type: ${platformType}`);
              
              // Step 3: If phone has a WABA ID, fetch WABA details to register the connection
              if (phone.wabaId) {
                try {
                  const wabaResponse = await fetch(
                    `${FACEBOOK_GRAPH_API_BASE}/${phone.wabaId}?fields=id,name,phone_numbers{id,display_phone_number,code_verification_status}&access_token=${accessToken}`
                  );
                  
                  if (wabaResponse.ok) {
                    const wabaData = await wabaResponse.json();
                    console.log(`[WhatsApp OAuth] âœ… Registered connection via WABA: ${wabaData.name || phone.wabaId}`);
                    
                    // Check if phone number is in WABA's phone numbers list
                    if (wabaData.phone_numbers?.data) {
                      const phoneInWaba = wabaData.phone_numbers.data.find((p: any) => p.id === phone.id);
                      if (phoneInWaba) {
                        console.log(`[WhatsApp OAuth] âœ… Phone number found in WABA's phone numbers list`);
                        console.log(`[WhatsApp OAuth]    Phone status in WABA: ${phoneInWaba.code_verification_status || 'UNKNOWN'}`);
                      }
                    }
                  }
                } catch (wabaError: any) {
                  console.warn(`[WhatsApp OAuth] âš ï¸  Error registering via WABA:`, wabaError.message);
                }
              }
              
              // Step 3: CRITICAL - Register phone number with WhatsApp Cloud API
              // This makes the number available for receiving messages in WhatsApp
              // Even for Embedded Signup, we may need to call /register if number is not available
              // Check if number is available first, then register if needed
              // Initialize these variables here - they may be set in platform_type check above
              let useHelloWorld = false;
              let numberRegistered = false;
              
              // First, try to check if number is available by fetching templates
              try {
                console.log(`[WhatsApp OAuth] ðŸ”„ Checking if phone number is registered with WhatsApp...`);
                
                const templatesCheckResponse = await fetch(
                  `${FACEBOOK_GRAPH_API_BASE}/${phone.id}/message_templates?access_token=${accessToken}`
                );
                
                if (templatesCheckResponse.ok) {
                  const templatesData = await templatesCheckResponse.json();
                  const templates = templatesData.data || [];
                  useHelloWorld = templates.some((t: any) => t.name === 'hello_world');
                  console.log(`[WhatsApp OAuth] âœ… Phone number is accessible - found ${templates.length} template(s)`);
                  console.log(`[WhatsApp OAuth]    hello_world exists: ${useHelloWorld}`);
                  numberRegistered = true;
                } else {
                  const errorData = await templatesCheckResponse.json().catch(() => ({}));
                  const errorCode = errorData.error?.code;
                  
                  // If number is not registered (error 133010), try to register it
                  if (errorCode === 133010) {
                    if (skipMetaGraphSignupForCreditLine) {
                      console.log(
                        `[WhatsApp OAuth] Skipping Meta /register after 133010 (credit_line + solutionID — TP signup owns registration)`
                      );
                    } else {
                    console.warn(`[WhatsApp OAuth] âš ï¸  Phone number not registered (Error 133010)`);
                    console.warn(`[WhatsApp OAuth]    Number is not available in WhatsApp - cannot receive messages`);
                    console.warn(`[WhatsApp OAuth]    This is why you can't send messages from WhatsApp app to this number`);
                    console.warn(`[WhatsApp OAuth]    Attempting to register number with WhatsApp Cloud API...`);
                    
                    // Try to register the number (without PIN - for Embedded Signup, PIN is not needed)
                    // Note: For Embedded Signup, Meta should auto-register, but if it didn't, we try here
                    try {
                      const registerResponse = await fetch(
                        `${FACEBOOK_GRAPH_API_BASE}/${phone.id}/register`,
                        {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${accessToken}`,
                          },
                          body: JSON.stringify({
                            messaging_product: 'whatsapp',
                            // Don't include PIN - for Embedded Signup, registration should be automatic
                          }),
                        }
                      );
                      
                      if (registerResponse.ok) {
                        const registerData = await registerResponse.json();
                        console.log(`[WhatsApp OAuth] âœ… Phone number registered successfully with WhatsApp Cloud API`);
                        console.log(`[WhatsApp OAuth]    Response:`, JSON.stringify(registerData));
                        console.log(`[WhatsApp OAuth]    Number should now be available for receiving messages`);
                        numberRegistered = true;
                        
                        // Wait a moment for registration to process
                        await new Promise(resolve => setTimeout(resolve, 2000));
                      } else {
                        const registerErrorData = await registerResponse.json().catch(() => ({}));
                        const registerErrorCode = registerErrorData.error?.code;
                        const registerErrorMessage = registerErrorData.error?.message || 'Unknown error';
                        
                        // For Embedded Signup, Meta should auto-register
                        // If registration fails, it's likely a timing issue - retry automatically
                        console.warn(`[WhatsApp OAuth] âš ï¸  Registration failed (may be timing issue)`);
                        console.warn(`[WhatsApp OAuth]    For Embedded Signup, Meta should auto-register`);
                        console.warn(`[WhatsApp OAuth]    Automatically retrying in 30 seconds, then 2 minutes, then 5 minutes...`);
                        
                        // Automatic retries with increasing delays
                        const registrationRetryDelays = [30 * 1000, 2 * 60 * 1000, 5 * 60 * 1000]; // 30s, 2min, 5min
                        
                        registrationRetryDelays.forEach((delay, index) => {
                          setTimeout(async () => {
                            try {
                              console.log(`[WhatsApp OAuth] ðŸ”„ [Auto Retry ${index + 1}/${registrationRetryDelays.length}] Attempting registration...`);
                              
                              const retryRegisterResponse = await fetch(
                                `${FACEBOOK_GRAPH_API_BASE}/${phone.id}/register`,
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
                                console.log(`[WhatsApp OAuth] âœ… [Auto Retry ${index + 1}] Registration succeeded!`);
                                console.log(`[WhatsApp OAuth]    Number is now available for receiving messages`);
                                numberRegistered = true;
                                
                                // Verify registration by fetching templates
                                try {
                                  const verifyTemplatesResponse = await fetch(
                                    `${FACEBOOK_GRAPH_API_BASE}/${phone.id}/message_templates?access_token=${accessToken}`
                                  );
                                  if (verifyTemplatesResponse.ok) {
                                    console.log(`[WhatsApp OAuth] âœ… Verified: Number is now accessible`);
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
                                  console.warn(`[WhatsApp OAuth] âš ï¸  [Auto Retry ${index + 1}] All retries exhausted`);
                                  console.warn(`[WhatsApp OAuth]    Error: ${retryErrorMessage} (code: ${retryErrorCode})`);
                                  console.warn(`[WhatsApp OAuth]    Meta may auto-register the number within 5-10 minutes`);
                                  console.warn(`[WhatsApp OAuth]    Number will become available automatically`);
                                } else {
                                  console.log(`[WhatsApp OAuth] âš ï¸  [Auto Retry ${index + 1}] Still not registered: ${retryErrorMessage}`);
                                  console.log(`[WhatsApp OAuth]    Will retry again in ${(registrationRetryDelays[index + 1] - delay) / 1000} seconds...`);
                                }
                              }
                            } catch (retryError: any) {
                              if (index === registrationRetryDelays.length - 1) {
                                console.warn(`[WhatsApp OAuth] âš ï¸  [Auto Retry ${index + 1}] All retries exhausted`);
                                console.warn(`[WhatsApp OAuth]    Meta may auto-register the number within 5-10 minutes`);
                              }
                            }
                          }, delay);
                        });
                      }
                    } catch (registerError: any) {
                      console.warn(`[WhatsApp OAuth] âš ï¸  Error attempting registration:`, registerError.message);
                    }
                    }
                  } else {
                    console.warn(`[WhatsApp OAuth] âš ï¸  Could not check templates:`, errorData.error?.message || 'Unknown error');
                  }
                }
              } catch (templatesError: any) {
                console.warn(`[WhatsApp OAuth] âš ï¸  Error checking phone number registration:`, templatesError.message);
              }
              
              // If number is registered, fetch templates again to get hello_world status
              if (numberRegistered) {
                try {
                  const templatesResponse = await fetch(
                    `${FACEBOOK_GRAPH_API_BASE}/${phone.id}/message_templates?access_token=${accessToken}`
                  );
                  
                  if (templatesResponse.ok) {
                    const templatesData = await templatesResponse.json();
                    const templates = templatesData.data || [];
                    useHelloWorld = templates.some((t: any) => t.name === 'hello_world');
                    console.log(`[WhatsApp OAuth] âœ… Connection registered via message templates endpoint`);
                    console.log(`[WhatsApp OAuth]    Found ${templates.length} template(s), hello_world exists: ${useHelloWorld}`);
                  }
                } catch (templatesError: any) {
                  console.warn(`[WhatsApp OAuth] âš ï¸  Error fetching templates after registration:`, templatesError.message);
                }
              }
              
              // Step 4: Register connection via business account (if available)
              // This helps Meta recognize the phone number is connected to our SaaS
              if (phone.businessAccountId) {
                try {
                  console.log(`[WhatsApp OAuth] ðŸ”„ Registering connection via business account ${phone.businessAccountId}...`);
                  
                  const businessAccountResponse = await fetch(
                    `${FACEBOOK_GRAPH_API_BASE}/${phone.businessAccountId}?fields=id,name,owned_whatsapp_business_accounts{id,name,phone_numbers{id}}&access_token=${accessToken}`
                  );
                  
                  if (businessAccountResponse.ok) {
                    const businessAccountData = await businessAccountResponse.json();
                    console.log(`[WhatsApp OAuth] âœ… Registered connection via business account: ${businessAccountData.name || phone.businessAccountId}`);
                  }
                } catch (businessAccountError: any) {
                  console.warn(`[WhatsApp OAuth] âš ï¸  Error registering via business account:`, businessAccountError.message);
                }
              }
              
              // Step 5: Wait a moment for registration to process
              await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
              console.log(`[WhatsApp OAuth]    â³ Waited 2 seconds for Meta to process registration...`);
              
              // Step 6: Send test template message to trigger status change to CONNECTED
              // CRITICAL: This is what triggers PENDING â†’ CONNECTED status change
              // Must use template message (hello_world) - free-form messages won't work
              // Do this AFTER registration to ensure connection is registered first
              try {
                console.log(`[WhatsApp OAuth] ðŸ”„ Sending test template message to activate phone number (CRITICAL)...`);
                
                // Send template message if hello_world exists, otherwise try free-form
                const testMessageResponse = await fetch(
                  `${FACEBOOK_GRAPH_API_BASE}/${phone.id}/messages`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${accessToken}`,
                    },
                    body: JSON.stringify(useHelloWorld ? {
                      messaging_product: 'whatsapp',
                      to: phone.display_phone_number || phone.id,
                      type: 'template',
                      template: {
                        name: 'hello_world',
                        language: {
                          code: 'en_US'
                        }
                      }
                    } : {
                      messaging_product: 'whatsapp',
                      to: phone.display_phone_number || phone.id,
                      type: 'text',
                      text: {
                        body: 'WhatsApp Connected Successfully âœ…'
                      }
                    }),
                  }
                );
                
                if (testMessageResponse.ok) {
                  const testMessageData = await testMessageResponse.json();
                  console.log(`[WhatsApp OAuth] âœ… Test message sent successfully`);
                  console.log(`[WhatsApp OAuth]    Message ID: ${testMessageData.messages?.[0]?.id || 'N/A'}`);
                  console.log(`[WhatsApp OAuth]    Type: ${useHelloWorld ? 'template (hello_world)' : 'text'}`);
                  console.log(`[WhatsApp OAuth]    This should trigger status change to CONNECTED on Meta`);
                  console.log(`[WhatsApp OAuth]    Status usually updates within 1-5 minutes`);
                } else {
                  const errorData = await testMessageResponse.json().catch(() => ({}));
                  const errorCode = errorData.error?.code;
                  const errorMessage = errorData.error?.message || 'Unknown error';
                  
                  console.warn(`[WhatsApp OAuth] âš ï¸  Test message not sent:`, errorMessage);
                  console.warn(`[WhatsApp OAuth]    Error code: ${errorCode}`);
                  
                  if (errorCode === 133010) {
                    console.error(`[WhatsApp OAuth] âŒ CRITICAL: Account not registered (Error 133010)`);
                    console.error(`[WhatsApp OAuth]    This means the phone number is VERIFIED but not yet activated for messaging`);
                    console.error(`[WhatsApp OAuth]    This is a timing issue - number needs first message to activate, but can't send until activated`);
                    console.error(`[WhatsApp OAuth]    Solution:`);
                    console.error(`[WhatsApp OAuth]    âœ… Webhook is now configured - this is good!`);
                    console.error(`[WhatsApp OAuth]    ðŸ”„ Scheduling background retry to send test message...`);
                    console.error(`[WhatsApp OAuth]    ðŸ“‹ Will automatically retry in 2 minutes, then 5 minutes, then 10 minutes`);
                    
                    // Schedule multiple background retries with increasing delays
                    const retryDelays = [2 * 60 * 1000, 5 * 60 * 1000, 10 * 60 * 1000]; // 2 min, 5 min, 10 min
                    
                    retryDelays.forEach((delay, index) => {
                      setTimeout(async () => {
                        try {
                          console.log(`[WhatsApp OAuth] ðŸ”„ [Background Retry ${index + 1}/${retryDelays.length}] Attempting to send test message...`);
                          console.log(`[WhatsApp OAuth]    Phone Number ID: ${phone.id}`);
                          console.log(`[WhatsApp OAuth]    Display Number: ${phone.display_phone_number}`);
                          
                          const retryMessageResponse = await fetch(
                            `${FACEBOOK_GRAPH_API_BASE}/${phone.id}/messages`,
                            {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${accessToken}`,
                              },
                              body: JSON.stringify(useHelloWorld ? {
                                messaging_product: 'whatsapp',
                                to: phone.display_phone_number || phone.id,
                                type: 'template',
                                template: {
                                  name: 'hello_world',
                                  language: {
                                    code: 'en_US'
                                  }
                                }
                              } : {
                                messaging_product: 'whatsapp',
                                to: phone.display_phone_number || phone.id,
                                type: 'text',
                                text: {
                                  body: 'WhatsApp Connected Successfully âœ…'
                                }
                              }),
                            }
                          );
                          
                          if (retryMessageResponse.ok) {
                            const retryMessageData = await retryMessageResponse.json();
                            console.log(`[WhatsApp OAuth] âœ… [Background Retry ${index + 1}] Test message sent successfully!`);
                            console.log(`[WhatsApp OAuth]    Message ID: ${retryMessageData.messages?.[0]?.id || 'N/A'}`);
                            console.log(`[WhatsApp OAuth]    Type: ${useHelloWorld ? 'template (hello_world)' : 'text'}`);
                            console.log(`[WhatsApp OAuth]    ðŸŽ‰ Phone number should now be activated and show as CONNECTED on Meta`);
                            console.log(`[WhatsApp OAuth]    Status usually updates within 1-5 minutes`);
                            return; // Success - stop retrying
                          } else {
                            const retryErrorData = await retryMessageResponse.json().catch(() => ({}));
                            const retryErrorCode = retryErrorData.error?.code;
                            const retryErrorMessage = retryErrorData.error?.message || 'Unknown error';
                            
                            if (retryErrorCode === 133010) {
                              console.log(`[WhatsApp OAuth] âš ï¸  [Background Retry ${index + 1}] Still not registered:`, retryErrorMessage);
                              if (index === retryDelays.length - 1) {
                                console.log(`[WhatsApp OAuth]    All retries exhausted. Will wait for user to send first message instead.`);
                              } else {
                                console.log(`[WhatsApp OAuth]    Will retry again in ${(retryDelays[index + 1] - delay) / 1000 / 60} minutes...`);
                              }
                            } else {
                              console.log(`[WhatsApp OAuth] âš ï¸  [Background Retry ${index + 1}] Failed:`, retryErrorMessage);
                              console.log(`[WhatsApp OAuth]    Error code: ${retryErrorCode}`);
                            }
                          }
                        } catch (retryError: any) {
                          console.log(`[WhatsApp OAuth] âš ï¸  [Background Retry ${index + 1}] Error:`, retryError.message);
                          if (index === retryDelays.length - 1) {
                            console.log(`[WhatsApp OAuth]    All retries exhausted. Will wait for user to send first message instead.`);
                          }
                        }
                      }, delay);
                    });
                  } else {
                    console.warn(`[WhatsApp OAuth]    This may be because:`);
                    console.warn(`[WhatsApp OAuth]    1. Phone number is not VERIFIED yet`);
                    console.warn(`[WhatsApp OAuth]    2. hello_world template not approved`);
                    console.warn(`[WhatsApp OAuth]    3. Webhook not configured in Meta`);
                    console.warn(`[WhatsApp OAuth]    Phone number will still work once these are resolved`);
                  }
                }
              } catch (testMessageError: any) {
                console.warn(`[WhatsApp OAuth] âš ï¸  Could not send test message:`, testMessageError.message);
                console.warn(`[WhatsApp OAuth]    This is not critical - status will update after first successful message`);
                // Background retry is already scheduled in the error handling block above
              }
              
              // Step 7: Verify phone number status and display name approval
              try {
                // Wait a moment for Meta to process the connection
                await new Promise(resolve => setTimeout(resolve, 2000)); // Increased to 2 seconds
                
                const statusCheckResponse = await fetch(
                  `${FACEBOOK_GRAPH_API_BASE}/${phone.id}?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating&access_token=${accessToken}`
                );
                
                if (statusCheckResponse.ok) {
                  const statusData = await statusCheckResponse.json();
                  console.log(`[WhatsApp OAuth] âœ… Phone number verification status: ${statusData.code_verification_status || 'UNKNOWN'}`);
                  console.log(`[WhatsApp OAuth]    Display Name: ${statusData.verified_name || 'N/A'}`);
                  
                  // Check if display name is approved (critical for CONNECTED status)
                  // Note: Display name approval status is not directly available via API
                  // But if verified_name exists, it usually means it's approved or in review
                  if (statusData.verified_name) {
                    console.log(`[WhatsApp OAuth]    Display name "${statusData.verified_name}" is set`);
                    console.log(`[WhatsApp OAuth]    âš ï¸  If display name is "Pending Review" in Meta Dashboard, this can block CONNECTED status`);
                    console.log(`[WhatsApp OAuth]    ðŸ’¡ Wait for Meta to approve display name (usually 24-48 hours)`);
                  } else {
                    console.warn(`[WhatsApp OAuth]    âš ï¸  No display name set - this may cause PENDING status`);
                  }
                  
                  // CRITICAL: Check for pending connection requests (from Heltar blog)
                  // Connection requests in Meta Business Settings must be approved
                  console.log(`[WhatsApp OAuth] ðŸ“‹ IMPORTANT: Check for Pending Connection Requests`);
                  console.log(`[WhatsApp OAuth]    ðŸ’¡ Go to Meta Business Manager â†’ Business Settings â†’ Requests`);
                  console.log(`[WhatsApp OAuth]    ðŸ’¡ If you see a connection request from this app, click "Approve"`);
                  console.log(`[WhatsApp OAuth]    ðŸ’¡ Pending requests can cause PENDING status (MOST COMMON CAUSE)`);
                  
                  if (statusData.code_verification_status === 'VERIFIED') {
                    console.log(`[WhatsApp OAuth] âœ… Phone number is VERIFIED - should show as CONNECTED on Meta`);
                    console.log(`[WhatsApp OAuth]    All activation steps completed:`);
                    console.log(`[WhatsApp OAuth]    âœ… App subscribed to WABA`);
                    console.log(`[WhatsApp OAuth]    âœ… Connection registered via message templates`);
                    console.log(`[WhatsApp OAuth]    âœ… Test message sent (or scheduled for retry)`);
                    console.log(`[WhatsApp OAuth]    ðŸ“‹ Status should change to CONNECTED within 1-5 minutes`);
                    console.log(`[WhatsApp OAuth]    ðŸ“‹ If still PENDING, check these common causes (from Heltar blog):`);
                    console.log(`[WhatsApp OAuth]       1. âš ï¸  PENDING CONNECTION REQUEST (MOST COMMON)`);
                    console.log(`[WhatsApp OAuth]          â†’ Meta Business Manager â†’ Business Settings â†’ Requests`);
                    console.log(`[WhatsApp OAuth]          â†’ Approve any pending connection requests from this app`);
                    console.log(`[WhatsApp OAuth]       2. âš ï¸  Display name "Pending Review"`);
                    console.log(`[WhatsApp OAuth]          â†’ Wait 24-48 hours for Meta to approve display name`);
                    console.log(`[WhatsApp OAuth]          â†’ Check Meta Dashboard â†’ WhatsApp Manager â†’ Phone Numbers`);
                    console.log(`[WhatsApp OAuth]       3. âš ï¸  Missing Business Website URL`);
                    console.log(`[WhatsApp OAuth]          â†’ Business Settings â†’ Business Info â†’ Business Details`);
                    console.log(`[WhatsApp OAuth]          â†’ Add a valid business website URL (CRITICAL)`);
                    console.log(`[WhatsApp OAuth]       4. âš ï¸  Expired or Invalid Access Token`);
                    console.log(`[WhatsApp OAuth]          â†’ Meta Apps Dashboard â†’ WhatsApp > API Setup`);
                    console.log(`[WhatsApp OAuth]          â†’ Click "Generate Access Token" to refresh`);
                    console.log(`[WhatsApp OAuth]          â†’ Select "Opt in to all current and future accounts"`);
                    console.log(`[WhatsApp OAuth]       5. âš ï¸  Webhook not configured or verified`);
                    console.log(`[WhatsApp OAuth]          â†’ Meta Dashboard â†’ WhatsApp â†’ Configuration â†’ Webhooks`);
                    console.log(`[WhatsApp OAuth]          â†’ Configure webhook URL and verify token`);
                    console.log(`[WhatsApp OAuth]       6. âš ï¸  First message not sent/received yet`);
                    console.log(`[WhatsApp OAuth]          â†’ Have someone send a message to activate the number`);
                    console.log(`[WhatsApp OAuth]          â†’ Or wait 5-30 minutes for Meta to auto-activate`);
                  } else if (statusData.code_verification_status === 'PENDING') {
                    console.warn(`[WhatsApp OAuth] âš ï¸  Phone number is still PENDING`);
                    console.warn(`[WhatsApp OAuth]    CRITICAL: Follow these steps to fix (from Heltar blog):`);
                    console.warn(`[WhatsApp OAuth]    1. âš ï¸  APPROVE CONNECTION REQUEST (MOST COMMON FIX)`);
                    console.warn(`[WhatsApp OAuth]       â†’ Meta Business Manager â†’ Business Settings â†’ Requests`);
                    console.warn(`[WhatsApp OAuth]       â†’ Find pending request from this app â†’ Click "Approve"`);
                    console.warn(`[WhatsApp OAuth]    2. âš ï¸  GENERATE NEW ACCESS TOKEN`);
                    console.warn(`[WhatsApp OAuth]       â†’ Meta Apps Dashboard â†’ WhatsApp > API Setup`);
                    console.warn(`[WhatsApp OAuth]       â†’ Select pending phone number â†’ "Generate Access Token"`);
                    console.warn(`[WhatsApp OAuth]       â†’ Select "Opt in to all current and future accounts"`);
                    console.warn(`[WhatsApp OAuth]    3. âš ï¸  COMPLETE BUSINESS PORTFOLIO DETAILS`);
                    console.warn(`[WhatsApp OAuth]       â†’ Business Settings â†’ Business Info â†’ Business Details`);
                    console.warn(`[WhatsApp OAuth]       â†’ Ensure ALL fields are filled, especially WEBSITE URL`);
                    console.warn(`[WhatsApp OAuth]    4. âš ï¸  WAIT FOR DISPLAY NAME APPROVAL`);
                    console.warn(`[WhatsApp OAuth]       â†’ Check Meta Dashboard â†’ WhatsApp Manager â†’ Phone Numbers`);
                    console.warn(`[WhatsApp OAuth]       â†’ If display name shows "Pending Review", wait 24-48 hours`);
                    console.warn(`[WhatsApp OAuth]    5. âš ï¸  WAIT FOR META REVIEW (up to 48 hours)`);
                    console.warn(`[WhatsApp OAuth]       â†’ Meta may take up to 48 hours to review new accounts`);
                    console.warn(`[WhatsApp OAuth]       â†’ Status will change to CONNECTED after review completes`);
                  }
                }
              } catch (statusError: any) {
                console.warn(`[WhatsApp OAuth] âš ï¸  Error checking final status:`, statusError.message);
              }
            } else {
              const errorData = await phoneTouchResponse.json().catch(() => ({}));
              console.warn(`[WhatsApp OAuth] âš ï¸  Could not trigger access token generation for phone ${phone.id}:`, errorData.error?.message || 'Unknown error');
            }
          } catch (error: any) {
            console.error(`[WhatsApp OAuth] Error triggering access token generation for phone ${phone.id}:`, error.message);
          }
        }
        
        // CRITICAL: Add inbox sessions. Multiple Meta lines â†’ save pending + in-app picker (no .env).
        if (deferMultiLinePicker) {
          postOAuthPhonePickIntegrationId = newIntegration.id;
          const pending = {
            phones: eligiblePhones.map(summarizePhoneForPending),
            createdAt: Date.now(),
          };
          await storage.updateIntegration(newIntegration.id, oauthState.userId, {
            config: mergePendingPhoneSelectionIntoConfig(
              { userId: userInfo.id, name: userInfo.name },
              pending
            ),
          });
          console.log(
            `[WhatsApp OAuth] ${eligiblePhones.length} phone lines on this login â€” choose which to add in Integrations (pending saved on integration ${newIntegration.id}).`
          );
        } else if (allPhoneNumbers.length === 0) {
          console.warn(`[WhatsApp OAuth] âš ï¸  No phone numbers found to add automatically`);
          console.warn(`[WhatsApp OAuth]    Retrying in 8s / 30s / 60s (Embedded Signup may need a moment to propagate)...`);
          const runOAuthPhoneDiscoveryRetry = async (label: string) => {
            try {
              console.log(`[WhatsApp OAuth] ðŸ”„ Retry (${label}) finding WABAs / phones...`);
              let retryPhones: any[] = [];
              const retryDebugResponse = await fetch(
                `${FACEBOOK_GRAPH_API_BASE}/debug_token?input_token=${accessToken}&access_token=${FACEBOOK_APP_ID || ''}|${FACEBOOK_APP_SECRET || ''}`
              );
              if (retryDebugResponse.ok) {
                const retryDebugData = await retryDebugResponse.json();
                const scopes = retryDebugData.data?.granular_scopes || [];
                for (const scope of scopes) {
                  if ((scope.scope === 'whatsapp_business_management' || scope.scope === 'whatsapp_business_messaging') && scope.target_ids) {
                    for (const wabaId of scope.target_ids) {
                      const r = await fetch(`${FACEBOOK_GRAPH_API_BASE}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating,last_onboarded_time&access_token=${accessToken}`);
                      if (r.ok) {
                        const d = await r.json();
                        (d.data || []).forEach((p: any) => retryPhones.push({ ...p, wabaId }));
                      }
                    }
                  }
                }
              }
              if (retryPhones.length === 0) {
                const wabaR = await fetch(`${FACEBOOK_GRAPH_API_BASE}/me/owned_whatsapp_business_accounts?fields=id,name&access_token=${accessToken}`);
                if (wabaR.ok) {
                  const wabaD = await wabaR.json();
                  for (const waba of wabaD.data || []) {
                    const r = await fetch(`${FACEBOOK_GRAPH_API_BASE}/${waba.id}/phone_numbers?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating,last_onboarded_time&access_token=${accessToken}`);
                    if (r.ok) {
                      const d = await r.json();
                      (d.data || []).forEach((p: any) => retryPhones.push({ ...p, wabaId: waba.id, wabaName: waba.name }));
                    }
                  }
                }
              }
              if (retryPhones.length === 0) {
                retryPhones = await tryCompleteFromStashedSession(oauthState.userId, accessToken, newIntegration.id);
              }
              const retrySeen = new Map<string, any>();
              for (const p of retryPhones) {
                if (p?.id && !retrySeen.has(String(p.id))) retrySeen.set(String(p.id), p);
              }
              const retryDeduped = Array.from(retrySeen.values());
              const retryEligible = filterEligiblePhonesForInbox(retryDeduped);
              if (retryEligible.length > 1) {
                const latest = await storage.getIntegration(newIntegration.id, oauthState.userId);
                await storage.updateIntegration(newIntegration.id, oauthState.userId, {
                  config: mergePendingPhoneSelectionIntoConfig(latest?.config as any, {
                    phones: retryEligible.map(summarizePhoneForPending),
                    createdAt: Date.now(),
                  }),
                });
                console.log(
                  `[WhatsApp OAuth] âœ… Retry (${label}): ${retryEligible.length} lines found â€” pending phone pick saved.`
                );
              } else if (retryEligible.length === 1) {
                console.log(`[WhatsApp OAuth] âœ… Retry (${label}): Found 1 phone number, creating session...`);
                await createOfficialSessionsForOAuthPhones({
                  userId: oauthState.userId,
                  integrationId: newIntegration.id,
                  accessToken,
                  phones: retryEligible,
                });
              }
            } catch (e: any) {
              console.error(`[WhatsApp OAuth] Retry (${label}) error:`, e.message);
            }
          };
          [8000, 30000, 60000].forEach((ms) => {
            setTimeout(() => runOAuthPhoneDiscoveryRetry(`${ms / 1000}s`), ms);
          });
        } else if (phonesForAutoSession.length > 0) {
          console.log(
            `[WhatsApp OAuth] ðŸ”„ Automatically adding ${phonesForAutoSession.length} phone number(s) (activation steps already complete)...`
          );
          await createOfficialSessionsForOAuthPhones({
            userId: oauthState.userId,
            integrationId: newIntegration.id,
            accessToken,
            phones: phonesForAutoSession,
          });
          console.log(
            `[WhatsApp OAuth] âœ… Successfully processed ${phonesForAutoSession.length} phone number(s) for sessions`
          );
        } else {
          console.warn(
            `[WhatsApp OAuth] âš ï¸  Meta returned ${allPhoneNumbers.length} line(s) but none match WHATSAPP_OAUTH_ONLY_WABA_IDS (if set). Add numbers manually from Integrations if needed.`
          );
        }
      } catch (error: any) {
        console.error(`[WhatsApp OAuth] Error in automatic phone number registration:`, error);
        // Don't fail the OAuth flow if phone number registration fails
      }

      // Clean up OAuth state after delay (Embedded Signup postMessage may arrive slightly after callback)
      setTimeout(() => {
        storage.deleteOAuthState(state as string).catch(() => {});
      }, 15 * 60 * 1000);

      let onboardingForClient: Awaited<ReturnType<typeof runWhatsAppPostOnboarding>> | null = null;
      try {
        onboardingForClient = await runWhatsAppPostOnboarding({
          accessToken,
          integrationId: newIntegration.id,
          userId: oauthState.userId,
          organizationId: oauthState.organizationId || null,
        });
        console.log(
          `[WhatsApp OAuth] Post-onboarding checklist: readyForMessaging=${onboardingForClient.readyForMessaging}, steps=${onboardingForClient.steps.length}`
        );
      } catch (onboardErr: any) {
        console.warn("[WhatsApp OAuth] Post-onboarding checklist failed:", onboardErr.message);
      }

      const onboardingJson = JSON.stringify(onboardingForClient);

      const flushEmbeddedSignupScript = `
            (function() {
              try {
                var key = 'wa_embedded_signup_pending';
                var raw = localStorage.getItem(key);
                if (!raw) return;
                localStorage.removeItem(key);
                fetch('/api/integrations/whatsapp-business/oauth/embedded-signup-session', {
                  method: 'POST',
                  credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: raw
                }).then(function() {
                  return fetch('/api/whatsapp/complete-onboarding', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: raw
                  });
                }).catch(function(){});
              } catch (e) {}
            })();
      `;
      // Return HTML page that closes popup and redirects to /connect page
      const phonePickPayload = postOAuthPhonePickIntegrationId
        ? `window.opener.postMessage({ type: 'WHATSAPP_BUSINESS_PHONE_PICK_REQUIRED', integrationId: ${JSON.stringify(postOAuthPhonePickIntegrationId)}, onboarding: ${onboardingJson} }, '*');`
        : `window.opener.postMessage({ type: 'WHATSAPP_BUSINESS_OAUTH_SUCCESS', integration: 'whatsapp-business', onboarding: ${onboardingJson} }, '*');`;
      const successHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>WhatsApp Business OAuth Success</title>
        </head>
        <body>
          <script>
            ${flushEmbeddedSignupScript}
            if (window.opener) {
              ${phonePickPayload}
              setTimeout(() => {
                window.close();
                window.opener.location.href = '${BASE_URL}/integrations';
              }, 500);
            } else {
              window.location.href = '${BASE_URL}/integrations';
            }
          </script>
          <p>Connection successful! Redirectingâ€¦</p>
        </body>
        </html>
      `;
      res.send(successHtml);
    } catch (error: any) {
      console.error("Error in WhatsApp Business OAuth callback:", error);
      
      // Return HTML page for error case too
      const errorHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>WhatsApp Business OAuth Error</title>
        </head>
        <body>
          <script>
            // Notify parent window
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'WHATSAPP_BUSINESS_OAUTH_ERROR', 
                error: '${error.message || 'callback_failed'}' 
              }, '*');
              setTimeout(() => {
                window.close();
              }, 2000);
            } else {
              // If not in popup, redirect normally
              window.location.href = '${BASE_URL}/integrations?error=${encodeURIComponent(error.message || 'callback_failed')}';
            }
          </script>
          <p>Connection failed. This window will close automatically...</p>
        </body>
        </html>
      `;
      res.send(errorHtml);
    }
  });

  // Receive tokens from central OAuth server (called by admin panel after token exchange)
  // NO isAuthenticated - validates X-Production-Key instead
  app.post("/api/integrations/whatsapp-business/oauth/receive-tokens", async (req: any, res) => {
    try {
      const authKey = (req.headers["x-production-key"] || req.headers["authorization"]?.replace(/^Bearer\s+/i, "") || "").trim();
      if (!PRODUCTION_KEY || authKey !== PRODUCTION_KEY) {
        return res.status(403).json({ success: false, error: "Invalid or missing X-Production-Key" });
      }

      const { access_token, expires_in, userId, organizationId, phoneNumbers = [], wabas = [] } = req.body || {};
      if (!access_token || !userId) {
        return res.status(400).json({ success: false, error: "Missing access_token or userId" });
      }

      const expiresAt = Date.now() + (Number(expires_in) || 5183944) * 1000;
      const credentials = { access_token, expires_at: expiresAt, token_type: "Bearer" };
      const config = {};

      const newIntegration = await storage.createIntegration({
        userId,
        organizationId: organizationId || undefined,
        name: "whatsapp-business",
        displayName: "WhatsApp Business",
        category: "featured",
        status: "connected",
        authType: "oauth",
        credentials,
        config,
      });
      console.log(`[WhatsApp OAuth] Receive-tokens: Integration created for user ${userId}`);

      // Subscribe app to WABAs and override webhook (critical for CONNECTED status)
      const webhookUrl = WEBHOOK_URL;
      const webhookVerifyToken = webhookVerifyTokenForMetaOverride();

      const uniqueWabaIds = new Set<string>();
      for (const p of phoneNumbers) {
        if (p.wabaId) uniqueWabaIds.add(p.wabaId);
      }
      for (const w of wabas) {
        if (w.id) uniqueWabaIds.add(w.id);
      }

      for (const wabaId of uniqueWabaIds) {
        try {
          const { shouldSkipMetaGraphSignupForCreditLine } = await import(
            "../../credit-line/skip-meta-graph-signup"
          );
          const skip = await shouldSkipMetaGraphSignupForCreditLine(organizationId);
          if (skip.skip) {
            console.log(
              `[WhatsApp OAuth] Receive-tokens: skip Meta subscribed_apps for WABA ${wabaId} — ${skip.reason}`
            );
            continue;
          }
          const subRes = await fetch(`${FACEBOOK_GRAPH_API_BASE}/${wabaId}/subscribed_apps`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${access_token}`, "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
          if (subRes.ok) {
            const overrideRes = await fetch(`${FACEBOOK_GRAPH_API_BASE}/${wabaId}/subscribed_apps`, {
              method: "POST",
              headers: { "Authorization": `Bearer ${access_token}`, "Content-Type": "application/json" },
              body: JSON.stringify({ override_callback_uri: webhookUrl, verify_token: webhookVerifyToken }),
            });
            if (overrideRes.ok) {
              console.log(`[WhatsApp OAuth] Receive-tokens: Subscribed WABA ${wabaId}, webhook override OK`);
            }
          }
        } catch (e: any) {
          console.warn(`[WhatsApp OAuth] Receive-tokens: WABA ${wabaId} subscribe error:`, e.message);
        }
      }

      if (Array.isArray(phoneNumbers) && phoneNumbers.length > 0) {
        await createOfficialSessionsForOAuthPhones({
          userId,
          integrationId: newIntegration.id,
          accessToken: access_token,
          phones: phoneNumbers,
        });
      } else {
        const fromStash = await tryCompleteFromStashedSession(userId, access_token, newIntegration.id);
        if (fromStash.length > 0) {
          await createOfficialSessionsForOAuthPhones({
            userId,
            integrationId: newIntegration.id,
            accessToken: access_token,
            phones: fromStash,
          });
        }
      }

      const wabaIdsFromPayload = [...uniqueWabaIds];
      const onboarding = await runWhatsAppPostOnboarding({
        accessToken: access_token,
        wabaIds: wabaIdsFromPayload,
        integrationId: newIntegration.id,
        userId,
        organizationId: organizationId || null,
      });

      res.json({ success: true, onboarding });
    } catch (error: any) {
      console.error("[WhatsApp OAuth] Receive-tokens error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Post-OAuth: client calls this to sync phones (uses localStorage embedded signup IDs + Graph discovery)
  app.post(
    "/api/integrations/whatsapp-business/oauth/sync-phones",
    isAuthenticated,
    resolveOrganizationContext,
    async (req: any, res) => {
      try {
        const userId = getUserId(req);
        const organizationId = req.context?.organizationId;
        const { integrationId, wabaId, phoneNumberId, businessId } = req.body || {};

        const integrations = await storage.getIntegrationsByUser(userId, organizationId);
        let integration = integrationId
          ? integrations.find((i) => i.id === integrationId && i.name === "whatsapp-business")
          : undefined;
        if (!integration) {
          integration = integrations
            .filter((i) => i.name === "whatsapp-business" && i.status === "connected")
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        }
        if (!integration?.credentials) {
          return res.status(404).json({ success: false, message: "No connected WhatsApp Business integration" });
        }

        const accessToken = (integration.credentials as any).access_token;
        if (!accessToken) {
          return res.status(400).json({ success: false, message: "Integration has no access token" });
        }

        console.log(
          `[WhatsApp OAuth] sync-phones user=${userId} integration=${integration.id} waba=${wabaId || "-"} phone=${phoneNumberId || "-"}`
        );

        const result = await discoverAndCreateWhatsAppSessions({
          userId,
          integrationId: integration.id,
          accessToken,
          wabaId: wabaId ? String(wabaId) : undefined,
          phoneNumberId: phoneNumberId ? String(phoneNumberId) : undefined,
          businessId: businessId ? String(businessId) : undefined,
        });

        res.json({
          success: result.phonesAdded > 0,
          phonesAdded: result.phonesAdded,
          source: result.source,
          phones: result.phones.map((p) => ({
            id: p.id,
            display_phone_number: p.display_phone_number,
            wabaId: p.wabaId,
          })),
        });
      } catch (e: any) {
        console.error("[WhatsApp OAuth] sync-phones error:", e);
        res.status(500).json({ success: false, message: e.message });
      }
    }
  );

  // Stash Embedded Signup session info from frontend (WA_EMBEDDED_SIGNUP postMessage)
  app.post(
    "/api/integrations/whatsapp-business/oauth/embedded-signup-session",
    isAuthenticated,
    resolveOrganizationContext,
    async (req: any, res) => {
      try {
        const userId = getUserId(req);
        const { wabaId, phoneNumberId, businessId, state } = req.body || {};
        if (!wabaId && !phoneNumberId) {
          return res.status(400).json({ success: false, error: "Missing wabaId or phoneNumberId" });
        }
        await persistEmbeddedSignupSession({
          userId,
          state: state ? String(state) : undefined,
          wabaId: String(wabaId || ""),
          phoneNumberId: String(phoneNumberId || ""),
          businessId: businessId ? String(businessId) : undefined,
        });
        console.log(
          `[WhatsApp OAuth] Stashed Embedded Signup session for user ${userId}: WABA ${wabaId}, phone ${phoneNumberId}`
        );
        res.json({ success: true });
      } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
      }
    }
  );

  async function resolveWhatsAppIntegrationForUser(
    userId: string,
    organizationId: string | undefined,
    integrationId?: string
  ) {
    if (integrationId) {
      const byId = await storage.getIntegration(integrationId, userId);
      if (byId?.name === "whatsapp-business" && byId.status === "connected") return byId;
    }
    const byName = await storage.getIntegrationByName(
      "whatsapp-business",
      userId,
      organizationId || undefined
    );
    if (byName?.status === "connected" && (byName.credentials as any)?.access_token) return byName;
    const all = await storage.getIntegrationsByUser(userId, organizationId || undefined);
    const connected = all
      .filter(
        (i) =>
          i.name === "whatsapp-business" &&
          i.status === "connected" &&
          (i.credentials as any)?.access_token
      )
      .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
    return connected[0] || null;
  }

  // Complete onboarding when Embedded Signup FINISH event provides WABA + phone IDs directly
  app.post(
    "/api/whatsapp/complete-onboarding",
    isAuthenticated,
    resolveOrganizationContext,
    async (req: any, res) => {
      try {
        const userId = getUserId(req);
        const organizationId = req.context?.organizationId;
        const { businessId, wabaId, phoneNumberId, integrationId } = req.body || {};

        const result = await completeEmbeddedSignupForUser({
          userId,
          organizationId,
          integrationId,
          businessId,
          wabaId: String(wabaId || ""),
          phoneNumberId: String(phoneNumberId || ""),
        });
        if (!result.success) {
          return res.status(result.error?.includes("not ready") ? 202 : 400).json(result);
        }

        let onboarding = null;
        try {
          const integration = await resolveWhatsAppIntegrationForUser(
            userId,
            organizationId,
            result.integrationId || integrationId
          );
          if (integration?.credentials?.access_token) {
            onboarding = await runWhatsAppPostOnboarding({
              accessToken: (integration.credentials as any).access_token,
              wabaIds: wabaId ? [String(wabaId)] : [],
              phoneNumberId: phoneNumberId || null,
              businessPortfolioId: businessId || null,
              integrationId: integration.id,
              userId,
              organizationId: organizationId || null,
            });
          }
        } catch (onboardErr: any) {
          console.warn("[WhatsApp complete-onboarding] checklist:", onboardErr.message);
        }

        res.json({ ...result, onboarding });
      } catch (e: any) {
        console.error("[WhatsApp complete-onboarding]", e);
        res.status(500).json({ success: false, error: e.message });
      }
    }
  );

  app.get(
    "/api/integrations/whatsapp-business/onboarding-checklist",
    isAuthenticated,
    resolveOrganizationContext,
    async (req: any, res) => {
      try {
        const userId = getUserId(req);
        const organizationId = req.context?.organizationId;
        const integrationId = req.query.integrationId as string | undefined;

        const integration = await resolveWhatsAppIntegrationForUser(
          userId,
          organizationId,
          integrationId
        );

        if (!integration) {
          return res.json({ success: true, onboarding: null });
        }

        const config = (integration.config || {}) as Record<string, unknown>;
        const saved = config.whatsappOnboarding as Record<string, unknown> | undefined;

        if (saved?.steps) {
          return res.json({ success: true, integrationId: integration.id, onboarding: saved });
        }

        const accessToken = (integration.credentials as any)?.access_token;
        if (!accessToken) {
          return res.json({ success: true, integrationId: integration.id, onboarding: null });
        }

        const onboarding = await runWhatsAppPostOnboarding({
          accessToken,
          integrationId: integration.id,
          userId,
          organizationId: organizationId || null,
        });

        res.json({ success: true, integrationId: integration.id, onboarding });
      } catch (error: any) {
        console.error("[WhatsApp onboarding-checklist]", error);
        res.status(500).json({ success: false, error: error.message });
      }
    }
  );
}
