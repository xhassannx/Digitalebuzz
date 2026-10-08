import {
  PANEL_IMAGE_COMPRESS_MAX_DIMENSION,
  PANEL_IMAGE_COMPRESS_QUALITY,
  PANEL_IMAGE_COMPRESS_SKIP_BELOW_BYTES,
  PANEL_UPLOAD_MAX_BYTES,
} from "@shared/panel-upload-limits";

export type CompressImageResult = {
  file: File;
  compressed: boolean;
  savedBytes: number;
};

const NON_COMPRESSIBLE = new Set(["image/gif", "image/svg+xml"]);

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image for compression"));
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Image compression failed"));
      },
      type,
      quality,
    );
  });
}

function scaledDimensions(
  width: number,
  height: number,
  maxDimension: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxDimension) {
    return { width, height };
  }
  const scale = maxDimension / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function outputName(originalName: string, mime: string): string {
  const base = originalName.replace(/\.[^.]+$/, "") || "image";
  if (mime === "image/png") return `${base}.png`;
  if (mime === "image/webp") return `${base}.webp`;
  return `${base}.jpg`;
}

/**
 * Resize and re-encode raster images in the browser to cut upload size and egress cost.
 * GIF/SVG are returned unchanged. PNG with transparency stays PNG when smaller; otherwise JPEG.
 */
export async function compressImageFile(file: File): Promise<CompressImageResult> {
  if (!file.type.startsWith("image/") || NON_COMPRESSIBLE.has(file.type)) {
    return { file, compressed: false, savedBytes: 0 };
  }

  const maxBytes = PANEL_UPLOAD_MAX_BYTES.image;
  const needsSizeWork =
    file.size > PANEL_IMAGE_COMPRESS_SKIP_BELOW_BYTES || file.size > maxBytes;

  let img: HTMLImageElement;
  try {
    img = await loadImageFromFile(file);
  } catch {
    return { file, compressed: false, savedBytes: 0 };
  }

  const initial = scaledDimensions(
    img.naturalWidth || img.width,
    img.naturalHeight || img.height,
    PANEL_IMAGE_COMPRESS_MAX_DIMENSION,
  );

  const alreadySmall =
    !needsSizeWork &&
    initial.width === (img.naturalWidth || img.width) &&
    initial.height === (img.naturalHeight || img.height);

  if (alreadySmall) {
    return { file, compressed: false, savedBytes: 0 };
  }

  let dimension = PANEL_IMAGE_COMPRESS_MAX_DIMENSION;
  let bestBlob: Blob | null = null;

  while (dimension >= 640) {
    const { width, height } = scaledDimensions(
      img.naturalWidth || img.width,
      img.naturalHeight || img.height,
      dimension,
    );

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) break;
    ctx.drawImage(img, 0, 0, width, height);

    const tryEncode = async (mime: string, quality: number) =>
      canvasToBlob(canvas, mime, quality);

    const candidates: Blob[] = [];
    if (file.type === "image/png") {
      candidates.push(await tryEncode("image/png", PANEL_IMAGE_COMPRESS_QUALITY));
    } else if (file.type === "image/webp") {
      candidates.push(await tryEncode("image/webp", PANEL_IMAGE_COMPRESS_QUALITY));
    }

    let quality = PANEL_IMAGE_COMPRESS_QUALITY;
    while (quality >= 0.45) {
      candidates.push(await tryEncode("image/jpeg", quality));
      quality -= 0.1;
    }

    const underLimit = candidates
      .filter((b) => b.size <= maxBytes)
      .sort((a, b) => a.size - b.size);
    const picked =
      underLimit[0] ??
      candidates.sort((a, b) => a.size - b.size)[0] ??
      null;

    if (picked && (picked.size < file.size || file.size > maxBytes)) {
      bestBlob = picked;
      if (picked.size <= maxBytes) break;
    }

    dimension = Math.round(dimension * 0.75);
  }

  if (!bestBlob || bestBlob.size >= file.size) {
    return { file, compressed: false, savedBytes: 0 };
  }

  const mime = bestBlob.type || "image/jpeg";
  const out = new File([bestBlob], outputName(file.name, mime), {
    type: mime,
    lastModified: Date.now(),
  });

  return {
    file: out,
    compressed: true,
    savedBytes: Math.max(0, file.size - out.size),
  };
}
