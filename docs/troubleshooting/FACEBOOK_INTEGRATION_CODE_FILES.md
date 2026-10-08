# Facebook Lead Ads Integration - Complete Code Files

## File 1: OAuth Handler
**Path**: `server/integrations/oauth/facebook.ts`

```typescript
import { randomBytes } from "crypto";
import { storage } from "../../storage";
import type { Express } from "express";
import { isAuthenticated } from "../../replitAuth";
import { resolveOrganizationContext } from "../../middleware/organization-context";

const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const BASE_URL = process.env.BASE_URL || "http://localhost:5000";

const FACEBOOK_SCOPES = [
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
      const scopes = FACEBOOK_SCOPES.join(",");
      const authUrl = new URL("https://www.facebook.com/v18.0/dialog/oauth");
      authUrl.searchParams.set("client_id", FACEBOOK_APP_ID);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("scope", scopes);
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("response_type", "code");

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
        userInfo = await userInfo.json();
      }

      // Save integration
      const existing = await storage.getIntegrationByName(
        "facebook-lead-ads",
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

      if (existing) {
        await storage.updateIntegration(existing.id, oauthState.userId, {
          status: "connected",
          credentials,
          config,
        });
      } else {
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
      }

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
```

---

## File 2: Lead Handler
**Path**: `server/integrations/handlers/facebook-leads.ts`

*(See the full file content - it's 530 lines. The key parts are:)*

- `/api/integrations/facebook-lead-ads/sync-leads` - POST endpoint to sync leads
- `/api/integrations/facebook-lead-ads/pages` - GET endpoint to fetch pages
- `/api/integrations/facebook-lead-ads/forms/:pageId` - GET endpoint to fetch forms
- `/api/integrations/facebook-lead-ads/webhook` - GET/POST for webhooks

**Key Features:**
- Fetches leads from Facebook Graph API
- Handles pagination automatically
- Maps lead fields to contact fields
- Creates or updates contacts based on phone/email matching
- Stores Facebook metadata in custom fields

---

## File 3: Frontend Component
**Path**: `client/src/components/facebook-leads-manager.tsx`

*(See the full file content - it's 415 lines. Key features:)*

- Step-by-step wizard UI
- Page selection dropdown
- Form selection dropdown
- Date range filtering
- Sync button with progress
- Results display

---

## File 4: Integration Registration
**Path**: `server/integrations/index.ts`

Add this to your integration definitions:

```typescript
export const INTEGRATION_DEFINITIONS = {
  "facebook-lead-ads": {
    name: "facebook-lead-ads",
    displayName: "Facebook Lead Ads",
    category: "featured" as const,
    authType: "oauth" as const,
    description: "Automate lead generation and manage customer inquiries directly from Facebook. Capture leads, respond to...",
  },
  // ... other integrations
};
```

And register the routes:

```typescript
import { registerFacebookOAuthRoutes } from "./oauth/facebook";
import { registerFacebookLeadsRoutes } from "./handlers/facebook-leads";

export function registerIntegrationRoutes(app: Express) {
  registerFacebookOAuthRoutes(app);
  registerFacebookLeadsRoutes(app);
  // ... other routes
}
```

---

## Database Schema Requirements

You need these tables (or equivalent):

1. **integrations** - Stores OAuth credentials
2. **managed_contacts** - Stores synced contacts
3. **integration_oauth_states** - Temporary OAuth state storage

See the full documentation for schema details.

---

## Quick Test

1. Set environment variables
2. Configure Facebook App permissions
3. Start your server
4. Navigate to integrations page
5. Click "Connect" on Facebook Lead Ads
6. Complete OAuth flow
7. Click "Manage" to sync leads

---

## Common Issues

### "This app needs at least one supported permission"
- **Fix**: Add `leads_retrieval` permission in Facebook App settings
- See setup guide above

### "No pages found"
- **Fix**: User must have admin access to at least one Facebook page

### "Token expired"
- **Fix**: Reconnect the integration (tokens expire after 60 days)

### "No forms found"
- **Fix**: Create lead forms in Facebook Ads Manager first

---

For complete documentation, see `FACEBOOK_LEAD_ADS_INTEGRATION_DOCUMENTATION.md`

