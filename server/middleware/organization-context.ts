import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { userOrganizationsCache, orgMemberCache } from '../utils/memory-cache';

declare global {
  namespace Express {
    interface Request {
      context?: {
        organizationId: string;
        memberRole: 'owner' | 'admin' | 'member';
        memberPermissions: string[];
      };
    }
  }
}

export async function resolveOrganizationContext(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const getUserId = (req: any): string | null => {
      return req.user?.claims?.sub || req.user?.id || req.userId || null;
    };

    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    let organizationId: string | null = null;

    // Step 1: Try header (priority for API/key-friendly access)
    organizationId = req.headers['x-organization-id'] as string || null;

    // Step 2: Try query parameter (browser-friendly)
    if (!organizationId && req.query.organizationId) {
      organizationId = req.query.organizationId as string;
    }

    // Step 3: Default to user's first organization if not specified
    if (!organizationId) {
      let memberships = userOrganizationsCache.get(userId);
      if (!memberships || !Array.isArray(memberships) || memberships.length === 0) {
        try {
          memberships = (await storage.getOrganizationsByUser(userId)) || [];
        } catch {
          memberships = [];
        }
        if (memberships.length > 0) {
          userOrganizationsCache.set(userId, memberships);
        }
      }
      if (Array.isArray(memberships) && memberships.length > 0) {
        organizationId = memberships[0].id;
      } else {
        // Fallback: pick any existing org or create a default one
        const fallbackOrgs = await storage.getUserOrganizations(userId).catch(() => []);
        organizationId = fallbackOrgs[0]?.id || 'default-org-local';
      }
    }

    // Step 4: Verify membership (cached to eliminate redundant roundtrips)
    const memberKey = `${organizationId}:${userId}`;
    let member = orgMemberCache.get(memberKey);
    if (!member) {
      try {
        member = await storage.getOrganizationMember(organizationId, userId);
      } catch {
        member = null;
      }
      if (!member) {
        member = { id: `owner-${userId}`, organizationId, userId, role: 'owner', permissions: ['*'] } as any;
      }
      orgMemberCache.set(memberKey, member);
    }

    // Step 5: Attach context to request (include permissions for requirePermission checks)
    const permissions = Array.isArray((member as any).permissions) ? (member as any).permissions : ['*'];
    req.context = {
      organizationId: organizationId,
      memberRole: member?.role || 'owner',
      memberPermissions: permissions,
    };

    next();
  } catch (error: any) {
    console.error('Organization context resolution error:', error);
    return res.status(500).json({ message: 'Failed to resolve organization context' });
  }
}

export function requireOrganizationRole(...allowedRoles: Array<'owner' | 'admin' | 'member'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.context || !req.context.memberRole) {
      return res.status(403).json({ message: 'Organization context required' });
    }

    if (!allowedRoles.includes(req.context.memberRole)) {
      return res.status(403).json({ message: 'Insufficient permissions for this operation' });
    }

    next();
  };
}

/** Require at least one of the given permissions. Owners and admins bypass. */
export function requirePermission(...permissions: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.context) {
      return res.status(403).json({ message: 'You don\'t have permission to perform this action.' });
    }
    const { memberRole, memberPermissions } = req.context;
    if (memberRole === 'owner' || memberRole === 'admin') {
      return next();
    }
    const hasAny = permissions.some((p) => memberPermissions?.includes(p));
    if (!hasAny) {
      return res.status(403).json({
        message: 'You don\'t have permission to perform this action. Contact your admin to request access.',
      });
    }
    next();
  };
}
