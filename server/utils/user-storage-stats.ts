import fs from "fs";
import path from "path";
import { sql } from "drizzle-orm";
import { db } from "../../db";
import { organizations } from "@shared/schema";
import { getMediaStorageMode, isS3MediaEnabled } from "./media-storage";

export type UserStorageBreakdown = {
  databaseBytes: number;
  directoryBytes: number;
  totalBytes: number;
};

const UPLOADS_ROOT = path.join(process.cwd(), "uploads");
const CACHE_TTL_MS = 10 * 60 * 1000;

let cache: { at: number; data: Map<string, UserStorageBreakdown> } | null = null;
let inflight: Promise<Map<string, UserStorageBreakdown>> | null = null;

function dirSizeBytes(dirPath: string): number {
  if (!fs.existsSync(dirPath)) return 0;
  let total = 0;
  const stack = [dirPath];
  while (stack.length) {
    const current = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) {
        try {
          total += fs.statSync(full).size;
        } catch {
          /* ignore */
        }
      }
    }
  }
  return total;
}

function parseRows(result: unknown): Array<{ user_id: string; database_bytes: string | number | null }> {
  if (Array.isArray(result)) return result as Array<{ user_id: string; database_bytes: string | number | null }>;
  const rows = (result as { rows?: Array<{ user_id: string; database_bytes: string | number | null }> })?.rows;
  return rows ?? [];
}

function addToMap(map: Map<string, number>, rows: Array<{ user_id: string; database_bytes: string | number | null }>) {
  for (const row of rows) {
    if (!row.user_id) continue;
    map.set(row.user_id, (map.get(row.user_id) ?? 0) + Number(row.database_bytes ?? 0));
  }
}

/** Fast approximate DB payload: row overhead + main text columns, aggregated per table. */
async function getDatabaseBytesByUser(): Promise<Map<string, number>> {
  const map = new Map<string, number>();

  const queries = [
    db.execute(sql`
      SELECT ws.user_id,
        (
          COUNT(*)::bigint * 180
          + COALESCE(SUM(octet_length(m.body)), 0)
          + COALESCE(SUM(octet_length(m.media_url)), 0)
        ) AS database_bytes
      FROM messages m
      INNER JOIN whatsapp_sessions ws ON ws.session_id = m.session_id
      GROUP BY ws.user_id
    `),
    db.execute(sql`
      SELECT user_id,
        (
          COUNT(*)::bigint * 120
          + COALESCE(SUM(octet_length(name)), 0)
          + COALESCE(SUM(octet_length(phone_number)), 0)
          + COALESCE(SUM(octet_length(COALESCE(notes, ''))), 0)
          + COALESCE(SUM(octet_length(COALESCE(custom_fields::text, ''))), 0)
        ) AS database_bytes
      FROM managed_contacts
      GROUP BY user_id
    `),
    db.execute(sql`
      SELECT aa.user_id,
        (COALESCE(SUM(kb.size_bytes), 0) + COUNT(*)::bigint * 40) AS database_bytes
      FROM ai_assistant_knowledge_files kb
      INNER JOIN ai_assistants aa ON aa.id = kb.assistant_id
      GROUP BY aa.user_id
    `),
    db.execute(sql`
      SELECT c.user_id,
        (COUNT(*)::bigint * 80) AS database_bytes
      FROM campaign_recipients cr
      INNER JOIN campaigns c ON c.id = cr.campaign_id
      GROUP BY c.user_id
    `),
    db.execute(sql`
      SELECT user_id,
        (
          COUNT(*)::bigint * 100
          + COALESCE(SUM(octet_length(COALESCE(components::text, ''))), 0)
        ) AS database_bytes
      FROM message_templates
      GROUP BY user_id
    `),
    db.execute(sql`
      SELECT user_id,
        (
          COUNT(*)::bigint * 80
          + COALESCE(SUM(octet_length(COALESCE(response_data::text, ''))), 0)
        ) AS database_bytes
      FROM whatsapp_flow_responses
      GROUP BY user_id
    `),
  ];

  const results = await Promise.allSettled(queries);
  for (const result of results) {
    if (result.status === "fulfilled") {
      addToMap(map, parseRows(result.value));
    } else {
      console.warn("[UserStorage] DB size query failed:", result.reason?.message || result.reason);
    }
  }
  return map;
}

async function getDirectoryBytesByUser(): Promise<Map<string, number>> {
  const orgRows = await db.select({ id: organizations.id, ownerId: organizations.ownerId }).from(organizations);
  const orgOwners = new Map(orgRows.map((r) => [r.id, r.ownerId]));
  const userBytes = new Map<string, number>();

  const addBytes = (userId: string, bytes: number) => {
    if (bytes <= 0) return;
    userBytes.set(userId, (userBytes.get(userId) ?? 0) + bytes);
  };

  // Local uploads only on this path — S3 listing every org is too slow for the admin list.
  // When MEDIA_STORAGE=s3|dual, local dual copies / profile files still count; skip remote walk.
  if (fs.existsSync(UPLOADS_ROOT)) {
    for (const entry of fs.readdirSync(UPLOADS_ROOT, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const name = entry.name;
      if (name === "profile") {
        const profileDir = path.join(UPLOADS_ROOT, "profile");
        try {
          for (const file of fs.readdirSync(profileDir, { withFileTypes: true })) {
            if (!file.isFile()) continue;
            const userId = path.basename(file.name, path.extname(file.name));
            if (!userId) continue;
            try {
              addBytes(userId, fs.statSync(path.join(profileDir, file.name)).size);
            } catch {
              /* ignore */
            }
          }
        } catch {
          /* ignore */
        }
        continue;
      }

      const ownerId = orgOwners.get(name);
      if (!ownerId) continue;
      addBytes(ownerId, dirSizeBytes(path.join(UPLOADS_ROOT, name)));
    }
  }

  if (isS3MediaEnabled() && getMediaStorageMode() === "s3") {
    // Pure S3: local uploads may be empty; keep zeros rather than hanging the page on ListObjects.
    console.warn("[UserStorage] MEDIA_STORAGE=s3 — file sizes use local uploads/ only (S3 walk skipped for speed)");
  }

  return userBytes;
}

async function computeUserStorageStatsMap(): Promise<Map<string, UserStorageBreakdown>> {
  const [dbBytes, dirBytes] = await Promise.all([getDatabaseBytesByUser(), getDirectoryBytesByUser()]);
  const allUserIds = new Set([...dbBytes.keys(), ...dirBytes.keys()]);
  const data = new Map<string, UserStorageBreakdown>();

  for (const userId of allUserIds) {
    const databaseBytes = dbBytes.get(userId) ?? 0;
    const directoryBytes = dirBytes.get(userId) ?? 0;
    data.set(userId, {
      databaseBytes,
      directoryBytes,
      totalBytes: databaseBytes + directoryBytes,
    });
  }
  return data;
}

/** Approximate per-user storage. Cached 10 min; concurrent callers share one in-flight compute. */
export async function getUserStorageStatsMap(): Promise<Map<string, UserStorageBreakdown>> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.data;
  }
  if (inflight) return inflight;

  inflight = computeUserStorageStatsMap()
    .then((data) => {
      cache = { at: Date.now(), data };
      return data;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function storageStatsToObject(
  map: Map<string, UserStorageBreakdown>
): Record<string, UserStorageBreakdown> {
  const out: Record<string, UserStorageBreakdown> = {};
  for (const [userId, value] of map) {
    out[userId] = value;
  }
  return out;
}
