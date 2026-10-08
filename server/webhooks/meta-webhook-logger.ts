import fs from "fs";
import path from "path";

const LOG_DIR = path.join(process.cwd(), "logs", "webhook-logs");

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function getLogFilePath(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return path.join(LOG_DIR, `webhook-${y}-${m}-${d}.jsonl`);
}

export type WebhookLogEntry = {
  id: string;
  timestamp: string;
  eventType: string;
  field: string | null;
  payload: Record<string, unknown>;
  phoneNumberId: string | null;
  displayPhoneNumber: string | null;
  messageCount: number | null;
  statusCount: number | null;
};

/** Append a webhook event to the daily JSONL log file (non-blocking) */
export function appendWebhookLog(entry: Omit<WebhookLogEntry, "id" | "timestamp">): void {
  setImmediate(() => {
    try {
      ensureLogDir();
      const now = new Date();
      const filePath = getLogFilePath(now);
      const id = `${now.getTime()}-${Math.random().toString(36).slice(2, 11)}`;
      const line = JSON.stringify({
        id,
        timestamp: now.toISOString(),
        ...entry,
      }) + "\n";
      fs.appendFileSync(filePath, line);
    } catch (err: any) {
      console.error("[Webhook Log] Failed to write log file:", err?.message);
    }
  });
}

/** List available log file paths (newest first), optionally filtered by date range */
export function getLogFilePaths(daysBack: number = 7): string[] {
  ensureLogDir();
  const files = fs.readdirSync(LOG_DIR).filter((f) => f.startsWith("webhook-") && f.endsWith(".jsonl"));
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);
  const paths = files
    .map((f) => {
      const match = f.match(/webhook-(\d{4})-(\d{2})-(\d{2})\.jsonl/);
      if (!match) return null;
      const [, y, m, d] = match;
      const fileDate = new Date(parseInt(y!), parseInt(m!) - 1, parseInt(d!));
      return { path: path.join(LOG_DIR, f), date: fileDate };
    })
    .filter((p): p is { path: string; date: Date } => p !== null && p.date >= cutoff)
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map((p) => p.path);
  return paths;
}

/** Read and parse log entries from files, with optional filter and pagination */
export function readWebhookLogs(options: {
  limit?: number;
  offset?: number;
  eventType?: string;
  daysBack?: number;
}): WebhookLogEntry[] {
  const { limit = 100, offset = 0, eventType, daysBack = 30 } = options;
  const filePaths = getLogFilePaths(daysBack);
  const allEntries: WebhookLogEntry[] = [];

  for (const filePath of filePaths) {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n").filter((l) => l.trim());
      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as WebhookLogEntry;
          if (eventType && entry.eventType !== eventType) continue;
          allEntries.push(entry);
        } catch {
          // skip malformed lines
        }
      }
    } catch {
      // skip unreadable files
    }
  }

  // Sort by timestamp descending (newest first)
  allEntries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return allEntries.slice(offset, offset + limit);
}

const DEFAULT_RETENTION_DAYS = 1;
const DEFAULT_CLEANUP_INTERVAL_MS = 1 * 60 * 60 * 1000; // 1 hour (run frequently to avoid disk buildup)

function getRetentionDays(): number {
  const env = process.env.WEBHOOK_LOG_RETENTION_DAYS;
  if (env != null && env !== "") {
    const n = parseInt(env, 10);
    if (!isNaN(n) && n > 0) return n;
  }
  return DEFAULT_RETENTION_DAYS;
}

function getCleanupIntervalMs(): number {
  const env = process.env.WEBHOOK_LOG_CLEANUP_INTERVAL_HOURS;
  if (env != null && env !== "") {
    const n = parseFloat(env);
    if (!isNaN(n) && n > 0) return n * 60 * 60 * 1000;
  }
  return DEFAULT_CLEANUP_INTERVAL_MS;
}

/** Delete webhook log files older than retention days */
export function cleanupOldWebhookLogs(): number {
  if (!fs.existsSync(LOG_DIR)) return 0;

  const retentionDays = getRetentionDays();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  let deleted = 0;

  try {
    const files = fs.readdirSync(LOG_DIR).filter((f) => f.startsWith("webhook-") && f.endsWith(".jsonl"));
    for (const f of files) {
      const match = f.match(/webhook-(\d{4})-(\d{2})-(\d{2})\.jsonl/);
      if (!match) continue;
      const [, y, m, d] = match;
      const fileDate = new Date(parseInt(y!), parseInt(m!) - 1, parseInt(d!));
      if (fileDate < cutoff) {
        const filePath = path.join(LOG_DIR, f);
        try {
          fs.unlinkSync(filePath);
          deleted++;
          console.log(`[Webhook Log Cleanup] Deleted ${f} (older than ${retentionDays} days)`);
        } catch (err: any) {
          console.warn(`[Webhook Log Cleanup] Failed to delete ${f}:`, err?.message || err);
        }
      }
    }
  } catch (err: any) {
    console.warn("[Webhook Log Cleanup] Error:", err?.message || err);
  }
  return deleted;
}

let cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Start automatic webhook log cleanup: delete files older than retention days.
 * Runs continuously on an interval (default every 6 hours).
 */
export function startWebhookLogCleanup(delayMs: number = 60_000): void {
  if (process.env.DISABLE_WEBHOOK_LOG_CLEANUP === "true") return;
  if (cleanupIntervalId != null) return;

  const intervalMs = getCleanupIntervalMs();
  const retentionDays = getRetentionDays();

  console.log(
    `[Webhook Log Cleanup] Enabled: delete logs older than ${retentionDays} days, check every ${intervalMs / 3600000}h`
  );

  const run = () => {
    const deleted = cleanupOldWebhookLogs();
    if (deleted > 0) {
      console.log(`[Webhook Log Cleanup] Removed ${deleted} old file(s)`);
    }
  };

  setTimeout(() => {
    run();
    cleanupIntervalId = setInterval(run, intervalMs);
  }, delayMs);
}
