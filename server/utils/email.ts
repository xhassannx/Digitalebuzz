// @ts-nocheck
import nodemailer from "nodemailer";
import { storage } from "../storage";

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Prefer this user's row in `smtp_settings` */
  userId?: string;
  /** If the primary user has no SMTP row (e.g. admin inviting), try these user ids (e.g. organization owner). */
  smtpFallbackUserIds?: string[];
  attachments?: { filename: string; path?: string; content?: Buffer; contentType?: string }[];
}

/**
 * SMTP from `smtp_settings` (per user) first, then environment variables.
 * Supports: SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM
 */
type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  fromName: string;
};

function smtpFromDbRow(dbSettings: NonNullable<Awaited<ReturnType<typeof storage.getSmtpSettings>>>): SmtpConfig | null {
  if (!dbSettings?.smtpHost || !dbSettings.smtpUser || !dbSettings.smtpPass || !dbSettings.fromEmail) {
    return null;
  }
  return {
    host: dbSettings.smtpHost.trim(),
    port: dbSettings.smtpPort || 587,
    secure: Boolean(dbSettings.smtpSecure),
    user: dbSettings.smtpUser.trim(),
    pass: dbSettings.smtpPass.trim().replace(/\s/g, ""),
    from: dbSettings.fromEmail.trim(),
    fromName: (dbSettings.fromName || "WhatsApp SaaS Platform").trim(),
  };
}

async function smtpFromUserIntegrations(userId: string): Promise<SmtpConfig | null> {
  const orgs = await storage.getOrganizationsByUser(userId);
  for (const org of orgs) {
    const list = await storage.getIntegrationsByUser(userId, org.id);
    const smtpInts = list
      .filter((i) => i.name === "smtp" && i.status === "connected" && i.credentials)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    for (const integ of smtpInts) {
      const c = smtpFromWhitelabelSmtpIntegration(integ);
      if (c) return c;
    }
  }
  return null;
}

async function getSmtpConfig(userId?: string, smtpFallbackUserIds: string[] = []): Promise<SmtpConfig | null> {
  const seen = new Set<string>();
  const candidateIds = [userId, ...smtpFallbackUserIds].filter((id): id is string => Boolean(id));
  for (const uid of candidateIds) {
    if (seen.has(uid)) continue;
    seen.add(uid);
    const dbSettings = await storage.getSmtpSettings(uid);
    const fromDb = dbSettings ? smtpFromDbRow(dbSettings) : null;
    if (fromDb) return fromDb;
    const fromIntegration = await smtpFromUserIntegrations(uid);
    if (fromIntegration) return fromIntegration;
  }

  return getWhitelabelPanelSmtpConfig();
}

function smtpFromWhitelabelSmtpIntegration(integ: {
  status: string;
  credentials: unknown;
  config: unknown | null;
}): SmtpConfig | null {
  if (integ.status !== "connected") return null;
  const credentials = integ.credentials as Record<string, unknown> | null;
  if (!credentials || typeof credentials !== "object") return null;
  const config = (integ.config && typeof integ.config === "object" ? integ.config : {}) as Record<string, unknown>;
  const host = String(credentials.host ?? config.host ?? "").trim();
  const port = Number(credentials.port ?? config.port ?? 587) || 587;
  const secure = Boolean(credentials.secure ?? config.secure === true);
  const user = String(credentials.username ?? credentials.user ?? config.username ?? "").trim();
  const pass = String(credentials.password ?? credentials.pass ?? "").trim();
  const from = String(credentials.from ?? config.from ?? user).trim();
  const fromName = String(config.fromName ?? "WhatsApp SaaS Platform").trim();
  if (!host || !user || !pass || !from) return null;
  return { host, port, secure, user, pass, from, fromName: fromName || "WhatsApp SaaS Platform" };
}

/**
 * Outbound SMTP for panel-wide transactional mail (welcome, subscription reminders):
 * 1) Whitelabel admin Integrations → SMTP (connected)
 * 2) Whitelabel admin Settings → SMTP (`smtp_settings` for SaaS owner)
 * 3) Same fallback order as forgot-password (`getForgotPasswordSmtpUserId`)
 * 4) Environment variables
 */
