// @ts-nocheck
import { randomBytes } from "crypto";
import { storage } from "../../storage";
import type { Express } from "express";
import { isAuthenticated } from "../../replitAuth";
import { resolveOrganizationContext } from "../../middleware/organization-context";

const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const FACEBOOK_LEAD_ADS_CONFIG_ID = (process.env.FACEBOOK_LEAD_ADS_CONFIG_ID || "").trim();
// Sanitize: strip newlines, # comments (common .env mistake)
const BASE_URL = (process.env.BASE_URL || "http://localhost:5000").split(/\s*[\n#]/)[0].trim().replace(/\/+$/, "");

// pages_show_list: required for GET /me/accounts (list Pages the user manages) — App Review expects this scope + screencast of Pages list in UI
const FACEBOOK_SCOPES = [
  "pages_show_list",
  "leads_retrieval",
  "pages_read_engagement",
  "pages_manage_metadata",
  "pages_read_user_content",
  "pages_manage_ads", // Required for managing lead forms
];

export function registerFacebookOAuthRoutes(app: Express) {
  const getUserId = (req: any): string => {
    return req.user?.claims?.sub || req.userId;
  };

  // Initiate Facebook OAuth flow
  app.get("/api/integrations/facebook-lead-ads/oauth/authorize", isAuthenticated, resolveOrganizationContext, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;

      if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
        return res.status(500).json({ message: "Facebook OAuth not configured" });
      }

      // Generate state
      const state = randomBytes(32).toString("hex");
      // Using shorter path for Facebook compatibility (Facebook UI has issues with long URIs)
      const redirectUri = `${BASE_URL}/fb/callback`;

      // Store OAuth state
      await storage.createOAuthState({
        userId,
        organizationId,
        integrationName: "facebook-lead-ads",
        state,
        redirectUri,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      });

      // Build authorization URL
      const authUrl = new URL("https://www.facebook.com/v18.0/dialog/oauth");
      authUrl.searchParams.set("client_id", FACEBOOK_APP_ID);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("response_type", "code");

      if (FACEBOOK_LEAD_ADS_CONFIG_ID) {
        // Facebook Login for Business: use config_id (fixes "This app needs at least one supported permission")
        authUrl.searchParams.set("config_id", FACEBOOK_LEAD_ADS_CONFIG_ID);
      } else {
        // Fallback: scope-based OAuth
        authUrl.searchParams.set("scope", FACEBOOK_SCOPES.join(","));
      }

      res.json({ authUrl: authUrl.toString() });
    } catch (error: any) {
      console.error("Error initiating Facebook OAuth:", error);
      res.status(500).json({ message: "Failed to initiate OAuth flow" });
    }
  });

  // Facebook OAuth callback - using shorter path for Facebook compatibility
  app.get("/fb/callback", isAuthenticated, async (req: any, res) => {
    try {
      const { code, state, error, error_reason, error_description } = req.query;

      if (error) {
        const errorMsg = error_description || error_reason || error;
        const errorHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Facebook OAuth Error</title>
          </head>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'FACEBOOK_OAUTH_ERROR', 
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
            <title>Facebook OAuth Error</title>
          </head>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'FACEBOOK_OAUTH_ERROR', 
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
      const oauthState = await storage.getOAuthState(state as string);
      if (!oauthState) {
        const errorHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Facebook OAuth Error</title>
          </head>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'FACEBOOK_OAUTH_ERROR', 
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

      // Exchange code for access token
      const tokenUrl = new URL("https://graph.facebook.com/v18.0/oauth/access_token");
      tokenUrl.searchParams.set("client_id", FACEBOOK_APP_ID!);
      tokenUrl.searchParams.set("client_secret", FACEBOOK_APP_SECRET!);
      tokenUrl.searchParams.set("redirect_uri", oauthState.redirectUri);
      tokenUrl.searchParams.set("code", code as string);

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
            <title>Facebook OAuth Error</title>
          </head>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'FACEBOOK_OAUTH_ERROR', 
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
      const longLivedTokenUrl = new URL("https://graph.facebook.com/v18.0/oauth/access_token");
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
      const userInfoResponse = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${accessToken}`);
      let userInfo: any = {};
      if (userInfoResponse.ok) {
        userInfo = await userInfoResponse.json();
      }

      // Save integration - always create new to support multiple connections
      const credentials = {
        access_token: accessToken,
        expires_at: expiresAt,
        token_type: "Bearer",
      };

      const config = {
        userId: userInfo.id,
        name: userInfo.name,
      };

      await storage.createIntegration({
        userId: oauthState.userId,
        organizationId: oauthState.organizationId || undefined,
        name: "facebook-lead-ads",
        displayName: "Facebook Lead Ads",
        category: "featured",
        status: "connected",
        authType: "oauth",
        credentials,
        config,
      });

      // Clean up OAuth state
      await storage.deleteOAuthState(state as string);

      // Return HTML page that closes popup and notifies parent
      const successHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Facebook OAuth Success</title>
        </head>
        <body>
          <script>
            // Notify parent window
            if (window.opener) {
              window.opener.postMessage({ type: 'FACEBOOK_OAUTH_SUCCESS', integration: 'facebook-lead-ads' }, '*');
              setTimeout(() => {
                window.close();
              }, 500);
            } else {
              // If not in popup, redirect normally
              window.location.href = '${BASE_URL}/integrations?success=facebook-lead-ads';
            }
          </script>
          <p>Connection successful! This window will close automatically...</p>
        </body>
        </html>
      `;
      res.send(successHtml);
    } catch (error: any) {
      console.error("Error in Facebook OAuth callback:", error);
      
      // Return HTML page for error case too
      const errorHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Facebook OAuth Error</title>
        </head>
        <body>
          <script>
            // Notify parent window
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'FACEBOOK_OAUTH_ERROR', 
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
}

