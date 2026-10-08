/**
 * Build Meta Cloud API carousel template send payload (per-card header media upload + components).
 * Shared by /api/messages/send-text and campaign executor.
 */
import path from "path";
import { readUploadBuffer } from "../utils/media-storage";
import {
  shrinkImageBufferForWhatsAppCarousel,
  WHATSAPP_CAROUSEL_MAX_IMAGE_BYTES,
  WHATSAPP_CAROUSEL_MAX_VIDEO_BYTES,
} from "../utils/whatsapp-carousel-media";

/** Load image/video bytes for Meta marketing carousel (base64, http(s), /uploads/). */
export async function loadMediaBufferForCarousel(
  mediaUrl: string,
  format: "IMAGE" | "VIDEO"
): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
  if (mediaUrl.startsWith("blob:")) {
    throw new Error("Blob URLs must be converted to a data URL or uploaded path before submitting");
  }
  if (mediaUrl.startsWith("data:")) {
    const base64Match = mediaUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!base64Match) throw new Error("Invalid base64 data URL");
    const mimeType = base64Match[1];
    const buffer = Buffer.from(base64Match[2], "base64");
    const mimeToExt: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "image/webp": "webp",
      "video/mp4": "mp4",
      "video/quicktime": "mov",
    };
    const ext = mimeToExt[mimeType] || (format === "VIDEO" ? "mp4" : "jpg");
    const fileName = format === "VIDEO" ? `video.${ext}` : `image.${ext}`;
    return { buffer, fileName, mimeType };
  }
  let localPath: string | null = null;
  if (mediaUrl.startsWith("/uploads/")) {
    localPath = mediaUrl;
  } else if (mediaUrl.startsWith("http://") || mediaUrl.startsWith("https://")) {
    try {
      const u = new URL(mediaUrl);
      if (u.pathname.startsWith("/uploads/")) localPath = u.pathname;
    } catch {
      /* ignore */
    }
  }
  if (localPath) {
    const buffer = await readUploadBuffer(localPath);
    if (!buffer) throw new Error(`Media file not found: ${localPath}`);
    const fileName = path.basename(localPath);
    const ext = fileName.toLowerCase().split(".").pop();
    const mimeType =
      ext === "png"
        ? "image/png"
        : ext === "gif"
          ? "image/gif"
          : ext === "webp"
            ? "image/webp"
            : ext === "mp4"
              ? "video/mp4"
              : ext === "mov"
                ? "video/quicktime"
                : format === "VIDEO"
                  ? "video/mp4"
                  : "image/jpeg";
    return { buffer, fileName, mimeType };
  }
  if (mediaUrl.startsWith("http://") || mediaUrl.startsWith("https://")) {
    const mediaResponse = await fetch(mediaUrl);
    if (!mediaResponse.ok) throw new Error(`Failed to fetch media: ${mediaResponse.statusText}`);
    const buffer = Buffer.from(await mediaResponse.arrayBuffer());
    let rawFileName = mediaUrl.split("/").pop() || (format === "VIDEO" ? "video.mp4" : "image.jpg");
    rawFileName = rawFileName.replace(/[^a-zA-Z0-9._-]/g, "_") || (format === "VIDEO" ? "video.mp4" : "image.jpg");
    const contentType = mediaResponse.headers.get("content-type");
    const mimeType = contentType
      ? contentType.split(";")[0].trim()
      : format === "VIDEO"
        ? "video/mp4"
        : "image/jpeg";
    return { buffer, fileName: rawFileName, mimeType };
  }
  throw new Error("Invalid media URL for carousel (use base64 data URL, http(s), or /uploads/ path)");
}

