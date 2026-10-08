import type { Request, Response, NextFunction } from 'express';

interface EndpointStats {
  timestamps: number[];
}

interface UserRateLimitData {
  allTimestamps: number[]; // All requests across endpoints for limit enforcement
  endpoints: Map<string, EndpointStats>; // Per-endpoint tracking for analytics
}

class RateLimiter {
  private limits: Map<string, UserRateLimitData>;
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private cleanupInterval: NodeJS.Timeout;

  constructor(maxRequests: number = 100, windowMinutes: number = 1) {
    this.limits = new Map();
    this.maxRequests = maxRequests;
    this.windowMs = windowMinutes * 60 * 1000;

    // Clean up old entries every 5 minutes to prevent memory leaks
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    for (const [userId, userData] of Array.from(this.limits.entries())) {
      // Remove timestamps older than the window
      userData.allTimestamps = userData.allTimestamps.filter((ts: number) => ts > cutoff);

      // Clean up endpoint-specific timestamps
      for (const [endpoint, stats] of Array.from(userData.endpoints.entries())) {
        stats.timestamps = stats.timestamps.filter((ts: number) => ts > cutoff);
        if (stats.timestamps.length === 0) {
          userData.endpoints.delete(endpoint);
        }
      }

      // Remove user entry if no recent requests
      if (userData.allTimestamps.length === 0) {
        this.limits.delete(userId);
      }
    }
  }

  checkLimit(userId: string, endpoint: string): { allowed: boolean; retryAfter?: number; oldestTimestamp?: number } {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    // Get or create entry for this user
    let userData = this.limits.get(userId);
    if (!userData) {
      userData = { 
        allTimestamps: [],
        endpoints: new Map()
      };
      this.limits.set(userId, userData);
    }

    // Remove timestamps outside the current window
    userData.allTimestamps = userData.allTimestamps.filter(ts => ts > cutoff);

    // Check if limit exceeded (global limit across all endpoints)
    if (userData.allTimestamps.length >= this.maxRequests) {
      // Calculate when the oldest request will expire
      const oldestTimestamp = userData.allTimestamps[0];
      const retryAfter = Math.ceil((oldestTimestamp + this.windowMs - now) / 1000);
      return { allowed: false, retryAfter, oldestTimestamp };
    }

    // Track endpoint-specific data for analytics
    let endpointStats = userData.endpoints.get(endpoint);
    if (!endpointStats) {
      endpointStats = { timestamps: [] };
      userData.endpoints.set(endpoint, endpointStats);
    }
    endpointStats.timestamps = endpointStats.timestamps.filter(ts => ts > cutoff);
    endpointStats.timestamps.push(now);

    // Add current request timestamp to global tracker
    userData.allTimestamps.push(now);
    return { allowed: true, oldestTimestamp: userData.allTimestamps[0] };
  }

  reset(userId: string): void {
    this.limits.delete(userId);
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.limits.clear();
  }

  // Get endpoint statistics for analytics
  getEndpointStats(userId: string): Map<string, { requestCount: number; timestamps: number[] }> | undefined {
    const userData = this.limits.get(userId);
    if (!userData) return undefined;

    const stats = new Map<string, { requestCount: number; timestamps: number[] }>();
    for (const [endpoint, endpointStats] of Array.from(userData.endpoints.entries())) {
      stats.set(endpoint, {
        requestCount: endpointStats.timestamps.length,
        timestamps: [...endpointStats.timestamps] // Return copy to prevent mutation
      });
    }
    return stats;
  }
}

// Create singleton rate limiter instance
// Configurable via env: RATE_LIMIT_MAX_REQUESTS (default: 300) and RATE_LIMIT_WINDOW_MINUTES (default: 1)
const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '300', 10);
const windowMinutes = parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES || '1', 10);
const rateLimiter = new RateLimiter(maxRequests, windowMinutes);

// Endpoints to exclude from rate limiting (health checks, static assets, etc.)
const EXCLUDED_PATHS = [
  '/api/health',
  '/api/ping',
  '/api/webhooks/', // Webhook endpoints shouldn't be rate limited by user
  '/uploads/', // Static file serving
];

// Middleware function
export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip rate limiting for excluded paths
  if (EXCLUDED_PATHS.some(path => req.path.startsWith(path))) {
    return next();
  }

  // Extract userId from request using the same logic as route handlers
  // This works after isAuthenticatedOrApiKey middleware has run
  const userId = (req as any).user?.claims?.sub || (req as any).userId;

  if (!userId) {
    // If no user ID, allow the request (auth middleware should have handled authentication)
    // This allows unauthenticated routes to pass through
    return next();
  }

  // Get endpoint path for tracking
  const endpoint = req.path;

  const result = rateLimiter.checkLimit(userId, endpoint);

  if (!result.allowed) {
    // Calculate accurate reset time based on oldest timestamp
    const resetTime = new Date(result.oldestTimestamp! + windowMinutes * 60000);
    
    // Log rate limit hit for debugging
    console.warn(`[Rate Limiter] Rate limit exceeded for user ${userId} on ${endpoint}. Retry after ${result.retryAfter}s`);
    
    res.setHeader('Retry-After', result.retryAfter!.toString());
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', '0');
    res.setHeader('X-RateLimit-Reset', resetTime.toISOString());
    
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: `Too many requests. Limit: ${maxRequests} per ${windowMinutes} minute(s). Please try again in ${result.retryAfter} second(s).`,
      retryAfter: result.retryAfter,
      limit: maxRequests,
      windowMinutes: windowMinutes,
    });
    return;
  }

  // Set rate limit headers for successful requests
  const userData = (rateLimiter as any).limits.get(userId);
  const remaining = Math.max(0, maxRequests - (userData?.allTimestamps?.length || 0));
  
  // Calculate reset time based on oldest timestamp (when it will expire from the window)
  const resetTime = result.oldestTimestamp ? 
    new Date(result.oldestTimestamp + windowMinutes * 60000) : 
    new Date(Date.now() + windowMinutes * 60000);
  
  res.setHeader('X-RateLimit-Limit', maxRequests.toString());
  res.setHeader('X-RateLimit-Remaining', remaining.toString());
  res.setHeader('X-RateLimit-Reset', resetTime.toISOString());

  next();
}

export { rateLimiter };
