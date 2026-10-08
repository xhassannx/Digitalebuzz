// @ts-nocheck
import type { Express } from "express";
import { storage } from "../storage";
import { crmRegisterSchema } from "@shared/schema";
import { fromError } from "zod-validation-error";
import crypto from "crypto";
import { shouldSkipDefaultPlanAssignment } from "../utils/system-free-plan";

export function registerCrmRoutes(app: Express) {
  // CRM Auto-login endpoint - allows users to auto-login using their API key
  app.get('/crm-login', async (req: any, res) => {
    try {
      const apiKey = req.query.apiKey as string;
      
      if (!apiKey) {
        return res.status(400).json({ 
          error: 'API key required',
          message: 'Please provide apiKey as query parameter: /crm-login?apiKey=YOUR_API_KEY'
        });
      }

      // Validate API key and get user
      const keyData = await storage.getApiKeyByKey(apiKey);
      if (!keyData) {
        return res.status(401).json({ 
          error: 'Invalid API key',
          message: 'The provided API key is invalid or does not exist'
        });
      }

      // Get user details
      const user = await storage.getUser(keyData.userId);
      if (!user) {
        return res.status(404).json({ 
          error: 'User not found',
          message: 'User associated with this API key does not exist'
        });
      }

      // Update API key last used timestamp
      await storage.updateApiKeyLastUsed(keyData.id);

      // Create session object compatible with Passport.js
      const userSession = {
        claims: {
          sub: user.id,
          email: user.email,
          first_name: user.firstName || '',
          last_name: user.lastName || '',
          profile_image_url: user.profileImageUrl || null,
        },
        expires_at: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 1 week
      };

      // Log in the user using Passport.js
      req.login(userSession, (err: any) => {
        if (err) {
          console.error('[CRM Login] Error in req.login():', err);
          return res.status(500).json({ 
            error: 'Login failed',
            message: 'Failed to establish session. Please try again.'
          });
        }

        req.session.save((saveErr: any) => {
          if (saveErr) {
            console.error('[CRM Login] Session save error:', saveErr);
            return res.status(500).json({
              error: 'Login failed',
              message: 'Failed to save session.'
            });
          }
          // Redirect: support both 'redirect' and 'redirect_url', ensure leading slash
          const raw = (req.query.redirect || req.query.redirect_url || '/dashboard') as string;
          const redirectUrl = typeof raw === 'string' && raw.startsWith('/') ? raw : `/${raw}`;
          console.log(`[CRM Login] Auto-login successful for user ${user.email}, redirecting to ${redirectUrl}`);
          res.redirect(redirectUrl);
        });
      });
    } catch (error: any) {
      console.error('[CRM Login] Error:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message || 'Failed to process auto-login request'
      });
    }
  });

  app.post("/api/crm/register", async (req: any, res) => {
    try {
      const result = crmRegisterSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: fromError(result.error).toString(),
        });
      }
      const { email, tenant_id, firstName, lastName, organizationName, phone } = result.data;
      const tenantId = tenant_id ?? null;

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        const raw = existingUser.tenantId;
        const dbTenantId = raw != null && String(raw).trim() !== "" ? String(raw).trim() : null;

        if (dbTenantId !== null && tenantId !== null && dbTenantId !== tenantId) {
          return res.status(400).json({
            message: "User already registered with a different tenant",
            code: "TENANT_MISMATCH",
          });
        }

        await storage.updateUser(existingUser.id, {
          firstName,
          lastName,
          phone: phone ?? existingUser.phone ?? "",
          tenantId: dbTenantId !== null ? dbTenantId : tenantId,
        });

        const orgs = await storage.getOrganizationsByUser(existingUser.id);
        if (orgs.length > 0 && organizationName) {
          await storage.updateOrganization(orgs[0].id, { name: organizationName });
        }
        const keys = await storage.getApiKeysByUser(existingUser.id);
        let existingKey = keys.find((k) => k.name === "CRM") || keys[0];
        if (!existingKey && orgs.length > 0) {
          const key = `wapi_${Date.now()}_${crypto.randomUUID()}`;
          existingKey = await storage.createApiKey({
            userId: existingUser.id,
            organizationId: orgs[0].id,
            name: "CRM",
            key,
          });
        }
        const subscription = await storage.getActiveSubscriptionByUser(existingUser.id) || await storage.getSubscriptionByUser(existingUser.id);
        const plan = subscription ? await storage.getPlan(subscription.planId) : null;
        const organizationId = orgs.length > 0 ? orgs[0].id : null;
        const finalTenantId = dbTenantId !== null ? dbTenantId : tenantId;
        return res.json({
          user: {
            id: existingUser.id,
            email: existingUser.email,
            firstName,
            lastName,
            phone: phone ?? existingUser.phone ?? null,
            tenantId: finalTenantId,
            organizationId,
          },
          apiKey: existingKey ? existingKey.key : null,
          apiKeyId: existingKey?.id ?? null,
          subscription: subscription
            ? {
                id: subscription.id,
                planId: subscription.planId,
                planName: plan?.displayName ?? null,
                billingCycle: subscription.billingCycle,
                currentPeriodStart: subscription.currentPeriodStart,
                currentPeriodEnd: subscription.currentPeriodEnd,
                status: subscription.status,
              }
            : null,
        });
      }

      const bcrypt = await import("bcryptjs");
      const userId = crypto.randomUUID();
      const randomPassword = crypto.randomBytes(24).toString("hex");
      const passwordHash = await bcrypt.default.hash(randomPassword, 10);

      await storage.upsertUser({
        id: userId,
        email,
        passwordHash,
        firstName,
        lastName,
        phone: phone ?? "",
        tenantId,
      });

      const organization = await storage.createOrganization({
        name: organizationName,
        ownerId: userId,
      });
      const organizationId = organization.id;
      await storage.addOrganizationMember({
        organizationId,
        userId,
        role: "owner",
      });

      const createdUser = await storage.getUser(userId);
      const autoAssignPlan = shouldSkipDefaultPlanAssignment(createdUser)
        ? undefined
        : await storage.getAutoAssignPlan();
      let subscription: Awaited<ReturnType<typeof storage.createSubscription>> = null;
      if (autoAssignPlan) {
        const trialDays = (autoAssignPlan as any).autoAssignTrialDays ?? 7;
        const start = new Date();
        const end = new Date(start);
        end.setDate(end.getDate() + trialDays);
        try {
          subscription = await storage.createSubscription({
            userId,
            planId: autoAssignPlan.id,
            billingCycle: "monthly",
            currentPeriodStart: start,
            currentPeriodEnd: end,
            status: "active",
          });
          await storage.addSubscriptionHistory({
            userId,
            planId: autoAssignPlan.id,
            subscriptionId: subscription.id,
            action: "assigned",
            periodStart: start,
            periodEnd: end,
            billingCycle: "monthly",
          });
        } catch (subErr: any) {
          console.error("[CRM Register] Failed to auto-assign plan:", subErr?.message || subErr);
        }
      }

      const key = `wapi_${Date.now()}_${crypto.randomUUID()}`;
      const apiKeyRecord = await storage.createApiKey({
        userId,
        organizationId,
        name: "CRM",
        key,
      });

      const plan = subscription ? await storage.getPlan(subscription.planId) : null;
      res.status(201).json({
        user: {
          id: userId,
          email,
          firstName,
          lastName,
          phone: phone ?? null,
          tenantId,
          organizationId,
        },
        apiKey: key,
        apiKeyId: apiKeyRecord.id,
        subscription: subscription
          ? {
              id: subscription.id,
              planId: subscription.planId,
              planName: plan?.displayName ?? null,
              billingCycle: subscription.billingCycle,
              currentPeriodStart: subscription.currentPeriodStart,
              currentPeriodEnd: subscription.currentPeriodEnd,
              status: subscription.status,
            }
          : null,
      });
    } catch (err: any) {
      console.error("[CRM Register] Error:", err);
      res.status(500).json({ message: err?.message || "Failed to register user" });
    }
  });
}