export async function getWhitelabelPanelSmtpConfig(): Promise<SmtpConfig | null> {
  const integ = await storage.getSaasOwnerSmtpIntegration();
  if (integ) {
    const c = smtpFromWhitelabelSmtpIntegration(integ);
    if (c) return c;
  }
  const owner = await storage.getSaasOwnerUser();
  if (owner) {
    const row = await storage.getSmtpSettings(owner.id);
    const fromDb = row ? smtpFromDbRow(row) : null;
    if (fromDb) return fromDb;
  }
  const smtpUserId = await storage.getForgotPasswordSmtpUserId();
  if (smtpUserId) {
    const row = await storage.getSmtpSettings(smtpUserId);
    const fromDb = row ? smtpFromDbRow(row) : null;
    if (fromDb) return fromDb;
  }
  const host = process.env.SMTP_HOST?.trim() || "";
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const secure = process.env.SMTP_SECURE === "true" || process.env.SMTP_SECURE === "1";
  const user = process.env.SMTP_USER?.trim() || "";
  const pass = (process.env.SMTP_PASS || "").trim().replace(/\s/g, "");
  const from = process.env.SMTP_FROM || process.env.FROM_EMAIL || user || "noreply@example.com";
  const fromName = process.env.SMTP_FROM_NAME || process.env.FROM_NAME || "WhatsApp SaaS Platform";
  if (!host || !user || !pass) return null;
  return { host, port, secure, user, pass, from, fromName };
}

/** Send using {@link getWhitelabelPanelSmtpConfig} only (not the recipient's SMTP row). */
export async function sendWhitelabelPanelEmail(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<boolean> {
  const smtpConfig = await getWhitelabelPanelSmtpConfig();
  const transporter = smtpConfig ? getTransporter(smtpConfig) : null;

  if (!transporter) {
    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("📧 PANEL EMAIL (whitelabel SMTP not configured — would send):");
    console.log("═══════════════════════════════════════════════════════════");
    console.log(`To: ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    console.log(`\n${options.text}`);
    console.log("═══════════════════════════════════════════════════════════\n");
    return false;
  }

  try {
    const mailOptions = {
      from: `"${smtpConfig!.fromName}" <${smtpConfig!.from}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html || options.text,
    };
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email][Panel] Sent to ${options.to} (Message ID: ${info.messageId})`);
    return true;
  } catch (error: any) {
    console.error("[Email][Panel] Failed to send:", error?.message || error);
    return false;
  }
}

/**
 * Outbound SMTP for an organization: any org-scoped Integrations → SMTP, then owner's Settings → SMTP,
 * then whitelabel / env fallback (same as panel-wide mail).
 */
export async function getOrgOutboundSmtpConfig(organizationId: string): Promise<SmtpConfig | null> {
  const orgList = await storage.getIntegrationsByOrganization(organizationId);
  const orgSmtpInts = orgList
    .filter((i) => i.name === "smtp" && i.status === "connected" && i.credentials)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  for (const integ of orgSmtpInts) {
    const c = smtpFromWhitelabelSmtpIntegration(integ);
    if (c) return c;
  }

  const org = await storage.getOrganization(organizationId);
  if (org?.ownerId) {
    const row = await storage.getSmtpSettings(org.ownerId);
    const fromDb = row ? smtpFromDbRow(row) : null;
    if (fromDb) return fromDb;
  }
  return getWhitelabelPanelSmtpConfig();
}

export async function isOrgEmailOutboundConfigured(organizationId: string): Promise<boolean> {
  return !!(await getOrgOutboundSmtpConfig(organizationId));
}

/** Send using {@link getOrgOutboundSmtpConfig} (org SMTP integration / owner settings / platform fallback). */
export async function sendOrgOutboundEmail(
  organizationId: string,
  options: {
    to: string;
    subject: string;
    text: string;
    html?: string;
    attachments?: { filename: string; content: Buffer; contentType?: string }[];
  }
): Promise<boolean> {
  const smtpConfig = await getOrgOutboundSmtpConfig(organizationId);
  const transporter = smtpConfig ? getTransporter(smtpConfig) : null;

  if (!transporter) {
    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("📧 ORG EMAIL (SMTP not configured — would send):");
    console.log("═══════════════════════════════════════════════════════════");
    console.log(`To: ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    console.log(`\n${options.text}`);
    console.log("═══════════════════════════════════════════════════════════\n");
    return false;
  }

  try {
    const mailOptions = {
      from: `"${smtpConfig!.fromName}" <${smtpConfig!.from}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html || options.text,
      attachments: options.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType || "application/octet-stream",
      })),
    };
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email][Org] Sent to ${options.to} (Message ID: ${info.messageId})`);
    return true;
  } catch (error: any) {
    console.error("[Email][Org] Failed to send:", error?.message || error);
    return false;
  }
}

