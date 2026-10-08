/**
 * Gallery multipart upload with accurate progress, retries, and structured errors.
 * Multipart bodies are slightly larger than raw file bytes; progress uses max(reported, file size).
 */

const DEFAULT_MAX_RETRIES = 3;
const UPLOAD_PHASE_PCT = 92;
const XHR_TIMEOUT_MS = 15 * 60 * 1000;

function parseErrorMessage(xhr: XMLHttpRequest): string {
  const raw = xhr.responseText?.trim();
  if (!raw) {
    if (xhr.status === 413) return "File is too large for the server.";
    if (xhr.status === 429) return "Too many requests. Please wait and try again.";
    if (xhr.status === 0) return "Network error or connection was reset.";
    return `Upload failed (${xhr.status || "error"})`;
  }
  try {
    const j = JSON.parse(raw) as { error?: string; message?: string };
    return j.error || j.message || raw;
  } catch {
    return raw.slice(0, 200);
  }
}

function isRetriableStatus(status: number): boolean {
  return status === 408 || status === 429 || status === 502 || status === 503 || status === 504;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export type GalleryUploadOptions = {
  maxRetries?: number;
  signal?: AbortSignal;
  /** Called before a retry; `nextAttempt` is 2 on the first retry (second try overall). */
  onRetry?: (nextAttempt: number) => void;
};

/**
 * Uploads a single file to POST /api/gallery/upload.
 * Progress 0–92% while bytes are sent; 100% after HTTP 2xx response.
 */
export function uploadGalleryFile(
  file: File,
  onProgress: (percent: number) => void,
  options?: GalleryUploadOptions
): Promise<void> {
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
  const maxAttempts = 1 + maxRetries;
  const signal = options?.signal;
  const onRetry = options?.onRetry;

  const runOnce = (): Promise<void> =>
    new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }

      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append("file", file);

      const estimateTotal = () => {
        const overhead = 2048;
        return Math.max(file.size + overhead, 1);
      };

      let lastReported = -1;
      const report = (pct: number) => {
        const rounded = Math.min(100, Math.max(0, Math.round(pct)));
        if (rounded !== lastReported) {
          lastReported = rounded;
          onProgress(rounded);
        }
      };

      const cleanupAbort = () => {
        signal?.removeEventListener("abort", onAbort);
      };

      const onAbort = () => {
        xhr.abort();
      };

      xhr.open("POST", "/api/gallery/upload");
      xhr.withCredentials = true;
      xhr.timeout = XHR_TIMEOUT_MS;

      xhr.upload.onprogress = (e) => {
        const baseTotal =
          e.lengthComputable && e.total > 0 ? e.total : estimateTotal();
        const loaded = Math.min(e.loaded, baseTotal);
        const ratio = loaded / baseTotal;
        report(Math.min(UPLOAD_PHASE_PCT, ratio * UPLOAD_PHASE_PCT));
      };

      xhr.onload = () => {
        cleanupAbort();
        if (xhr.status >= 200 && xhr.status < 300) {
          report(100);
          resolve();
          return;
        }
        const err = new Error(parseErrorMessage(xhr)) as Error & {
          status?: number;
        };
        err.status = xhr.status;
        reject(err);
      };

      xhr.onerror = () => {
        cleanupAbort();
        const err = new Error(parseErrorMessage(xhr)) as Error & {
          status?: number;
        };
        err.status = xhr.status || 0;
        reject(err);
      };

      xhr.ontimeout = () => {
        cleanupAbort();
        reject(
          Object.assign(
            new Error("Upload timed out. Try again on a stable connection."),
            { status: 0 }
          )
        );
      };

      xhr.onabort = () => {
        cleanupAbort();
        reject(new DOMException("Aborted", "AbortError"));
      };

      signal?.addEventListener("abort", onAbort);
      xhr.send(formData);
      report(0);
    });

  return (async () => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        if (attempt > 0) onProgress(0);
        await runOnce();
        return;
      } catch (e: unknown) {
        if (signal?.aborted) throw e;
        if (e instanceof DOMException && e.name === "AbortError") throw e;
        const err = e as Error & { status?: number };
        const status = typeof err.status === "number" ? err.status : 0;
        const retriable =
          isRetriableStatus(status) ||
          (status === 0 && !(e instanceof Error && /abort/i.test(e.name)));
        const lastAttempt = attempt >= maxAttempts - 1;
        if (lastAttempt || !retriable) throw e;
        onRetry?.(attempt + 2);
        const backoff = Math.min(8000, 1000 * 2 ** attempt);
        await delay(backoff);
      }
    }
  })();
}
