// @ts-nocheck
import type { Express, Request, Response } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import crypto from "crypto";
import { storage } from "./storage";
import { isAuthenticatedOrApiKey } from "./replitAuth";
import { rateLimitMiddleware } from "./middleware/rate-limiter";
import { getUserId } from "./routes/shared";
import { resolveOrganizationContext, requirePermission } from "./middleware/organization-context";
import {
  getSupportSmtpUserId,
  getSaasOwnerNotifyEmail,
  notifyAdminNewTicket,
  notifyCustomerStatusChanged,
  notifyCustomerTicketAssigned,
  notifyCustomerTicketCreated,
  notifyNewMessage,
  resolveUserName,
} from "./utils/support-ticket-emails";
import {
  transferTicketToTechnicalTeam,
  syncMessageToTechnicalTeam,
} from "./utils/technical-support-sync";
import type { SupportAttachment, SupportTicket, User } from "@shared/schema";

const withAuthAndRateLimit = [isAuthenticatedOrApiKey, rateLimitMiddleware];
const withOrgContext = [isAuthenticatedOrApiKey, rateLimitMiddleware, resolveOrganizationContext];

const SUPPORT_MAX_FILE_BYTES = 15 * 1024 * 1024;
const supportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: SUPPORT_MAX_FILE_BYTES },
});

function publicBaseUrl(req: Request): string {
  const fromEnv = (process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || "").trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return `${req.protocol}://${req.get("host") || "localhost"}`;
}

function customerTicketUrl(req: Request, accessToken: string): string {
  return `${publicBaseUrl(req)}/support/ticket?accessToken=${encodeURIComponent(accessToken)}`;
}

function parseCustomerPhone(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const value = String(raw ?? "").trim();
  if (!value) return { ok: false, error: "phone number is required" };
  const digits = value.replace(/\D/g, "");
  if (digits.length < 10) return { ok: false, error: "valid phone number is required (min 10 digits)" };
  if (value.length > 32) return { ok: false, error: "phone number is too long" };
  return { ok: true, value };
}

function readCustomerPhoneFromBody(body: any): unknown {
  return body?.customerPhone ?? body?.customer_phone ?? body?.phone;
}

function staffTicketPath(ticketId: string): string {
  return `/admin/support/${ticketId}`;
}