function getTransporter(config: SmtpConfig) {
  // Use Gmail service for smtp.gmail.com - handles Gmail-specific requirements
  if (config.host.includes("gmail.com")) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: { user: config.user, pass: config.pass },
    });
  }

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
  });
}

/**
 * Send an email using SMTP configuration from environment variables
 * Falls back to console logging if SMTP is not configured
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const smtpConfig = await getSmtpConfig(options.userId, options.smtpFallbackUserIds);
  const transporter = smtpConfig ? getTransporter(smtpConfig) : null;

  if (!transporter) {
    // SMTP not configured - log the email instead
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📧 EMAIL (SMTP not configured - would send):');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`To: ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    console.log(`\n${options.text}`);
    if (options.html) {
      console.log(`\nHTML:\n${options.html}`);
    }
    console.log('═══════════════════════════════════════════════════════════\n');
    return false;
  }

  try {
    const mailOptions = {
      from: `"${smtpConfig!.fromName}" <${smtpConfig!.from}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html || options.text,
      attachments: options.attachments,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email] Password reset email sent to ${options.to} (Message ID: ${info.messageId})`);
    return true;
  } catch (error: any) {
    console.error('[Email] Failed to send email:', error?.message || error);
    if (error?.response) console.error('[Email] SMTP response:', error.response);
    if (error?.code) console.error('[Email] Error code:', error.code);
    if (error?.code === 'EAUTH' && smtpConfig?.host?.includes('gmail')) {
      console.error('[Email] ─── Gmail login rejected. Fix: use an App Password, not your normal Gmail password.');
      console.error('[Email] 1) Go to https://myaccount.google.com/apppasswords');
      console.error('[Email] 2) Create an App Password for "Mail"');
      console.error('[Email] 3) Save it under Settings → SMTP (or set SMTP_PASS in .env for server-wide fallback).');
    }
    // Log the email content as fallback
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📧 EMAIL (Failed to send - content below):');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`To: ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    console.log(`\n${options.text}`);
    console.log('═══════════════════════════════════════════════════════════\n');
    return false;
  }
}

/**
 * Send password reset email (forgot-password flow only).
 * Uses `smtp_settings` joined to `is_saas_owner = true` when that user saved SMTP; otherwise newest `smtp_settings` row, then `.env`.
 * Does not use the requesting user's SMTP row.
 */
export async function sendPasswordResetEmail(email: string, resetLink: string): Promise<boolean> {
  const smtpUserId = await storage.getForgotPasswordSmtpUserId();
  const subject = 'Reset Your Password - WhatsApp SaaS Platform';
  const text = `Hello,

You requested to reset your password for your WhatsApp SaaS Platform account.

Click the link below to reset your password:
${resetLink}

This link will expire in 1 hour.

If you did not request a password reset, please ignore this email.

Best regards,
WhatsApp SaaS Platform Team`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px;">
    <h2 style="color: #25D366;">Reset Your Password</h2>
    <p>Hello,</p>
    <p>You requested to reset your password for your WhatsApp SaaS Platform account.</p>
    <p style="margin: 30px 0;">
      <a href="${resetLink}" 
         style="background-color: #25D366; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
        Reset Password
      </a>
    </p>
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #666; font-size: 12px;">${resetLink}</p>
    <p style="color: #999; font-size: 12px; margin-top: 30px;">
      This link will expire in 1 hour.<br>
      If you did not request a password reset, please ignore this email.
    </p>
    <p style="margin-top: 30px;">
      Best regards,<br>
      <strong>WhatsApp SaaS Platform Team</strong>
    </p>
  </div>
</body>
</html>`;

  return await sendEmail({
    to: email,
    subject,
    text,
    html,
    userId: smtpUserId,
  });
}

/**
 * First-time login email verification code (OTP).
 * Uses the same SMTP resolution as forgot-password.
 */
export async function sendLoginVerificationCodeEmail(
  email: string,
  code: string,
): Promise<boolean> {
  const smtpUserId = await storage.getForgotPasswordSmtpUserId();
  const subject = "Your login verification code";
  const text = `Hello,

Your verification code is: ${code}

Enter this code on the login page to verify your email and finish signing in.

This code expires in 15 minutes.

If you did not try to log in, you can ignore this email.

Best regards,
WhatsApp SaaS Platform Team`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login Verification Code</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px;">
    <h2 style="color: #25D366;">Verify your email</h2>
    <p>Hello,</p>
    <p>Use this code to verify your email and finish signing in:</p>
    <p style="margin: 28px 0; text-align: center;">
      <span style="display: inline-block; letter-spacing: 6px; font-size: 28px; font-weight: bold; background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 12px 20px;">
        ${code}
      </span>
    </p>
    <p style="color: #999; font-size: 12px; margin-top: 30px;">
      This code expires in 15 minutes.<br>
      If you did not try to log in, you can ignore this email.
    </p>
  </div>
</body>
</html>`;

  return await sendEmail({
    to: email,
    subject,
    text,
    html,
    userId: smtpUserId,
  });
}

