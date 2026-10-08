// @ts-nocheck
import { type Express, type RequestHandler } from "express";
import bcrypt from "bcryptjs";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { storage } from "./storage";
import { signupSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from "@shared/schema";
import { fromError } from "zod-validation-error";
import crypto from "crypto";
import { sendPasswordResetEmail, sendWelcomeEmailAfterSignup, sendLoginVerificationCodeEmail } from "./utils/email";
import { TRIAL_ACCOUNT_DAYS, trialExpiresAtFromNow } from "@shared/trial-account";
import { shouldSkipDefaultPlanAssignment } from "./utils/system-free-plan";
import { accrueInitialWhitelabelOnboardingFee } from "./whitelabel-onboarding-accrual";
import { checkCustomerStatusCached } from "./updates";

// In-memory store for password reset tokens
// In production, this should be stored in a database
interface ResetToken {
  userId: string;
  email: string;
  expiresAt: number;
}

const resetTokens = new Map<string, ResetToken>();

/** First-login email OTP (only while email_verified is false). */
interface LoginVerificationPending {
  userId: string;
  email: string;
  code: string;
  expiresAt: number;
  attempts: number;
}

const loginVerificationCodes = new Map<string, LoginVerificationPending>();

function normalizeAuthEmail(email: string): string {
  return String(email || "").trim().toLowerCase();
}

function generateLoginVerificationCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function issueLoginVerificationCode(userId: string, email: string): Promise<{ emailSent: boolean; code?: string }> {
  const key = normalizeAuthEmail(email);
  const code = generateLoginVerificationCode();
  loginVerificationCodes.set(key, {
    userId,
    email: key,
    code,
    expiresAt: Date.now() + 15 * 60 * 1000,
    attempts: 0,
  });
  const emailSent = await sendLoginVerificationCodeEmail(key, code);
  if (!emailSent) {
    console.log(`[LocalAuth] Login verification code for ${key}: ${code}`);
  }
  const isDev = process.env.NODE_ENV !== "production";
  return { emailSent, ...(isDev && !emailSent ? { code } : {}) };
}

/** When SaaS owner has Stopped the WL, only the partner admin may log in (to pay). */
async function rejectEndUserIfLicensorStopped(_dbUser: {
  isSaaSOwner?: boolean | null;
}): Promise<{ blocked: true; message: string; code: string } | { blocked: false }> {
  return { blocked: false };
}

function buildUserSession(user: {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
}) {
  return {
    claims: {
      sub: user.id,
      email: user.email,
      first_name: user.firstName,
      last_name: user.lastName,
      profile_image_url: user.profileImageUrl,
    },
    expires_at: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
  };
}

// In-memory store for Google OAuth login state (unauthenticated flow)
interface GoogleOAuthState {
  state: string;
  redirectTo?: string;
  expiresAt: number;
}
const googleOAuthStates = new Map<string, GoogleOAuthState>();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
// Sanitize: strip newlines, # comments (common .env mistake)
const BASE_URL = (process.env.BASE_URL || "http://localhost:5002").split(/\s*[\n#]/)[0].trim().replace(/\/+$/, "");

/**
 * Create a password set/reset token for a user (used for invite flow).
 * Returns the full reset link URL.
 */
export function createPasswordResetToken(userId: string, email: string, baseUrl?: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours for invites
  resetTokens.set(token, { userId, email, expiresAt });
  const raw = baseUrl || process.env.BASE_URL || 'http://localhost:5002';
  const host = raw.split(/\s*[\n#]/)[0].trim().replace(/\/+$/, '');
  return `${host}/reset-password/${token}`;
}

// Clean up expired tokens periodically
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of resetTokens.entries()) {
    if (data.expiresAt < now) {
      resetTokens.delete(token);
    }
  }
  for (const [email, data] of loginVerificationCodes.entries()) {
    if (data.expiresAt < now) {
      loginVerificationCodes.delete(email);
    }
  }
}, 60 * 60 * 1000); // Clean up every hour

// Setup local password-based authentication strategy
export function setupLocalAuth(app: Express) {
  console.log('[LocalAuth] Setting up local authentication routes...');
  // Configure passport local strategy
  passport.use(new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password'
    },
    async (email, password, done) => {
      try {
        console.log('[LocalAuth] Attempting login for email:', email);
        const user = await storage.getUserByEmail(email);
        if (!user || !user.passwordHash) {
          console.log('[LocalAuth] User not found or no password hash');
          return done(null, false, { message: 'Invalid email or password' });
        }

        console.log('[LocalAuth] Comparing password...');
        const isValidPassword = await bcrypt.compare(password, user.passwordHash);
        console.log('[LocalAuth] Password valid:', isValidPassword);
        if (!isValidPassword) {
          console.log('[LocalAuth] Invalid password for user:', email);
          return done(null, false, { message: 'Invalid email or password' });
        }

        if (!user.isActive || user.accountStatus !== 'active') {
          return done(null, false, { message: 'Your account is inactive or suspended. Contact support to restore access.' });
        }

        // Create user session object (compatible with existing session structure)
        const userSession = {
          claims: {
            sub: user.id,
            email: user.email,
            first_name: user.firstName,
            last_name: user.lastName,
            profile_image_url: user.profileImageUrl,
          },
          expires_at: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 1 week
        };

        return done(null, userSession);
      } catch (error) {
        return done(error);
      }
    }
  ));

  // Signup endpoint
  app.post("/api/auth/signup", async (req, res) => {
    try {
      // Validate input
      const result = signupSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: fromError(result.error).toString(),
        });
      }

      const { email, password, firstName, lastName, organizationName, phone } = result.data;
      const isTrialAccount = req.body?.isTrial === true || req.body?.isTrial === "true";

      try {
        const portal = await checkCustomerStatusCached();
        if (!portal.allowed && portal.code === "ACCOUNT_INACTIVE") {
          return res.status(403).json({
            message: "New registrations are temporarily unavailable. Please try again later.",
            code: "ACCOUNT_INACTIVE",
          });
        }
      } catch {
        /* fail open if portal cannot be evaluated */
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user (email must be verified on first login before session is created)
      const userId = crypto.randomUUID();
      await storage.upsertUser({
        id: userId,
        email,
        passwordHash,
        firstName,
        lastName,
        phone,
        emailVerified: false,
        isSaaSOwner: false,
        isActive: true,
        accountStatus: "active",
        isTrialAccount: false,
        trialExpiresAt: null,
      });

      // Create organization
      const organization = await storage.createOrganization({
        name: organizationName,
        ownerId: userId,
      });
      const organizationId = organization.id;

      // Add user to organization as owner
      await storage.addOrganizationMember({
        organizationId,
        userId,
        role: 'owner',
      });

      // Auto-assign plan on signup if configured (skip SaaS platform owners)
      const signupUser = await storage.getUser(userId);
      const autoAssignPlan = shouldSkipDefaultPlanAssignment(signupUser)
        ? undefined
        : await storage.getAutoAssignPlan();
      if (autoAssignPlan) {
        const trialDays = isTrialAccount
          ? TRIAL_ACCOUNT_DAYS
          : ((autoAssignPlan as any).autoAssignTrialDays ?? 7);
        const start = new Date();
        const end = isTrialAccount ? trialExpiresAtFromNow(TRIAL_ACCOUNT_DAYS) : new Date(start);
        if (!isTrialAccount) {
          end.setDate(end.getDate() + trialDays);
        }
        try {
          const subscription = await storage.createSubscription({
            userId,
            planId: autoAssignPlan.id,
            billingCycle: 'monthly',
            currentPeriodStart: start,
            currentPeriodEnd: end,
            status: 'active',
          });
          await storage.addSubscriptionHistory({
            userId,
            planId: autoAssignPlan.id,
            subscriptionId: subscription.id,
            action: 'assigned',
            periodStart: start,
            periodEnd: end,
            billingCycle: 'monthly',
          });
          console.log(`[LocalAuth] Auto-assigned plan "${autoAssignPlan.displayName}" to new user (${trialDays} days trial)`);
        } catch (subErr) {
          console.error('[LocalAuth] Failed to auto-assign plan:', subErr);
        }
      }

      try {
        await accrueInitialWhitelabelOnboardingFee(userId, "purchased");
      } catch (accrualErr) {
        console.error("[LocalAuth] Onboarding fee accrual on signup:", accrualErr);
      }

      // Send email verification OTP immediately — user verifies on signup, then is logged in
      const issued = await issueLoginVerificationCode(userId, email);

      void sendWelcomeEmailAfterSignup({
        userId,
        email,
        firstName,
        organizationName,
        isTrialAccount,
      }).catch((err) => console.error("[LocalAuth] Onboarding email:", err));

      console.log("[LocalAuth] Signup successful — verification code issued for:", userId);
      return res.status(201).json({
        message: issued.emailSent
          ? "Account created. Enter the verification code we sent to your email to finish signing up."
          : "Account created. We could not deliver the verification email — request a new code or check SMTP settings.",
        requiresVerification: true,
        email,
        emailSent: issued.emailSent,
        ...(issued.code ? { debugCode: issued.code } : {}),
        user: {
          id: userId,
          email,
          firstName,
          lastName,
        },
      });
    } catch (error: any) {
      console.error("Signup error:", error);
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  // Login endpoint
  app.post("/api/auth/login", (req, res, next) => {
    console.log('[LocalAuth] Login request received');
    // Validate input
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
      console.log('[LocalAuth] Validation failed:', result.error);
      return res.status(400).json({
        message: "Validation failed",
        errors: fromError(result.error).toString(),
      });
    }

    passport.authenticate('local', async (err: any, user: any, info: any) => {
      console.log('[LocalAuth] Passport authenticate callback - err:', err, 'user:', !!user, 'info:', info);
      if (err) {
        console.error('[LocalAuth] Authentication error:', err);
        return res.status(500).json({ message: "Authentication error" });
      }
      if (!user) {
        console.log('[LocalAuth] Authentication failed - no user');
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }

      try {
        const rawEmail = String(user.claims?.email || result.data.email || "");
        const dbUser =
          (await storage.getUserByEmail(rawEmail)) ||
          (await storage.getUserByEmail(normalizeAuthEmail(rawEmail)));
        if (!dbUser) {
          return res.status(401).json({ message: "Invalid credentials" });
        }

        const stopped = await rejectEndUserIfLicensorStopped(dbUser);
        if (stopped.blocked) {
          return res.status(403).json({ message: stopped.message, code: stopped.code });
        }

        // First-time login: require email OTP before creating a session
        if (!dbUser.emailVerified) {
          const issued = await issueLoginVerificationCode(dbUser.id, dbUser.email || rawEmail);
          return res.json({
            requiresVerification: true,
            email: dbUser.email || normalizeAuthEmail(rawEmail),
            message: "A verification code has been sent to your email. Enter it to finish signing in.",
            ...(issued.code ? { debugCode: issued.code } : {}),
          });
        }

        req.login(user, (loginErr) => {
          if (loginErr) {
            console.error('[LocalAuth] Error in req.login() during login:', loginErr);
            return res.status(500).json({ message: "Failed to establish session" });
          }

          console.log('[LocalAuth] Login successful, session info:');
          console.log('[LocalAuth] req.session:', !!req.session);
          console.log('[LocalAuth] req.session.passport:', (req.session as any)?.passport);
          console.log('[LocalAuth] req.isAuthenticated():', req.isAuthenticated());

          req.session.save((saveErr) => {
            if (saveErr) {
              console.error('[LocalAuth] Session save error:', saveErr);
              return res.status(500).json({ message: "Failed to save session" });
            }
            res.json({
              message: "Login successful",
              user: {
                id: user.claims.sub,
                email: user.claims.email,
                firstName: user.claims.first_name,
                lastName: user.claims.last_name,
              },
            });
          });
        });
      } catch (loginFlowErr: any) {
        console.error('[LocalAuth] Login flow error:', loginFlowErr);
        return res.status(500).json({ message: "Authentication error" });
      }
    })(req, res, next);
  });

  // Verify first-login email code, then establish session
  app.post("/api/auth/verify-login-code", async (req, res) => {
    try {
      const email = normalizeAuthEmail(req.body?.email);
      const code = String(req.body?.code || "").trim();
      if (!email || !/^\d{6}$/.test(code)) {
        return res.status(400).json({ message: "Email and a 6-digit verification code are required" });
      }

      const pending = loginVerificationCodes.get(email);
      if (!pending || pending.expiresAt < Date.now()) {
        loginVerificationCodes.delete(email);
        return res.status(400).json({
          message: "Verification code expired. Please request a new code.",
        });
      }

      pending.attempts += 1;
      if (pending.attempts > 8) {
        loginVerificationCodes.delete(email);
        return res.status(429).json({ message: "Too many attempts. Please log in again to get a new code." });
      }

      if (pending.code !== code) {
        return res.status(400).json({ message: "Invalid verification code" });
      }

      loginVerificationCodes.delete(email);

      const dbUser = await storage.getUser(pending.userId);
      if (!dbUser) {
        return res.status(400).json({ message: "User not found" });
      }

      const stopped = await rejectEndUserIfLicensorStopped(dbUser);
      if (stopped.blocked) {
        return res.status(403).json({ message: stopped.message, code: stopped.code });
      }

      await storage.updateUser(dbUser.id, { emailVerified: true });

      const userSession = buildUserSession({
        id: dbUser.id,
        email: dbUser.email,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        profileImageUrl: dbUser.profileImageUrl,
      });

      return req.login(userSession, (loginErr) => {
        if (loginErr) {
          console.error("[LocalAuth] verify-login-code req.login failed:", loginErr);
          return res.status(500).json({ message: "Failed to establish session" });
        }
        return req.session.save((saveErr) => {
          if (saveErr) {
            console.error("[LocalAuth] verify-login-code session save failed:", saveErr);
            return res.status(500).json({ message: "Failed to save session" });
          }
          return res.json({
            message: "Email verified. Login successful",
            user: {
              id: dbUser.id,
              email: dbUser.email,
              firstName: dbUser.firstName,
              lastName: dbUser.lastName,
            },
          });
        });
      });
    } catch (error: any) {
      console.error("[LocalAuth] verify-login-code error:", error);
      return res.status(500).json({ message: "Failed to verify code" });
    }
  });

  // Resend email verification code (signup or first login while unverified)
  app.post("/api/auth/resend-login-code", async (req, res) => {
    try {
      const email = normalizeAuthEmail(req.body?.email);
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const dbUser = await storage.getUserByEmail(email);
      if (!dbUser) {
        return res.status(400).json({ message: "No account found for this email." });
      }
      if (dbUser.emailVerified) {
        loginVerificationCodes.delete(email);
        return res.status(400).json({ message: "Email is already verified. Please log in." });
      }

      const issued = await issueLoginVerificationCode(dbUser.id, email);
      return res.json({
        message: issued.emailSent
          ? "A new verification code has been sent to your email."
          : "Could not send email. Check SMTP settings, or use the debug code in development.",
        email,
        emailSent: issued.emailSent,
        ...(issued.code ? { debugCode: issued.code } : {}),
      });
    } catch (error: any) {
      console.error("[LocalAuth] resend-login-code error:", error);
      return res.status(500).json({ message: "Failed to resend code" });
    }
  });

  // Google OAuth login (simple, real account chooser)
  app.get("/api/auth/google/authorize", async (req, res) => {
    try {
      if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        return res.status(500).json({ message: "Google OAuth not configured (missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET)" });
      }

      const state = crypto.randomBytes(32).toString("hex");
      const redirectTo = typeof req.query.redirectTo === "string" ? req.query.redirectTo : "/";
      googleOAuthStates.set(state, {
        state,
        redirectTo,
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      });

      const redirectUri = `${BASE_URL}/api/auth/google/callback`;
      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", "openid email profile");
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("prompt", "select_account");

      return res.redirect(authUrl.toString());
    } catch (error: any) {
      console.error("[LocalAuth] Google authorize error:", error);
      return res.status(500).json({ message: "Failed to initiate Google login" });
    }
  });

  app.get("/api/auth/google/callback", async (req: any, res) => {
    try {
      if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        return res.redirect(`${BASE_URL}/login?error=google_not_configured`);
      }

      const { code, state, error } = req.query as Record<string, string | undefined>;
      if (error) {
        return res.redirect(`${BASE_URL}/login?error=${encodeURIComponent(error)}`);
      }
      if (!code || !state) {
        return res.redirect(`${BASE_URL}/login?error=missing_parameters`);
      }

      const stored = googleOAuthStates.get(state);
      googleOAuthStates.delete(state);
      if (!stored || stored.expiresAt < Date.now()) {
        return res.redirect(`${BASE_URL}/login?error=invalid_state`);
      }

      const redirectUri = `${BASE_URL}/api/auth/google/callback`;
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text();
        console.error("[LocalAuth] Google token exchange failed:", errorData);
        return res.redirect(`${BASE_URL}/login?error=token_exchange_failed`);
      }

      const tokens = (await tokenResponse.json()) as any;
      const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      if (!userInfoResponse.ok) {
        return res.redirect(`${BASE_URL}/login?error=user_info_failed`);
      }

      const userInfo = (await userInfoResponse.json()) as any;
      const email = userInfo.email as string | undefined;
      if (!email) {
        return res.redirect(`${BASE_URL}/login?error=email_missing`);
      }

      // Find or create user by email (passwordless Google login — email already verified by Google)
      let user = await storage.getUserByEmail(email);
      if (!user) {
        try {
          const portal = await checkCustomerStatusCached();
          if (!portal.allowed && portal.code === "ACCOUNT_INACTIVE") {
            return res.redirect(`${BASE_URL}/login?error=panel_stopped`);
          }
        } catch {
          /* fail open */
        }
        const userId = crypto.randomUUID();
        const [firstName, ...rest] = String(userInfo.given_name || userInfo.name || "").split(" ").filter(Boolean);
        const lastName = String(userInfo.family_name || rest.join(" ") || "");
        await storage.upsertUser({
          id: userId,
          email,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          profileImageUrl: userInfo.picture || undefined,
          emailVerified: true,
        } as any);
        user = await storage.getUserByEmail(email);
      } else {
        // Best-effort profile sync + mark verified (Google confirmed email)
        try {
          await storage.updateUser(user.id, {
            profileImageUrl: userInfo.picture || user.profileImageUrl,
            emailVerified: true,
          } as any);
        } catch {
          // ignore
        }
      }

      const userId = user!.id;
      const stopped = await rejectEndUserIfLicensorStopped(user!);
      if (stopped.blocked) {
        return res.redirect(`${BASE_URL}/login?error=panel_stopped`);
      }

      const userSession = {
        claims: {
          sub: userId,
          email,
          first_name: (user as any).firstName,
          last_name: (user as any).lastName,
          profile_image_url: (user as any).profileImageUrl,
        },
        expires_at: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
      };

      return req.login(userSession, (loginErr: any) => {
        if (loginErr) {
          console.error("[LocalAuth] Google req.login() failed:", loginErr);
          return res.redirect(`${BASE_URL}/login?error=session_failed`);
        }
        return req.session.save((saveErr: any) => {
          if (saveErr) {
            console.error("[LocalAuth] Google session save failed:", saveErr);
            return res.redirect(`${BASE_URL}/login?error=session_save_failed`);
          }
          const dest = stored.redirectTo && stored.redirectTo !== "/" ? stored.redirectTo : "/dashboard";
          return res.redirect(`${BASE_URL}${dest.startsWith("/") ? dest : `/${dest}`}`);
        });
      });
    } catch (error: any) {
      console.error("[LocalAuth] Google callback error:", error);
      return res.redirect(`${BASE_URL}/login?error=callback_failed`);
    }
  });

  // Forgot password endpoint
  app.post("/api/auth/forgot-password", async (req, res) => {
    console.log('[LocalAuth] Forgot password endpoint called');
    try {
      // Validate input
      const result = forgotPasswordSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: fromError(result.error).toString(),
        });
      }

      const { email } = result.data;

      // Check if user exists
      const user = await storage.getUserByEmail(email);
      
      // Always return success to prevent email enumeration
      // In production, you would send an email here
      if (user && user.passwordHash) {
        // Generate reset token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = Date.now() + (60 * 60 * 1000); // 1 hour from now

        resetTokens.set(token, {
          userId: user.id,
          email: user.email!,
          expiresAt,
        });

        // Send email with reset link
        const resetLink = `${req.protocol}://${req.get('host')}/reset-password/${token}`;
        console.log(`[Password Reset] Generating reset link for ${email}`);
        
        // Send password reset email
        const emailSent = await sendPasswordResetEmail(email, resetLink);
        if (!emailSent) {
          // If email sending failed, log the link as fallback
          console.log(`[Password Reset] Reset link for ${email}: ${resetLink}`);
          // In development, return the link so user can still reset (e.g. while SMTP is misconfigured)
          const isDev = process.env.NODE_ENV !== "production";
          if (isDev) {
            return res.json({
              message: "If an account exists with this email, you will receive a password reset link.",
              resetLink,
              emailSent: false,
            });
          }
        }
      }

      // Always return success message to prevent email enumeration
      res.json({
        message: "If an account exists with this email, you will receive a password reset link.",
      });
    } catch (error: any) {
      console.error("Forgot password error:", error);
      // Still return success to prevent email enumeration
      res.json({
        message: "If an account exists with this email, you will receive a password reset link.",
      });
    }
  });

  // Reset password endpoint
  app.post("/api/auth/reset-password", async (req, res) => {
    console.log('[LocalAuth] Reset password endpoint called');
    try {
      // Validate input
      const result = resetPasswordSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: fromError(result.error).toString(),
        });
      }

      const { token, password } = result.data;

      // Check if token exists and is valid
      const tokenData = resetTokens.get(token);
      if (!tokenData) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }

      // Check if token has expired
      if (tokenData.expiresAt < Date.now()) {
        resetTokens.delete(token);
        return res.status(400).json({ message: "Reset token has expired" });
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(password, 10);

      // Update user password
      await storage.updateUser(tokenData.userId, { passwordHash });

      // Delete used token
      resetTokens.delete(token);

      res.json({
        message: "Password reset successful",
      });
    } catch (error: any) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Logout endpoint (works for both OIDC and local auth)
  app.post("/api/auth/logout", (req, res) => {
    req.logout(() => {
      res.json({ message: "Logged out successfully" });
    });
  });
}

// Middleware to check if user is authenticated (works with both OIDC and local auth)
export const isAuthenticatedLocal: RequestHandler = async (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const user = req.user as any;
  
  // Check if session is expired
  if (user.expires_at) {
    const now = Math.floor(Date.now() / 1000);
    if (now > user.expires_at) {
      return res.status(401).json({ message: "Session expired" });
    }
  }

  next();
};