function writeSupportFile(organizationId: string, file: Express.Multer.File): { fileName: string; filePath: string; fullPath: string } {
  const dir = path.join(process.cwd(), "uploads", organizationId, "support");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const ext = path.extname(file.originalname) || ".bin";
  const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9._-]/g, "_") || "attachment";
  const name = `${base}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  const fullPath = path.join(dir, name);
  fs.writeFileSync(fullPath, file.buffer);
  const filePath = `/uploads/${organizationId}/support/${name}`;
  return { fileName: file.originalname, filePath, fullPath };
}

async function assertCustomerTicketAccess(
  ticket: SupportTicket | undefined,
  userId: string,
  userEmail: string | null | undefined
): Promise<boolean> {
  if (!ticket) return false;
  if (ticket.customerUserId && ticket.customerUserId === userId) return true;
  if (userEmail && ticket.customerEmail.toLowerCase() === userEmail.toLowerCase()) return true;
  return false;
}

async function assertSaasOwner(req: any, res: Response): Promise<string | null> {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  const user = await storage.getUser(userId);
  if (!user?.isSaaSOwner) {
    res.status(403).json({ error: "SaaS owner access required" });
    return null;
  }
  return userId;
}

export function registerSupportTicketRoutes(app: Express) {
  // --- SaaS owner admin panel ---  
  app.get("/api/admin/support/tickets", ...withAuthAndRateLimit, async (req: any, res: Response) => {
    try {
      const ownerId = await assertSaasOwner(req, res);
      if (!ownerId) return;
      const rows = await storage.listAllSupportTickets();
      const out = await Promise.all(
        rows.map(async (t) => {
          const assignee = t.assignedToUserId ? await storage.getUser(t.assignedToUserId) : undefined;
          const org = await storage.getOrganization(t.organizationId);
          return {
            id: t.id,
            ticketNumber: t.ticketNumber,
            subject: t.subject,
            status: t.status,
            customerName: t.customerName,
            customerEmail: t.customerEmail,
            customerPhone:
              t.customerPhone ||
              (t.customerUserId ? (await storage.getUser(t.customerUserId))?.phone : null) ||
              null,
            assignedToUserId: t.assignedToUserId,
            assigneeName: await resolveUserName(assignee),
            organizationId: t.organizationId,
            organizationName: org?.name || "Unknown organization",
            transferredToTechnical: !!t.transferredToTechnical,
            transferredToTechnicalAt: t.transferredToTechnicalAt,
            updatedAt: t.updatedAt,
            createdAt: t.createdAt,
          };
        })
      );
      return res.json(out);
    } catch (e: any) {
      console.error("[admin support list]", e);
      return res.status(500).json({ error: e?.message || "Failed" });
    }
  });

  app.get("/api/admin/support/tickets/:id", ...withAuthAndRateLimit, async (req: any, res: Response) => {
    try {
      const ownerId = await assertSaasOwner(req, res);
      if (!ownerId) return;
      const ticket = await storage.getSupportTicketById(req.params.id);
      if (!ticket) return res.status(404).json({ error: "Not found" });
      return res.json(await buildTicketResponse(ticket, req, "staff"));
    } catch (e: any) {
      console.error("[admin support detail]", e);
      return res.status(500).json({ error: e?.message || "Failed" });
    }
  });

  app.get("/api/admin/support/assignable-members", ...withAuthAndRateLimit, async (req: any, res: Response) => {
    try {
      const ownerId = await assertSaasOwner(req, res);
      if (!ownerId) return;
      const organizationId = (req.query.organizationId as string | undefined)?.trim();
      if (!organizationId) return res.status(400).json({ error: "organizationId required" });
      const members = await storage.getOrganizationMembers(organizationId);
      const out = await Promise.all(
        members.map(async (m) => {
          const u = await storage.getUser(m.userId);
          return {
            userId: m.userId,
            displayName: u && (u.firstName || u.lastName) ? [u.firstName, u.lastName].filter(Boolean).join(" ") : u?.email || m.userId,
          };
        })
      );
      return res.json(out);
    } catch (e: any) {
      console.error("[admin support assignable]", e);
      return res.status(500).json({ error: e?.message || "Failed" });
    }
  });

  app.patch("/api/admin/support/tickets/:id", ...withAuthAndRateLimit, async (req: any, res: Response) => {
    try {
      const ownerId = await assertSaasOwner(req, res);
      if (!ownerId) return;
      const existing = await storage.getSupportTicketById(req.params.id);
      if (!existing) return res.status(404).json({ error: "Not found" });
      const { status, assignedToUserId } = req.body || {};
      const prev = existing.status;
      const prevAssign = existing.assignedToUserId;
      const data: { status?: SupportTicket["status"]; assignedToUserId?: string | null } = {};
      if (status && typeof status === "string") {
        const allowed = ["open", "pending", "in_progress", "waiting_on_customer", "resolved", "closed"] as const;
        if (allowed.includes(status as any)) data.status = status as SupportTicket["status"];
      }
      if (assignedToUserId === null) data.assignedToUserId = null;
      else if (typeof assignedToUserId === "string") {
        const mem = await storage.getOrganizationMember(existing.organizationId, assignedToUserId);
        if (!mem) return res.status(400).json({ error: "Assignee is not member of this organization" });
        data.assignedToUserId = assignedToUserId;
      }
      if (data.status == null && data.assignedToUserId === undefined) return res.status(400).json({ error: "No changes" });
      const org = await storage.getOrganization(existing.organizationId);
      if (!org) return res.status(500).json({ error: "Organization not found" });
      const smtpUserId = await getSupportSmtpUserId();
      const updated = await storage.updateSupportTicketByOrganization(existing.id, existing.organizationId, { ...data, updatedAt: new Date() });
      if (!updated) return res.status(500).json({ error: "Update failed" });
      const viewUrl = customerTicketUrl(req, existing.accessToken);
      if (data.status && data.status !== prev) {
        await notifyCustomerStatusChanged({ org, ticket: updated, previousStatus: prev, smtpUserId, customerViewUrl: viewUrl });
      }
      if (data.assignedToUserId !== undefined && data.assignedToUserId !== prevAssign && data.assignedToUserId) {
        const assignee = await storage.getUser(data.assignedToUserId);
        if (assignee) await notifyCustomerTicketAssigned({ org, ticket: updated, assignee, smtpUserId, customerViewUrl: viewUrl });
      }
      return res.json({ id: updated.id, status: updated.status, assignedToUserId: updated.assignedToUserId });
    } catch (e: any) {
      console.error("[admin support patch]", e);
      return res.status(500).json({ error: e?.message || "Failed" });
    }
  });

  app.post("/api/admin/support/tickets/:id/messages", ...withAuthAndRateLimit, supportUpload.single("attachment"), async (req: any, res: Response) => {
    try {
      const ownerId = await assertSaasOwner(req, res);
      if (!ownerId) return;
      const ticket = await storage.getSupportTicketById(req.params.id);
      if (!ticket) return res.status(404).json({ error: "Not found" });
      const body = (req.body?.body as string)?.trim();
      if (!body) return res.status(400).json({ error: "body is required" });
      const org = await storage.getOrganization(ticket.organizationId);
      if (!org) return res.status(500).json({ error: "Organization not found" });
      const smtpUserId = await getSupportSmtpUserId();
      const author = await storage.getUser(ownerId);
      const message = await storage.createSupportMessageRow({
        ticketId: ticket.id,
        body,
        authorType: "agent",
        authorUserId: ownerId,
      });
      await storage.updateSupportTicketByOrganization(ticket.id, ticket.organizationId, { updatedAt: new Date() });
      if (req.file) {
        const w = writeSupportFile(ticket.organizationId, req.file);
        await storage.createSupportAttachmentRow({
          ticketId: ticket.id,
          messageId: message.id,
          fileName: w.fileName,
          filePath: w.filePath,
          mimeType: req.file.mimetype,
          sizeBytes: req.file.size,
          uploadedBy: "agent",
          uploadedByUserId: ownerId,
        });
      }
      const fromLabel = await resolveUserName(author);
      await notifyNewMessage(ticket.customerEmail, {
        isToCustomer: true,
        org,
        ticket,
        fromLabel: `${org.name} — ${fromLabel}`,
        body,
        smtpUserId,
        ctaUrl: customerTicketUrl(req, ticket.accessToken),
        ctaText: "View and reply to this ticket",
      });
      if (ticket.transferredToTechnical) {
        await syncMessageToTechnicalTeam({
          ticket,
          messageId: message.id,
          body,
          authorType: "agent",
          authorName: fromLabel || "Support",
        });
      }
      return res.json({ success: true, messageId: message.id });
    } catch (e: any) {
      console.error("[admin support message]", e);
      return res.status(500).json({ error: e?.message || "Failed" });
    }
  });

  /** SaaS owner creates a ticket (optionally transfer immediately to Technical Team) */
  app.post("/api/admin/support/tickets", ...withAuthAndRateLimit, async (req: any, res: Response) => {
    try {
      const ownerId = await assertSaasOwner(req, res);
      if (!ownerId) return;
      const subject = (req.body?.subject as string)?.trim();
      const description = (req.body?.description as string)?.trim();
      const organizationId = (req.body?.organizationId as string)?.trim();
      const customerName = (req.body?.customerName as string)?.trim() || "SaaS Admin";
      const customerEmail = (req.body?.customerEmail as string)?.trim().toLowerCase();
      const phoneParsed = parseCustomerPhone(readCustomerPhoneFromBody(req.body));
      const transferToTechnical = !!req.body?.transferToTechnical;
      if (!subject) return res.status(400).json({ error: "subject is required" });
      if (!description) return res.status(400).json({ error: "description is required" });
      if (!organizationId) return res.status(400).json({ error: "organizationId is required" });
      if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
        return res.status(400).json({ error: "valid customerEmail is required" });
      }
      if (!phoneParsed.ok) return res.status(400).json({ error: phoneParsed.error });
      const org = await storage.getOrganization(organizationId);
      if (!org) return res.status(404).json({ error: "Organization not found" });
      const owner = await storage.getUser(ownerId);
      const accessToken = crypto.randomUUID();
      const { ticket } = await storage.createSupportTicketWithInitialMessage(
        {
          organizationId,
          accessToken,
          subject,
          description,
          customerEmail,
          customerName: customerName || owner?.email || "SaaS Admin",
          customerPhone: phoneParsed.value,
          customerUserId: ownerId,
        },
        undefined
      );

      let transferredToTechnical = false;
      let technicalTicketId: string | null = null;
      if (transferToTechnical) {
        try {
          const result = await transferTicketToTechnicalTeam(ticket, req);
          technicalTicketId = result.technicalTicketId;
          await storage.updateSupportTicketById(ticket.id, {
            transferredToTechnical: true,
            transferredToTechnicalAt: new Date(),
            technicalTicketId,
            status: "in_progress",
          });
          transferredToTechnical = true;
        } catch (err: any) {
          return res.status(502).json({
            error: err?.message || "Ticket created but transfer to Technical Team failed",
            id: ticket.id,
            ticketNumber: ticket.ticketNumber,
          });
        }
      }

      return res.status(201).json({
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        transferredToTechnical,
        technicalTicketId,
      });
    } catch (e: any) {
      console.error("[admin support create]", e);
      return res.status(500).json({ error: e?.message || "Failed" });
    }
  });

  /** Transfer an existing ticket to the Technical Team portal */
  app.post("/api/admin/support/tickets/:id/transfer-technical", ...withAuthAndRateLimit, async (req: any, res: Response) => {
    try {
      const ownerId = await assertSaasOwner(req, res);
      if (!ownerId) return;
      const ticket = await storage.getSupportTicketById(req.params.id);
      if (!ticket) return res.status(404).json({ error: "Not found" });
      if (ticket.transferredToTechnical && ticket.technicalTicketId) {
        return res.json({
          success: true,
          alreadyTransferred: true,
          technicalTicketId: ticket.technicalTicketId,
        });
      }
      const result = await transferTicketToTechnicalTeam(ticket, req);
      const updated = await storage.updateSupportTicketById(ticket.id, {
        transferredToTechnical: true,
        transferredToTechnicalAt: new Date(),
        technicalTicketId: result.technicalTicketId,
        status: ticket.status === "open" || ticket.status === "pending" ? "in_progress" : ticket.status,
      });
      // System note in conversation
      await storage.createSupportMessageRow({
        ticketId: ticket.id,
        body: "This ticket was transferred to the Technical Team.",
        authorType: "agent",
        authorUserId: ownerId,
      });
      return res.json({
        success: true,
        technicalTicketId: result.technicalTicketId,
        transferredToTechnical: true,
        status: updated?.status,
      });
    } catch (e: any) {
      console.error("[admin support transfer-technical]", e);
      return res.status(500).json({ error: e?.message || "Transfer failed" });
    }
  });

  app.get("/api/admin/support/organizations", ...withAuthAndRateLimit, async (req: any, res: Response) => {
    try {
      const ownerId = await assertSaasOwner(req, res);
      if (!ownerId) return;
      const orgs = await storage.getAllOrganizations();
      return res.json(
        orgs.map((o) => ({ id: o.id, name: o.name })).sort((a, b) => a.name.localeCompare(b.name))
      );
    } catch (e: any) {
      console.error("[admin support orgs]", e);
      return res.status(500).json({ error: e?.message || "Failed" });
    }
  });

  // --- Public: create ticket (whitelabel / website) ---
  app.post(
    "/api/public/support/tickets",
    rateLimitMiddleware,
    supportUpload.single("attachment"),
    async (req: any, res: Response) => {
      try {
        const organizationId = (req.body?.organizationId as string)?.trim();
        const subject = (req.body?.subject as string)?.trim();
        const description = (req.body?.description as string)?.trim();
        const customerName = (req.body?.customerName as string)?.trim() || "Customer";
        const customerEmail = (req.body?.customerEmail as string)?.trim().toLowerCase();
        const phoneParsed = parseCustomerPhone(readCustomerPhoneFromBody(req.body));
        if (!organizationId) {
          return res.status(400).json({ error: "organizationId is required" });
        }
        if (!subject) {
          return res.status(400).json({ error: "subject is required" });
        }
        if (!description) {
          return res.status(400).json({ error: "description is required" });
        }
        if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
          return res.status(400).json({ error: "valid customerEmail is required" });
        }
        if (!phoneParsed.ok) {
          return res.status(400).json({ error: phoneParsed.error });
        }
        const org = await storage.getOrganization(organizationId);
        if (!org) {
          return res.status(404).json({ error: "Organization not found" });
        }
        const accessToken = crypto.randomUUID();
        const smtpUserId = await getSupportSmtpUserId();

        let att: { fileName: string; filePath: string; mimeType: string; sizeBytes: number } | undefined;
        if (req.file) {
          const w = writeSupportFile(organizationId, req.file);
          att = {
            fileName: w.fileName,
            filePath: w.filePath,
            mimeType: req.file.mimetype,
            sizeBytes: req.file.size,
          };
        }

        const { ticket } = await storage.createSupportTicketWithInitialMessage(
          {
            organizationId,
            accessToken,
            subject,
            description,
            customerEmail,
            customerName,
            customerPhone: phoneParsed.value,
            customerUserId: null,
          },
          att
        );

        const viewUrl = customerTicketUrl(req, accessToken);
        const staffPath = staffTicketPath(ticket.id);
        await notifyCustomerTicketCreated({ org, ticket, customerViewUrl: viewUrl, smtpUserId });
        const saasNotify = await getSaasOwnerNotifyEmail();
        if (saasNotify) {
          await notifyAdminNewTicket({
            to: saasNotify,
            org,
            ticket,
            staffViewPath: staffPath,
            smtpUserId,
          });
        } else {
          console.warn("[support] New ticket: no SaaS owner email; skipping admin notification");
        }

        return res.json({
          id: ticket.id,
          ticketNumber: ticket.ticketNumber,
          accessToken: ticket.accessToken,
          viewUrl,
        });
      } catch (e: any) {
        console.error("[public support create]", e);
        return res.status(500).json({ error: e?.message || "Failed to create ticket" });
      }
    }
  );

  // Public: get ticket by access token
  app.get("/api/public/support/tickets", rateLimitMiddleware, async (req: any, res: Response) => {
    try {
      const accessToken = (req.query.accessToken as string)?.trim();
      if (!accessToken) {
        return res.status(400).json({ error: "accessToken is required" });
      }
      const ticket = await storage.getSupportTicketByAccessToken(accessToken);
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }
      return res.json(await buildTicketResponse(ticket, req, "public"));
    } catch (e: any) {
      console.error("[public support get]", e);
      return res.status(500).json({ error: e?.message || "Failed to load ticket" });
    }
  });

  // Public: customer reply
  app.post(
    "/api/public/support/tickets/:id/messages",
    rateLimitMiddleware,
    supportUpload.single("attachment"),
    async (req: any, res: Response) => {
      try {
        const ticketId = req.params.id;
        const accessToken = (req.body?.accessToken as string)?.trim();
        const body = (req.body?.body as string)?.trim();
        if (!accessToken) {
          return res.status(400).json({ error: "accessToken is required" });
        }
        if (!body) {
          return res.status(400).json({ error: "body is required" });
        }
        const ticket = await storage.getSupportTicketByAccessToken(accessToken);
        if (!ticket || ticket.id !== ticketId) {
          return res.status(403).json({ error: "Invalid access" });
        }
        const org = await storage.getOrganization(ticket.organizationId);
        if (!org) {
          return res.status(500).json({ error: "Organization not found" });
        }
        const smtpUserId = await getSupportSmtpUserId();

        const message = await storage.createSupportMessageRow({
          ticketId: ticket.id,
          body,
          authorType: "customer",
          authorUserId: ticket.customerUserId || null,
        });
        await storage.updateSupportTicketByOrganization(ticket.id, ticket.organizationId, { updatedAt: new Date() });

        if (req.file) {
          const w = writeSupportFile(ticket.organizationId, req.file);
          await storage.createSupportAttachmentRow({
            ticketId: ticket.id,
            messageId: message.id,
            fileName: w.fileName,
            filePath: w.filePath,
            mimeType: req.file.mimetype,
            sizeBytes: req.file.size,
            uploadedBy: "customer",
            uploadedByUserId: ticket.customerUserId || null,
          });
        }

        const fromLabel = ticket.customerName;
        const base = publicBaseUrl(req);
        const saasTo = await getSaasOwnerNotifyEmail();
        if (saasTo) {
          await notifyNewMessage(saasTo, {
            isToCustomer: false,
            org,
            ticket,
            fromLabel,
            body,
            smtpUserId,
            ctaUrl: `${base}${staffTicketPath(ticket.id)}`,
            ctaText: "Open ticket in dashboard",
          });
        }

        if (ticket.transferredToTechnical) {
          await syncMessageToTechnicalTeam({
            ticket,
            messageId: message.id,
            body,
            authorType: "customer",
            authorName: fromLabel || "Customer",
          });
        }

        return res.json({ success: true, messageId: message.id });
      } catch (e: any) {
        console.error("[public support message]", e);
        return res.status(500).json({ error: e?.message || "Failed to send message" });
      }
    }
  );

  // --- Authenticated customer: my tickets (no org membership required) ---
  app.get("/api/me/support/tickets", ...withAuthAndRateLimit, async (req: any, res: Response) => {
    try {
      const userId = getUserId(req);
      const u = await storage.getUser(userId);
      if (!u?.email) {
        return res.json([]);
      }
      const list = await storage.listSupportTicketsForCustomer(userId, u.email);
      return res.json(
        list.map((t) => ({
          id: t.id,
          ticketNumber: t.ticketNumber,
          subject: t.subject,
          status: t.status,
          customerViewUrl: customerTicketUrl(req, t.accessToken),
          updatedAt: t.updatedAt,
          organizationId: t.organizationId,
        }))
      );
    } catch (e: any) {
      console.error("[me support list]", e);
      return res.status(500).json({ error: e?.message || "Failed to list tickets" });
    }
  });

  app.get("/api/me/support/tickets/:id", ...withAuthAndRateLimit, async (req: any, res: Response) => {
    try {
      const userId = getUserId(req);
      const u = await storage.getUser(userId);
      const ticket = await storage.getSupportTicketById(req.params.id);
      if (!ticket) {
        return res.status(404).json({ error: "Not found" });
      }
      const ok = await assertCustomerTicketAccess(ticket, userId, u?.email);
      if (!ok) {
        return res.status(403).json({ error: "Access denied" });
      }
      return res.json(await buildTicketResponse(ticket, req, "customer", userId));
    } catch (e: any) {
      console.error("[me support get]", e);
      return res.status(500).json({ error: e?.message || "Failed to load ticket" });
    }
  });

  app.post(
    "/api/me/support/tickets",
    ...withAuthAndRateLimit,
    supportUpload.single("attachment"),
    async (req: any, res: Response) => {
      try {
        const userId = getUserId(req);
        const u = await storage.getUser(userId);
        if (!u?.email) {
          return res.status(400).json({ error: "User email is required to open a support ticket" });
        }
        const organizationId = (req.body?.organizationId as string)?.trim();
        const subject = (req.body?.subject as string)?.trim();
        const description = (req.body?.description as string)?.trim();
        const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email;
        const phoneFromBody = readCustomerPhoneFromBody(req.body);
        const phoneParsed = parseCustomerPhone(phoneFromBody || u.phone || "");
        if (!organizationId) {
          return res.status(400).json({ error: "organizationId is required" });
        }
        if (!subject || !description) {
          return res.status(400).json({ error: "subject and description are required" });
        }
        if (!phoneParsed.ok) {
          return res.status(400).json({ error: phoneParsed.error });
        }
        const org = await storage.getOrganization(organizationId);
        if (!org) {
          return res.status(404).json({ error: "Organization not found" });
        }
        const accessToken = crypto.randomUUID();
        const smtpUserId = await getSupportSmtpUserId();
        const file = req.file as Express.Multer.File | undefined;
        let att: { fileName: string; filePath: string; mimeType: string; sizeBytes: number } | undefined;
        if (file) {
          const w = writeSupportFile(organizationId, file);
          att = { fileName: w.fileName, filePath: w.filePath, mimeType: file.mimetype, sizeBytes: file.size };
        }
        const { ticket } = await storage.createSupportTicketWithInitialMessage(
          {
            organizationId,
            accessToken,
            subject,
            description,
            customerEmail: u.email,
            customerName: name,
            customerPhone: phoneParsed.value,
            customerUserId: userId,
          },
          att
        );
        const viewUrl = customerTicketUrl(req, accessToken);
        await notifyCustomerTicketCreated({ org, ticket, customerViewUrl: viewUrl, smtpUserId });
        const saasNotify = await getSaasOwnerNotifyEmail();
        if (saasNotify) {
          await notifyAdminNewTicket({
            to: saasNotify,
            org,
            ticket,
            staffViewPath: staffTicketPath(ticket.id),
            smtpUserId,
          });
        } else {
          console.warn("[support] New ticket: no SaaS owner email; skipping admin notification");
        }
        return res.json({ id: ticket.id, ticketNumber: ticket.ticketNumber, accessToken, viewUrl });
      } catch (e: any) {
        console.error("[me support create]", e);
        return res.status(500).json({ error: e?.message || "Failed to create ticket" });
      }
    }
  );

  app.post(
    "/api/me/support/tickets/:id/messages",
    ...withAuthAndRateLimit,
    supportUpload.single("attachment"),
    async (req: any, res: Response) => {
      try {
        const userId = getUserId(req);
        const u = await storage.getUser(userId);
        const ticket = await storage.getSupportTicketById(req.params.id);
        if (!ticket) {
          return res.status(404).json({ error: "Not found" });
        }
        const ok = await assertCustomerTicketAccess(ticket, userId, u?.email);
        if (!ok) {
          return res.status(403).json({ error: "Access denied" });
        }
        const body = (req.body?.body as string)?.trim();
        if (!body) {
          return res.status(400).json({ error: "body is required" });
        }
        const org = await storage.getOrganization(ticket.organizationId);
        if (!org) {
          return res.status(500).json({ error: "Organization not found" });
        }
        const smtpUserId = await getSupportSmtpUserId();
        const message = await storage.createSupportMessageRow({
          ticketId: ticket.id,
          body,
          authorType: "customer",
          authorUserId: userId,
        });
        await storage.updateSupportTicketByOrganization(ticket.id, ticket.organizationId, { updatedAt: new Date() });
        if (req.file) {
          const w = writeSupportFile(ticket.organizationId, req.file);
          await storage.createSupportAttachmentRow({
            ticketId: ticket.id,
            messageId: message.id,
            fileName: w.fileName,
            filePath: w.filePath,
            mimeType: req.file.mimetype,
            sizeBytes: req.file.size,
            uploadedBy: "customer",
            uploadedByUserId: userId,
          });
        }
        const base = publicBaseUrl(req);
        const fromLabel = [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.email || "Customer";
        const saasTo = await getSaasOwnerNotifyEmail();
        if (saasTo) {
          await notifyNewMessage(saasTo, {
            isToCustomer: false,
            org,
            ticket,
            fromLabel,
            body,
            smtpUserId,
            ctaUrl: `${base}${staffTicketPath(ticket.id)}`,
            ctaText: "Open ticket in dashboard",
          });
        }
        if (ticket.transferredToTechnical) {
          await syncMessageToTechnicalTeam({
            ticket,
            messageId: message.id,
            body,
            authorType: "customer",
            authorName: fromLabel || "Customer",
          });
        }
        return res.json({ success: true, messageId: message.id });
      } catch (e: any) {
        console.error("[me support message]", e);
        return res.status(500).json({ error: e?.message || "Failed" });
      }
    }
  );

  // --- Org: users who can handle tickets (for assignee dropdown) ---
  app.get(
    "/api/support/assignable-members",
    ...withOrgContext,
    requirePermission("support.view", "support.reply"),
    async (req: any, res: Response) => {
      try {
        const { organizationId } = req.context || {};
        if (!organizationId) {
          return res.status(400).json({ error: "organizationId required" });
        }
        const members = await storage.getOrganizationMembers(organizationId);
        const out = await Promise.all(
          members.map(async (m) => {
            const u = await storage.getUser(m.userId);
            return {
              userId: m.userId,
              displayName:
                u && (u.firstName || u.lastName)
                  ? [u.firstName, u.lastName].filter(Boolean).join(" ")
                  : u?.email || m.userId,
            };
          })
        );
        return res.json(out);
      } catch (e: any) {
        console.error("[support assignable members]", e);
        return res.status(500).json({ error: e?.message || "Failed" });
      }
    }
  );

  // --- Org: staff (whitelabel admin + team) ---
  app.get("/api/support/tickets", ...withOrgContext, requirePermission("support.view", "support.reply"), async (req: any, res: Response) => {
    try {
      const { organizationId } = req.context || {};
      if (!organizationId) {
        return res.status(400).json({ error: "organizationId required" });
      }
      const rows = await storage.listSupportTicketsForOrganization(organizationId);
      const out = await Promise.all(
        rows.map(async (t) => {
          const assignee = t.assignedToUserId ? await storage.getUser(t.assignedToUserId) : undefined;
          return {
            id: t.id,
            ticketNumber: t.ticketNumber,
            subject: t.subject,
            status: t.status,
            customerName: t.customerName,
            customerEmail: t.customerEmail,
            customerPhone: t.customerPhone || null,
            assignedToUserId: t.assignedToUserId,
            assigneeName: await resolveUserName(assignee),
            updatedAt: t.updatedAt,
            createdAt: t.createdAt,
          };
        })
      );
      return res.json(out);
    } catch (e: any) {
      console.error("[support list]", e);
      return res.status(500).json({ error: e?.message || "Failed" });
    }
  });

  app.get(
    "/api/support/tickets/:id",
    ...withOrgContext,
    requirePermission("support.view", "support.reply"),
    async (req: any, res: Response) => {
      try {
        const { organizationId } = req.context || {};
        const ticket = await storage.getSupportTicketByIdForOrganization(req.params.id, organizationId);
        if (!ticket) {
          return res.status(404).json({ error: "Not found" });
        }
        return res.json(await buildTicketResponse(ticket, req, "staff"));
      } catch (e: any) {
        console.error("[support get detail]", e);
        return res.status(500).json({ error: e?.message || "Failed" });
      }
    }
  );

  app.patch(
    "/api/support/tickets/:id",
    ...withOrgContext,
    requirePermission("support.reply"),
    async (req: any, res: Response) => {
      try {
        const { organizationId } = req.context || {};
        const existing = await storage.getSupportTicketByIdForOrganization(req.params.id, organizationId);
        if (!existing) {
          return res.status(404).json({ error: "Not found" });
        }
        const { status, assignedToUserId } = req.body || {};
        const prev = existing.status;
        const prevAssign = existing.assignedToUserId;
        const data: { status?: SupportTicket["status"]; assignedToUserId?: string | null } = {};
        if (status && typeof status === "string") {
          const allowed = ["open", "pending", "in_progress", "waiting_on_customer", "resolved", "closed"] as const;
          if (allowed.includes(status as any)) {
            data.status = status as SupportTicket["status"];
          }
        }
        if (assignedToUserId === null) {
          data.assignedToUserId = null;
        } else if (typeof assignedToUserId === "string") {
          const mem = await storage.getOrganizationMember(organizationId, assignedToUserId);
          if (mem) {
            data.assignedToUserId = assignedToUserId;
          } else {
            return res.status(400).json({ error: "Assignee is not a member of this organization" });
          }
        }
        if (data.status == null && data.assignedToUserId === undefined) {
          return res.status(400).json({ error: "No changes" });
        }
        const org = await storage.getOrganization(organizationId);
        if (!org) {
          return res.status(500).json({ error: "Organization not found" });
        }
        const smtpUserId = await getSupportSmtpUserId();
        const viewUrl = customerTicketUrl(req, existing.accessToken);
        const updated = await storage.updateSupportTicketByOrganization(existing.id, organizationId, { ...data, updatedAt: new Date() });
        if (!updated) {
          return res.status(500).json({ error: "Update failed" });
        }
        if (data.status && data.status !== prev) {
          await notifyCustomerStatusChanged({
            org,
            ticket: updated,
            previousStatus: prev,
            smtpUserId,
            customerViewUrl: viewUrl,
          });
        }
        if (data.assignedToUserId !== undefined && data.assignedToUserId !== prevAssign && data.assignedToUserId) {
          const assignee = await storage.getUser(data.assignedToUserId);
          if (assignee) {
            await notifyCustomerTicketAssigned({ org, ticket: updated, assignee, smtpUserId, customerViewUrl: viewUrl });
          }
        }
        return res.json({
          id: updated.id,
          status: updated.status,
          assignedToUserId: updated.assignedToUserId,
        });
      } catch (e: any) {
        console.error("[support patch]", e);
        return res.status(500).json({ error: e?.message || "Failed" });
      }
    }
  );

  app.post(
    "/api/support/tickets/:id/messages",
    ...withOrgContext,
    requirePermission("support.reply"),
    supportUpload.single("attachment"),
    async (req: any, res: Response) => {
      try {
        const { organizationId } = req.context || {};
        const userId = getUserId(req);
        const ticket = await storage.getSupportTicketByIdForOrganization(req.params.id, organizationId!);
        if (!ticket) {
          return res.status(404).json({ error: "Not found" });
        }
        const body = (req.body?.body as string)?.trim();
        if (!body) {
          return res.status(400).json({ error: "body is required" });
        }
        const org = await storage.getOrganization(organizationId!);
        if (!org) {
          return res.status(500).json({ error: "Organization not found" });
        }
        const smtpUserId = await getSupportSmtpUserId();
        const author = await storage.getUser(userId);
        const message = await storage.createSupportMessageRow({
          ticketId: ticket.id,
          body,
          authorType: "agent",
          authorUserId: userId,
        });
        await storage.updateSupportTicketByOrganization(ticket.id, organizationId!, { updatedAt: new Date() });
        if (req.file) {
          const w = writeSupportFile(organizationId!, req.file);
          await storage.createSupportAttachmentRow({
            ticketId: ticket.id,
            messageId: message.id,
            fileName: w.fileName,
            filePath: w.filePath,
            mimeType: req.file.mimetype,
            sizeBytes: req.file.size,
            uploadedBy: "agent",
            uploadedByUserId: userId,
          });
        }
        const fromLabel = await resolveUserName(author);
        const cta = customerTicketUrl(req, ticket.accessToken);
        await notifyNewMessage(ticket.customerEmail, {
          isToCustomer: true,
          org,
          ticket,
          fromLabel: `${org.name} — ${fromLabel}`,
          body,
          smtpUserId,
          ctaUrl: cta,
          ctaText: "View and reply to this ticket",
        });
        return res.json({ success: true, messageId: message.id });
      } catch (e: any) {
        console.error("[support staff message]", e);
        return res.status(500).json({ error: e?.message || "Failed" });
      }
    }
  );
}

async function buildTicketResponse(
  ticket: SupportTicket,
  req: Request,
  mode: "public" | "customer" | "staff",
  _customerUserId?: string
) {
  const org = await storage.getOrganization(ticket.organizationId);
  const messages = await storage.getSupportMessagesByTicketId(ticket.id);
  const attachments = await storage.getSupportAttachmentsByTicketId(ticket.id);
  const byMessage = new Map<string, SupportAttachment[]>();
  for (const a of attachments) {
    const list = byMessage.get(a.messageId) || [];
    list.push(a);
    byMessage.set(a.messageId, list);
  }
  const msgOut = await Promise.all(
    messages.map(async (m) => {
      const authorUser = m.authorUserId ? await storage.getUser(m.authorUserId) : null;
      const atts = (byMessage.get(m.id) || []).map((a) => ({
        id: a.id,
        fileName: a.fileName,
        url: a.filePath,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
      }));
      return {
        id: m.id,
        body: m.body,
        authorType: m.authorType,
        authorName:
          m.authorType === "technical_team"
            ? "Technical Team"
            : m.authorType === "agent"
              ? await resolveUserName(authorUser)
              : ticket.customerName || "Customer",
        createdAt: m.createdAt,
        attachments: atts,
      };
    })
  );
  const assignee = ticket.assignedToUserId ? await storage.getUser(ticket.assignedToUserId) : null;
  const base = {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject,
    description: ticket.description,
    status: ticket.status,
    organizationId: ticket.organizationId,
    organizationName: org?.name,
    customerName: ticket.customerName,
    customerEmail: mode === "staff" ? ticket.customerEmail : undefined,
    customerPhone: ticket.customerPhone || null,
    assignedToUserId: mode === "staff" ? ticket.assignedToUserId : undefined,
    assigneeName: mode === "staff" ? await resolveUserName(assignee) : undefined,
    transferredToTechnical: !!ticket.transferredToTechnical,
    transferredToTechnicalAt: ticket.transferredToTechnicalAt,
    technicalTicketId: mode === "staff" ? ticket.technicalTicketId : undefined,
    messages: msgOut,
    updatedAt: ticket.updatedAt,
    createdAt: ticket.createdAt,
  };
  if (mode === "public" || mode === "customer") {
    return {
      ...base,
      customerName: ticket.customerName,
      customerViewUrl: customerTicketUrl(req, ticket.accessToken),
    };
  }
  return { ...base, customerEmail: ticket.customerEmail, customerName: ticket.customerName };
}
