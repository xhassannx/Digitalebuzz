// @ts-nocheck
import type { Express } from "express";
import crypto from "crypto";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import {
  buildPublicUploadPath,
  deleteUploadFile,
  ingestMulterDiskFile,
  listUploadPrefix,
  readUploadBuffer,
  resolveUploadLocalPath,
  saveUploadBuffer,
  streamUploadToResponse,
  uploadExists,
} from "./utils/media-storage";
import { formatInvoiceNumber, normalizeInvoicePaymentStatus, computeInvoicePaymentAmounts } from "@shared/invoice";
import { db } from "../db";
import { isMongoEnabled } from "../db/mongo";
import { MessageModel, ManagedContactModel, MessageTemplateModel, SubscriptionModel } from "./models";
import { subscriptions, campaigns, campaignRecipients, managedContacts, contactTagAssignments, messageTemplates, contactTags, messages } from "@shared/schema";
import { applyHomepageHeroDefaults } from "@shared/white-label-homepage-defaults";
import { eq, and, or, sql, inArray, gte, lte } from "drizzle-orm";
import { enqueueCampaignExecution } from "./campaigns/execution-queue";
import { fetchMetaCampaignSendContext, tierToDailyLimit, formatMessagingTierLabel } from "./campaigns/send-pacing";
import { processMessageForChatbots, clearChatbotConversationForContact, invalidateAiAgentMemoryForAssistant, startChatbotForContact } from "./chatbots/executor";
// WhatsApp clients - supporting unofficial and official Business API
import { whatsappManager as unofficialManager } from "./whatsapp/client";
import { businessAPIManager, resolveWhatsAppDocumentFilename } from "./whatsapp/business-api-client";
import { flowButtonForTemplateMeta } from "./whatsapp/template-send-helpers";
import { setupAuth, isAuthenticated, isAuthenticatedOrApiKey, getSession } from "./replitAuth";
import { setupLocalAuth, createPasswordResetToken } from "./localAuth";
import { registerDevDbViewer } from "./dev-db-viewer";
import { triggerWebhooks } from "./webhooks/delivery";
import { webhookForwarder } from "./webhooks/forwarder";
import { rateLimitMiddleware } from "./middleware/rate-limiter";
import { checkUsageLimits, incrementUsage } from "./middleware/usage-limits";
import { assertPlanQuota, sendPlanQuotaDenial } from "./utils/plan-quotas";
import { resolveOrganizationContext, requireOrganizationRole, requirePermission } from "./middleware/organization-context";
import { resolveSaasSubscriptionStripe, RazorpayClient } from "./payment";
import {
  performSaasRazorpaySubscriptionCheckout,
  performSaasStripeSubscriptionCheckout,
  performSaasWalletSubscriptionCheckout,
  verifySaasRazorpaySubscriptionFirstPayment,
} from "./saas-subscription-checkout";
import { resolveSaasSubscriptionRazorpay } from "./payment/saas-subscription-razorpay";
import {
  buildPaginatedResponse,
  CONTACTS_MAX_PAGE_SIZE,
  isPaginatedListRequest,
  listPaginationFromRequest,
  paginateArray,
  parseListSearch,
} from "./utils/list-pagination";
import { registerIntegrationRoutes } from "./integrations";
import { registerContactPaymentRoutes } from "./payments/contact-payment-routes";
import { registerCommerceRoutes } from "./commerce/routes";
import { registerWaPayRoutes } from "./commerce/wa-pay-routes";
import { registerDripCampaignRoutes } from "./drip-campaigns/routes";
import { maybeEnrollNewContact, tryEnrollContactForDripTrigger } from "./drip-campaigns/enrollment";
import { registerChatSchedulingRoutes } from "./scheduling/chat-scheduling-routes";
import { registerMeetingsRoutes } from "./scheduling/meetings-routes";
import { registerBookingCalendarsRoutes } from "./scheduling/booking-calendars-routes";
import { registerPublicBookingRoutes } from "./scheduling/public-booking-routes";
import { setPanelOutboundBroadcaster } from "./panel-outbound-message";
import { setOptKeywordBroadcaster } from "./opt-keyword-service";
import { registerPanelInboxSendText, registerPanelInboxSendMedia, loadPanelMediaBufferFromUrl } from "./panel-inbox-send";
import { runReminderWhatsAppCheck } from "./reminders/whatsapp-scheduler";
import { registerAdminRoutes } from "./routes/admin";
import { registerWalletRoutes } from "./wallet/routes";
import { registerCreditLineRoutes } from "./credit-line/routes";
import { skipUsageLimitsWhenWalletBilling } from "./wallet/middleware";
import { registerPublicSubscriptionRoutes } from "./routes/public-subscription";
import { registerRemoteLicensorRoutes } from "./routes/remote-licensor";
import { requireProductionKey } from "./middleware/production-key";
import { registerSupportTicketRoutes } from "./support-routes";
import { registerCrmRoutes } from "./routes/crm";
import { isSaaSOwner } from "./middleware/admin-auth";
import {
  getUpdateStatus,
  runSyncAndRestart,
  fetchCustomerFromApi,
  pingPanelApi,
  checkCustomerStatusCached,
} from "./updates";
import { readEnvFile, updateEnvFile, getEnvValue } from "./env-file";
import { convertWebmToOgg } from "./utils/audio-convert";
import { isSubscriptionPeriodActiveByCalendarDay } from "./utils/subscription-calendar";
import {
  buildOfficialCarouselSendPayload,
  loadMediaBufferForCarousel,
  positionalVarNumbersInText,
} from "./whatsapp/carousel-send-payload";
import { buildProductCarouselSendPayload } from "./whatsapp/product-carousel-send-payload";
import {
  shrinkImageBufferForWhatsAppCarousel,
  WHATSAPP_CAROUSEL_MAX_IMAGE_BYTES,
  WHATSAPP_CAROUSEL_MAX_VIDEO_BYTES,
} from "./utils/whatsapp-carousel-media";
import {
  assertPanelUploadSize,
  classifyPanelUploadFromServer,
  PANEL_UPLOAD_MAX_BYTES,
  PANEL_UPLOAD_MULTER_MAX_BYTES,
  type PanelUploadMediaKind,
} from "@shared/panel-upload-limits";
import { 
  sendTextMessageSchema, 
  sendReactionMessageSchema,
  sendMediaMessageSchema,
  sendLocationMessageSchema,
  sendContactMessageSchema,
  insertWebhookSchema,
  insertOrganizationSchema,
  insertOrganizationMemberSchema,
  insertManagedContactSchema,
  insertContactTagSchema,
  insertContactColumnSchema,
  insertGroupSchema,
  insertGroupMemberSchema,
  insertCampaignSchema,
  insertCampaignRecipientSchema,
  insertChatbotSchema,
  insertChatbotNodeSchema,
  insertAiAssistantSchema,
  insertFaqItemSchema,
  insertFaqBotSettingsSchema,
  updateOrganizationInvoiceSettingsSchema,
  insertOrganizationLeadSchema,
  updateOrganizationLeadSchema,
  insertOrganizationLeadStatusSchema,
  updateOrganizationLeadStatusSchema,
  insertCannedMessageSchema,
  type CannedMessageRow,
  insertAutomationFlowSchema,
  type WhatsappSession,
  type Chat,
  type Message,
  type MessageTemplate,
  type ContactTag,
  type WhatsAppFlow,
} from "@shared/schema";

function normalizeMimeForMetaResumable(mimeType: string, format: "IMAGE" | "VIDEO"): string {
  const validMimeTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "video/mp4"];
  let mime = mimeType;
  if (!validMimeTypes.includes(mime)) {
    if (mime.startsWith("image/")) mime = "image/jpeg";
    else if (mime.startsWith("video/")) mime = "video/mp4";
    else mime = format === "VIDEO" ? "video/mp4" : "image/jpeg";
  }
  return mime;
}

function carouselButtonTypeSignature(buttons: any[]): string {
  return (buttons || [])
    .filter((b: any) => b?.text?.trim?.())
    .map((b: any) => String(b.type || "").toUpperCase())
    .join(",");
}

function metaCarouselTemplateButtonsFromUi(buttons: any[]): any[] {
  const list = (buttons || []).filter((b: any) => b?.text?.trim?.());
  if (list.length === 0) {
    throw new Error("Media card carousel requires at least one button per card");
  }
  if (list.length > 2) {
    throw new Error("Media card carousel supports at most 2 buttons per card");
  }
  return list.map((btn: any) => {
    const t = String(btn.type || "").toUpperCase();
    if (t === "QUICK_REPLY") {
      return { type: "QUICK_REPLY", text: String(btn.text).trim().slice(0, 25) };
    }
    if (t === "URL") {
      const url = String(btn.url || "").trim();
      if (!url) throw new Error("URL button requires a URL");
      return {
        type: "URL",
        text: String(btn.text).trim().slice(0, 25),
        url,
        example: [url],
      };
    }
    if (t === "PHONE_NUMBER") {
      const phone = String(btn.phoneNumber || "").trim();
      if (!phone) throw new Error("Phone button requires phoneNumber");
      return { type: "PHONE_NUMBER", text: String(btn.text).trim().slice(0, 25), phone_number: phone };
    }
    throw new Error(`Unsupported carousel button type: ${btn.type}`);
  });
}

// Memory storage for WhatsApp Business API uploads (temporary)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PANEL_UPLOAD_MULTER_MAX_BYTES },
});

// Disk storage for gallery files (organization-based)
const galleryStorage = multer.diskStorage({
  destination: (req: any, file, cb) => {
    const organizationId = req.context?.organizationId || req.query.organizationId || req.body.organizationId;
    if (!organizationId) {
      return cb(new Error('Organization ID is required'), '');
    }
    
    const uploadPath = path.join(process.cwd(), 'uploads', organizationId, 'gallery');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: (req: any, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  }
});

/** Slightly above client max (15MB video) so multipart overhead does not trip the limit */
const GALLERY_MAX_FILE_BYTES = PANEL_UPLOAD_MULTER_MAX_BYTES;

const galleryUpload = multer({
  storage: galleryStorage,
  limits: { fileSize: GALLERY_MAX_FILE_BYTES },
});

function galleryUploadSingle(req: any, res: any, next: any) {
  galleryUpload.single("file")(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
    if (code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error: `File is too large (max ${Math.round(GALLERY_MAX_FILE_BYTES / (1024 * 1024))} MB).`,
      });
    }
    if (code.startsWith("LIMIT_")) {
      return res.status(400).json({
        error: (err as Error).message || "Upload limit exceeded",
      });
    }
    console.error("[Gallery upload] Multer error:", err);
    return res.status(400).json({
      error: err instanceof Error ? err.message : "Upload failed",
    });
  });
}

const faqStorage = multer.diskStorage({
  destination: (req: any, _file, cb) => {
    const organizationId = req.context?.organizationId;
    if (!organizationId) {
      return cb(new Error("Organization ID is required"), "");
    }
    const uploadPath = path.join(process.cwd(), "uploads", organizationId, "faq");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, "_") || "file";
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  },
});

const faqUpload = multer({
  storage: faqStorage,
  limits: { fileSize: GALLERY_MAX_FILE_BYTES },
});

function faqUploadSingle(req: any, res: any, next: any) {
  faqUpload.single("file")(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
    if (code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File is too large (max 25 MB)." });
    }
    return res.status(400).json({
      error: err instanceof Error ? err.message : "Upload failed",
    });
  });
}

// Disk storage for website-builder images (organization-based)
const websiteBuilderStorage = multer.diskStorage({
  destination: (req: any, _file, cb) => {
    const organizationId = req.context?.organizationId || req.query.organizationId;
    if (!organizationId) {
      return cb(new Error('Organization ID is required'), '');
    }
    const uploadPath = path.join(process.cwd(), 'uploads', organizationId, 'website-builder');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname) || '.png';
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, '_') || 'image';
    cb(null, `${base}-${uniqueSuffix}${ext}`);
  },
});
const websiteBuilderUpload = multer({ storage: websiteBuilderStorage });

// Disk storage for invoice signature images (organization-based)
const invoiceSignatureStorage = multer.diskStorage({
  destination: (req: any, _file, cb) => {
    const organizationId = req.context?.organizationId;
    if (!organizationId) {
      return cb(new Error("Organization ID is required"), "");
    }
    const uploadPath = path.join(process.cwd(), "uploads", organizationId, "invoice");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || ".png";
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, "_") || "signature";
    cb(null, `${base}-${uniqueSuffix}${ext}`);
  },
});
const invoiceSignatureUpload = multer({
  storage: invoiceSignatureStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

const invoiceBannerStorage = multer.diskStorage({
  destination: (req: any, _file, cb) => {
    const organizationId = req.context?.organizationId;
    if (!organizationId) {
      return cb(new Error("Organization ID is required"), "");
    }
    const uploadPath = path.join(process.cwd(), "uploads", organizationId, "invoice");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || ".png";
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, "_") || "banner";
    cb(null, `banner-${base}-${uniqueSuffix}${ext}`);
  },
});
const invoiceBannerUpload = multer({
  storage: invoiceBannerStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

const invoicePdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

function parseCreateInvoiceRequest(req: any, res: any, next: any) {
  const contentType = String(req.headers["content-type"] || "");
  if (!contentType.includes("multipart/form-data")) {
    next();
    return;
  }
  invoicePdfUpload.single("pdf")(req, res, (err: unknown) => {
    if (err) {
      const code =
        err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
      if (code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "PDF file is too large (max 15 MB)." });
      }
      return res.status(400).json({
        error: err instanceof Error ? err.message : "Invoice upload failed",
      });
    }
    try {
      const raw = req.body?.data;
      req.body = typeof raw === "string" ? JSON.parse(raw) : req.body;
    } catch {
      return res.status(400).json({ error: "Invalid invoice data JSON" });
    }
    next();
  });
}

function invoiceSignatureUploadSingle(req: any, res: any, next: any) {
  invoiceSignatureUpload.single("file")(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
    if (code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File is too large (max 5 MB)." });
    }
    return res.status(400).json({
      error: err instanceof Error ? err.message : "Upload failed",
    });
  });
}

function invoiceBannerUploadSingle(req: any, res: any, next: any) {
  invoiceBannerUpload.single("file")(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
    if (code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "Banner file is too large (max 5 MB)." });
    }
    return res.status(400).json({
      error: err instanceof Error ? err.message : "Banner upload failed",
    });
  });
}

// Disk storage for profile avatars (user-based, authenticated)
const profileAvatarStorage = multer.diskStorage({
  destination: (req: any, _file, cb) => {
    const userId = req.user?.claims?.sub || req.user?.id;
    if (!userId) {
      return cb(new Error('Unauthorized'), '');
    }
    const uploadPath = path.join(process.cwd(), 'uploads', 'profile');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req: any, file, cb) => {
    const userId = req.user?.claims?.sub || req.user?.id;
    if (!userId) {
      return cb(new Error('Unauthorized'), '');
    }
    const ext = path.extname(file.originalname) || '.jpg';
    const safeExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext.toLowerCase()) ? ext : '.jpg';
    cb(null, `${userId}${safeExt}`);
  },
});
const profileAvatarUpload = multer({
  storage: profileAvatarStorage,
  limits: { fileSize: PANEL_UPLOAD_MAX_BYTES.image },
  fileFilter: (_req, file, cb) => {
    const allowed = /^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype);
    cb(null, !!allowed);
  },
});

/**
 * WhatsApp Business access token for template/Meta calls must match the integration that owns the phone.
 * - Prefer session.deviceInfo.integrationId, but only if that token can Graph-read the phone (detects wrong/stale binding).
 * - If multiple whatsapp-business integrations exist, probe each token against GET /{phone-number-id} (same idea as add-phone refresh).
 */
async function getWhatsappBusinessAccessTokenForOfficialSession(
  credUserId: string,
  organizationId: string | undefined,
  session: { deviceInfo?: { integrationId?: string; apiPhoneNumberId?: string } } | undefined | null,
  phoneNumberIdForProbe?: string | null
): Promise<string | undefined> {
  const graphBase = "https://graph.facebook.com/v23.0";
  const raw =
    phoneNumberIdForProbe ?? session?.deviceInfo?.apiPhoneNumberId ?? null;
  const phoneId =
    raw != null &&
    String(raw).trim() !== "" &&
    String(raw) !== "unknown"
      ? String(raw)
      : undefined;

  const extractToken = (creds: unknown): string | undefined => {
    const t =
      creds &&
      typeof creds === "object" &&
      (creds as { access_token?: string }).access_token;
    return typeof t === "string" && t.length > 0 ? t : undefined;
  };

  async function tokenAccessesPhone(token: string, pid: string): Promise<boolean> {
    try {
      const res = await fetch(
        `${graphBase}/${encodeURIComponent(pid)}?fields=id`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return res.ok;
    } catch {
      return false;
    }
  }

  const integrationId = session?.deviceInfo?.integrationId;
  if (integrationId) {
    const byId = await storage.getIntegration(integrationId, credUserId);
    if (
      byId?.name === "whatsapp-business" &&
      byId.status === "connected" &&
      byId.credentials
    ) {
      const t = extractToken(byId.credentials);
      if (t) {
        if (!phoneId || (await tokenAccessesPhone(t, phoneId))) {
          return t;
        }
      }
    }
  }

  if (phoneId) {
    const list = await storage.getIntegrationsByUser(credUserId, organizationId);
    for (const int of list) {
      if (
        int.name !== "whatsapp-business" ||
        int.status !== "connected" ||
        !int.credentials
      ) {
        continue;
      }
      const t = extractToken(int.credentials);
      if (t && (await tokenAccessesPhone(t, phoneId))) {
        return t;
      }
    }
  }

  const byName = await storage.getIntegrationByName(
    "whatsapp-business",
    credUserId,
    organizationId
  );
  return extractToken(byName?.credentials ?? null);
}

/** Project API (API key): find canned message across orgs the user belongs to; optional explicitOrgId scopes to one org. */
async function getProjectApiCannedMessageForUser(
  userId: string,
  messageId: string,
  explicitOrgId: string | undefined
): Promise<{ row: CannedMessageRow; orgId: string } | null> {
  const orgs = await storage.getOrganizationsByUser(userId);
  const explicit = explicitOrgId?.trim() || '';
  if (explicit) {
    if (!orgs.some((o: { id: string }) => o.id === explicit)) return null;
    const row = await storage.getCannedMessageByOrganization(messageId, explicit);
    return row ? { row, orgId: explicit } : null;
  }
  for (const org of orgs) {
    const row = await storage.getCannedMessageByOrganization(messageId, org.id);
    if (row) return { row, orgId: org.id };
  }
  return null;
}

function normalizeTemplateNameKey(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, '_').replace(/_+/g, '_');
}

/** Replace {{1}}, {{2}}, … in body text with param values (order = array index). */
function substituteNumericTemplatePlaceholders(bodyText: string, paramValues: string[]): string {
  let result = bodyText;
  paramValues.forEach((val, idx) => {
    const n = idx + 1;
    result = result.replace(new RegExp(`\\{\\{\\s*${n}\\s*\\}\\}`, 'g'), val);
  });
  return result;
}

/** Replace {{name}} placeholders using order of names in templateBodyHint (or bodyText). */
function substituteNamedTemplatePlaceholders(
  bodyText: string,
  paramValues: string[],
  templateBodyHint: string
): string {
  const names: string[] = [];
  const re = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(templateBodyHint)) !== null) {
    if (!names.includes(m[1])) names.push(m[1]);
  }
  if (names.length !== paramValues.length) {
    return substituteNumericTemplatePlaceholders(bodyText, paramValues);
  }
  let result = bodyText;
  names.forEach((name, i) => {
    result = result.replace(new RegExp(`\\{\\{\\s*${name}\\s*\\}\\}`, 'g'), paramValues[i]);
  });
  return result;
}

function applyTemplateParamsToPersistedBody(
  bodyPattern: string,
  paramValues: string[],
  templateBodyTextHint?: string
): string {
  if (paramValues.length === 0) return bodyPattern;
  if (/\{\{[a-zA-Z_]/.test(bodyPattern)) {
    return substituteNamedTemplatePlaceholders(bodyPattern, paramValues, templateBodyTextHint || bodyPattern);
  }
  return substituteNumericTemplatePlaceholders(bodyPattern, paramValues);
}

function pickTemplateRowByNameAndLang(
  list: { name: string; language: string; components: MessageTemplate['components'] }[],
  templateName: string,
  languageCode: string
) {
  const target = normalizeTemplateNameKey(templateName);
  const lang = (languageCode || 'en').toLowerCase();
  return list.find((t) => {
    if (normalizeTemplateNameKey(t.name) !== target) return false;
    const tl = (t.language || 'en').toLowerCase();
    return (
      tl === lang ||
      tl.startsWith(`${lang}_`) ||
      lang.startsWith(`${tl}_`) ||
      tl.split('_')[0] === lang.split('_')[0]
    );
  });
}

async function resolveSyncedTemplateBodyText(
  userId: string,
  templateName: string,
  languageCode: string,
  organizationId: string | undefined,
  phoneNumberId: string | undefined
): Promise<string | null> {
  try {
    const attempts: Array<() => Promise<MessageTemplate[]>> = [
      () => storage.getMessageTemplatesByUser(userId, organizationId, phoneNumberId),
    ];
    if (phoneNumberId) {
      attempts.push(() => storage.getMessageTemplatesByUser(userId, organizationId, undefined));
    }
    if (organizationId) {
      attempts.push(() => storage.getMessageTemplatesByUser(userId, undefined, undefined));
    }

    for (const fetchList of attempts) {
      const list = await fetchList();
      const row = pickTemplateRowByNameAndLang(list, templateName, languageCode);
      const body = row?.components?.find((c: { type?: string }) => c.type === 'BODY');
      if (typeof body?.text === 'string' && body.text.trim()) return body.text;
    }
    return null;
  } catch {
    return null;
  }
}

async function buildPersistedTemplateMessageBody(opts: {
  userId: string;
  templateName: string;
  languageCode: string;
  templateParams?: string[];
  templateBodyText?: string;
  organizationId?: string | null;
  phoneNumberId?: string;
}): Promise<string> {
  const {
    userId,
    templateName,
    languageCode,
    templateParams,
    templateBodyText,
    organizationId,
    phoneNumberId,
  } = opts;
  const paramsList = (templateParams ?? []).map((p) => String(p ?? ''));

  let pattern: string | null =
    (typeof templateBodyText === 'string' && templateBodyText.trim() ? templateBodyText.trim() : null) ??
    (await resolveSyncedTemplateBodyText(
      userId,
      templateName,
      languageCode,
      organizationId || undefined,
      phoneNumberId
    ));

  if (pattern) {
    if (paramsList.length > 0) {
      return applyTemplateParamsToPersistedBody(pattern, paramsList, templateBodyText);
    }
    return pattern;
  }
  if (paramsList.length > 0) {
    return `[Template] ${templateName}\n${paramsList.join('\n')}`;
  }
  return `[Template] ${templateName}`;
}

/** Digits only for matching CRM managed contact / group member phone to chat.contactNumber (1:1). */
function normalizeContactPhoneDigitsForCrm(raw: string): string {
  return String(raw || '')
    .replace(/^\+/, '')
    .replace(/@c\.us$/i, '')
    .replace(/@s\.whatsapp\.net$/i, '')
    .replace(/\D/g, '');
}

/** Canonical WhatsApp group JID for linking chats to CRM groups (whatsapp_group_id). */
function normalizeWhatsAppGroupJid(raw: string): string {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return '';
  if (s.endsWith('@g.us')) return s;
  return `${s}@g.us`;
}

/**
 * Project API: attach CRM managed contact id, contact tags (name + color), and CRM group memberships
 * to each chat row (tags/groups from organization scope).
 */
async function enrichProjectApiChatsWithTagsAndGroups(
  chats: Chat[],
  userId: string,
  organizationId: string | null
): Promise<
  Array<
    Chat & {
      managedContactId: string | null;
      tags: Array<{ id: string; name: string; color: string }>;
      tagNames: string[];
      groups: Array<{ id: string; name: string }>;
    }
  >
> {
  const base = (c: Chat) => ({
    ...c,
    managedContactId: null as string | null,
    tags: [] as Array<{ id: string; name: string; color: string }>,
    tagNames: [] as string[],
    groups: [] as Array<{ id: string; name: string }>,
  });

  if (!organizationId || chats.length === 0) {
    return chats.map(base);
  }

  const managed = await storage.getManagedContactsByUser(userId, organizationId);
  const phoneToContact = new Map<string, (typeof managed)[0]>();
  for (const mc of managed) {
    const key = normalizeContactPhoneDigitsForCrm(mc.phoneNumber);
    if (key.length >= 8 && !phoneToContact.has(key)) {
      phoneToContact.set(key, mc);
    }
  }

  const resolveManagedContact = (contactNumber: string, isGroup: boolean): (typeof managed)[0] | null => {
    if (isGroup) return null;
    const key = normalizeContactPhoneDigitsForCrm(contactNumber);
    let mc = phoneToContact.get(key) ?? null;
    if (!mc && key.length >= 10) {
      for (const [pk, m] of phoneToContact) {
        if (pk.endsWith(key) || key.endsWith(pk)) {
          return m;
        }
      }
    }
    return mc;
  };

  const contactIds: string[] = [];
  const rows: Array<{ chat: Chat; mcId: string | null; groupJid: string | null }> = [];
  for (const chat of chats) {
    const groupJid = chat.isGroup ? normalizeWhatsAppGroupJid(chat.contactNumber) : null;
    const mc = resolveManagedContact(chat.contactNumber, !!chat.isGroup);
    const mcId = mc?.id ?? null;
    if (mcId) contactIds.push(mcId);
    rows.push({ chat, mcId, groupJid });
  }

  const uniqueContactIds = [...new Set(contactIds)];
  const tagBatch: Map<string, ContactTag[]> =
    uniqueContactIds.length > 0
      ? await storage.getContactTagsBatch(uniqueContactIds, userId, organizationId)
      : new Map();

  const crmGroups = await storage.getGroupsByUser(userId, organizationId);
  const waJidToGroup = new Map<string, { id: string; name: string }>();
  const digitsToGroups = new Map<string, Array<{ id: string; name: string }>>();

  const addGroupToDigits = (digits: string, g: { id: string; name: string }) => {
    if (!digits) return;
    const arr = digitsToGroups.get(digits) ?? [];
    if (!arr.some((x) => x.id === g.id)) {
      arr.push(g);
      digitsToGroups.set(digits, arr);
    }
  };

  for (const g of crmGroups) {
    const meta = { id: g.id, name: g.name };
    if (g.whatsappGroupId) {
      waJidToGroup.set(normalizeWhatsAppGroupJid(g.whatsappGroupId), meta);
    }
    const members = await storage.getGroupMembers(g.id, userId, organizationId);
    for (const m of members) {
      addGroupToDigits(normalizeContactPhoneDigitsForCrm(m.phoneNumber), meta);
      if (m.contactId) {
        const mcRow = managed.find((x) => x.id === m.contactId);
        if (mcRow) addGroupToDigits(normalizeContactPhoneDigitsForCrm(mcRow.phoneNumber), meta);
      }
    }
  }

  return rows.map(({ chat, mcId, groupJid }) => {
    const tagsRaw = mcId ? tagBatch.get(mcId) ?? [] : [];
    const tags = tagsRaw.map((t) => ({ id: t.id, name: t.name, color: t.color }));
    const tagNames = tags.map((t) => t.name);
    let groups: Array<{ id: string; name: string }> = [];
    if (chat.isGroup && groupJid) {
      const linked = waJidToGroup.get(groupJid);
      groups = linked ? [linked] : [];
    } else if (!chat.isGroup) {
      const d = normalizeContactPhoneDigitsForCrm(chat.contactNumber);
      groups = [...(digitsToGroups.get(d) ?? [])];
      if (groups.length === 0 && d.length >= 10) {
        for (const [pk, arr] of digitsToGroups) {
          if (pk.endsWith(d) || d.endsWith(pk)) {
            groups = [...arr];
            break;
          }
        }
      }
    }
    return {
      ...chat,
      managedContactId: mcId,
      tags,
      tagNames,
      groups,
    };
  });
}

/** When upstream marks SUBSCRIPTION_EXPIRED, still allow billing/payment APIs so the customer can renew. */
function isBillingRenewalExemptPath(path: string): boolean {
  return [
    /^\/api\/subscriptions\/current$/,
    /^\/api\/subscriptions\/cancel$/,
    /^\/api\/subscriptions\/expiry-banner$/,
    /^\/api\/plans$/,
    /^\/api\/usage\/current$/,
    /^\/api\/payments\/create-razorpay-order$/,
    /^\/api\/payments\/checkout-stripe$/,
    /^\/api\/payments\/checkout-wallet$/,
    /^\/api\/payments\/verify-razorpay$/,
    /^\/api\/payments\/history$/,
    // Needed so PermissionGate / sidebar can resolve owner role while renewing
    /^\/api\/organizations$/,
    /^\/api\/organizations\/[^/]+\/current-member$/,
    /^\/api\/wallet\//,
  ].some((re) => re.test(path));
}

/** When licensor marks ACCOUNT_INACTIVE, still allow onboarding fee APIs + reactivation request (see CustomerStatusGuard). */
function isAccountInactiveOnboardingExemptPath(path: string): boolean {
  return [
    /^\/api\/panel\/licensor-account-state$/,
    /^\/api\/panel\/request-account-activation$/,
    /^\/api\/panel\/customer-status$/,
    /^\/api\/admin\/onboarding-fees$/,
    /^\/api\/admin\/onboarding-fee-settlements$/,
    /^\/api\/admin\/onboarding-billing-alert$/,
    /^\/api\/admin\/onboarding-fees\/create-order$/,
    /^\/api\/admin\/onboarding-fees\/verify$/,
    /^\/api\/admin\/onboarding-fees\/recalculate$/,
    /^\/api\/admin\/onboarding-fees\/recalculate-status$/,
  ].some((re) => re.test(path));
}

/** Same payment/status paths stay open when unpaid onboarding fees hit outstanding_amount_limit. */
function isOnboardingOutstandingExemptPath(path: string): boolean {
  return isAccountInactiveOnboardingExemptPath(path);
}

function publicAppBaseUrl(): string {
  return (process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || process.env.BASE_URL || "")
    .split(/\s*[\n#]/)[0]
    .trim()
    .replace(/\/+$/, "");
}

async function wrapTemplateUrlForClickTracking(opts: {
  url: string;
  organizationId?: string;
  userId?: string;
}): Promise<string> {
  const dest = String(opts.url || "").trim();
  if (!dest) return dest;
  if (/\/r\/[A-Za-z0-9_-]+/.test(dest)) return dest;
  const base = publicAppBaseUrl();
  if (!base || !opts.organizationId) return dest;
  try {
    const tracked = await storage.createTrackedUrl({
      destinationUrl: dest,
      organizationId: opts.organizationId,
      userId: opts.userId || null,
    });
    return `${base}/r/${tracked.code}`;
  } catch (err) {
    console.warn("[Template URL tracking] Failed to wrap URL:", (err as Error)?.message);
    return dest;
  }
}

async function buildTemplateButtonsFromBody(
  body: any,
  ctx: { organizationId?: string; userId?: string }
): Promise<any[]> {
  const buttons: any[] = [];
  const interactiveAction = body?.interactiveAction;
  const pushUrl = async (text: string, url: string) => {
    const tracked = await wrapTemplateUrlForClickTracking({
      url,
      organizationId: ctx.organizationId,
      userId: ctx.userId,
    });
    buttons.push({
      type: "URL",
      text: String(text).trim(),
      url: tracked,
      example: [tracked],
    });
  };

  if (Array.isArray(body?.orderedButtons) && body.orderedButtons.length > 0) {
    for (const btn of body.orderedButtons) {
      const type = String(btn?.type || "").toUpperCase();
      if (type === "QUICK_REPLY" && btn.text) {
        buttons.push({ type: "QUICK_REPLY", text: String(btn.text).trim() });
      } else if (type === "URL" && btn.text && btn.url) {
        await pushUrl(btn.text, btn.url);
      } else if (type === "PHONE_NUMBER" && btn.text && (btn.phoneNumber || btn.phone_number)) {
        buttons.push({
          type: "PHONE_NUMBER",
          text: String(btn.text).trim(),
          phone_number: btn.phoneNumber || btn.phone_number,
        });
      }
    }
    if (body.interactiveAction === "FORM" && body.flowId && body.formButtonText) {
      buttons.push({
        type: "FLOW",
        text: String(body.formButtonText || "Open form").trim().slice(0, 25),
        flow_id: String(body.flowId).trim(),
        flow_action: "navigate",
      });
    }
    return buttons;
  }

  if (interactiveAction === "CALL_TO_ACTION" || interactiveAction === "ALL") {
    const urlButtons = body.urlButtons || [];
    for (const btn of urlButtons.slice(0, 2)) {
      if (btn?.text && btn?.url) {
        await pushUrl(btn.text, btn.url);
      }
    }
    const phoneButtons = body.phoneButtons || [];
    if (phoneButtons.length > 0) {
      const btn = phoneButtons[0];
      if (btn?.text && btn?.phoneNumber) {
        buttons.push({
          type: "PHONE_NUMBER",
          text: String(btn.text).trim(),
          phone_number: btn.phoneNumber,
        });
      }
    }
  }
  if (interactiveAction === "QUICK_REPLY" || interactiveAction === "ALL") {
    const quickReplies = body.quickReplies || [];
    quickReplies.slice(0, 10).forEach((text: string) => {
      if (text && String(text).trim()) {
        buttons.push({ type: "QUICK_REPLY", text: String(text).trim() });
      }
    });
  }
  if (interactiveAction === "FORM" && body.flowId && body.formButtonText) {
    buttons.push({
      type: "FLOW",
      text: String(body.formButtonText || "Open form").trim().slice(0, 25),
      flow_id: String(body.flowId).trim(),
      flow_action: "navigate",
    });
  }
  return buttons;
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/r/:code", async (req, res) => {
    try {
      const code = String(req.params.code || "").trim();
      if (!code) return res.status(404).send("Not found");
      const tracked = await storage.getTrackedUrlByCode(code);
      if (!tracked?.destinationUrl) return res.status(404).send("Link not found");
      await storage.recordTrackedUrlClick(tracked.id, {
        campaignId: tracked.campaignId,
        ip: req.ip,
        userAgent: String(req.get("user-agent") || "").slice(0, 500),
      });
      return res.redirect(302, tracked.destinationUrl);
    } catch (error: any) {
      console.error("[Tracked URL] redirect failed:", error?.message);
      return res.status(500).send("Unable to open link");
    }
  });

  // Canvas flow webhooks (Make.com, Shopify, Zoom middleware, etc.) — no auth; flow must be published
  app.get("/api/v2/webhook/flows/:flowId", async (req: any, res) => {
    try {
      const { flowId } = req.params;
      const flow = await storage.getAutomationFlowById(flowId);
      if (!flow) {
        return res.status(404).json({ message: "Flow not found" });
      }
      return res.status(200).type("text/plain").send("Ok");
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ ok: false, message: msg });
    }
  });

  app.post("/api/v2/webhook/flows/:flowId", async (req: any, res) => {
    try {
      const { flowId } = req.params;
      const body =
        req.body && typeof req.body === "object" && !Array.isArray(req.body)
          ? (req.body as Record<string, unknown>)
          : {};
      const queryTrigger =
        typeof req.query?.trigger === "string" ? req.query.trigger : undefined;
      const { handleFlowWebhook } = await import("./automation/flow-webhook");
      const result = await handleFlowWebhook(flowId, body, {
        queryTrigger,
        headers: req.headers as Record<string, unknown>,
      });
      return res.status(result.status).json({
        ok: result.ok,
        message: result.message,
        ran: result.ran ?? false,
        triggerId: result.triggerId,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("[Flow webhook] error:", msg);
      return res.status(500).json({ ok: false, message: msg });
    }
  });

  // Ensure contact_activity_log table exists (for Activity tab)
  if (!isMongoEnabled() && typeof db?.execute === 'function') {
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS contact_activity_log (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
          contact_id VARCHAR NOT NULL REFERENCES managed_contacts(id) ON DELETE CASCADE,
          user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          organization_id VARCHAR REFERENCES organizations(id) ON DELETE CASCADE,
          action VARCHAR NOT NULL CHECK (action IN ('tag_added', 'tag_removed', 'note_added', 'reminder_added')),
          metadata JSONB,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_contact_activity_contact ON contact_activity_log(contact_id)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_contact_activity_org ON contact_activity_log(organization_id)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_contact_activity_created ON contact_activity_log(created_at)`);
    } catch (err: any) {
      if (!err?.message?.includes('already exists')) {
        console.warn('Contact activity log table setup:', err?.message || err);
      }
    }

    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS organization_live_chat_settings (
          organization_id VARCHAR PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
          welcome_enabled BOOLEAN NOT NULL DEFAULT FALSE,
          welcome_message TEXT NOT NULL DEFAULT '',
          off_hours_enabled BOOLEAN NOT NULL DEFAULT FALSE,
          off_hours_message TEXT NOT NULL DEFAULT '',
          working_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS live_chat_auto_reply_state (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
          organization_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          session_id VARCHAR NOT NULL,
          contact_number VARCHAR(32) NOT NULL,
          last_kind VARCHAR(16) NOT NULL,
          last_sent_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS live_chat_auto_reply_state_org_session_contact
        ON live_chat_auto_reply_state (organization_id, session_id, contact_number)
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_live_chat_auto_reply_org
        ON live_chat_auto_reply_state (organization_id)
      `);
    } catch (err: any) {
      if (!err?.message?.includes('already exists')) {
        console.warn('Live chat settings table setup:', err?.message || err);
      }
    }
  }

  // Helper function to normalize phone numbers for comparison
  const normalizePhoneNumber = (phoneNumber: string): string => {
    // Remove @c.us, @g.us suffixes and any + prefix
    return phoneNumber.replace('@c.us', '').replace('@g.us', '').replace(/^\+/, '').trim();
  };

  // Allow session if it belongs to user or to user's organization (team members can use org sessions)
  const sessionAllowedForUser = async (
    session: WhatsappSession | undefined,
    sessionId: string,
    userId: string,
    organizationId: string | null
  ): Promise<boolean> => {
    if (!session) return false;
    if (session.userId === userId) return true;
    if (!organizationId) return false;
    const orgSessions = await storage.getSessionsByOrganization(organizationId);
    return orgSessions.some((s) => s.sessionId === sessionId);
  };

  // Helper function to find or create chat and return its UUID
  const findOrCreateChat = async (sessionId: string, contactNumber: string): Promise<string> => {
    // Normalize the input phone number for comparison
    const normalizedInput = normalizePhoneNumber(contactNumber);
    
    // Check if chat exists (normalize both for comparison)
    const chats = await storage.getChatsBySession(sessionId);
    const existingChat = chats.find(c => {
      const normalizedChat = normalizePhoneNumber(c.contactNumber);
      return normalizedChat === normalizedInput;
    });
    
    if (existingChat) {
      return existingChat.id;
    }
    
    // Detect if this is a group based on WhatsApp ID format
    const isGroup = contactNumber.includes('@g.us');
    
    // Generate appropriate display name
    let contactName = contactNumber;
    if (isGroup) {
      // For groups, try to extract a readable name from the ID
      contactName = contactNumber.replace('@g.us', '').replace(/_/g, ' ');
    } else {
      // For individual contacts, just show the phone number
      contactName = contactNumber.replace('@c.us', '');
    }
    
    // First, find or create the contact (normalize for comparison)
    const existingContacts = await storage.getContactsBySession(sessionId);
    let contact = existingContacts.find(c => {
      const normalizedContact = normalizePhoneNumber(c.number);
      return normalizedContact === normalizedInput;
    });
    
    if (!contact) {
      // Ensure contactNumber has proper format for storage
      let formattedNumber = contactNumber;
      if (!isGroup && !formattedNumber.includes('@c.us') && !formattedNumber.includes('@g.us')) {
        formattedNumber = `${formattedNumber}@c.us`;
      }
      
      // Create new contact
      contact = await storage.createContact({
        sessionId,
        name: contactName,
        number: formattedNumber,
        isGroup,
      });
    }
    
    // Ensure contactNumber has proper format for chat storage
    let formattedChatNumber = contactNumber;
    if (!isGroup && !formattedChatNumber.includes('@c.us') && !formattedChatNumber.includes('@g.us')) {
      formattedChatNumber = `${formattedChatNumber}@c.us`;
    }
    
    // Create new chat using the contact's UUID
    const newChat = await storage.createChat({
      sessionId,
      contactId: contact.id, // Use the contact's UUID, not the phone number
      contactName,
      contactNumber: formattedChatNumber,
      lastMessage: '',
      lastMessageTime: new Date(),
      unreadCount: 0,
      isGroup,
    });
    
    return newChat.id;
  };

  // Helper to get userId from either session or API key (used by routes)
  const getUserId = (req: any): string => {
    return req.user?.claims?.sub || req.user?.id || req.userId;
  };

  // Helper to combine auth + rate limiting for API endpoints
  const withAuthAndRateLimit = [isAuthenticatedOrApiKey, rateLimitMiddleware];
  const withOrgContext = [isAuthenticatedOrApiKey, rateLimitMiddleware, resolveOrganizationContext];
  const withOrgAdmin = [...withOrgContext, requireOrganizationRole('owner', 'admin')];
  const withOrgOwner = [...withOrgContext, requireOrganizationRole('owner')];

  // Helper to get the appropriate WhatsApp client manager based on connection type
  const getWhatsAppManager = async (sessionId: string) => {
    const session = await storage.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    switch (session.connectionType) {
      case 'official':
        return businessAPIManager;
      case 'unofficial':
        return unofficialManager;
      default:
        throw new Error(`Unsupported connection type: ${session.connectionType}. Please use 'official' (Business API) or 'unofficial' (WhatsApp Web) connection type.`);
    }
  };

  /**
   * Re-resolve OAuth token + phone_number_id from DB for this session and refresh in-memory Business API creds.
   * Required for multi-number setups: isClientReady() only checks Map membership, so stale/wrong creds (e.g. token
   * for another WABA) still looked "ready" and caused Graph 100/33 on POST .../{phone-number-id}/media.
   */
  const ensureOfficialSessionCredentialsForMessaging = async (
    sessionId: string,
    session: WhatsappSession,
    userId: string,
    organizationId: string | null
  ): Promise<boolean> => {
    if (session.connectionType !== 'official') {
      return true;
    }

    let accessToken: string | null = null;
    let phoneNumberId: string | null = null;
    let businessAccountId: string | null = null;

    try {
      const apiPhoneNumberId = session.deviceInfo?.apiPhoneNumberId;
      let integration: any = null;
      if (session.deviceInfo?.integrationId) {
        integration = await storage.getIntegration(session.deviceInfo.integrationId, userId);
      }
      if (!integration) {
        integration = await storage.getIntegrationByName('whatsapp-business', userId, organizationId || undefined);
      }
      if (apiPhoneNumberId) {
        const allIntegrations = await storage.getIntegrationsByUser(userId, organizationId || undefined);
        const whatsappIntegrations = allIntegrations.filter(
          (i: any) => i.name === 'whatsapp-business' && i.status === 'connected' && i.credentials
        );
        let foundIntegration: any = null;
        for (const int of whatsappIntegrations) {
          const creds = int.credentials as any;
          const token = creds?.access_token;
          if (!token) continue;
          try {
            const checkRes = await fetch(
              `https://graph.facebook.com/v23.0/${apiPhoneNumberId}?fields=id&access_token=${encodeURIComponent(token)}`
            );
            if (checkRes.ok) {
              foundIntegration = int;
              break;
            }
          } catch {
            continue;
          }
        }
        if (foundIntegration) {
          integration = foundIntegration;
          if (session.deviceInfo && foundIntegration.id !== session.deviceInfo.integrationId) {
            storage
              .updateSession(sessionId, {
                deviceInfo: { ...session.deviceInfo, integrationId: foundIntegration.id },
              })
              .catch(() => {});
          }
        }
      }
      if (integration?.status === 'connected' && integration.credentials) {
        const credentials = integration.credentials as any;
        accessToken = credentials.access_token;
        if (session.deviceInfo?.apiPhoneNumberId) {
          phoneNumberId = session.deviceInfo.apiPhoneNumberId;
        }
        if (session.deviceInfo?.businessAccountId) {
          businessAccountId = session.deviceInfo.businessAccountId;
        }
      }
    } catch (integrationError: any) {
      console.warn('[Ensure Business API creds] Integration lookup failed:', integrationError?.message);
    }

    if (!accessToken) {
      const settings = await storage.getUserSettings(userId);
      if (
        settings?.whatsappBusinessCredentials?.phoneNumberId &&
        settings.whatsappBusinessCredentials.accessToken &&
        settings.whatsappBusinessCredentials.phoneNumberId === session.deviceInfo?.apiPhoneNumberId
      ) {
        accessToken = settings.whatsappBusinessCredentials.accessToken;
        phoneNumberId = settings.whatsappBusinessCredentials.phoneNumberId;
        businessAccountId = settings.whatsappBusinessCredentials.businessAccountId || null;
      }
    }

    if (accessToken && phoneNumberId) {
      try {
        await businessAPIManager.restoreSession(sessionId, {
          phoneNumberId,
          accessToken,
          businessAccountId: businessAccountId ?? undefined,
        });
      } catch (reloadError: any) {
        console.error('[Ensure Business API creds] restoreSession failed:', reloadError?.message);
      }
    }

    return businessAPIManager.isClientReady(sessionId);
  };

  /**
   * Project API only: called from POST /api/project/v1/messages persist. Panel /chat uses POST /api/messages/send-media (unchanged).
   * Copies Graph media to uploads/{org}/messages like send-media so mediaUrl is /uploads/...
   */
  const saveGraphMediaIdToLocalUploads = async (
    sessionId: string,
    userId: string,
    graphMediaId: string,
    mediaKind: 'image' | 'video' | 'audio' | 'document',
    hintCaptionOrFileName?: string
  ): Promise<string | null> => {
    try {
      if (!/^[a-zA-Z0-9_-]+$/.test(graphMediaId) || graphMediaId.length < 11) return null;
      const session = await storage.getSession(sessionId);
      if (!session) return null;
      const orgs = await storage.getOrganizationsByUser(userId);
      const organizationId = orgs[0]?.id;
      if (!organizationId) return null;
      const ready = await ensureOfficialSessionCredentialsForMessaging(
        sessionId,
        session,
        userId,
        organizationId
      );
      if (!ready) return null;

      const { url: graphUrl } = await businessAPIManager.getMediaForTemplate(sessionId, graphMediaId);
      const creds = businessAPIManager.getCredentials(sessionId);
      if (!creds?.accessToken) return null;

      const mediaRes = await fetch(graphUrl, {
        headers: { Authorization: `Bearer ${creds.accessToken}` },
      });
      if (!mediaRes.ok) return null;

      const buf = Buffer.from(await mediaRes.arrayBuffer());
      const ct = (mediaRes.headers.get('content-type') || '').toLowerCase();

      let ext = '.bin';
      if (ct.includes('png')) ext = '.png';
      else if (ct.includes('jpeg') || ct.includes('jpg')) ext = '.jpg';
      else if (ct.includes('gif')) ext = '.gif';
      else if (ct.includes('webp')) ext = '.webp';
      else if (ct.includes('mp4') || ct.includes('video')) ext = '.mp4';
      else if (ct.includes('pdf')) ext = '.pdf';
      else if (ct.includes('ogg') || ct.includes('opus') || ct.includes('audio')) ext = '.ogg';
      else if (mediaKind === 'image') ext = '.jpg';
      else if (mediaKind === 'video') ext = '.mp4';
      else if (mediaKind === 'audio') ext = '.ogg';

      const hint = hintCaptionOrFileName?.trim() || '';
      const extFromHint = hint.match(/\.([a-zA-Z0-9]+)\s*$/);
      if (extFromHint) {
        const e = extFromHint[1].toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'pdf', 'ogg', 'webm'].includes(e)) {
          ext = e === 'jpeg' ? '.jpg' : `.${e}`;
        }
      }

      let safeBase = 'media';
      if (hint) {
        const base = path.basename(hint, path.extname(hint));
        const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '');
        if (cleaned.length > 0) safeBase = cleaned.slice(0, 100);
      }

      const filename = `${safeBase}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      const publicPath = buildPublicUploadPath(organizationId, 'messages', filename);
      await saveUploadBuffer(publicPath, buf);
      return publicPath;
    } catch (e: any) {
      console.warn('[Project API] saveGraphMediaIdToLocalUploads:', e?.message);
      return null;
    }
  };

  /** Project API only: public origin for integrators. Prefer BASE_URL in .env when behind reverse proxy. Not used by GET /api/messages/:chatId (panel). */
  const getPublicAppBaseUrl = (req: any): string => {
    const fromEnv = (process.env.BASE_URL || '').split(/\s*[\n#]/)[0].trim().replace(/\/+$/, '');
    if (fromEnv) return fromEnv;
    return `${req.protocol}://${req.get('host')}`;
  };

  /**
   * WhatsApp Cloud API media id stored in messages.media_url when webhook omits CDN link.
   * Broader than /^[a-zA-Z0-9_-]+$/+length>10 so numeric-only and typical Meta ids resolve.
   */
  const isWhatsAppGraphMediaIdToken = (raw: unknown): boolean => {
    const s = String(raw ?? '').trim();
    if (s.length < 8 || s.length > 256) return false;
    if (/^https?:\/\//i.test(s)) return false;
    if (s.startsWith('/') || s.startsWith('blob:') || s.includes('\\')) return false;
    if (/[\s<>"']/.test(s)) return false;
    if (s.includes('/')) return false;
    return /^[0-9A-Za-z_.~-]+$/.test(s);
  };

  /**
   * Project API: enrich message with absolute URLs. Panel /chat resolves relative ids via cookies;
   * integrators use mediaUrlAbsolute to fetch bytes (Graph ids → GET /api/project/v1/media/content).
   * mediaMetadataUrl is optional JSON from GET /api/media/:id (WhatsApp CDN URL discovery).
   */
  const withProjectApiMessageMediaAbsolute = (req: any, m: Record<string, unknown>): Record<string, unknown> => {
    const mu = m.mediaUrl;
    if (typeof mu !== 'string' || !mu.trim()) return m;
    const base = getPublicAppBaseUrl(req).replace(/\/+$/, '');
    const sessionId = typeof m.sessionId === 'string' ? m.sessionId : '';
    const sidQ = sessionId ? encodeURIComponent(sessionId) : '';

    const out: Record<string, unknown> = { ...m };

    if (mu.startsWith('http://') || mu.startsWith('https://')) {
      if (
        sessionId &&
        (mu.includes('lookaside.fbsbx.com') || mu.includes('facebook.com'))
      ) {
        out.mediaUrlAbsolute = `${base}/api/media-proxy?url=${encodeURIComponent(mu)}&sessionId=${sidQ}`;
      } else {
        out.mediaUrlAbsolute = mu;
      }
      return out;
    }

    if (mu.startsWith('/')) {
      out.mediaUrlAbsolute = `${base}${mu}`;
      return out;
    }

    if (sessionId && isWhatsAppGraphMediaIdToken(mu)) {
      const mid = encodeURIComponent(mu);
      const contentUrl = `${base}/api/project/v1/media/content?sessionId=${sidQ}&mediaId=${mid}`;
      out.mediaUrlAbsolute = contentUrl;
      out.mediaContentUrl = contentUrl;
      out.mediaMetadataUrl = `${base}/api/media/${mid}?sessionId=${sidQ}`;
      return out;
    }

    return m;
  };

  /** Project API canned messages: return imageUrl as absolute URL (BASE_URL or request host) for integrators. */
  const toProjectApiCannedRow = (req: any, row: CannedMessageRow): CannedMessageRow => {
    const iu = row.imageUrl;
    if (typeof iu !== 'string' || !iu.trim()) return row;
    const t = iu.trim();
    if (t.startsWith('http://') || t.startsWith('https://')) return row;
    const base = getPublicAppBaseUrl(req).replace(/\/+$/, '');
    const pathPart = t.startsWith('/') ? t : `/${t}`;
    const segments = pathPart.split('/').filter(Boolean);
    const encodedPath = segments.length ? `/${segments.map((s) => encodeURIComponent(s)).join('/')}` : '';
    const absolute = `${base}${encodedPath}`;
    return { ...row, imageUrl: absolute };
  };

  // Setup authentication (session-based with local password)
  await setupAuth(app);
  
  // Setup local password-based authentication (signup/login routes)
  setupLocalAuth(app);
  registerDevDbViewer(app);

  // Register CRM routes first (public endpoints - no auth/subscription required)
  registerCrmRoutes(app);

  // Register integration routes
  registerIntegrationRoutes(app);
  registerContactPaymentRoutes(app);
  registerCommerceRoutes(app);
  registerWaPayRoutes(app);
  registerDripCampaignRoutes(app);
  registerChatSchedulingRoutes(app);
  registerMeetingsRoutes(app);
  registerBookingCalendarsRoutes(app);
  registerPublicBookingRoutes(app);
  registerAdminRoutes(app);
  registerWalletRoutes(app);
  registerCreditLineRoutes(app);
  const walletUsageSkip = skipUsageLimitsWhenWalletBilling();
  registerPublicSubscriptionRoutes(app);
  registerSupportTicketRoutes(app);

  // Customer status check: BYPASSED for unlimited local access
  const customerStatusMiddleware = async (_req: any, _res: any, next: () => void) => {
    return next();
  };
  app.use(customerStatusMiddleware);

  /**
   * Unpaid onboarding fees over outstanding_amount_limit: BYPASSED for unlimited local access
   */
  const onboardingOutstandingMiddleware = async (_req: any, _res: any, next: () => void) => {
    return next();
  };
  app.use(onboardingOutstandingMiddleware);

  /**
   * Block panel APIs when the tenant's local subscription period has ended: BYPASSED for unlimited local access
   */
  const localSubscriptionExpiredMiddleware = async (_req: any, _res: any, next: () => void) => {
    return next();
  };
  app.use(localSubscriptionExpiredMiddleware);

  /** GET /api/panel/customer-status – always active */
  app.get("/api/panel/customer-status", isAuthenticated, async (_req: any, res) => {
    return res.json({ status: "active", allowed: true, is_active: true });
  });

  // Updates: fetch from GitHub, build, restart PM2 (SaaS owner only)
  app.get("/api/updates/status", isAuthenticated, isSaaSOwner, async (_req, res) => {
    try {
      const status = await getUpdateStatus();
      res.json(status);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to get update status" });
    }
  });

  /** Customer from panel API (sanitized: no token/password). Used by Admin > Updates to show which repo/customer is linked. */
  app.get("/api/updates/customer", isAuthenticated, isSaaSOwner, async (_req, res) => {
    try {
      const customer = await fetchCustomerFromApi();
      if (!customer) {
        return res.json(null);
      }
      const sanitized = {
        id: customer.id,
        business_name: customer.business_name,
        domain: customer.domain,
        github_repo_url: customer.github_repo_url,
        subscription_end: customer.subscription_end,
        days_remaining: customer.days_remaining,
        webhook_url: customer.webhook_url,
        is_active: customer.is_active,
      };
      res.json(sanitized);
    } catch {
      res.json(null);
    }
  });

  app.post("/api/updates/sync", isAuthenticated, isSaaSOwner, async (_req, res) => {
    try {
      const result = await runSyncAndRestart();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({
        success: false,
        steps: [],
        error: err?.message || "Sync failed",
      });
    }
  });

  /** GET /api/updates/status-remote – panel update status (for customer portal). Auth: X-Production-Key or Authorization: Bearer PRODUCTION_KEY */
  app.get("/api/updates/status-remote", requireProductionKey, async (_req, res) => {
    try {
      const status = await getUpdateStatus();
      res.json(status);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to get update status" });
    }
  });

  /** POST /api/updates/sync-remote – trigger deploy/sync from customer portal. Auth: X-Production-Key or Authorization: Bearer PRODUCTION_KEY */
  app.post("/api/updates/sync-remote", requireProductionKey, async (_req, res) => {
    try {
      const result = await runSyncAndRestart();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({
        success: false,
        steps: [],
        error: err?.message || "Sync failed",
      });
    }
  });

  registerRemoteLicensorRoutes(app);

  // Admin: .env viewer and editor (SaaS owner only)
  app.get("/api/admin/env", isAuthenticated, isSaaSOwner, async (_req, res) => {
    try {
      const result = readEnvFile();
      if (result.error) return res.status(500).json({ message: result.error });
      res.json({ entries: result.entries });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to read .env" });
    }
  });
  app.get("/api/admin/env/value", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const key = req.query?.key;
      if (!key || typeof key !== "string") return res.status(400).json({ message: "key query required" });
      const value = getEnvValue(key.trim());
      if (value === null) return res.status(404).json({ message: "Key not found" });
      res.json({ value });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to read value" });
    }
  });
  app.patch("/api/admin/env", isAuthenticated, isSaaSOwner, async (req: any, res) => {
    try {
      const body = req.body;
      const entries = Array.isArray(body?.entries) ? body.entries : [];
      if (entries.length === 0) return res.status(400).json({ message: "entries array required" });
      const updates = entries
        .filter((e: any) => e && typeof e.key === "string" && e.key.trim())
        .map((e: any) => ({ key: String(e.key).trim(), value: e.value != null ? String(e.value) : "" }));
      if (updates.length === 0) return res.status(400).json({ message: "No valid key-value pairs" });
      const result = updateEnvFile(updates);
      if (!result.success) return res.status(500).json({ message: result.error });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to update .env" });
    }
  });

  // Admin: panel API connectivity check (for deploy/sync debugging)
  app.get("/api/admin/panel-status", isAuthenticated, isSaaSOwner, async (_req, res) => {
    try {
      const result = await pingPanelApi();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ ok: false, configured: true, error: err?.message || "Check failed" });
    }
  });

  // Auth endpoints (no rate limiting on auth endpoints)
  app.get("/api/country-dial-codes", isAuthenticated, async (_req, res) => {
    try {
      const rows = await storage.getCountryDialCodes();
      res.json(
        rows.map((r) => ({
          iso: r.isoCode,
          country: r.countryName,
          dial: r.dialPrefix,
        })),
      );
    } catch (error: any) {
      console.error("Error fetching country dial codes:", error);
      res.status(500).json({ message: error?.message || "Failed to fetch country codes" });
    }
  });

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

  /** OR of feature flags from add-ons assigned to this user; all enabled for unlimited local */
  app.get('/api/auth/addon-menu-features', isAuthenticated, async (_req: any, res) => {
    res.json({
      hasAssignments: true,
      webhookEvents: true,
      chatbot: true,
      flows: true,
      dripCampaigns: true,
    });
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
      await ingestMulterDiskFile(file, profileImageUrl);
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

      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      });
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
        // Existing user (e.g. re-added after removal): set new temp password and send full invite email with credentials + change password link
        const bcrypt = await import('bcryptjs');
        const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        const tempPassword = Array.from(crypto.randomBytes(12), (b) => CHARS[b % CHARS.length]).join('');
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(tempPassword, salt);
        await storage.updateUser(targetUser.id, { passwordHash });
        const displayName = [firstName, lastName].filter(Boolean).join(' ').trim() || targetUser.firstName || email.split('@')[0];
        const baseUrl = (process.env.BASE_URL || 'http://localhost:5001').split(/\s*[\n#]/)[0].trim().replace(/\/+$/, '');
        const setPasswordLink = createPasswordResetToken(targetUser.id, email, process.env.BASE_URL);
        const loginUrl = `${baseUrl}/login`;
        const { sendInvitationEmail } = await import('./utils/email');
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
        // Human-readable random password (12 chars, avoid ambiguous 0/O, 1/l/I)
        const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        const tempPassword = Array.from(crypto.randomBytes(12), (b) => CHARS[b % CHARS.length]).join('');
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
        const { sendInvitationEmail } = await import('./utils/email');
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
        const { waiveOnboardingForTeamMember } = await import("./whitelabel-onboarding-eligibility");
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
      const { name } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Key name is required" });
      }

      // Generate secure API key
      const key = `wapi_${Date.now()}_${crypto.randomUUID()}`;

      const apiKey = await storage.createApiKey({
        userId,
        name,
        key,
      });

      res.json(apiKey);
    } catch (error: any) {
      console.error("Error creating API key:", error);
      res.status(500).json({ message: "Failed to create API key" });
    }
  });

  app.delete('/api/keys/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      // Verify the key belongs to the user
      const keys = await storage.getApiKeysByUser(userId);
      const keyToDelete = keys.find(k => k.id === id);

      if (!keyToDelete) {
        return res.status(404).json({ message: "API key not found" });
      }

      await storage.deleteApiKey(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting API key:", error);
      res.status(500).json({ message: "Failed to delete API key" });
    }
  });

  // ─── Project API (v1) – for third-party integration (e.g. CRM, automation, external apps) ───
  // Auth: X-API-Key header. Create keys in Dashboard → Settings → API Keys.
  // Base URL: /api/project/v1

  app.get('/api/project/v1', ...withAuthAndRateLimit, async (req: any, res) => {
    res.json({
      name: 'Project API',
      version: '1.0',
      description: 'Third-party API for WhatsApp messaging. Use your API key (X-API-Key header) to send messages, list sessions and templates.',
      baseUrl: '/api/project/v1',
      endpoints: {
        createSession: 'POST /api/sessions/create',
        sessions: 'GET /api/project/v1/sessions',
        templates: 'GET /api/project/v1/templates?organizationId=&phoneNumberId=&sessionId=',
        templateById: 'GET /api/project/v1/templates/:id',
        deleteTemplate: 'DELETE /api/project/v1/templates/:id',
        campaigns: 'GET /api/project/v1/campaigns',
        createCampaign: 'POST /api/project/v1/campaigns',
        campaignById: 'GET /api/project/v1/campaigns/:id',
        campaignExecute: 'POST /api/project/v1/campaigns/:id/send',
        campaignAnalytics: 'GET /api/project/v1/campaigns/:id/analytics',
        campaignAudience: 'GET /api/project/v1/campaigns/:id/audience',
        campaignSend: 'POST /api/project/v1/campaign/send',
        sendMessage: 'POST /api/project/v1/messages',
        listMessages: 'GET /api/project/v1/messages?chatId=CHAT_ID',
        mediaContent: 'GET /api/project/v1/media/content?sessionId=&mediaId= (binary; X-API-Key; same URL as mediaUrlAbsolute for Graph media ids in messages)',
        getMessage: 'GET /api/project/v1/messages/:messageId',
        sendText: 'POST /api/project/v1/messages/send-text',
        sendTemplate: 'POST /api/project/v1/messages/send-template',
        chats: 'GET /api/project/v1/chats?sessionId=SESSION_ID (&organizationId= optional; adds tags, tagNames, groups, managedContactId)',
        markChatRead: 'PATCH /api/project/v1/chats/read?chatId=CHAT_ID',
        messagingWindow: 'GET /api/project/v1/chats/messaging-window?chatId=CHAT_ID',
        chatsByPhone: 'GET /api/project/v1/chats/by-phone/:phone',
        tags: 'GET /api/project/v1/tags?organizationId=ORG_ID',
        cannedMessages: 'GET /api/project/v1/canned-messages (optional ?organizationId=; defaults from API key)',
        cannedMessageById: 'GET /api/project/v1/canned-messages/:id (optional ?organizationId=; resolved from API key if omitted)',
        createCannedMessage: 'POST /api/project/v1/canned-messages',
        updateCannedMessage: 'PATCH /api/project/v1/canned-messages/:id',
        deleteCannedMessage: 'DELETE /api/project/v1/canned-messages/:id',
        cannedMessageMedia: 'GET /api/project/v1/canned-messages/media?path=/uploads/ORG_ID/... (org from path; API key must access that org)',
        contacts: 'GET /api/project/v1/contacts',
        contactById: 'GET /api/project/v1/contacts/:id',
        contactByPhone: 'GET /api/project/v1/contacts/by-phone/:phone',
        createContact: 'POST /api/project/v1/contacts',
        updateContact: 'PATCH /api/project/v1/contacts/:id',
        webhooks: 'GET /api/project/v1/webhooks',
        webhookById: 'GET /api/project/v1/webhooks/:id',
        deleteWebhook: 'DELETE /api/project/v1/webhooks/:id',
        media: 'GET /api/project/v1/media/:mediaId?sessionId=...',
        subscription: 'GET /api/project/v1/subscription',
      },
      docs: '/docs/project-api',
    });
  });

  // GET /api/project/v1/subscription – return subscription status for the API key user (for debugging "Subscription is not active")
  app.get('/api/project/v1/subscription', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const { subscription } = await storage.getEffectiveActiveSubscription(userId);
      const plan = subscription ? await storage.getPlan(subscription.planId) : null;
      const canSendMessages = !!(subscription && plan && plan.isActive);
      return res.json({
        userId,
        subscription: subscription
          ? {
              id: subscription.id,
              status: subscription.status,
              currentPeriodStart: subscription.currentPeriodStart,
              currentPeriodEnd: subscription.currentPeriodEnd,
              planId: subscription.planId,
            }
          : null,
        plan: plan ? { id: plan.id, name: plan.name, isActive: plan.isActive } : null,
        canSendMessages,
        reason: !subscription
          ? 'No active subscription (none, or expired, or status not active)'
          : !plan
            ? 'Plan not found'
            : !plan.isActive
              ? 'Plan is inactive'
              : 'OK',
      });
    } catch (e: any) {
      console.error('[Project API] Subscription check error:', e);
      return res.status(500).json({ error: 'Failed to check subscription', message: e?.message });
    }
  });

  // GET /api/project/v1/campaigns – list templates as "campaigns" (Aisensy). Use ?type=broadcast for broadcast campaigns.
  app.get('/api/project/v1/campaigns', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = (req.query?.organizationId as string) || undefined;
      const phoneNumberId = (req.query?.phoneNumberId as string) || undefined;
      const type = (req.query?.type as string) || 'templates';
      if (type === 'broadcast') {
        const orgId = organizationId || (await storage.getOrganizationsByUser(userId))[0]?.id;
        if (!orgId) return res.status(400).json({ error: 'organizationId required for type=broadcast' });
        const broadcastCampaigns = await storage.getCampaignsByUser(userId, orgId);
        return res.json(broadcastCampaigns);
      }
      const templates = await storage.getMessageTemplatesByUser(userId, organizationId, phoneNumberId);
      const campaigns = (templates || []).filter((t: any) => t.status === 'APPROVED').map((t: any) => ({
        campaignName: t.name,
        templateId: t.templateId || t.id,
        language: t.language || 'en',
        status: t.status,
        category: t.category,
      }));
      res.json(campaigns);
    } catch (error: any) {
      console.error('[Project API] Error listing campaigns:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/project/v1/campaigns – create broadcast campaign
  app.post('/api/project/v1/campaigns', ...withAuthAndRateLimit, walletUsageSkip, checkUsageLimits('message'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = (req.body?.organizationId || req.query?.organizationId) as string || (await storage.getOrganizationsByUser(userId))[0]?.id;
      if (!organizationId) {
        return res.status(400).json({ error: 'organizationId is required' });
      }
      const { recipients, ...campaignData } = req.body || {};
      const processedData: any = {
        ...campaignData,
        userId,
        organizationId,
        templateId: campaignData.templateId,
        templateLanguage: campaignData.templateLanguage || 'en',
        templateParameters: campaignData.templateParameters,
        headerImageId: campaignData.headerImageId,
        headerImageUrl: campaignData.headerImageUrl,
        ...(Array.isArray(campaignData.carouselCardMediaUrls) && campaignData.carouselCardMediaUrls.length > 0
          ? { carouselCardMediaUrls: campaignData.carouselCardMediaUrls }
          : {}),
      };
      if (processedData.scheduledAt && typeof processedData.scheduledAt === 'string') {
        processedData.scheduledAt = new Date(processedData.scheduledAt);
      }
      if (!processedData.scheduledAt) {
        const now = new Date();
        now.setMinutes(now.getMinutes() + 2);
        processedData.scheduledAt = now;
        processedData.status = 'scheduled';
      } else if (processedData.scheduledAt instanceof Date) {
        const now = new Date();
        processedData.status = processedData.scheduledAt > now ? 'scheduled' : (processedData.status || 'draft');
      }
      const parsed = insertCampaignSchema.safeParse(processedData);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      }
      const campaign = await storage.createCampaign(parsed.data);
      if (recipients && Array.isArray(recipients) && recipients.length > 0) {
        const { inserted, skipped } = await storage.insertCampaignRecipientsBulk(
          campaign.id,
          userId,
          organizationId,
          recipients
        );
        await storage.updateCampaignStats(campaign.id, userId, organizationId, { totalRecipients: inserted });
        if (inserted === 0) {
          return res.status(400).json({
            message: "No valid recipients (check phone numbers).",
            skipped,
          });
        }
      }
      res.status(201).json(campaign);
    } catch (error: any) {
      console.error('[Project API] Error creating campaign:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/project/v1/campaigns/:id – campaign details
  app.get('/api/project/v1/campaigns/:id', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = (req.query?.organizationId as string) || (await storage.getOrganizationsByUser(userId))[0]?.id;
      if (!organizationId) {
        return res.status(400).json({ error: 'organizationId query param required' });
      }
      const campaign = await storage.getCampaign(req.params.id, userId, organizationId);
      if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
      res.json(campaign);
    } catch (error: any) {
      console.error('[Project API] Error getting campaign:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/project/v1/campaigns/:id/send – execute campaign
  app.post('/api/project/v1/campaigns/:id/send', ...withAuthAndRateLimit, walletUsageSkip, checkUsageLimits('message'), incrementUsage('message'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = (req.body?.organizationId || req.query?.organizationId) as string || (await storage.getOrganizationsByUser(userId))[0]?.id;
      if (!organizationId) {
        return res.status(400).json({ error: 'organizationId is required' });
      }
      const campaign = await storage.getCampaign(req.params.id, userId, organizationId);
      if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
      const wait =
        String(req.query?.wait || req.query?.sync || '').toLowerCase() === 'true' ||
        String(req.headers['x-campaign-wait'] || '').toLowerCase() === 'true';
      if (!wait) {
        void enqueueCampaignExecution(req.params.id, userId, organizationId)
          .then((r) =>
            console.log(`[Project API Campaign] Background finished ${req.params.id} sent=${r.sentCount}`)
          )
          .catch((err) => console.error(`[Project API Campaign] Background error ${req.params.id}:`, err));
        return res.status(202).json({
          accepted: true,
          campaignId: req.params.id,
          message:
            'Campaign send started in the background. Poll GET /api/project/v1/campaigns/:id/analytics for progress.',
        });
      }
      const result = await enqueueCampaignExecution(req.params.id, userId, organizationId);
      const recipients = await storage.getCampaignRecipients(req.params.id, userId, organizationId);
      res.json({
        success: result.success,
        sentCount: result.sentCount,
        failedCount: result.failedCount,
        errors: result.errors,
        totalRecipients: recipients.length,
      });
    } catch (error: any) {
      console.error('[Project API] Error sending campaign:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/project/v1/campaigns/:id/analytics
  app.get('/api/project/v1/campaigns/:id/analytics', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = (req.query?.organizationId as string) || (await storage.getOrganizationsByUser(userId))[0]?.id;
      if (!organizationId) {
        return res.status(400).json({ error: 'organizationId query param required' });
      }
      const campaign = await storage.getCampaign(req.params.id, userId, organizationId);
      if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
      const recipients = await storage.getCampaignRecipients(req.params.id, userId, organizationId);
      const statusCounts = { pending: 0, sent: 0, delivered: 0, read: 0, failed: 0 };
      for (const r of recipients) {
        statusCounts[r.status as keyof typeof statusCounts]++;
      }
      res.json({
        campaignId: campaign.id,
        campaignName: campaign.name,
        status: campaign.status,
        totalRecipients: campaign.totalRecipients,
        sentCount: campaign.sentCount,
        deliveredCount: campaign.deliveredCount,
        readCount: campaign.readCount,
        failedCount: campaign.failedCount,
        byStatus: statusCounts,
        startedAt: campaign.startedAt,
        completedAt: campaign.completedAt,
      });
    } catch (error: any) {
      console.error('[Project API] Error getting campaign analytics:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/project/v1/campaigns/:id/audience
  app.get('/api/project/v1/campaigns/:id/audience', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = (req.query?.organizationId as string) || (await storage.getOrganizationsByUser(userId))[0]?.id;
      if (!organizationId) {
        return res.status(400).json({ error: 'organizationId query param required' });
      }
      const campaign = await storage.getCampaign(req.params.id, userId, organizationId);
      if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
      const recipients = await storage.getCampaignRecipients(req.params.id, userId, organizationId);
      res.json({
        campaignId: campaign.id,
        total: recipients.length,
        recipients: recipients.map((r) => ({
          id: r.id,
          phoneNumber: r.phoneNumber,
          name: r.name,
          status: r.status,
          messageId: r.messageId,
          sentAt: r.sentAt,
          deliveredAt: r.deliveredAt,
          readAt: r.readAt,
          errorMessage: r.errorMessage,
        })),
      });
    } catch (error: any) {
      console.error('[Project API] Error getting campaign audience:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/project/v1/campaign/send – Aisensy-compatible: apiKey, campaignName, destination, userName, templateParams, etc.
  app.post('/api/project/v1/campaign/send', ...withAuthAndRateLimit, walletUsageSkip, checkUsageLimits('message'), incrementUsage('message'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const body = req.body || {};
      const apiKeyFromBody = body.apiKey;
      if (apiKeyFromBody && !req.headers['x-api-key']) {
        (req as any).headers = (req as any).headers || {};
        (req as any).headers['x-api-key'] = apiKeyFromBody;
      }
      const campaignName = body.campaignName || body.templateName;
      const destination = body.destination || body.to;
      const userName = body.userName || body.user_name || 'Contact';
      const source = body.source || 'api';
      const templateParams = Array.isArray(body.templateParams) ? body.templateParams : (body.template_params ? (Array.isArray(body.template_params) ? body.template_params : [body.template_params]) : []);
      const tags = Array.isArray(body.tags) ? body.tags : [];
      const attributes = body.attributes && typeof body.attributes === 'object' ? body.attributes : {};
      const organizationId = body.organizationId || req.query?.organizationId || null;
      let sessionId = body.sessionId;

      if (!campaignName || !destination) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'campaignName (template name) and destination (phone with country code) are required.',
        });
      }

      const to = String(destination).replace(/\D/g, '');
      if (!to.length) {
        return res.status(400).json({ error: 'Invalid destination phone number' });
      }

      const sessions = await storage.getSessionsByUser(userId);
      const officialSessions = sessions.filter((s: any) => s.connectionType === 'official');
      if (officialSessions.length === 0) {
        return res.status(400).json({
          error: 'No WhatsApp Business session',
          message: 'Connect a WhatsApp Business number in Connect/Integrations first.',
        });
      }
      if (!sessionId) {
        sessionId = officialSessions[0].sessionId;
      }
      const session = await storage.getSession(sessionId);
      if (!session || session.userId !== userId) {
        return res.status(404).json({ error: 'Session not found' });
      }
      if (session.connectionType !== 'official') {
        return res.status(400).json({
          error: 'Template campaigns require WhatsApp Business API',
          message: 'Use a session connected via WhatsApp Business.',
        });
      }

      const orgId = organizationId || (await storage.getOrganizationsByUser(userId))[0]?.id || null;
      if (orgId) {
        const contacts = await storage.getManagedContactsByUser(userId, orgId);
        const existing = contacts.find((c: any) => (String(c.phoneNumber || '').replace(/\D/g, '') === to));
        if (existing) {
          await storage.updateManagedContact(
            existing.id,
            userId,
            orgId,
            {
              name: userName,
              source: source,
              customFields: { ...(existing.customFields || {}), ...attributes },
              updatedAt: new Date(),
            },
            { skipAutomation: true }
          );
          if (tags.length) {
            const allTags = await storage.getContactTagsByUser(userId, orgId);
            for (const tagName of tags) {
              let tag = allTags.find((t: any) => (t.name || '').toLowerCase() === String(tagName).toLowerCase());
              if (!tag) {
                tag = await storage.createContactTag({ userId, organizationId: orgId, name: String(tagName) });
              }
              try {
                await storage.assignTagToContact(existing.id, tag.id, userId, orgId);
              } catch (_) {}
            }
          }
        } else {
          const newContact = await storage.createManagedContact(
            {
              userId,
              organizationId: orgId,
              name: userName,
              phoneNumber: destination,
              source: source,
              customFields: Object.keys(attributes).length ? attributes : undefined,
            },
            { skipAutomation: true }
          );
          if (tags.length) {
            const allTags = await storage.getContactTagsByUser(userId, orgId);
            for (const tagName of tags) {
              let tag = allTags.find((t: any) => (t.name || '').toLowerCase() === String(tagName).toLowerCase());
              if (!tag) {
                tag = await storage.createContactTag({ userId, organizationId: orgId, name: String(tagName) });
              }
              try {
                await storage.assignTagToContact(newContact.id, tag.id, userId, orgId);
              } catch (_) {}
            }
          }
        }
      }

      let isReady = businessAPIManager.isClientReady(sessionId);
      if (!isReady) {
        let accessToken: string | null = null;
        let phoneNumberId: string | null = null;
        let businessAccountId: string | null = null;
        try {
          const apiPhoneNumberId = session.deviceInfo?.apiPhoneNumberId;
          let integration: any = null;
          if (session.deviceInfo?.integrationId) {
            integration = await storage.getIntegration(session.deviceInfo.integrationId, userId);
          }
          if (!integration) {
            integration = await storage.getIntegrationByName('whatsapp-business', userId, orgId || undefined);
          }
          if (apiPhoneNumberId && !integration) {
            const allIntegrations = await storage.getIntegrationsByUser(userId, orgId || undefined);
            const whatsappIntegrations = allIntegrations.filter(
              (i: any) => i.name === 'whatsapp-business' && i.status === 'connected' && i.credentials
            );
            for (const int of whatsappIntegrations) {
              const creds = int.credentials as any;
              const token = creds?.access_token;
              if (!token) continue;
              try {
                const checkRes = await fetch(
                  `https://graph.facebook.com/v23.0/${apiPhoneNumberId}?fields=id&access_token=${encodeURIComponent(token)}`
                );
                if (checkRes.ok) {
                  integration = int;
                  break;
                }
              } catch (_) {
                continue;
              }
            }
          }
          if (integration?.status === 'connected' && integration.credentials) {
            const credentials = integration.credentials as any;
            accessToken = credentials.access_token;
            if (session.deviceInfo?.apiPhoneNumberId) phoneNumberId = session.deviceInfo.apiPhoneNumberId;
            if (session.deviceInfo?.businessAccountId) businessAccountId = session.deviceInfo.businessAccountId;
          }
          if (accessToken && phoneNumberId) {
            try {
              await businessAPIManager.restoreSession(sessionId, {
                phoneNumberId,
                accessToken,
                businessAccountId: businessAccountId ?? undefined,
              });
              isReady = businessAPIManager.isClientReady(sessionId);
            } catch (_) {
              isReady = businessAPIManager.isClientReady(sessionId);
            }
          }
        } catch (_) {}
        if (!isReady) {
          return res.status(400).json({
            error: 'WhatsApp Business API not ready',
            message: 'Reconnect the WhatsApp Business number in Integrations and try again.',
          });
        }
      }

      const params = templateParams.map((p: any) => (p != null ? String(p) : ''));
      const sessionPhoneNumberId = session.deviceInfo?.apiPhoneNumberId;
      let templateMetaForAuth: { category?: string; components?: any[] } | null = null;
      try {
        if (orgId) {
          const userTemplates = await storage.getMessageTemplatesByUser(userId, orgId, sessionPhoneNumberId);
          const tplRow = userTemplates.find(
            (t: any) =>
              (t.status === 'APPROVED' || String(t.status || '').toLowerCase() === 'approved') &&
              (t.name === campaignName || t.name?.toLowerCase() === String(campaignName).toLowerCase())
          );
          if (tplRow && String(tplRow.category || '').toUpperCase() === 'AUTHENTICATION') {
            templateMetaForAuth = { category: tplRow.category, components: tplRow.components };
          }
        }
      } catch (_) {}

      const result = await businessAPIManager.sendTemplateMessage(
        sessionId,
        to,
        campaignName,
        (body.languageCode || body.language_code || 'en'),
        params.length ? params : undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        templateMetaForAuth
      );
      res.json(result);
    } catch (error: any) {
      console.error('[Project API] Error campaign/send:', error);
      res.status(500).json({ error: error.message || 'Failed to send campaign message' });
    }
  });

  // GET /api/project/v1/contacts – list contacts (optional organizationId, tags filter)
  app.get('/api/project/v1/contacts', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = (req.query?.organizationId as string) || null;
      const tagNames = req.query?.tags ? (Array.isArray(req.query.tags) ? req.query.tags : [req.query.tags].filter(Boolean)) : [];
      const orgs = await storage.getOrganizationsByUser(userId);
      const orgId = organizationId || (orgs[0]?.id) || null;
      if (!orgId) {
        return res.json([]);
      }
      let contacts: any[] = [];
      if (tagNames.length) {
        const allTags = await storage.getContactTagsByUser(userId, orgId);
        const tagIds = tagNames.map((name: string) => allTags.find((t: any) => (t.name || '').toLowerCase() === String(name).toLowerCase())?.id).filter(Boolean);
        if (tagIds.length) {
          contacts = await storage.getManagedContactsByTags(userId, tagIds, orgId);
        } else {
          contacts = await storage.getManagedContactsByUser(userId, orgId);
        }
      } else {
        contacts = await storage.getManagedContactsByUser(userId, orgId);
      }
      res.json(contacts);
    } catch (error: any) {
      console.error('[Project API] Error listing contacts:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/project/v1/contacts – create or update contact (Aisensy: destination, userName, source, tags, attributes)
  app.post('/api/project/v1/contacts', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const body = req.body || {};
      const destination = body.destination || body.phoneNumber || body.phone;
      const userName = body.userName || body.user_name || body.name || 'Contact';
      const source = body.source || 'api';
      const tags = Array.isArray(body.tags) ? body.tags : [];
      const attributes = body.attributes && typeof body.attributes === 'object' ? body.attributes : {};
      const organizationId = body.organizationId || req.query?.organizationId || null;
      if (!destination) {
        return res.status(400).json({ error: 'destination (phone) is required' });
      }
      const phoneNorm = String(destination).replace(/\D/g, '');
      if (!phoneNorm.length) {
        return res.status(400).json({ error: 'Invalid destination phone number' });
      }
      const orgs = await storage.getOrganizationsByUser(userId);
      const orgId = organizationId || (orgs[0]?.id) || null;
      if (!orgId) {
        return res.status(400).json({ error: 'No organization. Create or join an organization first.' });
      }
      const contacts = await storage.getManagedContactsByUser(userId, orgId);
      const existing = contacts.find((c: any) => (String(c.phoneNumber || '').replace(/\D/g, '') === phoneNorm));
      if (existing) {
        const updatedContact = await storage.updateManagedContact(existing.id, userId, orgId, {
          name: userName,
          source: source,
          customFields: { ...(existing.customFields || {}), ...attributes },
          updatedAt: new Date(),
        });
        if (tags.length) {
          const allTags = await storage.getContactTagsByUser(userId, orgId);
          for (const tagName of tags) {
            let tag = allTags.find((t: any) => (t.name || '').toLowerCase() === String(tagName).toLowerCase());
            if (!tag) {
              tag = await storage.createContactTag({ userId, organizationId: orgId, name: String(tagName) });
            }
            try {
              await storage.assignTagToContact(existing.id, tag.id, userId, orgId);
            } catch (_) {}
          }
        }
        if (updatedContact) {
          triggerWebhooks(userId, 'contact.updated', { contact: updatedContact }).catch(() => {});
        }
        return res.json({ contact: updatedContact || existing, updated: true });
      }
      const quota = await assertPlanQuota({ userId, organizationId: orgId, kind: "contacts" });
      if (quota) return sendPlanQuotaDenial(res, quota);
      const newContact = await storage.createManagedContact({
        userId,
        organizationId: orgId,
        name: userName,
        phoneNumber: destination,
        source: source,
        customFields: Object.keys(attributes).length ? attributes : undefined,
      });
      if (tags.length) {
        const allTags = await storage.getContactTagsByUser(userId, orgId);
        for (const tagName of tags) {
          let tag = allTags.find((t: any) => (t.name || '').toLowerCase() === String(tagName).toLowerCase());
          if (!tag) {
            tag = await storage.createContactTag({ userId, organizationId: orgId, name: String(tagName) });
          }
          try {
            await storage.assignTagToContact(newContact.id, tag.id, userId, orgId);
          } catch (_) {}
        }
      }
      triggerWebhooks(userId, 'contact.created', { contact: newContact }).catch(() => {});
      res.status(201).json({ contact: newContact, created: true });
    } catch (error: any) {
      console.error('[Project API] Error creating/updating contact:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/project/v1/contacts/:id – get contact by id
  app.get('/api/project/v1/contacts/by-phone/:phone', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = (req.query?.organizationId as string) || null;
      const orgs = await storage.getOrganizationsByUser(userId);
      const orgId = organizationId || (orgs[0]?.id) || null;
      if (!orgId) return res.status(400).json({ error: 'No organization' });
      const phoneNorm = String(req.params.phone || '').replace(/\D/g, '');
      if (!phoneNorm.length) return res.status(400).json({ error: 'Invalid phone' });
      const contacts = await storage.getManagedContactsByUser(userId, orgId);
      const contact = contacts.find((c: any) => String(c.phoneNumber || '').replace(/\D/g, '') === phoneNorm);
      if (!contact) return res.status(404).json({ error: 'Contact not found' });
      res.json(contact);
    } catch (error: any) {
      console.error('[Project API] Error getting contact by phone:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/project/v1/contacts/:id', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = (req.query?.organizationId as string) || null;
      const orgs = await storage.getOrganizationsByUser(userId);
      const orgId = organizationId || (orgs[0]?.id) || null;
      if (!orgId) return res.status(400).json({ error: 'No organization' });
      const contact = await storage.getManagedContact(req.params.id, userId, orgId);
      if (!contact) return res.status(404).json({ error: 'Contact not found' });
      res.json(contact);
    } catch (error: any) {
      console.error('[Project API] Error getting contact:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /api/project/v1/contacts/:id – update contact
  app.patch('/api/project/v1/contacts/:id', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = (req.query?.organizationId as string) || (req.body?.organizationId as string) || null;
      const orgs = await storage.getOrganizationsByUser(userId);
      const orgId = organizationId || (orgs[0]?.id) || null;
      if (!orgId) return res.status(400).json({ error: 'No organization' });
      const existing = await storage.getManagedContact(req.params.id, userId, orgId);
      if (!existing) return res.status(404).json({ error: 'Contact not found' });
      const body = req.body || {};
      const tags = Array.isArray(body.tags) ? body.tags : undefined;
      const update: Record<string, unknown> = {};
      if (body.userName !== undefined || body.user_name !== undefined || body.name !== undefined) {
        update.name = body.userName ?? body.user_name ?? body.name ?? existing.name;
      }
      if (body.source !== undefined) update.source = body.source;
      if (body.attributes !== undefined && typeof body.attributes === 'object') {
        update.customFields = { ...(existing.customFields || {}), ...body.attributes };
      }
      const updated = await storage.updateManagedContact(req.params.id, userId, orgId, update);
      if (tags !== undefined && tags.length) {
        const allTags = await storage.getContactTagsByUser(userId, orgId);
        for (const tagName of tags) {
          let tag = allTags.find((t: any) => (t.name || '').toLowerCase() === String(tagName).toLowerCase());
          if (!tag) tag = await storage.createContactTag({ userId, organizationId: orgId, name: String(tagName) });
          try { await storage.assignTagToContact(existing.id, tag.id, userId, orgId); } catch (_) {}
        }
      }
      if (updated) {
        triggerWebhooks(userId, 'contact.updated', { contact: updated }).catch(() => {});
      }
      res.json(updated);
    } catch (error: any) {
      console.error('[Project API] Error updating contact:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/project/v1/webhooks – list webhooks for the project (existing webhooks for user/org)
  app.get('/api/project/v1/webhooks', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = (req.query?.organizationId as string) || null;
      const orgs = await storage.getOrganizationsByUser(userId);
      const orgId = organizationId || (orgs[0]?.id) || null;
      const webhooks = orgId ? await storage.getWebhooksByUser(userId, orgId) : [];
      res.json(webhooks);
    } catch (error: any) {
      console.error('[Project API] Error listing webhooks:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/project/v1/webhooks/:id – get webhook details
  app.get('/api/project/v1/webhooks/:id', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = (req.query?.organizationId as string) || null;
      const orgs = await storage.getOrganizationsByUser(userId);
      const orgId = organizationId || (orgs[0]?.id) || null;
      const webhook = await storage.getWebhook(req.params.id);
      if (!webhook || webhook.userId !== userId || (orgId && webhook.organizationId !== orgId)) {
        return res.status(404).json({ error: 'Webhook not found' });
      }
      res.json(webhook);
    } catch (error: any) {
      console.error('[Project API] Error getting webhook:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/project/v1/webhooks/:id – delete webhook subscription
  app.delete('/api/project/v1/webhooks/:id', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = (req.query?.organizationId as string) || null;
      const orgs = await storage.getOrganizationsByUser(userId);
      const orgId = organizationId || (orgs[0]?.id) || null;
      const webhook = await storage.getWebhook(req.params.id);
      if (!webhook || webhook.userId !== userId || (orgId && webhook.organizationId !== orgId)) {
        return res.status(404).json({ error: 'Webhook not found' });
      }
      await storage.deleteWebhook(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Project API] Error deleting webhook:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/project/v1/sessions', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const sessions = await storage.getSessionsByUser(userId);
      res.json(sessions);
    } catch (error: any) {
      console.error('[Project API] Error listing sessions:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/project/v1/chats?sessionId= – list conversations for a WhatsApp session (same sessionId as GET /sessions)
  app.get('/api/project/v1/chats', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const sessionId = typeof req.query?.sessionId === 'string' ? req.query.sessionId.trim() : '';
      if (!sessionId) {
        return res.status(400).json({
          error: 'sessionId is required',
          message: 'Pass sessionId as a query parameter, e.g. GET /api/project/v1/chats?sessionId=wb_xxx',
        });
      }
      const session = await storage.getSession(sessionId);
      if (!session || session.userId !== userId) {
        return res.status(404).json({ error: 'Session not found' });
      }
      const chats = await storage.getChatsBySession(sessionId);
      const orgFromQuery =
        typeof req.query?.organizationId === 'string' && req.query.organizationId.trim()
          ? req.query.organizationId.trim()
          : null;
      const organizationId = orgFromQuery || (await storage.getOrganizationsByUser(userId))[0]?.id || null;
      const enriched = await enrichProjectApiChatsWithTagsAndGroups(chats, userId, organizationId);
      res.json(enriched);
    } catch (error: any) {
      console.error('[Project API] Error listing chats:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/project/v1/chats/by-phone/:phone – get chat(s) and messages for a phone number
  // Phone can be with or without country code (e.g. 919876543210, 9876543210, +919876543210)
  app.get('/api/project/v1/chats/by-phone/:phone', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const phoneParam = req.params.phone;
      const limitParam = req.query.limit;
      const limit = limitParam != null ? Math.min(500, Math.max(1, parseInt(String(limitParam), 10) || 200)) : 200;

      if (!phoneParam || typeof phoneParam !== 'string') {
        return res.status(400).json({ error: 'Phone number is required' });
      }

      const normalizedInput = phoneParam.replace(/^\+/, '').replace(/\D/g, '');
      if (normalizedInput.length < 10) {
        return res.status(400).json({ error: 'Invalid phone number (min 10 digits)' });
      }

      const userSessions = await storage.getSessionsByUser(userId);
      const results: Array<{ chat: Chat; sessionId: string; messages: Message[] }> = [];

      for (const session of userSessions) {
        const chats = await storage.getChatsBySession(session.sessionId);
        for (const chat of chats) {
          if (chat.isGroup) continue;
          const normalizedChat = chat.contactNumber.replace(/^\+/, '').replace(/@c\.us$/, '').replace(/@g\.us$/, '').replace(/\D/g, '');
          const match = normalizedChat === normalizedInput || normalizedChat.endsWith(normalizedInput) || normalizedInput.endsWith(normalizedChat);
          if (match) {
            const msgs = await storage.getMessagesByChat(chat.id, limit);
            const filtered = msgs.filter((m: any) => {
              const noBody = !m.body || !String(m.body).trim();
              if (m.type === 'reaction' && noBody) return false;
              if (m.type === 'text' && noBody && !m.mediaUrl) return false;
              return true;
            });
            results.push({
              chat,
              sessionId: session.sessionId,
              messages: filtered.map((m) =>
                withProjectApiMessageMediaAbsolute(req, m as Record<string, unknown>)
              ) as Message[],
            });
          }
        }
      }

      if (results.length === 0) {
        return res.status(404).json({
          error: 'No chat found',
          message: `No chat found for phone number: ${phoneParam}`,
        });
      }

      res.json({
        phoneNumber: phoneParam,
        chats: results,
      });
    } catch (error: any) {
      console.error('[Project API] Error getting chats by phone:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /api/project/v1/chats/read?chatId= – same as dashboard PATCH /api/chats/:chatId/read (clear unread, mark incoming messages read)
  app.patch('/api/project/v1/chats/read', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const fromQuery = typeof req.query?.chatId === 'string' ? req.query.chatId.trim() : '';
      const fromBody =
        req.body && typeof req.body === 'object' && typeof (req.body as { chatId?: string }).chatId === 'string'
          ? String((req.body as { chatId: string }).chatId).trim()
          : '';
      const chatId = fromQuery || fromBody;
      if (!chatId) {
        return res.status(400).json({
          error: 'chatId is required',
          message: 'Use PATCH /api/project/v1/chats/read?chatId=CHAT_ID or JSON body { "chatId": "..." }',
        });
      }

      const chat = await storage.getChat(chatId);
      if (!chat) {
        return res.status(404).json({ error: 'Chat not found' });
      }
      const session = await storage.getSession(chat.sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Chat not found' });
      }

      let canAccess = session.userId === userId;
      if (!canAccess) {
        const orgs = await storage.getOrganizationsByUser(userId);
        for (const org of orgs) {
          const orgSessions = await storage.getSessionsByOrganization(org.id);
          if (orgSessions.some((s: { sessionId: string }) => s.sessionId === chat.sessionId)) {
            canAccess = true;
            break;
          }
        }
      }
      if (!canAccess) {
        return res.status(404).json({ error: 'Chat not found' });
      }

      await storage.updateChat(chatId, { unreadCount: 0 });
      const messagesMarkedRead = await storage.markInboundMessagesReadInChat(chatId);
      broadcastToUser(userId, 'chat_updated', { chatId, unreadCount: 0 });
      res.json({ success: true, chatId, messagesMarkedRead });
    } catch (error: any) {
      console.error('[Project API] Error marking chat read:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/project/v1/chats/messaging-window?chatId= – Cloud API 24h customer care window (same rule as /chat for official sessions)
  app.get('/api/project/v1/chats/messaging-window', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const chatId = typeof req.query?.chatId === 'string' ? req.query.chatId.trim() : '';
      if (!chatId) {
        return res.status(400).json({
          error: 'chatId is required',
          message: 'Use GET /api/project/v1/chats/messaging-window?chatId=CHAT_UUID',
        });
      }

      const chat = await storage.getChat(chatId);
      if (!chat) {
        return res.status(404).json({ error: 'Chat not found' });
      }
      const session = await storage.getSession(chat.sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Chat not found' });
      }
      let canAccess = session.userId === userId;
      if (!canAccess) {
        const orgs = await storage.getOrganizationsByUser(userId);
        for (const org of orgs) {
          const orgSessions = await storage.getSessionsByOrganization(org.id);
          if (orgSessions.some((s: { sessionId: string }) => s.sessionId === chat.sessionId)) {
            canAccess = true;
            break;
          }
        }
      }
      if (!canAccess) {
        return res.status(404).json({ error: 'Chat not found' });
      }

      const connectionType = session.connectionType === 'official' ? 'official' : 'unofficial';
      const lastInboundAt = await storage.getLatestInboundMessageTimestamp(chatId);
      const now = Date.now();
      const WINDOW_MS = 24 * 60 * 60 * 1000;

      if (connectionType !== 'official') {
        return res.json({
          chatId,
          sessionId: session.sessionId,
          connectionType,
          customerCareWindow: {
            applies: false,
            withinWindow: true,
            lastInboundMessageAt: lastInboundAt ? lastInboundAt.toISOString() : null,
            windowExpiresAt: null,
            secondsRemaining: null,
          },
        });
      }

      if (!lastInboundAt) {
        return res.json({
          chatId,
          sessionId: session.sessionId,
          connectionType,
          customerCareWindow: {
            applies: true,
            withinWindow: false,
            lastInboundMessageAt: null,
            windowExpiresAt: null,
            secondsRemaining: null,
          },
        });
      }

      const lastMs = lastInboundAt.getTime();
      const msSince = now - lastMs;
      const withinWindow = msSince <= WINDOW_MS;
      const windowExpiresAt = new Date(lastMs + WINDOW_MS);
      const secondsRemaining = withinWindow
        ? Math.max(0, Math.floor((windowExpiresAt.getTime() - now) / 1000))
        : null;

      return res.json({
        chatId,
        sessionId: session.sessionId,
        connectionType,
        customerCareWindow: {
          applies: true,
          withinWindow,
          lastInboundMessageAt: lastInboundAt.toISOString(),
          windowExpiresAt: windowExpiresAt.toISOString(),
          secondsRemaining,
        },
      });
    } catch (error: any) {
      console.error('[Project API] Error getting messaging window:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/project/v1/tags?organizationId= – contact tags for an organization (optional org; defaults to first org for this user)
  app.get('/api/project/v1/tags', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgs = await storage.getOrganizationsByUser(userId);
      const queryOrg = typeof req.query.organizationId === 'string' ? req.query.organizationId.trim() : '';
      const orgId = queryOrg || orgs[0]?.id || null;
      if (queryOrg && !orgs.some((o: { id: string }) => o.id === queryOrg)) {
        return res.status(403).json({ error: 'organizationId is not accessible for this API key' });
      }
      if (!orgId) {
        return res.json([]);
      }
      const tags = await storage.getContactTagsByOrganization(orgId);
      res.json(tags);
    } catch (error: any) {
      console.error('[Project API] Error listing tags:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/project/v1/canned-messages/media?path= – stream canned image from /uploads/ORG_ID/... (org inferred from path; API key must belong to that org)
  app.get('/api/project/v1/canned-messages/media', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgs = await storage.getOrganizationsByUser(userId);
      const rawPath = (req.query.path as string || '').trim();
      if (!rawPath || !rawPath.startsWith('/uploads/')) {
        return res.status(400).json({ error: 'path must start with /uploads/' });
      }
      const afterUploads = rawPath.replace(/^\/?uploads\/?/i, '').replace(/\\/g, '/');
      if (!afterUploads || afterUploads.includes('..')) {
        return res.status(400).json({ error: 'Invalid path' });
      }
      const pathSegments = afterUploads.split('/').filter(Boolean);
      if (pathSegments.length < 2) {
        return res.status(400).json({ error: 'Invalid path' });
      }
      const pathOrgId = pathSegments[0];
      const queryOrg = typeof req.query.organizationId === 'string' ? req.query.organizationId.trim() : '';
      if (queryOrg && queryOrg !== pathOrgId) {
        return res.status(400).json({
          error: 'organizationId must match the first path segment under /uploads/ (your organization id)',
        });
      }
      if (queryOrg && !orgs.some((o: { id: string }) => o.id === queryOrg)) {
        return res.status(403).json({ error: 'organizationId is not accessible for this API key' });
      }
      if (!orgs.some((o: { id: string }) => o.id === pathOrgId)) {
        return res.status(403).json({ error: 'Upload path is not under an organization this API key can access' });
      }
      const served = await streamUploadToResponse(rawPath, res);
      if (!served) {
        return res.status(404).json({ error: 'File not found' });
      }
    } catch (err: any) {
      console.error('[Project API] Canned message media:', err);
      res.status(500).json({ error: err.message || 'Failed to load file' });
    }
  });

  // GET /api/project/v1/canned-messages – list canned templates (org from API key: first org if ?organizationId omitted)
  app.get('/api/project/v1/canned-messages', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgs = await storage.getOrganizationsByUser(userId);
      const queryOrg = typeof req.query.organizationId === 'string' ? req.query.organizationId.trim() : '';
      const orgId = queryOrg || orgs[0]?.id || null;
      if (queryOrg && !orgs.some((o: { id: string }) => o.id === queryOrg)) {
        return res.status(403).json({ error: 'organizationId is not accessible for this API key' });
      }
      if (!orgId) {
        return res.json([]);
      }
      const list = await storage.getCannedMessagesByOrganization(orgId);
      res.json(list.map((row) => toProjectApiCannedRow(req, row)));
    } catch (error: any) {
      console.error('[Project API] Error listing canned messages:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/project/v1/canned-messages – create (org from API key if organizationId omitted: first org of the key user)
  app.post('/api/project/v1/canned-messages', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgs = await storage.getOrganizationsByUser(userId);
      const body = req.body || {};
      const bodyOrg = typeof body.organizationId === 'string' ? body.organizationId.trim() : '';
      const queryOrg = typeof req.query.organizationId === 'string' ? req.query.organizationId.trim() : '';
      const chosenOrg = bodyOrg || queryOrg || '';
      const orgId = chosenOrg || orgs[0]?.id || null;
      if (chosenOrg && !orgs.some((o: { id: string }) => o.id === chosenOrg)) {
        return res.status(403).json({ error: 'organizationId is not accessible for this API key' });
      }
      if (!orgId) {
        return res.status(400).json({ error: 'No organization. Pass organizationId in body or query, or join an organization first.' });
      }
      const parsed = insertCannedMessageSchema.safeParse({ ...body, organizationId: orgId, userId });
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid data', errors: parsed.error.errors });
      }
      const item = await storage.createCannedMessage(parsed.data);
      res.status(201).json(toProjectApiCannedRow(req, item));
    } catch (error: any) {
      console.error('[Project API] Error creating canned message:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/project/v1/canned-messages/:id – optional ?organizationId=; if omitted, org is inferred from API key (any org that owns this message)
  app.get('/api/project/v1/canned-messages/:id', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const queryOrg = typeof req.query.organizationId === 'string' ? req.query.organizationId.trim() : '';
      const resolved = await getProjectApiCannedMessageForUser(userId, req.params.id, queryOrg || undefined);
      if (!resolved) return res.status(404).json({ error: 'Canned message not found' });
      res.json(toProjectApiCannedRow(req, resolved.row));
    } catch (error: any) {
      console.error('[Project API] Error getting canned message:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /api/project/v1/canned-messages/:id – optional organizationId; if omitted, resolved via API key (owner org of this message)
  app.patch('/api/project/v1/canned-messages/:id', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const body = req.body || {};
      const explicitOrg =
        (req.query?.organizationId as string)?.trim() ||
        (typeof body.organizationId === 'string' ? body.organizationId.trim() : '') ||
        undefined;
      const resolved = await getProjectApiCannedMessageForUser(userId, req.params.id, explicitOrg);
      if (!resolved) return res.status(404).json({ error: 'Canned message not found' });
      const { organizationId: _o, userId: _u, id: _i, ...rest } = body;
      const allowed = ['name', 'type', 'text', 'imageUrl', 'fileName', 'favourite'] as const;
      const update: Record<string, unknown> = {};
      for (const key of allowed) {
        if (rest[key] !== undefined) update[key] = rest[key];
      }
      const item = await storage.updateCannedMessageByOrganization(req.params.id, resolved.orgId, update as any);
      if (!item) return res.status(404).json({ error: 'Canned message not found' });
      res.json(toProjectApiCannedRow(req, item));
    } catch (error: any) {
      console.error('[Project API] Error updating canned message:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/project/v1/canned-messages/:id – optional organizationId; if omitted, resolved via API key
  app.delete('/api/project/v1/canned-messages/:id', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const queryOrg = typeof req.query.organizationId === 'string' ? req.query.organizationId.trim() : '';
      const bodyOrg = typeof req.body?.organizationId === 'string' ? req.body.organizationId.trim() : '';
      const explicitOrg = queryOrg || bodyOrg || undefined;
      const resolved = await getProjectApiCannedMessageForUser(userId, req.params.id, explicitOrg);
      if (!resolved) return res.status(404).json({ error: 'Canned message not found' });
      await storage.deleteCannedMessageByOrganization(req.params.id, resolved.orgId);
      res.json({ message: 'Canned message deleted' });
    } catch (error: any) {
      console.error('[Project API] Error deleting canned message:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/project/v1/templates', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId =
        typeof req.query?.organizationId === 'string' && req.query.organizationId.trim()
          ? req.query.organizationId.trim()
          : undefined;
      let phoneNumberId =
        typeof req.query?.phoneNumberId === 'string' && req.query.phoneNumberId.trim()
          ? req.query.phoneNumberId.trim()
          : undefined;
      const sessionId =
        typeof req.query?.sessionId === 'string' && req.query.sessionId.trim()
          ? req.query.sessionId.trim()
          : '';

      if (sessionId) {
        const session = await storage.getSession(sessionId);
        if (!session) {
          return res.status(404).json({ error: 'Session not found' });
        }
        let canAccess = session.userId === userId;
        if (!canAccess) {
          const orgs = await storage.getOrganizationsByUser(userId);
          for (const org of orgs) {
            const orgSessions = await storage.getSessionsByOrganization(org.id);
            if (orgSessions.some((s: { sessionId: string }) => s.sessionId === sessionId)) {
              canAccess = true;
              break;
            }
          }
        }
        if (!canAccess) {
          return res.status(404).json({ error: 'Session not found' });
        }
        const fromSession = (session.deviceInfo as { apiPhoneNumberId?: string } | undefined)?.apiPhoneNumberId;
        if (phoneNumberId && fromSession && phoneNumberId !== fromSession) {
          return res.status(400).json({
            error: 'phoneNumberId does not match session',
            message: 'Remove phoneNumberId or sessionId, or pass only one consistent source.',
          });
        }
        if (fromSession) {
          phoneNumberId = phoneNumberId || fromSession;
        }
      }

      const templates = await storage.getMessageTemplatesByUser(userId, organizationId, phoneNumberId);
      res.json(templates);
    } catch (error: any) {
      console.error('[Project API] Error listing templates:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/project/v1/templates/:id – get template by id
  app.get('/api/project/v1/templates/:id', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const template = await storage.getMessageTemplate(req.params.id, userId);
      if (!template) return res.status(404).json({ error: 'Template not found' });
      res.json(template);
    } catch (error: any) {
      console.error('[Project API] Error getting template:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/project/v1/templates/:id – delete template (removes from local sync; Meta templates managed in Business Suite)
  app.delete('/api/project/v1/templates/:id', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const template = await storage.getMessageTemplate(req.params.id, userId);
      if (!template) return res.status(404).json({ error: 'Template not found' });
      await storage.deleteMessageTemplate(req.params.id, userId);
      res.json({ success: true, message: 'Template removed from local sync' });
    } catch (error: any) {
      console.error('[Project API] Error deleting template:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/project/v1/messages – unified send (AiSensy-style) – supports text, image, video, audio, document, template
  app.post('/api/project/v1/messages', ...withAuthAndRateLimit, walletUsageSkip, checkUsageLimits('message'), incrementUsage('message'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.query?.organizationId || req.body?.organizationId || null;
      const body = req.body || {};
      const { sessionId, to, type } = body;

      if (!sessionId || !to || !type) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'sessionId, to, and type are required. Supported types: text, image, video, audio, document, template.',
        });
      }

      const session = await storage.getSession(sessionId);
      if (!session || session.userId !== userId) {
        return res.status(404).json({ error: 'Session not found' });
      }

      if (session.connectionType !== 'official') {
        return res.status(400).json({
          error: 'Unified messages require WhatsApp Business API',
          message: 'Use a session connected via WhatsApp Business (official) for this endpoint.',
        });
      }

      const manager = await getWhatsAppManager(sessionId);
      let isReady = manager.isClientReady(sessionId);
      if (!isReady) {
        let accessToken: string | null = null;
        let phoneNumberId: string | null = null;
        let businessAccountId: string | null = null;
        try {
          const apiPhoneNumberId = session.deviceInfo?.apiPhoneNumberId;
          let integration: any = null;
          if (session.deviceInfo?.integrationId) {
            integration = await storage.getIntegration(session.deviceInfo.integrationId, userId);
          }
          if (!integration) {
            integration = await storage.getIntegrationByName('whatsapp-business', userId, organizationId || undefined);
          }
          if (apiPhoneNumberId && !integration) {
            const allIntegrations = await storage.getIntegrationsByUser(userId, organizationId || undefined);
            const whatsappIntegrations = allIntegrations.filter(
              (i: any) => i.name === 'whatsapp-business' && i.status === 'connected' && i.credentials
            );
            for (const int of whatsappIntegrations) {
              const creds = int.credentials as any;
              const token = creds?.access_token;
              if (!token) continue;
              try {
                const checkRes = await fetch(
                  `https://graph.facebook.com/v23.0/${apiPhoneNumberId}?fields=id&access_token=${encodeURIComponent(token)}`
                );
                if (checkRes.ok) {
                  integration = int;
                  break;
                }
              } catch (_) {
                continue;
              }
            }
          }
          if (integration?.status === 'connected' && integration.credentials) {
            const credentials = integration.credentials as any;
            accessToken = credentials.access_token;
            if (session.deviceInfo?.apiPhoneNumberId) phoneNumberId = session.deviceInfo.apiPhoneNumberId;
            if (session.deviceInfo?.businessAccountId) businessAccountId = session.deviceInfo.businessAccountId;
          }
          if (!accessToken) {
            const settings = await storage.getUserSettings(userId);
            if (settings?.whatsappBusinessCredentials?.phoneNumberId && settings.whatsappBusinessCredentials.accessToken) {
              accessToken = settings.whatsappBusinessCredentials.accessToken;
              phoneNumberId = settings.whatsappBusinessCredentials.phoneNumberId;
              businessAccountId = settings.whatsappBusinessCredentials.businessAccountId || null;
            }
          }
          if (accessToken && phoneNumberId) {
            try {
              await businessAPIManager.restoreSession(sessionId, {
                phoneNumberId,
                accessToken,
                businessAccountId: businessAccountId ?? undefined,
              });
              isReady = manager.isClientReady(sessionId);
            } catch (_) {
              isReady = manager.isClientReady(sessionId);
            }
          }
        } catch (_) {}
        if (!isReady) {
          return res.status(400).json({
            error: 'WhatsApp Business API not ready',
            message: 'Reconnect the WhatsApp Business number in Integrations and try again.',
          });
        }
      }

      let result: any;

      switch (type) {
        case 'text': {
          const textBody = body.text?.body ?? body.message;
          if (!textBody) {
            return res.status(400).json({ error: 'For type "text", text.body or message is required' });
          }
          result = await businessAPIManager.sendTextMessage(sessionId, to, textBody);
          break;
        }
        case 'image':
        case 'video':
        case 'audio':
        case 'document': {
          const media = body[type] || body.image || body.video || body.audio || body.document;
          const link = media?.link;
          const id = media?.id;
          if (!link && !id) {
            return res.status(400).json({
              error: `For type "${type}", ${type}.link or ${type}.id is required`,
            });
          }
          result = await businessAPIManager.sendMediaByLinkOrId(sessionId, to, {
            type,
            link,
            id,
            caption: media?.caption,
            filename: media?.filename,
          });
          break;
        }
        case 'template': {
          const tmpl = body.template || {};
          const templateName = tmpl.name ?? body.templateName;
          const languageCode = tmpl.language?.code ?? body.languageCode ?? tmpl.language ?? 'en';
          const components = tmpl.components ?? body.components ?? [];
          if (!templateName) {
            return res.status(400).json({ error: 'For type "template", template.name or templateName is required' });
          }
          // Resolve header media from ID or URL (same as send-text/template)
          let headerImageId: string | undefined = tmpl.headerImageId ?? body.headerImageId;
          let headerVideoId: string | undefined = tmpl.headerVideoId ?? body.headerVideoId;
          let headerDocumentId: string | undefined = tmpl.headerDocumentId ?? body.headerDocumentId;
          const headerImageUrl = tmpl.headerImageUrl ?? body.headerImageUrl;
          const headerVideoUrl = tmpl.headerVideoUrl ?? body.headerVideoUrl;
          const headerDocumentUrl = tmpl.headerDocumentUrl ?? body.headerDocumentUrl;
          let headerDocumentFilename: string | undefined =
            tmpl.headerDocumentFilename ?? body.headerDocumentFilename ?? body.document?.filename;
          if (!headerImageId && headerImageUrl) {
            try {
              const creds = businessAPIManager['credentials'].get(sessionId);
              if (!creds) throw new Error('Business API credentials not available');
              const businessAccountId = session?.deviceInfo?.wabaId || creds.businessAccountId;
              let buf: Buffer; let fn: string;
              if (headerImageUrl.startsWith('/uploads/')) {
                let decodedPath = headerImageUrl;
                try { decodedPath = decodeURIComponent(headerImageUrl); } catch {}
                const p = path.join(process.cwd(), decodedPath);
                if (!fs.existsSync(p)) throw new Error(`Image file not found: ${decodedPath}`);
                buf = fs.readFileSync(p); fn = path.basename(p);
              } else if (headerImageUrl.startsWith('http://') || headerImageUrl.startsWith('https://')) {
                // Check if URL points to our server's /uploads/ folder
                let localPath: string | null = null;
                try {
                  const url = new URL(headerImageUrl);
                  if (url.pathname.startsWith('/uploads/')) {
                    localPath = url.pathname;
                  }
                } catch {}
                if (localPath) {
                  let decodedPath = localPath;
                  try { decodedPath = decodeURIComponent(localPath); } catch {}
                  const p = path.join(process.cwd(), decodedPath);
                  if (fs.existsSync(p)) {
                    buf = fs.readFileSync(p); fn = path.basename(p);
                  } else {
                    const r = await fetch(headerImageUrl);
                    if (!r.ok) throw new Error(`Failed to fetch image: ${headerImageUrl}`);
                    buf = Buffer.from(await r.arrayBuffer()); fn = headerImageUrl.split('/').pop() || 'image.jpg';
                  }
                } else {
                  const r = await fetch(headerImageUrl);
                  if (!r.ok) throw new Error(`Failed to fetch image: ${headerImageUrl}`);
                  buf = Buffer.from(await r.arrayBuffer()); fn = headerImageUrl.split('/').pop() || 'image.jpg';
                }
              } else throw new Error(`Invalid image URL: ${headerImageUrl}`);
              const up = await businessAPIManager.uploadMediaWithCredentials(
                { phoneNumberId: creds.phoneNumberId, accessToken: creds.accessToken, businessAccountId },
                buf, fn, 'IMAGE', false
              );
              headerImageId = up.id;
            } catch (e: any) {
              return res.status(400).json({ error: 'Failed to upload header image', message: e.message });
            }
          }
          if (!headerVideoId && headerVideoUrl) {
            try {
              const creds = businessAPIManager['credentials'].get(sessionId);
              if (!creds) throw new Error('Business API credentials not available');
              const businessAccountId = session?.deviceInfo?.wabaId || creds.businessAccountId;
              let buf: Buffer; let fn: string;
              if (headerVideoUrl.startsWith('/uploads/')) {
                let decodedPath = headerVideoUrl;
                try { decodedPath = decodeURIComponent(headerVideoUrl); } catch {}
                const p = path.join(process.cwd(), decodedPath);
                if (!fs.existsSync(p)) throw new Error(`Video file not found: ${decodedPath}`);
                buf = fs.readFileSync(p); fn = path.basename(p);
              } else if (headerVideoUrl.startsWith('http://') || headerVideoUrl.startsWith('https://')) {
                let localPath: string | null = null;
                try {
                  const url = new URL(headerVideoUrl);
                  if (url.pathname.startsWith('/uploads/')) {
                    localPath = url.pathname;
                  }
                } catch {}
                if (localPath) {
                  let decodedPath = localPath;
                  try { decodedPath = decodeURIComponent(localPath); } catch {}
                  const p = path.join(process.cwd(), decodedPath);
                  if (fs.existsSync(p)) {
                    buf = fs.readFileSync(p); fn = path.basename(p);
                  } else {
                    const r = await fetch(headerVideoUrl);
                    if (!r.ok) throw new Error(`Failed to fetch video: ${headerVideoUrl}`);
                    buf = Buffer.from(await r.arrayBuffer()); fn = headerVideoUrl.split('/').pop() || 'video.mp4';
                  }
                } else {
                  const r = await fetch(headerVideoUrl);
                  if (!r.ok) throw new Error(`Failed to fetch video: ${headerVideoUrl}`);
                  buf = Buffer.from(await r.arrayBuffer()); fn = headerVideoUrl.split('/').pop() || 'video.mp4';
                }
              } else throw new Error(`Invalid video URL: ${headerVideoUrl}`);
              const up = await businessAPIManager.uploadMediaWithCredentials(
                { phoneNumberId: creds.phoneNumberId, accessToken: creds.accessToken, businessAccountId },
                buf, fn, 'VIDEO', false
              );
              headerVideoId = up.id;
            } catch (e: any) {
              return res.status(400).json({ error: 'Failed to upload header video', message: e.message });
            }
          }
          if (!headerDocumentId && headerDocumentUrl) {
            try {
              const creds = businessAPIManager['credentials'].get(sessionId);
              if (!creds) throw new Error('Business API credentials not available');
              const businessAccountId = session?.deviceInfo?.wabaId || creds.businessAccountId;
              let buf: Buffer; let fn: string;
              if (headerDocumentUrl.startsWith('/uploads/')) {
                let decodedPath = headerDocumentUrl;
                try { decodedPath = decodeURIComponent(headerDocumentUrl); } catch {}
                const p = path.join(process.cwd(), decodedPath);
                if (!fs.existsSync(p)) throw new Error(`Document file not found: ${decodedPath}`);
                buf = fs.readFileSync(p); fn = path.basename(p);
              } else if (headerDocumentUrl.startsWith('http://') || headerDocumentUrl.startsWith('https://')) {
                let localPath: string | null = null;
                try {
                  const url = new URL(headerDocumentUrl);
                  if (url.pathname.startsWith('/uploads/')) {
                    localPath = url.pathname;
                  }
                } catch {}
                if (localPath) {
                  let decodedPath = localPath;
                  try { decodedPath = decodeURIComponent(localPath); } catch {}
                  const p = path.join(process.cwd(), decodedPath);
                  if (fs.existsSync(p)) {
                    buf = fs.readFileSync(p); fn = path.basename(p);
                  } else {
                    const r = await fetch(headerDocumentUrl);
                    if (!r.ok) throw new Error(`Failed to fetch document: ${headerDocumentUrl}`);
                    buf = Buffer.from(await r.arrayBuffer()); fn = headerDocumentUrl.split('/').pop() || 'document.pdf';
                  }
                } else {
                  const r = await fetch(headerDocumentUrl);
                  if (!r.ok) throw new Error(`Failed to fetch document: ${headerDocumentUrl}`);
                  buf = Buffer.from(await r.arrayBuffer()); fn = headerDocumentUrl.split('/').pop() || 'document.pdf';
                }
              } else throw new Error(`Invalid document URL: ${headerDocumentUrl}`);
              const up = await businessAPIManager.uploadMediaWithCredentials(
                { phoneNumberId: creds.phoneNumberId, accessToken: creds.accessToken, businessAccountId },
                buf, fn, 'DOCUMENT', false
              );
              headerDocumentId = up.id;
              if (!headerDocumentFilename) headerDocumentFilename = fn;
            } catch (e: any) {
              return res.status(400).json({ error: 'Failed to upload header document', message: e.message });
            }
          }
          if (!headerDocumentFilename && headerDocumentUrl) {
            headerDocumentFilename = resolveWhatsAppDocumentFilename(undefined, headerDocumentUrl);
          }
          // Extract body params from Meta-style components or use components as positional params
          let templateParams: string[] | Array<{ parameter_name: string; text: string }> | undefined;
          if (Array.isArray(components) && components.length > 0) {
            const bodyComp = components.find((c: any) => c.type === 'body' || c.type === 'BODY');
            if (bodyComp && Array.isArray(bodyComp.parameters)) {
              templateParams = bodyComp.parameters.map((p: any) =>
                typeof p === 'object' && p.text != null ? p.text : String(p)
              );
            } else {
              templateParams = components.every((c: any) => typeof c === 'string')
                ? (components as string[])
                : undefined;
            }
          }
          const sessionPhoneNumberIdUnified = session.deviceInfo?.apiPhoneNumberId;
          let tplBodyTextUnified: string | undefined;
          let templateMetaForAuthUnified: { category?: string; components?: any[] } | null = null;
          try {
            const userTemplates = await storage.getMessageTemplatesByUser(userId, organizationId, sessionPhoneNumberIdUnified);
            const tplRow = userTemplates.find(
              (t: any) =>
                (t.status === 'APPROVED' || String(t.status || '').toLowerCase() === 'approved') &&
                (t.name === templateName || t.name?.toLowerCase() === String(templateName).toLowerCase())
            );
            if (tplRow) {
              tplBodyTextUnified = tplRow.components?.find((c: any) => c.type === 'BODY')?.text;
              if (String(tplRow.category || '').toUpperCase() === 'AUTHENTICATION') {
                templateMetaForAuthUnified = { category: tplRow.category, components: tplRow.components };
              }
            }
          } catch (_) {}

          result = await businessAPIManager.sendTemplateMessage(
            sessionId,
            to,
            templateName,
            languageCode,
            templateParams,
            headerImageId,
            headerVideoId,
            headerDocumentId,
            tplBodyTextUnified,
            undefined,
            undefined,
            undefined,
            undefined,
            headerDocumentUrl || undefined,
            templateMetaForAuthUnified,
            headerDocumentFilename
          );
          break;
        }
        default:
          return res.status(400).json({
            error: 'Unsupported message type',
            message: `Supported types: text, image, video, audio, document, template. Received: ${type}`,
          });
      }

      // Mirror dashboard sends: persist outbound messages so /chat and GET /messages see them (Business API client only returns Meta response).
      if (result && typeof result.id === 'string' && result.id.length > 0) {
        try {
          let bodyStr = '';
          let msgType: 'text' | 'image' | 'video' | 'audio' | 'document' | 'template' = 'text';
          let mediaUrlOut: string | undefined;
          let templateName: string | undefined;
          let templateLanguage: string | undefined;
          let templateParams: string[] | undefined;

          if (type === 'text') {
            bodyStr = String(body.text?.body ?? body.message ?? '').trim() || '[Message]';
          } else if (type === 'image' || type === 'video' || type === 'audio' || type === 'document') {
            msgType = type;
            const media = body[type] || body.image || body.video || body.audio || body.document;
            const cap =
              (media?.caption != null && String(media.caption).trim()) ||
              (media?.text != null && String(media.text).trim()) ||
              (typeof body.caption === 'string' && body.caption.trim()) ||
              '';
            bodyStr = cap || '[Media]';
            const link = media?.link;
            const rawMediaId = media?.id != null ? String(media.id).trim() : '';
            const looksLikeWaMediaId =
              rawMediaId.length > 10 && /^[a-zA-Z0-9_-]+$/.test(rawMediaId);
            if (
              typeof link === 'string' &&
              (link.startsWith('/uploads/') || link.startsWith('http://') || link.startsWith('https://'))
            ) {
              mediaUrlOut = link;
            } else if (looksLikeWaMediaId) {
              // No public URL: store Graph media id — /chat resolves via GET /api/media/:id?sessionId=
              mediaUrlOut = rawMediaId;
            }
          } else if (type === 'template') {
            msgType = 'template';
            const tmpl = body.template || {};
            const persistTplName = String(tmpl.name ?? body.templateName ?? 'template');
            const persistTplLang = String(tmpl.language?.code ?? body.languageCode ?? 'en');
            templateName = persistTplName;
            templateLanguage = persistTplLang;
            const comps = tmpl.components ?? body.components ?? [];
            const bodyComp = Array.isArray(comps)
              ? comps.find((c: any) => c.type === 'body' || c.type === 'BODY')
              : null;
            if (bodyComp?.parameters?.length) {
              templateParams = bodyComp.parameters.map((p: any) =>
                typeof p === 'object' && p.text != null ? String(p.text) : String(p)
              );
            }
            bodyStr = await buildPersistedTemplateMessageBody({
              userId,
              templateName: persistTplName,
              languageCode: persistTplLang,
              templateParams,
              templateBodyText: body.templateBodyText ?? tmpl.templateBodyText,
              organizationId,
              phoneNumberId: session.deviceInfo?.apiPhoneNumberId,
            });
          } else {
            bodyStr = '[Message]';
          }

          if (
            (msgType === 'image' || msgType === 'video' || msgType === 'audio' || msgType === 'document') &&
            mediaUrlOut &&
            /^[a-zA-Z0-9_-]+$/.test(mediaUrlOut) &&
            mediaUrlOut.length > 10
          ) {
            const localPath = await saveGraphMediaIdToLocalUploads(
              sessionId,
              userId,
              mediaUrlOut,
              msgType,
              bodyStr !== '[Media]' ? bodyStr : undefined
            );
            if (localPath) mediaUrlOut = localPath;
          }

          const placeholderBodies = new Set([
            '',
            '[Media]',
            '[Image]',
            '[Video]',
            '[Audio]',
            '[Document]',
            '[Sticker]',
          ]);
          const isPlaceholderBody = (b: string) => placeholderBodies.has(String(b ?? '').trim());
          const hasRealMediaCaption =
            (type === 'image' || type === 'video' || type === 'audio' || type === 'document') &&
            bodyStr !== '[Media]';

          const existingMsg = await storage.getMessageByIdOrWhatsAppId(result.id, userId, sessionId);
          const ts = result.timestamp instanceof Date ? result.timestamp : new Date();

          const mediaTypeLabelFor = (t: string) =>
            t === 'image'
              ? '📷 Image'
              : t === 'video'
                ? '🎥 Video'
                : t === 'audio'
                  ? '🎤 Voice message'
                  : t === 'document'
                    ? '📄 Document'
                    : t === 'template'
                      ? '📋 Template'
                      : null;

          if (!existingMsg) {
            const chatId = await findOrCreateChat(sessionId, String(to));
            const orgRow = (await storage.getOrganizationsByUser(userId))[0];
            const organizationId = orgRow?.id;

            const message = await storage.createMessage({
              sessionId,
              chatId,
              organizationId: organizationId || undefined,
              body: bodyStr,
              fromMe: true,
              type: msgType,
              status: 'sent',
              whatsappMessageId: result.id,
              mediaUrl: mediaUrlOut,
              templateName,
              templateLanguage,
              templateParams,
            });

            const mediaTypeLabel = mediaTypeLabelFor(msgType);
            const preview =
              msgType === 'text'
                ? bodyStr.substring(0, 100)
                : bodyStr !== '[Media]'
                  ? `${mediaTypeLabel}: ${bodyStr.substring(0, 50)}`
                  : mediaTypeLabel || bodyStr;
            await storage.updateChat(chatId, {
              lastMessage: preview,
              lastMessageTime: ts,
            });

            if (session.connectionType === 'official') {
              businessAPIManager.storeMessageMapping(result.id, message.id, sessionId);
            }
            clearChatbotConversationForContact(sessionId, String(to));
            broadcastToUser(userId, 'new_message', message);
            await triggerWebhooks(userId, 'message.sent', { message, to: String(to) });
          } else if (
            existingMsg.fromMe &&
            ['image', 'video', 'audio', 'document'].includes(String(existingMsg.type))
          ) {
            // Webhook may create the row first: placeholder body and/or missing mediaUrl when Meta omits image.url — backfill caption and/or WhatsApp media id / link.
            const patch: Record<string, unknown> = {};
            if (hasRealMediaCaption && isPlaceholderBody(String(existingMsg.body || ''))) {
              patch.body = bodyStr;
            }
            if (!existingMsg.mediaUrl && mediaUrlOut) {
              patch.mediaUrl = mediaUrlOut;
            }
            if (Object.keys(patch).length > 0) {
              const updated = await storage.updateMessage(existingMsg.id, patch as any);
              if (updated) {
                const t = String(updated.type);
                const label = mediaTypeLabelFor(t);
                const previewBody = String(updated.body || bodyStr);
                const preview =
                  previewBody !== '[Media]' && !isPlaceholderBody(previewBody)
                    ? `${label}: ${previewBody.substring(0, 50)}`
                    : label || previewBody;
                await storage.updateChat(updated.chatId, {
                  lastMessage: preview,
                  lastMessageTime: ts,
                });
                broadcastToUser(userId, 'message_updated', {
                  chatId: updated.chatId,
                  messageId: updated.id,
                  message: updated,
                });
              }
            }
          }
        } catch (persistErr: any) {
          console.error('[Project API] Outbound persist failed:', persistErr?.message || persistErr);
        }
      }

      res.json(result);
    } catch (error: any) {
      console.error('[Project API] Error sending message:', error);
      res.status(500).json({ error: error.message || 'Failed to send message' });
    }
  });

  // GET /api/project/v1/messages?chatId= – list messages in a chat (must be registered before /messages/:messageId)
  app.get('/api/project/v1/messages', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const chatId = typeof req.query?.chatId === 'string' ? req.query.chatId.trim() : '';
      if (!chatId) {
        return res.status(400).json({
          error: 'chatId is required',
          message:
            'Use GET /api/project/v1/messages?chatId=CHAT_UUID (from GET /chats?sessionId=...). Optional: &limit=200 (max 500).',
        });
      }
      const limitParam = req.query.limit;
      const limit =
        limitParam != null ? Math.min(500, Math.max(1, parseInt(String(limitParam), 10) || 200)) : 200;

      const chat = await storage.getChat(chatId);
      if (!chat) {
        return res.status(404).json({ error: 'Chat not found' });
      }
      const session = await storage.getSession(chat.sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Chat not found' });
      }
      let canAccess = session.userId === userId;
      if (!canAccess) {
        const orgs = await storage.getOrganizationsByUser(userId);
        for (const org of orgs) {
          const orgSessions = await storage.getSessionsByOrganization(org.id);
          if (orgSessions.some((s: { sessionId: string }) => s.sessionId === chat.sessionId)) {
            canAccess = true;
            break;
          }
        }
      }
      if (!canAccess) {
        return res.status(404).json({ error: 'Chat not found' });
      }

      let messages = await storage.getMessagesByChat(chatId, limit);
      const orgsUser = await storage.getOrganizationsByUser(userId);
      const organizationId = orgsUser[0]?.id;
      const needHydration = messages.some((m: { campaignId?: string | null; mediaUrl?: string | null }) => m.campaignId && !m.mediaUrl);
      if (needHydration && organizationId) {
        const campaignIds = [
          ...new Set(
            messages
              .filter((m: { campaignId?: string | null; mediaUrl?: string | null }) => m.campaignId && !m.mediaUrl)
              .map((m: { campaignId: string }) => m.campaignId)
          ),
        ];
        const campaigns = await Promise.all(
          campaignIds.map((cid: string) => storage.getCampaign(cid, userId, organizationId))
        );
        const campaignMap = new Map(campaigns.filter(Boolean).map((c: { id: string }) => [c!.id, c!]));
        messages = messages.map((m: Record<string, unknown>) => {
          if (!m.campaignId || m.mediaUrl) return m;
          const campaign = campaignMap.get(m.campaignId as string);
          if (!campaign) return m;
          if (m.templateType === 'VIDEO' && (campaign as { headerVideoUrl?: string }).headerVideoUrl) {
            return { ...m, mediaUrl: (campaign as { headerVideoUrl: string }).headerVideoUrl };
          }
          if (m.templateType === 'IMAGE' && (campaign as { headerImageUrl?: string }).headerImageUrl) {
            return { ...m, mediaUrl: (campaign as { headerImageUrl: string }).headerImageUrl };
          }
          if (!m.templateType) {
            if ((campaign as { headerVideoUrl?: string }).headerVideoUrl) {
              return { ...m, mediaUrl: (campaign as { headerVideoUrl: string }).headerVideoUrl, templateType: 'VIDEO' };
            }
            if ((campaign as { headerImageUrl?: string }).headerImageUrl) {
              return { ...m, mediaUrl: (campaign as { headerImageUrl: string }).headerImageUrl, templateType: 'IMAGE' };
            }
          }
          return m;
        });
      }
      messages = messages.filter((m: { type?: string; body?: string | null; mediaUrl?: string | null }) => {
        const noBody = !m.body || !String(m.body).trim();
        if (m.type === 'reaction' && noBody) return false;
        if (m.type === 'text' && noBody && !m.mediaUrl) return false;
        return true;
      });
      res.json(messages.map((m) => withProjectApiMessageMediaAbsolute(req, m as Record<string, unknown>)));
    } catch (error: any) {
      console.error('[Project API] Error listing messages:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * Stream WhatsApp Cloud media bytes (same auth as Project API: X-API-Key or session cookie).
   * Graph media ids: message list sets mediaUrlAbsolute (and mediaContentUrl) to this URL. GET /api/media/:id returns JSON only (see mediaMetadataUrl on messages).
   */
  app.get('/api/project/v1/media/content', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId.trim() : '';
      const mediaId = typeof req.query.mediaId === 'string' ? req.query.mediaId.trim() : '';
      if (!sessionId || !mediaId) {
        return res.status(400).json({
          error: 'sessionId and mediaId query parameters are required',
          hint: 'Use mediaUrlAbsolute from GET /api/project/v1/messages when mediaUrl is a WhatsApp Graph media id.',
        });
      }
      if (!isWhatsAppGraphMediaIdToken(mediaId)) {
        return res.status(400).json({ error: 'Invalid mediaId format' });
      }
      const organizationId = req.context?.organizationId || (req.query?.organizationId as string) || null;
      const session = await storage.getSession(sessionId);
      if (!(await sessionAllowedForUser(session, sessionId, userId, organizationId))) {
        return res.status(404).json({ error: 'Session not found' });
      }
      if (session!.connectionType !== 'official') {
        return res.status(400).json({ error: 'Media streaming requires WhatsApp Business API (official) session' });
      }
      const credsOk = await ensureOfficialSessionCredentialsForMessaging(
        sessionId,
        session!,
        userId,
        organizationId
      );
      if (!credsOk) {
        return res.status(400).json({
          error: 'WhatsApp session not ready',
          message: 'Could not load API credentials for this session.',
        });
      }
      const creds = businessAPIManager.getCredentials(sessionId);
      if (!creds?.accessToken) {
        return res.status(400).json({ error: 'Missing WhatsApp credentials for this session' });
      }
      const waUrl = await businessAPIManager.getMediaUrl(creds, mediaId);
      const mediaResponse = await fetch(waUrl, {
        headers: { Authorization: `Bearer ${creds.accessToken}` },
      });
      if (!mediaResponse.ok) {
        const errText = await mediaResponse.text().catch(() => '');
        const code = mediaResponse.status >= 400 && mediaResponse.status < 600 ? mediaResponse.status : 502;
        return res.status(code).json({
          error: 'Failed to fetch media from WhatsApp',
          details: errText.slice(0, 300),
        });
      }
      const contentType = mediaResponse.headers.get('content-type') || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'private, max-age=300');
      const buffer = await mediaResponse.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (error: any) {
      console.error('[Project API] media/content:', error);
      res.status(500).json({ error: error.message || 'Failed to stream media' });
    }
  });

  // GET /api/project/v1/messages/:messageId – get message details (AiSensy-style)
  app.get('/api/project/v1/messages/:messageId', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { messageId } = req.params;
      const sessionId = req.query?.sessionId as string | undefined;

      const msg = await storage.getMessageByIdOrWhatsAppId(messageId, userId, sessionId);
      if (!msg) {
        return res.status(404).json({ error: 'Message not found' });
      }

      const chat = await storage.getChat(msg.chatId);
      const phoneNumber = chat?.contactNumber?.replace(/\D/g, '') || msg.senderNumber?.replace(/\D/g, '') || '';
      const countryCode = phoneNumber ? phoneNumber.substring(0, Math.min(3, phoneNumber.length)) : '';
      const userName = msg.senderName || chat?.contactName || '';

      const messageTypeMap: Record<string, string> = {
        text: 'TEXT',
        image: 'IMAGE',
        video: 'VIDEO',
        audio: 'AUDIO',
        document: 'FILE',
        location: 'LOCATION',
        contact: 'CONTACT',
        template: 'TEXT',
      };
      const messageType = messageTypeMap[msg.type] || 'TEXT';

      let messageContent: any = { text: msg.body };
      if (msg.type === 'location' && msg.latitude && msg.longitude) {
        messageContent = { latitude: msg.latitude, longitude: msg.longitude, address: msg.address };
      } else if (msg.type === 'contact' && msg.vcard) {
        messageContent = { vcard: msg.vcard };
      } else if (msg.mediaUrl) {
        const base = getPublicAppBaseUrl(req).replace(/\/+$/, '');
        const mu = msg.mediaUrl;
        let viewerUrl: string;
        if (mu.startsWith('http://') || mu.startsWith('https://')) {
          if (mu.includes('lookaside.fbsbx.com') || mu.includes('facebook.com')) {
            viewerUrl = `${base}/api/media-proxy?url=${encodeURIComponent(mu)}&sessionId=${encodeURIComponent(msg.sessionId)}`;
          } else {
            viewerUrl = mu;
          }
        } else if (mu.startsWith('/')) {
          viewerUrl = `${base}${mu}`;
        } else if (isWhatsAppGraphMediaIdToken(mu)) {
          viewerUrl = `${base}/api/project/v1/media/content?sessionId=${encodeURIComponent(msg.sessionId)}&mediaId=${encodeURIComponent(mu)}`;
        } else {
          viewerUrl = mu;
        }
        messageContent = { ...messageContent, url: viewerUrl };
      }

      let campaign: { name: string; campaign_id: string } | null = null;
      if (msg.campaignId) {
        const orgId = msg.organizationId || (await storage.getOrganizationsByUser(userId))[0]?.id;
        if (orgId) {
          const campaignObj = await storage.getCampaign(msg.campaignId, userId, orgId);
          if (campaignObj) {
            campaign = { name: campaignObj.name, campaign_id: campaignObj.id };
          }
        }
      }

      const toTimestamp = (d: Date | string | null | undefined): number | null =>
        d ? new Date(d).getTime() : null;

      const response = {
        type: 'message',
        id: msg.id,
        meta_data: [],
        project_id: msg.sessionId,
        phone_number: phoneNumber || msg.senderNumber,
        contact_id: chat?.contactId || msg.chatId,
        campaign,
        sender: msg.fromMe ? 'AGENT' : 'USER',
        message_content: messageContent,
        message_type: messageType,
        status: (msg.status || 'sent').toUpperCase(),
        is_HSM: !!msg.templateName,
        chatbot_response: null,
        sent_at: toTimestamp(msg.sentAt || msg.timestamp),
        delivered_at: toTimestamp(msg.deliveredAt),
        read_at: toTimestamp(msg.readAt),
        failureResponse: msg.errorMessage ? { message: msg.errorMessage, code: msg.errorCode } : null,
        userName,
        countryCode,
        messageId: msg.whatsappMessageId || msg.id,
      };

      res.json(response);
    } catch (error: any) {
      console.error('[Project API] Error getting message details:', error);
      res.status(500).json({ error: error.message || 'Failed to get message details' });
    }
  });

  app.post('/api/project/v1/messages/send-text', ...withAuthAndRateLimit, walletUsageSkip, checkUsageLimits('message'), incrementUsage('message'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.query?.organizationId || req.body?.organizationId || null;
      const parsed = sendTextMessageSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      }
      const validatedData = parsed.data;
      const session = await storage.getSession(validatedData.sessionId);
      if (!session || session.userId !== userId) {
        return res.status(404).json({ error: 'Session not found' });
      }
      const manager = await getWhatsAppManager(validatedData.sessionId);
      if (session.connectionType === 'official') {
        let isReady = manager.isClientReady(validatedData.sessionId);
        if (!isReady) {
          let accessToken: string | null = null;
          let phoneNumberId: string | null = null;
          let businessAccountId: string | null = null;
          try {
            const apiPhoneNumberId = session.deviceInfo?.apiPhoneNumberId;
            let integration: any = null;
            if (session.deviceInfo?.integrationId) {
              integration = await storage.getIntegration(session.deviceInfo.integrationId, userId);
            }
            if (!integration) {
              integration = await storage.getIntegrationByName('whatsapp-business', userId, organizationId || undefined);
            }
            if (apiPhoneNumberId && !integration) {
              const allIntegrations = await storage.getIntegrationsByUser(userId, organizationId || undefined);
              const whatsappIntegrations = allIntegrations.filter(
                (i: any) => i.name === 'whatsapp-business' && i.status === 'connected' && i.credentials
              );
              for (const int of whatsappIntegrations) {
                const creds = int.credentials as any;
                const token = creds?.access_token;
                if (!token) continue;
                try {
                  const checkRes = await fetch(
                    `https://graph.facebook.com/v23.0/${apiPhoneNumberId}?fields=id&access_token=${encodeURIComponent(token)}`
                  );
                  if (checkRes.ok) {
                    integration = int;
                    break;
                  }
                } catch (_) {
                  continue;
                }
              }
            }
            if (integration?.status === 'connected' && integration.credentials) {
              const credentials = integration.credentials as any;
              accessToken = credentials.access_token;
              if (session.deviceInfo?.apiPhoneNumberId) phoneNumberId = session.deviceInfo.apiPhoneNumberId;
              if (session.deviceInfo?.businessAccountId) businessAccountId = session.deviceInfo.businessAccountId;
            }
            if (!accessToken) {
              const settings = await storage.getUserSettings(userId);
              if (settings?.whatsappBusinessCredentials?.phoneNumberId && settings.whatsappBusinessCredentials.accessToken) {
                accessToken = settings.whatsappBusinessCredentials.accessToken;
                phoneNumberId = settings.whatsappBusinessCredentials.phoneNumberId;
                businessAccountId = settings.whatsappBusinessCredentials.businessAccountId || null;
              }
            }
            if (accessToken && phoneNumberId) {
              try {
                await businessAPIManager.restoreSession(validatedData.sessionId, {
                  phoneNumberId,
                  accessToken,
                  businessAccountId: businessAccountId ?? undefined,
                });
                isReady = manager.isClientReady(validatedData.sessionId);
              } catch (_) {
                isReady = manager.isClientReady(validatedData.sessionId);
              }
            }
          } catch (_) {}
          if (!isReady) {
            return res.status(400).json({
              error: 'WhatsApp Business API not ready',
              message: 'Reconnect the WhatsApp Business number in Integrations and try again.',
            });
          }
        }
      } else if (session.connectionType === 'unofficial' && typeof (manager as any).waitForClientReady === 'function') {
        const isReady = await (manager as any).waitForClientReady(validatedData.sessionId, 35000);
        if (!isReady) {
          return res.status(400).json({
            error: 'WhatsApp client not ready',
            message: 'Reconnect the device or wait and try again.',
          });
        }
      }
      const result = await businessAPIManager.sendTextMessage(validatedData.sessionId, validatedData.to, validatedData.message);
      res.json(result);
    } catch (error: any) {
      console.error('[Project API] Error sending text:', error);
      res.status(500).json({ error: error.message || 'Failed to send message' });
    }
  });

  app.post('/api/project/v1/messages/send-template', ...withAuthAndRateLimit, walletUsageSkip, checkUsageLimits('message'), incrementUsage('message'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.query?.organizationId || req.body?.organizationId || null;
      const {
        sessionId,
        to,
        templateName,
        languageCode = 'en',
        templateParams,
        templateBodyText,
        header,
        components,
      } = req.body;
      if (!sessionId || !to || !templateName) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'sessionId, to, and templateName are required. Optional: languageCode, templateParams (body params), templateBodyText (for named params), header (media), components (alias for templateParams).',
        });
      }
      // templateParams: body parameters – array of strings or { parameter_name, text }; components is backward-compat alias
      const bodyParams = templateParams !== undefined ? templateParams : components;
      let headerImageId: string | undefined;
      let headerVideoId: string | undefined;
      let headerDocumentId: string | undefined;
      let headerDocumentFilename: string | undefined;
      let headerDocumentLink: string | undefined;
      if (header && typeof header === 'object') {
        const t = (header.type || 'image').toLowerCase();
        const id = header.id || header.mediaId;
        const link = header.link || header.url;
        if (typeof header.filename === 'string' && header.filename.trim()) {
          headerDocumentFilename = header.filename.trim();
        }
        if (id) {
          if (t === 'image') headerImageId = id;
          else if (t === 'video') headerVideoId = id;
          else if (t === 'document') headerDocumentId = id;
          else headerImageId = id;
        }
        if (link && t === 'document') {
          headerDocumentLink = String(link);
          if (!headerDocumentFilename) {
            headerDocumentFilename = resolveWhatsAppDocumentFilename(undefined, headerDocumentLink);
          }
        }
      }
      const session = await storage.getSession(sessionId);
      if (!session || session.userId !== userId) {
        return res.status(404).json({ error: 'Session not found' });
      }
      const manager = await getWhatsAppManager(sessionId);
      if (session.connectionType !== 'official') {
        return res.status(400).json({
          error: 'Template messages require WhatsApp Business API',
          message: 'Use a session connected via WhatsApp Business (official) to send templates.',
        });
      }
      let isReady = manager.isClientReady(sessionId);
      if (!isReady) {
        let accessToken: string | null = null;
        let phoneNumberId: string | null = null;
        let businessAccountId: string | null = null;
        try {
          const apiPhoneNumberId = session.deviceInfo?.apiPhoneNumberId;
          let integration: any = null;
          if (session.deviceInfo?.integrationId) {
            integration = await storage.getIntegration(session.deviceInfo.integrationId, userId);
          }
          if (!integration) {
            integration = await storage.getIntegrationByName('whatsapp-business', userId, organizationId || undefined);
          }
          if (apiPhoneNumberId && !integration) {
            const allIntegrations = await storage.getIntegrationsByUser(userId, organizationId || undefined);
            const whatsappIntegrations = allIntegrations.filter(
              (i: any) => i.name === 'whatsapp-business' && i.status === 'connected' && i.credentials
            );
            for (const int of whatsappIntegrations) {
              const creds = int.credentials as any;
              const token = creds?.access_token;
              if (!token) continue;
              try {
                const checkRes = await fetch(
                  `https://graph.facebook.com/v23.0/${apiPhoneNumberId}?fields=id&access_token=${encodeURIComponent(token)}`
                );
                if (checkRes.ok) {
                  integration = int;
                  break;
                }
              } catch (_) {
                continue;
              }
            }
          }
          if (integration?.status === 'connected' && integration.credentials) {
            const credentials = integration.credentials as any;
            accessToken = credentials.access_token;
            if (session.deviceInfo?.apiPhoneNumberId) phoneNumberId = session.deviceInfo.apiPhoneNumberId;
            if (session.deviceInfo?.businessAccountId) businessAccountId = session.deviceInfo.businessAccountId;
          }
          if (accessToken && phoneNumberId) {
            try {
              await businessAPIManager.restoreSession(sessionId, {
                phoneNumberId,
                accessToken,
                businessAccountId: businessAccountId ?? undefined,
              });
              isReady = manager.isClientReady(sessionId);
            } catch (_) {
              isReady = manager.isClientReady(sessionId);
            }
          }
        } catch (_) {}
        if (!isReady) {
          return res.status(400).json({
            error: 'WhatsApp Business API not ready',
            message: 'Reconnect the WhatsApp Business number in Integrations and try again.',
          });
        }
      }

      const sessionPhoneNumberIdSendTpl = session.deviceInfo?.apiPhoneNumberId;
      let tplBodyFromDb: string | undefined;
      let templateMetaForAuthSendTpl: { category?: string; components?: any[] } | null = null;
      try {
        const userTemplates = await storage.getMessageTemplatesByUser(userId, organizationId, sessionPhoneNumberIdSendTpl);
        const tplRow = userTemplates.find(
          (t: any) =>
            (t.status === 'APPROVED' || String(t.status || '').toLowerCase() === 'approved') &&
            (t.name === templateName || t.name?.toLowerCase() === String(templateName).toLowerCase())
        );
        if (tplRow) {
          tplBodyFromDb = tplRow.components?.find((c: any) => c.type === 'BODY')?.text;
          if (String(tplRow.category || '').toUpperCase() === 'AUTHENTICATION') {
            templateMetaForAuthSendTpl = { category: tplRow.category, components: tplRow.components };
          }
        }
      } catch (_) {}

      const templateBodyTextEffective =
        typeof templateBodyText === 'string' && templateBodyText.trim()
          ? templateBodyText
          : tplBodyFromDb;

      const result = await businessAPIManager.sendTemplateMessage(
        sessionId,
        to,
        templateName,
        languageCode,
        bodyParams && (Array.isArray(bodyParams) ? bodyParams.length > 0 : true) ? bodyParams : undefined,
        headerImageId,
        headerVideoId,
        headerDocumentId,
        templateBodyTextEffective,
        undefined,
        undefined,
        undefined,
        undefined,
        headerDocumentLink,
        templateMetaForAuthSendTpl,
        headerDocumentFilename
      );

      // Persist outbound template so /chat and GET /api/project/v1/messages see it (unified POST /messages already does this for type=template).
      if (result && typeof result.id === 'string' && result.id.length > 0) {
        try {
          let templateParamsPersist: string[] | undefined;
          if (Array.isArray(bodyParams) && bodyParams.length > 0) {
            templateParamsPersist = bodyParams.map((p: any) =>
              typeof p === 'object' && p != null && p.text != null ? String(p.text) : String(p)
            );
          }
          const bodyStr = await buildPersistedTemplateMessageBody({
            userId,
            templateName,
            languageCode: languageCode,
            templateParams: templateParamsPersist,
            templateBodyText: templateBodyTextEffective,
            organizationId,
            phoneNumberId: session.deviceInfo?.apiPhoneNumberId,
          });
          const existingMsg = await storage.getMessageByIdOrWhatsAppId(result.id, userId, sessionId);
          const ts = result.timestamp instanceof Date ? result.timestamp : new Date();

          if (!existingMsg) {
            const chatId = await findOrCreateChat(sessionId, String(to));
            const orgRow = (await storage.getOrganizationsByUser(userId))[0];
            const orgIdPersist = orgRow?.id;

            const message = await storage.createMessage({
              sessionId,
              chatId,
              organizationId: orgIdPersist || undefined,
              body: bodyStr,
              fromMe: true,
              type: 'template',
              status: 'sent',
              whatsappMessageId: result.id,
              templateName,
              templateLanguage: languageCode,
              templateParams: templateParamsPersist,
            });

            const preview = `📋 Template: ${bodyStr.substring(0, 50)}`;
            await storage.updateChat(chatId, {
              lastMessage: preview,
              lastMessageTime: ts,
            });

            if (session.connectionType === 'official') {
              businessAPIManager.storeMessageMapping(result.id, message.id, sessionId);
            }
            clearChatbotConversationForContact(sessionId, String(to));
            broadcastToUser(userId, 'new_message', message);
            await triggerWebhooks(userId, 'message.sent', { message, to: String(to) });
          }
        } catch (persistErr: any) {
          console.error('[Project API] send-template outbound persist failed:', persistErr?.message || persistErr);
        }
      }

      res.json(result);
    } catch (error: any) {
      console.error('[Project API] Error sending template:', error);
      res.status(500).json({ error: error.message || 'Failed to send template message' });
    }
  });

  // GET /api/project/v1/media/:mediaId – get media URL by id (query: sessionId required)
  app.get('/api/project/v1/media/:mediaId', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const mediaId = req.params.mediaId as string;
      const sessionId = req.query?.sessionId as string;
      if (!mediaId || !sessionId) {
        return res.status(400).json({ error: 'mediaId and sessionId (query) are required' });
      }
      const queryOrg =
        typeof req.query?.organizationId === 'string' && req.query.organizationId.trim()
          ? req.query.organizationId.trim()
          : null;
      const session = await storage.getSession(sessionId);
      if (!(await sessionAllowedForUser(session, sessionId, userId, queryOrg))) {
        return res.status(404).json({ error: 'Session not found' });
      }
      if (session!.connectionType !== 'official') {
        return res.status(400).json({ error: 'Media is only supported with WhatsApp Business API' });
      }
      let organizationId = queryOrg || undefined;
      if (!organizationId) {
        const orgs = await storage.getOrganizationsByUser(userId);
        organizationId = orgs[0]?.id;
      }
      if (organizationId) {
        const templatesFolder = path.join(process.cwd(), 'uploads', organizationId, 'templates');
        if (fs.existsSync(templatesFolder)) {
          const files = fs.readdirSync(templatesFolder);
          const matchingFile = files.find((f: string) => f.includes(mediaId));
          if (matchingFile) {
            const filePath = path.join(templatesFolder, matchingFile);
            if (fs.existsSync(filePath)) {
              const localUrl = `/uploads/${organizationId}/templates/${matchingFile}`;
              return res.json({ url: localUrl });
            }
          }
        }
      }
      const credsOk = await ensureOfficialSessionCredentialsForMessaging(
        sessionId,
        session!,
        userId,
        organizationId || null
      );
      if (!credsOk) {
        return res.status(400).json({
          error: 'WhatsApp Business API not ready',
          message: 'Could not load API credentials for this session. Reconnect the number in Integrations.',
        });
      }
      const result = await businessAPIManager.getMediaForTemplate(sessionId, mediaId);
      return res.json(result);
    } catch (error: any) {
      console.error('[Project API] Error getting media:', error);
      res.status(500).json({ error: error.message || 'Media not found' });
    }
  });

  // Lightweight dashboard cache to reduce repeated aggregate load during polling bursts.
  const dashboardStatsCache = new Map<string, { expiresAt: number; payload: unknown }>();
  const DASHBOARD_CACHE_TTL_MS = Number(process.env.DASHBOARD_CACHE_TTL_MS || 10_000);

  // Dashboard stats (View Analytics) – org-scoped: team members with view_analytics.view see the same data
  app.get('/api/dashboard/stats', ...withOrgContext, requirePermission('view_analytics.view'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      if (!organizationId) {
        return res.json({
          totalSessions: 0,
          activeSessions: 0,
          totalMessages: 0,
          totalMessagesSent: 0,
          totalMessagesReceived: 0,
          totalContacts: 0,
          totalGroups: 0,
          totalCampaigns: 0,
          activeCampaigns: 0,
          totalAgents: 0,
          dailyMessages: [],
          monthlyMessages: [],
          leadSourceBreakdown: {},
          messagingLimit: null,
        });
      }
      const orgId = organizationId;
      const cacheKey = `org:${orgId}`;
      const nowMs = Date.now();
      const cached = dashboardStatsCache.get(cacheKey);
      if (cached && cached.expiresAt > nowMs) {
        return res.json(cached.payload);
      }

      // Use organization-scoped data so every team member sees the panel's data
      const [sessions, allCampaigns, allGroups, orgMembers] = await Promise.all([
        storage.getSessionsByOrganization(orgId),
        storage.getCampaignsByOrganization(orgId),
        storage.getGroupsByOrganization(orgId),
        storage.getOrganizationMembers(orgId),
      ]);
      const totalAgents = orgMembers.length;

      // Calculate last 7 calendar days (YYYY-MM-DD format, locale-stable)
      const today = new Date();
      const dates: string[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        dates.push(`${year}-${month}-${day}`);
      }
      const startDate = dates[0];
      const endDate = dates[6];
      const activityLogs = (await storage.getMessageActivityForDateRangeByOrganization(orgId, startDate, endDate)) || [];
      const activityMap = new Map<string, number>();
      activityLogs.forEach((log) => activityMap.set(log.date, log.messageCount));
      
      // Build dailyMessages array with actual dates and counts
      const dailyMessages = dates.map(date => {
        // Parse date components to create local Date object (avoid UTC shift)
        const [year, month, day] = date.split('-').map(Number);
        const dateObj = new Date(year, month - 1, day); // month is 0-indexed
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayName = dayNames[dateObj.getDay()];
        
        return {
          day: dayName,
          date: date,
          messages: activityMap.get(date) || 0
        };
      });
      
      // Count messages sent and received from messages table
      const sessionIds = sessions.map((s: any) => s.sessionId);
      let totalMessagesSent = 0;
      let totalMessagesReceived = 0;
      
      if (sessionIds.length > 0) {
        if (isMongoEnabled()) {
          const [sentCount, receivedCount] = await Promise.all([
            MessageModel.countDocuments({
              sessionId: { $in: sessionIds },
              $or: [{ fromMe: true }, { isFromMe: true }, { from_me: true }],
            }),
            MessageModel.countDocuments({
              sessionId: { $in: sessionIds },
              $or: [{ fromMe: false }, { isFromMe: false }, { from_me: false }],
            }),
          ]);
          totalMessagesSent = Number(sentCount || 0);
          totalMessagesReceived = Number(receivedCount || 0);
        } else {
          // Count sent/received in parallel to reduce endpoint latency.
          const [sentResult, receivedResult] = await Promise.all([
            db
              .select({ count: sql<number>`count(*)` })
              .from(messages)
              .where(and(
                inArray(messages.sessionId, sessionIds),
                eq(messages.fromMe, true)
              )),
            db
              .select({ count: sql<number>`count(*)` })
              .from(messages)
              .where(and(
                inArray(messages.sessionId, sessionIds),
                eq(messages.fromMe, false)
              )),
          ]);
          totalMessagesSent = Number(sentResult[0]?.count || 0);
          totalMessagesReceived = Number(receivedResult[0]?.count || 0);
        }
      }
      
      // Calculate last 6 months for sent/received chart
      const monthlyMessages: Array<{ month: string; sent: number; received: number }> = [];
      const monthlyDateMeta: Array<{ key: string; month: string }> = [];
      const monthlyStart = new Date();
      monthlyStart.setDate(1);
      monthlyStart.setHours(0, 0, 0, 0);
      monthlyStart.setMonth(monthlyStart.getMonth() - 5);
      const monthlyEnd = new Date();
      monthlyEnd.setMonth(monthlyEnd.getMonth() + 1, 1);
      monthlyEnd.setHours(0, 0, 0, 0);
      monthlyEnd.setMilliseconds(-1);

      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i, 1);
        date.setHours(0, 0, 0, 0);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyDateMeta.push({
          key,
          month: date.toLocaleString('default', { month: 'short' }),
        });
      }

      const monthlyMap = new Map<string, { sent: number; received: number }>();
      if (sessionIds.length > 0) {
        try {
          if (isMongoEnabled()) {
            const monthlyRows = await MessageModel.aggregate([
              {
                $match: {
                  sessionId: { $in: sessionIds },
                  timestamp: { $gte: monthlyStart, $lte: monthlyEnd },
                },
              },
              {
                $group: {
                  _id: {
                    monthKey: { $dateToString: { format: "%Y-%m", date: "$timestamp" } },
                  },
                  sent: {
                    $sum: {
                      $cond: [{ $or: [{ $eq: ["$fromMe", true] }, { $eq: ["$isFromMe", true] }] }, 1, 0],
                    },
                  },
                  received: {
                    $sum: {
                      $cond: [{ $or: [{ $eq: ["$fromMe", false] }, { $eq: ["$isFromMe", false] }] }, 1, 0],
                    },
                  },
                },
              },
            ]);
            monthlyRows.forEach((row: any) => {
              if (row._id?.monthKey) {
                monthlyMap.set(row._id.monthKey, {
                  sent: Number(row.sent || 0),
                  received: Number(row.received || 0),
                });
              }
            });
          } else {
            const monthlyRows = await db
              .select({
                monthKey: sql<string>`to_char(date_trunc('month', ${messages.timestamp}), 'YYYY-MM')`,
                sent: sql<number>`sum(case when ${messages.fromMe} = true then 1 else 0 end)`,
                received: sql<number>`sum(case when ${messages.fromMe} = false then 1 else 0 end)`,
              })
              .from(messages)
              .where(and(
                inArray(messages.sessionId, sessionIds),
                gte(messages.timestamp, monthlyStart),
                lte(messages.timestamp, monthlyEnd)
              ))
              .groupBy(sql`date_trunc('month', ${messages.timestamp})`);

            monthlyRows.forEach((row) => {
              monthlyMap.set(row.monthKey, {
                sent: Number(row.sent || 0),
                received: Number(row.received || 0),
              });
            });
          }
        } catch (error) {
          console.error('Error calculating monthly messages:', error);
        }
      }

      monthlyDateMeta.forEach((meta) => {
        const counts = monthlyMap.get(meta.key) || { sent: 0, received: 0 };
        monthlyMessages.push({
          month: meta.month,
          sent: counts.sent,
          received: counts.received,
        });
      });
      
      // Calculate lead source breakdown
      const sourceBreakdown: Record<string, { total: number; pending: number; assigned: number }> = {};
      
      // Initialize all sources with 0 counts
      const allSources = ['manual', 'whatsapp', 'facebook', 'import', 'api', 'indiamart', 'google_ads', 'linkedin', 'website'];
      allSources.forEach(source => {
        sourceBreakdown[source] = { total: 0, pending: 0, assigned: 0 };
      });
      
      let totalContacts = 0;
      if (isMongoEnabled()) {
        const contactSourceRows = await ManagedContactModel.aggregate([
          {
            $match: {
              $or: [{ organizationId: orgId }, { organization_id: orgId }],
            },
          },
          {
            $group: {
              _id: { $toLower: { $ifNull: ["$source", "manual"] } },
              total: { $sum: 1 },
            },
          },
        ]);

        contactSourceRows.forEach((row: any) => {
          const source = (row._id || 'manual').toLowerCase();
          const count = Number(row.total || 0);
          totalContacts += count;
          if (sourceBreakdown[source]) {
            sourceBreakdown[source].total += count;
          } else {
            sourceBreakdown[source] = { total: count, pending: 0, assigned: 0 };
          }
        });
      } else {
        // Count contacts by source in SQL (avoid loading full contact rows into memory).
        const contactSourceRows = await db
          .select({
            source: sql<string>`coalesce(lower(${managedContacts.source}), 'manual')`,
            total: sql<number>`count(*)`,
          })
          .from(managedContacts)
          .where(eq(managedContacts.organizationId, orgId))
          .groupBy(sql`coalesce(lower(${managedContacts.source}), 'manual')`);

        contactSourceRows.forEach((row) => {
          const source = (row.source || 'manual').toLowerCase();
          const count = Number(row.total || 0);
          totalContacts += count;
          if (sourceBreakdown[source]) {
            sourceBreakdown[source].total += count;
          } else {
            sourceBreakdown[source] = { total: count, pending: 0, assigned: 0 };
          }
        });
      }
      
      // Calculate pending/assigned for each source
      // For now, we'll use a simple calculation (95% pending, 5% assigned)
      // In a real system, you'd check actual assignment status from a separate table
      Object.keys(sourceBreakdown).forEach(source => {
        const total = sourceBreakdown[source].total;
        sourceBreakdown[source].pending = Math.floor(total * 0.95);
        sourceBreakdown[source].assigned = Math.floor(total * 0.05);
      });
      
      // Calculate stats
      let messagingLimit: {
        tier: string | null;
        tierLabel: string;
        qualityRating: string | null;
        dailyLimit: number | null;
        usedToday: number;
        remaining: number | null;
      } | null = null;

      if (sessionIds.length > 0) {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        let usedToday = 0;
        if (isMongoEnabled()) {
          const distinctChatIds = await MessageModel.distinct("chatId", {
            sessionId: { $in: sessionIds },
            $or: [{ fromMe: true }, { isFromMe: true }, { from_me: true }],
            timestamp: { $gte: twentyFourHoursAgo },
          });
          usedToday = distinctChatIds.length;
        } else {
          const [uniqueCustomersResult] = await db
            .select({ count: sql<number>`count(distinct ${messages.chatId})::int` })
            .from(messages)
            .where(and(
              inArray(messages.sessionId, sessionIds),
              eq(messages.fromMe, true),
              gte(messages.timestamp, twentyFourHoursAgo),
            ));
          usedToday = Number(uniqueCustomersResult?.count || 0);
        }

        const officialSession = sessions.find(
          (s: { status?: string; connectionType?: string }) =>
            s.status === 'connected' && s.connectionType === 'official',
        );
        if (officialSession) {
          let creds = businessAPIManager.getCredentials(officialSession.sessionId);
          if (!creds?.accessToken) {
            const ownerId = officialSession.userId;
            if (ownerId) {
              const settings = await storage.getUserSettings(ownerId);
              const wb = settings?.whatsappBusinessCredentials;
              if (wb?.phoneNumberId && wb?.accessToken) {
                creds = {
                  phoneNumberId: wb.phoneNumberId,
                  accessToken: wb.accessToken,
                  businessAccountId: wb.businessAccountId,
                };
              }
            }
          }
          if (creds?.phoneNumberId && creds?.accessToken) {
            const meta = await fetchMetaCampaignSendContext(creds.phoneNumberId, creds.accessToken);
            const dailyLimit = tierToDailyLimit(meta.messagingLimitTier);
            messagingLimit = {
              tier: meta.messagingLimitTier,
              tierLabel: formatMessagingTierLabel(meta.messagingLimitTier),
              qualityRating: meta.qualityRating,
              dailyLimit,
              usedToday,
              remaining: dailyLimit != null ? Math.max(0, dailyLimit - usedToday) : null,
            };
          } else {
            messagingLimit = {
              tier: null,
              tierLabel: 'Not available',
              qualityRating: null,
              dailyLimit: null,
              usedToday,
              remaining: null,
            };
          }
        }
      }

      const stats = {
        totalSessions: (sessions || []).length,
        activeSessions: (sessions || []).filter((s: any) => s.status === 'connected').length,
        totalMessagesSent,
        totalMessagesReceived,
        totalMessages: totalMessagesSent + totalMessagesReceived,
        totalCampaigns: (allCampaigns || []).length,
        activeCampaigns: (allCampaigns || []).filter((c: any) => c.status === 'sending' || c.status === 'scheduled').length,
        totalContacts,
        totalGroups: (allGroups || []).length,
        totalAgents,
        
        // Daily message counts (last 7 calendar days) from message activity log
        dailyMessages,
        
        // Monthly messages for chart (last 6 months)
        monthlyMessages,
        
        // Lead source breakdown
        leadSourceBreakdown: sourceBreakdown,

        // WhatsApp daily unique-customer messaging limit (Meta tier)
        messagingLimit,
      };
      
      dashboardStatsCache.set(cacheKey, {
        expiresAt: nowMs + DASHBOARD_CACHE_TTL_MS,
        payload: stats,
      });
      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Website Builder API (admin – per-organization) – explicit routes first so they always match
  const getPageKey = (req: any) => req.params.pageKey || (req.path || '').replace(/^\/api\/website-builder\/?/, '').replace(/\/$/, '') || '';

  const websiteBuilderGet = async (req: any, res: any) => {
    try {
      const { organizationId } = req.context!;
      const pageKey = getPageKey(req);
      const page = await storage.getWebsiteBuilderPage(organizationId, pageKey);
      let content = page ? { ...(page.content as Record<string, unknown>) } : null;
      if (content && pageKey === "homepage") {
        content = applyHomepageHeroDefaults(content);
      }
      res.json(page ? { content } : { content: null });
    } catch (error: any) {
      console.error('Error getting website builder page:', error);
      res.status(500).json({ error: error.message });
    }
  };
  const websiteBuilderPost = async (req: any, res: any) => {
    try {
      const { organizationId } = req.context!;
      const pageKey = getPageKey(req);
      const raw = req.body?.content ?? req.body;
      const content =
        raw && typeof raw === 'object' && !Array.isArray(raw)
          ? (raw as Record<string, unknown>)
          : {};
      const page = await storage.setWebsiteBuilderPage(organizationId, pageKey, content);
      res.json({ content: page.content ?? content });
    } catch (error: any) {
      console.error('Error saving website builder page:', error);
      res.status(500).json({ error: error.message });
    }
  };

  app.get('/api/website-builder/company-profile', ...withOrgContext, websiteBuilderGet);
  app.post('/api/website-builder/company-profile', ...withOrgContext, websiteBuilderPost);
  app.get('/api/website-builder/homepage', ...withOrgContext, websiteBuilderGet);
  app.post('/api/website-builder/homepage', ...withOrgContext, websiteBuilderPost);

  // Website Builder image upload – use /upload/image (two segments) so :pageKey never matches
  app.post('/api/website-builder/upload/image', ...withOrgContext, websiteBuilderUpload.single('file'), async (req: any, res) => {
    try {
      const { organizationId } = req.context || {};
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }
      if (!file.mimetype?.startsWith('image/')) {
        try { fs.unlinkSync(file.path); } catch { /* ignore */ }
        return res.status(400).json({ error: 'Only image files are allowed' });
      }
      try {
        assertPanelUploadSize('image', file.size);
      } catch (sizeErr: any) {
        try { fs.unlinkSync(file.path); } catch { /* ignore */ }
        return res.status(400).json({ error: sizeErr.message || 'File is too large' });
      }
      const url = `/uploads/${organizationId}/website-builder/${file.filename}`;
      await ingestMulterDiskFile(file, url);
      res.json({ url, filename: file.filename, originalName: file.originalname });
    } catch (error: any) {
      console.error('Website builder image upload error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/website-builder/:pageKey', ...withOrgContext, websiteBuilderGet);
  app.post('/api/website-builder/:pageKey', ...withOrgContext, websiteBuilderPost);

  // Webhook management endpoints
  app.get('/api/webhooks', ...withOrgContext, requirePermission('manage_settings.webhook', 'webhook_events.view'), async (req: any, res) => {
    try {
      const { organizationId } = req.context;
      if (isPaginatedListRequest(req.query)) {
        const pagination = listPaginationFromRequest(req);
        const search = parseListSearch(req.query);
        const result = await storage.listWebhooksByOrganization(organizationId, { search, ...pagination });
        return res.json(buildPaginatedResponse("webhooks", result));
      }
      const webhooks = await storage.getWebhooksByOrganization(organizationId);
      res.json(webhooks);
    } catch (error: any) {
      console.error("Error fetching webhooks:", error);
      res.status(500).json({ message: "Failed to fetch webhooks" });
    }
  });

  app.post('/api/webhooks', ...withOrgContext, requirePermission('manage_settings.webhook', 'webhook_events.create'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { organizationId } = req.context;
      
      // Validate request body
      const parsed = insertWebhookSchema.safeParse({
        ...req.body,
        userId,
        organizationId,
        secret: `whsec_${crypto.randomUUID()}`, // Generate webhook secret
      });

      if (!parsed.success) {
        return res.status(400).json({ 
          message: "Invalid webhook data",
          errors: parsed.error.errors 
        });
      }

      const webhook = await storage.createWebhook(parsed.data);
      res.json(webhook);
    } catch (error: any) {
      console.error("Error creating webhook:", error);
      res.status(500).json({ message: "Failed to create webhook" });
    }
  });

  app.patch('/api/webhooks/:id', ...withOrgContext, requirePermission('manage_settings.webhook', 'webhook_events.edit'), async (req: any, res) => {
    try {
      const { organizationId } = req.context;
      const { id } = req.params;

      // Verify the webhook belongs to the organization
      const webhook = await storage.getWebhook(id);
      if (!webhook || webhook.organizationId !== organizationId) {
        return res.status(404).json({ message: "Webhook not found" });
      }

      // Validate allowed updates with Zod schema
      const updateSchema = insertWebhookSchema.partial().pick({
        url: true,
        events: true,
        status: true,
      });

      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          message: "Invalid update data",
          errors: parsed.error.errors 
        });
      }

      if (Object.keys(parsed.data).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }

      const updated = await storage.updateWebhook(id, parsed.data);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating webhook:", error);
      res.status(500).json({ message: "Failed to update webhook" });
    }
  });

  app.delete('/api/webhooks/:id', ...withOrgContext, requirePermission('manage_settings.webhook', 'webhook_events.delete'), async (req: any, res) => {
    try {
      const { organizationId } = req.context;
      const { id } = req.params;

      // Verify the webhook belongs to the organization
      const webhook = await storage.getWebhook(id);
      if (!webhook || webhook.organizationId !== organizationId) {
        return res.status(404).json({ message: "Webhook not found" });
      }

      await storage.deleteWebhook(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting webhook:", error);
      res.status(500).json({ message: "Failed to delete webhook" });
    }
  });

  // Automation Flows (flow builder) endpoints
  app.get('/api/automation-flows', ...withOrgContext, requirePermission('flows.view'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      if (isPaginatedListRequest(req.query)) {
        const pagination = listPaginationFromRequest(req);
        const search = parseListSearch(req.query);
        const statusRaw = req.query.status;
        const status =
          statusRaw === "active" || statusRaw === "inactive" ? statusRaw : undefined;
        const sortRaw = req.query.sort;
        const sort =
          sortRaw === "oldest" || sortRaw === "name" || sortRaw === "newest" ? sortRaw : "newest";
        const result = await storage.listAutomationFlowsByOrganization(organizationId, {
          search,
          status,
          sort,
          ...pagination,
        });
        return res.json(buildPaginatedResponse("flows", result));
      }
      // Organization-scoped: show all org flows to any member with flows.view
      const flows = await storage.getAutomationFlowsByOrganization(organizationId);
      res.json(flows);
    } catch (error: any) {
      console.error("Error fetching automation flows:", error);
      res.status(500).json({ message: "Failed to fetch automation flows" });
    }
  });

  app.post('/api/automation-flows', ...withOrgContext, requirePermission('flows.create'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      const parsed = insertAutomationFlowSchema.safeParse({
        ...req.body,
        userId,
        organizationId: organizationId ?? null,
      });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid flow data", errors: parsed.error.errors });
      }
      const creatingActive = String(parsed.data.status || "").toLowerCase() === "active";
      if (organizationId) {
        const quota = await assertPlanQuota({
          userId,
          organizationId,
          kind: "workflows",
          activating: creatingActive ? true : false,
        });
        if (quota) return sendPlanQuotaDenial(res, quota);
      }
      const flow = await storage.createAutomationFlow(parsed.data);
      res.json(flow);
    } catch (error: any) {
      console.error("Error creating automation flow:", error);
      res.status(500).json({ message: "Failed to create automation flow" });
    }
  });

  app.get('/api/automation-flows/:id', ...withOrgContext, requirePermission('flows.view'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      if (!organizationId) return res.status(400).json({ message: "Organization context required" });
      const flow = await storage.getAutomationFlowByOrganization(req.params.id, organizationId);
      if (!flow) return res.status(404).json({ message: "Flow not found" });
      res.json(flow);
    } catch (error: any) {
      console.error("Error fetching automation flow:", error);
      res.status(500).json({ message: "Failed to fetch automation flow" });
    }
  });

  app.put('/api/automation-flows/:id', ...withOrgContext, requirePermission('flows.edit'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      const userId = getUserId(req);
      if (!organizationId) return res.status(400).json({ message: "Organization context required" });
      const existing = await storage.getAutomationFlowByOrganization(req.params.id, organizationId);
      if (!existing) return res.status(404).json({ message: "Flow not found" });
      const updateSchema = insertAutomationFlowSchema.partial();
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid update data", errors: parsed.error.errors });
      }
      const nextStatus = parsed.data.status != null ? String(parsed.data.status).toLowerCase() : null;
      const wasActive = String(existing.status || "").toLowerCase() === "active";
      if (nextStatus === "active" && !wasActive) {
        const quota = await assertPlanQuota({
          userId,
          organizationId,
          kind: "workflows",
          activating: true,
        });
        if (quota) return sendPlanQuotaDenial(res, quota);
      }
      const updated = await storage.updateAutomationFlowByOrganization(req.params.id, organizationId, parsed.data);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating automation flow:", error);
      res.status(500).json({ message: "Failed to update automation flow" });
    }
  });

  app.post(
    "/api/flows/:flowId/nodes/:nodeId/test",
    ...withOrgContext,
    requirePermission("flows.edit"),
    async (req: any, res) => {
      try {
        const organizationId = req.context?.organizationId;
        if (!organizationId) {
          return res.status(400).json({ message: "Organization context required" });
        }
        const flow = await storage.getAutomationFlowByOrganization(req.params.flowId, organizationId);
        if (!flow) {
          return res.status(404).json({ message: "Flow not found" });
        }
        const body =
          req.body && typeof req.body === "object" && !Array.isArray(req.body)
            ? (req.body as Record<string, unknown>)
            : {};
        const sampleBody =
          body.sampleBody && typeof body.sampleBody === "object" && !Array.isArray(body.sampleBody)
            ? (body.sampleBody as Record<string, unknown>)
            : undefined;
        const { runFlowTriggerNodeTest } = await import("./automation/flow-node-test");
        const result = runFlowTriggerNodeTest(flow, req.params.nodeId, {
          sampleBody,
          headers:
            body.headers && typeof body.headers === "object"
              ? (body.headers as Record<string, string>)
              : undefined,
        });
        return res.json({ success: true, ...result });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Test failed";
        return res.status(400).json({ success: false, error: msg });
      }
    }
  );

  /** Postman-ready sample for the flow's trigger (URL, headers, body, curl). */
  app.get(
    "/api/flows/:flowId/webhook-test-payload",
    ...withOrgContext,
    requirePermission("flows.view"),
    async (req: any, res) => {
      try {
        const organizationId = req.context?.organizationId;
        if (!organizationId) {
          return res.status(400).json({ message: "Organization context required" });
        }
        const flow = await storage.getAutomationFlowByOrganization(req.params.flowId, organizationId);
        if (!flow) {
          return res.status(404).json({ message: "Flow not found" });
        }
        const {
          buildFlowWebhookTestPayload,
          resolveFlowTriggerIdFromNodes,
          listWebhookTestTriggerIds,
        } = await import("./automation/flow-test-payloads");
        const nodeId = typeof req.query.nodeId === "string" ? req.query.nodeId : undefined;
        const queryTrigger = typeof req.query.trigger === "string" ? req.query.trigger.trim() : "";
        const triggerId =
          queryTrigger ||
          resolveFlowTriggerIdFromNodes(flow.nodes as any, nodeId) ||
          "catch-raw-webhook";
        const baseUrl = (
          process.env.BASE_URL ||
          process.env.WEBHOOK_URL ||
          `${req.protocol}://${req.get("host")}` ||
          ""
        )
          .split(/\s*[\n#]/)[0]
          .trim()
          .replace(/\/+$/, "");
        const payload = buildFlowWebhookTestPayload({
          flowId: String(flow.id),
          triggerId,
          baseUrl,
        });
        return res.json({
          success: true,
          flowId: flow.id,
          flowStatus: flow.status,
          ...payload,
          availableTriggers: listWebhookTestTriggerIds(),
        });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Failed to build test payload";
        return res.status(500).json({ success: false, message: msg });
      }
    }
  );

  /** Fire the public flow webhook with a sample (or custom) payload — same path Postman uses. */
  app.post(
    "/api/flows/:flowId/send-test-webhook",
    ...withOrgContext,
    requirePermission("flows.edit"),
    async (req: any, res) => {
      try {
        const organizationId = req.context?.organizationId;
        if (!organizationId) {
          return res.status(400).json({ message: "Organization context required" });
        }
        const flow = await storage.getAutomationFlowByOrganization(req.params.flowId, organizationId);
        if (!flow) {
          return res.status(404).json({ message: "Flow not found" });
        }
        const {
          buildFlowWebhookTestPayload,
          resolveFlowTriggerIdFromNodes,
        } = await import("./automation/flow-test-payloads");
        const reqBody =
          req.body && typeof req.body === "object" && !Array.isArray(req.body)
            ? (req.body as Record<string, unknown>)
            : {};
        const nodeId = typeof reqBody.nodeId === "string" ? reqBody.nodeId : undefined;
        const triggerId =
          (typeof reqBody.triggerId === "string" && reqBody.triggerId.trim()) ||
          resolveFlowTriggerIdFromNodes(flow.nodes as any, nodeId) ||
          "catch-raw-webhook";
        const sample = buildFlowWebhookTestPayload({
          flowId: String(flow.id),
          triggerId,
        });
        if (!sample.webhookCapable) {
          return res.status(400).json({
            success: false,
            message: `Trigger "${triggerId}" cannot be fired via webhook. ${sample.notes.join(" ")}`,
            notes: sample.notes,
          });
        }
        const body =
          reqBody.body && typeof reqBody.body === "object" && !Array.isArray(reqBody.body)
            ? (reqBody.body as Record<string, unknown>)
            : sample.body;
        const headers =
          reqBody.headers && typeof reqBody.headers === "object" && !Array.isArray(reqBody.headers)
            ? (reqBody.headers as Record<string, string>)
            : sample.headers;

        const { handleFlowWebhook } = await import("./automation/flow-webhook");
        const result = await handleFlowWebhook(String(flow.id), body, { headers });
        return res.status(result.status || 200).json({
          success: result.ok,
          ...result,
          used: { triggerId, headers, body },
          tip: result.ran
            ? "Flow ran. Check Runs / Inbox. Delay nodes still wait their configured time."
            : "Did not run — publish the flow (Active) and ensure the trigger matches.",
        });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Send test webhook failed";
        return res.status(500).json({ success: false, message: msg });
      }
    }
  );

  app.delete('/api/automation-flows/:id', ...withOrgContext, requirePermission('flows.delete'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      if (!organizationId) return res.status(400).json({ message: "Organization context required" });
      const existing = await storage.getAutomationFlowByOrganization(req.params.id, organizationId);
      if (!existing) return res.status(404).json({ message: "Flow not found" });
      await storage.deleteAutomationFlowByOrganization(req.params.id, organizationId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting automation flow:", error);
      res.status(500).json({ message: "Failed to delete automation flow" });
    }
  });

  app.get('/api/automation-flows/:id/runs', ...withOrgContext, requirePermission('flows.view'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      if (!organizationId) return res.status(400).json({ message: "Organization context required" });
      const flow = await storage.getAutomationFlowByOrganization(req.params.id, organizationId);
      if (!flow) return res.status(404).json({ message: "Flow not found" });
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "50"), 10) || 50));
      const runs = await storage.getAutomationFlowRunsByFlow(flow.id, limit);
      res.json(runs);
    } catch (error: any) {
      console.error("Error fetching automation flow runs:", error);
      res.status(500).json({ message: "Failed to fetch automation flow runs" });
    }
  });

  app.get('/api/automation-flows/:id/runs/:runId/logs', ...withOrgContext, requirePermission('flows.view'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      if (!organizationId) return res.status(400).json({ message: "Organization context required" });
      const flow = await storage.getAutomationFlowByOrganization(req.params.id, organizationId);
      if (!flow) return res.status(404).json({ message: "Flow not found" });
      const run = await storage.getAutomationFlowRunById(req.params.runId);
      if (!run || run.flowId !== flow.id) {
        return res.status(404).json({ message: "Run not found" });
      }
      const limit = Math.min(500, Math.max(1, parseInt(String(req.query.limit || "200"), 10) || 200));
      const logs = await storage.getAutomationFlowRunLogs(run.id, limit);
      res.json(logs);
    } catch (error: any) {
      console.error("Error fetching automation flow run logs:", error);
      res.status(500).json({ message: "Failed to fetch automation flow run logs" });
    }
  });

  // Webhook forwarding management endpoints (for multiple domain support)
  // These endpoints allow managing forwarding URLs that receive webhook events
  app.get('/api/webhooks/forwarding-urls', ...withOrgContext, requirePermission('manage_settings.webhook', 'webhook_events.view'), async (req: any, res) => {
    try {
      const urls = webhookForwarder.getForwardingUrls();
      res.json({ urls });
    } catch (error: any) {
      console.error("Error fetching forwarding URLs:", error);
      res.status(500).json({ message: "Failed to fetch forwarding URLs" });
    }
  });

  app.post('/api/webhooks/forwarding-urls', ...withOrgContext, requirePermission('manage_settings.webhook', 'webhook_events.create'), async (req: any, res) => {
    try {
      const { url, enabled = true, timeout = 10000 } = req.body;

      if (!url || typeof url !== 'string') {
        return res.status(400).json({ message: "URL is required and must be a string" });
      }

      // Validate URL format
      try {
        new URL(url);
      } catch {
        return res.status(400).json({ message: "Invalid URL format" });
      }

      webhookForwarder.addForwardingUrl(url, enabled, timeout);
      res.json({ success: true, urls: webhookForwarder.getForwardingUrls() });
    } catch (error: any) {
      console.error("Error adding forwarding URL:", error);
      res.status(500).json({ message: "Failed to add forwarding URL" });
    }
  });

  app.delete('/api/webhooks/forwarding-urls', ...withOrgContext, requirePermission('manage_settings.webhook', 'webhook_events.delete'), async (req: any, res) => {
    try {
      const { url } = req.body;

      if (!url || typeof url !== 'string') {
        return res.status(400).json({ message: "URL is required and must be a string" });
      }

      webhookForwarder.removeForwardingUrl(url);
      res.json({ success: true, urls: webhookForwarder.getForwardingUrls() });
    } catch (error: any) {
      console.error("Error removing forwarding URL:", error);
      res.status(500).json({ message: "Failed to remove forwarding URL" });
    }
  });

  const httpServer = createServer(app);

  // WebSocket server for real-time updates (user-scoped with server-side auth)
  const wss = new WebSocketServer({ noServer: true });

  // Ping/pong keepalive - prevents proxies/load balancers from closing idle connections (common white-label issue)
  const HEARTBEAT_INTERVAL = 30_000; // 30s
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws: WebSocket & { isAlive?: boolean }) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL);
  wss.on('close', () => clearInterval(heartbeatInterval));

  // Map of clientId -> { ws: WebSocket, userId: string }
  const clients = new Map<string, { ws: WebSocket; userId: string }>();

  // Get session middleware
  const sessionMiddleware = getSession();

  // Handle WebSocket upgrade with session verification
  httpServer.on('upgrade', (req: any, socket, head) => {
    // Vite dev HMR uses ws://host:port/?token=… (pathname "/"), not "/ws". Destroying those
    // sockets breaks HMR; the client then reloads in a loop (see vite client.mjs close handler).
    const pathname = (req.url || "/").split("?")[0] || "/";
    if (pathname !== "/ws") {
      return;
    }

    // Create a fake response object for session middleware
    const res: any = {
      getHeader: () => {},
      setHeader: () => {},
      end: () => {},
    };

    // Run session middleware to parse and verify the session
    sessionMiddleware(req, res, () => {
      // Check if user is authenticated via session
      if (req.session?.passport?.user?.claims?.sub) {
        const userId = req.session.passport.user.claims.sub;
        
        wss.handleUpgrade(req, socket, head, (ws) => {
          const clientId = Math.random().toString(36).substring(7);
          clients.set(clientId, { ws, userId });
          (ws as any).isAlive = true;
          ws.on('pong', () => { (ws as any).isAlive = true; });
          
          console.log(`WebSocket client ${clientId} authenticated as user ${userId}`);
          
          wss.emit('connection', ws, req, userId);

          ws.on('close', () => {
            clients.delete(clientId);
            console.log('WebSocket client disconnected:', clientId);
          });

          ws.on('error', (error) => {
            console.error('WebSocket error:', error);
          });
        });
      } else {
        // Not authenticated - reject connection
        console.log('WebSocket connection rejected: not authenticated');
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
      }
    });
  });

  // Send to specific user's WebSocket connections only
  const broadcastToUser = (userId: string, event: string, data: any) => {
    const message = JSON.stringify({ event, data });
    let sentCount = 0;
    clients.forEach((client) => {
      if (client.userId === userId) {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(message);
          sentCount++;
          console.log(`[Broadcast] Message sent to WebSocket client for user ${userId}, event: ${event}`);
        } else {
          console.warn(`[Broadcast] WebSocket not open for user ${userId}, state: ${client.ws.readyState}`);
        }
      }
    });
    if (sentCount === 0) {
      console.warn(`[Broadcast] No active WebSocket connections found for user ${userId}, total clients: ${clients.size}`);
    }
  };

  setPanelOutboundBroadcaster(broadcastToUser);
  setOptKeywordBroadcaster(broadcastToUser);

  // Session Management Endpoints
  
  app.post('/api/sessions/create', ...withAuthAndRateLimit, checkUsageLimits('session'), incrementUsage('session'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      
      // Check existing sessions and clean up old disconnected ones (run in parallel for speed)
      const existingSessions = await storage.getSessionsByUser(userId);
      
      // Check for too many active sessions first (quick check before cleanup)
      const activeSessions = existingSessions.filter(s => 
        s.status === 'connected' || s.status === 'connecting' || s.status === 'qr'
      );
      
      if (activeSessions.length >= 4) {
        return res.status(429).json({ 
          error: 'Too many active sessions',
          message: 'WhatsApp allows a maximum of 4-5 linked devices. Please disconnect an existing session before creating a new one.',
          activeSessions: activeSessions.length
        });
      }
      
      // Cleanup old sessions asynchronously (don't block response)
      (async () => {
        try {
          const disconnectedSessions = existingSessions.filter(s => 
            s.status === 'disconnected' && !(s as any).deletedAt
          );
          const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
          
          // Clean up disconnected sessions in parallel (exclude soft-deleted - preserve for reconnect)
          await Promise.allSettled(
            disconnectedSessions
              .filter(s => new Date(s.createdAt) < tenMinutesAgo)
              .map(async (session) => {
                try {
                  console.log(`[Routes] Cleaning up old disconnected session: ${session.sessionId}`);
                  await storage.deleteSession(session.sessionId);
                  if (session.connectionType === 'unofficial') {
                    try {
                      await unofficialManager.disconnectSession(session.sessionId);
                    } catch (e) {
                      // Ignore errors if session doesn't exist in client
                    }
                  }
                } catch (e) {
                  console.error(`[Routes] Error cleaning up session ${session.sessionId}:`, e);
                }
              })
          );
          
          // Clean up stuck sessions in parallel
          const stuckSessions = existingSessions.filter(s => 
            (s.status === 'connecting' || s.status === 'qr') && 
            new Date(s.createdAt) < new Date(Date.now() - 15 * 60 * 1000)
          );
          
          await Promise.allSettled(
            stuckSessions.map(async (session) => {
              try {
                console.log(`[Routes] Cleaning up stuck session: ${session.sessionId} (status: ${session.status})`);
                await storage.updateSession(session.sessionId, { status: 'disconnected' });
                if (session.connectionType === 'unofficial') {
                  try {
                    await unofficialManager.disconnectSession(session.sessionId);
                  } catch (e) {
                    // Ignore errors
                  }
                }
              } catch (e) {
                console.error(`[Routes] Error cleaning up stuck session ${session.sessionId}:`, e);
              }
            })
          );
        } catch (error) {
          console.error('[Routes] Error during async cleanup:', error);
        }
      })();
      
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const { connectionType = 'unofficial', businessApiCredentials } = req.body;
      
      // Validate connectionType
      if (!['unofficial', 'official'].includes(connectionType)) {
        return res.status(400).json({ error: 'Invalid connection type. Must be "unofficial" or "official"' });
      }

      // Validate Business API credentials if official connection
      if (connectionType === 'official') {
        if (!businessApiCredentials?.phoneNumberId || !businessApiCredentials?.accessToken) {
          return res.status(400).json({ 
            error: 'Business API credentials required for official connection',
            required: ['phoneNumberId', 'accessToken']
          });
        }
      }
      
      const session = await storage.createSession({
        userId,
        organizationId: req.organizationId || req.context?.organizationId || undefined,
        sessionId,
        connectionType,
        status: 'connecting',
      });

      // Select appropriate WhatsApp manager
      const manager = connectionType === 'official' ? businessAPIManager : unofficialManager;

      // Set up callbacks (not needed for Business API as it uses webhooks)
      if (connectionType !== 'official') {
        console.log(`[Routes] Registering QR code callback for session ${sessionId}`);
        manager.onQRCode(sessionId, async (qr) => {
          console.log(`[Routes] QR code callback triggered for session ${sessionId}, length: ${qr.length}`);
          
          // Note: QR code is already saved by WhatsApp client, but we update status here if needed
          // Save QR code to database - use sessionId (string), not session.id (UUID)
          const updateResult = await storage.updateSession(sessionId, { qrCode: qr, status: 'qr' });
          console.log(`[Routes] QR code saved to database for session ${sessionId}, result:`, updateResult ? 'success' : 'failed');
          
          // Broadcast via WebSocket
          console.log(`[Routes] Broadcasting QR code update to user ${userId} via WebSocket`);
          broadcastToUser(userId, 'qr_update', { sessionId, qrCode: qr });
          console.log(`[Routes] QR code broadcast sent to user ${userId}`);
        });
        console.log(`[Routes] QR code callback registered for session ${sessionId}`);
      }

      manager.onStatusChange(sessionId, async (status) => {
        console.log(`[Session Status] ${sessionId} changed to: ${status}`);
        
        // Save status to database - use sessionId (string), not session.id (UUID)
        await storage.updateSession(sessionId, { status });
        console.log(`[Session Status] Saved to database for session ${sessionId}`);
        
        // Broadcast via WebSocket
        broadcastToUser(userId, 'session_status', { sessionId, status });
        
        // Trigger webhooks for session status changes
        if (status === 'connected') {
          await triggerWebhooks(userId, 'session.connected', { sessionId, status });
        } else if (status === 'disconnected') {
          await triggerWebhooks(userId, 'session.disconnected', { sessionId, status });
        }
      });

      // When someone sends a reaction (unofficial client), broadcast so UI updates
      if (typeof (manager as any).onReaction === 'function') {
        (manager as any).onReaction(sessionId, (updatedMessage: any) => {
          broadcastToUser(userId, 'message_updated', {
            chatId: updatedMessage.chatId,
            messageId: updatedMessage.id,
            message: updatedMessage,
          });
        });
      }

      manager.onMessage(sessionId, async (msg) => {
        try {
          // Skip broadcast/status messages that don't have valid chat IDs
          if (!msg.senderNumber || msg.senderNumber === 'status@broadcast' || msg.chatId === 'status@broadcast') {
            console.log(`[Routes] Skipping broadcast/status message: ${msg.chatId}`);
            return;
          }

          // Normalize phone number for comparison
          const normalizedSenderNumber = normalizePhoneNumber(msg.senderNumber);
          
          // Find or create chat FIRST before creating message (normalize for comparison)
          let chat = (await storage.getChatsBySession(sessionId))
            .find(c => {
              const normalizedChat = normalizePhoneNumber(c.contactNumber);
              return normalizedChat === normalizedSenderNumber;
            });

          let isNewChat = false;
          if (!chat) {
            isNewChat = true;
            // Detect if this is a group based on WhatsApp ID format
            const isGroup = msg.senderNumber.includes('@g.us');
            
            // Ensure senderNumber has proper format for storage
            let formattedSenderNumber = msg.senderNumber;
            if (!isGroup && !formattedSenderNumber.includes('@c.us') && !formattedSenderNumber.includes('@g.us')) {
              formattedSenderNumber = `${formattedSenderNumber}@c.us`;
            }
            
            // First, find or create the contact (normalize for comparison)
            const existingContacts = await storage.getContactsBySession(sessionId);
            let contact = existingContacts.find(c => {
              const normalizedContact = normalizePhoneNumber(c.number);
              return normalizedContact === normalizedSenderNumber;
            });
            
            if (!contact) {
              // Create new contact
              contact = await storage.createContact({
                sessionId,
                name: msg.senderName || formattedSenderNumber.replace('@c.us', ''),
                number: formattedSenderNumber,
                isGroup,
              });
            }
            
            // Now create chat using the contact's UUID
            chat = await storage.createChat({
              sessionId: msg.sessionId,
              contactId: contact.id, // Use the contact's database UUID, not WhatsApp chatId
              contactName: msg.senderName || formattedSenderNumber.replace('@c.us', ''),
              contactNumber: formattedSenderNumber,
              lastMessage: msg.body,
              lastMessageTime: new Date(),
              unreadCount: msg.fromMe ? 0 : 1,
              isGroup,
            });
          } else {
            // Update existing chat
            await storage.updateChat(chat.id, {
              lastMessage: msg.body,
              lastMessageTime: new Date(),
              unreadCount: chat.unreadCount + (msg.fromMe ? 0 : 1),
            });
          }

          const priorInboundCount = !msg.fromMe
            ? (await storage.getMessagesByChat(chat.id)).filter((m) => !m.fromMe).length
            : 0;
          const isFirstInboundMessage = !msg.fromMe && priorInboundCount === 0;

          // Handle media URL for incoming messages
          let mediaUrl: string | null = null;
          if (msg.hasMedia && (msg as any).mediaId) {
            // For Business API, try to get media URL from media ID
            if (connectionType === 'official') {
              try {
                const mediaInfo = await businessAPIManager.getMediaForTemplate(msg.sessionId, (msg as any).mediaId);
                mediaUrl = mediaInfo.url;
              } catch (error) {
                console.warn(`[Routes] Could not get media URL for incoming message:`, error);
                // Store media ID as fallback
                mediaUrl = (msg as any).mediaId;
              }
            } else {
              // For unofficial client, media URL should be in msg.mediaUrl
              mediaUrl = (msg as any).mediaUrl || null;
            }
          }

          // Parse buttons and footer from incoming message (if any)
          // Use footer data from msg if available (from Business API processing)
          let footerButtonType: 'NONE' | 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | null = (msg as any).footerButtonType || null;
          let footerButtonText: string | null = (msg as any).footerButtonText || null;
          let footerButtonUrl: string | null = (msg as any).footerButtonUrl || null;
          let footerButtonPhone: string | null = (msg as any).footerButtonPhone || null;
          let footer: string | null = (msg as any).footer || null;
          
          // Check if message has interactive buttons (Business API) - fallback if not already set
          // Support both snake_case (webhook) and camelCase (formattedMessage from Business API client)
          if (!footerButtonType && (msg as any).interactive) {
            const interactive = (msg as any).interactive;
            const btnReply = interactive.button_reply || interactive.buttonReply;
            const listReply = interactive.list_reply || interactive.listReply;
            if (interactive.type === 'button_reply' && btnReply) {
              footerButtonType = 'QUICK_REPLY';
              footerButtonText = JSON.stringify([{
                type: 'QUICK_REPLY',
                text: btnReply.title || '',
              }]);
            } else if (interactive.type === 'list_reply' && listReply) {
              footerButtonType = 'QUICK_REPLY';
              footerButtonText = JSON.stringify([{
                type: 'QUICK_REPLY',
                text: listReply.title || '',
              }]);
            }
          }

          // Now create message with the chat's ID (not the raw chatId from WhatsApp)
          // Map WhatsApp 'interactive' (button/list reply) to 'text' for DB enum
          const messageType = (msg as any).type === 'interactive' ? 'text' : (msg as any).type;
          if (msg.fromMe) {
            console.log(`[Routes] Storing message sent from WhatsApp Business app:`, {
              sessionId: msg.sessionId,
              chatId: chat.id,
              body: msg.body?.substring(0, 50),
              senderNumber: msg.senderNumber,
              whatsappMessageId: (msg as any).whatsappMessageId,
            });
          }
          const message = await storage.createMessage({
            sessionId: msg.sessionId,
            chatId: chat.id, // Use the chat's database ID, not WhatsApp chatId
            body: msg.body,
            fromMe: msg.fromMe,
            type: messageType,
            status: msg.fromMe ? 'sent' : 'delivered', // Sent messages start as 'sent', received as 'delivered'
            senderName: msg.senderName,
            senderNumber: msg.senderNumber,
            mediaUrl: mediaUrl,
            footer: footer,
            footerButtonType: footerButtonType,
            footerButtonText: footerButtonText,
            footerButtonUrl: footerButtonUrl,
            footerButtonPhone: footerButtonPhone,
            whatsappMessageId: (msg as any).whatsappMessageId ?? (msg as any).id ?? undefined,
            replyToMessageId: (msg as any).replyToMessageId ?? undefined,
            quotedBody: (msg as any).quotedBody ?? undefined,
            quotedFromMe: (msg as any).quotedFromMe ?? undefined,
          });

          // Human takeover: stop chatbot when agent manually sends a message (unofficial client)
          if (msg.fromMe) {
            clearChatbotConversationForContact(msg.sessionId, msg.senderNumber);
          }

          // Create/update managed contact for incoming messages (to ensure contacts appear on /contacts page)
          // This works for both Business API (callback path) and unofficial WhatsApp
          if (!msg.fromMe) {
            try {
              const session = await storage.getSession(sessionId);
              if (session) {
                // Derive organizationId: sessions don't have it, so use integration's org or user's first org
                // (Contacts page shows contacts by org; without this, new contacts would have org=null and not appear)
                let organizationId: string | undefined = (session.deviceInfo as any)?.integrationId
                  ? (await storage.getIntegration((session.deviceInfo as any).integrationId, session.userId))?.organizationId ?? undefined
                  : undefined;
                if (!organizationId) {
                  const orgs = await storage.getOrganizationsByUser(session.userId);
                  organizationId = orgs[0]?.id ?? undefined;
                }
                const orgIdForStorage = organizationId ?? '';

                console.log('[Routes] Processing managed contact creation for incoming message:', {
                  sessionId,
                  senderNumber: normalizedSenderNumber,
                  senderName: msg.senderName,
                  userId: session.userId,
                  organizationId: organizationId || '(default)',
                });
                
                const managedContacts = await storage.getManagedContactsByUser(session.userId, orgIdForStorage);
                
                // Normalize phone number for managed contacts (remove + and @c.us, keep only digits)
                const phoneForManaged = normalizedSenderNumber.replace(/[^\d]/g, '');
                
                // Check if managed contact already exists with this phone number
                const existingManagedContact = managedContacts.find(mc => {
                  const mcPhone = mc.phoneNumber.replace(/[^\d]/g, ''); // Remove all non-digits
                  return mcPhone === phoneForManaged;
                });
                
                if (!existingManagedContact) {
                  // Create new managed contact with source "whatsapp"
                  const contactDisplayName = msg.senderName && msg.senderName !== normalizedSenderNumber.replace('@c.us', '').replace('@g.us', '') 
                    ? msg.senderName 
                    : phoneForManaged;
                  
                  await storage.createManagedContact(
                    {
                      userId: session.userId,
                      organizationId: organizationId || undefined,
                      name: contactDisplayName,
                      phoneNumber: phoneForManaged,
                      source: "whatsapp",
                    },
                    { skipAutomation: true }
                  );
                  console.log('[Routes] ✅ Created managed contact with source "whatsapp":', {
                    name: contactDisplayName,
                    phoneNumber: phoneForManaged,
                    userId: session.userId,
                    organizationId: organizationId || '(default)',
                  });
                } else if (existingManagedContact.source !== 'whatsapp') {
                  // Update existing managed contact to set source as "whatsapp" if it's not already set
                  await storage.updateManagedContact(
                    existingManagedContact.id,
                    session.userId,
                    orgIdForStorage,
                    { source: "whatsapp" },
                    { skipAutomation: true }
                  );
                  console.log('[Routes] ✅ Updated managed contact source to "whatsapp":', {
                    contactId: existingManagedContact.id,
                    phoneNumber: phoneForManaged,
                    userId: session.userId,
                  });
                } else {
                  console.log('[Routes] ℹ️  Managed contact already exists with source "whatsapp":', {
                    contactId: existingManagedContact.id,
                    phoneNumber: phoneForManaged,
                    name: existingManagedContact.name,
                  });
                }
              } else {
                console.warn('[Routes] ⚠️  Session not found for managed contact creation:', sessionId);
              }
            } catch (managedContactError: any) {
              // Log error but don't fail message storage if managed contact creation fails
              console.error('[Routes] ❌ Could not create/update managed contact:', managedContactError.message);
              console.error('[Routes] Error details:', {
                error: managedContactError.message,
                stack: managedContactError.stack,
                sessionId,
                phoneNumber: normalizedSenderNumber,
                senderName: msg.senderName,
              });
            }
          }

          if (isFirstInboundMessage) {
            try {
              const sessionForLead = await storage.getSession(sessionId);
              if (sessionForLead) {
                const { maybeCreateLeadFromInbound } = await import("./leads/inbound-lead");
                const { resolveOrganizationIdForSession } = await import("./opt-keyword-service");
                const orgId = await resolveOrganizationIdForSession(sessionForLead);
                await maybeCreateLeadFromInbound({
                  userId: sessionForLead.userId,
                  organizationId: orgId,
                  sessionId,
                  phoneDigits: normalizedSenderNumber.replace(/[^\d]/g, ""),
                  name: msg.senderName,
                  source: "whatsapp",
                  firstMessagePreview: msg.body || "",
                });
              }
            } catch (leadErr: any) {
              console.error("[Routes] Could not create lead:", leadErr.message);
            }
          }

          broadcastToUser(userId, 'new_message', message);

          // Trigger webhooks for message events
          if (!msg.fromMe) {
            // Incoming message
            await triggerWebhooks(userId, 'message.received', {
              message,
              chat: {
                contactName: msg.senderName,
                contactNumber: msg.senderNumber,
              },
            });
          }

          // Trigger webhook for new chat
          if (isNewChat) {
            await triggerWebhooks(userId, 'chat.new', {
              contactName: msg.senderName,
              contactNumber: msg.senderNumber,
              sessionId: msg.sessionId,
            });
          }

          // Process chatbots for incoming messages (after storing message)
          // Include button/list replies (interactive) even when body may be empty
          if (!msg.fromMe && (msg.body || (msg as any).interactive)) {
            try {
              // Extract interactive data if available (button/list reply)
              const interactiveData = (msg as any).interactive ? {
                type: (msg as any).interactive.type,
                buttonReply: (msg as any).interactive.button_reply,
                listReply: (msg as any).interactive.list_reply,
                isTemplateButton: (msg as any).type === 'button',
              } : undefined;
              const messageBody = msg.body || interactiveData?.buttonReply?.title || interactiveData?.listReply?.title || '';
              const { handleIncomingMessageOptStatus, resolveOrganizationIdForSession } = await import("./opt-keyword-service");
              const effectiveOrgId = await resolveOrganizationIdForSession(session);
              const { optedOut } = await handleIncomingMessageOptStatus({
                organizationId: effectiveOrgId,
                userId,
                phoneNumber: msg.senderNumber,
                messageBody,
                interactive: interactiveData
                  ? {
                      buttonReply: interactiveData.buttonReply,
                      listReply: interactiveData.listReply,
                    }
                  : undefined,
              });
              if (!optedOut) {
                await processMessageForChatbots(
                  sessionId,
                  msg.senderNumber,
                  messageBody,
                  userId,
                  effectiveOrgId,
                  interactiveData
                );
              }
            } catch (chatbotError: any) {
              // Log but don't fail message processing if chatbot execution fails
              console.error(`[Routes] Error processing chatbots:`, chatbotError);
            }
          }
        } catch (error: any) {
          console.error(`[Routes] Error processing message for session ${sessionId}:`, error);
          // Don't throw - just log the error to prevent breaking the message handler
        }
      });

      // Return response immediately, initialize client asynchronously
      res.json({ 
        success: true, 
        sessionId,
        session,
        connectionType 
      });

      // Initialize WhatsApp client asynchronously (don't block response)
      (async () => {
        try {
          if (connectionType === 'official' && businessApiCredentials) {
            await businessAPIManager.createSession(sessionId, {
              phoneNumberId: businessApiCredentials.phoneNumberId,
              accessToken: businessApiCredentials.accessToken,
              businessAccountId: businessApiCredentials.businessAccountId,
            });
          } else {
            await unofficialManager.createSession(sessionId);
          }
        } catch (clientError: any) {
          console.error(`[Routes] Error initializing WhatsApp client for session ${sessionId}:`, clientError);
          // Rollback session creation if client initialization fails
          await storage.updateSession(sessionId, { status: 'disconnected' });
          // Notify user via WebSocket about the error
          broadcastToUser(userId, 'session_error', { 
            sessionId, 
            error: `Failed to initialize WhatsApp client: ${clientError.message}` 
          });
        }
      })();
    } catch (error: any) {
      console.error('Error creating session:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  app.get('/api/sessions', ...withAuthAndRateLimit, ...withOrgContext, requirePermission('inbox.view'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const includeDeleted = req.query?.includeDeleted === 'true';
      const organizationId = req.context?.organizationId;
      // Return organization's sessions so all team members with inbox access see the same WhatsApp/chats
      const sessions = organizationId
        ? await storage.getSessionsByOrganization(organizationId)
        : await storage.getSessionsByUser(userId);
      // Exclude soft-deleted sessions unless includeDeleted=true (for chat page to show chat history)
      const activeSessions = includeDeleted ? sessions : sessions.filter((s: any) => !s.deletedAt);
      res.json(activeSessions);
    } catch (error: any) {
      console.error('Error getting sessions:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * Permanently delete a session that was soft-removed from Connect (deletedAt set).
   * Drops the row and cascades chats/messages/contacts; cannot be undone.
   */
  app.delete(
    '/api/sessions/:sessionId/permanent',
    ...withAuthAndRateLimit,
    ...withOrgContext,
    requirePermission('inbox.view'),
    async (req: any, res) => {
      try {
        const userId = getUserId(req);
        const { sessionId } = req.params;
        const organizationId = req.context?.organizationId;

        const session = await storage.getSession(sessionId);
        if (!session) {
          return res.status(404).json({ error: 'Session not found' });
        }

        if (organizationId) {
          const orgSessions = await storage.getSessionsByOrganization(organizationId);
          const ok = orgSessions.some((s: any) => s.sessionId === sessionId);
          if (!ok) {
            return res.status(404).json({ error: 'Session not found' });
          }
        } else if (session.userId !== userId) {
          return res.status(404).json({ error: 'Session not found' });
        }

        if (!(session as any).deletedAt) {
          return res.status(400).json({
            error: 'Not a removed number',
            message:
              'Only numbers removed from Connect can be permanently deleted here. Remove the number on Connect first, or use this action from Chat for "Removed" entries.',
          });
        }

        try {
          const manager = await getWhatsAppManager(sessionId);
          await manager.disconnectSession(sessionId);
        } catch (_) {
          // Session may not be in memory
        }

        await storage.deleteSession(sessionId);
        broadcastToUser(session.userId, 'session_status', {
          sessionId,
          status: 'deleted',
          permanent: true,
        });

        res.json({ success: true, message: 'Number and its chat history were permanently deleted.' });
      } catch (error: any) {
        console.error('Error permanently deleting session:', error);
        res.status(500).json({ error: error.message || 'Failed to delete session' });
      }
    }
  );

  app.post('/api/sessions/:sessionId/disconnect', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { sessionId } = req.params;

      // Verify session belongs to user
      const session = await storage.getSession(sessionId);
      if (!session || session.userId !== userId) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      const manager = await getWhatsAppManager(sessionId);
      try {
        await manager.disconnectSession(sessionId);
      } catch (disconnectErr: any) {
        console.warn(`[Disconnect] Manager disconnect failed for ${sessionId}:`, disconnectErr?.message);
      }
      await storage.updateSession(sessionId, { status: 'disconnected', qrCode: undefined });
      
      broadcastToUser(userId, 'session_status', { sessionId, status: 'disconnected' });

      // Trigger webhook for session disconnect
      await triggerWebhooks(userId, 'session.disconnected', { sessionId, status: 'disconnected' });

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error disconnecting session:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Request old message sync (premium feature)
  app.post('/api/sessions/:sessionId/request-message-sync', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { sessionId } = req.params;
      const organizationId = req.organizationId;

      // Verify session belongs to user
      const session = await storage.getSession(sessionId);
      if (!session || session.userId !== userId) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Check if session is connected
      if (session.status !== 'connected') {
        return res.status(400).json({ error: 'Session must be connected to request message sync' });
      }

      // Check user's subscription plan
      const subscription = await storage.getSubscriptionByUser(userId);
      if (!subscription || subscription.status !== 'active') {
        return res.status(403).json({
          error: 'Active subscription required',
          message: 'You need an active subscription to request message history sync. Please upgrade your plan.',
          upgradeRequired: true,
        });
      }

      const plan = await storage.getPlan(subscription.planId);
      if (!plan || !plan.isActive) {
        return res.status(403).json({
          error: 'Invalid subscription plan',
          message: 'Your subscription plan is invalid. Please contact support.',
        });
      }

      // Check if plan includes message history sync feature
      if (!plan.features.hasMessageHistorySync) {
        return res.status(403).json({
          error: 'Feature not available',
          message: `Message history sync is not available in your current plan (${plan.displayName}). Please upgrade to a plan that includes this feature.`,
          upgradeRequired: true,
          currentPlan: plan.name,
        });
      }

      // Check if there's already a pending or approved request for this session
      const existingRequests = await storage.getMessageSyncRequestsByUser(userId, organizationId);
      const activeRequest = existingRequests.find(
        r => r.sessionId === sessionId && 
        (r.status === 'pending' || r.status === 'approved' || r.status === 'processing')
      );

      if (activeRequest) {
        return res.status(400).json({ 
          error: 'Request already exists',
          requestId: activeRequest.id,
          status: activeRequest.status,
          message: `You already have a ${activeRequest.status} request for this session.`
        });
      }

      // Estimate message count and storage size
      // Rough estimate: 50 messages per chat, average 200 bytes per message
      const estimatedChats = 50; // Conservative estimate
      const estimatedMessages = estimatedChats * 50;
      const estimatedStorageBytes = estimatedMessages * 200; // ~10MB
      const estimatedStorageMB = Math.ceil(estimatedStorageBytes / (1024 * 1024));

      // Use plan's pricing for message sync
      const pricePerMB = plan.features.messageHistorySyncPricePerMB || 10; // Default 10 cents per MB
      const estimatedPrice = estimatedStorageMB * pricePerMB;

      // Check if estimated storage exceeds plan limit
      if (plan.features.maxMessageHistorySyncMB && estimatedStorageMB > plan.features.maxMessageHistorySyncMB) {
        return res.status(400).json({
          error: 'Storage limit exceeded',
          message: `Estimated storage (${estimatedStorageMB}MB) exceeds your plan limit (${plan.features.maxMessageHistorySyncMB}MB). Please upgrade your plan or contact support for a custom solution.`,
          estimatedStorageMB,
          maxStorageMB: plan.features.maxMessageHistorySyncMB,
        });
      }

      // Create sync request
      const request = await storage.createMessageSyncRequest({
        userId,
        organizationId: organizationId || null,
        sessionId,
        status: 'pending',
        estimatedMessageCount: estimatedMessages,
        estimatedStorageSize: estimatedStorageBytes,
        price: estimatedPrice,
      });

      res.json({
        success: true,
        request: {
          id: request.id,
          status: request.status,
          estimatedMessageCount: request.estimatedMessageCount,
          estimatedStorageMB,
          estimatedPrice: request.price,
          pricePerMB,
          planName: plan.displayName,
          message: 'Your request has been submitted. An admin will review and approve it. You will be charged based on actual storage used.',
        },
      });
    } catch (error: any) {
      console.error('Error creating message sync request:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get message sync requests for user
  app.get('/api/message-sync-requests', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.organizationId;
      const requests = await storage.getMessageSyncRequestsByUser(userId, organizationId);
      res.json(requests);
    } catch (error: any) {
      console.error('Error fetching message sync requests:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Execute approved message sync (requires approved request with payment)
  app.post('/api/sessions/:sessionId/sync-messages', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { sessionId } = req.params;
      const organizationId = req.organizationId;

      // Verify session belongs to user
      const session = await storage.getSession(sessionId);
      if (!session || session.userId !== userId) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Check if session is connected
      if (session.status !== 'connected') {
        return res.status(400).json({ error: 'Session must be connected to sync messages' });
      }

      // Check for approved sync request with payment
      const requests = await storage.getMessageSyncRequestsByUser(userId, organizationId);
      const approvedRequest = requests.find(
        r => r.sessionId === sessionId && 
        r.status === 'approved' && 
        r.paymentId !== null
      );

      if (!approvedRequest) {
        return res.status(403).json({ 
          error: 'Sync not authorized',
          message: 'You must request and pay for message history sync first. Old message syncing is a premium feature to prevent database bloat.',
          action: 'request_sync',
          endpoint: `/api/sessions/${sessionId}/request-message-sync`
        });
      }

      // Update request status to processing
      await storage.updateMessageSyncRequest(approvedRequest.id, userId, { status: 'processing' });

      // Return immediately, sync in background
      res.json({ 
        success: true, 
        message: 'Message sync started in background',
        requestId: approvedRequest.id,
      });

      // Sync messages in background
      (async () => {
        try {
          const manager = await getWhatsAppManager(sessionId);
          if (manager.isClientReady(sessionId) && typeof (manager as any).syncMessageHistory === 'function') {
            console.log(`[Routes] Starting approved message sync for session ${sessionId} (request ${approvedRequest.id})`);
            
            const startTime = Date.now();
            await (manager as any).syncMessageHistory(sessionId);
            const duration = Date.now() - startTime;
            
            // Calculate actual storage used (rough estimate)
            const totalMessages = await storage.countMessagesInSession(sessionId);
            const actualStorageBytes = totalMessages * 200; // Rough estimate
            
            // Update request with completion data
            await storage.updateMessageSyncRequest(approvedRequest.id, userId, {
              status: 'completed',
              completedAt: new Date(),
              actualMessageCount: totalMessages,
              actualStorageSize: actualStorageBytes,
            });
            
            console.log(`[Routes] Completed message sync for session ${sessionId} (${totalMessages} messages, ${Math.round(actualStorageBytes / 1024 / 1024)}MB)`);
            
            // Notify user via WebSocket
            broadcastToUser(userId, 'message_sync_complete', { 
              sessionId,
              messageCount: totalMessages,
              storageMB: Math.round(actualStorageBytes / 1024 / 1024),
            });
          } else {
            console.log(`[Routes] Client not ready or sync not supported for session ${sessionId}`);
            await storage.updateMessageSyncRequest(approvedRequest.id, userId, {
              status: 'failed',
              errorMessage: 'Client not ready or sync not supported',
            });
            broadcastToUser(userId, 'message_sync_error', { 
              sessionId, 
              error: 'Client not ready or sync not supported' 
            });
          }
        } catch (error: any) {
          console.error(`[Routes] Error syncing messages for session ${sessionId}:`, error);
          await storage.updateMessageSyncRequest(approvedRequest.id, userId, {
            status: 'failed',
            errorMessage: error.message,
          });
          broadcastToUser(userId, 'message_sync_error', { 
            sessionId, 
            error: error.message 
          });
        }
      })();
    } catch (error: any) {
      console.error('Error starting message sync:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Messaging Endpoints

  async function processSendTextMessage(
    userId: string,
    organizationId: string | null,
    validatedData: SendTextMessage
  ): Promise<import('./panel-inbox-send').PanelInboxSendTextResult> {
      const orgId = organizationId || undefined;
      const session = await storage.getSession(validatedData.sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      const manager = await getWhatsAppManager(validatedData.sessionId);
      
      // Ensure client exists and is ready (restore if needed)
      console.log(`[Send Text] Checking client readiness for session ${validatedData.sessionId}, connectionType: ${session.connectionType}, status: ${session.status}`);
      
      if (session.connectionType === 'unofficial' && typeof (manager as any).waitForClientReady === 'function') {
        console.log(`[Send Text] Using waitForClientReady for unofficial session ${validatedData.sessionId}...`);
        const isReady = await (manager as any).waitForClientReady(validatedData.sessionId, 35000);
        if (!isReady) {
          console.error(`[Send Text] WhatsApp client not ready for session ${validatedData.sessionId} after waiting 20s, status: ${session.status}`);
          console.error(`[Send Text] Session details:`, {
            sessionId: validatedData.sessionId,
            status: session.status,
            connectionType: session.connectionType,
            deviceInfo: session.deviceInfo,
          });
          throw new Error('The WhatsApp connection is still initializing or may have disconnected. Please try reconnecting the device or wait a moment and try again.');
        }
        console.log(`[Send Text] Client is ready after waitForClientReady`);
      } else if (session.connectionType === 'official') {
        // For Business API, check if credentials are available
        let isReady = manager.isClientReady(validatedData.sessionId);
        
        // If not ready, try to reload credentials from integrations table or user settings
        if (!isReady) {
          console.log(`[Send Text] Business API credentials not in memory, attempting to restore...`);
          
          let accessToken: string | null = null;
          let phoneNumberId: string | null = null;
          let businessAccountId: string | null = null;
          
          // First, try to get credentials from integrations table (OAuth-based)
          // Use session's integrationId when set (multiple Meta/WhatsApp accounts)
          try {
            const apiPhoneNumberId = session.deviceInfo?.apiPhoneNumberId;
            let integration = null;
            if (session.deviceInfo?.integrationId) {
              integration = await storage.getIntegration(session.deviceInfo.integrationId, userId);
              if (integration) console.log(`[Send Text] Using integration by session integrationId: ${integration.id}`);
            }
            if (!integration) {
              integration = await storage.getIntegrationByName("whatsapp-business", userId, organizationId || undefined);
            }
            // If we have a session phone number ID, find an integration whose token can access it (fixes reconnect / multi-account)
            if (apiPhoneNumberId) {
              const allIntegrations = await storage.getIntegrationsByUser(userId, organizationId || undefined);
              const whatsappIntegrations = allIntegrations.filter(
                (i: any) => i.name === "whatsapp-business" && i.status === "connected" && i.credentials
              );
              let foundIntegration: any = null;
              for (const int of whatsappIntegrations) {
                const creds = int.credentials as any;
                const token = creds?.access_token;
                if (!token) continue;
                try {
                  const checkRes = await fetch(
                    `https://graph.facebook.com/v23.0/${apiPhoneNumberId}?fields=id&access_token=${encodeURIComponent(token)}`
                  );
                  if (checkRes.ok) {
                    foundIntegration = int;
                    console.log(`[Send Text] Found integration ${int.id} that can access Phone Number ID ${apiPhoneNumberId}`);
                    break;
                  }
                } catch (_) {
                  continue;
                }
              }
              if (foundIntegration) {
                integration = foundIntegration;
                // Persist so next time we use this integration directly
                if (session.deviceInfo && foundIntegration.id !== session.deviceInfo.integrationId) {
                  storage.updateSession(validatedData.sessionId, {
                    deviceInfo: { ...session.deviceInfo, integrationId: foundIntegration.id },
                  }).catch(() => {});
                }
              }
            }
            if (integration?.status === "connected" && integration.credentials) {
              const credentials = integration.credentials as any;
              accessToken = credentials.access_token;
              
              if (session.deviceInfo?.apiPhoneNumberId) {
                phoneNumberId = session.deviceInfo.apiPhoneNumberId;
              }
              if (session.deviceInfo?.businessAccountId) {
                businessAccountId = session.deviceInfo.businessAccountId;
              }
              
              console.log(`[Send Text] Found credentials in integrations table`);
            }
          } catch (integrationError: any) {
            console.log(`[Send Text] Could not get credentials from integration:`, integrationError.message);
          }
          
          // Fall back to user settings if integration didn't work
          if (!accessToken) {
            const settings = await storage.getUserSettings(userId);
            if (settings?.whatsappBusinessCredentials?.phoneNumberId && 
                settings.whatsappBusinessCredentials.accessToken) {
              accessToken = settings.whatsappBusinessCredentials.accessToken;
              phoneNumberId = settings.whatsappBusinessCredentials.phoneNumberId;
              businessAccountId = settings.whatsappBusinessCredentials.businessAccountId || null;
              console.log(`[Send Text] Found credentials in user settings`);
            }
          }
          
          // Restore session if we found credentials
          if (accessToken && phoneNumberId) {
            try {
              await businessAPIManager.restoreSession(validatedData.sessionId, {
                phoneNumberId: phoneNumberId,
                accessToken: accessToken,
                businessAccountId: businessAccountId ?? undefined,
              });
              
              isReady = manager.isClientReady(validatedData.sessionId);
              console.log(`[Send Text] Business API credentials restored, isReady: ${isReady}`);
            } catch (reloadError: any) {
              console.error(`[Send Text] Error restoring Business API credentials:`, reloadError);
              // Continue to check if it's ready anyway (might have been restored by another request)
              isReady = manager.isClientReady(validatedData.sessionId);
            }
          } else {
            console.error(`[Send Text] Cannot restore Business API credentials - not found in integrations or user settings`);
            console.error(`[Send Text] Session deviceInfo:`, JSON.stringify(session.deviceInfo, null, 2));
          }
        }
        
        if (!isReady) {
          console.error(`[Send Text] Business API client not ready for session ${validatedData.sessionId}`);
          throw new Error('The Business API session is not properly configured. Please check your credentials in Settings.');
        }
        console.log(`[Send Text] Business API client is ready`);
      } else {
        // For other managers or if waitForClientReady is not available
        // Check if client is ready, wait if session is connected but client not ready yet
        let isReady = manager.isClientReady(validatedData.sessionId);
        console.log(`[Send Text] Initial client ready check: ${isReady}`);
        
        if (session.status === 'connected' && !isReady) {
          console.log(`[Send Text] Session is connected but client not ready, waiting up to 10 seconds...`);
          // Try to ensure client exists first (for unofficial sessions)
          if (session.connectionType === 'unofficial' && typeof (manager as any).ensureClient === 'function') {
            console.log(`[Send Text] Attempting to ensure client exists...`);
            await (manager as any).ensureClient(validatedData.sessionId);
          }
          
          // Wait and check multiple times
          for (let i = 0; i < 20; i++) {
            await new Promise(resolve => setTimeout(resolve, 500));
            isReady = manager.isClientReady(validatedData.sessionId);
            if (isReady) {
              console.log(`[Send Text] Client became ready after ${i + 1} attempts`);
              break;
            }
          }
          console.log(`[Send Text] Client ready after wait: ${isReady}`);
        }
        
        if (!isReady) {
          // If session says connected but client isn't ready, update session status
          if (session.status === 'connected') {
            console.warn(`[Send Text] Session status is 'connected' but client not ready - updating session status to 'disconnected'`);
            await storage.updateSession(validatedData.sessionId, { status: 'disconnected' });
          }
          
          console.error(`[Send Text] WhatsApp client not ready for session ${validatedData.sessionId}`, {
            sessionId: validatedData.sessionId,
            status: session.status,
            connectionType: session.connectionType,
            hasManager: !!manager,
            hasWaitForClientReady: typeof (manager as any).waitForClientReady === 'function',
            hasEnsureClient: typeof (manager as any).ensureClient === 'function',
          });
          throw new Error('The WhatsApp connection is not ready. The device may have disconnected. Please go to the Connect page and reconnect your device.');
        }
      }

      // Check if this is a template message (for WhatsApp Business API)
      let result;
      let messageToSend = validatedData.message || '';
      
      // Append footer to message if provided (for unofficial client, buttons are not supported)
      // Only append footer if message exists (not for template-only messages)
      if (validatedData.footer && messageToSend) {
        messageToSend = `${messageToSend}\n\n${validatedData.footer}`;
        
        // For buttons, append button text as clickable link if URL button
        if (validatedData.footerButtonType === 'URL' && validatedData.footerButtonText && validatedData.footerButtonUrl) {
          messageToSend = `${messageToSend}\n\n${validatedData.footerButtonText}: ${validatedData.footerButtonUrl}`;
        } else if (validatedData.footerButtonType === 'PHONE_NUMBER' && validatedData.footerButtonText && validatedData.footerButtonPhone) {
          messageToSend = `${messageToSend}\n\n${validatedData.footerButtonText}: ${validatedData.footerButtonPhone}`;
        } else if (validatedData.footerButtonType === 'QUICK_REPLY' && validatedData.footerButtonText) {
          messageToSend = `${messageToSend}\n\n${validatedData.footerButtonText}`;
        }
      }
      
      // Check if message contains template variables ({{1}}, {{2}}, etc.)
      const hasTemplateVariables = validatedData.message ? /\{\{\d+\}\}/.test(validatedData.message) : false;
      
      // For Business API, try to find a matching template if templateName is not provided
      let templateName = validatedData.templateName;
      // For Business API, only use templates synced for THIS session's phone number (templates are per-WABA)
      const sessionPhoneNumberId = session.connectionType === 'official' ? (session.deviceInfo as any)?.apiPhoneNumberId : undefined;

      if (session.connectionType === 'official' && hasTemplateVariables && !templateName) {
        console.warn(`[Send Text] Message contains template variables ({{1}}, {{2}}, etc.) but templateName is not provided. Attempting to find matching template...`);
        
        // Try to find a matching template from user's templates (filter by session's phone number)
        try {
          const userTemplates = await storage.getMessageTemplatesByUser(userId, orgId, sessionPhoneNumberId);
          
          // Find template that matches the message structure (simple heuristic: check if template body contains similar structure)
          // This is a basic matching - in production, you might want more sophisticated matching
          const matchingTemplate = userTemplates.find(t => {
            if (t.status !== 'APPROVED') return false;
            // Check if template has body component with similar variable pattern
            const bodyComponent = t.components?.find((c: any) => c.type === 'BODY');
            if (!bodyComponent?.text) return false;
            // Count variables in template
            const templateVarCount = (bodyComponent.text.match(/\{\{\d+\}\}/g) || []).length;
            const messageVarCount = (validatedData.message.match(/\{\{\d+\}\}/g) || []).length;
            return templateVarCount === messageVarCount && templateVarCount > 0;
          });
          
          if (matchingTemplate) {
            templateName = matchingTemplate.name;
            console.log(`[Send Text] Found matching template: ${templateName} (ID: ${matchingTemplate.templateId})`);
          } else {
            console.warn(`[Send Text] No matching template found. Message will be sent as free-form text, which may not be delivered outside 24-hour window.`);
            console.warn(`[Send Text] Available templates: ${userTemplates.filter(t => t.status === 'APPROVED').map(t => t.name).join(', ') || 'none'}`);
          }
        } catch (templateError) {
          console.error(`[Send Text] Error finding matching template:`, templateError);
        }
      }
      
      // Declare template send state at function scope so post-send persistence can use it
      let headerFormat: string | null = null;
      let headerImageId: string | undefined = validatedData.headerImageId || undefined;
      let templateParams: string[] | undefined = validatedData.templateParams;
      let selectedTemplate: any = null;
      
      if (session.connectionType === 'official' && templateName) {
        // Send as template message using Business API manager
        // First, try to get the template to check its structure and required parameters
        let requiredParamCount = 0;
        let headerComponent: any = null;
        
        try {
          const userTemplates = await storage.getMessageTemplatesByUser(userId, orgId, sessionPhoneNumberId);
          // Try to find template by name (case-insensitive) or by templateId
          selectedTemplate = userTemplates.find(t => {
            const statusMatch = t.status === 'APPROVED' || t.status === 'approved';
            const nameMatch = t.name === templateName || 
                             t.name.toLowerCase() === templateName.toLowerCase() ||
                             t.name.toLowerCase().replace(/[^a-z0-9_]/g, '_') === templateName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
            const idMatch = t.templateId === templateName;
            return statusMatch && (nameMatch || idMatch);
          });
          
          if (selectedTemplate) {
            // Check if template is unofficial (local only, not in Meta)
            const isUnofficial = selectedTemplate.templateId?.startsWith('unofficial_') || 
                                 selectedTemplate.metadata?.templateType === 'unofficial';
            
            if (isUnofficial) {
              throw new Error(`Template "${templateName}" is an unofficial template and cannot be sent via WhatsApp Business API. Please create it as an "official" template first, or sync it from Meta.`);
            }
            
            // Meta requires the template NAME (not ID) when sending messages
            // The template name should already be in the correct format (sanitized when created)
            // Use the stored name directly, as it should match what Meta expects
            templateName = selectedTemplate.name;
            console.log(`[Send Text] Found template: "${selectedTemplate.name}" (ID: ${selectedTemplate.templateId}, Status: ${selectedTemplate.status})`);
            console.log(`[Send Text] Using template name: "${templateName}" for Meta API`);
            
            // Verify the name is in the correct format (lowercase, alphanumeric, underscores)
            const sanitizedName = templateName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
            if (templateName !== sanitizedName) {
              console.warn(`[Send Text] Template name "${templateName}" doesn't match Meta format, sanitizing to "${sanitizedName}"`);
              templateName = sanitizedName;
            }
            
            // Check if language matches - Meta requires exact language match
            const templateLanguage = selectedTemplate.language || 'en';
            const requestedLanguage = validatedData.templateLanguage || 'en';
            if (templateLanguage !== requestedLanguage) {
              console.warn(`[Send Text] Language mismatch: Template has "${templateLanguage}" but request has "${requestedLanguage}". Using template language.`);
              // Use the template's language instead of the requested one
              validatedData.templateLanguage = templateLanguage;
            }
            
            // Check for HEADER component
            headerComponent = selectedTemplate.components?.find((c: any) => c.type === 'HEADER');
            if (headerComponent) {
              headerFormat = headerComponent.format || 'TEXT';
              console.log(`[Send Text] Template "${selectedTemplate.name}" has HEADER component with format: ${headerFormat}`);
              
              // If header is IMAGE, we need an image ID (for now, we'll skip header parameters)
              // TODO: Support header image parameters in the future
              if (headerFormat === 'IMAGE') {
                console.log(
                  `[Send Text] Template "${selectedTemplate.name}" has IMAGE header — will use headerImageId or headerImageUrl if provided`
                );
              }
            }
            
            // Check BODY component for parameters
            const bodyComponent = selectedTemplate.components?.find((c: any) => c.type === 'BODY');
            if (bodyComponent?.text) {
              // Count required parameters in template
              const paramRegex = /\{\{\d+\}\}/g;
              const templateMatches = bodyComponent.text.match(paramRegex) || [];
              requiredParamCount = new Set(templateMatches.map(m => m.match(/\d+/)?.[0])).size;
              console.log(`[Send Text] Template "${selectedTemplate.name}" requires ${requiredParamCount} body parameter(s)`);
            } else if (String(selectedTemplate.category || '').toUpperCase() === 'AUTHENTICATION') {
              // Synced AUTH templates often omit BODY.text in storage (Meta uses add_security_recommendation only), but {{1}} OTP is still required
              requiredParamCount = 1;
              console.log(`[Send Text] Template "${selectedTemplate.name}" is AUTHENTICATION — assuming 1 body parameter (OTP)`);
            }
          } else {
            // Template not found for this phone number - do not attempt to send (would fail with 132001)
            throw new Error(
              `Template "${templateName}" is not available for this phone number. ` +
              `Templates are per WhatsApp Business Account. Go to Integrations → WhatsApp Business, select this number, and click "Sync Templates" to refresh. ` +
              `If the template exists in Meta but still fails, it may belong to a different Business Account.`
            );
          }
        } catch (templateError) {
          // Re-throw user-facing errors (unofficial template, not available for phone)
          if (templateError instanceof Error && (
            templateError.message.includes('unofficial') ||
            templateError.message.includes('not available for this phone number')
          )) {
            throw templateError;
          }
          console.warn(`[Send Text] Could not fetch template info:`, templateError);
          // Try to sanitize the name as fallback only for non-critical errors
          const sanitizedName = templateName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
          templateName = sanitizedName;
        }
        
        // Extract template parameters from message if not provided
        if (!templateParams || templateParams.length === 0) {
          // Try to extract parameters from message body (e.g., {{1}}, {{2}})
          const paramRegex = /\{\{(\d+)\}\}/g;
          const matches = Array.from(messageToSend.matchAll(paramRegex));
          if (matches.length > 0) {
            // Extract unique parameter numbers and sort them
            const paramNumbers = [...new Set(matches.map(m => parseInt(m[1])))].sort((a, b) => a - b);
            // Extract values that appear after {{num}} pattern
            templateParams = paramNumbers.map(num => {
              // Try to find the value after {{num}} or use empty string
              const match = messageToSend.match(new RegExp(`\\{\\{${num}\\}\\}\\s*([^\\{\\n]+)`));
              return match ? match[1].trim() : '';
            });
          }
        }
        
        // Ensure we have the correct number of parameters and validate they're not empty
        if (requiredParamCount > 0) {
          // Initialize templateParams if it doesn't exist
          if (!templateParams) {
            templateParams = [];
          }
          
          // Trim whitespace from all parameters
          templateParams = templateParams.map(p => (p || '').trim());
          
          // Pad to required count with empty strings (for validation)
          while (templateParams.length < requiredParamCount) {
            templateParams.push('');
          }
          // Trim to required count (in case we have more than needed)
          templateParams = templateParams.slice(0, requiredParamCount);
          
          // Validate that all required parameters have non-empty values
          const emptyParams = templateParams.map((p, i) => !p || p.trim().length === 0 ? i + 1 : null).filter(i => i !== null);
          if (emptyParams.length > 0) {
            throw new Error(`Template "${templateName}" requires ${requiredParamCount} parameter(s), but parameter(s) ${emptyParams.join(', ')} are missing. Please fill in all template parameters.`);
          }
        } else {
          // If no parameters required, set to undefined (don't send parameters)
          templateParams = undefined;
        }
        
        // Check if template has media header and handle it
        if (headerFormat === 'IMAGE') {
          // For IMAGE headers, WhatsApp requires an image ID
          // First check if we already have a headerImageId
          let providedImageId = validatedData.headerImageId || headerImageId;
          
          // If no image ID but we have a headerImageUrl, upload it (like campaign executor)
          if (!providedImageId && validatedData.headerImageUrl) {
            try {
              console.log(`[Send Text] Uploading header image from URL: ${validatedData.headerImageUrl}`);
              
              // Get credentials for upload
              const creds = businessAPIManager['credentials'].get(validatedData.sessionId);
              if (!creds) {
                throw new Error('Business API credentials not available');
              }
              
              const businessAccountId = session?.deviceInfo?.wabaId || creds.businessAccountId;
              
              const { buffer: imageBuffer, fileName } = await loadPanelMediaBufferFromUrl(
                validatedData.headerImageUrl
              );
              
              // Upload using uploadMediaWithCredentials (same as campaign executor)
              const uploadResult = await businessAPIManager.uploadMediaWithCredentials(
                {
                  phoneNumberId: creds.phoneNumberId,
                  accessToken: creds.accessToken,
                  businessAccountId: businessAccountId,
                },
                imageBuffer,
                fileName,
                'IMAGE',
                false // Use regular /media endpoint - media ID is used for sending
              );
              
              providedImageId = uploadResult.id;
              console.log(`[Send Text] Successfully uploaded header image, got media ID: ${providedImageId}`);
            } catch (uploadError: any) {
              console.error(`[Send Text] Failed to upload header image:`, uploadError.message);
              throw new Error(`Failed to upload header image: ${uploadError.message}`);
            }
          }
          
          // If still no image ID, throw error
          if (!providedImageId) {
            throw new Error(`Template "${templateName}" has an IMAGE header component, but no image ID was provided. Please upload an image first and provide the image ID or image URL, or use a template without an IMAGE header.`);
          }
          headerImageId = providedImageId;
        } else if (headerFormat === 'VIDEO') {
          let providedVideoId = validatedData.headerVideoId;
          if (!providedVideoId && validatedData.headerVideoUrl) {
            try {
              const creds = businessAPIManager['credentials'].get(validatedData.sessionId);
              if (!creds) throw new Error('Business API credentials not available');
              const businessAccountId = session?.deviceInfo?.wabaId || creds.businessAccountId;
              const { buffer: videoBuffer, fileName } = await loadPanelMediaBufferFromUrl(
                validatedData.headerVideoUrl
              );
              const uploadResult = await businessAPIManager.uploadMediaWithCredentials(
                { phoneNumberId: creds.phoneNumberId, accessToken: creds.accessToken, businessAccountId },
                videoBuffer, fileName, 'VIDEO', false
              );
              providedVideoId = uploadResult.id;
            } catch (uploadError: any) {
              throw new Error(`Failed to upload header video: ${uploadError.message}`);
            }
          }
          if (!providedVideoId) {
            throw new Error(`Template "${templateName}" has a VIDEO header. Provide headerVideoId or headerVideoUrl (e.g. gallery URL or public URL).`);
          }
          (validatedData as any).headerVideoId = providedVideoId;
        } else if (headerFormat === 'DOCUMENT') {
          let providedDocumentId = validatedData.headerDocumentId;
          let headerDocumentFilename =
            typeof validatedData.headerDocumentFilename === 'string'
              ? validatedData.headerDocumentFilename.trim()
              : '';
          if (!providedDocumentId && validatedData.headerDocumentUrl) {
            try {
              const creds = businessAPIManager['credentials'].get(validatedData.sessionId);
              if (!creds) throw new Error('Business API credentials not available');
              const businessAccountId = session?.deviceInfo?.wabaId || creds.businessAccountId;
              const { buffer: docBuffer, fileName } = await loadPanelMediaBufferFromUrl(
                validatedData.headerDocumentUrl
              );
              if (!headerDocumentFilename) headerDocumentFilename = fileName;
              const uploadResult = await businessAPIManager.uploadMediaWithCredentials(
                { phoneNumberId: creds.phoneNumberId, accessToken: creds.accessToken, businessAccountId },
                docBuffer, fileName, 'DOCUMENT', false
              );
              providedDocumentId = uploadResult.id;
            } catch (uploadError: any) {
              throw new Error(`Failed to upload header document: ${uploadError.message}`);
            }
          }
          if (!providedDocumentId) {
            throw new Error(`Template "${templateName}" has a DOCUMENT header. Provide headerDocumentId or headerDocumentUrl (e.g. gallery URL or public URL).`);
          }
          if (!headerDocumentFilename) {
            headerDocumentFilename = resolveWhatsAppDocumentFilename(
              undefined,
              validatedData.headerDocumentUrl
            );
          }
          (validatedData as any).headerDocumentId = providedDocumentId;
          (validatedData as any).headerDocumentFilename = headerDocumentFilename || undefined;
        }
        
        // Log parameters being sent
        console.log(`[Send Text] Sending template "${templateName}" with ${templateParams?.length || 0} parameter(s):`, templateParams);
        if (headerFormat) {
          console.log(`[Send Text] Template has HEADER with format: ${headerFormat}`);
        }
        
        // Get the correct language code from the template if found, otherwise use requested language
        let templateLanguageToUse = validatedData.templateLanguage || 'en';
        if (selectedTemplate) {
          // Use the template's language if available, as it must match exactly
          const templateLang = selectedTemplate.language || 'en';
          // Convert language codes: 'en' -> 'en', 'en_US' -> 'en_US', etc.
          templateLanguageToUse = templateLang;
          console.log(`[Send Text] Using template language: "${templateLanguageToUse}" (from template, requested: "${validatedData.templateLanguage || 'en'}")`);
        }

        const tplBodyTextForSend = selectedTemplate?.components?.find((c: any) => c.type === 'BODY')?.text;
        let carouselSend: { cards: any[] } | undefined;
        const sendTemplateMeta = selectedTemplate?.metaData || selectedTemplate?.metadata || {};
        const mediaCardsSend = Array.isArray(sendTemplateMeta.mediaCards) ? sendTemplateMeta.mediaCards : [];
        const carouselTplComp = selectedTemplate?.components?.find(
          (c: any) => String(c.type || '').toUpperCase() === 'CAROUSEL'
        );
        const productCardsSend = Array.isArray(sendTemplateMeta.productCards)
          ? sendTemplateMeta.productCards
          : [];
        if (sendTemplateMeta.interactiveAction === 'PRODUCT_CARD_CAROUSEL' && productCardsSend.length >= 1) {
          const sendOrgId =
            organizationId ||
            (session as { organizationId?: string | null }).organizationId ||
            (organizationId);
          const catalogIdForSend = String(
            sendTemplateMeta.catalogId ||
              (sendOrgId
                ? (await storage.getOrganizationCommerceSettings(sendOrgId))?.metaCatalogId
                : '') ||
              ''
          ).trim();
          if (!catalogIdForSend) {
            throw new Error(
              'Product carousel requires a Meta catalog ID. Set it in Commerce settings or when creating the template.'
            );
          }
          const withIds = productCardsSend
            .map((p: { productRetailerId?: string }) => ({
              productRetailerId: String(p?.productRetailerId || '').trim(),
            }))
            .filter((p: { productRetailerId: string }) => p.productRetailerId);
          if (!withIds.length) {
            throw new Error(
              'Each product card needs a catalog product ID. Edit the template or pick products when sending.'
            );
          }
          console.log(
            `[Send Text] Building product carousel send payload (${withIds.length} product(s))`
          );
          carouselSend = buildProductCarouselSendPayload(catalogIdForSend, withIds);
        } else if (sendTemplateMeta.interactiveAction === 'MEDIA_CARD_CAROUSEL' && mediaCardsSend.length >= 2) {
          if (!carouselTplComp?.cards || carouselTplComp.cards.length !== mediaCardsSend.length) {
            throw new Error(
              'This media carousel template is missing WhatsApp carousel data in storage. Create the template again or run Sync Templates after the panel update, then resend.'
            );
          }
          const carouselUrlsRaw = validatedData.carouselCardMediaUrls;
          if (!Array.isArray(carouselUrlsRaw) || carouselUrlsRaw.length !== mediaCardsSend.length) {
            throw new Error(
              `This media carousel template requires ${mediaCardsSend.length} image or video file(s)—one per card. Select media for each card before sending (creation-time media is not used for delivery).`
            );
          }
          const carouselUrlsCleaned = carouselUrlsRaw.map((u) => String(u ?? '').trim());
          if (carouselUrlsCleaned.some((u) => !u)) {
            throw new Error(
              'Each carousel card needs a selected image or video. Fill all cards before sending.'
            );
          }
          console.log(`[Send Text] Building carousel send payload (${mediaCardsSend.length} cards) with send-time media URLs`);
          carouselSend = await buildOfficialCarouselSendPayload(
            validatedData.sessionId,
            session,
            businessAPIManager,
            mediaCardsSend,
            carouselTplComp,
            carouselUrlsCleaned
          );
        }
        
        const templateMetaForAuth =
          selectedTemplate &&
          String(selectedTemplate.category || '').toUpperCase() === 'AUTHENTICATION'
            ? { category: selectedTemplate.category, components: selectedTemplate.components }
            : null;

        const formFlowButton = flowButtonForTemplateMeta(sendTemplateMeta);

        result = await businessAPIManager.sendTemplateMessage(
          validatedData.sessionId,
          validatedData.to,
          templateName,
          templateLanguageToUse,
          templateParams, // Always pass templateParams if requiredParamCount > 0 (even if empty strings)
          headerFormat === 'IMAGE' ? (validatedData.headerImageId || headerImageId) : undefined, // Pass image ID if header is IMAGE
          headerFormat === 'VIDEO' ? validatedData.headerVideoId : undefined, // Pass video ID if header is VIDEO
          headerFormat === 'DOCUMENT' ? validatedData.headerDocumentId : undefined, // Pass document ID if header is DOCUMENT
          tplBodyTextForSend,
          formFlowButton,
          carouselSend,
          undefined,
          undefined,
          headerFormat === 'DOCUMENT' ? validatedData.headerDocumentUrl : undefined,
          templateMetaForAuth,
          headerFormat === 'DOCUMENT' ? (validatedData as any).headerDocumentFilename : undefined
        );
        
        // For template messages, construct the display message with parameters replaced
        // First, try to get the template body from the selected template
        let displayMessage = validatedData.message || '';
        
        // If message is empty or contains template variables, try to construct from template
        if (!displayMessage || /\{\{\d+\}\}/.test(displayMessage)) {
          try {
            // Reuse template row from the send path (name may have been sanitized for Meta).
            let tplForDisplay = selectedTemplate;
            if (!tplForDisplay) {
              const userTemplates = await storage.getMessageTemplatesByUser(
                userId,
                orgId,
                sessionPhoneNumberId
              );
              tplForDisplay = userTemplates.find((t) => {
                const statusMatch = t.status === 'APPROVED' || t.status === 'approved';
                const nameMatch =
                  t.name === templateName ||
                  t.name.toLowerCase() === templateName.toLowerCase() ||
                  t.name.toLowerCase().replace(/[^a-z0-9_]/g, '_') ===
                    templateName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
                const idMatch = t.templateId === templateName;
                return statusMatch && (nameMatch || idMatch);
              });
            }

            if (tplForDisplay) {
              // Get HEADER component (if TEXT format)
              const headerComponent = tplForDisplay.components?.find((c: any) => c.type === 'HEADER');
              let headerText = '';
              if (headerComponent && headerComponent.format === 'TEXT' && headerComponent.text) {
                headerText = headerComponent.text;
                // Replace header parameters if any
                if (templateParams && templateParams.length > 0) {
                  const headerParams = templateParams.slice(0, (headerComponent.text.match(/\{\{\d+\}\}/g) || []).length);
                  headerParams.forEach((param, index) => {
                    headerText = headerText.replace(new RegExp(`\\{\\{${index + 1}\\}\\}`, 'g'), param);
                  });
                }
              }
              
              // Get the body component text
              const bodyComponent = tplForDisplay.components?.find((c: any) => c.type === 'BODY');
              if (bodyComponent?.text) {
                displayMessage = bodyComponent.text;
                
                // Replace template variables with actual parameters
                if (templateParams && templateParams.length > 0) {
                  // Skip header params if header exists
                  const headerParamCount = headerText ? (headerComponent!.text!.match(/\{\{\d+\}\}/g) || []).length : 0;
                  const bodyParams = templateParams.slice(headerParamCount);
                  bodyParams.forEach((param, index) => {
                    displayMessage = displayMessage.replace(new RegExp(`\\{\\{${index + 1}\\}\\}`, 'g'), param);
                  });
                }
                
                // Prepend header text if exists
                if (headerText) {
                  displayMessage = `${headerText}\n\n${displayMessage}`;
                }
              } else if (headerText) {
                displayMessage = headerText;
              }
              
              // Get FOOTER component
              const footerComponent = tplForDisplay.components?.find((c: any) => c.type === 'FOOTER');
              if (footerComponent?.text) {
                displayMessage = `${displayMessage}\n\n${footerComponent.text}`;
              }
            }
          } catch (templateError) {
            console.warn(`[Send Text] Could not fetch template for display message:`, templateError);
          }
        } else {
          // If message was provided, replace template variables with parameters
          if (templateParams && templateParams.length > 0) {
            templateParams.forEach((param, index) => {
              displayMessage = displayMessage.replace(new RegExp(`\\{\\{${index + 1}\\}\\}`, 'g'), param);
            });
          }
        }
        
        messageToSend = displayMessage;
        if (!String(messageToSend || '').trim()) {
          messageToSend = await buildPersistedTemplateMessageBody({
            userId,
            templateName,
            languageCode: templateLanguageToUse,
            templateParams: templateParams ?? undefined,
            organizationId: orgId,
            phoneNumberId: session.deviceInfo?.apiPhoneNumberId,
          });
        }
      } else {
        // Send as regular text message
        // Combine message and footer if footer is provided
        // Only combine if message exists (not for template-only messages)
        if (validatedData.footer && validatedData.footer.trim() && validatedData.message) {
          messageToSend = `${validatedData.message}\n\n${validatedData.footer.trim()}`;
          
          // For buttons, append button text as clickable link (unofficial client doesn't support interactive buttons)
          // Support both old single button format and new multiple buttons format
          const buttons = validatedData.footerButtons && validatedData.footerButtons.length > 0 
            ? validatedData.footerButtons 
            : (validatedData.footerButtonType && validatedData.footerButtonType !== 'NONE' && validatedData.footerButtonText
                ? [{
                    type: validatedData.footerButtonType,
                    text: validatedData.footerButtonText,
                    url: validatedData.footerButtonUrl,
                    phoneNumber: validatedData.footerButtonPhone,
                  }]
                : []);
          
          for (const button of buttons) {
            if (button.type === 'URL' && button.text && button.url) {
              messageToSend = `${messageToSend}\n\n${button.text}: ${button.url}`;
            } else if (button.type === 'PHONE_NUMBER' && button.text && button.phoneNumber) {
              messageToSend = `${messageToSend}\n\n${button.text}: ${button.phoneNumber}`;
            } else if (button.type === 'QUICK_REPLY' && button.text) {
              messageToSend = `${messageToSend}\n\n${button.text}`;
            }
          }
        }

        // Resolve reply context for WhatsApp (reply-to message id for API / quoted for unofficial)
        let replyToWhatsAppMessageId: string | undefined;
        if (validatedData.replyToMessageId) {
          const repliedMessage = await storage.getMessageByIdOrWhatsAppId(validatedData.replyToMessageId, userId, validatedData.sessionId);
          replyToWhatsAppMessageId = repliedMessage?.whatsappMessageId ?? undefined;
        }
        result = await manager.sendTextMessage(
          validatedData.sessionId,
          validatedData.to,
          messageToSend,
          replyToWhatsAppMessageId ? { replyToWhatsAppMessageId } : undefined
        );
      }

      // Normalize the recipient ID for chat lookup
      // Handle both individual contacts and groups
      let recipientId = validatedData.to;
      if (!recipientId.includes('@c.us') && !recipientId.includes('@g.us')) {
        // If no suffix, assume individual contact
        recipientId = `${recipientId}@c.us`;
      }

      // Find or create chat and get its UUID
      const chatId = await findOrCreateChat(validatedData.sessionId, recipientId);

      // Extract buttons from template if this is a template message (same lookup as send path: phone + name)
      let buttons: any[] = [];
      if (session.connectionType === 'official' && templateName) {
        try {
          const userTemplates = await storage.getMessageTemplatesByUser(userId, orgId, sessionPhoneNumberId);
          const selectedTemplateForButtons = userTemplates.find((t: any) => {
            const statusMatch = t.status === 'APPROVED' || t.status === 'approved';
            const nameMatch =
              t.name === templateName ||
              t.name?.toLowerCase() === templateName.toLowerCase() ||
              t.name?.toLowerCase().replace(/[^a-z0-9_]/g, '_') ===
                templateName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
            const idMatch = t.templateId === templateName;
            return statusMatch && (nameMatch || idMatch);
          });

          if (selectedTemplateForButtons) {
            const buttonComponent = selectedTemplateForButtons.components?.find((c: any) => c.type === 'BUTTONS');
            const isAuth = String(selectedTemplateForButtons.category || '').toUpperCase() === 'AUTHENTICATION';
            if (buttonComponent?.buttons) {
              const isOneTap = (b: any) => {
                const ot = String(b?.otp_type || '').toUpperCase();
                return ot === 'ONE_TAP' || ot === 'ZERO_TAP';
              };
              buttons = buttonComponent.buttons.map((btn: any) => {
                const upper = String(btn.type || '').toUpperCase();
                if (isAuth && !isOneTap(btn) && (upper === 'OTP' || upper === 'URL')) {
                  return {
                    type: 'QUICK_REPLY',
                    text: (btn.text || btn.title || 'Copy code').trim() || 'Copy code',
                    authCopyCode: true,
                  };
                }
                const mappedType =
                  upper === 'OTP' ? 'QUICK_REPLY' : upper === 'PHONE_NUMBER' ? 'PHONE_NUMBER' : upper === 'QUICK_REPLY' ? 'QUICK_REPLY' : upper === 'URL' ? 'URL' : 'QUICK_REPLY';
                return {
                  type: mappedType,
                  text: btn.text || btn.title || '',
                  url: btn.url || btn.example?.[0],
                  phoneNumber: btn.phone_number || btn.phoneNumber,
                };
              });
            }
          }
        } catch (error) {
          console.warn(`[Send Text] Could not extract buttons from template:`, error);
        }
      }
      
      // If no template buttons, check for footer buttons from request
      if (buttons.length === 0) {
        buttons = validatedData.footerButtons && validatedData.footerButtons.length > 0 
          ? validatedData.footerButtons 
          : (validatedData.footerButtonType && validatedData.footerButtonType !== 'NONE' && validatedData.footerButtonText
              ? [{
                  type: validatedData.footerButtonType,
                  text: validatedData.footerButtonText,
                  url: validatedData.footerButtonUrl,
                  phoneNumber: validatedData.footerButtonPhone,
                }]
              : []);
      }
      
      // Store first button in old format for backward compatibility, and all buttons as JSON in footerButtonText
      const firstButton = buttons.length > 0 ? buttons[0] : null;
      
      // For template messages, use the constructed display message
      // For regular messages, use the original message or messageToSend
      const messageBody = (session.connectionType === 'official' && templateName && messageToSend) 
        ? messageToSend 
        : (validatedData.message || messageToSend || '');
      
      // For template messages with images, try to get the media URL
      let mediaUrl: string | null = null;
      if (session.connectionType === 'official' && templateName && headerFormat === 'IMAGE' && (validatedData.headerImageId || headerImageId)) {
        const imageIdToUse = validatedData.headerImageId || headerImageId;
        try {
          // Try to get local preview URL first (faster)
          let uploadsOrgId = orgId;
          if (!uploadsOrgId) {
            const organizations = await storage.getOrganizationsByUser(userId);
            uploadsOrgId = organizations[0]?.id;
          }
          
          if (uploadsOrgId) {
            const templatesFolder = path.join(process.cwd(), 'uploads', uploadsOrgId, 'templates');
            if (fs.existsSync(templatesFolder)) {
              const files = fs.readdirSync(templatesFolder);
              const matchingFile = files.find(f => f.includes(imageIdToUse!));
              if (matchingFile) {
                mediaUrl = `/uploads/${uploadsOrgId}/templates/${matchingFile}`;
              }
            }
          }
          
          // If no local file found, try to get from WhatsApp API
          if (!mediaUrl) {
            const mediaInfo = await businessAPIManager.getMediaForTemplate(validatedData.sessionId, imageIdToUse!);
            mediaUrl = mediaInfo.url;
          }
        } catch (error) {
          console.warn(`[Send Text] Could not get media URL for template image:`, error);
          mediaUrl = validatedData.headerImageUrl?.trim() || null;
        }
      }

      // For template messages with VIDEO header: set mediaUrl so inbox shows video thumbnail
      if (session.connectionType === 'official' && templateName && headerFormat === 'VIDEO') {
        const videoUrlFromClient = validatedData.headerVideoUrl;
        const videoIdToUse = validatedData.headerVideoId;
        if (videoUrlFromClient) {
          mediaUrl = videoUrlFromClient;
        } else if (videoIdToUse) {
          try {
            const mediaInfo = await businessAPIManager.getMediaForTemplate(validatedData.sessionId, videoIdToUse);
            mediaUrl = mediaInfo.url;
          } catch (error) {
            console.warn('[Send Text] Could not get media URL for template video:', error);
            mediaUrl = videoIdToUse;
          }
        }
      }

      // Extract template information if this is a template message
      let templateFooter: string | null = null;
      let templateHeaderText: string | null = null;
      let templateType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | null = null;
      
      if (session.connectionType === 'official' && templateName) {
        try {
          let tplForMeta = selectedTemplate;
          if (!tplForMeta) {
            const userTemplates = await storage.getMessageTemplatesByUser(userId, orgId, sessionPhoneNumberId);
            tplForMeta = userTemplates.find(
              (t) => t.name === templateName && (t.status === 'APPROVED' || t.status === 'approved')
            );
          }
          
          if (tplForMeta) {
            // Extract footer
            const footerComponent = tplForMeta.components?.find((c: any) => c.type === 'FOOTER');
            if (footerComponent?.text) {
              templateFooter = footerComponent.text;
            }
            
            // Extract header text (for TEXT header type)
            const headerComponent = tplForMeta.components?.find((c: any) => c.type === 'HEADER');
            if (headerComponent) {
              templateType = (headerComponent.format || 'TEXT') as 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
              if (headerComponent.format === 'TEXT' && headerComponent.text) {
                templateHeaderText = headerComponent.text;
                // Replace header parameters if any
                if (templateParams && templateParams.length > 0) {
                  const headerParamCount = (headerComponent.text.match(/\{\{\d+\}\}/g) || []).length;
                  const headerParams = templateParams.slice(0, headerParamCount);
                  headerParams.forEach((param, index) => {
                    templateHeaderText = templateHeaderText!.replace(new RegExp(`\\{\\{${index + 1}\\}\\}`, 'g'), param);
                  });
                }
              } else if (headerComponent.format) {
                templateType = headerComponent.format as 'IMAGE' | 'VIDEO' | 'DOCUMENT';
              }
            } else {
              // No header, check body for template type
              templateType = 'TEXT';
            }
          }
        } catch (error) {
          console.warn(`[Send Text] Could not extract template information:`, error);
        }
      }

      // Store WhatsApp message ID before creating message if available
      const whatsappMessageId = (session.connectionType === 'official' && result.id) ? result.id : null;
      
      // Prepare message data - include organizationId for multi-tenant support
      const messageData = {
        sessionId: validatedData.sessionId,
        chatId,
        organizationId: organizationId || null, // Include organizationId for multi-tenant support
        body: messageBody, // Store constructed message (with template parameters replaced for templates)
        fromMe: true,
        type: (templateName ? 'template' : 'text') as 'text' | 'template', // Set type to 'template' for template messages
        status: 'sent' as const,
        mediaUrl: mediaUrl || null, // Store media URL for template messages with images
        // Footer fields - use template footer if available, otherwise use request footer
        footer: templateFooter || validatedData.footer || null,
        footerButtonType: firstButton ? firstButton.type : null,
        footerButtonText: buttons.length > 0 ? JSON.stringify(buttons) : null, // Store all buttons as JSON
        footerButtonUrl: firstButton?.url ?? null,
        footerButtonPhone: firstButton?.phoneNumber ?? null,
        // Template information
        templateName: templateName || null,
        templateLanguage: validatedData.templateLanguage || null,
        templateType: templateType,
        headerText: templateHeaderText,
        templateParams: templateParams ?? validatedData.templateParams ?? null,
        ...(Array.isArray(validatedData.carouselCardMediaUrls) &&
        validatedData.carouselCardMediaUrls.length > 0 && {
          carouselCardMediaUrls: validatedData.carouselCardMediaUrls.map((u) => String(u ?? '').trim()),
        }),
        // WhatsApp message ID - store it immediately if available
        whatsappMessageId: whatsappMessageId,
        sentAt: new Date(), // Set sent timestamp
        // Reply/quote (WhatsApp-style)
        replyToMessageId: validatedData.replyToMessageId ?? null,
        quotedBody: validatedData.quotedBody ?? null,
        quotedFromMe: validatedData.quotedFromMe ?? null,
      };
      
      let message;
      try {
        message = await storage.createMessage(messageData);
      } catch (persistErr: any) {
        console.error('[Send Text] Primary createMessage failed after WhatsApp accept — fallback persist:', persistErr?.message || persistErr);
        const { persistOutboundWhatsAppMessage } = await import('./panel-outbound-message');
        const fallback = await persistOutboundWhatsAppMessage({
          sessionId: validatedData.sessionId,
          to: validatedData.to,
          userId,
          organizationId: organizationId || null,
          connectionType: session.connectionType === 'official' ? 'official' : 'unofficial',
          whatsappMessageId: whatsappMessageId,
          type: templateName ? 'template' : 'text',
          body: messageBody || (templateName ? `[Template] ${templateName}` : '[Message]'),
          mediaUrl: mediaUrl || null,
          templateName: templateName || null,
          templateLanguage: validatedData.templateLanguage || null,
          templateParams: templateParams ?? validatedData.templateParams ?? null,
          templateType: templateType,
          headerText: templateHeaderText,
          footer: templateFooter || validatedData.footer || null,
        });
        if (!fallback) {
          throw persistErr;
        }
        message = fallback;
      }

      // Human takeover: stop chatbot when agent manually sends a message to this contact
      clearChatbotConversationForContact(validatedData.sessionId, validatedData.to);

      // Update chat with latest message info (for lastMessage and lastMessageTime display)
      await storage.updateChat(chatId, {
        lastMessage: messageBody.substring(0, 100), // Truncate for preview
        lastMessageTime: new Date(),
      });

      // Store WhatsApp message ID mapping for Business API status updates
      if (session.connectionType === 'official' && result.id) {
        businessAPIManager.storeMessageMapping(result.id, message.id, validatedData.sessionId);
        console.log('[Send Text] Stored message mapping:', {
          whatsappMessageId: result.id,
          messageId: message.id,
          sessionId: validatedData.sessionId,
        });
      }

      // Broadcast message with updated whatsappMessageId
      const messageToBroadcast = { ...message, whatsappMessageId: whatsappMessageId || message.whatsappMessageId };
      broadcastToUser(userId, 'new_message', messageToBroadcast);

      // Trigger webhook for sent message
      await triggerWebhooks(userId, 'message.sent', {
        message,
        to: validatedData.to,
      });

      const verificationStatus = (session.deviceInfo as any)?.codeVerificationStatus;
      let note: string | undefined;
      const deliveryHint: { ifNotDelivered?: string; checkWebhook?: string; commonCauses?: string[] } = {};
      if (session.connectionType === 'official') {
        if (templateName) {
          note = `Template message sent successfully using template: ${templateName}. Delivery status will be updated via webhook.`;
          deliveryHint.ifNotDelivered = 'If the message does not reach the recipient, check: 1) Recipient number format (e.g. 919876543210 for India), 2) Recipient has not blocked your business, 3) Webhook is configured so we receive delivery status.';
          deliveryHint.commonCauses = [
            'Recipient blocked your business number',
            'Wrong or invalid phone number',
            'Recipient not on WhatsApp',
            'Webhook not configured (Meta cannot reach your server for status updates)',
          ];
        } else {
          note = 'Message accepted by WhatsApp. Delivery status (delivered/read) will be updated via webhook.';
          deliveryHint.ifNotDelivered = 'If the message does not reach the recipient, common reasons: recipient outside 24-hour window (use a template), or number not on WhatsApp.';
        }
        deliveryHint.checkWebhook = 'Ensure your webhook URL is configured in Meta Dashboard and reachable from the internet (not localhost).';
      }


      return { success: true, 
        messageId: result.id,
        message,
        warning: result.warning || undefined,
        isTemplate: !!templateName,
        templateName: templateName || undefined,
        verificationStatus: session.connectionType === 'official' ? (verificationStatus || undefined) : undefined,
        deliveryHint: session.connectionType === 'official' && Object.keys(deliveryHint).length > 0 ? deliveryHint : undefined,
        note, };
  }

  registerPanelInboxSendText(processSendTextMessage);

  app.post('/api/messages/send-text', ...withAuthAndRateLimit, ...withOrgContext, requirePermission('inbox.send'), walletUsageSkip, checkUsageLimits('message'), incrementUsage('message'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId || req.query?.organizationId || req.body?.organizationId || null;
      const validatedData = sendTextMessageSchema.parse(req.body);

      const session = await storage.getSession(validatedData.sessionId);
      if (!(await sessionAllowedForUser(session, validatedData.sessionId, userId, organizationId))) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const result = await processSendTextMessage(userId, organizationId, validatedData);
      res.json(result);
    } catch (error: any) {
      console.error('Error sending text message:', error);
      res.status(500).json({ error: error.message });
    }
  });



  app.post('/api/messages/send-reaction', ...withAuthAndRateLimit, ...withOrgContext, requirePermission('inbox.send'), walletUsageSkip, checkUsageLimits('message'), incrementUsage('message'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId || req.query?.organizationId || req.body?.organizationId || null;
      const validatedData = sendReactionMessageSchema.parse(req.body);

      const session = await storage.getSession(validatedData.sessionId);
      if (!(await sessionAllowedForUser(session, validatedData.sessionId, userId, organizationId))) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const manager = await getWhatsAppManager(validatedData.sessionId);
      if (typeof (manager as any).sendReaction !== 'function') {
        return res.status(400).json({ error: 'Reactions are not supported by this connection.' });
      }

      if (session.connectionType === 'official') {
        // Official API: need recipient phone number from the message's chat
        const message = await storage.getMessageByIdOrWhatsAppId(validatedData.messageId, userId, validatedData.sessionId);
        if (!message) {
          return res.status(404).json({ error: 'Message not found. It may be from another chat or session.' });
        }
        const chat = await storage.getChat(message.chatId);
        if (!chat) {
          return res.status(404).json({ error: 'Chat not found.' });
        }
        await (manager as any).sendReaction(validatedData.sessionId, chat.contactNumber, validatedData.messageId, validatedData.emoji);
        // Human takeover: stop chatbot when agent sends reaction
        clearChatbotConversationForContact(validatedData.sessionId, chat.contactNumber);
        // Persist and broadcast so UI shows our reaction immediately
        const existing = (message.reactions as Array<{ emoji: string; fromMe: boolean }>) || [];
        const next = [...existing.filter((r: { fromMe: boolean }) => r.fromMe !== true), { emoji: validatedData.emoji, fromMe: true }];
        const updated = await storage.updateMessage(message.id, { reactions: next });
        if (updated) {
          broadcastToUser(userId, 'message_updated', { chatId: message.chatId, messageId: updated.id, message: updated });
        }
      } else {
        await (manager as any).sendReaction(validatedData.sessionId, validatedData.messageId, validatedData.emoji);
        const message = await storage.getMessageByIdOrWhatsAppId(validatedData.messageId, userId, validatedData.sessionId);
        if (message) {
          const chat = await storage.getChat(message.chatId);
          if (chat) {
            clearChatbotConversationForContact(validatedData.sessionId, chat.contactNumber);
          }
        }
        // Persist and broadcast for unofficial so UI shows our reaction
        if (message) {
          const existing = (message.reactions as Array<{ emoji: string; fromMe: boolean }>) || [];
          const next = [...existing.filter((r: { fromMe: boolean }) => r.fromMe !== true), { emoji: validatedData.emoji, fromMe: true }];
          const updated = await storage.updateMessage(message.id, { reactions: next });
          if (updated) {
            broadcastToUser(userId, 'message_updated', { chatId: message.chatId, messageId: updated.id, message: updated });
          }
        }
      }
      res.json({ ok: true });
    } catch (error: any) {
      console.error('Error sending reaction:', error);
      res.status(500).json({ error: error.message || 'Failed to send reaction' });
    }
  });

  // Canned messages CRUD (org-scoped; sync across devices)
  app.get('/api/canned-messages', ...withAuthAndRateLimit, ...withOrgContext, requirePermission('canned_messages.view'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      if (isPaginatedListRequest(req.query)) {
        const pagination = listPaginationFromRequest(req);
        const search = parseListSearch(req.query);
        const result = await storage.listCannedMessagesByOrganization(organizationId, { search, ...pagination });
        return res.json(buildPaginatedResponse("cannedMessages", result));
      }
      const list = await storage.getCannedMessagesByOrganization(organizationId);
      res.json(list);
    } catch (error: any) {
      console.error('Error getting canned messages:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/canned-messages', ...withAuthAndRateLimit, ...withOrgContext, requirePermission('canned_messages.create'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const parsed = insertCannedMessageSchema.safeParse({ ...req.body, organizationId, userId });
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid data', errors: parsed.error.errors });
      }
      const item = await storage.createCannedMessage(parsed.data);
      res.status(201).json(item);
    } catch (error: any) {
      console.error('Error creating canned message:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch('/api/canned-messages/:id', ...withAuthAndRateLimit, ...withOrgContext, requirePermission('canned_messages.edit'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const { id } = req.params;
      const item = await storage.updateCannedMessageByOrganization(id, organizationId, req.body);
      if (!item) return res.status(404).json({ message: 'Canned message not found' });
      res.json(item);
    } catch (error: any) {
      console.error('Error updating canned message:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/canned-messages/:id', ...withAuthAndRateLimit, ...withOrgContext, requirePermission('canned_messages.delete'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const { id } = req.params;
      await storage.deleteCannedMessageByOrganization(id, organizationId);
      res.json({ message: 'Canned message deleted' });
    } catch (error: any) {
      console.error('Error deleting canned message:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Stream uploads file for canned message images (client can't always fetch /uploads/ directly)
  app.get('/api/canned-media', ...withAuthAndRateLimit, ...withOrgContext, requirePermission('canned_messages.view'), async (req: any, res) => {
    try {
      const rawPath = (req.query.path as string || '').trim();
      if (!rawPath || !rawPath.startsWith('/uploads/')) {
        return res.status(400).json({ error: 'Invalid path' });
      }
      // Path after /uploads/ e.g. "orgId/gallery/filename.png"
      const afterUploads = rawPath.replace(/^\/?uploads\/?/i, '').replace(/\\/g, '/');
      if (!afterUploads || afterUploads.includes('..')) {
        return res.status(400).json({ error: 'Invalid path' });
      }
      const pathSegments = afterUploads.split('/').filter(Boolean);
      if (pathSegments.length < 2) {
        return res.status(400).json({ error: 'Invalid path' });
      }
      const served = await streamUploadToResponse(rawPath, res);
      if (!served) {
        console.warn('[Canned media] File not found:', { rawPath, cwd: process.cwd() });
        return res.status(404).json({ error: 'File not found' });
      }
    } catch (err: any) {
      console.error('[Canned media] Error:', err);
      res.status(500).json({ error: err.message || 'Failed to load file' });
    }
  });

  const resolveUploadFilePath = async (rawPath: string): Promise<string | null> => {
    const local = resolveUploadLocalPath(rawPath);
    if (local) return local;
    if (await uploadExists(rawPath)) return rawPath;
    return null;
  };

  const readUploadBytes = async (
    rawPath: string
  ): Promise<{ buffer: Buffer; originalname: string } | null> => {
    const local = resolveUploadLocalPath(rawPath);
    if (local) {
      return { buffer: fs.readFileSync(local), originalname: path.basename(local) };
    }
    const buffer = await readUploadBuffer(rawPath);
    if (!buffer) return null;
    return { buffer, originalname: path.basename(rawPath) };
  };

  app.post('/api/messages/send-canned-media', ...withAuthAndRateLimit, ...withOrgContext, requirePermission('inbox.send'), walletUsageSkip, checkUsageLimits('message'), incrementUsage('message'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { sessionId, to, imagePath, caption, fileName } = req.body;
      if (!sessionId || !to || !imagePath || typeof imagePath !== 'string') {
        return res.status(400).json({ error: 'sessionId, to, and imagePath are required' });
      }
      const filePath = await resolveUploadFilePath(imagePath.trim());
      if (!filePath) {
        console.warn('[Send canned media] File not found for path:', imagePath);
        return res.status(404).json({ error: 'Image file not found' });
      }
      const loaded = await readUploadBytes(imagePath.trim());
      if (!loaded) {
        return res.status(404).json({ error: 'Image file not found' });
      }
      const { buffer, originalname: loadedName } = loaded;
      const originalname = fileName && typeof fileName === 'string' ? fileName : loadedName;

      const organizationId = req.context?.organizationId || req.query?.organizationId || req.body?.organizationId || null;
      const session = await storage.getSession(sessionId);
      if (!(await sessionAllowedForUser(session, sessionId, userId, organizationId))) {
        return res.status(404).json({ error: 'Session not found' });
      }
      const manager = await getWhatsAppManager(sessionId);
      if (session!.connectionType === 'official') {
        const credsOk = await ensureOfficialSessionCredentialsForMessaging(sessionId, session, userId, organizationId);
        if (!credsOk) {
          return res.status(400).json({
            error: 'WhatsApp Business API not ready',
            message:
              'Could not load API credentials for this sender number. Reconnect this number in Integrations or check that the correct Meta app is linked.',
          });
        }
      }
      let isReady = manager.isClientReady(sessionId);
      if (session!.status === 'connected' && !isReady) {
        if (typeof (manager as any).waitForClientReady === 'function') {
          isReady = await (manager as any).waitForClientReady(sessionId, 10000);
        } else {
          await new Promise(resolve => setTimeout(resolve, 2000));
          isReady = manager.isClientReady(sessionId);
        }
      }
      if (!isReady) {
        return res.status(400).json({
          error: 'WhatsApp client not ready',
          message: 'The WhatsApp connection is still initializing. Please wait a moment and try again.',
        });
      }

      const result = await manager.sendMediaMessage(sessionId, to, buffer, originalname, (caption && typeof caption === 'string') ? caption.trim() : undefined);
      const chatId = await findOrCreateChat(sessionId, to);

      let mediaUrl: string | null = null;
      try {
        const organizationId = req.context?.organizationId || (await storage.getOrganizationsByUser(userId))[0]?.id;
        if (organizationId) {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
          const ext = path.extname(originalname);
          const name = path.basename(originalname, ext);
          const filename = `${name}-${uniqueSuffix}${ext}`;
          const publicPath = buildPublicUploadPath(organizationId, 'messages', filename);
          await saveUploadBuffer(publicPath, buffer);
          mediaUrl = publicPath;
        }
      } catch (saveError) {
        console.error('[Send canned media] Error saving copy:', saveError);
      }

      const message = await storage.createMessage({
        sessionId,
        chatId,
        body: (caption && typeof caption === 'string' ? caption.trim() : null) || '[Media]',
        fromMe: true,
        type: 'image',
        status: 'sent',
        mediaUrl: mediaUrl || originalname,
      });
      clearChatbotConversationForContact(sessionId, to);
      const mediaTypeLabel = '📷 Image';
      await storage.updateChat(chatId, {
        lastMessage: caption ? `${mediaTypeLabel}: ${String(caption).substring(0, 50)}` : mediaTypeLabel,
        lastMessageTime: new Date(),
      });
      if (session.connectionType === 'official' && result.id) {
        businessAPIManager.storeMessageMapping(result.id, message.id, sessionId);
      }
      broadcastToUser(userId, 'new_message', message);
      await triggerWebhooks(userId, 'message.sent', { message, to });

      res.json({ success: true, messageId: result.id, message });
    } catch (error: any) {
      console.error('[Send canned media] Error:', error);
      res.status(500).json({ error: error.message || 'Failed to send canned media' });
    }
  });

  async function processSendMediaMessage(
    userId: string,
    organizationId: string | null,
    validatedData: SendMediaMessage,
    uploadedFile: import('./panel-inbox-send').PanelInboxMediaUpload
  ): Promise<import('./panel-inbox-send').PanelInboxSendMediaResult> {
      const session = await storage.getSession(validatedData.sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      // Append footer to caption if provided
      let captionWithFooter = validatedData.caption || '';
      if (validatedData.footer) {
        captionWithFooter = captionWithFooter ? `${captionWithFooter}\n\n${validatedData.footer}` : validatedData.footer;
        
        // For buttons, append button text as clickable link (unofficial client doesn't support interactive buttons)
        // Support both old single button format and new multiple buttons format
        const buttons = validatedData.footerButtons && validatedData.footerButtons.length > 0 
          ? validatedData.footerButtons 
          : (validatedData.footerButtonType && validatedData.footerButtonType !== 'NONE' && validatedData.footerButtonText
              ? [{
                  type: validatedData.footerButtonType,
                  text: validatedData.footerButtonText,
                  url: validatedData.footerButtonUrl,
                  phoneNumber: validatedData.footerButtonPhone,
                }]
              : []);
        
        for (const button of buttons) {
          if (button.type === 'URL' && button.text && button.url) {
            captionWithFooter = `${captionWithFooter}\n\n${button.text}: ${button.url}`;
          } else if (button.type === 'PHONE_NUMBER' && button.text && button.phoneNumber) {
            captionWithFooter = `${captionWithFooter}\n\n${button.text}: ${button.phoneNumber}`;
          } else if (button.type === 'QUICK_REPLY' && button.text) {
            captionWithFooter = `${captionWithFooter}\n\n${button.text}`;
          }
        }
      }

      const manager = await getWhatsAppManager(validatedData.sessionId);

      if (session.connectionType === 'official') {
        const credsOk = await ensureOfficialSessionCredentialsForMessaging(
          validatedData.sessionId,
          session,
          userId,
          organizationId
        );
        if (!credsOk) {
          throw new Error(
            'Could not load API credentials for this sender number. Reconnect this number in Integrations or check that the correct Meta app is linked.'
          );
        }
      }

      // Check if client is ready, wait if session is connected but client not ready yet
      let isReady = manager.isClientReady(validatedData.sessionId);
      if (session!.status === 'connected' && !isReady) {
        console.log(`[Send Media] Session is connected but client not ready, waiting up to 10 seconds...`);
        // Only wait if the manager supports waitForClientReady (unofficial manager)
        if (typeof (manager as any).waitForClientReady === 'function') {
          isReady = await (manager as any).waitForClientReady(validatedData.sessionId, 10000);
        } else {
          // For other managers, just wait a bit and check again
          await new Promise(resolve => setTimeout(resolve, 2000));
          isReady = manager.isClientReady(validatedData.sessionId);
        }
        console.log(`[Send Media] Client ready after wait: ${isReady}`);
      }
      
      if (!isReady) {
        console.error(`[Send Media] WhatsApp client not ready for session ${validatedData.sessionId}, status: ${session.status}`);
        throw new Error('The WhatsApp connection is still initializing. Please wait a moment and try again, or check if the device is properly connected.');
      }

      let fileBuffer = uploadedFile.buffer;
      let fileName = uploadedFile.originalname;
      let mimeType: string | undefined = uploadedFile.mimetype;
      const sourceMediaUrl = uploadedFile.sourceMediaUrl?.trim() || null;
      if (!path.extname(fileName) && mimeType) {
        const ext =
          mimeType.includes('jpeg') ? '.jpg'
          : mimeType.includes('png') ? '.png'
          : mimeType.includes('gif') ? '.gif'
          : mimeType.includes('webp') ? '.webp'
          : mimeType.includes('mp4') ? '.mp4'
          : mimeType.includes('pdf') ? '.pdf'
          : mimeType.includes('ogg') ? '.ogg'
          : '';
        if (ext) fileName = `${fileName}${ext}`;
      }
      if (
        validatedData.mediaType === 'audio' &&
        (uploadedFile.mimetype?.includes('audio/webm') || uploadedFile.originalname?.toLowerCase().endsWith('.webm'))
      ) {
        try {
          console.log('[Send Media] Converting audio/webm to audio/ogg for Meta API');
          fileBuffer = await convertWebmToOgg(uploadedFile.buffer);
          fileName = uploadedFile.originalname.replace(/\.webm$/i, '.ogg');
          mimeType = 'audio/ogg';
        } catch (convertErr) {
          console.error('[Send Media] WebM to OGG conversion failed:', convertErr);
          throw new Error('Could not convert the voice recording for sending. Please try again.');
        }
      }

      const mimeTypeForAudio = validatedData.mediaType === 'audio' && mimeType?.startsWith('audio/')
        ? mimeType
        : undefined;
      const result = await manager.sendMediaMessage(
        validatedData.sessionId,
        validatedData.to,
        fileBuffer,
        fileName,
        captionWithFooter,
        mimeTypeForAudio
      );

      // Find or create chat and get its UUID
      const chatId = await findOrCreateChat(validatedData.sessionId, validatedData.to);

      // Save media file to organization folder for later retrieval
      let mediaUrl: string | null = sourceMediaUrl;
      try {
        const orgIdForSave = organizationId || (await storage.getOrganizationsByUser(userId))[0]?.id;
        
        if (orgIdForSave) {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
          const ext = path.extname(fileName) || path.extname(sourceMediaUrl || '') || '';
          const name = path.basename(fileName, ext) || 'media';
          const filename = `${name}-${uniqueSuffix}${ext || '.bin'}`;
          const publicPath = buildPublicUploadPath(orgIdForSave, 'messages', filename);
          await saveUploadBuffer(publicPath, fileBuffer, mimeType);
          mediaUrl = publicPath;
        }
      } catch (saveError) {
        console.error('[Send Media] Error saving media file:', saveError);
      }

      if (!mediaUrl && sourceMediaUrl?.startsWith('/uploads/')) {
        mediaUrl = sourceMediaUrl;
      }

      // Store the message
      // Handle multiple buttons - convert to old format for backward compatibility or store as JSON
      const buttons = validatedData.footerButtons && validatedData.footerButtons.length > 0 
        ? validatedData.footerButtons 
        : (validatedData.footerButtonType && validatedData.footerButtonType !== 'NONE' && validatedData.footerButtonText
            ? [{
                type: validatedData.footerButtonType,
                text: validatedData.footerButtonText,
                url: validatedData.footerButtonUrl,
                phoneNumber: validatedData.footerButtonPhone,
              }]
            : []);
      const firstButton = buttons.length > 0 ? buttons[0] : null;
      
      const message = await storage.createMessage({
        sessionId: validatedData.sessionId,
        chatId,
        organizationId: organizationId || null,
        body: validatedData.caption || (
          validatedData.mediaType === 'document' && fileName && !/^untitled$/i.test(fileName)
            ? fileName
            : '[Media]'
        ),
        fromMe: true,
        type: validatedData.mediaType,
        status: 'sent',
        mediaUrl: mediaUrl || (sourceMediaUrl?.startsWith('/uploads/') ? sourceMediaUrl : null),
        footer: validatedData.footer || null,
        footerButtonType: firstButton ? firstButton.type : null,
        footerButtonText: buttons.length > 0 ? JSON.stringify(buttons) : null, // Store all buttons as JSON
        footerButtonUrl: firstButton?.url ?? null,
        footerButtonPhone: firstButton?.phoneNumber ?? null,
      });
      clearChatbotConversationForContact(validatedData.sessionId, validatedData.to);

      // Update chat with latest message info (for lastMessage and lastMessageTime display)
      const mediaTypeLabel = validatedData.mediaType === 'image' ? '📷 Image' : 
                            validatedData.mediaType === 'video' ? '🎥 Video' : 
                            validatedData.mediaType === 'audio' ? '🎤 Voice message' :
                            validatedData.mediaType === 'document' ? '📄 Document' : '📎 Media';
      await storage.updateChat(chatId, {
        lastMessage: validatedData.caption
          ? `${mediaTypeLabel}: ${validatedData.caption.substring(0, 50)}`
          : validatedData.mediaType === 'document' && fileName && !/^untitled$/i.test(fileName)
            ? `📄 ${fileName.substring(0, 50)}`
            : mediaTypeLabel,
        lastMessageTime: new Date(),
      });

      // Store WhatsApp message ID mapping for Business API status updates
      if (session.connectionType === 'official' && result.id) {
        businessAPIManager.storeMessageMapping(result.id, message.id, validatedData.sessionId);
      }

      broadcastToUser(userId, 'new_message', message);

      // Trigger webhook for sent message
      await triggerWebhooks(userId, 'message.sent', {
        message,
        to: validatedData.to,
      });


      return { success: true, 
        messageId: result.id,
        message };
  }

  registerPanelInboxSendMedia(processSendMediaMessage);

  app.post('/api/messages/send-media', ...withAuthAndRateLimit, ...withOrgContext, requirePermission('inbox.send'), walletUsageSkip, checkUsageLimits('message'), incrementUsage('message'), upload.single('file'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { sessionId, to, caption, mediaType } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      let footerButtons = undefined;
      if (req.body.footerButtons) {
        try {
          footerButtons = typeof req.body.footerButtons === 'string'
            ? JSON.parse(req.body.footerButtons)
            : req.body.footerButtons;
        } catch (e) {
          console.warn('[Send Media] Failed to parse footerButtons:', e);
        }
      }

      const validatedData = sendMediaMessageSchema.parse({
        sessionId,
        to,
        caption,
        mediaType,
        footer: req.body.footer,
        footerButtonType: req.body.footerButtonType || 'NONE',
        footerButtonText: req.body.footerButtonText,
        footerButtonUrl: req.body.footerButtonUrl,
        footerButtonPhone: req.body.footerButtonPhone,
        footerButtons,
      });

      const mediaKind = (validatedData.mediaType || classifyPanelUploadFromServer(
        file.mimetype || '',
        file.originalname || '',
      )) as PanelUploadMediaKind;
      try {
        assertPanelUploadSize(mediaKind, file.buffer.length);
      } catch (sizeErr: any) {
        return res.status(400).json({ error: sizeErr.message || 'File is too large' });
      }

      const organizationId = req.context?.organizationId || req.query?.organizationId || req.body?.organizationId || null;
      const session = await storage.getSession(validatedData.sessionId);
      if (!(await sessionAllowedForUser(session, validatedData.sessionId, userId, organizationId))) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const result = await processSendMediaMessage(userId, organizationId, validatedData, {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
      });
      res.json(result);
    } catch (error: any) {
      console.error('Error sending media message:', error);
      res.status(500).json({ error: error.message });
    }
  });



  // Upload media for template headers (Business API only)
  app.post('/api/media/upload', ...withAuthAndRateLimit, upload.single('file'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { sessionId, mediaType } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }

      // Use client-provided mediaType or infer from mimetype
      const uploadType: 'IMAGE' | 'VIDEO' | 'DOCUMENT' =
        mediaType === 'video' || file.mimetype?.startsWith('video/')
          ? 'VIDEO'
          : mediaType === 'document' ||
              (file.mimetype &&
                !file.mimetype.startsWith('image/') &&
                !file.mimetype.startsWith('video/') &&
                !file.mimetype.startsWith('audio/'))
            ? 'DOCUMENT'
            : 'IMAGE';

      const organizationId = req.context?.organizationId || req.query?.organizationId || req.body?.organizationId || null;
      const session = await storage.getSession(sessionId);
      if (!(await sessionAllowedForUser(session, sessionId, userId, organizationId))) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Only support Business API for media upload (for template headers)
      if (session.connectionType !== 'official') {
        return res.status(400).json({ 
          error: 'Media upload for templates is only supported with WhatsApp Business API',
          message: 'Please use a Business API session to upload media for template headers.'
        });
      }

      // Ensure Business API credentials are loaded (restore if needed)
      if (!businessAPIManager.isClientReady(sessionId)) {
        console.log(`[Media Upload] Business API credentials not in memory, attempting to restore...`);
        
        let accessToken: string | null = null;
        let phoneNumberId: string | null = null;
        let businessAccountId: string | null = null;
        
        // First, try to get credentials from integrations table (use session's integrationId when multiple Meta accounts)
        try {
          const organizationId = req.context?.organizationId || req.query?.organizationId || req.body?.organizationId || null;
          let integration = null;
          if (session.deviceInfo?.integrationId) {
            integration = await storage.getIntegration(session.deviceInfo.integrationId, userId);
          }
          if (!integration) {
            integration = await storage.getIntegrationByName("whatsapp-business", userId, organizationId || undefined);
          }
          if (integration?.status === "connected" && integration.credentials) {
            const credentials = integration.credentials as any;
            accessToken = credentials.access_token || credentials.accessToken;
            
            // Get phoneNumberId from session deviceInfo (required)
            if (session.deviceInfo?.apiPhoneNumberId) {
              phoneNumberId = session.deviceInfo.apiPhoneNumberId;
            } else if (session.deviceInfo?.phoneNumberId) {
              phoneNumberId = session.deviceInfo.phoneNumberId;
            } else {
              console.warn(`[Media Upload] Session deviceInfo missing apiPhoneNumberId for session ${sessionId}`);
            }
            
            if (session.deviceInfo?.businessAccountId) {
              businessAccountId = session.deviceInfo.businessAccountId;
            } else if (credentials.business_account_id) {
              businessAccountId = credentials.business_account_id;
            }
            
            console.log(`[Media Upload] Found credentials in integrations table:`, {
              hasAccessToken: !!accessToken,
              hasPhoneNumberId: !!phoneNumberId,
              phoneNumberId: phoneNumberId?.substring(0, 10) + '...',
            });
          }
        } catch (integrationError: any) {
          console.log(`[Media Upload] Could not get credentials from integration:`, integrationError.message);
        }
        
        // Fall back to user settings if integration didn't work
        if (!accessToken) {
          console.log(`[Media Upload] Trying user settings as fallback...`);
          const settings = await storage.getUserSettings(userId);
          
          if (settings?.whatsappBusinessCredentials?.phoneNumberId && 
              settings.whatsappBusinessCredentials.accessToken) {
            accessToken = settings.whatsappBusinessCredentials.accessToken;
            phoneNumberId = settings.whatsappBusinessCredentials.phoneNumberId;
            businessAccountId = settings.whatsappBusinessCredentials.businessAccountId || null;
            console.log(`[Media Upload] Found credentials in user settings:`, {
              hasAccessToken: !!accessToken,
              hasPhoneNumberId: !!phoneNumberId,
              phoneNumberId: phoneNumberId?.substring(0, 10) + '...',
            });
          }
        }
        
        // Validate credentials before proceeding
        if (!accessToken || !phoneNumberId) {
          console.error(`[Media Upload] Missing credentials:`, {
            hasAccessToken: !!accessToken,
            hasPhoneNumberId: !!phoneNumberId,
            sessionId,
            sessionDeviceInfo: session.deviceInfo,
          });
          return res.status(400).json({ 
            error: 'Business API credentials not found',
            message: 'Please configure your WhatsApp Business API credentials. The session exists but credentials are not available.'
          });
        }
        
        // Get businessAccountId from session or credentials
        const finalBusinessAccountId = businessAccountId || session.deviceInfo?.wabaId || session.deviceInfo?.businessAccountId;
        
        console.log(`[Media Upload] Using credentials directly (same as campaign executor):`, {
          hasAccessToken: !!accessToken,
          hasPhoneNumberId: !!phoneNumberId,
          phoneNumberId: phoneNumberId.substring(0, 10) + '...',
          hasBusinessAccountId: !!finalBusinessAccountId,
        });
        
        // Upload media using uploadMediaWithCredentials (same as campaign executor)
        const uploadResult = await businessAPIManager.uploadMediaWithCredentials(
          {
            phoneNumberId: phoneNumberId,
            accessToken: accessToken,
            businessAccountId: finalBusinessAccountId || undefined,
          },
          file.buffer,
          file.originalname,
          uploadType,
          false, // Use regular /media endpoint - media ID is used for sending, asset handles are only for template creation
          file.mimetype
        );
        
        console.log(`[Media Upload] Successfully uploaded media (${uploadType}), got media ID: ${uploadResult.id}`);
        
        return res.json({
          success: true,
          mediaId: uploadResult.id,
          url: uploadResult.url,
          filename: file.originalname,
        });
      } else {
        // Credentials are already in memory, use them directly
        const creds = businessAPIManager['credentials'].get(sessionId);
        if (!creds || !creds.accessToken || !creds.phoneNumberId) {
          return res.status(400).json({ 
            error: 'Business API credentials not available',
            message: 'Credentials are not properly loaded. Please try again.'
          });
        }
        
        const businessAccountId = session.deviceInfo?.wabaId || creds.businessAccountId;
        
        console.log(`[Media Upload] Using credentials from memory:`, {
          hasAccessToken: !!creds.accessToken,
          hasPhoneNumberId: !!creds.phoneNumberId,
          phoneNumberId: creds.phoneNumberId.substring(0, 10) + '...',
        });
        
        const uploadResult = await businessAPIManager.uploadMediaWithCredentials(
          {
            phoneNumberId: creds.phoneNumberId,
            accessToken: creds.accessToken,
            businessAccountId: businessAccountId || undefined,
          },
          file.buffer,
          file.originalname,
          uploadType,
          false, // Use regular /media endpoint - media ID is used for sending
          file.mimetype
        );
        
        console.log(`[Media Upload] Successfully uploaded media (${uploadType}), got media ID: ${uploadResult.id}`);
        
        return res.json({
          success: true,
          mediaId: uploadResult.id,
          url: uploadResult.url,
          filename: file.originalname,
        });
      }
    } catch (error: any) {
      console.error('Error uploading media:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Resumable Upload API endpoints for Meta's Resumable Upload API
  // These endpoints follow Meta's documentation for uploading large files for marketing templates

  /**
   * Step 1: Start a resumable upload session
   * POST /api/media/resumable/start
   * 
   * Request body:
   * - sessionId: string (required)
   * - fileName: string (required)
   * - fileLength: number (required) - file size in bytes
   * - fileType: string (required) - MIME type (application/pdf, image/jpeg, image/jpg, image/png, video/mp4)
   * - appId: string (optional) - Meta App ID, defaults to FACEBOOK_APP_ID env var
   * 
   * Returns:
   * - uploadSessionId: string - Format: "upload:<UPLOAD_SESSION_ID>"
   */
  app.post('/api/media/resumable/start', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { sessionId, fileName, fileLength, fileType, appId } = req.body;

      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }

      if (!fileName || !fileLength || !fileType) {
        return res.status(400).json({ 
          error: 'Missing required fields',
          message: 'fileName, fileLength, and fileType are required'
        });
      }

      // Validate file type
      const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'video/mp4'];
      if (!validTypes.includes(fileType)) {
        return res.status(400).json({ 
          error: 'Invalid file type',
          message: `File type must be one of: ${validTypes.join(', ')}`
        });
      }

      const organizationId = req.context?.organizationId || req.query?.organizationId || req.body?.organizationId || null;
      const session = await storage.getSession(sessionId);
      if (!(await sessionAllowedForUser(session, sessionId, userId, organizationId))) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Only support Business API for resumable upload
      if (session!.connectionType !== 'official') {
        return res.status(400).json({ 
          error: 'Resumable upload is only supported with WhatsApp Business API',
          message: 'Please use a Business API session for resumable uploads.'
        });
      }

      // Ensure Business API credentials are loaded
      if (!businessAPIManager.isClientReady(sessionId)) {
        const settings = await storage.getUserSettings(userId);
        
        if (settings?.whatsappBusinessCredentials?.phoneNumberId && 
            settings.whatsappBusinessCredentials.accessToken) {
          try {
            await businessAPIManager.restoreSession(sessionId, {
              phoneNumberId: settings.whatsappBusinessCredentials.phoneNumberId,
              accessToken: settings.whatsappBusinessCredentials.accessToken,
              businessAccountId: settings.whatsappBusinessCredentials.businessAccountId,
            });
          } catch (reloadError: any) {
            console.error(`[Resumable Upload] Error restoring credentials:`, reloadError);
            return res.status(400).json({ 
              error: 'Business API not ready',
              message: 'The Business API session is not properly configured.'
            });
          }
        } else {
          return res.status(400).json({ 
            error: 'Business API credentials not found',
            message: 'Please configure your WhatsApp Business API credentials in Settings.'
          });
        }
      }

      const credentials = businessAPIManager.getCredentials(sessionId);
      if (!credentials) {
        return res.status(400).json({ error: 'Business API credentials not available' });
      }

      // Get Meta App ID from request or environment
      const metaAppId = appId || process.env.FACEBOOK_APP_ID;
      if (!metaAppId) {
        return res.status(400).json({ 
          error: 'Meta App ID required',
          message: 'Please provide appId in request body or set FACEBOOK_APP_ID environment variable.'
        });
      }

      // Start upload session
      const uploadSessionId = await businessAPIManager.startResumableUploadSession(
        credentials,
        metaAppId,
        fileName,
        parseInt(fileLength, 10),
        fileType
      );

      res.json({
        success: true,
        uploadSessionId: uploadSessionId,
        message: 'Upload session started successfully'
      });
    } catch (error: any) {
      console.error('Error starting resumable upload session:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * Step 2: Upload file chunk (or full file)
   * POST /api/media/resumable/upload
   * 
   * Request body:
   * - sessionId: string (required)
   * - uploadSessionId: string (required) - From start endpoint
   * - fileOffset: number (optional) - Byte offset, defaults to 0
   * - file: File (required) - File to upload (multipart/form-data)
   * 
   * Returns:
   * - fileHandle: string - File handle (h field) for use in template headers
   */
  app.post('/api/media/resumable/upload', ...withAuthAndRateLimit, upload.single('file'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { sessionId, uploadSessionId, fileOffset } = req.body;
      const file = req.file;

      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }

      if (!uploadSessionId) {
        return res.status(400).json({ error: 'Upload session ID is required' });
      }

      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const organizationId = req.context?.organizationId || req.query?.organizationId || req.body?.organizationId || null;
      const session = await storage.getSession(sessionId);
      if (!(await sessionAllowedForUser(session, sessionId, userId, organizationId))) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Only support Business API
      if (session!.connectionType !== 'official') {
        return res.status(400).json({ 
          error: 'Resumable upload is only supported with WhatsApp Business API'
        });
      }

      // Ensure Business API credentials are loaded
      if (!businessAPIManager.isClientReady(sessionId)) {
        const settings = await storage.getUserSettings(userId);
        
        if (settings?.whatsappBusinessCredentials?.phoneNumberId && 
            settings.whatsappBusinessCredentials.accessToken) {
          try {
            await businessAPIManager.restoreSession(sessionId, {
              phoneNumberId: settings.whatsappBusinessCredentials.phoneNumberId,
              accessToken: settings.whatsappBusinessCredentials.accessToken,
              businessAccountId: settings.whatsappBusinessCredentials.businessAccountId,
            });
          } catch (reloadError: any) {
            return res.status(400).json({ 
              error: 'Business API not ready',
              message: 'The Business API session is not properly configured.'
            });
          }
        } else {
          return res.status(400).json({ 
            error: 'Business API credentials not found'
          });
        }
      }

      const credentials = businessAPIManager.getCredentials(sessionId);
      if (!credentials) {
        return res.status(400).json({ error: 'Business API credentials not available' });
      }

      // Upload file chunk
      const offset = fileOffset ? parseInt(fileOffset, 10) : 0;
      const fileHandle = await businessAPIManager.uploadFileChunk(
        credentials,
        uploadSessionId,
        file.buffer,
        offset
      );

      res.json({
        success: true,
        fileHandle: fileHandle,
        message: 'File uploaded successfully. Use the fileHandle in your template header fields.'
      });
    } catch (error: any) {
      console.error('Error uploading file chunk:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * Check upload status and get file_offset for resuming
   * GET /api/media/resumable/status/:uploadSessionId
   * 
   * Query params:
   * - sessionId: string (required)
   * 
   * Returns:
   * - id: string - Upload session ID
   * - file_offset: number - Current byte offset
   */
  app.get('/api/media/resumable/status/:uploadSessionId', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { uploadSessionId } = req.params;
      const { sessionId } = req.query;

      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }

      if (!uploadSessionId) {
        return res.status(400).json({ error: 'Upload session ID is required' });
      }

      const organizationId = req.context?.organizationId || req.query?.organizationId || req.body?.organizationId || null;
      const session = await storage.getSession(sessionId);
      if (!(await sessionAllowedForUser(session, sessionId, userId, organizationId))) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Only support Business API
      if (session!.connectionType !== 'official') {
        return res.status(400).json({ 
          error: 'Resumable upload is only supported with WhatsApp Business API'
        });
      }

      // Ensure Business API credentials are loaded
      if (!businessAPIManager.isClientReady(sessionId)) {
        const settings = await storage.getUserSettings(userId);
        
        if (settings?.whatsappBusinessCredentials?.phoneNumberId && 
            settings.whatsappBusinessCredentials.accessToken) {
          try {
            await businessAPIManager.restoreSession(sessionId, {
              phoneNumberId: settings.whatsappBusinessCredentials.phoneNumberId,
              accessToken: settings.whatsappBusinessCredentials.accessToken,
              businessAccountId: settings.whatsappBusinessCredentials.businessAccountId,
            });
          } catch (reloadError: any) {
            return res.status(400).json({ 
              error: 'Business API not ready'
            });
          }
        } else {
          return res.status(400).json({ 
            error: 'Business API credentials not found'
          });
        }
      }

      const credentials = businessAPIManager.getCredentials(sessionId);
      if (!credentials) {
        return res.status(400).json({ error: 'Business API credentials not available' });
      }

      // Get upload status
      const status = await businessAPIManager.getUploadStatus(credentials, uploadSessionId);

      res.json({
        success: true,
        ...status
      });
    } catch (error: any) {
      console.error('Error getting upload status:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * Resume an interrupted upload
   * POST /api/media/resumable/resume
   * 
   * Request body:
   * - sessionId: string (required)
   * - uploadSessionId: string (required) - From start endpoint
   * - file: File (required) - Full file data (multipart/form-data)
   * 
   * Returns:
   * - fileHandle: string - File handle (h field) for use in template headers
   */
  app.post('/api/media/resumable/resume', ...withAuthAndRateLimit, upload.single('file'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { sessionId, uploadSessionId } = req.body;
      const file = req.file;

      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }

      if (!uploadSessionId) {
        return res.status(400).json({ error: 'Upload session ID is required' });
      }

      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const organizationId = req.context?.organizationId || req.query?.organizationId || req.body?.organizationId || null;
      const session = await storage.getSession(sessionId);
      if (!(await sessionAllowedForUser(session, sessionId, userId, organizationId))) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Only support Business API
      if (session!.connectionType !== 'official') {
        return res.status(400).json({ 
          error: 'Resumable upload is only supported with WhatsApp Business API'
        });
      }

      // Ensure Business API credentials are loaded
      if (!businessAPIManager.isClientReady(sessionId)) {
        const settings = await storage.getUserSettings(userId);
        
        if (settings?.whatsappBusinessCredentials?.phoneNumberId && 
            settings.whatsappBusinessCredentials.accessToken) {
          try {
            await businessAPIManager.restoreSession(sessionId, {
              phoneNumberId: settings.whatsappBusinessCredentials.phoneNumberId,
              accessToken: settings.whatsappBusinessCredentials.accessToken,
              businessAccountId: settings.whatsappBusinessCredentials.businessAccountId,
            });
          } catch (reloadError: any) {
            return res.status(400).json({ 
              error: 'Business API not ready'
            });
          }
        } else {
          return res.status(400).json({ 
            error: 'Business API credentials not found'
          });
        }
      }

      const credentials = businessAPIManager.getCredentials(sessionId);
      if (!credentials) {
        return res.status(400).json({ error: 'Business API credentials not available' });
      }

      // Resume upload
      const fileHandle = await businessAPIManager.resumeUpload(
        credentials,
        uploadSessionId,
        file.buffer
      );

      res.json({
        success: true,
        fileHandle: fileHandle,
        message: 'Upload resumed and completed successfully. Use the fileHandle in your template header fields.'
      });
    } catch (error: any) {
      console.error('Error resuming upload:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * Convenience endpoint: Complete resumable upload in one call
   * POST /api/media/resumable/complete
   * 
   * Request body:
   * - sessionId: string (required)
   * - appId: string (optional) - Meta App ID, defaults to FACEBOOK_APP_ID env var
   * - file: File (required) - File to upload (multipart/form-data)
   * 
   * Returns:
   * - fileHandle: string - File handle (h field) for use in template headers
   */
  app.post('/api/media/resumable/complete', ...withAuthAndRateLimit, upload.single('file'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { sessionId, appId } = req.body;
      const file = req.file;

      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }

      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const organizationId = req.context?.organizationId || req.query?.organizationId || req.body?.organizationId || null;
      const session = await storage.getSession(sessionId);
      if (!(await sessionAllowedForUser(session, sessionId, userId, organizationId))) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Only support Business API
      if (session!.connectionType !== 'official') {
        return res.status(400).json({ 
          error: 'Resumable upload is only supported with WhatsApp Business API'
        });
      }

      // Ensure Business API credentials are loaded
      if (!businessAPIManager.isClientReady(sessionId)) {
        const settings = await storage.getUserSettings(userId);
        
        if (settings?.whatsappBusinessCredentials?.phoneNumberId && 
            settings.whatsappBusinessCredentials.accessToken) {
          try {
            await businessAPIManager.restoreSession(sessionId, {
              phoneNumberId: settings.whatsappBusinessCredentials.phoneNumberId,
              accessToken: settings.whatsappBusinessCredentials.accessToken,
              businessAccountId: settings.whatsappBusinessCredentials.businessAccountId,
            });
          } catch (reloadError: any) {
            return res.status(400).json({ 
              error: 'Business API not ready'
            });
          }
        } else {
          return res.status(400).json({ 
            error: 'Business API credentials not found'
          });
        }
      }

      const credentials = businessAPIManager.getCredentials(sessionId);
      if (!credentials) {
        return res.status(400).json({ error: 'Business API credentials not available' });
      }

      // Get Meta App ID from request or environment
      const metaAppId = appId || process.env.FACEBOOK_APP_ID;
      if (!metaAppId) {
        return res.status(400).json({ 
          error: 'Meta App ID required',
          message: 'Please provide appId in request body or set FACEBOOK_APP_ID environment variable.'
        });
      }

      // Determine file type from file
      const mimeType = file.mimetype || 'application/octet-stream';
      const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'video/mp4'];
      if (!validTypes.includes(mimeType)) {
        return res.status(400).json({ 
          error: 'Invalid file type',
          message: `File type must be one of: ${validTypes.join(', ')}`
        });
      }

      // Complete resumable upload
      const fileHandle = await businessAPIManager.uploadFileResumable(
        credentials,
        metaAppId,
        file.buffer,
        file.originalname,
        mimeType
      );

      res.json({
        success: true,
        fileHandle: fileHandle,
        message: 'File uploaded successfully. Use the fileHandle in your template header fields.'
      });
    } catch (error: any) {
      console.error('Error completing resumable upload:', error);
      res.status(500).json({ error: error.message });
    }
  });


  // Get media URL for preview
  // Proxy endpoint for Facebook CDN media URLs (requires authentication)
  // Note: This endpoint is public but validates sessionId to ensure security
  app.get('/api/media-proxy', async (req: any, res) => {
    try {
      
      const { url, sessionId } = req.query;

      if (!url) {
        console.warn('[Media Proxy] Missing URL parameter');
        return res.status(400).json({ error: 'URL is required' });
      }

      if (!sessionId) {
        console.warn('[Media Proxy] Missing sessionId parameter');
        return res.status(400).json({ error: 'Session ID is required' });
      }

      // Verify session exists (we don't need userId check for media proxy)
      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Only support Business API for media proxy
      if (session.connectionType !== 'official') {
        return res.status(400).json({ 
          error: 'Media proxy is only supported with WhatsApp Business API'
        });
      }

      // Check if URL is a Facebook CDN URL
      if (!url.includes('lookaside.fbsbx.com') && !url.includes('facebook.com')) {
        return res.status(400).json({ error: 'Invalid media URL' });
      }

      // Get credentials for the session
      let creds = businessAPIManager['credentials'].get(sessionId);
      if (!creds) {
        // Try to restore session credentials if not loaded
        // Check both integrations table (OAuth) and user settings (legacy)
        try {
          let accessToken: string | null = null;
          let phoneNumberId: string | null = null;
          let businessAccountId: string | null = null;
          
          // First, try to get credentials from integrations table (OAuth-based)
          // This is the primary source for OAuth-connected accounts
          try {
            let integration = null;
            
            // Use session's integrationId when set (multiple Meta/WhatsApp accounts)
            if (session.deviceInfo?.integrationId) {
              integration = await storage.getIntegration(session.deviceInfo.integrationId, session.userId);
              if (integration) {
                console.log(`[Media Proxy] Using integration by session integrationId: ${integration.id}`);
              }
            }
            
            // If no integration found by integrationId, try by name
            if (!integration) {
              integration = await storage.getIntegrationByName("whatsapp-business", session.userId, session.organizationId || undefined);
            }
            
            // If we have a session phone number ID, find an integration whose token can access it
            if (!integration && session.deviceInfo?.apiPhoneNumberId) {
              const allIntegrations = await storage.getIntegrationsByUser(session.userId, session.organizationId || undefined);
              const matchingIntegration = allIntegrations.find(
                (int: any) => int.name === "whatsapp-business" && int.status === "connected"
              );
              if (matchingIntegration) {
                integration = matchingIntegration;
              }
            }
            
            if (integration?.status === "connected" && integration.credentials) {
              const credentials = integration.credentials as any;
              accessToken = credentials.access_token;
              phoneNumberId = session.deviceInfo?.apiPhoneNumberId || credentials.phone_number_id;
              businessAccountId = session.deviceInfo?.businessAccountId || credentials.business_account_id;
              console.log(`[Media Proxy] Found credentials in integration ${integration.id}`);
            }
          } catch (integrationError) {
            console.warn('[Media Proxy] Error getting credentials from integration:', integrationError);
          }
          
          // Fall back to user settings (legacy)
          if (!accessToken) {
            const settings = await storage.getUserSettings(session.userId);
            if (settings?.whatsappBusinessCredentials?.phoneNumberId && 
                settings.whatsappBusinessCredentials.accessToken) {
              accessToken = settings.whatsappBusinessCredentials.accessToken;
              phoneNumberId = settings.whatsappBusinessCredentials.phoneNumberId;
              businessAccountId = settings.whatsappBusinessCredentials.businessAccountId;
              console.log(`[Media Proxy] Found credentials in user settings`);
            }
          }
          
          // Restore session if we found credentials
          if (accessToken && phoneNumberId) {
            await businessAPIManager.restoreSession(sessionId, {
              phoneNumberId: phoneNumberId,
              accessToken: accessToken,
              businessAccountId: businessAccountId || undefined,
            });
            // Try to get credentials again
            creds = businessAPIManager['credentials'].get(sessionId);
            if (creds) {
              console.log(`[Media Proxy] Successfully restored credentials for session ${sessionId}`);
            }
          }
        } catch (restoreError) {
          console.error('[Media Proxy] Error restoring session:', restoreError);
        }
        
        if (!creds) {
          console.error('[Media Proxy] Failed to restore credentials:', {
            sessionId,
            userId: session.userId,
            organizationId: session.organizationId,
            hasIntegrationId: !!session.deviceInfo?.integrationId,
            apiPhoneNumberId: session.deviceInfo?.apiPhoneNumberId,
          });
          return res.status(404).json({ 
            error: 'Session credentials not found',
            message: 'Please ensure your WhatsApp Business account is properly connected and try again.'
          });
        }
      }

      const decodedUrl = decodeURIComponent(url);

      // Fetch media from Facebook CDN with authentication
      let mediaResponse = await fetch(decodedUrl, {
        headers: {
          'Authorization': `Bearer ${creds.accessToken}`,
        },
      });

      // If URL expired (404) or unauthorized (401/403), try to get fresh URL using media ID from the URL
      if (!mediaResponse.ok && (mediaResponse.status === 404 || mediaResponse.status === 401 || mediaResponse.status === 403)) {
        // Try to extract media ID from the URL
        let possibleMediaId: string | null = null;
        const midMatch = decodedUrl.match(/[?&]mid=([a-zA-Z0-9_-]+)/);
        if (midMatch && midMatch[1]) possibleMediaId = midMatch[1];
        if (!possibleMediaId) {
          const mediaIdMatch = decodedUrl.match(/\/([a-zA-Z0-9_-]{15,})\//) || 
                              decodedUrl.match(/id=([a-zA-Z0-9_-]{15,})/) ||
                              decodedUrl.match(/\/([a-zA-Z0-9_-]{15,})$/);
          if (mediaIdMatch && mediaIdMatch[1]) possibleMediaId = mediaIdMatch[1];
        }
        
        if (possibleMediaId) {
          try {
            const freshUrl = await businessAPIManager.getMediaUrl(creds, possibleMediaId);
            mediaResponse = await fetch(freshUrl, {
              headers: { 'Authorization': `Bearer ${creds.accessToken}` },
            });
            if (mediaResponse.ok) {
              console.log('[Media Proxy] Recovered media using fresh URL from media ID');
            }
          } catch (mediaIdError: any) {
            // Expected for expired media: "Object does not exist" - WhatsApp media expires
            const isExpired = /Object with ID .* does not exist|does not support this operation/i.test(mediaIdError.message || '');
            if (isExpired) {
              console.warn('[Media Proxy] Media expired or no longer available (ID:', possibleMediaId, ')');
            } else {
              console.warn('[Media Proxy] getMediaUrl failed:', mediaIdError.message);
            }
          }
        }
      }

      if (!mediaResponse.ok) {
        const errorText = await mediaResponse.text().catch(() => 'Unknown error');
        let errorMessage = `Failed to fetch media: ${mediaResponse.statusText}`;
        if (mediaResponse.status === 404) {
          errorMessage = 'Media URL has expired. WhatsApp media links expire after a short period. Ask the sender to resend if needed.';
        } else if (mediaResponse.status === 403) {
          errorMessage = 'Access denied. Please check your WhatsApp Business API credentials.';
        }
        return res.status(mediaResponse.status).json({ 
          error: errorMessage,
          status: mediaResponse.status
        });
      }
      
      console.log('[Media Proxy] Successfully fetched media, streaming to client');

      // Get content type
      const contentType = mediaResponse.headers.get('content-type') || 'image/jpeg';
      
      // Set response headers
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

      // Stream the media to the client
      const buffer = await mediaResponse.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (error: any) {
      console.error('Error proxying media:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/media/:mediaId', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { mediaId } = req.params;
      const { sessionId } = req.query;

      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }

      const organizationId = req.context?.organizationId || req.query?.organizationId || null;
      const session = await storage.getSession(sessionId);
      if (!(await sessionAllowedForUser(session, sessionId, userId, organizationId))) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Only support Business API for media preview
      if (session!.connectionType !== 'official') {
        return res.status(400).json({ 
          error: 'Media preview is only supported with WhatsApp Business API'
        });
      }

      // Try to find local file first (faster and more reliable)
      try {
        // Get organization ID
        let organizationId = req.context?.organizationId || req.query?.organizationId;
        if (!organizationId) {
          const organizations = await storage.getOrganizationsByUser(userId);
          organizationId = organizations[0]?.id;
        }
        
        if (organizationId) {
          const templatesFolder = path.join(process.cwd(), 'uploads', organizationId, 'templates');
          
          // Look for file with mediaId in filename
          if (fs.existsSync(templatesFolder)) {
            const files = fs.readdirSync(templatesFolder);
            const matchingFile = files.find(f => f.includes(mediaId));
            
            if (matchingFile) {
              const filePath = path.join(templatesFolder, matchingFile);
              if (fs.existsSync(filePath)) {
                // Return local URL
                const localUrl = `/uploads/${organizationId}/templates/${matchingFile}`;
                return res.json({ url: localUrl });
              }
            }
          }
        }
      } catch (localError) {
        console.warn('[Get Media] Could not find local file, trying WhatsApp API:', localError);
      }

      // Fallback: Try to get from WhatsApp API (may fail if URL expired)
      try {
        const credsOk = await ensureOfficialSessionCredentialsForMessaging(
          sessionId,
          session!,
          userId,
          organizationId
        );
        if (!credsOk) {
          return res.status(400).json({
            error: 'WhatsApp Business API not ready',
            message: 'Could not load API credentials for this session. Reconnect the number in Integrations.',
          });
        }

        const result = await businessAPIManager.getMediaForTemplate(sessionId, mediaId);
        return res.json(result);
      } catch (whatsappError) {
        console.error('[Get Media] WhatsApp API error:', whatsappError);
        return res.status(404).json({ 
          error: 'Media not found',
          message: 'The media file could not be retrieved. It may have expired or been deleted.'
        });
      }
    } catch (error: any) {
      console.error('Error getting media URL:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Send location message endpoint
  app.post('/api/messages/send-location', ...withAuthAndRateLimit, ...withOrgContext, requirePermission('inbox.send'), walletUsageSkip, checkUsageLimits('message'), incrementUsage('message'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId || req.query?.organizationId || req.body?.organizationId || null;
      const validatedData = sendLocationMessageSchema.parse(req.body);

      const session = await storage.getSession(validatedData.sessionId);
      if (!(await sessionAllowedForUser(session, validatedData.sessionId, userId, organizationId))) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const manager = await getWhatsAppManager(validatedData.sessionId);

      // Check if client is ready, wait if session is connected but client not ready yet
      let isReady = manager.isClientReady(validatedData.sessionId);
      if (session.status === 'connected' && !isReady) {
        console.log(`[Send Location] Session is connected but client not ready, waiting up to 10 seconds...`);
        // Only wait if the manager supports waitForClientReady (unofficial manager)
        if (typeof (manager as any).waitForClientReady === 'function') {
          isReady = await (manager as any).waitForClientReady(validatedData.sessionId, 10000);
        } else {
          // For other managers, just wait a bit and check again
          await new Promise(resolve => setTimeout(resolve, 2000));
          isReady = manager.isClientReady(validatedData.sessionId);
        }
        console.log(`[Send Location] Client ready after wait: ${isReady}`);
      }
      
      if (!isReady) {
        console.error(`[Send Location] WhatsApp client not ready for session ${validatedData.sessionId}, status: ${session.status}`);
        return res.status(400).json({ 
          error: 'WhatsApp client not ready',
          message: 'The WhatsApp connection is still initializing. Please wait a moment and try again, or check if the device is properly connected.'
        });
      }

      // Append footer to address if provided
      let addressWithFooter = validatedData.address || '';
      if (validatedData.footer) {
        addressWithFooter = addressWithFooter ? `${addressWithFooter}\n\n${validatedData.footer}` : validatedData.footer;
        
        // For buttons, append button text as clickable link (unofficial client doesn't support interactive buttons)
        // Support both old single button format and new multiple buttons format
        const buttons = validatedData.footerButtons && validatedData.footerButtons.length > 0 
          ? validatedData.footerButtons 
          : (validatedData.footerButtonType && validatedData.footerButtonType !== 'NONE' && validatedData.footerButtonText
              ? [{
                  type: validatedData.footerButtonType,
                  text: validatedData.footerButtonText,
                  url: validatedData.footerButtonUrl,
                  phoneNumber: validatedData.footerButtonPhone,
                }]
              : []);
        
        for (const button of buttons) {
          if (button.type === 'URL' && button.text && button.url) {
            addressWithFooter = `${addressWithFooter}\n\n${button.text}: ${button.url}`;
          } else if (button.type === 'PHONE_NUMBER' && button.text && button.phoneNumber) {
            addressWithFooter = `${addressWithFooter}\n\n${button.text}: ${button.phoneNumber}`;
          } else if (button.type === 'QUICK_REPLY' && button.text) {
            addressWithFooter = `${addressWithFooter}\n\n${button.text}`;
          }
        }
      }
      
      const result = await manager.sendLocationMessage(
        validatedData.sessionId,
        validatedData.to,
        parseFloat(validatedData.latitude),
        parseFloat(validatedData.longitude),
        addressWithFooter
      );

      // Find or create chat and get its UUID
      const chatId = await findOrCreateChat(validatedData.sessionId, validatedData.to);

      // Store the message
      // Handle multiple buttons - convert to old format for backward compatibility or store as JSON
      const buttons = validatedData.footerButtons && validatedData.footerButtons.length > 0 
        ? validatedData.footerButtons 
        : (validatedData.footerButtonType && validatedData.footerButtonType !== 'NONE' && validatedData.footerButtonText
            ? [{
                type: validatedData.footerButtonType,
                text: validatedData.footerButtonText,
                url: validatedData.footerButtonUrl,
                phoneNumber: validatedData.footerButtonPhone,
              }]
            : []);
      const firstButton = buttons.length > 0 ? buttons[0] : null;
      
      const message = await storage.createMessage({
        sessionId: validatedData.sessionId,
        chatId,
        body: validatedData.address || `Location: ${validatedData.latitude}, ${validatedData.longitude}`, // Store original address without footer
        fromMe: true,
        type: 'location',
        status: 'sent',
        latitude: validatedData.latitude,
        longitude: validatedData.longitude,
        address: validatedData.address || null,
        footer: validatedData.footer || null,
        footerButtonType: firstButton ? firstButton.type : null,
        footerButtonText: buttons.length > 0 ? JSON.stringify(buttons) : null, // Store all buttons as JSON
        footerButtonUrl: firstButton?.url ?? null,
        footerButtonPhone: firstButton?.phoneNumber ?? null,
      });
      clearChatbotConversationForContact(validatedData.sessionId, validatedData.to);

      // Store WhatsApp message ID mapping for Business API status updates
      if (session.connectionType === 'official' && result.id) {
        businessAPIManager.storeMessageMapping(result.id, message.id, validatedData.sessionId);
      }


      broadcastToUser(userId, 'new_message', message);

      // Trigger webhook for sent message
      await triggerWebhooks(userId, 'message.sent', {
        message,
        to: validatedData.to,
      });

      res.json({ 
        success: true, 
        messageId: result.id,
        message 
      });
    } catch (error: any) {
      console.error('Error sending location message:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Send contact message endpoint (vCard)
  app.post('/api/messages/send-contact', ...withAuthAndRateLimit, ...withOrgContext, requirePermission('inbox.send'), walletUsageSkip, checkUsageLimits('message'), incrementUsage('message'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId || req.query?.organizationId || req.body?.organizationId || null;
      const validatedData = sendContactMessageSchema.parse(req.body);

      const session = await storage.getSession(validatedData.sessionId);
      if (!(await sessionAllowedForUser(session, validatedData.sessionId, userId, organizationId))) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const manager = await getWhatsAppManager(validatedData.sessionId);

      // Check if client is ready, wait if session is connected but client not ready yet
      let isReady = manager.isClientReady(validatedData.sessionId);
      if (session.status === 'connected' && !isReady) {
        console.log(`[Send Contact] Session is connected but client not ready, waiting up to 10 seconds...`);
        // Only wait if the manager supports waitForClientReady (unofficial manager)
        if (typeof (manager as any).waitForClientReady === 'function') {
          isReady = await (manager as any).waitForClientReady(validatedData.sessionId, 10000);
        } else {
          // For other managers, just wait a bit and check again
          await new Promise(resolve => setTimeout(resolve, 2000));
          isReady = manager.isClientReady(validatedData.sessionId);
        }
        console.log(`[Send Contact] Client ready after wait: ${isReady}`);
      }
      
      if (!isReady) {
        console.error(`[Send Contact] WhatsApp client not ready for session ${validatedData.sessionId}, status: ${session.status}`);
        return res.status(400).json({ 
          error: 'WhatsApp client not ready',
          message: 'The WhatsApp connection is still initializing. Please wait a moment and try again, or check if the device is properly connected.'
        });
      }

      const result = await manager.sendContactMessage(
        validatedData.sessionId,
        validatedData.to,
        validatedData.name,
        validatedData.phone,
        validatedData.email
      );

      // Find or create chat and get its UUID
      const chatId = await findOrCreateChat(validatedData.sessionId, validatedData.to);

      // Generate simple vCard (proper formatting without leading spaces)
      const vcardLines = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${validatedData.name}`,
        `TEL:${validatedData.phone}`
      ];
      
      if (validatedData.email) {
        vcardLines.push(`EMAIL:${validatedData.email}`);
      }
      
      vcardLines.push('END:VCARD');
      const vcard = vcardLines.join('\n');

      // Store the message (footer is handled separately, not appended to body)
      // Handle multiple buttons - convert to old format for backward compatibility or store as JSON
      const buttons = validatedData.footerButtons && validatedData.footerButtons.length > 0 
        ? validatedData.footerButtons 
        : (validatedData.footerButtonType && validatedData.footerButtonType !== 'NONE' && validatedData.footerButtonText
            ? [{
                type: validatedData.footerButtonType,
                text: validatedData.footerButtonText,
                url: validatedData.footerButtonUrl,
                phoneNumber: validatedData.footerButtonPhone,
              }]
            : []);
      const firstButton = buttons.length > 0 ? buttons[0] : null;
      
      const message = await storage.createMessage({
        sessionId: validatedData.sessionId,
        chatId,
        body: `Contact: ${validatedData.name}`, // Store original contact name without footer
        fromMe: true,
        type: 'contact',
        status: 'sent',
        vcard,
        footer: validatedData.footer || null,
        footerButtonType: firstButton ? firstButton.type : null,
        footerButtonText: buttons.length > 0 ? JSON.stringify(buttons) : null, // Store all buttons as JSON
        footerButtonUrl: firstButton?.url ?? null,
        footerButtonPhone: firstButton?.phoneNumber ?? null,
      });
      clearChatbotConversationForContact(validatedData.sessionId, validatedData.to);

      // Store WhatsApp message ID mapping for Business API status updates
      if (session.connectionType === 'official' && result.id) {
        businessAPIManager.storeMessageMapping(result.id, message.id, validatedData.sessionId);
      }


      broadcastToUser(userId, 'new_message', message);

      // Trigger webhook for sent message
      await triggerWebhooks(userId, 'message.sent', {
        message,
        to: validatedData.to,
      });

      res.json({ 
        success: true, 
        messageId: result.id,
        message 
      });
    } catch (error: any) {
      console.error('Error sending contact message:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // WhatsApp Business API Webhook endpoint for message status updates
  // Handle both GET (verification) and POST (events)
  app.get('/api/webhooks/whatsapp-business', async (req: any, res) => {
    try {
      // Webhook verification (Meta sends GET request)
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];
      
      console.log('[Business API Webhook] Verification request received');
      console.log('[Business API Webhook] Mode:', mode);
      console.log('[Business API Webhook] Has token:', !!token);
      console.log('[Business API Webhook] Token value:', token ? `${token.substring(0, 5)}...` : 'none');
      console.log('[Business API Webhook] Has challenge:', !!challenge);
      console.log('[Business API Webhook] Challenge:', challenge);
      
      // Get expected verify token from environment variable
      const expectedToken = process.env.WEBHOOK_VERIFY_TOKEN || process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
      
      // Verify webhook subscription request
      if (mode === 'subscribe' && challenge) {
        // If verify token is configured, check it matches
        if (expectedToken) {
          if (token !== expectedToken) {
            console.error('[Business API Webhook] ❌ Verification failed: Token mismatch');
            console.error('[Business API Webhook]    Expected:', expectedToken ? `${expectedToken.substring(0, 5)}...` : 'none');
            console.error('[Business API Webhook]    Received:', token ? `${token.substring(0, 5)}...` : 'none');
            console.error('[Business API Webhook]    💡 Set WEBHOOK_VERIFY_TOKEN in .env to match Meta Dashboard');
            return res.status(403).send('Forbidden - Token mismatch');
          }
          console.log('[Business API Webhook] ✅ Token verified successfully');
        } else {
          console.warn('[Business API Webhook] ⚠️  No WEBHOOK_VERIFY_TOKEN configured - accepting any token');
          console.warn('[Business API Webhook]    💡 Set WEBHOOK_VERIFY_TOKEN in .env for production');
        }
        
        console.log('[Business API Webhook] ✅ Webhook verified successfully');
        console.log('[Business API Webhook]    Returning challenge:', challenge);
        
        // Forward verification to other domains (non-blocking)
        webhookForwarder.forwardWebhookVerification({
          'hub.mode': mode,
          'hub.verify_token': token,
          'hub.challenge': challenge,
        }).catch(err => {
          console.error('[Business API Webhook] Error forwarding verification:', err);
        });
        
        // Return challenge to complete verification
        return res.status(200).send(challenge);
      } else {
        console.warn('[Business API Webhook] ❌ Verification failed: Invalid parameters');
        console.warn('[Business API Webhook]    Mode:', mode);
        console.warn('[Business API Webhook]    Has challenge:', !!challenge);
        console.warn('[Business API Webhook]    Expected: mode=subscribe and challenge present');
        return res.status(403).send('Forbidden');
      }
    } catch (error: any) {
      console.error('[Business API Webhook] ❌ Verification error:', error);
      res.status(500).send('Internal Server Error');
    }
  });

  app.post('/api/webhooks/whatsapp-business', async (req: any, res) => {
    try {
      // Verify webhook signature (optional but recommended)
      // For now, we'll accept all requests - in production, verify X-Hub-Signature-256
      
      const body = req.body;

      // Log webhook to files for owner debugging (non-blocking, avoids DB bloat)
      if (body.object === 'whatsapp_business_account') {
        const { appendWebhookLog } = await import('./webhooks/meta-webhook-logger');
        const entries = body.entry || [];
        for (const entry of entries) {
          const changes = entry.changes || [];
          for (const change of changes) {
            const value = change.value;
            const eventType = change.field === 'messages' ? 'messages' : change.field === 'message_template_status_update' ? 'message_template_status_update' : change.field || 'unknown';
            const metadata = value?.metadata || {};
            const messageCount = value?.messages?.length ?? value?.sent?.length ?? value?.message_echoes?.length ?? null;
            const statusCount = value?.statuses ? value.statuses.length : null;
            appendWebhookLog({
              eventType,
              field: change.field,
              payload: body,
              phoneNumberId: metadata.phone_number_id || null,
              displayPhoneNumber: metadata.display_phone_number || null,
              messageCount: messageCount ?? statusCount,
              statusCount: statusCount ?? null,
            });
          }
        }
      }

      // Commented out verbose webhook logs - uncomment for debugging
      // console.log('[Business API Webhook] ========== WEBHOOK RECEIVED ==========');
      // console.log('[Business API Webhook] Method:', req.method);
      // console.log('[Business API Webhook] URL:', req.url);
      // console.log('[Business API Webhook] Headers:', JSON.stringify(req.headers, null, 2));
      // console.log('[Business API Webhook] Body:', JSON.stringify(body, null, 2));
      // console.log('[Business API Webhook] ======================================');
      
      // Process webhook events
      if (body.object === 'whatsapp_business_account') {
        const entries = body.entry || [];
        
        for (const entry of entries) {
          const changes = entry.changes || [];
          
          for (const change of changes) {
            if (change.field === 'messages') {
              const value = change.value;
              const meta = value?.metadata || {};
              const hasMessages = value?.messages?.length;
              const hasSent = value?.sent?.length;
              const hasStatuses = value?.statuses?.length;
              if (hasMessages || hasSent || hasStatuses) {
                console.log('[Business API Webhook] 📥 Payload:', {
                  phoneNumberId: meta.phone_number_id,
                  displayPhoneNumber: meta.display_phone_number,
                  messages: hasMessages || 0,
                  sent: hasSent || 0,
                  statuses: hasStatuses || 0,
                });
              }
              
              // Log webhook payload structure for debugging
              if (value.sent && Array.isArray(value.sent) && value.sent.length > 0) {
                console.log('[Business API Webhook] 📤 Received value.sent array with', value.sent.length, 'message(s)');
                console.log('[Business API Webhook] Sample sent message:', {
                  id: value.sent[0]?.id,
                  to: value.sent[0]?.to,
                  type: value.sent[0]?.type,
                  timestamp: value.sent[0]?.timestamp,
                });
              }
              
              // Handle delivery errors (Meta sends these when message fails to deliver)
              if (value.errors && Array.isArray(value.errors)) {
                for (const err of value.errors) {
                  const wamid = err.message_id || err.id;
                  const errorMsg = err.message || err.title || err.error?.message || 'Delivery failed';
                  const errorCode = err.code?.toString() || err.error?.code?.toString();
                  console.warn('[Business API Webhook] Delivery error received:', { wamid, errorMsg, errorCode, recipient: err.recipient_id });
                  if (wamid) {
                    const failStatus = { id: wamid, status: 'failed', errors: [{ code: err.code, message: errorMsg, title: err.title }], recipient_id: err.recipient_id };
                    const result = await businessAPIManager.processMessageStatus(failStatus, {
                      phone_number_id: value.metadata?.phone_number_id,
                      display_phone_number: value.metadata?.display_phone_number,
                    });
                    if (result && 'results' in result) {
                      for (const r of result.results) {
                        if (r.messageId && r.userId) {
                          broadcastToUser(r.userId, 'message_status_update', { messageId: r.messageId, status: 'failed' });
                        }
                      }
                    }
                  }
                }
              }

              // Handle messages SENT by the business from their phone (WhatsApp Business app) – BEFORE statuses
              // Process sent first so status updates can find the message when both arrive in same webhook
              if (value.sent && Array.isArray(value.sent)) {
                console.log(`[Business API Webhook] Processing ${value.sent.length} message(s) sent from WhatsApp Business app`);
                for (const message of value.sent) {
                  try {
                    const result = await businessAPIManager.processIncomingMessage(message, {
                      phone_number_id: value.metadata?.phone_number_id,
                      display_phone_number: value.metadata?.display_phone_number,
                    }, value.contacts, { isSentByBusiness: true });
                    if (result?.updatedMessages) {
                      for (const item of result.updatedMessages) {
                        const { message: m, userId, eventType } = item as { message: any; userId: string; eventType?: 'new_message' | 'message_updated' };
                        const evt = eventType === 'message_updated' ? 'message_updated' : 'new_message';
                        broadcastToUser(userId, evt, evt === 'new_message' ? m : { chatId: m.chatId, messageId: m.id, message: m });
                      }
                    } else if (result?.updatedMessage && result?.userId) {
                      const evt = (result as any).eventType === 'message_updated' ? 'message_updated' : 'new_message';
                      broadcastToUser(result.userId, evt, evt === 'new_message' ? result.updatedMessage : { chatId: result.updatedMessage.chatId, messageId: result.updatedMessage.id, message: result.updatedMessage });
                    } else {
                      console.log(`[Business API Webhook] ✅ Processed sent message from app: ${message.id}`);
                    }
                  } catch (messageError: any) {
                    console.error('[Business API Webhook] ❌ Error processing sent message:', {
                      messageId: message.id,
                      to: message.to,
                      from: message.from,
                      error: messageError.message,
                      stack: messageError.stack,
                    });
                  }
                }
              }

              // Handle message status updates
              if (value.statuses && Array.isArray(value.statuses)) {
                for (const status of value.statuses) {
                  // Commented out verbose status update logs - uncomment for debugging
                  // console.log('[Business API Webhook] Processing status update:', {
                  //   whatsappMessageId: status.id,
                  //   status: status.status,
                  //   recipient: status.recipient_id,
                  //   timestamp: status.timestamp,
                  // });
                  
                  const result = await businessAPIManager.processMessageStatus(status, {
                    phone_number_id: value.metadata?.phone_number_id,
                    display_phone_number: value.metadata?.display_phone_number,
                  });
                  
                  // Broadcast status update via WebSocket (supports multiple accounts with same phone number)
                  const statusResults = result && 'results' in result ? result.results : result && result.messageId && result.userId ? [result] : [];
                  for (const r of statusResults) {
                    if (r.messageId && r.userId) {
                      broadcastToUser(r.userId, 'message_status_update', {
                        messageId: r.messageId,
                        status: r.status,
                      });
                    }
                  }
                  if (statusResults.length === 0) {
                    // Only log warnings for actual issues
                    // console.warn('[Business API Webhook] Could not broadcast status update - message not found:', {
                    //   result,
                    //   statusId: status.id,
                    //   statusValue: status.status,
                    //   recipientId: status.recipient_id,
                    // });
                  }
                }
              }
              
              // Handle incoming messages
              if (value.messages && Array.isArray(value.messages)) {
                const types = value.messages.map((m: any) => m.type);
                const withContext = value.messages.filter((m: any) => m.context?.id || m.context?.message_id);
                console.log('[Business API Webhook] Incoming message(s) received:', {
                  count: value.messages.length,
                  types,
                  hasInteractive: value.messages.some((m: any) => !!m.interactive),
                  withContext: withContext.length,
                });
                // Log each message that could be a template button click (type button, or interactive with context)
                for (const m of value.messages) {
                  if (m.type === 'button' || (m.interactive && (m.context?.id || m.context?.message_id))) {
                    console.log('[Business API Webhook] Possible button/reply – type:', m.type, 'interactive?.type:', m.interactive?.type, 'context.id:', m.context?.id ?? m.context?.message_id);
                  }
                }
                
                // CRITICAL: First incoming message activates the phone number
                // This is what triggers PENDING → CONNECTED status change
                // console.log('[Business API Webhook] 🎉🎉🎉 INCOMING MESSAGE RECEIVED - This should activate phone number! 🎉🎉🎉');
                // console.log('[Business API Webhook]    Phone Number ID:', value.metadata?.phone_number_id);
                // console.log('[Business API Webhook]    Display Phone Number:', value.metadata?.display_phone_number);
                // console.log('[Business API Webhook]    Message Count:', value.messages.length);
                // console.log('[Business API Webhook]    ⚡ This is the trigger Meta needs to activate the account');
                // console.log('[Business API Webhook]    ⚡ Phone number status should change to CONNECTED on Meta within 1-5 minutes');
                // console.log('[Business API Webhook]    ⚡ Check Meta Dashboard → WhatsApp Manager → Phone Numbers');
                
                for (const message of value.messages) {
                  // Log template button clicks so we can confirm webhook receives them and fix is deployed
                  if (message.type === 'button') {
                    console.log('[Business API Webhook] Incoming message type "button" (template button click) – passing to processIncomingMessage:', { id: message.id, from: message.from });
                  }
                  try {
                    const result = await businessAPIManager.processIncomingMessage(message, {
                      phone_number_id: value.metadata?.phone_number_id,
                      display_phone_number: value.metadata?.display_phone_number,
                    }, value.contacts);
                    if (result?.updatedMessages) {
                      for (const item of result.updatedMessages) {
                        const { message: m, userId, eventType } = item as { message: any; userId: string; eventType?: 'new_message' | 'message_updated' };
                        const evt = eventType === 'message_updated' ? 'message_updated' : 'new_message';
                        broadcastToUser(userId, evt, evt === 'new_message' ? m : { chatId: m.chatId, messageId: m.id, message: m });
                      }
                    } else if (result?.updatedMessage && result?.userId) {
                      const evt = (result as any).eventType === 'message_updated' ? 'message_updated' : 'new_message';
                      broadcastToUser(result.userId, evt, evt === 'new_message' ? result.updatedMessage : { chatId: result.updatedMessage.chatId, messageId: result.updatedMessage.id, message: result.updatedMessage });
                    }
                    // console.log('[Business API Webhook] ✅ Message processed successfully:', message.id);
                    // console.log('[Business API Webhook] ✅ Phone number should now be activated and show as CONNECTED on Meta');
                  } catch (messageError: any) {
                    console.error('[Business API Webhook] ❌ Error processing message:', {
                      messageId: message.id,
                      from: message.from,
                      error: messageError.message,
                      stack: messageError.stack,
                    });
                  }
                }
              }
            } else if (change.field === 'smb_message_echoes') {
              // Message echoes: agent messages sent from WhatsApp Business app (coexistence)
              // Uses value.message_echoes with from=business, to=customer
              const value = change.value;
              if (value?.message_echoes && Array.isArray(value.message_echoes)) {
                console.log(`[Business API Webhook] 📤 Processing ${value.message_echoes.length} message echo(s) (smb_message_echoes)`);
                for (const message of value.message_echoes) {
                  try {
                    const result = await businessAPIManager.processIncomingMessage(message, {
                      phone_number_id: value.metadata?.phone_number_id,
                      display_phone_number: value.metadata?.display_phone_number,
                    }, value.contacts, { isSentByBusiness: true });
                    if (result?.updatedMessages) {
                      for (const item of result.updatedMessages) {
                        const { message: m, userId, eventType } = item as { message: any; userId: string; eventType?: 'new_message' | 'message_updated' };
                        const evt = eventType === 'message_updated' ? 'message_updated' : 'new_message';
                        broadcastToUser(userId, evt, evt === 'new_message' ? m : { chatId: m.chatId, messageId: m.id, message: m });
                      }
                    } else if (result?.updatedMessage && result?.userId) {
                      const evt = (result as any).eventType === 'message_updated' ? 'message_updated' : 'new_message';
                      broadcastToUser(result.userId, evt, evt === 'new_message' ? result.updatedMessage : { chatId: result.updatedMessage.chatId, messageId: result.updatedMessage.id, message: result.updatedMessage });
                    } else {
                      console.log(`[Business API Webhook] ✅ Processed message echo from app: ${message.id}`);
                    }
                  } catch (messageError: any) {
                    console.error('[Business API Webhook] ❌ Error processing message echo:', {
                      messageId: message.id,
                      to: message.to,
                      from: message.from,
                      error: messageError.message,
                    });
                  }
                }
              }
            } else if (change.field === 'account_update') {
              try {
                const { handleAccountUpdateWebhook } = await import(
                  "./integrations/oauth/whatsapp-embedded-signup-complete"
                );
                await handleAccountUpdateWebhook(change.value);
              } catch (accountUpdateErr: any) {
                console.error("[Business API Webhook] account_update error:", accountUpdateErr.message);
              }
              // Credit-line: PARTNER_ADDED / connect payloads may arrive on Meta webhook URL
              try {
                const { handleCreditLineConnectWebhook } = await import("./credit-line/webhook");
                await handleCreditLineConnectWebhook(
                  {
                    entry: [
                      {
                        id: entry?.id,
                        changes: [{ field: "account_update", value: change.value }],
                      },
                    ],
                    object: body.object || "whatsapp_business_account",
                  },
                  "meta"
                );
              } catch (clErr: any) {
                console.warn("[Business API Webhook] credit-line account_update bridge:", clErr?.message);
              }
            } else if (change.field === 'message_template_status_update') {
              // Handle template status updates (approved/rejected)
              const value = change.value;
              console.log('[Business API Webhook] Processing template status update:', {
                event: value.event,
                message_template_id: value.message_template_id,
                message_template_name: value.message_template_name,
                message_template_language: value.message_template_language,
                reason: value.reason,
              });
              
              // Find the template in database and update its status
              try {
                const templateId = value.message_template_id;
                const templateName = value.message_template_name;
                const event = value.event; // 'APPROVED' or 'REJECTED'
                
                if (isMongoEnabled()) {
                  const allTemplates = await MessageTemplateModel.find({
                    $or: [
                      { templateId: String(templateId) },
                      { name: templateName || "" },
                    ],
                  }).lean();

                  for (const template of allTemplates) {
                    const newStatus = event === 'APPROVED' ? 'APPROVED' : event === 'REJECTED' ? 'REJECTED' : 'PENDING';
                    await MessageTemplateModel.findByIdAndUpdate(template._id, {
                      $set: {
                        status: newStatus,
                        updatedAt: new Date(),
                        "metaData.lastStatusUpdate": new Date().toISOString(),
                        "metaData.rejectionReason": event === 'REJECTED' ? value.reason : undefined,
                      },
                    });
                    console.log(`[Business API Webhook] Updated template status: ${template.name} -> ${newStatus}`);
                    broadcastToUser(template.userId, 'template_status_update', {
                      templateId: template.id || template._id,
                      templateName: template.name,
                      status: newStatus,
                      rejectionReason: event === 'REJECTED' ? value.reason : undefined,
                    });
                  }
                } else {
                  const allTemplates = await db.select().from(messageTemplates)
                    .where(
                      or(
                        eq(messageTemplates.templateId, String(templateId)),
                        eq(messageTemplates.name, templateName || '')
                      )
                    );
                  
                  for (const template of allTemplates) {
                    const newStatus = event === 'APPROVED' ? 'APPROVED' : event === 'REJECTED' ? 'REJECTED' : 'PENDING';
                    
                    await db.update(messageTemplates)
                      .set({
                        status: newStatus,
                        updatedAt: new Date(),
                        metadata: {
                          ...(template.metadata as any || {}),
                          lastStatusUpdate: new Date().toISOString(),
                          rejectionReason: event === 'REJECTED' ? value.reason : undefined,
                        },
                      })
                      .where(eq(messageTemplates.id, template.id));
                    
                    console.log(`[Business API Webhook] Updated template status: ${template.name} -> ${newStatus}`);
                    broadcastToUser(template.userId, 'template_status_update', {
                      templateId: template.id,
                      templateName: template.name,
                      status: newStatus,
                      rejectionReason: event === 'REJECTED' ? value.reason : undefined,
                    });
                  }
                }
              } catch (templateError: any) {
                console.error('[Business API Webhook] Error updating template status:', templateError);
              }
            }
          }
        }
      }
      
      // Forward webhook event to other domains (non-blocking)
      // This allows multiple domains to receive the same webhook events
      if (!req.headers["x-webhook-forward"] && !req.headers["x-credit-line-forward"]) {
      webhookForwarder.forwardWebhookEvent(body, {
        'X-Hub-Signature-256': req.headers['x-hub-signature-256'] as string || '',
      }).then(result => {
        if (result.failed > 0) {
          console.warn(`[Business API Webhook] Forwarding completed with ${result.failed} failures:`, 
            result.results.filter(r => !r.success).map(r => ({ url: r.url, error: r.error })));
        }
      }).catch(err => {
        console.error('[Business API Webhook] Error forwarding webhook event:', err);
      });
      }
      
      res.status(200).json({ success: true });
    } catch (error: any) {
      console.error('[Business API Webhook] Error processing webhook:', error);
      console.error('[Business API Webhook] Error stack:', error.stack);
      res.status(500).json({ error: error.message });
    }
  });

  // Diagnostic endpoint to check webhook and session status
  app.get('/api/webhooks/whatsapp-business/debug', async (req: any, res) => {
    try {
      const allSessions = await storage.getAllSessions();
      const officialSessions = allSessions.filter(s => s.connectionType === 'official');
      
      const sessionInfo = officialSessions.map(s => ({
        sessionId: s.sessionId,
        userId: s.userId,
        organizationId: s.organizationId,
        status: s.status,
        apiPhoneNumberId: s.deviceInfo?.apiPhoneNumberId,
        displayPhoneNumber: s.deviceInfo?.displayPhoneNumber,
        phoneNumber: s.deviceInfo?.phoneNumber,
        verifiedName: s.deviceInfo?.verifiedName,
        wabaId: s.deviceInfo?.wabaId,
        businessAccountId: s.deviceInfo?.businessAccountId,
        createdAt: s.createdAt,
        lastActive: s.lastActive,
      }));

      res.json({
        success: true,
        totalSessions: allSessions.length,
        officialSessions: officialSessions.length,
        sessions: sessionInfo,
        message: 'Check server logs for webhook events. Send a test message and check logs for: [Business API Webhook] ========== WEBHOOK RECEIVED ==========',
      });
    } catch (error: any) {
      console.error('[Webhook Debug] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Message status update endpoint (for testing and future real WhatsApp client integration)
  app.patch('/api/messages/:messageId/status', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { messageId } = req.params;
      const { status } = req.body;

      if (!status || !['pending', 'sent', 'delivered', 'read'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status value' });
      }

      // Get the message to verify ownership via session (indexed — not full chat scan)
      const msg = await storage.getMessageByIdOrWhatsAppId(messageId, userId);
      if (!msg) {
        return res.status(404).json({ error: 'Message not found' });
      }

      const session = await storage.getSession(msg.sessionId);
      if (!session || session.userId !== userId) {
        return res.status(404).json({ error: 'Message not found' });
      }

      if (status === 'read' && session.connectionType === 'official' && msg.whatsappMessageId) {
        try {
          await businessAPIManager.markMessageAsRead(msg.sessionId, msg.whatsappMessageId);
          console.log(`[Message Status] Read receipt sent to WhatsApp for message ${msg.whatsappMessageId}`);
        } catch (error: any) {
          console.error(`[Message Status] Failed to send read receipt to WhatsApp:`, error.message);
        }
      }

      const updatedMessage = await storage.updateMessageStatus(messageId, status);

      if (status === 'read') {
        await storage.updateChat(msg.chatId, { unreadCount: 0 });
        broadcastToUser(userId, 'chat_updated', { chatId: msg.chatId, unreadCount: 0 });
      }

      await triggerWebhooks(userId, 'message.status_updated', {
        messageId,
        status,
        message: updatedMessage,
      });

      broadcastToUser(userId, 'message_status_update', { messageId, status });

      res.json({ success: true, message: updatedMessage });
    } catch (error: any) {
      console.error('Error updating message status:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Mark chat as read (reset unreadCount when user opens/views chat)
  app.patch('/api/chats/:chatId/read', ...withAuthAndRateLimit, ...withOrgContext, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId || req.query?.organizationId || null;
      const { chatId } = req.params;
      const chat = await storage.getChat(chatId);
      if (!chat) return res.status(404).json({ error: 'Chat not found' });
      const session = await storage.getSession(chat.sessionId);
      if (!(await sessionAllowedForUser(session, chat.sessionId, userId, organizationId))) return res.status(404).json({ error: 'Chat not found' });
      await storage.updateChat(chatId, { unreadCount: 0 });
      await storage.markInboundMessagesReadInChat(chatId);
      broadcastToUser(userId, 'chat_updated', { chatId, unreadCount: 0 });
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error marking chat as read:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /** Update chat display name and matching CRM contact (by phone) so Contacts stays in sync */
  app.patch(
    '/api/chats/:chatId/contact-name',
    ...withAuthAndRateLimit,
    ...withOrgContext,
    requirePermission('manage_contacts.edit'),
    async (req: any, res) => {
      try {
        const userId = getUserId(req);
        const organizationId = req.context?.organizationId || null;
        const { chatId } = req.params;
        const raw = typeof req.body?.contactName === 'string' ? req.body.contactName.trim() : '';
        if (!raw || raw.length > 200) {
          return res.status(400).json({ error: 'contactName must be 1–200 characters' });
        }

        const chat = await storage.getChat(chatId);
        if (!chat) return res.status(404).json({ error: 'Chat not found' });
        const session = await storage.getSession(chat.sessionId);
        if (!session) return res.status(404).json({ error: 'Chat not found' });
        if (!(await sessionAllowedForUser(session, chat.sessionId, userId, organizationId))) {
          return res.status(404).json({ error: 'Chat not found' });
        }

        const updatedChat = await storage.updateChat(chatId, { contactName: raw });
        if (!updatedChat) return res.status(500).json({ error: 'Could not update chat' });

        if (organizationId) {
          try {
            const managed = await storage.getManagedContactsWithFiltersByOrganization(organizationId, {});
            const key = normalizeContactPhoneDigitsForCrm(chat.contactNumber);
            let mc = managed.find((c: { phoneNumber: string }) => normalizeContactPhoneDigitsForCrm(c.phoneNumber) === key);
            if (!mc && key.length >= 10) {
              for (const m of managed) {
                const pk = normalizeContactPhoneDigitsForCrm(m.phoneNumber);
                if (pk.endsWith(key) || key.endsWith(pk)) {
                  mc = m;
                  break;
                }
              }
            }
            if (mc) {
              const upd = await storage.updateManagedContact(mc.id, mc.userId, organizationId, { name: raw });
              if (upd) {
                triggerWebhooks(userId, 'contact.updated', { contact: upd }).catch(() => {});
              }
            }
          } catch (e: any) {
            console.warn('[PATCH contact-name] CRM sync skipped:', e?.message);
          }
        }

        broadcastToUser(userId, 'chat_updated', { chatId, contactName: raw });
        res.json({ chat: updatedChat });
      } catch (error: any) {
        console.error('Error updating chat contact name:', error);
        res.status(500).json({ error: error.message });
      }
    }
  );

  // Data Retrieval Endpoints

  // Helper function to get chats for a session
  // Cache for tracking last sync time per session
  const chatSyncCache = new Map<string, { lastSync: number; isSyncing: boolean }>();
  const CHAT_SYNC_INTERVAL = 30000; // Sync every 30 seconds max

  /** WhatsApp Web caps unread at 9; use DB inbound unread as badge source of truth. */
  const attachUnreadCountsToChats = async (chats: Chat[]): Promise<Chat[]> => {
    if (!chats.length) return chats;
    const counts = await storage.countUnreadInboundByChatIds(chats.map((c) => c.id));
    return chats.map((c) => ({
      ...c,
      unreadCount: counts.get(c.id) ?? 0,
    }));
  };

  const getChatsForSession = async (sessionId: string, userId: string, skipSync = false, organizationId?: string) => {
    const session = await storage.getSession(sessionId);
    if (!session) throw new Error('Session not found');
    // Allow if session belongs to user, or (for shared inbox) session belongs to same organization
    if (session.userId !== userId) {
      if (organizationId) {
        const orgSessions = await storage.getSessionsByOrganization(organizationId);
        const sessionBelongsToOrg = orgSessions.some((s: any) => s.sessionId === sessionId);
        if (!sessionBelongsToOrg) throw new Error('Session not found');
      } else {
        throw new Error('Session not found');
      }
    }

    // Return stored chats immediately (fast response)
    const storedChats = await storage.getChatsBySession(sessionId);
    
    // Sync live chats in background if needed (don't block response)
    const cacheKey = `${sessionId}-${userId}`;
    const cache = chatSyncCache.get(cacheKey);
    const now = Date.now();
    const shouldSync = !skipSync && 
      session.status === 'connected' &&
      (!cache || (now - cache.lastSync > CHAT_SYNC_INTERVAL && !cache.isSyncing));

    if (shouldSync) {
      // Mark as syncing
      chatSyncCache.set(cacheKey, { lastSync: now, isSyncing: true });
      
      // Sync in background (don't await)
      (async () => {
        try {
          const manager = await getWhatsAppManager(sessionId);
          const isReady = manager.isClientReady(sessionId);
          
          if (isReady) {
            console.log(`[Chats] Background sync: Fetching live chats from WhatsApp for session ${sessionId}...`);
            const liveChats = await manager.getChats(sessionId);
            console.log(`[Chats] Background sync: Received ${liveChats.length} live chats from WhatsApp`);
            
            // Sync with storage (batch operations)
            const existingChats = await storage.getChatsBySession(sessionId);
            const existingContacts = await storage.getContactsBySession(sessionId);
            const normalizeForMatch = (n: string) => (n || '').replace(/[^\d]/g, '');
            
            // Process updates and creates in parallel
            await Promise.allSettled(
              liveChats.map(async (chat) => {
                try {
                  const chatNum = normalizeForMatch(chat.number);
                  const existing = existingChats.find(c => normalizeForMatch(c.contactNumber) === chatNum);

                  if (existing) {
                    const updates: Partial<{ lastMessage: string; lastMessageTime: Date; unreadCount: number }> = {};
                    if (chat.lastMessage !== undefined) updates.lastMessage = chat.lastMessage;
                    if (chat.lastMessageTime) updates.lastMessageTime = chat.lastMessageTime;
                    // Don't overwrite unreadCount when we've marked as read (0) - sync would restore stale count from WhatsApp
                    if (existing.unreadCount === 0) {
                      // Keep 0 - user viewed messages in our app
                    } else {
                      const dbUnread = await storage.countUnreadInboundMessages(existing.id);
                      if (dbUnread > 0) {
                        updates.unreadCount = dbUnread;
                      } else if ((chat.unreadCount ?? 0) > 0) {
                        updates.unreadCount = Math.max(existing.unreadCount || 0, chat.unreadCount || 0);
                      }
                    }
                    if (Object.keys(updates).length > 0) {
                      await storage.updateChat(existing.id, updates);
                    }
                  } else {
                    // Find or create contact (normalize for match)
                    let contact = existingContacts.find(c => normalizeForMatch(c.number) === chatNum);
                    
                    if (!contact) {
                      contact = await storage.createContact({
                        sessionId,
                        name: chat.name,
                        number: chat.number,
                        profilePic: chat.profilePic,
                        isGroup: chat.isGroup,
                      });
                    }
                    
                    // Create new chat
                    await storage.createChat({
                      sessionId,
                      contactId: contact.id,
                      contactName: chat.name,
                      contactNumber: chat.number,
                      contactProfilePic: chat.profilePic,
                      lastMessage: chat.lastMessage,
                      lastMessageTime: chat.lastMessageTime,
                      unreadCount: chat.unreadCount,
                      isGroup: chat.isGroup,
                    });
                  }
                } catch (error) {
                  console.error(`[Chats] Error syncing chat ${chat.number}:`, error);
                }
              })
            );
            
            console.log(`[Chats] Background sync: Completed for session ${sessionId}`);
          }
        } catch (error: any) {
          if (!error.message?.includes('not supported') && !error.message?.includes('Not implemented')) {
            console.error(`[Chats] Error in background sync for session ${sessionId}:`, error);
          }
        } finally {
          // Update cache
          chatSyncCache.set(cacheKey, { lastSync: Date.now(), isSyncing: false });
        }
      })();
    }

    // Enrich chats missing lastMessageTime in background (never block the response)
    const toEnrich = storedChats.filter(c => !c.lastMessageTime).slice(0, 15);
    if (toEnrich.length > 0) {
      void Promise.all(toEnrich.map(async (chat) => {
        try {
          const latest = await storage.getLatestMessageTimestamp(chat.id);
          if (latest) {
            await storage.updateChat(chat.id, { lastMessageTime: latest });
          }
        } catch { /* ignore */ }
      }));
    }

    return attachUnreadCountsToChats(storedChats);
  };

  // Route with sessionId as path parameter (for React Query)
  app.get('/api/chats/:sessionId', ...withAuthAndRateLimit, ...withOrgContext, requirePermission('inbox.view'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { sessionId } = req.params;
      const organizationId = req.context?.organizationId;
      const skipSync = req.query.skipSync === '1' || req.query.skipSync === 'true';

      const chats = await getChatsForSession(sessionId, userId, skipSync, organizationId);
      res.json(chats);
    } catch (error: any) {
      console.error('Error getting chats:', error);
      if (error.message === 'Session not found') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Route with sessionId as query parameter (for backward compatibility)
  app.get('/api/chats', ...withAuthAndRateLimit, ...withOrgContext, requirePermission('inbox.view'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { sessionId } = req.query;
      const organizationId = req.context?.organizationId;

      if (sessionId && typeof sessionId === 'string') {
        const skipSync = req.query.skipSync === '1' || req.query.skipSync === 'true';
        const chats = await getChatsForSession(sessionId, userId, skipSync, organizationId);
        res.json(chats);
      } else {
        // Get all chats across org's sessions (or user's sessions if no org) so team members see shared inbox
        const sessions = organizationId
          ? await storage.getSessionsByOrganization(organizationId)
          : await storage.getSessionsByUser(userId);
        const allChats: Chat[] = [];
        for (const session of sessions) {
          const chats = await storage.getChatsBySession(session.sessionId);
          allChats.push(...chats);
        }
        res.json(await attachUnreadCountsToChats(allChats));
      }
    } catch (error: any) {
      console.error('Error getting chats:', error);
      if (error.message === 'Session not found') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Panel inbox — DB-relative mediaUrl. Project API adds mediaUrlAbsolute (paths, proxy, or binary /api/project/v1/media/content for Graph ids) and mediaMetadataUrl (JSON /api/media).
  app.get('/api/messages/:chatId', ...withAuthAndRateLimit, ...withOrgContext, requirePermission('inbox.view'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { chatId } = req.params;
      const limitParam = req.query.limit;
      const limit = limitParam != null ? Math.min(500, Math.max(1, parseInt(String(limitParam), 10) || 200)) : 200;
      const beforeAtRaw = typeof req.query.beforeAt === 'string' ? req.query.beforeAt.trim() : '';
      const beforeIdRaw = typeof req.query.beforeId === 'string' ? req.query.beforeId.trim() : '';

      // Verify chat exists and user can access (own session or org shared inbox)
      const chat = await storage.getChat(chatId);
      if (!chat) {
        return res.status(404).json({ error: 'Chat not found' });
      }
      const session = await storage.getSession(chat.sessionId);
      if (!session) return res.status(404).json({ error: 'Chat not found' });
      const organizationId = req.context?.organizationId;
      if (session.userId !== userId) {
        if (organizationId) {
          const orgSessions = await storage.getSessionsByOrganization(organizationId);
          const canAccess = orgSessions.some((s: any) => s.sessionId === chat.sessionId);
          if (!canAccess) return res.status(404).json({ error: 'Chat not found' });
        } else {
          return res.status(404).json({ error: 'Chat not found' });
        }
      }

      let messages: Message[];
      if (beforeAtRaw && beforeIdRaw) {
        const cursorTs = new Date(beforeAtRaw);
        if (Number.isNaN(cursorTs.getTime())) {
          return res.status(400).json({ error: 'Invalid beforeAt (use ISO-8601)' });
        }
        messages = await storage.getMessagesByChatBeforeCursor(chatId, cursorTs, beforeIdRaw, limit);
      } else {
        messages = await storage.getMessagesByChat(chatId, limit);
      }
      // Hydrate mediaUrl for campaign messages that were stored without it (e.g. previously sent video/image templates)
      const needHydration = messages.some((m: any) => m.campaignId && !m.mediaUrl);
      if (needHydration) {
        const organizationId = req.context?.organizationId || (await storage.getOrganizationsByUser(userId))[0]?.id;
        if (organizationId) {
          const campaignIds = [...new Set(messages.filter((m: any) => m.campaignId && !m.mediaUrl).map((m: any) => m.campaignId))];
          const campaigns = await Promise.all(
            campaignIds.map((cid: string) => storage.getCampaign(cid, userId, organizationId))
          );
          const campaignMap = new Map(campaigns.filter(Boolean).map((c: any) => [c.id, c]));
          messages = messages.map((m: any) => {
            if (!m.campaignId || m.mediaUrl) return m;
            const campaign = campaignMap.get(m.campaignId);
            if (!campaign) return m;
            if (m.templateType === 'VIDEO' && campaign.headerVideoUrl) {
              return { ...m, mediaUrl: campaign.headerVideoUrl };
            }
            if (m.templateType === 'IMAGE' && campaign.headerImageUrl) {
              return { ...m, mediaUrl: campaign.headerImageUrl };
            }
            if (!m.templateType) {
              if (campaign.headerVideoUrl) return { ...m, mediaUrl: campaign.headerVideoUrl, templateType: 'VIDEO' };
              if (campaign.headerImageUrl) return { ...m, mediaUrl: campaign.headerImageUrl, templateType: 'IMAGE' };
            }
            return m;
          });
        }
      }
      // Don't show reaction-only or blank messages as separate bubbles (reactions appear on the target message)
      messages = messages.filter((m: any) => {
        const noBody = !m.body || !String(m.body).trim();
        if (m.type === 'reaction' && noBody) return false;
        if (m.type === 'text' && noBody && !m.mediaUrl) return false; // reaction artifacts sometimes stored as text with empty body
        return true;
      });
      res.json(messages);
    } catch (error: any) {
      console.error('Error getting messages:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // NOTE: The old /api/contacts and /api/groups routes that required sessionId have been removed.
  // Organization-scoped routes for contacts and groups are defined later in this file under
  // "Contacts API Routes" and "Groups API Routes" sections.

  // Subscription & Payment Endpoints

  // Public: White-label site config (no auth – for /white-label page)
  app.get('/api/public/white-label/config', async (req: any, res) => {
    try {
      let organizationId =
        (req.query.organizationId as string) ||
        process.env.WHITELABEL_ORG_ID ||
        process.env.VITE_WHITELABEL_ORG_ID;
      if (!organizationId) {
        // Use logged-in user's first organization when credentials are sent
        const userId = getUserId(req);
        if (userId) {
          const orgs = await storage.getOrganizationsByUser(userId);
          if (orgs.length > 0) organizationId = orgs[0].id;
        }
        // Fallback: use first organization in DB (single-tenant / dev so landing page shows saved content)
        if (!organizationId) {
          const allOrgs = await storage.getAllOrganizations();
          if (allOrgs.length > 0) organizationId = allOrgs[0].id;
        }
        if (!organizationId) {
          return res.status(400).json({ message: 'organizationId required for white-label config' });
        }
      }
      const config = await storage.getWebsiteBuilderConfigForOrg(organizationId);
      if (config.homepage) {
        config.homepage = applyHomepageHeroDefaults(config.homepage);
      }
      res.json({ organizationId, ...config });
    } catch (error: any) {
      console.error('Error getting white-label config:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get all available plans
  app.get('/api/plans', async (req, res) => {
    try {
      // Always ensure system Free exists — even when Trial/other plans already exist
      // (db:push does not seed this row)
      try {
        const { ensureSystemFreePlan } = await import("./utils/system-free-plan");
        await ensureSystemFreePlan();
      } catch (ensureErr: any) {
        console.error("[Plans] Failed to ensure system Free plan:", ensureErr?.message || ensureErr);
      }

      let plans = await storage.getActivePlans();
      
      // If still no plans exist, auto-seed starter/pro/enterprise (Free already ensured above)
      if (plans.length === 0) {
        console.log('[Plans] No plans found, auto-seeding...');
        try {
          const seedPlans = [
            {
              name: "starter",
              displayName: "Starter",
              description: "Great for small businesses and startups",
              priceMonthly: 900,
              priceQuarterly: 2400,
              priceYearly: 9000,
              features: {
                maxSessions: 3,
                maxMessagesPerMonth: 5000,
                maxApiCallsPerMinute: 60,
                maxWebhooks: 5,
                hasWhatsappBusinessApi: false,
                hasAnalytics: false,
                hasPrioritySupport: false,
                hasMessageHistorySync: true,
                messageHistorySyncPricePerMB: 10,
                maxMessageHistorySyncMB: 100,
              },
              isActive: true,
            },
            {
              name: "pro",
              displayName: "Pro",
              description: "Perfect for growing businesses with high volume messaging",
              priceMonthly: 2900,
              priceQuarterly: 7800,
              priceYearly: 30000,
              features: {
                maxSessions: 10,
                maxMessagesPerMonth: 50000,
                maxApiCallsPerMinute: 100,
                maxWebhooks: 20,
                hasWhatsappBusinessApi: true,
                hasAnalytics: true,
                hasPrioritySupport: false,
                hasMessageHistorySync: true,
                messageHistorySyncPricePerMB: 8,
                maxMessageHistorySyncMB: 500,
              },
              isActive: true,
            },
            {
              name: "enterprise",
              displayName: "Enterprise",
              description: "Unlimited messaging for large-scale operations",
              defaultBillingCycle: "yearly" as const,
              priceMonthly: 9900,
              priceQuarterly: 26700,
              priceYearly: 100000,
              features: {
                maxSessions: 999999,
                maxMessagesPerMonth: 999999999,
                maxApiCallsPerMinute: 200,
                maxWebhooks: 100,
                hasWhatsappBusinessApi: true,
                hasAnalytics: true,
                hasPrioritySupport: true,
                hasMessageHistorySync: true,
                messageHistorySyncPricePerMB: 5,
                maxMessageHistorySyncMB: 999999,
              },
              isActive: true,
            },
          ];

          for (const plan of seedPlans) {
            try {
              await storage.createPlan(plan as any);
              console.log(`[Plans] ✓ Created plan: ${plan.displayName}`);
            } catch (error: any) {
              if (error.code === '23505') {
                console.log(`[Plans] - Plan ${plan.displayName} already exists, skipping`);
              } else {
                console.error(`[Plans] ✗ Error creating plan ${plan.displayName}:`, error.message);
              }
            }
          }

          plans = await storage.getActivePlans();
        } catch (seedError: any) {
          console.error('[Plans] Error auto-seeding plans:', seedError);
        }
      }
      
      res.json(plans);
    } catch (error: any) {
      console.error('Error getting plans:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Lightweight expiry countdown for panel banner (any authenticated org member)
  app.get('/api/subscriptions/expiry-banner', ...withOrgContext, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      let billingUserId = userId;
      if (organizationId) {
        const org = await storage.getOrganization(organizationId);
        if (org?.ownerId) billingUserId = org.ownerId;
      } else {
        const orgs = await storage.getOrganizationsByUser(userId);
        if (orgs[0]?.ownerId) billingUserId = orgs[0].ownerId;
      }

      const billingUser = await storage.getUser(billingUserId);
      if (billingUser?.isSaaSOwner) {
        const { clearSystemFreeSubscriptionForSaasOwner } = await import("./utils/system-free-plan");
        await clearSystemFreeSubscriptionForSaasOwner(billingUserId);
        return res.json({ currentPeriodEnd: null, accessActive: true });
      }

      const subscription = await storage.getActiveSubscriptionByUser(billingUserId);
      if (!subscription) {
        return res.json({ currentPeriodEnd: null, accessActive: false });
      }

      const accessActive = isSubscriptionPeriodActiveByCalendarDay(subscription.currentPeriodEnd);
      return res.json({
        currentPeriodEnd: subscription.currentPeriodEnd,
        accessActive,
      });
    } catch (error: any) {
      console.error('Error getting subscription expiry banner:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get current subscription (org-scoped for team members: show owner's subscription when in org context)
  app.get('/api/subscriptions/current', ...withAuthAndRateLimit, ...withOrgContext, requirePermission('billing.view'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      let billingUserId = userId;
      if (organizationId) {
        const org = await storage.getOrganization(organizationId);
        billingUserId = org?.ownerId ?? userId;
      }

      // SaaS platform owners must not keep/show the default Free plan
      const billingUser = await storage.getUser(billingUserId);
      if (billingUser?.isSaaSOwner) {
        const { clearSystemFreeSubscriptionForSaasOwner } = await import("./utils/system-free-plan");
        await clearSystemFreeSubscriptionForSaasOwner(billingUserId);
      }

      const subscription = await storage.getSubscriptionByUser(billingUserId);

      if (!subscription || subscription.status === "cancelled") {
        return res.json({ subscription: null, plan: null, accessActive: !!billingUser?.isSaaSOwner, renewalRequired: false });
      }

      const plan = await storage.getPlan(subscription.planId);
      const accessActive =
        billingUser?.isSaaSOwner ||
        (subscription.status === "active" &&
          isSubscriptionPeriodActiveByCalendarDay(subscription.currentPeriodEnd));
      const renewalRequired =
        !billingUser?.isSaaSOwner &&
        subscription.status === "active" &&
        !isSubscriptionPeriodActiveByCalendarDay(subscription.currentPeriodEnd);
      res.json({
        subscription: {
          ...subscription,
          plan: plan || null,
        },
        accessActive,
        renewalRequired,
      });
    } catch (error: any) {
      console.error('Error getting subscription:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get usage stats (org-scoped for team members: show owner's usage when in org context)
  app.get('/api/usage/current', ...withAuthAndRateLimit, ...withOrgContext, requirePermission('billing.view'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      let usageUserId = userId;
      if (organizationId) {
        const org = await storage.getOrganization(organizationId);
        if (org?.ownerId) usageUserId = org.ownerId;
      }
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      const usage = await storage.getOrCreateUsageTracking(usageUserId, currentMonth);
      res.json(usage);
    } catch (error: any) {
      console.error('Error getting usage:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Pay SaaS plan from prepaid wallet (self_pay or credit_line)
  app.post('/api/payments/checkout-wallet', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { planId, billingCycle: billingCycleRaw } = req.body || {};
      if (!planId || !billingCycleRaw) {
        return res.status(400).json({ error: 'planId and billingCycle are required' });
      }

      let organizationId =
        req.context?.organizationId ||
        (req.headers["x-organization-id"] as string) ||
        null;
      if (!organizationId) {
        const orgs = await storage.getOrganizationsByUser(userId);
        organizationId = orgs[0]?.id || null;
      }
      if (!organizationId) {
        return res.status(400).json({ error: "Organization is required to pay from wallet" });
      }

      const { isWalletBillingEnabled } = await import("./wallet/config");
      if (!(await isWalletBillingEnabled())) {
        return res.status(400).json({
          error: "Wallet billing is not enabled on this panel. Reload wallet settings or use Razorpay/Stripe.",
        });
      }

      const payload = await performSaasWalletSubscriptionCheckout(
        userId,
        planId,
        billingCycleRaw,
        organizationId
      );
      res.json(payload);
    } catch (error: any) {
      console.error("Error wallet subscription checkout:", error);
      const code = error?.statusCode;
      if (code === 402) return res.status(402).json({ error: error.message, code: error.code || "WALLET_INSUFFICIENT" });
      if (code === 400 || code === 403 || code === 404) return res.status(code).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  // Create Razorpay subscription (recurring payment)
  app.post('/api/payments/create-razorpay-order', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      try {
        await resolveSaasSubscriptionRazorpay();
      } catch (setupErr: any) {
        return res.status(503).json({ error: setupErr?.message || "Razorpay subscription billing is not configured" });
      }

      const userId = getUserId(req);
      const { planId, billingCycle: billingCycleRaw } = req.body;

      if (!planId || !billingCycleRaw) {
        return res.status(400).json({ error: 'planId and billingCycle are required' });
      }

      const payload = await performSaasRazorpaySubscriptionCheckout(userId, planId, billingCycleRaw);
      res.json(payload);
    } catch (error: any) {
      console.error('Error creating Razorpay subscription:', error);
      const code = error?.statusCode;
      if (code === 404) return res.status(404).json({ error: error.message });
      if (code === 400) return res.status(400).json({ error: error.message });
      const { isRazorpayAuthenticationError, razorpayAuthFailureHelp } = await import(
        "./payment/saas-subscription-razorpay"
      );
      if (isRazorpayAuthenticationError(error?.message)) {
        return res.status(502).json({
          error: razorpayAuthFailureHelp(),
          code: "RAZORPAY_AUTH_FAILED",
          details: error.message,
        });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Verify Razorpay payment (for subscription first payment)
  app.post('/api/payments/verify-razorpay', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      try {
        await resolveSaasSubscriptionRazorpay();
      } catch (setupErr: any) {
        return res.status(503).json({ error: setupErr?.message || "Razorpay subscription billing is not configured" });
      }

      const userId = getUserId(req);
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, razorpay_subscription_id } = req.body;

      const { payment, invoiceDelivery } = await verifySaasRazorpaySubscriptionFirstPayment({
        userId,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        razorpay_subscription_id,
      });

      res.json({ success: true, payment, invoiceDelivery });
    } catch (error: any) {
      console.error('Error verifying Razorpay payment:', error);
      const code = error?.statusCode;
      if (code === 400 || code === 404) return res.status(code).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  // Razorpay webhook handler for recurring payments
  app.post('/api/webhooks/razorpay', async (req: any, res) => {
    try {
      const webhookSignature = req.headers['x-razorpay-signature'] as string;
      const rawBuf = req.rawBody as Buffer | undefined;
      const webhookBody = Buffer.isBuffer(rawBuf) ? rawBuf.toString("utf8") : JSON.stringify(req.body ?? {});

      let verified = false;
      try {
        const { webhookSecret } = await resolveSaasSubscriptionRazorpay();
        if (!webhookSecret) {
          console.error('[Razorpay Webhook] Add the webhook signing secret to the whitelabel admin Razorpay integration (Integrations).');
          return res.status(503).json({ error: 'Webhook signing secret not set on whitelabel Razorpay integration' });
        }
        verified = RazorpayClient.verifyWebhookHmac(webhookBody, webhookSignature, webhookSecret);
      } catch {
        return res.status(503).json({
          error:
            'Razorpay subscription webhooks require the SaaS owner Razorpay integration with “Organization subscription billing” and a webhook signing secret — platform .env keys are not used.',
        });
      }

      if (!verified) {
        console.error('[Razorpay Webhook] Invalid signature');
        return res.status(400).json({ error: 'Invalid webhook signature' });
      }

      const event = req.body.event;
      const payload = req.body.payload;

      console.log(`[Razorpay Webhook] Received event: ${event}`);

      // Handle different webhook events
      switch (event) {
        case 'subscription.charged':
        case 'payment.captured':
        case 'order.paid': {
          const payment = payload.payment?.entity || payload.payment;
          const subscription = payload.subscription?.entity || payload.subscription;
          const orderEntity = payload.order?.entity || payload.order;

          // Prepaid wallet reload (notes.purpose = wallet_reload)
          if (payment?.id) {
            try {
              const { handleWalletReloadWebhookPayment } = await import("./wallet/reload");
              const notes =
                payment.notes ||
                orderEntity?.notes ||
                {};
              const credited = await handleWalletReloadWebhookPayment({
                id: payment.id,
                order_id: payment.order_id || orderEntity?.id,
                amount: payment.amount,
                currency: payment.currency,
                status: payment.status || "captured",
                notes: typeof notes === "object" && notes ? notes : {},
              });
              if (credited) {
                console.log(`[Razorpay Webhook] Wallet reload credited for payment ${payment.id}`);
              }
            } catch (walletWhErr: any) {
              console.error("[Razorpay Webhook] Wallet reload handler error:", walletWhErr?.message || walletWhErr);
            }
          }

          if (payment && subscription) {
            // Find subscription by Razorpay subscription ID
            const allSubscriptions = isMongoEnabled()
              ? (await SubscriptionModel.find().lean()).map((s: any) => ({ ...s, id: s._id }))
              : await db.select().from(subscriptions);
            const dbSubscription = allSubscriptions.find(
              (sub) => sub.gatewaySubscriptionId === subscription.id
            );

            if (dbSubscription) {
              // Create payment record for recurring payment
              const newPayment = await storage.createPayment({
                subscriptionId: dbSubscription.id,
                userId: dbSubscription.userId,
                amount: payment.amount,
                currency: payment.currency || 'INR',
                status: payment.status === 'captured' ? 'completed' : 'pending',
                paymentGateway: 'razorpay',
                gatewayPaymentId: payment.id,
                gatewayOrderId: subscription.id,
                completedAt: payment.status === 'captured' ? new Date() : undefined,
                metadata: {
                  razorpaySubscriptionId: subscription.id,
                  paymentMethod: payment.method,
                  invoiceId: payment.invoice_id,
                },
              });

              if (newPayment.status === 'completed') {
                void import('./invoices/subscription-payment-invoice')
                  .then(({ deliverSubscriptionPaymentInvoice }) => deliverSubscriptionPaymentInvoice(newPayment.id))
                  .catch((err) => console.error('[Subscription invoice] Razorpay webhook delivery error:', err));
              }

              // Update subscription period if needed
              if (subscription.current_start && subscription.current_end) {
                await storage.updateSubscription(dbSubscription.id, {
                  currentPeriodStart: new Date(subscription.current_start * 1000),
                  currentPeriodEnd: new Date(subscription.current_end * 1000),
                  status: subscription.status === 'active' ? 'active' : dbSubscription.status,
                });
              }

              console.log(`[Razorpay Webhook] Processed recurring payment for subscription ${dbSubscription.id}`);
            }
          }
          break;
        }

        case 'subscription.activated': {
          const subscription = payload.subscription?.entity || payload.subscription;
          if (subscription) {
            const allSubscriptions = isMongoEnabled()
              ? (await SubscriptionModel.find().lean()).map((s: any) => ({ ...s, id: s._id }))
              : await db.select().from(subscriptions);
            const dbSubscription = allSubscriptions.find(
              (sub: any) => sub.gatewaySubscriptionId === subscription.id
            );

            if (dbSubscription) {
              await storage.updateSubscription(dbSubscription.id, {
                status: 'active',
              });
              console.log(`[Razorpay Webhook] Activated subscription ${dbSubscription.id}`);
            }
          }
          break;
        }

        case 'subscription.cancelled':
        case 'subscription.paused': {
          const subscription = payload.subscription?.entity || payload.subscription;
          if (subscription) {
            const allSubscriptions = isMongoEnabled()
              ? (await SubscriptionModel.find().lean()).map((s: any) => ({ ...s, id: s._id }))
              : await db.select().from(subscriptions);
            const dbSubscription = allSubscriptions.find(
              (sub: any) => sub.gatewaySubscriptionId === subscription.id
            );

            if (dbSubscription) {
              await storage.updateSubscription(dbSubscription.id, {
                status: 'cancelled',
                cancelAtPeriodEnd: true,
              });
              console.log(`[Razorpay Webhook] Cancelled subscription ${dbSubscription.id}`);
            }
          }
          break;
        }
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error('[Razorpay Webhook] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create Stripe checkout session
  app.post('/api/payments/checkout-stripe', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      try {
        await resolveSaasSubscriptionStripe();
      } catch (e: any) {
        return res.status(503).json({ error: e?.message || 'Stripe subscription billing is not configured' });
      }

      const userId = getUserId(req);
      const { planId, billingCycle } = req.body;

      if (!planId || !billingCycle) {
        return res.status(400).json({ error: 'planId and billingCycle are required' });
      }

      const baseUrl = process.env.REPLIT_DEV_DOMAIN
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : getPublicAppBaseUrl(req);

      const payload = await performSaasStripeSubscriptionCheckout(userId, planId, billingCycle, baseUrl, {
        successUrl: `${baseUrl.replace(/\/+$/, '')}/billing?payment=success`,
        cancelUrl: `${baseUrl.replace(/\/+$/, '')}/billing?payment=cancelled`,
      });
      res.json(payload);
    } catch (error: any) {
      console.error('Error creating Stripe checkout:', error);
      const code = error?.statusCode;
      if (code === 404) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  // Stripe webhook handler
  app.post('/api/webhooks/stripe', async (req: any, res) => {
    try {
      let stripeSubClient;
      try {
        const resolved = await resolveSaasSubscriptionStripe();
        stripeSubClient = resolved.client;
      } catch (e: any) {
        return res.status(503).json({ error: e?.message || 'Stripe subscription webhooks are not configured' });
      }

      const signature = req.headers['stripe-signature'];
      if (!signature || typeof signature !== 'string') {
        return res.status(400).json({ error: 'Missing signature' });
      }

      // Use raw body for signature verification
      const rawBody = req.rawBody as Buffer;
      if (!rawBody) {
        return res.status(400).json({ error: 'Missing raw body' });
      }

      let event;
      try {
        event = await stripeSubClient.constructWebhookEvent(rawBody, signature);
      } catch (e: any) {
        const msg = e?.message || String(e);
        const status = msg.includes('signing secret not configured') ? 503 : 400;
        return res.status(status).json({ error: msg });
      }

      // Handle different event types
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const { userId, planId } = session.metadata || {};

        if (userId) {
          // Find payment record
          const payments = await storage.getPaymentsByUser(userId);
          const payment = payments.find(p => p.gatewayOrderId === session.id);

          if (payment) {
            // Update payment status
            await storage.updatePayment(payment.id, {
              status: 'completed',
              gatewayPaymentId: session.payment_intent as string,
              completedAt: new Date(),
            });

            // Activate subscription
            await storage.updateSubscription(payment.subscriptionId, {
              status: 'active',
            });

            void import('./invoices/subscription-payment-invoice')
              .then(({ deliverSubscriptionPaymentInvoice }) => deliverSubscriptionPaymentInvoice(payment.id))
              .catch((err) => console.error('[Subscription invoice] Stripe delivery error:', err));
          }
        }
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error('Stripe webhook error:', error);
      res.status(400).json({ error: error.message });
    }
  });

  // Cancel subscription
  app.post('/api/subscriptions/cancel', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const subscription = await storage.getSubscriptionByUser(userId);

      if (!subscription) {
        return res.status(404).json({ error: 'No active subscription found' });
      }

      // Cancel Razorpay subscription if it exists (whitelabel admin keys)
      if (subscription.paymentGateway === 'razorpay' && subscription.gatewaySubscriptionId) {
        try {
          const { client: rz } = await resolveSaasSubscriptionRazorpay();
          await rz.cancelSubscription(subscription.gatewaySubscriptionId, true);
          console.log(`[Subscription] Cancelled Razorpay subscription ${subscription.gatewaySubscriptionId}`);
        } catch (error: any) {
          console.error('[Subscription] Error cancelling Razorpay subscription:', error);
          // Continue with database update even if Razorpay cancellation fails
        }
      }

      await storage.updateSubscription(subscription.id, {
        cancelAtPeriodEnd: true,
        status: 'cancelled',
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error cancelling subscription:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get payment history (org-scoped for team members: show owner's payments when in org context)
  app.get('/api/payments/history', ...withAuthAndRateLimit, ...withOrgContext, requirePermission('billing.view'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      let billingUserId = userId;
      if (organizationId) {
        const org = await storage.getOrganization(organizationId);
        if (org?.ownerId) billingUserId = org.ownerId;
      }
      let payments = await storage.getPaymentsByUser(billingUserId);

      // Sync payment history from Razorpay (whitelabel admin subscription keys)
      try {
        const { client: rz } = await resolveSaasSubscriptionRazorpay();
        const subscription = await storage.getSubscriptionByUser(billingUserId);

        if (subscription?.gatewaySubscriptionId && subscription.paymentGateway === 'razorpay') {
          const subscriptionPaymentsData = await rz.getSubscriptionPayments(subscription.gatewaySubscriptionId);
            const subscriptionPayments = subscriptionPaymentsData.items || [];

            for (const razorpayPayment of subscriptionPayments) {
              const existingPayment = payments.find(
                p => p.gatewayPaymentId === razorpayPayment.id
              );

              if (!existingPayment && razorpayPayment.status === 'captured') {
                try {
                  await storage.createPayment({
                    subscriptionId: subscription.id,
                    userId: billingUserId,
                    amount: razorpayPayment.amount,
                    currency: razorpayPayment.currency || 'INR',
                    status: razorpayPayment.status === 'captured' ? 'completed' : 'pending',
                    paymentGateway: 'razorpay',
                    gatewayPaymentId: razorpayPayment.id,
                    gatewayOrderId: subscription.gatewaySubscriptionId,
                    completedAt: razorpayPayment.captured_at ? new Date(razorpayPayment.captured_at * 1000) : undefined,
                    metadata: {
                      razorpaySubscriptionId: subscription.gatewaySubscriptionId,
                      paymentMethod: razorpayPayment.method,
                      invoiceId: razorpayPayment.invoice_id,
                      description: razorpayPayment.description,
                    },
                  });
                } catch (error: any) {
                  // Ignore duplicate errors
                  if (!error.message?.includes('duplicate') && !error.message?.includes('unique')) {
                    console.error('[Payment History] Error syncing payment:', error);
                  }
                }
              }
            }

            // Refresh payments from database
            payments = await storage.getPaymentsByUser(billingUserId);
          }
        } catch (error: any) {
          console.error('[Payment History] Error syncing from Razorpay:', error);
          // Continue with database payments even if Razorpay sync fails
        }

      // Sort by creation date (newest first)
      payments.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      res.json({ payments });
    } catch (error: any) {
      console.error('Error getting payment history:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // User Settings endpoints
  // Get user settings
  app.get('/api/settings', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const settings = await storage.getUserSettings(userId);
      
      if (!settings) {
        return res.json({
          razorpayCredentials: null,
          stripeCredentials: null,
          whatsappBusinessCredentials: null,
        });
      }
      
      res.json(settings);
    } catch (error: any) {
      console.error('Error getting user settings:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create or update user settings
  app.post('/api/settings', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { razorpayCredentials, stripeCredentials, whatsappBusinessCredentials } = req.body;

      // Check if WhatsApp Business credentials are being saved/updated
      const existingSettings = await storage.getUserSettings(userId);
      const isNewWhatsAppSetup = whatsappBusinessCredentials && 
        (!existingSettings?.whatsappBusinessCredentials?.phoneNumberId || 
         existingSettings.whatsappBusinessCredentials.phoneNumberId !== whatsappBusinessCredentials.phoneNumberId);

      const settings = await storage.createOrUpdateUserSettings({
        userId,
        razorpayCredentials: razorpayCredentials || null,
        stripeCredentials: stripeCredentials || null,
        whatsappBusinessCredentials: whatsappBusinessCredentials || null,
      });

      // Auto-sync templates if WhatsApp Business credentials are being set up
      if (isNewWhatsAppSetup && whatsappBusinessCredentials?.phoneNumberId && whatsappBusinessCredentials?.accessToken) {
        try {
          // Try to get WABA ID from existing session
          const sessions = await storage.getSessionsByUser(userId);
          const businessSession = sessions.find(
            (s) => s.connectionType === 'official' && 
            s.deviceInfo?.apiPhoneNumberId === whatsappBusinessCredentials.phoneNumberId
          );
          
          const wabaId = businessSession?.deviceInfo?.wabaId || whatsappBusinessCredentials.businessAccountId;
          
          if (!wabaId) {
            console.warn('[Settings] WABA ID not found, skipping template sync. Please add phone number through integrations page.');
          } else {
            const { businessAPIManager } = await import('./whatsapp/business-api-client');
            const templates = await businessAPIManager.fetchMessageTemplates(
              {
                phoneNumberId: whatsappBusinessCredentials.phoneNumberId,
                accessToken: whatsappBusinessCredentials.accessToken,
                businessAccountId: whatsappBusinessCredentials.businessAccountId,
              },
              wabaId // Use WABA ID, not businessAccountId
            );
            await storage.syncMessageTemplates(userId, templates, whatsappBusinessCredentials.phoneNumberId);
            console.log(`[Settings] Auto-synced ${templates.length} message templates for user ${userId}`);
          }
        } catch (syncError: any) {
          console.error('[Settings] Error auto-syncing templates:', syncError);
          // Don't fail the settings save if template sync fails
        }
      }

      res.json({ success: true, settings });
    } catch (error: any) {
      console.error('Error saving user settings:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get SMTP settings (password is masked)
  app.get('/api/settings/smtp', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const smtp = await storage.getSmtpSettings(userId);

      if (!smtp) {
        return res.json({
          smtpHost: "",
          smtpPort: 587,
          smtpSecure: false,
          smtpUser: "",
          smtpPass: "",
          fromEmail: "",
          fromName: "WhatsApp SaaS Platform",
          hasPassword: false,
        });
      }

      return res.json({
        smtpHost: smtp.smtpHost,
        smtpPort: smtp.smtpPort,
        smtpSecure: smtp.smtpSecure,
        smtpUser: smtp.smtpUser,
        smtpPass: "",
        fromEmail: smtp.fromEmail,
        fromName: smtp.fromName,
        hasPassword: Boolean(smtp.smtpPass),
      });
    } catch (error: any) {
      console.error("Error getting SMTP settings:", error);
      return res.status(500).json({ error: error.message || "Failed to fetch SMTP settings" });
    }
  });

  // Create or update SMTP settings
  app.post('/api/settings/smtp', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const {
        smtpHost,
        smtpPort,
        smtpSecure,
        smtpUser,
        smtpPass,
        fromEmail,
        fromName,
      } = req.body || {};

      if (!smtpHost || !smtpUser || !fromEmail) {
        return res.status(400).json({ error: "SMTP host, user, and from email are required" });
      }

      const existing = await storage.getSmtpSettings(userId);
      const finalPassword = smtpPass?.trim() ? smtpPass.trim() : (existing?.smtpPass || "");
      if (!finalPassword) {
        return res.status(400).json({ error: "SMTP password is required" });
      }

      const settings = await storage.createOrUpdateSmtpSettings({
        userId,
        smtpHost: String(smtpHost).trim(),
        smtpPort: Number(smtpPort) || 587,
        smtpSecure: smtpSecure === true || smtpSecure === "true",
        smtpUser: String(smtpUser).trim(),
        smtpPass: finalPassword,
        fromEmail: String(fromEmail).trim(),
        fromName: String(fromName || "WhatsApp SaaS Platform").trim(),
      });

      return res.json({
        success: true,
        settings: {
          ...settings,
          smtpPass: "",
          hasPassword: true,
        },
      });
    } catch (error: any) {
      console.error("Error saving SMTP settings:", error);
      return res.status(500).json({ error: error.message || "Failed to save SMTP settings" });
    }
  });

  // Sync message templates from Meta
  app.post('/api/settings/sync-templates', isAuthenticatedOrApiKey, rateLimitMiddleware, resolveOrganizationContext, requirePermission('manage_templates.sync'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      
      // First, try to get credentials from user settings
      let settings = await storage.getUserSettings(userId);
      let phoneNumberId: string | undefined;
      let accessToken: string | undefined;
      let businessAccountId: string | undefined;

      if (settings?.whatsappBusinessCredentials?.phoneNumberId && settings.whatsappBusinessCredentials.accessToken) {
        // Use credentials from user settings
        phoneNumberId = settings.whatsappBusinessCredentials.phoneNumberId;
        accessToken = settings.whatsappBusinessCredentials.accessToken;
        businessAccountId = settings.whatsappBusinessCredentials.businessAccountId;
      } else {
        // Try to get credentials from WhatsApp Business integration
        const integration = await storage.getIntegrationByName("whatsapp-business", userId, organizationId);
        
        if (!integration || integration.status !== "connected" || !integration.credentials) {
          return res.status(400).json({
            error: 'Missing credentials',
            message: 'WhatsApp Business API credentials not found. Please connect WhatsApp Business integration first.',
          });
        }

        const credentials = integration.credentials as any;
        accessToken = credentials.access_token;
        businessAccountId = credentials.business_account_id || credentials.businessAccountId;

        // Get phone number from the first available session
        const sessions = await storage.getSessionsByUser(userId);
        const businessSession = sessions.find(
          (s) => s.connectionType === 'official' && s.deviceInfo?.apiPhoneNumberId
        );

        if (!businessSession?.deviceInfo?.apiPhoneNumberId) {
          return res.status(400).json({
            error: 'No phone number found',
            message: 'No WhatsApp Business phone number has been added yet. Please add a phone number first.',
          });
        }

        phoneNumberId = businessSession.deviceInfo.apiPhoneNumberId;
        
        // Get WABA ID from session - templates must be fetched from WABA ID, not phone number ID
        const wabaId = businessSession.deviceInfo?.wabaId;
        
        if (!wabaId) {
          return res.status(400).json({
            error: 'WABA ID not found',
            message: 'WABA ID not found for the phone number. Please reconnect the phone number first.',
          });
        }
        
        // Use WABA ID for fetching templates
        businessAccountId = wabaId;
      }

      if (!phoneNumberId || !accessToken) {
        return res.status(400).json({
          error: 'Missing credentials',
          message: 'WhatsApp Business API credentials not found. Please configure them first.',
        });
      }

      // Templates must be fetched from WABA ID, not phone number ID or business account ID
      // If we don't have WABA ID, try to get it from the session
      if (!businessAccountId || businessAccountId === phoneNumberId) {
        const sessions = await storage.getSessionsByUser(userId);
        const businessSession = sessions.find(
          (s) => s.connectionType === 'official' && 
          (s.deviceInfo?.apiPhoneNumberId === phoneNumberId || s.deviceInfo?.wabaId)
        );
        
        if (businessSession?.deviceInfo?.wabaId) {
          businessAccountId = businessSession.deviceInfo.wabaId;
        } else {
          return res.status(400).json({
            error: 'WABA ID not found',
            message: 'WABA ID is required to fetch templates. Please add a phone number through the integrations page first.',
          });
        }
      }

      const { businessAPIManager } = await import('./whatsapp/business-api-client');
      const templates = await businessAPIManager.fetchMessageTemplates(
        {
          phoneNumberId,
          accessToken,
          businessAccountId,
        },
        businessAccountId // This should be the WABA ID
      );

      if (organizationId) {
        await storage.backfillMessageTemplatesOrganizationForPhone(userId, phoneNumberId, organizationId);
      }
      await storage.syncMessageTemplates(userId, templates, phoneNumberId, organizationId || undefined);

      res.json({
        success: true,
        message: `Successfully synced ${templates.length} templates`,
        count: templates.length,
      });
    } catch (error: any) {
      console.error('Error syncing templates:', error);
      res.status(500).json({
        error: 'Sync failed',
        message: error.message || 'Failed to sync templates',
      });
    }
  });

  // WhatsApp Flows/Forms Management
  app.get('/api/whatsapp-flows', ...withAuthAndRateLimit, ...withOrgContext, requirePermission('manage_templates.view', 'whatsapp_forms.view'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      const { businessAccountId } = req.query;

      if (!businessAccountId) {
        return res.json([]);
      }

      if (organizationId && isPaginatedListRequest(req.query)) {
        const pagination = listPaginationFromRequest(req);
        const search = parseListSearch(req.query);
        const result = await storage.listWhatsAppFlowsByOrganization(organizationId, {
          businessAccountId: businessAccountId as string,
          search,
          ...pagination,
        });
        return res.json(buildPaginatedResponse("flows", result));
      }

      const flows = organizationId
        ? await storage.getWhatsAppFlowsByOrganization(organizationId, businessAccountId as string)
        : await storage.getWhatsAppFlows(userId, organizationId, businessAccountId as string);
      res.json(flows);
    } catch (error: any) {
      console.error('Error fetching flows:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Flow responses (form submissions)
  app.get('/api/whatsapp-flows/:flowId/responses', ...withAuthAndRateLimit, ...withOrgContext, requirePermission('manage_templates.view', 'whatsapp_forms.view'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      const { flowId } = req.params;
      const { page = '1', limit = '10', phone } = req.query;

      const flow = organizationId
        ? await storage.getWhatsAppFlowByOrganization(flowId, organizationId)
        : await storage.getWhatsAppFlow(flowId, userId, organizationId);
      if (!flow) {
        return res.status(404).json({ error: 'Flow not found' });
      }

      const pageNum = Math.max(1, parseInt(String(page), 10));
      const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10)));

      if (!organizationId) {
        return res.json({ responses: [], total: 0, page: pageNum, limit: limitNum });
      }

      let { responses, total } = await storage.getWhatsAppFlowResponses(flowId, organizationId, {
        page: pageNum,
        limit: limitNum,
        phone: typeof phone === 'string' ? phone : undefined,
      });

      // Fallback: if nothing is linked to this flow yet, still show all org submissions
      // so "View responses" is never empty when inbox has form replies stored.
      if (total === 0) {
        const all = await storage.getAllWhatsAppFlowResponsesForOrganization(organizationId, {
          page: pageNum,
          limit: limitNum,
          phone: typeof phone === 'string' ? phone : undefined,
        });
        responses = all.responses;
        total = all.total;
      }

      res.json({
        responses: responses.map((r) => ({
          id: r.id,
          phone: r.phone,
          submittedAt: r.submittedAt,
          data: r.responseData,
          flowName: r.flowName,
          whatsappMessageId: r.whatsappMessageId,
          flowId: r.flowId,
        })),
        total,
        page: pageNum,
        limit: limitNum,
      });
    } catch (error: any) {
      console.error('Error fetching flow responses:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Lookup a single form response by WhatsApp message id (for chat "View response")
  app.get('/api/whatsapp-flow-responses/by-message/:whatsappMessageId', ...withAuthAndRateLimit, ...withOrgContext, requirePermission('manage_templates.view', 'whatsapp_forms.view', 'inbox.view'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      const whatsappMessageId = String(req.params.whatsappMessageId || '').trim();
      if (!organizationId || !whatsappMessageId) {
        return res.status(400).json({ error: 'organizationId and whatsappMessageId required' });
      }
      const row = await storage.getWhatsAppFlowResponseByWhatsAppMessageId(organizationId, whatsappMessageId);
      if (!row) return res.status(404).json({ error: 'Response not found' });
      res.json({
        id: row.id,
        phone: row.phone,
        submittedAt: row.submittedAt,
        data: row.responseData,
        flowId: row.flowId,
        flowName: row.flowName,
        whatsappMessageId: row.whatsappMessageId,
      });
    } catch (error: any) {
      console.error('Error fetching flow response by message:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Form responses for a phone (contact / chat sidebar)
  app.get('/api/whatsapp-flow-responses', ...withAuthAndRateLimit, ...withOrgContext, requirePermission('manage_templates.view', 'whatsapp_forms.view', 'inbox.view'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      const phone = typeof req.query.phone === 'string' ? req.query.phone : '';
      const pageNum = Math.max(1, parseInt(String(req.query.page || '1'), 10));
      const limitNum = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'), 10)));
      if (!organizationId || !phone.trim()) {
        return res.json({ responses: [], total: 0, page: pageNum, limit: limitNum });
      }
      const { responses, total } = await storage.getWhatsAppFlowResponsesByPhone(organizationId, phone, {
        page: pageNum,
        limit: limitNum,
      });
      res.json({
        responses: responses.map((r) => ({
          id: r.id,
          phone: r.phone,
          submittedAt: r.submittedAt,
          data: r.responseData,
          flowId: r.flowId,
          flowName: r.flowName,
          whatsappMessageId: r.whatsappMessageId,
        })),
        total,
        page: pageNum,
        limit: limitNum,
      });
    } catch (error: any) {
      console.error('Error fetching flow responses by phone:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/whatsapp-flows/:flowId', ...withAuthAndRateLimit, ...withOrgContext, requirePermission('manage_templates.view', 'whatsapp_forms.view'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      const { flowId } = req.params;

      const flow = organizationId
        ? await storage.getWhatsAppFlowByOrganization(flowId, organizationId)
        : await storage.getWhatsAppFlow(flowId, userId, organizationId);
      if (!flow) {
        return res.status(404).json({ error: 'Flow not found' });
      }
      res.json(flow);
    } catch (error: any) {
      console.error('Error fetching flow:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/whatsapp-flows', ...withAuthAndRateLimit, ...withOrgContext, requirePermission('manage_templates.create', 'whatsapp_forms.create'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      const { name, businessAccountId, phoneNumberId, screens, category } = req.body;

      if (!name || !businessAccountId || !screens || screens.length === 0) {
        return res.status(400).json({ error: 'Name, businessAccountId, and screens are required' });
      }

      // Match session by business account (dropdown can send businessAccountId or wabaId)
      const matchAccountForBody = (s: any, accountId: string) => {
        const di = s.deviceInfo || {};
        return (di.businessAccountId === accountId || di.wabaId === accountId) && s.connectionType === 'official';
      };

      // If phoneNumberId is provided, verify it belongs to the user/org and matches businessAccountId.
      let verifiedPhoneNumberId: string | undefined;
      if (phoneNumberId) {
        const sessions = organizationId
          ? await storage.getSessionsByOrganization(organizationId)
          : await storage.getSessionsByUser(userId);
        const phoneSession = sessions.find((s: any) =>
          s.deviceInfo?.apiPhoneNumberId === phoneNumberId && matchAccountForBody(s, businessAccountId)
        );
        if (phoneSession) {
          verifiedPhoneNumberId = phoneSession.deviceInfo?.apiPhoneNumberId;
        }
      }

      const flow = await storage.createWhatsAppFlow({
        userId,
        organizationId,
        name,
        businessAccountId,
        screens,
        status: 'DRAFT',
        validation: 'Valid',
        category: typeof category === 'string' && category.trim() ? category.trim() : 'other',
        metadata: (verifiedPhoneNumberId ? { phoneNumberId: verifiedPhoneNumberId } : undefined) as WhatsAppFlow['metadata'] | undefined,
      });

      // Create flow on Meta as DRAFT so it exists on Meta from the start
      try {
        const sessions = await storage.getSessionsByUser(userId);
        const businessSession = verifiedPhoneNumberId
          ? sessions.find((s: any) =>
              s.deviceInfo?.apiPhoneNumberId === verifiedPhoneNumberId && matchAccountForBody(s, businessAccountId)
            )
          : sessions.find((s: any) => matchAccountForBody(s, businessAccountId));
        if (businessSession) {
          const createSessionId = businessSession.sessionId;
          let creds = businessAPIManager.getCredentials(createSessionId);
          if (!creds?.accessToken) {
            const userSettings = await storage.getUserSettings(userId);
            if (userSettings?.whatsappBusinessCredentials?.accessToken) {
              await businessAPIManager.restoreSession(createSessionId, {
                phoneNumberId: businessSession.deviceInfo?.apiPhoneNumberId || '',
                accessToken: userSettings.whatsappBusinessCredentials.accessToken,
                businessAccountId,
              });
              creds = businessAPIManager.getCredentials(createSessionId);
            }
            if (!creds?.accessToken) {
              let integration = await storage.getIntegrationByName('whatsapp-business', userId, organizationId || undefined);
              if (!integration?.credentials && organizationId != null) {
                integration = await storage.getIntegrationByName('whatsapp-business', userId, undefined);
              }
              if (!integration?.credentials) {
                const allIntegrations = await storage.getIntegrationsByUser(userId, undefined);
                const waba = allIntegrations.find((i: any) => i.name === 'whatsapp-business' && i.status === 'connected' && i.credentials);
                if (waba) integration = waba;
              }
              if (integration?.status === 'connected' && integration.credentials) {
                const intCreds = integration.credentials as any;
                await businessAPIManager.restoreSession(createSessionId, {
                  phoneNumberId: businessSession.deviceInfo?.apiPhoneNumberId || '',
                  accessToken: intCreds.access_token,
                  businessAccountId: businessSession.deviceInfo?.wabaId || businessSession.deviceInfo?.businessAccountId || businessAccountId,
                });
                creds = businessAPIManager.getCredentials(createSessionId);
              }
            }
          }
          if (creds?.accessToken) {
            const { convertToWhatsAppFlowFormat } = await import('./utils/flow-converter');
            const flowJSON = convertToWhatsAppFlowFormat(screens);
            // Meta requires unique flow name per WABA: append id + timestamp so name is always unique
            const baseName = (name || 'Flow').trim().replace(/[^a-zA-Z0-9_\s]/g, '');
            const uniqueMetaName = `${baseName}_${flow.id.replace(/-/g, '').slice(0, 8)}_${Date.now()}`;
            const metaFlowId = await businessAPIManager.createFlow(
              businessAccountId,
              uniqueMetaName,
              flowJSON,
              creds.accessToken,
              false
            );
            await storage.updateWhatsAppFlow(flow.id, userId, organizationId, {
              flowId: metaFlowId,
              metadata: { ...flow.metadata, phoneNumberId: verifiedPhoneNumberId || businessSession.deviceInfo?.apiPhoneNumberId } as WhatsAppFlow['metadata'],
            });
            const updated = await storage.getWhatsAppFlow(flow.id, userId, organizationId);
            return res.json({
              success: true,
              flow: updated || flow,
              message: 'Flow created successfully and registered on Meta (DRAFT)',
            });
          }
        }
      } catch (metaErr: any) {
        console.error('Error creating flow on Meta (flow saved locally):', metaErr?.message || metaErr);
      }

      res.json({
        success: true,
        flow,
        message: 'Flow created successfully. Connect a WhatsApp Business number and Publish to make it live on Meta.',
      });
    } catch (error: any) {
      console.error('Error creating flow:', error);
      res.status(500).json({ error: error.message || 'Failed to create flow' });
    }
  });

  app.patch('/api/whatsapp-flows/:flowId', ...withAuthAndRateLimit, ...withOrgContext, requirePermission('manage_templates.edit', 'whatsapp_forms.edit'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      const { flowId } = req.params;
      const { name, screens, status } = req.body;

      const existingFlow = organizationId
        ? await storage.getWhatsAppFlowByOrganization(flowId, organizationId)
        : await storage.getWhatsAppFlow(flowId, userId, organizationId);
      if (!existingFlow) {
        return res.status(404).json({ error: 'Flow not found' });
      }

      const updateFlow = organizationId
        ? (data: any) => storage.updateWhatsAppFlowByOrganization(flowId, organizationId, data)
        : (data: any) => storage.updateWhatsAppFlow(flowId, userId, organizationId, data);
      const getFlow = organizationId
        ? () => storage.getWhatsAppFlowByOrganization(flowId, organizationId)
        : () => storage.getWhatsAppFlow(flowId, userId, organizationId);

      // Publish (first time or re-publish after edits) — always push current screens JSON to Meta.
      // Published Meta flows are immutable, so re-publish creates a new Meta flow and updates local flowId.
      if (status === 'PUBLISHED') {
        const { convertToWhatsAppFlowFormat } = await import('./utils/flow-converter');
        const flowJSON = convertToWhatsAppFlowFormat(screens || existingFlow.screens);
        const sessions = organizationId
          ? await storage.getSessionsByOrganization(organizationId)
          : await storage.getSessionsByUser(userId);
        const flowPhoneNumberId = existingFlow.metadata?.phoneNumberId;
        const matchAccount = (s: any) => {
          const di = s.deviceInfo || {};
          const accountMatch =
            di.businessAccountId === existingFlow.businessAccountId ||
            di.wabaId === existingFlow.businessAccountId;
          return accountMatch && s.connectionType === 'official';
        };
        let businessSession = flowPhoneNumberId
          ? sessions.find((s: any) =>
              s.deviceInfo?.apiPhoneNumberId === flowPhoneNumberId && matchAccount(s)
            )
          : sessions.find((s: any) => matchAccount(s));

        if (!businessSession) {
          return res.status(400).json({
            error: 'No connected WhatsApp Business number for this business account. Go to Integrations → WhatsApp Business API and connect a number for this account, then try Publish again.',
            code: 'NEED_CONNECTED_NUMBER',
          });
        }
        const sessionPhoneNumberId = businessSession.deviceInfo?.apiPhoneNumberId;
        if (!sessionPhoneNumberId) {
          return res.status(400).json({
            error: 'Connected session does not have a valid phone number ID. Please reconnect your number.',
          });
        }

        const sessionId = businessSession.sessionId;
        let creds = businessAPIManager.getCredentials(sessionId);
        if (!creds?.accessToken) {
          const userSettings = await storage.getUserSettings(userId);
          if (userSettings?.whatsappBusinessCredentials?.accessToken) {
            await businessAPIManager.restoreSession(sessionId, {
              phoneNumberId: businessSession.deviceInfo?.apiPhoneNumberId || '',
              accessToken: userSettings.whatsappBusinessCredentials.accessToken,
              businessAccountId: existingFlow.businessAccountId,
            });
            creds = businessAPIManager.getCredentials(sessionId);
          }
          if (!creds?.accessToken) {
            let integration = await storage.getIntegrationByName('whatsapp-business', userId, organizationId || undefined);
            if (!integration?.credentials && organizationId != null) {
              integration = await storage.getIntegrationByName('whatsapp-business', userId, undefined);
            }
            if (!integration?.credentials) {
              const allIntegrations = await storage.getIntegrationsByUser(userId, undefined);
              const waba = allIntegrations.find((i: any) => i.name === 'whatsapp-business' && i.status === 'connected' && i.credentials);
              if (waba) integration = waba;
            }
            if (integration?.status === 'connected' && integration.credentials) {
              const intCreds = integration.credentials as any;
              await businessAPIManager.restoreSession(sessionId, {
                phoneNumberId: sessionPhoneNumberId,
                accessToken: intCreds.access_token,
                businessAccountId: businessSession.deviceInfo?.wabaId || businessSession.deviceInfo?.businessAccountId || existingFlow.businessAccountId,
              });
              creds = businessAPIManager.getCredentials(sessionId);
            }
          }
          if (!creds?.accessToken) {
            return res.status(400).json({
              error: 'Unable to retrieve access token for WhatsApp Business API. Please reconnect your number.',
            });
          }
        }

        const hasMetaFlowId = existingFlow.flowId && !String(existingFlow.flowId).startsWith('flow_');
        const alreadyPublishedOnMeta = existingFlow.status === 'PUBLISHED' && hasMetaFlowId;
        let publishedMetaFlowId = hasMetaFlowId ? String(existingFlow.flowId) : '';
        let createdNewMetaFlow = false;

        try {
          if (alreadyPublishedOnMeta) {
            // Meta published flows cannot be edited — create + publish a new Meta flow with latest screens
            const baseName = (name || existingFlow.name || 'Flow').trim().replace(/[^a-zA-Z0-9_\s]/g, '');
            const uniqueMetaName = `${baseName}_${existingFlow.id.replace(/-/g, '').slice(0, 8)}_${Date.now()}`;
            publishedMetaFlowId = await businessAPIManager.createFlow(
              existingFlow.businessAccountId,
              uniqueMetaName,
              flowJSON,
              creds.accessToken,
              false
            );
            await businessAPIManager.updateFlowAssets(publishedMetaFlowId, flowJSON, creds.accessToken);
            await businessAPIManager.publishFlow(publishedMetaFlowId, creds.accessToken);
            createdNewMetaFlow = true;
          } else if (hasMetaFlowId) {
            // DRAFT on Meta: update assets then publish
            await businessAPIManager.updateFlowAssets(
              existingFlow.flowId as string,
              flowJSON,
              creds.accessToken
            );
            await businessAPIManager.publishFlow(existingFlow.flowId as string, creds.accessToken);
            publishedMetaFlowId = String(existingFlow.flowId);
          } else {
            // No Meta flow yet: create as DRAFT, update assets, then publish
            const baseName = (name || existingFlow.name || 'Flow').trim().replace(/[^a-zA-Z0-9_\s]/g, '');
            const uniqueMetaName = `${baseName}_${existingFlow.id.replace(/-/g, '').slice(0, 8)}_${Date.now()}`;
            publishedMetaFlowId = await businessAPIManager.createFlow(
              existingFlow.businessAccountId,
              uniqueMetaName,
              flowJSON,
              creds.accessToken,
              false
            );
            await businessAPIManager.updateFlowAssets(publishedMetaFlowId, flowJSON, creds.accessToken);
            await businessAPIManager.publishFlow(publishedMetaFlowId, creds.accessToken);
            createdNewMetaFlow = true;
          }

          const flow = await updateFlow({
            name,
            screens,
            status: 'PUBLISHED',
            validation: 'Valid',
            flowId: publishedMetaFlowId,
            metadata: {
              ...existingFlow.metadata,
              phoneNumberId: sessionPhoneNumberId,
              publishedAt: new Date().toISOString(),
              previousMetaFlowId: createdNewMetaFlow && hasMetaFlowId ? existingFlow.flowId : existingFlow.metadata?.previousMetaFlowId,
            } as WhatsAppFlow['metadata'],
          });

          return res.json({
            success: true,
            flow,
            metaFlowId: publishedMetaFlowId,
            createdNewMetaFlow,
            message: createdNewMetaFlow
              ? 'Flow published with latest screens. If you already have a template using this form, edit/recreate the template and select this form again so customers get the updated screens.'
              : 'Flow published successfully on Meta',
          });
        } catch (publishError: any) {
          console.error('Error publishing flow to Meta:', publishError);
          await updateFlow({
            name,
            screens,
            status: existingFlow.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
            validation: 'Invalid',
          });
          const flow = await getFlow();
          return res.status(500).json({
            error: `Failed to publish flow on Meta: ${publishError.message}`,
            flow: flow || undefined,
          });
        }
      } else {
        // Regular update (not publishing) — keep DRAFT Meta assets in sync when possible
        const nextScreens = screens ?? existingFlow.screens;
        const hasMetaFlowId = existingFlow.flowId && !String(existingFlow.flowId).startsWith('flow_');
        if (hasMetaFlowId && existingFlow.status !== 'PUBLISHED' && screens) {
          try {
            const { convertToWhatsAppFlowFormat } = await import('./utils/flow-converter');
            const flowJSON = convertToWhatsAppFlowFormat(nextScreens);
            const sessions = organizationId
              ? await storage.getSessionsByOrganization(organizationId)
              : await storage.getSessionsByUser(userId);
            const businessSession = sessions.find((s: any) => {
              const di = s.deviceInfo || {};
              return (
                s.connectionType === 'official' &&
                (di.businessAccountId === existingFlow.businessAccountId ||
                  di.wabaId === existingFlow.businessAccountId)
              );
            });
            if (businessSession) {
              let creds = businessAPIManager.getCredentials(businessSession.sessionId);
              if (!creds?.accessToken) {
                let integration = await storage.getIntegrationByName('whatsapp-business', userId, organizationId || undefined);
                if (integration?.status === 'connected' && integration.credentials) {
                  const intCreds = integration.credentials as any;
                  await businessAPIManager.restoreSession(businessSession.sessionId, {
                    phoneNumberId: businessSession.deviceInfo?.apiPhoneNumberId || '',
                    accessToken: intCreds.access_token,
                    businessAccountId: existingFlow.businessAccountId,
                  });
                  creds = businessAPIManager.getCredentials(businessSession.sessionId);
                }
              }
              if (creds?.accessToken) {
                await businessAPIManager.updateFlowAssets(
                  existingFlow.flowId as string,
                  flowJSON,
                  creds.accessToken
                );
              }
            }
          } catch (syncErr: any) {
            console.warn('[WhatsApp Flows] DRAFT asset sync skipped:', syncErr?.message || syncErr);
          }
        }

        const flow = await updateFlow({
          name,
          screens,
          status,
        });

        if (!flow) {
          return res.status(404).json({ error: 'Flow not found' });
        }

        res.json({
          success: true,
          flow,
          message: 'Flow updated successfully',
        });
      }
    } catch (error: any) {
      console.error('Error updating flow:', error);
      res.status(500).json({ error: error.message || 'Failed to update flow' });
    }
  });

  app.delete('/api/whatsapp-flows/:flowId', ...withAuthAndRateLimit, ...withOrgContext, requirePermission('manage_templates.delete', 'whatsapp_forms.delete'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      const { flowId } = req.params;

      if (organizationId) {
        await storage.deleteWhatsAppFlowByOrganization(flowId, organizationId);
      } else {
        await storage.deleteWhatsAppFlow(flowId, userId, organizationId);
      }
      res.json({ success: true, message: 'Flow deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting flow:', error);
      res.status(500).json({ error: error.message || 'Failed to delete flow' });
    }
  });

  // Get message templates filtered to the logged-in user's connected official numbers
  app.get('/api/templates', ...withOrgContext, requirePermission('manage_templates.view'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { organizationId } = req.context;
      const phoneNumberId = req.query.phoneNumberId as string | undefined;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });

      const userSessions = await storage.getSessionsByUser(userId);
      const connectedOfficialPhoneNumberIds = new Set(
        userSessions
          .filter(
            (s: any) =>
              s.connectionType === 'official' &&
              s.status === 'connected' &&
              // Support legacy sessions that may not have organizationId populated.
              (!s.organizationId || s.organizationId === organizationId)
          )
          .map((s: any) => s.deviceInfo?.apiPhoneNumberId)
          .filter((id: any) => typeof id === 'string' && id.length > 0)
      );

      // When a specific phone number is requested, only allow data for numbers connected by the logged-in user.
      if (phoneNumberId) {
        if (!connectedOfficialPhoneNumberIds.has(phoneNumberId)) {
          return res.json([]);
        }
        // Legacy fix: if templates for this user+phone were synced before org support, backfill org id.
        await storage.backfillMessageTemplatesOrganizationForPhone(userId, phoneNumberId, organizationId);
        const templates = await storage.getMessageTemplatesByOrganization(organizationId, phoneNumberId);
        if (isPaginatedListRequest(req.query)) {
          const pagination = listPaginationFromRequest(req);
          const statusFilter = typeof req.query.status === 'string' ? req.query.status.toLowerCase() : 'all';
          let filtered = templates;
          if (statusFilter !== 'all') {
            filtered = filtered.filter((t: any) => t.status?.toLowerCase() === statusFilter);
          }
          const search = parseListSearch(req.query);
          if (search?.trim()) {
            const q = search.trim().toLowerCase();
            filtered = filtered.filter(
              (t: any) =>
                t.name?.toLowerCase().includes(q) ||
                t.templateId?.toLowerCase().includes(q)
            );
          }
          // Newest templates first (createdAt desc)
          filtered = [...filtered].sort(
            (a: any, b: any) =>
              new Date(b.createdAt || b.syncedAt || 0).getTime() -
              new Date(a.createdAt || a.syncedAt || 0).getTime()
          );
          const page = paginateArray(filtered, pagination);
          return res.json(buildPaginatedResponse("templates", page));
        }
        return res.json(templates);
      }

      if (connectedOfficialPhoneNumberIds.size === 0) {
        return res.json([]);
      }

      const orgTemplates = await storage.getMessageTemplatesByOrganization(organizationId);
      const templates = orgTemplates.filter((template: any) => connectedOfficialPhoneNumberIds.has(template.phoneNumberId));
      if (isPaginatedListRequest(req.query)) {
        const pagination = listPaginationFromRequest(req);
        const statusFilter = typeof req.query.status === 'string' ? req.query.status.toLowerCase() : 'all';
        let filtered = templates;
        if (statusFilter !== 'all') {
          filtered = filtered.filter((t: any) => t.status?.toLowerCase() === statusFilter);
        }
        const search = parseListSearch(req.query);
        if (search?.trim()) {
          const q = search.trim().toLowerCase();
          filtered = filtered.filter(
            (t: any) =>
              t.name?.toLowerCase().includes(q) ||
              t.templateId?.toLowerCase().includes(q)
          );
        }
        // Newest templates first (createdAt desc)
        filtered = [...filtered].sort(
          (a: any, b: any) =>
            new Date(b.createdAt || b.syncedAt || 0).getTime() -
            new Date(a.createdAt || a.syncedAt || 0).getTime()
        );
        const page = paginateArray(filtered, pagination);
        return res.json(buildPaginatedResponse("templates", page));
      }
      res.json(templates);
    } catch (error: any) {
      console.error('Error fetching templates:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete message template (from Meta and local storage)
  app.delete('/api/templates/:id', ...withOrgContext, requirePermission('manage_templates.delete'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { organizationId } = req.context;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const template = await storage.getMessageTemplateByOrganization(req.params.id, organizationId);
      if (!template) return res.status(404).json({ error: 'Template not found' });

      let accessToken: string | undefined;
      let businessAccountId: string | undefined;
      const phoneNumberId = template.phoneNumberId;

      const sessions = organizationId
        ? await storage.getSessionsByOrganization(organizationId)
        : await storage.getSessionsByUser(userId);
      const officialSessions = sessions.filter((s: any) => s.connectionType === 'official' && s.status === 'connected');
      const credUserId = (s: any) => (s && s.userId) || userId;

      if (phoneNumberId) {
        const targetSession = officialSessions.find(
          (s: any) => String(s.deviceInfo?.apiPhoneNumberId || "") === String(phoneNumberId)
        );
        if (targetSession) businessAccountId = targetSession.deviceInfo?.wabaId || targetSession.deviceInfo?.businessAccountId;
        try {
          accessToken = await getWhatsappBusinessAccessTokenForOfficialSession(
            credUserId(targetSession),
            organizationId,
            targetSession,
            phoneNumberId
          );
        } catch (_) {}
        if (!accessToken) {
          const settings = await storage.getUserSettings(credUserId(targetSession));
          if (settings?.whatsappBusinessCredentials?.accessToken) {
            accessToken = settings.whatsappBusinessCredentials.accessToken;
            if (!businessAccountId) businessAccountId = settings.whatsappBusinessCredentials?.businessAccountId;
          }
        }
      } else if (officialSessions.length > 0) {
        const s = officialSessions[0];
        businessAccountId = s.deviceInfo?.wabaId || s.deviceInfo?.businessAccountId;
        try {
          accessToken = await getWhatsappBusinessAccessTokenForOfficialSession(
            credUserId(s),
            organizationId,
            s,
            s.deviceInfo?.apiPhoneNumberId
          );
        } catch (_) {}
        if (!accessToken) {
          const settings = await storage.getUserSettings(credUserId(s));
          if (settings?.whatsappBusinessCredentials?.accessToken) {
            accessToken = settings.whatsappBusinessCredentials.accessToken;
            if (!businessAccountId) businessAccountId = settings.whatsappBusinessCredentials.businessAccountId;
          }
        }
      }

      if (accessToken && businessAccountId) {
        try {
          const { businessAPIManager } = await import('./whatsapp/business-api-client');
          await businessAPIManager.deleteMessageTemplate(
            { accessToken, phoneNumberId: phoneNumberId || '', businessAccountId },
            businessAccountId,
            { name: template.name }
          );
        } catch (metaErr: any) {
          console.warn('[Delete Template] Meta delete failed, removing from local storage anyway:', metaErr.message);
        }
      }

      await storage.deleteMessageTemplateByOrganization(req.params.id, organizationId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting template:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create message template
  app.post('/api/templates', ...withOrgContext, requirePermission('manage_templates.create'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      const {
        name,
        category,
        language,
        headerText,
        bodyText,
        footerText,
        buttonType,
        buttonText,
        buttonUrl,
        buttonPhone,
        templateType,
        mediaUrl,
        phoneNumberId,
      } = req.body;

      // Auto-detect if user/org has a connected Meta Business API number
      let shouldCreateOfficial = templateType === 'official' || !!phoneNumberId;
      let accessToken: string | undefined;
      let businessAccountId: string | undefined;
      let phoneNumberIdForTemplate: string | undefined;

      const sessions = organizationId
        ? await storage.getSessionsByOrganization(organizationId)
        : await storage.getSessionsByUser(userId);
      const officialSessions = sessions.filter((s: any) => s.connectionType === 'official' && s.status === 'connected');
      const sessionUserId = (s: any) => (s && s.userId) || userId;
      
      // If phoneNumberId is provided, use it and force official template
      if (phoneNumberId) {
        shouldCreateOfficial = true;
        phoneNumberIdForTemplate = phoneNumberId;
        console.log(`[Create Template] phoneNumberId provided: ${phoneNumberId}, creating official template in Meta Business API`);
        
        // Find the session for this phone number
        const targetSession = officialSessions.find(
          (s: any) => String(s.deviceInfo?.apiPhoneNumberId || "") === String(phoneNumberId)
        );
        
        if (targetSession) {
          businessAccountId =
            targetSession.deviceInfo?.wabaId || targetSession.deviceInfo?.businessAccountId;
        }
        
        const credUserId = targetSession ? sessionUserId(targetSession) : userId;
        try {
          accessToken = await getWhatsappBusinessAccessTokenForOfficialSession(
            credUserId,
            organizationId,
            targetSession,
            phoneNumberIdForTemplate || phoneNumberId
          );
        } catch (integrationError) {
          console.log('Could not get credentials from integration, trying user settings...');
        }
        
        if (!accessToken) {
          const settings = await storage.getUserSettings(credUserId);
          if (settings?.whatsappBusinessCredentials?.phoneNumberId === phoneNumberId && 
              settings.whatsappBusinessCredentials.accessToken) {
            accessToken = settings.whatsappBusinessCredentials.accessToken;
            if (!businessAccountId) {
              businessAccountId = settings.whatsappBusinessCredentials.businessAccountId;
            }
          }
        }
      } else if (officialSessions.length > 0 && templateType !== 'unofficial') {
        // If user has official sessions but no phoneNumberId specified, default to creating official template
        shouldCreateOfficial = true;
        console.log(`[Create Template] User has ${officialSessions.length} official session(s), creating template in Meta Business API`);
        
        // Use the first available official session
        const targetSession = officialSessions[0];
        
        if (targetSession) {
          phoneNumberIdForTemplate = targetSession.deviceInfo?.apiPhoneNumberId;
          businessAccountId =
            targetSession.deviceInfo?.wabaId || targetSession.deviceInfo?.businessAccountId;
          
          const credUserId = sessionUserId(targetSession);
          try {
            accessToken = await getWhatsappBusinessAccessTokenForOfficialSession(
              credUserId,
              organizationId,
              targetSession,
              phoneNumberIdForTemplate
            );
          } catch (integrationError) {
            console.log('Could not get credentials from integration, trying user settings...');
          }
          
          if (!accessToken) {
            const settings = await storage.getUserSettings(credUserId);
            if (settings?.whatsappBusinessCredentials?.phoneNumberId === phoneNumberIdForTemplate && 
                settings.whatsappBusinessCredentials.accessToken) {
              accessToken = settings.whatsappBusinessCredentials.accessToken;
              if (!businessAccountId) {
                businessAccountId = settings.whatsappBusinessCredentials.businessAccountId;
              }
            }
          }
        }
      }

      if (shouldCreateOfficial) {
        const fallbackSessionForCreds =
          phoneNumberId
            ? officialSessions.find(
                (s: any) => String(s.deviceInfo?.apiPhoneNumberId || "") === String(phoneNumberId)
              )
            : officialSessions[0];
        const fallbackCredUserId = fallbackSessionForCreds
          ? sessionUserId(fallbackSessionForCreds)
          : officialSessions.length > 0
            ? sessionUserId(officialSessions[0])
            : userId;
        if (!accessToken || !businessAccountId) {
          try {
            accessToken = await getWhatsappBusinessAccessTokenForOfficialSession(
              fallbackCredUserId,
              organizationId,
              fallbackSessionForCreds || officialSessions[0],
              phoneNumberIdForTemplate || phoneNumberId
            );
            if (accessToken && phoneNumberId && !phoneNumberIdForTemplate) {
              const session = officialSessions.find(
                (s: any) => String(s.deviceInfo?.apiPhoneNumberId || "") === String(phoneNumberId)
              );
              if (session?.deviceInfo?.wabaId || session?.deviceInfo?.businessAccountId) {
                businessAccountId =
                  session.deviceInfo.wabaId || session.deviceInfo.businessAccountId;
                phoneNumberIdForTemplate = phoneNumberId;
              }
            }
          } catch (integrationError) {
            console.log('Could not get credentials from integration, trying user settings...');
          }

          if (!accessToken) {
            const settings = await storage.getUserSettings(fallbackCredUserId);
            if (settings?.whatsappBusinessCredentials?.phoneNumberId && settings.whatsappBusinessCredentials.accessToken) {
              accessToken = settings.whatsappBusinessCredentials.accessToken;
              if (!businessAccountId) {
                businessAccountId = settings.whatsappBusinessCredentials.businessAccountId;
              }
              if (!phoneNumberIdForTemplate) {
                phoneNumberIdForTemplate = settings.whatsappBusinessCredentials.phoneNumberId;
              }
            }
          }
        }

        if (!accessToken || !businessAccountId) {
          return res.status(400).json({
            error: 'Missing credentials',
            message: 'WhatsApp Business API credentials not found. Please connect your Meta Business API number first.',
          });
        }
        
        console.log(`[Create Template] Creating official template in Meta Business API for phoneNumberId: ${phoneNumberIdForTemplate}, businessAccountId: ${businessAccountId}`);

        const { businessAPIManager } = await import('./whatsapp/business-api-client');
        
        // Build template components according to Meta API format
        const components: any[] = [];
        const isMediaCardCarousel = req.body.interactiveAction === 'MEDIA_CARD_CAROUSEL';
        const isProductCardCarousel = req.body.interactiveAction === 'PRODUCT_CARD_CAROUSEL';
        const isAnyCarousel = isMediaCardCarousel || isProductCardCarousel;
        let templateCategory = String(category || 'UTILITY').toUpperCase();
        if (isAnyCarousel) templateCategory = 'MARKETING';
        
        // Handle header - can be TEXT, IMAGE, VIDEO, or DOCUMENT
        if (!isAnyCarousel && headerText) {
          components.push({
            type: 'HEADER',
            format: 'TEXT',
            text: headerText,
          });
        } else if (!isAnyCarousel && mediaUrl) {
          // Determine format based on templateType, mediaUrl extension, or MIME type (for base64 data URLs)
          let format: 'IMAGE' | 'VIDEO' | 'DOCUMENT' = 'IMAGE';
          
          // Check templateType first (most reliable)
          if (req.body.templateType === 'VIDEO') {
            format = 'VIDEO';
          } else if (req.body.templateType === 'DOCUMENT') {
            format = 'DOCUMENT';
          } else if (req.body.templateType === 'IMAGE') {
            format = 'IMAGE';
          } else if (mediaUrl.startsWith('data:')) {
            // For base64 data URLs, check MIME type
            const mimeMatch = mediaUrl.match(/^data:([^;]+);/);
            if (mimeMatch) {
              const mimeType = mimeMatch[1];
              if (mimeType.startsWith('video/')) {
                format = 'VIDEO';
              } else if (mimeType.startsWith('application/') || mimeType.includes('pdf') || mimeType.includes('document')) {
                format = 'DOCUMENT';
              } else {
                format = 'IMAGE'; // Default for image/* MIME types
              }
            }
          } else if (mediaUrl.match(/\.(mp4|mov|avi|webm)$/i)) {
            format = 'VIDEO';
          } else if (mediaUrl.match(/\.(pdf|doc|docx|txt)$/i)) {
            format = 'DOCUMENT';
          }
          
          // For media headers, Meta requires a media handle (uploaded media ID)
          // Check if we have a media ID (from upload) or need to upload from URL
          let headerImageId = req.body.headerImageId;
          let headerVideoId = req.body.headerVideoId;
          let headerDocumentId = req.body.headerDocumentId;
          
          // If we have a mediaUrl but no media ID, we need to upload it to Meta first
          // This applies to IMAGE, VIDEO, and DOCUMENT formats
          const needsUpload = 
            (format === 'IMAGE' && !headerImageId && mediaUrl) ||
            (format === 'VIDEO' && !headerVideoId && mediaUrl) ||
            (format === 'DOCUMENT' && !headerDocumentId && mediaUrl);
          
          if (needsUpload) {
            try {
              let mediaBuffer: Buffer;
              let fileName: string;
              
              // Handle blob URLs (blob:http://...)
              if (mediaUrl.startsWith('blob:')) {
                console.log(`[Create Template] Blob URL detected, this should be handled on the frontend first`);
                throw new Error('Blob URLs must be converted to base64 data URLs or HTTP URLs on the frontend before submission');
              }
              // Handle base64 data URLs (data:image/jpeg;base64,... or data:video/mp4;base64,...)
              let mimeType: string;
              if (mediaUrl.startsWith('data:')) {
                console.log(`[Create Template] Processing base64 data URL for ${format}`);
                const base64Match = mediaUrl.match(/^data:([^;]+);base64,(.+)$/);
                if (!base64Match) {
                  throw new Error('Invalid base64 data URL format');
                }
                
                mimeType = base64Match[1];
                const base64Data = base64Match[2];
                
                // Convert base64 to buffer
                mediaBuffer = Buffer.from(base64Data, 'base64');
                
                // Determine file extension from MIME type
                const mimeToExt: Record<string, string> = {
                  // Images
                  'image/jpeg': 'jpg',
                  'image/jpg': 'jpg',
                  'image/png': 'png',
                  'image/gif': 'gif',
                  'image/webp': 'webp',
                  // Videos
                  'video/mp4': 'mp4',
                  'video/mpeg': 'mpg',
                  'video/quicktime': 'mov',
                  'video/x-msvideo': 'avi',
                  'video/webm': 'webm',
                  // Documents
                  'application/pdf': 'pdf',
                  'application/msword': 'doc',
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
                  'text/plain': 'txt',
                };
                const ext = mimeToExt[mimeType] || (format === 'IMAGE' ? 'jpg' : format === 'VIDEO' ? 'mp4' : 'pdf');
                const defaultName = format === 'IMAGE' ? 'image' : format === 'VIDEO' ? 'video' : 'document';
                fileName = `${defaultName}.${ext}`;
                
                console.log(`[Create Template] Decoded base64 ${format.toLowerCase()}, size: ${mediaBuffer.length} bytes, type: ${mimeType}`);
              } else if (mediaUrl.startsWith('http')) {
                // Handle HTTP URLs
                console.log(`[Create Template] Uploading ${format.toLowerCase()} from URL to Meta: ${mediaUrl}`);
                const mediaResponse = await fetch(mediaUrl);
                if (mediaResponse.ok) {
                  mediaBuffer = Buffer.from(await mediaResponse.arrayBuffer());
                  let rawFileName = mediaUrl.split('/').pop() || (format === 'IMAGE' ? 'image.jpg' : format === 'VIDEO' ? 'video.mp4' : 'document.pdf');
                  
                  // Sanitize filename - remove special characters that might cause issues with Meta API
                  // Keep only alphanumeric, dots, hyphens, and underscores
                  const sanitized = rawFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
                  fileName = sanitized || (format === 'IMAGE' ? 'image.jpg' : format === 'VIDEO' ? 'video.mp4' : 'document.pdf');
                  
                  // Try to get MIME type from response headers
                  const contentType = mediaResponse.headers.get('content-type');
                  if (contentType) {
                    mimeType = contentType.split(';')[0].trim();
                  } else {
                    // Determine from file extension
                    const ext = fileName.toLowerCase().split('.').pop();
                    if (ext === 'png') mimeType = 'image/png';
                    else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
                    else if (ext === 'mp4') mimeType = 'video/mp4';
                    else if (ext === 'pdf') mimeType = 'application/pdf';
                    else {
                      // Fall back to format-based MIME type
                      const mimeTypeMap: Record<string, string> = {
                        'IMAGE': 'image/jpeg',
                        'VIDEO': 'video/mp4',
                        'DOCUMENT': 'application/pdf',
                      };
                      mimeType = mimeTypeMap[format] || 'image/jpeg';
                    }
                  }
                  
                  console.log(`[Create Template] Sanitized filename: ${rawFileName} -> ${fileName}, MIME type: ${mimeType}`);
                } else {
                  throw new Error(`Failed to fetch ${format.toLowerCase()} from URL: ${mediaResponse.statusText}`);
                }
              } else {
                throw new Error('Invalid media URL format. Must be HTTP URL or base64 data URL.');
              }
              
              // Upload to Meta using Resumable Upload API to get file handle
              // This follows Meta's recommended approach for marketing template media headers
              const metaAppId = process.env.FACEBOOK_APP_ID;
              if (!metaAppId) {
                throw new Error('FACEBOOK_APP_ID environment variable is required for resumable upload. Please set it in your environment variables.');
              }

              // Validate and normalize MIME type to supported types
              const validMimeTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'video/mp4'];
              if (!validMimeTypes.includes(mimeType)) {
                // Map to closest valid type
                if (mimeType.startsWith('image/')) {
                  mimeType = 'image/jpeg';
                } else if (mimeType.startsWith('video/')) {
                  mimeType = 'video/mp4';
                } else {
                  mimeType = 'application/pdf';
                }
                console.warn(`[Create Template] MIME type normalized to supported type: ${mimeType}`);
              }

              // Use Resumable Upload API for marketing template media
              console.log(`[Create Template] Using Resumable Upload API for ${format} header`);
              const assetHandle = await businessAPIManager.uploadFileResumable(
                {
                  phoneNumberId: phoneNumberIdForTemplate || '',
                  accessToken: accessToken,
                  businessAccountId: businessAccountId,
                },
                metaAppId,
                mediaBuffer,
                fileName,
                mimeType
              );
              
              if (!assetHandle || typeof assetHandle !== 'string' || assetHandle.trim() === '') {
                throw new Error(`Invalid asset handle received from upload: ${JSON.stringify(assetHandle)}`);
              }
              
              console.log(`[Create Template] Received asset handle for ${format}: "${assetHandle}"`);
              
              // Set the appropriate asset handle based on format
              if (format === 'IMAGE') {
                headerImageId = assetHandle;
                console.log(`[Create Template] Successfully uploaded image, got asset handle: ${headerImageId}`);
              } else if (format === 'VIDEO') {
                headerVideoId = assetHandle;
                console.log(`[Create Template] Successfully uploaded video, got asset handle: ${headerVideoId}`);
              } else if (format === 'DOCUMENT') {
                headerDocumentId = assetHandle;
                console.log(`[Create Template] Successfully uploaded document, got asset handle: ${headerDocumentId}`);
              }
            } catch (uploadError: any) {
              console.error(`[Create Template] Failed to upload ${format.toLowerCase()}:`, uploadError);
              return res.status(400).json({
                error: `${format} upload failed`,
                message: `Failed to upload ${format.toLowerCase()} to Meta: ${uploadError.message}. Please upload the media first or provide a valid URL or base64 data URL.`,
              });
            }
          }
          
          const headerComponent: any = {
            type: 'HEADER',
            format: format,
          };
          
          // Meta requires examples for media headers
          // Official format: header_handle array with media ID
          // Alternative format (some API versions): example as URL string
          // We use the official header_handle format
          if (format === 'IMAGE' && headerImageId) {
            // Ensure media ID is a clean string without any whitespace
            const cleanMediaId = String(headerImageId).trim();
            headerComponent.example = {
              header_handle: [cleanMediaId]
            };
            console.log(`[Create Template] Setting IMAGE header with handle: "${cleanMediaId}" (length: ${cleanMediaId.length})`);
          } else if (format === 'VIDEO' && headerVideoId) {
            const cleanMediaId = String(headerVideoId).trim();
            headerComponent.example = {
              header_handle: [cleanMediaId]
            };
            console.log(`[Create Template] Setting VIDEO header with handle: "${cleanMediaId}" (length: ${cleanMediaId.length})`);
          } else if (format === 'DOCUMENT' && headerDocumentId) {
            const cleanMediaId = String(headerDocumentId).trim();
            headerComponent.example = {
              header_handle: [cleanMediaId]
            };
            console.log(`[Create Template] Setting DOCUMENT header with handle: "${cleanMediaId}" (length: ${cleanMediaId.length})`);
          } else {
            // If we still don't have a media ID, return an error
            return res.status(400).json({
              error: 'Missing media ID',
              message: `For ${format} header templates, you must upload the media to Meta first and provide the media ID, or provide a valid URL that can be uploaded.`,
            });
          }
          
          components.push(headerComponent);
        }

        const isAuthenticationTemplate = templateCategory === 'AUTHENTICATION';
        if (isAuthenticationTemplate) {
          // Meta AUTHENTICATION templates must not send BODY.text; they use auth-specific fields.
          components.push({
            type: 'BODY',
            ...(req.body.addSecurityRecommendation !== false
              ? { add_security_recommendation: true }
              : {}),
          });
        } else {
          // Body component - required, with example values for variables
          const bodyComponent: any = {
            type: 'BODY',
            text: bodyText,
          };
          
          // Extract positional variables {{1}} … {{n}} (optional spaces: {{ 1 }} also works) and build Meta body_text examples
          const positionalVarRegex = /\{\{\s*(\d+)\s*\}\}/g;
          const variableNumbers = [
            ...new Set(Array.from(bodyText.matchAll(positionalVarRegex), (m) => parseInt(m[1], 10))),
          ].sort((a, b) => a - b);
          if (variableNumbers.length > 0) {
            bodyComponent.example = {
              body_text: [
                variableNumbers.map((num) => {
                  const sampleValue = req.body.sampleValues?.[num.toString()] || `Value${num}`;
                  return sampleValue;
                }),
              ],
            };
          }
          
          components.push(bodyComponent);
        }

        // Footer component - optional
        if (!isAnyCarousel && isAuthenticationTemplate && req.body.codeExpirationMinutes) {
          components.push({
            type: 'FOOTER',
            code_expiration_minutes: Number(req.body.codeExpirationMinutes),
          });
        } else if (!isAnyCarousel && footerText) {
          components.push({
            type: 'FOOTER',
            text: footerText,
          });
        }

        if (!isAnyCarousel) {
        const buttons: any[] = req.body.interactiveAction
          ? await buildTemplateButtonsFromBody(req.body, { organizationId, userId })
          : [];
        
        // Fall back to legacy button format if no new format buttons
        if (buttons.length === 0 && buttonType && buttonType !== 'NONE' && buttonText) {
          // Handle single button
          if (buttonType === 'QUICK_REPLY') {
            buttons.push({
              type: 'QUICK_REPLY',
              text: buttonText,
            });
          } else if (buttonType === 'URL' && buttonUrl) {
            buttons.push({
              type: 'URL',
              text: buttonText,
              url: buttonUrl,
              example: [buttonUrl], // Meta requires example URL
            });
          } else if (buttonType === 'PHONE_NUMBER' && buttonPhone) {
            buttons.push({
              type: 'PHONE_NUMBER',
              text: buttonText,
              phone_number: buttonPhone,
            });
          }
        }
        
        // For authentication templates, enforce Meta OTP button structure.
        if (isAuthenticationTemplate) {
          buttons.length = 0;
          buttons.push({
            type: 'OTP',
            otp_type: 'COPY_CODE',
            text: req.body.authButtonText || 'Copy Code',
          });
        }
        
        // Add buttons component if we have any buttons
        if (buttons.length > 0) {
          components.push({
            type: 'BUTTONS',
            buttons: buttons,
          });
        }
        }

        if (isProductCardCarousel) {
          const productCardsIn = Array.isArray(req.body.productCards) ? req.body.productCards : [];
          if (productCardsIn.length < 2 || productCardsIn.length > 10) {
            return res.status(400).json({
              error: 'Invalid carousel',
              message: 'Product card carousel requires between 2 and 10 cards at template creation (send up to 10 products per message).',
            });
          }
          const firstBtnType = productCardsIn[0]?.buttonType === 'url' ? 'url' : 'spm';
          for (let ci = 0; ci < productCardsIn.length; ci++) {
            const bt = productCardsIn[ci]?.buttonType === 'url' ? 'url' : 'spm';
            if (bt !== firstBtnType) {
              return res.status(400).json({
                error: 'Invalid carousel',
                message: 'All product cards must use the same button type (View or URL).',
              });
            }
          }
          const carouselCardsPayload: Array<{ components: unknown[] }> = [];
          for (const card of productCardsIn) {
            const buttonLabel = String(card.buttonLabel || 'View').trim().slice(0, 25) || 'View';
            const cardComps: unknown[] = [{ type: 'HEADER', format: 'product' }];
            if (firstBtnType === 'url') {
              const url = String(card.url || 'https://example.com/{{1}}').trim();
              cardComps.push({
                type: 'BUTTONS',
                buttons: [
                  {
                    type: 'URL',
                    text: buttonLabel,
                    url,
                    example: [String(card.urlExample || 'product')],
                  },
                ],
              });
            } else {
              cardComps.push({
                type: 'BUTTONS',
                buttons: [{ type: 'spm', text: buttonLabel }],
              });
            }
            carouselCardsPayload.push({ components: cardComps });
          }
          components.push({ type: 'CAROUSEL', cards: carouselCardsPayload });
        }

        if (isMediaCardCarousel) {
          const metaAppIdCarousel = process.env.FACEBOOK_APP_ID;
          if (!metaAppIdCarousel) {
            return res.status(400).json({
              error: 'Missing FACEBOOK_APP_ID',
              message: 'FACEBOOK_APP_ID is required to upload media for marketing carousel templates.',
            });
          }
          const mediaCardsIn = Array.isArray(req.body.mediaCards) ? req.body.mediaCards : [];
          if (mediaCardsIn.length < 2 || mediaCardsIn.length > 10) {
            return res.status(400).json({
              error: 'Invalid carousel',
              message: 'Media card carousel requires between 2 and 10 cards.',
            });
          }
          const sig0 = carouselButtonTypeSignature(mediaCardsIn[0].buttons);
          for (let ci = 1; ci < mediaCardsIn.length; ci++) {
            if (carouselButtonTypeSignature(mediaCardsIn[ci].buttons) !== sig0) {
              return res.status(400).json({
                error: 'Invalid carousel',
                message: 'All carousel cards must use the same button types in the same order.',
              });
            }
          }
          try {
            metaCarouselTemplateButtonsFromUi(mediaCardsIn[0].buttons || []);
          } catch (e: any) {
            return res.status(400).json({ error: e?.message || 'Invalid carousel buttons' });
          }
          const anyCardBody = mediaCardsIn.some((c: any) => String(c.bodyText || '').trim().length > 0);
          const carouselCardsPayload: any[] = [];
          for (const card of mediaCardsIn) {
            const format = card.mediaType === 'VIDEO' ? 'VIDEO' : 'IMAGE';
            if (!card.mediaUrl) {
              return res.status(400).json({ error: 'Each carousel card must include media.' });
            }
            let buffer: Buffer;
            let fileName: string;
            let mimeType: string;
            try {
              const loaded = await loadMediaBufferForCarousel(card.mediaUrl, format);
              buffer = loaded.buffer;
              fileName = loaded.fileName;
              mimeType = normalizeMimeForMetaResumable(loaded.mimeType, format);
              if (format === 'VIDEO') {
                if (buffer.length > WHATSAPP_CAROUSEL_MAX_VIDEO_BYTES) {
                  return res.status(400).json({
                    error: 'Video too large',
                    message: `A carousel video exceeds WhatsApp’s 16MB limit (~${(buffer.length / (1024 * 1024)).toFixed(1)}MB). Use a shorter or more compressed MP4.`,
                  });
                }
              } else if (buffer.length > WHATSAPP_CAROUSEL_MAX_IMAGE_BYTES) {
                const shrunk = await shrinkImageBufferForWhatsAppCarousel(buffer, fileName);
                buffer = shrunk.buffer;
                fileName = shrunk.fileName;
                mimeType = normalizeMimeForMetaResumable('image/jpeg', 'IMAGE');
              }
            } catch (e: any) {
              return res.status(400).json({ error: e?.message || 'Failed to load carousel card media' });
            }
            let assetHandleCarousel: string;
            try {
              assetHandleCarousel = await businessAPIManager.uploadFileResumable(
                {
                  phoneNumberId: phoneNumberIdForTemplate || '',
                  accessToken: accessToken,
                  businessAccountId: businessAccountId,
                },
                metaAppIdCarousel,
                buffer,
                fileName,
                mimeType
              );
            } catch (e: any) {
              return res.status(400).json({
                error: 'Carousel media upload failed',
                message: e?.message || String(e),
              });
            }
            if (!assetHandleCarousel || typeof assetHandleCarousel !== 'string' || assetHandleCarousel.trim() === '') {
              return res.status(400).json({ error: 'Invalid asset handle from carousel media upload' });
            }
            const cleanHandle = String(assetHandleCarousel).trim();
            const cardComps: any[] = [
              {
                type: 'HEADER',
                format,
                example: { header_handle: [cleanHandle] },
              },
            ];
            if (anyCardBody) {
              const bt = String(card.bodyText || '').trim() || '\u2014';
              const bodyCard: any = { type: 'BODY', text: bt };
              const nums = positionalVarNumbersInText(bt);
              if (nums.length > 0) {
                bodyCard.example = {
                  body_text: [
                    nums.map((num) => {
                      return (
                        req.body.sampleValues?.[num.toString()] ||
                        String(card.bodyText || '').trim().slice(0, 40) ||
                        `Value${num}`
                      );
                    }),
                  ],
                };
              }
              cardComps.push(bodyCard);
            }
            let buttonsMeta: any[];
            try {
              buttonsMeta = metaCarouselTemplateButtonsFromUi(card.buttons || []);
            } catch (e: any) {
              return res.status(400).json({ error: e?.message || 'Invalid carousel card buttons' });
            }
            cardComps.push({ type: 'BUTTONS', buttons: buttonsMeta });
            carouselCardsPayload.push({ components: cardComps });
          }
          components.push({ type: 'CAROUSEL', cards: carouselCardsPayload });
        }

        // Validate template name (Meta requirements: lowercase, alphanumeric, underscores only)
        const validatedName = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        if (validatedName !== name.toLowerCase()) {
          console.warn(`Template name "${name}" was sanitized to "${validatedName}" for Meta API compliance`);
        }
        
        // Create template in Meta with retry mechanism
        // Meta sometimes needs additional time to process media handles, so we retry with delays
        let metaTemplate;
        let templateRetryCount = 0;
        const maxTemplateRetries = 3;
        let templateCreated = false;
        
        while (templateRetryCount < maxTemplateRetries && !templateCreated) {
          try {
            metaTemplate = await businessAPIManager.createMessageTemplate(
              {
                phoneNumberId: phoneNumberIdForTemplate || 'unknown',
                accessToken: accessToken,
                businessAccountId: businessAccountId,
              },
              businessAccountId,
              {
                name: validatedName,
                language,
                category: templateCategory,
                components,
              }
            );
            templateCreated = true;
            console.log(`[Create Template] Template created successfully (attempt ${templateRetryCount + 1})`);
          } catch (templateError: any) {
            templateRetryCount++;
            const isMediaHandleError = templateError.message?.includes('2494102') || 
                                      templateError.message?.includes('media handle is invalid') ||
                                      templateError.message?.includes('Parameter value is not valid');
            
            if (isMediaHandleError && templateRetryCount < maxTemplateRetries) {
              // Media handle error - wait longer and retry
              const waitTime = 5000 * templateRetryCount; // 5s, 10s, 15s
              console.log(`[Create Template] Media handle error, waiting ${waitTime}ms before retry (attempt ${templateRetryCount}/${maxTemplateRetries})...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
            } else {
              // Other error or max retries reached - throw the error
              throw templateError;
            }
          }
        }

        // Meta returns the template with the name we sent, so use that
        // The template name in Meta is what we need to use when sending messages
        const metaTemplateName = metaTemplate.name || validatedName;
        const metaTemplateId = metaTemplate.id || metaTemplate.message_template_id;

        console.log(`[Create Template] Meta returned template - Name: "${metaTemplateName}", ID: "${metaTemplateId}"`);

        // Store in database
        const template = await storage.upsertMessageTemplate({
          userId,
          organizationId,
          templateId: metaTemplateId || validatedName,
          name: metaTemplateName, // Use the name from Meta response (should match what we sent)
          language,
          status: 'PENDING',
          category: templateCategory as 'MARKETING' | 'UTILITY' | 'AUTHENTICATION',
          phoneNumberId: phoneNumberIdForTemplate,
          components,
          metaData: {
            metaTemplateId: metaTemplateId,
            createdVia: 'api',
            originalName: name, // Keep original name for reference
            submittedAt: new Date().toISOString(),
            interactiveAction: req.body.interactiveAction || 'NONE',
            productCards: req.body.productCards || [],
            catalogId: req.body.catalogId || null,
            mediaCards: req.body.mediaCards || [],
            formButtonText: req.body.formButtonText || '',
            flowId: req.body.flowId || null,
            internalFlowId: req.body.internalFlowId || null,
            flowName: req.body.flowName || null,
            ...(req.body.mediaUrl && !isAnyCarousel
              ? { templateHeaderMediaUrl: req.body.mediaUrl }
              : {}),
          },
        });

        res.json({
          success: true,
          template,
          message: 'Template submitted to Meta for approval',
        });
      } else {
        // Create unofficial template (local only)
        // Build buttons from interactive actions
        const buttons: any[] = req.body.interactiveAction
          ? await buildTemplateButtonsFromBody(req.body, { organizationId, userId })
          : [];
        
        // Fall back to legacy button format
        if (buttons.length === 0 && buttonType && buttonType !== 'NONE' && buttonText) {
          buttons.push({
            type: buttonType,
            text: buttonText,
            ...(buttonType === 'URL' && buttonUrl ? { url: buttonUrl } : {}),
            ...(buttonType === 'PHONE_NUMBER' && buttonPhone ? { phone_number: buttonPhone } : {}),
          });
        }
        
        const template = await storage.upsertMessageTemplate({
          userId,
          organizationId: organizationId || undefined,
          templateId: `unofficial_${Date.now()}_${name}`,
          name,
          language,
          status: 'approved', // Unofficial templates are auto-approved
          category,
          components: [
            ...(headerText ? [{
              type: 'HEADER',
              format: 'TEXT',
              text: headerText,
            }] : []),
            {
              type: 'BODY',
              text: bodyText,
            },
            ...(footerText ? [{
              type: 'FOOTER',
              text: footerText,
            }] : []),
            ...(buttons.length > 0 ? [{
              type: 'BUTTONS',
              buttons: buttons,
            }] : []),
          ],
          metaData: {
            createdVia: 'local',
            templateType: 'unofficial',
            interactiveAction: req.body.interactiveAction || 'NONE',
            productCards: req.body.productCards || [],
            mediaCards: req.body.mediaCards || [],
            formButtonText: req.body.formButtonText || '',
            flowId: req.body.flowId || null,
            internalFlowId: req.body.internalFlowId || null,
            flowName: req.body.flowName || null,
          },
        });

        res.json({
          success: true,
          template,
          message: 'Template created successfully',
        });
      }
    } catch (error: any) {
      console.error('Error creating template:', error);
      const errorMessage = error.message || 'Failed to create template';
      // Return full error message - includes detailed troubleshooting steps
      res.status(500).json({
        error: 'Creation failed',
        message: errorMessage, // Full detailed error message with troubleshooting steps
      });
    }
  });

  // Test SMTP/email configuration
  app.post('/api/settings/test-email', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      const to = user?.email || req.body?.email;
      if (!to) {
        return res.status(400).json({ error: 'No email address to send test to' });
      }
      const orgs = await storage.getOrganizationsByUser(userId);
      const { sendEmail, sendOrgOutboundEmail } = await import('./utils/email');
      const testPayload = {
        to,
        subject: 'SMTP Test - Helicoptic WhatsApp',
        text: 'This is a test email. If you received this, your SMTP configuration is working correctly.',
      };
      let sent = false;
      let usedOrgSmtp = false;
      for (const org of orgs) {
        if (!org?.id) continue;
        sent = await sendOrgOutboundEmail(org.id, testPayload);
        if (sent) {
          usedOrgSmtp = true;
          break;
        }
      }
      if (!sent) {
        const smtpFallbackUserIds = [...new Set(orgs.map((o) => o.ownerId).filter((id) => id && id !== userId))] as string[];
        sent = await sendEmail({ ...testPayload, userId, smtpFallbackUserIds });
      }
      if (sent) {
        res.json({
          success: true,
          message: `Test email sent to ${to}${usedOrgSmtp ? ' (organization SMTP)' : ''}`,
        });
      } else {
        const hint = process.env.SMTP_HOST?.includes('gmail')
          ? ' For Gmail, use an App Password (not your normal password) and enable 2-Step Verification at myaccount.google.com.'
          : '';
        res.status(500).json({
          error: `Failed to send test email. Configure Integrations → SMTP (org) or Settings → SMTP, then retry.${hint}`,
        });
      }
    } catch (error: any) {
      console.error('[Test Email] Error:', error);
      res.status(500).json({ error: error.message || 'Failed to send test email' });
    }
  });

  // Test WhatsApp Business API connection
  app.post('/api/settings/test-whatsapp-business', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { phoneNumberId, accessToken, businessAccountId } = req.body;

      if (!phoneNumberId || !accessToken) {
        return res.status(400).json({ 
          error: 'Missing credentials',
          message: 'Phone Number ID and Access Token are required'
        });
      }

      // Use the business API manager's verifyCredentials method
      const credentials = {
        phoneNumberId,
        accessToken,
        businessAccountId,
      };

      // Test connection by fetching phone number info
      const apiVersion = 'v23.0';
      const baseUrl = 'https://graph.facebook.com';
      const url = `${baseUrl}/${apiVersion}/${phoneNumberId}?fields=display_phone_number,verified_name,code_verification_status`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = errorData.error || {};
        let userMessage = error.message || `HTTP ${response.status}: ${response.statusText}`;
        
        // Provide helpful messages for common OAuth errors
        if (error.code === 190) {
          if (error.error_subcode === 467) {
            userMessage = 'Access token is invalid or expired. Please generate a new access token from Meta Business Manager. The user may have logged out or the token may have expired.';
          } else {
            userMessage = 'Access token is invalid. Please check your token and ensure it has the required permissions (whatsapp_business_messaging, whatsapp_business_management).';
          }
        } else if (error.code === 100) {
          userMessage = 'Invalid phone number ID. Please verify your Phone Number ID in Meta Business Manager.';
        } else if (error.code === 190 && error.type === 'OAuthException') {
          userMessage = 'Authentication failed. Please verify your access token is valid and has not expired.';
        }
        
        return res.status(response.status).json({
          success: false,
          error: 'Connection failed',
          message: userMessage,
          details: error,
          errorCode: error.code,
          errorSubcode: error.error_subcode,
        });
      }

      const phoneInfo = await response.json();

      res.json({
        success: true,
        message: 'Connection successful!',
        phoneInfo: {
          displayPhoneNumber: phoneInfo.display_phone_number,
          verifiedName: phoneInfo.verified_name,
          codeVerificationStatus: phoneInfo.code_verification_status,
        },
      });
    } catch (error: any) {
      console.error('Error testing WhatsApp Business connection:', error);
      res.status(500).json({
        success: false,
        error: 'Test failed',
        message: error.message || 'Failed to test connection',
      });
    }
  });

  // Gallery Upload API - Upload files to organization gallery
  // Note: withOrgContext, withOrgAdmin, and withOrgOwner are defined at the top of the function
  app.post('/api/gallery/upload', ...withOrgContext, requirePermission('gallery.create'), galleryUploadSingle, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { organizationId } = req.context || {};
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      let fileType = classifyPanelUploadFromServer(
        file.mimetype || "",
        file.originalname || file.filename || "",
      );

      try {
        assertPanelUploadSize(fileType, file.size);
      } catch (sizeErr: any) {
        try {
          fs.unlinkSync(file.path);
        } catch {
          // ignore
        }
        return res.status(400).json({ error: sizeErr.message || 'File is too large' });
      }

      // Create URL for the file (relative and full)
      const relativeUrl = `/uploads/${organizationId}/gallery/${file.filename}`;
      await ingestMulterDiskFile(file, relativeUrl);
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const fullUrl = `${baseUrl}${relativeUrl}`;

      res.json({
        success: true,
        id: file.filename,
        url: relativeUrl,
        fullUrl: fullUrl,
        name: file.originalname,
        type: fileType,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('Error uploading gallery file:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Gallery API - Get uploaded media files from organization folder
  app.get('/api/gallery', ...withAuthAndRateLimit, ...withOrgContext, requirePermission('gallery.view'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { organizationId } = req.context || {};
      const { type } = req.query;
      
      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const galleryEntries = await listUploadPrefix(`${organizationId}/gallery`);
      const mediaFiles: any[] = [];

      for (const entry of galleryEntries) {
        const filename = entry.name;
        const stats = { size: entry.size, mtime: entry.lastModified || new Date() };

        // Determine file type from extension
        const ext = path.extname(filename).toLowerCase();
        let fileType = 'document';
        if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) {
          fileType = 'image';
        } else if (['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm'].includes(ext)) {
          fileType = 'video';
        } else if (['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.opus', '.oga', '.mpeg', '.mpg', '.weba', '.amr', '.caf'].includes(ext)) {
          fileType = 'audio';
        }

        // Filter by type if specified
        if (type && type !== 'all' && fileType !== type) {
          continue;
        }

        const relativeUrl = `/uploads/${organizationId}/gallery/${filename}`;
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const fullUrl = `${baseUrl}${relativeUrl}`;

        // Extract original filename (remove timestamp and random suffix)
        // Format: originalname-timestamp-random.ext
        // Try to extract by removing the last two numeric parts before extension
        const fileExt = path.extname(filename);
        const nameWithoutExt = path.basename(filename, fileExt);
        // Remove last two parts (timestamp-random) if they match the pattern
        const originalNameMatch = nameWithoutExt.match(/^(.+)-(\d+)-(\d+)$/);
        const displayName = originalNameMatch ? `${originalNameMatch[1]}${fileExt}` : filename;

        mediaFiles.push({
          id: filename,
          url: relativeUrl,
          fullUrl: fullUrl,
          name: displayName,
          type: fileType,
          size: stats.size,
          uploadedAt: (entry.lastModified || new Date()).toISOString(),
        });
      }

      // Sort by upload date (newest first)
      mediaFiles.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

      res.json(mediaFiles);
    } catch (error: any) {
      console.error('Error getting gallery:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Gallery API - Get single file by id
  app.get('/api/gallery/:id', ...withAuthAndRateLimit, ...withOrgContext, requirePermission('gallery.view'), async (req: any, res) => {
    try {
      const { organizationId } = req.context || {};
      const { id } = req.params;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const relativeUrl = `/uploads/${organizationId}/gallery/${id}`;
      const localPath = resolveUploadLocalPath(relativeUrl);
      let size = 0;
      let uploadedAt = new Date();
      if (localPath) {
        const stats = fs.statSync(localPath);
        size = stats.size;
        uploadedAt = stats.birthtime;
      } else if (!(await uploadExists(relativeUrl))) {
        return res.status(404).json({ error: 'File not found' });
      } else {
        const entries = await listUploadPrefix(`${organizationId}/gallery`);
        const match = entries.find((e) => e.name === id);
        if (!match) return res.status(404).json({ error: 'File not found' });
        size = match.size;
        uploadedAt = match.lastModified || new Date();
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const fullUrl = `${baseUrl}${relativeUrl}`;
      const ext = path.extname(id).toLowerCase();
      let fileType = 'document';
      if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) {
        fileType = 'image';
      } else if (['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm'].includes(ext)) {
        fileType = 'video';
      } else if (['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.opus', '.oga', '.mpeg', '.mpg', '.weba', '.amr', '.caf'].includes(ext)) {
        fileType = 'audio';
      }
      const fileExt = path.extname(id);
      const nameWithoutExt = path.basename(id, fileExt);
      const originalNameMatch = nameWithoutExt.match(/^(.+)-(\d+)-(\d+)$/);
      const displayName = originalNameMatch ? `${originalNameMatch[1]}${fileExt}` : id;

      res.json({
        id,
        url: relativeUrl,
        fullUrl: fullUrl,
        name: displayName,
        type: fileType,
        size,
        uploadedAt: uploadedAt.toISOString(),
      });
    } catch (error: any) {
      console.error('Error getting gallery file:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete gallery file
  app.delete('/api/gallery/:id', ...withAuthAndRateLimit, ...withOrgContext, requirePermission('gallery.delete'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { organizationId } = req.context || {};
      const { id } = req.params;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const relativeUrl = `/uploads/${organizationId}/gallery/${id}`;
      if (!(await uploadExists(relativeUrl))) {
        return res.status(404).json({ error: 'File not found' });
      }

      await deleteUploadFile(relativeUrl);

      res.json({ success: true, message: 'File deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting gallery file:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // List user's organizations
  app.get('/api/organizations', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizations = await storage.getOrganizationsByUser(userId);
      res.json({ organizations });
    } catch (error: any) {
      console.error('Error getting organizations:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /** Active WhatsApp panel template for this deployment (all organizations). */
  app.get('/api/panel-template/active', ...withAuthAndRateLimit, async (_req: any, res) => {
    try {
      const activePanelTemplateId = await storage.getActivePanelTemplateId();
      res.json({ activePanelTemplateId });
    } catch (error: any) {
      console.error('Error getting active panel template:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get organization theme (for users)
  app.get('/api/organizations/:organizationId/theme', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const { organizationId } = req.params;
      const userId = getUserId(req);
      
      // Verify user is a member of the organization
      const member = await storage.getOrganizationMember(organizationId, userId);
      if (!member) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const theme = await storage.getOrganizationTheme(organizationId);
      res.json({ theme });
    } catch (error: any) {
      console.error('Error getting organization theme:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update organization theme
  app.post('/api/organizations/:organizationId/theme', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const { organizationId } = req.params;
      const userId = getUserId(req);
      const { themeMode, accentColor } = req.body;
      
      // Verify user is a member of the organization
      const member = await storage.getOrganizationMember(organizationId, userId);
      if (!member) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Generate color values based on accent color
      const colorMap: Record<string, string> = {
        grey: '210 9% 31%',
        pink: '330 81% 60%',
        red: '0 72% 51%',
        orange: '24 95% 53%',
        green: '142 76% 36%',
        blue: '217 91% 60%',
        yellow: '45 93% 47%',
        purple: '262 83% 58%',
      };

      const selectedColor = accentColor || 'orange';
      const colorValue = colorMap[selectedColor] || colorMap.orange;

      const themeData: any = {
        organizationId,
        themeMode: 'light',
        accentColor: selectedColor,
        lightPrimary: colorValue,
        lightPrimaryForeground: '0 0% 100%',
      };

      const theme = await storage.createOrUpdateOrganizationTheme(themeData);
      res.json({ theme });
    } catch (error: any) {
      console.error('Error updating organization theme:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create organization
  app.post('/api/organizations', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const parsed = insertOrganizationSchema.safeParse({ ...req.body, ownerId: userId });
      
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid data', errors: parsed.error.errors });
      }

      const organization = await storage.createOrganization(parsed.data);
      
      // Create default theme for new organization
      try {
        await storage.createOrUpdateOrganizationTheme({
          organizationId: organization.id,
          themeMode: 'light',
          accentColor: 'orange',
          lightPrimary: '24 95% 53%',
          lightPrimaryForeground: '0 0% 100%',
        });
      } catch (themeError) {
        console.error('Error creating default theme:', themeError);
        // Non-critical - continue even if theme creation fails
      }
      
      res.json(organization);
    } catch (error: any) {
      console.error('Error creating organization:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get current user's member record (role, permissions) for an organization
  app.get('/api/organizations/:id/current-member', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;
      const member = await storage.getOrganizationMember(id, userId);
      if (!member) {
        return res.status(403).json({ message: 'Access denied' });
      }
      res.json({
        id: member.id,
        role: member.role,
        permissions: Array.isArray(member.permissions) ? member.permissions : [],
      });
    } catch (error: any) {
      console.error('Error getting current member:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get organization members
  app.get('/api/organizations/:id/members', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;
      
      // Verify user is a member
      const member = await storage.getOrganizationMember(id, userId);
      if (!member) {
        return res.status(403).json({ message: 'Access denied' });
      }
      // Members with role 'member' need manage_team.view or manage_settings.view to list members (Settings page)
      if (member.role === 'member') {
        const perms = Array.isArray(member.permissions) ? member.permissions : [];
        const canListMembers =
          perms.includes('manage_team.view') ||
          perms.includes('manage_settings.view') ||
          perms.includes('reminders.create') ||
          perms.includes('reminders.edit') ||
          perms.includes('manage_contacts.edit');
        if (!canListMembers) {
          return res.status(403).json({
            message: 'You don\'t have permission to view team members. Contact your admin to request access.',
          });
        }
      }
      
      const membersWithUsers = await storage.getOrganizationMembersWithUsers(id);
      res.json(membersWithUsers);
    } catch (error: any) {
      console.error('Error getting members:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Add organization member
  app.post('/api/organizations/:id/members', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;
      const { role: requestedRole } = req.body;
      
      // Verify user is owner or admin
      const member = await storage.getOrganizationMember(id, userId);
      if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
        return res.status(403).json({ message: 'Only owners and admins can add members' });
      }
      
      // Only owners can assign owner role
      if (requestedRole === 'owner' && member.role !== 'owner') {
        return res.status(403).json({ message: 'Only owners can assign the owner role' });
      }
      
      const parsed = insertOrganizationMemberSchema.safeParse({ ...req.body, organizationId: id });
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid data', errors: parsed.error.errors });
      }

      const teamQuota = await assertPlanQuota({ userId, organizationId: id, kind: "team_members" });
      if (teamQuota) return sendPlanQuotaDenial(res, teamQuota);
      
      const newMember = await storage.addOrganizationMember(parsed.data);
      res.json(newMember);
    } catch (error: any) {
      console.error('Error adding member:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update member (role, permissions, profile: firstName, lastName, email, and optionally newPassword)
  app.patch('/api/organizations/:id/members/:memberId', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { id, memberId } = req.params;
      const { role: newRole, permissions: newPermissions, firstName, lastName, email, newPassword } = req.body;
      
      // Verify user is owner or admin
      const actor = await storage.getOrganizationMember(id, userId);
      if (!actor || (actor.role !== 'owner' && actor.role !== 'admin')) {
        return res.status(403).json({ message: 'Only owners and admins can edit members' });
      }
      
      const members = await storage.getOrganizationMembers(id);
      const targetMember = members.find(m => m.id === memberId);
      
      if (!targetMember) {
        return res.status(404).json({ message: 'Member not found' });
      }
      
      // Role change: only owners can change roles
      if (newRole !== undefined) {
        if (actor.role !== 'owner') {
          return res.status(403).json({ message: 'Only owners can change roles' });
        }
        if (targetMember.role === 'owner' && newRole !== 'owner') {
          const ownerCount = members.filter(m => m.role === 'owner').length;
          if (ownerCount === 1) {
            return res.status(400).json({ message: 'Cannot demote the last owner. Promote another member to owner first.' });
          }
        }
        await storage.updateOrganizationMemberRole(memberId, newRole);
      }

      // Permissions update
      if (newPermissions !== undefined && Array.isArray(newPermissions)) {
        if (actor.role !== 'owner' && actor.role !== 'admin') {
          return res.status(403).json({ message: 'Only owners and admins can change permissions' });
        }
        await storage.updateOrganizationMemberPermissions(memberId, newPermissions);
      }
      
      // Profile update: firstName, lastName, email
      const profileUpdates: Record<string, any> = {};
      if (firstName !== undefined) profileUpdates.firstName = firstName;
      if (lastName !== undefined) profileUpdates.lastName = lastName;
      if (email !== undefined) profileUpdates.email = email;
      if (Object.keys(profileUpdates).length > 0) {
        await storage.updateUser(targetMember.userId, profileUpdates);
      }
      
      // Password reset: owner/admin can set new password for member
      if (newPassword && typeof newPassword === 'string' && newPassword.length >= 8) {
        const bcrypt = await import('bcryptjs');
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(newPassword, salt);
        await storage.updateUser(targetMember.userId, { passwordHash } as any);
      }
      
      const updatedMember = await storage.getOrganizationMember(id, targetMember.userId);
      const updatedUser = await storage.getUser(targetMember.userId);
      res.json({
        ...updatedMember,
        user: updatedUser ? {
          id: updatedUser.id,
          email: updatedUser.email,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
        } : null,
      });
    } catch (error: any) {
      console.error('Error updating member:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Remove organization member
  app.delete('/api/organizations/:id/members/:memberId', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { id, memberId } = req.params;
      
      // Verify user is owner or admin
      const actor = await storage.getOrganizationMember(id, userId);
      if (!actor || (actor.role !== 'owner' && actor.role !== 'admin')) {
        return res.status(403).json({ message: 'Only owners and admins can remove members' });
      }
      
      // Get all members to check target member's role
      const members = await storage.getOrganizationMembers(id);
      const targetMember = members.find(m => m.id === memberId);
      
      if (!targetMember) {
        return res.status(404).json({ message: 'Member not found' });
      }
      
      // Only owners can remove other owners
      if (targetMember.role === 'owner' && actor.role !== 'owner') {
        return res.status(403).json({ message: 'Only owners can remove other owners' });
      }
      
      // Prevent removing the last owner
      if (targetMember.role === 'owner') {
        const ownerCount = members.filter(m => m.role === 'owner').length;
        if (ownerCount === 1) {
          return res.status(400).json({ message: 'Cannot remove the last owner. Promote another member to owner first.' });
        }
      }
      
      await storage.removeOrganizationMember(memberId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error removing member:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update organization
  app.patch('/api/organizations/:id', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;
      const { name, industry, website } = req.body;
      
      // Verify user is owner or admin
      const member = await storage.getOrganizationMember(id, userId);
      if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
        return res.status(403).json({ message: 'Only owners and admins can update organization' });
      }
      
      const updated = await storage.updateOrganization(id, {
        name,
        industry,
        website,
      });
      
      if (!updated) {
        return res.status(404).json({ message: 'Organization not found' });
      }
      
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating organization:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Contacts API Routes
  app.get('/api/contacts/inbox-index', ...withOrgContext, requirePermission('inbox.view'), async (req: any, res) => {
    try {
      const { organizationId } = req.context;
      const contacts = await storage.getInboxContactIndexByOrganization(organizationId);
      res.json(contacts);
    } catch (error: any) {
      console.error('Error getting inbox contact index:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/contacts', ...withOrgContext, requirePermission('manage_contacts.view', 'meetings.view'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { organizationId } = req.context;
      const q = req.query || {};
      const filters: import("./storage").ManagedContactFilters = {};
      if (typeof q.search === "string" && q.search.trim()) filters.search = q.search.trim();
      if (typeof q.createdDateFrom === "string") filters.createdDateFrom = q.createdDateFrom;
      if (typeof q.createdDateTo === "string") filters.createdDateTo = q.createdDateTo;
      if (typeof q.updatedDateFrom === "string") filters.updatedDateFrom = q.updatedDateFrom;
      if (typeof q.updatedDateTo === "string") filters.updatedDateTo = q.updatedDateTo;
      if (typeof q.reminderDateFrom === "string") filters.reminderDateFrom = q.reminderDateFrom;
      if (typeof q.reminderDateTo === "string") filters.reminderDateTo = q.reminderDateTo;
      if (typeof q.assignedDateFrom === "string") filters.assignedDateFrom = q.assignedDateFrom;
      if (typeof q.assignedDateTo === "string") filters.assignedDateTo = q.assignedDateTo;
      if (typeof q.source === "string") filters.source = q.source;
      if (typeof q.email === "string" && q.email.trim()) filters.email = q.email.trim();
      if (q.assignedTo !== undefined) {
        const v = q.assignedTo;
        filters.assignedTo = Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : typeof v === "string" ? (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []) : [];
      }
      if (q.tagIds !== undefined) {
        const v = q.tagIds;
        filters.tagIds = Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : typeof v === "string" ? (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []) : [];
      }
      if (q.noTagsOnly === "true" || q.noTagsOnly === "1") filters.noTagsOnly = true;
      if (q.unassignedOnly === "true" || q.unassignedOnly === "1") filters.unassignedOnly = true;
      if (q.optInStatus === "opted_in" || q.optInStatus === "opted_out") filters.optInStatus = q.optInStatus;
      if (q.duplicate === "duplicates" || q.duplicate === "non_duplicates") filters.duplicate = q.duplicate;
      // Custom column filters: customField.<columnId>=value
      const customFieldFilters: Record<string, string> = {};
      for (const [key, val] of Object.entries(q)) {
        if (typeof key === "string" && key.startsWith("customField.") && typeof val === "string" && val.trim()) {
          const columnId = key.slice("customField.".length);
          customFieldFilters[columnId] = val.trim();
        }
      }
      if (Object.keys(customFieldFilters).length) filters.customFieldFilters = customFieldFilters;

      const enrichContacts = async (rows: any) => {
        if (!Array.isArray(rows) || rows.length === 0) return [];
        const tagsMap = await storage.getContactTagsBatchByOrganization(
          rows.map((c) => c.id || c._id),
          organizationId
        );
        return rows.map((contact) => {
          const cId = contact.id || contact._id;
          const assignedTags = tagsMap?.get?.(cId) || [];
          return {
            ...contact,
            id: cId,
            tags: assignedTags.map((tag: any) => tag?.id || tag),
          };
        });
      };

      if (isPaginatedListRequest(q)) {
        const pagination = listPaginationFromRequest(req, { maxLimit: CONTACTS_MAX_PAGE_SIZE });
        const page = await storage.listManagedContactsWithFiltersByOrganization(organizationId, filters, pagination);
        const pageItems = await enrichContacts(page.items);
        return res.json(buildPaginatedResponse("contacts", { ...page, items: pageItems }));
      }

      const contacts = await storage.getManagedContactsWithFiltersByOrganization(organizationId, filters);
      return res.json(await enrichContacts(contacts));
    } catch (error: any) {
      console.error('Error getting contacts:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/contacts', ...withOrgContext, requirePermission('manage_contacts.create'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { organizationId } = req.context;
      const quota = await assertPlanQuota({ userId, organizationId, kind: "contacts" });
      if (quota) return sendPlanQuotaDenial(res, quota);
      const parsed = insertManagedContactSchema.safeParse({ ...req.body, userId, organizationId });
      
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid data', errors: parsed.error.errors });
      }
      
      const contact = await storage.createManagedContact(parsed.data);
      triggerWebhooks(userId, 'contact.created', { contact }).catch(() => {});
      maybeEnrollNewContact(contact).catch(() => {});
      res.json(contact);
    } catch (error: any) {
      console.error('Error creating contact:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch('/api/contacts/:id', ...withOrgContext, requirePermission('manage_contacts.edit'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { organizationId } = req.context;
      const { id } = req.params;

      let contact = await storage.getManagedContact(id, userId, organizationId);
      if (!contact) {
        contact = await storage.getManagedContactByOrganization(id, organizationId);
      }
      if (!contact) {
        return res.status(404).json({ message: 'Contact not found' });
      }

      const updated = await storage.updateManagedContact(id, contact.userId, organizationId, req.body);
      if (!updated) {
        return res.status(404).json({ message: 'Contact not found' });
      }
      triggerWebhooks(userId, 'contact.updated', { contact: updated }).catch(() => {});
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating contact:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/contacts/:id/create-invoice', ...withOrgContext, requirePermission('manage_contacts.edit'), parseCreateInvoiceRequest, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { organizationId } = req.context;
      const { id } = req.params;
      const gstTypeStore =
        req.body?.gstTypeStore === 'non_gst' || req.body?.gstTypeStore === 'sgst_cgst'
          ? req.body.gstTypeStore
          : req.body?.isGst === false
            ? 'non_gst'
            : 'igst';
      const isGst = gstTypeStore !== 'non_gst';
      const inclusiveGst = !!req.body?.inclusiveGst;
      const invoiceCurrency =
        typeof req.body?.invoiceCurrency === 'string' ? req.body.invoiceCurrency : undefined;
      const lineItems = Array.isArray(req.body?.lineItems) ? req.body.lineItems : [];
      const invoiceTo =
        req.body?.invoiceTo && typeof req.body.invoiceTo === 'object' ? req.body.invoiceTo : null;
      const emailAutomation = !!req.body?.emailAutomation;
      const whatsappAutomation = !!req.body?.whatsappAutomation;
      const invoiceStatus = normalizeInvoicePaymentStatus(req.body?.invoiceStatus);
      const pdfFile = req.file as Express.Multer.File | undefined;
      if (lineItems.length === 0) {
        return res.status(400).json({ message: 'At least one line item is required' });
      }
      if ((emailAutomation || whatsappAutomation) && !pdfFile?.buffer?.length) {
        return res.status(400).json({
          message: 'Invoice PDF is required when email or WhatsApp automation is enabled',
        });
      }

      let contact = await storage.getManagedContact(id, userId, organizationId);
      if (!contact) {
        contact = await storage.getManagedContactByOrganization(id, organizationId);
      }
      if (!contact) {
        return res.status(404).json({ message: 'Contact not found' });
      }

      const settings =
        (await storage.getOrganizationInvoiceSettings(organizationId)) || defaultInvoiceSettings();
      const prefix = isGst ? settings.gstInvoicePrefix : settings.nonGstInvoicePrefix;
      const start = isGst ? (settings.gstInvoiceStart ?? 1) : (settings.nonGstInvoiceStart ?? 1);
      const invoiceNo = formatInvoiceNumber(prefix, start);

      await storage.upsertOrganizationInvoiceSettings(
        organizationId,
        isGst ? { gstInvoiceStart: start + 1 } : { nonGstInvoiceStart: start + 1 },
      );

      const lastInvoiceTotal = lineItems.reduce((sum: number, row: any) => {
        const cost = Number(row.cost) || 0;
        const qty = Number(row.qty) || 1;
        const discount = Number(row.discount) || 0;
        const base = Math.max(0, cost * qty - discount);
        if (!isGst) return sum + base;
        const defaultPct = settings.gstPercentage ?? 18;
        const igstPct = Number(row.igstPct) || defaultPct;
        const sgstPct = Number(row.sgstPct) || defaultPct / 2;
        const cgstPct = Number(row.cgstPct) || defaultPct / 2;
        const totalTaxPct =
          gstTypeStore === 'igst' ? igstPct : sgstPct + cgstPct;
        if (inclusiveGst) return sum + base;
        const tax = Math.round((base * totalTaxPct) / 100);
        return sum + base + tax;
      }, 0);
      const amountPaidInput =
        req.body?.amountPaid != null && req.body.amountPaid !== ''
          ? Number(req.body.amountPaid)
          : undefined;
      const { amountPaid, amountPending } = computeInvoicePaymentAmounts(
        invoiceStatus,
        lastInvoiceTotal,
        amountPaidInput,
      );

      const customFields = {
        ...(contact.customFields && typeof contact.customFields === 'object' ? contact.customFields : {}),
        billNo: invoiceNo,
        lastInvoiceAt: new Date().toISOString(),
        lastInvoiceType: gstTypeStore,
        lastInvoiceInclusiveGst: inclusiveGst,
        ...(invoiceCurrency ? { lastInvoiceCurrency: invoiceCurrency } : {}),
        lastInvoiceTotal,
        ...(invoiceTo ? { lastInvoiceTo: invoiceTo } : {}),
        ...(lineItems.length ? { lastInvoiceLineItems: lineItems } : {}),
        lastInvoiceEmailAutomation: emailAutomation,
        lastInvoiceWhatsappAutomation: whatsappAutomation,
        lastInvoiceStatus: invoiceStatus,
        lastInvoiceAmountPaid: amountPaid,
        lastInvoiceAmountPending: amountPending,
      };

      const updated = await storage.updateManagedContact(id, contact.userId, organizationId, {
        customFields,
      });

      let delivery: import('./invoices/invoice-delivery').InvoiceDeliveryResult | undefined;
      if (pdfFile?.buffer?.length && (emailAutomation || whatsappAutomation)) {
        const org = await storage.getOrganization(organizationId);
        const orgName = (await import('./invoices/invoice-delivery')).resolveInvoiceOrganizationName(settings, org?.name);
        const customerEmail =
          (invoiceTo && typeof invoiceTo === 'object' && invoiceTo.customerEmail) ||
          contact.email;
        const customerPhone =
          (invoiceTo && typeof invoiceTo === 'object' && invoiceTo.customerPhone) ||
          contact.phoneNumber;
        const customerName =
          (invoiceTo && typeof invoiceTo === 'object' && invoiceTo.customerName) ||
          contact.name ||
          '';
        const { deliverInvoiceAutomations } = await import('./invoices/invoice-delivery');
        delivery = await deliverInvoiceAutomations({
          userId,
          organizationId,
          organizationName: orgName,
          invoiceNo,
          pdfBuffer: pdfFile.buffer,
          emailAutomation,
          whatsappAutomation,
          customerEmail: typeof customerEmail === 'string' ? customerEmail : null,
          customerPhone: typeof customerPhone === 'string' ? customerPhone : null,
          customerName: typeof customerName === 'string' ? customerName : null,
          currency: invoiceCurrency || settings.invoiceCurrency || 'INR',
          totalAmount: lastInvoiceTotal,
          amountPaid,
          amountPending,
          invoiceStatus,
        });
        if (delivery.pdfUrl) {
          await storage.updateManagedContact(id, contact.userId, organizationId, {
            customFields: {
              ...customFields,
              lastInvoicePdfUrl: delivery.pdfUrl,
            },
          });
        }
      } else if (pdfFile?.buffer?.length) {
        const { saveInvoicePdf } = await import('./invoices/invoice-delivery');
        const pdfUrl = saveInvoicePdf(organizationId, invoiceNo, pdfFile.buffer);
        delivery = { pdfUrl };
        await storage.updateManagedContact(id, contact.userId, organizationId, {
          customFields: {
            ...customFields,
            lastInvoicePdfUrl: pdfUrl,
          },
        });
      }

      const org = await storage.getOrganization(organizationId);
      const orgName = (await import('./invoices/invoice-delivery')).resolveInvoiceOrganizationName(settings, org?.name);
      const creator = await storage.getUser(userId);
      const createdByName =
        [creator?.firstName, creator?.lastName].filter(Boolean).join(' ').trim() ||
        creator?.email ||
        'User';
      const customerName =
        (invoiceTo && typeof invoiceTo === 'object' && invoiceTo.customerName) ||
        contact.name ||
        '';
      const customerPhone =
        (invoiceTo && typeof invoiceTo === 'object' && invoiceTo.customerPhone) ||
        contact.phoneNumber ||
        '';
      const customerEmail =
        (invoiceTo && typeof invoiceTo === 'object' && invoiceTo.customerEmail) ||
        contact.email ||
        null;

      const invoiceRecord = await storage.createOrganizationInvoice({
        organizationId,
        contactId: contact.id,
        invoiceNo,
        companyName: orgName,
        customerName: String(customerName || ''),
        customerPhone: String(customerPhone || ''),
        customerEmail: typeof customerEmail === 'string' ? customerEmail : null,
        invoiceDate: new Date(),
        gstType: gstTypeStore,
        invoiceStatus,
        currency: invoiceCurrency || settings.invoiceCurrency || 'INR',
        totalAmount: lastInvoiceTotal,
        amountPaid,
        amountPending,
        pdfUrl: delivery?.pdfUrl || null,
        lineItems,
        invoiceTo,
        emailAutomation,
        whatsappAutomation,
        createdByUserId: userId,
        createdByName,
      });

      res.json({
        invoiceNo,
        invoiceId: invoiceRecord.id,
        gstTypeStore,
        isGst,
        inclusiveGst,
        invoiceCurrency,
        lineItems,
        invoiceTo,
        emailAutomation,
        whatsappAutomation,
        delivery,
        contact: updated,
      });
    } catch (error: any) {
      console.error('Error creating contact invoice:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/contacts/:id', ...withOrgContext, requirePermission('manage_contacts.delete'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { organizationId } = req.context;
      const { id } = req.params;
      
      const contact = await storage.getManagedContact(id, userId, organizationId);
      await storage.deleteManagedContact(id, userId, organizationId);
      if (contact) {
        triggerWebhooks(userId, 'contact.deleted', { contact }).catch(() => {});
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting contact:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Contact Tags API Routes
  app.get('/api/tags', ...withOrgContext, requirePermission('manage_contacts.view', 'tags.view'), async (req: any, res) => {
    try {
      const { organizationId } = req.context;
      if (isPaginatedListRequest(req.query)) {
        const pagination = listPaginationFromRequest(req);
        const search = parseListSearch(req.query);
        const result = await storage.listContactTagsByOrganization(organizationId, { search, ...pagination });
        return res.json(buildPaginatedResponse("tags", result));
      }
      const tags = await storage.getContactTagsByOrganization(organizationId);
      res.json(tags);
    } catch (error: any) {
      console.error('Error getting tags:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/tags', ...withOrgContext, requirePermission('manage_contacts.create', 'tags.create'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { organizationId } = req.context;
      const parsed = insertContactTagSchema.safeParse({ ...req.body, userId, organizationId });
      
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid data', errors: parsed.error.errors });
      }
      
      const tag = await storage.createContactTag(parsed.data);
      res.json(tag);
    } catch (error: any) {
      console.error('Error creating tag:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch('/api/tags/:id', ...withOrgContext, requirePermission('manage_contacts.edit', 'tags.edit'), async (req: any, res) => {
    try {
      const { organizationId } = req.context;
      const { id } = req.params;
      const data: { name?: string; color?: string } = {};
      if (req.body?.name !== undefined) data.name = req.body.name;
      if (req.body?.color !== undefined) data.color = req.body.color;
      
      const updated = await storage.updateContactTagByOrganization(id, organizationId, data);
      if (!updated) {
        return res.status(404).json({ message: 'Tag not found' });
      }
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating tag:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/tags/:id', ...withOrgContext, requirePermission('manage_contacts.delete', 'tags.delete'), async (req: any, res) => {
    try {
      const { organizationId } = req.context;
      const { id } = req.params;
      
      await storage.deleteContactTagByOrganization(id, organizationId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting tag:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Bulk assign tags to contacts (MUST come before /api/contacts/:id/tags to avoid route conflict)
  app.post('/api/contacts/bulk/tags', ...withOrgContext, requirePermission('manage_contacts.edit', 'tags.edit'), async (req: any, res) => {
    try {
      console.log('[Bulk Assign Tags] Request received:', { body: req.body });
      const userId = getUserId(req);
      const { organizationId } = req.context;
      
      if (!organizationId) {
        console.error('[Bulk Assign Tags] No organizationId in context');
        return res.status(400).json({ message: 'Organization context is required' });
      }
      
      const { contactIds, tagId } = req.body;
      
      if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ message: 'contactIds array is required' });
      }

      if (!tagId) {
        return res.status(400).json({ message: 'tagId is required' });
      }

      // Verify tag exists in the organization
      const tag = await storage.getContactTagByOrganization(tagId, organizationId);
      if (!tag) {
        console.warn('[Bulk Assign Tags] Tag not found:', { tagId, userId, organizationId });
        return res.status(404).json({ message: 'Tag not found' });
      }

      const results = [];

      for (const contactId of contactIds) {
        try {
          // First try with the current user's context
          let contact = await storage.getManagedContact(contactId, userId, organizationId);
          
          // If not found, check if contact exists in the organization (might belong to another user)
          if (!contact) {
            const [orgContact] = await db
              .select()
              .from(managedContacts)
              .where(and(
                eq(managedContacts.id, contactId),
                eq(managedContacts.organizationId, organizationId)
              ))
              .limit(1);
            
            if (orgContact) {
              // Contact exists in organization, use it for tag assignment
              contact = orgContact;
            }
          }
          
          if (!contact) {
            results.push({ contactId, success: false, error: 'Contact not found' });
            continue;
          }
          
          if (isMongoEnabled()) {
            await storage.createManagedContactTagAssignment(contactId, tagId);
            results.push({ contactId, success: true });
          } else {
            // Check if tag assignment already exists
            const [existing] = await db
              .select()
              .from(contactTagAssignments)
              .where(and(
                eq(contactTagAssignments.contactId, contactId),
                eq(contactTagAssignments.tagId, tagId)
              ))
              .limit(1);
            
            if (existing) {
              // Tag already assigned, skip
              results.push({ contactId, success: true, message: 'Tag already assigned' });
              continue;
            }
            
            // Assign tag directly (both contact and tag are verified to belong to organization)
            await db.insert(contactTagAssignments).values({ contactId, tagId });
            results.push({ contactId, success: true });
          }
        } catch (error: any) {
          console.error(`[Bulk Assign Tags] Error assigning tag to contact ${contactId}:`, error);
          results.push({ contactId, success: false, error: error.message });
        }
      }

      const successCount = results.filter(r => r.success).length;
      console.log(`[Bulk Assign Tags] Completed: ${successCount}/${contactIds.length} successful`);
      return res.json({ results, successCount });
    } catch (error: any) {
      console.error('[Bulk Assign Tags] Error bulk assigning tags:', error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Assign/remove tags to/from contacts (MUST come after bulk routes)
  app.post('/api/contacts/:id/tags', ...withOrgContext, requirePermission('manage_contacts.edit', 'tags.edit'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { organizationId } = req.context;
      const { id } = req.params;
      const { tagId } = req.body;
      
      // Verify contact exists in organization (might belong to another user)
      let contact = await storage.getManagedContact(id, userId, organizationId);
      if (!contact) {
        const [orgContact] = await db
          .select()
          .from(managedContacts)
          .where(and(
            eq(managedContacts.id, id),
            eq(managedContacts.organizationId, organizationId)
          ))
          .limit(1);
        if (orgContact) {
          contact = orgContact;
        }
      }
      
      // Verify tag exists in organization
      const tag = await storage.getContactTagByOrganization(tagId, organizationId);
      if (!contact || !tag) {
        return res.status(404).json({ message: 'Contact or tag not found' });
      }
      
      if (isMongoEnabled()) {
        await storage.assignTagToContact(id, tagId, userId, organizationId);
      } else {
        // Check if assignment already exists
        const [existing] = await db
          .select()
          .from(contactTagAssignments)
          .where(and(
            eq(contactTagAssignments.contactId, id),
            eq(contactTagAssignments.tagId, tagId)
          ))
          .limit(1);
        
        if (existing) {
          return res.json({ success: true, message: 'Tag already assigned' });
        }
        
        // Assign tag directly
        await db.insert(contactTagAssignments).values({ contactId: id, tagId });
      }
      try {
        await storage.createContactActivityLog({
          contactId: id,
          userId,
          organizationId: organizationId || undefined,
          action: 'tag_added',
          metadata: { tagId, tagName: tag.name },
        });
      } catch (logErr: any) {
        console.warn('Contact activity log (tag_added) skipped:', logErr?.message || logErr);
      }
      triggerWebhooks(userId, 'contact.tag_added', { contact, tag }).catch(() => {});
      if (organizationId && contact) {
        tryEnrollContactForDripTrigger({
          organizationId,
          contactId: id,
          trigger: "label_added",
          labelId: tagId,
        }).catch(() => {});
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error assigning tag:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/contacts/:id/tags/:tagId', ...withOrgContext, requirePermission('manage_contacts.edit', 'tags.edit'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { organizationId } = req.context;
      const { id, tagId } = req.params;
      const contact = await storage.getManagedContact(id, userId, organizationId);
      const tag = await storage.getContactTagByOrganization(tagId, organizationId);
      await storage.removeTagFromContact(id, tagId, userId, organizationId);
      if (contact && tag) {
        triggerWebhooks(userId, 'contact.tag_removed', { contact, tag }).catch(() => {});
      }
      if (tag) {
        try {
          await storage.createContactActivityLog({
            contactId: id,
            userId,
            organizationId: organizationId || undefined,
            action: 'tag_removed',
            metadata: { tagId, tagName: tag.name },
          });
        } catch (logErr: any) {
          console.warn('Contact activity log (tag_removed) skipped:', logErr?.message || logErr);
        }
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error removing tag:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Contact activity (MUST come before /api/contacts/:id to avoid route conflict)
  app.get('/api/contacts/:id/activity', ...withOrgContext, requirePermission('manage_contacts.view'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { organizationId } = req.context;
      const { id } = req.params;
      const logs = await storage.getContactActivityLogs(id, userId, organizationId);
      res.json(logs);
    } catch (error: any) {
      console.error('Error fetching contact activity:', error);
      if (error?.message?.includes('contact_activity_log') || error?.code === '42P01' || error?.message?.includes('does not exist')) {
        console.warn('Run migration: migrations/create_contact_activity_log.sql');
      }
      return res.json([]);
    }
  });

  // Contact notes (MUST come before /api/contacts/:id to avoid route conflict)
  app.get('/api/contacts/:id/notes', ...withOrgContext, requirePermission('manage_contacts.view'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { organizationId } = req.context;
      const { id } = req.params;
      const notes = await storage.getContactNotes(id, userId, organizationId);
      res.json(notes);
    } catch (error: any) {
      console.error('Error fetching contact notes:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/contacts/:id/notes', ...withOrgContext, requirePermission('manage_contacts.edit'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { organizationId } = req.context;
      const { id } = req.params;
      const { message } = req.body || {};
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ message: 'message is required' });
      }
      const contact = await storage.getManagedContact(id, userId, organizationId);
      if (!contact) return res.status(404).json({ message: 'Contact not found' });
      const note = await storage.createContactNote({
        contactId: id,
        userId,
        organizationId: organizationId || undefined,
        message: message.trim(),
      });
      try {
        await storage.createContactActivityLog({
          contactId: id,
          userId,
          organizationId: organizationId || undefined,
          action: 'note_added',
        });
      } catch (logErr: any) {
        console.warn('Contact activity log (note_added) skipped:', logErr?.message || logErr);
      }
      res.status(201).json(note);
    } catch (error: any) {
      console.error('Error creating contact note:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch('/api/contacts/:id/notes/:noteId', ...withOrgContext, requirePermission('manage_contacts.edit'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { organizationId } = req.context;
      const { id, noteId } = req.params;
      const { message } = req.body || {};
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ message: 'message is required' });
      }
      const note = await storage.updateContactNote(noteId, id, userId, organizationId, { message: message.trim() });
      if (!note) return res.status(404).json({ message: 'Note not found' });
      res.json(note);
    } catch (error: any) {
      console.error('Error updating contact note:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/contacts/:id/notes/:noteId', ...withOrgContext, requirePermission('manage_contacts.edit'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { organizationId } = req.context;
      const { id, noteId } = req.params;
      await storage.deleteContactNote(noteId, id, userId, organizationId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting contact note:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Contact reminders – org-scoped; members with reminders permission can view/create/edit/delete
  app.get('/api/contacts/:id/reminders', ...withOrgContext, requirePermission('reminders.view'), async (req: any, res) => {
    try {
      const { organizationId } = req.context;
      const { id } = req.params;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const reminders = await storage.getContactRemindersByOrganization(id, organizationId);
      res.json(reminders);
    } catch (error: any) {
      console.error('Error fetching contact reminders:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/contacts/:id/reminders', ...withOrgContext, requirePermission('reminders.create'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { organizationId } = req.context;
      const { id } = req.params;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const { reminderTo, title, message, notes, reminderAt, contactDisplayName, templateName, templateLanguage, templateParams, sessionId, useTemplate, headerImageUrl, headerImageId, headerVideoUrl, headerVideoId, headerDocumentUrl, headerDocumentId } = req.body || {};
      if (!reminderTo || typeof reminderTo !== 'string') {
        return res.status(400).json({ message: 'reminderTo (user id) is required' });
      }
      const assignee = await storage.getOrganizationMember(organizationId, reminderTo);
      if (!assignee) {
        return res.status(400).json({ message: 'reminderTo must be a team member in this organization' });
      }
      const titleText = typeof title === 'string' ? title.trim() : '';
      const messageText = typeof message === 'string' ? message.trim() : '';
      const notesText = typeof notes === 'string' ? notes.trim() : '';
      const wantsTemplate = useTemplate === true || (typeof templateName === 'string' && templateName.trim().length > 0);
      const templateNameText = typeof templateName === 'string' ? templateName.trim() : '';
      const sessionIdText = typeof sessionId === 'string' ? sessionId.trim() : '';
      if (wantsTemplate) {
        if (!templateNameText) {
          return res.status(400).json({ message: 'templateName is required when using a template' });
        }
        if (!sessionIdText) {
          return res.status(400).json({ message: 'sessionId is required when using a template' });
        }
        if (!titleText) {
          return res.status(400).json({ message: 'title is required' });
        }
      } else if (!titleText && !messageText) {
        return res.status(400).json({ message: 'title or message is required' });
      } else if (messageText && !sessionIdText) {
        return res.status(400).json({ message: 'sessionId is required when sending a WhatsApp message' });
      }
      const at = reminderAt ? new Date(reminderAt) : null;
      if (!at || isNaN(at.getTime())) {
        return res.status(400).json({ message: 'reminderAt (valid date/time) is required' });
      }
      const contact = await storage.getManagedContactByOrganization(id, organizationId);
      if (!contact) return res.status(404).json({ message: 'Contact not found' });
      const params = Array.isArray(templateParams)
        ? templateParams.map((p: unknown) => String(p ?? ''))
        : undefined;
      const optStr = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
      const queueWhatsApp = wantsTemplate || (!!messageText && !!sessionIdText);
      const reminder = await storage.createContactReminder({
        contactId: id,
        userId,
        organizationId: organizationId || undefined,
        reminderTo,
        title: titleText || undefined,
        message: wantsTemplate
          ? (messageText || `Template: ${templateNameText}`)
          : (messageText || titleText),
        notes: notesText || undefined,
        reminderAt: at,
        contactDisplayName: typeof contactDisplayName === 'string' ? contactDisplayName.trim() || undefined : undefined,
        templateName: wantsTemplate ? templateNameText : undefined,
        templateLanguage: wantsTemplate
          ? (typeof templateLanguage === 'string' && templateLanguage.trim() ? templateLanguage.trim() : 'en')
          : undefined,
        templateParams: wantsTemplate ? (params ?? []) : undefined,
        sessionId: queueWhatsApp ? sessionIdText : undefined,
        headerImageUrl: wantsTemplate ? optStr(headerImageUrl) : undefined,
        headerImageId: wantsTemplate ? optStr(headerImageId) : undefined,
        headerVideoUrl: wantsTemplate ? optStr(headerVideoUrl) : undefined,
        headerVideoId: wantsTemplate ? optStr(headerVideoId) : undefined,
        headerDocumentUrl: wantsTemplate ? optStr(headerDocumentUrl) : undefined,
        headerDocumentId: wantsTemplate ? optStr(headerDocumentId) : undefined,
        whatsappStatus: queueWhatsApp ? 'pending' : 'none',
      });
      try {
        await storage.createContactActivityLog({
          contactId: id,
          userId,
          organizationId: organizationId || undefined,
          action: 'reminder_added',
        });
      } catch (logErr: any) {
        console.warn('Contact activity log (reminder_added) skipped:', logErr?.message || logErr);
      }
      // If already due (or past), kick the sender immediately instead of waiting for the next poll.
      if (queueWhatsApp && at.getTime() <= Date.now()) {
        void runReminderWhatsAppCheck();
      }
      res.status(201).json(reminder);
    } catch (error: any) {
      console.error('Error creating contact reminder:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch('/api/contacts/:id/reminders/:reminderId', ...withOrgContext, requirePermission('reminders.edit'), async (req: any, res) => {
    try {
      const { organizationId } = req.context;
      const { id, reminderId } = req.params;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const { reminderTo, title, message, notes, reminderAt, contactDisplayName, templateName, templateLanguage, templateParams, sessionId, useTemplate, headerImageUrl, headerImageId, headerVideoUrl, headerVideoId, headerDocumentUrl, headerDocumentId } = req.body || {};
      const data: {
        title?: string | null;
        message?: string;
        notes?: string | null;
        reminderTo?: string;
        reminderAt?: Date;
        contactDisplayName?: string | null;
        templateName?: string | null;
        templateLanguage?: string | null;
        templateParams?: string[] | null;
        sessionId?: string | null;
        headerImageUrl?: string | null;
        headerImageId?: string | null;
        headerVideoUrl?: string | null;
        headerVideoId?: string | null;
        headerDocumentUrl?: string | null;
        headerDocumentId?: string | null;
        whatsappStatus?: "none" | "pending" | "sending" | "sent" | "failed";
        whatsappSentAt?: Date | null;
        whatsappError?: string | null;
      } = {};
      if (reminderTo !== undefined) {
        if (typeof reminderTo !== 'string') return res.status(400).json({ message: 'reminderTo must be a string' });
        const assignee = await storage.getOrganizationMember(organizationId, reminderTo);
        if (!assignee) {
          return res.status(400).json({ message: 'reminderTo must be a team member in this organization' });
        }
        data.reminderTo = reminderTo;
      }
      if (title !== undefined) {
        if (typeof title !== 'string') return res.status(400).json({ message: 'title must be a string' });
        data.title = title.trim() || null;
      }
      if (message !== undefined) {
        if (typeof message !== 'string') return res.status(400).json({ message: 'message must be a string' });
        data.message = message.trim();
      }
      if (notes !== undefined) {
        if (typeof notes !== 'string') return res.status(400).json({ message: 'notes must be a string' });
        data.notes = notes.trim() || null;
      }
      if (reminderAt !== undefined) {
        const at = reminderAt ? new Date(reminderAt) : null;
        if (!at || isNaN(at.getTime())) return res.status(400).json({ message: 'reminderAt must be a valid date/time' });
        data.reminderAt = at;
      }
      if (contactDisplayName !== undefined) {
        data.contactDisplayName = typeof contactDisplayName === 'string' ? contactDisplayName.trim() || null : null;
      }

      const clearingTemplate = useTemplate === false;
      const settingTemplate =
        useTemplate === true ||
        (typeof templateName === 'string' && templateName.trim().length > 0);
      const optStrOrNull = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

      if (clearingTemplate) {
        data.templateName = null;
        data.templateLanguage = null;
        data.templateParams = null;
        data.headerImageUrl = null;
        data.headerImageId = null;
        data.headerVideoUrl = null;
        data.headerVideoId = null;
        data.headerDocumentUrl = null;
        data.headerDocumentId = null;
        data.whatsappSentAt = null;
        data.whatsappError = null;
        const sessionIdText = typeof sessionId === 'string' ? sessionId.trim() : '';
        const messageForSend = data.message !== undefined ? data.message.trim() : undefined;
        if (sessionIdText && messageForSend) {
          data.sessionId = sessionIdText;
          data.whatsappStatus = 'pending';
        } else if (sessionIdText && messageForSend === undefined) {
          // Keep text-message queue; existing message will be used at send time
          data.sessionId = sessionIdText;
          data.whatsappStatus = 'pending';
        } else {
          data.sessionId = null;
          data.whatsappStatus = 'none';
        }
      } else if (settingTemplate || templateName !== undefined || sessionId !== undefined || templateLanguage !== undefined || templateParams !== undefined || headerImageUrl !== undefined || headerVideoUrl !== undefined) {
        const templateNameText = typeof templateName === 'string' ? templateName.trim() : '';
        const sessionIdText = typeof sessionId === 'string' ? sessionId.trim() : '';
        if (templateName !== undefined) {
          if (!templateNameText) return res.status(400).json({ message: 'templateName cannot be empty' });
          data.templateName = templateNameText;
        }
        if (templateLanguage !== undefined) {
          data.templateLanguage = typeof templateLanguage === 'string' && templateLanguage.trim()
            ? templateLanguage.trim()
            : 'en';
        }
        if (templateParams !== undefined) {
          data.templateParams = Array.isArray(templateParams)
            ? templateParams.map((p: unknown) => String(p ?? ''))
            : [];
        }
        if (sessionId !== undefined) {
          if (!sessionIdText) return res.status(400).json({ message: 'sessionId cannot be empty' });
          data.sessionId = sessionIdText;
        }
        if (headerImageUrl !== undefined) data.headerImageUrl = optStrOrNull(headerImageUrl);
        if (headerImageId !== undefined) data.headerImageId = optStrOrNull(headerImageId);
        if (headerVideoUrl !== undefined) data.headerVideoUrl = optStrOrNull(headerVideoUrl);
        if (headerVideoId !== undefined) data.headerVideoId = optStrOrNull(headerVideoId);
        if (headerDocumentUrl !== undefined) data.headerDocumentUrl = optStrOrNull(headerDocumentUrl);
        if (headerDocumentId !== undefined) data.headerDocumentId = optStrOrNull(headerDocumentId);
        // Re-queue send when template fields change (unless already mid-send)
        data.whatsappStatus = 'pending';
        data.whatsappSentAt = null;
        data.whatsappError = null;
        if (data.message === undefined && data.templateName) {
          data.message = `Template: ${data.templateName}`;
        }
      }

      // Changing the due date/time must re-queue WhatsApp delivery when a send is configured.
      if (data.reminderAt !== undefined && data.whatsappStatus === undefined) {
        const existingRows = await storage.getContactRemindersByOrganization(id, organizationId);
        const existing = existingRows.find((r) => r.id === reminderId);
        if (!existing) return res.status(404).json({ message: 'Reminder not found' });
        const nextSessionId = (data.sessionId !== undefined ? data.sessionId : existing.sessionId) || '';
        const nextTemplate = (data.templateName !== undefined ? data.templateName : existing.templateName) || '';
        const nextMessage = (data.message !== undefined ? data.message : existing.message) || '';
        const canSend =
          !!String(nextSessionId).trim() &&
          (!!String(nextTemplate).trim() || !!String(nextMessage).trim());
        if (canSend && existing.whatsappStatus !== 'sent') {
          data.whatsappStatus = 'pending';
          data.whatsappSentAt = null;
          data.whatsappError = null;
        }
      }

      if (Object.keys(data).length === 0) {
        return res.status(400).json({ message: 'At least one updatable field is required' });
      }
      const reminder = await storage.updateContactReminderByOrganization(reminderId, id, organizationId, data);
      if (!reminder) return res.status(404).json({ message: 'Reminder not found' });
      if (
        reminder.whatsappStatus === "pending" &&
        reminder.sessionId &&
        new Date(reminder.reminderAt).getTime() <= Date.now()
      ) {
        void runReminderWhatsAppCheck();
      }
      res.json(reminder);
    } catch (error: any) {
      console.error('Error updating contact reminder:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/contacts/:id/reminders/:reminderId', ...withOrgContext, requirePermission('reminders.delete'), async (req: any, res) => {
    try {
      const { organizationId } = req.context;
      const { id, reminderId } = req.params;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      await storage.deleteContactReminderByOrganization(reminderId, id, organizationId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting contact reminder:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Approved WhatsApp templates for reminder auto-send picker (reminders permission, not manage_templates)
  app.get('/api/reminders/templates', ...withOrgContext, requirePermission('reminders.view', 'reminders.create', 'reminders.edit'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { organizationId } = req.context;
      const phoneNumberId = req.query.phoneNumberId as string | undefined;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });

      const userSessions = await storage.getSessionsByUser(userId);
      const connectedOfficialPhoneNumberIds = new Set(
        userSessions
          .filter(
            (s: any) =>
              s.connectionType === 'official' &&
              s.status === 'connected' &&
              (!s.organizationId || s.organizationId === organizationId)
          )
          .map((s: any) => s.deviceInfo?.apiPhoneNumberId)
          .filter((id: any) => typeof id === 'string' && id.length > 0)
      );

      let templates = await storage.getMessageTemplatesByOrganization(
        organizationId,
        phoneNumberId && connectedOfficialPhoneNumberIds.has(phoneNumberId) ? phoneNumberId : undefined
      );
      templates = templates.filter((t: any) => {
        if (String(t.status || '').toUpperCase() !== 'APPROVED') return false;
        if (!t.phoneNumberId) return true;
        return connectedOfficialPhoneNumberIds.has(t.phoneNumberId);
      });
      if (phoneNumberId && connectedOfficialPhoneNumberIds.has(phoneNumberId)) {
        templates = templates.filter(
          (t: any) => !t.phoneNumberId || t.phoneNumberId === phoneNumberId
        );
      }
      res.json(templates);
    } catch (error: any) {
      console.error('Error fetching reminder templates:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Due reminders – org-scoped so team members see all org reminders due
  app.get('/api/reminders/due', ...withOrgContext, requirePermission('reminders.view'), async (req: any, res) => {
    try {
      const { organizationId } = req.context;
      if (!organizationId) return res.json([]);
      const due = await storage.getDueRemindersByOrganization(organizationId);
      res.json(due);
    } catch (error: any) {
      console.error('Error fetching due reminders:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Upcoming reminders – org-scoped (today + tomorrow) for reminder panel
  app.get('/api/reminders/upcoming', ...withOrgContext, requirePermission('reminders.view'), async (req: any, res) => {
    try {
      const { organizationId } = req.context;
      if (!organizationId) return res.json([]);
      const upcoming = await storage.getUpcomingRemindersByOrganization(organizationId);
      res.json(upcoming);
    } catch (error: any) {
      console.error('Error fetching upcoming reminders:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // All reminders – org-scoped list (optional from, to, search, reminderTo)
  const getRemindersListHandler = async (req: any, res: any) => {
    try {
      const { organizationId } = req.context;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const from = typeof req.query?.from === 'string' ? req.query.from : undefined;
      const to = typeof req.query?.to === 'string' ? req.query.to : undefined;
      const search = typeof req.query?.search === 'string' ? req.query.search : undefined;
      const reminderTo = typeof req.query?.reminderTo === 'string' ? req.query.reminderTo : undefined;
      const filters = { dateFrom: from, dateTo: to, search, reminderTo };
      const list = await storage.getAllRemindersByOrganization(organizationId, filters);
      res.json(list);
    } catch (error: any) {
      console.error('Error fetching reminders list:', error);
      res.status(500).json({ error: error.message });
    }
  };
  app.get('/api/reminders/list', ...withOrgContext, requirePermission('reminders.view'), getRemindersListHandler);
  app.get('/api/reminders', ...withOrgContext, requirePermission('reminders.view'), getRemindersListHandler);

  // Bulk assign contacts to user (MUST come before /api/contacts/:id/assign to avoid route conflict)
  app.post('/api/contacts/bulk/assign', ...withOrgContext, requirePermission('manage_contacts.edit'), async (req: any, res) => {
    try {
      console.log('[Bulk Assign] Request received:', { body: req.body });
      const userId = getUserId(req);
      const { organizationId } = req.context;
      
      if (!organizationId) {
        console.error('[Bulk Assign] No organizationId in context');
        return res.status(400).json({ message: 'Organization context is required' });
      }
      
      const { contactIds, assignedToUserId } = req.body;
      
      if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ message: 'contactIds array is required' });
      }

      if (!assignedToUserId) {
        return res.status(400).json({ message: 'assignedToUserId is required' });
      }

      // Verify the assigned user is a member of the organization
      const member = await storage.getOrganizationMember(organizationId, assignedToUserId);
      if (!member) {
        console.warn('[Bulk Assign] User is not a member of organization:', { organizationId, assignedToUserId });
        return res.status(403).json({ message: 'User is not a member of this organization' });
      }

      const assignedAt = new Date().toISOString();
      const results = [];

      for (const contactId of contactIds) {
        try {
          // First try with the current user's context
          let contact = await storage.getManagedContact(contactId, userId, organizationId);
          
          // If not found, check if contact exists in the organization (might belong to another user)
          if (!contact) {
            const [orgContact] = await db
              .select()
              .from(managedContacts)
              .where(and(
                eq(managedContacts.id, contactId),
                eq(managedContacts.organizationId, organizationId)
              ))
              .limit(1);
            
            if (orgContact) {
              // Contact exists in organization, use it for assignment
              contact = orgContact;
            }
          }
          
          if (contact) {
            const customFields = contact.customFields || {};
            customFields.assignedTo = assignedToUserId;
            customFields.assignedAt = assignedAt;
            customFields.assignedBy = userId;

            // Update contact - use the contact's original userId for the update
            const updated = await storage.updateManagedContact(
              contactId,
              contact.userId,
              organizationId,
              {
                customFields: customFields as any,
              },
              { skipAutomation: true }
            );
            if (updated) {
              results.push({ contactId, success: true });
            } else {
              results.push({ contactId, success: false, error: 'Failed to update contact' });
            }
          } else {
            console.warn(`[Bulk Assign] Contact not found:`, { contactId, userId, organizationId });
            results.push({ contactId, success: false, error: 'Contact not found' });
          }
        } catch (error: any) {
          console.error(`[Bulk Assign] Error assigning contact ${contactId}:`, error);
          results.push({ contactId, success: false, error: error.message });
        }
      }

      const successCount = results.filter(r => r.success).length;
      console.log(`[Bulk Assign] Completed: ${successCount}/${contactIds.length} successful`);
      return res.json({ results, successCount });
    } catch (error: any) {
      console.error('[Bulk Assign] Error bulk assigning contacts:', error);
      return res.status(500).json({ error: error.message });
    }
  });


  // Bulk delete contacts (MUST come before /api/contacts/:id routes to avoid route conflict)
  // Sync managed contacts from chats (background sync)
  app.post('/api/contacts/sync-from-chats', ...withOrgContext, requirePermission('manage_contacts.import'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { organizationId } = req.context;
      
      console.log('[Contacts Sync] Starting sync from chats for user:', userId, 'organization:', organizationId);
      
      // Get all sessions for this user
      const sessions = await storage.getSessionsByUser(userId);
      console.log('[Contacts Sync] Found', sessions.length, 'sessions');
      
      // Get existing managed contacts
      const existingManagedContacts = await storage.getManagedContactsByUser(userId, organizationId);
      const managedContactsByPhone = new Map<string, typeof existingManagedContacts[0]>();
      
      // Index managed contacts by normalized phone number
      existingManagedContacts.forEach(mc => {
        const normalizedPhone = mc.phoneNumber.replace(/[^\d]/g, '');
        if (!managedContactsByPhone.has(normalizedPhone)) {
          managedContactsByPhone.set(normalizedPhone, mc);
        }
      });
      
      let createdCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      const errors: Array<{ chatId: string; error: string }> = [];
      
      // Process all chats from all sessions
      for (const session of sessions) {
        try {
          const chats = await storage.getChatsBySession(session.sessionId);
          console.log('[Contacts Sync] Processing', chats.length, 'chats from session:', session.sessionId);
          
          for (const chat of chats) {
            try {
              // Skip groups
              if (chat.isGroup) {
                skippedCount++;
                continue;
              }
              
              // Normalize phone number (remove @c.us, @g.us, +, and non-digits)
              const normalizedPhone = normalizePhoneNumber(chat.contactNumber).replace(/[^\d]/g, '');
              
              if (!normalizedPhone || normalizedPhone.length < 10) {
                skippedCount++;
                continue;
              }
              
              // Check if managed contact already exists
              const existingManagedContact = managedContactsByPhone.get(normalizedPhone);
              
              if (!existingManagedContact) {
                // Create new managed contact (respect plan contact limit)
                const quota = await assertPlanQuota({ userId, organizationId, kind: "contacts" });
                if (quota) {
                  skippedCount++;
                  errors.push({ chatId: chat.id, error: quota.body.message });
                  continue;
                }
                const contactName = chat.contactName && chat.contactName !== normalizedPhone
                  ? chat.contactName
                  : normalizedPhone;
                
                await storage.createManagedContact(
                  {
                    userId,
                    organizationId: organizationId || undefined,
                    name: contactName,
                    phoneNumber: normalizedPhone,
                    source: "whatsapp",
                  },
                  { skipAutomation: true }
                );
                
                // Add to map to avoid duplicates in same sync
                managedContactsByPhone.set(normalizedPhone, {
                  id: '', // Not needed for map lookup
                  userId,
                  organizationId: organizationId || '',
                  phoneNumber: normalizedPhone,
                  name: contactName,
                  email: null,
                  source: 'whatsapp',
                  customFields: null,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                } as any);
                
                createdCount++;
                console.log('[Contacts Sync] ✅ Created managed contact:', contactName, normalizedPhone);
              } else if (existingManagedContact.source !== 'whatsapp') {
                // Update source to 'whatsapp' if it's different
                await storage.updateManagedContact(
                  existingManagedContact.id,
                  userId,
                  organizationId || undefined,
                  { source: "whatsapp" },
                  { skipAutomation: true }
                );
                updatedCount++;
                console.log('[Contacts Sync] ✅ Updated managed contact source to "whatsapp":', existingManagedContact.id);
              } else {
                skippedCount++;
              }
            } catch (chatError: any) {
              console.error('[Contacts Sync] ❌ Error processing chat:', chat.id, chatError.message);
              errors.push({ chatId: chat.id, error: chatError.message });
            }
          }
        } catch (sessionError: any) {
          console.error('[Contacts Sync] ❌ Error processing session:', session.sessionId, sessionError.message);
          errors.push({ chatId: session.sessionId, error: `Session error: ${sessionError.message}` });
        }
      }
      
      console.log('[Contacts Sync] ✅ Sync completed:', {
        created: createdCount,
        updated: updatedCount,
        skipped: skippedCount,
        errors: errors.length,
      });
      
      res.json({
        success: true,
        stats: {
          created: createdCount,
          updated: updatedCount,
          skipped: skippedCount,
          errors: errors.length,
        },
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error: any) {
      console.error('[Contacts Sync] ❌ Error syncing contacts from chats:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Helper function to parse CSV properly handling quoted values
  function parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim().replace(/^"|"$/g, ''));
    return values;
  }

  // Step 1: Parse CSV headers
  app.post('/api/contacts/import/parse-headers', ...withOrgContext, requirePermission('manage_contacts.import'), upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      const fileBuffer = req.file.buffer;
      const fileContent = fileBuffer.toString('utf-8');
      
      // Parse CSV
      const lines = fileContent.split('\n').filter(line => line.trim());
      if (lines.length < 1) {
        return res.status(400).json({ error: 'CSV file must contain at least a header row' });
      }
      
      // Parse header row
      const headers = parseCSVLine(lines[0]);
      
      if (!headers || headers.length === 0) {
        return res.status(400).json({ error: 'CSV file must contain valid column headers' });
      }
      
      res.json({
        success: true,
        headers: headers,
      });
    } catch (error: any) {
      console.error('[Contacts Import] ❌ Error parsing headers:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Step 2: Validate data based on mappings
  app.post('/api/contacts/import/validate', ...withOrgContext, requirePermission('manage_contacts.import'), upload.single('file'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { organizationId } = req.context;
      
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      let mappings;
      try {
        mappings = typeof req.body.mappings === 'string' ? JSON.parse(req.body.mappings) : req.body.mappings || [];
      } catch (e) {
        return res.status(400).json({ error: 'Invalid mappings format' });
      }
      if (!Array.isArray(mappings) || mappings.length === 0) {
        return res.status(400).json({ error: 'Invalid mappings provided' });
      }
      
      const fileBuffer = req.file.buffer;
      const fileContent = fileBuffer.toString('utf-8');
      
      // Parse CSV
      const lines = fileContent.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        return res.status(400).json({ error: 'CSV file must contain at least a header row and one data row' });
      }
      
      // Parse header row
      const csvHeaders = parseCSVLine(lines[0]);
      
      // Create mapping from field to CSV column index
      const fieldToIndex = new Map<string, number>();
      mappings.forEach((mapping: any) => {
        if (mapping.csvHeader) {
          const index = csvHeaders.findIndex(h => h === mapping.csvHeader);
          if (index !== -1) {
            fieldToIndex.set(mapping.field, index);
          }
        }
      });
      
      // Check required fields are mapped
      const requiredFields = mappings.filter((m: any) => m.required);
      const unmappedRequired = requiredFields.filter((m: any) => !fieldToIndex.has(m.field));
      if (unmappedRequired.length > 0) {
        return res.status(400).json({ 
          error: `Required fields not mapped: ${unmappedRequired.map((m: any) => m.field).join(', ')}` 
        });
      }

      // Duplicate check: only within the CSV file (same number appearing more than once).
      // Contacts already in DB are NOT flagged here; import step will skip/update them.

      // Email validation regex (standard)
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      let validCount = 0;
      let invalidCount = 0;
      let duplicateContactNumbers = 0;
      let invalidEmailAddresses = 0;
      let invalidTextFields = 0;
      let invalidContactNumbers = 0;
      const errors: Array<{ row: number; error: string; category?: string }> = [];
      const warnings: Array<{ row: number; message: string }> = [];
      const phonesSeenInFile = new Map<string, number>(); // normalized phone -> first row index

      // Validate data rows
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        let rowValid = true;
        const rowErrors: string[] = [];
        let category: 'duplicate' | 'invalid_phone' | 'invalid_email' | 'invalid_text' | null = null;

        const phoneIndex = fieldToIndex.get('phone');
        const nameIndex = fieldToIndex.get('name');
        const emailIndex = fieldToIndex.get('email');

        // --- Phone number (required) ---
        let normalizedPhone = '';
        if (phoneIndex !== undefined && phoneIndex < values.length) {
          let phoneNumber = values[phoneIndex]?.trim() || '';

          if (/[eE]/.test(phoneNumber) && /^[\d.eE+-]+$/.test(phoneNumber)) {
            const num = parseFloat(phoneNumber);
            if (!Number.isNaN(num) && num >= 1e9 && num < 1e16) {
              phoneNumber = String(Math.round(num));
              warnings.push({ row: i + 1, message: 'Phone number was in scientific notation and was converted.' });
            } else {
              rowValid = false;
              rowErrors.push('Phone number was converted to scientific notation by Excel. Format the Phone Number column as Text and re-export.');
              category = 'invalid_phone';
            }
          }

          if (rowValid) {
            normalizedPhone = phoneNumber.replace(/[^\d]/g, '');
            if (normalizedPhone.length < 10) {
              rowValid = false;
              rowErrors.push('Invalid phone number format. Phone number must include country code (e.g. 917599808080 for India).');
              category = 'invalid_phone';
            } else if (normalizedPhone.length > 15) {
              rowValid = false;
              rowErrors.push('Invalid phone number format (too long).');
              category = 'invalid_phone';
            }
          }
        } else {
          rowValid = false;
          rowErrors.push('Phone number is required but not mapped.');
          category = 'invalid_phone';
        }

        // --- Duplicate: only within file (same number appears more than once in CSV) ---
        if (rowValid && normalizedPhone) {
          const firstRow = phonesSeenInFile.get(normalizedPhone);
          if (firstRow !== undefined) {
            rowValid = false;
            category = 'duplicate';
            rowErrors.push(`Duplicate contact number (same number as row ${firstRow}).`);
          } else {
            phonesSeenInFile.set(normalizedPhone, i + 1);
          }
        }

        // --- Name (required) - invalid text ---
        if (rowValid) {
          const hasName = nameIndex !== undefined && nameIndex < values.length && (values[nameIndex]?.trim() || '').length > 0;
          const hasPhone = phoneIndex !== undefined && phoneIndex < values.length && (values[phoneIndex]?.trim() || '').length > 0;
          if (!hasName && !hasPhone) {
            rowValid = false;
            if (!category) category = 'invalid_text';
            rowErrors.push('Contact name is required. If not available, map phone number column as name.');
          }
        }

        // --- Email format (optional but validate if present) ---
        if (rowValid && emailIndex !== undefined && emailIndex < values.length) {
          const email = (values[emailIndex] || '').trim();
          if (email && !emailRegex.test(email)) {
            rowValid = false;
            if (!category) category = 'invalid_email';
            rowErrors.push('Invalid email address format.');
          }
        }

        if (rowValid) {
          validCount++;
        } else {
          invalidCount++;
          if (category === 'duplicate') duplicateContactNumbers++;
          else if (category === 'invalid_phone') invalidContactNumbers++;
          else if (category === 'invalid_email') invalidEmailAddresses++;
          else invalidTextFields++;
          errors.push({ row: i + 1, error: rowErrors.join(' '), category: category || undefined });
        }
      }

      res.json({
        success: true,
        valid: validCount,
        invalid: invalidCount,
        total: lines.length - 1,
        duplicateContactNumbers,
        invalidEmailAddresses,
        invalidTextFields,
        invalidContactNumbers,
        errors: errors.slice(0, 100),
        warnings: warnings.slice(0, 50),
      });
    } catch (error: any) {
      console.error('[Contacts Import] ❌ Error validating data:', error);
      res.status(500).json({ error: error.message });
    }
  });

      // Step 3: Final import with mappings
  app.post('/api/contacts/import/final', ...withOrgContext, requirePermission('manage_contacts.import'), upload.single('file'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { organizationId } = req.context;
      
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      let mappings;
      try {
        mappings = typeof req.body.mappings === 'string' ? JSON.parse(req.body.mappings) : req.body.mappings || [];
      } catch (e) {
        return res.status(400).json({ error: 'Invalid mappings format' });
      }
      if (!Array.isArray(mappings) || mappings.length === 0) {
        return res.status(400).json({ error: 'Invalid mappings provided' });
      }
      
      const orgId = organizationId || '';
      const fileBuffer = req.file.buffer;
      const fileContent = fileBuffer.toString('utf-8');
      
      // Parse CSV
      const lines = fileContent.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        return res.status(400).json({ error: 'CSV file must contain at least a header row and one data row' });
      }
      
      // Parse header row
      const csvHeaders = parseCSVLine(lines[0]);
      
      // Create mapping from field to CSV column index
      const fieldToIndex = new Map<string, number>();
      mappings.forEach((mapping: any) => {
        if (mapping.csvHeader) {
          const index = csvHeaders.findIndex(h => h === mapping.csvHeader);
          if (index !== -1) {
            fieldToIndex.set(mapping.field, index);
          }
        }
      });
      
      // Get tags for tag mapping
      const allTags = await storage.getContactTagsByUser(userId, orgId);
      const tagNameToEntry = new Map<string, { id: string; name: string }>();
      allTags.forEach((t: { id: string; name: string }) => {
        if (!t.name) return;
        const key = t.name.trim().toLowerCase();
        const existing = tagNameToEntry.get(key);
        const preferThis = !existing || (t.name !== t.name.toLowerCase() && existing.name === existing.name.toLowerCase());
        if (preferThis) tagNameToEntry.set(key, { id: t.id, name: t.name.trim() });
      });
      const tagNameToId = new Map<string, string>();
      tagNameToEntry.forEach((v, k) => tagNameToId.set(k, v.id));
      
      // Get existing managed contacts for duplicate checking
      const existingManagedContacts = await storage.getManagedContactsByUser(userId, organizationId);
      const managedContactsByPhone = new Map<string, typeof existingManagedContacts[0]>();
      
      existingManagedContacts.forEach(mc => {
        const normalizedPhone = mc.phoneNumber.replace(/[^\d]/g, '');
        if (!managedContactsByPhone.has(normalizedPhone)) {
          managedContactsByPhone.set(normalizedPhone, mc);
        }
      });
      
      let successCount = 0;
      let errorCount = 0;
      const importedContactIds: string[] = [];
      const processedPhoneNumbers: string[] = [];
      const processedContacts: Array<{ id: string; phoneNumber: string; name: string }> = [];
      const errors: Array<{ row: number; error: string }> = [];
      const warnings: Array<{ row: number; message: string }> = [];
      
      // Process data rows
      for (let i = 1; i < lines.length; i++) {
        try {
          const values = parseCSVLine(lines[i]);
          
          // Extract values based on mappings
          const phoneIndex = fieldToIndex.get('phone');
          const nameIndex = fieldToIndex.get('name');
          const emailIndex = fieldToIndex.get('email');
          const tagsIndex = fieldToIndex.get('tags');
          const statusIndex = fieldToIndex.get('status');
          const wabaPhoneIndex = fieldToIndex.get('wabaPhoneNumber');
          const formNameIndex = fieldToIndex.get('formName');
          const pageNameIndex = fieldToIndex.get('pageName');
          const cityIndex = fieldToIndex.get('city');
          const usingWhatsappToolIndex = fieldToIndex.get('usingWhatsappTool');
          const businessOwnerIndex = fieldToIndex.get('businessOwner');
          const areYouAIndex = fieldToIndex.get('areYouA');
          const pricingIndex = fieldToIndex.get('pricing');
          
          const phoneNumber = phoneIndex !== undefined && phoneIndex < values.length ? values[phoneIndex]?.trim() || '' : '';
          let name = nameIndex !== undefined && nameIndex < values.length ? values[nameIndex]?.trim() || '' : '';
          const email = emailIndex !== undefined && emailIndex < values.length ? values[emailIndex]?.trim() || '' : '';
          const tagNamesRaw = tagsIndex !== undefined && tagsIndex < values.length && values[tagsIndex] != null ? String(values[tagsIndex]).trim() : '';
          const tagNames = tagNamesRaw ? tagNamesRaw.split(/[;,]/).map((s: string) => s.trim()).filter(Boolean) : [];
          const rowTagIds = tagNames.map((tagName: string) => tagNameToId.get(tagName.toLowerCase())).filter(Boolean) as string[];

          // Build custom fields
          const customFields: Record<string, any> = {};
          if (statusIndex !== undefined && statusIndex < values.length && values[statusIndex]) {
            customFields.status = values[statusIndex].trim();
          }
          if (wabaPhoneIndex !== undefined && wabaPhoneIndex < values.length && values[wabaPhoneIndex]) {
            customFields.wabaPhoneNumber = values[wabaPhoneIndex].trim();
          }
          if (formNameIndex !== undefined && formNameIndex < values.length && values[formNameIndex]) {
            customFields.formName = values[formNameIndex].trim();
          }
          if (pageNameIndex !== undefined && pageNameIndex < values.length && values[pageNameIndex]) {
            customFields.pageName = values[pageNameIndex].trim();
          }
          if (cityIndex !== undefined && cityIndex < values.length && values[cityIndex]) {
            customFields.city = values[cityIndex].trim();
          }
          if (usingWhatsappToolIndex !== undefined && usingWhatsappToolIndex < values.length && values[usingWhatsappToolIndex]) {
            customFields.usingWhatsappTool = values[usingWhatsappToolIndex].trim();
          }
          if (businessOwnerIndex !== undefined && businessOwnerIndex < values.length && values[businessOwnerIndex]) {
            customFields.businessOwner = values[businessOwnerIndex].trim();
          }
          if (areYouAIndex !== undefined && areYouAIndex < values.length && values[areYouAIndex]) {
            customFields.areYouA = values[areYouAIndex].trim();
          }
          if (pricingIndex !== undefined && pricingIndex < values.length && values[pricingIndex]) {
            const pricingValue = values[pricingIndex].trim();
            const pricingNum = parseFloat(pricingValue);
            if (!Number.isNaN(pricingNum)) {
              customFields.pricing = pricingNum;
            } else {
              customFields.pricing = pricingValue;
            }
          }
          
          if (!phoneNumber) {
            errorCount++;
            errors.push({ row: i + 1, error: 'Phone number is required' });
            continue;
          }
          
          let rawPhone = String(phoneNumber).trim();
          // Handle scientific notation from Excel
          if (/[eE]/.test(rawPhone) && /^[\d.eE+-]+$/.test(rawPhone)) {
            const num = parseFloat(rawPhone);
            if (!Number.isNaN(num) && num >= 1e9 && num < 1e16) {
              rawPhone = String(Math.round(num));
              warnings.push({
                row: i + 1,
                message: 'Phone number was in scientific notation and was converted.',
              });
            } else {
              errorCount++;
              errors.push({
                row: i + 1,
                error: 'Phone number was converted to scientific notation by Excel. Format the Phone Number column as Text and re-export.',
              });
              continue;
            }
          }
          
          const normalizedPhone = rawPhone.replace(/[^\d]/g, '');
          
          if (normalizedPhone.length < 10) {
            errorCount++;
            errors.push({
              row: i + 1,
              error: 'Invalid phone number format. Use digits only with country code (e.g. 917599808080).',
            });
            continue;
          }
          if (normalizedPhone.length > 15) {
            errorCount++;
            errors.push({ row: i + 1, error: 'Invalid phone number format (too long)' });
            continue;
          }
          
          // Check if contact already exists
          const existingContact = managedContactsByPhone.get(normalizedPhone);
          
          if (existingContact) {
            // Update existing contact — only overwrite name when CSV provides a real name
            const updateData: any = {};
            if (name && name !== existingContact.name) {
              updateData.name = name;
            }
            if (email && email !== existingContact.email) {
              updateData.email = email;
            }
            if (Object.keys(customFields).length > 0) {
              updateData.customFields = { ...(existingContact.customFields || {}), ...customFields };
            }
            
            if (Object.keys(updateData).length > 0) {
              await storage.updateManagedContact(
                existingContact.id,
                userId,
                organizationId || undefined,
                updateData
              );
              if (updateData.name) {
                existingContact.name = updateData.name;
              }
              if (updateData.email !== undefined) {
                existingContact.email = updateData.email;
              }
              if (updateData.customFields) {
                existingContact.customFields = updateData.customFields;
              }
            }
            if (rowTagIds.length > 0) {
              for (const tagId of rowTagIds) {
                try {
                  await storage.assignTagToContact(existingContact.id, tagId, userId, orgId);
                } catch (tagError: any) {
                  console.warn(`[Contacts Import] Could not assign tag ${tagId} to contact ${existingContact.id}:`, tagError?.message);
                }
              }
            }
            processedPhoneNumbers.push(normalizedPhone);
            processedContacts.push({
              id: existingContact.id,
              phoneNumber: normalizedPhone,
              name: existingContact.name || name || normalizedPhone,
            });
            // Skip counting as success for updates
            continue;
          }
          
          // Create new contact (respect plan contact limit)
          const quota = await assertPlanQuota({ userId, organizationId: orgId, kind: "contacts" });
          if (quota) {
            errorCount++;
            errors.push({ row: i + 1, error: quota.body.message });
            continue;
          }
          const contactName = name || normalizedPhone;
          const newContact = await storage.createManagedContact({
            userId,
            organizationId: organizationId || undefined,
            name: contactName,
            phoneNumber: normalizedPhone,
            email: email || undefined,
            source: "import",
            customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
          });
          importedContactIds.push(newContact.id);
          processedPhoneNumbers.push(normalizedPhone);
          processedContacts.push({
            id: newContact.id,
            phoneNumber: normalizedPhone,
            name: newContact.name || contactName,
          });

          if (rowTagIds.length > 0) {
            for (const tagId of rowTagIds) {
              try {
                await storage.assignTagToContact(newContact.id, tagId, userId, orgId);
              } catch (tagError: any) {
                console.warn(`[Contacts Import] Could not assign tag ${tagId} to contact ${newContact.id}:`, tagError?.message);
              }
            }
          }
          
          // Add to map to avoid duplicates in same import
          managedContactsByPhone.set(normalizedPhone, {
            id: newContact.id,
            userId,
            organizationId: organizationId || '',
            phoneNumber: normalizedPhone,
            name: contactName,
            email: email || undefined,
            source: 'import',
            customFields: customFields,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as any);
          
          successCount++;
        } catch (rowError: any) {
          errorCount++;
          errors.push({ row: i + 1, error: rowError.message || 'Failed to process row' });
        }
      }
      
      console.log('[Contacts Import] ✅ Import completed:', {
        success: successCount,
        errors: errorCount,
        total: lines.length - 1,
      });
      
      res.json({
        success: true,
        successCount,
        errorCount,
        importedContactIds,
        processedPhoneNumbers,
        processedContacts,
        totalRows: lines.length - 1,
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
      });
    } catch (error: any) {
      console.error('[Contacts Import] ❌ Error importing contacts:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Import contacts from CSV (legacy endpoint - kept for backward compatibility)
  app.post('/api/contacts/import', ...withOrgContext, requirePermission('manage_contacts.import'), upload.single('file'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { organizationId } = req.context;
      
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      const orgId = organizationId || '';
      const fileBuffer = req.file.buffer;
      const fileContent = fileBuffer.toString('utf-8');
      
      // Parse CSV
      const lines = fileContent.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        return res.status(400).json({ error: 'CSV file must contain at least a header row and one data row' });
      }
      
      // Parse header (strip surrounding quotes so "Name" and Name both work)
      const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
      const nameIndex = header.findIndex(h => h === 'name');
      const phoneIndex = header.findIndex(h => h === 'phone number' || h === 'phonenumber' || h === 'phone');
      const emailIndex = header.findIndex(h => h === 'email');
      const sourceIndex = header.findIndex(h => h === 'source');
      const tagsIndex = header.findIndex(h => h === 'tags' || h === 'tag');
      const allTags = await storage.getContactTagsByUser(userId, orgId);
      // Map lowercase tag name -> { id, name }. Prefer existing tag with canonical casing (e.g. "Demo Done" over "demo done") so import matches consistently.
      const tagNameToEntry = new Map<string, { id: string; name: string }>();
      allTags.forEach((t: { id: string; name: string }) => {
        if (!t.name) return;
        const key = t.name.trim().toLowerCase();
        const existing = tagNameToEntry.get(key);
        const preferThis = !existing || (t.name !== t.name.toLowerCase() && existing.name === existing.name.toLowerCase());
        if (preferThis) tagNameToEntry.set(key, { id: t.id, name: t.name.trim() });
      });
      const tagNameToId = new Map<string, string>();
      tagNameToEntry.forEach((v, k) => tagNameToId.set(k, v.id));
      if (phoneIndex === -1) {
        return res.status(400).json({ error: 'CSV must contain a "Phone Number" column' });
      }
      
      if (nameIndex === -1) {
        return res.status(400).json({ error: 'CSV must contain a "Name" column' });
      }
      
      // Get existing managed contacts for duplicate checking
      const existingManagedContacts = await storage.getManagedContactsByUser(userId, organizationId);
      const managedContactsByPhone = new Map<string, typeof existingManagedContacts[0]>();
      
      existingManagedContacts.forEach(mc => {
        const normalizedPhone = mc.phoneNumber.replace(/[^\d]/g, '');
        if (!managedContactsByPhone.has(normalizedPhone)) {
          managedContactsByPhone.set(normalizedPhone, mc);
        }
      });
      
      let successCount = 0;
      let errorCount = 0;
      const importedContactIds: string[] = [];
      const errors: Array<{ row: number; error: string }> = [];
      const warnings: Array<{ row: number; message: string }> = [];
      
      // Parse data rows
      for (let i = 1; i < lines.length; i++) {
        try {
          const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          
          if (values.length < header.length) {
            // Handle CSV with commas in quoted values
            // Simple approach: try to parse properly
            const properValues: string[] = [];
            let current = '';
            let inQuotes = false;
            
            for (let j = 0; j < lines[i].length; j++) {
              const char = lines[i][j];
              if (char === '"') {
                inQuotes = !inQuotes;
              } else if (char === ',' && !inQuotes) {
                properValues.push(current.trim());
                current = '';
              } else {
                current += char;
              }
            }
            properValues.push(current.trim());
            
            if (properValues.length >= header.length) {
              values.length = 0;
              values.push(...properValues);
            }
          }
          
          const name = values[nameIndex] || '';
          const phoneNumber = values[phoneIndex] || '';
          const email = emailIndex !== -1 ? (values[emailIndex] || '') : '';
          const sourceRaw = (sourceIndex >= 0 && values[sourceIndex] != null) ? String(values[sourceIndex]).trim() : 'import';
          const canonicalSources = ['manual', 'whatsapp', 'facebook', 'import', 'api', 'indiamart', 'google_ads', 'linkedin', 'website'];
          const source = canonicalSources.includes(sourceRaw.toLowerCase()) ? sourceRaw.toLowerCase() : (sourceRaw || 'import');
          const tagNamesRaw = (tagsIndex >= 0 && values[tagsIndex] != null) ? String(values[tagsIndex]).trim() : '';
          const tagNames = tagNamesRaw ? tagNamesRaw.split(/[;,]/).map((s: string) => s.trim()).filter(Boolean) : [];
          const rowTagIds = tagNames.map((tagName: string) => tagNameToId.get(tagName.toLowerCase())).filter(Boolean) as string[];
          if (!phoneNumber) {
            errorCount++;
            errors.push({ row: i + 1, error: 'Phone number is required' });
            continue;
          }
          
          let rawPhone = String(phoneNumber).trim();
          // Excel often converts long numbers to scientific notation (e.g. 917869175526 → 9.17869E+11). Try to recover.
          if (/[eE]/.test(rawPhone) && /^[\d.eE+-]+$/.test(rawPhone)) {
            const num = parseFloat(rawPhone);
            if (!Number.isNaN(num) && num >= 1e9 && num < 1e16) {
              rawPhone = String(Math.round(num));
              warnings.push({
                row: i + 1,
                message: 'Phone number was in scientific notation and was converted. If digits look wrong, format the column as Text in Excel and re-export.',
              });
            } else {
              errorCount++;
              errors.push({
                row: i + 1,
                error: 'Phone number was converted to scientific notation by Excel. Format the Phone Number column as Text (e.g. 917869175526) and re-export the CSV.',
              });
              continue;
            }
          }
          
          const normalizedPhone = rawPhone.replace(/[^\d]/g, '');
          
          if (normalizedPhone.length < 10) {
            errorCount++;
            errors.push({
              row: i + 1,
              error: 'Invalid phone number format. Use digits only with country code (e.g. 917869175526).',
            });
            continue;
          }
          if (normalizedPhone.length > 15) {
            errorCount++;
            errors.push({ row: i + 1, error: 'Invalid phone number format (too long)' });
            continue;
          }
          
          // Check if contact already exists
          const existingContact = managedContactsByPhone.get(normalizedPhone);
          
          if (existingContact) {
            // Update existing contact if needed
            const updateData: any = {};
            if (name && name !== existingContact.name) {
              updateData.name = name;
            }
            if (email && email !== existingContact.email) {
              updateData.email = email;
            }
            if (source && source !== existingContact.source) {
              updateData.source = source;
            }
            
            if (Object.keys(updateData).length > 0) {
              await storage.updateManagedContact(
                existingContact.id,
                userId,
                organizationId || undefined,
                updateData
              );
            }
            if (rowTagIds.length > 0) {
              for (const tagId of rowTagIds) {
                try {
                  await storage.assignTagToContact(existingContact.id, tagId, userId, orgId);
                } catch (tagError: any) {
                  // Ignore duplicate tag assignment errors
                  console.warn(`[Contacts Import] Could not assign tag ${tagId} to contact ${existingContact.id}:`, tagError.message);
                }
              }
            }
            // Don't increment success count for updates, just skip
            continue;
          }
          
          // Create new contact
          const newContact = await storage.createManagedContact({
            userId,
            organizationId: organizationId || undefined,
            name: name || normalizedPhone,
            phoneNumber: normalizedPhone,
            email: email || undefined,
            source: source || "import",
          });
          importedContactIds.push(newContact.id);
          
          if (rowTagIds.length > 0) {
            for (const tagId of rowTagIds) {
              try {
                await storage.assignTagToContact(newContact.id, tagId, userId, orgId);
              } catch (tagError: any) {
                // Ignore duplicate tag assignment errors
                console.warn(`[Contacts Import] Could not assign tag ${tagId} to contact ${newContact.id}:`, tagError.message);
              }
            }
          }
          
          // Add to map to avoid duplicates in same import
          managedContactsByPhone.set(normalizedPhone, {
            id: newContact.id,
            userId,
            organizationId: organizationId || '',
            phoneNumber: normalizedPhone,
            name: name || normalizedPhone,
            email: email || undefined,
            source: source || 'import',
            customFields: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as any);
          
          successCount++;
        } catch (rowError: any) {
          errorCount++;
          errors.push({ row: i + 1, error: rowError.message || 'Failed to process row' });
        }
      }
      
      console.log('[Contacts Import] ✅ Import completed:', {
        success: successCount,
        errors: errorCount,
        total: lines.length - 1,
      });
      
      res.json({
        success: true,
        successCount,
        errorCount,
        importedContactIds,
        totalRows: lines.length - 1,
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // Return first 10 errors
        warnings: warnings.length > 0 ? warnings : undefined,
      });
    } catch (error: any) {
      console.error('[Contacts Import] ❌ Error importing contacts:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/contacts/bulk/delete', ...withOrgContext, requirePermission('manage_contacts.delete'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { organizationId } = req.context;
      const { contactIds } = req.body;
      
      if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ message: 'contactIds array is required' });
      }

      const results = [];

      for (const contactId of contactIds) {
        try {
          await storage.deleteManagedContact(contactId, userId, organizationId);
          results.push({ contactId, success: true });
        } catch (error: any) {
          results.push({ contactId, success: false, error: error.message });
        }
      }

      res.json({ results, successCount: results.filter(r => r.success).length });
    } catch (error: any) {
      console.error('Error bulk deleting contacts:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Opt Keywords API
  app.get('/api/opt-keywords', ...withOrgContext, requirePermission('opts_management.view'), async (req: any, res) => {
    try {
      const { organizationId } = req.context;
      const { type } = req.query;
      
      if (!type || (type !== 'opt_in' && type !== 'opt_out')) {
        return res.status(400).json({ message: 'Type must be opt_in or opt_out' });
      }
      
      const keywords = await storage.getOptKeywordsByOrganization(organizationId, type);
      res.json(keywords);
    } catch (error: any) {
      console.error('Error getting opt keywords:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/opt-keywords', ...withOrgContext, requirePermission('opts_management.edit', 'opts_management.create'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { organizationId } = req.context;
      const { type, keywords } = req.body;
      
      if (!type || (type !== 'opt_in' && type !== 'opt_out')) {
        return res.status(400).json({ message: 'Type must be opt_in or opt_out' });
      }
      
      if (!Array.isArray(keywords)) {
        return res.status(400).json({ message: 'Keywords must be an array' });
      }
      
      // Validate keywords (max 12 characters, no duplicates)
      const trimmedKeywords = keywords.map((k: string) => k.trim()).filter((k: string) => k.length > 0);
      const uniqueKeywords = [...new Set(trimmedKeywords)];
      
      if (uniqueKeywords.length > 30) {
        return res.status(400).json({ message: 'Maximum 30 keywords allowed' });
      }
      
      for (const keyword of uniqueKeywords) {
        if (keyword.length > 12) {
          return res.status(400).json({ message: `Keyword "${keyword}" must be 12 characters or less` });
        }
      }
      
      const result = await storage.updateOptKeywordsByOrganization(organizationId, type, uniqueKeywords, userId);
      res.json(result);
    } catch (error: any) {
      console.error('Error updating opt keywords:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Contact Columns API
  app.get('/api/columns', ...withOrgContext, requirePermission('columns.view'), async (req: any, res) => {
    try {
      const { organizationId } = req.context;
      if (isPaginatedListRequest(req.query)) {
        const pagination = listPaginationFromRequest(req);
        const search = parseListSearch(req.query);
        const result = await storage.listContactColumnsByOrganization(organizationId, { search, ...pagination });
        return res.json(buildPaginatedResponse("columns", result));
      }
      const columns = await storage.getContactColumnsByOrganization(organizationId);
      res.json(columns);
    } catch (error: any) {
      console.error('Error getting columns:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Chatbots API
  app.get('/api/chatbots', ...withOrgContext, requirePermission('chatbot.view'), async (req: any, res) => {
    try {
      const { organizationId } = req.context;
      const chatbots = organizationId
        ? await storage.getChatbotsByOrganization(organizationId)
        : await storage.getChatbots(getUserId(req), organizationId);
      res.json(chatbots);
    } catch (error: any) {
      console.error('Error getting chatbots:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/chatbots', ...withOrgContext, requirePermission('chatbot.create'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { organizationId } = req.context;
      const parsed = insertChatbotSchema.safeParse({ ...req.body, userId, organizationId });

      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid data', errors: parsed.error.errors });
      }

      const createData = { ...parsed.data };
      if (createData.sessionId) {
        const session = await storage.getSession(createData.sessionId);
        if (!session) {
          createData.sessionId = null;
        }
      }
      const creatingPublished = String(createData.status || "draft").toLowerCase() === "published";
      const quota = await assertPlanQuota({
        userId,
        organizationId,
        kind: "chatbots",
        activating: creatingPublished,
      });
      if (quota) return sendPlanQuotaDenial(res, quota);
      const chatbot = await storage.createChatbot(createData);
      res.json(chatbot);
    } catch (error: any) {
      console.error('Error creating chatbot:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /** Pre-built demo: On Message → 10 Ask Questions → Append to Google Sheet (uses tenant’s Sheet connection + WhatsApp session). */
  app.post('/api/chatbots/demo-google-sheet', ...withOrgContext, requirePermission('chatbot.create'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { organizationId } = req.context;
      const quota = await assertPlanQuota({ userId, organizationId, kind: "chatbots", activating: true });
      if (quota) return sendPlanQuotaDenial(res, quota);
      const { createDemoGoogleSheetChatbot } = await import('./chatbots/demo-google-sheet-chatbot');
      const result = await createDemoGoogleSheetChatbot({ userId, organizationId });
      res.json({
        chatbot: result.chatbot,
        nodes: result.nodes,
        message:
          'Demo chatbot created and published. Open it to review; confirm spreadsheet/tab if needed, then send test WhatsApp messages.',
      });
    } catch (error: any) {
      console.error('Demo Google Sheet chatbot error:', error);
      res.status(400).json({ message: error?.message || 'Failed to create demo chatbot' });
    }
  });

  /** Pre-built demo: On Message -> Ask Question -> HTTP GET -> HTTP POST -> send response summary. */
  app.post('/api/chatbots/demo-http-test', ...withOrgContext, requirePermission('chatbot.create'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId || null;
      const { getUrl, postUrl, bearerToken, employeeId } = req.body || {};
      if (!getUrl || !postUrl || !bearerToken) {
        return res.status(400).json({
          message: 'getUrl, postUrl and bearerToken are required',
        });
      }
      if (organizationId) {
        const quota = await assertPlanQuota({ userId, organizationId, kind: "chatbots", activating: true });
        if (quota) return sendPlanQuotaDenial(res, quota);
      }
      const parsedEmployeeId = Number(employeeId || 41);
      if (!Number.isFinite(parsedEmployeeId) || parsedEmployeeId <= 0) {
        return res.status(400).json({ message: 'employeeId must be a positive number' });
      }
      const { createDemoHttpChatbot } = await import('./chatbots/demo-http-chatbot');
      const result = await createDemoHttpChatbot({
        userId,
        organizationId,
        getUrl: String(getUrl),
        postUrl: String(postUrl),
        bearerToken: String(bearerToken),
        employeeId: parsedEmployeeId,
      });
      res.json({
        success: true,
        chatbotId: result.chatbot.id,
        name: result.chatbot.name,
        nodeCount: result.nodes.length,
      });
    } catch (error: any) {
      res.status(400).json({ message: error?.message || 'Failed to create demo HTTP chatbot' });
    }
  });

  app.get('/api/chatbots/:id', ...withOrgContext, requirePermission('chatbot.view'), async (req: any, res) => {
    try {
      const { organizationId } = req.context;
      const { id } = req.params;
      const chatbot = organizationId
        ? await storage.getChatbotByOrganization(id, organizationId)
        : await storage.getChatbot(id, getUserId(req), organizationId);
      if (!chatbot) {
        return res.status(404).json({ message: 'Chatbot not found' });
      }
      const nodes = await storage.getChatbotNodes(id);
      res.json({ ...chatbot, nodes });
    } catch (error: any) {
      console.error('Error getting chatbot:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /** Manually start a published chatbot for the open inbox contact (no trigger matching). */
  app.post('/api/chatbots/:id/start', ...withOrgContext, requirePermission('chatbot.view'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { organizationId } = req.context;
      const { id } = req.params;
      const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId.trim() : '';
      const to = typeof req.body?.to === 'string' ? req.body.to.trim() : '';
      if (!sessionId || !to) {
        return res.status(400).json({ message: 'sessionId and to are required' });
      }

      const session = await storage.getSession(sessionId);
      if (!(await sessionAllowedForUser(session, sessionId, userId, organizationId || null))) {
        return res.status(session ? 403 : 404).json({ message: session ? 'Session access denied' : 'Session not found' });
      }

      const result = await startChatbotForContact({
        chatbotId: id,
        sessionId,
        contactNumber: to,
        userId,
        organizationId: organizationId || undefined,
      });
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      res.json({ success: true, chatbotName: result.chatbotName });
    } catch (error: any) {
      console.error('Error starting chatbot from inbox:', error);
      res.status(500).json({ message: error?.message || 'Failed to start chatbot' });
    }
  });

  app.patch('/api/chatbots/:id', ...withOrgContext, requirePermission('chatbot.edit'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { organizationId } = req.context;
      const { id } = req.params;
      if (req.body.status && !['draft', 'published'].includes(req.body.status)) {
        return res.status(400).json({ message: 'Status must be either "draft" or "published"' });
      }
      if (organizationId && String(req.body.status || "").toLowerCase() === "published") {
        const existing = await storage.getChatbotByOrganization(id, organizationId);
        const wasPublished = String(existing?.status || "").toLowerCase() === "published";
        if (!wasPublished) {
          const quota = await assertPlanQuota({ userId, organizationId, kind: "chatbots", activating: true });
          if (quota) return sendPlanQuotaDenial(res, quota);
        }
      }
      const updateData = { ...req.body };
      if (updateData.sessionId != null && updateData.sessionId !== '') {
        const session = await storage.getSession(updateData.sessionId);
        if (!session) updateData.sessionId = null;
      }
      const chatbot = organizationId
        ? await storage.updateChatbotByOrganization(id, organizationId, updateData)
        : await storage.updateChatbot(id, userId, organizationId, updateData);
      if (!chatbot) {
        return res.status(404).json({ message: 'Chatbot not found' });
      }
      res.json(chatbot);
    } catch (error: any) {
      console.error('Error updating chatbot:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/chatbots/:id', ...withOrgContext, requirePermission('chatbot.delete'), async (req: any, res) => {
    try {
      const { organizationId } = req.context;
      const { id } = req.params;
      if (organizationId) {
        await storage.deleteChatbotByOrganization(id, organizationId);
      } else {
        await storage.deleteChatbot(id, getUserId(req), organizationId);
      }
      res.json({ message: 'Chatbot deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting chatbot:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Chatbot Nodes API
  app.get('/api/chatbots/:id/nodes', ...withOrgContext, requirePermission('chatbot.view'), async (req: any, res) => {
    try {
      const { organizationId } = req.context;
      const { id } = req.params;
      const chatbot = organizationId
        ? await storage.getChatbotByOrganization(id, organizationId)
        : await storage.getChatbot(id, getUserId(req), organizationId);
      if (!chatbot) {
        return res.status(404).json({ message: 'Chatbot not found' });
      }
      const nodes = await storage.getChatbotNodes(id);
      res.json(nodes);
    } catch (error: any) {
      console.error('Error getting chatbot nodes:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/chatbots/:id/nodes', ...withOrgContext, requirePermission('chatbot.edit'), async (req: any, res) => {
    try {
      const { organizationId } = req.context;
      const { id } = req.params;
      const chatbot = organizationId
        ? await storage.getChatbotByOrganization(id, organizationId)
        : await storage.getChatbot(id, getUserId(req), organizationId);
      if (!chatbot) {
        return res.status(404).json({ message: 'Chatbot not found' });
      }
      const { nodes } = req.body;
      if (!Array.isArray(nodes)) {
        return res.status(400).json({ message: 'nodes must be an array' });
      }
      
      // Validate each node
      const validatedNodes = nodes.map((node: any) => {
        const parsed = insertChatbotNodeSchema.safeParse(node);
        if (!parsed.success) {
          throw new Error(`Invalid node: ${parsed.error.errors.map(e => e.message).join(', ')}`);
        }
        // IMPORTANT: preserve client-provided node `id` so connections (from/to) remain stable across saves.
        // If `id` is not preserved, DB generates new ids and links disappear after refresh/back.
        return {
          ...(parsed.data as any),
          ...(node?.id ? { id: node.id } : {}),
        };
      });
      
      const savedNodes = await storage.upsertChatbotNodes(id, validatedNodes);
      if (organizationId) {
        await storage.updateChatbotByOrganization(id, organizationId, {});
      } else {
        await storage.updateChatbot(id, getUserId(req), organizationId, {});
      }
      res.json(savedNodes);
    } catch (error: any) {
      console.error('Error saving chatbot nodes:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Chatbot HTTP node test (proxy to avoid CORS)
  app.post('/api/chatbot/http-test', ...withOrgContext, async (req: any, res) => {
    try {
      const { method = 'GET', url, headers: reqHeaders = {}, body: reqBody } = req.body;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'url is required' });
      }
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return res.status(400).json({ error: 'URL must be http or https' });
      }
      const fetchRes = await fetch(url, {
        method: (method || 'GET').toUpperCase(),
        headers: reqHeaders,
        body: ['GET', 'HEAD'].includes((method || 'GET').toUpperCase()) ? undefined : (reqBody || undefined),
      });
      const text = await fetchRes.text();
      let body: string;
      try {
        body = text ? JSON.stringify(JSON.parse(text), null, 2) : '';
      } catch {
        body = text;
      }
      res.json({
        status: fetchRes.status,
        statusText: fetchRes.statusText,
        body,
        ok: fetchRes.ok,
      });
    } catch (error: any) {
      res.status(200).json({
        status: 0,
        statusText: 'Request failed',
        body: error?.message || String(error),
        ok: false,
      });
    }
  });

  // AI Assistants API
  app.get('/api/ai-assistants', ...withOrgContext, requirePermission('ai_assistant.view'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      const list = organizationId
        ? await storage.getAiAssistantsByOrganization(organizationId)
        : await storage.getAiAssistants(getUserId(req), organizationId);
      res.json(list);
    } catch (error: any) {
      console.error('Error getting AI assistants:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/ai-assistants', ...withOrgContext, requirePermission('ai_assistant.create'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      const parsed = insertAiAssistantSchema.safeParse({ ...req.body, userId, organizationId });
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid data', errors: parsed.error.errors });
      }
      const assistant = await storage.createAiAssistant(parsed.data);
      res.status(201).json(assistant);
    } catch (error: any) {
      console.error('Error creating AI assistant:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/ai-assistants/:id', ...withOrgContext, requirePermission('ai_assistant.view'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      const { id } = req.params;
      const assistant = organizationId
        ? await storage.getAiAssistantByOrganization(id, organizationId)
        : await storage.getAiAssistant(id, getUserId(req), organizationId);
      if (!assistant) return res.status(404).json({ message: 'AI assistant not found' });
      const files = await storage.getAiAssistantKnowledgeFiles(id);
      // Don't return actual API key; expose flag so UI can show "API key configured"
      const { openaiApiKeyOverride, ...safe } = assistant as any;
      res.json({ ...safe, hasApiKeyOverride: !!openaiApiKeyOverride, knowledgeFiles: files });
    } catch (error: any) {
      console.error('Error getting AI assistant:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/ai-assistants/:id', ...withOrgContext, requirePermission('ai_assistant.edit'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      const { id } = req.params;
      const assistant = organizationId
        ? await storage.updateAiAssistantByOrganization(id, organizationId, req.body)
        : await storage.updateAiAssistant(id, getUserId(req), organizationId, req.body);
      if (!assistant) return res.status(404).json({ message: 'AI assistant not found' });
      // Prompt / agent rules change should not keep answering from old chat memory
      if (req.body?.customPrompt != null || req.body?.agentRules != null) {
        await invalidateAiAgentMemoryForAssistant(id);
      }
      res.json(assistant);
    } catch (error: any) {
      console.error('Error updating AI assistant:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/ai-assistants/:id', ...withOrgContext, requirePermission('ai_assistant.delete'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      const { id } = req.params;
      if (organizationId) {
        await storage.deleteAiAssistantByOrganization(id, organizationId);
      } else {
        await storage.deleteAiAssistant(id, getUserId(req), organizationId);
      }
      res.json({ message: 'AI assistant deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting AI assistant:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/ai-assistants/:id/knowledge-files', ...withOrgContext, requirePermission('ai_assistant.view'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      const { id } = req.params;
      const assistant = organizationId
        ? await storage.getAiAssistantByOrganization(id, organizationId)
        : await storage.getAiAssistant(id, getUserId(req), organizationId);
      if (!assistant) return res.status(404).json({ message: 'AI assistant not found' });
      const files = await storage.getAiAssistantKnowledgeFiles(id);
      res.json(files);
    } catch (error: any) {
      console.error('Error getting AI assistant knowledge files:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/ai-assistants/:id/knowledge-files', ...withOrgContext, requirePermission('ai_assistant.edit'), upload.single('file'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      const { id } = req.params;
      const assistant = organizationId
        ? await storage.getAiAssistantByOrganization(id, organizationId)
        : await storage.getAiAssistant(id, getUserId(req), organizationId);
      if (!assistant) return res.status(404).json({ message: 'AI assistant not found' });
      const file = req.file;
      if (!file) return res.status(400).json({ message: 'No file uploaded' });
      const maxSize = 1024 * 1024; // 1MB
      if (file.size > maxSize) return res.status(400).json({ message: 'File must be 1MB or smaller' });
      const ext = (file.originalname || '').toLowerCase().split('.').pop();
      let content = '';
      let mimeType = file.mimetype || 'text/plain';
      if (ext === 'txt' || ext === 'md') {
        content = file.buffer.toString('utf-8');
        mimeType = ext === 'md' ? 'text/markdown' : 'text/plain';
      } else if (ext === 'pdf') {
        const { extractTextFromPdfBuffer } = await import('./ai/kb-ingest');
        content = await extractTextFromPdfBuffer(file.buffer);
        mimeType = 'application/pdf';
        if (!content.trim()) return res.status(400).json({ message: 'Could not extract text from PDF' });
      } else {
        return res.status(400).json({ message: 'Only .txt, .md, and .pdf files are allowed' });
      }
      const kbFile = await storage.addAiAssistantKnowledgeFile({
        assistantId: id,
        fileName: file.originalname || 'document.txt',
        content,
        sizeBytes: Buffer.byteLength(content, 'utf-8'),
        mimeType,
      });
      await invalidateAiAgentMemoryForAssistant(id);
      res.status(201).json(kbFile);
    } catch (error: any) {
      console.error('Error uploading AI assistant knowledge file:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/ai-assistants/:id/knowledge-files/rich-text', ...withOrgContext, requirePermission('ai_assistant.edit'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      const { id } = req.params;
      const assistant = organizationId
        ? await storage.getAiAssistantByOrganization(id, organizationId)
        : await storage.getAiAssistant(id, getUserId(req), organizationId);
      if (!assistant) return res.status(404).json({ message: 'AI assistant not found' });
      const fileName = String(req.body?.fileName || '').trim();
      const content = String(req.body?.content ?? '');
      if (!fileName) return res.status(400).json({ message: 'File name is required' });
      if (!content.trim()) return res.status(400).json({ message: 'Content is required' });
      const sizeBytes = Buffer.byteLength(content, 'utf-8');
      const maxSize = 1024 * 1024;
      if (sizeBytes > maxSize) return res.status(400).json({ message: 'Content must be 1MB or smaller' });
      const kbFile = await storage.addAiAssistantKnowledgeFile({
        assistantId: id,
        fileName,
        content,
        sizeBytes,
        mimeType: 'text/rich',
      });
      await invalidateAiAgentMemoryForAssistant(id);
      res.status(201).json(kbFile);
    } catch (error: any) {
      console.error('Error creating AI assistant rich text knowledge:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/ai-assistants/:id/knowledge-files/from-url', ...withOrgContext, requirePermission('ai_assistant.edit'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      const { id } = req.params;
      const assistant = organizationId
        ? await storage.getAiAssistantByOrganization(id, organizationId)
        : await storage.getAiAssistant(id, getUserId(req), organizationId);
      if (!assistant) return res.status(404).json({ message: 'AI assistant not found' });
      const url = String(req.body?.url || '').trim();
      const fileName = String(req.body?.fileName || 'Web page').trim();
      if (!url) return res.status(400).json({ message: 'URL is required' });
      const { fetchUrlAsPlainText } = await import('./ai/kb-ingest');
      const content = await fetchUrlAsPlainText(url);
      if (!content.trim()) return res.status(400).json({ message: 'No text content extracted from URL' });
      const sizeBytes = Buffer.byteLength(content, 'utf-8');
      if (sizeBytes > 1024 * 1024) return res.status(400).json({ message: 'Extracted content exceeds 1MB' });
      const kbFile = await storage.addAiAssistantKnowledgeFile({
        assistantId: id,
        fileName,
        content: `Source: ${url}\n\n${content}`,
        sizeBytes,
        mimeType: 'text/web',
      });
      await invalidateAiAgentMemoryForAssistant(id);
      res.status(201).json(kbFile);
    } catch (error: any) {
      console.error('Error importing URL to knowledge base:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/ai-assistants/:id/knowledge-files/faq', ...withOrgContext, requirePermission('ai_assistant.edit'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      const { id } = req.params;
      const assistant = organizationId
        ? await storage.getAiAssistantByOrganization(id, organizationId)
        : await storage.getAiAssistant(id, getUserId(req), organizationId);
      if (!assistant) return res.status(404).json({ message: 'AI assistant not found' });
      const fileName = String(req.body?.fileName || 'FAQ').trim();
      const items = Array.isArray(req.body?.items) ? req.body.items : [];
      if (!items.length) return res.status(400).json({ message: 'At least one FAQ item is required' });
      const normalized = items.map((item: any) => ({
        question: String(item?.question || '').trim(),
        answer: String(item?.answer || '').trim(),
      })).filter((item: { question: string }) => item.question);
      if (!normalized.length) return res.status(400).json({ message: 'Valid FAQ questions required' });
      const content = JSON.stringify(normalized);
      const sizeBytes = Buffer.byteLength(content, 'utf-8');
      const kbFile = await storage.addAiAssistantKnowledgeFile({
        assistantId: id,
        fileName,
        content,
        sizeBytes,
        mimeType: 'text/faq',
      });
      await invalidateAiAgentMemoryForAssistant(id);
      res.status(201).json(kbFile);
    } catch (error: any) {
      console.error('Error creating FAQ knowledge:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/ai-assistants/:id/knowledge-files/:fileId', ...withOrgContext, requirePermission('ai_assistant.edit'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      const { id, fileId } = req.params;
      const assistant = organizationId
        ? await storage.getAiAssistantByOrganization(id, organizationId)
        : await storage.getAiAssistant(id, getUserId(req), organizationId);
      if (!assistant) return res.status(404).json({ message: 'AI assistant not found' });
      const existing = await storage.getAiAssistantKnowledgeFile(fileId, id);
      if (!existing) return res.status(404).json({ message: 'Knowledge entry not found' });
      const fileName = req.body?.fileName != null ? String(req.body.fileName).trim() : existing.fileName;
      const content = req.body?.content != null ? String(req.body.content) : existing.content;
      if (!fileName) return res.status(400).json({ message: 'File name is required' });
      if (!content.trim()) return res.status(400).json({ message: 'Content is required' });
      const sizeBytes = Buffer.byteLength(content, 'utf-8');
      const maxSize = 1024 * 1024;
      if (sizeBytes > maxSize) return res.status(400).json({ message: 'Content must be 1MB or smaller' });
      const kbFile = await storage.updateAiAssistantKnowledgeFile(fileId, id, {
        fileName,
        content,
        sizeBytes,
        mimeType: existing.mimeType === 'text/plain' ? existing.mimeType : 'text/rich',
      });
      await invalidateAiAgentMemoryForAssistant(id);
      res.json(kbFile);
    } catch (error: any) {
      console.error('Error updating AI assistant knowledge file:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/ai-assistants/:id/knowledge-files/:fileId', ...withOrgContext, requirePermission('ai_assistant.edit'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      const { id, fileId } = req.params;
      const assistant = organizationId
        ? await storage.getAiAssistantByOrganization(id, organizationId)
        : await storage.getAiAssistant(id, getUserId(req), organizationId);
      if (!assistant) return res.status(404).json({ message: 'AI assistant not found' });
      await storage.deleteAiAssistantKnowledgeFile(fileId, id);
      await invalidateAiAgentMemoryForAssistant(id);
      res.json({ message: 'Knowledge file deleted' });
    } catch (error: any) {
      console.error('Error deleting AI assistant knowledge file:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // FAQ Bot API (org-scoped: team members with permission see the same FAQs)
  app.get('/api/faq', ...withOrgContext, requirePermission('faq_bot.view'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const list = await storage.getFaqItemsByOrganization(organizationId);
      res.json(list);
    } catch (error: any) {
      console.error('Error getting FAQ items:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/faq/settings', ...withOrgContext, requirePermission('faq_bot.view'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const settings = await storage.getFaqBotSettingsByOrganization(organizationId);
      if (!settings) {
        return res.json({
          enabled: false,
          welcomeMessage: "Hello! How can I help you today?",
          fallbackMessage: "I'm sorry, I don't have an answer for that. Please contact support.",
          autoReply: true,
        });
      }
      res.json(settings);
    } catch (error: any) {
      console.error('Error getting FAQ bot settings:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/faq', ...withOrgContext, requirePermission('faq_bot.create'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const answerType = String(req.body?.answerType || 'text').toLowerCase();
      const allowed = ['text', 'image', 'video', 'document', 'audio'];
      if (!allowed.includes(answerType)) {
        return res.status(400).json({ message: 'Invalid answer type' });
      }
      const answer = String(req.body?.answer || '').trim();
      const mediaUrl = String(req.body?.mediaUrl || '').trim() || undefined;
      if (answerType === 'text' && !answer) {
        return res.status(400).json({ message: 'Answer text is required for text FAQs' });
      }
      if (answerType !== 'text' && !mediaUrl) {
        return res.status(400).json({ message: 'Media file is required for image, video, document, or audio FAQs' });
      }
      const payload = {
        ...req.body,
        organizationId,
        answerType,
        answer: answer || '',
        mediaUrl: answerType === 'text' ? undefined : mediaUrl,
        mediaFileName: req.body?.mediaFileName?.trim() || undefined,
      };
      const parsed = insertFaqItemSchema.safeParse(payload);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid data', errors: parsed.error.errors });
      }
      const item = await storage.createFaqItem(parsed.data);
      res.status(201).json(item);
    } catch (error: any) {
      console.error('Error creating FAQ item:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post(
    '/api/faq/upload',
    ...withOrgContext,
    requirePermission('faq_bot.create'),
    faqUploadSingle,
    async (req: any, res) => {
      try {
        const organizationId = req.context?.organizationId;
        const file = req.file;
        const answerType = String(req.query.type || 'image').toLowerCase();
        if (!organizationId) return res.status(400).json({ error: 'Organization context required' });
        if (!file) return res.status(400).json({ error: 'No file uploaded' });

        const mime = (file.mimetype || '').toLowerCase();
        if (answerType === 'image' && !mime.startsWith('image/')) {
          return res.status(400).json({ error: 'Please upload an image file' });
        }
        if (answerType === 'video' && !mime.startsWith('video/')) {
          return res.status(400).json({ error: 'Please upload a video file' });
        }
        if (answerType === 'document' && mime.startsWith('image/')) {
          return res.status(400).json({ error: 'Please upload a document file (PDF, DOC, etc.)' });
        }

        const relativeUrl = `/uploads/${organizationId}/faq/${file.filename}`;
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        res.json({
          success: true,
          url: relativeUrl,
          fullUrl: `${baseUrl}${relativeUrl}`,
          name: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
        });
      } catch (error: any) {
        console.error('Error uploading FAQ media:', error);
        res.status(500).json({ error: error.message });
      }
    },
  );

  app.put('/api/faq/:id', ...withOrgContext, requirePermission('faq_bot.edit'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const { id } = req.params;
      const body = { ...req.body };
      if (body.answerType != null) {
        const answerType = String(body.answerType).toLowerCase();
        const allowed = ['text', 'image', 'video', 'document', 'audio'];
        if (!allowed.includes(answerType)) {
          return res.status(400).json({ message: 'Invalid answer type' });
        }
        body.answerType = answerType;
        const answer = String(body.answer ?? '').trim();
        const mediaUrl = String(body.mediaUrl || '').trim() || undefined;
        if (answerType === 'text' && !answer) {
          return res.status(400).json({ message: 'Answer text is required for text FAQs' });
        }
        if (answerType !== 'text' && !mediaUrl) {
          return res.status(400).json({ message: 'Media file is required for image, video, document, or audio FAQs' });
        }
        body.answer = answer || '';
        body.mediaUrl = answerType === 'text' ? null : mediaUrl;
      }
      const item = await storage.updateFaqItemByOrganization(id, organizationId, body);
      if (!item) return res.status(404).json({ message: 'FAQ item not found' });
      res.json(item);
    } catch (error: any) {
      console.error('Error updating FAQ item:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch('/api/faq/:id', ...withOrgContext, requirePermission('faq_bot.edit'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const { id } = req.params;
      const answerType = req.body?.answerType != null ? String(req.body.answerType).toLowerCase() : undefined;
      if (answerType) {
        const allowedTypes = new Set(['text', 'image', 'video', 'document']);
        if (!allowedTypes.has(answerType)) {
          return res.status(400).json({ message: 'answerType must be text, image, video, or document' });
        }
      }
      const patch = { ...req.body };
      if (patch.caption !== undefined) {
        patch.caption = patch.caption?.trim() ? String(patch.caption).trim() : null;
      }
      const item = await storage.updateFaqItemByOrganization(id, organizationId, patch);
      if (!item) return res.status(404).json({ message: 'FAQ item not found' });
      res.json(item);
    } catch (error: any) {
      console.error('Error patching FAQ item:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/faq/:id', ...withOrgContext, requirePermission('faq_bot.delete'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const { id } = req.params;
      await storage.deleteFaqItemByOrganization(id, organizationId);
      res.json({ message: 'FAQ item deleted' });
    } catch (error: any) {
      console.error('Error deleting FAQ item:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch('/api/faq/settings', ...withOrgContext, requirePermission('faq_bot.edit'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const settings = await storage.upsertFaqBotSettingsByOrganization(organizationId, req.body);
      res.json(settings);
    } catch (error: any) {
      console.error('Error updating FAQ bot settings:', error);
      res.status(500).json({ error: error.message });
    }
  });

  const liveChatMessageLimit = 4096;
  const toPublicLiveChatSettings = async (organizationId: string) => {
    const { toLiveChatSettingsPayload } = await import("@shared/live-chat-settings");
    const row = await storage.getOrganizationLiveChatSettings(organizationId);
    return toLiveChatSettingsPayload(row);
  };

  app.get('/api/live-chat-settings', ...withOrgContext, requirePermission('manage_settings.view'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      res.json(await toPublicLiveChatSettings(organizationId));
    } catch (error: any) {
      console.error('Error getting live chat settings:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch('/api/live-chat-settings', ...withOrgContext, requirePermission('manage_settings.view'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const { parseLiveChatWorkingHours } = await import("@shared/live-chat-settings");
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const patch: Record<string, unknown> = {};
      if (body.welcomeEnabled !== undefined) patch.welcomeEnabled = body.welcomeEnabled === true;
      if (body.offHoursEnabled !== undefined) patch.offHoursEnabled = body.offHoursEnabled === true;
      if (body.welcomeMessage !== undefined) {
        const text = String(body.welcomeMessage || "");
        if (text.length > liveChatMessageLimit) {
          return res.status(400).json({ message: `Welcome message must be ${liveChatMessageLimit} characters or less` });
        }
        patch.welcomeMessage = text;
      }
      if (body.offHoursMessage !== undefined) {
        const text = String(body.offHoursMessage || "");
        if (text.length > liveChatMessageLimit) {
          return res.status(400).json({ message: `Off-hours message must be ${liveChatMessageLimit} characters or less` });
        }
        patch.offHoursMessage = text;
      }
      if (body.workingHours !== undefined) {
        patch.workingHours = parseLiveChatWorkingHours(body.workingHours);
      }
      await storage.upsertOrganizationLiveChatSettings(organizationId, patch);
      res.json(await toPublicLiveChatSettings(organizationId));
    } catch (error: any) {
      console.error('Error updating live chat settings:', error);
      res.status(500).json({ error: error.message });
    }
  });

  const defaultInvoiceSettings = () => ({
    invoiceBusinessName: "",
    gstSignatureUrl: null,
    gstSignatureSizePx: 48,
    gstInvoicePrefix: "",
    gstInvoiceStart: 1,
    gstPercentage: 18,
    gstBankName: "",
    gstAccountNo: "",
    gstIfscCode: "",
    gstPaymentUpiId: "",
    gstEmailId: "",
    gstTermsAndConditions: "",
    nonGstSignatureUrl: null,
    nonGstSignatureSizePx: 48,
    nonGstInvoicePrefix: "",
    nonGstInvoiceStart: 1,
    nonGstBankName: "",
    nonGstAccountNo: "",
    nonGstIfscCode: "",
    nonGstPaymentUpiId: "",
    nonGstEmailId: "",
    nonGstTermsAndConditions: "",
    invoiceCurrency: "INR",
    hsnCode: "",
    emailAutomation: false,
    whatsappAutomation: false,
    selectedTemplateId: 1,
  });

  app.get('/api/invoice-settings', ...withOrgContext, requirePermission('manage_settings.view', 'manage_contacts.view'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const settings = await storage.getOrganizationInvoiceSettings(organizationId);
      if (!settings) {
        return res.json(defaultInvoiceSettings());
      }
      res.json(settings);
    } catch (error: any) {
      console.error('Error getting invoice settings:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/invoice-settings', ...withOrgContext, requirePermission('manage_settings.view'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const parsed = updateOrganizationInvoiceSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid data', errors: parsed.error.errors });
      }
      const settings = await storage.upsertOrganizationInvoiceSettings(organizationId, parsed.data);
      res.json(settings);
    } catch (error: any) {
      console.error('Error saving invoice settings:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post(
    '/api/invoice-settings/upload-signature',
    ...withOrgContext,
    requirePermission('manage_settings.view'),
    invoiceSignatureUploadSingle,
    async (req: any, res) => {
      try {
        const organizationId = req.context?.organizationId;
        const file = req.file;
        if (!organizationId) {
          return res.status(400).json({ error: 'Organization context required' });
        }
        if (!file) {
          return res.status(400).json({ error: 'No file uploaded' });
        }
        const relativeUrl = `/uploads/${organizationId}/invoice/${file.filename}`;
        res.json({
          success: true,
          url: relativeUrl,
          fullUrl: `${req.protocol}://${req.get('host')}${relativeUrl}`,
          name: file.originalname,
          size: file.size,
        });
      } catch (error: any) {
        console.error('Error uploading invoice signature:', error);
        res.status(500).json({ error: error.message });
      }
    }
  );

  app.post(
    '/api/invoice-settings/upload-banner',
    ...withOrgContext,
    requirePermission('manage_settings.view'),
    invoiceBannerUploadSingle,
    async (req: any, res) => {
      try {
        const organizationId = req.context?.organizationId;
        const file = req.file;
        if (!organizationId) {
          return res.status(400).json({ error: 'Organization context required' });
        }
        if (!file) {
          return res.status(400).json({ error: 'No file uploaded' });
        }
        const relativeUrl = `/uploads/${organizationId}/invoice/${file.filename}`;
        res.json({
          success: true,
          url: relativeUrl,
          fullUrl: `${req.protocol}://${req.get('host')}${relativeUrl}`,
          name: file.originalname,
          size: file.size,
        });
      } catch (error: any) {
        console.error('Error uploading invoice banner:', error);
        res.status(500).json({ error: error.message });
      }
    }
  );

  app.post('/api/invoice-settings/reset-start', ...withOrgContext, requirePermission('manage_settings.view'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const type = String(req.body?.type || '');
      if (type !== 'gst' && type !== 'non_gst') {
        return res.status(400).json({ message: 'type must be gst or non_gst' });
      }
      const patch =
        type === 'gst'
          ? { gstInvoiceStart: 1 }
          : { nonGstInvoiceStart: 1 };
      const settings = await storage.upsertOrganizationInvoiceSettings(organizationId, patch);
      res.json(settings);
    } catch (error: any) {
      console.error('Error resetting invoice start:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/invoices', ...withOrgContext, requirePermission('manage_settings.view', 'manage_contacts.view'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '10'), 10) || 10));
      const offset = Math.max(0, parseInt(String(req.query.offset || '0'), 10) || 0);
      const pendingOnly =
        req.query.pendingOnly === '1' ||
        req.query.pendingOnly === 'true' ||
        req.query.pendingOnly === true;
      const { items, total } = await storage.listOrganizationInvoices(organizationId, {
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        dateFrom: typeof req.query.dateFrom === 'string' ? req.query.dateFrom : undefined,
        dateTo: typeof req.query.dateTo === 'string' ? req.query.dateTo : undefined,
        pendingOnly,
        limit,
        offset,
      });
      res.json({ invoices: items, total, limit, offset });
    } catch (error: any) {
      console.error('Error listing invoices:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/invoices/summary', ...withOrgContext, requirePermission('manage_settings.view', 'manage_contacts.view'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const pendingOnly =
        req.query.pendingOnly === '1' ||
        req.query.pendingOnly === 'true' ||
        req.query.pendingOnly === true;
      const { items } = await storage.listOrganizationInvoices(organizationId, {
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        dateFrom: typeof req.query.dateFrom === 'string' ? req.query.dateFrom : undefined,
        dateTo: typeof req.query.dateTo === 'string' ? req.query.dateTo : undefined,
        pendingOnly,
        limit: 10000,
        offset: 0,
      });
      const summary = {
        total: items.length,
        due: items.filter((i) => i.invoiceStatus === 'due').length,
        halfPaid: items.filter((i) => i.invoiceStatus === 'half_paid').length,
        paid: items.filter((i) => i.invoiceStatus === 'paid').length,
        totalAmount: items.reduce((s, i) => s + (Number(i.totalAmount) || 0), 0),
        pendingAmount: items.reduce((s, i) => s + (Number(i.amountPending) || 0), 0),
      };
      res.json(summary);
    } catch (error: any) {
      console.error('Error invoice summary:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/invoices/:id', ...withOrgContext, requirePermission('manage_settings.view', 'manage_contacts.view'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      const { id } = req.params;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const invoice = await storage.getOrganizationInvoiceById(id, organizationId);
      if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
      res.json(invoice);
    } catch (error: any) {
      console.error('Error getting invoice:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/invoices/:id/update', ...withOrgContext, requirePermission('manage_settings.view'), parseCreateInvoiceRequest, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      const { id } = req.params;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });

      const existing = await storage.getOrganizationInvoiceById(id, organizationId);
      if (!existing) return res.status(404).json({ message: 'Invoice not found' });
      if (existing.isLocked) return res.status(403).json({ message: 'Invoice is locked' });

      const gstTypeStore =
        req.body?.gstTypeStore === 'non_gst' || req.body?.gstTypeStore === 'sgst_cgst'
          ? req.body.gstTypeStore
          : req.body?.isGst === false
            ? 'non_gst'
            : 'igst';
      const isGst = gstTypeStore !== 'non_gst';
      const inclusiveGst = !!req.body?.inclusiveGst;
      const invoiceCurrency =
        typeof req.body?.invoiceCurrency === 'string' ? req.body.invoiceCurrency : undefined;
      const lineItems = Array.isArray(req.body?.lineItems) ? req.body.lineItems : [];
      const invoiceTo =
        req.body?.invoiceTo && typeof req.body.invoiceTo === 'object' ? req.body.invoiceTo : null;
      const emailAutomation = !!req.body?.emailAutomation;
      const whatsappAutomation = !!req.body?.whatsappAutomation;
      const invoiceStatus = normalizeInvoicePaymentStatus(req.body?.invoiceStatus);
      const pdfFile = req.file as Express.Multer.File | undefined;

      if (lineItems.length === 0) {
        return res.status(400).json({ message: 'At least one line item is required' });
      }
      if (!pdfFile?.buffer?.length) {
        return res.status(400).json({ message: 'Invoice PDF is required' });
      }
      if ((emailAutomation || whatsappAutomation) && !pdfFile?.buffer?.length) {
        return res.status(400).json({
          message: 'Invoice PDF is required when email or WhatsApp automation is enabled',
        });
      }

      const settings =
        (await storage.getOrganizationInvoiceSettings(organizationId)) || defaultInvoiceSettings();
      const invoiceNo = existing.invoiceNo;

      const lastInvoiceTotal = lineItems.reduce((sum: number, row: any) => {
        const cost = Number(row.cost) || 0;
        const qty = Number(row.qty) || 1;
        const discount = Number(row.discount) || 0;
        const base = Math.max(0, cost * qty - discount);
        if (!isGst) return sum + base;
        const defaultPct = settings.gstPercentage ?? 18;
        const igstPct = Number(row.igstPct) || defaultPct;
        const sgstPct = Number(row.sgstPct) || defaultPct / 2;
        const cgstPct = Number(row.cgstPct) || defaultPct / 2;
        const totalTaxPct = gstTypeStore === 'igst' ? igstPct : sgstPct + cgstPct;
        if (inclusiveGst) return sum + base;
        const tax = Math.round((base * totalTaxPct) / 100);
        return sum + base + tax;
      }, 0);
      const amountPaidInput =
        req.body?.amountPaid != null && req.body.amountPaid !== ''
          ? Number(req.body.amountPaid)
          : undefined;
      const { amountPaid, amountPending } = computeInvoicePaymentAmounts(
        invoiceStatus,
        lastInvoiceTotal,
        amountPaidInput,
      );

      const customerName =
        (invoiceTo && typeof invoiceTo === 'object' && invoiceTo.customerName) ||
        existing.customerName ||
        '';
      const customerPhone =
        (invoiceTo && typeof invoiceTo === 'object' && invoiceTo.customerPhone) ||
        existing.customerPhone ||
        '';
      const customerEmail =
        (invoiceTo && typeof invoiceTo === 'object' && invoiceTo.customerEmail) ||
        existing.customerEmail ||
        null;

      const { saveInvoicePdf } = await import('./invoices/invoice-delivery');
      const pdfUrl = saveInvoicePdf(organizationId, invoiceNo, pdfFile.buffer);

      let delivery: import('./invoices/invoice-delivery').InvoiceDeliveryResult | undefined;
      if (emailAutomation || whatsappAutomation) {
        const org = await storage.getOrganization(organizationId);
        const { resolveInvoiceOrganizationName, deliverInvoiceAutomations } = await import('./invoices/invoice-delivery');
        const orgName = resolveInvoiceOrganizationName(settings, org?.name || existing.companyName);
        delivery = await deliverInvoiceAutomations({
          userId,
          organizationId,
          organizationName: orgName,
          invoiceNo,
          pdfBuffer: pdfFile.buffer,
          emailAutomation,
          whatsappAutomation,
          customerEmail: typeof customerEmail === 'string' ? customerEmail : null,
          customerPhone: typeof customerPhone === 'string' ? customerPhone : null,
          customerName: String(customerName || ''),
          currency: invoiceCurrency || settings.invoiceCurrency || 'INR',
          totalAmount: lastInvoiceTotal,
          amountPaid,
          amountPending,
          invoiceStatus,
        });
      }

      if (existing.contactId) {
        const contact = await storage.getManagedContactByOrganization(existing.contactId, organizationId);
        if (contact) {
          const customFields = {
            ...(contact.customFields && typeof contact.customFields === 'object' ? contact.customFields : {}),
            billNo: invoiceNo,
            lastInvoiceAt: new Date().toISOString(),
            lastInvoiceType: gstTypeStore,
            lastInvoiceInclusiveGst: inclusiveGst,
            ...(invoiceCurrency ? { lastInvoiceCurrency: invoiceCurrency } : {}),
            lastInvoiceTotal,
            ...(invoiceTo ? { lastInvoiceTo: invoiceTo } : {}),
            ...(lineItems.length ? { lastInvoiceLineItems: lineItems } : {}),
            lastInvoiceEmailAutomation: emailAutomation,
            lastInvoiceWhatsappAutomation: whatsappAutomation,
            lastInvoiceStatus: invoiceStatus,
            lastInvoiceAmountPaid: amountPaid,
            lastInvoiceAmountPending: amountPending,
            lastInvoicePdfUrl: delivery?.pdfUrl || pdfUrl,
          };
          await storage.updateManagedContact(existing.contactId, contact.userId, organizationId, {
            customFields,
          });
        }
      }

      const updated = await storage.updateOrganizationInvoice(id, organizationId, {
        customerName: String(customerName || ''),
        customerPhone: String(customerPhone || ''),
        customerEmail: typeof customerEmail === 'string' ? customerEmail : null,
        gstType: gstTypeStore,
        invoiceStatus,
        currency: invoiceCurrency || settings.invoiceCurrency || 'INR',
        totalAmount: lastInvoiceTotal,
        amountPaid,
        amountPending,
        pdfUrl: delivery?.pdfUrl || pdfUrl,
        lineItems,
        invoiceTo,
        emailAutomation,
        whatsappAutomation,
      });

      res.json({
        invoiceNo,
        invoiceId: id,
        invoice: updated,
        delivery,
      });
    } catch (error: any) {
      console.error('Error updating invoice:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch('/api/invoices/:id', ...withOrgContext, requirePermission('manage_settings.view'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      const { id } = req.params;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const existing = await storage.getOrganizationInvoiceById(id, organizationId);
      if (!existing) return res.status(404).json({ message: 'Invoice not found' });
      if (existing.isLocked && req.body?.isLocked !== false) {
        return res.status(403).json({ message: 'Invoice is locked' });
      }
      const patch: Record<string, unknown> = {};
      if (typeof req.body?.isLocked === 'boolean') patch.isLocked = req.body.isLocked;
      if (typeof req.body?.invoiceStatus === 'string') patch.invoiceStatus = req.body.invoiceStatus;
      const updated = await storage.updateOrganizationInvoice(id, organizationId, patch);
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating invoice:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/invoices/:id', ...withOrgContext, requirePermission('manage_settings.view'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      const { id } = req.params;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const ok = await storage.deleteOrganizationInvoice(id, organizationId);
      if (!ok) return res.status(404).json({ message: 'Invoice not found' });
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting invoice:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/invoices/:id/resend', ...withOrgContext, requirePermission('manage_settings.view'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      const { id } = req.params;
      const channel = String(req.body?.channel || '');
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      if (channel !== 'email' && channel !== 'whatsapp') {
        return res.status(400).json({ message: 'channel must be email or whatsapp' });
      }
      const invoice = await storage.getOrganizationInvoiceById(id, organizationId);
      if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
      if (!invoice.pdfUrl) return res.status(400).json({ message: 'No PDF available for this invoice' });
      const fs = await import('fs');
      const path = await import('path');
      const rel = invoice.pdfUrl.replace(/^\//, '');
      const filePath = path.join(process.cwd(), rel);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'PDF file not found on server' });
      }
      const pdfBuffer = fs.readFileSync(filePath);
      const org = await storage.getOrganization(organizationId);
      const invoiceSettings = await storage.getOrganizationInvoiceSettings(organizationId);
      const { resolveInvoiceOrganizationName, deliverInvoiceAutomations } = await import('./invoices/invoice-delivery');
      const orgName = resolveInvoiceOrganizationName(invoiceSettings, org?.name || invoice.companyName);
      const delivery = await deliverInvoiceAutomations({
        userId,
        organizationId,
        organizationName: orgName,
        invoiceNo: invoice.invoiceNo,
        pdfBuffer,
        emailAutomation: channel === 'email',
        whatsappAutomation: channel === 'whatsapp',
        customerEmail: invoice.customerEmail,
        customerPhone: invoice.customerPhone,
        customerName: invoice.customerName,
        currency: invoice.currency,
        totalAmount: invoice.totalAmount,
        amountPaid: invoice.amountPaid,
        amountPending: invoice.amountPending,
        invoiceStatus: invoice.invoiceStatus,
      });
      res.json({ success: true, delivery });
    } catch (error: any) {
      console.error('Error resending invoice:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // —— Leads (CRM) ——
  app.get('/api/leads/statuses', ...withOrgContext, requirePermission('manage_contacts.view'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const { ensureOrganizationLeadStatuses, resolveDefaultLeadStatusSlug } = await import('./leads/lead-status-defaults');
      await resolveDefaultLeadStatusSlug(organizationId);
      const statuses = await ensureOrganizationLeadStatuses(organizationId);
      res.json({ statuses });
    } catch (error: any) {
      console.error('Error listing lead statuses:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/leads/sources', ...withOrgContext, requirePermission('manage_contacts.view'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const { buildLeadSourceOptions } = await import('@shared/lead-sources');
      const sources = buildLeadSourceOptions();
      res.json({ sources });
    } catch (error: any) {
      console.error('Error listing lead sources:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/leads/by-phone/:phone', ...withOrgContext, requirePermission('manage_contacts.view'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const phone = String(req.params.phone || '').replace(/[^\d]/g, '');
      if (!phone) return res.status(400).json({ message: 'Phone number is required' });
      const lead = await storage.getOrganizationLeadByPhone(organizationId, phone);
      if (!lead) return res.status(404).json({ message: 'Lead not found' });
      res.json(lead);
    } catch (error: any) {
      console.error('Error fetching lead by phone:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/leads/statuses', ...withOrgContext, requirePermission('manage_contacts.edit'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const name = String(req.body?.name || '').trim();
      if (!name) return res.status(400).json({ message: 'Name is required' });
      const baseSlug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '') || 'status';
      let slug = baseSlug;
      let n = 1;
      while (await storage.getOrganizationLeadStatusBySlug(organizationId, slug)) {
        slug = `${baseSlug}_${n++}`;
      }
      const existing = await storage.listOrganizationLeadStatuses(organizationId);
      const sortOrder = existing.length;
      const color = String(req.body?.color || '#dbeafe').trim() || '#dbeafe';
      const parsed = insertOrganizationLeadStatusSchema.safeParse({
        organizationId,
        name,
        slug,
        color,
        sortOrder,
        isDefault: !!req.body?.isDefault,
      });
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid data', errors: parsed.error.errors });
      }
      if (parsed.data.isDefault) {
        for (const s of existing) {
          if (s.isDefault) await storage.updateOrganizationLeadStatus(s.id, organizationId, { isDefault: false });
        }
      }
      const status = await storage.createOrganizationLeadStatus(parsed.data);
      res.status(201).json(status);
    } catch (error: any) {
      console.error('Error creating lead status:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch('/api/leads/statuses/reorder', ...withOrgContext, requirePermission('manage_contacts.edit'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const orderedIds = Array.isArray(req.body?.orderedIds) ? req.body.orderedIds.map(String) : [];
      if (orderedIds.length === 0) return res.status(400).json({ message: 'orderedIds required' });
      const statuses = await storage.reorderOrganizationLeadStatuses(organizationId, orderedIds);
      res.json({ statuses });
    } catch (error: any) {
      console.error('Error reordering lead statuses:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch('/api/leads/statuses/:id', ...withOrgContext, requirePermission('manage_contacts.edit'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      const { id } = req.params;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const parsed = updateOrganizationLeadStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid data', errors: parsed.error.errors });
      }
      const updated = await storage.updateOrganizationLeadStatus(id, organizationId, parsed.data);
      if (!updated) return res.status(404).json({ message: 'Status not found' });
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating lead status:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/leads/statuses/:id', ...withOrgContext, requirePermission('manage_contacts.edit'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      const { id } = req.params;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const status = await storage.getOrganizationLeadStatusById(id, organizationId);
      if (!status) return res.status(404).json({ message: 'Status not found' });
      const leadCount = await storage.countLeadsByStatusSlug(organizationId, status.slug);
      if (leadCount > 0) {
        return res.status(409).json({
          message: `Cannot delete: ${leadCount} lead(s) use this status. Move them first.`,
        });
      }
      const all = await storage.listOrganizationLeadStatuses(organizationId);
      if (all.length <= 1) {
        return res.status(400).json({ message: 'At least one lead status is required' });
      }
      if (status.isDefault) {
        const next = all.find((s) => s.id !== id);
        if (next) await storage.updateOrganizationLeadStatus(next.id, organizationId, { isDefault: true });
      }
      const ok = await storage.deleteOrganizationLeadStatus(id, organizationId);
      if (!ok) return res.status(404).json({ message: 'Status not found' });
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting lead status:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/leads', ...withOrgContext, requirePermission('manage_contacts.view'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const limit = Math.min(
        req.query.board === '1' ? 2000 : 100,
        Math.max(1, parseInt(String(req.query.limit || (req.query.board === '1' ? '500' : '25')), 10) || 25),
      );
      const offset = Math.max(0, parseInt(String(req.query.offset || '0'), 10) || 0);
      const { items, total } = await storage.listOrganizationLeads(organizationId, {
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        priority: typeof req.query.priority === 'string' ? req.query.priority : undefined,
        category: typeof req.query.category === 'string' ? req.query.category : undefined,
        source: typeof req.query.source === 'string' ? req.query.source : undefined,
        assignedTo: typeof req.query.assignedTo === 'string' ? req.query.assignedTo : undefined,
        dateFrom: typeof req.query.dateFrom === 'string' ? req.query.dateFrom : undefined,
        dateTo: typeof req.query.dateTo === 'string' ? req.query.dateTo : undefined,
        limit,
        offset,
      });
      const { enrichLeadsWithLeadFromPhone } = await import('./leads/enrich-leads');
      const leads = await enrichLeadsWithLeadFromPhone(
        (ids) => storage.getSessionsBySessionIds(ids),
        items,
      );
      res.json({ leads, total, limit, offset });
    } catch (error: any) {
      console.error('Error listing leads:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/leads', ...withOrgContext, requirePermission('manage_contacts.edit'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const parsed = insertOrganizationLeadSchema.safeParse({
        ...req.body,
        organizationId,
        userId,
        source: req.body?.source || 'manual',
      });
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid data', errors: parsed.error.errors });
      }
      const phone = String(parsed.data.phoneNumber || '').replace(/[^\d]/g, '');
      if (!phone) return res.status(400).json({ message: 'Phone number is required' });
      const existing = await storage.getOrganizationLeadByPhone(organizationId, phone);
      if (existing) return res.status(409).json({ message: 'A lead with this phone number already exists' });
      const { ensureOrganizationLeadStatuses, resolveDefaultLeadStatusSlug } = await import('./leads/lead-status-defaults');
      await ensureOrganizationLeadStatuses(organizationId);
      let status = parsed.data.status;
      if (status) {
        const found = await storage.getOrganizationLeadStatusBySlug(organizationId, status);
        if (!found) status = await resolveDefaultLeadStatusSlug(organizationId);
      } else {
        status = await resolveDefaultLeadStatusSlug(organizationId);
      }

      const { ensureContactForLead } = await import('./leads/ensure-contact-for-lead');
      const contact = await ensureContactForLead({
        userId,
        organizationId,
        phoneDigits: phone,
        name: parsed.data.name,
        email: parsed.data.email,
        source: parsed.data.source || 'manual',
      });

      const lead = await storage.createOrganizationLead({
        ...parsed.data,
        phoneNumber: phone,
        status,
        contactId: contact?.id ?? parsed.data.contactId ?? null,
      });

      // Enroll into drip campaigns when created directly into a trigger status
      if (lead) {
        try {
          const { enrollLeadOnStatusChange } = await import('./drip-campaigns/enrollment');
          await enrollLeadOnStatusChange({
            organizationId,
            userId,
            statusSlug: status,
            lead: {
              id: lead.id,
              contactId: lead.contactId,
              phoneNumber: lead.phoneNumber,
              name: lead.name,
              email: lead.email,
              source: lead.source,
              sessionId: lead.sessionId || null,
            },
          });
        } catch (enrollErr: any) {
          console.error('[Drip] Enrollment after lead create failed:', enrollErr?.message || enrollErr);
        }
      }

      res.status(201).json(lead);
    } catch (error: any) {
      console.error('Error creating lead:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/leads/import', ...withOrgContext, requirePermission('manage_contacts.edit'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const rows = Array.isArray(req.body?.leads) ? req.body.leads : [];
      const { resolveDefaultLeadStatusSlug } = await import('./leads/lead-status-defaults');
      const { ensureContactForLead } = await import('./leads/ensure-contact-for-lead');
      const defaultStatus = await resolveDefaultLeadStatusSlug(organizationId);
      let created = 0;
      let skipped = 0;
      for (const raw of rows) {
        const phone = String(raw?.phoneNumber || raw?.phone || '').replace(/[^\d]/g, '');
        if (!phone) {
          skipped++;
          continue;
        }
        const existing = await storage.getOrganizationLeadByPhone(organizationId, phone);
        if (existing) {
          skipped++;
          continue;
        }
        const name = raw?.name?.trim() || null;
        const email = raw?.email?.trim() || null;
        const source = raw?.source?.trim() || 'import';
        const contact = await ensureContactForLead({
          userId,
          organizationId,
          phoneDigits: phone,
          name,
          email,
          source,
        });
        await storage.createOrganizationLead({
          organizationId,
          userId,
          phoneNumber: phone,
          name,
          email,
          category: raw?.category?.trim() || null,
          source,
          status: defaultStatus,
          priority: 'medium',
          score: 50,
          contactId: contact?.id ?? null,
        });
        created++;
      }
      res.json({ created, skipped });
    } catch (error: any) {
      console.error('Error importing leads:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/leads/bulk/delete', ...withOrgContext, requirePermission('manage_contacts.edit'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const { leadIds } = req.body;
      if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
        return res.status(400).json({ message: 'leadIds array is required' });
      }
      const successCount = await storage.deleteOrganizationLeads(leadIds, organizationId);
      res.json({ success: true, successCount });
    } catch (error: any) {
      console.error('Error bulk deleting leads:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch('/api/leads/reorder', ...withOrgContext, requirePermission('manage_contacts.edit'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const status = typeof req.body?.status === 'string' ? req.body.status.trim() : '';
      const orderedIds = Array.isArray(req.body?.orderedIds) ? req.body.orderedIds.map(String) : [];
      if (!status) return res.status(400).json({ message: 'status is required' });
      if (orderedIds.length === 0) return res.status(400).json({ message: 'orderedIds required' });
      const found = await storage.getOrganizationLeadStatusBySlug(organizationId, status);
      if (!found) return res.status(400).json({ message: 'Invalid status' });
      const leads = await storage.reorderOrganizationLeads(organizationId, status, orderedIds);
      res.json({ leads });
    } catch (error: any) {
      console.error('Error reordering leads:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch('/api/leads/:id', ...withOrgContext, requirePermission('manage_contacts.edit'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      const { id } = req.params;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const parsed = updateOrganizationLeadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid data', errors: parsed.error.errors });
      }
      if (parsed.data.phoneNumber) {
        const phone = parsed.data.phoneNumber.replace(/[^\d]/g, '');
        const dup = await storage.getOrganizationLeadByPhone(organizationId, phone);
        if (dup && dup.id !== id) {
          return res.status(409).json({ message: 'Another lead already uses this phone number' });
        }
      }
      if (parsed.data.status) {
        const statusRow = await storage.getOrganizationLeadStatusBySlug(organizationId, parsed.data.status);
        if (!statusRow) {
          return res.status(400).json({ message: 'Invalid status' });
        }
      }
      const updated = await storage.updateOrganizationLead(id, organizationId, parsed.data);
      if (!updated) return res.status(404).json({ message: 'Lead not found' });
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating lead:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/leads/:id', ...withOrgContext, requirePermission('manage_contacts.edit'), async (req: any, res) => {
    try {
      const organizationId = req.context?.organizationId;
      const { id } = req.params;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const ok = await storage.deleteOrganizationLead(id, organizationId);
      if (!ok) return res.status(404).json({ message: 'Lead not found' });
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting lead:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/columns', ...withOrgContext, requirePermission('columns.create'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { organizationId } = req.context;
      const parsed = insertContactColumnSchema.safeParse({ ...req.body, userId, organizationId });
      
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid data', errors: parsed.error.errors });
      }
      
      const column = await storage.createContactColumn(parsed.data);
      res.json(column);
    } catch (error: any) {
      console.error('Error creating column:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch('/api/columns/:id', ...withOrgContext, requirePermission('columns.edit'), async (req: any, res) => {
    try {
      const { organizationId } = req.context;
      const { id } = req.params;
      const data: Partial<{ label: string; type: string; options: string[]; visible: boolean; required: boolean; order: number }> = {};
      if (req.body?.label !== undefined) data.label = req.body.label;
      if (req.body?.type !== undefined) data.type = req.body.type;
      if (req.body?.options !== undefined) data.options = req.body.options;
      if (req.body?.visible !== undefined) data.visible = req.body.visible;
      if (req.body?.required !== undefined) data.required = req.body.required;
      if (req.body?.order !== undefined) data.order = req.body.order;
      
      const updated = await storage.updateContactColumnByOrganization(id, organizationId, data);
      if (!updated) {
        return res.status(404).json({ message: 'Column not found' });
      }
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating column:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/columns/:id', ...withOrgContext, requirePermission('columns.delete'), async (req: any, res) => {
    try {
      const { organizationId } = req.context;
      const { id } = req.params;
      
      await storage.deleteContactColumnByOrganization(id, organizationId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting column:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Groups API Routes
  app.get('/api/groups', ...withOrgContext, requirePermission('manage_contacts.view', 'groups.view'), async (req: any, res) => {
    try {
      const { organizationId } = req.context;
      if (isPaginatedListRequest(req.query)) {
        const pagination = listPaginationFromRequest(req);
        const search = parseListSearch(req.query);
        const result = await storage.listGroupsByOrganization(organizationId, { search, ...pagination });
        return res.json(buildPaginatedResponse("groups", result));
      }
      const groups = await storage.getGroupsByOrganization(organizationId);
      res.json(groups);
    } catch (error: any) {
      console.error('Error getting groups:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/groups', ...withOrgContext, requirePermission('manage_contacts.create', 'groups.create'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { organizationId } = req.context;
      const parsed = insertGroupSchema.safeParse({ ...req.body, userId, organizationId });
      
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid data', errors: parsed.error.errors });
      }
      
      const group = await storage.createGroup(parsed.data);
      res.json(group);
    } catch (error: any) {
      console.error('Error creating group:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/groups/:id', ...withOrgContext, requirePermission('manage_contacts.view', 'groups.view'), async (req: any, res) => {
    try {
      const { organizationId } = req.context;
      const { id } = req.params;
      
      const group = await storage.getGroupByOrganization(id, organizationId);
      if (!group) {
        return res.status(404).json({ message: 'Group not found' });
      }
      res.json(group);
    } catch (error: any) {
      console.error('Error getting group:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch('/api/groups/:id', ...withOrgContext, requirePermission('manage_contacts.edit', 'groups.edit'), async (req: any, res) => {
    try {
      const { organizationId } = req.context;
      const { id } = req.params;
      const data: Partial<{ name: string; description: string | null; whatsappGroupId: string | null }> = {};
      if (req.body?.name !== undefined) data.name = req.body.name;
      if (req.body?.description !== undefined) data.description = req.body.description;
      if (req.body?.whatsappGroupId !== undefined) data.whatsappGroupId = req.body.whatsappGroupId;
      
      const updated = await storage.updateGroupByOrganization(id, organizationId, data);
      if (!updated) {
        return res.status(404).json({ message: 'Group not found' });
      }
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating group:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/groups/:id', ...withOrgContext, requirePermission('manage_contacts.delete', 'groups.delete'), async (req: any, res) => {
    try {
      const { organizationId } = req.context;
      const { id } = req.params;
      
      await storage.deleteGroupByOrganization(id, organizationId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting group:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Group members
  app.get('/api/groups/:id/members', ...withOrgContext, requirePermission('manage_contacts.view', 'groups.view'), async (req: any, res) => {
    try {
      const { organizationId } = req.context;
      const { id } = req.params;
      
      const members = await storage.getGroupMembersByOrganization(id, organizationId);
      res.json(members);
    } catch (error: any) {
      console.error('Error getting group members:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/groups/:id/members', ...withOrgContext, requirePermission('manage_contacts.edit', 'groups.edit'), async (req: any, res) => {
    try {
      const { organizationId } = req.context;
      const { id } = req.params;
      const parsed = insertGroupMemberSchema.safeParse({ ...req.body, groupId: id });
      
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid data', errors: parsed.error.errors });
      }
      
      const member = await storage.addGroupMemberByOrganization(parsed.data, organizationId);
      res.json(member);
    } catch (error: any) {
      console.error('Error adding group member:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/groups/:id/members/:memberId', ...withOrgContext, requirePermission('manage_contacts.edit', 'groups.edit'), async (req: any, res) => {
    try {
      const { organizationId } = req.context;
      const { memberId } = req.params;
      
      await storage.removeGroupMemberByOrganization(memberId, organizationId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error removing group member:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Campaigns API Routes – org-scoped so members with permission see all org campaigns
  app.get('/api/campaigns', ...withOrgContext, requirePermission('manage_campaigns.view'), async (req: any, res) => {
    try {
      const { organizationId } = req.context;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      if (isPaginatedListRequest(req.query)) {
        const pagination = listPaginationFromRequest(req);
        const search = parseListSearch(req.query);
        const result = await storage.listCampaignsByOrganization(organizationId, { search, ...pagination });
        return res.json(buildPaginatedResponse("campaigns", result));
      }
      const campaigns = await storage.getCampaignsByOrganization(organizationId);
      res.json(campaigns);
    } catch (error: any) {
      console.error('Error getting campaigns:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Status endpoint to check if scheduler is running
  app.get('/api/campaigns/debug/scheduler-status', ...withOrgContext, async (req: any, res) => {
    try {
      const { getCampaignQueueStats } = await import('./campaigns/execution-queue');
      const schedulerEnabled = process.env.DISABLE_BUILTIN_SCHEDULER !== 'true';
      const schedulerIntervalMs = process.env.CAMPAIGN_SCHEDULER_INTERVAL_MS || '30000';
      res.json({
        schedulerEnabled,
        message: schedulerEnabled 
          ? 'Scheduler should be running. Check server logs for [Campaign Scheduler] messages.' 
          : 'Built-in scheduler is disabled. Using cron job instead.',
        checkIntervalMs: parseInt(String(schedulerIntervalMs), 10) || 30_000,
        campaignQueue: getCampaignQueueStats(),
        note: 'If you don\'t see scheduler logs, the scheduler may not have started properly.',
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Debug endpoint to check scheduled campaigns (admin only)
  app.get('/api/campaigns/debug/scheduled', ...withOrgContext, async (req: any, res) => {
    try {
      const { organizationId } = req.context;
      const now = new Date();
      
      const { campaigns } = await import('@shared/schema');
      const { db } = await import('../db');
      const { eq, and, lte, or } = await import('drizzle-orm');
      
      const scheduledCampaigns = await db
        .select()
        .from(campaigns)
        .where(
          and(
            or(
              eq(campaigns.status, 'scheduled'),
              eq(campaigns.status, 'draft')
            ),
            lte(campaigns.scheduledAt, now)
          )
        );
      
      res.json({
        currentTime: now.toISOString(),
        currentTimeLocal: now.toLocaleString(),
        found: scheduledCampaigns.length,
        campaigns: scheduledCampaigns.map(c => ({
          id: c.id,
          name: c.name,
          status: c.status,
          scheduledAt: c.scheduledAt?.toISOString(),
          scheduledAtLocal: c.scheduledAt?.toLocaleString(),
          timeDiff: c.scheduledAt ? Math.round((now.getTime() - c.scheduledAt.getTime()) / 1000) : null,
          sessionId: c.sessionId,
          userId: c.userId,
          organizationId: c.organizationId,
        })),
      });
    } catch (error: any) {
      console.error('Error checking scheduled campaigns:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Manual trigger for scheduler (for testing)
  app.post('/api/campaigns/debug/trigger-scheduler', ...withOrgContext, async (req: any, res) => {
    try {
      const { checkScheduledCampaigns } = await import('./campaigns/scheduler');
      await checkScheduledCampaigns();
      res.json({ success: true, message: 'Scheduler check completed' });
    } catch (error: any) {
      console.error('Error triggering scheduler:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/campaigns', ...withOrgContext, requirePermission('manage_campaigns.create'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { organizationId } = req.context;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const { recipients, ...campaignData } = req.body;
      
      // Extract template-specific fields
      const {
        templateId,
        templateLanguage,
        templateParameters,
        headerImageId,
        headerImageUrl,
        headerVideoId,
        headerVideoUrl,
        carouselCardMediaUrls,
        retryEnabled,
        retrySteps,
        ...restCampaignData
      } = campaignData;

      // Convert scheduledAt string to Date if provided
      const processedData: any = {
        ...restCampaignData,
        userId,
        organizationId,
        // Add template fields if provided
        ...(templateId && { templateId }),
        ...(templateLanguage && { templateLanguage }),
        ...(templateParameters && { templateParameters }),
        ...(headerImageId && { headerImageId }),
        ...(headerImageUrl && { headerImageUrl }),
        ...(headerVideoId && { headerVideoId }),
        ...(headerVideoUrl && { headerVideoUrl }),
        ...(carouselCardMediaUrls &&
          Array.isArray(carouselCardMediaUrls) && { carouselCardMediaUrls }),
      };

      if (retryEnabled === true) {
        const steps = Array.isArray(retrySteps) ? retrySteps.slice(0, 3) : [];
        if (steps.length === 0) {
          return res.status(400).json({
            message: "Retry Campaign requires at least one retry step (hours/minutes).",
          });
        }
        processedData.retryEnabled = true;
        processedData.retrySteps = steps;
      } else {
        processedData.retryEnabled = false;
        processedData.retrySteps = null;
      }
      
      // Convert scheduledAt from string to Date if provided
      if (processedData.scheduledAt && typeof processedData.scheduledAt === 'string') {
        processedData.scheduledAt = new Date(processedData.scheduledAt);
      }
      
      // If no scheduledAt is provided, automatically schedule for 2 minutes from now
      // This prevents instant execution which can be problematic for campaigns with many recipients
      if (!processedData.scheduledAt) {
        const now = new Date();
        now.setMinutes(now.getMinutes() + 2);
        processedData.scheduledAt = now;
        processedData.status = 'scheduled';
      } else if (processedData.scheduledAt instanceof Date) {
        const now = new Date();
        if (processedData.scheduledAt > now) {
          // Future date - set to scheduled
          processedData.status = 'scheduled';
        } else {
          // Past date - set to draft (user can manually execute)
          processedData.status = processedData.status || 'draft';
        }
      }
      
      const parsed = insertCampaignSchema.safeParse(processedData);
      
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid data', errors: parsed.error.errors });
      }
      
      const campaign = await storage.createCampaign(parsed.data);

      if (recipients && Array.isArray(recipients) && recipients.length > 0) {
        const { inserted, skipped } = await storage.insertCampaignRecipientsBulk(
          campaign.id,
          userId,
          organizationId,
          recipients
        );
        await storage.updateCampaignStats(campaign.id, userId, organizationId, {
          totalRecipients: inserted,
        });
        if (inserted === 0) {
          return res.status(400).json({
            message: "No valid recipients (check phone numbers).",
            skipped,
          });
        }
      }

      res.json(campaign);
    } catch (error: any) {
      console.error('Error creating campaign:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/campaigns/:id', ...withOrgContext, requirePermission('manage_campaigns.view'), async (req: any, res) => {
    try {
      const { organizationId } = req.context;
      const { id } = req.params;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const campaign = await storage.getCampaignByOrganization(id, organizationId);
      if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
      res.json(campaign);
    } catch (error: any) {
      console.error('Error getting campaign:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/campaigns/:id/button-clicks', ...withOrgContext, requirePermission('manage_campaigns.view'), async (req: any, res) => {
    try {
      const { organizationId } = req.context;
      const { id: campaignId } = req.params;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const campaign = await storage.getCampaignByOrganization(campaignId, organizationId);
      if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
      const counts = await storage.getCampaignButtonClickCounts(campaignId);
      res.json(counts);
    } catch (error: any) {
      console.error('Error getting campaign button clicks:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/campaigns/:id/cta-recipients', ...withOrgContext, requirePermission('manage_campaigns.view'), async (req: any, res) => {
    try {
      const { organizationId } = req.context;
      const { id: campaignId } = req.params;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const campaign = await storage.getCampaignByOrganization(campaignId, organizationId);
      if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
      const recipientIds = await storage.getCampaignUniqueButtonClickRecipients(campaignId);
      res.json(recipientIds);
    } catch (error: any) {
      console.error('Error getting CTA recipients:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/campaigns/:id/reports/:kind', ...withOrgContext, requirePermission('manage_campaigns.view'), async (req: any, res) => {
    try {
      const { organizationId } = req.context;
      const { id: campaignId, kind } = req.params;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const campaign = await storage.getCampaignByOrganization(campaignId, organizationId);
      if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

      const csvEscape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
      const sendCsv = (filename: string, headers: string[], rows: unknown[][]) => {
        const body = [headers.join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join("\n");
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.send(body);
      };

      const stamp = new Date().toISOString().slice(0, 10);
      const safeName = String(campaign.name || "campaign").replace(/[^\w.-]+/g, "_");

      if (kind === "button-clicks") {
        const rows = await storage.getCampaignButtonClickReport(campaignId);
        return sendCsv(
          `${safeName}_button_clicks_${stamp}.csv`,
          ["Phone", "Name", "Button ID", "Button Title", "Clicked At"],
          rows.map((r) => [r.phoneNumber, r.name || "", r.buttonId, r.buttonTitle, r.clickedAt?.toISOString?.() || r.clickedAt])
        );
      }

      if (kind === "url-clicks") {
        const rows = await storage.getCampaignUrlClickReport(campaignId, organizationId);
        return sendCsv(
          `${safeName}_url_clicks_${stamp}.csv`,
          ["Destination URL", "Tracking Code", "Clicked At", "IP"],
          rows.map((r) => [r.destinationUrl, r.code, r.clickedAt?.toISOString?.() || r.clickedAt, r.ip || ""])
        );
      }

      if (kind === "delivery" || kind === "read" || kind === "failed" || kind === "status") {
        const recipients = await storage.getCampaignRecipientsByOrganization(campaignId, organizationId);
        const wanted = kind === "status" ? recipients : recipients.filter((r) => {
          if (kind === "delivery") return !!r.deliveredAt || r.status === "delivered" || r.status === "read";
          if (kind === "read") return !!r.readAt || r.status === "read";
          return r.status === "failed";
        });
        return sendCsv(
          `${safeName}_${kind}_${stamp}.csv`,
          ["Phone", "Name", "Status", "Sent At", "Delivered At", "Read At", "Error"],
          wanted.map((r) => [
            r.phoneNumber,
            r.name || "",
            r.status,
            r.sentAt || "",
            r.deliveredAt || "",
            r.readAt || "",
            r.errorMessage || "",
          ])
        );
      }

      return res.status(400).json({ message: "Unknown report kind" });
    } catch (error: any) {
      console.error("Error exporting campaign report:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/campaigns/:id/cta-timestamps', ...withOrgContext, requirePermission('manage_campaigns.view'), async (req: any, res) => {
    try {
      const { organizationId } = req.context;
      const { id: campaignId } = req.params;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const campaign = await storage.getCampaignByOrganization(campaignId, organizationId);
      if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
      const timestampMap = await storage.getCampaignRecipientButtonClickTimestamps(campaignId);
      const result = Object.fromEntries(timestampMap);
      res.json(result);
    } catch (error: any) {
      console.error('Error getting CTA timestamps:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch('/api/campaigns/:id', ...withOrgContext, requirePermission('manage_campaigns.edit'), async (req: any, res) => {
    try {
      const { organizationId } = req.context;
      const { id } = req.params;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const updated = await storage.updateCampaignByOrganization(id, organizationId, req.body);
      if (!updated) return res.status(404).json({ message: 'Campaign not found' });
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating campaign:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/campaigns/:id', ...withOrgContext, requirePermission('manage_campaigns.delete'), async (req: any, res) => {
    try {
      const { organizationId } = req.context;
      const { id } = req.params;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      await storage.deleteCampaignByOrganization(id, organizationId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting campaign:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Execute campaign (trigger message sending)
  app.post('/api/campaigns/:id/execute', ...withOrgContext, requirePermission('manage_campaigns.send'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { organizationId } = req.context;
      const { id } = req.params;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const campaign = await storage.getCampaignByOrganization(id, organizationId);
      if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
      const wait =
        String(req.query?.wait || req.query?.sync || '').toLowerCase() === 'true' ||
        String(req.headers['x-campaign-wait'] || '').toLowerCase() === 'true';
      if (!wait) {
        void enqueueCampaignExecution(id, userId, organizationId)
          .then((r) =>
            console.log(`[Campaign Execute] Background finished ${id} sent=${r.sentCount} failed=${r.failedCount}`)
          )
          .catch((err) => console.error(`[Campaign Execute] Background error ${id}:`, err));
        return res.status(202).json({
          accepted: true,
          campaignId: id,
          message:
            'Campaign is sending in the background. Refresh this page in a minute to see delivery progress; large lists no longer block on the request timeout.',
        });
      }
      const result = await enqueueCampaignExecution(id, userId, organizationId);
      const recipients = await storage.getCampaignRecipientsByOrganization(id, organizationId);
      const sentRecipients = recipients.filter(r => r.status === 'sent' || r.status === 'delivered' || r.status === 'read');
      res.json({
        success: result.success,
        sentCount: result.sentCount,
        failedCount: result.failedCount,
        errors: result.errors.length > 0 ? result.errors : undefined,
        messageIds: sentRecipients.map(r => ({
          phoneNumber: r.phoneNumber,
          messageId: r.messageId,
          status: r.status,
          sentAt: r.sentAt,
        })),
        note: result.sentCount > 0
          ? "Messages accepted by WhatsApp API. Delivery status will be updated via webhook. If messages are not received, check: 1) Template approval status, 2) Phone number format, 3) Webhook configuration, 4) Recipient has not blocked the number"
          : undefined,
      });
    } catch (error: any) {
      console.error('Error executing campaign:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/campaigns/:id/cancel', ...withOrgContext, requirePermission('manage_campaigns.edit'), async (req: any, res) => {
    try {
      const { organizationId } = req.context;
      const { id } = req.params;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const campaign = await storage.getCampaignByOrganization(id, organizationId);
      if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
      if (campaign.status !== 'running' && campaign.status !== 'scheduled') {
        return res.status(400).json({ message: 'Campaign can only be cancelled if it is running or scheduled' });
      }
      await storage.updateCampaignExecutionByOrganization(id, organizationId, { status: 'failed', completedAt: new Date() });
      res.json({ success: true, message: 'Campaign cancelled successfully' });
    } catch (error: any) {
      console.error('Error cancelling campaign:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Campaign recipients
  app.get('/api/campaigns/:id/recipients', ...withOrgContext, requirePermission('manage_campaigns.view'), async (req: any, res) => {
    try {
      const { organizationId } = req.context;
      const { id } = req.params;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const campaign = await storage.getCampaignByOrganization(id, organizationId);
      if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
      const recipients = await storage.getCampaignRecipientsByOrganization(id, organizationId);
      res.json(recipients);
    } catch (error: any) {
      console.error('Error getting campaign recipients:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Restart campaign for failed recipients only (optional: include delivery failures)
  app.post('/api/campaigns/:id/restart-failed', ...withOrgContext, requirePermission('manage_campaigns.send'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { organizationId } = req.context;
      const { id } = req.params;
      const includeDeliveryFailures =
        req.body?.includeDeliveryFailures === true ||
        String(req.query?.includeDeliveryFailures || '').toLowerCase() === 'true';
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const campaign = await storage.getCampaignByOrganization(id, organizationId);
      if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
      const recipients = await storage.getCampaignRecipientsByOrganization(id, organizationId);
      const failedRecipients = recipients.filter((r) => {
        if (r.status !== 'failed') return false;
        if (!r.messageId) return true;
        return includeDeliveryFailures;
      });
      if (failedRecipients.length === 0) {
        const deliveryFailedOnly = recipients.filter((r) => r.status === 'failed' && r.messageId).length;
        const sendFailedOnly = recipients.filter((r) => r.status === 'failed' && !r.messageId).length;
        return res.status(400).json({
          message:
            deliveryFailedOnly > 0 && !includeDeliveryFailures
              ? `${deliveryFailedOnly} message(s) failed at delivery. Use includeDeliveryFailures=true to manually retry (may send duplicates).`
              : sendFailedOnly > 0
                ? 'No failed recipients to restart'
                : 'No failed recipients to restart',
          deliveryFailedCount: deliveryFailedOnly,
          sendFailedCount: sendFailedOnly,
        });
      }
      for (const recipient of failedRecipients) {
        if (includeDeliveryFailures && recipient.messageId) {
          await db
            .update(campaignRecipients)
            .set({
              status: 'pending',
              messageId: null,
              errorMessage: null,
              sentAt: null,
              deliveredAt: null,
              readAt: null,
            })
            .where(eq(campaignRecipients.id, recipient.id));
        } else {
          await storage.updateCampaignRecipientStatusByOrganization(recipient.id, organizationId, 'pending');
        }
      }
      const wait =
        String(req.query?.wait || req.query?.sync || '').toLowerCase() === 'true' ||
        String(req.headers['x-campaign-wait'] || '').toLowerCase() === 'true';
      if (!wait) {
        void enqueueCampaignExecution(id, userId, organizationId)
          .then((r) =>
            console.log(`[Campaign Restart] Background finished ${id} sent=${r.sentCount} failed=${r.failedCount}`)
          )
          .catch((err) => console.error(`[Campaign Restart] Background error ${id}:`, err));
        return res.status(202).json({
          accepted: true,
          campaignId: id,
          message: `Retry queued for ${failedRecipients.length} recipient(s) in the background.`,
        });
      }
      const result = await enqueueCampaignExecution(id, userId, organizationId);
      res.json({
        success: result.success,
        message: `Restarted campaign for ${failedRecipients.length} failed recipient(s)`,
        sentCount: result.sentCount,
        failedCount: result.failedCount,
      });
    } catch (error: any) {
      console.error('Error restarting failed recipients:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Endpoint to compare two campaigns and diagnose session/credential differences
  app.get('/api/campaigns/compare/:id1/:id2', ...withOrgContext, requirePermission('manage_campaigns.view'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { organizationId } = req.context;
      const { id1, id2 } = req.params;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const campaign1 = await storage.getCampaignByOrganization(id1, organizationId);
      const campaign2 = await storage.getCampaignByOrganization(id2, organizationId);
      if (!campaign1 || !campaign2) return res.status(404).json({ error: 'One or both campaigns not found' });
      
      const session1 = await storage.getSession(campaign1.sessionId);
      const session2 = await storage.getSession(campaign2.sessionId);
      
      const creds1 = businessAPIManager['credentials'].get(campaign1.sessionId);
      const creds2 = businessAPIManager['credentials'].get(campaign2.sessionId);
      
      // Check if credentials can be restored from database
      let canRestore1 = false;
      let canRestore2 = false;
      let restoreError1: string | null = null;
      let restoreError2: string | null = null;
      
      if (!creds1 && session1?.connectionType === 'official') {
        try {
          const integration1 = await storage.getIntegrationByName("whatsapp-business", userId, organizationId);
          if (integration1?.status === "connected" && integration1.credentials) {
            canRestore1 = true;
          } else {
            const settings1 = await storage.getUserSettings(userId);
            if (settings1?.whatsappBusinessCredentials?.accessToken) {
              canRestore1 = true;
            } else {
              restoreError1 = 'No credentials found in integrations or user settings';
            }
          }
        } catch (e: any) {
          restoreError1 = e.message;
        }
      }
      
      if (!creds2 && session2?.connectionType === 'official') {
        try {
          const integration2 = await storage.getIntegrationByName("whatsapp-business", userId, organizationId || null);
          if (integration2?.status === "connected" && integration2.credentials) {
            canRestore2 = true;
          } else {
            const settings2 = await storage.getUserSettings(userId);
            if (settings2?.whatsappBusinessCredentials?.accessToken) {
              canRestore2 = true;
            } else {
              restoreError2 = 'No credentials found in integrations or user settings';
            }
          }
        } catch (e: any) {
          restoreError2 = e.message;
        }
      }
      
      res.json({
        campaign1: {
          id: campaign1.id,
          name: campaign1.name,
          sessionId: campaign1.sessionId,
          sessionStatus: session1?.status,
          connectionType: session1?.connectionType,
          phoneNumberId: session1?.deviceInfo?.apiPhoneNumberId || creds1?.phoneNumberId,
          hasCredentials: !!creds1,
          canRestoreCredentials: canRestore1,
          restoreError: restoreError1,
          businessAccountId: session1?.deviceInfo?.businessAccountId || creds1?.businessAccountId,
        },
        campaign2: {
          id: campaign2.id,
          name: campaign2.name,
          sessionId: campaign2.sessionId,
          sessionStatus: session2?.status,
          connectionType: session2?.connectionType,
          phoneNumberId: session2?.deviceInfo?.apiPhoneNumberId || creds2?.phoneNumberId,
          hasCredentials: !!creds2,
          canRestoreCredentials: canRestore2,
          restoreError: restoreError2,
          businessAccountId: session2?.deviceInfo?.businessAccountId || creds2?.businessAccountId,
        },
        differences: {
          sameSession: campaign1.sessionId === campaign2.sessionId,
          samePhoneNumberId: (session1?.deviceInfo?.apiPhoneNumberId || creds1?.phoneNumberId) === (session2?.deviceInfo?.apiPhoneNumberId || creds2?.phoneNumberId),
          bothHaveCredentials: !!creds1 && !!creds2,
          bothConnected: session1?.status === 'connected' && session2?.status === 'connected',
          bothCanRestore: canRestore1 && canRestore2,
        },
        diagnosis: campaign1.sessionId !== campaign2.sessionId
          ? 'Campaigns use different sessions. Check if both sessions are connected and have valid credentials.'
          : !creds1 || !creds2
          ? canRestore1 && canRestore2
            ? 'Credentials are missing from memory but can be restored from database. Use the /api/sessions/:sessionId/refresh-credentials endpoint to restore them.'
            : 'Credentials are missing and cannot be restored. Please reconnect your WhatsApp Business integration.'
          : (session1?.deviceInfo?.apiPhoneNumberId || creds1?.phoneNumberId) !== (session2?.deviceInfo?.apiPhoneNumberId || creds2?.phoneNumberId)
          ? 'Phone number IDs differ between campaigns. This may indicate a credential refresh or session update.'
          : 'Both campaigns appear to use the same session and credentials. Check phone number ID validity.',
      });
    } catch (error: any) {
      console.error('Error comparing campaigns:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Endpoint to manually refresh/restore credentials for a session
  app.post('/api/sessions/:sessionId/refresh-credentials', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { sessionId } = req.params;
      
      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      if (session.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      if (session.connectionType !== 'official') {
        return res.status(400).json({ error: 'This endpoint is only for WhatsApp Business API sessions' });
      }
      
      // Try to restore credentials
      let accessToken: string | null = null;
      let phoneNumberId: string | null = null;
      let businessAccountId: string | null = null;
      let source: string = '';
      
      // First, try integrations table
      try {
        const integration = await storage.getIntegrationByName("whatsapp-business", userId, session.organizationId || null);
        if (integration?.status === "connected" && integration.credentials) {
          const credentials = integration.credentials as any;
          accessToken = credentials.access_token;
          phoneNumberId = session.deviceInfo?.apiPhoneNumberId || credentials.phone_number_id;
          businessAccountId = session.deviceInfo?.businessAccountId || credentials.business_account_id;
          source = 'integrations';
        }
      } catch (integrationError: any) {
        console.log(`[Refresh Credentials] Could not get from integration:`, integrationError.message);
      }
      
      // Fall back to user settings
      if (!accessToken) {
        const settings = await storage.getUserSettings(userId);
        if (settings?.whatsappBusinessCredentials?.accessToken) {
          accessToken = settings.whatsappBusinessCredentials.accessToken;
          phoneNumberId = settings.whatsappBusinessCredentials.phoneNumberId || session.deviceInfo?.apiPhoneNumberId;
          businessAccountId = settings.whatsappBusinessCredentials.businessAccountId || session.deviceInfo?.businessAccountId;
          source = 'user_settings';
        }
      }
      
      if (!accessToken || !phoneNumberId) {
        return res.status(400).json({ 
          error: 'Credentials not found in database. Please reconnect your WhatsApp Business integration.',
          details: {
            hasIntegration: !!await storage.getIntegrationByName("whatsapp-business", userId, session.organizationId || undefined).catch(() => null),
            hasUserSettings: !!(await storage.getUserSettings(userId))?.whatsappBusinessCredentials,
          }
        });
      }
      
      // Restore session
      if (!phoneNumberId) {
        return res.status(400).json({ 
          error: 'Phone number ID not found. Please reconnect your WhatsApp Business integration.',
        });
      }
      
      await businessAPIManager.restoreSession(sessionId, {
        phoneNumberId: phoneNumberId,
        accessToken: accessToken,
        businessAccountId: businessAccountId || undefined,
      });
      
      // Verify credentials are now in memory
      const creds = businessAPIManager['credentials'].get(sessionId);
      
      res.json({
        success: true,
        message: 'Credentials restored successfully',
        source,
        sessionId,
        phoneNumberId,
        hasCredentials: !!creds,
        note: 'Credentials have been restored to memory. Campaigns should now work.',
      });
    } catch (error: any) {
      console.error('Error refreshing credentials:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Diagnostic endpoint for campaign message delivery
  app.get('/api/campaigns/:id/delivery-status', ...withOrgContext, requirePermission('manage_campaigns.view'), async (req: any, res) => {
    try {
      const { organizationId } = req.context;
      const { id } = req.params;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const campaign = await storage.getCampaignByOrganization(id, organizationId);
      if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
      const recipients = await storage.getCampaignRecipientsByOrganization(id, organizationId);
      const session = await storage.getSession(campaign.sessionId);
      
      const campaignMessages = await storage.getMessagesByCampaignId(campaign.sessionId, id);
      
      const statusSummary = {
        total: recipients.length,
        pending: recipients.filter(r => r.status === 'pending').length,
        sent: recipients.filter(r => r.status === 'sent').length,
        delivered: recipients.filter(r => r.status === 'delivered').length,
        read: recipients.filter(r => r.status === 'read').length,
        failed: recipients.filter(r => r.status === 'failed').length,
      };
      
      const recipientsWithDetails = recipients.map(r => {
        const message = campaignMessages.find(m => m.whatsappMessageId === r.messageId || m.id === r.messageId);
        return {
          phoneNumber: r.phoneNumber,
          name: r.name,
          status: r.status,
          messageId: r.messageId,
          whatsappMessageId: message?.whatsappMessageId,
          sentAt: r.sentAt,
          deliveredAt: r.deliveredAt,
          readAt: r.readAt,
          errorMessage: r.errorMessage,
        };
      });
      
      res.json({
        campaignId: id,
        campaignName: campaign.name,
        sessionId: campaign.sessionId,
        sessionStatus: session?.status,
        connectionType: session?.connectionType,
        templateId: campaign.templateId,
        templateName: campaign.messageTemplate,
        statusSummary,
        recipients: recipientsWithDetails,
        diagnostics: {
          webhookConfigured: session?.connectionType === 'official' ? 'Check Meta Business Manager webhook settings' : 'N/A (unofficial connection)',
          templateApproval: campaign.templateId ? 'Check template status in Meta Business Manager' : 'N/A',
          note: 'If messages show as "sent" but not delivered, check: 1) Template approval status, 2) Phone number format, 3) Webhook receiving status updates, 4) Recipient has not blocked the number',
          webhookUrl: session?.connectionType === 'official' 
            ? `${req.protocol}://${req.get('host')}/api/webhooks/whatsapp-business`
            : 'N/A',
        },
      });
    } catch (error: any) {
      console.error('Error getting campaign delivery status:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Endpoint to check webhook status and verify message IDs
  app.get('/api/campaigns/:id/check-status', ...withOrgContext, requirePermission('manage_campaigns.view'), async (req: any, res) => {
    try {
      const { organizationId } = req.context;
      const { id } = req.params;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const campaign = await storage.getCampaignByOrganization(id, organizationId);
      if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
      const recipients = await storage.getCampaignRecipientsByOrganization(id, organizationId);
      const session = await storage.getSession(campaign.sessionId);
      
      if (session?.connectionType !== 'official') {
        return res.json({
          message: 'This endpoint is only for WhatsApp Business API campaigns',
          connectionType: session?.connectionType,
        });
      }

      // Verify message IDs
      const creds = businessAPIManager['credentials'].get(campaign.sessionId);
      if (!creds) {
        return res.status(400).json({ error: 'Business API credentials not found for this session' });
      }

      const verificationResults = await Promise.all(
        recipients
          .filter(r => r.messageId && r.status === 'sent')
          .map(async (r) => {
            try {
              const verification = await businessAPIManager.verifyMessageId(campaign.sessionId, r.messageId);
              return {
                phoneNumber: r.phoneNumber,
                messageId: r.messageId,
                status: r.status,
                verified: verification.valid,
                error: verification.error,
              };
            } catch (error: any) {
              return {
                phoneNumber: r.phoneNumber,
                messageId: r.messageId,
                status: r.status,
                verified: false,
                error: error.message,
              };
            }
          })
      );

      // Check recent webhook activity (last 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recentStatusUpdates = await storage.countCampaignDeliveriesSince(
        campaign.sessionId,
        id,
        fiveMinutesAgo
      );

      res.json({
        campaignId: id,
        sessionId: campaign.sessionId,
        messageVerification: verificationResults,
        webhookActivity: {
          recentUpdates: recentStatusUpdates,
          note: recentStatusUpdates === 0 
            ? 'No recent status updates received. Check webhook configuration in Meta Business Manager.'
            : `${recentStatusUpdates} message(s) updated in the last 5 minutes.`,
        },
        webhookUrl: `${req.protocol}://${req.get('host')}/api/webhooks/whatsapp-business`,
        troubleshooting: {
          step1: 'Verify webhook is configured in Meta Business Manager',
          step2: 'Check webhook URL is accessible: ' + `${req.protocol}://${req.get('host')}/api/webhooks/whatsapp-business`,
          step3: 'Ensure webhook is subscribed to "messages" field',
          step4: 'Check server logs for webhook requests',
          step5: 'Wait a few minutes - delivery can take time',
        },
      });
    } catch (error: any) {
      console.error('Error checking campaign status:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/campaigns/:id/recipients', ...withOrgContext, requirePermission('manage_campaigns.edit'), async (req: any, res) => {
    try {
      const { organizationId } = req.context;
      const { id } = req.params;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const parsed = insertCampaignRecipientSchema.safeParse({ ...req.body, campaignId: id });
      if (!parsed.success) return res.status(400).json({ message: 'Invalid data', errors: parsed.error.errors });
      const recipient = await storage.addCampaignRecipientByOrganization(parsed.data, organizationId);
      res.json(recipient);
    } catch (error: any) {
      console.error('Error adding campaign recipient:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /** Append many recipients in one request (chunked insert; same validation as create campaign). */
  app.post('/api/campaigns/:id/recipients/bulk', ...withOrgContext, requirePermission('manage_campaigns.edit'), async (req: any, res) => {
    try {
      const { organizationId } = req.context;
      const { id } = req.params;
      if (!organizationId) return res.status(400).json({ message: 'Organization context required' });
      const list = req.body?.recipients;
      if (!Array.isArray(list) || list.length === 0) {
        return res.status(400).json({ message: 'Body must include recipients: non-empty array' });
      }
      const campaign = await storage.getCampaignByOrganization(id, organizationId);
      if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
      const { inserted, skipped } = await storage.insertCampaignRecipientsBulk(id, campaign.userId, organizationId, list);
      const all = await storage.getCampaignRecipientsByOrganization(id, organizationId);
      await storage.updateCampaignStats(id, campaign.userId, organizationId, { totalRecipients: all.length });
      res.json({ inserted, skipped, totalRecipients: all.length });
    } catch (error: any) {
      console.error('Error bulk-adding campaign recipients:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Cleanup endpoint - Delete all sessions, messages, templates, etc.
  app.post('/api/admin/cleanup-all-data', ...withAuthAndRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      console.log(`[Cleanup] User ${userId} requested full data cleanup`);

      // Import cleanup function
      const { cleanupAllData } = await import('./scripts/cleanup-all-data');
      
      // Also disconnect all active sessions
      const { businessAPIManager } = await import('./whatsapp/business-api-client');
      const { unofficialManager } = await import('./whatsapp/client');
      
      const allSessions = await storage.getAllSessions();
      
      // Disconnect all sessions
      for (const session of allSessions) {
        try {
          if (session.connectionType === 'official') {
            await businessAPIManager.disconnectSession(session.sessionId);
          } else {
            await unofficialManager.disconnectSession(session.sessionId);
          }
        } catch (e) {
          // Ignore errors if session doesn't exist
          console.log(`[Cleanup] Could not disconnect session ${session.sessionId}:`, e);
        }
      }

      // Run cleanup
      const result = await cleanupAllData();
      
      console.log(`[Cleanup] Cleanup completed by user ${userId}`);
      
      res.json({
        success: true,
        message: "All data has been cleaned up successfully",
        ...result,
      });
    } catch (error: any) {
      console.error('[Cleanup] Error during cleanup:', error);
      res.status(500).json({ 
        success: false,
        error: error.message || "Failed to cleanup data" 
      });
    }
  });

  // API Documentation – org-scoped: team members with api_endpoints.view see the same docs
  app.get('/api/api-docs/config', ...withOrgContext, requirePermission('api_endpoints.view'), async (req: any, res) => {
    try {
      let baseUrl = (process.env.BASE_URL || '').split(/\s*[\n#]/)[0].trim().replace(/\/+$/, '') || `${req.protocol}://${req.get('host')}`;
      const { API_DOC_ENDPOINTS } = await import('./api-docs-endpoints');
      const { getEndpointExamples } = await import('./api-docs-examples');
      const endpoints = API_DOC_ENDPOINTS.map(e => {
        const examples = getEndpointExamples(e.path, e.method, baseUrl);
        return {
          method: e.method,
          path: e.path,
          description: e.description,
          example: examples.curlExample ?? `curl -X ${e.method} ${baseUrl}${e.path} -H "Content-Type: application/json" -H "Authorization: Bearer YOUR_API_KEY"`,
          curlExample: examples.curlExample,
          requestBody: examples.requestBody,
          responseExample: examples.responseExample,
          parameters: examples.parameters,
          authHeader: examples.authHeader,
        };
      });
      res.json({ baseUrl, endpoints });
    } catch (error: any) {
      console.error('[API Docs] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/api-docs/postman-collection', ...withOrgContext, requirePermission('api_endpoints.view'), async (req: any, res) => {
    try {
      const baseUrl = (process.env.BASE_URL || '').split(/\s*[\n#]/)[0].trim().replace(/\/+$/, '') || `${req.protocol}://${req.get('host')}`;
      const candidateFiles = [
        path.resolve(process.cwd(), 'client/public/Project_API.postman_collection.json'),
        path.resolve(process.cwd(), 'docs/Project_API.postman_collection.json'),
      ];
      let collectionPath: string | null = null;
      for (const p of candidateFiles) {
        if (fs.existsSync(p)) {
          collectionPath = p;
          break;
        }
      }
      if (!collectionPath) {
        throw new Error('Project_API.postman_collection.json not found in client/public or docs.');
      }
      const raw = await fs.promises.readFile(collectionPath, 'utf8');
      const collection = JSON.parse(raw) as Record<string, any>;

      // Preserve existing collection format exactly; only align baseUrl at download time.
      if (!Array.isArray(collection.variable)) collection.variable = [];
      const baseVar = collection.variable.find((v: any) => v?.key === 'baseUrl');
      if (baseVar) baseVar.value = baseUrl;
      else collection.variable.push({ key: 'baseUrl', value: baseUrl });

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="whatsapp-panel-api-postman-collection.json"');
      res.json(collection);
    } catch (error: any) {
      console.error('[API Docs] Postman collection error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Large / slow multipart uploads: avoid closing the socket mid-transfer (Node 18+ defaults)
  httpServer.requestTimeout = 0;
  httpServer.headersTimeout = 180_000;

  return httpServer;
}