/**
 * Send invitation email to new team member with login credentials and change-password link
 */
export async function sendInvitationEmail(
  email: string,
  inviterName: string,
  organizationName: string,
  setPasswordLink: string,
  recipientName?: string,
  temporaryPassword?: string,
  loginUrl?: string,
  senderUserId?: string,
  organizationId?: string
): Promise<boolean> {
  const smtpFallbackUserIds: string[] = [];
  if (organizationId) {
    const org = await storage.getOrganization(organizationId);
    if (org?.ownerId) smtpFallbackUserIds.push(org.ownerId);
  }
  const greeting = recipientName ? `Hello ${recipientName}` : 'Hello';
  const subject = `You're invited to join ${organizationName}`;

  const credentialsBlock =
    temporaryPassword != null
      ? `
Your login credentials:
  Email: ${email}
  Temporary password: ${temporaryPassword}

You can log in now with these credentials, or change your password using the link below.${loginUrl ? `\n\nLog in: ${loginUrl}` : ""}`
      : `
Click the link below to set your password and get started:`;

  const text = `${greeting},

${inviterName} has invited you to join the WhatsApp SaaS Platform.
${credentialsBlock}
${temporaryPassword != null ? "\nChange your password (recommended):" : ""}
${setPasswordLink}

This link will expire in 24 hours.

If you did not expect this invitation, you can safely ignore this email.

Best regards,
WhatsApp SaaS Platform Team`;

  const buttonsHtml =
    temporaryPassword != null && loginUrl
      ? `
    <p style="margin: 20px 0;">
      <a href="${loginUrl}"
         style="background-color: #25D366; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin-right: 12px;">
        Log in
      </a>
      <a href="${setPasswordLink}"
         style="background-color: #25D366; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
        Change Your Password
      </a>
    </p>`
      : `
    <p style="margin: 30px 0;">
      <a href="${setPasswordLink}"
         style="background-color: #25D366; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
        ${temporaryPassword != null ? "Change Your Password" : "Set Your Password"}
      </a>
    </p>`;

  const credentialsHtml =
    temporaryPassword != null
      ? `
    <p style="margin: 16px 0; padding: 12px; background: #fff; border-radius: 6px; border: 1px solid #e0e0e0;">
      <strong>Your login credentials</strong><br>
      Email: <code style="background: #eee; padding: 2px 6px;">${email}</code><br>
      Temporary password: <code style="background: #eee; padding: 2px 6px;">${temporaryPassword}</code>
    </p>
    <p>You can log in now with these credentials, or change your password using the button below.</p>`
      : "";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Team Invitation</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px;">
    <h2 style="color: #25D366;">You're invited to join ${organizationName}</h2>
    <p>${greeting},</p>
    <p><strong>${inviterName}</strong> has invited you to join the WhatsApp SaaS Platform.</p>
    ${credentialsHtml}
    ${buttonsHtml}
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #666; font-size: 12px;">${setPasswordLink}</p>
    <p style="color: #999; font-size: 12px; margin-top: 30px;">
      This link will expire in 24 hours.<br>
      If you did not expect this invitation, you can safely ignore this email.
    </p>
    <p style="margin-top: 30px;">
      Best regards,<br>
      <strong>WhatsApp SaaS Platform Team</strong>
    </p>
  </div>
</body>
</html>`;

  const mail = { to: email, subject, text, html };
  // Team invites must use org Integrations → SMTP / owner Settings, not only the inviter's personal row.
  if (organizationId) {
    const sentOrg = await sendOrgOutboundEmail(organizationId, mail);
    if (sentOrg) return true;
  }
  const sent = await sendEmail({
    ...mail,
    userId: senderUserId,
    smtpFallbackUserIds,
  });
  return !!sent;
}

/**
 * Send "added to organization" email when an existing user is invited to a team
 */
export async function sendAddedToOrganizationEmail(
  email: string,
  inviterName: string,
  organizationName: string,
  loginUrl: string,
  recipientName?: string,
  senderUserId?: string,
  organizationId?: string
): Promise<boolean> {
  const greeting = recipientName ? `Hello ${recipientName}` : 'Hello';
  const subject = `You've been added to ${organizationName}`;
  const text = `${greeting},

${inviterName} has added you to ${organizationName} on the WhatsApp SaaS Platform.

You can log in with your existing account here:
${loginUrl}

If you have any questions, reach out to your team admin.

Best regards,
WhatsApp SaaS Platform Team`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Added to team</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px;">
    <h2 style="color: #25D366;">You've been added to ${organizationName}</h2>
    <p>${greeting},</p>
    <p><strong>${inviterName}</strong> has added you to <strong>${organizationName}</strong> on the WhatsApp SaaS Platform.</p>
    <p style="margin: 30px 0;">
      <a href="${loginUrl}"
         style="background-color: #25D366; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
        Log in
      </a>
    </p>
    <p style="color: #999; font-size: 12px;">
      If you have any questions, reach out to your team admin.
    </p>
    <p style="margin-top: 30px;">
      Best regards,<br>
      <strong>WhatsApp SaaS Platform Team</strong>
    </p>
  </div>
</body>
</html>`;

  const mail = { to: email, subject, text, html };
  if (organizationId) {
    const sentOrg = await sendOrgOutboundEmail(organizationId, mail);
    if (sentOrg) return true;
  }
  const smtpFallbackUserIds: string[] = [];
  if (organizationId) {
    const org = await storage.getOrganization(organizationId);
    if (org?.ownerId) smtpFallbackUserIds.push(org.ownerId);
  }
  return await sendEmail({
    ...mail,
    userId: senderUserId,
    smtpFallbackUserIds,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Onboarding-complete email for new org owners (not trial signups). Uses whitelabel SMTP.
 * Idempotent per `userId`. Does not throw — logs on failure.
 */
export async function sendWelcomeEmailAfterSignup(params: {
  userId: string;
  email: string;
  firstName?: string | null;
  organizationName: string;
  isTrialAccount?: boolean;
}): Promise<boolean> {
  if (params.isTrialAccount) {
    console.log(`[Email][Onboarding] Skipped onboarding email for trial account ${params.userId}`);
    return false;
  }

  const emailAddr = String(params.email || "").trim();
  if (!emailAddr) return false;
  const dedupeKey = `onboarding_complete:${params.userId}`;
  try {
    if (await storage.panelTransactionalEmailLogExists(dedupeKey)) return false;
  } catch (e: any) {
    console.warn("[Email][Welcome] dedupe check failed:", e?.message);
  }
  const baseUrl = (process.env.BASE_URL || "http://localhost:5001").split(/\s*[\n#]/)[0].trim().replace(/\/+$/, "");
  const billingUrl = `${baseUrl}/billing`;
  const loginUrl = `${baseUrl}/login`;
  const name =
    (params.firstName && String(params.firstName).trim()) || emailAddr.split("@")[0] || "there";
  const org = String(params.organizationName || "your workspace").trim() || "your workspace";
  const subject = `Welcome to ${org}`;
  const text = `Hello ${name},

Your account is ready on ${org}.

Log in: ${loginUrl}
Manage billing and subscription: ${billingUrl}

If you did not create this account, contact your administrator.

Best regards,
${org}`;
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.6;max-width:560px;margin:0 auto;padding:20px;">
  <h2 style="color:#16a34a;">Welcome</h2>
  <p>Hello ${escapeHtml(name)},</p>
  <p>Your account is ready on <strong>${escapeHtml(org)}</strong>.</p>
  <p><a href="${escapeHtml(loginUrl)}">Log in</a> · <a href="${escapeHtml(billingUrl)}">Billing & subscription</a></p>
  <p style="color:#666;font-size:14px;">If you did not create this account, contact your administrator.</p>
</body>
</html>`;
  const ok = await sendWhitelabelPanelEmail({ to: emailAddr, subject, text, html });
  if (ok) {
    try {
      await storage.insertPanelTransactionalEmailLog({
        userId: params.userId,
        dedupeKey,
        notificationKind: "onboarding_complete",
      });
    } catch (e: any) {
      console.warn("[Email][Welcome] log insert failed:", e?.message);
    }
  }
  return ok;
}
