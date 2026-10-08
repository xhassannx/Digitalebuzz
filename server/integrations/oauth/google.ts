// @ts-nocheck
import { randomBytes } from "crypto";
import { storage } from "../../storage";
import type { Express } from "express";
import { isAuthenticated } from "../../replitAuth";
import { resolveOrganizationContext } from "../../middleware/organization-context";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
// Sanitize: strip newlines, # comments (common .env mistake)
const BASE_URL = (process.env.BASE_URL || "http://localhost:5000").split(/\s*[\n#]/)[0].trim().replace(/\/+$/, "");

const GOOGLE_SCOPES: Record<string, string[]> = {
  "google-calendar": [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ],
  "google-contacts": [
    "https://www.googleapis.com/auth/contacts",
    "https://www.googleapis.com/auth/contacts.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ],
  "google-sheets": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ],
};

export function registerGoogleOAuthRoutes(app: Express) {
  const getUserId = (req: any): string => {
    return req.user?.claims?.sub || req.userId;
  };

  // Get redirect URI for display in Connect modal (e.g. Google Calendar)
  app.get("/api/integrations/google/:integrationName/oauth/redirect-uri", isAuthenticated, (req: any, res) => {
    const integrationName = req.params.integrationName;
    if (!GOOGLE_SCOPES[integrationName]) {
      return res.status(400).json({ message: "Invalid integration name" });
    }
    const redirectUri = `${BASE_URL}/api/integrations/google/${integrationName}/oauth/callback`;
    console.log(`[Google OAuth Redirect URI] Integration: ${integrationName}, BASE_URL: ${BASE_URL}, Redirect URI: ${redirectUri}`);
    res.json({ redirectUri });
  });

  const authorize = async (req: any, res: any, clientId?: string, clientSecret?: string) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      const integrationName = req.params.integrationName;

      const effectiveClientId = clientId || GOOGLE_CLIENT_ID;
      const effectiveClientSecret = clientSecret || GOOGLE_CLIENT_SECRET;

      if (!effectiveClientId || !effectiveClientSecret) {
        return res.status(500).json({ message: "Google OAuth not configured. Provide Client ID and Client Secret in the Connect modal or set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." });
      }

      if (!GOOGLE_SCOPES[integrationName]) {
        return res.status(400).json({ message: "Invalid integration name" });
      }

      // Generate state and code verifier for PKCE
      const state = randomBytes(32).toString("hex");
      const codeVerifier = randomBytes(32).toString("base64url");
      const redirectUri = `${BASE_URL}/api/integrations/google/${integrationName}/oauth/callback`;

      // Log redirect URI for debugging
      console.log(`[Google OAuth] Integration: ${integrationName}, Redirect URI: ${redirectUri}, BASE_URL: ${BASE_URL}`);

      // Store OAuth state (with optional per-connection client credentials)
      await storage.createOAuthState({
        userId,
        organizationId,
        integrationName,
        state,
        codeVerifier,
        redirectUri,
        ...(clientId && clientSecret ? { clientId, clientSecret } : {}),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      } as any);

      // Build authorization URL
      const scopes = GOOGLE_SCOPES[integrationName].join(" ");
      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", effectiveClientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      
      console.log(`[Google OAuth] Authorization URL redirect_uri parameter: ${redirectUri}`);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", scopes);
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent");

      res.json({ authUrl: authUrl.toString(), redirectUri });
    } catch (error: any) {
      console.error("Error initiating Google OAuth:", error);
      res.status(500).json({ message: "Failed to initiate OAuth flow" });
    }
  };

  // Initiate Google OAuth flow (GET: use env credentials)
  app.get("/api/integrations/google/:integrationName/oauth/authorize", isAuthenticated, resolveOrganizationContext, (req: any, res) => authorize(req, res));

  // Initiate Google OAuth flow (POST: use body clientId/clientSecret for Connect modal)
  app.post("/api/integrations/google/:integrationName/oauth/authorize", isAuthenticated, resolveOrganizationContext, (req: any, res) => {
    const { clientId, clientSecret } = req.body || {};
    return authorize(req, res, clientId, clientSecret);
  });

  // Google OAuth callback
  app.get("/api/integrations/google/:integrationName/oauth/callback", isAuthenticated, async (req: any, res) => {
    try {
      const { code, state, error } = req.query;

      if (error) {
        return res.redirect(`${BASE_URL}/integrations?error=${encodeURIComponent(error as string)}`);
      }

      if (!code || !state) {
        return res.redirect(`${BASE_URL}/integrations?error=missing_parameters`);
      }

      // Verify state
      const oauthState = await storage.getOAuthState(state as string);
      if (!oauthState) {
        return res.redirect(`${BASE_URL}/integrations?error=invalid_state`);
      }

      const clientId = (oauthState as any).clientId || GOOGLE_CLIENT_ID;
      const clientSecret = (oauthState as any).clientSecret || GOOGLE_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        return res.redirect(`${BASE_URL}/integrations?error=oauth_not_configured`);
      }

      // Exchange code for tokens
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          code: code as string,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: oauthState.redirectUri!,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        console.error("Token exchange error:", errorData);
        return res.redirect(`${BASE_URL}/integrations?error=token_exchange_failed`);
      }

      const tokens = await tokenResponse.json();

      // Get user info to verify (optional - may fail if userinfo scope not requested)
      let userInfo: any = {};
      try {
        const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
          },
        });

        if (userInfoResponse.ok) {
          userInfo = await userInfoResponse.json();
        } else {
          console.warn("Failed to fetch user info (this is OK if userinfo scope not requested):", await userInfoResponse.text());
          // Continue without user info - not critical for calendar integration
        }
      } catch (error) {
        console.warn("Error fetching user info (continuing anyway):", error);
        // Continue without user info
      }

      // Save integration
      const integrationName = req.params.integrationName;
      const existing = await storage.getIntegrationByName(
        integrationName,
        oauthState.userId,
        oauthState.organizationId || undefined
      );

      const credentials: Record<string, any> = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: Date.now() + (tokens.expires_in * 1000),
        token_type: tokens.token_type,
      };
      if (clientId) credentials.client_id = clientId;
      if (clientSecret) credentials.client_secret = clientSecret;

      const config: Record<string, any> = {};
      if (userInfo.email) config.email = userInfo.email;
      if (userInfo.name) config.name = userInfo.name;
      if (userInfo.picture) config.picture = userInfo.picture;

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
          name: integrationName,
          displayName: integrationName.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
          category: "flow",
          status: "connected",
          authType: "oauth",
          credentials,
          config,
        });
      }

      // Clean up OAuth state
      await storage.deleteOAuthState(state as string);

      res.redirect(`${BASE_URL}/integrations?success=${encodeURIComponent(integrationName)}`);
    } catch (error: any) {
      console.error("Error in Google OAuth callback:", error);
      res.redirect(`${BASE_URL}/integrations?error=callback_failed`);
    }
  });

  // Refresh Google OAuth token
  app.post("/api/integrations/google/:integrationName/oauth/refresh", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const integrationName = req.params.integrationName;
      const integration = await storage.getIntegrationByName(integrationName, userId);

      if (!integration || !integration.credentials) {
        return res.status(404).json({ message: "Integration not found" });
      }

      const credentials = integration.credentials as any;
      if (!credentials.refresh_token) {
        return res.status(400).json({ message: "No refresh token available" });
      }

      const clientId = (integration.credentials as any).client_id || GOOGLE_CLIENT_ID;
      const clientSecret = (integration.credentials as any).client_secret || GOOGLE_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        return res.status(400).json({ message: "Integration missing client credentials for refresh" });
      }

      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: credentials.refresh_token,
          grant_type: "refresh_token",
        }),
      });

      if (!tokenResponse.ok) {
        return res.status(401).json({ message: "Failed to refresh token" });
      }

      const tokens = await tokenResponse.json();

      const updatedCredentials = {
        ...credentials,
        access_token: tokens.access_token,
        expires_at: Date.now() + (tokens.expires_in * 1000),
      };

      await storage.updateIntegration(integration.id, userId, {
        credentials: updatedCredentials,
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error refreshing Google token:", error);
      res.status(500).json({ message: "Failed to refresh token" });
    }
  });
}

