// @ts-nocheck
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

let workerConfigured = false;

function ensurePdfWorker(): void {
  if (workerConfigured) return;
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  workerConfigured = true;
}

export function toAbsoluteMediaUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const base = (
    import.meta.env?.VITE_BASE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "")
  ).replace(/\/+$/, "");
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}

export type RenderPdfThumbnailOptions = {
  /** Max width of the rendered page (height scales with aspect). Default 520. */
  maxWidth?: number;
  /** JPEG quality 0–1 for `canvas.toDataURL`. Default 0.82. */
  imageQuality?: number;
};

/**
 * Loads a PDF from a URL (same-origin relative paths are absolutized), renders
 * page 1 to a canvas, and returns a JPEG data URL.
 */
export async function renderPdfFirstPageToDataUrl(
  pdfUrl: string,
  options?: RenderPdfThumbnailOptions
): Promise<string> {
  ensurePdfWorker();
  const maxW = options?.maxWidth ?? 520;
  const imageQuality = options?.imageQuality ?? 0.82;

  const url = toAbsoluteMediaUrl(pdfUrl);
  const loadingTask = pdfjsLib.getDocument({
    url,
    withCredentials: true,
  });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = maxW / baseViewport.width;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) {
    throw new Error("2D canvas context is not available");
  }

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const renderTask = page.render({
    canvasContext: ctx,
    viewport,
    canvas,
  });
  await renderTask.promise;

  return canvas.toDataURL("image/jpeg", imageQuality);
}

export function isPdfFileName(name: string): boolean {
  return /\.pdf$/i.test(name);
}
