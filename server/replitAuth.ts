import crypto from "crypto";
import passport from "passport";
import session from "express-session";
import type { Express, Request, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import MongoStore from "connect-mongo";
import { storage } from "./storage";
import { getDatabaseUrl, getPgPoolConfig, isNeonUrl } from "../db/pg-connection";
import { isMongoEnabled, getMongoUri, mongoose } from "../db/mongo";

/** Skip DB for repeated wrong keys (same string), bounded memory. */
const INVALID_API_KEY_CACHE_TTL_MS = parseInt(
  process.env.INVALID_API_KEY_CACHE_TTL_MS || String(5 * 60 * 1000),
  10
);
const INVALID_API_KEY_CACHE_MAX = parseInt(process.env.INVALID_API_KEY_CACHE_MAX || "5000", 10);

/** After this many failed API-key lookups per IP per minute, return 429 (stops log/DB spam from bad integrations). */
const API_KEY_FAIL_PER_IP_PER_MIN = parseInt(process.env.API_KEY_FAIL_PER_IP_PER_MIN || "120", 10);

const invalidKeyDigestExpiry = new Map<string, number>();
const invalidKeyFailTimestampsByIp = new Map<string, number[]>();

function hashApiKeySecret(key: string): string {
  return crypto.createHash("sha256").update(key, "utf8").digest("hex");
}

function getRequestIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]!.trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function isInvalidKeyCached(digest: string): boolean {
  const exp = invalidKeyDigestExpiry.get(digest);
  if (exp == null) return false;
  if (Date.now() > exp) {
    invalidKeyDigestExpiry.delete(digest);
    return false;
  }
  return true;
}

function rememberInvalidKey(digest: string): void {
  invalidKeyDigestExpiry.set(digest, Date.now() + INVALID_API_KEY_CACHE_TTL_MS);
  if (invalidKeyDigestExpiry.size > INVALID_API_KEY_CACHE_MAX) {
    const now = Date.now();
    for (const [d, e] of invalidKeyDigestExpiry) {
      if (e <= now) invalidKeyDigestExpiry.delete(d);
    }
    while (invalidKeyDigestExpiry.size > INVALID_API_KEY_CACHE_MAX) {
      const first = invalidKeyDigestExpiry.keys().next().value;
      if (first == null) break;
      invalidKeyDigestExpiry.delete(first);
    }
  }
}

