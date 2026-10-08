import sharp from "sharp";

/** WhatsApp Cloud API typical limits for /{phone-number-id}/media (carousel headers use same upload). */
export const WHATSAPP_CAROUSEL_MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
export const WHATSAPP_CAROUSEL_MAX_VIDEO_BYTES = 16 * 1024 * 1024; // 16 MB

/**
 * If the image is over WhatsApp's 5MB cap, re-encode as JPEG with resize + quality reduction.
 * PNG/GIF/WebP inputs are converted to JPEG (WhatsApp template headers are JPEG/PNG-friendly).
 */
export async function shrinkImageBufferForWhatsAppCarousel(
  input: Buffer,
  fileName: string
): Promise<{ buffer: Buffer; fileName: string }> {
  const MAX = WHATSAPP_CAROUSEL_MAX_IMAGE_BYTES;
  if (input.length <= MAX) {
    return { buffer: input, fileName };
  }

  let maxDim = 2048;
  let quality = 82;
  let out: Buffer | null = null;

  for (let round = 0; round < 24; round++) {
    out = await sharp(input)
      .rotate()
      .resize({ width: maxDim, height: maxDim, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true, chromaSubsampling: "4:2:0" })
      .toBuffer();
    if (out.length <= MAX) break;
    if (quality > 42) quality -= 6;
    else {
      maxDim = Math.floor(maxDim * 0.87);
      quality = 76;
    }
    if (maxDim < 360) break;
  }

  if (!out || out.length > MAX) {
    const mb = (input.length / (1024 * 1024)).toFixed(2);
    throw new Error(
      `Carousel image is too large (${mb}MB) and could not be compressed under WhatsApp’s 5MB limit. Use a smaller or lower-resolution image.`
    );
  }

  const base = fileName.replace(/\.[^.]+$/, "") || "image";
  return { buffer: out, fileName: `${base}.jpg` };
}
