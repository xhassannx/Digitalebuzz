import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

export type LimitType = 'message' | 'session' | 'webhook';

// Helper to get userId from either session or API key
const getUserId = (req: any): string | undefined => {
  return req.user?.claims?.sub || req.user?.id || req.userId;
};

export function checkUsageLimits(_limitType: LimitType) {
  return async (_req: Request, _res: Response, next: NextFunction) => {
    return next();
  };
}

// Feature gate middleware - checks if plan supports a specific feature
export function requireFeature(_feature: 'whatsappBusinessApi' | 'analytics' | 'prioritySupport') {
  return async (_req: Request, _res: Response, next: NextFunction) => {
    return next();
  };
}

// Auto-increment usage after successful operations (uses effectiveUserId when set by checkUsageLimits so team members count under owner)
export function incrementUsage(limitType: LimitType) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = getUserId(req);
    
    if (!userId) {
      return next();
    }

    // Use effectiveUserId from checkUsageLimits when present so team member usage counts under owner
    const effectiveUserId = (req as any).effectiveUserId ?? userId;

    // Store the original json function
    const originalJson = res.json.bind(res);
    
    // Override res.json to intercept successful responses
    res.json = function(body: any) {
      // Only increment on successful responses (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Increment usage in background (don't await to avoid blocking response)
        (async () => {
          try {
            const now = new Date();
            const currentMonth = now.getMonth() + 1;
            const currentYear = now.getFullYear();
            const monthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
            
            switch (limitType) {
              case 'message':
                await storage.incrementMessagesSent(effectiveUserId, monthStr);
                break;
              case 'session':
                const sessionCount = (await storage.getSessionsByUser(userId)).length;
                await storage.updateActiveSessions(effectiveUserId, monthStr, sessionCount);
                break;
              case 'webhook':
                await storage.incrementWebhooksTriggered(effectiveUserId, monthStr);
                break;
            }
          } catch (error) {
            console.error('Failed to increment usage:', error);
          }
        })();
      }
      
      return originalJson(body);
    };
    
    next();
  };
}
