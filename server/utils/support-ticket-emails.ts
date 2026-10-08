import { sendEmail } from "./email";
import { storage } from "../storage";
import type { SupportTicket, Organization, User } from "@shared/schema";

function escapeHtml(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatStatus(status: string | null | undefined): string {
  return String(status || "").replace(/_/g, " ");
}

function ticketLabel(ticket: { ticketNumber: number }): string {
  return `#${ticket.ticketNumber}`;
}

/** `smtp_settings` for the user with `isSaaSOwner` (see Settings → SMTP on that account). Used for all support emails; `sendEmail` falls back to `SMTP_*` env if unset. */
export async function getSupportSmtpUserId(): Promise<string | undefined> {
  const saas = await storage.getSaasOwnerUser();
  return saas?.id;
}

export async function getSaasOwnerNotifyEmail(): Promise<string | undefined> {
  const saas = await storage.getSaasOwnerUser();
  const e = saas?.email?.trim();
  return e || undefined;
}

function wrapHtml(bodyHtml: string, title: string) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.5; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f5f5f5; border-radius: 8px; padding: 20px;">
    ${bodyHtml}
    <p style="color: #999; font-size: 12px; margin-top: 24px;">This message was sent from the support center.</p>
  </div>
</body>
</html>`;
}

export async function sendSupportEmailToCustomer(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  userId: string;
  smtpFallbackUserIds?: string[];
}): Promise<boolean> {
  return sendEmail({
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    userId: opts.userId,
    smtpFallbackUserIds: opts.smtpFallbackUserIds,
  });
}

export async function notifyCustomerTicketCreated(params: {
  org: Organization;
  ticket: SupportTicket;
  customerViewUrl: string;
  smtpUserId: string;
}): Promise<void> {
  const label = ticketLabel(params.ticket);
  const subj = `${label} — We received your request`;
  const text = `Hello${params.ticket.customerName ? " " + params.ticket.customerName : ""},

Thank you for contacting us. ${label} has been received. We will update you here as we make progress.

Subject: ${params.ticket.subject}

View your request: ${params.customerViewUrl}

If you have any other details to add, reply in the same thread on the support page.`;

  const bodyHtml = `<h2 style="color: #0d9488; margin-top:0;">We received your request</h2>
  <p>Hello${params.ticket.customerName ? ` ${escapeHtml(params.ticket.customerName)}` : ""},</p>
  <p>Thank you for contacting <strong>${escapeHtml(params.org.name)}</strong>. Your support reference is <strong>${label}</strong>. We will keep you updated.</p>
  <p><strong>Subject</strong> ${escapeHtml(params.ticket.subject)}</p>
  <p style="margin: 24px 0;"><a href="${escapeHtml(params.customerViewUrl)}" style="background: #0d9488; color: #fff; text-decoration: none; padding: 10px 18px; border-radius: 5px; display: inline-block;">View ticket</a></p>
  <p style="word-break: break-all; font-size: 12px; color: #666;">${escapeHtml(params.customerViewUrl)}</p>`;
  const html = wrapHtml(bodyHtml, "Ticket received");

  await sendSupportEmailToCustomer({
    to: params.ticket.customerEmail,
    subject: subj,
    text,
    html,
    userId: params.smtpUserId,
    smtpFallbackUserIds: [params.smtpUserId],
  });
}

export async function notifyAdminNewTicket(params: {
  to: string;
  org: Organization;
  ticket: SupportTicket;
  staffViewPath: string;
  smtpUserId: string;
}): Promise<void> {
  const base = process.env.PUBLIC_APP_URL || process.env.APP_URL || "";
  const viewUrl = base
    ? `${base.replace(/\/$/, "")}${params.staffViewPath}`
    : `Open the app: Support → ${ticketLabel(params.ticket)}`;
  const label = ticketLabel(params.ticket);
  const subj = `${label} new support request — ${params.ticket.subject?.slice(0, 40) || "No subject"}`;
  const text = `A new support ticket was opened for ${params.org.name}.

${label}
Subject: ${params.ticket.subject}
From: ${params.ticket.customerName} <${params.ticket.customerEmail}>

Open in app: ${viewUrl}`;

  const bodyHtml = `<h2 style="margin-top:0;">New support request</h2>
  <p>Organization: <strong>${escapeHtml(params.org.name)}</strong><br>
  <strong>${label}</strong> — ${escapeHtml(params.ticket.subject)}<br>
  From: ${escapeHtml(params.ticket.customerName)} &lt;${escapeHtml(params.ticket.customerEmail)}&gt;</p>
  <p><a href="${escapeHtml(String(viewUrl))}">View in dashboard</a></p>`;
  const html = wrapHtml(bodyHtml, "New support ticket");
  await sendEmail({
    to: params.to,
    subject: subj,
    text,
    html,
    userId: params.smtpUserId,
    smtpFallbackUserIds: [params.smtpUserId],
  });
}

export async function notifyCustomerStatusChanged(params: {
  org: Organization;
  ticket: SupportTicket;
  previousStatus: string;
  smtpUserId: string;
  customerViewUrl: string;
}): Promise<void> {
  const label = ticketLabel(params.ticket);
  const subj = `${label} — Status: ${formatStatus(params.ticket.status)}`;
  const text = `Hello,

Your support request ${label} is now: ${formatStatus(params.ticket.status)}.

View details: ${params.customerViewUrl}`;
  const bodyHtml = `<p>Your support request <strong>${label}</strong> from <strong>${escapeHtml(
    params.org.name
  )}</strong> is now: <strong>${escapeHtml(formatStatus(params.ticket.status))}</strong>.</p>
  <p><a href="${escapeHtml(params.customerViewUrl)}">View ticket</a></p>`;
  const html = wrapHtml(bodyHtml, "Status update");
  await sendSupportEmailToCustomer({
    to: params.ticket.customerEmail,
    subject: subj,
    text,
    html,
    userId: params.smtpUserId,
    smtpFallbackUserIds: [params.smtpUserId],
  });
}

export async function notifyCustomerTicketAssigned(params: {
  org: Organization;
  ticket: SupportTicket;
  assignee: User;
  smtpUserId: string;
  customerViewUrl: string;
}): Promise<void> {
  const label = ticketLabel(params.ticket);
  const who = [params.assignee.firstName, params.assignee.lastName].filter(Boolean).join(" ") || "a team member";
  const subj = `${label} — Assigned to ${who}`;
  const text = `Hello,

${label} has been assigned to ${who}. We will get back to you as soon as possible.

${params.customerViewUrl}`;
  const bodyHtml = `<p><strong>${label}</strong> is now assigned to <strong>${escapeHtml(
    who
  )}</strong>.</p>
  <p><a href="${escapeHtml(params.customerViewUrl)}">View ticket</a></p>`;
  const html = wrapHtml(bodyHtml, "Assignment");
  await sendSupportEmailToCustomer({
    to: params.ticket.customerEmail,
    subject: subj,
    text,
    html,
    userId: params.smtpUserId,
    smtpFallbackUserIds: [params.smtpUserId],
  });
}

export async function notifyNewMessage(
  to: string,
  options: {
    isToCustomer: boolean;
    org: Organization;
    ticket: SupportTicket;
    fromLabel: string;
    body: string;
    smtpUserId: string;
    ctaUrl: string;
    ctaText: string;
  }
): Promise<void> {
  const label = ticketLabel(options.ticket);
  const subj = options.isToCustomer
    ? `${label} — New message from support`
    : `${label} — New reply from customer`;
  const text = `Hello,

${options.ticket.subject ? `Re: ${options.ticket.subject}\n\n` : ""}From: ${options.fromLabel}

${options.body}

—
${options.ctaText + ": " + options.ctaUrl}
`;

  const bodyHtml = `<h3 style="margin:0 0 12px;">${escapeHtml(label)}</h3>
  <p style="color: #666; margin:0 0 8px;">From: ${escapeHtml(options.fromLabel)}</p>
  <div style="background:#fff; border:1px solid #e0e0e0; border-radius:6px; padding: 12px; margin: 12px 0;">${escapeHtml(
    options.body
  ).replace(/\n/g, "<br>")}</div>
  <p><a href="${escapeHtml(options.ctaUrl)}" style="color: #0d9488;">${escapeHtml(options.ctaText)}</a></p>`;
  const html = wrapHtml(bodyHtml, "New support message");
  await sendEmail({
    to,
    subject: subj,
    text,
    html,
    userId: options.smtpUserId,
    smtpFallbackUserIds: [options.smtpUserId],
  });
}

export async function resolveUserName(user: User | undefined | null): Promise<string> {
  if (!user) return "User";
  const n = [user.firstName, user.lastName].filter(Boolean).join(" ");
  if (n) return n;
  if (user.email) return user.email;
  return "User";
}
