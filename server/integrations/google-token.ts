import { storage } from "../storage";

export class GoogleTokenRefreshError extends Error {
  code: string;
  reconnectRequired: boolean;

  constructor(message: string, opts?: { code?: string; reconnectRequired?: boolean }) {
    super(message);
    this.name = "GoogleTokenRefreshError";
    this.code = opts?.code || "TOKEN_REFRESH_FAILED";
    this.reconnectRequired = opts?.reconnectRequired ?? false;
  }
}

type GoogleIntegrationRef = {
  id: string;
  userId: string;
  credentials: Record<string, unknown> | null;
};

/** Return a valid Google access token; refresh when near expiry. */
export async function getValidGoogleAccessToken(integration: GoogleIntegrationRef): Promise<string> {
  const creds = { ...((integration.credentials || {}) as Record<string, unknown>) };
  if (!Object.keys(creds).length) {
    throw new GoogleTokenRefreshError("Google integration has no credentials. Connect again in Integrations.", {
      code: "NO_CREDENTIALS",
      reconnectRequired: true,
    });
  }

  const expiresAt = Number(creds.expires_at || 0);
  const accessToken = String(creds.access_token || "").trim();
  if (accessToken && expiresAt && Date.now() < expiresAt - 60_000) {
    return accessToken;
  }

  const refreshToken = String(creds.refresh_token || "").trim();
  if (!refreshToken) {
    if (accessToken) return accessToken;
    throw new GoogleTokenRefreshError(
      "Google connection has no refresh token. Disconnect and reconnect Google Sheets in Integrations.",
      { code: "NO_REFRESH_TOKEN", reconnectRequired: true }
    );
  }

  const clientId = String(creds.client_id || process.env.GOOGLE_CLIENT_ID || "").trim();
  const clientSecret = String(creds.client_secret || process.env.GOOGLE_CLIENT_SECRET || "").trim();
  if (!clientId || !clientSecret) {
    throw new GoogleTokenRefreshError(
      "Server missing Google OAuth client (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET). Set env vars or reconnect the integration.",
      { code: "MISSING_OAUTH_CLIENT" }
    );
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const bodyText = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(bodyText) as Record<string, unknown>;
  } catch {
    body = { error_description: bodyText.slice(0, 300) };
  }

  if (!res.ok) {
    const errCode = String(body.error || "token_refresh_failed");
    const desc = String(body.error_description || body.error || "Failed to refresh token");
    console.error(`[Google OAuth] refresh failed for integration ${integration.id}:`, errCode, desc);

    if (errCode === "invalid_grant") {
      await storage
        .updateIntegration(integration.id, integration.userId, { status: "not_connected" })
        .catch(() => undefined);
      throw new GoogleTokenRefreshError(
        "Google connection expired or was revoked. Open Integrations → Google Sheets and connect again.",
        { code: "RECONNECT_REQUIRED", reconnectRequired: true }
      );
    }

    if (errCode === "invalid_client") {
      throw new GoogleTokenRefreshError(
        "Google OAuth client rejected the refresh (wrong GOOGLE_CLIENT_ID/SECRET for this connection). Reconnect Google Sheets after fixing server env.",
        { code: "INVALID_CLIENT", reconnectRequired: true }
      );
    }

    throw new GoogleTokenRefreshError(desc, { code: errCode });
  }

  const tokens = body as { access_token?: string; expires_in?: number };
  creds.access_token = tokens.access_token;
  creds.expires_at = Date.now() + Number(tokens.expires_in || 3600) * 1000;
  await storage.updateIntegration(integration.id, integration.userId, { credentials: creds });
  return String(creds.access_token);
}

export function googleTokenErrorResponse(error: unknown): {
  status: number;
  body: { message: string; code?: string; reconnectRequired?: boolean };
} {
  if (error instanceof GoogleTokenRefreshError) {
    return {
      status: error.reconnectRequired ? 401 : 500,
      body: {
        message: error.message,
        code: error.code,
        reconnectRequired: error.reconnectRequired,
      },
    };
  }
  const message = error instanceof Error ? error.message : "Google API request failed";
  return { status: 500, body: { message } };
}
