/** Panel upload limits — shared by gallery, inbox, and server validation. */

export type PanelUploadMediaKind = "image" | "video" | "audio" | "document";

/** Max stored/sent size per media kind (matches WhatsApp-friendly limits). */
export const PANEL_UPLOAD_MAX_BYTES: Record<PanelUploadMediaKind, number> = {
  image: 2 * 1024 * 1024,
  video: 10 * 1024 * 1024,
  document: 5 * 1024 * 1024,
  audio: 5 * 1024 * 1024,
};

/** Multer ceiling — slightly above largest per-type limit for multipart overhead. */
export const PANEL_UPLOAD_MULTER_MAX_BYTES = 12 * 1024 * 1024;

/** Client image compressor: longest edge (px). */
export const PANEL_IMAGE_COMPRESS_MAX_DIMENSION = 1920;

/** JPEG/WebP quality 0–1 when compressing images in the browser. */
export const PANEL_IMAGE_COMPRESS_QUALITY = 0.82;

/** Skip compression when the file is already small enough. */
export const PANEL_IMAGE_COMPRESS_SKIP_BELOW_BYTES = 200 * 1024;

const VIDEO_EXT = /\.(mp4|webm|ogg|mov|m4v|mkv|avi|3gp)$/i;
const DOCUMENT_EXT = /\.(pdf|doc|docx|txt)$/i;
const AUDIO_EXT = /\.(mp3|wav|m4a|aac|flac|opus|oga|mpeg|mpg|weba|amr|caf)$/i;

const GALLERY_AUDIO_EXTS = new Set([
  ".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac", ".opus", ".oga",
  ".mpeg", ".mpg", ".weba", ".amr", ".caf",
]);

export function formatPanelUploadMaxMb(kind: PanelUploadMediaKind): string {
  const mb = PANEL_UPLOAD_MAX_BYTES[kind] / (1024 * 1024);
  return Number.isInteger(mb) ? `${mb}` : mb.toFixed(2);
}

export function formatPanelUploadLimitsSummary(): string {
  const parts: string[] = [
    `image: ${formatPanelUploadMaxMb("image")} MB`,
    `video: ${formatPanelUploadMaxMb("video")} MB`,
    `audio: ${formatPanelUploadMaxMb("audio")} MB`,
    `document: ${formatPanelUploadMaxMb("document")} MB`,
  ];
  return `Max size — ${parts.join(", ")}. Large images are compressed automatically.`;
}

export function panelUploadSizeError(kind: PanelUploadMediaKind): string {
  return `File size exceeds ${formatPanelUploadMaxMb(kind)} MB. Please upload a smaller ${kind} file.`;
}

export function classifyPanelUploadFile(
  file: { name: string; type: string },
): PanelUploadMediaKind | null {
  const mime = (file.type || "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";

  if (mime === "application/pdf" ||
    mime === "application/msword" ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "text/plain") {
    return "document";
  }

  if (mime === "" || mime === "application/octet-stream") {
    if (AUDIO_EXT.test(file.name)) return "audio";
    if (VIDEO_EXT.test(file.name)) return "video";
    if (DOCUMENT_EXT.test(file.name)) return "document";
  }

  if (DOCUMENT_EXT.test(file.name)) return "document";
  return null;
}

export function isPanelUploadFileAllowed(file: { name: string; type: string }): boolean {
  return classifyPanelUploadFile(file) !== null;
}

export function validatePanelUploadSize(
  kind: PanelUploadMediaKind,
  sizeBytes: number,
): string | null {
  const max = PANEL_UPLOAD_MAX_BYTES[kind];
  if (sizeBytes > max) return panelUploadSizeError(kind);
  return null;
}

export function validatePanelUploadFile(
  file: { name: string; type: string; size: number },
): { ok: true; kind: PanelUploadMediaKind } | { ok: false; error: string } {
  const kind = classifyPanelUploadFile(file);
  if (!kind) {
    return {
      ok: false,
      error: "Unsupported file type. Upload images, videos, audio, or documents.",
    };
  }
  const sizeErr = validatePanelUploadSize(kind, file.size);
  if (sizeErr) return { ok: false, error: sizeErr };
  return { ok: true, kind };
}

/** Server-side classification from multer file fields. */
export function classifyPanelUploadFromServer(
  mimetype: string,
  originalname: string,
): PanelUploadMediaKind {
  let fileType: PanelUploadMediaKind = "document";
  if (mimetype.startsWith("image/")) fileType = "image";
  else if (mimetype.startsWith("video/")) fileType = "video";
  else if (mimetype.startsWith("audio/")) fileType = "audio";

  const ext = originalname.includes(".")
    ? `.${originalname.split(".").pop()!.toLowerCase()}`
    : "";
  if (fileType === "document" && GALLERY_AUDIO_EXTS.has(ext)) {
    fileType = "audio";
  }
  return fileType;
}

export function assertPanelUploadSize(kind: PanelUploadMediaKind, sizeBytes: number): void {
  const err = validatePanelUploadSize(kind, sizeBytes);
  if (err) {
    const e = new Error(err);
    (e as Error & { statusCode?: number }).statusCode = 400;
    throw e;
  }
}
