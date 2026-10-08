// @ts-nocheck
import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replitAuth";
import { profileAvatarUpload } from "./uploads";
import { getUserId, withAuthAndRateLimit } from "./shared";
import { createPasswordResetToken } from "../localAuth";
import crypto from "crypto";

export function registerAuthRoutes(app: Express) {
  // Auth endpoints (no rate limiting on auth endpoints)
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    console.log('[Auth] GET /api/auth/user called');
    console.log('[Auth] req.isAuthenticated():', req.isAuthenticated());
    console.log('[Auth] req.session:', !!req.session);
    console.log('[Auth] req.session.passport:', (req.session as any)?.passport);
    console.log('[Auth] req.user:', !!req.user);
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error: any) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Update user profile
  app.patch('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { firstName, lastName, email } = req.body;
      
      const updated = await storage.updateUser(userId, {
        firstName,
        lastName,
        email,
      });
      
      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: error.message || "Failed to update user" });
    }
  });

  // Change password
  app.post('/api/auth/change-password', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { currentPassword, newPassword } = req.body;
      
      // Get user to verify current password
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Verify current password (if user has passwordHash)
      if (user.passwordHash) {
        const bcrypt = await import('bcryptjs');
        const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isValid) {
          return res.status(400).json({ message: "Current password is incorrect" });
        }
      }
      
      // Hash new password
      const bcrypt = await import('bcryptjs');
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(newPassword, salt);
      
      // Update password
      await storage.updateUser(userId, { passwordHash } as any);
      
      res.json({ success: true, message: "Password changed successfully" });
    } catch (error: any) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: error.message || "Failed to change password" });
    }
  });

  // Upload profile avatar
  app.post('/api/auth/user/avatar', isAuthenticated, profileAvatarUpload.single('file'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      const profileImageUrl = `/uploads/profile/${file.filename}`;
      const updated = await storage.updateUser(userId, { profileImageUrl } as any);
      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(updated);
    } catch (error: any) {
      console.error("Error uploading avatar:", error);
      res.status(500).json({ message: error.message || "Failed to upload avatar" });
    }
  });

  // Get user by email
  app.get('/api/users/by-email', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const { email } = req.query;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(user);
    } catch (error: any) {
      console.error("Error fetching user by email:", error);
      res.status(500).json({ message: error.message || "Failed to fetch user" });
    }
  });

  // Invite user (create user account and add to organization)
  app.post('/api/users/invite', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { email, firstName, lastName, phone, organizationId, role, permissions } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      if (!organizationId) {
        return res.status(400).json({ message: "Organization ID is required" });
      }

      const { assertPlanQuota, sendPlanQuotaDenial } = await import("../utils/plan-quotas");
      const existingMemberCheck = await storage.getUserByEmail(email);
      if (existingMemberCheck) {
        const alreadyInOrg = await storage.getOrganizationMember(organizationId, existingMemberCheck.id);
        if (alreadyInOrg) {
          return res.status(400).json({ message: "User is already a member of this organization" });
        }
      }
      const teamQuota = await assertPlanQuota({ userId, organizationId, kind: "team_members" });
      if (teamQuota) return sendPlanQuotaDenial(res, teamQuota);
      
      const inviter = await storage.getUser(userId);
      const org = await storage.getOrganization(organizationId);
      const inviterName = inviter?.firstName
        ? `${inviter.firstName}${inviter.lastName ? ` ${inviter.lastName}` : ''}`
        : inviter?.email || 'A team member';
      const organizationName = org?.name || 'the organization';
      
      let targetUser = await storage.getUserByEmail(email);
      let emailSent = true;
      
      if (targetUser) {
        const bcrypt = await import('bcryptjs');
        const crypto = await import('crypto');
        const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        const tempPassword = Array.from(crypto.randomBytes(12), (b: number) => CHARS[b % CHARS.length]).join('');
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(tempPassword, salt);
        await storage.updateUser(targetUser.id, { passwordHash });
        const displayName = [firstName, lastName].filter(Boolean).join(' ').trim() || targetUser.firstName || email.split('@')[0];
        const baseUrl = (process.env.BASE_URL || 'http://localhost:5001').split(/\s*[\n#]/)[0].trim().replace(/\/+$/, '');
        const setPasswordLink = createPasswordResetToken(targetUser.id, email, process.env.BASE_URL);
        const loginUrl = `${baseUrl}/login`;
        const { sendInvitationEmail } = await import('../utils/email');
        emailSent = await sendInvitationEmail(
          email,
          inviterName,
          organizationName,
          setPasswordLink,
          displayName || undefined,
          tempPassword,
          loginUrl,
          userId,
          organizationId
        );
        if (!emailSent) {
          console.log(`[Invite] Email not sent for re-invited ${email}. Password: ${tempPassword}, link: ${setPasswordLink}`);
        }
      } else {
        const bcrypt = await import('bcryptjs');
        const crypto = await import('crypto');
        const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        const tempPassword = Array.from(crypto.randomBytes(12), (b: number) => CHARS[b % CHARS.length]).join('');
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(tempPassword, salt);
        
        const displayName = [firstName, lastName].filter(Boolean).join(' ').trim() || email.split('@')[0];
        targetUser = await storage.upsertUser({
          email,
          passwordHash,
          firstName: firstName || email.split('@')[0],
          lastName: lastName || null,
          isActive: true,
        });
        
        const baseUrl = (process.env.BASE_URL || 'http://localhost:5001').split(/\s*[\n#]/)[0].trim().replace(/\/+$/, '');
        const setPasswordLink = createPasswordResetToken(targetUser.id, email, process.env.BASE_URL);
        const loginUrl = `${baseUrl}/login`;
        const { sendInvitationEmail } = await import('../utils/email');
        emailSent = await sendInvitationEmail(
          email,
          inviterName,
          organizationName,
          setPasswordLink,
          displayName || undefined,
          tempPassword,
          loginUrl,
          userId,
          organizationId
        );
        if (!emailSent) {
          console.log(`[Invite] Email not sent. Credentials for ${email}: password ${tempPassword}, set link: ${setPasswordLink}`);
          console.log(`[Invite] Check: 1) Settings → SMTP (or org owner’s SMTP / .env fallback), 2) Gmail App Password if using Gmail, 3) 2-Step Verification`);
        }
      }
      
      const member = await storage.addOrganizationMember({
        organizationId,
        userId: targetUser.id,
        role: role || 'member',
        permissions: Array.isArray(permissions) ? permissions : [],
        invitedBy: userId,
      });

      try {
        const { waiveOnboardingForTeamMember } = await import("../whitelabel-onboarding-eligibility");
        await waiveOnboardingForTeamMember(targetUser.id);
      } catch (e) {
        console.warn("[Invite] waive onboarding for team member:", e);
      }
      
      res.json({ user: targetUser, member, emailSent });
    } catch (error: any) {
      console.error("Error inviting user:", error);
      res.status(500).json({ message: error.message || "Failed to invite user" });
    }
  });

  // API Key management endpoints (no rate limiting - managed by auth)
  app.get('/api/keys', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const keys = await storage.getApiKeysByUser(userId);
      // Do not send full key in list; only masked preview for display
      const safe = keys.map(({ key, ...rest }) => ({
        ...rest,
        keyPreview: key ? `${key.slice(0, 10)}...${key.slice(-4)}` : null,
      }));
      res.json(safe);
    } catch (error: any) {
      console.error("Error fetching API keys:", error);
      res.status(500).json({ message: "Failed to fetch API keys" });
    }
  });

  app.post('/api/keys', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name, organizationId } = req.body;
      
      if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ message: "Key name is required" });
      }
      
      const crypto = await import("crypto");
      const key = `wapi_${Date.now()}_${crypto.randomUUID()}`;
      const apiKey = await storage.createApiKey({
        userId,
        organizationId: organizationId || null,
        name: name.trim(),
        key,
      });
      
      res.status(201).json(apiKey);
    } catch (error: any) {
      console.error("Error creating API key:", error);
      res.status(500).json({ message: error.message || "Failed to create API key" });
    }
  });

  app.delete('/api/keys/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      
      const key = await storage.getApiKey(id);
      if (!key || key.userId !== userId) {
        return res.status(404).json({ message: "API key not found" });
      }
      
      await storage.deleteApiKey(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting API key:", error);
      res.status(500).json({ message: error.message || "Failed to delete API key" });
    }
  });
}