function extractDynamicUrlSuffix(templateUrl: string, resolvedUrl: string): string {
  const tu = String(templateUrl || "");
  const idx = tu.indexOf("{{");
  if (idx < 0) return "";
  const prefix = tu.slice(0, idx);
  const ru = String(resolvedUrl || "");
  if (ru.startsWith(prefix)) {
    const rest = ru.slice(prefix.length);
    return rest.split(/[?#]/)[0] || "";
  }
  return "";
}

export function positionalVarNumbersInText(text: string): number[] {
  const positionalVarRegex = /\{\{\s*(\d+)\s*\}\}/g;
  const matches = Array.from(text.matchAll(positionalVarRegex));
  const raw = matches.map((m) => parseInt(m[1], 10));
  return Array.from(new Set(raw)).sort((a, b) => a - b);
}

function fillPositionalParamsFromFilledString(templateText: string, filled: string): string[] {
  const nums = positionalVarNumbersInText(templateText);
  if (nums.length === 0) return [];
  const f = String(filled || "").trim();
  if (nums.length === 1) return [f];
  const parts = f.split("|").map((s) => s.trim());
  return nums.map((n, i) => parts[i] ?? parts[parts.length - 1] ?? "");
}

/** Upload each card's media and build Cloud API carousel component (lowercase types). */
export async function buildOfficialCarouselSendPayload(
  sessionId: string,
  session: any,
  businessAPIManager: any,
  mediaCards: any[],
  carouselTplComp: any,
  sendTimeMediaUrls: string[]
): Promise<{ cards: any[] }> {
  const creds = businessAPIManager["credentials"].get(sessionId);
  if (!creds) throw new Error("Business API credentials not available");
  const businessAccountId = session?.deviceInfo?.wabaId || creds.businessAccountId;
  const tplCards = carouselTplComp?.cards || [];
  if (tplCards.length !== mediaCards.length) {
    throw new Error("Carousel template cards do not match saved media cards; recreate or sync the template.");
  }
  if (!Array.isArray(sendTimeMediaUrls) || sendTimeMediaUrls.length !== mediaCards.length) {
    throw new Error(
      `Carousel send requires exactly ${mediaCards.length} media URL(s) (one per card). Use the send dialog to select media for each card.`
    );
  }
  const outCards: any[] = [];
  for (let i = 0; i < mediaCards.length; i++) {
    const mc = mediaCards[i];
    const def = tplCards[i];
    const urlForCard = String(sendTimeMediaUrls[i] ?? "").trim();
    if (!urlForCard) {
      throw new Error(`Carousel card ${i + 1} has no media selected. Choose an image or video for each card.`);
    }
    const headerDef = def?.components?.find((c: any) => String(c.type || "").toUpperCase() === "HEADER");
    const hdrFormat = String(headerDef?.format || (mc.mediaType === "VIDEO" ? "VIDEO" : "IMAGE")).toUpperCase();
    const isVideo = hdrFormat === "VIDEO";
    let { buffer, fileName } = await loadMediaBufferForCarousel(urlForCard, isVideo ? "VIDEO" : "IMAGE");
    if (isVideo) {
      if (buffer.length > WHATSAPP_CAROUSEL_MAX_VIDEO_BYTES) {
        const mb = (buffer.length / (1024 * 1024)).toFixed(1);
        throw new Error(
          `Carousel card ${i + 1}: video is about ${mb}MB. WhatsApp allows at most 16MB per video. Use a shorter or more compressed MP4 (H.264 + AAC).`
        );
      }
    } else {
      if (buffer.length > WHATSAPP_CAROUSEL_MAX_IMAGE_BYTES) {
        console.log(
          `[Carousel] Card ${i + 1}: image ${(buffer.length / (1024 * 1024)).toFixed(2)}MB exceeds 5MB, compressing…`
        );
        const shrunk = await shrinkImageBufferForWhatsAppCarousel(buffer, fileName);
        buffer = shrunk.buffer;
        fileName = shrunk.fileName;
      }
    }
    const uploadResult = await businessAPIManager.uploadMediaWithCredentials(
      {
        phoneNumberId: creds.phoneNumberId,
        accessToken: creds.accessToken,
        businessAccountId,
      },
      buffer,
      fileName,
      isVideo ? "VIDEO" : "IMAGE",
      false
    );
    const mediaId = uploadResult.id;
    const cardComponents: any[] = [];
    if (isVideo) {
      cardComponents.push({
        type: "header",
        parameters: [{ type: "video", video: { id: mediaId } }],
      });
    } else {
      cardComponents.push({
        type: "header",
        parameters: [{ type: "image", image: { id: mediaId } }],
      });
    }
    const bodyDef = def?.components?.find((c: any) => String(c.type || "").toUpperCase() === "BODY");
    if (bodyDef?.text) {
      const nums = positionalVarNumbersInText(bodyDef.text);
      if (nums.length > 0) {
        const texts = fillPositionalParamsFromFilledString(bodyDef.text, mc.bodyText || "");
        cardComponents.push({
          type: "body",
          parameters: texts.map((t) => ({ type: "text", text: String(t ?? "") })),
        });
      }
    }
    const tplButtons =
      def?.components?.find((c: any) => String(c.type || "").toUpperCase() === "BUTTONS")?.buttons || [];
    const uiBtns = (mc.buttons || []).filter((b: any) => b?.text?.trim?.());
    for (let bi = 0; bi < tplButtons.length; bi++) {
      const tb = tplButtons[bi];
      const ub = uiBtns[bi];
      const bt = String(tb.type || "").toUpperCase();
      if (bt === "URL") {
        const tUrl = String(tb.url || "");
        if (/\{\{/.test(tUrl)) {
          const suffix = extractDynamicUrlSuffix(tUrl, String(ub?.url || ""));
          cardComponents.push({
            type: "button",
            sub_type: "url",
            index: String(bi),
            parameters: [{ type: "text", text: suffix || String(ub?.url || "").trim() || "link" }],
          });
        }
      } else if (bt === "QUICK_REPLY") {
        cardComponents.push({
          type: "button",
          sub_type: "quick_reply",
          index: String(bi),
          parameters: [
            {
              type: "payload",
              payload: String(ub?.text || tb.text || "reply").slice(0, 256),
            },
          ],
        });
      } else if (bt === "PHONE_NUMBER") {
        cardComponents.push({
          type: "button",
          sub_type: "phone_number",
          index: String(bi),
          parameters: [],
        });
      }
    }
    outCards.push({ card_index: i, components: cardComponents });
  }
  return { cards: outCards };
}
