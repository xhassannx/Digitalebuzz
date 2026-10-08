/**
 * Automatic log rotation: truncates PM2/app log files when they exceed a max size,
 * and deletes log files older than retention days to save disk space.
 */
import fs from 'fs';
import path from 'path';

const LOGS_DIR = path.join(process.cwd(), 'logs');
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024; // 10MB
const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const DEFAULT_RETENTION_DAYS = 1;

function getMaxBytes(): number {
  const env = process.env.LOG_ROTATE_MAX_MB;
  if (env != null && env !== '') {
    const n = parseInt(env, 10);
    if (!isNaN(n) && n > 0) return n * 1024 * 1024;
  }
  return DEFAULT_MAX_BYTES;
}

function getIntervalMs(): number {
  const env = process.env.LOG_ROTATE_INTERVAL_HOURS;
  if (env != null && env !== '') {
    const n = parseFloat(env);
    if (!isNaN(n) && n > 0) return n * 60 * 60 * 1000;
  }
  return DEFAULT_INTERVAL_MS;
}

function getRetentionDays(): number {
  const env = process.env.LOG_RETENTION_DAYS;
  if (env != null && env !== '') {
    const n = parseInt(env, 10);
    if (!isNaN(n) && n > 0) return n;
  }
  return DEFAULT_RETENTION_DAYS;
}

export function rotateLogs(): void {
  if (!fs.existsSync(LOGS_DIR)) return;

  const maxBytes = getMaxBytes();
  const retentionDays = getRetentionDays();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  let truncated = 0;
  let deleted = 0;

  try {
    const entries = fs.readdirSync(LOGS_DIR, { withFileTypes: true });
    for (const ent of entries) {
      if (!ent.isFile() || !ent.name.endsWith('.log')) continue;
      const filePath = path.join(LOGS_DIR, ent.name);
      try {
        const stat = fs.statSync(filePath);
        const mtime = stat.mtime;
        // Delete files older than retention days
        if (mtime < cutoff) {
          fs.unlinkSync(filePath);
          deleted++;
          console.log(`[Log rotation] Deleted ${ent.name} (older than ${retentionDays} day(s))`);
          continue;
        }
        // Truncate files exceeding max size
        if (stat.size > maxBytes) {
          fs.truncateSync(filePath, 0);
          truncated++;
          console.log(`[Log rotation] Truncated ${ent.name} (was ${Math.round(stat.size / 1024 / 1024)}MB)`);
        }
      } catch (err: any) {
        console.warn(`[Log rotation] Skip ${ent.name}:`, err?.message || err);
      }
    }
    if (truncated > 0 || deleted > 0) {
      console.log(`[Log rotation] Cleaned ${truncated} truncated, ${deleted} deleted. Next check in ${getIntervalMs() / 3600000}h`);
    }
  } catch (err: any) {
    console.warn('[Log rotation] Error reading logs dir:', err?.message || err);
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Start automatic log rotation: run once after delayMs, then every interval.
 * Call once after server is ready (e.g. in server listen callback).
 */
export function startLogRotation(delayMs: number = 60_000): void {
  if (intervalId != null) return;

  const intervalMs = getIntervalMs();
  const maxMb = getMaxBytes() / (1024 * 1024);
  const retentionDays = getRetentionDays();

  console.log(`[Log rotation] Enabled: truncate logs > ${maxMb}MB, delete logs older than ${retentionDays} day(s), check every ${intervalMs / 3600000}h`);

  const run = () => rotateLogs();

  setTimeout(() => {
    run();
    intervalId = setInterval(run, intervalMs);
  }, delayMs);
}
