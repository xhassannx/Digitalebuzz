/**
 * Push / sync support tickets with the whitelabel technical-team portal (whatsapp-admin).
 */
import type { SupportMessage, SupportTicket } from "@shared/schema";
import { storage } from "../storage";

function licensorBaseUrl(): string {
  return (process.env.CUSTOMER_API_BASE_URL || "").trim().replace(/\/+$/, "");
}

function productionKey(): string {
  return (process.env.PRODUCTION_KEY || "").trim();
}

function panelBaseUrl(req?: { protocol?: string; get?: (h: string) => string | undefined }): string {
  const fromEnv = (process.env.BASE_URL || process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || "")
    .split(/\s*[\n#]/)[0]
    .trim()
    .replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  if (req?.get) {
    const host = req.get("x-forwarded-host") || req.get("host");
    const proto = req.get("x-forwarded-proto") || req.protocol || "http";
    if (host) return `${proto}://${host}`.replace(/\/+$/, "");
  }
  return "http://localhost:5002";
}

async function buildTransferPayload(ticket: SupportTicket, req?: any) {
  const org = await storage.getOrganization(ticket.organizationId);
  const customerUser = ticket.customerUserId ? await storage.getUser(ticket.customerUserId) : null;
  const customerPhone =
    (ticket.customerPhone && String(ticket.customerPhone).trim()) ||
    (customerUser?.phone && String(customerUser.phone).trim()) ||
    null;
  const messages = await storage.getSupportMessagesByTicketId(ticket.id);
  const msgOut = await Promise.all(
    messages.map(async (m: SupportMessage) => {
      const authorUser = m.authorUserId ? await storage.getUser(m.authorUserId) : null;
      let authorName = ticket.customerName || "Customer";
      if (m.authorType === "agent") {
        authorName = authorUser
          ? [authorUser.firstName, authorUser.lastName].filter(Boolean).join(" ") || authorUser.email || "Support"
          : "Support";
      } else if ((m.authorType as string) === "technical_team") {
        authorName = "Technical Team";
      }
      return {
        id: m.id,
        body: m.body,
        authorType: m.authorType,
        authorName,
        createdAt: m.createdAt,
      };
    })
  );

  return {
    panelTicketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject,
    description: ticket.description,
    status: ticket.status,
    customerName: ticket.customerName,
    customerEmail: ticket.customerEmail,
    customerPhone,
    organizationId: ticket.organizationId,
    organizationName: org?.name || "Unknown",
    panelBaseUrl: panelBaseUrl(req),
    messages: msgOut,
  };
}

export async function transferTicketToTechnicalTeam(
  ticket: SupportTicket,
  req?: any
): Promise<{ technicalTicketId: string }> {
  const base = licensorBaseUrl();
  const key = productionKey();
  if (!base) {
    throw new Error("CUSTOMER_API_BASE_URL is not configured — cannot transfer to Technical Team");
  }
  if (!key) {
    throw new Error("PRODUCTION_KEY is not configured — cannot transfer to Technical Team");
  }

  const payload = await buildTransferPayload(ticket, req);
  const res = await fetch(`${base}/api/support-tickets/receive`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Production-Key": key,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text?.slice(0, 300) };
  }
  if (!res.ok) {
    throw new Error(data.error || data.message || `Technical Team portal returned ${res.status}`);
  }
  const technicalTicketId = String(data.id || data.technicalTicketId || "");
  if (!technicalTicketId) {
    throw new Error("Technical Team portal did not return a ticket id");
  }
  return { technicalTicketId };
}

/** Sync a new panel-side message to the technical portal (best-effort). */
export async function syncMessageToTechnicalTeam(opts: {
  ticket: SupportTicket;
  messageId: string;
  body: string;
  authorType: string;
  authorName: string;
}): Promise<void> {
  if (!opts.ticket.transferredToTechnical) return;
  const base = licensorBaseUrl();
  const key = productionKey();
  if (!base || !key) return;

  try {
    await fetch(`${base}/api/support-tickets/sync-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Production-Key": key,
      },
      body: JSON.stringify({
        panelTicketId: opts.ticket.id,
        panelMessageId: opts.messageId,
        body: opts.body,
        authorType: opts.authorType,
        authorName: opts.authorName,
      }),
    });
  } catch (e) {
    console.warn("[technical-support-sync] sync-message failed:", (e as Error)?.message);
  }
}
