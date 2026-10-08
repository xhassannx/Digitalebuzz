import type { Message, SendMediaMessage, SendTextMessage } from "@shared/schema";
import path from "path";
import { readUploadBuffer, resolveUploadLocalPath } from "./utils/media-storage";

export type PanelInboxSendTextResult = {
  success: true;
  messageId?: string;
  message: Message;
  warning?: string;
  isTemplate?: boolean;
  templateName?: string;
  verificationStatus?: string;
  deliveryHint?: {
    ifNotDelivered?: string;
    checkWebhook?: string;
    commonCauses?: string[];
  };
  note?: string;
};

export type PanelInboxSendMediaResult = {
  success: true;
  messageId?: string;
  message: Message;
};

export type PanelInboxSendTextHandler = (
  userId: string,
  organizationId: string | null,
  validatedData: SendTextMessage
) => Promise<PanelInboxSendTextResult>;

export type PanelInboxMediaUpload = {
  buffer: Buffer;
  originalname: string;
  mimetype?: string;
  /** Original gallery / uploads path for inbox preview when file is copied on send. */
  sourceMediaUrl?: string;
};

export type PanelInboxSendMediaHandler = (
  userId: string,
  organizationId: string | null,
  validatedData: SendMediaMessage,
  file: PanelInboxMediaUpload
) => Promise<PanelInboxSendMediaResult>;

let sendTextHandler: PanelInboxSendTextHandler | null = null;
let sendMediaHandler: PanelInboxSendMediaHandler | null = null;

export function registerPanelInboxSendText(handler: PanelInboxSendTextHandler): void {
  sendTextHandler = handler;
}

export function registerPanelInboxSendMedia(handler: PanelInboxSendMediaHandler): void {
  sendMediaHandler = handler;
}

export async function sendPanelTextMessage(
  userId: string,
  organizationId: string | null,
  validatedData: SendTextMessage
): Promise<PanelInboxSendTextResult> {
  if (!sendTextHandler) {
    throw new Error("Panel inbox send-text handler is not registered yet");
  }
  return sendTextHandler(userId, organizationId, validatedData);
}

export async function sendPanelMediaMessage(
  userId: string,
  organizationId: string | null,
  validatedData: SendMediaMessage,
  file: PanelInboxMediaUpload
): Promise<PanelInboxSendMediaResult> {
  if (!sendMediaHandler) {
    throw new Error("Panel inbox send-media handler is not registered yet");
  }
  return sendMediaHandler(userId, organizationId, validatedData, file);
}

/** Public panel URL for /uploads and gallery (never CUSTOMER_API_BASE_URL — that is the licensor admin portal). */
export function resolvePanelPublicBaseUrl(): string {
  const pick = (raw?: string) => {
    if (typeof raw !== "string" || !raw.trim()) return "";
    return raw.split(/\s*[\n#]/)[0].trim().replace(/\/+$/, "");
  };
  const baseUrl = pick(process.env.BASE_URL);
  const viteBase = pick(process.env.VITE_BASE_URL);
  if (baseUrl) return baseUrl;
  if (viteBase) return viteBase;
  return "http://localhost:5002";
}

const PANEL_BASE_URL = resolvePanelPublicBaseUrl();

/** Resolve flow media URL to an absolute URL (gallery / uploads on production host). */
export function resolveFlowMediaUrlForInbox(raw: string): string {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const u = new URL(trimmed);
      if (u.pathname.startsWith("/uploads/")) {
        return `${PANEL_BASE_URL}${u.pathname}`;
      }
    } catch {
      /* use as-is */
    }
    return trimmed;
  }
  if (trimmed.startsWith("/uploads/")) {
    return `${PANEL_BASE_URL}${trimmed}`;
  }
  return trimmed;
}