/** Returns true if this IP should be temporarily blocked (too many failed API key checks). */
function registerInvalidApiKeyFailureForIp(ip: string): { blocked: boolean; retryAfterSec: number } {
  const now = Date.now();
  const windowMs = 60_000;
  const arr = (invalidKeyFailTimestampsByIp.get(ip) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  invalidKeyFailTimestampsByIp.set(ip, arr);
  if (arr.length <= API_KEY_FAIL_PER_IP_PER_MIN) {
    return { blocked: false, retryAfterSec: 0 };
  }
  const oldest = arr[0]!;
  const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
  return { blocked: true, retryAfterSec };
}

function isIpBlockedForInvalidApiKeys(ip: string): { blocked: boolean; retryAfterSec: number } {
  const now = Date.now();
  const windowMs = 60_000;
  const arr = invalidKeyFailTimestampsByIp.get(ip);
  if (!arr?.length) return { blocked: false, retryAfterSec: 0 };
  const recent = arr.filter((t) => now - t < windowMs);
  if (recent.length !== arr.length) invalidKeyFailTimestampsByIp.set(ip, recent);
  if (recent.length <= API_KEY_FAIL_PER_IP_PER_MIN) return { blocked: false, retryAfterSec: 0 };
  const oldest = recent[0]!;
  const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
  return { blocked: true, retryAfterSec };
}

// Cache the session middleware to reuse across WebSocket upgrades
let sessionMiddleware: RequestHandler;

export function getSession() {
  if (sessionMiddleware) return sessionMiddleware;
  
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  let sessionStore: any;
  if (isMongoEnabled()) {
    console.log("[Auth] Using MongoDB session store (connect-mongo)");
    sessionStore = MongoStore.create({
      clientPromise: new Promise((resolve) => {
        if (mongoose.connection.readyState === 1) {
          resolve(mongoose.connection.getClient());
        } else {
          mongoose.connection.once("connected", () => {
            resolve(mongoose.connection.getClient());
          });
        }
      }),
      collectionName: "sessions",
      ttl: Math.floor(sessionTtl / 1000),
      unserialize: (payload: any) => {
        if (typeof payload === "object" && payload !== null) {
          return payload;
        }
        try {
          return JSON.parse(payload);
        } catch {
          return payload;
        }
      },
    });
  } else {
    const pgStore = connectPg(session);
    const databaseUrl = getDatabaseUrl();
    // Never pass raw DATABASE_URL (sslmode=require overwrites ssl and breaks RDS).
    // Neon HTTP driver is separate; session store always uses node-postgres.
    sessionStore = new pgStore({
      conObject: isNeonUrl(databaseUrl)
        ? { connectionString: databaseUrl, ssl: { rejectUnauthorized: false } }
        : getPgPoolConfig(databaseUrl),
      createTableIfMissing: false,
      ttl: sessionTtl,
      tableName: "sessions",
    });
  }
  // Configure session with proper cookie settings
  // In production behind reverse proxies (Nginx), auto-detect secure or respect COOKIE_SECURE env
  const cookieSecureSetting: boolean | 'auto' =
    process.env.COOKIE_SECURE === 'true'
      ? true
      : process.env.COOKIE_SECURE === 'false'
      ? false
      : 'auto';
  
  sessionMiddleware = session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      secure: cookieSecureSetting,
      sameSite: 'lax' as const, // Allow cookies in same-site navigation
      maxAge: sessionTtl,
    },
  });
  
  return sessionMiddleware;
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  // Auto-detect HTTPS behind reverse proxies (e.g. Nginx on aaPanel) if X-Forwarded-Proto was omitted
  app.use((req, _res, next) => {
    if (!req.headers["x-forwarded-proto"]) {
      const isHttps =
        (process.env.BASE_URL || "").startsWith("https") ||
        (req.headers["referer"] || "").startsWith("https");
      if (isHttps) {
        req.headers["x-forwarded-proto"] = "https";
      }
    }
    next();
  });
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Set up passport serialization for local auth
  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => {
    // Gracefully handle invalid sessions
    if (!user) {
      return cb(null, false);
    }
    cb(null, user);
  });

  console.log('✅ Running with local password authentication.');
  console.log('   Access signup at /signup and login at /login');

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      req.session.destroy((err) => {
        if (err) {
          console.error('Error destroying session:', err);
        }
        res.redirect('/');
      });
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ 
      message: "Unauthorized",
      hint: "Please log in to access this resource."
    });
  }
  
  next();
};

// API Key authentication middleware
export const isAuthenticatedOrApiKey: RequestHandler = async (req, res, next) => {
  // Check if user is authenticated via session
  if (req.isAuthenticated()) {
    return isAuthenticated(req, res, next);
  }

  // Check for API key in header: X-API-Key or Authorization: Bearer <key>
  const apiKey = (
    (req.headers['x-api-key'] as string)?.trim() ||
    (req.headers['authorization']?.startsWith('Bearer ')
      ? req.headers['authorization'].slice(7).trim()
      : '')
  ) || undefined;
  if (!apiKey) {
    return res.status(401).json({ message: "Unauthorized - No API key or session" });
  }

  const keyDigest = hashApiKeySecret(apiKey);
  if (isInvalidKeyCached(keyDigest)) {
    return res.status(401).json({ message: "Invalid API key" });
  }

  const clientIp = getRequestIp(req);
  const ipBlocked = isIpBlockedForInvalidApiKeys(clientIp);
  if (ipBlocked.blocked) {
    res.setHeader("Retry-After", String(ipBlocked.retryAfterSec));
    return res.status(429).json({
      error: "Too many invalid API key attempts",
      message: `Try again in ${ipBlocked.retryAfterSec}s. Fix X-API-Key (or Bearer token) in your integration to stop this.`,
      retryAfter: ipBlocked.retryAfterSec,
    });
  }

  try {
    const keyData = await storage.getApiKeyByKey(apiKey);
    if (!keyData) {
      rememberInvalidKey(keyDigest);
      const afterFail = registerInvalidApiKeyFailureForIp(clientIp);
      if (afterFail.blocked) {
        res.setHeader("Retry-After", String(afterFail.retryAfterSec));
        return res.status(429).json({
          error: "Too many invalid API key attempts",
          message: `Try again in ${afterFail.retryAfterSec}s. Fix X-API-Key (or Bearer token) in your integration to stop this.`,
          retryAfter: afterFail.retryAfterSec,
        });
      }
      return res.status(401).json({ message: "Invalid API key" });
    }

    // Update last used timestamp
    await storage.updateApiKeyLastUsed(keyData.id);

    // Attach user to request
    (req as any).userId = keyData.userId;
    next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
  }
};