/** Read gallery/uploads media from disk or fetch from production when running locally. */
export async function loadPanelMediaBufferFromUrl(
  rawUrl: string
): Promise<{ buffer: Buffer; fileName: string }> {
  const trimmed = String(rawUrl || "").trim();
  if (!trimmed) throw new Error("Media URL is required");

  const resolved = resolveFlowMediaUrlForInbox(trimmed);
  let localPath: string | null = null;
  for (const candidate of [trimmed, resolved]) {
    if (candidate.startsWith("/uploads/")) {
      localPath = candidate;
      break;
    }
    if (candidate.startsWith("http://") || candidate.startsWith("https://")) {
      try {
        const u = new URL(candidate);
        if (u.pathname.startsWith("/uploads/")) {
          localPath = u.pathname;
          break;
        }
      } catch {
        /* ignore */
      }
    }
  }

  if (localPath) {
    const buffer = await readUploadBuffer(localPath);
    if (buffer) {
      let fileName = path.basename(localPath);
      const ext = path.extname(fileName);
      const base = path.basename(fileName, ext);
      const galleryMatch = base.match(/^(.+)-(\d{10,})-(\d+)$/);
      if (galleryMatch) {
        fileName = `${galleryMatch[1]}${ext}`;
      }
      return { buffer, fileName };
    }
  }

  const fetchUrl =
    resolved.startsWith("http://") || resolved.startsWith("https://")
      ? resolved
      : localPath
        ? `${PANEL_BASE_URL}${localPath}`
        : trimmed;

  if (fetchUrl.startsWith("http://") || fetchUrl.startsWith("https://")) {
    const res = await fetch(fetchUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch media: ${fetchUrl}`);
    }
    const rawName =
      (localPath ? path.basename(localPath) : fetchUrl.split("/").pop()?.split("?")[0]) ||
      "media.bin";
    // Gallery uploads: originalName-timestamp-random.ext → prefer originalName.ext for WhatsApp display
    let fileName = rawName.includes(".") ? rawName : "media.jpg";
    const ext = path.extname(fileName);
    const base = path.basename(fileName, ext);
    const galleryMatch = base.match(/^(.+)-(\d{10,})-(\d+)$/);
    if (galleryMatch) {
      fileName = `${galleryMatch[1]}${ext}`;
    }
    return { buffer: Buffer.from(await res.arrayBuffer()), fileName };
  }

  throw new Error(`Invalid or unreachable media URL: ${trimmed}`);
}

function extFromMime(mime?: string): string {
  if (!mime) return "";
  const m = mime.toLowerCase().split(";")[0].trim();
  if (m === "image/jpeg") return ".jpg";
  if (m === "image/png") return ".png";
  if (m === "image/gif") return ".gif";
  if (m === "image/webp") return ".webp";
  if (m === "video/mp4") return ".mp4";
  if (m === "video/webm") return ".webm";
  if (m === "audio/ogg") return ".ogg";
  if (m === "audio/mpeg") return ".mp3";
  if (m === "application/pdf") return ".pdf";
  return "";
}

function normalizeUploadsPath(raw: string): string | null {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/uploads/")) return trimmed;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const u = new URL(trimmed);
      if (u.pathname.startsWith("/uploads/")) {
        return u.pathname;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

async function loadMediaBufferFromUrl(
  url: string
): Promise<{ buffer: Buffer; originalname: string; mimetype?: string; sourceMediaUrl?: string }> {
  const uploadsPath = normalizeUploadsPath(url);
  const resolved = uploadsPath || resolveFlowMediaUrlForInbox(url);
  if (resolved.startsWith("/uploads/")) {
    const loaded = await readUploadBuffer(resolved);
    if (loaded) {
      return {
        buffer: loaded,
        originalname: path.basename(resolved),
        sourceMediaUrl: resolved,
      };
    }
    const decodedPath = (() => {
      try {
        return decodeURIComponent(resolved);
      } catch {
        return resolved;
      }
    })();
    const remote = `${PANEL_BASE_URL}${decodedPath}`;
    const response = await fetch(remote);
    if (!response.ok) {
      throw new Error(`Failed to fetch media from ${remote}: ${response.status}`);
    }
    const contentType = response.headers.get("content-type") || undefined;
    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      originalname: path.basename(decodedPath) || "media",
      mimetype: contentType,
      sourceMediaUrl: decodedPath,
    };
  }

  const response = await fetch(resolved);
  if (!response.ok) {
    throw new Error(`Failed to fetch media from ${resolved}: ${response.status}`);
  }
  const contentType = response.headers.get("content-type") || undefined;
  let originalname = resolved.split("/").pop()?.split("?")[0] || "media";
  const ext = extFromMime(contentType);
  if (ext && !originalname.includes(".")) {
    originalname = `${originalname}${ext}`;
  }
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    originalname,
    mimetype: contentType,
    sourceMediaUrl: uploadsPath || undefined,
  };
}

function normalizeFlowMediaType(raw: string): SendMediaMessage["mediaType"] {
  const t = String(raw || "image").toLowerCase();
  if (t === "video") return "video";
  if (t === "audio") return "audio";
  if (t === "document") return "document";
  return "image";
}

/** Flow Send Media → same payload + buffer path as inbox POST /api/messages/send-media. */
export async function sendPanelMediaFromFlowUrl(
  userId: string,
  organizationId: string | null,
  opts: {
    sessionId: string;
    to: string;
    mediaUrl: string;
    mediaType?: string;
    caption?: string;
    fileName?: string;
  }
): Promise<PanelInboxSendMediaResult> {
  const file = await loadMediaBufferFromUrl(opts.mediaUrl);
  if (opts.fileName?.trim() && !/\{\{/.test(opts.fileName)) {
    let name = opts.fileName.trim();
    const ext = extFromMime(file.mimetype);
    if (ext && !path.extname(name)) {
      name = `${name}${ext}`;
    }
    file.originalname = name;
  } else if (!path.extname(file.originalname) && file.mimetype) {
    const ext = extFromMime(file.mimetype);
    if (ext) file.originalname = `${file.originalname}${ext}`;
  }
  const validatedData: SendMediaMessage = {
    sessionId: opts.sessionId,
    to: opts.to,
    caption: opts.caption,
    mediaType: normalizeFlowMediaType(opts.mediaType || "image"),
    footerButtonType: "NONE",
  };
  return sendPanelMediaMessage(userId, organizationId, validatedData, file);
}

/** Flow Send Template → same payload as inbox POST /api/messages/send-text with templateName. */
export async function sendPanelTemplateFromFlow(
  userId: string,
  organizationId: string | null,
  opts: {
    sessionId: string;
    to: string;
    templateName: string;
    templateLanguage?: string;
    templateParams?: string[];
    headerImageUrl?: string;
    headerVideoUrl?: string;
    headerDocumentUrl?: string;
    headerImageId?: string;
    headerVideoId?: string;
    headerDocumentId?: string;
    carouselCardMediaUrls?: string[];
  }
): Promise<PanelInboxSendTextResult> {
  let headerImageUrl = opts.headerImageUrl?.trim();
  if (!headerImageUrl && organizationId) {
    const { storage } = await import("./storage");
    const fallback = await storage.getDefaultTemplateHeaderImageUrl(
      organizationId,
      opts.templateName
    );
    if (fallback) {
      headerImageUrl = fallback;
      console.log(
        `[Automation] Using campaign gallery header for template "${opts.templateName}": ${fallback}`
      );
    }
  }

  const payload: SendTextMessage = {
    sessionId: opts.sessionId,
    to: opts.to,
    templateName: opts.templateName,
    templateLanguage: opts.templateLanguage || "en",
    templateParams: opts.templateParams,
    footerButtonType: "NONE",
  };

  if (headerImageUrl) payload.headerImageUrl = resolveFlowMediaUrlForInbox(headerImageUrl);
  if (opts.headerVideoUrl?.trim()) {
    payload.headerVideoUrl = resolveFlowMediaUrlForInbox(opts.headerVideoUrl);
  }
  if (opts.headerDocumentUrl?.trim()) {
    payload.headerDocumentUrl = resolveFlowMediaUrlForInbox(opts.headerDocumentUrl);
  }
  if (opts.headerImageId?.trim()) payload.headerImageId = opts.headerImageId.trim();
  if (opts.headerVideoId?.trim()) payload.headerVideoId = opts.headerVideoId.trim();
  if (opts.headerDocumentId?.trim()) payload.headerDocumentId = opts.headerDocumentId.trim();
  if (opts.carouselCardMediaUrls?.length) {
    payload.carouselCardMediaUrls = opts.carouselCardMediaUrls.map((u) =>
      resolveFlowMediaUrlForInbox(String(u ?? ""))
    );
  }

  return sendPanelTextMessage(userId, organizationId, payload);
}

/** Flow Send Message → inbox POST /api/messages/send-text (plain text). */
export async function sendPanelTextFromFlow(
  userId: string,
  organizationId: string | null,
  opts: { sessionId: string; to: string; message: string }
): Promise<PanelInboxSendTextResult> {
  return sendPanelTextMessage(userId, organizationId, {
    sessionId: opts.sessionId,
    to: opts.to,
    message: opts.message,
    templateLanguage: "en",
    footerButtonType: "NONE",
  });
}
